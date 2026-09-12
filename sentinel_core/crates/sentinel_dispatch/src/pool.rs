//! TCP & TLS Connection Pooling Engine for Sentinel Dispatch
//!
//! Provides thread-safe, high-performance connection pooling with:
//! - RFC 7230 / RFC 9112 keep-alive socket reuse across HTTP probes
//! - Non-blocking socket health checking (`try_read`) to detect peer disconnects
//! - Idle connection expiration and background reaping
//! - Bounded connection limits per host and across the entire pool
//! - Transparent transport over plain TCP and TLS streams

use std::collections::{HashMap, VecDeque};
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, ReadBuf};
use tokio::net::TcpStream;
use tokio_rustls::client::TlsStream;
use tokio_rustls::rustls::pki_types::ServerName;
use tokio_rustls::rustls::ClientConfig;
use tokio_rustls::TlsConnector;

use sentinel_common::errors::SentinelError;

/// Key identifying a unique authority (host, port, TLS state) in the connection pool.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PoolKey {
    pub host: String,
    pub port: u16,
    pub is_tls: bool,
}

impl PoolKey {
    pub fn new(host: impl Into<String>, port: u16, is_tls: bool) -> Self {
        Self {
            host: host.into(),
            port,
            is_tls,
        }
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

/// Unified transport wrapping either plain TCP or TLS client streams.
pub enum PooledTransport {
    Plain(TcpStream),
    Tls(TlsStream<TcpStream>),
}

impl PooledTransport {
    /// Non-blocking check to verify if the underlying OS socket is still alive and idle.
    ///
    /// - `WouldBlock`: Connection is alive, open, and has no stale unread data (HEALTHY).
    /// - `Ok(0)`: Remote peer sent FIN (DEAD).
    /// - `Ok(_)`: Unexpected unread bytes in buffer (DESYNCED).
    /// - `Err(_)`: Socket reset or error (DEAD).
    pub fn is_healthy(&self) -> bool {
        let mut buf = [0u8; 1];
        let res = match self {
            PooledTransport::Plain(s) => s.try_read(&mut buf),
            PooledTransport::Tls(s) => s.get_ref().0.try_read(&mut buf),
        };
        match res {
            Ok(0) => false,
            Ok(_) => false,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => true,
            Err(_) => false,
        }
    }

    /// Sets `TCP_NODELAY` on the underlying TCP stream to eliminate Nagle packet delays.
    pub fn set_nodelay(&self, nodelay: bool) -> std::io::Result<()> {
        match self {
            PooledTransport::Plain(s) => s.set_nodelay(nodelay),
            PooledTransport::Tls(s) => s.get_ref().0.set_nodelay(nodelay),
        }
    }
}

impl AsyncRead for PooledTransport {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        match self.get_mut() {
            PooledTransport::Plain(s) => Pin::new(s).poll_read(cx, buf),
            PooledTransport::Tls(s) => Pin::new(s).poll_read(cx, buf),
        }
    }
}

impl AsyncWrite for PooledTransport {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        match self.get_mut() {
            PooledTransport::Plain(s) => Pin::new(s).poll_write(cx, buf),
            PooledTransport::Tls(s) => Pin::new(s).poll_write(cx, buf),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        match self.get_mut() {
            PooledTransport::Plain(s) => Pin::new(s).poll_flush(cx),
            PooledTransport::Tls(s) => Pin::new(s).poll_flush(cx),
        }
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        match self.get_mut() {
            PooledTransport::Plain(s) => Pin::new(s).poll_shutdown(cx),
            PooledTransport::Tls(s) => Pin::new(s).poll_shutdown(cx),
        }
    }
}

/// Configuration parameters for connection pooling.
#[derive(Debug, Clone)]
pub struct PoolConfig {
    pub max_idle_per_host: usize,
    pub max_total_idle: usize,
    pub idle_timeout: Duration,
    pub connect_timeout: Duration,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_idle_per_host: 16,
            max_total_idle: 128,
            idle_timeout: Duration::from_secs(45),
            connect_timeout: Duration::from_secs(10),
        }
    }
}

/// Runtime telemetry metrics for the connection pool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolMetrics {
    pub total_idle: usize,
    pub total_created: usize,
    pub total_reused: usize,
    pub active_hosts: usize,
}

struct IdleEntry {
    transport: PooledTransport,
    idle_since: Instant,
}

struct PoolInner {
    entries: HashMap<PoolKey, VecDeque<IdleEntry>>,
    total_idle: usize,
    total_connections_created: usize,
    total_connections_reused: usize,
}

/// Thread-safe TCP and TLS connection pool.
pub struct HttpConnectionPool {
    config: PoolConfig,
    tls_config: Arc<ClientConfig>,
    inner: Mutex<PoolInner>,
}

impl HttpConnectionPool {
    /// Creates a new connection pool with custom configuration and TLS client settings.
    pub fn new(config: PoolConfig, tls_config: Arc<ClientConfig>) -> Self {
        Self {
            config,
            tls_config,
            inner: Mutex::new(PoolInner {
                entries: HashMap::new(),
                total_idle: 0,
                total_connections_created: 0,
                total_connections_reused: 0,
            }),
        }
    }

    /// Acquires a healthy connection for `key`, reusing an idle socket or establishing a fresh connection.
    ///
    /// Returns `(transport, is_reused)`:
    /// - If `is_reused == true`, caller can retry once on write/read error to handle race-condition server close.
    pub async fn acquire(&self, key: &PoolKey) -> Result<(PooledTransport, bool), SentinelError> {
        // 1. Try to pop a healthy idle connection from the pool
        loop {
            let candidate = {
                let mut inner = self.inner.lock();
                if let Some(queue) = inner.entries.get_mut(key) {
                    let item = queue.pop_front();
                    if item.is_some() {
                        inner.total_idle = inner.total_idle.saturating_sub(1);
                    }
                    item
                } else {
                    None
                }
            };

            match candidate {
                Some(entry) => {
                    if entry.idle_since.elapsed() < self.config.idle_timeout
                        && entry.transport.is_healthy()
                    {
                        let mut inner = self.inner.lock();
                        inner.total_connections_reused += 1;
                        return Ok((entry.transport, true));
                    }
                    // Stale or dead socket: drop it to release OS resources and loop
                }
                None => break,
            }
        }

        // 2. Establish fresh connection without holding the mutex lock
        let transport = self.connect_fresh(key).await?;
        {
            let mut inner = self.inner.lock();
            inner.total_connections_created += 1;
        }
        Ok((transport, false))
    }

    /// Releases a healthy connection back into the pool for future reuse.
    pub fn release(&self, key: PoolKey, transport: PooledTransport) {
        if !transport.is_healthy() {
            return; // Discard dead or desynced socket
        }

        let mut inner = self.inner.lock();
        if inner.total_idle >= self.config.max_total_idle {
            return; // Total pool idle limit reached
        }

        let queue = inner.entries.entry(key).or_default();
        if queue.len() >= self.config.max_idle_per_host {
            return; // Host idle limit reached
        }

        queue.push_front(IdleEntry {
            transport,
            idle_since: Instant::now(),
        });
        inner.total_idle += 1;
    }

    /// Evicts expired or dead idle connections. Returns number of connections reaped.
    pub fn reap_idle(&self) -> usize {
        let mut inner = self.inner.lock();
        let timeout = self.config.idle_timeout;
        let mut reaped = 0;
        for queue in inner.entries.values_mut() {
            let before = queue.len();
            queue.retain(|entry| {
                entry.idle_since.elapsed() < timeout && entry.transport.is_healthy()
            });
            reaped += before - queue.len();
        }
        inner.entries.retain(|_, q| !q.is_empty());
        inner.total_idle = inner.total_idle.saturating_sub(reaped);
        reaped
    }

    /// Returns telemetry metrics for the connection pool.
    pub fn metrics(&self) -> PoolMetrics {
        let inner = self.inner.lock();
        PoolMetrics {
            total_idle: inner.total_idle,
            total_created: inner.total_connections_created,
            total_reused: inner.total_connections_reused,
            active_hosts: inner.entries.len(),
        }
    }

    async fn connect_fresh(&self, key: &PoolKey) -> Result<PooledTransport, SentinelError> {
        let addr = key.addr();
        let connect_fut = TcpStream::connect(&addr);
        let stream = tokio::time::timeout(self.config.connect_timeout, connect_fut)
            .await
            .map_err(|_| SentinelError::NetworkError(format!("Connection timeout to {}", addr)))?
            .map_err(|e| {
                SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
            })?;
        stream.set_nodelay(true).ok();

        if key.is_tls {
            let connector = TlsConnector::from(self.tls_config.clone());
            let server_name = ServerName::try_from(key.host.clone()).map_err(|e| {
                SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
            })?;

            let handshake_fut = connector.connect(server_name, stream);
            let tls_stream = tokio::time::timeout(self.config.connect_timeout, handshake_fut)
                .await
                .map_err(|_| {
                    SentinelError::TlsError(format!("TLS handshake timeout with {}", key.host))
                })?
                .map_err(|e| {
                    SentinelError::TlsError(format!(
                        "TLS handshake failed with {}: {}",
                        key.host, e
                    ))
                })?;

            Ok(PooledTransport::Tls(tls_stream))
        } else {
            Ok(PooledTransport::Plain(stream))
        }
    }
}

/// Constructs default Rustls client configuration using Mozilla root certificates.
pub fn default_client_config() -> Arc<ClientConfig> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let mut root_store = rustls::RootCertStore::empty();
    root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let mut config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Arc::new(config)
}

impl Default for HttpConnectionPool {
    fn default() -> Self {
        Self::new(PoolConfig::default(), default_client_config())
    }
}

/// Output of a framed HTTP response read.
#[derive(Debug, Clone)]
pub struct ResponseReadResult {
    pub raw_response: Vec<u8>,
    pub is_reusable: bool,
}

/// Reads an HTTP response from an AsyncRead stream using RFC 9112 framing detection.
/// Completes immediately once the body is fully received without waiting for timeout or EOF.
pub async fn read_http_response_framed<S: AsyncRead + Unpin>(
    stream: &mut S,
    read_timeout: Duration,
    is_head: bool,
) -> Result<ResponseReadResult, SentinelError> {
    let mut buffer = Vec::with_capacity(8192);
    let mut chunk = [0u8; 4096];
    let mut headers_parsed = false;
    let mut content_length: Option<usize> = None;
    let mut is_chunked = false;
    let mut no_body_expected = is_head;
    let mut header_end_offset = 0;
    let mut connection_close = false;

    let start_read = Instant::now();

    loop {
        let elapsed = start_read.elapsed();
        if elapsed >= read_timeout {
            if !buffer.is_empty() {
                return Ok(ResponseReadResult {
                    raw_response: buffer,
                    is_reusable: false,
                });
            }
            return Err(SentinelError::NetworkError(format!(
                "Read timeout ({:?}) exceeded",
                read_timeout
            )));
        }
        let remaining = read_timeout - elapsed;

        // Inactivity slice: if known body, wait up to 5s or remaining;
        // if framing is indeterminate (no body length known yet or close-delimited), use 80ms
        let slice_timeout = if headers_parsed {
            if content_length.is_some() || is_chunked {
                remaining.min(Duration::from_secs(5))
            } else if no_body_expected {
                Duration::from_millis(0)
            } else {
                remaining.min(Duration::from_millis(80))
            }
        } else {
            remaining.min(Duration::from_secs(3))
        };

        if headers_parsed && no_body_expected {
            return Ok(ResponseReadResult {
                raw_response: buffer,
                is_reusable: !connection_close,
            });
        }

        let read_fut = stream.read(&mut chunk);
        let n = match tokio::time::timeout(slice_timeout, read_fut).await {
            Ok(Ok(0)) => {
                // Peer closed socket (EOF)
                return Ok(ResponseReadResult {
                    raw_response: buffer,
                    is_reusable: false,
                });
            }
            Ok(Ok(n)) => n,
            Ok(Err(e)) => {
                if !buffer.is_empty() {
                    return Ok(ResponseReadResult {
                        raw_response: buffer,
                        is_reusable: false,
                    });
                }
                return Err(SentinelError::NetworkError(format!("Read error: {}", e)));
            }
            Err(_) => {
                // Slice timeout fired: check if response already complete
                if headers_parsed {
                    if let Some(cl) = content_length {
                        if buffer.len() >= header_end_offset + cl {
                            return Ok(ResponseReadResult {
                                raw_response: buffer,
                                is_reusable: !connection_close,
                            });
                        }
                    } else if is_chunked {
                        if buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n") {
                            return Ok(ResponseReadResult {
                                raw_response: buffer,
                                is_reusable: !connection_close,
                            });
                        }
                        if sentinel_parser::ChunkedDecoder::decode(
                            &buffer[header_end_offset..],
                            usize::MAX,
                        )
                        .is_ok()
                        {
                            return Ok(ResponseReadResult {
                                raw_response: buffer,
                                is_reusable: !connection_close,
                            });
                        }
                    } else if !buffer.is_empty() {
                        // Indeterminate framing on keep-alive: inactivity indicates end of response
                        return Ok(ResponseReadResult {
                            raw_response: buffer,
                            is_reusable: false,
                        });
                    }
                }
                if start_read.elapsed() >= read_timeout {
                    if !buffer.is_empty() {
                        return Ok(ResponseReadResult {
                            raw_response: buffer,
                            is_reusable: false,
                        });
                    }
                    return Err(SentinelError::NetworkError("Read timeout exceeded".to_string()));
                }
                continue;
            }
        };

        buffer.extend_from_slice(&chunk[..n]);

        if !headers_parsed {
            let delim = if let Some(pos) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
                Some(pos + 4)
            } else if let Some(pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                Some(pos + 2)
            } else {
                None
            };

            if let Some(offset) = delim {
                header_end_offset = offset;
                headers_parsed = true;

                let header_bytes = &buffer[..header_end_offset];
                let header_str = String::from_utf8_lossy(header_bytes);

                let mut lines = header_str.lines();
                if let Some(status_line) = lines.next() {
                    let mut parts = status_line.split_whitespace();
                    let _version = parts.next();
                    if let Some(code_str) = parts.next() {
                        if let Ok(code) = code_str.parse::<u16>() {
                            if (100..=199).contains(&code) || code == 204 || code == 304 {
                                no_body_expected = true;
                            }
                        }
                    }
                }

                for line in lines {
                    let line_trimmed = line.trim();
                    if let Some((k, v)) = line_trimmed.split_once(':') {
                        let key = k.trim().to_ascii_lowercase();
                        let val = v.trim();
                        if key == "content-length" {
                            if let Some(first) = val.split(',').next() {
                                if let Ok(cl) = first.trim().parse::<usize>() {
                                    content_length = Some(cl);
                                }
                            }
                        } else if key == "transfer-encoding"
                            && val.to_ascii_lowercase().contains("chunked")
                        {
                            is_chunked = true;
                        } else if key == "connection" && val.to_ascii_lowercase().contains("close")
                        {
                            connection_close = true;
                        }
                    }
                }
            }
        }

        if headers_parsed {
            if no_body_expected {
                return Ok(ResponseReadResult {
                    raw_response: buffer,
                    is_reusable: !connection_close,
                });
            }
            if let Some(cl) = content_length {
                if buffer.len() >= header_end_offset + cl {
                    return Ok(ResponseReadResult {
                        raw_response: buffer,
                        is_reusable: !connection_close,
                    });
                }
            } else if is_chunked {
                if buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n") {
                    return Ok(ResponseReadResult {
                        raw_response: buffer,
                        is_reusable: !connection_close,
                    });
                }
                if sentinel_parser::ChunkedDecoder::decode(
                    &buffer[header_end_offset..],
                    usize::MAX,
                )
                .is_ok()
                {
                    return Ok(ResponseReadResult {
                        raw_response: buffer,
                        is_reusable: !connection_close,
                    });
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tokio::io::AsyncWriteExt;
    use tokio::net::TcpListener;


    #[tokio::test]
    async fn test_pool_persistent_keepalive_reuse() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let accept_count = Arc::new(AtomicUsize::new(0));
        let ac = accept_count.clone();

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                ac.fetch_add(1, Ordering::SeqCst);
                tokio::spawn(async move {
                    let mut buf = [0u8; 4096];
                    loop {
                        let n = match stream.read(&mut buf).await {
                            Ok(0) => break,
                            Ok(n) => n,
                            Err(_) => break,
                        };
                        let _req = String::from_utf8_lossy(&buf[..n]);
                        let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: keep-alive\r\n\r\nPOOLED";
                        if stream.write_all(resp).await.is_err() {
                            break;
                        }
                    }
                });
            }
        });

        let pool = Arc::new(HttpConnectionPool::default());
        let key = PoolKey::new("127.0.0.1", port, false);

        for _ in 0..10 {
            let (mut transport, _is_reused) = pool.acquire(&key).await.expect("Acquire succeeds");
            let req = format!(
                "GET /test HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
                port
            );
            transport.write_all(req.as_bytes()).await.unwrap();
            let res = read_http_response_framed(&mut transport, Duration::from_secs(2), false)
                .await
                .expect("Framed read succeeds");
            assert!(res.raw_response.ends_with(b"POOLED"));
            assert!(res.is_reusable);
            pool.release(key.clone(), transport);
        }

        // All 10 requests must reuse the exact same single underlying TCP connection!
        assert_eq!(
            accept_count.load(Ordering::SeqCst),
            1,
            "Pool must have reused 1 connection across all 10 requests, eliminating TIME_WAIT"
        );
        let metrics = pool.metrics();
        assert_eq!(metrics.total_reused, 9, "9 of the 10 requests were reuses");
    }

    #[tokio::test]
    async fn test_pool_framing_immediate_return_on_keepalive() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    if let Ok(n) = stream.read(&mut buf).await {
                        if n > 0 {
                            let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 17\r\nConnection: keep-alive\r\n\r\ndispatch_finished";
                            let _ = stream.write_all(resp).await;
                            // Keep socket open without closing
                            tokio::time::sleep(Duration::from_secs(5)).await;
                        }
                    }
                });
            }
        });

        let key = PoolKey::new("127.0.0.1", port, false);
        let pool = HttpConnectionPool::default();
        let (mut transport, _) = pool.acquire(&key).await.unwrap();

        let req = format!(
            "GET /fast HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
            port
        );
        transport.write_all(req.as_bytes()).await.unwrap();

        let start = Instant::now();
        let res = read_http_response_framed(&mut transport, Duration::from_secs(4), false)
            .await
            .unwrap();
        let elapsed = start.elapsed();

        assert!(
            elapsed < Duration::from_millis(50),
            "Framed response read must return immediately on Content-Length, took {:?}",
            elapsed
        );
        assert!(res.raw_response.ends_with(b"dispatch_finished"));
        assert!(res.is_reusable);
    }

    #[tokio::test]
    async fn test_pool_framing_chunked_keepalive() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    if let Ok(n) = stream.read(&mut buf).await {
                        if n > 0 {
                            let resp = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n";
                            let _ = stream.write_all(resp).await;
                            tokio::time::sleep(Duration::from_secs(5)).await;
                        }
                    }
                });
            }
        });

        let key = PoolKey::new("127.0.0.1", port, false);
        let pool = HttpConnectionPool::default();
        let (mut transport, _) = pool.acquire(&key).await.unwrap();

        let req = format!(
            "GET /chunked HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
            port
        );
        transport.write_all(req.as_bytes()).await.unwrap();

        let start = Instant::now();
        let res = read_http_response_framed(&mut transport, Duration::from_secs(4), false)
            .await
            .unwrap();
        let elapsed = start.elapsed();

        assert!(elapsed < Duration::from_millis(50));
        assert!(String::from_utf8_lossy(&res.raw_response).contains("pedia"));
        assert!(res.is_reusable);

    }

    #[tokio::test]
    async fn test_pool_framing_204_no_content() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    if let Ok(n) = stream.read(&mut buf).await {
                        if n > 0 {
                            let resp = b"HTTP/1.1 204 No Content\r\nConnection: keep-alive\r\n\r\n";
                            let _ = stream.write_all(resp).await;
                            tokio::time::sleep(Duration::from_secs(5)).await;
                        }
                    }
                });
            }
        });

        let key = PoolKey::new("127.0.0.1", port, false);
        let pool = HttpConnectionPool::default();
        let (mut transport, _) = pool.acquire(&key).await.unwrap();

        let req = format!(
            "GET /204 HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
            port
        );
        transport.write_all(req.as_bytes()).await.unwrap();

        let start = Instant::now();
        let res = read_http_response_framed(&mut transport, Duration::from_secs(4), false)
            .await
            .unwrap();
        let elapsed = start.elapsed();

        assert!(elapsed < Duration::from_millis(50));
        assert!(res.raw_response.starts_with(b"HTTP/1.1 204"));
        assert!(res.is_reusable);
    }
}


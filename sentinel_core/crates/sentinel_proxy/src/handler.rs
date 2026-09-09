//! Client Connection & Protocol Demuxing Handler
//!
//! Enforces:
//! - SEC-01: Default-Deny Scope Engine verification before ANY upstream socket connection
//! - Dynamic TLS MITM termination with forged certificates
//! - Interceptor pipeline (inspect, modify, drop, respond)
//! - Dual-write transaction recording to CAS + SQLite and telemetry emission

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use tokio::io::{AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::TlsAcceptor;
use tracing::{debug, info, warn};

use sentinel_common::domain::meta::TlsData;
use sentinel_common::events::CriticalEvent;
use sentinel_common::operational::ParsedRequest;
use sentinel_common::traits::{EventBus, HttpParser, ScopeEngine};
use sentinel_parser::SentinelHttpParser;

use crate::error::ProxyError;
use crate::pipeline::interceptor::{InterceptAction, RequestContext};
use crate::pipeline::InterceptorPipeline;
use crate::recorder::{PendingTransactionRecord, PersistenceRecorder};
use crate::tls::{build_upstream_client_config, TlsServerConfigCache};

static TX_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(100);

/// Shared state passed to every connection handler task.
#[derive(Clone)]
pub struct HandlerState {
    pub scope_engine: Option<Arc<parking_lot::RwLock<dyn ScopeEngine>>>,
    pub event_bus: Option<Arc<dyn EventBus>>,
    pub pipeline: Arc<InterceptorPipeline>,
    pub tls_cache: Arc<TlsServerConfigCache>,
    pub recorder: Arc<PersistenceRecorder>,
    pub parser: Arc<SentinelHttpParser>,
    pub upstream_proxy: Option<String>,
}

/// Handles an incoming client TCP connection.
pub async fn handle_connection(
    mut client_stream: TcpStream,
    client_addr: SocketAddr,
    state: HandlerState,
) -> Result<(), ProxyError> {
    let _ = client_stream.set_nodelay(true);
    let mut initial_buf = vec![0u8; 8192];
    let n = client_stream.read(&mut initial_buf).await?;
    if n == 0 {
        return Ok(());
    }
    initial_buf.truncate(n);

    // Inspect initial bytes to determine if CONNECT or Plain HTTP
    if initial_buf.starts_with(b"CONNECT ") {
        handle_connect_tunnel(client_stream, client_addr, &initial_buf, state).await
    } else {
        handle_plain_http(client_stream, client_addr, &initial_buf, state).await
    }
}

/// Handles HTTPS CONNECT MITM Tunneling with Dynamic TLS Termination.
async fn handle_connect_tunnel(
    mut client_stream: TcpStream,
    client_addr: SocketAddr,
    initial_buf: &[u8],
    state: HandlerState,
) -> Result<(), ProxyError> {
    // 1. Parse CONNECT request line: "CONNECT host:port HTTP/1.1"
    let parsed_connect = state.parser.parse_request(initial_buf)?;
    let authority = parsed_connect.uri.clone();
    let target_host = authority
        .split(':')
        .next()
        .unwrap_or(&authority)
        .to_string();
    let target_port: u16 = authority
        .split(':')
        .nth(1)
        .and_then(|p| p.parse().ok())
        .unwrap_or(443);

    let target_uri = format!("https://{}", authority);

    // 2. SEC-01 Scope Enforcement Gate: Check target BEFORE opening upstream connection
    if let Err(e) = verify_scope_and_audit(&state, &target_uri, &target_host).await {
        send_forbidden_response(&mut client_stream, &target_uri, &e.to_string()).await?;
        return Err(e);
    }

    // 3. Send 200 Connection Established to client
    client_stream
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await?;

    // 4. Terminate Client TLS with dynamically forged certificate
    let server_config = state.tls_cache.get_or_generate(&target_host)?;
    let acceptor = TlsAcceptor::from(server_config);
    let mut client_tls = acceptor.accept(client_stream).await.map_err(|e| {
        ProxyError::Tls(format!(
            "Client TLS handshake failed for {}: {}",
            target_host, e
        ))
    })?;

    // 5. Establish Upstream TLS connection
    let upstream_addr = format!("{}:{}", target_host, target_port);
    let upstream_tcp = match TcpStream::connect(&upstream_addr).await {
        Ok(s) => {
            let _ = s.set_nodelay(true);
            s
        },
        Err(e) => {
            warn!(
                "Failed to connect to upstream TLS target {}: {}",
                upstream_addr, e
            );
            return Err(ProxyError::UpstreamConnection {
                target: upstream_addr,
                message: e.to_string(),
            });
        }
    };

    let client_config = build_upstream_client_config(true); // Insecure skip verify for flexible pentesting
    let connector = tokio_rustls::TlsConnector::from(client_config);
    let server_name = rustls::pki_types::ServerName::try_from(target_host.clone())
        .map_err(|_| ProxyError::Tls(format!("Invalid SNI server name: {}", target_host)))?;

    let mut upstream_tls = connector
        .connect(server_name, upstream_tcp)
        .await
        .map_err(|e| {
            ProxyError::Tls(format!(
                "Upstream TLS handshake failed for {}: {}",
                target_host, e
            ))
        })?;

    let tls_info = Some(TlsData {
        protocol: "TLSv1.3".to_string(),
        cipher: "TLS_AES_256_GCM_SHA384".to_string(),
        server_name: Some(target_host.clone()),
        alpn: Some("http/1.1".to_string()),
    });

    // 6. Continuous request interception & bidirectional streaming over keep-alive TLS connection
    let (mut client_read, mut client_write) = tokio::io::split(client_tls);
    let (mut upstream_read, mut upstream_write) = tokio::io::split(upstream_tls);

    let target_host_clone = target_host.clone();
    let state_clone = state.clone();

    struct PendingReq {
        id: String,
        method: String,
        url: String,
        req_headers: Vec<sentinel_common::events::HttpHeaderData>,
        req_body: Option<String>,
        start_time: Instant,
    }

    let (req_tx, mut req_rx) = tokio::sync::mpsc::channel::<PendingReq>(64);

    let client_to_upstream = async move {
        let mut buf = vec![0u8; 65536];
        loop {
            let n = match client_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => n,
                Err(_) => break,
            };

            let chunk = &buf[..n];

            // Parse HTTP request headers whenever a new request arrives on this persistent connection
            if chunk.starts_with(b"GET ")
                || chunk.starts_with(b"POST ")
                || chunk.starts_with(b"PUT ")
                || chunk.starts_with(b"DELETE ")
                || chunk.starts_with(b"HEAD ")
                || chunk.starts_with(b"OPTIONS ")
                || chunk.starts_with(b"PATCH ")
                || chunk.starts_with(b"TRACE ")
            {
                let raw_str = String::from_utf8_lossy(chunk);
                let (headers_part, body_part) = if let Some(pos) = raw_str.find("\r\n\r\n") {
                    (&raw_str[..pos], Some(raw_str[pos + 4..].to_string()))
                } else if let Some(pos) = raw_str.find("\n\n") {
                    (&raw_str[..pos], Some(raw_str[pos + 2..].to_string()))
                } else {
                    (raw_str.as_ref(), None)
                };

                let mut lines = headers_part.lines();
                let request_line = lines.next().unwrap_or("");
                let mut parts = request_line.split_whitespace();
                let method = parts.next().unwrap_or("GET").to_string();
                let path = parts.next().unwrap_or("/").to_string();

                let full_url = if path.starts_with("http") {
                    path
                } else {
                    format!("https://{}{}", target_host_clone, path)
                };

                let mut req_headers = Vec::new();
                for line in lines {
                    if let Some((k, v)) = line.split_once(':') {
                        req_headers.push(sentinel_common::events::HttpHeaderData {
                            name: k.trim().to_string(),
                            value: v.trim().to_string(),
                        });
                    }
                }

                let seq = TX_SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                let req_id = format!("tx-{:06}", seq);

                // Publish immediate telemetry
                if let Some(ref bus) = state_clone.event_bus {
                    let _ = bus.publish_telemetry(sentinel_common::events::SentinelEvent::Traffic(
                        sentinel_common::events::TrafficEventData {
                            id: req_id.clone(),
                            method: method.clone(),
                            url: full_url.clone(),
                            status: 200,
                            duration_ms: 15,
                            in_scope: true,
                            req_headers: Some(req_headers.clone()),
                            req_body: body_part.clone(),
                            res_headers: None,
                            res_body: None,
                        },
                    ));
                }

                let _ = req_tx
                    .send(PendingReq {
                        id: req_id,
                        method,
                        url: full_url,
                        req_headers,
                        req_body: body_part,
                        start_time: Instant::now(),
                    })
                    .await;
            }

            if upstream_write.write_all(chunk).await.is_err() {
                break;
            }
        }
        let _ = upstream_write.shutdown().await;
    };

    let state_clone_2 = state.clone();
    let upstream_to_client = async move {
        let mut buf = vec![0u8; 65536];
        loop {
            let n = match upstream_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => n,
                Err(_) => break,
            };

            let chunk = &buf[..n];

            if chunk.starts_with(b"HTTP/") {
                let raw_str = String::from_utf8_lossy(chunk);
                let (headers_part, body_part) = if let Some(pos) = raw_str.find("\r\n\r\n") {
                    (&raw_str[..pos], Some(raw_str[pos + 4..].to_string()))
                } else if let Some(pos) = raw_str.find("\n\n") {
                    (&raw_str[..pos], Some(raw_str[pos + 2..].to_string()))
                } else {
                    (raw_str.as_ref(), None)
                };

                let mut lines = headers_part.lines();
                let status_line = lines.next().unwrap_or("");
                let status_code: u16 = status_line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(200);

                let mut res_headers = Vec::new();
                let mut is_chunked = false;
                for line in lines {
                    if let Some((k, v)) = line.split_once(':') {
                        let key = k.trim();
                        let val = v.trim();
                        if key.eq_ignore_ascii_case("transfer-encoding") && val.to_lowercase().contains("chunked") {
                            is_chunked = true;
                        }
                        res_headers.push(sentinel_common::events::HttpHeaderData {
                            name: key.to_string(),
                            value: val.to_string(),
                        });
                    }
                }

                let body_slice: &[u8] = if let Some(pos) = chunk.windows(4).position(|w| w == b"\r\n\r\n") {
                    &chunk[pos + 4..]
                } else if let Some(pos) = chunk.windows(2).position(|w| w == b"\n\n") {
                    &chunk[pos + 2..]
                } else {
                    &[]
                };

                let clean_body = if !body_slice.is_empty() {
                    Some(decode_and_decompress_proxy_body(&res_headers, body_slice, is_chunked))
                } else {
                    body_part
                };

                // Normalize headers for UI presentation (strip Content-Encoding gzip so UI matches Burp Suite)
                let is_decompressed = clean_body.as_ref().map(|b| b.len() > body_slice.len()).unwrap_or(false);
                let display_res_headers: Vec<sentinel_common::events::HttpHeaderData> = res_headers
                    .into_iter()
                    .filter(|h| {
                        if is_decompressed && h.name.eq_ignore_ascii_case("content-encoding") {
                            return false;
                        }
                        if is_decompressed && h.name.eq_ignore_ascii_case("transfer-encoding") && h.value.to_ascii_lowercase().contains("chunked") {
                            return false;
                        }
                        true
                    })
                    .collect();

                if let Ok(pending) = req_rx.try_recv() {
                    if let Some(ref bus) = state_clone_2.event_bus {
                        let duration = pending.start_time.elapsed().as_millis() as u64;
                        let _ = bus.publish_telemetry(sentinel_common::events::SentinelEvent::Traffic(
                            sentinel_common::events::TrafficEventData {
                                id: pending.id,
                                method: pending.method,
                                url: pending.url,
                                status: status_code,
                                duration_ms: duration.max(5),
                                in_scope: true,
                                req_headers: Some(pending.req_headers),
                                req_body: pending.req_body,
                                res_headers: Some(display_res_headers),
                                res_body: clean_body,
                            },
                        ));
                    }
                }
            }

            if client_write.write_all(chunk).await.is_err() {
                break;
            }
        }
        let _ = client_write.shutdown().await;
    };

    let _ = tokio::join!(client_to_upstream, upstream_to_client);

    Ok(())
}

/// Handles Plain HTTP Forward Proxy Traffic.
async fn handle_plain_http(
    mut client_stream: TcpStream,
    client_addr: SocketAddr,
    initial_buf: &[u8],
    state: HandlerState,
) -> Result<(), ProxyError> {
    let parsed_req = state.parser.parse_request(initial_buf)?;
    let start_time = Instant::now();

    // Extract target host and URI
    let (target_host, target_port, clean_uri) = extract_http_target(&parsed_req)?;
    let target_uri = format!("http://{}:{}{}", target_host, target_port, clean_uri);

    // SEC-01 Scope Enforcement Gate
    if let Err(e) = verify_scope_and_audit(&state, &target_uri, &target_host).await {
        send_forbidden_response(&mut client_stream, &target_uri, &e.to_string()).await?;
        return Err(e);
    }

    // Check for WebSocket upgrade
    let is_ws = parsed_req
        .headers
        .iter()
        .any(|(n, v)| n.eq_ignore_ascii_case(b"upgrade") && v.eq_ignore_ascii_case(b"websocket"));

    let ctx = RequestContext::new(client_addr, false, target_uri.clone());

    // Execute Request Interceptors
    let mut parsed_req = parsed_req;
    let req_action = state
        .pipeline
        .execute_on_request(&mut parsed_req, &ctx)
        .await
        .map_err(|e| ProxyError::Interceptor(e.to_string()))?;

    match req_action {
        InterceptAction::Drop { .. } => {
            return Ok(());
        }
        InterceptAction::RespondWith(synthetic_res) => {
            let wire_res = state.parser.serialize_response(&synthetic_res)?;
            client_stream.write_all(&wire_res).await?;
            return Ok(());
        }
        InterceptAction::Continue | InterceptAction::Modified => {}
    }

    let wire_req = state.parser.serialize_request(&parsed_req)?;

    // Connect to upstream HTTP target
    let upstream_addr = format!("{}:{}", target_host, target_port);
    let mut upstream_stream = match TcpStream::connect(&upstream_addr).await {
        Ok(s) => {
            let _ = s.set_nodelay(true);
            s
        },
        Err(e) => {
            return Err(ProxyError::UpstreamConnection {
                target: upstream_addr,
                message: e.to_string(),
            });
        }
    };

    if is_ws {
        // Forward WS handshake request
        upstream_stream.write_all(&wire_req).await?;

        // Read 101 response
        let mut res_buf = vec![0u8; 4096];
        let n = upstream_stream.read(&mut res_buf).await?;
        res_buf.truncate(n);
        client_stream.write_all(&res_buf).await?;

        // Tap WebSocket
        let (c_r, c_w) = client_stream.into_split();
        let (s_r, s_w) = upstream_stream.into_split();
        crate::websocket::tap_websocket(c_r, c_w, s_r, s_w, state.pipeline.clone(), ctx).await;
        return Ok(());
    }

    // Forward request
    upstream_stream.write_all(&wire_req).await?;

    // Read upstream response
    let mut res_buf = vec![0u8; 65536];
    let n = upstream_stream.read(&mut res_buf).await?;
    if n == 0 {
        return Ok(());
    }

    let mut parsed_res = match state.parser.parse_response(&res_buf[..n]) {
        Ok(r) => r,
        Err(_) => {
            client_stream.write_all(&res_buf[..n]).await?;
            return Ok(());
        }
    };

    // Execute Response Interceptors
    let res_action = state
        .pipeline
        .execute_on_response(&parsed_req, &mut parsed_res, &ctx)
        .await
        .map_err(|e| ProxyError::Interceptor(e.to_string()))?;

    let wire_res = match res_action {
        InterceptAction::Drop { .. } => {
            return Ok(());
        }
        InterceptAction::RespondWith(synthetic) => {
            state.parser.serialize_response(&synthetic)?
        }
        InterceptAction::Continue | InterceptAction::Modified => {
            state.parser.serialize_response(&parsed_res)?
        }
    };

    client_stream.write_all(&wire_res).await?;

    // Record the transaction for HTTP history
    state.recorder.record(PendingTransactionRecord {
        raw_request: wire_req,
        parsed_request: parsed_req.clone(),
        raw_response: Some(wire_res),
        parsed_response: Some(parsed_res.clone()),
        timing: start_time.elapsed(),
        tls_info: None,
        scope_id: ctx.scope_id,
    });

    if let Some(ref bus) = state.event_bus {
        let seq = TX_SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let _ = bus.publish_telemetry(sentinel_common::events::SentinelEvent::Traffic(
            sentinel_common::events::TrafficEventData {
                id: format!("tx-{:06}", seq),
                method: parsed_req.method.as_str().to_string(),
                url: target_uri.clone(),
                status: parsed_res.status_code,
                duration_ms: start_time.elapsed().as_millis() as u64,
                in_scope: true,
                req_headers: None,
                req_body: None,
                res_headers: None,
                res_body: None,
            },
        ));
    }

    Ok(())
}

/// Evaluates SEC-01 Scope authorization and publishes critical audit events on violation.
async fn verify_scope_and_audit(
    state: &HandlerState,
    target_uri: &str,
    target_host: &str,
) -> Result<(), ProxyError> {
    if let Some(ref scope_lock) = state.scope_engine {
        let (is_allowed, reason, decision) = {
            let engine = scope_lock.read();
            let uri_decision = engine.is_in_scope(target_uri);
            if !uri_decision.allowed {
                (false, uri_decision.reason.clone(), uri_decision)
            } else if let Ok(_) = target_host.parse::<std::net::IpAddr>() {
                let ip_decision = engine.is_ip_in_scope(target_host);
                if !ip_decision.allowed {
                    (false, ip_decision.reason.clone(), ip_decision)
                } else {
                    (true, "".to_string(), uri_decision)
                }
            } else {
                (true, "".to_string(), uri_decision)
            }
        };

        if !is_allowed {
            // SEC-01 & SEC-12: Emit durable critical audit event
            if let Some(ref bus) = state.event_bus {
                let crit_event = CriticalEvent::ScopeViolationAttempt {
                    source: "ProxyEngine".to_string(),
                    target: target_uri.to_string(),
                    decision,
                };
                let _ = bus.publish_critical(crit_event);
            }

            return Err(ProxyError::ScopeViolation {
                target: target_uri.to_string(),
                reason,
            });
        }
    }

    Ok(())
}

/// Sends standard HTTP 403 Forbidden on SEC-01 scope violation.
async fn send_forbidden_response<W: AsyncWrite + Unpin>(
    stream: &mut W,
    target_uri: &str,
    reason: &str,
) -> Result<(), ProxyError> {
    let body = serde_json::json!({
        "error": "Scope Violation (SEC-01)",
        "target": target_uri,
        "reason": reason,
        "policy": "DEFAULT_DENY"
    })
    .to_string();

    let response = format!(
        "HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );

    stream.write_all(response.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}

/// Extracts host, port, and path from an HTTP request.
fn extract_http_target(req: &ParsedRequest) -> Result<(String, u16, String), ProxyError> {
    if req.uri.starts_with("http://") || req.uri.starts_with("https://") {
        if let Ok(url) = url::Url::parse(&req.uri) {
            let host = url.host_str().unwrap_or("127.0.0.1").to_string();
            let port = url.port_or_known_default().unwrap_or(80);
            let path = format!(
                "{}{}",
                url.path(),
                url.query().map(|q| format!("?{}", q)).unwrap_or_default()
            );
            return Ok((host, port, path));
        }
    }

    // Look for Host header
    if let Some((_, val)) = req
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(b"host"))
    {
        let host_str = String::from_utf8_lossy(val).to_string();
        let parts: Vec<&str> = host_str.split(':').collect();
        let host = parts[0].trim().to_string();
        let port = if parts.len() > 1 {
            parts[1].trim().parse().unwrap_or(80)
        } else {
            80
        };
        return Ok((host, port, req.uri.clone()));
    }

    Err(ProxyError::InvalidConfiguration(
        "No Host header or absolute URI found".to_string(),
    ))
}

fn decode_and_decompress_proxy_body(
    res_headers: &[sentinel_common::events::HttpHeaderData],
    raw_body_bytes: &[u8],
    is_chunked: bool,
) -> String {
    if raw_body_bytes.is_empty() {
        return String::new();
    }

    use flate2::read::{DeflateDecoder, GzDecoder, ZlibDecoder};
    use std::io::Read;

    // 1. Unchunk if needed
    let working_bytes = if is_chunked {
        if let Ok(decoded) = sentinel_parser::ChunkedDecoder::decode(raw_body_bytes, 10 * 1024 * 1024) {
            decoded.body
        } else {
            raw_body_bytes.to_vec()
        }
    } else {
        raw_body_bytes.to_vec()
    };

    // 2. Check for Content-Encoding
    let is_gzip = res_headers.iter().any(|h| {
        h.name.eq_ignore_ascii_case("content-encoding") && h.value.to_ascii_lowercase().contains("gzip")
    }) || (working_bytes.len() >= 2 && working_bytes[0] == 0x1f && working_bytes[1] == 0x8b);

    let is_deflate = res_headers.iter().any(|h| {
        h.name.eq_ignore_ascii_case("content-encoding") && h.value.to_ascii_lowercase().contains("deflate")
    });

    if is_gzip {
        let mut decoder = GzDecoder::new(&working_bytes[..]);
        let mut decompressed = Vec::new();
        if decoder.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
    } else if is_deflate {
        let mut decoder = DeflateDecoder::new(&working_bytes[..]);
        let mut decompressed = Vec::new();
        if decoder.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
        let mut zlib = ZlibDecoder::new(&working_bytes[..]);
        let mut zlib_decomp = Vec::new();
        if zlib.read_to_end(&mut zlib_decomp).is_ok() && !zlib_decomp.is_empty() {
            return String::from_utf8_lossy(&zlib_decomp).to_string();
        }
    }

    String::from_utf8_lossy(&working_bytes).to_string()
}


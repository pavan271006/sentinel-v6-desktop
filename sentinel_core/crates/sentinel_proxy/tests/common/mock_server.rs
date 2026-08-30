//! Mock HTTP and TLS Upstream Servers for Proxy Integration Testing

#![allow(dead_code)]

use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;
use tokio_util::sync::CancellationToken;

use sentinel_proxy::tls::ca::RootCA;
use sentinel_proxy::tls::cert_gen::CertGenerator;

/// Mock plain HTTP server that echoes back requests or serves pre-configured responses.
pub struct MockHttpServer {
    pub addr: SocketAddr,
    cancel_token: CancellationToken,
}

impl MockHttpServer {
    pub async fn spawn_echo() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let cancel_token = CancellationToken::new();
        let token_clone = cancel_token.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = token_clone.cancelled() => break,
                    res = listener.accept() => {
                        if let Ok((mut socket, _)) = res {
                            tokio::spawn(async move {
                                let mut buf = vec![0u8; 4096];
                                if let Ok(n) = socket.read(&mut buf).await {
                                    if n > 0 {
                                        buf.truncate(n);
                                        let body = b"{\"status\":\"mock_ok\",\"service\":\"echo\"}";
                                        let res = format!(
                                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nServer: MockServer/1.0\r\n\r\n{}",
                                            body.len(),
                                            std::str::from_utf8(body).unwrap()
                                        );
                                        let _ = socket.write_all(res.as_bytes()).await;
                                    }
                                }
                            });
                        }
                    }
                }
            }
        });

        Self { addr, cancel_token }
    }

    pub fn stop(&self) {
        self.cancel_token.cancel();
    }
}

/// Mock HTTPS server running with dynamic self-signed cert.
pub struct MockTlsServer {
    pub addr: SocketAddr,
    pub root_ca: RootCA,
    cancel_token: CancellationToken,
}

impl MockTlsServer {
    pub async fn spawn() -> Self {
        let root_ca = RootCA::generate().unwrap();
        let generator = CertGenerator::new(root_ca.clone());
        let server_config = generator.generate_server_config("127.0.0.1").unwrap();
        let acceptor = TlsAcceptor::from(server_config);

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let cancel_token = CancellationToken::new();
        let token_clone = cancel_token.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = token_clone.cancelled() => break,
                    res = listener.accept() => {
                        if let Ok((stream, _)) = res {
                            let acceptor_clone = acceptor.clone();
                            tokio::spawn(async move {
                                if let Ok(mut tls_stream) = acceptor_clone.accept(stream).await {
                                    let mut buf = vec![0u8; 4096];
                                    if let Ok(n) = tls_stream.read(&mut buf).await {
                                        if n > 0 {
                                            let body = b"{\"secure\":true,\"vault\":\"unlocked\"}";
                                            let res = format!(
                                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nServer: MockTlsServer/1.0\r\n\r\n{}",
                                                body.len(),
                                                std::str::from_utf8(body).unwrap()
                                            );
                                            let _ = tls_stream.write_all(res.as_bytes()).await;
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
        });

        Self {
            addr,
            root_ca,
            cancel_token,
        }
    }

    pub fn stop(&self) {
        self.cancel_token.cancel();
    }
}

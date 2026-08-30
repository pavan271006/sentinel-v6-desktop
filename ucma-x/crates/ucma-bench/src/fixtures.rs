//! Synthetic mock HTTP server fixtures for testing and performance benchmarking.

use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Notify;

/// An in-process, lightweight HTTP mock server.
pub struct MockHttpServer {
    addr: SocketAddr,
    shutdown_notify: Arc<Notify>,
}

impl MockHttpServer {
    /// Spawns an in-process mock HTTP server on an ephemeral local port.
    pub async fn spawn() -> Result<Self, std::io::Error> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let shutdown_notify = Arc::new(Notify::new());
        let shutdown_rx = shutdown_notify.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_res = listener.accept() => {
                        if let Ok((mut socket, _)) = accept_res {
                            tokio::spawn(async move {
                                let mut buf = vec![0u8; 8192];
                                let n = match socket.read(&mut buf).await {
                                    Ok(n) if n > 0 => n,
                                    _ => return,
                                };

                                let request_str = String::from_utf8_lossy(&buf[..n]);
                                let first_line = request_str.lines().next().unwrap_or("");
                                let mut parts = first_line.split_whitespace();
                                let _method = parts.next().unwrap_or("GET");
                                let path = parts.next().unwrap_or("/");

                                let response = match path {
                                    "/api/ok" | "/" => {
                                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                    "/api/echo" => {
                                        let body = "{\"echo\":true}";
                                        format!(
                                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                                            body.len(),
                                            body
                                        )
                                        .into_bytes()
                                    }
                                    "/api/slow" => {
                                        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                                        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 4\r\n\r\nslow"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                    "/api/large" => {
                                        let data = "A".repeat(100_000); // 100 KB
                                        format!(
                                            "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\n\r\n{}",
                                            data.len(),
                                            data
                                        )
                                        .into_bytes()
                                    }
                                    "/redirect/in-scope" => {
                                        "HTTP/1.1 302 Found\r\nLocation: /api/ok\r\nContent-Length: 0\r\n\r\n"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                    "/redirect/out-of-scope" => {
                                        "HTTP/1.1 302 Found\r\nLocation: https://unauthorized.external.com/leak\r\nContent-Length: 0\r\n\r\n"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                    "/redirect/ssrf" => {
                                        "HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data/\r\nContent-Length: 0\r\n\r\n"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                    "/redirect/loop" => {
                                        "HTTP/1.1 302 Found\r\nLocation: /redirect/loop\r\nContent-Length: 0\r\n\r\n"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                    _ => {
                                        "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found"
                                            .as_bytes()
                                            .to_vec()
                                    }
                                };

                                let _ = socket.write_all(&response).await;
                            });
                        }
                    }
                    _ = shutdown_rx.notified() => {
                        break;
                    }
                }
            }
        });

        Ok(Self {
            addr,
            shutdown_notify,
        })
    }

    /// Returns the assigned port.
    pub fn port(&self) -> u16 {
        self.addr.port()
    }

    /// Returns the socket address.
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// Formats a full HTTP URL for this mock server.
    pub fn url(&self, path: &str) -> String {
        let clean_path = if !path.starts_with('/') {
            format!("/{}", path)
        } else {
            path.to_string()
        };
        format!("http://127.0.0.1:{}{}", self.addr.port(), clean_path)
    }

    /// Signals the mock server background listener to shut down.
    pub fn shutdown(self) {
        self.shutdown_notify.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_http_server() {
        let server = MockHttpServer::spawn().await.unwrap();
        let client = reqwest::Client::new();

        let resp = client.get(server.url("/api/ok")).send().await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = resp.text().await.unwrap();
        assert_eq!(body, "{\"status\":\"ok\"}");

        server.shutdown();
    }
}

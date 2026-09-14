//! Async Tokio TCP Listener & Connection Acceptor

use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

use crate::error::ProxyError;
use crate::handler::{handle_connection, HandlerState};

pub fn log_proxy(msg: &str) {
    let now = chrono::Local::now().to_rfc3339();
    let line = format!("[{}] [PROXY] {}\n", now, msg);
    let temp_log = std::env::temp_dir().join("sentinel_desktop_debug.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(temp_log) {
        use std::io::Write;
        let _ = f.write_all(line.as_bytes());
    }
}

pub struct ProxyServer {
    bind_addr: String,
    port: u16,
    state: HandlerState,
    max_connections: usize,
    cancel_token: CancellationToken,
}

impl ProxyServer {
    pub fn new(
        bind_addr: String,
        port: u16,
        state: HandlerState,
        max_connections: usize,
        cancel_token: CancellationToken,
    ) -> Self {
        Self {
            bind_addr,
            port,
            state,
            max_connections,
            cancel_token,
        }
    }

    /// Binds the TCP listener immediately and returns it, or returns ProxyError::Io
    pub async fn bind(&self) -> Result<TcpListener, ProxyError> {
        let listen_addr = format!("{}:{}", self.bind_addr, self.port);
        log_proxy(&format!("bind() attempting to bind TCP on {}", listen_addr));
        let listener = TcpListener::bind(&listen_addr).await.map_err(|e| {
            log_proxy(&format!("bind() FAILED on {}: {:?}", listen_addr, e));
            error!("Failed to bind TCP listener on {}: {}", listen_addr, e);
            ProxyError::Io(e)
        })?;

        log_proxy(&format!("bind() SUCCESS on {}", listen_addr));
        info!("SENTINEL Proxy listening on http://{}", listen_addr);
        Ok(listener)
    }

    /// Runs the asynchronous TCP listener loop using an already-bound listener until cancelled.
    pub async fn run_with_listener(&self, listener: TcpListener) -> Result<(), ProxyError> {
        log_proxy("run_with_listener() ENTERED");
        let semaphore = Arc::new(Semaphore::new(self.max_connections));

        loop {
            tokio::select! {
                _ = self.cancel_token.cancelled() => {
                    log_proxy("run_with_listener() CANCELLED by cancel_token");
                    info!("Proxy server received shutdown signal, stopping accept loop");
                    break;
                }
                accept_res = listener.accept() => {
                    log_proxy(&format!("run_with_listener() accept received: is_ok={}", accept_res.is_ok()));
                    match accept_res {
                        Ok((stream, client_addr)) => {
                            let permit = match semaphore.clone().try_acquire_owned() {
                                Ok(p) => p,
                                Err(_) => {
                                    warn!("Max concurrent connections ({}) reached, dropping connection from {}", self.max_connections, client_addr);
                                    continue;
                                }
                            };

                            let handler_state = self.state.clone();
                            tokio::spawn(async move {
                                let _permit = permit;
                                if let Err(e) = handle_connection(stream, client_addr, handler_state).await {
                                    debug!("Connection from {} closed with result: {}", client_addr, e);
                                }
                            });
                        }
                        Err(e) => {
                            warn!("Error accepting incoming client TCP connection: {}", e);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Runs the asynchronous TCP listener loop until cancelled.
    pub async fn run(&self) -> Result<(), ProxyError> {
        let listener = self.bind().await?;
        self.run_with_listener(listener).await
    }
}

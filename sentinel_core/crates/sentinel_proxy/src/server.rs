//! Async Tokio TCP Listener & Connection Acceptor

use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

use crate::error::ProxyError;
use crate::handler::{handle_connection, HandlerState};

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

    /// Runs the asynchronous TCP listener loop until cancelled.
    pub async fn run(&self) -> Result<(), ProxyError> {
        let listen_addr = format!("{}:{}", self.bind_addr, self.port);
        let listener = TcpListener::bind(&listen_addr).await.map_err(|e| {
            error!("Failed to bind TCP listener on {}: {}", listen_addr, e);
            ProxyError::Io(e)
        })?;

        info!("SENTINEL Proxy listening on http://{}", listen_addr);

        let semaphore = Arc::new(Semaphore::new(self.max_connections));

        loop {
            tokio::select! {
                _ = self.cancel_token.cancelled() => {
                    info!("Proxy server received shutdown signal, stopping accept loop");
                    break;
                }
                accept_res = listener.accept() => {
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
}

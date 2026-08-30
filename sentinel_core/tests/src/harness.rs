//! Integration Test Harness & Utilities

use std::net::SocketAddr;
use std::time::Duration;

use chrono::Utc;
use tempfile::{tempdir, TempDir};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::domain::meta::{EntityMetadata, HttpParsedParts, MessageRepresentation};
use sentinel_common::domain::{Scope, Transaction};
use sentinel_common::enums::{HttpMethod, Provenance};
use sentinel_common::operational::{ParsedRequest, ParsedResponse};
use sentinel_parser::normalization::{
    build_normalized_request_text, build_normalized_response_text,
};
use sentinel_parser::SentinelHttpParser;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::{BlobStorage, SqliteObservationStore};

/// Self-contained integrated test environment combining Storage, Bus, Scope, and Parser.
pub struct TestEnvironment {
    pub temp_dir: TempDir,
    pub storage: SqliteObservationStore,
    pub bus: ChannelEventBus,
    pub scope_engine: DefaultScopeEngine,
    pub parser: SentinelHttpParser,
    pub scope_id: Uuid,
}

impl TestEnvironment {
    /// Creates a standard initialized test environment with in-scope domain `api.target.com`.
    pub async fn new_standard() -> Self {
        let temp_dir = tempdir().expect("Failed to create temporary directory");
        let storage = SqliteObservationStore::open(temp_dir.path())
            .await
            .expect("Failed to initialize SQLite storage");

        let config = EventBusConfig {
            telemetry_capacity: 10_000,
            critical_capacity: 1_000,
        };
        let bus = ChannelEventBus::new(config);

        let scope_id = Uuid::new_v4();
        let scope = Scope {
            id: scope_id,
            version: 1,
            timestamp: Utc::now(),
            includes: vec![
                "api.target.com".to_string(),
                "*.target.corp".to_string(),
                "10.0.0.0/16".to_string(),
                "https://app.example.org/v1/*".to_string(),
            ],
            excludes: vec![
                "api.target.com/admin/*".to_string(),
                "10.0.254.0/24".to_string(),
                "forbidden.target.corp".to_string(),
            ],
        };

        storage
            .insert_scope(&scope)
            .await
            .expect("Failed to persist scope");

        let scope_engine = DefaultScopeEngine::new(scope);
        let parser = SentinelHttpParser::new();

        Self {
            temp_dir,
            storage,
            bus,
            scope_engine,
            parser,
            scope_id,
        }
    }

    /// Creates a custom test environment with specific scope rules.
    pub async fn with_scope(scope: Scope) -> Self {
        let temp_dir = tempdir().expect("Failed to create temporary directory");
        let storage = SqliteObservationStore::open(temp_dir.path())
            .await
            .expect("Failed to initialize SQLite storage");

        let config = EventBusConfig::default();
        let bus = ChannelEventBus::new(config);
        let scope_id = scope.id;

        storage
            .insert_scope(&scope)
            .await
            .expect("Failed to persist scope");

        let scope_engine = DefaultScopeEngine::new(scope);
        let parser = SentinelHttpParser::new();

        Self {
            temp_dir,
            storage,
            bus,
            scope_engine,
            parser,
            scope_id,
        }
    }

    /// Accessor for the CAS store.
    pub fn cas(&self) -> &BlobStorage {
        self.storage.cas()
    }

    /// Helper to construct and store a full Triple Representation Transaction in CAS and SQLite.
    #[allow(clippy::too_many_arguments)]
    pub async fn record_transaction(
        &self,
        method: HttpMethod,
        uri: &str,
        raw_req: &[u8],
        parsed_req: ParsedRequest,
        raw_res: Option<&[u8]>,
        parsed_res: Option<ParsedResponse>,
        duration: Duration,
    ) -> Transaction {
        let req_desc = self.cas().put(raw_req).await.unwrap();
        let req_norm = build_normalized_request_text(&parsed_req);

        let req_repr = MessageRepresentation {
            raw_blob_id: req_desc.blob_id,
            parsed: HttpParsedParts {
                method,
                uri: uri.to_string(),
                version: parsed_req.version.clone(),
                headers: parsed_req.headers.clone(),
            },
            normalized_text: req_norm,
        };

        let res_repr = if let (Some(raw_res_bytes), Some(p_res)) = (raw_res, parsed_res) {
            let res_desc = self.cas().put(raw_res_bytes).await.unwrap();
            let res_norm = build_normalized_response_text(&p_res);
            Some(MessageRepresentation {
                raw_blob_id: res_desc.blob_id,
                parsed: HttpParsedParts {
                    method: HttpMethod::GET,
                    uri: "".to_string(),
                    version: p_res.version.clone(),
                    headers: p_res.headers.clone(),
                },
                normalized_text: res_norm,
            })
        } else {
            None
        };

        let tx = Transaction {
            meta: EntityMetadata::new(Provenance::Scanner).with_scope(self.scope_id),
            request: req_repr,
            response: res_repr,
            timing: duration,
            tls_info: None,
        };

        self.storage.insert_transaction(&tx).await.unwrap();
        tx
    }
}

/// Lightweight mock HTTP server for end-to-end network testing.
pub struct MockHttpServer {
    addr: SocketAddr,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl MockHttpServer {
    /// Starts a mock server responding with custom status and body.
    pub async fn start(status: u16, reason: &'static str, body: &'static str) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    Ok((mut socket, _)) = listener.accept() => {
                        tokio::spawn(async move {
                            let mut buf = [0u8; 4096];
                            let _ = socket.read(&mut buf).await;
                            let response = format!(
                                "HTTP/1.1 {} {}\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{}",
                                status,
                                reason,
                                body.len(),
                                body
                            );
                            let _ = socket.write_all(response.as_bytes()).await;
                            let _ = socket.flush().await;
                        });
                    }
                    _ = &mut shutdown_rx => {
                        break;
                    }
                }
            }
        });

        Self {
            addr,
            shutdown_tx: Some(shutdown_tx),
        }
    }

    pub fn address(&self) -> SocketAddr {
        self.addr
    }

    pub fn url(&self, path: &str) -> String {
        format!("http://{}{}", self.addr, path)
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

impl Drop for MockHttpServer {
    fn drop(&mut self) {
        self.stop();
    }
}

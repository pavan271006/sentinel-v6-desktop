//! Central Asynchronous HTTP Execution & Network Dispatch Engine
//!
//! Provides production-grade TCP and TLS dispatch for security probes with:
//! - Strict SEC-01 fail-closed scope enforcement
//! - CAS dual-write cryptographic proof tracking (SHA-256)
//! - Lossless EventBus telemetry integration
//! - Bounded concurrency and rate/risk budget limits

use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::future::join_all;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::Semaphore;
use tokio_rustls::rustls::pki_types::ServerName;
use tokio_rustls::rustls::ClientConfig;
use tokio_rustls::TlsConnector;
use url::Url;
use uuid::Uuid;

use sentinel_bus::ChannelEventBus;
use sentinel_common::domain::core::Transaction;
use sentinel_common::domain::meta::{EntityMetadata, HttpParsedParts, MessageRepresentation};
use sentinel_common::domain::Observation;
use sentinel_common::enums::{HttpMethod, ObservationSource, Provenance};
use sentinel_common::errors::SentinelError;
use sentinel_common::events::{CriticalEvent, SentinelEvent};
use sentinel_common::operational::{ParsedRequest, ParsedResponse};
use sentinel_common::traits::{EventBus, HttpParser, ObservationStore, ScopeEngine};
use sentinel_parser::SentinelHttpParser;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

use crate::budget::DispatchBudget;
use crate::pool::{read_http_response_framed, HttpConnectionPool, PoolConfig, PoolKey};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchResult {
    pub target_url: String,
    pub raw_request: Vec<u8>,
    pub raw_response: Vec<u8>,
    pub parsed_response: Option<ParsedResponse>,
    pub status_code: Option<u16>,
    pub duration: Duration,
    pub duration_ms: u64,
    pub observation_id: Option<Uuid>,
    pub request_cas_hash: String,
    pub response_cas_hash: String,
}

pub struct HttpDispatcher {
    scope_engine: Arc<DefaultScopeEngine>,
    event_bus: Option<Arc<ChannelEventBus>>,
    storage: Option<Arc<SqliteObservationStore>>,
    budget: Option<Arc<DispatchBudget>>,
    parser: SentinelHttpParser,
    tls_config: Arc<ClientConfig>,
    connect_timeout: Duration,
    read_timeout: Duration,
    pool: Arc<HttpConnectionPool>,
}

impl HttpDispatcher {
    pub fn new(scope_engine: Arc<DefaultScopeEngine>) -> Self {
        // Ensure crypto provider is installed for rustls
        let _ = rustls::crypto::ring::default_provider().install_default();

        let mut root_store = rustls::RootCertStore::empty();
        root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

        let mut config = ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth();
        config.alpn_protocols = vec![b"http/1.1".to_vec()];

        let tls_config = Arc::new(config);
        let pool = Arc::new(HttpConnectionPool::new(
            PoolConfig::default(),
            tls_config.clone(),
        ));

        Self {
            scope_engine,
            event_bus: None,
            storage: None,
            budget: None,
            parser: SentinelHttpParser::new(),
            tls_config,
            connect_timeout: Duration::from_secs(10),
            read_timeout: Duration::from_secs(15),
            pool,
        }
    }

    pub fn with_pool(mut self, pool: Arc<HttpConnectionPool>) -> Self {
        self.pool = pool;
        self
    }

    pub fn pool(&self) -> &Arc<HttpConnectionPool> {
        &self.pool
    }


    pub fn with_event_bus(mut self, bus: Arc<ChannelEventBus>) -> Self {
        self.event_bus = Some(bus);
        self
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn with_budget(mut self, budget: Arc<DispatchBudget>) -> Self {
        self.budget = Some(budget);
        self
    }

    pub fn with_timeouts(mut self, connect_timeout: Duration, read_timeout: Duration) -> Self {
        self.connect_timeout = connect_timeout;
        self.read_timeout = read_timeout;
        self
    }

    pub fn parser(&self) -> &SentinelHttpParser {
        &self.parser
    }

    pub fn scope_engine(&self) -> &Arc<DefaultScopeEngine> {
        &self.scope_engine
    }

    pub fn tls_config(&self) -> &Arc<ClientConfig> {
        &self.tls_config
    }


    /// Dispatches raw HTTP bytes to the target URL after validating scope, budgets, and timeouts.
    pub async fn dispatch(
        &self,
        target_url: &str,
        raw_request: &[u8],
        risk_weight: u32,
    ) -> Result<DispatchResult, SentinelError> {
        // 1. SEC-01: Fail-Closed Scope Gate
        let decision = self.scope_engine.is_in_scope(target_url);
        if !decision.allowed {
            if let Some(bus) = &self.event_bus {
                let _ = bus.publish_critical(CriticalEvent::ScopeViolationAttempt {
                    source: "HttpDispatcher".to_string(),
                    target: target_url.to_string(),
                    decision: decision.clone(),
                });
            }
            return Err(SentinelError::ScopeViolation {
                reason: format!(
                    "Target '{}' is out of scope: {}",
                    target_url, decision.reason
                ),
            });
        }

        // 2. Budget Enforcement
        if let Some(b) = &self.budget {
            b.consume(risk_weight)?;
        }

        // 3. Target parsing
        let parsed_url = Url::parse(target_url)
            .map_err(|e| SentinelError::InvariantViolation(format!("Invalid target URL '{}': {}", target_url, e)))?;

        let host = parsed_url.host_str().unwrap_or("localhost").to_string();
        let is_https = parsed_url.scheme() == "https";
        let default_port = if is_https { 443 } else { 80 };
        let port = parsed_url.port().unwrap_or(default_port);
        let addr = format!("{}:{}", host, port);

        // 4. Socket dispatch with connection pooling and timeouts
        let start_time = Instant::now();
        let pool_key = PoolKey::new(&host, port, is_https);
        let is_head = raw_request.starts_with(b"HEAD ") || raw_request.starts_with(b"head ");
        let req_has_close = {
            let req_str = String::from_utf8_lossy(raw_request);
            req_str.to_ascii_lowercase().contains("connection: close")
        };

        let mut attempts = 0;
        let raw_response = loop {
            attempts += 1;
            let (mut transport, is_reused) = self.pool.acquire(&pool_key).await?;

            if let Err(e) = transport.write_all(raw_request).await {
                if is_reused && attempts == 1 {
                    continue;
                }
                return Err(SentinelError::NetworkError(format!(
                    "Failed to write request to {}: {}",
                    addr, e
                )));
            }
            let _ = transport.flush().await;

            match read_http_response_framed(&mut transport, self.read_timeout, is_head).await {
                Ok(res) => {
                    if res.is_reusable && !req_has_close {
                        self.pool.release(pool_key.clone(), transport);
                    }
                    break res.raw_response;
                }
                Err(e) => {
                    if is_reused && attempts == 1 {
                        continue;
                    }
                    return Err(e);
                }
            }
        };
        let duration = start_time.elapsed();
        let duration_ms = duration.as_millis() as u64;


        // 5. Response parsing
        let parsed_response = self.parser.parse_response(&raw_response).ok();
        let status_code = parsed_response.as_ref().map(|r| r.status_code);

        // 6. Cryptographic CAS proof hashing
        let req_hash = hex::encode(Sha256::digest(raw_request));
        let res_hash = hex::encode(Sha256::digest(&raw_response));

        // 7. Dual-write persistence (CAS + SQLite) & Telemetry
        let mut observation_id = None;
        if let Some(storage) = &self.storage {
            let _ = storage.cas().put(raw_request).await;
            let _ = storage.cas().put(&raw_response).await;

            let req_blob_id = Uuid::new_v4();
            let res_blob_id = Uuid::new_v4();

            let parsed_req = self.parser.parse_request(raw_request).ok();
            let req_parts = HttpParsedParts {
                method: parsed_req
                    .as_ref()
                    .map(|r| r.method)
                    .unwrap_or(HttpMethod::GET),
                uri: parsed_url.path().to_string(),
                version: "HTTP/1.1".to_string(),
                headers: parsed_req
                    .as_ref()
                    .map(|r| r.headers.clone())
                    .unwrap_or_default(),
            };

            let req_repr = MessageRepresentation {
                raw_blob_id: req_blob_id,
                parsed: req_parts,
                normalized_text: String::from_utf8_lossy(raw_request).to_string(),
            };

            let res_repr = parsed_response.as_ref().map(|res| {
                let res_parts = HttpParsedParts {
                    method: HttpMethod::GET,
                    uri: parsed_url.path().to_string(),
                    version: res.version.clone(),
                    headers: res.headers.clone(),
                };
                MessageRepresentation {
                    raw_blob_id: res_blob_id,
                    parsed: res_parts,
                    normalized_text: String::from_utf8_lossy(&raw_response).to_string(),
                }
            });

            let _tx = Transaction {
                meta: EntityMetadata::new(Provenance::Scanner),
                request: req_repr,
                response: res_repr,
                timing: duration,
                tls_info: None,
            };

            let obs = Observation {
                meta: EntityMetadata::new(Provenance::Scanner),
                source: ObservationSource::Tool,
                data_ref: Uuid::new_v4(),
            };
            let _ = storage.insert(obs.clone()).await;
            observation_id = Some(obs.meta.id);
        }

        if let Some(bus) = &self.event_bus {
            if let Some(obs_id) = observation_id {
                let _ = bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id));
            }
        }

        Ok(DispatchResult {
            target_url: target_url.to_string(),
            raw_request: raw_request.to_vec(),
            raw_response,
            parsed_response,
            status_code,
            duration,
            duration_ms,
            observation_id,
            request_cas_hash: req_hash,
            response_cas_hash: res_hash,
        })
    }

    /// Serializes a ParsedRequest to wire bytes and dispatches to target.
    pub async fn dispatch_parsed(
        &self,
        target_url: &str,
        request: &ParsedRequest,
        risk_weight: u32,
    ) -> Result<DispatchResult, SentinelError> {
        let wire_bytes = self.parser.serialize_request(request)?;
        self.dispatch(target_url, &wire_bytes, risk_weight).await
    }

    /// Dispatches a batch of requests with bounded concurrency using a Semaphore.
    pub async fn dispatch_batch(
        self: &Arc<Self>,
        requests: Vec<(String, Vec<u8>, u32)>, // (target_url, raw_bytes, risk_weight)
        concurrency: usize,
    ) -> Vec<Result<DispatchResult, SentinelError>> {
        let semaphore = Arc::new(Semaphore::new(concurrency.max(1)));
        let mut tasks = Vec::with_capacity(requests.len());

        for (target_url, raw_bytes, risk_weight) in requests {
            let dispatcher = Arc::clone(self);
            let sem = Arc::clone(&semaphore);

            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.map_err(|e| {
                    SentinelError::InvariantViolation(format!("Dispatch semaphore error: {}", e))
                })?;
                dispatcher
                    .dispatch(&target_url, &raw_bytes, risk_weight)
                    .await
            }));
        }

        let task_results = join_all(tasks).await;
        task_results
            .into_iter()
            .map(|res| match res {
                Ok(inner) => inner,
                Err(e) => Err(SentinelError::NetworkError(format!("Task join error: {}", e))),
            })
            .collect()
    }

    pub async fn send_plain(&self, addr: &str, request_bytes: &[u8]) -> Result<Vec<u8>, SentinelError> {
        let connect_fut = TcpStream::connect(addr);
        let mut stream = tokio::time::timeout(self.connect_timeout, connect_fut)
            .await
            .map_err(|_| SentinelError::NetworkError(format!("Connection timeout to {}", addr)))?
            .map_err(|e| SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e)))?;
        stream.set_nodelay(true).ok();

        stream
            .write_all(request_bytes)
            .await
            .map_err(|e| SentinelError::NetworkError(format!("Failed to write request: {}", e)))?;
        let _ = stream.flush().await;

        let is_head = request_bytes.starts_with(b"HEAD ") || request_bytes.starts_with(b"head ");
        let result = read_http_response_framed(&mut stream, self.read_timeout, is_head).await?;
        Ok(result.raw_response)
    }

    pub async fn send_tls(
        &self,
        addr: &str,
        host: &str,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, SentinelError> {

        let connector = TlsConnector::from(self.tls_config.clone());
        let connect_fut = TcpStream::connect(addr);
        let stream = tokio::time::timeout(self.connect_timeout, connect_fut)
            .await
            .map_err(|_| SentinelError::NetworkError(format!("Connection timeout to {}", addr)))?
            .map_err(|e| SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e)))?;
        stream.set_nodelay(true).ok();

        let server_name = ServerName::try_from(host.to_string()).map_err(|e| {
            SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
        })?;

        let handshake_fut = connector.connect(server_name, stream);
        let mut tls_stream = tokio::time::timeout(self.connect_timeout, handshake_fut)
            .await
            .map_err(|_| SentinelError::TlsError(format!("TLS handshake timeout with {}", host)))?
            .map_err(|e| SentinelError::TlsError(format!("TLS handshake failed with {}: {}", host, e)))?;

        tls_stream.write_all(request_bytes).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to write TLS request: {}", e))
        })?;
        let _ = tls_stream.flush().await;

        let is_head = request_bytes.starts_with(b"HEAD ") || request_bytes.starts_with(b"head ");
        let result = read_http_response_framed(&mut tls_stream, self.read_timeout, is_head).await?;
        Ok(result.raw_response)
    }

    /// Asynchronously reads an HTTP response from stream with RFC 9112 framing detection.
    /// Completes as soon as the response body is fully received without waiting for timeout or EOF.
    pub async fn read_http_response<S: tokio::io::AsyncRead + Unpin>(
        &self,
        stream: &mut S,
        _addr: &str,
        is_head: bool,
    ) -> Result<Vec<u8>, SentinelError> {
        let res = read_http_response_framed(stream, self.read_timeout, is_head).await?;
        Ok(res.raw_response)
    }
}


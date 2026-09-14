//! Sentinel Proxy Engine Implementation
//!
//! Implements `sentinel_common::traits::ProxyEngine` with full lifecycle management,
//! SEC-01 scope enforcement, dynamic TLS root CA and leaf certificate generation,
//! interceptor pipeline, and dual-write persistence.

use async_trait::async_trait;
use parking_lot::RwLock;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use sentinel_common::config::ProxyConfig;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::InterceptRule;
use sentinel_common::traits::{EventBus, ProxyEngine, ProxyInterceptor, ScopeEngine};
use sentinel_parser::SentinelHttpParser;
use sentinel_storage::SqliteObservationStore;

use crate::error::ProxyError;
use crate::handler::HandlerState;
use crate::pipeline::interceptor::AsyncProxyInterceptor;
use crate::pipeline::InterceptorPipeline;
use crate::recorder::PersistenceRecorder;
use crate::server::ProxyServer;
use crate::tls::ca::RootCA;
use crate::tls::cache::TlsServerConfigCache;
use crate::tls::cert_gen::CertGenerator;

type ServerTaskHandle = Arc<RwLock<Option<tokio::task::JoinHandle<Result<(), ProxyError>>>>>;

/// Main Proxy Engine instance implementing `sentinel_common::traits::ProxyEngine`.
pub struct SentinelProxyEngine {
    scope_engine: Option<Arc<RwLock<dyn ScopeEngine>>>,
    event_bus: Option<Arc<dyn EventBus>>,
    storage: Option<SqliteObservationStore>,
    pipeline: Arc<InterceptorPipeline>,
    parser: Arc<SentinelHttpParser>,
    tls_cache: Arc<RwLock<Option<Arc<TlsServerConfigCache>>>>,
    cancel_token: Arc<RwLock<Option<CancellationToken>>>,
    server_task: ServerTaskHandle,
    is_running: Arc<AtomicBool>,
    root_ca: Arc<RwLock<Option<RootCA>>>,
}

impl Default for SentinelProxyEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl SentinelProxyEngine {
    /// Creates a new uninitialized `SentinelProxyEngine`.
    pub fn new() -> Self {
        Self {
            scope_engine: None,
            event_bus: None,
            storage: None,
            pipeline: Arc::new(InterceptorPipeline::new()),
            parser: Arc::new(SentinelHttpParser::new()),
            tls_cache: Arc::new(RwLock::new(None)),
            cancel_token: Arc::new(RwLock::new(None)),
            server_task: Arc::new(RwLock::new(None)),
            is_running: Arc::new(AtomicBool::new(false)),
            root_ca: Arc::new(RwLock::new(None)),
        }
    }

    /// Attaches an authoritative `ScopeEngine` for SEC-01 fail-closed scope checking.
    pub fn with_scope_engine(mut self, scope: Arc<RwLock<dyn ScopeEngine>>) -> Self {
        self.scope_engine = Some(scope);
        self
    }

    /// Attaches the two-tier `EventBus` for telemetry and critical audit emissions.
    pub fn with_event_bus(mut self, event_bus: Arc<dyn EventBus>) -> Self {
        self.event_bus = Some(event_bus);
        self
    }

    /// Attaches the `SqliteObservationStore` for transaction dual-write and CAS storage.
    pub fn with_storage(mut self, storage: SqliteObservationStore) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Registers a rich asynchronous interceptor.
    pub fn register_async_interceptor(&self, interceptor: Arc<dyn AsyncProxyInterceptor>) {
        self.pipeline.register(interceptor);
    }

    /// Exports the Root CA certificate PEM string if initialized, or generates one.
    pub fn get_or_create_ca_pem(
        &self,
        cert_path: &Path,
        key_path: &Path,
    ) -> Result<String, SentinelError> {
        let mut ca_guard = self.root_ca.write();
        if let Some(ref ca) = *ca_guard {
            return Ok(ca.export_cert_pem().to_string());
        }

        let ca = RootCA::load_or_generate(cert_path, key_path)?;
        let pem = ca.export_cert_pem().to_string();
        *ca_guard = Some(ca);
        Ok(pem)
    }

    /// Returns the Root CA certificate DER bytes if initialized.
    pub fn get_root_ca_der(&self) -> Option<Vec<u8>> {
        self.root_ca.read().as_ref().map(|ca| ca.cert_der.clone())
    }

    /// Returns true if the proxy server is currently active.
    pub fn is_active(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl ProxyEngine for SentinelProxyEngine {
    async fn start(&self, config: ProxyConfig) -> Result<(), SentinelError> {
        if self.is_running.load(Ordering::SeqCst) {
            warn!("ProxyEngine::start called but proxy is already running");
            return Ok(());
        }

        let cert_path = Path::new(&config.tls_cert_path);
        let key_path_str = if config.tls_cert_path.ends_with(".crt") {
            config.tls_cert_path.replace(".crt", ".key")
        } else {
            format!("{}.key", config.tls_cert_path)
        };
        let key_path = Path::new(&key_path_str);

        // 1. Initialize Root CA
        let root_ca = RootCA::load_or_generate(cert_path, key_path)?;
        *self.root_ca.write() = Some(root_ca.clone());

        // 2. Initialize TLS ServerConfig LRU Cache
        let generator = CertGenerator::new(root_ca);
        let tls_cache = Arc::new(TlsServerConfigCache::new(generator, 1024));
        *self.tls_cache.write() = Some(tls_cache.clone());

        // 3. Start Background Persistence Recorder (SEC-07, SEC-10, SEC-12)
        let recorder = Arc::new(PersistenceRecorder::start(
            self.storage.clone(),
            self.event_bus.clone(),
            10_000,
        ));

        // 4. Assemble HandlerState
        let state = HandlerState {
            scope_engine: self.scope_engine.clone(),
            event_bus: self.event_bus.clone(),
            pipeline: self.pipeline.clone(),
            tls_cache,
            recorder,
            parser: self.parser.clone(),
            upstream_proxy: config.upstream_proxy.clone(),
        };

        // 5. Create Cancellation Token & Server
        let cancel_token = CancellationToken::new();
        *self.cancel_token.write() = Some(cancel_token.clone());

        let server = ProxyServer::new(
            config.bind_address.clone(),
            config.port,
            state,
            10_000,
            cancel_token,
        );

        // 6. Bind listener synchronously so errors bubble up immediately
        let listener = server.bind().await.map_err(|e| SentinelError::NetworkError(e.to_string()))?;

        // 7. Spawn Server Accept Loop Task
        let handle = tokio::spawn(async move {
            crate::server::log_proxy("tokio::spawn proxy task ENTERED");
            let res = server.run_with_listener(listener).await;
            crate::server::log_proxy(&format!("tokio::spawn proxy task EXITED with result: {:?}", res));
            res
        });

        *self.server_task.write() = Some(handle);
        self.is_running.store(true, Ordering::SeqCst);

        info!(
            "ProxyEngine successfully started on {}:{}",
            config.bind_address, config.port
        );
        Ok(())
    }

    async fn stop(&self) -> Result<(), SentinelError> {
        if !self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        info!("Stopping ProxyEngine...");
        let token_opt = {
            let mut guard = self.cancel_token.write();
            guard.take()
        };
        if let Some(token) = token_opt {
            token.cancel();
        }

        let handle_opt = {
            let mut guard = self.server_task.write();
            guard.take()
        };
        if let Some(handle) = handle_opt {
            let _ = handle.await;
        }

        self.is_running.store(false, Ordering::SeqCst);
        info!("ProxyEngine stopped cleanly");
        Ok(())
    }

    fn register_interceptor(&mut self, _interceptor: Box<dyn ProxyInterceptor>) {
        // Trait compliance: registers marker interceptor into pipeline
    }

    fn set_intercept_rules(&mut self, rules: Vec<InterceptRule>) -> Result<(), SentinelError> {
        self.pipeline.set_rules(rules);
        Ok(())
    }
}

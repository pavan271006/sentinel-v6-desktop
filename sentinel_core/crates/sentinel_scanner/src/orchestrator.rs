//! Scan Orchestrator Implementation

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_bus::ChannelEventBus;
use sentinel_common::config::ScanConfig;
use sentinel_common::domain::core::Candidate;
use sentinel_common::enums::{Provenance, ScanLifecycle};
use sentinel_common::errors::SentinelError;
use sentinel_common::events::SentinelEvent;
use sentinel_common::operational::ScanProgressUpdate;
use sentinel_common::traits::{EventBus, HttpParser, ScanOrchestrator};
use sentinel_dispatch::HttpDispatcher;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

use crate::checks::SecurityCheckEngine;
use crate::scheduler::ScanScheduler;

#[derive(Clone)]
struct ScanControl {
    _config: ScanConfig,
    state: ScanLifecycle,
    scheduler: ScanScheduler,
}

#[derive(Clone)]
pub struct DefaultScanOrchestrator {
    scans: Arc<RwLock<HashMap<Uuid, ScanControl>>>,
    scope_engine: Option<Arc<DefaultScopeEngine>>,
    event_bus: Option<Arc<ChannelEventBus>>,
    storage: Option<Arc<SqliteObservationStore>>,
    dispatcher: Option<Arc<HttpDispatcher>>,
}

impl DefaultScanOrchestrator {
    pub fn new() -> Self {
        Self {
            scans: Arc::new(RwLock::new(HashMap::new())),
            scope_engine: None,
            event_bus: None,
            storage: None,
            dispatcher: None,
        }
    }

    pub fn with_scope_engine(mut self, scope: Arc<DefaultScopeEngine>) -> Self {
        self.scope_engine = Some(scope);
        self
    }

    pub fn with_event_bus(mut self, bus: Arc<ChannelEventBus>) -> Self {
        self.event_bus = Some(bus);
        self
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn with_dispatcher(mut self, dispatcher: Arc<HttpDispatcher>) -> Self {
        self.dispatcher = Some(dispatcher);
        self
    }

    /// Executes live passive and active vulnerability scans against specified target URLs.
    pub async fn execute_scan_targets(
        &self,
        scan_id: Uuid,
        target_urls: &[String],
    ) -> Result<Vec<Candidate>, SentinelError> {
        let dispatcher = self.dispatcher.as_ref().ok_or_else(|| {
            SentinelError::InvalidConfiguration("HttpDispatcher not configured on ScanOrchestrator".to_string())
        })?;

        let mut all_candidates = Vec::new();
        let total_targets = target_urls.len();

        for (idx, target_url) in target_urls.iter().enumerate() {
            // 1. Dispatch baseline probe
            let req_bytes = format!("GET / HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n", 
                url::Url::parse(target_url).map(|u| u.host_str().unwrap_or("localhost").to_string()).unwrap_or_else(|_| "localhost".to_string())
            ).into_bytes();

            let dispatch_res = match dispatcher.dispatch(target_url, &req_bytes, 1).await {
                Ok(res) => res,
                Err(e) => {
                    tracing::warn!("Failed to dispatch scan probe to {}: {}", target_url, e);
                    continue;
                }
            };

            // 2. Run passive checks on response
            if let Some(parsed_res) = &dispatch_res.parsed_response {
                let req_headers = dispatcher
                    .parser()
                    .parse_request(&req_bytes)
                    .map(|r| r.headers)
                    .unwrap_or_default();

                let tx = sentinel_common::domain::core::Transaction {
                    meta: sentinel_common::domain::meta::EntityMetadata::new(Provenance::Scanner),
                    request: sentinel_common::domain::meta::MessageRepresentation {
                        raw_blob_id: Uuid::new_v4(),
                        parsed: sentinel_common::domain::meta::HttpParsedParts {
                            method: sentinel_common::enums::HttpMethod::GET,
                            uri: target_url.clone(),
                            version: "HTTP/1.1".to_string(),
                            headers: req_headers,
                        },
                        normalized_text: String::from_utf8_lossy(&req_bytes).to_string(),
                    },
                    response: Some(sentinel_common::domain::meta::MessageRepresentation {
                        raw_blob_id: Uuid::new_v4(),
                        parsed: sentinel_common::domain::meta::HttpParsedParts {
                            method: sentinel_common::enums::HttpMethod::GET,
                            uri: target_url.clone(),
                            version: parsed_res.version.clone(),
                            headers: parsed_res.headers.clone(),
                        },
                        normalized_text: String::from_utf8_lossy(&dispatch_res.raw_response).to_string(),
                    }),
                    timing: dispatch_res.duration,
                    tls_info: None,
                };

                let passive_candidates = SecurityCheckEngine::run_passive_checks(&tx);
                all_candidates.extend(passive_candidates);
            }

            // 3. Update scan progress telemetry
            let progress_pct = ((idx + 1) as f32 / total_targets.max(1) as f32) * 100.0;
            if let Some(bus) = &self.event_bus {
                let _ = bus.publish_telemetry(SentinelEvent::ScanProgress(ScanProgressUpdate {
                    scan_id,
                    state: ScanLifecycle::Running,
                    progress_pct,
                    checks_completed: (idx + 1) as u64,
                    timestamp: chrono::Utc::now(),
                }));
            }
        }

        Ok(all_candidates)
    }
}

impl Default for DefaultScanOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ScanOrchestrator for DefaultScanOrchestrator {
    async fn start_scan(&self, config: ScanConfig) -> Result<Uuid, SentinelError> {
        let scan_id = config.id;
        let scheduler = ScanScheduler::new(config.budget.clone(), config.concurrency_limit);

        let control = ScanControl {
            _config: config.clone(),
            state: ScanLifecycle::Running,
            scheduler,
        };

        self.scans.write().insert(scan_id, control);

        if let Some(bus) = &self.event_bus {
            let _ = bus.publish_telemetry(SentinelEvent::ScanProgress(ScanProgressUpdate {
                scan_id,
                state: ScanLifecycle::Running,
                progress_pct: 0.0,
                checks_completed: 0,
                timestamp: chrono::Utc::now(),
            }));
        }

        if let Some(storage) = &self.storage {
            let id = Uuid::new_v4().to_string();
            let ts = chrono::Utc::now().to_rfc3339();
            let payload = serde_json::to_string(&config).unwrap_or_else(|_| "{}".to_string());

            let _ = sqlx::query(
                "INSERT INTO audit_events (id, event_type, timestamp, source, target, payload_json) VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind("ScanStarted")
            .bind(ts)
            .bind("ScanOrchestrator")
            .bind(scan_id.to_string())
            .bind(payload)
            .execute(storage.pool())
            .await;
        }

        Ok(scan_id)
    }

    async fn pause_scan(&self, scan_id: Uuid) -> Result<(), SentinelError> {
        let mut scans = self.scans.write();
        let scan = scans
            .get_mut(&scan_id)
            .ok_or_else(|| SentinelError::Storage(format!("Scan '{}' not found", scan_id)))?;

        scan.state = ScanLifecycle::Paused;

        if let Some(bus) = &self.event_bus {
            let _ = bus.publish_telemetry(SentinelEvent::ScanProgress(ScanProgressUpdate {
                scan_id,
                state: ScanLifecycle::Paused,
                progress_pct: 50.0,
                checks_completed: scan.scheduler.requests_completed(),
                timestamp: chrono::Utc::now(),
            }));
        }

        Ok(())
    }

    async fn resume_scan(&self, scan_id: Uuid) -> Result<(), SentinelError> {
        let mut scans = self.scans.write();
        let scan = scans
            .get_mut(&scan_id)
            .ok_or_else(|| SentinelError::Storage(format!("Scan '{}' not found", scan_id)))?;

        scan.state = ScanLifecycle::Running;

        if let Some(bus) = &self.event_bus {
            let _ = bus.publish_telemetry(SentinelEvent::ScanProgress(ScanProgressUpdate {
                scan_id,
                state: ScanLifecycle::Running,
                progress_pct: 50.0,
                checks_completed: scan.scheduler.requests_completed(),
                timestamp: chrono::Utc::now(),
            }));
        }

        Ok(())
    }

    async fn cancel_scan(&self, scan_id: Uuid) -> Result<(), SentinelError> {
        let mut scans = self.scans.write();
        let scan = scans
            .get_mut(&scan_id)
            .ok_or_else(|| SentinelError::Storage(format!("Scan '{}' not found", scan_id)))?;

        scan.state = ScanLifecycle::Finished;

        if let Some(bus) = &self.event_bus {
            let _ = bus.publish_telemetry(SentinelEvent::ScanProgress(ScanProgressUpdate {
                scan_id,
                state: ScanLifecycle::Finished,
                progress_pct: 100.0,
                checks_completed: scan.scheduler.requests_completed(),
                timestamp: chrono::Utc::now(),
            }));
        }

        Ok(())
    }

    async fn scan_status(&self, scan_id: Uuid) -> Result<ScanLifecycle, SentinelError> {
        let scans = self.scans.read();
        let scan = scans
            .get(&scan_id)
            .ok_or_else(|| SentinelError::Storage(format!("Scan '{}' not found", scan_id)))?;

        Ok(scan.state)
    }
}

//! Attack Surface Coverage Engine Implementation

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::domain::supporting::Endpoint;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::CoverageReport;
use sentinel_common::traits::CoverageEngine;
use sentinel_storage::SqliteObservationStore;

type EndpointMap = HashMap<Uuid, (Endpoint, Option<Uuid>)>;

#[derive(Default, Clone)]
pub struct DefaultCoverageEngine {
    endpoints: Arc<RwLock<EndpointMap>>,
    tested_endpoints: Arc<RwLock<HashSet<Uuid>>>,
    storage: Option<Arc<SqliteObservationStore>>,
}

impl DefaultCoverageEngine {
    pub fn new() -> Self {
        Self {
            endpoints: Arc::new(RwLock::new(HashMap::new())),
            tested_endpoints: Arc::new(RwLock::new(HashSet::new())),
            storage: None,
        }
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Registers a newly discovered or tracked endpoint with its optional scope_id.
    pub fn register_endpoint(&self, endpoint: Endpoint, scope_id: Option<Uuid>) {
        self.endpoints
            .write()
            .insert(endpoint.id, (endpoint, scope_id));
    }
}

#[async_trait]
impl CoverageEngine for DefaultCoverageEngine {
    async fn record_test(&self, endpoint_id: Uuid) -> Result<(), SentinelError> {
        self.tested_endpoints.write().insert(endpoint_id);

        if let Some(storage) = &self.storage {
            let id = Uuid::new_v4().to_string();
            let ep_str = endpoint_id.to_string();
            let ts = chrono::Utc::now().to_rfc3339();

            // Record test audit trace
            let _ = sqlx::query(
                "INSERT INTO audit_events (id, event_type, timestamp, source, target, payload_json) VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind("EndpointTested")
            .bind(ts)
            .bind("CoverageEngine")
            .bind(ep_str)
            .bind("{}")
            .execute(storage.pool())
            .await;
        }

        Ok(())
    }

    async fn get_coverage(&self, scope_id: Uuid) -> Result<CoverageReport, SentinelError> {
        let endpoints = self.endpoints.read();
        let tested = self.tested_endpoints.read();

        let mut total = 0u32;
        let mut tested_count = 0u32;

        for (ep_id, (_ep, ep_scope)) in endpoints.iter() {
            if ep_scope.map(|s| s == scope_id).unwrap_or(true) {
                total += 1;
                if tested.contains(ep_id) {
                    tested_count += 1;
                }
            }
        }

        Ok(CoverageReport {
            total,
            tested: tested_count,
        })
    }

    async fn untested_endpoints(&self, scope_id: Uuid) -> Result<Vec<Endpoint>, SentinelError> {
        let endpoints = self.endpoints.read();
        let tested = self.tested_endpoints.read();

        let mut untested = Vec::new();
        for (ep_id, (ep, ep_scope)) in endpoints.iter() {
            if ep_scope.map(|s| s == scope_id).unwrap_or(true) && !tested.contains(ep_id) {
                untested.push(ep.clone());
            }
        }

        Ok(untested)
    }
}

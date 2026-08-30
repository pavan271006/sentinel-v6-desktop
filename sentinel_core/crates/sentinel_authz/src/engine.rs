//! Default Authorization Engine Implementation

use std::sync::Arc;

use async_trait::async_trait;
use uuid::Uuid;

use sentinel_bus::ChannelEventBus;
use sentinel_common::errors::SentinelError;
use sentinel_common::events::CriticalEvent;
use sentinel_common::operational::{AuthzMatrix, AuthzViolation};
use sentinel_common::traits::{AuthorizationEngine, EventBus};
use sentinel_storage::SqliteObservationStore;

use crate::matrix::MatrixEvaluator;

pub struct DefaultAuthorizationEngine {
    event_bus: Option<Arc<ChannelEventBus>>,
    storage: Option<Arc<SqliteObservationStore>>,
}

impl DefaultAuthorizationEngine {
    pub fn new() -> Self {
        Self {
            event_bus: None,
            storage: None,
        }
    }

    pub fn with_event_bus(mut self, bus: Arc<ChannelEventBus>) -> Self {
        self.event_bus = Some(bus);
        self
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }
}

impl Default for DefaultAuthorizationEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AuthorizationEngine for DefaultAuthorizationEngine {
    async fn build_matrix(&self, identities: Vec<Uuid>) -> Result<AuthzMatrix, SentinelError> {
        let mock_endpoints = vec![
            Uuid::new_v4(),
            Uuid::new_v4(),
            Uuid::new_v4(),
            Uuid::new_v4(),
        ];
        Ok(MatrixEvaluator::generate_default_matrix(
            identities,
            mock_endpoints,
        ))
    }

    async fn test_matrix(
        &self,
        matrix: &AuthzMatrix,
    ) -> Result<Vec<AuthzViolation>, SentinelError> {
        let violations = MatrixEvaluator::evaluate_violations(matrix);

        for violation in &violations {
            if let Some(bus) = &self.event_bus {
                let _ = bus.publish_critical(CriticalEvent::FindingCreated(violation.identity_id));
            }

            if let Some(storage) = &self.storage {
                let id = Uuid::new_v4().to_string();
                let ts = chrono::Utc::now().to_rfc3339();
                let payload = serde_json::to_string(violation).unwrap_or_else(|_| "{}".to_string());

                let _ = sqlx::query(
                    "INSERT INTO audit_events (id, event_type, timestamp, source, target, payload_json) VALUES (?, ?, ?, ?, ?, ?)"
                )
                .bind(id)
                .bind("AuthzViolationDetected")
                .bind(ts)
                .bind("AuthorizationEngine")
                .bind(violation.endpoint_id.to_string())
                .bind(payload)
                .execute(storage.pool())
                .await;
            }
        }

        Ok(violations)
    }
}

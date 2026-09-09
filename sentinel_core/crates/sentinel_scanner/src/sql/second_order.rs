//! SENTINEL Autonomous SQL Security Engine — Second-Order Workflow Engine (M24)
//!
//! Models stateful dependencies tracking Injection Ingress -> Persistence ->
//! Background/Read Retrieval -> Execution -> Observation.

use std::collections::HashMap;
use crate::sql::models::Blake3Id;

#[derive(Debug, Clone)]
pub struct SecondOrderTrackedInjection {
    pub tracking_id: Blake3Id,
    pub write_target_id: Blake3Id,
    pub canary_token: String,
    pub write_endpoint: String,
    pub read_endpoints: Vec<String>,
    pub injected_payload: String,
}

pub struct SecondOrderWorkflowEngine {
    active_trackers: HashMap<Blake3Id, SecondOrderTrackedInjection>,
}

impl SecondOrderWorkflowEngine {
    pub fn new() -> Self {
        Self {
            active_trackers: HashMap::new(),
        }
    }

    /// Registers a stateful injection waiting for downstream verification
    pub fn register_injection(
        &mut self,
        write_target_id: Blake3Id,
        canary: &str,
        write_endpoint: &str,
        read_endpoints: Vec<String>,
        payload: &str,
    ) -> Blake3Id {
        let tracking_id = Blake3Id::new(format!("{}:{}:{}", write_endpoint, canary, payload).as_bytes());
        let tracker = SecondOrderTrackedInjection {
            tracking_id,
            write_target_id,
            canary_token: canary.to_string(),
            write_endpoint: write_endpoint.to_string(),
            read_endpoints,
            injected_payload: payload.to_string(),
        };

        self.active_trackers.insert(tracking_id, tracker);
        tracking_id
    }

    /// Inspects a response from a downstream read endpoint to check if the canary executed or reflected
    pub fn check_read_response(&self, tracking_id: &Blake3Id, read_body: &str) -> bool {
        if let Some(tracker) = self.active_trackers.get(tracking_id) {
            read_body.contains(&tracker.canary_token)
        } else {
            false
        }
    }
}

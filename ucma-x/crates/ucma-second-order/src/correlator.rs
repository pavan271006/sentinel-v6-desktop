//! Second-order causal correlator linking source inputs to sink execution.

use crate::tracker::{SinkObservation, StoredInputVector};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecondOrderFinding {
    pub is_confirmed_second_order: bool,
    pub source: StoredInputVector,
    pub sink: SinkObservation,
    pub confidence: f32,
}

pub struct SecondOrderCorrelator;

impl SecondOrderCorrelator {
    /// Correlates a source write injection with a delayed sink read error or behavior shift.
    pub fn correlate(source: StoredInputVector, sink: SinkObservation) -> SecondOrderFinding {
        let is_valid_time_order = sink.observed_at >= source.injected_at;
        let is_confirmed = is_valid_time_order && sink.observed_error_or_delay;

        let confidence = if is_confirmed { 0.90 } else { 0.0 };

        SecondOrderFinding {
            is_confirmed_second_order: is_confirmed,
            source,
            sink,
            confidence,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use ucma_core::ids::{EndpointId, ParameterId, TargetId};

    #[test]
    fn test_second_order_correlation() {
        let tid = TargetId::derive("https://target.local");
        let write_eid = EndpointId::derive(&tid, "POST", "/profile/update");
        let read_eid = EndpointId::derive(&tid, "GET", "/admin/view_users");
        let pid = ParameterId::derive(&write_eid, "body", "bio");

        let source = StoredInputVector {
            source_endpoint: write_eid,
            source_param: pid,
            payload_value: "admin' UNION SELECT 1,2,3--".to_string(),
            injected_at: Utc::now(),
        };

        let sink = SinkObservation {
            sink_endpoint: read_eid,
            observed_error_or_delay: true,
            observed_at: Utc::now(),
        };

        let result = SecondOrderCorrelator::correlate(source, sink);
        assert!(result.is_confirmed_second_order);
        assert_eq!(result.confidence, 0.90);
    }
}

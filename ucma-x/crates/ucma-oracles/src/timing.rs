//! Statistical timing oracle.

use serde::{Deserialize, Serialize};
use ucma_timing::{LatencyBaseline, TimingEngine, TimingEvidence};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingOracleVerdict {
    pub is_vulnerable: bool,
    pub evidence: Option<TimingEvidence>,
    pub confidence: f32,
}

pub struct TimingOracle;

impl TimingOracle {
    pub fn evaluate(
        baseline: &LatencyBaseline,
        probe_samples: &[f64],
        control_samples: &[f64],
        expected_delay: f64,
    ) -> TimingOracleVerdict {
        let engine = TimingEngine::default();
        if let Some(evidence) = engine.evaluate_pair_sequence(baseline, probe_samples, control_samples, expected_delay) {
            let is_vulnerable = evidence.is_confirmed;
            let confidence = if is_vulnerable { 0.95 } else { 0.0 };
            TimingOracleVerdict {
                is_vulnerable,
                evidence: Some(evidence),
                confidence,
            }
        } else {
            TimingOracleVerdict {
                is_vulnerable: false,
                evidence: None,
                confidence: 0.0,
            }
        }
    }
}

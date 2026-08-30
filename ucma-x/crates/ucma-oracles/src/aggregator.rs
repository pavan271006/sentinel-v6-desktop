//! Evidence fusion aggregator across all independent oracles.

use crate::boolean::BooleanOracleVerdict;
use crate::error::ErrorOracleVerdict;
use crate::metamorphic::MetamorphicOracleVerdict;
use crate::timing::TimingOracleVerdict;
use serde::{Deserialize, Serialize};

/// Unified verdict aggregating multiple independent oracle results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedOracleReport {
    pub is_confirmed_vulnerable: bool,
    pub primary_technique: String,
    pub composite_confidence: f32,
    pub boolean_verdict: Option<BooleanOracleVerdict>,
    pub error_verdict: Option<ErrorOracleVerdict>,
    pub timing_verdict: Option<TimingOracleVerdict>,
    pub metamorphic_verdict: Option<MetamorphicOracleVerdict>,
    pub supporting_oracles_count: usize,
}

pub struct OracleAggregator;

impl OracleAggregator {
    pub fn aggregate(
        boolean_verdict: Option<BooleanOracleVerdict>,
        error_verdict: Option<ErrorOracleVerdict>,
        timing_verdict: Option<TimingOracleVerdict>,
        metamorphic_verdict: Option<MetamorphicOracleVerdict>,
    ) -> AggregatedOracleReport {
        let mut supporting_count = 0;
        let mut max_confidence: f32 = 0.0;
        let mut primary_technique = "None".to_string();

        if let Some(ref b) = boolean_verdict && b.is_vulnerable {
            supporting_count += 1;
            if b.confidence > max_confidence {
                max_confidence = b.confidence;
                primary_technique = "Boolean-based Differential Blind SQLi".to_string();
            }
        }

        if let Some(ref e) = error_verdict && e.is_vulnerable {
            supporting_count += 1;
            if e.confidence > max_confidence {
                max_confidence = e.confidence;
                primary_technique = "Error-based / Syntax Crash SQLi".to_string();
            }
        }

        if let Some(ref t) = timing_verdict && t.is_vulnerable {
            supporting_count += 1;
            if t.confidence > max_confidence {
                max_confidence = t.confidence;
                primary_technique = "Time-based Blind SQLi (SPRT Confirmed)".to_string();
            }
        }

        if let Some(ref m) = metamorphic_verdict && m.is_vulnerable {
            supporting_count += 1;
            if m.confidence > max_confidence {
                max_confidence = m.confidence;
                primary_technique = "Metamorphic Relational Equivalence SQLi".to_string();
            }
        }

        let is_confirmed = supporting_count >= 1 && max_confidence >= 0.75;
        let composite_confidence = if supporting_count > 1 {
            (max_confidence + 0.05).min(0.99)
        } else {
            max_confidence
        };

        AggregatedOracleReport {
            is_confirmed_vulnerable: is_confirmed,
            primary_technique,
            composite_confidence,
            boolean_verdict,
            error_verdict,
            timing_verdict,
            metamorphic_verdict,
            supporting_oracles_count: supporting_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_oracle_aggregation_multi_oracle() {
        let b = BooleanOracleVerdict {
            is_vulnerable: true,
            true_matches_baseline: true,
            false_diverges_baseline: true,
            structural_divergence: 0.8,
            confidence: 0.90,
        };

        let report = OracleAggregator::aggregate(Some(b), None, None, None);
        assert!(report.is_confirmed_vulnerable);
        assert_eq!(report.supporting_oracles_count, 1);
        assert_eq!(report.primary_technique, "Boolean-based Differential Blind SQLi");
    }
}

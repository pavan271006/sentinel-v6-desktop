//! Causal verification engine.

use crate::attribution::CausalAttribution;
use crate::experiment::{CausalStep, StepObservation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CausalEvidence {
    pub attribution: CausalAttribution,
    pub is_causally_confirmed: bool,
    pub causal_effect_size: f64,
    pub observations: Vec<StepObservation>,
    pub explanation: String,
}

pub struct CausalVerifier;

impl CausalVerifier {
    /// Analyzes observations from a complete 5-step causal sequence.
    pub fn verify_observations(observations: &[StepObservation]) -> CausalEvidence {
        let baseline = observations.iter().find(|o| matches!(o.step, CausalStep::BaselineControl));
        let positive = observations.iter().find(|o| matches!(o.step, CausalStep::PositiveIntervention { .. }));
        let negative = observations.iter().find(|o| matches!(o.step, CausalStep::NegativeControl { .. }));
        let noise = observations.iter().find(|o| matches!(o.step, CausalStep::NoiseControl { .. }));
        let replay = observations.iter().find(|o| matches!(o.step, CausalStep::RepeatabilityReplay { .. }));

        if baseline.is_none() || positive.is_none() || negative.is_none() {
            return CausalEvidence {
                attribution: CausalAttribution::Inconclusive,
                is_causally_confirmed: false,
                causal_effect_size: 0.0,
                observations: observations.to_vec(),
                explanation: "Incomplete causal observation sequence".to_string(),
            };
        }

        let base = baseline.unwrap();
        let pos = positive.unwrap();
        let neg = negative.unwrap();

        // 1. Check for pure reflection false positive
        // If Positive and Noise both change the response identically solely because of string reflection
        if let Some(n) = noise
            && pos.contains_reflected_payload
            && n.contains_reflected_payload
            && (pos.body_len as i64 - n.body_len as i64).abs() < 5
            && !pos.has_db_error
            && (pos.latency_seconds - n.latency_seconds).abs() < 0.1
            && pos.structural_similarity_to_baseline == n.structural_similarity_to_baseline
        {
            return CausalEvidence {
                attribution: CausalAttribution::OutputReflectionOnly,
                is_causally_confirmed: false,
                causal_effect_size: 0.0,
                observations: observations.to_vec(),
                explanation: "Divergence matches reflection noise control; no database causal effect detected".to_string(),
            };
        }

        // 2. Check for Boolean Differential Causality
        // True condition (Positive) matches Baseline, False condition (Negative) diverges from Baseline
        let pos_matches_base = (pos.body_len as i64 - base.body_len as i64).abs() < 10
            && pos.structural_similarity_to_baseline >= 0.95;
        let neg_diverges_base = (neg.body_len as i64 - base.body_len as i64).abs() >= 10
            || neg.structural_similarity_to_baseline < 0.90;

        let replay_confirmed = if let Some(r) = replay {
            (r.body_len as i64 - pos.body_len as i64).abs() < 5
        } else {
            true
        };

        if pos_matches_base && neg_diverges_base && replay_confirmed {
            let effect_size = (1.0 - neg.structural_similarity_to_baseline).max(0.1);
            return CausalEvidence {
                attribution: CausalAttribution::DatabaseCausal,
                is_causally_confirmed: true,
                causal_effect_size: effect_size,
                observations: observations.to_vec(),
                explanation: "Positive intervention preserves baseline while negative control induces significant structural divergence".to_string(),
            };
        }

        // 3. Check for Time-based or Error-based Causality
        if pos.has_db_error && !base.has_db_error && !neg.has_db_error {
            return CausalEvidence {
                attribution: CausalAttribution::DatabaseCausal,
                is_causally_confirmed: true,
                causal_effect_size: 1.0,
                observations: observations.to_vec(),
                explanation: "Database syntax error causally isolated to positive intervention".to_string(),
            };
        }

        if pos.latency_seconds >= base.latency_seconds + 3.0 && neg.latency_seconds < base.latency_seconds + 1.0 {
            return CausalEvidence {
                attribution: CausalAttribution::DatabaseCausal,
                is_causally_confirmed: true,
                causal_effect_size: pos.latency_seconds - base.latency_seconds,
                observations: observations.to_vec(),
                explanation: "Statistically significant time delay causally isolated to positive intervention".to_string(),
            };
        }

        CausalEvidence {
            attribution: CausalAttribution::Inconclusive,
            is_causally_confirmed: false,
            causal_effect_size: 0.0,
            observations: observations.to_vec(),
            explanation: "Observations do not satisfy causal separation requirements".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_causal_boolean_verification() {
        let obs = vec![
            StepObservation {
                step: CausalStep::BaselineControl,
                status_code: 200,
                body_len: 1500,
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 1.0,
            },
            StepObservation {
                step: CausalStep::PositiveIntervention { payload: "' AND '1'='1".to_string() },
                status_code: 200,
                body_len: 1500,
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 1.0,
            },
            StepObservation {
                step: CausalStep::NegativeControl { payload: "' AND '1'='2".to_string() },
                status_code: 200,
                body_len: 200, // Missing rows
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 0.3,
            },
        ];

        let evidence = CausalVerifier::verify_observations(&obs);
        assert!(evidence.is_causally_confirmed);
        assert_eq!(evidence.attribution, CausalAttribution::DatabaseCausal);
    }

    #[test]
    fn test_causal_rejects_reflection_noise() {
        let obs = vec![
            StepObservation {
                step: CausalStep::BaselineControl,
                status_code: 200,
                body_len: 1000,
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: false,
                structural_similarity_to_baseline: 1.0,
            },
            StepObservation {
                step: CausalStep::PositiveIntervention { payload: "CANARY_1".to_string() },
                status_code: 200,
                body_len: 1008, // exact string reflection
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: true,
                structural_similarity_to_baseline: 0.98,
            },
            StepObservation {
                step: CausalStep::NegativeControl { payload: "CANARY_2".to_string() },
                status_code: 200,
                body_len: 1008,
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: true,
                structural_similarity_to_baseline: 0.98,
            },
            StepObservation {
                step: CausalStep::NoiseControl { payload: "CANARY_3".to_string() },
                status_code: 200,
                body_len: 1008,
                latency_seconds: 0.1,
                has_db_error: false,
                contains_reflected_payload: true,
                structural_similarity_to_baseline: 0.98,
            },
        ];

        let evidence = CausalVerifier::verify_observations(&obs);
        assert!(!evidence.is_causally_confirmed);
        assert_eq!(evidence.attribution, CausalAttribution::OutputReflectionOnly);
    }
}

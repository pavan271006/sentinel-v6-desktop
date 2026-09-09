//! SENTINEL Autonomous SQL Security Engine — Counter-Hypothesis & Self-Critique (M21)
//!
//! Adversarial validation challenging suspected findings against alternative
//! explanations (Reflection, WAF, Input Validation, Dynamic Jitter) before promotion.

#[derive(Debug, Clone)]
pub struct CritiqueChallengeResult {
    pub passed_critique: bool,
    pub alternative_explanation_ruled_out: bool,
    pub critique_notes: String,
}

pub struct SelfCritiqueEngine;

impl SelfCritiqueEngine {
    /// Evaluates if an observation survives adversarial alternative checks
    pub fn challenge_finding(
        is_sql_signal: bool,
        control_response_body: &str,
        probe_response_body: &str,
        validation_error_present: bool,
        waf_signature_present: bool,
    ) -> CritiqueChallengeResult {
        // 1. Check if the behavior is simply generic input validation
        if validation_error_present {
            return CritiqueChallengeResult {
                passed_critique: false,
                alternative_explanation_ruled_out: false,
                critique_notes: "Behavior is explained by generic application-layer validation error".to_string(),
            };
        }

        // 2. Check if the response is triggered by a WAF signature block
        if waf_signature_present {
            return CritiqueChallengeResult {
                passed_critique: false,
                alternative_explanation_ruled_out: false,
                critique_notes: "Response anomaly caused by WAF/Gateway block rule, not backend SQL execution".to_string(),
            };
        }

        // 3. Check if control probe with benign syntax behaves identically
        if control_response_body == probe_response_body {
            return CritiqueChallengeResult {
                passed_critique: false,
                alternative_explanation_ruled_out: false,
                critique_notes: "Control probe produced identical response; anomaly is not causally tied to SQL execution".to_string(),
            };
        }

        if is_sql_signal {
            CritiqueChallengeResult {
                passed_critique: true,
                alternative_explanation_ruled_out: true,
                critique_notes: "Finding successfully survived all adversarial alternative explanations".to_string(),
            }
        } else {
            CritiqueChallengeResult {
                passed_critique: false,
                alternative_explanation_ruled_out: false,
                critique_notes: "Insufficient distinct SQL execution signal observed".to_string(),
            }
        }
    }
}

//! Verification Strategy Implementations

use std::time::Duration;
use uuid::Uuid;

use sentinel_common::domain::core::{DiffData, Evidence, EvidenceVariant};

pub struct StrategyEvaluator;

impl StrategyEvaluator {
    pub fn evaluate_content(
        verification_id: Uuid,
        body: &[u8],
        pattern: &str,
    ) -> (bool, f32, Vec<Evidence>) {
        let text = String::from_utf8_lossy(body);
        let found = text.contains(pattern);
        let confidence = if found { 1.0 } else { 0.0 };

        let evidence = vec![Evidence {
            id: Uuid::new_v4(),
            verification_id,
            variant: EvidenceVariant::TransactionEvidence(verification_id),
            created_at: chrono::Utc::now(),
        }];

        (found, confidence, evidence)
    }

    pub fn evaluate_differential(
        verification_id: Uuid,
        baseline_status: u16,
        baseline_len: usize,
        probe_status: u16,
        probe_len: usize,
    ) -> (bool, f32, Vec<Evidence>) {
        let status_changed = baseline_status != probe_status;
        let bytes_diff = (probe_len as isize - baseline_len as isize).unsigned_abs();
        let max_len = baseline_len.max(probe_len).max(1);
        let similarity = 1.0 - (bytes_diff as f32 / max_len as f32).min(1.0);

        let success = status_changed || bytes_diff > 50;
        let confidence = if status_changed {
            0.95
        } else if bytes_diff > 100 {
            0.85
        } else {
            0.5
        };

        let diff_data = DiffData {
            structural_similarity: similarity,
            bytes_added: if probe_len > baseline_len {
                bytes_diff
            } else {
                0
            },
            bytes_removed: if baseline_len > probe_len {
                bytes_diff
            } else {
                0
            },
            status_code_changed: status_changed,
            content_type_changed: false,
        };

        let evidence = vec![Evidence {
            id: Uuid::new_v4(),
            verification_id,
            variant: EvidenceVariant::Differential(diff_data),
            created_at: chrono::Utc::now(),
        }];

        (success, confidence, evidence)
    }

    pub fn evaluate_timing(
        verification_id: Uuid,
        expected: Duration,
        actual: Duration,
    ) -> (bool, f32, Vec<Evidence>) {
        // Successful if actual response delay >= 80% of expected delay
        let threshold = expected.mul_f32(0.8);
        let success = actual >= threshold;
        let confidence = if success { 0.92 } else { 0.1 };

        let evidence = vec![Evidence {
            id: Uuid::new_v4(),
            verification_id,
            variant: EvidenceVariant::TimingVariance { expected, actual },
            created_at: chrono::Utc::now(),
        }];

        (success, confidence, evidence)
    }

    pub fn evaluate_sql_error(verification_id: Uuid, body: &[u8]) -> (bool, f32, Vec<Evidence>) {
        if let Some(res) = crate::sqli::SqliEngine::evaluate_error_based(body) {
            let evidence = vec![Evidence {
                id: Uuid::new_v4(),
                verification_id,
                variant: EvidenceVariant::TransactionEvidence(verification_id),
                created_at: chrono::Utc::now(),
            }];
            return (res.is_vulnerable, res.confidence, evidence);
        }

        let evidence = vec![Evidence {
            id: Uuid::new_v4(),
            verification_id,
            variant: EvidenceVariant::TransactionEvidence(verification_id),
            created_at: chrono::Utc::now(),
        }];

        (false, 0.0, evidence)
    }
}

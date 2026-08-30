//! Boolean differential oracle.

use serde::{Deserialize, Serialize};
use ucma_response::diff::ResponseDiffer;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BooleanOracleVerdict {
    pub is_vulnerable: bool,
    pub true_matches_baseline: bool,
    pub false_diverges_baseline: bool,
    pub structural_divergence: f64,
    pub confidence: f32,
}

pub struct BooleanOracle;

impl BooleanOracle {
    pub fn evaluate(
        baseline_body: &str,
        true_body: &str,
        false_body: &str,
    ) -> BooleanOracleVerdict {
        let differ = ResponseDiffer::new();

        let diff_true = differ.diff_texts(baseline_body, true_body);
        let diff_false = differ.diff_texts(baseline_body, false_body);
        let diff_true_false = differ.diff_texts(true_body, false_body);

        let true_matches_baseline = diff_true.masked_similarity >= 0.95 || diff_true.structural_similarity >= 0.95;
        let false_diverges_baseline = diff_false.masked_similarity < 0.90 || diff_false.structural_similarity < 0.90;
        let true_false_diverges = diff_true_false.masked_similarity < 0.90 || diff_true_false.structural_similarity < 0.90;

        let is_vulnerable = true_matches_baseline && false_diverges_baseline && true_false_diverges;
        let divergence = (1.0 - diff_true_false.structural_similarity).max(1.0 - diff_true_false.masked_similarity);

        let confidence = if is_vulnerable {
            let score: f64 = 0.85 + (0.14 * divergence);
            score.min(0.99) as f32
        } else {
            0.0
        };

        BooleanOracleVerdict {
            is_vulnerable,
            true_matches_baseline,
            false_diverges_baseline,
            structural_divergence: divergence,
            confidence,
        }
    }
}

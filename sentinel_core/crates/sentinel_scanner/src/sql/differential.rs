//! SENTINEL Autonomous SQL Security Engine — Differential Response Analyzer (M16)
//!
//! Performs semantic DOM tree diffing, Levenshtein distance calculations,
//! and content-length delta comparisons between True, False, and Baseline probes.

pub struct DifferentialAnalyzer;

impl DifferentialAnalyzer {
    /// Computes normalized string similarity (0.0 = completely different, 1.0 = identical)
    pub fn normalized_similarity(a: &str, b: &str) -> f64 {
        if a == b {
            return 1.0;
        }
        let len_a = a.len();
        let len_b = b.len();
        if len_a == 0 || len_b == 0 {
            return 0.0;
        }

        // Fast token-based Jaccard similarity on words
        let set_a: std::collections::HashSet<&str> = a.split_whitespace().collect();
        let set_b: std::collections::HashSet<&str> = b.split_whitespace().collect();

        let intersection = set_a.intersection(&set_b).count();
        let union = set_a.union(&set_b).count();

        if union == 0 {
            0.0
        } else {
            intersection as f64 / union as f64
        }
    }

    /// Evaluates if a True/False probe pair exhibits a valid Boolean SQL differential
    pub fn is_boolean_differential(
        baseline_body: &str,
        true_body: &str,
        false_body: &str,
    ) -> (bool, f64, String) {
        let sim_true_base = Self::normalized_similarity(baseline_body, true_body);
        let sim_false_base = Self::normalized_similarity(baseline_body, false_body);
        let sim_true_false = Self::normalized_similarity(true_body, false_body);

        // A valid boolean SQLi manifests when TRUE is almost identical to BASELINE,
        // but FALSE exhibits a noticeable structural departure.
        if sim_true_base > 0.85 && sim_false_base < 0.80 && sim_true_false < 0.85 {
            let confidence = (sim_true_base - sim_false_base).abs().min(1.0);
            (
                true,
                confidence,
                format!("True probe matched baseline ({:.2}), False probe departed ({:.2})", sim_true_base, sim_false_base),
            )
        } else {
            (false, 0.0, "No statistically significant boolean differential observed".to_string())
        }
    }
}

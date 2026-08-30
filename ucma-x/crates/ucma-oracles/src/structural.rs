//! Structural token and tree divergence oracle.

use serde::{Deserialize, Serialize};
use ucma_response::diff::ResponseDiffer;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralOracleVerdict {
    pub structural_similarity: f64,
    pub is_structurally_identical: bool,
}

pub struct StructuralOracle;

impl StructuralOracle {
    pub fn compare(base: &str, probe: &str) -> StructuralOracleVerdict {
        let differ = ResponseDiffer::new();
        let diff = differ.diff_texts(base, probe);

        StructuralOracleVerdict {
            structural_similarity: diff.structural_similarity,
            is_structurally_identical: (diff.structural_similarity - 1.0).abs() < 1e-6,
        }
    }
}

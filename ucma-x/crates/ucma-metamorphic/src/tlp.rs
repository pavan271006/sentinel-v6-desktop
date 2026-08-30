//! Ternary Logic Partitioning (TLP) validation.
//! Evaluates the relational invariant: Results(P) + Results(NOT P) + Results(P IS NULL) == Results(Unconstrained).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlpPartitionSet {
    pub original_expr: String,
    pub true_partition: String,
    pub false_partition: String,
    pub null_partition: String,
}

pub struct TlpGenerator;

impl TlpGenerator {
    pub fn generate_partition(predicate: &str) -> TlpPartitionSet {
        TlpPartitionSet {
            original_expr: predicate.to_string(),
            true_partition: format!("({predicate}) = TRUE"),
            false_partition: format!("({predicate}) = FALSE"),
            null_partition: format!("({predicate}) IS NULL"),
        }
    }
}

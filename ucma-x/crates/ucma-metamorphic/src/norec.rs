//! Non-optimizing Reference Engine Construction (NoREC) validation.
//! Compiles queries with non-optimizable equivalent predicates to check relational consistency.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NorecPair {
    pub optimized_expr: String,
    pub unoptimized_expr: String,
}

pub struct NorecGenerator;

impl NorecGenerator {
    pub fn generate_pair(field: &str, target_val: &str) -> NorecPair {
        NorecPair {
            optimized_expr: format!("{field} = '{target_val}'"),
            unoptimized_expr: format!("CASE WHEN {field} = '{target_val}' THEN 1 ELSE 0 END = 1"),
        }
    }
}

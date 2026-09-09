//! SMT Constraint definitions for SQL boundary solving.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConstraintKind {
    IntegerRange { min: i64, max: i64 },
    StringLength { min_len: usize, max_len: usize },
    DisallowedCharacters { chars: Vec<char> },
    DisallowedKeywords { keywords: Vec<String> },
    MaxEntropy { max_entropy: f64 },
    TypeBoundary { sql_type: String },
}

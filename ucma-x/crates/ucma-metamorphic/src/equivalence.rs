//! Semantic equivalence probe generator.
//! Generates syntactically distinct but semantically identical SQL expressions for differential verification.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquivalencePair {
    pub name: String,
    pub original_expr: String,
    pub equivalent_expr: String,
    pub contradictory_expr: String,
}

pub struct EquivalenceGenerator;

impl EquivalenceGenerator {
    /// Generates equivalence probe triplets (Original, Equivalent, Contradictory) for numeric inputs.
    pub fn generate_numeric_probes(val: i64) -> Vec<EquivalencePair> {
        vec![
            EquivalencePair {
                name: "arithmetic_addition".to_string(),
                original_expr: format!("{val}"),
                equivalent_expr: format!("({} + 1 - 1)", val),
                contradictory_expr: format!("({} + 99)", val),
            },
            EquivalencePair {
                name: "bitwise_identity".to_string(),
                original_expr: format!("{val}"),
                equivalent_expr: format!("(({val} | 0) & {val})"),
                contradictory_expr: format!("({val} ^ 1)"),
            },
            EquivalencePair {
                name: "boolean_identity_and".to_string(),
                original_expr: format!("{val}"),
                equivalent_expr: format!("{val} AND 1=1"),
                contradictory_expr: format!("{val} AND 1=2"),
            },
        ]
    }

    /// Generates equivalence probe triplets for string literal inputs.
    pub fn generate_string_probes(val: &str) -> Vec<EquivalencePair> {
        let (first, rest) = if val.len() > 1 {
            val.split_at(1)
        } else {
            (val, "")
        };

        vec![
            EquivalencePair {
                name: "string_concat_ansi".to_string(),
                original_expr: format!("'{val}'"),
                equivalent_expr: format!("'{first}'||'{rest}'"),
                contradictory_expr: format!("'{val}__different'"),
            },
            EquivalencePair {
                name: "string_concat_mysql".to_string(),
                original_expr: format!("'{val}'"),
                equivalent_expr: format!("CONCAT('{first}','{rest}')"),
                contradictory_expr: format!("CONCAT('{val}','_diff')"),
            },
            EquivalencePair {
                name: "string_inline_boolean".to_string(),
                original_expr: format!("'{val}'"),
                equivalent_expr: format!("'{val}' AND '1'='1"),
                contradictory_expr: format!("'{val}' AND '1'='2"),
            },
        ]
    }
}

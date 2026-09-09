//! SENTINEL Autonomous SQL Security Engine — Syntactic Context Inference (M08)
//!
//! Evaluates and updates belief distributions across 56 syntactic SQL AST
//! grammar injection positions using non-destructive discriminating probe pairs.

use crate::sql::models::{BeliefDistribution, InputTarget};

#[derive(Debug, Clone)]
pub struct ContextProbePair {
    pub context_id: String,
    pub true_probe: String,
    pub false_probe: String,
    pub error_probe: String,
    pub description: String,
}

pub struct ContextInferenceEngine;

impl ContextInferenceEngine {
    /// Initializes a uniform or prior belief distribution over the 56 AST contexts
    pub fn initial_belief(target: &InputTarget) -> BeliefDistribution {
        let all_contexts = vec![
            "CTX-01", "CTX-02", "CTX-03", "CTX-04", "CTX-05", "CTX-06", "CTX-07", "CTX-08",
            "CTX-09", "CTX-10", "CTX-11", "CTX-12", "CTX-13", "CTX-14", "CTX-15", "CTX-16",
            "CTX-17", "CTX-18", "CTX-19", "CTX-20", "CTX-21", "CTX-22", "CTX-23", "CTX-24",
            "CTX-25", "CTX-26", "CTX-27", "CTX-28", "CTX-29", "CTX-30", "CTX-31", "CTX-32",
            "CTX-33", "CTX-34", "CTX-35", "CTX-36", "CTX-37", "CTX-38", "CTX-39", "CTX-40",
            "CTX-41", "CTX-42", "CTX-43", "CTX-44", "CTX-45", "CTX-46", "CTX-47", "CTX-48",
            "CTX-49", "CTX-50", "CTX-51", "CTX-52", "CTX-53", "CTX-54", "CTX-55", "CTX-56",
        ];

        let mut dist = BeliefDistribution::uniform(&all_contexts);

        // Apply heuristic priors based on parameter naming and inferred type
        if target.inferred_type == "integer" {
            dist.set("CTX-07".to_string(), 0.40); // Direct Numeric
            dist.set("CTX-08".to_string(), 0.20); // Parenthesized Numeric
            dist.set("CTX-14".to_string(), 0.15); // LIMIT
            dist.set("CTX-15".to_string(), 0.15); // OFFSET
        } else if target.inferred_type == "string" {
            dist.set("CTX-01".to_string(), 0.50); // Single-quote literal
            dist.set("CTX-02".to_string(), 0.15); // Double-quote identifier/literal
            dist.set("CTX-03".to_string(), 0.10); // Dollar quote
        }

        dist.normalize();
        dist
    }

    /// Generates non-destructive probe pairs to discriminate between candidate AST contexts
    pub fn get_discriminating_probes(context_id: &str, original_val: &str) -> Option<ContextProbePair> {
        match context_id {
            "CTX-01" => Some(ContextProbePair {
                context_id: "CTX-01".to_string(),
                true_probe: format!("{}' AND '1'='1", original_val),
                false_probe: format!("{}' AND '1'='2", original_val),
                error_probe: format!("{}'", original_val),
                description: "Single-quote string literal delimiter breakout".to_string(),
            }),
            "CTX-02" => Some(ContextProbePair {
                context_id: "CTX-02".to_string(),
                true_probe: format!("{}\" AND \"1\"=\"1", original_val),
                false_probe: format!("{}\" AND \"1\"=\"2", original_val),
                error_probe: format!("{}\"", original_val),
                description: "Double-quote string/identifier delimiter breakout".to_string(),
            }),
            "CTX-04" => Some(ContextProbePair {
                context_id: "CTX-04".to_string(),
                true_probe: format!("{}') AND ('1'='1", original_val),
                false_probe: format!("{}') AND ('1'='2", original_val),
                error_probe: format!("{}')", original_val),
                description: "Parenthesized single-quoted string literal breakout".to_string(),
            }),
            "CTX-07" => {
                if let Ok(num) = original_val.parse::<i64>() {
                    Some(ContextProbePair {
                        context_id: "CTX-07".to_string(),
                        true_probe: format!("{}-0", num),
                        false_probe: format!("{}-1", num),
                        error_probe: format!("{}/0", num),
                        description: "Direct numeric literal arithmetic differential".to_string(),
                    })
                } else {
                    None
                }
            },
            "CTX-08" => {
                if let Ok(num) = original_val.parse::<i64>() {
                    Some(ContextProbePair {
                        context_id: "CTX-08".to_string(),
                        true_probe: format!("{}) AND (1=1", num),
                        false_probe: format!("{}) AND (1=2", num),
                        error_probe: format!("{}) AND (1/0=1", num),
                        description: "Parenthesized numeric literal arithmetic differential".to_string(),
                    })
                } else {
                    None
                }
            },
            "CTX-10" => Some(ContextProbePair {
                context_id: "CTX-10".to_string(),
                true_probe: format!("(CASE WHEN (1=1) THEN {} ELSE 1 END)", original_val),
                false_probe: format!("(CASE WHEN (1=2) THEN {} ELSE 1 END)", original_val),
                error_probe: format!("(CASE WHEN (1=1) THEN 1/0 ELSE {} END)", original_val),
                description: "Dynamic ORDER BY conditional CASE branching".to_string(),
            }),
            "CTX-14" => {
                if let Ok(num) = original_val.parse::<i64>() {
                    Some(ContextProbePair {
                        context_id: "CTX-14".to_string(),
                        true_probe: format!("{}", num),
                        false_probe: "0".to_string(),
                        error_probe: "-1".to_string(),
                        description: "LIMIT clause row quantity differential".to_string(),
                    })
                } else {
                    None
                }
            },
            "CTX-15" => {
                if let Ok(num) = original_val.parse::<i64>() {
                    Some(ContextProbePair {
                        context_id: "CTX-15".to_string(),
                        true_probe: format!("{}", num),
                        false_probe: "999999".to_string(),
                        error_probe: "-1".to_string(),
                        description: "OFFSET clause pagination boundary differential".to_string(),
                    })
                } else {
                    None
                }
            },
            "CTX-28" => Some(ContextProbePair {
                context_id: "CTX-28".to_string(),
                true_probe: format!("{}' AND jsonb_typeof(data) IS NOT NULL--", original_val),
                false_probe: format!("{}' AND jsonb_typeof(data) IS NULL--", original_val),
                error_probe: format!("{}'->'nonexistent", original_val),
                description: "PostgreSQL JSONB ->> dynamic key injection".to_string(),
            }),
            "CTX-29" => Some(ContextProbePair {
                context_id: "CTX-29".to_string(),
                true_probe: format!("{}]::vector <=> '[0,0]'::vector", original_val),
                false_probe: format!("{}]::vector <=> '[999,999]'::vector", original_val),
                error_probe: format!("{}]::vector <=> 'invalid'", original_val),
                description: "pgvector Cosine distance metric operator (<=>)".to_string(),
            }),
            "CTX-30" => Some(ContextProbePair {
                context_id: "CTX-30".to_string(),
                true_probe: format!("{}(CASE WHEN 1=1 THEN 1 ELSE 0 END)", original_val),
                false_probe: format!("{}(CASE WHEN 1=2 THEN 1 ELSE 0 END)", original_val),
                error_probe: format!("{}(1/0)", original_val),
                description: "Window function OVER (PARTITION BY / ORDER BY) injection".to_string(),
            }),
            "CTX-35" => Some(ContextProbePair {
                context_id: "CTX-35".to_string(),
                true_probe: format!("{}, recursive_cte AS (SELECT 1)", original_val),
                false_probe: format!("{}, recursive_cte AS (SELECT 0 WHERE 1=0)", original_val),
                error_probe: format!("{}, recursive_cte AS (SELECT 1/0)", original_val),
                description: "Common Table Expression (WITH RECURSIVE) injection".to_string(),
            }),
            _ => None,
        }
    }
}

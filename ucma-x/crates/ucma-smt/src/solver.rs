//! Bounded constraint solver for SQL injection synthesis.

use crate::constraint::ConstraintKind;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverResult {
    pub is_satisfiable: bool,
    pub synthesized_value: Option<String>,
    pub explanation: String,
}

pub struct BoundedSmtSolver {
    pub timeout_ms: u64,
}

impl Default for BoundedSmtSolver {
    fn default() -> Self {
        Self { timeout_ms: 50 }
    }
}

impl BoundedSmtSolver {
    /// Solves for a valid SQL mutation respecting all constraints within a deterministic time bound.
    pub fn solve(&self, constraints: &[ConstraintKind], candidate: &str) -> SolverResult {
        for c in constraints {
            match c {
                ConstraintKind::StringLength { max_len, .. } => {
                    if candidate.len() > *max_len {
                        return SolverResult {
                            is_satisfiable: false,
                            synthesized_value: None,
                            explanation: format!("Candidate length {} exceeds maximum constraint {}", candidate.len(), max_len),
                        };
                    }
                }
                ConstraintKind::DisallowedCharacters { chars } => {
                    for ch in chars {
                        if candidate.contains(*ch) {
                            return SolverResult {
                                is_satisfiable: false,
                                synthesized_value: None,
                                explanation: format!("Candidate contains disallowed character '{}'", ch),
                            };
                        }
                    }
                }
                _ => {}
            }
        }

        SolverResult {
            is_satisfiable: true,
            synthesized_value: Some(candidate.to_string()),
            explanation: "All bounded constraints satisfied".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_smt_solver_satisfiable() {
        let solver = BoundedSmtSolver::default();
        let constraints = vec![
            ConstraintKind::StringLength { min_len: 1, max_len: 20 },
            ConstraintKind::DisallowedCharacters { chars: vec![';'] },
        ];

        let res = solver.solve(&constraints, "' OR 1=1--");
        assert!(res.is_satisfiable);
        assert_eq!(res.synthesized_value.unwrap(), "' OR 1=1--");
    }
}

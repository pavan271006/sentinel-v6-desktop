//! Metamorphic relational verification engine.

use crate::equivalence::{EquivalenceGenerator, EquivalencePair};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetamorphicEvidence {
    pub probe_name: String,
    pub is_invariant_satisfied: bool,
    pub original_equivalent_match: bool,
    pub contradictory_divergence: bool,
    pub confidence: f32,
}

pub struct MetamorphicEngine;

impl MetamorphicEngine {
    /// Generates candidate metamorphic test suites based on the inferred parameter type and value.
    pub fn generate_suites(is_numeric: bool, raw_val: &str) -> Vec<EquivalencePair> {
        if is_numeric {
            let num = raw_val.trim().parse::<i64>().unwrap_or(1);
            EquivalenceGenerator::generate_numeric_probes(num)
        } else {
            EquivalenceGenerator::generate_string_probes(raw_val)
        }
    }

    /// Evaluates observations from a metamorphic test execution.
    pub fn evaluate_result(
        probe_name: impl Into<String>,
        original_matches_equiv: bool,
        original_diverges_contradictory: bool,
    ) -> MetamorphicEvidence {
        let is_invariant_satisfied = original_matches_equiv && original_diverges_contradictory;
        let confidence = if is_invariant_satisfied { 0.95 } else { 0.10 };

        MetamorphicEvidence {
            probe_name: probe_name.into(),
            is_invariant_satisfied,
            original_equivalent_match: original_matches_equiv,
            contradictory_divergence: original_diverges_contradictory,
            confidence,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metamorphic_numeric_probes() {
        let probes = MetamorphicEngine::generate_suites(true, "42");
        assert_eq!(probes.len(), 3);
        assert!(probes[0].equivalent_expr.contains("+ 1 - 1"));
    }

    #[test]
    fn test_metamorphic_evaluation() {
        let evidence = MetamorphicEngine::evaluate_result("string_concat_ansi", true, true);
        assert!(evidence.is_invariant_satisfied);
        assert!(evidence.confidence >= 0.9);
    }
}

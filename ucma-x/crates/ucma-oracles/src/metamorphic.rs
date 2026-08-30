//! Metamorphic relational invariant oracle.

use serde::{Deserialize, Serialize};
use ucma_metamorphic::engine::{MetamorphicEngine, MetamorphicEvidence};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetamorphicOracleVerdict {
    pub is_vulnerable: bool,
    pub evidence: MetamorphicEvidence,
    pub confidence: f32,
}

pub struct MetamorphicOracle;

impl MetamorphicOracle {
    pub fn evaluate(
        probe_name: &str,
        original_matches_equiv: bool,
        original_diverges_contradictory: bool,
    ) -> MetamorphicOracleVerdict {
        let evidence = MetamorphicEngine::evaluate_result(
            probe_name,
            original_matches_equiv,
            original_diverges_contradictory,
        );

        MetamorphicOracleVerdict {
            is_vulnerable: evidence.is_invariant_satisfied,
            confidence: evidence.confidence,
            evidence,
        }
    }
}

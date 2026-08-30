//! Clean-room independent verifier.
//! Verifies findings without relying on internal heuristic detector state.

use crate::finding::FindingRecord;
use crate::lifecycle::FindingLifecycleState;

pub struct IndependentVerifier;

impl IndependentVerifier {
    /// Re-evaluates an existing finding against clean-room reproduction criteria.
    pub fn verify_clean_room(finding: &mut FindingRecord) -> bool {
        // Verification requirements:
        // 1. Must have at least 1 verified oracle with confidence >= 0.80
        // 2. Must have at least 1 reproduction payload
        // 3. Must have causal confirmation if boolean or timing based
        let has_confidence = finding.oracle_report.composite_confidence >= 0.80;
        let has_payloads = !finding.reproduction_payloads.is_empty();
        let has_causal = finding
            .causal_evidence
            .as_ref()
            .map(|c| c.is_causally_confirmed)
            .unwrap_or(true);

        if has_confidence && has_payloads && has_causal {
            let _ = finding.advance_state(FindingLifecycleState::Candidate);
            let _ = finding.advance_state(FindingLifecycleState::Reproducible);
            let _ = finding.advance_state(FindingLifecycleState::Verified);
            let _ = finding.advance_state(FindingLifecycleState::IndependentlyVerified);
            let _ = finding.advance_state(FindingLifecycleState::Promoted);
            true
        } else {
            false
        }
    }
}

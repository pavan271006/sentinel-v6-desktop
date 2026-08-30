//! Finding Lifecycle State Machine.
//! Enforces that no finding can be promoted to verified status without independent multi-stage confirmation.

use serde::{Deserialize, Serialize};

/// Progression state of a candidate SQL injection finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum FindingLifecycleState {
    /// Initial anomalous signal observed (e.g. single error signature or status code divergence).
    Observed,
    /// Differential behavior observed across a minimal control pair.
    Candidate,
    /// Signal replicated across multiple repeated iterations under controlled conditions.
    Reproducible,
    /// Causal attribution confirmed via multi-oracle evaluation (e.g. Boolean + Metamorphic).
    Verified,
    /// Confirmed by an independent clean-room verifier without access to heuristic detector state.
    IndependentlyVerified,
    /// Formally promoted finding with complete evidence provenance.
    Promoted,
}

impl FindingLifecycleState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Observed => "OBSERVED",
            Self::Candidate => "CANDIDATE",
            Self::Reproducible => "REPRODUCIBLE",
            Self::Verified => "VERIFIED",
            Self::IndependentlyVerified => "INDEPENDENTLY_VERIFIED",
            Self::Promoted => "PROMOTED",
        }
    }

    /// Checks if a transition from `self` to `next` is valid.
    pub fn can_transition_to(&self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Observed, Self::Candidate)
                | (Self::Candidate, Self::Reproducible)
                | (Self::Reproducible, Self::Verified)
                | (Self::Verified, Self::IndependentlyVerified)
                | (Self::IndependentlyVerified, Self::Promoted)
        )
    }
}

//! Causal attribution vs alternative non-database explanations.

use serde::{Deserialize, Serialize};

/// Classification of the observed divergence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CausalAttribution {
    /// Divergence is causally proven to originate from database execution.
    DatabaseCausal,
    /// Divergence is caused merely by payload string reflection in HTML/JSON output.
    OutputReflectionOnly,
    /// Divergence is caused by network jitter or timing drift.
    TransientNetworkNoise,
    /// Divergence is caused by application state changes (e.g. rotating tokens or DB counters).
    ApplicationStateDrift,
    /// Inconclusive / insufficient statistical separation.
    Inconclusive,
}

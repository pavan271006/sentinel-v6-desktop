//! Causal intervention experiment definitions.

use serde::{Deserialize, Serialize};

/// An intervention step in the causal validation cycle.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CausalStep {
    /// Step 1: Unperturbed baseline control.
    BaselineControl,
    /// Step 2: Positive intervention (e.g. injected condition that evaluates to TRUE or invokes delay).
    PositiveIntervention { payload: String },
    /// Step 3: Negative control (e.g. identical payload structure evaluating to FALSE).
    NegativeControl { payload: String },
    /// Step 4: Reflection/syntactic noise control (identical character set without SQL semantics).
    NoiseControl { payload: String },
    /// Step 5: Repeatability confirmation replay.
    RepeatabilityReplay { payload: String },
}

/// Observation collected from a single causal intervention step.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StepObservation {
    pub step: CausalStep,
    pub status_code: u16,
    pub body_len: usize,
    pub latency_seconds: f64,
    pub has_db_error: bool,
    pub contains_reflected_payload: bool,
    pub structural_similarity_to_baseline: f64,
}

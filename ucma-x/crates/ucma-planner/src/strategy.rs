//! Experiment strategies selectable by the adaptive planner.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExperimentStrategy {
    /// Initial baseline control check.
    BaselineControl,
    /// Fast boolean differential pair (AND 1=1 vs AND 1=2).
    BooleanDifferential,
    /// Targeted syntax error crash probe (e.g. unclosed quote or divide-by-zero).
    ErrorCrashProbe,
    /// Time-based blind delay probe with SPRT sequential evaluation.
    TimingProbe,
    /// Metamorphic semantic equivalence pair check.
    MetamorphicEquivalence,
    /// Verification complete; terminate experiment series.
    TerminalComplete,
}

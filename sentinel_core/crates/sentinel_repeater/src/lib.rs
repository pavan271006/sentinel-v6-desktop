//! SENTINEL V6: Repeater & Manual Testing Workspace (WP-3.1 / SUB-08)
//!
//! Provides interactive request crafting, raw-byte manipulation, scope-enforced
//! network dispatching, dynamic variable interpolation, revision history tracking,
//! and response diffing.

pub mod diff;
pub mod executor;
pub mod manager;
pub mod tab;
pub mod variables;

pub use diff::{DiffKind, HeaderDiffItem, LineDiff, ResponseDiff, ResponseDiffResult};
pub use executor::{ExecutionOutput, RepeaterExecutor};
pub use manager::RepeaterManager;
pub use tab::{RepeaterRevision, RepeaterTab};
pub use variables::VariableEnvironment;

//! SENTINEL V6: Controlled Agentic Testing Subsystem (WP-19.1)
//!
//! Provides typed security tools, risk budgeting, bounded execution loops,
//! and complete audit trail persistence (SEC-03, SEC-12).

pub mod budget;
pub mod controller;
pub mod tools;

pub use budget::{RiskBudgetConfig, RiskBudgetTracker};
pub use controller::{AgentController, AgentStepRecord};
pub use tools::{AgentToolDefinition, ToolRegistry};

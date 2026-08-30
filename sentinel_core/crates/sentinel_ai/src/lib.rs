//! SENTINEL V6: AI Security Copilot Subsystem (WP-18.1 / SUB-18 / SUB-19)
//!
//! Provides AI engine analysis, prompt template generation, and host-side
//! policy enforcement to prevent destructive actions and prompt injection (SEC-03).

pub mod engine;
pub mod policy;

pub use engine::DefaultAiEngine;
pub use policy::DefaultAiPolicyEngine;

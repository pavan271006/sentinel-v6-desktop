//! Sentinel Scope Subsystem (WP-1.4 / SUB-04)
//!
//! Authoritative Fail-Closed Network Access Control List (ACL) Engine.
//! Strictly enforces SEC-01 (Default Deny), SSRF/DNS rebinding defense, and ReDoS protection.

pub mod decision;
pub mod engine;
pub mod event;
pub mod matchers;

pub use decision::*;
pub use engine::*;
pub use event::*;
pub use matchers::*;

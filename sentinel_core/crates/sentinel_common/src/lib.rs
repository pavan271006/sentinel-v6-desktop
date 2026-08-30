//! SENTINEL V6: Canonical Common Crate
//! crates/sentinel_common/src/lib.rs
//!
//! Authoritative domain types, traits, error hierarchy, and security contracts
//! conforming strictly to V6_CANONICAL_SPEC.yaml and V6_COMMON_TYPES.rs.

pub mod config;
pub mod domain;
pub mod enums;
pub mod errors;
pub mod events;
pub mod operational;
pub mod security;
pub mod traits;

// Direct root re-exports for standard ergonomic usage
pub use config::*;
pub use domain::*;
pub use enums::*;
pub use errors::*;
pub use events::*;
pub use operational::*;
pub use security::*;
pub use traits::*;

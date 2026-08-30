//! Core SQL Injection Detection and Finding Lifecycle Engine for UCMA-X.

pub mod engine;
pub mod finding;
pub mod lifecycle;
pub mod verifier;

pub use engine::DetectionOrchestrator;
pub use finding::FindingRecord;
pub use lifecycle::FindingLifecycleState;
pub use verifier::IndependentVerifier;

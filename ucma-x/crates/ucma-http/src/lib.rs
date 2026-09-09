//! # UCMA-HTTP
//! High-performance, capability-gated safe HTTP client wrapper enforcing
//! scope authorization tokens, resource bounds, safe redirects, and wire snapshot capture.

pub mod client;
pub mod jitter;
pub mod limits;
pub mod redirect;
pub mod response;
pub mod serializer;
pub mod snapshot;

// Re-exports
pub use client::{HttpError, SafeHttpClient};
pub use jitter::{FastRng, PoissonJitterEngine};
pub use limits::{HttpLimits, HttpLimitsBuilder};
pub use redirect::{RedirectDecision, RedirectValidator};
pub use response::RawWireResponse;
pub use serializer::WireSerializer;
pub use snapshot::SnapshotBuilder;

//! # UCMA-Bench
//! Synthetic testbed mock fixtures, round-trip benchmarking harness, and statistical metrics.

pub mod fixtures;
pub mod harness;

// Re-exports
pub use fixtures::MockHttpServer;
pub use harness::{BenchmarkHarness, BenchmarkMetrics};

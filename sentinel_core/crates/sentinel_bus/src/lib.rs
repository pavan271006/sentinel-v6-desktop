//! Sentinel Two-Tier Event Bus Subsystem (WP-1.3)
//!
//! Provides high-throughput non-blocking broadcast for transient telemetry
//! and guaranteed lossless delivery with SQLite WAL durability for critical audit events (SEC-12).

pub mod broadcast;
pub mod bus;
pub mod critical;
pub mod envelope;
pub mod filter;
pub mod shutdown;

pub use broadcast::*;
pub use bus::*;
pub use critical::*;
pub use envelope::*;
pub use filter::*;
pub use shutdown::*;

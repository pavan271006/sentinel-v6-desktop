//! Sentinel Storage Subsystem (WP-1.2 / Proprietary Engine 5)
//!
//! Provides SQLite connection pooling with mandatory security PRAGMAs,
//! 32-table canonical schema migration engine, Content-Addressed Blob Storage (CAS)
//! with SHA-256 integrity verification (SEC-07), strict project filesystem isolation (SEC-08),
//! Engagement Memory engine for deterministic test history & negative controls,
//! and repositories implementing `ObservationStore`, Scope, Audit, Transaction, and Finding lifecycles.

pub mod cas;
pub mod db;
pub mod memory;
pub mod merkle;
pub mod migrations;
pub mod project;
pub mod repository;
pub mod search;
pub mod store;

pub use cas::*;
pub use db::*;
pub use memory::*;
pub use merkle::*;
pub use migrations::*;
pub use project::*;
pub use repository::*;
pub use search::*;
pub use store::*;

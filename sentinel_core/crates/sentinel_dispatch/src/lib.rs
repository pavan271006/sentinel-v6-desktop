//! SENTINEL V6: Central Asynchronous Network Dispatch Subsystem
//!
//! Provides the shared HTTP/TLS socket execution pipeline for all security engines
//! (Repeater, Scanner, Fuzzer, Verification, Auth, Logic, and Agent) with:
//! - Strict SEC-01 fail-closed scope enforcement
//! - CAS dual-write cryptographic proof tracking (SHA-256)
//! - Lossless EventBus telemetry
//! - Rate and risk budget governors

pub mod budget;
pub mod client;

pub use budget::DispatchBudget;
pub use client::{DispatchResult, HttpDispatcher};

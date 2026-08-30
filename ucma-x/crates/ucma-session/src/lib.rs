//! # UCMA-Session
//! Stateful session tracking, virtual cookie jars, header management, and zeroized credential containers.

pub mod cookie;
pub mod credential;
pub mod header;
pub mod manager;
pub mod tracker;

// Re-exports
pub use cookie::{Cookie, CookieJar};
pub use credential::CredentialContainer;
pub use header::HeaderManager;
pub use manager::DefaultSessionManager;
pub use tracker::SessionTracker;

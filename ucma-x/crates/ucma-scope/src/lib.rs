//! # UCMA-Scope
//! Centralized, fail-closed scope enforcement engine, anti-SSRF DNS resolution,
//! URL canonicalization, and AuthorizedRequest capability tokens.

pub mod canonicalize;
pub mod dns;
pub mod errors;
pub mod matcher;
pub mod policy;

// Re-exports
pub use canonicalize::{canonicalize, canonicalize_url};
pub use dns::{IpValidator, ResolvedTarget, ResolverMode, SafeDnsResolver};
pub use errors::ScopeError;
pub use matcher::ScopeMatcher;
pub use policy::{AuthorizedRequest, ScopePolicy, ScopePolicyBuilder};

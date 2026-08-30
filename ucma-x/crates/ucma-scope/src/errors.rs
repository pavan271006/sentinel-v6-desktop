//! Scope validation and security violation error types.

use std::net::IpAddr;

/// Comprehensive error taxonomy for scope gate and SSRF enforcement.
#[derive(Debug, thiserror::Error, Clone, PartialEq, Eq)]
pub enum ScopeError {
    #[error("target URL is out of scope: {0}")]
    OutOfScope(String),

    #[error("SSRF violation: IP {0} is in blocked range ({1})")]
    SsrfBlocked(IpAddr, String),

    #[error("DNS resolution error for host '{0}': {1}")]
    InvalidDns(String, String),

    #[error("disallowed port {0}")]
    DisallowedPort(u16),

    #[error("disallowed URL scheme '{0}' (only http/https allowed)")]
    DisallowedScheme(String),

    #[error("redirect target is out of scope: {0}")]
    RedirectOutOfScope(String),

    #[error("too many redirects (max {0})")]
    TooManyRedirects(usize),

    #[error("URL canonicalization error: {0}")]
    CanonicalizationError(String),

    #[error("scope policy violation: {0}")]
    PolicyViolation(String),

    #[error("capability token expired at {0}")]
    ExpiredCapabilityToken(String),

    #[error("invalid or forged capability token signature")]
    InvalidCapabilityToken,
}

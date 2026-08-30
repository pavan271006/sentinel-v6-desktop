//! Sentinel Proxy Errors
//!
//! Error hierarchy for proxy listener, TLS termination, interceptor pipeline,
//! and network communication.

use sentinel_common::errors::SentinelError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProxyError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("TLS configuration error: {0}")]
    Tls(String),

    #[error("Scope authorization violation (SEC-01): {target} is denied: {reason}")]
    ScopeViolation { target: String, reason: String },

    #[error("HTTP parsing error: {0}")]
    Parse(String),

    #[error("Upstream connection error to {target}: {message}")]
    UpstreamConnection { target: String, message: String },

    #[error("Interceptor error: {0}")]
    Interceptor(String),

    #[error("Persistence error: {0}")]
    Persistence(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("Proxy already running")]
    AlreadyRunning,

    #[error("Proxy is not running")]
    NotRunning,

    #[error("Sentinel error: {0}")]
    Sentinel(SentinelError),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
}

impl From<SentinelError> for ProxyError {
    fn from(err: SentinelError) -> Self {
        ProxyError::Sentinel(err)
    }
}

impl From<ProxyError> for SentinelError {
    fn from(err: ProxyError) -> Self {
        match err {
            ProxyError::Io(e) => SentinelError::Io(e),
            ProxyError::Tls(msg) => SentinelError::TlsError(msg),
            ProxyError::ScopeViolation { reason, .. } => SentinelError::ScopeViolation { reason },
            ProxyError::Parse(msg) => SentinelError::ParseError(msg),
            ProxyError::UpstreamConnection { message, .. } => SentinelError::NetworkError(message),
            ProxyError::InvalidConfiguration(msg) => SentinelError::InvalidConfiguration(msg),
            _ => SentinelError::NetworkError(err.to_string()),
        }
    }
}

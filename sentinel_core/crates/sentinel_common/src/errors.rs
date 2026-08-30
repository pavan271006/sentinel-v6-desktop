// SENTINEL V6: Canonical Error Hierarchy
// crates/sentinel_common/src/errors.rs

use thiserror::Error;

#[derive(Debug, Error)]
pub enum SentinelError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Search index error: {0}")]
    Tantivy(String),

    #[error("Scope engine rejected interaction: {reason}")]
    ScopeViolation { reason: String },

    #[error("Event bus overflow: dropped {count} messages")]
    BusOverflow { count: usize },

    #[error("Parsing error: {0}")]
    ParseError(String),

    #[error("AI Engine error: {0}")]
    AiEngine(String),

    #[error("Plugin sandbox violation: {0}")]
    SandboxViolation(String),

    #[error("Internal invariant violated: {0}")]
    InvariantViolation(String),

    #[error("TLS error: {0}")]
    TlsError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Operation timeout: {0}")]
    Timeout(String),

    #[error("Authentication/Authorization error: {0}")]
    AuthError(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Integrity error: {0}")]
    Integrity(String),

    #[error("Invalid state transition from {from} to {to}: {reason}")]
    InvalidStateTransition {
        from: String,
        to: String,
        reason: String,
    },
}

impl SentinelError {
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::Database(_) => "ERR_DB_001",
            Self::Io(_) => "ERR_IO_002",
            Self::Tantivy(_) => "ERR_FTS_003",
            Self::ScopeViolation { .. } => "ERR_SCOPE_004",
            Self::BusOverflow { .. } => "ERR_BUS_005",
            Self::ParseError(_) => "ERR_PARSE_006",
            Self::AiEngine(_) => "ERR_AI_007",
            Self::SandboxViolation(_) => "ERR_SANDBOX_008",
            Self::InvariantViolation(_) => "ERR_INVAR_009",
            Self::TlsError(_) => "ERR_TLS_010",
            Self::NetworkError(_) => "ERR_NET_011",
            Self::Timeout(_) => "ERR_TIME_012",
            Self::AuthError(_) => "ERR_AUTH_013",
            Self::InvalidConfiguration(_) => "ERR_CFG_014",
            Self::Serialization(_) => "ERR_SER_015",
            Self::Storage(_) => "ERR_STR_016",
            Self::Integrity(_) => "ERR_INT_017",
            Self::InvalidStateTransition { .. } => "ERR_STATE_018",
        }
    }

    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Database(_) => true,
            Self::BusOverflow { .. } => true,
            Self::AiEngine(_) => true,
            Self::TlsError(_) => true,
            Self::NetworkError(_) => true,
            Self::Timeout(_) => true,
            Self::Io(_)
            | Self::Tantivy(_)
            | Self::ScopeViolation { .. }
            | Self::ParseError(_)
            | Self::SandboxViolation(_)
            | Self::InvariantViolation(_)
            | Self::AuthError(_)
            | Self::InvalidConfiguration(_)
            | Self::Serialization(_)
            | Self::Storage(_)
            | Self::Integrity(_)
            | Self::InvalidStateTransition { .. } => false,
        }
    }

    pub fn invalid_state_transition(
        from: impl Into<String>,
        to: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        Self::InvalidStateTransition {
            from: from.into(),
            to: to.into(),
            reason: reason.into(),
        }
    }

    pub fn scope_violation(reason: impl Into<String>) -> Self {
        Self::ScopeViolation {
            reason: reason.into(),
        }
    }

    pub fn parse_error(msg: impl Into<String>) -> Self {
        Self::ParseError(msg.into())
    }

    pub fn invariant_violation(msg: impl Into<String>) -> Self {
        Self::InvariantViolation(msg.into())
    }

    pub fn auth_error(msg: impl Into<String>) -> Self {
        Self::AuthError(msg.into())
    }

    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::Timeout(msg.into())
    }

    pub fn invalid_configuration(msg: impl Into<String>) -> Self {
        Self::InvalidConfiguration(msg.into())
    }

    pub fn serialization(msg: impl Into<String>) -> Self {
        Self::Serialization(msg.into())
    }

    pub fn storage(msg: impl Into<String>) -> Self {
        Self::Storage(msg.into())
    }

    pub fn integrity(msg: impl Into<String>) -> Self {
        Self::Integrity(msg.into())
    }
}

impl From<serde_json::Error> for SentinelError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err.to_string())
    }
}

//! Session abstraction models and manager interfaces.

use crate::ids::{SessionId, TargetId};
use crate::request::RawRequest;
use crate::snapshot::ResponseSnapshot;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Error types related to session handling and authentication.
#[derive(Debug, thiserror::Error, Clone, PartialEq, Eq)]
pub enum SessionError {
    #[error("session has expired")]
    Expired,
    #[error("authentication failed: {0}")]
    AuthenticationFailed(String),
    #[error("missing authentication token: {0}")]
    MissingToken(String),
    #[error("invalid session state: {0}")]
    InvalidState(String),
}

/// In-memory state of an active session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionState {
    pub id: SessionId,
    pub target_id: TargetId,
    pub cookies: HashMap<String, String>,
    pub headers: HashMap<String, String>,
    pub auth_token: Option<String>,
    pub is_authenticated: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

impl Zeroize for SessionState {
    fn zeroize(&mut self) {
        if let Some(token) = &mut self.auth_token {
            token.zeroize();
        }
        for v in self.cookies.values_mut() {
            v.zeroize();
        }
        self.cookies.clear();
        for v in self.headers.values_mut() {
            v.zeroize();
        }
        self.headers.clear();
    }
}

impl ZeroizeOnDrop for SessionState {}

impl SessionState {
    pub fn new(target_id: TargetId) -> Self {
        let id = SessionId::derive(&target_id, b"initial_state");
        Self {
            id,
            target_id,
            cookies: HashMap::new(),
            headers: HashMap::new(),
            auth_token: None,
            is_authenticated: false,
            created_at: Utc::now(),
            expires_at: None,
        }
    }

    /// True if the session has an expiration date that is in the past.
    pub fn is_expired(&self) -> bool {
        if let Some(exp) = self.expires_at {
            Utc::now() > exp
        } else {
            false
        }
    }
}

/// Trait defining the lifecycle and request-binding contract of an authentication session.
pub trait SessionManager: Send + Sync {
    /// Injects active session cookies and authorization headers into an outbound request.
    fn apply_to_request(&self, req: &mut RawRequest) -> Result<(), SessionError>;

    /// Extracts updated cookies, CSRF tokens, or bearer tokens from an incoming response snapshot.
    fn extract_from_response(&self, resp: &ResponseSnapshot) -> Result<(), SessionError>;

    /// Checks whether the underlying session remains valid and authenticated.
    fn is_valid(&self) -> bool;

    /// Triggers a proactive refresh of the session credentials.
    fn refresh(&self) -> Result<(), SessionError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_state_creation_and_expiry() {
        let target_id = TargetId::derive("https://target.local");
        let mut session = SessionState::new(target_id);
        assert!(!session.is_expired());

        // Set past expiration
        session.expires_at = Some(Utc::now() - chrono::Duration::hours(1));
        assert!(session.is_expired());
    }

    #[test]
    fn test_session_zeroize() {
        let target_id = TargetId::derive("https://target.local");
        let mut session = SessionState::new(target_id);
        session.auth_token = Some("secret_bearer_token".to_string());
        session
            .headers
            .insert("Authorization".to_string(), "Bearer secret".to_string());

        session.zeroize();
        assert_eq!(session.auth_token.as_deref(), Some(""));
        assert!(session.headers.is_empty());
    }
}

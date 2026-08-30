//! Session Rotation & Fixation Engine
//!
//! Verifies pre-authentication vs post-authentication session token rotation
//! and evaluates session fixation vulnerability where servers accept user-supplied
//! pre-auth session tokens post-authentication.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRotationResult {
    pub is_rotated: bool,
    pub pre_auth_session: String,
    pub post_auth_session: String,
    pub is_vulnerable: bool,
    pub finding_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFixationResult {
    pub fixation_accepted: bool,
    pub fixed_token: String,
    pub post_auth_token: String,
    pub is_vulnerable: bool,
    pub description: String,
}

pub struct SessionRotationEngine;

impl SessionRotationEngine {
    /// Verifies if a session token rotates upon successful authentication / privilege elevation
    pub fn verify_session_rotation(
        pre_auth_cookie: &str,
        post_auth_cookie: &str,
    ) -> SessionRotationResult {
        let is_rotated = !pre_auth_cookie.is_empty()
            && !post_auth_cookie.is_empty()
            && pre_auth_cookie != post_auth_cookie;

        let is_vulnerable = !is_rotated && !pre_auth_cookie.is_empty();

        let finding_title = if is_vulnerable {
            Some("Session Non-Rotation on Authentication / Privilege Transition".to_string())
        } else {
            None
        };

        SessionRotationResult {
            is_rotated,
            pre_auth_session: pre_auth_cookie.to_string(),
            post_auth_session: post_auth_cookie.to_string(),
            is_vulnerable,
            finding_title,
        }
    }

    /// Evaluates whether an arbitrary injected pre-authentication session ID is adopted by the server
    pub fn verify_session_fixation(
        attacker_injected_token: &str,
        post_login_server_token: &str,
    ) -> SessionFixationResult {
        // If post-login server accepts and maintains the exact attacker injected token
        let fixation_accepted = !attacker_injected_token.is_empty()
            && (attacker_injected_token == post_login_server_token
                || post_login_server_token.contains(attacker_injected_token));

        let description = if fixation_accepted {
            format!(
                "Session Fixation Vulnerability: The application accepted and preserved the attacker-supplied session identifier '{}' post-authentication.",
                attacker_injected_token
            )
        } else {
            "Session fixation defense active: Server issued a fresh session identifier upon authentication.".to_string()
        };

        SessionFixationResult {
            fixation_accepted,
            fixed_token: attacker_injected_token.to_string(),
            post_auth_token: post_login_server_token.to_string(),
            is_vulnerable: fixation_accepted,
            description,
        }
    }
}

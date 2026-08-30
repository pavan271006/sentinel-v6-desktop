//! Zeroizing credential container and authorization generator.

use std::collections::HashMap;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Container holding sensitive authentication credentials that automatically zeroizes on drop.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CredentialContainer {
    pub bearer_token: Option<String>,
    pub basic_auth_username: Option<String>,
    pub basic_auth_password: Option<String>,
    pub api_keys: HashMap<String, String>,
    pub csrf_tokens: HashMap<String, String>,
}

impl Zeroize for CredentialContainer {
    fn zeroize(&mut self) {
        if let Some(token) = &mut self.bearer_token {
            token.zeroize();
        }
        if let Some(user) = &mut self.basic_auth_username {
            user.zeroize();
        }
        if let Some(pass) = &mut self.basic_auth_password {
            pass.zeroize();
        }
        for v in self.api_keys.values_mut() {
            v.zeroize();
        }
        self.api_keys.clear();
        for v in self.csrf_tokens.values_mut() {
            v.zeroize();
        }
        self.csrf_tokens.clear();
    }
}

impl ZeroizeOnDrop for CredentialContainer {}

impl CredentialContainer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_bearer_token(&mut self, token: impl Into<String>) {
        self.bearer_token = Some(token.into());
    }

    pub fn set_basic_auth(&mut self, username: impl Into<String>, password: impl Into<String>) {
        self.basic_auth_username = Some(username.into());
        self.basic_auth_password = Some(password.into());
    }

    pub fn set_api_key(&mut self, header_name: impl Into<String>, key: impl Into<String>) {
        self.api_keys.insert(header_name.into(), key.into());
    }

    pub fn set_csrf_token(&mut self, name: impl Into<String>, token: impl Into<String>) {
        self.csrf_tokens.insert(name.into(), token.into());
    }

    /// Produces the standard HTTP Authorization header value if credentials exist.
    pub fn authorization_header(&self) -> Option<String> {
        if let Some(bearer) = &self.bearer_token {
            return Some(format!("Bearer {}", bearer));
        }

        if let (Some(user), Some(pass)) = (&self.basic_auth_username, &self.basic_auth_password) {
            let combined = format!("{}:{}", user, pass);
            let encoded = base64_encode(combined.as_bytes());
            return Some(format!("Basic {}", encoded));
        }

        None
    }
}

/// Simple RFC 4648 Base64 encoder without external dependency.
fn base64_encode(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity(input.len().div_ceil(3) * 4);

    for chunk in input.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        result.push(TABLE[((n >> 18) & 63) as usize] as char);
        result.push(TABLE[((n >> 12) & 63) as usize] as char);

        if chunk.len() > 1 {
            result.push(TABLE[((n >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(TABLE[(n & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_bearer_and_basic_auth() {
        let mut creds = CredentialContainer::new();
        creds.set_bearer_token("eyJhbGciOi...");
        assert_eq!(
            creds.authorization_header().unwrap(),
            "Bearer eyJhbGciOi..."
        );

        let mut basic = CredentialContainer::new();
        basic.set_basic_auth("admin", "secret123");
        assert_eq!(
            basic.authorization_header().unwrap(),
            "Basic YWRtaW46c2VjcmV0MTIz"
        );
    }

    #[test]
    fn test_credential_zeroize() {
        let mut creds = CredentialContainer::new();
        creds.set_bearer_token("secret_token");
        creds.set_api_key("X-API-Key", "super_secret");

        creds.zeroize();
        assert_eq!(creds.bearer_token.as_deref(), Some(""));
        assert!(creds.api_keys.is_empty());
    }
}

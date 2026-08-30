//! Default session manager implementation tying cookies, headers, credentials, and tracking.

use crate::cookie::CookieJar;
use crate::credential::CredentialContainer;
use crate::header::HeaderManager;
use crate::tracker::SessionTracker;
use std::sync::{Arc, RwLock};
use ucma_core::ids::TargetId;
use ucma_core::request::RawRequest;
use ucma_core::session::{SessionError, SessionManager};
use ucma_core::snapshot::ResponseSnapshot;

/// Default session manager orchestrating cookies, auth headers, and session liveness.
#[derive(Debug, Clone)]
pub struct DefaultSessionManager {
    pub target_id: TargetId,
    pub cookie_jar: CookieJar,
    pub header_manager: HeaderManager,
    pub credentials: Arc<RwLock<CredentialContainer>>,
    pub tracker: Arc<RwLock<SessionTracker>>,
}

impl DefaultSessionManager {
    pub fn new(target_id: TargetId) -> Self {
        Self {
            target_id,
            cookie_jar: CookieJar::new(),
            header_manager: HeaderManager::new(),
            credentials: Arc::new(RwLock::new(CredentialContainer::new())),
            tracker: Arc::new(RwLock::new(SessionTracker::new(target_id))),
        }
    }

    /// Configures a bearer token.
    pub fn with_bearer_token(self, token: impl Into<String>) -> Self {
        self.credentials
            .write()
            .expect("lock poisoned")
            .set_bearer_token(token);
        self
    }

    /// Configures an API key.
    pub fn with_api_key(self, header_name: impl Into<String>, key: impl Into<String>) -> Self {
        self.credentials
            .write()
            .expect("lock poisoned")
            .set_api_key(header_name, key);
        self
    }
}

impl SessionManager for DefaultSessionManager {
    fn apply_to_request(&self, req: &mut RawRequest) -> Result<(), SessionError> {
        // 1. Check health
        if !self.is_valid() {
            return Err(SessionError::Expired);
        }

        // 2. Apply headers
        self.header_manager.apply_to_request(req);

        // 3. Apply Authorization header from credentials
        let creds = self.credentials.read().expect("lock poisoned");
        if let Some(auth_header) = creds.authorization_header() {
            req.set_header("Authorization", auth_header);
        }

        // Apply API keys
        for (k, v) in &creds.api_keys {
            req.set_header(k.clone(), v.clone());
        }

        // 4. Apply Cookie header from CookieJar
        if let Some(cookie_str) = self.cookie_jar.cookie_header_for_url(&req.url) {
            req.set_header("Cookie", cookie_str);
        }

        // 5. Track request
        self.tracker
            .write()
            .expect("lock poisoned")
            .record_request();

        Ok(())
    }

    fn extract_from_response(&self, resp: &ResponseSnapshot) -> Result<(), SessionError> {
        // Extract Set-Cookie headers
        let mut tracker = self.tracker.write().expect("lock poisoned");

        if resp.status_code == 401 || resp.status_code == 403 {
            let needs_refresh = tracker.record_auth_failure();
            if needs_refresh {
                return Err(SessionError::AuthenticationFailed(format!(
                    "HTTP {}",
                    resp.status_code
                )));
            }
        } else if resp.is_success() {
            tracker.record_success();
        }

        Ok(())
    }

    fn is_valid(&self) -> bool {
        self.tracker.read().expect("lock poisoned").is_healthy()
    }

    fn refresh(&self) -> Result<(), SessionError> {
        let mut tracker = self.tracker.write().expect("lock poisoned");
        tracker.record_success(); // Reset failure counters on manual refresh
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use ucma_core::endpoint::HttpMethod;
    use ucma_core::ids::RequestId;
    use url::Url;

    #[test]
    fn test_default_session_manager_integration() {
        let target_id = TargetId::derive("https://target.local");
        let manager = DefaultSessionManager::new(target_id).with_bearer_token("test_jwt_123");

        let mut req = RawRequest::from_url(
            target_id,
            HttpMethod::Get,
            Url::parse("https://target.local/api/data").unwrap(),
        );

        assert!(manager.apply_to_request(&mut req).is_ok());
        assert_eq!(
            req.headers.get("Authorization").unwrap(),
            "Bearer test_jwt_123"
        );

        // Simulate 401 errors
        let req_id = RequestId::from_bytes([0u8; 32]);
        let resp_401 = ResponseSnapshot::new(
            req_id,
            401,
            HashMap::new(),
            b"".to_vec(),
            10_000,
            b"HTTP/1.1 401 Unauthorized\r\n\r\n",
            false,
            None,
        );

        assert!(manager.extract_from_response(&resp_401).is_ok()); // failure 1
        assert!(manager.extract_from_response(&resp_401).is_ok()); // failure 2
        assert!(manager.extract_from_response(&resp_401).is_err()); // failure 3 -> triggers err
        assert!(!manager.is_valid());
    }
}

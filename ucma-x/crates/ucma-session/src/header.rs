//! HTTP Header management, defaults, and custom header injection.

use std::collections::HashMap;
use ucma_core::request::RawRequest;

/// Manager for default and session-level HTTP headers.
#[derive(Debug, Clone, Default)]
pub struct HeaderManager {
    default_headers: HashMap<String, String>,
    custom_headers: HashMap<String, String>,
}

impl HeaderManager {
    pub fn new() -> Self {
        let mut default_headers = HashMap::new();
        default_headers.insert(
            "User-Agent".to_string(),
            "UCMA-X/0.1.0 (Security Engine)".to_string(),
        );
        default_headers.insert("Accept".to_string(), "*/*".to_string());

        Self {
            default_headers,
            custom_headers: HashMap::new(),
        }
    }

    /// Sets a default header.
    pub fn set_default_header(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.default_headers.insert(name.into(), value.into());
    }

    /// Sets a custom header.
    pub fn set_custom_header(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.custom_headers.insert(name.into(), value.into());
    }

    /// Injects configured headers into an outbound RawRequest without overwriting existing request headers.
    pub fn apply_to_request(&self, req: &mut RawRequest) {
        // Apply defaults first if not already present
        for (k, v) in &self.default_headers {
            if !req.headers.contains_key(k) {
                req.set_header(k.clone(), v.clone());
            }
        }

        // Apply custom headers
        for (k, v) in &self.custom_headers {
            req.set_header(k.clone(), v.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_core::endpoint::HttpMethod;
    use ucma_core::ids::TargetId;
    use url::Url;

    #[test]
    fn test_header_manager_apply() {
        let mut mgr = HeaderManager::new();
        mgr.set_custom_header("X-Custom-Scan", "true");

        let target_id = TargetId::derive("https://target.local");
        let mut req = RawRequest::from_url(
            target_id,
            HttpMethod::Get,
            Url::parse("https://target.local/api").unwrap(),
        );

        mgr.apply_to_request(&mut req);
        assert_eq!(
            req.headers.get("User-Agent").unwrap(),
            "UCMA-X/0.1.0 (Security Engine)"
        );
        assert_eq!(req.headers.get("X-Custom-Scan").unwrap(), "true");
    }
}

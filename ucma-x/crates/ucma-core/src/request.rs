//! Request models representing raw network request specifications.

use crate::endpoint::HttpMethod;
use crate::ids::{EndpointId, RequestId, TargetId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;

/// Raw HTTP request representation prior to scope authorization and dispatch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RawRequest {
    pub id: RequestId,
    pub target_id: TargetId,
    pub endpoint_id: EndpointId,
    pub method: HttpMethod,
    pub url: Url,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub timestamp: DateTime<Utc>,
}

impl RawRequest {
    /// Creates a new RawRequest from target, method, and URL (derives endpoint ID automatically).
    pub fn new(target_id: TargetId, method: HttpMethod, url: Url) -> Self {
        let endpoint_id = EndpointId::derive(&target_id, method.as_str(), url.path());
        let body = Vec::new();
        let id = RequestId::derive(&endpoint_id, method.as_str(), url.as_str(), &body);
        Self {
            id,
            target_id,
            endpoint_id,
            method,
            url,
            headers: HashMap::new(),
            body,
            timestamp: Utc::now(),
        }
    }

    /// Convenience alias to `new`.
    pub fn from_url(target_id: TargetId, method: HttpMethod, url: Url) -> Self {
        Self::new(target_id, method, url)
    }

    /// Creates a new RawRequest with explicit EndpointId.
    pub fn with_endpoint(
        target_id: TargetId,
        endpoint_id: EndpointId,
        method: HttpMethod,
        url: Url,
    ) -> Self {
        let body = Vec::new();
        let id = RequestId::derive(&endpoint_id, method.as_str(), url.as_str(), &body);
        Self {
            id,
            target_id,
            endpoint_id,
            method,
            url,
            headers: HashMap::new(),
            body,
            timestamp: Utc::now(),
        }
    }

    /// Sets the request body and re-derives the RequestId.
    pub fn set_body(&mut self, body: impl Into<Vec<u8>>) {
        self.body = body.into();
        self.id = RequestId::derive(
            &self.endpoint_id,
            self.method.as_str(),
            self.url.as_str(),
            &self.body,
        );
    }

    /// Adds a header to the request.
    pub fn set_header(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.headers.insert(name.into(), value.into());
    }

    /// Builder method for adding headers.
    pub fn with_header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.set_header(name, value);
        self
    }

    /// Builder method for setting body.
    pub fn with_body(mut self, body: impl Into<Vec<u8>>) -> Self {
        self.set_body(body);
        self
    }

    /// Returns the body as a UTF-8 string if valid.
    pub fn body_str(&self) -> Option<&str> {
        std::str::from_utf8(&self.body).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raw_request_creation() {
        let target_id = TargetId::derive("https://target.local");
        let url = Url::parse("https://target.local/api/items?id=123").unwrap();

        let req = RawRequest::new(target_id, HttpMethod::Get, url)
            .with_header("Accept", "application/json")
            .with_body(b"payload".to_vec());

        assert_eq!(req.headers.get("Accept").unwrap(), "application/json");
        assert_eq!(req.body_str().unwrap(), "payload");
    }
}

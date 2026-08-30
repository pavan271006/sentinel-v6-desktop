//! Response snapshot models capturing immutable wire-level execution evidence.

use crate::ids::{ContentId, RequestId, SnapshotId};
use crate::request::RawRequest;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// An immutable snapshot of an HTTP response with BLAKE3 cryptographic integrity hashes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResponseSnapshot {
    pub id: SnapshotId,
    pub request_id: RequestId,
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub latency_nanos: u64,
    pub blake3_body_hash: ContentId,
    pub blake3_raw_wire_hash: ContentId,
    pub timestamp: DateTime<Utc>,
    pub truncated: bool,
    pub remote_ip: Option<String>,
}

impl ResponseSnapshot {
    /// Creates a new ResponseSnapshot and computes all cryptographic hashes.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        request_id: RequestId,
        status_code: u16,
        headers: HashMap<String, String>,
        body: Vec<u8>,
        latency_nanos: u64,
        raw_wire_bytes: &[u8],
        truncated: bool,
        remote_ip: Option<String>,
    ) -> Self {
        let blake3_body_hash = ContentId::from_data(&body);
        let blake3_raw_wire_hash = ContentId::from_data(raw_wire_bytes);
        let id = SnapshotId::derive(&request_id, status_code, raw_wire_bytes);

        Self {
            id,
            request_id,
            status_code,
            headers,
            body,
            latency_nanos,
            blake3_body_hash,
            blake3_raw_wire_hash,
            timestamp: Utc::now(),
            truncated,
            remote_ip,
        }
    }

    /// Returns the body as a UTF-8 string slice if valid.
    pub fn body_str(&self) -> Option<&str> {
        std::str::from_utf8(&self.body).ok()
    }

    /// True if HTTP status is 2xx.
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status_code)
    }

    /// True if HTTP status is 3xx.
    pub fn is_redirect(&self) -> bool {
        (300..400).contains(&self.status_code)
    }

    /// True if HTTP status is 4xx.
    pub fn is_client_error(&self) -> bool {
        (400..500).contains(&self.status_code)
    }

    /// True if HTTP status is 5xx.
    pub fn is_server_error(&self) -> bool {
        (500..600).contains(&self.status_code)
    }

    /// Returns the Content-Type header if present.
    pub fn content_type(&self) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("content-type"))
            .map(|(_, v)| v.as_str())
    }

    /// Returns the body byte length.
    pub fn content_length(&self) -> usize {
        self.body.len()
    }
}

/// A combined pair linking a request and its resulting response snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HttpSnapshotPair {
    pub request: RawRequest,
    pub response: ResponseSnapshot,
}

impl HttpSnapshotPair {
    pub fn new(request: RawRequest, response: ResponseSnapshot) -> Self {
        Self { request, response }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::endpoint::HttpMethod;
    use crate::ids::TargetId;
    use url::Url;

    #[test]
    fn test_response_snapshot_hashing() {
        let target_id = TargetId::derive("https://target.local");
        let req = RawRequest::from_url(
            target_id,
            HttpMethod::Get,
            Url::parse("https://target.local/").unwrap(),
        );

        let raw_wire = b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello";
        let body = b"hello".to_vec();
        let mut headers = HashMap::new();
        headers.insert("content-length".to_string(), "5".to_string());

        let snapshot = ResponseSnapshot::new(
            req.id,
            200,
            headers,
            body.clone(),
            15_000_000,
            raw_wire,
            false,
            Some("192.0.2.1".to_string()),
        );

        assert_eq!(snapshot.status_code, 200);
        assert!(snapshot.is_success());
        assert_eq!(snapshot.body_str().unwrap(), "hello");
        assert_eq!(snapshot.blake3_body_hash, ContentId::from_data(&body));
        assert_eq!(
            snapshot.blake3_raw_wire_hash,
            ContentId::from_data(raw_wire)
        );
    }
}

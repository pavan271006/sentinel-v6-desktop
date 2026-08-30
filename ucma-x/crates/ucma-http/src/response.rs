//! Response wire data capture and formatting helpers.

use std::collections::HashMap;

/// Raw wire-level response container.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawWireResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub raw_wire_bytes: Vec<u8>,
    pub latency_nanos: u64,
    pub truncated: bool,
    pub remote_ip: Option<String>,
}

impl RawWireResponse {
    /// Synthesizes canonical wire bytes from status, headers, and body.
    pub fn synthesize_wire_bytes(
        status_code: u16,
        headers: &HashMap<String, String>,
        body: &[u8],
    ) -> Vec<u8> {
        let reason = match status_code {
            200 => "OK",
            201 => "Created",
            204 => "No Content",
            301 => "Moved Permanently",
            302 => "Found",
            304 => "Not Modified",
            307 => "Temporary Redirect",
            308 => "Permanent Redirect",
            400 => "Bad Request",
            401 => "Unauthorized",
            403 => "Forbidden",
            404 => "Not Found",
            405 => "Method Not Allowed",
            429 => "Too Many Requests",
            500 => "Internal Server Error",
            502 => "Bad Gateway",
            503 => "Service Unavailable",
            504 => "Gateway Timeout",
            _ => "Status",
        };

        let mut wire = Vec::new();
        wire.extend_from_slice(format!("HTTP/1.1 {} {}\r\n", status_code, reason).as_bytes());

        // Sort header keys for deterministic wire hashing
        let mut sorted_headers: Vec<(&String, &String)> = headers.iter().collect();
        sorted_headers.sort_by(|a, b| a.0.cmp(b.0));

        for (k, v) in sorted_headers {
            wire.extend_from_slice(format!("{}: {}\r\n", k, v).as_bytes());
        }
        wire.extend_from_slice(b"\r\n");
        wire.extend_from_slice(body);

        wire
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_synthesize_wire_bytes() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "text/plain".to_string());
        let body = b"hello world";

        let wire = RawWireResponse::synthesize_wire_bytes(200, &headers, body);
        let wire_str = String::from_utf8(wire).unwrap();
        assert!(wire_str.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(wire_str.contains("Content-Type: text/plain\r\n"));
        assert!(wire_str.ends_with("\r\n\r\nhello world"));
    }
}

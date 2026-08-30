//! SEC-10 Triple Representation Roundtrip Invariant Tests
//!
//! Asserts that `serialize(parse(raw)) == raw` for compliant and well-formed HTTP messages.

use sentinel_common::traits::HttpParser;
use sentinel_parser::SentinelHttpParser;

#[test]
fn test_roundtrip_get_request() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /v1/health HTTP/1.1\r\nHost: api.target.corp\r\nUser-Agent: Sentinel/6.0\r\nAccept: */*\r\n\r\n";

    let parsed = parser.parse_request(raw).expect("Parsing should succeed");
    let serialized = parser
        .serialize_request(&parsed)
        .expect("Serialization should succeed");

    assert_eq!(
        serialized, raw,
        "SEC-10 Invariant Violation: serialize(parse(raw)) must equal raw"
    );
}

#[test]
fn test_roundtrip_post_request_with_body() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST /api/v1/auth/login HTTP/1.1\r\nHost: auth.example.com\r\nContent-Type: application/json\r\nContent-Length: 32\r\n\r\n{\"user\":\"admin\",\"pass\":\"secret\"}";

    let parsed = parser.parse_request(raw).expect("Parsing should succeed");
    let serialized = parser
        .serialize_request(&parsed)
        .expect("Serialization should succeed");

    assert_eq!(
        serialized, raw,
        "SEC-10 Invariant Violation: Request body and headers must be byte-exact"
    );
}

#[test]
fn test_roundtrip_response_200_ok() {
    let parser = SentinelHttpParser::new();
    let raw = b"HTTP/1.1 200 OK\r\nServer: Sentinel/6.0\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}";

    let parsed = parser.parse_response(raw).expect("Parsing should succeed");
    let serialized = parser
        .serialize_response(&parsed)
        .expect("Serialization should succeed");

    assert_eq!(
        serialized, raw,
        "SEC-10 Invariant Violation: Response must be byte-exact"
    );
}

#[test]
fn test_roundtrip_response_404_not_found() {
    let parser = SentinelHttpParser::new();
    let raw = b"HTTP/1.1 404 Not Found\r\nServer: Sentinel/6.0\r\nContent-Length: 0\r\n\r\n";

    let parsed = parser.parse_response(raw).expect("Parsing should succeed");
    let serialized = parser
        .serialize_response(&parsed)
        .expect("Serialization should succeed");

    assert_eq!(
        serialized, raw,
        "SEC-10 Invariant Violation: 404 response must match byte-exact"
    );
}

#[test]
fn test_roundtrip_custom_headers_order() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /custom HTTP/1.1\r\nX-Sentinel-Node: worker-1\r\nX-Sentinel-Trace: tr-999\r\nX-Custom-Auth: token\r\n\r\n";

    let parsed = parser.parse_request(raw).expect("Parsing should succeed");
    let serialized = parser
        .serialize_request(&parsed)
        .expect("Serialization should succeed");

    assert_eq!(
        serialized, raw,
        "SEC-10 Invariant Violation: Header order must be strictly preserved"
    );
}

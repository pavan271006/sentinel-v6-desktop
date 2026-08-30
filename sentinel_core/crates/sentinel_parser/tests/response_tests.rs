//! Unit tests for HTTP response parsing

use sentinel_common::traits::HttpParser;
use sentinel_parser::SentinelHttpParser;

#[test]
fn test_parse_200_ok_response() {
    let parser = SentinelHttpParser::new();
    let raw = b"HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Type: text/html\r\nContent-Length: 14\r\n\r\n<h1>Hello</h1>";

    let res = parser
        .parse_response(raw)
        .expect("Response parsing should succeed");
    assert_eq!(res.version, "HTTP/1.1");
    assert_eq!(res.status_code, 200);
    assert_eq!(res.reason, "OK");
    assert_eq!(res.headers.len(), 3);
    assert_eq!(res.body, b"<h1>Hello</h1>");
}

#[test]
fn test_parse_404_not_found() {
    let parser = SentinelHttpParser::new();
    let raw = b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";

    let res = parser
        .parse_response(raw)
        .expect("404 response should parse");
    assert_eq!(res.status_code, 404);
    assert_eq!(res.reason, "Not Found");
    assert!(res.body.is_empty());
}

#[test]
fn test_parse_response_without_reason_phrase() {
    let parser = SentinelHttpParser::new();
    let raw = b"HTTP/1.1 200\r\nContent-Length: 4\r\n\r\npong";

    let res = parser
        .parse_response(raw)
        .expect("Response without reason should parse");
    assert_eq!(res.status_code, 200);
    assert_eq!(res.reason, "");
    assert_eq!(res.body, b"pong");
}

#[test]
fn test_rfc_9112_204_and_304_empty_body_guarantee() {
    let parser = SentinelHttpParser::new();
    let raw = b"HTTP/1.1 204 No Content\r\nServer: sentinel\r\n\r\n";

    let res = parser
        .parse_response(raw)
        .expect("204 response should parse");
    assert_eq!(res.status_code, 204);
    assert!(res.body.is_empty());

    let raw_304 = b"HTTP/1.1 304 Not Modified\r\nETag: \"abcdef\"\r\n\r\n";
    let res_304 = parser
        .parse_response(raw_304)
        .expect("304 response should parse");
    assert_eq!(res_304.status_code, 304);
    assert!(res_304.body.is_empty());
}

#[test]
fn test_response_streaming_until_eof() {
    let parser = SentinelHttpParser::new();
    let raw =
        b"HTTP/1.0 200 OK\r\nContent-Type: text/plain\r\n\r\nRaw stream payload without length";

    let res = parser
        .parse_response(raw)
        .expect("EOF response should parse");
    assert_eq!(res.status_code, 200);
    assert_eq!(res.body, b"Raw stream payload without length");
}

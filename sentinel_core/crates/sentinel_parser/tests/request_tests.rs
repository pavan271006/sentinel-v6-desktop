//! Unit tests for HTTP request parsing

use sentinel_common::enums::HttpMethod;
use sentinel_common::traits::HttpParser;
use sentinel_parser::SentinelHttpParser;

#[test]
fn test_parse_simple_get_request() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\nUser-Agent: sentinel/6.0\r\n\r\n";

    let req = parser.parse_request(raw).expect("Parsing should succeed");
    assert_eq!(req.method, HttpMethod::GET);
    assert_eq!(req.uri, "/index.html");
    assert_eq!(req.version, "HTTP/1.1");
    assert_eq!(req.headers.len(), 2);
    assert_eq!(req.headers[0].0, b"Host");
    assert_eq!(req.headers[0].1, b"example.com");
    assert_eq!(req.headers[1].0, b"User-Agent");
    assert_eq!(req.headers[1].1, b"sentinel/6.0");
    assert!(req.body.is_empty());
}

#[test]
fn test_parse_post_with_content_length_body() {
    let parser = SentinelHttpParser::new();
    let raw = b"POST /api/login HTTP/1.1\r\nHost: auth.target.corp\r\nContent-Type: application/json\r\nContent-Length: 18\r\n\r\n{\"user\":\"sec_ops\"}";

    let req = parser.parse_request(raw).expect("Parsing should succeed");
    assert_eq!(req.method, HttpMethod::POST);
    assert_eq!(req.uri, "/api/login");
    assert_eq!(req.body, b"{\"user\":\"sec_ops\"}");
}

#[test]
fn test_parse_bare_lf_line_endings() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /test HTTP/1.1\nHost: target.com\nAccept: */*\n\n";

    let req = parser
        .parse_request(raw)
        .expect("Bare LF should parse cleanly");
    assert_eq!(req.method, HttpMethod::GET);
    assert_eq!(req.uri, "/test");
    assert_eq!(req.headers.len(), 2);
}

#[test]
fn test_parse_http_09_simple_request() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /legacy_page\r\n";

    let req = parser
        .parse_request(raw)
        .expect("HTTP/0.9 request should parse");
    assert_eq!(req.method, HttpMethod::GET);
    assert_eq!(req.uri, "/legacy_page");
    assert_eq!(req.version, "HTTP/0.9");
}

#[test]
fn test_parse_graphql_method() {
    let parser = SentinelHttpParser::new();
    let raw = b"GRAPHQL /graphql HTTP/1.1\r\nHost: api.example.com\r\nContent-Length: 17\r\n\r\n{ query: __schema }";

    let req = parser
        .parse_request(raw)
        .expect("GRAPHQL method should parse");
    assert_eq!(req.method, HttpMethod::GRAPHQL);
}

#[test]
fn test_parse_connect_request() {
    let parser = SentinelHttpParser::new();
    let raw = b"CONNECT target.internal:443 HTTP/1.1\r\nHost: target.internal:443\r\nProxy-Connection: keep-alive\r\n\r\n";

    let req = parser
        .parse_request(raw)
        .expect("CONNECT request should parse");
    assert_eq!(req.method, HttpMethod::CONNECT);
    assert_eq!(req.uri, "target.internal:443");
}

#[test]
fn test_preserve_header_case_and_duplicate_order() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /multi HTTP/1.1\r\nSet-Cookie: session=123\r\nset-cookie: theme=dark\r\nSET-COOKIE: debug=true\r\n\r\n";

    let rich = parser
        .parse_request_rich(raw)
        .expect("Parsing should succeed");
    assert_eq!(rich.headers.len(), 3);
    assert_eq!(rich.headers[0].name, b"Set-Cookie");
    assert_eq!(rich.headers[1].name, b"set-cookie");
    assert_eq!(rich.headers[2].name, b"SET-COOKIE");
}

#[test]
fn test_oversized_payload_rejection() {
    let parser = SentinelHttpParser::with_max_body_size(1024); // 1KB limit
    let raw = format!(
        "POST /upload HTTP/1.1\r\nHost: test.com\r\nContent-Length: 5000\r\n\r\n{}",
        "A".repeat(5000)
    );

    let res = parser.parse_request(raw.as_bytes());
    assert!(res.is_err());
}

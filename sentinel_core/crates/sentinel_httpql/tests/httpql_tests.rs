//! Comprehensive Test Suite for HTTPQL Engine

use sentinel_common::enums::HttpMethod;
use sentinel_common::operational::{ParsedRequest, ParsedResponse};
use sentinel_httpql::{
    compile_to_sql, evaluate_query, parse_query, ComparisonOp, Expression, Field, LogicalOp,
    SqlParam, Value,
};

fn mock_request() -> ParsedRequest {
    ParsedRequest {
        method: HttpMethod::POST,
        uri: "https://api.target.com/v1/auth/login?debug=true".to_string(),
        version: "HTTP/1.1".to_string(),
        headers: vec![
            (b"Host".to_vec(), b"api.target.com".to_vec()),
            (b"Content-Type".to_vec(), b"application/json".to_vec()),
            (b"User-Agent".to_vec(), b"Mozilla/5.0 Sentinel".to_vec()),
            (
                b"Authorization".to_vec(),
                b"Bearer secret_token_123".to_vec(),
            ),
        ],
        body: b"{\"username\":\"admin\",\"password\":\"password123\"}".to_vec(),
    }
}

fn mock_response() -> ParsedResponse {
    ParsedResponse {
        version: "HTTP/1.1".to_string(),
        status_code: 200,
        reason: "OK".to_string(),
        headers: vec![
            (b"Content-Type".to_vec(), b"application/json".to_vec()),
            (b"Server".to_vec(), b"nginx/1.24".to_vec()),
            (
                b"Set-Cookie".to_vec(),
                b"session=abc123xyz; Path=/; HttpOnly".to_vec(),
            ),
        ],
        body: b"{\"status\":\"success\",\"user_id\":42}".to_vec(),
    }
}

#[test]
fn test_httpql_basic_parsing() {
    let q = "req.method == \"POST\" && resp.status == 200";
    let expr = parse_query(q).unwrap();

    match expr {
        Expression::Binary { left, op, right } => {
            assert_eq!(op, LogicalOp::And);
            assert_eq!(
                *left,
                Expression::Comparison {
                    field: Field::ReqMethod,
                    op: ComparisonOp::Eq,
                    value: Value::String("POST".to_string()),
                }
            );
            assert_eq!(
                *right,
                Expression::Comparison {
                    field: Field::RespStatus,
                    op: ComparisonOp::Eq,
                    value: Value::Number(200),
                }
            );
        }
        _ => panic!("Expected Binary expression"),
    }
}

#[test]
fn test_httpql_in_memory_evaluation_matches() {
    let req = mock_request();
    let resp = mock_response();

    let queries = [
        "req.method == POST",
        "req.path contains \"/auth/login\"",
        "req.host == \"api.target.com\"",
        "req.headers.authorization contains \"Bearer\"",
        "req.body contains \"admin\"",
        "resp.status == 200",
        "resp.status >= 200 && resp.status < 300",
        "resp.headers.server contains \"nginx\"",
        "resp.body contains \"user_id\"",
        "req.method == POST && resp.status == 200 && req.headers.content-type contains \"json\"",
        "req.method in [GET, POST, PUT]",
        "resp.status in [200, 201, 204]",
    ];

    for q in &queries {
        let matched = evaluate_query(q, &req, Some(&resp)).unwrap();
        assert!(matched, "Query '{}' should evaluate to true", q);
    }
}

#[test]
fn test_httpql_in_memory_evaluation_mismatches() {
    let req = mock_request();
    let resp = mock_response();

    let non_matching = [
        "req.method == GET",
        "req.path contains \"/admin/secret\"",
        "resp.status >= 400",
        "resp.status in [401, 403, 404, 500]",
        "req.headers.authorization contains \"Basic\"",
        "!(req.method == POST)",
        "req.method not in [POST, PUT]",
    ];

    for q in &non_matching {
        let matched = evaluate_query(q, &req, Some(&resp)).unwrap();
        assert!(!matched, "Query '{}' should evaluate to false", q);
    }
}

#[test]
fn test_httpql_regex_matching() {
    let req = mock_request();
    let resp = mock_response();

    let q1 = "req.uri matches \"^https://api\\.target\\.com/.*\"";
    assert!(evaluate_query(q1, &req, Some(&resp)).unwrap());

    let q2 = "req.body matches \".*\\\"password\\\":\\\"[^\\\"]+\\\".*\"";
    assert!(evaluate_query(q2, &req, Some(&resp)).unwrap());

    let q3 = "resp.headers.set-cookie matches \"session=[a-z0-9]+\"";
    assert!(evaluate_query(q3, &req, Some(&resp)).unwrap());
}

#[test]
fn test_httpql_sql_compilation() {
    let q = "req.method == \"POST\" && resp.status >= 400 && req.host contains \"target\"";
    let compiled = compile_to_sql(q).unwrap();

    assert_eq!(
        compiled.where_clause,
        "((method = ? AND status_code >= ?) AND host LIKE ?)"
    );
    assert_eq!(compiled.params.len(), 3);
    assert_eq!(compiled.params[0], SqlParam::Text("POST".to_string()));
    assert_eq!(compiled.params[1], SqlParam::Integer(400));
    assert_eq!(compiled.params[2], SqlParam::Text("%target%".to_string()));
}

#[test]
fn test_httpql_nested_boolean_logic() {
    let req = mock_request();
    let resp = mock_response();

    let q =
        "(req.method == GET || req.method == POST) && (resp.status == 200 || resp.status == 201)";
    assert!(evaluate_query(q, &req, Some(&resp)).unwrap());

    let q2 = "!(req.method == GET && resp.status == 404)";
    assert!(evaluate_query(q2, &req, Some(&resp)).unwrap());
}

#[test]
fn test_httpql_empty_query_returns_true() {
    let req = mock_request();
    assert!(evaluate_query("", &req, None).unwrap());
    assert!(evaluate_query("   ", &req, None).unwrap());
}

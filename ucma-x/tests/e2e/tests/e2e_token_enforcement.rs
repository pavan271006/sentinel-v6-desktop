//! Opaque-Box E2E Suite: Capability Token Gating, Cryptographic Signatures, and Liveness.

use std::sync::Arc;
use ucma_core::endpoint::HttpMethod;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns, create_test_request};
use ucma_http::client::{HttpError, SafeHttpClient};
use ucma_http::limits::HttpLimits;
use ucma_scope::ScopeError;
use ucma_scope::policy::ScopePolicy;

#[tokio::test]
async fn test_e2e_capability_token_structure_and_minting() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://example.com/orders?user=42", HttpMethod::Get);
    let token = policy
        .authorize(req)
        .await
        .expect("token minting must succeed");

    assert_eq!(
        token.target_url().as_str(),
        "https://example.com/orders?user=42"
    );
    assert_eq!(token.resolved_ips().len(), 1);
    assert!(!token.is_expired());
    assert!(token.signature().iter().any(|&b| b != 0));

    // Verify token signature against policy internal salt
    assert!(policy.verify_token(&token).is_ok());
}

#[tokio::test]
async fn test_e2e_token_signature_fails_on_tampering() {
    use ucma_core::ids::{EndpointId, RequestId, TargetId};

    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://example.com/safe/path", HttpMethod::Get);
    let mut token = policy
        .authorize(req)
        .await
        .expect("token minting must succeed");

    // Tamper with inner request ID and URL
    let tampered_target = TargetId::derive("https://example.com/evil");
    let tampered_ep = EndpointId::derive(&tampered_target, "GET", "/evil");
    token.request_mut().id =
        RequestId::derive(&tampered_ep, "GET", "https://example.com/evil", b"");
    token.request_mut().url = "https://example.com/evil".parse().unwrap();

    // Verify token check fails on tampered RequestId / signature mismatch
    let verify_res = policy.verify_token(&token);
    assert!(verify_res.is_err());
    assert!(matches!(
        verify_res.unwrap_err(),
        ScopeError::InvalidCapabilityToken
    ));
}

#[tokio::test]
async fn test_e2e_foreign_policy_token_rejected() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy_a = Arc::new(
        ScopePolicy::builder()
            .allow_host("example.com")
            .with_resolver(resolver.clone())
            .with_salt([1u8; 32])
            .build(),
    );
    let policy_b = Arc::new(
        ScopePolicy::builder()
            .allow_host("example.com")
            .with_resolver(resolver)
            .with_salt([2u8; 32]) // Different cryptographic salt
            .build(),
    );

    let client_a = SafeHttpClient::new(HttpLimits::default(), policy_a.clone()).unwrap();

    // Token minted by policy B
    let token_b = policy_b
        .authorize_url("https://example.com/api")
        .await
        .unwrap();

    // Client A dispatches token B -> must fail closed with ScopeError::InvalidCapabilityToken
    let send_res = client_a.send(token_b).await;
    assert!(send_res.is_err());
    assert!(matches!(
        send_res.unwrap_err(),
        HttpError::Scope(ScopeError::InvalidCapabilityToken)
    ));
}

#[tokio::test]
async fn test_e2e_expired_token_rejected() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("example.com")
            .with_resolver(resolver)
            .with_salt([42u8; 32])
            .token_ttl_seconds(-10) // Negative TTL -> already expired!
            .build(),
    );

    let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();
    let token = policy
        .authorize_url("https://example.com/api")
        .await
        .unwrap();

    assert!(token.is_expired());
    let send_res = client.send(token).await;
    assert!(send_res.is_err());
    assert!(matches!(
        send_res.unwrap_err(),
        HttpError::Scope(ScopeError::ExpiredCapabilityToken(_))
    ));
}

#[tokio::test]
async fn test_e2e_headers_and_body_preservation_in_authorized_request() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = build_standard_test_policy(resolver);

    let mut req = create_test_request("https://example.com/upload", HttpMethod::Post);
    req.headers
        .insert("content-type".to_string(), "application/json".to_string());
    req.headers
        .insert("x-trace-id".to_string(), "trace-12345".to_string());
    req.body = br#"{"payload": "test_data"}"#.to_vec();

    let token = policy.authorize(req).await.unwrap();

    assert_eq!(
        token.request().headers.get("content-type").unwrap(),
        "application/json"
    );
    assert_eq!(
        token.request().headers.get("x-trace-id").unwrap(),
        "trace-12345"
    );
    assert_eq!(token.request().body, br#"{"payload": "test_data"}"#);
}

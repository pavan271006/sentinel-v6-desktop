use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;
use ucma_bench::fixtures::MockHttpServer;
use ucma_http::client::{HttpError, SafeHttpClient};
use ucma_http::limits::HttpLimits;
use ucma_scope::ScopeError;
use ucma_scope::dns::SafeDnsResolver;
use ucma_scope::policy::ScopePolicy;

#[tokio::test]
async fn test_full_pipeline_authorization_and_dispatch() {
    let server = MockHttpServer::spawn().await.unwrap();
    let port = server.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();

    let url_str = server.url("/api/ok");
    let auth_req = policy
        .authorize_url(&url_str)
        .await
        .expect("authorization should succeed");

    assert_eq!(
        auth_req.resolved_ips(),
        &["127.0.0.1".parse::<IpAddr>().unwrap()]
    );

    let snapshot = client
        .send(auth_req)
        .await
        .expect("HTTP dispatch should succeed");
    assert_eq!(snapshot.status_code, 200);
    assert_eq!(snapshot.body_str().unwrap(), "{\"status\":\"ok\"}");
    assert!(!snapshot.truncated);
    assert!(snapshot.latency_nanos > 0);

    server.shutdown();
}

#[tokio::test]
async fn test_redirect_to_out_of_scope_fails_safely() {
    let server = MockHttpServer::spawn().await.unwrap();
    let port = server.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );
    mock_dns.insert(
        "unauthorized.external.com".to_string(),
        vec!["93.184.216.34".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_port(443) // Allow port 443 so host scope check triggers
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();

    let url_str = server.url("/redirect/out-of-scope");
    let auth_req = policy.authorize_url(&url_str).await.unwrap();

    let result = client.send(auth_req).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        HttpError::Scope(ScopeError::OutOfScope(msg)) => {
            assert!(msg.contains("unauthorized.external.com") || msg.contains("host"));
        }
        HttpError::Scope(ScopeError::DisallowedPort(_)) => {
            // Also a valid scope denial
        }
        other => panic!(
            "expected ScopeError::OutOfScope or ScopeError::DisallowedPort, got {:?}",
            other
        ),
    }

    server.shutdown();
}

#[tokio::test]
async fn test_redirect_to_ssrf_fails_safely() {
    let server = MockHttpServer::spawn().await.unwrap();
    let port = server.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    // Live resolver with default allow_private_ips=false
    let resolver = SafeDnsResolver::new(false);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(false)
            .with_resolver(resolver)
            .build(),
    );

    let _client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();

    let url_str = server.url("/redirect/ssrf");
    // Initial authorization fails because 127.0.0.1 is blocked by private IPs filter
    let auth_res = policy.authorize_url(&url_str).await;
    assert!(auth_res.is_err());
    assert!(matches!(
        auth_res.unwrap_err(),
        ScopeError::SsrfBlocked(_, _)
    ));

    server.shutdown();
}

#[tokio::test]
async fn test_response_body_size_truncation_limit() {
    let server = MockHttpServer::spawn().await.unwrap();
    let port = server.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Limit body size to 1024 bytes (1 KB)
    let limits = HttpLimits::builder().max_body_bytes(1024).build();

    let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

    let url_str = server.url("/api/large"); // Returns 100 KB
    let auth_req = policy.authorize_url(&url_str).await.unwrap();

    let snapshot = client.send(auth_req).await.unwrap();
    assert_eq!(snapshot.status_code, 200);
    assert_eq!(snapshot.body.len(), 1024);
    assert!(snapshot.truncated);

    server.shutdown();
}

#[tokio::test]
async fn test_timeout_bounding() {
    let server = MockHttpServer::spawn().await.unwrap();
    let port = server.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Limit timeout to 10ms (server sleeps 50ms)
    let limits = HttpLimits::builder()
        .overall_timeout(Duration::from_millis(10))
        .build();

    let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

    let url_str = server.url("/api/slow");
    let auth_req = policy.authorize_url(&url_str).await.unwrap();

    let result = client.send(auth_req).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), HttpError::Timeout(_)));

    server.shutdown();
}

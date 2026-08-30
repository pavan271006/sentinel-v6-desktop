import os

tests_dir = r"c:\Users\Legion 5 pro\Desktop\cyber sec\ucma-x\tests\e2e\tests"
os.makedirs(tests_dir, exist_ok=True)

# 1. e2e_scope_ssrf.rs
e2e_scope_ssrf = """//! Opaque-Box E2E Suite: Scope Compliance, URL Canonicalization, and Anti-SSRF Enforcement.

use std::net::IpAddr;
use ucma_core::endpoint::HttpMethod;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns, create_test_request};
use ucma_scope::canonicalize::canonicalize;
use ucma_scope::dns::IpValidator;
use ucma_scope::policy::ScopePolicy;
use ucma_scope::ScopeError;

#[tokio::test]
async fn test_e2e_exact_domain_matching_in_scope() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://example.com/api/v1/resource", HttpMethod::Get);
    let auth_res = policy.authorize(req).await;

    assert!(auth_res.is_ok(), "in-scope request must be authorized");
    let auth_token = auth_res.unwrap();
    assert_eq!(auth_token.target_url().host_str().unwrap(), "example.com");
    assert_eq!(auth_token.resolved_ips(), &["93.184.216.34".parse::<IpAddr>().unwrap()]);
}

#[tokio::test]
async fn test_e2e_wildcard_subdomain_matching() {
    let resolver = create_mock_dns(
        vec![
            ("api.target.com", vec!["93.184.216.35"]),
            ("auth.target.com", vec!["93.184.216.36"]),
            ("deep.sub.target.com", vec!["93.184.216.37"]),
        ],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req1 = create_test_request("https://api.target.com/users", HttpMethod::Get);
    assert!(policy.authorize(req1).await.is_ok());

    let req2 = create_test_request("https://auth.target.com/login", HttpMethod::Post);
    assert!(policy.authorize(req2).await.is_ok());

    let req3 = create_test_request("https://deep.sub.target.com/status", HttpMethod::Get);
    assert!(policy.authorize(req3).await.is_ok());
}

#[tokio::test]
async fn test_e2e_default_deny_unregistered_domains() {
    let resolver = create_mock_dns(
        vec![("malicious-attacker.org", vec!["93.184.216.99"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://malicious-attacker.org/exfil", HttpMethod::Get);
    let res = policy.authorize(req).await;

    assert!(res.is_err());
    assert!(matches!(res.unwrap_err(), ScopeError::OutOfScope(_)));
}

#[tokio::test]
async fn test_e2e_port_filtering_enforcement() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    // Port 443 is allowed
    let req_ok = create_test_request("https://example.com:443/api", HttpMethod::Get);
    assert!(policy.authorize(req_ok).await.is_ok());

    // Port 22 (SSH) is disallowed
    let req_ssh = create_test_request("https://example.com:22/api", HttpMethod::Get);
    let res = policy.authorize(req_ssh).await;
    assert!(res.is_err());
    assert!(matches!(res.unwrap_err(), ScopeError::DisallowedPort(22)));
}

#[tokio::test]
async fn test_e2e_path_prefix_filtering() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = ScopePolicy::builder()
        .allow_host("example.com")
        .allow_path("/api/v1/")
        .disallow_path("/api/v1/admin")
        .with_resolver(resolver)
        .build();

    let req_ok = create_test_request("https://example.com/api/v1/users", HttpMethod::Get);
    assert!(policy.authorize(req_ok).await.is_ok());

    let req_denied_admin = create_test_request("https://example.com/api/v1/admin/delete", HttpMethod::Post);
    assert!(policy.authorize(req_denied_admin).await.is_err());

    let req_denied_root = create_test_request("https://example.com/index.html", HttpMethod::Get);
    assert!(policy.authorize(req_denied_root).await.is_err());
}

#[tokio::test]
async fn test_e2e_url_canonicalization() {
    // 1. Path traversal normalization
    let u1 = canonicalize("https://example.com/api/v1/../../secret/path").unwrap();
    assert_eq!(u1.path(), "/secret/path");

    // 2. Query parameter sorting
    let u2 = canonicalize("https://example.com/search?z=3&a=1&m=2").unwrap();
    assert_eq!(u2.query().unwrap(), "a=1&m=2&z=3");

    // 3. Default port stripping
    let u3 = canonicalize("https://example.com:443/test").unwrap();
    assert_eq!(u3.port(), None);

    // 4. Scheme check
    assert!(canonicalize("ftp://example.com/file").is_err());
    assert!(canonicalize("javascript:alert(1)").is_err());
}

#[tokio::test]
async fn test_e2e_anti_ssrf_blocking_all_private_and_loopback_ranges() {
    let test_cases = vec![
        ("127.0.0.1", true, "IPv4 loopback"),
        ("127.0.0.254", true, "IPv4 loopback range"),
        ("10.0.0.1", true, "RFC 1918 10/8"),
        ("10.255.255.254", true, "RFC 1918 10/8"),
        ("172.16.0.1", true, "RFC 1918 172.16/12"),
        ("172.31.255.254", true, "RFC 1918 172.16/12"),
        ("192.168.1.1", true, "RFC 1918 192.168/16"),
        ("169.254.169.254", true, "IPv4 link-local (Cloud metadata)"),
        ("224.0.0.1", true, "IPv4 multicast"),
        ("255.255.255.255", true, "IPv4 broadcast"),
        ("192.0.2.1", true, "RFC 5737 documentation"),
        ("::1", true, "IPv6 loopback"),
        ("fe80::1", true, "IPv6 link-local"),
        ("fc00::1", true, "IPv6 unique local"),
        ("ff02::1", true, "IPv6 multicast"),
        ("93.184.216.34", false, "Public IP (Example.com)"),
        ("1.1.1.1", false, "Public IP (Cloudflare)"),
        ("8.8.8.8", false, "Public IP (Google)"),
    ];

    let validator = IpValidator::new(false);

    for (ip_str, should_block, desc) in test_cases {
        let ip: IpAddr = ip_str.parse().expect("valid ip");
        let is_blocked = validator.is_blocked(&ip);
        assert_eq!(
            is_blocked, should_block,
            "SSRF filter failed for {}: {} (expected blocked={})",
            desc, ip_str, should_block
        );
    }
}

#[tokio::test]
async fn test_e2e_anti_ssrf_scope_authorization_denial() {
    let resolver = create_mock_dns(
        vec![
            ("meta.target.com", vec!["169.254.169.254"]),
            ("internal.target.com", vec!["10.0.0.5"]),
            ("localhost.target.com", vec!["127.0.0.1"]),
        ],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req_meta = create_test_request("https://meta.target.com/latest/meta-data", HttpMethod::Get);
    let res_meta = policy.authorize(req_meta).await;
    assert!(res_meta.is_err());
    assert!(matches!(res_meta.unwrap_err(), ScopeError::SsrfBlocked(_, _)));

    let req_internal = create_test_request("https://internal.target.com/db", HttpMethod::Get);
    let res_internal = policy.authorize(req_internal).await;
    assert!(res_internal.is_err());
    assert!(matches!(res_internal.unwrap_err(), ScopeError::SsrfBlocked(_, _)));

    let req_localhost = create_test_request("https://localhost.target.com/admin", HttpMethod::Get);
    let res_localhost = policy.authorize(req_localhost).await;
    assert!(res_localhost.is_err());
    assert!(matches!(res_localhost.unwrap_err(), ScopeError::SsrfBlocked(_, _)));
}
"""

with open(os.path.join(tests_dir, "e2e_scope_ssrf.rs"), "w", encoding="utf-8") as f:
    f.write(e2e_scope_ssrf)

# 2. e2e_token_enforcement.rs
e2e_token_enforcement = """//! Opaque-Box E2E Suite: Capability Token Gating, Cryptographic Signatures, and Liveness.

use std::sync::Arc;
use ucma_core::endpoint::HttpMethod;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns, create_test_request};
use ucma_http::client::{HttpError, SafeHttpClient};
use ucma_http::limits::HttpLimits;
use ucma_scope::policy::ScopePolicy;
use ucma_scope::ScopeError;

#[tokio::test]
async fn test_e2e_capability_token_structure_and_minting() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://example.com/orders?user=42", HttpMethod::Get);
    let token = policy.authorize(req).await.expect("token minting must succeed");

    assert_eq!(token.target_url().as_str(), "https://example.com/orders?user=42");
    assert_eq!(token.resolved_ips().len(), 1);
    assert!(!token.is_expired());
    assert!(token.signature().iter().any(|&b| b != 0));

    // Verify token signature against policy internal salt
    assert!(policy.verify_token(&token).is_ok());
}

#[tokio::test]
async fn test_e2e_token_signature_fails_on_tampering() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://example.com/safe/path", HttpMethod::Get);
    let mut token = policy.authorize(req).await.expect("token minting must succeed");

    // Tamper with inner target URL
    token.request_mut().url = "https://example.com/evil/path".parse().unwrap();

    // Verify token check fails on tampered URL / RequestId mismatch
    let verify_res = policy.verify_token(&token);
    assert!(verify_res.is_err());
    assert!(matches!(verify_res.unwrap_err(), ScopeError::InvalidCapabilityToken));
}

#[tokio::test]
async fn test_e2e_foreign_policy_token_rejected() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
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
    let token_b = policy_b.authorize_url("https://example.com/api").await.unwrap();

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
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("example.com")
            .with_resolver(resolver)
            .with_salt([42u8; 32])
            .token_ttl_seconds(-10) // Negative TTL -> already expired!
            .build(),
    );

    let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();
    let token = policy.authorize_url("https://example.com/api").await.unwrap();

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
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let mut req = create_test_request("https://example.com/upload", HttpMethod::Post);
    req.headers.insert("content-type".to_string(), "application/json".to_string());
    req.headers.insert("x-trace-id".to_string(), "trace-12345".to_string());
    req.body = b"{\"payload\": \"test_data\"}".to_vec();

    let token = policy.authorize(req).await.unwrap();

    assert_eq!(token.request().headers.get("content-type").unwrap(), "application/json");
    assert_eq!(token.request().headers.get("x-trace-id").unwrap(), "trace-12345");
    assert_eq!(token.request().body, b"{\"payload\": \"test_data\"}");
}
"""

with open(os.path.join(tests_dir, "e2e_token_enforcement.rs"), "w", encoding="utf-8") as f:
    f.write(e2e_token_enforcement)

# 3. e2e_redirect_validation.rs
e2e_redirect_validation = """//! Opaque-Box E2E Suite: Hop-by-Hop Redirect Validation and Scope Re-evaluation.

use std::collections::HashMap;
use std::sync::Arc;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns};
use ucma_http::redirect::{RedirectDecision, RedirectValidator};
use ucma_scope::ScopeError;
use url::Url;

#[tokio::test]
async fn test_e2e_in_scope_redirect_followed() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/login").unwrap();
    let mut headers = HashMap::new();
    headers.insert("location".to_string(), "https://example.com/dashboard".to_string());

    let decision = RedirectValidator::evaluate_hop(
        &initial_url,
        302,
        &headers,
        0,
        5,
        &policy,
    )
    .await
    .expect("redirect evaluation should succeed");

    match decision {
        RedirectDecision::Follow(next_auth_req) => {
            assert_eq!(next_auth_req.target_url().as_str(), "https://example.com/dashboard");
        }
        RedirectDecision::Terminal => panic!("expected Follow decision for 302 redirect"),
    }
}

#[tokio::test]
async fn test_e2e_out_of_scope_redirect_aborted() {
    let resolver = create_mock_dns(
        vec![
            ("example.com", vec!["93.184.216.34"]),
            ("evil-attacker.com", vec!["93.184.216.99"]),
        ],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/redirect").unwrap();
    let mut headers = HashMap::new();
    headers.insert("location".to_string(), "https://evil-attacker.com/steal".to_string());

    let decision_res = RedirectValidator::evaluate_hop(
        &initial_url,
        301,
        &headers,
        0,
        5,
        &policy,
    )
    .await;

    assert!(decision_res.is_err());
    assert!(matches!(decision_res.unwrap_err(), ScopeError::OutOfScope(_)));
}

#[tokio::test]
async fn test_e2e_ssrf_redirect_aborted() {
    let resolver = create_mock_dns(
        vec![
            ("example.com", vec!["93.184.216.34"]),
            ("metadata.target.com", vec!["169.254.169.254"]),
        ],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/proxy").unwrap();
    let mut headers = HashMap::new();
    headers.insert("location".to_string(), "https://metadata.target.com/latest/meta-data/".to_string());

    let decision_res = RedirectValidator::evaluate_hop(
        &initial_url,
        307,
        &headers,
        0,
        5,
        &policy,
    )
    .await;

    assert!(decision_res.is_err());
    assert!(matches!(decision_res.unwrap_err(), ScopeError::SsrfBlocked(_, _)));
}

#[tokio::test]
async fn test_e2e_redirect_hop_limit_enforced() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/loop").unwrap();
    let mut headers = HashMap::new();
    headers.insert("location".to_string(), "https://example.com/loop".to_string());

    let decision_res = RedirectValidator::evaluate_hop(
        &initial_url,
        302,
        &headers,
        5,
        5,
        &policy,
    )
    .await;

    assert!(decision_res.is_err());
    assert!(matches!(decision_res.unwrap_err(), ScopeError::TooManyRedirects(5)));
}

#[tokio::test]
async fn test_e2e_relative_redirect_location_canonicalized() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let initial_url = Url::parse("https://example.com/app/v1/login").unwrap();
    let mut headers = HashMap::new();
    headers.insert("location".to_string(), "../v2/dashboard".to_string());

    let decision = RedirectValidator::evaluate_hop(
        &initial_url,
        303,
        &headers,
        1,
        5,
        &policy,
    )
    .await
    .expect("relative redirect resolution should succeed");

    match decision {
        RedirectDecision::Follow(next_auth_req) => {
            assert_eq!(next_auth_req.target_url().as_str(), "https://example.com/app/v2/dashboard");
        }
        RedirectDecision::Terminal => panic!("expected Follow for 303"),
    }
}
"""

with open(os.path.join(tests_dir, "e2e_redirect_validation.rs"), "w", encoding="utf-8") as f:
    f.write(e2e_redirect_validation)

# 4. e2e_blake3_evidence.rs
e2e_blake3_evidence = """//! Opaque-Box E2E Suite: BLAKE3 Content-Derived IDs and Evidence Snapshot Determinism.

use std::collections::HashMap;
use ucma_core::evidence::{EvidenceRecord, EvidenceStore, Severity};
use ucma_core::ids::{ContentId, EndpointId, ParameterId, RequestId, SnapshotId, TargetId};
use ucma_core::snapshot::ResponseSnapshot;

#[test]
fn test_e2e_content_id_determinism() {
    let data1 = b"HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\n\\r\\n<html>hello</html>";
    let data2 = b"HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\n\\r\\n<html>hello</html>";
    let data3 = b"HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\n\\r\\n<html>different</html>";

    let id1 = ContentId::from_data(data1);
    let id2 = ContentId::from_data(data2);
    let id3 = ContentId::from_data(data3);

    assert_eq!(id1, id2, "identical content must produce identical BLAKE3 ContentId");
    assert_ne!(id1, id3, "different content must produce different BLAKE3 ContentId");
    assert_eq!(id1.as_str().len(), 64, "BLAKE3 hex string must be 64 characters");
}

#[test]
fn test_e2e_domain_id_derivation_determinism() {
    // TargetId
    let t1 = TargetId::derive("https://example.com/api");
    let t2 = TargetId::derive("https://example.com/api");
    assert_eq!(t1, t2);

    // EndpointId
    let e1 = EndpointId::derive(&t1, "GET", "/api/v1/users/{id}");
    let e2 = EndpointId::derive(&t1, "GET", "/api/v1/users/{id}");
    let e3 = EndpointId::derive(&t1, "POST", "/api/v1/users/{id}");
    assert_eq!(e1, e2);
    assert_ne!(e1, e3);

    // RequestId
    let r1 = RequestId::derive(&e1, "GET", "https://example.com/api/v1/users/42", b"");
    let r2 = RequestId::derive(&e1, "GET", "https://example.com/api/v1/users/42", b"");
    assert_eq!(r1, r2);

    // ParameterId
    let p1 = ParameterId::derive(&e1, "query", "user_id");
    let p2 = ParameterId::derive(&e1, "query", "user_id");
    assert_eq!(p1, p2);
}

#[test]
fn test_e2e_response_snapshot_wire_hashing() {
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    headers.insert("server".to_string(), "nginx".to_string());

    let body = b"{\"status\": \"ok\", \"records\": [1, 2, 3]}".to_vec();
    let raw_wire = b"HTTP/1.1 200 OK\\r\\ncontent-type: application/json\\r\\nserver: nginx\\r\\n\\r\\n{\"status\": \"ok\", \"records\": [1, 2, 3]}".to_vec();

    let target_id = TargetId::derive("https://example.com");
    let endpoint_id = EndpointId::derive(&target_id, "GET", "/status");
    let request_id = RequestId::derive(&endpoint_id, "GET", "https://example.com/status", b"");

    let snapshot = ResponseSnapshot::new(
        request_id,
        200,
        headers.clone(),
        body.clone(),
        15_000_000,
        &raw_wire,
        false,
        Some("93.184.216.34".to_string()),
    );

    let expected_content_id = ContentId::from_data(&raw_wire);
    assert_eq!(snapshot.blake3_raw_wire_hash, expected_content_id);
    assert_eq!(snapshot.status_code, 200);
    assert_eq!(snapshot.body, body);
}

#[test]
fn test_e2e_evidence_store_crud_and_querying() {
    let store = EvidenceStore::new();

    let target_id = TargetId::derive("https://example.com");
    let endpoint_id = EndpointId::derive(&target_id, "GET", "/search");
    let request_id = RequestId::derive(&endpoint_id, "GET", "https://example.com/search?q=test", b"");
    let snapshot_id = SnapshotId::derive(&request_id, 200, b"raw response bytes");

    let record1 = EvidenceRecord::new(
        target_id,
        "SQLi Differential Oracle",
        "Confirmed syntactic perturbation via boolean true/false difference",
        "Detailed reproduction trail",
        Severity::High,
        vec![snapshot_id],
    );

    let record_id = record1.id;
    store.insert_evidence(record1);

    assert_eq!(store.count_evidence(), 1);
    assert!(store.get_evidence(&record_id).is_some());

    // Query by target
    let by_target = store.evidence_for_target(&target_id);
    assert_eq!(by_target.len(), 1);

    // Query all
    let all = store.all_evidence();
    assert_eq!(all.len(), 1);

    // Clear
    store.clear();
    assert_eq!(store.count_evidence(), 0);
}
"""

with open(os.path.join(tests_dir, "e2e_blake3_evidence.rs"), "w", encoding="utf-8") as f:
    f.write(e2e_blake3_evidence)

# 5. e2e_milestone1_foundation.rs
e2e_milestone1_foundation = """//! Comprehensive Tier 1 & Tier 2 E2E Suite for Milestone 1 Foundation Crates.

use std::sync::Arc;
use ucma_core::endpoint::{Endpoint, HttpMethod};
use ucma_core::evidence::{EvidenceRecord, Severity};
use ucma_core::ids::{ContentId, EndpointId, SnapshotId, TargetId};
use ucma_core::parameter::{ParameterDefinition, ParameterLocation, ParameterType};
use ucma_core::session::SessionState;
use ucma_core::target::Target;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns};
use ucma_http::limits::HttpLimitsBuilder;
use ucma_scope::policy::ScopePolicy;
use url::Url;

// ==========================================
// TIER 1: FUNCTIONAL COVERAGE TEST CASES
// ==========================================

#[test]
fn test_tier1_target_endpoint_parameter_models() {
    let url = Url::parse("https://example.com/api").unwrap();
    let target = Target::new(url, "Production Target");
    assert_eq!(target.root_url.as_str(), "https://example.com/api");

    let endpoint = Endpoint::new(
        &target.id,
        HttpMethod::Get,
        "/users/{id}",
    );
    assert_eq!(endpoint.path_template, "/users/{id}");

    let param = ParameterDefinition::new(
        &endpoint.id,
        "id".to_string(),
        ParameterLocation::Path,
    )
    .with_type(ParameterType::Integer)
    .with_required(true);

    assert_eq!(param.name, "id");
    assert_eq!(param.param_type, ParameterType::Integer);
    assert!(param.is_required);
}

#[tokio::test]
async fn test_tier1_scope_policy_builder_and_matching() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = ScopePolicy::builder()
        .allow_host("example.com")
        .allow_port(80)
        .allow_port(443)
        .with_resolver(resolver)
        .build();

    let auth_token = policy.authorize_url("https://example.com/api/test").await.unwrap();
    assert_eq!(auth_token.target_url().host_str().unwrap(), "example.com");
}

#[test]
fn test_tier1_session_state_and_token_expiry() {
    let target_id = TargetId::derive("https://example.com");
    let mut session = SessionState::new(target_id);
    session.auth_token = Some("bearer_token_secret_xyz".to_string());
    session.cookies.insert("session_id".to_string(), "abc12345".to_string());

    assert_eq!(session.auth_token.as_deref(), Some("bearer_token_secret_xyz"));
    assert_eq!(session.cookies.get("session_id").map(|s| s.as_str()), Some("abc12345"));
    assert!(!session.is_expired());
}

#[test]
fn test_tier1_evidence_record_lifecycle() {
    let target_id = TargetId::derive("https://example.com");
    let endpoint_id = EndpointId::derive(&target_id, "GET", "/api/v1/search");
    let request_id = ucma_core::ids::RequestId::derive(&endpoint_id, "GET", "https://example.com/api/v1/search", b"");
    let snapshot_id = SnapshotId::derive(&request_id, 200, b"test raw bytes");

    let record = EvidenceRecord::new(
        target_id,
        "Timing SPRT Oracle",
        "Observed significant delay under Wald SPRT (tau=300ms, p<0.01)",
        "Reproduction evidence details",
        Severity::Medium,
        vec![snapshot_id],
    )
    .with_metadata("oracle", "sprt")
    .with_metadata("milestone", "m1");

    assert_eq!(record.metadata.len(), 2);
    assert_eq!(record.metadata.get("oracle").unwrap(), "sprt");
}

// ==========================================
// TIER 2: BOUNDARY & STRESS TEST CASES
// ==========================================

#[test]
fn test_tier2_zero_and_empty_payload_boundaries() {
    // Empty body hashing
    let empty_hash = ContentId::from_data(b"");
    assert_eq!(
        empty_hash.as_str(),
        "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
        "BLAKE3 hash of empty slice must be exact standard hash"
    );

    // Empty URL parse failure
    assert!(Url::parse("").is_err());
}

#[test]
fn test_tier2_http_limits_builder_boundaries() {
    let limits = HttpLimitsBuilder::new()
        .connect_timeout(std::time::Duration::from_millis(500))
        .read_timeout(std::time::Duration::from_millis(1000))
        .overall_timeout(std::time::Duration::from_millis(2000))
        .max_body_bytes(1024 * 1024)
        .max_redirects(3)
        .build();

    assert_eq!(limits.connect_timeout, std::time::Duration::from_millis(500));
    assert_eq!(limits.max_body_bytes, 1024 * 1024);
    assert_eq!(limits.max_redirects, 3);
}

#[tokio::test]
async fn test_tier2_malformed_url_and_path_recovery() {
    let resolver = create_mock_dns(vec![], false);
    let policy = build_standard_test_policy(resolver);

    // Port out of range
    assert!(policy.authorize_url("https://example.com:99999/path").await.is_err());

    // Invalid scheme
    assert!(policy.authorize_url("file:///etc/passwd").await.is_err());
    assert!(policy.authorize_url("gopher://127.0.0.1:70/").await.is_err());
}

#[tokio::test]
async fn test_tier2_concurrency_and_race_safety() {
    let resolver = create_mock_dns(
        vec![("example.com", vec!["93.184.216.34"])],
        false,
    );
    let policy = Arc::new(build_standard_test_policy(resolver));

    let mut handles = Vec::new();
    for i in 0..32 {
        let policy_clone = policy.clone();
        let handle = tokio::spawn(async move {
            let url = format!("https://example.com/api/item?id={}", i);
            let token = policy_clone.authorize_url(&url).await.expect("concurrent authorization must succeed");
            assert!(policy_clone.verify_token(&token).is_ok());
        });
        handles.push(handle);
    }

    for h in handles {
        h.await.expect("worker task must finish cleanly");
    }
}
"""

with open(os.path.join(tests_dir, "e2e_milestone1_foundation.rs"), "w", encoding="utf-8") as f:
    f.write(e2e_milestone1_foundation)

print("Updated all 5 E2E integration test suites cleanly!")

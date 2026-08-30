//! Comprehensive Tier 1 & Tier 2 E2E Suite for Milestone 1 Foundation Crates.

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

    let endpoint = Endpoint::new(&target.id, HttpMethod::Get, "/users/{id}");
    assert_eq!(endpoint.path_template, "/users/{id}");

    let param = ParameterDefinition::new(&endpoint.id, "id".to_string(), ParameterLocation::Path)
        .with_type(ParameterType::Integer)
        .with_required(true);

    assert_eq!(param.name, "id");
    assert_eq!(param.param_type, ParameterType::Integer);
    assert!(param.is_required);
}

#[tokio::test]
async fn test_tier1_scope_policy_builder_and_matching() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = ScopePolicy::builder()
        .allow_host("example.com")
        .allow_port(80)
        .allow_port(443)
        .with_resolver(resolver)
        .build();

    let auth_token = policy
        .authorize_url("https://example.com/api/test")
        .await
        .unwrap();
    assert_eq!(auth_token.target_url().host_str().unwrap(), "example.com");
}

#[test]
fn test_tier1_session_state_and_token_expiry() {
    let target_id = TargetId::derive("https://example.com");
    let mut session = SessionState::new(target_id);
    session.auth_token = Some("bearer_token_secret_xyz".to_string());
    session
        .cookies
        .insert("session_id".to_string(), "abc12345".to_string());

    assert_eq!(
        session.auth_token.as_deref(),
        Some("bearer_token_secret_xyz")
    );
    assert_eq!(
        session.cookies.get("session_id").map(|s| s.as_str()),
        Some("abc12345")
    );
    assert!(!session.is_expired());
}

#[test]
fn test_tier1_evidence_record_lifecycle() {
    let target_id = TargetId::derive("https://example.com");
    let endpoint_id = EndpointId::derive(&target_id, "GET", "/api/v1/search");
    let request_id = ucma_core::ids::RequestId::derive(
        &endpoint_id,
        "GET",
        "https://example.com/api/v1/search",
        b"",
    );
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

    assert_eq!(
        limits.connect_timeout,
        std::time::Duration::from_millis(500)
    );
    assert_eq!(limits.max_body_bytes, 1024 * 1024);
    assert_eq!(limits.max_redirects, 3);
}

#[tokio::test]
async fn test_tier2_malformed_url_and_path_recovery() {
    let resolver = create_mock_dns(vec![], false);
    let policy = build_standard_test_policy(resolver);

    // Port out of range
    assert!(
        policy
            .authorize_url("https://example.com:99999/path")
            .await
            .is_err()
    );

    // Invalid scheme
    assert!(policy.authorize_url("file:///etc/passwd").await.is_err());
    assert!(
        policy
            .authorize_url("gopher://127.0.0.1:70/")
            .await
            .is_err()
    );
}

#[tokio::test]
async fn test_tier2_concurrency_and_race_safety() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = Arc::new(build_standard_test_policy(resolver));

    let mut handles = Vec::new();
    for i in 0..32 {
        let policy_clone = policy.clone();
        let handle = tokio::spawn(async move {
            let url = format!("https://example.com/api/item?id={}", i);
            let token = policy_clone
                .authorize_url(&url)
                .await
                .expect("concurrent authorization must succeed");
            assert!(policy_clone.verify_token(&token).is_ok());
        });
        handles.push(handle);
    }

    for h in handles {
        h.await.expect("worker task must finish cleanly");
    }
}

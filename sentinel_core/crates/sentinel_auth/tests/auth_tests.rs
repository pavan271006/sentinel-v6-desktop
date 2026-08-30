//! Test Suite for Identity & Authentication Subsystem

use std::sync::Arc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_auth::{DefaultIdentityManager, JwtUtility, SecureVault};
use sentinel_common::domain::secret::Credential;
use sentinel_common::domain::supporting::Identity;
use sentinel_common::enums::{AccessLevel, HttpMethod};
use sentinel_common::operational::ParsedRequest;
use sentinel_common::traits::IdentityManager;
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_identity_and_zero_plaintext_credential_injection_sec09() {
    let vault = Arc::new(SecureVault::new());
    let manager = DefaultIdentityManager::new(vault.clone());

    // 1. Create Identity (Alice Admin)
    let identity = Identity {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        username: "alice_admin".to_string(),
        roles: vec!["Admin".to_string(), "SecurityReviewer".to_string()],
        meta: None,
    };
    let identity_id = manager.add_identity(identity.clone()).await.unwrap();

    // 2. Store secret in vault (SEC-09: never stored in Credential entity directly)
    let secret_ref_id = Uuid::new_v4();
    vault.store(secret_ref_id, "super_secret_jwt_token_999");

    let credential = Credential::new(identity_id, "bearer", secret_ref_id, AccessLevel::Admin);
    manager.add_credential(credential).await.unwrap();

    // 3. Prepare an outgoing unauthenticated request
    let mut req = ParsedRequest {
        method: HttpMethod::GET,
        uri: "https://api.target.com/admin/secrets".to_string(),
        version: "HTTP/1.1".to_string(),
        headers: vec![(b"Host".to_vec(), b"api.target.com".to_vec())],
        body: Vec::new(),
    };

    // 4. Inject authentication
    manager.inject_auth(identity_id, &mut req).await.unwrap();

    let auth_header = req
        .headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(b"authorization"))
        .expect("Authorization header must be injected");

    assert_eq!(
        String::from_utf8_lossy(&auth_header.1),
        "Bearer super_secret_jwt_token_999"
    );
}

#[test]
fn test_jwt_tampering_and_parsing() {
    // Standard test JWT
    let test_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIiwiaWF0IjoxNTE2MjM5MDIyfQ.4peZ53b0_183_mR6m8G-V0w9-dF4W3qF1yU-GvJbYJk";

    let parsed = JwtUtility::parse(test_jwt).expect("Valid JWT must parse");
    assert_eq!(parsed.header.get("alg").unwrap().as_str().unwrap(), "HS256");
    assert_eq!(
        parsed.payload.get("name").unwrap().as_str().unwrap(),
        "Alice"
    );

    // Attack simulation: none algorithm attack
    let tampered = JwtUtility::create_none_algorithm_attack(test_jwt).unwrap();
    assert!(tampered.ends_with('.'));
    let parsed_tampered = JwtUtility::parse(&tampered).unwrap();
    assert_eq!(
        parsed_tampered.header.get("alg").unwrap().as_str().unwrap(),
        "none"
    );
}

#[tokio::test]
async fn test_auth_sqlite_persistence() {
    let temp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(temp.path()).await.unwrap());
    let vault = Arc::new(SecureVault::new());

    let manager = DefaultIdentityManager::new(vault.clone()).with_storage(store.clone());

    let identity = Identity {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        username: "bob_auditor".to_string(),
        roles: vec!["Auditor".to_string()],
        meta: None,
    };

    let id = manager.add_identity(identity).await.unwrap();
    let list = manager.list_identities().await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, id);
}

#[test]
fn test_username_enumeration_timing_and_differential_analysis() {
    use sentinel_auth::{TimingSample, UsernameEnumerationEngine};

    // Cohort 1: Valid username with password hash calculation latency (~120ms +/- 5ms)
    let valid_samples: Vec<TimingSample> = (0..10)
        .map(|i| TimingSample {
            username: "admin".to_string(),
            duration_ms: 120.0 + (i as f64 % 5.0) - 2.0,
            response_status: 401,
            response_bytes: 450,
            response_body: "{\"error\": \"Invalid password\"}".to_string(),
        })
        .collect();

    // Cohort 2: Invalid username with immediate lookup reject (~30ms +/- 3ms)
    let invalid_samples: Vec<TimingSample> = (0..10)
        .map(|i| TimingSample {
            username: format!("nonexistent_user_{}", i),
            duration_ms: 30.0 + (i as f64 % 3.0) - 1.0,
            response_status: 404,
            response_bytes: 380,
            response_body: "{\"error\": \"User not found\"}".to_string(),
        })
        .collect();

    let result = UsernameEnumerationEngine::analyze_timing_samples(&valid_samples, &invalid_samples);
    assert!(result.is_vulnerable);
    assert!(result.confidence >= 0.85);
    assert!(result.timing_difference_ms > 80.0);
    assert!(result.response_diff_identified);
}

#[test]
fn test_lockout_and_rate_limit_bypass_analysis() {
    use sentinel_auth::{LockoutAnalyzer, LockoutThresholdProbe};

    let probes: Vec<LockoutThresholdProbe> = vec![
        LockoutThresholdProbe { attempt_index: 1, response_status: 401, retry_after_sec: None, is_locked_out: false, error_message: "Bad credentials".to_string() },
        LockoutThresholdProbe { attempt_index: 2, response_status: 401, retry_after_sec: None, is_locked_out: false, error_message: "Bad credentials".to_string() },
        LockoutThresholdProbe { attempt_index: 3, response_status: 401, retry_after_sec: None, is_locked_out: false, error_message: "Bad credentials".to_string() },
        LockoutThresholdProbe { attempt_index: 4, response_status: 429, retry_after_sec: Some(60), is_locked_out: true, error_message: "Rate limit exceeded".to_string() },
    ];

    let threshold = LockoutAnalyzer::detect_lockout_threshold(&probes);
    assert_eq!(threshold, Some(4));

    let bypass_headers = LockoutAnalyzer::generate_ip_bypass_headers(42);
    assert!(bypass_headers.iter().any(|(h, _)| h == "X-Forwarded-For"));
    assert!(bypass_headers.iter().any(|(h, _)| h == "Client-IP"));

    let variations = LockoutAnalyzer::generate_username_variations("admin");
    assert!(variations.contains(&"ADMIN".to_string()));
    assert!(variations.contains(&"admin ".to_string()));

    let locked_probe = &probes[3];
    let bypass_success_probe = LockoutThresholdProbe {
        attempt_index: 5,
        response_status: 401,
        retry_after_sec: None,
        is_locked_out: false,
        error_message: "Bad credentials".to_string(),
    };
    assert!(LockoutAnalyzer::evaluate_bypass_success(locked_probe, &bypass_success_probe));
}

#[test]
fn test_oauth_oidc_pkce_vulnerabilities() {
    use sentinel_auth::{OAuthFlowAnalyzer, OAuthVulnerabilityType};

    let probes = OAuthFlowAnalyzer::generate_redirect_uri_probes("https://auth.client.com/oauth/callback");
    assert!(probes.iter().any(|(uri, _)| uri.contains("/../../attacker_callback")));
    assert!(probes.iter().any(|(uri, _)| uri.contains("attacker.evil.com")));

    // Static/low-entropy state
    let static_states = vec!["static_state_123".to_string(), "static_state_123".to_string()];
    let state_vulns = OAuthFlowAnalyzer::analyze_state_parameter(&static_states);
    assert!(state_vulns.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::StaticStateParameter));

    // PKCE stripping & downgrade
    let pkce_vulns = OAuthFlowAnalyzer::evaluate_pkce_vulnerabilities(200, 200);
    assert!(pkce_vulns.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::PkceStrippingAllowed));
    assert!(pkce_vulns.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::PkceDowngradeAllowed));

    // Alg confusion & JWKS injection
    let test_jwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc";
    let alg_confusion = OAuthFlowAnalyzer::create_algorithm_confusion_payload(test_jwt).unwrap();
    let parts: Vec<&str> = alg_confusion.split('.').collect();
    assert_eq!(parts.len(), 3);
    assert!(!parts[2].is_empty(), "Signature must be cryptographically generated");

    // Kid injections
    let kid_attacks = sentinel_auth::JwtUtility::create_kid_injection_payloads(test_jwt);
    assert_eq!(kid_attacks.len(), 3);

    let jwks_tampered = OAuthFlowAnalyzer::create_jwks_injection_payload(test_jwt, "https://evil.com/jwks.json").unwrap();
    assert!(!jwks_tampered.is_empty());
}

#[test]
fn test_session_rotation_and_fixation_engine() {
    use sentinel_auth::SessionRotationEngine;

    // Vulnerable non-rotation: pre-auth equals post-auth
    let non_rotated = SessionRotationEngine::verify_session_rotation("sess_abc123", "sess_abc123");
    assert!(non_rotated.is_vulnerable);
    assert!(!non_rotated.is_rotated);

    // Secure rotation
    let rotated = SessionRotationEngine::verify_session_rotation("sess_pre_123", "sess_post_999");
    assert!(!rotated.is_vulnerable);
    assert!(rotated.is_rotated);

    // Fixation test
    let fixation = SessionRotationEngine::verify_session_fixation("fixed_attacker_token_xyz", "fixed_attacker_token_xyz");
    assert!(fixation.is_vulnerable);
    assert!(fixation.fixation_accepted);
}

#[test]
fn test_session_puzzling_and_cross_flow_collision() {
    use sentinel_auth::{SessionPuzzlingAnalyzer, SessionVariableSnapshot};
    use std::collections::HashMap;

    let mut flow_a_vars = HashMap::new();
    flow_a_vars.insert("user_role".to_string(), "Guest".to_string());
    flow_a_vars.insert("authenticated_email".to_string(), "user@example.com".to_string());

    let mut flow_b_vars = HashMap::new();
    flow_b_vars.insert("user_role".to_string(), "Admin".to_string());
    flow_b_vars.insert("authenticated_email".to_string(), "admin@example.com".to_string());

    let snapshot_a = SessionVariableSnapshot {
        flow_name: "PasswordResetFlow".to_string(),
        variables: flow_a_vars,
    };
    let snapshot_b = SessionVariableSnapshot {
        flow_name: "AccountElevationFlow".to_string(),
        variables: flow_b_vars,
    };

    let collisions = SessionPuzzlingAnalyzer::detect_cross_flow_collisions(&snapshot_a, &snapshot_b);
    assert_eq!(collisions.len(), 2);
    assert!(collisions.iter().any(|c| c.variable_name == "user_role"));
}

#[test]
fn test_anti_csrf_defense_evaluation() {
    use sentinel_auth::{AntiCsrfEngine, CsrfProbeResult, CsrfProbeType};

    let probes = AntiCsrfEngine::generate_csrf_probes(
        "POST",
        "/api/v1/user/email",
        "csrf_token",
        "valid_csrf_token_12345",
        "https://evil-attacker.com",
    );
    assert_eq!(probes.len(), 6);

    let results = vec![
        CsrfProbeResult {
            probe_type: CsrfProbeType::TokenOmission,
            http_status: 200,
            state_changed: true,
            is_vulnerable: true,
            details: "State changed without CSRF token".to_string(),
        },
        CsrfProbeResult {
            probe_type: CsrfProbeType::TamperedToken,
            http_status: 403,
            state_changed: false,
            is_vulnerable: false,
            details: "Rejected tampered token".to_string(),
        },
    ];

    let report = AntiCsrfEngine::evaluate_csrf_results(&results);
    assert!(report.is_vulnerable);
    assert!(report.failed_defenses.contains(&CsrfProbeType::TokenOmission));
}

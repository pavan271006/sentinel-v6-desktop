use sentinel_verification::{
    DifferentialClassification, DifferentialEngine, PrivilegeRole,
};

#[test]
fn test_lcs_and_json_semantic_diff() {
    let body_a = r#"{"status": "ok", "user": {"id": 1, "role": "admin", "email": "admin@target.local"}}"#;
    let body_b = r#"{"status": "ok", "user": {"id": 1, "role": "user", "email": "admin@target.local"}}"#;

    let (_sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff(body_a, body_b);
    assert_eq!(unchanged, 0); // single line diff with changed token
    assert_eq!(added, 1);
    assert_eq!(removed, 1);

    let (jaccard, added_keys, removed_keys, modified_keys) =
        DifferentialEngine::compute_json_diff(body_a, body_b).expect("Valid JSON");

    // All keys (status, user.id, user.role, user.email) are identical in structure
    assert_eq!(jaccard, 1.0);
    assert_eq!(added_keys.len(), 0);
    assert_eq!(removed_keys.len(), 0);
    assert_eq!(modified_keys, vec!["user.role"]);
}

#[test]
fn test_welch_t_test_timing_divergence() {
    // Normal fast responses ~ 40-60ms
    let baseline = vec![45.0, 52.0, 48.0, 55.0, 42.0, 50.0];
    // Delayed time-based SQLi probe responses ~ 5040-5060ms
    let probe = vec![5045.0, 5052.0, 5048.0, 5055.0, 5042.0, 5050.0];

    let result = DifferentialEngine::compute_welch_t_test(&baseline, &probe)
        .expect("Sufficient samples for t-test");

    assert!(result.is_statistically_significant);
    assert!(result.welch_t_stat > 10.0);
    assert!((result.delay_delta_ms - 5000.0).abs() < 5.0);
}

#[test]
fn test_privilege_differential_matrix_bola_and_enforced_deny() {
    let engine = DifferentialEngine::new();

    let admin_body = r#"{"account_id": "ACC-100", "balance": 50000.00, "owner": "Alice"}"#;
    let cross_tenant_body = r#"{"account_id": "ACC-100", "balance": 50000.00, "owner": "Alice"}"#;

    // Test BOLA: Tenant B receives Tenant A's private resource
    let bola_res = engine.evaluate_privilege_differential(
        PrivilegeRole::HighPrivilegeAdmin,
        200,
        admin_body,
        PrivilegeRole::CrossTenantUser,
        200,
        cross_tenant_body,
        None,
    );

    assert_eq!(bola_res.classification, DifferentialClassification::PermittedAccess);
    assert!(bola_res.rationale.contains("BOLA / IDOR"));

    // Test Enforced Deny: Guest receives 403 Forbidden
    let deny_body = r#"{"error": "Forbidden", "message": "Access denied"}"#;
    let deny_res = engine.evaluate_privilege_differential(
        PrivilegeRole::HighPrivilegeAdmin,
        200,
        admin_body,
        PrivilegeRole::UnauthenticatedGuest,
        403,
        deny_body,
        None,
    );

    assert_eq!(deny_res.classification, DifferentialClassification::EnforcedDeny);
    assert!(deny_res.rationale.contains("HTTP 403"));
}

#[test]
fn test_dom_tag_similarity() {
    let html_a = "<html><body><div><p>Welcome</p><span>Admin</span></div></body></html>";
    let html_b = "<html><body><div><p>Welcome</p><span>User</span></div></body></html>";

    let sim = DifferentialEngine::compute_dom_tag_similarity(html_a, html_b).unwrap();
    assert_eq!(sim, 1.0); // Both contain identical set of tags: html, body, div, p, span
}

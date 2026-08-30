use sentinel_verification::{
    DifferentialClassification, DifferentialEngine, PrivilegeRole,
};

#[test]
fn test_lcs_diff_extreme_edge_cases() {
    // 1. Both strings empty
    let (sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff("", "");
    assert_eq!(sim, 1.0);
    assert_eq!(added, 0);
    assert_eq!(removed, 0);
    assert_eq!(unchanged, 0);

    // 2. Baseline empty, probe non-empty
    let (sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff("", "line1\nline2");
    assert_eq!(sim, 0.0);
    assert_eq!(added, 2);
    assert_eq!(removed, 0);
    assert_eq!(unchanged, 0);

    // 3. Probe empty, baseline non-empty
    let (sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff("line1\nline2", "");
    assert_eq!(sim, 0.0);
    assert_eq!(added, 0);
    assert_eq!(removed, 2);
    assert_eq!(unchanged, 0);

    // 4. Identical multiline strings
    let doc = "header\nbody\nfooter\n";
    let (sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff(doc, doc);
    assert_eq!(sim, 1.0);
    assert_eq!(added, 0);
    assert_eq!(removed, 0);
    assert_eq!(unchanged, 3);

    // 5. Completely disjoint multiline strings
    let doc_a = "alpha\nbeta\ngamma";
    let doc_b = "one\ntwo\nthree";
    let (sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff(doc_a, doc_b);
    assert_eq!(sim, 0.0);
    assert_eq!(added, 3);
    assert_eq!(removed, 3);
    assert_eq!(unchanged, 0);

    // 6. Interleaved lines
    let doc_a = "line1\nline2\nline3\nline4";
    let doc_b = "line1\nline2_modified\nline3\nline5";
    let (sim, added, removed, unchanged) = DifferentialEngine::compute_lcs_diff(doc_a, doc_b);
    // unchanged = line1, line3 (2 lines). total = 4 + 4 = 8. sim = 2 * 2 / 8 = 0.5
    assert_eq!(unchanged, 2);
    assert_eq!(sim, 0.5);
    assert_eq!(added, 2);
    assert_eq!(removed, 2);
}

#[test]
fn test_json_diff_deeply_nested_and_edge_cases() {
    // 1. Invalid JSON strings
    let res = DifferentialEngine::compute_json_diff("not valid json", "{ \"key\": 1 }");
    assert!(res.is_none());

    let res = DifferentialEngine::compute_json_diff("{ \"key\": 1 }", "also not json");
    assert!(res.is_none());

    // 2. Empty JSON objects
    let (jaccard, added, removed, modified) =
        DifferentialEngine::compute_json_diff("{}", "{}").unwrap();
    assert_eq!(jaccard, 1.0);
    assert!(added.is_empty());
    assert!(removed.is_empty());
    assert!(modified.is_empty());

    // 3. Deeply nested objects and arrays
    let json_a = r#"{
        "user": {
            "profile": {
                "name": "Alice",
                "roles": ["admin", "auditor"],
                "settings": { "theme": "dark", "2fa": true }
            }
        },
        "session_id": "sess-123"
    }"#;

    let json_b = r#"{
        "user": {
            "profile": {
                "name": "Alice",
                "roles": ["admin", "guest"],
                "settings": { "theme": "light", "2fa": true },
                "new_field": "injected"
            }
        },
        "extra_top": 999
    }"#;

    let (jaccard, added, removed, modified) =
        DifferentialEngine::compute_json_diff(json_a, json_b).unwrap();

    // Verify key tracking
    assert!(added.contains(&"user.profile.new_field".to_string()));
    assert!(added.contains(&"extra_top".to_string()));
    assert!(removed.contains(&"session_id".to_string()));
    assert!(modified.contains(&"user.profile.roles[1]".to_string()));
    assert!(modified.contains(&"user.profile.settings.theme".to_string()));
    assert!(jaccard < 1.0 && jaccard > 0.0);
}

#[test]
fn test_dom_tag_similarity_edge_cases() {
    // 1. Non-HTML text -> None
    let sim = DifferentialEngine::compute_dom_tag_similarity("plaintext only", "just words");
    assert!(sim.is_none());

    // 2. Mixed self-closing, uppercase, lowercase
    let html_a = "<DIV class=\"main\"><P>Hello</P><BR/><IMG src=\"test.png\" /></DIV>";
    let html_b = "<div><p>World</p><br><img src=\"diff.png\"></div>";
    let sim = DifferentialEngine::compute_dom_tag_similarity(html_a, html_b).unwrap();
    assert_eq!(sim, 1.0);

    // 3. Structural divergence
    let html_form = "<form method='post'><input type='text'/><button>Submit</button></form>";
    let html_table = "<table><tr><td>Cell</td></tr></table>";
    let sim = DifferentialEngine::compute_dom_tag_similarity(html_form, html_table).unwrap();
    assert_eq!(sim, 0.0);
}

#[test]
fn test_welch_t_test_mathematical_invariants() {
    // 1. Insufficient samples (< 2)
    assert!(DifferentialEngine::compute_welch_t_test(&[50.0], &[50.0, 52.0]).is_none());
    assert!(DifferentialEngine::compute_welch_t_test(&[50.0, 52.0], &[]).is_none());

    // 2. Identical samples with zero variance
    let baseline = vec![50.0, 50.0, 50.0, 50.0];
    let probe = vec![50.0, 50.0, 50.0, 50.0];
    let res = DifferentialEngine::compute_welch_t_test(&baseline, &probe).unwrap();
    assert_eq!(res.welch_t_stat, 0.0);
    assert_eq!(res.delay_delta_ms, 0.0);
    assert!(!res.is_statistically_significant);

    // 3. Realistic timing attack distribution: Baseline N(45ms, 4), Probe N(5050ms, 4)
    let baseline_samples = vec![44.2, 45.8, 46.1, 43.9, 45.0, 44.8, 45.3, 46.0];
    let probe_samples = vec![5048.1, 5052.4, 5049.9, 5051.0, 5050.5, 5048.8, 5053.2, 5050.1];
    let res = DifferentialEngine::compute_welch_t_test(&baseline_samples, &probe_samples).unwrap();
    assert!(res.is_statistically_significant);
    assert!(res.welch_t_stat > 100.0);
    assert!((res.delay_delta_ms - 5005.0).abs() < 5.0);
    assert!(res.degrees_of_freedom > 5.0);

    // 4. Probe is faster than baseline (negative delta)
    let fast_probe = vec![10.0, 11.0, 9.8, 10.2];
    let res_fast = DifferentialEngine::compute_welch_t_test(&baseline_samples, &fast_probe).unwrap();
    assert!(!res_fast.is_statistically_significant);
    assert!(res_fast.delay_delta_ms < 0.0);

    // 5. Small delta (< 1000ms threshold)
    let slight_delay = vec![250.0, 255.0, 248.0, 252.0];
    let res_slight = DifferentialEngine::compute_welch_t_test(&baseline_samples, &slight_delay).unwrap();
    assert!(!res_slight.is_statistically_significant); // delay < 1000ms
}

#[test]
fn test_privilege_differential_comprehensive_matrix() {
    let engine = DifferentialEngine::new();

    let admin_payload = r#"{"id": 42, "role": "admin", "secret": "CONFIDENTIAL-INTERNAL-KEY"}"#;
    let low_priv_payload = r#"{"id": 42, "role": "admin", "secret": "CONFIDENTIAL-INTERNAL-KEY"}"#;

    // 1. HighPrivAdmin vs LowPrivUser -> BFLA
    let bfla = engine.evaluate_privilege_differential(
        PrivilegeRole::HighPrivilegeAdmin,
        200,
        admin_payload,
        PrivilegeRole::LowPrivilegeUser,
        200,
        low_priv_payload,
        None,
    );
    assert_eq!(bfla.classification, DifferentialClassification::PermittedAccess);
    assert!(bfla.rationale.contains("BFLA / Privilege Escalation"));

    // 2. HighPrivAdmin vs CrossTenantUser -> BOLA / IDOR
    let bola = engine.evaluate_privilege_differential(
        PrivilegeRole::HighPrivilegeAdmin,
        200,
        admin_payload,
        PrivilegeRole::CrossTenantUser,
        200,
        low_priv_payload,
        None,
    );
    assert_eq!(bola.classification, DifferentialClassification::PermittedAccess);
    assert!(bola.rationale.contains("BOLA / IDOR"));

    // 3. HighPrivAdmin vs UnauthenticatedGuest -> Unauthenticated Access
    let unauth = engine.evaluate_privilege_differential(
        PrivilegeRole::HighPrivilegeAdmin,
        200,
        admin_payload,
        PrivilegeRole::UnauthenticatedGuest,
        200,
        low_priv_payload,
        None,
    );
    assert_eq!(unauth.classification, DifferentialClassification::PermittedAccess);
    assert!(unauth.rationale.contains("Unauthenticated Access"));

    // 4. Properly Enforced Deny (401, 403, 404)
    for deny_code in [401, 403, 404] {
        let deny = engine.evaluate_privilege_differential(
            PrivilegeRole::HighPrivilegeAdmin,
            200,
            admin_payload,
            PrivilegeRole::LowPrivilegeUser,
            deny_code,
            "Access Denied",
            None,
        );
        assert_eq!(deny.classification, DifferentialClassification::EnforcedDeny);
    }

    // 5. Structural Anomaly: same role, different body
    let divergent_body = r#"{"error": "invalid parameter", "help": "/docs"}"#;
    let anomaly = engine.evaluate_privilege_differential(
        PrivilegeRole::LowPrivilegeUser,
        200,
        admin_payload,
        PrivilegeRole::LowPrivilegeUser,
        200,
        divergent_body,
        None,
    );
    assert_eq!(anomaly.classification, DifferentialClassification::StructuralAnomaly);

    // 6. Identical responses: same role, identical body
    let identical = engine.evaluate_privilege_differential(
        PrivilegeRole::LowPrivilegeUser,
        200,
        admin_payload,
        PrivilegeRole::LowPrivilegeUser,
        200,
        admin_payload,
        None,
    );
    assert_eq!(identical.classification, DifferentialClassification::Identical);

    // 7. Status delta -> Indeterminate
    let status_mismatch = engine.evaluate_privilege_differential(
        PrivilegeRole::HighPrivilegeAdmin,
        200,
        admin_payload,
        PrivilegeRole::HighPrivilegeAdmin,
        500,
        "Server Error",
        None,
    );
    assert_eq!(status_mismatch.classification, DifferentialClassification::Indeterminate);
}

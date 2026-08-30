use sentinel_authz::*;
use serde_json::json;

#[test]
fn test_shannon_entropy_calculation_and_masking() {
    // 1. Plain English text (low entropy < 3.2)
    let english = "hello world this is a standard test message";
    let english_entropy = ShannonEntropyMasker::calculate_entropy(english);
    assert!(english_entropy < 3.8);

    // 2. High-entropy random token / hex hash (entropy >= 3.8)
    let token = "a8f9c2d1e4b70693a8f9c2d1e4b70693";
    let token_entropy = ShannonEntropyMasker::calculate_entropy(token);
    assert!(token_entropy >= 3.8);

    // 3. Volatile token masking on dynamic JSON response
    let raw_json = json!({
        "status": "success",
        "userId": "usr_10928",
        "csrfToken": "k9L0_p2Z8!xQ4@w9A8F7",
        "sessionNonce": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "createdAt": "2026-08-23T10:00:00Z",
        "roles": ["auditor", "admin"]
    })
    .to_string();

    let (masked_json, count) = ShannonEntropyMasker::mask_volatile_json(&raw_json, 3.8);
    assert!(count >= 3);
    assert!(masked_json.contains("{{VOLATILE_TOKEN}}"));
    assert!(masked_json.contains("usr_10928"));
    assert!(masked_json.contains("auditor"));
}

#[test]
fn test_ast_idor_parameter_substitution_all_locations() {
    // 1. Path parameter substitution
    let path_uri = "/api/v1/workspaces/ws_999/documents/doc_123?filter=active";
    let new_path_uri = AstIdorSubstitutor::extract_and_substitute_path(path_uri, "ws_999", "ws_888");
    assert_eq!(
        new_path_uri,
        "/api/v1/workspaces/ws_888/documents/doc_123?filter=active"
    );

    // 2. Query parameter substitution
    let query_uri = "/api/v1/billing?account_id=acc_100&tenant=t1";
    let new_query_uri = AstIdorSubstitutor::extract_and_substitute_query(query_uri, "account_id", "acc_999");
    assert_eq!(new_query_uri, "/api/v1/billing?account_id=acc_999&tenant=t1");

    // 3. JSON body AST substitution
    let json_body = json!({
        "action": "transfer",
        "source": {
            "accountId": "acc_100",
            "userId": "usr_1"
        },
        "amount": 500
    })
    .to_string();

    let new_json = AstIdorSubstitutor::extract_and_substitute_json(
        &json_body,
        "accountId",
        &json!("acc_999"),
    )
    .unwrap();
    assert!(new_json.contains("\"acc_999\""));
    assert!(!new_json.contains("\"acc_100\""));

    // 4. Header substitution
    let headers = vec![
        ("Host".to_string(), "api.sentinel.dev".to_string()),
        ("X-Tenant-ID".to_string(), "tenant_alpha".to_string()),
    ];
    let new_headers = AstIdorSubstitutor::extract_and_substitute_headers(&headers, "X-Tenant-ID", "tenant_beta");
    assert_eq!(new_headers[1].1, "tenant_beta");
}

#[test]
fn test_privilege_divergence_oracle_bfla_bola_and_enforced_deny() {
    let baseline_admin = RoleResponseData {
        role: PrivilegeRole::Admin,
        status: 200,
        headers: vec![("content-type".to_string(), "application/json".to_string())],
        body: json!({
            "status": "success",
            "data": {
                "organization": "Security Corp",
                "membersCount": 50,
                "adminSettings": { "mfaRequired": true }
            }
        })
        .to_string(),
    };

    // 1. Enforced Deny (403 Forbidden)
    let safe_probe = RoleResponseData {
        role: PrivilegeRole::User,
        status: 403,
        headers: vec![],
        body: r#"{"error": "Forbidden"}"#.to_string(),
    };
    let (verdict_safe, _) = PrivilegeDivergenceOracle::evaluate_role_differential(&baseline_admin, &safe_probe);
    assert_eq!(verdict_safe, AuthzVerdict::EnforcedDeny);

    // 2. BFLA Privilege Escalation (Low-privilege User accessing Admin endpoint with 200 OK)
    let bfla_probe = RoleResponseData {
        role: PrivilegeRole::User,
        status: 200,
        headers: vec![("content-type".to_string(), "application/json".to_string())],
        body: json!({
            "status": "success",
            "data": {
                "organization": "Security Corp",
                "membersCount": 50,
                "adminSettings": { "mfaRequired": true }
            }
        })
        .to_string(),
    };
    let (verdict_bfla, sim_bfla) = PrivilegeDivergenceOracle::evaluate_role_differential(&baseline_admin, &bfla_probe);
    assert_eq!(verdict_bfla, AuthzVerdict::BflaEscalation);
    assert!(sim_bfla >= 0.85);

    // 3. BOLA / IDOR Leak (Cross-Tenant Attacker accessing private object with 200 OK)
    let bola_probe = RoleResponseData {
        role: PrivilegeRole::Attacker,
        status: 200,
        headers: vec![],
        body: baseline_admin.body.clone(),
    };
    let (verdict_bola, sim_bola) = PrivilegeDivergenceOracle::evaluate_role_differential(&baseline_admin, &bola_probe);
    assert_eq!(verdict_bola, AuthzVerdict::BolaIdorLeak);
    assert_eq!(sim_bola, 1.0);

    // 4. Unauthenticated Leak (Guest accessing with 200 OK)
    let guest_probe = RoleResponseData {
        role: PrivilegeRole::Guest,
        status: 200,
        headers: vec![],
        body: baseline_admin.body.clone(),
    };
    let (verdict_guest, _) = PrivilegeDivergenceOracle::evaluate_role_differential(&baseline_admin, &guest_probe);
    assert_eq!(verdict_guest, AuthzVerdict::UnauthenticatedLeak);
}

use chrono::Utc;

use sentinel_common::enums::{HttpMethod, Severity};
use sentinel_common::traits::ResearchPackManager;
use sentinel_plugin::{
    DefaultResearchPackManager, PackProbeDefinition, ResearchPack, ResearchPackCheck,
    ResearchPackDictionary, ResearchPackManifest, ResearchPackVerifier,
};

#[test]
fn test_research_pack_signing_and_cryptographic_verification() {
    let secret_key = b"super-secure-sentinel-signing-key-32b";

    let manifest = ResearchPackManifest {
        pack_id: "pack_spring_boot_actuator".to_string(),
        name: "Spring Boot Actuator Security Pack".to_string(),
        version: "1.2.0".to_string(),
        author: "SENTINEL Vulnerability Labs".to_string(),
        min_sentinel_version: "6.0.0".to_string(),
        created_at: Utc::now(),
        signature_algorithm: String::new(),
        signature: String::new(),
    };

    let check = ResearchPackCheck {
        check_id: "SPRING-ACTUATOR-ENV".to_string(),
        name: "Exposed Spring Boot Actuator /env".to_string(),
        category: "Information Disclosure".to_string(),
        severity: Severity::High,
        confidence: 0.95,
        cwe: Some(200),
        remediation: "Disable sensitive actuator endpoints in application.properties".to_string(),
        probes: vec![PackProbeDefinition {
            probe_id: "probe_actuator_env".to_string(),
            http_method: HttpMethod::GET,
            path_suffix: "/actuator/env".to_string(),
            payload: "".to_string(),
            insertion_point: "Path".to_string(),
            expected_indicator: "spring.datasource.password".to_string(),
        }],
    };

    let dictionary = ResearchPackDictionary {
        name: "spring_actuator_endpoints".to_string(),
        category: "Path".to_string(),
        entries: vec![
            "/actuator/env".to_string(),
            "/actuator/heapdump".to_string(),
            "/actuator/mappings".to_string(),
        ],
    };

    let mut pack = ResearchPack {
        manifest,
        checks: vec![check],
        dictionaries: vec![dictionary],
    };

    // 1. Sign the pack
    ResearchPackVerifier::sign_pack(&mut pack, secret_key);
    assert_eq!(pack.manifest.signature_algorithm, "HMAC-SHA256");
    assert!(!pack.manifest.signature.is_empty());

    // 2. Verify with correct secret -> true
    let is_valid = ResearchPackVerifier::verify_pack(&pack, secret_key).expect("Verification succeeds");
    assert!(is_valid);

    // 3. Verify with wrong secret -> Integrity error
    let wrong_key = b"wrong-secret-key-attacker";
    let wrong_res = ResearchPackVerifier::verify_pack(&pack, wrong_key);
    assert!(wrong_res.is_err());

    // 4. Test tampering detection
    pack.checks[0].name = "Tampered Probe Name".to_string();
    let tampered_res = ResearchPackVerifier::verify_pack(&pack, secret_key);
    assert!(tampered_res.is_err());
}

#[tokio::test]
async fn test_research_pack_manager_registration_and_hot_reload() {
    let secret = b"my-research-pack-signing-secret";
    let manager = DefaultResearchPackManager::with_secret(secret);

    let manifest = ResearchPackManifest {
        pack_id: "pack_graphql_security".to_string(),
        name: "GraphQL Security Audit Pack".to_string(),
        version: "2.0.0".to_string(),
        author: "SENTINEL Team".to_string(),
        min_sentinel_version: "6.0.0".to_string(),
        created_at: Utc::now(),
        signature_algorithm: String::new(),
        signature: String::new(),
    };

    let check = ResearchPackCheck {
        check_id: "GRAPHQL-BATCHING-DOS".to_string(),
        name: "GraphQL Query Batching Abuse".to_string(),
        category: "Denial of Service".to_string(),
        severity: Severity::Medium,
        confidence: 0.85,
        cwe: Some(400),
        remediation: "Disable batch query execution in GraphQL server config".to_string(),
        probes: vec![],
    };

    let mut pack = ResearchPack {
        manifest,
        checks: vec![check],
        dictionaries: vec![],
    };

    ResearchPackVerifier::sign_pack(&mut pack, secret);

    // Register signed pack
    manager.register_signed_pack(pack).expect("Pack registration succeeds");

    let checks = manager.list_checks("pack_graphql_security").await.unwrap();
    assert_eq!(checks.len(), 1);
    assert_eq!(checks[0].id, "GRAPHQL-BATCHING-DOS");

    // Hot reload existing pack
    manager.hot_reload("pack_graphql_security").await.expect("Hot reload succeeds");

    // Hot reload nonexistent pack returns error
    let err = manager.hot_reload("nonexistent_pack").await;
    assert!(err.is_err());
}

#[tokio::test]
async fn test_enterprise_trust_store_multi_key_rotation_and_revocation() {
    use sentinel_plugin::TrustAnchor;

    let manager = DefaultResearchPackManager::new();

    // 1. Add Custom Enterprise Trust Anchor
    let corp_key = b"corp-enterprise-key-2026";
    manager.add_trust_anchor(TrustAnchor::new("corp-prod-01", corp_key.to_vec()));

    let manifest = ResearchPackManifest {
        pack_id: "pack_corp_compliance".to_string(),
        name: "Corporate Compliance Checks".to_string(),
        version: "1.0.0".to_string(),
        author: "Enterprise Security Team".to_string(),
        min_sentinel_version: "6.0.0".to_string(),
        created_at: Utc::now(),
        signature_algorithm: String::new(),
        signature: String::new(),
    };

    let mut pack = ResearchPack {
        manifest,
        checks: vec![],
        dictionaries: vec![],
    };

    // Sign with corp key
    ResearchPackVerifier::sign_pack(&mut pack, corp_key);

    // Registration succeeds via EnterpriseTrustStore
    manager.register_signed_pack(pack.clone()).expect("Pack registers with corp key");

    // 2. Revoke the key
    manager.revoke_trust_key("corp-prod-01");

    // Re-registration or verification with revoked key fails
    let revoke_res = manager.register_signed_pack(pack);
    assert!(revoke_res.is_err(), "Revoked key must fail registration");
}

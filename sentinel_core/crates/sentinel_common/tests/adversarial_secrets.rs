// SENTINEL V6: Adversarial Stress Test Suite for Secret Redaction & Memory Safety (SEC-09)
// crates/sentinel_common/tests/adversarial_secrets.rs
//
// Empirical Verification of:
// 1. Formatting attacks ({:?}, {:#?}, {}, {:#}, width, precision, padding, alignment)
// 2. Leak checks (never leaks in debug, display, serialize, nested structures, collections)
// 3. Zeroize behavior & drop semantics (Zeroize, ZeroizeOnDrop, drop cycles, clone independence)
// 4. Memory safety, thread safety (Send + Sync concurrency stress)
// 5. Adversarial payloads (null bytes, JSON syntax, format strings, unicode, large payloads)
// 6. Streaming serialization, malformed input fail-closed behavior, error codes

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};

use sentinel_common::{
    is_sensitive_key, redact_sensitive_value, AccessLevel, Action, Asset, Credential,
    EntityMetadata, Finding, FindingLifecycle, HttpMethod, HttpParsedParts, Identity,
    MessageRepresentation, Note, Observation, ObservationSource, Provenance, Report, ReportFormat,
    Scope, Screenshot, SecretBytes, SecretReference, SecretString, SentinelError, Session,
    Severity, Task, TaskLifecycle, TlsData, Transaction, REDACTED_PLACEHOLDER,
};

// ============================================================================
// Helper Assertion: Comprehensive Secret Leak Scanner
// ============================================================================
fn assert_no_secret_leak(haystack: &str, raw_secret: &str, context: &str) {
    if !raw_secret.is_empty() && raw_secret.len() >= 3 && !REDACTED_PLACEHOLDER.contains(raw_secret)
    {
        assert!(
            !haystack.contains(raw_secret),
            "SECURITY VIOLATION: Plaintext secret leaked in {context}!\nLeaked Secret: {raw_secret}\nOutput: {haystack}"
        );
    }
}

fn assert_no_byte_leak(haystack: &[u8], raw_bytes: &[u8], context: &str) {
    if !raw_bytes.is_empty() && raw_bytes.len() >= 4 {
        let leaked = haystack
            .windows(raw_bytes.len())
            .any(|window| window == raw_bytes);
        assert!(
            !leaked,
            "SECURITY VIOLATION: Raw secret byte sequence leaked in {context}!"
        );
    }
}

// ============================================================================
// 1. FORMATTING ATTACKS
// ============================================================================

#[test]
fn test_adversarial_formatting_secret_string() {
    let secret = "SuperSecret_P@ssw0rd_999!#&_SpecialKey";
    let secure = SecretString::new(secret);

    // Test a variety of format strings: standard, pretty, padded, aligned
    let f1 = format!("{:?}", secure);
    let f2 = format!("{:#?}", secure);
    let f3 = format!("{}", secure);
    let f4 = format!("{:#}", secure);
    let f5 = format!("{:50?}", secure);
    let f6 = format!("{:<50?}", secure);
    let f7 = format!("{:>50?}", secure);
    let f8 = format!("{:^50?}", secure);
    let f9 = format!("{:50}", secure);
    let f10 = format!("{:<50}", secure);
    let f11 = format!("{:>50}", secure);
    let f12 = format!("{:^50}", secure);

    let formats = [
        ("Debug", &f1),
        ("Pretty Debug", &f2),
        ("Display", &f3),
        ("Alternate Display", &f4),
        ("Padded Debug", &f5),
        ("Left-aligned Debug", &f6),
        ("Right-aligned Debug", &f7),
        ("Center-aligned Debug", &f8),
        ("Padded Display", &f9),
        ("Left-aligned Display", &f10),
        ("Right-aligned Display", &f11),
        ("Center-aligned Display", &f12),
    ];

    for (name, output) in &formats {
        assert_no_secret_leak(output, secret, name);
        assert!(
            output.contains(REDACTED_PLACEHOLDER),
            "Format {name} did not contain the REDACTED placeholder: {output}"
        );
    }
}

#[test]
fn test_adversarial_formatting_secret_bytes() {
    let raw_bytes = vec![0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x23, 0x45, 0x67, 0x89, 0xAB];
    let secure = SecretBytes::new(raw_bytes.clone());

    let f1 = format!("{:?}", secure);
    let f2 = format!("{:#?}", secure);
    let f3 = format!("{}", secure);
    let f4 = format!("{:#}", secure);
    let f5 = format!("{:40?}", secure);
    let f6 = format!("{:>40}", secure);

    let formats = [
        ("Debug", &f1),
        ("Pretty Debug", &f2),
        ("Display", &f3),
        ("Alternate Display", &f4),
        ("Padded Debug", &f5),
        ("Padded Display", &f6),
    ];

    for (name, output) in &formats {
        assert_no_byte_leak(output.as_bytes(), &raw_bytes, name);
        assert!(
            output.contains(REDACTED_PLACEHOLDER),
            "Format {name} did not contain REDACTED placeholder: {output}"
        );
    }
}

#[test]
fn test_adversarial_formatting_credential_and_secret_reference() {
    let secret_ref_id = Uuid::new_v4();
    let secret_ref = SecretReference::with_id(secret_ref_id, "aws_secrets_manager");
    let cred = Credential::new(
        Uuid::new_v4(),
        "BearerToken",
        secret_ref_id,
        AccessLevel::Admin,
    );

    // Verify format strings for SecretReference
    let ref_debug = format!("{:?}", secret_ref);
    let ref_pretty = format!("{:#?}", secret_ref);
    let ref_disp = format!("{}", secret_ref);

    assert!(ref_debug.contains("aws_secrets_manager"));
    assert!(ref_pretty.contains("aws_secrets_manager"));
    assert!(ref_disp.contains("aws_secrets_manager"));
    assert!(ref_disp.contains(&secret_ref_id.to_string()));

    // Verify format strings for Credential
    let cred_debug = format!("{:?}", cred);
    let cred_pretty = format!("{:#?}", cred);
    let cred_disp = format!("{}", cred);

    assert!(cred_debug.contains("BearerToken"));
    assert!(cred_pretty.contains("BearerToken"));
    assert!(cred_disp.contains("BearerToken"));
    assert!(cred_disp.contains(&secret_ref_id.to_string()));

    // Ensure no raw secret field can ever exist in Credential
    let cred_json = serde_json::to_string(&cred).unwrap();
    assert!(!cred_json.contains("secret\""));
    assert!(cred_json.contains("secret_reference"));
}

// ============================================================================
// 2. SERIALIZATION ATTACKS & DEEP NESTING
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct ComplexAdversarialContainer {
    pub name: String,
    pub primary_secret: SecretString,
    pub backup_secrets: Vec<SecretString>,
    pub secret_map: HashMap<String, SecretString>,
    pub secret_btree: BTreeMap<String, SecretBytes>,
    pub optional_secret: Option<SecretString>,
    pub nested_tuple: (SecretString, SecretBytes),
    pub credential_ref: Credential,
    pub vault_ref: SecretReference,
}

#[test]
fn test_deeply_nested_struct_serialization_leak_check() {
    let secret_1 = "PRIMARY_MASTER_KEY_XYZ_111";
    let secret_2 = "BACKUP_SECRET_222";
    let secret_3 = "BACKUP_SECRET_333";
    let secret_map_val = "MAP_CONFIDENTIAL_TOKEN_444";
    let secret_bytes_val = vec![0x13, 0x37, 0xC0, 0xDE];
    let opt_secret = "OPTIONAL_SECRET_VAL_555";
    let tuple_sec_str = "TUPLE_SECRET_STRING_666";
    let tuple_sec_bytes = vec![0xAA, 0xBB, 0xCC, 0xDD];

    let mut secret_map = HashMap::new();
    secret_map.insert(
        "service_token".to_string(),
        SecretString::new(secret_map_val),
    );

    let mut secret_btree = BTreeMap::new();
    secret_btree.insert(
        "crypto_key".to_string(),
        SecretBytes::new(secret_bytes_val.clone()),
    );

    let sec_ref = SecretReference::new("hashicorp_vault");
    let cred = Credential::new(
        Uuid::new_v4(),
        "JwtToken",
        sec_ref.reference_id,
        AccessLevel::User,
    );

    let container = ComplexAdversarialContainer {
        name: "SecurityContextAudit".to_string(),
        primary_secret: SecretString::new(secret_1),
        backup_secrets: vec![SecretString::new(secret_2), SecretString::new(secret_3)],
        secret_map,
        secret_btree,
        optional_secret: Some(SecretString::new(opt_secret)),
        nested_tuple: (
            SecretString::new(tuple_sec_str),
            SecretBytes::new(tuple_sec_bytes.clone()),
        ),
        credential_ref: cred,
        vault_ref: sec_ref,
    };

    // 1. Check Debug formatting
    let debug_out = format!("{:?}", container);
    let pretty_debug = format!("{:#?}", container);

    let all_string_secrets = [
        secret_1,
        secret_2,
        secret_3,
        secret_map_val,
        opt_secret,
        tuple_sec_str,
    ];

    for s in &all_string_secrets {
        assert_no_secret_leak(&debug_out, s, "ComplexContainer Debug");
        assert_no_secret_leak(&pretty_debug, s, "ComplexContainer Pretty Debug");
    }

    // 2. Check JSON Serialization (compact and pretty)
    let json_compact =
        serde_json::to_string(&container).expect("Compact JSON serialization failed");
    let json_pretty =
        serde_json::to_string_pretty(&container).expect("Pretty JSON serialization failed");
    let json_value = serde_json::to_value(&container).expect("JSON Value conversion failed");
    let json_vec = serde_json::to_vec(&container).expect("JSON Vec serialization failed");

    for s in &all_string_secrets {
        assert_no_secret_leak(&json_compact, s, "Compact JSON");
        assert_no_secret_leak(&json_pretty, s, "Pretty JSON");
        assert_no_secret_leak(&json_value.to_string(), s, "JSON Value");
        assert_no_byte_leak(&json_vec, s.as_bytes(), "JSON Vec");
    }

    assert_no_byte_leak(&json_vec, &secret_bytes_val, "JSON Vec secret_bytes_val");
    assert_no_byte_leak(&json_vec, &tuple_sec_bytes, "JSON Vec tuple_sec_bytes");

    // 3. Verify that all secret fields in serialized JSON strictly output "[REDACTED]"
    assert_eq!(json_value["primary_secret"], REDACTED_PLACEHOLDER);
    assert_eq!(json_value["backup_secrets"][0], REDACTED_PLACEHOLDER);
    assert_eq!(json_value["backup_secrets"][1], REDACTED_PLACEHOLDER);
    assert_eq!(
        json_value["secret_map"]["service_token"],
        REDACTED_PLACEHOLDER
    );
    assert_eq!(
        json_value["secret_btree"]["crypto_key"],
        REDACTED_PLACEHOLDER
    );
    assert_eq!(json_value["optional_secret"], REDACTED_PLACEHOLDER);
    assert_eq!(json_value["nested_tuple"][0], REDACTED_PLACEHOLDER);
    assert_eq!(json_value["nested_tuple"][1], REDACTED_PLACEHOLDER);
}

#[test]
fn test_deserialization_from_inbound_payloads() {
    // 1. Deserializing SecretString from inbound JSON payload
    let inbound_json = r#"{"secret": "inbound_api_token_value_abc"}"#;
    #[derive(Deserialize)]
    struct InboundConfig {
        secret: SecretString,
    }
    let parsed: InboundConfig = serde_json::from_str(inbound_json).unwrap();
    assert_eq!(parsed.secret.expose_secret(), "inbound_api_token_value_abc");

    // 2. Deserializing SecretBytes from inbound byte array payload
    let inbound_bytes_json = r#"{"bytes": [18, 52, 86, 120]}"#;
    #[derive(Deserialize)]
    struct InboundBytesConfig {
        bytes: SecretBytes,
    }
    let parsed_bytes: InboundBytesConfig = serde_json::from_str(inbound_bytes_json).unwrap();
    assert_eq!(parsed_bytes.bytes.expose_secret(), &[18, 52, 86, 120]);
}

#[test]
fn test_stream_writer_serialization_leak_check() {
    let secret = "STREAMING_SECRET_DATA_XYZ_9876";
    let sec_str = SecretString::new(secret);
    let mut buffer = Vec::new();
    serde_json::to_writer(&mut buffer, &sec_str).unwrap();
    let written = String::from_utf8(buffer).unwrap();
    assert_eq!(written, format!("\"{}\"", REDACTED_PLACEHOLDER));
    assert_no_secret_leak(&written, secret, "Stream Writer");
}

#[test]
fn test_malformed_json_deserialization_fail_closed() {
    // Malformed JSON for SecretString (e.g. number instead of string)
    let bad_json_1 = "12345";
    let res1 = serde_json::from_str::<SecretString>(bad_json_1);
    assert!(res1.is_err());

    let bad_json_2 = "{\"invalid\": \"object\"}";
    let res2 = serde_json::from_str::<SecretString>(bad_json_2);
    assert!(res2.is_err());

    // Malformed JSON for SecretBytes (e.g. string instead of byte array)
    let bad_bytes_json = "\"plain_string_instead_of_byte_array\"";
    let res3 = serde_json::from_str::<SecretBytes>(bad_bytes_json);
    assert!(res3.is_err());
}

// ============================================================================
// 3. DOMAIN MODEL INTEGRATION TESTS
// ============================================================================

#[test]
fn test_domain_models_with_secret_and_credential_embedding() {
    let meta = EntityMetadata::new(Provenance::Scanner);

    let sec_ref = SecretReference::new("cyberark_vault");
    let cred = Credential::new(
        Uuid::new_v4(),
        "OAuth2",
        sec_ref.reference_id,
        AccessLevel::Admin,
    );

    // 1. Transaction containing sensitive authorization header
    let raw_auth_token = "Bearer secret_jwt_token_payload_xyz123";
    let tx = Transaction {
        meta: meta.clone(),
        request: MessageRepresentation {
            raw_blob_id: Uuid::new_v4(),
            parsed: HttpParsedParts {
                method: HttpMethod::POST,
                uri: "https://api.example.com/v1/transfer".to_string(),
                version: "HTTP/1.1".to_string(),
                headers: vec![
                    (b"Host".to_vec(), b"api.example.com".to_vec()),
                    (
                        b"Authorization".to_vec(),
                        raw_auth_token.as_bytes().to_vec(),
                    ),
                ],
            },
            normalized_text: format!(
                "POST /v1/transfer HTTP/1.1\r\nAuthorization: {raw_auth_token}\r\n\r\n"
            ),
        },
        response: None,
        timing: Duration::from_millis(15),
        tls_info: Some(TlsData {
            protocol: "TLSv1.3".to_string(),
            cipher: "TLS_AES_256_GCM_SHA384".to_string(),
            server_name: Some("api.example.com".to_string()),
            alpn: Some("h2".to_string()),
        }),
    };

    // 2. Observation
    let obs = Observation {
        meta: meta.clone(),
        source: ObservationSource::Proxy,
        data_ref: tx.meta.id,
    };

    // 3. Finding
    let finding = Finding {
        meta: meta.clone(),
        title: "Sensitive data exposure in authentication endpoint".to_string(),
        severity: Severity::High,
        verification_id: Uuid::new_v4(),
        state: FindingLifecycle::Verified,
    };

    // 4. Scope
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["*.corp.example.com".to_string()],
        excludes: vec!["internal.corp.example.com".to_string()],
    };

    // 5. Session
    let mut cookies = HashMap::new();
    cookies.insert(
        "session_id".to_string(),
        "sess_secret_token_val_99".to_string(),
    );
    let mut headers = HashMap::new();
    headers.insert("X-Secret-Header".to_string(), "header_val_99".to_string());
    let session = Session {
        id: Uuid::new_v4(),
        identity_id: Uuid::new_v4(),
        cookies,
        headers,
        created_at: Utc::now(),
        expires_at: None,
    };

    // 6. Identity
    let identity = Identity {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        username: "admin_user".to_string(),
        roles: vec!["admin".to_string()],
        meta: Some(meta.clone()),
    };

    // 7. Asset
    let asset = Asset {
        id: Uuid::new_v4(),
        asset_type: "Database".to_string(),
        identifier: "db.corp.internal".to_string(),
        metadata: HashMap::new(),
    };

    // 8. Action
    let action = Action {
        action_id: Uuid::new_v4(),
        action_type: "AuthProbe".to_string(),
        parameters: HashMap::new(),
    };

    // 9. Task
    let task = Task {
        id: Uuid::new_v4(),
        task_type: "Scan".to_string(),
        priority: 1,
        state: TaskLifecycle::Pending,
        progress_pct: 0.0,
    };

    // 10. Report
    let report = Report {
        id: Uuid::new_v4(),
        title: "Security Assessment".to_string(),
        format: ReportFormat::Json,
        file_path: "assessment.json".to_string(),
        config_json: "{}".to_string(),
        generated_at: Utc::now(),
    };

    // 11. Note
    let note = Note {
        id: Uuid::new_v4(),
        target_id: finding.meta.id,
        author: "sec_tester".to_string(),
        content: "Verified zero leakage in all models".to_string(),
        timestamp: Utc::now(),
    };

    // 12. Screenshot
    let screenshot = Screenshot {
        id: Uuid::new_v4(),
        blob_id: Uuid::new_v4(),
        full_page: false,
        timestamp: Utc::now(),
    };

    // Verify Debug and JSON serialization of domain entities
    let obs_json = serde_json::to_string(&obs).unwrap();
    let finding_json = serde_json::to_string(&finding).unwrap();
    let cred_json = serde_json::to_string(&cred).unwrap();
    let sec_ref_json = serde_json::to_string(&sec_ref).unwrap();
    let scope_json = serde_json::to_string(&scope).unwrap();
    let sess_json = serde_json::to_string(&session).unwrap();
    let id_json = serde_json::to_string(&identity).unwrap();
    let asset_json = serde_json::to_string(&asset).unwrap();
    let act_json = serde_json::to_string(&action).unwrap();
    let task_json = serde_json::to_string(&task).unwrap();
    let rep_json = serde_json::to_string(&report).unwrap();
    let note_json = serde_json::to_string(&note).unwrap();
    let ss_json = serde_json::to_string(&screenshot).unwrap();

    assert!(obs_json.contains(&meta.id.to_string()));
    assert!(finding_json.contains(&finding.title));
    assert!(cred_json.contains(&sec_ref.reference_id.to_string()));
    assert!(sec_ref_json.contains("cyberark_vault"));
    assert!(scope_json.contains("*.corp.example.com"));
    assert!(sess_json.contains("sess_secret_token_val_99"));
    assert!(id_json.contains("admin_user"));
    assert!(asset_json.contains("db.corp.internal"));
    assert!(act_json.contains("AuthProbe"));
    assert!(task_json.contains("Scan"));
    assert!(rep_json.contains("assessment.json"));
    assert!(note_json.contains("sec_tester"));
    assert!(ss_json.contains(&screenshot.blob_id.to_string()));
}

// ============================================================================
// 4. ADVERSARIAL PAYLOAD VARIATIONS
// ============================================================================

#[test]
fn test_adversarial_payload_variations() {
    let adversarial_payloads: Vec<(&str, String)> = vec![
        ("Empty String", "".to_string()),
        ("Single Char", "Z".to_string()),
        (
            "Format Specifiers",
            "{0} %s %d {:?} {:#?} {{escaped}}".to_string(),
        ),
        (
            "JSON Injection",
            "{\"nested\": \"secret\", \"leak\": true, \"null\": null}".to_string(),
        ),
        (
            "SQL Injection",
            "' OR '1'='1'; DROP TABLE credentials; --".to_string(),
        ),
        (
            "Null Bytes Inside",
            "prefix\0secret_null_bytes\0suffix".to_string(),
        ),
        (
            "CRLF and Control Chars",
            "line1\r\nline2\x01\x02\x03\x1B[31mRed\x1B[0m".to_string(),
        ),
        (
            "Unicode Homoglyphs & Emoji",
            "🔑🗝️🔒🔐S3cr3t-密码-секрет-مفتاح-日本語".to_string(),
        ),
        (
            "HTML/XML Tags",
            "<secret_tag attr=\"sensitive\">secret_val</secret_tag>".to_string(),
        ),
        (
            "Self Redacted Collision",
            format!("fake_key_{}_tail", REDACTED_PLACEHOLDER),
        ),
        ("Large 64KB Payload", "X".repeat(65536)),
    ];

    for (desc, payload) in adversarial_payloads {
        let sec_str = SecretString::new(&payload);

        // Debug check
        let debug_str = format!("{:?}", sec_str);
        assert_no_secret_leak(&debug_str, &payload, &format!("Debug of {desc}"));
        assert_eq!(debug_str, format!("\"{}\"", REDACTED_PLACEHOLDER));

        // Display check
        let disp_str = format!("{}", sec_str);
        assert_no_secret_leak(&disp_str, &payload, &format!("Display of {desc}"));
        assert_eq!(disp_str, REDACTED_PLACEHOLDER);

        // JSON check
        let json_str = serde_json::to_string(&sec_str).unwrap();
        assert_no_secret_leak(&json_str, &payload, &format!("JSON of {desc}"));
        assert_eq!(json_str, format!("\"{}\"", REDACTED_PLACEHOLDER));

        // Exposure check
        assert_eq!(sec_str.expose_secret(), payload);
        assert_eq!(sec_str.len(), payload.len());
        assert_eq!(sec_str.is_empty(), payload.is_empty());
        assert_eq!(sec_str.as_bytes(), payload.as_bytes());
    }
}

#[test]
fn test_large_secret_bytes_1mb_payload() {
    let large_size = 1024 * 1024; // 1 MB
    let large_bytes: Vec<u8> = (0..large_size).map(|i| (i % 256) as u8).collect();
    let sec_bytes = SecretBytes::new(large_bytes.clone());

    assert_eq!(sec_bytes.len(), large_size);
    assert!(!sec_bytes.is_empty());
    assert_eq!(sec_bytes.expose_secret(), large_bytes.as_slice());

    // Debug output is constant size "[REDACTED]"
    let debug_str = format!("{:?}", sec_bytes);
    assert_eq!(debug_str, format!("\"{}\"", REDACTED_PLACEHOLDER));

    // Display output is constant size "[REDACTED]"
    let display_str = format!("{}", sec_bytes);
    assert_eq!(display_str, REDACTED_PLACEHOLDER);

    // JSON serialization output is constant size "\"[REDACTED]\""
    let json_str = serde_json::to_string(&sec_bytes).unwrap();
    assert_eq!(json_str, format!("\"{}\"", REDACTED_PLACEHOLDER));
}

// ============================================================================
// 5. ZEROIZATION & DROP BEHAVIOR STRESS
// ============================================================================

#[test]
fn test_zeroize_trait_and_memory_clearing() {
    let mut sec_str = SecretString::new("highly_sensitive_ephemeral_token_777");
    assert_eq!(
        sec_str.expose_secret(),
        "highly_sensitive_ephemeral_token_777"
    );
    assert_eq!(sec_str.len(), 36);

    // Explicitly zeroize SecretString
    sec_str.zeroize();
    assert!(sec_str.is_empty());
    assert_eq!(sec_str.len(), 0);
    assert_eq!(sec_str.expose_secret(), "");

    let mut sec_bytes = SecretBytes::new(vec![0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]);
    assert_eq!(sec_bytes.len(), 6);
    assert!(!sec_bytes.is_empty());

    // Explicitly zeroize SecretBytes
    sec_bytes.zeroize();
    assert!(sec_bytes.is_empty());
    assert_eq!(sec_bytes.len(), 0);
    assert_eq!(sec_bytes.expose_secret(), &[] as &[u8]);
}

#[test]
fn test_zeroize_on_drop_type_bounds() {
    // Compile-time and runtime proof that types implement Zeroize and ZeroizeOnDrop
    fn assert_zeroize<T: Zeroize + ZeroizeOnDrop>() {}
    assert_zeroize::<SecretString>();
    assert_zeroize::<SecretBytes>();
}

#[test]
fn test_drop_cycle_allocator_stress() {
    // Stress the allocator with rapid creation and dropping of secrets
    for i in 0..10_000 {
        let payload = format!("ephemeral_loop_secret_token_{i}");
        let sec_str = SecretString::new(payload);
        let sec_bytes = SecretBytes::new(vec![0x42; 128]);

        assert!(!sec_str.is_empty());
        assert_eq!(sec_bytes.len(), 128);
        // Explicitly drop here
        drop(sec_str);
        drop(sec_bytes);
    }
}

#[test]
fn test_clone_independence_and_zeroize() {
    let original_secret = "master_key_clone_test_12345";
    let mut original = SecretString::new(original_secret);
    let cloned = original.clone();

    // Verify both have the secret
    assert_eq!(original.expose_secret(), original_secret);
    assert_eq!(cloned.expose_secret(), original_secret);

    // Zeroize original
    original.zeroize();
    assert!(original.is_empty());
    assert_eq!(original.expose_secret(), "");

    // Verify cloned copy is untouched
    assert_eq!(cloned.expose_secret(), original_secret);
    assert!(!cloned.is_empty());
}

// ============================================================================
// 6. MULTI-THREAD CONCURRENCY & THREAD SAFETY (Send + Sync)
// ============================================================================

#[test]
fn test_thread_safety_send_sync_bounds() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<SecretString>();
    assert_send_sync::<SecretBytes>();
    assert_send_sync::<SecretReference>();
    assert_send_sync::<Credential>();
    assert_send_sync::<Transaction>();
    assert_send_sync::<Observation>();
    assert_send_sync::<Finding>();
}

#[test]
fn test_multithreaded_concurrent_secret_access() {
    let secret = Arc::new(SecretString::new("concurrent_access_secret_token_9999"));
    let bytes = Arc::new(SecretBytes::new(vec![0xCA, 0xFE, 0xBA, 0xBE]));

    let mut handles = Vec::new();

    for _thread_id in 0..32 {
        let secret_clone = Arc::clone(&secret);
        let bytes_clone = Arc::clone(&bytes);

        let handle = std::thread::spawn(move || {
            for _iter in 0..100 {
                // 1. Expose check
                assert_eq!(
                    secret_clone.expose_secret(),
                    "concurrent_access_secret_token_9999"
                );
                assert_eq!(bytes_clone.expose_secret(), &[0xCA, 0xFE, 0xBA, 0xBE]);

                // 2. Format checks
                let s_debug = format!("{:?}", *secret_clone);
                let b_debug = format!("{:?}", *bytes_clone);
                assert_eq!(s_debug, format!("\"{}\"", REDACTED_PLACEHOLDER));
                assert_eq!(b_debug, format!("\"{}\"", REDACTED_PLACEHOLDER));

                // 3. Serialization check
                let s_json = serde_json::to_string(&*secret_clone).unwrap();
                let b_json = serde_json::to_string(&*bytes_clone).unwrap();
                assert_eq!(s_json, format!("\"{}\"", REDACTED_PLACEHOLDER));
                assert_eq!(b_json, format!("\"{}\"", REDACTED_PLACEHOLDER));

                // 4. Thread-local clone and drop
                let local_s = (*secret_clone).clone();
                assert_eq!(local_s.len(), 35);
                drop(local_s);
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().expect("Thread execution failed");
    }
}

// ============================================================================
// 7. SENSITIVE KEY HEURISTICS STRESS TESTING
// ============================================================================

#[test]
fn test_adversarial_sensitive_key_heuristics() {
    let sensitive_variations = [
        "password",
        "PASSWORD",
        "PassWord",
        "pAsSwOrD",
        "user_password",
        "db-password",
        "secret",
        "SECRET_KEY",
        "client_secret",
        "sharedSecret",
        "api_token",
        "access-token",
        "TOKEN_V2",
        "csrf_token",
        "auth",
        "Authorization",
        "proxy-authorization",
        "auth_header",
        "key",
        "apiKey",
        "private_key",
        "signing_key",
        "cert",
        "client_cert",
        "ssl_cert_pem",
        "cookie",
        "Set-Cookie",
        "session_cookie",
        "credential",
        "CredentialRef",
        "signature",
        "hmac_signature",
        "private",
        "privateData",
    ];

    for key in &sensitive_variations {
        assert!(
            is_sensitive_key(key),
            "Failed to identify sensitive key heuristic: '{key}'"
        );
        let redacted = redact_sensitive_value(key, "highly_confidential_value");
        assert_eq!(
            redacted, REDACTED_PLACEHOLDER,
            "Failed to redact value for key: '{key}'"
        );
    }

    let non_sensitive_keys = [
        "username",
        "user_id",
        "hostname",
        "ip_address",
        "url",
        "uri",
        "method",
        "path",
        "status_code",
        "timestamp",
        "duration_ms",
        "count",
        "page",
        "limit",
        "scope_id",
        "finding_id",
    ];

    for key in &non_sensitive_keys {
        assert!(
            !is_sensitive_key(key),
            "False positive on sensitive key heuristic: '{key}'"
        );
        let preserved = redact_sensitive_value(key, "safe_public_value");
        assert_eq!(preserved, "safe_public_value");
    }
}

// ============================================================================
// 8. SENTINEL ERROR HIERARCHY INTEGRITY & CODES
// ============================================================================

#[test]
fn test_error_hierarchy_error_codes_and_retryability() {
    let errors = [
        (
            SentinelError::scope_violation("deny"),
            "ERR_SCOPE_004",
            false,
        ),
        (SentinelError::parse_error("syntax"), "ERR_PARSE_006", false),
        (
            SentinelError::invariant_violation("inv"),
            "ERR_INVAR_009",
            false,
        ),
        (SentinelError::auth_error("auth"), "ERR_AUTH_013", false),
        (SentinelError::timeout("timeout"), "ERR_TIME_012", true),
        (
            SentinelError::invalid_configuration("cfg"),
            "ERR_CFG_014",
            false,
        ),
        (SentinelError::serialization("ser"), "ERR_SER_015", false),
        (SentinelError::storage("storage"), "ERR_STR_016", false),
        (SentinelError::integrity("integrity"), "ERR_INT_017", false),
    ];

    for (err, expected_code, expected_retryable) in &errors {
        assert_eq!(err.error_code(), *expected_code);
        assert_eq!(err.is_retryable(), *expected_retryable);
    }
}

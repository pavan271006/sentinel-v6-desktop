// SENTINEL V6: Exhaustive Secret Redaction & Isolation Tests (SEC-09)
// crates/sentinel_common/tests/secret_redaction_tests.rs

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::{
    is_sensitive_key, redact_sensitive_value, AccessLevel, Credential, SecretBytes,
    SecretReference, SecretString, REDACTED_PLACEHOLDER,
};

#[test]
fn test_secret_string_debug_redacted() {
    let secret = "super_secret_api_key_99999_xyz";
    let secure = SecretString::new(secret);

    let debug_output = format!("{:?}", secure);
    assert!(
        !debug_output.contains(secret),
        "Debug output leaked plaintext secret: {}",
        debug_output
    );
    assert_eq!(debug_output, format!("\"{}\"", REDACTED_PLACEHOLDER));
}

#[test]
fn test_secret_string_display_redacted() {
    let secret = "vault_master_key_12345_!@#$%";
    let secure = SecretString::new(secret);

    let display_output = format!("{}", secure);
    assert!(
        !display_output.contains(secret),
        "Display output leaked plaintext secret: {}",
        display_output
    );
    assert_eq!(display_output, REDACTED_PLACEHOLDER);
}

#[test]
fn test_secret_string_serialize_redacted() {
    let secret = "bearer_token_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    let secure = SecretString::new(secret);

    let json = serde_json::to_string(&secure).expect("serialization failed");
    assert!(
        !json.contains(secret),
        "JSON serialization leaked plaintext secret: {}",
        json
    );
    assert_eq!(json, format!("\"{}\"", REDACTED_PLACEHOLDER));
}

#[test]
fn test_secret_string_controlled_exposure() {
    let secret = "temporary_socket_auth_token";
    let secure = SecretString::new(secret);

    assert_eq!(secure.expose_secret(), secret);
    assert_eq!(secure.as_bytes(), secret.as_bytes());
    assert_eq!(secure.len(), secret.len());
    assert!(!secure.is_empty());
}

#[test]
fn test_secret_string_empty() {
    let empty_secret = SecretString::new("");
    assert!(empty_secret.is_empty());
    assert_eq!(empty_secret.len(), 0);
    assert_eq!(
        format!("{:?}", empty_secret),
        format!("\"{}\"", REDACTED_PLACEHOLDER)
    );
    assert_eq!(format!("{}", empty_secret), REDACTED_PLACEHOLDER);
}

#[test]
fn test_secret_bytes_redaction() {
    let raw_bytes = vec![0xca, 0xfe, 0xba, 0xbe, 0x01, 0x02, 0x03, 0x04];
    let secure_bytes = SecretBytes::new(raw_bytes.clone());

    let debug_output = format!("{:?}", secure_bytes);
    assert_eq!(debug_output, format!("\"{}\"", REDACTED_PLACEHOLDER));

    let display_output = format!("{}", secure_bytes);
    assert_eq!(display_output, REDACTED_PLACEHOLDER);

    let json = serde_json::to_string(&secure_bytes).expect("serialization failed");
    assert_eq!(json, format!("\"{}\"", REDACTED_PLACEHOLDER));

    assert_eq!(secure_bytes.expose_secret(), raw_bytes.as_slice());
    assert_eq!(secure_bytes.len(), 8);
    assert!(!secure_bytes.is_empty());
}

#[test]
fn test_credential_struct_never_contains_raw_secret() {
    let identity_id = Uuid::new_v4();
    let secret_ref_id = Uuid::new_v4();
    let raw_secret_plaintext = "my_plaintext_password_that_must_never_be_stored";

    let credential = Credential::new(
        identity_id,
        "OAuth2RefreshToken",
        secret_ref_id,
        AccessLevel::Admin,
    )
    .with_expiration(Utc::now());

    // 1. Check Debug formatting
    let debug_repr = format!("{:?}", credential);
    assert!(debug_repr.contains(&secret_ref_id.to_string()));
    assert!(debug_repr.contains("OAuth2RefreshToken"));
    assert!(!debug_repr.contains(raw_secret_plaintext));
    assert!(!debug_repr.contains("password:"));

    // 2. Check Display formatting
    let display_repr = format!("{}", credential);
    assert!(display_repr.contains(&secret_ref_id.to_string()));
    assert!(display_repr.contains("OAuth2RefreshToken"));
    assert!(!display_repr.contains(raw_secret_plaintext));

    // 3. Check JSON serialization
    let json_repr = serde_json::to_string(&credential).expect("Serialization failed");
    assert!(json_repr.contains(&secret_ref_id.to_string()));
    assert!(!json_repr.contains(raw_secret_plaintext));
    assert!(!json_repr.contains("\"password\""));
    assert!(!json_repr.contains("\"client_secret\""));

    // 4. Verify deserialization roundtrip
    let deserialized: Credential =
        serde_json::from_str(&json_repr).expect("Deserialization failed");
    assert_eq!(credential, deserialized);
}

#[test]
fn test_secret_reference_redaction_and_pointer_integrity() {
    let ref_id = Uuid::new_v4();
    let secret_ref = SecretReference::with_id(ref_id, "macos_keychain");

    assert_eq!(secret_ref.reference_id, ref_id);
    assert_eq!(secret_ref.vault_backend, "macos_keychain");

    let display_str = format!("{}", secret_ref);
    assert!(display_str.contains(&ref_id.to_string()));
    assert!(display_str.contains("macos_keychain"));

    let json = serde_json::to_string(&secret_ref).expect("JSON serialization failed");
    let back: SecretReference = serde_json::from_str(&json).expect("JSON deserialization failed");
    assert_eq!(secret_ref, back);
}

#[derive(Debug, Serialize, Deserialize)]
struct NestedConfigWithSecrets {
    pub endpoint: String,
    pub api_token: SecretString,
    pub signing_key: SecretBytes,
    pub credential: Credential,
}

#[test]
fn test_nested_container_secret_redaction() {
    let secret_token = "sk_live_very_secret_token_123456789";
    let raw_key = vec![0x11, 0x22, 0x33, 0x44];
    let cred = Credential::new(Uuid::new_v4(), "ApiKey", Uuid::new_v4(), AccessLevel::User);

    let container = NestedConfigWithSecrets {
        endpoint: "https://api.sentinel.dev/v1".to_string(),
        api_token: SecretString::new(secret_token),
        signing_key: SecretBytes::new(raw_key),
        credential: cred,
    };

    let debug_str = format!("{:?}", container);
    assert!(
        !debug_str.contains(secret_token),
        "Nested debug string leaked secret token!"
    );

    let json_str = serde_json::to_string_pretty(&container).expect("Serialization failed");
    assert!(
        !json_str.contains(secret_token),
        "Nested JSON string leaked secret token!"
    );
    assert!(json_str.contains(REDACTED_PLACEHOLDER));
}

#[test]
fn test_sensitive_key_heuristics_and_redaction() {
    let sensitive_keys = [
        "password",
        "PASSWORD",
        "user_password",
        "api_secret",
        "access_token",
        "auth_header",
        "client_key",
        "tls_cert_private",
        "session_cookie",
        "credential_payload",
        "hmac_signature",
        "private_rsa_key",
    ];

    for key in &sensitive_keys {
        assert!(
            is_sensitive_key(key),
            "Key '{}' should be classified as sensitive",
            key
        );
        let redacted = redact_sensitive_value(key, "super_confidential_value");
        assert_eq!(
            redacted, REDACTED_PLACEHOLDER,
            "Value for key '{}' was not redacted",
            key
        );
    }

    let non_sensitive_keys = [
        "username",
        "host",
        "uri",
        "page",
        "limit",
        "status",
        "request_id",
        "created_at",
        "duration_ms",
    ];

    for key in &non_sensitive_keys {
        assert!(
            !is_sensitive_key(key),
            "Key '{}' should not be classified as sensitive",
            key
        );
        let preserved = redact_sensitive_value(key, "public_value_123");
        assert_eq!(preserved, "public_value_123");
    }
}

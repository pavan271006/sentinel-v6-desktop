//! Empirical Adversarial Stress Test Suite: OAuth, PKCE, State Entropy & Auth Engines
//!
//! Stress-tests:
//! 1. Shannon entropy boundary calculations (0.0 to 8.0 bits/byte)
//! 2. State parameter analysis (missing, static, low-entropy <64 bits, high-entropy cryptographic tokens)
//! 3. PKCE code_verifier stripping and 'plain' method downgrade matrices
//! 4. JWT Algorithm confusion (RS256 -> HS256) and JWKS injection on valid & malformed tokens
//! 5. Redirect URI bypass generators (traversal, open redirect, regex prefix/suffix, fragments)
//! 6. Negative control validations on compliant authorization flows

use sentinel_auth::{
    OAuthFlowAnalyzer, OAuthVulnerabilityType,
};

#[test]
fn stress_test_shannon_entropy_oracle() {
    // 1. Empty string -> 0.0 bits
    assert_eq!(OAuthFlowAnalyzer::shannon_entropy(""), 0.0);

    // 2. Uniform repeating character ("AAAAAA...") -> 0.0 bits
    assert_eq!(OAuthFlowAnalyzer::shannon_entropy("aaaaaaaaaaaaaaaa"), 0.0);
    assert_eq!(OAuthFlowAnalyzer::shannon_entropy("1111111111111111"), 0.0);

    // 3. 2-symbol alternating string ("abababab") -> exactly 1.0 bit per character
    let entropy_binary = OAuthFlowAnalyzer::shannon_entropy("abababababababab");
    assert!((entropy_binary - 1.0).abs() < 1e-6);

    // 4. Hexadecimal uniform string (16 unique characters with equal frequency) -> exactly 4.0 bits per char
    let hex_chars = "0123456789abcdef";
    let entropy_hex = OAuthFlowAnalyzer::shannon_entropy(hex_chars);
    assert!((entropy_hex - 4.0).abs() < 1e-6);

    // 5. Base64 64-character uniform string (64 unique characters) -> exactly 6.0 bits per char
    let b64_charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let entropy_b64 = OAuthFlowAnalyzer::shannon_entropy(b64_charset);
    assert!((entropy_b64 - 6.0).abs() < 1e-6);
}

#[test]
fn stress_test_oauth_state_parameter_analysis() {
    // Test 1: Empty state present in observed collection
    let empty_states = vec!["state123".to_string(), "".to_string()];
    let vulns_empty = OAuthFlowAnalyzer::analyze_state_parameter(&empty_states);
    assert!(vulns_empty.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::MissingStateParameter));

    // Test 2: Static / Reused state parameter across multiple logins
    let static_states = vec![
        "constant_state_value_xyz".to_string(),
        "constant_state_value_xyz".to_string(),
        "constant_state_value_xyz".to_string(),
    ];
    let vulns_static = OAuthFlowAnalyzer::analyze_state_parameter(&static_states);
    assert!(vulns_static.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::StaticStateParameter));

    // Test 3: Low Entropy State Parameter (< 64 bits total entropy)
    // E.g., "123456" (6 digits -> ~2.58 bits/char * 6 chars = ~15.5 bits total)
    let low_entropy_states = vec!["123456".to_string(), "654321".to_string()];
    let vulns_low = OAuthFlowAnalyzer::analyze_state_parameter(&low_entropy_states);
    assert!(vulns_low.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::LowEntropyStateParameter));

    // Test 4: Secure Cryptographic State Parameter (32 bytes Base64URL -> ~250 bits entropy)
    let secure_states = vec![
        "kX9vQ2mP8rL5wT1zN4bY7uE0sA3cD6fG-hJ8kM2pQ4=".to_string(),
        "mB3vC9xZ1aS4dF7gH0jK2lQ5wE8rT6yU-iO7pL3sA1=".to_string(),
    ];
    let vulns_secure = OAuthFlowAnalyzer::analyze_state_parameter(&secure_states);
    assert!(vulns_secure.is_empty(), "Secure random state parameters must yield 0 vulnerabilities");

    // Test 5: Empty slice
    let vulns_none = OAuthFlowAnalyzer::analyze_state_parameter(&[]);
    assert!(vulns_none.is_empty());
}

#[test]
fn stress_test_pkce_downgrade_and_stripping_matrix() {
    // Case 1: Both stripping and plain downgrade permitted (Worst case)
    let vulns_both = OAuthFlowAnalyzer::evaluate_pkce_vulnerabilities(200, 200);
    assert_eq!(vulns_both.len(), 2);
    assert!(vulns_both.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::PkceStrippingAllowed && v.severity == "HIGH"));
    assert!(vulns_both.iter().any(|v| v.vuln_type == OAuthVulnerabilityType::PkceDowngradeAllowed && v.severity == "MEDIUM"));

    // Case 2: Only code_verifier stripping permitted (Server ignores PKCE at token exchange)
    let vulns_strip = OAuthFlowAnalyzer::evaluate_pkce_vulnerabilities(200, 400);
    assert_eq!(vulns_strip.len(), 1);
    assert_eq!(vulns_strip[0].vuln_type, OAuthVulnerabilityType::PkceStrippingAllowed);

    // Case 3: Only plain method permitted (Server rejects missing verifier but allows method=plain)
    let vulns_plain = OAuthFlowAnalyzer::evaluate_pkce_vulnerabilities(400, 200);
    assert_eq!(vulns_plain.len(), 1);
    assert_eq!(vulns_plain[0].vuln_type, OAuthVulnerabilityType::PkceDowngradeAllowed);

    // Case 4: Fully compliant secure server (Rejects both stripped verifier and plain downgrade)
    let vulns_secure = OAuthFlowAnalyzer::evaluate_pkce_vulnerabilities(400, 400);
    assert!(vulns_secure.is_empty(), "Compliant PKCE implementation must yield 0 vulnerabilities");
}

#[test]
fn stress_test_jwt_tampering_and_jwks_injection() {
    let valid_jwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIEFkbWluIiwiYWRtaW4iOnRydWV9.fake_rsa_signature_bytes_123456789";

    // 1. Algorithm Confusion (RS256 -> HS256)
    let confusion_jwt = OAuthFlowAnalyzer::create_algorithm_confusion_payload(valid_jwt).expect("Algorithm confusion payload must be created");
    let parts: Vec<&str> = confusion_jwt.split('.').collect();
    assert_eq!(parts.len(), 3);
    assert!(!parts[2].is_empty(), "Signature must be cryptographically generated");

    // Decode header and verify alg is HS256
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    let hdr_bytes = URL_SAFE_NO_PAD.decode(parts[0]).unwrap();
    let hdr_json: serde_json::Value = serde_json::from_slice(&hdr_bytes).unwrap();
    assert_eq!(hdr_json.get("alg").unwrap().as_str().unwrap(), "HS256");

    // 2. JWKS Header Injection
    let evil_jwks = "https://attacker.evil.com/jwks.json";
    let jwks_jwt = OAuthFlowAnalyzer::create_jwks_injection_payload(valid_jwt, evil_jwks).expect("JWKS payload must be created");
    let jwks_parts: Vec<&str> = jwks_jwt.split('.').collect();
    let jwks_hdr_bytes = URL_SAFE_NO_PAD.decode(jwks_parts[0]).unwrap();
    let jwks_hdr_json: serde_json::Value = serde_json::from_slice(&jwks_hdr_bytes).unwrap();
    assert_eq!(jwks_hdr_json.get("jku").unwrap().as_str().unwrap(), evil_jwks);
    assert_eq!(jwks_hdr_json.get("kid").unwrap().as_str().unwrap(), "attacker_key_1");

    // 3. Malformed input handling (should return None safely)
    assert!(OAuthFlowAnalyzer::create_algorithm_confusion_payload("invalid_token").is_none());
    assert!(OAuthFlowAnalyzer::create_algorithm_confusion_payload("a.b").is_none());
    assert!(OAuthFlowAnalyzer::create_algorithm_confusion_payload("a.b.c.d").is_none());
    assert!(OAuthFlowAnalyzer::create_jwks_injection_payload("not_a_jwt", evil_jwks).is_none());
}

#[test]
fn stress_test_redirect_uri_probes_generator() {
    let legit = "https://client.example.com/oauth/callback";
    let probes = OAuthFlowAnalyzer::generate_redirect_uri_probes(legit);

    assert!(probes.len() >= 4);

    // Verify path traversal probe
    assert!(probes.iter().any(|(uri, desc)| uri.contains("/../../attacker_callback") && desc.contains("Path traversal")));

    // Verify parameter append open redirect probe
    assert!(probes.iter().any(|(uri, desc)| uri.contains("next=https://attacker.evil.com") && desc.contains("Open redirect")));

    // Verify subdomain hijacking probe
    assert!(probes.iter().any(|(uri, desc)| uri.contains("client.example.com.attacker.evil.com") && desc.contains("Domain prefix")));

    // Verify fragment pollution probe
    assert!(probes.iter().any(|(uri, desc)| uri.contains("#@attacker.evil.com") && desc.contains("fragment")));
}

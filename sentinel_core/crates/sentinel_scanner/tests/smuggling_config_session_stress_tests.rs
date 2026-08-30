//! Empirical Adversarial Stress Test Suite: HTTP Smuggling, Cookie Security, CSP AST & CORS
//!
//! Stress-tests:
//! 1. CL.TE and TE.CL HTTP Request Smuggling differential analysis & canary reflection
//! 2. RFC 6265bis Cookie prefix compliance (__Host-, __Secure-), SameSite and Shannon entropy
//! 3. Content-Security-Policy AST directive parser, script source weaknesses, and clickjacking defenses
//! 4. HSTS duration boundaries and includeSubDomains / preload policy audits
//! 5. CORS origin reflection and trust matrix evaluations

use sentinel_scanner::{
    CookieSecurityAuditor, CookieSecurityIssue, CorsMisconfigurationAnalyzer, CorsVulnerabilityType,
    CspWeakness, HeaderSecurityAuditor, HttpSmugglingEngine, SameSitePolicy,
    SmugglingAttackVector,
};

#[test]
fn stress_test_http_smuggling_differentials() {
    // 1. CL.TE Probe Generation
    let cl_te_probe = HttpSmugglingEngine::generate_cl_te_probe("backend.internal", "/canary_probe_123");
    assert_eq!(cl_te_probe.vector, SmugglingAttackVector::ClTe);
    let payload_str = String::from_utf8_lossy(&cl_te_probe.raw_payload);
    assert!(payload_str.contains("Transfer-Encoding: chunked"));
    assert!(payload_str.contains("Content-Length:"));
    assert!(payload_str.contains("GET /canary_probe_123 HTTP/1.1"));

    // 2. TE.CL Probe Generation
    let te_cl_probe = HttpSmugglingEngine::generate_te_cl_probe("backend.internal", "/canary_probe_456");
    assert_eq!(te_cl_probe.vector, SmugglingAttackVector::TeCl);
    let te_payload_str = String::from_utf8_lossy(&te_cl_probe.raw_payload);
    assert!(te_payload_str.contains("Content-Length: 4"));

    // 3. Evaluation: Canary Pipeline Reflection (Confidence = 0.99)
    let res_refl = HttpSmugglingEngine::evaluate_smuggling_response(
        SmugglingAttackVector::ClTe,
        80,
        404,
        "<html><body>Error 404: Path /canary_probe_123 not found</body></html>",
        "/canary_probe_123",
    );
    assert!(res_refl.is_vulnerable);
    assert_eq!(res_refl.confidence, 0.99);

    // 4. Evaluation: Differential Timeout + 400 Bad Request on pipeline (Confidence = 0.85)
    let res_timeout = HttpSmugglingEngine::evaluate_smuggling_response(
        SmugglingAttackVector::TeCl,
        4800, // Timeout > 4500ms
        400,
        "Bad Request: Malformed chunked stream",
        "/canary_probe_456",
    );
    assert!(res_timeout.is_vulnerable);
    assert_eq!(res_timeout.confidence, 0.85);

    // 5. Negative Control: Benign normal server responses
    let res_safe = HttpSmugglingEngine::evaluate_smuggling_response(
        SmugglingAttackVector::ClTe,
        40,
        200,
        "OK",
        "/canary_probe_123",
    );
    assert!(!res_safe.is_vulnerable);
    assert_eq!(res_safe.confidence, 0.10);
}

#[test]
fn stress_test_cookie_security_auditor_rfc6265bis() {
    // 1. Fully Compliant Secure Cookie
    let cookie_perfect = "__Host-auth=a9F8z1K3mQ7vL5wP0xR4bN2yT6uE8sA1; Secure; HttpOnly; SameSite=Strict; Path=/";
    let p_perfect = CookieSecurityAuditor::parse_set_cookie(cookie_perfect);
    assert!(p_perfect.issues.is_empty(), "Compliant cookie must have 0 issues, got: {:?}", p_perfect.issues);
    assert!(p_perfect.is_host_prefix);
    assert!(p_perfect.secure);
    assert!(p_perfect.httponly);
    assert_eq!(p_perfect.samesite, SameSitePolicy::Strict);
    assert!(p_perfect.shannon_entropy > 3.0);

    // 2. __Host- Violations: Has Domain attribute + Missing Secure + Missing Path=/
    let cookie_bad_host = "__Host-session=12345; Domain=example.com; HttpOnly";
    let p_bad_host = CookieSecurityAuditor::parse_set_cookie(cookie_bad_host);
    assert!(p_bad_host.issues.contains(&CookieSecurityIssue::HostPrefixDomainViolation));
    assert!(p_bad_host.issues.contains(&CookieSecurityIssue::HostPrefixMissingSecureOrPath));
    assert!(p_bad_host.issues.contains(&CookieSecurityIssue::MissingSecureFlag));

    // 3. __Secure- Violations: Missing Secure
    let cookie_bad_sec = "__Secure-token=xyz789; Path=/app; HttpOnly";
    let p_bad_sec = CookieSecurityAuditor::parse_set_cookie(cookie_bad_sec);
    assert!(p_bad_sec.issues.contains(&CookieSecurityIssue::SecurePrefixMissingSecure));
    assert!(p_bad_sec.issues.contains(&CookieSecurityIssue::MissingSecureFlag));

    // 4. SameSite=None without Secure
    let cookie_samesite_none = "session=abc1234567890123; SameSite=None";
    let p_none = CookieSecurityAuditor::parse_set_cookie(cookie_samesite_none);
    assert!(p_none.issues.contains(&CookieSecurityIssue::InsecureSameSiteNoneWithoutSecure));

    // 5. Weak Shannon Entropy on session-like cookie
    let cookie_weak_entropy = "session_id=1111111111111111; Secure; HttpOnly; SameSite=Lax";
    let p_weak = CookieSecurityAuditor::parse_set_cookie(cookie_weak_entropy);
    assert!(p_weak.issues.contains(&CookieSecurityIssue::WeakShannonEntropy));
}

#[test]
fn stress_test_csp_ast_parser_and_hsts_auditor() {
    // 1. Severely Weakened CSP
    let weak_csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' * data: http://insecure.cdn.com; object-src 'none'";
    let parsed = HeaderSecurityAuditor::parse_csp(weak_csp);
    assert!(parsed.weaknesses.contains(&CspWeakness::UnsafeInlineScript));
    assert!(parsed.weaknesses.contains(&CspWeakness::UnsafeEvalScript));
    assert!(parsed.weaknesses.contains(&CspWeakness::WildcardScriptSrc));
    assert!(parsed.weaknesses.contains(&CspWeakness::DataUriAllowedInScript));
    assert!(parsed.weaknesses.contains(&CspWeakness::HttpSourceInHttpsPolicy));
    assert!(parsed.weaknesses.contains(&CspWeakness::MissingBaseUri));
    assert!(parsed.weaknesses.contains(&CspWeakness::MissingFrameAncestors));

    // 2. Robust CSP
    let strong_csp = "default-src 'none'; script-src 'self' 'nonce-rAnd0m123'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
    let strong_parsed = HeaderSecurityAuditor::parse_csp(strong_csp);
    assert!(strong_parsed.weaknesses.is_empty(), "Strong CSP should have 0 weaknesses, got: {:?}", strong_parsed.weaknesses);

    // 3. HSTS Evaluation
    let weak_hsts = HeaderSecurityAuditor::evaluate_hsts("max-age=600");
    assert!(weak_hsts.iter().any(|f| f.title.contains("Insufficient Duration")));
    assert!(weak_hsts.iter().any(|f| f.title.contains("includeSubDomains Omitted")));

    let strong_hsts = HeaderSecurityAuditor::evaluate_hsts("max-age=63072000; includeSubDomains; preload");
    assert!(strong_hsts.is_empty(), "Strong HSTS policy must yield 0 audit findings");
}

#[test]
fn stress_test_cors_misconfiguration_analyzer() {
    // 1. Origin Reflection with Credentials (ACAC: true)
    let res_refl = CorsMisconfigurationAnalyzer::evaluate_cors_response(
        "https://evil-attacker.com",
        Some("https://evil-attacker.com"),
        Some("true"),
        "target.com",
    ).expect("Vulnerability must be reported");
    assert_eq!(res_refl.vuln_type, CorsVulnerabilityType::ArbitraryOriginReflectionWithCredentials);
    assert_eq!(res_refl.severity, "HIGH");

    // 2. Null Origin with Credentials
    let res_null = CorsMisconfigurationAnalyzer::evaluate_cors_response(
        "null",
        Some("null"),
        Some("true"),
        "target.com",
    ).expect("Null origin vulnerability must be reported");
    assert_eq!(res_null.vuln_type, CorsVulnerabilityType::NullOriginReflectionWithCredentials);

    // 3. Negative Control: Safe static CORS without credentials
    let res_safe = CorsMisconfigurationAnalyzer::evaluate_cors_response(
        "https://evil-attacker.com",
        Some("https://target.com"),
        None,
        "target.com",
    );
    assert!(res_safe.is_none(), "Safe CORS configuration must yield None");
}

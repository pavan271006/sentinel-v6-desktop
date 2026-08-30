// crates/sentinel_scope/tests/fail_closed_tests.rs
//
// Exhaustive Fail-Closed (Default DENY) Invariant Tests (SEC-01).
// Validates that unconfigured, empty, malformed, or invalid inputs always fail closed to DENY.

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::{Scope, ScopeEngine};
use sentinel_scope::DefaultScopeEngine;

#[test]
fn test_empty_scope_default_deny() {
    let engine = DefaultScopeEngine::empty();

    let targets = [
        "https://example.com",
        "https://api.target.com/v1/resource",
        "http://localhost:8080",
        "192.168.1.1",
        "8.8.8.8",
        "2001:db8::1",
        "ftp://example.com/file",
    ];

    for target in targets {
        let decision = engine.is_in_scope(target);
        assert!(
            !decision.allowed,
            "Target '{}' must be DENIED on empty scope",
            target
        );
        assert!(
            decision.reason.contains("Default Deny") || decision.reason.contains("Fail-closed"),
            "Reason must indicate default deny or fail-closed, got: '{}'",
            decision.reason
        );
        assert_eq!(decision.matched_rule, None);
        assert_eq!(decision.target, target);
    }
}

#[test]
fn test_scope_with_empty_rules_default_deny() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);

    let decision = engine.is_in_scope("https://target.com/api");
    assert!(!decision.allowed);
    assert!(decision.reason.contains("Default Deny"));

    let ip_decision = engine.is_ip_in_scope("93.184.216.34");
    assert!(!ip_decision.allowed);
    assert!(ip_decision.reason.contains("Default Deny"));
}

#[test]
fn test_unconfigured_targets_denied() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 2,
        timestamp: Utc::now(),
        includes: vec![
            "https://app.target.com/*".to_string(),
            "*.service.internal".to_string(),
            "10.20.0.0/16".to_string(),
        ],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);

    let unauthorized_targets = [
        "https://other-target.com",
        "https://evil.target.com",
        "https://attacker.org/exploit",
        "https://service.internal.evil.com",
        "10.21.0.1",
        "192.168.1.1",
        "1.1.1.1",
    ];

    for target in unauthorized_targets {
        let decision = engine.is_in_scope(target);
        assert!(
            !decision.allowed,
            "Unauthorized target '{}' must be DENIED",
            target
        );
        assert!(decision.reason.contains("Default Deny"));
    }
}

#[test]
fn test_malformed_and_empty_inputs_fail_closed() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["*".to_string()],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);

    // Empty string
    let empty_decision = engine.is_in_scope("");
    assert!(!empty_decision.allowed);
    assert!(empty_decision.reason.contains("Fail-closed"));

    // Whitespace only
    let whitespace_decision = engine.is_in_scope("   ");
    assert!(!whitespace_decision.allowed);
    assert!(whitespace_decision.reason.contains("Fail-closed"));

    // Control characters / Null bytes
    let null_byte_decision = engine.is_in_scope("https://example.com\0/admin");
    assert!(!null_byte_decision.allowed);
    assert!(null_byte_decision.reason.contains("Fail-closed"));

    let crlf_decision = engine.is_in_scope("https://example.com\r\nHost: evil.com");
    assert!(!crlf_decision.allowed);
    assert!(crlf_decision.reason.contains("Fail-closed"));

    // Invalid IP address inputs
    let invalid_ips = [
        "",
        "   ",
        "999.999.999.999",
        "256.0.0.1",
        "192.168.1.1.1",
        "abc.def.ghi.jkl",
        "::gggg",
        "127.0.0.1:80",
    ];

    for invalid_ip in invalid_ips {
        let ip_decision = engine.is_ip_in_scope(invalid_ip);
        assert!(
            !ip_decision.allowed,
            "Invalid IP '{}' must be DENIED (Fail-closed)",
            invalid_ip
        );
        assert!(ip_decision.reason.contains("Fail-closed"));
    }
}

#[test]
fn test_scope_update_invalidation_and_lifecycle() {
    let initial_scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://v1.target.com/*".to_string()],
        excludes: vec![],
    };

    let mut engine = DefaultScopeEngine::new(initial_scope);

    assert!(engine.is_in_scope("https://v1.target.com/api").allowed);
    assert!(!engine.is_in_scope("https://v2.target.com/api").allowed);

    // Update scope to v2 targeting v2.target.com
    let updated_scope = Scope {
        id: Uuid::new_v4(),
        version: 2,
        timestamp: Utc::now(),
        includes: vec!["https://v2.target.com/*".to_string()],
        excludes: vec![],
    };

    engine.update_scope(updated_scope).unwrap();
    assert_eq!(engine.scope_version(), 2);

    // After update: v1 is now DENIED, v2 is ALLOWED
    let v1_decision = engine.is_in_scope("https://v1.target.com/api");
    assert!(!v1_decision.allowed);
    assert_eq!(v1_decision.scope_version, 2);

    let v2_decision = engine.is_in_scope("https://v2.target.com/api");
    assert!(v2_decision.allowed);
    assert_eq!(v2_decision.scope_version, 2);
}

// crates/sentinel_scope/tests/exclusion_precedence_tests.rs
//
// Exclusion Precedence Invariant Tests.
// Strictly verifies that Exclusion Rules ALWAYS override Inclusion Rules across hostnames, URLs, and CIDRs.

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::{Scope, ScopeEngine};
use sentinel_scope::DefaultScopeEngine;

#[test]
fn test_hostname_exclusion_overrides_wildcard_inclusion() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["*.target.com".to_string()],
        excludes: vec![
            "admin.target.com".to_string(),
            "logout.target.com".to_string(),
            "*.secret.target.com".to_string(),
        ],
    };

    let engine = DefaultScopeEngine::new(scope);

    // Allowed (included and not excluded)
    assert!(engine.is_in_scope("https://api.target.com").allowed);
    assert!(engine.is_in_scope("https://target.com").allowed);
    assert!(engine.is_in_scope("https://portal.target.com").allowed);

    // Denied by exclusion rules
    let admin = engine.is_in_scope("https://admin.target.com");
    assert!(!admin.allowed);
    assert!(admin.reason.contains("matched exclude rule"));

    let logout = engine.is_in_scope("https://logout.target.com");
    assert!(!logout.allowed);
    assert!(logout.reason.contains("matched exclude rule"));

    let secret = engine.is_in_scope("https://vault.secret.target.com");
    assert!(!secret.allowed);
    assert!(secret.reason.contains("matched exclude rule"));
}

#[test]
fn test_url_path_exclusion_overrides_prefix_inclusion() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://app.target.com/api/*".to_string()],
        excludes: vec![
            "https://app.target.com/api/admin/*".to_string(),
            "https://app.target.com/api/v1/auth/logout".to_string(),
            "https://app.target.com/api/v1/users/delete".to_string(),
        ],
    };

    let engine = DefaultScopeEngine::new(scope);

    // In-scope allowed
    assert!(
        engine
            .is_in_scope("https://app.target.com/api/v1/users/list")
            .allowed
    );
    assert!(
        engine
            .is_in_scope("https://app.target.com/api/v1/items")
            .allowed
    );

    // Excluded endpoints
    let admin_call = engine.is_in_scope("https://app.target.com/api/admin/system-status");
    assert!(!admin_call.allowed);
    assert!(admin_call.reason.contains("matched exclude rule"));

    let logout_call = engine.is_in_scope("https://app.target.com/api/v1/auth/logout");
    assert!(!logout_call.allowed);
    assert!(logout_call.reason.contains("matched exclude rule"));

    let delete_call = engine.is_in_scope("https://app.target.com/api/v1/users/delete");
    assert!(!delete_call.allowed);
    assert!(delete_call.reason.contains("matched exclude rule"));
}

#[test]
fn test_ip_cidr_exclusion_overrides_broad_subnet_inclusion() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["10.0.0.0/8".to_string(), "2001:db8::/32".to_string()],
        excludes: vec![
            "10.0.0.1".to_string(),
            "10.254.0.0/16".to_string(),
            "2001:db8:dead::/48".to_string(),
        ],
    };

    let engine = DefaultScopeEngine::new(scope);

    // In-scope IPs
    assert!(engine.is_ip_in_scope("10.0.0.2").allowed);
    assert!(engine.is_ip_in_scope("10.100.50.1").allowed);
    assert!(engine.is_ip_in_scope("2001:db8:1234::1").allowed);

    // Excluded specific IPs and subnets
    let excluded_router = engine.is_ip_in_scope("10.0.0.1");
    assert!(!excluded_router.allowed);
    assert!(excluded_router.reason.contains("matched exclude rule"));

    let excluded_subnet = engine.is_ip_in_scope("10.254.10.5");
    assert!(!excluded_subnet.allowed);
    assert!(excluded_subnet.reason.contains("matched exclude rule"));

    let excluded_ipv6 = engine.is_ip_in_scope("2001:db8:dead:1::beef");
    assert!(!excluded_ipv6.allowed);
    assert!(excluded_ipv6.reason.contains("matched exclude rule"));
}

#[test]
fn test_complex_mixed_inclusion_exclusion_matrix() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![
            "*".to_string(), // Wildcard all hosts initially
        ],
        excludes: vec![
            "*.google.com".to_string(),
            "*.facebook.com".to_string(),
            "127.0.0.0/8".to_string(),
            "169.254.169.254".to_string(),
            "https://target.com/logout".to_string(),
        ],
    };

    let engine = DefaultScopeEngine::new(scope);

    // Any generic host is allowed
    assert!(engine.is_in_scope("https://target.com/dashboard").allowed);
    assert!(engine.is_in_scope("https://example.org").allowed);

    // Excluded third-party domains blocked
    assert!(!engine.is_in_scope("https://mail.google.com").allowed);
    assert!(!engine.is_in_scope("https://google.com").allowed);
    assert!(!engine.is_in_scope("https://graph.facebook.com").allowed);

    // Excluded specific URL blocked
    assert!(!engine.is_in_scope("https://target.com/logout").allowed);

    // Excluded IPs blocked
    assert!(!engine.is_ip_in_scope("127.0.0.1").allowed);
    assert!(!engine.is_ip_in_scope("169.254.169.254").allowed);
}

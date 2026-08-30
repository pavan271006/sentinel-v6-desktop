// crates/sentinel_scope/tests/hostname_matcher_tests.rs
//
// Exhaustive Unit and Integration Tests for Hostname Matching Engine.
// Validates exact hostnames, wildcard subdomains, case normalizations, and boundary protections.

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::{Scope, ScopeEngine};
use sentinel_scope::{DefaultScopeEngine, HostnameMatcher};

#[test]
fn test_hostname_matcher_exact() {
    let matcher = HostnameMatcher::parse("api.sentinel.dev");

    assert!(matcher.matches("api.sentinel.dev"));
    assert!(matcher.matches("API.SENTINEL.DEV"));
    assert!(matcher.matches("api.sentinel.dev."));
    assert!(matcher.matches("  api.sentinel.dev  "));

    // Subdomains must NOT match exact rule
    assert!(!matcher.matches("v1.api.sentinel.dev"));
    assert!(!matcher.matches("sentinel.dev"));
    assert!(!matcher.matches("evil-api.sentinel.dev"));
    assert!(!matcher.matches("api.sentinel.dev.attacker.com"));
    assert!(!matcher.matches(""));
}

#[test]
fn test_hostname_matcher_wildcard_hierarchy() {
    let matcher = HostnameMatcher::parse("*.sentinel.dev");

    // Apex domain matches
    assert!(matcher.matches("sentinel.dev"));
    assert!(matcher.matches("SENTINEL.DEV"));

    // Single level subdomains
    assert!(matcher.matches("api.sentinel.dev"));
    assert!(matcher.matches("auth.sentinel.dev"));
    assert!(matcher.matches("admin.sentinel.dev"));

    // Deep nested subdomains
    assert!(matcher.matches("v1.api.sentinel.dev"));
    assert!(matcher.matches("qa.staging.us-east.sentinel.dev"));

    // Boundaries: Must NOT match sibling or attacker domains
    assert!(!matcher.matches("evil-sentinel.dev"));
    assert!(!matcher.matches("notsentinel.dev"));
    assert!(!matcher.matches("sentinel.dev.attacker.org"));
    assert!(!matcher.matches("sentinel.developer.com"));
    assert!(!matcher.matches("sentinel.org"));
}

#[test]
fn test_nested_subdomain_wildcards() {
    let matcher = HostnameMatcher::parse("*.internal.corp.com");

    assert!(matcher.matches("internal.corp.com"));
    assert!(matcher.matches("api.internal.corp.com"));
    assert!(matcher.matches("db.staging.internal.corp.com"));

    // Out of scope
    assert!(!matcher.matches("corp.com"));
    assert!(!matcher.matches("external.corp.com"));
    assert!(!matcher.matches("evil-internal.corp.com"));
}

#[test]
fn test_scope_engine_hostname_integration() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["*.target.com".to_string(), "portal.partner.org".to_string()],
        excludes: vec![
            "logout.target.com".to_string(),
            "*.staging.target.com".to_string(),
        ],
    };

    let engine = DefaultScopeEngine::new(scope);

    // In-scope allowed
    assert!(engine.is_in_scope("https://target.com/home").allowed);
    assert!(
        engine
            .is_in_scope("https://api.target.com/v1/users")
            .allowed
    );
    assert!(
        engine
            .is_in_scope("https://dev.api.target.com:8443/graphql")
            .allowed
    );
    assert!(
        engine
            .is_in_scope("https://portal.partner.org/dashboard")
            .allowed
    );

    // Excluded subdomains
    let logout_decision = engine.is_in_scope("https://logout.target.com");
    assert!(!logout_decision.allowed);
    assert!(logout_decision.reason.contains("matched exclude rule"));

    let staging_decision = engine.is_in_scope("https://api.staging.target.com/v1");
    assert!(!staging_decision.allowed);
    assert!(staging_decision.reason.contains("matched exclude rule"));

    // Completely out of scope
    assert!(!engine.is_in_scope("https://partner.org").allowed);
    assert!(!engine.is_in_scope("https://evil-target.com").allowed);
}

#[test]
fn test_case_insensitive_url_hostname_resolution() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["*.Target.Com".to_string()],
        excludes: vec!["Forbidden.Target.Com".to_string()],
    };

    let engine = DefaultScopeEngine::new(scope);

    assert!(engine.is_in_scope("HTTPS://API.TARGET.COM/V1/DATA").allowed);
    assert!(engine.is_in_scope("http://api.target.com/test").allowed);

    let denied = engine.is_in_scope("https://forbidden.target.com/test");
    assert!(!denied.allowed);
    assert!(denied.reason.contains("matched exclude rule"));
}

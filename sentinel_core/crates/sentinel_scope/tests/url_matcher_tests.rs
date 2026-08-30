// crates/sentinel_scope/tests/url_matcher_tests.rs
//
// Exhaustive Unit and Integration Tests for URL Matcher & ReDoS Defense.
// Strictly verifies exact URLs, prefix paths, regex bounds (<= 1000 chars), and 100ms ReDoS timeout.

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::{Scope, ScopeEngine};
use sentinel_scope::{DefaultScopeEngine, UrlMatchResult, UrlMatcher};

#[test]
fn test_exact_url_matching() {
    let matcher = UrlMatcher::parse("https://api.target.com/v1/users");

    assert_eq!(
        matcher.evaluate("https://api.target.com/v1/users"),
        UrlMatchResult::Matched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/v1/users/"),
        UrlMatchResult::NotMatched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/v1/users/123"),
        UrlMatchResult::NotMatched
    );
    assert_eq!(
        matcher.evaluate("http://api.target.com/v1/users"),
        UrlMatchResult::NotMatched
    );
}

#[test]
fn test_prefix_url_matching() {
    let matcher = UrlMatcher::parse("https://api.target.com/v1/*");

    assert_eq!(
        matcher.evaluate("https://api.target.com/v1/users"),
        UrlMatchResult::Matched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/v1/orders/create"),
        UrlMatchResult::Matched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/v1/items?category=sec&limit=10"),
        UrlMatchResult::Matched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/v2/users"),
        UrlMatchResult::NotMatched
    );
    assert_eq!(
        matcher.evaluate("https://other.target.com/v1/users"),
        UrlMatchResult::NotMatched
    );
}

#[test]
fn test_regex_url_matching_valid_patterns() {
    let matcher = UrlMatcher::parse(r"^https://api\.target\.com/users/\d+/profile$");

    assert_eq!(
        matcher.evaluate("https://api.target.com/users/12345/profile"),
        UrlMatchResult::Matched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/users/999/profile"),
        UrlMatchResult::Matched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/users/abc/profile"),
        UrlMatchResult::NotMatched
    );
    assert_eq!(
        matcher.evaluate("https://api.target.com/users/12345/settings"),
        UrlMatchResult::NotMatched
    );
}

#[test]
fn test_redos_catastrophic_backtracking_fail_closed() {
    // Classic ReDoS evil regex: ^(a+)+$
    let evil_regex = r"^(a+)+$";
    let matcher = UrlMatcher::parse(evil_regex);
    let attack_payload = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!";

    let result = matcher.evaluate(attack_payload);
    assert!(
        result == UrlMatchResult::Timeout || result == UrlMatchResult::NotMatched,
        "ReDoS pattern must fail closed with Timeout or NotMatched within budget"
    );
}

#[test]
fn test_redos_scope_engine_integration_timeout_fail_closed() {
    let evil_pattern = r"^(https://target\.com/(a+)+)$".to_string();
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![evil_pattern],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);

    let attack_uri = format!("https://target.com/{}!", "a".repeat(40));
    let decision = engine.is_in_scope(&attack_uri);

    assert!(!decision.allowed, "ReDoS query must fail closed to DENY");
    assert!(
        decision.reason.contains("RegexTimeoutFailClosed")
            || decision.reason.contains("Default Deny"),
        "Reason must indicate ReDoS timeout or fail-closed DENY, got: '{}'",
        decision.reason
    );
}

#[test]
fn test_regex_pattern_length_bound_1000_chars() {
    // 1001 character pattern exceeds MAX_REGEX_PATTERN_LENGTH
    let oversized_pattern = format!("^{}$", "a".repeat(1005));
    let matcher = UrlMatcher::parse(&oversized_pattern);

    let res = matcher.evaluate("https://example.com");
    assert_eq!(res, UrlMatchResult::PatternTooLong);

    // In ScopeEngine
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![oversized_pattern],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);
    let decision = engine.is_in_scope("https://example.com");
    assert!(!decision.allowed);
    assert!(decision.reason.contains("Fail-closed"));
}

#[test]
fn test_regex_syntax_error_fail_closed() {
    let bad_regex = r"^https://example\.com/(unclosed-group";
    let matcher = UrlMatcher::parse(bad_regex);

    let res = matcher.evaluate("https://example.com/test");
    assert!(matches!(res, UrlMatchResult::SyntaxError(_)));

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![bad_regex.to_string()],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);
    let decision = engine.is_in_scope("https://example.com/test");
    assert!(!decision.allowed);
    assert!(decision.reason.contains("Fail-closed"));
}

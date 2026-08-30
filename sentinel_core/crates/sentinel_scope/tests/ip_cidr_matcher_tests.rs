// crates/sentinel_scope/tests/ip_cidr_matcher_tests.rs
//
// Exhaustive Unit and Integration Tests for IPv4 & IPv6 CIDR and Single IP Matching.
// Verifies bitmask containment, boundary addresses, IPv4-mapped IPv6, and ScopeEngine integration.

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::{Scope, ScopeEngine};
use sentinel_scope::{DefaultScopeEngine, IpCidrMatcher};

#[test]
fn test_ipv4_cidr_subnet_matching() {
    let matcher = IpCidrMatcher::parse("192.168.10.0/24").unwrap();

    // In-subnet IPs
    assert!(matcher.matches_str("192.168.10.0")); // Network address
    assert!(matcher.matches_str("192.168.10.1")); // First host
    assert!(matcher.matches_str("192.168.10.128")); // Middle host
    assert!(matcher.matches_str("192.168.10.254")); // Last host
    assert!(matcher.matches_str("192.168.10.255")); // Broadcast address

    // Adjacent out-of-subnet IPs
    assert!(!matcher.matches_str("192.168.9.255"));
    assert!(!matcher.matches_str("192.168.11.0"));
    assert!(!matcher.matches_str("10.0.0.1"));
}

#[test]
fn test_ipv4_single_ip_matching() {
    let matcher = IpCidrMatcher::parse("10.50.100.25").unwrap();

    assert!(matcher.matches_str("10.50.100.25"));
    assert!(!matcher.matches_str("10.50.100.24"));
    assert!(!matcher.matches_str("10.50.100.26"));
    assert!(!matcher.matches_str("10.50.101.25"));
}

#[test]
fn test_ipv6_cidr_subnet_matching() {
    let matcher = IpCidrMatcher::parse("2001:db8:abcd::/48").unwrap();

    assert!(matcher.matches_str("2001:db8:abcd::1"));
    assert!(matcher.matches_str("2001:db8:abcd:0001::ffff"));
    assert!(matcher.matches_str("2001:db8:abcd:ffff:ffff:ffff:ffff:ffff"));

    // Out-of-subnet IPv6
    assert!(!matcher.matches_str("2001:db8:abce::1"));
    assert!(!matcher.matches_str("2001:db8:abcc::ffff"));
    assert!(!matcher.matches_str("fe80::1"));
}

#[test]
fn test_ipv6_single_ip_matching() {
    let matcher = IpCidrMatcher::parse("2001:db8::dead:beef").unwrap();

    assert!(matcher.matches_str("2001:db8::dead:beef"));
    assert!(!matcher.matches_str("2001:db8::dead:beee"));
    assert!(!matcher.matches_str("2001:db8::dead:bef0"));
}

#[test]
fn test_ipv4_mapped_ipv6_addresses() {
    let matcher = IpCidrMatcher::parse("192.168.1.0/24").unwrap();

    // ::ffff:192.168.1.42 is IPv4-mapped IPv6
    assert!(matcher.matches_str("::ffff:192.168.1.42"));
    assert!(!matcher.matches_str("::ffff:10.0.0.1"));
}

#[test]
fn test_scope_engine_ip_evaluation() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![
            "192.168.100.0/24".to_string(),
            "10.0.0.50".to_string(),
            "2001:db8:1234::/48".to_string(),
        ],
        excludes: vec!["192.168.100.254".to_string(), "192.168.100.255".to_string()],
    };

    let engine = DefaultScopeEngine::new(scope);

    // IP string checks
    assert!(engine.is_ip_in_scope("192.168.100.10").allowed);
    assert!(engine.is_ip_in_scope("10.0.0.50").allowed);
    assert!(engine.is_ip_in_scope("2001:db8:1234::5").allowed);

    // Excluded IPs
    let excluded_ip = engine.is_ip_in_scope("192.168.100.254");
    assert!(!excluded_ip.allowed);
    assert!(excluded_ip.reason.contains("matched exclude rule"));

    // Out of scope IP
    let out_of_scope = engine.is_ip_in_scope("192.168.200.1");
    assert!(!out_of_scope.allowed);
    assert!(out_of_scope.reason.contains("Default Deny"));

    // URL with IP host
    assert!(
        engine
            .is_in_scope("http://192.168.100.10:8080/api/status")
            .allowed
    );
    let excluded_url = engine.is_in_scope("http://192.168.100.254:8080/api/status");
    assert!(!excluded_url.allowed);
}

// crates/sentinel_scope/tests/ssrf_defense_tests.rs
//
// Exhaustive SSRF & DNS Rebinding Defense Test Suite.
// Strictly verifies post-DNS socket IP validation blocking private, loopback, and cloud metadata IP ranges.

use chrono::Utc;
use std::net::IpAddr;
use std::str::FromStr;
use uuid::Uuid;

use sentinel_common::Scope;
use sentinel_scope::{DefaultScopeEngine, SsrfValidator};

#[test]
fn test_ssrf_validator_blocks_all_standard_forbidden_ranges() {
    let restricted_ips = [
        // IPv4 Loopback
        "127.0.0.1",
        "127.0.0.2",
        "127.255.255.254",
        // RFC 1918 Private
        "10.0.0.1",
        "10.254.254.254",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.0.1",
        "192.168.1.254",
        // Cloud Metadata & Link-Local
        "169.254.169.254",
        "169.254.1.1",
        // Broadcast & Current network
        "0.0.0.0",
        "255.255.255.255",
        // Carrier Grade NAT
        "100.64.0.1",
        "100.127.255.254",
        // IPv6 Loopback & Unspecified
        "::1",
        "::",
        // IPv6 Unique Local Address (fc00::/7)
        "fc00::1",
        "fd12:3456:789a::1",
        // IPv6 Link-Local
        "fe80::1",
        "fe80::dead:beef",
        // IPv4-mapped IPv6
        "::ffff:127.0.0.1",
        "::ffff:169.254.169.254",
        "::ffff:10.0.0.1",
        "::ffff:192.168.1.1",
    ];

    for ip_str in restricted_ips {
        let ip = IpAddr::from_str(ip_str).unwrap();
        let is_restricted = SsrfValidator::is_restricted_ip(ip);
        assert!(
            is_restricted.is_some(),
            "IP '{}' must be detected as restricted/forbidden for SSRF defense",
            ip_str
        );
    }
}

#[test]
fn test_public_ips_not_blocked_by_ssrf() {
    let public_ips = [
        "93.184.216.34", // example.com
        "8.8.8.8",       // Google DNS
        "1.1.1.1",       // Cloudflare DNS
        "142.250.190.46",
        "2606:4700:4700::1111",
        "2001:4860:4860::8888",
    ];

    for ip_str in public_ips {
        let ip = IpAddr::from_str(ip_str).unwrap();
        assert!(
            SsrfValidator::is_restricted_ip(ip).is_none(),
            "Public IP '{}' should NOT be flagged as restricted",
            ip_str
        );
    }
}

#[test]
fn test_dns_rebinding_resolution_validation_in_scope_engine() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["api.target.com".to_string()],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);

    // Scenario 1: Hostname resolves to valid public IP -> ALLOWED
    let valid_ips = vec![IpAddr::from_str("93.184.216.34").unwrap()];
    let decision = engine.validate_dns_resolution("api.target.com", &valid_ips);
    assert!(decision.allowed);

    // Scenario 2: DNS Rebinding attack — Hostname resolves to 127.0.0.1 -> BLOCKED
    let rebind_loopback = vec![IpAddr::from_str("127.0.0.1").unwrap()];
    let rebind_decision = engine.validate_dns_resolution("api.target.com", &rebind_loopback);
    assert!(!rebind_decision.allowed);
    assert!(rebind_decision.reason.contains("SSRF Defense"));
    assert!(rebind_decision.reason.contains("127.0.0.1"));

    // Scenario 3: Hostname resolves to AWS metadata 169.254.169.254 -> BLOCKED
    let rebind_metadata = vec![IpAddr::from_str("169.254.169.254").unwrap()];
    let meta_decision = engine.validate_dns_resolution("api.target.com", &rebind_metadata);
    assert!(!meta_decision.allowed);
    assert!(meta_decision.reason.contains("SSRF Defense"));

    // Scenario 4: Hostname resolves to IPv6 ULA fd00::1 -> BLOCKED
    let rebind_ipv6 = vec![IpAddr::from_str("fd00::1").unwrap()];
    let ipv6_decision = engine.validate_dns_resolution("api.target.com", &rebind_ipv6);
    assert!(!ipv6_decision.allowed);
    assert!(ipv6_decision.reason.contains("SSRF Defense"));
}

#[test]
fn test_explicit_private_ip_inclusion_for_internal_pentests() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![
            "internal.target.corp".to_string(),
            "10.0.0.0/16".to_string(),
        ],
        excludes: vec![],
    };

    let engine = DefaultScopeEngine::new(scope);

    // 10.0.5.20 is explicitly in scope -> ALLOWED
    let internal_ip = vec![IpAddr::from_str("10.0.5.20").unwrap()];
    let decision = engine.validate_dns_resolution("internal.target.corp", &internal_ip);
    assert!(
        decision.allowed,
        "Explicitly included private subnet must be allowed"
    );

    // 192.168.1.1 is private but NOT in scope -> BLOCKED
    let other_private = vec![IpAddr::from_str("192.168.1.1").unwrap()];
    let blocked_decision = engine.validate_dns_resolution("internal.target.corp", &other_private);
    assert!(!blocked_decision.allowed);
    assert!(blocked_decision.reason.contains("SSRF Defense"));
}

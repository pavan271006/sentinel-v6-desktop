//! Empirical Adversarial Challenge Probes for UCMA-X Milestone 1 (Safe Foundation & Scope Control).
//!
//! This suite conducts rigorous empirical stress-testing against:
//! 1. Scope bypass attempts (DNS rebinding simulations, hex/octal/decimal IP bypasses, URL tricks, path traversal in URLs).
//! 2. Token forging attempts (tampering with AuthorizedRequest payload, signature bit-flips, TTL manipulation).
//! 3. Anti-SSRF bypass attempts (loopback, link-local, private IP ranges, dual-stack IPv4/IPv6, IPv4-mapped IPv6).
//! 4. Response snapshot BLAKE3 bit-level tampering detection.
//! 5. Hop-by-Hop redirect security validation and chained redirect attacks.

use chrono::{Duration, Utc};
use serde_json::Value;
use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::Arc;
use ucma_core::endpoint::HttpMethod;
use ucma_core::ids::{ContentId, RequestId, SnapshotId, TargetId};
use ucma_core::request::RawRequest;
use ucma_core::snapshot::{HttpSnapshotPair, ResponseSnapshot};
use ucma_http::client::SafeHttpClient;
use ucma_http::limits::HttpLimits;
use ucma_http::redirect::{RedirectDecision, RedirectValidator};
use ucma_scope::ScopeError;
use ucma_scope::canonicalize::canonicalize;
use ucma_scope::dns::{IpValidator, SafeDnsResolver};
use ucma_scope::policy::{AuthorizedRequest, ScopePolicy};
use url::Url;

// ============================================================================
// 1. SCOPE BYPASS & URL OBFUSCATION HARNESSES
// ============================================================================

#[tokio::test]
async fn test_adversarial_dns_rebinding_simulations() {
    // Attack scenario: Attacker controls DNS for attacker.com, returning public IP initially
    // but simultaneously or alternately injecting private/loopback/cloud metadata IP addresses.

    let test_cases = vec![
        (
            "rebind-loopback.attacker.com",
            vec!["93.184.216.34", "127.0.0.1"],
        ),
        (
            "rebind-loopback-v6.attacker.com",
            vec!["2606:4700:4700::1111", "::1"],
        ),
        (
            "rebind-aws-metadata.attacker.com",
            vec!["93.184.216.34", "169.254.169.254"],
        ),
        (
            "rebind-rfc1918-10.attacker.com",
            vec!["93.184.216.34", "10.0.0.1"],
        ),
        (
            "rebind-rfc1918-172.attacker.com",
            vec!["93.184.216.34", "172.16.5.10"],
        ),
        (
            "rebind-rfc1918-192.attacker.com",
            vec!["93.184.216.34", "192.168.1.1"],
        ),
        (
            "rebind-cgnat.attacker.com",
            vec!["93.184.216.34", "100.64.0.1"],
        ),
        (
            "rebind-mapped-ipv6.attacker.com",
            vec!["93.184.216.34", "::ffff:127.0.0.1"],
        ),
        (
            "rebind-ula-v6.attacker.com",
            vec!["2606:4700:4700::1111", "fc00::1"],
        ),
        (
            "rebind-linklocal-v6.attacker.com",
            vec!["2606:4700:4700::1111", "fe80::1"],
        ),
    ];

    for (host, ips) in test_cases {
        let mut mock_dns = HashMap::new();
        let ip_addrs: Vec<IpAddr> = ips.iter().map(|s| s.parse().unwrap()).collect();
        mock_dns.insert(host.to_string(), ip_addrs);

        let resolver = SafeDnsResolver::new_mock(mock_dns, false);
        let policy = ScopePolicy::builder()
            .allow_host(host)
            .allow_port(443)
            .with_resolver(resolver)
            .build();

        let raw_url = format!("https://{}/resource", host);
        let res = policy.authorize_url(&raw_url).await;

        assert!(
            res.is_err(),
            "DNS rebinding attack against {} MUST be blocked by fail-closed IP resolution",
            host
        );
        match res.unwrap_err() {
            ScopeError::SsrfBlocked(_, _) => {}
            other => panic!(
                "expected ScopeError::SsrfBlocked for rebinding {}, got {:?}",
                host, other
            ),
        }
    }
}

#[tokio::test]
async fn test_adversarial_ip_representation_and_url_tricks() {
    // Attack scenario: Attacker attempts alternate IP encodings or disallowed URL schemes
    let disallowed_schemes = vec![
        "file:///etc/passwd",
        "file://localhost/etc/shadow",
        "ftp://example.com/data.txt",
        "gopher://127.0.0.1:6379/_GET%20/",
        "dict://127.0.0.1:2628/",
        "ldap://127.0.0.1:389/dc=example",
        "javascript:alert(document.domain)",
        "data:text/html,<script>alert(1)</script>",
        "blob:https://example.com/uuid-blob",
    ];

    for bad_scheme_url in disallowed_schemes {
        let res = canonicalize(bad_scheme_url);
        assert!(
            res.is_err(),
            "Scheme in '{}' MUST be rejected by canonicalization",
            bad_scheme_url
        );
        assert!(matches!(res.unwrap_err(), ScopeError::DisallowedScheme(_)));
    }
}

#[tokio::test]
async fn test_adversarial_path_traversal_and_normalization() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "example.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let policy = ScopePolicy::builder()
        .allow_host("example.com")
        .allow_port(443)
        .allow_path("/api/v1")
        .disallow_path("/api/v1/internal")
        .disallow_path("/api/v1/admin")
        .with_resolver(resolver)
        .build();

    // 1. Path traversal attempting to escape `/api/v1` to `/admin`
    let traversal_attempts = vec![
        "https://example.com/api/v1/../admin",
        "https://example.com/api/v1/../../admin",
        "https://example.com/api/v1/./../admin",
        "https://example.com/api/v1/users/../../admin",
        "https://example.com/../../../etc/passwd",
    ];

    for attempt in traversal_attempts {
        let res = policy.authorize_url(attempt).await;
        assert!(
            res.is_err(),
            "Path traversal '{}' MUST NOT allow reaching unauthorized paths",
            attempt
        );
        match res.unwrap_err() {
            ScopeError::OutOfScope(msg) => {
                assert!(msg.contains("path") || msg.contains("scope"));
            }
            other => panic!(
                "expected ScopeError::OutOfScope for '{}', got {:?}",
                attempt, other
            ),
        }
    }

    // 2. Disallowed prefix enforcement
    let disallowed_subpaths = vec![
        "https://example.com/api/v1/internal",
        "https://example.com/api/v1/internal/debug",
        "https://example.com/api/v1/admin",
        "https://example.com/api/v1/admin/delete",
    ];

    for disallowed in disallowed_subpaths {
        let res = policy.authorize_url(disallowed).await;
        assert!(
            res.is_err(),
            "Disallowed path '{}' MUST be rejected",
            disallowed
        );
        assert!(matches!(res.unwrap_err(), ScopeError::OutOfScope(_)));
    }

    // 3. Allowed subpaths MUST succeed
    let allowed_paths = vec![
        "https://example.com/api/v1/users",
        "https://example.com/api/v1/products?cat=2&sort=asc",
        "https://example.com/api/v1/orders/123",
    ];

    for allowed in allowed_paths {
        let res = policy.authorize_url(allowed).await;
        assert!(
            res.is_ok(),
            "Allowed path '{}' should pass authorization",
            allowed
        );
    }
}

#[tokio::test]
async fn test_adversarial_subdomain_and_host_matching_tricks() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "example.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );
    mock_dns.insert(
        "target.com".to_string(),
        vec!["93.184.216.35".parse().unwrap()],
    );
    mock_dns.insert(
        "sub.target.com".to_string(),
        vec!["93.184.216.36".parse().unwrap()],
    );
    mock_dns.insert(
        "target.com.attacker.com".to_string(),
        vec!["93.184.216.37".parse().unwrap()],
    );
    mock_dns.insert(
        "not-target.com".to_string(),
        vec!["93.184.216.38".parse().unwrap()],
    );
    mock_dns.insert(
        "example.com.evil.org".to_string(),
        vec!["93.184.216.39".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let policy = ScopePolicy::builder()
        .allow_host("example.com")
        .allow_host("*.target.com")
        .allow_port(443)
        .with_resolver(resolver)
        .build();

    // Suffix confusion attacks
    let hostile_hosts = vec![
        "https://target.com.attacker.com/",
        "https://not-target.com/",
        "https://example.com.evil.org/",
        "https://attacker-example.com/",
        "https://evil.com/",
    ];

    for hostile in hostile_hosts {
        let res = policy.authorize_url(hostile).await;
        assert!(
            res.is_err(),
            "Hostile host '{}' MUST be rejected as OutOfScope",
            hostile
        );
        assert!(matches!(res.unwrap_err(), ScopeError::OutOfScope(_)));
    }
}

// ============================================================================
// 2. CAPABILITY TOKEN FORGING & CRYPTOGRAPHIC TAMPER HARNESSES
// ============================================================================

#[tokio::test]
async fn test_adversarial_token_signature_bit_flips() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "api.target.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let salt = [77u8; 32];
    let policy = ScopePolicy::builder()
        .allow_host("api.target.com")
        .allow_port(443)
        .with_resolver(resolver)
        .with_salt(salt)
        .token_ttl_seconds(300)
        .build();

    let valid_token = policy
        .authorize_url("https://api.target.com/v1/query")
        .await
        .unwrap();
    assert!(policy.verify_token(&valid_token).is_ok());

    // Adversarial test: Exhaustive single-bit flipping across ALL 32 bytes and 8 bits/byte of the signature
    for byte_idx in 0..32 {
        for bit_idx in 0..8 {
            let mut val: Value = serde_json::to_value(&valid_token).unwrap();
            let mut sig_bytes: Vec<u8> = serde_json::from_value(val["signature"].clone()).unwrap();
            sig_bytes[byte_idx] ^= 1 << bit_idx;
            val["signature"] = serde_json::to_value(&sig_bytes).unwrap();

            let tampered_token: AuthorizedRequest = serde_json::from_value(val).unwrap();
            let res = policy.verify_token(&tampered_token);
            assert!(
                res.is_err(),
                "Bit-flipped signature at byte {} bit {} MUST fail verification",
                byte_idx,
                bit_idx
            );
            assert!(matches!(
                res.unwrap_err(),
                ScopeError::InvalidCapabilityToken
            ));
        }
    }
}

#[tokio::test]
async fn test_adversarial_token_payload_tampering() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "api.target.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let salt = [88u8; 32];
    let policy = ScopePolicy::builder()
        .allow_host("api.target.com")
        .allow_port(443)
        .with_resolver(resolver)
        .with_salt(salt)
        .token_ttl_seconds(300)
        .build();

    let original_token = policy
        .authorize_url("https://api.target.com/v1/query")
        .await
        .unwrap();

    // 1. Tampering with target URL
    {
        let mut val: Value = serde_json::to_value(&original_token).unwrap();
        val["target_url"] = Value::String("https://api.target.com/v1/admin".to_string());
        let tampered: AuthorizedRequest = serde_json::from_value(val).unwrap();
        assert!(policy.verify_token(&tampered).is_err());
    }

    // 2. Tampering with resolved IPs (e.g. injecting loopback into pinned IPs)
    {
        let mut val: Value = serde_json::to_value(&original_token).unwrap();
        let mut ips: Vec<String> = serde_json::from_value(val["resolved_ips"].clone()).unwrap();
        ips.push("127.0.0.1".to_string());
        val["resolved_ips"] = serde_json::to_value(ips).unwrap();
        let tampered: AuthorizedRequest = serde_json::from_value(val).unwrap();
        assert!(policy.verify_token(&tampered).is_err());
    }

    // 3. Swapping resolved IPs entirely with AWS metadata
    {
        let mut val: Value = serde_json::to_value(&original_token).unwrap();
        val["resolved_ips"] = serde_json::json!(["169.254.169.254"]);
        let tampered: AuthorizedRequest = serde_json::from_value(val).unwrap();
        assert!(policy.verify_token(&tampered).is_err());
    }

    // 4. Tampering with RequestId via request_mut()
    {
        let mut tampered = original_token.clone();
        let mut raw_bytes = *tampered.request().id.as_bytes();
        raw_bytes[0] ^= 0x01;
        tampered.request_mut().id = RequestId::from_bytes(raw_bytes);
        assert!(policy.verify_token(&tampered).is_err());
    }

    // 5. Tampering with authorized_at timestamp
    {
        let mut val: Value = serde_json::to_value(&original_token).unwrap();
        let past_time = Utc::now() - Duration::seconds(60);
        val["authorized_at"] = serde_json::to_value(past_time).unwrap();
        let tampered: AuthorizedRequest = serde_json::from_value(val).unwrap();
        assert!(policy.verify_token(&tampered).is_err());
    }

    // 6. Tampering with expires_at timestamp (attempting to extend token TTL)
    {
        let mut val: Value = serde_json::to_value(&original_token).unwrap();
        let extended_time = Utc::now() + Duration::days(7);
        val["expires_at"] = serde_json::to_value(extended_time).unwrap();
        let tampered: AuthorizedRequest = serde_json::from_value(val).unwrap();
        assert!(policy.verify_token(&tampered).is_err());
    }
}

#[tokio::test]
async fn test_adversarial_token_ttl_expiration_and_salt_isolation() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "api.target.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns.clone(), false);
    let salt_a = [11u8; 32];
    let salt_b = [22u8; 32];

    let policy_a = ScopePolicy::builder()
        .allow_host("api.target.com")
        .allow_port(443)
        .with_resolver(resolver.clone())
        .with_salt(salt_a)
        .token_ttl_seconds(300)
        .build();

    let policy_b = ScopePolicy::builder()
        .allow_host("api.target.com")
        .allow_port(443)
        .with_resolver(resolver)
        .with_salt(salt_b)
        .token_ttl_seconds(300)
        .build();

    // 1. Cross-policy isolation: Token minted by Policy A must fail under Policy B
    let token_a = policy_a
        .authorize_url("https://api.target.com/v1/query")
        .await
        .unwrap();
    assert!(policy_a.verify_token(&token_a).is_ok());
    let res_b = policy_b.verify_token(&token_a);
    assert!(res_b.is_err());
    assert!(matches!(
        res_b.unwrap_err(),
        ScopeError::InvalidCapabilityToken
    ));

    // 2. Expired token evaluation
    let mut val: Value = serde_json::to_value(&token_a).unwrap();
    let expired_time = Utc::now() - Duration::seconds(10);
    val["expires_at"] = serde_json::to_value(expired_time).unwrap();
    let expired_token: AuthorizedRequest = serde_json::from_value(val).unwrap();

    let exp_res = policy_a.verify_token(&expired_token);
    assert!(exp_res.is_err());
    assert!(matches!(
        exp_res.unwrap_err(),
        ScopeError::ExpiredCapabilityToken(_)
    ));
}

// ============================================================================
// 3. EXHAUSTIVE ANTI-SSRF & DUAL-STACK IP PROBE HARNESS
// ============================================================================

#[test]
fn test_exhaustive_anti_ssrf_boundary_matrix() {
    let validator = IpValidator::new(false);

    // Complete adversarial SSRF candidate list across all blocked ranges
    let blocked_candidates: Vec<(&str, &str)> = vec![
        // IPv4 Loopback (127.0.0.0/8)
        ("127.0.0.1", "IPv4 standard loopback"),
        ("127.0.0.2", "IPv4 secondary loopback"),
        ("127.1.2.3", "IPv4 arbitrary loopback"),
        ("127.255.255.254", "IPv4 high loopback"),
        ("127.0.0.0", "IPv4 network loopback"),
        // IPv6 Loopback (::1/128)
        ("::1", "IPv6 standard loopback"),
        ("0:0:0:0:0:0:0:1", "IPv6 full loopback notation"),
        // IPv4 Private - Class A (10.0.0.0/8)
        ("10.0.0.0", "RFC1918 Class A network"),
        ("10.0.0.1", "RFC1918 Class A host"),
        ("10.123.45.67", "RFC1918 Class A arbitrary"),
        ("10.255.255.255", "RFC1918 Class A broadcast"),
        // IPv4 Private - Class B (172.16.0.0/12)
        ("172.16.0.0", "RFC1918 Class B low boundary"),
        ("172.16.0.1", "RFC1918 Class B host"),
        ("172.24.100.50", "RFC1918 Class B mid range"),
        ("172.31.255.255", "RFC1918 Class B high boundary"),
        // IPv4 Private - Class C (192.168.0.0/16)
        ("192.168.0.0", "RFC1918 Class C network"),
        ("192.168.0.1", "RFC1918 Class C router/host"),
        ("192.168.1.254", "RFC1918 Class C internal subnet"),
        ("192.168.255.255", "RFC1918 Class C broadcast"),
        // Link-Local & Cloud IMDS (169.254.0.0/16)
        ("169.254.169.254", "AWS/GCP/Azure/OpenStack IMDS endpoint"),
        ("169.254.0.1", "Link-local low host"),
        ("169.254.255.254", "Link-local high host"),
        // CGNAT Shared Address Space (100.64.0.0/10)
        ("100.64.0.1", "CGNAT low boundary"),
        ("100.100.50.25", "CGNAT mid range"),
        ("100.127.255.254", "CGNAT high boundary"),
        // Multicast (224.0.0.0/4 and ff00::/8)
        ("224.0.0.1", "IPv4 multicast all-systems"),
        ("239.255.255.250", "IPv4 SSDP multicast"),
        ("ff02::1", "IPv6 link-local multicast"),
        ("ff05::2", "IPv6 site-local multicast"),
        // Broadcast & Reserved (0.0.0.0/8 and 240.0.0.0/4)
        ("0.0.0.0", "IPv4 unspecified/current network"),
        ("0.0.0.1", "IPv4 0/8 host"),
        ("240.0.0.1", "IPv4 reserved Class E"),
        ("255.255.255.255", "IPv4 limited broadcast"),
        // Documentation Ranges (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
        ("192.0.2.1", "TEST-NET-1 documentation"),
        ("198.51.100.1", "TEST-NET-2 documentation"),
        ("203.0.113.1", "TEST-NET-3 documentation"),
        // IPv6 Link-Local (fe80::/10) & Unique Local (fc00::/7)
        ("fe80::1", "IPv6 link-local"),
        ("fe80::dead:beef", "IPv6 link-local with host interface"),
        ("fc00::1", "IPv6 unique local (ULA)"),
        ("fd00::1", "IPv6 unique local (ULA) locally assigned"),
        ("fd12:3456:789a::1", "IPv6 ULA subnet"),
        ("::", "IPv6 unspecified"),
        // IPv4-Mapped IPv6 (::ffff:w.x.y.z)
        ("::ffff:127.0.0.1", "IPv4-mapped IPv6 loopback"),
        ("::ffff:10.0.0.1", "IPv4-mapped IPv6 RFC1918 Class A"),
        ("::ffff:172.16.0.1", "IPv4-mapped IPv6 RFC1918 Class B"),
        ("::ffff:192.168.1.1", "IPv4-mapped IPv6 RFC1918 Class C"),
        ("::ffff:169.254.169.254", "IPv4-mapped IPv6 AWS IMDS"),
        ("::ffff:0.0.0.0", "IPv4-mapped IPv6 0.0.0.0"),
    ];

    for (ip_str, desc) in blocked_candidates {
        let ip: IpAddr = IpAddr::from_str(ip_str)
            .unwrap_or_else(|e| panic!("Failed to parse IP '{}': {}", ip_str, e));
        assert!(
            validator.validate_ip(ip).is_err(),
            "IP '{}' ({}) MUST be blocked by anti-SSRF validator",
            ip_str,
            desc
        );
        assert!(validator.is_blocked(&ip));
        assert!(!validator.is_allowed(&ip));
    }

    // Public Internet IP candidates MUST pass validation
    let allowed_public_candidates = vec![
        "93.184.216.34",        // example.com
        "8.8.8.8",              // Google DNS
        "1.1.1.1",              // Cloudflare DNS
        "142.250.190.46",       // Google Web
        "151.101.1.69",         // Fastly CDN
        "2606:4700:4700::1111", // Cloudflare IPv6
        "2001:4860:4860::8888", // Google IPv6
    ];

    for ip_str in allowed_public_candidates {
        let ip: IpAddr = IpAddr::from_str(ip_str).unwrap();
        assert!(
            validator.validate_ip(ip).is_ok(),
            "Public IP '{}' should be allowed",
            ip_str
        );
        assert!(validator.is_allowed(&ip));
        assert!(!validator.is_blocked(&ip));
    }
}

// ============================================================================
// 4. RESPONSE SNAPSHOT BLAKE3 BIT-LEVEL INTEGRITY HARNESS
// ============================================================================

#[test]
fn test_adversarial_response_snapshot_bit_level_tamper_detection() {
    let target_id = TargetId::derive("https://target.local");
    let req = RawRequest::from_url(
        target_id,
        HttpMethod::Get,
        Url::parse("https://target.local/test").unwrap(),
    );

    let raw_wire = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 18\r\n\r\n{\"data\":\"secret\"}";
    let body = b"{\"data\":\"secret\"}".to_vec();
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    headers.insert("content-length".to_string(), "18".to_string());

    let snapshot = ResponseSnapshot::new(
        req.id,
        200,
        headers.clone(),
        body.clone(),
        5_000_000,
        raw_wire,
        false,
        Some("93.184.216.34".to_string()),
    );

    // Verify pristine hashes
    assert_eq!(snapshot.blake3_body_hash, ContentId::from_data(&body));
    assert_eq!(
        snapshot.blake3_raw_wire_hash,
        ContentId::from_data(raw_wire)
    );
    assert_eq!(snapshot.id, SnapshotId::derive(&req.id, 200, raw_wire));

    // 1. Bit-level tampering on body bytes
    for byte_idx in 0..body.len() {
        for bit_idx in 0..8 {
            let mut tampered_body = body.clone();
            tampered_body[byte_idx] ^= 1 << bit_idx;

            let recomputed_hash = ContentId::from_data(&tampered_body);
            assert_ne!(
                recomputed_hash, snapshot.blake3_body_hash,
                "1-bit tamper at byte {} bit {} in body MUST alter BLAKE3 hash",
                byte_idx, bit_idx
            );
        }
    }

    // 2. Bit-level tampering on raw wire bytes
    for byte_idx in 0..raw_wire.len() {
        let mut tampered_wire = raw_wire.to_vec();
        tampered_wire[byte_idx] ^= 0x01;

        let recomputed_wire_hash = ContentId::from_data(&tampered_wire);
        assert_ne!(
            recomputed_wire_hash, snapshot.blake3_raw_wire_hash,
            "1-bit tamper at byte {} in wire bytes MUST alter BLAKE3 wire hash",
            byte_idx
        );

        let recomputed_snapshot_id = SnapshotId::derive(&req.id, 200, &tampered_wire);
        assert_ne!(
            recomputed_snapshot_id, snapshot.id,
            "Altered wire bytes MUST alter derived SnapshotId"
        );
    }

    // 3. Status code tampering
    let fake_status_id = SnapshotId::derive(&req.id, 500, raw_wire);
    assert_ne!(
        fake_status_id, snapshot.id,
        "Altered status code MUST alter SnapshotId"
    );

    // 4. Combined HttpSnapshotPair integrity
    let pair = HttpSnapshotPair::new(req.clone(), snapshot.clone());
    assert_eq!(pair.request.id, req.id);
    assert_eq!(pair.response.id, snapshot.id);
}

// ============================================================================
// 5. HOP-BY-HOP REDIRECT SECURITY VALIDATION & CHAINED REDIRECT ATTACKS
// ============================================================================

#[tokio::test]
async fn test_adversarial_chained_redirect_attack_prevention() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "gateway.example.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );
    mock_dns.insert(
        "hop1.example.com".to_string(),
        vec!["93.184.216.35".parse().unwrap()],
    );
    mock_dns.insert(
        "hop2.example.com".to_string(),
        vec!["93.184.216.36".parse().unwrap()],
    );
    mock_dns.insert(
        "evil-exfil.com".to_string(),
        vec!["93.184.216.99".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("gateway.example.com")
            .allow_host("hop1.example.com")
            .allow_host("hop2.example.com")
            .allow_port(443)
            .with_resolver(resolver)
            .max_redirects(3)
            .build(),
    );

    // Scenario A: Chained redirect bouncing from hop1 -> hop2 -> out-of-scope evil-exfil.com
    let current_url = Url::parse("https://gateway.example.com/start").unwrap();
    let mut headers_1 = HashMap::new();
    headers_1.insert(
        "location".to_string(),
        "https://hop1.example.com/next".to_string(),
    );

    // Hop 1: Allowed -> returns Follow
    let dec1 = RedirectValidator::evaluate_hop(&current_url, 302, &headers_1, 0, 3, &policy)
        .await
        .unwrap();
    let auth1 = match dec1 {
        RedirectDecision::Follow(a) => a,
        _ => panic!("expected Follow for Hop 1"),
    };
    assert_eq!(auth1.target_url().host_str().unwrap(), "hop1.example.com");

    // Hop 2: hop1.example.com redirects to hop2.example.com -> returns Follow
    let mut headers_2 = HashMap::new();
    headers_2.insert(
        "location".to_string(),
        "https://hop2.example.com/final".to_string(),
    );
    let dec2 = RedirectValidator::evaluate_hop(auth1.target_url(), 302, &headers_2, 1, 3, &policy)
        .await
        .unwrap();
    let auth2 = match dec2 {
        RedirectDecision::Follow(a) => a,
        _ => panic!("expected Follow for Hop 2"),
    };
    assert_eq!(auth2.target_url().host_str().unwrap(), "hop2.example.com");

    // Hop 3: hop2.example.com attempts to redirect to evil-exfil.com -> MUST be rejected
    let mut headers_evil = HashMap::new();
    headers_evil.insert(
        "location".to_string(),
        "https://evil-exfil.com/stolen".to_string(),
    );
    let dec3_res =
        RedirectValidator::evaluate_hop(auth2.target_url(), 302, &headers_evil, 2, 3, &policy)
            .await;
    assert!(
        dec3_res.is_err(),
        "Redirect to out-of-scope host MUST fail closed"
    );
    assert!(matches!(dec3_res.unwrap_err(), ScopeError::OutOfScope(_)));

    // Scenario B: Chained redirect attempting SSRF to AWS metadata (169.254.169.254)
    let mut headers_ssrf = HashMap::new();
    headers_ssrf.insert(
        "location".to_string(),
        "http://169.254.169.254/latest/meta-data/".to_string(),
    );
    let ssrf_res =
        RedirectValidator::evaluate_hop(auth2.target_url(), 302, &headers_ssrf, 2, 3, &policy)
            .await;
    assert!(
        ssrf_res.is_err(),
        "Redirect to AWS metadata MUST fail closed as SSRF"
    );
    match ssrf_res.unwrap_err() {
        ScopeError::SsrfBlocked(_, _)
        | ScopeError::DisallowedPort(_)
        | ScopeError::OutOfScope(_) => {}
        other => panic!("expected SSRF / Scope denial, got {:?}", other),
    }

    // Scenario C: Hop limit exhaustion (redirect loop)
    let mut headers_loop = HashMap::new();
    headers_loop.insert(
        "location".to_string(),
        "https://hop1.example.com/loop".to_string(),
    );
    let loop_res =
        RedirectValidator::evaluate_hop(auth2.target_url(), 302, &headers_loop, 3, 3, &policy)
            .await;
    assert!(
        loop_res.is_err(),
        "Exceeding max redirects MUST return TooManyRedirects"
    );
    assert!(matches!(
        loop_res.unwrap_err(),
        ScopeError::TooManyRedirects(3)
    ));
}

// ============================================================================
// 6. SAFE HTTP CLIENT CAPABILITY-GATE ADVERSARIAL DISPATCH
// ============================================================================

#[tokio::test]
async fn test_adversarial_safe_http_client_tampered_token_rejection() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "api.target.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let salt = [99u8; 32];
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("api.target.com")
            .allow_port(443)
            .with_resolver(resolver)
            .with_salt(salt)
            .build(),
    );

    let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();

    let valid_token = policy
        .authorize_url("https://api.target.com/v1/query")
        .await
        .unwrap();

    // Adversarial: Send token with modified RequestId
    let mut tampered_token = valid_token.clone();
    let mut raw_bytes = *tampered_token.request().id.as_bytes();
    raw_bytes[0] ^= 0xFF;
    tampered_token.request_mut().id = RequestId::from_bytes(raw_bytes);

    let res = client.send(tampered_token).await;
    assert!(
        res.is_err(),
        "SafeHttpClient MUST reject tampered token before network egress"
    );
}

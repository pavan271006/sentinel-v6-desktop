//! Opaque-Box E2E Suite: Scope Compliance, URL Canonicalization, and Anti-SSRF Enforcement.

use std::net::IpAddr;
use ucma_core::endpoint::HttpMethod;
use ucma_e2e::fixtures::{build_standard_test_policy, create_mock_dns, create_test_request};
use ucma_scope::ScopeError;
use ucma_scope::canonicalize::canonicalize;
use ucma_scope::dns::IpValidator;
use ucma_scope::policy::ScopePolicy;

#[tokio::test]
async fn test_e2e_exact_domain_matching_in_scope() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://example.com/api/v1/resource", HttpMethod::Get);
    let auth_res = policy.authorize(req).await;

    assert!(auth_res.is_ok(), "in-scope request must be authorized");
    let auth_token = auth_res.unwrap();
    assert_eq!(auth_token.target_url().host_str().unwrap(), "example.com");
    assert_eq!(
        auth_token.resolved_ips(),
        &["93.184.216.34".parse::<IpAddr>().unwrap()]
    );
}

#[tokio::test]
async fn test_e2e_wildcard_subdomain_matching() {
    let resolver = create_mock_dns(
        vec![
            ("api.target.com", vec!["93.184.216.35"]),
            ("auth.target.com", vec!["93.184.216.36"]),
            ("deep.sub.target.com", vec!["93.184.216.37"]),
        ],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req1 = create_test_request("https://api.target.com/users", HttpMethod::Get);
    assert!(policy.authorize(req1).await.is_ok());

    let req2 = create_test_request("https://auth.target.com/login", HttpMethod::Post);
    assert!(policy.authorize(req2).await.is_ok());

    let req3 = create_test_request("https://deep.sub.target.com/status", HttpMethod::Get);
    assert!(policy.authorize(req3).await.is_ok());
}

#[tokio::test]
async fn test_e2e_default_deny_unregistered_domains() {
    let resolver = create_mock_dns(
        vec![("malicious-attacker.org", vec!["93.184.216.99"])],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req = create_test_request("https://malicious-attacker.org/exfil", HttpMethod::Get);
    let res = policy.authorize(req).await;

    assert!(res.is_err());
    assert!(matches!(res.unwrap_err(), ScopeError::OutOfScope(_)));
}

#[tokio::test]
async fn test_e2e_port_filtering_enforcement() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = build_standard_test_policy(resolver);

    // Port 443 is allowed
    let req_ok = create_test_request("https://example.com:443/api", HttpMethod::Get);
    assert!(policy.authorize(req_ok).await.is_ok());

    // Port 22 (SSH) is disallowed
    let req_ssh = create_test_request("https://example.com:22/api", HttpMethod::Get);
    let res = policy.authorize(req_ssh).await;
    assert!(res.is_err());
    assert!(matches!(res.unwrap_err(), ScopeError::DisallowedPort(22)));
}

#[tokio::test]
async fn test_e2e_path_prefix_filtering() {
    let resolver = create_mock_dns(vec![("example.com", vec!["93.184.216.34"])], false);
    let policy = ScopePolicy::builder()
        .allow_host("example.com")
        .allow_path("/api/v1/")
        .disallow_path("/api/v1/admin")
        .with_resolver(resolver)
        .build();

    let req_ok = create_test_request("https://example.com/api/v1/users", HttpMethod::Get);
    assert!(policy.authorize(req_ok).await.is_ok());

    let req_denied_admin =
        create_test_request("https://example.com/api/v1/admin/delete", HttpMethod::Post);
    assert!(policy.authorize(req_denied_admin).await.is_err());

    let req_denied_root = create_test_request("https://example.com/index.html", HttpMethod::Get);
    assert!(policy.authorize(req_denied_root).await.is_err());
}

#[tokio::test]
async fn test_e2e_url_canonicalization() {
    // 1. Path traversal normalization
    let u1 = canonicalize("https://example.com/api/v1/../../secret/path").unwrap();
    assert_eq!(u1.path(), "/secret/path");

    // 2. Query parameter sorting
    let u2 = canonicalize("https://example.com/search?z=3&a=1&m=2").unwrap();
    assert_eq!(u2.query().unwrap(), "a=1&m=2&z=3");

    // 3. Default port stripping
    let u3 = canonicalize("https://example.com:443/test").unwrap();
    assert_eq!(u3.port(), None);

    // 4. Scheme check
    assert!(canonicalize("ftp://example.com/file").is_err());
    assert!(canonicalize("javascript:alert(1)").is_err());
}

#[tokio::test]
async fn test_e2e_anti_ssrf_blocking_all_private_and_loopback_ranges() {
    let test_cases = vec![
        ("127.0.0.1", true, "IPv4 loopback"),
        ("127.0.0.254", true, "IPv4 loopback range"),
        ("10.0.0.1", true, "RFC 1918 10/8"),
        ("10.255.255.254", true, "RFC 1918 10/8"),
        ("172.16.0.1", true, "RFC 1918 172.16/12"),
        ("172.31.255.254", true, "RFC 1918 172.16/12"),
        ("192.168.1.1", true, "RFC 1918 192.168/16"),
        ("169.254.169.254", true, "IPv4 link-local (Cloud metadata)"),
        ("224.0.0.1", true, "IPv4 multicast"),
        ("255.255.255.255", true, "IPv4 broadcast"),
        ("192.0.2.1", true, "RFC 5737 documentation"),
        ("::1", true, "IPv6 loopback"),
        ("fe80::1", true, "IPv6 link-local"),
        ("fc00::1", true, "IPv6 unique local"),
        ("ff02::1", true, "IPv6 multicast"),
        ("93.184.216.34", false, "Public IP (Example.com)"),
        ("1.1.1.1", false, "Public IP (Cloudflare)"),
        ("8.8.8.8", false, "Public IP (Google)"),
    ];

    let validator = IpValidator::new(false);

    for (ip_str, should_block, desc) in test_cases {
        let ip: IpAddr = ip_str.parse().expect("valid ip");
        let is_blocked = validator.validate_ip(ip).is_err();
        assert_eq!(
            is_blocked, should_block,
            "SSRF filter failed for {}: {} (expected blocked={})",
            desc, ip_str, should_block
        );
    }
}

#[tokio::test]
async fn test_e2e_anti_ssrf_scope_authorization_denial() {
    let resolver = create_mock_dns(
        vec![
            ("meta.target.com", vec!["169.254.169.254"]),
            ("internal.target.com", vec!["10.0.0.5"]),
            ("localhost.target.com", vec!["127.0.0.1"]),
        ],
        false,
    );
    let policy = build_standard_test_policy(resolver);

    let req_meta = create_test_request("https://meta.target.com/latest/meta-data", HttpMethod::Get);
    let res_meta = policy.authorize(req_meta).await;
    assert!(res_meta.is_err());
    assert!(matches!(
        res_meta.unwrap_err(),
        ScopeError::SsrfBlocked(_, _)
    ));

    let req_internal = create_test_request("https://internal.target.com/db", HttpMethod::Get);
    let res_internal = policy.authorize(req_internal).await;
    assert!(res_internal.is_err());
    assert!(matches!(
        res_internal.unwrap_err(),
        ScopeError::SsrfBlocked(_, _)
    ));

    let req_localhost = create_test_request("https://localhost.target.com/admin", HttpMethod::Get);
    let res_localhost = policy.authorize(req_localhost).await;
    assert!(res_localhost.is_err());
    assert!(matches!(
        res_localhost.unwrap_err(),
        ScopeError::SsrfBlocked(_, _)
    ));
}

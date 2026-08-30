use std::collections::HashMap;
use std::net::IpAddr;
use ucma_scope::ScopeError;
use ucma_scope::dns::{IpValidator, SafeDnsResolver};
use ucma_scope::policy::ScopePolicy;

#[test]
fn test_ssrf_comprehensive_matrix() {
    let validator = IpValidator::new(false);

    let blocked_ips: Vec<&str> = vec![
        // IPv4 Loopback
        "127.0.0.1",
        "127.0.0.254",
        "127.255.255.255",
        // IPv4 Private
        "10.0.0.1",
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.0.1",
        "192.168.255.255",
        // Cloud Metadata & Link-Local
        "169.254.169.254",
        "169.254.0.1",
        // CGNAT
        "100.64.0.1",
        "100.127.255.255",
        // Broadcast / Reserved
        "0.0.0.0",
        "255.255.255.255",
        "224.0.0.1", // Multicast
        "240.0.0.1", // Reserved
        // Documentation
        "192.0.2.1",
        "198.51.100.1",
        "203.0.113.1",
        // IPv6
        "::1",
        "::",
        "fc00::1",
        "fd00::1",
        "fe80::1",
        "ff02::1",
        // IPv4-Mapped IPv6
        "::ffff:127.0.0.1",
        "::ffff:10.1.2.3",
        "::ffff:169.254.169.254",
        "::ffff:192.168.1.1",
    ];

    for ip_str in blocked_ips {
        let ip: IpAddr = ip_str.parse().expect("valid IP string");
        assert!(
            validator.validate_ip(ip).is_err(),
            "IP {} MUST be blocked by SSRF filter",
            ip_str
        );
    }

    // Public IPs must be permitted
    let allowed_ips: Vec<&str> = vec![
        "93.184.216.34",
        "8.8.8.8",
        "1.1.1.1",
        "2606:4700:4700::1111",
    ];

    for ip_str in allowed_ips {
        let ip: IpAddr = ip_str.parse().expect("valid IP string");
        assert!(
            validator.validate_ip(ip).is_ok(),
            "Public IP {} should be allowed",
            ip_str
        );
    }
}

#[tokio::test]
async fn test_dns_pinning_and_rebinding_defense() {
    let mut mock_dns = HashMap::new();
    // Rebinding attempt: host resolves to both public and private IP
    mock_dns.insert(
        "rebind.attacker.com".to_string(),
        vec![
            "93.184.216.34".parse().unwrap(),
            "127.0.0.1".parse().unwrap(), // Injected private address
        ],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let policy = ScopePolicy::builder()
        .allow_host("rebind.attacker.com")
        .with_resolver(resolver)
        .build();

    let res = policy
        .authorize_url("https://rebind.attacker.com/status")
        .await;
    assert!(
        res.is_err(),
        "Rebinding host with mixed IPs must fail closed"
    );
    assert!(matches!(res.unwrap_err(), ScopeError::SsrfBlocked(_, _)));
}

#[tokio::test]
async fn test_capability_token_immutability_and_signing() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "api.target.com".to_string(),
        vec!["93.184.216.34".parse().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false);
    let salt = [42u8; 32];
    let policy = ScopePolicy::builder()
        .allow_host("api.target.com")
        .with_resolver(resolver)
        .with_salt(salt)
        .build();

    let mut token = policy
        .authorize_url("https://api.target.com/v1/users")
        .await
        .unwrap();

    // Verify valid signature
    assert!(policy.verify_token(&token).is_ok());

    // Tampering with request ID breaks signature verification
    token.request_mut().id = ucma_core::ids::RequestId::from_bytes([99u8; 32]);
    assert!(policy.verify_token(&token).is_err());
}

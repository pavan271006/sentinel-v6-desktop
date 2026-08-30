//! Test fixtures, mock DNS resolvers, and helper builders for E2E testing.

use std::collections::HashMap;
use std::net::IpAddr;
use ucma_core::endpoint::HttpMethod;
use ucma_core::ids::TargetId;
use ucma_core::request::RawRequest;
use ucma_scope::dns::SafeDnsResolver;
use ucma_scope::policy::ScopePolicy;
use url::Url;

/// Creates a mock SafeDnsResolver with pre-configured hostname mappings.
pub fn create_mock_dns(entries: Vec<(&str, Vec<&str>)>, allow_private: bool) -> SafeDnsResolver {
    let mut map = HashMap::new();
    for (host, ips) in entries {
        let ip_addrs: Vec<IpAddr> = ips
            .into_iter()
            .map(|s| s.parse().expect("valid ip"))
            .collect();
        map.insert(host.to_string(), ip_addrs);
    }
    SafeDnsResolver::new_mock(map, allow_private)
}

/// Helper to build a standard in-scope test policy for `example.com` and `*.target.com`.
pub fn build_standard_test_policy(resolver: SafeDnsResolver) -> ScopePolicy {
    ScopePolicy::builder()
        .allow_host("example.com")
        .allow_host("*.target.com")
        .allow_port(80)
        .allow_port(443)
        .allow_port(8080)
        .allow_port(8443)
        .with_resolver(resolver)
        .with_salt([42u8; 32])
        .token_ttl_seconds(60)
        .build()
}

/// Creates a standard RawRequest for a given URL string.
pub fn create_test_request(raw_url: &str, method: HttpMethod) -> RawRequest {
    let url = Url::parse(raw_url).expect("valid url");
    let target_id = TargetId::derive(url.as_str());
    RawRequest::new(target_id, method, url)
}

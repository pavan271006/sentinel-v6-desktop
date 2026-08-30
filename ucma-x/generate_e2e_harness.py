import os

base_dir = r"c:\Users\Legion 5 pro\Desktop\cyber sec\ucma-x\tests\e2e"
src_dir = os.path.join(base_dir, "src")
tests_dir = os.path.join(base_dir, "tests")

os.makedirs(src_dir, exist_ok=True)
os.makedirs(tests_dir, exist_ok=True)

# 1. Cargo.toml
cargo_toml = """[package]
name = "ucma-e2e"
version = "0.1.0"
edition = "2024"

[dependencies]
ucma-core = { path = "../../crates/ucma-core" }
ucma-scope = { path = "../../crates/ucma-scope" }
ucma-http = { path = "../../crates/ucma-http" }
ucma-session = { path = "../../crates/ucma-session" }
ucma-bench = { path = "../../crates/ucma-bench" }
tokio = { workspace = true }
url = { workspace = true }
blake3 = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
chrono = { workspace = true }
ipnet = { workspace = true }
bytes = { workspace = true }
reqwest = { workspace = true }
"""

with open(os.path.join(base_dir, "Cargo.toml"), "w", encoding="utf-8") as f:
    f.write(cargo_toml)

# 2. src/lib.rs
src_lib = """//! UCMA-X End-to-End Testing Harness and Fixture Suite.
//!
//! Provides opaque-box verification test runners, mock DNS generators,
//! and assertion helpers across all 4 tiers of the testing architecture.

pub mod fixtures;

pub use fixtures::*;
"""

with open(os.path.join(src_dir, "lib.rs"), "w", encoding="utf-8") as f:
    f.write(src_lib)

# 3. src/fixtures.rs
src_fixtures = """//! Test fixtures, mock DNS resolvers, and helper builders for E2E testing.

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
        let ip_addrs: Vec<IpAddr> = ips.into_iter().map(|s| s.parse().expect("valid ip")).collect();
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
        .with_token_ttl(60)
        .build()
}

/// Creates a standard RawRequest for a given URL string.
pub fn create_test_request(raw_url: &str, method: HttpMethod) -> RawRequest {
    let url = Url::parse(raw_url).expect("valid url");
    let target_id = TargetId::derive(url.as_str());
    RawRequest::new(target_id, method, url)
}
"""

with open(os.path.join(src_dir, "fixtures.rs"), "w", encoding="utf-8") as f:
    f.write(src_fixtures)

print("Wrote package infrastructure files successfully.")

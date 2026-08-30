//! Centralized fail-closed scope policy engine and AuthorizedRequest capability tokens.

use crate::canonicalize::{canonicalize, canonicalize_url};
use crate::dns::{ResolvedTarget, SafeDnsResolver};
use crate::errors::ScopeError;
use crate::matcher::ScopeMatcher;
use chrono::{DateTime, Duration, Utc};
use ipnet::IpNet;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use ucma_core::endpoint::HttpMethod;
use ucma_core::ids::{RequestId, TargetId};
use ucma_core::request::RawRequest;
use url::Url;

/// Opaque capability token granting authorization to execute a validated HTTP request.
///
/// Required by `ucma-http::SafeHttpClient::send` to prevent un-authorized network egress.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthorizedRequest {
    pub(crate) request: RawRequest,
    pub(crate) target_url: Url,
    pub(crate) resolved_ips: Vec<IpAddr>,
    pub(crate) signature: [u8; 32],
    pub(crate) authorized_at: DateTime<Utc>,
    pub(crate) expires_at: DateTime<Utc>,
}

impl AuthorizedRequest {
    /// Returns a reference to the validated raw request.
    pub fn request(&self) -> &RawRequest {
        &self.request
    }

    /// Returns a mutable reference to the inner raw request (for session/header updates).
    pub fn request_mut(&mut self) -> &mut RawRequest {
        &mut self.request
    }

    /// Returns the canonicalized target URL.
    pub fn target_url(&self) -> &Url {
        &self.target_url
    }

    /// Returns the pinned IP addresses resolved during pre-flight authorization.
    pub fn resolved_ips(&self) -> &[IpAddr] {
        &self.resolved_ips
    }

    /// Returns the timestamp when authorization was minted.
    pub fn authorized_at(&self) -> DateTime<Utc> {
        self.authorized_at
    }

    /// Returns the expiration timestamp.
    pub fn expires_at(&self) -> DateTime<Utc> {
        self.expires_at
    }

    /// Checks whether the capability token has expired.
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    /// Returns the cryptographic scope signature.
    pub fn signature(&self) -> &[u8; 32] {
        &self.signature
    }

    /// Verifies the token cryptographic signature against the policy salt.
    pub fn verify_signature(&self, salt: &[u8; 32]) -> bool {
        let expected = compute_signature(
            salt,
            &self.request.id,
            self.target_url.as_str(),
            &self.resolved_ips,
            self.authorized_at,
            self.expires_at,
        );
        self.signature == expected
    }
}

/// Computes the cryptographic signature for an authorized request.
fn compute_signature(
    salt: &[u8; 32],
    req_id: &RequestId,
    target_url: &str,
    resolved_ips: &[IpAddr],
    authorized_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new_keyed(salt);
    hasher.update(b"UCMA_AUTH_CAPABILITY_TOKEN_V1:");
    hasher.update(req_id.as_bytes());
    hasher.update(b"|");
    hasher.update(target_url.as_bytes());
    for ip in resolved_ips {
        hasher.update(b"|");
        hasher.update(ip.to_string().as_bytes());
    }
    hasher.update(b"|");
    hasher.update(
        &authorized_at
            .timestamp_nanos_opt()
            .unwrap_or(0)
            .to_le_bytes(),
    );
    hasher.update(b"|");
    hasher.update(&expires_at.timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    *hasher.finalize().as_bytes()
}

/// Centralized fail-closed scope policy engine.
#[derive(Debug, Clone)]
pub struct ScopePolicy {
    matcher: ScopeMatcher,
    dns_resolver: SafeDnsResolver,
    secret_salt: [u8; 32],
    max_redirects: usize,
    token_ttl_seconds: i64,
}

impl ScopePolicy {
    /// Returns a new ScopePolicyBuilder.
    pub fn builder() -> ScopePolicyBuilder {
        ScopePolicyBuilder::new()
    }

    /// Authorizes a RawRequest, enforcing canonicalization, host/port/path matching,
    /// anti-SSRF DNS resolution, and IP subnet pinning.
    pub async fn authorize(&self, mut req: RawRequest) -> Result<AuthorizedRequest, ScopeError> {
        // 1. URL Canonicalization
        let canonical_url = canonicalize_url(&req.url)?;
        req.url = canonical_url.clone();

        let host = canonical_url
            .host_str()
            .ok_or_else(|| ScopeError::CanonicalizationError("URL missing host".to_string()))?;

        let port = canonical_url
            .port_or_known_default()
            .ok_or(ScopeError::DisallowedPort(0))?;

        // 2. Port matching
        if !self.matcher.is_port_allowed(port) {
            return Err(ScopeError::DisallowedPort(port));
        }

        // 3. Host / Domain matching
        if !self.matcher.is_host_allowed(host) {
            return Err(ScopeError::OutOfScope(format!(
                "host '{}' is not in allowed hosts",
                host
            )));
        }

        // 4. Path matching
        if !self.matcher.is_path_allowed(canonical_url.path()) {
            return Err(ScopeError::OutOfScope(format!(
                "path '{}' violates scope path policy",
                canonical_url.path()
            )));
        }

        // 5. Anti-SSRF DNS Resolution & IP Pinning
        let ResolvedTarget { resolved_ips, .. } =
            self.dns_resolver.resolve_and_validate(host, port).await?;

        // 6. CIDR boundary check on all resolved IPs
        for &ip in &resolved_ips {
            if !self.matcher.is_ip_in_cidr_scope(ip) {
                return Err(ScopeError::OutOfScope(format!(
                    "resolved IP {} is outside allowed CIDR subnets",
                    ip
                )));
            }
        }

        // 7. Mint AuthorizedRequest Capability Token
        let authorized_at = Utc::now();
        let expires_at = authorized_at + Duration::seconds(self.token_ttl_seconds);
        let signature = compute_signature(
            &self.secret_salt,
            &req.id,
            canonical_url.as_str(),
            &resolved_ips,
            authorized_at,
            expires_at,
        );

        Ok(AuthorizedRequest {
            request: req,
            target_url: canonical_url,
            resolved_ips,
            signature,
            authorized_at,
            expires_at,
        })
    }

    /// Convenience method to create and authorize a GET request for a URL.
    pub async fn authorize_url(&self, raw_url: &str) -> Result<AuthorizedRequest, ScopeError> {
        let parsed = canonicalize(raw_url)?;
        let target_id = TargetId::derive(parsed.as_str());
        let req = RawRequest::from_url(target_id, HttpMethod::Get, parsed);
        self.authorize(req).await
    }

    /// Returns max redirects configured.
    pub fn max_redirects(&self) -> usize {
        self.max_redirects
    }

    /// Verifies an existing capability token against this policy's cryptographic salt and expiration.
    pub fn verify_token(&self, token: &AuthorizedRequest) -> Result<(), ScopeError> {
        if token.is_expired() {
            return Err(ScopeError::ExpiredCapabilityToken(
                token.expires_at.to_rfc3339(),
            ));
        }

        if !token.verify_signature(&self.secret_salt) {
            return Err(ScopeError::InvalidCapabilityToken);
        }

        Ok(())
    }
}

/// Fluent builder for constructing a ScopePolicy.
#[derive(Debug, Clone)]
pub struct ScopePolicyBuilder {
    allowed_hosts: Vec<String>,
    allowed_ports: Vec<u16>,
    allowed_paths: Vec<String>,
    denied_paths: Vec<String>,
    denied_path_regexes: Vec<Regex>,
    allowed_cidrs: Vec<IpNet>,
    denied_cidrs: Vec<IpNet>,
    allow_subdomains: bool,
    allow_private_ips: bool,
    dns_resolver: Option<SafeDnsResolver>,
    secret_salt: Option<[u8; 32]>,
    max_redirects: usize,
    token_ttl_seconds: i64,
}

impl Default for ScopePolicyBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl ScopePolicyBuilder {
    pub fn new() -> Self {
        Self {
            allowed_hosts: Vec::new(),
            allowed_ports: Vec::new(),
            allowed_paths: Vec::new(),
            denied_paths: Vec::new(),
            denied_path_regexes: Vec::new(),
            allowed_cidrs: Vec::new(),
            denied_cidrs: Vec::new(),
            allow_subdomains: false,
            allow_private_ips: false,
            dns_resolver: None,
            secret_salt: None,
            max_redirects: 5,
            token_ttl_seconds: 300, // 5 minutes
        }
    }

    pub fn allow_host(mut self, host: impl Into<String>) -> Self {
        self.allowed_hosts.push(host.into());
        self
    }

    pub fn allow_port(mut self, port: u16) -> Self {
        self.allowed_ports.push(port);
        self
    }

    pub fn allow_path(mut self, path: impl Into<String>) -> Self {
        self.allowed_paths.push(path.into());
        self
    }

    pub fn disallow_path(mut self, path: impl Into<String>) -> Self {
        self.denied_paths.push(path.into());
        self
    }

    pub fn disallow_path_regex(mut self, regex: Regex) -> Self {
        self.denied_path_regexes.push(regex);
        self
    }

    pub fn allow_cidr(mut self, cidr: IpNet) -> Self {
        self.allowed_cidrs.push(cidr);
        self
    }

    pub fn disallow_cidr(mut self, cidr: IpNet) -> Self {
        self.denied_cidrs.push(cidr);
        self
    }

    pub fn allow_subdomains(mut self, allow: bool) -> Self {
        self.allow_subdomains = allow;
        self
    }

    pub fn allow_private_ips(mut self, allow: bool) -> Self {
        self.allow_private_ips = allow;
        self
    }

    pub fn with_resolver(mut self, resolver: SafeDnsResolver) -> Self {
        self.dns_resolver = Some(resolver);
        self
    }

    pub fn with_salt(mut self, salt: [u8; 32]) -> Self {
        self.secret_salt = Some(salt);
        self
    }

    pub fn max_redirects(mut self, max: usize) -> Self {
        self.max_redirects = max;
        self
    }

    pub fn token_ttl_seconds(mut self, ttl: i64) -> Self {
        self.token_ttl_seconds = ttl;
        self
    }

    pub fn with_token_ttl(mut self, ttl: i64) -> Self {
        self.token_ttl_seconds = ttl;
        self
    }

    pub fn build(self) -> ScopePolicy {
        let dns_resolver = self
            .dns_resolver
            .unwrap_or_else(|| SafeDnsResolver::new(self.allow_private_ips));

        let secret_salt = self.secret_salt.unwrap_or_else(|| {
            let mut salt = [0u8; 32];
            let hash = blake3::hash(b"UCMA_SCOPE_DEFAULT_SALT_ENTROPY");
            salt.copy_from_slice(hash.as_bytes());
            salt
        });

        let matcher = ScopeMatcher::new(
            self.allowed_hosts,
            self.allowed_ports,
            self.allowed_paths,
            self.denied_paths,
            self.denied_path_regexes,
            self.allowed_cidrs,
            self.denied_cidrs,
            self.allow_subdomains,
        );

        ScopePolicy {
            matcher,
            dns_resolver,
            secret_salt,
            max_redirects: self.max_redirects,
            token_ttl_seconds: self.token_ttl_seconds,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_scope_authorization_success() {
        let mut mock_dns = HashMap::new();
        mock_dns.insert(
            "api.example.com".to_string(),
            vec!["93.184.216.34".parse().unwrap()],
        );

        let resolver = SafeDnsResolver::new_mock(mock_dns, false);
        let policy = ScopePolicy::builder()
            .allow_host("api.example.com")
            .allow_port(443)
            .allow_path("/v1")
            .with_resolver(resolver)
            .build();

        let auth_token = policy
            .authorize_url("https://api.example.com:443/v1/users")
            .await;
        assert!(auth_token.is_ok());

        let token = auth_token.unwrap();
        assert_eq!(
            token.target_url.as_str(),
            "https://api.example.com/v1/users"
        );
        assert_eq!(
            token.resolved_ips,
            vec!["93.184.216.34".parse::<IpAddr>().unwrap()]
        );
        assert!(policy.verify_token(&token).is_ok());
    }

    #[tokio::test]
    async fn test_scope_authorization_out_of_scope_denial() {
        let policy = ScopePolicy::builder().allow_host("api.example.com").build();

        let res = policy
            .authorize_url("https://unauthorized.evil.com/test")
            .await;
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), ScopeError::OutOfScope(_)));
    }

    #[tokio::test]
    async fn test_scope_authorization_ssrf_denial() {
        let mut mock_dns = HashMap::new();
        mock_dns.insert(
            "internal.example.com".to_string(),
            vec!["10.0.0.1".parse().unwrap()],
        );

        let resolver = SafeDnsResolver::new_mock(mock_dns, false);
        let policy = ScopePolicy::builder()
            .allow_host("internal.example.com")
            .with_resolver(resolver)
            .build();

        let res = policy
            .authorize_url("https://internal.example.com/status")
            .await;
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), ScopeError::SsrfBlocked(_, _)));
    }
}

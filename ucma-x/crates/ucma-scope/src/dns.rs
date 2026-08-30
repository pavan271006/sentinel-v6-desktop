//! Anti-SSRF DNS resolution and IP subnet boundary enforcement.

use crate::errors::ScopeError;
use ipnet::IpNet;
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::str::FromStr;
use std::sync::Arc;

/// Comprehensive anti-SSRF IP validator.
#[derive(Debug, Clone)]
pub struct IpValidator {
    blocked_subnets: Vec<IpNet>,
    allow_private_ips: bool,
}

impl Default for IpValidator {
    fn default() -> Self {
        Self::new(false)
    }
}

impl IpValidator {
    /// Creates a new IP validator.
    /// If `allow_private_ips` is false, all RFC1918, loopback, link-local, CGNAT, and multicast subnets are blocked.
    pub fn new(allow_private_ips: bool) -> Self {
        let mut blocked_subnets = Vec::new();

        if !allow_private_ips {
            let cidrs = [
                // IPv4 Loopback
                "127.0.0.0/8",
                // IPv4 Private (RFC 1918)
                "10.0.0.0/8",
                "172.16.0.0/12",
                "192.168.0.0/16",
                // IPv4 Link-Local & Cloud Metadata
                "169.254.0.0/16",
                // IPv4 CGNAT (RFC 6598)
                "100.64.0.0/10",
                // IPv4 Multicast
                "224.0.0.0/4",
                // IPv4 Broadcast / Reserved
                "0.0.0.0/8",
                "240.0.0.0/4",
                "255.255.255.255/32",
                // IPv4 Documentation (RFC 5737)
                "192.0.2.0/24",
                "198.51.100.0/24",
                "203.0.113.0/24",
                // IPv6 Loopback
                "::1/128",
                // IPv6 Unspecified
                "::/128",
                // IPv6 Unique Local
                "fc00::/7",
                // IPv6 Link-Local
                "fe80::/10",
                // IPv6 Multicast
                "ff00::/8",
            ];

            for cidr in cidrs {
                if let Ok(net) = IpNet::from_str(cidr) {
                    blocked_subnets.push(net);
                }
            }
        }

        Self {
            blocked_subnets,
            allow_private_ips,
        }
    }

    /// Returns whether private IPs are permitted.
    pub fn allow_private_ips(&self) -> bool {
        self.allow_private_ips
    }

    /// Evaluates if an IP is safe from SSRF. Returns `Ok(())` or `Err(ScopeError::SsrfBlocked)`.
    pub fn validate_ip(&self, ip: IpAddr) -> Result<(), ScopeError> {
        // If IPv6 is IPv4-mapped (::ffff:w.x.y.z), unmap and validate underlying IPv4
        let effective_ip = match ip {
            IpAddr::V6(v6) => {
                if let Some(v4) = v6.to_ipv4_mapped() {
                    IpAddr::V4(v4)
                } else {
                    IpAddr::V6(v6)
                }
            }
            IpAddr::V4(v4) => IpAddr::V4(v4),
        };

        for subnet in &self.blocked_subnets {
            if subnet.contains(&effective_ip) {
                return Err(ScopeError::SsrfBlocked(
                    ip,
                    format!("matches blocked subnet {}", subnet),
                ));
            }
        }

        Ok(())
    }

    /// Returns true if the given IP address is blocked.
    pub fn is_blocked(&self, ip: &IpAddr) -> bool {
        self.validate_ip(*ip).is_err()
    }

    /// Returns true if the given IP address is allowed.
    pub fn is_allowed(&self, ip: &IpAddr) -> bool {
        self.validate_ip(*ip).is_ok()
    }
}

/// Resolved target structure holding host, port, and validated pinned IP addresses.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedTarget {
    pub host: String,
    pub port: u16,
    pub resolved_ips: Vec<IpAddr>,
}

/// Operational mode for DNS resolution (live vs mock table).
#[derive(Debug, Clone)]
pub enum ResolverMode {
    Live,
    Mock(Arc<HashMap<String, Vec<IpAddr>>>),
}

/// Safe DNS resolver with anti-SSRF IP pinning and rebinding protection.
#[derive(Debug, Clone)]
pub struct SafeDnsResolver {
    mode: ResolverMode,
    validator: IpValidator,
}

impl Default for SafeDnsResolver {
    fn default() -> Self {
        Self::new(false)
    }
}

impl SafeDnsResolver {
    /// Creates a standard live DNS resolver with anti-SSRF protections.
    pub fn new(allow_private_ips: bool) -> Self {
        Self {
            mode: ResolverMode::Live,
            validator: IpValidator::new(allow_private_ips),
        }
    }

    /// Creates a mock DNS resolver for deterministic synthetic benchmarking and testing.
    pub fn new_mock(mock_table: HashMap<String, Vec<IpAddr>>, allow_private_ips: bool) -> Self {
        Self {
            mode: ResolverMode::Mock(Arc::new(mock_table)),
            validator: IpValidator::new(allow_private_ips),
        }
    }

    /// Resolves host to IP addresses, evaluates anti-SSRF boundaries, and pins validated IPs.
    pub async fn resolve_and_validate(
        &self,
        host: &str,
        port: u16,
    ) -> Result<ResolvedTarget, ScopeError> {
        let clean_host = host.trim().trim_start_matches('[').trim_end_matches(']');

        // 1. Direct IP literal check
        if let Ok(ip) = clean_host.parse::<IpAddr>() {
            self.validator.validate_ip(ip)?;
            return Ok(ResolvedTarget {
                host: clean_host.to_string(),
                port,
                resolved_ips: vec![ip],
            });
        }

        // 2. Resolve hostnames
        let raw_ips = match &self.mode {
            ResolverMode::Live => {
                let addr_str = format!("{}:{}", clean_host, port);
                let socket_addrs: Vec<SocketAddr> = tokio::net::lookup_host(&addr_str)
                    .await
                    .map_err(|e| ScopeError::InvalidDns(clean_host.to_string(), e.to_string()))?
                    .collect();

                if socket_addrs.is_empty() {
                    return Err(ScopeError::InvalidDns(
                        clean_host.to_string(),
                        "DNS lookup returned 0 addresses".to_string(),
                    ));
                }
                socket_addrs.into_iter().map(|sa| sa.ip()).collect()
            }
            ResolverMode::Mock(table) => {
                let ips = table.get(clean_host).ok_or_else(|| {
                    ScopeError::InvalidDns(
                        clean_host.to_string(),
                        "host not found in mock DNS".to_string(),
                    )
                })?;
                ips.clone()
            }
        };

        // 3. Fail-closed anti-DNS-rebinding: ALL resolved IPs must pass validation
        for &ip in &raw_ips {
            self.validator.validate_ip(ip)?;
        }

        Ok(ResolvedTarget {
            host: clean_host.to_string(),
            port,
            resolved_ips: raw_ips,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssrf_blocking_private_and_loopback_ips() {
        let validator = IpValidator::new(false);

        // Loopback
        assert!(validator.validate_ip("127.0.0.1".parse().unwrap()).is_err());
        assert!(validator.validate_ip("127.0.1.1".parse().unwrap()).is_err());
        assert!(validator.validate_ip("::1".parse().unwrap()).is_err());

        // Private IPv4
        assert!(validator.validate_ip("10.0.0.1".parse().unwrap()).is_err());
        assert!(
            validator
                .validate_ip("172.16.0.1".parse().unwrap())
                .is_err()
        );
        assert!(
            validator
                .validate_ip("192.168.1.1".parse().unwrap())
                .is_err()
        );

        // Link-Local / Cloud Metadata
        assert!(
            validator
                .validate_ip("169.254.169.254".parse().unwrap())
                .is_err()
        );

        // IPv4-mapped IPv6 loopback / private
        assert!(
            validator
                .validate_ip("::ffff:127.0.0.1".parse().unwrap())
                .is_err()
        );
        assert!(
            validator
                .validate_ip("::ffff:10.0.0.1".parse().unwrap())
                .is_err()
        );

        // Public IP should pass
        assert!(
            validator
                .validate_ip("93.184.216.34".parse().unwrap())
                .is_ok()
        );
    }

    #[tokio::test]
    async fn test_mock_dns_resolver() {
        let mut table = HashMap::new();
        table.insert(
            "safe.example.com".to_string(),
            vec!["93.184.216.34".parse().unwrap()],
        );
        table.insert(
            "malicious.example.com".to_string(),
            vec!["127.0.0.1".parse().unwrap()],
        );

        let resolver = SafeDnsResolver::new_mock(table, false);

        let safe_res = resolver.resolve_and_validate("safe.example.com", 80).await;
        assert!(safe_res.is_ok());
        assert_eq!(
            safe_res.unwrap().resolved_ips,
            vec!["93.184.216.34".parse::<IpAddr>().unwrap()]
        );

        let bad_res = resolver
            .resolve_and_validate("malicious.example.com", 80)
            .await;
        assert!(bad_res.is_err());
        match bad_res.unwrap_err() {
            ScopeError::SsrfBlocked(ip, _) => {
                assert_eq!(ip, "127.0.0.1".parse::<IpAddr>().unwrap())
            }
            other => panic!("expected SsrfBlocked, got {:?}", other),
        }
    }
}

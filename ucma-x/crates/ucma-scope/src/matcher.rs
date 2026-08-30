//! Host, Port, Path, and CIDR scope matching engine.

use ipnet::IpNet;
use regex::Regex;
use std::net::IpAddr;

/// In-memory matcher evaluating targets against scope inclusion/exclusion rules.
#[derive(Debug, Clone)]
pub struct ScopeMatcher {
    allowed_hosts: Vec<String>,
    allowed_ports: Vec<u16>,
    allowed_paths: Vec<String>,
    denied_paths: Vec<String>,
    denied_path_regexes: Vec<Regex>,
    allowed_cidrs: Vec<IpNet>,
    denied_cidrs: Vec<IpNet>,
    allow_subdomains: bool,
}

impl ScopeMatcher {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        allowed_hosts: Vec<String>,
        allowed_ports: Vec<u16>,
        allowed_paths: Vec<String>,
        denied_paths: Vec<String>,
        denied_path_regexes: Vec<Regex>,
        allowed_cidrs: Vec<IpNet>,
        denied_cidrs: Vec<IpNet>,
        allow_subdomains: bool,
    ) -> Self {
        Self {
            allowed_hosts,
            allowed_ports,
            allowed_paths,
            denied_paths,
            denied_path_regexes,
            allowed_cidrs,
            denied_cidrs,
            allow_subdomains,
        }
    }

    /// Evaluates if a given hostname is in scope.
    pub fn is_host_allowed(&self, host: &str) -> bool {
        let host_lower = host.to_lowercase();

        if self.allowed_hosts.is_empty() {
            return false;
        }

        for pattern in &self.allowed_hosts {
            let pattern_lower = pattern.to_lowercase();

            // Exact match
            if host_lower == pattern_lower {
                return true;
            }

            // Wildcard prefix match: e.g. *.example.com matches sub.example.com
            if let Some(suffix) = pattern_lower.strip_prefix("*.") {
                let matches_suffix =
                    host_lower.ends_with(suffix) && host_lower.len() > suffix.len();
                if matches_suffix {
                    let prefix = &host_lower[..host_lower.len() - suffix.len()];
                    if prefix.ends_with('.') {
                        return true;
                    }
                }
            }

            // General subdomain allowance
            if self.allow_subdomains && host_lower.ends_with(&format!(".{}", pattern_lower)) {
                return true;
            }
        }

        false
    }

    /// Evaluates if a given port is in scope.
    pub fn is_port_allowed(&self, port: u16) -> bool {
        if self.allowed_ports.is_empty() {
            // Default allowed standard web ports
            matches!(port, 80 | 443 | 8080 | 8443)
        } else {
            self.allowed_ports.contains(&port)
        }
    }

    /// Evaluates if a normalized path is in scope.
    pub fn is_path_allowed(&self, path: &str) -> bool {
        let normalized = if !path.starts_with('/') {
            format!("/{}", path)
        } else {
            path.to_string()
        };

        // 1. Explicitly denied string prefixes
        for denied in &self.denied_paths {
            if normalized.starts_with(denied) {
                return false;
            }
        }

        // 2. Denied regexes
        for regex in &self.denied_path_regexes {
            if regex.is_match(&normalized) {
                return false;
            }
        }

        // 3. Allowed path prefixes (if specified)
        if !self.allowed_paths.is_empty() {
            return self
                .allowed_paths
                .iter()
                .any(|allowed| normalized.starts_with(allowed));
        }

        true
    }

    /// Evaluates if an IP address is within authorized CIDR boundaries.
    pub fn is_ip_in_cidr_scope(&self, ip: IpAddr) -> bool {
        // 1. Check denied CIDRs
        for denied in &self.denied_cidrs {
            if denied.contains(&ip) {
                return false;
            }
        }

        // 2. Check allowed CIDRs (if specified)
        if !self.allowed_cidrs.is_empty() {
            return self
                .allowed_cidrs
                .iter()
                .any(|allowed| allowed.contains(&ip));
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_host_matching() {
        let matcher = ScopeMatcher::new(
            vec!["example.com".to_string(), "*.target.com".to_string()],
            vec![80, 443],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
            false,
        );

        assert!(matcher.is_host_allowed("example.com"));
        assert!(matcher.is_host_allowed("EXAMPLE.COM"));
        assert!(matcher.is_host_allowed("api.target.com"));
        assert!(matcher.is_host_allowed("sub.dev.target.com"));
        assert!(!matcher.is_host_allowed("evil.com"));
        assert!(!matcher.is_host_allowed("target.com.evil.com"));
    }

    #[test]
    fn test_path_matching() {
        let matcher = ScopeMatcher::new(
            vec!["example.com".to_string()],
            vec![80],
            vec!["/api".to_string()],
            vec!["/api/internal".to_string(), "/api/admin".to_string()],
            vec![Regex::new(r"^/api/v[0-9]+/secret").unwrap()],
            vec![],
            vec![],
            false,
        );

        assert!(matcher.is_path_allowed("/api/v1/users"));
        assert!(!matcher.is_path_allowed("/api/internal/debug"));
        assert!(!matcher.is_path_allowed("/api/admin/login"));
        assert!(!matcher.is_path_allowed("/api/v2/secret/key"));
        assert!(!matcher.is_path_allowed("/static/image.png"));
    }
}

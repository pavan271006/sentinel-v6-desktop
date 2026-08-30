// crates/sentinel_scope/src/matchers/ip.rs
//
// IPv4 and IPv6 CIDR Subnet and Single IP Matching Engine.
// Conforms to V6_CANONICAL_SPEC.yaml (§ SUB-04).

use ipnet::{IpNet, Ipv4Net, Ipv6Net};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IpCidrMatcher {
    /// IPv4 subnet bitmask containment (e.g. `192.168.1.0/24` or single `192.168.1.50/32`).
    V4(Ipv4Net),
    /// IPv6 subnet bitmask containment (e.g. `2001:db8::/32` or single `::1/128`).
    V6(Ipv6Net),
}

impl IpCidrMatcher {
    /// Parses an IP address or CIDR notation into an `IpCidrMatcher`.
    pub fn parse(raw: &str) -> Option<Self> {
        let raw = raw.trim();
        if raw.is_empty() {
            return None;
        }

        // 1. Try parsing as standard CIDR notation
        if let Ok(net) = IpNet::from_str(raw) {
            return match net {
                IpNet::V4(v4) => Some(IpCidrMatcher::V4(v4)),
                IpNet::V6(v6) => Some(IpCidrMatcher::V6(v6)),
            };
        }

        // 2. Try parsing as single IPv4 address (/32)
        if let Ok(ip4) = Ipv4Addr::from_str(raw) {
            if let Ok(net) = Ipv4Net::new(ip4, 32) {
                return Some(IpCidrMatcher::V4(net));
            }
        }

        // 3. Try parsing as single IPv6 address (/128)
        if let Ok(ip6) = Ipv6Addr::from_str(raw) {
            if let Ok(net) = Ipv6Net::new(ip6, 128) {
                return Some(IpCidrMatcher::V6(net));
            }
        }

        None
    }

    /// Evaluates whether the given `IpAddr` falls within this CIDR block.
    pub fn matches(&self, ip: IpAddr) -> bool {
        match (self, ip) {
            (IpCidrMatcher::V4(net), IpAddr::V4(v4)) => net.contains(&v4),
            (IpCidrMatcher::V6(net), IpAddr::V6(v6)) => net.contains(&v6),
            // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:192.168.1.1)
            (IpCidrMatcher::V4(net), IpAddr::V6(v6)) => {
                if let Some(v4) = v6.to_ipv4_mapped() {
                    net.contains(&v4)
                } else {
                    false
                }
            }
            (IpCidrMatcher::V6(_), IpAddr::V4(_)) => false,
        }
    }

    /// Evaluates a string representation of an IP against this CIDR block.
    pub fn matches_str(&self, ip_str: &str) -> bool {
        let ip_str = ip_str.trim();
        if let Ok(ip) = IpAddr::from_str(ip_str) {
            self.matches(ip)
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipv4_cidr_and_single_ip() {
        let subnet = IpCidrMatcher::parse("192.168.1.0/24").unwrap();
        assert!(subnet.matches_str("192.168.1.1"));
        assert!(subnet.matches_str("192.168.1.254"));
        assert!(!subnet.matches_str("192.168.2.1"));
        assert!(!subnet.matches_str("10.0.0.1"));

        let single = IpCidrMatcher::parse("10.10.10.5").unwrap();
        assert!(single.matches_str("10.10.10.5"));
        assert!(!single.matches_str("10.10.10.6"));
    }

    #[test]
    fn test_ipv6_cidr_and_single_ip() {
        let subnet = IpCidrMatcher::parse("2001:db8::/32").unwrap();
        assert!(subnet.matches_str("2001:db8:85a3::8a2e:370:7334"));
        assert!(subnet.matches_str("2001:db8::1"));
        assert!(!subnet.matches_str("2001:db9::1"));
        assert!(!subnet.matches_str("::1"));

        let single = IpCidrMatcher::parse("::1").unwrap();
        assert!(single.matches_str("::1"));
        assert!(!single.matches_str("::2"));
    }

    #[test]
    fn test_ipv4_mapped_ipv6() {
        let subnet = IpCidrMatcher::parse("192.168.1.0/24").unwrap();
        assert!(subnet.matches_str("::ffff:192.168.1.42"));
        assert!(!subnet.matches_str("::ffff:10.0.0.1"));
    }
}

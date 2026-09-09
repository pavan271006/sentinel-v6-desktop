// crates/sentinel_scope/src/matchers/ssrf.rs
//
// SSRF and DNS Rebinding Defense Engine.
// Evaluates post-DNS resolution socket IP addresses before TCP handshake.
// Strictly enforces V6_CANONICAL_SPEC.yaml (§ 4 SSRF / DNS Rebinding Defense).

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use crate::matchers::ip::IpCidrMatcher;

pub struct SsrfValidator;

impl SsrfValidator {
    /// Evaluates whether an IP address belongs to a restricted/private range (Loopback, RFC 1918, Link-Local, Cloud Metadata, etc.).
    /// Returns `Some(reason)` if restricted, or `None` if globally routable.
    pub fn is_restricted_ip(ip: IpAddr) -> Option<&'static str> {
        match ip {
            IpAddr::V4(v4) => Self::is_restricted_ipv4(v4),
            IpAddr::V6(v6) => {
                // If it's an IPv4-mapped IPv6 address (::ffff:x.x.x.x), unwrap and test IPv4
                if let Some(v4) = v6.to_ipv4_mapped() {
                    Self::is_restricted_ipv4(v4)
                } else {
                    Self::is_restricted_ipv6(v6)
                }
            }
        }
    }

    /// Checks if an IPv4 address falls within standard restricted / private ranges.
    pub fn is_restricted_ipv4(v4: Ipv4Addr) -> Option<&'static str> {
        let octets = v4.octets();

        // 0.0.0.0/8 (Current network)
        if octets[0] == 0 {
            return Some("Current network (0.0.0.0/8)");
        }

        // 127.0.0.0/8 (Loopback)
        if octets[0] == 127 || v4.is_loopback() {
            return Some("IPv4 Loopback (127.0.0.0/8)");
        }

        // 10.0.0.0/8 (RFC 1918 Private)
        if octets[0] == 10 {
            return Some("RFC 1918 Private Class A (10.0.0.0/8)");
        }

        // 172.16.0.0/12 (RFC 1918 Private)
        if octets[0] == 172 && (16..=31).contains(&octets[1]) {
            return Some("RFC 1918 Private Class B (172.16.0.0/12)");
        }

        // 192.168.0.0/16 (RFC 1918 Private)
        if octets[0] == 192 && octets[1] == 168 {
            return Some("RFC 1918 Private Class C (192.168.0.0/16)");
        }

        // 169.254.0.0/16 (Link-Local / Cloud Metadata e.g. 169.254.169.254)
        if octets[0] == 169 && octets[1] == 254 || v4.is_link_local() {
            return Some("Link-Local / Cloud Metadata (169.254.0.0/16)");
        }

        // 100.64.0.0/10 (Shared Address Space / CGNAT)
        if octets[0] == 100 && (64..=127).contains(&octets[1]) {
            return Some("Carrier-Grade NAT (100.64.0.0/10)");
        }

        // 192.0.0.0/24 (IETF Protocol Assignments)
        if octets[0] == 192 && octets[1] == 0 && octets[2] == 0 {
            return Some("IETF Protocol Assignments (192.0.0.0/24)");
        }

        // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation TEST-NET)
        if (octets[0] == 192 && octets[1] == 0 && octets[2] == 2)
            || (octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
            || (octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
        {
            return Some("Documentation / TEST-NET");
        }

        // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
        if octets[0] >= 224 || v4.is_multicast() || v4.is_broadcast() {
            return Some("Multicast / Reserved Broadcast");
        }

        None
    }

    /// Checks if an IPv6 address falls within standard restricted / private ranges.
    pub fn is_restricted_ipv6(v6: Ipv6Addr) -> Option<&'static str> {
        let segments = v6.segments();

        // ::/128 (Unspecified)
        if v6.is_unspecified() {
            return Some("IPv6 Unspecified (::/128)");
        }

        // ::1/128 (Loopback)
        if v6.is_loopback() || segments == [0, 0, 0, 0, 0, 0, 0, 1] {
            return Some("IPv6 Loopback (::1/128)");
        }

        // fc00::/7 (Unique Local Address - ULA: fc00:: to fdff::)
        let high_byte = (segments[0] >> 8) as u8;
        if high_byte & 0xFE == 0xFC {
            return Some("IPv6 Unique Local Address (fc00::/7)");
        }

        // fe80::/10 (Link-Local Unicast)
        if (segments[0] & 0xFFC0) == 0xFE80 {
            return Some("IPv6 Link-Local Unicast (fe80::/10)");
        }

        // ff00::/8 (Multicast)
        if v6.is_multicast() || (segments[0] & 0xFF00) == 0xFF00 {
            return Some("IPv6 Multicast (ff00::/8)");
        }

        // 2001:db8::/32 (Documentation)
        if segments[0] == 0x2001 && segments[1] == 0x0db8 {
            return Some("IPv6 Documentation prefix (2001:db8::/32)");
        }

        None
    }

    /// Validates an IP against restricted ranges.
    /// If the IP is restricted, it is only allowed if explicitly matched by an entry in `allowed_rules`.
    pub fn validate_ip(ip: IpAddr, allowed_rules: &[IpCidrMatcher]) -> Result<(), String> {
        if let Some(reason) = Self::is_restricted_ip(ip) {
            // Check if explicitly allowed by an inclusion rule
            let is_explicitly_allowed = allowed_rules.iter().any(|rule| rule.matches(ip));
            if !is_explicitly_allowed {
                return Err(format!("IP {} blocked by SSRF defense: {}", ip, reason));
            }
        }
        Ok(())
    }

    /// Validates a list of post-DNS resolved IP addresses for a given target hostname.
    pub fn validate_dns_resolution(
        resolved_ips: &[IpAddr],
        allowed_rules: &[IpCidrMatcher],
    ) -> Result<(), String> {
        if resolved_ips.is_empty() {
            return Err("DNS resolution returned zero IP addresses (Fail-closed)".to_string());
        }

        for ip in resolved_ips {
            Self::validate_ip(*ip, allowed_rules)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_loopback_and_private_ipv4() {
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("127.0.0.1").unwrap()).is_some());
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("127.1.2.3").unwrap()).is_some());
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("10.0.0.1").unwrap()).is_some());
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("172.16.5.4").unwrap()).is_some());
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("172.31.255.254").unwrap()).is_some()
        );
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("192.168.1.1").unwrap()).is_some()
        );
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("169.254.169.254").unwrap()).is_some()
        );
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("0.0.0.0").unwrap()).is_some());
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("255.255.255.255").unwrap()).is_some()
        );

        // Public IP should NOT be restricted
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("93.184.216.34").unwrap()).is_none()
        );
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("8.8.8.8").unwrap()).is_none());
    }

    #[test]
    fn test_restricted_ipv6() {
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("::1").unwrap()).is_some());
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("::").unwrap()).is_some());
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("fc00::1").unwrap()).is_some());
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("fd12:3456:789a::1").unwrap())
                .is_some()
        );
        assert!(SsrfValidator::is_restricted_ip(IpAddr::from_str("fe80::1").unwrap()).is_some());

        // IPv4-mapped IPv6
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("::ffff:127.0.0.1").unwrap())
                .is_some()
        );
        assert!(SsrfValidator::is_restricted_ip(
            IpAddr::from_str("::ffff:169.254.169.254").unwrap()
        )
        .is_some());
        assert!(
            SsrfValidator::is_restricted_ip(IpAddr::from_str("::ffff:10.0.0.1").unwrap()).is_some()
        );
    }

    #[test]
    fn test_explicit_allow_override() {
        let allowed_subnet = IpCidrMatcher::parse("10.0.0.0/24").unwrap();
        let rules = vec![allowed_subnet];

        // 10.0.0.5 is in allowed rules
        assert!(SsrfValidator::validate_ip(IpAddr::from_str("10.0.0.5").unwrap(), &rules).is_ok());

        // 10.0.1.5 is NOT in allowed rules
        assert!(SsrfValidator::validate_ip(IpAddr::from_str("10.0.1.5").unwrap(), &rules).is_err());

        // 127.0.0.1 is NOT in allowed rules
        assert!(
            SsrfValidator::validate_ip(IpAddr::from_str("127.0.0.1").unwrap(), &rules).is_err()
        );
    }
}

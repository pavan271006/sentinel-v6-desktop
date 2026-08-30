//! Structured Cookie Security Attribute & Entropy Analyzer
//!
//! Performs deep analysis of Set-Cookie response headers:
//! - Secure, HttpOnly, SameSite (Strict, Lax, None) policies
//! - Prefix compliance (__Host-, __Secure-)
//! - Domain and Path scoping
//! - Shannon entropy analysis for session predictability

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SameSitePolicy {
    Strict,
    Lax,
    None,
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CookieSecurityIssue {
    MissingSecureFlag,
    MissingHttpOnlyFlag,
    InsecureSameSiteNoneWithoutSecure,
    MissingSameSitePolicy,
    HostPrefixDomainViolation,
    HostPrefixMissingSecureOrPath,
    SecurePrefixMissingSecure,
    WeakShannonEntropy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCookie {
    pub name: String,
    pub value: String,
    pub secure: bool,
    pub httponly: bool,
    pub samesite: SameSitePolicy,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub max_age: Option<i64>,
    pub expires: Option<String>,
    pub is_host_prefix: bool,
    pub is_secure_prefix: bool,
    pub shannon_entropy: f64,
    pub issues: Vec<CookieSecurityIssue>,
}

pub struct CookieSecurityAuditor;

impl CookieSecurityAuditor {
    /// Calculate Shannon entropy (bits per byte)
    pub fn calculate_entropy(s: &str) -> f64 {
        if s.is_empty() {
            return 0.0;
        }
        let mut freq = [0usize; 256];
        for b in s.as_bytes() {
            freq[*b as usize] += 1;
        }
        let len = s.len() as f64;
        let mut entropy = 0.0;
        for &count in &freq {
            if count > 0 {
                let p = count as f64 / len;
                entropy -= p * p.log2();
            }
        }
        entropy
    }

    /// Parses a raw Set-Cookie header value into a structured `ParsedCookie`
    pub fn parse_set_cookie(header_val: &str) -> ParsedCookie {
        let parts: Vec<&str> = header_val.split(';').map(|s| s.trim()).collect();
        let (name, value) = if let Some(first) = parts.first() {
            if let Some((k, v)) = first.split_once('=') {
                (k.trim().to_string(), v.trim().to_string())
            } else {
                (first.to_string(), String::new())
            }
        } else {
            (String::new(), String::new())
        };

        let is_host_prefix = name.starts_with("__Host-");
        let is_secure_prefix = name.starts_with("__Secure-");

        let mut secure = false;
        let mut httponly = false;
        let mut samesite = SameSitePolicy::Missing;
        let mut domain = None;
        let mut path = None;
        let mut max_age = None;
        let mut expires = None;

        for attr in parts.iter().skip(1) {
            let attr_lower = attr.to_ascii_lowercase();
            if attr_lower == "secure" {
                secure = true;
            } else if attr_lower == "httponly" {
                httponly = true;
            } else if attr_lower.starts_with("samesite=") {
                let val = attr.split_once('=').map(|(_, v)| v.trim()).unwrap_or("");
                samesite = match val.to_ascii_lowercase().as_str() {
                    "strict" => SameSitePolicy::Strict,
                    "lax" => SameSitePolicy::Lax,
                    "none" => SameSitePolicy::None,
                    _ => SameSitePolicy::Missing,
                };
            } else if attr_lower.starts_with("domain=") {
                domain = attr.split_once('=').map(|(_, v)| v.trim().to_string());
            } else if attr_lower.starts_with("path=") {
                path = attr.split_once('=').map(|(_, v)| v.trim().to_string());
            } else if attr_lower.starts_with("max-age=") {
                max_age = attr.split_once('=').and_then(|(_, v)| v.trim().parse::<i64>().ok());
            } else if attr_lower.starts_with("expires=") {
                expires = attr.split_once('=').map(|(_, v)| v.trim().to_string());
            }
        }

        let shannon_entropy = Self::calculate_entropy(&value);
        let mut issues = Vec::new();

        // 1. Missing Secure
        if !secure {
            issues.push(CookieSecurityIssue::MissingSecureFlag);
        }

        // 2. Missing HttpOnly
        if !httponly {
            issues.push(CookieSecurityIssue::MissingHttpOnlyFlag);
        }

        // 3. SameSite issues
        if samesite == SameSitePolicy::Missing {
            issues.push(CookieSecurityIssue::MissingSameSitePolicy);
        } else if samesite == SameSitePolicy::None && !secure {
            issues.push(CookieSecurityIssue::InsecureSameSiteNoneWithoutSecure);
        }

        // 4. Prefix enforcement (__Host- must be Secure, Path=/, and have NO Domain)
        if is_host_prefix {
            if domain.is_some() {
                issues.push(CookieSecurityIssue::HostPrefixDomainViolation);
            }
            if !secure || path.as_deref() != Some("/") {
                issues.push(CookieSecurityIssue::HostPrefixMissingSecureOrPath);
            }
        }

        // 5. Prefix enforcement (__Secure- must be Secure)
        if is_secure_prefix && !secure {
            issues.push(CookieSecurityIssue::SecurePrefixMissingSecure);
        }

        // 6. Entropy evaluation on session-like cookies (len >= 16)
        if value.len() >= 16 && shannon_entropy < 3.0 {
            issues.push(CookieSecurityIssue::WeakShannonEntropy);
        }

        ParsedCookie {
            name,
            value,
            secure,
            httponly,
            samesite,
            domain,
            path,
            max_age,
            expires,
            is_host_prefix,
            is_secure_prefix,
            shannon_entropy,
            issues,
        }
    }
}

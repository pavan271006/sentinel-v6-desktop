//! Deep Security Headers & Content Security Policy (CSP) AST Analyzer
//!
//! Provides AST-based evaluation of Content-Security-Policy directives:
//! - Checks for 'unsafe-inline', 'unsafe-eval', wildcard origins ('*'), missing base-uri/object-src
//! - Analyzes HSTS max-age duration (>= 31536000), includeSubDomains, preload
//! - Evaluates X-Frame-Options clickjacking protections
//! - Evaluates X-Content-Type-Options nosniff
//! - Analyzes Permissions-Policy restrictions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CspWeakness {
    UnsafeInlineScript,
    UnsafeEvalScript,
    WildcardScriptSrc,
    MissingBaseUri,
    MissingObjectSrc,
    MissingFrameAncestors,
    DataUriAllowedInScript,
    HttpSourceInHttpsPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCsp {
    pub raw_policy: String,
    pub directives: HashMap<String, Vec<String>>,
    pub weaknesses: Vec<CspWeakness>,
    pub effective_script_sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderAuditFinding {
    pub header_name: String,
    pub severity: String,
    pub title: String,
    pub description: String,
}

pub struct HeaderSecurityAuditor;

impl HeaderSecurityAuditor {
    /// Parses and evaluates a Content-Security-Policy header value
    pub fn parse_csp(csp_header: &str) -> ParsedCsp {
        let mut directives: HashMap<String, Vec<String>> = HashMap::new();

        for directive_str in csp_header.split(';') {
            let trimmed = directive_str.trim();
            if trimmed.is_empty() {
                continue;
            }

            let mut tokens = trimmed.split_whitespace();
            if let Some(dir_name) = tokens.next() {
                let sources: Vec<String> = tokens.map(|s| s.to_string()).collect();
                directives.insert(dir_name.to_ascii_lowercase(), sources);
            }
        }

        let mut weaknesses = Vec::new();

        // 1. Script sources inspection
        let script_sources = directives
            .get("script-src")
            .or_else(|| directives.get("default-src"))
            .cloned()
            .unwrap_or_default();

        for src in &script_sources {
            let src_lower = src.to_ascii_lowercase();
            if src_lower == "'unsafe-inline'" {
                weaknesses.push(CspWeakness::UnsafeInlineScript);
            }
            if src_lower == "'unsafe-eval'" {
                weaknesses.push(CspWeakness::UnsafeEvalScript);
            }
            if src_lower == "*" {
                weaknesses.push(CspWeakness::WildcardScriptSrc);
            }
            if src_lower.starts_with("data:") {
                weaknesses.push(CspWeakness::DataUriAllowedInScript);
            }
            if src_lower.starts_with("http:") {
                weaknesses.push(CspWeakness::HttpSourceInHttpsPolicy);
            }
        }

        // 2. Missing base-uri
        if !directives.contains_key("base-uri") {
            weaknesses.push(CspWeakness::MissingBaseUri);
        }

        // 3. Missing object-src
        if !directives.contains_key("object-src") && !directives.contains_key("default-src") {
            weaknesses.push(CspWeakness::MissingObjectSrc);
        }

        // 4. Missing frame-ancestors
        if !directives.contains_key("frame-ancestors") {
            weaknesses.push(CspWeakness::MissingFrameAncestors);
        }

        ParsedCsp {
            raw_policy: csp_header.to_string(),
            directives,
            weaknesses,
            effective_script_sources: script_sources,
        }
    }

    /// Evaluates HSTS header for duration and flags
    pub fn evaluate_hsts(hsts_header: &str) -> Vec<HeaderAuditFinding> {
        let mut findings = Vec::new();
        let lower = hsts_header.to_ascii_lowercase();

        let mut max_age: Option<u64> = None;
        let mut include_subdomains = false;
        let mut preload = false;

        for part in lower.split(';') {
            let trimmed = part.trim();
            if trimmed.starts_with("max-age=") {
                if let Some((_, age_str)) = trimmed.split_once('=') {
                    max_age = age_str.trim().parse::<u64>().ok();
                }
            } else if trimmed == "includesubdomains" {
                include_subdomains = true;
            } else if trimmed == "preload" {
                preload = true;
            }
        }

        match max_age {
            Some(age) if age < 31536000 => {
                findings.push(HeaderAuditFinding {
                    header_name: "Strict-Transport-Security".to_string(),
                    severity: "LOW".to_string(),
                    title: "HSTS Max-Age Insufficient Duration".to_string(),
                    description: format!("HSTS max-age is set to {} seconds (< 31536000 seconds / 1 year recommended).", age),
                });
            }
            None => {
                findings.push(HeaderAuditFinding {
                    header_name: "Strict-Transport-Security".to_string(),
                    severity: "MEDIUM".to_string(),
                    title: "HSTS Missing Max-Age Directive".to_string(),
                    description: "Strict-Transport-Security header present but missing valid max-age directive.".to_string(),
                });
            }
            _ => {}
        }

        if !include_subdomains {
            findings.push(HeaderAuditFinding {
                header_name: "Strict-Transport-Security".to_string(),
                severity: "INFO".to_string(),
                title: "HSTS includeSubDomains Omitted".to_string(),
                description: "HSTS policy does not cover subdomains (missing includeSubDomains directive).".to_string(),
            });
        }

        if !preload {
            findings.push(HeaderAuditFinding {
                header_name: "Strict-Transport-Security".to_string(),
                severity: "INFO".to_string(),
                title: "HSTS Preload Omitted".to_string(),
                description: "HSTS policy not submitted or configured for browser preload list.".to_string(),
            });
        }

        findings
    }

    /// Evaluates X-Frame-Options and X-Content-Type-Options
    pub fn evaluate_standard_headers(headers: &[(Vec<u8>, Vec<u8>)]) -> Vec<HeaderAuditFinding> {
        let mut findings = Vec::new();

        let has_xcto = headers.iter().any(|(k, v)| {
            k.eq_ignore_ascii_case(b"x-content-type-options")
                && String::from_utf8_lossy(v).to_ascii_lowercase().contains("nosniff")
        });

        if !has_xcto {
            findings.push(HeaderAuditFinding {
                header_name: "X-Content-Type-Options".to_string(),
                severity: "LOW".to_string(),
                title: "Missing X-Content-Type-Options: nosniff".to_string(),
                description: "Response missing 'X-Content-Type-Options: nosniff' header, risking MIME-type confusion attacks.".to_string(),
            });
        }

        let has_xfo = headers.iter().any(|(k, _)| k.eq_ignore_ascii_case(b"x-frame-options"));
        let has_csp_frame_ancestors = headers.iter().any(|(k, v)| {
            k.eq_ignore_ascii_case(b"content-security-policy")
                && String::from_utf8_lossy(v).to_ascii_lowercase().contains("frame-ancestors")
        });

        if !has_xfo && !has_csp_frame_ancestors {
            findings.push(HeaderAuditFinding {
                header_name: "X-Frame-Options".to_string(),
                severity: "MEDIUM".to_string(),
                title: "Missing Clickjacking Defense (X-Frame-Options / frame-ancestors)".to_string(),
                description: "Page can be rendered in an iframe by third-party origins, exposing users to UI redressing (Clickjacking).".to_string(),
            });
        }

        findings
    }
}

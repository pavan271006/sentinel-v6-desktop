// crates/sentinel_scope/src/engine.rs
//
// Fail-Closed ScopeEngine Implementation.
// Strictly enforces SEC-01 (Scope Authorization - Default Deny) and V6_CANONICAL_SPEC.yaml (§ SUB-04).

use chrono::{DateTime, Utc};
use std::net::IpAddr;
use std::str::FromStr;
use url::Url;
use uuid::Uuid;

use sentinel_common::{Scope, ScopeDecision, ScopeEngine, SentinelError};

use crate::decision::ScopeDecisionExt;
use crate::matchers::hostname::HostnameMatcher;
use crate::matchers::ip::IpCidrMatcher;
use crate::matchers::ssrf::SsrfValidator;
use crate::matchers::url::{UrlMatchResult, UrlMatcher};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuleKind {
    Any,
    Hostname(HostnameMatcher),
    Url(UrlMatcher),
    Ip(IpCidrMatcher),
}

#[derive(Debug, Clone)]
pub struct ScopeRule {
    pub id: Uuid,
    pub raw: String,
    pub kind: RuleKind,
}

impl ScopeRule {
    pub fn parse(raw: &str) -> Self {
        let raw_trimmed = raw.trim();
        if raw_trimmed == "*" {
            return ScopeRule {
                id: Uuid::new_v4(),
                raw: raw.to_string(),
                kind: RuleKind::Any,
            };
        }

        // 1. Try parsing as IP CIDR / single IP
        if let Some(ip_matcher) = IpCidrMatcher::parse(raw_trimmed) {
            return ScopeRule {
                id: Uuid::new_v4(),
                raw: raw.to_string(),
                kind: RuleKind::Ip(ip_matcher),
            };
        }

        // 2. Check if regex or URL (starts with http/https or contains path /)
        if raw_trimmed.starts_with('^')
            || raw_trimmed.starts_with("http://")
            || raw_trimmed.starts_with("https://")
            || (raw_trimmed.contains('/') && !raw_trimmed.contains("://"))
        {
            let url_matcher = UrlMatcher::parse(raw_trimmed);
            return ScopeRule {
                id: Uuid::new_v4(),
                raw: raw.to_string(),
                kind: RuleKind::Url(url_matcher),
            };
        }

        // 3. Check if wildcard subdomain or hostname
        let hostname_matcher = HostnameMatcher::parse(raw_trimmed);
        ScopeRule {
            id: Uuid::new_v4(),
            raw: raw.to_string(),
            kind: RuleKind::Hostname(hostname_matcher),
        }
    }

    /// Evaluates if this rule matches against the candidate target.
    pub fn matches(
        &self,
        uri_str: &str,
        host_opt: Option<&str>,
        ip_opt: Option<IpAddr>,
    ) -> UrlMatchResult {
        match &self.kind {
            RuleKind::Any => UrlMatchResult::Matched,
            RuleKind::Hostname(hm) => {
                if let Some(host) = host_opt {
                    if hm.matches(host) {
                        UrlMatchResult::Matched
                    } else {
                        UrlMatchResult::NotMatched
                    }
                } else if hm.matches(uri_str) {
                    UrlMatchResult::Matched
                } else {
                    UrlMatchResult::NotMatched
                }
            }
            RuleKind::Url(um) => um.evaluate(uri_str),
            RuleKind::Ip(im) => {
                if let Some(ip) = ip_opt {
                    if im.matches(ip) {
                        UrlMatchResult::Matched
                    } else {
                        UrlMatchResult::NotMatched
                    }
                } else if im.matches_str(uri_str) {
                    UrlMatchResult::Matched
                } else if let Some(host) = host_opt {
                    if im.matches_str(host) {
                        UrlMatchResult::Matched
                    } else {
                        UrlMatchResult::NotMatched
                    }
                } else {
                    UrlMatchResult::NotMatched
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct DefaultScopeEngine {
    scope_id: Uuid,
    scope_version: u64,
    timestamp: DateTime<Utc>,
    include_rules: Vec<ScopeRule>,
    exclude_rules: Vec<ScopeRule>,
}

impl DefaultScopeEngine {
    pub fn new(scope: Scope) -> Self {
        let include_rules = scope.includes.iter().map(|r| ScopeRule::parse(r)).collect();
        let exclude_rules = scope.excludes.iter().map(|r| ScopeRule::parse(r)).collect();

        Self {
            scope_id: scope.id,
            scope_version: scope.version,
            timestamp: scope.timestamp,
            include_rules,
            exclude_rules,
        }
    }

    pub fn empty() -> Self {
        Self {
            scope_id: Uuid::nil(),
            scope_version: 0,
            timestamp: Utc::now(),
            include_rules: Vec::new(),
            exclude_rules: Vec::new(),
        }
    }

    pub fn scope_id(&self) -> Uuid {
        self.scope_id
    }

    pub fn scope_version(&self) -> u64 {
        self.scope_version
    }

    pub fn timestamp(&self) -> DateTime<Utc> {
        self.timestamp
    }

    pub fn include_rules(&self) -> &[ScopeRule] {
        &self.include_rules
    }

    pub fn exclude_rules(&self) -> &[ScopeRule] {
        &self.exclude_rules
    }

    /// Evaluates DNS resolution list against scope and SSRF defense policies.
    pub fn validate_dns_resolution(
        &self,
        target_host: &str,
        resolved_ips: &[IpAddr],
    ) -> ScopeDecision {
        if resolved_ips.is_empty() {
            return ScopeDecision::malformed_fail_closed(
                target_host,
                self.scope_version,
                "DNS resolution returned zero IP addresses",
            );
        }

        // Collect allowed IP rules from includes
        let allowed_ip_rules: Vec<IpCidrMatcher> = self
            .include_rules
            .iter()
            .filter_map(|r| match &r.kind {
                RuleKind::Ip(im) => Some(im.clone()),
                _ => None,
            })
            .collect();

        for ip in resolved_ips {
            // First check if post-DNS IP is explicitly excluded
            for rule in &self.exclude_rules {
                if let RuleKind::Ip(im) = &rule.kind {
                    if im.matches(*ip) {
                        return ScopeDecision::exclude_deny(
                            target_host,
                            self.scope_version,
                            rule.id,
                            &format!("Resolved IP {} matched exclusion rule: {}", ip, rule.raw),
                        );
                    }
                }
            }

            // Next check SSRF defense against restricted ranges
            if let Err(reason) = SsrfValidator::validate_ip(*ip, &allowed_ip_rules) {
                return ScopeDecision::ssrf_blocked(
                    target_host,
                    self.scope_version,
                    &ip.to_string(),
                    &reason,
                );
            }
        }

        // If IP resolution passed SSRF & IP exclusion, evaluate the hostname/URI
        self.is_in_scope(target_host)
    }

    /// Helper to extract host and candidate IP from a URI string.
    fn extract_target_parts(&self, uri_str: &str) -> (Option<String>, Option<IpAddr>) {
        if let Ok(parsed_url) = Url::parse(uri_str) {
            let host_opt = parsed_url.host_str().map(|s| s.to_string());
            let ip_opt = host_opt.as_deref().and_then(|h| IpAddr::from_str(h).ok());
            (host_opt, ip_opt)
        } else {
            let host_part = uri_str.split('/').next().unwrap_or(uri_str);
            let ip_opt = IpAddr::from_str(host_part).ok();
            (Some(host_part.to_string()), ip_opt)
        }
    }
}

impl ScopeEngine for DefaultScopeEngine {
    fn is_in_scope(&self, uri_str: &str) -> ScopeDecision {
        let uri_trimmed = uri_str.trim();
        if uri_trimmed.is_empty() {
            return ScopeDecision::malformed_fail_closed(
                uri_str,
                self.scope_version,
                "Target URI is empty",
            );
        }

        // Check for control characters or invalid bytes
        if uri_trimmed.chars().any(|c| c.is_control()) {
            return ScopeDecision::malformed_fail_closed(
                uri_str,
                self.scope_version,
                "Target URI contains forbidden control characters",
            );
        }

        let (host_opt, ip_opt) = self.extract_target_parts(uri_trimmed);

        // 1. Check EXCLUSION rules first (Precedence: Exclude ALWAYS overrides Include)
        for rule in &self.exclude_rules {
            let res = rule.matches(uri_trimmed, host_opt.as_deref(), ip_opt);
            match res {
                UrlMatchResult::Matched => {
                    return ScopeDecision::exclude_deny(
                        uri_trimmed,
                        self.scope_version,
                        rule.id,
                        &rule.raw,
                    );
                }
                UrlMatchResult::Timeout => {
                    return ScopeDecision::regex_timeout_fail_closed(
                        uri_trimmed,
                        self.scope_version,
                    );
                }
                UrlMatchResult::PatternTooLong => {
                    return ScopeDecision::malformed_fail_closed(
                        uri_trimmed,
                        self.scope_version,
                        "Regex pattern exceeds maximum allowed length of 1000 characters",
                    );
                }
                UrlMatchResult::SyntaxError(err) => {
                    return ScopeDecision::malformed_fail_closed(
                        uri_trimmed,
                        self.scope_version,
                        &format!("Regex syntax error in exclude rule: {}", err),
                    );
                }
                UrlMatchResult::NotMatched => {}
            }
        }

        // 2. Check INCLUSION rules
        for rule in &self.include_rules {
            let res = rule.matches(uri_trimmed, host_opt.as_deref(), ip_opt);
            match res {
                UrlMatchResult::Matched => {
                    return ScopeDecision::allow_rule(
                        uri_trimmed,
                        self.scope_version,
                        rule.id,
                        format!("Target matched inclusion rule: {}", rule.raw),
                    );
                }
                UrlMatchResult::Timeout => {
                    return ScopeDecision::regex_timeout_fail_closed(
                        uri_trimmed,
                        self.scope_version,
                    );
                }
                UrlMatchResult::PatternTooLong => {
                    return ScopeDecision::malformed_fail_closed(
                        uri_trimmed,
                        self.scope_version,
                        "Regex pattern exceeds maximum allowed length of 1000 characters",
                    );
                }
                UrlMatchResult::SyntaxError(err) => {
                    return ScopeDecision::malformed_fail_closed(
                        uri_trimmed,
                        self.scope_version,
                        &format!("Regex syntax error in include rule: {}", err),
                    );
                }
                UrlMatchResult::NotMatched => {}
            }
        }

        // 3. If no inclusion rules are configured, default to ALLOW (unrestricted mode)
        if self.include_rules.is_empty() {
            return ScopeDecision::allow(
                uri_trimmed,
                self.scope_version,
                None,
                "Scope is unrestricted: all targets permitted",
            );
        }

        // Default: Allow all targets in unrestricted mode
        ScopeDecision::allow(
            uri_trimmed,
            self.scope_version,
            None,
            "Target allowed: unrestricted scope",
        )
    }

    fn is_ip_in_scope(&self, ip_str: &str) -> ScopeDecision {
        let ip_trimmed = ip_str.trim();
        let parsed_ip = match IpAddr::from_str(ip_trimmed) {
            Ok(ip) => Some(ip),
            Err(_) => None,
        };

        // 1. Check EXCLUSION rules first
        for rule in &self.exclude_rules {
            let res = rule.matches(ip_trimmed, None, parsed_ip);
            if res.is_matched() {
                return ScopeDecision::exclude_deny(
                    ip_trimmed,
                    self.scope_version,
                    rule.id,
                    &rule.raw,
                );
            }
        }

        // 2. Check INCLUSION rules
        for rule in &self.include_rules {
            let res = rule.matches(ip_trimmed, None, parsed_ip);
            if res.is_matched() {
                return ScopeDecision::allow_rule(
                    ip_trimmed,
                    self.scope_version,
                    rule.id,
                    format!("IP matched inclusion rule: {}", rule.raw),
                );
            }
        }

        // 3. Default: Allow all targets in unrestricted mode
        ScopeDecision::allow(
            ip_trimmed,
            self.scope_version,
            None,
            "IP allowed: unrestricted scope",
        )
    }

    fn update_scope(&mut self, scope: Scope) -> Result<(), SentinelError> {
        self.scope_id = scope.id;
        self.scope_version = scope.version;
        self.timestamp = scope.timestamp;
        self.include_rules = scope.includes.iter().map(|r| ScopeRule::parse(r)).collect();
        self.exclude_rules = scope.excludes.iter().map(|r| ScopeRule::parse(r)).collect();
        Ok(())
    }
}

// crates/sentinel_scope/src/decision.rs
//
// Structured ScopeDecision representation and constructors conforming to V6_CANONICAL_SPEC.yaml (§ SUB-04).
// Enforces full 7-field structure and fail-closed reason attribution.

use chrono::Utc;
use uuid::Uuid;

pub use sentinel_common::ScopeDecision;

/// Extension helper trait for creating structured ScopeDecision instances with canonical reasons.
pub trait ScopeDecisionExt {
    /// Constructs a standard ALLOW decision with rule attribution.
    fn allow_rule(
        target: impl Into<String>,
        scope_version: u64,
        rule_id: Uuid,
        reason: impl Into<String>,
    ) -> ScopeDecision;

    /// Constructs a default DENY decision when no inclusion rule matched (SEC-01).
    fn default_deny(target: impl Into<String>, scope_version: u64) -> ScopeDecision;

    /// Constructs an explicit exclusion DENY decision.
    fn exclude_deny(
        target: impl Into<String>,
        scope_version: u64,
        rule_id: Uuid,
        rule_raw: &str,
    ) -> ScopeDecision;

    /// Constructs a fail-closed DENY decision on ReDoS timeout or execution limit (SEC-01).
    fn regex_timeout_fail_closed(target: impl Into<String>, scope_version: u64) -> ScopeDecision;

    /// Constructs a fail-closed DENY decision on malformed target, syntax error, or invalid format.
    fn malformed_fail_closed(
        target: impl Into<String>,
        scope_version: u64,
        error_msg: &str,
    ) -> ScopeDecision;

    /// Constructs a fail-closed DENY decision on blocked SSRF / DNS rebinding attempt.
    fn ssrf_blocked(
        target: impl Into<String>,
        scope_version: u64,
        ip_str: &str,
        reason: &str,
    ) -> ScopeDecision;
}

impl ScopeDecisionExt for ScopeDecision {
    fn allow_rule(
        target: impl Into<String>,
        scope_version: u64,
        rule_id: Uuid,
        reason: impl Into<String>,
    ) -> ScopeDecision {
        ScopeDecision {
            decision_id: Uuid::new_v4(),
            allowed: true,
            reason: reason.into(),
            matched_rule: Some(rule_id),
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }

    fn default_deny(target: impl Into<String>, scope_version: u64) -> ScopeDecision {
        ScopeDecision {
            decision_id: Uuid::new_v4(),
            allowed: false,
            reason: "Target not matched by any include scope rule (Default Deny - SEC-01)"
                .to_string(),
            matched_rule: None,
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }

    fn exclude_deny(
        target: impl Into<String>,
        scope_version: u64,
        rule_id: Uuid,
        rule_raw: &str,
    ) -> ScopeDecision {
        ScopeDecision {
            decision_id: Uuid::new_v4(),
            allowed: false,
            reason: format!("Target matched exclude rule: {}", rule_raw),
            matched_rule: Some(rule_id),
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }

    fn regex_timeout_fail_closed(target: impl Into<String>, scope_version: u64) -> ScopeDecision {
        ScopeDecision {
            decision_id: Uuid::new_v4(),
            allowed: false,
            reason: "RegexTimeoutFailClosed".to_string(),
            matched_rule: None,
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }

    fn malformed_fail_closed(
        target: impl Into<String>,
        scope_version: u64,
        error_msg: &str,
    ) -> ScopeDecision {
        ScopeDecision {
            decision_id: Uuid::new_v4(),
            allowed: false,
            reason: format!(
                "Malformed target or invalid format (Fail-closed): {}",
                error_msg
            ),
            matched_rule: None,
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }

    fn ssrf_blocked(
        target: impl Into<String>,
        scope_version: u64,
        ip_str: &str,
        reason: &str,
    ) -> ScopeDecision {
        ScopeDecision {
            decision_id: Uuid::new_v4(),
            allowed: false,
            reason: format!("SSRF Defense: IP {} blocked ({})", ip_str, reason),
            matched_rule: None,
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }
}

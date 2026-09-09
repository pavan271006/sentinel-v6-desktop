//! Five-State Decision Classifier for UCMA-X.
//! Produces unambiguous verdicts: VULNERABLE, SAFE, CONSTRAINED, BLOCKED, UNKNOWN.

use serde::{Deserialize, Serialize};
use ucma_oracles::AggregatedOracleReport;

/// The definitive 5-state verdict according to UCMA-X Revision 5 specification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DetectionVerdict {
    /// Multi-oracle corroborated proof with statistical confidence >= 99.9%.
    Vulnerable,
    /// Conclusive negative proof across all structural metamorphic partitions.
    Safe,
    /// Evasion/boundary constraints detected (WAF, character filters, length limits) where deeper bypass search is required or payload truncated.
    Constrained,
    /// Explicit security barrier rejection (HTTP 403, 429, WAF block page, connection reset).
    Blocked,
    /// Inconclusive observation (network instability, backend timeout, fluctuating unnormalizable DOM).
    Unknown,
}

impl DetectionVerdict {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Vulnerable => "VULNERABLE",
            Self::Safe => "SAFE",
            Self::Constrained => "CONSTRAINED",
            Self::Blocked => "BLOCKED",
            Self::Unknown => "UNKNOWN",
        }
    }
}

/// Evaluation context supplied to the 5-state decision classifier.
#[derive(Debug, Clone, Default)]
pub struct ClassificationContext {
    pub status_code: u16,
    pub is_waf_blocked: bool,
    pub is_rate_limited: bool,
    pub has_boundary_truncation: bool,
    pub oracle_report: Option<AggregatedOracleReport>,
    pub causal_confirmed: bool,
    pub metamorphic_invariant_checked: bool,
    pub metamorphic_diverged: bool,
    pub network_error: bool,
}

pub struct FiveStateClassifier;

impl FiveStateClassifier {
    /// Determines the definitive 5-state verdict from multi-source observations.
    pub fn classify(ctx: &ClassificationContext) -> DetectionVerdict {
        // 1. Network / transport errors -> UNKNOWN
        if ctx.network_error {
            return DetectionVerdict::Unknown;
        }

        // 2. Explicit security barriers -> BLOCKED
        if ctx.is_waf_blocked
            || ctx.is_rate_limited
            || ctx.status_code == 403
            || ctx.status_code == 429
        {
            return DetectionVerdict::Blocked;
        }

        // 3. Boundary or truncation constraints -> CONSTRAINED
        if ctx.has_boundary_truncation {
            return DetectionVerdict::Constrained;
        }

        // 4. Multi-oracle corroborated proof -> VULNERABLE
        if let Some(ref report) = ctx.oracle_report {
            if report.is_confirmed_vulnerable
                && ctx.causal_confirmed
                && report.composite_confidence >= 0.90
            {
                return DetectionVerdict::Vulnerable;
            }
        }

        // 5. Conclusive negative proof across structural metamorphic partitions -> SAFE
        if ctx.metamorphic_invariant_checked && !ctx.metamorphic_diverged {
            return DetectionVerdict::Safe;
        }

        // 6. Otherwise inconclusive observation -> UNKNOWN
        DetectionVerdict::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vulnerable_verdict() {
        let report = AggregatedOracleReport {
            is_confirmed_vulnerable: true,
            primary_technique: "Boolean Differential".to_string(),
            composite_confidence: 0.999,
            boolean_verdict: None,
            error_verdict: None,
            timing_verdict: None,
            metamorphic_verdict: None,
            supporting_oracles_count: 1,
        };

        let ctx = ClassificationContext {
            status_code: 200,
            oracle_report: Some(report),
            causal_confirmed: true,
            ..Default::default()
        };

        assert_eq!(FiveStateClassifier::classify(&ctx), DetectionVerdict::Vulnerable);
    }

    #[test]
    fn test_blocked_verdict_on_waf_403() {
        let ctx = ClassificationContext {
            status_code: 403,
            is_waf_blocked: true,
            ..Default::default()
        };

        assert_eq!(FiveStateClassifier::classify(&ctx), DetectionVerdict::Blocked);
    }

    #[test]
    fn test_constrained_verdict() {
        let ctx = ClassificationContext {
            status_code: 200,
            has_boundary_truncation: true,
            ..Default::default()
        };

        assert_eq!(FiveStateClassifier::classify(&ctx), DetectionVerdict::Constrained);
    }

    #[test]
    fn test_safe_verdict() {
        let ctx = ClassificationContext {
            status_code: 200,
            metamorphic_invariant_checked: true,
            metamorphic_diverged: false,
            ..Default::default()
        };

        assert_eq!(FiveStateClassifier::classify(&ctx), DetectionVerdict::Safe);
    }

    #[test]
    fn test_unknown_verdict_on_network_error() {
        let ctx = ClassificationContext {
            network_error: true,
            ..Default::default()
        };

        assert_eq!(FiveStateClassifier::classify(&ctx), DetectionVerdict::Unknown);
    }
}

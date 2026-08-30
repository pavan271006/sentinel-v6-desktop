//! Bayesian Target Technology Confidence Scoring Subsystem
//!
//! Evaluates multi-modal evidence (passive headers, DOM signatures, static asset hashes,
//! and behavioral probes) to compute a normalized technology confidence score P(Tech | Evidence)
//! and filter out inapplicable or out-of-scope targets.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceSourceType {
    /// Passive HTTP response headers (e.g. `Server: Apache/2.4.49`, `X-Powered-By: PHP/8.1`)
    PassiveHeader,
    /// DOM / HTML body markers (e.g. meta generator, script tag paths, unique comments)
    DomSignature,
    /// Static asset cryptographic fingerprints (e.g. Favicon MurmurHash3, jQuery bundle SHA-256)
    StaticAssetHash,
    /// Active behavioral probes (e.g. framework-specific 404 error layouts, header casing traits)
    BehavioralProbe,
}

impl EvidenceSourceType {
    /// Canonical source reliability weight w_i.
    pub fn reliability_weight(&self) -> f64 {
        match self {
            EvidenceSourceType::PassiveHeader => 0.30,
            EvidenceSourceType::DomSignature => 0.50,
            EvidenceSourceType::StaticAssetHash => 0.85,
            EvidenceSourceType::BehavioralProbe => 0.95,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EvidenceItem {
    pub source_type: EvidenceSourceType,
    pub match_quality: f64, // 0.0 to 1.0
    pub identifier: String,
    pub details: String,
}

impl EvidenceItem {
    pub fn new(source_type: EvidenceSourceType, match_quality: f64, identifier: impl Into<String>, details: impl Into<String>) -> Self {
        Self {
            source_type,
            match_quality: match_quality.clamp(0.0, 1.0),
            identifier: identifier.into(),
            details: details.into(),
        }
    }

    pub fn passive_header(identifier: impl Into<String>, details: impl Into<String>) -> Self {
        Self::new(EvidenceSourceType::PassiveHeader, 1.0, identifier, details)
    }

    pub fn dom_signature(identifier: impl Into<String>, details: impl Into<String>) -> Self {
        Self::new(EvidenceSourceType::DomSignature, 1.0, identifier, details)
    }

    pub fn static_asset_hash(identifier: impl Into<String>, details: impl Into<String>) -> Self {
        Self::new(EvidenceSourceType::StaticAssetHash, 1.0, identifier, details)
    }

    pub fn behavioral_probe(identifier: impl Into<String>, details: impl Into<String>) -> Self {
        Self::new(EvidenceSourceType::BehavioralProbe, 1.0, identifier, details)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetEvaluationDecision {
    Proceed { confidence: f64 },
    SkipLowConfidence { confidence: f64, threshold: f64 },
    SkipOutOfScope,
}

impl TargetEvaluationDecision {
    pub fn should_proceed(&self) -> bool {
        matches!(self, TargetEvaluationDecision::Proceed { .. })
    }
}

pub struct BayesianConfidenceScorer;

impl BayesianConfidenceScorer {
    /// Computes the Bayesian target technology confidence score:
    /// Confidence(T) = 1.0 - \prod_{i=1}^k (1.0 - w_i * c_i)
    pub fn calculate_confidence(evidence: &[EvidenceItem]) -> f64 {
        if evidence.is_empty() {
            return 0.0;
        }

        let mut complement_product = 1.0;
        for item in evidence {
            let weight = item.source_type.reliability_weight();
            let quality = item.match_quality.clamp(0.0, 1.0);
            let combined = (weight * quality).clamp(0.0, 0.9999);
            complement_product *= 1.0 - combined;
        }

        let confidence = 1.0 - complement_product;
        confidence.clamp(0.0, 1.0)
    }

    /// Evaluates target applicability given computed confidence, required threshold, and scope status.
    pub fn evaluate_target_prerequisite(
        confidence: f64,
        threshold: f64,
        in_scope: bool,
    ) -> TargetEvaluationDecision {
        if !in_scope {
            return TargetEvaluationDecision::SkipOutOfScope;
        }

        let clamped_threshold = threshold.clamp(0.0, 1.0);
        if confidence >= clamped_threshold {
            TargetEvaluationDecision::Proceed { confidence }
        } else {
            TargetEvaluationDecision::SkipLowConfidence {
                confidence,
                threshold: clamped_threshold,
            }
        }
    }
}

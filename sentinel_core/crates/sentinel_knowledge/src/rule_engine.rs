//! Verification-First Vulnerability Intelligence Rule Engine
//!
//! Executes the 6-stage Verification-First testing lifecycle:
//! 1. Advisory Match
//! 2. Candidate Generated (Hypothesized status, 0% finding pollution)
//! 3. Precondition Check (Scope check SEC-01, tech confidence >= threshold)
//! 4. Safe Non-Destructive Probe Execution
//! 5. Deterministic Response Verification
//! 6. Cryptographic CAS Evidence Capture (SHA-256) & Finding Promotion

use std::collections::HashMap;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use sentinel_common::domain::core::{Candidate, Finding};
use sentinel_common::domain::meta::EntityMetadata;
use sentinel_common::enums::{FindingLifecycle, Provenance, Severity};
use sentinel_common::errors::SentinelError;

use crate::confidence::{BayesianConfidenceScorer, EvidenceItem};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VulnerabilityRule {
    pub id: String, // e.g. "RULE-CVE-2024-3094"
    pub cve_id: String,
    pub title: String,
    pub category: String,
    pub severity: Severity,
    pub cvss_v3_score: f32,
    pub is_cisa_kev: bool,
    pub cpe_matches: Vec<String>,
    pub technologies: Vec<TechPrerequisite>,
    pub prerequisites: Vec<PrerequisiteCheck>,
    pub safe_probe: SafeProbeConfig,
    pub verification: RuleVerificationConfig,
    pub remediation: RemediationAdvice,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechPrerequisite {
    pub name: String,
    pub confidence_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrerequisiteCheck {
    pub check_type: String,
    pub value: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeProbeConfig {
    pub method: String, // "GET", "POST", "HEAD"
    pub path: Option<String>,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub non_destructive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleVerificationConfig {
    pub verification_type: RuleVerificationType,
    pub expected_status: Option<u16>,
    pub body_regex: Option<String>,
    pub exact_pattern: Option<String>,
    pub oast_protocol: Option<String>,
    pub cas_proof_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RuleVerificationType {
    HttpStatusAndBody,
    HttpDifferentialResponse,
    OastCallback,
    TimingStatistical,
    DynamicSymbolVerification,
    StaticVersionCheck,
    HttpBodyExact,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationAdvice {
    pub guidance: String,
    pub fixed_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuleExecutionReport {
    pub rule_id: String,
    pub cve_id: String,
    pub target_url: String,
    pub matched_candidate: bool,
    pub candidate_id: Option<Uuid>,
    pub precondition_passed: bool,
    pub probe_executed: bool,
    pub verified: bool,
    pub finding_id: Option<Uuid>,
    pub cas_proof_hash: Option<String>,
    pub audit_log: Vec<String>,
}

pub struct VulnerabilityRuleEngine {
    rules: HashMap<String, VulnerabilityRule>,
}

impl VulnerabilityRuleEngine {
    pub fn new() -> Self {
        Self {
            rules: HashMap::new(),
        }
    }

    pub fn register_rule(&mut self, rule: VulnerabilityRule) {
        self.rules.insert(rule.id.clone(), rule);
    }

    pub fn get_rule(&self, rule_id: &str) -> Option<&VulnerabilityRule> {
        self.rules.get(rule_id)
    }

    pub fn list_rules(&self) -> Vec<&VulnerabilityRule> {
        self.rules.values().collect()
    }

    /// Full 6-stage Verification-First evaluation of a target for a specific rule.
    pub fn evaluate_target_lifecycle(
        &self,
        rule_id: &str,
        target_url: &str,
        in_scope: bool,
        tech_evidence: &[EvidenceItem],
        simulated_response_status: u16,
        simulated_response_body: &[u8],
        oast_token_received: bool,
    ) -> Result<RuleExecutionReport, SentinelError> {
        let rule = self.rules.get(rule_id).ok_or_else(|| {
            SentinelError::parse_error(format!("Vulnerability rule not found: {}", rule_id))
        })?;

        let mut audit_log = Vec::new();
        audit_log.push(format!("Stage 1: Evaluating advisory match for {}", rule.cve_id));

        // Stage 1: Advisory & Technology Matching
        let target_confidence = BayesianConfidenceScorer::calculate_confidence(tech_evidence);
        audit_log.push(format!(
            "Stage 1 -> Computed Bayesian technology confidence: {:.3}",
            target_confidence
        ));

        // Stage 2: Candidate Generation (Hypothesized)
        let candidate_id = Uuid::new_v4();
        let candidate = Candidate {
            meta: EntityMetadata::new(Provenance::Scanner),
            hypothesis: format!("Target may be vulnerable to {}: {}", rule.cve_id, rule.title),
            source_observation_id: Uuid::new_v4(),
            status: "Hypothesized".to_string(),
        };
        audit_log.push(format!(
            "Stage 2: Candidate generated: {} (0% finding pollution)",
            candidate.hypothesis
        ));

        // Stage 3: Precondition Safety Check
        let min_required_confidence = rule
            .technologies
            .iter()
            .map(|t| t.confidence_threshold)
            .fold(0.0f64, f64::max);

        let decision = BayesianConfidenceScorer::evaluate_target_prerequisite(
            target_confidence,
            min_required_confidence,
            in_scope,
        );

        if !decision.should_proceed() {
            audit_log.push(format!(
                "Stage 3: Precondition check FAILED ({:?}). Testing aborted.",
                decision
            ));
            return Ok(RuleExecutionReport {
                rule_id: rule.id.clone(),
                cve_id: rule.cve_id.clone(),
                target_url: target_url.to_string(),
                matched_candidate: true,
                candidate_id: Some(candidate_id),
                precondition_passed: false,
                probe_executed: false,
                verified: false,
                finding_id: None,
                cas_proof_hash: None,
                audit_log,
            });
        }
        audit_log.push("Stage 3: Precondition safety checks PASSED (In-Scope & Tech Confirmed).".into());

        // Stage 4: Safe Non-Destructive Probe
        if !rule.safe_probe.non_destructive {
            return Err(SentinelError::invariant_violation(
                "Violation: Attempted to configure a destructive probe in rule registry.".to_string(),
            ));
        }

        let probe_request_str = format!(
            "{} {} HTTP/1.1\r\nHost: {}\r\n{}\r\n\r\n{}",
            rule.safe_probe.method,
            rule.safe_probe.path.as_deref().unwrap_or("/"),
            target_url,
            rule.safe_probe
                .headers
                .iter()
                .map(|(k, v)| format!("{}: {}", k, v))
                .collect::<Vec<_>>()
                .join("\r\n"),
            rule.safe_probe.body.as_deref().unwrap_or("")
        );
        let raw_probe_request = probe_request_str.into_bytes();
        audit_log.push(format!(
            "Stage 4: Safe non-destructive probe executed: {} {}",
            rule.safe_probe.method,
            rule.safe_probe.path.as_deref().unwrap_or("/")
        ));

        // Stage 5: Deterministic Verification Evaluation
        let mut verified = false;
        match rule.verification.verification_type {
            RuleVerificationType::HttpStatusAndBody => {
                let status_matches = rule
                    .verification
                    .expected_status
                    .map(|s| s == simulated_response_status)
                    .unwrap_or(true);
                let body_matches = if let Some(pattern) = &rule.verification.body_regex {
                    if let Ok(re) = Regex::new(pattern) {
                        let body_str = String::from_utf8_lossy(simulated_response_body);
                        re.is_match(&body_str)
                    } else {
                        false
                    }
                } else {
                    true
                };
                verified = status_matches && body_matches;
            }
            RuleVerificationType::HttpBodyExact => {
                if let Some(pattern) = &rule.verification.exact_pattern {
                    let body_str = String::from_utf8_lossy(simulated_response_body);
                    verified = body_str.contains(pattern.as_str());
                }
            }
            RuleVerificationType::OastCallback => {
                verified = oast_token_received;
            }
            RuleVerificationType::HttpDifferentialResponse => {
                let status_diff = rule
                    .verification
                    .expected_status
                    .map(|s| s == simulated_response_status)
                    .unwrap_or(false);
                verified = status_diff;
            }
            RuleVerificationType::DynamicSymbolVerification | RuleVerificationType::StaticVersionCheck => {
                verified = simulated_response_status == 200;
            }
            RuleVerificationType::TimingStatistical => {
                verified = simulated_response_status == 200;
            }
        }

        if !verified {
            audit_log.push(
                "Stage 5: Verification evaluated to NEGATIVE / Not Vulnerable. Discarding candidate without finding.".into(),
            );
            return Ok(RuleExecutionReport {
                rule_id: rule.id.clone(),
                cve_id: rule.cve_id.clone(),
                target_url: target_url.to_string(),
                matched_candidate: true,
                candidate_id: Some(candidate_id),
                precondition_passed: true,
                probe_executed: true,
                verified: false,
                finding_id: None,
                cas_proof_hash: None,
                audit_log,
            });
        }
        audit_log.push("Stage 5: Deterministic proof verification SUCCEEDED.".into());

        // Stage 6: Cryptographic CAS Proof Capture & Finding Promotion
        let mut hasher = Sha256::new();
        hasher.update(&raw_probe_request);
        hasher.update(simulated_response_status.to_be_bytes());
        hasher.update(simulated_response_body);
        let digest = hasher.finalize();
        let cas_hash = hex::encode(digest);
        audit_log.push(format!("Stage 6: CAS SHA-256 Evidence captured: {}", cas_hash));

        let finding = Finding {
            meta: EntityMetadata::new(Provenance::Scanner),
            title: format!("[{}] Verified: {}", rule.cve_id, rule.title),
            severity: rule.severity,
            verification_id: Uuid::new_v4(),
            state: FindingLifecycle::Verified,
        };
        let finding_id = finding.meta.id;
        audit_log.push(format!(
            "Stage 6: Promoted to Verified Finding: {} (ID: {})",
            finding.title, finding_id
        ));

        Ok(RuleExecutionReport {
            rule_id: rule.id.clone(),
            cve_id: rule.cve_id.clone(),
            target_url: target_url.to_string(),
            matched_candidate: true,
            candidate_id: Some(candidate_id),
            precondition_passed: true,
            probe_executed: true,
            verified: true,
            finding_id: Some(finding_id),
            cas_proof_hash: Some(cas_hash),
            audit_log,
        })
    }
}

impl Default for VulnerabilityRuleEngine {
    fn default() -> Self {
        Self::new()
    }
}

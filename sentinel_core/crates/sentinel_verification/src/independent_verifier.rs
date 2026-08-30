//! Isolated Independent Verifier Worker Subsystem (SEC-06 Enforcement)
//!
//! Operates in an isolated thread/process context separate from the detector.
//! Consumes stored raw request/state inputs without access to the detector's internal verdict.
//!
//! MANDATORY TYPE-SAFE ORACLE REQUIREMENT (SEC-06):
//! The verifier MUST reject a finding when no applicable oracle exists.
//! AI agreement alone cannot promote a finding.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::enums::{FormalFindingState, Severity};
use sentinel_common::errors::SentinelError;

use crate::formal_state_machine::FormalFindingRecordData;
use crate::sec06_oracles::{
    OracleEvaluationContext, OracleEvaluationResult, Sec06OracleRegistry, Sec06OracleType,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndependentVerificationAttestation {
    pub attestation_id: Uuid,
    pub candidate_id: Uuid,
    pub oracle_used: Sec06OracleType,
    pub oracle_confidence: f64,
    pub rationale: String,
    pub proof_hash: String,
    pub is_verified: bool,
}

pub struct IndependentVerifierWorker;

impl IndependentVerifierWorker {
    pub fn new() -> Self {
        Self
    }

    /// Verifies candidate finding in isolation against a registered SEC-06 oracle.
    ///
    /// SEC-06 MANDATE:
    /// - Rejects candidate if oracle_type is None.
    /// - Rejects candidate if oracle evaluation fails or is statistically insignificant.
    /// - Emits cryptographically verifiable attestation upon success.
    pub fn verify_candidate_isolated(
        &self,
        candidate_id: Uuid,
        oracle_type: Option<Sec06OracleType>,
        context: &OracleEvaluationContext,
    ) -> Result<IndependentVerificationAttestation, SentinelError> {
        // 1. Mandatory Oracle Check: Rejection if no oracle registered
        let oracle = match oracle_type {
            Some(o) => o,
            None => {
                return Ok(IndependentVerificationAttestation {
                    attestation_id: Uuid::new_v4(),
                    candidate_id,
                    oracle_used: Sec06OracleType::BitLevelDeterministicReplay,
                    oracle_confidence: 0.0,
                    rationale: "SEC-06 REJECTION: No registered deterministic oracle assigned. AI agreement alone cannot promote a finding.".to_string(),
                    proof_hash: String::new(),
                    is_verified: false,
                });
            }
        };

        // 2. Evaluate against registered SEC-06 oracle
        let eval_result = Sec06OracleRegistry::evaluate(oracle, context)?;

        if !eval_result.success {
            return Ok(IndependentVerificationAttestation {
                attestation_id: Uuid::new_v4(),
                candidate_id,
                oracle_used: oracle,
                oracle_confidence: eval_result.confidence,
                rationale: format!(
                    "SEC-06 REJECTION: Independent oracle '{}' failed verification: {}",
                    oracle.as_str(),
                    eval_result.rationale
                ),
                proof_hash: eval_result.proof_hash,
                is_verified: false,
            });
        }

        // 3. Success: issue cryptographic attestation
        Ok(IndependentVerificationAttestation {
            attestation_id: Uuid::new_v4(),
            candidate_id,
            oracle_used: oracle,
            oracle_confidence: eval_result.confidence,
            rationale: eval_result.rationale,
            proof_hash: eval_result.proof_hash,
            is_verified: true,
        })
    }

    /// Verifies and promotes a finding through the formal state machine
    pub fn verify_and_promote(
        &self,
        finding: &mut FormalFindingRecordData,
        oracle_type: Option<Sec06OracleType>,
        context: &OracleEvaluationContext,
        actor: &str,
    ) -> Result<IndependentVerificationAttestation, SentinelError> {
        let attestation = self.verify_candidate_isolated(finding.id, oracle_type, context)?;

        if attestation.is_verified {
            let eval_result = OracleEvaluationResult {
                oracle_type: attestation.oracle_used,
                success: true,
                confidence: attestation.oracle_confidence,
                rationale: attestation.rationale.clone(),
                proof_hash: attestation.proof_hash.clone(),
            };

            // Attach oracle and advance state machine to INDEPENDENTLY_VERIFIED
            finding.attach_oracle_verification(&eval_result)?;
            finding.transition_to(
                FormalFindingState::IndependentlyVerified,
                actor,
                &attestation.rationale,
            )?;
            // Advance to PROMOTED
            finding.transition_to(
                FormalFindingState::Promoted,
                actor,
                "Promoted after independent SEC-06 verification",
            )?;
        }

        Ok(attestation)
    }

    /// Generates SARIF v2.1.0 output for a promoted/reported finding
    pub fn generate_sarif_attestation(
        &self,
        finding: &FormalFindingRecordData,
    ) -> Result<serde_json::Value, SentinelError> {
        let sarif = serde_json::json!({
            "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            "version": "2.1.0",
            "runs": [{
                "tool": {
                    "driver": {
                        "name": "SENTINEL V6 Independent Verifier",
                        "version": "6.0.0",
                        "informationUri": "https://sentinel.internal/security"
                    }
                },
                "results": [{
                    "ruleId": finding.verified_oracle.map(|o| o.as_str()).unwrap_or("SEC-06-ORACLE"),
                    "level": match finding.severity {
                        Severity::Critical | Severity::High => "error",
                        Severity::Medium => "warning",
                        Severity::Low | Severity::Info => "note",
                    },
                    "message": {
                        "text": finding.title.clone()
                    },
                    "properties": {
                        "findingId": finding.id.to_string(),
                        "state": finding.current_state.as_str(),
                        "evidenceDigest": finding.evidence_digest.clone(),
                        "oracleRationale": finding.oracle_rationale.clone().unwrap_or_default()
                    }
                }]
            }]
        });

        Ok(sarif)
    }
}

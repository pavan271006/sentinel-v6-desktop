//! Tri-Target Verification & Confusion Matrix Evaluation Harness
//!
//! Evaluates the detection and independent verification pipeline against the 3 target categories:
//! 1. Vulnerable Target: Seeded flaws (BOLA, SQLi, SSRF, State bypass, etc.) -> Must yield True Positive (TP).
//! 2. Fixed Target: Remediated versions of vulnerable endpoints -> Must yield True Negative (TN).
//! 3. Benign Control Target: Clean baseline operations -> Must yield True Negative (TN).
//!
//! Computes and validates:
//! - True Positives (TP), True Negatives (TN), False Positives (FP), False Negatives (FN)
//! - Precision = TP / (TP + FP)
//! - Recall = TP / (TP + FN)
//! - Verification Rate = Independently Verified / Total Candidates

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use sentinel_common::enums::{FormalFindingState, Severity};
use sentinel_common::errors::SentinelError;

use crate::formal_state_machine::FormalFindingRecordData;
use crate::independent_verifier::IndependentVerifierWorker;
use crate::sec06_oracles::{OracleEvaluationContext, Sec06OracleType};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TargetCategory {
    VulnerableTarget,
    FixedTarget,
    BenignControlTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub id: String,
    pub name: String,
    pub target_category: TargetCategory,
    pub oracle_type: Sec06OracleType,
    pub context: OracleEvaluationContext,
    pub expected_is_vulnerable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfusionMatrixReport {
    pub true_positives: usize,
    pub true_negatives: usize,
    pub false_positives: usize,
    pub false_negatives: usize,
    pub precision: f64,
    pub recall: f64,
    pub verification_rate: f64,
    pub total_test_cases: usize,
    pub summary: String,
}

pub struct TriTargetAuditHarness {
    verifier: IndependentVerifierWorker,
}

impl TriTargetAuditHarness {
    pub fn new() -> Self {
        Self {
            verifier: IndependentVerifierWorker::new(),
        }
    }

    /// Builds standard seeded test corpus covering BOLA, SQLi, SSRF, State bypass, Timing, and Benign controls
    pub fn build_standard_test_corpus() -> Vec<TestCase> {
        let mut cases = Vec::new();

        // 1. Vulnerable BOLA / IDOR (Vulnerable Target)
        let mut role_resps = HashMap::new();
        role_resps.insert("admin".to_string(), b"{\"id\": \"acc_123\", \"balance\": 50000}".to_vec());
        role_resps.insert("user_b".to_string(), b"{\"id\": \"acc_123\", \"balance\": 50000}".to_vec());
        cases.push(TestCase {
            id: "CORPUS-01".to_string(),
            name: "BOLA / IDOR Cross-Tenant Access".to_string(),
            target_category: TargetCategory::VulnerableTarget,
            oracle_type: Sec06OracleType::AuthorizationDifferential,
            context: OracleEvaluationContext {
                role_responses: role_resps,
                ..Default::default()
            },
            expected_is_vulnerable: true,
        });

        // 2. Fixed BOLA / IDOR (Fixed Target)
        let mut fixed_role_resps = HashMap::new();
        fixed_role_resps.insert("admin".to_string(), b"{\"id\": \"acc_123\", \"balance\": 50000}".to_vec());
        fixed_role_resps.insert("user_b".to_string(), b"{\"error\": \"403 Forbidden\"}".to_vec());
        cases.push(TestCase {
            id: "CORPUS-02".to_string(),
            name: "Remediated BOLA / 403 Forbidden".to_string(),
            target_category: TargetCategory::FixedTarget,
            oracle_type: Sec06OracleType::AuthorizationDifferential,
            context: OracleEvaluationContext {
                role_responses: fixed_role_resps,
                ..Default::default()
            },
            expected_is_vulnerable: false,
        });

        // 3. Vulnerable State Invariant (Vulnerable Target: Anon reaches Admin state)
        cases.push(TestCase {
            id: "CORPUS-03".to_string(),
            name: "Illegal State Transition Bypass".to_string(),
            target_category: TargetCategory::VulnerableTarget,
            oracle_type: Sec06OracleType::StateInvariantViolation,
            context: OracleEvaluationContext {
                state_from: Some("CHECKOUT_STEP_1".to_string()),
                state_to: Some("ORDER_FULFILLED".to_string()),
                allowed_transitions: vec![
                    ("CHECKOUT_STEP_1".to_string(), "CHECKOUT_STEP_2".to_string()),
                    ("CHECKOUT_STEP_2".to_string(), "PAYMENT_PROCESSING".to_string()),
                    ("PAYMENT_PROCESSING".to_string(), "ORDER_FULFILLED".to_string()),
                ],
                ..Default::default()
            },
            expected_is_vulnerable: true,
        });

        // 4. Fixed State Invariant (Fixed Target: Normal linear progression)
        cases.push(TestCase {
            id: "CORPUS-04".to_string(),
            name: "Enforced Linear State Progression".to_string(),
            target_category: TargetCategory::FixedTarget,
            oracle_type: Sec06OracleType::StateInvariantViolation,
            context: OracleEvaluationContext {
                state_from: Some("CHECKOUT_STEP_1".to_string()),
                state_to: Some("CHECKOUT_STEP_2".to_string()),
                allowed_transitions: vec![
                    ("CHECKOUT_STEP_1".to_string(), "CHECKOUT_STEP_2".to_string()),
                    ("CHECKOUT_STEP_2".to_string(), "ORDER_FULFILLED".to_string()),
                ],
                ..Default::default()
            },
            expected_is_vulnerable: false,
        });

        // 5. Vulnerable OAST Callback (Vulnerable Target: Out-of-band SSRF)
        let token = "oast_ssrf_token_999";
        cases.push(TestCase {
            id: "CORPUS-05".to_string(),
            name: "Blind SSRF Out-of-Band Callback".to_string(),
            target_category: TargetCategory::VulnerableTarget,
            oracle_type: Sec06OracleType::OastCallbackAttestation,
            context: OracleEvaluationContext {
                oast_token: Some(token.to_string()),
                oast_received_tokens: vec![token.to_string()],
                ..Default::default()
            },
            expected_is_vulnerable: true,
        });

        // 6. Benign Control Target (Clean API search query)
        cases.push(TestCase {
            id: "CORPUS-06".to_string(),
            name: "Benign Public Search Query".to_string(),
            target_category: TargetCategory::BenignControlTarget,
            oracle_type: Sec06OracleType::DomTaintReachability,
            context: OracleEvaluationContext {
                raw_request: b"GET /search?q=laptop HTTP/1.1".to_vec(),
                raw_response: b"HTTP/1.1 200 OK\r\n\r\n{\"results\": [\"laptop-a\", \"laptop-b\"]}".to_vec(),
                taint_source: Some("q".to_string()),
                taint_sink: Some("eval(".to_string()),
                ..Default::default()
            },
            expected_is_vulnerable: false,
        });

        // 7. Vulnerable Statistical Timing (Vulnerable Target: Timing-based SQLi)
        cases.push(TestCase {
            id: "CORPUS-07".to_string(),
            name: "Timing Blind SQL Injection".to_string(),
            target_category: TargetCategory::VulnerableTarget,
            oracle_type: Sec06OracleType::StatisticalTimingAnalysis,
            context: OracleEvaluationContext {
                timing_samples_ms: vec![5012.0, 5025.0, 5018.0, 5030.0],
                control_timing_samples_ms: vec![12.0, 15.0, 10.0, 14.0],
                ..Default::default()
            },
            expected_is_vulnerable: true,
        });

        // 8. Fixed Statistical Timing (Fixed Target: Parameterized SQL)
        cases.push(TestCase {
            id: "CORPUS-08".to_string(),
            name: "Parameterized SQL (Uniform Timing)".to_string(),
            target_category: TargetCategory::FixedTarget,
            oracle_type: Sec06OracleType::StatisticalTimingAnalysis,
            context: OracleEvaluationContext {
                timing_samples_ms: vec![14.0, 16.0, 15.0, 13.0],
                control_timing_samples_ms: vec![13.0, 15.0, 12.0, 14.0],
                ..Default::default()
            },
            expected_is_vulnerable: false,
        });

        cases
    }

    /// Executes audit across test corpus and calculates precision, recall, and verification rate
    pub fn run_corpus_audit(&self, corpus: &[TestCase]) -> Result<ConfusionMatrixReport, SentinelError> {
        let mut tp = 0;
        let mut tn = 0;
        let mut fp = 0;
        let mut fn_count = 0;
        let mut total_candidates = 0;
        let mut independently_verified = 0;

        for test in corpus {
            let candidate_id = Uuid::new_v4();
            let mut finding = FormalFindingRecordData::new(
                candidate_id,
                test.name.clone(),
                Severity::High,
                format!("sha256_{}", test.id),
            );

            // Transition from OBSERVED -> CANDIDATE -> REPRODUCIBLE -> VERIFIED
            finding.transition_to(FormalFindingState::Candidate, "detector", "Discovered in traffic")?;
            finding.transition_to(FormalFindingState::Reproducible, "detector", "Replayed successfully")?;
            finding.transition_to(FormalFindingState::Verified, "detector", "Detector self-test passed")?;

            total_candidates += 1;

            // Execute Independent Verifier Worker with SEC-06 Oracle
            let attestation = self.verifier.verify_and_promote(
                &mut finding,
                Some(test.oracle_type),
                &test.context,
                "independent_verifier_worker",
            )?;

            let actually_promoted = attestation.is_verified
                && finding.current_state == FormalFindingState::Promoted;

            if actually_promoted {
                independently_verified += 1;
            }

            match (test.expected_is_vulnerable, actually_promoted) {
                (true, true) => tp += 1,
                (false, false) => tn += 1,
                (false, true) => fp += 1,
                (true, false) => fn_count += 1,
            }
        }

        let precision = if (tp + fp) > 0 {
            tp as f64 / (tp + fp) as f64
        } else {
            1.0
        };

        let recall = if (tp + fn_count) > 0 {
            tp as f64 / (tp + fn_count) as f64
        } else {
            1.0
        };

        let verification_rate = if total_candidates > 0 {
            independently_verified as f64 / total_candidates as f64
        } else {
            1.0
        };

        let summary = format!(
            "Tri-Target Audit Complete: TP={}, TN={}, FP={}, FN={}. Precision={:.2}%, Recall={:.2}%, VerificationRate={:.2}% (Applies strictly to tested corpus)",
            tp, tn, fp, fn_count, precision * 100.0, recall * 100.0, verification_rate * 100.0
        );

        Ok(ConfusionMatrixReport {
            true_positives: tp,
            true_negatives: tn,
            false_positives: fp,
            false_negatives: fn_count,
            precision,
            recall,
            verification_rate,
            total_test_cases: corpus.len(),
            summary,
        })
    }
}

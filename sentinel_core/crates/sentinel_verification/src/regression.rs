//! Security Regression Graph & Retest State Machine (SENTINEL Proprietary Engine 4)
//!
//! Manages reproducible regression test suites, state machine transitions
//! (VULNERABLE <-> FIXED <-> REGRESSED), automated retest verification,
//! regression alerts, and CAS-linked proof audit logs.

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use sentinel_common::enums::{FindingLifecycle, HttpMethod, VerificationStrategy};
use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RegressionTestDefinition {
    pub id: Uuid,
    pub finding_id: Uuid,
    pub title: String,
    pub endpoint: String,
    pub http_method: HttpMethod,
    pub target_parameter: Option<String>,
    pub payload_template: String,
    pub verification_strategy: VerificationStrategy,
    pub expected_remediation_status: u16,
    pub negative_assertion_regex: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_executed_at: Option<DateTime<Utc>>,
}

impl RegressionTestDefinition {
    pub fn new(
        finding_id: Uuid,
        title: impl Into<String>,
        endpoint: impl Into<String>,
        http_method: HttpMethod,
        payload_template: impl Into<String>,
        verification_strategy: VerificationStrategy,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            finding_id,
            title: title.into(),
            endpoint: endpoint.into(),
            http_method,
            target_parameter: None,
            payload_template: payload_template.into(),
            verification_strategy,
            expected_remediation_status: 400,
            negative_assertion_regex: None,
            created_at: Utc::now(),
            last_executed_at: None,
        }
    }

    pub fn with_param(mut self, param: impl Into<String>) -> Self {
        self.target_parameter = Some(param.into());
        self
    }

    pub fn with_expected_status(mut self, status: u16) -> Self {
        self.expected_remediation_status = status;
        self
    }

    pub fn with_negative_assertion(mut self, regex: impl Into<String>) -> Self {
        self.negative_assertion_regex = Some(regex.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RegressionExecutionResult {
    pub execution_id: Uuid,
    pub test_definition_id: Uuid,
    pub finding_id: Uuid,
    pub previous_lifecycle: FindingLifecycle,
    pub new_lifecycle: FindingLifecycle,
    pub retest_status_code: u16,
    pub retest_body_sha256: String,
    pub is_vulnerability_reproduced: bool,
    pub is_regression: bool,
    pub remediation_verified: bool,
    pub cas_evidence_hash: String,
    pub executed_at: DateTime<Utc>,
    pub details: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RetestHistoryEntry {
    pub entry_id: Uuid,
    pub finding_id: Uuid,
    pub test_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub result: RegressionExecutionResult,
}

#[derive(Debug, Clone, Default)]
pub struct RegressionGraphEngine {
    pub definitions: HashMap<Uuid, RegressionTestDefinition>,
    pub finding_states: HashMap<Uuid, FindingLifecycle>,
    pub history: HashMap<Uuid, Vec<RetestHistoryEntry>>,
}

impl RegressionGraphEngine {
    pub fn new() -> Self {
        Self {
            definitions: HashMap::new(),
            finding_states: HashMap::new(),
            history: HashMap::new(),
        }
    }

    pub fn register_test(&mut self, test_def: RegressionTestDefinition) {
        self.definitions.insert(test_def.id, test_def);
    }

    pub fn set_finding_state(&mut self, finding_id: Uuid, state: FindingLifecycle) {
        self.finding_states.insert(finding_id, state);
    }

    pub fn get_finding_state(&self, finding_id: &Uuid) -> FindingLifecycle {
        self.finding_states
            .get(finding_id)
            .copied()
            .unwrap_or(FindingLifecycle::Confirmed)
    }

    pub fn get_history(&self, finding_id: &Uuid) -> &[RetestHistoryEntry] {
        self.history
            .get(finding_id)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Evaluates the response of a retest execution against the test definition and updates finding lifecycle.
    pub fn execute_retest_evaluation(
        &mut self,
        test_id: Uuid,
        response_status: u16,
        response_body: &[u8],
        response_time_ms: u64,
    ) -> Result<RegressionExecutionResult, SentinelError> {
        let (finding_id, verification_strategy, payload_template, negative_assertion_regex, expected_remediation_status) = {
            let test_def = self
                .definitions
                .get_mut(&test_id)
                .ok_or_else(|| SentinelError::invariant_violation(format!("Regression test {} not found", test_id)))?;

            test_def.last_executed_at = Some(Utc::now());
            (
                test_def.finding_id,
                test_def.verification_strategy.clone(),
                test_def.payload_template.clone(),
                test_def.negative_assertion_regex.clone(),
                test_def.expected_remediation_status,
            )
        };

        let current_state = self.get_finding_state(&finding_id);

        // Compute cryptographic SHA-256 CAS hash of response
        let mut hasher = Sha256::new();
        hasher.update(response_body);
        let body_sha256 = hex::encode(hasher.finalize());

        let body_text = String::from_utf8_lossy(response_body);

        // Evaluate reproduction based on strategy
        let is_vulnerability_reproduced = match verification_strategy {
            VerificationStrategy::ContentVerification => {
                // If negative assertion regex provided and matched, or payload reflected unescaped
                if let Some(re_str) = &negative_assertion_regex {
                    if let Ok(re) = regex::Regex::new(re_str) {
                        re.is_match(&body_text)
                    } else {
                        body_text.contains(&payload_template)
                    }
                } else {
                    body_text.contains(&payload_template)
                }
            }
            VerificationStrategy::ErrorClassification => {
                // Check if RDBMS or application crash signature reappeared
                crate::sqli::SqliEngine::evaluate_error_based(response_body)
                    .map(|r| r.is_vulnerable)
                    .unwrap_or(false)
            }
            VerificationStrategy::TimingStatistical => {
                // Time-based retest: if response delay > 2500ms -> vulnerable
                response_time_ms >= 2500
            }
            VerificationStrategy::ResponseDifferential | VerificationStrategy::AuthorizationReplay => {
                // If response matches 200 OK without access restriction -> vulnerable
                response_status == 200 && response_status != expected_remediation_status
            }
            _ => {
                // Default fallback: if status is 200 and unexpected -> reproduced
                response_status == 200 && response_status != expected_remediation_status
            }
        };

        // Determine new lifecycle state
        let (new_lifecycle, is_regression, remediation_verified, details) =
            Self::evaluate_transition(current_state, is_vulnerability_reproduced, response_status);

        // Update finding state
        self.set_finding_state(finding_id, new_lifecycle);

        let execution_result = RegressionExecutionResult {
            execution_id: Uuid::new_v4(),
            test_definition_id: test_id,
            finding_id,
            previous_lifecycle: current_state,
            new_lifecycle,
            retest_status_code: response_status,
            retest_body_sha256: body_sha256.clone(),
            is_vulnerability_reproduced,
            is_regression,
            remediation_verified,
            cas_evidence_hash: body_sha256,
            executed_at: Utc::now(),
            details,
        };

        // Record history entry
        let entry = RetestHistoryEntry {
            entry_id: Uuid::new_v4(),
            finding_id,
            test_id,
            timestamp: Utc::now(),
            result: execution_result.clone(),
        };

        self.history.entry(finding_id).or_default().push(entry);

        Ok(execution_result)
    }

    /// Evaluates deterministic state transition rules.
    pub fn evaluate_transition(
        current: FindingLifecycle,
        is_reproduced: bool,
        status: u16,
    ) -> (FindingLifecycle, bool, bool, String) {
        if is_reproduced {
            match current {
                FindingLifecycle::Remediated => (
                    FindingLifecycle::Regression,
                    true,
                    false,
                    format!("REGRESSION DETECTED: Vulnerability previously marked Remediated reproduced with status {}", status),
                ),
                FindingLifecycle::Candidate => (
                    FindingLifecycle::Verified,
                    false,
                    false,
                    format!("Candidate verified via active retest with status {}", status),
                ),
                FindingLifecycle::Verified => (
                    FindingLifecycle::Confirmed,
                    false,
                    false,
                    format!("Verified finding confirmed by operator retest with status {}", status),
                ),
                FindingLifecycle::Confirmed | FindingLifecycle::Reported | FindingLifecycle::Regression => (
                    current,
                    false,
                    false,
                    format!("Vulnerability remains present (status {})", status),
                ),
                _ => (
                    FindingLifecycle::Confirmed,
                    false,
                    false,
                    format!("Vulnerability confirmed with status {}", status),
                ),
            }
        } else {
            match current {
                FindingLifecycle::Confirmed | FindingLifecycle::Reported | FindingLifecycle::Regression | FindingLifecycle::Verified => (
                    FindingLifecycle::Remediated,
                    false,
                    true,
                    format!("REMEDIATION VERIFIED: Vulnerability no longer reproducible (status {})", status),
                ),
                FindingLifecycle::Remediated => (
                    FindingLifecycle::Remediated,
                    false,
                    true,
                    format!("Remediation confirmed stable (status {})", status),
                ),
                FindingLifecycle::Candidate => (
                    FindingLifecycle::FalsePositive,
                    false,
                    false,
                    format!("Candidate failed reproduction -> marked FalsePositive (status {})", status),
                ),
                _ => (
                    FindingLifecycle::Remediated,
                    false,
                    true,
                    format!("Remediation verified with status {}", status),
                ),
            }
        }
    }
}

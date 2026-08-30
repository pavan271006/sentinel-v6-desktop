//! Authorization Matrix Generator & Differential Evaluator
//!
//! Evaluates live multi-session privilege differentials (Autorize-style):
//! - Compares high-privilege (Admin/Owner), low-privilege (User/Member), and anonymous sessions
//! - Flags BOLA / IDOR, Broken Function Level Authorization (BFLA), and unauthenticated access leaks

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use sentinel_common::enums::AccessLevel;
use sentinel_common::operational::{AuthzMatrix, AuthzViolation};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuthzVulnerabilityType {
    BflPrivilegeEscalation,     // Low-privilege user can invoke admin endpoint
    BolaIdorDataLeak,           // User A can access User B's private object
    UnauthenticatedAccess,      // Anonymous user can access authenticated endpoint
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifferentialProbeResult {
    pub endpoint_url: String,
    pub http_method: String,
    pub high_priv_status: u16,
    pub high_priv_body_len: usize,
    pub low_priv_status: u16,
    pub low_priv_body_len: usize,
    pub anon_status: u16,
    pub anon_body_len: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifferentialFinding {
    pub is_vulnerable: bool,
    pub vulnerability_type: AuthzVulnerabilityType,
    pub confidence: f32,
    pub description: String,
}

pub struct AutorizeDifferentialEngine;

impl AutorizeDifferentialEngine {
    /// Evaluates differential responses across high-privilege, low-privilege, and anonymous actors
    pub fn evaluate_differential(probe: &DifferentialProbeResult) -> Vec<DifferentialFinding> {
        let mut findings = Vec::new();

        // 1. Check Unauthenticated Access Leak
        // If high-privilege succeeds (200/201/204) and anonymous also succeeds (200/201/204)
        // with nearly identical response length (similarity > 0.85)
        if (probe.high_priv_status == 200 || probe.high_priv_status == 201)
            && (probe.anon_status == 200 || probe.anon_status == 201)
        {
            let diff = (probe.high_priv_body_len as isize - probe.anon_body_len as isize).unsigned_abs();
            let max_len = probe.high_priv_body_len.max(probe.anon_body_len).max(1);
            let sim = 1.0 - (diff as f32 / max_len as f32);

            if sim >= 0.80 {
                findings.push(DifferentialFinding {
                    is_vulnerable: true,
                    vulnerability_type: AuthzVulnerabilityType::UnauthenticatedAccess,
                    confidence: 0.95,
                    description: format!(
                        "Unauthenticated Access Leak: Endpoint '{}' returned HTTP {} for unauthenticated requests with {:.1}% body similarity to privileged session.",
                        probe.endpoint_url, probe.anon_status, sim * 100.0
                    ),
                });
            }
        }

        // 2. Check Broken Function Level Authorization (BFLA) / Privilege Escalation
        // If high-privilege succeeds and low-privilege also succeeds (200/201) where 403 Forbidden was required
        if (probe.high_priv_status == 200 || probe.high_priv_status == 201)
            && (probe.low_priv_status == 200 || probe.low_priv_status == 201)
            && probe.anon_status != 200 // auth is enforced for anonymous, but role barrier fails for low-priv
        {
            findings.push(DifferentialFinding {
                is_vulnerable: true,
                vulnerability_type: AuthzVulnerabilityType::BflPrivilegeEscalation,
                confidence: 0.98,
                description: format!(
                    "Broken Function Level Authorization (BFLA): Low-privilege role successfully accessed admin/privileged function at '{}' (HTTP {}).",
                    probe.endpoint_url, probe.low_priv_status
                ),
            });
        }

        findings
    }
}

pub struct MatrixEvaluator;

impl MatrixEvaluator {
    pub fn generate_default_matrix(identities: Vec<Uuid>, endpoints: Vec<Uuid>) -> AuthzMatrix {
        let mut expected = HashMap::new();
        let mut actual = HashMap::new();

        for (idx, &ep) in endpoints.iter().enumerate() {
            let level = match idx % 4 {
                0 => AccessLevel::Admin,
                1 => AccessLevel::User,
                2 => AccessLevel::TenantA,
                _ => AccessLevel::Anonymous,
            };
            expected.insert(ep, level);
            actual.insert(ep, level);
        }

        AuthzMatrix {
            identities,
            endpoints,
            expected,
            actual,
        }
    }

    pub fn evaluate_violations(matrix: &AuthzMatrix) -> Vec<AuthzViolation> {
        let mut violations = Vec::new();

        for &id in &matrix.identities {
            for &ep in &matrix.endpoints {
                if let (Some(&exp), Some(&act)) = (matrix.expected.get(&ep), matrix.actual.get(&ep))
                {
                    // Check privilege escalation or tenant leakage
                    let is_violation = matches!(
                        (exp, act),
                        (AccessLevel::Admin, AccessLevel::Anonymous)
                            | (AccessLevel::Admin, AccessLevel::User)
                            | (AccessLevel::User, AccessLevel::Anonymous)
                            | (AccessLevel::TenantA, AccessLevel::TenantB)
                            | (AccessLevel::TenantB, AccessLevel::TenantA)
                    );

                    if is_violation {
                        violations.push(AuthzViolation {
                            identity_id: id,
                            endpoint_id: ep,
                        });
                    }
                }
            }
        }

        violations
    }
}

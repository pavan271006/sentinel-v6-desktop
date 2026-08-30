//! Anti-CSRF Defense Evaluation Engine
//!
//! Evaluates state-changing actions across multiple CSRF bypass vectors:
//! - Token omission (stripping CSRF token header / body param)
//! - Empty token submission
//! - Tampered token submission (bit-flip / hash modification)
//! - HTTP method conversion (e.g. POST converted to GET)
//! - Cross-Origin header bypass (Origin: https://evil.attacker.com, Referer spoofing)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CsrfProbeType {
    TokenOmission,
    EmptyToken,
    TamperedToken,
    MethodConversion,
    OriginSpoofing,
    RefererSpoofing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsrfProbeResult {
    pub probe_type: CsrfProbeType,
    pub http_status: u16,
    pub state_changed: bool,
    pub is_vulnerable: bool,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsrfEvaluationReport {
    pub is_vulnerable: bool,
    pub failed_defenses: Vec<CsrfProbeType>,
    pub findings: Vec<String>,
}

pub struct AntiCsrfEngine;

impl AntiCsrfEngine {
    /// Generates CSRF test mutation specifications
    pub fn generate_csrf_probes(
        method: &str,
        path: &str,
        token_name: &str,
        valid_token: &str,
        attacker_origin: &str,
    ) -> Vec<(CsrfProbeType, String, Vec<(String, String)>)> {
        let mut probes = Vec::new();

        // 1. Omission
        probes.push((
            CsrfProbeType::TokenOmission,
            format!("{} {}", method, path),
            vec![("X-Requested-With".to_string(), "XMLHttpRequest".to_string())],
        ));

        // 2. Empty token
        probes.push((
            CsrfProbeType::EmptyToken,
            format!("{} {} ({}='')", method, path, token_name),
            vec![(format!("X-{}", token_name), "".to_string())],
        ));

        // 3. Tampered token
        let tampered = format!("tampered_{}", &valid_token[..valid_token.len().min(8)]);
        probes.push((
            CsrfProbeType::TamperedToken,
            format!("{} {} ({}='{}')", method, path, token_name, tampered),
            vec![(format!("X-{}", token_name), tampered)],
        ));

        // 4. Method conversion (POST -> GET)
        if method.to_uppercase() == "POST" {
            probes.push((
                CsrfProbeType::MethodConversion,
                format!("GET {}?{}={}", path, token_name, valid_token),
                vec![],
            ));
        }

        // 5. Origin spoofing
        probes.push((
            CsrfProbeType::OriginSpoofing,
            format!("{} {}", method, path),
            vec![("Origin".to_string(), attacker_origin.to_string())],
        ));

        // 6. Referer spoofing
        probes.push((
            CsrfProbeType::RefererSpoofing,
            format!("{} {}", method, path),
            vec![("Referer".to_string(), format!("{}/csrf_poc.html", attacker_origin))],
        ));

        probes
    }

    /// Evaluates anti-CSRF probe results and determines if the endpoint lacks robust protection
    pub fn evaluate_csrf_results(results: &[CsrfProbeResult]) -> CsrfEvaluationReport {
        let mut failed_defenses = Vec::new();
        let mut findings = Vec::new();

        for res in results {
            // A probe indicates vulnerability if the state-changing request was accepted (200/204/302)
            // or state was mutated despite the missing/tampered token or hostile Origin
            if res.is_vulnerable || res.state_changed || (res.http_status >= 200 && res.http_status < 400) {
                failed_defenses.push(res.probe_type.clone());
                findings.push(format!(
                    "CSRF Defense Bypass on {:?}: Server responded with status {} and state_changed={}.",
                    res.probe_type, res.http_status, res.state_changed
                ));
            }
        }

        let is_vulnerable = !failed_defenses.is_empty();

        CsrfEvaluationReport {
            is_vulnerable,
            failed_defenses,
            findings,
        }
    }
}

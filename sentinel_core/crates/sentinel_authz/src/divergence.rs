//! Privilege Divergence & BFLA / BOLA Detection Oracles.
//!
//! Uses structured JSON key-path Jaccard similarity, status code differential matrices,
//! and Shannon entropy masked bodies to classify authorization anomalies.

use crate::entropy::ShannonEntropyMasker;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PrivilegeRole {
    Admin,    // High privilege baseline (authorized resource owner)
    User,     // Low privilege member within same tenant context
    Attacker, // Cross-tenant user or alternate user
    Guest,    // Unauthenticated anonymous actor
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuthzVerdict {
    EnforcedDeny,        // 401/403/404 or custom error response safely rejected
    BflaEscalation,      // Low-privilege user accessed Admin endpoint (200 OK, high similarity)
    BolaIdorLeak,        // Attacker accessed another tenant/user object (200 OK, high similarity)
    UnauthenticatedLeak, // Anonymous actor accessed protected resource (200 OK)
    StructuralAnomaly,   // 200 OK but divergent schema / content
    Identical,           // Identical response across roles
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleResponseData {
    pub role: PrivilegeRole,
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

pub struct PrivilegeDivergenceOracle;

impl PrivilegeDivergenceOracle {
    /// Evaluates privilege differential between baseline (Admin/Owner) and a probe role (User/Attacker/Guest).
    pub fn evaluate_role_differential(
        baseline: &RoleResponseData,
        probe: &RoleResponseData,
    ) -> (AuthzVerdict, f64) {
        // 1. If probe returns standard deny status: safe
        if probe.status == 401 || probe.status == 403 || probe.status == 404 || probe.status == 405 {
            return (AuthzVerdict::EnforcedDeny, 0.0);
        }

        // 2. If baseline succeeded and probe also returned 200/201/204
        if (baseline.status >= 200 && baseline.status < 300) && (probe.status >= 200 && probe.status < 300) {
            // Mask volatile tokens (entropy >= 3.8) before similarity computation
            let (masked_base, _) = ShannonEntropyMasker::mask_volatile_json(&baseline.body, 3.8);
            let (masked_probe, _) = ShannonEntropyMasker::mask_volatile_json(&probe.body, 3.8);

            let sim = Self::calculate_structural_similarity(&masked_base, &masked_probe);

            // If response is an application-level custom error (e.g. {"error": "Unauthorized"}), sim will be low
            if sim < 0.40 {
                return (AuthzVerdict::EnforcedDeny, sim);
            }

            if sim >= 0.85 {
                let verdict = match probe.role {
                    PrivilegeRole::Admin => AuthzVerdict::Identical,
                    PrivilegeRole::User => AuthzVerdict::BflaEscalation,
                    PrivilegeRole::Attacker => AuthzVerdict::BolaIdorLeak,
                    PrivilegeRole::Guest => AuthzVerdict::UnauthenticatedLeak,
                };
                return (verdict, sim);
            } else {
                return (AuthzVerdict::StructuralAnomaly, sim);
            }
        }

        (AuthzVerdict::EnforcedDeny, 0.0)
    }

    /// Computes structural key-path Jaccard similarity between two JSON payloads.
    pub fn calculate_structural_similarity(json_a: &str, json_b: &str) -> f64 {
        if json_a == json_b {
            return 1.0;
        }

        let val_a: Result<serde_json::Value, _> = serde_json::from_str(json_a);
        let val_b: Result<serde_json::Value, _> = serde_json::from_str(json_b);

        if let (Ok(a), Ok(b)) = (val_a, val_b) {
            let mut keys_a = HashSet::new();
            let mut keys_b = HashSet::new();
            Self::collect_key_paths(&a, "", &mut keys_a);
            Self::collect_key_paths(&b, "", &mut keys_b);

            let intersection = keys_a.intersection(&keys_b).count();
            let union = keys_a.union(&keys_b).count();

            if union == 0 {
                1.0
            } else {
                (intersection as f64) / (union as f64)
            }
        } else {
            // String Levenshtein / byte delta similarity fallback
            let max_len = json_a.len().max(json_b.len()).max(1);
            let diff = (json_a.len() as isize - json_b.len() as isize).unsigned_abs();
            1.0 - (diff as f64 / max_len as f64)
        }
    }

    fn collect_key_paths(val: &serde_json::Value, prefix: &str, out: &mut HashSet<String>) {
        match val {
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    let path = if prefix.is_empty() {
                        k.clone()
                    } else {
                        format!("{}.{}", prefix, k)
                    };
                    out.insert(path.clone());
                    Self::collect_key_paths(v, &path, out);
                }
            }
            serde_json::Value::Array(arr) => {
                for (idx, item) in arr.iter().enumerate() {
                    let path = format!("{}[{}]", prefix, idx);
                    out.insert(path.clone());
                    Self::collect_key_paths(item, &path, out);
                }
            }
            _ => {}
        }
    }
}

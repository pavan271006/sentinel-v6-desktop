//! Differential Security Engine (SENTINEL Proprietary Engine 3)
//!
//! Provides multi-session, multi-role, and multi-state divergence analysis:
//! - Semantic response diffing (status delta, header variance, LCS body diff, JSON tree diff, DOM tag hierarchy, similarity ratio)
//! - Statistical timing analysis (Welch's t-test with Welch-Satterthwaite degrees of freedom, variance ratio)
//! - Privilege differential matrix classification (PermittedAccess / IDOR / BOLA, EnforcedDeny, StructuralAnomaly, TimingAnomaly)

use std::collections::{BTreeSet, HashMap, HashSet};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DifferentialClassification {
    Identical,
    PermittedAccess,     // IDOR / BOLA / BFLA vulnerability detected!
    EnforcedDeny,        // Properly blocked (401/403/Forbidden)
    StructuralAnomaly,   // Divergent schema/response structure
    TimingAnomaly,       // Statistically significant time delay (Blind flaw)
    Indeterminate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SemanticDiffResult {
    pub status_delta: (u16, u16),
    pub status_changed: bool,
    pub header_variance: HashMap<String, (Option<String>, Option<String>)>,
    pub lcs_similarity_ratio: f64,
    pub added_lines_count: usize,
    pub removed_lines_count: usize,
    pub unchanged_lines_count: usize,
    pub json_key_jaccard_similarity: Option<f64>,
    pub added_json_keys: Vec<String>,
    pub removed_json_keys: Vec<String>,
    pub modified_json_keys: Vec<String>,
    pub dom_tag_similarity: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StatisticalTimingResult {
    pub baseline_mean_ms: f64,
    pub probe_mean_ms: f64,
    pub baseline_variance: f64,
    pub probe_variance: f64,
    pub variance_ratio: f64,
    pub welch_t_stat: f64,
    pub degrees_of_freedom: f64,
    pub is_statistically_significant: bool,
    pub delay_delta_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DifferentialAnalysisResult {
    pub classification: DifferentialClassification,
    pub semantic_divergence_score: f64, // 0.0 (identical) to 1.0 (completely divergent)
    pub semantic_diff: SemanticDiffResult,
    pub timing_diff: Option<StatisticalTimingResult>,
    pub rationale: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PrivilegeRole {
    HighPrivilegeAdmin,
    LowPrivilegeUser,
    CrossTenantUser,
    UnauthenticatedGuest,
}

#[derive(Debug, Clone, Default)]
pub struct DifferentialEngine;

impl DifferentialEngine {
    pub fn new() -> Self {
        Self
    }

    /// Computes Longest Common Subsequence (LCS) line diff and similarity ratio.
    pub fn compute_lcs_diff(baseline: &str, probe: &str) -> (f64, usize, usize, usize) {
        let lines_a: Vec<&str> = baseline.lines().collect();
        let lines_b: Vec<&str> = probe.lines().collect();

        let n = lines_a.len();
        let m = lines_b.len();

        if n == 0 && m == 0 {
            return (1.0, 0, 0, 0);
        }
        if n == 0 {
            return (0.0, m, 0, 0);
        }
        if m == 0 {
            return (0.0, 0, n, 0);
        }

        let mut dp = vec![vec![0usize; m + 1]; n + 1];

        for i in 1..=n {
            for j in 1..=m {
                if lines_a[i - 1] == lines_b[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
                }
            }
        }

        let lcs_len = dp[n][m];
        let unchanged = lcs_len;
        let removed = n.saturating_sub(lcs_len);
        let added = m.saturating_sub(lcs_len);

        let similarity = (2.0 * unchanged as f64) / ((n + m) as f64);
        (similarity, added, removed, unchanged)
    }

    /// Recursively flattens JSON object into dot-notation key paths and stringified values.
    pub fn flatten_json_values(val: &serde_json::Value, prefix: &str, out: &mut HashMap<String, String>) {
        match val {
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    let new_prefix = if prefix.is_empty() {
                        k.clone()
                    } else {
                        format!("{}.{}", prefix, k)
                    };
                    Self::flatten_json_values(v, &new_prefix, out);
                }
            }
            serde_json::Value::Array(arr) => {
                for (i, v) in arr.iter().enumerate() {
                    let new_prefix = format!("{}[{}]", prefix, i);
                    Self::flatten_json_values(v, &new_prefix, out);
                }
            }
            _ => {
                out.insert(prefix.to_string(), val.to_string());
            }
        }
    }

    /// Computes JSON key/value tree diff and Jaccard key similarity.
    pub fn compute_json_diff(
        body_a: &str,
        body_b: &str,
    ) -> Option<(f64, Vec<String>, Vec<String>, Vec<String>)> {
        let json_a: serde_json::Value = serde_json::from_str(body_a).ok()?;
        let json_b: serde_json::Value = serde_json::from_str(body_b).ok()?;

        let mut map_a = HashMap::new();
        let mut map_b = HashMap::new();

        Self::flatten_json_values(&json_a, "", &mut map_a);
        Self::flatten_json_values(&json_b, "", &mut map_b);

        let keys_a: HashSet<String> = map_a.keys().cloned().collect();
        let keys_b: HashSet<String> = map_b.keys().cloned().collect();

        let intersection_count = keys_a.intersection(&keys_b).count();
        let union_count = keys_a.union(&keys_b).count();

        let jaccard = if union_count == 0 {
            1.0
        } else {
            intersection_count as f64 / union_count as f64
        };

        let mut added: Vec<String> = keys_b.difference(&keys_a).cloned().collect();
        let mut removed: Vec<String> = keys_a.difference(&keys_b).cloned().collect();
        let mut modified: Vec<String> = Vec::new();

        for common_key in keys_a.intersection(&keys_b) {
            if map_a.get(common_key) != map_b.get(common_key) {
                modified.push(common_key.clone());
            }
        }

        added.sort();
        removed.sort();
        modified.sort();

        Some((jaccard, added, removed, modified))
    }

    /// Extracts DOM / XML tag sequence and calculates Jaccard tag similarity.
    pub fn compute_dom_tag_similarity(body_a: &str, body_b: &str) -> Option<f64> {
        let extract_tags = |text: &str| -> Option<Vec<String>> {
            let re = regex::Regex::new(r"<([a-zA-Z0-9\-]+)[^>]*>").ok()?;
            let mut tags = Vec::new();
            for cap in re.captures_iter(text) {
                if let Some(tag_match) = cap.get(1) {
                    let tag_name = tag_match.as_str().to_ascii_lowercase();
                    if !tag_name.starts_with('/') && !tag_name.starts_with('!') {
                        tags.push(tag_name);
                    }
                }
            }
            Some(tags)
        };

        let tags_a = extract_tags(body_a)?;
        let tags_b = extract_tags(body_b)?;

        if tags_a.is_empty() && tags_b.is_empty() {
            return None;
        }

        let set_a: HashSet<String> = tags_a.into_iter().collect();
        let set_b: HashSet<String> = tags_b.into_iter().collect();

        let inter = set_a.intersection(&set_b).count();
        let un = set_a.union(&set_b).count();

        if un == 0 {
            Some(1.0)
        } else {
            Some(inter as f64 / un as f64)
        }
    }

    /// Computes Welch's t-test with Welch-Satterthwaite degrees of freedom for timing divergence.
    pub fn compute_welch_t_test(
        baseline_samples: &[f64],
        probe_samples: &[f64],
    ) -> Option<StatisticalTimingResult> {
        let n1 = baseline_samples.len() as f64;
        let n2 = probe_samples.len() as f64;

        if n1 < 2.0 || n2 < 2.0 {
            return None;
        }

        let mean1 = baseline_samples.iter().sum::<f64>() / n1;
        let mean2 = probe_samples.iter().sum::<f64>() / n2;

        let var1 = baseline_samples
            .iter()
            .map(|x| (x - mean1).powi(2))
            .sum::<f64>()
            / (n1 - 1.0);

        let var2 = probe_samples
            .iter()
            .map(|x| (x - mean2).powi(2))
            .sum::<f64>()
            / (n2 - 1.0);

        let v1_n = var1 / n1;
        let v2_n = var2 / n2;
        let denom = (v1_n + v2_n).sqrt();

        let (t_stat, df) = if denom < 1e-9 {
            (0.0, n1 + n2 - 2.0)
        } else {
            let t = (mean2 - mean1) / denom;
            let num_df = (v1_n + v2_n).powi(2);
            let den_df = (v1_n.powi(2) / (n1 - 1.0)) + (v2_n.powi(2) / (n2 - 1.0));
            let df_calc = if den_df < 1e-9 {
                n1 + n2 - 2.0
            } else {
                num_df / den_df
            };
            (t, df_calc)
        };

        let variance_ratio = if var1 > 1e-9 { var2 / var1 } else { 1.0 };
        let delay_delta = mean2 - mean1;

        // Statistical significance: t > 3.0 (approx p < 0.01) and delay_delta >= 1000ms
        let is_significant = t_stat > 3.0 && delay_delta >= 1000.0;

        Some(StatisticalTimingResult {
            baseline_mean_ms: mean1,
            probe_mean_ms: mean2,
            baseline_variance: var1,
            probe_variance: var2,
            variance_ratio,
            welch_t_stat: t_stat,
            degrees_of_freedom: df,
            is_statistically_significant: is_significant,
            delay_delta_ms: delay_delta,
        })
    }

    /// Evaluates semantic divergence between two HTTP responses (headers, status, body).
    pub fn evaluate_semantic_diff(
        status_a: u16,
        headers_a: &[(String, String)],
        body_a: &str,
        status_b: u16,
        headers_b: &[(String, String)],
        body_b: &str,
    ) -> SemanticDiffResult {
        let status_changed = status_a != status_b;

        // Extract sensitive headers for comparison
        let sensitive_headers = [
            "location",
            "set-cookie",
            "content-type",
            "access-control-allow-origin",
            "content-length",
            "www-authenticate",
        ];

        let map_headers = |hdrs: &[(String, String)]| -> HashMap<String, String> {
            let mut map = HashMap::new();
            for (k, v) in hdrs {
                map.insert(k.to_ascii_lowercase(), v.clone());
            }
            map
        };

        let map_a = map_headers(headers_a);
        let map_b = map_headers(headers_b);

        let mut header_variance = HashMap::new();
        let all_keys: BTreeSet<String> = sensitive_headers.iter().map(|s| s.to_string()).collect();

        for key in all_keys {
            let val_a = map_a.get(&key).cloned();
            let val_b = map_b.get(&key).cloned();
            if val_a != val_b && (val_a.is_some() || val_b.is_some()) {
                header_variance.insert(key, (val_a, val_b));
            }
        }

        let (lcs_sim, added, removed, unchanged) = Self::compute_lcs_diff(body_a, body_b);

        let json_diff = Self::compute_json_diff(body_a, body_b);
        let dom_sim = Self::compute_dom_tag_similarity(body_a, body_b);

        let (json_jaccard, added_keys, removed_keys, modified_keys) = match json_diff {
            Some((j, a, r, m)) => (Some(j), a, r, m),
            None => (None, Vec::new(), Vec::new(), Vec::new()),
        };

        SemanticDiffResult {
            status_delta: (status_a, status_b),
            status_changed,
            header_variance,
            lcs_similarity_ratio: lcs_sim,
            added_lines_count: added,
            removed_lines_count: removed,
            unchanged_lines_count: unchanged,
            json_key_jaccard_similarity: json_jaccard,
            added_json_keys: added_keys,
            removed_json_keys: removed_keys,
            modified_json_keys: modified_keys,
            dom_tag_similarity: dom_sim,
        }
    }

    /// Evaluates multi-session privilege differential (IRA+ Authorization Matrix).
    pub fn evaluate_privilege_differential(
        &self,
        baseline_role: PrivilegeRole,
        baseline_status: u16,
        baseline_body: &str,
        probe_role: PrivilegeRole,
        probe_status: u16,
        probe_body: &str,
        timing: Option<StatisticalTimingResult>,
    ) -> DifferentialAnalysisResult {
        let semantic_diff = Self::evaluate_semantic_diff(
            baseline_status,
            &[],
            baseline_body,
            probe_status,
            &[],
            probe_body,
        );

        let divergence_score = if semantic_diff.status_changed {
            1.0 - (0.5 * semantic_diff.lcs_similarity_ratio)
        } else {
            1.0 - semantic_diff.lcs_similarity_ratio
        };

        // Determine Classification
        let (classification, rationale) = if let Some(ref t) = timing {
            if t.is_statistically_significant {
                (
                    DifferentialClassification::TimingAnomaly,
                    format!("Confirmed statistical timing anomaly (Welch t={:.2}, delta={:.0}ms)", t.welch_t_stat, t.delay_delta_ms),
                )
            } else {
                self.classify_privilege_outcome(baseline_role, baseline_status, probe_role, probe_status, &semantic_diff)
            }
        } else {
            self.classify_privilege_outcome(baseline_role, baseline_status, probe_role, probe_status, &semantic_diff)
        };

        DifferentialAnalysisResult {
            classification,
            semantic_divergence_score: divergence_score,
            semantic_diff,
            timing_diff: timing,
            rationale,
        }
    }

    fn classify_privilege_outcome(
        &self,
        baseline_role: PrivilegeRole,
        baseline_status: u16,
        probe_role: PrivilegeRole,
        probe_status: u16,
        semantic: &SemanticDiffResult,
    ) -> (DifferentialClassification, String) {
        // If probe receives 401 Unauthorized or 403 Forbidden or 404 Not Found -> Enforced Deny
        if probe_status == 401 || probe_status == 403 || probe_status == 404 {
            return (
                DifferentialClassification::EnforcedDeny,
                format!("Access correctly denied with HTTP {}", probe_status),
            );
        }

        // If both baseline and probe receive 200 OK
        if baseline_status == 200 && probe_status == 200 {
            // Check if probe role was low privilege, cross-tenant, or unauthenticated
            match (baseline_role, probe_role) {
                (PrivilegeRole::HighPrivilegeAdmin, PrivilegeRole::LowPrivilegeUser) => {
                    if semantic.lcs_similarity_ratio > 0.80 || semantic.json_key_jaccard_similarity.unwrap_or(0.0) > 0.85 {
                        return (
                            DifferentialClassification::PermittedAccess,
                            "BFLA / Privilege Escalation: Low-privilege user successfully accessed Admin resource".to_string(),
                        );
                    }
                }
                (_, PrivilegeRole::CrossTenantUser) => {
                    if semantic.lcs_similarity_ratio > 0.80 || semantic.json_key_jaccard_similarity.unwrap_or(0.0) > 0.85 {
                        return (
                            DifferentialClassification::PermittedAccess,
                            "BOLA / IDOR: Cross-tenant user successfully accessed private object".to_string(),
                        );
                    }
                }
                (_, PrivilegeRole::UnauthenticatedGuest) => {
                    if semantic.lcs_similarity_ratio > 0.70 {
                        return (
                            DifferentialClassification::PermittedAccess,
                            "Unauthenticated Access: Protected resource exposed to anonymous guest".to_string(),
                        );
                    }
                }
                _ => {}
            }

            if semantic.lcs_similarity_ratio >= 0.999 {
                return (
                    DifferentialClassification::Identical,
                    "Responses are identical".to_string(),
                );
            } else {
                return (
                    DifferentialClassification::StructuralAnomaly,
                    format!("Responses share 200 status with structural divergence (sim={:.2})", semantic.lcs_similarity_ratio),
                );
            }
        }

        (
            DifferentialClassification::Indeterminate,
            format!("Status delta: {} -> {}", baseline_status, probe_status),
        )
    }
}

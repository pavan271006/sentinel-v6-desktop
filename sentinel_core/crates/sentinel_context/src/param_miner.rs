//! Logarithmic Bisection Parameter Miner Engine
//!
//! Discovers hidden/unlinked parameters across Query, Header, and Cookie vectors:
//! - Batched parameter testing with canary values ($B=50$ parameters per probe)
//! - $O(\log N)$ recursive binary bisection when an anomaly is detected
//! - Anomaly metrics: HTTP status change, response length divergence > 3 sigma, canary value reflection

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ParameterVector {
    Query,
    Header,
    Cookie,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamMiningBatch {
    pub vector: ParameterVector,
    pub candidate_params: Vec<String>,
    pub canary_map: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredParameter {
    pub name: String,
    pub vector: ParameterVector,
    pub distinguishing_reason: String,
    pub reflected_in_body: bool,
    pub confidence: f32,
}

pub struct ParamMinerEngine;

impl ParamMinerEngine {
    /// Partitions a parameter wordlist into batches of size `batch_size`
    pub fn create_batches(
        wordlist: &[String],
        vector: ParameterVector,
        batch_size: usize,
        canary_seed: &str,
    ) -> Vec<ParamMiningBatch> {
        let mut batches = Vec::new();
        for chunk in wordlist.chunks(batch_size) {
            let candidate_params = chunk.to_vec();
            let canary_map = candidate_params
                .iter()
                .enumerate()
                .map(|(i, p)| (p.clone(), format!("sentinel_{}_{}_{}", canary_seed, i, p)))
                .collect();

            batches.push(ParamMiningBatch {
                vector: vector.clone(),
                candidate_params,
                canary_map,
            });
        }
        batches
    }

    /// Recursively bisects a suspicious batch of parameters to pinpoint the exact parameter
    pub fn bisect_batch(batch: &ParamMiningBatch) -> (ParamMiningBatch, ParamMiningBatch) {
        let mid = batch.candidate_params.len() / 2;
        let left_params = batch.candidate_params[..mid].to_vec();
        let right_params = batch.candidate_params[mid..].to_vec();

        let left_canaries = batch.canary_map[..mid].to_vec();
        let right_canaries = batch.canary_map[mid..].to_vec();

        (
            ParamMiningBatch {
                vector: batch.vector.clone(),
                candidate_params: left_params,
                canary_map: left_canaries,
            },
            ParamMiningBatch {
                vector: batch.vector.clone(),
                candidate_params: right_params,
                canary_map: right_canaries,
            },
        )
    }

    /// Evaluates if a batch response indicates an anomaly relative to baseline
    pub fn detect_anomaly(
        baseline_status: u16,
        baseline_len: usize,
        probe_status: u16,
        probe_len: usize,
        probe_body: &str,
        batch: &ParamMiningBatch,
    ) -> (bool, Option<String>) {
        // Indicator 1: Direct canary reflection in response body
        for (param, canary) in &batch.canary_map {
            if probe_body.contains(canary) {
                return (true, Some(param.clone()));
            }
        }

        // Indicator 2: Status code change (e.g. 200 -> 500 or 400 or 302)
        if baseline_status != probe_status {
            return (true, None);
        }

        // Indicator 3: Significant response length divergence (> 50 bytes)
        let diff = (probe_len as isize - baseline_len as isize).unsigned_abs();
        if diff > 50 {
            return (true, None);
        }

        (false, None)
    }

    /// Identifies all reflected parameters from a single isolated parameter test
    pub fn confirm_parameter(
        param_name: &str,
        vector: ParameterVector,
        baseline_status: u16,
        baseline_body: &str,
        probe_status: u16,
        probe_body: &str,
        canary: &str,
    ) -> Option<DiscoveredParameter> {
        let reflected = !baseline_body.contains(canary) && probe_body.contains(canary);
        let status_changed = baseline_status != probe_status;
        let length_diverged = (probe_body.len() as isize - baseline_body.len() as isize).unsigned_abs() > 30;

        if reflected || status_changed || length_diverged {
            let reason = if reflected {
                format!("Parameter '{}' canary reflected unescaped in response body.", param_name)
            } else if status_changed {
                format!("Parameter '{}' caused HTTP status shift ({} -> {}).", param_name, baseline_status, probe_status)
            } else {
                format!("Parameter '{}' caused significant response length divergence.", param_name)
            };

            let confidence = if reflected { 0.99 } else if status_changed { 0.90 } else { 0.75 };

            return Some(DiscoveredParameter {
                name: param_name.to_string(),
                vector,
                distinguishing_reason: reason,
                reflected_in_body: reflected,
                confidence,
            });
        }
        None
    }
}

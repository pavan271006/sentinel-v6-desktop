//! SENTINEL Autonomous SQL Security Engine — Statistical Baseline & Masking (M07)
//!
//! Measures baseline response status, latency distribution, content length,
//! structural DOM fingerprints, and automatically masks dynamic tokens
//! (UUIDs, timestamps, CSRF nonces).

use std::collections::HashMap;
use regex::Regex;
use crate::sql::models::Blake3Id;

#[derive(Debug, Clone)]
pub struct BaselineSample {
    pub status: u16,
    pub latency_ms: f64,
    pub content_length: usize,
    pub body_hash: Blake3Id,
    pub masked_body_hash: Blake3Id,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct StatisticalBaseline {
    pub samples_count: usize,
    pub expected_status: u16,
    pub mean_latency_ms: f64,
    pub std_dev_latency_ms: f64,
    pub mean_content_length: usize,
    pub stable_body_hash: Blake3Id,
    pub stable_headers: HashMap<String, String>,
}

pub struct DynamicContentMasker;

impl DynamicContentMasker {
    /// Replaces dynamic artifacts (UUIDs, timestamps, session tokens) with stable placeholders
    pub fn mask_dynamic_content(raw_body: &str) -> String {
        let mut result = raw_body.to_string();

        // 1. Mask ISO-8601 timestamps
        let ts_re = Regex::new(r#"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b"#).unwrap();
        result = ts_re.replace_all(&result, "{{TIMESTAMP}}").to_string();

        // 2. Mask UUIDs
        let uuid_re = Regex::new(r#"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"#).unwrap();
        result = uuid_re.replace_all(&result, "{{UUID}}").to_string();

        // 3. Mask CSRF / Nonce hex tokens (>= 32 hex chars)
        let hex_nonce_re = Regex::new(r#"\b[0-9a-fA-F]{32,64}\b"#).unwrap();
        result = hex_nonce_re.replace_all(&result, "{{HEX_NONCE}}").to_string();

        // 4. Mask JSON timestamps and epoch milliseconds (10 to 13 digits)
        let epoch_re = Regex::new(r#"\b1[5-7]\d{8,11}\b"#).unwrap();
        result = epoch_re.replace_all(&result, "{{EPOCH_MS}}").to_string();

        result
    }
}

pub struct BaselineEngine;

impl BaselineEngine {
    /// Computes a statistical baseline profile from multiple baseline samples
    pub fn compute_baseline(samples: &[BaselineSample]) -> Result<StatisticalBaseline, String> {
        if samples.is_empty() {
            return Err("Cannot compute baseline from zero samples".to_string());
        }

        let count = samples.len();
        let expected_status = samples[0].status;

        let total_latency: f64 = samples.iter().map(|s| s.latency_ms).sum();
        let mean_latency_ms = total_latency / (count as f64);

        let variance: f64 = samples
            .iter()
            .map(|s| {
                let diff = s.latency_ms - mean_latency_ms;
                diff * diff
            })
            .sum::<f64>()
            / (count as f64);
        let std_dev_latency_ms = variance.sqrt();

        let total_len: usize = samples.iter().map(|s| s.content_length).sum();
        let mean_content_length = total_len / count;

        let stable_body_hash = samples[0].masked_body_hash;
        let mut stable_headers = samples[0].headers.clone();

        // Keep only headers that remain identical across all samples
        for s in samples.iter().skip(1) {
            stable_headers.retain(|k, v| s.headers.get(k) == Some(v));
        }

        Ok(StatisticalBaseline {
            samples_count: count,
            expected_status,
            mean_latency_ms,
            std_dev_latency_ms,
            mean_content_length,
            stable_body_hash,
            stable_headers,
        })
    }
}

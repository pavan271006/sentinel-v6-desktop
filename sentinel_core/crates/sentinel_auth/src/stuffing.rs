//! Credential Stuffing & Lockout Bypass Analyzer
//!
//! Detects account lockout thresholds, HTTP 429 rate limiting, Retry-After headers,
//! and tests for anti-automation bypass techniques (IP spoofing headers, case normalization,
//! whitespace padding, and null byte insertion).

use serde::{Deserialize, Serialize};

/// Individual probe response in a rate limit / lockout threshold sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockoutThresholdProbe {
    pub attempt_index: usize,
    pub response_status: u16,
    pub retry_after_sec: Option<u64>,
    pub is_locked_out: bool,
    pub error_message: String,
}

/// Vector used to bypass IP-based or format-based account lockout
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockoutBypassVector {
    pub vector_type: String,
    pub header_name: Option<String>,
    pub header_value: Option<String>,
    pub mutated_username: Option<String>,
    pub description: String,
}

pub struct LockoutAnalyzer;

impl LockoutAnalyzer {
    /// Detects if and at which attempt index lockout or rate limiting triggered
    pub fn detect_lockout_threshold(probes: &[LockoutThresholdProbe]) -> Option<usize> {
        for probe in probes {
            if probe.response_status == 429
                || probe.is_locked_out
                || probe.retry_after_sec.is_some()
                || probe.error_message.to_lowercase().contains("too many requests")
                || probe.error_message.to_lowercase().contains("account locked")
                || probe.error_message.to_lowercase().contains("rate limit exceeded")
            {
                return Some(probe.attempt_index);
            }
        }
        None
    }

    /// Generates IP-spoofing header bypass candidates
    pub fn generate_ip_bypass_headers(client_seed: u8) -> Vec<(String, String)> {
        let fake_ip = format!("198.51.100.{}", client_seed % 250 + 1);
        vec![
            ("X-Forwarded-For".to_string(), fake_ip.clone()),
            ("X-Originating-IP".to_string(), fake_ip.clone()),
            ("X-Real-IP".to_string(), fake_ip.clone()),
            ("X-Remote-IP".to_string(), fake_ip.clone()),
            ("Client-IP".to_string(), fake_ip.clone()),
            ("True-Client-IP".to_string(), fake_ip.clone()),
            ("X-Custom-IP-Authorization".to_string(), "127.0.0.1".to_string()),
        ]
    }

    /// Generates username mutation candidates to bypass case-sensitive username locks
    pub fn generate_username_variations(username: &str) -> Vec<String> {
        let mut variations = Vec::new();

        // 1. Uppercase
        variations.push(username.to_uppercase());

        // 2. Capitalized (if not already)
        let mut chars = username.chars();
        if let Some(first) = chars.next() {
            let cap = format!("{}{}", first.to_uppercase(), chars.as_str().to_lowercase());
            if cap != username && !variations.contains(&cap) {
                variations.push(cap);
            }
        }

        // 3. Trailing space
        variations.push(format!("{} ", username));

        // 4. Leading space
        variations.push(format!(" {}", username));

        // 5. Trailing tab
        variations.push(format!("{}\t", username));

        // 6. URL-encoded space
        variations.push(format!("{}%20", username));

        variations
    }

    /// Evaluates whether a bypass attempt succeeded when the baseline is locked
    pub fn evaluate_bypass_success(
        baseline_locked: &LockoutThresholdProbe,
        bypass_probe: &LockoutThresholdProbe,
    ) -> bool {
        // If baseline is locked (429 or locked message), but bypass probe returns 401 (invalid creds) or 200 (success)
        // rather than 429 / lockout message, the lockout mechanism is bypassed.
        if (baseline_locked.response_status == 429 || baseline_locked.is_locked_out)
            && (bypass_probe.response_status == 401 || bypass_probe.response_status == 200)
            && !bypass_probe.is_locked_out
            && bypass_probe.response_status != 429
        {
            return true;
        }
        false
    }
}

//! Username Enumeration Engine (Timing & Differential Heuristics)
//!
//! Evaluates timing variance across valid vs invalid username probes using
//! Welch's t-test for unequal variances, response length differentials,
//! and response body distinguishing signatures.

use serde::{Deserialize, Serialize};

/// Individual timing and response sample for username enumeration analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingSample {
    pub username: String,
    pub duration_ms: f64,
    pub response_status: u16,
    pub response_bytes: usize,
    pub response_body: String,
}

/// Analysis result for username enumeration testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumerationAnalysisResult {
    pub is_vulnerable: bool,
    pub confidence: f32,
    pub timing_divergence_p_value: f64,
    pub timing_difference_ms: f64,
    pub response_diff_identified: bool,
    pub distinguishing_indicator: String,
}

pub struct UsernameEnumerationEngine;

impl UsernameEnumerationEngine {
    /// Calculate sample mean
    pub fn mean(samples: &[f64]) -> f64 {
        if samples.is_empty() {
            return 0.0;
        }
        samples.iter().sum::<f64>() / samples.len() as f64
    }

    /// Calculate sample variance s^2 = sum((x - mean)^2) / (n - 1)
    pub fn variance(samples: &[f64], mean: f64) -> f64 {
        if samples.len() < 2 {
            return 0.0;
        }
        let sum_sq_diff: f64 = samples.iter().map(|&x| (x - mean).powi(2)).sum();
        sum_sq_diff / (samples.len() - 1) as f64
    }

    /// Compute Welch's t-test t-statistic between two cohorts
    pub fn welch_t_stat(
        mean1: f64,
        var1: f64,
        n1: usize,
        mean2: f64,
        var2: f64,
        n2: usize,
    ) -> (f64, f64) {
        if n1 < 2 || n2 < 2 {
            return (0.0, 1.0);
        }

        let s1_n = var1 / n1 as f64;
        let s2_n = var2 / n2 as f64;
        let denom = (s1_n + s2_n).sqrt();
        if denom < 1e-9 {
            return (0.0, 1.0);
        }

        let t_stat = (mean1 - mean2) / denom;

        // Welch-Satterthwaite degrees of freedom approximation
        let df_num = (s1_n + s2_n).powi(2);
        let df_denom = (s1_n.powi(2) / (n1 - 1) as f64) + (s2_n.powi(2) / (n2 - 1) as f64);
        let df = if df_denom > 1e-9 {
            df_num / df_denom
        } else {
            1.0
        };

        // Approximate two-tailed p-value from t-statistic and df
        let p_approx = Self::approximate_p_value(t_stat.abs(), df);

        (t_stat, p_approx)
    }

    /// Approximates p-value from t-statistic and degrees of freedom
    fn approximate_p_value(t: f64, _df: f64) -> f64 {
        // Standard normal / Student's t approximation for t >= 0
        if t > 6.0 {
            1e-7
        } else if t > 4.0 {
            0.0001
        } else if t > 3.291 {
            0.001
        } else if t > 2.576 {
            0.01
        } else if t > 1.960 {
            0.05
        } else if t > 1.645 {
            0.10
        } else {
            0.30
        }
    }

    /// Analyzes cohort of valid username samples vs invalid username samples
    pub fn analyze_timing_samples(
        valid_samples: &[TimingSample],
        invalid_samples: &[TimingSample],
    ) -> EnumerationAnalysisResult {
        if valid_samples.is_empty() || invalid_samples.is_empty() {
            return EnumerationAnalysisResult {
                is_vulnerable: false,
                confidence: 0.0,
                timing_divergence_p_value: 1.0,
                timing_difference_ms: 0.0,
                response_diff_identified: false,
                distinguishing_indicator: "Insufficient samples".to_string(),
            };
        }

        let valid_durations: Vec<f64> = valid_samples.iter().map(|s| s.duration_ms).collect();
        let invalid_durations: Vec<f64> = invalid_samples.iter().map(|s| s.duration_ms).collect();

        let mean_valid = Self::mean(&valid_durations);
        let mean_invalid = Self::mean(&invalid_durations);

        let var_valid = Self::variance(&valid_durations, mean_valid);
        let var_invalid = Self::variance(&invalid_durations, mean_invalid);

        let (t_stat, p_val) = Self::welch_t_stat(
            mean_valid,
            var_valid,
            valid_durations.len(),
            mean_invalid,
            var_invalid,
            invalid_durations.len(),
        );

        let delta_timing = (mean_valid - mean_invalid).abs();

        // Check for response body / status code differentials
        let mut response_diff_identified = false;
        let mut indicator = String::new();

        let valid_statuses: Vec<u16> = valid_samples.iter().map(|s| s.response_status).collect();
        let invalid_statuses: Vec<u16> = invalid_samples.iter().map(|s| s.response_status).collect();

        if valid_statuses.iter().all(|&s| s == valid_statuses[0])
            && invalid_statuses.iter().all(|&s| s == invalid_statuses[0])
            && valid_statuses[0] != invalid_statuses[0]
        {
            response_diff_identified = true;
            indicator = format!(
                "HTTP Status Code Differential: Valid {} vs Invalid {}",
                valid_statuses[0], invalid_statuses[0]
            );
        } else {
            // Check for body error signature divergence (e.g. "User not found" vs "Invalid password")
            let valid_body = &valid_samples[0].response_body;
            let invalid_body = &invalid_samples[0].response_body;
            if valid_body != invalid_body {
                let user_not_found = invalid_body.to_lowercase().contains("user not found")
                    || invalid_body.to_lowercase().contains("unknown user")
                    || invalid_body.to_lowercase().contains("does not exist");
                let invalid_pwd = valid_body.to_lowercase().contains("invalid password")
                    || valid_body.to_lowercase().contains("incorrect password")
                    || valid_body.to_lowercase().contains("wrong password");

                if user_not_found || invalid_pwd {
                    response_diff_identified = true;
                    indicator = "Error message differential: Valid vs Invalid user error text divergence".to_string();
                }
            }
        }

        // Timing vulnerability threshold: |t| >= 2.576 (p <= 0.01) and delta >= 20ms
        let timing_vulnerable = t_stat.abs() >= 2.576 && delta_timing >= 20.0;

        let is_vulnerable = timing_vulnerable || response_diff_identified;

        let confidence = if timing_vulnerable && response_diff_identified {
            0.98
        } else if response_diff_identified {
            0.92
        } else if timing_vulnerable {
            0.85
        } else {
            0.10
        };

        if indicator.is_empty() && timing_vulnerable {
            indicator = format!(
                "Statistically significant timing divergence: Delta = {:.2}ms (t = {:.2}, p = {:.4})",
                delta_timing, t_stat, p_val
            );
        } else if indicator.is_empty() {
            indicator = "No significant timing or response differential observed".to_string();
        }

        EnumerationAnalysisResult {
            is_vulnerable,
            confidence,
            timing_divergence_p_value: p_val,
            timing_difference_ms: delta_timing,
            response_diff_identified,
            distinguishing_indicator: indicator,
        }
    }
}

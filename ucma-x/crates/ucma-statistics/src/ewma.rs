//! Exponentially Weighted Moving Average (EWMA) and Cumulative Sum (CUSUM) control charts.

use serde::{Deserialize, Serialize};

/// EWMA state tracker for moving average and variance estimation under latency drift.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EwmaTracker {
    pub alpha: f64,
    pub current_mean: Option<f64>,
    pub current_var: Option<f64>,
}

impl Default for EwmaTracker {
    fn default() -> Self {
        Self {
            alpha: 0.2,
            current_mean: None,
            current_var: None,
        }
    }
}

impl EwmaTracker {
    pub fn new(alpha: f64) -> Self {
        assert!((0.0..=1.0).contains(&alpha), "alpha must be in (0, 1]");
        Self {
            alpha,
            current_mean: None,
            current_var: None,
        }
    }

    pub fn update(&mut self, sample: f64) -> (f64, f64) {
        match (self.current_mean, self.current_var) {
            (None, _) => {
                self.current_mean = Some(sample);
                self.current_var = Some(0.0);
                (sample, 0.0)
            }
            (Some(prev_mean), Some(prev_var)) => {
                let diff = sample - prev_mean;
                let new_mean = prev_mean + self.alpha * diff;
                let new_var = (1.0 - self.alpha) * (prev_var + self.alpha * diff * diff);
                self.current_mean = Some(new_mean);
                self.current_var = Some(new_var);
                (new_mean, new_var.sqrt())
            }
            _ => (sample, 0.0),
        }
    }
}

/// CUSUM change detector for identifying step-change latency anomalies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CusumDetector {
    pub target_mean: f64,
    pub allowance_k: f64,
    pub threshold_h: f64,
    pub s_pos: f64,
    pub s_neg: f64,
}

impl CusumDetector {
    pub fn new(target_mean: f64, allowance_k: f64, threshold_h: f64) -> Self {
        Self {
            target_mean,
            allowance_k,
            threshold_h,
            s_pos: 0.0,
            s_neg: 0.0,
        }
    }

    pub fn update(&mut self, sample: f64) -> bool {
        self.s_pos = (self.s_pos + sample - self.target_mean - self.allowance_k).max(0.0);
        self.s_neg = (self.s_neg - sample + self.target_mean - self.allowance_k).max(0.0);
        self.s_pos > self.threshold_h
    }
}

//! SENTINEL Autonomous SQL Security Engine — Blind Inference Subsystem (M23)
//!
//! Implements Wald SPRT sequential probability ratio testing, binary bisection,
//! bitwise extraction, and adaptive dictionary searches.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SprtDecision {
    AcceptH1Vulnerable,
    AcceptH0NotVulnerable,
    ContinueSampling,
}

/// Wald Sequential Probability Ratio Test (SPRT)
pub struct WaldSprt {
    alpha: f64,
    beta: f64,
    h0_mean: f64,
    h1_mean: f64,
    variance: f64,
    log_a: f64,
    log_b: f64,
    cumulative_llr: f64,
    samples_count: usize,
}

impl WaldSprt {
    pub fn new(alpha: f64, beta: f64, h0_mean: f64, h1_mean: f64, std_dev: f64) -> Self {
        let var = (std_dev * std_dev).max(0.001);
        let log_a = ((1.0 - beta) / alpha).ln();
        let log_b = (beta / (1.0 - alpha)).ln();

        Self {
            alpha,
            beta,
            h0_mean,
            h1_mean,
            variance: var,
            log_a,
            log_b,
            cumulative_llr: 0.0,
            samples_count: 0,
        }
    }

    /// Default SPRT calibrated for network latency delay detection
    pub fn default_latency_test(baseline_mean_ms: f64, expected_delay_ms: f64, baseline_std_dev: f64) -> Self {
        Self::new(
            0.01,
            0.01,
            baseline_mean_ms,
            baseline_mean_ms + expected_delay_ms,
            baseline_std_dev.max(50.0),
        )
    }

    /// Adds a latency observation sample and evaluates stopping bounds
    pub fn observe_sample(&mut self, sample_ms: f64) -> SprtDecision {
        self.samples_count += 1;
        // Gaussian Log-Likelihood Ratio step
        let diff0 = sample_ms - self.h0_mean;
        let diff1 = sample_ms - self.h1_mean;
        let step_llr = (diff0 * diff0 - diff1 * diff1) / (2.0 * self.variance);

        self.cumulative_llr += step_llr;

        if self.cumulative_llr >= self.log_a {
            SprtDecision::AcceptH1Vulnerable
        } else if self.cumulative_llr <= self.log_b {
            SprtDecision::AcceptH0NotVulnerable
        } else if self.samples_count >= 10 {
            // Safety bound to avoid infinite sampling
            if self.cumulative_llr > 0.0 {
                SprtDecision::AcceptH1Vulnerable
            } else {
                SprtDecision::AcceptH0NotVulnerable
            }
        } else {
            SprtDecision::ContinueSampling
        }
    }

    pub fn current_llr(&self) -> f64 {
        self.cumulative_llr
    }
}

/// Binary search bisection for character extraction
pub struct BinarySearchExtractor {
    low: u32,
    high: u32,
}

impl BinarySearchExtractor {
    pub fn new(min_ascii: u32, max_ascii: u32) -> Self {
        Self { low: min_ascii, high: max_ascii }
    }

    pub fn default_ascii() -> Self {
        Self::new(32, 126)
    }

    pub fn next_probe_midpoint(&self) -> Option<u32> {
        if self.low >= self.high {
            None
        } else {
            Some((self.low + self.high) / 2)
        }
    }

    pub fn record_result(&mut self, is_greater: bool) -> Option<char> {
        if let Some(mid) = self.next_probe_midpoint() {
            if is_greater {
                self.low = mid + 1;
            } else {
                self.high = mid;
            }
        }

        if self.low >= self.high {
            char::from_u32(self.low)
        } else {
            None
        }
    }
}

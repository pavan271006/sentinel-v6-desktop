//! Wald's Sequential Probability Ratio Test (SPRT).
//! Enables sequential hypothesis testing with strict false-positive (alpha) and false-negative (beta) bounds.

use serde::{Deserialize, Serialize};

/// Decision outcome of an SPRT sequential evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SprtDecision {
    /// Accept alternative hypothesis H1 (e.g. vulnerable / anomalous delay).
    AcceptH1,
    /// Accept null hypothesis H0 (e.g. safe / non-injected baseline).
    AcceptH0,
    /// Insufficient evidence to decide; continue sampling.
    ContinueSampling,
}

/// Configuration parameters for SPRT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprtConfig {
    /// Type I error rate (False Positive probability target, e.g. 0.01).
    pub alpha: f64,
    /// Type II error rate (False Negative probability target, e.g. 0.01).
    pub beta: f64,
    /// Expected value under H0 (null hypothesis parameter).
    pub h0_param: f64,
    /// Expected value under H1 (alternative hypothesis parameter).
    pub h1_param: f64,
    /// Assumed standard deviation for normal observation model.
    pub sigma: f64,
}

impl Default for SprtConfig {
    fn default() -> Self {
        Self {
            alpha: 0.01,
            beta: 0.01,
            h0_param: 0.0,
            h1_param: 5.0, // e.g. 5-second delay injection
            sigma: 0.5,
        }
    }
}

/// SPRT state accumulator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprtAccumulator {
    config: SprtConfig,
    log_likelihood_ratio: f64,
    upper_bound: f64, // B = ln((1 - beta) / alpha)
    lower_bound: f64, // A = ln(beta / (1 - alpha))
    sample_count: usize,
}

impl SprtAccumulator {
    /// Creates a new SPRT accumulator with defined bounds.
    pub fn new(config: SprtConfig) -> Self {
        let upper_bound = ((1.0 - config.beta) / config.alpha).ln();
        let lower_bound = (config.beta / (1.0 - config.alpha)).ln();

        Self {
            config,
            log_likelihood_ratio: 0.0,
            upper_bound,
            lower_bound,
            sample_count: 0,
        }
    }

    /// Observes a new sample value and updates the log-likelihood ratio.
    pub fn step(&mut self, sample: f64) -> SprtDecision {
        self.sample_count += 1;

        // For normal distribution: LLR step = (h1 - h0) / sigma^2 * (x - (h0 + h1)/2)
        let s2 = self.config.sigma * self.config.sigma;
        let delta = self.config.h1_param - self.config.h0_param;
        let midpoint = (self.config.h0_param + self.config.h1_param) / 2.0;
        let step_llr = (delta / s2) * (sample - midpoint);

        self.log_likelihood_ratio += step_llr;

        if self.log_likelihood_ratio >= self.upper_bound {
            SprtDecision::AcceptH1
        } else if self.log_likelihood_ratio <= self.lower_bound {
            SprtDecision::AcceptH0
        } else {
            SprtDecision::ContinueSampling
        }
    }

    pub fn log_likelihood_ratio(&self) -> f64 {
        self.log_likelihood_ratio
    }

    pub fn sample_count(&self) -> usize {
        self.sample_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sprt_accept_h1_on_consistent_delays() {
        let config = SprtConfig {
            alpha: 0.01,
            beta: 0.01,
            h0_param: 0.1,
            h1_param: 3.0,
            sigma: 0.5,
        };
        let mut sprt = SprtAccumulator::new(config);

        // Feed 3.0-second delay observations
        let mut decision = SprtDecision::ContinueSampling;
        for _ in 0..5 {
            decision = sprt.step(3.1);
            if decision != SprtDecision::ContinueSampling {
                break;
            }
        }
        assert_eq!(decision, SprtDecision::AcceptH1);
        assert!(sprt.sample_count() <= 3); // Decides very quickly
    }

    #[test]
    fn test_sprt_accept_h0_on_baseline_timings() {
        let config = SprtConfig {
            alpha: 0.01,
            beta: 0.01,
            h0_param: 0.1,
            h1_param: 3.0,
            sigma: 0.5,
        };
        let mut sprt = SprtAccumulator::new(config);

        let mut decision = SprtDecision::ContinueSampling;
        for _ in 0..5 {
            decision = sprt.step(0.12);
            if decision != SprtDecision::ContinueSampling {
                break;
            }
        }
        assert_eq!(decision, SprtDecision::AcceptH0);
    }
}

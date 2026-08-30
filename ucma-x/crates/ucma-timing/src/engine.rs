//! Statistical timing analyzer and sequential test executor.

use crate::baseline::LatencyBaseline;
use crate::evidence::TimingEvidence;
use ucma_statistics::{mann_whitney_u_test, SampleSummary, SprtAccumulator, SprtConfig, SprtDecision};

/// Timing validation engine.
pub struct TimingEngine {
    pub alpha: f64,
    pub beta: f64,
    pub max_samples: usize,
}

impl Default for TimingEngine {
    fn default() -> Self {
        Self {
            alpha: 0.01,
            beta: 0.01,
            max_samples: 10,
        }
    }
}

impl TimingEngine {
    pub fn new(alpha: f64, beta: f64, max_samples: usize) -> Self {
        Self {
            alpha,
            beta,
            max_samples,
        }
    }

    /// Evaluates a sequence of observed control vs probe latency pairs.
    pub fn evaluate_pair_sequence(
        &self,
        baseline: &LatencyBaseline,
        probe_samples: &[f64],
        control_samples: &[f64],
        expected_delay: f64,
    ) -> Option<TimingEvidence> {
        if probe_samples.is_empty() || control_samples.is_empty() {
            return None;
        }

        let probe_summary = SampleSummary::compute(probe_samples)?;
        let control_summary = SampleSummary::compute(control_samples)?;

        // Configure SPRT for expected delay
        let sprt_config = SprtConfig {
            alpha: self.alpha,
            beta: self.beta,
            h0_param: baseline.summary.median,
            h1_param: baseline.summary.median + expected_delay,
            sigma: baseline.summary.mad.max(0.20),
        };

        let mut sprt = SprtAccumulator::new(sprt_config);
        let mut final_sprt_decision = SprtDecision::ContinueSampling;

        for &p in probe_samples {
            final_sprt_decision = sprt.step(p);
            if final_sprt_decision != SprtDecision::ContinueSampling {
                break;
            }
        }

        // Run non-parametric Mann-Whitney test
        let mann_whitney = mann_whitney_u_test(control_samples, probe_samples, self.alpha);

        let observed_effect = probe_summary.median - control_summary.median;

        let is_confirmed = (final_sprt_decision == SprtDecision::AcceptH1
            || mann_whitney.as_ref().map(|mw| mw.is_significant).unwrap_or(false))
            && observed_effect >= (expected_delay * 0.65);

        Some(TimingEvidence {
            baseline_summary: baseline.summary.clone(),
            probe_summary,
            control_samples: control_samples.to_vec(),
            probe_samples: probe_samples.to_vec(),
            sprt_decision: final_sprt_decision,
            sprt_llr: sprt.log_likelihood_ratio(),
            mann_whitney,
            expected_delay_seconds: expected_delay,
            observed_effect_seconds: observed_effect,
            is_confirmed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timing_engine_confirms_clear_delay() {
        let baseline = LatencyBaseline::build(vec![0.10, 0.12, 0.09, 0.11, 0.10]).unwrap();
        let controls = vec![0.11, 0.10, 0.12, 0.09];
        let probes = vec![5.12, 5.08, 5.15, 5.05];

        let engine = TimingEngine::default();
        let evidence = engine.evaluate_pair_sequence(&baseline, &probes, &controls, 5.0).unwrap();

        assert!(evidence.is_confirmed);
        assert_eq!(evidence.sprt_decision, SprtDecision::AcceptH1);
        assert!(evidence.observed_effect_seconds >= 4.5);
    }

    #[test]
    fn test_timing_engine_rejects_negative_control() {
        let baseline = LatencyBaseline::build(vec![0.10, 0.12, 0.09, 0.11, 0.10]).unwrap();
        let controls = vec![0.11, 0.10, 0.12, 0.09];
        let probes = vec![0.12, 0.10, 0.11, 0.13];

        let engine = TimingEngine::default();
        let evidence = engine.evaluate_pair_sequence(&baseline, &probes, &controls, 5.0).unwrap();

        assert!(!evidence.is_confirmed);
        assert_eq!(evidence.sprt_decision, SprtDecision::AcceptH0);
    }
}

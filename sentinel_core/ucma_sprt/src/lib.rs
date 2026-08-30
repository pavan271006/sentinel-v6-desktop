#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SprtVerdict {
    VulnerableConfirmed,
    SafeConfirmed,
    ContinueSampling,
}

#[derive(Debug, Clone)]
pub struct WaldSprtEngine {
    pub alpha: f64,
    pub beta: f64,
    pub delay_tau_ms: f64,
    pub upper_boundary_a: f64,
    pub lower_boundary_b: f64,
    pub cumulative_llr: f64,
    pub sample_count: usize,
}

impl WaldSprtEngine {
    pub fn new(alpha: f64, beta: f64, delay_tau_ms: f64) -> Self {
        assert!(alpha > 0.0 && alpha < 0.5, "Alpha must be in (0, 0.5)");
        assert!(beta > 0.0 && beta < 0.5, "Beta must be in (0, 0.5)");
        assert!(delay_tau_ms > 50.0, "Delay tau must be > 50ms");

        let upper_boundary_a = ((1.0 - beta) / alpha).ln();
        let lower_boundary_b = (beta / (1.0 - alpha)).ln();

        Self {
            alpha,
            beta,
            delay_tau_ms,
            upper_boundary_a,
            lower_boundary_b,
            cumulative_llr: 0.0,
            sample_count: 0,
        }
    }

    pub fn update(&mut self, observed_delta_ms: f64, baseline_sigma_ms: f64) -> SprtVerdict {
        let sigma2 = (baseline_sigma_ms.max(10.0)).powi(2);
        let tau = self.delay_tau_ms;

        // Log-likelihood ratio for Normal distributions under equal variance
        let llr_step = (tau / sigma2) * (observed_delta_ms - (tau / 2.0));
        self.cumulative_llr += llr_step;
        self.sample_count += 1;

        if self.cumulative_llr >= self.upper_boundary_a {
            SprtVerdict::VulnerableConfirmed
        } else if self.cumulative_llr <= self.lower_boundary_b {
            SprtVerdict::SafeConfirmed
        } else {
            SprtVerdict::ContinueSampling
        }
    }

    pub fn reset(&mut self) {
        self.cumulative_llr = 0.0;
        self.sample_count = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Random generator stub using simple LCG for testing jitter
    struct Lcg {
        state: u64,
    }
    impl Lcg {
        fn new(seed: u64) -> Self { Self { state: seed } }
        fn next(&mut self) -> u64 {
            self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1);
            self.state
        }
        fn next_f64(&mut self) -> f64 {
            (self.next() as f64) / (u64::MAX as f64)
        }
        fn next_normal(&mut self) -> f64 {
            // Box-Muller transform
            let u1 = self.next_f64().max(1e-10);
            let u2 = self.next_f64();
            (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
        }
    }

    #[test]
    fn test_sprt_true_positive() {
        let mut fns = 0;
        let mut total_asn = 0;
        let trials = 1000;
        let tau = 300.0;
        let sigma = 40.0;
        
        let mut rng = Lcg::new(12345);

        for _ in 0..trials {
            let mut engine = WaldSprtEngine::new(0.01, 0.01, tau);
            let mut verdict = SprtVerdict::ContinueSampling;
            for _ in 0..20 {
                let jitter = rng.next_normal() * sigma;
                let observed = tau + jitter; // True delay of tau
                verdict = engine.update(observed, sigma);
                if verdict != SprtVerdict::ContinueSampling {
                    break;
                }
            }
            total_asn += engine.sample_count;
            if verdict == SprtVerdict::SafeConfirmed {
                fns += 1;
            }
            assert_eq!(verdict, SprtVerdict::VulnerableConfirmed);
            assert!(engine.sample_count <= 5);
        }
        assert_eq!(fns, 0, "Zero false negatives required");
    }

    #[test]
    fn test_sprt_true_negative() {
        let mut fps = 0;
        let mut total_asn = 0;
        let trials = 1000;
        let tau = 300.0;
        let sigma = 40.0;

        let mut rng = Lcg::new(67890);

        for _ in 0..trials {
            let mut engine = WaldSprtEngine::new(0.01, 0.01, tau);
            let mut verdict = SprtVerdict::ContinueSampling;
            for _ in 0..20 {
                let jitter = rng.next_normal() * sigma;
                let observed = 0.0 + jitter; // True delay of 0
                verdict = engine.update(observed, sigma);
                if verdict != SprtVerdict::ContinueSampling {
                    break;
                }
            }
            total_asn += engine.sample_count;
            if verdict == SprtVerdict::VulnerableConfirmed {
                fps += 1;
            }
            assert_eq!(verdict, SprtVerdict::SafeConfirmed);
            assert!(engine.sample_count <= 4);
        }
        assert_eq!(fps, 0, "Zero false positives required");
    }

    #[test]
    fn test_sprt_jitter_spike() {
        let tau = 300.0;
        let sigma = 40.0;
        let mut engine = WaldSprtEngine::new(0.01, 0.01, tau);
        
        // Baseline is safe, inject a single 500ms spike
        let verdict1 = engine.update(10.0, sigma);
        assert_eq!(verdict1, SprtVerdict::ContinueSampling);
        
        let verdict2 = engine.update(500.0, sigma); // Spike
        assert!(verdict2 != SprtVerdict::VulnerableConfirmed, "Spike must not trigger instant false alarm");
        
        let verdict3 = engine.update(5.0, sigma);
        let verdict4 = engine.update(-10.0, sigma);
        let verdict5 = engine.update(2.0, sigma);
        
        // Eventually it should be marked as safe despite the single spike
        assert!(engine.cumulative_llr < engine.upper_boundary_a);
    }
}

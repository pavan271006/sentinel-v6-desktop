//! Poisson-distributed adaptive request jitter engine for WAF behavioral evasion.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Simple, lock-free XorShift64 pseudo-random number generator.
#[derive(Debug)]
pub struct FastRng {
    state: AtomicU64,
}

impl FastRng {
    pub fn new(seed: u64) -> Self {
        let seed = if seed == 0 { 0x853c49e6748fea9b } else { seed };
        Self {
            state: AtomicU64::new(seed),
        }
    }

    pub fn next_u64(&self) -> u64 {
        let mut x = self.state.load(Ordering::Relaxed);
        loop {
            let mut next = x;
            next ^= next << 13;
            next ^= next >> 7;
            next ^= next << 17;
            match self.state.compare_exchange_weak(
                x,
                next,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => return next,
                Err(actual) => x = actual,
            }
        }
    }

    /// Generates a float in (0.0, 1.0].
    pub fn next_f64(&self) -> f64 {
        let val = (self.next_u64() >> 11) + 1;
        val as f64 / (1u64 << 53) as f64
    }
}

impl Default for FastRng {
    fn default() -> Self {
        let seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0xdeadbeefcafebabe);
        Self::new(seed)
    }
}

/// Adaptive request jitter engine sampling inter-request delays from a Poisson arrival process.
/// In a Poisson process, inter-arrival times are Exponentially distributed:
///   delay = - mean_delay_ms * ln(U)
#[derive(Debug)]
pub struct PoissonJitterEngine {
    mean_delay_ms: f64,
    min_delay_ms: u64,
    max_delay_ms: u64,
    rng: FastRng,
}

impl PoissonJitterEngine {
    pub fn new(mean_delay_ms: f64, min_delay_ms: u64, max_delay_ms: u64) -> Self {
        Self {
            mean_delay_ms,
            min_delay_ms,
            max_delay_ms,
            rng: FastRng::default(),
        }
    }

    /// Zero jitter (for high-speed benchmarks).
    pub fn zero() -> Self {
        Self::new(0.0, 0, 0)
    }

    /// Standard human-like profile (mean 120ms, bounded [20ms, 500ms]).
    pub fn human_like() -> Self {
        Self::new(120.0, 20, 500)
    }

    /// Low-jitter stealth profile (mean 350ms, bounded [100ms, 1200ms]).
    pub fn stealth() -> Self {
        Self::new(350.0, 100, 1200)
    }

    /// Computes the next randomized delay duration.
    pub fn sample_delay(&self) -> Duration {
        if self.mean_delay_ms <= 0.0 || self.max_delay_ms == 0 {
            return Duration::ZERO;
        }

        let u = self.rng.next_f64().clamp(1e-9, 1.0);
        // Inverse transform sampling for Exponential distribution: t = -mu * ln(U)
        let raw_delay = -self.mean_delay_ms * u.ln();
        let delay_ms = (raw_delay as u64).clamp(self.min_delay_ms, self.max_delay_ms);

        Duration::from_millis(delay_ms)
    }

    /// Asynchronously pauses current task for the sampled Poisson delay.
    pub async fn apply_jitter(&self) {
        let delay = self.sample_delay();
        if !delay.is_zero() {
            tokio::time::sleep(delay).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zero_jitter() {
        let jitter = PoissonJitterEngine::zero();
        assert_eq!(jitter.sample_delay(), Duration::ZERO);
    }

    #[test]
    fn test_jitter_bounds() {
        let jitter = PoissonJitterEngine::new(100.0, 30, 250);
        for _ in 0..100 {
            let delay = jitter.sample_delay();
            assert!(delay >= Duration::from_millis(30));
            assert!(delay <= Duration::from_millis(250));
        }
    }
}

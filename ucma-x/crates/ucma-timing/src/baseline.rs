//! Latency baseline distribution model for a target endpoint.

use serde::{Deserialize, Serialize};
use ucma_statistics::{EwmaTracker, SampleSummary};

/// Represents the established timing profile of an endpoint under control requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyBaseline {
    pub samples: Vec<f64>,
    pub summary: SampleSummary,
    pub jitter_mad: f64,
    pub is_stable: bool,
    #[serde(skip)]
    pub ewma: EwmaTracker,
}

impl LatencyBaseline {
    /// Builds a baseline timing profile from a set of control latency observations (in seconds).
    pub fn build(samples: Vec<f64>) -> Option<Self> {
        let summary = SampleSummary::compute(&samples)?;
        let jitter_mad = summary.mad;
        
        // Target is considered stable if jitter (MAD) is less than 50% of the median latency
        // or under 0.25 seconds absolute.
        let is_stable = jitter_mad < (0.50 * summary.median).max(0.25);

        Some(Self {
            samples,
            summary,
            jitter_mad,
            is_stable,
            ewma: EwmaTracker::new(0.2),
        })
    }

    /// Tests if an observed probe latency is statistically anomalous relative to this baseline.
    pub fn is_delay_anomalous(&self, probe_seconds: f64, expected_delay_seconds: f64) -> bool {
        let threshold = self.summary.median + (expected_delay_seconds * 0.70);
        probe_seconds >= threshold
    }
}

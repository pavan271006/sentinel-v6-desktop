//! Robust sample statistics and distribution modeling.

use serde::{Deserialize, Serialize};

/// Summary metrics computed from raw numerical observations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SampleSummary {
    pub count: usize,
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub variance: f64,
    pub std_dev: f64,
    pub median: f64,
    pub iqr: f64,
    pub mad: f64,
}

impl SampleSummary {
    /// Computes robust descriptive statistics for a non-empty slice of samples.
    pub fn compute(samples: &[f64]) -> Option<Self> {
        if samples.is_empty() {
            return None;
        }

        let count = samples.len();
        let mut sorted = samples.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let min = sorted[0];
        let max = sorted[count - 1];

        let sum: f64 = sorted.iter().sum();
        let mean = sum / (count as f64);

        let variance = if count > 1 {
            let sq_diff: f64 = sorted.iter().map(|&x| (x - mean).powi(2)).sum();
            sq_diff / ((count - 1) as f64)
        } else {
            0.0
        };
        let std_dev = variance.sqrt();

        let median = percentile_sorted(&sorted, 50.0);
        let q25 = percentile_sorted(&sorted, 25.0);
        let q75 = percentile_sorted(&sorted, 75.0);
        let iqr = q75 - q25;

        // Median Absolute Deviation (MAD)
        let mut abs_devs: Vec<f64> = sorted.iter().map(|&x| (x - median).abs()).collect();
        abs_devs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let mad = percentile_sorted(&abs_devs, 50.0);

        Some(Self {
            count,
            min,
            max,
            mean,
            variance,
            std_dev,
            median,
            iqr,
            mad,
        })
    }
}

fn percentile_sorted(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    if sorted.len() == 1 {
        return sorted[0];
    }
    let rank = (p / 100.0) * ((sorted.len() - 1) as f64);
    let lower_idx = rank.floor() as usize;
    let upper_idx = rank.ceil() as usize;
    let weight = rank - (lower_idx as f64);

    sorted[lower_idx] * (1.0 - weight) + sorted[upper_idx] * weight
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_summary_metrics() {
        let data = vec![100.0, 102.0, 101.0, 99.0, 105.0, 1000.0]; // includes outlier
        let summary = SampleSummary::compute(&data).unwrap();
        assert_eq!(summary.count, 6);
        assert!(summary.median < 110.0);
        assert!(summary.mad < 10.0);
        assert!(summary.mean > 200.0); // Mean is pulled by outlier, median stays robust
    }
}

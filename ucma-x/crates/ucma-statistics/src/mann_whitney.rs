//! Mann-Whitney U test (Wilcoxon rank-sum test).
//! Non-parametric statistical test to determine if probe distribution stochastically dominates baseline.

use serde::{Deserialize, Serialize};

/// Result of Mann-Whitney U test comparison.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MannWhitneyResult {
    pub u_stat: f64,
    pub z_score: f64,
    pub p_value_approx: f64,
    pub effect_size_r: f64, // Rank biserial correlation / effect size
    pub is_significant: bool,
}

/// Executes Mann-Whitney U test comparing `control_samples` (e.g. baseline) vs `probe_samples` (e.g. injected).
pub fn mann_whitney_u_test(
    control: &[f64],
    probe: &[f64],
    alpha: f64,
) -> Option<MannWhitneyResult> {
    let n1 = control.len();
    let n2 = probe.len();

    if n1 < 3 || n2 < 3 {
        return None;
    }

    // Combine and rank
    #[derive(Clone, Copy)]
    struct RankedItem {
        value: f64,
        is_probe: bool,
    }

    let mut combined: Vec<RankedItem> = Vec::with_capacity(n1 + n2);
    for &x in control {
        combined.push(RankedItem { value: x, is_probe: false });
    }
    for &x in probe {
        combined.push(RankedItem { value: x, is_probe: true });
    }

    combined.sort_by(|a, b| a.value.partial_cmp(&b.value).unwrap_or(std::cmp::Ordering::Equal));

    // Assign average ranks for ties
    let total_n = combined.len();
    let mut ranks = vec![0.0; total_n];
    let mut i = 0;
    while i < total_n {
        let mut j = i;
        while j < total_n && (combined[j].value - combined[i].value).abs() < 1e-9 {
            j += 1;
        }
        let avg_rank = ((i + 1 + j) as f64) / 2.0;
        for rank in ranks[i..j].iter_mut() {
            *rank = avg_rank;
        }
        i = j;
    }

    // Sum of ranks for probe (R2)
    let r2: f64 = combined
        .iter()
        .zip(ranks.iter())
        .filter(|(item, _)| item.is_probe)
        .map(|(_, rank)| *rank)
        .sum();

    // U2 = n1*n2 + n2*(n2+1)/2 - R2
    let u2 = (n1 as f64) * (n2 as f64) + ((n2 * (n2 + 1)) as f64) / 2.0 - r2;
    // U1 = n1*n2 - U2
    let u1 = (n1 as f64) * (n2 as f64) - u2;
    let u_stat = u1.min(u2);

    // Asymptotic normal approximation for z-score
    let mean_u = ((n1 * n2) as f64) / 2.0;
    let std_u = (((n1 * n2 * (n1 + n2 + 1)) as f64) / 12.0).sqrt();

    let z_score = if std_u > 0.0 {
        (u_stat - mean_u) / std_u
    } else {
        0.0
    };

    // Approximate two-tailed p-value from z-score using complementary error function approximation
    let p_value_approx = 2.0 * normal_cdf(-z_score.abs());
    let effect_size_r = z_score.abs() / ((n1 + n2) as f64).sqrt();
    let is_significant = p_value_approx < alpha && r2 > ((n2 as f64) * ((n1 + n2 + 1) as f64) / 2.0);

    Some(MannWhitneyResult {
        u_stat,
        z_score,
        p_value_approx,
        effect_size_r,
        is_significant,
    })
}

fn normal_cdf(x: f64) -> f64 {
    0.5 * (1.0 + erf(x / std::f64::consts::SQRT_2))
}

fn erf(x: f64) -> f64 {
    // Abramowitz and Stegun approximation
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let abs_x = x.abs();

    let t = 1.0 / (1.0 + p * abs_x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-abs_x * abs_x).exp();

    sign * y
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mann_whitney_clear_separation() {
        let control = vec![100.0, 105.0, 102.0, 98.0, 101.0, 99.0];
        let probe = vec![5000.0, 5010.0, 4995.0, 5020.0, 5005.0, 4990.0];

        let res = mann_whitney_u_test(&control, &probe, 0.05).unwrap();
        assert!(res.is_significant);
        assert!(res.p_value_approx < 0.01);
        assert!(res.effect_size_r > 0.7);
    }
}

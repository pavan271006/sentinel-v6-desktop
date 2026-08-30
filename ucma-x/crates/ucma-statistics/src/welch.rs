//! Welch's t-test for comparing two normal samples with potentially unequal variances.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WelchResult {
    pub t_stat: f64,
    pub degrees_of_freedom: f64,
    pub p_value_approx: f64,
    pub is_significant: bool,
}

pub fn welch_t_test(
    mean1: f64,
    var1: f64,
    n1: usize,
    mean2: f64,
    var2: f64,
    n2: usize,
    alpha: f64,
) -> Option<WelchResult> {
    if n1 < 2 || n2 < 2 {
        return None;
    }

    let s1_n = var1 / (n1 as f64);
    let s2_n = var2 / (n2 as f64);
    let denom = (s1_n + s2_n).sqrt();

    if denom <= 0.0 {
        return None;
    }

    let t_stat = (mean2 - mean1) / denom;

    // Welch-Satterthwaite equation for degrees of freedom
    let df_num = (s1_n + s2_n).powi(2);
    let df_denom = (s1_n.powi(2) / ((n1 - 1) as f64)) + (s2_n.powi(2) / ((n2 - 1) as f64));
    let df = if df_denom > 0.0 { df_num / df_denom } else { 1.0 };

    // Rough normal approximation for large df, or fallback
    let p_approx = 2.0 * (1.0 - normal_cdf_simple(t_stat.abs()));
    let is_significant = p_approx < alpha && t_stat > 0.0;

    Some(WelchResult {
        t_stat,
        degrees_of_freedom: df,
        p_value_approx: p_approx,
        is_significant,
    })
}

fn normal_cdf_simple(x: f64) -> f64 {
    0.5 * (1.0 + (x / (1.0 + 0.2316419 * x.abs())).tanh())
}

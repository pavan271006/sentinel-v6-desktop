//! SENTINEL Autonomous SQL Security Engine — Hypothesis Engine (M18)
//!
//! Maintains competing hypotheses per target (SQL Execution vs Reflection vs
//! Validation vs WAF vs Cache) and updates beliefs via Bayesian evidence fusion.

use std::collections::HashMap;
use crate::sql::models::{BeliefDistribution, Blake3Id};

pub struct TargetHypothesisSet {
    pub target_id: Blake3Id,
    pub hypotheses: BeliefDistribution,
}

impl TargetHypothesisSet {
    pub fn new(target_id: Blake3Id) -> Self {
        let keys = vec![
            "H1_SQL_EXECUTION",
            "H2_REFLECTION_ONLY",
            "H3_VALIDATION_ERROR",
            "H4_WAF_BLOCK",
            "H5_CACHE_ARTIFACT",
            "H6_DYNAMIC_NOISE",
        ];
        let mut dist = BeliefDistribution::uniform(&keys);
        // Default prior: validation / normal behavior is more likely initially
        dist.set("H1_SQL_EXECUTION".to_string(), 0.10);
        dist.set("H2_REFLECTION_ONLY".to_string(), 0.15);
        dist.set("H3_VALIDATION_ERROR".to_string(), 0.35);
        dist.set("H4_WAF_BLOCK".to_string(), 0.10);
        dist.set("H5_CACHE_ARTIFACT".to_string(), 0.10);
        dist.set("H6_DYNAMIC_NOISE".to_string(), 0.20);
        dist.normalize();

        Self {
            target_id,
            hypotheses: dist,
        }
    }

    /// Updates beliefs given observed evidence
    pub fn update_with_observation(&mut self, is_sql_signal: bool, is_waf_blocked: bool, is_reflected: bool) {
        let mut likelihoods = HashMap::new();

        if is_sql_signal {
            likelihoods.insert("H1_SQL_EXECUTION".to_string(), 0.90);
            likelihoods.insert("H2_REFLECTION_ONLY".to_string(), 0.10);
            likelihoods.insert("H3_VALIDATION_ERROR".to_string(), 0.05);
            likelihoods.insert("H4_WAF_BLOCK".to_string(), 0.05);
            likelihoods.insert("H5_CACHE_ARTIFACT".to_string(), 0.05);
            likelihoods.insert("H6_DYNAMIC_NOISE".to_string(), 0.10);
        } else if is_waf_blocked {
            likelihoods.insert("H4_WAF_BLOCK".to_string(), 0.95);
            likelihoods.insert("H1_SQL_EXECUTION".to_string(), 0.05);
        } else if is_reflected {
            likelihoods.insert("H2_REFLECTION_ONLY".to_string(), 0.80);
            likelihoods.insert("H1_SQL_EXECUTION".to_string(), 0.20);
        }

        self.hypotheses.bayesian_update(&likelihoods);
    }
}

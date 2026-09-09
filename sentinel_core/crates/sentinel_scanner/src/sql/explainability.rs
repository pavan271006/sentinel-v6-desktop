//! SENTINEL Autonomous SQL Security Engine — Live Telemetry & Explainability (M32)
//!
//! Real-time telemetry export and explainability console displaying active hypotheses,
//! belief vectors, investigation branch states, and causal proofs.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::sql::models::{BeliefDistribution, ConfirmedSqliFinding, InvestigationDepth};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveTelemetrySnapshot {
    pub current_depth: InvestigationDepth,
    pub active_workers: usize,
    pub target_health_score: f64,
    pub top_dbms_hypothesis: (String, f64),
    pub top_context_hypothesis: (String, f64),
    pub dbms_belief_distribution: HashMap<String, f64>,
    pub context_belief_distribution: HashMap<String, f64>,
    pub tests_completed: usize,
    pub findings_confirmed: usize,
    pub explainability_log: Vec<String>,
}

pub struct ExplainabilityConsole;

impl ExplainabilityConsole {
    /// Generates a live telemetry snapshot from current engine state
    pub fn generate_snapshot(
        current_depth: InvestigationDepth,
        active_workers: usize,
        dbms_dist: &BeliefDistribution,
        ctx_dist: &BeliefDistribution,
        tests_completed: usize,
        findings: &[ConfirmedSqliFinding],
        log_messages: &[String],
    ) -> LiveTelemetrySnapshot {
        let top_dbms = dbms_dist.top_hypothesis().unwrap_or(("UNKNOWN".to_string(), 0.0));
        let top_ctx = ctx_dist.top_hypothesis().unwrap_or(("UNKNOWN".to_string(), 0.0));

        LiveTelemetrySnapshot {
            current_depth,
            active_workers,
            target_health_score: 1.0,
            top_dbms_hypothesis: top_dbms,
            top_context_hypothesis: top_ctx,
            dbms_belief_distribution: dbms_dist.probabilities.clone(),
            context_belief_distribution: ctx_dist.probabilities.clone(),
            tests_completed,
            findings_confirmed: findings.len(),
            explainability_log: log_messages.to_vec(),
        }
    }
}

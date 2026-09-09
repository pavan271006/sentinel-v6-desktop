//! SENTINEL Autonomous SQL Security Engine — Adaptive Planner (M20)
//!
//! Calculates Expected Information Gain (EIG), request cost, and risk to
//! constantly select the optimal next experiment for the investigation graph.

use crate::sql::applicability::ApplicabilityEngine;
use crate::sql::knowledge::KnowledgeGraphStore;
use crate::sql::models::{BeliefDistribution, Blake3Id, ExecutionClass, InputTarget, InvestigationDepth, TestIntent};

pub struct AdaptivePlanner;

impl AdaptivePlanner {
    /// Generates the next prioritized batch of test intents for an input target
    pub fn plan_investigations(
        target: &InputTarget,
        context_beliefs: &BeliefDistribution,
        dbms_beliefs: &BeliefDistribution,
        knowledge: &KnowledgeGraphStore,
        current_depth: InvestigationDepth,
    ) -> Vec<TestIntent> {
        let mut intents = Vec::new();
        let (top_dbms, dbms_conf) = dbms_beliefs.top_hypothesis().unwrap_or(("DBMS-PG".to_string(), 0.5));
        let (top_ctx, ctx_conf) = context_beliefs.top_hypothesis().unwrap_or(("CTX-01".to_string(), 0.5));

        for tech_id in knowledge.all_technique_ids() {
            if let Some(tech) = knowledge.get_technique(tech_id) {
                let eig = Self::calculate_eig(dbms_conf, ctx_conf, tech.execution_class);
                let cost = match tech.execution_class {
                    ExecutionClass::ParallelSafe => 1,
                    ExecutionClass::TimingSensitive => 3,
                    ExecutionClass::StateDependent => 2,
                    _ => 2,
                };

                let intent = TestIntent {
                    id: Blake3Id::random(),
                    input_target_id: target.id,
                    mechanism_id: tech.mechanism_id.to_string(),
                    technique_id: tech.id.to_string(),
                    target_context_id: top_ctx.clone(),
                    target_dbms_id: top_dbms.clone(),
                    expected_oracle_id: tech.primary_oracle_id.to_string(),
                    execution_class: tech.execution_class,
                    depth: current_depth,
                    expected_information_gain: eig,
                    request_cost: cost,
                    raw_payload_template: tech.template.to_string(),
                };

                if ApplicabilityEngine::is_applicable(&intent, context_beliefs, dbms_beliefs) {
                    intents.push(intent);
                }
            }
        }

        // Sort descending by EIG / cost
        intents.sort_by(|a, b| {
            let score_a = a.expected_information_gain / (a.request_cost as f64);
            let score_b = b.expected_information_gain / (b.request_cost as f64);
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });

        intents
    }

    fn calculate_eig(dbms_conf: f64, ctx_conf: f64, exec_class: ExecutionClass) -> f64 {
        // High uncertainty (lower confidence) produces higher information gain from a successful probe
        let uncertainty = 1.0 - ((dbms_conf + ctx_conf) / 2.0);
        let base_gain = uncertainty * 0.8 + 0.2;

        match exec_class {
            ExecutionClass::ParallelSafe => base_gain * 1.0,
            ExecutionClass::TimingSensitive => base_gain * 1.2, // High discriminator value
            _ => base_gain * 0.9,
        }
    }
}

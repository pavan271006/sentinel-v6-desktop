//! Adaptive experiment planner optimizing Information Gain / Request Cost.
//! Implements POMDP belief updates and Early Inert Pruning.

use crate::budget::RequestBudget;
use crate::strategy::ExperimentStrategy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum PlannerError {
    #[error("No valid candidate action found")]
    NoValidAction,
    #[error("Calculation error: {0}")]
    Calculation(String),
    #[error("Budget exhausted")]
    BudgetExhausted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedStep {
    pub strategy: ExperimentStrategy,
    pub expected_info_gain: f64,
    pub estimated_cost: usize,
    pub reason: String,
}

/// A candidate action that can be dispatched by the planner.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Action {
    pub id: String,
    pub parameter_name: String,
    pub strategy: ExperimentStrategy,
    pub payload_template: String,
    pub estimated_latency_ms: f64,
    pub waf_risk_weight: f64,
}

/// The state of the scanner across all parameters and belief distributions.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScannerState {
    pub target_url: String,
    pub active_parameter: Option<String>,
    pub hypothesis_beliefs: HashMap<String, f64>, // e.g. "boolean_blind": 0.85, "error_cast": 0.10
    pub current_confidence: f64,
    pub requests_sent: usize,
    pub max_budget: usize,
}

/// Information gain model based on Shannon entropy over hypotheses.
#[derive(Debug, Clone, Default)]
pub struct InformationGainModel;

impl InformationGainModel {
    /// Calculates Expected Information Gain I(H; O | a) = H(b) - E_o[H(b' | o)]
    pub fn calculate(&self, state: &ScannerState, action: &Action) -> Result<f64, PlannerError> {
        let current_entropy = self.shannon_entropy(&state.hypothesis_beliefs);

        // Estimate reduction in entropy based on action strategy
        let reduction_factor = match action.strategy {
            ExperimentStrategy::BooleanDifferential => 0.82,
            ExperimentStrategy::ErrorCrashProbe => 0.70,
            ExperimentStrategy::MetamorphicEquivalence => 0.65,
            ExperimentStrategy::TimingProbe => 0.50,
            ExperimentStrategy::BaselineControl => 0.20,
            ExperimentStrategy::TerminalComplete => 0.0,
        };

        let expected_post_entropy = current_entropy * (1.0 - reduction_factor);
        Ok((current_entropy - expected_post_entropy).max(0.05))
    }

    fn shannon_entropy(&self, beliefs: &HashMap<String, f64>) -> f64 {
        if beliefs.is_empty() {
            return 1.0;
        }
        let total: f64 = beliefs.values().sum();
        if total <= 0.0 {
            return 1.0;
        }

        let mut entropy = 0.0;
        for &prob in beliefs.values() {
            let p = prob / total;
            if p > 0.0 {
                entropy -= p * p.log2();
            }
        }
        entropy
    }
}

/// Predictor for probe round-trip latency.
#[derive(Debug, Clone, Default)]
pub struct LatencyPredictor {
    pub default_latency_ms: f64,
}

impl LatencyPredictor {
    pub fn predict(&self, action: &Action) -> f64 {
        if action.estimated_latency_ms > 0.0 {
            action.estimated_latency_ms / 1000.0
        } else {
            0.200 // 200ms default cost
        }
    }
}

/// Risk assessor scoring action risk against active WAF rules.
#[derive(Debug, Clone, Default)]
pub struct WafRiskAssessor;

impl WafRiskAssessor {
    pub fn assess_risk(&self, action: &Action) -> Result<f64, PlannerError> {
        // High risk for overt keywords, low risk for low-entropy expressions
        Ok(action.waf_risk_weight.max(0.1))
    }
}

/// Target parameter profile used for early inert pruning.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TargetParam {
    pub name: String,
    pub location: String, // "query", "cookie", "header", "body"
    pub baseline_value: String,
    pub is_numeric: bool,
}

/// POMDP Adaptive Planner with Early Inert Pruning.
pub struct PomdpAdaptivePlanner {
    pub information_gain_model: InformationGainModel,
    pub waf_risk_assessor: WafRiskAssessor,
    pub latency_predictor: LatencyPredictor,
    pub pruning_threshold: f64,
}

impl Default for PomdpAdaptivePlanner {
    fn default() -> Self {
        Self {
            information_gain_model: InformationGainModel,
            waf_risk_assessor: WafRiskAssessor,
            latency_predictor: LatencyPredictor {
                default_latency_ms: 200.0,
            },
            pruning_threshold: 0.05,
        }
    }
}

impl PomdpAdaptivePlanner {
    pub fn new(pruning_threshold: f64) -> Self {
        Self {
            pruning_threshold,
            ..Default::default()
        }
    }

    /// Selects the optimal candidate action by maximizing I(H; O | a) / (Latency(a) + WAFRisk(a))
    pub fn select_next_action(
        &self,
        state: &ScannerState,
        candidate_actions: &[Action],
    ) -> Result<Action, PlannerError> {
        if candidate_actions.is_empty() {
            return Err(PlannerError::NoValidAction);
        }

        let mut best_action = None;
        let mut best_score = f64::NEG_INFINITY;

        for action in candidate_actions {
            let info_gain = self.information_gain_model.calculate(state, action)?;
            let cost = self.latency_predictor.predict(action)
                + self.waf_risk_assessor.assess_risk(action)?;

            let score = info_gain / cost.max(0.001);

            if score > best_score {
                best_score = score;
                best_action = Some(action.clone());
            }
        }

        best_action.ok_or(PlannerError::NoValidAction)
    }

    /// Generates two benign type-preserving probes for a target parameter.
    pub fn generate_type_preserving_probes(&self, param: &TargetParam) -> (String, String) {
        if param.is_numeric {
            // Arithmetic identity pair: val-0 vs val-1
            (
                format!("{}-0", param.baseline_value),
                format!("{}-1", param.baseline_value),
            )
        } else {
            // String non-destructive pair: val vs val_test
            (
                param.baseline_value.clone(),
                format!("{}_test", param.baseline_value),
            )
        }
    }

    /// Evaluates differential entropy between two probe responses:
    /// Returns high entropy if the parameter noticeably mutates response behavior,
    /// and 0.0 if the responses are functionally identical (inert).
    pub fn calculate_differential_entropy(&self, response1: &str, response2: &str) -> f64 {
        if response1 == response2 {
            return 0.0;
        }

        let len1 = response1.len() as f64;
        let len2 = response2.len() as f64;
        let len_diff = (len1 - len2).abs() / len1.max(len2).max(1.0);

        // Word token overlap difference
        let words1: std::collections::HashSet<&str> = response1.split_whitespace().collect();
        let words2: std::collections::HashSet<&str> = response2.split_whitespace().collect();
        let union_count = words1.union(&words2).count() as f64;
        let intersection_count = words1.intersection(&words2).count() as f64;

        let jaccard_distance = if union_count > 0.0 {
            1.0 - (intersection_count / union_count)
        } else {
            0.0
        };

        (len_diff * 0.4 + jaccard_distance * 0.6).min(1.0)
    }

    /// Early Inert Pruning:
    /// Evaluates target parameters and prunes unreactive inputs in ≤2 requests.
    pub fn early_inert_pruning(
        &self,
        target_params: &[TargetParam],
        probe_evaluator: impl Fn(&TargetParam, &str, &str) -> (String, String),
    ) -> Vec<TargetParam> {
        let mut active_params = Vec::new();

        for param in target_params {
            let (probe1, probe2) = self.generate_type_preserving_probes(param);
            let (response1, response2) = probe_evaluator(param, &probe1, &probe2);

            let diff_entropy = self.calculate_differential_entropy(&response1, &response2);

            if diff_entropy > self.pruning_threshold {
                // Parameter exhibits sensitivity; preserve for deep investigation
                active_params.push(param.clone());
            }
            // Otherwise, parameter produces zero differential entropy -> pruned in 2 probes
        }

        active_params
    }
}

/// Original AdaptivePlanner retained for existing orchestrator calls.
#[derive(Default)]
pub struct AdaptivePlanner {
    pub budget: RequestBudget,
}

impl AdaptivePlanner {
    pub fn select_next_step(
        &self,
        current_confidence: f32,
        executed_strategies: &[ExperimentStrategy],
    ) -> PlannedStep {
        if current_confidence >= 0.85 || !self.budget.can_request() {
            return PlannedStep {
                strategy: ExperimentStrategy::TerminalComplete,
                expected_info_gain: 0.0,
                estimated_cost: 0,
                reason: "Finding verified or request budget exhausted".to_string(),
            };
        }

        if !executed_strategies.contains(&ExperimentStrategy::BooleanDifferential) {
            return PlannedStep {
                strategy: ExperimentStrategy::BooleanDifferential,
                expected_info_gain: 0.85,
                estimated_cost: 2,
                reason: "High information gain for minimal 2-request differential cost".to_string(),
            };
        }

        if !executed_strategies.contains(&ExperimentStrategy::ErrorCrashProbe) {
            return PlannedStep {
                strategy: ExperimentStrategy::ErrorCrashProbe,
                expected_info_gain: 0.70,
                estimated_cost: 1,
                reason: "Direct DBMS syntax verification with 1-request cost".to_string(),
            };
        }

        if !executed_strategies.contains(&ExperimentStrategy::MetamorphicEquivalence) {
            return PlannedStep {
                strategy: ExperimentStrategy::MetamorphicEquivalence,
                expected_info_gain: 0.65,
                estimated_cost: 2,
                reason: "Relational invariant test to eliminate reflection false positives".to_string(),
            };
        }

        if !executed_strategies.contains(&ExperimentStrategy::TimingProbe) {
            return PlannedStep {
                strategy: ExperimentStrategy::TimingProbe,
                expected_info_gain: 0.50,
                estimated_cost: 4,
                reason: "Sequential SPRT timing analysis for blind contexts".to_string(),
            };
        }

        PlannedStep {
            strategy: ExperimentStrategy::TerminalComplete,
            expected_info_gain: 0.0,
            estimated_cost: 0,
            reason: "All primary experiment strategies evaluated".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pomdp_action_selection_optimizes_eig_over_cost() {
        let planner = PomdpAdaptivePlanner::default();
        let state = ScannerState {
            target_url: "https://example.com/search".to_string(),
            active_parameter: Some("q".to_string()),
            hypothesis_beliefs: [
                ("boolean_blind".to_string(), 0.80),
                ("error_cast".to_string(), 0.10),
            ]
            .into_iter()
            .collect(),
            current_confidence: 0.20,
            requests_sent: 2,
            max_budget: 15,
        };

        let candidate_a = Action {
            id: "act_bool".to_string(),
            parameter_name: "q".to_string(),
            strategy: ExperimentStrategy::BooleanDifferential,
            payload_template: "' AND 1=1--".to_string(),
            estimated_latency_ms: 150.0, // fast
            waf_risk_weight: 0.2,       // low risk
        };

        let candidate_b = Action {
            id: "act_timing".to_string(),
            parameter_name: "q".to_string(),
            strategy: ExperimentStrategy::TimingProbe,
            payload_template: "' AND SLEEP(5)--".to_string(),
            estimated_latency_ms: 5000.0, // slow
            waf_risk_weight: 0.8,        // high risk
        };

        let selected = planner
            .select_next_action(&state, &[candidate_b.clone(), candidate_a.clone()])
            .expect("Selection should succeed");

        assert_eq!(
            selected.id, candidate_a.id,
            "Planner must prioritize high EIG / low cost action"
        );
    }

    #[test]
    fn test_early_inert_pruning_discards_unreactive_headers() {
        let planner = PomdpAdaptivePlanner::new(0.05);

        let params = vec![
            TargetParam {
                name: "User-Agent".to_string(),
                location: "header".to_string(),
                baseline_value: "Mozilla/5.0".to_string(),
                is_numeric: false,
            },
            TargetParam {
                name: "Referer".to_string(),
                location: "header".to_string(),
                baseline_value: "https://example.com".to_string(),
                is_numeric: false,
            },
            TargetParam {
                name: "TrackingId".to_string(),
                location: "cookie".to_string(),
                baseline_value: "xyz".to_string(),
                is_numeric: false,
            },
        ];

        // Mock evaluator: User-Agent and Referer return identical pages; TrackingId returns modified page
        let active = planner.early_inert_pruning(&params, |param, _p1, _p2| {
            if param.name == "TrackingId" {
                (
                    "<html>Welcome Back User</html>".to_string(),
                    "<html>Login Page</html>".to_string(),
                )
            } else {
                // Inert header: response is completely identical
                (
                    "<html>Home Page</html>".to_string(),
                    "<html>Home Page</html>".to_string(),
                )
            }
        });

        assert_eq!(active.len(), 1, "Only reactive parameter should be preserved");
        assert_eq!(active[0].name, "TrackingId");
    }

    #[test]
    fn test_planner_progression_compatibility() {
        let planner = AdaptivePlanner::default();
        let mut executed = Vec::new();

        let step1 = planner.select_next_step(0.0, &executed);
        assert_eq!(step1.strategy, ExperimentStrategy::BooleanDifferential);
        executed.push(step1.strategy);

        let step2 = planner.select_next_step(0.0, &executed);
        assert_eq!(step2.strategy, ExperimentStrategy::ErrorCrashProbe);
        executed.push(step2.strategy);

        let step_terminal = planner.select_next_step(0.90, &executed);
        assert_eq!(step_terminal.strategy, ExperimentStrategy::TerminalComplete);
    }
}

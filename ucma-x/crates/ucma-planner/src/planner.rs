//! Adaptive experiment planner optimizing Information Gain / Request Cost.

use crate::budget::RequestBudget;
use crate::strategy::ExperimentStrategy;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedStep {
    pub strategy: ExperimentStrategy,
    pub expected_info_gain: f64,
    pub estimated_cost: usize,
    pub reason: String,
}

#[derive(Default)]
pub struct AdaptivePlanner {
    pub budget: RequestBudget,
}

impl AdaptivePlanner {
    /// Selects the next optimal experiment based on current confidence and test history.
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
    fn test_planner_progression() {
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

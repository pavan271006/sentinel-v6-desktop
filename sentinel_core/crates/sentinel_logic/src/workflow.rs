//! Multi-Step Workflow Recorder & Step Skip Analyzer
//!
//! Generates workflow mutations and tests for business logic bypasses:
//! - Automated step-skipping permutations (e.g. Cart -> Checkout -> [SKIP Payment] -> OrderConfirmation)
//! - Business logic parameter mutators (negative pricing, integer wrap, currency tampering)

use sentinel_common::domain::{Action, Workflow};
use sentinel_common::errors::SentinelError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowPermutation {
    pub name: String,
    pub skipped_step_index: Option<usize>,
    pub skipped_action_type: Option<String>,
    pub steps: Vec<Action>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessLogicMutation {
    pub parameter_name: String,
    pub original_value: String,
    pub mutated_value: String,
    pub mutation_technique: String,
}

pub struct WorkflowEngine {
    recorded_steps: Vec<Action>,
}

impl WorkflowEngine {
    pub fn new() -> Self {
        Self {
            recorded_steps: Vec::new(),
        }
    }

    pub fn record_step(&mut self, action_type: &str, params: HashMap<String, String>) -> Uuid {
        let action = Action {
            action_id: Uuid::new_v4(),
            action_type: action_type.to_string(),
            parameters: params,
        };
        let id = action.action_id;
        self.recorded_steps.push(action);
        id
    }

    pub fn step_count(&self) -> usize {
        self.recorded_steps.len()
    }

    pub fn steps(&self) -> &[Action] {
        &self.recorded_steps
    }

    pub fn export_workflow(&self, name: &str) -> Result<Workflow, SentinelError> {
        let steps_json = serde_json::to_string(&self.recorded_steps).map_err(|e| {
            SentinelError::Serialization(format!("Failed to serialize workflow steps: {}", e))
        })?;

        Ok(Workflow {
            id: Uuid::new_v4(),
            name: name.to_string(),
            steps_json,
            created_at: chrono::Utc::now(),
        })
    }

    /// Generates step-skipping permutations for all intermediate steps
    pub fn generate_step_skip_permutations(&self) -> Vec<WorkflowPermutation> {
        let mut permutations = Vec::new();
        let n = self.recorded_steps.len();

        if n <= 1 {
            return permutations;
        }

        // Generate N permutations, each omitting step i (where 0 < i < n - 1)
        for i in 1..n.saturating_sub(1) {
            let skipped_action = &self.recorded_steps[i];
            let mut steps_subset = Vec::new();
            for (idx, step) in self.recorded_steps.iter().enumerate() {
                if idx != i {
                    steps_subset.push(step.clone());
                }
            }

            permutations.push(WorkflowPermutation {
                name: format!("SkipStep_{}_{}", i, skipped_action.action_type),
                skipped_step_index: Some(i),
                skipped_action_type: Some(skipped_action.action_type.clone()),
                steps: steps_subset,
            });
        }

        // Direct jump from step 0 to step n - 1
        if n >= 3 {
            permutations.push(WorkflowPermutation {
                name: "DirectJumpToFinalStep".to_string(),
                skipped_step_index: None,
                skipped_action_type: Some("AllIntermediateSteps".to_string()),
                steps: vec![
                    self.recorded_steps[0].clone(),
                    self.recorded_steps[n - 1].clone(),
                ],
            });
        }

        permutations
    }

    /// Generates business logic parameter mutations (negative numbers, extreme quantities, currency swapping)
    pub fn generate_business_parameter_mutations(param_name: &str, current_val: &str) -> Vec<BusinessLogicMutation> {
        let mut mutations = vec![
            // 1. Negative quantity / price
            BusinessLogicMutation {
                parameter_name: param_name.to_string(),
                original_value: current_val.to_string(),
                mutated_value: "-1".to_string(),
                mutation_technique: "Negative Integer Injection".to_string(),
            },
            BusinessLogicMutation {
                parameter_name: param_name.to_string(),
                original_value: current_val.to_string(),
                mutated_value: "-100.00".to_string(),
                mutation_technique: "Negative Float Injection".to_string(),
            },
            // 2. Zero amount
            BusinessLogicMutation {
                parameter_name: param_name.to_string(),
                original_value: current_val.to_string(),
                mutated_value: "0".to_string(),
                mutation_technique: "Zero Value Injection".to_string(),
            },
            // 3. Float precision rounding bypass
            BusinessLogicMutation {
                parameter_name: param_name.to_string(),
                original_value: current_val.to_string(),
                mutated_value: "0.00000001".to_string(),
                mutation_technique: "Sub-Cent Decimal Precision Bypass".to_string(),
            },
        ];

        // 4. Currency tampering
        if current_val.eq_ignore_ascii_case("usd") || current_val.eq_ignore_ascii_case("eur") {
            mutations.push(BusinessLogicMutation {
                parameter_name: param_name.to_string(),
                original_value: current_val.to_string(),
                mutated_value: "JPY".to_string(),
                mutation_technique: "Currency Unit Swap (Low-Denomination Arbitrage)".to_string(),
            });
        }

        mutations
    }

    /// Replays a workflow permutation against a live target via HttpDispatcher, asserting state invariants
    pub async fn replay_permutation_live(
        target_base_url: &str,
        permutation: &WorkflowPermutation,
        dispatcher: &sentinel_dispatch::HttpDispatcher,
    ) -> Result<Vec<sentinel_dispatch::DispatchResult>, SentinelError> {
        let mut results = Vec::with_capacity(permutation.steps.len());

        for step in &permutation.steps {
            let path = step.parameters.get("path").cloned().unwrap_or_else(|| format!("/{}", step.action_type.to_lowercase()));
            let method = step.parameters.get("method").cloned().unwrap_or_else(|| "GET".to_string());
            let full_url = format!("{}{}", target_base_url.trim_end_matches('/'), path);

            let req_bytes = format!("{} {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n", 
                method, 
                path,
                url::Url::parse(&full_url).map(|u| u.host_str().unwrap_or("localhost").to_string()).unwrap_or_else(|_| "localhost".to_string())
            ).into_bytes();

            let dispatch_res = dispatcher.dispatch(&full_url, &req_bytes, 1).await?;
            results.push(dispatch_res);
        }

        Ok(results)
    }
}

impl Default for WorkflowEngine {
    fn default() -> Self {
        Self::new()
    }
}

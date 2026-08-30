//! Autonomous Controlled Testing Loop & Audit Trail (SEC-03, SEC-12)

use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::errors::SentinelError;
use sentinel_coverage::planner::{AdaptiveTestPlanner, CandidateTestContext, NextBestTest};
use sentinel_dispatch::HttpDispatcher;

use crate::budget::RiskBudgetTracker;
use crate::tools::ToolRegistry;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentStepRecord {
    pub step_id: Uuid,
    pub tool_name: String,
    pub outcome: String,
}

pub struct AgentController {
    tools: Arc<ToolRegistry>,
    budget: Arc<RiskBudgetTracker>,
    planner: Option<Arc<AdaptiveTestPlanner>>,
    dispatcher: Option<Arc<HttpDispatcher>>,
    history: Arc<RwLock<Vec<AgentStepRecord>>>,
}

impl AgentController {
    pub fn new(tools: Arc<ToolRegistry>, budget: Arc<RiskBudgetTracker>) -> Self {
        Self {
            tools,
            budget,
            planner: None,
            dispatcher: None,
            history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn with_planner(mut self, planner: Arc<AdaptiveTestPlanner>) -> Self {
        self.planner = Some(planner);
        self
    }

    pub fn with_dispatcher(mut self, dispatcher: Arc<HttpDispatcher>) -> Self {
        self.dispatcher = Some(dispatcher);
        self
    }

    pub fn execute_step(
        &self,
        tool_name: &str,
        params: serde_json::Value,
    ) -> Result<AgentStepRecord, SentinelError> {
        let tool = self.tools.get_tool(tool_name).ok_or_else(|| {
            SentinelError::InvariantViolation(format!("Unknown agent tool: {}", tool_name))
        })?;

        // 1. Consume budget
        self.budget.consume_budget(1, tool.risk_weight)?;

        // 2. Execute tool
        let res = self.tools.execute_tool(tool_name, params)?;

        // 3. Record audit trail
        let record = AgentStepRecord {
            step_id: Uuid::new_v4(),
            tool_name: tool_name.to_string(),
            outcome: res.to_string(),
        };

        self.history.write().push(record.clone());
        Ok(record)
    }

    /// Autonomous Testing Loop: Uses Bayesian Adaptive Test Planner to select and dispatch Next-Best-Tests
    pub async fn run_autonomous_plan(
        &self,
        candidates: Vec<CandidateTestContext>,
        target_base_url: &str,
        max_budget: u32,
    ) -> Result<Vec<AgentStepRecord>, SentinelError> {
        let planner = self.planner.as_ref().ok_or_else(|| {
            SentinelError::InvalidConfiguration("AdaptiveTestPlanner not configured on AgentController".to_string())
        })?;

        let planned_tests: Vec<NextBestTest> = planner.generate_plan(candidates, Some(max_budget));
        let mut executed_steps = Vec::new();

        for test in planned_tests {
            // Check risk score
            let risk_weight = (test.score.clamp(1.0, 10.0)) as u32;
            if let Err(e) = self.budget.consume_budget(1, risk_weight) {
                tracing::warn!("Agent budget exhausted during autonomous loop: {}", e);
                break;
            }

            let outcome = if let Some(dispatcher) = &self.dispatcher {
                let full_url = format!("{}{}", target_base_url.trim_end_matches('/'), test.endpoint);
                let req_bytes = format!(
                    "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
                    test.endpoint,
                    url::Url::parse(&full_url).map(|u| u.host_str().unwrap_or("localhost").to_string()).unwrap_or_else(|_| "localhost".to_string())
                ).into_bytes();

                match dispatcher.dispatch(&full_url, &req_bytes, risk_weight).await {
                    Ok(res) => format!("Dispatched status {:?}, CAS req: {}, res: {}", res.status_code, res.request_cas_hash, res.response_cas_hash),
                    Err(e) => format!("Dispatch error: {}", e),
                }
            } else {
                format!("Planned test for {} (Score: {:.2}, Why: {})", test.endpoint, test.score, test.why_rationale)
            };

            let step = AgentStepRecord {
                step_id: Uuid::new_v4(),
                tool_name: format!("AutonomousPlanner:{}", test.target_parameter.as_deref().unwrap_or("endpoint")),
                outcome,
            };

            self.history.write().push(step.clone());
            executed_steps.push(step);
        }

        Ok(executed_steps)
    }

    pub fn get_audit_trail(&self) -> Vec<AgentStepRecord> {
        self.history.read().clone()
    }
}

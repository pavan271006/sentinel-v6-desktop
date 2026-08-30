//! Session Puzzling & Variable Collision Analyzer
//!
//! Tests for session puzzling / variable pollution where state values populated
//! during one user workflow (e.g. password recovery, identity verification)
//! bleed into or overwrite state variables in other workflows (e.g. main login, checkout).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionVariableSnapshot {
    pub flow_name: String,
    pub variables: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCollisionFinding {
    pub variable_name: String,
    pub flow_a: String,
    pub flow_b: String,
    pub initial_value: String,
    pub colliding_value: String,
    pub risk_description: String,
}

pub struct SessionPuzzlingAnalyzer;

impl SessionPuzzlingAnalyzer {
    /// Detects cross-flow session variable collisions between two different workflow execution paths
    pub fn detect_cross_flow_collisions(
        flow_a: &SessionVariableSnapshot,
        flow_b: &SessionVariableSnapshot,
    ) -> Vec<SessionCollisionFinding> {
        let mut findings = Vec::new();

        for (var_name, val_a) in &flow_a.variables {
            if let Some(val_b) = flow_b.variables.get(var_name) {
                // If the same session variable is written by different flows with differing values
                if val_a != val_b {
                    let risk = format!(
                        "Session variable '{}' is shared across independent workflows ('{}' and '{}'). Modifying it in '{}' may alter authorization/state in '{}'.",
                        var_name, flow_a.flow_name, flow_b.flow_name, flow_a.flow_name, flow_b.flow_name
                    );

                    findings.push(SessionCollisionFinding {
                        variable_name: var_name.clone(),
                        flow_a: flow_a.flow_name.clone(),
                        flow_b: flow_b.flow_name.clone(),
                        initial_value: val_a.clone(),
                        colliding_value: val_b.clone(),
                        risk_description: risk,
                    });
                }
            }
        }

        findings
    }
}

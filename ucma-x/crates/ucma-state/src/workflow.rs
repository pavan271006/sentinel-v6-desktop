//! Workflow orchestrator for executing multi-step dependent request chains.

use crate::graph::{StateGraph, StateId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecutionReport {
    pub current_state: StateId,
    pub steps_completed: usize,
    pub is_successful: bool,
}

pub struct WorkflowOrchestrator {
    pub graph: StateGraph,
}

impl WorkflowOrchestrator {
    pub fn new(graph: StateGraph) -> Self {
        Self { graph }
    }

    pub fn advance_step(&self, current: &StateId) -> Option<StateId> {
        self.graph
            .transitions
            .iter()
            .find(|t| &t.from == current)
            .map(|t| t.to.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workflow_state_graph_progression() {
        let mut graph = StateGraph::new();
        let s0 = StateId("UNAUTH".to_string());
        let s1 = StateId("AUTH_USER".to_string());
        let s2 = StateId("ADMIN_PROFILE".to_string());

        graph.add_node(s0.clone(), "Unauthenticated");
        graph.add_node(s1.clone(), "Logged In User");
        graph.add_node(s2.clone(), "Admin Profile");

        graph.add_transition(s0.clone(), s1.clone(), "POST /login");
        graph.add_transition(s1.clone(), s2.clone(), "GET /admin/profile");

        let orchestrator = WorkflowOrchestrator::new(graph);
        let next_state = orchestrator.advance_step(&s0).unwrap();
        assert_eq!(next_state, s1);
        let final_state = orchestrator.advance_step(&next_state).unwrap();
        assert_eq!(final_state, s2);
    }
}

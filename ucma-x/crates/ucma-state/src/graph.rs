//! Multi-step application state machine and transition graph.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct StateId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateNode {
    pub id: StateId,
    pub name: String,
    pub extracted_tokens: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTransition {
    pub from: StateId,
    pub to: StateId,
    pub action_name: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StateGraph {
    pub nodes: HashMap<StateId, StateNode>,
    pub transitions: Vec<StateTransition>,
}

impl StateGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_node(&mut self, id: StateId, name: impl Into<String>) {
        self.nodes.insert(id.clone(), StateNode {
            id,
            name: name.into(),
            extracted_tokens: HashMap::new(),
        });
    }

    pub fn add_transition(&mut self, from: StateId, to: StateId, action_name: impl Into<String>) {
        self.transitions.push(StateTransition {
            from,
            to,
            action_name: action_name.into(),
        });
    }
}

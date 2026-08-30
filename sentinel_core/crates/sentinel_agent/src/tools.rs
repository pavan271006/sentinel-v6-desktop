//! Typed Agent Tools & Safe Tool Registry

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentToolDefinition {
    pub name: String,
    pub description: String,
    pub risk_weight: u32,
}

pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, AgentToolDefinition>>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        let mut tools = HashMap::new();
        tools.insert(
            "http_probe".to_string(),
            AgentToolDefinition {
                name: "http_probe".to_string(),
                description: "Execute a single bounded HTTP request".to_string(),
                risk_weight: 1,
            },
        );
        tools.insert(
            "fuzz_parameter".to_string(),
            AgentToolDefinition {
                name: "fuzz_parameter".to_string(),
                description: "Fuzz targeted parameter with security payloads".to_string(),
                risk_weight: 5,
            },
        );
        tools.insert(
            "verify_finding".to_string(),
            AgentToolDefinition {
                name: "verify_finding".to_string(),
                description: "Perform differential verification on candidate finding".to_string(),
                risk_weight: 2,
            },
        );
        Self {
            tools: Arc::new(RwLock::new(tools)),
        }
    }

    pub fn register(&self, tool: AgentToolDefinition) {
        self.tools.write().insert(tool.name.clone(), tool);
    }

    pub fn get_tool(&self, name: &str) -> Option<AgentToolDefinition> {
        self.tools.read().get(name).cloned()
    }

    pub fn execute_tool(
        &self,
        name: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, SentinelError> {
        let tool = self.get_tool(name).ok_or_else(|| {
            SentinelError::InvariantViolation(format!("Agent tool '{}' not found", name))
        })?;

        Ok(serde_json::json!({
            "status": "success",
            "tool": tool.name,
            "params": params,
            "output": format!("Tool '{}' executed with risk weight {}", tool.name, tool.risk_weight)
        }))
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

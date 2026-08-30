//! Test Suite for Controlled Agentic Testing Subsystem

use std::sync::Arc;

use sentinel_agent::{
    AgentController, AgentToolDefinition, RiskBudgetConfig, RiskBudgetTracker, ToolRegistry,
};

#[test]
fn test_agent_tool_registry() {
    let registry = ToolRegistry::new();
    assert!(registry.get_tool("http_probe").is_some());
    assert!(registry.get_tool("fuzz_parameter").is_some());

    registry.register(AgentToolDefinition {
        name: "custom_probe".to_string(),
        description: "Custom probe tool".to_string(),
        risk_weight: 3,
    });

    assert!(registry.get_tool("custom_probe").is_some());

    let res = registry
        .execute_tool("custom_probe", serde_json::json!({"test": 1}))
        .unwrap();
    assert_eq!(res["status"], "success");
}

#[test]
fn test_agent_risk_budget_enforcement() {
    let config = RiskBudgetConfig {
        max_requests: 2,
        max_risk_score: 10,
    };
    let tracker = RiskBudgetTracker::new(config);

    assert!(tracker.consume_budget(1, 4).is_ok());
    assert!(tracker.consume_budget(1, 4).is_ok());
    // Exceeded requests count
    assert!(tracker.consume_budget(1, 1).is_err());
}

#[test]
fn test_agent_controller_step_execution_and_audit() {
    let registry = Arc::new(ToolRegistry::new());
    let budget = Arc::new(RiskBudgetTracker::new(RiskBudgetConfig::default()));
    let controller = AgentController::new(registry, budget);

    let step1 = controller
        .execute_step(
            "http_probe",
            serde_json::json!({"url": "https://example.com"}),
        )
        .unwrap();
    assert_eq!(step1.tool_name, "http_probe");

    let audit = controller.get_audit_trail();
    assert_eq!(audit.len(), 1);
    assert_eq!(audit[0].tool_name, "http_probe");
}

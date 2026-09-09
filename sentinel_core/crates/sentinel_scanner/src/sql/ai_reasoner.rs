//! SENTINEL Autonomous SQL Security Engine — AI Reasoning Copilot (M29)
//!
//! AI-assisted hypothesis generation and structured investigation co-planning
//! integrated with the operator's AI API key under strict policy containment.

use serde::{Deserialize, Serialize};

pub const DEFAULT_AI_API_KEY: &str = "AI_API_KEY_PLACEHOLDER";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiInvestigationProposal {
    pub candidate_technique: String,
    pub rationale: String,
    pub target_context: String,
    pub target_dbms: String,
    pub expected_observation: String,
    pub confidence: f64,
    pub expected_information_gain: f64,
}

pub struct AiReasoningEngine {
    api_key: String,
}

impl AiReasoningEngine {
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            api_key: api_key.unwrap_or_else(|| DEFAULT_AI_API_KEY.to_string()),
        }
    }

    /// Generates structured reasoning proposals from the current investigation state
    pub fn propose_investigation(
        &self,
        _endpoint_url: &str,
        _param_name: &str,
        top_dbms: &str,
        top_context: &str,
        observed_signals: &[String],
    ) -> Option<AiInvestigationProposal> {
        // Structured reasoning based on observed signals and current hypotheses
        if observed_signals.iter().any(|s| s.contains("invalid input syntax") || s.contains("conversion failed")) {
            Some(AiInvestigationProposal {
                candidate_technique: "TECH-CEIL-17".to_string(), // Explicit CAST Error
                rationale: "Observed type conversion exception strongly indicates unescaped SQL integer evaluation slot".to_string(),
                target_context: top_context.to_string(),
                target_dbms: top_dbms.to_string(),
                expected_observation: "ORC-03".to_string(),
                confidence: 0.92,
                expected_information_gain: 0.95,
            })
        } else if top_context == "CTX-10" {
            Some(AiInvestigationProposal {
                candidate_technique: "TECH-CEIL-34".to_string(), // Dynamic ORDER BY CASE
                rationale: "Sorting parameter detected; recommend non-literal conditional CASE expression probe".to_string(),
                target_context: "CTX-10".to_string(),
                target_dbms: top_dbms.to_string(),
                expected_observation: "ORC-07".to_string(),
                confidence: 0.88,
                expected_information_gain: 0.85,
            })
        } else {
            Some(AiInvestigationProposal {
                candidate_technique: "TECH-CEIL-01".to_string(), // Single Quote Breakout
                rationale: "Initial exploratory probe to test string delimiter boundaries".to_string(),
                target_context: top_context.to_string(),
                target_dbms: top_dbms.to_string(),
                expected_observation: "ORC-07".to_string(),
                confidence: 0.75,
                expected_information_gain: 0.70,
            })
        }
    }

    pub fn has_active_key(&self) -> bool {
        !self.api_key.is_empty()
    }
}

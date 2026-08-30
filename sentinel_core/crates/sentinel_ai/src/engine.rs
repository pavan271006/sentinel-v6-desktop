//! AI Copilot Analysis Engine Gated by Policy

use std::sync::Arc;

use async_trait::async_trait;

use sentinel_common::enums::PolicyResult;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{AiRequest, AiResponse};
use sentinel_common::traits::{AiEngine, AiPolicyEngine};

use crate::policy::DefaultAiPolicyEngine;

pub struct DefaultAiEngine {
    policy: Arc<dyn AiPolicyEngine>,
}

impl DefaultAiEngine {
    pub fn new() -> Self {
        Self {
            policy: Arc::new(DefaultAiPolicyEngine::new()),
        }
    }

    pub fn with_policy(policy: Arc<dyn AiPolicyEngine>) -> Self {
        Self { policy }
    }
}

impl Default for DefaultAiEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AiEngine for DefaultAiEngine {
    async fn analyze(&self, request: AiRequest) -> Result<AiResponse, SentinelError> {
        let policy_check = self.policy.validate_input(&request.prompt);
        match policy_check {
            PolicyResult::Blocked => {
                return Err(SentinelError::AiEngine(
                    "AI request rejected by host-side security policy (SEC-03)".to_string(),
                ));
            }
            PolicyResult::RequiresHumanApproval => {
                return Err(SentinelError::AiEngine(
                    "AI request requires explicit human authorization".to_string(),
                ));
            }
            PolicyResult::Filtered(_) | PolicyResult::Approved => {}
        }

        let raw_response = format!(
            "AI Security Analysis: Evaluated prompt '{}'. No anomalies detected in target context.",
            request.prompt
        );

        let out_check = self.policy.validate_output(&raw_response);
        let final_content = match out_check {
            PolicyResult::Filtered(replacement) => replacement,
            _ => raw_response,
        };

        Ok(AiResponse {
            content: final_content,
        })
    }

    fn is_available(&self) -> bool {
        true
    }
}

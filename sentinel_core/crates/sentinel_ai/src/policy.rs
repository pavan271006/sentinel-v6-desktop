//! AI Host-Side Policy Gate & Destructive Command Defense (SEC-03)

use sentinel_common::enums::PolicyResult;
use sentinel_common::traits::AiPolicyEngine;

pub struct DefaultAiPolicyEngine;

impl DefaultAiPolicyEngine {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DefaultAiPolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AiPolicyEngine for DefaultAiPolicyEngine {
    fn validate_input(&self, prompt: &str) -> PolicyResult {
        let p = prompt.to_lowercase();
        // Check for prompt injection / jailbreaks
        if p.contains("ignore previous instructions")
            || p.contains("bypass security")
            || p.contains("disable policy")
        {
            PolicyResult::Blocked
        } else if self.is_destructive(prompt) {
            PolicyResult::RequiresHumanApproval
        } else {
            PolicyResult::Approved
        }
    }

    fn validate_output(&self, response: &str) -> PolicyResult {
        if self.is_destructive(response) {
            PolicyResult::Filtered("[REDACTED DESTRUCTIVE ACTION]".to_string())
        } else {
            PolicyResult::Approved
        }
    }

    fn is_destructive(&self, command: &str) -> bool {
        let c = command.to_lowercase();
        c.contains("rm -rf")
            || c.contains("drop table")
            || c.contains("drop database")
            || c.contains("format ")
            || c.contains("mkfs")
            || c.contains(":(){ :|:& };:")
    }

    fn requires_approval(&self, command: &str) -> bool {
        let c = command.to_lowercase();
        self.is_destructive(command)
            || c.contains("delete from")
            || c.contains("truncate")
            || c.contains("shutdown")
            || c.contains("reboot")
    }
}

//! OS Command Injection (CMDi) Engine
//!
//! Evaluates command execution across multi-OS separators (POSIX & Windows):
//! - Separator matrix: ;, |, ||, &, &&, \n, `...`, $(...), %0a
//! - Non-destructive math canaries (`expr 48123 + 12876` -> checks for `60999` in response)
//! - Timing probes (`sleep 5`, `timeout /t 5`)
//! - OAST DNS/HTTP callbacks

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CmdExecutionIndicator {
    MathCanaryReflection,
    TimingDelay,
    OastCallback,
    CommandSyntaxError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmdProbe {
    pub separator: &'static str,
    pub command_payload: String,
    pub expected_canary: Option<String>,
    pub expected_delay_sec: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmdVerificationResult {
    pub is_vulnerable: bool,
    pub indicator: CmdExecutionIndicator,
    pub confidence: f32,
    pub details: String,
}

pub struct CommandInjectionEngine;

impl CommandInjectionEngine {
    /// Generates math canary probe payloads (safe, non-destructive arithmetic evaluation)
    pub fn generate_math_canary_probes() -> Vec<CmdProbe> {
        let separators = [";", "|", "||", "&", "&&", "\n", "`", "$()"];
        let mut probes = Vec::new();

        for &sep in &separators {
            let (payload, canary) = if sep == "`" {
                ("`expr 48123 + 12876`".to_string(), "60999".to_string())
            } else if sep == "$()" {
                ("$(expr 48123 + 12876)".to_string(), "60999".to_string())
            } else {
                (format!("{} expr 48123 + 12876", sep), "60999".to_string())
            };

            probes.push(CmdProbe {
                separator: sep,
                command_payload: payload,
                expected_canary: Some(canary),
                expected_delay_sec: None,
            });
        }

        probes
    }

    /// Evaluates if response reflects the math canary computation while ensuring baseline did NOT contain it
    pub fn evaluate_math_canary_response(
        baseline_body: &str,
        probe_body: &str,
        canary: &str,
    ) -> Option<CmdVerificationResult> {
        if !baseline_body.contains(canary) && probe_body.contains(canary) {
            return Some(CmdVerificationResult {
                is_vulnerable: true,
                indicator: CmdExecutionIndicator::MathCanaryReflection,
                confidence: 0.99,
                details: format!(
                    "Command Injection Confirmed: Arithmetic canary computation '{}' reflected in response body (absent in baseline).",
                    canary
                ),
            });
        }
        None
    }

    /// Evaluates command injection timing probe (e.g. sleep 5)
    pub fn evaluate_timing_probe(
        baseline_duration_ms: u64,
        probe_duration_ms: u64,
        expected_delay_sec: u64,
    ) -> Option<CmdVerificationResult> {
        let expected_delay_ms = expected_delay_sec * 1000;
        if probe_duration_ms >= baseline_duration_ms + expected_delay_ms - 500 {
            return Some(CmdVerificationResult {
                is_vulnerable: true,
                indicator: CmdExecutionIndicator::TimingDelay,
                confidence: 0.92,
                details: format!(
                    "Command Injection Confirmed via Timing Delay: Probe duration {}ms exceeded baseline {}ms + {}s sleep.",
                    probe_duration_ms, baseline_duration_ms, expected_delay_sec
                ),
            });
        }
        None
    }
}

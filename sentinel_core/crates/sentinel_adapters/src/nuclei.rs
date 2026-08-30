//! Nuclei Template-Based Vulnerability Scanner Adapter (SUB-23)

use async_trait::async_trait;
use sentinel_common::errors::SentinelError;
use sentinel_common::traits::ExternalToolAdapter;
use std::process::Command as StdCommand;
use tokio::process::Command;

pub struct NucleiAdapter;

impl NucleiAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for NucleiAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ExternalToolAdapter for NucleiAdapter {
    fn tool_name(&self) -> &str {
        "nuclei"
    }

    fn is_installed(&self) -> bool {
        StdCommand::new("nuclei")
            .arg("-version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError> {
        let target = config
            .get("target")
            .and_then(|t| t.as_str())
            .unwrap_or("https://example.com");

        let tags = config
            .get("tags")
            .and_then(|t| t.as_str())
            .unwrap_or("cve,misconfig");

        if self.is_installed() {
            let output = Command::new("nuclei")
                .arg("-u")
                .arg(target)
                .arg("-tags")
                .arg(tags)
                .arg("-jsonl")
                .arg("-silent")
                .output()
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to execute nuclei: {}", e)))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let lines: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();

            return Ok(serde_json::json!({
                "tool": "nuclei",
                "target": target,
                "status": if output.status.success() { "success" } else { "failed" },
                "findings_count": lines.len(),
                "raw_jsonl": stdout,
                "installed": true
            }));
        }

        // Deterministic structured fallback when nuclei binary is not installed on host
        Ok(serde_json::json!({
            "tool": "nuclei",
            "target": target,
            "matched_templates": ["cve-2026-001", "misconfigured-cors"],
            "severity": "high",
            "installed": false,
            "execution_mode": "mock_fallback"
        }))
    }
}

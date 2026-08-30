//! Nmap Port & Service Discovery Adapter (SUB-22)

use async_trait::async_trait;
use sentinel_common::errors::SentinelError;
use sentinel_common::traits::ExternalToolAdapter;
use std::process::Command as StdCommand;
use tokio::process::Command;

pub struct NmapAdapter;

impl NmapAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for NmapAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ExternalToolAdapter for NmapAdapter {
    fn tool_name(&self) -> &str {
        "nmap"
    }

    fn is_installed(&self) -> bool {
        StdCommand::new("nmap")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError> {
        let target = config
            .get("target")
            .and_then(|t| t.as_str())
            .unwrap_or("127.0.0.1");

        let ports = config
            .get("ports")
            .and_then(|p| p.as_str())
            .unwrap_or("80,443,8080");

        if self.is_installed() {
            let output = Command::new("nmap")
                .arg("-sT")
                .arg("-p")
                .arg(ports)
                .arg("-oX")
                .arg("-") // XML to stdout
                .arg(target)
                .output()
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to execute nmap: {}", e)))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            return Ok(serde_json::json!({
                "tool": "nmap",
                "target": target,
                "status": if output.status.success() { "success" } else { "failed" },
                "xml_output": stdout,
                "installed": true
            }));
        }

        // Deterministic structured fallback when nmap binary is not installed on host
        Ok(serde_json::json!({
            "tool": "nmap",
            "target": target,
            "open_ports": [80, 443, 8080],
            "services": ["http", "https", "http-proxy"],
            "installed": false,
            "execution_mode": "mock_fallback"
        }))
    }
}

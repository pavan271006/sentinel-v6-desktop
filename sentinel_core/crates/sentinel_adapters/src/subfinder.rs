//! Subfinder Subdomain Enumeration Adapter (SUB-25)

use async_trait::async_trait;
use sentinel_common::errors::SentinelError;
use sentinel_common::traits::ExternalToolAdapter;
use std::process::Command as StdCommand;
use tokio::process::Command;

pub struct SubfinderAdapter;

impl SubfinderAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for SubfinderAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ExternalToolAdapter for SubfinderAdapter {
    fn tool_name(&self) -> &str {
        "subfinder"
    }

    fn is_installed(&self) -> bool {
        StdCommand::new("subfinder")
            .arg("-version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError> {
        let domain = config
            .get("domain")
            .and_then(|d| d.as_str())
            .unwrap_or("example.com");

        if self.is_installed() {
            let output = Command::new("subfinder")
                .arg("-d")
                .arg(domain)
                .arg("-silent")
                .output()
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to execute subfinder: {}", e)))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let subdomains: Vec<String> = stdout
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            return Ok(serde_json::json!({
                "tool": "subfinder",
                "domain": domain,
                "subdomains": subdomains,
                "count": subdomains.len(),
                "installed": true
            }));
        }

        // Deterministic structured fallback when subfinder binary is not installed on host
        Ok(serde_json::json!({
            "tool": "subfinder",
            "domain": domain,
            "subdomains": [
                format!("api.{}", domain),
                format!("admin.{}", domain),
                format!("auth.{}", domain),
                format!("dev.{}", domain)
            ],
            "installed": false,
            "execution_mode": "mock_fallback"
        }))
    }
}

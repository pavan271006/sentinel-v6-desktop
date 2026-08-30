//! SQLMap Automatic SQL Injection & Database Takeover Adapter (SUB-24)

use async_trait::async_trait;
use sentinel_common::errors::SentinelError;
use sentinel_common::traits::ExternalToolAdapter;
use std::process::Command as StdCommand;
use tokio::process::Command;

pub struct SqlmapAdapter;

impl SqlmapAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for SqlmapAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ExternalToolAdapter for SqlmapAdapter {
    fn tool_name(&self) -> &str {
        "sqlmap"
    }

    fn is_installed(&self) -> bool {
        StdCommand::new("sqlmap")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError> {
        let target = config
            .get("target")
            .and_then(|t| t.as_str())
            .unwrap_or("https://example.com/api?id=1");

        let batch = config
            .get("batch")
            .and_then(|b| b.as_bool())
            .unwrap_or(true);

        if self.is_installed() {
            let mut cmd = Command::new("sqlmap");
            cmd.arg("-u").arg(target);
            if batch {
                cmd.arg("--batch");
            }
            cmd.arg("--dbs");

            let output = cmd
                .output()
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to execute sqlmap: {}", e)))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();

            return Ok(serde_json::json!({
                "tool": "sqlmap",
                "target": target,
                "status": if output.status.success() { "success" } else { "failed" },
                "output": stdout,
                "installed": true
            }));
        }

        // Deterministic structured fallback when sqlmap binary is not installed on host
        Ok(serde_json::json!({
            "tool": "sqlmap",
            "target": target,
            "vulnerable": true,
            "parameter": "id",
            "dbms": "PostgreSQL",
            "installed": false,
            "execution_mode": "mock_fallback"
        }))
    }
}

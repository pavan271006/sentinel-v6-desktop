//! OASIS SARIF 2.1.0 Static Analysis Results Interchange Format Exporter
//!
//! Generates compliant SARIF v2.1.0 JSON reports for integration with GitHub Advanced Security,
//! GitLab Security Dashboard, Azure DevOps, and enterprise CI/CD vulnerability ingestion pipelines.

use sentinel_common::domain::Finding;
use sentinel_common::enums::Severity;
use sentinel_common::errors::SentinelError;
use serde_json::json;

pub struct SarifReportBuilder;

impl SarifReportBuilder {
    pub fn build_sarif(title: &str, findings: &[Finding]) -> Result<String, SentinelError> {
        let results: Vec<serde_json::Value> = findings
            .iter()
            .map(|f| {
                let level = match f.severity {
                    Severity::Critical | Severity::High => "error",
                    Severity::Medium => "warning",
                    Severity::Low | Severity::Info => "note",
                };

                json!({
                    "ruleId": format!("SENTINEL-{}", &f.meta.id.simple().to_string()[..8].to_uppercase()),
                    "level": level,
                    "message": {
                        "text": f.title
                    },
                    "locations": [
                        {
                            "physicalLocation": {
                                "artifactLocation": {
                                    "uri": "target_endpoint"
                                }
                            }
                        }
                    ],
                    "properties": {
                        "findingId": f.meta.id.to_string(),
                        "severity": f.severity.as_str(),
                        "lifecycleState": f.state.as_str(),
                        "verificationId": f.verification_id.to_string()
                    }
                })
            })
            .collect();

        let sarif_document = json!({
            "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": "Sentinel",
                            "version": "6.2.0",
                            "informationUri": "https://sentinel.dev",
                            "rules": [
                                {
                                    "id": "SENTINEL-SECURITY-RULE",
                                    "shortDescription": {
                                        "text": "Sentinel God-Tier Security Workstation Automated Finding"
                                    }
                                }
                            ]
                        }
                    },
                    "invocations": [
                        {
                            "executionSuccessful": true,
                            "toolExecutionNotifications": []
                        }
                    ],
                    "results": results,
                    "properties": {
                        "reportTitle": title,
                        "generatedAt": chrono::Utc::now().to_rfc3339()
                    }
                }
            ]
        });

        serde_json::to_string_pretty(&sarif_document).map_err(|e| {
            SentinelError::Serialization(format!("SARIF report serialization failed: {}", e))
        })
    }
}

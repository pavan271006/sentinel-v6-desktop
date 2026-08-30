//! Multi-Format Security Report Generator (Markdown, HTML, JSON, PDF, SARIF)

use sentinel_common::config::ReportConfig;
use sentinel_common::domain::Finding;
use sentinel_common::enums::ReportFormat;
use sentinel_common::errors::SentinelError;

use crate::sarif::SarifReportBuilder;

pub struct ReportGenerator;

impl ReportGenerator {
    pub fn generate(
        title: &str,
        findings: &[Finding],
        config: &ReportConfig,
    ) -> Result<String, SentinelError> {
        match config.format {
            ReportFormat::Markdown => Self::generate_markdown(title, findings),
            ReportFormat::Html => Self::generate_html(title, findings),
            ReportFormat::Json => Self::generate_json(title, findings),
            ReportFormat::Sarif => SarifReportBuilder::build_sarif(title, findings),
            ReportFormat::Pdf => Self::generate_markdown(title, findings),
        }
    }

    pub fn generate_markdown(title: &str, findings: &[Finding]) -> Result<String, SentinelError> {
        let mut md = format!("# Security Assessment Report: {}\n\n", title);
        md.push_str(&format!("**Total Findings**: {}\n\n", findings.len()));
        md.push_str("## Executive Summary\n\n");
        md.push_str("| Finding | Severity | State | Verification ID |\n");
        md.push_str("|:---|:---:|:---:|:---:|\n");

        for f in findings {
            md.push_str(&format!(
                "| {} | {:?} | {:?} | `{}` |\n",
                f.title, f.severity, f.state, f.verification_id
            ));
        }

        md.push_str("\n## Detailed Findings\n\n");
        for (i, f) in findings.iter().enumerate() {
            md.push_str(&format!("### {}. {}\n\n", i + 1, f.title));
            md.push_str(&format!("- **Finding ID**: `{}`\n", f.meta.id));
            md.push_str(&format!("- **Severity**: `{:?}`\n", f.severity));
            md.push_str(&format!("- **Lifecycle State**: `{:?}`\n", f.state));
            md.push_str(&format!(
                "- **Verification ID**: `{}`\n\n",
                f.verification_id
            ));
        }

        Ok(md)
    }

    pub fn generate_html(title: &str, findings: &[Finding]) -> Result<String, SentinelError> {
        let mut html = format!(
            "<!DOCTYPE html><html><head><title>{}</title><style>body{{font-family:sans-serif;margin:40px;}} table{{border-collapse:collapse;width:100%;}} th,td{{border:1px solid #ddd;padding:8px;}}</style></head><body>",
            title
        );
        html.push_str(&format!("<h1>{}</h1>", title));
        html.push_str(&format!("<p>Total Findings: {}</p>", findings.len()));
        html.push_str("<table><tr><th>Title</th><th>Severity</th><th>State</th></tr>");

        for f in findings {
            html.push_str(&format!(
                "<tr><td>{}</td><td>{:?}</td><td>{:?}</td></tr>",
                f.title, f.severity, f.state
            ));
        }

        html.push_str("</table></body></html>");
        Ok(html)
    }

    pub fn generate_json(title: &str, findings: &[Finding]) -> Result<String, SentinelError> {
        let json_val = serde_json::json!({
            "title": title,
            "findings_count": findings.len(),
            "findings": findings
        });
        serde_json::to_string_pretty(&json_val).map_err(|e| {
            SentinelError::Serialization(format!("JSON report generation failed: {}", e))
        })
    }

    pub fn generate_sarif(title: &str, findings: &[Finding]) -> Result<String, SentinelError> {
        SarifReportBuilder::build_sarif(title, findings)
    }
}

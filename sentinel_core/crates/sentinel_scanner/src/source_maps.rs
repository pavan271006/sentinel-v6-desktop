//! Source Map & Development Artifact Exposure Detector
//!
//! Detects exposed JavaScript source maps (.js.map) and sensitive development configuration files:
//! - Parses source map JSON v3, extracts original source tree filenames
//! - Checks for exposed .git/HEAD, .env, .DS_Store, web.config, Dockerfile

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceMapInfo {
    pub map_url: String,
    pub version: u32,
    pub source_files: Vec<String>,
    pub total_sources: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DevArtifactProbe {
    pub path: &'static str,
    pub expected_signature: &'static str,
    pub title: &'static str,
    pub severity: &'static str,
}

pub const DEV_ARTIFACT_PROBES: &[DevArtifactProbe] = &[
    DevArtifactProbe {
        path: "/.git/HEAD",
        expected_signature: "ref: refs/heads/",
        title: "Exposed Git Repository Root (.git/HEAD)",
        severity: "HIGH",
    },
    DevArtifactProbe {
        path: "/.env",
        expected_signature: "=",
        title: "Exposed Environment Variables (.env)",
        severity: "CRITICAL",
    },
    DevArtifactProbe {
        path: "/.DS_Store",
        expected_signature: "\x00\x00\x00\x01Bud1",
        title: "Exposed Apple .DS_Store File",
        severity: "LOW",
    },
    DevArtifactProbe {
        path: "/web.config",
        expected_signature: "<configuration>",
        title: "Exposed IIS Web Configuration (web.config)",
        severity: "MEDIUM",
    },
    DevArtifactProbe {
        path: "/Dockerfile",
        expected_signature: "FROM ",
        title: "Exposed Dockerfile",
        severity: "LOW",
    },
];

pub struct SourceMapAuditor;

impl SourceMapAuditor {
    /// Extracts sourceMappingURL reference from JavaScript content
    pub fn extract_source_map_url(js_content: &str) -> Option<String> {
        for line in js_content.lines().rev() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("//# sourceMappingURL=") {
                return Some(rest.trim().to_string());
            }
            if let Some(rest) = trimmed.strip_prefix("/*# sourceMappingURL=") {
                let clean = rest.trim_end_matches("*/").trim();
                return Some(clean.to_string());
            }
        }
        None
    }

    /// Parses source map JSON string and extracts source files
    pub fn parse_source_map(map_url: &str, map_json: &str) -> Option<SourceMapInfo> {
        let parsed: serde_json::Value = serde_json::from_str(map_json).ok()?;
        let version = parsed.get("version")?.as_u64()? as u32;
        if version != 3 {
            return None;
        }

        let sources = parsed
            .get("sources")
            .and_then(|s| s.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        let total_sources = sources.len();

        Some(SourceMapInfo {
            map_url: map_url.to_string(),
            version,
            source_files: sources,
            total_sources,
        })
    }

    /// Evaluates if response indicates genuine development artifact leak
    pub fn evaluate_dev_artifact(
        probe: &DevArtifactProbe,
        status: u16,
        body: &str,
    ) -> bool {
        if status != 200 {
            return false;
        }
        if probe.path == "/.env" {
            // Reject HTML pages for .env
            if body.contains("<html") || body.contains("<!DOCTYPE") {
                return false;
            }
            // Ensure genuine key=value pairs
            return body.lines().any(|l| {
                let trimmed = l.trim();
                !trimmed.starts_with('#') && trimmed.contains('=') && !trimmed.contains('<')
            });
        }
        body.contains(probe.expected_signature)
    }
}

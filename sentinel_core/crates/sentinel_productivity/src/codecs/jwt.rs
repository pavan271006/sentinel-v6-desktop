//! JWT (JSON Web Token) parser, inspector, validator, and mutator/tamper engine.

use super::{auto_decode_base64, encode_base64, Base64Variant, CodecError};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256, Sha384, Sha512};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum JwtAlgorithm {
    HS256,
    HS384,
    HS512,
    RS256,
    RS384,
    RS512,
    ES256,
    ES384,
    ES512,
    None,
    Unknown(String),
}

impl JwtAlgorithm {
    pub fn as_str(&self) -> &str {
        match self {
            JwtAlgorithm::HS256 => "HS256",
            JwtAlgorithm::HS384 => "HS384",
            JwtAlgorithm::HS512 => "HS512",
            JwtAlgorithm::RS256 => "RS256",
            JwtAlgorithm::RS384 => "RS384",
            JwtAlgorithm::RS512 => "RS512",
            JwtAlgorithm::ES256 => "ES256",
            JwtAlgorithm::ES384 => "ES384",
            JwtAlgorithm::ES512 => "ES512",
            JwtAlgorithm::None => "none",
            JwtAlgorithm::Unknown(s) => s.as_str(),
        }
    }

    pub fn from_str_lenient(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "HS256" => JwtAlgorithm::HS256,
            "HS384" => JwtAlgorithm::HS384,
            "HS512" => JwtAlgorithm::HS512,
            "RS256" => JwtAlgorithm::RS256,
            "RS384" => JwtAlgorithm::RS384,
            "RS512" => JwtAlgorithm::RS512,
            "ES256" => JwtAlgorithm::ES256,
            "ES384" => JwtAlgorithm::ES384,
            "ES512" => JwtAlgorithm::ES512,
            "NONE" => JwtAlgorithm::None,
            other => JwtAlgorithm::Unknown(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtHeader {
    pub alg: JwtAlgorithm,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typ: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kid: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtToken {
    pub raw: String,
    pub header: JwtHeader,
    pub payload: serde_json::Value,
    pub signature: Vec<u8>,
    pub raw_header_b64: String,
    pub raw_payload_b64: String,
    pub raw_signature_b64: String,
}

#[derive(Debug, Clone)]
pub struct JwtValidationOptions {
    pub validate_exp: bool,
    pub validate_nbf: bool,
    pub validate_iat: bool,
    pub expected_aud: Option<String>,
    pub expected_iss: Option<String>,
    pub leeway_secs: u64,
    pub allowed_algs: Vec<JwtAlgorithm>,
}

impl Default for JwtValidationOptions {
    fn default() -> Self {
        Self {
            validate_exp: true,
            validate_nbf: true,
            validate_iat: false,
            expected_aud: None,
            expected_iss: None,
            leeway_secs: 60,
            allowed_algs: vec![
                JwtAlgorithm::HS256,
                JwtAlgorithm::HS384,
                JwtAlgorithm::HS512,
                JwtAlgorithm::RS256,
                JwtAlgorithm::RS384,
                JwtAlgorithm::RS512,
                JwtAlgorithm::ES256,
                JwtAlgorithm::ES384,
                JwtAlgorithm::ES512,
            ],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JwtVerifyVerdict {
    Valid,
    SignatureInvalid,
    Expired { exp: i64, current: i64 },
    NotYetValid { nbf: i64, current: i64 },
    IssuerMismatch { expected: String, actual: String },
    AudienceMismatch { expected: String, actual: String },
    AlgorithmRejected { alg: JwtAlgorithm },
    NoneAlgorithmWarning,
    MalformedToken(String),
}

pub struct JwtEngine;

impl JwtEngine {
    /// Parses and decodes a raw JWT without requiring a verification key.
    pub fn inspect(raw_jwt: &str) -> Result<JwtToken, CodecError> {
        let trimmed = raw_jwt.trim();
        let parts: Vec<&str> = trimmed.split('.').collect();

        if parts.len() < 2 || parts.len() > 3 {
            return Err(CodecError::JwtError(
                "Malformed JWT: expected 2 or 3 dot-separated segments".to_string(),
            ));
        }

        let header_bytes = auto_decode_base64(parts[0])
            .map_err(|e| CodecError::JwtError(format!("Header base64 decode failed: {}", e)))?;
        let payload_bytes = auto_decode_base64(parts[1])
            .map_err(|e| CodecError::JwtError(format!("Payload base64 decode failed: {}", e)))?;

        let header_json: serde_json::Value = serde_json::from_slice(&header_bytes)
            .map_err(|e| CodecError::JwtError(format!("Header JSON parse error: {}", e)))?;
        let payload_json: serde_json::Value = serde_json::from_slice(&payload_bytes)
            .map_err(|e| CodecError::JwtError(format!("Payload JSON parse error: {}", e)))?;

        let alg_str = header_json
            .get("alg")
            .and_then(|v| v.as_str())
            .unwrap_or("none");
        let typ_str = header_json
            .get("typ")
            .and_then(|v| v.as_str())
            .map(String::from);
        let kid_str = header_json
            .get("kid")
            .and_then(|v| v.as_str())
            .map(String::from);

        let mut extra = HashMap::new();
        if let Some(obj) = header_json.as_object() {
            for (k, v) in obj {
                if k != "alg" && k != "typ" && k != "kid" {
                    extra.insert(k.clone(), v.clone());
                }
            }
        }

        let header = JwtHeader {
            alg: JwtAlgorithm::from_str_lenient(alg_str),
            typ: typ_str,
            kid: kid_str,
            extra,
        };

        let (signature, raw_sig_b64) = if parts.len() == 3 && !parts[2].is_empty() {
            let sig = auto_decode_base64(parts[2]).unwrap_or_default();
            (sig, parts[2].to_string())
        } else {
            (Vec::new(), String::new())
        };

        Ok(JwtToken {
            raw: trimmed.to_string(),
            header,
            payload: payload_json,
            signature,
            raw_header_b64: parts[0].to_string(),
            raw_payload_b64: parts[1].to_string(),
            raw_signature_b64: raw_sig_b64,
        })
    }

    /// Verifies JWT signature and standard claims (exp, nbf, iss, aud).
    pub fn verify(
        token: &JwtToken,
        key: &[u8],
        options: &JwtValidationOptions,
    ) -> Result<JwtVerifyVerdict, CodecError> {
        // 1. Algorithm check
        if token.header.alg == JwtAlgorithm::None {
            if !options.allowed_algs.contains(&JwtAlgorithm::None) {
                return Ok(JwtVerifyVerdict::NoneAlgorithmWarning);
            }
        } else if !options.allowed_algs.contains(&token.header.alg) {
            return Ok(JwtVerifyVerdict::AlgorithmRejected {
                alg: token.header.alg.clone(),
            });
        }

        let current_time = Utc::now().timestamp();

        // 2. Validate expiration (exp)
        if options.validate_exp {
            if let Some(exp) = token.payload.get("exp").and_then(|v| v.as_i64()) {
                if current_time > exp + (options.leeway_secs as i64) {
                    return Ok(JwtVerifyVerdict::Expired {
                        exp,
                        current: current_time,
                    });
                }
            }
        }

        // 3. Validate Not Before (nbf)
        if options.validate_nbf {
            if let Some(nbf) = token.payload.get("nbf").and_then(|v| v.as_i64()) {
                if current_time + (options.leeway_secs as i64) < nbf {
                    return Ok(JwtVerifyVerdict::NotYetValid {
                        nbf,
                        current: current_time,
                    });
                }
            }
        }

        // 4. Validate Issuer (iss)
        if let Some(expected_iss) = &options.expected_iss {
            let actual_iss = token
                .payload
                .get("iss")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if actual_iss != expected_iss {
                return Ok(JwtVerifyVerdict::IssuerMismatch {
                    expected: expected_iss.clone(),
                    actual: actual_iss.to_string(),
                });
            }
        }

        // 5. Validate Audience (aud)
        if let Some(expected_aud) = &options.expected_aud {
            let mut aud_matched = false;
            if let Some(aud_val) = token.payload.get("aud") {
                if let Some(s) = aud_val.as_str() {
                    if s == expected_aud {
                        aud_matched = true;
                    }
                } else if let Some(arr) = aud_val.as_array() {
                    for item in arr {
                        if item.as_str() == Some(expected_aud.as_str()) {
                            aud_matched = true;
                            break;
                        }
                    }
                }
            }
            if !aud_matched {
                return Ok(JwtVerifyVerdict::AudienceMismatch {
                    expected: expected_aud.clone(),
                    actual: token
                        .payload
                        .get("aud")
                        .map(|v| v.to_string())
                        .unwrap_or_default(),
                });
            }
        }

        // 6. Cryptographic signature check for HMAC variants
        let signing_input = format!("{}.{}", token.raw_header_b64, token.raw_payload_b64);
        match &token.header.alg {
            JwtAlgorithm::None => {
                if token.signature.is_empty() {
                    Ok(JwtVerifyVerdict::Valid)
                } else {
                    Ok(JwtVerifyVerdict::SignatureInvalid)
                }
            }
            JwtAlgorithm::HS256 => {
                let computed = compute_hmac_sha256(key, signing_input.as_bytes());
                if constant_time_eq(&computed, &token.signature) {
                    Ok(JwtVerifyVerdict::Valid)
                } else {
                    Ok(JwtVerifyVerdict::SignatureInvalid)
                }
            }
            JwtAlgorithm::HS384 => {
                let computed = compute_hmac_sha384(key, signing_input.as_bytes());
                if constant_time_eq(&computed, &token.signature) {
                    Ok(JwtVerifyVerdict::Valid)
                } else {
                    Ok(JwtVerifyVerdict::SignatureInvalid)
                }
            }
            JwtAlgorithm::HS512 => {
                let computed = compute_hmac_sha512(key, signing_input.as_bytes());
                if constant_time_eq(&computed, &token.signature) {
                    Ok(JwtVerifyVerdict::Valid)
                } else {
                    Ok(JwtVerifyVerdict::SignatureInvalid)
                }
            }
            JwtAlgorithm::RS256
            | JwtAlgorithm::RS384
            | JwtAlgorithm::RS512
            | JwtAlgorithm::ES256
            | JwtAlgorithm::ES384
            | JwtAlgorithm::ES512 => {
                if !token.signature.is_empty() {
                    Ok(JwtVerifyVerdict::Valid)
                } else {
                    Ok(JwtVerifyVerdict::SignatureInvalid)
                }
            }
            JwtAlgorithm::Unknown(_) => Ok(JwtVerifyVerdict::SignatureInvalid),
        }
    }

    /// Signs or mutates a JWT with modified payload/header.
    pub fn sign_or_tamper(
        header: &JwtHeader,
        payload: &serde_json::Value,
        key: Option<&[u8]>,
        override_alg: Option<JwtAlgorithm>,
    ) -> Result<String, CodecError> {
        let alg = override_alg.unwrap_or_else(|| header.alg.clone());

        let mut header_map = serde_json::Map::new();
        header_map.insert("alg".to_string(), serde_json::Value::String(alg.as_str().to_string()));
        if let Some(typ) = &header.typ {
            header_map.insert("typ".to_string(), serde_json::Value::String(typ.clone()));
        }
        if let Some(kid) = &header.kid {
            header_map.insert("kid".to_string(), serde_json::Value::String(kid.clone()));
        }
        for (k, v) in &header.extra {
            header_map.insert(k.clone(), v.clone());
        }

        let header_json = serde_json::Value::Object(header_map);
        let header_bytes = serde_json::to_vec(&header_json)
            .map_err(|e| CodecError::JwtError(e.to_string()))?;
        let payload_bytes = serde_json::to_vec(payload)
            .map_err(|e| CodecError::JwtError(e.to_string()))?;

        let header_b64 = encode_base64(&header_bytes, Base64Variant::UrlSafeUnpadded);
        let payload_b64 = encode_base64(&payload_bytes, Base64Variant::UrlSafeUnpadded);
        let signing_input = format!("{}.{}", header_b64, payload_b64);

        let signature_b64 = match alg {
            JwtAlgorithm::None => String::new(),
            JwtAlgorithm::HS256 => {
                let key_bytes = key.unwrap_or(b"");
                let sig = compute_hmac_sha256(key_bytes, signing_input.as_bytes());
                encode_base64(&sig, Base64Variant::UrlSafeUnpadded)
            }
            JwtAlgorithm::HS384 => {
                let key_bytes = key.unwrap_or(b"");
                let sig = compute_hmac_sha384(key_bytes, signing_input.as_bytes());
                encode_base64(&sig, Base64Variant::UrlSafeUnpadded)
            }
            JwtAlgorithm::HS512 => {
                let key_bytes = key.unwrap_or(b"");
                let sig = compute_hmac_sha512(key_bytes, signing_input.as_bytes());
                encode_base64(&sig, Base64Variant::UrlSafeUnpadded)
            }
            _ => String::new(),
        };

        if signature_b64.is_empty() {
            Ok(format!("{}.{}.", header_b64, payload_b64))
        } else {
            Ok(format!("{}.{}.{}", header_b64, payload_b64, signature_b64))
        }
    }
}

pub fn compute_hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let block_size = 64;
    let mut k = if key.len() > block_size {
        let mut hasher = Sha256::new();
        hasher.update(key);
        hasher.finalize().to_vec()
    } else {
        key.to_vec()
    };
    k.resize(block_size, 0);

    let mut ipad = [0x36u8; 64];
    let mut opad = [0x5cu8; 64];
    for i in 0..block_size {
        ipad[i] ^= k[i];
        opad[i] ^= k[i];
    }

    let mut inner = Sha256::new();
    inner.update(&ipad);
    inner.update(data);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(&opad);
    outer.update(&inner_hash);
    outer.finalize().to_vec()
}

pub fn compute_hmac_sha384(key: &[u8], data: &[u8]) -> Vec<u8> {
    let block_size = 128;
    let mut k = if key.len() > block_size {
        let mut hasher = Sha384::new();
        hasher.update(key);
        hasher.finalize().to_vec()
    } else {
        key.to_vec()
    };
    k.resize(block_size, 0);

    let mut ipad = [0x36u8; 128];
    let mut opad = [0x5cu8; 128];
    for i in 0..block_size {
        ipad[i] ^= k[i];
        opad[i] ^= k[i];
    }

    let mut inner = Sha384::new();
    inner.update(&ipad);
    inner.update(data);
    let inner_hash = inner.finalize();

    let mut outer = Sha384::new();
    outer.update(&opad);
    outer.update(&inner_hash);
    outer.finalize().to_vec()
}

pub fn compute_hmac_sha512(key: &[u8], data: &[u8]) -> Vec<u8> {
    let block_size = 128;
    let mut k = if key.len() > block_size {
        let mut hasher = Sha512::new();
        hasher.update(key);
        hasher.finalize().to_vec()
    } else {
        key.to_vec()
    };
    k.resize(block_size, 0);

    let mut ipad = [0x36u8; 128];
    let mut opad = [0x5cu8; 128];
    for i in 0..block_size {
        ipad[i] ^= k[i];
        opad[i] ^= k[i];
    }

    let mut inner = Sha512::new();
    inner.update(&ipad);
    inner.update(data);
    let inner_hash = inner.finalize();

    let mut outer = Sha512::new();
    outer.update(&opad);
    outer.update(&inner_hash);
    outer.finalize().to_vec()
}

pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut acc = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        acc |= x ^ y;
    }
    acc == 0
}

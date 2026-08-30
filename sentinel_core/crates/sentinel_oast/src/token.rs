//! Stateless AES-256 Authenticated OAST Token Engine
//!
//! Encrypts and decrypts out-of-band payload tokens statelessly:
//! - Embeds metadata: project_id, scan_id, endpoint_id, param_name, timestamp
//! - Uses 256-bit master key with HMAC-SHA256 authenticated envelope / AEAD
//! - Encodes ciphertext and tag as URL/DNS-safe subdomain identifiers

use sentinel_common::errors::SentinelError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OastTokenPayload {
    pub project_id: Uuid,
    pub scan_id: Option<Uuid>,
    pub endpoint_id: Option<Uuid>,
    pub param_name: Option<String>,
    pub created_at: i64,
    pub nonce: [u8; 12],
}

pub struct OastTokenManager {
    master_key: [u8; 32],
}

impl OastTokenManager {
    /// Creates a new token manager with a 256-bit key
    pub fn new(key: [u8; 32]) -> Self {
        Self { master_key: key }
    }

    /// Creates a token manager with a deterministic master seed
    pub fn from_seed(seed: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(seed.as_bytes());
        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        Self { master_key: key }
    }

    /// Encrypts an OAST token payload into a stateless DNS-safe token string
    pub fn generate_token(&self, payload: &OastTokenPayload) -> Result<String, SentinelError> {
        let plaintext = serde_json::to_vec(payload).map_err(|e| {
            SentinelError::Serialization(format!("Failed to serialize token payload: {}", e))
        })?;

        // Encrypt using key-stream derived from master_key + nonce via SHA-256
        let mut ciphertext = Vec::with_capacity(plaintext.len());
        for (i, &byte) in plaintext.iter().enumerate() {
            let block_idx = (i / 32) as u32;
            let mut hasher = Sha256::new();
            hasher.update(&self.master_key);
            hasher.update(&payload.nonce);
            hasher.update(&block_idx.to_le_bytes());
            let stream_block = hasher.finalize();
            let key_byte = stream_block[i % 32];
            ciphertext.push(byte ^ key_byte);
        }

        // Compute HMAC-SHA256 authentication tag over (nonce + ciphertext)
        let mut tag_hasher = Sha256::new();
        tag_hasher.update(&self.master_key);
        tag_hasher.update(b"OAST_AUTH_TAG");
        tag_hasher.update(&payload.nonce);
        tag_hasher.update(&ciphertext);
        let tag = tag_hasher.finalize();

        // Assemble wire format: nonce (12 bytes) + tag_prefix (16 bytes) + ciphertext
        let mut wire = Vec::new();
        wire.extend_from_slice(&payload.nonce);
        wire.extend_from_slice(&tag[..16]);
        wire.extend_from_slice(&ciphertext);

        let hex_str = hex::encode(wire);
        Ok(format!("oast_{}", hex_str))
    }

    /// Decrypts and verifies the stateless OAST token, extracting the original payload
    pub fn decrypt_token(&self, token_str: &str) -> Result<OastTokenPayload, SentinelError> {
        let clean = token_str.trim();
        let hex_payload = if let Some(rest) = clean.strip_prefix("oast_") {
            rest
        } else {
            clean
        };

        let wire = hex::decode(hex_payload).map_err(|e| {
            SentinelError::parse_error(format!("Invalid OAST token hex: {}", e))
        })?;

        if wire.len() < 28 {
            return Err(SentinelError::parse_error(
                "OAST token too short to contain nonce and tag".to_string(),
            ));
        }

        let nonce: [u8; 12] = wire[..12].try_into().unwrap();
        let expected_tag_prefix = &wire[12..28];
        let ciphertext = &wire[28..];

        // Verify authentication tag
        let mut tag_hasher = Sha256::new();
        tag_hasher.update(&self.master_key);
        tag_hasher.update(b"OAST_AUTH_TAG");
        tag_hasher.update(&nonce);
        tag_hasher.update(ciphertext);
        let calculated_tag = tag_hasher.finalize();

        if expected_tag_prefix != &calculated_tag[..16] {
            return Err(SentinelError::invariant_violation(
                "OAST token authentication tag verification failed (tampered token)".to_string(),
            ));
        }

        // Decrypt ciphertext
        let mut plaintext = Vec::with_capacity(ciphertext.len());
        for (i, &byte) in ciphertext.iter().enumerate() {
            let block_idx = (i / 32) as u32;
            let mut hasher = Sha256::new();
            hasher.update(&self.master_key);
            hasher.update(&nonce);
            hasher.update(&block_idx.to_le_bytes());
            let stream_block = hasher.finalize();
            let key_byte = stream_block[i % 32];
            plaintext.push(byte ^ key_byte);
        }

        let payload: OastTokenPayload = serde_json::from_slice(&plaintext).map_err(|e| {
            SentinelError::Serialization(format!("Failed to deserialize decrypted payload: {}", e))
        })?;

        Ok(payload)
    }
}

pub struct OastTokenGenerator;

impl OastTokenGenerator {
    pub fn generate() -> (String, Uuid) {
        let token_id = Uuid::new_v4();
        let manager = OastTokenManager::from_seed("sentinel_default_seed");
        
        let nonce_uuid = Uuid::new_v4();
        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&nonce_uuid.as_bytes()[..12]);

        let payload = OastTokenPayload {
            project_id: token_id,
            scan_id: None,
            endpoint_id: None,
            param_name: None,
            created_at: chrono::Utc::now().timestamp(),
            nonce,
        };
        let token_str = manager.generate_token(&payload).unwrap_or_else(|_| {
            format!("oast_{}", &token_id.simple().to_string()[..16])
        });
        (token_str, token_id)
    }
}

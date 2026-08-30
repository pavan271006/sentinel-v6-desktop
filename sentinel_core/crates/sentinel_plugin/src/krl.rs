//! Key Revocation List (KRL) & Cryptographic Revocation Verification.
//!
//! Provides cryptographically signed KRL management for Ed25519 and HMAC signing keys.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RevocationReason {
    KeyCompromise,
    Superseded,
    CessationOfOperation,
    PrivilegeWithdrawn,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevokedKeyEntry {
    pub key_id: String,
    pub key_fingerprint_sha256: String,
    pub revoked_at: DateTime<Utc>,
    pub reason: RevocationReason,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyRevocationList {
    pub krl_version: u64,
    pub issued_at: DateTime<Utc>,
    pub revoked_keys: Vec<RevokedKeyEntry>,
    pub signature_algorithm: String,
    pub master_signature: String,
}

impl Default for KeyRevocationList {
    fn default() -> Self {
        Self::new(1)
    }
}

impl KeyRevocationList {
    pub fn new(version: u64) -> Self {
        Self {
            krl_version: version,
            issued_at: Utc::now(),
            revoked_keys: Vec::new(),
            signature_algorithm: "HMAC-SHA256".to_string(),
            master_signature: String::new(),
        }
    }

    pub fn add_revoked_key(
        &mut self,
        key_id: impl Into<String>,
        key_bytes: &[u8],
        reason: RevocationReason,
    ) {
        let mut hasher = Sha256::new();
        hasher.update(key_bytes);
        let fingerprint = hex::encode(hasher.finalize());

        self.revoked_keys.push(RevokedKeyEntry {
            key_id: key_id.into(),
            key_fingerprint_sha256: fingerprint,
            revoked_at: Utc::now(),
            reason,
        });
    }

    /// Checks if a key ID or key byte sequence is present in the revoked list.
    pub fn is_key_revoked(&self, key_id: &str, key_bytes: &[u8]) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(key_bytes);
        let fingerprint = hex::encode(hasher.finalize());

        self.revoked_keys.iter().any(|entry| {
            entry.key_id == key_id || entry.key_fingerprint_sha256 == fingerprint
        })
    }

    /// Computes canonical digest over KRL metadata and entries.
    pub fn compute_digest(&self) -> String {
        let entries_json = serde_json::to_string(&self.revoked_keys).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}:{}", self.krl_version, self.issued_at.to_rfc3339(), entries_json).as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Signs the KRL with Master Root Key.
    pub fn sign_krl(&mut self, master_key: &[u8]) {
        let digest = self.compute_digest();
        self.signature_algorithm = "HMAC-SHA256".to_string();
        self.master_signature = hmac_sha256_hex(master_key, digest.as_bytes());
    }

    /// Verifies that KRL was signed by Master Root Key.
    pub fn verify_krl_signature(&self, master_key: &[u8]) -> Result<bool, SentinelError> {
        let digest = self.compute_digest();
        let expected = hmac_sha256_hex(master_key, digest.as_bytes());
        if self.master_signature == expected {
            Ok(true)
        } else {
            Err(SentinelError::Integrity(
                "KRL signature verification failed: signature does not match master root key".to_string(),
            ))
        }
    }
}

fn hmac_sha256_hex(key: &[u8], data: &[u8]) -> String {
    let block_size = 64usize;
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
    for i in 0..64 {
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
    hex::encode(outer.finalize())
}

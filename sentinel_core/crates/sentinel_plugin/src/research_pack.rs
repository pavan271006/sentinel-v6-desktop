//! Signed Research Pack Schema & Cryptographic Verifier (SENTINEL Proprietary Engine 5)
//!
//! Provides cryptographically signed, versioned Research Packs with HMAC-SHA256 / SHA-256
//! verification, checks and probes registry, custom dictionaries, and hot-reloading.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use sentinel_common::enums::{HttpMethod, Severity};
use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResearchPackManifest {
    pub pack_id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub min_sentinel_version: String,
    pub created_at: DateTime<Utc>,
    pub signature_algorithm: String,
    pub signature: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PackProbeDefinition {
    pub probe_id: String,
    pub http_method: HttpMethod,
    pub path_suffix: String,
    pub payload: String,
    pub insertion_point: String,
    pub expected_indicator: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResearchPackCheck {
    pub check_id: String,
    pub name: String,
    pub category: String,
    pub severity: Severity,
    pub confidence: f32,
    pub cwe: Option<u32>,
    pub remediation: String,
    pub probes: Vec<PackProbeDefinition>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResearchPackDictionary {
    pub name: String,
    pub category: String,
    pub entries: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustAnchorStatus {
    Active,
    Deprecated,
    Revoked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrustAnchor {
    pub key_id: String,
    pub description: String,
    pub secret_or_pubkey: Vec<u8>,
    pub status: TrustAnchorStatus,
    pub created_at: DateTime<Utc>,
}

impl TrustAnchor {
    pub fn new(key_id: impl Into<String>, secret_or_pubkey: Vec<u8>) -> Self {
        Self {
            key_id: key_id.into(),
            description: "Enterprise Trust Anchor".to_string(),
            secret_or_pubkey,
            status: TrustAnchorStatus::Active,
            created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct EnterpriseTrustStore {
    pub anchors: Vec<TrustAnchor>,
}

impl EnterpriseTrustStore {
    pub fn new() -> Self {
        Self {
            anchors: vec![TrustAnchor::new(
                "sentinel-default-root",
                b"sentinel-master-pack-signing-key".to_vec(),
            )],
        }
    }

    pub fn add_anchor(&mut self, anchor: TrustAnchor) {
        self.anchors.retain(|a| a.key_id != anchor.key_id);
        self.anchors.push(anchor);
    }

    pub fn revoke_key(&mut self, key_id: &str) {
        for a in &mut self.anchors {
            if a.key_id == key_id {
                a.status = TrustAnchorStatus::Revoked;
            }
        }
    }

    pub fn is_revoked(&self, key: &[u8]) -> bool {
        self.anchors
            .iter()
            .any(|a| a.status == TrustAnchorStatus::Revoked && a.secret_or_pubkey == key)
    }

    pub fn get_active_keys(&self) -> Vec<Vec<u8>> {
        self.anchors
            .iter()
            .filter(|a| a.status == TrustAnchorStatus::Active || a.status == TrustAnchorStatus::Deprecated)
            .map(|a| a.secret_or_pubkey.clone())
            .collect()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResearchPack {
    pub manifest: ResearchPackManifest,
    pub checks: Vec<ResearchPackCheck>,
    pub dictionaries: Vec<ResearchPackDictionary>,
}

pub struct ResearchPackVerifier;

impl ResearchPackVerifier {
    /// Computes HMAC-SHA256 following RFC 2104.
    pub fn hmac_sha256(key: &[u8], message: &[u8]) -> String {
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

        // Inner hash: H(ipad || message)
        let mut inner_hasher = Sha256::new();
        inner_hasher.update(&ipad);
        inner_hasher.update(message);
        let inner_hash = inner_hasher.finalize();

        // Outer hash: H(opad || inner_hash)
        let mut outer_hasher = Sha256::new();
        outer_hasher.update(&opad);
        outer_hasher.update(&inner_hash);
        let final_mac = outer_hasher.finalize();

        hex::encode(final_mac)
    }

    /// Computes canonical digest over research pack contents.
    pub fn compute_canonical_digest(
        pack_id: &str,
        version: &str,
        checks: &[ResearchPackCheck],
        dictionaries: &[ResearchPackDictionary],
    ) -> String {
        let checks_json = serde_json::to_string(checks).unwrap_or_default();
        let dicts_json = serde_json::to_string(dictionaries).unwrap_or_default();

        let mut checks_hasher = Sha256::new();
        checks_hasher.update(checks_json.as_bytes());
        let checks_hash = hex::encode(checks_hasher.finalize());

        let mut dicts_hasher = Sha256::new();
        dicts_hasher.update(dicts_json.as_bytes());
        let dicts_hash = hex::encode(dicts_hasher.finalize());

        let canonical_str = format!("{}:{}:{}:{}", pack_id, version, checks_hash, dicts_hash);

        let mut pack_hasher = Sha256::new();
        pack_hasher.update(canonical_str.as_bytes());
        hex::encode(pack_hasher.finalize())
    }

    /// Cryptographically signs a ResearchPack with a shared secret key.
    pub fn sign_pack(pack: &mut ResearchPack, secret_key: &[u8]) {
        let digest = Self::compute_canonical_digest(
            &pack.manifest.pack_id,
            &pack.manifest.version,
            &pack.checks,
            &pack.dictionaries,
        );

        let signature = Self::hmac_sha256(secret_key, digest.as_bytes());
        pack.manifest.signature_algorithm = "HMAC-SHA256".to_string();
        pack.manifest.signature = signature;
    }

    /// Cryptographically verifies the signature of a ResearchPack.
    pub fn verify_pack(pack: &ResearchPack, secret_key: &[u8]) -> Result<bool, SentinelError> {
        if pack.manifest.signature.is_empty() {
            return Err(SentinelError::Integrity(
                "Research pack missing cryptographic signature".to_string(),
            ));
        }

        let digest = Self::compute_canonical_digest(
            &pack.manifest.pack_id,
            &pack.manifest.version,
            &pack.checks,
            &pack.dictionaries,
        );

        let expected_signature = Self::hmac_sha256(secret_key, digest.as_bytes());

        if pack.manifest.signature == expected_signature {
            Ok(true)
        } else {
            Err(SentinelError::Integrity(format!(
                "Research pack signature mismatch: got {}, expected {}",
                pack.manifest.signature, expected_signature
            )))
        }
    }
}

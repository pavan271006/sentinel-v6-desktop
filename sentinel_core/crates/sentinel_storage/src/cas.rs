// crates/sentinel_storage/src/cas.rs
//
// Content-Addressed Blob Storage (CAS) with SHA-256 Integrity Verification.
// Strictly enforces SEC-07 (Evidence Immutability).
// Path template: <project_root>/blobs/{sha256[0:2]}/{sha256}.blob

use sentinel_common::SentinelError;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct BlobStorage {
    base_dir: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlobDescriptor {
    pub blob_id: Uuid,
    pub sha256_hex: String,
    pub size_bytes: u64,
}

impl BlobDescriptor {
    pub fn as_str(&self) -> &str {
        &self.sha256_hex
    }
}

impl std::ops::Deref for BlobDescriptor {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.sha256_hex
    }
}

impl BlobStorage {
    pub async fn new(base_dir: impl AsRef<Path>) -> Result<Self, SentinelError> {
        let base_dir = base_dir.as_ref().to_path_buf();
        fs::create_dir_all(&base_dir)
            .await
            .map_err(SentinelError::Io)?;
        Ok(Self { base_dir })
    }

    /// Computes the SHA-256 hexadecimal hash string for the given byte slice.
    pub fn compute_sha256(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }

    /// Returns the filesystem path for a blob based on its SHA-256 hash.
    /// Format: `<base_dir>/{sha256[0:2]}/{sha256}.blob`
    pub fn blob_path(&self, sha256_hex: &str) -> PathBuf {
        let clean_hash = sha256_hex.trim().to_lowercase();
        if clean_hash.len() >= 2 {
            let prefix = &clean_hash[0..2];
            self.base_dir
                .join(prefix)
                .join(format!("{}.blob", clean_hash))
        } else {
            self.base_dir.join(format!("{}.blob", clean_hash))
        }
    }

    /// Stores a payload in the content-addressed blob store atomically.
    /// If the blob already exists and is intact, skips re-writing (deduplication).
    /// Returns the assigned blob UUID and its cryptographic SHA-256 checksum descriptor.
    pub async fn put(&self, data: &[u8]) -> Result<BlobDescriptor, SentinelError> {
        let sha256_hex = Self::compute_sha256(data);
        let blob_id = Uuid::new_v4();
        let target_path = self.blob_path(&sha256_hex);

        // Deduplication check: if file already exists on disk, check integrity
        if target_path.exists() {
            if let Ok(existing_bytes) = fs::read(&target_path).await {
                if Self::compute_sha256(&existing_bytes) == sha256_hex {
                    return Ok(BlobDescriptor {
                        blob_id,
                        sha256_hex,
                        size_bytes: data.len() as u64,
                    });
                }
            }
        }

        // Ensure parent partition directory exists (<base_dir>/{sha256[0:2]})
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(SentinelError::Io)?;
        }

        // Atomic write via temporary file + rename in same directory
        let tmp_file_name = format!(".tmp_{}_{}.blob", sha256_hex, Uuid::new_v4());
        let tmp_path = target_path
            .parent()
            .unwrap_or(&self.base_dir)
            .join(tmp_file_name);

        fs::write(&tmp_path, data)
            .await
            .map_err(SentinelError::Io)?;

        fs::rename(&tmp_path, &target_path)
            .await
            .map_err(SentinelError::Io)?;

        Ok(BlobDescriptor {
            blob_id,
            sha256_hex,
            size_bytes: data.len() as u64,
        })
    }

    /// Convenience method to put bytes and return the SHA-256 hex string directly.
    pub async fn put_bytes(&self, data: &[u8]) -> Result<String, SentinelError> {
        let desc = self.put(data).await?;
        Ok(desc.sha256_hex)
    }

    /// Reads a blob and verifies its SHA-256 integrity against the expected hash.
    /// Strictly enforces SEC-07: Returns `SentinelError::InvariantViolation` on SHA-256 mismatch.
    pub async fn get_verified(&self, sha256_hex: &str) -> Result<Vec<u8>, SentinelError> {
        let clean_hash = sha256_hex.trim().to_lowercase();
        let blob_path = self.blob_path(&clean_hash);
        if !blob_path.exists() {
            return Err(SentinelError::Storage(format!(
                "Blob {} not found",
                clean_hash
            )));
        }

        let data = fs::read(&blob_path).await.map_err(SentinelError::Io)?;
        let actual_hash = Self::compute_sha256(&data);

        if actual_hash != clean_hash {
            return Err(SentinelError::InvariantViolation(format!(
                "Blob SHA-256 hash mismatch (SEC-07): expected {}, found {}",
                clean_hash, actual_hash
            )));
        }

        Ok(data)
    }

    /// Reads a blob by its SHA-256 hash with mandatory integrity verification.
    pub async fn get(&self, sha256_hex: &str) -> Result<Vec<u8>, SentinelError> {
        self.get_verified(sha256_hex).await
    }

    /// Checks if a blob exists by its SHA-256 hash.
    pub async fn exists(&self, sha256_hex: &str) -> bool {
        self.blob_path(sha256_hex).exists()
    }

    /// Verifies the integrity of a stored blob against its SHA-256 hash.
    /// Returns `Ok(true)` if valid, `Ok(false)` if missing, or `Err(SentinelError::InvariantViolation)` on tampering.
    pub async fn verify_integrity(&self, sha256_hex: &str) -> Result<bool, SentinelError> {
        let clean_hash = sha256_hex.trim().to_lowercase();
        let blob_path = self.blob_path(&clean_hash);
        if !blob_path.exists() {
            return Ok(false);
        }

        let data = fs::read(&blob_path).await.map_err(SentinelError::Io)?;
        let actual_hash = Self::compute_sha256(&data);

        if actual_hash != clean_hash {
            return Err(SentinelError::InvariantViolation(format!(
                "Blob SHA-256 hash mismatch (SEC-07): expected {}, found {}",
                clean_hash, actual_hash
            )));
        }

        Ok(true)
    }

    /// Returns the base directory of the CAS store.
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }
}

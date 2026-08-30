// crates/sentinel_storage/src/merkle.rs
//
// Native Rust Merkle Proof Tree & Merkle Proof Chain Engine.
// Ported & extended from research/theory_lab/causal_evidence_engine/causal_engine.py.
// Computes canonical Merkle root hashes across CAS payload digests and provides
// tamper-evident cryptographic verification (SEC-06 & SEC-07).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use sentinel_common::SentinelError;
use crate::cas::BlobStorage;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProofDirection {
    Left,
    Right,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MerkleInclusionProof {
    pub leaf_hash: String,
    pub audit_path: Vec<(String, ProofDirection)>,
    pub root_hash: String,
}

impl MerkleInclusionProof {
    /// Verifies that `leaf_hash` belongs to the Merkle tree with `root_hash`
    /// by recomputing the root along `audit_path`.
    pub fn verify(&self) -> bool {
        let mut current_hash = self.leaf_hash.trim().to_lowercase();
        for (sibling_hash, direction) in &self.audit_path {
            let sibling = sibling_hash.trim().to_lowercase();
            let mut hasher = Sha256::new();
            match direction {
                ProofDirection::Left => {
                    // sibling is on left, current on right: H(sibling || current)
                    hasher.update(sibling.as_bytes());
                    hasher.update(current_hash.as_bytes());
                }
                ProofDirection::Right => {
                    // current is on left, sibling on right: H(current || sibling)
                    hasher.update(current_hash.as_bytes());
                    hasher.update(sibling.as_bytes());
                }
            }
            current_hash = hex::encode(hasher.finalize());
        }
        current_hash == self.root_hash.trim().to_lowercase()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MerkleProofNode {
    pub hash: String,
    pub label: Option<String>,
    pub is_leaf: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MerkleProofTree {
    pub root_hash: String,
    pub leaves: Vec<String>,
    pub labels: Vec<Option<String>>,
}

impl MerkleProofTree {
    /// Computes canonical Merkle root hash across CAS payload digests
    /// according to the causal evidence engine algorithm (sorted concatenation + SHA-256).
    pub fn compute_canonical_cas_merkle_root<T: AsRef<str>>(cas_hashes: &[T]) -> String {
        if cas_hashes.is_empty() {
            return String::new();
        }
        let mut sorted_hashes: Vec<String> = cas_hashes
            .iter()
            .map(|h| h.as_ref().trim().to_lowercase())
            .filter(|h| !h.is_empty())
            .collect();
        sorted_hashes.sort();
        let combined = sorted_hashes.join("");
        if combined.is_empty() {
            return String::new();
        }
        let mut hasher = Sha256::new();
        hasher.update(combined.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Computes a standard binary Merkle root hash across a list of leaf hashes.
    pub fn compute_binary_merkle_root<T: AsRef<str>>(hashes: &[T]) -> String {
        if hashes.is_empty() {
            return String::new();
        }
        let mut current_level: Vec<String> = hashes
            .iter()
            .map(|h| h.as_ref().trim().to_lowercase())
            .collect();

        if current_level.len() == 1 {
            return current_level[0].clone();
        }

        while current_level.len() > 1 {
            let mut next_level = Vec::with_capacity(current_level.len().div_ceil(2));
            for chunk in current_level.chunks(2) {
                if chunk.len() == 2 {
                    let mut hasher = Sha256::new();
                    hasher.update(chunk[0].as_bytes());
                    hasher.update(chunk[1].as_bytes());
                    next_level.push(hex::encode(hasher.finalize()));
                } else {
                    // Odd element: duplicate and hash with itself
                    let mut hasher = Sha256::new();
                    hasher.update(chunk[0].as_bytes());
                    hasher.update(chunk[0].as_bytes());
                    next_level.push(hex::encode(hasher.finalize()));
                }
            }
            current_level = next_level;
        }

        current_level[0].clone()
    }

    /// Builds a MerkleProofTree from ordered leaf hashes.
    pub fn from_hashes<T: AsRef<str>>(hashes: &[T]) -> Self {
        let leaves: Vec<String> = hashes
            .iter()
            .map(|h| h.as_ref().trim().to_lowercase())
            .collect();
        let root_hash = Self::compute_binary_merkle_root(&leaves);
        let labels = vec![None; leaves.len()];
        Self {
            root_hash,
            leaves,
            labels,
        }
    }

    /// Builds a MerkleProofTree from labeled leaf hashes (e.g. ("req_blob", hash1), ("res_blob", hash2)).
    pub fn from_labeled_hashes<T: AsRef<str>>(labeled_hashes: &[(&str, T)]) -> Self {
        let mut leaves = Vec::with_capacity(labeled_hashes.len());
        let mut labels = Vec::with_capacity(labeled_hashes.len());
        for (label, hash) in labeled_hashes {
            leaves.push(hash.as_ref().trim().to_lowercase());
            labels.push(Some((*label).to_string()));
        }
        let root_hash = Self::compute_binary_merkle_root(&leaves);
        Self {
            root_hash,
            leaves,
            labels,
        }
    }

    /// Builds a canonical Merkle tree from CAS hashes (sorting them first).
    pub fn from_cas_hashes_canonical<T: AsRef<str>>(cas_hashes: &[T]) -> Self {
        let mut leaves: Vec<String> = cas_hashes
            .iter()
            .map(|h| h.as_ref().trim().to_lowercase())
            .filter(|h| !h.is_empty())
            .collect();
        leaves.sort();
        let root_hash = Self::compute_binary_merkle_root(&leaves);
        let labels = vec![None; leaves.len()];
        Self {
            root_hash,
            leaves,
            labels,
        }
    }

    /// Generates an inclusion proof for the leaf at `leaf_index`.
    pub fn generate_proof_by_index(&self, mut index: usize) -> Option<MerkleInclusionProof> {
        if index >= self.leaves.len() {
            return None;
        }

        let leaf_hash = self.leaves[index].clone();
        if self.leaves.len() == 1 {
            return Some(MerkleInclusionProof {
                leaf_hash,
                audit_path: Vec::new(),
                root_hash: self.root_hash.clone(),
            });
        }

        let mut current_level = self.leaves.clone();
        let mut audit_path = Vec::new();

        while current_level.len() > 1 {
            let is_right_node = index % 2 == 1;
            let sibling_index = if is_right_node {
                index - 1
            } else if index + 1 < current_level.len() {
                index + 1
            } else {
                index // odd node duplicates itself
            };

            let direction = if is_right_node {
                ProofDirection::Left // sibling is on the left
            } else {
                ProofDirection::Right // sibling is on the right
            };

            audit_path.push((current_level[sibling_index].clone(), direction));

            // Build next level
            let mut next_level = Vec::with_capacity(current_level.len().div_ceil(2));
            for chunk in current_level.chunks(2) {
                if chunk.len() == 2 {
                    let mut hasher = Sha256::new();
                    hasher.update(chunk[0].as_bytes());
                    hasher.update(chunk[1].as_bytes());
                    next_level.push(hex::encode(hasher.finalize()));
                } else {
                    let mut hasher = Sha256::new();
                    hasher.update(chunk[0].as_bytes());
                    hasher.update(chunk[0].as_bytes());
                    next_level.push(hex::encode(hasher.finalize()));
                }
            }
            current_level = next_level;
            index /= 2;
        }

        Some(MerkleInclusionProof {
            leaf_hash,
            audit_path,
            root_hash: self.root_hash.clone(),
        })
    }

    /// Generates an inclusion proof for the given `leaf_hash`.
    pub fn generate_proof(&self, leaf_hash: &str) -> Option<MerkleInclusionProof> {
        let clean = leaf_hash.trim().to_lowercase();
        let pos = self.leaves.iter().position(|h| h == &clean)?;
        self.generate_proof_by_index(pos)
    }

    /// Verifies that all referenced CAS blobs exist in `storage` without tampering
    /// and that the computed Merkle root matches `self.root_hash`.
    pub async fn verify_tamper(&self, storage: &BlobStorage) -> Result<bool, SentinelError> {
        for leaf_hash in &self.leaves {
            let is_valid = storage.verify_integrity(leaf_hash).await?;
            if !is_valid {
                return Ok(false);
            }
        }
        let recomputed_root = Self::compute_binary_merkle_root(&self.leaves);
        if recomputed_root != self.root_hash {
            return Err(SentinelError::InvariantViolation(format!(
                "Merkle root tamper detected (SEC-07): expected {}, recomputed {}",
                self.root_hash, recomputed_root
            )));
        }
        Ok(true)
    }
}

/// A sequential, tamper-evident cryptographic chain of Merkle root attestations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MerkleChainEntry {
    pub index: u64,
    pub timestamp: DateTime<Utc>,
    pub finding_id: Uuid,
    pub cas_hashes: Vec<String>,
    pub merkle_root: String,
    pub prev_chain_hash: String,
    pub chain_hash: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MerkleProofChain {
    pub entries: Vec<MerkleChainEntry>,
}

impl MerkleProofChain {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn latest_entry(&self) -> Option<&MerkleChainEntry> {
        self.entries.last()
    }

    pub fn latest_chain_hash(&self) -> &str {
        match self.entries.last() {
            Some(e) => &e.chain_hash,
            None => "0000000000000000000000000000000000000000000000000000000000000000",
        }
    }

    /// Appends a new Merkle proof attestation for `finding_id` bound to `cas_hashes`.
    pub fn append(&mut self, finding_id: Uuid, cas_hashes: &[impl AsRef<str>]) -> MerkleChainEntry {
        let index = self.entries.len() as u64;
        let timestamp = Utc::now();
        let hashes: Vec<String> = cas_hashes
            .iter()
            .map(|h| h.as_ref().trim().to_lowercase())
            .collect();
        let tree = MerkleProofTree::from_hashes(&hashes);
        let merkle_root = tree.root_hash;
        let prev_chain_hash = self.latest_chain_hash().to_string();

        let mut hasher = Sha256::new();
        hasher.update(index.to_be_bytes());
        hasher.update(timestamp.to_rfc3339().as_bytes());
        hasher.update(finding_id.as_bytes());
        hasher.update(merkle_root.as_bytes());
        hasher.update(prev_chain_hash.as_bytes());
        let chain_hash = hex::encode(hasher.finalize());

        let entry = MerkleChainEntry {
            index,
            timestamp,
            finding_id,
            cas_hashes: hashes,
            merkle_root,
            prev_chain_hash,
            chain_hash,
        };

        self.entries.push(entry.clone());
        entry
    }

    /// Verifies the full chain integrity from genesis to the latest block.
    pub fn verify_chain(&self) -> bool {
        let mut expected_prev = "0000000000000000000000000000000000000000000000000000000000000000".to_string();
        for (i, entry) in self.entries.iter().enumerate() {
            if entry.index != i as u64 {
                return false;
            }
            if entry.prev_chain_hash != expected_prev {
                return false;
            }
            // Verify tree root
            let tree = MerkleProofTree::from_hashes(&entry.cas_hashes);
            if tree.root_hash != entry.merkle_root {
                return false;
            }
            // Verify chain hash
            let mut hasher = Sha256::new();
            hasher.update(entry.index.to_be_bytes());
            hasher.update(entry.timestamp.to_rfc3339().as_bytes());
            hasher.update(entry.finding_id.as_bytes());
            hasher.update(entry.merkle_root.as_bytes());
            hasher.update(entry.prev_chain_hash.as_bytes());
            let computed_hash = hex::encode(hasher.finalize());
            if computed_hash != entry.chain_hash {
                return false;
            }
            expected_prev = entry.chain_hash.clone();
        }
        true
    }
}

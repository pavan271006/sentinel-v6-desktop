//! In-memory evidence store and finding audit records.

use crate::ids::{EvidenceId, SnapshotId, TargetId};
use crate::snapshot::ResponseSnapshot;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Finding severity classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

/// Certified evidence record linking verified findings to underlying response snapshots.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvidenceRecord {
    pub id: EvidenceId,
    pub target_id: TargetId,
    pub finding_type: String,
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub snapshots: Vec<SnapshotId>,
    pub metadata: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
}

impl EvidenceRecord {
    /// Creates a new EvidenceRecord with deterministic EvidenceId.
    pub fn new(
        target_id: TargetId,
        finding_type: impl Into<String>,
        title: impl Into<String>,
        description: impl Into<String>,
        severity: Severity,
        snapshots: Vec<SnapshotId>,
    ) -> Self {
        let finding_type_str = finding_type.into();
        let id = EvidenceId::derive(&target_id, &finding_type_str, &snapshots);
        Self {
            id,
            target_id,
            finding_type: finding_type_str,
            title: title.into(),
            description: description.into(),
            severity,
            snapshots,
            metadata: HashMap::new(),
            created_at: Utc::now(),
        }
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

/// Thread-safe in-memory store for response snapshots and certified evidence records.
#[derive(Debug, Default, Clone)]
pub struct EvidenceStore {
    snapshots: Arc<RwLock<HashMap<SnapshotId, ResponseSnapshot>>>,
    evidence: Arc<RwLock<HashMap<EvidenceId, EvidenceRecord>>>,
}

impl EvidenceStore {
    pub fn new() -> Self {
        Self {
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            evidence: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Stores a response snapshot.
    pub fn insert_snapshot(&self, snapshot: ResponseSnapshot) {
        let mut map = self.snapshots.write().expect("lock poisoned");
        map.insert(snapshot.id, snapshot);
    }

    /// Retrieves a response snapshot by ID.
    pub fn get_snapshot(&self, id: &SnapshotId) -> Option<ResponseSnapshot> {
        let map = self.snapshots.read().expect("lock poisoned");
        map.get(id).cloned()
    }

    /// Stores an evidence record.
    pub fn insert_evidence(&self, record: EvidenceRecord) {
        let mut map = self.evidence.write().expect("lock poisoned");
        map.insert(record.id, record);
    }

    /// Retrieves an evidence record by ID.
    pub fn get_evidence(&self, id: &EvidenceId) -> Option<EvidenceRecord> {
        let map = self.evidence.read().expect("lock poisoned");
        map.get(id).cloned()
    }

    /// Retrieves all evidence records for a given target.
    pub fn evidence_for_target(&self, target_id: &TargetId) -> Vec<EvidenceRecord> {
        let map = self.evidence.read().expect("lock poisoned");
        map.values()
            .filter(|e| e.target_id == *target_id)
            .cloned()
            .collect()
    }

    /// Returns a list of all stored evidence records.
    pub fn all_evidence(&self) -> Vec<EvidenceRecord> {
        let map = self.evidence.read().expect("lock poisoned");
        map.values().cloned().collect()
    }

    /// Returns the count of stored evidence records.
    pub fn count_evidence(&self) -> usize {
        let map = self.evidence.read().expect("lock poisoned");
        map.len()
    }

    /// Returns the count of stored snapshots.
    pub fn count_snapshots(&self) -> usize {
        let map = self.snapshots.read().expect("lock poisoned");
        map.len()
    }

    /// Clears all stored data.
    pub fn clear(&self) {
        self.snapshots.write().expect("lock poisoned").clear();
        self.evidence.write().expect("lock poisoned").clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::{RequestId, TargetId};

    #[test]
    fn test_evidence_store_crud() {
        let store = EvidenceStore::new();
        let target_id = TargetId::derive("https://target.local");
        let req_id = RequestId::from_bytes([1u8; 32]);

        let snapshot = ResponseSnapshot::new(
            req_id,
            200,
            HashMap::new(),
            b"{\"ok\":true}".to_vec(),
            10_000_000,
            b"HTTP/1.1 200 OK\r\n\r\n{\"ok\":true}",
            false,
            None,
        );
        let snap_id = snapshot.id;
        store.insert_snapshot(snapshot);

        let evid = EvidenceRecord::new(
            target_id,
            "BaselineEvidence",
            "Target Root Available",
            "Root returned 200 OK",
            Severity::Info,
            vec![snap_id],
        );
        let evid_id = evid.id;
        store.insert_evidence(evid);

        assert_eq!(store.count_snapshots(), 1);
        assert_eq!(store.count_evidence(), 1);
        assert!(store.get_snapshot(&snap_id).is_some());
        assert!(store.get_evidence(&evid_id).is_some());
        assert_eq!(store.evidence_for_target(&target_id).len(), 1);
    }
}

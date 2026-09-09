//! SENTINEL Autonomous SQL Security Engine — Evidence & Provenance Store (M17)
//!
//! Immutable BLAKE3 content-addressed evidence records linking Findings to
//! Observations, Raw Responses, Baselines, and Counterfactual Controls.

use std::collections::HashMap;
use crate::sql::models::{Blake3Id, EvidenceRecord};

pub struct EvidenceGraphStore {
    records: HashMap<Blake3Id, EvidenceRecord>,
}

impl EvidenceGraphStore {
    pub fn new() -> Self {
        Self {
            records: HashMap::new(),
        }
    }

    /// Stores an immutable evidence record into the store
    pub fn record_evidence(&mut self, record: EvidenceRecord) -> Blake3Id {
        let id = record.evidence_id;
        self.records.insert(id, record);
        id
    }

    /// Retrieves an evidence record by its deterministic Blake3Id
    pub fn get_evidence(&self, id: &Blake3Id) -> Option<&EvidenceRecord> {
        self.records.get(id)
    }

    /// Returns the complete evidence chain for an investigation target
    pub fn get_chain_for_target(&self, target_id: &Blake3Id) -> Vec<&EvidenceRecord> {
        self.records
            .values()
            .filter(|r| &r.input_target_id == target_id)
            .collect()
    }
}

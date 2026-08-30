// SENTINEL V6: Canonical 6-Stage Vulnerability Lifecycle Domain Entities
// crates/sentinel_common/src/domain/core.rs
//
// 1. Transaction -> 2. Observation -> 3. Candidate -> 4. VerificationResult -> 5. Evidence -> 6. Finding

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

use crate::domain::meta::{EntityMetadata, MessageRepresentation, TlsData};
use crate::enums::{FindingLifecycle, ObservationSource, Severity, VerificationStrategy};

// 1. Transaction
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transaction {
    pub meta: EntityMetadata,
    pub request: MessageRepresentation,
    pub response: Option<MessageRepresentation>,
    pub timing: Duration,
    pub tls_info: Option<TlsData>,
}

// 2. Observation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Observation {
    pub meta: EntityMetadata,
    pub source: ObservationSource,
    pub data_ref: Uuid,
}

// 3. Candidate
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Candidate {
    pub meta: EntityMetadata,
    pub source_observation_id: Uuid,
    pub hypothesis: String,
    pub status: String,
}

// Supporting verification structures
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerificationStrategyRef {
    pub strategy_type: VerificationStrategy,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiffData {
    pub structural_similarity: f32,
    pub bytes_added: usize,
    pub bytes_removed: usize,
    pub status_code_changed: bool,
    pub content_type_changed: bool,
}

// 4. Evidence & EvidenceVariant
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum EvidenceVariant {
    TransactionEvidence(Uuid),
    OastEvidence(Uuid),
    BrowserSnapshot(Uuid),
    TimingVariance {
        expected: Duration,
        actual: Duration,
    },
    Differential(DiffData),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Evidence {
    pub id: Uuid,
    pub verification_id: Uuid,
    pub variant: EvidenceVariant,
    pub created_at: DateTime<Utc>,
}

// 5. VerificationResult
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerificationResult {
    pub id: Uuid,
    pub candidate_id: Uuid,
    pub strategy_ref: VerificationStrategyRef,
    pub success: bool,
    pub confidence: f32,
    pub evidence: Vec<Evidence>,
    pub executed_at: DateTime<Utc>,
}

// 6. Finding
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finding {
    pub meta: EntityMetadata,
    pub title: String,
    pub severity: Severity,
    pub verification_id: Uuid,
    pub state: FindingLifecycle,
}

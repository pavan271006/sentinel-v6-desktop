//! SENTINEL Autonomous SQL Security Engine — Core Models (M03)
//!
//! Provides the foundational immutable entities, deterministic BLAKE3 IDs,
//! tri-graph representation (Knowledge, Application State, Investigation),
//! execution classes, and probability belief vectors.

use std::collections::HashMap;
use std::fmt;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Deterministic 32-byte content-derived identifier
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Blake3Id([u8; 32]);

impl Blake3Id {
    pub fn new(data: &[u8]) -> Self {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&result);
        Self(bytes)
    }

    pub fn random() -> Self {
        Self::new(Uuid::new_v4().as_bytes())
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }
}

impl fmt::Debug for Blake3Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Id({})", &self.to_hex()[0..8])
    }
}

impl fmt::Display for Blake3Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

/// Execution classification dictating scheduler routing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExecutionClass {
    /// Safe for concurrent dispatch in the 50-worker pool
    ParallelSafe,
    /// Must run in the isolated statistical timing lane (SPRT)
    TimingSensitive,
    /// Mutates or depends on backend DB state; isolated execution
    StateDependent,
    /// Requires strict execution sequence
    OrderDependent,
    /// Bound to an active user/session identity
    SessionSensitive,
    /// Multi-step workflow traversal
    WorkflowDependent,
}

/// Progressive Investigation Depth levels (D0..D10)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum InvestigationDepth {
    D0SurfaceDiscovery,
    D1InputDiscovery,
    D2BaselineProfile,
    D3ContextDbmsInference,
    D4InitialSqliDetection,
    D5CausalConfirmation,
    D6DbmsContextSpecialization,
    D7BlindInferential,
    D8WorkflowSecondOrder,
    D9DemonstratedCapability,
    D10FinalEvidenceClosure,
}

/// Lifecycle status of an investigation branch
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BranchStatus {
    Pending,
    Running,
    Supported,
    Rejected,
    Blocked,
    Inconclusive,
    Confirmed,
    Unreachable,
    NotApplicable,
}

/// Deterministic promotion status of a security finding
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum FindingStatus {
    Unknown,
    Candidate,
    Suspected,
    Probable,
    Confirmed,
}

/// Input Transport Surface classification (26 formats)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum InputSurfaceType {
    UrlQueryParam { key: String },
    FormBodyField { key: String },
    MultipartField { name: String },
    MultipartFilename { header: String },
    JsonScalarField { path: String },
    JsonNestedObject { path: String },
    JsonArrayElement { path: String, index: usize },
    XmlElement { tag: String },
    XmlAttribute { tag: String, attr: String },
    HttpCookie { name: String },
    StandardHeader { name: String },
    CustomGatewayHeader { name: String },
    RestPathSegment { index: usize, template_var: Option<String> },
    GraphQLVariable { key: String },
    GraphQLArgument { field: String, arg: String },
    GraphQLQueryDocument,
    WebSocketTextFrame,
    GrpcTranscodedField { field: String },
    PostgrestOperator { column: String, op: String },
    MessageQueuePayload { topic: String },
    Other(String),
}

/// Identity context under which testing is executed
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TargetIdentity {
    Anonymous,
    AuthenticatedUser { user_id: String, role: String },
    Administrator { admin_id: String },
    ServiceAccount { service_name: String },
}

/// A normalized candidate input target for investigation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputTarget {
    pub id: Blake3Id,
    pub endpoint_url: String,
    pub http_method: String,
    pub surface: InputSurfaceType,
    pub original_value: String,
    pub inferred_type: String,
    pub identity: TargetIdentity,
}

/// Probability belief distribution over a categorical domain (e.g. DBMS, Context)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeliefDistribution {
    pub probabilities: HashMap<String, f64>,
}

impl BeliefDistribution {
    pub fn uniform(keys: &[&str]) -> Self {
        let mut map = HashMap::new();
        if !keys.is_empty() {
            let p = 1.0 / (keys.len() as f64);
            for k in keys {
                map.insert(k.to_string(), p);
            }
        }
        Self { probabilities: map }
    }

    pub fn get(&self, key: &str) -> f64 {
        self.probabilities.get(key).copied().unwrap_or(0.0)
    }

    pub fn set(&mut self, key: String, p: f64) {
        self.probabilities.insert(key, p);
    }

    pub fn normalize(&mut self) {
        let sum: f64 = self.probabilities.values().sum();
        if sum > 0.0 {
            for v in self.probabilities.values_mut() {
                *v /= sum;
            }
        }
    }

    pub fn bayesian_update(&mut self, likelihoods: &HashMap<String, f64>) {
        for (k, likelihood) in likelihoods {
            let prior = self.get(k);
            self.set(k.clone(), prior * likelihood);
        }
        self.normalize();
    }

    pub fn top_hypothesis(&self) -> Option<(String, f64)> {
        self.probabilities
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(k, v)| (k.clone(), *v))
    }
}

/// An investigation test intent awaiting compilation and scheduling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestIntent {
    pub id: Blake3Id,
    pub input_target_id: Blake3Id,
    pub mechanism_id: String,
    pub technique_id: String,
    pub target_context_id: String,
    pub target_dbms_id: String,
    pub expected_oracle_id: String,
    pub execution_class: ExecutionClass,
    pub depth: InvestigationDepth,
    pub expected_information_gain: f64,
    pub request_cost: u32,
    pub raw_payload_template: String,
}

/// A node in the Application State Graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateNode {
    pub id: Blake3Id,
    pub endpoint_url: String,
    pub http_method: String,
    pub required_identity: TargetIdentity,
    pub discovered_at: DateTime<Utc>,
    pub is_seed: bool,
    pub response_status: u16,
    pub content_type: String,
}

/// A node in the Active Investigation Graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestigationBranch {
    pub branch_id: Blake3Id,
    pub input_target_id: Blake3Id,
    pub intent: TestIntent,
    pub status: BranchStatus,
    pub depth: InvestigationDepth,
    pub priority: f64,
    pub retries: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub pruning_reason: Option<String>,
}

/// An immutable evidence record backed by BLAKE3 content hashing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRecord {
    pub evidence_id: Blake3Id,
    pub branch_id: Blake3Id,
    pub input_target_id: Blake3Id,
    pub oracle_id: String,
    pub signal_strength: f64,
    pub observation_description: String,
    pub baseline_response_hash: Blake3Id,
    pub probe_response_hash: Blake3Id,
    pub control_response_hash: Option<Blake3Id>,
    pub latency_ms: f64,
    pub captured_at: DateTime<Utc>,
    pub counterfactual_proven: bool,
}

/// Complete finding metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfirmedSqliFinding {
    pub finding_id: Blake3Id,
    pub input_target: InputTarget,
    pub status: FindingStatus,
    pub mechanism_id: String,
    pub technique_id: String,
    pub confirmed_dbms: String,
    pub confirmed_context: String,
    pub demonstrated_impact: String,
    pub evidence_chain: Vec<Blake3Id>,
    pub reproduction_curl: String,
    pub discovered_at: DateTime<Utc>,
}

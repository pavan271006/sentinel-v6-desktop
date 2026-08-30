// SENTINEL V6: Operational & Subsystem Communication Structures
// crates/sentinel_common/src/operational.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::enums::{
    AccessLevel, HttpMethod, MutatorType, ParamLocation, ScanLifecycle, Severity, TaskLifecycle,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScopeDecision {
    pub decision_id: Uuid,
    pub allowed: bool,
    pub reason: String,
    pub matched_rule: Option<Uuid>,
    pub target: String,
    pub scope_version: u64,
    pub timestamp: DateTime<Utc>,
}

impl ScopeDecision {
    pub fn allow(
        target: impl Into<String>,
        scope_version: u64,
        matched_rule: Option<Uuid>,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            decision_id: Uuid::new_v4(),
            allowed: true,
            reason: reason.into(),
            matched_rule,
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }

    pub fn deny(
        target: impl Into<String>,
        scope_version: u64,
        matched_rule: Option<Uuid>,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            decision_id: Uuid::new_v4(),
            allowed: false,
            reason: reason.into(),
            matched_rule,
            target: target.into(),
            scope_version,
            timestamp: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParseWarning {
    pub code: String,
    pub severity: Severity,
    pub offset: usize,
    pub component: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub node_type: String,
    pub label: String,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: Uuid,
    pub source_id: Uuid,
    pub target_id: Uuid,
    pub edge_type: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FuzzProfile {
    pub insertion_points: Vec<ParamLocation>,
    pub mutators: Vec<MutatorType>,
    pub encoders: Vec<String>,
    pub concurrency: u32,
    pub request_budget: u64,
    pub timeout_ms: u64,
    pub stop_conditions: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InterceptRule {
    pub id: Uuid,
    pub match_condition: String,
    pub action: String,
    pub action_data_json: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginInput {
    pub transaction_id: Option<Uuid>,
    pub config_overrides: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SecurityCheck {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub severity: Severity,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OastConfig {
    pub bind_ip: String,
    pub base_domain: String,
    pub use_tls: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskStateUpdate {
    pub task_id: Uuid,
    pub state: TaskLifecycle,
    pub progress_pct: f32,
    pub error: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScanProgressUpdate {
    pub scan_id: Uuid,
    pub state: ScanLifecycle,
    pub progress_pct: f32,
    pub checks_completed: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedRequest {
    pub method: HttpMethod,
    pub uri: String,
    pub version: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedResponse {
    pub version: String,
    pub status_code: u16,
    pub reason: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct FuzzStream {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OastEvidence {
    pub token: String,
    pub interaction_time: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TechFingerprint {
    pub tech: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoverageReport {
    pub total: u32,
    pub tested: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NavigationResult {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthzMatrix {
    pub identities: Vec<Uuid>,
    pub endpoints: Vec<Uuid>,
    pub expected: HashMap<Uuid, AccessLevel>,
    pub actual: HashMap<Uuid, AccessLevel>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthzViolation {
    pub identity_id: Uuid,
    pub endpoint_id: Uuid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiRequest {
    pub prompt: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiResponse {
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilitySet {
    pub network: bool,
    pub filesystem: bool,
    pub secrets: bool,
    pub database: bool,
    pub browser: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: u32,
    pub max_execution_ms: u64,
    pub max_network_requests: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginSandboxConfig {
    pub capabilities: CapabilitySet,
    pub limits: ResourceLimits,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginOutput {
    pub output: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackManifest {
    pub id: String,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SubdomainAsset {
    pub domain: String,
    pub ip_addresses: Vec<String>,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CloudAsset {
    pub arn: String,
    pub service: String,
    pub region: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PRoute {
    pub path_template: String,
    pub method: HttpMethod,
    pub expected_params: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SastFinding {
    pub file_path: String,
    pub line_number: u32,
    pub snippet: String,
    pub taint_source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SymbolicPath {
    pub target_variable: String,
    pub constraints_solved: bool,
    pub mathematical_proof: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RlRewardModel {
    pub state_hash: String,
    pub actions_explored: usize,
    pub reward_score: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CryptoWeakness {
    pub protocol: String,
    pub weakness_type: String,
    pub extracted_private_key: Option<String>,
}

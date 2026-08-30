// SENTINEL V6: Canonical Supporting Domain Entities
// crates/sentinel_common/src/domain/supporting.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::domain::meta::EntityMetadata;
use crate::enums::{HttpMethod, ParamLocation, ReportFormat, TaskLifecycle, VerificationStrategy};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scope {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub includes: Vec<String>,
    pub excludes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Endpoint {
    pub id: Uuid,
    pub host: String,
    pub path: String,
    pub method: HttpMethod,
    pub timestamp: DateTime<Utc>,
    pub graph_node_id: Uuid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Payload {
    pub id: Uuid,
    pub injection_point: ParamLocation,
    pub payload_string: String,
    pub expected_behavior: VerificationStrategy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Identity {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub username: String,
    pub roles: Vec<String>,
    pub meta: Option<EntityMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub identity_id: Uuid,
    pub cookies: HashMap<String, String>,
    pub headers: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Asset {
    pub id: Uuid,
    pub asset_type: String,
    pub identifier: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Technology {
    pub id: String,
    pub name: String,
    pub category: String,
    pub version: Option<String>,
    pub confidence: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    pub state_id: String,
    pub state_type: String,
    pub payload_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workflow {
    pub id: Uuid,
    pub name: String,
    pub steps_json: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Resource {
    pub resource_type: String,
    pub limit_value: u64,
    pub current_usage: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Action {
    pub action_id: Uuid,
    pub action_type: String,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub task_type: String,
    pub priority: u8,
    pub state: TaskLifecycle,
    pub progress_pct: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub title: String,
    pub format: ReportFormat,
    pub file_path: String,
    pub config_json: String,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegressionTest {
    pub id: Uuid,
    pub finding_id: Uuid,
    pub seed_transaction_id: Uuid,
    pub expected_status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OASTInteraction {
    pub id: Uuid,
    pub token_id: Uuid,
    pub protocol: String,
    pub source_ip: String,
    pub raw_blob_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

pub type OastInteraction = OASTInteraction;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AttackPath {
    pub id: Uuid,
    pub start_node_id: Uuid,
    pub target_node_id: Uuid,
    pub edge_ids: Vec<Uuid>,
    pub risk_score: f32,
    pub discovered_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Note {
    pub id: Uuid,
    pub target_id: Uuid,
    pub author: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: Uuid,
    pub blob_id: Uuid,
    pub full_page: bool,
    pub timestamp: DateTime<Utc>,
}

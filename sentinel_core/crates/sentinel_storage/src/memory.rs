//! Engagement Memory Engine (SENTINEL Proprietary Engine 5)
//!
//! Provides project-isolated deterministic test history, prior findings index,
//! and negative control recall (SEC-08):
//! - Tracks previously tested payload hashes, endpoints, and parameters to avoid redundant fuzzing
//! - Remembers verified negative controls (endpoints proven non-vulnerable)
//! - Persists state to isolated project directory

use std::collections::HashMap;
use std::path::Path;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sentinel_common::enums::HttpMethod;
use sentinel_common::errors::SentinelError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TestedVectorRecord {
    pub id: Uuid,
    pub endpoint_path: String,
    pub http_method: HttpMethod,
    pub check_id: String,
    pub parameter_name: Option<String>,
    pub payload_sha256: String,
    pub status_code: u16,
    pub is_vulnerable: bool,
    pub tested_at: DateTime<Utc>,
}

impl TestedVectorRecord {
    pub fn new(
        endpoint_path: impl Into<String>,
        http_method: HttpMethod,
        check_id: impl Into<String>,
        parameter_name: Option<impl Into<String>>,
        payload_sha256: impl Into<String>,
        status_code: u16,
        is_vulnerable: bool,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            endpoint_path: endpoint_path.into(),
            http_method,
            check_id: check_id.into(),
            parameter_name: parameter_name.map(|p| p.into()),
            payload_sha256: payload_sha256.into(),
            status_code,
            is_vulnerable,
            tested_at: Utc::now(),
        }
    }

    pub fn key(&self) -> String {
        format!(
            "{}:{}:{}:{}",
            self.http_method,
            self.endpoint_path,
            self.check_id,
            self.parameter_name.as_deref().unwrap_or("")
        )
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NegativeControlRecord {
    pub id: Uuid,
    pub endpoint_path: String,
    pub http_method: HttpMethod,
    pub parameter_name: Option<String>,
    pub check_id: String,
    pub verified_negative: bool,
    pub proof_details: String,
    pub verified_at: DateTime<Utc>,
}

impl NegativeControlRecord {
    pub fn new(
        endpoint_path: impl Into<String>,
        http_method: HttpMethod,
        parameter_name: Option<impl Into<String>>,
        check_id: impl Into<String>,
        proof_details: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            endpoint_path: endpoint_path.into(),
            http_method,
            parameter_name: parameter_name.map(|p| p.into()),
            check_id: check_id.into(),
            verified_negative: true,
            proof_details: proof_details.into(),
            verified_at: Utc::now(),
        }
    }

    pub fn key(&self) -> String {
        format!(
            "{}:{}:{}:{}",
            self.http_method,
            self.endpoint_path,
            self.check_id,
            self.parameter_name.as_deref().unwrap_or("")
        )
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EngagementMemory {
    pub tested_vectors: HashMap<String, TestedVectorRecord>,
    pub negative_controls: HashMap<String, NegativeControlRecord>,
}

impl EngagementMemory {
    pub fn new() -> Self {
        Self {
            tested_vectors: HashMap::new(),
            negative_controls: HashMap::new(),
        }
    }

    pub fn has_tested_vector(
        &self,
        http_method: HttpMethod,
        endpoint_path: &str,
        check_id: &str,
        parameter_name: Option<&str>,
    ) -> bool {
        let key = format!(
            "{}:{}:{}:{}",
            http_method,
            endpoint_path,
            check_id,
            parameter_name.unwrap_or("")
        );
        self.tested_vectors.contains_key(&key)
    }

    pub fn is_verified_negative(
        &self,
        http_method: HttpMethod,
        endpoint_path: &str,
        check_id: &str,
        parameter_name: Option<&str>,
    ) -> bool {
        let key = format!(
            "{}:{}:{}:{}",
            http_method,
            endpoint_path,
            check_id,
            parameter_name.unwrap_or("")
        );
        self.negative_controls.contains_key(&key)
    }

    pub fn record_tested_vector(&mut self, record: TestedVectorRecord) {
        let key = record.key();
        self.tested_vectors.insert(key, record);
    }

    pub fn record_negative_control(&mut self, record: NegativeControlRecord) {
        let key = record.key();
        self.negative_controls.insert(key, record);
    }

    pub fn get_negative_controls(&self) -> Vec<NegativeControlRecord> {
        self.negative_controls.values().cloned().collect()
    }

    pub fn save_to_json(&self, path: impl AsRef<Path>) -> Result<(), SentinelError> {
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| SentinelError::Serialization(e.to_string()))?;
        std::fs::write(path.as_ref(), content).map_err(SentinelError::Io)?;
        Ok(())
    }

    pub fn load_from_json(path: impl AsRef<Path>) -> Result<Self, SentinelError> {
        let content = std::fs::read_to_string(path.as_ref()).map_err(SentinelError::Io)?;
        let mem: Self = serde_json::from_str(&content)
            .map_err(|e| SentinelError::Serialization(e.to_string()))?;
        Ok(mem)
    }
}

// SENTINEL V6: Canonical Entity Metadata & Traffic Representation
// crates/sentinel_common/src/domain/meta.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::enums::{HttpMethod, LifecycleState, Provenance};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntityMetadata {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub provenance: Provenance,
    pub lifecycle: LifecycleState,
    pub scope_id: Option<Uuid>,
}

impl EntityMetadata {
    pub fn new(provenance: Provenance) -> Self {
        Self {
            id: Uuid::new_v4(),
            version: 1,
            timestamp: Utc::now(),
            provenance,
            lifecycle: LifecycleState::Active,
            scope_id: None,
        }
    }

    pub fn with_id(mut self, id: Uuid) -> Self {
        self.id = id;
        self
    }

    pub fn with_scope(mut self, scope_id: Uuid) -> Self {
        self.scope_id = Some(scope_id);
        self
    }

    pub fn advance_version(&mut self) {
        self.version += 1;
        self.timestamp = Utc::now();
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HttpParsedParts {
    pub method: HttpMethod,
    pub uri: String,
    pub version: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TlsData {
    pub protocol: String,
    pub cipher: String,
    pub server_name: Option<String>,
    pub alpn: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageRepresentation {
    pub raw_blob_id: Uuid,
    pub parsed: HttpParsedParts,
    pub normalized_text: String,
}

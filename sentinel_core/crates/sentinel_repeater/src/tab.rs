//! Repeater Tab & Revision History Domain Model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RepeaterRevision {
    pub revision_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub request_raw: Vec<u8>,
    pub response_raw: Option<Vec<u8>>,
    pub status_code: Option<u16>,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RepeaterTab {
    pub id: Uuid,
    pub title: String,
    pub target_url: String,
    pub use_tls: bool,
    pub current_request_raw: Vec<u8>,
    pub current_response_raw: Option<Vec<u8>>,
    pub history: Vec<RepeaterRevision>,
    pub active_history_index: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl RepeaterTab {
    pub fn new(
        title: impl Into<String>,
        target_url: impl Into<String>,
        initial_request: Vec<u8>,
    ) -> Self {
        let target_str: String = target_url.into();
        let use_tls = target_str.starts_with("https://");

        Self {
            id: Uuid::new_v4(),
            title: title.into(),
            target_url: target_str,
            use_tls,
            current_request_raw: initial_request,
            current_response_raw: None,
            history: Vec::new(),
            active_history_index: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn record_execution(
        &mut self,
        request_sent: Vec<u8>,
        response_received: Option<Vec<u8>>,
        status: Option<u16>,
        duration_ms: u64,
        error: Option<String>,
    ) {
        self.current_response_raw = response_received.clone();
        self.updated_at = Utc::now();

        let revision = RepeaterRevision {
            revision_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            request_raw: request_sent,
            response_raw: response_received,
            status_code: status,
            duration_ms,
            error,
        };

        self.history.push(revision);
        self.active_history_index = self.history.len().saturating_sub(1);
    }
}

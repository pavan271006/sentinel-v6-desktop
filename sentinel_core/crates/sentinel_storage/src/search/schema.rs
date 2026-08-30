//! Schema and Document model for BM25 HTTP transaction search index.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpSearchDocument {
    pub tx_id: Uuid,
    pub timestamp: i64,
    pub req_method: String,
    pub req_uri: String,
    pub req_headers: String,
    pub req_body: String,
    pub res_status: u64,
    pub res_headers: String,
    pub res_body: String,
    pub content_type: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHitResult {
    pub tx_id: Uuid,
    pub score: f32,
    pub req_method: String,
    pub req_uri: String,
    pub res_status: u64,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilter {
    pub method: Option<String>,
    pub min_status: Option<u64>,
    pub max_status: Option<u64>,
    pub tag: Option<String>,
}

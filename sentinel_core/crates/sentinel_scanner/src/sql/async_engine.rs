//! SENTINEL Autonomous SQL Security Engine — Async Workflow Engine (M25)
//!
//! Correlates delayed asynchronous background worker jobs and queue payloads
//! with polling endpoints and OAST callback signals.

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use crate::sql::models::Blake3Id;

#[derive(Debug, Clone)]
pub struct DistributedTraceContext {
    pub trace_id: String,
    pub span_id: String,
    pub traceparent_header: String,
    pub b3_trace_id: String,
}

#[derive(Debug, Clone)]
pub struct AsyncJobTracker {
    pub job_id: String,
    pub target_id: Blake3Id,
    pub poll_url: Option<String>,
    pub trace_ctx: Option<DistributedTraceContext>,
    pub registered_at: DateTime<Utc>,
    pub completed: bool,
}

pub struct AsyncWorkflowEngine {
    jobs: HashMap<String, AsyncJobTracker>,
}

impl AsyncWorkflowEngine {
    pub fn new() -> Self {
        Self {
            jobs: HashMap::new(),
        }
    }

    /// Generates W3C TraceContext and B3 propagation headers for tracking multi-hop async injection
    pub fn generate_trace_context(target_id: &Blake3Id) -> DistributedTraceContext {
        let hex_str = target_id.to_hex();
        let trace_id = hex_str[..32].to_string();
        let span_id = hex_str[..16].to_string();
        let traceparent = format!("00-{}-{}-01", trace_id, span_id);

        DistributedTraceContext {
            trace_id: trace_id.clone(),
            span_id,
            traceparent_header: traceparent,
            b3_trace_id: trace_id,
        }
    }

    /// Registers a background asynchronous job for periodic polling
    pub fn register_async_job(&mut self, job_id: String, target_id: Blake3Id, poll_url: Option<String>) {
        let trace_ctx = Some(Self::generate_trace_context(&target_id));
        let tracker = AsyncJobTracker {
            job_id: job_id.clone(),
            target_id,
            poll_url,
            trace_ctx,
            registered_at: Utc::now(),
            completed: false,
        };
        self.jobs.insert(job_id, tracker);
    }

    pub fn mark_completed(&mut self, job_id: &str) {
        if let Some(j) = self.jobs.get_mut(job_id) {
            j.completed = true;
        }
    }

    pub fn get_job(&self, job_id: &str) -> Option<&AsyncJobTracker> {
        self.jobs.get(job_id)
    }
}

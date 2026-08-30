//! Repeater Manager (Workspace & Tab Orchestration)

use std::sync::Arc;

use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::errors::SentinelError;

use crate::diff::{ResponseDiff, ResponseDiffResult};
use crate::executor::{ExecutionOutput, RepeaterExecutor};
use crate::tab::RepeaterTab;
use crate::variables::VariableEnvironment;

pub struct RepeaterManager {
    tabs: Arc<RwLock<Vec<RepeaterTab>>>,
    executor: Arc<RepeaterExecutor>,
    env: Arc<RwLock<VariableEnvironment>>,
}

impl RepeaterManager {
    pub fn new(executor: Arc<RepeaterExecutor>) -> Self {
        Self {
            tabs: Arc::new(RwLock::new(Vec::new())),
            executor,
            env: Arc::new(RwLock::new(VariableEnvironment::new())),
        }
    }

    pub fn environment(&self) -> Arc<RwLock<VariableEnvironment>> {
        self.env.clone()
    }

    pub fn create_tab(
        &self,
        title: impl Into<String>,
        target_url: impl Into<String>,
        initial_request: Vec<u8>,
    ) -> Uuid {
        let tab = RepeaterTab::new(title, target_url, initial_request);
        let id = tab.id;
        self.tabs.write().push(tab);
        id
    }

    pub fn get_tab(&self, id: Uuid) -> Option<RepeaterTab> {
        self.tabs.read().iter().find(|t| t.id == id).cloned()
    }

    pub fn list_tabs(&self) -> Vec<RepeaterTab> {
        self.tabs.read().clone()
    }

    pub fn close_tab(&self, id: Uuid) -> bool {
        let mut tabs = self.tabs.write();
        if let Some(pos) = tabs.iter().position(|t| t.id == id) {
            tabs.remove(pos);
            true
        } else {
            false
        }
    }

    pub fn update_tab_request(
        &self,
        id: Uuid,
        new_raw_request: Vec<u8>,
    ) -> Result<(), SentinelError> {
        let mut tabs = self.tabs.write();
        if let Some(tab) = tabs.iter_mut().find(|t| t.id == id) {
            tab.current_request_raw = new_raw_request;
            tab.updated_at = chrono::Utc::now();
            Ok(())
        } else {
            Err(SentinelError::Storage(format!(
                "RepeaterTab with id '{}' not found",
                id
            )))
        }
    }

    /// Executes the active request in the specified tab.
    pub async fn execute_tab(&self, id: Uuid) -> Result<ExecutionOutput, SentinelError> {
        let (target_url, raw_request) = {
            let tabs = self.tabs.read();
            let tab = tabs.iter().find(|t| t.id == id).ok_or_else(|| {
                SentinelError::Storage(format!("RepeaterTab with id '{}' not found", id))
            })?;
            (tab.target_url.clone(), tab.current_request_raw.clone())
        };

        let env_snapshot = self.env.read().clone();
        let result = self
            .executor
            .execute_raw(&target_url, &raw_request, Some(&env_snapshot))
            .await;

        let mut tabs = self.tabs.write();
        if let Some(tab) = tabs.iter_mut().find(|t| t.id == id) {
            match &result {
                Ok(output) => {
                    tab.record_execution(
                        raw_request,
                        Some(output.raw_response.clone()),
                        output.status_code,
                        output.duration_ms,
                        None,
                    );
                }
                Err(err) => {
                    tab.record_execution(raw_request, None, None, 0, Some(err.to_string()));
                }
            }
        }

        result
    }

    /// Computes response diff between two revisions in a tab.
    pub fn diff_revisions(
        &self,
        tab_id: Uuid,
        idx_a: usize,
        idx_b: usize,
    ) -> Result<ResponseDiffResult, SentinelError> {
        let tabs = self.tabs.read();
        let tab = tabs.iter().find(|t| t.id == tab_id).ok_or_else(|| {
            SentinelError::Storage(format!("RepeaterTab with id '{}' not found", tab_id))
        })?;

        let rev_a = tab.history.get(idx_a).ok_or_else(|| {
            SentinelError::Storage(format!("RepeaterRevision index '{}' not found", idx_a))
        })?;

        let rev_b = tab.history.get(idx_b).ok_or_else(|| {
            SentinelError::Storage(format!("RepeaterRevision index '{}' not found", idx_b))
        })?;

        let body_a = rev_a
            .response_raw
            .as_ref()
            .map(|b| String::from_utf8_lossy(b).to_string())
            .unwrap_or_default();
        let body_b = rev_b
            .response_raw
            .as_ref()
            .map(|b| String::from_utf8_lossy(b).to_string())
            .unwrap_or_default();

        let line_diffs = ResponseDiff::diff_text(&body_a, &body_b);
        let has_divergence = line_diffs
            .iter()
            .any(|d| d.kind != crate::diff::DiffKind::Unchanged);

        let size_a = rev_a.response_raw.as_ref().map(|b| b.len()).unwrap_or(0);
        let size_b = rev_b.response_raw.as_ref().map(|b| b.len()).unwrap_or(0);

        Ok(ResponseDiffResult {
            status_delta: match (rev_a.status_code, rev_b.status_code) {
                (Some(a), Some(b)) => Some((a, b)),
                _ => None,
            },
            duration_delta_ms: Some((rev_a.duration_ms, rev_b.duration_ms)),
            size_delta_bytes: (size_a, size_b),
            header_diffs: Vec::new(),
            body_line_diffs: line_diffs,
            has_divergence,
        })
    }
}

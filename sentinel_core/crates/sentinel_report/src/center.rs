//! Findings Center & Triage Filter Engine

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use sentinel_common::domain::Finding;
use sentinel_common::enums::{FindingLifecycle, Severity};

pub struct FindingsCenter {
    findings: Arc<RwLock<HashMap<Uuid, Finding>>>,
}

impl FindingsCenter {
    pub fn new() -> Self {
        Self {
            findings: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn insert_finding(&self, finding: Finding) {
        self.findings.write().insert(finding.meta.id, finding);
    }

    pub fn get_finding(&self, id: Uuid) -> Option<Finding> {
        self.findings.read().get(&id).cloned()
    }

    pub fn filter_by_severity(&self, severity: Severity) -> Vec<Finding> {
        self.findings
            .read()
            .values()
            .filter(|f| f.severity == severity)
            .cloned()
            .collect()
    }

    pub fn filter_by_state(&self, state: FindingLifecycle) -> Vec<Finding> {
        self.findings
            .read()
            .values()
            .filter(|f| f.state == state)
            .cloned()
            .collect()
    }

    pub fn all_findings(&self) -> Vec<Finding> {
        self.findings.read().values().cloned().collect()
    }
}

impl Default for FindingsCenter {
    fn default() -> Self {
        Self::new()
    }
}

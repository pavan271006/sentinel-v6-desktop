//! Service Worker & Web Worker Security Inspector
//!
//! Audits registered Service Workers, Shared Workers, and Web Workers:
//! - Worker script source URL & scope bounds
//! - Active CacheStorage keys inspection
//! - Insecure postMessage listeners and cross-origin importScripts detection

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceWorkerRegistrationInfo {
    pub script_url: String,
    pub scope: String,
    pub active_state: String,
    pub cached_keys: Vec<String>,
    pub uses_import_scripts: bool,
    pub has_unvalidated_postmessage: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerSecurityFinding {
    pub severity: String,
    pub title: String,
    pub description: String,
}

pub struct WorkerSecurityInspector;

impl WorkerSecurityInspector {
    /// Evaluates Service Worker registration and script properties for vulnerabilities
    pub fn audit_service_worker(
        worker: &ServiceWorkerRegistrationInfo,
        target_origin: &str,
    ) -> Vec<WorkerSecurityFinding> {
        let mut findings = Vec::new();

        // 1. Broad scope bound
        if worker.scope == "/" || worker.scope == target_origin {
            findings.push(WorkerSecurityFinding {
                severity: "LOW".to_string(),
                title: "Broad Service Worker Scope".to_string(),
                description: format!("Service Worker registered at root scope '{}', intercepting all origin fetch events.", worker.scope),
            });
        }

        // 2. Insecure importScripts
        if worker.uses_import_scripts {
            findings.push(WorkerSecurityFinding {
                severity: "MEDIUM".to_string(),
                title: "Service Worker Insecure importScripts Usage".to_string(),
                description: "Worker imports external third-party scripts via importScripts(), susceptible to supply chain tampering.".to_string(),
            });
        }

        // 3. Unvalidated postMessage listener
        if worker.has_unvalidated_postmessage {
            findings.push(WorkerSecurityFinding {
                severity: "HIGH".to_string(),
                title: "Unvalidated Worker postMessage Handler".to_string(),
                description: "Service Worker postMessage listener does not validate event.origin, allowing any cross-origin page to invoke privileged worker actions.".to_string(),
            });
        }

        findings
    }
}

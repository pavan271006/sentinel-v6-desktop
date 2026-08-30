// SENTINEL V6: Canonical Configuration Structures
// crates/sentinel_common/src/config.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::enums::ReportFormat;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub bind_address: String,
    pub port: u16,
    pub upstream_proxy: Option<String>,
    pub tls_cert_path: String,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            bind_address: "127.0.0.1".to_string(),
            port: 8080,
            upstream_proxy: None,
            tls_cert_path: "ca/sentinel_ca.crt".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceBudget {
    pub max_requests: u64,
    pub max_duration_secs: u64,
}

impl Default for ResourceBudget {
    fn default() -> Self {
        Self {
            max_requests: 100_000,
            max_duration_secs: 3600,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScanProfile {
    QuickPassive,
    StandardOwasp,
    DeepActive,
    ApiOnly,
    AuthFocused,
    CicdPipeline,
}

impl ScanProfile {
    pub fn to_scan_config(&self, scope_id: Uuid) -> ScanConfig {
        match self {
            Self::QuickPassive => ScanConfig {
                id: Uuid::new_v4(),
                scope_id,
                concurrency_limit: 10,
                active_plugins_json: serde_json::to_string(&[
                    "passive_headers",
                    "passive_cookies",
                    "passive_disclosure",
                    "passive_cors",
                ])
                .unwrap_or_default(),
                timestamp: Utc::now(),
                budget: ResourceBudget {
                    max_requests: 1_000,
                    max_duration_secs: 300,
                },
            },
            Self::StandardOwasp => ScanConfig {
                id: Uuid::new_v4(),
                scope_id,
                concurrency_limit: 25,
                active_plugins_json: serde_json::to_string(&[
                    "passive_all",
                    "active_sqli",
                    "active_xss",
                    "active_cors",
                    "active_debug",
                    "active_smuggling",
                ])
                .unwrap_or_default(),
                timestamp: Utc::now(),
                budget: ResourceBudget {
                    max_requests: 25_000,
                    max_duration_secs: 1800,
                },
            },
            Self::DeepActive => ScanConfig {
                id: Uuid::new_v4(),
                scope_id,
                concurrency_limit: 50,
                active_plugins_json: serde_json::to_string(&[
                    "all_checks",
                    "deep_fuzzing",
                    "multi_identity_authz",
                    "cloud_exposure",
                    "source_maps",
                ])
                .unwrap_or_default(),
                timestamp: Utc::now(),
                budget: ResourceBudget {
                    max_requests: 100_000,
                    max_duration_secs: 7200,
                },
            },
            Self::ApiOnly => ScanConfig {
                id: Uuid::new_v4(),
                scope_id,
                concurrency_limit: 30,
                active_plugins_json: serde_json::to_string(&[
                    "openapi_fuzz",
                    "graphql_introspection",
                    "jwt_tampering",
                    "cors_api",
                    "debug_endpoints",
                ])
                .unwrap_or_default(),
                timestamp: Utc::now(),
                budget: ResourceBudget {
                    max_requests: 30_000,
                    max_duration_secs: 1800,
                },
            },
            Self::AuthFocused => ScanConfig {
                id: Uuid::new_v4(),
                scope_id,
                concurrency_limit: 20,
                active_plugins_json: serde_json::to_string(&[
                    "bola_matrix",
                    "bfla_matrix",
                    "session_entropy",
                    "cookie_prefix",
                    "token_leakage",
                ])
                .unwrap_or_default(),
                timestamp: Utc::now(),
                budget: ResourceBudget {
                    max_requests: 15_000,
                    max_duration_secs: 1200,
                },
            },
            Self::CicdPipeline => ScanConfig {
                id: Uuid::new_v4(),
                scope_id,
                concurrency_limit: 15,
                active_plugins_json: serde_json::to_string(&[
                    "high_confidence_only",
                    "passive_all",
                    "cve_regression",
                ])
                .unwrap_or_default(),
                timestamp: Utc::now(),
                budget: ResourceBudget {
                    max_requests: 5_000,
                    max_duration_secs: 600,
                },
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScanConfig {
    pub id: Uuid,
    pub scope_id: Uuid,
    pub concurrency_limit: u32,
    pub active_plugins_json: String,
    pub timestamp: DateTime<Utc>,
    pub budget: ResourceBudget,
}

impl ScanConfig {
    pub fn new(scope_id: Uuid, concurrency_limit: u32) -> Self {
        Self {
            id: Uuid::new_v4(),
            scope_id,
            concurrency_limit,
            active_plugins_json: "[]".to_string(),
            timestamp: Utc::now(),
            budget: ResourceBudget::default(),
        }
    }

    pub fn from_profile(profile: ScanProfile, scope_id: Uuid) -> Self {
        profile.to_scan_config(scope_id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskConfig {
    pub task_type: String,
    pub priority: u8,
    pub target_id: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReportConfig {
    pub format: ReportFormat,
    pub finding_ids: Vec<Uuid>,
    pub include_evidence: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScopeConfig {
    pub default_action: String,
    pub max_rule_length: usize,
    pub rule_evaluation_timeout_ms: u64,
}

impl Default for ScopeConfig {
    fn default() -> Self {
        Self {
            default_action: "DENY".to_string(),
            max_rule_length: 1000,
            rule_evaluation_timeout_ms: 100,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StorageConfig {
    pub sqlite_path: String,
    pub tantivy_path: String,
    pub blob_store_path: String,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            sqlite_path: "sentinel.db".to_string(),
            tantivy_path: "tantivy_index".to_string(),
            blob_store_path: "blobs".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub default_concurrency: u32,
    pub max_concurrency: u32,
    pub request_timeout_ms: u64,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            default_concurrency: 10,
            max_concurrency: 100,
            request_timeout_ms: 10_000,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiConfig {
    pub enabled: bool,
    pub provider: String,
    pub model: String,
    pub policy_enforcement: bool,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "local".to_string(),
            model: "sentinel-sec-expert".to_string(),
            policy_enforcement: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginConfig {
    pub plugin_directory: String,
    pub max_wasm_memory_mb: u32,
    pub allow_rhai_scripts: bool,
}

impl Default for PluginConfig {
    fn default() -> Self {
        Self {
            plugin_directory: "plugins".to_string(),
            max_wasm_memory_mb: 64,
            allow_rhai_scripts: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct SentinelConfig {
    pub proxy: ProxyConfig,
    pub scope: ScopeConfig,
    pub storage: StorageConfig,
    pub scanner: ScannerConfig,
    pub ai: AiConfig,
    pub plugins: PluginConfig,
}

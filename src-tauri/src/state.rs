use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Serialize, Deserialize};
use sentinel_storage::{ProjectStorage, SqliteObservationStore};
use sentinel_scope::DefaultScopeEngine;
use sentinel_bus::{EventBusConfig, SentinelEventBus};
use sentinel_proxy::SentinelProxyEngine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStatus {
    pub proxy_running: bool,
    pub proxy_port: u16,
    pub active_project: Option<String>,
    pub db_size_bytes: u64,
    pub memory_rss_bytes: u64,
    pub ipc_latency_ms: f64,
    pub scope_active: bool,
    pub scope_rules_count: usize,
    pub backend_version: String,
}

impl Default for AppStatus {
    fn default() -> Self {
        Self {
            proxy_running: false,
            proxy_port: 8080,
            active_project: None,
            db_size_bytes: 0,
            memory_rss_bytes: 0,
            ipc_latency_ms: 0.5,
            scope_active: true,
            scope_rules_count: 0,
            backend_version: "6.0.0".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    pub db_size_bytes: u64,
    pub created_at: String,
    pub updated_at: String,
    pub scope_rules_count: usize,
    pub transaction_count: usize,
    pub finding_count: usize,
    pub wal_journal_mode: String,
    pub is_clean_shutdown: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened: String,
    pub size_bytes: u64,
    pub scope_rules_count: usize,
    pub finding_count: usize,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeRuleDef {
    pub id: String,
    pub rule_type: String,
    pub pattern_type: String,
    pub pattern: String,
    pub enabled: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeResponse {
    pub id: String,
    pub version: u64,
    pub timestamp: String,
    pub includes: Vec<String>,
    pub excludes: Vec<String>,
    pub rules: Option<Vec<ScopeRuleDef>>,
}

pub struct AppState {
    pub status: Arc<Mutex<AppStatus>>,
    pub active_project_storage: Arc<Mutex<Option<ProjectStorage>>>,
    pub active_observation_store: Arc<Mutex<Option<SqliteObservationStore>>>,
    pub current_project: Arc<Mutex<Option<ProjectMetadata>>>,
    pub recent_projects: Arc<Mutex<Vec<RecentProjectInfo>>>,
    pub active_scope: Arc<Mutex<ScopeResponse>>,
    pub active_scope_engine: Arc<Mutex<DefaultScopeEngine>>,
    pub event_bus: Arc<SentinelEventBus>,
    #[allow(dead_code)]
    pub proxy_engine: Arc<Mutex<Option<SentinelProxyEngine>>>,
}

impl AppState {
    pub fn new() -> Self {
        let initial_scope = ScopeResponse {
            id: uuid::Uuid::new_v4().to_string(),
            version: 1,
            timestamp: chrono::Utc::now().to_rfc3339(),
            includes: vec!["target.local".to_string(), "https://api.target.local/*".to_string()],
            excludes: vec![
                "169.254.169.254/32".to_string(),
                "10.0.0.0/8".to_string(),
                "127.0.0.1/32".to_string(),
                ".*\\.(logout|signout|delete-account).*".to_string(),
            ],
            rules: Some(vec![
                ScopeRuleDef {
                    id: "rule-01".to_string(),
                    rule_type: "INCLUDE".to_string(),
                    pattern_type: "HOST".to_string(),
                    pattern: "target.local".to_string(),
                    enabled: true,
                    notes: Some("Primary target domain".to_string()),
                },
                ScopeRuleDef {
                    id: "rule-02".to_string(),
                    rule_type: "INCLUDE".to_string(),
                    pattern_type: "URL_PREFIX".to_string(),
                    pattern: "https://api.target.local/*".to_string(),
                    enabled: true,
                    notes: Some("API endpoints".to_string()),
                },
                ScopeRuleDef {
                    id: "rule-03".to_string(),
                    rule_type: "EXCLUDE".to_string(),
                    pattern_type: "IP_CIDR".to_string(),
                    pattern: "169.254.169.254/32".to_string(),
                    enabled: true,
                    notes: Some("AWS/GCP metadata SSRF protection (SEC-01)".to_string()),
                },
                ScopeRuleDef {
                    id: "rule-04".to_string(),
                    rule_type: "EXCLUDE".to_string(),
                    pattern_type: "IP_CIDR".to_string(),
                    pattern: "10.0.0.0/8".to_string(),
                    enabled: true,
                    notes: Some("Internal intranet RFC1918 SSRF guard".to_string()),
                },
                ScopeRuleDef {
                    id: "rule-05".to_string(),
                    rule_type: "EXCLUDE".to_string(),
                    pattern_type: "IP_CIDR".to_string(),
                    pattern: "127.0.0.1/32".to_string(),
                    enabled: true,
                    notes: Some("Loopback socket isolation".to_string()),
                },
                ScopeRuleDef {
                    id: "rule-06".to_string(),
                    rule_type: "EXCLUDE".to_string(),
                    pattern_type: "REGEX".to_string(),
                    pattern: ".*\\.(logout|signout|delete-account).*".to_string(),
                    enabled: true,
                    notes: Some("Destructive endpoint protection".to_string()),
                },
            ]),
        };

        let common_scope = sentinel_common::Scope {
            id: uuid::Uuid::new_v4(),
            version: 1,
            timestamp: chrono::Utc::now(),
            includes: initial_scope.includes.clone(),
            excludes: initial_scope.excludes.clone(),
        };
        let engine = DefaultScopeEngine::new(common_scope);
        let bus = Arc::new(SentinelEventBus::new(EventBusConfig::default()));

        Self {
            status: Arc::new(Mutex::new(AppStatus::default())),
            active_project_storage: Arc::new(Mutex::new(None)),
            active_observation_store: Arc::new(Mutex::new(None)),
            current_project: Arc::new(Mutex::new(None)),
            recent_projects: Arc::new(Mutex::new(Vec::new())),
            active_scope: Arc::new(Mutex::new(initial_scope)),
            active_scope_engine: Arc::new(Mutex::new(engine)),
            event_bus: bus,
            proxy_engine: Arc::new(Mutex::new(None)),
        }
    }
}

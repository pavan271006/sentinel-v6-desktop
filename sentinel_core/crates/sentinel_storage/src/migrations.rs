// crates/sentinel_storage/src/migrations.rs
//
// Authoritative Schema Migration Runner for SQLite WAL Storage.
// Strictly embeds and executes the full 32-table DDL from V6_SQLITE_SCHEMA.sql
// with migration tracking and idempotent execution.

use sentinel_common::SentinelError;
use sqlx::{Row, SqlitePool};

pub const SCHEMA_VERSION: i64 = 1;
pub const SCHEMA_NAME: &str = "v6_canonical_schema";

pub const SQLITE_SCHEMA_SQL: &str = r#"
-- PRAGMA configuration
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

-- ==========================================
-- 1. Core Platform & Project Scope
-- ==========================================

CREATE TABLE IF NOT EXISTS scopes (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    includes_json TEXT NOT NULL,
    excludes_json TEXT NOT NULL
);

-- ==========================================
-- 2. Knowledge Graph (Assets & Endpoints)
-- ==========================================

CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    node_type TEXT NOT NULL,
    label TEXT NOT NULL,
    metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);

CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    graph_node_id TEXT NOT NULL,
    FOREIGN KEY (graph_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoints_unique ON endpoints(host, path, method);
CREATE INDEX IF NOT EXISTS idx_endpoints_graph_node ON endpoints(graph_node_id);

CREATE TABLE IF NOT EXISTS parameters (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    inferred_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parameters_endpoint ON parameters(endpoint_id);

-- ==========================================
-- 3. Observations & Transactions
-- ==========================================

CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    provenance TEXT NOT NULL,
    source TEXT NOT NULL,
    data_ref TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_observations_data_ref ON observations(data_ref);
CREATE INDEX IF NOT EXISTS idx_observations_scope ON observations(scope_id);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    protocol TEXT NOT NULL,
    stream_id INTEGER,
    req_method TEXT NOT NULL,
    req_uri TEXT NOT NULL,
    req_blob_id TEXT NOT NULL,
    req_normalized_text TEXT NOT NULL,
    res_status INTEGER,
    res_blob_id TEXT,
    res_normalized_text TEXT,
    timing_ms INTEGER NOT NULL,
    tls_cipher TEXT,
    version INTEGER NOT NULL,
    provenance TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_uri ON transactions(req_uri);
CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope_id);

-- ==========================================
-- 4. Identities, Sessions & Authorization
-- ==========================================

CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    username TEXT NOT NULL,
    roles_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    cookies_json TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME,
    FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_identity ON sessions(identity_id);

CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    secret_reference TEXT NOT NULL,
    access_level TEXT NOT NULL,
    expires_at DATETIME,
    FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credentials_identity ON credentials(identity_id);

-- ==========================================
-- 5. Out-of-Band (OAST)
-- ==========================================

CREATE TABLE IF NOT EXISTS oast_tokens (
    id TEXT PRIMARY KEY,
    token_string TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL,
    context_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_oast_tokens_string ON oast_tokens(token_string);

CREATE TABLE IF NOT EXISTS oast_interactions (
    id TEXT PRIMARY KEY,
    token_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    protocol TEXT NOT NULL,
    source_ip TEXT NOT NULL,
    raw_blob_id TEXT NOT NULL,
    FOREIGN KEY (token_id) REFERENCES oast_tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oast_interactions_token ON oast_interactions(token_id);

-- ==========================================
-- 6. Verification Pipeline & Findings
-- ==========================================

CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    source_observation_id TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    status TEXT NOT NULL,
    version INTEGER NOT NULL,
    provenance TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (source_observation_id) REFERENCES observations(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_source_obs ON candidates(source_observation_id);

CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    strategy_type TEXT NOT NULL,
    strategy_version TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    confidence REAL NOT NULL,
    executed_at DATETIME NOT NULL,
    duration_ms INTEGER NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verifications_candidate ON verifications(candidate_id);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    verification_id TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    data_blob_id TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (verification_id) REFERENCES verifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_verification ON evidence(verification_id);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    verification_id TEXT NOT NULL,
    state TEXT NOT NULL,
    provenance TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    scope_id TEXT,
    FOREIGN KEY (verification_id) REFERENCES verifications(id) ON DELETE CASCADE,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_verification ON findings(verification_id);
CREATE INDEX IF NOT EXISTS idx_findings_state_severity ON findings(state, severity);
CREATE INDEX IF NOT EXISTS idx_findings_scope ON findings(scope_id);

-- ==========================================
-- 7. Task Engine Checkpoints & Workflows
-- ==========================================

CREATE TABLE IF NOT EXISTS task_checkpoints (
    task_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    last_updated DATETIME NOT NULL,
    state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    config_json TEXT NOT NULL,
    generated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS regression_tests (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    seed_transaction_id TEXT NOT NULL,
    expected_status TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
    FOREIGN KEY (seed_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_regression_tests_finding ON regression_tests(finding_id);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_target ON notes(target_id);

CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY,
    blob_id TEXT NOT NULL,
    full_page BOOLEAN NOT NULL,
    timestamp DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS attack_paths (
    id TEXT PRIMARY KEY,
    start_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    edges_json TEXT NOT NULL,
    risk_score REAL NOT NULL,
    discovered_at DATETIME NOT NULL,
    FOREIGN KEY (start_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attack_paths_start ON attack_paths(start_node_id);
CREATE INDEX IF NOT EXISTS idx_attack_paths_target ON attack_paths(target_node_id);

-- ==========================================
-- 8. Scanner & Proxy Management
-- ==========================================

CREATE TABLE IF NOT EXISTS scan_configs (
    id TEXT PRIMARY KEY,
    scope_id TEXT NOT NULL,
    concurrency_limit INTEGER NOT NULL,
    active_plugins_json TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_configs_scope ON scan_configs(scope_id);

CREATE TABLE IF NOT EXISTS proxy_intercept_rules (
    id TEXT PRIMARY KEY,
    match_condition TEXT NOT NULL,
    action TEXT NOT NULL,
    action_data_json TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1
);

-- ==========================================
-- 9. Adapter Tier Integration Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS subdomain_assets (
    domain TEXT PRIMARY KEY,
    ip_addresses_json TEXT NOT NULL,
    source TEXT NOT NULL,
    discovered_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_assets (
    arn TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    region TEXT NOT NULL,
    discovered_via_credential_id TEXT,
    FOREIGN KEY (discovered_via_credential_id) REFERENCES credentials(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_assets_credential ON cloud_assets(discovered_via_credential_id);

CREATE TABLE IF NOT EXISTS api_proutes (
    id TEXT PRIMARY KEY,
    path_template TEXT NOT NULL,
    method TEXT NOT NULL,
    expected_params_json TEXT NOT NULL,
    source_spec TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sast_findings (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    snippet TEXT NOT NULL,
    taint_source TEXT NOT NULL
);

-- ==========================================
-- 10. Research Tier Analysis Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS symbolic_proofs (
    id TEXT PRIMARY KEY,
    target_variable TEXT NOT NULL,
    z3_mathematical_proof TEXT NOT NULL,
    proved_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state_machine (
    state_hash TEXT PRIMARY KEY,
    url_path TEXT NOT NULL,
    dom_snapshot_hash TEXT NOT NULL,
    rl_reward_score REAL NOT NULL,
    discovered_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_weaknesses (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    weakness_type TEXT NOT NULL,
    extracted_private_key TEXT,
    pcap_reference TEXT NOT NULL
);

-- ==========================================
-- 11. Durable Audit Log & Critical Events
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    source TEXT NOT NULL,
    target TEXT,
    payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);
"#;

pub const CANONICAL_TABLE_NAMES: &[&str] = &[
    "scopes",
    "graph_nodes",
    "graph_edges",
    "endpoints",
    "parameters",
    "observations",
    "transactions",
    "identities",
    "sessions",
    "credentials",
    "oast_tokens",
    "oast_interactions",
    "candidates",
    "verifications",
    "evidence",
    "findings",
    "task_checkpoints",
    "workflows",
    "reports",
    "regression_tests",
    "notes",
    "screenshots",
    "attack_paths",
    "scan_configs",
    "proxy_intercept_rules",
    "subdomain_assets",
    "cloud_assets",
    "api_proutes",
    "sast_findings",
    "symbolic_proofs",
    "app_state_machine",
    "crypto_weaknesses",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationReport {
    pub version: i64,
    pub name: String,
    pub already_applied: bool,
    pub total_tables: usize,
}

/// Runs all canonical schema migrations idempotently.
pub async fn run_migrations(pool: &SqlitePool) -> Result<MigrationReport, SentinelError> {
    // 1. Create migration tracker table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at DATETIME NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(SentinelError::Database)?;

    // 2. Check if migration version 1 has already been applied
    let row = sqlx::query("SELECT version, name FROM schema_migrations WHERE version = ?")
        .bind(SCHEMA_VERSION)
        .fetch_optional(pool)
        .await
        .map_err(SentinelError::Database)?;

    if row.is_some() {
        let count = get_table_count(pool).await?;
        return Ok(MigrationReport {
            version: SCHEMA_VERSION,
            name: SCHEMA_NAME.to_string(),
            already_applied: true,
            total_tables: count,
        });
    }

    // 3. Execute all DDL statements in sequence
    for stmt in SQLITE_SCHEMA_SQL.split(';') {
        let trimmed = stmt.trim();
        if !trimmed.is_empty() {
            sqlx::query(trimmed)
                .execute(pool)
                .await
                .map_err(SentinelError::Database)?;
        }
    }

    // 4. Record migration in tracker table
    sqlx::query("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .bind(SCHEMA_VERSION)
        .bind(SCHEMA_NAME)
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    let count = get_table_count(pool).await?;

    Ok(MigrationReport {
        version: SCHEMA_VERSION,
        name: SCHEMA_NAME.to_string(),
        already_applied: false,
        total_tables: count,
    })
}

/// Returns a list of all tables currently existing in the SQLite database.
pub async fn list_tables(pool: &SqlitePool) -> Result<Vec<String>, SentinelError> {
    let rows = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(SentinelError::Database)?;

    let mut tables = Vec::new();
    for r in rows {
        let name: String = r.get("name");
        tables.push(name);
    }
    Ok(tables)
}

/// Returns the total number of user tables in the SQLite database.
pub async fn get_table_count(pool: &SqlitePool) -> Result<usize, SentinelError> {
    let tables = list_tables(pool).await?;
    Ok(tables.len())
}

/// Verifies that all 32 canonical tables defined in the specification exist in the database.
pub async fn verify_canonical_tables(pool: &SqlitePool) -> Result<bool, SentinelError> {
    let existing_tables = list_tables(pool).await?;
    for canonical in CANONICAL_TABLE_NAMES {
        if !existing_tables.iter().any(|t| t == canonical) {
            return Ok(false);
        }
    }
    Ok(true)
}

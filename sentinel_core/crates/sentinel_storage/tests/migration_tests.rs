// crates/sentinel_storage/tests/migration_tests.rs

use sentinel_storage::db::create_pool;
use sentinel_storage::migrations::{
    list_tables, run_migrations, verify_canonical_tables, CANONICAL_TABLE_NAMES,
};
use sqlx::Row;
use tempfile::tempdir;

#[tokio::test]
async fn test_full_32_table_migration_and_indexes() {
    let temp = tempdir().unwrap();
    let db_path = temp.path().join("test_migration.db");
    let pool = create_pool(&db_path).await.unwrap();

    let report = run_migrations(&pool)
        .await
        .expect("Migrations must succeed");
    assert_eq!(report.version, 1);
    assert!(!report.already_applied);

    // Verify all 32 canonical tables are created
    let canonical_verified = verify_canonical_tables(&pool).await.unwrap();
    assert!(
        canonical_verified,
        "All 32 canonical tables must be present in SQLite"
    );

    let tables = list_tables(&pool).await.unwrap();
    for expected in CANONICAL_TABLE_NAMES {
        assert!(
            tables.iter().any(|t| t == expected),
            "Table {} must exist",
            expected
        );
    }

    // Also check audit_events and schema_migrations
    assert!(tables.iter().any(|t| t == "audit_events"));
    assert!(tables.iter().any(|t| t == "schema_migrations"));

    // Verify indexes exist in sqlite_master
    let index_rows = sqlx::query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    let indexes: Vec<String> = index_rows.into_iter().map(|r| r.get("name")).collect();

    let expected_indexes = [
        "idx_graph_edges_source",
        "idx_graph_edges_target",
        "idx_endpoints_unique",
        "idx_endpoints_graph_node",
        "idx_parameters_endpoint",
        "idx_observations_data_ref",
        "idx_observations_scope",
        "idx_transactions_uri",
        "idx_transactions_scope",
        "idx_sessions_identity",
        "idx_credentials_identity",
        "idx_oast_tokens_string",
        "idx_oast_interactions_token",
        "idx_candidates_source_obs",
        "idx_verifications_candidate",
        "idx_evidence_verification",
        "idx_findings_verification",
        "idx_findings_state_severity",
        "idx_findings_scope",
        "idx_regression_tests_finding",
        "idx_notes_target",
        "idx_attack_paths_start",
        "idx_attack_paths_target",
        "idx_scan_configs_scope",
        "idx_cloud_assets_credential",
        "idx_audit_events_type",
        "idx_audit_events_timestamp",
    ];

    for idx in expected_indexes {
        assert!(
            indexes.iter().any(|name| name == idx),
            "Index {} must exist in database",
            idx
        );
    }
}

#[tokio::test]
async fn test_migration_idempotency_on_repeated_runs() {
    let temp = tempdir().unwrap();
    let db_path = temp.path().join("test_idempotency.db");
    let pool = create_pool(&db_path).await.unwrap();

    // First run
    let report1 = run_migrations(&pool).await.unwrap();
    assert!(!report1.already_applied);

    // Second run
    let report2 = run_migrations(&pool).await.unwrap();
    assert!(report2.already_applied);
    assert_eq!(report2.version, 1);

    // Third run
    let report3 = run_migrations(&pool).await.unwrap();
    assert!(report3.already_applied);

    // Verify tracker table records exactly 1 migration entry
    let row = sqlx::query("SELECT COUNT(*) FROM schema_migrations")
        .fetch_one(&pool)
        .await
        .unwrap();
    let count: i64 = row.get(0);
    assert_eq!(
        count, 1,
        "schema_migrations should record exactly 1 version"
    );
}

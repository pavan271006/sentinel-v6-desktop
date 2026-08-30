// crates/sentinel_storage/tests/sqlite_pragma_tests.rs

use sentinel_storage::db::{check_pragmas, create_pool, enforce_pragmas};
use sqlx::Row;
use tempfile::tempdir;

#[tokio::test]
async fn test_all_six_mandatory_pragmas_enforced() {
    let temp = tempdir().unwrap();
    let db_path = temp.path().join("test_pragma.db");

    let pool = create_pool(&db_path).await.expect("Failed to create pool");

    // 1. Verify through check_pragmas helper
    let status = check_pragmas(&pool).await.expect("Failed to check pragmas");
    assert_eq!(
        status.journal_mode.to_lowercase(),
        "wal",
        "journal_mode must be WAL"
    );
    assert_eq!(status.synchronous, 1, "synchronous must be NORMAL (1)");
    assert_eq!(status.foreign_keys, 1, "foreign_keys must be ON (1)");
    assert_eq!(status.busy_timeout, 5000, "busy_timeout must be 5000ms");
    assert_eq!(
        status.cache_size, -64000,
        "cache_size must be -64000 (64MB)"
    );
    assert_eq!(status.temp_store, 2, "temp_store must be MEMORY (2)");

    // 2. Direct raw SQL PRAGMA queries
    let jm: String = sqlx::query("PRAGMA journal_mode;")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(jm.to_lowercase(), "wal");

    let sync: i64 = sqlx::query("PRAGMA synchronous;")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(sync, 1);

    let fk: i64 = sqlx::query("PRAGMA foreign_keys;")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(fk, 1);

    let bt: i64 = sqlx::query("PRAGMA busy_timeout;")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(bt, 5000);

    let cs: i64 = sqlx::query("PRAGMA cache_size;")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(cs, -64000);

    let ts: i64 = sqlx::query("PRAGMA temp_store;")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(ts, 2);
}

#[tokio::test]
async fn test_foreign_keys_constraint_enforcement() {
    let temp = tempdir().unwrap();
    let db_path = temp.path().join("test_fk.db");
    let pool = create_pool(&db_path).await.unwrap();

    // Create a parent and child table with FK
    sqlx::query(
        "CREATE TABLE parent (id TEXT PRIMARY KEY);
         CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, FOREIGN KEY (parent_id) REFERENCES parent(id));"
    )
    .execute(&pool)
    .await
    .unwrap();

    // Inserting child referencing non-existent parent MUST fail due to PRAGMA foreign_keys = ON
    let res = sqlx::query("INSERT INTO child (id, parent_id) VALUES ('c1', 'nonexistent_p1')")
        .execute(&pool)
        .await;

    assert!(
        res.is_err(),
        "Foreign key constraint violation must be rejected by SQLite"
    );
}

#[tokio::test]
async fn test_re_enforce_pragmas_is_idempotent() {
    let temp = tempdir().unwrap();
    let db_path = temp.path().join("test_re_enforce.db");
    let pool = create_pool(&db_path).await.unwrap();

    // Re-enforcing pragmas must succeed seamlessly
    enforce_pragmas(&pool).await.unwrap();
    let status = check_pragmas(&pool).await.unwrap();
    assert_eq!(status.journal_mode.to_lowercase(), "wal");
    assert_eq!(status.foreign_keys, 1);
}

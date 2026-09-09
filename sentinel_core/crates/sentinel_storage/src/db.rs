// crates/sentinel_storage/src/db.rs
//
// SQLite Connection Pool Manager with Mandatory Security & Performance PRAGMAs.
// Strictly enforces:
// - PRAGMA journal_mode = WAL;
// - PRAGMA synchronous = NORMAL;
// - PRAGMA foreign_keys = ON;
// - PRAGMA busy_timeout = 5000;
// - PRAGMA cache_size = -64000;
// - PRAGMA temp_store = MEMORY;

use sentinel_common::SentinelError;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{Row, SqlitePool};
use std::path::Path;
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PragmaStatus {
    pub journal_mode: String,
    pub synchronous: i64,
    pub foreign_keys: i64,
    pub busy_timeout: i64,
    pub cache_size: i64,
    pub temp_store: i64,
}

/// Builds SQLite connection options with all mandatory PRAGMAs pre-configured.
pub fn default_connect_options(db_path: impl AsRef<Path>) -> SqliteConnectOptions {
    SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(Duration::from_millis(5000))
        .pragma("cache_size", "-64000")
        .pragma("temp_store", "MEMORY")
}

/// Creates a new SQLite connection pool with all mandatory PRAGMAs enforced.
pub async fn create_pool(db_path: impl AsRef<Path>) -> Result<SqlitePool, SentinelError> {
    let opts = default_connect_options(db_path);
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(opts)
        .await
        .map_err(SentinelError::Database)?;

    enforce_pragmas(&pool).await?;
    Ok(pool)
}

/// Explicitly executes PRAGMA statements across the pool to guarantee enforcement.
pub async fn enforce_pragmas(pool: &SqlitePool) -> Result<(), SentinelError> {
    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    sqlx::query("PRAGMA synchronous = NORMAL;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    sqlx::query("PRAGMA busy_timeout = 5000;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    sqlx::query("PRAGMA cache_size = -64000;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    sqlx::query("PRAGMA temp_store = MEMORY;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    sqlx::query("PRAGMA mmap_size = 268435456;")
        .execute(pool)
        .await
        .map_err(SentinelError::Database)?;

    Ok(())
}

/// Queries and verifies the current SQLite database PRAGMA configuration.
pub async fn check_pragmas(pool: &SqlitePool) -> Result<PragmaStatus, SentinelError> {
    let jm_row = sqlx::query("PRAGMA journal_mode;")
        .fetch_one(pool)
        .await
        .map_err(SentinelError::Database)?;
    let journal_mode: String = jm_row.get(0);

    let sync_row = sqlx::query("PRAGMA synchronous;")
        .fetch_one(pool)
        .await
        .map_err(SentinelError::Database)?;
    let synchronous: i64 = sync_row.get(0);

    let fk_row = sqlx::query("PRAGMA foreign_keys;")
        .fetch_one(pool)
        .await
        .map_err(SentinelError::Database)?;
    let foreign_keys: i64 = fk_row.get(0);

    let bt_row = sqlx::query("PRAGMA busy_timeout;")
        .fetch_one(pool)
        .await
        .map_err(SentinelError::Database)?;
    let busy_timeout: i64 = bt_row.get(0);

    let cs_row = sqlx::query("PRAGMA cache_size;")
        .fetch_one(pool)
        .await
        .map_err(SentinelError::Database)?;
    let cache_size: i64 = cs_row.get(0);

    let ts_row = sqlx::query("PRAGMA temp_store;")
        .fetch_one(pool)
        .await
        .map_err(SentinelError::Database)?;
    let temp_store: i64 = ts_row.get(0);

    Ok(PragmaStatus {
        journal_mode,
        synchronous,
        foreign_keys,
        busy_timeout,
        cache_size,
        temp_store,
    })
}

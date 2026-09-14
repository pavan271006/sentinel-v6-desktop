// crates/sentinel_storage/src/project.rs
//
// Strict Project Isolation (SEC-08).
// Enforces isolated physical workspace per project containing:
// - SQLite database (`db.sqlite` / `sentinel.db`)
// - CAS blob storage (`blobs/`)
// - Full-text search indices (`indexes/`)
// - Log audit traces (`logs/`)
// Strictly rejects cross-project path traversal escapes.

use sentinel_common::SentinelError;
use sqlx::SqlitePool;
use std::path::{Component, Path, PathBuf};
use tokio::fs;

use crate::cas::BlobStorage;
use crate::db::create_pool;
use crate::migrations::run_migrations;

#[derive(Clone)]
pub struct ProjectStorage {
    project_dir: PathBuf,
    db_path: PathBuf,
    blobs_dir: PathBuf,
    indexes_dir: PathBuf,
    logs_dir: PathBuf,
    pool: SqlitePool,
    cas: BlobStorage,
}

impl ProjectStorage {
    /// Opens or initializes an isolated project storage workspace at `project_dir`.
    pub async fn open(project_dir: impl AsRef<Path>) -> Result<Self, SentinelError> {
        let project_dir = project_dir.as_ref().to_path_buf();

        // Create workspace directories
        let blobs_dir = project_dir.join("blobs");
        let indexes_dir = project_dir.join("indexes");
        let logs_dir = project_dir.join("logs");

        fs::create_dir_all(&project_dir)
            .await
            .map_err(SentinelError::Io)?;
        fs::create_dir_all(&blobs_dir)
            .await
            .map_err(SentinelError::Io)?;
        fs::create_dir_all(&indexes_dir)
            .await
            .map_err(SentinelError::Io)?;
        fs::create_dir_all(&logs_dir)
            .await
            .map_err(SentinelError::Io)?;

        let db_path = project_dir.join("db.sqlite");

        // Initialize SQLite pool with mandatory PRAGMAs
        let pool = create_pool(&db_path).await?;

        // Run schema migrations idempotently
        run_migrations(&pool).await?;

        // Initialize CAS blob storage
        let cas = BlobStorage::new(&blobs_dir).await?;

        Ok(Self {
            project_dir,
            db_path,
            blobs_dir,
            indexes_dir,
            logs_dir,
            pool,
            cas,
        })
    }

    /// Resolves and validates a relative path inside the project workspace.
    /// Strictly enforces SEC-08 by rejecting any path traversal escapes (`..`).
    pub fn resolve_safe_path(
        &self,
        relative_path: impl AsRef<Path>,
    ) -> Result<PathBuf, SentinelError> {
        let rel = relative_path.as_ref();

        // Reject absolute paths
        if rel.is_absolute() {
            return Err(SentinelError::InvariantViolation(
                "Cross-project path traversal attempt: absolute paths prohibited (SEC-08)"
                    .to_string(),
            ));
        }

        // Check for parent directory navigation components or traversal tokens (cross-platform)
        let rel_str = rel.to_string_lossy();
        if rel_str.contains("..") {
            return Err(SentinelError::InvariantViolation(
                "Cross-project path traversal attempt detected (SEC-08)".to_string(),
            ));
        }

        for component in rel.components() {
            if component == Component::ParentDir {
                return Err(SentinelError::InvariantViolation(
                    "Cross-project path traversal attempt detected (SEC-08)".to_string(),
                ));
            }
        }

        let target_path = self.project_dir.join(rel);
        Ok(target_path)
    }

    /// Returns a reference to the project root directory.
    pub fn project_dir(&self) -> &Path {
        &self.project_dir
    }

    /// Returns a reference to the database file path.
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    /// Returns a reference to the CAS blobs directory.
    pub fn blobs_dir(&self) -> &Path {
        &self.blobs_dir
    }

    /// Returns a reference to the indexes directory.
    pub fn indexes_dir(&self) -> &Path {
        &self.indexes_dir
    }

    /// Returns a reference to the logs directory.
    pub fn logs_dir(&self) -> &Path {
        &self.logs_dir
    }

    /// Returns the database pool.
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Returns the CAS blob store.
    pub fn cas(&self) -> &BlobStorage {
        &self.cas
    }
}

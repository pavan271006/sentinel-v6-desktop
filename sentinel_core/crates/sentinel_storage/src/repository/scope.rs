// crates/sentinel_storage/src/repository/scope.rs
//
// Scope Repository for persisting, querying, and updating project scope boundaries.

use chrono::{DateTime, Utc};
use sentinel_common::{Scope, SentinelError};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone)]
pub struct ScopeRepository {
    pool: SqlitePool,
}

impl ScopeRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Inserts or replaces a scope record.
    pub async fn insert(&self, scope: &Scope) -> Result<(), SentinelError> {
        let id = scope.id.to_string();
        let ver = scope.version as i64;
        let ts = scope.timestamp.to_rfc3339();
        let inc_json = serde_json::to_string(&scope.includes)
            .map_err(|e| SentinelError::Serialization(e.to_string()))?;
        let exc_json = serde_json::to_string(&scope.excludes)
            .map_err(|e| SentinelError::Serialization(e.to_string()))?;

        sqlx::query(
            "INSERT OR REPLACE INTO scopes (id, version, timestamp, includes_json, excludes_json) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(ver)
        .bind(ts)
        .bind(inc_json)
        .bind(exc_json)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    /// Updates an existing scope record.
    pub async fn update(&self, scope: &Scope) -> Result<(), SentinelError> {
        self.insert(scope).await
    }

    /// Fetches a scope by UUID.
    pub async fn get(&self, id: Uuid) -> Result<Option<Scope>, SentinelError> {
        let id_str = id.to_string();
        let row = sqlx::query(
            "SELECT id, version, timestamp, includes_json, excludes_json FROM scopes WHERE id = ?",
        )
        .bind(&id_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        match row {
            Some(r) => Ok(Some(parse_scope_row(&r)?)),
            None => Ok(None),
        }
    }

    /// Lists all scope records ordered by timestamp descending.
    pub async fn list(&self) -> Result<Vec<Scope>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, version, timestamp, includes_json, excludes_json FROM scopes ORDER BY timestamp DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_scope_row(&r)?);
        }
        Ok(list)
    }

    /// Fetches the latest active scope.
    pub async fn get_latest(&self) -> Result<Option<Scope>, SentinelError> {
        let row = sqlx::query(
            "SELECT id, version, timestamp, includes_json, excludes_json FROM scopes ORDER BY timestamp DESC LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        match row {
            Some(r) => Ok(Some(parse_scope_row(&r)?)),
            None => Ok(None),
        }
    }

    /// Deletes a scope by UUID. Note: associated observations/transactions have scope_id set to NULL (ON DELETE SET NULL).
    pub async fn delete(&self, id: Uuid) -> Result<bool, SentinelError> {
        let id_str = id.to_string();
        let res = sqlx::query("DELETE FROM scopes WHERE id = ?")
            .bind(&id_str)
            .execute(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        Ok(res.rows_affected() > 0)
    }
}

pub fn parse_scope_row(r: &sqlx::sqlite::SqliteRow) -> Result<Scope, SentinelError> {
    let id_val: String = r.get("id");
    let ver: i64 = r.get("version");
    let ts_str: String = r.get("timestamp");
    let inc_json: String = r.get("includes_json");
    let exc_json: String = r.get("excludes_json");

    let timestamp = DateTime::parse_from_rfc3339(&ts_str)
        .map_err(|e| SentinelError::ParseError(e.to_string()))?
        .with_timezone(&Utc);

    let includes: Vec<String> =
        serde_json::from_str(&inc_json).map_err(|e| SentinelError::Serialization(e.to_string()))?;
    let excludes: Vec<String> =
        serde_json::from_str(&exc_json).map_err(|e| SentinelError::Serialization(e.to_string()))?;

    Ok(Scope {
        id: Uuid::parse_str(&id_val).map_err(|e| SentinelError::ParseError(e.to_string()))?,
        version: ver as u64,
        timestamp,
        includes,
        excludes,
    })
}

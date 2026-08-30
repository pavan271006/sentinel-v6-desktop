// crates/sentinel_storage/src/repository/observation.rs
//
// ObservationStore Trait Implementation and Repository Operations.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sentinel_common::{
    EntityMetadata, LifecycleState, Observation, ObservationSource, ObservationStore, Provenance,
    SentinelError,
};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone)]
pub struct ObservationRepository {
    pool: SqlitePool,
}

impl ObservationRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Counts total observations in storage.
    pub async fn count(&self) -> Result<i64, SentinelError> {
        let row = sqlx::query("SELECT COUNT(*) FROM observations")
            .fetch_one(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        let count: i64 = row.get(0);
        Ok(count)
    }

    /// Lists observations with pagination.
    pub async fn list(&self, limit: i64, offset: i64) -> Result<Vec<Observation>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id FROM observations ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut results = Vec::with_capacity(rows.len());
        for r in rows {
            results.push(parse_observation_row(&r)?);
        }
        Ok(results)
    }

    /// Deletes an observation by UUID. Returns true if a record was deleted.
    pub async fn delete(&self, id: Uuid) -> Result<bool, SentinelError> {
        let id_str = id.to_string();
        let res = sqlx::query("DELETE FROM observations WHERE id = ?")
            .bind(&id_str)
            .execute(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        Ok(res.rows_affected() > 0)
    }
}

#[async_trait]
impl ObservationStore for ObservationRepository {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError> {
        let id = obs.meta.id.to_string();
        let ver = obs.meta.version as i64;
        let ts = obs.meta.timestamp.to_rfc3339();
        let prov = format!("{:?}", obs.meta.provenance);
        let src = format!("{:?}", obs.source);
        let data_ref = obs.data_ref.to_string();
        let life = format!("{:?}", obs.meta.lifecycle);
        let scope_id = obs.meta.scope_id.map(|s| s.to_string());

        sqlx::query(
            "INSERT INTO observations (id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(ver)
        .bind(ts)
        .bind(prov)
        .bind(src)
        .bind(data_ref)
        .bind(life)
        .bind(scope_id)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    async fn insert_batch(&self, list: Vec<Observation>) -> Result<(), SentinelError> {
        let mut tx = self.pool.begin().await.map_err(SentinelError::Database)?;

        for obs in list {
            let id = obs.meta.id.to_string();
            let ver = obs.meta.version as i64;
            let ts = obs.meta.timestamp.to_rfc3339();
            let prov = format!("{:?}", obs.meta.provenance);
            let src = format!("{:?}", obs.source);
            let data_ref = obs.data_ref.to_string();
            let life = format!("{:?}", obs.meta.lifecycle);
            let scope_id = obs.meta.scope_id.map(|s| s.to_string());

            sqlx::query(
                "INSERT INTO observations (id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(ver)
            .bind(ts)
            .bind(prov)
            .bind(src)
            .bind(data_ref)
            .bind(life)
            .bind(scope_id)
            .execute(&mut *tx)
            .await
            .map_err(SentinelError::Database)?;
        }

        tx.commit().await.map_err(SentinelError::Database)?;
        Ok(())
    }

    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError> {
        let id_str = id.to_string();
        let row = sqlx::query(
            "SELECT id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id FROM observations WHERE id = ?"
        )
        .bind(&id_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        match row {
            Some(r) => Ok(Some(parse_observation_row(&r)?)),
            None => Ok(None),
        }
    }

    async fn query_sql(&self, sql: &str) -> Result<Vec<Observation>, SentinelError> {
        let rows = sqlx::query(sql)
            .fetch_all(&self.pool)
            .await
            .map_err(SentinelError::Database)?;

        let mut results = Vec::with_capacity(rows.len());
        for r in rows {
            results.push(parse_observation_row(&r)?);
        }
        Ok(results)
    }

    async fn search_fts(&self, query: &str) -> Result<Vec<Observation>, SentinelError> {
        let pattern = format!("%{}%", query);
        let sql = "SELECT id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id FROM observations WHERE source LIKE ? OR provenance LIKE ? OR id LIKE ? ORDER BY timestamp DESC";
        let rows = sqlx::query(sql)
            .bind(&pattern)
            .bind(&pattern)
            .bind(&pattern)
            .fetch_all(&self.pool)
            .await
            .map_err(SentinelError::Database)?;

        let mut results = Vec::with_capacity(rows.len());
        for r in rows {
            results.push(parse_observation_row(&r)?);
        }
        Ok(results)
    }

    async fn rebuild_index(&self) -> Result<(), SentinelError> {
        // SQLite index verification / vacuum pass
        sqlx::query("REINDEX idx_observations_data_ref")
            .execute(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        sqlx::query("REINDEX idx_observations_scope")
            .execute(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        Ok(())
    }
}

pub fn parse_observation_row(r: &sqlx::sqlite::SqliteRow) -> Result<Observation, SentinelError> {
    let id_val: String = r.get("id");
    let ver: i64 = r.get("version");
    let ts_str: String = r.get("timestamp");
    let prov_str: String = r.get("provenance");
    let src_str: String = r.get("source");
    let data_ref_str: String = r.get("data_ref");
    let life_str: String = r.get("lifecycle");
    let scope_id_str: Option<String> = r.get("scope_id");

    let timestamp = DateTime::parse_from_rfc3339(&ts_str)
        .map_err(|e| SentinelError::ParseError(e.to_string()))?
        .with_timezone(&Utc);

    let provenance = match prov_str.as_str() {
        "Scanner" => Provenance::Scanner,
        "Fuzzer" => Provenance::Fuzzer,
        "AI" => Provenance::AI,
        "Tool" => Provenance::Tool,
        "Manual" => Provenance::Manual,
        _ => Provenance::Proxy,
    };

    let source = match src_str.as_str() {
        "OAST" => ObservationSource::OAST,
        "Browser" => ObservationSource::Browser,
        "Manual" => ObservationSource::Manual,
        "Tool" => ObservationSource::Tool,
        _ => ObservationSource::Proxy,
    };

    let lifecycle = match life_str.as_str() {
        "Archived" => LifecycleState::Archived,
        "Deleted" => LifecycleState::Deleted,
        _ => LifecycleState::Active,
    };

    let meta = EntityMetadata {
        id: Uuid::parse_str(&id_val).map_err(|e| SentinelError::ParseError(e.to_string()))?,
        version: ver as u64,
        timestamp,
        provenance,
        lifecycle,
        scope_id: scope_id_str.and_then(|s| Uuid::parse_str(&s).ok()),
    };

    Ok(Observation {
        meta,
        source,
        data_ref: Uuid::parse_str(&data_ref_str)
            .map_err(|e| SentinelError::ParseError(e.to_string()))?,
    })
}

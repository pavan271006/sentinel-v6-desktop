// crates/sentinel_storage/src/repository/audit.rs
//
// Audit Log Repository for durable persistence and query of security-critical events (SEC-12).

use chrono::{DateTime, Utc};
use sentinel_common::{CriticalEvent, SentinelError};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEventRecord {
    pub id: Uuid,
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub source: String,
    pub target: Option<String>,
    pub payload_json: String,
}

#[derive(Clone)]
pub struct AuditRepository {
    pool: SqlitePool,
}

impl AuditRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Inserts a new audit event into the durable SQLite log.
    pub async fn insert_event(
        &self,
        event_type: &str,
        source: &str,
        target: Option<&str>,
        payload_json: &str,
    ) -> Result<Uuid, SentinelError> {
        let id = Uuid::new_v4();
        let id_str = id.to_string();
        let ts = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO audit_events (id, event_type, timestamp, source, target, payload_json) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(id_str)
        .bind(event_type)
        .bind(ts)
        .bind(source)
        .bind(target)
        .bind(payload_json)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        Ok(id)
    }

    /// Inserts a canonical `CriticalEvent` directly into the audit log.
    pub async fn insert_critical_event(
        &self,
        event: &CriticalEvent,
    ) -> Result<Uuid, SentinelError> {
        let event_type = event.event_name();
        let source = event.subsystem();

        let (target, payload_json) = match event {
            CriticalEvent::FindingCreated(id) => {
                let payload = serde_json::json!({ "finding_id": id.to_string() });
                (None, payload.to_string())
            }
            CriticalEvent::CandidateVerified(id) => {
                let payload = serde_json::json!({ "candidate_id": id.to_string() });
                (None, payload.to_string())
            }
            CriticalEvent::ScopeViolationAttempt {
                source: src,
                target: tgt,
                decision,
            } => {
                let payload = serde_json::to_string(decision)
                    .map_err(|e| SentinelError::Serialization(e.to_string()))?;
                let _ = src; // already passed in
                (Some(tgt.as_str()), payload)
            }
        };

        self.insert_event(event_type, source, target, &payload_json)
            .await
    }

    /// Fetches an audit event record by UUID.
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<AuditEventRecord>, SentinelError> {
        let id_str = id.to_string();
        let row = sqlx::query(
            "SELECT id, event_type, timestamp, source, target, payload_json FROM audit_events WHERE id = ?"
        )
        .bind(&id_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        match row {
            Some(r) => Ok(Some(parse_audit_event_row(&r)?)),
            None => Ok(None),
        }
    }

    /// Lists all audit events ordered by timestamp ascending.
    pub async fn list_events(&self) -> Result<Vec<AuditEventRecord>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, event_type, timestamp, source, target, payload_json FROM audit_events ORDER BY timestamp ASC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_audit_event_row(&r)?);
        }
        Ok(list)
    }

    /// Queries audit events by event type.
    pub async fn query_by_type(
        &self,
        event_type: &str,
    ) -> Result<Vec<AuditEventRecord>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, event_type, timestamp, source, target, payload_json FROM audit_events WHERE event_type = ? ORDER BY timestamp ASC"
        )
        .bind(event_type)
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_audit_event_row(&r)?);
        }
        Ok(list)
    }

    /// Queries audit events by target.
    pub async fn query_by_target(
        &self,
        target: &str,
    ) -> Result<Vec<AuditEventRecord>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, event_type, timestamp, source, target, payload_json FROM audit_events WHERE target = ? ORDER BY timestamp ASC"
        )
        .bind(target)
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_audit_event_row(&r)?);
        }
        Ok(list)
    }

    /// Queries audit events within a time range.
    pub async fn query_by_time_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<AuditEventRecord>, SentinelError> {
        let start_str = start.to_rfc3339();
        let end_str = end.to_rfc3339();

        let rows = sqlx::query(
            "SELECT id, event_type, timestamp, source, target, payload_json FROM audit_events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC"
        )
        .bind(start_str)
        .bind(end_str)
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_audit_event_row(&r)?);
        }
        Ok(list)
    }

    /// Returns total count of audit events.
    pub async fn count(&self) -> Result<i64, SentinelError> {
        let row = sqlx::query("SELECT COUNT(*) FROM audit_events")
            .fetch_one(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        let count: i64 = row.get(0);
        Ok(count)
    }
}

pub fn parse_audit_event_row(
    r: &sqlx::sqlite::SqliteRow,
) -> Result<AuditEventRecord, SentinelError> {
    let id_str: String = r.get("id");
    let event_type: String = r.get("event_type");
    let ts_str: String = r.get("timestamp");
    let source: String = r.get("source");
    let target: Option<String> = r.get("target");
    let payload_json: String = r.get("payload_json");

    let timestamp = DateTime::parse_from_rfc3339(&ts_str)
        .map_err(|e| SentinelError::ParseError(e.to_string()))?
        .with_timezone(&Utc);

    Ok(AuditEventRecord {
        id: Uuid::parse_str(&id_str).map_err(|e| SentinelError::ParseError(e.to_string()))?,
        event_type,
        timestamp,
        source,
        target,
        payload_json,
    })
}

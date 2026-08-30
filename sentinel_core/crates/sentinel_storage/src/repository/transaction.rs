// crates/sentinel_storage/src/repository/transaction.rs
//
// Transaction Repository for persisting and retrieving raw network exchanges.

use chrono::{DateTime, Utc};
use sentinel_common::{
    EntityMetadata, HttpMethod, HttpParsedParts, LifecycleState, MessageRepresentation, Provenance,
    SentinelError, TlsData, Transaction,
};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone)]
pub struct TransactionRepository {
    pool: SqlitePool,
}

impl TransactionRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn insert(&self, tx: &Transaction) -> Result<(), SentinelError> {
        let id_str = tx.meta.id.to_string();
        let timestamp_str = tx.meta.timestamp.to_rfc3339();
        let protocol = "HTTP/1.1";
        let req_method = format!("{:?}", tx.request.parsed.method);
        let req_uri = &tx.request.parsed.uri;
        let req_blob_id = tx.request.raw_blob_id.to_string();
        let req_norm = &tx.request.normalized_text;

        let (res_status, res_blob_id, res_norm) = match &tx.response {
            Some(res) => (
                Some(200i64),
                Some(res.raw_blob_id.to_string()),
                Some(res.normalized_text.clone()),
            ),
            None => (None, None, None),
        };

        let timing_ms = tx.timing.as_millis() as i64;
        let tls_cipher = tx.tls_info.as_ref().map(|t| t.cipher.clone());
        let version = tx.meta.version as i64;
        let provenance = format!("{:?}", tx.meta.provenance);
        let lifecycle = format!("{:?}", tx.meta.lifecycle);
        let scope_id = tx.meta.scope_id.map(|s| s.to_string());

        sqlx::query(
            r#"
            INSERT INTO transactions (
                id, timestamp, protocol, stream_id, req_method, req_uri,
                req_blob_id, req_normalized_text, res_status, res_blob_id,
                res_normalized_text, timing_ms, tls_cipher, version,
                provenance, lifecycle, scope_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id_str)
        .bind(timestamp_str)
        .bind(protocol)
        .bind(None::<i64>)
        .bind(req_method)
        .bind(req_uri)
        .bind(req_blob_id)
        .bind(req_norm)
        .bind(res_status)
        .bind(res_blob_id)
        .bind(res_norm)
        .bind(timing_ms)
        .bind(tls_cipher)
        .bind(version)
        .bind(provenance)
        .bind(lifecycle)
        .bind(scope_id)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    pub async fn get(&self, id: Uuid) -> Result<Option<Transaction>, SentinelError> {
        let id_str = id.to_string();
        let row = sqlx::query(
            "SELECT id, timestamp, req_method, req_uri, req_blob_id, req_normalized_text, res_blob_id, res_normalized_text, timing_ms, tls_cipher, version, provenance, lifecycle, scope_id FROM transactions WHERE id = ?"
        )
        .bind(&id_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        match row {
            Some(r) => Ok(Some(parse_transaction_row(&r)?)),
            None => Ok(None),
        }
    }

    pub async fn list(&self, limit: i64, offset: i64) -> Result<Vec<Transaction>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, timestamp, req_method, req_uri, req_blob_id, req_normalized_text, res_blob_id, res_normalized_text, timing_ms, tls_cipher, version, provenance, lifecycle, scope_id FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_transaction_row(&r)?);
        }
        Ok(list)
    }

    pub async fn count(&self) -> Result<i64, SentinelError> {
        let row = sqlx::query("SELECT COUNT(*) FROM transactions")
            .fetch_one(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        let count: i64 = row.get(0);
        Ok(count)
    }

    pub async fn delete(&self, id: Uuid) -> Result<bool, SentinelError> {
        let id_str = id.to_string();
        let res = sqlx::query("DELETE FROM transactions WHERE id = ?")
            .bind(&id_str)
            .execute(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        Ok(res.rows_affected() > 0)
    }
}

pub fn parse_transaction_row(r: &sqlx::sqlite::SqliteRow) -> Result<Transaction, SentinelError> {
    let id: String = r.get("id");
    let timestamp_str: String = r.get("timestamp");
    let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
        .map_err(|e| SentinelError::ParseError(e.to_string()))?
        .with_timezone(&Utc);
    let req_method_str: String = r.get("req_method");
    let req_uri: String = r.get("req_uri");
    let req_blob_id_str: String = r.get("req_blob_id");
    let req_normalized: String = r.get("req_normalized_text");
    let res_blob_id_str: Option<String> = r.get("res_blob_id");
    let res_normalized: Option<String> = r.get("res_normalized_text");
    let timing_ms: i64 = r.get("timing_ms");
    let tls_cipher: Option<String> = r.get("tls_cipher");
    let version: i64 = r.get("version");
    let provenance_str: String = r.get("provenance");
    let lifecycle_str: String = r.get("lifecycle");
    let scope_id_str: Option<String> = r.get("scope_id");

    let method = match req_method_str.as_str() {
        "GET" => HttpMethod::GET,
        "POST" => HttpMethod::POST,
        "PUT" => HttpMethod::PUT,
        "DELETE" => HttpMethod::DELETE,
        "PATCH" => HttpMethod::PATCH,
        "HEAD" => HttpMethod::HEAD,
        "OPTIONS" => HttpMethod::OPTIONS,
        _ => HttpMethod::GET,
    };

    let req_parsed = HttpParsedParts {
        method,
        uri: req_uri,
        version: "HTTP/1.1".to_string(),
        headers: Vec::new(),
    };

    let req_rep = MessageRepresentation {
        raw_blob_id: Uuid::parse_str(&req_blob_id_str).unwrap_or_default(),
        parsed: req_parsed,
        normalized_text: req_normalized,
    };

    let res_rep = res_blob_id_str.map(|b_id| MessageRepresentation {
        raw_blob_id: Uuid::parse_str(&b_id).unwrap_or_default(),
        parsed: HttpParsedParts {
            method: HttpMethod::GET,
            uri: String::new(),
            version: "HTTP/1.1".to_string(),
            headers: Vec::new(),
        },
        normalized_text: res_normalized.unwrap_or_default(),
    });

    let provenance = match provenance_str.as_str() {
        "Proxy" => Provenance::Proxy,
        "Scanner" => Provenance::Scanner,
        "Fuzzer" => Provenance::Fuzzer,
        "AI" => Provenance::AI,
        "Tool" => Provenance::Tool,
        _ => Provenance::Manual,
    };

    let lifecycle = match lifecycle_str.as_str() {
        "Archived" => LifecycleState::Archived,
        "Deleted" => LifecycleState::Deleted,
        _ => LifecycleState::Active,
    };

    let meta = EntityMetadata {
        id: Uuid::parse_str(&id).map_err(|e| SentinelError::ParseError(e.to_string()))?,
        version: version as u64,
        timestamp,
        provenance,
        lifecycle,
        scope_id: scope_id_str.and_then(|s| Uuid::parse_str(&s).ok()),
    };

    let tls_info = tls_cipher.map(|c| TlsData {
        protocol: "TLSv1.3".to_string(),
        cipher: c,
        server_name: None,
        alpn: None,
    });

    Ok(Transaction {
        meta,
        request: req_rep,
        response: res_rep,
        timing: std::time::Duration::from_millis(timing_ms as u64),
        tls_info,
    })
}

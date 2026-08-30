// crates/sentinel_storage/src/repository/finding.rs
//
// Finding, Verification, and Evidence Repository.
// Strictly enforces SEC-06 (Finding Proof Requirement).

use chrono::{DateTime, Utc};
use sentinel_common::{
    Candidate, EntityMetadata, EvidenceVariant, Finding, FindingLifecycle, LifecycleState,
    Provenance, SentinelError, Severity, VerificationResult,
};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone)]
pub struct FindingRepository {
    pool: SqlitePool,
}

impl FindingRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Inserts a candidate observation hypothesis.
    pub async fn insert_candidate(&self, candidate: &Candidate) -> Result<(), SentinelError> {
        let id = candidate.meta.id.to_string();
        let ts = candidate.meta.timestamp.to_rfc3339();
        let src_obs = candidate.source_observation_id.to_string();
        let hyp = &candidate.hypothesis;
        let status = &candidate.status;
        let ver = candidate.meta.version as i64;
        let prov = format!("{:?}", candidate.meta.provenance);
        let life = format!("{:?}", candidate.meta.lifecycle);
        let scope_id = candidate.meta.scope_id.map(|s| s.to_string());

        sqlx::query(
            "INSERT INTO candidates (id, timestamp, source_observation_id, hypothesis, status, version, provenance, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(ts)
        .bind(src_obs)
        .bind(hyp)
        .bind(status)
        .bind(ver)
        .bind(prov)
        .bind(life)
        .bind(scope_id)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    /// Inserts a verification result along with all associated evidence items.
    pub async fn insert_verification(
        &self,
        res: &VerificationResult,
        duration_ms: i64,
    ) -> Result<(), SentinelError> {
        let id = res.id.to_string();
        let candidate_id = res.candidate_id.to_string();
        let strategy_type = format!("{:?}", res.strategy_ref.strategy_type);
        let strategy_version = &res.strategy_ref.version;
        let success = res.success;
        let confidence = res.confidence as f64;
        let executed_at = res.executed_at.to_rfc3339();

        sqlx::query(
            "INSERT INTO verifications (id, candidate_id, strategy_type, strategy_version, success, confidence, executed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(candidate_id)
        .bind(strategy_type)
        .bind(strategy_version)
        .bind(success)
        .bind(confidence)
        .bind(executed_at)
        .bind(duration_ms)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        // Insert all evidence records
        for ev in &res.evidence {
            let ev_id = ev.id.to_string();
            let ver_id = ev.verification_id.to_string();
            let ev_type = match &ev.variant {
                EvidenceVariant::TransactionEvidence(_) => "TransactionEvidence",
                EvidenceVariant::OastEvidence(_) => "OastEvidence",
                EvidenceVariant::BrowserSnapshot(_) => "BrowserSnapshot",
                EvidenceVariant::TimingVariance { .. } => "TimingVariance",
                EvidenceVariant::Differential(_) => "Differential",
            };
            let data_blob_id = match &ev.variant {
                EvidenceVariant::TransactionEvidence(u) => u.to_string(),
                EvidenceVariant::OastEvidence(u) => u.to_string(),
                EvidenceVariant::BrowserSnapshot(u) => u.to_string(),
                _ => Uuid::new_v4().to_string(),
            };
            let ev_created = ev.created_at.to_rfc3339();

            sqlx::query(
                "INSERT INTO evidence (id, verification_id, evidence_type, data_blob_id, created_at) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(ev_id)
            .bind(ver_id)
            .bind(ev_type)
            .bind(data_blob_id)
            .bind(ev_created)
            .execute(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        }

        Ok(())
    }

    /// Inserts a finding with strict SEC-06 validation.
    pub async fn insert_finding(&self, finding: &Finding) -> Result<(), SentinelError> {
        // SEC-06 Enforcement: Verification must exist in database
        let ver_id_str = finding.verification_id.to_string();
        let ver_check = sqlx::query("SELECT id, success FROM verifications WHERE id = ?")
            .bind(&ver_id_str)
            .fetch_optional(&self.pool)
            .await
            .map_err(SentinelError::Database)?;

        match ver_check {
            None => {
                return Err(SentinelError::InvariantViolation(format!(
                    "SEC-06 Violation: Cannot insert Finding without corresponding Verification (id={})",
                    finding.verification_id
                )));
            }
            Some(row) => {
                let success: bool = row.get("success");
                if (finding.state == FindingLifecycle::Verified
                    || finding.state == FindingLifecycle::Confirmed)
                    && !success
                {
                    return Err(SentinelError::InvariantViolation(format!(
                        "SEC-06 Violation: Cannot mark Finding as {:?} with unsuccessful Verification",
                        finding.state
                    )));
                }
            }
        }

        let id = finding.meta.id.to_string();
        let ver = finding.meta.version as i64;
        let ts = finding.meta.timestamp.to_rfc3339();
        let title = &finding.title;
        let severity = format!("{:?}", finding.severity);
        let state = format!("{:?}", finding.state);
        let prov = format!("{:?}", finding.meta.provenance);
        let life = format!("{:?}", finding.meta.lifecycle);
        let scope_id = finding.meta.scope_id.map(|s| s.to_string());

        sqlx::query(
            "INSERT INTO findings (id, version, timestamp, title, severity, verification_id, state, provenance, lifecycle, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(ver)
        .bind(ts)
        .bind(title)
        .bind(severity)
        .bind(ver_id_str)
        .bind(state)
        .bind(prov)
        .bind(life)
        .bind(scope_id)
        .execute(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    /// Fetches a finding by UUID.
    pub async fn get_finding(&self, id: Uuid) -> Result<Option<Finding>, SentinelError> {
        let id_str = id.to_string();
        let row = sqlx::query(
            "SELECT id, version, timestamp, title, severity, verification_id, state, provenance, lifecycle, scope_id FROM findings WHERE id = ?"
        )
        .bind(&id_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        match row {
            Some(r) => Ok(Some(parse_finding_row(&r)?)),
            None => Ok(None),
        }
    }

    /// Lists all findings.
    pub async fn list_findings(&self) -> Result<Vec<Finding>, SentinelError> {
        let rows = sqlx::query(
            "SELECT id, version, timestamp, title, severity, verification_id, state, provenance, lifecycle, scope_id FROM findings ORDER BY timestamp DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(SentinelError::Database)?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(parse_finding_row(&r)?);
        }
        Ok(list)
    }

    /// Returns the total count of findings.
    pub async fn count_findings(&self) -> Result<i64, SentinelError> {
        let row = sqlx::query("SELECT COUNT(*) FROM findings")
            .fetch_one(&self.pool)
            .await
            .map_err(SentinelError::Database)?;
        let count: i64 = row.get(0);
        Ok(count)
    }
}

pub fn parse_finding_row(r: &sqlx::sqlite::SqliteRow) -> Result<Finding, SentinelError> {
    let id_val: String = r.get("id");
    let ver: i64 = r.get("version");
    let ts_str: String = r.get("timestamp");
    let title: String = r.get("title");
    let sev_str: String = r.get("severity");
    let ver_id_str: String = r.get("verification_id");
    let state_str: String = r.get("state");
    let prov_str: String = r.get("provenance");
    let life_str: String = r.get("lifecycle");
    let scope_id_str: Option<String> = r.get("scope_id");

    let timestamp = DateTime::parse_from_rfc3339(&ts_str)
        .map_err(|e| SentinelError::ParseError(e.to_string()))?
        .with_timezone(&Utc);

    let severity = match sev_str.as_str() {
        "Critical" => Severity::Critical,
        "High" => Severity::High,
        "Medium" => Severity::Medium,
        "Low" => Severity::Low,
        _ => Severity::Info,
    };

    let state = match state_str.as_str() {
        "Verified" => FindingLifecycle::Verified,
        "Confirmed" => FindingLifecycle::Confirmed,
        "Reported" => FindingLifecycle::Reported,
        "Remediated" => FindingLifecycle::Remediated,
        "FalsePositive" => FindingLifecycle::FalsePositive,
        "AcceptedRisk" => FindingLifecycle::AcceptedRisk,
        "Regression" => FindingLifecycle::Regression,
        _ => FindingLifecycle::Candidate,
    };

    let provenance = match prov_str.as_str() {
        "Scanner" => Provenance::Scanner,
        "Fuzzer" => Provenance::Fuzzer,
        "Proxy" => Provenance::Proxy,
        "AI" => Provenance::AI,
        "Tool" => Provenance::Tool,
        _ => Provenance::Manual,
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

    Ok(Finding {
        meta,
        title,
        severity,
        verification_id: Uuid::parse_str(&ver_id_str)
            .map_err(|e| SentinelError::ParseError(e.to_string()))?,
        state,
    })
}

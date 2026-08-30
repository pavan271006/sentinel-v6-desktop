// crates/sentinel_storage/src/store.rs
//
// SQLite-backed ObservationStore and Repository Facade.
// Strictly enforces SEC-06, SEC-07, SEC-08, and SEC-09.

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::path::Path;
use uuid::Uuid;

use sentinel_common::{
    Candidate, Credential, Finding, Identity, Observation, ObservationStore, Scope, SentinelError,
    Transaction, VerificationResult,
};

use crate::cas::BlobStorage;
use crate::project::ProjectStorage;
use crate::repository::{
    AuditEventRecord, AuditRepository, FindingRepository, ObservationRepository, ScopeRepository,
    TransactionRepository,
};

#[derive(Clone)]
pub struct SqliteObservationStore {
    project: ProjectStorage,
    obs_repo: ObservationRepository,
    scope_repo: ScopeRepository,
    audit_repo: AuditRepository,
    tx_repo: TransactionRepository,
    finding_repo: FindingRepository,
}

impl SqliteObservationStore {
    pub async fn open(project_dir: impl AsRef<Path>) -> Result<Self, SentinelError> {
        let project = ProjectStorage::open(project_dir).await?;
        let pool = project.pool().clone();

        let obs_repo = ObservationRepository::new(pool.clone());
        let scope_repo = ScopeRepository::new(pool.clone());
        let audit_repo = AuditRepository::new(pool.clone());
        let tx_repo = TransactionRepository::new(pool.clone());
        let finding_repo = FindingRepository::new(pool.clone());

        Ok(Self {
            project,
            obs_repo,
            scope_repo,
            audit_repo,
            tx_repo,
            finding_repo,
        })
    }

    pub fn project(&self) -> &ProjectStorage {
        &self.project
    }

    pub fn pool(&self) -> &SqlitePool {
        self.project.pool()
    }

    pub fn cas(&self) -> &BlobStorage {
        self.project.cas()
    }

    pub fn project_dir(&self) -> &Path {
        self.project.project_dir()
    }

    pub fn observations(&self) -> &ObservationRepository {
        &self.obs_repo
    }

    pub fn scopes(&self) -> &ScopeRepository {
        &self.scope_repo
    }

    pub fn audit(&self) -> &AuditRepository {
        &self.audit_repo
    }

    pub fn transactions(&self) -> &TransactionRepository {
        &self.tx_repo
    }

    pub fn findings(&self) -> &FindingRepository {
        &self.finding_repo
    }

    // ==========================================
    // Transaction Repository Forwarding
    // ==========================================

    pub async fn insert_transaction(&self, tx: &Transaction) -> Result<(), SentinelError> {
        self.tx_repo.insert(tx).await
    }

    pub async fn get_transaction(&self, id: Uuid) -> Result<Option<Transaction>, SentinelError> {
        self.tx_repo.get(id).await
    }

    // ==========================================
    // Candidate & Verification Forwarding
    // ==========================================

    pub async fn insert_candidate(&self, candidate: &Candidate) -> Result<(), SentinelError> {
        self.finding_repo.insert_candidate(candidate).await
    }

    pub async fn insert_verification(
        &self,
        res: &VerificationResult,
        duration_ms: i64,
    ) -> Result<(), SentinelError> {
        self.finding_repo
            .insert_verification(res, duration_ms)
            .await
    }

    // ==========================================
    // Finding Forwarding (SEC-06 Enforcement)
    // ==========================================

    pub async fn insert_finding(&self, finding: &Finding) -> Result<(), SentinelError> {
        self.finding_repo.insert_finding(finding).await
    }

    pub async fn get_finding(&self, id: Uuid) -> Result<Option<Finding>, SentinelError> {
        self.finding_repo.get_finding(id).await
    }

    // ==========================================
    // Scope Forwarding
    // ==========================================

    pub async fn insert_scope(&self, scope: &Scope) -> Result<(), SentinelError> {
        self.scope_repo.insert(scope).await
    }

    pub async fn get_scope(&self, id: Uuid) -> Result<Option<Scope>, SentinelError> {
        self.scope_repo.get(id).await
    }

    // ==========================================
    // Identity & Credential (SEC-09)
    // ==========================================

    pub async fn insert_identity(&self, identity: &Identity) -> Result<(), SentinelError> {
        let id = identity.id.to_string();
        let ver = identity.version as i64;
        let ts = identity.timestamp.to_rfc3339();
        let uname = &identity.username;
        let roles_json = serde_json::to_string(&identity.roles)
            .map_err(|e| SentinelError::Serialization(e.to_string()))?;

        sqlx::query(
            "INSERT INTO identities (id, version, timestamp, username, roles_json) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(ver)
        .bind(ts)
        .bind(uname)
        .bind(roles_json)
        .execute(self.pool())
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    pub async fn insert_credential(&self, cred: &Credential) -> Result<(), SentinelError> {
        let id = cred.id.to_string();
        let identity_id = cred.identity_id.to_string();
        let cred_type = &cred.credential_type;
        let sec_ref = cred.secret_reference.to_string();
        let access = format!("{:?}", cred.access_level);
        let exp = cred.expires_at.map(|e| e.to_rfc3339());

        sqlx::query(
            "INSERT INTO credentials (id, identity_id, credential_type, secret_reference, access_level, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(identity_id)
        .bind(cred_type)
        .bind(sec_ref)
        .bind(access)
        .bind(exp)
        .execute(self.pool())
        .await
        .map_err(SentinelError::Database)?;

        Ok(())
    }

    // ==========================================
    // Durable Audit Events Forwarding (SEC-12)
    // ==========================================

    pub async fn insert_audit_event(
        &self,
        event_type: &str,
        source: &str,
        target: Option<&str>,
        payload_json: &str,
    ) -> Result<Uuid, SentinelError> {
        self.audit_repo
            .insert_event(event_type, source, target, payload_json)
            .await
    }

    pub async fn list_audit_events(
        &self,
    ) -> Result<Vec<(Uuid, String, DateTime<Utc>, String, Option<String>, String)>, SentinelError>
    {
        let records = self.audit_repo.list_events().await?;
        let tuple_list = records
            .into_iter()
            .map(|r| {
                (
                    r.id,
                    r.event_type,
                    r.timestamp,
                    r.source,
                    r.target,
                    r.payload_json,
                )
            })
            .collect();
        Ok(tuple_list)
    }

    pub async fn list_audit_records(&self) -> Result<Vec<AuditEventRecord>, SentinelError> {
        self.audit_repo.list_events().await
    }
}

// ==========================================
// Trait Implementation: ObservationStore
// ==========================================

#[async_trait::async_trait]
impl ObservationStore for SqliteObservationStore {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError> {
        self.obs_repo.insert(obs).await
    }

    async fn insert_batch(&self, list: Vec<Observation>) -> Result<(), SentinelError> {
        self.obs_repo.insert_batch(list).await
    }

    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError> {
        self.obs_repo.get(id).await
    }

    async fn query_sql(&self, sql: &str) -> Result<Vec<Observation>, SentinelError> {
        self.obs_repo.query_sql(sql).await
    }

    async fn search_fts(&self, query: &str) -> Result<Vec<Observation>, SentinelError> {
        self.obs_repo.search_fts(query).await
    }

    async fn rebuild_index(&self) -> Result<(), SentinelError> {
        self.obs_repo.rebuild_index().await
    }
}

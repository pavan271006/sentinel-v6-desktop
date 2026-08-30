// crates/sentinel_storage/tests/crash_recovery_tests.rs

use sentinel_common::{
    EntityMetadata, Observation, ObservationSource, ObservationStore, Provenance, Scope,
};
use sentinel_storage::store::SqliteObservationStore;
use tempfile::tempdir;
use uuid::Uuid;

#[tokio::test]
async fn test_wal_transaction_explicit_rollback() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let obs_id = Uuid::new_v4();
    let obs = Observation {
        meta: EntityMetadata::new(Provenance::Scanner).with_id(obs_id),
        source: ObservationSource::Proxy,
        data_ref: Uuid::new_v4(),
    };

    // Begin an explicit transaction
    let mut tx = store.pool().begin().await.unwrap();

    // Insert within transaction
    let id_str = obs.meta.id.to_string();
    let ver = obs.meta.version as i64;
    let ts = obs.meta.timestamp.to_rfc3339();
    let prov = format!("{:?}", obs.meta.provenance);
    let src = format!("{:?}", obs.source);
    let data_ref = obs.data_ref.to_string();
    let life = format!("{:?}", obs.meta.lifecycle);

    sqlx::query(
        "INSERT INTO observations (id, version, timestamp, provenance, source, data_ref, lifecycle) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id_str)
    .bind(ver)
    .bind(ts)
    .bind(prov)
    .bind(src)
    .bind(data_ref)
    .bind(life)
    .execute(&mut *tx)
    .await
    .unwrap();

    // Explicitly roll back the transaction
    tx.rollback().await.unwrap();

    // The observation MUST NOT exist in the database
    let fetched = store.get(obs_id).await.unwrap();
    assert!(
        fetched.is_none(),
        "Rolled back transaction data must not be persisted"
    );
}

#[tokio::test]
async fn test_wal_crash_recovery_and_restart_persistence() {
    let temp = tempdir().unwrap();
    let project_dir = temp.path().to_path_buf();

    let obs_id = Uuid::new_v4();
    let scope_id = Uuid::new_v4();
    let payload = b"GET /v1/health HTTP/1.1\r\nHost: example.com\r\n\r\n";
    let blob_hash;

    // Session 1: Write committed data and CAS blob
    {
        let store1 = SqliteObservationStore::open(&project_dir).await.unwrap();

        let scope = Scope {
            id: scope_id,
            version: 1,
            timestamp: chrono::Utc::now(),
            includes: vec!["https://example.com/*".to_string()],
            excludes: vec![],
        };
        store1.insert_scope(&scope).await.unwrap();

        let desc = store1.cas().put(payload).await.unwrap();
        blob_hash = desc.sha256_hex.clone();

        let obs = Observation {
            meta: EntityMetadata::new(Provenance::Proxy)
                .with_id(obs_id)
                .with_scope(scope_id),
            source: ObservationSource::Proxy,
            data_ref: Uuid::new_v4(),
        };
        store1.insert(obs).await.unwrap();

        store1
            .insert_audit_event(
                "SystemShutdown",
                "Orchestrator",
                None,
                r#"{"reason":"restart"}"#,
            )
            .await
            .unwrap();

        // Dropping store1 simulates clean shutdown or process termination with active WAL
    }

    // Session 2: Reopen the project from disk (simulating restart / WAL recovery)
    {
        let store2 = SqliteObservationStore::open(&project_dir).await.unwrap();

        // Verify scope survived
        let recovered_scope = store2.get_scope(scope_id).await.unwrap();
        assert!(recovered_scope.is_some());
        assert_eq!(recovered_scope.unwrap().id, scope_id);

        // Verify observation survived
        let recovered_obs = store2.get(obs_id).await.unwrap();
        assert!(recovered_obs.is_some());
        assert_eq!(recovered_obs.unwrap().meta.id, obs_id);

        // Verify CAS blob survived and integrity holds
        let recovered_blob = store2.cas().get_verified(&blob_hash).await.unwrap();
        assert_eq!(recovered_blob, payload);

        // Verify audit log survived
        let audit_records = store2.list_audit_records().await.unwrap();
        assert_eq!(audit_records.len(), 1);
        assert_eq!(audit_records[0].event_type, "SystemShutdown");
    }
}

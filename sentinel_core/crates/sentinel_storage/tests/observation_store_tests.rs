// crates/sentinel_storage/tests/observation_store_tests.rs

use sentinel_common::{
    EntityMetadata, Observation, ObservationSource, ObservationStore, Provenance,
};
use sentinel_storage::store::SqliteObservationStore;
use tempfile::tempdir;
use uuid::Uuid;

#[tokio::test]
async fn test_observation_store_crud_lifecycle() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let obs_id = Uuid::new_v4();
    let data_ref = Uuid::new_v4();
    let obs = Observation {
        meta: EntityMetadata::new(Provenance::Scanner).with_id(obs_id),
        source: ObservationSource::Proxy,
        data_ref,
    };

    // 1. Insert
    store.insert(obs.clone()).await.unwrap();

    // 2. Get by UUID
    let retrieved = store
        .get(obs_id)
        .await
        .unwrap()
        .expect("Must find observation");
    assert_eq!(retrieved.meta.id, obs_id);
    assert_eq!(retrieved.source, ObservationSource::Proxy);
    assert_eq!(retrieved.data_ref, data_ref);

    // 3. Count
    let count = store.observations().count().await.unwrap();
    assert_eq!(count, 1);

    // 4. Delete
    let deleted = store.observations().delete(obs_id).await.unwrap();
    assert!(deleted);

    let retrieved_after = store.get(obs_id).await.unwrap();
    assert!(retrieved_after.is_none());
}

#[tokio::test]
async fn test_observation_store_batch_insert_in_transaction() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let batch_size = 100;
    let mut batch = Vec::with_capacity(batch_size);

    for i in 0..batch_size {
        let prov = if i % 2 == 0 {
            Provenance::Scanner
        } else {
            Provenance::Fuzzer
        };
        batch.push(Observation {
            meta: EntityMetadata::new(prov),
            source: ObservationSource::Proxy,
            data_ref: Uuid::new_v4(),
        });
    }

    // Insert batch atomically in transaction
    store.insert_batch(batch.clone()).await.unwrap();

    let count = store.observations().count().await.unwrap();
    assert_eq!(count, batch_size as i64);

    // Verify all records are present
    for obs in &batch {
        let fetched = store.get(obs.meta.id).await.unwrap();
        assert!(fetched.is_some());
    }

    // Pagination
    let page1 = store.observations().list(20, 0).await.unwrap();
    assert_eq!(page1.len(), 20);

    let page2 = store.observations().list(20, 20).await.unwrap();
    assert_eq!(page2.len(), 20);
    assert_ne!(page1[0].meta.id, page2[0].meta.id);
}

#[tokio::test]
async fn test_observation_store_query_sql_and_search_fts() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let obs_scanner = Observation {
        meta: EntityMetadata::new(Provenance::Scanner),
        source: ObservationSource::Proxy,
        data_ref: Uuid::new_v4(),
    };
    let obs_fuzzer = Observation {
        meta: EntityMetadata::new(Provenance::Fuzzer),
        source: ObservationSource::OAST,
        data_ref: Uuid::new_v4(),
    };

    store.insert(obs_scanner.clone()).await.unwrap();
    store.insert(obs_fuzzer.clone()).await.unwrap();

    // Custom SQL Query
    let query_results = store
        .query_sql(
            "SELECT id, version, timestamp, provenance, source, data_ref, lifecycle, scope_id FROM observations WHERE provenance = 'Scanner'",
        )
        .await
        .unwrap();

    assert_eq!(query_results.len(), 1);
    assert_eq!(query_results[0].meta.id, obs_scanner.meta.id);

    // FTS search
    let fts_scanner = store.search_fts("Scanner").await.unwrap();
    assert_eq!(fts_scanner.len(), 1);
    assert_eq!(fts_scanner[0].meta.id, obs_scanner.meta.id);

    let fts_oast = store.search_fts("OAST").await.unwrap();
    assert_eq!(fts_oast.len(), 1);
    assert_eq!(fts_oast[0].meta.id, obs_fuzzer.meta.id);

    // Rebuild index
    let rebuild_res = store.rebuild_index().await;
    assert!(rebuild_res.is_ok());
}

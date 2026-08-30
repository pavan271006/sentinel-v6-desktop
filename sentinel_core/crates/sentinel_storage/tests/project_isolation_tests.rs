// crates/sentinel_storage/tests/project_isolation_tests.rs

use sentinel_common::{
    EntityMetadata, Observation, ObservationSource, ObservationStore, Provenance, Scope,
    SentinelError,
};
use sentinel_storage::project::ProjectStorage;
use sentinel_storage::store::SqliteObservationStore;
use tempfile::tempdir;
use uuid::Uuid;

#[tokio::test]
async fn test_project_workspace_structure_creation() {
    let temp = tempdir().unwrap();
    let project_dir = temp.path().join("proj_alpha");

    let project = ProjectStorage::open(&project_dir).await.unwrap();

    assert!(project.project_dir().exists());
    assert!(project.db_path().exists());
    assert!(project.blobs_dir().exists());
    assert!(project.indexes_dir().exists());
    assert!(project.logs_dir().exists());
}

#[tokio::test]
async fn test_zero_data_leakage_between_projects_sec_08() {
    let temp_root = tempdir().unwrap();
    let proj_a_dir = temp_root.path().join("project_alpha");
    let proj_b_dir = temp_root.path().join("project_beta");

    let store_a = SqliteObservationStore::open(&proj_a_dir).await.unwrap();
    let store_b = SqliteObservationStore::open(&proj_b_dir).await.unwrap();

    // 1. Insert Observation into Project A
    let obs_a = Observation {
        meta: EntityMetadata::new(Provenance::Scanner),
        source: ObservationSource::Proxy,
        data_ref: Uuid::new_v4(),
    };
    store_a.insert(obs_a.clone()).await.unwrap();

    // 2. Insert Scope into Project A
    let scope_a = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec!["https://alpha.example.com/*".to_string()],
        excludes: vec![],
    };
    store_a.insert_scope(&scope_a).await.unwrap();

    // 3. Project B MUST NOT observe Project A's data
    let obs_in_b = store_b.get(obs_a.meta.id).await.unwrap();
    assert!(
        obs_in_b.is_none(),
        "Project B must not see Project A's observations"
    );

    let scope_in_b = store_b.get_scope(scope_a.id).await.unwrap();
    assert!(
        scope_in_b.is_none(),
        "Project B must not see Project A's scopes"
    );

    let b_observations = store_b.observations().list(100, 0).await.unwrap();
    assert_eq!(b_observations.len(), 0);

    let b_scopes = store_b.scopes().list().await.unwrap();
    assert_eq!(b_scopes.len(), 0);
}

#[tokio::test]
async fn test_cross_project_path_traversal_rejection_sec_08() {
    let temp = tempdir().unwrap();
    let project = ProjectStorage::open(temp.path()).await.unwrap();

    // 1. Path traversal with ..
    let traversal_attempts = [
        "../other_project/db.sqlite",
        "..\\other_project\\db.sqlite",
        "nested/../../secret_key.pem",
        "blobs/../../../etc/passwd",
    ];

    for attempt in traversal_attempts {
        let res = project.resolve_safe_path(attempt);
        match res {
            Err(SentinelError::InvariantViolation(msg)) => {
                assert!(
                    msg.contains("SEC-08"),
                    "Error must reference SEC-08: {}",
                    msg
                );
            }
            other => panic!(
                "Expected InvariantViolation for path traversal '{}', got {:?}",
                attempt, other
            ),
        }
    }

    // 2. Safe relative path within project workspace must succeed
    let safe_res = project.resolve_safe_path("blobs/custom_blob.bin");
    assert!(safe_res.is_ok());
    assert_eq!(
        safe_res.unwrap(),
        temp.path().join("blobs").join("custom_blob.bin")
    );
}

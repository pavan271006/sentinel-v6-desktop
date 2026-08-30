//! Test Suite for Coverage Engine

use std::sync::Arc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_common::domain::supporting::Endpoint;
use sentinel_common::enums::HttpMethod;
use sentinel_common::traits::CoverageEngine;
use sentinel_coverage::DefaultCoverageEngine;
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_coverage_tracking_and_metrics() {
    let engine = DefaultCoverageEngine::new();
    let scope_id = Uuid::new_v4();

    let ep1 = Endpoint {
        id: Uuid::new_v4(),
        host: "api.target.com".to_string(),
        path: "/v1/users".to_string(),
        method: HttpMethod::GET,
        timestamp: chrono::Utc::now(),
        graph_node_id: Uuid::new_v4(),
    };

    let ep2 = Endpoint {
        id: Uuid::new_v4(),
        host: "api.target.com".to_string(),
        path: "/v1/users".to_string(),
        method: HttpMethod::POST,
        timestamp: chrono::Utc::now(),
        graph_node_id: Uuid::new_v4(),
    };

    let ep3 = Endpoint {
        id: Uuid::new_v4(),
        host: "api.target.com".to_string(),
        path: "/v1/admin/delete".to_string(),
        method: HttpMethod::DELETE,
        timestamp: chrono::Utc::now(),
        graph_node_id: Uuid::new_v4(),
    };

    engine.register_endpoint(ep1.clone(), Some(scope_id));
    engine.register_endpoint(ep2.clone(), Some(scope_id));
    engine.register_endpoint(ep3.clone(), Some(scope_id));

    // Initially: 0/3 tested
    let cov0 = engine.get_coverage(scope_id).await.unwrap();
    assert_eq!(cov0.total, 3);
    assert_eq!(cov0.tested, 0);

    let untested0 = engine.untested_endpoints(scope_id).await.unwrap();
    assert_eq!(untested0.len(), 3);

    // Record test on ep1 and ep2
    engine.record_test(ep1.id).await.unwrap();
    engine.record_test(ep2.id).await.unwrap();

    let cov1 = engine.get_coverage(scope_id).await.unwrap();
    assert_eq!(cov1.total, 3);
    assert_eq!(cov1.tested, 2);

    let untested1 = engine.untested_endpoints(scope_id).await.unwrap();
    assert_eq!(untested1.len(), 1);
    assert_eq!(untested1[0].id, ep3.id);
}

#[tokio::test]
async fn test_coverage_persistence_audit() {
    let temp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(temp.path()).await.unwrap());

    let engine = DefaultCoverageEngine::new().with_storage(store.clone());
    let ep_id = Uuid::new_v4();

    engine.record_test(ep_id).await.unwrap();

    let records = store.list_audit_records().await.unwrap();
    assert!(records.iter().any(|r| r.event_type == "EndpointTested"));
}

// crates/sentinel_scope/tests/cross_crate_security.rs
//
// Mandatory Cross-Crate Security Integration Test.
// Verifies end-to-end security invariants across:
// sentinel_common, sentinel_scope, sentinel_bus, and sentinel_storage.

use chrono::Utc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::{
    CriticalEvent, EntityMetadata, EventBus, HttpMethod, HttpParsedParts, MessageRepresentation,
    Observation, ObservationSource, ObservationStore, Provenance, Scope, ScopeEngine,
    SentinelEvent, Transaction,
};
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_out_of_scope_request_pipeline_enforcement() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();
    let bus = ChannelEventBus::new(EventBusConfig::default());
    let mut critical_rx = bus.subscribe_critical();

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://api.target.com/*".to_string()],
        excludes: vec!["https://api.target.com/admin/*".to_string()],
    };
    store.insert_scope(&scope).await.unwrap();
    let scope_engine = DefaultScopeEngine::new(scope);

    // Scenario 1: Out-of-scope target (completely different domain)
    let out_of_scope_target = "https://unauthorized-victim.org/endpoint";
    let decision = scope_engine.is_in_scope(out_of_scope_target);

    assert!(!decision.allowed, "Out of scope target MUST be denied");
    assert!(decision.reason.contains("Default Deny"));

    // Pipeline action on DENY: Abort active request and emit CriticalEvent::ScopeViolationAttempt
    let violation_event = CriticalEvent::ScopeViolationAttempt {
        source: "ScannerPipeline".to_string(),
        target: out_of_scope_target.to_string(),
        decision: decision.clone(),
    };

    bus.publish_critical(violation_event.clone()).unwrap();

    // Event bus delivers critical event
    let received_event = critical_rx
        .recv()
        .await
        .expect("Must receive critical event");
    assert_eq!(received_event, violation_event);

    // Durably persist to audit store
    let payload_json = serde_json::to_string(&decision).unwrap();
    let audit_id = store
        .insert_audit_event(
            "ScopeViolationAttempt",
            "ScannerPipeline",
            Some(out_of_scope_target),
            &payload_json,
        )
        .await
        .unwrap();

    // Queryable audit evidence in SQLite store
    let audit_records = store.list_audit_events().await.unwrap();
    assert_eq!(audit_records.len(), 1);
    assert_eq!(audit_records[0].0, audit_id);
    assert_eq!(audit_records[0].1, "ScopeViolationAttempt");
    assert_eq!(audit_records[0].3, "ScannerPipeline");
    assert_eq!(audit_records[0].4.as_deref(), Some(out_of_scope_target));

    // Scenario 2: Excluded path on in-scope domain
    let excluded_target = "https://api.target.com/admin/delete-database";
    let excluded_decision = scope_engine.is_in_scope(excluded_target);
    assert!(!excluded_decision.allowed, "Excluded path MUST be denied");
    assert!(excluded_decision.reason.contains("matched exclude rule"));
}

#[tokio::test]
async fn test_in_scope_request_pipeline_enforcement() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();
    let bus = ChannelEventBus::new(EventBusConfig::default());
    let mut telemetry_rx = bus.subscribe_telemetry();

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://api.target.com/*".to_string()],
        excludes: vec![],
    };
    store.insert_scope(&scope).await.unwrap();
    let scope_engine = DefaultScopeEngine::new(scope.clone());

    let in_scope_target = "https://api.target.com/v1/users";
    let decision = scope_engine.is_in_scope(in_scope_target);
    assert!(decision.allowed, "In-scope target MUST be allowed");

    // Store raw transaction payload in CAS
    let raw_http_req = b"GET /v1/users HTTP/1.1\r\nHost: api.target.com\r\n\r\n";
    let blob_desc = store.cas().put(raw_http_req).await.unwrap();

    // Create transaction and observation
    let tx = Transaction {
        meta: EntityMetadata::new(Provenance::Scanner).with_scope(scope.id),
        request: MessageRepresentation {
            raw_blob_id: blob_desc.blob_id,
            parsed: HttpParsedParts {
                method: HttpMethod::GET,
                uri: in_scope_target.to_string(),
                version: "HTTP/1.1".to_string(),
                headers: vec![(b"Host".to_vec(), b"api.target.com".to_vec())],
            },
            normalized_text: "GET /v1/users".to_string(),
        },
        response: None,
        timing: std::time::Duration::from_millis(120),
        tls_info: None,
    };
    store.insert_transaction(&tx).await.unwrap();

    let obs = Observation {
        meta: EntityMetadata::new(Provenance::Scanner).with_scope(scope.id),
        source: ObservationSource::Proxy,
        data_ref: tx.meta.id,
    };
    store.insert(obs.clone()).await.unwrap();

    // Publish telemetry event
    bus.publish_telemetry(SentinelEvent::ObservationCreated(obs.meta.id))
        .unwrap();

    // Telemetry subscriber receives event
    let event = telemetry_rx.recv().await.unwrap();
    assert_eq!(event, SentinelEvent::ObservationCreated(obs.meta.id));

    // Verify stored observation
    let retrieved_obs = store.get(obs.meta.id).await.unwrap().unwrap();
    assert_eq!(retrieved_obs.meta.id, obs.meta.id);
    assert_eq!(retrieved_obs.source, ObservationSource::Proxy);

    // Verify CAS integrity
    let retrieved_blob = store
        .cas()
        .get_verified(&blob_desc.sha256_hex)
        .await
        .unwrap();
    assert_eq!(retrieved_blob, raw_http_req);
}

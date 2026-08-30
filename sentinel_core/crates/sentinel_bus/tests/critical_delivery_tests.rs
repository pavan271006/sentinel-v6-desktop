// crates/sentinel_bus/tests/critical_delivery_tests.rs
//
// Guaranteed Critical Delivery Channel Tests with SQLite Audit Integration (SEC-12).

use std::time::Duration;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{EventBusConfig, SentinelEventBus};
use sentinel_common::{CriticalEvent, EventBus, ScopeDecision, SentinelError};
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_critical_lossless_delivery_all_variants() {
    let bus = SentinelEventBus::default();
    let mut crit_rx = bus.subscribe_critical();

    let finding_id = Uuid::new_v4();
    let ev1 = CriticalEvent::FindingCreated(finding_id);

    let cand_id = Uuid::new_v4();
    let ev2 = CriticalEvent::CandidateVerified(cand_id);

    let decision = ScopeDecision::deny(
        "https://out-of-scope.example.com",
        1,
        None,
        "Target out of engagement scope",
    );
    let ev3 = CriticalEvent::ScopeViolationAttempt {
        source: "SUB-01 ProxyEngine".to_string(),
        target: "https://out-of-scope.example.com".to_string(),
        decision,
    };

    bus.publish_critical(ev1.clone()).unwrap();
    bus.publish_critical(ev2.clone()).unwrap();
    bus.publish_critical(ev3.clone()).unwrap();

    let r1 = crit_rx.recv().await.unwrap();
    let r2 = crit_rx.recv().await.unwrap();
    let r3 = crit_rx.recv().await.unwrap();

    assert_eq!(r1, ev1);
    assert_eq!(r2, ev2);
    assert_eq!(r3, ev3);

    assert_eq!(bus.published_critical(), 3);
}

#[tokio::test]
async fn test_critical_bounded_backpressure_rejection() {
    let bus = SentinelEventBus::new(EventBusConfig {
        telemetry_capacity: 10,
        critical_capacity: 2,
    });

    let ev1 = CriticalEvent::FindingCreated(Uuid::new_v4());
    let ev2 = CriticalEvent::FindingCreated(Uuid::new_v4());
    let ev3 = CriticalEvent::FindingCreated(Uuid::new_v4());

    bus.publish_critical(ev1).unwrap();
    bus.publish_critical(ev2).unwrap();

    let res = bus.publish_critical(ev3);
    assert!(res.is_err());
    match res {
        Err(SentinelError::BusOverflow { count }) => assert_eq!(count, 1),
        other => panic!("Expected BusOverflow, got {:?}", other),
    }
}

#[tokio::test]
async fn test_critical_async_backpressure_awaits() {
    let bus = SentinelEventBus::new(EventBusConfig {
        telemetry_capacity: 10,
        critical_capacity: 2,
    });

    let mut rx = bus.subscribe_critical();

    let bus_clone = bus.clone();
    let producer = tokio::spawn(async move {
        for _ in 0..5 {
            let ev = CriticalEvent::FindingCreated(Uuid::new_v4());
            bus_clone.publish_critical_async(ev).await.unwrap();
        }
    });

    // Consumer reads all 5 items with a slight delay
    let mut received = 0;
    while received < 5 {
        tokio::time::sleep(Duration::from_millis(10)).await;
        if rx.recv().await.is_some() {
            received += 1;
        }
    }

    producer.await.unwrap();
    assert_eq!(received, 5);
    assert_eq!(bus.published_critical(), 5);
}

#[tokio::test]
async fn test_critical_sqlite_audit_log_integration() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let bus = SentinelEventBus::with_observation_store(EventBusConfig::default(), &store);
    let mut rx = bus.subscribe_critical();

    let finding_id = Uuid::new_v4();
    let event = CriticalEvent::FindingCreated(finding_id);

    // Use publish_critical_and_wait to guarantee SQLite WAL write completion
    bus.publish_critical_and_wait(event.clone()).await.unwrap();

    // Verify subscriber receives it
    let received = rx.recv().await.unwrap();
    assert_eq!(received, event);

    // Query SQLite audit events repository directly
    let audit_records = store.list_audit_records().await.unwrap();
    assert_eq!(audit_records.len(), 1);
    assert_eq!(audit_records[0].event_type, "FindingCreated");
    assert_eq!(audit_records[0].source, "SUB-09 VerificationEngine");
    assert!(audit_records[0]
        .payload_json
        .contains(&finding_id.to_string()));
}

#[tokio::test]
async fn test_critical_multi_subscriber_delivery() {
    let bus = SentinelEventBus::default();

    let mut sub1 = bus.subscribe_critical();
    let mut sub2 = bus.subscribe_critical();
    let mut sub3 = bus.subscribe_critical();

    let id = Uuid::new_v4();
    let event = CriticalEvent::FindingCreated(id);

    bus.publish_critical(event.clone()).unwrap();

    let r1 = sub1.recv().await.unwrap();
    let r2 = sub2.recv().await.unwrap();
    let r3 = sub3.recv().await.unwrap();

    assert_eq!(r1, event);
    assert_eq!(r2, event);
    assert_eq!(r3, event);
}

#[tokio::test]
async fn test_critical_replay_events() {
    let bus = SentinelEventBus::default();

    let ev1 = CriticalEvent::FindingCreated(Uuid::new_v4());
    let ev2 = CriticalEvent::CandidateVerified(Uuid::new_v4());

    bus.publish_critical(ev1.clone()).unwrap();
    bus.publish_critical(ev2.clone()).unwrap();

    // Small delay to allow background persistence worker to record
    tokio::time::sleep(Duration::from_millis(30)).await;

    let replayed = bus.replay_critical_events().await;
    assert_eq!(replayed.len(), 2);
    assert_eq!(replayed[0], ev1);
    assert_eq!(replayed[1], ev2);
}

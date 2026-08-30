// crates/sentinel_bus/tests/graceful_shutdown_tests.rs
//
// Graceful Shutdown and Critical Queue Flush Tests (SEC-12).

use std::time::Duration;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{EventBusConfig, SentinelEventBus};
use sentinel_common::{CriticalEvent, SentinelError};
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_graceful_shutdown_flushes_pending_critical_events() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let bus = SentinelEventBus::with_observation_store(
        EventBusConfig {
            telemetry_capacity: 100,
            critical_capacity: 100,
        },
        &store,
    );

    let count = 50;
    for _ in 0..count {
        let ev = CriticalEvent::FindingCreated(Uuid::new_v4());
        bus.publish_critical_async(ev).await.unwrap();
    }

    // Trigger graceful shutdown with bounded timeout
    bus.shutdown(Duration::from_secs(5)).await.unwrap();

    // Verify all 50 events are durably persisted to SQLite
    let audit_records = store.list_audit_records().await.unwrap();
    assert_eq!(
        audit_records.len(),
        count,
        "All critical events must be flushed to SQLite before shutdown terminates"
    );
}

#[tokio::test]
async fn test_publish_after_shutdown_fails_closed() {
    let bus = SentinelEventBus::default();

    bus.shutdown(Duration::from_millis(500)).await.unwrap();

    let ev = CriticalEvent::FindingCreated(Uuid::new_v4());
    let res = bus.publish_critical_async(ev).await;
    assert!(res.is_err());
    match res {
        Err(SentinelError::InvariantViolation(msg)) => {
            assert!(msg.contains("closed"));
        }
        other => panic!("Expected InvariantViolation, got {:?}", other),
    }
}

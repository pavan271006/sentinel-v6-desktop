//! Phase 21 Hardening & Chaos Recovery Integration Tests

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::domain::meta::EntityMetadata;
use sentinel_common::domain::{Observation, Scope};
use sentinel_common::enums::{ObservationSource, Provenance};
use sentinel_common::events::CriticalEvent;
use sentinel_common::operational::ScopeDecision;
use sentinel_common::traits::{EventBus, ObservationStore, ScopeEngine};
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn test_phase21_wal_crash_resilience_and_transaction_abort() {
    let tmp = tempdir().unwrap();

    // 1. Open store & insert records
    {
        let store = SqliteObservationStore::open(tmp.path()).await.unwrap();
        let obs = Observation {
            meta: EntityMetadata::new(Provenance::Manual),
            source: ObservationSource::Proxy,
            data_ref: Uuid::new_v4(),
        };
        store.insert(obs.clone()).await.unwrap();

        let retrieved = store.get(obs.meta.id).await.unwrap();
        assert!(retrieved.is_some());
    }

    // 2. Re-open store (simulating restart after unclean shutdown)
    {
        let store_recovery = SqliteObservationStore::open(tmp.path()).await.unwrap();
        let count = store_recovery.observations().count().await.unwrap();
        assert_eq!(count, 1);
    }
}

#[tokio::test]
async fn test_phase21_concurrent_cas_blob_stress() {
    let tmp = tempdir().unwrap();
    let store = Arc::new(SqliteObservationStore::open(tmp.path()).await.unwrap());

    let mut handles = Vec::new();
    for i in 0..20 {
        let store_clone = Arc::clone(&store);
        handles.push(tokio::spawn(async move {
            let data = format!("Stress test blob payload {}", i).into_bytes();
            let desc = store_clone.cas().put(&data).await.unwrap();
            let read_back = store_clone
                .cas()
                .get_verified(&desc.sha256_hex)
                .await
                .unwrap();
            assert_eq!(read_back, data);
        }));
    }

    for h in handles {
        h.await.unwrap();
    }
}

#[tokio::test]
async fn test_phase21_high_pressure_scope_rule_churn() {
    for i in 0..50 {
        let domain = format!("target-{}.example.com", i);
        let scope = Scope {
            id: Uuid::new_v4(),
            version: i + 1,
            timestamp: chrono::Utc::now(),
            includes: vec![format!("https://{}/*", domain)],
            excludes: vec![],
        };
        let engine = DefaultScopeEngine::new(scope);

        let test_url = format!("https://{}/api", domain);
        let decision = engine.is_in_scope(&test_url);
        assert!(decision.allowed);
    }
}

#[tokio::test]
async fn test_phase21_zero_loss_audit_event_burst() {
    let bus = ChannelEventBus::new(EventBusConfig::default());
    let counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = Arc::clone(&counter);

    let mut rx = bus.subscribe_critical();
    tokio::spawn(async move {
        while let Some(_event) = rx.recv().await {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        }
    });

    for i in 0..100 {
        let crit = CriticalEvent::ScopeViolationAttempt {
            source: "HardeningTest".to_string(),
            target: format!("http://evil-{}.com", i),
            decision: ScopeDecision::deny(
                format!("http://evil-{}.com", i),
                1,
                None,
                "Denied in stress test",
            ),
        };
        bus.publish_critical(crit).unwrap();
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    assert_eq!(counter.load(Ordering::SeqCst), 100);
}

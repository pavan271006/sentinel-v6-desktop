// crates/sentinel_bus/tests/concurrency_tests.rs
//
// High-Concurrency Multi-Threaded Publisher and Subscriber Stress Tests (SEC-12).

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use uuid::Uuid;

use sentinel_bus::{EventBusConfig, SentinelEventBus};
use sentinel_common::{CriticalEvent, EventBus, SentinelEvent};

fn assert_send_sync<T: Send + Sync>() {}

#[test]
fn test_thread_safety_bounds() {
    assert_send_sync::<SentinelEventBus>();
    assert_send_sync::<sentinel_bus::EventEnvelope<SentinelEvent>>();
    assert_send_sync::<sentinel_bus::EventEnvelope<CriticalEvent>>();
    assert_send_sync::<sentinel_bus::TelemetryBroadcastChannel>();
    assert_send_sync::<sentinel_bus::CriticalDeliveryChannel>();
    assert_send_sync::<sentinel_bus::GracefulShutdownController>();
}

#[tokio::test]
async fn test_heavy_concurrent_load() {
    let bus = SentinelEventBus::new(EventBusConfig {
        telemetry_capacity: 10_000,
        critical_capacity: 5_000,
    });

    let num_publishers = 10;
    let num_subscribers = 5;
    let telemetry_per_publisher = 500;
    let critical_per_publisher = 50;

    let total_telemetry = num_publishers * telemetry_per_publisher;
    let total_critical = num_publishers * critical_per_publisher;

    // Spawn telemetry subscribers
    let telemetry_received_count = Arc::new(AtomicUsize::new(0));
    let mut tel_sub_handles = Vec::new();

    for _ in 0..num_subscribers {
        let mut rx = bus.subscribe_telemetry();
        let count_tracker = Arc::clone(&telemetry_received_count);

        tel_sub_handles.push(tokio::spawn(async move {
            let mut local = 0;
            while local < total_telemetry {
                match rx.recv().await {
                    Ok(_) => {
                        local += 1;
                        count_tracker.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(broadcast::error::RecvError::Lagged(missed)) => {
                        local += missed as usize;
                        count_tracker.fetch_add(missed as usize, Ordering::Relaxed);
                    }
                    Err(_) => break,
                }
            }
            local
        }));
    }

    // Spawn critical subscriber
    let mut crit_rx = bus.subscribe_critical();
    let crit_sub_handle = tokio::spawn(async move {
        let mut local = 0;
        while local < total_critical {
            if crit_rx.recv().await.is_some() {
                local += 1;
            } else {
                break;
            }
        }
        local
    });

    // Spawn concurrent publishers
    let mut pub_handles = Vec::new();
    for _ in 0..num_publishers {
        let b = bus.clone();
        pub_handles.push(tokio::spawn(async move {
            for _ in 0..telemetry_per_publisher {
                b.publish_telemetry(SentinelEvent::ObservationCreated(Uuid::new_v4()))
                    .unwrap();
            }
            for _ in 0..critical_per_publisher {
                b.publish_critical_async(CriticalEvent::FindingCreated(Uuid::new_v4()))
                    .await
                    .unwrap();
            }
        }));
    }

    // Await publishers
    for h in pub_handles {
        h.await.unwrap();
    }

    // Await critical subscriber
    let crit_received = tokio::time::timeout(Duration::from_secs(5), crit_sub_handle)
        .await
        .expect("Critical subscriber timed out")
        .expect("Critical subscriber task panicked");
    assert_eq!(crit_received, total_critical);

    // Await telemetry subscribers
    for h in tel_sub_handles {
        let rec = tokio::time::timeout(Duration::from_secs(5), h)
            .await
            .expect("Telemetry subscriber timed out")
            .expect("Subscriber task panicked");
        assert_eq!(rec, total_telemetry);
    }

    let metrics = bus.metrics();
    assert_eq!(metrics.total_telemetry_published, total_telemetry as u64);
    assert_eq!(metrics.total_critical_published, total_critical as u64);
}

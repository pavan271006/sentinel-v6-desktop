// crates/sentinel_bus/tests/broadcast_tests.rs
//
// Telemetry Broadcast Channel Unit & Integration Tests (SEC-12).

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use uuid::Uuid;

use sentinel_bus::{EventBusConfig, SentinelEventBus, DEFAULT_TELEMETRY_CAPACITY};
use sentinel_common::{EventBus, SentinelEvent};

#[tokio::test]
async fn test_telemetry_multi_subscriber_fanout() {
    let bus = SentinelEventBus::new(EventBusConfig {
        telemetry_capacity: 100,
        critical_capacity: 50,
    });

    let subscriber_count = 10;
    let message_count = 50;

    let mut receivers = Vec::new();
    for _ in 0..subscriber_count {
        receivers.push(bus.subscribe_telemetry());
    }

    let received_counts = Arc::new(AtomicUsize::new(0));
    let mut handles = Vec::new();

    for (sub_idx, mut rx) in receivers.into_iter().enumerate() {
        let counts = Arc::clone(&received_counts);
        handles.push(tokio::spawn(async move {
            let mut local_count = 0;
            while local_count < message_count {
                match rx.recv().await {
                    Ok(_) => {
                        local_count += 1;
                        counts.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(broadcast::error::RecvError::Lagged(missed)) => {
                        local_count += missed as usize;
                        counts.fetch_add(missed as usize, Ordering::Relaxed);
                    }
                    Err(_) => break,
                }
            }
            (sub_idx, local_count)
        }));
    }

    // Publish messages
    for _ in 0..message_count {
        bus.publish_telemetry(SentinelEvent::ObservationCreated(Uuid::new_v4()))
            .unwrap();
    }

    for handle in handles {
        let (idx, count) = handle.await.unwrap();
        assert_eq!(
            count, message_count,
            "Subscriber {} did not process expected message count",
            idx
        );
    }

    assert_eq!(
        received_counts.load(Ordering::SeqCst),
        subscriber_count * message_count
    );
    assert_eq!(bus.published_telemetry(), message_count as u64);
}

#[tokio::test]
async fn test_telemetry_high_throughput_burst() {
    let bus = SentinelEventBus::new(EventBusConfig {
        telemetry_capacity: DEFAULT_TELEMETRY_CAPACITY,
        critical_capacity: 1_000,
    });

    let mut rx = bus.subscribe_telemetry();
    let burst_size = 10_000;

    let recv_handle = tokio::spawn(async move {
        let mut count = 0;
        while count < burst_size {
            match rx.recv().await {
                Ok(_) => count += 1,
                Err(broadcast::error::RecvError::Lagged(missed)) => {
                    count += missed as usize;
                }
                Err(_) => break,
            }
        }
        count
    });

    for _ in 0..burst_size {
        bus.publish_telemetry(SentinelEvent::ObservationCreated(Uuid::new_v4()))
            .unwrap();
    }

    let processed = tokio::time::timeout(Duration::from_secs(5), recv_handle)
        .await
        .expect("Processing timed out")
        .expect("Task join failed");

    assert_eq!(processed, burst_size);
    assert_eq!(bus.published_telemetry(), burst_size as u64);
}

#[tokio::test]
async fn test_consumer_lag_drop_behavior_sec_12() {
    // Capacity of 8 frames
    let bus = SentinelEventBus::new(EventBusConfig {
        telemetry_capacity: 8,
        critical_capacity: 8,
    });

    let mut slow_rx = bus.subscribe_telemetry();

    // Publisher pushes 50 items rapidly without blocking
    for i in 0..50 {
        let res = bus.publish_telemetry(SentinelEvent::ObservationCreated(Uuid::new_v4()));
        assert!(
            res.is_ok(),
            "Publisher must never block or error on lagging consumer (SEC-12)"
        );
        let _ = i;
    }

    // Slow receiver attempts to read
    let first_recv = slow_rx.recv().await;
    match first_recv {
        Err(broadcast::error::RecvError::Lagged(missed)) => {
            assert!(
                missed >= 40,
                "Expected to lag by at least 40 frames, lagged by {}",
                missed
            );
        }
        other => panic!("Expected RecvError::Lagged, got {:?}", other),
    }

    // Subsequent read returns the newest frames
    let second_recv = slow_rx.recv().await;
    assert!(second_recv.is_ok());
}

#[tokio::test]
async fn test_zero_subscribers_non_blocking() {
    let bus = SentinelEventBus::default();

    // Publish with no subscribers active
    for _ in 0..100 {
        let res = bus.publish_telemetry(SentinelEvent::ObservationCreated(Uuid::new_v4()));
        assert!(res.is_ok());
    }

    assert_eq!(bus.published_telemetry(), 100);
}

#[tokio::test]
async fn test_enveloped_telemetry_broadcast() {
    let bus = SentinelEventBus::default();
    let mut env_rx = bus.subscribe_enveloped_telemetry();

    let obs_id = Uuid::new_v4();
    bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id))
        .unwrap();

    let envelope = env_rx.recv().await.unwrap();
    assert_eq!(envelope.topic, "telemetry.observation");
    assert_eq!(envelope.subsystem, "SUB-03 ObservationStore");
    assert_eq!(envelope.payload, SentinelEvent::ObservationCreated(obs_id));
    assert!(envelope.sequence_number >= 1);
}

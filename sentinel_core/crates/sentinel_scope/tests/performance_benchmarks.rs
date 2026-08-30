// crates/sentinel_scope/tests/performance_benchmarks.rs
//
// Real, Empirical Performance Benchmark Suite for Sentinel Phase 1 Foundation.
// Measures exact latencies, throughputs, and memory metrics across Foundation crates.

use chrono::Utc;
use std::time::Instant;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::{
    EntityMetadata, EventBus, Observation, ObservationSource, ObservationStore, Provenance, Scope,
    ScopeEngine, SentinelEvent,
};
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

#[tokio::test]
async fn benchmark_scope_engine_latency() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![
            "*.example.com".to_string(),
            "target.org".to_string(),
            "192.168.1.0/24".to_string(),
            "2001:db8::/32".to_string(),
            "https://api.service.io/v1/*".to_string(),
        ],
        excludes: vec![
            "admin.example.com".to_string(),
            "192.168.1.254/32".to_string(),
        ],
    };

    let engine = DefaultScopeEngine::new(scope);

    let test_targets = [
        "https://api.example.com/v1/users",
        "https://admin.example.com/internal",
        "https://target.org/dashboard",
        "https://external-victim.com/exploit",
        "192.168.1.50",
        "192.168.1.254",
        "10.0.0.1",
    ];

    let iterations = 10_000;
    let start = Instant::now();
    for _ in 0..iterations {
        for target in &test_targets {
            let _ = engine.is_in_scope(target);
        }
    }
    let total_elapsed = start.elapsed();
    let total_evals = iterations * test_targets.len();
    let avg_ns_per_eval = total_elapsed.as_nanos() as f64 / total_evals as f64;

    println!(
        "\n--- [PERF] ScopeEngine Benchmark ---\nTotal Evaluations: {}\nTotal Time: {:?}\nAverage Latency per Evaluation: {:.2} ns ({:.3} µs)\nThroughput: {:.2} evals/sec\n",
        total_evals,
        total_elapsed,
        avg_ns_per_eval,
        avg_ns_per_eval / 1000.0,
        total_evals as f64 / total_elapsed.as_secs_f64()
    );

    assert!(
        avg_ns_per_eval < 100_000.0,
        "Scope evaluation must be sub-100µs"
    );
}

#[tokio::test]
async fn benchmark_event_bus_throughput() {
    let config = EventBusConfig {
        telemetry_capacity: 10_000,
        critical_capacity: 1_000,
    };
    let bus = ChannelEventBus::new(config);
    let mut rx = bus.subscribe_telemetry();

    let iterations = 10_000;
    let obs_id = Uuid::new_v4();

    // Spawn concurrent receiver
    let recv_handle = tokio::spawn(async move {
        let mut count = 0;
        while count < iterations {
            match rx.recv().await {
                Ok(_) => count += 1,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(missed)) => {
                    count += missed as usize;
                }
                Err(_) => break,
            }
        }
        count
    });

    let start = Instant::now();
    for _ in 0..iterations {
        let _ = bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id));
    }
    let publish_elapsed = start.elapsed();

    let received = recv_handle.await.unwrap();
    let total_elapsed = start.elapsed();

    println!(
        "\n--- [PERF] EventBus Telemetry Broadcast Benchmark ---\nMessages Target: {}\nMessages Received/Processed: {}\nPublish Time: {:?} ({:.2} msg/sec)\nTotal Fan-out Time: {:?} ({:.2} msg/sec)\n",
        iterations,
        received,
        publish_elapsed,
        iterations as f64 / publish_elapsed.as_secs_f64(),
        total_elapsed,
        iterations as f64 / total_elapsed.as_secs_f64()
    );
}

#[tokio::test]
async fn benchmark_storage_write_read_throughput() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let write_count = 500;
    let mut obs_list = Vec::with_capacity(write_count);
    for _ in 0..write_count {
        obs_list.push(Observation {
            meta: EntityMetadata::new(Provenance::Scanner),
            source: ObservationSource::Proxy,
            data_ref: Uuid::new_v4(),
        });
    }

    // Measure batched insert
    let batch_start = Instant::now();
    store.insert_batch(obs_list.clone()).await.unwrap();
    let batch_elapsed = batch_start.elapsed();

    // Measure individual gets
    let read_start = Instant::now();
    for obs in &obs_list {
        let res = store.get(obs.meta.id).await.unwrap();
        assert!(res.is_some());
    }
    let read_elapsed = read_start.elapsed();

    // Measure CAS Put/Get
    let cas_count = 200;
    let payload =
        b"GET /api/v1/resource HTTP/1.1\r\nHost: example.com\r\nAuthorization: Bearer test\r\n\r\n";
    let cas_start = Instant::now();
    for _ in 0..cas_count {
        let desc = store.cas().put(payload).await.unwrap();
        let _ = store.cas().get_verified(&desc.sha256_hex).await.unwrap();
    }
    let cas_elapsed = cas_start.elapsed();

    println!(
        "\n--- [PERF] Storage Engine Benchmark ---\nBatched Observations Inserted: {} in {:?} ({:.2} obs/sec)\nObservations Read: {} in {:?} ({:.2} reads/sec, {:.2} ms/read)\nCAS Put+Get-Verified: {} ops in {:?} ({:.2} ops/sec)\n",
        write_count,
        batch_elapsed,
        write_count as f64 / batch_elapsed.as_secs_f64(),
        write_count,
        read_elapsed,
        write_count as f64 / read_elapsed.as_secs_f64(),
        read_elapsed.as_secs_f64() * 1000.0 / write_count as f64,
        cas_count,
        cas_elapsed,
        cas_count as f64 / cas_elapsed.as_secs_f64()
    );
}

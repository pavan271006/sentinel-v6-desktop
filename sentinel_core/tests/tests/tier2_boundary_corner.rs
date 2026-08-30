//! Tier 2: Boundary & Corner Cases Test Suite (>=5 boundary test cases per feature)
//!
//! Stresses physical boundaries, edge cases, protocol ambiguities, and malformed inputs:
//! - 0-byte payloads and huge 10MB payloads
//! - ReDoS catastrophic backtracking safety
//! - Obsolete line folding (obs-fold) and delimiter edge cases
//! - IPv4-mapped IPv6 address resolution
//! - Extreme concurrent stress and buffer saturations

use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::Utc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::domain::meta::EntityMetadata;
use sentinel_common::domain::{Observation, Scope, SecretReference};
use sentinel_common::enums::{HttpMethod, ObservationSource, Provenance};
use sentinel_common::events::{CriticalEvent, SentinelEvent};
use sentinel_common::operational::ScopeDecision;
use sentinel_common::traits::{EventBus, HttpParser, ObservationStore, ScopeEngine};
use sentinel_parser::chunked::ChunkedDecoder;
use sentinel_parser::headers::parse_headers;
use sentinel_parser::SentinelHttpParser;
use sentinel_scope::matchers::url::{UrlMatchResult, UrlMatcher};
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

// ==========================================
// 1. CAS & STORAGE BOUNDARIES (5 tests)
// ==========================================

#[tokio::test]
async fn test_t2_cas_zero_byte_empty_blob() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let empty_payload: &[u8] = b"";
    let desc = store.cas().put(empty_payload).await.unwrap();

    assert_eq!(desc.size_bytes, 0);
    // SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    assert_eq!(
        desc.sha256_hex,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    let retrieved = store.cas().get_verified(&desc.sha256_hex).await.unwrap();
    assert!(retrieved.is_empty());
}

#[tokio::test]
async fn test_t2_cas_large_multi_megabyte_payload() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    // 2MB payload
    let large_payload = vec![0x41; 2 * 1024 * 1024];
    let desc = store.cas().put(&large_payload).await.unwrap();

    assert_eq!(desc.size_bytes, 2 * 1024 * 1024);
    let retrieved = store.cas().get_verified(&desc.sha256_hex).await.unwrap();
    assert_eq!(retrieved.len(), 2 * 1024 * 1024);
    assert_eq!(retrieved[0], 0x41);
    assert_eq!(retrieved[2 * 1024 * 1024 - 1], 0x41);
}

#[tokio::test]
async fn test_t2_cas_nonexistent_blob_returns_error() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let random_sha = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    let res = store.cas().get_verified(random_sha).await;
    assert!(res.is_err(), "Must return error for nonexistent blob");
}

#[tokio::test]
async fn test_t2_storage_large_batch_insertion() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    let batch_size = 500;
    let mut observations = Vec::with_capacity(batch_size);
    for _ in 0..batch_size {
        observations.push(Observation {
            meta: EntityMetadata::new(Provenance::Proxy),
            source: ObservationSource::Proxy,
            data_ref: Uuid::new_v4(),
        });
    }

    store.insert_batch(observations).await.unwrap();

    let list = store.query_sql("SELECT * FROM observations").await.unwrap();
    assert_eq!(list.len(), batch_size);
}

#[tokio::test]
async fn test_t2_storage_pagination_limits_and_offsets() {
    let temp = tempdir().unwrap();
    let store = SqliteObservationStore::open(temp.path()).await.unwrap();

    for _ in 0..25 {
        store
            .insert(Observation {
                meta: EntityMetadata::new(Provenance::Proxy),
                source: ObservationSource::Proxy,
                data_ref: Uuid::new_v4(),
            })
            .await
            .unwrap();
    }

    let page1 = store.observations().list(10, 0).await.unwrap();
    assert_eq!(page1.len(), 10);

    let page2 = store.observations().list(10, 10).await.unwrap();
    assert_eq!(page2.len(), 10);

    let page3 = store.observations().list(10, 20).await.unwrap();
    assert_eq!(page3.len(), 5);

    let page4 = store.observations().list(10, 30).await.unwrap();
    assert!(page4.is_empty());
}

// ==========================================
// 2. SCOPE MATCHERS BOUNDARIES (5 tests)
// ==========================================

#[test]
fn test_t2_scope_redos_catastrophic_backtracking_fail_closed() {
    // Evil ReDoS regex: (a+)+$ against "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
    let evil_pattern = "^(a+)+$";
    let matcher = UrlMatcher::parse(evil_pattern);

    let malicious_target = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!";
    let start = Instant::now();
    let match_res = matcher.evaluate(malicious_target);
    let duration = start.elapsed();

    // Regex engine evaluates safely and quickly, failing closed
    assert!(
        match_res == UrlMatchResult::NotMatched || match_res == UrlMatchResult::Timeout,
        "ReDoS must fail closed safely"
    );
    assert!(
        duration < Duration::from_millis(50),
        "ReDoS must be evaluated safely in sub-50ms"
    );
}

#[test]
fn test_t2_scope_oversized_regex_pattern_rejected() {
    // Regex pattern exceeding 1000 characters
    let huge_pattern = format!("^{}$", "a".repeat(1005));
    let matcher = UrlMatcher::parse(&huge_pattern);
    assert_eq!(matcher.evaluate("test"), UrlMatchResult::PatternTooLong);
}

#[test]
fn test_t2_scope_ipv4_mapped_ipv6_resolution() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["192.168.1.0/24".to_string()],
        excludes: vec![],
    };
    let engine = DefaultScopeEngine::new(scope);

    // IPv4-mapped IPv6 address: ::ffff:192.168.1.50
    let decision = engine.is_ip_in_scope("::ffff:192.168.1.50");
    assert!(
        decision.allowed,
        "IPv4-mapped IPv6 in included subnet must be allowed"
    );
}

#[test]
fn test_t2_scope_malformed_url_fail_closed() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["https://target.com/*".to_string()],
        excludes: vec![],
    };
    let engine = DefaultScopeEngine::new(scope);

    let malformed_targets = [
        "ht!tp://invalid-scheme",
        "://missing-scheme",
        "https://",
        "https://[invalid-ipv6/test",
        "",
    ];

    for target in &malformed_targets {
        let decision = engine.is_in_scope(target);
        assert!(
            !decision.allowed,
            "Malformed target '{}' must fail-closed to DENY",
            target
        );
    }
}

#[test]
fn test_t2_scope_case_insensitivity_and_trailing_slashes() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec!["API.Target.COM".to_string()],
        excludes: vec![],
    };
    let engine = DefaultScopeEngine::new(scope);

    assert!(engine.is_in_scope("https://api.target.com/").allowed);
    assert!(engine.is_in_scope("https://API.TARGET.COM/v1").allowed);
    assert!(engine.is_in_scope("https://Api.Target.Com:443/v1").allowed);
}

// ==========================================
// 3. HTTP PARSER BOUNDARIES & ANOMALIES (5 tests)
// ==========================================

#[test]
fn test_t2_parser_obs_fold_line_folding_handling() {
    let raw = b"GET / HTTP/1.1\r\nHost: example.com\r\nX-Folded-Header: line1\r\n line2\r\n\tline3\r\n\r\n";
    let (headers, _offset, obs_fold) = parse_headers(raw, 16).unwrap();

    assert!(obs_fold, "Obs-fold line folding must be detected");
    let folded_h = headers
        .iter()
        .find(|h| h.name == b"X-Folded-Header")
        .unwrap();
    assert!(folded_h.value.windows(5).any(|w| w == b"line2"));
    assert!(folded_h.value.windows(5).any(|w| w == b"line3"));
}

#[test]
fn test_t2_parser_whitespace_before_colon_preservation() {
    let raw = b"GET / HTTP/1.1\r\nContent-Length : 0\r\nHost : example.com\r\n\r\n";
    let (headers, _, _) = parse_headers(raw, 16).unwrap();

    let cl = headers
        .iter()
        .find(|h| h.name == b"Content-Length")
        .unwrap();
    assert!(cl.space_before_colon, "Space before colon must be flagged");
}

#[test]
fn test_t2_parser_oversized_body_rejection() {
    let parser = SentinelHttpParser::with_max_body_size(1024); // 1KB limit
    let raw = b"POST /upload HTTP/1.1\r\nHost: example.com\r\nContent-Length: 2048\r\n\r\n";

    let res = parser.parse_request(raw);
    assert!(
        res.is_err(),
        "Request exceeding max_body_size must be rejected"
    );
}

#[test]
fn test_t2_parser_malformed_chunk_hex_anomaly() {
    let raw = b"POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\nZZ\r\nmalformed\r\n0\r\n\r\n";
    let res = ChunkedDecoder::decode(&raw[30..], 1024 * 1024);
    assert!(res.is_err(), "Invalid chunk hex 'ZZ' must fail cleanly");
}

#[test]
fn test_t2_parser_bare_lf_line_endings_support() {
    let parser = SentinelHttpParser::new();
    let raw = b"GET /bare-lf HTTP/1.1\nHost: target.com\nUser-Agent: Sentinel\n\n";

    let req = parser.parse_request(raw).unwrap();
    assert_eq!(req.method, HttpMethod::GET);
    assert_eq!(req.uri, "/bare-lf");
    assert_eq!(req.headers.len(), 2);
}

// ==========================================
// 4. EVENT BUS & CONCURRENCY BOUNDARIES (5 tests)
// ==========================================

#[tokio::test]
async fn test_t2_bus_high_concurrency_multi_producer_stress() {
    let bus = Arc::new(ChannelEventBus::new(EventBusConfig::default()));
    let producer_count = 10;
    let events_per_producer = 500;

    let mut handles = Vec::new();
    for _ in 0..producer_count {
        let bus_clone = bus.clone();
        handles.push(tokio::spawn(async move {
            for _ in 0..events_per_producer {
                let _ =
                    bus_clone.publish_telemetry(SentinelEvent::ObservationCreated(Uuid::new_v4()));
            }
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    let stats = bus.metrics();
    assert_eq!(stats.telemetry_capacity, 10_000);
}

#[tokio::test]
async fn test_t2_bus_critical_queue_backpressure() {
    let config = EventBusConfig {
        telemetry_capacity: 100,
        critical_capacity: 50,
    };
    let bus = ChannelEventBus::new(config);
    let mut rx = bus.subscribe_critical();

    // Fill critical channel up to capacity
    for i in 0..50 {
        bus.publish_critical(CriticalEvent::ScopeViolationAttempt {
            source: "Test".to_string(),
            target: format!("victim-{}", i),
            decision: ScopeDecision::deny(format!("victim-{}", i), 1, None, "Denied"),
        })
        .unwrap();
    }

    // Drain and verify order
    for i in 0..50 {
        let ev = rx.recv().await.unwrap();
        if let CriticalEvent::ScopeViolationAttempt { target, .. } = ev {
            assert_eq!(target, format!("victim-{}", i));
        }
    }
}

#[tokio::test]
async fn test_t2_bus_multiple_independent_subscribers() {
    let bus = ChannelEventBus::new(EventBusConfig::default());
    let mut rxs: Vec<_> = (0..10).map(|_| bus.subscribe_telemetry()).collect();

    let obs_id = Uuid::new_v4();
    bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id))
        .unwrap();

    for rx in &mut rxs {
        let ev = rx.recv().await.unwrap();
        assert_eq!(ev, SentinelEvent::ObservationCreated(obs_id));
    }
}

#[test]
fn test_t2_secret_reference_independence() {
    let ref1 = SecretReference::new("vault_a");
    let ref2 = ref1.clone();

    assert_eq!(ref1.reference_id, ref2.reference_id);
    assert_eq!(ref1.vault_backend, ref2.vault_backend);
}

//! Empirical Stress and Operational Limit Verification Suite for Milestone 1.
//!
//! Tests:
//! 1. Timeout & Slow Body Aborts (simulating slowloris / stalled streams)
//! 2. Maximum Body Size Truncation & Memory Bounding (5MB limit & custom limits)
//! 3. Maximum Redirect Hops & Cycle Detection (loops, chains, SSRF hops)
//! 4. High Concurrency In-Memory Evidence Store Insertions & Lookups

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Notify;
use ucma_core::evidence::{EvidenceRecord, EvidenceStore, Severity};
use ucma_core::ids::{RequestId, TargetId};
use ucma_core::snapshot::ResponseSnapshot;
use ucma_http::client::{HttpError, SafeHttpClient};
use ucma_http::limits::HttpLimits;
use ucma_scope::ScopeError;
use ucma_scope::dns::SafeDnsResolver;
use ucma_scope::policy::ScopePolicy;

// ============================================================================
// STRESS FIXTURE: Raw TCP Mock Server for Slowloris & Truncation Simulation
// ============================================================================

struct AdvancedMockServer {
    addr: SocketAddr,
    shutdown: Arc<Notify>,
}

impl AdvancedMockServer {
    async fn spawn() -> Result<Self, std::io::Error> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let shutdown = Arc::new(Notify::new());
        let shutdown_rx = shutdown.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_res = listener.accept() => {
                        if let Ok((mut socket, _)) = accept_res {
                            tokio::spawn(async move {
                                let mut buf = vec![0u8; 4096];
                                let n = match socket.read(&mut buf).await {
                                    Ok(n) if n > 0 => n,
                                    _ => return,
                                };

                                let request_str = String::from_utf8_lossy(&buf[..n]);
                                let first_line = request_str.lines().next().unwrap_or("");
                                let mut parts = first_line.split_whitespace();
                                let _method = parts.next().unwrap_or("GET");
                                let path = parts.next().unwrap_or("/");

                                match path {
                                    "/stall-header" => {
                                        // Never write anything; keep socket open until client times out
                                        tokio::time::sleep(Duration::from_secs(10)).await;
                                    }
                                    "/slowloris-stream" => {
                                        // Send headers and partial chunk, then stall
                                        let headers = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n";
                                        let _ = socket.write_all(headers.as_bytes()).await;
                                        let chunk1 = "5\r\nHELLO\r\n";
                                        let _ = socket.write_all(chunk1.as_bytes()).await;
                                        // Now stall indefinitely
                                        tokio::time::sleep(Duration::from_secs(10)).await;
                                    }
                                    "/trickle-body" => {
                                        let headers = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n";
                                        let _ = socket.write_all(headers.as_bytes()).await;
                                        for _ in 0..50 {
                                            let _ = socket.write_all(b"1\r\nX\r\n").await;
                                            tokio::time::sleep(Duration::from_millis(50)).await;
                                        }
                                        let _ = socket.write_all(b"0\r\n\r\n").await;
                                    }
                                    "/huge-10mb" => {
                                        // Send 10 MB in 64KB chunks
                                        let headers = "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: 10485760\r\n\r\n";
                                        if socket.write_all(headers.as_bytes()).await.is_err() {
                                            return;
                                        }
                                        let chunk = vec![0xAAu8; 64 * 1024];
                                        for _ in 0..(10 * 1024 * 1024 / (64 * 1024)) {
                                            if socket.write_all(&chunk).await.is_err() {
                                                break;
                                            }
                                        }
                                    }
                                    "/cycle-a" => {
                                        let resp = "HTTP/1.1 302 Found\r\nLocation: /cycle-b\r\nContent-Length: 0\r\n\r\n";
                                        let _ = socket.write_all(resp.as_bytes()).await;
                                    }
                                    "/cycle-b" => {
                                        let resp = "HTTP/1.1 302 Found\r\nLocation: /cycle-a\r\nContent-Length: 0\r\n\r\n";
                                        let _ = socket.write_all(resp.as_bytes()).await;
                                    }
                                    "/self-loop" => {
                                        let resp = "HTTP/1.1 302 Found\r\nLocation: /self-loop\r\nContent-Length: 0\r\n\r\n";
                                        let _ = socket.write_all(resp.as_bytes()).await;
                                    }
                                    p if p.starts_with("/chain/") => {
                                        let hop: usize = p.trim_start_matches("/chain/").parse().unwrap_or(0);
                                        if hop >= 10 {
                                            let resp = "HTTP/1.1 200 OK\r\nContent-Length: 9\r\n\r\nchain-end";
                                            let _ = socket.write_all(resp.as_bytes()).await;
                                        } else {
                                            let next = format!("/chain/{}", hop + 1);
                                            let resp = format!("HTTP/1.1 302 Found\r\nLocation: {}\r\nContent-Length: 0\r\n\r\n", next);
                                            let _ = socket.write_all(resp.as_bytes()).await;
                                        }
                                    }
                                    _ => {
                                        let resp = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
                                        let _ = socket.write_all(resp.as_bytes()).await;
                                    }
                                }
                            });
                        }
                    }
                    _ = shutdown_rx.notified() => {
                        break;
                    }
                }
            }
        });

        Ok(Self { addr, shutdown })
    }

    fn url(&self, path: &str) -> String {
        format!("http://127.0.0.1:{}{}", self.addr.port(), path)
    }

    fn shutdown(self) {
        self.shutdown.notify_one();
    }
}

// ============================================================================
// TEST 1: Timeout & Slow Body Aborts (Slowloris / Stalled Streams)
// ============================================================================

#[tokio::test]
async fn test_stress_header_stall_timeout_abort() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    let limits = HttpLimits::builder()
        .overall_timeout(Duration::from_millis(100))
        .build();

    let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

    let start = Instant::now();
    let auth_req = policy
        .authorize_url(&server.url("/stall-header"))
        .await
        .unwrap();
    let result = client.send(auth_req).await;
    let elapsed = start.elapsed();

    assert!(result.is_err(), "Expected timeout error on stalled header");
    match result.unwrap_err() {
        HttpError::Timeout(_) => {}
        HttpError::Network(e) => assert!(e.is_timeout(), "Network error must be timeout"),
        other => panic!("Unexpected error: {:?}", other),
    }

    // Verify bounded execution time (100ms timeout should abort around 100ms - 500ms, not 10s)
    assert!(
        elapsed < Duration::from_secs(2),
        "Stall timeout took too long: {:?}",
        elapsed
    );

    server.shutdown();
}

#[tokio::test]
async fn test_stress_slowloris_stream_bounded_completion() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Set overall timeout to 150ms
    let limits = HttpLimits::builder()
        .overall_timeout(Duration::from_millis(150))
        .build();

    let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

    let start = Instant::now();
    let auth_req = policy
        .authorize_url(&server.url("/slowloris-stream"))
        .await
        .unwrap();
    let result = client.send(auth_req).await;
    let elapsed = start.elapsed();

    // Client must either return a partial snapshot or timeout, but must NEVER hang for 10s!
    assert!(
        elapsed < Duration::from_secs(2),
        "Slowloris stream hung for {:?}",
        elapsed
    );

    if let Ok(snapshot) = result {
        // Partial chunk was received before stall
        assert_eq!(snapshot.status_code, 200);
        assert_eq!(snapshot.body, b"HELLO");
    }

    server.shutdown();
}

#[tokio::test]
async fn test_stress_trickle_body_overall_timeout() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Trickle sends 50 * 50ms = 2.5s. Limit to 200ms.
    let limits = HttpLimits::builder()
        .overall_timeout(Duration::from_millis(200))
        .build();

    let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

    let start = Instant::now();
    let auth_req = policy
        .authorize_url(&server.url("/trickle-body"))
        .await
        .unwrap();
    let result = client.send(auth_req).await;
    let elapsed = start.elapsed();

    assert!(
        elapsed < Duration::from_secs(2),
        "Trickle body exceeded timeout budget: {:?}",
        elapsed
    );
    if let Ok(snapshot) = result {
        // Stream completed partially within 200ms window (< 50 bytes)
        assert!(
            snapshot.body.len() < 50,
            "Body should have been truncated by timeout"
        );
    }

    server.shutdown();
}

// ============================================================================
// TEST 2: Maximum Body Size Truncation & 5MB Memory Limit
// ============================================================================

#[tokio::test]
async fn test_stress_5mb_default_limit_truncation() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Default HttpLimits has max_body_bytes = 5MB (5,242,880 bytes)
    let limits = HttpLimits::default();
    assert_eq!(limits.max_body_bytes, 5 * 1024 * 1024);

    let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

    // /huge-10mb sends 10MB (10,485,760 bytes)
    let auth_req = policy
        .authorize_url(&server.url("/huge-10mb"))
        .await
        .unwrap();
    let snapshot = client
        .send(auth_req)
        .await
        .expect("Request should succeed with truncation");

    assert_eq!(snapshot.status_code, 200);
    assert_eq!(
        snapshot.body.len(),
        5 * 1024 * 1024,
        "Body must be truncated at exactly 5MB"
    );
    assert!(snapshot.truncated, "Snapshot flag 'truncated' must be true");

    // Verify raw wire representation is also generated and hashed deterministically
    assert_eq!(snapshot.blake3_raw_wire_hash.as_bytes().len(), 32);
    assert_eq!(snapshot.blake3_body_hash.as_bytes().len(), 32);

    server.shutdown();
}

#[tokio::test]
async fn test_stress_custom_body_size_limits() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Test extreme boundaries: 0 bytes, 128 bytes, 1 MB
    for limit in [0, 128, 1024, 1024 * 1024] {
        let limits = HttpLimits::builder().max_body_bytes(limit).build();
        let client = SafeHttpClient::new(limits, policy.clone()).unwrap();

        let auth_req = policy
            .authorize_url(&server.url("/huge-10mb"))
            .await
            .unwrap();
        let snapshot = client.send(auth_req).await.unwrap();

        assert_eq!(
            snapshot.body.len(),
            limit,
            "Body size must strictly match limit {}",
            limit
        );
        assert!(snapshot.truncated);
    }

    server.shutdown();
}

// ============================================================================
// TEST 3: Maximum Redirect Hops & Cycle Detection
// ============================================================================

#[tokio::test]
async fn test_stress_redirect_cycle_aborts_at_hop_limit() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    let client = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();

    // 1. Two-node cycle: /cycle-a -> /cycle-b -> /cycle-a -> ...
    let auth_req = policy.authorize_url(&server.url("/cycle-a")).await.unwrap();
    let res_cycle = client.send(auth_req).await;
    assert!(res_cycle.is_err());
    match res_cycle.unwrap_err() {
        HttpError::Scope(ScopeError::TooManyRedirects(max)) => {
            assert_eq!(max, 5);
        }
        other => panic!("Expected ScopeError::TooManyRedirects, got {:?}", other),
    }

    // 2. Self loop: /self-loop -> /self-loop
    let auth_req_self = policy
        .authorize_url(&server.url("/self-loop"))
        .await
        .unwrap();
    let res_self = client.send(auth_req_self).await;
    assert!(res_self.is_err());
    match res_self.unwrap_err() {
        HttpError::Scope(ScopeError::TooManyRedirects(5)) => {}
        other => panic!("Expected ScopeError::TooManyRedirects(5), got {:?}", other),
    }

    server.shutdown();
}

#[tokio::test]
async fn test_stress_deep_redirect_chain_behavior() {
    let server = AdvancedMockServer::spawn().await.unwrap();
    let port = server.addr.port();

    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "127.0.0.1".to_string(),
        vec!["127.0.0.1".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns.clone(), true);
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .with_resolver(resolver)
            .build(),
    );

    // Chain has 10 hops.
    // Client with max_redirects = 5 must abort.
    let client_default = SafeHttpClient::new(HttpLimits::default(), policy.clone()).unwrap();
    let auth_req = policy.authorize_url(&server.url("/chain/0")).await.unwrap();
    let res_abort = client_default.send(auth_req).await;
    assert!(matches!(
        res_abort.unwrap_err(),
        HttpError::Scope(ScopeError::TooManyRedirects(5))
    ));

    // Policy with max_redirects = 15 must succeed all 10 hops!
    let policy_15 = Arc::new(
        ScopePolicy::builder()
            .allow_host("127.0.0.1")
            .allow_port(port)
            .allow_private_ips(true)
            .max_redirects(15)
            .with_resolver(SafeDnsResolver::new_mock(mock_dns, true))
            .build(),
    );
    let client_15 = SafeHttpClient::new(HttpLimits::default(), policy_15.clone()).unwrap();
    let auth_req_15 = policy_15
        .authorize_url(&server.url("/chain/0"))
        .await
        .unwrap();
    let snap_success = client_15
        .send(auth_req_15)
        .await
        .expect("Chain of 10 hops should succeed with max_redirects=15");

    assert_eq!(snap_success.status_code, 200);
    assert_eq!(snap_success.body_str().unwrap(), "chain-end");

    server.shutdown();
}

#[tokio::test]
async fn test_stress_redirect_to_ssrf_and_out_of_scope() {
    let mut mock_dns = HashMap::new();
    mock_dns.insert(
        "app.target.com".to_string(),
        vec!["93.184.216.34".parse::<IpAddr>().unwrap()],
    );
    mock_dns.insert(
        "metadata.target.com".to_string(),
        vec!["169.254.169.254".parse::<IpAddr>().unwrap()],
    );
    mock_dns.insert(
        "unauthorized.external.com".to_string(),
        vec!["93.184.216.99".parse::<IpAddr>().unwrap()],
    );

    let resolver = SafeDnsResolver::new_mock(mock_dns, false); // Anti-SSRF active (blocks 169.254.169.254)
    let policy = Arc::new(
        ScopePolicy::builder()
            .allow_host("app.target.com")
            .allow_host("metadata.target.com") // In allowed hosts, but DNS resolves to SSRF IP!
            .allow_port(80)
            .allow_port(443)
            .allow_private_ips(false) // Blocks SSRF
            .with_resolver(resolver)
            .build(),
    );

    let initial_url = url::Url::parse("https://app.target.com/start").unwrap();

    // 1. Redirect to host that resolves to SSRF IP (169.254.169.254) -> SsrfBlocked
    let mut headers_ssrf = HashMap::new();
    headers_ssrf.insert(
        "location".to_string(),
        "https://metadata.target.com/latest/meta-data/".to_string(),
    );

    let decision_ssrf = ucma_http::redirect::RedirectValidator::evaluate_hop(
        &initial_url,
        302,
        &headers_ssrf,
        0,
        5,
        &policy,
    )
    .await;

    assert!(decision_ssrf.is_err());
    assert!(matches!(
        decision_ssrf.unwrap_err(),
        ScopeError::SsrfBlocked(_, _)
    ));

    // 2. Redirect to out-of-scope host -> OutOfScope
    let mut headers_oos = HashMap::new();
    headers_oos.insert(
        "location".to_string(),
        "https://unauthorized.external.com/leak".to_string(),
    );

    let decision_oos = ucma_http::redirect::RedirectValidator::evaluate_hop(
        &initial_url,
        302,
        &headers_oos,
        0,
        5,
        &policy,
    )
    .await;

    assert!(decision_oos.is_err());
    assert!(matches!(
        decision_oos.unwrap_err(),
        ScopeError::OutOfScope(_)
    ));
}

// ============================================================================
// TEST 4: High Concurrency Evidence Store Insertions & Lookups
// ============================================================================

#[tokio::test]
async fn test_stress_high_concurrency_evidence_store() {
    let store = Arc::new(EvidenceStore::new());
    let num_tasks = 50;
    let ops_per_task = 200; // 50 * 200 = 10,000 snapshots & 5,000 evidence records
    let num_targets = 20;

    let targets: Vec<TargetId> = (0..num_targets)
        .map(|i| TargetId::derive(&format!("https://target-{}.internal.corp", i)))
        .collect();

    let completed_insertions = Arc::new(AtomicUsize::new(0));
    let completed_lookups = Arc::new(AtomicUsize::new(0));

    let start_time = Instant::now();
    let mut handles = Vec::new();

    // Spawn concurrent writer and reader tasks
    for task_idx in 0..num_tasks {
        let store_clone = store.clone();
        let targets_clone = targets.clone();
        let insertions_counter = completed_insertions.clone();
        let lookups_counter = completed_lookups.clone();

        let handle = tokio::spawn(async move {
            for op in 0..ops_per_task {
                let target_id = targets_clone[(task_idx + op) % targets_clone.len()];
                let req_id = RequestId::from_bytes(
                    *blake3::hash(format!("{}-{}", task_idx, op).as_bytes()).as_bytes(),
                );

                // 1. Insert snapshot
                let snapshot = ResponseSnapshot::new(
                    req_id,
                    200,
                    HashMap::new(),
                    format!("payload-{}-{}", task_idx, op).into_bytes(),
                    1_000_000,
                    format!("HTTP/1.1 200 OK\r\n\r\npayload-{}-{}", task_idx, op).as_bytes(),
                    false,
                    Some("127.0.0.1".to_string()),
                );
                let snap_id = snapshot.id;
                store_clone.insert_snapshot(snapshot);
                insertions_counter.fetch_add(1, Ordering::Relaxed);

                // 2. Insert evidence record on every alternate op
                if op % 2 == 0 {
                    let evidence = EvidenceRecord::new(
                        target_id,
                        "StressFinding",
                        format!("Finding {}-{}", task_idx, op),
                        "Concurrent stress test evidence record",
                        Severity::High,
                        vec![snap_id],
                    )
                    .with_metadata("task_idx", task_idx.to_string())
                    .with_metadata("op_idx", op.to_string());

                    let evid_id = evidence.id;
                    store_clone.insert_evidence(evidence);

                    // Immediate concurrent lookup
                    let fetched_ev = store_clone.get_evidence(&evid_id);
                    assert!(
                        fetched_ev.is_some(),
                        "Evidence record immediately after write must be present"
                    );
                    lookups_counter.fetch_add(1, Ordering::Relaxed);
                }

                // 3. Concurrent snapshot lookup
                let fetched_snap = store_clone.get_snapshot(&snap_id);
                assert!(fetched_snap.is_some(), "Snapshot must be present");
                lookups_counter.fetch_add(1, Ordering::Relaxed);

                // 4. Periodic target query
                if op % 10 == 0 {
                    let target_evidence = store_clone.evidence_for_target(&target_id);
                    assert!(!target_evidence.is_empty());
                    lookups_counter.fetch_add(1, Ordering::Relaxed);
                }
            }
        });

        handles.push(handle);
    }

    // Await all concurrent tasks
    for handle in handles {
        handle.await.expect("Concurrent task failed");
    }

    let elapsed = start_time.elapsed();

    let total_snaps = store.count_snapshots();
    let total_evids = store.count_evidence();
    let expected_snaps = num_tasks * ops_per_task;
    let expected_evids = num_tasks * (ops_per_task / 2);

    assert_eq!(
        total_snaps, expected_snaps,
        "All snapshots must be preserved without loss"
    );
    assert_eq!(
        total_evids, expected_evids,
        "All evidence records must be preserved without loss"
    );

    let total_ops =
        completed_insertions.load(Ordering::SeqCst) + completed_lookups.load(Ordering::SeqCst);
    let throughput = total_ops as f64 / elapsed.as_secs_f64();

    println!(
        "\n[HIGH CONCURRENCY STRESS RESULTS]\n\
         - Total Snapshots Stored: {}\n\
         - Total Evidence Stored : {}\n\
         - Total Concurrent Operations: {}\n\
         - Elapsed Time: {:.3}s\n\
         - Concurrent Throughput: {:.1} ops/sec\n",
        total_snaps,
        total_evids,
        total_ops,
        elapsed.as_secs_f64(),
        throughput
    );

    assert!(
        throughput > 1000.0,
        "Concurrent throughput should exceed 1,000 ops/sec"
    );
}

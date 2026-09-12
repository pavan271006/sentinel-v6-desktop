//! Forensic Audit Test Suite for Milestone M1 Iteration 2
//!
//! Independently verifies:
//! 1. RFC 9112 / RFC 7230 Framing Parser Authenticity (zero-body, chunked, extensions, trailers, HEAD)
//! 2. Genuine Connection Pooling (socket reuse, dead connection detection, idle expiration, bounded capacity)
//! 3. High-concurrency thread safety (50 concurrent tasks, zero deadlocks)
//! 4. Security Invariants SEC-01 (Scope Fail-Closed) and SEC-06/07 (CAS Immutability)

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use uuid::Uuid;

use sentinel_common::domain::Scope;
use sentinel_common::errors::SentinelError;
use sentinel_dispatch::pool::{
    read_http_response_framed, HttpConnectionPool, PoolConfig, PoolKey,
};
use sentinel_dispatch::HttpDispatcher;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

fn make_scope(allowed_host: &str) -> Arc<DefaultScopeEngine> {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec![allowed_host.to_string()],
        excludes: vec![],
    };
    Arc::new(DefaultScopeEngine::new(scope))
}

// -----------------------------------------------------------------------------
// CHECK 1: RFC 9112 / RFC 7230 Framing Parser Authenticity
// -----------------------------------------------------------------------------

#[tokio::test]
async fn test_forensic_framing_head_request_ignores_content_length() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf).await;
                // HEAD response has Content-Length: 999999 but ZERO message body!
                let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 999999\r\nConnection: keep-alive\r\n\r\n";
                let _ = stream.write_all(resp).await;
                tokio::time::sleep(Duration::from_secs(5)).await;
            });
        }
    });

    let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await.unwrap();
    stream.write_all(b"HEAD /huge HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();

    let start = Instant::now();
    let res = read_http_response_framed(&mut stream, Duration::from_secs(2), true)
        .await
        .expect("HEAD response must complete immediately without waiting for 999999 bytes");
    let elapsed = start.elapsed();

    assert!(elapsed < Duration::from_millis(50), "HEAD response took too long: {:?}", elapsed);
    assert!(res.raw_response.starts_with(b"HTTP/1.1 200 OK"));
    assert!(res.is_reusable, "Keep-alive HEAD response must be reusable");
}

#[tokio::test]
async fn test_forensic_framing_zero_body_status_codes() {
    // RFC 9112 §6.3: 1xx, 204, and 304 have no body
    let codes = [204, 304];
    for code in codes {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    let _ = stream.read(&mut buf).await;
                    let resp = format!("HTTP/1.1 {} Status\r\nConnection: keep-alive\r\n\r\n", code);
                    let _ = stream.write_all(resp.as_bytes()).await;
                    tokio::time::sleep(Duration::from_secs(5)).await;
                });
            }
        });

        let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await.unwrap();
        stream.write_all(b"GET /code HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();

        let start = Instant::now();
        let res = read_http_response_framed(&mut stream, Duration::from_secs(2), false)
            .await
            .unwrap();
        let elapsed = start.elapsed();

        assert!(elapsed < Duration::from_millis(50), "Code {} delayed: {:?}", code, elapsed);
        assert!(res.raw_response.starts_with(format!("HTTP/1.1 {}", code).as_bytes()));
        assert!(res.is_reusable);
    }
}

#[tokio::test]
async fn test_forensic_framing_chunked_extensions_and_trailers() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf).await;
                // Chunk with extension (;foo=bar) and trailer header after 0-chunk
                let resp = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n5;foo=bar\r\nCHUNK\r\n0\r\nX-Trailer: verified\r\n\r\n";
                let _ = stream.write_all(resp).await;
                tokio::time::sleep(Duration::from_secs(5)).await;
            });
        }
    });

    let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await.unwrap();
    stream.write_all(b"GET /ext HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();

    let start = Instant::now();
    let res = read_http_response_framed(&mut stream, Duration::from_secs(2), false)
        .await
        .expect("Chunked read with extensions and trailers must parse");
    let elapsed = start.elapsed();

    assert!(elapsed < Duration::from_millis(50));
    assert!(String::from_utf8_lossy(&res.raw_response).contains("CHUNK"));
    assert!(res.is_reusable);
}

#[tokio::test]
async fn test_forensic_framing_connection_close_not_reusable() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf).await;
                let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\nDONE";
                let _ = stream.write_all(resp).await;
                // Peer closes socket
            });
        }
    });

    let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await.unwrap();
    stream.write_all(b"GET /close HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();

    let res = read_http_response_framed(&mut stream, Duration::from_secs(2), false)
        .await
        .unwrap();

    assert!(res.raw_response.ends_with(b"DONE"));
    assert!(!res.is_reusable, "Connection: close must mark transport as NOT reusable");
}

// -----------------------------------------------------------------------------
// CHECK 2: Genuine Connection Pooling Mechanics
// -----------------------------------------------------------------------------

#[tokio::test]
async fn test_forensic_pool_dead_socket_detection_and_reconnect() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let connection_count = Arc::new(AtomicUsize::new(0));
    let cc = connection_count.clone();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            let id = cc.fetch_add(1, Ordering::SeqCst);
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                let n = stream.read(&mut buf).await.unwrap_or(0);
                if n > 0 {
                    let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
                    let _ = stream.write_all(resp).await;
                    if id == 0 {
                        // First connection: abruptly drop socket after first request to simulate remote close
                        drop(stream);
                    } else {
                        // Subsequent connection: keep alive
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                }
            });
        }
    });

    let pool = HttpConnectionPool::default();
    let key = PoolKey::new("127.0.0.1", port, false);

    // Request 1: creates connection #1
    let (mut transport1, is_reused1) = pool.acquire(&key).await.unwrap();
    assert!(!is_reused1);
    transport1.write_all(b"GET /1 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();
    let res1 = read_http_response_framed(&mut transport1, Duration::from_secs(2), false).await.unwrap();
    assert!(res1.is_reusable);
    pool.release(key.clone(), transport1);

    // Wait a brief moment for OS FIN packet to arrive
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Request 2: pool.acquire should detect connection #1 is dead via try_read() == Ok(0)
    // and transparently establish a fresh connection (#2)
    let (mut transport2, is_reused2) = pool.acquire(&key).await.unwrap();
    assert!(!is_reused2, "Dead connection must be discarded, establishing fresh socket");
    transport2.write_all(b"GET /2 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();
    let res2 = read_http_response_framed(&mut transport2, Duration::from_secs(2), false).await.unwrap();
    assert!(res2.raw_response.ends_with(b"OK"));

    let metrics = pool.metrics();
    assert_eq!(metrics.total_created, 2, "Exactly 2 total connections must have been created");
}

#[tokio::test]
async fn test_forensic_pool_idle_timeout_and_reaping() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n").await;
                        tokio::time::sleep(Duration::from_secs(10)).await;
                    }
                }
            });
        }
    });

    let config = PoolConfig {
        max_idle_per_host: 5,
        max_total_idle: 10,
        idle_timeout: Duration::from_millis(40), // short expiration
        connect_timeout: Duration::from_secs(2),
    };
    let pool = HttpConnectionPool::new(config, sentinel_dispatch::pool::default_client_config());
    let key = PoolKey::new("127.0.0.1", port, false);

    let (mut t, _) = pool.acquire(&key).await.unwrap();
    t.write_all(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();
    let _ = read_http_response_framed(&mut t, Duration::from_secs(1), false).await.unwrap();
    pool.release(key.clone(), t);

    assert_eq!(pool.metrics().total_idle, 1);

    // Sleep past idle_timeout
    tokio::time::sleep(Duration::from_millis(70)).await;

    // Reap idle
    let reaped = pool.reap_idle();
    assert_eq!(reaped, 1, "Must reap exactly 1 expired connection");
    assert_eq!(pool.metrics().total_idle, 0, "Idle count must now be 0");
}

#[tokio::test]
async fn test_forensic_pool_capacity_bounds() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stream.read(&mut buf).await {
                    if n == 0 { break; }
                    let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n").await;
                }
            });
        }
    });

    // Config: max_idle_per_host = 2
    let config = PoolConfig {
        max_idle_per_host: 2,
        max_total_idle: 10,
        idle_timeout: Duration::from_secs(30),
        connect_timeout: Duration::from_secs(2),
    };
    let pool = HttpConnectionPool::new(config, sentinel_dispatch::pool::default_client_config());
    let key = PoolKey::new("127.0.0.1", port, false);

    // Acquire 4 distinct connections
    let mut connections = Vec::new();
    for _ in 0..4 {
        let (mut t, _) = pool.acquire(&key).await.unwrap();
        t.write_all(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").await.unwrap();
        let _ = read_http_response_framed(&mut t, Duration::from_secs(1), false).await.unwrap();
        connections.push(t);
    }

    // Release all 4 connections back to pool
    for t in connections {
        pool.release(key.clone(), t);
    }

    // Must be capped at max_idle_per_host = 2
    assert_eq!(pool.metrics().total_idle, 2, "Idle connections must be capped at max_idle_per_host");
}

// -----------------------------------------------------------------------------
// CHECK 3: High Concurrency Thread-Safety
// -----------------------------------------------------------------------------

#[tokio::test]
async fn test_forensic_pool_high_concurrency_stress() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stream.read(&mut buf).await {
                    if n == 0 { break; }
                    let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\n\r\nSUCCESS";
                    if stream.write_all(resp).await.is_err() { break; }
                }
            });
        }
    });

    let pool = Arc::new(HttpConnectionPool::default());
    let key = PoolKey::new("127.0.0.1", port, false);

    let start = Instant::now();
    let mut handles = Vec::with_capacity(50);

    for i in 0..50 {
        let p = pool.clone();
        let k = key.clone();
        handles.push(tokio::spawn(async move {
            for j in 0..5 {
                let (mut transport, _) = p.acquire(&k).await.map_err(|e| format!("Task {}-{}: {}", i, j, e))?;
                let req = format!("GET /stress/{}/{} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n", i, j);
                transport.write_all(req.as_bytes()).await.unwrap();
                let res = read_http_response_framed(&mut transport, Duration::from_secs(2), false).await.unwrap();
                assert!(res.raw_response.ends_with(b"SUCCESS"));
                p.release(k.clone(), transport);
            }
            Ok::<(), String>(())
        }));
    }

    for h in handles {
        h.await.unwrap().unwrap();
    }

    let elapsed = start.elapsed();
    println!("50 concurrent workers x 5 iterations completed in {:?}", elapsed);

    let metrics = pool.metrics();
    assert!(metrics.total_reused > 150, "Significant connection reuse must occur: {}", metrics.total_reused);
}

// -----------------------------------------------------------------------------
// CHECK 4: Security Invariants (SEC-01 Fail-Closed & SEC-06/07 CAS Immutability)
// -----------------------------------------------------------------------------

#[tokio::test]
async fn test_forensic_sec01_scope_fail_closed() {
    let allowed_scope = make_scope("authorized.corp.net");
    let dispatcher = HttpDispatcher::new(allowed_scope);

    // Target is out of scope (unauthorized host)
    let target_url = "http://malicious-internal.corp/secret";
    let req = b"GET /secret HTTP/1.1\r\nHost: malicious-internal.corp\r\n\r\n";

    let result = dispatcher.dispatch(target_url, req, 1).await;
    match result {
        Err(SentinelError::ScopeViolation { reason }) => {
            println!("SEC-01 verified: correctly rejected with ScopeViolation: {}", reason);
        }
        other => {
            panic!("SEC-01 VIOLATION: Expected SentinelError::ScopeViolation, got: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_forensic_sec06_07_cas_immutability() {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("forensic_obs.db");
    let store = Arc::new(SqliteObservationStore::open(db_path).await.unwrap());

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\n\r\nCAS_EVIDENCE";
                        let _ = stream.write_all(resp).await;
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let dispatcher = HttpDispatcher::new(scope).with_storage(store.clone());
    let target_url = format!("http://127.0.0.1:{}/cas_verify", port);
    let req = format!("GET /cas_verify HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n", port);

    let output = dispatcher.dispatch(&target_url, req.as_bytes(), 1).await.unwrap();
    assert!(output.raw_response.ends_with(b"CAS_EVIDENCE"));

    // Check CAS storage for the hashes
    use sha2::{Digest, Sha256};
    let req_hash = hex::encode(Sha256::digest(req.as_bytes()));
    let res_hash = hex::encode(Sha256::digest(&output.raw_response));

    let cas = store.cas();
    assert!(cas.exists(&req_hash).await, "Request must be immutably stored in CAS");
    assert!(cas.exists(&res_hash).await, "Response must be immutably stored in CAS");

    let retrieved_req = cas.get(&req_hash).await.unwrap();
    assert_eq!(retrieved_req, req.as_bytes());

    let retrieved_res = cas.get(&res_hash).await.unwrap();
    assert_eq!(retrieved_res, output.raw_response);
}

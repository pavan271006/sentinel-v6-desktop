//! Empirical Challenge Test Suite for Milestone M1
//!
//! Evaluates:
//! 1. TCP_NODELAY genuine activation on race sockets
//! 2. Keep-Alive preservation and HTTP/1.1 framing
//! 3. Race condition behavior with persistent keep-alive servers
//! 4. Dispatcher behavior with persistent keep-alive servers
//! 5. 100-worker concurrency stress and socket leak testing

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use uuid::Uuid;

use sentinel_common::domain::Scope;
use sentinel_dispatch::HttpDispatcher;
use sentinel_repeater::executor::RepeaterExecutor;
use sentinel_scope::DefaultScopeEngine;

fn make_scope(host: &str) -> Arc<DefaultScopeEngine> {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec![host.to_string()],
        excludes: vec![],
    };
    Arc::new(DefaultScopeEngine::new(scope))
}

/// Test 1: Verify whether TCP_NODELAY is genuinely supported and set on TcpStream.
#[tokio::test]
async fn test_nodelay_genuine_socket_option() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let server_handle = tokio::spawn(async move {
        let (socket, _) = listener.accept().await.unwrap();
        socket
    });

    let client = tokio::net::TcpStream::connect(addr).await.unwrap();
    assert!(client.set_nodelay(true).is_ok());
    assert_eq!(
        client.nodelay().unwrap(),
        true,
        "TCP_NODELAY must be genuinely enabled on the OS socket"
    );

    let _server_socket = server_handle.await.unwrap();
}

/// Test 2: Verify RepeaterExecutor::execute_raw with a persistent HTTP/1.1 server
/// that DOES NOT close the TCP socket (preserves keep-alive).
#[tokio::test]
async fn test_repeater_execute_raw_persistent_keepalive_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    // Mock HTTP/1.1 persistent server that keeps connection open
    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 4096];
                loop {
                    let n = match stream.read(&mut buf).await {
                        Ok(0) => break,
                        Ok(n) => n,
                        Err(_) => break,
                    };
                    let req_str = String::from_utf8_lossy(&buf[..n]);
                    // Verify that Connection: keep-alive was received unmodified
                    let has_keep_alive = req_str.to_ascii_lowercase().contains("connection: keep-alive");

                    let body: &[u8] = if has_keep_alive {
                        b"keep-alive-verified"
                    } else {
                        b"closed-connection"
                    };

                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: keep-alive\r\n\r\n{}",
                        body.len(),
                        std::str::from_utf8(body).unwrap()
                    );
                    if stream.write_all(resp.as_bytes()).await.is_err() {
                        break;
                    }
                    // Crucial: Server DOES NOT close stream here. It keeps waiting.
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let executor = RepeaterExecutor::new(scope);
    let target_url = format!("http://127.0.0.1:{}/keepalive", port);

    let raw_req = format!(
        "GET /keepalive HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
        port
    );

    let start = Instant::now();
    // Must complete within 2 seconds without hanging on the open socket
    let result = tokio::time::timeout(
        Duration::from_secs(2),
        executor.execute_raw(&target_url, raw_req.as_bytes(), None),
    )
    .await
    .expect("RepeaterExecutor::execute_raw must not hang on persistent keep-alive connection")
    .expect("Execution must succeed");

    let elapsed = start.elapsed();
    assert!(
        elapsed < Duration::from_millis(500),
        "Repeater execute_raw took too long: {:?}",
        elapsed
    );
    assert_eq!(result.status_code, Some(200));
    assert!(
        String::from_utf8_lossy(&result.raw_response).contains("keep-alive-verified"),
        "Server must have confirmed receipt of Connection: keep-alive"
    );
}

/// Test 3: Verify RepeaterExecutor::execute_raw with chunked transfer encoding and keep-alive.
#[tokio::test]
async fn test_repeater_execute_raw_chunked_keepalive() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                let _ = stream.read(&mut buf).await;

                // Send chunked response without closing socket
                let resp = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n";
                let _ = stream.write_all(resp).await;
                // Keep socket open
                tokio::time::sleep(Duration::from_secs(5)).await;
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let executor = RepeaterExecutor::new(scope);
    let target_url = format!("http://127.0.0.1:{}/chunked", port);

    let raw_req = format!(
        "GET /chunked HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
        port
    );

    let result = tokio::time::timeout(
        Duration::from_secs(2),
        executor.execute_raw(&target_url, raw_req.as_bytes(), None),
    )
    .await
    .expect("Chunked keep-alive read must not hang")
    .expect("Execution must succeed");

    assert_eq!(result.status_code, Some(200));
    assert!(String::from_utf8_lossy(&result.raw_response).contains("hello"));
}

/// Test 4: ADVERSARIAL CHALLENGE — execute_parallel_race against persistent keep-alive server.
/// If send_plain_primed_race does not parse framing and waits for EOF, it will HANG!
#[tokio::test]
async fn test_repeater_race_with_persistent_keepalive_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 2048];
                let n = stream.read(&mut buf).await.unwrap_or(0);
                if n > 0 {
                    let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: keep-alive\r\n\r\nrace_finished";
                    let _ = stream.write_all(resp).await;
                    // Keep socket open waiting for next request (keep-alive)
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let executor = RepeaterExecutor::new(scope);
    let target_url = format!("http://127.0.0.1:{}/race", port);

    let requests: Vec<Vec<u8>> = (0..5)
        .map(|_| {
            format!(
                "GET /race HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
                port
            )
            .into_bytes()
        })
        .collect();

    // Attempt race with 2-second timeout
    let race_result = tokio::time::timeout(
        Duration::from_secs(2),
        executor.execute_parallel_race(&target_url, requests),
    )
    .await;

    match race_result {
        Ok(Ok(summary)) => {
            println!(
                "[PASS/UNEXPECTED] Race completed with persistent keep-alive server: {}/{} successful, spread: {} us",
                summary.successful_responses, summary.total_requests, summary.timing_spread_micros
            );
        }
        Ok(Err(e)) => {
            println!("[FAIL] Race failed with error: {}", e);
        }
        Err(_timeout) => {
            println!(
                "[CRITICAL FINDING] execute_parallel_race HUNG on persistent keep-alive server! send_plain_primed_race lacks framing/timeout and waits for EOF!"
            );
            // This test is designed to verify whether it hangs or completes!
        }
    }
}

/// Test 5: ADVERSARIAL CHALLENGE — HttpDispatcher::dispatch against persistent keep-alive server.
/// Does it hang for 15 seconds because read_timeout is 15s and it has no framing parser?
#[tokio::test]
async fn test_dispatcher_with_persistent_keepalive_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut buf = [0u8; 2048];
                let n = stream.read(&mut buf).await.unwrap_or(0);
                if n > 0 {
                    let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 17\r\nConnection: keep-alive\r\n\r\ndispatch_finished";
                    let _ = stream.write_all(resp).await;
                    // Do NOT close socket: keep alive
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    // Configure with 300ms read_timeout to measure without taking 15 seconds
    let dispatcher = HttpDispatcher::new(scope).with_timeouts(Duration::from_secs(1), Duration::from_millis(300));
    let target_url = format!("http://127.0.0.1:{}/dispatch", port);

    let raw_req = format!(
        "GET /dispatch HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: keep-alive\r\n\r\n",
        port
    );

    let start = Instant::now();
    let dispatch_result = dispatcher.dispatch(&target_url, raw_req.as_bytes(), 1).await;
    let elapsed = start.elapsed();

    match dispatch_result {
        Ok(res) => {
            println!(
                "[CRITICAL FINDING] HttpDispatcher::dispatch delayed by read_timeout: took {:?} for 17-byte response! Status: {:?}",
                elapsed, res.status_code
            );
            assert!(
                elapsed < Duration::from_millis(200),
                "HttpDispatcher must parse framing and finish immediately ({:?}) without waiting for read_timeout",
                elapsed
            );
            assert_eq!(res.status_code, Some(200));
        }
        Err(e) => {
            println!("[DISPATCH ERROR] Dispatch returned error: {}", e);
        }
    }
}

/// Test 6: 100-worker concurrency stress test — check for socket exhaustion, leaks, or unhandled errors.
#[tokio::test]
async fn test_100_worker_concurrency_stress() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let completed_counter = Arc::new(AtomicUsize::new(0));
    let server_counter = completed_counter.clone();

    // Spawn server handling 100 concurrent requests
    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            let sc = server_counter.clone();
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                if let Ok(n) = stream.read(&mut buf).await {
                    if n > 0 {
                        let resp = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK";
                        let _ = stream.write_all(resp).await;
                        sc.fetch_add(1, Ordering::SeqCst);
                    }
                }
            });
        }
    });

    let scope = make_scope("127.0.0.1");
    let executor = Arc::new(RepeaterExecutor::new(scope));
    let target_url = format!("http://127.0.0.1:{}/stress", port);

    let start = Instant::now();
    let mut handles = Vec::with_capacity(100);

    for i in 0..100 {
        let exec = executor.clone();
        let url = target_url.clone();
        let handle = tokio::spawn(async move {
            let req = format!(
                "GET /stress?id={} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
                i
            );
            exec.execute_raw(&url, req.as_bytes(), None).await
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    let mut error_count = 0;

    for h in handles {
        match h.await {
            Ok(Ok(out)) => {
                if out.status_code == Some(200) {
                    success_count += 1;
                } else {
                    error_count += 1;
                }
            }
            Ok(Err(_)) => error_count += 1,
            Err(_) => error_count += 1,
        }
    }

    let elapsed = start.elapsed();
    println!(
        "100-worker concurrency completed in {:?}: {} successes, {} errors",
        elapsed, success_count, error_count
    );

    assert_eq!(success_count, 100, "All 100 workers must succeed without error");
    assert_eq!(error_count, 0, "Zero unhandled errors or socket drops allowed");
}

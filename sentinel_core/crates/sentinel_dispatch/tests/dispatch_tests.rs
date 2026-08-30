use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

use sentinel_common::domain::Scope;
use sentinel_dispatch::{DispatchBudget, HttpDispatcher};
use sentinel_scope::DefaultScopeEngine;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

fn make_scope(include: &str) -> DefaultScopeEngine {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![include.to_string()],
        excludes: vec![],
    };
    DefaultScopeEngine::new(scope)
}

#[tokio::test]
async fn test_dispatch_scope_fail_closed_sec01() {
    let scope = make_scope("allowed.target.local");
    let dispatcher = HttpDispatcher::new(Arc::new(scope));

    let raw_req = b"GET / HTTP/1.1\r\nHost: evil-attacker.com\r\n\r\n";
    let res = dispatcher.dispatch("http://evil-attacker.com/", raw_req, 1).await;

    assert!(res.is_err());
    let err = res.err().unwrap();
    assert!(err.to_string().contains("out of scope"));
}

#[tokio::test]
async fn test_dispatch_budget_exhaustion() {
    let scope = make_scope("127.0.0.1");
    let budget = Arc::new(DispatchBudget::new(2, 100)); // max 2 requests
    let _dispatcher = HttpDispatcher::new(Arc::new(scope)).with_budget(budget.clone());

    // Request 1 consume
    assert!(budget.consume(10).is_ok());
    assert_eq!(budget.requests_dispatched(), 1);

    // Request 2 consume
    assert!(budget.consume(10).is_ok());
    assert_eq!(budget.requests_dispatched(), 2);

    // Request 3 should fail
    let err = budget.consume(10);
    assert!(err.is_err());
    assert!(err.unwrap_err().to_string().contains("budget exceeded"));
}

#[tokio::test]
async fn test_dispatch_plain_http_and_cas_hashing() {
    // 1. Start a local mock HTTP server
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buf = [0u8; 1024];
        let n = socket.read(&mut buf).await.unwrap();
        assert!(n > 0);

        let response = b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 14\r\n\r\nHello Sentinel";
        socket.write_all(response).await.unwrap();
    });

    let scope = make_scope("127.0.0.1");
    let dispatcher = HttpDispatcher::new(Arc::new(scope));
    let target_url = format!("http://127.0.0.1:{}/test", port);

    let raw_req = format!("GET /test HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n", port);
    let result = dispatcher
        .dispatch(&target_url, raw_req.as_bytes(), 5)
        .await
        .expect("Dispatch succeeds");

    assert_eq!(result.status_code, Some(200));
    assert!(result.raw_response.starts_with(b"HTTP/1.1 200 OK"));
    assert!(!result.request_cas_hash.is_empty());
    assert!(!result.response_cas_hash.is_empty());
    assert!(result.parsed_response.is_some());
    assert_eq!(result.parsed_response.unwrap().body, b"Hello Sentinel");
}

#[tokio::test]
async fn test_dispatch_batch_concurrency() {
    // Start local server that answers multiple requests
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        for _ in 0..5 {
            if let Ok((mut socket, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    let _ = socket.read(&mut buf).await;
                    let response = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
                    let _ = socket.write_all(response).await;
                });
            }
        }
    });

    let scope = make_scope("127.0.0.1");
    let dispatcher = Arc::new(HttpDispatcher::new(Arc::new(scope)));
    let target_url = format!("http://127.0.0.1:{}/api", port);

    let req_bytes = format!("GET /api HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n", port).into_bytes();
    let requests = vec![
        (target_url.clone(), req_bytes.clone(), 1),
        (target_url.clone(), req_bytes.clone(), 1),
        (target_url.clone(), req_bytes.clone(), 1),
    ];

    let results = dispatcher.dispatch_batch(requests, 2).await;
    assert_eq!(results.len(), 3);
    for res in results {
        assert!(res.is_ok());
        assert_eq!(res.unwrap().status_code, Some(200));
    }
}

//! Test Suite for Repeater Subsystem

use std::sync::Arc;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use uuid::Uuid;

use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::domain::Scope;
use sentinel_common::events::CriticalEvent;
use sentinel_common::traits::EventBus;
use sentinel_repeater::diff::{DiffKind, ResponseDiff};
use sentinel_repeater::executor::RepeaterExecutor;
use sentinel_repeater::manager::RepeaterManager;
use sentinel_repeater::variables::VariableEnvironment;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

async fn spawn_mock_target() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        loop {
            if let Ok((mut stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    let n = stream.read(&mut buf).await.unwrap_or(0);
                    if n > 0 {
                        let req_str = String::from_utf8_lossy(&buf[..n]);
                        let body = if req_str.contains("user_id=2") {
                            "{\"user\": \"alice\", \"role\": \"admin\"}"
                        } else {
                            "{\"user\": \"guest\", \"role\": \"user\"}"
                        };

                        let resp = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        let _ = stream.write_all(resp.as_bytes()).await;
                    }
                });
            }
        }
    });

    format!("http://{}", addr)
}

#[test]
fn test_variable_interpolation_and_extraction() {
    let mut env = VariableEnvironment::new();
    env.set("auth_token", "secret_jwt_token_999");
    env.set("target_host", "api.target.com");

    let template = b"GET /api/v1/profile HTTP/1.1\r\nHost: {{target_host}}\r\nAuthorization: Bearer {{auth_token}}\r\nX-Req-Id: {{$uuid}}\r\n\r\n";
    let interpolated = env.interpolate(template);
    let interpolated_str = String::from_utf8_lossy(&interpolated);

    assert!(interpolated_str.contains("Host: api.target.com"));
    assert!(interpolated_str.contains("Authorization: Bearer secret_jwt_token_999"));
    assert!(!interpolated_str.contains("{{$uuid}}")); // dynamic uuid replaced

    // JSON extraction
    let json_resp = b"{\"auth\": {\"access_token\": \"extracted_jwt_val\", \"expires\": 3600}}";
    assert!(env.extract_from_json("extracted_token", json_resp, "auth.access_token"));
    assert_eq!(env.get("extracted_token").unwrap(), "extracted_jwt_val");
}

#[test]
fn test_response_diffing_lines() {
    let body_a = "line 1\nline 2 unchanged\nline 3 original\nline 4";
    let body_b = "line 1\nline 2 unchanged\nline 3 modified\nline 4\nline 5 added";

    let diffs = ResponseDiff::diff_text(body_a, body_b);
    assert!(diffs
        .iter()
        .any(|d| d.kind == DiffKind::Unchanged && d.content == "line 2 unchanged"));
    assert!(diffs
        .iter()
        .any(|d| d.kind == DiffKind::Added && d.content == "line 5 added"));
    assert!(diffs
        .iter()
        .any(|d| d.kind == DiffKind::Removed && d.content == "line 3 original"));
}

#[tokio::test]
async fn test_repeater_tab_lifecycle_and_execution() {
    let mock_url = spawn_mock_target().await;

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec!["127.0.0.1".to_string()],
        excludes: vec![],
    };
    let scope_engine = Arc::new(DefaultScopeEngine::new(scope));
    let bus = Arc::new(ChannelEventBus::new(EventBusConfig::default()));

    let temp = tempdir().unwrap();
    let storage = Arc::new(SqliteObservationStore::open(temp.path()).await.unwrap());

    let executor = Arc::new(
        RepeaterExecutor::new(scope_engine)
            .with_event_bus(bus.clone())
            .with_storage(storage.clone()),
    );

    let manager = RepeaterManager::new(executor);

    let initial_req = b"GET /api/user?user_id=1 HTTP/1.1\r\nHost: localhost\r\n\r\n".to_vec();
    let tab_id = manager.create_tab("User Profile Test", &mock_url, initial_req);

    // 1. Execute initial revision
    let output1 = manager.execute_tab(tab_id).await.unwrap();
    assert_eq!(output1.status_code, Some(200));
    assert!(String::from_utf8_lossy(&output1.raw_response).contains("guest"));

    // 2. Modify request to user_id=2 and execute revision 2
    let modified_req = b"GET /api/user?user_id=2 HTTP/1.1\r\nHost: localhost\r\n\r\n".to_vec();
    manager.update_tab_request(tab_id, modified_req).unwrap();
    let output2 = manager.execute_tab(tab_id).await.unwrap();
    assert_eq!(output2.status_code, Some(200));
    assert!(String::from_utf8_lossy(&output2.raw_response).contains("alice"));

    // 3. Diff revisions 0 and 1
    let diff = manager.diff_revisions(tab_id, 0, 1).unwrap();
    assert!(diff.has_divergence);
    assert_eq!(diff.status_delta, Some((200, 200)));

    let tab = manager.get_tab(tab_id).unwrap();
    assert_eq!(tab.history.len(), 2);
}

#[tokio::test]
async fn test_repeater_sec01_out_of_scope_enforcement() {
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec!["api.target.com".to_string()],
        excludes: vec![],
    };
    let scope_engine = Arc::new(DefaultScopeEngine::new(scope));
    let bus = Arc::new(ChannelEventBus::new(EventBusConfig::default()));
    let mut crit_rx = bus.subscribe_critical();

    let executor = RepeaterExecutor::new(scope_engine).with_event_bus(bus.clone());

    let out_of_scope_url = "http://unauthorized.evil.com/admin";
    let req = b"GET /admin HTTP/1.1\r\nHost: unauthorized.evil.com\r\n\r\n";

    let res = executor.execute_raw(out_of_scope_url, req, None).await;
    assert!(
        res.is_err(),
        "SEC-01: Out-of-scope Repeater send must fail closed"
    );

    // Critical audit event must be published
    let event = crit_rx.recv().await.unwrap();
    if let CriticalEvent::ScopeViolationAttempt { source, target, .. } = event {
        assert_eq!(source, "RepeaterEngine");
        assert_eq!(target, out_of_scope_url);
    } else {
        panic!("Expected ScopeViolationAttempt critical event");
    }
}

#[tokio::test]
async fn test_repeater_execute_parallel_race() {
    let mock_url = spawn_mock_target().await;

    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec!["127.0.0.1".to_string()],
        excludes: vec![],
    };
    let scope_engine = Arc::new(DefaultScopeEngine::new(scope));
    let executor = RepeaterExecutor::new(scope_engine);

    // Prepare 10 concurrent racing requests
    let requests: Vec<Vec<u8>> = (0..10)
        .map(|i| {
            format!(
                "GET /api/user?user_id={} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
                i % 2 + 1
            )
            .into_bytes()
        })
        .collect();

    let race_summary = executor
        .execute_parallel_race(&mock_url, requests)
        .await
        .expect("Race execution must succeed");

    assert_eq!(race_summary.total_requests, 10);
    assert_eq!(race_summary.successful_responses, 10);
    assert_eq!(race_summary.outputs.len(), 10);

    for output in &race_summary.outputs {
        assert_eq!(output.status_code, Some(200));
    }
}

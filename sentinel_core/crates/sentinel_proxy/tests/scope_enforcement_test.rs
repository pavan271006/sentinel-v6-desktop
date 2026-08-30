//! SEC-01 Scope Enforcement & Critical Violation Telemetry Integration Tests

mod common;

use chrono::Utc;
use parking_lot::RwLock;
use std::net::TcpListener;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use uuid::Uuid;

use common::mock_server::MockHttpServer;
use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::config::ProxyConfig;
use sentinel_common::domain::Scope;
use sentinel_common::events::CriticalEvent;
use sentinel_common::traits::{EventBus, ProxyEngine};
use sentinel_proxy::SentinelProxyEngine;
use sentinel_scope::DefaultScopeEngine;

fn get_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

#[tokio::test]
async fn test_sec_01_scope_enforcement_and_violation_telemetry() {
    let tmp_dir = tempdir().unwrap();
    let ca_path = tmp_dir.path().join("ca.crt");

    let mock_server = MockHttpServer::spawn_echo().await;
    let proxy_port = get_free_port();

    // 1. Initialize EventBus
    let event_bus = Arc::new(ChannelEventBus::new(EventBusConfig {
        telemetry_capacity: 1000,
        critical_capacity: 1000,
    }));
    let mut critical_rx = event_bus.subscribe_critical();

    // 2. Initialize ScopeEngine with ONLY 127.0.0.1 and allowed.target.corp in scope
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: Utc::now(),
        includes: vec![
            "127.0.0.1".to_string(),
            "allowed.target.corp".to_string(),
            "127.0.0.1/32".to_string(),
        ],
        excludes: vec!["blocked.target.corp".to_string()],
    };

    let scope_engine = Arc::new(RwLock::new(DefaultScopeEngine::new(scope)));

    // 3. Start ProxyEngine with ScopeEngine and EventBus attached
    let proxy_config = ProxyConfig {
        bind_address: "127.0.0.1".to_string(),
        port: proxy_port,
        upstream_proxy: None,
        tls_cert_path: ca_path.to_str().unwrap().to_string(),
    };

    let proxy = SentinelProxyEngine::new()
        .with_scope_engine(scope_engine)
        .with_event_bus(event_bus.clone());

    proxy.start(proxy_config).await.expect("Proxy should start");
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // 4. Test In-Scope Request (127.0.0.1 is in scope)
    let mut client_allowed = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();
    let allowed_req = format!(
        "GET http://{}/test HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        mock_server.addr, mock_server.addr
    );
    client_allowed
        .write_all(allowed_req.as_bytes())
        .await
        .unwrap();
    let mut res_buf = vec![0u8; 1024];
    let n = client_allowed.read(&mut res_buf).await.unwrap();
    let res_text = String::from_utf8_lossy(&res_buf[..n]);
    assert!(
        res_text.contains("200 OK"),
        "In-scope request should succeed"
    );

    // 5. Test Out-of-Scope Request (blocked.target.corp)
    let mut client_blocked = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();
    let blocked_req = "GET http://blocked.target.corp/forbidden HTTP/1.1\r\nHost: blocked.target.corp\r\nConnection: close\r\n\r\n";
    client_blocked
        .write_all(blocked_req.as_bytes())
        .await
        .unwrap();

    let mut blocked_res_buf = vec![0u8; 1024];
    let n_blocked = client_blocked.read(&mut blocked_res_buf).await.unwrap();
    let blocked_res_text = String::from_utf8_lossy(&blocked_res_buf[..n_blocked]);
    assert!(
        blocked_res_text.contains("403 Forbidden"),
        "Out-of-scope request must return 403 Forbidden"
    );

    // 6. Verify CriticalEvent::ScopeViolationAttempt received on durable bus
    let received_critical =
        tokio::time::timeout(tokio::time::Duration::from_millis(500), critical_rx.recv())
            .await
            .expect("Critical violation event must be received within timeout")
            .expect("Channel should not close");

    match received_critical {
        CriticalEvent::ScopeViolationAttempt {
            target, decision, ..
        } => {
            assert!(target.contains("blocked.target.corp"));
            assert!(!decision.allowed);
        }
        _ => panic!("Expected ScopeViolationAttempt event"),
    }

    mock_server.stop();
    proxy.stop().await.unwrap();
}

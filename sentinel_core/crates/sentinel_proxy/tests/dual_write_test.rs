//! Dual-Write Persistence (CAS + SQLite) & Telemetry Verification Tests

mod common;

use std::net::TcpListener;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use common::mock_server::MockHttpServer;
use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::config::ProxyConfig;
use sentinel_common::events::SentinelEvent;
use sentinel_common::traits::{EventBus, ProxyEngine};
use sentinel_proxy::SentinelProxyEngine;
use sentinel_storage::SqliteObservationStore;

fn get_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

#[tokio::test]
async fn test_dual_write_cas_sqlite_and_eventbus_telemetry() {
    let tmp_dir = tempdir().unwrap();
    let project_dir = tmp_dir.path().join("test_project");
    let ca_path = tmp_dir.path().join("ca.crt");

    // 1. Initialize Storage & EventBus
    let storage = SqliteObservationStore::open(&project_dir)
        .await
        .expect("ObservationStore should open");
    let event_bus = Arc::new(ChannelEventBus::new(EventBusConfig {
        telemetry_capacity: 1000,
        critical_capacity: 1000,
    }));
    let mut telemetry_rx = event_bus.subscribe_telemetry();

    let mock_server = MockHttpServer::spawn_echo().await;
    let proxy_port = get_free_port();

    let proxy_config = ProxyConfig {
        bind_address: "127.0.0.1".to_string(),
        port: proxy_port,
        upstream_proxy: None,
        tls_cert_path: ca_path.to_str().unwrap().to_string(),
    };

    let proxy = SentinelProxyEngine::new()
        .with_storage(storage.clone())
        .with_event_bus(event_bus.clone());

    proxy.start(proxy_config).await.expect("Proxy should start");
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // 2. Send transaction through proxy
    let mut client = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();
    let req = format!(
        "GET http://{}/api/data HTTP/1.1\r\nHost: {}\r\nUser-Agent: sentinel-agent\r\nConnection: close\r\n\r\n",
        mock_server.addr, mock_server.addr
    );
    client.write_all(req.as_bytes()).await.unwrap();

    let mut res_buf = vec![0u8; 1024];
    let _ = client.read(&mut res_buf).await.unwrap();

    // 3. Verify EventBus emitted ObservationCreated event
    let tx_id = loop {
        let event = tokio::time::timeout(tokio::time::Duration::from_secs(2), telemetry_rx.recv())
            .await
            .expect("Telemetry event must be received within 2s")
            .expect("Telemetry channel must have an event");

        if let SentinelEvent::ObservationCreated(id) = event {
            break id;
        }
    };

    // Allow persistence worker a brief moment to finish SQLite writes
    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

    // 4. Verify Transaction exists in SQLite Repository
    let tx_opt = storage
        .transactions()
        .get(tx_id)
        .await
        .expect("Query transaction should succeed");
    assert!(
        tx_opt.is_some(),
        "Persisted Transaction must exist in SQLite database"
    );
    let tx = tx_opt.unwrap();
    assert_eq!(
        tx.request.parsed.uri,
        format!("http://{}/api/data", mock_server.addr)
    );

    // 5. Verify CAS Blob Storage contains raw request bytes (SEC-07 & SEC-10)
    let raw_req_hash = sentinel_storage::BlobStorage::compute_sha256(req.as_bytes());
    let raw_req_bytes = storage
        .cas()
        .get_verified(&raw_req_hash)
        .await
        .expect("Raw request must be stored intact in CAS with SHA-256 integrity");
    assert_eq!(
        raw_req_bytes,
        req.as_bytes(),
        "CAS bytes must match original on-the-wire request bytes"
    );

    proxy.stop().await.expect("Proxy should stop cleanly");
    mock_server.stop();
}

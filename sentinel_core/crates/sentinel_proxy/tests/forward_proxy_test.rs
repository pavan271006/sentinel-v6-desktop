//! Integration tests for Plain HTTP Forward Proxying

mod common;

use std::net::TcpListener;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use common::mock_server::MockHttpServer;
use sentinel_common::config::ProxyConfig;
use sentinel_common::traits::ProxyEngine;
use sentinel_proxy::SentinelProxyEngine;

fn get_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

#[tokio::test]
async fn test_plain_http_forward_proxy() {
    let tmp_dir = tempdir().unwrap();
    let ca_path = tmp_dir.path().join("ca.crt");

    let mock_server = MockHttpServer::spawn_echo().await;
    let proxy_port = get_free_port();

    let proxy_config = ProxyConfig {
        bind_address: "127.0.0.1".to_string(),
        port: proxy_port,
        upstream_proxy: None,
        tls_cert_path: ca_path.to_str().unwrap().to_string(),
    };

    let proxy = SentinelProxyEngine::new();
    proxy.start(proxy_config).await.expect("Proxy should start");

    // Wait a moment for listener to bind
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // Connect client to proxy
    let mut client = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .expect("Client should connect to proxy");

    let req = format!(
        "GET http://{}/api/echo HTTP/1.1\r\nHost: {}\r\nUser-Agent: test-client\r\nConnection: close\r\n\r\n",
        mock_server.addr, mock_server.addr
    );

    client.write_all(req.as_bytes()).await.unwrap();

    let mut res_buf = vec![0u8; 4096];
    let n = client.read(&mut res_buf).await.unwrap();
    res_buf.truncate(n);

    let res_str = String::from_utf8_lossy(&res_buf);
    assert!(
        res_str.starts_with("HTTP/1.1 200 OK"),
        "Expected 200 OK, got: {}",
        res_str
    );
    assert!(res_str.contains("{\"status\":\"mock_ok\",\"service\":\"echo\"}"));

    proxy.stop().await.expect("Proxy should stop cleanly");
    mock_server.stop();
}

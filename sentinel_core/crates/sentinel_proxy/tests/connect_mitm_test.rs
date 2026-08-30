//! HTTPS CONNECT MITM & Dynamic TLS Certificate Forging Integration Tests

mod common;

use rustls::pki_types::{CertificateDer, ServerName};
use rustls::{ClientConfig, RootCertStore};
use std::net::TcpListener;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

use common::mock_server::MockTlsServer;
use sentinel_common::config::ProxyConfig;
use sentinel_common::traits::ProxyEngine;
use sentinel_proxy::SentinelProxyEngine;

fn get_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

#[tokio::test]
async fn test_https_connect_mitm_and_dynamic_cert_forging() {
    let tmp_dir = tempdir().unwrap();
    let ca_path = tmp_dir.path().join("ca.crt");
    let ca_key_path = tmp_dir.path().join("ca.key");

    let mock_tls_server = MockTlsServer::spawn().await;
    let proxy_port = get_free_port();

    let proxy_config = ProxyConfig {
        bind_address: "127.0.0.1".to_string(),
        port: proxy_port,
        upstream_proxy: None,
        tls_cert_path: ca_path.to_str().unwrap().to_string(),
    };

    let proxy = SentinelProxyEngine::new();
    let _ca_pem = proxy
        .get_or_create_ca_pem(&ca_path, &ca_key_path)
        .expect("Root CA should be created");

    proxy.start(proxy_config).await.expect("Proxy should start");
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // 1. Client connects to Proxy
    let mut client = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();

    // 2. Client issues CONNECT tunnel request to Mock TLS Server
    let connect_req = format!(
        "CONNECT 127.0.0.1:{} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n",
        mock_tls_server.addr.port(),
        mock_tls_server.addr.port()
    );
    client.write_all(connect_req.as_bytes()).await.unwrap();

    let mut connect_res = vec![0u8; 1024];
    let n = client.read(&mut connect_res).await.unwrap();
    let res_str = String::from_utf8_lossy(&connect_res[..n]);
    assert!(
        res_str.starts_with("HTTP/1.1 200 Connection Established"),
        "Proxy must establish CONNECT tunnel"
    );

    // 3. Configure Client to trust Sentinel Root CA
    let mut root_store = RootCertStore::empty();
    let ca_der = proxy
        .get_root_ca_der()
        .expect("Root CA DER must be available");
    root_store.add(CertificateDer::from(ca_der)).unwrap();

    let client_config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    let connector = TlsConnector::from(Arc::new(client_config));
    let server_name = ServerName::try_from("127.0.0.1".to_string()).unwrap();

    // 4. Initiate Client-Side TLS Handshake through the tunnel with the Proxy
    let mut tls_client = connector
        .connect(server_name, client)
        .await
        .expect("Client TLS handshake with Proxy must succeed (verified with Root CA)");

    // 5. Send decrypted HTTPS request to upstream server
    let secure_req = b"GET /secure/vault HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    tls_client.write_all(secure_req).await.unwrap();

    let mut secure_res = vec![0u8; 4096];
    let n_res = tls_client.read(&mut secure_res).await.unwrap();
    let res_body = String::from_utf8_lossy(&secure_res[..n_res]);

    assert!(
        res_body.starts_with("HTTP/1.1 200 OK"),
        "HTTPS request through MITM proxy must return 200 OK"
    );
    assert!(res_body.contains("{\"secure\":true,\"vault\":\"unlocked\"}"));

    proxy.stop().await.expect("Proxy should stop cleanly");
    mock_tls_server.stop();
}

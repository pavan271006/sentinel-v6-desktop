//! Integration tests for Interceptor Pipeline and Rule Engine

mod common;

use async_trait::async_trait;
use std::net::TcpListener;
use std::sync::Arc;
use tempfile::tempdir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use uuid::Uuid;

use common::mock_server::MockHttpServer;
use sentinel_common::config::ProxyConfig;
use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{InterceptRule, ParsedRequest, ParsedResponse};
use sentinel_common::traits::ProxyEngine;
use sentinel_proxy::pipeline::interceptor::{
    AsyncProxyInterceptor, InterceptAction, RequestContext,
};
use sentinel_proxy::SentinelProxyEngine;

fn get_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

/// Custom test interceptor injecting headers
struct TestHeaderInjector;

#[async_trait]
impl AsyncProxyInterceptor for TestHeaderInjector {
    async fn on_request(
        &self,
        req: &mut ParsedRequest,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        req.headers
            .push((b"X-Injected-Req".to_vec(), b"active-v6".to_vec()));
        Ok(InterceptAction::Modified)
    }

    async fn on_response(
        &self,
        _req: &ParsedRequest,
        res: &mut ParsedResponse,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        res.headers
            .push((b"X-Injected-Res".to_vec(), b"pass-through".to_vec()));
        Ok(InterceptAction::Modified)
    }
}

/// Custom test interceptor dropping specific endpoints
struct TestDropper;

#[async_trait]
impl AsyncProxyInterceptor for TestDropper {
    async fn on_request(
        &self,
        req: &mut ParsedRequest,
        _ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        if req.uri.contains("/drop-me") {
            return Ok(InterceptAction::Drop {
                reason: "Blocked by TestDropper".to_string(),
            });
        }
        Ok(InterceptAction::Continue)
    }
}

#[tokio::test]
async fn test_interceptor_pipeline_modifications_and_drop() {
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
    proxy.register_async_interceptor(Arc::new(TestHeaderInjector));
    proxy.register_async_interceptor(Arc::new(TestDropper));

    proxy.start(proxy_config).await.expect("Proxy should start");
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // 1. Test header injection
    let mut client = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();
    let req = format!(
        "GET http://{}/test HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        mock_server.addr, mock_server.addr
    );
    client.write_all(req.as_bytes()).await.unwrap();

    let mut res_buf = vec![0u8; 4096];
    let n = client.read(&mut res_buf).await.unwrap();
    let res_str = String::from_utf8_lossy(&res_buf[..n]);

    assert!(res_str.starts_with("HTTP/1.1 200 OK"));
    assert!(res_str.contains("X-Injected-Res: pass-through"));

    // 2. Test drop interceptor
    let mut client_drop = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();
    let drop_req = format!(
        "GET http://{}/drop-me HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        mock_server.addr, mock_server.addr
    );
    client_drop.write_all(drop_req.as_bytes()).await.unwrap();

    let mut drop_buf = vec![0u8; 1024];
    let n_drop = client_drop.read(&mut drop_buf).await.unwrap();
    assert_eq!(
        n_drop, 0,
        "Dropped request must result in immediate connection termination"
    );

    proxy.stop().await.expect("Proxy should stop cleanly");
    mock_server.stop();
}

#[tokio::test]
async fn test_dynamic_intercept_rules_evaluation() {
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

    let mut proxy = SentinelProxyEngine::new();

    // Set dynamic rules
    let rules = vec![
        InterceptRule {
            id: Uuid::new_v4(),
            match_condition: "url contains /teapot".to_string(),
            action: "respond_with".to_string(),
            action_data_json: Some(
                serde_json::json!({
                    "status": 418,
                    "body": "I'm a sentinel teapot"
                })
                .to_string(),
            ),
            is_active: true,
        },
        InterceptRule {
            id: Uuid::new_v4(),
            match_condition: "url contains /blocked".to_string(),
            action: "drop".to_string(),
            action_data_json: Some("Blocked URL".to_string()),
            is_active: true,
        },
    ];

    proxy.set_intercept_rules(rules).unwrap();
    proxy.start(proxy_config).await.unwrap();
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // 1. Test synthetic response rule (418)
    let mut client = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();
    let teapot_req = format!(
        "GET http://{}/teapot HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        mock_server.addr, mock_server.addr
    );
    client.write_all(teapot_req.as_bytes()).await.unwrap();

    let mut res_buf = vec![0u8; 1024];
    let n = client.read(&mut res_buf).await.unwrap();
    let res_str = String::from_utf8_lossy(&res_buf[..n]);

    assert!(
        res_str.contains("418"),
        "Expected HTTP 418 synthetic response"
    );
    assert!(res_str.contains("I'm a sentinel teapot"));

    proxy.stop().await.unwrap();
    mock_server.stop();
}

#[tokio::test]
async fn test_match_and_replace_request_and_response_rules() {
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

    let mut proxy = SentinelProxyEngine::new();

    // Configure Match & Replace rules for Request (User-Agent swap, body param replace)
    // and Response (header injection, body regex sanitization)
    let rules = vec![
        InterceptRule {
            id: Uuid::new_v4(),
            match_condition: "url contains /echo".to_string(),
            action: "regex_replace_header".to_string(),
            action_data_json: Some(
                serde_json::json!({
                    "name": "User-Agent",
                    "pattern": "curl/.*",
                    "replacement": "Sentinel-SecScanner/6.1"
                })
                .to_string(),
            ),
            is_active: true,
        },
        InterceptRule {
            id: Uuid::new_v4(),
            match_condition: "body contains secret_token=OLD".to_string(),
            action: "regex_replace_body".to_string(),
            action_data_json: Some(
                serde_json::json!({
                    "pattern": "secret_token=OLD",
                    "replacement": "secret_token=NEW_INJECTED_61"
                })
                .to_string(),
            ),
            is_active: true,
        },
        InterceptRule {
            id: Uuid::new_v4(),
            match_condition: "response.status == 200".to_string(),
            action: "replace_header".to_string(),
            action_data_json: Some(
                serde_json::json!({
                    "name": "X-Sentinel-M-and-R",
                    "value": "Applied-V6.1"
                })
                .to_string(),
            ),
            is_active: true,
        },
        InterceptRule {
            id: Uuid::new_v4(),
            match_condition: "response.body contains mock_ok".to_string(),
            action: "regex_replace_body".to_string(),
            action_data_json: Some(
                serde_json::json!({
                    "pattern": "mock_ok",
                    "replacement": "SANITIZED_PROVEN_61"
                })
                .to_string(),
            ),
            is_active: true,
        },
    ];

    proxy.set_intercept_rules(rules).unwrap();
    proxy.start(proxy_config).await.unwrap();
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    let mut client = TcpStream::connect(format!("127.0.0.1:{}", proxy_port))
        .await
        .unwrap();

    let body = "action=authenticate&secret_token=OLD&user=admin";
    let req = format!(
        "POST http://{}/echo HTTP/1.1\r\nHost: {}\r\nUser-Agent: curl/7.68.0\r\nContent-Length: {}\r\nContent-Type: application/x-www-form-urlencoded\r\nConnection: close\r\n\r\n{}",
        mock_server.addr,
        mock_server.addr,
        body.len(),
        body
    );

    client.write_all(req.as_bytes()).await.unwrap();

    let mut res_buf = vec![0u8; 4096];
    let n = client.read(&mut res_buf).await.unwrap();
    let res_str = String::from_utf8_lossy(&res_buf[..n]);

    assert!(
        res_str.contains("HTTP/1.1 200 OK"),
        "Response should be 200 OK"
    );
    assert!(
        res_str.contains("X-Sentinel-M-and-R: Applied-V6.1"),
        "Response header should have been injected by Match & Replace"
    );
    assert!(
        res_str.contains("SANITIZED_PROVEN_61"),
        "Response body should have been mutated by Response Match & Replace"
    );

    proxy.stop().await.unwrap();
    mock_server.stop();
}

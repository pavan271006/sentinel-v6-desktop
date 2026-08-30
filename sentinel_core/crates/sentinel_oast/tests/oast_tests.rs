//! Test Suite for Out-of-Band OAST Subsystem

use sentinel_common::traits::OastServer;
use sentinel_oast::{DefaultOastServer, OastTokenGenerator};

#[test]
fn test_oast_token_generator() {
    let (token1, id1) = OastTokenGenerator::generate();
    let (token2, id2) = OastTokenGenerator::generate();

    assert!(token1.starts_with("oast_"));
    assert_ne!(token1, token2);
    assert_ne!(id1, id2);
}

#[tokio::test]
async fn test_oast_server_lifecycle_and_callback_recording() {
    let server = DefaultOastServer::new();
    server.start().await.unwrap();

    // 1. Generate token
    let token = server.generate_token().await.unwrap();

    // 2. Poll initial (empty)
    let initial = server.poll_interactions(&token).await.unwrap();
    assert!(initial.is_empty());

    // 3. Record interaction callback
    let raw_http = b"GET /callback HTTP/1.1\r\nHost: oast.target.local\r\n\r\n";
    let interaction_id = server
        .record_interaction(&token, "HTTP", "192.168.1.100", raw_http)
        .await
        .unwrap();

    // 4. Poll after callback
    let polled = server.poll_interactions(&token).await.unwrap();
    assert_eq!(polled.len(), 1);
    assert_eq!(polled[0].id, interaction_id);
    assert_eq!(polled[0].protocol, "HTTP");
    assert_eq!(polled[0].source_ip, "192.168.1.100");

    server.stop().await.unwrap();
}

#[test]
fn test_stateless_oast_token_encryption_and_tamper_rejection() {
    use sentinel_oast::{OastTokenManager, OastTokenPayload};
    use uuid::Uuid;

    let manager = OastTokenManager::from_seed("super_secret_master_key_12345");
    let project_id = Uuid::new_v4();
    let endpoint_id = Uuid::new_v4();

    let payload = OastTokenPayload {
        project_id,
        scan_id: None,
        endpoint_id: Some(endpoint_id),
        param_name: Some("redirect_uri".to_string()),
        created_at: chrono::Utc::now().timestamp(),
        nonce: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc],
    };

    // 1. Generate encrypted token
    let token_str = manager.generate_token(&payload).unwrap();
    assert!(token_str.starts_with("oast_"));

    // 2. Decrypt statelessly
    let decrypted = manager.decrypt_token(&token_str).unwrap();
    assert_eq!(decrypted.project_id, project_id);
    assert_eq!(decrypted.endpoint_id, Some(endpoint_id));
    assert_eq!(decrypted.param_name, Some("redirect_uri".to_string()));

    // 3. Tamper with token ciphertext (bit flip)
    let mut tampered_bytes = token_str.into_bytes();
    let last_idx = tampered_bytes.len() - 1;
    tampered_bytes[last_idx] = if tampered_bytes[last_idx] == b'a' { b'b' } else { b'a' };
    let tampered_str = String::from_utf8(tampered_bytes).unwrap();

    assert!(manager.decrypt_token(&tampered_str).is_err());
}

#[test]
fn test_oast_multi_protocol_decoders() {
    use sentinel_oast::OastProtocolDecoder;

    // 1. DNS Query Decoder
    let dns = OastProtocolDecoder::decode_dns_query("oast_112233445566778899aabbcc.oast.sentinel.dev.", "198.51.100.25");
    assert_eq!(dns.client_ip, "198.51.100.25");
    assert_eq!(dns.extracted_token, Some("oast_112233445566778899aabbcc".to_string()));

    // 2. HTTP Request Decoder
    let headers = vec![
        ("Host".to_string(), "oast_112233445566778899aabbcc.oast.sentinel.dev".to_string()),
        ("User-Agent".to_string(), "Curl/7.68.0".to_string()),
    ];
    let http = OastProtocolDecoder::decode_http_request("GET", "/callback/endpoint", &headers, b"");
    assert_eq!(http.method, "GET");
    assert_eq!(http.extracted_token, Some("oast_112233445566778899aabbcc".to_string()));

    // 3. SMTP Session Decoder
    let smtp = OastProtocolDecoder::decode_smtp_session(
        "mail.attacker.com",
        "probe@oast_112233445566778899aabbcc.oast.sentinel.dev",
        &["admin@target.com".to_string()],
        "Subject: Test\r\n\r\nBody text",
    );
    assert_eq!(smtp.mail_from, "probe@oast_112233445566778899aabbcc.oast.sentinel.dev");
    assert_eq!(smtp.extracted_token, Some("oast_112233445566778899aabbcc".to_string()));
}


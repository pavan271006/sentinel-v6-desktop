//! Client Connection & Protocol Demuxing Handler
//!
//! Enforces:
//! - SEC-01: Default-Deny Scope Engine verification before ANY upstream socket connection
//! - Dynamic TLS MITM termination with forged certificates
//! - Interceptor pipeline (inspect, modify, drop, respond)
//! - Dual-write transaction recording to CAS + SQLite and telemetry emission

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use tokio::io::{AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::TlsAcceptor;
use tracing::warn;

use sentinel_common::domain::meta::TlsData;
use sentinel_common::events::CriticalEvent;
use sentinel_common::operational::ParsedRequest;
use sentinel_common::traits::{EventBus, HttpParser, ScopeEngine};
use sentinel_parser::SentinelHttpParser;

use crate::error::ProxyError;
use crate::pipeline::interceptor::{InterceptAction, RequestContext};
use crate::pipeline::InterceptorPipeline;
use crate::recorder::{PendingTransactionRecord, PersistenceRecorder};
use crate::tls::{build_upstream_client_config, TlsServerConfigCache};

static TX_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(100);

/// Domains whose TLS connections must be passed through WITHOUT MITM termination.
/// These are anti-bot challenge platforms that perform TLS certificate pinning,
/// integrity verification, or embed WebWorker Proof-of-Work inside cross-origin
/// iframes. MITM-terminating these connections causes challenges to loop forever.
const TLS_PASSTHROUGH_DOMAINS: &[&str] = &[
    "challenges.cloudflare.com",
    "cloudflareinsights.com",
    "static.cloudflareinsights.com",
    "api.hcaptcha.com",
    "newassets.hcaptcha.com",
    "imgs.hcaptcha.com",
    "accounts.hcaptcha.com",
    "hcaptcha.com",
    "www.google.com",              // reCAPTCHA anchor & bframe
    "www.gstatic.com",             // reCAPTCHA assets
    "recaptcha.net",
    "www.recaptcha.net",
    "api-js.datadome.co",
    "geo.captcha-delivery.com",    // DataDome
    "ct.captcha-delivery.com",
    "client-api.arkoselabs.com",   // Arkose FunCaptcha
    "api.funcaptcha.com",
    "cdn.arkoselabs.com",
    "*.perimeterx.net",
    "captcha.px-cdn.net",
    "collector-px*.perimeterx.net",
];

/// Returns `true` if `host` matches any TLS passthrough domain (exact or suffix).
fn is_tls_passthrough_host(host: &str) -> bool {
    let lower = host.to_lowercase();
    for pattern in TLS_PASSTHROUGH_DOMAINS {
        if pattern.starts_with("*.") {
            let suffix = &pattern[1..]; // ".perimeterx.net"
            if lower.ends_with(suffix) || lower == &pattern[2..] {
                return true;
            }
        } else if lower == *pattern || lower.ends_with(&format!(".{}", pattern)) {
            return true;
        }
    }
    false
}

/// Shared state passed to every connection handler task.
#[derive(Clone)]
pub struct HandlerState {
    pub scope_engine: Option<Arc<parking_lot::RwLock<dyn ScopeEngine>>>,
    pub event_bus: Option<Arc<dyn EventBus>>,
    pub pipeline: Arc<InterceptorPipeline>,
    pub tls_cache: Arc<TlsServerConfigCache>,
    pub recorder: Arc<PersistenceRecorder>,
    pub parser: Arc<SentinelHttpParser>,
    pub upstream_proxy: Arc<parking_lot::RwLock<Option<String>>>,
}

#[derive(Clone)]
pub struct PendingReq {
    pub id: String,
    pub method: String,
    pub url: String,
    pub req_headers: Vec<sentinel_common::events::HttpHeaderData>,
    pub req_body: Option<String>,
    pub start_time: Instant,
}

/// Handles an incoming client TCP connection.
pub async fn handle_connection(
    mut client_stream: TcpStream,
    client_addr: SocketAddr,
    state: HandlerState,
) -> Result<(), ProxyError> {
    let _ = client_stream.set_nodelay(true);
    let mut initial_buf = vec![0u8; 8192];
    let n = client_stream.read(&mut initial_buf).await?;
    if n == 0 {
        return Ok(());
    }
    initial_buf.truncate(n);

    // Inspect initial bytes to determine if CONNECT or Plain HTTP
    if initial_buf.starts_with(b"CONNECT ") {
        handle_connect_tunnel(client_stream, client_addr, &initial_buf, state).await
    } else {
        handle_plain_http(client_stream, client_addr, &initial_buf, state).await
    }
}

/// Handles HTTPS CONNECT MITM Tunneling with Dynamic TLS Termination.
async fn handle_connect_tunnel(
    mut client_stream: TcpStream,
    _client_addr: SocketAddr,
    initial_buf: &[u8],
    state: HandlerState,
) -> Result<(), ProxyError> {
    // 1. Parse CONNECT request line: "CONNECT host:port HTTP/1.1"
    let parsed_connect = state.parser.parse_request(initial_buf)?;
    let authority = parsed_connect.uri.clone();
    let target_host = authority
        .split(':')
        .next()
        .unwrap_or(&authority)
        .to_string();
    let target_port: u16 = authority
        .split(':')
        .nth(1)
        .and_then(|p| p.parse().ok())
        .unwrap_or(443);

    let target_uri = format!("https://{}", authority);

    // 2. SEC-01 Scope Enforcement Gate: Check target BEFORE opening upstream connection
    if let Err(e) = verify_scope_and_audit(&state, &target_uri, &target_host).await {
        send_forbidden_response(&mut client_stream, &target_uri, &e.to_string()).await?;
        return Err(e);
    }

    // 3. Send 200 Connection Established to client
    client_stream
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await?;

    // 3.5 TLS Passthrough Gate: anti-bot challenge platforms must NOT be MITM'd.
    //     Their iframes perform certificate pinning, WebWorker PoW with timing
    //     integrity checks, and TLS fingerprint validation. MITM termination
    //     breaks all of this and causes infinite "Verifying..." loops.
    if is_tls_passthrough_host(&target_host) {
        tracing::info!(
            "TLS passthrough (no MITM) for challenge domain: {}:{}",
            target_host,
            target_port
        );
        let initial_proxy_str = state.upstream_proxy.read().clone();
        let mut upstream_tcp = connect_upstream_stream(
            &target_host,
            target_port,
            initial_proxy_str.as_deref(),
        )
        .await?;
        let _ = tokio::io::copy_bidirectional(&mut client_stream, &mut upstream_tcp).await;
        return Ok(());
    }



    // 4. Terminate Client TLS with dynamically forged certificate
    let server_config = state.tls_cache.get_or_generate(&target_host)?;
    let acceptor = TlsAcceptor::from(server_config);
    let client_tls = acceptor.accept(client_stream).await.map_err(|e| {
        ProxyError::Tls(format!(
            "Client TLS handshake failed for {}: {}",
            target_host, e
        ))
    })?;

    // 5. Establish Upstream TLS connection (direct or via upstream proxy)
    let initial_proxy_str = state.upstream_proxy.read().clone();
    let upstream_tcp = connect_upstream_stream(
        &target_host,
        target_port,
        initial_proxy_str.as_deref(),
    )
    .await?;

    let client_config = build_upstream_client_config(true); // Insecure skip verify for flexible pentesting
    let connector = tokio_rustls::TlsConnector::from(client_config);
    let server_name = rustls::pki_types::ServerName::try_from(target_host.clone())
        .map_err(|_| ProxyError::Tls(format!("Invalid SNI server name: {}", target_host)))?;

    let upstream_tls = connector
        .connect(server_name, upstream_tcp)
        .await
        .map_err(|e| {
            ProxyError::Tls(format!(
                "Upstream TLS handshake failed for {}: {}",
                target_host, e
            ))
        })?;

    let _tls_info = Some(TlsData {
        protocol: "TLSv1.3".to_string(),
        cipher: "TLS_AES_256_GCM_SHA384".to_string(),
        server_name: Some(target_host.clone()),
        alpn: Some("http/1.1".to_string()),
    });

    // 6. Continuous request interception & bidirectional streaming over keep-alive TLS connection
    let (mut client_read, mut client_write) = tokio::io::split(client_tls);
    let (mut upstream_read, mut upstream_write) = tokio::io::split(upstream_tls);

    let target_host_clone = target_host.clone();
    let state_clone = state.clone();

    let initial_proxy_clone_1 = initial_proxy_str.clone();
    let initial_proxy_clone_2 = initial_proxy_str.clone();
    let (req_tx, mut req_rx) = tokio::sync::mpsc::channel::<PendingReq>(64);

    let client_to_upstream = async move {
        let mut buf = vec![0u8; 65536];
        loop {
            let n = match client_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => n,
                Err(_) => break,
            };

            let chunk = &buf[..n];

            // Parse HTTP request headers whenever a new request arrives on this persistent connection
            if chunk.starts_with(b"GET ")
                || chunk.starts_with(b"POST ")
                || chunk.starts_with(b"PUT ")
                || chunk.starts_with(b"DELETE ")
                || chunk.starts_with(b"HEAD ")
                || chunk.starts_with(b"OPTIONS ")
                || chunk.starts_with(b"PATCH ")
                || chunk.starts_with(b"TRACE ")
            {
                let current_proxy = state_clone.upstream_proxy.read().clone();
                if current_proxy != initial_proxy_clone_1 {
                    // Upstream proxy was rotated. Break socket cleanly so client connects through new node.
                    break;
                }

                let raw_str = String::from_utf8_lossy(chunk);
                let (headers_part, body_part_initial) = if let Some(pos) = raw_str.find("\r\n\r\n") {
                    (&raw_str[..pos], if pos + 4 < raw_str.len() { Some(raw_str[pos + 4..].to_string()) } else { None })
                } else if let Some(pos) = raw_str.find("\n\n") {
                    (&raw_str[..pos], if pos + 2 < raw_str.len() { Some(raw_str[pos + 2..].to_string()) } else { None })
                } else {
                    (raw_str.as_ref(), None)
                };

                let mut lines = headers_part.lines();
                let request_line = lines.next().unwrap_or("");
                let mut parts = request_line.split_whitespace();
                let method = parts.next().unwrap_or("GET").to_string();
                let path = parts.next().unwrap_or("/").to_string();

                let full_url = if path.starts_with("http") {
                    path
                } else {
                    format!("https://{}{}", target_host_clone, path)
                };

                let mut req_headers = Vec::new();
                let mut content_len: usize = 0;
                for line in lines {
                    if let Some((k, v)) = line.split_once(':') {
                        let k_trim = k.trim();
                        let v_trim = v.trim();
                        if k_trim.eq_ignore_ascii_case("content-length") {
                            content_len = v_trim.parse().unwrap_or(0);
                        }
                        req_headers.push(sentinel_common::events::HttpHeaderData {
                            name: k_trim.to_string(),
                            value: v_trim.to_string(),
                        });
                    }
                }

                // Forward initial headers & partial body chunk upstream (normalize Accept-Encoding like Burp Suite)
                let forwarded_chunk = normalize_request_accept_encoding(chunk);
                if upstream_write.write_all(&forwarded_chunk).await.is_err() {
                    break;
                }

                // If Content-Length > 0 and body wasn't fully in this chunk, stream the remaining body
                let mut full_body = body_part_initial.unwrap_or_default();
                if content_len > 0 && full_body.len() < content_len {
                    let mut remaining = content_len.saturating_sub(full_body.len());
                    while remaining > 0 {
                        let to_read = remaining.min(buf.len());
                        let body_n = match client_read.read(&mut buf[..to_read]).await {
                            Ok(0) => break,
                            Ok(bn) => bn,
                            Err(_) => break,
                        };
                        let body_chunk = &buf[..body_n];
                        if upstream_write.write_all(body_chunk).await.is_err() {
                            break;
                        }
                        full_body.push_str(&String::from_utf8_lossy(body_chunk));
                        if body_n >= remaining {
                            break;
                        }
                        remaining -= body_n;
                    }
                }

                let final_body = if !full_body.is_empty() {
                    Some(full_body)
                } else {
                    None
                };

                let seq = TX_SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                let req_id = format!("tx-{:06}", seq);

                // Publish immediate telemetry with complete request body
                if let Some(ref bus) = state_clone.event_bus {
                    let _ = bus.publish_telemetry(sentinel_common::events::SentinelEvent::Traffic(
                        sentinel_common::events::TrafficEventData {
                            id: req_id.clone(),
                            method: method.clone(),
                            url: full_url.clone(),
                            status: 200,
                            duration_ms: 15,
                            in_scope: true,
                            req_headers: Some(req_headers.clone()),
                            req_body: final_body.clone(),
                            res_headers: None,
                            res_body: None,
                        },
                    ));
                }

                let _ = req_tx
                    .send(PendingReq {
                        id: req_id,
                        method,
                        url: full_url,
                        req_headers,
                        req_body: final_body,
                        start_time: Instant::now(),
                    })
                    .await;

                continue;
            }

            if upstream_write.write_all(chunk).await.is_err() {
                break;
            }
        }
        let _ = upstream_write.shutdown().await;
    };

    let state_clone_2 = state.clone();
    let upstream_to_client = async move {
        let mut buf = vec![0u8; 65536];
        let mut active_res: Option<ActiveResponse> = None;

        loop {
            let n = match upstream_read.read(&mut buf).await {
                Ok(0) => {
                    if let Some(res) = active_res.take() {
                        finalize_and_publish_proxy_response(&state_clone_2, res);
                    }
                    break;
                }
                Ok(n) => n,
                Err(_) => {
                    if let Some(res) = active_res.take() {
                        finalize_and_publish_proxy_response(&state_clone_2, res);
                    }
                    break;
                }
            };

            let chunk = &buf[..n];

            // 1. Immediately forward raw chunk to client for zero-lag streaming
            if client_write.write_all(chunk).await.is_err() {
                if let Some(res) = active_res.take() {
                    finalize_and_publish_proxy_response(&state_clone_2, res);
                }
                break;
            }

            // 2. Response processing and full multi-packet accumulation
            if chunk.starts_with(b"HTTP/") {
                // If there was an existing active response from previous request, finalize it
                if let Some(res) = active_res.take() {
                    finalize_and_publish_proxy_response(&state_clone_2, res);
                }

                let raw_str = String::from_utf8_lossy(chunk);
                let headers_part = if let Some(pos) = raw_str.find("\r\n\r\n") {
                    &raw_str[..pos]
                } else if let Some(pos) = raw_str.find("\n\n") {
                    &raw_str[..pos]
                } else {
                    raw_str.as_ref()
                };

                let mut lines = headers_part.lines();
                let status_line = lines.next().unwrap_or("");
                let status_code: u16 = status_line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(200);

                let mut res_headers = Vec::new();
                let mut is_chunked = false;
                let mut content_len: Option<usize> = None;

                for line in lines {
                    if let Some((k, v)) = line.split_once(':') {
                        let key = k.trim();
                        let val = v.trim();
                        if key.eq_ignore_ascii_case("transfer-encoding") && val.to_lowercase().contains("chunked") {
                            is_chunked = true;
                        }
                        if key.eq_ignore_ascii_case("content-length") {
                            content_len = val.parse().ok();
                        }
                        res_headers.push(sentinel_common::events::HttpHeaderData {
                            name: key.to_string(),
                            value: val.to_string(),
                        });
                    }
                }

                let body_slice: &[u8] = if let Some(pos) = chunk.windows(4).position(|w| w == b"\r\n\r\n") {
                    &chunk[pos + 4..]
                } else if let Some(pos) = chunk.windows(2).position(|w| w == b"\n\n") {
                    &chunk[pos + 2..]
                } else {
                    &[]
                };

                if let Ok(pending) = req_rx.try_recv() {
                    let cur = ActiveResponse {
                        pending,
                        status_code,
                        res_headers,
                        content_length: content_len,
                        is_chunked,
                        body_buffer: body_slice.to_vec(),
                    };

                    let is_complete = match (cur.content_length, cur.is_chunked) {
                        (Some(cl), _) => cur.body_buffer.len() >= cl,
                        (None, true) => cur.body_buffer.windows(5).any(|w| w == b"0\r\n\r\n"),
                        _ => status_code == 204 || status_code == 304,
                    };

                    if is_complete {
                        finalize_and_publish_proxy_response(&state_clone_2, cur);
                    } else {
                        active_res = Some(cur);
                    }
                }
            } else if let Some(ref mut cur) = active_res {
                // Subsequent body chunk: accumulate up to 20MB
                if cur.body_buffer.len() < 20 * 1024 * 1024 {
                    cur.body_buffer.extend_from_slice(chunk);
                }

                let is_complete = match (cur.content_length, cur.is_chunked) {
                    (Some(cl), _) => cur.body_buffer.len() >= cl,
                    (None, true) => cur.body_buffer.windows(5).any(|w| w == b"0\r\n\r\n"),
                    _ => false,
                };

                if is_complete {
                    let completed = active_res.take().unwrap();
                    finalize_and_publish_proxy_response(&state_clone_2, completed);
                }
            }

            let current_proxy = state_clone_2.upstream_proxy.read().clone();
            if current_proxy != initial_proxy_clone_2 {
                if let Some(res) = active_res.take() {
                    finalize_and_publish_proxy_response(&state_clone_2, res);
                }
                break;
            }
        }
        let _ = client_write.shutdown().await;
    };

    let _ = tokio::join!(client_to_upstream, upstream_to_client);

    Ok(())
}

/// Handles Plain HTTP Forward Proxy Traffic.
async fn handle_plain_http(
    mut client_stream: TcpStream,
    client_addr: SocketAddr,
    initial_buf: &[u8],
    state: HandlerState,
) -> Result<(), ProxyError> {
    let parsed_req = state.parser.parse_request(initial_buf)?;
    let start_time = Instant::now();

    // Extract target host and URI
    let (target_host, target_port, clean_uri) = extract_http_target(&parsed_req)?;
    let target_uri = format!("http://{}:{}{}", target_host, target_port, clean_uri);

    // SEC-01 Scope Enforcement Gate
    if let Err(e) = verify_scope_and_audit(&state, &target_uri, &target_host).await {
        send_forbidden_response(&mut client_stream, &target_uri, &e.to_string()).await?;
        return Err(e);
    }

    // Check for WebSocket upgrade
    let is_ws = parsed_req
        .headers
        .iter()
        .any(|(n, v)| n.eq_ignore_ascii_case(b"upgrade") && v.eq_ignore_ascii_case(b"websocket"));

    let ctx = RequestContext::new(client_addr, false, target_uri.clone());

    // Execute Request Interceptors
    let mut parsed_req = parsed_req;
    let req_action = state
        .pipeline
        .execute_on_request(&mut parsed_req, &ctx)
        .await
        .map_err(|e| ProxyError::Interceptor(e.to_string()))?;

    match req_action {
        InterceptAction::Drop { .. } => {
            return Ok(());
        }
        InterceptAction::RespondWith(synthetic_res) => {
            let wire_res = state.parser.serialize_response(&synthetic_res)?;
            client_stream.write_all(&wire_res).await?;
            return Ok(());
        }
        InterceptAction::Continue | InterceptAction::Modified => {}
    }

    let wire_req = state.parser.serialize_request(&parsed_req)?;

    // Connect to upstream HTTP target (direct or via upstream proxy)
    let upstream_proxy_str = state.upstream_proxy.read().clone();
    let mut upstream_stream = connect_upstream_stream(
        &target_host,
        target_port,
        upstream_proxy_str.as_deref(),
    )
    .await?;

    if is_ws {
        // Forward WS handshake request
        upstream_stream.write_all(&wire_req).await?;

        // Read 101 response
        let mut res_buf = vec![0u8; 4096];
        let n = upstream_stream.read(&mut res_buf).await?;
        res_buf.truncate(n);
        client_stream.write_all(&res_buf).await?;

        // Tap WebSocket
        let (c_r, c_w) = client_stream.into_split();
        let (s_r, s_w) = upstream_stream.into_split();
        crate::websocket::tap_websocket(c_r, c_w, s_r, s_w, state.pipeline.clone(), ctx).await;
        return Ok(());
    }

    // Forward request
    upstream_stream.write_all(&wire_req).await?;

    // Read upstream response
    let mut res_buf = vec![0u8; 65536];
    let n = upstream_stream.read(&mut res_buf).await?;
    if n == 0 {
        return Ok(());
    }

    let mut parsed_res = match state.parser.parse_response(&res_buf[..n]) {
        Ok(r) => r,
        Err(_) => {
            client_stream.write_all(&res_buf[..n]).await?;
            return Ok(());
        }
    };

    // Execute Response Interceptors
    let res_action = state
        .pipeline
        .execute_on_response(&parsed_req, &mut parsed_res, &ctx)
        .await
        .map_err(|e| ProxyError::Interceptor(e.to_string()))?;

    let wire_res = match res_action {
        InterceptAction::Drop { .. } => {
            return Ok(());
        }
        InterceptAction::RespondWith(synthetic) => {
            state.parser.serialize_response(&synthetic)?
        }
        InterceptAction::Continue | InterceptAction::Modified => {
            state.parser.serialize_response(&parsed_res)?
        }
    };

    client_stream.write_all(&wire_res).await?;

    // Record the transaction for HTTP history
    state.recorder.record(PendingTransactionRecord {
        raw_request: wire_req,
        parsed_request: parsed_req.clone(),
        raw_response: Some(wire_res),
        parsed_response: Some(parsed_res.clone()),
        timing: start_time.elapsed(),
        tls_info: None,
        scope_id: ctx.scope_id,
    });

    if let Some(ref bus) = state.event_bus {
        let seq = TX_SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let req_headers: Vec<sentinel_common::events::HttpHeaderData> = parsed_req
            .headers
            .iter()
            .map(|(k, v)| sentinel_common::events::HttpHeaderData {
                name: String::from_utf8_lossy(k).to_string(),
                value: String::from_utf8_lossy(v).to_string(),
            })
            .collect();
        let res_headers: Vec<sentinel_common::events::HttpHeaderData> = parsed_res
            .headers
            .iter()
            .map(|(k, v)| sentinel_common::events::HttpHeaderData {
                name: String::from_utf8_lossy(k).to_string(),
                value: String::from_utf8_lossy(v).to_string(),
            })
            .collect();
        let plain_res_body = if !parsed_res.body.is_empty() {
            Some(decode_and_decompress_proxy_body(&res_headers, &parsed_res.body, false))
        } else {
            None
        };
        let plain_req_body = if !parsed_req.body.is_empty() {
            Some(String::from_utf8_lossy(&parsed_req.body).to_string())
        } else {
            None
        };

        let _ = bus.publish_telemetry(sentinel_common::events::SentinelEvent::Traffic(
            sentinel_common::events::TrafficEventData {
                id: format!("tx-{:06}", seq),
                method: parsed_req.method.as_str().to_string(),
                url: target_uri.clone(),
                status: parsed_res.status_code,
                duration_ms: start_time.elapsed().as_millis() as u64,
                in_scope: true,
                req_headers: Some(req_headers),
                req_body: plain_req_body,
                res_headers: Some(res_headers),
                res_body: plain_res_body,
            },
        ));
    }

    Ok(())
}

/// Evaluates SEC-01 Scope authorization and publishes critical audit events on violation.
async fn verify_scope_and_audit(
    state: &HandlerState,
    target_uri: &str,
    target_host: &str,
) -> Result<(), ProxyError> {
    if let Some(ref scope_lock) = state.scope_engine {
        let (is_allowed, reason, decision) = {
            let engine = scope_lock.read();
            let uri_decision = engine.is_in_scope(target_uri);
            if !uri_decision.allowed {
                (false, uri_decision.reason.clone(), uri_decision)
            } else if let Ok(_) = target_host.parse::<std::net::IpAddr>() {
                let ip_decision = engine.is_ip_in_scope(target_host);
                if !ip_decision.allowed {
                    (false, ip_decision.reason.clone(), ip_decision)
                } else {
                    (true, "".to_string(), uri_decision)
                }
            } else {
                (true, "".to_string(), uri_decision)
            }
        };

        if !is_allowed {
            // SEC-01 & SEC-12: Emit durable critical audit event
            if let Some(ref bus) = state.event_bus {
                let crit_event = CriticalEvent::ScopeViolationAttempt {
                    source: "ProxyEngine".to_string(),
                    target: target_uri.to_string(),
                    decision,
                };
                let _ = bus.publish_critical(crit_event);
            }

            return Err(ProxyError::ScopeViolation {
                target: target_uri.to_string(),
                reason,
            });
        }
    }

    Ok(())
}

/// Sends standard HTTP 403 Forbidden on SEC-01 scope violation.
async fn send_forbidden_response<W: AsyncWrite + Unpin>(
    stream: &mut W,
    target_uri: &str,
    reason: &str,
) -> Result<(), ProxyError> {
    let body = serde_json::json!({
        "error": "Scope Violation (SEC-01)",
        "target": target_uri,
        "reason": reason,
        "policy": "DEFAULT_DENY"
    })
    .to_string();

    let response = format!(
        "HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );

    stream.write_all(response.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}

/// Extracts host, port, and path from an HTTP request.
fn extract_http_target(req: &ParsedRequest) -> Result<(String, u16, String), ProxyError> {
    if req.uri.starts_with("http://") || req.uri.starts_with("https://") {
        if let Ok(url) = url::Url::parse(&req.uri) {
            let host = url.host_str().unwrap_or("127.0.0.1").to_string();
            let port = url.port_or_known_default().unwrap_or(80);
            let path = format!(
                "{}{}",
                url.path(),
                url.query().map(|q| format!("?{}", q)).unwrap_or_default()
            );
            return Ok((host, port, path));
        }
    }

    // Look for Host header
    if let Some((_, val)) = req
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(b"host"))
    {
        let host_str = String::from_utf8_lossy(val).to_string();
        let parts: Vec<&str> = host_str.split(':').collect();
        let host = parts[0].trim().to_string();
        let port = if parts.len() > 1 {
            parts[1].trim().parse().unwrap_or(80)
        } else {
            80
        };
        return Ok((host, port, req.uri.clone()));
    }

    Err(ProxyError::InvalidConfiguration(
        "No Host header or absolute URI found".to_string(),
    ))
}

fn normalize_request_accept_encoding(chunk: &[u8]) -> Vec<u8> {
    let lower = chunk.to_ascii_lowercase();
    if let Some(pos) = lower.windows(16).position(|w| w == b"accept-encoding:") {
        if let Some(line_end) = chunk[pos..].windows(2).position(|w| w == b"\r\n") {
            let mut out = Vec::with_capacity(chunk.len());
            out.extend_from_slice(&chunk[..pos]);
            out.extend_from_slice(b"Accept-Encoding: gzip, deflate");
            out.extend_from_slice(&chunk[pos + line_end..]);
            return out;
        }
    }
    chunk.to_vec()
}

struct ActiveResponse {
    pending: PendingReq,
    status_code: u16,
    res_headers: Vec<sentinel_common::events::HttpHeaderData>,
    content_length: Option<usize>,
    is_chunked: bool,
    body_buffer: Vec<u8>,
}

fn finalize_and_publish_proxy_response(
    state: &HandlerState,
    res: ActiveResponse,
) {
    let clean_body = decode_and_decompress_proxy_body(
        &res.res_headers,
        &res.body_buffer,
        res.is_chunked,
    );

    let is_decompressed = clean_body.len() > res.body_buffer.len() || !clean_body.is_empty();
    let display_res_headers: Vec<sentinel_common::events::HttpHeaderData> = res.res_headers
        .into_iter()
        .filter(|h| {
            if is_decompressed && h.name.eq_ignore_ascii_case("content-encoding") {
                return false;
            }
            if is_decompressed && h.name.eq_ignore_ascii_case("transfer-encoding") && h.value.to_ascii_lowercase().contains("chunked") {
                return false;
            }
            true
        })
        .collect();

    if let Some(ref bus) = state.event_bus {
        let duration = res.pending.start_time.elapsed().as_millis() as u64;
        let _ = bus.publish_telemetry(sentinel_common::events::SentinelEvent::Traffic(
            sentinel_common::events::TrafficEventData {
                id: res.pending.id,
                method: res.pending.method,
                url: res.pending.url,
                status: res.status_code,
                duration_ms: duration.max(5),
                in_scope: true,
                req_headers: Some(res.pending.req_headers),
                req_body: res.pending.req_body,
                res_headers: Some(display_res_headers),
                res_body: Some(clean_body),
            },
        ));
    }
}

fn decode_and_decompress_proxy_body(
    res_headers: &[sentinel_common::events::HttpHeaderData],
    raw_body_bytes: &[u8],
    is_chunked: bool,
) -> String {
    if raw_body_bytes.is_empty() {
        return String::new();
    }

    use flate2::read::{DeflateDecoder, GzDecoder, ZlibDecoder};
    use std::io::Read;

    // 1. Unchunk if needed
    let working_bytes = if is_chunked {
        if let Ok(decoded) = sentinel_parser::ChunkedDecoder::decode(raw_body_bytes, 20 * 1024 * 1024) {
            decoded.body
        } else {
            raw_body_bytes.to_vec()
        }
    } else {
        raw_body_bytes.to_vec()
    };

    if working_bytes.is_empty() {
        return String::new();
    }

    // 2. Check for Content-Encoding
    let is_brotli = res_headers.iter().any(|h| {
        h.name.eq_ignore_ascii_case("content-encoding") && h.value.to_ascii_lowercase().contains("br")
    });

    let is_gzip = res_headers.iter().any(|h| {
        h.name.eq_ignore_ascii_case("content-encoding") && h.value.to_ascii_lowercase().contains("gzip")
    }) || (working_bytes.len() >= 2 && working_bytes[0] == 0x1f && working_bytes[1] == 0x8b);

    let is_deflate = res_headers.iter().any(|h| {
        h.name.eq_ignore_ascii_case("content-encoding") && h.value.to_ascii_lowercase().contains("deflate")
    });

    if is_brotli {
        let mut decompressed = Vec::new();
        let mut decompressor = brotli::Decompressor::new(&working_bytes[..], 4096);
        if decompressor.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
    }

    if is_gzip {
        let mut decoder = GzDecoder::new(&working_bytes[..]);
        let mut decompressed = Vec::new();
        if decoder.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
    }

    if is_deflate {
        let mut decoder = DeflateDecoder::new(&working_bytes[..]);
        let mut decompressed = Vec::new();
        if decoder.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
        let mut zlib = ZlibDecoder::new(&working_bytes[..]);
        let mut zlib_decomp = Vec::new();
        if zlib.read_to_end(&mut zlib_decomp).is_ok() && !zlib_decomp.is_empty() {
            return String::from_utf8_lossy(&zlib_decomp).to_string();
        }
    }

    // Auto-detect Gzip by magic bytes if header was missing
    if working_bytes.len() >= 2 && working_bytes[0] == 0x1f && working_bytes[1] == 0x8b {
        let mut decoder = GzDecoder::new(&working_bytes[..]);
        let mut decompressed = Vec::new();
        if decoder.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
    }

    // Universal fallback: if utf8_lossy contains unicode replacement characters (\u{FFFD}),
    // attempt Brotli or Zlib trial decompression in case content-encoding header was stripped
    let raw_utf8 = String::from_utf8_lossy(&working_bytes).to_string();
    if raw_utf8.contains('\u{FFFD}') {
        let mut decompressed = Vec::new();
        let mut decompressor = brotli::Decompressor::new(&working_bytes[..], 4096);
        if decompressor.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
            return String::from_utf8_lossy(&decompressed).to_string();
        }
        let mut zlib = ZlibDecoder::new(&working_bytes[..]);
        let mut zlib_decomp = Vec::new();
        if zlib.read_to_end(&mut zlib_decomp).is_ok() && !zlib_decomp.is_empty() {
            return String::from_utf8_lossy(&zlib_decomp).to_string();
        }
    }

    raw_utf8
}

/// Connects to the upstream target either directly or chained through an upstream HTTP/SOCKS5 proxy.
pub async fn connect_upstream_stream(
    target_host: &str,
    target_port: u16,
    upstream_proxy: Option<&str>,
) -> Result<TcpStream, ProxyError> {
    if let Some(proxy) = upstream_proxy {
        let proxy_str = proxy.trim();
        if !proxy_str.is_empty() {
            if let Ok(stream) = try_connect_proxy(target_host, target_port, proxy_str).await {
                return Ok(stream);
            }
        }
    }

    // Direct Connect (Default & Resilient Fallback)
    let upstream_addr = format!("{}:{}", target_host, target_port);
    let s = TcpStream::connect(&upstream_addr).await.map_err(|e| {
        ProxyError::UpstreamConnection {
            target: upstream_addr,
            message: e.to_string(),
        }
    })?;
    let _ = s.set_nodelay(true);
    Ok(s)
}

async fn try_connect_proxy(
    target_host: &str,
    target_port: u16,
    proxy_str: &str,
) -> Result<TcpStream, ProxyError> {
    let (proxy_addr, is_socks) = if let Some(stripped) = proxy_str.strip_prefix("socks5://") {
        (stripped, true)
    } else if let Some(stripped) = proxy_str.strip_prefix("http://") {
        (stripped, false)
    } else if let Some(stripped) = proxy_str.strip_prefix("https://") {
        (stripped, false)
    } else {
        (proxy_str, false)
    };

    let clean_proxy_addr = if let Some(at_idx) = proxy_addr.rfind('@') {
        &proxy_addr[at_idx + 1..]
    } else {
        proxy_addr
    };

    // Fast timeout for upstream proxy connect (1.5s)
    let stream_res = tokio::time::timeout(
        std::time::Duration::from_millis(1500),
        TcpStream::connect(clean_proxy_addr),
    )
    .await
    .map_err(|_| ProxyError::UpstreamConnection {
        target: clean_proxy_addr.to_string(),
        message: "Upstream proxy connection timed out".to_string(),
    })?;

    let mut stream = stream_res.map_err(|e| ProxyError::UpstreamConnection {
        target: clean_proxy_addr.to_string(),
        message: format!("Failed to connect to upstream proxy ({}): {}", clean_proxy_addr, e),
    })?;
    let _ = stream.set_nodelay(true);

    if is_socks {
        // SOCKS5 Greeting
        stream.write_all(&[0x05, 0x01, 0x00]).await?;
        let mut method_buf = [0u8; 2];
        stream.read_exact(&mut method_buf).await?;
        if method_buf[0] != 0x05 || method_buf[1] != 0x00 {
            return Err(ProxyError::UpstreamConnection {
                target: clean_proxy_addr.to_string(),
                message: "SOCKS5 auth negotiation failed".to_string(),
            });
        }

        // SOCKS5 Connect Request (domain name)
        let host_bytes = target_host.as_bytes();
        let host_len = host_bytes.len().min(255) as u8;
        let mut req = vec![0x05, 0x01, 0x00, 0x03, host_len];
        req.extend_from_slice(&host_bytes[..host_len as usize]);
        req.push((target_port >> 8) as u8);
        req.push((target_port & 0xFF) as u8);

        stream.write_all(&req).await?;

        let mut resp_head = [0u8; 4];
        stream.read_exact(&mut resp_head).await?;
        if resp_head[1] != 0x00 {
            return Err(ProxyError::UpstreamConnection {
                target: clean_proxy_addr.to_string(),
                message: format!("SOCKS5 connect failed with status 0x{:02x}", resp_head[1]),
            });
        }
        match resp_head[3] {
            0x01 => {
                let mut ipv4_buf = [0u8; 4 + 2];
                let _ = stream.read_exact(&mut ipv4_buf).await;
            }
            0x03 => {
                let mut len_buf = [0u8; 1];
                let _ = stream.read_exact(&mut len_buf).await;
                let mut domain_buf = vec![0u8; len_buf[0] as usize + 2];
                let _ = stream.read_exact(&mut domain_buf).await;
            }
            0x04 => {
                let mut ipv6_buf = [0u8; 16 + 2];
                let _ = stream.read_exact(&mut ipv6_buf).await;
            }
            _ => {}
        }
        Ok(stream)
    } else {
        // HTTP CONNECT Tunneling
        let connect_req = format!(
            "CONNECT {}:{} HTTP/1.1\r\nHost: {}:{}\r\nProxy-Connection: Keep-Alive\r\n\r\n",
            target_host, target_port, target_host, target_port
        );
        stream.write_all(connect_req.as_bytes()).await?;

        let mut resp_buf = vec![0u8; 1024];
        let mut total_read = 0;
        while total_read < 1024 {
            let n = stream.read(&mut resp_buf[total_read..]).await?;
            if n == 0 {
                break;
            }
            total_read += n;
            if resp_buf[..total_read].windows(4).any(|w| w == b"\r\n\r\n") {
                break;
            }
        }
        let resp_str = String::from_utf8_lossy(&resp_buf[..total_read]);
        if !resp_str.starts_with("HTTP/1.1 200") && !resp_str.starts_with("HTTP/1.0 200") {
            return Err(ProxyError::UpstreamConnection {
                target: clean_proxy_addr.to_string(),
                message: format!("HTTP CONNECT proxy error: {}", resp_str.lines().next().unwrap_or("")),
            });
        }
        Ok(stream)
    }
}


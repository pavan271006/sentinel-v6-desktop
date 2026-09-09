//! Raw-Byte Network Execution & Dispatch Engine

use std::sync::Arc;
use std::time::Instant;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::rustls::pki_types::ServerName;
use tokio_rustls::rustls::ClientConfig;
use tokio_rustls::TlsConnector;
use url::Url;
use uuid::Uuid;

use sentinel_bus::ChannelEventBus;
use sentinel_common::domain::core::Transaction;
use sentinel_common::domain::meta::{EntityMetadata, HttpParsedParts, MessageRepresentation};
use sentinel_common::domain::Observation;
use sentinel_common::enums::{HttpMethod, ObservationSource, Provenance};
use sentinel_common::errors::SentinelError;
use sentinel_common::events::{CriticalEvent, SentinelEvent};
use sentinel_common::operational::ParsedResponse;
use sentinel_common::traits::{EventBus, HttpParser, ObservationStore, ScopeEngine};
use sentinel_parser::SentinelHttpParser;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;

use crate::variables::VariableEnvironment;

use serde::{Deserialize, Serialize};

pub struct RepeaterExecutor {
    scope_engine: Arc<DefaultScopeEngine>,
    event_bus: Option<Arc<ChannelEventBus>>,
    storage: Option<Arc<SqliteObservationStore>>,
    parser: SentinelHttpParser,
    tls_config: Arc<ClientConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionOutput {
    pub raw_response: Vec<u8>,
    pub parsed_response: Option<ParsedResponse>,
    pub duration_ms: u64,
    pub status_code: Option<u16>,
    pub observation_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaceExecutionSummary {
    pub total_requests: usize,
    pub successful_responses: usize,
    pub timing_spread_micros: u64,
    pub outputs: Vec<ExecutionOutput>,
}

#[derive(Debug)]
struct PermissiveCertVerifier;

impl tokio_rustls::rustls::client::danger::ServerCertVerifier for PermissiveCertVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[tokio_rustls::rustls::pki_types::CertificateDer<'_>],
        _server_name: &tokio_rustls::rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: tokio_rustls::rustls::pki_types::UnixTime,
    ) -> Result<tokio_rustls::rustls::client::danger::ServerCertVerified, tokio_rustls::rustls::Error> {
        Ok(tokio_rustls::rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _dss: &tokio_rustls::rustls::DigitallySignedStruct,
    ) -> Result<tokio_rustls::rustls::client::danger::HandshakeSignatureValid, tokio_rustls::rustls::Error> {
        Ok(tokio_rustls::rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _dss: &tokio_rustls::rustls::DigitallySignedStruct,
    ) -> Result<tokio_rustls::rustls::client::danger::HandshakeSignatureValid, tokio_rustls::rustls::Error> {
        Ok(tokio_rustls::rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<tokio_rustls::rustls::SignatureScheme> {
        vec![
            tokio_rustls::rustls::SignatureScheme::RSA_PKCS1_SHA256,
            tokio_rustls::rustls::SignatureScheme::RSA_PKCS1_SHA384,
            tokio_rustls::rustls::SignatureScheme::RSA_PKCS1_SHA512,
            tokio_rustls::rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            tokio_rustls::rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            tokio_rustls::rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            tokio_rustls::rustls::SignatureScheme::RSA_PSS_SHA256,
            tokio_rustls::rustls::SignatureScheme::RSA_PSS_SHA384,
            tokio_rustls::rustls::SignatureScheme::RSA_PSS_SHA512,
            tokio_rustls::rustls::SignatureScheme::ED25519,
        ]
    }
}

impl RepeaterExecutor {
    pub fn new(scope_engine: Arc<DefaultScopeEngine>) -> Self {
        // Ensure crypto provider is installed
        let _ = rustls::crypto::ring::default_provider().install_default();

        let mut config = ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(PermissiveCertVerifier))
            .with_no_client_auth();
        config.alpn_protocols = vec![b"http/1.1".to_vec()];

        Self {
            scope_engine,
            event_bus: None,
            storage: None,
            parser: SentinelHttpParser::new(),
            tls_config: Arc::new(config),
        }
    }

    pub fn with_event_bus(mut self, bus: Arc<ChannelEventBus>) -> Self {
        self.event_bus = Some(bus);
        self
    }

    pub fn with_storage(mut self, storage: Arc<SqliteObservationStore>) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Executes raw HTTP request bytes against the target URL, strictly enforcing scope rules.
    pub async fn execute_raw(
        &self,
        target_url: &str,
        raw_request_template: &[u8],
        env: Option<&VariableEnvironment>,
    ) -> Result<ExecutionOutput, SentinelError> {
        // 1. Variable Interpolation
        let request_bytes = if let Some(e) = env {
            e.interpolate(raw_request_template)
        } else {
            raw_request_template.to_vec()
        };
        let request_bytes = Self::expand_hackvertor_tags(&request_bytes);

        // 2. SEC-01: Scope Enforcement Gate (Fail-Closed)
        let decision = self.scope_engine.is_in_scope(target_url);
        if !decision.allowed {
            if let Some(bus) = &self.event_bus {
                let _ = bus.publish_critical(CriticalEvent::ScopeViolationAttempt {
                    source: "RepeaterEngine".to_string(),
                    target: target_url.to_string(),
                    decision: decision.clone(),
                });
            }
            return Err(SentinelError::ScopeViolation {
                reason: format!("Target '{}' is out of scope: {}", target_url, decision.reason),
            });
        }

        // 3. Target parsing
        let parsed_url = Url::parse(target_url)
            .map_err(|e| SentinelError::InvariantViolation(format!("Invalid target URL: {}", e)))?;

        let host = parsed_url.host_str().unwrap_or("localhost").to_string();
        let is_https = parsed_url.scheme() == "https";
        let default_port = if is_https { 443 } else { 80 };
        let port = parsed_url.port().unwrap_or(default_port);
        let addr = format!("{}:{}", host, port);

        // 4. Socket dispatch
        let start_time = Instant::now();
        let raw_response = if is_https {
            self.send_tls(&addr, &host, &request_bytes).await?
        } else {
            self.send_plain(&addr, &request_bytes).await?
        };
        let duration = start_time.elapsed();
        let duration_ms = duration.as_millis() as u64;

        // 5. Response parsing
        let parsed_response = self.parser.parse_response(&raw_response).ok();
        let status_code = parsed_response.as_ref().map(|r| r.status_code);

        // 6. Dual-write persistence (CAS + SQLite) & Telemetry
        let mut observation_id = None;
        if let Some(storage) = &self.storage {
            let _req_desc = storage.cas().put(&request_bytes).await?;
            let _res_desc = storage.cas().put(&raw_response).await?;

            let req_blob_id = Uuid::new_v4();
            let res_blob_id = Uuid::new_v4();

            let parsed_req = self.parser.parse_request(&request_bytes).ok();
            let req_parts = HttpParsedParts {
                method: parsed_req
                    .as_ref()
                    .map(|r| r.method)
                    .unwrap_or(HttpMethod::GET),
                uri: parsed_url.path().to_string(),
                version: "HTTP/1.1".to_string(),
                headers: parsed_req
                    .as_ref()
                    .map(|r| r.headers.clone())
                    .unwrap_or_default(),
            };

            let req_repr = MessageRepresentation {
                raw_blob_id: req_blob_id,
                parsed: req_parts,
                normalized_text: String::from_utf8_lossy(&request_bytes).to_string(),
            };

            let res_repr = parsed_response.as_ref().map(|res| {
                let res_parts = HttpParsedParts {
                    method: HttpMethod::GET,
                    uri: parsed_url.path().to_string(),
                    version: res.version.clone(),
                    headers: res.headers.clone(),
                };
                MessageRepresentation {
                    raw_blob_id: res_blob_id,
                    parsed: res_parts,
                    normalized_text: String::from_utf8_lossy(&raw_response).to_string(),
                }
            });

            let _tx = Transaction {
                meta: EntityMetadata::new(Provenance::Manual),
                request: req_repr,
                response: res_repr,
                timing: duration,
                tls_info: None,
            };

            let obs = Observation {
                meta: EntityMetadata::new(Provenance::Manual),
                source: ObservationSource::Manual,
                data_ref: Uuid::new_v4(),
            };
            let _ = storage.insert(obs.clone()).await;
            observation_id = Some(obs.meta.id);
        }

        if let Some(bus) = &self.event_bus {
            if let Some(obs_id) = observation_id {
                let _ = bus.publish_telemetry(SentinelEvent::ObservationCreated(obs_id));
            }
        }

        Ok(ExecutionOutput {
            raw_response,
            parsed_response,
            duration_ms,
            status_code,
            observation_id,
        })
    }

    async fn send_plain(&self, addr: &str, request_bytes: &[u8]) -> Result<Vec<u8>, SentinelError> {
        let mut stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        stream
            .write_all(request_bytes)
            .await
            .map_err(|e| SentinelError::NetworkError(format!("Failed to write request: {}", e)))?;

        Self::read_http_response(&mut stream).await
    }

    async fn send_tls(
        &self,
        addr: &str,
        host: &str,
        request_bytes: &[u8],
    ) -> Result<Vec<u8>, SentinelError> {
        let connector = TlsConnector::from(self.tls_config.clone());
        let stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;
        stream.set_nodelay(true).ok();

        let server_name = ServerName::try_from(host.to_string()).map_err(|e| {
            SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
        })?;

        let mut tls_stream = connector.connect(server_name, stream).await.map_err(|e| {
            SentinelError::TlsError(format!("TLS handshake failed with {}: {}", host, e))
        })?;

        tls_stream.write_all(request_bytes).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to write TLS request: {}", e))
        })?;

        Self::read_http_response(&mut tls_stream).await
    }

    async fn read_http_response<S: tokio::io::AsyncRead + Unpin>(
        stream: &mut S,
    ) -> Result<Vec<u8>, SentinelError> {
        let mut buffer = Vec::with_capacity(16384);
        let mut chunk = [0u8; 16384];
        let mut headers_parsed = false;
        let mut content_length: Option<usize> = None;
        let mut is_chunked = false;
        let mut header_end_offset = 0;

        let total_timeout = std::time::Duration::from_secs(12);
        let start_read = std::time::Instant::now();

        loop {
            if start_read.elapsed() > total_timeout {
                break;
            }

            // If headers are already parsed and we are waiting for EOF, use a very short timeout slice
            let read_timeout = if headers_parsed {
                if content_length.is_some() || is_chunked {
                    std::time::Duration::from_millis(500)
                } else {
                    std::time::Duration::from_millis(80)
                }
            } else {
                std::time::Duration::from_millis(1500)
            };

            let read_future = stream.read(&mut chunk);
            let n = match tokio::time::timeout(read_timeout, read_future).await {
                Ok(Ok(0)) => break,
                Ok(Ok(n)) => n,
                Ok(Err(e)) => {
                    if !buffer.is_empty() {
                        break;
                    }
                    return Err(SentinelError::NetworkError(format!("Read error: {}", e)));
                }
                Err(_) => {
                    // Timeout slice: check if full response already buffered
                    if headers_parsed {
                        if let Some(cl) = content_length {
                            if buffer.len() >= header_end_offset + cl {
                                break;
                            }
                        } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                            break;
                        } else if !buffer.is_empty() {
                            break;
                        }
                    }
                    if !buffer.is_empty() && start_read.elapsed() > std::time::Duration::from_millis(500) {
                        break;
                    }
                    continue;
                }
            };

            buffer.extend_from_slice(&chunk[..n]);

            if !headers_parsed {
                if let Some(pos) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end_offset = pos + 4;
                    headers_parsed = true;

                    let header_bytes = &buffer[..pos];
                    let header_str = String::from_utf8_lossy(header_bytes).to_ascii_lowercase();

                    for line in header_str.lines() {
                        if let Some(val) = line.strip_prefix("content-length:") {
                            content_length = val.trim().parse::<usize>().ok();
                        } else if let Some(val) = line.strip_prefix("transfer-encoding:") {
                            if val.contains("chunked") {
                                is_chunked = true;
                            }
                        }
                    }
                } else if let Some(pos) = buffer.windows(2).position(|w| w == b"\n\n") {
                    header_end_offset = pos + 2;
                    headers_parsed = true;
                }
            }

            if headers_parsed {
                if let Some(cl) = content_length {
                    if buffer.len() >= header_end_offset + cl {
                        break;
                    }
                } else if is_chunked && (buffer.ends_with(b"\r\n0\r\n\r\n") || buffer.ends_with(b"0\r\n\r\n")) {
                    break;
                }
            }
        }

        Ok(buffer)
    }

    /// Expands Hackvertor-style tags such as `<@hex_entities>payload</@hex_entities>`
    /// and `<@dec_entities>payload</@dec_entities>` and updates Content-Length automatically.
    pub fn expand_hackvertor_tags(raw: &[u8]) -> Vec<u8> {
        let text = match std::str::from_utf8(raw) {
            Ok(t) => t,
            Err(_) => return raw.to_vec(),
        };

        if !text.contains("<@") {
            return raw.to_vec();
        }

        let mut result = text.to_string();

        // 1. <@hex_entities>...</@hex_entities> -> &#x55;&#x4e;...
        if let Ok(re) = regex::Regex::new(r"(?s)<@hex_entities>(.*?)</@hex_entities>") {
            result = re.replace_all(&result, |caps: &regex::Captures| {
                caps[1].chars().map(|c| format!("&#x{:x};", c as u32)).collect::<String>()
            }).to_string();
        }

        // 2. <@dec_entities>...</@dec_entities> -> &#85;&#78;...
        if let Ok(re) = regex::Regex::new(r"(?s)<@dec_entities>(.*?)</@dec_entities>") {
            result = re.replace_all(&result, |caps: &regex::Captures| {
                caps[1].chars().map(|c| format!("&#{};", c as u32)).collect::<String>()
            }).to_string();
        }

        // 3. <@urlencode>...</@urlencode>
        if let Ok(re) = regex::Regex::new(r"(?s)<@urlencode>(.*?)</@urlencode>") {
            result = re.replace_all(&result, |caps: &regex::Captures| {
                url::form_urlencoded::byte_serialize(caps[1].as_bytes()).collect::<String>()
            }).to_string();
        }

        // 4. Update Content-Length if headers exist
        if let Some((headers, body)) = result.split_once("\r\n\r\n") {
            let actual_body_len = body.as_bytes().len();
            if let Ok(cl_re) = regex::Regex::new(r"(?i)Content-Length:\s*\d+") {
                if cl_re.is_match(headers) {
                    let new_headers = cl_re.replace(headers, format!("Content-Length: {}", actual_body_len));
                    return format!("{}\r\n\r\n{}", new_headers, body).into_bytes();
                }
            }
        }

        result.into_bytes()
    }

    /// Executes multiple HTTP requests simultaneously using connection priming and single-packet barrier synchronization.
    /// Used for high-precision race condition, TOCTOU, and concurrency vulnerability detection.
    pub async fn execute_parallel_race(
        &self,
        target_url: &str,
        requests: Vec<Vec<u8>>,
    ) -> Result<RaceExecutionSummary, SentinelError> {
        // 1. SEC-01: Scope Gate check
        let decision = self.scope_engine.is_in_scope(target_url);
        if !decision.allowed {
            if let Some(bus) = &self.event_bus {
                let _ = bus.publish_critical(CriticalEvent::ScopeViolationAttempt {
                    source: "RepeaterRaceEngine".to_string(),
                    target: target_url.to_string(),
                    decision: decision.clone(),
                });
            }
            return Err(SentinelError::ScopeViolation {
                reason: format!(
                    "Target '{}' is out of scope: {}",
                    target_url, decision.reason
                ),
            });
        }

        let n = requests.len();
        if n == 0 {
            return Ok(RaceExecutionSummary {
                total_requests: 0,
                successful_responses: 0,
                timing_spread_micros: 0,
                outputs: vec![],
            });
        }

        let parsed_url = Url::parse(target_url)
            .map_err(|e| SentinelError::InvariantViolation(format!("Invalid target URL: {}", e)))?;

        let host = parsed_url.host_str().unwrap_or("localhost").to_string();
        let is_https = parsed_url.scheme() == "https";
        let default_port = if is_https { 443 } else { 80 };
        let port = parsed_url.port().unwrap_or(default_port);
        let addr = format!("{}:{}", host, port);

        let barrier = Arc::new(tokio::sync::Barrier::new(n));
        let mut handles = Vec::with_capacity(n);

        for req_bytes in requests {
            let barrier_clone = barrier.clone();
            let addr_clone = addr.clone();
            let is_https_val = is_https;
            let tls_config_clone = self.tls_config.clone();
            let host_clone = host.clone();

            let handle = tokio::spawn(async move {
                if is_https_val {
                    Self::send_tls_primed_race(
                        &addr_clone,
                        &host_clone,
                        &req_bytes,
                        barrier_clone,
                        tls_config_clone,
                    )
                    .await
                } else {
                    Self::send_plain_primed_race(&addr_clone, &req_bytes, barrier_clone).await
                }
            });
            handles.push(handle);
        }

        let mut outputs = Vec::new();
        let mut start_instants = Vec::new();

        for h in handles {
            if let Ok(Ok((raw_resp, start_time, duration))) = h.await {
                let parsed_response = self.parser.parse_response(&raw_resp).ok();
                let status_code = parsed_response.as_ref().map(|r| r.status_code);
                start_instants.push(start_time);
                outputs.push(ExecutionOutput {
                    raw_response: raw_resp,
                    parsed_response,
                    duration_ms: duration.as_millis() as u64,
                    status_code,
                    observation_id: None,
                });
            }
        }

        let timing_spread_micros = if start_instants.len() >= 2 {
            let min_t = *start_instants.iter().min().unwrap();
            let max_t = *start_instants.iter().max().unwrap();
            max_t.duration_since(min_t).as_micros() as u64
        } else {
            0
        };

        let successful = outputs.len();
        Ok(RaceExecutionSummary {
            total_requests: n,
            successful_responses: successful,
            timing_spread_micros,
            outputs,
        })
    }

    async fn send_plain_primed_race(
        addr: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let mut stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;

        if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            stream
                .write_all(head)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write head: {}", e)))?;
            let _ = stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            stream
                .write_all(last)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write last byte: {}", e)))?;
            let _ = stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            stream
                .write_all(request_bytes)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write request: {}", e)))?;
            let _ = stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        }
    }

    async fn send_tls_primed_race(
        addr: &str,
        host: &str,
        request_bytes: &[u8],
        barrier: Arc<tokio::sync::Barrier>,
        tls_config: Arc<ClientConfig>,
    ) -> Result<(Vec<u8>, Instant, std::time::Duration), SentinelError> {
        let connector = TlsConnector::from(tls_config);
        let stream = TcpStream::connect(addr).await.map_err(|e| {
            SentinelError::NetworkError(format!("Failed to connect to {}: {}", addr, e))
        })?;

        let server_name = ServerName::try_from(host.to_string()).map_err(|e| {
            SentinelError::InvariantViolation(format!("Invalid TLS server name: {}", e))
        })?;

        let mut tls_stream = connector.connect(server_name, stream).await.map_err(|e| {
            SentinelError::TlsError(format!("TLS handshake failed with {}: {}", host, e))
        })?;

        if request_bytes.len() > 1 {
            let head = &request_bytes[..request_bytes.len() - 1];
            let last = &request_bytes[request_bytes.len() - 1..];

            tls_stream
                .write_all(head)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS head: {}", e)))?;
            let _ = tls_stream.flush().await;

            barrier.wait().await;
            let fire_instant = Instant::now();

            tls_stream
                .write_all(last)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS last byte: {}", e)))?;
            let _ = tls_stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match tls_stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read TLS response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        } else {
            barrier.wait().await;
            let fire_instant = Instant::now();
            tls_stream
                .write_all(request_bytes)
                .await
                .map_err(|e| SentinelError::NetworkError(format!("Failed to write TLS request: {}", e)))?;
            let _ = tls_stream.flush().await;

            let mut buffer = Vec::with_capacity(4096);
            let mut chunk = [0u8; 4096];
            loop {
                match tls_stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                    Err(e) => {
                        return Err(SentinelError::NetworkError(format!(
                            "Failed to read TLS response: {}",
                            e
                        )))
                    }
                }
            }
            let duration = fire_instant.elapsed();
            Ok((buffer, fire_instant, duration))
        }
    }
}

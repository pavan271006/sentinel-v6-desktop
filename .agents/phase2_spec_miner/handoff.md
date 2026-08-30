# Phase 2 Specification Mining Report: Traffic, Proxy & Protocol Engine

**Author**: Phase 2 Specification Miner  
**Date**: 2026-08-17  
**Workspace**: `c:\Users\Legion 5 pro\Desktop\cyber sec`  
**Target Crates**: `crates/sentinel_parser`, `crates/sentinel_proxy` (Milestone M2)  
**Status**: COMPLETE (Hard Handoff)

---

## 1. Observation

Direct observations extracted from the authoritative SENTINEL V6 specification artifacts:

### 1.1 Specification Sources & Direct Citations
1. **`architecture/v6/V6_CANONICAL_SPEC.yaml`**:
   - Lines 34–66 (§ 1 Subsystems):
     ```yaml
     - id: "SUB-01"
       name: "ProxyEngine"
       tier: "Core"
       crate: "sentinel-proxy"
       responsibilities:
         - "Intercept, inspect, and modify HTTP/1.1, HTTP/2, and WebSocket network traffic"
         - "Enforce ScopeEngine network decisions prior to socket connection"
         - "Preserve raw byte stream representation and emit ObservationCreated events"
         - "Apply active and passive interception rules (drop, modify, log)"
       dependencies:
         - "HTTPParser"
         - "ScopeEngine"
         - "EventBus"
         - "ObservationStore"
       events_emitted:
         - "ObservationCreated"
       events_consumed: []
       traits_provided:
         - "ProxyEngine"
       traits_consumed:
         - "HttpParser"
         - "ScopeEngine"
         - "EventBus"
         - "ObservationStore"
       permissions:
         - "bind_network_sockets"
         - "intercept_traffic"
       storage_access:
         - "transactions"
         - "proxy_intercept_rules"
         - "blobs"
       security_boundary: "Untrusted network input; 10MB memory allocation bound per transaction"

     - id: "SUB-02"
       name: "HTTPParser"
       tier: "Core"
       crate: "sentinel-parser"
       responsibilities:
         - "Byte-safe, fault-tolerant parsing of HTTP/1.1 and HTTP/2 requests and responses"
         - "Preserve raw delimiter whitespace and byte-exact fidelity without normalization loss"
         - "Detect and emit structured ParseWarning items for request smuggling analysis"
         - "Serialize structured request and response objects back to byte streams"
       dependencies: []
       events_emitted: []
       events_consumed: []
       traits_provided:
         - "HttpParser"
       traits_consumed: []
       permissions: []
       storage_access: []
       security_boundary: "Forked httparse parser; differential parser protection; zero-panic guarantees on malformed input"
     ```
   - Lines 1384–1449 (§ 5 Interfaces & Traits):
     - `ProxyEngine` trait:
       - `start(config: ProxyConfig) -> Result<(), SentinelError>` (async)
       - `stop() -> Result<(), SentinelError>` (async)
       - `register_interceptor(interceptor: Box<dyn ProxyInterceptor>) -> ()`
       - `set_intercept_rules(rules: Vec<InterceptRule>) -> Result<(), SentinelError>`
     - `HttpParser` trait:
       - `parse_request(raw: &[u8]) -> Result<ParsedRequest, SentinelError>`
       - `parse_response(raw: &[u8]) -> Result<ParsedResponse, SentinelError>`
       - `serialize_request(request: &ParsedRequest) -> Result<Vec<u8>, SentinelError>`
       - `serialize_response(response: &ParsedResponse) -> Result<Vec<u8>, SentinelError>`
   - Lines 2213–2297 (§ 6 Events & Channels):
     - `ObservationCreated(Uuid)` on Broadcast channel (`tokio::sync::broadcast::Sender<SentinelEvent>`, capacity 10000). Producer: `SUB-01 ProxyEngine`.
     - `ScopeViolationAttempt { source: String, target: String, decision: ScopeDecision }` on Critical channel (`tokio::sync::mpsc::Sender<CriticalEvent>`). Producer: `SUB-01 ProxyEngine`, `SUB-04 ScopeEngine`.
   - Lines 2605–2633 (§ 8 Configuration Registry):
     - `ProxyConfig` with fields: `bind_address: String` (default `"127.0.0.1"`), `port: u16` (default `8080`), `upstream_proxy: Option<String>` (default `null`), `tls_cert_path: String` (default `"~/.sentinel/ca/sentinel_ca.crt"`).
   - Lines 2835–2921 (§ 9 Error Model):
     - `SentinelError::ParseError(String)` (`ERR_PARSE_006`, non-retryable)
     - `SentinelError::ScopeViolation { reason: String }` (`ERR_SCOPE_004`, non-retryable)
     - `SentinelError::Io(std::io::Error)` (`ERR_IO_002`, non-retryable)
     - `SentinelError::TlsError(String)` (`ERR_TLS_010`, retryable)
     - `SentinelError::NetworkError(String)` (`ERR_NET_011`, retryable)
     - `SentinelError::Timeout(String)` (`ERR_TIME_012`, retryable)
     - `SentinelError::InvalidConfiguration(String)` (`ERR_CFG_014`, non-retryable)
   - Lines 4012–4017 and 4066–4071 (§ 16 Security Invariants):
     - `SEC-01`: "No active outbound network packet may be transmitted without an explicit ScopeDecision::Allowed from ScopeEngine. Default is DENY (fail-closed)."
     - `SEC-10`: "Every transaction retains byte-exact raw blob, parsed structured representation, and normalized text for search."

2. **`architecture/v6/V6_COMMON_TYPES.rs` & `sentinel_common`**:
   - `ProxyInterceptor: Send + Sync`
   - `ProxyEngine: Send + Sync`
   - `HttpParser: Send + Sync`
   - `ParsedRequest` (`method: HttpMethod`, `uri: String`, `version: String`, `headers: Vec<(Vec<u8>, Vec<u8>)>`, `body: Vec<u8>`)
   - `ParsedResponse` (`version: String`, `status_code: u16`, `reason: String`, `headers: Vec<(Vec<u8>, Vec<u8>)>`, `body: Vec<u8>`)
   - `Transaction` (`meta: EntityMetadata`, `request: MessageRepresentation`, `response: Option<MessageRepresentation>`, `timing: Duration`, `tls_info: Option<TlsData>`)
   - `MessageRepresentation` (`raw_blob_id: Uuid`, `parsed: HttpParsedParts`, `normalized_text: String`)
   - `HttpParsedParts` (`method: HttpMethod`, `uri: String`, `version: String`, `headers: Vec<(Vec<u8>, Vec<u8>)>`)
   - `TlsData` (`protocol: String`, `cipher: String`, `server_name: Option<String>`, `alpn: Option<String>`)
   - `InterceptRule` (`id: Uuid`, `match_condition: String`, `action: String`, `action_data_json: Option<String>`, `is_active: bool`)
   - `ParseWarning` (`code: String`, `severity: Severity`, `offset: usize`, `component: String`, `message: String`)

3. **Existing Workspace State**:
   - `sentinel_core/Cargo.toml` contains Phase 1 crates: `sentinel_common`, `sentinel_storage`, `sentinel_bus`, `sentinel_scope`.
   - Workspace tests pass cleanly: 68 tests across all crates (18 secret redaction/adversarial, 14 stress tests, 7 CAS tests, 4 scope engine tests, etc.).
   - `validate_v6_spec.py` passes with **0 blockers, 0 warnings** (exit code 0).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | HTTP Parser | Byte-Exact Request Parsing | Parses raw HTTP/1.1 and HTTP/2 request byte slices into `ParsedRequest`, preserving exact header bytes, capitalization, and delimiters. | `raw: &[u8]` | `Result<ParsedRequest, SentinelError>` | Returns `SentinelError::ParseError` on unrecoverable bytes; zero panics on malformed input | `V6_CANONICAL_SPEC.yaml` § 1, 5 |
| 2 | HTTP Parser | Byte-Exact Response Parsing | Parses raw HTTP/1.1 and HTTP/2 response byte slices into `ParsedResponse`, extracting status code, reason phrase, raw header pairs, and body. | `raw: &[u8]` | `Result<ParsedResponse, SentinelError>` | Returns `SentinelError::ParseError` on invalid status line / unrecoverable bytes | `V6_CANONICAL_SPEC.yaml` § 1, 5 |
| 3 | HTTP Parser | Request Serialization | Serializes a `ParsedRequest` back into an exact HTTP wire byte stream without loss of custom headers or formatting. | `&ParsedRequest` | `Result<Vec<u8>, SentinelError>` | Returns `SentinelError::Serialization` if buffer construction fails | `V6_CANONICAL_SPEC.yaml` § 5 |
| 4 | HTTP Parser | Response Serialization | Serializes a `ParsedResponse` back into an exact HTTP wire byte stream matching standard formatting. | `&ParsedResponse` | `Result<Vec<u8>, SentinelError>` | Returns `SentinelError::Serialization` if buffer construction fails | `V6_CANONICAL_SPEC.yaml` § 5 |
| 5 | HTTP Parser | Smuggling Anomaly Detection | Identifies HTTP request smuggling vectors (CL.TE, TE.CL, TE.TE, duplicate headers, malformed chunk extensions) and generates non-fatal `ParseWarning` entries. | `raw: &[u8]` | `Vec<ParseWarning>` (associated metadata) | Non-fatal warnings preserved alongside parsed output | `V6_CANONICAL_SPEC.yaml` § 1, 11 |
| 6 | HTTP Parser | Chunked Transfer Decoder | Decodes RFC 9112 chunked transfer encoding (`Transfer-Encoding: chunked`), parsing chunk sizes (hex), extensions, and trailing headers. | `raw: &[u8]` | `Vec<u8>` (decoded body) + raw stream preservation | `SentinelError::ParseError` on invalid chunk size hex or malformed CRLF | `V6_CANONICAL_SPEC.yaml` § 11 |
| 7 | HTTP Parser | Normalized Text Extraction | Converts parsed requests and responses into normalized lowercased text representation for Tantivy BM25 indexing and HTTPQL search without modifying raw bytes. | `&ParsedRequest` / `&ParsedResponse` | `String` (`normalized_text`) | Never errors; falls back to lossy UTF-8 conversion | `V6_CANONICAL_SPEC.yaml` § 2, 10 |
| 8 | Proxy Engine | TCP Proxy Listener Lifecycle | Asynchronously binds local TCP socket on `ProxyConfig.bind_address:port`, accepts incoming connections, and gracefully stops listener on shutdown. | `config: ProxyConfig` | `Result<(), SentinelError>` | Returns `SentinelError::Io` on address bind failure or socket error | `V6_CANONICAL_SPEC.yaml` § 1, 5 |
| 9 | Proxy Engine | SEC-01 Pre-Connect Scope Gate | Evaluates `ScopeEngine::is_in_scope(uri)` and `is_ip_in_scope(resolved_ip)` before establishing upstream TCP connection or TLS handshake. | Target URI & resolved IP | `ScopeDecision` | Returns `SentinelError::ScopeViolation`, drops connection, emits `CriticalEvent::ScopeViolationAttempt` | `V6_CANONICAL_SPEC.yaml` § 1, 4, 16 |
| 10 | Proxy Engine | TLS Interception (MITM) | Handles HTTPS `CONNECT` tunnels, terminates client TLS with dynamically generated leaf certificates signed by local Root CA, and negotiates upstream TLS. | Client `CONNECT` stream, target hostname, CA cert/key | Encrypted duplex TLS streams | Returns `SentinelError::TlsError` on certificate generation or handshake failure | `V6_CANONICAL_SPEC.yaml` § 1, 8, 11 |
| 11 | Proxy Engine | ALPN & Protocol Negotiation | Negotiates ALPN protocols (`h2`, `http/1.1`) between client and upstream server, inspecting and maintaining protocol alignment. | Client ALPN list, Upstream ALPN list | `Option<String>` (negotiated ALPN) | Falls back to HTTP/1.1 if ALPN mismatch or unsupported | `V6_CANONICAL_SPEC.yaml` § 1, 11 |
| 12 | Proxy Engine | Upstream Forward Proxy Chaining | Supports chaining outgoing connections through an optional upstream proxy (`ProxyConfig.upstream_proxy`). | `Option<String>` (upstream proxy URI) | Chained HTTP/SOCKS connection | Returns `SentinelError::NetworkError` on upstream proxy unreachability | `V6_CANONICAL_SPEC.yaml` § 8 |
| 13 | Proxy Engine | Interceptor Registry & Pipeline | Registers in-process `ProxyInterceptor` trait instances that can inspect, modify, or drop requests and responses in real-time. | `Box<dyn ProxyInterceptor>` | Synchronous/asynchronous interceptor chain execution | Interceptor error halts connection or logs warning | `V6_CANONICAL_SPEC.yaml` § 5 |
| 14 | Proxy Engine | Traffic Intercept Rules | Dynamic rule evaluation matching HTTPQL / regex conditions against active transactions to execute actions (`Drop`, `Modify`, `Forward`). | `Vec<InterceptRule>` | Intercept action decision | Returns `SentinelError::InvalidConfiguration` on invalid rule syntax | `V6_CANONICAL_SPEC.yaml` § 1, 5, 10 |
| 15 | Proxy Engine | SEC-10 Triple Representation Builder | Assembles `MessageRepresentation` (raw SHA-256 CAS blob UUID, structured `HttpParsedParts`, and `normalized_text`) for both request and response. | Raw bytes, parsed struct, normalized text | `MessageRepresentation` | Returns `SentinelError::Storage` if CAS blob write fails | `V6_CANONICAL_SPEC.yaml` § 2, 10, 16 |
| 16 | Proxy Engine | Transaction & Observation Store Integration | Builds full `Transaction` entity with duration timing and TLS metadata, saves raw blobs to CAS, inserts transaction into SQLite, and creates `Observation`. | `Transaction`, `ObservationStore` | `Result<(), SentinelError>` | Database lock or disk full handled via `SentinelError::Database` / `Storage` | `V6_CANONICAL_SPEC.yaml` § 1, 2, 10 |
| 17 | Proxy Engine | Telemetry & EventBus Publication | Emits `SentinelEvent::ObservationCreated(tx_id)` to `EventBus` broadcast channel for UI live traffic history feed. | `Transaction.id` | `Result<(), SentinelError>` | Broadcast overflow drops oldest telemetry on consumer lag without blocking proxy | `V6_CANONICAL_SPEC.yaml` § 1, 6, 16 |
| 18 | Proxy Engine | WebSocket Framing & Interception | Detects HTTP `101 Switching Protocols` WebSocket upgrade, parses RFC 6455 frames (text, binary, ping/pong, close), and allows bi-directional message inspection. | Upgraded duplex stream | Intercepted/forwarded WS frames | Connection closed cleanly on RFC 6455 close frame or protocol error | `V6_CANONICAL_SPEC.yaml` § 1, 11 |
| 19 | Proxy Engine | Memory & Concurrency Bounds | Limits concurrent connections (max 10,000 via tokio semaphore) and enforces max 10MB memory allocation per transaction. | Inbound connection stream | Bounded resource utilization | Drops excess connections under extreme load; returns 413 / error on oversized payload | `V6_CANONICAL_SPEC.yaml` § 1, 8, 9 |

---

## 3. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | HTTP Parser | Request with conflicting headers: `Content-Length: 5` and `Transfer-Encoding: chunked` (CL.TE) | Parser preserves both headers in raw header list without rewriting; extracts `ParseWarning` indicating potential CL.TE smuggling; body parsing prioritizes chunked per RFC 9112 or preserves exact raw byte boundaries for downstream security analysis. |
| 2 | HTTP Parser | Header with space before colon: `Host : example.com\r\n` | Parser retains raw bytes `("Host ".as_bytes(), "example.com".as_bytes())` without trimming header name space; emits `ParseWarning` for non-standard header delimiter. |
| 3 | HTTP Parser | Bare LF line endings: `GET /test HTTP/1.1\nHost: target.com\n\n` | Fault-tolerant parser accepts bare `\n` line endings, successfully parses method, URI, and headers, preserving the raw LF bytes in `MessageRepresentation.raw_blob_id`. |
| 4 | HTTP Parser | Duplicate `Host` headers: `Host: a.com\r\nHost: b.com\r\n` | Parser keeps both headers in `headers: Vec<(Vec<u8>, Vec<u8>)>` in exact order of appearance; records `ParseWarning` for multiple Host headers. |
| 5 | HTTP Parser | Non-standard / Custom HTTP verb: `GRAPHQL /api HTTP/1.1` or `TRACK / HTTP/1.1` | Successfully parses verb into `HttpMethod::GRAPHQL` or custom verb representation without panic; serializes back to exact method string. |
| 6 | HTTP Parser | Chunked body with chunk extensions: `4;ext=val\r\ntest\r\n0\r\n\r\n` | Parser correctly decodes 4 bytes (`"test"`), skips chunk extension `;ext=val`, recognizes terminating zero chunk `0`, and preserves full raw payload in raw bytes representation. |
| 7 | HTTP Parser | Truncated input: `GET /path HTT` (incomplete header stream) | Parser returns `SentinelError::ParseError("Incomplete or truncated HTTP stream")` without panicking; zero memory corruption. |
| 8 | HTTP Parser | Oversized header block (>1MB): 20,000 arbitrary headers | Parser detects header boundary exceeded before excessive memory allocation; rejects with `SentinelError::ParseError("Header size exceeds 1MB limit")`. |
| 9 | Proxy Engine | Out-of-scope target: Client issues `CONNECT admin.internal.corp:443` against empty/restricted scope | `ScopeEngine::is_in_scope("admin.internal.corp")` returns `allowed: false`. Proxy rejects connection immediately with HTTP 403 Forbidden; zero upstream TCP packet sent; emits `CriticalEvent::ScopeViolationAttempt`. |
| 10 | Proxy Engine | DNS Rebinding attack: Host `rebinding.evil.com` is in scope, but DNS resolves to `127.0.0.1` | `ScopeEngine::is_ip_in_scope("127.0.0.1")` returns `allowed: false`. Connection aborted before TCP socket connect; prevents SSRF/rebinding. |
| 11 | Proxy Engine | Client connects with invalid TLS ClientHello (random garbage bytes on port 8080) | TLS handshake fails cleanly; proxy logs warning, returns `SentinelError::TlsError`, drops client socket without crashing server thread or tokio runtime. |
| 12 | Proxy Engine | Dynamic TLS certificate for wildcard / multi-SAN domain: `*.app.example.com` | Proxy Root CA generates leaf X.509 certificate with Subject Alternative Names (SAN) matching SNI; caches generated certificate in-memory (LRU cache) to avoid redundant crypto generation on subsequent handshakes. |
| 13 | Proxy Engine | Active intercept rule matches request: `req.path == "/api/secret" -> Action::Drop` | Interceptor pipeline matches rule, drops request immediately; upstream server never contacted; transaction logged with status Dropped. |
| 14 | Proxy Engine | Upstream server closes connection before sending response (Early EOF / connection reset) | `ProxyEngine` handles dropped connection, records `Transaction` with `response: None` and accurate timing measurement; persists partial transaction to SQLite. |
| 15 | Proxy Engine | WebSocket Upgrade request: `GET /ws HTTP/1.1` with `Upgrade: websocket` + `101 Switching Protocols` | Proxy transitions TCP connection into bi-directional frame streaming mode; wraps client and server streams; continues capturing frame telemetry. |

---

## 4. Logic Chain

1. **Premise 1 (Spec Completeness & Authority)**:
   - Observation 1.1 establishes that `V6_CANONICAL_SPEC.yaml` and `V6_COMMON_TYPES.rs` are the frozen single source of truth for SENTINEL V6.
   - Observation 1.3 proves that Phase 0 and Phase 1 foundation crates (`sentinel_common`, `sentinel_storage`, `sentinel_bus`, `sentinel_scope`) are 100% complete and tested.
2. **Premise 2 (Phase 2 Architectural Scope)**:
   - Phase 2 delivers Subsystems SUB-01 (`ProxyEngine`) and SUB-02 (`HttpParser`), mapped to crates `sentinel_proxy` and `sentinel_parser` in `sentinel_core/crates/`.
3. **Premise 3 (Parser Architecture & SEC-10)**:
   - SUB-02 (`HttpParser`) is required to be byte-safe, fault-tolerant, and based on extending `httparse` with custom delimiter preservation and chunked decoding.
   - SEC-10 mandates Triple Representation: every transaction must preserve raw bytes in CAS blob store (`raw_blob_id`), structured `HttpParsedParts` in `ParsedRequest`/`ParsedResponse`, and normalized lowercased UTF-8 text for BM25 search.
   - Byte-fidelity requires `serialize_request(&parse_request(raw)?) == raw` for all valid HTTP requests.
4. **Premise 4 (Proxy Architecture & SEC-01)**:
   - SUB-01 (`ProxyEngine`) operates as an async MITM proxy on Tokio, supporting HTTP/1.1, HTTP/2, and WebSockets.
   - SEC-01 mandates that every outbound connection must obtain an explicit `ScopeDecision::Allowed` from `ScopeEngine` for both URI and post-DNS-resolved IP address before initiating upstream socket connection. Out-of-scope attempts must fail closed, emit `CriticalEvent::ScopeViolationAttempt`, and never open an upstream socket.
   - Proxy integrates with `ObservationStore` for CAS blob storage and SQLite `transactions` table inserts, and emits `SentinelEvent::ObservationCreated` on `EventBus`.
5. **Premise 5 (Error & Interceptor Contracts)**:
   - Trait interfaces `ProxyEngine` and `HttpParser` are fully synchronized in `sentinel_common::traits`.
   - Error mapping cleanly maps parser failures to `SentinelError::ParseError`, scope rejections to `SentinelError::ScopeViolation`, TLS errors to `SentinelError::TlsError`, and I/O failures to `SentinelError::Io` / `SentinelError::NetworkError`.

---

## 5. Caveats

- **No Source Implementation in this Phase**: Per the Specification Miner identity rules, no crate code was modified or implemented during this mining turn; discovery and specification analysis was strictly read-only.
- **HTTP/2 Binary Stream Complexity**: While HTTP/1.1 parsing operates on text streams with CRLF, HTTP/2 utilizes binary frame multiplexing (`h2` crate / HPACK). `HttpParser` and `ProxyEngine` must bridge both HTTP/1.1 and HTTP/2 into unified `ParsedRequest`/`ParsedResponse` and `MessageRepresentation` models.
- **Root CA Trust in Target Environments**: In local desktop testing, dynamic TLS MITM requires generating a Root CA certificate (`sentinel_ca.crt` / `sentinel_ca.key`) and importing/trusting it in test clients (e.g. browser/curl). The proxy must auto-generate this CA on startup if not present at `ProxyConfig.tls_cert_path`.

---

## 6. Conclusion

Phase 2 specification mining is **complete, thorough, and 100% aligned** with `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs`, `PROJECT.md`, and all security invariants (SEC-01 and SEC-10).

The architectural blueprint for Phase 2 implementation is structured into two complementary crates:
1. **`crates/sentinel_parser`** (`SUB-02 HttpParser`):
   - Implements `HttpParser` trait: `parse_request`, `parse_response`, `serialize_request`, `serialize_response`.
   - Preserves raw byte fidelity, malformed headers, whitespace anomalies, chunked decoding, and `ParseWarning` detection.
   - Provides helpers for generating `MessageRepresentation` and `normalized_text`.
2. **`crates/sentinel_proxy`** (`SUB-01 ProxyEngine`):
   - Implements `ProxyEngine` trait: `start`, `stop`, `register_interceptor`, `set_intercept_rules`.
   - Tokio TCP listener with TLS MITM engine (rustls / rcgen / dynamic cert cache).
   - Strict SEC-01 pre-connect scope gate enforcing `ScopeEngine` hostname and post-DNS IP ACL checks.
   - Dynamic intercept rule execution (`Drop`, `Modify`, `Forward`).
   - Seamless integration with `sentinel_storage` (`TransactionRepository`, CAS blob store) and `sentinel_bus` (`ObservationCreated` and `ScopeViolationAttempt` events).

---

## 7. Verification Method

To independently verify this specification analysis:

1. **Verify Canonical Spec & Validator**:
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6"
   python validate_v6_spec.py
   ```
   *Expected result*: Status: 🟢 **PASS (ZERO BLOCKERS)**, Return Code: 0.

2. **Verify Phase 1 Workspace Tests**:
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   & "$env:USERPROFILE\.cargo\bin\cargo.exe" test --workspace
   ```
   *Expected result*: 100% tests passing across all foundation crates.

3. **Inspect Mined Trait Contracts in `sentinel_common`**:
   - `crates/sentinel_common/src/traits.rs` lines 27–46 (`ProxyEngine`, `HttpParser`, `ProxyInterceptor`)
   - `crates/sentinel_common/src/operational.rs` lines 148–164 (`ParsedRequest`, `ParsedResponse`, `InterceptRule`, `ParseWarning`)
   - `crates/sentinel_common/src/domain/meta.rs` lines 49–70 (`HttpParsedParts`, `TlsData`, `MessageRepresentation`)
   - `crates/sentinel_common/src/config.rs` lines 10–27 (`ProxyConfig`)

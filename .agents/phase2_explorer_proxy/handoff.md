# Phase 2 Investigation Report: Traffic, Proxy & Protocol Engine (`sentinel_proxy`)

## 1. Observation

Direct examination of the workspace code and canonical specifications reveals the following architectural contracts and constraints:

### 1.1 Existing Subsystem Traits & Interfaces
In `crates/sentinel_common/src/traits.rs`:
```rust
// SUB-01 ProxyEngine & Interceptor
pub trait ProxyInterceptor: Send + Sync {}

#[async_trait]
pub trait ProxyEngine: Send + Sync {
    async fn start(&self, config: ProxyConfig) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    fn register_interceptor(&mut self, interceptor: Box<dyn ProxyInterceptor>);
    fn set_intercept_rules(&mut self, rules: Vec<InterceptRule>) -> Result<(), SentinelError>;
}
```

### 1.2 Event Registry & Security Telemetry
In `crates/sentinel_common/src/events.rs`:
- **Broadcast Telemetry**: `SentinelEvent::ObservationCreated(Uuid)` on topic `telemetry.observation` (Subsystem `SUB-03 ObservationStore`).
- **Durable Critical Audits**: `CriticalEvent::ScopeViolationAttempt { source: String, target: String, decision: ScopeDecision }` on topic `audit.scope.violation` (Subsystem `SUB-04 ScopeEngine`).

### 1.3 Error Hierarchy
In `crates/sentinel_common/src/errors.rs`:
- `SentinelError::ScopeViolation { reason: String }` (code `ERR_SCOPE_004`, non-retryable).
- `SentinelError::TlsError(String)` (code `ERR_TLS_010`, retryable).
- `SentinelError::NetworkError(String)` (code `ERR_NET_011`, retryable).
- `SentinelError::ParseError(String)` (code `ERR_PARSE_006`, non-retryable).
- `SentinelError::InvariantViolation(String)` (code `ERR_INVAR_009`, non-retryable).

### 1.4 Domain Entities & Metadata
In `crates/sentinel_common/src/domain/core.rs` and `meta.rs`:
- `Transaction`: contains `EntityMetadata`, `request: MessageRepresentation`, `response: Option<MessageRepresentation>`, `timing: Duration`, `tls_info: Option<TlsData>`.
- `Observation`: contains `EntityMetadata`, `source: ObservationSource::Proxy`, `data_ref: Uuid` (referencing `Transaction.meta.id`).
- `MessageRepresentation`: contains `raw_blob_id: Uuid` (CAS SHA-256 reference), `parsed: HttpParsedParts` (`method`, `uri`, `version`, `headers`), and `normalized_text: String`.
- `TlsData`: contains `protocol: String` (e.g. `"TLSv1.3"`), `cipher: String`, `server_name: Option<String>`, `alpn: Option<String>`.

### 1.5 Configuration Registry
In `crates/sentinel_common/src/config.rs`:
- `ProxyConfig`: `bind_address: String` (`"127.0.0.1"`), `port: u16` (`8080`), `upstream_proxy: Option<String>`, `tls_cert_path: String` (`"ca/sentinel_ca.crt"`).

### 1.6 Security Invariants
Per `architecture/v6/V6_FINAL_SECURITY_INVARIANTS.md`:
- **SEC-01 (Scope Authorization - Default Deny)**: Every outbound network interaction must obtain an explicit `ScopeDecision` from `ScopeEngine` prior to socket connection. Out-of-scope targets trigger immediate `ScopeViolationAttempt` critical event and connection rejection.
- **SEC-07 (Evidence Immutability)**: Raw transaction payloads must be stored in CAS SHA-256 blob store (`sentinel_storage::cas::BlobStorage`) with strict verification.
- **SEC-10 (Triple Representation)**: Network traffic must retain raw bytes, parsed structure, and normalized text without loss.
- **SEC-12 (Bounded Buffer Backpressure)**: Dual-path event bus with non-blocking broadcast for telemetry and bounded mpsc for critical events.

### 1.7 Performance Specification
Per `architecture/v6/V6_FINAL_PERFORMANCE_SPECIFICATION.md`:
- **Proxy Pass-Through**: 2,000 req/sec minimum, 5,000 req/sec expected.
- **Proxy Burst (No DB)**: 5,000 req/sec minimum, 10,000 req/sec expected.
- **Added Latency**: <5ms added latency.
- **Scope Resolution**: <1ms execution time.

---

## 2. Logic Chain

The investigation traces the end-to-end design for `crates/sentinel_proxy` across 11 key architectural steps:

```
+----------------------------------------------------------------------------------------------------+
|                                     SENTINEL PROXY ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    Client (Browser / Script / Pentest Tool)                                                        |
|         │                                                                                          |
|         ▼ [TCP Connection]                                                                         |
|    +───────────────────────────────────────────────────────────+                                   |
|    | ProxyServer (Tokio TCP Listener: 127.0.0.1:8080)          |                                   |
|    +───────────────────────────────────────────────────────────+                                   |
|         │                                                                                          |
|         ├──────────────────────────────────┬─────────────────────────────────┐                     |
|         ▼                                  ▼                                 ▼                     |
|  [CONNECT target:443]               [Plain HTTP Request]             [Upgrade: websocket]          |
|         │                                  │                                 │                     |
|         ▼                                  ▼                                 ▼                     |
|  +─────────────────────────────────────────────────────────────────────────────────────────+       |
|  | SEC-01 Scope Gate: ScopeEngine::is_in_scope(&target_uri)                                |       |
|  |  ├─ DENIED ──► Emit CriticalEvent::ScopeViolationAttempt ──► HTTP 403 Forbidden        |       |
|  |  └─ ALLOWED ──► Proceed to TLS Handshake / Pipeline                                     |       |
|  +─────────────────────────────────────────────────────────────────────────────────────────+       |
|         │                                  │                                 │                     |
|         ▼                                  │                                 │                     |
|  +─────────────────────────────────────+   │                                 │                     |
|  | Dynamic TLS Termination & Cert Forging | │                                 │                     |
|  |  - Sentinel Root CA (ECDSA/RSA)     |   │                                 │                     |
|  |  - On-The-Fly Leaf Cert (rcgen)     |   │                                 │                     |
|  |  - ServerConfig LRU Cache (<0.05ms) |   │                                 │                     |
|  +─────────────────────────────────────+   │                                 │                     |
|         │ (Decrypted HTTP/1.1 or H2)       │                                 │                     |
|         ├──────────────────────────────────┘                                 │                     |
|         ▼                                                                    │                     |
|  +─────────────────────────────────────────────────────────────────────+     │                     |
|  | Interceptor Pipeline (Request Stage)                                |     │                     |
|  |  - Builtin: ScopeCheck, AuthInjector                                |     │                     |
|  |  - RuleEvaluator (Pre-compiled InterceptRule regex/conditions)      |     │                     |
|  |  - Custom Interceptors (AsyncProxyInterceptor)                      |     │                     |
|  |  - Actions: Continue, Modify, Drop, RespondWith                     |     │                     |
|  +─────────────────────────────────────────────────────────────────────+     │                     |
|         │                                                                    │                     |
|         ▼                                                                    │                     |
|  +─────────────────────────────────────────────────────────────────────+     │                     |
|  | Upstream Connection & Forwarding (Client Pool / HTTP/1.1 / H2)      |     │                     |
|  +─────────────────────────────────────────────────────────────────────+     │                     |
|         │                                                                    │                     |
|         ▼                                                                    │                     |
|  +─────────────────────────────────────────────────────────────────────+     │                     |
|  | Interceptor Pipeline (Response Stage)                               |     │                     |
|  |  - RuleEvaluator / Custom Interceptors                              |     │                     |
|  +─────────────────────────────────────────────────────────────────────+     │                     |
|         │                                                                    ▼                     |
|         ├───────────────────────────────────────────────────────► [WebSocket Tapping]              |
|         ▼                                                                    │                     |
|    Client Receives Response                                                  ▼                     |
|                                                                    +──────────────────────+        |
|                                                                    | Background Recorder  |        |
|                                                                    |  - CAS Put (SHA-256) |        |
|                                                                    |  - SQLite WAL Insert |        |
|                                                                    |  - EventBus Broadcast|        |
|                                                                    +──────────────────────+        |
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Core Engine Lifecycle & Trait Compliance
The proxy engine implementation (`ProxyEngineImpl`) manages an asynchronous runtime lifecycle:
- `start(config: ProxyConfig) -> Result<(), SentinelError>`:
  1. Validates `config.bind_address` and `config.port`.
  2. Initializes/loads Root CA certificate and private key from `config.tls_cert_path`.
  3. Pre-allocates LRU certificate cache, upstream connection pool, and persistence channel.
  4. Binds `tokio::net::TcpListener`.
  5. Spawns an asynchronous accept loop with `tokio_util::sync::CancellationToken` for graceful shutdown.
- `stop() -> Result<(), SentinelError>`:
  1. Triggers cancellation token.
  2. Awaits draining of active client connections with configurable timeout (e.g. 5 seconds).
  3. Flushes recorder/persistence queue.
- `register_interceptor(&mut self, interceptor: Box<dyn ProxyInterceptor>)`:
  Appends interceptor to pipeline.
- `set_intercept_rules(&mut self, rules: Vec<InterceptRule>) -> Result<(), SentinelError>`:
  Compiles conditions into high-speed matchers and atomically swaps rule set (`ArcSwap<Vec<CompiledInterceptRule>>`).

### 2.2 Dual Mode Async Listener & Protocol Demuxing
A single port (e.g. 8080) handles both standard forward proxying and HTTPS CONNECT tunneling:
1. **Connection Intake**: Each client TCP socket is passed to `handle_connection(stream, state)`.
2. **Initial Header Inspection**: Reads up to 4096 bytes without consuming the stream (or using buffered parsing) to extract the HTTP request line.
3. **Branching**:
   - **`CONNECT host:port HTTP/1.1`**:
     - Extract host and port (e.g. `api.target.com:443`).
     - Execute SEC-01 scope validation against `format!("https://{}", authority)`.
     - Send `HTTP/1.1 200 Connection Established\r\n\r\n` to client.
     - Wrap client socket in `tokio_rustls::TlsAcceptor` using dynamic forged certificate for `api.target.com`.
     - Perform TLS handshake with upstream `api.target.com:443` using `tokio_rustls::TlsConnector`.
     - Demux decrypted stream into HTTP/1.1 or HTTP/2 frames.
   - **Plain HTTP (`GET http://...` or `GET /path` with `Host` header)**:
     - Parse request using `HttpParser`.
     - Execute SEC-01 scope validation against destination URL.
     - Execute Request Interceptor pipeline.
     - Forward to upstream, receive response, execute Response Interceptor pipeline, return to client.
   - **WebSocket Upgrade (`Upgrade: websocket`)**:
     - Handle HTTP 101 Switching Protocols.
     - Hand over stream to `WebSocketTapper` for bidirectional frame inspection.

### 2.3 Dynamic TLS CA Generation & On-The-Fly Certificate Forging
To intercept HTTPS traffic transparently without triggering client-side validation errors after the Sentinel CA is installed:
1. **Root CA Generation (`ca.rs`)**:
   - Uses `rcgen::CertificateParams` to create a self-signed X.509 Root CA.
   - Sets `is_ca: true`, `key_usages: [KeyCertSign, CRLSign]`, `basic_constraints: BasicConstraints::Unconstrained`.
   - Uses ECDSA P-256 (`rcgen::PKCS_ECDSA_P256_SHA256`) for sub-millisecond key generation and signing.
   - Saves `sentinel_ca.crt` (PEM) and `sentinel_ca.key` (PEM) to disk if not already present.
2. **Leaf Certificate Forging (`cert_gen.rs`)**:
   - For incoming SNI (e.g. `sub.example.com`):
   - Sets Subject Common Name: `sub.example.com`.
   - Adds Subject Alternative Names (SANs): `DNS:sub.example.com`, wildcard `DNS:*.example.com`, or `IP:<address>` if IP target.
   - Signs leaf certificate with the Sentinel Root CA private key.
   - Validity: short-lived (e.g. 7 days or 30 days) to prevent stale cert accumulation.
3. **ServerConfig LRU Cache (`cache.rs`)**:
   - Generating a certificate takes ~0.5ms-1.0ms. Repeating this for every connection to the same domain degrades throughput.
   - An in-memory LRU cache (`dashmap::DashMap<String, Arc<rustls::ServerConfig>>` or `parking_lot::RwLock<LruCache>`) caches the ready-to-use `Arc<rustls::ServerConfig>`.
   - Cache hit latency is reduced to **<0.05ms**, unlocking 10k+ handshakes/sec on warm domains.
4. **Upstream TLS Client (`upstream/client.rs`)**:
   - Uses `rustls::ClientConfig` with Mozilla root certificates (`webpki-roots`).
   - Configurable `insecure_skip_verify: bool` for testing staging/internal servers with invalid or self-signed certs.
   - Supports ALPN negotiation (`h2`, `http/1.1`).

### 2.4 SEC-01 Scope Enforcement & Critical Telemetry
Scope validation is strictly enforced before any outbound socket connection is established:
```rust
// Evaluate scope
let target_uri = format!("https://{}", authority);
let decision = scope_engine.is_in_scope(&target_uri);

if !decision.allowed {
    // 1. SEC-01 / SEC-12: Emit durable critical audit event
    let crit_event = CriticalEvent::ScopeViolationAttempt {
        source: "ProxyEngine".to_string(),
        target: target_uri.clone(),
        decision: decision.clone(),
    };
    let _ = event_bus.publish_critical(crit_event);

    // 2. Reject connection with HTTP 403
    let response_body = serde_json::json!({
        "error": "Scope Violation (SEC-01)",
        "target": target_uri,
        "reason": decision.reason,
        "policy": "DEFAULT_DENY"
    }).to_string();

    let forbidden = format!(
        "HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        response_body.len(),
        response_body
    );
    let _ = client_stream.write_all(forbidden.as_bytes()).await;
    return Err(SentinelError::ScopeViolation { reason: decision.reason });
}
```

### 2.5 Interceptor Pipeline & Rule Engine
The pipeline allows inspection, modification, drop, and rule evaluation at each phase:

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum InterceptAction {
    Continue,
    Modified,
    Drop { reason: String },
    RespondWith(ParsedResponse),
}

#[async_trait]
pub trait AsyncProxyInterceptor: Send + Sync {
    async fn on_request(
        &self,
        req: &mut ParsedRequest,
        ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        Ok(InterceptAction::Continue)
    }

    async fn on_response(
        &self,
        req: &ParsedRequest,
        res: &mut ParsedResponse,
        ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        Ok(InterceptAction::Continue)
    }

    async fn on_ws_frame(
        &self,
        frame: &mut WsFrame,
        ctx: &RequestContext,
    ) -> Result<InterceptAction, SentinelError> {
        Ok(InterceptAction::Continue)
    }
}
```

#### Rule Evaluation Engine (`pipeline/rules.rs`):
- Compiles `InterceptRule` objects with matchers:
  - `url_regex`, `url_prefix`, `url_contains`
  - `method == "POST" | "GET" | ...`
  - `header[name] == value | contains value`
  - `body contains pattern`
  - `status_code == 200`
- Supports actions:
  - `Drop`: drop connection immediately.
  - `ReplaceHeader(name, value)`: replace or add header.
  - `RemoveHeader(name)`: strip header.
  - `ReplaceBody(regex, replacement)`: body rewrite.
  - `Break`: hold request for manual user inspection/edit in UI (Repeater / Intercept tab).

### 2.6 Dual-Write Persistence (SEC-07, SEC-10, SEC-12)
To record all proxy traffic without violating the <5ms added latency constraint:
1. **Decoupled Architecture**:
   - The proxy handler completes the request/response cycle and returns the response immediately to the client.
   - It clones the raw bytes and parsed structures into a lightweight `PendingRecord` struct.
   - It sends `PendingRecord` over a bounded `tokio::sync::mpsc::channel(10_000)` to a dedicated `PersistenceWorker`.
2. **Persistence Worker Pipeline**:
   - **Step 1 (CAS Write)**: Writes raw request bytes and raw response bytes to `BlobStorage` (`cas.put(&raw_req)`, `cas.put(&raw_res)`). Obtains SHA-256 descriptor and `raw_blob_id`.
   - **Step 2 (Triple Representation)**: Constructs `MessageRepresentation` containing `raw_blob_id`, `parsed: HttpParsedParts`, and `normalized_text`.
   - **Step 3 (SQLite Transaction)**: Inserts `Transaction` into SQLite WAL database via `TransactionRepository`.
   - **Step 4 (Observation Store)**: Inserts `Observation` referencing the transaction into SQLite.
   - **Step 5 (EventBus Telemetry)**: Emits `SentinelEvent::ObservationCreated(obs.meta.id)` via `event_bus.publish_telemetry()`.
3. **Batching**: Persistence worker batches SQLite insertions (`insert_batch`) every 50ms or every 100 items for sustained >5,000 writes/sec without lock contention.

### 2.7 WebSocket Framing & Tapping
- Supports WebSocket upgrades (`RFC 6455`).
- Inspects client-to-server and server-to-client frames (Text, Binary, Close, Ping, Pong).
- Records WebSocket session metadata and individual frame payloads to CAS.
- Emits WebSocket telemetry updates.

### 2.8 Upstream Connection Management & Keep-Alive Pooling
- High proxy latency is predominantly caused by repeated TCP 3-way handshakes and TLS handshakes to upstream servers.
- `UpstreamConnectionPool` maintains active, keep-alive HTTP/1.1 connections and multiplexed HTTP/2 client connections to upstream origins.
- Reusing established TLS tunnels drops upstream request latency from 35ms down to **<2ms**.

### 2.9 Performance Optimization Strategy (5k req/s & <5ms Added Latency)
| Optimization | Mechanism | Latency Impact |
|---|---|---|
| **TLS ServerConfig Cache** | LRU cache storing pre-compiled `rustls::ServerConfig` | -0.8ms per HTTPS connection |
| **Upstream Connection Pool** | Keep-alive socket pool for upstream origins | -20ms to -40ms per request |
| **Async Persistence Worker** | Bounded mpsc queue with micro-batched SQLite WAL writes | 0ms added to client response |
| **Zero-Copy Byte Slicing** | `bytes::Bytes` / `bytes::BytesMut` buffer management | Eliminates memory copy overhead |
| **Pre-Compiled Rule Matchers** | Regexes compiled once upon rule update (`ArcSwap`) | <0.01ms per rule evaluation |
| **Fast-Path Pass-Through** | Direct streaming when no body modification rules match | Sustained >10,000 req/sec |

---

## 3. Caveats

1. **HTTP/2 Multiplexing & Stream Mapping**:
   - HTTP/2 multiplexes multiple streams over a single TCP connection. When intercepting HTTP/2, each stream must be mapped to an independent `Transaction` lifecycle with unique stream IDs, while sharing the underlying TLS session.
2. **WebSocket Compression (`permessage-deflate`)**:
   - WebSocket frames compressed with `permessage-deflate` must be decompressed before text inspection/rule evaluation, and recompressed if modified.
3. **Root CA Installation Requirement**:
   - Transparent HTTPS interception requires the client (browser, curl, OS) to trust the generated Sentinel Root CA (`sentinel_ca.crt`). The crate must provide a clean export API (`ca::export_root_ca_pem()`) and CLI helper.
4. **Large File Streaming**:
   - For multi-gigabyte downloads, the proxy must stream chunks directly to the client without accumulating the entire payload in RAM, spooling to CAS in streaming chunks if full capture is enabled.

---

## 4. Conclusion & Recommended Concrete Layout

The recommended architecture for `crates/sentinel_proxy` fulfills all V6 canonical specifications, interface contracts, security invariants (SEC-01, SEC-07, SEC-10, SEC-12), and performance targets.

### 4.1 Crate File Tree
```
crates/sentinel_proxy/
├── Cargo.toml
├── src/
│   ├── lib.rs                  # Crate exports, ProxyEngine trait impl facade
│   ├── error.rs                # Proxy-specific error types mapping to SentinelError
│   ├── config.rs               # ProxyConfig extensions and tuning parameters
│   ├── engine.rs               # ProxyEngine struct implementing sentinel_common::ProxyEngine
│   ├── server.rs               # Async Tokio TCP listener and client connection dispatcher
│   ├── connection.rs           # Client & upstream socket wrappers (HTTP/1.1, CONNECT, H2)
│   ├── handler.rs              # Request/response transaction handler & lifecycle coordinator
│   ├── recorder.rs             # Dual-write persistence worker (CAS + SQLite) & EventBus telemetry
│   ├── websocket.rs            # WebSocket framing, upgrade, and bidirectional tapper
│   ├── pipeline/
│   │   ├── mod.rs              # Interceptor pipeline orchestrator
│   │   ├── interceptor.rs      # AsyncProxyInterceptor trait, InterceptAction, RequestContext
│   │   ├── rules.rs            # InterceptRule evaluation engine & compiled matchers
│   │   └── builtin.rs          # Builtin interceptors (ScopeGate, AuthInjector, TimingRecorder)
│   ├── tls/
│   │   ├── mod.rs              # TLS subsystem facade
│   │   ├── ca.rs               # Root CA generation, storage, and export
│   │   ├── cert_gen.rs         # On-the-fly leaf certificate forging via rcgen
│   │   └── cache.rs            # ServerConfig LRU cache
│   └── upstream/
│       ├── mod.rs              # Upstream communication facade
│       ├── client.rs           # Upstream HTTP/1.1 and HTTP/2 client
│       └── pool.rs             # Upstream TCP/TLS connection pooling & keep-alive
├── tests/
│   ├── common/
│   │   ├── mod.rs              # Test helpers and environment setup
│   │   └── mock_server.rs      # HTTP/1.1, HTTP/2, and TLS mock upstream servers
│   ├── forward_proxy_test.rs   # Plain HTTP forward proxying integration tests
│   ├── connect_mitm_test.rs    # HTTPS CONNECT MITM & TLS certificate forging tests
│   ├── scope_enforcement_test.rs # SEC-01 default-deny & violation telemetry tests
│   ├── interceptor_test.rs     # Pipeline modification, drop, and rule evaluation tests
│   ├── dual_write_test.rs      # CAS + SQLite + EventBus verification tests
│   └── websocket_test.rs       # WebSocket tunnel & frame inspection tests
└── benches/
    └── proxy_throughput.rs     # Criterion benchmarks for 5k req/s & <5ms latency
```

### 4.2 Required Dependencies for `crates/sentinel_proxy/Cargo.toml`
```toml
[package]
name = "sentinel_proxy"
version.workspace = true
edition.workspace = true
authors.workspace = true
license.workspace = true

[dependencies]
sentinel_common = { path = "../sentinel_common" }
sentinel_storage = { path = "../sentinel_storage" }
sentinel_bus = { path = "../sentinel_bus" }
sentinel_scope = { path = "../sentinel_scope" }
sentinel_parser = { path = "../sentinel_parser" }

tokio = { workspace = true, features = ["full"] }
tokio-util = { version = "0.7.12", features = ["sync"] }
tokio-rustls = "0.26.0"
rustls = { version = "0.23.12", default-features = false, features = ["std", "ring"] }
rcgen = { version = "0.13.1", features = ["pem", "x509-parser"] }
webpki-roots = "0.26.3"
bytes = "1.7.1"
http = "1.1.0"
httparse = "1.9.4"
h2 = "0.4.6"
tokio-tungstenite = "0.23.1"
async-trait = { workspace = true }
tracing = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
uuid = { workspace = true }
chrono = { workspace = true }
url = { workspace = true }
regex = "1.10.6"
arc-swap = "1.7.1"
dashmap = "6.1.0"
lru = "0.12.4"

[dev-dependencies]
tempfile = { workspace = true }
reqwest = { version = "0.12.7", features = ["rustls-tls", "socks", "cookies"], default-features = false }
criterion = { version = "0.5.1", features = ["async_tokio"] }
```

---

## 5. Verification Method

To independently verify the `sentinel_proxy` implementation once built, execute the following commands and integration test suites:

### 5.1 Compilation & Linting
```bash
cargo check --workspace --locked
cargo fmt --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

### 5.2 Test Execution
```bash
cargo test -p sentinel_proxy --all-targets --locked
```

### 5.3 Test Suite Coverage Verification Matrix
1. **Scope Enforcement Test (`scope_enforcement_test.rs`)**:
   - Spin up `ProxyEngine` with Scope containing `["*.target.com"]`.
   - Send `CONNECT malicious.com:443 HTTP/1.1` -> Assert HTTP 403 Forbidden received.
   - Assert `CriticalEvent::ScopeViolationAttempt` is published on `EventBus`.
   - Assert no upstream TCP socket was ever opened to `malicious.com`.
2. **HTTPS CONNECT MITM & Forged Certs (`connect_mitm_test.rs`)**:
   - Spin up mock HTTPS server on `127.0.0.1:<port>` with test certificate.
   - Configure `ProxyEngine` with mock server in scope.
   - Client sends `CONNECT 127.0.0.1:<port>` through proxy.
   - Client validates that the served leaf certificate is signed by Sentinel Root CA and matches SAN `127.0.0.1`.
   - Client sends `GET /secure` -> Receives expected mock response.
3. **Interceptor Modification & Drop Test (`interceptor_test.rs`)**:
   - Register test interceptor that appends header `X-Sentinel-Intercept: active` and drops requests containing `X-Drop-Me: 1`.
   - Send regular request -> Verify header is injected upstream.
   - Send drop request -> Verify proxy returns 502/400 and does not contact upstream.
4. **Dual-Write Persistence Test (`dual_write_test.rs`)**:
   - Send 100 HTTP transactions through proxy.
   - Query `SqliteObservationStore` -> Verify 100 `Transaction` records and 100 `Observation` records exist.
   - Verify raw bytes in `BlobStorage` (CAS) match SHA-256 hash descriptors with 100% byte fidelity.
   - Verify 100 `SentinelEvent::ObservationCreated` events received on `EventBus` telemetry broadcast.
5. **Criterion Benchmark (`benches/proxy_throughput.rs`)**:
   - Run `cargo bench -p sentinel_proxy`.
   - Verify sustained throughput >= 5,000 req/sec on localhost loopback with <5ms added latency.

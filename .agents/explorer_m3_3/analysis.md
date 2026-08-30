# SENTINEL V6 — Advanced Testing Engines Investigation Report (Domains 9, 10, 11)
**Milestone**: M3 — Advanced Testing Engines (Sections 7–22)  
**Agent**: Explorer 3 (`explorer_m3_3`)  
**Target Subsystems**:
- **Domain 9**: Out-of-Band (OAST) & Browser Security Engine (`sentinel_oast`, `sentinel_browser`)
- **Domain 10**: API Security Engine (`sentinel_api`, `sentinel_authz`, `sentinel_fuzzer`)
- **Domain 11**: Business Logic & State Modeling Engine (`sentinel_logic`, `sentinel_authz`)

---

## 1. Executive Summary & Audit Matrix

This investigation rigorously audits the backend Rust crates in `sentinel_core/crates/` and frontend workspace modules in `src/` to determine the exact capabilities, code locations, gaps, and implementation blueprints for Security Engine Domains 9, 10, and 11.

### Capability Status Overview

| Domain | Subsystem / Feature | Backend Crate / Module | Current Status | Test Coverage | Key Gaps |
|---|---|---|---|---|---|
| **9. OAST & Browser** | Stateless AES-256 Encrypted Tokens | `sentinel_oast::token` | **SCAFFOLDING** | `test_oast_token_generator` | Generates random UUID v4 prefix `oast_<hex>`. No AES-256-GCM AEAD encryption, no metadata packing (project/task/param IDs), no stateless decryption. |
| **9. OAST & Browser** | Multi-Protocol Callback Correlation | `sentinel_oast::server` | **PARTIAL** | `test_oast_server_lifecycle_and_callback_recording` | In-memory `HashMap` token mapping. Missing raw DNS/HTTP/SMTP packet listeners, protocol decoding, and automated correlation with scan findings. |
| **9. OAST & Browser** | Headless Browser Automation | `sentinel_browser::service` | **MOCK / STUB** | `test_browser_service_lifecycle_and_cas_screenshot` | Returns hardcoded HTML & 1x1 PNG bytes. Lacks real Chrome DevTools Protocol (CDP) / Playwright daemon bridge. |
| **9. OAST & Browser** | DOM XSS Source-to-Sink Telemetry | `sentinel_browser::dom` | **UNIMPLEMENTED** | Naive HTML string search | `DomExtractor` only searches `<title>`, `<script>`, `href=`. Zero JavaScript runtime sink hooks (`eval`, `innerHTML`, `document.write`), zero taint tracking. |
| **9. OAST & Browser** | Service & Web Worker Inspection | `sentinel_browser` | **UNIMPLEMENTED** | None | No worker registration inspection, cache inspection, or `postMessage` listener analysis. |
| **10. API Security** | REST Fuzzing & BOLA / IDOR Detection | `sentinel_api`, `sentinel_authz` | **PARTIAL** | Route parsing & static matrix unit tests | Lacks automated REST parameter fuzzing and cross-tenant object ID substitution engine. |
| **10. API Security** | OpenAPI 3.0/3.1 Parser & Spec Fuzzing | `sentinel_api::openapi` | **PARTIAL** | `test_openapi_spec_parsing` | JSON path/method extraction only. Lacks YAML support, schema/type constraints, requestBody dissection, and spec-driven payload generator. |
| **10. API Security** | GraphQL Schema & Depth / Batching | `sentinel_api::graphql` | **SCAFFOLDING** | `test_graphql_query_analysis` | Introspection query string + naive `{}` depth counter. Lacks AST schema reconstruction, array/alias batching probers, and circular query generator. |
| **10. API Security** | WebSocket Tampering & CSWSH | `sentinel_api::websocket` | **PARTIAL** | `test_websocket_frame_parsing` | RFC 6455 frame parser implemented. Lacks message tampering/mutation prober, continuous stream fuzzing, and CSWSH origin testing. |
| **10. API Security** | gRPC Protobuf Testing | `sentinel_api` | **UNIMPLEMENTED** | None | No `.proto` schema ingestion, no gRPC reflection prober, no protobuf wire serializer/mutator. |
| **11. Business Logic** | Multi-Actor State Transition Modeling | `sentinel_logic::state_machine` | **SCAFFOLDING** | `test_state_machine_transitions` | Single-actor string transitions (`(from, to)`). Lacks multi-actor roles, action parameters, preconditions, postconditions, and invariant proofs. |
| **11. Business Logic** | Privilege Differential Matrix (Autorize) | `sentinel_authz::matrix`, `sentinel_authz::engine` | **PARTIAL** | `test_authz_matrix_generation_and_evaluation` | In-memory evaluation of mock endpoints. Lacks live multi-session replay engine, header injection, and response divergence scoring. |
| **11. Business Logic** | Workflow Bypass & Race Testing | `sentinel_logic::workflow`, `sentinel_logic::race` | **PARTIAL** | `test_barrier_synchronized_race_condition` | Step recording (`WorkflowEngine`) & Tokio barrier prober exist. Lacks automated step-skipping test generator, business parameter mutators, and HTTP/2 single-packet sync. |

---

## 2. Domain 9: Out-of-Band (OAST) & Browser Security Engine

### 2.1 Component Architecture & Existing Implementation

#### 1. Token Generation (`sentinel_oast/src/token.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_oast\src\token.rs`
- **Current Struct**: `OastTokenGenerator`
- **Current Logic**:
  ```rust
  pub fn generate() -> (String, Uuid) {
      let token_id = Uuid::new_v4();
      let hex_str = token_id.simple().to_string();
      let token_str = format!("oast_{}", &hex_str[..16]);
      (token_str, token_id)
  }
  ```
- **Limitations**:
  - Token is purely a random UUID hex slice (`oast_<16_hex>`).
  - No cryptographic encryption or authentication.
  - Requires the server to maintain a stateful `token_map: HashMap<String, Uuid>` in memory.
  - If server restarts or callbacks arrive out-of-order on external nodes, mapping is lost.

#### 2. OAST Server & Interaction Logging (`sentinel_oast/src/server.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_oast\src\server.rs`
- **Current Struct**: `DefaultOastServer`
  - `is_running: Arc<RwLock<bool>>`
  - `token_map: Arc<RwLock<HashMap<String, Uuid>>>`
  - `interactions: Arc<RwLock<HashMap<Uuid, Vec<OastInteraction>>>>`
  - `storage: Option<Arc<SqliteObservationStore>>`
- **Methods**:
  - `start() -> Result<(), SentinelError>`
  - `stop() -> Result<(), SentinelError>`
  - `generate_token() -> Result<String, SentinelError>`
  - `record_interaction(token, protocol, source_ip, raw_data) -> Result<Uuid, SentinelError>`
  - `poll_interactions(token) -> Result<Vec<OastInteraction>, SentinelError>`
- **Limitations**:
  - Purely in-memory polling and registration.
  - No network protocol listeners (no UDP/TCP port 53 DNS listener, no HTTP/HTTPS callback listener, no SMTP listener).
  - No protocol decoders (e.g. parsing DNS QNAME, HTTP paths/headers, SMTP envelopes).

#### 3. Browser Service & Automation (`sentinel_browser/src/service.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_browser\src\service.rs`
- **Current Struct**: `DefaultBrowserService`
  - `scope_engine: Option<Arc<DefaultScopeEngine>>`
  - `storage: Option<Arc<SqliteObservationStore>>`
  - `current_url: Arc<RwLock<String>>`
  - `current_dom: Arc<RwLock<String>>`
  - `is_closed: Arc<RwLock<bool>>`
- **Methods**:
  - `navigate(url)`: Enforces `ScopeEngine::is_in_scope(url)` (SEC-01), then sets a dummy DOM string.
  - `execute_script(js)`: Evaluates string checks for `document.title` and `1+1`, returns `"undefined"` otherwise.
  - `capture_dom()`: Returns `current_dom`.
  - `take_screenshot(full_page)`: Returns hardcoded 1x1 PNG bytes (`[0x89, 0x50, 0x4E, 0x47, ...]`) and stores in CAS.
- **Limitations**:
  - Does not connect to a real headless Chromium instance via Chrome DevTools Protocol (CDP) or Playwright daemon.
  - Script execution is completely mocked.

#### 4. DOM Element Extraction (`sentinel_browser/src/dom.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_browser\src\dom.rs`
- **Current Structs**: `FormElement`, `DomSnapshot`, `DomExtractor`
- **Current Logic**:
  - String searching for `<title>`, `href="`, `<script>`, and a hardcoded mock `<form action="/login">`.
- **Limitations**:
  - Not an HTML5 AST parser; fails on malformed HTML, dynamic JavaScript rendering, Shadow DOM, or canvas elements.
  - Zero DOM XSS source-sink taint analysis or telemetry instrumentation.
  - Zero Service Worker or Web Worker inspection.

---

## 3. Domain 10: API Security Engine

### 3.1 Component Architecture & Existing Implementation

#### 1. OpenAPI Parser (`sentinel_api/src/openapi.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_api\src\openapi.rs`
- **Current Struct**: `OpenApiParser`
- **Methods**: `parse_spec(spec_json: &str) -> Result<Vec<PRoute>, SentinelError>`
- **Current Logic**:
  - Parses JSON using `serde_json::Value`.
  - Iterates over `paths -> path -> methods -> parameters -> name`.
  - Emits `PRoute { path_template, method, expected_params }`.
- **Limitations**:
  - Fails on YAML specs (only parses JSON).
  - Ignores OpenAPI 3.0/3.1 `requestBody` schemas (`content.application/json.schema`).
  - Ignores schema types, formats (e.g. `int32`, `uuid`, `email`), min/max bounds, regex patterns, enums, required properties, `$ref` component definitions.
  - Cannot generate spec-driven fuzzing requests or negative test cases (e.g. schema boundary violations, missing required fields, type mutation, mass assignment property injection).

#### 2. GraphQL Engine (`sentinel_api/src/graphql.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_api\src\graphql.rs`
- **Current Struct**: `GraphQlEngine`
- **Methods**:
  - `generate_introspection_query() -> &'static str`: Returns static JSON string for standard introspection query.
  - `calculate_query_depth(query: &str) -> usize`: Counts `{` and `}` characters.
  - `is_introspection_enabled(response_body: &str) -> bool`: Checks if body contains `"__schema"` and `"queryType"`.
- **Limitations**:
  - Depth calculation is broken by curly braces in string literals, comments, or argument variables (e.g. `{ user(filter: "{name}") { id } }`).
  - No GraphQL AST parser.
  - No GraphQL schema reconstruction from introspection JSON to full Schema Definition Language (SDL) / type hierarchy.
  - No batching attack prober:
    - Array batching: `[{"query":"..."}, {"query":"..."}]`
    - Alias batching: `{ a: user(id: 1) { email }, b: user(id: 2) { email } }`
  - No circular query generator or field complexity cost calculator.

#### 3. WebSocket Parser (`sentinel_api/src/websocket.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_api\src\websocket.rs`
- **Current Enums/Structs**: `WsOpcode`, `WsFrame { fin, opcode, payload }`, `WebSocketParser`
- **Methods**: `parse_frame(data: &[u8]) -> Result<WsFrame, SentinelError>`
- **Current Logic**:
  - Full RFC 6455 binary frame decoding (FIN, Opcode, Masking key, 7-bit / 16-bit / 64-bit payload lengths, XOR unmasking).
- **Limitations**:
  - Decoding only; lacks frame serialization/masking encoder for outbound message synthesis.
  - No message tampering or mutation fuzzing prober.
  - No Cross-Site WebSocket Hijacking (CSWSH) origin validation tester.

#### 4. gRPC Subsystem
- **Current Status**: Completely missing in `sentinel_api`.
- **Requirements**:
  - Protobuf wire-format parser/encoder.
  - gRPC Server Reflection prober (`grpc.reflection.v1alpha.ServerReflection`).
  - Protobuf payload mutator for fuzzing gRPC endpoints.

---

## 4. Domain 11: Business Logic & State Modeling Engine

### 4.1 Component Architecture & Existing Implementation

#### 1. State Machine Engine (`sentinel_logic/src/state_machine.rs`)
- **File**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_logic\src\state_machine.rs`
- **Current Structs**: `StateTransition { from, to, action }`, `StateMachineEngine`
- **Methods**:
  - `new(initial_state: &str)`
  - `add_allowed_transition(from, to)`
  - `current_state() -> &str`
  - `transition(next_state) -> Result<(), SentinelError>`
- **Limitations**:
  - Represents single-actor, string-only state transitions.
  - Cannot model multi-actor states (e.g. Buyer vs Seller vs Admin).
  - No guard conditions, state variables, or business rule invariants (e.g. `balance >= amount`, `item.stock > 0`).

#### 2. Authorization Matrix & Differential Evaluator (`sentinel_authz/src/matrix.rs`, `src/engine.rs`)
- **Files**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_authz\src\matrix.rs`, `src/engine.rs`
- **Current Structs**: `MatrixEvaluator`, `DefaultAuthorizationEngine`
- **Methods**:
  - `generate_default_matrix(identities, endpoints) -> AuthzMatrix`
  - `evaluate_violations(matrix) -> Vec<AuthzViolation>`
  - `test_matrix(matrix) -> Result<Vec<AuthzViolation>, SentinelError>`
- **Current Logic**:
  - Compares `expected: HashMap<Uuid, AccessLevel>` against `actual: HashMap<Uuid, AccessLevel>`.
  - Flags violation if Admin endpoint is accessed by Anonymous/User, or TenantA accessed by TenantB.
- **Limitations**:
  - Static evaluation over pre-computed `AccessLevel` enums.
  - Lacks an active multi-session differential replay engine (replaying recorded HTTP requests across different session cookies/tokens, computing response body similarity and status codes, and classifying BOLA/IDOR/BFLA dynamically).

#### 3. Workflow Engine & Race Condition Prober (`sentinel_logic/src/workflow.rs`, `src/race.rs`)
- **Files**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\crates\sentinel_logic\src\workflow.rs`, `src/race.rs`
- **Current Structs**: `WorkflowEngine`, `RaceConditionProber`
- **Methods**:
  - `WorkflowEngine::record_step(action_type, params) -> Uuid`
  - `WorkflowEngine::export_workflow(name) -> Result<Workflow, SentinelError>`
  - `RaceConditionProber::execute_race_test<F, Fut, T>(concurrency, action) -> Result<Vec<T>, SentinelError>` (uses `tokio::sync::Barrier`)
- **Limitations**:
  - Workflow recording is basic parameter logging; lacks automatic permutation generation for step-skipping attacks (e.g. Cart -> Confirm without Payment).
  - Lacks business logic parameter mutators (negative pricing, integer wrap, currency tampering).
  - Race condition prober uses standard async Tokio barrier; lacks HTTP/2 single-packet synchronization (holding last frame byte across multiplexed streams and releasing in a single TCP packet).

---

## 5. Specific Gaps & Worker Implementation Blueprints

### 5.1 Domain 9: Out-of-Band (OAST) & Browser Security Engine

#### GAP 9.1: Stateless AES-256-GCM Encrypted OAST Tokens
- **Target File**: `sentinel_core/crates/sentinel_oast/src/token.rs`
- **Requirement**:
  - Replace naive UUID slicing with stateless AES-256-GCM encrypted payload tokens.
  - Token payload structure:
    ```rust
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct OastTokenPayload {
        pub project_id: Uuid,
        pub scan_id: Option<Uuid>,
        pub endpoint_id: Option<Uuid>,
        pub param_name: Option<String>,
        pub created_at: i64,
        pub nonce: [u8; 12],
    }
    ```
  - `OastTokenManager` struct holding a master 256-bit AES key (`[u8; 32]`).
  - `generate_token(&self, payload: &OastTokenPayload) -> Result<String, SentinelError>`:
    - Encrypts payload using AES-256-GCM with a random 12-byte IV/nonce.
    - Encodes ciphertext + tag as base32/hex subdomain string (e.g. `oast-<base32_payload>.<oast_domain>`).
  - `decrypt_token(&self, token_str: &str) -> Result<OastTokenPayload, SentinelError>`:
    - Extracts ciphertext, decrypts with master key, verifies AEAD tag and expiration.
    - Enables completely stateless callback correlation across distributed listeners.

#### GAP 9.2: Multi-Protocol Callback Parser & Correlation Engine
- **Target File**: `sentinel_core/crates/sentinel_oast/src/server.rs`, `sentinel_oast/src/protocol.rs` (new module)
- **Requirement**:
  - Implement protocol decoders for incoming callback interactions:
    - **DNS Callback Decoder**: Parses DNS queries (extracting QNAME, Query Type `A`/`AAAA`/`TXT`/`CNAME`, client IP).
    - **HTTP/HTTPS Callback Decoder**: Parses request method, path, headers (Host, User-Agent, Referer), query parameters, and raw body.
    - **SMTP Callback Decoder**: Parses SMTP session transcript (`HELO`/`EHLO`, `MAIL FROM`, `RCPT TO`, `DATA` headers/body).
  - Implement `OastCorrelationEngine`:
    - Receives decoded interaction, extracts token string from DNS query / HTTP path / SMTP data.
    - Decrypts token via `OastTokenManager` to retrieve `project_id`, `endpoint_id`, `param_name`.
    - Commits raw callback bytes to Content-Addressable Storage (CAS `ObservationStore`).
    - Emits `CriticalEvent::FindingCreated` / updates Finding with Tier 3 OAST Evidence.

#### GAP 9.3: Headless Browser CDP / Playwright Protocol Engine
- **Target File**: `sentinel_core/crates/sentinel_browser/src/service.rs`, `sentinel_browser/src/cdp.rs` (new module)
- **Requirement**:
  - Implement structured Chrome DevTools Protocol (CDP) client interface / daemon message handler.
  - Real methods for:
    - `Page.navigate`: Navigates to target URL, monitors network lifecycle (`DOMContentLoaded`, `networkidle`).
    - `Runtime.evaluate`: Evaluates JavaScript expressions within the page's isolated JavaScript execution context.
    - `DOM.getDocument` & `DOMSnapshot.captureSnapshot`: Captures full DOM tree including Shadow DOM elements and computed styles.
    - `Page.captureScreenshot`: Generates PNG screenshot bytes, hashes SHA-256, stores in CAS.

#### GAP 9.4: DOM XSS Source-to-Sink Telemetry Instrumentation
- **Target File**: `sentinel_core/crates/sentinel_browser/src/dom_telemetry.rs` (new module)
- **Requirement**:
  - Injectable JavaScript instrumentation script hooking dangerous DOM sinks:
    - **Execution Sinks**: `eval`, `Function`, `setTimeout`, `setInterval`, `script.src`, `script.text`, `script.innerHTML`.
    - **DOM Injection Sinks**: `element.innerHTML`, `element.outerHTML`, `document.write`, `document.writeln`, `element.insertAdjacentHTML`.
    - **Navigation Sinks**: `location.href`, `location.replace`, `location.assign`, `window.open`.
  - Taint tracking from sources: `location.search`, `location.hash`, `location.pathname`, `document.cookie`, `document.referrer`, `window.name`, `localStorage`, `sessionStorage`, `postMessage`.
  - Telemetry event emitter: when a sink receives tainted input, captures callstack, sink name, tainted argument value, and emits telemetry to backend for Tier 4 DOM Execution Proof.

#### GAP 9.5: Service Worker & Web Worker Inspection
- **Target File**: `sentinel_core/crates/sentinel_browser/src/workers.rs` (new module)
- **Requirement**:
  - Inspect `navigator.serviceWorker.getRegistrations()`, Web Workers, and Shared Workers.
  - Extract worker script URLs, scope bounds, active cache storage keys (`caches.keys()`), push event handlers, and `postMessage` event listeners.
  - Detect insecure worker patterns: cross-origin script import (`importScripts`), unvalidated `postMessage` handlers, persistent cache poisoning.

---

### 5.2 Domain 10: API Security Engine

#### GAP 10.1: OpenAPI 3.0/3.1 Full Schema Parser & Spec-Driven Fuzzing
- **Target File**: `sentinel_core/crates/sentinel_api/src/openapi.rs`
- **Requirement**:
  - Ingest both JSON and YAML OpenAPI 3.0 / 3.1 specifications.
  - Parse complete route definitions, request bodies (`content.application/json.schema`), and component schemas (`#/components/schemas/...`).
  - Spec-Driven Fuzzing Payload Generator:
    - **Type Boundary Mutation**: String injection in integer fields, float in boolean, integer overflow (`2^63 - 1`).
    - **Required Property Omission**: Omits mandatory JSON fields to test backend validation.
    - **Mass Assignment / Property Injection**: Automatically injects administrative properties (`"isAdmin": true`, `"role": "admin"`, `"verified": true`, `"permissions": ["*"]`).
    - **Method Tampering**: Tests unlisted HTTP methods (`PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`, `TRACE`).

#### GAP 10.2: GraphQL AST Schema Reconstruction & Advanced Attack Probers
- **Target File**: `sentinel_core/crates/sentinel_api/src/graphql.rs`
- **Requirement**:
  - **Schema Reconstruction Engine**:
    - Parses full introspection response JSON (`__schema`).
    - Reconstructs GraphQL Schema Definition Language (SDL), mapping all Types, Interfaces, Unions, Input Objects, Fields, Arguments, Directives, and Deprecated status.
  - **Query Complexity & Depth Calculator**:
    - Parses GraphQL query string using AST lexer/parser.
    - Accurately computes nesting depth (ignoring string literals/comments) and weighted field complexity score.
  - **Batching Attack Probers**:
    - **Array Batching Prober**: Generates array payloads `[{"query":"..."}, ...]` to test batch execution and bypass rate limits.
    - **Alias Batching Prober**: Generates alias-packed queries `{ a1: mutation{...}, a2: mutation{...} }` to test multi-operation execution in a single HTTP POST.
  - **Circular Query DoS Generator**:
    - Traverses schema graph to find recursive cycles (e.g. `User -> Post -> User`).
    - Generates deeply nested queries of depth $N \ge 20$ to test server depth limit enforcement.

#### GAP 10.3: WebSocket Message Tampering & CSWSH Prober
- **Target File**: `sentinel_core/crates/sentinel_api/src/websocket.rs`
- **Requirement**:
  - Implement bidirectional RFC 6455 encoder (`encode_frame(frame: &WsFrame, mask: bool) -> Vec<u8>`).
  - **Message Tampering Engine**:
    - Mutates JSON/text WebSocket payloads (parameter fuzzing, command injection, XSS payloads inside WS messages).
  - **Cross-Site WebSocket Hijacking (CSWSH) Prober**:
    - Simulates WebSocket upgrade handshake with spoofed `Origin: https://attacker.evil.com`.
    - Asserts whether server accepts upgrade (101 Switching Protocols) and begins streaming authenticated user data without CSRF/Origin validation.

#### GAP 10.4: gRPC Protobuf Testing Engine
- **Target File**: `sentinel_core/crates/sentinel_api/src/grpc.rs` (new module)
- **Requirement**:
  - Ingest `.proto` files or execute gRPC Server Reflection queries.
  - Parse Protobuf wire format (Varint, 64-bit, Length-delimited, 32-bit fields).
  - Mutate Protobuf message fields: unknown tag injection, type mismatch, large length-delimited buffer overflow, boundary value fuzzing.
  - Encode mutated messages into standard gRPC HTTP/2 framing (1-byte compression flag + 4-byte message length header).

---

### 5.3 Domain 11: Business Logic & State Modeling Engine

#### GAP 11.1: Multi-Actor State Transition Engine & Invariant Validator
- **Target File**: `sentinel_core/crates/sentinel_logic/src/state_machine.rs`
- **Requirement**:
  - Support multi-actor roles:
    ```rust
    #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub enum ActorRole {
        Admin,
        Merchant,
        User(String), // tenant/user id
        Anonymous,
    }
    ```
  - State definition with typed context variables (e.g. `cart_total`, `payment_status`, `items_count`).
  - Preconditions and Postconditions on transitions:
    ```rust
    pub struct GuardedTransition {
        pub from_state: String,
        pub to_state: String,
        pub action: String,
        pub required_role: ActorRole,
        pub precondition: fn(&StateContext) -> bool,
        pub postcondition: fn(&mut StateContext),
    }
    ```
  - Automated Invariant Checker: Explores reachable state space and asserts whether an unauthorized actor can reach a privileged state (e.g. `Anonymous` reaching `OrderFulfilled`).

#### GAP 11.2: Multi-Session Privilege Differential Matrix (Autorize-Style Replay)
- **Target File**: `sentinel_core/crates/sentinel_authz/src/matrix.rs`, `sentinel_authz/src/differential.rs` (new module)
- **Requirement**:
  - Live Multi-Session Replay Engine:
    - Ingests a baseline transaction executed by a privileged role (e.g. Admin).
    - Automatically executes three clone requests swapping authentication headers/cookies:
      1. **Low-Privilege User** (Alice / Tenant A)
      2. **Cross-Tenant Peer User** (Bob / Tenant B)
      3. **Unauthenticated / Guest** (No auth headers)
    - Compares responses across:
      - HTTP status codes ($200$ vs $401$ vs $403$)
      - Body length delta ($|\Delta \text{len}|$)
      - Structural JSON AST similarity
      - Sensitive keyword reflection (e.g. presence of Admin's private email/SSN in Alice's response)
    - Automatically classifies:
      - `BOLA`: Tenant B accesses Tenant A's private resource with 200 OK + matching data structure.
      - `BFLA`: Low-privilege user executes administrative function with 200 OK.
      - `ENFORCED`: Requests rejected with 401/403.
    - Generates Tier 5 Differential Identity Proof linked to CAS.

#### GAP 11.3: Workflow Bypass & Single-Packet Synchronized Race Engine
- **Target File**: `sentinel_core/crates/sentinel_logic/src/workflow.rs`, `sentinel_logic/src/race.rs`
- **Requirement**:
  - **Automated Workflow Step-Skipping Generator**:
    - Takes recorded workflow $S = [s_1, s_2, s_3, \dots, s_n]$.
    - Generates skip permutations (e.g. $[s_1, s_3, \dots, s_n]$ omitting $s_2$, or jumping straight from $s_1$ to $s_n$).
    - Replays mutated workflow and checks if downstream action succeeds (e.g. Order Confirmation without Payment).
  - **Business Logic Parameter Mutators**:
    - Negative value injection: `quantity = -1`, `amount = -100.00`.
    - Decimal precision overflow: `price = 0.00000001`.
    - Currency / Unit swapping: `currency = "JPY"` while paying `USD` amounts.
  - **HTTP/2 Single-Packet Synchronized Race Prober**:
    - Opens multiplexed HTTP/2 streams over a single TLS connection.
    - Sends headers and all data bytes *except* the final frame byte for $N=20..50$ streams.
    - Releases all final bytes simultaneously in a single TCP packet using `TCP_NODELAY` socket barrier synchronization.
    - Verifies TOCTOU race flaws (e.g. multi-spend, double coupon redemption).

---

## 6. Verification & Test Strategy for M3 Worker

To achieve 100% test pass rate and quality gate certification, the Worker agent must implement and verify the following test suites:

### 1. Domain 9 (OAST & Browser) Test Matrix
- `test_stateless_aes256_oast_token_encryption_decryption`:
  - Generate token with metadata (`project_id`, `endpoint_id`, `param_name`, `timestamp`).
  - Decrypt token and verify identical metadata recovery.
  - Tamper with 1 byte of token and verify AEAD decryption failure.
- `test_multi_protocol_callback_correlation`:
  - Simulate DNS query for encrypted token subdomain -> decrypt token -> correlate with mock candidate finding -> verify Tier 3 evidence created.
  - Simulate HTTP GET callback with query param -> verify CAS storage of raw request.
- `test_dom_xss_sink_telemetry`:
  - Run DOM telemetry script with simulated tainted `location.hash` into `innerHTML` -> verify callstack and sink capture.
- `test_service_worker_inspection`:
  - Enumerate mock service worker registrations and extract cache storage keys.

### 2. Domain 10 (API Security) Test Matrix
- `test_openapi_spec_driven_fuzzing`:
  - Ingest complex OpenAPI 3.0 spec (JSON & YAML) with nested schemas and request bodies.
  - Generate spec-driven boundary mutations and mass assignment payloads.
- `test_graphql_schema_reconstruction_and_batching`:
  - Reconstruct full SDL from introspection JSON.
  - Calculate exact query depth and verify array/alias batching queries.
  - Generate circular query and assert recursion depth limit.
- `test_websocket_tampering_and_cswsh`:
  - Encode and decode masked/unmasked RFC 6455 frames.
  - Execute CSWSH probe and detect missing origin validation.
- `test_grpc_protobuf_testing`:
  - Parse protobuf schema and generate type-aware mutated wire payloads.

### 3. Domain 11 (Business Logic & State Modeling) Test Matrix
- `test_multi_actor_state_machine_invariants`:
  - Define multi-actor e-commerce state machine (Buyer, Merchant, Admin).
  - Assert that Buyer cannot transition directly from `Cart` to `Fulfilled`.
- `test_privilege_differential_matrix_autorize`:
  - Replay transaction across Admin, Tenant A, Tenant B, Guest.
  - Verify BOLA detection when Tenant B accesses Tenant A object, and BFLA detection when Tenant A accesses Admin endpoint.
- `test_workflow_step_skipping_and_race_condition`:
  - Replay workflow with skipped payment step and detect bypass.
  - Execute HTTP/2 barrier race test and verify concurrency synchronization.

---

## 7. Recommended Implementation Sequence

```
1. crates/sentinel_oast/
   ├── token.rs: Add AES-256-GCM stateless token encryption & decryption
   ├── protocol.rs (new): Add DNS, HTTP, SMTP callback decoders
   └── server.rs: Wire stateless correlation with CAS storage and finding emitter

2. crates/sentinel_browser/
   ├── dom_telemetry.rs (new): DOM XSS source-to-sink telemetry & taint tracking
   ├── workers.rs (new): Service Worker & Web Worker inspection
   └── service.rs: Structured CDP / Playwright bridge interface

3. crates/sentinel_api/
   ├── openapi.rs: OpenAPI 3.0/3.1 YAML/JSON parser & spec-driven payload generator
   ├── graphql.rs: AST schema reconstruction, query depth, array/alias batching, circular DoS
   ├── websocket.rs: Frame encoder, message tampering, CSWSH tester
   └── grpc.rs (new): Protobuf parser, wire serializer, gRPC reflection prober

4. crates/sentinel_authz/
   ├── matrix.rs: Multi-session differential comparison engine (Admin vs User vs TenantB vs Guest)
   └── differential.rs (new): Response divergence & BOLA/IDOR/BFLA classifier

5. crates/sentinel_logic/
   ├── state_machine.rs: Multi-actor state model & invariant checker
   ├── workflow.rs: Step-skipping permutation generator & business parameter mutator
   └── race.rs: HTTP/2 single-packet synchronization engine
```

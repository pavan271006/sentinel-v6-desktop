# Golden Path Vertical Slice Dataflow Analysis (Stages 1–9)

**Author:** `explorer_phase1_goldenpath` (Teamwork Explorer)  
**Date:** 2026-08-23  
**Status:** COMPLETE  
**Workspace Root:** `c:\Users\Legion 5 pro\Desktop\cyber sec`  

---

## 1. Observation

A direct code-level investigation of `sentinel_core/crates/` (29 workspace crates), `src-tauri/src/`, and `architecture/v6/` was conducted to trace and map all 9 stages of the unbroken Golden Path vertical slice dataflow.

### Summary Table of Vertical Slice Stages & Code Mapping

| Stage | Subsystem | Primary Crates / Modules | Key Files & Line Numbers | Key Traits & Structs | Status |
|---|---|---|---|---|---|
| **1** | **Headless Chromium CDP / Browser** | `sentinel_browser` | `crates/sentinel_browser/src/service.rs:14–134`<br>`crates/sentinel_browser/src/crawler.rs:13–160`<br>`crates/sentinel_browser/src/dom_telemetry.rs:11–105` | `BrowserService`, `DefaultBrowserService`, `AutonomousCrawlerEngine`, `DomTaintTracker` | **Scaffold / Partial** (Mock DOM fallback, needs active CDP bridge) |
| **2** | **Interception Proxy & Scope Gate** | `sentinel_proxy`<br>`sentinel_scope` | `crates/sentinel_proxy/src/engine.rs:35–225`<br>`crates/sentinel_proxy/src/handler.rs:43–481`<br>`crates/sentinel_proxy/src/recorder.rs:27–154`<br>`crates/sentinel_scope/src/engine.rs:1–150` | `ProxyEngine`, `SentinelProxyEngine`, `HandlerState`, `PersistenceRecorder`, `ScopeEngine`, `DefaultScopeEngine` | **Production Real** (SEC-01 fail-closed gate, TLS MITM, dual-write) |
| **3** | **Tokio Event Bus** | `sentinel_bus` | `crates/sentinel_bus/src/bus.rs:59–268`<br>`crates/sentinel_bus/src/broadcast.rs:1–120`<br>`crates/sentinel_bus/src/critical.rs:1–140`<br>`crates/sentinel_bus/src/envelope.rs:1–60` | `EventBus`, `SentinelEventBus`, `TelemetryBroadcastChannel`, `CriticalDeliveryChannel`, `EventEnvelope<T>` | **Production Real** (Two-tier, SEC-12 bounded backpressure) |
| **4** | **Dual Storage (WAL + CAS)** | `sentinel_storage` | `crates/sentinel_storage/src/cas.rs:14–186`<br>`crates/sentinel_storage/src/db.rs:29–138`<br>`crates/sentinel_storage/src/store.rs:24–267`<br>`crates/sentinel_storage/src/project.rs:1–120` | `BlobStorage`, `BlobDescriptor`, `SqliteObservationStore`, `ProjectStorage`, `ObservationStore` | **Production Real** (32 tables, WAL SQLite, SHA-256 CAS, SEC-07) |
| **5** | **Tauri UI Event Stream & IPC** | `src-tauri`<br>`architecture/v6` | `src-tauri/src/main.rs:1–78`<br>`src-tauri/src/state.rs:83–175`<br>`src-tauri/src/commands.rs:1–1648`<br>`architecture/v6/V6_IPC_CONTRACTS.proto:1–195` | `AppState`, `AppStatus`, `ScopeResponse`, Tauri commands (`cmd_traffic_*`, `cmd_repeater_*`, etc.) | **Partial / Scaffolding** (Tauri commands present; background stream & real backend binding pending) |
| **6** | **HTTPQL Query Filter** | `sentinel_httpql` | `crates/sentinel_httpql/src/lib.rs:1–43`<br>`crates/sentinel_httpql/src/ast.rs:5–129`<br>`crates/sentinel_httpql/src/evaluator.rs:44–274`<br>`crates/sentinel_httpql/src/compiler.rs:1–180` | `Expression`, `Evaluator`, `EvalContext`, `SqlCompiler`, `CompiledSqlQuery` | **Production Real** (AST parser, in-memory evaluator, SQLite WHERE compiler) |
| **7** | **Repeater Socket Execution** | `sentinel_repeater` | `crates/sentinel_repeater/src/executor.rs:31–549`<br>`crates/sentinel_repeater/src/variables.rs:10–98`<br>`crates/sentinel_repeater/src/diff.rs:1–120` | `RepeaterExecutor`, `ExecutionOutput`, `VariableEnvironment`, `ResponseDiff`, `RaceExecutionSummary` | **Production Real** (Plain/TLS replay, barrier race sync, CAS persistence) |
| **8** | **Deterministic Oracle Verification** | `sentinel_verification` | `crates/sentinel_verification/src/engine.rs:27–272`<br>`crates/sentinel_verification/src/strategies.rs:1–180`<br>`crates/sentinel_verification/src/lifecycle.rs:6–39`<br>`crates/sentinel_verification/src/differential.rs:1–220` | `VerificationEngine`, `DefaultVerificationEngine`, `StrategyEvaluator`, `FindingLifecycleManager`, `DifferentialEngine` | **Production Real** (SEC-06 deterministic oracles, 10-state lifecycle) |
| **9** | **CAS Merkle Proof Chain** | `sentinel_storage`<br>`research/theory_lab` | `research/theory_lab/causal_evidence_engine/causal_engine.py:18–123`<br>`crates/sentinel_storage/src/cas.rs:48–180`<br>`crates/sentinel_common/src/domain/core.rs:58–89` | `CausalEvidenceEngine`, `ProofSubgraph`, `BlobStorage::compute_sha256`, `Evidence`, `EvidenceVariant` | **Prototyped in Theory Lab; Native Rust Crate Wiring Needed** |

---

## 2. Logic Chain: The 9-Stage Golden Path Vertical Slice

```
+-----------------------------------------------------------------------------------------------+
|                                  THE UNBROKEN GOLDEN PATH                                     |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
|  [Stage 1: Browser/CDP]        [Stage 2: Proxy & Scope Gate]       [Stage 3: Tokio Event Bus] |
|  +--------------------+        +---------------------------+       +------------------------+ |
|  | Headless Chromium  | -----> | ProxyEngine (MITM TLS)    | ----> | SentinelEventBus       | |
|  | Katana Crawler /   |        | Pre-socket SEC-01 Scope   |       | - Telemetry Broadcast  | |
|  | DOM Taint Tracker  |        | PersistenceRecorder       |       | - Critical WAL Queue   | |
|  +--------------------+        +---------------------------+       +------------------------+ |
|                                              |                                   |            |
|                                              v                                   v            |
|                                [Stage 4: Dual Storage]             [Stage 5: Tauri UI Stream] |
|                                +---------------------+             +------------------------+ |
|                                | SQLite WAL (.db)    |             | Tauri IPC Bridge       | |
|                                | SHA-256 CAS (.blob) | <---------> | V6_IPC_CONTRACTS.proto | |
|                                +---------------------+             +------------------------+ |
|                                              |                                   |            |
|                                              v                                   v            |
|                                [Stage 6: HTTPQL Filter]            [Stage 7: Repeater Replay] |
|                                +----------------------+            +------------------------+ |
|                                | Pest AST / Parser    | ---------> | Variable Interpolation | |
|                                | Stream & SQL Eval    |            | Raw Plain/TLS Socket   | |
|                                +----------------------+            +------------------------+ |
|                                                                                  |            |
|                                                                                  v            |
|                                                                    [Stage 8: SEC-06 Oracles]  |
|                                                                    +------------------------+ |
|                                                                    | Deterministic Verifier | |
|                                                                    | 10-State Finding FSM   | |
|                                                                    +------------------------+ |
|                                                                                  |            |
|                                                                                  v            |
|                                                                    [Stage 9: Merkle Proof]   |
|                                                                    +------------------------+ |
|                                                                    | CAS SHA-256 Blob Proof | |
|                                                                    | Merkle Root Chain      | |
|                                                                    +------------------------+ |
+-----------------------------------------------------------------------------------------------+
```

### Stage-by-Stage Forensic Trace & Evidence

#### Stage 1: Headless Chromium CDP (`sentinel_browser` / Playwright Daemon)
- **Source Files:**
  - `sentinel_core/crates/sentinel_browser/src/service.rs` (Lines 14–134)
  - `sentinel_core/crates/sentinel_browser/src/crawler.rs` (Lines 36–160)
  - `sentinel_core/crates/sentinel_browser/src/dom_telemetry.rs` (Lines 28–105)
  - `sentinel_core/crates/sentinel_browser/src/dom.rs` (Lines 18–70)
  - `sentinel_core/crates/sentinel_browser/src/workers.rs` (Lines 27–66)
  - `architecture/v6/V6_IPC_CONTRACTS.proto` (Lines 27–86)
- **Mechanism:**
  - `DefaultBrowserService` implements `BrowserService` trait. It checks SEC-01 scope prior to navigation (`scope.is_in_scope(url)` at line 67).
  - Screenshots are pushed directly to CAS storage (`storage.cas().put(&png_bytes)` at line 124).
  - `AutonomousCrawlerEngine` executes breadth-first discovery of forms and links bounded by `CrawlerConfig::allowed_domain` (lines 107–158).
  - `DomTaintTracker` generates JavaScript telemetry stubs hooking `eval`, `document.write`, and `innerHTML` with canary token correlation (lines 31–76).
- **Integration Gap:** `DefaultBrowserService` provides static mock fallbacks when no live Chromium CDP or Playwright process is attached. To complete the Golden Path live testbed run, a native CDP WebSocket client or gRPC Playwright daemon transport must be connected.

#### Stage 2: Interception Proxy (`sentinel_proxy`) with SEC-01 Fail-Closed Scope Gate (`sentinel_scope`)
- **Source Files:**
  - `sentinel_core/crates/sentinel_proxy/src/engine.rs` (Lines 35–225)
  - `sentinel_core/crates/sentinel_proxy/src/handler.rs` (Lines 43–481)
  - `sentinel_core/crates/sentinel_proxy/src/recorder.rs` (Lines 38–154)
  - `sentinel_core/crates/sentinel_proxy/src/tls/ca.rs` & `cache.rs`
  - `sentinel_core/crates/sentinel_scope/src/engine.rs` (Lines 1–150)
- **Mechanism:**
  - In `handler.rs`, both CONNECT tunnels (`handle_connect_tunnel`, line 87) and plain HTTP (`handle_plain_http`, line 273) invoke `verify_scope_and_audit(&state, &target_uri, &target_host)`.
  - If out of scope or targeting restricted CIDRs (e.g. AWS metadata `169.254.169.254` / RFC1918), `verify_scope_and_audit` emits `CriticalEvent::ScopeViolationAttempt` over `state.event_bus` (line 402) and returns HTTP 403 Forbidden with `{"error": "Scope Violation (SEC-01)", "policy": "DEFAULT_DENY"}` (lines 421–443).
  - For in-scope traffic, TLS is dynamically terminated using dynamically generated leaf certificates from `RootCA`, and the raw request/response is handed off to `PersistenceRecorder::record` (line 71).
- **Integration Gap:** None in HTTP/1.1 core. HTTP/3 QUIC (`quinn`) pipeline is planned for V6.1 extension.

#### Stage 3: Tokio Event Bus (`sentinel_bus` / Broadcast Channels)
- **Source Files:**
  - `sentinel_core/crates/sentinel_bus/src/bus.rs` (Lines 59–268)
  - `sentinel_core/crates/sentinel_bus/src/broadcast.rs` (Lines 1–120)
  - `sentinel_core/crates/sentinel_bus/src/critical.rs` (Lines 1–140)
  - `sentinel_core/crates/sentinel_bus/src/envelope.rs` (Lines 1–60)
- **Mechanism:**
  - Dual-channel architecture:
    1. **Telemetry Channel:** High-throughput `tokio::sync::broadcast` ring buffer (default capacity 10,000) for ephemeral UI events (`SentinelEvent::ObservationCreated`, `ObservationUpdated`). Non-blocking with monotonic sequence tracking (lines 228–232).
    2. **Critical Channel:** Lossless `tokio::sync::mpsc` queue (default capacity 1,000) for security events (`CriticalEvent::ScopeViolationAttempt`, `FindingCreated`, `CandidateVerified`). Direct flush and SQLite WAL audit logging (`AuditRepository`, lines 87–100).
- **Integration Gap:** `src-tauri` must spawn an async background task listening on `SentinelEventBus::subscribe_telemetry()` and `subscribe_critical()` to push live events to the React desktop frontend via Tauri window emission.

#### Stage 4: Dual Storage (`sentinel_storage` - SQLite WAL Database + SHA-256 CAS Blob Store)
- **Source Files:**
  - `sentinel_core/crates/sentinel_storage/src/cas.rs` (Lines 14–186)
  - `sentinel_core/crates/sentinel_storage/src/db.rs` (Lines 29–138)
  - `sentinel_core/crates/sentinel_storage/src/store.rs` (Lines 24–267)
  - `sentinel_core/crates/sentinel_storage/src/project.rs` (Lines 1–120)
- **Mechanism:**
  - **CAS Storage (SEC-07):** `BlobStorage` stores payloads at `<project_dir>/blobs/{sha256[0:2]}/{sha256}.blob`. Write path uses `.tmp_{sha256}_{uuid}.blob` atomic renaming. Read path (`get_verified`, line 126) recalculates SHA-256 and errors with `SentinelError::InvariantViolation` upon mismatch.
  - **SQLite WAL (SEC-17):** Connection pool enforces `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`, and `cache_size = -64000` (64MB) via `enforce_pragmas` (lines 57–89).
  - **Triple Representation (SEC-10):** `PersistenceRecorder` writes raw bytes to CAS, extracts structured AST parts (`HttpParsedParts`), and indexes normalized text (`build_normalized_request_text`).
- **Integration Gap:** Full production code exists. `src-tauri` commands need to bind to `active_project_storage` instead of stub fixtures.

#### Stage 5: Tauri UI Event Stream (`src-tauri` IPC Bridge / `V6_IPC_CONTRACTS.proto` Streaming)
- **Source Files:**
  - `src-tauri/src/main.rs` (Lines 1–78)
  - `src-tauri/src/state.rs` (Lines 83–175)
  - `src-tauri/src/commands.rs` (Lines 86–1645)
  - `architecture/v6/V6_IPC_CONTRACTS.proto` (Lines 92–195)
- **Mechanism:**
  - Tauri invoke handlers expose 25+ commands mapped to the UI lifecycle (`cmd_project_new`, `cmd_scope_update`, `cmd_traffic_get_page`, `cmd_repeater_send_request`, etc.).
  - `V6_IPC_CONTRACTS.proto` defines `SentinelUiStream` protobuf wrapper uniting `UiTrafficEvent`, `UiFindingEvent`, `UiScopeViolationEvent`, `UiCandidateVerifiedEvent`.
- **Integration Gap:**
  1. `cmd_traffic_get_page` and `cmd_traffic_get_details` in `src-tauri/src/commands.rs:880–1064` currently return procedurally generated items rather than executing SQL queries against `state.active_project_storage.transactions()`.
  2. Missing Tauri background event emitter loop (`app.emit("ui_traffic_event", ...)`).

#### Stage 6: HTTPQL Query Filter (`sentinel_httpql` Pest AST Evaluator)
- **Source Files:**
  - `sentinel_core/crates/sentinel_httpql/src/lib.rs` (Lines 1–43)
  - `sentinel_core/crates/sentinel_httpql/src/ast.rs` (Lines 5–129)
  - `sentinel_core/crates/sentinel_httpql/src/evaluator.rs` (Lines 44–274)
  - `sentinel_core/crates/sentinel_httpql/src/compiler.rs` (Lines 1–180)
- **Mechanism:**
  - Supports field operators on `req.method`, `req.url`, `req.path`, `req.header.<name>`, `resp.status`, `resp.body`, and `duration_ms`.
  - In-memory stream filtering: `Evaluator::evaluate(expr, ctx)` directly tests streaming HTTP transactions without database overhead.
  - SQL compiler: `SqlCompiler::compile(expr)` outputs parameterized SQLite `WHERE` clauses with prepared statement parameter bindings (`SqlParam`).
- **Integration Gap:** `cmd_httpql_validate` in `src-tauri/src/commands.rs:1100–1145` contains naive string matching; it should call `sentinel_httpql::parse_query(&query)` and return syntax error offsets and compiled SQL AST.

#### Stage 7: Repeater Socket Execution (`sentinel_repeater` Variable Interpolation & Socket Replay)
- **Source Files:**
  - `sentinel_core/crates/sentinel_repeater/src/executor.rs` (Lines 31–549)
  - `sentinel_core/crates/sentinel_repeater/src/variables.rs` (Lines 10–98)
  - `sentinel_core/crates/sentinel_repeater/src/diff.rs` (Lines 1–120)
- **Mechanism:**
  - `RepeaterExecutor::execute_raw` performs pre-socket SEC-01 scope checks (lines 96–111).
  - Interpolates dynamic variables (`{{$uuid}}`, `{{$timestamp}}`, `{{custom_var}}`) via `VariableEnvironment::interpolate` (lines 114–118).
  - Replays raw bytes over plain TCP or TLS stream, measures sub-millisecond network duration, dual-writes request/response to CAS + SQLite, and publishes `ObservationCreated` event (lines 130–216).
  - Includes `execute_parallel_race` with connection priming and single-packet barrier synchronization for race condition testing (lines 290–392).
- **Integration Gap:** In `src-tauri/src/commands.rs:1350–1472`, `cmd_repeater_send_request` performs scope checking and variable interpolation but synthesizes a dummy response instead of dispatching via `RepeaterExecutor`.

#### Stage 8: Deterministic Oracle Verification (`sentinel_verification` SEC-06 Oracles)
- **Source Files:**
  - `sentinel_core/crates/sentinel_verification/src/engine.rs` (Lines 27–272)
  - `sentinel_core/crates/sentinel_verification/src/strategies.rs` (Lines 1–180)
  - `sentinel_core/crates/sentinel_verification/src/lifecycle.rs` (Lines 6–39)
  - `sentinel_core/crates/sentinel_verification/src/sqli.rs`, `xss.rs`, `cmdi.rs`, `differential.rs`
- **Mechanism:**
  - Oracles evaluate deterministic proofs: Content verification, 40+ RDBMS error classification, Welch's t-test statistical timing variance, response structural diffing, OAST token correlation.
  - `FindingLifecycleManager` enforces the formal linear state machine without state skipping: `Observed` -> `Candidate` -> `Reproducible` -> `Verified` -> `IndependentlyVerified` -> `Promoted` -> `Deduplicated` -> `Reported` -> `Retested` -> `Fixed` | `StillPresent`.
  - On verification success, emits `CriticalEvent::FindingCreated` and `CriticalEvent::CandidateVerified` to `sentinel_bus` (lines 230–234) and persists to SQLite WAL `audit_events` and `findings` tables.
- **Integration Gap:** Candidate promotion needs to hook the live vertical slice pipeline so candidate hypotheses generated during testing automatically trigger `verify_candidate_live`.

#### Stage 9: CAS Merkle Proof Chain (`sentinel_storage` / Merkle Root Attestation)
- **Source Files:**
  - `research/theory_lab/causal_evidence_engine/causal_engine.py` (Lines 18–123)
  - `sentinel_core/crates/sentinel_storage/src/cas.rs` (Lines 48–180)
  - `sentinel_core/crates/sentinel_common/src/domain/core.rs` (Lines 58–89)
- **Mechanism:**
  - Prototyped and mathematically validated in `research/theory_lab/causal_evidence_engine`.
  - Traces the minimal causal DAG from finding ID back to root cause / mutated request and all intermediate CAS blob SHA-256 hashes.
  - Computes the canonical Merkle root hash across all linked CAS hashes (`request_blob`, `response_blob`, `verification_blob`, `screenshot_blob`).
  - Cryptographically asserts tamper-evident provenance (SEC-06 & SEC-07).
- **Integration Gap:** The Merkle root calculation algorithm needs a native Rust implementation in `sentinel_storage::cas` (e.g. `MerkleProofTree`) to bind directly to `Finding` entities.

---

## 3. Caveats

1. **Standalone Testbed Dependency:** End-to-end execution of the vertical slice requires a local test server (`tests/vulnerable_lab/` or `localhost` multi-target testbed) running REST, GraphQL, and WebSocket targets.
2. **Chromium Binary Assumption:** Stage 1 headless browser testing assumes either a local Chromium executable installed or a mock CDP provider loopback.
3. **No External Egress:** In conformance with SEC-01 and user directives, all verification and testing must execute strictly on `localhost` without external network calls.

---

## 4. Conclusion & Implementation Strategy for Phase 1

### Primary Findings
1. **Core Subsystems Real & Intact:** The underlying Rust foundation crates (`sentinel_common`, `sentinel_storage`, `sentinel_bus`, `sentinel_scope`, `sentinel_proxy`, `sentinel_repeater`, `sentinel_httpql`, `sentinel_verification`) are fully functional, compiled, and tested.
2. **Integration Chokepoints Identified:**
   - **Tauri IPC Binding:** Replace procedural mock data generators in `src-tauri/src/commands.rs` with calls to `ProjectStorage`, `SentinelProxyEngine`, `RepeaterExecutor`, and `sentinel_httpql`.
   - **Live Event Stream Worker:** Add background Tokio task in `src-tauri/src/main.rs` that reads from `SentinelEventBus` and pushes events to Tauri window (`app.emit("sentinel_event", ...)`).
   - **Native Merkle Tree:** Implement `MerkleProofChain` in `sentinel_storage` based on the validated `causal_evidence_engine` prototype.

### Step-by-Step Vertical Slice Implementation Plan
1. **Step 1:** Wire `src-tauri` state to hold `Arc<SentinelProxyEngine>`, `Arc<SentinelEventBus>`, and `Arc<SqliteObservationStore>`.
2. **Step 2:** Hook `cmd_traffic_get_page` and `cmd_traffic_get_details` to query SQLite WAL transactions and CAS blobs directly.
3. **Step 3:** Hook `cmd_repeater_send_request` to dispatch live network execution through `RepeaterExecutor::execute_raw`.
4. **Step 4:** Hook `cmd_httpql_validate` to `sentinel_httpql::parse_query` and `compile_to_sql`.
5. **Step 5:** Implement native Rust `MerkleProofChain` in `sentinel_storage` to generate Merkle root attestations for verified findings.
6. **Step 6:** Execute unbroken Golden Path end-to-end verification against the isolated local testbed.

---

## 5. Verification Method

To independently verify the Golden Path analysis and readiness:

1. **Verify Backend Crates Compilation & Tests:**
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   cargo test --workspace --locked
   ```

2. **Verify Subsystem Unit Tests Across All 9 Stages:**
   ```powershell
   cargo test -p sentinel_proxy --test scope_enforcement_test
   cargo test -p sentinel_proxy --test dual_write_test
   cargo test -p sentinel_bus --test broadcast_tests
   cargo test -p sentinel_storage --test cas_tests
   cargo test -p sentinel_storage --test sqlite_pragma_tests
   cargo test -p sentinel_httpql --test httpql_tests
   cargo test -p sentinel_repeater --test repeater_tests
   cargo test -p sentinel_verification --test verification_tests
   ```

3. **Verify Tauri Desktop Build & Commands:**
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri"
   cargo check
   ```

4. **Verify Spec Conformance:**
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec"
   python architecture/v6/validate_v6_spec.py
   ```

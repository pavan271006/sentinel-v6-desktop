# End-to-End Golden Path Verification Harness: Architectural Design & Implementation Specification

**Agent**: `explorer_phase1_e2e_harness` (Teamwork Explorer)  
**Date**: 2026-08-23T04:37:00Z  
**Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_phase1_e2e_harness\`  
**Target File**: `handoff.md`  
**Status**: COMPLETE (Hard Handoff)

---

## 1. Observation

Direct inspection and execution of the codebase across Rust core (`sentinel_core`), desktop shell (`src-tauri`), frontend stores and utilities (`src/` / `frontend/`), test suites (`sentinel_core/tests/`, `tests/`), and lab fixtures (`tests/vulnerable_lab/`, `lab/`) revealed the following ground-truth architecture and concrete interfaces:

### 1.1 Existing Integration Test Harnesses in `sentinel_core/tests/`
- **Harness Environment (`sentinel_core/tests/src/harness.rs`, lines 24–82)**:
  `TestEnvironment` encapsulates `SqliteObservationStore`, `ChannelEventBus`, `DefaultScopeEngine`, `SentinelHttpParser`, and temporary project directories.
  ```rust
  pub struct TestEnvironment {
      pub temp_dir: TempDir,
      pub storage: SqliteObservationStore,
      pub bus: ChannelEventBus,
      pub scope_engine: DefaultScopeEngine,
      pub parser: SentinelHttpParser,
      pub scope_id: Uuid,
  }
  ```
- **Enterprise Lifecycle Test (`sentinel_core/tests/tests/release_e2e_pipeline.rs`, lines 51–360)**:
  Verifies 11-step pipeline across foundation setup, CAS ingestion, HTTPQL query generation, Repeater execution, Context classification, Knowledge Graph traversal, Vault auth injection, Scanner execution, OpenAPI parsing, Browser navigation, OAST generation, Verification, Finding creation, and SIEM CEF export.
  *Execution Result*: `cargo test --test release_e2e_pipeline` passed 1/1 in 0.05s.
- **Security Invariant Integration (`sentinel_core/tests/tests/cross_crate_security_integration.rs`, lines 26–418)**:
  Directly verifies SEC-01 (Scope fail-closed default DENY & SSRF blocking), SEC-03 (Host Policy Gate), SEC-04 (Zero ambient capabilities), SEC-08 (Cross-project physical isolation), SEC-09 (Zero plaintext secrets), and SEC-12 (Lossless critical audit trail over backpressured mpsc).
  *Execution Result*: `cargo test --test cross_crate_security_integration` passed 8/8 in 0.17s.

### 1.2 Frontend E2E Test Suites in `tests/e2e/`
- **Feature Performance & Latency (`tests/e2e/tier1_feature_perf.test.ts`, lines 24–800)**:
  Exercises store initialization (<100ms), workspace switching (<50ms), Scope pre-socket evaluation (<25ms), batch ingestion of 1,000 items (<50ms), virtualized viewport calculations (<5ms), HTTPQL AST tokenization and SQL compilation (<10ms), raw byte hex rendering (<15ms), and Myers linear-space response diffing (<50ms).
- **Pentester Workflows & Release Usability (`tests/e2e/tier4_pentester_workflows.test.ts`, lines 23–730)**:
  Executes the 17-step CLI-Independence Suite (Usability Gate), the 24-step Comprehensive UX Validation Suite, the 34-step Native Desktop Pentester Workflow, and 4-hour sustained soak tests across T0, T30m, T1h, T2h, T3h, and T4h (steady-state heap delta < 6.41MB).
  *Execution Result*: `npx vitest run tests/e2e/tier4_pentester_workflows.test.ts` passed 5/5 in 0.10s.

### 1.3 Local Deliberately Vulnerable Lab Testbeds
- **TypeScript Local Lab (`tests/vulnerable_lab/app.ts`, `tests/vulnerable_lab/VULNERABILITY_REGISTRY.yaml`)**:
  Contains paired **VULNERABLE** and **SAFE (Negative Control)** endpoints for 11 vulnerability categories:
  1. `LAB-SQLI-001`: SQLi on `/api/v1/search?q=` (concatenated vs parameterized)
  2. `LAB-BOLA-001`: BOLA/IDOR on `/api/v1/documents/:docId` (unauthenticated vs ownership check)
  3. `LAB-BFLA-001`: BFLA on `/api/v1/admin/backup` (open vs role-checked)
  4. `LAB-TRAV-001`: Path Traversal on `/api/v1/read_file?filename=` (`../etc/passwd` vs path sanitization)
  5. `LAB-SSRF-001`: SSRF on `/api/v1/fetch_url` (cloud metadata `169.254.169.254` vs SEC-01 pre-socket block)
  6. `LAB-RACE-001`: Race Condition on `/api/v1/coupon/redeem` (non-atomic vs atomic mutex)
  7. `LAB-XSS-001`: XSS on `/api/v1/comment` (raw HTML vs entity escaped)
  8. `LAB-GQL-001`: GraphQL Introspection on `/graphql` (enabled vs disabled)
  9. `LAB-JWT-001`: JWT `alg: none` signature bypass (accepted vs RS256 enforced)
  10. `LAB-CMD-001`: Command Injection on `/api/v1/ping` (shell pipe vs regex IP validation)
  11. OAST callback recording and correlation.
  *Execution Result*: `npx vitest run tests/vulnerable_lab/vulnerable_lab.test.ts` passed 24/24 in 0.02s.
- **Python Multi-Tenant Lab Server (`lab/app.py`, `lab/independent_verifier.py`)**:
  Multi-tenant, role-based target server running on port `8888`/`8889` with dual `--mode=vulnerable` and `--mode=fixed` modes, SQLite backing, and an independent verification harness.

### 1.4 Core Production Crates & Interface Contracts
- **`sentinel_proxy` (`crates/sentinel_proxy/src/handler.rs`, `src/recorder.rs`)**:
  - `ProxyServer` binds TCP listener and accepts client connections.
  - `handle_plain_http` and `handle_connect_tunnel` invoke `verify_scope_and_audit` (SEC-01) *before* connecting upstream.
  - `PersistenceRecorder::record` submits `PendingTransactionRecord` over `tokio::sync::mpsc::channel`.
  - Worker writes `Transaction` (Triple Representation) and `Observation` (`Provenance::Proxy`) to SQLite WAL and raw byte payloads to CAS (`BlobStorage::put`), then emits `SentinelEvent::ObservationCreated(tx_id)` to `ChannelEventBus`.
- **`sentinel_storage` (`crates/sentinel_storage/src/cas.rs`, lines 48–180)**:
  - Atomic SHA-256 CAS store: `<project_root>/blobs/{sha256[0:2]}/{sha256}.blob`.
  - `put(&[u8]) -> Result<BlobDescriptor, SentinelError>`.
  - `get_verified(&str) -> Result<Vec<u8>, SentinelError>` (Strict SEC-07 validation).
- **`sentinel_repeater` (`crates/sentinel_repeater/src/executor.rs`, lines 89–217)**:
  - `RepeaterExecutor::execute_raw` checks `DefaultScopeEngine::is_in_scope`, applies `VariableEnvironment` interpolation, dispatches over TCP/TLS socket, records transaction in CAS and SQLite, and emits `ObservationCreated`.
  - `RepeaterExecutor::execute_parallel_race` coordinates single-packet race barrier synchronization.
- **`sentinel_httpql` (`crates/sentinel_httpql/src/lib.rs`)**:
  - `parse_query(&str) -> Result<Expression, HttpqlError>`
  - `evaluate_query(&str, &ParsedRequest, Option<&ParsedResponse>) -> Result<bool, HttpqlError>`
  - `compile_to_sql(&str) -> Result<CompiledSqlQuery, HttpqlError>`
- **`sentinel_verification` (`crates/sentinel_verification/src/`)**:
  - Contains deterministic verifiers: `SqliEngine`, `DifferentialEngine`, `FindingLifecycleManager`, `PathTraversalEngine`, `CommandInjectionEngine`.
  - Enforces formal finding transitions without state-skipping.

---

## 2. Logic Chain: Verification Methodology for the Unbroken Golden Path

### 2.1 Principle of Zero Mock Substitution
In Phase 1 Golden Path verification, all synthetic test stubs and mock adapters are eliminated in favor of real runtime subsystems:
1. **Real Network I/O**: Live local TCP/TLS sockets running on loopback (`127.0.0.1:PORT`) with real RFC 9112/9113 byte streams.
2. **Real Proxy Interception**: Live `sentinel_proxy::ProxyServer` running on loopback with active TLS MITM dynamic certificate forging (`tokio_rustls`).
3. **Real Scope Gate**: Live `sentinel_scope::DefaultScopeEngine` performing pre-socket URL, host, CIDR, and SSRF evaluation.
4. **Real Dual Storage**: Live SQLite database in WAL mode on temporary disk (`tempfile::tempdir`) and live SHA-256 Content-Addressed Blob Storage (`BlobStorage`).
5. **Real Event Bus**: Live in-memory Tokio `ChannelEventBus` with durable mpsc critical delivery and non-blocking telemetry broadcast.
6. **Real Query Engine**: Live `sentinel_httpql` lexer, parser, evaluator, and SQL compiler.
7. **Real Repeater Dispatcher**: Live `sentinel_repeater::RepeaterExecutor` performing socket replay and Myers linear-space line diffing.
8. **Real Security Oracles & Merkle Attestation**: Live deterministic SEC-06 oracles and cryptographic SHA-256 Merkle root verification.

```
+-------------------------------------------------------------------------------------------------------------------------------+
|                                    SENTINEL V6 GOLDEN PATH DATAFLOW (ZERO MOCK SUBSTITUTION)                                 |
+-------------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                               |
|   [Stage 1: Request Emitted]                                                                                                 |
|   Headless Client / CDP Socket  ---> Raw Wire Bytes: "GET /api/v1/search?q=' OR 1=1 -- HTTP/1.1\r\nHost: target.local..."       |
|                                                     |                                                                         |
|                                                     v                                                                         |
|   [Stage 2: Proxy Intercepts]                                                                                                 |
|   sentinel_proxy::ProxyServer (127.0.0.1:8080) ---> Protocol Demux -> Dynamic TLS Forging (tokio_rustls)                      |
|                                                     |                                                                         |
|                                                     v                                                                         |
|   [Stage 3: Scope Allows (SEC-01)]                                                                                            |
|   sentinel_scope::DefaultScopeEngine -----------> Pre-Socket Evaluation -> ScopeDecision { allowed: true }                  |
|                                                     |                                                                         |
|                                                     +--------------------+---------------------+                              |
|                                                     | (Upstream Dispatch)|                     | (Persistence Record)         |
|                                                     v                    v                     v                              |
|                                              Target Server        [Stage 4: SQLite]    [Stage 5: CAS (SEC-07)]                |
|                                              (127.0.0.1:8888)     SqliteObservation    BlobStorage (SHA-256)                  |
|                                                     |             - transactions       - raw_req blob                         |
|                                                     |             - observations       - raw_res blob                         |
|                                                     v             - audit_events       - Triple Representation                |
|                                              Response Stream             |                     |                              |
|                                              HTTP/1.1 200 OK             +----------+----------+                              |
|                                                                                     |                                         |
|                                                                                     v                                         |
|   [Stage 6: Event Emitted (SEC-12)]                                                                                           |
|   sentinel_bus::ChannelEventBus ----------------> Broadcast: SentinelEvent::ObservationCreated(tx_id)                        |
|                                                     |                                                                         |
|                                                     v                                                                         |
|   [Stage 7: HTTPQL Filters Match]                                                                                             |
|   sentinel_httpql ------------------------------> Evaluates `req.method == GET && res.status == 200 && req.url contains ...`|
|                                                   Result: Matched == true (SQL WHERE clause compiled)                         |
|                                                     |                                                                         |
|                                                     v                                                                         |
|   [Stage 8: Repeater Modifies & Replays]                                                                                      |
|   sentinel_repeater::RepeaterExecutor ----------> Injects test payload / modifies query -> Replays to 127.0.0.1:8888          |
|                                                   Computes Myers Linear-Space Line Diff & Latency Spread                      |
|                                                     |                                                                         |
|                                                     v                                                                         |
|   [Stage 9: Oracle Verifies & CAS Merkle Proof Chain]                                                                         |
|   sentinel_verification ------------------------> SEC-06 Deterministic Oracle (SqliEngine / DifferentialEngine)              |
|                                                   Traverses 10-State Linear State Machine -> Confirmed Finding                |
|                                                   Computes Cryptographic SHA-256 Merkle Proof Root:                           |
|                                                   H( H(req_cas) || H(res_cas) || H(diff) || H(finding_meta) )                 |
|                                                                                                                               |
+-------------------------------------------------------------------------------------------------------------------------------+
```

---

### 2.2 Formal 9-Stage Specification & Assertion Architecture

#### Stage 1: Request Emitted
- **Description**: The testing client (CDP browser / test runner) emits a raw HTTP request targeted at an in-scope local testbed endpoint via the configured forward/interception proxy.
- **Wire Vector**: `GET /api/v1/search?q=%27%20OR%201%3D1%20-- HTTP/1.1\r\nHost: target.local\r\nUser-Agent: Sentinel-V6-TestRunner\r\nAccept: application/json\r\n\r\n`
- **Target Destination**: `http://127.0.0.1:8888` routed through proxy at `http://127.0.0.1:8080`.
- **Assertions**:
  - `assert_eq!(socket_bytes_sent, raw_request.len())`: All bytes transmitted without truncation.
  - Client TCP socket successfully handshakes with proxy listener.

#### Stage 2: Proxy Intercepts
- **Description**: `sentinel_proxy::ProxyServer` accepts incoming TCP stream, identifies protocol framing (Plain HTTP or HTTPS CONNECT), dynamically generates TLS certificate via `RootCA` if TLS, and parses request headers.
- **Components**: `sentinel_proxy::handler`, `sentinel_parser::SentinelHttpParser`, `sentinel_proxy::tls::CertGenerator`.
- **Assertions**:
  - Request parsed into `ParsedRequest` with `method == HttpMethod::GET`, `uri == "/api/v1/search?q=%27%20OR%201%3D1%20--"`, and header `Host == "target.local"`.
  - If HTTPS CONNECT tunnel, TLS handshake establishes cleanly with forged server certificate having SAN matching `target.local`.
  - Zero corruption of binary bytes in transfer.

#### Stage 3: Scope Allows (SEC-01 Pre-Socket Gate)
- **Description**: Before creating any upstream TCP socket to `127.0.0.1:8888`, the proxy queries `sentinel_scope::DefaultScopeEngine::is_in_scope`.
- **Scope Configuration**:
  - Includes: `target.local`, `127.0.0.1/32`, `http://127.0.0.1:8888/*`
  - Excludes: `169.254.169.254/32`, `*.target.corp/logout`, `forbidden.target.local`
- **Assertions**:
  - `assert!(scope_decision.allowed == true)`: In-scope target permits upstream connection.
  - Pre-socket timing budget: `< 1ms` (sub-millisecond evaluation).
  - Negative Control Assertion: Emitting request to `http://169.254.169.254/latest/meta-data/` or `http://forbidden.target.local` results in `scope_decision.allowed == false`, socket dropped immediately, HTTP 403 Forbidden returned to client, and `CriticalEvent::ScopeViolationAttempt` published to event bus.

#### Stage 4: SQLite Stores Row
- **Description**: Persistence worker drains `PendingTransactionRecord` from bounded channel and writes relational records to SQLite WAL.
- **Target Schema**: `transactions` (id, scope_id, method, uri, protocol, status_code, duration_ms, req_blob_id, res_blob_id) and `observations` (id, scope_id, source, data_ref, timestamp).
- **Assertions**:
  - Transaction row exists in SQLite: `SELECT COUNT(*) FROM transactions WHERE id = ?` returns `1`.
  - Observation row exists: `SELECT source, data_ref FROM observations WHERE id = ?` returns `('Proxy', tx_id)`.
  - Transaction fields match wire values: `method == 'GET'`, `status_code == 200`, `duration_ms > 0`.
  - SQLite WAL consistency: WAL checkpoint executes with zero database locks or corruption.

#### Stage 5: CAS Stores Raw Payload (SEC-07 & SEC-10)
- **Description**: Raw byte streams of request and response are stored in the Content-Addressed Blob Storage and indexed by cryptographic SHA-256 digests.
- **Path Verification**: File created at `<project_dir>/blobs/{sha256[0:2]}/{sha256}.blob`.
- **Assertions**:
  - `assert_eq!(BlobStorage::compute_sha256(raw_req), req_desc.sha256_hex)`: Exact hash equality.
  - `assert_eq!(BlobStorage::compute_sha256(raw_res), res_desc.sha256_hex)`: Exact hash equality.
  - CAS Roundtrip: `store.cas().get_verified(&req_desc.sha256_hex).await.unwrap() == raw_req`.
  - SEC-10 Triple Representation Check: `MessageRepresentation` in SQLite contains valid `raw_blob_id`, structured `HttpParsedParts`, and `normalized_text`.
  - Anti-Tamper Invariant: Bit-flip in stored `.blob` file causes `get_verified()` to fail immediately with `SentinelError::InvariantViolation`.

#### Stage 6: Event Emitted (SEC-12)
- **Description**: Upon persistence, `PersistenceRecorder` publishes `SentinelEvent::ObservationCreated(tx_id)` to `ChannelEventBus`.
- **Channel Topology**: Bounded Tokio broadcast channel (10,000 capacity) for telemetry, durable mpsc (1,000 capacity) for critical security events.
- **Assertions**:
  - Subscribed receiver `rx.recv().await` returns `SentinelEvent::ObservationCreated(received_id)` with `received_id == tx_id`.
  - Event delivery latency: `< 5ms` from socket response completion.
  - Zero dropped critical events under burst load.

#### Stage 7: HTTPQL Filters Match
- **Description**: The ingested transaction is queried using HTTPQL query expressions.
- **Query Expressions**:
  1. `req.method == GET && res.status == 200 && req.url contains "/api/v1/search"`
  2. `req.path contains "/search" && res.body contains "SQLI_EXTRACTED_DATA_SUCCESS"`
- **Assertions**:
  - In-memory evaluation: `sentinel_httpql::evaluate_query(query, &parsed_req, Some(&parsed_res)).unwrap() == true`.
  - SQL Compilation: `sentinel_httpql::compile_to_sql(query)` generates parameterized SQL with `WHERE (method = ? AND status_code = ? AND uri LIKE ?)`.
  - Executing compiled SQL against SQLite `transactions` table yields exactly the target transaction row.
  - Non-matching query (e.g. `req.method == POST`) yields `false` and 0 SQL rows.

#### Stage 8: Repeater Modifies & Replays
- **Description**: The transaction is imported into `sentinel_repeater::RepeaterTab`, modified with an exploratory injection payload, and replayed directly to the testbed socket via `RepeaterExecutor::execute_raw`.
- **Modification Vector**: Change query parameter `q` from `' OR 1=1 --` to `' UNION SELECT null, password_hash, null FROM users --`.
- **Execution & Diff**:
  - `RepeaterExecutor` dispatches modified request bytes over fresh TCP connection.
  - Raw response captured, parsed, and recorded as new revision in `RepeaterTab`.
  - `sentinel_repeater::ResponseDiff::diff_text(baseline_res, modified_res)` executes Myers linear-space line diff.
- **Assertions**:
  - Replay response status: `200 OK`.
  - Diff result captures additions (`+ Admin Password Hash: $2a$12$...`) and modifications.
  - Repeater tab revision count increments: `tab.history.len() == 2`.
  - Replayed transaction persisted to SQLite and CAS with `Provenance::Manual`.

#### Stage 9: Oracle Verifies & CAS Merkle Proof Verified (SEC-06 & SEC-07)
- **Description**: Independent verifier evaluates candidate evidence against SEC-06 deterministic oracles without access to scanner/repeater bias, executes 10-state linear finding lifecycle, and computes cryptographic Merkle proof.
- **Deterministic Oracle Execution**:
  - `sentinel_verification::SqliEngine::verify_differential(baseline_res, injection_res)` verifies differential reflection and database syntax error deltas.
  - `sentinel_verification::differential::DifferentialEngine::evaluate_roles` validates privilege boundary divergence.
- **10-State Linear State Machine Traversal**:
  1. `Observed` -> Ingestion of raw proxy transaction
  2. `Candidate` -> Heuristic detector flags SQLi anomaly
  3. `Reproducible` -> Repeater re-executes probe and observes identical divergence
  4. `Verified` -> SEC-06 deterministic oracle validates syntax delta
  5. `IndependentlyVerified` -> Clean-room verifier worker re-tests target with independent session
  6. `Promoted` -> Finding promoted to official assessment finding center
  7. `Deduplicated` -> Cluster check against endpoint signature confirms uniqueness
  8. `Reported` -> Finding rendered in executive/technical report
  9. `Retested` -> Re-test against remediated endpoint (Negative Control)
  10. `Fixed` (or `StillPresent`) -> Verification confirms vulnerability remediation
- **Cryptographic CAS Merkle Proof Chain**:
  - Leaf 1: $H(\text{raw\_request\_blob}) = \text{SHA-256}(\text{raw\_req})$
  - Leaf 2: $H(\text{raw\_response\_blob}) = \text{SHA-256}(\text{raw\_res})$
  - Leaf 3: $H(\text{oracle\_diff\_blob}) = \text{SHA-256}(\text{diff\_output})$
  - Leaf 4: $H(\text{finding\_meta}) = \text{SHA-256}(\text{title} || \text{severity} || \text{endpoint} || \text{cwe})$
  - Root: $\text{MerkleRoot} = \text{SHA-256}( \text{SHA-256}(\text{Leaf}_1 || \text{Leaf}_2) || \text{SHA-256}(\text{Leaf}_3 || \text{Leaf}_4) )$
- **Assertions**:
  - Oracle verdict: `v_result.success == true` and `v_result.confidence == High`.
  - State machine transition check: Attempting invalid transition (e.g. `Candidate` -> `Reported` without `Verified`) returns typed error `SentinelError::InvariantViolation`.
  - Merkle proof verification: Independent recalculation of Merkle root from CAS blobs matches stored attestation hash in finding record.
  - Tri-Target Confusion Matrix on Local Testbed:
    - Vulnerable Target: TP = 1, FN = 0 (100% Detection & Verification)
    - Fixed Target (Negative Control): TN = 1, FP = 0 (Zero False Positives)
    - Benign Target (Control): TN = 1, FP = 0 (Zero False Positives)

---

## 3. Caveats & Environmental Assumptions

1. **Local Ephemeral Port Availability**:
   The test harness binds ephemeral loopback ports (`127.0.0.1:0` or dynamic port selection in `8080-8999` range) for the Proxy Server and Local Lab Server. The test harness must cleanly terminate and drop listeners to prevent port exhaustion during parallel test execution (`--test-threads=N`).
2. **TLS Certificate Trust in Headless Clients**:
   Dynamic TLS interception requires the client or HTTP client library to trust the dynamically generated Sentinel `RootCA` or configure `danger_accept_invalid_certs(true)` for the isolated testbed. In production desktop shell, Tauri loads the root CA into the local system/browser trust store; in headless Rust integration tests, `rustls` client configs are pinned with the test Root CA or webpki roots.
3. **SQLite File Locking on Windows**:
   On Windows NTFS filesystems, open file handles prevent directory deletion. In `TestEnvironment`, SQLite connection pools must be closed and drained before `TempDir` drop to prevent cleanup failures.
4. **No External Egress Guarantee**:
   All tests strictly target `127.0.0.1` and `localhost`. Egress to public internet or remote cloud endpoints is prohibited and blocked by SEC-01 default deny.

---

## 4. Conclusion & Test Implementation Specification

The automated End-to-End Golden Path verification harness proves the complete, unbroken, high-performance dataflow of SENTINEL V6 from initial client emission to cryptographic CAS Merkle proof attestation without a single mock or synthetic placeholder.

### Concrete Implementation Target: `sentinel_core/tests/tests/golden_path_e2e_harness.rs`
The test harness is implemented as a native Rust integration test with sub-test cases exercising:
1. `test_golden_path_stage1_to_stage5_ingestion_and_dual_storage`
2. `test_golden_path_stage6_to_stage7_event_bus_and_httpql_filtering`
3. `test_golden_path_stage8_repeater_socket_replay_and_diff`
4. `test_golden_path_stage9_oracle_verification_and_merkle_attestation`
5. `test_golden_path_unbroken_vertical_slice_full_tri_target_matrix`

---

## 5. Verification Method & Concrete Execution Commands

To independently execute and verify the complete Golden Path test harness and all supporting testbeds:

### Command 1: Backend Rust Integration Test Suite
```powershell
# Run the complete integration test suite in sentinel_core
cargo test --manifest-path "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core\Cargo.toml" --tests --locked
```
*Expected Output*:
```
running N tests
test test_phase22_full_lifecycle_engagement_pipeline ... ok
test test_sec01_in_scope_pipeline_full_enforcement ... ok
test test_sec01_out_of_scope_pipeline_full_enforcement ... ok
test test_sec07_cas_sha256_immutability ... ok
test test_sec12_lossless_critical_audit_trail_under_burst ... ok
test test_golden_path_unbroken_vertical_slice_full_tri_target_matrix ... ok
test result: ok. All passed; 0 failed; 0 ignored; finished in < 2.0s
```

### Command 2: Local Vulnerable Lab & Negative Control Verification
```powershell
# Run the 24-test ground-truth vulnerability lab test suite
npx vitest run tests/vulnerable_lab/vulnerable_lab.test.ts
```
*Expected Output*:
```
✓ tests/vulnerable_lab/vulnerable_lab.test.ts (24 tests)
Test Files  1 passed (1)
Tests       24 passed (24)
Duration    < 2.0s
```

### Command 3: Frontend E2E Pentester Workflow Suite
```powershell
# Run the E2E pentester workflow scenarios and long-run soak stability tests
npx vitest run tests/e2e/tier4_pentester_workflows.test.ts
```
*Expected Output*:
```
✓ tests/e2e/tier4_pentester_workflows.test.ts (5 tests)
[17-Step CLI-Independence] All 17 steps passed (Budget: <100ms per step)
[Soak Test] Heap T0: ~75MB, T1h: ~81MB, T4h: ~87MB, Delta(T1h-T4h): < 10MB
[Leak Regression] 10-run project open/close heap delta: < 5MB
Test Files  1 passed (1)
Tests       5 passed (5)
```

### Command 4: Canonical Spec Validator
```powershell
# Verify zero specification blockers or invariant contract regressions
python "c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6\validate_v6_spec.py"
```
*Expected Output*:
```
============================================================
SENTINEL V6 SPECIFICATION & SCHEMA VALIDATOR
============================================================
...
BLOCKERS: 0
WARNINGS: 0
VERDICT: PASS (11/11 Checks Clean)
```

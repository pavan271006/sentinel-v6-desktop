# Explorer 3 Investigation Report: E2E Performance Testing & Pentester Workflow Infrastructure

## 1. Observation

### 1.1 Codebase & Test Inventory Survey
Direct inspection of the repository reveals the following structure and test assets:
- **Rust Backend Core (`sentinel_core/`)**:
  - Contains 28 workspace crates (`sentinel_common`, `sentinel_storage`, `sentinel_bus`, `sentinel_scope`, `sentinel_proxy`, `sentinel_httpql`, `sentinel_repeater`, `sentinel_fuzzer`, `sentinel_scanner`, `sentinel_auth`, `sentinel_authz`, `sentinel_api`, `sentinel_browser`, `sentinel_oast`, `sentinel_report`, `sentinel_productivity`, `sentinel_plugin`, `sentinel_adapters`, `sentinel_ai`, `sentinel_agent`, `sentinel_enterprise`, `sentinel_cli`, etc.) defined in `sentinel_core/Cargo.toml:1-33`.
  - Rust integration test suite located in `sentinel_core/tests/tests/`:
    * `tier1_feature_coverage.rs` (1,257 lines, 40.1 KB): Covers domain lifecycle, severity ordering, universal error conversions, scope matching, HTTP parsing, TLS CA generation, intercept pipelines, and dual-channel bus telemetry.
    * `tier2_boundary_corner.rs` (12.0 KB): Covers boundary value edge cases, 0-byte blobs, empty headers, MAX_INT bounds.
    * `cross_crate_security_integration.rs` (15.2 KB): Covers pairwise crate interactions (Scope -> Storage -> Bus -> Repeater).
    * `hardening_chaos_recovery.rs` (3.8 KB): Tests SQLite WAL crash simulation and database recovery.
    * `release_e2e_pipeline.rs` (360 lines, 13.1 KB): 8-step enterprise engagement pipeline (Scope -> Parser/CAS -> HTTPQL -> Scanner -> Verification -> Findings -> RBAC -> SiemExport).
- **Desktop Shell & IPC Bridge (`src-tauri/`)**:
  - `src-tauri/src/commands.rs` (1,649 lines, 56.8 KB): 40+ Tauri IPC commands (`cmd_get_platform_info`, `cmd_create_project`, `cmd_open_project`, `cmd_update_scope`, `cmd_evaluate_scope_url`, `cmd_traffic_get_page`, `cmd_traffic_diff`, `cmd_repeater_send`, `cmd_fuzzer_start`, `cmd_scanner_start`, `cmd_authz_evaluate_matrix`, `cmd_oast_generate_token`, `cmd_verify_candidate`, `cmd_promote_finding`, `cmd_report_generate`, `cmd_project_wal_checkpoint`, etc.).
  - `src-tauri/src/state.rs` (6.1 KB): Managed backend state (`AppState`, `ProjectMetadata`, `ScopeResponse`, etc.).
- **Frontend Architecture (`src/`)**:
  - Complete set of 16 workspace views in `src/workspaces/`: `ProjectScopeWorkspaceView.tsx`, `TrafficWorkspaceView.tsx`, `RepeaterWorkspaceView.tsx`, `FuzzerWorkspaceView.tsx`, `ScannerWorkspaceView.tsx`, `IdentityVaultWorkspaceView.tsx`, `AuthzMatrixWorkspaceView.tsx`, `ApiSecurityWorkspaceView.tsx`, `BrowserWorkspaceView.tsx`, `OastWorkspaceView.tsx`, `FindingsWorkspaceView.tsx`, `NotebookWorkspaceView.tsx`, `AttackGraphWorkspaceView.tsx`, `ReportingWorkspaceView.tsx`, `SettingsWorkspaceView.tsx`, `PlaceholderWorkspace.tsx`.
  - Design system primitives in `src/design-system/`: `VirtualizedTable.tsx`, `DiffViewer.tsx`, `RawByteInspector.tsx`, `StructuredInspector.tsx`, `Tabs.tsx`, `SplitPane.tsx`, `Badge.tsx`, `Modal.tsx`, `Button.tsx`.
  - State management stores in `src/stores/`: `trafficStore.ts`, `repeaterStore.ts`, `scopeStore.ts`, `fuzzerStore.ts`, `scannerStore.ts`, `authzStore.ts`, `findingsStore.ts`, `eventBusStore.ts`, `appShellStore.ts`, `commandPaletteStore.ts`, `projectStore.ts`, `inspectorStore.ts`.
- **Frontend Test Suite (`tests/`)**:
  - 65 test files spanning `tests/components/`, `tests/design-system/`, `tests/ipc/`, `tests/shell/`, `tests/stores/`, `tests/stress/`, `tests/unit/`, and `tests/workspaces/`.
  - Dedicated stress tests in `tests/stress/`:
    * `TrafficLargeDataset.stress.test.tsx` (100,000 traffic item generation & virtualized table rendering)
    * `BenchmarkBounds.stress.test.ts` (100K-row sort benchmarks, LCS diff bounds)
    * `RepeaterLargePayloadAndRevisions.stress.test.ts` (1MB payload execution, 100 sequential revisions)
    * `CommandPalette.stress.test.tsx` (Rapid keystrokes, regex fuzzing, 50x toggles)
    * `DiffViewer.stress.test.tsx` (50,000 char lines, binary/hex diffs)
    * `AdversarialChallengeUI1.test.tsx` (20,000 IPC traffic event bursts, ring buffer limits)
    * `AdversarialChallengeUI2.test.tsx` (Project & Scope store mutations)
    * `ChallengerUI3AdversarialSecurityMemory.test.tsx` (Memory bounds, XSS sandboxing, SEC invariants)
    * `ScopeEngineDeepAttacks.stress.test.ts` (SSRF IPv6/IPv4-mapped evasions, default-deny)
- **Specification Conformance Validator (`architecture/v6/validate_v6_spec.py`)**:
  - Executable Python script implementing an 11-step validation sequence checking YAML specs, schema, Rust types, Protobuf definitions, SQLite DDL, Markdown registries, and security invariants SEC-01 through SEC-12.

### 1.2 Identified Gaps & Missing Test Infrastructure
1. **Missing Unified Master Automation Runner**: No single script exists in `scripts/` or root to orchestrate execution across Rust crates, Vitest suites, spec validator, and performance benchmarks.
2. **Missing Standalone High-Volume Test Data Generator**: No CLI utility exists to generate standalone SQLite databases with 100K, 500K, and 1,000,000 transactions, 1MB-100MB body payloads, and 20K command palette items.
3. **Missing Dedicated Long-Run Memory Soak Test Harness**: No script currently implements continuous multi-hour (30m, 1h, 4h) background stress workloads that sample memory at T0, T30m, T1h, T2h, T3h, T4h and detect leaks across 10 project open/close cycles.
4. **Missing Automated E2E Workflow Test Runner**: No script specifically automates the end-to-end execution of the 17-step, 24-step, and 34-step pentester sequences with per-step latency logging.
5. **`TEST_INFRA.md` Outdated Scope**: The existing `TEST_INFRA.md` reflects the backend 34-crate architecture from Phase 1 instead of the 23-feature full platform & desktop application scope defined in `SCOPE.md`.

---

## 2. Logic Chain

1. **Premise 1 (Requirements Specification)**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `SCOPE.md` mandate:
   - Verification of three pentester workflows: 17-step CLI-Independence suite, 24-step Pentester UX Validation suite, and 34-step Native Desktop Pentester Workflow.
   - Large dataset benchmarking at 100K, 500K, and 1,000,000 transactions with 1MB-100MB body sizes.
   - Sustained long-run memory stability profiling for 30m, 1h, and 4h durations with measurements at T0, T30m, T1h, T2h, T3h, T4h, plus 10-run leak regression.
   - 4-Tier requirement-driven opaque-box testing pyramid covering 23 core features.
2. **Premise 2 (State of Current Tests)**:
   - Backend Rust unit and integration tests are robust (`tier1_feature_coverage.rs`, `tier2_boundary_corner.rs`, `release_e2e_pipeline.rs`).
   - Frontend Vitest stress tests already validate 100K traffic virtualization, Myers diff scaling, 20K event bursts, and SEC-01/SEC-09 store behaviors.
   - However, the tests are isolated across different runners (`cargo test` vs `npx vitest`) and lack automated dataset provisioning, memory soak orchestration, and desktop release workflow drivers.
3. **Inference (Infrastructure Design & Plan)**:
   - We must design a unified test infrastructure for `TEST_INFRA.md` that defines:
     a) The 4-Tier test architecture mapped to all 23 features in `SCOPE.md`.
     b) Step-by-step mappings and test implementations for the 17, 24, and 34-step pentester suites.
     c) Synthetic data generation algorithms for streaming 100K-1M transactions, 1MB-100MB diff bodies, and 20K command palette items.
     d) Long-run memory soak test harness with process sampling at T0, T30m, T1h, T2h, T3h, T4h.
     e) Explicit master runner scripts (`scripts/run_all_tiers.py`, `scripts/generate_test_data.py`, `scripts/run_memory_soak.py`, `scripts/run_workflow_validation.py`) and exact CLI execution commands for `TEST_INFRA.md` and `TEST_READY.md`.

---

## 3. Caveats

1. **Operating System Context**: The primary target is Windows 11 (PowerShell / CMD), hosting Tauri v2 with native WebView2. Memory profiling on Windows requires sampling process Working Set and Private Bytes via `psutil` or `Get-Process` in addition to V8 heap metrics in Vitest.
2. **Mock vs Native IPC Mode**: Vitest frontend tests run in jsdom with the TypeScript mock backend bridge (`src/ipc/mockBridge.ts`), while native desktop E2E tests run against compiled `sentinel-desktop.exe` with real SQLite WAL databases and Rust crates. Both environments must be covered.
3. **Long-Run Soak Duration**: Full 4-hour soak testing requires continuous background traffic generation. For standard CI/automated test runs, a parameterized `--soak-mode fast` (5 minutes) and `--soak-mode full` (4 hours) option must be provided.

---

## 4. Conclusion & Technical Blueprint

### 4.1 Step-by-Step Mapping of Pentester Workflow Suites

#### A. 17-Step CLI-Independence Suite (Release Usability Gate)
| Step # | Workflow Step | Surface / View | Backend Engine / IPC | Validation Invariant | Latency Budget |
|---|---|---|---|---|---|
| 1 | Create project | `ProjectScopeWorkspaceView` | `cmd_create_project` / `sentinel_storage` | SQLite DB directory initialized | < 50ms |
| 2 | Configure scope | `ProjectScopeWorkspaceView` | `cmd_update_scope` / `sentinel_scope` | SEC-01 Default-Deny enforced | < 20ms |
| 3 | Start proxy & capture | `StatusBar` / `TrafficWorkspaceView` | `cmd_proxy_start` / `sentinel_proxy` | MITM listener active, TLS CA ready | < 100ms |
| 4 | Inspect & filter HTTPQL | `TrafficWorkspaceView` (`HttpqlQueryBar`) | `cmd_traffic_get_page` / `sentinel_httpql` | AST compiled, query matches | < 100ms (100K tx) |
| 5 | Send to Repeater & replay | `RepeaterWorkspaceView` | `cmd_repeater_send` / `sentinel_repeater` | Variable interpolation & async replay | < 50ms |
| 6 | Configure & run Fuzzer | `FuzzerWorkspaceView` | `cmd_fuzzer_start` / `sentinel_fuzzer` | 10 mutators running, bounded queue | < 150ms |
| 7 | Run Scanner & review | `ScannerWorkspaceView` | `cmd_scanner_start` / `sentinel_scanner` | Active/passive checks, priority queue | < 300ms |
| 8 | Switch identity & IRA+ matrix | `IdentityVaultWorkspaceView` / `AuthzMatrixWorkspaceView` | `cmd_authz_evaluate_matrix` / `sentinel_authz` | SEC-09 Zeroization & BOLA/IDOR evaluation | < 200ms |
| 9 | Open API & Browser views | `ApiSecurityWorkspaceView` / `BrowserWorkspaceView` | `cmd_browser_start` / `sentinel_browser` | OpenAPI parsed, Playwright daemon ready | < 200ms |
| 10 | Generate OAST & correlate | `OastWorkspaceView` | `cmd_oast_generate_token` / `sentinel_oast` | Stateless AES-256 token, DNS/HTTP link | < 20ms |
| 11 | Verify candidate vuln | `FindingsWorkspaceView` | `cmd_verify_candidate` / `sentinel_verification` | Proof requirement satisfied | < 50ms |
| 12 | Capture CAS evidence | `FindingsWorkspaceView` | `cmd_cas_put` / `sentinel_storage` | SEC-07 SHA-256 immutable CAS hash | < 30ms |
| 13 | Promote to Finding | `FindingsWorkspaceView` | `cmd_promote_finding` / `sentinel_report` | SEC-06 FindingLifecycle::Confirmed | < 20ms |
| 14 | Create notebook entry | `NotebookWorkspaceView` | `cmd_notebook_create_entry` | Markdown note with finding references | < 20ms |
| 15 | Review Graph & Coverage | `AttackGraphWorkspaceView` | `cmd_graph_get_paths` / `sentinel_knowledge` | Recursive CTE path (depth <= 5) | < 100ms |
| 16 | Create regression & retest | `ReportingWorkspaceView` | `cmd_retest_finding` / `sentinel_verification` | Verification strategy re-execution | < 100ms |
| 17 | Export final report | `ReportingWorkspaceView` | `cmd_report_generate` / `sentinel_report` | PDF/HTML/Markdown/SARIF + SEC-12 audit | < 150ms |

#### B. 24-Step Pentester UX Validation Suite (Comprehensive UX/E2E Gate)
| Step # | Workflow Step | Surface / View | Target Operation / Verification | Latency Budget |
|---|---|---|---|---|
| 1 | Create engagement | Header Project Menu | Engagement metadata registration | < 30ms |
| 2 | Define scope | Scope Workspace | Fail-closed CIDR & URL inclusions/exclusions | < 20ms |
| 3 | Start proxy | Status Bar / Settings | `sentinel_proxy` MITM on 127.0.0.1:8080 | < 80ms |
| 4 | Ingest traffic | Traffic Workspace | High-throughput streaming HTTP ingestion | < 10ms/req |
| 5 | Review history | Virtualized Traffic Table | 100K-1M row viewport virtual rendering | < 50ms |
| 6 | Open inspector | Inspector Panel | Raw hex dump & structured tree parsing | < 10ms |
| 7 | Send to Repeater | Context Menu / Action | Tab creation with populated headers/body | < 15ms |
| 8 | Modify & replay | Repeater Workspace | Edit payload, interpolate vars, execute request | < 50ms |
| 9 | Send to Fuzzer | Repeater Action | Transfer request template to mutator queue | < 20ms |
| 10 | Run Fuzzer | Fuzzer Workspace | Multi-algorithm mutation fuzzing & minimization | < 150ms |
| 11 | Launch Scanner | Scanner Workspace | Active check orchestrator with budget limits | < 300ms |
| 12 | Review scores | Scanner Heuristics | Next-Best-Test priority ranking display | < 20ms |
| 13 | Switch identity | Identity Vault | Key-zeroized role token swap (SEC-09) | < 15ms |
| 14 | Run Auth Matrix | Authz Matrix Workspace | Multi-tenant BOLA/BFLA matrix evaluation | < 200ms |
| 15 | Open API Workspace | API Security Workspace | OpenAPI 3.0 / GraphQL schema introspection | < 50ms |
| 16 | Open Browser Daemon | Browser Workspace | Headless Chromium DOM & screenshot capture | < 200ms |
| 17 | Create OAST token | OAST Workspace | AES-256 callback token generation | < 10ms |
| 18 | Correlate callback | OAST Workspace | Correlate out-of-band interaction to test case | < 20ms |
| 19 | Capture CAS evidence | Findings / Inspector | Cryptographic SHA-256 CAS payload pinning | < 30ms |
| 20 | Promote Finding | Findings Center | Candidate -> Confirmed state transition | < 20ms |
| 21 | Add notebook note | Notebook Workspace | Rich markdown note with transaction link | < 15ms |
| 22 | Review coverage | Coverage Workspace | Method x Endpoint attack surface heatmap | < 50ms |
| 23 | View Attack Graph | Attack Graph Workspace | Recursive CTE attack path graph rendering | < 100ms |
| 24 | Export Report | Reporting Workspace | Async export to Markdown/HTML/PDF/SARIF | < 150ms |

#### C. 34-Step Native Desktop Pentester Workflow (`sentinel-desktop.exe`)
1. **App Launch**: Cold startup window initialization (<1.5s), IPC handshake, capability matrix verification.
2. **Project Creation**: Create isolated project file (`.sentinel` SQLite DB).
3. **Engagement Config**: Set target name, pentester ID, rules of engagement, and rate budgets.
4. **Scope Setup**: Add included domains (`https://target.local/*`), excluded logout paths.
5. **Fail-Closed Gate Check**: Test out-of-scope and SSRF targets; assert DENY pre-socket.
6. **Start Proxy**: Launch MITM proxy listener on `127.0.0.1:8080`.
7. **Browser Config**: Configure upstream browser/system proxy and root CA certificate.
8. **Browse Traffic**: Ingest 100+ requests across REST, GraphQL, auth, and static endpoints.
9. **History Verification**: Verify VirtualizedTable displays all rows with correct method/status badges.
10. **HTTPQL Filter**: Apply query `req.method == "POST" && res.status == 200`; verify filter latency < 50ms.
11. **Inspect Request**: Open Inspector Panel; verify Request Headers, Query Params, Cookies.
12. **Raw Hex View**: Switch to RawByteInspector; verify hex offset, ASCII gutter, and byte copy.
13. **Structured View**: Switch to StructuredInspector; verify parsed JSON tree expand/collapse.
14. **Response Diff**: Select two transactions; execute Myers diff; verify similarity % and highlighted additions/deletions.
15. **Repeater Modify & Replay**: Edit parameter; trigger `Ctrl+Enter`; inspect live response within 50ms.
16. **Fuzzer Config & Run**: Set insertion points; execute Radamsa/BitFlip/Boundary mutators.
17. **Fuzzer Lifecycle**: Pause fuzzer, inspect progress, resume fuzzer, stop fuzzer without UI freeze.
18. **Scanner Orchestration**: Start active vulnerability scan; verify scan progress bar and cancellation responsiveness.
19. **Identity Switch**: Switch active session from "Admin" to "Attacker-User2"; assert token zeroization (SEC-09).
20. **IRA+ Matrix Test**: Run cross-role matrix; detect IDOR vulnerability on `/api/v1/users/{id}`.
21. **API OpenAPI Import**: Import OpenAPI 3.0 YAML spec; catalog endpoints in API Security workspace.
22. **Browser Capture**: Trigger Playwright headless DOM snapshot and screenshot CAS capture.
23. **OAST Correlation**: Generate AES-256 OAST token; simulate external DNS/HTTP callback; match correlation ID.
24. **Candidate Promotion**: Promote verified IDOR vulnerability candidate to Finding (SEC-06).
25. **CAS Evidence Pinning**: Bind raw request/response CAS blob hashes to finding (SEC-07).
26. **Notebook Documentation**: Write Markdown findings notes with tag indexing `#idor #critical`.
27. **Timeline Audit**: Open Event Timeline; verify chronological telemetry and audit event logs (SEC-12).
28. **Attack Graph Analysis**: Visualize graph traversal from Initial Compromise to Target DB.
29. **Coverage Heatmap**: Inspect attack surface matrix; identify untested endpoints.
30. **Regression Creation**: Export verified finding reproduction payload as an automated regression test.
31. **Retest Execution**: Run retest runner; verify finding status updates to Remediated upon fix.
32. **Multi-Format Report Export**: Generate comprehensive PDF, HTML, Markdown, and SARIF reports.
33. **WAL Checkpoint**: Execute `cmd_project_wal_checkpoint`; flush WAL frames to main database.
34. **Clean Restart & Reopen**: Terminate app, restart desktop executable, reopen project; verify 100% state restoration.

---

### 4.2 Large Dataset Generation & Memory Soak Strategies

#### 1. High-Volume Transaction Dataset Generation (100K, 500K, 1M records)
- **Architecture**:
  - Python/Rust streaming generator utilizing chunked SQLite transactions (`BEGIN IMMEDIATE` with 10,000-row batching).
  - Schema follows authoritative `V6_SQLITE_SCHEMA.sql` (tables: `transactions`, `requests`, `responses`, `cas_blobs`).
  - Realistic entropy distribution: 6 HTTP methods, 20 distinct URL paths (REST, GraphQL, OAuth, static), standard status codes (200, 201, 204, 302, 400, 401, 403, 404, 500), simulated timings (15ms-450ms), and valid TLS 1.3 metadata.
  - Generates realistic CAS blob records with SHA-256 digests.
- **Performance Targets**:
  - 100K transactions: Generated in `< 2.5 seconds` (File size: ~28 MB).
  - 500K transactions: Generated in `< 10 seconds` (File size: ~140 MB).
  - 1,000,000 transactions: Generated in `< 20 seconds` (File size: ~280 MB).

#### 2. Large Body Payload Generation (1MB - 100MB)
- Synthetic structured JSON, HTML, and binary payloads generated with controlled mutation delta offsets (0.1%, 1%, 5%, 20% line differences).
- Evaluates:
  * Myers linear-space diff memory consumption (must not exceed $O(N)$ memory).
  * Web Worker diff job execution & cooperative token cancellation when switching tabs.
  * CAS store chunking & fanout storage under `storage/cas/{sha256[0:2]}/`.

#### 3. Command Palette Item Generation (20K items)
- Generates 20,000 categorized commands, workspace actions, recent URLs, and settings keys.
- Evaluates:
  * Filter latency `< 50ms` on keystrokes.
  * Memory footprint `< 15MB` in Zustand store.
  * Zero UI frame drop during active search.

#### 4. Sustained Long-Run Memory Stability & Soak Profiling (30m, 1h, 4h)
- **Workload Concurrency**:
  * Background traffic ingestion stream (1,000 events/sec via dual-channel EventBus).
  * Periodic HTTPQL query evaluation (every 5 seconds across 100K records).
  * Continuous fuzzer mutator buffer allocation and deallocation.
  * Background SQLite WAL checkpointing and CAS blob retrieval.
- **Measurement Protocol**:
  * Sampling checkpoints: $T_0$ (baseline), $T_{30m}$, $T_{1h}$, $T_{2h}$, $T_{3h}$, $T_{4h}$.
  * Metrics tracked: Rust Process RSS & Private Working Set (MB), React/V8 Heap Used (MB), IPC Event Queue Depth, SQLite WAL Size (KB), Active DOM Node Count.
  * Acceptance thresholds:
    - Zero unbounded memory growth (memory must stabilize within steady-state plateau).
    - IPC queue depth must remain bounded $\le 10,000$ with zero telemetry runaway.
    - DOM node count must remain bounded $\le 500$ nodes via table virtualization.
    - Leak regression test: Memory delta across 10 project open/workload/close iterations must be $< 5\%$.

---

### 4.3 Test Runner Architecture & Command Specifications

#### 1. Test Tier Mapping & Invocations
| Tier | Description | Target Coverage | Exact Execution Command |
|---|---|---|---|
| **Tier 1** | Feature Performance & Latency Isolation | $\ge 5$ tests per feature (115-170 tests) | `cargo test --workspace --test tier1_feature_coverage` <br> `npx vitest run tests/components/ tests/design-system/ tests/stores/ tests/unit/` |
| **Tier 2** | Boundary, Extreme Datasets & Limits | $\ge 5$ tests per feature (115-170 tests) | `cargo test --workspace --test tier2_boundary_corner` <br> `npx vitest run tests/stress/` |
| **Tier 3** | Pairwise Combinations & Cross-Stream | $\ge 34$ pairwise tests | `cargo test --workspace --test cross_crate_security_integration` <br> `npx vitest run tests/stress/AdversarialChallengeUI1.test.tsx tests/stress/AdversarialChallengeUI2.test.tsx` |
| **Tier 4** | Real-World Pentester Workload & Soak | $\ge 17$ workload scenarios (17, 24, 34 steps) | `cargo test --workspace --test release_e2e_pipeline` <br> `cargo test --workspace --test hardening_chaos_recovery` <br> `python scripts/run_workflow_validation.py --suite all` <br> `python scripts/run_memory_soak.py --duration 14400 --interval 1800` |
| **Spec** | Specification & Security Conformance | 11-step canonical validator | `python architecture/v6/validate_v6_spec.py` |

#### 2. Master Automation Scripts Needed
1. `scripts/run_all_tiers.py`: Master orchestrator executing Tiers 1-4, spec validator, formatting, and generating unified pass/fail summary.
2. `scripts/generate_test_data.py`: High-speed synthetic test database and payload generator (100K, 500K, 1M transactions, 1MB-100MB payloads, 20K command palette items).
3. `scripts/run_memory_soak.py`: Long-run soak test harness with automated sampling at T0, T30m, T1h, T2h, T3h, T4h and leak regression analysis.
4. `scripts/run_workflow_validation.py`: Driver executing the 17-step, 24-step, and 34-step pentester suites with per-step latency logging.

---

## 5. Verification Method

To independently verify this investigation and the test runner infrastructure:

1. **Verify Rust Test Suite & Crate Compilation**:
   ```bash
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   cargo test --workspace --locked
   ```
2. **Verify Frontend Vitest & Stress Test Suite**:
   ```bash
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec"
   npm test
   npx vitest run tests/stress/
   ```
3. **Verify Canonical Specification Validator**:
   ```bash
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec"
   python architecture/v6/validate_v6_spec.py
   ```
4. **Inspect Handoff & Discovery Files**:
   - Inspect `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\sub_orch_e2e_perf\explorer_3\handoff.md`
   - Inspect `c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md`
   - Inspect `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\sub_orch_e2e_perf\SCOPE.md`

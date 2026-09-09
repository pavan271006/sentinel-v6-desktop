# SENTINEL V6 — FINAL EVOLUTION PLAN & ACTIONABLE PHASED ROADMAP
**Document ID**: `SENTINEL-SPEC-V6-EVO-003`  
**Version**: `6.0.0-PROD` (Evolution Path: `V6.1` -> `V6.2` -> `V6.3` -> `V6.4`)  
**Classification**: Authoritative Engineering Roadmap & Release Specification  
**Status**: APPROVED / ARCHITECTURE DIRECTIVE  
**Preserved Invariants**: SEC-01 through SEC-12 (Non-Negotiable)  

---

## 1. Evolutionary Vision & Master Release Timeline

The SENTINEL V6 platform evolution roadmap is structured across four sequential, production-gated releases (`V6.1` through `V6.4`). Every phase is self-contained, strictly backward-compatible, preserves all security invariants (`SEC-01` through `SEC-12`), and adheres to the **Complete 11-Point Architectural Schema**.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SENTINEL V6.x MASTER EVOLUTION ROADMAP                                 │
├───────────────┬──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ Release Phase │ Primary Focus Area                       │ Milestone Highlights                        │
├───────────────┼──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ V6.1          │ Foundation Hardening & High-Speed I/O    │ • HTTP/3 QUIC (RFC 9114) Proxy Engine       │
│               │                                          │ • Hyperscan SIMD Multi-Pattern DFA Matching │
│               │                                          │ • HTTP/2 Single-Packet Race Primitive       │
│               │                                          │ • WebWorker Offloaded Meyers AST Diff       │
├───────────────┼──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ V6.2          │ Engine Consolidation & Custom Engines    │ • Security Context Graph (DAG / SQLite CTE) │
│               │                                          │ • Adaptive Test Planner (Explainable "WHY") │
│               │                                          │ • Differential Security Engine              │
│               │                                          │ • Crate Consolidation (28 -> 18 Crates)     │
│               │                                          │ • Formal Removal of Research Stubs (Z3, RL) │
├───────────────┼──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ V6.3          │ Distributed Recon & OAST Scale           │ • OpenAPI 3.1 & JSON Schema 2020-12 Engine  │
│               │                                          │ • InQL GraphQL AST Complexity & Batching    │
│               │                                          │ • WebSocket Continuous Frame Fuzzing        │
│               │                                          │ • Parallel Multi-Role IRA+ Authz Matrix     │
│               │                                          │ • Stateless AES-256 OAST Scaling & SMTP     │
├───────────────┼──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ V6.4          │ Enterprise Continuous Retest & Cloud Sync│ • Policy-Gated Autonomous Security Agent    │
│               │                                          │ • Security Regression Graph Retest Runner   │
│               │                                          │ • Zero-Capability WASM Plugin Runtime       │
│               │                                          │ • Signed Ed25519 Research Packs             │
│               │                                          │ • Live Threat Ingestion (CISA KEV, NVD, GHSA│
└───────────────┴──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 2. Release V6.1: Foundation Hardening & High-Speed I/O

### 2.1 Release Objective
Upgrade the core network and parsing foundation to support modern protocols (HTTP/3 over QUIC), eliminate regex CPU bottlenecks via SIMD multi-pattern scanning, provide microsecond-accurate single-packet race condition synchronization, and offload diff computations to WebWorkers to ensure zero UI frame drops under 1,000,000 transaction workloads.

### 2.2 Capabilities Added
- **Native HTTP/3 QUIC Client & Proxy**: Full support for RFC 9114 (HTTP/3) and RFC 9000 (QUIC) stream interception, QPACK header decoding (RFC 9204), and UDP connection migration handling via `quinn` and `h3`.
- **Hyperscan / Vectorscan SIMD Multi-Pattern Scanner**: High-throughput signature matching using AVX2/AVX-512 CPU vector extensions for technology stack fingerprinting and passive vulnerability rules.
- **HTTP/2 Single-Packet Race Condition Primitive**: TCP/QUIC connection-level packet barrier synchronizer that holds the final byte of 20–50 multiplexed HTTP/2 streams and releases them simultaneously in a single network packet for microsecond-accurate TOCTOU/race-condition testing.
- **WebWorker Offloaded Meyers/Patience AST Diffing**: Asynchronous diff engine offloaded from React main thread with dynamic non-deterministic token masking (auto-ignoring dynamic timestamps, CSRF nonces, and random session IDs).

### 2.3 Capabilities Removed
- Legacy linear regex evaluation loops (`regex::RegexSet`) in passive context scanning.
- Synchronous main-thread LCS string diff calculation on large HTTP response bodies.

### 2.4 Dependencies & External Adapters
- Crate Additions: `quinn = "0.11"`, `h3 = "0.0.5"`, `h3-quinn = "0.0.6"`, `vectorscan = "0.1"`.
- Rust Toolchain: `rustc 1.97.1+` (Pinned edition 2021).
- External Adapters: None (pure Rust native implementations).

### 2.5 Security & Invariant Changes (SEC-01 through SEC-12)
- `SEC-01` (Scope): Gated pre-socket check applied to all QUIC UDP socket emissions prior to connection initialization.
- `SEC-10` (Triple Representation): Raw QPACK frames, parsed HTTP/3 headers, and normalized text streams preserved immutably in Content-Addressed Storage (CAS).
- `SEC-12` (Lossless Audit): QUIC connection migration and handshake events recorded in SQLite append-only audit stream.

### 2.6 IPC & Storage Schema Changes
- **IPC Contract**: Extended `UiTrafficEvent` in `V6_IPC_CONTRACTS.proto` with `protocol: "HTTP/3"` enum and `quic_stream_id: uint64`.
- **Storage Schema**: Added `quic_connection_id` index to `transactions` table in `V6_SQLITE_SCHEMA.sql`.

### 2.7 Performance Impact & Resource Budgets
- **Throughput**: MITM proxy processing capacity $\ge 35,000\text{ RPS}$ with full TLS 1.3/QUIC termination.
- **Memory Footprint**: Steady-state heap memory $\le 110\text{MB}$ under 100,000 active streams.
- **Diff Latency**: Meyers AST diff on 10MB response payload $\le 12\text{ms}$ (P95), zero dropped UI frames (solid 60 FPS).

### 2.8 Migration Impact & Backward Compatibility
- 100% backward compatible with existing V6 SQLite databases, CAS blob stores, and proxy configuration profiles.
- HTTP/3 automatically negotiated via ALPN (`h3`) with seamless fallback to HTTP/2 and HTTP/1.1.

### 2.9 Test Suite Requirements & Pass Criteria
- 100% unit tests pass across `sentinel_parser`, `sentinel_proxy`, and `sentinel_repeater`.
- Integration tests: HTTP/3 ALPN negotiation, stream multiplexing, and QPACK decompression across 50,000 synthetic transactions.
- Zero memory leaks, zero panics, zero unhandled async task errors under 1-hour sustained soak testing.

### 2.10 Rollback Strategy
- Configuration flag `enable_http3 = false` reverts network proxy layer to HTTP/1.1 and HTTP/2 runtime without requiring database rollbacks or client restarts.

### 2.11 Exit Criteria
- `cargo test --workspace --locked` passes with 0 failures.
- Specification validator `validate_v6_spec.py` passes 11/11 checks (0 blockers, 0 warnings).
- Smooth 60 FPS virtualized scrolling verified on 1,000,000 record traffic table.

---

## 3. Release V6.2: Engine Consolidation & Custom Proprietary Engines

### 3.1 Release Objective
Consolidate 28 fragmented crates into 18 high-cohesion architectural modules, formally eliminate dead-weight research stubs (Z3 SMT solver, Deep RL, Lattice reduction), and integrate the core SENTINEL proprietary engines: Security Context Graph, Adaptive Test Planner, and Differential Security Engine.

### 3.2 Capabilities Added
- **`crates/sentinel_graph` (Security Context Graph)**: Strongly-typed Directed Acyclic Graph (DAG) and SQLite Recursive Common Table Expression (CTE) engine linking Asset -> Service -> Endpoint -> Parameter -> Request -> Response -> Candidate -> Verification -> Evidence -> Finding.
- **`crates/sentinel_testing_lab` (Unified Testing Lab)**: Consolidated manual repeater workspace, multi-step state machine runner, and single-packet race prober with dynamic Hackvertor tag engine.
- **`AdaptiveTestPlanner`**: Deterministic information-gain utility selector optimizing expected risk discovery per unit RPS/timeout budget with explainable structured "WHY" proofs.
- **`DifferentialSecurityEngine`**: 5-dimensional AST, token, and statistical distribution divergence analyzer with Welch's t-test and dynamic noise masking.

### 3.3 Capabilities Removed
- `SUB-26 SmtSolverEngine` (Z3 symbolic execution for web DOM/JS).
- `SUB-27 RlStateEngine` (Deep Reinforcement Learning state machine).
- `SUB-28 CryptoAnalysisEngine` (Lattice reduction for asymmetric keys).
- Fragmented standalone crates: `sentinel_knowledge`, `sentinel_coverage`, `sentinel_context`, `sentinel_repeater`, `sentinel_logic`.

### 3.4 Dependencies & External Adapters
- Crate Additions: `petgraph = "0.6"`.
- Crate Removals: `z3`, `egg`, `rl_models` feature flags completely purged from `Cargo.toml`.

### 3.5 Security & Invariant Changes (SEC-01 through SEC-12)
- `SEC-05` (Research Isolation): Cleanly satisfied by purging unmaintained research stubs.
- `SEC-06` (Finding Proof Requirement): Verification Engine directly coupled with Differential Security Engine to guarantee cryptographic proof generation.
- `SEC-08` (Cross-Tenant Isolation): SQLite CTE graph queries strictly partitioned per project database.

### 3.6 IPC & Storage Schema Changes
- **IPC Contract**: Added `UiGraphUpdateEvent` and `UiPlannedTestEvent` to `V6_IPC_CONTRACTS.proto`.
- **Storage Schema**: Applied atomic migration `V6_SQLITE_SCHEMA_MIGRATION.sql` adding `graph_nodes_v2`, `planned_tests`, and `differential_baselines` while dropping `symbolic_proofs`, `app_state_machine`, and `crypto_weaknesses`.

### 3.7 Performance Impact & Resource Budgets
- **Graph Traversal Latency**: Bounded recursive attack-path discovery ($\text{depth} \le 5$) $\le 2.5\text{ms}$ (P95).
- **Binary Footprint**: Release binary size reduced by ~22MB through removal of heavy C++ runtime bindings.
- **Build Efficiency**: `cargo check` compile time improved by ~38%.

### 3.8 Migration Impact & Backward Compatibility
- Automated forward migration converts legacy `graph_nodes` and `endpoints` records into `graph_nodes_v2` with zero data loss.

### 3.9 Test Suite Requirements & Pass Criteria
- 100% Rust unit and integration tests passing across all 18 consolidated crates.
- Graph pathfinding stress tests asserting zero cyclic graph deadlocks on complex circular topologies.
- Differential engine negative control tests asserting 0% false positives on identical benign baseline pairs.

### 3.10 Rollback Strategy
- Database migration wrapped in atomic SQL transaction block (`BEGIN TRANSACTION ... COMMIT`); automated schema rollback restores snapshot on verification error.

### 3.11 Exit Criteria
- `python architecture/v6/validate_v6_spec.py` passes 11/11 checks (0 blockers).
- Full 7-workspace navigation functional with zero state loss and sub-50ms tab switching.

---

## 4. Release V6.3: Distributed Recon & OAST Scale

### 4.1 Release Objective
Deliver comprehensive modern API security testing capabilities (OpenAPI 3.1, InQL GraphQL AST analysis, WebSocket continuous frame fuzzing), parallelize the multi-role IRA+ authorization matrix, and scale the stateless AES-256 Out-of-Band (OAST) server with multi-protocol DNS/HTTP/SMTP callback correlation.

### 4.2 Capabilities Added
- **OpenAPI 3.1 & JSON Schema 2020-12 Engine**: Automated endpoint extraction, dynamic parameter inference, and schema-compliant fuzz-template generator.
- **InQL GraphQL AST Prober**: Automated introspection schema harvester, query complexity depth calculator, circular recursion prober, and query batching (`system.multicall`) differential prober.
- **WebSocket Continuous Frame Fuzzer**: Full-duplex WebSocket stream inspector, frame mutator, and connection state monitor.
- **Parallel Multi-Role Authorization Matrix (IRA+)**: Concurrent cross-role differential prober (Admin, Tenant A, Tenant B, Anonymous) with rate-limiting backpressure and automated OAuth2 PKCE token refreshes.
- **Stateless AES-256 OAST Scaling**: Multi-protocol correlation listener supporting custom DNS zones, HTTP/HTTPS endpoints, and SMTP email callback triggers.

### 4.3 Capabilities Removed
- Sequential single-role authorization replay loops.
- Heuristic regex-based GraphQL introspection parsers.

### 4.4 Dependencies & External Adapters
- Crate Additions: `async-tungstenite = "0.28"`, `graphql-parser = "0.4"`, `trust-dns-server = "0.23"`.
- External Adapters: Normalized OpenAPI 3.1 and Postman Collection v2.1 import adapters.

### 4.5 Security & Invariant Changes (SEC-01 through SEC-12)
- `SEC-02` (Target Redaction): OAST listener utilizes stateless AES-256-GCM tokens containing encrypted project IDs; zero plaintext target identifiers exposed in external DNS lookups.
- `SEC-09` (Secret Redaction): Multi-role OAuth2 client secrets and refresh tokens managed strictly via `SecretReference` in OS Keychain Enclave.

### 4.6 IPC & Storage Schema Changes
- **IPC Contract**: Added `UiOastCallbackEvent` and `UiAuthzMatrixResultEvent` to Protobuf schema.
- **Storage Schema**: Added `oast_callbacks` and `authz_matrix_results` tables with covering indexes in SQLite schema.

### 4.7 Performance Impact & Resource Budgets
- **AuthZ Matrix Throughput**: Parallel evaluation across 10 roles $\le 450\text{ms}$ per endpoint.
- **GraphQL AST Parsing**: Introspection analysis and complexity score computation for 500-type schema $\le 8\text{ms}$.
- **OAST Correlation Latency**: Inbound DNS/HTTP callback decryption and event bus dispatch $\le 1.2\text{ms}$.

### 4.8 Migration Impact & Backward Compatibility
- Existing project databases automatically create `oast_callbacks` and `authz_matrix_results` tables on initial load.

### 4.9 Test Suite Requirements & Pass Criteria
- Integration test suite against local deliberately vulnerable lab (`tests/vulnerable_lab/`):
  - 100% detection of seeded BOLA, IDOR, BFLA, and GraphQL batching vulnerabilities.
  - 0% false positives on remediated and benign control endpoints.
- High-concurrency OAST callback storm test: 10,000 asynchronous callbacks/sec with 0 dropped events.

### 4.10 Rollback Strategy
- Feature flags `enable_oast_server = false` and `enable_graphql_prober = false` isolate capabilities without impacting core traffic proxy.

### 4.11 Exit Criteria
- 100% test pass rate across all API security and authorization test suites.
- `cargo clippy --workspace --all-targets --all-features` passes with 0 warnings.

---

## 5. Release V6.4: Enterprise Continuous Retest & Cloud Sync

### 5.1 Release Objective
Deploy the policy-gated autonomous security testing agent (`sentinel_agentic`), enforce zero-capability sandboxing for WebAssembly plugins, automate closed-loop vulnerability retesting via the Security Regression Graph, enable signed Ed25519 research packs, and ingest real-time threat intelligence from CISA KEV, NVD, and GHSA feeds.

### 5.2 Capabilities Added
- **`crates/sentinel_agentic` (Autonomous Security Agent)**: Policy-gated autonomous testing agent with typed tool execution, risk budget governor, and host-side AI policy gate (`AiPolicyEngine`) blocking prompt injections and destructive command generation (`SEC-03`).
- **Security Regression Graph Retest Runner**: Automated retest state machine (`VULNERABLE -> RETEST_DISPATCHED -> FIXED / REGRESSED`) replaying immutable raw CAS evidence payloads.
- **Zero-Capability WebAssembly Plugin Runtime (`PluginRuntime`)**: Wasmtime sandbox enforcing explicit capability grants for third-party extensions (`SEC-04`).
- **Signed Ed25519 Research Packs**: Cryptographically signed update packs for offline rule libraries, fuzzing dictionaries, and vulnerability signatures.
- **Live Vulnerability Intelligence Ingestion**: Real-time correlation of CISA KEV, NVD, and GHSA advisories against verified technology stack context.
- **Enterprise SIEM & Multi-Tenant Exporter**: Structured CEF / Syslog audit event streaming and physical project file encryption (`SEC-08`).

### 5.3 Capabilities Removed
- Uncontained native script execution hooks.
- Unsigned plugin loading mechanisms.

### 5.4 Dependencies & External Adapters
- Crate Additions: `wasmtime = "24.0"`, `ed25519-dalek = "2.1"`.
- External Adapters: Sandboxed runtime adapters for Subfinder, Nmap, Semgrep with non-root privilege dropping and cgroup memory limits.

### 5.5 Security & Invariant Changes (SEC-01 through SEC-12)
- `SEC-01` (Scope Gate): 100% of autonomous agent actions intercepted and validated by pre-socket `ScopeEngine`.
- `SEC-03` (Host-Side AI Gate): Model outputs verified through deterministic host-side policy gate prior to socket dispatch.
- `SEC-04` (Zero-Capability WASM): Unauthorized WASI system calls trigger immediate `SandboxViolation` and process termination.
- `SEC-07` (CAS Immutability): Retest engine extracts raw replay bytes exclusively from cryptographic SHA-256 CAS BlobStore.
- `SEC-12` (Audit Journal): Lossless cryptographic record of every agent action and retest result written to append-only WAL journal.

### 5.6 IPC & Storage Schema Changes
- **IPC Contract**: Added `UiAgentActionEvent`, `UiRegressionRetestEvent`, and `UiPackInstalledEvent` to Protobuf schema.
- **Storage Schema**: Added `regression_retests`, `research_packs`, and `vulnerability_intel` tables to SQLite schema.

### 5.7 Performance Impact & Resource Budgets
- **Agent Reasoning Latency**: Host-side policy evaluation $\le 5\text{ms}$ per action.
- **WASM Plugin Startup**: Sandbox initialization $\le 1.8\text{ms}$.
- **Memory Governor**: Autonomous agent worker memory strictly capped at $\le 256\text{MB}$.

### 5.8 Migration Impact & Backward Compatibility
- Fully backward compatible with all V6.x project files, session stores, and research pack manifests.

### 5.9 Test Suite Requirements & Pass Criteria
- Security red-team test suite asserting:
  - 100% of indirect prompt injection attacks intercepted by `AiPolicyEngine`.
  - 100% of out-of-scope agent actions blocked with `ScopeViolation`.
  - 100% of unsigned research packs rejected by `ResearchPackManager`.
- End-to-end regression retest verifying `VULNERABLE -> FIXED` transition on patched endpoints.

### 5.10 Rollback Strategy
- Agentic testing and WASM plugins can be globally disabled via desktop settings (`agentic_testing_enabled = false`, `plugins_enabled = false`).

### 5.11 Exit Criteria
- Complete 34-step pentester validation executed and verified on native release build.
- `SENTINEL_V6_IMPLEMENTATION_COMPLETE.md` generated with formal release attestation.

---

## 6. Comprehensive Phase Summary & Metrics Matrix

| Metric / Attribute | V6.1 (Foundation) | V6.2 (Consolidation) | V6.3 (API & OAST) | V6.4 (Agentic & Retest) |
|:---|:---:|:---:|:---:|:---:|
| **Workspace Crates** | 28 | 18 | 18 | 18 |
| **HTTP Protocols** | 1.1, 2, 3 (QUIC) | 1.1, 2, 3 (QUIC) | 1.1, 2, 3 (QUIC) + WS | 1.1, 2, 3 + WS + gRPC |
| **Active Workspaces** | 7 Primary Shell | 7 Primary Shell | 7 Primary Shell | 7 Primary Shell |
| **Proprietary Engines** | Base Foundation | Graph, Planner, Diff | + Regression Graph | + Engagement Memory & Agent |
| **Max Safe RPS** | 35,000 | 45,000 | 50,000 | 50,000 |
| **Peak Memory (1M items)**| 110 MB | 92 MB | 96 MB | 124 MB |
| **Pass Criteria** | 100% Tests Pass | 100% Tests Pass | 100% Tests Pass | 100% Tests Pass |
| **Invariants Enforced** | SEC-01..SEC-12 | SEC-01..SEC-12 | SEC-01..SEC-12 | SEC-01..SEC-12 |

---

## 7. Architectural Attestation & Final Sign-off

The SENTINEL V6 Final Evolution Plan establishes an unambiguous, actionable engineering path. Every phase enforces strict quality gates, preserves all security invariants, optimizes hardware utilization, and delivers an unmatched pentesting workstation for offensive security professionals.

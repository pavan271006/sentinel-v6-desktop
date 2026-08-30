# SENTINEL V6 ARCHITECTURAL SURVEY & CROSS-CUTTING SPECIFICATION REPORT

> **AUTHOR**: `explorer_survey_3` (Teamwork Preview Explorer)  
> **DATE**: 2026-08-17  
> **TARGET DIRECTORY**: `c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6`  
> **SCOPE**: Comprehensive survey of protocols, scanner/fuzzer, plugin sandbox, research modules, AI security, security invariants & testing, and total cross-file consistency across all 27 architecture files.

---

## 1. Executive Summary & Problem Statement

SENTINEL V6 is engineered as "The Security Researcher's Operating Environment" — a unified desktop-first platform unifying traffic interception, passive/active asset discovery, fuzzer-driven candidate generation, empirical verification, and multi-tenant project management.

An exhaustive, multi-dimensional audit of all 27 files in `architecture/v6` reveals that while the high-level architecture is mature and conceptually rigorous, **severe contract divergences, arithmetic contradictions, trait signature mismatches, missing protocol abstractions, and phantom document references exist across the markdown specifications, Rust scaffolding (`V6_COMMON_TYPES.rs`), Protobuf contracts (`V6_IPC_CONTRACTS.proto`), and SQL schemas (`V6_SQLITE_SCHEMA.sql`)**.

These issues represent critical blockers for code implementation and automated verification. This report provides the definitive empirical survey, cross-file inconsistency matrix, canonical taxonomy requirements, and concrete repair strategies required for `V6_CANONICAL_SPEC.yaml` and the automated specification validator.

---

## 2. Protocols & Traffic Engine: Explicit Protocol Separation

### 2.1 Current State Analysis
In the current architecture files:
- `V6_FINAL_ARCHITECTURE.md` (Section 6.1) and `V6_FINAL_IMPLEMENTATION_CONTRACT.md` (Section 1) frame the `ProxyEngine` primarily around HTTP/1.1 and general HTTP/2.
- `V6_COMMON_TYPES.rs` provides `HttpParsedParts`, `TlsData`, and `MessageRepresentation`, but lacks explicit struct models for HTTP/3, QUIC, WebSocket frames, Server-Sent Events (SSE), and gRPC streaming.
- `V6_SQLITE_SCHEMA.sql` stores `transactions` with columns for `req_method`, `req_uri`, `req_blob_id`, `res_status`, and `tls_cipher`, without protocol discriminator or frame-specific metadata.
- `V6_FINAL_PENTESTER_PRODUCTIVITY.md` (Section 4) specifies: *"Repeater Interface ... Must support WebSocket message interception."*
- `V6_IPC_CONTRACTS.proto` defines gRPC strictly for the out-of-process `BrowserDaemon`, but platform traffic inspection lacks native gRPC message dissectors.

### 2.2 Required Protocol Taxonomy & Canonical Framing
To satisfy architectural requirements and prevent protocol ambiguity during proxying, fuzzing, and storage, the platform must explicitly differentiate the following protocol layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION PROTOCOLS                         │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ │
│  │   HTTP/1.1    │ │    HTTP/2     │ │ HTTP/3 / QUIC │ │  WebSocket   │ │
│  │ Text Framing  │ │Binary Streams │ │ QPACK/Streams │ │ Frame/Opcode │ │
│  ├───────────────┤ ├───────────────┤ ├───────────────┤ ├──────────────┤ │
│  │      SSE      │ │     gRPC      │ │    GraphQL    │ │ Raw TCP/TLS  │ │
│  │ Event Stream  │ │ Protobuf Encap│ │ App Payload   │ │ Byte Tunnel  │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                          TRANSPORT & SECURITY                           │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │      TLS 1.2 / TLS 1.3        │   │          QUIC (UDP)           │  │
│  │ ALPN (h2, http/1.1), SNI, Cert│   │ Connection ID, Packet Number  │  │
│  └───────────────────────────────┘   └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Protocol Specifications:
1. **HTTP/1.1**:
   - Preserves raw bytes, header whitespace/case, malformed delimiter edge cases, chunked transfer encoding, and pipelining.
   - Defends against and tests HTTP request smuggling (`CL.TE`, `TE.CL`, `TE.TE`).
2. **HTTP/2**:
   - Explicit multiplexed stream model: `stream_id`, stream state, dependency tree, weight, priority frames, `RST_STREAM`, `GOAWAY`, and `SETTINGS`.
   - Header compression handling via HPACK state management.
   - Single-packet race condition testing across multiple concurrent streams.
3. **HTTP/3 & QUIC**:
   - UDP datagram handling, connection ID negotiation, packet numbering, 0-RTT handshakes, QPACK static/dynamic table compression.
   - Detection of HTTP/3 upgrade headers (`Alt-Svc: h3=":443"`).
4. **WebSocket (RFC 6455)**:
   - Full duplex frame dissection: `fin`, `rsv1-3`, `opcode` (Continuation, Text, Binary, Close, Ping, Pong), `mask_key`, `payload_len`, and payload bytes.
   - Message-level reconstruction and per-message interception in UI Repeater.
5. **Server-Sent Events (SSE)**:
   - Stream parser recognizing `event`, `data`, `id`, `retry`, and multi-line event payloads over long-lived HTTP responses.
6. **gRPC / gRPC-Web**:
   - Dissection of HTTP/2 framing with gRPC encapsulation (Compressed-Flag: 1 byte, Message-Length: 4 bytes, Protobuf-Message: N bytes).
   - Extraction of gRPC status codes (`grpc-status`), status messages (`grpc-message`), and custom trailers.
7. **TLS & Cryptographic Negotiation**:
   - Tracking of TLS version, cipher suite, SNI hostname, ALPN negotiated protocol, certificate chain fingerprint, and JA3/JA4 fingerprinting.

---

## 3. Scanner & Fuzzer Architecture Specification

### 3.1 The Canonical Vulnerability Discovery Pipeline
The architecture strictly enforces a 6-stage unidirectional lifecycle:

$$\text{Transaction} \longrightarrow \text{Observation} \longrightarrow \text{Candidate} \longrightarrow \text{VerificationResult} \longrightarrow \text{Evidence} \longrightarrow \text{Finding}$$

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Transaction  │ ──> │ Observation  │ ──> │  Candidate   │
│ Raw HTTP/Net │     │ Extracted Tx │     │ Hypothesis   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Finding    │ <── │   Evidence   │ <── │ Verification │
│ Verified Bug │     │ Crypto/Diff  │     │ Result       │
└──────────────┘     └──────────────┘     └──────────────┘
```

1. **Transaction**: The immutable captured network exchange (request + response + timing + metadata).
2. **Observation**: A deterministic phenomenon extracted from a transaction (e.g., parameter reflection, syntax error, anomaly, tech stack header).
3. **Candidate**: An unverified vulnerability hypothesis created by detection heuristics (e.g., "Parameter `id` is potentially vulnerable to SQLi").
4. **VerificationResult**: The output produced by an active verification engine executing a specific confirmation strategy.
5. **Evidence**: Mathematically or empirically undeniable proof (e.g., differential AST comparison, out-of-band cryptographic callback, timing variance distribution).
6. **Finding**: A confirmed vulnerability containing severity, lifecycle status, verified evidence link, reproduction steps, and remediation guidance.

### 3.2 Fuzzer Engine Components & Data Model

The `FuzzerEngine` (SUB-08) generates mutated requests to test injection points while respecting strict rate and resource limits.

| Component | Specification & Canonical Fields |
|---|---|
| **`FuzzProfile`** | `profile_id: Uuid`, `insertion_points: Vec<InsertionPoint>`, `mutators: Vec<MutatorType>`, `encoders: Vec<PayloadEncoder>`, `oracles: Vec<FuzzOracle>`, `resource_budget: ResourceBudget`, `concurrency: u32`, `timeout_ms: u64`, `stop_conditions: Vec<StopCondition>` |
| **`MutatorType`** | `BitFlip`, `ByteReplace`, `Grammar(GrammarRule)`, `Wordlist(WordlistRef)`, `Radamsa`, `Boundary`, `UnicodeNormalization`, `Truncation`, `FormatString`, `AiAssisted(AiPromptTemplate)` |
| **`InsertionPoint`** | `location: ParamLocation` (Query, Body, Header, Path, Cookie, JsonPath, XPath, MultipartField, GraphQLVariable, WebSocketFrame), `name: String`, `base_value: String`, `prefix: Option<String>`, `suffix: Option<String>` |
| **`FuzzOracle`** | `oracle_type: OracleType` (StatusCodeDifferential, RegexMatch, TimingThreshold, ErrorSignature, JsonSchemaDifferential, AstDifferential, OastTrigger), `parameters: HashMap<String, String>` |
| **`ResourceBudget`** | `max_requests: u64`, `max_duration_secs: u64`, `max_memory_mb: u32`, `max_concurrency: u32`, `max_bandwidth_bytes: u64` |
| **`Minimization`** | Causal delta debugging algorithm isolating minimal triggering payload slice from crashing/fuzzing strings. |
| **`Replay`** | `ReplayConfig` (`exact_timing: bool`, `use_original_identity: bool`, `follow_redirects: bool`), returning deterministic `ReplayResult`. |
| **`StopCondition`** | `MaxRequestsReached(u64)`, `MaxDurationReached(u64)`, `FindingCountReached(u32)`, `TargetUnresponsive(u32)`, `ErrorRateThresholdExceeded(f32)`, `ScopePolicyViolation`, `UserCancelled` |

---

## 4. Plugin Security & Sandbox Architecture

### 4.1 Capability-Based Permissions vs. Resource Limits
The architecture bifurcates security permissions (`CapabilitySet`) from execution constraints (`ResourceLimits`) to ensure default-deny isolation:

```
                       ┌───────────────────────────────┐
                       │     PluginSandboxConfig       │
                       └──────────────┬────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│       CapabilitySet       │                   │      ResourceLimits       │
│      (What it CAN do)     │                   │     (How MUCH it can use) │
├───────────────────────────┤                   ├───────────────────────────┤
│ • network: bool (default F)│                  │ • max_memory_mb: u32      │
│ • filesystem: bool (def F)│                   │ • max_execution_ms: u64   │
│ • secrets: bool (def F)   │                   │ • max_network_requests:u32│
│ • database_read: bool     │                   │ • max_disk_bytes: u64     │
│ • browser_ipc: bool       │                   │ • max_cpu_percent: u32    │
└───────────────────────────┘                   └───────────────────────────┘
```

### 4.2 Sandboxing Boundaries by Plugin Class
1. **Rhai Scripting**:
   - In-process execution within strict Rhai AST limits and call depth bounds.
   - Used exclusively for quick transforms, HTTPQL custom matchers, and token decoders.
2. **WASM (Wasmtime Runtime)**:
   - Out-of-memory isolation with strict WASI capability stripping (`wasi_common` without ambient fs or socket rights).
   - Network calls from WASM must route through the host's `ScopeEngine`. Direct TCP socket binding is blocked at the VM interface.
   - Default state: `network = false`, `filesystem = false`, `secrets = false`. User must explicitly grant capabilities via UI modal.
3. **External Tool Adapters (`ExternalToolAdapter`)**:
   - Out-of-process CLI wrappers (Subfinder, CloudFox, Semgrep) executing as subprocesses.
   - Communicates strictly via STDIN / STDOUT JSON pipes with no shared memory.
   - Read-only default execution. Write operations (e.g. CloudFox mutation) require interactive `CloudWriteApproval`.
4. **Supply Chain & Research Pack Signing**:
   - Research packs contain YAML rules and WASM modules packaged in cryptographically signed bundles.
   - Ed25519 signatures verified against trusted maintainer public keys before loading.
   - Unsigned packs prompt explicit security warnings and execute in isolated quarantine mode.
5. **License Isolation (LGPL/GPL Containment)**:
   - No GPL/LGPL code may be statically or dynamically linked into the Sentinel core Rust binary.
   - Tools like Semgrep (LGPL) are wrapped strictly via external subprocess IPC.

---

## 5. Research Modules Architecture

### 5.1 Subsystems & Tier Classification
The SENTINEL architecture defines three research-grade engines:
- **SUB-26: `SmtSolverEngine`**: Formal verification and symbolic execution using Z3 solver bindings to prove logic flaws in authentication state machines.
- **SUB-27: `RlStateEngine`**: Reinforcement learning engine modeling application transitions via deep Q-learning / state-space exploration.
- **SUB-28: `CryptoAnalysisEngine`**: Cryptanalysis module performing lattice reduction, nonce reuse detection, and weak entropy extraction from captured handshakes.

### 5.2 Isolation & Non-Core Invariants
1. **Feature Gating**:
   - All research code, dependencies (e.g., Z3 C++ bindings, libtorch/tch-rs), and traits are isolated behind the Cargo feature flag `#[cfg(feature = "sentinel-research")]`.
   - The platform MUST compile, pass 100% of unit/integration tests, and package for production with `default-features = false` (excluding research modules).
2. **Memory & CPU Isolation**:
   - SMT solving and RL training must execute in separate background OS processes or bounded worker threads with strict memory limits (e.g., max 1GB RAM) and hard timeouts (e.g., 30s per proof).
   - SMT solver timeouts or memory exhaustions must emit `SentinelError::ResourceExhausted` and fail gracefully without crashing the core `ScanOrchestrator`.
3. **Strict Acyclic Dependency Topology**:
   - Direction of dependency: `Core -> Adapter -> Pro -> Research`. Core subsystems (SUB-01 through SUB-14) must never depend on or import Research subsystems.

---

## 6. AI Security & Host-Side Policy Engine

### 6.1 Principles & AI Optionality
1. **AI as Acceleration Only**:
   - AI generates hypotheses, crafts complex payloads, or assists in tech stack classification. Deterministic core engines verify and execute.
   - The entire platform remains 100% operational when `AiEngine::is_available() == false` or AI API keys are not provided.
2. **Untrusted Target Data Principle**:
   - Target HTTP response bodies, error messages, headers, and reflected inputs are treated as hostile, untrusted data containing potential indirect prompt injections.

### 6.2 5-Layer Defense Architecture (`AIPolicyEngine`)

```
               Incoming Prompt / Target Context
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ LAYER 1: Input Sanitization & Regex Guard                 │
│ Block obvious prompt leaks ("ignore instructions", etc.)  │
└─────────────────────────────┬─────────────────────────────┘
                              │ Passed
                              ▼
┌───────────────────────────────────────────────────────────┐
│ LAYER 2: Host LLM Analysis with Structured JSON Schema    │
│ Enforces required fields: hypothesis, payload, confidence │
└─────────────────────────────┬─────────────────────────────┘
                              │ Structured Response
                              ▼
┌───────────────────────────────────────────────────────────┐
│ LAYER 3: Destructive Pattern Filter                       │
│ Blocks dangerous strings: DROP TABLE, rm -rf, mkfs, etc.  │
└─────────────────────────────┬─────────────────────────────┘
                              │ Filter Passed
                              ▼
┌───────────────────────────────────────────────────────────┐
│ LAYER 4: ScopeEngine Enforcement                          │
│ Verifies target host/IP matches project ScopeDecision     │
└─────────────────────────────┬─────────────────────────────┘
                              │ In Scope
                              ▼
┌───────────────────────────────────────────────────────────┐
│ LAYER 5: Human Approval Gate (High-Risk Actions)          │
│ Displays interactive approval dialog for mutation actions │
└─────────────────────────────┬─────────────────────────────┘
                              │ Approved
                              ▼
                   Safe Network Execution
```

- **Policy Outcomes**: `PolicyResult::Approved`, `PolicyResult::Blocked(Reason)`, `PolicyResult::Filtered(String)`, `PolicyResult::RequiresHumanApproval(Action)`.
- **Elimination of Absolute Claims**: All previous claims of "99% prompt injection block rate" or "0 false positives" have been purged in favor of empirical defense-in-depth metrics.

---

## 7. Security Invariants & Testing Architecture

### 7.1 Consolidated Security Invariants Matrix
Synthesizing `V6_FINAL_SECURITY_INVARIANTS.md`, `V6_FINAL_ARCHITECTURE.md`, and `V6_FINAL_SECURITY_REVIEW.md`, the platform enforces 12 non-negotiable security invariants:

| # | Invariant | Description & Enforcement Mechanism |
|---|---|---|
| **INV-01** | **Scope Authorization** | No active outbound network packet may be transmitted without an explicit `ScopeDecision::Allowed` from `ScopeEngine`. Fails closed. |
| **INV-02** | **OAST Token Confidentiality** | Out-of-band tokens must use AES-256-GCM encryption with zero plaintext target identification. |
| **INV-03** | **Host AI Policy Gate** | AI cannot trigger network requests autonomously; all AI payloads must pass `AiPolicyEngine` and `ScopeEngine`. |
| **INV-04** | **WASM Capability Drop** | WASM plugins execute in Wasmtime with default-deny capabilities (`network=false`, `filesystem=false`). |
| **INV-05** | **Research Module Optionality** | Research engines (SMT, RL, Crypto) are feature-flagged (`sentinel-research`) and isolated outside the core critical path. |
| **INV-06** | **Verification Requirement** | No `Candidate` can transition to `Finding` without empirical, differential, or cryptographic `Evidence`. |
| **INV-07** | **Evidence Immutability** | Evidence blobs are content-addressed (SHA-256) and immutable once committed to storage. |
| **INV-08** | **Cross-Tenant Project Isolation**| SQLite databases and blob directories are physically partitioned per project. |
| **INV-09** | **Zero Plaintext Secrets** | Credentials, API keys, and session tokens must use `SecretReference` pointing to OS Keychain / AES vault; never logged or serialized to telemetry. |
| **INV-10** | **Triple Representation** | Raw network bytes are preserved alongside parsed and normalized representations; raw data is never normalized away. |
| **INV-11** | **WebView Sandbox Isolation** | Tauri UI WebView never renders untrusted target HTML directly; scanning browser is isolated out-of-process (`BrowserDaemon`). |
| **INV-12** | **Bounded Buffer Backpressure** | All channels and queues enforce bounded buffers with explicit overflow handling (drop-on-lag for telemetry, backpressure for critical). |

### 7.2 4-Tier Test Architecture
1. **Unit Testing**: 100% branch coverage on parsers (`HttpParser`, `OpenApiParser`), mutators (`FuzzerEngine`), and ACL logic (`ScopeEngine`).
2. **Property-Based & Differential Fuzzing**: `proptest` and `cargo-fuzz` differential campaigns testing `HttpParser` against `hyper` and `httparse` to detect desync/smuggling discrepancies.
3. **Integration Testing**: In-memory SQLite WAL database testing using `sqlx::test` across `ObservationStore` and `KnowledgeEngine`.
4. **End-to-End Acceptance Testing**: 12-step autonomous and manual pentest scenario against local Docker containers (OWASP Juice Shop / DVWA), verifying the entire detection-to-reporting lifecycle without panics or memory leaks.

---

## 8. Cross-File Inconsistency Matrix (All 27 Files Audited)

The following table provides the comprehensive catalog of discrepancies, broken cross-references, naming splits, and missing contracts across the 27 files in `architecture/v6`:

| # | Conflict Category | Source File 1 | Source File 2 | Description of Conflict | Severity | Proposed Repair Action |
|---|---|---|---|---|---|---|
| **C-01** | **Subsystem Count Arithmetic** | `V6_FINAL_ARCHITECTURE.md` (Line 815) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_FINAL_INTERFACE_REGISTRY.md` | Architecture states `31 → 22 (14 CORE, 7 PROFESSIONAL, 4 ADAPTER, 3 RESEARCH)`. The math $14+7+4+3=28$, not 22. Manifest lists 28. | **BLOCKER** | Correct count to `28` repository-wide in all summaries and text. |
| **C-02** | **Obsolete Subsystem Names** | `V6_FINAL_ARCHITECTURE.md` (Section 2), `V6_SQLITE_SCHEMA.sql` (Section 9) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` | Old names `CasmEngine`, `CloudEngine`, `SastEngine`, `ApiDiscoveryEngine` remain in Architecture Section 2 and SQL table names (`casm_assets`, `sast_findings`), while Manifest uses `SubfinderAdapter`, `CloudFoxAdapter`, `SemgrepAdapter`, `OpenApiParser`. | **BLOCKER** | Standardize on `SubfinderAdapter`, `CloudFoxAdapter`, `SemgrepAdapter`, `OpenApiParser` across all files, schemas, and types. |
| **C-03** | **`ScopeEngine` Return Type Divergence** | `V6_FINAL_ARCHITECTURE.md` (Line 248) | `V6_COMMON_TYPES.rs` (Line 309), `V6_FINAL_SECURITY_INVARIANTS.md` | Architecture defines `is_in_scope(&self, uri: &str) -> bool`, but Rust contract and Security Invariants mandate returning structured `ScopeDecision`. | **BLOCKER** | Update trait signature in `V6_FINAL_ARCHITECTURE.md` and `V6_FINAL_INTERFACE_REGISTRY.md` to return `ScopeDecision`. |
| **C-04** | **`HttpParser` Trait Signature Split** | `V6_FINAL_ARCHITECTURE.md` (Line 189) | `V6_COMMON_TYPES.rs` (Line 296) | Architecture defines `serialize_request`, `serialize_response` and returns `ParseError`, while Rust contract omits serialization methods and returns `SentinelError`. | **BLOCKER** | Unify `HttpParser` trait in canonical spec to include serialization methods and canonical error handling. |
| **C-05** | **Missing Trait Methods in Rust Scaffolding** | `V6_FINAL_ARCHITECTURE.md` (Sections 6-7) | `V6_COMMON_TYPES.rs` (Sections 7-8) | `V6_COMMON_TYPES.rs` omits critical methods defined in Architecture: `TaskScheduler` (`pause`, `resume`, `status`, `restore_checkpoint`), `ScanOrchestrator` (`resume_scan`, `cancel_scan`), `IdentityManager` (`add_credential`, `list_identities`, `refresh_credential`), `KnowledgeEngine` (`query_neighbors`, `resolve_entity`), `BrowserService` (`screenshot`, `close`), `PluginRuntime` (`load_rhai`, `unload`). | **BLOCKER** | Expand Rust trait definitions in `V6_COMMON_TYPES.rs` to match the full canonical interface contract. |
| **C-06** | **MutatorType Enum Divergence** | `V6_FINAL_ARCHITECTURE.md` (Line 369) | `V6_COMMON_TYPES.rs` (Line 53) | Architecture lists `BitFlip, ByteReplace, Wordlist, Grammar(String), Boundary, Unicode, Truncation`. Rust defines `BitFlip, ByteReplace, Grammar, Wordlist, Radamsa, AI`. | **BLOCKER** | Harmonize `MutatorType` enum across YAML, Markdown, and Rust to contain the superset of supported mutators. |
| **C-07** | **Plugin Sandbox Configuration Split** | `V6_FINAL_ARCHITECTURE.md` (Line 643) | `V6_COMMON_TYPES.rs` (Line 477), `V6_FINAL_TYPE_REGISTRY.md` | Architecture conflates capabilities and limits in `Capabilities` struct, while Type Registry and Rust contract properly bifurcate into `CapabilitySet` and `ResourceLimits`. | **BLOCKER** | Update Architecture markdown to adopt the bifurcated `CapabilitySet` and `ResourceLimits` model. |
| **C-08** | **Missing Schema Columns for Protocol & Scope** | `V6_SQLITE_SCHEMA.sql` | `V6_COMMON_TYPES.rs`, `V6_FINAL_DOMAIN_MODEL.md` | `transactions` table lacks `protocol` (HTTP/1.1, H2, H3, WS, SSE, gRPC) and `stream_id` columns; `observations` table lacks `scope_id` foreign key. | **BLOCKER** | Update `V6_SQLITE_SCHEMA.sql` to include protocol framing columns and foreign key relations. |
| **C-09** | **Missing Protobuf Event for Candidate Verification** | `V6_IPC_CONTRACTS.proto` | `V6_COMMON_TYPES.rs` (Line 327), `V6_FINAL_EVENT_REGISTRY.md` | `CriticalEvent::CandidateVerified` is defined in Rust and Event Registry, but has no corresponding message in Protobuf `SentinelUiStream`. | **WARNING** | Add `UiCandidateVerifiedEvent` to `V6_IPC_CONTRACTS.proto` and map in `SentinelUiStream`. |
| **C-10** | **Phantom Document References** | `V6_FINAL_CONSISTENCY_REPORT.md`, `V6_FINAL_RISK_REGISTER.md` | File System | Documents reference non-existent files: `SENTINEL_V6_FINAL_PRACTICAL_ARCHITECTURE.md`, `V6_IMPLEMENTATION_DEPENDENCY_GRAPH.md`, `V6_FINAL_ADRS.md`. | **WARNING** | Update markdown references to point to actual existing filenames (`V6_FINAL_ARCHITECTURE.md`, `V6_FINAL_DEPENDENCY_GRAPH.md`). |
| **C-11** | **`AuthzMatrix` Hash Map Key Typing** | `V6_FINAL_ARCHITECTURE.md` (Line 560) | `V6_COMMON_TYPES.rs` (Line 444) | Architecture uses `HashMap<(Uuid, Uuid), AccessLevel>`, while Rust uses `HashMap<Uuid, AccessLevel>` (losing the dual identity-endpoint coordinate). | **BLOCKER** | Fix `AuthzMatrix` in `V6_COMMON_TYPES.rs` to use `(Uuid, Uuid)` or a dedicated `MatrixCoordinate` key struct. |
| **C-12** | **Incomplete License Matrix** | `V6_FINAL_LICENSE_MATRIX.md` | `V6_FINAL_SUBSYSTEM_MANIFEST.md` | License table omits `Z3` theorem prover (used by `SmtSolverEngine`), despite mentioning Semgrep, CloudFox, and Subfinder. | **WARNING** | Add `Z3` (MIT License) to `V6_FINAL_LICENSE_MATRIX.md`. |

---

## 9. Taxonomy & Requirements for `V6_CANONICAL_SPEC.yaml`

The creation of `V6_CANONICAL_SPEC.yaml` (accompanied by `V6_CANONICAL_SPEC_SCHEMA.yaml`) will serve as the single machine-readable source of truth for the entire architecture.

### 9.1 Mandatory Top-Level YAML Hierarchy
The canonical specification must contain the following top-level keys:

```yaml
version: "6.1.0"
metadata:
  date: "2026-08-17"
  status: "AUTHORITATIVE"
  authority: "SENTINEL Architecture Team"

subsystems:
  # 28 subsystems strictly classified by tier
  core: [...]        # 14 subsystems (SUB-01 .. SUB-14)
  professional: [...]# 7 subsystems (SUB-15 .. SUB-21)
  adapter: [...]     # 4 subsystems (SUB-22 .. SUB-25)
  research: [...]    # 3 subsystems (SUB-26 .. SUB-28)

protocols:
  # Explicit separation and framing
  http1_1: {...}
  http2: {...}
  http3_quic: {...}
  websocket: {...}
  sse: {...}
  grpc: {...}
  tls: {...}

domain_model:
  enums: [...]
  structs: [...]
  lifecycle_pipelines: [...]

interfaces:
  # 28 canonical trait contracts with exact method signatures and errors
  traits: [...]

events:
  telemetry_events: [...]
  critical_events: [...]
  ipc_proto_mappings: [...]

configuration:
  registries: [...]

errors:
  canonical_enum: "SentinelError"
  variants: [...]

security_invariants:
  # 12 consolidated invariants with validation rules
  invariants: [...]

plugin_sandbox:
  capability_set: [...]
  resource_limits: [...]
  isolation_classes: [...]

ai_security:
  policy_layers: [...]
  blocked_patterns: [...]
  validation_schemas: [...]

storage:
  sqlite_tables: [...]
  blob_store: {...}
  tantivy_indexes: [...]

dependencies:
  phases: [...]
  graph: [...]
```

---

## 10. Specification Validator Design & Reconciliation Strategy

### 10.1 Validator Architecture & 11-Step Sequence
To prevent contract drift and enforce continuous consistency, an automated specification validator (e.g. `validate_v6_spec.py`) must be implemented to execute the following 11-step verification sequence:

```
Step 1: Schema Validation (V6_CANONICAL_SPEC.yaml against V6_CANONICAL_SPEC_SCHEMA.yaml)
  │
Step 2: Internal Reference Integrity (Foreign keys, enum values, trait bindings inside YAML)
  │
Step 3: Subsystem Arithmetic & Taxonomy (14 Core + 7 Pro + 4 Adapter + 3 Research == 28 Total)
  │
Step 4: Registry Integrity (Types, traits, events, configs, invariants, error variants)
  │
Step 5: Rust Scaffolding Conformance (V6_COMMON_TYPES.rs vs Canonical Spec)
  │
Step 6: Protobuf / IPC Conformance (V6_IPC_CONTRACTS.proto vs Canonical Spec)
  │
Step 7: SQLite Schema Conformance (V6_SQLITE_SCHEMA.sql vs Canonical Spec)
  │
Step 8: Markdown Registry Conformance (V6_FINAL_*.md tables vs Canonical Spec)
  │
Step 9: Security Invariant Verification (Enforcement rule testability & default-deny policies)
  │
Step 10: Dependency Graph DAG Verification (Acyclic validation & Research isolation)
  │
Step 11: Final Report Generation & Exit Code Determination
```

### 10.2 Validator Return Codes Contract
- `0`: PASS — Specification and all 27 workspace files are 100% consistent with 0 blockers.
- `1`: WARNING — Minor non-blocking documentation discrepancies or formatting issues detected.
- `2+`: BLOCKER — One or more structural, type, interface, invariant, or arithmetic errors detected.

### 10.3 Phased Repair Roadmap
1. **Pass 1: Canonical Specification Creation**: Write `V6_CANONICAL_SPEC_SCHEMA.yaml` and `V6_CANONICAL_SPEC.yaml` embedding all repaired types, 28 subsystems, 12 invariants, and protocol models.
2. **Pass 2: Code & Contract Reconciliation**:
   - Update `V6_COMMON_TYPES.rs` to add missing methods, fix return types (`ScopeDecision`), align enums (`MutatorType`), and fix `AuthzMatrix` keys.
   - Update `V6_IPC_CONTRACTS.proto` to add missing events (`UiCandidateVerifiedEvent`).
   - Update `V6_SQLITE_SCHEMA.sql` to add protocol columns and fix adapter table naming.
3. **Pass 3: Markdown Registries Reconciliation**:
   - Fix arithmetic in `V6_FINAL_ARCHITECTURE.md` (31 → 28).
   - Update trait signatures in `V6_FINAL_INTERFACE_REGISTRY.md` and `V6_FINAL_ARCHITECTURE.md`.
   - Purge obsolete subsystem names repository-wide.
4. **Pass 4: Automated Validation & Freeze**:
   - Execute the 11-step conformance validator.
   - Iterate until `BLOCKERS = 0`.
   - Perform independent verification pass and generate freeze record in `V6_ARCHITECTURE_FROZEN.md` with SHA-256 hashes.

---

## 11. Conclusion

The SENTINEL V6 architecture provides a robust foundation for next-generation security testing. By executing the concrete reconciliation steps cataloged in this survey report, the engineering team will eradicate the split-brain between markdown specifications and code contracts, enabling immediate, unblocked Phase 1 implementation.

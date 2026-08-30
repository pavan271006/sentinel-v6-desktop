# SENTINEL V6 — SPECIFICATION SURVEY & MINING REPORT
**Agent**: `spec_miner_survey_2` (teamwork_preview_spec_miner)  
**Date**: 2026-08-17  
**Workspace**: `architecture/v6`  
**Status**: COMPLETE / AUTHORITATIVE MINING  

---

## 1. Executive Summary & Scope of Audit

This survey report provides an exhaustive, forensic extraction and comparative analysis of the specifications across all 27 architecture artifacts in `c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6`. 

The primary objective is to define the exact canonical requirements for `V6_CANONICAL_SPEC.yaml` and identify every inconsistency, signature mismatch, missing trait method, event omission, protobuf discrepancy, configuration omission, SQL table/foreign key/index deficiency, and grammar limitation across the 5 assigned areas:
1. **Interfaces & Traits** (`V6_FINAL_INTERFACE_REGISTRY.md`, `V6_COMMON_TYPES.rs`, `V6_FINAL_ARCHITECTURE.md`)
2. **Events & IPC Contracts** (`V6_FINAL_EVENT_REGISTRY.md`, `V6_IPC_CONTRACTS.proto`, `V6_COMMON_TYPES.rs`, `V6_FINAL_ARCHITECTURE.md`)
3. **Configuration Registry** (`V6_FINAL_CONFIGURATION_REGISTRY.md`, `V6_COMMON_TYPES.rs`, `V6_FINAL_ARCHITECTURE.md`)
4. **Database & Storage Schema** (`V6_SQLITE_SCHEMA.sql`, `V6_FINAL_DOMAIN_MODEL.md`, `V6_COMMON_TYPES.rs`, `V6_FINAL_ARCHITECTURE.md`)
5. **Grammar & Built-in Rules** (`V6_HTTPQL_GRAMMAR.pest`, `V6_BUILTIN_RULES_AND_PATTERNS.yaml`)

---

## 2. Authoritative Specification Hierarchy & Discovery Table

| Source Artifact | Role & Authority | Discovered Domain Elements |
|---|---|---|
| `V6_CANONICAL_SPEC.yaml` | (Target) Single Source of Truth | Master machine-readable contract |
| `V6_COMMON_TYPES.rs` | Rust Implementation Contract | Core domain types, enums, error model, 28 engine traits |
| `V6_FINAL_INTERFACE_REGISTRY.md` | Interface Summary Matrix | 28 primary subsystem traits |
| `V6_FINAL_ARCHITECTURE.md` | Detailed Subsystem Architecture | Trait methods, structs, invariants, storage/event design |
| `V6_FINAL_EVENT_REGISTRY.md` | Event Delivery & Routing Contract | Broadcast telemetry vs Critical mpsc event definitions |
| `V6_IPC_CONTRACTS.proto` | Inter-Process Communication Schema | Browser daemon gRPC & Frontend Tauri event protobufs |
| `V6_FINAL_CONFIGURATION_REGISTRY.md` | Configuration Schema Contract | Platform, engine, and resource configuration models |
| `V6_SQLITE_SCHEMA.sql` | Relational Storage Contract | SQLite tables, columns, constraints, foreign keys, indexes |
| `V6_HTTPQL_GRAMMAR.pest` | PEG Grammar Specification | Traffic query language parsing expressions and operators |
| `V6_BUILTIN_RULES_AND_PATTERNS.yaml` | Signature & Rule Definitions | Tech signatures, param regexes, AI safety filters, JSON schemas |

---

## 3. Detailed Survey Area 1: Interfaces & Traits

### 3.1 Subsystem Trait Master Catalog (28 Subsystems + Interceptor)

Every subsystem in the 28-subsystem taxonomy (14 Core, 7 Professional, 4 Adapter, 3 Research) defines a canonical trait.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 28 SUBSYSTEM TRAITS                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ CORE (14):                                                                             │
│  1. ProxyEngine           (SUB-01)   8. FuzzerEngine            (SUB-08)               │
│  2. HttpParser            (SUB-02)   9. VerificationEngine      (SUB-09)               │
│  3. ObservationStore      (SUB-03)  10. ContextEngine           (SUB-10)               │
│  4. ScopeEngine           (SUB-04)  11. CoverageEngine          (SUB-11)               │
│  5. EventBus              (SUB-05)  12. IdentityManager         (SUB-12)               │
│  6. TaskScheduler         (SUB-06)  13. KnowledgeEngine         (SUB-13)               │
│  7. ScanOrchestrator      (SUB-07)  14. ReportEngine            (SUB-14)               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PROFESSIONAL (7):                                                                      │
│ 15. BrowserService        (SUB-15)  19. AiPolicyEngine          (SUB-19)               │
│ 16. OastServer            (SUB-16)  20. PluginRuntime           (SUB-20)               │
│ 17. AuthorizationEngine   (SUB-17)  21. ResearchPackManager     (SUB-21)               │
│ 18. AiEngine              (SUB-18)                                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ADAPTER (4):                                                                           │
│ 22. ExternalToolAdapter (SubfinderAdapter) (SUB-22)                                    │
│ 23. ExternalToolAdapter (CloudFoxAdapter)  (SUB-23)                                    │
│ 24. ExternalToolAdapter (SemgrepAdapter)   (SUB-24)                                    │
│ 25. ExternalToolAdapter (OpenApiParser)    (SUB-25)                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ RESEARCH (3, Feature-Gated):                                                           │
│ 26. SmtSolverEngine       (SUB-26)  28. CryptoAnalysisEngine    (SUB-28)               │
│ 27. RlStateEngine         (SUB-27)                                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Method-by-Method Analysis & Tri-Way Discrepancy Matrix

| Subsystem | Trait Name | `V6_FINAL_INTERFACE_REGISTRY.md` | `V6_COMMON_TYPES.rs` | `V6_FINAL_ARCHITECTURE.md` | Identified Discrepancies & Canonical Requirement |
|---|---|---|---|---|---|
| SUB-01 | `ProxyEngine` | `start`, `stop`, `register_interceptor` | `start(&self, ProxyConfig)`, `stop(&self)`, `register_interceptor(&mut self, Box<dyn ProxyInterceptor>)` | Adds `set_intercept_rules(&mut self, Vec<InterceptRule>)` | **Gap**: `set_intercept_rules` is omitted in `V6_COMMON_TYPES.rs` and Interface Registry. Intercept rules table exists in SQL. Canonical spec must include `set_intercept_rules`. |
| SUB-02 | `HttpParser` | `parse_request`, `parse_response` | `parse_request(&self, &[u8]) -> Result<ParsedRequest, SentinelError>`, `parse_response(&self, &[u8]) -> Result<ParsedResponse, SentinelError>` | Adds `serialize_request`, `serialize_response`; returns `Result<..., ParseError>` | **Discrepancy 1**: Serialization methods omitted in `V6_COMMON_TYPES.rs`.<br>**Discrepancy 2**: Error type is `SentinelError` in Rust file vs `ParseError` in Architecture & Registry.<br>**Discrepancy 3**: `ParsedRequest` in Rust lacks `raw`, `normalized`, `parse_warnings`.<br>**Discrepancy 4**: Marked `#[async_trait]` on synchronous functions. |
| SUB-03 | `ObservationStore` | `insert`, `query_sql`, `search_fts` | `insert(&self, Observation)`, `query_sql(&self, &str)`, `search_fts(&self, &str)` | Adds `insert_batch`, `get`, `rebuild_index`; `query_sql` & `search_fts` have pagination parameters (`limit`, `offset`) | **Gap**: `insert_batch`, `get`, `rebuild_index` are missing in `V6_COMMON_TYPES.rs`. `query_sql` and `search_fts` lack pagination parameters in Rust file. |
| SUB-04 | `ScopeEngine` | `is_in_scope`, `update_scope` | `is_in_scope(&self, &str) -> ScopeDecision`, `is_ip_in_scope(&self, &str) -> ScopeDecision`, `update_scope(&mut self, Scope) -> Result<(), SentinelError>` | `is_in_scope(&self, &str) -> bool`, `is_ip_in_scope(&self, &str) -> bool` | **Discrepancy**: Architecture uses `-> bool`, while Types file and Security Invariants require structured `ScopeDecision`. `ScopeDecision` in Types file misses `decision_id` and `timestamp`. |
| SUB-05 | `EventBus` | `subscribe`, `publish`, `publish_critical` | `subscribe_telemetry`, `subscribe_critical`, `publish_telemetry`, `publish_critical` | `subscribe`, `subscribe_critical`, `publish`, `publish_critical` | **Naming Divergence**: `subscribe`/`publish` in Architecture and Registry vs `subscribe_telemetry`/`publish_telemetry` in Types file. Canonical spec should standardize method names. |
| SUB-06 | `TaskScheduler` | `submit`, `cancel`, `checkpoint` | `submit`, `cancel`, `checkpoint` | Adds `pause`, `resume`, `status`, `restore_checkpoint` | **Gap**: `pause`, `resume`, `status`, `restore_checkpoint` missing in `V6_COMMON_TYPES.rs`. `TaskLifecycle` enum in Rust vs `TaskStatus` name in Architecture. |
| SUB-07 | `ScanOrchestrator` | `start_scan`, `pause_scan`, `status` | `start_scan`, `pause_scan`, `status` | Adds `resume_scan`, `cancel_scan`, `scan_status` | **Gap**: `resume_scan` and `cancel_scan` missing in Types file. `status` returns `ScanLifecycle` vs `ScanStatus`. `ScanConfig` fields diverge. |
| SUB-08 | `FuzzerEngine` | `fuzz` | `fuzz(&self, &Transaction, &FuzzProfile) -> Result<FuzzStream, SentinelError>` | `fuzz(&self, &Transaction, FuzzProfile)` | **Discrepancy**: Pass-by-ref vs pass-by-value. `FuzzProfile` fields diverge significantly between Types file and Architecture. `MutatorType` enum variants differ. |
| SUB-09 | `VerificationEngine` | `verify_candidate`, `correlate_oast` | `verify_candidate(&self, &Candidate, VerificationStrategyRef)`, `correlate_oast(&self, &str)` | `verify(&self, &Candidate, VerificationStrategy)`, `available_strategies(&self) -> Vec<VerificationStrategy>` | **Discrepancy**: `verify_candidate` vs `verify`. Missing `available_strategies` in Types file. `VerificationStrategyRef` vs `VerificationStrategy`. |
| SUB-10 | `ContextEngine` | `fingerprint`, `classify_parameter` | Synchronous: `fingerprint(&self, &Transaction) -> Vec<TechFingerprint>`, `classify_parameter(&self, &str, &str) -> ParameterClass` | Matches Types file | **Discrepancy**: Interface Registry lists return type as `Result<Vec<TechFingerprint>, SentinelError>`, but trait methods are infallible synchronous. |
| SUB-11 | `CoverageEngine` | `record_test`, `get_coverage` | `record_test(&self, Uuid)`, `get_coverage(&self, Uuid) -> Result<CoverageReport, SentinelError>` | `record_test(&self, Uuid, &str, &str)`, `untested_endpoints(&self, Uuid)`, richer `CoverageReport` struct | **Gap**: `record_test` misses `param` and `check_id`. `untested_endpoints` missing in Types file. `CoverageReport` lacks parameter counts and percentage. |
| SUB-12 | `IdentityManager` | `add_identity`, `inject_auth` | `add_identity(&self, Identity) -> Result<Uuid, SentinelError>`, `inject_auth(&self, Uuid, &mut ParsedRequest) -> Result<(), SentinelError>` | Adds `add_credential`, `list_identities`, `refresh_credential` | **Gap**: `add_credential`, `list_identities`, `refresh_credential` missing in Types file. `Identity` struct lacks username and roles. |
| SUB-13 | `KnowledgeEngine` | `add_node`, `find_path` | `add_node(&self, GraphNode)`, `find_path(&self, Uuid, Uuid)` | Adds `add_edge`, `query_neighbors`, `resolve_entity`; `find_path` includes `max_depth: u32` | **Gap**: `add_edge`, `query_neighbors`, `resolve_entity` missing in Types file. `find_path` lacks recursion limit `max_depth`. `GraphNode` lacks `node_type`, `version`, `timestamp`, `metadata_json`. |
| SUB-14 | `ReportEngine` | `generate` | `generate(&self, ReportConfig) -> Result<Vec<u8>, SentinelError>` | `generate(&self, ReportConfig)` | `ReportConfig` struct in Types file misses `template: Option<String>` and `include_reproduction_steps: bool`. |
| SUB-15 | `BrowserService` | `navigate`, `execute_script`, `capture_dom` | `navigate(&self, &str)`, `execute_script(&self, &str)`, `capture_dom(&self)` | Adds `screenshot`, `close`; adds `timeout_ms` and `include_shadow` parameters | **Gap**: `screenshot` (or `take_screenshot`) and `close` missing in Types file despite being in Protobuf `BrowserDaemon`. Method signatures miss timeouts. |
| SUB-16 | `OastServer` | `start`, `generate_token`, `poll` | `start(&self)`, `generate_token(&self)`, `poll(&self, &str)` | `start(&self, OastConfig)`, `generate_token(&self, &str)`, `poll_interactions(&self, &str)`, `stop(&self)` | **Gap**: Missing `OastConfig` on `start`, missing `context` on `generate_token`, missing `stop()`. `poll` vs `poll_interactions`. `OastConfig` fields diverge. |
| SUB-17 | `AuthorizationEngine` | `build_matrix`, `test_matrix` | `build_matrix(&self, Vec<Uuid>)`, `test_matrix(&self, &AuthzMatrix)` | `build_matrix(&self, Vec<Uuid>, Vec<Uuid>)`, `test_matrix(&self, &AuthzMatrix)` | **Discrepancy**: `build_matrix` in Types file misses `endpoints: Vec<Uuid>`. `AuthzMatrix` expected/actual maps in Types file are `HashMap<Uuid, AccessLevel>` instead of `HashMap<(Uuid, Uuid), AccessLevel>`. `AuthzViolation` lacks `violation_type`, `evidence`, `confidence`. |
| SUB-18 | `AiEngine` | `analyze`, `is_available` | `analyze(&self, AiRequest) -> Result<AiResponse, SentinelError>`, `is_available(&self) -> bool` | Same trait methods | `AiRequest` and `AiResponse` structs in Types file lack token counting, context pairs, schema, provider, and policy evaluation results. |
| SUB-19 | `AiPolicyEngine` | `validate_input`, `is_destructive` | `validate_input(&self, &str)`, `validate_output(&self, &str)`, `is_destructive(&self, &str)`, `requires_approval(&self, &str)` | `validate_output` has `schema: Option<&str>` parameter | `validate_output` misses schema validation parameter in Types file. `PolicyResult` enum variants differ in struct vs tuple fields. |
| SUB-20 | `PluginRuntime` | `load_wasm`, `execute` | `load_wasm(&self, &[u8], PluginSandboxConfig)`, `execute(&self, Uuid, PluginInput)` | Adds `load_rhai`, `unload`; uses `Capabilities` | `load_rhai` and `unload` missing in Types file. Sandbox config types need canonical definition separating `CapabilitySet` and `ResourceLimits`. |
| SUB-21 | `ResearchPackManager` | `load_pack`, `verify_signature` | `load_pack(&self, &str)`, `verify_signature(&self, &PackManifest)` | Adds `list_checks`, `hot_reload` | `list_checks` and `hot_reload` missing in Types file. |
| SUB-22..25 | `ExternalToolAdapter` | `execute`, `is_installed` | `execute(&self, Value) -> Result<Value, SentinelError>`, `is_installed(&self) -> bool` | Adds `tool_name(&self) -> &str` | `tool_name` method missing in Types file and Interface Registry. |
| SUB-26 | `SmtSolverEngine` | `prove_logic_flaw` | `prove_logic_flaw(&self, &str, &str) -> Result<SymbolicPath, SentinelError>` | Feature-flagged | Consistent across files. |
| SUB-27 | `RlStateEngine` | `explore_state_machine` | `explore_state_machine(&self, &str) -> Result<Vec<RlRewardModel>, SentinelError>` | Feature-flagged | Consistent across files. |
| SUB-28 | `CryptoAnalysisEngine`| `analyze_handshake` | `analyze_handshake(&self, &[u8]) -> Result<Option<CryptoWeakness>, SentinelError>` | Feature-flagged | Consistent across files. |

---

## 4. Detailed Survey Area 2: Events & IPC Contracts

### 4.1 Event Classification & Delivery Guarantees

The architecture defines a strict dual-channel event model on the local `EventBus`:
1. **Telemetry / Standard Broadcast Channel (`tokio::sync::broadcast`)**:
   - Capacity: 10,000 messages.
   - Delivery: Best-effort, drop-on-lag when consumer lags.
   - Intended for UI progress indicators, live traffic monitor, background metrics.
2. **Critical / Auditable Channel (`tokio::sync::mpsc`)**:
   - Capacity: Unbounded with publisher backpressure.
   - Delivery: Guaranteed delivery, publisher yields (asynchronously blocks) on saturation. Appended to SQLite WAL.
   - Intended for security-critical findings, candidate verifications, scope violations.

### 4.2 Complete Event Registry & IPC Mapping Matrix

| Category | Event Name (Rust) | Producer Subsystem | Consumers | Rust Payload Type | IPC / Protobuf Message | Proto Tag | Security Class |
|---|---|---|---|---|---|---|---|
| **Broadcast** | `ObservationCreated` | `ProxyEngine` (SUB-01) | `ObservationStore`, UI | `Uuid` | `UiTrafficEvent` | `SentinelUiStream.traffic = 1` | Internal |
| **Broadcast** | `ContextDetected` | `ContextEngine` (SUB-10) | UI, `ScanOrchestrator` | `Uuid` / `(Uuid, String)` | `UiContextEvent` | `SentinelUiStream.context = 6` | Internal |
| **Broadcast** | `CoverageUpdate` | `CoverageEngine` (SUB-11) | UI, `ScanOrchestrator` | `Uuid` / `CoverageReport` | `UiCoverageEvent` | `SentinelUiStream.coverage = 5` | Internal |
| **Broadcast** | `ScanProgress` | `ScanOrchestrator` (SUB-07)| UI | `ScanProgressUpdate` | `UiScanProgressEvent` | `SentinelUiStream.scan_progress = 3`| Internal |
| **Broadcast** | `TaskStatus` | `TaskScheduler` (SUB-06) | UI | `TaskStateUpdate` | `UiTaskStatusEvent` | `SentinelUiStream.task_status = 4` | Internal |
| **Critical** | `FindingCreated` | `VerificationEngine` (SUB-09) | `ObservationStore`, UI | `Uuid` | `UiFindingEvent` | `SentinelUiStream.finding = 2` | Confidential |
| **Critical** | `ScopeViolationAttempt` | `ProxyEngine` (SUB-01), `ScopeEngine` (SUB-04) | UI, Audit Logger | `Uuid` / `ScopeViolationData` | `UiScopeViolationEvent` | `SentinelUiStream.scope_violation = 7` | Audit |
| **Critical** | `CandidateVerified` | `VerificationEngine` (SUB-09) | `ObservationStore`, UI | `Uuid` / `(Uuid, Uuid)` | *(Missing in Proto)* | `SentinelUiStream.candidate_verified = 8` (Proposed) | Confidential |

### 4.3 Protobuf Contract Audit (`V6_IPC_CONTRACTS.proto`)

#### BrowserDaemon Service (Rust Core <-> Node.js Browser Worker)
- **RPCs**:
  1. `rpc Navigate(NavigateRequest) returns (NavigateResponse)`
  2. `rpc ExecuteScript(ExecuteScriptRequest) returns (ExecuteScriptResponse)`
  3. `rpc CaptureDom(CaptureDomRequest) returns (CaptureDomResponse)`
  4. `rpc TakeScreenshot(TakeScreenshotRequest) returns (TakeScreenshotResponse)`
  5. `rpc Close(CloseRequest) returns (CloseResponse)`
- **Message Audit**:
  - `NavigateRequest`: `url` (tag 1), `timeout_ms` (tag 2), `custom_headers` (tag 3, map<string, string>), `bypass_csp` (tag 4).
  - `NavigateResponse`: `success` (tag 1), `http_status` (tag 2), `error_message` (tag 3).
  - `ExecuteScriptRequest`: `javascript_code` (tag 1), `await_promise` (tag 2), `timeout_ms` (tag 3).
  - `ExecuteScriptResponse`: `success` (tag 1), `result_json` (tag 2), `error_message` (tag 3).
  - `CaptureDomRequest`: `include_shadow_dom` (tag 1).
  - `CaptureDomResponse`: `html_content` (tag 1).
  - `TakeScreenshotRequest`: `full_page` (tag 1).
  - `TakeScreenshotResponse`: `image_png` (tag 1, bytes).
  - `CloseRequest`: empty.
  - `CloseResponse`: empty.

#### UI Stream Messages (Rust Core -> Tauri React Frontend)
- `UiTrafficEvent`: `transaction_id` (tag 1), `timestamp` (tag 2), `method` (tag 3), `uri` (tag 4), `status` (tag 5), `duration_ms` (tag 6), `in_scope` (tag 7), `tags` (tag 8).
- `UiFindingEvent`: `finding_id` (tag 1), `timestamp` (tag 2), `title` (tag 3), `severity` (tag 4), `state` (tag 5).
- `UiScanProgressEvent`: `scan_id` (tag 1), `phase` (tag 2), `percent_complete` (tag 3).
- `UiTaskStatusEvent`: `task_id` (tag 1), `state` (tag 2), `message` (tag 3).
- `UiCoverageEvent`: `scope_id` (tag 1), `total_endpoints` (tag 2), `tested_endpoints` (tag 3), `coverage_percent` (tag 4).
- `UiContextEvent`: `endpoint_id` (tag 1), `technology` (tag 2), `confidence` (tag 3).
- `UiScopeViolationEvent`: `request_id` (tag 1), `attempted_uri` (tag 2), `violation_reason` (tag 3), `timestamp` (tag 4).
- `SentinelUiStream`: Encapsulates all 7 event types in `oneof event`.

### 4.4 Event Gaps & Inconsistencies Discovered
1. **Missing Proto Event for `CandidateVerified`**: `CriticalEvent::CandidateVerified` is defined in Rust and Manifest, but is completely missing from `V6_IPC_CONTRACTS.proto` and `SentinelUiStream`.
2. **Manifest Phantom Events**: `V6_FINAL_SUBSYSTEM_MANIFEST.md` lists `ObservationStored` for `ObservationStore` and `ScopeUpdated` for `ScopeEngine`. Neither event is present in `V6_FINAL_EVENT_REGISTRY.md`, `V6_COMMON_TYPES.rs`, or `V6_IPC_CONTRACTS.proto`.
3. **Payload Type Mismatch**:
   - `CriticalEvent::ScopeViolationAttempt` in `V6_COMMON_TYPES.rs` is `{ source: String, target: String, decision: ScopeDecision }`, while `UiScopeViolationEvent` in Proto has `request_id: Uuid, attempted_uri: string, violation_reason: string, timestamp: Timestamp`.
   - `SentinelEvent::ScanProgress` in `V6_COMMON_TYPES.rs` uses `ScanProgressUpdate` (`state: ScanLifecycle, progress_pct: f32, checks_completed: u64`), while `UiScanProgressEvent` in Proto uses `phase: string, percent_complete: float`.

---

## 5. Detailed Survey Area 3: Configuration Registry

### 5.1 Configuration Models Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CONFIGURATION CATALOG                           │
├────────────────────────────┬───────────────────────────────────────────┤
│ Configuration Struct       │ Owner & Purpose                           │
├────────────────────────────┼───────────────────────────────────────────┤
│ SentinelConfig             │ Global Application Platform Settings      │
│ ProxyConfig                │ ProxyEngine MITM & Port Binding           │
│ ScanConfig                 │ ScanOrchestrator Target Scope & Limits    │
│ ResourceBudget             │ TaskScheduler Execution Bounds            │
│ TaskConfig                 │ Individual Asynchronous Task Attributes  │
│ ReportConfig               │ ReportEngine Output Format & Content      │
│ PluginSandboxConfig        │ PluginRuntime Capability & Resource Drops │
│ OastConfig                 │ OastServer Domain, TLS & Port Bindings    │
│ Scope                      │ ScopeEngine Inclusions & Exclusions       │
└────────────────────────────┴───────────────────────────────────────────┘
```

### 5.2 Key-by-Key Specification & Validation Rules

#### 1. `SentinelConfig` (Global Application Settings)
- **Format**: TOML (`~/.sentinel/config.toml` or `<project>/sentinel.toml`)
- **Fields**:
  - `database_path`: `PathBuf` (default: `~/.sentinel/projects/`, valid directory path)
  - `log_level`: `String` (default: `"INFO"`, enum: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`)
  - `max_memory_mb`: `u32` (default: `4096`, min: `512`, max: `65536`)
- **Env Override**: `SENTINEL_LOG_LEVEL`, `SENTINEL_MAX_MEMORY_MB`
- **Reloadability**: Dynamic log level update; restart required for database path and memory ceiling.

#### 2. `ProxyConfig`
- **Fields**:
  - `bind_address`: `String` (default: `"127.0.0.1"`, valid IPv4/IPv6)
  - `port`: `u16` (default: `8080`, range: `1..65535`)
  - `upstream_proxy`: `Option<String>` (default: `None`, URI format `http://host:port`)
  - `tls_cert_path`: `String` (default: `"~/.sentinel/ca/sentinel_ca.crt"`, path to CA cert/key)
- **Env Override**: `SENTINEL_PROXY_PORT`, `SENTINEL_UPSTREAM_PROXY`
- **Reloadability**: Requires proxy restart.

#### 3. `ScanConfig`
- **Fields**:
  - `scope_id`: `Uuid` (Required, foreign key to `scopes.id`)
  - `concurrency_limit`: `u32` (default: `10`, min: `1`, max: `100`)
  - `max_requests_per_endpoint`: `u32` (default: `500`, min: `10`, max: `100000`)
  - `active_checks`: `Vec<String>` (default: `["all_safe"]`, valid Check IDs)
  - `verification_strategies`: `Vec<VerificationStrategy>` (default: `[ResponseDifferential, OASTCorrelation, TimingStatistical, ContentVerification]`)
  - `budget`: `ResourceBudget` (Required)
- **Reloadability**: Modifiable on scan pause/resume.

#### 4. `ResourceBudget`
- **Fields**:
  - `max_requests`: `u64` (default: `10000`, min: `100`, max: `10000000`)
  - `max_duration_secs`: `u64` (default: `3600`, min: `60`, max: `86400`)
  - `max_findings`: `u32` (default: `100`, min: `1`, max: `10000`)
- **Enforcement**: Task is aggressively checkpointed and transitioned to `TaskLifecycle::Paused` when exceeded.

#### 5. `PluginSandboxConfig` & Security Controls
- **`CapabilitySet`**:
  - `network`: `bool` (default: `false`, requires user grant)
  - `filesystem`: `bool` (default: `false`, strict deny)
  - `database_read`: `bool` (default: `false`, read-only query access)
  - `secrets`: `bool` (default: `false`, strict deny)
  - `browser`: `bool` (default: `false`, CDP interaction)
- **`ResourceLimits`**:
  - `max_memory_mb`: `u32` (default: `128`, max: `1024`)
  - `max_execution_ms`: `u64` (default: `5000`, max: `60000`)
  - `max_network_requests`: `u32` (default: `0`, max: `1000`)

#### 6. `OastConfig`
- **Fields**:
  - `domain`: `String` (Required, FQDN e.g. `"oast.sentinelsec.net"`)
  - `bind_ip`: `String` (default: `"0.0.0.0"`)
  - `dns_port`: `u16` (default: `53`, requires root or cap_net_bind_service)
  - `http_port`: `u16` (default: `80`)
  - `https_port`: `u16` (default: `443`)
  - `tls_cert_path`: `Option<String>` (path to Let's Encrypt / custom cert)

### 5.3 Configuration Discrepancies Discovered
1. **Missing `SentinelConfig` in Rust**: `SentinelConfig` is defined in `V6_FINAL_CONFIGURATION_REGISTRY.md` but is completely absent from `V6_COMMON_TYPES.rs`.
2. **`ScanConfig` & `ResourceBudget` Drift**: `ScanConfig` in `V6_COMMON_TYPES.rs` lacks `max_requests_per_endpoint` and `verification_strategies`. `ResourceBudget` lacks `max_findings`.
3. **`OastConfig` Drift**: `V6_COMMON_TYPES.rs` defines `OastConfig` with `bind_ip, base_domain, use_tls` while `V6_FINAL_ARCHITECTURE.md` defines `domain, dns_port, http_port, https_port, tls_cert_path`.

---

## 6. Detailed Survey Area 4: Database & Storage Schema

### 6.1 Storage Tier Architecture

The SENTINEL V6 platform utilizes a 3-tier hybrid local storage architecture:
1. **Structured Metadata (SQLite WAL Mode)**:
   - Configuration, scopes, knowledge graph, identities, observations index, candidates, verifications, findings, task checkpoints.
   - Pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`.
   - Single-writer async task via mpsc queue, multi-reader concurrent connection pool via sqlx.
2. **Payload & Body Storage (Content-Addressed File Blobs)**:
   - Raw request/response bodies exceeding SQLite performance thresholds stored in `<project>/blobs/<uuid>`.
   - Content-addressed via SHA-256 hash for immutable evidence integrity.
3. **Full-Text Body Search (Tantivy BM25 Engine)**:
   - Embedded Tantivy index in `<project>/tantivy/`.
   - Indexed fields: `req_normalized_text`, `res_normalized_text`, `req_uri`, `req_method`, `res_status`.
   - Dual-write committed every 500ms; auto-rebuilds from SQLite on startup if checksum mismatch is detected.

### 6.2 Relational Schema Catalog (`V6_SQLITE_SCHEMA.sql`)

The existing SQL schema defines 22 tables across 10 functional groups:

| # | Table Name | Primary Key | Foreign Keys | Key Indexes | Domain Type Mapping | Status & Gaps |
|---|---|---|---|---|---|---|
| 1 | `scopes` | `id TEXT` | None | Primary Key | `Scope` | `Scope` in Rust misses `version`, `timestamp`. |
| 2 | `graph_nodes` | `id TEXT` | None | Primary Key | `GraphNode` | `GraphNode` in Rust misses `version`, `timestamp`, `node_type`, `metadata_json`. |
| 3 | `graph_edges` | `id TEXT` | `source_id -> graph_nodes(id)` (CASCADE), `target_id -> graph_nodes(id)` (CASCADE) | `idx_graph_edges_source`, `idx_graph_edges_target` | `GraphEdge` | Rust field named `relation_type` vs SQL `edge_type`. Rust misses `id`, `timestamp`. |
| 4 | `endpoints` | `id TEXT` | `graph_node_id -> graph_nodes(id)` (CASCADE) | `idx_endpoints_unique(host, path, method)` (UNIQUE) | `Endpoint` | Rust misses `timestamp`. |
| 5 | `parameters` | `id TEXT` | `endpoint_id -> endpoints(id)` (CASCADE) | **MISSING FK INDEX** | `Parameter` (Missing in Rust) | Missing `Parameter` struct in Rust. Missing index on `endpoint_id`. |
| 6 | `observations` | `id TEXT` | None | Primary Key | `Observation` | Missing index on `data_ref`. |
| 7 | `transactions` | `id TEXT` | None | `idx_transactions_uri(req_uri)` | `Transaction` | Implements Triple representation (`req_blob_id`, `req_normalized_text`). |
| 8 | `identities` | `id TEXT` | None | Primary Key | `Identity` | In Rust, `Identity` has `token_reference` instead of `username`, `roles_json`. |
| 9 | `credentials` | `id TEXT` | `identity_id -> identities(id)` (CASCADE) | **MISSING FK INDEX** | `Credential` | Security gap: SQL stores `encrypted_payload` without linking to `secret_reference` vault UUID. |
| 10 | `oast_tokens` | `id TEXT` | None | `UNIQUE(token_string)` | `OastToken` | Matches domain model. |
| 11 | `oast_interactions` | `id TEXT` | `token_id -> oast_tokens(id)` (CASCADE) | **MISSING FK INDEX** | `OastInteraction` | Rust struct misses `token_id`, `protocol`, `raw_blob_id`. |
| 12 | `candidates` | `id TEXT` | `source_observation_id -> observations(id)` | **MISSING FK INDEX** | `Candidate` | Missing index on `source_observation_id`. |
| 13 | `findings` | `id TEXT` | None (Should reference `verifications`) | **MISSING INDEXES** | `Finding` | `verification_id` has no FK constraint because `verifications` table is missing! Missing indexes on `severity`, `state`. |
| 14 | `task_checkpoints` | `task_id TEXT` | None | Primary Key | `TaskStateUpdate` | Matches task recovery design. |
| 15 | `scan_configs` | `id TEXT` | `scope_id -> scopes(id)` | **MISSING FK INDEX** | `ScanConfig` | Missing index on `scope_id`. |
| 16 | `proxy_intercept_rules` | `id TEXT` | None | Primary Key | `InterceptRule` | SQL has `match_condition, action, action_data_json, is_active`. |
| 17 | `casm_assets` | `domain TEXT` | None | Primary Key | `SubdomainAsset` | Table name is obsolete `casm_assets` (should be `subdomain_assets`). |
| 18 | `cloud_assets` | `arn TEXT` | `discovered_via_credential_id -> credentials(id)` | **MISSING FK INDEX** | `CloudAsset` | Missing index on `discovered_via_credential_id`. |
| 19 | `api_proutes` | `id TEXT` | None | Primary Key | `PRoute` | Matches OpenAPI adapter. |
| 20 | `sast_findings` | `id TEXT` | None | Primary Key | `SastFinding` | Matches Semgrep adapter. |
| 21 | `symbolic_proofs` | `id TEXT` | None | Primary Key | `SymbolicPath` | Feature-gated research table. |
| 22 | `app_state_machine` | `state_hash TEXT`| None | Primary Key | `RlRewardModel` | Feature-gated research table. |
| 23 | `crypto_weaknesses`| `id TEXT` | None | Primary Key | `CryptoWeakness` | Feature-gated research table. |

### 6.3 Missing Tables, Foreign Keys, and Indexes

1. **CRITICAL MISSING TABLES**:
   - `verifications`: Stores `id`, `candidate_id`, `strategy_type`, `strategy_version`, `success`, `confidence`, `executed_at`, `duration_ms`. Without this table, `findings.verification_id` is an orphaned reference.
   - `evidence`: Stores `id`, `verification_id`, `evidence_type` (`TransactionEvidence`, `OastEvidence`, `BrowserSnapshot`, `TimingVariance`, `Differential`), `data_blob_id`, `created_at`.
   - `reports`: Stores `id`, `format`, `title`, `generated_at`, `file_path`, `config_json`.
   - `notes` & `screenshots`: Pentester productivity entities required by `ORIGINAL_REQUEST.md`.
2. **MISSING FOREIGN KEY INDEXES**:
   SQLite does not automatically index foreign keys. The following indexes are mandatory for query performance:
   - `CREATE INDEX idx_parameters_endpoint ON parameters(endpoint_id);`
   - `CREATE INDEX idx_credentials_identity ON credentials(identity_id);`
   - `CREATE INDEX idx_oast_interactions_token ON oast_interactions(token_id);`
   - `CREATE INDEX idx_candidates_source_obs ON candidates(source_observation_id);`
   - `CREATE INDEX idx_findings_verification ON findings(verification_id);`
   - `CREATE INDEX idx_findings_state_severity ON findings(state, severity);`
   - `CREATE INDEX idx_scan_configs_scope ON scan_configs(scope_id);`
   - `CREATE INDEX idx_cloud_assets_credential ON cloud_assets(discovered_via_credential_id);`
   - `CREATE INDEX idx_observations_data_ref ON observations(data_ref);`
3. **OBSOLETE TABLE NAMES**:
   - `casm_assets` should be reconciled to `subdomain_assets` to match `SubfinderAdapter`.

---

## 7. Detailed Survey Area 5: Grammar & Built-in Rules

### 7.1 PEG Grammar Analysis (`V6_HTTPQL_GRAMMAR.pest`)

#### Grammar Rules and Precedence
- **Whitespace**: `WHITESPACE = _{ " " | "\t" | "\r" | "\n" }` (silent whitespace rule)
- **Literals**:
  - `int_lit = @{ "-"? ~ ASCII_DIGIT+ }`
  - `string_lit = @{ "\"" ~ inner_str ~ "\"" }`, with `inner_str = @{ (!"\"" ~ ANY)* }`
  - `bool_lit = { "true" | "false" }`
  - `null_lit = { "null" }`
  - `array_lit = { "[" ~ value ~ ("," ~ value)* ~ "]" }`
  - `value = { string_lit | int_lit | bool_lit | null_lit | array_lit }`
- **Fields**:
  - Request fields: `req.method`, `req.uri`, `req.host`, `req.path`, `req.body`, `req.header`
  - Response fields: `res.status`, `res.body`, `res.header`, `res.content_type`
  - Transaction fields: `tx.duration`, `tx.in_scope`, `tx.has_finding`
- **Operators**:
  - Comparison: `==`, `!=`, `>=`, `<=`, `>`, `<`
  - Pattern matching: `~=` (regex match), `!~=` (regex not match)
  - Collection: `in` (array inclusion), `contains` (substring inclusion)
- **Expression Precedence Structure**:
  - `primary = { condition | "(" ~ expr ~ ")" | not_op ~ primary }`
  - `and_expr = { primary ~ (and_op ~ primary)* }` (`AND`, `and`, `&&`)
  - `or_expr = { and_expr ~ (or_op ~ and_expr)* }` (`OR`, `or`, `||`)
  - `expr = { or_expr }`
  - `query = { SOI ~ expr ~ EOI }`

#### Pest Grammar Deficiencies & Necessary Reconciliations
1. **Header Subfield Indexing Gap**:
   - The field rule defines `"req.header"` and `"res.header"` as static literal strings.
   - Users and built-in rules (e.g. `res.header.Server`, `res.header.X-Powered-By`) require matching against specific headers (e.g. `res.header["Server"] ~= "nginx"` or `res.header.Server ~= "nginx"`).
   - **Recommendation**: Extend `field` rule:
     ```pest
     header_field = @{ ("req.header." | "res.header.") ~ ASCII_ALPHANUMERIC+ ("-" ~ ASCII_ALPHANUMERIC+)* }
     field = { 
         header_field |
         "req.method" | "req.uri" | "req.host" | "req.path" | "req.body" | "req.header" |
         "res.status" | "res.body" | "res.header" | "res.content_type" |
         "tx.duration" | "tx.in_scope" | "tx.has_finding"
     }
     ```
2. **String Escape Character Gap**:
   - `inner_str = @{ (!"\"" ~ ANY)* }` fails on escaped quotes `\"`. A query like `req.body contains "\"admin\":true"` will fail to parse.
   - **Recommendation**: Use `inner_str = @{ (("\\\"" | "\\\\") | (!"\"" ~ ANY))* }`.
3. **Query Parameter Fields Gap**:
   - Missing `req.query`, `req.param`, `req.cookie` fields in HTTPQL grammar.

### 7.2 Built-in Rules & Patterns Audit (`V6_BUILTIN_RULES_AND_PATTERNS.yaml`)

#### 1. Technology Fingerprinting (4 Built-in Signatures)
- `tech_nginx`: Matches `res.header.Server` against `(?i)nginx(?:/([0-9.]+))?`
- `tech_express`: Matches `res.header.X-Powered-By` against `(?i)Express`
- `tech_php`: Matches `res.header.X-Powered-By` against `(?i)PHP(?:/([0-9.]+))?` and `req.uri` against `\.php$`
- `tech_aws_alb`: Matches `res.cookie` against `^AWSALB=`

#### 2. Parameter Classifiers (4 Built-in Regexes)
- `UUID`: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`
- `JWT`: `^eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*$`
- `Base64`: `^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`
- `Email`: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- *Gap*: The `ParameterClass` enum defines 14 variants (`ObjectId, Url, FilePath, Email, Token, Search, Numeric, Boolean, Json, Xml, Html, Enumeration, FreeText, Unknown`). Canonical spec must specify fallback classifications.

#### 3. AI Safety & Host Policy Guards (3 Blocked Regex Patterns + JSON Schema)
- **Blocked Patterns**:
  1. SQL Destructive: `(?i)(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE\s+TABLE|ALTER\s+TABLE)`
  2. OS Command Destructive: `(?i)(?:rm\s+-rf|mkfs|dd\s+if=.*of=/dev/|wget.*\|sh)`
  3. Prompt Injection / Leak: `(?i)(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions|system\s+prompt|print\s+your\s+instructions)`
- **Validation Schema (`payload_response`)**:
  - Type: `object`
  - Required fields: `["hypothesis", "payload", "confidence", "reasoning"]`
  - Properties: `hypothesis` (string), `payload` (string), `confidence` (number, 0.0..1.0), `reasoning` (string).

---

## 8. Master Discrepancy & Gap Inventory

| Discrepancy ID | Category | Severity | Description | Affected Files | Resolution / Canonical Requirement |
|---|---|---|---|---|---|
| **GAP-01** | Interface | High | Missing trait methods on `ObservationStore` (`insert_batch`, `get`, `rebuild_index`) and missing pagination params on `query_sql` and `search_fts`. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add complete signatures to `V6_CANONICAL_SPEC.yaml` and update `V6_COMMON_TYPES.rs`. |
| **GAP-02** | Interface | High | Missing trait methods on `TaskScheduler` (`pause`, `resume`, `status`, `restore_checkpoint`). | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add all 7 lifecycle and checkpoint methods to `TaskScheduler`. |
| **GAP-03** | Interface | High | Missing trait methods on `ScanOrchestrator` (`resume_scan`, `cancel_scan`). Method naming drift (`status` vs `scan_status`). | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md`, `V6_FINAL_ARCHITECTURE.md` | Standardize on `start_scan`, `pause_scan`, `resume_scan`, `cancel_scan`, `scan_status`. |
| **GAP-04** | Interface | Medium | Missing trait methods on `IdentityManager` (`add_credential`, `list_identities`, `refresh_credential`). | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add full identity and credential lifecycle methods. |
| **GAP-05** | Interface | High | Missing trait methods on `KnowledgeEngine` (`add_edge`, `query_neighbors`, `resolve_entity`) and missing `max_depth` parameter on `find_path`. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add full graph methods and enforce bounded CTE depth. |
| **GAP-06** | Interface | High | Missing trait methods on `BrowserService` (`screenshot`, `close`) and missing `timeout_ms`/`include_shadow` arguments. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md`, `V6_IPC_CONTRACTS.proto` | Synchronize Rust `BrowserService` trait directly with `BrowserDaemon` proto. |
| **GAP-07** | Interface | Medium | Missing trait methods on `OastServer` (`stop`), missing `config` on `start`, missing `context` on `generate_token`. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Reconcile `OastServer` trait signatures with architecture. |
| **GAP-08** | Interface | High | `AuthorizationEngine` parameter mismatch (`build_matrix` missing `endpoints: Vec<Uuid>`). `AuthzMatrix` map key type mismatch (`(Uuid, Uuid)` tuple vs `Uuid`). | `V6_COMMON_TYPES.rs`, `V6_FINAL_ARCHITECTURE.md` | Define `AuthzMatrix` with `HashMap<(Uuid, Uuid), AccessLevel>` for (identity, endpoint) pairs. |
| **GAP-09** | Interface | Medium | Missing `load_rhai` and `unload` on `PluginRuntime`. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add Rhai script execution and plugin unloading methods. |
| **GAP-10** | Interface | Medium | Missing `list_checks` and `hot_reload` on `ResearchPackManager`. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add check discovery and hot-reloading methods. |
| **GAP-11** | Interface | Low | Missing `tool_name(&self) -> &str` on `ExternalToolAdapter`. | `V6_COMMON_TYPES.rs`, `V6_FINAL_INTERFACE_REGISTRY.md` | Add `tool_name` method to trait. |
| **GAP-12** | Event/IPC | High | Missing `CandidateVerified` in `V6_IPC_CONTRACTS.proto` `SentinelUiStream`. | `V6_IPC_CONTRACTS.proto`, `V6_FINAL_EVENT_REGISTRY.md` | Add `UiCandidateVerifiedEvent` and tag 8 to `SentinelUiStream`. |
| **GAP-13** | Event/IPC | Medium | Phantom events `ObservationStored` and `ScopeUpdated` in Subsystem Manifest. | `V6_FINAL_SUBSYSTEM_MANIFEST.md` | Remove phantom events or document their internal non-IPC status. |
| **GAP-14** | Event/IPC | Medium | Payload mismatch on `ScopeViolationAttempt` (Rust struct with `ScopeDecision` vs Proto fields). | `V6_COMMON_TYPES.rs`, `V6_IPC_CONTRACTS.proto` | Align fields: `request_id, attempted_uri, violation_reason, timestamp, target, decision_id`. |
| **GAP-15** | Config | High | Missing `SentinelConfig` struct in `V6_COMMON_TYPES.rs`. | `V6_COMMON_TYPES.rs` | Implement `SentinelConfig` with database path, log level, and memory limit. |
| **GAP-16** | Config | Medium | `ScanConfig`, `ResourceBudget`, and `OastConfig` struct field divergence across Types and Architecture. | `V6_COMMON_TYPES.rs`, `V6_FINAL_CONFIGURATION_REGISTRY.md`, `V6_FINAL_ARCHITECTURE.md` | Unify fields in `V6_CANONICAL_SPEC.yaml`. |
| **GAP-17** | Storage | Critical | Missing SQL tables `verifications` and `evidence`. `findings.verification_id` is an orphaned reference. | `V6_SQLITE_SCHEMA.sql` | Create `verifications` and `evidence` tables with foreign key relationships. |
| **GAP-18** | Storage | High | Missing foreign key indexes across 8 SQLite tables (`parameters`, `credentials`, `oast_interactions`, `candidates`, `findings`, `scan_configs`, `cloud_assets`, `observations`). | `V6_SQLITE_SCHEMA.sql` | Add explicit `CREATE INDEX` statements for all foreign keys. |
| **GAP-19** | Storage | Medium | Obsolete table name `casm_assets` in SQL. | `V6_SQLITE_SCHEMA.sql` | Rename to `subdomain_assets`. |
| **GAP-20** | Storage | High | `credentials` table stores `encrypted_payload` without `secret_reference` UUID linking to OS vault. | `V6_SQLITE_SCHEMA.sql`, `V6_COMMON_TYPES.rs` | Reconcile `credentials` table to store `secret_reference TEXT NOT NULL` pointing to the secure vault. |
| **GAP-21** | Grammar | Medium | HTTPQL PEG grammar cannot parse specific header names (e.g. `res.header.Server`) or escaped quotes `\"`. | `V6_HTTPQL_GRAMMAR.pest` | Extend `field` rule with `header_field` and update `inner_str` to support escaped quotes. |
| **GAP-22** | Types | High | Domain model structs in `V6_COMMON_TYPES.rs` (`Scope`, `GraphNode`, `GraphEdge`, `Endpoint`, `Identity`, `OastInteraction`, `PRoute`, `SastFinding`) miss database fields (`version`, `timestamp`, `metadata_json`, etc.). | `V6_COMMON_TYPES.rs`, `V6_SQLITE_SCHEMA.sql` | Synchronize struct fields with SQLite schema. |

---

## 9. Canonical Specification Structure for `V6_CANONICAL_SPEC.yaml`

To eliminate all split-brain inconsistencies and establish the authoritative machine-readable source of truth, `V6_CANONICAL_SPEC.yaml` must follow this structure:

```yaml
version: "6.0.0"
metadata:
  date: "2026-08-17"
  status: "FROZEN"
  authority: "V6 Lead Architecture Team"

subsystems:
  tier_counts:
    core: 14
    professional: 7
    adapter: 4
    research: 3
    total: 28
  manifest:
    - id: "SUB-01"
      name: "ProxyEngine"
      tier: "Core"
      trait: "ProxyEngine"
      events_emitted: ["ObservationCreated"]
      events_consumed: []
      primary_types: ["Transaction", "ProxyConfig", "InterceptRule"]
      security_boundary: "Untrusted network input"
      dependencies: ["HTTPParser", "ScopeEngine", "EventBus", "ObservationStore"]
    # ... all 28 subsystems

traits:
  - name: "ProxyEngine"
    subsystem: "SUB-01"
    is_async: true
    methods:
      - name: "start"
        args: [{ name: "config", type: "ProxyConfig" }]
        return: "Result<(), SentinelError>"
      - name: "stop"
        args: []
        return: "Result<(), SentinelError>"
      - name: "register_interceptor"
        args: [{ name: "interceptor", type: "Box<dyn ProxyInterceptor>" }]
        return: "()"
      - name: "set_intercept_rules"
        args: [{ name: "rules", type: "Vec<InterceptRule>" }]
        return: "()"
  # ... all 28 traits with exact signatures

events:
  broadcast:
    - name: "ObservationCreated"
      rust_type: "SentinelEvent::ObservationCreated(Uuid)"
      proto_message: "UiTrafficEvent"
      proto_tag: 1
      producer: "ProxyEngine"
  critical:
    - name: "FindingCreated"
      rust_type: "CriticalEvent::FindingCreated(Uuid)"
      proto_message: "UiFindingEvent"
      proto_tag: 2
      producer: "VerificationEngine"
  # ... all events

configuration:
  - name: "SentinelConfig"
    owner: "Main"
    fields:
      - name: "database_path"
        type: "PathBuf"
        default: "~/.sentinel/projects/"
      - name: "log_level"
        type: "String"
        default: "INFO"
      - name: "max_memory_mb"
        type: "u32"
        default: 4096

storage:
  sqlite:
    tables:
      # ... all 24 reconciled tables, columns, types, foreign keys, indexes
  blob_store:
    root_path: "<project>/blobs/"
    naming: "UUID v4"
    hashing: "SHA-256"
  tantivy:
    root_path: "<project>/tantivy/"
    indexed_fields: ["req_normalized_text", "res_normalized_text", "req_uri", "req_method", "res_status"]

security_invariants:
  - id: "INV-01"
    name: "Scope Invariant"
    rule: "No outbound active request without ScopeDecision (Fail-Closed)"
  - id: "INV-02"
    name: "AI Policy Isolation"
    rule: "No AI network action without Host-Side Policy evaluation"
  - id: "INV-03"
    name: "Plugin Capability Sandbox"
    rule: "No plugin network or filesystem access without explicit capability grant"
  - id: "INV-04"
    name: "Zero Plaintext Secrets"
    rule: "Credential -> SecretReference -> OS Secure Vault. Zero plaintext in logs/DB/events"
  - id: "INV-05"
    name: "Research Module Isolation"
    rule: "Research modules behind #[cfg(feature = 'sentinel-research')]; core compiles without them"
```

---

## 10. Concrete Recommendations for Reconciliation

1. **Adopt Canonical Spec Authority**:
   Generate `V6_CANONICAL_SPEC.yaml` containing the fully reconciled models, traits, events, configs, and SQL definitions.
2. **Synchronize Rust Type Registry (`V6_COMMON_TYPES.rs`)**:
   - Add missing methods (`insert_batch`, `get`, `rebuild_index`, `pause`, `resume`, `restore_checkpoint`, `resume_scan`, `cancel_scan`, `add_credential`, `list_identities`, `refresh_credential`, `add_edge`, `query_neighbors`, `resolve_entity`, `screenshot`, `close`, `load_rhai`, `unload`, `list_checks`, `hot_reload`, `tool_name`).
   - Add `SentinelConfig` struct.
   - Synchronize domain entity structs with database columns (`version`, `timestamp`, `metadata_json`).
   - Fix `ScopeDecision` to include `decision_id: Uuid` and `timestamp: DateTime<Utc>`.
   - Fix `AuthzMatrix` to map `(Uuid, Uuid) -> AccessLevel`.
3. **Synchronize Protobuf IPC Contracts (`V6_IPC_CONTRACTS.proto`)**:
   - Add `UiCandidateVerifiedEvent` and map it to `SentinelUiStream` tag 8.
   - Align `UiScopeViolationEvent` and `UiScanProgressEvent` field schemas with Rust definitions.
4. **Repair Database Schema (`V6_SQLITE_SCHEMA.sql`)**:
   - Add `verifications` and `evidence` tables.
   - Add missing foreign key indexes across all 8 tables.
   - Rename `casm_assets` to `subdomain_assets`.
   - Update `credentials` table to store `secret_reference TEXT NOT NULL`.
5. **Enhance PEG Grammar (`V6_HTTPQL_GRAMMAR.pest`)**:
   - Add `header_field` rule for subfield matching (`res.header.Server`, `req.header.Authorization`).
   - Fix `inner_str` to support escaped quotes `\"`.
6. **Update Configuration Registry (`V6_FINAL_CONFIGURATION_REGISTRY.md`)**:
   - Detail `OastConfig`, `TaskConfig`, and `PluginSandboxConfig` parameters.
7. **Reconcile Subsystem Manifest (`V6_FINAL_SUBSYSTEM_MANIFEST.md`)**:
   - Remove phantom events `ObservationStored` and `ScopeUpdated`.

---
*End of Specification Survey Report — Prepared by `spec_miner_survey_2`.*

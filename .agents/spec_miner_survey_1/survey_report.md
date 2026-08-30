# SENTINEL V6 — COMPREHENSIVE ARCHITECTURAL SPECIFICATION & MINING SURVEY REPORT

> **AUTHOR**: `spec_miner_survey_1` (Domain Model, Types, Scoping, Credentials, Subsystems & Errors)  
> **DATE**: 2026-08-17  
> **WORKSPACE**: `c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6`  
> **TARGET CANONICAL SOURCE**: `V6_CANONICAL_SPEC.yaml`  
> **STATUS**: COMPLETE SPECIFICATION MINING AUDIT  

---

## Executive Summary

This report delivers an exhaustive specification mining and comparative consistency analysis of the SENTINEL V6 architecture across all 27 files in `architecture/v6`. The primary objective is to establish the exact canonical requirements for `V6_CANONICAL_SPEC.yaml`, uncover every discrepancy, missing type/field, naming divergence, and split-brain defect across Rust code scaffolding (`V6_COMMON_TYPES.rs`), Markdown registries (`V6_FINAL_*.md`), SQL schemas (`V6_SQLITE_SCHEMA.sql`), and Protobuf contracts (`V6_IPC_CONTRACTS.proto`), and provide concrete reconciliation blueprints.

---

## Features Discovered

| # | Category | Feature / Concept | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|-------------------|-------------|--------|---------|----------------|----------------|
| 1 | Subsystem | ProxyEngine (SUB-01) | Intercepts, inspects, and modifies HTTP/1.1 and HTTP/2 traffic | `ProxyConfig`, `InterceptRule` | Emits `ObservationCreated`, `InterceptHit` | `ScopeViolation`, `ParseError`, `TlsError`, `Io` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_FINAL_ARCHITECTURE.md` |
| 2 | Subsystem | HTTPParser (SUB-02) | Fault-tolerant, byte-perfect HTTP parser preserving raw byte fidelity | Raw byte slice `&[u8]` | `ParsedRequest`, `ParsedResponse` | `ParseError` (on unrecoverable syntax) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 3 | Subsystem | ObservationStore (SUB-03) | Dual-write persistence for metadata (SQLite WAL) and full-text search (Tantivy) | `Observation`, SQL query string, FTS query | `Vec<Observation>`, `ObservationStored` event | `Database`, `Tantivy`, `Io` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_SQLITE_SCHEMA.sql` |
| 4 | Subsystem | ScopeEngine (SUB-04) | Fail-closed network ACL authorization engine; validates URI and IP targets | Target URI/IP string, `Scope` definition | `ScopeDecision` struct | Fails closed (DENY) on regex timeout / error | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_FINAL_SECURITY_INVARIANTS.md` |
| 5 | Subsystem | EventBus (SUB-05) | Two-tier asynchronous message bus (broadcast for telemetry, mpsc for critical) | `SentinelEvent`, `CriticalEvent` | Receiver channels | `BusOverflow` (backpressure on critical) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_FINAL_EVENT_REGISTRY.md` |
| 6 | Subsystem | TaskScheduler (SUB-06) | Priority task queue with checkpointing, pause/resume, and resource budgets | `TaskConfig`, checkpoint state bytes | `TaskStateUpdate`, task UUID | `Database`, `Io` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 7 | Subsystem | ScanOrchestrator (SUB-07) | State machine for active scans; merges test scheduling and execution | `ScanConfig`, `ResourceBudget` | `ScanProgressUpdate`, scan UUID | `ScopeViolation`, `Database` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_FINAL_PHASE_ROADMAP.md` |
| 8 | Subsystem | FuzzerEngine (SUB-08) | Mutation generator for injection testing with mutation rate limits | Seed `Transaction`, `FuzzProfile` | `FuzzStream` payload stream | `Io`, `InvariantViolation` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 9 | Subsystem | VerificationEngine (SUB-09) | Active vulnerability proof engine eliminating false positives | `Candidate`, `VerificationStrategyRef` | `VerificationResult`, `CandidateVerified` event | `ScopeViolation`, `Database`, `Timeout` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 10 | Subsystem | ContextEngine (SUB-10) | Passive technology fingerprinting and parameter semantic classification | Seed `Transaction`, param name/value | `Vec<TechFingerprint>`, `ParameterClass` | Safe regex timeouts | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_BUILTIN_RULES_AND_PATTERNS.yaml` |
| 11 | Subsystem | CoverageEngine (SUB-11) | Tracks attack surface testing progress and parameter coverage | Endpoint ID, scope UUID | `CoverageReport`, `CoverageUpdate` event | `Database` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 12 | Subsystem | IdentityManager (SUB-12) | Manages authentication tokens and injects session headers | `Identity`, `Credential`, target `ParsedRequest` | Injected `ParsedRequest`, Identity UUID | `Database`, `Io` (Keychain failure) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 13 | Subsystem | KnowledgeEngine (SUB-13) | Graph topology store; finds shortest attack paths and neighbor nodes | `GraphNode`, `GraphEdge`, start/end UUIDs | `Vec<Vec<GraphEdge>>`, `GraphNode` | `Database` (CTE recursion limit) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 14 | Subsystem | ReportEngine (SUB-14) | Finding exporter generating structured PDF/MD/JSON/HTML reports | `ReportConfig`, Finding UUIDs | Formatted report byte buffer `Vec<u8>` | `Io`, `Database` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 15 | Subsystem | BrowserService (SUB-15) | Out-of-process Playwright browser runner for DOM XSS and JS analysis | Navigation URL, JS script string | `NavigationResult`, DOM HTML string, screenshot bytes | Playwright IPC error, timeout | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_IPC_CONTRACTS.proto` |
| 16 | Subsystem | OASTServer (SUB-16) | Out-of-band listener (DNS/HTTP/HTTPS) for SSRF/RCE callback correlation | `OastConfig`, interaction token | `Vec<OastInteraction>`, token string | Socket bind error, TLS error | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 17 | Subsystem | AuthorizationEngine (SUB-17) | Automated IDOR / horizontal privilege escalation matrix testing | `Vec<Identity>`, `Vec<Endpoint>` | `AuthzMatrix`, `Vec<AuthzViolation>` | `Database`, `ScopeViolation` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 18 | Subsystem | AIEngine (SUB-18) | LLM prompt synthesis and response generation (optional acceleration) | `AiRequest` | `AiResponse` | `AiEngine` (timeout, API quota) | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 19 | Subsystem | AIPolicyEngine (SUB-19) | 5-layer security filter ensuring AI cannot execute destructive actions | Raw prompt/output strings, proposed command | `PolicyResult` (Approved, Blocked, Filtered, RequiresHumanApproval) | Fail-closed policy block | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_FINAL_SECURITY_REVIEW.md` |
| 20 | Subsystem | PluginRuntime (SUB-20) | WASM / Rhai sandboxed plugin execution with capability-based security | WASM bytes, `PluginSandboxConfig`, `PluginInput` | `PluginOutput`, plugin UUID | `SandboxViolation`, `Io` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 21 | Subsystem | ResearchPackManager (SUB-21) | Loads, validates ed25519 signatures, and manages security check packs | Pack file path, signature | `PackManifest`, `Vec<SecurityCheck>` | Signature failure, `Io` | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 22 | Subsystem | SubfinderAdapter (SUB-22) | Process wrapper for Subfinder passive subdomain enumeration | Target domain string | `SubdomainAsset` (JSON) | Subprocess execution failure, timeout | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 23 | Subsystem | CloudFoxAdapter (SUB-23) | Read-only process wrapper for CloudFox cloud asset discovery | AWS/GCP credential reference | `CloudAsset` (JSON) | Read-only violation, subprocess failure | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 24 | Subsystem | SemgrepAdapter (SUB-24) | Process wrapper for Semgrep static code analysis (SAST) | Source code path, rule config | `SastFinding` (JSON) | Subprocess execution failure | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 25 | Subsystem | OpenApiParser (SUB-25) | Parameterized API route parser for OpenAPI / Swagger specs | Spec text / file path | `Vec<PRoute>` | `ParseError`, ReDoS limit | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 26 | Subsystem | SmtSolverEngine (SUB-26) | Z3-based formal symbolic reasoning engine (feature-flagged) | Source code AST, security invariant | `SymbolicPath` proof | Timeout, SMT solver error | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 27 | Subsystem | RlStateEngine (SUB-27) | Deep reinforcement learning for state-space traversal (feature-flagged) | Initial application URL | `Vec<RlRewardModel>` | Exploration limit, timeout | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 28 | Subsystem | CryptoAnalysisEngine (SUB-28) | Lattice reduction & cryptographic flaw analyzer (feature-flagged) | PCAP packet bytes | `Option<CryptoWeakness>` | Invalid PCAP format | `V6_FINAL_SUBSYSTEM_MANIFEST.md`, `V6_COMMON_TYPES.rs` |
| 29 | Domain Pipeline | Transaction -> Finding Pipeline | Immutable multi-stage lifecycle from raw traffic to verified finding | Raw HTTP exchange | Cryptographically proven `Finding` | Strict validation gate at each hop | `V6_FINAL_DOMAIN_MODEL.md`, `ORIGINAL_REQUEST.md` |
| 30 | Credential Model | Zero-Knowledge Secret Vault | Decouples credential metadata from encrypted secrets via OS Keychain | Master keychain key + Secret UUID | Decrypted secret stream | Keychain access error | `ORIGINAL_REQUEST.md`, `V6_COMMON_TYPES.rs` |
| 31 | Scope Model | Fail-Closed Scope Decision | Evaluates network destinations with decision provenance and rule matching | Hostname, URI, resolved IP | `ScopeDecision` | Out-of-scope drop, DNS rebinding block | `V6_FINAL_SECURITY_INVARIANTS.md`, `ORIGINAL_REQUEST.md` |

---

## 1. Subsystems: Taxonomy, Manifest, Arithmetic, & Obsolete Names Audit

### 1.1 Canonical Tier Taxonomy & Arithmetic

The SENTINEL V6 architecture strictly defines **28 subsystems** partitioned into four explicit functional tiers:

$$\text{Total Subsystems} = 14 \text{ (Core)} + 7 \text{ (Professional)} + 4 \text{ (Adapter)} + 3 \text{ (Research)} = 28$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                     SENTINEL V6 SUBSYSTEM TAXONOMY                     │
├────────────────────────────────────────────────────────────────────────┤
│  CORE TIER (14 Subsystems) [Single Local Desktop Binary]               │
│  SUB-01: ProxyEngine          SUB-08: FuzzerEngine                     │
│  SUB-02: HTTPParser           SUB-09: VerificationEngine               │
│  SUB-03: ObservationStore     SUB-10: ContextEngine                    │
│  SUB-04: ScopeEngine          SUB-11: CoverageEngine                   │
│  SUB-05: EventBus             SUB-12: IdentityManager                  │
│  SUB-06: TaskScheduler        SUB-13: KnowledgeEngine                  │
│  SUB-07: ScanOrchestrator     SUB-14: ReportEngine                     │
├────────────────────────────────────────────────────────────────────────┤
│  PROFESSIONAL TIER (7 Subsystems) [Desktop Binary + Daemons]           │
│  SUB-15: BrowserService       SUB-19: AIPolicyEngine                   │
│  SUB-16: OASTServer           SUB-20: PluginRuntime                    │
│  SUB-17: AuthorizationEngine  SUB-21: ResearchPackManager              │
│  SUB-18: AIEngine                                                      │
├────────────────────────────────────────────────────────────────────────┤
│  ADAPTER TIER (4 Subsystems) [External Process Wrappers]               │
│  SUB-22: SubfinderAdapter     SUB-24: SemgrepAdapter                   │
│  SUB-23: CloudFoxAdapter      SUB-25: OpenApiParser                    │
├────────────────────────────────────────────────────────────────────────┤
│  RESEARCH TIER (3 Subsystems) [#[cfg(feature = "sentinel-research")]]   │
│  SUB-26: SmtSolverEngine      SUB-28: CryptoAnalysisEngine             │
│  SUB-27: RlStateEngine                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Canonical Subsystem Registry Table

| Subsystem ID | Canonical Name | Tier | Primary Trait / Interface | Emitted Events | Primary In/Out Data Types | Hard Dependencies | Security Boundary / Invariant |
|--------------|----------------|------|---------------------------|----------------|---------------------------|-------------------|--------------------------------|
| `SUB-01` | `ProxyEngine` | Core | `ProxyEngine` | `ObservationCreated`, `InterceptHit` | `Transaction`, `InterceptRule` | HTTPParser, ScopeEngine, EventBus, ObservationStore | Untrusted network input; 10MB memory bound |
| `SUB-02` | `HTTPParser` | Core | `HttpParser` | *(Synchronous)* | `ParsedRequest`, `ParsedResponse` | *None* | Forked httparse; byte-preserving; ReDoS protected |
| `SUB-03` | `ObservationStore` | Core | `ObservationStore` | `ObservationStored` | `Observation`, `Transaction` | *None* | Encrypted secrets at rest; single async writer |
| `SUB-04` | `ScopeEngine` | Core | `ScopeEngine` | `ScopeUpdated` | `Scope`, `ScopeDecision` | *None* | Fail-closed (Default DENY); socket-level IP binding |
| `SUB-05` | `EventBus` | Core | `EventBus` | *(Carrier)* | `SentinelEvent`, `CriticalEvent` | *None* | Critical channel (mpsc) never drops; broadcast drops on lag |
| `SUB-06` | `TaskScheduler` | Core | `TaskScheduler` | *(Publishes via EventBus)* | `TaskConfig`, `TaskStateUpdate` | EventBus | Priority queue; WAL checkpointing; budget bounds |
| `SUB-07` | `ScanOrchestrator` | Core | `ScanOrchestrator` | `ScanProgress`, `ScanProgressUpdate` | `ScanConfig`, `ResourceBudget` | TaskScheduler, FuzzerEngine, CoverageEngine, EventBus | Enforces scope before test generation |
| `SUB-08` | `FuzzerEngine` | Core | `FuzzerEngine` | *(Synchronous Stream)* | `FuzzProfile`, `Payload`, `FuzzStream` | HTTPParser | Safe payloads by default; Rayon thread bounds |
| `SUB-09` | `VerificationEngine`| Core | `VerificationEngine` | `CandidateVerified` | `Candidate`, `VerificationResult`, `Evidence` | ObservationStore | Proof requirement; safe non-destructive verification |
| `SUB-10` | `ContextEngine` | Core | `ContextEngine` | `ContextDetected` | `TechFingerprint`, `ParameterClass` | ObservationStore | ReDoS bounded regex; 5MB payload skip |
| `SUB-11` | `CoverageEngine` | Core | `CoverageEngine` | `CoverageUpdate` | `CoverageReport`, `Endpoint` | ObservationStore | Parameter space mapping |
| `SUB-12` | `IdentityManager` | Core | `IdentityManager` | `IdentityStateChanged` | `Identity`, `Credential`, `SecretReference` | ObservationStore | OS Keychain master key; zero plaintext secrets |
| `SUB-13` | `KnowledgeEngine` | Core | `KnowledgeEngine` | *(Internal updates)* | `GraphNode`, `GraphEdge` | ObservationStore | Adjacency list in SQLite; bounded CTE recursion (max 5) |
| `SUB-14` | `ReportEngine` | Core | `ReportEngine` | *(Synchronous)* | `ReportConfig`, `ReportFormat` | ObservationStore | Sandboxed file generation; no remote script eval |
| `SUB-15` | `BrowserService` | Professional | `BrowserService` | *(IPC Events)* | `NavigationResult`, `DOMSource` | *None* | Out-of-process gRPC; max 3-5 Playwright contexts |
| `SUB-16` | `OASTServer` | Professional | `OastServer` | `OastCallback` | `OastConfig`, `OastInteraction`, `OastEvidence`| ScopeEngine | AES-256-GCM stateless tokens; DNS/HTTP listeners |
| `SUB-17` | `AuthorizationEngine`| Professional | `AuthorizationEngine`| *(Findings emitted)* | `AuthzMatrix`, `AuthzViolation` | IdentityManager | Parameter override support; IDOR detection |
| `SUB-18` | `AIEngine` | Professional | `AiEngine` | *(Synchronous)* | `AiRequest`, `AiResponse` | AIPolicyEngine | Platform 100% functional with `is_available() == false` |
| `SUB-19` | `AIPolicyEngine` | Professional | `AiPolicyEngine` | *(Internal Filter)* | `PolicyResult` | ScopeEngine | 5-layer defense; blocks destructive OS/SQL payloads |
| `SUB-20` | `PluginRuntime` | Professional | `PluginRuntime` | *(Execution status)* | `PluginSandboxConfig`, `Capabilities` | ScopeEngine | Wasmtime sandbox; WASI capability dropping |
| `SUB-21` | `ResearchPackManager`| Professional | `ResearchPackManager`| *(Pack reload)* | `PackManifest`, `SecurityCheck` | *None* | Ed25519 cryptographic signature verification |
| `SUB-22` | `SubfinderAdapter` | Adapter | `ExternalToolAdapter`| *(Asset creation)* | `SubdomainAsset` | ScopeEngine | Subprocess JSON over stdio; out-of-process isolation |
| `SUB-23` | `CloudFoxAdapter` | Adapter | `ExternalToolAdapter`| *(Asset creation)* | `CloudAsset` | ScopeEngine | READ-ONLY by default; write requires human approval |
| `SUB-24` | `SemgrepAdapter` | Adapter | `ExternalToolAdapter`| *(Finding creation)| `SastFinding` | *None* | Subprocess JSON over stdio; license isolation (LGPL) |
| `SUB-25` | `OpenApiParser` | Adapter | `ExternalToolAdapter`| *(Endpoint creation)| `PRoute` | *None* | Fast ReDoS-bounded schema parsing |
| `SUB-26` | `SmtSolverEngine` | Research | `SmtSolverEngine` | *(Proof output)* | `SymbolicPath` | VerificationEngine | `#[cfg(feature = "sentinel-research")]`; Z3 solver |
| `SUB-27` | `RlStateEngine` | Research | `RlStateEngine` | *(Model output)* | `RlRewardModel` | BrowserService | `#[cfg(feature = "sentinel-research")]`; RL state |
| `SUB-28` | `CryptoAnalysisEngine`| Research | `CryptoAnalysisEngine`| *(Weakness output)| `CryptoWeakness` | ObservationStore | `#[cfg(feature = "sentinel-research")]`; PCAP analysis |

### 1.3 Audit of Obsolete Subsystem Names & Lingering References

A critical source of past confusion in SENTINEL V6 was the consolidation and renaming of legacy modules. The table below maps every obsolete name to its canonical replacement and lists all lingering references found across the workspace:

| Obsolete / Legacy Name | Canonical Subsystem | Consolidation Rationale | Lingering Occurrences in `architecture/v6` |
|------------------------|---------------------|-------------------------|--------------------------------------------|
| `Scanner` / `ScannerEngine` | `SUB-07 ScanOrchestrator` | Renamed to reflect orchestration, budgeting, and state machine lifecycle. | `V6_FINAL_CONSISTENCY_REPORT.md` (line 83), `V6_FINAL_DEPENDENCY_GRAPH.md` (lines 20, 152), `V6_FINAL_PHASE_ROADMAP.md` (lines 55, 73), `V6_SQLITE_SCHEMA.sql` (line 182). |
| `CasmEngine` | `SUB-22 SubfinderAdapter` | Converted from monolithic engine to subprocess wrapper implementing `ExternalToolAdapter`. | `V6_FINAL_ARCHITECTURE.md` (lines 27, 806), `V6_FINAL_CONSISTENCY_REPORT.md` (lines 23, 83), `V6_SQLITE_SCHEMA.sql` (table `casm_assets`, line 206). |
| `CloudEngine` | `SUB-23 CloudFoxAdapter` | Converted from heavy custom engine to read-only tool adapter implementing `ExternalToolAdapter`. | `V6_FINAL_ARCHITECTURE.md` (lines 27, 143, 808, 841), `V6_FINAL_RISK_REGISTER.md` (lines 110, 115, 120, 240), `V6_FINAL_SECURITY_REVIEW.md` (lines 70, 74, 76), `V6_FINAL_PHASE_ROADMAP.md` (line 28). |
| `SastEngine` | `SUB-24 SemgrepAdapter` | Converted from custom SAST engine to external Semgrep wrapper. | `V6_FINAL_ARCHITECTURE.md` (lines 27, 807), `V6_FINAL_CONSISTENCY_REPORT.md` (line 83), `V6_FINAL_PHASE_ROADMAP.md` (line 29). |
| `ApiDiscoveryEngine` | `SUB-25 OpenApiParser` | Simplified to deterministic schema parser for OpenAPI/Swagger. | `V6_FINAL_ARCHITECTURE.md` (line 27), `V6_FINAL_CONSISTENCY_REPORT.md` (line 83), `V6_SQLITE_SCHEMA.sql` (table `api_proutes`, line 221). |
| `AttackGraphEngine` | `SUB-13 KnowledgeEngine` | Merged into `KnowledgeEngine` as a graph traversal module (ADR-009). | `V6_FINAL_ARCHITECTURE.md` (lines 464, 804). |
| `NextBestTestEngine` | `SUB-07 ScanOrchestrator` | Merged into `ScanOrchestrator` as an algorithmic scoring function. | `V6_FINAL_ARCHITECTURE.md` (lines 320, 805), `V6_FINAL_PHASE_ROADMAP.md` (line 85). |
| `BusinessLogicEngine` | `SUB-17 AuthorizationEngine` / UI Workflow Recorder | Replaced automated business logic claims with honest manual workflow recording and replay. | `V6_FINAL_ARCHITECTURE.md` (line 811), `V6_FINAL_PHASE_ROADMAP.md` (lines 30, 85). |

### 1.4 Arithmetic Inconsistencies Discovered in Existing Documentation

1. **`V6_FINAL_ARCHITECTURE.md` Section 15 ("Simplifications Applied", line 813-815)**:
   - *Text states*: `"Subsystem count: 31 → 22 (14 CORE, 7 PROFESSIONAL, 4 ADAPTER, 3 RESEARCH)"`
   - *Error*: Mathematically, $14 + 7 + 4 + 3 = 28$, **NOT 22**. The number 22 resulted from accidentally omitting Adapters (4) and Research (3) ($14 + 7 + 1 = 22$).
   - *Reconciliation*: The canonical statement MUST read: `"Subsystem count: 31 → 28 (14 CORE, 7 PROFESSIONAL, 4 ADAPTER, 3 RESEARCH)"`.

---

## 2. Domain Model & Lifecycle Specification

### 2.1 The Authoritative Core Pipeline

The core domain workflow of SENTINEL V6 follows an immutable 6-stage evidence progression pipeline:

$$\text{Transaction} \xrightarrow{\text{extract}} \text{Observation} \xrightarrow{\text{hypothesize}} \text{Candidate} \xrightarrow{\text{verify}} \text{VerificationResult} \xrightarrow{\text{bind proof}} \text{Evidence} \xrightarrow{\text{confirm}} \text{Finding}$$

```
┌──────────────┐     ┌─────────────┐     ┌───────────┐     ┌────────────────────┐     ┌──────────┐     ┌─────────┐
│ Transaction  │ ──► │ Observation │ ──► │ Candidate │ ──► │ VerificationResult │ ──► │ Evidence │ ──► │ Finding │
└──────────────┘     └─────────────┘     └───────────┘     └────────────────────┘     └──────────┘     └─────────┘
  (Raw HTTP/TLS        (Phenomenon in      (Hypothesis        (Active Test Exec:       (Cryptographic   (Confirmed
   Exchange)            Traffic)            of Vuln)           Differential/OAST/Timing)  Proof)           Vuln)
```

1. **`Transaction`**: Immutable record of an HTTP/TLS exchange. Preserves triple representation: raw bytes in blob storage, structured parts in memory, and normalized text for search.
2. **`Observation`**: Discrete phenomenon extracted from a transaction (e.g. reflected input parameter, anomalous response header, discovered endpoint). Immutable once persisted.
3. **`Candidate`**: A testable hypothesis generated passively by rules or AI asserting that an Observation indicates a vulnerability.
4. **`VerificationResult`**: The execution outcome of an active verification strategy (Differential, OAST, Timing, Content, Browser).
5. **`Evidence`**: Content-addressed (SHA-256) cryptographic, mathematical, or empirical proof attached to the verification outcome.
6. **`Finding`**: A confirmed security vulnerability backed by verified evidence, assigned a severity, and tracked through remediation.

### 2.2 Exhaustive Audit of All 20 Supporting Entities

In accordance with `ORIGINAL_REQUEST.md`, the table below evaluates the exact specification, Rust type representation, SQL schema mapping, and current status for all 20 domain and supporting entities:

| # | Entity Name | Canonical Definition | Rust Representation (`V6_COMMON_TYPES.rs`) | SQLite Table (`V6_SQLITE_SCHEMA.sql`) | Current Discrepancy / Gap | Canonical Requirement for `V6_CANONICAL_SPEC.yaml` |
|---|-------------|----------------------|---------------------------------------------|---------------------------------------|----------------------------------------------------|----------------------------------------------------|
| 1 | **Scope** | Network ACL ruleset defining target boundaries | `struct Scope { id, includes, excludes }` | `CREATE TABLE scopes` | Rust lacks version/timestamp; SQL lacks structured rules | Add `meta: EntityMetadata`, `version: u64`, `rules: Vec<ScopeRule>` |
| 2 | **Endpoint** | Unique Host + Path + Method combination | `struct Endpoint { id, host, path, method, graph_node_id }` | `CREATE TABLE endpoints` | Synced; parameters separated into `parameters` table | Standardize `Endpoint` entity with parameter links |
| 3 | **Payload** | Test string destined for a parameter injection point | `struct Payload { id, injection_point, payload_string, expected_behavior }` | *N/A (Transient/In-memory)* | No persistence schema in SQL | Keep transient in memory; record in `Transaction` blobs |
| 4 | **Identity** | User persona / role context for auth testing | `struct Identity { id, token_reference }` | `CREATE TABLE identities` | Extreme mismatch: SQL has `username`, `roles_json`; Rust only has `token_reference` | Align Rust struct with SQL: `id`, `username`, `roles`, `meta: EntityMetadata` |
| 5 | **Session** | Active authenticated session state & cookie jar | *Missing in Rust types* | *Missing in SQL schema* | **MISSING**: No dedicated `Session` struct or table | Define `struct Session { id: Uuid, identity_id: Uuid, cookies: HashMap<String, String>, headers: HashMap<String, String>, expires_at: Option<DateTime<Utc>> }` |
| 6 | **Credential** | Auth secret metadata linked to secret store | `struct Credential { id, identity_id, credential_type, secret_reference, access_level }` | `CREATE TABLE credentials` | SQL stores `encrypted_payload` directly; Rust has `secret_reference: Uuid` | Enforce `secret_reference: Uuid` in SQL; remove `encrypted_payload` |
| 7 | **SecretReference** | Indirection pointer to secure OS keychain vault | Typed as `Uuid` inside `Credential` | Foreign key to vault or UUID | Implicit UUID; no dedicated struct | Define `pub struct SecretReference(pub Uuid);` or document UUID scalar |
| 8 | **Asset** | Target network/system node (domain, IP, cloud) | Specialized as `SubdomainAsset`, `CloudAsset` | `casm_assets`, `cloud_assets`, `graph_nodes` | Fragmented across 3 tables and 2 structs | Define unified `Asset` enum/struct referencing `GraphNode` |
| 9 | **Technology** | Detected software stack on an endpoint | `struct TechFingerprint { tech, confidence }` | Stored as JSON in `graph_nodes` | Synced; regex defined in YAML | Define `struct Technology { id: String, name: String, category: String, version: Option<String> }` |
| 10 | **State** | Target application state or task execution state | `enum LifecycleState`, `enum TaskLifecycle`, `enum ScanLifecycle` | `app_state_machine`, `task_checkpoints` | Diverse state representations across modules | Unify platform states (`TaskLifecycle`, `ScanLifecycle`, `FindingLifecycle`, `AppState`) |
| 11 | **Workflow** | Sequence of multi-step requests/actions | *Missing in Rust types* | *Missing in SQL schema* | **MISSING**: Mentioned in ADR-008 & Architecture §15 #8 | Define `struct Workflow { id: Uuid, name: String, steps: Vec<WorkflowStep> }` |
| 12 | **Resource** | Compute, network, or time constraints | `struct ResourceBudget`, `struct ResourceLimits` | Stored as integers in configs | Split between scan budget and plugin sandbox limits | Formalize `ResourceBudget` (requests/duration) and `ResourceLimits` (memory/CPU) |
| 13 | **Action** | Executable operation (proxy, AI, plugin) | `struct InterceptRule`, `enum PolicyResult` | `proxy_intercept_rules` | No unified `Action` type | Unify action types across proxy and AI policies |
| 14 | **Task** | Asynchronous background work unit | `struct TaskConfig`, `struct TaskStateUpdate` | `CREATE TABLE task_checkpoints` | No unified `Task` entity struct with ID/meta | Define `struct Task { id: Uuid, config: TaskConfig, state: TaskStateUpdate, meta: EntityMetadata }` |
| 15 | **Report** | Exported assessment report document | `struct ReportConfig`, `enum ReportFormat` | *Missing in SQL schema* | Reports currently generated in-memory / on-disk without SQL metadata | Define `CREATE TABLE reports (id TEXT PRIMARY KEY, created_at DATETIME, format TEXT, path TEXT, config_json TEXT);` |
| 16 | **RegressionTest** | Automated finding replay test definition | `enum FindingLifecycle::Regression` | *Missing in SQL schema* | **MISSING**: No dedicated `RegressionTest` struct | Define `struct RegressionTest { id: Uuid, finding_id: Uuid, seed_transaction_id: Uuid, expected_status: FindingLifecycle }` |
| 17 | **OASTInteraction** | External DNS/HTTP callback from target | `struct OastInteraction { ip, time }` | `CREATE TABLE oast_interactions` | Rust struct lacks `protocol` and `raw_blob_id` present in SQL | Align Rust `OastInteraction` with SQL schema |
| 18 | **AttackPath** | Ordered sequence of exploitable graph edges | `Vec<Vec<GraphEdge>>` in `KnowledgeEngine` | Recursive CTE on `graph_edges` | No standalone named struct | Define `struct AttackPath { id: Uuid, start_node: Uuid, target_node: Uuid, edges: Vec<GraphEdge>, risk_score: f32 }` |
| 19 | **Note** | Pentester commentary attached to an entity | *Missing in Rust types* | *Missing in SQL schema* | **MISSING**: Present in original requirements | Define `struct Note { id: Uuid, target_id: Uuid, author: String, content: String, timestamp: DateTime<Utc> }` and SQL table |
| 20 | **Screenshot** | Visual DOM render of finding proof | `Evidence::BrowserSnapshot(Uuid)`, `TakeScreenshotResponse` | Stored in blob store | No dedicated entity struct | Define `struct Screenshot { id: Uuid, blob_id: Uuid, full_page: bool, timestamp: DateTime<Utc> }` |

### 2.3 Lifecycle State Machines & Immutability Rules

```
Entity Metadata Lifecycle:
  [Active] ──(archive)──► [Archived] ──(soft-delete)──► [Deleted]

Finding Lifecycle:
  [Candidate] ──(verify)──► [Verified] ──(triage)──► [Confirmed] ──(export)──► [Reported]
        │                       │                        │                         │
        │ (reject)              │ (unverified)           │ (re-test)               │ (patch)
        ▼                       ▼                        ▼                         ▼
  [FalsePositive]        [Candidate]              [Regression]              [Remediated]
                                                         ▲
                                                         │ (accept)
                                                  [AcceptedRisk]

Task Lifecycle:
  [Pending] ──► [Running] ──► [Paused] ──► [Completed]
                   │             │
                   ├──(fail)─────┼──► [Failed]
                   └──(cancel)───┴──► [Cancelled]

Scan Lifecycle:
  [Initializing] ──► [Running] ──► [Pausing] ──► [Paused] ──► [Finished]
                        │                          │
                        └──(error)─────────────────┴────────► [Error]
```

#### Immutability & Retention Rules:
1. **Transactions & Observations**: Strictly append-only. They are never physically modified or overwritten in SQLite. Soft-deletion sets `LifecycleState::Deleted`.
2. **Blob Storage**: Request/response bodies and browser screenshots are content-addressed (SHA-256) in the filesystem blob store. Modifying a blob file invalidates its content hash.
3. **Triple Representation Invariant**: Every HTTP interaction retains:
   - `raw_blob_id`: Byte-exact content in the blob store.
   - `parsed`: Structured headers, method, URI, and status code.
   - `normalized_text`: Canonicalized string representation for Tantivy full-text search.

---

## 3. Credential Security & Scope Model

### 3.1 Credential Security Model & Invariants

The security model strictly mandates **zero plaintext secrets** in domain records, SQLite databases, logs, telemetry events, knowledge graph edges, reports, or crash dumps.

```
┌──────────────────────────────────────────────────────────────────┐
│                      DOMAIN / SQLITE LAYER                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Credential Entity                                          │  │
│  │ - id: Uuid                                                 │  │
│  │ - identity_id: Uuid                                        │  │
│  │ - credential_type: String ("OAuth2", "JWT", "Basic", etc.) │  │
│  │ - secret_reference: Uuid ───────────────────────────────┐ │  │
│  │ - access_level: AccessLevel (Admin, User, TenantA)        │ │  │
│  └──────────────────────────────────────────────────────────┼─┘  │
└─────────────────────────────────────────────────────────────┼────┘
                                                              │
                                     UUID Lookup Indirection  │
                                                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  SECURE SECRET VAULT (OS KEYCHAIN)               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Platform-Specific Secure Storage:                          │  │
│  │ - Windows: Windows Credential Manager                      │  │
│  │ - macOS: Apple Keychain Services                           │  │
│  │ - Linux: Secret Service API / libsecret                    │  │
│  │                                                            │  │
│  │ Encrypted with master AES-256-GCM hardware/OS key.         │  │
│  │ Injected ONLY in-memory into `ParsedRequest` at socket hop │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

#### Key Invariants:
1. **No Plaintext Storage**: `V6_SQLITE_SCHEMA.sql` must NOT store `encrypted_payload TEXT` in the `credentials` table. Instead, it must store `secret_reference TEXT NOT NULL` pointing to the OS Keychain reference.
2. **Ephemeral In-Memory Decryption**: Only `IdentityManager::inject_auth()` may resolve a `secret_reference` to plaintext bytes, write them directly into an outgoing `ParsedRequest` header/cookie, and immediately zeroize the in-memory buffer.
3. **Telemetry & Log Redaction**: Any header identified as containing sensitive auth tokens (Authorization, Cookie, X-Api-Key) is masked (`[REDACTED]`) before publishing across `EventBus` or writing to `tracing` JSON logs.

### 3.2 Scope Model & ScopeDecision Specification

The SENTINEL V6 scope engine operates on an absolute **Default DENY (Fail-Closed)** model. No subsystem may initiate any outbound network activity without obtaining an explicit, structured `ScopeDecision`.

#### Canonical `ScopeDecision` Data Structure:
```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScopeDecision {
    pub decision_id: Uuid,
    pub allowed: bool,
    pub reason: String,
    pub matched_rule: Option<Uuid>,
    pub target: String,
    pub scope_version: u64,
    pub timestamp: DateTime<Utc>,
}
```

#### Scope Engine Invariants:
1. **Socket-Level IP Interception**: `ScopeEngine` evaluates both the target URI hostname and the actual resolved IP address prior to socket connection. If DNS resolves to a private IP (e.g. `127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`) and private IP ranges are not explicitly allowed in scope, the connection is aborted immediately (SSRF & DNS rebinding defense).
2. **ReDoS Protected Regex**: All user-supplied inclusion/exclusion rules are compiled with strict length bounds ($\le 1000$ characters) and evaluated with an execution timeout ($\le 100$ms). If the regex engine times out or faults, `ScopeDecision` returns `allowed: false, reason: "RegexTimeoutFailClosed"`.
3. **Audit Event Generation**: When a scope violation is detected, `ProxyEngine` or `ScanOrchestrator` generates a `CriticalEvent::ScopeViolationAttempt` containing the full `ScopeDecision`. This event is delivered over guaranteed mpsc to `ObservationStore` and the UI frontend (`UiScopeViolationEvent`).

---

## 4. Type Registry & Rust Scaffolding Comparative Audit

### 4.1 Exhaustive Enum Comparison

| Enum Name | `V6_COMMON_TYPES.rs` Variants | `V6_IPC_CONTRACTS.proto` Equivalent | Completeness Status |
|-----------|-------------------------------|-------------------------------------|---------------------|
| `HttpMethod` | GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE, CONNECT, GRAPHQL | Represented as string | Complete |
| `ParamLocation`| Query, Body, Header, Path, Cookie | Represented as string in params | Complete |
| `DataType` | String, Integer, Boolean, Float, Uuid, Json, Xml, Base64, Unknown | N/A | Complete |
| `Provenance` | Manual, Scanner, Fuzzer, Proxy, AI, Tool(Uuid) | N/A | Complete |
| `LifecycleState`| Active, Archived, Deleted | N/A | Complete |
| `TaskLifecycle`| Pending, Running, Paused, Completed, Failed, Cancelled | `enum TaskState` (1:1 mapped) | Complete |
| `ScanLifecycle`| Initializing, Running, Pausing, Paused, Finished, Error | Represented in string phase | Complete |
| `Severity` | Critical, High, Medium, Low, Info | `enum Severity` (1:1 mapped) | Complete |
| `FindingLifecycle`| Candidate, Verified, Confirmed, Reported, Remediated, FalsePositive, AcceptedRisk, Regression | `enum FindingLifecycle` (1:1 mapped) | Complete |
| `ObservationSource`| Proxy, OAST, Browser, Manual, Tool | N/A | Complete |
| `AccessLevel` | Admin, User, Anonymous, TenantA, TenantB | N/A | Complete |
| `ReportFormat` | Pdf, Markdown, Json, Html | N/A | Complete |
| `MutatorType` | BitFlip, ByteReplace, Grammar, Wordlist, Radamsa, AI | N/A | Complete |
| `VerificationStrategy`| BrowserExecution, OASTCorrelation, TimingStatistical, ResponseDifferential, StateVerification, AuthorizationReplay, ContentVerification, MathematicalVerification, ErrorClassification, CausalMinimization | N/A | Complete (10 strategies) |
| `ParameterClass`| ObjectId, Url, FilePath, Email, Token, Search, Numeric, Boolean, Json, Xml, Html, Enumeration, FreeText, Unknown | N/A | Complete |
| `PolicyResult` | Approved, Blocked, Filtered(String), RequiresHumanApproval | N/A | Complete |

### 4.2 Field-by-Field Discrepancy Matrix across Artifacts

| Type / Struct | `V6_COMMON_TYPES.rs` Definition | `V6_FINAL_ARCHITECTURE.md` | `V6_SQLITE_SCHEMA.sql` | `V6_IPC_CONTRACTS.proto` | Discrepancy & Reconciliation Action |
|---------------|---------------------------------|----------------------------|------------------------|--------------------------|-------------------------------------|
| `ScopeDecision` | `allowed: bool`, `reason: String`, `matched_rule: Option<Uuid>`, `target: String`, `scope_version: u64` | `is_in_scope() -> bool` (old signature) | N/A | `UiScopeViolationEvent` has `request_id`, `attempted_uri`, `violation_reason`, `timestamp` | **Add missing fields** `decision_id: Uuid` and `timestamp: DateTime<Utc>` to `ScopeDecision` in `V6_COMMON_TYPES.rs`. Update Architecture MD to return `ScopeDecision`. |
| `Scope` | `id: Uuid`, `includes: Vec<String>`, `excludes: Vec<String>` | Same | `id`, `version`, `timestamp`, `includes_json`, `excludes_json` | `UiCoverageEvent` references `scope_id` | **Add `version: u64` and `timestamp: DateTime<Utc>`** (or `meta: EntityMetadata`) to `Scope` in Rust. |
| `Identity` | `id: Uuid`, `token_reference: Uuid` | Mentioned as ID/token | `id`, `version`, `timestamp`, `username`, `roles_json` | N/A | **Reconcile Identity**: Rust struct is missing `username`, `roles: Vec<String>`, `meta: EntityMetadata`. Expand Rust struct. |
| `Credential` | `id`, `identity_id`, `credential_type`, `secret_reference: Uuid`, `access_level` | Mentions secure vault | `id`, `identity_id`, `auth_type`, `encrypted_payload`, `expires_at` | N/A | **Fix SQL table**: Rename `auth_type` to `credential_type`, replace `encrypted_payload` with `secret_reference TEXT NOT NULL`, add `access_level TEXT`. Add `expires_at: Option<DateTime<Utc>>` to Rust struct. |
| `Transaction` | `meta: EntityMetadata`, `request: MessageRepresentation`, `response: Option<MessageRepresentation>`, `timing: Duration`, `tls_info: Option<TlsData>` | Same | `id`, `timestamp`, `req_method`, `req_uri`, `req_blob_id`, `req_normalized_text`, `res_status`, `res_blob_id`, `res_normalized_text`, `timing_ms`, `tls_cipher` | `UiTrafficEvent` has `transaction_id`, `timestamp`, `method`, `uri`, `status`, `duration_ms`, `in_scope`, `tags` | SQL flattens `request` and `response` blobs. SQL is missing `version`, `provenance`, `lifecycle`, `scope_id`. Add metadata columns to `transactions` table in SQL. |
| `Observation` | `meta: EntityMetadata`, `source: ObservationSource`, `data_ref: Uuid` | Same | `id`, `version`, `timestamp`, `provenance`, `source`, `data_ref` | N/A | SQL is missing `lifecycle` and `scope_id`. Add `lifecycle` and `scope_id` columns to `observations` table. |
| `Candidate` | `meta: EntityMetadata`, `source_observation_id: Uuid`, `hypothesis: String`, `status: String` | Same | `id`, `timestamp`, `source_observation_id`, `hypothesis`, `status` | N/A | SQL is missing `version`, `provenance`, `lifecycle`, `scope_id`. Add metadata columns to `candidates` table. |
| `Finding` | `meta: EntityMetadata`, `title: String`, `severity: Severity`, `verification_id: Uuid`, `state: FindingLifecycle` | Same | `id`, `version`, `timestamp`, `title`, `severity`, `verification_id`, `state` | `UiFindingEvent` (1:1 mapped) | SQL is missing `provenance`, `lifecycle`, `scope_id`. Add metadata columns to `findings` table. Add dedicated `verification_results` table for `verification_id` foreign key. |
| `CoverageReport`| `total: u32`, `tested: u32` | `total_endpoints`, `tested_endpoints`, `total_parameters`, `tested_parameters`, `coverage_percent` | N/A | `total_endpoints`, `tested_endpoints`, `coverage_percent` | **Mismatched fields**: Rust struct is oversimplified (`total`, `tested`). Expand Rust struct to match Architecture MD and Proto: `total_endpoints`, `tested_endpoints`, `total_parameters`, `tested_parameters`, `coverage_percent`. |
| `ParsedRequest` | `method`, `uri`, `version`, `headers`, `body` | `raw: Vec<u8>`, `method`, `uri`, `version`, `headers`, `body`, `normalized: String`, `parse_warnings: Vec<ParseWarning>` | N/A | N/A | **Add `raw: Vec<u8>`, `normalized: String`, `parse_warnings: Vec<ParseWarning>`** to `ParsedRequest` in `V6_COMMON_TYPES.rs` to satisfy triple representation and parse warning contracts. |
| `FuzzProfile` | `insertion_points`, `mutators`, `encoders`, `concurrency`, `request_budget`, `timeout_ms`, `stop_conditions` | `mutators`, `max_mutations`, `injection_points`, `wordlist` | N/A | N/A | Architecture MD has an outdated snippet. Update Architecture MD to match the superior `V6_COMMON_TYPES.rs` definition. |
| `PluginSandboxConfig` | `capabilities: CapabilitySet`, `limits: ResourceLimits` | `Capabilities { network, filesystem, database_read, max_memory_mb, max_execution_ms }` | N/A | N/A | Architecture MD conflates capabilities with limits. Update Architecture MD to match the bifurcated Rust design (`CapabilitySet` + `ResourceLimits`). |
| `AiRequest` / `AiResponse` | `AiRequest { prompt }`, `AiResponse { content }` | `AiRequest` has `context`, `max_tokens`, `response_schema`; `AiResponse` has `tokens_used`, `provider`, `policy_result` | N/A | N/A | Rust structs are oversimplified. Expand `AiRequest` and `AiResponse` in `V6_COMMON_TYPES.rs` to match Architecture MD. |
| `AuthzMatrix` / `AuthzViolation` | `AuthzMatrix` expected is `HashMap<Uuid, AccessLevel>`; `AuthzViolation` only has `identity_id`, `endpoint_id` | `AuthzMatrix` expected is `HashMap<(Uuid, Uuid), AccessLevel>`; `AuthzViolation` has `violation_type`, `evidence`, `confidence` | N/A | N/A | **Update Rust structs**: Matrix expected needs `(identity_id, endpoint_id)` tuple key. Expand `AuthzViolation` with `violation_type: String`, `evidence: Evidence`, `confidence: f32`. |
| `OastInteraction` | `ip: String`, `time: DateTime<Utc>` | N/A | `id`, `token_id`, `timestamp`, `protocol`, `source_ip`, `raw_blob_id` | N/A | **Update Rust struct**: Add `id: Uuid`, `token_id: Uuid`, `protocol: String`, `raw_blob_id: Uuid` to match SQL schema. |

### 4.3 Trait & Method Signature Discrepancy Matrix

| Trait Name | Method Signature in `V6_COMMON_TYPES.rs` | Method Signature in Architecture MD / Registry | Status & Reconciliation Action |
|------------|------------------------------------------|------------------------------------------------|--------------------------------|
| `HttpParser` | `fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError>;` | `fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, ParseError>;` | **Reconcile**: `SentinelError::ParseError` wraps parse errors; `V6_FINAL_INTERFACE_REGISTRY.md` should declare `Result<ParsedRequest, SentinelError>`. |
| `ScopeEngine` | `fn is_in_scope(&self, uri: &str) -> ScopeDecision; fn is_ip_in_scope(&self, ip: &str) -> ScopeDecision;` | `fn is_in_scope(&self, uri: &str) -> bool;` (in Architecture MD line 249) | **Update Architecture MD**: Replace outdated `bool` return with `ScopeDecision`. |
| `EventBus` | `fn subscribe_telemetry(&self) -> broadcast::Receiver<SentinelEvent>; fn subscribe_critical(&self) -> mpsc::Receiver<CriticalEvent>;` | `fn subscribe(&self) -> broadcast::Receiver<SentinelEvent>;` | **Update Architecture MD**: Split `subscribe()` into `subscribe_telemetry()` and `subscribe_critical()`. |
| `ScanOrchestrator`| `async fn status(&self, scan_id: Uuid) -> Result<ScanLifecycle, SentinelError>;` | `async fn scan_status(&self, scan_id: Uuid) -> Result<ScanStatus, SentinelError>;` | Standardize method name to `status` and return type to `ScanLifecycle`. |
| `TaskScheduler` | `async fn submit`, `cancel`, `checkpoint` | `async fn submit`, `pause`, `resume`, `cancel`, `status`, `checkpoint`, `restore_checkpoint` | **Expand `TaskScheduler` trait** in `V6_COMMON_TYPES.rs` to include `pause`, `resume`, `status`, and `restore_checkpoint`. |
| `CoverageEngine` | `async fn record_test(&self, endpoint_id: Uuid) -> Result<(), SentinelError>;` | `async fn record_test(&self, endpoint_id: Uuid, param: &str, check_id: &str) -> Result<(), SentinelError>;` | **Expand signature** in `V6_COMMON_TYPES.rs` to accept `param: &str, check_id: &str`. |
| `KnowledgeEngine` | `async fn add_node`, `find_path` | `async fn add_node`, `add_edge`, `query_neighbors`, `find_path`, `resolve_entity` | **Expand `KnowledgeEngine` trait** in `V6_COMMON_TYPES.rs` to include `add_edge`, `query_neighbors`, and `resolve_entity`. |
| `BrowserService` | `navigate(&self, url: &str)`, `execute_script(&self, js: &str)`, `capture_dom(&self)` | `navigate(&self, url: &str, timeout_ms: u32)`, `screenshot(&self, full_page: bool)`, `close(&self)` | **Add `timeout_ms`**, `screenshot()`, and `close()` methods to `BrowserService` trait in `V6_COMMON_TYPES.rs`. |
| `ResearchPackManager`| `load_pack`, `verify_signature` | `load_pack`, `verify_signature`, `list_checks`, `hot_reload` | **Add `list_checks()` and `hot_reload()`** to `ResearchPackManager` in `V6_COMMON_TYPES.rs`. |
| `PluginRuntime` | `load_wasm`, `execute` | `load_rhai`, `load_wasm`, `execute`, `unload` | **Add `load_rhai()` and `unload()`** to `PluginRuntime` in `V6_COMMON_TYPES.rs`. |

---

## 5. Error Model Hierarchy & Fault Classification

### 5.1 The `SentinelError` Hierarchy

All unrecoverable errors traversing public trait and subsystem boundaries MUST use the canonical `SentinelError` enum.

```rust
#[derive(Debug, thiserror::Error)]
pub enum SentinelError {
    #[error("Database transaction or query error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Search index error: {0}")]
    Tantivy(String),

    #[error("Scope engine rejected interaction: {reason}")]
    ScopeViolation { reason: String },

    #[error("Event bus overflow: dropped {count} messages")]
    BusOverflow { count: usize },

    #[error("HTTP/protocol parsing error: {0}")]
    ParseError(String),

    #[error("AI Engine error: {0}")]
    AiEngine(String),

    #[error("Plugin sandbox violation: {0}")]
    SandboxViolation(String),

    #[error("Internal invariant violated: {0}")]
    InvariantViolation(String),

    // Recommended Extensions for Full Coverage:
    #[error("TLS negotiation error: {0}")]
    TlsError(String),

    #[error("Outbound network error: {0}")]
    NetworkError(String),

    #[error("Operation timeout exceeded: {0}")]
    Timeout(String),

    #[error("Authentication/keychain failure: {0}")]
    AuthError(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
}
```

### 5.2 Error Classification & Recovery Policies

| Error Variant | Root Cause | Retryable? | Degradation / Recovery Policy | Impacted Subsystems |
|---------------|------------|------------|-------------------------------|---------------------|
| `Database` | SQLite busy, lock contention, constraint failure | **Yes** (if `SQLITE_BUSY`/lock); **No** (if constraint) | Async exponential backoff on retryable lock errors. Critical checkpoint updates persist to WAL. | ObservationStore, ReportEngine, TaskScheduler |
| `Io` | Missing project file, disk permission denied | **No** | Fails operation immediately; logs structured error. | ProxyEngine, PluginRuntime, ReportEngine |
| `Tantivy` | Index corruption, schema lock | **No** | Gracefully degrades body search; triggers background Tantivy index rebuild from SQLite WAL on startup. | ObservationStore |
| `ScopeViolation` | Target URI/IP blocked by ACL rules | **No** | Connection/task aborted immediately; fails closed; emits `CriticalEvent::ScopeViolationAttempt`. | ProxyEngine, ScanOrchestrator, BrowserService, Adapters |
| `BusOverflow` | Slow consumer on broadcast channel | **Yes** | Broadcast channel drops oldest messages for slow UI consumers; Critical channel applies backpressure to publisher. | EventBus, ScanOrchestrator |
| `ParseError` | Malformed HTTP or corrupt OpenAPI spec | **No** | Preserves raw byte representation; logs structured `ParseWarning`; aborts invalid frame without panic. | HTTPParser, OpenApiParser |
| `AiEngine` | Rate limit, API quota, timeout | **Yes** (if transient) | Platform degrades to manual / deterministic scanning; platform operates normally with AI offline. | AIEngine, AIPolicyEngine |
| `SandboxViolation` | WASM attempted illegal filesystem/network op | **No** | WASM instance terminated immediately; capabilities dropped; audit event logged. | PluginRuntime |
| `InvariantViolation` | Internal architectural assertion failed | **No (Fatal)** | Triggers safe panic wrapper; SQLite WAL and EventBus ensure zero state corruption on restart. | All Subsystems |

---

## 6. Edge Cases & Specification Invariants

### 6.1 Edge Cases Discovered & Observed Behaviors

| # | Feature / Boundary | Input / Scenario | Observed / Required Architectural Behavior | Discovered Via |
|---|--------------------|------------------|--------------------------------------------|----------------|
| 1 | `HTTPParser` | Malformed HTTP request missing Host header or containing invalid transfer encoding | Parser preserves raw byte buffer in `MessageRepresentation.raw_blob_id`, extracts valid partial headers, attaches `ParseWarning`, returns `ParsedRequest` without panic. | `V6_FINAL_ARCHITECTURE.md` §6.2 |
| 2 | `ScopeEngine` | User configures hostname regex; target resolves to internal private IP (`127.0.0.1`) mid-scan (DNS Rebinding) | `ScopeEngine` intercepts post-DNS resolved socket IP. Connection dropped before TCP handshake completes; emits `ScopeViolationAttempt`. | `V6_FINAL_SECURITY_REVIEW.md` §1 |
| 3 | `ScopeEngine` | Malicious user passes catastrophic ReDoS regex pattern in scope include list | Regex execution bounded at 100ms timeout and 1000 char length limit. Fails closed (DENY) on timeout. | `V6_FINAL_SECURITY_INVARIANTS.md` §1 |
| 4 | `OASTServer` | Malicious target floods OAST DNS listener with 1,000,000 invalid requests | OAST validates AES-256-GCM token in subdomain string. Invalid tokens dropped in constant time without database writes; prevents DoS. | `V6_FINAL_SECURITY_REVIEW.md` §5 |
| 5 | `PluginRuntime` | WASM plugin attempts to read host `~/.ssh/id_rsa` or open raw socket without capability | Wasmtime VM traps call; returns `SentinelError::SandboxViolation`; terminates plugin instance. | `V6_FINAL_SECURITY_REVIEW.md` §3 |
| 6 | `AIPolicyEngine` | Target response injects prompt injection command: `DROP TABLE findings;` | Layer 3 filter detects destructive SQL keyword; returns `PolicyResult::Blocked`; prevents command injection into FuzzerEngine. | `V6_BUILTIN_RULES_AND_PATTERNS.yaml` §3 |
| 7 | `CloudFoxAdapter` | Automated script attempts to execute mutating cloud API call | Adapter strictly enforces read-only execution; blocks mutating API call; requires manual GUI user confirmation. | `V6_FINAL_ARCHITECTURE.md` §8 |
| 8 | `ObservationStore` | Hard process crash (`kill -9`) during heavy batch insertion | SQLite WAL auto-recovers transaction integrity on restart. Tantivy index checksum verified; rebuilt from SQLite if corrupted. | `V6_FINAL_ARCHITECTURE.md` §10 |
| 9 | `IdentityManager` | Target returns HTTP 401 Unauthorized during active scan | `IdentityManager` catches 401, invokes configured refresh macro/dance, updates token in-memory, retries request once. | `V6_FINAL_PHASE_ROADMAP.md` §2.2 |
| 10 | `TaskScheduler` | Heavy scan generates 500,000 tasks exceeding memory budget | Scheduler enforces `ResourceBudget` (max 10k per task batch); writes intermediate checkpoints to SQLite; pauses background queue. | `V6_FINAL_CONFIGURATION_REGISTRY.md` §4 |

---

## 7. Concrete Canonical Blueprint for `V6_CANONICAL_SPEC.yaml`

To eliminate all split-brain contradictions, `V6_CANONICAL_SPEC.yaml` must become the single machine-readable source of truth. Below is the required canonical structure and data schema:

```yaml
version: "6.0.0"
metadata:
  date: "2026-08-17"
  status: "AUTHORITATIVE_FREEZE_CANDIDATE"
  title: "SENTINEL V6 Canonical Architecture Specification"

subsystem_counts:
  core: 14
  professional: 7
  adapter: 4
  research: 3
  total: 28

subsystems:
  - id: "SUB-01"
    name: "ProxyEngine"
    tier: "Core"
    trait: "ProxyEngine"
    dependencies: ["HTTPParser", "ScopeEngine", "EventBus", "ObservationStore"]
    emitted_events: ["ObservationCreated", "InterceptHit"]
    data_types: ["Transaction", "InterceptRule", "ProxyConfig"]
    security_boundary: "Untrusted network input; 10MB allocation bound"

  - id: "SUB-02"
    name: "HTTPParser"
    tier: "Core"
    trait: "HttpParser"
    dependencies: []
    emitted_events: []
    data_types: ["ParsedRequest", "ParsedResponse", "ParseWarning"]
    security_boundary: "Forked httparse; byte-preserving; ReDoS protected"

  # ... [Subsystems SUB-03 through SUB-28 fully defined] ...

domain_entities:
  pipeline:
    - "Transaction"
    - "Observation"
    - "Candidate"
    - "VerificationResult"
    - "Evidence"
    - "Finding"
  supporting_entities:
    - "Scope"
    - "Endpoint"
    - "Payload"
    - "Identity"
    - "Session"
    - "Credential"
    - "SecretReference"
    - "Asset"
    - "Technology"
    - "State"
    - "Workflow"
    - "Resource"
    - "Action"
    - "Task"
    - "Report"
    - "RegressionTest"
    - "OASTInteraction"
    - "AttackPath"
    - "Note"
    - "Screenshot"

security_invariants:
  - id: "SEC-INV-01"
    name: "Scope Enforcement"
    rule: "No outbound network request without an explicit ScopeDecision. Default is DENY."
  - id: "SEC-INV-02"
    name: "Zero Plaintext Secrets"
    rule: "Credentials store secret references (UUIDs) pointing to OS Keychain. No plaintext in DB, logs, or events."
  - id: "SEC-INV-03"
    name: "Finding Proof Requirement"
    rule: "No finding may transition to Verified or Confirmed without cryptographically content-addressed Evidence."
  - id: "SEC-INV-04"
    name: "AI Host-Side Policy"
    rule: "AI is optional acceleration. Target content is untrusted. All AI payloads pass 5-layer policy and ScopeEngine."
  - id: "SEC-INV-05"
    name: "Research Isolation"
    rule: "SMT, RL, and Crypto engines are gated behind #[cfg(feature = 'sentinel-research')]."

error_hierarchy:
  root_enum: "SentinelError"
  variants:
    - name: "Database"
      source_type: "sqlx::Error"
      retryable: true
    - name: "Io"
      source_type: "std::io::Error"
      retryable: false
    - name: "Tantivy"
      source_type: "String"
      retryable: false
    - name: "ScopeViolation"
      source_type: "{ reason: String }"
      retryable: false
    - name: "BusOverflow"
      source_type: "{ count: usize }"
      retryable: true
    - name: "ParseError"
      source_type: "String"
      retryable: false
    - name: "AiEngine"
      source_type: "String"
      retryable: true
    - name: "SandboxViolation"
      source_type: "String"
      retryable: false
    - name: "InvariantViolation"
      source_type: "String"
      retryable: false
```

---

## 8. Concrete Reconciliation Roadmap

To bring the entire repository into 100% mathematical and contract consistency with zero blockers:

1. **Step 1 — Create Canonical Spec & Schema**:
   - Write `V6_CANONICAL_SPEC_SCHEMA.yaml` and `V6_CANONICAL_SPEC.yaml` embedding all 28 subsystems, 20 domain entities, traits, events, error models, and security invariants.
2. **Step 2 — Reconcile Rust Contracts (`V6_COMMON_TYPES.rs`)**:
   - Add missing fields to `ScopeDecision` (`decision_id: Uuid`, `timestamp: DateTime<Utc>`).
   - Add missing fields to `CoverageReport` (`total_endpoints`, `tested_endpoints`, `total_parameters`, `tested_parameters`, `coverage_percent`).
   - Add missing fields to `ParsedRequest` (`raw: Vec<u8>`, `normalized: String`, `parse_warnings: Vec<ParseWarning>`).
   - Add missing supporting entity structs (`Session`, `Workflow`, `Note`, `RegressionTest`, `Screenshot`, `AttackPath`).
   - Expand `TaskScheduler`, `CoverageEngine`, `KnowledgeEngine`, `BrowserService`, and `PluginRuntime` trait signatures to include all required lifecycle methods.
3. **Step 3 — Reconcile SQLite Schema (`V6_SQLITE_SCHEMA.sql`)**:
   - Update `credentials` table: replace `encrypted_payload` with `secret_reference TEXT NOT NULL` and `access_level TEXT NOT NULL`.
   - Add metadata columns (`version`, `provenance`, `lifecycle`, `scope_id`) across `transactions`, `observations`, `candidates`, and `findings`.
   - Add missing tables: `sessions`, `workflows`, `notes`, `reports`, `regression_tests`, `verification_results`.
   - Rename legacy adapter tables (`casm_assets` $\rightarrow$ `subdomain_assets`).
4. **Step 4 — Reconcile Protobuf IPC (`V6_IPC_CONTRACTS.proto`)**:
   - Ensure all `SentinelEvent` and `CriticalEvent` variants have 1:1 mapped protobuf messages in `SentinelUiStream`.
5. **Step 5 — Clean Obsolete Subsystem References across Markdown Files**:
   - Fix arithmetic typo in `V6_FINAL_ARCHITECTURE.md` Section 15 (change 22 to 28).
   - Replace all remaining references to `Scanner`, `CasmEngine`, `CloudEngine`, `SastEngine`, `ApiDiscoveryEngine` in `V6_FINAL_PHASE_ROADMAP.md`, `V6_FINAL_SECURITY_REVIEW.md`, and `V6_FINAL_RISK_REGISTER.md`.
6. **Step 6 — Execute Automated Conformance Validator**:
   - Run the 11-step conformance validator to ensure 0 warnings and 0 blockers before freezing the architecture.

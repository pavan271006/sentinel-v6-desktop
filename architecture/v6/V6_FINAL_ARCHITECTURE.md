# SENTINEL V6 — FINAL PRACTICAL ARCHITECTURE

> **STATUS**: IMPLEMENTATION-READY  
> **VERSION**: 6.1 (Post-Remediation)  
> **DATE**: 2026-08-17  
> **SUPERSEDES**: V6_FINAL_ARCHITECTURE.md, V6_IMPLEMENTATION_CONTRACT.md, FINAL_IMPLEMENTATION_CONTRACT.md

This is the **SINGLE SOURCE OF TRUTH** for SENTINEL V6 architecture.

---

## 1. Architecture Statement

SENTINEL V6 is a professional security testing platform — **The Security Researcher's Operating Environment**. It is a unified knowledge platform where traffic, assets, identities, states, tests, observations, findings, attack paths, and automation share one coherent domain model.

**What it is NOT**: A collection of research prototypes. Every subsystem in this document is implementable with proven 2026 technology.

---

## 2. Product Tiers

| Tier | Contents | Deployment | License |
|------|----------|------------|---------|
| **V6 CORE** | Proxy, Parser, Storage, Scope, Events, Tasks, Scanner, Fuzzer, Verification (4 strategies), Context, Coverage, Identity, Repeater, Traffic History, HTTPQL, Report | Single desktop binary | Base |
| **V6 PROFESSIONAL** | Browser verification, OAST, AuthZ Matrix, Knowledge Graph, AI acceleration, Plugin runtime, Research packs, Notebook, Timeline, Findings Center | Desktop binary + browser daemon | Professional |
| **V6 ENTERPRISE** | SSO/OIDC, RBAC, multi-tenancy, NATS JetStream, ClickHouse, distributed workers, HA, air-gap, SIEM | Server deployment | Enterprise |
| **V6 ADAPTER** | SubfinderAdapter, CloudFoxAdapter, SemgrepAdapter, OpenApiParser | External tool wrappers | Professional |
| **V6 RESEARCH** | SmtSolverEngine, RlStateEngine, CryptoAnalysisEngine | Feature-flagged, optional | Research |

---

## 3. Design Principles

| # | Principle | Implementation |
|---|-----------|---------------|
| 1 | **Observation-centered** | Every data point is an Observation. All analysis derives from observations. |
| 2 | **Triple representation** | Raw bytes + Parsed structure + Normalized form. Raw bytes never discarded. |
| 3 | **Pentester-first** | Keyboard-first. Context-preserved. Zero operational overhead. |
| 4 | **Verification > Detection** | Detection → Candidate. Verification → Finding. No finding without proof. |
| 5 | **Local-first** | Works fully offline. Zero cloud dependency for CORE tier. |
| 6 | **AI as acceleration** | AI reasons. Deterministic engines execute. Policy enforces. Human decides. |
| 7 | **Practical first** | Every subsystem uses proven technology. Research is isolated behind feature flags. |

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    SENTINEL V6 DESKTOP                            │
│                  (Tauri 2.0 + React Frontend)                     │
├──────────────────────────────────────────────────────────────────┤
│                        UI LAYER                                   │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ │
│  │ Command  │ │ Traffic  │ │Repeater│ │ Fuzzer │ │  Scanner  │ │
│  │ Palette  │ │ History  │ │        │ │        │ │           │ │
│  ├──────────┤ ├──────────┤ ├────────┤ ├────────┤ ├───────────┤ │
│  │  Auth    │ │  AuthZ   │ │  OAST  │ │Findings│ │  Report   │ │
│  │  Lab     │ │  Matrix  │ │  Lab   │ │ Center │ │           │ │
│  ├──────────┤ ├──────────┤ ├────────┤ ├────────┤ ├───────────┤ │
│  │ Browser  │ │ Notebook │ │Timeline│ │Coverage│ │  Tasks    │ │
│  │  Lab     │ │          │ │        │ │        │ │           │ │
│  └──────────┘ └──────────┘ └────────┘ └────────┘ └───────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                    CORE LAYER (Rust)                               │
│                                                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │   PROXY         │  │   SCANNER      │  │ VERIFICATION ENGINE │ │
│  │ ┌────────────┐  │  │ ┌────────────┐ │  │ ┌─────────────────┐│ │
│  │ │TCP Listener│  │  │ │Orchestrator│ │  │ │ResponseDiffer.  ││ │
│  │ │TLS Engine  │  │  │ │Test Gen    │ │  │ │OASTCorrelation  ││ │
│  │ │HTTP Parser │  │  │ │Execution   │ │  │ │TimingStatistical││ │
│  │ │Scope Guard │  │  │ │Detection   │ │  │ │ContentVerify    ││ │
│  │ │Intercept   │  │  │ │Coverage    │ │  │ └─────────────────┘│ │
│  │ └────────────┘  │  │ └────────────┘ │  └─────────────────────┘ │
│  └────────────────┘  └────────────────┘                            │
│                                                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │   FUZZER        │  │  IDENTITY      │  │   KNOWLEDGE         │ │
│  │ Corpus          │  │  Vault         │  │   Graph Nodes/Edges │ │
│  │ Mutator         │  │  Session Mgmt  │  │   Entity Resolution │ │
│  │ Oracle          │  │  Auto-Refresh  │  │   Context Engine    │ │
│  └────────────────┘  └────────────────┘  └─────────────────────┘ │
│                                                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │   EVENT BUS     │  │ TASK SCHEDULER │  │   SCOPE ENGINE      │ │
│  │ broadcast chan  │  │ Priority Queue │  │   Regex/Glob Match  │ │
│  │ Drop-on-lag    │  │ Checkpoint     │  │   Fail-Closed       │ │
│  │ Critical queue │  │ Resource Limit │  │   ReDoS Protected   │ │
│  └────────────────┘  └────────────────┘  └─────────────────────┘ │
│                                                                    │
│  ──── PROFESSIONAL TIER ──────────────────────────────────────── │
│                                                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │  BROWSER SVC   │  │   OAST SERVER  │  │   AI ENGINE         │ │
│  │ (Out-of-proc)  │  │ DNS :53        │  │   Policy (5-layer)  │ │
│  │  Playwright    │  │ HTTP :80/:443  │  │   Tool Router       │ │
│  │  CDP Access    │  │ Token Registry │  │   Schema Validation │ │
│  └────────────────┘  └────────────────┘  └─────────────────────┘ │
│                                                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐ │
│  │  AUTHZ ENGINE  │  │  PLUGIN RUNTIME│  │   REPORT ENGINE     │ │
│  │  IRA+ Model    │  │  Rhai Scripts  │  │   Templates         │ │
│  │  Matrix Replay │  │  WASM/Wasmtime │  │   PDF/MD/JSON       │ │
│  └────────────────┘  │  Capabilities  │  └─────────────────────┘ │
│                       └────────────────┘                           │
│  ──── ADAPTER TIER (External Tool Wrappers) ──────────────────── │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ CASM     │ │ Cloud    │ │ SAST     │ │ API Discovery      │  │
│  │(Subfinder│ │(CloudFox)│ │(Semgrep) │ │(OpenAPI Parser)    │  │
│  │ adapter) │ │ READ-ONLY│ │ adapter) │ │                    │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│                    STORAGE LAYER                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐    │
│  │  SQLite WAL   │  │  Blob Store   │  │  Tantivy FTS       │    │
│  │  (Metadata)   │  │  (Bodies)     │  │  (Body Search)     │    │
│  │  Single-Writer│  │  Content-Addr │  │  Rebuild from SQL  │    │
│  └──────────────┘  └───────────────┘  └────────────────────┘    │
├──────────────────────────────────────────────────────────────────┤
│  EVENT BUS: tokio::sync::broadcast (local)                        │
│  Critical events: dedicated mpsc channel (never dropped)          │
│  Enterprise: NATS JetStream (optional)                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Architecture Invariants

1. **Scope invariant**: No subsystem sends an outbound request without passing ScopeEngine
2. **Observation immutability**: Observations are append-only; never modified after creation
3. **Triple preservation**: Raw bytes are never discarded or normalized away
4. **Verification requirement**: No finding without verification evidence
5. **AI policy isolation**: No target content can modify AI scope/permissions/budget
6. **Plugin sandbox**: WASM plugins cannot exceed granted capabilities
7. **Credential encryption**: All credentials encrypted at rest (AES-256-GCM), never logged
8. **Browser isolation**: UI WebView never loads target content; scanning browser never renders UI
9. **Backpressure**: All bounded buffers have explicit overflow policies
10. **Evidence integrity**: Evidence is content-addressed (SHA-256) and immutable once captured
11. **Critical event guarantee**: Finding and scope-violation events use dedicated mpsc (never dropped)
12. **Cloud safety**: CloudFoxAdapter defaults to read-only; write operations require per-action human approval

---

## 6. V1 CORE Subsystems (Implementation-Ready)

### 6.1 ProxyEngine

**Purpose**: MITM proxy intercepting HTTP/1.1 and HTTP/2 traffic.

**Architecture**: TCP listener → TLS termination (rustls + custom CA) → HTTP parsing → scope check → intercept pipeline → forward → capture response → emit observation.

**Data Model**: `Transaction` (request MessageRepresentation + response MessageRepresentation + timing + TLS info)

**API**:
```rust
#[async_trait]
pub trait ProxyEngine: Send + Sync {
    async fn start(&self, config: ProxyConfig) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    fn register_interceptor(&mut self, interceptor: Box<dyn ProxyInterceptor>);
    fn set_intercept_rules(&mut self, rules: Vec<InterceptRule>);
}
```

**Events emitted**: `ObservationCreated`, `InterceptHit`  
**Errors**: `ScopeViolation`, `ParseError`, `TlsError`, `Io`  
**Concurrency**: One tokio task per TCP connection. Bounded connection pool.  
**Security boundary**: Untrusted network input. All input bounds-checked.  
**Resource limits**: Max 10k concurrent connections. Per-request allocation bounded at 10MB.  
**Dependencies**: HTTPParser, ScopeEngine, EventBus, ObservationStore  
**Acceptance**: 5k req/sec sustained, 10k burst (no-DB). Handles malformed TLS/HTTP without panic.  
**Tests**: Property-based (proptest), fuzz (cargo-fuzz), differential (vs httparse)

---

### 6.2 HTTPParser

**Purpose**: Fault-tolerant HTTP parser preserving raw bytes for security testing.

**Architecture**: Fork of httparse with extended fault-tolerance. NOT fully custom. Adds: malformed header preservation, smuggling-relevant edge case handling, raw byte capture alongside parsed output.

**Decision change**: Previous architecture said "fully custom parser." This is revised to "fork + extend httparse" to reduce risk from score 5 → 7.

**API**:
```rust
pub trait HttpParser: Send + Sync {
    fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, ParseError>;
    fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, ParseError>;
    fn serialize_request(&self, parsed: &ParsedRequest) -> Vec<u8>;
    fn serialize_response(&self, parsed: &ParsedResponse) -> Vec<u8>;
}

pub struct ParsedRequest {
    pub raw: Vec<u8>,
    pub method: HttpMethod,
    pub uri: String,
    pub version: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,  // Raw bytes, not String
    pub body: Vec<u8>,
    pub normalized: String,
    pub parse_warnings: Vec<ParseWarning>,  // Non-fatal issues
}
```

**Concurrency**: Stateless. Thread-safe by design.  
**Security**: Bounded allocation per request (10MB max). ReDoS protection on header parsing.  
**Acceptance**: Zero panics on any input. Byte-fidelity: `serialize(parse(raw)) == raw` for all valid HTTP.  
**Tests**: proptest (random valid HTTP), cargo-fuzz (random bytes), differential (vs httparse, vs nginx, vs Apache)

---

### 6.3 ObservationStore

**Purpose**: Persist observations to SQLite + Tantivy with crash-safe dual-write.

**Architecture**: Single-writer async task receives observations via mpsc channel. Batches into SQLite WAL transactions (100-500 per batch). Commits Tantivy index every 500ms. On crash: SQLite WAL recovers automatically; Tantivy index rebuilds from SQLite on startup integrity check.

**API**:
```rust
#[async_trait]
pub trait ObservationStore: Send + Sync {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError>;
    async fn insert_batch(&self, obs: Vec<Observation>) -> Result<(), SentinelError>;
    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError>;
    async fn query_sql(&self, httpql: &str, limit: u32, offset: u32) -> Result<Vec<Observation>, SentinelError>;
    async fn search_fts(&self, query: &str, limit: u32) -> Result<Vec<Observation>, SentinelError>;
    async fn rebuild_index(&self) -> Result<(), SentinelError>;
}
```

**Events**: `ObservationStored`  
**Errors**: `Database`, `Tantivy`, `Io`  
**Concurrency**: Single writer (mpsc queue). Multiple concurrent readers (SQLite WAL).  
**Resource limits**: Max batch size 500. Max single blob 50MB. Disk space monitoring.  
**Acceptance**: 5k writes/sec batched. <50ms indexed read. <200ms FTS.

---

### 6.4 ScopeEngine

**Purpose**: Determine if a URI/IP is authorized for interaction. Fails closed.

**API**:
```rust
pub trait ScopeEngine: Send + Sync {
    fn is_in_scope(&self, uri: &str) -> bool;
    fn is_ip_in_scope(&self, ip: &str) -> bool;
    fn update_scope(&mut self, scope: Scope) -> Result<(), SentinelError>;
}
```

**Security**: Compiled regex with size limit (max 1000 chars per pattern). Regex compilation timeout (100ms). Fails closed (out-of-scope if check fails).  
**Acceptance**: <1ms per check. Zero bypasses.

---

### 6.5 EventBus

**Purpose**: Async pub/sub between subsystems.

**Architecture**: Two-tier channel system:
1. **Broadcast channel** (tokio::sync::broadcast, capacity 10,000): General events. Drop-on-lag.
2. **Critical channel** (tokio::sync::mpsc, unbounded with backpressure): Finding events, scope violations. Never dropped.

**API**:
```rust
pub trait EventBus: Send + Sync {
    fn subscribe(&self) -> broadcast::Receiver<SentinelEvent>;
    fn subscribe_critical(&self) -> mpsc::Receiver<CriticalEvent>;
    fn publish(&self, event: SentinelEvent) -> Result<(), SentinelError>;
    fn publish_critical(&self, event: CriticalEvent) -> Result<(), SentinelError>;
}

pub enum SentinelEvent {
    ObservationCreated(Uuid),
    ScanProgress { scan_id: Uuid, phase: String, percent: f32 },
    TaskStatus { task_id: Uuid, status: TaskStatus },
    CoverageUpdate { total: u32, tested: u32 },
    ContextDetected { endpoint_id: Uuid, tech: String },
}

pub enum CriticalEvent {
    FindingCreated(Uuid),
    ScopeViolationAttempt { source: String, target: String },
    CandidateVerified { candidate_id: Uuid, finding_id: Uuid },
}
```

**Acceptance**: <1ms publish latency. Critical events never lost.

---

### 6.6 TaskScheduler

**Purpose**: Manage background tasks with priority, checkpoint, and resource budgets.

**API**:
```rust
#[async_trait]
pub trait TaskScheduler: Send + Sync {
    async fn submit(&self, task: TaskConfig) -> Result<Uuid, SentinelError>;
    async fn pause(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn resume(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn status(&self, task_id: Uuid) -> Result<TaskStatus, SentinelError>;
    async fn checkpoint(&self, task_id: Uuid, state: Vec<u8>) -> Result<(), SentinelError>;
    async fn restore_checkpoint(&self, task_id: Uuid) -> Result<Option<Vec<u8>>, SentinelError>;
}
```

---

### 6.7 ScanOrchestrator

**Purpose**: Manage scan lifecycle — configure, execute, pause/resume, report progress.

Incorporates NextBestTestEngine scoring (merged — no separate subsystem).

**API**:
```rust
#[async_trait]
pub trait ScanOrchestrator: Send + Sync {
    async fn start_scan(&self, config: ScanConfig) -> Result<Uuid, SentinelError>;
    async fn pause_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn resume_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn scan_status(&self, scan_id: Uuid) -> Result<ScanStatus, SentinelError>;
}

pub struct ScanConfig {
    pub scope_id: Uuid,
    pub concurrency_limit: u32,
    pub max_requests_per_endpoint: u32,
    pub active_checks: Vec<String>,  // Check IDs from research packs
    pub verification_strategies: Vec<VerificationStrategy>,
    pub budget: ScanBudget,
}

pub struct ScanBudget {
    pub max_total_requests: u64,
    pub max_duration_secs: u64,
    pub max_findings: u32,
}
```

---

### 6.8 FuzzerEngine

**Purpose**: Generate mutated requests for injection testing.

**API**:
```rust
#[async_trait]
pub trait FuzzerEngine: Send + Sync {
    async fn fuzz(&self, seed: &Transaction, profile: FuzzProfile) -> Result<FuzzStream, SentinelError>;
}

pub struct FuzzProfile {
    pub mutators: Vec<MutatorType>,
    pub max_mutations: u64,
    pub injection_points: Vec<ParamLocation>,
    pub wordlist: Option<String>,
}

pub enum MutatorType {
    BitFlip,
    ByteReplace,
    Wordlist,
    Grammar(String),
    Boundary,
    Unicode,
    Truncation,
}
```

**Acceptance**: >15k simple mutations/sec. >2k grammar-based/sec.

---

### 6.9 VerificationEngine (V1: 4 strategies)

**Purpose**: Promote candidates to findings with proof.

**V1 strategies**: ResponseDifferential, OASTCorrelation, TimingStatistical, ContentVerification  
**V2 additions**: BrowserExecution, AuthorizationReplay  
**Future**: MathematicalVerification, CausalMinimization

**API**:
```rust
#[async_trait]
pub trait VerificationEngine: Send + Sync {
    async fn verify(&self, candidate: &Candidate, strategy: VerificationStrategy) -> Result<VerificationResult, SentinelError>;
    async fn correlate_oast(&self, token: &str) -> Result<Option<OastEvidence>, SentinelError>;
    fn available_strategies(&self) -> Vec<VerificationStrategy>;
}
```

**Acceptance**: <1% FP rate for verified findings. All findings include verification evidence for manual review.

---

### 6.10 ContextEngine

**Purpose**: Extract technology fingerprints and metadata from observations.

**API**:
```rust
pub trait ContextEngine: Send + Sync {
    fn fingerprint(&self, transaction: &Transaction) -> Vec<TechFingerprint>;
    fn classify_parameter(&self, name: &str, value: &str) -> ParameterClass;
}
```

---

### 6.11 CoverageEngine

**Purpose**: Track tested vs untested attack surface.

**API**:
```rust
#[async_trait]
pub trait CoverageEngine: Send + Sync {
    async fn record_test(&self, endpoint_id: Uuid, param: &str, check_id: &str) -> Result<(), SentinelError>;
    async fn get_coverage(&self, scope_id: Uuid) -> Result<CoverageReport, SentinelError>;
    async fn untested_endpoints(&self, scope_id: Uuid) -> Result<Vec<Endpoint>, SentinelError>;
}

pub struct CoverageReport {
    pub total_endpoints: u32,
    pub tested_endpoints: u32,
    pub total_parameters: u32,
    pub tested_parameters: u32,
    pub coverage_percent: f32,
}
```

---

### 6.12 IdentityManager

**Purpose**: Store and inject authentication tokens across sessions.

**API**:
```rust
#[async_trait]
pub trait IdentityManager: Send + Sync {
    async fn add_identity(&self, identity: Identity) -> Result<Uuid, SentinelError>;
    async fn add_credential(&self, identity_id: Uuid, cred: Credential) -> Result<Uuid, SentinelError>;
    async fn inject_auth(&self, identity_id: Uuid, request: &mut ParsedRequest) -> Result<(), SentinelError>;
    async fn list_identities(&self) -> Result<Vec<Identity>, SentinelError>;
    async fn refresh_credential(&self, cred_id: Uuid) -> Result<(), SentinelError>;
}
```

---

### 6.13 KnowledgeEngine (includes AttackGraph)

AttackGraphEngine merged into KnowledgeEngine as a query module. No separate subsystem.

**API**:
```rust
#[async_trait]
pub trait KnowledgeEngine: Send + Sync {
    async fn add_node(&self, node: GraphNode) -> Result<Uuid, SentinelError>;
    async fn add_edge(&self, edge: GraphEdge) -> Result<Uuid, SentinelError>;
    async fn query_neighbors(&self, node_id: Uuid, depth: u32) -> Result<Vec<GraphNode>, SentinelError>;
    async fn find_path(&self, from: Uuid, to: Uuid, max_depth: u32) -> Result<Vec<Vec<GraphEdge>>, SentinelError>;
    async fn resolve_entity(&self, label: &str, node_type: &str) -> Result<Option<GraphNode>, SentinelError>;
}
```

**Resource limit**: max_depth capped at 5 for path queries. CTE recursion bounded.

---

### 6.14 ReportEngine

**API**:
```rust
#[async_trait]
pub trait ReportEngine: Send + Sync {
    async fn generate(&self, config: ReportConfig) -> Result<Vec<u8>, SentinelError>;
}

pub struct ReportConfig {
    pub format: ReportFormat,
    pub finding_ids: Vec<Uuid>,
    pub template: Option<String>,
    pub include_evidence: bool,
    pub include_reproduction_steps: bool,
}

pub enum ReportFormat { Markdown, Pdf, Json, Html }
```

---

## 7. PROFESSIONAL Tier Subsystems

### 7.1 BrowserService (Out-of-Process)

**IPC**: gRPC via Unix socket (BrowserDaemon proto as defined).

**API**:
```rust
#[async_trait]
pub trait BrowserService: Send + Sync {
    async fn navigate(&self, url: &str, timeout_ms: u32) -> Result<NavigationResult, SentinelError>;
    async fn execute_script(&self, js: &str, timeout_ms: u32) -> Result<String, SentinelError>;
    async fn capture_dom(&self, include_shadow: bool) -> Result<String, SentinelError>;
    async fn screenshot(&self, full_page: bool) -> Result<Vec<u8>, SentinelError>;
    async fn close(&self) -> Result<(), SentinelError>;
}
```

**Resource limit**: Max 3-5 concurrent browser contexts. Context pool with queue.

### 7.2 OASTServer

**API**:
```rust
#[async_trait]
pub trait OastServer: Send + Sync {
    async fn start(&self, config: OastConfig) -> Result<(), SentinelError>;
    async fn generate_token(&self, context: &str) -> Result<String, SentinelError>;
    async fn poll_interactions(&self, token: &str) -> Result<Vec<OastInteraction>, SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
}

pub struct OastConfig {
    pub domain: String,
    pub dns_port: u16,  // default 53
    pub http_port: u16, // default 80
    pub https_port: u16, // default 443, requires TLS cert
    pub tls_cert_path: Option<String>,
}
```

**Security**: Tokens are AES-256-GCM encrypted, stateless on server side. IP allowlisting optional.

### 7.3 AuthorizationEngine

**API**:
```rust
#[async_trait]
pub trait AuthorizationEngine: Send + Sync {
    async fn build_matrix(&self, identities: Vec<Uuid>, endpoints: Vec<Uuid>) -> Result<AuthzMatrix, SentinelError>;
    async fn test_matrix(&self, matrix: &AuthzMatrix) -> Result<Vec<AuthzViolation>, SentinelError>;
}

pub struct AuthzMatrix {
    pub identities: Vec<Uuid>,
    pub endpoints: Vec<Uuid>,
    pub expected: HashMap<(Uuid, Uuid), AccessLevel>,
    pub actual: HashMap<(Uuid, Uuid), AccessLevel>,
}

pub struct AuthzViolation {
    pub identity_id: Uuid,
    pub endpoint_id: Uuid,
    pub violation_type: AuthzViolationType,
    pub evidence: Evidence,
    pub confidence: f32,
}
```

**Acceptance**: <2% FP rate. Manual parameter classification override available.

### 7.4 AIEngine

**API**:
```rust
#[async_trait]
pub trait AiEngine: Send + Sync {
    async fn analyze(&self, request: AiRequest) -> Result<AiResponse, SentinelError>;
    fn is_available(&self) -> bool;
}

pub struct AiRequest {
    pub prompt: String,
    pub context: Vec<(String, String)>,  // key-value context pairs
    pub max_tokens: u32,
    pub response_schema: Option<String>,  // JSON schema for structured output
}

pub struct AiResponse {
    pub content: String,
    pub tokens_used: u32,
    pub provider: String,
    pub policy_result: PolicyResult,
}

pub enum PolicyResult {
    Approved,
    Filtered { layer: u8, reason: String },
    RequiresHumanApproval { action: String },
}
```

**Critical rule**: Platform MUST remain fully functional with `is_available() == false`.

### 7.5 AIPolicyEngine

5-layer defense. No percentage claims.

**API**:
```rust
pub trait AiPolicyEngine: Send + Sync {
    fn validate_input(&self, prompt: &str) -> PolicyResult;
    fn validate_output(&self, output: &str, schema: Option<&str>) -> PolicyResult;
    fn is_destructive(&self, payload: &str) -> bool;
    fn requires_approval(&self, action: &str) -> bool;
}
```

**Layers**:
1. Input regex sanitization (blocks trivial injection patterns)
2. Output JSON schema validation
3. Output destructive pattern filtering (DROP TABLE, rm -rf, etc.)
4. Scope enforcement (all AI payloads pass ScopeEngine)
5. Human approval for high-risk actions

**Acceptance**: All AI payloads pass scope check before execution. Destructive patterns blocked. High-risk actions require confirmation.

### 7.6 PluginRuntime

**API**:
```rust
#[async_trait]
pub trait PluginRuntime: Send + Sync {
    async fn load_rhai(&self, script: &str) -> Result<Uuid, SentinelError>;
    async fn load_wasm(&self, wasm_bytes: &[u8], capabilities: Capabilities) -> Result<Uuid, SentinelError>;
    async fn execute(&self, plugin_id: Uuid, input: PluginInput) -> Result<PluginOutput, SentinelError>;
    async fn unload(&self, plugin_id: Uuid) -> Result<(), SentinelError>;
}

pub struct Capabilities {
    pub network: bool,
    pub filesystem: bool,
    pub database_read: bool,
    pub max_memory_mb: u32,
    pub max_execution_ms: u32,
}
```

### 7.7 ResearchPackManager

**API**:
```rust
#[async_trait]
pub trait ResearchPackManager: Send + Sync {
    async fn load_pack(&self, path: &str) -> Result<PackManifest, SentinelError>;
    async fn verify_signature(&self, pack: &PackManifest) -> Result<bool, SentinelError>;
    async fn list_checks(&self) -> Result<Vec<SecurityCheck>, SentinelError>;
    async fn hot_reload(&self, pack_id: &str) -> Result<(), SentinelError>;
}
```

---

## 8. ADAPTER Tier (External Tool Wrappers)

These are simple subprocess/CLI wrappers, not full engines:

```rust
#[async_trait]
pub trait ExternalToolAdapter: Send + Sync {
    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError>;
    fn tool_name(&self) -> &str;
    fn is_installed(&self) -> bool;
}
```

Implementations: SubfinderAdapter, CloudFoxAdapter, SemgrepAdapter, OpenApiParser.

CloudFoxAdapter: **READ-ONLY by default**. Any write operation requires `CloudWriteApproval` confirmation.

---

## 9. RESEARCH Tier (Feature-Flagged)

Compiled only with `--features sentinel-research`. Trait interfaces defined in V6_COMMON_TYPES.rs but implementations are NOT in V1 scope.

- SmtSolverEngine
- RlStateEngine  
- CryptoAnalysisEngine

The platform MUST compile, run, and pass all tests WITHOUT the research feature flag.

---

## 10. Storage Architecture (FINAL DECISION)

| Store | Purpose | Technology | Justification |
|-------|---------|------------|---------------|
| Metadata | Structured data (observations, findings, graph, config) | SQLite WAL | Zero-config, single-file, ACID, proven |
| Bodies | Large request/response bodies | File-based blob store | Content-addressed by UUID. Avoids SQLite bloat. |
| Search | Full-text search on bodies | Tantivy | Rust-native, fast BM25, embedded |
| Enterprise | Scale-out metadata | PostgreSQL (optional) | For >10M observations |
| Enterprise | Analytics | ClickHouse (optional) | For aggregation queries |

**Single-writer pattern**: One async task owns SQLite writes. All subsystems submit via mpsc channel.  
**Crash recovery**: SQLite WAL auto-recovers. Tantivy index rebuilt from SQLite if checksum mismatch detected on startup.  
**Backup**: `sqlite3_backup` API for atomic copy. Blob directory rsync. Tantivy is rebuilt (not backed up).  
**Migration**: sqlx-migrate, forward-only, versioned SQL files.  
**Project isolation**: One SQLite file + one blob directory + one Tantivy index per project.

---

## 11. Event Architecture (FINAL DECISION)

| Channel | Type | Delivery | Use |
|---------|------|----------|-----|
| General | tokio::sync::broadcast | Best-effort, drop-on-lag | Progress, status, context detection |
| Critical | tokio::sync::mpsc | Guaranteed delivery | Findings, scope violations, verification results |
| Enterprise | NATS JetStream | Durable, at-least-once | Distributed workers |

**Ordering**: Per-publisher ordering within each channel. No global ordering guarantee.  
**Replay**: Not supported in local mode. Enterprise NATS provides replay.  
**Backpressure**: Broadcast drops oldest on lag. mpsc applies backpressure to publisher.  
**Correlation**: All events include source_id (Uuid) and timestamp for correlation.

---

## 12. Plugin Architecture (FINAL DECISION)

| Plugin Class | Mechanism | Isolation | Use Case |
|-------------|-----------|-----------|----------|
| Quick scripts | Rhai | In-process, sandboxed | Custom decoders, matchers, simple rules |
| Heavy plugins | WASM/Wasmtime | Capability-based sandbox | Protocol parsers, custom scanners |
| Security rules | YAML (research packs) | No code execution | Vulnerability signatures, fingerprints |
| External tools | Subprocess adapter | Process isolation | Subfinder, Semgrep, CloudFox |
| UI extensions | React components | Browser sandbox | Custom views (future) |

**Contract**: All plugin types implement `PluginManifest` with name, version, capabilities, and author.

---

## 13. Cross-Cutting Specifications

| Concern | Technology | Specification |
|---------|-----------|---------------|
| Logging | `tracing` crate | Structured JSON. Per-subsystem log levels via TOML config. |
| Configuration | TOML | Global: `~/.sentinel/config.toml`. Project: `<project>/sentinel.toml`. |
| Migration | sqlx-migrate | Forward-only. Versioned SQL files in `migrations/` directory. |
| Backup | SQLite .backup | Atomic copy. Blob dir copy. Tantivy index rebuilt on restore. |
| Crash Recovery | WAL journal | Auto-recovery on restart. Tantivy integrity check on startup. |
| Metrics | Custom counters | Requests processed, findings count, scan progress, memory usage. Exportable as JSON. |
| Project Format | Directory | `<name>.sentinel/` containing: `db.sqlite3`, `blobs/`, `tantivy/`, `sentinel.toml` |
| Updates | HTTP + signature | SENTINEL binary: manual or auto-update with ed25519 signature verification. Research packs: signed archives over HTTPS. |

---

## 14. Tauri Command API (Rust → Frontend)

```rust
// All Tauri commands follow this pattern:
#[tauri::command]
async fn get_transactions(query: String, limit: u32, offset: u32) -> Result<Vec<UiTransaction>, String>;

#[tauri::command]
async fn get_transaction_detail(id: String) -> Result<TransactionDetail, String>;

#[tauri::command]
async fn send_to_repeater(transaction_id: String) -> Result<String, String>;

#[tauri::command]
async fn execute_repeater(request: RepeaterRequest) -> Result<RepeaterResponse, String>;

#[tauri::command]
async fn start_scan(config: ScanConfigUi) -> Result<String, String>;

#[tauri::command]
async fn get_findings(limit: u32, offset: u32) -> Result<Vec<UiFinding>, String>;

#[tauri::command]
async fn get_coverage() -> Result<CoverageReport, String>;

#[tauri::command]
async fn update_scope(includes: Vec<String>, excludes: Vec<String>) -> Result<(), String>;

#[tauri::command]
async fn list_identities() -> Result<Vec<UiIdentity>, String>;

#[tauri::command]
async fn generate_report(config: ReportConfigUi) -> Result<Vec<u8>, String>;

// Event stream: Tauri events pushed via app.emit()
// Frontend subscribes to: "sentinel://traffic", "sentinel://finding", "sentinel://scan-progress", "sentinel://coverage"
```

---

## 15. Simplifications Applied

| # | Before | After | Rationale |
|---|--------|-------|-----------|
| 1 | AttackGraphEngine (separate subsystem) | Merged into KnowledgeEngine | Same data model, same SQLite queries |
| 2 | NextBestTestEngine (separate subsystem) | Merged into ScanOrchestrator | Simple scoring formula, not a full engine |
| 3 | CasmEngine (full engine) | SubfinderAdapter (tool wrapper) | Just subprocess invocation |
| 4 | SastEngine (full engine) | SemgrepAdapter (tool wrapper) | Just subprocess invocation |
| 5 | CloudEngine (full engine) | CloudFoxAdapter (tool wrapper, read-only) | Safety + simplicity |
| 6 | HTTPParser (fully custom) | Fork + extend httparse | Reduces risk dramatically |
| 7 | 9 verification strategies in V1 | 4 strategies in V1 | Ship sooner, add more later |
| 8 | BusinessLogicEngine (automated) | Workflow Recorder + Replay | Honest about automation limits |
| 9 | Protobuf for all local IPC | Protobuf only for BrowserDaemon | Rust types + serde for in-process |
| 10 | 31 subsystems | 22 subsystems (after merges + adapter conversion) | Fewer moving parts |

**Subsystem count**: 31 → 22 (14 CORE, 7 PROFESSIONAL, 4 ADAPTER, 3 RESEARCH)

---

## 16. ADR Summary

| ADR | Decision | Confidence |
|-----|----------|------------|
| ADR-001 | Observation-centered data model | HIGH |
| ADR-002 | Triple HTTP representation | HIGH |
| ADR-003 | Rust + tokio | HIGH |
| ADR-004 | Tauri 2.0 + React | HIGH |
| ADR-005 | SQLite WAL for local storage | HIGH |
| ADR-006 | Fork httparse (CHANGED from custom) | HIGH |
| ADR-007 | Playwright out-of-process | HIGH |
| ADR-008 | Rhai for scripts, WASM for plugins | MEDIUM |
| ADR-009 | SQLite adjacency list for graph | HIGH |
| ADR-010 | Two-tier event bus (broadcast + critical mpsc) | HIGH |
| ADR-011 | AI as acceleration, never required | HIGH |
| ADR-012 | Verification > Detection | HIGH |
| ADR-013 | Local-first, enterprise optional | HIGH |
| ADR-014 | Research packs for vuln updates | HIGH |
| ADR-015 | HTTPQL for traffic filtering | MEDIUM |
| ADR-016 | IRA+ authorization model | MEDIUM |
| ADR-017 | Tantivy for FTS | HIGH |
| ADR-018 | Research engines behind feature flags | HIGH |
| ADR-019 | CloudFoxAdapter read-only by default | HIGH |
| ADR-020 | tracing + TOML + sqlx-migrate | HIGH |

Full ADRs with alternatives and tradeoffs: see V6_FINAL_ADRS.md

---

**SENTINEL V6.1 — ARCHITECTURE IMPLEMENTATION-READY.**

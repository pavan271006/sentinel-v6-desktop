# SENTINEL V6 — DEEP SPECIFICATION SURVEY: WP-1.1 (sentinel_common)

> **Document Type**: Specification Mining & Architecture Contract Survey  
> **Target Work Package**: WP-1.1 (`sentinel_common`)  
> **Source Baseline**: FROZEN ARCHITECTURE V6.0.0  
> **Author**: `spec_miner_survey_1`  
> **Timestamp**: `2026-08-17T07:53:00Z`  
> **Validator Status**: 🟢 PASS (0 Blockers, 0 Warnings, 11/11 Steps Verified)

---

## 1. Executive Summary & Specification Sources Analyzed

This specification mining report provides an exhaustive, authoritative blueprint for implementing `sentinel_common` (the core common crate for the SENTINEL V6 platform). The findings are extracted directly from the frozen V6 architecture baseline:

1. `architecture/v6/V6_CANONICAL_SPEC.yaml` (Authoritative single source of truth, SHA-256: `424f75dece3d64ef6868145b783053534149bb932fe89e51fbe548f665675041`)
2. `architecture/v6/V6_COMMON_TYPES.rs` (Definitive Rust type scaffolding, SHA-256: `4ddc26c203a67ad3b67eee740be1e9b2b6f9693d6423e51b1ae39ca6c1a443ad`)
3. `architecture/v6/V6_FINAL_DOMAIN_MODEL.md` (6-stage vulnerability lifecycle & supporting domain definitions)
4. `architecture/v6/V6_FINAL_TYPE_REGISTRY.md` (Persistence mappings and struct invariants)
5. `architecture/v6/V6_FINAL_ERROR_MODEL.md` (`SentinelError` hierarchy and propagation rules)
6. `architecture/v6/V6_FINAL_SECURITY_INVARIANTS.md` (Mandatory security invariants SEC-01 through SEC-12)
7. `architecture/v6/V6_FINAL_IMPLEMENTATION_CONTRACT.md` (Subsystem boundary guarantees)

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Lifecycle Core | `Transaction` | Raw network exchange with triple representation | `EntityMetadata`, `MessageRepresentation` req/res, `Duration`, `Option<TlsData>` | Persisted in SQLite `transactions`, Tantivy FTS, blob store | Storage / parse errors propagate via `SentinelError` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:237` |
| 2 | Lifecycle Core | `Observation` | Identified passive/active phenomenon from a transaction | `EntityMetadata`, `ObservationSource`, `data_ref: Uuid` | Persisted in SQLite `observations` | Emits `ObservationCreated` event | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:246` |
| 3 | Lifecycle Core | `Candidate` | Formal vulnerability hypothesis requiring active proof | `EntityMetadata`, `source_observation_id: Uuid`, `hypothesis`, `status` | Persisted in SQLite `candidates` | Invalid hypothesis or unverified state rejects transition | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:253` |
| 4 | Lifecycle Core | `VerificationResult` | Empirical execution outcome from verification strategy | `id: Uuid`, `candidate_id: Uuid`, `VerificationStrategyRef`, `success: bool`, `confidence: f32`, `Vec<Evidence>` | Persisted in SQLite `verifications` | Emits `CandidateVerified` event | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:297` |
| 5 | Lifecycle Core | `Evidence` | Content-addressed cryptographic proof artifact | `id: Uuid`, `verification_id: Uuid`, `EvidenceVariant`, `DateTime<Utc>` | Persisted in SQLite `evidence` and SHA-256 blob store | Modified blobs fail SHA-256 integrity checks | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:289` |
| 6 | Lifecycle Core | `Finding` | Confirmed vulnerability record with lifecycle state | `EntityMetadata`, `title`, `Severity`, `verification_id: Uuid`, `FindingLifecycle` | Persisted in SQLite `findings` | Prohibited without verified `Evidence` (SEC-06) | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:308` |
| 7 | Supporting Domain | `Scope` | Network ACL definition containing inclusions/exclusions | `id: Uuid`, `version: u64`, `timestamp`, `includes: Vec<String>`, `excludes: Vec<String>` | Persisted in SQLite `scopes` | ReDoS/regex errors trigger fail-closed | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:320` |
| 8 | Supporting Domain | `ScopeDecision` | Mandatory evaluation result for outbound network actions | `decision_id`, `allowed: bool`, `reason`, `matched_rule`, `target`, `scope_version`, `timestamp` | Emitted on every network evaluation | `allowed=false` halts network call; emits `ScopeViolationAttempt` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:518` |
| 9 | Supporting Domain | `Endpoint` | Unique HTTP route linked to knowledge graph | `id: Uuid`, `host`, `path`, `HttpMethod`, `timestamp`, `graph_node_id: Uuid` | Persisted in SQLite `endpoints` | Duplicate routes de-duplicated by composite key | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:330` |
| 10 | Supporting Domain | `Payload` | Mutated test vector targeting parameter location | `id: Uuid`, `injection_point: ParamLocation`, `payload_string`, `expected_behavior: VerificationStrategy` | Injected into scanner/fuzzer streams | Policy block yields `PolicyResult::Blocked` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:340` |
| 11 | Supporting Domain | `Identity` | Security principal representation | `id: Uuid`, `version: u64`, `timestamp`, `username`, `roles: Vec<String>`, `meta: Option<EntityMetadata>` | Persisted in SQLite `identities` | Auth failures trigger `SentinelError::AuthError` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:348` |
| 12 | Supporting Domain | `Session` | Active authentication session state | `id: Uuid`, `identity_id: Uuid`, `cookies: HashMap`, `headers: HashMap`, `created_at`, `expires_at` | Injected into HTTP request streams | Expired session prompts auto-refresh | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:358` |
| 13 | Supporting Domain | `Credential` | Vault-backed credential reference | `id: Uuid`, `identity_id: Uuid`, `credential_type`, `secret_reference: Uuid`, `AccessLevel`, `expires_at` | Secure reference pointer | Plaintext secrets forbidden in struct (SEC-09) | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:368` |
| 14 | Supporting Domain | `SecretReference` | Indirection pointer to secure OS keychain/vault | `reference_id: Uuid`, `vault_backend: String` | Resolved only at socket transport layer | Missing vault item returns error | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:378` |
| 15 | Supporting Domain | `Asset` | Target infrastructure component | `id: Uuid`, `asset_type: String`, `identifier: String`, `metadata: HashMap<String, String>` | Persisted in SQLite `assets` | Scope evaluation required before active probe | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:384` |
| 16 | Supporting Domain | `Technology` | Fingerprinted software stack item | `id: String`, `name: String`, `category: String`, `version: Option<String>`, `confidence: f32` | Persisted in SQLite `technologies` | Confidence clamped to 0.0..=1.0 | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:392` |
| 17 | Supporting Domain | `State` | Application state machine node | `state_id: String`, `state_type: String`, `payload_json: String` | Persisted in SQLite `states` | JSON parse errors trigger `SentinelError::ParseError` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:401` |
| 18 | Supporting Domain | `Workflow` | Multi-step attack sequence definition | `id: Uuid`, `name: String`, `steps_json: String`, `created_at: DateTime<Utc>` | Persisted in SQLite `workflows` | Malformed step triggers validation error | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:408` |
| 19 | Supporting Domain | `Resource` | System resource consumption tracker | `resource_type: String`, `limit_value: u64`, `current_usage: u64` | Enforces execution quotas | Exceeding limit blocks subsequent tasks | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:416` |
| 20 | Supporting Domain | `Action` | Discrete operation executed by engine/plugin | `action_id: Uuid`, `action_type: String`, `parameters: HashMap<String, String>` | Executed within sandbox / engine | Disallowed capability causes `SandboxViolation` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:423` |
| 21 | Supporting Domain | `Task` | Unit of background work | `id: Uuid`, `task_type: String`, `priority: u8`, `state: TaskLifecycle`, `progress_pct: f32` | Persisted in SQLite `tasks` | Cancelled/Failed state halts task runner | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:430` |
| 22 | Supporting Domain | `Report` | Exported assessment report deliverable | `id: Uuid`, `title: String`, `format: ReportFormat`, `file_path: String`, `config_json: String`, `generated_at` | Rendered PDF/MD/JSON/HTML file | Disk write failure returns `SentinelError::Io` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:439` |
| 23 | Supporting Domain | `RegressionTest` | Replay test case derived from verified finding | `id: Uuid`, `finding_id: Uuid`, `seed_transaction_id: Uuid`, `expected_status: String`, `created_at` | Executable replay test definition | Missing seed transaction returns `Database` error | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:449` |
| 24 | Supporting Domain | `OASTInteraction` | Out-of-band network callback record | `id: Uuid`, `token_id: Uuid`, `protocol: String`, `source_ip: String`, `raw_blob_id: Uuid`, `timestamp` | Persisted in SQLite `oast_interactions` | Encrypted token decrypt failure discards packet | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:458` |
| 25 | Supporting Domain | `AttackPath` | Knowledge graph path traversal | `id: Uuid`, `start_node_id: Uuid`, `target_node_id: Uuid`, `edge_ids: Vec<Uuid>`, `risk_score: f32`, `discovered_at` | Persisted in SQLite `attack_paths` | Disconnected path returns empty path | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:470` |
| 26 | Supporting Domain | `Note` | Pentester or AI annotation | `id: Uuid`, `target_id: Uuid`, `author: String`, `content: String`, `timestamp: DateTime<Utc>` | Persisted in SQLite `notes` | Unbound target fails foreign key constraint | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:480` |
| 27 | Supporting Domain | `Screenshot` | Visual DOM / web snapshot artifact | `id: Uuid`, `blob_id: Uuid`, `full_page: bool`, `timestamp: DateTime<Utc>` | Persisted in SQLite `screenshots` & blob store | Blob write failure returns `SentinelError::Io` | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:489` |
| 28 | Error Model | `SentinelError` | Unified canonical platform error hierarchy | Enum variants (Database, Io, Tantivy, ScopeViolation, BusOverflow, ParseError, AiEngine, SandboxViolation, InvariantViolation, TlsError, NetworkError, Timeout, AuthError, InvalidConfiguration) | Structured error propagation | Conforms to crash-safe & propagation rules | `V6_FINAL_ERROR_MODEL.md`, `V6_COMMON_TYPES.rs:501` |
| 29 | Public Traits | Core & Tier Traits | 26 Canonical Rust Traits covering all 28 subsystems | Subsystem configs, transactions, candidates, requests | Results, streams, models, receivers | All methods return `Result<T, SentinelError>` or concrete types | `V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs:703-1077` |
| 30 | Security Model | Zero Plaintext Secrets | Secret redaction & isolation invariant SEC-09 | Secret references | `[REDACTED]` or UUID indirection | Zero secrets in Debug, Display, Serialize, logs, telemetry | `V6_FINAL_SECURITY_INVARIANTS.md`, `V6_CANONICAL_SPEC.yaml` § 3 |

---

## 3. Edge Cases & Boundary Conditions

| # | Feature | Input | Observed / Specified Behavior |
|---|---------|-------|-------------------------------|
| 1 | `ScopeEngine` Evaluation | Out-of-scope URI (e.g. `http://evil.com`) | Returns `ScopeDecision { allowed: false, reason: "Target not matched in scope rules", ... }`. Active network call fails with `SentinelError::ScopeViolation` and emits `CriticalEvent::ScopeViolationAttempt`. |
| 2 | `ScopeEngine` Evaluation | ReDoS-inducing regex or evaluation >100ms | Evaluation aborts at timeout bound (100ms) and fails closed (`allowed: false`), preventing engine denial of service. |
| 3 | `HTTPParser` Parsing | Malformed chunked encoding or smuggling delimiter | Preserves raw byte stream in content-addressed blob store; parses valid portions; emits structured `ParseWarning`; never panics. |
| 4 | `EventBus` Pub/Sub | High-throughput telemetry flood (>10,000 events) | `broadcast` channel drops oldest messages for lagging consumers; emits backpressure warning; critical `mpsc` channel publisher yields/blocks without message loss. |
| 5 | `Finding` Promotion | Candidate verification returns `success: false` | Finding creation is strictly rejected; invariant SEC-06 prevents unverified findings from entering `Verified` or `Confirmed` state. |
| 6 | `Credential` Debug/Display | `format!("{:?}", credential)` or `serde_json::to_string(&credential)` | Outputs only UUID `secret_reference` and metadata; zero plaintext secret characters exposed in logs or telemetry. |
| 7 | `ObservationStore` Persistence | Unexpected crash / `kill -9` during write | SQLite WAL mode with `PRAGMA synchronous=NORMAL` recovers state atomically on restart; Tantivy indexes auto-rebuild from WAL. |
| 8 | `PluginRuntime` Sandbox | WASM plugin attempting unauthorized network or file syscall | Wasmtime sandbox traps syscall immediately; returns `SentinelError::SandboxViolation`; terminates plugin instance safely. |
| 9 | `AiPolicyEngine` Evaluation | Target prompt contains prompt injection or destructive OS command | `validate_input` returns `PolicyResult::Blocked`; destructive command is halted prior to scanner/fuzzer injection. |
| 10 | `Research` Modules | Platform compiled without `sentinel-research` feature | `SmtSolverEngine`, `RlStateEngine`, and `CryptoAnalysisEngine` are excluded at compile-time; core and professional tiers operate with zero missing symbol errors. |

---

## 4. Detailed Canonical Domain Entities (Exact Rust Specifications)

Every canonical domain entity in `sentinel_common` MUST adhere strictly to the following derivations, field layouts, and serde attributes:

### 4.1 Common Metadata & Supporting Structures

```rust
use std::collections::HashMap;
use std::time::Duration;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMetadata {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub provenance: Provenance,
    pub lifecycle: LifecycleState,
    pub scope_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpParsedParts {
    pub method: HttpMethod,
    pub uri: String,
    pub version: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsData {
    pub protocol: String,
    pub cipher: String,
    pub server_name: Option<String>,
    pub alpn: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRepresentation {
    pub raw_blob_id: Uuid,
    pub parsed: HttpParsedParts,
    pub normalized_text: String,
}
```

### 4.2 Core 6-Stage Vulnerability Lifecycle Entities

```rust
// 1. Transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub meta: EntityMetadata,
    pub request: MessageRepresentation,
    pub response: Option<MessageRepresentation>,
    pub timing: Duration,
    pub tls_info: Option<TlsData>,
}

// 2. Observation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub meta: EntityMetadata,
    pub source: ObservationSource,
    pub data_ref: Uuid,
}

// 3. Candidate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub meta: EntityMetadata,
    pub source_observation_id: Uuid,
    pub hypothesis: String,
    pub status: String,
}

// 4. VerificationStrategyRef & DiffData
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStrategyRef {
    pub strategy_type: VerificationStrategy,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffData {
    pub structural_similarity: f32,
    pub bytes_added: usize,
    pub bytes_removed: usize,
    pub status_code_changed: bool,
    pub content_type_changed: bool,
}

// 5. Evidence & EvidenceVariant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceVariant {
    TransactionEvidence(Uuid),
    OastEvidence(Uuid),
    BrowserSnapshot(Uuid),
    TimingVariance { expected: Duration, actual: Duration },
    Differential(DiffData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub id: Uuid,
    pub verification_id: Uuid,
    pub variant: EvidenceVariant,
    pub created_at: DateTime<Utc>,
}

// 6. VerificationResult & Finding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub id: Uuid,
    pub candidate_id: Uuid,
    pub strategy_ref: VerificationStrategyRef,
    pub success: bool,
    pub confidence: f32,
    pub evidence: Vec<Evidence>,
    pub executed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub meta: EntityMetadata,
    pub title: String,
    pub severity: Severity,
    pub verification_id: Uuid,
    pub state: FindingLifecycle,
}
```

### 4.3 Supporting Domain Entities (20 Canonical Types + ScopeDecision)

```rust
// 7. Scope & ScopeDecision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub includes: Vec<String>,
    pub excludes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeDecision {
    pub decision_id: Uuid,
    pub allowed: bool,
    pub reason: String,
    pub matched_rule: Option<Uuid>,
    pub target: String,
    pub scope_version: u64,
    pub timestamp: DateTime<Utc>,
}

// 8. Endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Endpoint {
    pub id: Uuid,
    pub host: String,
    pub path: String,
    pub method: HttpMethod,
    pub timestamp: DateTime<Utc>,
    pub graph_node_id: Uuid,
}

// 9. Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payload {
    pub id: Uuid,
    pub injection_point: ParamLocation,
    pub payload_string: String,
    pub expected_behavior: VerificationStrategy,
}

// 10. Identity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub username: String,
    pub roles: Vec<String>,
    pub meta: Option<EntityMetadata>,
}

// 11. Session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub identity_id: Uuid,
    pub cookies: HashMap<String, String>,
    pub headers: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

// 12. Credential & SecretReference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: Uuid,
    pub identity_id: Uuid,
    pub credential_type: String,
    pub secret_reference: Uuid,
    pub access_level: AccessLevel,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretReference {
    pub reference_id: Uuid,
    pub vault_backend: String,
}

// 13. Asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: Uuid,
    pub asset_type: String,
    pub identifier: String,
    pub metadata: HashMap<String, String>,
}

// 14. Technology
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Technology {
    pub id: String,
    pub name: String,
    pub category: String,
    pub version: Option<String>,
    pub confidence: f32,
}

// 15. State
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    pub state_id: String,
    pub state_type: String,
    pub payload_json: String,
}

// 16. Workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: Uuid,
    pub name: String,
    pub steps_json: String,
    pub created_at: DateTime<Utc>,
}

// 17. Resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub resource_type: String,
    pub limit_value: u64,
    pub current_usage: u64,
}

// 18. Action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub action_id: Uuid,
    pub action_type: String,
    pub parameters: HashMap<String, String>,
}

// 19. Task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub task_type: String,
    pub priority: u8,
    pub state: TaskLifecycle,
    pub progress_pct: f32,
}

// 20. Report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub title: String,
    pub format: ReportFormat,
    pub file_path: String,
    pub config_json: String,
    pub generated_at: DateTime<Utc>,
}

// 21. RegressionTest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegressionTest {
    pub id: Uuid,
    pub finding_id: Uuid,
    pub seed_transaction_id: Uuid,
    pub expected_status: String,
    pub created_at: DateTime<Utc>,
}

// 22. OASTInteraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OASTInteraction {
    pub id: Uuid,
    pub token_id: Uuid,
    pub protocol: String,
    pub source_ip: String,
    pub raw_blob_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

pub type OastInteraction = OASTInteraction;

// 23. AttackPath
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackPath {
    pub id: Uuid,
    pub start_node_id: Uuid,
    pub target_node_id: Uuid,
    pub edge_ids: Vec<Uuid>,
    pub risk_score: f32,
    pub discovered_at: DateTime<Utc>,
}

// 24. Note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: Uuid,
    pub target_id: Uuid,
    pub author: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

// 25. Screenshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: Uuid,
    pub blob_id: Uuid,
    pub full_page: bool,
    pub timestamp: DateTime<Utc>,
}
```

---

## 5. Detailed Canonical Enums

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    TRACE,
    CONNECT,
    GRAPHQL,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ParamLocation {
    Query,
    Body,
    Header,
    Path,
    Cookie,
    JsonPath,
    XPath,
    MultipartField,
    GraphQLVariable,
    WebSocketFrame,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DataType {
    String,
    Integer,
    Boolean,
    Float,
    Uuid,
    Json,
    Xml,
    Base64,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Provenance {
    Manual,
    Scanner,
    Fuzzer,
    Proxy,
    AI,
    Tool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LifecycleState {
    Active,
    Archived,
    Deleted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskLifecycle {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScanLifecycle {
    Initializing,
    Running,
    Pausing,
    Paused,
    Finished,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FindingLifecycle {
    Candidate,
    Verified,
    Confirmed,
    Reported,
    Remediated,
    FalsePositive,
    AcceptedRisk,
    Regression,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ObservationSource {
    Proxy,
    OAST,
    Browser,
    Manual,
    Tool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccessLevel {
    Admin,
    User,
    Anonymous,
    TenantA,
    TenantB,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReportFormat {
    Pdf,
    Markdown,
    Json,
    Html,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MutatorType {
    BitFlip,
    ByteReplace,
    Grammar,
    Wordlist,
    Radamsa,
    Boundary,
    UnicodeNormalization,
    Truncation,
    FormatString,
    AiAssisted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationStrategy {
    BrowserExecution,
    OASTCorrelation,
    TimingStatistical,
    ResponseDifferential,
    StateVerification,
    AuthorizationReplay,
    ContentVerification,
    MathematicalVerification,
    ErrorClassification,
    CausalMinimization,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ParameterClass {
    ObjectId,
    Url,
    FilePath,
    Email,
    Token,
    Search,
    Numeric,
    Boolean,
    Json,
    Xml,
    Html,
    Enumeration,
    FreeText,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyResultType {
    Approved,
    Blocked,
    Filtered,
    RequiresHumanApproval,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyResult {
    Approved,
    Blocked,
    Filtered(String),
    RequiresHumanApproval,
}
```

---

## 6. Detailed Canonical Traits & Public Interfaces

The public traits define the subsystem boundaries across the platform. In `sentinel_common`, these traits provide the abstract contracts implemented across crates (`sentinel_storage`, `sentinel_bus`, `sentinel_scope`, etc.):

```rust
// SUB-01 ProxyEngine & Interceptor
pub trait ProxyInterceptor: Send + Sync {}

#[async_trait::async_trait]
pub trait ProxyEngine: Send + Sync {
    async fn start(&self, config: ProxyConfig) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    fn register_interceptor(&mut self, interceptor: Box<dyn ProxyInterceptor>);
    fn set_intercept_rules(&mut self, rules: Vec<InterceptRule>) -> Result<(), SentinelError>;
}

// SUB-02 HTTPParser
#[async_trait::async_trait]
pub trait HttpParser: Send + Sync {
    fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError>;
    fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError>;
    fn serialize_request(&self, req: &ParsedRequest) -> Result<Vec<u8>, SentinelError>;
    fn serialize_response(&self, res: &ParsedResponse) -> Result<Vec<u8>, SentinelError>;
}

// SUB-03 ObservationStore
#[async_trait::async_trait]
pub trait ObservationStore: Send + Sync {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError>;
    async fn insert_batch(&self, obs: Vec<Observation>) -> Result<(), SentinelError>;
    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError>;
    async fn query_sql(&self, sql: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn search_fts(&self, query: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn rebuild_index(&self) -> Result<(), SentinelError>;
}

// SUB-04 ScopeEngine
#[async_trait::async_trait]
pub trait ScopeEngine: Send + Sync {
    fn is_in_scope(&self, uri: &str) -> ScopeDecision;
    fn is_ip_in_scope(&self, ip: &str) -> ScopeDecision;
    fn update_scope(&mut self, scope: Scope) -> Result<(), SentinelError>;
}

// SUB-05 EventBus
#[async_trait::async_trait]
pub trait EventBus: Send + Sync {
    fn subscribe_telemetry(&self) -> tokio::sync::broadcast::Receiver<SentinelEvent>;
    fn subscribe_critical(&self) -> tokio::sync::mpsc::Receiver<CriticalEvent>;
    fn publish_telemetry(&self, event: SentinelEvent) -> Result<(), SentinelError>;
    fn publish_critical(&self, event: CriticalEvent) -> Result<(), SentinelError>;
}

// SUB-06 TaskScheduler
#[async_trait::async_trait]
pub trait TaskScheduler: Send + Sync {
    async fn submit(&self, task: TaskConfig) -> Result<Uuid, SentinelError>;
    async fn pause(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn resume(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn status(&self, task_id: Uuid) -> Result<TaskLifecycle, SentinelError>;
    async fn checkpoint(&self, task_id: Uuid, state: Vec<u8>) -> Result<(), SentinelError>;
    async fn restore_checkpoint(&self, task_id: Uuid) -> Result<Option<Vec<u8>>, SentinelError>;
}

// SUB-07 ScanOrchestrator
#[async_trait::async_trait]
pub trait ScanOrchestrator: Send + Sync {
    async fn start_scan(&self, config: ScanConfig) -> Result<Uuid, SentinelError>;
    async fn pause_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn resume_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn scan_status(&self, scan_id: Uuid) -> Result<ScanLifecycle, SentinelError>;
}

// SUB-08 FuzzerEngine
#[async_trait::async_trait]
pub trait FuzzerEngine: Send + Sync {
    async fn fuzz(&self, seed: &Transaction, profile: &FuzzProfile) -> Result<FuzzStream, SentinelError>;
}

// SUB-09 VerificationEngine
#[async_trait::async_trait]
pub trait VerificationEngine: Send + Sync {
    async fn verify_candidate(&self, candidate: &Candidate, strategy: VerificationStrategyRef) -> Result<VerificationResult, SentinelError>;
    async fn correlate_oast(&self, token: &str) -> Result<Option<OastEvidence>, SentinelError>;
    fn available_strategies(&self) -> Vec<VerificationStrategy>;
}

// SUB-10 ContextEngine
#[async_trait::async_trait]
pub trait ContextEngine: Send + Sync {
    fn fingerprint(&self, transaction: &Transaction) -> Vec<TechFingerprint>;
    fn classify_parameter(&self, name: &str, value: &str) -> ParameterClass;
}

// SUB-11 CoverageEngine
#[async_trait::async_trait]
pub trait CoverageEngine: Send + Sync {
    async fn record_test(&self, endpoint_id: Uuid) -> Result<(), SentinelError>;
    async fn get_coverage(&self, scope_id: Uuid) -> Result<CoverageReport, SentinelError>;
    async fn untested_endpoints(&self, scope_id: Uuid) -> Result<Vec<Endpoint>, SentinelError>;
}

// SUB-12 IdentityManager
#[async_trait::async_trait]
pub trait IdentityManager: Send + Sync {
    async fn add_identity(&self, identity: Identity) -> Result<Uuid, SentinelError>;
    async fn add_credential(&self, credential: Credential) -> Result<Uuid, SentinelError>;
    async fn list_identities(&self) -> Result<Vec<Identity>, SentinelError>;
    async fn inject_auth(&self, identity_id: Uuid, request: &mut ParsedRequest) -> Result<(), SentinelError>;
    async fn refresh_credential(&self, credential_id: Uuid) -> Result<(), SentinelError>;
}

// SUB-13 KnowledgeEngine
#[async_trait::async_trait]
pub trait KnowledgeEngine: Send + Sync {
    async fn add_node(&self, node: GraphNode) -> Result<Uuid, SentinelError>;
    async fn add_edge(&self, edge: GraphEdge) -> Result<Uuid, SentinelError>;
    async fn query_neighbors(&self, node_id: Uuid) -> Result<Vec<GraphNode>, SentinelError>;
    async fn find_path(&self, from: Uuid, to: Uuid) -> Result<Vec<Vec<GraphEdge>>, SentinelError>;
    async fn resolve_entity(&self, identifier: &str) -> Result<Option<GraphNode>, SentinelError>;
}

// SUB-14 ReportEngine
#[async_trait::async_trait]
pub trait ReportEngine: Send + Sync {
    async fn generate(&self, config: ReportConfig) -> Result<Vec<u8>, SentinelError>;
}

// SUB-15 BrowserService
#[async_trait::async_trait]
pub trait BrowserService: Send + Sync {
    async fn navigate(&self, url: &str) -> Result<NavigationResult, SentinelError>;
    async fn execute_script(&self, js: &str) -> Result<String, SentinelError>;
    async fn capture_dom(&self) -> Result<String, SentinelError>;
    async fn take_screenshot(&self, full_page: bool) -> Result<Vec<u8>, SentinelError>;
    async fn close(&self) -> Result<(), SentinelError>;
}

// SUB-16 OastServer
#[async_trait::async_trait]
pub trait OastServer: Send + Sync {
    async fn start(&self) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    async fn generate_token(&self) -> Result<String, SentinelError>;
    async fn poll_interactions(&self, token: &str) -> Result<Vec<OastInteraction>, SentinelError>;
}

// SUB-17 AuthorizationEngine
#[async_trait::async_trait]
pub trait AuthorizationEngine: Send + Sync {
    async fn build_matrix(&self, identities: Vec<Uuid>) -> Result<AuthzMatrix, SentinelError>;
    async fn test_matrix(&self, matrix: &AuthzMatrix) -> Result<Vec<AuthzViolation>, SentinelError>;
}

// SUB-18 AiEngine
#[async_trait::async_trait]
pub trait AiEngine: Send + Sync {
    async fn analyze(&self, request: AiRequest) -> Result<AiResponse, SentinelError>;
    fn is_available(&self) -> bool;
}

// SUB-19 AiPolicyEngine
#[async_trait::async_trait]
pub trait AiPolicyEngine: Send + Sync {
    fn validate_input(&self, prompt: &str) -> PolicyResult;
    fn validate_output(&self, response: &str) -> PolicyResult;
    fn is_destructive(&self, command: &str) -> bool;
    fn requires_approval(&self, command: &str) -> bool;
}

// SUB-20 PluginRuntime
#[async_trait::async_trait]
pub trait PluginRuntime: Send + Sync {
    async fn load_wasm(&self, wasm_bytes: &[u8], config: PluginSandboxConfig) -> Result<Uuid, SentinelError>;
    async fn load_rhai(&self, script: &str, config: PluginSandboxConfig) -> Result<Uuid, SentinelError>;
    async fn execute(&self, plugin_id: Uuid, input: PluginInput) -> Result<PluginOutput, SentinelError>;
    async fn unload(&self, plugin_id: Uuid) -> Result<(), SentinelError>;
}

// SUB-21 ResearchPackManager
#[async_trait::async_trait]
pub trait ResearchPackManager: Send + Sync {
    async fn load_pack(&self, path: &str) -> Result<PackManifest, SentinelError>;
    async fn verify_signature(&self, pack: &PackManifest) -> Result<bool, SentinelError>;
    async fn list_checks(&self, pack_id: &str) -> Result<Vec<SecurityCheck>, SentinelError>;
    async fn hot_reload(&self, pack_id: &str) -> Result<(), SentinelError>;
}

// SUB-22..25 ExternalToolAdapter
#[async_trait::async_trait]
pub trait ExternalToolAdapter: Send + Sync {
    fn tool_name(&self) -> &str;
    fn is_installed(&self) -> bool;
    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError>;
}

// SUB-26..28 Research Modules (Gated by sentinel-research)
#[cfg(feature = "sentinel-research")]
#[async_trait::async_trait]
pub trait SmtSolverEngine: Send + Sync {
    async fn prove_logic_flaw(&self, source_code: &str, invariant: &str) -> Result<SymbolicPath, SentinelError>;
}

#[cfg(feature = "sentinel-research")]
#[async_trait::async_trait]
pub trait RlStateEngine: Send + Sync {
    async fn explore_state_machine(&self, initial_url: &str) -> Result<Vec<RlRewardModel>, SentinelError>;
}

#[cfg(feature = "sentinel-research")]
#[async_trait::async_trait]
pub trait CryptoAnalysisEngine: Send + Sync {
    async fn analyze_handshake(&self, pcap_data: &[u8]) -> Result<Option<CryptoWeakness>, SentinelError>;
}
```

---

## 7. Canonical Error Model (`SentinelError`)

The `SentinelError` enum is the single, authoritative error enum for all cross-subsystem interactions.

```rust
#[derive(Debug, thiserror::Error)]
pub enum SentinelError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Search index error: {0}")]
    Tantivy(String),

    #[error("Scope engine rejected interaction: {reason}")]
    ScopeViolation { reason: String },

    #[error("Event bus overflow: dropped {count} messages")]
    BusOverflow { count: usize },

    #[error("Parsing error: {0}")]
    ParseError(String),

    #[error("AI Engine error: {0}")]
    AiEngine(String),

    #[error("Plugin sandbox violation: {0}")]
    SandboxViolation(String),

    #[error("Internal invariant violated: {0}")]
    InvariantViolation(String),

    #[error("TLS error: {0}")]
    TlsError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Operation timeout: {0}")]
    Timeout(String),

    #[error("Authentication/Authorization error: {0}")]
    AuthError(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
}
```

### 7.1 Error Propagation & Recovery Rules
1. **Never Swallow Errors**: Unrecoverable errors MUST propagate to the caller or be logged via `tracing::error!`.
2. **Crash Safely**: If an `InvariantViolation` occurs, the process/thread enters a safe panic wrapper. SQLite WAL and EventBus checkpoints ensure zero state corruption on restart.
3. **Graceful Degradation**: `AiEngine` failures degrade to deterministic scanner fallbacks without halting the scan orchestrator.
4. **Retry Policies**:
   - `Database`: Retry on lock (`SQLITE_BUSY`) with exponential backoff.
   - `BusOverflow`: UI telemetry drops lagging messages; critical mpsc channel yields publisher.
   - `ScopeViolation`: Never retry; fails closed immediately.

---

## 8. Secret Redaction & Invariant SEC-09 Implementation Model

The architecture enforces strict secret redaction rules across the system:

1. **`Credential -> SecretReference -> OS Keychain / Encrypted Vault`**:
   - The domain `Credential` struct contains only a UUID `secret_reference` and metadata (`access_level`, `identity_id`, `credential_type`, `expires_at`).
   - Plaintext credentials (passwords, tokens, API keys) are NEVER stored in domain structs, SQLite tables, event payloads, logs, telemetry, knowledge graph nodes, reports, or crash dumps.
2. **In-Memory Secret Handling**:
   - When plaintext secrets are required for transmission, they are fetched from the vault backend immediately before transport dispatch into an ephemeral buffer wrapped in a redacted struct (`SecretString` / `SecretBytes`).
   - `SecretString` implements `zeroize::Zeroize` on drop and custom `Debug`, `Display`, and `Serialize` implementations that output `"[REDACTED]"`.
3. **Mandatory Redaction Tests**:
   - Automated unit tests in `sentinel_common` MUST verify:
     - `format!("{:?}", credential)` contains NO secret plaintext.
     - `format!("{}", credential)` contains NO secret plaintext.
     - `serde_json::to_string(&credential)` contains only the `secret_reference` UUID.
     - Ephemeral secret buffers serialize to `"[REDACTED]"`.

---

## 9. Target Crate Structure & Dependency Matrix for `sentinel_common`

### 9.1 Cargo.toml Configuration

```toml
[package]
name = "sentinel_common"
version = "6.0.0"
edition = "2021"
authors = ["SENTINEL Core Architecture Team"]
description = "Canonical domain types, enums, errors, and trait interfaces for SENTINEL V6"
license = "Proprietary"

[features]
default = []
sentinel-research = []

[dependencies]
uuid = { version = "1.7", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
async-trait = "0.1"
tokio = { version = "1.36", features = ["sync", "time", "macros", "rt"] }
zeroize = { version = "1.7", features = ["derive"] }

[dev-dependencies]
tokio = { version = "1.36", features = ["full"] }
```

### 9.2 Module Hierarchy (`crates/sentinel_common/src/`)

```
crates/sentinel_common/src/
├── lib.rs                  # Crate root, re-exports domain, enums, errors, traits, config, events
├── domain/
│   ├── mod.rs              # Re-exports all core and supporting domain models
│   ├── meta.rs             # EntityMetadata, HttpParsedParts, TlsData, MessageRepresentation
│   ├── core.rs             # Transaction, Observation, Candidate, VerificationResult, Evidence, Finding
│   ├── scope.rs            # Scope, ScopeDecision
│   ├── endpoint.rs         # Endpoint, Payload
│   ├── identity.rs         # Identity, Session, Credential, SecretReference
│   ├── asset.rs            # Asset, Technology, TechFingerprint
│   ├── state.rs            # State, Workflow, Action
│   ├── task.rs             # Task, Resource, ResourceBudget, TaskStateUpdate
│   ├── report.rs           # Report, RegressionTest, CoverageReport
│   ├── oast.rs             # OASTInteraction, OastEvidence
│   ├── graph.rs            # AttackPath, GraphNode, GraphEdge
│   └── misc.rs             # Note, Screenshot, DiffData, ParseWarning, InterceptRule, SecurityCheck
├── enums.rs                # All 16+ canonical enums with copy/eq/serde derives
├── errors.rs               # SentinelError definition, Display, Error traits
├── traits.rs               # All 26 canonical async/sync traits (ProxyEngine, ScopeEngine, etc.)
├── events.rs               # SentinelEvent, CriticalEvent definitions
├── config.rs               # SentinelConfig, ProxyConfig, ScopeConfig, StorageConfig, etc.
└── security.rs             # SecretString / RedactedString zeroizing wrapper & redaction helpers
```

---

## 10. Architectural Consistency & Verification Evidence

1. **Schema Validation**: `V6_CANONICAL_SPEC.yaml` validated against `V6_CANONICAL_SPEC_SCHEMA.yaml` with 0 errors.
2. **Taxonomy & Counts**: Exactly 28 subsystems (Core: 14, Professional: 7, Adapter: 4, Research: 3).
3. **Domain Entities**: All 6 core lifecycle entities and 20 supporting entities match 1-to-1 between YAML, Rust, SQLite schema, and Markdown registries.
4. **Security Invariants**: All 12 security invariants (SEC-01 to SEC-12) strictly specified and verified.
5. **Specification Conformance Validator**: `python architecture/v6/validate_v6_spec.py` returns Exit Code `0` (ZERO BLOCKERS, ZERO WARNINGS).

---
*Report compiled and certified by `spec_miner_survey_1` for Phase 1 WP-1.1 Foundation Implementation.*

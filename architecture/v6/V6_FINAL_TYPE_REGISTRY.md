# SENTINEL V6 — CANONICAL TYPE REGISTRY

> **DATE**: 2026-08-17  
> **STATUS**: AUTHORITATIVE — 100% SYNCHRONIZED  
> **CANONICAL SPEC**: `V6_CANONICAL_SPEC.yaml` § 2  
> **RUST IMPLEMENTATION**: `V6_COMMON_TYPES.rs`

---

## 1. Core 6-Stage Vulnerability Lifecycle Entities

| Core Entity | Rust Struct | Key Fields | Persistence / Memory Invariant |
|---|---|---|---|
| **Transaction** | `Transaction` | `meta: EntityMetadata`, `request: MessageRepresentation`, `response: Option<MessageRepresentation>`, `timing: Duration`, `tls_info: Option<TlsData>` | Persisted in SQLite `transactions` table and Tantivy FTS index; raw bytes in SHA-256 blob store. |
| **Observation** | `Observation` | `meta: EntityMetadata`, `source: ObservationSource`, `data_ref: Uuid` | Persisted in SQLite `observations` table; links back to transaction/blob data_ref. |
| **Candidate** | `Candidate` | `meta: EntityMetadata`, `source_observation_id: Uuid`, `hypothesis: String`, `status: String` | Persisted in SQLite `candidates` table; hypothesis requires active verification. |
| **VerificationResult** | `VerificationResult` | `id: Uuid`, `candidate_id: Uuid`, `strategy_ref: VerificationStrategyRef`, `success: bool`, `confidence: f32`, `evidence: Vec<Evidence>`, `executed_at: DateTime<Utc>` | Persisted in SQLite `verifications` table; bound to executed verification strategy. |
| **Evidence** | `Evidence` | `id: Uuid`, `verification_id: Uuid`, `variant: EvidenceVariant`, `created_at: DateTime<Utc>` | Persisted in SQLite `evidence` table; cryptographic/empirical proofs. |
| **Finding** | `Finding` | `meta: EntityMetadata`, `title: String`, `severity: Severity`, `verification_id: Uuid`, `state: FindingLifecycle` | Persisted in SQLite `findings` table; bound to verified finding lifecycle state machine. |

---

## 2. Supporting Domain Entities

| Supporting Entity | Rust Struct | Purpose & Invariant |
|---|---|---|
| **Scope** | `Scope` | Authorization boundary; includes/excludes glob/regex lists. |
| **Endpoint** | `Endpoint` | Route tuple (`host`, `path`, `method`) bound to graph node. |
| **Payload** | `Payload` | Test mutation bound to `ParamLocation` and `VerificationStrategy`. |
| **Identity** | `Identity` | Security principal (`username`, `roles`, metadata). |
| **Session** | `Session` | Active session state (`cookies`, `headers`, `expires_at`). |
| **Credential** | `Credential` | Secret reference wrapper with `access_level` and secure vault link. |
| **SecretReference** | `SecretReference` | Indirection pointer (`reference_id`, `vault_backend`) — zero plaintext. |
| **Asset** | `Asset` | Target infrastructure component (`asset_type`, `identifier`, `metadata`). |
| **Technology** | `Technology` | Fingerprinted tech stack item (`name`, `category`, `confidence`). |
| **State** | `State` | State machine node (`state_id`, `state_type`, `payload_json`). |
| **Workflow** | `Workflow` | Multi-step testing sequence or automation run. |
| **Resource** | `Resource` | Resource limit/usage tracker (`resource_type`, `limit_value`, `current_usage`). |
| **Action** | `Action` | Executable action definition (`action_id`, `action_type`, `parameters`). |
| **Task** | `Task` | Background task unit (`task_type`, `priority`, `state`, `progress_pct`). |
| **Report** | `Report` | Exported assessment report (`title`, `format`, `file_path`, `config_json`). |
| **RegressionTest** | `RegressionTest` | Replay test case linked to finding and seed transaction. |
| **OASTInteraction** | `OASTInteraction` | Out-of-band network interaction (`token_id`, `protocol`, `source_ip`, `raw_blob_id`). |
| **AttackPath** | `AttackPath` | Knowledge graph path traversal (`start_node_id`, `target_node_id`, `risk_score`). |
| **Note** | `Note` | Pentester/AI annotation (`target_id`, `author`, `content`, `timestamp`). |
| **Screenshot** | `Screenshot` | Rendered visual snapshot (`blob_id`, `full_page`, `timestamp`). |

---

## 3. Canonical Enums

| Enum Name | Variants |
|---|---|
| **`HttpMethod`** | `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `TRACE`, `CONNECT`, `GRAPHQL` |
| **`ParamLocation`** | `Query`, `Body`, `Header`, `Path`, `Cookie`, `JsonPath`, `XPath`, `MultipartField`, `GraphQLVariable`, `WebSocketFrame` |
| **`DataType`** | `String`, `Integer`, `Boolean`, `Float`, `Uuid`, `Json`, `Xml`, `Base64`, `Unknown` |
| **`Provenance`** | `Manual`, `Scanner`, `Fuzzer`, `Proxy`, `AI`, `Tool` |
| **`LifecycleState`** | `Active`, `Archived`, `Deleted` |
| **`TaskLifecycle`** | `Pending`, `Running`, `Paused`, `Completed`, `Failed`, `Cancelled` |
| **`ScanLifecycle`** | `Initializing`, `Running`, `Pausing`, `Paused`, `Finished`, `Error` |
| **`Severity`** | `Critical`, `High`, `Medium`, `Low`, `Info` |
| **`FindingLifecycle`** | `Candidate`, `Verified`, `Confirmed`, `Reported`, `Remediated`, `FalsePositive`, `AcceptedRisk`, `Regression` |
| **`ObservationSource`** | `Proxy`, `OAST`, `Browser`, `Manual`, `Tool` |
| **`AccessLevel`** | `Admin`, `User`, `Anonymous`, `TenantA`, `TenantB` |
| **`ReportFormat`** | `Pdf`, `Markdown`, `Json`, `Html` |
| **`MutatorType`** | `BitFlip`, `ByteReplace`, `Grammar`, `Wordlist`, `Radamsa`, `Boundary`, `UnicodeNormalization`, `Truncation`, `FormatString`, `AiAssisted` |
| **`VerificationStrategy`** | `BrowserExecution`, `OASTCorrelation`, `TimingStatistical`, `ResponseDifferential`, `StateVerification`, `AuthorizationReplay`, `ContentVerification`, `MathematicalVerification`, `ErrorClassification`, `CausalMinimization` |
| **`ParameterClass`** | `ObjectId`, `Url`, `FilePath`, `Email`, `Token`, `Search`, `Numeric`, `Boolean`, `Json`, `Xml`, `Html`, `Enumeration`, `FreeText`, `Unknown` |
| **`PolicyResultType`** | `Approved`, `Blocked`, `Filtered`, `RequiresHumanApproval` |

---

## 4. Advanced Operational Structs

- **`ScopeDecision`**: `decision_id: Uuid`, `allowed: bool`, `reason: String`, `matched_rule: Option<Uuid>`, `target: String`, `scope_version: u64`, `timestamp: DateTime<Utc>`
- **`FuzzProfile`**: `insertion_points`, `mutators`, `encoders`, `concurrency`, `request_budget`, `timeout_ms`, `stop_conditions`
- **`PluginSandboxConfig`**: `capabilities: CapabilitySet` (network, fs, secrets, db, browser) + `limits: ResourceLimits` (RAM, CPU, network requests)
- **`SentinelConfig`**: Top-level system configuration containing `proxy`, `scope`, `storage`, `scanner`, `ai`, `plugins` blocks.

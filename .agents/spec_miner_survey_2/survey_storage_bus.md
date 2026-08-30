# SENTINEL V6 — DEEP SPECIFICATION MINING REPORT: STORAGE & BUS (WP-1.2 & WP-1.3)

**Author**: `spec_miner_survey_2`  
**Date**: 2026-08-17  
**Authority**: Frozen Architecture V6.0.0 (`architecture/v6/`)  
**Scope**: Work Package 1.2 (`sentinel_storage`) and Work Package 1.3 (`sentinel_bus`)

---

## Executive Summary

This specification mining report defines the exact implementation contracts, data schemas, invariants, runtime behaviors, error handlings, edge cases, and crate architectures for **WP-1.2 (`sentinel_storage`)** and **WP-1.3 (`sentinel_bus`)** in Phase 1 of the SENTINEL V6 foundation.

All contracts are extracted directly from the authoritative canonical artifacts:
- `V6_CANONICAL_SPEC.yaml` (§ 1, § 2, § 3, § 4, § 5, § 6, § 7, § 8, § 10)
- `V6_SQLITE_SCHEMA.sql` (All 32 SQLite tables, indexes, PRAGMAs)
- `V6_IPC_CONTRACTS.proto` (Protobuf services, messages, `SentinelUiStream`)
- `V6_FINAL_EVENT_REGISTRY.md` (Telemetry vs. Critical Event topologies)
- `V6_FINAL_INTERFACE_REGISTRY.md` & `V6_COMMON_TYPES.rs` (Traits, method signatures, domain types)
- `V6_FINAL_SECURITY_INVARIANTS.md` (SEC-01 through SEC-12, specifically SEC-07, SEC-08, SEC-09, SEC-12)
- `V6_FINAL_ERROR_MODEL.md` (`SentinelError` hierarchy)
- `validate_v6_spec.py` (Validation Step 5, Step 6, Step 7, Step 9)

---

## Part 1: Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Storage Engine | SQLite WAL Configuration & PRAGMAs | Initializes SQLite with mandatory performance and safety PRAGMAs: `PRAGMA journal_mode=WAL;`, `PRAGMA synchronous=NORMAL;`, `PRAGMA foreign_keys=ON;`, `PRAGMA busy_timeout=5000;`. | Database path `&Path`, pool configuration | `SqlitePool` / Connection handle | Fails with `SentinelError::Database` if PRAGMA configuration fails or database file unreadable | `V6_CANONICAL_SPEC.yaml:2933`, `V6_SQLITE_SCHEMA.sql:7-9`, `validate_v6_spec.py:1093` |
| 2 | Storage Engine | Schema Migration System | Embedded SQL schema migrations runner applying all 32 relational tables, triggers, and indices idempotently on startup. | Database connection pool | `Result<(), SentinelError>` | Returns `SentinelError::Database` on syntax error, locked schema, or incompatible migration state | `V6_CANONICAL_SPEC.yaml:2938`, `V6_SQLITE_SCHEMA.sql:1-398` |
| 3 | Storage Engine | Single-Writer Async Channel Architecture | Asynchronous write pipeline queuing write operations into a dedicated worker task to prevent SQLite database lock contention during concurrent bursts. | Stream/MPSC of write commands (`WriteOp`) | `Result<(), SentinelError>` per operation | Returns `SentinelError::Database` on constraint violations or channel drop | `V6_FINAL_IMPLEMENTATION_CONTRACT.md:38`, `V6_CANONICAL_SPEC.yaml:109` |
| 4 | Storage Relational | Scope Repository (`scopes`) | Persists and queries project network boundary definitions, inclusion rules, and exclusion rules with schema revision tracking. | `Scope` struct (`id`, `version`, `timestamp`, `includes`, `excludes`) | `Result<(), SentinelError>` / `Option<Scope>` | `SentinelError::Database` on SQL errors or foreign key violations | `V6_SQLITE_SCHEMA.sql:15-21`, `V6_CANONICAL_SPEC.yaml:2939` |
| 5 | Storage Relational | Knowledge Graph Repositories (`graph_nodes`, `graph_edges`) | Stores security topology graph nodes and directed relationships with cascading deletion rules. | `GraphNode`, `GraphEdge` | Node/Edge UUIDs, neighbor queries, path finding | Returns `SentinelError::Database` on foreign key violation or cyclical failure | `V6_SQLITE_SCHEMA.sql:27-47`, `V6_CANONICAL_SPEC.yaml:2959-3012` |
| 6 | Storage Relational | Endpoint & Parameter Repository (`endpoints`, `parameters`) | Stores unique HTTP routes (host, path, method) and inferred parameter types linked to graph nodes. | `Endpoint`, `Parameter` structs | `Uuid`, endpoint lookups | Unique constraint violation on duplicate `(host, path, method)` returns `SentinelError::Database` | `V6_SQLITE_SCHEMA.sql:49-73`, `V6_CANONICAL_SPEC.yaml:3013-3073` |
| 7 | Storage Relational | Observation Repository (`observations`) | Persists passive/active security observations linking provenance, source, lifecycle, and data_ref. | `Observation` struct | `Uuid`, filtered observation vectors | `SentinelError::Database` on insertion or query failure | `V6_SQLITE_SCHEMA.sql:78-92`, `V6_COMMON_TYPES.rs:740` |
| 8 | Storage Relational | Transaction Repository (`transactions`) | Persists full HTTP/1.1, HTTP/2, WebSocket metadata, timing, status, TLS cipher, and references to raw blob storage. | `Transaction` struct | `Uuid`, transaction records, paginated queries | `SentinelError::Database` on disk full or transaction abort | `V6_SQLITE_SCHEMA.sql:93-116`, `V6_CANONICAL_SPEC.yaml:3112` |
| 9 | Storage Relational | Identity & Session Repository (`identities`, `sessions`, `credentials`) | Persists authenticated test principals, cookie jars, session headers, and credential references. Enforces SEC-09 (zero plaintext secrets). | `Identity`, `Session`, `Credential` | Entity UUIDs, session records | `SentinelError::Database` on cascade failure or expired record lookup | `V6_SQLITE_SCHEMA.sql:121-152`, `V6_FINAL_SECURITY_INVARIANTS.md:69` |
| 10 | Storage Relational | OAST Interaction Repository (`oast_tokens`, `oast_interactions`) | Persists AES-256 out-of-band correlation tokens and captured interaction network payloads. | `OastToken`, `OastInteraction` | Token lookup, interaction correlation vectors | Unique constraint on `token_string`; `SentinelError::Database` | `V6_SQLITE_SCHEMA.sql:157-177`, `V6_CANONICAL_SPEC.yaml:3255` |
| 11 | Storage Relational | Verification Pipeline Repositories (`candidates`, `verifications`, `evidence`, `findings`) | Implements full 6-stage lifecycle storage: Candidate -> VerificationResult -> Evidence -> Finding with strict cascade rules. | Lifecycle structs | Entity UUIDs, finding queries by severity and state | Returns `SentinelError::Database`; blocked if evidence missing (SEC-06) | `V6_SQLITE_SCHEMA.sql:182-241`, `V6_CANONICAL_SPEC.yaml:3305-3456` |
| 12 | Storage Relational | Task Checkpoints & Workflows (`task_checkpoints`, `workflows`, `reports`, `regression_tests`) | Stores asynchronous scan checkpoints for crash recovery, multi-step workflows, generated reports, and finding regression test cases. | Checkpoint state bytes, Task ID, JSON blobs | Checkpoint bytes, task state restoration | `SentinelError::Database` on serialization or SQL write failure | `V6_SQLITE_SCHEMA.sql:246-280`, `V6_CANONICAL_SPEC.yaml:3458-3587` |
| 13 | Storage Relational | Pentester Productivity & Scanner Configs (`notes`, `screenshots`, `attack_paths`, `scan_configs`, `proxy_intercept_rules`) | Persists annotations, screenshot blob pointers, computed attack paths, active plugin configs, and HTTPQL intercept rules. | Config structs, user notes, screenshot meta | Entity UUIDs, active rule vectors | `SentinelError::Database` on failure | `V6_SQLITE_SCHEMA.sql:281-334`, `V6_CANONICAL_SPEC.yaml:3588-3660` |
| 14 | Storage Relational | Adapter & Research Tables (`subdomain_assets`, `cloud_assets`, `api_proutes`, `sast_findings`, `symbolic_proofs`, `app_state_machine`, `crypto_weaknesses`) | Auxiliary tables for external adapter tools and feature-flagged research engines. | Tool outputs, state machine hashes, AST findings | Queryable asset and weakness records | `SentinelError::Database` on error | `V6_SQLITE_SCHEMA.sql:339-398`, `V6_CANONICAL_SPEC.yaml:3662-3793` |
| 15 | CAS Blob Store | Content-Addressed SHA-256 Blob Store | Filesystem blob store indexing raw request/response byte streams by SHA-256 hash. Implements path template `<project_root>/blobs/{sha256[0:2]}/{sha256}.blob`. | Raw byte slice `&[u8]` | SHA-256 Hash string / Uuid, blob file path | `SentinelError::Io` on disk error; `SentinelError::InvariantViolation` on hash mismatch (SEC-07) | `V6_CANONICAL_SPEC.yaml:3794`, `V6_FINAL_SECURITY_INVARIANTS.md:55` |
| 16 | CAS Blob Store | Blob Integrity Verification on Read | Reads blob payload from disk and recalculates SHA-256 hash to verify payload has not been tampered with or corrupted on disk. | Blob SHA-256 Hash / ID | `Vec<u8>` raw payload | Returns `SentinelError::InvariantViolation("Blob SHA-256 hash mismatch")` if corrupt | `V6_FINAL_SECURITY_INVARIANTS.md:55-59` |
| 17 | Storage Isolation | Project Filesystem & Database Isolation (SEC-08) | Enforces strict project isolation by partitioning all databases, WAL logs, blobs, and Tantivy indexes into discrete project root directories. | Project Directory Path `PathBuf` | Isolated `StorageManager` instance | Rejects cross-project paths with `SentinelError::Database` / `SentinelError::Io` | `V6_CANONICAL_SPEC.yaml:65`, `V6_FINAL_SECURITY_INVARIANTS.md:64` |
| 18 | Storage Recovery | Crash Recovery & WAL Auto-Checkpointing | Automatically handles uncheckpointed SQLite WAL frames on restart, verifying database consistency and restoring task state. | Database path | Restored clean state | Emits error if database file is corrupt beyond WAL playback | `V6_CANONICAL_SPEC.yaml:94`, `V6_FINAL_IMPLEMENTATION_CONTRACT.md:42` |
| 19 | Storage Search | Tantivy Full-Text Search Integration & Rebuild | Provides BM25 indexing over `tx_id`, `req_method`, `req_uri`, `req_normalized_text`, `res_status`, `res_normalized_text`, `timestamp`. Includes index rebuild from SQLite. | FTS query string, pagination limit/offset | `Vec<Observation>` / Matching Tx IDs | Returns `SentinelError::Tantivy` on query syntax error or index corruption | `V6_CANONICAL_SPEC.yaml:3799`, `V6_COMMON_TYPES.rs:745` |
| 20 | Event Bus | Two-Tier Asynchronous EventBus Trait | Implements the core canonical `pub trait EventBus` supporting both telemetry broadcast and critical mpsc delivery streams. | Event objects (`SentinelEvent`, `CriticalEvent`) | `broadcast::Receiver`, `mpsc::Receiver` | Returns `SentinelError::BusOverflow` on queue saturation | `V6_CANONICAL_SPEC.yaml:1531`, `V6_COMMON_TYPES.rs:772` |
| 21 | Event Bus | Standard Telemetry Broadcast Channel | Fan-out pub/sub channel powered by `tokio::sync::broadcast` with bounded capacity of 10,000 messages for high-throughput, non-blocking telemetry. | `SentinelEvent` | `broadcast::Receiver<SentinelEvent>` | On consumer lag (>10,000 items), slow receivers receive `RecvError::Lagged(n)` while publisher never blocks | `V6_FINAL_EVENT_REGISTRY.md:13-24`, `V6_CANONICAL_SPEC.yaml:2215` |
| 22 | Event Bus | Guaranteed Critical Delivery Channel | Lossless pub/sub channel powered by bounded `tokio::sync::mpsc` with publisher backpressure for security-critical findings and scope violations. | `CriticalEvent` | `mpsc::Receiver<CriticalEvent>` | Backpressures publisher task when full; returns `SentinelError::BusOverflow` if channel closed or unhandled | `V6_FINAL_EVENT_REGISTRY.md:27-36`, `V6_CANONICAL_SPEC.yaml:2220` |
| 23 | Event Bus | Event Envelope & Metadata Registry | Wraps all bus events in a standardized metadata envelope containing Event ID, Timestamp, Topic, Subsystem Source, Correlation ID, and Sequence Number. | Event payload, Subsystem ID, Topic | `EventEnvelope<T>` | Returns `SentinelError` on invalid serialization | `V6_FINAL_EVENT_REGISTRY.md:1-44`, `V6_CANONICAL_SPEC.yaml:2213` |
| 24 | Event Bus | Subscription Topic & Subsystem Filtering | Allows subscriber tasks and UI event listeners to subscribe only to specific topics (e.g. `traffic.*`, `findings.*`, `scan.*`) or subsystem IDs (SUB-01 through SUB-28). | Subscription filter pattern, target channel | Filtered event stream | Discards non-matching events without consumer allocation | `V6_CANONICAL_SPEC.yaml:139`, `V6_IPC_CONTRACTS.proto:183` |
| 25 | Event Bus | Critical Event Acknowledgement & Replay | Durable handling of critical events with unique monotonically increasing sequence IDs, tracking consumer acks, and enabling replay upon reconnect. | Event ID, Ack signal | Replayed unacked events | Emits warning on unacknowledged event timeout | `V6_FINAL_EVENT_REGISTRY.md:43`, `V6_CANONICAL_SPEC.yaml:2224` |
| 26 | Event Bus | UI IPC Stream Mapping (`SentinelUiStream`) | Translates Rust `SentinelEvent` and `CriticalEvent` items into Protobuf `SentinelUiStream` oneof messages for Tauri/React UI consumption. | Rust event enum | Protobuf `SentinelUiStream` message | Returns `SentinelError` on mapping error | `V6_IPC_CONTRACTS.proto:183-194`, `V6_CANONICAL_SPEC.yaml:2549` |
| 27 | Event Bus | Safe Graceful Shutdown & Queue Flushing | Flushes all pending critical events to storage and terminates broadcast channels cleanly when cancellation token is triggered. | `CancellationToken` | Clean shutdown completion | Returns `SentinelError` if flush times out after bounded duration (e.g. 5000ms) | `V6_FINAL_IMPLEMENTATION_CONTRACT.md:123` |

---

## Part 2: Edge Cases & Failure Modes

| # | Feature | Input / Condition | Observed & Documented Behavior |
|---|---------|-------------------|--------------------------------|
| 1 | SQLite Engine | SQLite database file locked by another process during high-frequency concurrent operations | `PRAGMA busy_timeout=5000;` causes connection to sleep and retry for up to 5000ms before returning `SentinelError::Database(sqlx::Error::DatabaseLocked)`. Single-writer queue prevents internal lock contention. |
| 2 | SQLite Schema | Foreign key violation (e.g. inserting `evidence` referencing non-existent `verification_id`) | Because `PRAGMA foreign_keys=ON;` is mandatory, SQLite immediately aborts the insert and returns `SentinelError::Database(ForeignKeyConstraintViolation)`. |
| 3 | SQLite Schema | Parent row deletion on table with `ON DELETE CASCADE` (e.g. deleting `graph_nodes`) | SQLite automatically and atomically cascades deletion to all referencing rows in `graph_edges`, `endpoints`, `parameters`, and `attack_paths`. |
| 4 | SQLite Schema | Parent row deletion on table with `ON DELETE SET NULL` (e.g. deleting `scopes`) | SQLite retains the `observations`, `transactions`, `candidates`, and `findings` records while setting their `scope_id` column to `NULL` to prevent data loss. |
| 5 | CAS Blob Store | Writing zero-byte empty payload | SHA-256 is computed as `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, file created at `<root>/blobs/e3/e3b0c442...blob`, returning valid 0-length blob handle. |
| 6 | CAS Blob Store | Attempting to write a blob that already exists on disk (deduplication) | The system detects existing file at target SHA-256 path, verifies file integrity, skips redundant disk I/O, and returns the existing blob reference ID immediately (idempotent write). |
| 7 | CAS Blob Store | Blob file on disk has been corrupted or modified (bit rot or tampering) | On reading the blob, SHA-256 verification detects mismatch against the blob ID and returns `SentinelError::InvariantViolation("Blob SHA-256 hash mismatch")` without returning corrupted payload to caller. |
| 8 | CAS Blob Store | Concurrent writes of the exact same blob payload | Atomic filesystem write using temporary file and atomic rename (`std::fs::rename`) prevents partial reads or race condition corruptions. |
| 9 | Project Isolation | Attempting to access or write database in a different project's folder | File path normalization checks and isolated repository instances prevent cross-project access (SEC-08). Project A cannot execute SQL or read blobs from Project B. |
| 10 | ObservationStore | Writing a batch of 500 observations with 1 invalid observation causing constraint failure | Entire batch write is executed inside a SQLite `BEGIN TRANSACTION ... COMMIT` block. If one fails, the transaction rolls back cleanly, no partial writes occur, and `SentinelError::Database` is returned. |
| 11 | ObservationStore | Sudden process termination / crash during active write operations | SQLite Write-Ahead Log (WAL) ensures ACID durability. Upon restart, SQLite automatically recovers from the `.db-wal` file. If Tantivy search index was dirty, `rebuild_index()` rebuilds it from SQLite. |
| 12 | Telemetry Broadcast | Slow consumer (e.g. paused UI renderer) lags behind high-throughput proxy traffic (>10,000 events) | `tokio::sync::broadcast` returns `RecvError::Lagged(missed_count)`. The proxy producer continues at full speed (5k-10k req/s) without blocking. Telemetry drops oldest frames safely (SEC-12). |
| 13 | Critical Event Bus | Critical event mpsc queue fills up due to slow disk I/O under heavy scan load | Publisher task yields / awaits asynchronously (`sender.send(event).await`). Zero critical events are dropped. If channel is disconnected, returns `SentinelError::BusOverflow`. |
| 14 | Event Bus Filtering | Subscriber registers filter for `ScopeViolation` but receives `ObservationCreated` | Filter evaluates event header/topic in zero-copy manner and immediately discards the frame before serialization or handler invocation. |
| 15 | IPC Stream | UI subscribes to `SentinelUiStream` over Tauri IPC and client drops connection | Broadcast receiver detects disconnection on next publish attempt, drops subscriber handle, and reclaims memory with zero leaks. |
| 16 | Credential Storage | Developer attempts to insert plaintext password or API key into SQLite table | `credentials` table schema ONLY contains `secret_reference TEXT` (UUID). Plaintext secrets are strictly prohibited (SEC-09). Inserting plaintext fails or triggers invariant violation. |

---

## Part 3: Deep Storage Specification (WP-1.2 `sentinel_storage`)

### 1. SQLite Engine Configuration & Mandatory PRAGMAs

The SQLite database must be initialized on every connection in the pool with the following mandatory PRAGMAs (checked in Step 7 of `validate_v6_spec.py`):

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -64000; -- 64MB cache
PRAGMA temp_store = MEMORY;
```

**PRAGMA Justifications**:
- `journal_mode = WAL`: Enables multi-reader concurrent access while a single background writer persists transactions, achieving the required 5,000 writes/sec target.
- `synchronous = NORMAL`: In WAL mode, `NORMAL` guarantees database integrity against application crashes while reducing disk synchronization overhead.
- `foreign_keys = ON`: Mandatory by architecture contract. Disabling foreign keys is considered a blocker.
- `busy_timeout = 5000`: Prevents immediate failure during short lock transitions by waiting up to 5 seconds.

### 2. Complete Relational Database Schema (32 Tables)

The storage layer must instantiate the complete schema matching `V6_SQLITE_SCHEMA.sql`:

#### Group 1: Core Platform & Scope
1. **`scopes`**:
   - Columns: `id` (TEXT PK), `version` (INTEGER NOT NULL), `timestamp` (DATETIME NOT NULL), `includes_json` (TEXT NOT NULL), `excludes_json` (TEXT NOT NULL).

#### Group 2: Knowledge Graph
2. **`graph_nodes`**:
   - Columns: `id` (TEXT PK), `version` (INTEGER NOT NULL), `timestamp` (DATETIME NOT NULL), `node_type` (TEXT NOT NULL), `label` (TEXT NOT NULL), `metadata_json` (TEXT).
3. **`graph_edges`**:
   - Columns: `id` (TEXT PK), `source_id` (TEXT NOT NULL FK `graph_nodes(id)` ON DELETE CASCADE), `target_id` (TEXT NOT NULL FK `graph_nodes(id)` ON DELETE CASCADE), `edge_type` (TEXT NOT NULL), `timestamp` (DATETIME NOT NULL).
   - Indexes: `idx_graph_edges_source(source_id)`, `idx_graph_edges_target(target_id)`.
4. **`endpoints`**:
   - Columns: `id` (TEXT PK), `host` (TEXT NOT NULL), `path` (TEXT NOT NULL), `method` (TEXT NOT NULL), `timestamp` (DATETIME NOT NULL), `graph_node_id` (TEXT NOT NULL FK `graph_nodes(id)` ON DELETE CASCADE).
   - Indexes: `idx_endpoints_unique(host, path, method)` UNIQUE, `idx_endpoints_graph_node(graph_node_id)`.
5. **`parameters`**:
   - Columns: `id` (TEXT PK), `endpoint_id` (TEXT NOT NULL FK `endpoints(id)` ON DELETE CASCADE), `name` (TEXT NOT NULL), `location` (TEXT NOT NULL), `inferred_type` (TEXT NOT NULL), `timestamp` (DATETIME NOT NULL).
   - Indexes: `idx_parameters_endpoint(endpoint_id)`.

#### Group 3: Observations & Transactions
6. **`observations`**:
   - Columns: `id` (TEXT PK), `version` (INTEGER NOT NULL), `timestamp` (DATETIME NOT NULL), `provenance` (TEXT NOT NULL), `source` (TEXT NOT NULL), `data_ref` (TEXT NOT NULL), `lifecycle` (TEXT NOT NULL), `scope_id` (TEXT FK `scopes(id)` ON DELETE SET NULL).
   - Indexes: `idx_observations_data_ref(data_ref)`, `idx_observations_scope(scope_id)`.
7. **`transactions`**:
   - Columns: `id` (TEXT PK), `timestamp` (DATETIME NOT NULL), `protocol` (TEXT NOT NULL), `stream_id` (INTEGER), `req_method` (TEXT NOT NULL), `req_uri` (TEXT NOT NULL), `req_blob_id` (TEXT NOT NULL), `req_normalized_text` (TEXT NOT NULL), `res_status` (INTEGER), `res_blob_id` (TEXT), `res_normalized_text` (TEXT), `timing_ms` (INTEGER NOT NULL), `tls_cipher` (TEXT), `version` (INTEGER NOT NULL), `provenance` (TEXT NOT NULL), `lifecycle` (TEXT NOT NULL), `scope_id` (TEXT FK `scopes(id)` ON DELETE SET NULL).
   - Indexes: `idx_transactions_uri(req_uri)`, `idx_transactions_scope(scope_id)`.

#### Group 4: Identities, Sessions & Authorization
8. **`identities`**:
   - Columns: `id` (TEXT PK), `version` (INTEGER NOT NULL), `timestamp` (DATETIME NOT NULL), `username` (TEXT NOT NULL), `roles_json` (TEXT NOT NULL).
9. **`sessions`**:
   - Columns: `id` (TEXT PK), `identity_id` (TEXT NOT NULL FK `identities(id)` ON DELETE CASCADE), `cookies_json` (TEXT NOT NULL), `headers_json` (TEXT NOT NULL), `created_at` (DATETIME NOT NULL), `expires_at` (DATETIME).
   - Indexes: `idx_sessions_identity(identity_id)`.
10. **`credentials`**:
    - Columns: `id` (TEXT PK), `identity_id` (TEXT NOT NULL FK `identities(id)` ON DELETE CASCADE), `credential_type` (TEXT NOT NULL), `secret_reference` (TEXT NOT NULL), `access_level` (TEXT NOT NULL), `expires_at` (DATETIME).
    - Indexes: `idx_credentials_identity(identity_id)`.

#### Group 5: Out-of-Band (OAST)
11. **`oast_tokens`**:
    - Columns: `id` (TEXT PK), `token_string` (TEXT NOT NULL UNIQUE), `created_at` (DATETIME NOT NULL), `context_json` (TEXT).
    - Indexes: `idx_oast_tokens_string(token_string)`.
12. **`oast_interactions`**:
    - Columns: `id` (TEXT PK), `token_id` (TEXT NOT NULL FK `oast_tokens(id)` ON DELETE CASCADE), `timestamp` (DATETIME NOT NULL), `protocol` (TEXT NOT NULL), `source_ip` (TEXT NOT NULL), `raw_blob_id` (TEXT NOT NULL).
    - Indexes: `idx_oast_interactions_token(token_id)`.

#### Group 6: Verification Pipeline & Findings
13. **`candidates`**:
    - Columns: `id` (TEXT PK), `timestamp` (DATETIME NOT NULL), `source_observation_id` (TEXT NOT NULL FK `observations(id)` ON DELETE CASCADE), `hypothesis` (TEXT NOT NULL), `status` (TEXT NOT NULL), `version` (INTEGER NOT NULL), `provenance` (TEXT NOT NULL), `lifecycle` (TEXT NOT NULL), `scope_id` (TEXT FK `scopes(id)` ON DELETE SET NULL).
    - Indexes: `idx_candidates_source_obs(source_observation_id)`.
14. **`verifications`**:
    - Columns: `id` (TEXT PK), `candidate_id` (TEXT NOT NULL FK `candidates(id)` ON DELETE CASCADE), `strategy_type` (TEXT NOT NULL), `strategy_version` (TEXT NOT NULL), `success` (BOOLEAN NOT NULL), `confidence` (REAL NOT NULL), `executed_at` (DATETIME NOT NULL), `duration_ms` (INTEGER NOT NULL).
    - Indexes: `idx_verifications_candidate(candidate_id)`.
15. **`evidence`**:
    - Columns: `id` (TEXT PK), `verification_id` (TEXT NOT NULL FK `verifications(id)` ON DELETE CASCADE), `evidence_type` (TEXT NOT NULL), `data_blob_id` (TEXT NOT NULL), `created_at` (DATETIME NOT NULL).
    - Indexes: `idx_evidence_verification(verification_id)`.
16. **`findings`**:
    - Columns: `id` (TEXT PK), `version` (INTEGER NOT NULL), `timestamp` (DATETIME NOT NULL), `title` (TEXT NOT NULL), `severity` (TEXT NOT NULL), `verification_id` (TEXT NOT NULL FK `verifications(id)` ON DELETE CASCADE), `state` (TEXT NOT NULL), `provenance` (TEXT NOT NULL), `lifecycle` (TEXT NOT NULL), `scope_id` (TEXT FK `scopes(id)` ON DELETE SET NULL).
    - Indexes: `idx_findings_verification(verification_id)`, `idx_findings_state_severity(state, severity)`, `idx_findings_scope(scope_id)`.

#### Group 7: Task & Pentester State
17. **`task_checkpoints`**: `task_id` (TEXT PK), `status` (TEXT NOT NULL), `last_updated` (DATETIME NOT NULL), `state_json` (TEXT NOT NULL).
18. **`workflows`**: `id` (TEXT PK), `name` (TEXT NOT NULL), `steps_json` (TEXT NOT NULL), `created_at` (DATETIME NOT NULL).
19. **`reports`**: `id` (TEXT PK), `title` (TEXT NOT NULL), `format` (TEXT NOT NULL), `file_path` (TEXT NOT NULL), `config_json` (TEXT NOT NULL), `generated_at` (DATETIME NOT NULL).
20. **`regression_tests`**: `id` (TEXT PK), `finding_id` (TEXT NOT NULL FK `findings(id)` ON DELETE CASCADE), `seed_transaction_id` (TEXT NOT NULL FK `transactions(id)` ON DELETE CASCADE), `expected_status` (TEXT NOT NULL), `created_at` (DATETIME NOT NULL). Index: `idx_regression_tests_finding(finding_id)`.
21. **`notes`**: `id` (TEXT PK), `target_id` (TEXT NOT NULL), `author` (TEXT NOT NULL), `content` (TEXT NOT NULL), `timestamp` (DATETIME NOT NULL). Index: `idx_notes_target(target_id)`.
22. **`screenshots`**: `id` (TEXT PK), `blob_id` (TEXT NOT NULL), `full_page` (BOOLEAN NOT NULL), `timestamp` (DATETIME NOT NULL).
23. **`attack_paths`**: `id` (TEXT PK), `start_node_id` (TEXT NOT NULL FK `graph_nodes(id)` ON DELETE CASCADE), `target_node_id` (TEXT NOT NULL FK `graph_nodes(id)` ON DELETE CASCADE), `edges_json` (TEXT NOT NULL), `risk_score` (REAL NOT NULL), `discovered_at` (DATETIME NOT NULL). Indexes: `idx_attack_paths_start(start_node_id)`, `idx_attack_paths_target(target_node_id)`.

#### Group 8: Scanner & Proxy Configuration
24. **`scan_configs`**: `id` (TEXT PK), `scope_id` (TEXT NOT NULL FK `scopes(id)` ON DELETE CASCADE), `concurrency_limit` (INTEGER NOT NULL), `active_plugins_json` (TEXT NOT NULL), `timestamp` (DATETIME NOT NULL). Index: `idx_scan_configs_scope(scope_id)`.
25. **`proxy_intercept_rules`**: `id` (TEXT PK), `match_condition` (TEXT NOT NULL), `action` (TEXT NOT NULL), `action_data_json` (TEXT), `is_active` (BOOLEAN NOT NULL DEFAULT 1).

#### Group 9: Adapter Tier Integration
26. **`subdomain_assets`**: `domain` (TEXT PK), `ip_addresses_json` (TEXT NOT NULL), `source` (TEXT NOT NULL), `discovered_at` (DATETIME NOT NULL).
27. **`cloud_assets`**: `arn` (TEXT PK), `service` (TEXT NOT NULL), `region` (TEXT NOT NULL), `discovered_via_credential_id` (TEXT FK `credentials(id)` ON DELETE SET NULL). Index: `idx_cloud_assets_credential(discovered_via_credential_id)`.
28. **`api_proutes`**: `id` (TEXT PK), `path_template` (TEXT NOT NULL), `method` (TEXT NOT NULL), `expected_params_json` (TEXT NOT NULL), `source_spec` (TEXT NOT NULL).
29. **`sast_findings`**: `id` (TEXT PK), `file_path` (TEXT NOT NULL), `line_number` (INTEGER NOT NULL), `snippet` (TEXT NOT NULL), `taint_source` (TEXT NOT NULL).

#### Group 10: Research Tier Analysis
30. **`symbolic_proofs`**: `id` (TEXT PK), `target_variable` (TEXT NOT NULL), `z3_mathematical_proof` (TEXT NOT NULL), `proved_at` (DATETIME NOT NULL).
31. **`app_state_machine`**: `state_hash` (TEXT PK), `url_path` (TEXT NOT NULL), `dom_snapshot_hash` (TEXT NOT NULL), `rl_reward_score` (REAL NOT NULL), `discovered_at` (DATETIME NOT NULL).
32. **`crypto_weaknesses`**: `id` (TEXT PK), `protocol` (TEXT NOT NULL), `weakness_type` (TEXT NOT NULL), `extracted_private_key` (TEXT), `pcap_reference` (TEXT NOT NULL).

### 3. Canonical Repository Trait & Concrete Repositories

The primary storage interface is the canonical `ObservationStore` trait:

```rust
#[async_trait::async_trait]
pub trait ObservationStore: Send + Sync {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError>;
    async fn insert_batch(&self, obs: Vec<Observation>) -> Result<(), SentinelError>;
    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError>;
    async fn query_sql(&self, sql: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn search_fts(&self, query: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn rebuild_index(&self) -> Result<(), SentinelError>;
}
```

In addition, `sentinel_storage` provides specialized repositories for Phase 1 entities:
- **`TransactionRepository`**: Handles high-performance insertion and retrieval of raw network exchanges.
- **`ScopeRepository`**: Handles active and historical scope configurations.
- **`FindingRepository`**: Handles finding lifecycles, verification links, and evidence queries.
- **`AuditRepository`**: Handles append-only audit trail logging.

### 4. Content Addressed Storage (CAS) Blob Store Specification

- **Path Template**: `<project_root>/blobs/{sha256[0:2]}/{sha256}.blob`
- **Addressing Scheme**: Cryptographic SHA-256 hash (hex encoded, 64 characters).
- **Subdirectory Partitioning**: First 2 characters of hex string form a 256-way directory fan-out to prevent OS directory bottlenecking.
- **Immutability Guarantee (SEC-07)**: Once written, blob content is immutable. Modifying bytes violates SHA-256 hash validation upon read.
- **Deduplication**: Identical payloads produce identical hashes; writing an existing payload succeeds immediately without duplicate disk allocation.
- **Atomic Writes**: Blobs are written to a `.tmp` file in the same filesystem and renamed atomically to destination path.

### 5. Strict Project Isolation (SEC-08)

Each security project is mapped to an independent filesystem directory structure:
```
<project_root>/
├── project.db          # Primary SQLite database
├── project.db-wal      # Write-Ahead Log
├── project.db-shm      # Shared memory index
├── blobs/              # CAS Blob Store
│   ├── 00/
│   ├── a1/
│   └── ...
└── indices/            # Tantivy Search Index
```
No database handles or file descriptors may span across distinct `<project_root>` boundaries.

---

## Part 4: Deep Bus Specification (WP-1.3 `sentinel_bus`)

### 1. Two-Tier Asynchronous Pub/Sub Topology

The SENTINEL V6 Event Bus separates high-throughput transient telemetry from security-critical audit events:

```
                      ┌───────────────────────────────────────────────┐
                      │                   EVENT BUS                   │
                      └───────────────────────────────────────────────┘
                                      │               │
                     ┌────────────────┘               └────────────────┐
                     ▼                                                 ▼
        ┌─────────────────────────┐                       ┌─────────────────────────┐
        │   TELEMETRY BROADCAST   │                       │    CRITICAL DELIVERY    │
        │ tokio::sync::broadcast  │                       │   tokio::sync::mpsc     │
        │ Capacity: 10,000        │                       │ Bounded + Backpressure  │
        │ Best-Effort Fan-Out     │                       │ Guaranteed & Audited    │
        └─────────────────────────┘                       └─────────────────────────┘
                     │                                                 │
          ┌──────────┴──────────┐                           ┌──────────┴──────────┐
          ▼                     ▼                           ▼                     ▼
     UI Stream            Task Monitor                ObservationStore      Audit Logger
     (Drop-on-Lag)        (Telemetry)                 (ACID WAL Append)     (Lossless)
```

### 2. Event Registry & Classifications

#### Tier 1: Broadcast Events (`SentinelEvent`)
- **Capacity**: 10,000 items in ring buffer.
- **Lag Policy**: When a subscriber lags behind, `recv()` returns `RecvError::Lagged(missed)`. The publisher never blocks, protecting proxy throughput (SEC-12).
- **Variants**:
  1. `ObservationCreated(Uuid)`: Emitted by `ProxyEngine` (SUB-01). Payload: Observation UUID. IPC: `UiTrafficEvent`.
  2. `ContextDetected(Uuid)`: Emitted by `ContextEngine` (SUB-10). Payload: Endpoint UUID. IPC: `UiContextEvent`.
  3. `CoverageUpdate(Uuid)`: Emitted by `CoverageEngine` (SUB-11). Payload: Scope UUID. IPC: `UiCoverageEvent`.
  4. `ScanProgress(ScanProgressUpdate)`: Emitted by `ScanOrchestrator` (SUB-07). Payload: `ScanProgressUpdate { scan_id, state, progress_pct, checks_completed, timestamp }`. IPC: `UiScanProgressEvent`.
  5. `TaskStatus(TaskStateUpdate)`: Emitted by `TaskScheduler` (SUB-06). Payload: `TaskStateUpdate { task_id, state, progress_pct, error, timestamp }`. IPC: `UiTaskStatusEvent`.

#### Tier 2: Critical Auditable Events (`CriticalEvent`)
- **Capacity**: Bounded mpsc buffer (e.g. 1,000 capacity) with asynchronous publisher yield.
- **Delivery Guarantee**: Lossless. Never silently dropped.
- **Durability Rule**: Appended to SQLite WAL before dispatch confirmation.
- **Variants**:
  1. `FindingCreated(Uuid)`: Emitted by `VerificationEngine` (SUB-09). Payload: Finding UUID. IPC: `UiFindingEvent`.
  2. `CandidateVerified(Uuid)`: Emitted by `VerificationEngine` (SUB-09). Payload: Candidate UUID. IPC: `UiCandidateVerifiedEvent`.
  3. `ScopeViolationAttempt { source: String, target: String, decision: ScopeDecision }`: Emitted by `ProxyEngine` (SUB-01) and `ScopeEngine` (SUB-04). Payload: `ScopeViolationAttempt`. IPC: `UiScopeViolationEvent`.

### 3. Canonical EventBus Trait

```rust
#[async_trait::async_trait]
pub trait EventBus: Send + Sync {
    fn subscribe_telemetry(&self) -> tokio::sync::broadcast::Receiver<SentinelEvent>;
    fn subscribe_critical(&self) -> tokio::sync::mpsc::Receiver<CriticalEvent>;
    fn publish_telemetry(&self, event: SentinelEvent) -> Result<(), SentinelError>;
    fn publish_critical(&self, event: CriticalEvent) -> Result<(), SentinelError>;
}
```

### 4. Event Envelope & Subscription Filtering

For cross-subsystem routing, replay, and IPC dispatch, all events are wrapped in an `EventEnvelope`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope<T> {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub topic: String,
    pub subsystem: String,
    pub payload: T,
    pub trace_id: Option<Uuid>,
    pub sequence_number: u64,
}
```

**Subscription Filters**:
- **Topic Filters**: Subscriptions by exact topic string or prefix glob (`traffic.*`, `findings.*`, `scan.*`).
- **Subsystem Filters**: Filter by emitter ID (`SUB-01`, `SUB-04`, `SUB-09`).
- **Backpressure Controller**: Yields caller when mpsc queue reaches threshold and monitors telemetry lag metrics.

---

## Part 5: Target Crate Structures & Dependencies

### 1. `sentinel_storage` (`crates/sentinel_storage`)

#### `Cargo.toml`
```toml
[package]
name = "sentinel_storage"
version = "0.1.0"
edition = "2021"

[dependencies]
sentinel_common = { path = "../sentinel_common" }
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio", "chrono", "uuid", "macros", "migrate"] }
tokio = { version = "1", features = ["full"] }
sha2 = "0.10"
hex = "0.4"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
async-trait = "0.1"
tracing = "0.1"
tantivy = { version = "0.22", optional = true }

[dev-dependencies]
tempfile = "3.10"
```

#### Module Layout
```
crates/sentinel_storage/
├── Cargo.toml
├── migrations/
│   └── 20260817000000_v6_schema.sql
├── src/
│   ├── lib.rs              # Crate root, re-exports StorageManager
│   ├── db.rs               # SqlitePool setup, PRAGMA enforcement
│   ├── migrations.rs       # Migration runner
│   ├── cas.rs              # SHA-256 CAS BlobStore implementation
│   ├── isolation.rs        # Project directory boundary enforcement
│   ├── store.rs            # ObservationStore trait implementation & write queue
│   ├── repositories/
│   │   ├── mod.rs
│   │   ├── scopes.rs       # ScopeRepository
│   │   ├── transactions.rs # TransactionRepository
│   │   ├── observations.rs # ObservationRepository
│   │   ├── findings.rs     # Finding & Evidence Repository
│   │   ├── tasks.rs        # TaskCheckpointRepository
│   │   └── audit.rs        # AuditLogRepository
│   └── search.rs           # Tantivy BM25 full text search & index rebuild
└── tests/
    ├── pragma_tests.rs     # Verify WAL, foreign keys, synchronous
    ├── migration_tests.rs  # Verify 32 tables creation & rollback
    ├── cas_integrity_tests.rs # Verify SHA-256 hashing & corruption rejection
    ├── isolation_tests.rs  # Verify cross-project isolation
    └── recovery_tests.rs   # Verify crash recovery & restart
```

---

### 2. `sentinel_bus` (`crates/sentinel_bus`)

#### `Cargo.toml`
```toml
[package]
name = "sentinel_bus"
version = "0.1.0"
edition = "2021"

[dependencies]
sentinel_common = { path = "../sentinel_common" }
tokio = { version = "1", features = ["sync", "rt", "macros", "time"] }
tokio-util = "0.7"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
async-trait = "0.1"
tracing = "0.1"

[dev-dependencies]
tempfile = "3.10"
```

#### Module Layout
```
crates/sentinel_bus/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Crate root, re-exports SentinelEventBus
│   ├── bus.rs              # EventBus trait implementation
│   ├── broadcast.rs        # Telemetry broadcast channel (10k buffer)
│   ├── critical.rs         # Critical mpsc channel with backpressure
│   ├── envelope.rs         # EventEnvelope, EventId, Topic types
│   ├── filter.rs           # Subscription topic/subsystem filters
│   └── ipc.rs              # Mapping to UI IPC event models
└── tests/
    ├── broadcast_tests.rs  # Verify fanout and drop-on-lag behavior
    ├── critical_tests.rs   # Verify lossless backpressure delivery
    ├── filter_tests.rs     # Verify topic and subsystem filtering
    └── shutdown_tests.rs   # Verify graceful queue flush on shutdown
```

---

## Part 6: Cross-Crate Security Integration Contract (WP-1.2 & WP-1.3)

In Phase 1, the mandatory integration path connecting `sentinel_scope`, `sentinel_bus`, and `sentinel_storage` must enforce:

```
[Target Request] 
      │
      ▼
[ScopeEngine (sentinel_scope)] ─── If Denied ───> ScopeDecision(allowed: false)
                                                         │
                                                         ▼
[EventBus (sentinel_bus)] <─── publish_critical(ScopeViolationAttempt)
      │
      ▼
[ObservationStore (sentinel_storage)] ───> Persist ScopeViolation to SQLite WAL
                                                         │
                                                         ▼
                                            Queryable Audit Trail Verified
```

This ensures that out-of-scope interactions are blocked fail-closed, emit critical auditable events, and are persistently recorded without possibility of silent loss.

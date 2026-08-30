# SENTINEL V6 — FINAL IMPLEMENTATION CONTRACT

> **DATE**: 2026-08-17 (Remediation Cycle 2)  
> **SCOPE**: Core Subsystems Interface and Guarantee Definition

For every implementation-critical subsystem, this contract defines the exact boundaries, interfaces, and guarantees. **Implementation teams may not deviate from these guarantees without an architecture review.**

---

## 1. ProxyEngine

**Purpose**: Intercept, capture, and optionally modify HTTP traffic.  
**Interface**: `pub trait ProxyEngine` (defined in V6_COMMON_TYPES.rs)  
**Events**: Publishes `ObservationCreated`, `InterceptHit`. Subscribes to `ScopeUpdated`.  
**Errors**: `TlsError`, `ParseError` (non-fatal, connection drops), `ScopeViolation` (fatal to connection).  
**Security**: Evaluates `ScopeEngine.is_in_scope()` for every outgoing request. Untrusted network input bound to 10MB allocations.  
**Resource Limits**: Max 10k concurrent connections.  
**Tests**: Fuzzing with malformed HTTP/TLS. Differential testing against hyper.  
**Acceptance Criteria**: 5k req/sec sustained throughput. Zero byte loss on pass-through.

## 2. HTTPParser

**Purpose**: Byte-perfect HTTP parsing that tolerates malformed data.  
**Interface**: `pub trait HttpParser`  
**Events**: None (Synchronous).  
**Errors**: `ParseError` (only for completely unrecoverable bytes, e.g., missing HTTP version).  
**Security**: Defends against request smuggling. Prevents ReDoS during header parsing.  
**Resource Limits**: Max header size 1MB. Max body size 50MB (streamed).  
**Tests**: Property-based tests verifying `serialize(parse(raw)) == raw`.  
**Acceptance Criteria**: Zero panics. Byte fidelity is 100% on valid HTTP.

## 3. ObservationStore

**Purpose**: Persistent storage for all traffic and findings.  
**Interface**: `pub trait ObservationStore`  
**Events**: Publishes `ObservationStored`.  
**Errors**: `DatabaseError`, `TantivyError`, `DiskFull`.  
**Concurrency**: Single async writer thread (mpsc queue). Multiple concurrent readers.  
**Security**: Credentials and tokens encrypted at rest (AES-256-GCM).  
**Resource Limits**: Batches writes (max 500/batch).  
**Tests**: Power-loss simulation (kill -9 during write).  
**Acceptance Criteria**: 5k writes/sec. SQLite WAL recovery works automatically on restart.

## 4. ScopeEngine

**Purpose**: Failsafe authorization for all outbound interactions.  
**Interface**: `pub trait ScopeEngine`  
**Events**: Publishes `ScopeUpdated`.  
**Errors**: `InvalidRegex`.  
**Concurrency**: Lock-free reads (Arc<RwLock> optimized for read-heavy workload).  
**Security**: Fails closed. If regex times out, request is BLOCKED.  
**Resource Limits**: Regex execution timeout 100ms. Max 1000 chars per regex.  
**Tests**: ReDoS payloads against user-supplied scope regex.  
**Acceptance Criteria**: <1ms evaluation time. 0 bypasses.

## 5. ScanOrchestrator

**Purpose**: Manages state machine for active scanning.  
**Interface**: `pub trait ScanOrchestrator`  
**Events**: Publishes `ScanProgress`, `ScanStatusChanged`. Subscribes to `TaskCompleted`.  
**Errors**: `InvalidConfig`, `BudgetExceeded`.  
**Security**: Scope enforced before task generation.  
**Resource Limits**: Max concurrent active scans: 10. Max tasks per scan: 1,000,000.  
**Tests**: Pause/resume/cancel state transitions.  
**Acceptance Criteria**: Scan pauses gracefully within 2 seconds of command. Resumes without duplicate requests.

## 6. FuzzerEngine

**Purpose**: Generates mutated requests for active testing.  
**Interface**: `pub trait FuzzerEngine`  
**Events**: Publishes `FuzzingProgress`.  
**Errors**: `DictionaryNotFound`.  
**Concurrency**: Rayon thread pool for mutation generation.  
**Security**: Generates safe (non-destructive) payloads by default unless overridden.  
**Resource Limits**: Wordlist loads bounded by available RAM (streaming for >1GB files).  
**Tests**: Seed determinism (same seed = same mutations).  
**Acceptance Criteria**: >15k simple mutations per second.

## 7. VerificationEngine

**Purpose**: Confirms vulnerabilities to eliminate false positives.  
**Interface**: `pub trait VerificationEngine`  
**Events**: Publishes `CandidateVerified`. Subscribes to `OastCallback`.  
**Errors**: `VerificationTimeout`, `StrategyUnavailable`.  
**Security**: Executes exploits safely (e.g., safe SQL injection payloads that don't drop tables).  
**Resource Limits**: Verification timeouts (default 10s per candidate).  
**Tests**: End-to-end verification against known vulnerable targets.  
**Acceptance Criteria**: <1% false positive rate for verified findings. Every finding includes proof.

## 8. IdentityManager

**Purpose**: Manages auth states and session injection.  
**Interface**: `pub trait IdentityManager`  
**Events**: Publishes `IdentityStateChanged`.  
**Errors**: `TokenExpired`, `EncryptionFailed`.  
**Security**: Vault uses OS keychain (Windows Credential Manager / macOS Keychain / Secret Service) for master key.  
**Resource Limits**: Max 1000 identities per project.  
**Tests**: Token auto-refresh logic.  
**Acceptance Criteria**: Correctly injects tokens into 100% of specified requests.

## 9. ContextEngine

**Purpose**: Extracts metadata (headers, tech stack) from traffic.  
**Interface**: `pub trait ContextEngine`  
**Events**: Publishes `ContextDetected`.  
**Errors**: None.  
**Concurrency**: Stateless mapping.  
**Security**: Regex limits (ReDoS protection on headers/body matching).  
**Resource Limits**: Skips body analysis for bodies > 5MB.  
**Tests**: Accuracy tests against common technology stacks (WordPress, React, IIS, etc.).  
**Acceptance Criteria**: 90% accuracy for top 50 web technologies.

## 10. EventBus

**Purpose**: Message routing between subsystems.  
**Interface**: `pub trait EventBus`  
**Events**: N/A (Carrier of events).  
**Errors**: `BusOverflow`.  
**Concurrency**: Lock-free channel operations.  
**Security**: In-memory only (local mode).  
**Resource Limits**: Broadcast channel capacity: 10,000. Critical mpsc channel: unbounded (with backpressure).  
**Tests**: High-throughput message dropping (verify drop-on-lag works).  
**Acceptance Criteria**: <1ms latency. Critical events (Findings, Scope) are never dropped.

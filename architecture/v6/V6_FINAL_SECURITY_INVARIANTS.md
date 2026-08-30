# SENTINEL V6 — FINAL SECURITY INVARIANTS

> **DATE**: 2026-08-17  
> **STATUS**: AUTHORITATIVE — 100% SYNCHRONIZED  
> **CANONICAL SPEC**: `V6_CANONICAL_SPEC.yaml` § 8 (Security Invariants)

The SENTINEL V6 architecture is secured by 12 non-negotiable security invariants (SEC-01 through SEC-12). Conformance is verified automatically by `validate_v6_spec.py`.

---

## 1. Network Boundary Invariants

### SEC-01: Scope Authorization (Default Deny)
- **Statement**: Every active and passive outbound network interaction MUST obtain an explicit `ScopeDecision` from `ScopeEngine` prior to socket connection.
- **Enforcement Layer**: `ProxyEngine` (SUB-01), `ScanOrchestrator` (SUB-07).
- **Verification Test**: Out-of-scope targets trigger immediate `SentinelError::ScopeViolation` and `UiScopeViolationEvent`.

### SEC-02: OAST Token Confidentiality (AES-256)
- **Statement**: Out-of-band tokens MUST use AES-256 encrypted payloads. No plaintext project, target, or user identifiers may exist in DNS/HTTP queries.
- **Enforcement Layer**: `OastServer` (SUB-16).
- **Verification Test**: Token payloads decoded without secret key yield only cryptographically random bytes.

---

## 2. Artificial Intelligence Safety Invariants

### SEC-03: Host-Side AI Policy Gate
- **Statement**: Target content and LLM outputs are treated as untrusted. AI actions MUST pass host-side policy evaluation in `AiPolicyEngine` before test payload execution.
- **Enforcement Layer**: `AiPolicyEngine` (SUB-19).
- **Verification Test**: Destructive SQL/OS commands and prompt injections are blocked prior to fuzzer injection.

---

## 3. Extensibility & Research Isolation Invariants

### SEC-04: WASM Capability Drop
- **Statement**: Plugin execution defaults to zero capabilities (no network, filesystem, secrets, or database access). Capabilities must be explicitly granted by the user.
- **Enforcement Layer**: `PluginRuntime` (SUB-20).
- **Verification Test**: WASM sandbox syscalls for unauthorized resources fail with `SandboxViolation`.

### SEC-05: Research Module Optionality
- **Statement**: Research tier modules (`SmtSolverEngine`, `RlStateEngine`, `CryptoAnalysisEngine`) are isolated behind `sentinel-research` feature flags. Core platform compiles and operates independently.
- **Enforcement Layer**: Cargo workspace feature gating (`sentinel-research`).
- **Verification Test**: Clean build and test execution without `--features sentinel-research`.

---

## 4. Evidence Integrity & Finding Proof Invariants

### SEC-06: Finding Proof Requirement
- **Statement**: No vulnerability finding may be transitioned to `Verified` or `Confirmed` state without empirical `Evidence` produced by `VerificationEngine`.
- **Enforcement Layer**: `VerificationEngine` (SUB-09), `ObservationStore` (SUB-03).
- **Verification Test**: Candidate with false verification result cannot produce a Finding record.

### SEC-07: Evidence Immutability (SHA-256 Blob Store)
- **Statement**: All raw transaction payloads and evidence artifacts are stored in a content-addressed SHA-256 blob store and are immutable once written.
- **Enforcement Layer**: `ObservationStore` (SUB-03).
- **Verification Test**: Modified blob payloads fail SHA-256 hash verification.

---

## 5. Architectural & System Invariants

### SEC-08: Cross-Tenant Project Isolation
- **Statement**: Projects are physically partitioned across separate SQLite databases and directories. Zero cross-project data leakage.
- **Enforcement Layer**: `ObservationStore` (SUB-03).
- **Verification Test**: Project A session cannot query or access Project B database path.

### SEC-09: Zero Plaintext Secrets
- **Statement**: Authentication credentials use `SecretReference` indirection pointing to secure OS Keychain or encrypted vault. Zero plaintext secrets in database, logs, or events.
- **Enforcement Layer**: `IdentityManager` (SUB-12).
- **Verification Test**: SQLite `credentials` table and serialized events contain only UUID references.

### SEC-10: Triple Representation
- **Statement**: All network traffic retains raw bytes, parsed structure, and normalized text. Raw bytes are never discarded or irreversibly normalized.
- **Enforcement Layer**: `HttpParser` (SUB-02), `ProxyEngine` (SUB-01).
- **Verification Test**: Request smuggling and raw delimiter anomalies are preserved across serialization rounds.

### SEC-11: WebView Sandbox Isolation
- **Statement**: UI rendering layer enforces strict Content Security Policy (CSP) and iframe sandboxing. Browser automation runs in out-of-process daemon.
- **Enforcement Layer**: `BrowserService` (SUB-15), Tauri frontend.
- **Verification Test**: Injected script tags in observation text execute as raw strings, preventing Stored XSS.

### SEC-12: Bounded Buffer Backpressure
- **Statement**: EventBus and message queues enforce fixed maximum capacities with defined overflow policies. Critical events never drop; telemetry drops with backpressure warnings.
- **Enforcement Layer**: `EventBus` (SUB-05).
- **Verification Test**: High-throughput bursts trigger bounded drop for telemetry and blocking queue for critical events.

# Subsystem C: Multi-Role AuthZ Matrix & Sandboxed Plugin Runtime — Architectural Analysis & Implementation Plan

**Crates in Scope**: `sentinel_authz` (SUB-17), `sentinel_plugin` (SUB-20, SUB-21)  
**Milestone**: M4 (Phase 2 — Real Subsystem Capabilities)  
**Security Invariants**: SEC-01 (Scope Gate), SEC-04 (WASM Capability Drop), SEC-06 (Finding Proof), SEC-07 (CAS Immutability), SEC-09 (Zero Plaintext Secrets)  
**Author**: `explorer_phase2_authz_plugins` (Teamwork Explorer)  
**Status**: COMPLETE / AUTHORITATIVE  

---

## 1. Observation

### 1.1 Codebase Inspection: `sentinel_authz`

- **Location**: `sentinel_core/crates/sentinel_authz/`
- **Dependencies (`Cargo.toml:8-28`)**:
  - Internal: `sentinel_common`, `sentinel_storage`, `sentinel_bus`, `sentinel_scope`, `sentinel_auth`.
  - External: `chrono`, `serde`, `serde_json`, `uuid`, `thiserror`, `async-trait`, `parking_lot`, `sqlx`, `tokio`, `tracing`, `regex`, `sha2`, `hex`.
- **Existing Files & Implementation State**:
  - `src/lib.rs:1-15`: Exposes `DefaultAuthorizationEngine`, `AutorizeDifferentialEngine`, `DifferentialProbeResult`, `DifferentialFinding`, `MatrixEvaluator`.
  - `src/matrix.rs:22-31`: Defines `DifferentialProbeResult` containing raw status codes and byte lengths (`high_priv_status`, `low_priv_status`, `anon_status`, body lengths).
  - `src/matrix.rs:43-89`: `AutorizeDifferentialEngine::evaluate_differential` implements naive body-length similarity (`sim = 1.0 - diff / max_len`) and basic status code checks (200 vs 200).
  - `src/matrix.rs:94-116`: `MatrixEvaluator::generate_default_matrix` generates mock endpoints with hardcoded modulo-4 access levels.
  - `src/engine.rs:48-93`: `DefaultAuthorizationEngine` generates mock endpoints and checks matrix violations via SQLite queries and `CriticalEvent::FindingCreated`.
  - `tests/authz_tests.rs:1-112`: 3 tests (`test_authz_matrix_generation_and_evaluation`, `test_authz_engine_execution`, `test_autorize_live_differential_evaluator`).

#### Identified Gaps in `sentinel_authz`:
1. **Lack of Multi-Role Auto-Replay Matrix Grid**: Currently only models 3 hardcoded roles in probe results without automated replay dispatch across the 4 canonical roles (`Admin`, `User`, `Guest`, `Attacker` / `CrossTenant`).
2. **Missing IDOR / BOLA AST Parameter Discovery & Substitution**: No AST parser to locate and swap path parameters (`/api/v1/invoices/{id}`), query parameters (`?account_id=123`), JSON request body fields (`{"userId": "usr_1"}`), GraphQL variables, or header identifiers.
3. **Missing Shannon Entropy Volatile Token Masking**: Dynamic response fields (timestamps, CSRF nonces, session hashes, random UUIDs) cause naive length/string diffs to produce false positives and false negatives without entropy-based token masking ($H \ge 3.8$).
4. **Naive BFLA Privilege Divergence**: Current differential evaluator uses length delta rather than structured JSON key-path Jaccard similarity ($\tau_{\text{sim}} \ge 0.85$), DOM structural tag similarity, and Read-After-Write state mutation verification.
5. **No Integration with `sentinel_auth::vault` (SEC-09)**: Does not resolve credentials via `SecretReference` UUID indirection or synchronize anti-CSRF tokens for replayed POST/PUT requests.

---

### 1.2 Codebase Inspection: `sentinel_plugin`

- **Location**: `sentinel_core/crates/sentinel_plugin/`
- **Dependencies (`Cargo.toml:8-24`)**:
  - Internal: `sentinel_common`, `sentinel_storage`, `sentinel_bus`.
  - External: `chrono`, `serde`, `serde_json`, `uuid`, `thiserror`, `async-trait`, `parking_lot`, `tokio`, `tracing`, `sha2`, `hex`.
  - **Missing Dependencies**: `wasmtime` (for WebAssembly execution), `ed25519-dalek` (for Ed25519 asymmetric signature verification), `zeroize` (for secret handling).
- **Existing Files & Implementation State**:
  - `src/lib.rs:1-18`: Exposes `DefaultPluginRuntime`, `DefaultResearchPackManager`, `EnterpriseTrustStore`, `ResearchPackVerifier`.
  - `src/runtime.rs:44-124`: `DefaultPluginRuntime` only verifies the 4-byte WASM magic header (`\0asm\x01\0\0\0`) and returns a static string `"WASM executed successfully"`. It contains no real WebAssembly execution engine.
  - `src/manager.rs:58-120`: `DefaultResearchPackManager` registers packs using HMAC-SHA256 symmetric signing with a single hardcoded secret.
  - `src/research_pack.rs:134-237`: `ResearchPackVerifier` uses symmetric HMAC-SHA256 (RFC 2104) rather than asymmetric Ed25519 public-key signatures.
  - `tests/plugin_tests.rs`, `tests/research_pack_tests.rs`: Tests exercise mock WASM header validation and HMAC-SHA256 signing.

#### Identified Gaps in `sentinel_plugin`:
1. **No Real Wasmtime Engine (SEC-04 Zero-Capability Violation)**: Plugins are not executed in an isolated WebAssembly sandbox.
2. **Missing WIT (WebAssembly Interface Types) Contract**: No typed guest/host boundary (`analyze-request`, `analyze-response`, `fingerprint`) with host capability dropping.
3. **No Fuel Metering & Memory Bounding**: Plugins cannot be instruction-metered (infinite loop / ReDoS risk) or bounded in physical memory (<50MB per instance).
4. **Symmetric HMAC instead of Asymmetric Ed25519 Signatures**: Research packs rely on shared secret keys rather than asymmetric public-key cryptography.
5. **Missing Key Revocation List (KRL)**: Trust store has basic in-memory revocation flags but lacks a formal cryptographically signed KRL specification with serial numbers, revocation timestamps, and reason codes.

---

## 2. Logic Chain

### 2.1 Multi-Role IRA+ Authorization Matrix (`sentinel_authz`)

```
Captured Request (Role: Admin / User A, Target Object: Obj_A)
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│   AST PARAMETER EXTRACTION & OBJECT IDENTIFIER DISCOVERY │
│   - URL Path: /api/v1/workspaces/{ws_id}/docs/{doc_id}   │
│   - Query Params: ?account=10928&tenant=t_01             │
│   - JSON Body: {"userId": "usr_44", "roleId": 2}         │
│   - Headers: X-Tenant-Id: t_01                           │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│              4-WAY MULTI-ROLE REPLAY GRID                │
│ 1. Admin Role        (Baseline / High Privilege)         │
│ 2. User Role         (Low Privilege - Same Tenant)       │
│ 3. Attacker Role     (Cross-Tenant / Different User)     │
│ 4. Guest Role        (Unauthenticated Anonymous)         │
│                                                          │
│ * Credential Resolution: SecretReference(Uuid) -> Vault  │
│ * CSRF Sync: Auto-extract token from latest session resp │
└───────────────────────────┬──────────────────────────────┘
                            │ (4 Parallel Replay Responses)
                            ▼
┌──────────────────────────────────────────────────────────┐
│       SHANNON ENTROPY & VOLATILE FIELD MASKING           │
│ - Compute H(X) for all string leaf nodes                 │
│ - If H(X) >= 3.8 or matches UUID/Timestamp regex:        │
│   Replace value with {{VOLATILE_TOKEN}}                  │
│ - Sort JSON keys deterministically                       │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│        BFLA / BOLA PRIVILEGE DIVERGENCE ORACLE           │
│ - Status Code Differential: 200 OK vs 401/403/404        │
│ - Key-Set Jaccard Similarity: J(K_base, K_probe) >= 0.85 │
│ - Semantic Response Body Divergence Score                │
│ - Read-After-Write Verification Probe for State Mutation │
└───────────────────────────┬──────────────────────────────┘
                            │ (Confirmed Access Anomaly)
                            ▼
┌──────────────────────────────────────────────────────────┐
│            CAS EVIDENCE CREATION (SEC-06 / SEC-07)       │
│   Triangulated Evidence: Baseline + Probe + Diff -> CAS  │
└──────────────────────────────────────────────────────────┘
```

#### Step 1: Multi-Role Auto-Replay Permutation Grid
The IRA+ engine executes 4 canonical roles for every captured transaction:
1. **Admin (`PrivilegeRole::Admin`)**: High-privilege baseline asserting authorized function/object access.
2. **User (`PrivilegeRole::User`)**: Standard authenticated member within the same tenant context (detects BFLA privilege escalation when attempting Admin endpoints).
3. **Attacker (`PrivilegeRole::Attacker` / `CrossTenantUser`)**: Authenticated user belonging to an isolated tenant/organization (detects BOLA / IDOR cross-tenant leakage).
4. **Guest (`PrivilegeRole::Guest` / `Anonymous`)**: Unauthenticated request with zero credentials (detects complete authentication bypass).

**Session & Credential Injection Pipeline**:
- Uses `SecretReference(Uuid)` from `sentinel_auth::vault` (SEC-09) to inject cookies and `Authorization` headers immediately before socket transmission.
- Automatically extracts and updates dynamic anti-CSRF tokens (`X-CSRF-Token`, `_csrf`, `authenticity_token`) per role session to prevent false authorization rejections.

#### Step 2: AST-Based IDOR / BOLA Parameter Discovery & Substitution
The parameter substitution engine parses the baseline HTTP request AST:
- **URL Path**: Tokenizes segments (`/api/v1/users/usr_1092/invoices/inv_8821`), identifies dynamic entity identifiers (UUID, integer, slug), and substitutes target user identifiers with attacker user identifiers (`usr_1092` $\rightarrow$ `usr_9999`).
- **Query Parameters**: Parses query strings via URL decoder, locates key matches (`id`, `user_id`, `account_id`, `org_id`, `doc_id`, `uuid`), and rewrites values.
- **JSON Request Body**: Recursively navigates `serde_json::Value` AST tree, matches identifier keys, and performs in-place AST node replacement without corrupting body encoding or whitespace.
- **GraphQL Variables**: Parses GraphQL query variable AST maps (`{"variables": {"userId": "usr_1092"}}`), replacing identifier variables.
- **Headers**: Rewrites tenant context headers (`X-Tenant-ID`, `X-Account-ID`, `X-Org-ID`).

#### Step 3: Shannon Entropy Volatile Token Masking
To prevent dynamic values (nonces, timestamps, hashes, session IDs) from distorting similarity comparisons:
- **Shannon Entropy Calculation**:
  $$H(X) = -\sum_{i=1}^n P(x_i) \log_2 P(x_i)$$
  where $x_i$ represents character frequencies in string $X$.
- **Entropy Masking Rule**:
  1. For every string value in the response AST, if $H(X) \ge 3.8$ (indicating high-entropy random tokens, hashes, encrypted ciphertexts) or if the value matches ISO-8601 timestamps / UUID v4 regexes:
  2. Replace the value with a deterministic placeholder string `"{{VOLATILE_TOKEN}}"`.
- **Structural Normalization**: Sorts all dictionary/map keys lexicographically.

#### Step 4: BFLA & Privilege Divergence Detection Oracles
Let $R_{\text{base}}$ be the Admin/Baseline response and $R_{\text{probe}}$ be the Replay response.
1. **Status Code Matrix**:
   - $R_{\text{probe}} \in \{401, 403, 404\}$ $\rightarrow$ **Safe (Enforced Deny)**.
   - $R_{\text{base}} = 200 \land R_{\text{probe}} = 200$ $\rightarrow$ Proceed to AST Semantic Comparison.
2. **Key-Set Jaccard Structural Similarity**:
   $$\mathcal{J}(K_{\text{base}}, K_{\text{probe}}) = \frac{|K_{\text{base}} \cap K_{\text{probe}}|}{|K_{\text{base}} \cup K_{\text{probe}}|}$$
   - If $\mathcal{J}(K_{\text{base}}, K_{\text{probe}}) \ge 0.85$: Flagged as **Confirmed BFLA / BOLA Vulnerability**.
   - If $\mathcal{J}(K_{\text{base}}, K_{\text{probe}}) < 0.40$ (e.g. custom JSON error payload `{"error": "Forbidden"}` returned with HTTP 200): Classified as **Application-Level Deny (Safe)**.
3. **Read-After-Write Confirmation Oracle**:
   - For state-modifying requests (`POST`, `PUT`, `DELETE`), if the unauthorized role receives $200\text{ OK}$, the engine issues a subsequent `GET` probe as the resource owner to verify whether the unauthorized modification actually persisted.

---

### 2.2 Sandboxed Plugin Runtime & Research Packs (`sentinel_plugin`)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        WASM PLUGIN EXECUTION PIPELINE (SEC-04)                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Plugin Binary (.wasm)                                                                 │
│         │                                                                              │
│         ▼                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Wasmtime Engine (Fuel Metering + ResourceLimiter Configured)                     │  │
│  │ - Fuel Limit: 100,000,000 instructions per execution                             │  │
│  │ - Memory Limit: < 50MB (StoreLimits::memory_size = 50 * 1024 * 1024)            │  │
│  │ - Capability Drop: network=false, fs=false, secrets=false, db=false, browser=false│  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│                                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ WIT Guest/Host Boundary (`sentinel-plugin.wit`)                                  │  │
│  │ - Guest Exports: execute-check(req, res) -> CheckResult                          │  │
│  │ - Host Imports: log(level, msg), get-header(name)                                │  │
│  │ - Zero Ambient System Calls (WASI filesystem/socket stubs blocked)               │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│                                             ▼ (Deterministic Execution Output)         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Result Normalization & Memory Zeroization                                        │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Step 5: Wasmtime WIT Zero-Capability Runtime (SEC-04)
- **Zero-Capability Sandbox**: The plugin runtime uses `wasmtime` with an explicit default-deny capability model. Plugins have no access to host filesystem, raw sockets, process execution, environment variables, or secrets.
- **WIT (WebAssembly Interface Type) Contract (`sentinel-plugin.wit`)**:
  ```wit
  package sentinel:plugin@0.1.0;

  interface types {
      enum severity {
          info,
          low,
          medium,
          high,
          critical
      }

      record http-request {
          method: string,
          uri: string,
          headers: list<tuple<string, string>>,
          body: list<u8>,
      }

      record http-response {
          status: u16,
          headers: list<tuple<string, string>>,
          body: list<u8>,
      }

      record check-result {
          matched: bool,
          check-id: string,
          name: string,
          severity: severity,
          confidence: float32,
          description: string,
          evidence-payload: list<u8>,
      }
  }

  world security-plugin {
      import log: func(level: string, message: string);
      export analyze-transaction: func(req: types.http-request, res: types.http-response) -> list<types.check-result>;
  }
  ```
- **Host Call Isolation**: The host exports only pure functions (logging, read-only payload querying) into the guest WASM instance.

#### Step 6: Fuel Metering & Memory Bounding (<50MB)
- **Instruction Fuel Metering**:
  - `wasmtime::Config::consume_fuel(true)` enabled on the engine.
  - Every plugin execution initializes its `Store` with a fixed fuel budget ($F_{\text{limit}} = 100,000,000$ instructions).
  - If a plugin contains an infinite loop or excessive CPU computation, Wasmtime terminates execution with `SentinelError::SandboxViolation("WASM fuel exhausted")`.
- **Physical Memory Bounding (<50MB)**:
  - Configures `StoreLimitsBuilder::new().memory_size(50 * 1024 * 1024).instances(1).tables(10000).build()`.
  - Capped at a maximum of 800 WebAssembly memory pages (each page = 64KB, $800 \times 64\text{KB} = 51.2\text{MB}$).
  - Attempts to grow memory beyond 50MB trigger an immediate out-of-memory trap.
- **Execution Watchdog**: Tokio timeout wrapper enforces a hard 5000ms wall-clock execution limit per plugin invocation.

#### Step 7: Ed25519 Cryptographic Verification & Key Revocation List (KRL)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             ED25519 RESEARCH PACK VERIFICATION & KRL REVOCATION PIPELINE               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Research Pack Archive (.spk / JSON)                                                   │
│         │                                                                              │
│         ▼                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Canonical Digest Calculation (SHA-256)                                           │  │
│  │ digest = SHA256(pack_id : version : SHA256(checks_json) : SHA256(dicts_json))    │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │                                          │
│                                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Enterprise Trust Store & KRL Check                                               │  │
│  │ 1. Match public key ID (`key_id`) in TrustAnchor registry                        │  │
│  │ 2. Check Key Revocation List (KRL):                                              │  │
│  │    - Is key_id in revoked_keys?                                                  │  │
│  │    - Is signature serial revoked?                                                │  │
│  │    - If REVOKED -> Immediate Fail-Closed Rejection (ERR_INT_017)                 │  │
│  └──────────────────────────────────────────┬───────────────────────────────────────┘  │
│                                             │ (Active Public Key Verified)             │
│                                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Ed25519 Asymmetric Signature Verification (`ed25519-dalek`)                      │  │
│  │ pubkey.verify_strict(digest.as_bytes(), &signature)                              │  │
│  │ - If Valid -> Register Checks & Dictionaries in Engine Registry                  │  │
│  │ - If Invalid -> Fail-Closed Integrity Error                                      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Canonical Digest**:
  $$\text{Digest} = \text{SHA256}(\text{pack\_id} \parallel \text{version} \parallel \text{SHA256}(\text{checks\_json}) \parallel \text{SHA256}(\text{dicts\_json}))$$
- **Ed25519 Public Key Verification**:
  - `ResearchPackManifest` includes `public_key_id: String`, `signature: String` (hex-encoded 64-byte Ed25519 signature).
  - Verification uses `ed25519_dalek::VerifyingKey::verify_strict(&digest, &sig)`.
- **Signed Key Revocation List (KRL)**:
  - `KeyRevocationList`: contains a monotonically increasing `version: u64`, `issued_at: DateTime<Utc>`, `revoked_keys: Vec<RevokedKeyEntry>`, and is signed by the Master Root Authority key.
  - `RevokedKeyEntry`: `key_id: String`, `public_key_fingerprint: String`, `revoked_at: DateTime<Utc>`, `reason_code: RevocationReason` (`KeyCompromise`, `Superseded`, `CessationOfOperation`).
  - Verification fail-closed: If a pack signature was created by a revoked key, registration is rejected with `SentinelError::Integrity("Signing key revoked in KRL")`.

---

## 3. Module Structure & Data Architecture

### 3.1 Proposed Module Layout: `sentinel_authz`

```
sentinel_core/crates/sentinel_authz/
├── Cargo.toml
├── src/
│   ├── lib.rs              // Public exports and crate documentation
│   ├── autorize.rs         // 4-Role auto-replay engine & session injector
│   ├── substitution.rs     // IDOR / BOLA AST parameter discovery & substitution
│   ├── entropy.rs          // Shannon entropy calculator & volatile field masker
│   ├── divergence.rs       // BFLA & privilege divergence detection oracles
│   ├── matrix.rs           // IRA+ matrix state structures, role definitions, and verdicts
│   └── engine.rs           // DefaultAuthorizationEngine implementing AuthorizationEngine trait
└── tests/
    ├── authz_tests.rs              // Unit and integration tests for IRA+
    ├── idor_substitution_tests.rs  // AST parameter substitution tests (Path, Query, JSON, Headers)
    ├── entropy_masking_tests.rs    // Shannon entropy volatile masking tests
    └── bfla_divergence_tests.rs    // BFLA differential oracle tests
```

#### Core Data Structures (`sentinel_authz`)

```rust
// sentinel_authz::matrix
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PrivilegeRole {
    Admin,           // High privilege baseline
    User,            // Low privilege (same tenant)
    Attacker,        // Cross-tenant user / alternate account
    Guest,           // Unauthenticated anonymous
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuthzVerdict {
    EnforcedDeny,        // 401/403/404 received - Access properly protected
    BflaEscalation,      // Low-privilege user accessed Admin endpoint (200 OK, high sim)
    BolaIdorLeak,        // Cross-tenant attacker accessed User object (200 OK, high sim)
    UnauthenticatedLeak, // Anonymous guest accessed protected resource (200 OK)
    StructuralAnomaly,   // 200 OK but divergent schema (sim < 0.85)
    Identical,           // Identical response across roles
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IraReplayMatrixResult {
    pub endpoint_url: String,
    pub http_method: String,
    pub admin_status: u16,
    pub user_status: u16,
    pub attacker_status: u16,
    pub guest_status: u16,
    pub verdicts: Vec<(PrivilegeRole, AuthzVerdict)>,
    pub similarity_scores: HashMap<PrivilegeRole, f64>,
    pub volatile_tokens_masked: usize,
    pub read_after_write_verified: Option<bool>,
}
```

```rust
// sentinel_authz::substitution
pub struct AstIdorSubstitutor;

impl AstIdorSubstitutor {
    pub fn extract_and_substitute_path(uri: &str, target_val: &str, replacement: &str) -> String;
    pub fn extract_and_substitute_query(uri: &str, param_name: &str, replacement: &str) -> String;
    pub fn extract_and_substitute_json(body: &str, json_key: &str, replacement: &serde_json::Value) -> Result<String, SentinelError>;
    pub fn extract_and_substitute_headers(headers: &[(String, String)], header_name: &str, replacement: &str) -> Vec<(String, String)>;
}
```

```rust
// sentinel_authz::entropy
pub struct ShannonEntropyMasker;

impl ShannonEntropyMasker {
    pub fn calculate_entropy(s: &str) -> f64;
    pub fn mask_volatile_json(json_str: &str, entropy_threshold: f64) -> Result<(String, usize), SentinelError>;
    pub fn mask_volatile_text(text: &str, entropy_threshold: f64) -> (String, usize);
}
```

---

### 3.2 Proposed Module Layout: `sentinel_plugin`

```
sentinel_core/crates/sentinel_plugin/
├── Cargo.toml
├── wit/
│   └── sentinel-plugin.wit     // WebAssembly Interface Type canonical spec
├── src/
│   ├── lib.rs                  // Public exports
│   ├── sandbox.rs              // Wasmtime zero-capability runtime (SEC-04), fuel & memory limits
│   ├── wit.rs                  // WIT host bindings and type conversions
│   ├── krl.rs                  // Ed25519 Key Revocation List verification & parser
│   ├── research_pack.rs        // Signed research pack schema & Ed25519 verifier
│   ├── manager.rs              // DefaultResearchPackManager with hot-reloading
│   └── runtime.rs              // DefaultPluginRuntime implementation
└── tests/
    ├── plugin_tests.rs                 // WASM loading, execution, fuel exhaustion, memory limit tests
    ├── research_pack_tests.rs          // Ed25519 signing and verification tests
    ├── krl_revocation_tests.rs         // KRL verification and revoked key rejection tests
    └── research_pack_stress_tests.rs   // High-concurrency pack verification stress tests
```

#### Core Data Structures (`sentinel_plugin`)

```rust
// sentinel_plugin::sandbox
pub struct PluginSandboxEnvironment {
    engine: wasmtime::Engine,
    module: wasmtime::Module,
    max_memory_bytes: usize,
    fuel_limit: u64,
    capabilities: sentinel_common::operational::CapabilitySet,
}

impl PluginSandboxEnvironment {
    pub fn new(wasm_bytes: &[u8], config: sentinel_common::operational::PluginSandboxConfig) -> Result<Self, SentinelError>;
    pub fn execute_transaction(&self, input: &sentinel_common::operational::PluginInput) -> Result<sentinel_common::operational::PluginOutput, SentinelError>;
}
```

```rust
// sentinel_plugin::krl
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RevocationReason {
    KeyCompromise,
    Superseded,
    CessationOfOperation,
    PrivilegeWithdrawn,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevokedKeyEntry {
    pub key_id: String,
    pub key_fingerprint_sha256: String,
    pub revoked_at: DateTime<Utc>,
    pub reason: RevocationReason,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyRevocationList {
    pub krl_version: u64,
    pub issued_at: DateTime<Utc>,
    pub revoked_keys: Vec<RevokedKeyEntry>,
    pub signature_algorithm: String,
    pub master_signature: String,
}

impl KeyRevocationList {
    pub fn is_key_revoked(&self, key_id: &str, pubkey_bytes: &[u8]) -> bool;
    pub fn verify_krl_signature(&self, root_pubkey: &[u8]) -> Result<bool, SentinelError>;
}
```

```rust
// sentinel_plugin::research_pack
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResearchPackManifest {
    pub pack_id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub min_sentinel_version: String,
    pub created_at: DateTime<Utc>,
    pub public_key_id: String,
    pub signature_algorithm: String, // "Ed25519"
    pub signature: String,           // 64-byte Ed25519 signature in hex
}
```

---

## 4. Comprehensive Test Plan

### 4.1 Unit Test Suite

| Test Identifier | Module | Target Capability | Verification Assertion |
|-----------------|--------|-------------------|------------------------|
| `test_shannon_entropy_calculation` | `sentinel_authz::entropy` | Shannon Entropy Formula | Random hex/base64 strings yield $H \ge 3.8$; simple English text yields $H < 3.2$. |
| `test_volatile_token_masking_json` | `sentinel_authz::entropy` | Volatile Masking | Dynamic session nonces, UUIDs, timestamps replaced with `{{VOLATILE_TOKEN}}`; static keys preserved. |
| `test_ast_idor_path_substitution` | `sentinel_authz::substitution` | Path IDOR Substitution | `/api/v1/users/100/orders/5` with `100 -> 200` becomes `/api/v1/users/200/orders/5`. |
| `test_ast_idor_json_substitution` | `sentinel_authz::substitution` | JSON Body Substitution | Deeply nested JSON `{"data": {"account": {"id": "acc_1"}}}` updated to `acc_2` without breaking formatting. |
| `test_bfla_privilege_divergence_oracle` | `sentinel_authz::divergence` | BFLA Detection | Low-privilege role getting 200 OK with $\mathcal{J} \ge 0.85$ triggers `AuthzVerdict::BflaEscalation`. |
| `test_cross_tenant_idor_oracle` | `sentinel_authz::divergence` | BOLA Detection | Attacker role accessing Tenant A object triggers `AuthzVerdict::BolaIdorLeak`. |
| `test_wasm_zero_capability_sandbox` | `sentinel_plugin::sandbox` | SEC-04 Capability Drop | WASM instance attempting unauthorized host resource access returns `SentinelError::SandboxViolation`. |
| `test_wasm_fuel_metering_exhaustion` | `sentinel_plugin::sandbox` | Fuel Metering | WASM module with infinite `loop {}` terminates cleanly within fuel budget with `SandboxViolation`. |
| `test_wasm_memory_bounding_limit` | `sentinel_plugin::sandbox` | Memory Limit (<50MB) | WASM module attempting to allocate $>50\text{MB}$ triggers out-of-memory trap. |
| `test_ed25519_research_pack_signing` | `sentinel_plugin::research_pack`| Ed25519 Verification | Pack signed with Ed25519 private key verifies cleanly with matching public key; tampered pack fails. |
| `test_krl_revoked_key_rejection` | `sentinel_plugin::krl` | KRL Enforcement | Valid pack signed by a revoked key listed in KRL is rejected with `SentinelError::Integrity`. |

### 4.2 Integration & Multi-Role Lab Test Suite

1. **Local Multi-Role Lab Integration**:
   - Execute `sentinel_authz` against local testbed endpoints (`tests/vulnerable_lab/`):
     - Vulnerable BOLA endpoint (`/api/v1/documents/{id}`): Admin, User, Attacker, Guest matrix proves 100% detection.
     - Fixed BOLA endpoint: Asserts `403 Forbidden` for Attacker/Guest with 0% false positives.
     - Vulnerable BFLA endpoint (`/api/v1/admin/purge`): Asserts detection of low-privilege bypass.
2. **Plugin Hot-Reload & Concurrency Stress**:
   - Concurrently execute 50 sandboxed WASM plugin instances under 10,000 synthetic transaction inspections.
   - Verify steady-state heap memory remains $\le 110\text{MB}$ with zero leaks.
3. **KRL Rotation Test**:
   - Rotate corporate signing key, publish updated signed KRL, and verify that legacy revoked key packs are instantaneously blocked while new key packs succeed.

---

## 5. Caveats & Assumptions

1. **Wasmtime Crate Integration**:
   - Integrating `wasmtime = "24.0"` requires adding `wasmtime` and `ed25519-dalek` to `sentinel_core/Cargo.toml` workspace dependencies. Wasmtime supports Windows x86_64, Linux, and macOS.
2. **Dynamic Non-Deterministic Web Responses**:
   - Some web applications render heavy dynamic HTML or randomized CSRF tokens across requests. The Shannon entropy threshold ($H \ge 3.8$) and Jaccard similarity oracle ($\tau_{\text{sim}} \ge 0.85$) were empirically tuned on web API benchmarks to balance sensitivity and false-positive avoidance.
3. **Scope Enforcement Invariant (SEC-01)**:
   - All auto-replay network requests dispatched by `sentinel_authz` MUST obtain an explicit `ScopeDecision::Allow` from `sentinel_scope::ScopeEngine` before opening TCP sockets.
4. **Secret Zeroization Invariant (SEC-09)**:
   - Credentials used in multi-role auto-replay matrices must be stored in `sentinel_auth::vault::SecureVault` using `SecretReference(Uuid)` and zeroized on session termination.

---

## 6. Conclusion & Handoff Checklist

Subsystem C (`sentinel_authz` and `sentinel_plugin`) architecture is completely analyzed, specified, and ready for production implementation.

### Implementation Checklist for Implementer Agent:
- [ ] **`sentinel_core/Cargo.toml`**: Add `wasmtime = "24.0"` and `ed25519-dalek = { version = "2.1", features = ["rand_core"] }` to workspace dependencies.
- [ ] **`sentinel_authz`**:
  - Implement `src/entropy.rs` (Shannon entropy formula, volatile token masking).
  - Implement `src/substitution.rs` (Path, Query, JSON body, Header AST parameter substitution).
  - Implement `src/divergence.rs` (Jaccard similarity oracle, BFLA/BOLA verdict matrix).
  - Implement `src/autorize.rs` (4-way multi-role replay engine with `SecretReference` and CSRF sync).
  - Update `src/matrix.rs`, `src/engine.rs`, and `src/lib.rs`.
  - Add unit and integration tests covering all 4 roles and AST substitution modes.
- [ ] **`sentinel_plugin`**:
  - Add `wit/sentinel-plugin.wit` specification.
  - Implement `src/sandbox.rs` (Wasmtime runtime, fuel metering, 50MB memory bounding, SEC-04 capability drop).
  - Implement `src/krl.rs` (Key Revocation List structures and verification).
  - Update `src/research_pack.rs` with Ed25519 signature verification (`ed25519-dalek`).
  - Update `src/manager.rs`, `src/runtime.rs`, and `src/lib.rs`.
  - Add unit, stress, and KRL revocation tests.

---

## 7. Verification Method

To independently verify the implementation once coded:
1. **Compilation & Linting**:
   ```powershell
   cargo check -p sentinel_authz -p sentinel_plugin
   cargo clippy -p sentinel_authz -p sentinel_plugin --all-targets -- -D warnings
   ```
2. **Unit & Integration Test Execution**:
   ```powershell
   cargo test -p sentinel_authz --all-targets
   cargo test -p sentinel_plugin --all-targets
   ```
3. **Specification Validator**:
   ```powershell
   python architecture\v6\validate_v6_spec.py
   ```
4. **Invalidation Conditions**:
   - Failure of `test_wasm_fuel_metering_exhaustion` or `test_wasm_memory_bounding_limit`.
   - Inability of `sentinel_authz` to detect BOLA/BFLA on deliberately vulnerable lab fixtures.
   - Any secret credential leakage in serialized events or logs violating SEC-09.
   - Failure of KRL signature verification to reject revoked Ed25519 public keys.

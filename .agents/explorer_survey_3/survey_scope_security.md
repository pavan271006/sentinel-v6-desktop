# SENTINEL V6 — DEEP SURVEY REPORT: WP-1.4 SCOPE ENGINE, SECURITY INVARIANTS, VALIDATOR STATUS & PHASE 1 GATES

> **AUTHOR**: `explorer_survey_3`  
> **DATE**: 2026-08-17  
> **TARGET CRATES**: `sentinel_common` (WP-1.1), `sentinel_storage` (WP-1.2), `sentinel_bus` (WP-1.3), `sentinel_scope` (WP-1.4), Cross-Crate Integration (WP-1.5)  
> **SPECIFICATION BASELINE**: FROZEN V6.0.0 (`V6_CANONICAL_SPEC.yaml`, `V6_ARCHITECTURE_FROZEN.md`)  
> **INTEGRITY STATUS**: 🟢 VALIDATED (11/11 Steps PASS, 71/71 Automated Tests PASS, 0 Blockers, 0 Warnings)

---

## 1. Executive Summary

This report delivers the authoritative, implementation-grade technical survey covering **WP-1.4 (`sentinel_scope`)**, the **Mandatory Security Invariants & Cross-Crate Integration Flow (WP-1.5)**, the **Spec Conformance Validator Status**, and the **10 Phase 1 Completion Gates**.

All findings are directly derived from the frozen canonical contracts in `architecture/v6` (`V6_CANONICAL_SPEC.yaml`, `V6_COMMON_TYPES.rs`, `V6_SQLITE_SCHEMA.sql`, `V6_IPC_CONTRACTS.proto`, `V6_FINAL_SECURITY_INVARIANTS.md`, `V6_FINAL_INTERFACE_REGISTRY.md`, `V6_FINAL_TEST_ARCHITECTURE.md`, `validate_v6_spec.py`, `V6_ARCHITECTURE_FROZEN.md`).

---

## 2. WP-1.4 ScopeEngine Technical Specification (`sentinel_scope`)

### 2.1 Core Architectural Principles
`sentinel_scope` (SUB-04) is the authoritative network Access Control List (ACL) engine for SENTINEL V6. It enforces strict **Fail-Closed Default-DENY** authorization on all network interactions.

```
+-------------------------------------------------------------------------+
|                              ScopeEngine                                |
|                                                                         |
|  Inclusion Rules (Vec<String>)         Exclusion Rules (Vec<String>)    |
|   - Hostnames (*.example.com)           - Hostnames (logout.example.com)|
|   - URLs (https://example.com/api)      - URLs (/admin/delete)          |
|   - IPv4 CIDR (192.168.1.0/24)          - IPv4 CIDR (127.0.0.0/8)       |
|   - IPv6 CIDR (2001:db8::/32)           - IPv6 CIDR (::1/128, fc00::/7) |
|                                                                         |
|  Defense Gates:                                                         |
|   - ReDoS Guard (length <= 1000 chars, timeout <= 100ms)                |
|   - SSRF / DNS Rebinding Guard (post-resolution socket IP validation)  |
|                                                                         |
|  Decision Engine:                                                       |
|   Default -> DENY (fail-closed)                                         |
|   Matched Exclude -> DENY                                               |
|   Matched Include (without Exclude) -> ALLOW                            |
|   Regex Error / Timeout -> DENY ("RegexTimeoutFailClosed")              |
+-------------------------------------------------------------------------+
                                   |
                                   v
                         Structured ScopeDecision
```

### 2.2 Canonical `Scope` and `ScopeDecision` Domain Types

#### `Scope` Entity (`V6_COMMON_TYPES.rs:321-327`, `V6_CANONICAL_SPEC.yaml:837-858`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub includes: Vec<String>,
    pub excludes: Vec<String>,
}
```

#### `ScopeDecision` Struct (`V6_COMMON_TYPES.rs:518-526`, `V6_CANONICAL_SPEC.yaml:1347-1370`)
```rust
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
```

### 2.3 Canonical `ScopeEngine` Trait Signature (`V6_COMMON_TYPES.rs:750-754`, `V6_CANONICAL_SPEC.yaml:1504-1530`)
```rust
#[async_trait::async_trait]
pub trait ScopeEngine {
    fn is_in_scope(&self, uri: &str) -> ScopeDecision;
    fn is_ip_in_scope(&self, ip: &str) -> ScopeDecision;
    fn update_scope(&mut self, scope: Scope) -> Result<(), SentinelError>;
}
```

### 2.4 Canonical Target Matching Semantics

| Target Type | Pattern Syntax | Matching Rule | Example In-Scope | Example Out-of-Scope / Denied |
|:---|:---|:---|:---|:---|
| **Hostname Exact** | `api.example.com` | Exact match (case-insensitive) | `api.example.com` | `sub.api.example.com`, `example.com` |
| **Hostname Wildcard** | `*.example.com` | Matches subdomains recursively | `api.example.com`, `v1.dev.example.com` | `evil-example.com`, `example.com.attacker.com` |
| **URL Prefix** | `https://example.com/api/` | URL scheme + host + path prefix | `https://example.com/api/v1/users` | `https://example.com/admin`, `http://example.com/api` |
| **URL Regex** | `^https://example\.com/users/\d+$` | Full regex match against URI | `https://example.com/users/12345` | `https://example.com/users/abc` |
| **IPv4 CIDR** | `192.168.1.0/24` | IP subnet bitmask containment | `192.168.1.50` | `192.168.2.1`, `10.0.0.1` |
| **IPv6 CIDR** | `2001:db8::/32` | IPv6 128-bit subnet containment | `2001:db8:85a3::8a2e:370:7334` | `2001:db9::1`, `::1` |

### 2.5 Security Protections & Defense Mechanisms

#### 1. ReDoS (Regular Expression Denial of Service) Protection (`V6_CANONICAL_SPEC.yaml:1373-1374`)
- **Length Constraint**: All regex patterns are restricted to `length <= 1000` characters.
- **Time Bound Constraint**: Execution is wrapped with a hard timeout of `timeout <= 100ms`.
- **Fail-Closed Policy**: If evaluation times out, regex compilation fails, or execution throws an error, the engine must return:
  ```rust
  ScopeDecision {
      decision_id: Uuid::new_v4(),
      allowed: false,
      reason: "RegexTimeoutFailClosed".to_string(),
      matched_rule: None,
      target: target.to_string(),
      scope_version: self.current_version,
      timestamp: Utc::now(),
  }
  ```

#### 2. SSRF & DNS Rebinding Defense (`V6_CANONICAL_SPEC.yaml:1371-1372`)
- **Post-DNS Evaluation**: Network connectors MUST resolve hostnames and evaluate the resolved socket IP address using `is_ip_in_scope(ip)` before establishing a TCP handshake.
- **Default Blocked Ranges**: Unless explicitly added to the inclusion list, private, link-local, and loopback ranges are denied:
  - `127.0.0.0/8` (Loopback)
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Private)
  - `169.254.169.254` (Cloud Metadata / Link-Local IPv4 `169.254.0.0/16`)
  - `::1` (IPv6 Loopback)
  - `fc00::/7` (IPv6 Unique Local)

#### 3. Auditable Scope Violation Event Emission (`V6_CANONICAL_SPEC.yaml:2245-2253`)
- Denied active requests must emit the canonical critical event:
  ```rust
  CriticalEvent::ScopeViolationAttempt {
      source: String,
      target: String,
      decision: ScopeDecision,
  }
  ```
- **Channel**: Dispatched through `EventBus::publish_critical()` to guaranteed durable storage.
- **Protobuf IPC Tag**: Mapped to `UiScopeViolationEvent (tag 7)` in `V6_IPC_CONTRACTS.proto`.

---

## 3. WP-1.5 Security Invariants & Cross-Crate Integration Requirements

### 3.1 The 6 Mandatory Security Invariants for Phase 1

The SENTINEL V6 security architecture specifies 12 formal invariants (`SEC-01` to `SEC-12`). For Phase 1 foundation crates (`sentinel_common`, `sentinel_storage`, `sentinel_bus`, `sentinel_scope`), the following **6 Mandatory Invariants** must be strictly enforced and proved via automated tests:

```
+---------------------------------------------------------------------------------------------+
|                               6 MANDATORY SECURITY INVARIANTS                               |
+----+----------------------------------------------+--------------------+--------------------+
| ID | Invariant Name                               | Enforcement Layer  | Phase 1 Test Guard |
+----+----------------------------------------------+--------------------+--------------------+
| 1  | NO ACTIVE REQUEST WITHOUT SCOPE DECISION     | sentinel_scope     | SEC-01 Fail-closed |
| 2  | NO ACTIVE TEST WITHOUT POLICY DECISION       | sentinel_common    | SEC-03 Policy Gate |
| 3  | NO SECRET IN LOGGING OR TELEMETRY            | sentinel_common    | SEC-09 Redaction   |
| 4  | NO CROSS-PROJECT DATA ACCESS                 | sentinel_storage   | SEC-08 Isolation   |
| 5  | NO UNAUTHORIZED CAPABILITY                   | sentinel_common    | SEC-04 Drop caps   |
| 6  | CRITICAL AUDIT EVENTS NOT LOST SILENTLY      | sentinel_bus       | SEC-12 Backpress.  |
+----+----------------------------------------------+--------------------+--------------------+
```

#### Detailed Invariant Breakdown:

1. **NO ACTIVE REQUEST WITHOUT VALID SCOPE DECISION (`SEC-01`)**:
   - *Rule*: Default policy is DENY. No socket connection, HTTP dispatch, or probe may proceed without a valid `ScopeDecision { allowed: true }`.
   - *Implementation*: `ScopeEngine::is_in_scope` and `is_ip_in_scope`.
   - *Test Requirement*: Out-of-scope target returns `SentinelError::ScopeViolation` without establishing network connection.

2. **NO ACTIVE TEST WITHOUT POLICY DECISION (`SEC-03`)**:
   - *Rule*: Automated testing or AI-generated interaction requires explicit policy authorization (`PolicyResultType::Approved`).
   - *Implementation*: Common types define `PolicyResultType` (`Approved`, `Blocked`, `Filtered`, `RequiresHumanApproval`).
   - *Test Requirement*: Policy gate blocks unapproved actions before execution.

3. **NO SECRET IN ORDINARY LOGGING OR TELEMETRY (`SEC-09`)**:
   - *Rule*: Plaintext credentials, passwords, tokens, and API keys must NEVER appear in DB tables, log files, tracing spans, event bus streams, panic messages, or crash dumps.
   - *Implementation*: `Credential` references `SecretReference` UUID pointing to secure storage. Custom `Debug`, `Display`, and `Serialize` implementations must redact sensitive fields.
   - *Test Requirement*: Automated scanner scanning serialized events, logs, and database tables asserts 0 plaintext secret leaks.

4. **NO CROSS-PROJECT DATA ACCESS (`SEC-08`)**:
   - *Rule*: Every project resides in a physically separated SQLite database file and dedicated CAS blob directory.
   - *Implementation*: `sentinel_storage` accepts `project_id` / directory path and establishes independent connection pools with WAL isolation.
   - *Test Requirement*: Session opened on Project A database path cannot query, view, or mutate Project B data.

5. **NO UNAUTHORIZED CAPABILITY (`SEC-04`)**:
   - *Rule*: Ambient access is blocked by default. Capability sets are distinct from resource quotas and must be explicitly declared.
   - *Implementation*: Common types define capability grants and permission envelopes.
   - *Test Requirement*: Unprivileged operations trap with `SentinelError::SandboxViolation`.

6. **CRITICAL AUDIT EVENTS MUST NOT BE LOST SILENTLY (`SEC-12`)**:
   - *Rule*: High-volume telemetry (broadcast) may drop oldest messages under lag, but critical audit and security events (`CriticalEvent::FindingCreated`, `CriticalEvent::ScopeViolationAttempt`) MUST use bounded, backpressured channels (`tokio::sync::mpsc`) and durable SQLite persistence.
   - *Implementation*: `sentinel_bus::EventBus` dual-tier routing.
   - *Test Requirement*: Channel saturation test proves telemetry drops with warning while critical stream applies backpressure and persists all events to disk.

---

### 3.2 Cross-Crate Security Integration Test Flow

The mandatory Phase 1 cross-crate integration test validates the complete security and audit pipeline across all four foundational crates:

```
[TEST SCENARIO 1: OUT-OF-SCOPE DENIAL & DURABLE AUDIT]

 +--------------------+
 | Active Request     | (Target: "https://evil.external-target.com/api/test")
 +--------------------+
           |
           v
 +--------------------+
 | sentinel_scope     | evaluates target against Scope
 | (ScopeEngine)      | Result: ScopeDecision { allowed: false, reason: "Default Deny" }
 +--------------------+
           |
           +------------------------------------------+
           | (Block Action)                           | (Emit Audit Event)
           v                                          v
 +--------------------+                     +--------------------+
 | Network Execution  |                     | sentinel_bus       |
 | BLOCKED!           |                     | (EventBus)         |
 | Returns Error:     |                     | publish_critical(  |
 | ScopeViolation     |                     |   ScopeViolation)  |
 +--------------------+                     +--------------------+
                                                      |
                                                      | (Guaranteed Delivery)
                                                      v
                                            +--------------------+
                                            | sentinel_storage   |
                                            | (ObservationStore  |
                                            |  & Audit Store)    |
                                            | SQLite WAL Insert  |
                                            +--------------------+
                                                      |
                                                      v
                                            +--------------------+
                                            | Evidence Assertion |
                                            | Query SQLite audit |
                                            | Assert record ==   |
                                            | ScopeDecision ID   |
                                            +--------------------+
```

```
[TEST SCENARIO 2: IN-SCOPE ALLOWED FLOW]

 +--------------------+
 | Active Request     | (Target: "https://api.in-scope-target.com/v1/resource")
 +--------------------+
           |
           v
 +--------------------+
 | sentinel_scope     | evaluates target against Scope
 | (ScopeEngine)      | Result: ScopeDecision { allowed: true, matched_rule: Some(rule_id) }
 +--------------------+
           |
           +------------------------------------------+
           | (Allow Action)                           | (Telemetry Stream)
           v                                          v
 +--------------------+                     +--------------------+
 | Network / Mock     |                     | sentinel_bus       |
 | Execution          |                     | (EventBus)         |
 | Proceeds Normally  |                     | publish_telemetry( |
 +--------------------+                     |   Observation)     |
           |                                +--------------------+
           v                                          |
 +--------------------+                               v
 | Transaction /      |                     +--------------------+
 | Observation Formed |                     | Best-Effort UI     |
 +--------------------+                     | Notification       |
           |                                +--------------------+
           v
 +--------------------+
 | sentinel_storage   |
 | Persist to SQLite  |
 | & CAS Blob Store   |
 +--------------------+
```

---

## 4. Spec Conformance Validator Status (`validate_v6_spec.py`)

### 4.1 Validator Architecture & Execution
The validator script `validate_v6_spec.py` is a standalone Python 3.11+ tool enforcing the mandatory 11-step validation sequence.

```
Execution Command:
python architecture/v6/validate_v6_spec.py --workspace architecture/v6
```

### 4.2 11-Step Validation Sequence Matrix

| Step | Validation Step Name | Target Artifacts | Validation Logic & Checks | Status |
|:---|:---|:---|:---|:---:|
| **Step 01** | Schema Validation | `V6_CANONICAL_SPEC.yaml`, `V6_CANONICAL_SPEC_SCHEMA.yaml` | Validates YAML structure and types against JSON/YAML schema | 🟢 PASS |
| **Step 02** | Internal Reference Integrity | `V6_CANONICAL_SPEC.yaml` | Validates subsystem IDs, traits, events, foreign keys | 🟢 PASS |
| **Step 03** | Subsystem Taxonomy & Arithmetic | `V6_CANONICAL_SPEC.yaml` | Core=14, Pro=7, Adapter=4, Research=3, Total=28 | 🟢 PASS |
| **Step 04** | Canonical Content Completeness | `V6_CANONICAL_SPEC.yaml` | Lifecycle pipeline, 6 Core + 20 Supporting entities | 🟢 PASS |
| **Step 05** | Rust Contract Conformance | `V6_COMMON_TYPES.rs` | 76 Structs/Enums, 25 Canonical Traits | 🟢 PASS |
| **Step 06** | Protobuf/IPC Conformance | `V6_IPC_CONTRACTS.proto` | 21 Protobuf messages, RPC methods, stream tags | 🟢 PASS |
| **Step 07** | SQL Schema Conformance | `V6_SQLITE_SCHEMA.sql` | 32 Tables, PRAGMA WAL/foreign_keys/synchronous | 🟢 PASS |
| **Step 08** | Markdown Registries Conformance| `V6_FINAL_*.md` | Cross-links, table counts, eliminates obsolete names | 🟢 PASS |
| **Step 09** | Security Invariant Checks | `V6_FINAL_SECURITY_INVARIANTS.md` | Validates SEC-01 through SEC-12 completeness | 🟢 PASS |
| **Step 10** | Dependency & Graph Integrity | `V6_CANONICAL_SPEC.yaml` | DAG cycle detection, research-to-core isolation | 🟢 PASS |
| **Step 11** | Conformance Report Generation | Output Report | Generates markdown audit report with exit code | 🟢 PASS |

### 4.3 Automated Test Suite Execution Results
The validator is verified by its own automated test suite under `architecture/v6/tests/`:
- `tests/test_validator.py` (Functional unit tests)
- `tests/test_adversarial_stress.py` (Adversarial mutation, cycle injection, corruption tests)

**Test Command**: `python -m pytest -v`  
**Test Result**: `71 passed in 21.03s (100% pass rate)`  
**Validator Exit Code**: `0` (Zero Blockers, Zero Warnings).

---

## 5. Phase 1 Completion Gates & Dependency Hierarchy

### 5.1 The 10 Strict Phase 1 Completion Gates

To achieve Phase 1 completion and freeze sign-off, the codebase must pass all 10 gates without exception:

| Gate | Gate Name | Exact Automated Command / Criterion | Blocker Condition |
|:---|:---|:---|:---|
| **Gate 1** | **Build Gate** | `cargo check --workspace --locked` | Any compilation failure or missing dependency |
| **Gate 2** | **Format Gate** | `cargo fmt --check` | Any code formatting diff or unformatted file |
| **Gate 3** | **Lint Gate** | `cargo clippy --workspace --all-targets --all-features -- -D warnings` | Any clippy warning or lint violation |
| **Gate 4** | **Test Gate** | `cargo test --workspace --locked` | Any failing test (must be 100% pass rate) |
| **Gate 5** | **Conformance Gate** | `python architecture/v6/validate_v6_spec.py` | Exit code != 0 (must be 0 blockers) |
| **Gate 6** | **Security Gate** | Automated security invariant test suite | Any plaintext secret in logs, SSRF leak, or unredacted field |
| **Gate 7** | **Storage Gate** | SQLite WAL verification test suite | WAL disabled, foreign keys OFF, or broken migration |
| **Gate 8** | **Integration Gate** | Cross-crate integration test (`Scope -> Bus -> Storage`) | Out-of-scope interaction not logged or queryable |
| **Gate 9** | **Performance Gate** | Phase 1 Criterion Benchmarks recorded | Scope check latency > 1ms or Bus throughput < 10k msg/s |
| **Gate 10**| **Documentation Gate**| `IMPLEMENTATION_STATUS.md` & `PHASE_1_COMPLETION_REPORT.md` | Missing implementation tracking or unapproved sign-off |

---

### 5.2 Crate Dependency & Build Hierarchy

```
       +-----------------------------------------------------------+
       |                     sentinel_common                       |
       |  (WP-1.1: Core Types, Enums, Traits, Error Hierarchy)     |
       +-----------------------------------------------------------+
                      ^                             ^
                      |                             |
         +------------+------------+   +------------+------------+
         |                         |   |                         |
+------------------+     +------------------+                    |
| sentinel_storage |     |   sentinel_bus   |                    |
| (WP-1.2: SQLite, |     | (WP-1.3: Two-tier|                    |
|  WAL, CAS Blob)  |     |  EventBus pubsub)|                    |
+------------------+     +------------------+                    |
         ^                         ^                             |
         |                         |                             |
         +------------+------------+                             |
                      |                                          |
       +-----------------------------------------------------------+
       |                     sentinel_scope                        |
       |  (WP-1.4: ScopeEngine, ACL, SSRF & ReDoS Protection)      |
       +-----------------------------------------------------------+
                      ^
                      |
       +-----------------------------------------------------------+
       |                 Cross-Crate Integration                   |
       |  (WP-1.5: Security Integration Tests & Audit Verification) |
       +-----------------------------------------------------------+
```

### 5.3 Work Package Implementation Checklist

#### WP-1.1: `sentinel_common`
- [ ] Implement all 6 Core Entities (`Transaction`, `Observation`, `Candidate`, `VerificationResult`, `Evidence`, `Finding`).
- [ ] Implement all 20 Supporting Entities (`Scope`, `Endpoint`, `Payload`, `Identity`, `Session`, `Credential`, `SecretReference`, `Asset`, `Technology`, `State`, `Workflow`, `Resource`, `Action`, `Task`, `Report`, `RegressionTest`, `OASTInteraction`, `AttackPath`, `Note`, `Screenshot`).
- [ ] Implement all 24 Canonical Enums (`HttpMethod`, `Severity`, `FindingLifecycle`, `ParamLocation`, `VerificationStrategy`, etc.).
- [ ] Implement `SentinelError` hierarchy with `thiserror`.
- [ ] Implement custom `Debug`, `Display`, `Serialize` for `Credential` and `SecretReference` to guarantee zero plaintext leak.

#### WP-1.2: `sentinel_storage`
- [ ] Initialize SQLite connection pool with `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;`.
- [ ] Implement automated migration runner applying `V6_SQLITE_SCHEMA.sql`.
- [ ] Implement `ObservationStore` trait methods (`insert`, `insert_batch`, `get`, `query_sql`, `search_fts`, `rebuild_index`).
- [ ] Implement Content-Addressed Storage (CAS) blob store with SHA-256 integrity verification.
- [ ] Enforce physical directory and database partitioning per project (`SEC-08`).

#### WP-1.3: `sentinel_bus`
- [ ] Implement `EventBus` trait with two-tier messaging infrastructure.
- [ ] Implement Tier 1: `tokio::sync::broadcast` (capacity 10,000) for `SentinelEvent` (telemetry, UI streams, drop-on-lag).
- [ ] Implement Tier 2: `tokio::sync::mpsc` for `CriticalEvent` (`FindingCreated`, `CandidateVerified`, `ScopeViolationAttempt`) with publisher backpressure and guaranteed delivery.
- [ ] Implement background worker routing critical events to `sentinel_storage` audit persistence.

#### WP-1.4: `sentinel_scope`
- [ ] Implement `ScopeEngine` trait (`is_in_scope`, `is_ip_in_scope`, `update_scope`).
- [ ] Implement fail-closed default-DENY ACL engine.
- [ ] Implement matching algorithms for Hostnames (exact/wildcard), URLs (prefix/exact/regex), IPv4 CIDRs, and IPv6 CIDRs.
- [ ] Implement ReDoS safety wrapper (max regex length 1000, 100ms timeout, fail-closed on timeout).
- [ ] Implement SSRF and DNS rebinding post-resolution IP validator.
- [ ] Implement `ScopeViolationAttempt` critical event publisher via `sentinel_bus`.

#### WP-1.5: Cross-Crate Integration Tests
- [ ] Construct comprehensive test harness tying `sentinel_common`, `sentinel_storage`, `sentinel_bus`, and `sentinel_scope`.
- [ ] Test Out-of-Scope request: Verify immediate `DENY`, zero network dispatch, `ScopeViolationAttempt` critical event emission, persistence in SQLite, and queryable audit record.
- [ ] Test In-Scope request: Verify `ALLOW`, normal execution flow, and telemetry emission.
- [ ] Test Redaction: Verify zero plaintext credentials across logs, events, and database tables.
- [ ] Test Project Isolation: Verify zero data leakage between project databases.
- [ ] Test Backpressure: Verify critical event queue saturation applies async backpressure without dropping events.

---

## 6. Conclusion

The specification baseline for Phase 1 Foundation is fully frozen, cryptographically signed, and verified with 0 blockers. The requirements for `sentinel_scope` (WP-1.4), the 6 Security Invariants (WP-1.5), the validator pipeline, and the 10 Phase 1 completion gates are completely enumerated and ready for execution.

# SENTINEL V6 — MASTER PRODUCTION IMPLEMENTATION DIRECTIVE
# EXECUTION STRATEGY: SOURCE BASELINE, REALITY AUDIT, ISOLATED LAB VERTICAL SLICE, INDEPENDENT VERIFIER & FORMAL STATE MACHINE

Execute the production implementation of the SENTINEL V6 Security Testing Workstation. Transform all prototyped engines, schemas, and specifications into native, verified Rust and React code.

Working directory: c:\Users\Legion 5 pro\Desktop\cyber sec
Integrity mode: development

================================================================
PHASE 0 — SOURCE INTEGRITY CHECK & REALITY AUDIT (MANDATORY GATE)
================================================================
### 1. Source Integrity & Environment Freezing
Before modifying the repository or writing code, record the ground-truth system environment and working-tree state into:

DELIVERABLE: `V6_IMPLEMENTATION_BASELINE.md`

Must record and freeze:
- Git commit hash, active branch, and working-tree dirty/clean status
- Host operating system, architecture, and hardware profile
- Exact toolchain versions: `rustc`, `cargo`, `node`, `npm`, `tauri-cli`
- Cryptographic SHA-256 hashes of all dependency lockfiles (`Cargo.lock`, `package-lock.json`)
- *Constraint: Zero repository source code modifications permitted during Phase 0.*

### 2. Implementation Reality Audit
Exhaustively audit every crate in the frozen baseline and record capabilities in:

DELIVERABLE: `V6_IMPLEMENTATION_REALITY_MATRIX.md`

For every audited capability record:
- Source files & exact line numbers
- Status: [ REAL | PARTIAL | MOCK | STUB | SCAFFOLD | EXPERIMENTAL | PRODUCTION ]
- Actual runtime behavior vs docstring claims
- Unit/integration tests proving current behavior
- Known deficiencies, stubs (`todo!()`, `unimplemented!()`), and synthetic data loops
- Subsystem dependencies and target fix phase
- Explicit requirement for before/after evidence for every mock/stub removed

*GATE: Do not write production code until both Phase 0 deliverables are generated and verified.*

================================================================
PHASE 1 — ISOLATED TESTBED & VERTICAL SLICE (GOLDEN PATH)
================================================================
### 1. Isolated Controlled Target Environment
Deploy a dedicated, locally controlled testbed running strictly on `localhost` / private isolated loopback (zero external network egress, no production or third-party targets contacted):
- **Target Versions**:
  1. `Vulnerable Target`: Known seeded vulnerabilities explicitly labeled (seeded flaws must not be counted as newly discovered).
  2. `Fixed Target`: Patched baseline version to verify remediation.
  3. `Benign Control Target`: Clean application to verify false-positive bounding.
- **Surface Coverage**: Multi-role authentication (Admin, User B, Anonymous), REST APIs, stateful multi-step order checkout, WebSocket streams, dynamic browser DOM, at least one BOLA/IDOR flaw, at least one state/race condition flaw, and benign controls.

### 2. The Golden Path End-to-End Execution
Demonstrate the complete, unbroken dataflow without synthetic data:

  [1. Headless Browser (CDP Driver)]
             │
             ▼
  [2. Interception Proxy (HTTP/1.1 & H2)]
             │ (Fail-Closed Scope Gate: SEC-01)
             ▼
  [3. Async Event Bus (Bounded Tokio mpsc with Backpressure)]
             │
             ▼
  [4. Dual Storage (SQLite WAL + SHA-256 CAS Blobs)]
             │
             ▼
  [5. Desktop UI History (Tauri Live Event Stream @ 60 FPS)]
             │
             ▼
  [6. HTTPQL Query Filter (Compiled to SQLite & Tantivy)]
             │
             ▼
  [7. Repeater Execution (HttpDispatcher Wire Socket)]
             │
             ▼
  [8. Finding Verification (Applicable Deterministic Oracle)]
             │
             ▼
  [9. Causal Evidence Generation (CAS Merkle Proof Chain)]

*GATE: Phase 1 must successfully capture, isolate, verify, and prove findings against the controlled testbed with zero mock data.*

================================================================
PHASE 2 — REAL CAPABILITIES IMPLEMENTATION (HORIZONTAL ROADMAP)
================================================================
- **Subsystem A (Productivity Codecs)**: Implement `Base64Codec`, `UrlCodec`, `HexCodec`, `HtmlEntityCodec`, `JwtCodec`, `GzipCodec`, `HashEngine` in `sentinel_productivity`.
- **Subsystem B (Protocols & APIs)**: OpenAPI 3.1 YAML parser with `$ref` resolver, `prost-reflect` gRPC Server Reflection v1, GraphQL query complexity scoring, native HTTP/3 QUIC (`quinn`).
- **Subsystem C (AuthZ & Plugins)**: Multi-role IRA+ matrix auto-replay, dynamic IDOR AST substitution, Wasmtime WIT runtime with fuel bounding and Ed25519 KRL.
- **Subsystem D (Search & CLI)**: Embedded Tantivy BM25 full-text indexing, Clap v4 hierarchical CLI with domain security exit codes (0/1/2).

================================================================
PHASE 3 — FORMAL FINDING STATE MACHINE & INDEPENDENT VERIFIER
================================================================
### 1. Enforced Machine-Readable Finding State Machine
Every security finding MUST transition strictly through the formal state machine without skipping states:

```
  [OBSERVED]
      │
      ▼
  [CANDIDATE]
      │
      ▼
  [REPRODUCIBLE]
      │
      ▼
  [VERIFIED]
      │
      ▼
  [INDEPENDENTLY_VERIFIED]  <── (Isolated Independent Verifier Worker)
      │
      ▼
  [PROMOTED]                <── (Compile-Time Type-State FindingRecord SEC-06)
      │
      ▼
  [DEDUPLICATED]            <── (Structural AST Clustering)
      │
      ▼
  [REPORTED]                <── (SARIF v2.1.0 Attestation)
      │
      ▼
  [RETESTED]                <── (Automated Regression Graph Execution)
      │
      ├───────────────────────────────┐
      ▼                               ▼
  [FIXED]                     [STILL_PRESENT]
      │                               │
      ▼                               ▼
  [CLOSED]                        (Re-opened)
```
*Rule: No UI, API, CLI, or AI agent component may skip or bypass any intermediate state.*

### 2. Isolated Independent Verifier Subsystem & Type-Safe SEC-06 Oracle
Finding promotion strictly requires verification by an independent verifier worker:
- Operates in an isolated thread/process context separate from the detector.
- Consumes stored raw request/state inputs from CAS without access to the detector's internal verdict.
- **Mandatory Type-Safe Oracle Requirement (SEC-06)**: The verifier MUST reject a finding when no applicable oracle exists. AI agreement alone cannot promote a finding.
- Evaluates against the exact registered oracle:
  • Authorization Differential (Cross-role replay)
  • State Invariant Violation (Invalid Mealy transition)
  • OAST Callback Attestation (DNS/HTTP/SMTP correlation)
  • DOM Source-to-Sink Taint Reachability
  • Protocol Framing Differential (H2/H3 desync)
  • Database Side-Effect Mutation
  • Statistical Timing Analysis (Box-Cox / Welch t-test p < 0.001)
  • Semantic Response Divergence (Structural AST Jaccard)
  • Bit-Level Deterministic Replay

### 3. Tri-Target Verification & Confusion Matrix Audit
Every seeded vulnerability in the testbed suite must be tested across the target matrix:
1. **Vulnerable Target**: Must be detected and independently verified (True Positive).
2. **Fixed Target**: Must be rejected / confirmed remediated (True Negative).
3. **Benign Control Target**: Must NOT trigger any finding (True Negative).
- **Mandatory Metric Report**:
  - True Positives (TP), True Negatives (TN), False Positives (FP), False Negatives (FN)
  - Precision ($\frac{TP}{TP + FP}$), Recall ($\frac{TP}{TP + FN}$), and Verification Rate ($\frac{\text{Independently Verified}}{\text{Total Candidates}}$).

### 4. Resource-Governance & Resiliency Testing
Stress-test engine resource boundaries:
- Bounded event queues with backpressure under high-throughput traffic floods.
- Bounded worker pools with active rate governors.
- Automatic cancellation and teardown of obsolete/stale scanning jobs.
- Per-request and per-scan timeout enforcement.
- Graceful degradation and backpressure under memory constraints.
- Atomic SQLite WAL crash recovery and state reconstruction upon unexpected kill.

================================================================
PHASE 4 — SCALE BENCHMARKING & CONDITIONAL CONSOLIDATION
================================================================
### 1. Empirical Performance & Soak Telemetry
- **Targets**: Steady-state heap memory <= 110MB; peak <= 124MB.
- **Soak Measurement Protocol**: Record telemetry at intervals `T0`, `T30m`, `T1h`, `T2h`, `T3h`, `T4h` measuring:
  - Resident Set Size (RSS), Heap memory, CPU utilization
  - Event queue depth, Open socket count, Active worker count
  - SQLite WAL file size, CAS blob directory storage size
- **Criterion**: No reproducible unbounded memory growth. Any unexplained growth requires investigation and fix.
- **Selective Alignment**: Apply `#[repr(C, align(64))]` strictly where hardware profiling demonstrates measurable cache-line false sharing.

### 2. Conditional Crate Consolidation (29 -> 18 Crates)
- Benchmark compile times, incremental builds, dependency coupling, test isolation, and binary size before merging.
- Consolidate only when measured engineering benefits exceed maintenance and isolation costs.

================================================================
PER-FEATURE REGRESSION GATE
================================================================
After EVERY non-trivial code modification, execute:
1. `cargo check --workspace`
2. `cargo test --workspace --locked`
3. `cargo clippy --workspace --all-targets -- -D warnings`
4. `npm test`
5. `npm run build`
6. `python architecture/v6/validate_v6_spec.py`
7. Affected state machine, security lifecycle, IPC, and performance tests.

================================================================
FINAL MOCK / PLACEHOLDER AUDIT SCAN
================================================================
Prior to release certification, scan the entire production source tree for all mock, stub, and placeholder patterns:
- `mock`, `dummy`, `fake`, `stub`, `placeholder`, `sample`, `fixture`
- `hardcoded response`, `hardcoded transaction`, `TODO`, `todo!`, `unimplemented!`, `panic!("not implemented")`

Every single match must be audited and classified in the audit log as:
- `[TEST-ONLY]`: Permissible within test files only.
- `[INTENTIONAL]`: Documented protocol constant or fallback.
- `[DEAD CODE]`: Immediately purged.
- `[PRODUCTION BLOCKER]`: Must be replaced with real functional logic before final sign-off.

================================================================
FINAL REAL-WORLD LAB & CLEAN-MACHINE CERTIFICATION GATE
================================================================
### 1. End-to-End Authorized Workflow Execution
Execute the complete workflow on the controlled vulnerable testbed:

  Browser → Proxy → Live Traffic → HTTPQL Filter → AuthZ Matrix 
  → State Testing → Repeater → Fuzzer → Independent Verifier 
  → CAS Merkle Evidence → Finding Promotion → Deduplication 
  → SARIF Report → Automated Retest → Clean Restart & Session Persistence

### 2. Clean-Machine Standalone Release Test
- Build release production binary / installer (`npm run tauri build`).
- Deploy artifact to a clean Windows test environment with **zero development dependencies** (no Node.js, Python, Cargo, Rust toolchain, or terminal runners at runtime).
- Verify: Full native desktop launch, proxy interception, headless Chromium CDP spawn, SQLite WAL creation, request replay, independent finding verification, SARIF report generation, clean shutdown, and restart state recovery.

### 3. Absolute Completion Rule
**DO NOT DECLARE COMPLETE MERELY BECAUSE ALL UNIT/INTEGRATION TESTS PASS.**
Completion strictly requires:
- [ ] 100% verified real runtime behavior across every component (0 mocks in production tree).
- [ ] Real controlled-target detection with seeded flaws identified.
- [ ] Fixed-target rejection (zero false positives on remediated endpoints).
- [ ] Benign-target rejection (zero false alarms on clean endpoints).
- [ ] Independent verification executed by separate worker with registered SEC-06 oracle.
- [ ] Crash recovery and database state persistence validated.
- [ ] 1-Hour Stress Test & 4-Hour Soak Test passed with no reproducible unbounded memory growth.
- [ ] Clean-machine deployment verified with zero dev dependencies.
- [ ] Security Invariants SEC-01 through SEC-12 100% verified.

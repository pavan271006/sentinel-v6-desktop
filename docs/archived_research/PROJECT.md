# Project: UCMA-X (Unified Causal-Metamorphic Adaptive SQL Security Validation Engine)

## Architecture
UCMA-X is a research-grade, causal-metamorphic, adaptive SQL injection detection and authorized database security validation engine implemented in Rust across 34 modular Cargo workspace crates. The architecture replaces legacy payload dictionary brute-forcing with:
1. Centralized fail-closed scope gating (`ucma-scope`) with `AuthorizedRequest` capability tokens.
2. Dialect-aware SQL semantic Intermediate Representation (`ucma-sql-ir`, `ucma-dialect`, `ucma-ast`).
3. Multi-Oracle evidence consensus (Decoupled 5-Oracle Array: Error, Differential, Metamorphic, Causal SCM, Timing Wald SPRT).
4. Judea Pearl Causal Structural Equation Models ($do(\cdot)$ calculus) to disentangle parameter reflection from true SQL syntax perturbation.
5. Metamorphic relational testing (PQS, TLP, NoREC) verifying invariant query equivalence.
6. Wald Sequential Probability Ratio Test (SPRT) on micro-delays ($\tau = 200-400\text{ms}$) under non-stationary network jitter.
7. Bounded Z3 SMT solver with Trie grammar synthesis and Bayesian UCB active-learning experiment planning ($\le 18$ requests/param).
8. Read-only database exploration (`ucma-explorer`, `ucma-db`) strictly preserving non-destructive invariants.
9. Cryptographically provable BLAKE3 CAS Merkle DAG evidence trails (`ucma-evidence`, `ucma-provenance`).
10. Dual-track opaque-box E2E testing suite and multi-DBMS benchmark corpora (50+ Hard-Positive, 50+ Hard-Negative).

## Code Layout
```
ucma-x/
├── Cargo.toml
├── Cargo.lock
├── docs/
│   ├── ARCHITECTURE.md
│   └── SECURITY_MODEL.md
└── crates/
    ├── ucma-core/         # Base domain models, target/request/parameter models, BLAKE3 IDs, in-memory store
    ├── ucma-scope/        # Centralized fail-closed scope policy, SSRF/DNS/redirect validation, AuthorizedRequest
    ├── ucma-http/         # Capability-gated HTTP client wrapper, rate-limiting, timeouts, snapshot recording
    ├── ucma-session/      # Authentication session tracking, cookie jars, token refresh
    ├── ucma-parameter/    # Multi-format parameter extraction (Query, Body, JSON, XML, Multipart, Header)
    ├── ucma-response/     # Dynamic response normalization, HTML/JSON/Text structure diffing
    ├── ucma-sql-ir/       # Unified SQL dialect-independent Semantic Intermediate Representation
    ├── ucma-dialect/      # Dialect syntax & keyword rules (PostgreSQL, MySQL, SQLite, MSSQL, Oracle)
    ├── ucma-ast/          # SQL AST definitions, tree manipulators, serializer
    ├── ucma-grammar/      # Context-free SQL grammar rules, production generators, Trie fallback
    ├── ucma-smt/          # Bounded Z3 SMT boundary & constraint solver (<=50ms timeout)
    ├── ucma-statistics/   # Statistical distributions, Welch t-test, Mann-Whitney U, CUSUM drift detection
    ├── ucma-timing/       # Wald SPRT sequential hypothesis micro-delay engine (tau=200-400ms)
    ├── ucma-metamorphic/  # Relational metamorphic testing engines (PQS, TLP, NoREC invariants)
    ├── ucma-causal/       # Judea Pearl Structural Causal Models, do-calculus reflection disentanglement
    ├── ucma-oracles/      # Decoupled 5-Oracle Array & Bayesian evidence consensus fusion
    ├── ucma-planner/      # Bayesian UCB active-learning test planner (budget <=18 requests/param)
    ├── ucma-detection/    # Detection engine coordination, finding classification, lifecycle state machine
    ├── ucma-state/        # Stateful multi-step interaction modeling & transition tracking
    ├── ucma-second-order/ # Second-order & asynchronous sink correlation engine
    ├── ucma-db/           # Safe read-only database communication interfaces
    ├── ucma-explorer/     # Read-only schema & metadata discovery (information_schema, privileges)
    ├── ucma-evidence/     # BLAKE3 Content-Addressable Storage (CAS) Merkle tree generator (.cas-proof)
    ├── ucma-provenance/   # Cryptographic provenance attestation, execution trace integrity
    ├── ucma-graphql/      # GraphQL query/mutation introspection & AST parameter extraction
    ├── ucma-grpc/         # gRPC Protobuf reflection & payload decoding
    ├── ucma-websocket/    # WebSocket frame capture & message stream testing
    ├── ucma-browser/      # Headless browser automation integration (DOM telemetry, client-rendered sinks)
    ├── ucma-oast/         # Out-of-Band AST server client (stateless token correlation for blind sinks)
    ├── ucma-ml/           # Feature extraction & anomaly scoring helpers
    ├── ucma-rl/           # Reinforcement learning feedback weights for mutator selection
    ├── ucma-report/       # Multi-format report generation (JSON, Markdown, SARIF, CAS Merkle proofs)
    ├── ucma-bench/        # Synthetic benchmark harness, multi-DBMS testbed runners, network jitter injector
    └── ucma-fuzz/         # Adversarial robustness fuzzer & grammar mutator engine
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Safe Foundation Models | Target, Request, Endpoint, Parameter domain models & BLAKE3 IDs | M1 | Survey / Spec | DONE |
| 2 | Fail-Closed Scope Policy | Centralized default-deny scope enforcement, IP/CIDR/Regex matching | M1 | Survey / Spec | DONE |
| 3 | Anti-SSRF & DNS Validation | Loopback, private, link-local IP resolution blocking & pinning | M1 | Survey / Spec | DONE |
| 4 | Hop-by-Hop Redirect Validation | Re-evaluating scope policy on every HTTP redirect hop | M1 | Survey / Spec | DONE |
| 5 | Capability-Gated HTTP Client | `AuthorizedRequest` token required for all network dispatch | M1 | Survey / Spec | DONE |
| 6 | Response Snapshots & In-Memory Store | BLAKE3 raw wire capture, status, headers, body snapshotting | M1 | Survey / Spec | DONE |
| 7 | Benchmark Harness | Benchmark testbed harness with synthetic fixtures | M1 | Survey / Spec | DONE |
| 8 | Multi-Format Parameter Extraction | Query, form, JSON, XML, multipart, header, cookie parsing | M2 | Survey / Spec | PLANNED |
| 9 | Dynamic Response Normalization | Structural tokenization, dynamic content masking, AST diffing | M2 | Survey / Spec | PLANNED |
| 10 | SQL Semantic IR | Dialect-neutral SQL Semantic Intermediate Representation | M2 | Survey / Spec | PLANNED |
| 11 | Dialect Syntax & Lexer Rules | PG, MySQL, SQLite, MSSQL, Oracle keyword & quoting rules | M2 | Survey / Spec | PLANNED |
| 12 | SQL AST Manipulation Engine | Safe AST mutation, boundary injection, serialization | M2 | Survey / Spec | PLANNED |
| 13 | Multi-Protocol Adapters | GraphQL, gRPC Protobuf, WebSocket parameter extractors | M2 | Survey / Spec | PLANNED |
| 14 | Statistical Anomaly Engine | Welch t-test, Mann-Whitney U, CUSUM drift detection | M3 | Survey / Spec | PLANNED |
| 15 | Wald SPRT Micro-Timing Engine | Sequential probability ratio test on micro-delays (200-400ms) | M3 | Survey / Spec | PLANNED |
| 16 | Relational Metamorphic Engine | SQLancer PQS, TLP, NoREC equivalence verification | M3 | Survey / Spec | PLANNED |
| 17 | Causal SCM Intervention Engine | Pearl $do(\cdot)$ calculus for reflection disentanglement | M3 | Survey / Spec | PLANNED |
| 18 | Decoupled 5-Oracle Array | Error, Differential, Metamorphic, Causal, Timing consensus | M3 | Survey / Spec | PLANNED |
| 19 | Bounded Z3 SMT Solver | SMT constraint solver for boundary escape (<=50ms timeout) | M4 | Survey / Spec | PLANNED |
| 20 | Grammar Synthesis & Trie Fallback | Context-free SQL production generator & robust Trie fallback | M4 | Survey / Spec | PLANNED |
| 21 | Bayesian UCB Active Planner | Information-gain test scheduling (budget <=18 requests/param) | M4 | Survey / Spec | PLANNED |
| 22 | Finding Lifecycle State Machine | 10-state formal lifecycle from Observation to Promotion | M4 | Survey / Spec | PLANNED |
| 23 | ML/RL Mutator Weighting | Feedback-guided mutator selection and anomaly scoring | M4 | Survey / Spec | PLANNED |
| 24 | Stateful Multi-Step Engine | State transition tracking for multi-step workflows | M5 | Survey / Spec | PLANNED |
| 25 | Second-Order Injection Engine | Asynchronous source-to-sink correlation and tracking | M5 | Survey / Spec | PLANNED |
| 26 | Out-of-Band (OAST) Integration | Stateless AES-256 token generation & DNS/HTTP callback listener | M5 | Survey / Spec | PLANNED |
| 27 | Headless Browser Integration | DOM telemetry capture and client-rendered sink observation | M5 | Survey / Spec | PLANNED |
| 28 | Read-Only Database Explorer | Non-destructive schema discovery (information_schema) | M5 | Survey / Spec | PLANNED |
| 29 | BLAKE3 CAS Merkle Proof Trees | Cryptographic tamper-evident `.cas-proof` evidence packaging | M6 | Survey / Spec | PLANNED |
| 30 | Provenance Attestation Engine | Cryptographic audit trail linking request to finding | M6 | Survey / Spec | PLANNED |
| 31 | Multi-Format Reporting | JSON, Markdown, SARIF, and CAS Merkle proof exporter | M6 | Survey / Spec | PLANNED |
| 32 | Adversarial Fuzzing Engine | Mutator engine for differential crash and edge-case testing | M6 | Survey / Spec | PLANNED |
| 33 | 50+ Hard-Positive Benchmark Corpus | Seeded real-world vulnerable fixtures across all dialects | M6 | Survey / Spec | PLANNED |
| 34 | 50+ Hard-Negative Benchmark Corpus | High-entropy dynamic web fixtures yielding 0 false positives | M6 | Survey / Spec | PLANNED |
| 35 | E2E Test Suite (100% Pass) | 100% test pass across Tiers 1-4 and Tier 5 adversarial hardening | M6 | Survey / Spec | PLANNED |

## Milestones
| # | Name | Scope Crates | Dependencies | Status |
|---|------|--------------|-------------|--------|
| M1 | Safe Foundation & Scope Control | `ucma-core`, `ucma-scope`, `ucma-http`, `ucma-session`, `ucma-bench` | none | DONE |
| M2 | Semantic IR & Context Inference | `ucma-parameter`, `ucma-response`, `ucma-sql-ir`, `ucma-dialect`, `ucma-ast`, `ucma-graphql`, `ucma-grpc`, `ucma-websocket` | M1 | IN_PROGRESS |
| M3 | Multi-Oracle & Causal Metamorphic Verification | `ucma-statistics`, `ucma-timing`, `ucma-metamorphic`, `ucma-causal`, `ucma-oracles` | M2 | PLANNED |
| M4 | Grammar Synthesis & Adaptive Planning | `ucma-smt`, `ucma-grammar`, `ucma-planner`, `ucma-detection`, `ucma-ml`, `ucma-rl` | M3 | PLANNED |
| M5 | Stateful Testing & Database Explorer | `ucma-state`, `ucma-second-order`, `ucma-oast`, `ucma-browser`, `ucma-db`, `ucma-explorer` | M4 | PLANNED |
| M6 | CAS Provenance & Master Benchmark Suite | `ucma-evidence`, `ucma-provenance`, `ucma-report`, `ucma-fuzz`, Benchmark Corpora | M5 | PLANNED |
| E2E | Opaque-Box E2E Testing Track | `tests/e2e/`, `TEST_INFRA.md`, `TEST_READY.md` (Tiers 1-4) | Independent | DONE (M1) / EXPANDING |

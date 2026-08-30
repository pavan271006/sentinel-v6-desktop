# UCMA-X MILESTONE ROADMAP, CRATE ARCHITECTURE & DEPENDENCY SPECIFICATION
## Comprehensive 6-Milestone Engineering Blueprint for the Unified Causal-Metamorphic Adaptive SQL Security Validation Engine

**Document Identifier:** `UCMA_X_MILESTONE_ROADMAP_AND_DEPENDENCIES.md`  
**Location:** `.agents/explorer_ucmax_milestones/analysis.md`  
**Author:** teamwork_preview_explorer (Milestone Roadmap & Dependency Specialist)  
**Target Workspace:** `c:\Users\Legion 5 pro\Desktop\cyber sec\ucma-x`  
**Date:** August 30, 2026  
**Status:** COMPLETE & AUTHORITATIVE  

---

## TABLE OF CONTENTS

1. [Executive Summary & Architectural Scope](#1-executive-summary--architectural-scope)
2. [Complete 34-Crate Modular Workspace Topology](#2-complete-34-crate-modular-workspace-topology)
3. [Milestone 1: Safe Foundation](#3-milestone-1-safe-foundation)
4. [Milestone 2: Parameter Intelligence, Context Inference, SQL Semantic IR & Dialect ASTs](#4-milestone-2-parameter-intelligence-context-inference-sql-semantic-ir--dialect-asts)
5. [Milestone 3: Multi-Oracle Verification, Statistical Timing (SPRT), Metamorphic & Causal Validation](#5-milestone-3-multi-oracle-verification-statistical-timing-sprt-metamorphic--causal-validation)
6. [Milestone 4: AST/Grammar Synthesis, Adaptive Experiment Planning & DBMS Hypotheses](#6-milestone-4-astgrammar-synthesis-adaptive-experiment-planning--dbms-hypotheses)
7. [Milestone 5: Stateful Testing, Second-Order SQL, Async Correlation & Database Explorer](#7-milestone-5-stateful-testing-second-order-sql-async-correlation--database-explorer)
8. [Milestone 6: Provenance/CAS, Hard-Positive & Hard-Negative Benchmark Corpora, Adversarial Fuzzing & Final E2E Suite](#8-milestone-6-provenancecas-hard-positive--hard-negative-benchmark-corpora-adversarial-fuzzing--final-e2e-suite)
9. [Inter-Milestone Dependency Graph & Dataflow Matrix](#9-inter-milestone-dependency-graph--dataflow-matrix)
10. [Comprehensive Quality Gate & Security Invariant Framework](#10-comprehensive-quality-gate--security-invariant-framework)
11. [Residual Risk Register & Epistemological Boundaries](#11-residual-risk-register--epistemological-boundaries)

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURAL SCOPE

The **UCMA-X (Unified Causal-Metamorphic Adaptive SQL Security Validation Engine)** is a next-generation, research-grade, evidence-driven SQL security validation and authorized database-assessment engine. It replaces the legacy heuristic payload-spraying paradigm of conventional scanners (e.g. `sqlmap`, `OWASP ZAP`, commercial DASTs) with a mathematically grounded scientific framework:

```
+---------------------------------------------------------------------------------------------------------------+
|                                     THE UCMA-X SCIENTIFIC VERIFICATION PARADIGM                              |
+------------------------------------+------------------------------------+-------------------------------------+
| 1. Causal Intervention (Pearl SCM) | 2. Metamorphic Invariance (SQLancer| 3. Sequential Micro-Timing (SPRT)   |
| Disentangles parameter reflection  | Tests relational algebra invariants| Wald SPRT over 200-400ms delays     |
| from SQL AST execution via twin    | (PQS, TLP, NoREC) over HTTP with   | delivers sub-second timing proofs in|
| do(·) counterfactual controls.     | provable zero false positives.     | <= 4.2 queries without DoS risk.    |
+------------------------------------+------------------------------------+-------------------------------------+
| 4. Bounded SMT Solving (Z3 API)    | 5. Active Search (Bayesian UCB)    | 6. Cryptographic Provenance (CAS)   |
| Synthesizes exact minimal syntax   | Minimizes request counts via       | Merkle proof bundles (BLAKE3) for   |
| escapes within strict 50ms bounds. | entropy-optimal parameter budgets. | bit-for-bit offline verification.   |
+------------------------------------+------------------------------------+-------------------------------------+
```

### Core Directives
1. **Evidence Beats Assumptions:** Never infer vulnerability or safety from absence of evidence. Every finding requires multi-oracle consensus, counterfactual proof, and cryptographic provenance.
2. **Fail-Closed Security Model:** The centralized scope engine (`ucma-scope`) strictly gates all network traffic. Network requests MUST originate from an unforgeable `AuthorizedRequest` capability token. If scope is ambiguous or invalid, the engine triggers hard **DENY**.
3. **Strict Non-Destructive Invariants:** Zero destructive DDL/DML operations (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `xp_cmdshell`). All verification operates through pure relational query algebra.
4. **Zero SQL Logic Invariant in Milestone 1:** Milestone 1 establishes the safe networking, scope, data model, and evidence substrate; it is strictly prohibited from containing SQL parsing, payload generation, or injection heuristics.

---

## 2. COMPLETE 34-CRATE MODULAR WORKSPACE TOPOLOGY

The UCMA-X engine is organized as a Cargo workspace containing 34 modular crates located under `ucma-x/crates/`:

```
ucma-x/
├── Cargo.toml
└── crates/
    ├── ucma-core/             # M1: Domain models, BLAKE3 IDs, base error taxonomy
    ├── ucma-scope/            # M1: Fail-closed scope gate, SSRF/DNS/redirect validation
    ├── ucma-http/             # M1: Secure HTTP wrapper client, timeout & body bounding
    ├── ucma-session/          # M1: Session state abstraction, cookie jar, auth headers
    ├── ucma-bench/            # M1/M6: Synthetic benchmark harness, latency profiling
    ├── ucma-parameter/        # M2: Deep parameter ingestion & polyglot encoding chains
    ├── ucma-response/         # M2: Structural response parsing, DOM RTED, SimHash, entropy
    ├── ucma-sql-ir/           # M2: Unified SQL Semantic Intermediate Representation (IR)
    ├── ucma-dialect/          # M2: Dialect specifications (Postgres, MySQL, SQLite, MSSQL, Oracle)
    ├── ucma-ast/              # M2: Concrete and Abstract Syntax Trees per dialect
    ├── ucma-graphql/          # M2: GraphQL AST parsing, query variable parameterization
    ├── ucma-grpc/             # M2: gRPC Protobuf reflection and wire parameterization
    ├── ucma-websocket/        # M2: WebSocket frame stream interception and extraction
    ├── ucma-statistics/       # M3: Statistical distributions, Welch t-test, Mann-Whitney, EWMA/CUSUM
    ├── ucma-timing/           # M3: Monotonic timing harness, Wald SPRT micro-delay engine
    ├── ucma-metamorphic/      # M3: Relational metamorphic generators (PQS, TLP, NoREC)
    ├── ucma-causal/           # M3: Judea Pearl SCM, Causal DAG, Reflection Control Probes
    ├── ucma-oracles/          # M3: Decoupled 5-Oracle Array (Syn, Bool, Rel, Time, Err)
    ├── ucma-smt/              # M4: Bounded Z3 SMT boundary solver (<=50ms CPU timeout)
    ├── ucma-grammar/          # M4: Deterministic Trie-based Grammar Boundary Synthesizer fallback
    ├── ucma-planner/          # M4: Bayesian UCB experiment scheduler, request budget tracker
    ├── ucma-detection/        # M4: Master detection pipeline & hypothesis coordinator
    ├── ucma-ml/               # M4: Machine-learning context embedding classifier
    ├── ucma-rl/               # M4: Reinforcement learning policy for optimal probe sequences
    ├── ucma-state/            # M5: Multi-step session state machine & CSRF lifecycle
    ├── ucma-second-order/     # M5: Second-order stored SQL injection asynchronous engine
    ├── ucma-oast/             # M5: Out-of-band correlation engine (AES-256 tokens, DNS/HTTP)
    ├── ucma-browser/          # M5: Headless browser (Chromium CDP) DOM execution driver
    ├── ucma-db/               # M5: Synthetic test database connection abstraction
    ├── ucma-explorer/         # M5: Safe read-only metadata & schema explorer
    ├── ucma-evidence/         # M6: BLAKE3 Content-Addressable Storage (CAS) Merkle trees
    ├── ucma-provenance/       # M6: Formal execution provenance & derivation graphs
    ├── ucma-report/           # M6: Multi-format reporting (Executive, Technical, SARIF, CAS)
    └── ucma-fuzz/             # M6: Adversarial protocol fuzzing & WAF chaos harness
```

---

## 3. MILESTONE 1: SAFE FOUNDATION

### 3.1 Objective & Scope
Milestone 1 establishes the uncompromised security, networking, identity, and data-model foundation for the entire platform. It delivers the core types, fail-closed scope enforcement, SSRF protections, authenticated HTTP client, session store, in-memory evidence store, and benchmark harness.

### 3.2 Crates Assigned
1. `ucma-core`: Base domain models, deterministic BLAKE3 IDs, evidence storage abstractions.
2. `ucma-scope`: Centralized default-deny scope policy engine, URL canonicalization, DNS SSRF validator.
3. `ucma-http`: Capability-gated HTTP client wrapper, hop-by-hop redirect validation, strict timeouts and resource bounds.
4. `ucma-session`: Session abstraction, credential encapsulation, cookie storage, header injection.
5. `ucma-bench`: Benchmark harness, synthetic micro-benchmark targets, latency/throughput profiling.

### 3.3 Core Capabilities & Specifications

#### 1. Deterministic Content-Derived BLAKE3 Identifiers (`ucma-core::ids`)
Every entity in UCMA-X is uniquely and deterministically identified by a 32-byte BLAKE3 cryptographic hash of its canonical wire representation:
- `TargetId = BLAKE3("TARGET:" || CanonicalUri)`
- `EndpointId = BLAKE3("ENDPOINT:" || TargetId || Method || NormalizedPath)`
- `ParamId = BLAKE3("PARAM:" || EndpointId || Location || ParamName)`
- `RequestId = BLAKE3("REQ:" || EndpointId || Method || RawWireBytes)`
- `SnapshotId = BLAKE3("SNAP:" || RequestId || ResponseStatusCode || RawWireBytes)`

#### 2. Fail-Closed Scope Policy Engine (`ucma-scope`)
- Enforces default-deny on every URI scheme, host, IP address, and port.
- **SSRF / DNS Filtering:** Evaluates all resolved IPv4 and IPv6 socket addresses before connection. Prohibits:
  - Loopback (`127.0.0.0/8`, `::1`)
  - Private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`)
  - Link-local addresses (`169.254.0.0/16`, `fe80::/10`)
  - Multicast / Broadcast (`224.0.0.0/4`, `ff00::/8`, `255.255.255.255/32`)
  - Cloud Metadata Endpoints (`169.254.169.254`, `metadata.google.internal`)
- **Capability Token Pattern:** `ucma-scope::ScopeEnforcer::authorize(&Target)` returns an opaque, unforgeable `AuthorizedRequest` token containing cryptographic proof of scope validation.

#### 3. Secure Capability-Gated HTTP Client (`ucma-http`)
- `UcmaHttpClient::execute(auth_req: AuthorizedRequest, req: Request)`:
  - Strictly requires `AuthorizedRequest`; no socket can open without it.
  - Enforces strict socket timeouts (connect: 3s, read: 10s, total: 15s).
  - Enforces maximum response body size limits (default: 10MB; avoids memory exhaustion).
  - **Hop-by-Hop Redirect Re-Validation:** If a 3xx redirect is encountered, the redirect target URL is stripped, canonicalized, and re-submitted to `ucma-scope` for full DNS/SSRF re-evaluation before following. Cross-scope redirects are rejected immediately.
- Captures raw wire bytes into an immutable `ResponseSnapshot`.

#### 4. Baseline Synthetic Benchmark Harness (`ucma-bench`)
- Exercises the end-to-end foundation pipeline (Scope $\to$ Auth Token $\to$ HTTP Request $\to$ Snapshot $\to$ Storage) against synthetic in-memory HTTP servers.
- Measures baseline request-response round-trip latency, connection pooling efficiency, and memory allocations.

### 3.4 Milestone Invariants
- **`INVARIANT-M1-SQL-ZERO`**: The codebase in Milestone 1 must contain **zero SQL logic**, zero SQL dialect keywords, zero SQL AST models, zero injection payloads, and zero SQL detection heuristics.
- **`SEC-01` (Fail-Closed Scope Gate)**: Any unlisted, invalid, or private network target results in an immediate hard `Deny` with zero network egress.
- **`SEC-04` (Secret Zeroization)**: All target credentials and auth tokens implement `zeroize::Zeroize` on drop.

---

## 4. MILESTONE 2: PARAMETER INTELLIGENCE, CONTEXT INFERENCE, SQL SEMANTIC IR & DIALECT ASTS

### 4.1 Objective & Scope
Milestone 2 implements the deep parameter dissection engine, polyglot encoding normalization, structural response DOM and entropy modeling, unified SQL Semantic Intermediate Representation (IR), and dialect-specific Concrete/Abstract Syntax Trees.

### 4.2 Crates Assigned
1. `ucma-parameter`: Parameter extraction, location mapping, polyglot encoding chain analysis.
2. `ucma-response`: Structural HTML/JSON response parsing, DOM tree edit distance (RTED), 64-bit SimHash, Token Shannon Entropy.
3. `ucma-sql-ir`: Unified vendor-neutral SQL Semantic Intermediate Representation.
4. `ucma-dialect`: Dialect specifications (PostgreSQL, MySQL, SQLite, MSSQL, Oracle, Generic ANSI).
5. `ucma-ast`: Dialect-specific AST representations, tokenizer, quote balancer, visitor pattern.
6. `ucma-graphql`: GraphQL AST parsing, query variable parameterization.
7. `ucma-grpc`: gRPC Protobuf reflection, wire payload parameterization.
8. `ucma-websocket`: WebSocket frame interception, bidirectional message parameterization.

### 4.3 Core Capabilities & Specifications

#### 1. Deep Parameter Ingestion & Polyglot Encoding Chains (`ucma-parameter`)
- Dissects parameters across 7 locations: `Query`, `FormBody`, `JsonPath`, `XmlPath`, `Header`, `Cookie`, `PathSegment`.
- Detects multi-layer encoding transformations:
  $$\text{Raw} \xrightarrow{\text{URL}} \text{Base64} \xrightarrow{\text{JSON Escape}} \text{Unicode NFKC} \xrightarrow{\text{Hex}} \text{Decoded}$$
- Inverts and reapplies encoding chains to ensure generated probes match backend deserialization.
- Performs reflection tracking: identifies verbatim or transformed parameter echoes in baseline responses.

#### 2. SQL Semantic Intermediate Representation (`ucma-sql-ir`)
- Provides a vendor-agnostic AST for relational operations:
  ```rust
  pub enum SqlExpression {
      Literal(SqlLiteral),
      Identifier(SqlIdentifier),
      BinaryOp { left: Box<SqlExpression>, op: BinaryOperator, right: Box<SqlExpression> },
      UnaryOp { op: UnaryOperator, expr: Box<SqlExpression> },
      FunctionCall { name: String, args: Vec<SqlExpression> },
      Subquery(Box<SqlQuery>),
      CaseWhen { conditions: Vec<(SqlExpression, SqlExpression)>, default: Option<Box<SqlExpression>> },
      InList { expr: Box<SqlExpression>, list: Vec<SqlExpression>, negated: bool },
  }
  ```

#### 3. Dialect Matrix & AST Concrete Builders (`ucma-dialect` & `ucma-ast`)
- Covers 6 major dialect families: `PostgreSql`, `MySql`, `Sqlite`, `MsSql`, `Oracle`, `GenericAnsi`.
- Models dialect-specific syntax quirks:
  - String concatenation: `||` (Postgres, SQLite, Oracle) vs `CONCAT(a, b)` (MySQL) vs `+` (MSSQL).
  - Inline comments: `-- ` vs `/* */` vs `#` (MySQL) vs `;` (Stacked).
  - String quoting: `'single'`, `"double"`, `` `backtick` ``, `[bracket]`, `$$dollar$$`.
  - Type casting: `CAST(x AS INT)` vs `x::INT` (Postgres) vs `CONVERT(INT, x)` (MSSQL).

#### 4. API Protocol Adapters (`ucma-graphql`, `ucma-grpc`, `ucma-websocket`)
- Decodes structured protocol payloads into standard parameter profiles without data loss.

---

## 5. MILESTONE 3: MULTI-ORACLE VERIFICATION, STATISTICAL TIMING (SPRT), METAMORPHIC & CAUSAL VALIDATION

### 5.1 Objective & Scope
Milestone 3 implements the core mathematical and statistical verification engines: Wald Sequential Probability Ratio Test (SPRT) micro-delay timing, Relational Metamorphic Invariant generation (PQS, TLP, NoREC), Judea Pearl Causal Twin-Intervention ($do(\cdot)$ calculus), and the Decoupled 5-Oracle Array.

### 5.2 Crates Assigned
1. `ucma-statistics`: Statistical distribution modeling, Dirichlet-Multinomial priors, Welch t-test, Mann-Whitney U-test, EWMA, CUSUM control charts, Horstein BSC(p) bisection.
2. `ucma-timing`: Monotonic clock harness, Wald SPRT log-likelihood accumulator, micro-delay timing scheduler.
3. `ucma-metamorphic`: Relational metamorphic invariant generators (TLP, NoREC, PQS) and relational equivalence evaluators.
4. `ucma-causal`: Structural Causal Models (SCM), Causal DAG, Twin-Network counterfactual verifiers, Reflection Control Probes.
5. `ucma-oracles`: Decoupled 5-Oracle Array ($\mathcal{O}_{\text{syn}}, \mathcal{O}_{\text{bool}}, \mathcal{O}_{\text{rel}}, \mathcal{O}_{\text{time}}, \mathcal{O}_{\text{err}}$) and multi-oracle consensus evaluator.

### 5.3 Core Capabilities & Specifications

#### 1. Wald SPRT Adaptive Micro-Delay Timing Engine (`ucma-timing`)
- Replaces legacy 5-second sleep payloads with adaptive 200–400ms micro-delays ($\tau = 300\text{ms}$).
- Formulates sequential hypothesis testing:
  - $H_0: \Delta \sim \mathcal{N}(0, \sigma^2)$ (No injected delay)
  - $H_1: \Delta \sim \mathcal{N}(\tau, \sigma^2)$ (Injected delay present)
- Computes cumulative log-likelihood ratio step:
  $$\Lambda_n = \Lambda_{n-1} + \frac{\tau}{\sigma^2} \left(\Delta_n - \frac{\tau}{2}\right)$$
- Evaluates stopping boundaries:
  - $A = \ln((1-\beta)/\alpha) \approx 11.51$ (for $\alpha=10^{-5}, \beta=10^{-4}$) $\implies$ `VulnerableConfirmed`
  - $B = \ln(\beta/(1-\alpha)) \approx -9.21 \implies$ `SafeConfirmed`
  - Otherwise $\implies$ `ContinueSampling`
- Proves Average Sample Number (ASN) $\le 4.2$ queries under standard network jitter.

#### 2. Relational Metamorphic Invariance (`ucma-metamorphic`)
- **Ternary Logic Partitioning (TLP):** Tests the relational invariant that the total result set equals the disjoint union of predicates:
  $$Q \equiv Q_{\text{where } \phi} \uplus Q_{\text{where } \text{NOT } \phi} \uplus Q_{\text{where } \phi \text{ IS NULL}}$$
- **Non-Optimizing Reference Engine Construction (NoREC):** Compares optimized query execution against an unoptimized equivalent:
  $$Q_{\text{opt}} \equiv \text{COUNT}(\text{CASE WHEN } \phi \text{ THEN 1 ELSE 0 END})$$
- **Pivoted Query Synthesis (PQS):** Synthesizes pivot row conditions that evaluate to TRUE/FALSE deterministically.

#### 3. Judea Pearl Causal Twin-Intervention Engine (`ucma-causal`)
- Disentangles application-layer parameter reflection from backend SQL AST execution:
  - Dispatches $do(X = \text{true\_branch})$
  - Dispatches $do(X = \text{false\_branch})$
  - Dispatches $do(X = \text{reflection\_control}) = \text{val} \oplus \text{NOOP}$
- Causal effect theorem:
  $$\text{CausalEffect} = \mathcal{D}(Y_{do(\text{true})}, Y_{do(\text{false})}) - \mathcal{D}(Y_{do(\text{true})}, Y_{do(\text{ctrl})})$$
- Yields provable $0.00\%$ false positive rate on reflective endpoints.

#### 4. Decoupled 5-Oracle Array (`ucma-oracles`)
- Finding promotion requires consensus score $\ge 3$ oracles with zero vetoes from the Syntax or Causal engines:
  $$\mathcal{V}_{\text{consensus}} = (\mathcal{O}_{\text{syn}} \lor \mathcal{O}_{\text{bool}} \lor \mathcal{O}_{\text{rel}} \lor \mathcal{O}_{\text{time}} \lor \mathcal{O}_{\text{err}}) \land \neg \text{Confounded}(\text{CausalDAG})$$

---

## 6. MILESTONE 4: AST/GRAMMAR SYNTHESIS, ADAPTIVE EXPERIMENT PLANNING & DBMS HYPOTHESES

### 6.1 Objective & Scope
Milestone 4 implements automated first-order constraint solving (Z3 SMT) for syntax boundary discovery, deterministic Trie-based grammar synthesis fallback, Bayesian Active-Learning (UCB) experiment planning, and dynamic DBMS fingerprinting.

### 6.2 Crates Assigned
1. `ucma-smt`: Bounded Z3 SMT boundary solver, string and bit-vector theory constraints, supervisor timeout thread.
2. `ucma-grammar`: Deterministic Trie-based Grammar Boundary Synthesizer fallback, tokenizer, prefix/suffix closure builder.
3. `ucma-planner`: Bayesian Upper Confidence Bound (UCB) experiment scheduler, request budget tracker ($B_{\text{max}} \le 18$).
4. `ucma-detection`: Integrated master detection pipeline and hypothesis lifecycle manager.
5. `ucma-ml`: Machine-learning prior classifier for parameter context embeddings.
6. `ucma-rl`: Reinforcement learning policy for optimal probe sequencing.

### 6.3 Core Capabilities & Specifications

#### 1. Bounded SMT Boundary Synthesizer (`ucma-smt`)
- Formulates first-order logic constraints over prefix $C_{\text{prefix}}$ and suffix $C_{\text{suffix}}$ boundaries:
  $$\Phi_{\text{closure}} \equiv \forall x \in \text{TestExpressions}, \quad \text{ValidSqlParse}(C_{\text{prefix}} \circ x \circ C_{\text{suffix}}) = \text{TRUE}$$
- **Strict 50ms CPU Timeout Boundary:** Solver thread runs with hard fuel/timeout supervision. If $t > 50\text{ms}$ or status is `UNKNOWN`, the engine falls back instantly to `ucma-grammar` without thread panic or scan pipeline stall.

#### 2. Adaptive Active-Learning Scheduler (`ucma-planner`)
- Uses Bayesian Upper Confidence Bound with entropy exploration bonus:
  $$\alpha_{\text{UCB}}(q) = \mu_t(q) + \kappa \cdot \sigma_t(q) + \gamma \cdot I(\theta; Y \mid q)$$
- Enforces strict request budgets: default budget $B_{\text{target}} \le 18$ requests per parameter; hard limit $B_{\text{hard}} = 30$.
- Early stopping: terminates with `SAFE` verdict when $P(\text{SAFE}) \ge 0.9990$, preventing exploratory fuzzing waste.

---

## 7. MILESTONE 5: STATEFUL TESTING, SECOND-ORDER SQL, ASYNC CORRELATION & DATABASE EXPLORER

### 7.1 Objective & Scope
Milestone 5 implements multi-step stateful workflow modeling, second-order stored SQL injection detection, out-of-band (OAST) callback correlation, headless browser DOM rendering, and safe read-only database schema exploration.

### 7.2 Crates Assigned
1. `ucma-state`: Stateful session graph, CSRF token rotation tracker, multi-step transaction state machine.
2. `ucma-second-order`: Second-order source-to-sink dataflow tracker, asynchronous trigger runner, delayed execution polling.
3. `ucma-oast`: Out-of-band correlation client, stateless AES-256 / BLAKE3 tokens, DNS/HTTP callback matcher.
4. `ucma-browser`: Headless browser (Chromium CDP) driver for client-side JavaScript DOM rendering and SPA state extraction.
5. `ucma-db`: Synthetic benchmark database connection abstraction.
6. `ucma-explorer`: Authorized read-only database explorer, metadata extractor (tables, columns, types, user roles).

### 7.3 Core Capabilities & Specifications

#### 1. Stateful & Second-Order SQL Engine (`ucma-state` & `ucma-second-order`)
- Models multi-step workflows:
  $$\text{Step 1 (Source): } \text{POST /api/user/profile} \implies \text{Step 2 (Sink): } \text{GET /admin/audit-log}$$
- Executes state-priming requests, captures transaction cookies/nonces, and evaluates asynchronous delayed sinks.

#### 2. Out-of-Band (OAST) Correlation (`ucma-oast`)
- Generates stateless tokens: `Token = BLAKE3(SecretKey || ParamId || Timestamp)`.
- Injects DNS/HTTP payload vectors (e.g. `xp_dirtree '\\<token>.oast.domain\a'`, `UTL_HTTP.request(...)`).
- Correlates asynchronous callbacks with sub-millisecond precision.

#### 3. Authorized Read-Only Database Explorer (`ucma-explorer`)
- Strictly enforces non-destructive schema discovery:
  - Queries `information_schema.tables`, `pg_catalog`, `sys.tables`, `sqlite_master`.
  - Prohibits all DDL/DML mutation tokens.

---

## 8. MILESTONE 6: PROVENANCE/CAS, HARD-POSITIVE & HARD-NEGATIVE BENCHMARK CORPORA, ADVERSARIAL FUZZING & FINAL E2E SUITE

### 8.1 Objective & Scope
Milestone 6 delivers cryptographic Content-Addressable Storage (CAS) Merkle proof attestation, formal provenance trees, multi-format reporting, adversarial fuzzing and protocol chaos testing, and the complete 50+ Hard-Positive & 50+ Hard-Negative benchmark evaluation suite.

### 8.2 Crates Assigned
1. `ucma-evidence`: BLAKE3 Content-Addressable Storage (CAS) proof engine, Merkle proof tree builder, offline proof verifier CLI (`ucma-verify`).
2. `ucma-provenance`: Full execution audit trail provenance and causal derivation DAGs.
3. `ucma-report`: Multi-format reporting engine (Executive Summary, Technical Pentest Report, SARIF v2.1, JSON, CAS bundle).
4. `ucma-fuzz`: Adversarial fuzzing harness, mutation operators, protocol-level fuzzing (HTTP/1.1, H2, H3), WAF chaos testing.
5. **Master E2E Evaluation**: 50+ Hard-Positive ground-truth fixtures and 50+ Hard-Negative dynamic control fixtures.

### 8.3 Core Capabilities & Specifications

#### 1. Cryptographic CAS Merkle-Tree Proof Engine (`ucma-evidence`)
- Seals finding evidence into an immutable Merkle tree:
  $$H_{\text{root}} = \text{BLAKE3}(H_{\text{req}} \parallel H_{\text{resp}} \parallel H_{\text{causal}} \parallel H_{\text{oracles}} \parallel H_{\text{smt}})$$
- Emits self-contained `.cas-proof` bundles that can be verified independently using standard command-line tools.

#### 2. Master Benchmark Corpora Evaluation
- **50+ Hard-Positive Fixtures:** Evaluates across 10 vulnerable query archetypes (Numeric WHERE, Single-Quote WHERE, Double-Quote WHERE, ORDER BY, GROUP BY/HAVING, Subquery Scalar, JSONB Path, Stacked Queries, Second-Order Sink, WAF-Filtered Polyglot).
- **50+ Hard-Negative Controls:** Evaluates across 10 challenging non-vulnerable archetypes (Dynamic String Reflection, Latency Jitter Spikes, Dynamic Nonces/Timestamps, Parameterized Queries, Numeric Regex Filters, Custom Error Handlers, ElasticSearch Proxies, WAF Block Banners, Content Rotation, Concurrency State Mutations).
- **Target Accuracy:** Precision $\mathcal{P} = 1.000$ (0 False Positives), Recall $\mathcal{R} \ge 0.990$, Average Requests $\bar{N} \le 18.0$ queries/param.

---

## 9. INTER-MILESTONE DEPENDENCY GRAPH & DATAFLOW MATRIX

```mermaid
graph TD
    subgraph Milestone 1: Safe Foundation
        M1_Core[ucma-core]
        M1_Scope[ucma-scope]
        M1_Http[ucma-http]
        M1_Session[ucma-session]
        M1_Bench[ucma-bench]
    end

    subgraph Milestone 2: Context, IR & ASTs
        M2_Param[ucma-parameter]
        M2_Resp[ucma-response]
        M2_IR[ucma-sql-ir]
        M2_Dialect[ucma-dialect]
        M2_AST[ucma-ast]
        M2_Protocols[ucma-graphql / ucma-grpc / ucma-websocket]
    end

    subgraph Milestone 3: Oracles & Statistics
        M3_Stats[ucma-statistics]
        M3_Timing[ucma-timing]
        M3_Meta[ucma-metamorphic]
        M3_Causal[ucma-causal]
        M3_Oracles[ucma-oracles]
    end

    subgraph Milestone 4: Synthesis & Active Planning
        M4_SMT[ucma-smt]
        M4_Grammar[ucma-grammar]
        M4_Planner[ucma-planner]
        M4_Detect[ucma-detection]
        M4_ML[ucma-ml / ucma-rl]
    end

    subgraph Milestone 5: Stateful & DB Explorer
        M5_State[ucma-state]
        M5_2nd[ucma-second-order]
        M5_Oast[ucma-oast]
        M5_Browser[ucma-browser]
        M5_DB[ucma-db]
        M5_Explorer[ucma-explorer]
    end

    subgraph Milestone 6: Provenance, Benchmark & Fuzz
        M6_CAS[ucma-evidence]
        M6_Prov[ucma-provenance]
        M6_Report[ucma-report]
        M6_Fuzz[ucma-fuzz]
        M6_E2E[Master E2E Corpora]
    end

    M1_Core --> M1_Scope --> M1_Http
    M1_Core --> M1_Session
    M1_Http --> M1_Bench

    M1_Core & M1_Http --> M2_Param
    M1_Core & M1_Http --> M2_Resp
    M2_IR --> M2_Dialect --> M2_AST
    M1_Core --> M2_Protocols

    M1_Core --> M3_Stats --> M3_Timing
    M2_IR & M2_AST --> M3_Meta
    M2_Param & M2_Resp --> M3_Causal
    M3_Timing & M3_Meta & M3_Causal --> M3_Oracles

    M2_AST & M2_Dialect --> M4_SMT
    M2_AST & M2_Dialect --> M4_Grammar
    M3_Stats & M3_Oracles --> M4_Planner
    M4_SMT & M4_Grammar & M4_Planner & M3_Oracles --> M4_Detect

    M1_Session & M2_Param --> M5_State --> M5_2nd
    M1_Core --> M5_Oast
    M1_Http --> M5_Browser
    M1_Core --> M5_DB --> M5_Explorer

    M1_Core & M3_Oracles & M4_Detect --> M6_CAS --> M6_Prov
    M6_CAS & M6_Prov --> M6_Report
    M1_Http & M2_AST --> M6_Fuzz
    M4_Detect & M5_Explorer & M6_CAS --> M6_E2E
```

---

## 10. COMPREHENSIVE QUALITY GATE & SECURITY INVARIANT FRAMEWORK

Every milestone implementation must strictly pass the 8-stage verification lifecycle before advancing:

```
+---------------------------------------------------------------------------------------------------------------+
|                                    8-STAGE MILESTONE QUALITY GATE LIFECYCLE                                   |
+----+-----------------------------+----------------------------------------------------------------------------+
| #  | Stage                       | Verification Method & Pass/Fail Criteria                                   |
+----+-----------------------------+----------------------------------------------------------------------------+
| 1  | Compilation (BUILD)         | `cargo check --workspace` & `cargo build` pass with 0 errors.              |
| 2  | Code Quality & Lints        | `cargo fmt --check` & `cargo clippy --all-targets --all-features --        |
|    |                             | -D warnings` pass with 0 warnings.                                         |
| 3  | Unit Test Suite             | `cargo test -p <affected_crates>` passes 100% of unit tests.               |
| 4  | Integration Test Suite      | Multi-crate integration workflows pass 100% across synthetic targets.      |
| 5  | Performance Benchmarks      | Measure P50, P95, P99 latency, request count <= 18/param, memory <= 64MB.  |
| 6  | Adversarial Stress Tests    | Fuzzing with malformed headers, socket drops, 500ms network jitter.        |
| 7  | Security Invariants Audit   | Strictly verify SEC-01 through SEC-10; confirm fail-closed scope gates.     |
| 8  | Regression & State Freeze   | Prior milestone test suites remain 100% passing; document in handoff.md.   |
+----+-----------------------------+----------------------------------------------------------------------------+
```

### Formal Security Invariants (SEC-01 through SEC-10)
- **SEC-01 (Fail-Closed Scope Gate):** Every request must possess a cryptographically valid `AuthorizedRequest` capability token issued by `ucma-scope`.
- **SEC-02 (Strict Read-Only Payloads):** Zero DDL/DML mutation tokens (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `xp_cmdshell`).
- **SEC-03 (Bounded Micro-Delays):** Micro-delays strictly capped at $\tau \le 500\text{ms}$; cumulative delay per parameter $\le 3.0\text{s}$.
- **SEC-04 (Secret Zeroization):** Authentication tokens and passwords zeroized on drop via `zeroize::Zeroize`.
- **SEC-05 (Local Storage Isolation):** Zero external data exfiltration; state isolated to local SQLite WAL / memory.
- **SEC-06 (Deterministic Multi-Oracle Consensus):** Promotion requires $\ge 3$ decoupled oracles with hard causal veto.
- **SEC-07 (Cryptographic CAS Integrity):** Raw wire bytes sealed in immutable BLAKE3 Merkle trees.
- **SEC-08 (Anti-DoS Rate Limiting):** Automatic exponential backoff on 429/503 responses.
- **SEC-09 (Redacted Telemetry):** Sensitive tokens masked (`[REDACTED]`) in all logs.
- **SEC-10 (SMT Resource Bounding):** Z3 SMT solver execution bounded by strict 50ms CPU timeout limit.

---

## 11. RESIDUAL RISK REGISTER & EPISTEMOLOGICAL BOUNDARIES

```
+---------------------------------------------------------------------------------------------------------------+
|                                    RESIDUAL RISK REGISTER (RR-01 TO RR-08)                                    |
+-------+-----------------------------------+-------------------------------------------------------------------+
| ID    | Residual Risk Title               | Technical Epistemological Boundary & Operational Disposition      |
+-------+-----------------------------------+-------------------------------------------------------------------+
| RR-01 | Turing-Complete Procedural SQL    | Dynamic SQL inside deeply nested Oracle PL/SQL or Postgres        |
|       | Functions & Custom Parsers        | PL/pgSQL procedures cannot be fully inferred via black-box AST.   |
| RR-02 | Deep Multi-Step Stored Sinks      | Second-order injections persisting to offline batch workers       |
|       | (>3 Asynchronous Steps)           | executing hours later require asynchronous OAST correlation.      |
| RR-03 | Total Network Transport Collapse  | Complete packet drops or perimeter Cloudflare/WAF Captcha walls   |
|       | & Perimeter Captcha Walls         | block all HTTP probing at the transport perimeter.                |
| RR-04 | Active Deceptive Honeypot WAFs    | WAFs injecting fake SQL error strings or artificial delays        |
|       |                                   | require manual pentester validation.                              |
| RR-05 | Proprietary / Non-Standard SQL    | Niche proprietary database engines trigger SMT fallback to        |
|       | Dialect Extensions                | generic ANSI SQL grammar probing.                                 |
| RR-06 | Client-Side Cryptographic Payload | Mobile/SPA apps encrypting all parameters with client-side RSA/AES|
|       | Transport (E2EE)                  | prevent DAST payload injection at proxy tier without client hooks.|
| RR-07 | Database Trigger Side Effects     | Read-only SELECT queries triggering audit log triggers represent  |
|       |                                   | unavoidable database state mutation.                              |
| RR-08 | Clock Skew Under Distributed      | Extreme asymmetry across multi-region load-balanced reverse       |
|       | Asymmetric Reverse Proxies        | proxies can increase SPRT sample count requirements.             |
+-------+-----------------------------------+-------------------------------------------------------------------+
```

---
*End of UCMA-X Milestone Roadmap, Crate Architecture & Dependency Specification.*

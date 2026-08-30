# UCMA-X — Modern SQL Security Coverage & Runtime Audit Matrix
**Version:** 3.1-AUDIT  
**Scope:** Modern Web Application SQL Security, DAST Detection, Runtime Verification & Architectural Gaps  
**Standard:** OWASP WSTG, CWE-89, Academic SQLi Research (2020–2026), Empirical Code Audit

---

## 1. Executive Summary & Codebase Ground Truth

An exhaustive audit of the UCMA-X / Sentinel codebase (`src/services/sqlScanner/*` and `ucma-x/crates/*`) reveals a significant divergence between **Taxonomic Specification / Scaffolding** and **Active Runtime Production Execution**:

1. **Current Production Scan Path (`SqlScanOrchestrator.ts`)**: Operates as a **deterministic, linear probe sequencer** (Error → Boolean → Time → Stacked → UNION → Schema Extraction). It does *not* execute dynamic Bayesian belief updating or Information Gain optimization during live network probing.
2. **Rust Native Intelligence (`ucma-x/crates/`)**: Crates like `ucma-planner`, `ucma-causal`, `ucma-ast`, and `ucma-statistics` exist as modular implementations and benchmark testbeds, but are **not linked to the active Tauri IPC scanning hot-path** (`ipcClient.sendRepeaterRequest()`).
3. **AST Runtime Coverage**: `PARTIAL / SCAFFOLDED`. In-flight network payloads are constructed via parameterized string templates rather than real-time dialect AST compilation.
4. **Adaptive Gating**: Partially active in `AdaptivePayloadEngine.ts` (calibration-based quote-style and marker extraction), but the macro-level engine mode dropdown (`ucmax_causal`, `bayesian_adaptive`, `sprt_timing`, `standard`) routes to the same sequential orchestrator loop.

---

## 2. Priority Classification for Modern Web Applications

* **P0 (Critical / High-Frequency Modern Web)**:
  * Parameterized string breakout in REST JSON APIs and GraphQL variables.
  * ORM escape-hatch injections (`whereRaw()`, `literal()`, dynamic column sorting in `ORDER BY`).
  * Differential boolean-blind and error-based CAST data leaks in PostgreSQL / MySQL 8+ / MSSQL.
  * Fast WAF evasion via whitespace alternatives and transport switching.
  * Cookie / Header parameter injection in auth and telemetry pipelines.
* **P1 (Important / Architecture-Dependent)**:
  * Multi-step Second-Order SQLi across API endpoints (e.g., registration profile → admin grid).
  * Out-of-Band (OAST) DNS/HTTP callback validation for totally blind sinks.
  * High-concurrency schema and column metadata enumeration via UNION/CAST.
  * Dialect-specific blind timing under high-jitter network environments.
* **P2 (Specialized / DBMS-Dependent)**:
  * Stored procedure parameter breakouts and dynamic SQL (`EXECUTE IMMEDIATE`).
  * Cloud/distributed federated queries (BigQuery, Snowflake, Presto/Trino).
  * Postgres Large Object / MySQL `LOAD_FILE` filesystem operations.
  * Database driver charset discrepancies (GBK / Big5 multibyte truncation).
* **P3 (Historical / Research-Only / Rarely Observable)**:
  * Legacy MySQL `<5.5` `PROCEDURE ANALYSE()` or `BENCHMARK()` CPU exhaustion.
  * Oracle `RAWTOHEX` / `LNNVL` keyword identification on modern cloud targets.
  * Direct OS command execution via `xp_cmdshell` (disabled by default on all modern cloud RDS/managed DBs).
  * Non-optimizing optimizer bugs (SQLancer-style DBMS engine bug fuzzing vs. app-level vulnerability detection).

---

## 3. Comprehensive Technique Audit Matrix

| ID | Technique / Attack Vector | Priority | Modern Relevance | Current App (TS) | UCMA-X (Rust) | Runtime Active? | Benchmark | Hidden Generalization | DBMS Coverage | Oracle Channel | Audit Status & Gap Analysis |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **T01** | Boolean Differential (Single-Quote) | P0 | Universal | `BooleanTester.ts` | `ucma-oracles` | **YES** | PASS | High | All | Status, Body, DOM | **PRODUCTION READY**. Token diff filter suppresses echoes. |
| **T02** | Boolean Differential (Numeric / Unquoted) | P0 | Universal | `BooleanTester.ts` | `ucma-oracles` | **YES** | PASS | High | All | Status, Body | **PRODUCTION READY**. |
| **T03** | Error-Based CAST Type Coercion | P0 | Extremely Common | `ErrorTester.ts` | `ucma-detection` | **YES** | PASS | High | PG, MSSQL, MySQL | Regex / Body | **PRODUCTION READY**. Leaks table/column names directly. |
| **T04** | UNION Canary & Column Discovery | P0 | Standard In-Band | `UnionTester.ts` | `ucma-sql-ir` | **YES** | PASS | High | All | Reflection Marker | **PRODUCTION READY**. 12-column sweep + NULL fallback. |
| **T05** | Time-Based Blind Delay (Sleep/WAITFOR) | P0 | Common Blind | `TimeBasedTester.ts`| `ucma-timing` | **YES** | PASS | Medium | All | Latency Shift | **PRODUCTION ACTIVE**. Standard fixed delay; SPRT in Rust scaffolded. |
| **T06** | JSON Body / Nested Field Injection | P0 | Modern API Standard| `RequestParser.ts` | `ucma-parameter`| **YES** | PASS | High | All | Multi-Oracle | **PRODUCTION ACTIVE**. Parses and replaces JSON keys. |
| **T07** | Cookie-Based Injection (Clean Replace) | P0 | Modern Auth/Tracking| `SqlScanOrchestrator`| `ucma-http` | **YES** | PASS | High | All | Multi-Oracle | **PRODUCTION ACTIVE**. Full replacement avoids cookie truncation. |
| **T08** | Dynamic `ORDER BY` Sorting Injection | P0 | High (ORM dynamic sort)| `ContextDetector.ts`| `ucma-grammar` | **PARTIAL** | PART | Medium | All | Status / Error / Blind | **PARTIAL**. Detects context, needs CASE-differential execution. |
| **T09** | WAF Whitespace / Comment Evasion | P0 | Modern Perimeter Def| `AdaptivePayload` | `ucma-dialect` | **PARTIAL** | PART | Medium | MySQL, PG, MSSQL | Multi-Oracle | **PARTIAL**. Uses comments/balancing; lacks dynamic HPP fragmentation. |
| **T10** | Multilingual Schema Discovery (information_schema)| P0 | Universal Discovery| `MetadataExtractor` | `ucma-explorer` | **YES** | PASS | High | PG, MySQL, MSSQL | In-Band Delimiters | **PRODUCTION READY**. 3-tier fallback (UNION → CAST → Boolean). |
| **T11** | Out-of-Band (OAST) DNS/HTTP Callback | P1 | Blind Firewalled Sinks| `OobManager.ts` | `ucma-oast` | **SCAFFOLDED** | SCAF | Low | PG, MySQL, Oracle| External Listener | **SCAFFOLDED**. Payload generators exist; requires live polling gateway. |
| **T12** | Multi-Step Second-Order Workflow | P1 | High in Complex Apps| `SecondOrderTester`| `ucma-second-order`| **SCAFFOLDED** | SCAF | Low | All | Cross-Endpoint State | **SCAFFOLDED**. Basic 2-request link; lacks persistent workflow state machine. |
| **T13** | GraphQL Variable / Argument Injection | P1 | Modern GraphQL API | `RequestParser.ts` | `ucma-graphql` | **PARTIAL** | SCAF | Medium | All | Multi-Oracle | **PARTIAL**. JSON-variable injection works; GraphQL AST resolver is scaffolded. |
| **T14** | Wald SPRT Sequential Latency Testing | P1 | Noisy Network Blind | Simple StdDev TS | `ucma-statistics` | **BENCHMARK**| PASS (Rust)| High | All | SPRT LLR Threshold | **BENCHMARK-ONLY**. Implemented in Rust, not wired to TS scan loop. |
| **T15** | 5-Step Causal Verification Pipeline | P1 | 0% False Positive Proof| Scaffolding in TS | `ucma-causal` | **BENCHMARK**| PASS (Rust)| High | All | Counterfactual Proof | **BENCHMARK-ONLY**. UI shows visual step feed; full causal math is in Rust. |
| **T16** | Bounded Concurrent Execution (10-50x)| P1 | Scan Throughput | Sequential (1x TS)| `ucma-http` pool | **SCAFFOLDED** | PART | Medium | All | Throughput | **SCAFFOLDED**. `executeProbe()` runs serially; concurrent executor planned. |
| **T17** | Text-to-SQL / Prompt Inversion Injection| P2 | AI-Enabled Apps | None | `ucma-metamorphic`| **RESEARCH** | RES | Low | LLM + SQL | Model Output Leak | **RESEARCH-ONLY**. Prompt payload taxonomy defined; DAST oracle pending. |
| **T18** | Driver Charset Mismatch (GBK / Big5) | P2 | Legacy / Regional | None | `ucma-dialect` | **MISSING** | MIS | Low | MySQL + PHP | Syntax Breakout | **MISSING IN RUNTIME**. |
| **T19** | Postgres Large Object / File Read | P2 | High Privilege Only | None | `ucma-explorer` | **MISSING** | MIS | Low | PostgreSQL | Filesystem Read | **MISSING**. Non-essential for baseline vulnerability detection. |
| **T20** | Legacy `PROCEDURE ANALYSE()` / `exp()`| P3 | EOL Systems Only | `ErrorTester.ts` | None | **DEPRECATED** | N/A | Low | MySQL <5.7 | Error regex | **LOW VALUE / DEPRECATED**. Dropped in MySQL 8.0. |

---

## 4. Modern Application Surface Audit

| Ingress Surface | Parser Support | Injection Serializer | Concurrency Safe? | Audit Status | Required Action |
|:---|:---|:---|:---|:---|:---|
| **HTTP Query Parameters** | Full (`RequestParser.ts`) | Clean value replacement | `PARALLEL_SAFE` | **SUPPORTED** | None |
| **HTTP Form URL-Encoded** | Full (`RequestParser.ts`) | Clean value replacement | `PARALLEL_SAFE` | **SUPPORTED** | None |
| **JSON Request Bodies** | Full (`RequestParser.ts`) | Key traversal & injection | `PARALLEL_SAFE` | **SUPPORTED** | Add array-index and nested key paths |
| **HTTP Headers (`User-Agent`, `X-*`)**| Full (`RequestParser.ts`)| Header value injection | `PARALLEL_SAFE` | **SUPPORTED** | None |
| **HTTP Cookies** | Full (`RequestParser.ts`) | Full replacement (`append=false`)| `SESSION_SENSITIVE`| **SUPPORTED** | Isolate session cookies from parameter cookies |
| **Multipart / Form-Data** | Partial (`RequestParser.ts`)| Boundary preservation | `PARALLEL_SAFE` | **PARTIAL** | Add filename header injection vector |
| **GraphQL Variables** | Partial (as JSON body) | JSON value replacement | `PARALLEL_SAFE` | **SUPPORTED** | Native GraphQL document mutation |
| **GraphQL Direct Inline Arguments**| Missing | String replacement | `PARALLEL_SAFE` | **SCAFFOLDED** | Wire `ucma-graphql` AST visitor |
| **WebSockets (RFC 6455 Frames)** | Scaffolded (`ucma-websocket`)| Frame serialization | `STATE_DEPENDENT` | **SCAFFOLDED** | Bridge WebSocket client to UI scanner |
| **gRPC / Protobuf Payloads** | Scaffolded (`ucma-grpc`) | Protobuf tag injection | `PARALLEL_SAFE` | **SCAFFOLDED** | Add gRPC dynamic reflection caller |
| **Background / Async Queues** | Scaffolded (`ucma-second-order`)| Multi-request poller | `STATE_DEPENDENT` | **SCAFFOLDED** | Implement poll-interval retry state machine |

---

## 5. Explicit Answers to the 11 Audit Questions

### Q1: Which SQLi techniques are genuinely common/relevant on modern web apps?
1. **JSON-transport boolean and error-based injections** in microservice REST APIs.
2. **ORM raw query escape-hatches** (`whereRaw()`, dynamic `ORDER BY` / sorting columns).
3. **CAST/CONVERT type coercion error leaks** in PostgreSQL, SQL Server, and MySQL 8.
4. **Header/Cookie telemetry injection** passing unescaped data into audit/logging databases.
5. **GraphQL variable injection** resolving to unparameterized backend database queries.
6. **Multi-step Second-Order SQLi** (profile/registration data rendered in backend admin views).
7. **WAF evasion via character encoding/whitespace alternatives** (comments, URL double encoding).

### Q2: Which of those does UCMA-X actually detect today?
- Full detection for: (1) JSON body injection, (2) Cookie clean replacement, (3) PostgreSQL/MSSQL CAST error extraction, (4) In-band UNION canary & column discovery, (5) Differential boolean string/numeric testing with echo suppression, (6) 3-tier schema/table/column/row enumeration.

### Q3: Which are only scaffolded?
- **Out-of-Band (OAST) listener correlation** (`OobManager.ts` & `ucma-oast`).
- **Second-Order multi-request workflow state machine** (`SecondOrderTester.ts` & `ucma-second-order`).
- **GraphQL inline query AST rewriting** (`ucma-graphql`).
- **Bounded concurrent execution engine** (currently probes execute serially).

### Q4: Which are benchmark-only?
- **Wald's SPRT sequential probability ratio testing** (`ucma-x/crates/ucma-statistics`).
- **5-Step Causal Counterfactual Proof verification** (`ucma-x/crates/ucma-causal`).
- **Relational Metamorphic testing (TLP / NoREC)** (`ucma-x/crates/ucma-metamorphic`).

### Q5: Which require capabilities we currently lack?
- **Live external OAST infrastructure**: A public DNS/HTTP nameserver endpoint to catch asynchronous network callbacks.
- **Bi-directional WebSocket/gRPC streaming IPC**: Tauri IPC currently supports HTTP request/response repeater calls; streaming protocols require a long-lived socket bridge.

### Q6: Which historical techniques should NOT receive implementation priority?
- **MySQL `<5.5` `PROCEDURE ANALYSE()` / `exp()` overflows**: Completely obsolete in modern MySQL 8+.
- **`xp_cmdshell` / OS command execution scripts**: Managed cloud databases (AWS RDS, Aurora, Cloud SQL, Azure SQL) disallow or strip OS-level command privileges by default; focusing on data-tier discovery is 100x more valuable.
- **Oracle keyword-only discovery (`LNNVL`, `RAWTOHEX`)**: Low practical impact compared to standard DUAL / CAST queries.

### Q7: What modern techniques are completely missing?
- **Multibyte GBK/Big5 character set mismatch injection** (PHP PDO emulated prepares).
- **Dynamic ORM sorting predicate inference** (CASE-based blind differential in `ORDER BY` position).
- **Relational partition boundary verification** in production HTTP scan path.

### Q8: Is the current scanner actually adaptive?
- **At the micro-level (Response Calibration)**: **YES**. `AdaptivePayloadEngine.ts` dynamically evaluates quote style (balanced vs commented) and baseline token differentials.
- **At the macro-level (Test Planning)**: **NO**. `SqlScanOrchestrator.ts` runs a static, sequential list of tests regardless of prior evidence, and the UI engine mode dropdown does not alter the execution algorithm.

### Q9: Is AST actually in the production path?
- **NO**. Active scanning in TypeScript uses string template interpolation. The Rust AST crate (`ucma-ast`) is used only in native benchmark test suites.

### Q10: Is 50-way concurrency safe/effective for each test category?
- **`PARALLEL_SAFE` (Schema/Column discovery, independent parameter checks)**: **SAFE & HIGHLY EFFECTIVE** (reduces scan time by 80–90%).
- **`TIMING_SENSITIVE` (SPRT sleep probes)**: **UNSAFE in parallel**. Network congestion causes false positives. Must run in a dedicated sequential lane.
- **`STATE_DEPENDENT` / `SESSION_SENSITIVE` (Second-order, Auth cookies)**: **UNSAFE in parallel**. Must maintain session affinity and sequential execution.

### Q11: What is the smallest set of changes needed to make the scanner materially stronger against modern web applications?
1. **Wire the Adaptive Planner to `SqlScanOrchestrator.ts`**: Replace the linear test loop with the Bayesian EIG selection model.
2. **Implement Bounded Concurrency (`ConcurrentExecutor.ts`)**: Default to 10 parallel workers for `PARALLEL_SAFE` metadata extraction and parameter sweeps.
3. **Add Early Stopping**: Halt boolean/error testing immediately upon 3/3 confirmation or CAST data extraction.
4. **Implement CASE-based `ORDER BY` blind evaluation**: Support unquoted sorting parameters in modern REST APIs.

---

## 6. Categorized Master Summary

```
========================================================================================
CURRENTLY COVERED (Production Validated)
========================================================================================
- Boolean-Blind Differential Testing (String, Numeric, Quoted, Parenthesized)
- Zero-FP Differential Echo Filter & Baseline Deviation Analysis
- Error-Based CAST / Type Conversion Exploitation (PostgreSQL, MSSQL, MySQL)
- UNION-Based Canary Reflection & Dynamic Column Count Sweep (1-12 cols)
- Multi-Tier Automated Database Explorer (Tables -> Columns -> Sample Rows)
- Cookie-Clean Replacement Mode (Full value substitution without truncation)
- REST JSON Body & URL Query Parameter Auto-Discovery
- Multi-Sample Baseline Traffic & Jitter Measurement

========================================================================================
PARTIALLY COVERED (Scaffolded in TypeScript / Implemented in Rust Benchmarks)
========================================================================================
- Bounded Concurrent Worker Pool (Scaffolded, currently runs serially in TS)
- Bayesian Adaptive Test Selection / EIG Optimization (Implemented in Rust, scaffolded in TS)
- Wald's SPRT Sequential Latency Analysis (Implemented in Rust, basic std-dev in TS)
- 5-Step Counterfactual Causal Verification (Implemented in Rust, UI feed in TS)
- GraphQL Variable Injection (JSON body covered, GraphQL document AST scaffolded)
- WAF Evasion / Keyword Mutation Engine (Partial comment/case variants)

========================================================================================
MISSING (High-Priority Gaps to Implement)
========================================================================================
- CASE-Based Dynamic ORDER BY / Sorting Parameter Invariant Engine
- Asynchronous Workflow Polling State Machine for Multi-Step Second-Order SQLi
- Out-of-Band (OAST) Interactive Gateway Listener Bridge
- Multibyte Charset / Emulated Prepared Statement Encoding Vectors

========================================================================================
LOW-VALUE / HISTORICAL (Do Not Prioritize)
========================================================================================
- Obsolete MySQL <5.5 Error Functions (`PROCEDURE ANALYSE`, `exp()` overflow)
- Operating System Command Execution (`xp_cmdshell`, UDF injection on cloud DBs)
- Archaic Oracle Proprietary Predicate Functions (`LNNVL`, `RAWTOHEX`)
========================================================================================
```

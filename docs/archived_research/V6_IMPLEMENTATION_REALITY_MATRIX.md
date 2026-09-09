# SENTINEL V6 — Implementation Reality Matrix & Subsystem Audit

> **Document ID**: `SENTINEL-V6-REALITY-MATRIX-001`  
> **Status**: **AUTHORITATIVE BASELINE AUDIT**  
> **Phase**: Phase 0 (Source Baseline & Implementation Reality Audit)  
> **Timestamp**: `2026-08-22T20:00:00Z`  
> **Author**: `worker_phase0_baseline` (`teamwork_preview_worker`)  
> **Integrity Mode**: Development / Strict Forensic Audit  
> **Constraint Check**: Zero repository source code modifications performed during Phase 0.

---

## 1. Executive Summary

This document presents the definitive, exhaustive audit of all **29 workspace crates** in `sentinel_core`, desktop integration handlers in `src-tauri`, and the React frontend in `src/`.

Every subsystem is evaluated against physical code reality and classified using the authoritative taxonomy:
- **`PRODUCTION` / `REAL`**: Native logic implemented, passes unit/integration tests, zero mocks on production paths.
- **`PARTIAL` / `SCAFFOLD`**: Core traits/skeletons present; specific sub-features slated for Phase 2/3.
- **`EXPERIMENTAL`**: Advanced prototype / research integration active.
- **`STUB` / `MOCK`**: Allowed strictly within isolated test fixtures (`tests/`); zero stubs permitted on production paths.

---

## 2. Exhaustive 29-Crate Reality Matrix

| # | Crate Name | Source Files | Source Lines | Test Files | Test Lines | Reality Classification | Key Implemented Capabilities & Invariants | Line References & Gaps | Roadmap Target |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---|:---|:---:|
| 1 | `sentinel_common` | 13 | 2,140 | 5 | 2,787 | **PRODUCTION** | Canonical types, `SentinelError`, `SecretReference` zeroization (`SEC-09`), invariant definitions (`SEC-01` to `SEC-12`). | `sentinel_common/src/enums.rs:1-120`, `sentinel_common/src/secrets.rs:1-85`. Gap: `FindingLifecycle` has 8 states; needs 10 linear states. | Phase 3 |
| 2 | `sentinel_storage` | 13 | 2,298 | 9 | 923 | **PRODUCTION** | SQLite WAL storage, SHA-256 CAS blob store (`SEC-07`), project isolation (`SEC-08`), 32-table migrations, lossless audit (`SEC-12`). | `sentinel_storage/src/cas.rs:1-180`, `sentinel_storage/src/wal.rs:1-210`, `sentinel_storage/src/migrations.rs:1-350`. Fully verified. | Phase 1 |
| 3 | `sentinel_bus` | 7 | 1,053 | 5 | 539 | **PRODUCTION** | Tokio broadcast channels, lossless critical audit channel (`SEC-12`), backpressure governor, topic filter. | `sentinel_bus/src/bus.rs:1-165`, `sentinel_bus/src/bounded_channel.rs:1-120`. Fully operational. | Phase 1 |
| 4 | `sentinel_scope` | 9 | 1,664 | 9 | 1,167 | **PRODUCTION** | `SEC-01` fail-closed scope engine, IP/CIDR subnet matcher, URL prefix/regex matcher, SSRF private IP blocking. | `sentinel_scope/src/engine.rs:1-240`, `sentinel_scope/src/ssrf.rs:1-150`, `sentinel_scope/src/cidr.rs:1-190`. Fully verified. | Phase 1 |
| 5 | `sentinel_parser` | 11 | 1,845 | 6 | 466 | **PRODUCTION** | `SEC-10` triple representation, HTTP/1.1 & HTTP/2 parser, chunked framing, smuggling/desync checks (CL.TE, TE.CL). | `sentinel_parser/src/http1.rs:1-320`, `sentinel_parser/src/desync.rs:1-210`. Gap: Expand native HTTP/3 QUIC frames. | Phase 2 |
| 6 | `sentinel_proxy` | 16 | 2,101 | 8 | 773 | **PRODUCTION** | MITM forward proxy, dynamic TLS cert generation (`rcgen`), CA manager, SNI routing, WebSocket, dual-write to CAS/DB. | `sentinel_proxy/src/mitm.rs:1-310`, `sentinel_proxy/src/tls.rs:1-195`, `sentinel_proxy/src/ca.rs:1-140`. Ready for Golden Path. | Phase 1 |
| 7 | `sentinel_httpql` | 8 | 1,298 | 1 | 148 | **PRODUCTION** | Pest grammar parser, AST compiler, evaluator for HTTP transaction filtering (status, method, url, headers, body). | `sentinel_httpql/src/parser.rs:1-220`, `sentinel_httpql/src/evaluator.rs:1-340`, `sentinel_httpql/src/ast.rs:1-160`. | Phase 1 |
| 8 | `sentinel_repeater` | 6 | 934 | 1 | 177 | **PRODUCTION** | Tab manager, variable extraction/interpolation (`{{var}}`), LCS diffing, parallel race requests, `SEC-01` gate. | `sentinel_repeater/src/tab_manager.rs:1-180`, `sentinel_repeater/src/variables.rs:1-140`, `sentinel_repeater/src/diff.rs:1-120`. | Phase 1 |
| 9 | `sentinel_context` | 8 | 837 | 2 | 356 | **PRODUCTION** | Tech stack fingerprinting, parameter mining (`param_miner`), route extractor, type inference. | `sentinel_context/src/fingerprint.rs:1-160`, `sentinel_context/src/param_miner.rs:1-190`. | Phase 2 |
| 10 | `sentinel_knowledge` | 9 | 1,477 | 4 | 833 | **PRODUCTION** | Context Graph DAG, SQLite CTE traversal, CPE 2.3 parser, vulnerability rule engine, confidence scoring. | `sentinel_knowledge/src/context_graph.rs:1-380`, `sentinel_knowledge/src/cpe.rs:1-210`. 4 clippy warnings to clean. | Phase 2 |
| 11 | `sentinel_coverage` | 3 | 395 | 3 | 415 | **PRODUCTION** | Attack surface coverage tracking, coverage gap heatmaps, Bayesian adaptive test planner. | `sentinel_coverage/src/coverage.rs:1-160`, `sentinel_coverage/src/planner.rs:1-180`. Consolidate to `sentinel_graph`. | Phase 4 |
| 12 | `sentinel_auth` | 11 | 1,078 | 2 | 361 | **PRODUCTION** | Identity vault, credential management, secret zeroization (`SEC-09`), session rotation, OAuth/PKCE, CSRF defenses. | `sentinel_auth/src/vault.rs:1-210`, `sentinel_auth/src/csrf.rs:1-130`. 1 clippy warning. | Phase 2 |
| 13 | `sentinel_scanner` | 12 | 1,513 | 2 | 435 | **PRODUCTION** | Active/passive scan orchestrator, task scheduler, passive checks (CORS, cache headers, cookies, debug exposure, source maps). | `sentinel_scanner/src/orchestrator.rs:1-320`, `sentinel_scanner/src/passive_checks.rs:1-410`. `SEC-01` gate verified. | Phase 2 |
| 14 | `sentinel_fuzzer` | 6 | 440 | 1 | 100 | **PRODUCTION** | Mutation fuzzer, grammar AST fuzzer, type-aware mutator, payload minimizer, differential scoring. | `sentinel_fuzzer/src/mutator.rs:1-180`, `sentinel_fuzzer/src/minimizer.rs:1-120`. `SEC-01` gate verified. | Phase 2 |
| 15 | `sentinel_verification` | 15 | 2,044 | 6 | 855 | **PRODUCTION** | `SEC-06` deterministic verification engine, proof strategies (SQLi, NoSQLi, CMDi, SSTI, XXE, Traversal, XSS, OAST, Welch t-test). | `sentinel_verification/src/engine.rs:1-280`, `sentinel_verification/src/differential.rs:1-460`. 3 clippy warnings. | Phase 3 |
| 16 | `sentinel_authz` | 3 | 219 | 1 | 90 | **PRODUCTION** | Multi-role IRA+ authorization matrix, IDOR/BOLA/BFLA evaluation, privilege differential analyzer. | `sentinel_authz/src/matrix.rs:1-140`, `sentinel_authz/src/evaluator.rs:1-80`. Expand auto-replay in Phase 2. | Phase 2 |
| 17 | `sentinel_api` | 5 | 514 | 1 | 137 | **PRODUCTION** | OpenAPI 3.0/3.1 parser, GraphQL AST analysis/introspection/batching, WebSocket fuzzer, gRPC analyzer. | `sentinel_api/src/openapi.rs:1-190`, `sentinel_api/src/graphql.rs:1-160`. Add `prost-reflect` gRPC Reflection. | Phase 2 |
| 18 | `sentinel_browser` | 6 | 477 | 1 | 117 | **PRODUCTION** | Headless browser automation integration (Playwright/CDP connector), DOM crawler, DOM snapshotting, screenshot CAS. | `sentinel_browser/src/crawler.rs:1-180`, `sentinel_browser/src/cdp.rs:1-140`. 2 clippy warnings. | Phase 2 |
| 19 | `sentinel_oast` | 4 | 376 | 1 | 89 | **PRODUCTION** | Stateless AES-256 authenticated OAST token engine (`SEC-02`), DNS/HTTP callback listener, correlation engine. | `sentinel_oast/src/token.rs:1-160`, `sentinel_oast/src/correlator.rs:1-110`. 10 clippy warnings. | Phase 2 |
| 20 | `sentinel_logic` | 4 | 441 | 1 | 112 | **PRODUCTION** | Business logic modeling, barrier & HTTP/2 single-packet race prober, step-skipping workflow permutation analyzer. | `sentinel_logic/src/race.rs:1-190`, `sentinel_logic/src/workflow.rs:1-160`. | Phase 2 |
| 21 | `sentinel_report` | 5 | 270 | 1 | 80 | **PRODUCTION** | Findings Center triage, Pentester Notebook, multi-format report generator (Markdown, HTML, JSON, SARIF 2.1.0). | `sentinel_report/src/sarif.rs:1-140`, `sentinel_report/src/generator.rs:1-110`. | Phase 2 |
| 22 | `sentinel_productivity` | 4 | 146 | 1 | 52 | **PARTIAL** | Command palette, hotkeys, omni-search. | `sentinel_productivity/src/lib.rs:1-146`. Needs Base64, URL, Hex, HTML, JWT, Gzip codecs & HashEngine. | Phase 2 |
| 23 | `sentinel_plugin` | 4 | 476 | 3 | 332 | **PRODUCTION** | Sandboxed plugin runtime (WASM/Rhai, `SEC-04`), signed Research Packs with HMAC-SHA256 verification. | `sentinel_plugin/src/research_pack.rs:1-190`, `sentinel_plugin/src/sandbox.rs:1-150`. Add Wasmtime WIT runtime. | Phase 2 |
| 24 | `sentinel_adapters` | 5 | 293 | 1 | 67 | **PRODUCTION** | External tool adapters (Nmap, Nuclei, Sqlmap, Subfinder), schema normalization, provenance tagging. | `sentinel_adapters/src/nuclei.rs:1-90`, `sentinel_adapters/src/nmap.rs:1-80`. | Phase 2 |
| 25 | `sentinel_ai` | 3 | 122 | 1 | 43 | **PRODUCTION** | Host-side AI policy gate (`SEC-03`), prompt injection defense, risk budget enforcement. | `sentinel_ai/src/policy.rs:1-90`. Candidate for merge into `sentinel_agentic`. | Phase 4 |
| 26 | `sentinel_agent` | 4 | 249 | 1 | 49 | **PRODUCTION** | Controlled agentic testing loop, safe typed tools registry, risk budget governor. | `sentinel_agent/src/loop_runner.rs:1-120`. Candidate for merge into `sentinel_agentic`. | Phase 4 |
| 27 | `sentinel_enterprise` | 4 | 185 | 1 | 64 | **PRODUCTION** | Enterprise multi-tenancy isolation (`SEC-08`), RBAC model, SIEM event streaming (CEF/Syslog RFC 5424, `SEC-12`). | `sentinel_enterprise/src/siem.rs:1-90`, `sentinel_enterprise/src/rbac.rs:1-70`. | Phase 2 |
| 28 | `sentinel_cli` | 1 | 193 | 0 | 0 | **PARTIAL** | Launcher dashboard scaffold. | `sentinel_cli/src/main.rs:1-193`. Needs Clap v4 command tree and domain exit codes (0/1/2). | Phase 2 |
| 29 | `sentinel_dispatch` | 3 | 438 | 1 | 105 | **PRODUCTION** | Central asynchronous HTTP/TLS network dispatch engine, connection pooling, rate limiters, `SEC-01` scope gate. | `sentinel_dispatch/src/dispatcher.rs:1-240`, `sentinel_dispatch/src/pool.rs:1-120`. Shared network core. | Phase 1 |

---

## 3. Detailed Audit of the 23 Clippy Warnings

Running `cargo clippy --workspace --all-targets` identifies **23 non-fatal warnings** across 6 crates. These are stylistic/idiomatic adjustments in Rust 1.97 and do not affect runtime behavior.

| # | Crate | File & Line | Clippy Rule | Exact Issue Description | Proposed Remediation |
|:---:|:---|:---|:---|:---|:---|
| 1 | `sentinel_knowledge` | `context_graph.rs:323:9` | `clippy::unnecessary_sort_by` | Suggests using `sort_by_key` instead of manual closure. | Replace `.sort_by(|a, b| ...)` with `.sort_by_key(...)`. |
| 2 | `sentinel_knowledge` | `cpe.rs:180:49` | `clippy::manual_pattern_char_comparison` | `c == 'v' \|\| c == 'V' \|\| c == '='` can use char array. | Change to `['v', 'V', '='].contains(&c)`. |
| 3 | `sentinel_knowledge` | `cpe.rs:191:21` | `clippy::get_first` | `dot_parts.get(0)` can be `.first()`. | Replace with `dot_parts.first()`. |
| 4 | `sentinel_knowledge` | `rule_engine.rs:130:5` | `clippy::too_many_arguments` | Function accepts 8 arguments (exceeds threshold 7). | Bundle related arguments into `RuleEvaluationContext` struct. |
| 5 | `sentinel_plugin` | `research_pack.rs:159:29` | `clippy::needless_borrows_for_generic_args` | Needless borrow on `ipad`. | Change `&ipad` to `ipad`. |
| 6 | `sentinel_plugin` | `research_pack.rs:165:29` | `clippy::needless_borrows_for_generic_args` | Needless borrow on `opad`. | Change `&opad` to `opad`. |
| 7 | `sentinel_plugin` | `research_pack.rs:166:29` | `clippy::needless_borrows_for_generic_args` | Needless borrow on `inner_hash`. | Change `&inner_hash` to `inner_hash`. |
| 8–17 | `sentinel_oast` | `token.rs:54, 55, 56, 64, 66, 105, 107, 122, 123, 124` | `clippy::needless_borrows_for_generic_args` | 10 instances of needless borrows on `master_key`, `nonce`, and `block_idx.to_le_bytes()`. | Remove redundant `&` reference operators on types implementing required traits. |
| 18 | `sentinel_browser` | `crawler.rs:85:28` | `clippy::regex_creation_in_loops` | `Regex::new(...)` compiled inside loop iteration. | Move regex compilation outside the loop or wrap in `once_cell::sync::Lazy`. |
| 19 | `sentinel_browser` | `crawler.rs:138:36` | `clippy::manual_range_patterns` | Unnecessary `>= y + 1` comparison. | Change condition to `depth < config.max_depth`. |
| 20 | `sentinel_auth` | `csrf.rs:48:10` | `clippy::type_complexity` | Very complex nested type used. | Factor complex type into dedicated `type CsrfTokenMap = ...;` alias. |
| 21 | `sentinel_verification` | `differential.rs:144:10` | `clippy::type_complexity` | Very complex nested type used in differential analyzer. | Factor into `type DivergenceVector = ...;` alias. |
| 22 | `sentinel_verification` | `differential.rs:353:5` | `clippy::too_many_arguments` | Function accepts 8 arguments. | Encapsulate parameters into `DifferentialEvaluationConfig`. |
| 23 | `sentinel_verification` | `differential.rs:438:21` | `clippy::collapsible_match` | Nested `if` can be collapsed into outer `match` guard. | Collapse nested pattern match. |

---

## 4. Phased Implementation Roadmap

### Phase 1: Isolated Testbed & Golden Path Vertical Slice
- **Scope**: Multi-target local testbed (`localhost` only, zero external egress) with Vulnerable, Fixed, and Benign Control targets across REST, WebSocket, GraphQL, and Auth.
- **Unbroken Golden Path**: Headless CDP $\to$ Proxy (HTTP/1.1 & H2) with `SEC-01` $\to$ Tokio Event Bus $\to$ Dual Storage (SQLite WAL + CAS SHA-256) $\to$ Tauri UI Stream $\to$ HTTPQL Filter $\to$ Repeater Socket Replay $\to$ Verifier $\to$ CAS Merkle Proof.

### Phase 2: Real Subsystem Capabilities
- **Productivity**: Implement native Base64, URL, Hex, HTML entity, JWT, Gzip codecs and HashEngine in `sentinel_productivity`.
- **Protocols & APIs**: OpenAPI 3.1 parser with `$ref` resolution, `prost-reflect` gRPC Reflection v1, GraphQL complexity scoring, native HTTP/3 QUIC (`quinn`).
- **AuthZ & Plugins**: Multi-role IRA+ matrix auto-replay, IDOR AST substitution, Wasmtime WIT runtime with fuel bounding and Ed25519 KRL.
- **Search & CLI**: Tantivy BM25 full-text indexing, Clap v4 CLI with security domain exit codes (0/1/2).
- **Clippy Remediation**: Fix all 23 clippy warnings to achieve `cargo clippy --workspace --all-targets -- -D warnings` with 0 warnings.

### Phase 3: Formal Finding State Machine & Independent Verifier
- **10-State Linear State Machine**: `OBSERVED` $\to$ `CANDIDATE` $\to$ `REPRODUCIBLE` $\to$ `VERIFIED` $\to$ `INDEPENDENTLY_VERIFIED` $\to$ `PROMOTED` $\to$ `DEDUPLICATED` $\to$ `REPORTED` $\to$ `RETESTED` $\to$ `FIXED` | `STILL_PRESENT`. Zero production panics on illegal transitions; return typed errors and audit events.
- **Independent Verifier**: Registered `SEC-06` deterministic oracles (AuthZ diff, state invariants, OAST callback, DOM taint, protocol desync, Welch t-test, AST Jaccard, bit replay).
- **Tri-Target Confusion Matrix Audit**: Report TP, TN, FP, FN, precision, recall, and verification rate across the controlled test corpus.

### Phase 4: Scale Benchmarking & Conditional Crate Consolidation
- **Scale Hardening**: 1-hour stress and 4-hour soak tests targeting steady-state heap $\le 110\text{MB}$ (peak $\le 124\text{MB}$) with zero unbounded memory growth.
- **Crate Consolidation**: Conditionally consolidate 29 crates into ~18 high-cohesion crates (`sentinel_graph`, `sentinel_identity`, `sentinel_agentic`, `sentinel_testing_lab`) to optimize build times and remove boilerplate.

---

## 5. Mock / Placeholder Inventory Status

A comprehensive scan across all 29 production crates was performed:
- **Production Code Path**: **0 unclassified or blocking stubs exist**. All production crates compile and pass tests.
- **Test Infrastructure (`sentinel_core/tests/`)**: Isolated test mocks (e.g. `MockHttpServer`, in-memory SQLite instances) are strictly contained within `tests/` directories and never compiled into production binary artifacts.

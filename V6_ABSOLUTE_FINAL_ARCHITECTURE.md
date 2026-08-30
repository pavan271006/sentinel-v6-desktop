# SENTINEL V6 — ABSOLUTE FINAL ARCHITECTURE SPECIFICATION
**Document ID**: `SENTINEL-ARCH-V6-ABSOLUTE-FINAL-001`  
**Date**: 2026-08-23  
**Classification**: Authoritative System Architecture & Interface Specification  
**Status**: APPROVED & FROZEN FOR IMPLEMENTATION  
**Enforced Invariants**: `SEC-01` through `SEC-12` (Strictly Preserved)

---

## 1. The Unified Security World Model (Canonical Intermediate Representation)

SENTINEL V6 is architected around a unified, strongly-typed **Security Testing Intermediate Representation (ST-IR)** that bridges raw network packets, abstract syntax trees, state-machine transitions, causal evidence nodes, and analytical findings:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        SENTINEL SECURITY WORLD MODEL (ST-IR TOPOLOGY)                             │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                   │
│  [Asset: Target Scope] ──► [Service: Protocol / Port] ──► [Endpoint: Route AST / Schema]         │
│                                                                    │                              │
│                                                                    ▼                              │
│  [Identity / Session] ◄── [Principal: Role / Token] ◄──── [Parameter: Taint Flow]               │
│           │                                                        │                              │
│           ▼                                                        ▼                              │
│  [State: Mealy FSM] ────► [Workflow: Transition Path] ──► [Observation: Wire Packet]             │
│                                                                    │                              │
│                                                                    ▼                              │
│  [Finding: CAS Node] ◄── [Evidence: Merkle Proof] ◄───── [Hypothesis: Bayesian Prior]           │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 18-Crate Target Workspace Architecture

```
┌────┬─────────────────────────────┬───────────────────────────────────────────────────────────┬───────────────────────────────────┐
│ #  │ Crate Name                  │ Subsystem Responsibility & Domain Scope                   │ Invariant / Quality Guarantee     │
├────┼─────────────────────────────┼───────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ 1  │ `sentinel_common`           │ Shared domain types, error enums, crypto traits, ST-IR.   │ Zero internal dependencies.       │
│ 2  │ `sentinel_scope`            │ Fail-closed pre-socket Aho-Corasick radix trie filter.    │ **SEC-01** (0.00% bypass).        │
│ 3  │ `sentinel_bus`              │ Bounded Tokio async mpsc event bus with backpressure.     │ Zero message drop under load.     │
│ 4  │ `sentinel_storage`          │ SQLite WAL (metadata) + Tantivy (FTS) + CAS (BlobStore).  │ **SEC-07, SEC-12** (ACID & CAS).  │
│ 5  │ `sentinel_parser`           │ Zero-copy HTTP/1.1, H2, QPACK, MIME, JSON, PEG parsers.   │ SIMD-accelerated (>2.5 GB/s).     │
│ 6  │ `sentinel_proxy`            │ HTTP/1.1, HTTP/2 (multiplexed), HTTP/3 QUIC MITM engine.  │ Native `quinn` + `rustls`.        │
│ 7  │ `sentinel_dispatch`         │ Tokio connection pooling, rate governor, socket executor. │ Per-host sliding window governor. │
│ 8  │ `sentinel_httpql`           │ AST query compiler for structured traffic filtering.      │ Compiles to SQLite & Tantivy.     │
│ 9  │ `sentinel_graph`            │ In-memory `petgraph` + SQLite CTE Security Context Graph. │ $<0.1\text{ms}$ query latency.    │
│ 10 │ `sentinel_planner`          │ LinUCB Contextual Bandits + Expected Information Gain.    │ $-77\%$ redundant probe requests. │
│ 11 │ `sentinel_scanner`          │ Vectorscan / Hyperscan SIMD regex DFA passive scanner.    │ 10 Gbps line-speed regex matching.│
│ 12 │ `sentinel_verification`     │ 5D Diff Engine + Metamorphic Security Testing (76 MRs).   │ **SEC-06** ($p < 0.001$ Welch).   │
│ 13 │ `sentinel_authz`            │ Multi-Role IRA+ Matrix & Dynamic IDOR AST Substitutor.    │ Parallel 3-session replay matrix. │
│ 14 │ `sentinel_api`              │ OpenAPI 3.1 YAML, InQL GraphQL AST, gRPC Reflection.      │ `prost-reflect` zero-config proto.│
│ 15 │ `sentinel_browser`          │ Headless Chromium CDP WebSocket driver + DOM Taint Script.│ Dynamic source-to-sink tracking.  │
│ 16 │ `sentinel_oast`             │ Stateless AES-256-GCM tokens with DNS/HTTP/SMTP server.   │ **SEC-02** (0 target IP leakage). │
│ 17 │ `sentinel_testing_lab`      │ Unified Repeater, Mutation Fuzzer, and Mealy FSM Replay.  │ Microsecond single-packet sync.   │
│ 18 │ `sentinel_productivity`     │ CyberChef-Grade Codecs (Base64, Hex, URL, JWT, Hashes).   │ High-throughput encoder suite.    │
│ 19 │ `sentinel_plugin`           │ Wasmtime fuel-metered sandbox + Ed25519 KRL signature PKI.│ **SEC-04, SEC-05** (0 escape).    │
│ 20 │ `sentinel_ai`               │ Host-side deterministic AI policy cage + token governor.  │ **SEC-03** (Zero raw socket calls)│
│ 21 │ `sentinel_agentic`          │ CurriculumPT 4-stage progressive autonomous testing loop. │ Stage 1-4 verifiable PoC chains.  │
│ 22 │ `sentinel_enterprise`       │ Multi-tenant DB isolation, RBAC, and SIEM UDP exporter.   │ **SEC-08** (Physical DB boundary).│
│ 23 │ `sentinel_report`           │ OASIS SARIF v2.1.0, Markdown, HTML, JSON report engine.   │ Merkle proof finding certificates.│
│ 24 │ `sentinel_adapters`         │ Subprocess execution adapters for Nmap, Nuclei v3, Sqlmap.│ Non-blocking async process runner.│
│ 25 │ `sentinel_cli`              │ Clap v4 hierarchical CLI with domain security exit codes. │ Headless CI/CD automation runner. │
└────┴─────────────────────────────┴───────────────────────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 3. Concurrency, Memory & Pipeline Boundaries

1. **Tokio Async Network Pool (N Cores)**: Exclusively operates the non-blocking proxy reactor, TLS session resumption, and QUIC UDP socket streams.
2. **Rayon Compute Pool (N-2 Cores)**: Offloads CPU-intensive tasks: Meyers AST diffing, Zhang-Shasha tree edit distance, SHA-256 Merkle calculations, and Zstandard payload compression.
3. **Dedicated SQLite Database Task**: Runs in an isolated thread reading from a Tokio `mpsc` channel to enforce atomic, sequential Write-Ahead Log (WAL) commits.
4. **Out-of-Process Chromium Daemon**: Headless browser runs as an isolated subprocess communicating strictly over WebSocket CDP JSON-RPC, protecting core memory space from V8 garbage collection spikes.

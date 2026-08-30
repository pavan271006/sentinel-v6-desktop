# SENTINEL V6 — FRONTIER GAP ANALYSIS & CHALLENGER AUDIT
**Document ID**: `SENTINEL-DOC-FRONTIER-GAP-001`  
**Date**: 2026-08-23  
**Status**: AUTHORITATIVE AUDIT & GAP REMEDIATION DIRECTIVE  
**Classification**: Subsystem-by-Subsystem Forensic Analysis

---

## 1. Executive Summary

This gap analysis rigorously compares the current baseline state of all crates in `sentinel_core` against frontier capabilities in modern security workstations. It identifies the root causes of all 11 target gaps and provides concrete, test-backed remediation specifications.

---

## 2. Exhaustive 11-Gap Forensic Analysis

### Gap 1: `sentinel_productivity` — Missing CyberChef-Grade Codecs
- **Ground-Truth Defect**: Currently provides hotkey shortcuts and command palette UI bindings, but contains zero encoders, decoders, or cryptographic hashers.
- **Impact**: Analysts are forced to switch out of Sentinel to external browser tools (CyberChef, Burp Decoder) for basic payload transformations.
- **Required Architecture**:
  - Module `crates/sentinel_productivity/src/codec/`:
    - `Base64Codec` (Standard RFC 4648, URL-Safe RFC 4648 §5, with/without padding)
    - `UrlCodec` (Standard `%XX` component, full-ASCII, double-encoding)
    - `HexCodec` (Raw bytes $\leftrightarrow$ Hex with custom delimiters)
    - `HtmlEntityCodec` (Named entities `&amp;`, decimal `&#38;`, hex `&#x26;`)
    - `JwtCodec` (Header/payload JSON unpacker, Unix timestamp formatter)
    - `GzipCodec` (RFC 1952 decompression / compression)
    - `HashEngine` (MD5, SHA-1, SHA-256, SHA-512 with hex output)

### Gap 2: `src-tauri` Desktop IPC — Dummy Loops & Mock Repeater
- **Ground-Truth Defect**: `cmd_traffic_get_page` synthesizes 100 fake items in a loop; `cmd_repeater_send_request` returns a hardcoded mock `HTTP/1.1 200 OK`.
- **Impact**: The desktop frontend is completely disconnected from real captured proxy traffic and live socket dispatching.
- **Required Architecture**:
  - Connect `cmd_traffic_get_page` to `SqliteObservationStore::get_paginated_transactions()`.
  - Connect `cmd_repeater_send_request` to `sentinel_dispatch::HttpDispatcher`.
  - Wire `ChannelEventBus` to emit live `traffic-captured` and `finding-discovered` events to Tauri Webview windows via `app_handle.emit()`.

### Gap 3: `sentinel_browser` — Mock Headless Service
- **Ground-Truth Defect**: `DefaultBrowserService` returns static mock HTML strings and placeholder PNGs.
- **Impact**: Zero client-side DOM XSS detection, zero Shadow DOM traversal, zero dynamic cookie/storage analysis.
- **Required Architecture**:
  - Implement `CdpBrowserClient` launching real headless Chromium subprocess with `--remote-debugging-port`.
  - Connect via WebSocket and drive CDP domains: `Page`, `DOM`, `Network`, `Runtime`, `Storage`.
  - Inject runtime JavaScript taint tracking scripts to monitor dangerous sinks (`innerHTML`, `eval`).

### Gap 4: `sentinel_authz` — Mock Endpoints in Matrix Builder
- **Ground-Truth Defect**: `build_matrix` generates 4 hardcoded random UUIDs without executing live multi-session replays.
- **Impact**: Zero live BOLA, BFLA, or IDOR discovery.
- **Required Architecture**:
  - Implement `LiveMatrixReplayer`: takes captured requests from Role A (Admin), replaces authentication tokens with Role B (User) and Role C (Anon).
  - Add AST-driven dynamic parameter replacement for resource identifiers in JSON bodies and URL paths.
  - Evaluate semantic divergence oracles and Welch's t-test to detect unauthorized access.

### Gap 5: `sentinel_api` — Stub gRPC Reflection & JSON-Only OpenAPI
- **Ground-Truth Defect**: gRPC reflection returns a static 2-byte frame; OpenAPI parser rejects YAML specifications and fails to resolve `$ref` pointers.
- **Impact**: Fails on 80% of enterprise APIs (which use YAML OpenAPI specs or dynamic gRPC microservices).
- **Required Architecture**:
  - Integrate `prost-reflect` to dynamically query gRPC Server Reflection v1 at runtime.
  - Integrate `serde_yaml` and recursive JSON-Pointer `$ref` resolver.
  - Implement recursive query complexity scoring (depth $\times$ multiplier) for GraphQL.

### Gap 6: `sentinel_proxy` — Ignored Upstream SOCKS5 & No H2 Demuxer
- **Ground-Truth Defect**: Upstream proxy configuration is ignored; HTTP/2 ALPN is negotiated but frames are not multiplexed bidirectionally.
- **Impact**: Cannot route through Tor/corporate proxies; misses HTTP/2 stream multiplexing attack vectors.
- **Required Architecture**:
  - Implement `Socks5Connector` (RFC 1928) with authentication support.
  - Build bidirectional HTTP/2 frame demultiplexer using `h2` crate.
  - Persist all WebSocket frames to SQLite/CAS blob storage.

### Gap 7: `sentinel_ai` — Mock String Inference & Missing Token Governor
- **Ground-Truth Defect**: `analyze()` returns hardcoded mock strings; lacks real LLM client integration or token governors.
- **Impact**: Cannot leverage local or cloud models for assisted test generation.
- **Required Architecture**:
  - Implement modular `LlmProvider` trait supporting OpenAI API, Ollama (local), and ONNX runtime.
  - Implement `tiktoken`-based token governor enforcing strict per-plan budgets.
  - Enforce SEC-03 host-side policy cage: model queries read-only context and selects typed Rust skills.

### Gap 8: `sentinel_plugin` — Mock Execution & Unenforced Sandbox Limits
- **Ground-Truth Defect**: `execute()` returns dummy strings without sandbox isolation or signature checking.
- **Impact**: Vulnerable to malicious extensions and infinite loops.
- **Required Architecture**:
  - Embed `wasmtime` runtime with 64MB memory limits and fuel metering counters.
  - Bind typed WIT host interfaces (`sentinel:host/http`, `sentinel:host/log`).
  - Implement Ed25519 asymmetric signature validator with Enterprise Key Revocation List (KRL).

### Gap 9: `sentinel_storage` — Slow LIKE Queries & Missing Repositories
- **Ground-Truth Defect**: `search_fts` uses naive `LIKE '%...%'` queries; 26 out of 32 database tables lack typed Rust repositories.
- **Impact**: Search latency degrades to >10 seconds on large engagements (100K+ requests).
- **Required Architecture**:
  - Implement SQLite FTS5 virtual table or embedded `tantivy` index for sub-50ms search on 1M+ transactions.
  - Build typed Rust repositories for all 32 relational tables.

### Gap 10: `sentinel_knowledge` — Unparameterized CTE Queries
- **Ground-Truth Defect**: `cte.rs` constructs recursive graph queries via string concatenation.
- **Impact**: Potential SQL injection risk and brittle query execution.
- **Required Architecture**:
  - Fully parameterize recursive CTE queries using `rusqlite` query bindings.
  - Unify with `petgraph` in-memory representation for complex transitive lineage analysis.

### Gap 11: `sentinel_cli` — Missing Argument Parsing & CI Exit Codes
- **Ground-Truth Defect**: `main.rs` runs a hardcoded test loop with no CLI flags or subcommands.
- **Impact**: Cannot be integrated into headless CI/CD pipelines or automated script runners.
- **Required Architecture**:
  - Implement Clap v4 CLI with subcommands: `sentinel proxy`, `sentinel scan`, `sentinel authz`, `sentinel report`.
  - Add domain security exit codes (0 = Clean, 1 = Vulnerability Found, 2 = Scope Violation).

# SENTINEL V6 — ABSOLUTE FINAL IMPLEMENTATION BLUEPRINT
**Document ID**: `SENTINEL-BLUEPRINT-V6-ABSOLUTE-FINAL-001`  
**Date**: 2026-08-23  
**Status**: PERMANENT PRODUCTION EXECUTION BLUEPRINT  
**Classification**: Exact Dependency-Aware Implementation Directives  
**Enforced Invariants**: `SEC-01` through `SEC-12` (Strictly Preserved)

---

## 1. Executive Implementation Dependency Graph

```mermaid
flowchart TD
    subgraph Phase_A ["Phase A: Pentester Core Ergonomics & Live Wire"]
        A1["1. CyberChef-Grade Codecs in sentinel_productivity"]
        A2["2. Wire src-tauri commands to real SQLite/CAS & HttpDispatcher"]
        A3["3. Stream live WebSocket & EventBus to desktop frontend"]
    end

    subgraph Phase_B ["Phase B: Protocol & Browser Zenith"]
        B1["4. Out-of-Process Chromium CDP Client in sentinel_browser"]
        B2["5. Dynamic gRPC reflection prost-reflect + OpenAPI YAML in sentinel_api"]
        B3["6. H2 multiplexing demuxer & Upstream SOCKS5 in sentinel_proxy"]
    end

    subgraph Phase_C ["Phase C: State, AuthZ, MST & Sandboxed Plugins"]
        C1["7. Live multi-session IRA+ AuthZ replay in sentinel_authz"]
        C2["8. Wasmtime sandbox runtime + Ed25519 KRL in sentinel_plugin"]
        C3["9. Metamorphic Security Testing (MST) Engine in sentinel_verification"]
    end

    subgraph Phase_D ["Phase D: Search Scale, CLI Automation & Crate Consolidation"]
        D1["10. Embedded Tantivy / FTS5 Full-Text Indexing in sentinel_storage"]
        D2["11. Clap v4 Hierarchical CLI in sentinel_cli"]
        D3["12. Consolidate 29 Crates -> 18 Crates Topology"]
    end

    Phase_A --> Phase_B
    Phase_B --> Phase_C
    Phase_C --> Phase_D
```

---

## 2. Step-by-Step Production Roadmap

### Phase A: Pentester Core Ergonomics & Live Wire (Immediate Execution)
1. **`sentinel_productivity`**:
   - Implement encoders/decoders in `crates/sentinel_productivity/src/codec/`:
     - `Base64Codec` (Standard / URL-Safe RFC 4648)
     - `UrlCodec` (Component / Full-ASCII / Double-Encoding)
     - `HexCodec` (Raw bytes $\leftrightarrow$ Hex string)
     - `HtmlEntityCodec` (Named, decimal, hex entities)
     - `JwtCodec` (Header & payload JSON unpacker)
     - `GzipCodec` (RFC 1952 decompression / compression)
     - `HashEngine` (MD5, SHA-1, SHA-256, SHA-512)
   - Add unit tests in `crates/sentinel_productivity/tests/codec_tests.rs`.
2. **`src-tauri` Desktop IPC Wiring**:
   - Replace 100 fake items in `cmd_traffic_get_page` with real query from `SqliteObservationStore`.
   - Connect `cmd_repeater_send_request` to `sentinel_dispatch::HttpDispatcher`.
   - Connect `cmd_toggle_proxy` to `sentinel_proxy::SentinelProxyEngine`.
   - Wire `ChannelEventBus` to emit live `traffic-captured` and `finding-discovered` Tauri events.

### Phase B: Protocol & Browser Zenith
1. **`sentinel_browser`**:
   - Implement `CdpBrowserClient` launching headless Chromium (`--remote-debugging-port`).
   - Implement DOM extractor traversing Shadow DOM roots.
   - Inject dynamic JavaScript taint tracker to detect client-side DOM XSS.
2. **`sentinel_api`**:
   - Integrate `prost-reflect` for dynamic gRPC Server Reflection v1.
   - Integrate `serde_yaml` and JSON-Pointer `$ref` resolver for OpenAPI 3.1.
   - Implement GraphQL query complexity scoring algorithm.
3. **`sentinel_proxy`**:
   - Implement upstream SOCKS5 / Tor connector.
   - Add bidirectional HTTP/2 frame multiplexing demuxer.

### Phase C: State, AuthZ, MST & Sandboxed Plugins
1. **`sentinel_authz`**:
   - Implement live multi-role session auto-replay (Admin, User B, Anonymous).
   - Add AST-driven dynamic IDOR parameter substitution engine.
2. **`sentinel_plugin`**:
   - Integrate `wasmtime` runtime with memory caps (64MB) and fuel counters.
   - Implement WIT host interface bindings and Ed25519 signature validator.
3. **`sentinel_verification`**:
   - Implement Metamorphic Security Testing (MST) engine with 76 web-specific relations.

### Phase D: Search Scale, CLI Automation & Crate Consolidation
1. **`sentinel_storage`**:
   - Create embedded `tantivy` index for sub-50ms full-text search across raw HTTP bodies.
   - Build typed repositories for all 32 SQLite database tables.
2. **`sentinel_cli`**:
   - Implement Clap v4 hierarchical CLI (`sentinel proxy`, `sentinel scan`, `sentinel authz`).
   - Add domain security exit codes (0 = Clean, 1 = Critical Finding, 2 = Scope Violation).
3. **Crate Consolidation**:
   - Migrate 29 workspace crates into the target 18-crate consolidated topology.

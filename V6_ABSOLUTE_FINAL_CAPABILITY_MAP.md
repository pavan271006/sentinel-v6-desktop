# SENTINEL V6 — ABSOLUTE FINAL CAPABILITY MAP
**Document ID**: `SENTINEL-SPEC-CAPABILITY-MAP-001`  
**Date**: 2026-08-23  
**Status**: COMPLETE CAPABILITY TAXONOMY & CLASSIFICATION  
**Classification**: 8-Tier Categorization & Go/No-Go Directives

---

## 1. Executive Capability Classification Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       SENTINEL V6 MASTER CAPABILITY CLASSIFICATION MATRIX                                              │
├────┬────────────────────────────┬──────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┤
│ #  │ Capability Subsystem       │ Classification Category          │ Concrete Engineering Justification │ Go / No-Go Verification Gate    │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 1  │ **Fail-Closed Scope Gate** │ **ABSOLUTE MUST HAVE**           │ Pre-socket Aho-Corasick radix   │ Zero out-of-scope packets       │
│    │                            │                                  │ trie filter enforcing SEC-01.   │ emitted across 100K stress tests│
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 2  │ **CyberChef Codec Suite**  │ **ABSOLUTE MUST HAVE**           │ Core pentester ergonomics for   │ 100% unit test pass on Base64,  │
│    │                            │                                  │ Base64, Hex, URL, JWT, Hashes.  │ URL, Hex, JWT, and Hashes.      │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 3  │ **Live Desktop IPC Wire**  │ **ABSOLUTE MUST HAVE**           │ Connects Tauri frontend to real │ Live traffic stream at 60 FPS   │
│    │                            │                                  │ SQLite WAL & HttpDispatcher.    │ with 0 synthetic dummy items.   │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 4  │ **5D Differential Engine** │ **HIGH-VALUE DIFFERENTIATOR**    │ Solves test oracle problem with │ $p < 0.001$ Welch's t-test and  │
│    │                            │                                  │ Welch's t-test & AST Jaccard.   │ 0.00% false alarms on WAN jitter│
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 5  │ **Metamorphic Oracles (76)**│ **HIGH-VALUE DIFFERENTIATOR**   │ 85% automated vuln detection    │ 99.8% specificity confirmed on  │
│    │                            │                                  │ with 99.8% specificity (MST).   │ dual-assertion invariant suite. │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ 6  │ **IRA+ AuthZ Matrix**      │ **HIGH-VALUE DIFFERENTIATOR**    │ Parallel multi-role IDOR & BOLA │ Discovers nested cross-tenant   │
│    │                            │                                  │ replay with dynamic AST morph.  │ parameter leakages in real-time.│
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 7  │ **Chromium CDP DOM Taint** │ **HIGH-VALUE DIFFERENTIATOR**    │ Dynamic JavaScript source-sink  │ Intercepts `location.search` -> │
│    │                            │                                  │ tracking via CDP WebSocket.     │ `innerHTML` with 0 browser hang.│
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 8  │ **Native HTTP/3 QUIC Proxy**│ **STRATEGIC DIFFERENTIATOR**    │ Pure-Rust async QUIC engine     │ Full QPACK table decompression  │
│    │                            │                                  │ using `quinn` and `rustls`.     │ & stream multiplexing support.  │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 9  │ **Embedded Tantivy Search**│ **STRATEGIC DIFFERENTIATOR**     │ Sub-15ms BM25 full-text index   │ Queries 1,000,000 HTTP packets  │
│    │                            │                                  │ over 1,000,000+ HTTP records.   │ in $<15\text{ms}$ with <180MB RAM│
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 10 │ **CurriculumPT Agent Cage**│ **STRATEGIC DIFFERENTIATOR**     │ 4-stage progressive AI planner  │ Zero self-approval; all findings│
│    │                            │                                  │ gated by deterministic policy.  │ backed by deterministic CAS PoC.│
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 11 │ **Wasmtime Sandboxed Packs**│ **STRATEGIC DIFFERENTIATOR**    │ Fuel-metered zero-capability    │ Malicious WASM terminated on fuel│
│    │                            │                                  │ WebAssembly plugin runtime.     │ limit; Ed25519 KRL verified.    │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 12 │ **Nuclei v3 Native AST**   │ **INTEGRATE**                    │ Native Rust compiler executing  │ Executes 8,000+ YAML templates  │
│    │                            │                                  │ community YAML scan templates.  │ in single multiplexed passes.   │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 13 │ **gRPC Server Reflection** │ **INTEGRATE**                    │ Dynamic protobuf reflection via │ Discovers services & methods    │
│    │                            │                                  │ `prost-reflect` crate.          │ without precompiled `.proto`.   │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 14 │ **Deep RL Test Planners**  │ **REJECT**                       │ High GPU compute bloat; reward  │ Formally purged from workspace; │
│    │                            │                                  │ hacking; non-deterministic.     │ replaced by Contextual Bandits. │
├────┼────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 15 │ **SMT / Z3 DOM Solvers**   │ **REJECT**                       │ Combinatorial path explosion    │ Formally purged from workspace; │
│    │                            │                                  │ $O(2^N)$ on modern web SPAs.    │ replaced by dynamic CDP taint.  │
└────┴────────────────────────────┴──────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

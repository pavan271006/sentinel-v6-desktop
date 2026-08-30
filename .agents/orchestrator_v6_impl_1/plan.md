# SENTINEL V6 Production Implementation Plan

## Overview
Transform all prototyped engines, schemas, and specifications into native, verified Rust and React code for the SENTINEL V6 Security Testing Workstation.

## Milestones

### Milestone 0: Scope Survey & Feature Inventory
- Dispatch 3 Explorers/Spec Miners in parallel to survey:
  1. Core crates, architecture/v6 specs, and current workspace status.
  2. Research prototypes, theory lab artifacts, and candidate engines in `research/`.
  3. Frontend, IPC contracts (`V6_IPC_CONTRACTS.proto`), and UI capability baseline.
- Synthesize into `PROJECT.md` at project root with full Feature Inventory and interface contracts.

### Milestone 1: Phase 0 — Source Baseline & Implementation Reality Audit
- Zero repository modifications.
- Record git commit, toolchain versions, lockfile SHA-256 in `V6_IMPLEMENTATION_BASELINE.md`.
- Audit all 29 workspace crates in `V6_IMPLEMENTATION_REALITY_MATRIX.md` ([REAL | PARTIAL | MOCK | STUB | SCAFFOLD | EXPERIMENTAL | PRODUCTION]).
- Run full Reviewer, Challenger, and Forensic Auditor gate.

### Milestone 2: Phase 0.5 — Baseline Functional Smoke Test
- Run current backend, frontend, and E2E suites.
- Launch testbed / mock proxy and record baseline telemetry in `V6_BASELINE_FUNCTIONAL_SMOKE.md`.
- Gate verification.

### Milestone 3: Phase 1 — Isolated Testbed & End-to-End Vertical Slice (Golden Path)
- Multi-target local testbed (Vulnerable, Fixed, Benign Control) across REST, WebSocket, GraphQL, and Auth.
- Golden Path unbroken pipeline: Headless Chromium CDP -> Proxy with SEC-01 scope gate -> Tokio Event Bus -> Dual Storage (SQLite WAL + CAS SHA-256) -> Tauri UI Event Stream -> HTTPQL -> Repeater -> Deterministic Oracle -> CAS Merkle Proof.
- Gate verification (Reviewer, Challenger, Auditor).

### Milestone 4: Phase 2 — Real Subsystem Capabilities
- Subsystem A: Productivity Codecs (Base64, URL, Hex, HTML entity, JWT, Gzip, HashEngine in `sentinel_productivity`).
- Subsystem B: Protocols & APIs (OpenAPI 3.1 with $ref, prost-reflect gRPC Reflection v1, GraphQL complexity, native HTTP/3 QUIC `quinn`).
- Subsystem C: AuthZ & Plugins (Multi-role IRA+ matrix, IDOR AST substitution, Wasmtime WIT runtime with fuel bounding & Ed25519 KRL).
- Subsystem D: Search & CLI (Tantivy BM25 FTS, Clap v4 CLI with exit codes 0/1/2).
- Gate verification.

### Milestone 5: Phase 3 — Formal Finding State Machine & Independent Verifier
- 10-state linear state machine (`OBSERVED` -> `CANDIDATE` -> `REPRODUCIBLE` -> `VERIFIED` -> `INDEPENDENTLY_VERIFIED` -> `PROMOTED` -> `DEDUPLICATED` -> `REPORTED` -> `RETESTED` -> `FIXED` | `STILL_PRESENT`).
- Typed errors on illegal transitions (zero production panics).
- Isolated independent verifier with registered SEC-06 deterministic oracles.
- Tri-Target confusion matrix audit (TP on vulnerable, TN on fixed, TN on benign).
- Gate verification.

### Milestone 6: Phase 4 — Scale Benchmarking & Crate Consolidation
- 1-hour stress and 4-hour soak tests (steady-state heap <= 110MB, peak <= 124MB).
- Conditional workspace crate consolidation (29 -> ~18).
- Gate verification.

### Milestone 7: Final Verification & Release Certification Gates
- Continuous regression verification (`cargo check`, `cargo test`, `cargo clippy`, `npm test`, `npm run build`, `validate_v6_spec.py`).
- Final mock/placeholder scan (zero unclassified production stubs).
- Clean Tauri build (`npm run tauri build`).
- Final release reports and attestation.

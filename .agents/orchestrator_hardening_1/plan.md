# Plan: Sentinel Desktop Hardening and Architecture Audit

## Overview
Orchestrate the comprehensive audit, optimization, wire forensics integration, zero-latency IPC cleanup, and engine hardening for Sentinel Desktop, verifying all invariants and acceptance criteria.

## Phases

### Phase 0: Survey & Scope Mapping
1. Dispatch 3 parallel Explorers to investigate:
   - Explorer 1 (Wire Forensics & Network): Sockets, TCP pooling, `TCP_NODELAY`, Npcap/Wireshark detection/launch commands (`cmd_check_packet_capture_status`, `cmd_launch_wireshark`), Wireshark 4.6.8 / Npcap 1.88 support.
   - Explorer 2 (IPC Architecture & Cleanup): Tauri commands, `client.ts`, `mockBridge.ts`, event dispatchers, dead routes, unhandled exceptions, circular references.
   - Explorer 3 (Core Engines & Dependencies): SQL Scanner, Intruder, Repeater, Gray-Box IAST runtime agent, GhostNetwork proxy failover, JA4 TLS mimicry, rate-limiting, `Cargo.toml`, `package.json`, MCP servers, compiler warnings.
2. Synthesize findings into `PROJECT.md` with full Feature Inventory, Module Boundaries, Milestones, and Interface Contracts.

### Phase 1: Milestone M1 — Wire Forensics & Network Throughput Hardening
- Implement & optimize TCP connection pooling, `TCP_NODELAY`, and Npcap/Wireshark low-level capture bridges.
- Ensure `cmd_check_packet_capture_status` and `cmd_launch_wireshark` return valid telemetry for Wireshark 4.6.8 and Npcap 1.88.
- Verify sustained packet transmission/reception at 100-worker concurrency without socket exhaustion or buffer overflows.
- Full iteration loop: Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor.

### Phase 2: Milestone M2 — Zero-Latency IPC & Connection Architecture Cleanup
- Audit and clean up frontend-to-backend connection bridges across Tauri commands, `client.ts`, `mockBridge.ts`, event dispatchers.
- Eliminate dead routes, unhandled exceptions, circular references, and stale IPC fallbacks.
- Verify `npm run build` (`tsc && vite build`) and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Full iteration loop: Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor.

### Phase 3: Milestone M3 — Core Attack & Defense Engine Optimization
- Harden penetration testing pipelines: SQL Scanner, Intruder, Repeater, Gray-Box IAST runtime agent, GhostNetwork proxy failover.
- Enforce adaptive rate-limiting, anti-ban cooldowns, strict client header sanitization, JA4 TLS mimicry under load.
- Full iteration loop: Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor.

### Phase 4: Milestone M4 — Toolchain, MCP & Dependency Modernization
- Audit workspace dependencies in Rust `Cargo.toml` files, Node `package.json`, MCP server points.
- Resolve all compilation warnings, modernize outdated dependencies.
- Ensure Docker lab matrices and standalone testbed hooks run with zero configuration friction.
- Full iteration loop: Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor.

### Phase 5: Milestone M5 (M_TEST) — 100-Worker Concurrency & Invariant Verification
- Execute 100-worker concurrency tests in Intruder and Scanner without thread starvation or unhandled Promise rejections.
- Verify all security invariants SEC-01 through SEC-12 (fail-closed scope drop, CAS immutability, secret zeroization).
- Validate all acceptance criteria:
  - `cargo nextest run --manifest-path sentinel_core/Cargo.toml` 100% pass
  - `cargo check --manifest-path src-tauri/Cargo.toml` 0 errors
  - `npm run build` 0 errors
  - Wireshark 4.6.8 and Npcap 1.88 status/launch commands verified
- Full iteration loop: Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor.

### Phase 6: Victory Audit Notification & Reporting
- Generate comprehensive completion report.
- Send notification to Sentinel parent for independent Victory Auditor dispatch.

## 2026-09-11T07:50:16Z

You are the PROJECT ORCHESTRATOR for Sentinel Desktop hardening and architecture audit.
Your working directory is: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_hardening_1
The workspace root is: c:\Users\Legion 5 pro\Desktop\cyber sec
The authoritative user request is in: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md (under ## 2026-09-11T07:48:59Z).

Your mission is to orchestrate and manage the full implementation and verification of the following requirements and acceptance criteria:

## Requirements
### R1. Wire Forensics & Network Throughput Hardening
Audit and optimize all network socket handling, TCP connection pooling, `TCP_NODELAY` settings, and Npcap/Wireshark low-level packet capture bridges. Ensure sustained packet transmission and reception at 100-worker concurrency without socket exhaustion or buffer overflows.

### R2. Zero-Latency IPC & Connection Architecture Cleanup
Audit every frontend-to-backend connection bridge across Tauri commands, IPC client wrappers (`client.ts`), mock fallbacks (`mockBridge.ts`), and event dispatchers. Eliminate dead routes, unhandled exceptions, circular references, and stale IPC fallbacks.

### R3. Core Attack & Defense Engine Optimization
Harden the core penetration testing pipelines (SQL Scanner, Intruder, Repeater, Gray-Box IAST runtime agent, and GhostNetwork proxy failover). Ensure adaptive rate-limiting, anti-ban cooldowns, strict client header sanitization, and JA4 TLS mimicry operate reliably under heavy load.

### R4. Toolchain, MCP & Dependency Modernization
Audit workspace dependencies across Rust `Cargo.toml` files, Node `package.json`, and MCP server integration points. Resolve compilation warnings, modernize outdated dependencies, and verify that Docker lab matrices and standalone testbed hooks run with zero configuration friction.

## Acceptance Criteria & Invariants
- `cargo nextest run --manifest-path sentinel_core/Cargo.toml` passes 100% of all test suites with zero failures.
- `cargo check --manifest-path src-tauri/Cargo.toml` compiles with zero errors.
- `npm run build` completes cleanly with zero TypeScript errors (`tsc && vite build`).
- Wireshark (`4.6.8`) and Npcap (`1.88`) detection and launch IPC commands (`cmd_check_packet_capture_status`, `cmd_launch_wireshark`) execute successfully with valid telemetry.
- 100-worker concurrency tests in the Intruder and Scanner engines execute without thread starvation or unhandled Promise rejections.
- Existing security invariants (SEC-01 through SEC-12: fail-closed scope drop, CAS immutability, zeroize secrets) remain 100% intact.

Immediately create your plan.md, briefing.md, and progress.md in your working directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_hardening_1.
Dispatch specialists (explorers, workers, reviewers) to conduct analysis, implement optimizations, and verify all invariants.
Regularly update progress.md so Sentinel crons can monitor progress.
When all acceptance criteria are met and verified, notify Sentinel with a completion report so an independent Victory Auditor can be dispatched.

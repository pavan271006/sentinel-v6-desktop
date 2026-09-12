# Project: Sentinel Desktop Hardening and Architecture Audit

## Architecture
- **Desktop Host**: Tauri v2 application in `src-tauri/` binding frontend to native `sentinel_core` services.
- **Backend Core**: 34 modular workspace crates in `sentinel_core/` (Proxy, Repeater, Scanner, Storage, Bus, Scope, Dispatch, Fuzzer, etc.).
- **Frontend Layer**: React 18 + TypeScript + Vite + Zustand stores + TailwindCSS in `src/`.
- **Wire Forensics Layer**: Dynamic Npcap (1.88) driver hooks and Wireshark (4.6.8) CLI/GUI bridges.
- **Security Boundaries**: Formal Security Invariants SEC-01 through SEC-12 (default-deny scope gate, SHA-256 CAS immutability, SecretReference zeroization, two-tier event bus).

## Code Layout
- `src-tauri/src/main.rs`: Tauri entry point, event bus listeners, command handler registration.
- `src-tauri/src/commands.rs`: IPC command handlers bridging Tauri to `sentinel_core`.
- `src-tauri/src/state.rs`: Shared application state (`AppState`, observation store, project managers).
- `sentinel_core/crates/sentinel_repeater/`: Low-level raw socket executor, primed race barrier, TLS engine.
- `sentinel_core/crates/sentinel_dispatch/`: Outbound HTTP client and socket dispatcher.
- `sentinel_core/crates/sentinel_proxy/`: Proxy engine, MITM TLS interception, request handlers.
- `sentinel_core/crates/sentinel_scanner/`: SQL Scanner detection modules, Wald SPRT, causal verification.
- `src/ipc/client.ts`: Typed IPC client wrapper for Tauri commands.
- `src/ipc/events.ts`: Frontend event bus listener and dispatcher.
- `src/ipc/mockBridge.ts`: Browser/test fallback mock implementations.
- `src/services/sqlScanner/`: Frontend scanner orchestrator, GhostNetwork stealth, rate controller.
- `src/workspaces/`: Primary workspace views (Repeater, Fuzzer, Scanner, Settings, Traffic).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Keep-Alive Restoration | Eliminate `Connection: keep-alive` -> `Connection: close` mutation in `commands.rs` | M1 | Survey Explorer 1 |
| 2 | TCP Connection Pooling | Add TCP connection pooling & keep-alive reuse in repeater/dispatcher | M1 | Survey Explorer 1 |
| 3 | `TCP_NODELAY` Race Synchronization | Set `TCP_NODELAY` on primed race sockets and dispatcher sockets | M1 | Survey Explorer 1 |
| 4 | Wireshark 4.6.8 / Npcap 1.88 Dynamic Telemetry | Dynamic version querying & correct driver path detection in `cmd_check_packet_capture_status` | M1 | Survey Explorer 1 |
| 5 | Wireshark Live Launch Flags | Support live capture flags (`-k`, `-i`) and `%PATH%` binary search in `cmd_launch_wireshark` | M1 | Survey Explorer 1 |
| 6 | Intruder Buffer Virtualization | Prevent heap exhaustion in `FuzzerWorkspaceView.tsx` by paging `resultsBuffer` | M1 | Survey Explorer 1 |
| 7 | Concurrency Mutex Optimization | Optimize exclusive lock on `active_observation_store` in `commands.rs` | M1 | Survey Explorer 1 |
| 8 | Serde CamelCase Alignment | Add `#[serde(rename_all = "camelCase")]` to Traffic DTOs in `commands.rs` | M2 | Survey Explorer 2 |
| 9 | Repeater Diff Argument Alignment | Align `payload` vs `req` parameter key in `cmd_repeater_diff` | M2 | Survey Explorer 2 |
| 10 | Browser HTML Fallback Handling | Add fallback case for `cmd_open_html_in_browser` in `client.ts` | M2 | Survey Explorer 2 |
| 11 | StatusBar Telemetry Wiring | Wire `StatusBar.tsx` to dynamic `cmd_get_status` telemetry | M2 | Survey Explorer 2 |
| 12 | Proxy Engine Toggle Connection | Wire `cmd_toggle_proxy` to `SentinelProxyEngine` lifecycle | M2 | Survey Explorer 2 |
| 13 | Dead Route Rationalization | Clean up uninvoked dead commands and connect detached routes | M2 | Survey Explorer 2 |
| 14 | Critical Event Bus Subscription | Subscribe to `event_bus.subscribe_critical()` in `main.rs` to prevent dropped findings | M2 | Survey Explorer 2 |
| 15 | Telemetry Serialization Conformance | Stream structured telemetry for scan progress and tasks to `eventBusStore.ts` | M2 | Survey Explorer 2 |
| 16 | Stale Fallback Removal | Remove `gsmarena.com` and scope override in `events.ts` | M2 | Survey Explorer 2 |
| 17 | MockBridge Dynamic Code Splitting | Decouple `mockBridge.ts` from production bundle in `client.ts` | M2 | Survey Explorer 2 |
| 18 | Circular Dependency Resolution | Eliminate circular cycles in `src/services/sqlScanner/stealth/` | M2 | Survey Explorer 2 |
| 19 | Atomic Rate Limiter Synchronization | Fix thundering herd in `AdaptiveRateController.ts` with mutex/queue lock | M3 | Survey Explorer 3 |
| 20 | Worker Pool Exception Isolation | Fix `while` loop check and isolate worker promise rejections in `ConcurrentExecutor.ts` | M3 | Survey Explorer 3 |
| 21 | Fuzzer Timer Leak Guard | Wrap worker execution in `FuzzerWorkspaceView.tsx` with `try ... finally` | M3 | Survey Explorer 3 |
| 22 | Penetration Testing Engine Hardening | Verify SQL Scanner, Intruder, Repeater, IAST agent, GhostNetwork under heavy load | M3 | Survey Explorer 3 |
| 23 | Rust Compilation Warning Cleanup | Fix 7 compiler warnings across `sentinel_proxy`, `sentinel_scanner`, `commands.rs` | M4 | Survey Explorer 3 |
| 24 | Clippy Lint Policy Modernization | Review and modernize `[workspace.lints.clippy]` in `Cargo.toml` | M4 | Survey Explorer 3 |
| 25 | Dependency & Bundle Optimization | Audit `package.json` dependencies and optimize Vite bundle chunk splitting | M4 | Survey Explorer 3 |
| 26 | Docker & Standalone Testbed Verification | Verify Docker lab matrices and standalone testbed hooks run with zero friction | M4 | Survey Explorer 3 |
| 27 | 100-Worker Concurrency Stress Suite | Implement and pass dedicated 100-worker stress test suite in `tests/` | M5 | Survey Explorer 3 |
| 28 | Security Invariant SEC-01..12 Validation | Formally verify all 12 security invariants remain intact under load | M5 | Survey Explorer 3 |
| 29 | Acceptance Criteria Verification Suite | Run `cargo nextest` (100%), `cargo check` (0 err), `npm run build` (0 err) | M5 | User Acceptance |
| 30 | Victory Audit Readiness & Final Reporting | Synthesize documentation and trigger Victory Auditor notification | M6 | Orchestrator |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Wire Forensics & Network Throughput Hardening | Features 1-7: TCP pooling, `TCP_NODELAY`, Wireshark/Npcap telemetry & launch, Intruder heap guard | none | IN_PROGRESS |
| M2 | Zero-Latency IPC & Connection Architecture Cleanup | Features 8-18: Serde DTOs, argument alignment, dead routes, event bus critical stream, mockBridge splitting | none | PLANNED |
| M3 | Core Attack & Defense Engine Optimization | Features 19-22: Rate controller mutex, ConcurrentExecutor isolation, Fuzzer timer guard, engine load resilience | M1, M2 | PLANNED |
| M4 | Toolchain, MCP & Dependency Modernization | Features 23-26: 7 Rust warnings cleanup, clippy policy, Vite bundle optimization, testbed hooks | none | PLANNED |
| M5 | 100-Worker Concurrency & Invariant Verification Suite | Features 27-29: 100-worker concurrency tests, SEC-01..12 validation, full acceptance commands | M1, M2, M3, M4 | PLANNED |
| M6 | Victory Audit Readiness & Final Reporting | Feature 30: Completion report synthesis, audit notification | M5 | PLANNED |

## Interface Contracts
### `src-tauri/src/commands.rs` ↔ `src/ipc/client.ts`
- `cmd_check_packet_capture_status`:
  - Returns: `{ wireshark: bool, tshark: bool, npcap: bool, wiresharkVersion: string, npcapVersion: string, defaultFilter: string }` (camelCase)
- `cmd_launch_wireshark`:
  - Input: `{ filter?: string, interfaceName?: string }`
  - Returns: `{ success: bool, pid?: number, error?: string }`
- `cmd_repeater_diff`:
  - Input: `{ payload: RepeaterDiffRequest }` or aligned `{ req: RepeaterDiffRequest }`
  - Returns: `RepeaterDiffResult` (camelCase DTO)
- `cmd_get_traffic_page`:
  - Input: `TrafficPageQuery { page: number, pageSize: number, filterHttpql?: string, inScopeOnly?: boolean }`
  - Returns: `TrafficPageResult { items: TrafficSummaryItem[], totalCount: number, page: number, pageSize: number }`

### `sentinel_bus` ↔ `src-tauri/src/main.rs`
- EventBus channels:
  - Telemetry: `event_bus.subscribe_telemetry()` -> emitted to Tauri as `tauri://event:telemetry`
  - Critical: `event_bus.subscribe_critical()` -> emitted to Tauri as `tauri://event:critical` (findings, alerts, scope violations)

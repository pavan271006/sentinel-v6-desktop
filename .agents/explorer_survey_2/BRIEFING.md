# BRIEFING — 2026-09-11T08:02:00Z

## Mission
Survey R2: Zero-Latency IPC & Connection Architecture Cleanup. Audit every frontend-to-backend connection bridge, identify dead routes, unhandled exceptions, circular references, stale mock fallbacks, verify packet capture commands, analyze build readiness (`npm run build` and `cargo check`), and produce a comprehensive survey report and handoff.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: explorer
- Working directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_2
- Original parent: 94d601fe-cc12-4b39-babd-492e9642f362
- Milestone: Survey R2 (Sentinel Desktop Hardening and Architecture Audit)

## 🔒 Key Constraints
- Read-only investigation — do NOT modify any source code files. Write only to .agents/explorer_survey_2/.
- Ground all claims in exact file paths and line numbers.
- Provide concrete refactoring steps.

## Current Parent
- Conversation ID: 94d601fe-cc12-4b39-babd-492e9642f362
- Updated: 2026-09-11T08:01:50Z

## Investigation State
- **Explored paths**:
  - `src-tauri/src/main.rs`: 309 lines (Tauri setup, single instance mutex, event streaming, invoke_handler registration).
  - `src-tauri/src/commands.rs`: 2193 lines (32 commands, DTO definitions, serde attributes, Wireshark/Npcap launchers).
  - `src-tauri/src/state.rs`: 178 lines (AppState, AppStatus, DefaultScopeEngine, SentinelEventBus).
  - `src/ipc/client.ts`: 354 lines (SentinelIpcClient, invoke wrapper, fallback switch, mockBridge bridge).
  - `src/ipc/events.ts`: 108 lines (SentinelStreamDispatcher, stream event parsing).
  - `src/ipc/contracts.ts`: 131 lines (IPC response/query types).
  - `src/ipc/mockBridge.ts`: 2008 lines (Mock backend implementation).
  - `src/stores/`: `trafficStore.ts`, `inspectorStore.ts`, `appShellStore.ts`, `eventBusStore.ts`, `repeaterStore.ts`, `projectStore.ts`, `scopeStore.ts`.
  - `src/services/sqlScanner/stealth/`: `GhostNetwork.ts`, `SessionManager.ts`, `AdaptiveRateController.ts`.
  - Build & test outputs: `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `npm test -- --run`.

- **Key findings**:
  1. Build status: `npm run build` succeeds (code 0), `cargo check --manifest-path src-tauri/Cargo.toml` succeeds (code 0), Vitest has 95/96 passing suites (857 passing tests, 1 throughput stress test failed due to synchronous array copying).
  2. Wireshark & Npcap: Host has Wireshark 4.6.8 and Npcap 1.88 installed; both `cmd_launch_wireshark` and `cmd_check_packet_capture_status` exist and are wired, but have path detection limitations.
  3. Deserialization bug: `TrafficPageQuery`, `TrafficSummaryItem`, `TrafficPageResult`, `TrafficDiffRequest`, `TrafficDiffResult`, `HeaderDiffItemDto`, and `LineDiffItemDto` in `commands.rs` lack `#[serde(rename_all = "camelCase")]`, breaking pagination and diff in native desktop mode.
  4. Parameter name mismatch: `cmd_repeater_diff` expects `payload` in Rust, but `client.ts` sends `{ req }`.
  5. Unhandled exception in fallback: `cmd_open_html_in_browser` has no case in `client.ts` switch.
  6. Dead routes: 13 out of 32 Tauri commands are never called by any frontend UI component or store.
  7. Simulated backend logic: `cmd_toggle_proxy` toggles a boolean but never interacts with `SentinelProxyEngine`.
  8. Critical event dropping: `main.rs` never subscribes to `event_bus.subscribe_critical()`; non-traffic telemetry is emitted as unparsed debug text, causing `eventBusStore` to drop all findings/scan updates.
  9. Stale fallbacks & mock bundling: `mockBridge.ts` (77 KB) is statically imported into `client.ts`, bloating production desktop bundles. Hardcoded fallback in `events.ts` sets `uri: ... || 'https://www.gsmarena.com/'` and `inScope: true`.
  10. Circular module coupling: `GhostNetwork.ts` <-> `SessionManager.ts` <-> `AdaptiveRateController.ts`.

- **Unexplored areas**: None. Full survey complete.

## Key Decisions Made
- Consolidate all evidence with exact line numbers into `report.md` and `handoff.md`.
- Provide concrete step-by-step refactoring instructions for implementers.

## Artifact Index
- report.md — Comprehensive Survey Report for R2
- handoff.md — 5-component handoff report
- detect_cycles.cjs — Tool to detect module cycles

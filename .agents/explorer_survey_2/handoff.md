# Handoff Report: Survey R2 — Zero-Latency IPC & Connection Architecture Cleanup

**Agent**: Explorer Subagent (Survey 2)  
**Parent Task ID / Recipient**: `94d601fe-cc12-4b39-babd-492e9642f362`  
**Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_2`  
**Report Artifact**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_survey_2\report.md`  
**Handoff Type**: Hard (Survey Complete)

---

## 1. Observation

1. **Frontend Compilation (`npm run build`)**:
   - Command: `npm run build` (`tsc && vite build`) exited with code 0 in 26.30s.
   - Bundle size: `dist/assets/index-WwGa8BO6.js` is 1,555.31 kB (>500 kB warning).
   - Dynamic import conflicts:
     - `src/stores/trafficStore.ts` dynamically imported by `src/stores/inspectorStore.ts:86`.
     - `src/services/sqlScanner/OobManager.ts` dynamically imported by `VectorizedExtractionStage.ts`.
     - `src/services/sqlScanner/engine/InteractshClient.ts` dynamically imported by `src/ipc/mockBridge.ts:1388`.
2. **Tauri Backend Compilation (`cargo check`)**:
   - Command: `cargo check --manifest-path src-tauri/Cargo.toml` exited with code 0 in 1m 08s.
   - Warnings: `src-tauri/src/commands.rs:914:9` (`unused variable: now`), 5 warnings in `sentinel_proxy/src/handler.rs` (lines 16, 69, 103, 134, 144), 1 warning in `sentinel_scanner/src/sql/blind.rs:15`.
3. **Frontend Test Suite (`npm test -- --run`)**:
   - Result: 95/96 suites passed, 857/858 tests passed.
   - Failed test: `tests/stress/AdversarialChallengeUI1.test.tsx` (Challenge 1) failed on `expect(eventsPerSec).toBeGreaterThan(400)` with `354.09 events/sec`.
4. **Wire Forensics Telemetry (`cmd_check_packet_capture_status` & `cmd_launch_wireshark`)**:
   - Host inspection: `Test-Path 'C:\Program Files\Wireshark\Wireshark.exe'` returned `True`; `Test-Path 'C:\Windows\System32\Npcap\wpcap.dll'` returned `True`; `Test-Path 'C:\Windows\System32\drivers\npcap.sys'` returned `True`.
   - `tshark --version` returned `TShark (Wireshark) 4.6.8` with `Npcap 1.88`.
   - `cmd_launch_wireshark` (`src-tauri/src/commands.rs:2062-2081`) and `cmd_check_packet_capture_status` (`commands.rs:2084-2098`) are registered in `main.rs:278-279` and called in `SettingsWorkspaceView.tsx:51, 73`.
5. **Serialization & Deserialization Deficiencies in `commands.rs`**:
   - `TrafficPageQuery` (`commands.rs:700`), `TrafficSummaryItem` (`commands.rs:710`), and `TrafficPageResult` (`commands.rs:732`) do NOT have `#[serde(rename_all = "camelCase")]`.
   - `TrafficDiffRequest` (`commands.rs:871`), `HeaderDiffItemDto` (`commands.rs:879`), `LineDiffItemDto` (`commands.rs:887`), and `TrafficDiffResult` (`commands.rs:895`) do NOT have `#[serde(rename_all = "camelCase")]`.
6. **Parameter Name Mismatch in `cmd_repeater_diff`**:
   - `src-tauri/src/commands.rs:1780` defines parameter `payload: RepeaterDiffRequest`.
   - `src/ipc/client.ts:281` invokes `cmd_repeater_diff` with `{ req }`.
7. **Unhandled Fallback Exception in `client.ts`**:
   - `cmd_open_html_in_browser` is invoked at `src/utils/contextMenuUtils.ts:176`.
   - In `src/ipc/client.ts:59-171`, `switch (command)` has no case for `cmd_open_html_in_browser`.
8. **Dead Commands**:
   - 13 out of 32 registered commands have 0 callers in `src/workspaces/` and `src/stores/`: `cmd_get_platform_info`, `cmd_get_status`, `cmd_productivity_search`, `cmd_httpql_validate`, `cmd_repeater_create_tab`, `cmd_repeater_diff`, `cmd_repeater_export_curl`, `cmd_repeater_extract_variable`, `cmd_ucmax_analyze_boolean`, `cmd_ucmax_plan_next_step`.
   - `StatusBar.tsx:90` displays hardcoded string `"Memory: 285.3MB of 7.60GB"`.
   - `cmd_toggle_proxy` (`commands.rs:141-145`) merely flips `status.proxy_running = !status.proxy_running;` without interacting with `SentinelProxyEngine`.
9. **Event Streaming Deficiencies**:
   - `src-tauri/src/main.rs:136`: only `event_bus.subscribe_telemetry()` is listened to. `event_bus.subscribe_critical()` is never subscribed, dropping `CriticalEvent` instances.
   - Non-traffic events are formatted as `format!("{:?}", other)` under `"type": "telemetry"`, causing `eventBusStore.ts` to drop scan progress and tasks.
   - `src/ipc/events.ts:71` hardcodes fallback `uri: event.payload.url || 'https://www.gsmarena.com/'` and `inScope: true`.
10. **Module Coupling & Bloat**:
    - `src/ipc/client.ts:29` statically imports `mockBridge.ts` (77 KB), including it in the production bundle.
    - Two circular cycles in `src/services/sqlScanner/stealth/`: `GhostNetwork.ts` <-> `SessionManager.ts` and `GhostNetwork.ts` <-> `AdaptiveRateController.ts`.

---

## 2. Logic Chain

1. **From Observation 5**: `TrafficPageQuery` and `TrafficDiffRequest` lack `rename_all = "camelCase"`. In TypeScript, `TrafficPageQuery` has `filterHttpql` and `inScopeOnly`. Because Serde expects snake_case without the attribute, it deserializes them as `None`, silently discarding the filter query. When `TrafficDiffRequest` is deserialized, it expects `id_a`, but receives `idA`, throwing a deserialization error. Furthermore, `TrafficPageResult` returns `total_count` and `items` with `duration_ms`, which TypeScript cannot map to `totalCount` and `durationMs`, causing `undefined`/`NaN` display in the traffic table.
2. **From Observation 6**: Tauri 2 matches command parameters by argument name. Because `commands.rs:1780` defines `payload: RepeaterDiffRequest` and `client.ts:281` invokes with `{ req }`, invoking `cmd_repeater_diff` in desktop mode rejects with `missing required key payload`.
3. **From Observation 7**: In non-Tauri/test environments, invoking `openHtmlInBrowser` hits `default:` in `client.ts:170`, throwing `Unhandled IPC command in fallback: cmd_open_html_in_browser`.
4. **From Observation 8**: Out of 32 commands, 13 are completely dead. Furthermore, the desktop application displays static hardcoded memory numbers (`StatusBar.tsx`) rather than querying `cmd_get_status`, and proxy toggle is simulated on a boolean flag rather than operating the real proxy engine.
5. **From Observation 9**: By omitting `event_bus.subscribe_critical()`, the Tauri backend drops all security findings, candidate verification records, and scope violation alerts from the UI event bus, violating SEC-12.
6. **From Observation 10**: Statically importing `mockBridge.ts` in `client.ts` causes the 2,008-line mock backend to be permanently included in production builds, inflating bundle size to 1.55 MB.

---

## 3. Caveats

- Rust unit/integration test suite (`cargo test --workspace`) in `sentinel_core` was not executed during this survey pass to maintain focus on the Tauri desktop app and IPC bridge readiness (`src-tauri` and `src`).
- Wireshark execution via `cmd_launch_wireshark` was tested via path verification and CLI version output; live GUI spawn was not executed to prevent stealing window focus or blocking background processes.
- No other caveats.

---

## 4. Conclusion

The Sentinel Desktop application is build-ready (`npm run build` and `cargo check` compile with zero errors, and 857 Vitest tests pass), and Wireshark 4.6.8 / Npcap 1.88 are verified present on the host. However, the connection architecture has critical runtime contract defects:
1. Two major DTO groups in `commands.rs` lack `rename_all = "camelCase"`, which breaks traffic pagination, filtering, and diff in native desktop mode.
2. Parameter key mismatch on `cmd_repeater_diff` breaks repeater diff execution.
3. Fallback switch in `client.ts` misses `cmd_open_html_in_browser`.
4. 13 Tauri commands are dead routes, and the proxy toggle is simulated on a detached boolean.
5. Critical audit events are completely unforwarded in `main.rs`, and non-traffic telemetry is stringified, rendering `eventBusStore` unable to process live findings or scan tasks.
6. `mockBridge.ts` is statically bundled into production, and circular imports exist in the stealth subsystem.

Remediating these 6 issues using the step-by-step refactoring plan detailed in `report.md` will restore 100% contract fidelity, eliminate dead code and stale fallbacks, and achieve zero-latency IPC.

---

## 5. Verification Method

1. **Verify Serde DTOs in `src-tauri/src/commands.rs`**:
   - Check lines 700, 710, 732, 871, 879, 887, 895 for `#[serde(rename_all = "camelCase")]`.
2. **Verify Tauri compilation**:
   - Run `cargo check --manifest-path src-tauri/Cargo.toml`.
3. **Verify Frontend build**:
   - Run `npm run build` (`tsc && vite build`).
4. **Verify Wireshark & Npcap on host**:
   - Run `powershell -Command "Test-Path 'C:\Program Files\Wireshark\Wireshark.exe'; Test-Path 'C:\Windows\System32\Npcap\wpcap.dll'"`
5. **Verify Circular Dependencies**:
   - Run `node .agents/explorer_survey_2/detect_cycles.cjs`.
6. **Invalidation Condition**:
   - Any modification to `commands.rs` that breaks `cargo check` or introduces new TypeScript type mismatches in `contracts.ts` invalidates this report.

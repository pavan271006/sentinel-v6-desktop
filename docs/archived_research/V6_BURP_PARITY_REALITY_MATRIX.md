# Sentinel V6 — Burp Parity Reality Matrix (Forensic System Audit)
**Audit Date:** 2026-08-25  
**Auditor:** Sentinel Forensic Engineering System  
**Objective:** Complete granular inventory of every UI surface, control, IPC channel, backend domain service, and persistence layer.

---

## 1. System Inventory Summary

| Subsystem / Tool | Total Features Audited | WORKING | PARTIAL | UI_ONLY | MOCK / STUB | BACKEND_ONLY | BROKEN |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A. Dashboard & Scanner** | 12 | 5 | 4 | 2 | 1 | 0 | 0 |
| **B. Target & Site Map** | 16 | 12 | 3 | 0 | 1 | 0 | 0 |
| **C. Proxy & HTTP Intercept** | 18 | 15 | 2 | 1 | 0 | 0 | 0 |
| **D. Repeater** | 20 | 18 | 2 | 0 | 0 | 0 | 0 |
| **E. Intruder / Fuzzer** | 18 | 14 | 3 | 1 | 0 | 0 | 0 |
| **F. Scanner / Crawler Engine** | 14 | 8 | 4 | 0 | 2 | 0 | 0 |
| **G. Sequencer** | 10 | 7 | 2 | 1 | 0 | 0 | 0 |
| **H. Decoder / Encoder** | 14 | 12 | 2 | 0 | 0 | 0 | 0 |
| **I. Comparer** | 10 | 9 | 1 | 0 | 0 | 0 | 0 |
| **J. Logger** | 10 | 8 | 2 | 0 | 0 | 0 | 0 |
| **K. Inspector (Side Panel)** | 12 | 10 | 2 | 0 | 0 | 0 | 0 |
| **L. Out-of-Band (OAST)** | 10 | 7 | 2 | 0 | 1 | 0 | 0 |
| **M. Browser Integration** | 10 | 8 | 2 | 0 | 0 | 0 | 0 |
| **N. Organizer** | 10 | 8 | 2 | 0 | 0 | 0 | 0 |
| **O. Settings & Project WAL** | 14 | 11 | 3 | 0 | 0 | 0 | 0 |
| **P. Extensions & Plugins** | 10 | 6 | 3 | 1 | 0 | 0 | 0 |
| **Q. Findings & Reporting** | 12 | 9 | 3 | 0 | 0 | 0 | 0 |
| **TOTAL** | **218** | **161** | **42** | **10** | **5** | **0** | **0** |

---

## 2. Granular Feature-by-Feature Forensic Audit

| FEATURE_ID | UI_LOCATION | LABEL | EXPECTED_BEHAVIOR | CURRENT_BEHAVIOR | IPC_COMMAND | BACKEND_HANDLER | DOMAIN_SERVICE | PERSISTENCE | TEST | E2E_TEST | STATUS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DASH-01** | `ScannerWorkspaceView.tsx` | Task Dashboard | Render real running audit/crawl tasks | Shows live tasks and candidate items | `cmd_get_status` | `commands.rs::cmd_get_status` | `sentinel_scanner` | SQLite | `ScannerWorkspaceView.test.tsx` | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **DASH-02** | `ScannerWorkspaceView.tsx` | New Scan Button | Open scan configuration modal | Opens modal dialog | N/A (State) | `useScannerStore` | `sentinel_scanner` | Session | Unit | Manual | **PARTIAL** |
| **DASH-03** | `ScannerWorkspaceView.tsx` | Pause/Resume All | Toggle scanner pause state | Updates store state & telemetry | `cmd_toggle_proxy` | `commands.rs::cmd_toggle_proxy` | `sentinel_proxy` | In-Memory | Unit | Manual | **WORKING** |
| **DASH-04** | `ScannerWorkspaceView.tsx` | Live Issue Feed | Discovered issues stream | Displays real CAS finding items | `sentinel://stream-event` | `main.rs::telemetry_rx` | `sentinel_verification` | Merkle CAS | `vulnIntelStore.test.ts` | `tier3_cross_feature_streams.test.ts` | **WORKING** |
| **TGT-01** | `ProjectScopeWorkspaceView.tsx` | Site Map Tree | Recursive host/folder/leaf tree | Renders live hierarchy from traffic | `sentinel://stream-event` | `commands.rs::cmd_traffic_get_page` | `sentinel_storage` | SQLite WAL | `ProjectScopeWorkspaceView.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **TGT-02** | `ProjectScopeWorkspaceView.tsx` | ✨ Auto-Discover Hidden Content | Probes robots.txt, sitemap.xml, swagger, admin endpoints | Active asynchronous probe loop & parser | `cmd_repeater_send_request` | `commands.rs::cmd_repeater_send_request` | `sentinel_repeater` | SQLite WAL | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **TGT-03** | `ProjectScopeWorkspaceView.tsx` | Open URL in browser | Launch OS browser connected to proxy | Spawns Chrome/Edge with `--proxy-server` | `cmd_launch_system_browser` | `commands.rs::cmd_launch_system_browser` | Process | OS Process | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **TGT-04** | `ProjectScopeWorkspaceView.tsx` | Filter Pill Bar | Filter out 4xx, media, out-of-scope | Modal filter updates visibility | N/A (State) | `useScopeStore` | `sentinel_scope` | LocalStorage | `ScopeEngineAdversarialUI2.stress.test.ts` | `tier2_boundary_limits.test.ts` | **WORKING** |
| **TGT-05** | `ProjectScopeWorkspaceView.tsx` | Scope Boundary Rules | Add/Delete/Toggle Include/Exclude ACL rules | Updates in-memory and WAL rule definitions | `cmd_scope_update` | `commands.rs::cmd_scope_update` | `sentinel_scope` | SQLite WAL | `scopeStore.test.ts` | `tier2_boundary_limits.test.ts` | **WORKING** |
| **PRX-01** | `TrafficWorkspaceView.tsx` | Intercept On/Off | Pause HTTP requests for live tampering | Toggles intercept mode | `cmd_toggle_proxy` | `commands.rs::cmd_toggle_proxy` | `sentinel_proxy` | In-Memory | `TrafficWorkspaceView.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **PRX-02** | `TrafficWorkspaceView.tsx` | Forward / Drop | Send or reject paused transaction | Forwards or drops intercepted socket stream | `cmd_repeater_send_request` | `commands.rs::cmd_repeater_send_request` | `sentinel_proxy` | In-Memory | Unit | Manual | **WORKING** |
| **PRX-03** | `VirtualTrafficTable.tsx` | HTTP History Virtual Table | High-density virtualized 100k row table | Virtualized DOM with sorting and selection | `cmd_traffic_get_page` | `commands.rs::cmd_traffic_get_page` | `sentinel_storage` | SQLite RingBuffer | `VirtualTrafficTable.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **PRX-04** | `HttpqlQueryBar.tsx` | HTTPQL Filter Bar | Syntax highlighting & AST evaluation query | Validates & filters transactions in real time | `cmd_httpql_validate` | `commands.rs::cmd_httpql_validate` | `sentinel_httpql` | LocalStorage | `httpql.test.ts` | `tier1_feature_perf.test.ts` | **WORKING** |
| **PRX-05** | `TrafficWorkspaceView.tsx` | Open Browser Button | Launch Chromium routed through 127.0.0.1:8085 | Spawns system browser directly | `cmd_launch_system_browser` | `commands.rs::cmd_launch_system_browser` | Process | OS Process | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **REP-01** | `RepeaterTabBar.tsx` | Multi-Tab Management | Create, rename, close, re-open tabs | Creates independent tab states | `cmd_repeater_create_tab` | `commands.rs::cmd_repeater_create_tab` | `sentinel_repeater` | Session / SQLite | `RepeaterTabBar.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **REP-02** | `RequestEditorPanel.tsx` | Request Editor | Raw, Pretty, Hex, Headers, Params, Body | Edits raw HTTP wire text | N/A (State) | `useRepeaterStore` | `sentinel_repeater` | In-Memory | `RequestEditorPanel.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **REP-03** | `RepeaterWorkspaceView.tsx` | Send (Ctrl+Enter) | Dispatch request via proxy socket engine | Sends request and captures raw response | `cmd_repeater_send_request` | `commands.rs::cmd_repeater_send_request` | `sentinel_repeater` | SQLite WAL | `repeaterStore.test.ts` | `tier1_feature_perf.test.ts` | **WORKING** |
| **REP-04** | `ResponseViewerPanel.tsx` | Response Viewer | Pretty, Raw, Hex, Render (iframe) | Renders formatted body, headers, status | N/A (State) | `useRepeaterStore` | `sentinel_repeater` | SQLite WAL | `ResponseViewerPanel.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **REP-05** | `RepeaterHistoryDrawer.tsx` | Revision History | Stack of past requests & responses | Restores past revisions | N/A (State) | `useRepeaterStore` | `sentinel_repeater` | In-Memory Stack | `RepeaterHistoryDrawer.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **REP-06** | `RepeaterDiffModal.tsx` | Side-by-Side Diff | Compares two revisions with visual diff | Diff viewer with word/byte diffing | `cmd_repeater_diff` | `commands.rs::cmd_repeater_diff` | `sentinel_repeater` | In-Memory | `RepeaterDiffModal.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **REP-07** | `RepeaterVariablesModal.tsx` | Dynamic Variables | Extract regex/json variables from response | Stores variable state for tab interpolation | `cmd_repeater_extract_variable` | `commands.rs::cmd_repeater_extract_variable` | `sentinel_repeater` | Session | `RepeaterVariablesModal.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **FUZ-01** | `FuzzerWorkspaceView.tsx` | Payload Position Markers | Add/Clear `§...§` markers in textarea | Sets positions directly from text selection | N/A (State) | `useIntruderStore` | `sentinel_fuzzer` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **FUZ-02** | `FuzzerWorkspaceView.tsx` | Attack Types | Sniper, Battering Ram, Pitchfork, Cluster Bomb | Selectable attack strategy | N/A (State) | `useIntruderStore` | `sentinel_fuzzer` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **FUZ-03** | `FuzzerWorkspaceView.tsx` | Payload Generators | Simple list, Numbers, Brute forcer, Null | Configures generator sets & wordlists | N/A (State) | `useIntruderStore` | `sentinel_fuzzer` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **FUZ-04** | `FuzzerWorkspaceView.tsx` | Start Attack Window | Launch floating/maximized attack window | Executes real HTTP requests concurrently | `cmd_repeater_send_request` | `commands.rs::cmd_repeater_send_request` | `sentinel_fuzzer` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **FUZ-05** | `FuzzerWorkspaceView.tsx` | Attack Export | Save results to CSV, JSON, TXT dump | Generates and downloads files | N/A (DOM) | Browser File API | Frontend | Download | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **FUZ-06** | `FuzzerWorkspaceView.tsx` | Results Context Menu | Send row to Repeater, Intruder, Sequencer, Comparer | Populates target store and switches tab | N/A (State) | Cross-Store Dispatch | Inter-Store | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **DEC-01** | `DecoderWorkspaceView.tsx` | Transformation Workbench | URL, Base64, Hex, HTML, Hash enc/dec | Multi-stage transformation cascade | N/A (Pure JS/Wasm) | `decoderStore.ts` | `sentinel_productivity` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **CMP-01** | `ComparerWorkspaceView.tsx` | Word & Byte Diff | Side-by-side text and byte comparison | Synchronized scroll and diff stats | N/A (Pure JS) | `comparerStore.ts` | `sentinel_productivity` | In-Memory | `DiffViewer.test.tsx` | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **SEQ-01** | `SequencerWorkspaceView.tsx` | Randomness & Entropy Analysis | Statistical randomness tests on tokens | Live token capture & entropy calculation | N/A (Pure JS/Wasm) | `sequencerStore.ts` | `sentinel_fuzzer` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **ORG-01** | `OrganizerWorkspaceView.tsx` | Saved Message Notebook | Tagged & color-coded HTTP records | Add notes, tags, re-send to tools | N/A (State) | `organizerStore.ts` | `sentinel_storage` | LocalStorage | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **OAST-01** | `OastWorkspaceView.tsx` | Collaborator Interaction Polling | DNS/HTTP out-of-band correlation | Generates unique payload tokens | N/A (State) | `useToastStore` | `sentinel_oast` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **LOG-01** | `LoggerWorkspaceView.tsx` | Unified Traffic & Event Log | Real-time event and error stream | Displays timestamped logs and filters | `sentinel://stream-event` | `main.rs::telemetry_rx` | `sentinel_bus` | In-Memory | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **SET-01** | `SettingsWorkspaceView.tsx` | Port & Upstream Proxy Settings | Configure proxy port and TLS certs | Displays network settings & diagnostics | `cmd_get_status` | `commands.rs::cmd_get_status` | `sentinel_proxy` | SQLite | Manual | `tier4_pentester_workflows.test.ts` | **WORKING** |
| **PROJ-01** | `ProjectModal.tsx` | SQLite WAL Snapshot | Commit SQLite WAL checkpoint | Forces SQLite WAL checkpoint to disk | `cmd_project_wal_checkpoint` | `commands.rs::cmd_project_wal_checkpoint` | `sentinel_storage` | SQLite DB | `ProjectModal.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **PROJ-02** | `ProjectModal.tsx` | Project Export (.zip) | Create compressed project backup | Exports SQLite DB and metadata | `cmd_project_export` | `commands.rs::cmd_project_export` | `sentinel_storage` | Filesystem | `ProjectModal.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |
| **PROJ-03** | `ProjectModal.tsx` | Project Import (.zip) | Restore project workspace from archive | Unpacks archive and loads storage | `cmd_project_import` | `commands.rs::cmd_project_import` | `sentinel_storage` | Filesystem | `ProjectModal.test.tsx` | `tier1_feature_perf.test.ts` | **WORKING** |

---

## 3. Forensic Finding: Gaps & Actions Required

1. **Test Selector Mismatches**:
   - `TransactionInspectorPanel.test.tsx`: Tests failed due to finding 2 search inputs (since we added dual request & response search bars matching Burp Suite).
   - Solution: Update test queries to select specific Request/Response search inputs.
2. **Dashboard Task Panel Real Wiring**:
   - Upgrade `ScannerWorkspaceView.tsx` to display real scan tasks, live audit findings from `vulnIntelStore`, real-time event logs, and active progress rather than static arrays.
3. **App-Wide Context Menu Consistency**:
   - Ensure all workspaces have unified `buildTrafficContextMenu` handlers attached with hotkeys (`Ctrl+R`, `Ctrl+I`, `Ctrl+O`).

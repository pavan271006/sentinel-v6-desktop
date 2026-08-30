# SENTINEL V6 — TOOL ECOSYSTEM & SUBSYSTEM CAPABILITY AUDIT
**Document ID**: `SENTINEL-SPEC-M2-AUD-001`  
**Version**: 6.0.0-PROD  
**Classification**: Authoritative Architectural Audit & Tool Consolidation Blueprint  
**Attestation Date**: August 2026  
**Status**: ACTIVE / FROZEN BASELINE  

---

## 1. Executive Summary & Audit Governance

### 1.1 Mission & Objectives
The SENTINEL V6 Security Platform is an enterprise-grade, clean-room offensive cyber security workstation built in Rust (`sentinel_core`) and Tauri / React / TypeScript (`src/`). Over successive engineering milestones, 28 specialized backend crates and 28 frontend workspace views were developed. While this granular architecture achieved comprehensive test coverage and modularity, it inadvertently created severe **UI screen sprawl**, **cognitive friction**, and **context abandonment** for penetration testers.

This audit systematically evaluates all **28 backend subsystems** and **28 frontend workspace views** against operational penetration testing realities. It establishes an authoritative rationalization action (`KEEP`, `MERGE`, `RENAME`, `REPLACE`, `DEPRECATE`, `CONTEXTUALIZE`) for every component, consolidating 28 fragmented full-screen views into an ergonomic, high-density workstation centered around the canonical **8-Stage Offensive Pentesting Lifecycle**:
$$\text{Traffic} \longrightarrow \text{Understand} \longrightarrow \text{Test} \longrightarrow \text{Verify} \longrightarrow \text{Evidence} \longrightarrow \text{Finding} \longrightarrow \text{Retest} \longrightarrow \text{Report}$$

### 1.2 Evaluation Dimensions
Every subsystem and UI capability is audited across six rigorous dimensions:
1. **Code Paths**: Backend crate in `sentinel_core/crates/` and frontend view in `src/workspaces/`.
2. **Frequency of Use**:
   - `Daily (Continuous)`: Core testing loop executed constantly in every engagement (e.g., Traffic, Repeater, Findings).
   - `Frequent (Multi-Hour)`: High-value operations invoked multiple times per engagement (e.g., Fuzzing, Auth Matrix, Diff).
   - `Periodic (Phase-Specific)`: Specialist tools used during specific testing stages (e.g., OAST, Browser DOM, Reports).
   - `Niche (Occasional)`: Rare or isolated verification algorithms (e.g., Sequencer Token Entropy).
   - `Redundant`: Duplicated functionality creating state fragmentation (e.g., Logger vs Traffic, Comparer vs Inline Diff).
3. **Pentester Value Rating**:
   - `Critical`: Essential blocker for vulnerability discovery, scope control, or compliance proof.
   - `High`: Core capability providing significant competitive efficiency or unique detection.
   - `Medium`: Supporting productivity enhancer or specialized protocol handler.
   - `Low`: Ancillary, duplicative, or better served via contextual overlays.
4. **UI Complexity**:
   - `Sprawling`: Fragmented multi-view or unorganized UI causing excessive navigation.
   - `Complex`: Dense, multi-state tabular or canvas view requiring structured sub-panes.
   - `Moderate`: Standard interactive forms, trees, or split editors.
   - `Minimal`: Single-purpose utility or raw text interface.
5. **Pain Points & Friction**: Specific workflow disruptions, focus losses, copy-paste penalties, or state desynchronizations.
6. **Rationalization Action & Architectural Disposition**: Authoritative classification into `KEEP`, `MERGE`, `RENAME`, `REPLACE`, `DEPRECATE`, or `CONTEXTUALIZE` with exact target placement in the consolidated workspace.

---

## 2. Comprehensive Subsystem & Workspace Audit Matrix

The table below provides the exhaustive evaluation of all 28 backend crates and 28 frontend workspace views:

| # | Subsystem / Capability | Backend Code Path (`sentinel_core/crates/`) | Frontend View (`src/workspaces/`) | Frequency of Use | Pentester Value | UI Complexity | Current Pain Points & Friction | Action | Architectural Disposition & Detailed Rationale |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Scope & Target Policy** | `sentinel_scope` (SUB-04), `sentinel_storage` (SUB-02) | `ProjectScopeWorkspaceView.tsx` (1,008 lines, 48KB) | Daily (Continuous) | Critical | Sprawling | Scope rules often hidden behind tabs; out-of-scope drop visibility is disconnected from active traffic stream. | **KEEP** | **Primary Workspace: Target & Scope (`Alt+S`)**. Authoritative pre-socket fail-closed gate (`SEC-01`), CIDR/Regex rule editor, visual DENY inspector, and SSRF loopback protections. |
| 2 | **Traffic History & Interceptor** | `sentinel_proxy` (SUB-06), `sentinel_parser` (SUB-05), `sentinel_storage` (SUB-02) | `TrafficWorkspaceView.tsx` (414 lines, 15KB) | Daily (45% engagement time) | Critical | Complex | Real-time proxy traffic separated from multi-tool logging; diffing required switching to standalone Comparer. | **KEEP & ENHANCE** | **Primary Workspace: Traffic Hub (`Alt+1`)**. High-throughput virtualized data table (1M+ rows), live MITM interceptor, HTTPQL search bar, origin filter chips, and integrated diff. |
| 3 | **HTTPQL Query Engine** | `sentinel_httpql` (SUB-07) | Integrated in `TrafficWorkspaceView.tsx` | Daily (Continuous) | Critical | Moderate | Filter syntax isolated to traffic view; not universally accessible across attack graph, findings, and logs. | **MERGE & UNIVERSALIZE** | **Universal Query Filter Bar** (Traffic, Intelligence, Findings). AST-compiled fast filtering (`status:>=400 and mime:json and host:target.com`) with autocomplete and saved presets. |
| 4 | **Repeater Request Studio** | `sentinel_repeater` (SUB-08) | `RepeaterWorkspaceView.tsx` (134 lines, 3.7KB) | Daily (35% engagement time) | Critical | Complex | Encoding payloads required leaving to Decoder tab; response diff required external tool; variable management modal was clunky. | **MERGE & ENHANCE** | **Primary Workspace: Manual Testing Lab (`Alt+2`) [Replay Mode]**. Multi-tab HTTP/1.1 & HTTP/2 editor, live streaming response, inline diff (`Ctrl+D`), contextual transforms (`Ctrl+E`), dynamic `{{env}}` interpolation. |
| 5 | **Mutation Fuzzer & Minimizer** | `sentinel_fuzzer` (SUB-14) | `FuzzerWorkspaceView.tsx` (1,027 lines, 54KB) | Frequent (Multi-Hour) | High | Sprawling | Disconnected from Repeater; setting up attack positions required manual re-importing; payload minimizer was isolated. | **MERGE** | **Primary Workspace: Manual Testing Lab (`Alt+2`) [Fuzz Mode]**. Integrated attack modes (Sniper, Battering Ram, Pitchfork, Cluster Bomb), live results grid, Delta Debugging (`ddmin`) minimizer. |
| 6 | **Turbo Intruder (Async Pipeline)** | `sentinel_fuzzer` (SUB-14), `sentinel_logic` (SUB-20) | `TurboIntruderWorkspaceView.tsx` (162 lines, 6.7KB) | Periodic | High | Complex | Ad-hoc Python script simulation disconnected from Rust backend; separate full-screen tab created cognitive friction. | **REPLACE & MERGE** | **Primary Workspace: Manual Testing Lab (`Alt+2`) [Turbo Mode]**. Replaced with native Rust high-throughput async multiplexed socket engine (5,000+ RPS) and pipelining presets. |
| 7 | **Single-Packet Race Prober** | `sentinel_logic` (SUB-20) | Embedded in `sentinel_logic` | Periodic | High | Moderate | Lacked dedicated UI controls; race condition testing was scattered across custom scripts. | **MERGE** | **Primary Workspace: Manual Testing Lab (`Alt+2`) [Race Mode]**. Synchronized HTTP/2 single-packet barrier release for limit overrun, double-spend, and coupon race conditions. |
| 8 | **Active / Passive Scanner** | `sentinel_scanner` (SUB-13), `sentinel_verification` (SUB-15) | `ScannerWorkspaceView.tsx` (330 lines, 13KB) | Daily | Critical | Complex | Automated scanning separated from content discovery and parameter mining; candidate issues lacked unified triage. | **MERGE & KEEP** | **Primary Workspace: Security Engines (`Alt+4`) [Scanner Subtab]**. Active/passive check runner, concurrency/rate limit governors (`SEC-10`), Next-Best-Test recommendations. |
| 9 | **Discover Content (Dir/File Fuzz)** | `sentinel_scanner` (SUB-13), `sentinel_context` (SUB-09) | `DiscoverWorkspaceView.tsx` (161 lines, 6.9KB) | Frequent | High | Moderate | Standalone directory brute-forcing screen created redundant table views that disconnected from the attack graph. | **RENAME & MERGE** | **Primary Workspace: Target Intelligence (`Alt+3`) [Content Discovery]**. Recursive directory/file crawler and wordlist fuzzer updating the Knowledge Graph in real time. |
| 10 | **Param Miner (Parameter Discovery)**| `sentinel_context` (SUB-09), `sentinel_fuzzer` (SUB-14) | `ParamMinerWorkspaceView.tsx` (126 lines, 5.6KB) | Frequent | High | Moderate | Disconnected from traffic inspector; hard to trigger ad-hoc parameter mining directly from captured transactions. | **MERGE & CONTEXTUALIZE** | **Primary Workspace: Target Intelligence (`Alt+3`) [Param Miner] + Context Menu**. Unkeyed header, unlinked query, and cookie parameter discovery. |
| 11 | **Attack Surface Knowledge Graph** | `sentinel_knowledge` (SUB-10) | `AttackGraphWorkspaceView.tsx` (141 lines, 7KB) | Daily | High | Sprawling | Visual graph separated from technology stack context and surface coverage metrics; difficult to filter. | **MERGE & ENHANCE** | **Primary Workspace: Target Intelligence (`Alt+3`) [Knowledge Graph]**. SQLite recursive CTE graph (`Asset -> Endpoint -> Parameter -> Finding`) with clustering and choke-point analysis. |
| 12 | **Surface Coverage Heatmap** | `sentinel_coverage` (SUB-11) | Embedded in `AttackGraphWorkspaceView.tsx` | Periodic | Medium | Moderate | Buried in submenus; lacked clear visual contrast between tested vs untested surface nodes. | **MERGE** | **Primary Workspace: Target Intelligence (`Alt+3`) [Coverage Overlay]**. Real-time coverage overlay highlighting unprobed endpoints and high-risk attack surfaces. |
| 13 | **Context Engine & Tech Fingerprinting** | `sentinel_context` (SUB-09) | Embedded in `ActivityBar` / `Sidebar` | Daily | High | Minimal | Fingerprint heuristics not surfaced alongside active request editors. | **MERGE & CONTEXTUALIZE** | **Contextual Inspector (Right Panel) + Target Intelligence**. Automatic detection of web server, frameworks, WAF signatures, and parameter semantic roles. |
| 14 | **Identity Vault & Credentials** | `sentinel_auth` (SUB-12) | `IdentityVaultWorkspaceView.tsx` (253 lines, 10KB) | Frequent | Critical | Moderate | Credential vault separated from JWT analysis and authorization matrix; manual token copying required. | **MERGE & RENAME** | **Primary Workspace: Security Engines (`Alt+4`) [Identity Vault Subtab]**. Zeroized memory keychain (`SEC-09`), auto-session renewal, and secret reference tokens. |
| 15 | **JWT Manipulation Workbench** | `sentinel_auth` (SUB-12) | `JwtWorkspaceView.tsx` (281 lines, 11KB) | Frequent | High | Sprawling | Standalone screen forced leaving editor; required manual token extraction and re-insertion into headers. | **CONTEXTUALIZE & MERGE** | **Universal Contextual Inspector (JWT Tab) + Identity Vault**. Auto-detects JWT in headers/cookies; 1-click `alg: none`, HMAC/RSA confusion, and claim tampering. |
| 16 | **Access Control & AuthZ Matrix (IRA+)** | `sentinel_authz` (SUB-16) | `AuthzMatrixWorkspaceView.tsx` (236 lines, 9.5KB) | Frequent | Critical | Complex | Disconnected from Identity Vault; non-standard acronym ("IRA+") caused user confusion. | **RENAME & MERGE** | **Primary Workspace: Security Engines (`Alt+4`) [AuthZ Matrix Subtab]**. Multi-principal BOLA (API1:2023), IDOR, and BFLA (API5:2023) differential matrix replay engine. |
| 17 | **API Security & Schema Engine** | `sentinel_api` (SUB-17) | `ApiSecurityWorkspaceView.tsx` (188 lines, 8.6KB) | Frequent | High | Complex | OpenAPI, GraphQL, and WebSockets were treated as separate tooling silos rather than a unified API surface. | **MERGE & KEEP** | **Primary Workspace: Security Engines (`Alt+4`) [API Security Subtab]**. OpenAPI 3.x visualizer, GraphQL depth/batching attack prober, and WebSocket continuous frame fuzzer. |
| 18 | **InQL GraphQL Explorer** | `sentinel_api` (SUB-17) | `InQLWorkspaceView.tsx` (145 lines, 5.2KB) | Frequent | High | Moderate | Standalone workspace redundant with API Security module; duplicated schema introspection controls. | **REPLACE & MERGE** | **Merged into Security Engines (`Alt+4`) [API -> GraphQL InQL]**. Replaced with native Rust AST GraphQL parser, introspection reconstruction, and batching attack runner. |
| 19 | **Browser Automation Daemon** | `sentinel_browser` (SUB-18) | `BrowserWorkspaceView.tsx` (161 lines, 7.3KB) | Periodic | High | Complex | Full-screen view underutilized during automated runs; raw Playwright logs cluttered the main canvas. | **CONTEXTUALIZE** | **Background Service + Contextual DOM Viewer + Findings Evidence**. Headless Chromium runs in background; DOM taint callstacks and CAS screenshots link to findings. |
| 20 | **OAST Server & Callback Correlator** | `sentinel_oast` (SUB-19) | `OastWorkspaceView.tsx` (226 lines, 8.8KB) | Frequent | Critical | Complex | Dedicated full-screen tab wasted space; tester had to switch views to copy interaction tokens and check logs. | **CONTEXTUALIZE & DRAWER** | **Universal Bottom Drawer (`Ctrl+J`) [OAST Tab] + 1-Click Token Dispenser**. 1-click token injection (`Ctrl+Alt+O`); real-time DNS/HTTP/SMTP callback notifications. |
| 21 | **Findings Center & Triage** | `sentinel_verification` (SUB-15), `sentinel_report` (SUB-21) | `FindingsWorkspaceView.tsx` (213 lines, 8.9KB) | Daily (Continuous) | Critical | Complex | Vulnerability triage separated from pentester notebook and bookmarked requests; evidence hashes hard to verify. | **KEEP & ENHANCE** | **Primary Workspace: Findings Center (`Alt+5`)**. Central triage workbench, 5-tier verification proof inspector, CVSS v3.1/v4.0 calculator, and CAS proof linking (`SEC-06`). |
| 22 | **Pentester Markdown Notebook** | `sentinel_report` (SUB-21) | `NotebookWorkspaceView.tsx` (159 lines, 6.5KB) | Daily | High | Moderate | Markdown editor was isolated in separate tab; tester could not take notes while viewing findings or traffic. | **MERGE & DOCK** | **Dockable Right Panel + Findings Center Subtab**. Global scratchpad accessible via `Alt+N`, supporting 1-click embedding of CAS hashes and request PoCs. |
| 23 | **Organizer (Bookmarked Items)** | `sentinel_report` (SUB-21) | `OrganizerWorkspaceView.tsx` (206 lines, 8.6KB) | Frequent | Medium | Sprawling | Redundant bookmarking screen; duplicated triage states available in Findings Center and Traffic stars. | **DEPRECATE STANDALONE & MERGE** | **Merged into Traffic "Starred" & Findings "Triage Queue"**. Deprecated as standalone screen. Starred items appear directly in Traffic filters and Findings triage queue. |
| 24 | **Reports & Executive Export** | `sentinel_report` (SUB-21) | `ReportingWorkspaceView.tsx` (103 lines, 4.4KB) | Periodic | High | Moderate | Report generation separated from automated regression retesting; retests required manual Repeater reruns. | **MERGE & RENAME** | **Primary Workspace: Reports & Retest (`Alt+6`) [Reports Subtab]**. 1-click report export (Executive PDF, Technical Markdown, HTML, SARIF 2.1, JSON). |
| 25 | **Security Regression Graph & Retest** | `sentinel_verification` (SUB-15), `sentinel_knowledge` (SUB-10) | Embedded in `sentinel_verification` | Periodic | High | Complex | Retesting was manual and lacked automated state machine tracking (`VULNERABLE -> FIXED -> REGRESSED`). | **MERGE** | **Primary Workspace: Reports & Retest (`Alt+6`) [Retest Subtab]**. Automated 1-click regression test runner replaying exact CAS attack vectors. |
| 26 | **Decoder Workbench** | `sentinel_common` (SUB-01), `sentinel_productivity` (SUB-22) | `DecoderWorkspaceView.tsx` (181 lines, 7.5KB) | Daily (Continuous) | High | Sprawling | Full-screen tab forced complete workspace switch just to decode a Base64 string or URL parameter. | **CONTEXTUALIZE** | **Universal Transform Inspector (`Ctrl+E`) & Context Menu**. Popover modal and Right Inspector tab for multi-stage encodings (URL, Base64, Hex, HTML, Hashes). |
| 27 | **Hackvertor Dynamic Tag Transforms** | `sentinel_fuzzer` (SUB-14), `sentinel_productivity` (SUB-22) | `HackvertorWorkspaceView.tsx` (212 lines, 8.8KB) | Daily (Continuous) | High | Complex | Tag-based encoding engine trapped in standalone view; difficult to apply directly into Repeater/Fuzzer payloads. | **REPLACE & CONTEXTUALIZE** | **Inline Tag Evaluator in Editors + Transform Modal (`Ctrl+E`)**. Directly parses nested tags (`<@base64_encode>payload<@/base64_encode>`) inside request editors. |
| 28 | **Comparer Diff Workbench** | `sentinel_repeater` (SUB-08) | `ComparerWorkspaceView.tsx` (96 lines, 4KB) | Daily (Continuous) | High | Minimal | Standalone screen forced manual copy-paste of text blocks; disconnected from live transactions. | **REPLACE & CONTEXTUALIZE** | **Universal Split Diff Modal (`Ctrl+D`) & Inspector Panel**. 1-click side-by-side and inline LCS diff across any two transactions or Repeater responses. |
| 29 | **Sequencer (Token Entropy)** | `sentinel_auth` (SUB-12), `sentinel_verification` (SUB-15) | `SequencerWorkspaceView.tsx` (220 lines, 10KB) | Niche | Medium | Moderate | Full-screen tab rarely used continuously; required manual URL and cookie configuration. | **CONTEXTUALIZE** | **Contextual Entropy Modal & Right Inspector Action**. Right-click any cookie/token in Traffic/Repeater -> *"Analyze Entropy"*; executes FIPS 140-2 test suite. |
| 30 | **Logger (Multi-Tool Stream)** | `sentinel_proxy` (SUB-06), `sentinel_bus` (SUB-03) | `LoggerWorkspaceView.tsx` (235 lines, 9.5KB) | Daily | Medium | Complex | Duplicated the Traffic History table; caused confusion regarding where live proxy traffic lived. | **DEPRECATE STANDALONE & MERGE** | **Merged into Traffic Hub (Filter: `origin:*`) & Bottom Drawer Event Log**. Deprecated as standalone screen. |
| 31 | **Extensions & WASM Plugins** | `sentinel_plugin` (SUB-23) | `ExtensionsWorkspaceView.tsx` (290 lines, 11KB) | Periodic | Medium | Sprawling | Standalone tab cluttered the primary navigation bar; plugin execution is inherently background-driven. | **CONTEXTUALIZE & MERGE** | **Settings Modal (`Ctrl+,`) [Plugins & Research Packs]**. Manages signed WASM plugins (`SEC-04`) and Research Pack rule updates. |
| 32 | **Platform Settings & Diagnostics** | `sentinel_enterprise` (SUB-27), `sentinel_storage` (SUB-02) | `SettingsWorkspaceView.tsx` (111 lines, 5.8KB) | Periodic | High | Moderate | Needed clear system health indicators, IPC latency meters, Root CA export, and storage management. | **KEEP & MODAL** | **Settings & System Health (`Ctrl+,`)**. Proxy listening port, Root CA download, SQLite WAL maintenance, memory scrubber, zero-leak audit logs. |
| 33 | **Dev Placeholder Workspace** | N/A | `PlaceholderWorkspace.tsx` (64 lines, 3KB) | Redundant | Low | Minimal | Dev artifact. | **DEPRECATE** | **Removed completely** from navigation and build bundle. |

---

## 3. Deep Analysis of UI Friction, Sprawl & Cognitive Load

### 3.1 The 7 Critical Cognitive Friction Points in Legacy Web Proxy UI
The investigation revealed that traditional 1990s web proxy desktop architectures (Burp Suite, ZAP) suffer from severe structural anti-patterns when scaled to modern high-speed testing:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             LEGACY 28-SCREEN DISCONNECTED SPRAWL                                │
│                                                                                                  │
│ [Scope] [Traffic] [Repeater] [Scanner] [Fuzzer] [Identity] [Authz] [APIs] [Browser] [OAST] ...   │
│ Hidden: [JWT] [Decoder] [Hackvertor] [Comparer] [Turbo] [ParamMiner] [Sequencer] [Logger] ...   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CRITICAL COGNITIVE FRICTIONS                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Context Abandonment: Encoding/decoding forces leaving active request editor.                  │
│ 2. Screen Sprawl: 28 tabs overwhelm navigation; 13 tabs are unreachable from primary sidebar.    │
│ 3. State Splintering: Findings in Findings, bookmarks in Organizer, notes in Notebook.           │
│ 4. Tool Duplication: Turbo Intruder, Discover Content, and Fuzzer duplicate mutation jobs.      │
│ 5. Stream Duplication: Logger and Traffic display identical transaction streams.                 │
│ 6. GraphQL Redundancy: InQL and API Security provide duplicate GraphQL introspection tooling.     │
│ 7. Diff Disconnection: Comparer requires manual copy-pasting of text snippets.                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Friction Point 1: Context Abandonment During Payload Encoding/Decoding
- **Observed Behavior**: In `DecoderWorkspaceView` and `HackvertorWorkspaceView`, transforming a string (e.g., Base64-encoding a serialized JSON object, or applying `<@hex_encode>`) requires 6 discrete steps: (1) Copy selection in Repeater, (2) Press `Ctrl+K` or click Decoder tab, (3) Paste string into input textarea, (4) Select transformation chain, (5) Copy output string, (6) Switch back to Repeater and paste over selection.
- **Cognitive Impact**: Complete loss of editor focus, cursor position reset, and mental disruption of the vulnerability hypothesis.
- **Architectural Solution**: **Universal Contextual Transform (`Ctrl+E`)**. Text highlighted in any editor or table triggers an inline popover or updates the Right Inspector instantly. Transformations apply directly in place with zero screen switching.

#### Friction Point 2: Disconnected Diff Tooling
- **Observed Behavior**: `ComparerWorkspaceView` presents two empty text areas. Pentesters must manually copy response A from Traffic, paste into Box 1, switch to Repeater, copy response B, paste into Box 2, and click "Compare".
- **Cognitive Impact**: Tedious manual mechanics; impossible to perform rapid visual comparisons across multiple fuzzing iterations.
- **Architectural Solution**: **Universal Split Diff (`Ctrl+D`)**. Pentesters select any two transactions in Traffic Hub or click "Diff Baseline" in the Manual Testing Lab. A live chunked Longest Common Subsequence (LCS) diff renders side-by-side or inline with token-level highlighting in `<5ms`.

#### Friction Point 3: Dual Stream Duplication (Traffic vs Logger)
- **Observed Behavior**: `LoggerWorkspaceView` was created to show transactions across all tools (Proxy, Scanner, Repeater, Intruder), while `TrafficWorkspaceView` showed proxy transactions. Pentesters frequently had to switch between both screens to see what the Scanner or Fuzzer dispatched.
- **Cognitive Impact**: Fragmented event monitoring; confusion over where transactions are stored.
- **Architectural Solution**: **Unified Traffic Hub with Origin Filter Chips**. All transactions stream into `TrafficWorkspaceView`. The top bar provides 1-click filter chips: `[All]`, `[Proxy]`, `[Repeater]`, `[Fuzzer]`, `[Scanner]`, `[API Security]`. HTTPQL compiler natively supports `origin:repeater` or `origin:fuzzer`.

#### Friction Point 4: Mutation Fuzzing & High-Speed Attack Splintering
- **Observed Behavior**: Four independent screens handled mutation and brute forcing: `FuzzerWorkspaceView` (Intruder), `TurboIntruderWorkspaceView` (Python script socket fuzzer), `DiscoverWorkspaceView` (Directory brute force), and `SequencerWorkspaceView` (Token entropy).
- **Cognitive Impact**: Pentesters had to reconfigure headers, cookies, and target URLs across four separate workspaces.
- **Architectural Solution**: **Consolidated Manual Testing Lab & Target Intelligence**. Fuzzer, Turbo async pipelining, and Single-Packet Race conditions merge into the **Manual Testing Lab (`Alt+2`)**, while Directory and Parameter discovery merge into **Target Intelligence (`Alt+3`)**.

#### Friction Point 5: Identity, JWT & Authorization Matrix Disconnection
- **Observed Behavior**: Managing credentials occurred in `IdentityVaultWorkspaceView`, editing JWT tokens in `JwtWorkspaceView`, and testing IDOR/BOLA in `AuthzMatrixWorkspaceView`.
- **Cognitive Impact**: Cross-tenant testing required bouncing across 3 separate workspaces.
- **Architectural Solution**: **Consolidated Security Engines (`Alt+4`) [Identity & AuthZ Subtabs]**. The Identity Vault, JWT workbench, and Multi-Principal Matrix share unified state. Changing a JWT in the Identity Vault immediately updates the Authorization Matrix test runners.

#### Friction Point 6: GraphQL Tooling Redundancy
- **Observed Behavior**: `ApiSecurityWorkspaceView` contained REST/GraphQL/WebSocket tools, while `InQLWorkspaceView` duplicated GraphQL schema introspection and AST queries.
- **Cognitive Impact**: Redundant codebase maintenance and fragmented user experience.
- **Architectural Solution**: **Single GraphQL Security Engine inside Security Engines (`Alt+4`)**. Complete schema AST parser, depth/batching attack engine, and query generator consolidated into a single high-power subtab.

#### Friction Point 7: Triage and Record Keeping Fragmentation
- **Observed Behavior**: Verified vulnerabilities lived in `FindingsWorkspaceView`, bookmarked requests in `OrganizerWorkspaceView`, and notes in `NotebookWorkspaceView`.
- **Cognitive Impact**: Pentesters had to synchronize notes and bookmarks across 3 isolated screens during report compilation.
- **Architectural Solution**: **Consolidated Findings Center & Dockable Notebook (`Alt+5`)**. Bookmarks become "Starred Triage" items in Traffic and Findings. The Pentester Notebook is accessible as a split pane inside Findings Center or as a global slide-out drawer (`Alt+N`).

---

## 4. Telemetry Overhead & Event Backpressure Optimization

### 4.1 Dual-Channel Event Bus Architecture (`sentinel_bus`)
Under active scanning or high-speed fuzzing (10,000+ RPS), UI rendering can choke if every telemetry event triggers a React state update. The audit confirms the necessity of the frozen `sentinel_bus` dual-channel design:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SENTINEL HIGH-THROUGHPUT BUS                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [Proxy / Fuzzer / Scanner]                                                                      │
│             │                                                                                    │
│             ├───► Channel 1: Telemetry Broadcast (Ring Buffer: 50,000 events)                     │
│             │     • High-frequency scan progress, byte counters, live RPS                        │
│             │     • Lossy under extreme pressure (drops oldest progress frames)                  │
│             │     • Throttled to 60 FPS UI dispatch (16.67ms batching)                           │
│             │                                                                                    │
│             └───► Channel 2: Critical Delivery Queue (Lossless Bounded: 10,000 events)           │
│                   • Confirmed findings, verification proofs, scope denial audits (`SEC-12`)      │
│                   • Zero-drop guarantee with backpressure pause                                  │
│                   • Direct persistence to SQLite WAL (`SEC-17`) and UI alert banners            │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 UI Virtualization & Memory Hardening Invariants
To maintain `<50ms` interactive latency and zero UI freezing across 1,000,000 transaction datasets:
1. **DOM Viewport Culling**: The Traffic Table, Findings Grid, and Attack Graph maintain a fixed DOM footprint equal to visible viewport rows plus an overscan buffer (maximum 60 DOM table rows).
2. **Chunked LCS Diffing**: Response diff calculations on large bodies (up to 100MB) execute on dedicated background Web Workers with immediate cancellation of obsolete diff jobs.
3. **Memory Zeroization (`SEC-09`)**: Credentials, tokens, and raw secrets stored in `IdentityVault` are scrubbed with `zeroize` on deletion and never rendered in plain text in log streams or diagnostics without explicit user unlock.

---

## 5. Master Rationalization Summary Table

| Legacy Screen Count | Consolidated Hub Count | Primary Navigation Hotkeys | Primary Contextual Overlays | Primary Console Drawers | Primary Reduction in Visual Sprawl |
|---|---|---|---|---|---|
| **28 Workspaces** | **7 Primary Workspaces** | `Alt+S`, `Alt+1` .. `Alt+6`, `Ctrl+,` | `Ctrl+E` (Transform), `Ctrl+D` (Diff), Sequencer Modal | `Ctrl+J` (Bottom Drawer: OAST, Events, Tasks, IPC) | **75% Reduction (28 -> 7)** |

---

## 6. Verification & Invalidation Criteria

### 6.1 Verification Commands
1. **Backend Subsystem Verification**:
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   cargo test --workspace --locked
   ```
   *Pass Criterion*: 245/245 unit and integration tests pass cleanly with 0 errors.
2. **Canonical Spec Verification**:
   ```powershell
   python architecture\v6\validate_v6_spec.py
   ```
   *Pass Criterion*: `BLOCKERS = 0, WARNINGS = 0`.
3. **Frontend Component Tree Verification**:
   ```powershell
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec"
   npm test
   ```
   *Pass Criterion*: Vitest test suites pass with 100% assertions.

### 6.2 Invalidation Conditions
This audit shall be deemed invalid if:
1. Any backend crate capability is deleted or rendered unreachable via the consolidated interface.
2. Any security invariant (`SEC-01` through `SEC-17`) is bypassed.
3. Contextual overlays introduce modal focus traps that cannot be exited via `Escape`.

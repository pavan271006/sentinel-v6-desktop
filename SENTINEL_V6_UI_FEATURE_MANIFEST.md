# SENTINEL V6 — DEFINITIVE UI FEATURE MANIFEST & TAURI SHELL SPECIFICATION

> **Platform Version**: `6.0.0` (FROZEN ARCHITECTURE)  
> **UI Phase Milestone**: Phase UI-0 (Repository & Capability Audit, Feature Manifest)  
> **Authoritative Root**: `c:\Users\Legion 5 pro\Desktop\cyber sec`  
> **Backend Codebase**: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core` (28 Crates, 100% Pass)  
> **Status**: 🟢 **AUTHORITATIVE & READY FOR SEQUENTIAL IMPLEMENTATION**

---

## 1. Executive Summary & Zero Fake UI Directives

The **SENTINEL V6 Desktop Application** is an enterprise-grade, keyboard-first, high-density penetration testing and web application security platform built with **Tauri + Rust + React + TypeScript + Tailwind CSS / Modern CSS**. It interfaces directly with the verified, frozen `sentinel_core` 28-crate Rust backend.

### The Backend Truth & Zero Fake UI Law
1. **Zero Simulation**: No button, progress bar, chart, or indicator shall display hardcoded, simulated, or randomized mockup data. Every pixel reflects verified backend truth.
2. **Deterministic Capability Availability**: Every UI component maps to one of five discrete states:
   - `BACKEND_IMPLEMENTED`: Fully operational, backed by verified Rust crate and SQLite/CAS persistence.
   - `BACKEND_PARTIAL`: Operational for specific sub-actions; missing sub-paths explicitly disabled with tooltip explanation.
   - `BACKEND_EXPERIMENTAL`: Functional behind an explicit user opt-in toggle in Settings.
   - `BACKEND_DEFERRED`: Feature-flagged out (e.g. Research Tier Z3/RL); UI surfaces a read-only informational card explaining deferred status.
   - `BACKEND_UNAVAILABLE`: Prerequisites not met (e.g. OAST server not listening, proxy not started, no project opened); control is visibly disabled with clear resolution guidance.
3. **Fail-Closed UI Actions**: Destructive actions (Active Scan, Fuzzer Mutation, Exploitation Replay, Agent Tool Execution) require explicit Scope validation (`SEC-01`), Policy Gate clearance (`SEC-03`), and confirmation modal dialogs.

---

## 2. Desktop Technology Stack & Architecture

```
+---------------------------------------------------------------------------------------+
|                               TAURI DESKTOP APPLICATION                               |
+---------------------------------------------------------------------------------------+
|  FRONTEND LAYER (Webview2 / WebKit / Chromium Sandbox - SEC-11)                       |
|  - Framework: React 18 / 19 + TypeScript (Strict Type Checking)                       |
|  - Bundler & Dev Server: Vite                                                         |
|  - State Management: Zustand (Domain Stores) + TanStack Virtual (1M Row Tables)       |
|  - Editors & Viewers: Monaco Editor / CodeMirror 6 (Hex View, Raw HTTP, Syntax Diff)  |
|  - Visualization: React Flow / Cytoscape (Attack Graph) + Canvas2D / WebGL Sparklines  |
|  - Styling & Design Tokens: Tailwind CSS + CSS Custom Properties (Dark Pentester Theme)|
|  - Icons & Typography: Lucide React + JetBrains Mono / Inter                          |
+-------------------------------------------+-------------------------------------------+
                                            |  Tauri IPC (Protobuf / JSON-RPC Bridge)
                                            v
+---------------------------------------------------------------------------------------+
|  TAURI RUST CORE BRIDGE (`src-tauri` / `sentinel_desktop`)                            |
|  - Command Handlers: `#[tauri::command]` translating UI requests to Core domain calls  |
|  - Event Emitter: Async background streaming of `UiTrafficEvent`, `UiFindingEvent`     |
|  - Lossless Bounded Buffers: Backpressure handling (`SEC-12`) via circular ring buffer|
|  - Secure Keychain: OS Secret Service / DPAPI integration (`SEC-09`)                  |
+-------------------------------------------+-------------------------------------------+
                                            |  Rust Crate In-Process Function Calls
                                            v
+---------------------------------------------------------------------------------------+
|  SENTINEL CORE ENGINE (28 Workspace Crates)                                           |
|  - Proxy & Parser: `sentinel_proxy`, `sentinel_parser`, `sentinel_httpql`             |
|  - Testing & Attack: `sentinel_repeater`, `sentinel_fuzzer`, `sentinel_scanner`       |
|  - Verification & Findings: `sentinel_verification`, `sentinel_report`               |
|  - Knowledge & Surface: `sentinel_knowledge`, `sentinel_coverage`, `sentinel_context` |
|  - Identity & Security: `sentinel_auth`, `sentinel_authz`, `sentinel_scope` (SEC-01)   |
|  - Extensions & AI: `sentinel_browser`, `sentinel_oast`, `sentinel_ai`, `sentinel_agent`|
|  - Enterprise & Storage: `sentinel_enterprise`, `sentinel_storage` (SQLite + CAS)     |
+---------------------------------------------------------------------------------------+
```

---

## 3. Design System, Tokens & High-Contrast Theming

The design system is engineered specifically for dense security data analysis during long penetration testing engagements.

### 3.1 Color Palette Tokens

```css
:root {
  /* Surface & Background (Midnight Charcoal - Dark Pentester Theme) */
  --bg-app: #0d1117;
  --bg-panel: #161b22;
  --bg-panel-elevated: #21262d;
  --bg-panel-hover: #30363d;
  --bg-input: #090d12;
  --border-subtle: #30363d;
  --border-strong: #484f58;
  --border-focus: #58a6ff;

  /* Typography & Foreground */
  --text-primary: #f0f6fc;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --text-inverse: #0d1117;

  /* Accent & Interaction Tokens */
  --accent-cyan: #38bdf8;
  --accent-blue: #58a6ff;
  --accent-purple: #bc8cff;

  /* Severity Tokens (Pentester High-Contrast Standard) */
  --severity-critical: #f85149;      /* Crimson Red */
  --severity-critical-bg: #490202;
  --severity-high: #ff7b72;          /* Vivid Coral */
  --severity-high-bg: #5a1e02;
  --severity-medium: #d29922;        /* Golden Amber */
  --severity-medium-bg: #3e2b04;
  --severity-low: #3fb950;           /* Emerald Green */
  --severity-low-bg: #092e10;
  --severity-info: #58a6ff;          /* Sky Blue */
  --severity-info-bg: #082846;

  /* HTTP Method Badges */
  --method-get: #3fb950;
  --method-post: #d29922;
  --method-put: #58a6ff;
  --method-delete: #f85149;
  --method-patch: #bc8cff;
  --method-options: #8b949e;
  --method-graphql: #ec4899;
  --method-websocket: #a855f7;

  /* Status Code Classes */
  --status-2xx: #3fb950;
  --status-3xx: #58a6ff;
  --status-4xx: #d29922;
  --status-5xx: #f85149;

  /* Diff Tokens */
  --diff-add-bg: #033a16;
  --diff-add-text: #7ee787;
  --diff-remove-bg: #4a0c0e;
  --diff-remove-text: #ffa198;
}

[data-theme="light"] {
  /* High-Contrast Pentester Light Theme */
  --bg-app: #f6f8fa;
  --bg-panel: #ffffff;
  --bg-panel-elevated: #eaeef2;
  --bg-panel-hover: #d0d7de;
  --bg-input: #ffffff;
  --border-subtle: #d0d7de;
  --border-strong: #8c959f;
  --border-focus: #0969da;

  --text-primary: #1f2328;
  --text-secondary: #57606a;
  --text-muted: #6e7781;
  --text-inverse: #ffffff;

  --accent-cyan: #0284c7;
  --accent-blue: #0969da;
  --accent-purple: #8250df;

  --severity-critical: #cf222e;
  --severity-critical-bg: #ffebe9;
  --severity-high: #bc4c00;
  --severity-high-bg: #fff1e5;
  --severity-medium: #9a6700;
  --severity-medium-bg: #fff8c5;
  --severity-low: #1a7f37;
  --severity-low-bg: #dafbe1;
  --severity-info: #0969da;
  --severity-info-bg: #ddf4ff;
}
```

### 3.2 Typography & Spacing Scale
- **Display Monospace**: `JetBrains Mono`, `Fira Code`, `Consolas`, monospace (used for Raw HTTP, Hex bytes, HTTPQL expressions, ASTs, Tokens, and IDs).
- **Interface UI Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.
- **Density Scale**:
  - `compact`: Line height `1.2`, font size `11px` / `12px`, padding `2px 6px` (Default for Traffic History, Diff, and Hex).
  - `standard`: Line height `1.4`, font size `13px` / `14px`, padding `6px 12px` (Settings, Notebook, Finding Triage).
  - `comfortable`: Line height `1.5`, font size `15px`, padding `10px 16px` (Executive Reports).

---

## 4. Application Shell & Multi-Pane Layout Engine

The application shell provides a rigid, high-performance 5-region layout with persistent splitter states and keyboard pane focus.

```
+------------------------------------------------------------------------------------------------------+
| [1] TOP BAR: App Logo | Project Selector | Scope Status Badge | Proxy Port (8080) | OmniSearch (Ctrl+K) | Help | Settings |
+------------------------------------------------------------------------------------------------------+
| [2] LEFT RAIL  | [3] CENTER WORKSPACE AREA                                         | [4] RIGHT INSPECTOR     |
| - Traffic (1)  | +---------------------------------------------------------------+ | (Context Sensitive)     |
| - Repeater (2) | | [Tab Bar: Reopen Closed Tab (Ctrl+Shift+T), New Tab (Ctrl+T)]  | | - Request / Response    |
| - Scanner (3)  | +---------------------------------------------------------------+ | - Hex / Raw / Parsed    |
| - Fuzzer (4)   | |                                                               | | - Headers Table         |
| - Auth & IRA(5)| |                                                               | | - Scope Decision (SEC1)|
| - API & OAST(6)| |                   ACTIVE WORKSPACE VIEW                       | | - Tech Context Stack    |
| - Findings (7) | |                                                               | | - Linked Evidence CAS   |
| - AttackMap (8)| |                                                               | | - Notes & Tags          |
| - Reports (9)  | |                                                               | |                         |
| - Settings (0) | +---------------------------------------------------------------+ |                         |
+------------------------------------------------------------------------------------------------------+
| [5] BOTTOM CONSOLE: Live Task Scheduler (SUB-06) | Event Bus Health (SUB-05) | Backpressure Monitor | Memory / CPU |
+------------------------------------------------------------------------------------------------------+
```

### 4.1 Shell Pane Specifications
1. **Top Bar**:
   - `ProjectSwitcher`: Displays active `.sentinel` project name, SQLite path, and "Save / Switch / New" dropdown.
   - `ScopePill`: Green (`Active: N rules`) or Red (`Fail-Closed: 0 rules`). Click opens Scope Inspector modal.
   - `ProxyToggle`: Switch for `127.0.0.1:8080` (Listening / Stopped). Intercept indicator icon.
   - `GlobalOmniSearchInput`: Click or `Ctrl+K` opens fuzzy command palette.
   - `ActiveIdentityBadge`: Shows current injected user (e.g. `Admin (tenant_1)`).
2. **Left Rail**:
   - Icon + Text rail with collapsible toggle (`Ctrl+B`).
   - Badge counts on Findings (Critical count), Tasks (Running count), Traffic (Total captured).
   - Hotkey numbers `1` through `0` with `Alt+<N>` quick switch.
3. **Center Workspace**:
   - Multi-tabbed document container with split view (Horizontal / Vertical split via `Ctrl+\`).
4. **Right Contextual Inspector**:
   - Collapsible panel (`Ctrl+]`). Synchronously reacts to the focused item in the center table.
5. **Bottom Console**:
   - Collapsible drawer (`Ctrl+\``). Tabs: `Background Tasks`, `Live Audit Log`, `SIEM Exporter`, `Engine Diagnostics`.

---

## 5. Global Keyboard Shortcuts & Vim-Like Navigation

The entire application can be navigated without touching the mouse, optimizing the critical loop for security researchers.

| Category | Shortcut | Action | Target / Context |
|---|---|---|---|
| **Global Navigation** | `Ctrl+K` / `Ctrl+P` | Open Omni-Search & Command Palette | Anywhere in App |
| | `Alt+1` .. `Alt+9` | Jump directly to Workspace 1..9 | Shell Navigation |
| | `Ctrl+B` | Toggle Left Navigation Rail | Shell Layout |
| | `Ctrl+]` | Toggle Right Contextual Inspector | Shell Layout |
| | `Ctrl+\`` | Toggle Bottom Task/Log Console | Shell Layout |
| | `Ctrl+Shift+D` | Toggle Dark / Light Theme | Shell Appearance |
| **Tab Management** | `Ctrl+T` | Open New Tab in Current Workspace | Center Workspace |
| | `Ctrl+W` | Close Active Tab | Center Workspace |
| | `Ctrl+Shift+T` | Reopen Last Closed Tab | Center Workspace |
| | `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / Previous Tab | Center Workspace |
| | `Ctrl+\` | Split Workspace Vertically / Horizontally | Center Workspace |
| **Traffic & Table Navigation** | `j` / `Down` | Move selection down one row | Virtualized Tables |
| | `k` / `Up` | Move selection up one row | Virtualized Tables |
| | `g g` / `Home` | Jump to first row | Virtualized Tables |
| | `G` / `End` | Jump to last row | Virtualized Tables |
| | `Space` | Toggle row selection / checkbox | Virtualized Tables |
| | `/` | Focus Table Filter / HTTPQL Bar | Virtualized Tables |
| | `x` | Delete selected item (with confirmation) | History / Tabs / Notes |
| **Manual Testing (Repeater)** | `Ctrl+R` | Send Selected Transaction to Repeater | Traffic / Inspector / Finding |
| | `Ctrl+Enter` | Send HTTP Request in Active Repeater Tab | Repeater Workspace |
| | `Ctrl+Z` / `Ctrl+Y` | Undo / Redo Request Mutation | Active Editor |
| | `Ctrl+H` | Toggle Hex / Raw / Parsed View | Inspector & Repeater |
| | `Ctrl+D` | Toggle Request/Response Diff View | Repeater Workspace |
| **Security Actions** | `Ctrl+Shift+S` | Send Target to Scanner Orchestrator | Traffic / Endpoint / Scope |
| | `Ctrl+Shift+F` | Send Target to Mutation Fuzzer | Traffic / Repeater |
| | `Ctrl+Shift+V` | Trigger Immediate Verification Proof | Finding Candidate |
| | `Ctrl+Shift+E` | Open Linked CAS Evidence Descriptor | Finding / Verification |
| | `Ctrl+Shift+I` | Toggle Proxy Interception Mode | Proxy Engine |
| | `Esc` | Close Modal / Clear Filter / Cancel Action | Dialogs & Overlays |

---

## 6. Complete 15-Phase UI Manifest (UI-0 to UI-14)

### Phase UI-0: Repository & Capability Audit
- **Objective**: Establish the definitive UI capability inventory, verify 28 Rust crates in `sentinel_core`, enforce Zero Fake UI rules, and deliver this manifest.
- **Views**:
  - `ManifestInspectorView`: Read-only metadata view of subsystem bindings, versions, and build status.
- **Tauri IPC Endpoints**: `cmd_audit_capabilities`, `cmd_get_platform_info`.
- **Quality Gates**: Spec validator passes 11/11, 0 clippy warnings, all 28 crates cataloged.

---

### Phase UI-1: Unified Design System & App Shell
- **Objective**: Implement tokens, theme switcher, responsive 5-pane resizable layout engine, Command Palette (`Ctrl+K`), and omni-search overlay.
- **Views & Components**:
  - `AppShell`: 5-pane CSS grid/flex layout with drag-splitter persistence (`SplitPane.tsx`).
  - `CommandPaletteModal`: Fuzzy search dispatcher (`CommandPalette.tsx`) bound to `sentinel_productivity`.
  - `OmniSearchOverlay`: Cross-entity search (`OmniSearch.tsx`) querying Endpoints, Findings, Transactions, and Notes.
  - `SeverityBadge`, `MethodBadge`, `StatusBadge`, `TlsLockBadge`, `ScopeStatusIndicator`.
  - `VirtualTableCore`: Base TanStack Virtual wrapper handling 100K+ rows with sticky headers and keyboard navigation.
  - `MonacoEditorWrapper` / `CodeMirrorViewer`: Syntax highlighting, line numbers, folding, read-only mode, search.
- **State Stores**: `useAppShellStore` (split sizes, active workspace, theme), `useCommandPaletteStore`.
- **Tauri IPC Endpoints**:
  - `cmd_productivity_execute_command`: Dispatches registered action ID.
  - `cmd_productivity_search`: Query omni-search engine with ranking.
- **Backend Capability**: `sentinel_productivity` (IMPLEMENTED).

---

### Phase UI-2: Project Lifecycle & Scope Engine
- **Objective**: Project creation/opening (`.sentinel` SQLite bundle), fail-closed scope rules manager (`SEC-01`), and visual DENY inspector.
- **Views & Components**:
  - `ProjectManagerModal`: New Project, Open `.sentinel` Directory, Export Project Archive, Recent Projects List.
  - `ScopeConfigurationWorkspace`:
    - `IncludeRulesTable`: Editable list of IP CIDRs, Host wildcards, Regex patterns.
    - `ExcludeRulesTable`: High-priority exclude patterns (e.g. `/logout`, `/admin/delete*`).
    - `ScopeTesterTool`: Live input field testing a URL against `sentinel_scope` with instant Allowed / Denied breakdown and reason.
  - `ScopeViolationAuditDrawer`: Real-time list of dropped out-of-scope requests with attempted target, timestamp, and rule match.
- **State Stores**: `useProjectStore`, `useScopeStore`.
- **Tauri IPC Endpoints**:
  - `cmd_project_new(path, name)` -> Result<ProjectMetadata>
  - `cmd_project_open(path)` -> Result<ProjectState>
  - `cmd_project_save()` -> Result<()>
  - `cmd_scope_get()` -> Result<Scope>
  - `cmd_scope_update(includes, excludes)` -> Result<Scope>
  - `cmd_scope_test_uri(uri)` -> Result<ScopeDecision>
  - `stream_scope_violations` (Event: `UiScopeViolationEvent`)
- **Backend Capability**: `sentinel_scope`, `sentinel_storage` (IMPLEMENTED).

---

### Phase UI-3: Traffic, History, HTTPQL, Inspector & Diff
- **Objective**: High-throughput virtualized proxy history (1M transaction stability), streaming Protobuf events, full HTTPQL query bar, raw/hex/parsed inspector, and response diffing.
- **Views & Components**:
  - `TrafficWorkspace`:
    - `HttpqlQueryBar`: Auto-completing search input with grammar validation (`sentinel_httpql`), syntax error popover, and query history dropdown.
    - `VirtualTrafficTable`: 100K-1M row virtualized table displaying ID, Method, URI, Status, Length, Duration, In-Scope, TLS, Tags, and Timestamp.
    - `TrafficQuickFilters`: Toggle pills for Scope Only, Errors (4xx/5xx), Methods (GET/POST/etc.), MIME Types (JSON/HTML/Binary).
  - `TransactionInspectorPanel`:
    - `RequestViewer` / `ResponseViewer`: Tabs for `Parsed Headers`, `Raw Bytes`, `Hex Dump`, `Decoded Body` (JSON formatting, HTML sandbox preview).
    - `TlsDetailsCard`: Cipher suite, ALPN, TLS version, certificate SANs.
    - `ScopeAuditBadge`: Visual proof of `SEC-01` decision.
  - `TransactionDiffModal`: Side-by-side / inline diff comparing two transactions with structural similarity score, bytes added/removed.
- **State Stores**: `useTrafficStore` (circular ring buffer + SQLite pagination), `useInspectorStore`.
- **Tauri IPC Endpoints**:
  - `cmd_traffic_get_page(filter_sql, offset, limit)` -> Result<Vec<TransactionSummary>>
  - `cmd_traffic_get_details(transaction_id)` -> Result<TransactionDetails>
  - `cmd_traffic_get_raw_blob(blob_id)` -> Result<Vec<u8>>
  - `cmd_traffic_clear()` -> Result<()>
  - `cmd_httpql_validate(query)` -> Result<HttpqlValidationResult>
  - `cmd_traffic_diff(tx_id_a, tx_id_b)` -> Result<ResponseDiffResult>
  - `stream_traffic_events` (Event: `UiTrafficEvent`)
- **Backend Capability**: `sentinel_proxy`, `sentinel_parser`, `sentinel_storage`, `sentinel_httpql` (IMPLEMENTED).

---

### Phase UI-4: Repeater Manual Testing Workspace
- **Objective**: Multi-tab manual request crafting, raw byte editing, dynamic variable interpolation (`{{token}}`), revision history, and side-by-side diff against baseline.
- **Views & Components**:
  - `RepeaterWorkspace`:
    - `TabContainer`: Movable, renameable tabs with method badges and dirty indicators.
    - `RequestEditorPane`: Raw HTTP text editor with autocomplete for headers and variables.
    - `VariableManagerDrawer`: Environment variables (`{{host}}`, `{{bearer_token}}`, `{{auth_cookie}}`).
    - `SendButton` (with `Ctrl+Enter` shortcut, loading spinner, and cancel button).
    - `RevisionHistorySlider`: Step backwards/forwards through request mutations and re-evaluate responses.
    - `ResponseDiffToggle`: Compare current response with baseline revision.
- **State Stores**: `useRepeaterStore` (tabs, active tab, revisions, environment variables).
- **Tauri IPC Endpoints**:
  - `cmd_repeater_create_tab(seed_transaction_id?)` -> Result<RepeaterTab>
  - `cmd_repeater_execute(tab_id, raw_request, env_vars)` -> Result<ExecutionOutput>
  - `cmd_repeater_get_revisions(tab_id)` -> Result<Vec<RepeaterRevision>>
  - `cmd_repeater_diff_revisions(tab_id, rev_a, rev_b)` -> Result<ResponseDiffResult>
- **Backend Capability**: `sentinel_repeater`, `sentinel_parser`, `sentinel_scope` (IMPLEMENTED).

---

### Phase UI-5: Scanner & Mutation Fuzzer
- **Objective**: Configure and monitor active/passive scans, task concurrency budgets, multi-algorithm mutation fuzzing with live payload minimization (Delta Debugging).
- **Views & Components**:
  - `ScannerWorkspace`:
    - `ScanConfigDialog`: Target selection, Scope validation, Concurrency limit (1-50), Active check selector (SQLi, XSS, SSRF, Headers, Traversal), Rate limit (RPS).
    - `ScanProgressDashboard`: Phase indicator (Crawl -> Passive -> Active -> Verification), % Complete, Requests Sent, Errors Encountered, Findings Discovered.
    - `ScanTaskControl`: Pause, Resume, Stop buttons. Checkpoint indicator (`SUB-06`).
  - `FuzzerWorkspace`:
    - `PayloadGeneratorConfig`: Mutator algorithm selector (BitFlip, ByteReplace, Radamsa, Boundary, UnicodeNormalization, FormatString, Grammar).
    - `InsertionPointMarker`: Visual highlighting of request parameters (`§id§`).
    - `FuzzLiveResultsTable`: Real-time stream of mutated payloads, response codes, response lengths, anomaly flags.
    - `PayloadMinimizerView`: Automated `ddmin` reduction view showing baseline failure vs minimized reproduction payload.
- **State Stores**: `useScannerStore`, `useFuzzerStore`.
- **Tauri IPC Endpoints**:
  - `cmd_scanner_start(config)` -> Result<Uuid>
  - `cmd_scanner_pause(scan_id)` -> Result<()>
  - `cmd_scanner_resume(scan_id)` -> Result<()>
  - `cmd_scanner_stop(scan_id)` -> Result<()>
  - `cmd_scanner_get_status(scan_id)` -> Result<ScanStatus>
  - `cmd_fuzzer_start(config)` -> Result<Uuid>
  - `cmd_fuzzer_minimize(payload, test_oracle)` -> Result<MinimizedPayloadResult>
  - `stream_scan_progress` (Event: `UiScanProgressEvent`), `stream_task_status` (Event: `UiTaskStatusEvent`)
- **Backend Capability**: `sentinel_scanner`, `sentinel_fuzzer`, `sentinel_common` (IMPLEMENTED).

---

### Phase UI-6: Identity Vault & Authorization Matrix
- **Objective**: Zero-plaintext credential management (`SEC-09`), multi-identity session switching, and combinatorial Authorization Matrix (BOLA / IDOR / BFLA evaluator).
- **Views & Components**:
  - `IdentityVaultWorkspace`:
    - `IdentityList`: Identities (Admin, User A, User B, Anonymous, Tenant 1, Tenant 2) with masked secrets (`SecretReference` UUID only).
    - `CredentialEditorModal`: Type selector (Bearer Token, Cookie, Basic Auth, Custom Header), expiration date, role tags. Master password / Keychain unlock prompt.
    - `SessionStatusIndicator`: Active session health, cookies preview (masked), token decode summary (JWT claims).
  - `AuthorizationMatrixWorkspace`:
    - `MatrixGrid`: 2D Grid mapping Endpoints / Resources (Y-axis) vs Identities / Roles (X-axis).
    - `MatrixCellStatus`: Green (Authorized 200 OK), Red (Unauthorized 401/403 Expected), Purple (VIOLATION: IDOR/BOLA Detected), Grey (Untested).
    - `RunMatrixReplayButton`: Executes cross-tenant permutations using `sentinel_authz`.
    - `ViolationInspector`: Side-by-side comparison of Tenant A request executed under Tenant B session.
- **State Stores**: `useIdentityStore`, `useAuthzMatrixStore`.
- **Tauri IPC Endpoints**:
  - `cmd_auth_list_identities()` -> Result<Vec<IdentitySummary>>
  - `cmd_auth_create_identity(username, roles)` -> Result<Identity>
  - `cmd_auth_set_credential(identity_id, cred_type, secret_val)` -> Result<Credential>
  - `cmd_auth_get_session(identity_id)` -> Result<Session>
  - `cmd_authz_generate_matrix(endpoint_ids, identity_ids)` -> Result<AuthzMatrixResult>
  - `cmd_authz_run_evaluation(matrix_id)` -> Result<AuthzEvaluationReport>
- **Backend Capability**: `sentinel_auth`, `sentinel_authz`, `sentinel_common` (IMPLEMENTED).

---

### Phase UI-7: API Security, Browser Daemon & OAST
- **Objective**: OpenAPI schema ingestion, GraphQL depth/introspection analysis, WebSocket frame inspector, Playwright headless browser automation, and OAST callback server listener.
- **Views & Components**:
  - `ApiSecurityWorkspace`:
    - `OpenApiParserTab`: Ingest Swagger / OpenAPI 3.x spec, explore route tree, send endpoints to Repeater / Scanner.
    - `GraphQlAnalyzerTab`: Introspection query runner, field depth calculator, batching query fuzzer.
    - `WebSocketFrameInspector`: Live bidirectional stream of WS frames (Text, Binary, Ping/Pong), opcode filter, message replayer.
  - `BrowserAutomationWorkspace`:
    - `BrowserControlBar`: URL input, Navigate button, Screenshot button, Script Executor.
    - `DomTreeViewer`: Interactive DOM hierarchy with shadow DOM toggle, form element detector, event listener inspection.
    - `ScreenshotGallery`: CAS-backed immutable screenshot snapshots (`SEC-07`).
  - `OastWorkspace`:
    - `OastServerStatus`: Listener ports (DNS 53, HTTP 80/8080), AES-256 encryption status (`SEC-02`).
    - `TokenGeneratorPanel`: Generate unique AES-256 encrypted canary tokens with context labels.
    - `InteractionsFeed`: Real-time log of incoming DNS queries and HTTP callbacks correlated to tokens.
- **State Stores**: `useApiStore`, `useBrowserStore`, `useOastStore`.
- **Tauri IPC Endpoints**:
  - `cmd_api_parse_openapi(spec_content)` -> Result<Vec<PRoute>>
  - `cmd_api_analyze_graphql(schema_endpoint)` -> Result<GraphQlAnalysis>
  - `cmd_browser_navigate(url, bypass_csp)` -> Result<DomSnapshot>
  - `cmd_browser_execute_js(script)` -> Result<String>
  - `cmd_browser_take_screenshot(full_page)` -> Result<Uuid>
  - `cmd_oast_generate_token(context_label)` -> Result<String>
  - `cmd_oast_get_interactions(token_id?)` -> Result<Vec<OastInteraction>>
- **Backend Capability**: `sentinel_api`, `sentinel_browser`, `sentinel_oast` (IMPLEMENTED).

---

### Phase UI-8: Findings Center & Evidence Linking
- **Objective**: 6-stage vulnerability lifecycle triage (`Candidate` -> `Verified` -> `Confirmed` -> `Reported` -> `Remediated`), proof requirement enforcement (`SEC-06`), and cryptographic CAS evidence linking (`SEC-07`).
- **Views & Components**:
  - `FindingsCenterWorkspace`:
    - `FindingsFilterHeader`: Filter by Severity (Critical, High, Medium, Low, Info), Lifecycle State, Scope, Confidence score.
    - `FindingsVirtualTable`: High-density table displaying Severity Badge, Title, Endpoint, State, Strategy, Evidence Count, Age.
  - `FindingDetailModal` / `FindingInspector`:
    - `LifecycleTransitionBar`: Buttons for Promote, Mark False Positive, Accept Risk, Mark Remediated.
    - `VerificationProofCard`: Shows exact verification strategy used (`SEC-06`), confidence %, execution timestamp.
    - `EvidenceLinkViewer`: Expandable list of linked CAS artifacts:
      - Raw Transaction Pair (Request + Response)
      - Out-of-Band OAST Callback payload
      - DOM Snapshot / Headless Browser Screenshot
      - Timing Variance statistical curve
      - Differential diff view
    - `ProofRequirementBadge`: Visual green lock verifying empirical proof exists before allowing `Confirmed` state.
- **State Stores**: `useFindingsStore`.
- **Tauri IPC Endpoints**:
  - `cmd_findings_list(filter)` -> Result<Vec<FindingSummary>>
  - `cmd_findings_get_details(finding_id)` -> Result<FindingDetails>
  - `cmd_findings_update_state(finding_id, new_state, notes)` -> Result<()>
  - `cmd_findings_get_evidence(verification_id)` -> Result<Vec<EvidenceDescriptor>>
  - `stream_finding_events` (Event: `UiFindingEvent`), `stream_candidate_verified` (Event: `UiCandidateVerifiedEvent`)
- **Backend Capability**: `sentinel_verification`, `sentinel_report`, `sentinel_storage` (IMPLEMENTED).

---

### Phase UI-9: Pentester Notebook, Event Timeline & Tasks
- **Objective**: Pentester scratchpad with Markdown editing and entity tagging (`@endpoint`, `#finding`), unified event timeline, and background task engine monitor.
- **Views & Components**:
  - `NotebookWorkspace`:
    - `NotesList`: Searchable notes list organized by target, finding, or engagement phase.
    - `MarkdownEditor`: Dual-pane Split Markdown Editor with live rendering, checklist tracking, and image/screenshot paste.
    - `EntityLinker`: Quick tagger referencing transactions, findings, endpoints, and credentials.
  - `TimelineWorkspace`:
    - `EventStream`: Unified chronological event log combining proxy transactions, scanner events, auth changes, and findings.
    - `TimelineFilter`: Filter by provenance (`Manual`, `Scanner`, `Proxy`, `AI`, `Tool`).
  - `TaskSchedulerDrawer`:
    - `ActiveTasksList`: Background tasks with priority, worker threads, memory consumption, and cancel button.
- **State Stores**: `useNotebookStore`, `useTimelineStore`, `useTaskStore`.
- **Tauri IPC Endpoints**:
  - `cmd_notes_list(target_id?)` -> Result<Vec<Note>>
  - `cmd_notes_create(target_id, author, content)` -> Result<Note>
  - `cmd_notes_update(note_id, content)` -> Result<()>
  - `cmd_notes_delete(note_id)` -> Result<()>
  - `cmd_tasks_list()` -> Result<Vec<Task>>
  - `cmd_tasks_cancel(task_id)` -> Result<()>
- **Backend Capability**: `sentinel_report` (notebook), `sentinel_common` (tasks), `sentinel_bus` (timeline) (IMPLEMENTED).

---

### Phase UI-10: Attack Graph, Surface Coverage & Next-Best-Test
- **Objective**: Knowledge graph visualization of discovered assets and attack paths, surface coverage gap heatmaps, and automated Next-Best-Test recommendations.
- **Views & Components**:
  - `AttackGraphWorkspace`:
    - `InteractiveGraphCanvas`: Node types (Domain, Host, Port, Endpoint, Parameter, Technology, Finding) and Edge types (ResolvesTo, RoutesTo, AcceptsParam, VulnerableTo).
    - `PathHighlighter`: Highlights shortest attack path from entry point to high-value asset using SQLite CTE graph queries.
    - `NodeDetailInspector`: Click node to inspect metadata, tech stack, and linked observations.
  - `CoverageHeatmapWorkspace`:
    - `EndpointCoverageTable`: Total endpoints, tested endpoints, parameter coverage %, uninspected attack surface gaps.
    - `NextBestTestPanel`: Actionable recommendations generated by `CoverageEngine` (e.g. "Fuzz untested parameter `redirect_url` on `/oauth/callback`").
- **State Stores**: `useKnowledgeStore`, `useCoverageStore`.
- **Tauri IPC Endpoints**:
  - `cmd_graph_get_topology()` -> Result<GraphTopology>
  - `cmd_graph_find_attack_paths(start_id, target_id)` -> Result<Vec<AttackPath>>
  - `cmd_coverage_get_metrics(scope_id)` -> Result<CoverageReport>
  - `cmd_coverage_get_recommendations()` -> Result<Vec<NextBestTestAction>>
  - `stream_coverage_events` (Event: `UiCoverageEvent`)
- **Backend Capability**: `sentinel_knowledge`, `sentinel_coverage`, `sentinel_context` (IMPLEMENTED).

---

### Phase UI-11: Reporting Engine & Retest / Regression
- **Objective**: Multi-format executive and technical security report export (PDF, Markdown, HTML, JSON, SARIF) and one-click regression testing.
- **Views & Components**:
  - `ReportGeneratorWorkspace`:
    - `ReportConfigForm`: Title, Executive Summary, Scope Description, Finding Selector (Filter by Severity/Status), Evidence Inclusion Toggle, Format Selector (`Markdown`, `HTML`, `JSON`, `SARIF`, `PDF`).
    - `LiveReportPreview`: Real-time rendered HTML/Markdown preview.
    - `ExportButton`: Generates report file to chosen local path.
  - `RegressionTestingWorkspace`:
    - `RegressionTestsTable`: List of automated verification test suites generated from confirmed findings.
    - `ExecuteRegressionSuiteButton`: Replays seed transaction with exact verification payload and validates status.
    - `RegressionResultBadge`: `Passed` (Remediated) or `Failed` (Vulnerability Still Present / Regression).
- **State Stores**: `useReportStore`, `useRegressionStore`.
- **Tauri IPC Endpoints**:
  - `cmd_report_generate(config)` -> Result<String>
  - `cmd_report_export_file(config, output_path)` -> Result<ReportSummary>
  - `cmd_regression_create_test(finding_id, seed_tx_id)` -> Result<RegressionTest>
  - `cmd_regression_run_suite()` -> Result<RegressionSuiteResult>
- **Backend Capability**: `sentinel_report`, `sentinel_verification` (IMPLEMENTED).

---

### Phase UI-12: Settings & Diagnostics
- **Objective**: Subsystem status dashboard, proxy TLS CA management, external tool adapter paths (Nmap, Nuclei, Sqlmap, Subfinder), AI Copilot policy settings, and logging/SIEM diagnostics.
- **Views & Components**:
  - `SettingsWorkspace`:
    - `SubsystemStatusMatrix`: Grid of all 28 subsystems showing uptime, memory, queue depth, error count.
    - `TlsCertificateManager`: Download Root CA certificate (`sentinel_ca.crt`), regenerate CA keys, import custom upstream CA.
    - `ExternalAdaptersConfig`: Configure executable paths for Nmap, Nuclei, Sqlmap, Subfinder with auto-detection.
    - `AiCopilotSettings`: LLM Endpoint, Model name, API Key (stored in Keychain `SEC-09`), Policy Gate Enforcer (`SEC-03`).
    - `SiemExportConfig`: RFC 5424 Syslog / CEF UDP/TCP streaming target configuration.
    - `DiagnosticLogsViewer`: Real-time filtered engine log viewer with zero plaintext secret redaction verification (`SEC-09`).
- **State Stores**: `useSettingsStore`, `useDiagnosticsStore`.
- **Tauri IPC Endpoints**:
  - `cmd_settings_get_all()` -> Result<AppSettings>
  - `cmd_settings_update(settings)` -> Result<()>
  - `cmd_tls_export_ca()` -> Result<String>
  - `cmd_tls_regenerate_ca()` -> Result<()>
  - `cmd_diagnostics_get_subsystem_health()` -> Result<Vec<SubsystemHealth>>
  - `cmd_diagnostics_get_logs(filter)` -> Result<Vec<LogEntry>>
- **Backend Capability**: `sentinel_common`, `sentinel_adapters`, `sentinel_ai`, `sentinel_enterprise`, `sentinel_proxy` (IMPLEMENTED).

---

### Phase UI-13: Performance Hardening, Accessibility & Visual Regression
- **Objective**: 1M dataset stability benchmarking, memory leak prevention, strict CSP sandbox validation (`SEC-11`), WCAG AA contrast, and visual regression snapshot suite.
- **Views & Components**:
  - `PerformanceDiagnosticsOverlay`: Frame rate (FPS), Memory RSS, DOM Node Count, Virtual Row Window metrics.
  - `AccessibilityValidation`: ARIA labels across all interactive elements, keyboard trap prevention, high-contrast focus rings.
- **Gates**:
  - 1M rows virtual scrolling with <16ms frame render latency.
  - Zero memory growth on 100K event stream ingestion.
  - CSP and XSS sanitization tests pass with 100%.

---

### Phase UI-14: Full End-to-End Pentester Validation & Release Packaging
- **Objective**: 17-Step CLI-Independence validation, 24-Step Pentester UX sequence execution, final production binary compilation (Tauri installer / MSI / DMG / AppImage), and release attestations.
- **Deliverables**:
  - `FINAL_UI_FEATURE_MATRIX.md`
  - `FINAL_UI_VERIFICATION.md`
  - `FINAL_UI_PERFORMANCE_REPORT.md`
  - `FINAL_UI_SECURITY_REPORT.md`
  - `FINAL_PENTESTER_UX_REPORT.md`
  - `FINAL_DESKTOP_RELEASE_REPORT.md`

---

## 7. Zero Fake UI & Backend Truth Canonical Binding Matrix

This matrix maps every primary UI control directly to its backend Rust crate, IPC method, and fallback behavior.

| UI Workspace / Control | Frontend Component | Backend Subsystem & Crate | IPC Bridge Call | Capability Status | Unavailable Fallback Behavior |
|---|---|---|---|---|---|
| **Project Switcher** | `ProjectSelector.tsx` | `SUB-02` `sentinel_storage` | `cmd_project_open` | `BACKEND_IMPLEMENTED` | Disables workspaces; displays "Open or Create Project" splash |
| **Scope Rules Table** | `ScopeTable.tsx` | `SUB-04` `sentinel_scope` | `cmd_scope_update` | `BACKEND_IMPLEMENTED` | Read-only with lock icon if project is read-only |
| **Scope Rule Tester** | `ScopeTester.tsx` | `SUB-04` `sentinel_scope` | `cmd_scope_test_uri` | `BACKEND_IMPLEMENTED` | Disabled if no active scope defined |
| **Proxy Toggle Switch**| `ProxyToggle.tsx` | `SUB-01` `sentinel_proxy` | `cmd_proxy_toggle` | `BACKEND_IMPLEMENTED` | Error toast if port 8080 bound by another process |
| **Traffic History Table**| `TrafficTable.tsx` | `SUB-01`/`SUB-03` `sentinel_storage` | `cmd_traffic_get_page` | `BACKEND_IMPLEMENTED` | Empty state illustration: "Waiting for proxy traffic..." |
| **HTTPQL Filter Bar** | `HttpqlBar.tsx` | `SUB-07` `sentinel_httpql` | `cmd_httpql_validate` | `BACKEND_IMPLEMENTED` | Red border + inline parse error tooltip on invalid syntax |
| **Raw/Hex Inspector** | `HexInspector.tsx` | `SUB-03` `sentinel_storage` (CAS) | `cmd_traffic_get_raw_blob` | `BACKEND_IMPLEMENTED` | Shows "Blob not found" if CAS hash missing |
| **Response Diff Tool**| `DiffViewer.tsx` | `SUB-08` `sentinel_repeater` | `cmd_traffic_diff` | `BACKEND_IMPLEMENTED` | Disabled until exactly 2 transactions selected |
| **Repeater Send Btn** | `RepeaterPane.tsx`| `SUB-08` `sentinel_repeater` | `cmd_repeater_execute` | `BACKEND_IMPLEMENTED` | Disabled if request text empty or proxy uninitialized |
| **Fuzzer Run Btn** | `FuzzerConfig.tsx`| `SUB-14` `sentinel_fuzzer` | `cmd_fuzzer_start` | `BACKEND_IMPLEMENTED` | Disabled if no `§` injection points marked |
| **Payload Minimizer** | `Minimizer.tsx` | `SUB-14` `sentinel_fuzzer` | `cmd_fuzzer_minimize` | `BACKEND_IMPLEMENTED` | Disabled if no baseline payload failure provided |
| **Scanner Start Btn** | `ScanDialog.tsx` | `SUB-13` `sentinel_scanner` | `cmd_scanner_start` | `BACKEND_IMPLEMENTED` | Scope check pre-flight modal required before enabling |
| **Credential Unlock** | `VaultUnlock.tsx` | `SUB-12` `sentinel_auth` | `cmd_auth_unlock_vault` | `BACKEND_IMPLEMENTED` | Masked `********` display; requires OS credential prompt |
| **AuthZ Matrix Replay**| `MatrixGrid.tsx` | `SUB-16` `sentinel_authz` | `cmd_authz_run_evaluation` | `BACKEND_IMPLEMENTED` | Disabled if <2 identities or <1 endpoint configured |
| **OpenAPI Parser** | `OpenApiTab.tsx` | `SUB-17` `sentinel_api` | `cmd_api_parse_openapi` | `BACKEND_IMPLEMENTED` | Parse error alert if JSON/YAML invalid |
| **Browser DOM Snap** | `BrowserView.tsx` | `SUB-18` `sentinel_browser` | `cmd_browser_navigate` | `BACKEND_IMPLEMENTED` | Disabled if Playwright daemon binary not running |
| **OAST Token Generator**| `OastPanel.tsx` | `SUB-19` `sentinel_oast` | `cmd_oast_generate_token` | `BACKEND_IMPLEMENTED` | Disabled with warning if OAST port 53/80 unconfigured |
| **Candidate Verifier**| `VerifyModal.tsx` | `SUB-15` `sentinel_verification` | `cmd_verify_candidate` | `BACKEND_IMPLEMENTED` | Disabled if candidate has no source observation |
| **Promote Finding** | `FindingBar.tsx` | `SUB-15` `sentinel_verification` | `cmd_findings_update_state` | `BACKEND_IMPLEMENTED` | Blocked by `SEC-06` unless verified evidence exists |
| **Attack Graph Canvas**| `AttackMap.tsx` | `SUB-10` `sentinel_knowledge` | `cmd_graph_get_topology` | `BACKEND_IMPLEMENTED` | Empty graph notice if no endpoints discovered |
| **Next-Best-Test** | `NextBest.tsx` | `SUB-11` `sentinel_coverage` | `cmd_coverage_get_recommendations` | `BACKEND_IMPLEMENTED` | Shows "All discovered surface tested" when 100% |
| **Report Export** | `ReportForm.tsx` | `SUB-21` `sentinel_report` | `cmd_report_export_file` | `BACKEND_IMPLEMENTED` | Disabled if 0 findings selected |
| **Regression Suite** | `Regression.tsx` | `SUB-21` `sentinel_report` | `cmd_regression_run_suite` | `BACKEND_IMPLEMENTED` | Disabled if no regression test fixtures defined |
| **Command Palette** | `Palette.tsx` | `SUB-22` `sentinel_productivity`| `cmd_productivity_execute_command` | `BACKEND_IMPLEMENTED` | Dynamic command list filtered by active context |
| **Nmap / Nuclei Run** | `Adapters.tsx` | `SUB-24` `sentinel_adapters` | `cmd_adapters_run_tool` | `BACKEND_IMPLEMENTED` | Disabled if binary path not found in system PATH |
| **AI Copilot Query** | `AiCopilot.tsx` | `SUB-25` `sentinel_ai` | `cmd_ai_generate_payload` | `BACKEND_IMPLEMENTED` | Blocked if AI API key missing or query fails `SEC-03` |
| **WASM Plugin Exec** | `Plugins.tsx` | `SUB-23` `sentinel_plugin` | `cmd_plugins_execute` | `BACKEND_IMPLEMENTED` | Capability prompt dialog before execution |
| **Enterprise SIEM** | `SiemConfig.tsx` | `SUB-27` `sentinel_enterprise` | `cmd_enterprise_set_siem` | `BACKEND_IMPLEMENTED` | Test connection validation required before activating |
| **SMT Symbolic Proof**| `ResearchTab.tsx`| `SUB-26` `sentinel_research` | `cmd_research_smt_solve` | `BACKEND_DEFERRED` | Informational card: "Requires --features sentinel-research" |
| **RL State Engine** | `ResearchTab.tsx`| `SUB-27` `sentinel_research` | `cmd_research_rl_explore` | `BACKEND_DEFERRED` | Informational card: "Requires --features sentinel-research" |

---

## 8. Complete Tauri IPC Bridge & Protobuf Specification

The bridge exposes type-safe Tauri commands and high-speed async event streams.

### 8.1 Rust Tauri Commands Signature Index

```rust
// src-tauri/src/commands/mod.rs

// 1. Platform & Project
#[tauri::command]
pub async fn cmd_project_new(path: String, name: String) -> Result<ProjectMetadata, String>;
#[tauri::command]
pub async fn cmd_project_open(path: String) -> Result<ProjectState, String>;
#[tauri::command]
pub async fn cmd_project_save() -> Result<(), String>;

// 2. Scope Engine (SEC-01)
#[tauri::command]
pub async fn cmd_scope_get() -> Result<Scope, String>;
#[tauri::command]
pub async fn cmd_scope_update(includes: Vec<String>, excludes: Vec<String>) -> Result<Scope, String>;
#[tauri::command]
pub async fn cmd_scope_test_uri(uri: String) -> Result<ScopeDecision, String>;

// 3. Proxy & Traffic (SEC-10)
#[tauri::command]
pub async fn cmd_proxy_toggle(enable: bool, port: u16) -> Result<bool, String>;
#[tauri::command]
pub async fn cmd_traffic_get_page(query: String, offset: u32, limit: u32) -> Result<Vec<TransactionSummary>, String>;
#[tauri::command]
pub async fn cmd_traffic_get_details(transaction_id: String) -> Result<TransactionDetails, String>;
#[tauri::command]
pub async fn cmd_traffic_get_raw_blob(blob_id: String) -> Result<Vec<u8>, String>;
#[tauri::command]
pub async fn cmd_traffic_diff(tx_id_a: String, tx_id_b: String) -> Result<ResponseDiffResult, String>;
#[tauri::command]
pub async fn cmd_httpql_validate(query: String) -> Result<HttpqlValidationResult, String>;

// 4. Manual Testing & Repeater
#[tauri::command]
pub async fn cmd_repeater_create_tab(seed_tx_id: Option<String>) -> Result<RepeaterTab, String>;
#[tauri::command]
pub async fn cmd_repeater_execute(tab_id: String, raw_request: Vec<u8>, env_vars: HashMap<String, String>) -> Result<ExecutionOutput, String>;
#[tauri::command]
pub async fn cmd_repeater_diff_revisions(tab_id: String, rev_a: usize, rev_b: usize) -> Result<ResponseDiffResult, String>;

// 5. Scanner & Fuzzer
#[tauri::command]
pub async fn cmd_scanner_start(config: ScanConfig) -> Result<String, String>;
#[tauri::command]
pub async fn cmd_scanner_pause(scan_id: String) -> Result<(), String>;
#[tauri::command]
pub async fn cmd_scanner_resume(scan_id: String) -> Result<(), String>;
#[tauri::command]
pub async fn cmd_scanner_stop(scan_id: String) -> Result<(), String>;
#[tauri::command]
pub async fn cmd_fuzzer_start(config: FuzzConfig) -> Result<String, String>;
#[tauri::command]
pub async fn cmd_fuzzer_minimize(payload: Vec<u8>, test_oracle: String) -> Result<MinimizedPayloadResult, String>;

// 6. Identity & AuthZ Matrix (SEC-09)
#[tauri::command]
pub async fn cmd_auth_list_identities() -> Result<Vec<IdentitySummary>, String>;
#[tauri::command]
pub async fn cmd_auth_create_identity(username: String, roles: Vec<String>) -> Result<Identity, String>;
#[tauri::command]
pub async fn cmd_auth_set_credential(identity_id: String, cred_type: String, secret_val: String) -> Result<Credential, String>;
#[tauri::command]
pub async fn cmd_authz_run_evaluation(endpoint_ids: Vec<String>, identity_ids: Vec<String>) -> Result<AuthzEvaluationReport, String>;

// 7. API, Browser & OAST (SEC-02)
#[tauri::command]
pub async fn cmd_api_parse_openapi(spec_content: String) -> Result<Vec<PRoute>, String>;
#[tauri::command]
pub async fn cmd_browser_navigate(url: String, bypass_csp: bool) -> Result<DomSnapshot, String>;
#[tauri::command]
pub async fn cmd_browser_take_screenshot(full_page: bool) -> Result<String, String>;
#[tauri::command]
pub async fn cmd_oast_generate_token(context_label: String) -> Result<String, String>;
#[tauri::command]
pub async fn cmd_oast_get_interactions(token_id: Option<String>) -> Result<Vec<OastInteraction>, String>;

// 8. Findings & Verification (SEC-06, SEC-07)
#[tauri::command]
pub async fn cmd_findings_list(filter: FindingFilter) -> Result<Vec<FindingSummary>, String>;
#[tauri::command]
pub async fn cmd_findings_get_details(finding_id: String) -> Result<FindingDetails, String>;
#[tauri::command]
pub async fn cmd_findings_update_state(finding_id: String, new_state: String, notes: String) -> Result<(), String>;
#[tauri::command]
pub async fn cmd_verify_candidate(candidate_id: String, strategy: String) -> Result<VerificationResult, String>;

// 9. Attack Graph & Coverage
#[tauri::command]
pub async fn cmd_graph_get_topology() -> Result<GraphTopology, String>;
#[tauri::command]
pub async fn cmd_graph_find_attack_paths(start_id: String, target_id: String) -> Result<Vec<AttackPath>, String>;
#[tauri::command]
pub async fn cmd_coverage_get_metrics(scope_id: Option<String>) -> Result<CoverageReport, String>;

// 10. Reports & Productivity
#[tauri::command]
pub async fn cmd_report_generate(config: ReportConfig) -> Result<String, String>;
#[tauri::command]
pub async fn cmd_report_export_file(config: ReportConfig, path: String) -> Result<ReportSummary, String>;
#[tauri::command]
pub async fn cmd_productivity_search(query: String) -> Result<Vec<SearchHit>, String>;
#[tauri::command]
pub async fn cmd_productivity_execute_command(command_id: String) -> Result<String, String>;
```

### 8.2 Async Event Streaming Registry

| Event Topic | Payload Message Type | Frequency / Burst Rate | UI Consumer Store |
|---|---|---|---|
| `sentinel://traffic/event` | `UiTrafficEvent` | Up to 5,000/sec (Batched) | `useTrafficStore` |
| `sentinel://finding/event` | `UiFindingEvent` | Event-driven | `useFindingsStore` |
| `sentinel://scan/progress` | `UiScanProgressEvent` | 10Hz (100ms throttle) | `useScannerStore` |
| `sentinel://task/status` | `UiTaskStatusEvent` | On state change | `useTaskStore` |
| `sentinel://coverage/update`| `UiCoverageEvent` | On endpoint scan complete | `useCoverageStore` |
| `sentinel://scope/violation`| `UiScopeViolationEvent`| Real-time on Deny | `useScopeStore` |
| `sentinel://candidate/verified`| `UiCandidateVerifiedEvent`| On proof completion | `useFindingsStore` |

---

## 9. State Store & React Hook Architecture

The frontend state is partitioned into isolated domain stores using **Zustand** with zero state cross-contamination.

```
src/
├── stores/
│   ├── useAppShellStore.ts       # Themes, active workspace, panel split dimensions
│   ├── useProjectStore.ts        # Active project metadata, dirty flags, SQLite path
│   ├── useScopeStore.ts          # Scope includes/excludes, violation feed
│   ├── useTrafficStore.ts        # Virtualized traffic buffer, HTTPQL filter, selection
│   ├── useInspectorStore.ts      # Active transaction raw/parsed/hex representation
│   ├── useRepeaterStore.ts       # Multi-tab request state, variables, revisions
│   ├── useScannerStore.ts        # Active scan jobs, rates, progress meters
│   ├── useFuzzerStore.ts         # Mutation algorithms, live results, minimizer
│   ├── useIdentityStore.ts       # Identity list, vault lock status, active session
│   ├── useAuthzMatrixStore.ts    # Matrix 2D state, violations, replay queue
│   ├── useApiStore.ts            # OpenAPI routes, GraphQL schemas, WS frames
│   ├── useBrowserStore.ts        # DOM tree, active URL, screenshots
│   ├── useOastStore.ts           # Canary tokens, real-time callbacks
│   ├── useFindingsStore.ts       # Findings triage, verification evidence, lifecycle
│   ├── useNotebookStore.ts       # Markdown notes, entity tags
│   ├── useKnowledgeStore.ts      # Graph nodes, edges, attack paths
│   ├── useCoverageStore.ts       # Surface coverage metrics, recommendations
│   ├── useReportStore.ts         # Report builder configuration, preview
│   └── useDiagnosticsStore.ts    # Subsystem telemetry, SIEM queues, logs
```

---

## 10. Large Dataset Virtualization Strategy (1M Transactions)

To ensure smooth 60 FPS operation under 1M transactions without UI crashes or unbounded memory growth:

1. **Virtual Windowing**: `TanStack Virtual` renders only the ~30 visible DOM nodes in the viewport regardless of table size.
2. **Circular Ring Buffer**: The active in-memory frontend stream maintains a maximum of 50,000 transactions in the live viewport ring buffer; older records are transparently paged from the SQLite database via `cmd_traffic_get_page`.
3. **Web Worker Offloading**: HTTPQL AST parsing, fuzzy search sorting, and syntax highlighting run in dedicated Web Workers (`httpql.worker.ts`, `search.worker.ts`), keeping the React UI thread completely free.
4. **Debounced Protobuf Batching**: High-volume `UiTrafficEvent` streams are batched at 50ms intervals in Rust before dispatching to the Webview, preventing IPC message backlog.

---

## 11. Security Sanitization & Hostile Payload Guardrails

The frontend renders arbitrary, potentially hostile HTTP responses, HTML bodies, and exploit payloads safely:

1. **Strict Content Security Policy (SEC-11)**: Webview CSP forbids inline scripts (`default-src 'self'; script-src 'self'; object-src 'none'`).
2. **Sandboxed HTML Render**: Target HTML previews are rendered inside an isolated `iframe` with `sandbox="allow-same-origin"` and script execution explicitly forbidden.
3. **Escaped Code Blocks**: All raw HTTP bodies and fuzz payloads are passed through text-escaping nodes before being rendered into Monaco/CodeMirror.
4. **Secret Redaction (SEC-09)**: Passwords, bearer tokens, and private keys are never rendered in plaintext in logs, tooltips, or serialized state unless explicitly unlocked via `cmd_auth_unlock_vault`.

---

## 12. 17-Step CLI-Independence & 24-Step Pentester Validation Matrix

Every single step in the authoritative user validation flows is mapped to its exact UI view, interaction, and verification command:

### 12.1 17-Step CLI-Independence Acceptance Test

| Step | User Action | Target View & Component | Underlying IPC Command | Success Criteria |
|---|---|---|---|---|
| **1** | Create project | `ProjectManagerModal` | `cmd_project_new` | `.sentinel` SQLite DB initialized |
| **2** | Configure scope | `ScopeConfigurationWorkspace` | `cmd_scope_update` | In-scope CIDR/wildcards active (`SEC-01`) |
| **3** | Start proxy & capture | `TopBar -> ProxyToggle` | `cmd_proxy_toggle` | Port 8080 listening, cert active |
| **4** | Inspect & filter | `TrafficWorkspace -> HttpqlBar` | `cmd_httpql_validate` | Virtual table filters live traffic |
| **5** | Send to Repeater & replay | `TransactionInspector -> SendBtn` | `cmd_repeater_execute` | Response received & diffed |
| **6** | Configure & run Fuzzer | `FuzzerWorkspace -> RunBtn` | `cmd_fuzzer_start` | Mutations generated & minimized |
| **7** | Run Scanner & review | `ScannerWorkspace -> StartBtn` | `cmd_scanner_start` | Active checks find candidates |
| **8** | Switch ID & run Matrix | `AuthorizationMatrixWorkspace` | `cmd_authz_run_evaluation` | IDOR/BOLA violations highlighted |
| **9** | Open API & Browser | `ApiSecurityWorkspace` | `cmd_api_parse_openapi` | Routes & DOM tree rendered |
| **10** | Generate OAST token | `OastWorkspace -> GenTokenBtn` | `cmd_oast_generate_token` | AES-256 token synthesized (`SEC-02`) |
| **11** | Verify candidate | `FindingsCenter -> VerifyBtn` | `cmd_verify_candidate` | Empirical proof verified (`SEC-06`) |
| **12** | Capture CAS evidence | `FindingDetail -> EvidenceTab` | `cmd_findings_get_evidence` | SHA-256 CAS link confirmed (`SEC-07`)|
| **13** | Promote to Finding | `FindingDetail -> StateSelect` | `cmd_findings_update_state` | State transitions to `Confirmed` |
| **14** | Create notebook entry | `NotebookWorkspace -> NewNote` | `cmd_notes_create` | Note saved with `@finding` tag |
| **15** | Review Attack Graph | `AttackGraphWorkspace` | `cmd_graph_find_attack_paths` | Shortest attack path highlighted |
| **16** | Create regression test | `RegressionTestingWorkspace` | `cmd_regression_create_test` | Test fixture registered |
| **17** | Export report | `ReportGeneratorWorkspace` | `cmd_report_export_file` | Markdown / HTML / PDF generated |

### 12.2 24-Step Comprehensive Pentester Validation Sequence

```
[01. Create Engagement] -> [02. Define Scope] -> [03. Start Proxy] -> [04. Ingest Traffic]
           |
           v
[05. Review History] -> [06. Open Inspector] -> [07. Send to Repeater] -> [08. Replay & Diff]
           |
           v
[09. Run Fuzzer] -> [10. Run Scanner] -> [11. Switch Identity] -> [12. Run AuthZ Matrix]
           |
           v
[13. Open API Workspace] -> [14. Open Browser DOM] -> [15. Create OAST Token] -> [16. Verify Candidate]
           |
           v
[17. Capture Evidence] -> [18. Create Finding] -> [19. Add Notebook Note] -> [20. Review Coverage]
           |
           v
[21. View Attack Graph] -> [22. Create Regression Test] -> [23. Retest Finding] -> [24. Generate Report]
```

---

## 13. Sequential Implementation Roadmap (UI-1 to UI-14)

Implementation must proceed strictly in sequence through the following dedicated subagent phases:

1. **Phase UI-1**: Unified Design System, Tokens, App Shell, Splitter Engine, Command Palette (`Ctrl+K`), OmniSearch.
2. **Phase UI-2**: Project Manager (`.sentinel` format), Scope Engine (`SEC-01`), Scope Tester, Violation Drawer.
3. **Phase UI-3**: Virtualized Traffic Table, HTTPQL Query Engine, Raw/Hex Inspector, Response Diff Tool.
4. **Phase UI-4**: Repeater Workspace, Tab Management, Variable Interpolation, Revision History.
5. **Phase UI-5**: Scanner Orchestrator, Fuzzer Mutators, Delta Debugging Minimizer.
6. **Phase UI-6**: Redacted Identity Vault (`SEC-09`), Session Switcher, Authorization Matrix.
7. **Phase UI-7**: OpenAPI Parser, GraphQL Inspector, WebSocket Frames, Browser Daemon, OAST Server.
8. **Phase UI-8**: Findings Center, Verification Proof Gate (`SEC-06`), CAS Evidence Linker (`SEC-07`).
9. **Phase UI-9**: Pentester Notebook, Entity Tagger, Event Timeline, Task Console.
10. **Phase UI-10**: Knowledge Graph Canvas, Shortest Attack Path Traversal, Surface Coverage Heatmap.
11. **Phase UI-11**: Multi-Format Reporting (PDF/MD/HTML/JSON/SARIF), One-Click Regression Testing.
12. **Phase UI-12**: Settings Registry, Proxy TLS CA Keys, External Adapters, SIEM Exporter.
13. **Phase UI-13**: Performance Hardening, 1M Dataset Stability, Memory Leaks, CSP Sandboxing (`SEC-11`).
14. **Phase UI-14**: 17-Step & 24-Step Validation Suite, Tauri Packaging, Final Release Attestation.

---

## 14. Attestation & Sign-off

The UI Feature Manifest defines the complete, non-negotiable contract between the Sentinel V6 Desktop Application and the frozen Rust core engine.

- **Zero Fake UI Law**: Strictly Enforced.
- **Spec Blockers**: 0 Blockers.
- **Backend Crates Mapped**: 28 of 28 Crates Mapped.
- **Phase UI-0 Status**: 🟢 **COMPLETE & READY FOR PHASE UI-1**.

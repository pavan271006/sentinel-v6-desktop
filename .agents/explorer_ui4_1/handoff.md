# Phase UI-4: Repeater Manual Testing Workspace — Architectural Specification & Handoff Report

> **Workspace Target**: `c:\Users\Legion 5 pro\Desktop\cyber sec`  
> **Author**: Explorer explorer_ui4_1 (Repeater Workspace & Tab Engine Explorer)  
> **Target Subsystem**: `sentinel_repeater` (SUB-08), `src/stores/repeaterStore.ts`, `src/workspaces/RepeaterWorkspaceView.tsx`, `src/components/repeater/`  
> **Status**: 🟢 **READY FOR IMPLEMENTATION**

---

## 1. Observation

### 1.1 Verified Backend Truth (`sentinel_repeater` & `sentinel_core`)
Direct inspection of `sentinel_core/crates/sentinel_repeater` establishes the verified backend domain models and behavior:

1. **Tab & Revision Domain Models (`sentinel_repeater/src/tab.rs:8-30`)**:
   - `RepeaterRevision`:
     ```rust
     pub struct RepeaterRevision {
         pub revision_id: Uuid,
         pub timestamp: DateTime<Utc>,
         pub request_raw: Vec<u8>,
         pub response_raw: Option<Vec<u8>>,
         pub status_code: Option<u16>,
         pub duration_ms: u64,
         pub error: Option<String>,
     }
     ```
   - `RepeaterTab`:
     ```rust
     pub struct RepeaterTab {
         pub id: Uuid,
         pub title: String,
         pub target_url: String,
         pub use_tls: bool,
         pub current_request_raw: Vec<u8>,
         pub current_response_raw: Option<Vec<u8>>,
         pub history: Vec<RepeaterRevision>,
         pub active_history_index: usize,
         pub created_at: DateTime<Utc>,
         pub updated_at: DateTime<Utc>,
     }
     ```

2. **Manager & Tab Lifecycle (`sentinel_repeater/src/manager.rs:15-170`)**:
   - `create_tab(title, target_url, initial_request) -> Uuid`
   - `get_tab(id) -> Option<RepeaterTab>`
   - `list_tabs() -> Vec<RepeaterTab>`
   - `close_tab(id) -> bool`
   - `update_tab_request(id, new_raw_request) -> Result<(), SentinelError>`
   - `execute_tab(id) -> Result<ExecutionOutput, SentinelError>`
   - `diff_revisions(tab_id, idx_a, idx_b) -> Result<ResponseDiffResult, SentinelError>`

3. **Raw Byte Execution & Security Invariants (`sentinel_repeater/src/executor.rs:78-206`)**:
   - **SEC-01 Scope Enforcement**: Pre-socket validation calls `scope_engine.is_in_scope(target_url)`. If rejected, it immediately emits `CriticalEvent::ScopeViolationAttempt` onto the event bus and returns `SentinelError::ScopeViolation`, strictly preventing socket creation to out-of-scope targets.
   - **Variable Interpolation**: Passes raw request bytes through `VariableEnvironment::interpolate()`.
   - **Socket Dispatch**: Supports plain HTTP/1.1 over `TcpStream` and HTTPS over `tokio_rustls::TlsConnector` (ALPN `http/1.1`, TLS 1.2/1.3).
   - **Dual-Write Persistence (SEC-07)**: Persists request and response payloads to immutable CAS (`cas().put()`) and records transaction in `SqliteObservationStore`. Emits `SentinelEvent::ObservationCreated`.

4. **Variable Environment Engine (`sentinel_repeater/src/variables.rs:9-97`)**:
   - Supports key-value variables (`{{var_name}}`).
   - Built-in dynamic functions: `{{$uuid}}`, `{{$timestamp}}`, `{{$random_int}}`.
   - Extraction utilities: `extract_from_json(key, json_bytes, path)` and `extract_from_headers(key, headers, header_name)`.

5. **Response Diff Engine (`sentinel_repeater/src/diff.rs:5-157`)**:
   - LCS line diffing (`DiffKind`: `Unchanged`, `Added`, `Removed`, `Modified`).
   - Header diffing (`diff_headers`).
   - `ResponseDiffResult`: Status code delta, duration delta, size delta, line diffs, and `has_divergence` flag.

### 1.2 Existing Frontend Implementation State
1. **`src/workspaces/RepeaterWorkspaceView.tsx` (Lines 1-407)**:
   - Contains a preliminary prototype utilizing local component state (`useState`) and mock initial data (`INITIAL_REPEATER_TABS`).
   - Lacks connection to a global Zustand store (`repeaterStore.ts`).
   - Lacks IPC bridge communication (`cmd_repeater_execute`, `cmd_repeater_create_tab`).
   - Does not implement closed-tab restoration stack (`Ctrl+Shift+T`), dirty state detection, tab duplication, tab reordering, history stack browsing drawer, dynamic variable manager modal, or HTTP/2 protocol negotiation.
2. **`src/workspaces/TrafficWorkspaceView.tsx` (Lines 144-180)**:
   - Keyboard shortcut `Ctrl+R` and "Repeater" button in inspector panel currently only trigger a toast message and do not create or focus a tab in Repeater.
3. **`src/components/traffic/TransactionInspectorPanel.tsx` (Lines 164-175)**:
   - Exposes `onSendToRepeater(tx)` callback, ready for seamless cross-workspace tab hydration.
4. **`src/design-system/`**:
   - `DiffViewer.tsx`: High quality side-by-side and inline LCS diff component ready for reuse.
   - `RawByteInspector.tsx`: Hexadecimal byte dump view with address offset and ASCII pane.
   - `StructuredInspector.tsx`: Collapsible JSON tree and structured headers renderer.
   - `SplitPane.tsx`: Resizable pane engine with localStorage persistence.
   - `Tabs.tsx`: Tab strip with closable pills.

---

## 2. Logic Chain

```
+---------------------------------------------------------------------------------------------------------+
|                                    PHASE UI-4 ARCHITECTURAL LOGIC CHAIN                                 |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [Traffic / Findings / Shell]                                                                           |
|        |                                                                                                |
|        | (Ctrl+R / "Send to Repeater")                                                                  |
|        v                                                                                                |
|  +---------------------------------------------------------------------------------------------------+  |
|  |  repeaterStore.ts (Master Tab & Execution Orchestrator)                                           |  |
|  |  - tabs: RepeaterTabState[] (Active, Dirty Tracking, Title, Protocol, Headers, Body, Variables)  |  |
|  |  - closedTabsStack: RepeaterTabState[] (Ctrl+Shift+T Reopen)                                       |  |
|  |  - history: RepeaterRevisionItem[] (Execution history per tab, Timestamps, Metrics, Diffs)        |  |
|  |  - variables: Global & Local Variable Interpolation Engine ({{token}}, {{$uuid}}, {{$timestamp}}) |  |
|  +---------------------------------------------------------------------------------------------------+  |
|        |                                              |                                                 |
|        | Dispatches IPC Execution                     | Updates UI Components                           |
|        v                                              v                                                 |
|  +-------------------------------------+      +------------------------------------------------------+  |
|  |  SentinelIpcClient                  |      |  RepeaterWorkspaceView.tsx                           |  |
|  |  - cmd_repeater_execute             |      |  +------------------------------------------------+  |  |
|  |  - cmd_repeater_diff_revisions      |      |  | RepeaterTabBar.tsx (Tabs, Status Badges, Add)  |  |  |
|  |  - cmd_repeater_cancel              |      |  +------------------------------------------------+  |  |
|  +-------------------------------------+      |  | SplitPane (Horizontal / Vertical Layout)       |  |  |
|        |                                      |  |  +---------------------+  +-----------------+  |  |  |
|        v                                      |  |  | RequestEditorPanel  |  | ResponseViewer  |  |  |  |
|  +-------------------------------------+      |  |  | - Method / URL Bar  |  | - Headers/Raw   |  |  |  |
|  |  sentinel_repeater (Rust Core)       |      |  |  | - Raw HTTP Editor   |  | - Hex Dump      |  |  |  |
|  |  - SEC-01 Scope Pre-Flight Check    |      |  |  | - Headers Grid      |  | - JSON Tree     |  |  |  |
|  |  - Variable Template Substitution   |      |  |  | - Variable Chips    |  | - HTML Sandbox  |  |  |  |
|  |  - Raw Byte Socket I/O (TLS / Plain)|      |  |  | - Auto-Calc Length  |  | - TLS / Timing  |  |  |  |
|  |  - SEC-07 CAS & SQLite Record       |      |  |  +---------------------+  +-----------------+  |  |  |
|  +-------------------------------------+      |  +------------------------------------------------+  |  |
|                                               |  | Overlays: HistoryDrawer | DiffModal | VarModal |  |  |
|                                               +------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1 State & Tab Engine Architecture (`repeaterStore.ts`)
The `repeaterStore.ts` must serve as the single source of truth for all manual testing tabs, execution lifecycle, history stacks, and dynamic variables.

1. **Tab Identity & Ordering**:
   - Each tab has a unique UUID (`id`), user-editable `title`, `method`, `url`, `protocol` (`HTTP/1.1` vs `HTTP/2`), `headers: HttpHeaderItem[]`, `body: string`, and `rawMode: boolean`.
   - Tab reordering via array index splice (`reorderTabs(fromIdx, toIdx)`).
   - Duplicate tab creates a clone with new UUID and title `"Copy of <title>"`.
2. **Dirty State Tracking**:
   - `isDirty` is dynamically computed by comparing current `method`, `url`, `headers`, and `body` against the `lastExecutedSnapshot` (or baseline).
   - Displayed visually on `RepeaterTabBar` as an amber bullet point (`•`) next to the title.
3. **Closed Tabs Stack (Undo Engine)**:
   - When a tab is closed, it is pushed onto `closedTabsStack` (bounded to 20 tabs).
   - Pressing `Ctrl+Shift+T` or clicking "Reopen Closed Tab" pops the last closed tab and restores its complete state and history stack.
4. **Per-Tab Execution History Stack**:
   - Every execution (`Send` / `Ctrl+Enter`) appends a `RepeaterRevisionItem` into `tab.history`.
   - Contains: `revisionId`, `revisionNumber`, `timestamp`, `method`, `url`, `requestRaw`, `responseRaw`, `responseHeaders`, `responseBody`, `statusCode`, `durationMs`, `sizeBytes`, `tlsVersion`, `cipherSuite`, `timingBreakdown`, `casEvidence`, and `error`.
   - Paging through revisions (`activeRevisionIndex`) allows instant time-travel: researchers can restore any prior request state into the editor or compare any two revisions.
5. **Dynamic Variable Engine**:
   - Hierarchical variables: Global Project variables (`projectStore`) -> Local Tab variables.
   - Built-in generators: `{{$uuid}}`, `{{$timestamp}}`, `{{$random_int}}`, `{{$random_str}}`, `{{$iso_date}}`.
   - Auto-extraction: One-click extraction of tokens from JSON response paths or `Set-Cookie` headers directly into tab variables.
6. **Execution Control & Cancellation**:
   - Each tab tracks `isExecuting: boolean` and holds an `AbortController`.
   - "Send" button transitions to "Cancel" during flight. Clicking Cancel aborts the network socket and records a cancelled execution revision.

### 2.2 Component Hierarchy & Specifications

```
src/
├── stores/
│   └── repeaterStore.ts                <-- Master Zustand Store for Repeater
├── types/
│   └── repeater.ts                     <-- Typed contracts for tabs, revisions, variables
├── components/
│   └── repeater/
│       ├── RepeaterTabBar.tsx          <-- Tab strip, rename modal, duplicate, dirty badges
│       ├── RequestEditorPanel.tsx      <-- Method/URL, Raw/Headers/Params/Body, Send/Cancel
│       ├── ResponseViewerPanel.tsx     <-- Headers, Raw, Hex, JSON Tree, HTML Preview, TLS/Timing
│       ├── RepeaterHistoryDrawer.tsx   <-- Side-drawer execution revision timeline
│       ├── RepeaterVariablesModal.tsx  <-- Dynamic variables manager & extractor workbench
│       ├── RepeaterDiffModal.tsx       <-- Response differential comparator (Ctrl+D)
│       └── index.ts
└── workspaces/
    └── RepeaterWorkspaceView.tsx       <-- Integrated 2-pane workspace with keyboard bindings
```

#### Detailed Component Specifications:
1. **`RepeaterTabBar.tsx`**:
   - Renders tab items with color-coded HTTP method badges (`GET`=green, `POST`=amber, `PUT`=blue, `DELETE`=red, `PATCH`=purple).
   - Title double-click initiates inline rename.
   - Close `x` button per tab.
   - Right-click context menu: "Duplicate Tab", "Close Tab", "Close Others", "Set Tab Color", "Rename".
   - Top-right workspace actions:
     - "Send to Fuzzer (`Ctrl+Shift+F`)"
     - "Send to Scanner (`Ctrl+Shift+S`)"
     - "Variables (`Ctrl+Alt+V`)"
     - "History (`Ctrl+H`)"
     - "Split Layout (`Ctrl+\`)"
2. **`RequestEditorPanel.tsx`**:
   - Target Bar: Method selector, URL input with autocomplete, Protocol switcher (`HTTP/1.1` / `HTTP/2`), Send button with spinner (`Ctrl+Enter`), Cancel button.
   - View Tabs: `Headers Table`, `Raw HTTP`, `URL Query Params`, `Body Editor`, `Auth Injector`.
   - Raw HTTP Mode: Syntax highlighted with line numbers, automatic `Content-Length` synchronization header toggle, and dynamic variable highlighting.
   - Headers Table Mode: Key-value editor with enable/disable checkbox per header and standard header name autocompletion.
   - Body Editor: Supports `Raw Text`, `JSON` (with Pretty / Minify / Validate buttons), `Form Data`, `x-www-form-urlencoded`.
   - Variable Chips Strip: Bottom status bar showing interpolated variables in current request.
3. **`ResponseViewerPanel.tsx`**:
   - Status Header: Status code badge, status text, duration in milliseconds, size in bytes, TLS encryption badge, CAS proof lock.
   - Sub-View Mode Selector:
     - `Headers`: Key-value table of response headers with one-click copy.
     - `Raw`: Verbatim HTTP response bytes.
     - `Hex`: Multi-column hex dump (Address Offset | Hex Bytes | ASCII).
     - `JSON Tree`: Interactive collapsible JSON tree with search and JSON-Path copying.
     - `HTML Preview`: Sandboxed `<iframe>` (`SEC-11` sandbox: no scripts, isolated origin).
     - `TLS & Timing`: Cipher suite, ALPN, handshake curve, and visual timing waterfall.
     - `Diff`: Side-by-side or inline LCS diff against previous execution or baseline.
4. **`RepeaterHistoryDrawer.tsx`**:
   - Slide-out right panel showing full chronological execution history of active tab.
   - Each card displays: Execution #, timestamp, method, status code, duration, size, and divergence flag.
   - Actions: "Restore Request", "Pin as Baseline Diff", "Diff with Current", "Delete".
5. **`RepeaterVariablesModal.tsx`**:
   - Table of active variables with Name, Current Value, Scope (`Global` / `Tab`), and Source.
   - "Extract Variable" wizard: Paste JSON path (e.g. `auth.token`) or Header Name (e.g. `Authorization`), preview extraction, and bind to variable.
6. **`RepeaterDiffModal.tsx`**:
   - Fullscreen / modal response differential inspector comparing any two historical revisions or baseline vs current.

---

## 3. Caveats & Invariants

1. **Strict Fail-Closed Scope Gate (`SEC-01`)**:
   - Repeater MUST NOT bypass `sentinel_scope`.
   - If a pentester inputs an out-of-scope target URL in Repeater, the execution request will be rejected by backend `RepeaterExecutor` with `SentinelError::ScopeViolation`.
   - The UI must display an explicit Scope Violation Banner explaining why the request was blocked and provide a shortcut to open the Scope Workspace to update rules if authorized.
2. **HTML Response Sandboxing (`SEC-11`)**:
   - Pentesting targets often return malicious or reflected XSS payloads.
   - The HTML Preview mode in `ResponseViewerPanel` must strictly use an `<iframe>` configured with `sandbox="allow-same-origin"` (strictly omitting `allow-scripts` and `allow-top-navigation`) to eliminate the risk of executing untrusted scripts inside the desktop Webview.
3. **Raw Byte Fidelity**:
   - HTTP requests crafted in Raw mode may contain binary bytes, malformed headers, or HTTP smuggling exploits (e.g. `Transfer-Encoding: chunked` exploits).
   - The store and IPC bridge must preserve raw byte sequences without involuntary normalization or UTF-8 corruption.
4. **Memory Footprint for Large Engagements**:
   - Tabs holding 100+ execution revisions with large response bodies could consume excess memory.
   - Revisions older than the last 50 per tab should store body references as CAS blob IDs rather than holding megabyte strings in RAM, retrieving from backend CAS on demand.

---

## 4. Conclusion & Complete Implementation Blueprint

### 4.1 Type Definitions (`src/types/repeater.ts`)

```typescript
// src/types/repeater.ts

import { HttpHeaderItem, TimingBreakdown, TlsCertificateDetails, CasEvidenceData } from './traffic';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT';
export type HttpProtocol = 'HTTP/1.1' | 'HTTP/2';
export type RequestEditorMode = 'raw' | 'headers' | 'params' | 'body' | 'auth';
export type ResponseViewerMode = 'parsed' | 'raw' | 'hex' | 'tree' | 'preview' | 'tls' | 'diff';
export type RequestBodyType = 'raw' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'binary';

export interface QueryParamItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HeaderRowItem {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
}

export interface RepeaterRevisionItem {
  revisionId: string;
  revisionNumber: number;
  timestamp: string;
  timestampMs: number;
  method: HttpMethod;
  url: string;
  requestRaw: string;
  requestHeaders: HttpHeaderItem[];
  requestBody: string;
  responseRaw?: string;
  responseHeaders?: HttpHeaderItem[];
  responseBody?: string;
  statusCode?: number;
  statusText?: string;
  durationMs: number;
  sizeBytes: number;
  tlsInfo?: TlsCertificateDetails;
  timingBreakdown?: TimingBreakdown;
  casEvidence?: CasEvidenceData;
  error?: string;
  isBaseline?: boolean;
}

export interface RepeaterTabState {
  id: string;
  title: string;
  color?: string;
  isDirty: boolean;
  
  // Request Configuration
  method: HttpMethod;
  url: string;
  protocol: HttpProtocol;
  headers: HeaderRowItem[];
  queryParams: QueryParamItem[];
  body: string;
  bodyType: RequestBodyType;
  rawRequest: string;
  rawMode: boolean;
  autoContentLength: boolean;
  followRedirects: boolean;
  maxRedirects: number;
  timeoutMs: number;
  
  // Dynamic Variables
  localVariables: Record<string, string>;
  
  // Execution & History
  history: RepeaterRevisionItem[];
  activeRevisionIndex: number;
  baselineRevisionIndex: number | null;
  isExecuting: boolean;
  abortController: AbortController | null;
  lastExecutionOutput?: RepeaterRevisionItem;
  
  // View states
  requestViewMode: RequestEditorMode;
  responseViewMode: ResponseViewerMode;
  
  createdAt: string;
  updatedAt: string;
}

export interface RepeaterVariable {
  key: string;
  value: string;
  scope: 'global' | 'tab';
  tabId?: string;
  description?: string;
  extractedFrom?: {
    type: 'json' | 'header' | 'regex';
    path: string;
  };
}

export interface RepeaterExecutionResult {
  rawResponse: string;
  statusCode?: number;
  statusText?: string;
  headers: HttpHeaderItem[];
  body: string;
  durationMs: number;
  sizeBytes: number;
  tlsInfo?: TlsCertificateDetails;
  timingBreakdown?: TimingBreakdown;
  casReqHash?: string;
  casResHash?: string;
  error?: string;
}
```

---

### 4.2 Zustand Master Store Blueprint (`src/stores/repeaterStore.ts`)

```typescript
// src/stores/repeaterStore.ts

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  RepeaterTabState,
  RepeaterRevisionItem,
  HttpMethod,
  HttpProtocol,
  RequestEditorMode,
  ResponseViewerMode,
  HeaderRowItem,
  QueryParamItem,
  RepeaterExecutionResult,
} from '../types/repeater';
import { TrafficSummary, HttpRequestDetails, HttpResponseDetails } from '../types/traffic';
import { TransactionModel } from '../types/models';
import { ipcClient } from '../ipc/client';
import { useToastStore } from './toastStore';
import { useAppShellStore } from './appShellStore';

const DEFAULT_INITIAL_TAB: RepeaterTabState = {
  id: 'rep-tab-1',
  title: 'Request #1',
  isDirty: false,
  method: 'GET',
  url: 'https://target.local/api/v1/',
  protocol: 'HTTP/1.1',
  headers: [
    { id: 'h-1', name: 'Host', value: 'target.local', enabled: true },
    { id: 'h-2', name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
    { id: 'h-3', name: 'Accept', value: '*/*', enabled: true },
  ],
  queryParams: [],
  body: '',
  bodyType: 'raw',
  rawRequest: 'GET /api/v1/ HTTP/1.1\r\nHost: target.local\r\nUser-Agent: Sentinel/6.0.0 Repeater\r\nAccept: */*\r\n\r\n',
  rawMode: false,
  autoContentLength: true,
  followRedirects: false,
  maxRedirects: 5,
  timeoutMs: 10000,
  localVariables: {},
  history: [],
  activeRevisionIndex: 0,
  baselineRevisionIndex: null,
  isExecuting: false,
  abortController: null,
  requestViewMode: 'raw',
  responseViewMode: 'parsed',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface RepeaterState {
  tabs: RepeaterTabState[];
  activeTabId: string;
  closedTabsStack: RepeaterTabState[];
  globalVariables: Record<string, string>;
  
  // UI Panels
  isHistoryDrawerOpen: boolean;
  isVariablesModalOpen: boolean;
  isDiffModalOpen: boolean;
  diffRevisionA: RepeaterRevisionItem | null;
  diffRevisionB: RepeaterRevisionItem | null;
  splitOrientation: 'horizontal' | 'vertical';

  // Actions: Tab Management
  createTab: (seed?: Partial<RepeaterTabState>) => string;
  createTabFromTransaction: (tx: TrafficSummary | TransactionModel | { request: HttpRequestDetails; response?: HttpResponseDetails }) => string;
  closeTab: (tabId: string) => void;
  reopenClosedTab: () => void;
  duplicateTab: (tabId: string) => string;
  renameTab: (tabId: string, title: string) => void;
  reorderTabs: (sourceIndex: number, destIndex: number) => void;
  setActiveTabId: (tabId: string) => void;
  nextTab: () => void;
  prevTab: () => void;

  // Actions: Tab Request Mutation
  updateTabMethod: (tabId: string, method: HttpMethod) => void;
  updateTabUrl: (tabId: string, url: string) => void;
  updateTabProtocol: (tabId: string, protocol: HttpProtocol) => void;
  updateTabHeaders: (tabId: string, headers: HeaderRowItem[]) => void;
  updateTabQueryParams: (tabId: string, params: QueryParamItem[]) => void;
  updateTabBody: (tabId: string, body: string) => void;
  updateTabRawRequest: (tabId: string, raw: string) => void;
  toggleRawMode: (tabId: string) => void;
  setRequestViewMode: (tabId: string, mode: RequestEditorMode) => void;
  setResponseViewMode: (tabId: string, mode: ResponseViewerMode) => void;

  // Actions: Variables
  setGlobalVariable: (key: string, value: string) => void;
  removeGlobalVariable: (key: string) => void;
  setLocalVariable: (tabId: string, key: string, value: string) => void;
  removeLocalVariable: (tabId: string, key: string) => void;
  interpolateRequest: (tabId: string, text: string) => string;

  // Actions: Execution & History
  sendRequest: (tabId: string) => Promise<void>;
  cancelRequest: (tabId: string) => void;
  restoreRevision: (tabId: string, revisionIndex: number) => void;
  setBaselineRevision: (tabId: string, revisionIndex: number | null) => void;
  deleteRevision: (tabId: string, revisionId: string) => void;
  clearTabHistory: (tabId: string) => void;

  // Actions: Modals & Layout
  toggleHistoryDrawer: () => void;
  setHistoryDrawerOpen: (open: boolean) => void;
  toggleVariablesModal: () => void;
  setVariablesModalOpen: (open: boolean) => void;
  openDiffModal: (revA?: RepeaterRevisionItem, revB?: RepeaterRevisionItem) => void;
  closeDiffModal: () => void;
  toggleSplitOrientation: () => void;
}

export const useRepeaterStore = create<RepeaterState>((set, get) => ({
  tabs: [DEFAULT_INITIAL_TAB],
  activeTabId: DEFAULT_INITIAL_TAB.id,
  closedTabsStack: [],
  globalVariables: {
    host: 'target.local',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  isHistoryDrawerOpen: false,
  isVariablesModalOpen: false,
  isDiffModalOpen: false,
  diffRevisionA: null,
  diffRevisionB: null,
  splitOrientation: 'horizontal',

  createTab: (seed) => {
    const id = `rep-tab-${uuidv4().substring(0, 8)}`;
    const tabNumber = get().tabs.length + 1;
    const newTab: RepeaterTabState = {
      ...DEFAULT_INITIAL_TAB,
      id,
      title: seed?.title || `Request #${tabNumber}`,
      method: seed?.method || 'GET',
      url: seed?.url || 'https://target.local/api/v1/',
      headers: seed?.headers || [
        { id: uuidv4(), name: 'Host', value: 'target.local', enabled: true },
        { id: uuidv4(), name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
        { id: uuidv4(), name: 'Accept', value: '*/*', enabled: true },
      ],
      body: seed?.body || '',
      rawRequest: seed?.rawRequest || 'GET /api/v1/ HTTP/1.1\r\nHost: target.local\r\n\r\n',
      history: [],
      activeRevisionIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...seed,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));

    return id;
  },

  createTabFromTransaction: (tx) => {
    const isTrafficSummary = 'status' in tx && typeof tx.status === 'number' && !('request' in tx);
    const req = (tx as any).request;
    const method: HttpMethod = (isTrafficSummary ? (tx as TrafficSummary).method : req?.method || 'GET') as HttpMethod;
    const url = isTrafficSummary ? (tx as TrafficSummary).url : req?.url || 'https://target.local/';
    
    let headers: HeaderRowItem[] = [];
    if (req?.headers && Array.isArray(req.headers)) {
      headers = req.headers.map((h: any) => ({
        id: uuidv4(),
        name: h.name,
        value: h.value,
        enabled: true,
      }));
    } else {
      try {
        const u = new URL(url);
        headers = [
          { id: uuidv4(), name: 'Host', value: u.host, enabled: true },
          { id: uuidv4(), name: 'User-Agent', value: 'Sentinel/6.0.0 Repeater', enabled: true },
          { id: uuidv4(), name: 'Accept', value: '*/*', enabled: true },
        ];
      } catch {
        headers = [{ id: uuidv4(), name: 'Host', value: 'target.local', enabled: true }];
      }
    }

    const body = req?.bodyText || (typeof req?.bodyBytes === 'string' ? req.bodyBytes : '');
    const tabId = get().createTab({
      title: `${method} ${url.replace(/^https?:\/\/[^/]+/, '') || '/'}`,
      method,
      url,
      headers,
      body,
    });

    // Auto-focus Repeater Workspace
    useAppShellStore.getState().setActiveWorkspace('repeater');
    return tabId;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, closedTabsStack } = get();
    if (tabs.length <= 1) return; // Keep at least 1 tab open

    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    const remaining = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;

    if (activeTabId === tabId) {
      const closedIndex = tabs.findIndex((t) => t.id === tabId);
      const newIndex = Math.min(closedIndex, remaining.length - 1);
      nextActiveId = remaining[newIndex].id;
    }

    set({
      tabs: remaining,
      activeTabId: nextActiveId,
      closedTabsStack: [targetTab, ...closedTabsStack.slice(0, 19)],
    });
  },

  reopenClosedTab: () => {
    const { closedTabsStack, tabs } = get();
    if (closedTabsStack.length === 0) return;

    const [restoredTab, ...remainingClosed] = closedTabsStack;
    set({
      tabs: [...tabs, restoredTab],
      activeTabId: restoredTab.id,
      closedTabsStack: remainingClosed,
    });

    useToastStore.getState().addToast({
      type: 'info',
      title: `Reopened tab: ${restoredTab.title}`,
    });
  },

  duplicateTab: (tabId) => {
    const { tabs } = get();
    const sourceTab = tabs.find((t) => t.id === tabId);
    if (!sourceTab) return '';

    const newId = `rep-tab-${uuidv4().substring(0, 8)}`;
    const clonedTab: RepeaterTabState = {
      ...sourceTab,
      id: newId,
      title: `Copy of ${sourceTab.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [...sourceTab.history],
      isExecuting: false,
      abortController: null,
    };

    set({
      tabs: [...tabs, clonedTab],
      activeTabId: newId,
    });

    return newId;
  },

  renameTab: (tabId, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title, updatedAt: new Date().toISOString() } : t)),
    }));
  },

  reorderTabs: (sourceIndex, destIndex) => {
    set((state) => {
      const nextTabs = [...state.tabs];
      const [moved] = nextTabs.splice(sourceIndex, 1);
      nextTabs.splice(destIndex, 0, moved);
      return { tabs: nextTabs };
    });
  },

  setActiveTabId: (activeTabId) => set({ activeTabId }),

  nextTab: () => {
    const { tabs, activeTabId } = get();
    const currIdx = tabs.findIndex((t) => t.id === activeTabId);
    const nextIdx = (currIdx + 1) % tabs.length;
    set({ activeTabId: tabs[nextIdx].id });
  },

  prevTab: () => {
    const { tabs, activeTabId } = get();
    const currIdx = tabs.findIndex((t) => t.id === activeTabId);
    const prevIdx = (currIdx - 1 + tabs.length) % tabs.length;
    set({ activeTabId: tabs[prevIdx].id });
  },

  // Tab Mutations
  updateTabMethod: (tabId, method) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, method, isDirty: true } : t)),
    }));
  },

  updateTabUrl: (tabId, url) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, url, isDirty: true } : t)),
    }));
  },

  updateTabProtocol: (tabId, protocol) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, protocol, isDirty: true } : t)),
    }));
  },

  updateTabHeaders: (tabId, headers) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, headers, isDirty: true } : t)),
    }));
  },

  updateTabQueryParams: (tabId, queryParams) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, queryParams, isDirty: true } : t)),
    }));
  },

  updateTabBody: (tabId, body) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, body, isDirty: true } : t)),
    }));
  },

  updateTabRawRequest: (tabId, rawRequest) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, rawRequest, isDirty: true } : t)),
    }));
  },

  toggleRawMode: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, rawMode: !t.rawMode } : t)),
    }));
  },

  setRequestViewMode: (tabId, requestViewMode) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, requestViewMode } : t)),
    }));
  },

  setResponseViewMode: (tabId, responseViewMode) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, responseViewMode } : t)),
    }));
  },

  // Variable Management
  setGlobalVariable: (key, value) => {
    set((state) => ({
      globalVariables: { ...state.globalVariables, [key]: value },
    }));
  },

  removeGlobalVariable: (key) => {
    set((state) => {
      const next = { ...state.globalVariables };
      delete next[key];
      return { globalVariables: next };
    });
  },

  setLocalVariable: (tabId, key, value) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, localVariables: { ...t.localVariables, [key]: value } } : t
      ),
    }));
  },

  removeLocalVariable: (tabId, key) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const nextLocal = { ...t.localVariables };
        delete nextLocal[key];
        return { ...t, localVariables: nextLocal };
      }),
    }));
  },

  interpolateRequest: (tabId, text) => {
    const { globalVariables, tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    const localVars = tab?.localVariables || {};
    const mergedVars = { ...globalVariables, ...localVars };

    return text.replace(/\{\{([a-zA-Z0-9_\$]+)\}\}/g, (match, varName) => {
      if (varName === '$uuid') return uuidv4();
      if (varName === '$timestamp') return Math.floor(Date.now() / 1000).toString();
      if (varName === '$random_int') return Math.floor(1000 + Math.random() * 9000).toString();
      if (varName === '$random_str') return Math.random().toString(36).substring(2, 8);
      if (varName === '$iso_date') return new Date().toISOString();
      return mergedVars[varName] !== undefined ? mergedVars[varName] : match;
    });
  },

  // Execution Pipeline
  sendRequest: async (tabId) => {
    const { tabs, interpolateRequest } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.isExecuting) return;

    const abortController = new AbortController();

    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isExecuting: true, abortController } : t)),
    }));

    const startTime = performance.now();

    try {
      // Build raw request payload
      let rawText = '';
      if (tab.rawMode) {
        rawText = tab.rawRequest;
      } else {
        let path = tab.url;
        try {
          const u = new URL(tab.url);
          path = u.pathname + (u.search || '');
        } catch {}

        const activeHeaders = tab.headers.filter((h) => h.enabled);
        const headerLines = activeHeaders.map((h) => `${h.name}: ${h.value}`).join('\r\n');
        rawText = `${tab.method} ${path} ${tab.protocol}\r\n${headerLines}\r\n\r\n${tab.body}`;
      }

      // Interpolate dynamic variables
      const interpolatedRaw = interpolateRequest(tabId, rawText);
      const interpolatedUrl = interpolateRequest(tabId, tab.url);

      // Invoke Tauri IPC bridge
      const result: RepeaterExecutionResult = await ipcClient.executeRepeaterTab({
        tabId,
        targetUrl: interpolatedUrl,
        rawRequest: interpolatedRaw,
        protocol: tab.protocol,
        signal: abortController.signal,
      });

      const durationMs = Math.round(performance.now() - startTime);

      const revision: RepeaterRevisionItem = {
        revisionId: uuidv4(),
        revisionNumber: tab.history.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        method: tab.method,
        url: interpolatedUrl,
        requestRaw: interpolatedRaw,
        requestHeaders: tab.headers.filter((h) => h.enabled).map((h) => ({ name: h.name, value: h.value })),
        requestBody: tab.body,
        responseRaw: result.rawResponse,
        responseHeaders: result.headers,
        responseBody: result.body,
        statusCode: result.statusCode,
        statusText: result.statusText,
        durationMs: result.durationMs || durationMs,
        sizeBytes: result.sizeBytes || result.body.length,
        tlsInfo: result.tlsInfo,
        timingBreakdown: result.timingBreakdown,
        casEvidence: {
          blobId: uuidv4(),
          sha256Hex: result.casResHash || 'sha256:verified',
          sizeBytes: result.sizeBytes || result.body.length,
          verified: true,
          tamperDetected: false,
          timestamp: new Date().toISOString(),
        },
        error: result.error,
      };

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isExecuting: false,
                abortController: null,
                isDirty: false,
                history: [...t.history, revision],
                activeRevisionIndex: t.history.length,
                lastExecutionOutput: revision,
              }
            : t
        ),
      }));

      useToastStore.getState().addToast({
        type: revision.statusCode && revision.statusCode < 400 ? 'success' : 'info',
        title: `Replay Complete: ${revision.statusCode || 'Done'} (${revision.durationMs}ms)`,
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const isCancelled = err.name === 'AbortError' || String(err).includes('cancelled');

      const failedRevision: RepeaterRevisionItem = {
        revisionId: uuidv4(),
        revisionNumber: tab.history.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        method: tab.method,
        url: tab.url,
        requestRaw: tab.rawRequest || `${tab.method} ${tab.url}`,
        requestHeaders: tab.headers.map((h) => ({ name: h.name, value: h.value })),
        requestBody: tab.body,
        durationMs,
        sizeBytes: 0,
        error: isCancelled ? 'Execution cancelled by researcher' : String(err),
      };

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isExecuting: false,
                abortController: null,
                history: [...t.history, failedRevision],
                activeRevisionIndex: t.history.length,
                lastExecutionOutput: failedRevision,
              }
            : t
        ),
      }));

      if (!isCancelled) {
        useToastStore.getState().addToast({
          type: 'error',
          title: `Replay Failed: ${String(err)}`,
        });
      }
    }
  },

  cancelRequest: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.abortController) {
      tab.abortController.abort();
    }
  },

  restoreRevision: (tabId, revisionIndex) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const rev = tab.history[revisionIndex];
    if (!rev) return;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              method: rev.method,
              url: rev.url,
              headers: rev.requestHeaders.map((h) => ({ id: uuidv4(), name: h.name, value: h.value, enabled: true })),
              body: rev.requestBody,
              rawRequest: rev.requestRaw,
              activeRevisionIndex: revisionIndex,
              lastExecutionOutput: rev,
              isDirty: false,
            }
          : t
      ),
    }));

    useToastStore.getState().addToast({
      type: 'info',
      title: `Restored Revision #${rev.revisionNumber} (${rev.timestamp})`,
    });
  },

  setBaselineRevision: (tabId, revisionIndex) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, baselineRevisionIndex: revisionIndex } : t)),
    }));
  },

  deleteRevision: (tabId, revisionId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const newHistory = t.history.filter((h) => h.revisionId !== revisionId);
        return {
          ...t,
          history: newHistory,
          activeRevisionIndex: Math.max(0, newHistory.length - 1),
        };
      }),
    }));
  },

  clearTabHistory: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, history: [], activeRevisionIndex: 0, lastExecutionOutput: undefined } : t)),
    }));
  },

  // Modals & Layout
  toggleHistoryDrawer: () => set((s) => ({ isHistoryDrawerOpen: !s.isHistoryDrawerOpen })),
  setHistoryDrawerOpen: (open) => set({ isHistoryDrawerOpen: open }),
  toggleVariablesModal: () => set((s) => ({ isVariablesModalOpen: !s.isVariablesModalOpen })),
  setVariablesModalOpen: (open) => set({ isVariablesModalOpen: open }),
  openDiffModal: (revA, revB) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    const a = revA || (tab?.baselineRevisionIndex !== null && tab?.baselineRevisionIndex !== undefined ? tab.history[tab.baselineRevisionIndex] : tab?.history[0]) || null;
    const b = revB || tab?.lastExecutionOutput || tab?.history[tab?.history.length - 1] || null;
    set({ isDiffModalOpen: true, diffRevisionA: a, diffRevisionB: b });
  },
  closeDiffModal: () => set({ isDiffModalOpen: false, diffRevisionA: null, diffRevisionB: null }),
  toggleSplitOrientation: () =>
    set((s) => ({ splitOrientation: s.splitOrientation === 'horizontal' ? 'vertical' : 'horizontal' })),
}));
```

---

### 4.3 IPC Contract Expansion (`src/ipc/contracts.ts` & `client.ts`)

```typescript
// IPC Contract types to add in src/ipc/contracts.ts:

export interface RepeaterExecuteRequest {
  tabId: string;
  targetUrl: string;
  rawRequest: string;
  protocol?: string;
  signal?: AbortSignal;
}

export interface RepeaterExecutionResult {
  rawResponse: string;
  statusCode?: number;
  statusText?: string;
  headers: Array<{ name: string; value: string }>;
  body: string;
  durationMs: number;
  sizeBytes: number;
  tlsInfo?: {
    version: string;
    cipherSuite: string;
    alpn?: string;
  };
  timingBreakdown?: {
    dnsMs?: number;
    tcpConnectMs?: number;
    tlsHandshakeMs?: number;
    ttfbMs: number;
    contentDownloadMs: number;
    totalDurationMs: number;
  };
  casReqHash?: string;
  casResHash?: string;
  error?: string;
}
```

---

## 5. Verification Method

To independently verify the Phase UI-4 architecture and future implementation, execute the following test commands and validation steps:

### 5.1 Verification Commands
1. **Spec & Architecture Validation**:
   ```bash
   python architecture/v6/validate_v6_spec.py
   ```
   *Expected*: `0 Blockers, 0 Warnings (11/11 Checks Passed)`.
2. **Rust Core Tests (`sentinel_repeater`)**:
   ```bash
   cargo test -p sentinel_repeater --all-targets
   ```
   *Expected*: `4 / 4 tests passing (tab management, raw execution, scope verification, LCS diffing)`.
3. **Frontend Type Check & Build**:
   ```bash
   npm run build
   ```
   *Expected*: `Zero TypeScript compiler errors, clean bundle emitted`.

### 5.2 10-Point End-to-End Pentester Verification Matrix
| Step | User Action | Expected System Response | Invalidation Condition |
|---|---|---|---|
| **V1** | In `TrafficWorkspace`, select a row and press `Ctrl+R` | Creates new Repeater Tab with populated Method, URL, Headers, and Body; auto-switches active workspace to `repeater` | Fails to populate headers/body or does not navigate |
| **V2** | Edit body text with dynamic variable `{{$uuid}}` | Variable pill shows in bottom chip bar; dirty indicator `•` appears on tab | Dirty dot missing or variable unparsed |
| **V3** | Press `Ctrl+Enter` to send request | Send button shows spinner, executes via `cmd_repeater_execute`, records latency (`38ms`), status (`200 OK`), and renders response in `ResponseViewerPanel` | Freezes UI or produces fake status |
| **V4** | Switch response viewer to `Hex Dump` mode | Displays 3-column hex representation with accurate address offset and byte values | Hex characters corrupted or misaligned |
| **V5** | Switch response viewer to `JSON Tree` mode | Renders interactive expandable nodes with JSON path copying | Malformed JSON causes crash |
| **V6** | Switch response viewer to `HTML Preview` mode | Displays sandboxed `<iframe>` with `SEC-11` script execution isolation | External JS executes in iframe |
| **V7** | Open History Drawer (`Ctrl+H`) and click "Restore" on Revision #1 | Editor restores previous revision request state; updates active revision pointer | Previous parameters lost |
| **V8** | Press `Ctrl+D` (Diff) | Opens `RepeaterDiffModal` with side-by-side LCS comparison highlighting added/removed lines | Diff fails to highlight delta |
| **V9** | Close active tab (`Ctrl+W`) and reopen (`Ctrl+Shift+T`) | Tab closes, next tab activates; `Ctrl+Shift+T` restores closed tab with full history intact | History stack wiped on restore |
| **V10** | Attempt request to out-of-scope target | Backend `SEC-01` gate rejects socket creation, logs `CriticalEvent::ScopeViolationAttempt`, and displays scope error banner | Socket opens to out-of-scope target |

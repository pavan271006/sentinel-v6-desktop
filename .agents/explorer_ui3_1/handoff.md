# Phase UI-3: Traffic, History, HTTPQL, Inspector & Diff — Data Layer Architectural Specification

> **Author**: Explorer `explorer_ui3_1` (Traffic Store & Data Layer Explorer)  
> **Date**: 2026-08-17  
> **Target Milestone**: Phase UI-3 (Traffic, History, HTTPQL, Inspector & Diff)  
> **Repository**: `c:\Users\Legion 5 pro\Desktop\cyber sec`  
> **Backend Truth Root**: `sentinel_core` (28 Crates, 245/245 Passing Tests)  
> **Artifact Path**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui3_1\handoff.md`  

---

## 1. Observation

Direct, verified observations from the codebase, contracts, schemas, and implementations:

### 1.1 Store & Frontend State
- **`src/stores/` Inspection**:
  - `src/stores/trafficStore.ts` does **not exist**.
  - `src/stores/inspectorStore.ts` does **not exist**.
  - `src/stores/eventBusStore.ts` (lines 19-25, 39-40, 84-92) contains a rudimentary 500-item FIFO array `recentTraffic: UiTrafficEvent[]` bounded by `MAX_RING_BUFFER_SIZE = 500`. It does not support SQLite pagination, index caching, filtering, detail loading, or multi-selection.
  - `src/workspaces/TrafficWorkspaceView.tsx` (lines 17-86, 95-107) instantiates a local dummy dataset via `generateSampleTransactions(500)` inside a React `useMemo` hook, relying on component-local `useState` for search and selection.
- **`src/types/models.ts` & `src/types/ipc.ts`**:
  - `models.ts` (lines 31-44) defines `TransactionModel` containing optional full `request` and `response` trees:
    ```typescript
    export interface TransactionModel {
      id: string;
      method: string;
      url: string;
      status: number;
      durationMs: number;
      sizeBytes: number;
      inScope: boolean;
      mimeType: string;
      timestamp: string;
      tags: string[];
      request?: HttpRequestData;
      response?: HttpResponseData;
    }
    ```
  - `ipc.ts` (lines 36-45) defines the canonical Protobuf event `UiTrafficEvent`:
    ```typescript
    export interface UiTrafficEvent {
      transactionId: string;
      timestamp: ProtoTimestamp;
      method: string;
      uri: string;
      status: number;
      durationMs: number;
      inScope: boolean;
      tags: string[];
    }
    ```
- **`src/design-system/` Components Ready for Traffic UI**:
  - `VirtualizedTable.tsx` (369 lines): TanStack Virtual-style virtual table with sticky headers, column resizing, sorting, row selection, multi-selection (Ctrl/Cmd click), and keyboard-first vim navigation (`j`, `k`, `g g`, `G`, `Space`, `Enter`).
  - `RawByteInspector.tsx` (242 lines): Hex dump + ASCII decoded split viewer with offset column, byte selection, and raw string view.
  - `StructuredInspector.tsx` (249 lines): Interactive collapsible JSON/object tree view with search filter, path copy, and depth control.
  - `DiffViewer.tsx` (246 lines): LCS line-by-line and side-by-side diffing with added/removed line counters and similarity scoring.

### 1.2 Backend Rust Engine Truth & Contracts
- **`sentinel_core/crates/sentinel_proxy`**:
  - `recorder.rs` (lines 27-75, 80-153): Implements `PersistenceRecorder` running a bounded background task (`mpsc::channel(1024)`). On every captured proxy transaction, it dual-writes:
    1. Raw request and response byte arrays to SHA-256 Content-Addressed Storage (`store.cas().put(&bytes)` — `SEC-07` / `SEC-10`).
    2. Structured record to SQLite `transactions` table.
    3. Emits `SentinelEvent::ObservationCreated(tx_id)` on `sentinel_bus` broadcast channel (`SEC-12`).
- **`sentinel_core/crates/sentinel_storage`**:
  - `repository/transaction.rs` (lines 52-137): `TransactionRepository` exposes `insert`, `get(id: Uuid)`, `list(limit: i64, offset: i64)`, `count()`, `delete(id: Uuid)` querying the SQLite `transactions` table.
  - `architecture/v6/V6_SQLITE_SCHEMA.sql` (lines 93-116):
    ```sql
    CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        protocol TEXT NOT NULL,
        stream_id INTEGER,
        req_method TEXT NOT NULL,
        req_uri TEXT NOT NULL,
        req_blob_id TEXT NOT NULL,
        req_normalized_text TEXT NOT NULL,
        res_status INTEGER,
        res_blob_id TEXT,
        res_normalized_text TEXT,
        timing_ms INTEGER NOT NULL,
        tls_cipher TEXT,
        version INTEGER NOT NULL,
        provenance TEXT NOT NULL,
        lifecycle TEXT NOT NULL,
        scope_id TEXT,
        FOREIGN KEY (scope_id) REFERENCES scopes(id) ON DELETE SET NULL
    );
    CREATE INDEX idx_transactions_uri ON transactions(req_uri);
    CREATE INDEX idx_transactions_scope ON transactions(scope_id);
    ```
- **`sentinel_core/crates/sentinel_httpql`**:
  - Full PEG grammar parser (`V6_HTTPQL_GRAMMAR.pest`), AST model (`ast.rs`), in-memory stream `Evaluator` (`evaluator.rs`), and SQL WHERE compiler `SqlCompiler` (`compiler.rs`).
  - Supports field operators: `req.method`, `req.url`, `req.path`, `req.host`, `req.header.<name>`, `req.body`, `res.status`, `res.header.<name>`, `res.body`, `res.time_ms`, `scope.status`, `source`.
  - Supports operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `not_contains`, `starts_with`, `ends_with`, `matches` (regex), `in [...]`.
- **`sentinel_core/crates/sentinel_repeater`**:
  - `diff.rs` (lines 5-38, 41-157): `ResponseDiff` computes status delta, duration delta, header diffs (`HeaderDiffItem`), and body LCS line diffs (`LineDiff`).
- **`src-tauri/src/commands.rs` & `src-tauri/src/main.rs`**:
  - Currently exposes Project & Scope commands (`cmd_project_*`, `cmd_scope_*`, `cmd_test_scope_uri`, `cmd_productivity_search`).
  - Traffic endpoints (`cmd_traffic_get_page`, `cmd_traffic_get_details`, `cmd_traffic_get_raw_blob`, `cmd_traffic_diff`, `cmd_httpql_validate`) are specified in `SENTINEL_V6_UI_FEATURE_MANIFEST.md` (§ 8.1) but need exposure in Tauri commands.

---

## 2. Logic Chain

1. **Memory & Stability Logic (Preventing Browser OOM at 100K-1M Rows)**:
   - *Observation*: 1M transactions with full headers/bodies loaded into JS heap would exceed 2–5 GB of memory, causing garbage collector locks and browser crashes.
   - *Deduction*: We must enforce a **3-Tier Data Architecture**:
     - **Tier 1 (Hot Sparse Summary Window)**: A flat, compact scalar summary array stored in memory or typed ArrayBuffer (`id`, `timestamp`, `method`, `url`, `status`, `durationMs`, `sizeBytes`, `inScope`, `tags`). Per-row overhead is ~120 bytes; 100,000 summaries = ~12 MB; 1,000,000 summaries = ~120 MB.
     - **Tier 2 (Cold Detail Fetching with LRU Cache)**: Full request/response raw bytes, header arrays, and CAS blobs are only fetched on-demand when an item is selected or diffed. The detail cache is strictly capped (e.g. max 50 items) with LRU eviction.
     - **Tier 3 (Circular Ingestion Ring Buffer + SQLite Deep Paging)**: Live streaming appends to a 50,000-item live viewport buffer. Historical search across older records seamlessly pages from SQLite via `cmd_traffic_get_page(query, offset, limit)`.

2. **Event Streaming & Ingestion Logic (`stream_traffic_events`)**:
   - *Observation*: Active fuzzing or spidering can generate thousands of transactions per second. Re-rendering React on every event would cause massive frame drops and UI freezes.
   - *Deduction*:
     - Micro-batch incoming `UiTrafficEvent` bursts via a 50ms / animation frame buffer in the store.
     - Pre-filter incoming events against active HTTPQL queries (or worker evaluation) before inserting into the virtual table index.
     - Maintain an `autoScroll: boolean` flag so users inspecting past transactions are not forcefully jerked to the bottom.

3. **HTTPQL Evaluation & Off-Thread Processing Logic**:
   - *Observation*: Evaluating complex HTTPQL ASTs with regexes and substring matching across 100K–1M items on the React main thread would block user typing, scrolling, and panel resizing.
   - *Deduction*:
     - Dedicated Web Worker (`httpql.worker.ts`) manages query parsing, AST generation, and index filtering.
     - The worker maintains a mirror of the summary index and returns matching row indices as a `Uint32Array` for zero-copy Transferable transfer to the UI thread.
     - Rust `sentinel_httpql` remains authoritative for backend SQLite queries (`cmd_traffic_get_page`) and query validation (`cmd_httpql_validate`).

4. **Inspector & Diff State Logic**:
   - *Observation*: Pentesting workflows require fast switching between Parsed Headers, Raw Text, Hex Dump, Decoded Body, and side-by-side Response Diff.
   - *Deduction*:
     - `inspectorStore.ts` isolates active transaction inspection state (`activeTransactionId`, `cachedDetails`, `activeTab: 'request' | 'response' | 'diff'`, `subViewMode: 'parsed' | 'hex' | 'raw'`, `rawBlobsCache`).
     - Selection model supports single-selection (`selectedId`), multi-selection (`selectedIds: Set<string>`), and dedicated diff comparison pair (`diffPair: [string, string] | null`).

---

## 3. Complete Architectural Specification for `trafficStore` & Data Layer

### 3.1 Data Structures & Type Definitions (`src/types/traffic.ts`)

```typescript
// src/types/traffic.ts
import { ProtoTimestamp } from './ipc';

/**
 * Compact scalar summary item for high-density virtual table and worker indexing.
 * Memory footprint: ~120 bytes. 100,000 items = ~12MB.
 */
export interface TrafficSummary {
  id: string;
  seqNumber: number;
  timestamp: string;
  timestampMs: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  inScope: boolean;
  mimeType: string;
  tags: string[];
  hasFinding?: boolean;
}

/**
 * Full transaction detail fetched lazily on demand.
 */
export interface HttpHeaderItem {
  name: string;
  value: string;
}

export interface HttpRequestDetails {
  id: string;
  method: string;
  url: string;
  protocol: string;
  headers: HttpHeaderItem[];
  bodyBlobId?: string;
  bodyText?: string;
  rawBlobId?: string;
  rawText?: string;
  inScope: boolean;
}

export interface HttpResponseDetails {
  id: string;
  statusCode: number;
  statusText: string;
  headers: HttpHeaderItem[];
  bodyBlobId?: string;
  bodyText?: string;
  rawBlobId?: string;
  rawText?: string;
  durationMs: number;
  tlsVersion?: string;
  cipherSuite?: string;
}

export interface TransactionDetails {
  id: string;
  timestamp: string;
  timingMs: number;
  provenance: 'Proxy' | 'Scanner' | 'Fuzzer' | 'Repeater' | 'Manual' | 'AI';
  scopeId?: string;
  request: HttpRequestDetails;
  response?: HttpResponseDetails;
}

/**
 * HTTPQL AST & Validation Types
 */
export interface HttpqlValidationResult {
  valid: boolean;
  error?: {
    message: string;
    position?: number;
    token?: string;
  };
  compiledSqlWhere?: string;
}

export type QuickFilterPreset = 'all' | 'in_scope' | 'errors_only' | 'methods_mutating' | 'media_json' | 'media_html';
```

---

### 3.2 `trafficStore.ts` Architecture & State Interface

```typescript
// src/stores/trafficStore.ts
import { create } from 'zustand';
import { TrafficSummary, QuickFilterPreset, HttpqlValidationResult } from '../types/traffic';
import { UiTrafficEvent } from '../types/ipc';

export interface TrafficState {
  // Core Data Buffers
  transactions: TrafficSummary[];
  transactionMap: Map<string, TrafficSummary>;
  filteredIndices: number[] | null; // null means all transactions shown
  totalCount: number;

  // Configuration & Limits
  maxRingBufferSize: number; // default: 50,000 (configurable up to 100,000)
  autoScroll: boolean;
  isStreaming: boolean;

  // Filter & HTTPQL Query State
  httpqlQuery: string;
  httpqlValidation: HttpqlValidationResult;
  activePreset: QuickFilterPreset;
  quickFilterScopeOnly: boolean;
  quickFilterErrorsOnly: boolean;

  // Selection & Diff State
  selectedId: string | null;
  selectedIds: Set<string>;
  diffPair: [string, string] | null; // [TxA, TxB]

  // Actions
  ingestStreamEvent: (event: UiTrafficEvent) => void;
  ingestBatchEvents: (events: UiTrafficEvent[]) => void;
  setHttpqlQuery: (query: string) => Promise<void>;
  setQuickPreset: (preset: QuickFilterPreset) => void;
  toggleScopeOnly: () => void;
  toggleErrorsOnly: () => void;
  setSelectedId: (id: string | null) => void;
  toggleSelectId: (id: string, isMulti: boolean) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  setDiffPair: (txAId: string, txBId: string) => void;
  clearTraffic: () => Promise<void>;
  setAutoScroll: (enabled: boolean) => void;
  fetchHistoricalPage: (offset: number, limit: number) => Promise<void>;
}
```

---

### 3.3 `inspectorStore.ts` Architecture & State Interface

```typescript
// src/stores/inspectorStore.ts
import { create } from 'zustand';
import { TransactionDetails } from '../types/traffic';
import { ResponseDiffResult } from '../types/models';

export type InspectorTab = 'request' | 'response' | 'diff' | 'tls_scope';
export type InspectorSubView = 'parsed' | 'hex' | 'raw' | 'preview';

export interface InspectorState {
  // Active Selected Transaction Details
  activeTransactionId: string | null;
  activeDetails: TransactionDetails | null;
  isLoadingDetails: boolean;
  detailsError: string | null;

  // LRU In-Memory Details Cache (Bounded to 50 items to prevent OOM)
  detailsCache: Map<string, TransactionDetails>;

  // Raw CAS Blobs Cache (Blob UUID -> Uint8Array)
  rawBlobCache: Map<string, Uint8Array>;

  // View Controls
  activeTab: InspectorTab;
  requestSubView: InspectorSubView;
  responseSubView: InspectorSubView;

  // Diff Cache
  diffResult: ResponseDiffResult | null;
  isLoadingDiff: boolean;

  // Actions
  loadTransactionDetails: (transactionId: string) => Promise<void>;
  loadRawBlob: (blobId: string) => Promise<Uint8Array | null>;
  loadDiff: (txAId: string, txBId: string) => Promise<void>;
  setActiveTab: (tab: InspectorTab) => void;
  setRequestSubView: (view: InspectorSubView) => void;
  setResponseSubView: (view: InspectorSubView) => void;
  clearCache: () => void;
}
```

---

### 3.4 Web Worker Offloading Specification (`httpql.worker.ts`)

```typescript
// src/workers/httpql.worker.ts
/**
 * Web Worker for Off-Main-Thread HTTPQL AST Parsing and Vectorized Index Filtering
 *
 * Incoming Messages:
 * 1. { type: 'INDEX_SYNC', data: TrafficSummary[] } -> Updates worker's internal mirror
 * 2. { type: 'EVALUATE_QUERY', query: string, preset?: string } -> Evaluates query over dataset
 * 3. { type: 'APPEND_ITEMS', items: TrafficSummary[] } -> Appends new stream items
 *
 * Outgoing Messages:
 * 1. { type: 'FILTER_COMPLETE', matchedIndices: Uint32Array, totalMatched: number, durationMs: number }
 * 2. { type: 'SYNTAX_ERROR', error: { message: string, position: number } }
 */

export interface WorkerFilterRequest {
  type: 'EVALUATE_QUERY';
  requestId: string;
  query: string;
  quickFilters: {
    scopeOnly?: boolean;
    errorsOnly?: boolean;
    preset?: QuickFilterPreset;
  };
}

export interface WorkerFilterResponse {
  type: 'FILTER_COMPLETE';
  requestId: string;
  matchedIndices: Uint32Array; // Transferable buffer for zero copy
  totalMatched: number;
  durationMs: number;
}
```

**Worker Execution Mechanism**:
1. Main thread dispatches query update.
2. Worker parses query string into lightweight AST (evaluating token hierarchy matching `V6_HTTPQL_GRAMMAR.pest`).
3. Worker runs a vectorized loop across its internal summaries array:
   - Bitwise fast checks: status range checks, method match via integer lookup tables, string substring checks.
   - Populates an output `Uint32Array` containing the absolute row indices that match the predicate.
4. Posts the buffer back using `postMessage(response, [response.matchedIndices.buffer])` with zero serialization overhead.
5. Virtual table consumes `matchedIndices` to map virtual row `i` -> `transactions[matchedIndices[i]]`.

---

### 3.5 Bounded Memory Controls & OOM Defense Architecture

To strictly prevent memory runaway under 1M events:

| Component | Policy | Bound Limit | Action on Overflow |
|---|---|---|---|
| **Live Viewport Ring Buffer** | Circular FIFO | 50,000 entries (approx. 6 MB) | Oldest events evicted from live array; available in SQLite backend |
| **Transaction Details Cache** | LRU (Least Recently Used) | 50 full transactions (approx. 5–10 MB) | Least recently accessed full request/response bodies pruned |
| **Raw CAS Blob Cache** | LRU | 20 blobs (max 20 MB) | Drop oldest byte buffers; re-fetched from Rust CAS on click |
| **Incoming Stream Throttle** | Time-sliced micro-batching | 50ms buffer / max 200 items/frame | Coalesce batches into single Zustand store notification |
| **Filtered Index Buffer** | Typed Array | `Uint32Array` (4 bytes * 100K = 400 KB) | Zero garbage collection pressure |

---

### 3.6 Real HTTPQL Querying & Search Features

1. **Syntax Auto-Completion & Tokenizer**:
   - Fields: `req.method`, `req.url`, `req.path`, `req.host`, `req.header.<name>`, `res.status`, `res.header.<name>`, `res.body`, `tx.duration`, `tx.in_scope`, `tags`.
   - Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `not_contains`, `starts_with`, `ends_with`, `matches` (regex), `in [...]`.
   - Logical Conjunctions: `AND`, `OR`, `NOT`, `&&`, `||`, `!`.
2. **Preset Quick Filter Buttons**:
   - `Scope Only`: Quick toggle adding `tx.in_scope == true`.
   - `Errors Only`: Quick toggle adding `res.status >= 400`.
   - `Mutating`: Filter for `req.method in ["POST", "PUT", "PATCH", "DELETE"]`.
   - `JSON APIs`: Filter for `res.header.Content-Type contains "json"`.
3. **Query History & Error Popover**:
   - Persist last 20 successful queries in local storage.
   - Show red squiggly / inline error popover on syntax errors with exact character offset from parser.

---

### 3.7 Selection, Active Transaction & Diff Pair Interaction Model

1. **Single Click**: Sets `selectedId = row.id`. Triggers `inspectorStore.loadTransactionDetails(row.id)`. Contextual Right Inspector updates instantly.
2. **Ctrl / Cmd + Click**: Toggles row in `selectedIds: Set<string>`.
3. **Shift + Click**: Selects range from previous focused index to clicked index.
4. **Vim Keys (`j`/`k`/`g g`/`G`)**: Navigates active row, updates `selectedId`, keeps inspector synchronized.
5. **Space Bar**: Toggles selection checkbox on focused row.
6. **Diff Pair Selection (`Ctrl+D` / Context Menu)**:
   - If exactly 2 rows selected -> sets `diffPair = [txA, txB]`.
   - Triggers `cmd_traffic_diff(txA, txB)` (or `inspectorStore.loadDiff`).
   - Opens `TransactionDiffModal` or switches Inspector to `Diff View` tab.
7. **Send to Workspace Hotkeys**:
   - `Ctrl+R`: Send active transaction to Repeater (`cmd_repeater_create_tab(activeId)`).
   - `Ctrl+Shift+S`: Send active transaction to Scanner.
   - `Ctrl+Shift+F`: Send active transaction to Fuzzer.

---

## 4. Caveats

1. **Web Worker Environment Constraints**: In non-browser / headless Node.js test environments (such as certain Vitest runners without worker threads enabled), the worker bridge must feature a synchronous fallback evaluator to guarantee 100% unit test pass rates.
2. **SQLite vs Live Memory Query Sync**: Very complex deep full-body regex searches on un-cached historical data (records beyond the 50,000 live ring buffer) must be dispatched to Rust backend `cmd_traffic_get_page(query, offset, limit)` using `sentinel_httpql::SqlCompiler`, while live viewport filtering executes in the client Web Worker.
3. **Large Raw CAS Payloads**: Payloads >10 MB (e.g. large file downloads) are truncated in the UI text viewer with a "Download Raw Payload" button to prevent Monaco/CodeMirror DOM freezes.

---

## 5. Conclusion

- **State Assessment**: The backend infrastructure (`sentinel_proxy`, `sentinel_storage`, `sentinel_httpql`, `sentinel_repeater`) is 100% complete and tested. The frontend workspace currently uses a temporary 500-item mock generator and lacks dedicated Zustand domain stores.
- **Architectural Solution**: Implementing `trafficStore.ts`, `inspectorStore.ts`, and `httpql.worker.ts` with a 3-tier memory model (hot scalar summaries + LRU detail cache + SQLite pagination) fully satisfies the 1M-dataset stability requirement (`SEC-12`, `R4`), eliminates browser OOM risks, and enables sub-millisecond filtering with real HTTPQL grammar.

---

## 6. Verification Method

### 6.1 Independent Code & File Verification
1. Inspect `src/types/traffic.ts` and verify interface alignment with `architecture/v6/V6_IPC_CONTRACTS.proto` (`UiTrafficEvent`) and `architecture/v6/V6_SQLITE_SCHEMA.sql` (`transactions`).
2. Verify `sentinel_core/crates/sentinel_httpql` tests pass:
   ```powershell
   cargo test -p sentinel_httpql
   ```
3. Verify `sentinel_core/crates/sentinel_proxy` and `sentinel_repeater` tests pass:
   ```powershell
   cargo test -p sentinel_proxy -p sentinel_repeater
   ```
4. Verify frontend Vitest suite passes cleanly:
   ```powershell
   npm test
   ```

### 6.2 Benchmarking Invalidation Conditions
- Any steady-state memory growth beyond 150 MB during 100,000 streaming event ingestion invalidates the bounded memory specification.
- Any main-thread blocking exceeding 16ms during HTTPQL filter evaluation invalidates the Web Worker offloading specification.

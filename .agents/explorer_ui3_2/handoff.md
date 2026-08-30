# Phase UI-3 Component, Interaction & Contract Investigation Report

> **Explorer**: `explorer_ui3_2` (HTTPQL, Filters & Inspector Components Explorer)  
> **Target Milestone**: Phase UI-3 (Traffic, History, HTTPQL, Inspector & Diff)  
> **Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui3_2`  
> **Timestamp**: 2026-08-17T16:15:00Z  
> **Status**: 🟢 **COMPLETE & READY FOR IMPLEMENTATION**

---

## 1. Observation

Direct code and contract audit conducted across the authoritative Sentinel V6 repository:

### 1.1 Existing Architecture & File Inventory
- **Authoritative Specs**:
  - `SENTINEL_V6_UI_FEATURE_MANIFEST.md` (§ Phase UI-3, lines 306–328, 578–582, 634–645, 723, 763–772): Specifies virtualized traffic table for 1M transaction stability, real-time Protobuf streaming via `UiTrafficEvent`, HTTPQL query engine (`sentinel_httpql`), raw/hex/parsed/TLS/CAS evidence inspector, and response diffing (`sentinel_repeater`).
  - `architecture/v6/V6_IPC_CONTRACTS.proto` (lines 92–101, 183–195): Defines `UiTrafficEvent` containing `transaction_id`, `timestamp`, `method`, `uri`, `status`, `duration_ms`, `in_scope`, `tags`.
  - `sentinel_core/crates/sentinel_httpql/src/`: Full Rust grammar with AST (`ast.rs`), Lexer (`lexer.rs`), Parser (`parser.rs`), Compiler (`compiler.rs`), Evaluator (`evaluator.rs`), and Errors (`error.rs`).
- **Existing Frontend Components & Design System**:
  - `src/design-system/`: `VirtualizedTable.tsx` (TanStack Virtual wrapper, sticky headers, sorting, resizing, keyboard nav `j/k/gg/G/Space/Enter`), `RawByteInspector.tsx` (Hex + ASCII dump, byte offset inspector), `StructuredInspector.tsx` (Tree JSON inspector), `DiffViewer.tsx` (LCS line diff, Side-by-Side & Unified Inline), `Badge.tsx` (`MethodBadge`, `StatusBadge`, `SeverityBadge`, `Badge` with `scope-in`/`scope-deny`), `SplitPane.tsx` (Horizontal & vertical splitter with localStorage persistence), `Tabs.tsx`, `Modal.tsx`, `Button.tsx`, `Input.tsx`.
  - `src/workspaces/TrafficWorkspaceView.tsx`: Initial stub currently contains sample generator and basic table layout, requiring full Phase UI-3 architecture overhaul with modular traffic sub-components, HTTPQL engine, quick filters, multi-view inspector tabs, and diff modal.
  - `src/components/`: Currently contains `palette/`, `project/`, `shell/`. `src/components/traffic/` is ready to be created.
  - `src/types/`: `models.ts` defines `TransactionModel`, `HttpRequestData`, `HttpResponseData`, `HttpHeader`, `DiffResult`, `DiffLine`. `ipc.ts` defines `UiTrafficEvent`, `SentinelUiEvent`.

### 1.2 HTTPQL Grammar Verification from Backend Source
From `sentinel_core/crates/sentinel_httpql/src/ast.rs` and `token.rs`:
- **Supported Fields**: `req.method` / `method`, `req.url` / `url` / `req.uri` / `uri`, `req.path` / `path`, `req.host` / `host`, `req.header.<name>` / `req.headers.<name>`, `req.body`, `resp.status` / `status` / `status_code`, `resp.header.<name>` / `resp.headers.<name>`, `resp.body`, `resp.time` / `resp.time_ms` / `duration_ms`, `source`, `scope.status` / `scope`, `custom.<name>`.
- **Supported Comparison Operators**: `==`, `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains` (or `~=`), `not_contains` (or `!~=`), `matches` (or `=~`), `starts_with`, `ends_with`, `in`, `not in`.
- **Supported Logical Operators**: `and` / `&&`, `or` / `||`, `not` / `!`, parentheses `(`, `)`.
- **Literal Types**: String (`"..."`, `'...'`), Number (integer `200`), Float (`12.5`), Boolean (`true`/`false`), Regex (`/.../`).

---

## 2. Logic Chain

1. **High-Throughput Virtualization**:
   - Security auditing captures thousands of proxy transactions per minute. Rendering large lists without virtualization causes DOM thrashing and memory exhaustion.
   - `VirtualizedTable.tsx` already implements fixed row-height virtual windowing (~30 rendered DOM nodes) with column resizing and keyboard navigation.
   - For Phase UI-3, `VirtualTrafficTable.tsx` wraps and customizes this table with pentester-focused columns (ID, Time, Method, Host, Path, Status, Duration, Size, MIME, Scope SEC-01 Badge, TLS Lock, Tags), density modes (`compact` 22px, `standard` 28px, `comfortable` 36px), and row selection handlers.

2. **HTTPQL Query Bar & Grammar Validation**:
   - Pentesters require expressive query filtering (e.g. `req.method == "POST" and resp.status >= 400 and req.path contains "/api/v1"`).
   - `HttpqlQueryBar.tsx` provides immediate client-side tokenization and syntax validation with visual error badges, inline autocomplete suggestions (suggesting fields -> operators -> values), query history dropdown, and query presets.

3. **Traffic Quick Filters**:
   - Researchers frequently slice traffic with single clicks.
   - `TrafficQuickFilters.tsx` provides pill buttons for Scope Only (`SEC-01`), HTTP Methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, GQL/WS), Status codes (2xx, 3xx, 4xx, 5xx), and Content-Types (JSON, HTML, JS/CSS, Binary), combined with live filtered/total count badges.

4. **Multi-View Transaction Inspector**:
   - HTTP transactions have multifaceted security properties.
   - `TransactionInspectorPanel.tsx` provides 5 primary tabs:
     - `Request` & `Response`: with 4 sub-modes (`Parsed Headers`, `Raw HTTP`, `Hex Dump`, `Decoded Body` / JSON Tree).
     - `TLS & Security`: ALPN, Cipher suite, Certificate Subject/Issuer/SANs/Fingerprint.
     - `CAS Evidence Preview`: Cryptographic SHA-256 hash, receipt descriptor, proof requirement lock (`SEC-06`, `SEC-07`).
     - `Scope Decision Proof`: Visual verdict of `SEC-01` pre-socket drop or allow provenance.

5. **Response & Transaction Diff Viewer**:
   - Comparing responses (e.g. Admin vs User B for BOLA/IDOR, or Baseline vs Mutated) is central to manual testing.
   - `TransactionDiffModal.tsx` incorporates `DiffViewer.tsx` to provide synchronized Side-by-Side and Unified Inline comparisons with similarity percentages and delta metrics.

6. **Full Workspace Integration & State Stores**:
   - `useTrafficStore.ts` manages the in-memory 50,000-record circular ring buffer, live streaming toggle, filter state, selection, and IPC pagination.
   - `TrafficWorkspaceView.tsx` unifies the top query bar, quick filters, split table/inspector layout, and diff modal into a cohesive pentester workspace.

---

## 3. Caveats

1. **Monaco / External Editor Heavy Dependencies**:
   - The application relies on lightweight, fast React components (`design-system/RawByteInspector`, `design-system/StructuredInspector`, `design-system/DiffViewer`) rather than heavyweight external Monaco editor bundles, ensuring instant startup and zero Webpack/Vite chunk bloat.
2. **Streaming Event Backpressure**:
   - When ingesting at high burst rates (up to 5,000 events/sec), frontend state updates should be batched (or throttled via requestAnimationFrame) to prevent React re-render starvation.
3. **HTML Sandbox Security (`SEC-11`)**:
   - When rendering HTML response body previews, untrusted HTML must be rendered within an isolated sandboxed iframe (`sandbox="allow-same-origin"`) without `allow-scripts` to eliminate any XSS vulnerability in the desktop app.

---

## 4. Conclusion & Complete Technical Specification

### 4.1 Component Inventory & Hierarchy

```
src/
├── components/
│   └── traffic/
│       ├── HttpqlQueryBar.tsx          # Autocomplete search bar, grammar parser, query history
│       ├── TrafficQuickFilters.tsx     # Scope toggle, Method pills, Status pills, MIME pills
│       ├── VirtualTrafficTable.tsx     # High-density virtualized proxy history grid
│       ├── TransactionInspectorPanel.tsx # Multi-tab request/response/TLS/CAS/Scope inspector
│       ├── TransactionDiffModal.tsx    # Side-by-side & unified diff viewer modal
│       └── index.ts                    # Module exports
├── utils/
│   └── httpql.ts                       # HTTPQL tokenizer, parser, validator & autocompleter
├── stores/
│   ├── trafficStore.ts                 # 50K ring buffer, filters, selection, streaming, diff modal
│   └── inspectorStore.ts               # Tab and view mode persistence
└── workspaces/
    └── TrafficWorkspaceView.tsx        # Full Phase UI-3 integrated workspace
```

---

### 4.2 Exact Component Contracts & Interfaces

#### 1. `HttpqlQueryBar.tsx`
```typescript
export interface HttpqlQueryBarProps {
  value: string;
  onChange: (query: string) => void;
  onSubmit: (query: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onValidate?: (isValid: boolean, error?: string) => void;
}
```
- **State & Sub-elements**:
  - `queryHistory`: array of previous queries stored in `localStorage`.
  - `suggestions`: context-aware autocomplete list (`Field`, `Operator`, `Value`, `Keyword`).
  - `validationState`: `{ valid: boolean, error?: string, position?: number }`.
  - `isSuggestionsOpen`: boolean.
- **Keyboard navigation**: `ArrowDown`/`ArrowUp` to navigate suggestions, `Tab`/`Enter` to accept suggestion, `Escape` to close suggestion popup.

#### 2. `TrafficQuickFilters.tsx`
```typescript
export interface TrafficQuickFiltersProps {
  scopeOnly: boolean;
  onToggleScopeOnly: (active: boolean) => void;
  selectedMethods: string[];
  onToggleMethod: (method: string) => void;
  selectedStatuses: Array<'2xx' | '3xx' | '4xx' | '5xx'>;
  onToggleStatus: (statusGroup: '2xx' | '3xx' | '4xx' | '5xx') => void;
  selectedMimes: string[];
  onToggleMime: (mime: string) => void;
  totalCount: number;
  filteredCount: number;
  onResetAll: () => void;
  className?: string;
}
```

#### 3. `VirtualTrafficTable.tsx`
```typescript
export interface VirtualTrafficTableProps {
  transactions: TransactionModel[];
  selectedTxId: string | null;
  selectedTxIds?: Set<string>;
  onSelectTx: (tx: TransactionModel, index: number, isMulti?: boolean) => void;
  onDoubleClickTx?: (tx: TransactionModel) => void;
  density?: 'compact' | 'standard' | 'comfortable';
  emptyMessage?: string;
  className?: string;
  onSendToRepeater?: (tx: TransactionModel) => void;
  onOpenDiff?: (txA: TransactionModel, txB?: TransactionModel) => void;
}
```
- **Columns**:
  1. `# ID` (`id`, width 85px)
  2. `Time` (`timestamp`, width 80px)
  3. `Method` (`method`, width 75px, `MethodBadge`)
  4. `Host` (`host`, width 150px)
  5. `Path` (`path`, width 240px)
  6. `Status` (`status`, width 65px, `StatusBadge`)
  7. `Duration` (`durationMs`, width 75px, `formatDuration`)
  8. `Size` (`sizeBytes`, width 75px, `formatBytes`)
  9. `MIME` (`mimeType`, width 110px)
  10. `Scope` (`inScope`, width 85px, `Badge` `scope-in` / `scope-deny`)
  11. `TLS` (`tlsVersion`, width 65px)
  12. `Tags` (`tags`, width 100px)

#### 4. `TransactionInspectorPanel.tsx`
```typescript
export interface TransactionInspectorPanelProps {
  transaction: TransactionModel | null;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onSendToRepeater?: (tx: TransactionModel) => void;
  onSendToScanner?: (tx: TransactionModel) => void;
  onSendToFuzzer?: (tx: TransactionModel) => void;
  onOpenDiff?: (tx: TransactionModel) => void;
  className?: string;
}
```
- **Tabs**:
  - `Request` (Sub-modes: `Parsed Headers`, `Raw HTTP`, `Hex Dump`, `Decoded Tree`)
  - `Response` (Sub-modes: `Parsed Headers`, `Raw HTTP`, `Hex Dump`, `Decoded Tree`, `HTML Preview`)
  - `TLS & Security` (ALPN, Cipher, SANs, Fingerprint)
  - `CAS Evidence` (`SEC-07` Hash, Proof Requirement Lock `SEC-06`)
  - `Scope Audit` (`SEC-01` Pre-Socket Provenance)

#### 5. `TransactionDiffModal.tsx`
```typescript
export interface TransactionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionA: TransactionModel | null;
  transactionB: TransactionModel | null;
  allTransactions?: TransactionModel[];
  onSelectTransactionA?: (tx: TransactionModel) => void;
  onSelectTransactionB?: (tx: TransactionModel) => void;
  className?: string;
}
```
- **Diff targets**: Response Body, Request Body, Full Raw HTTP, Headers.
- **Modes**: Side-by-Side vs Unified Inline (`DiffViewer`).

---

### 4.3 State Store Architecture (`useTrafficStore.ts`)

```typescript
export interface TrafficStoreState {
  // Data & Selection
  transactions: TransactionModel[];
  filteredTransactions: TransactionModel[];
  selectedTxId: string | null;
  selectedTxIds: Set<string>;
  focusedIndex: number;
  
  // Streaming & Buffer
  isStreaming: boolean;
  isPaused: boolean;
  maxBufferSize: number;
  totalCapturedCount: number;
  
  // Filters
  httpqlQuery: string;
  isHttpqlValid: boolean;
  httpqlError: string | null;
  filterScopeOnly: boolean;
  filterMethods: string[];
  filterStatuses: Array<'2xx' | '3xx' | '4xx' | '5xx'>;
  filterMimes: string[];
  
  // History & Presets
  queryHistory: string[];
  
  // Diff Modal State
  diffModal: {
    isOpen: boolean;
    txA: TransactionModel | null;
    txB: TransactionModel | null;
  };
  
  // Actions
  addTransaction: (tx: TransactionModel) => void;
  ingestBatch: (txs: TransactionModel[]) => void;
  selectTransaction: (id: string, isMulti?: boolean) => void;
  setFocusedIndex: (index: number) => void;
  setHttpqlQuery: (query: string) => void;
  setScopeOnly: (scopeOnly: boolean) => void;
  toggleMethodFilter: (method: string) => void;
  toggleStatusFilter: (status: '2xx' | '3xx' | '4xx' | '5xx') => void;
  toggleMimeFilter: (mime: string) => void;
  resetFilters: () => void;
  clearTraffic: () => void;
  toggleStreaming: () => void;
  openDiffModal: (txA: TransactionModel, txB?: TransactionModel) => void;
  closeDiffModal: () => void;
  fetchPageFromBackend: (offset: number, limit: number) => Promise<void>;
}
```

---

### 4.4 Keyboard Navigation & Accessibility (ARIA & WCAG AA)

| Shortcut | Context | Target Action |
|---|---|---|
| `/` | Table / Workspace | Focus HTTPQL Query Input Bar |
| `j` / `Down` | Virtual Traffic Table | Move selection down 1 row |
| `k` / `Up` | Virtual Traffic Table | Move selection up 1 row |
| `g g` / `Home` | Virtual Traffic Table | Jump to first row |
| `G` / `End` | Virtual Traffic Table | Jump to last row |
| `Space` | Virtual Traffic Table | Toggle multi-select checkbox on focused row |
| `Enter` | Virtual Traffic Table | Select row and sync Inspector |
| `Ctrl+R` | Workspace / Inspector | Send selected transaction to Repeater Tab |
| `Ctrl+D` | Workspace / Inspector | Open Transaction Diff Modal |
| `Ctrl+Shift+S`| Workspace / Inspector | Send selected transaction to Scanner |
| `Ctrl+Shift+F`| Workspace / Inspector | Send selected transaction to Mutation Fuzzer |
| `Esc` | Modals / Autocomplete | Dismiss modal / close suggestions dropdown |

**Accessibility & WCAG AA**:
- Contrast ratio >= 4.5:1 for all text, badges, and method indicators.
- ARIA table structure: `role="grid"`, `role="row"`, `aria-selected`, `role="columnheader"`, `aria-sort`.
- ARIA combobox for HTTPQL query bar with `aria-autocomplete="list"` and `role="option"` suggestion items.
- Focus trap inside `TransactionDiffModal` with escape-to-close and focus restore.
- Complete keyboard accessibility without requiring mouse input.

---

### 4.5 Step-by-Step Implementation Roadmap for Worker Agent

1. **Step 1: Models & Types Definition**
   - Create `src/types/traffic.ts` and `src/types/httpql.ts` (or extend `src/types/models.ts` & `src/ipc/contracts.ts`) with `TlsCertificateDetails`, `CasEvidencePreviewData`, `HttpqlValidationResult`, `HttpqlAutocompleteSuggestion`, `TrafficFilterState`.
2. **Step 2: Client-side HTTPQL Engine**
   - Create `src/utils/httpql.ts` implementing client-side tokenization, grammar parsing, syntax validation, and field/operator/value suggestions based on `sentinel_httpql`.
3. **Step 3: Zustand Stores**
   - Create `src/stores/trafficStore.ts` with 50,000-item ring buffer, predicate filtering engine, query history, and selection state.
   - Create `src/stores/inspectorStore.ts` with tab and sub-mode state.
4. **Step 4: Traffic Components**
   - Implement `src/components/traffic/HttpqlQueryBar.tsx`.
   - Implement `src/components/traffic/TrafficQuickFilters.tsx`.
   - Implement `src/components/traffic/VirtualTrafficTable.tsx`.
   - Implement `src/components/traffic/TransactionInspectorPanel.tsx`.
   - Implement `src/components/traffic/TransactionDiffModal.tsx`.
   - Create `src/components/traffic/index.ts`.
5. **Step 5: Full Workspace Integration**
   - Refactor `src/workspaces/TrafficWorkspaceView.tsx` to integrate all 5 components, `SplitPane`, `useTrafficStore`, and `useToastStore`.
6. **Step 6: IPC & Mock Bridge Expansion**
   - Add `cmd_traffic_get_page`, `cmd_traffic_get_details`, `cmd_traffic_get_raw_blob`, `cmd_httpql_validate`, `cmd_traffic_diff`, `cmd_traffic_clear` to `src/ipc/client.ts` and `src/ipc/mockBridge.ts`.
7. **Step 7: Vitest Test Suite**
   - Implement comprehensive tests in:
     - `tests/components/traffic/HttpqlQueryBar.test.tsx`
     - `tests/components/traffic/TrafficQuickFilters.test.tsx`
     - `tests/components/traffic/VirtualTrafficTable.test.tsx`
     - `tests/components/traffic/TransactionInspectorPanel.test.tsx`
     - `tests/components/traffic/TransactionDiffModal.test.tsx`
     - `tests/workspaces/TrafficWorkspaceView.test.tsx`
     - `tests/stress/TrafficLargeDataset.stress.test.tsx` (100K item performance and HTTPQL evaluation throughput).

---

## 5. Verification Method

To independently verify this investigation report and its specifications:

1. **Verify Backend HTTPQL Lexer & AST**:
   ```bash
   # Inspect HTTPQL crate grammar
   cargo test -p sentinel_httpql --locked
   ```
2. **Verify Frontend Design System & Vitest Suite**:
   ```bash
   npm test
   ```
3. **Inspect Component Interfaces & Contract Specs**:
   - `src/design-system/VirtualizedTable.tsx`
   - `src/design-system/RawByteInspector.tsx`
   - `src/design-system/StructuredInspector.tsx`
   - `src/design-system/DiffViewer.tsx`
   - `src/workspaces/TrafficWorkspaceView.tsx`
   - `SENTINEL_V6_UI_FEATURE_MANIFEST.md` (§ Phase UI-3)

# Phase UI-2 Investigation & Implementation Plan: Project Lifecycle & Scope Engine

> **Agent**: Explorer UI-2 (1)  
> **Role**: Read-only Investigation & Synthesis  
> **Milestone**: Phase UI-2 (Project Lifecycle & Scope Engine)  
> **Platform Version**: `6.0.0` (FROZEN ARCHITECTURE)  
> **Date**: 2026-08-17  
> **Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui2_1`

---

## 1. Observation

Direct observations from examining the codebase, specifications, IPC schemas, and frontend/backend implementations:

### 1.1 Backend Storage & Project Lifecycle (`crates/sentinel_storage`)
1. **Physical Project Workspace Isolation (SEC-08)**:
   - File: `sentinel_core/crates/sentinel_storage/src/project.rs` (lines 20-74, 76-104)
   - `ProjectStorage::open(project_dir)` initializes an isolated project root directory containing 4 subcomponents:
     - `db_path`: `project_dir.join("db.sqlite")`
     - `blobs_dir`: `project_dir.join("blobs")` (CAS Content-Addressed Storage)
     - `indexes_dir`: `project_dir.join("indexes")` (Full-Text Search & secondary query indexes)
     - `logs_dir`: `project_dir.join("logs")` (Append-only audit traces)
   - `ProjectStorage::resolve_safe_path` enforces path traversal immunity (SEC-08):
     - Rejects any absolute paths.
     - Rejects any path component containing `Component::ParentDir` (`..`).
     - Returns `SentinelError::InvariantViolation("Cross-project path traversal attempt detected (SEC-08)")`.

2. **SQLite WAL Mode & Pragma Invariants**:
   - File: `sentinel_core/crates/sentinel_storage/src/db.rs` (lines 28-89, 91-137)
   - `default_connect_options` and `enforce_pragmas` enforce:
     - `PRAGMA journal_mode = WAL;` (Write-Ahead Logging for high-concurrency read/write)
     - `PRAGMA synchronous = NORMAL;` (Safe WAL mode fsync trade-off)
     - `PRAGMA foreign_keys = ON;` (Referential integrity enforcement across all 32 canonical tables)
     - `PRAGMA busy_timeout = 5000;` (5-second timeout on lock contention)
     - `PRAGMA cache_size = -64000;` (64 MB page cache)
     - `PRAGMA temp_store = MEMORY;` (RAM temporary tables and indices)
   - `check_pragmas(pool) -> Result<PragmaStatus, SentinelError>` provides runtime diagnostic validation of pragma values.

3. **32-Table Canonical Schema Migration**:
   - File: `sentinel_core/crates/sentinel_storage/src/migrations.rs` (lines 10-140)
   - `run_migrations(&pool)` idempotently applies schema definition from `V6_SQLITE_SCHEMA.sql`.
   - Core tables for UI-2:
     - `scopes`: `id TEXT PRIMARY KEY, version INTEGER NOT NULL, timestamp DATETIME NOT NULL, includes_json TEXT NOT NULL, excludes_json TEXT NOT NULL`
     - `observations`: `id TEXT PRIMARY KEY, version INTEGER, timestamp DATETIME, provenance TEXT, source TEXT, data_ref TEXT, lifecycle TEXT, scope_id TEXT (FK -> scopes(id) ON DELETE SET NULL)`
     - `transactions`: `id TEXT PRIMARY KEY, timestamp DATETIME, protocol TEXT, stream_id INTEGER, req_method TEXT, req_uri TEXT, req_blob_id TEXT, req_normalized_text TEXT, res_status INTEGER, res_blob_id TEXT, res_normalized_text TEXT, timing_ms INTEGER, tls_cipher TEXT, version INTEGER, provenance TEXT, lifecycle TEXT, scope_id TEXT (FK -> scopes(id) ON DELETE SET NULL)`
     - `audit_events`: `id TEXT PRIMARY KEY, timestamp DATETIME, event_type TEXT, source TEXT, target TEXT, payload_json TEXT` (SEC-11 append-only)

4. **CAS Blob Storage & Deduplication (SEC-07)**:
   - File: `sentinel_core/crates/sentinel_storage/src/cas.rs` (lines 38-120)
   - `BlobStorage::put(&data)` stores payload at `blobs/{sha256[0:2]}/{sha256}.blob` with atomic temporary file rename.
   - Deduplicates identical blobs by checking SHA-256 hash.
   - Validates on-disk byte integrity against checksum on read (`get`).

5. **Scope Repository**:
   - File: `sentinel_core/crates/sentinel_storage/src/repository/scope.rs` (lines 11-137)
   - `ScopeRepository::insert`, `update`, `get(id)`, `list()`, `get_latest()`, `delete(id)`.
   - Serializes `includes` and `excludes` string arrays to JSON.

### 1.2 Fail-Closed Scope Engine (`crates/sentinel_scope`)
1. **Fail-Closed Evaluator & Matchers (SEC-01)**:
   - File: `sentinel_core/crates/sentinel_scope/src/engine.rs` (lines 20-120)
   - `ScopeRule::parse` supports 4 match modes:
     - `RuleKind::Ip(IpCidrMatcher)`: Parses IPv4/IPv6 CIDR ranges (e.g. `10.0.0.0/8`, `192.168.1.0/24`).
     - `RuleKind::Url(UrlMatcher)`: Path prefix, wildcard, regex (e.g. `^https://api\\.target\\.local/.*`).
     - `RuleKind::Hostname(HostnameMatcher)`: Host wildcards (e.g. `*.target.local`, `target.local`).
     - `RuleKind::Any`: Wildcard `*`.
   - SSRF Protection: `SsrfValidator` blocks AWS/GCP/Azure cloud metadata (`169.254.169.254`) and loopback/private subnets when configured as exclusions.
   - Precedence: Explicit `EXCLUDE` rules take absolute precedence over `INCLUDE` rules. If no `INCLUDE` rule matches, decision defaults to `DENY` (Fail-Closed default-deny).

2. **Scope Violation Event**:
   - File: `architecture/v6/V6_IPC_CONTRACTS.proto` (lines 167-172)
   - `UiScopeViolationEvent { requestId, attemptedUri, violationReason, timestamp }` emitted over `SentinelUiStream`.

### 1.3 Desktop IPC & Tauri Layer (`src-tauri`)
1. **Existing Tauri Commands**:
   - File: `src-tauri/src/commands.rs` (lines 37-216)
   - Currently implements: `cmd_get_platform_info`, `cmd_get_status`, `cmd_toggle_proxy`, `cmd_test_scope_uri`, `cmd_productivity_search`.
   - Missing dedicated project lifecycle commands: `cmd_project_new`, `cmd_project_open`, `cmd_project_close`, `cmd_project_get_current`, `cmd_project_list_recent`, `cmd_project_export`, `cmd_project_import`, `cmd_scope_get`, `cmd_scope_update`.

2. **Existing App State**:
   - File: `src-tauri/src/state.rs` (lines 5-45)
   - Contains `AppStatus` with `active_project: Option<String>`, `scope_active: bool`, `scope_rules_count: usize`.
   - Needs storage of `current_project: Option<ProjectMetadata>`, `recent_projects: Vec<RecentProjectInfo>`, `active_scope: Scope`.

### 1.4 Frontend Architecture & UI Components (`src/`)
1. **Existing HeaderBar**:
   - File: `src/components/shell/HeaderBar.tsx` (lines 49-68, 90-102)
   - Contains placeholder dropdown items (`proj-new`, `proj-open`, `proj-save`) triggering toast notifications without opening a modal.
   - Has Scope Pill badge displaying `Scope: Active ({count} rules)`.

2. **Existing Workspace**:
   - File: `src/workspaces/ProjectScopeWorkspaceView.tsx` (lines 29-308)
   - Contains basic split pane with mock rules and pre-flight tester.
   - Needs connection to dedicated `useScopeStore`, `useProjectStore`, and IPC backend.

3. **IPC Bridge & Mock Bridge**:
   - File: `src/ipc/client.ts` & `src/ipc/mockBridge.ts`
   - Mock bridge returns mock platform info and status; needs project lifecycle methods (`createProject`, `openProject`, `closeProject`, `getRecentProjects`, `exportProject`, `importProject`, `getScope`, `updateScope`).

---

## 2. Logic Chain

From the above observations:

1. **Storage & Isolation (Observation 1.1)**: `sentinel_storage` already provides complete, battle-tested Rust APIs (`ProjectStorage`, `SqliteObservationStore`, `BlobStorage`, `ScopeRepository`) adhering to SEC-07 (CAS SHA-256) and SEC-08 (physical project directory isolation and path traversal rejection).
2. **Fail-Closed Policy (Observation 1.2)**: `sentinel_scope` enforces default-deny with IP CIDR, hostname wildcard, and regex matching, with exclusion precedence and SSRF defense.
3. **IPC Gap (Observation 1.3)**: `src-tauri/src/commands.rs` currently only provides placeholder scope testing (`cmd_test_scope_uri`) and does not expose full project lifecycle commands (`cmd_project_new`, `cmd_project_open`, `cmd_project_close`, `cmd_project_get_current`, `cmd_project_list_recent`, `cmd_project_export`, `cmd_project_import`, `cmd_scope_get`, `cmd_scope_update`).
4. **UI Gap (Observation 1.4)**: The frontend requires a unified, high-density `ProjectModal` (New Project wizard, Open/Recent projects list, Project Settings diagnostics, Export/Import backup) and dedicated state stores (`projectStore.ts`, `scopeStore.ts`).
5. **No Backend Feature Invention**: All required capabilities exist in `sentinel_storage` and `sentinel_scope`. We only need to expose the Tauri IPC command handlers, frontend IPC client bridges, Zustand stores, and React UI components.

---

## 3. Caveats

- **Archive Compression Dependency**: For `cmd_project_export` and `cmd_project_import`, the Rust backend can use standard `zip` or `flate2`/`tar` crates or directory copy with manifest checksums. In the frontend mock bridge, mock export/import handles JSON/base64 bundles and browser downloads.
- **Tauri Native File Dialogs**: When running inside Tauri, `plugin-dialog` or `@tauri-apps/api/dialog` is used for native folder/file picking; in web/browser mock mode, standard input text and mock file selections are provided.

---

## 4. Conclusion & Recommended Implementation Plan

### 4.1 Architecture & Component Design

```
+---------------------------------------------------------------------------------------------------+
|                                      FRONTEND LAYER (React + TS)                                  |
|                                                                                                   |
|  +---------------------------+  +--------------------------------+  +--------------------------+  |
|  |       HeaderBar.tsx       |  |       ProjectModal.tsx         |  | ProjectScopeWorkspace.tsx|  |
|  | - Project Switcher Dropdown|  | - [Tab 1] New Project Wizard   |  | - Include Rules Table    |  |
|  | - Scope Status Pill       |  | - [Tab 2] Open / Recent List   |  | - Exclude Rules Table    |  |
|  | - WAL Save Shortcut       |  | - [Tab 3] Project Settings     |  | - Pre-Flight Tester      |  |
|  |                           |  | - [Tab 4] Export / Backup      |  | - Violation Stream Table |  |
|  |                           |  | - [Tab 5] Import Project       |  |                          |  |
|  +-------------+-------------+  +---------------+----------------+  +------------+-------------+  |
|                |                                |                                |                |
|                +--------------------------------+--------------------------------+                |
|                                                 |                                                 |
|                                 +---------------+---------------+                                 |
|                                 |   Zustand State Stores        |                                 |
|                                 | - useProjectStore.ts          |                                 |
|                                 | - useScopeStore.ts            |                                 |
|                                 | - useAppShellStore.ts         |                                 |
|                                 +---------------+---------------+                                 |
|                                                 |                                                 |
|                                 +---------------+---------------+                                 |
|                                 |   IPC Client Bridge           |                                 |
|                                 | - ipc/client.ts               |                                 |
|                                 | - ipc/contracts.ts            |                                 |
|                                 | - ipc/mockBridge.ts           |                                 |
|                                 +---------------+---------------+                                 |
+-------------------------------------------------+-------------------------------------------------+
                                                  | Tauri IPC (`invoke`) / Mock
                                                  v
+-------------------------------------------------+-------------------------------------------------+
|                                 TAURI RUST BACKEND (`src-tauri`)                                  |
|                                                                                                   |
|  - `cmd_project_new(path, name, scope_seeds)` -> Result<ProjectMetadata, String>                  |
|  - `cmd_project_open(path)` -> Result<ProjectState, String>                                       |
|  - `cmd_project_close()` -> Result<(), String>                                                    |
|  - `cmd_project_get_current()` -> Result<Option<ProjectMetadata>, String>                         |
|  - `cmd_project_list_recent()` -> Result<Vec<RecentProjectInfo>, String>                          |
|  - `cmd_project_export(path, dest_zip)` -> Result<ExportResult, String>                           |
|  - `cmd_project_import(source_zip, dest_dir)` -> Result<ProjectMetadata, String>                  |
|  - `cmd_scope_get()` -> Result<ScopeResponse, String>                                             |
|  - `cmd_scope_update(includes, excludes)` -> Result<ScopeResponse, String>                         |
|  - `cmd_scope_test_uri(uri)` -> Result<ScopeDecisionResult, String>                              |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+-------------------------------------------------+-------------------------------------------------+
|                         SENTINEL CORE BACKEND CRATES                                              |
|                                                                                                   |
|  - `sentinel_storage::ProjectStorage` (SEC-08 Workspace Directory & Path Traversal Rejection)     |
|  - `sentinel_storage::db::create_pool` & `enforce_pragmas` (SQLite WAL, PRAGMAs)                  |
|  - `sentinel_storage::BlobStorage` (SEC-07 Content-Addressed Storage & SHA-256 Integrity)        |
|  - `sentinel_storage::ScopeRepository` (32-table canonical SQLite DB persistence)                |
|  - `sentinel_scope::DefaultScopeEngine` (SEC-01 Fail-Closed CIDR / Wildcard / Regex Evaluator)   |
+---------------------------------------------------------------------------------------------------+
```

### 4.2 Step-by-Step Implementation Plan for Phase UI-2

#### Step 1: IPC Contracts & Tauri Command Backend
1. **`src-tauri/src/commands.rs`**:
   - Define data structs: `ProjectMetadata`, `RecentProjectInfo`, `ProjectState`, `ScopeResponse`, `ProjectExportResult`, `ProjectImportResult`.
   - Implement handlers:
     - `cmd_project_new(path, name)`: Validates name, opens `ProjectStorage`, inserts initial default scope, updates `AppState`, logs audit event.
     - `cmd_project_open(path)`: Opens `ProjectStorage`, reads `ScopeRepository::get_latest()`, computes DB size, updates `AppState`.
     - `cmd_project_close()`: Commits WAL, clears active project in `AppState`.
     - `cmd_project_get_current()`: Returns active project metadata.
     - `cmd_project_list_recent()`: Reads recent project list.
     - `cmd_project_export(project_dir, destination_zip)`: Packages project bundle with checksums.
     - `cmd_project_import(source_zip, destination_dir)`: Unpacks and verifies project bundle.
     - `cmd_scope_get()`: Reads active scope from `ScopeRepository`.
     - `cmd_scope_update(includes, excludes)`: Saves new scope revision to `ScopeRepository`.
     - `cmd_scope_test_uri(uri)`: Evaluates target URI against `sentinel_scope::DefaultScopeEngine`.
2. **`src-tauri/src/main.rs`**:
   - Register all new commands in `tauri::generate_handler!`.
3. **`src-tauri/src/state.rs`**:
   - Add `current_project: Option<ProjectMetadata>`, `recent_projects: Vec<RecentProjectInfo>`, `active_scope: Option<ScopeResponse>` to `AppStatus`/`AppState`.

#### Step 2: TypeScript IPC Client & Mock Bridge
1. **`src/types/ipc.ts` & `src/ipc/contracts.ts`**:
   - Add TypeScript interfaces: `ProjectMetadata`, `RecentProjectInfo`, `ProjectState`, `ScopeRuleDef`, `ScopeResponse`, `ProjectExportResult`, `ProjectImportResult`.
2. **`src/ipc/mockBridge.ts`**:
   - Implement realistic mock handlers with `localStorage` persistence (`sentinel_recent_projects`, `sentinel_current_project`, `sentinel_scope`).
   - Support `getPlatformInfo`, `getStatus`, `createProject`, `openProject`, `closeProject`, `getCurrentProject`, `listRecentProjects`, `exportProject`, `importProject`, `getScope`, `updateScope`, `testScopeUri`.
3. **`src/ipc/client.ts`**:
   - Expose typed wrapper methods for all project & scope operations.

#### Step 3: Zustand State Stores
1. **`src/stores/projectStore.ts`**:
   - State: `currentProject`, `recentProjects`, `isModalOpen`, `activeModalTab` (`new` | `open` | `recent` | `settings` | `export` | `import`), `isLoading`, `error`.
   - Actions: `openModal(tab)`, `closeModal()`, `createProject(name, path, seeds)`, `openProject(path)`, `closeProject()`, `fetchRecentProjects()`, `exportProject(dest)`, `importProject(src, dest)`, `saveWalCheckpoint()`.
2. **`src/stores/scopeStore.ts`**:
   - State: `scopeId`, `version`, `includes: ScopeRuleDef[]`, `excludes: ScopeRuleDef[]`, `violations: ScopeViolationRecord[]`, `testResult: ScopeDecisionResponse | null`, `isSaving: boolean`.
   - Actions: `fetchScope()`, `addRule(type, pattern, targetType, notes)`, `deleteRule(id)`, `toggleRule(id)`, `saveScope()`, `evaluateUri(uri)`, `addViolation(v)`.

#### Step 4: UI Components for Project Workspace
1. **`src/components/project/ProjectModal.tsx`**:
   - Multi-tab modal dialog using `design-system/Modal.tsx`.
   - Left vertical tab list with icons:
     - 🌟 **New Project Wizard**
     - 📂 **Open Project / Recent**
     - ⚙️ **Project Settings & Diagnostics**
     - 📦 **Export / Backup**
     - 📥 **Import Project**
2. **`src/components/project/NewProjectWizard.tsx`**:
   - Project Name, Target Folder picker, Scope presets (Web standard, Strict default-deny, Intranet SSRF guard, Destructive endpoint exclusion).
   - "Create Project" action.
3. **`src/components/project/RecentProjectsList.tsx`**:
   - List of recent `.sentinel` projects with metadata (Path, Last opened, Size, Scope rules count, Findings count).
   - Search filter, "Open", "Pin", "Remove" actions.
4. **`src/components/project/ProjectSettingsTab.tsx`**:
   - SQLite WAL diagnostics (journal mode, page count, sync mode, foreign keys, busy timeout).
   - "Commit WAL Snapshot", "Run Database VACUUM", "Verify CAS Blob Integrity".
5. **`src/components/project/ProjectExportTab.tsx` & `ProjectImportTab.tsx`**:
   - Full bundle export (.sentinel.zip), sanitized export (redacted secrets SEC-09), import archive validation.
6. **`src/components/shell/HeaderBar.tsx`**:
   - Connect Project Switcher dropdown to `useProjectStore` triggers (`openModal('new')`, `openModal('open')`, `openModal('settings')`, `openModal('export')`, `saveWalCheckpoint()`).
7. **`src/workspaces/ProjectScopeWorkspaceView.tsx`**:
   - Connect to `useScopeStore` and `useProjectStore`.
   - Dual-table layout (Include Rules Table + Exclude Rules Table).
   - Pre-flight scope tester with live validation feedback.
   - Virtualized scope violation stream.

#### Step 5: Test Suite & Quality Gates
1. Unit tests: `tests/stores/projectStore.test.ts`, `tests/stores/scopeStore.test.ts`.
2. Component tests: `tests/project/ProjectModal.test.tsx`, `tests/project/NewProjectWizard.test.tsx`, `tests/project/RecentProjectsList.test.tsx`, `tests/project/ProjectSettingsTab.test.tsx`, `tests/workspaces/ProjectScopeWorkspaceView.test.tsx`.
3. IPC integration tests: `tests/ipc/projectIpc.test.ts`.
4. Run `npm test` and `cargo test --workspace` to ensure 100% pass rate.

---

## 5. Verification Method

To independently verify this investigation and validate the subsequent implementation:

1. **Verify Backend Storage Crate**:
   ```bash
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core"
   cargo test -p sentinel_storage
   cargo test -p sentinel_scope
   ```
2. **Verify Frontend Test Suite**:
   ```bash
   cd "c:\Users\Legion 5 pro\Desktop\cyber sec"
   npm test
   ```
3. **Verify Spec Conformance**:
   ```bash
   python "c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6\validate_v6_spec.py"
   ```
4. **Files to Inspect**:
   - `sentinel_core/crates/sentinel_storage/src/project.rs`
   - `sentinel_core/crates/sentinel_storage/src/db.rs`
   - `sentinel_core/crates/sentinel_storage/src/cas.rs`
   - `sentinel_core/crates/sentinel_scope/src/engine.rs`
   - `src-tauri/src/commands.rs`
   - `src/workspaces/ProjectScopeWorkspaceView.tsx`
   - `src/components/shell/HeaderBar.tsx`

## 2026-08-17T14:33:52Z
You are Worker 1 for Phase UI-2 (Project Lifecycle & Scope Engine).
Your working directory is: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui2_1

You MUST read:
1. c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md
2. c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md
3. c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui2_1\handoff.md
4. c:\Users\Legion 5 pro\Desktop\cyber sec\SENTINEL_V6_UI_FEATURE_MANIFEST.md
5. c:\Users\Legion 5 pro\Desktop\cyber sec\UI_BACKEND_CAPABILITY_MATRIX.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks for Phase UI-2:
1. Implement State Management:
   - `src/stores/projectStore.ts`: Project lifecycle store (create project, open project, close project, recent projects, active database metadata, export/import, persistence).
   - `src/stores/scopeStore.ts`: SEC-01 Fail-Closed Scope Engine store (include rules, exclude rules, rule kinds CIDR/Regex/Wildcard/Prefix, SSRF presets, active rule evaluation, evaluation breakdown provenance, out-of-scope modal triggers).
2. Implement Components:
   - `src/components/project/ProjectModal.tsx`: Complete modal with New Project wizard, Recent Projects list, Open Project file picker, Project Settings (WAL pragmas/storage stats), Export/Import Project.
   - Update `src/components/shell/HeaderBar.tsx`: Wire project switcher dropdown, recent project selection, "New Project", "Open Project", "Project Settings" to open `ProjectModal`.
   - Update `src/workspaces/ProjectScopeWorkspaceView.tsx`: Full-featured Scope workspace with:
     - Include/Exclude rule tabs and tables with type badges (CIDR, Regex, Domain, Path), toggle active, delete, add rule dialog, JSON import/export.
     - Real-Time Scope Evaluator / Visual DENY Inspector: URL input testing against rules with step-by-step evaluation breakdown (showing which rule matched, whether allowed/denied, SSRF metadata check).
     - SEC-02/SEC-03 Out-of-Scope Safety Warning dialog for active testing actions.
3. Implement IPC Client & Bridge:
   - Update `src/ipc/types.ts`, `src/ipc/client.ts`, and `src/ipc/mockBridge.ts` with typed project and scope commands (`projectCreate`, `projectOpen`, `projectClose`, `projectGetCurrent`, `projectListRecent`, `projectExport`, `projectImport`, `scopeGetRules`, `scopeUpdateRules`, `scopeTestUrl`).
   - Update `src-tauri/src/commands.rs` and `src-tauri/src/state.rs` with corresponding Tauri command handlers and project state management.
4. Comprehensive Vitest Tests:
   - Create unit/integration tests: `tests/stores/projectStore.test.ts`, `tests/stores/scopeStore.test.ts`, `tests/components/ProjectModal.test.tsx`, `tests/workspaces/ProjectScopeWorkspaceView.test.tsx`, `tests/ipc/projectScopeIpc.test.ts`.
5. Verification:
   - Run `npm test` and ensure all existing and new tests pass (100% pass rate).
   - Run `npm run build` (`tsc && vite build`) and ensure 0 TypeScript errors.
   - Run `cargo check --workspace` if modifying Rust code.
6. Write your comprehensive 5-component handoff report to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui2_1\handoff.md`.
7. Notify the parent orchestrator via send_message when done.

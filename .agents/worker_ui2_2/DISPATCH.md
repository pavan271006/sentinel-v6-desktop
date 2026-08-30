## 2026-08-17T15:04:51Z
You are Worker UI-2 (2) for Phase UI-2 (Project Lifecycle & Scope Engine) Remediation.
Your working directory is: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui2_2.

Read:
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui2_2\analysis.md
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui2_2\handoff.md
- c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\auditor_ui2_1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write ownership covers:
- `src/stores/scopeStore.ts`
- `src/stores/projectStore.ts`
- `src/ipc/mockBridge.ts`
- `src-tauri/src/commands.rs`
- `tests/stress/`

Tasks:
1. In `src/stores/scopeStore.ts`:
   - Re-export `ScopeRuleDef`: `export type { ScopeRuleDef } from '../ipc/contracts';`.
   - Update `checkSafetyGate` to extract hostname via `URL` parsing, immediately return `false` on any active `EXCLUDE` match, and match exact or wildcard hosts.
   - Update default destructive regex in `INITIAL_RULES` to `.*[/\\.](logout|signout|delete-account|terminate|drop-db).*`.
   - Add schema sanitization in `importRulesJson`.
2. In `src/ipc/mockBridge.ts`:
   - Update `classifyPattern` in `updateScope` to prioritize `REGEX`, then `URL_PREFIX` (`http://`, `https://`, `/`), then `IP_CIDR`, then `HOST`.
   - Update `testScopeUri` hostname extraction to match exact host and wildcard subdomains (`*.domain`).
3. In `src/stores/projectStore.ts`:
   - Add `await get().fetchRecentProjects();` in `createProject`, `openProject`, and `importProject`.
   - In `openProject`, synchronize `useScopeStore` with `state.scope`.
4. In `src-tauri/src/commands.rs`:
   - In `cmd_project_wal_checkpoint`, query active `ProjectStorage` pool for `PRAGMA wal_checkpoint(TRUNCATE);` and real PRAGMA page metrics.
   - In `cmd_project_export`, calculate real SHA-256 digest with `sha2` crate (or streaming hash) and genuine file counts/lengths.
5. In `tests/stress/`:
   - Resolve all TypeScript compiler errors TS6133/TS2459 across `AdversarialChallengeUI2.test.tsx`, `ScopeEngineAdversarialUI2.stress.test.ts`, and `ScopeEngineDeepAttacks.stress.test.ts`.
   - Add `beforeEach` reset in `ScopeEngineAdversarialUI2.stress.test.ts` to guarantee test hermeticity.

Verification requirements:
- Run `npm run build` (`tsc && vite build`) and confirm 0 errors.
- Run `npx vitest run` and confirm 100% test pass across all unit and stress tests.
- Run `& "$env:USERPROFILE\.cargo\bin\cargo.exe" check --manifest-path src-tauri/Cargo.toml` and confirm clean compilation.
- Run `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --package sentinel_scope` and confirm 54/54 tests pass.

Write your changes report to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui2_2\changes.md` and complete handoff to `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_ui2_2\handoff.md`. Send a message when finished.

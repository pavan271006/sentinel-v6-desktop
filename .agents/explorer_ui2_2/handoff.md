# Handoff Report: Phase UI-2 Remediation Forensic Investigation

> **Agent**: Explorer UI-2 (2)  
> **Role**: Investigator / Synthesizer  
> **Milestone**: Phase UI-2 (Project Lifecycle & Scope Engine Quality Gate Remediation)  
> **Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_ui2_2`  
> **Date**: 2026-08-17  
> **Handoff Type**: Hard (Task Complete)

---

## 1. Observation

Direct empirical observations, error traces, and exact code locations verified during this investigation:

### 1.1 `npm run build` Execution Failure
Command: `npm run build` (`tsc && vite build`) exited with code 1:
```text
> sentinel-v6-desktop@6.0.0 build
> tsc && vite build

tests/stress/AdversarialChallengeUI2.test.tsx(217,11): error TS6133: 'callbackExecuted' is declared but its value is never read.
tests/stress/AdversarialChallengeUI2.test.tsx(234,11): error TS6133: 'callbackExecuted' is declared but its value is never read.
tests/stress/ScopeEngineAdversarialUI2.stress.test.ts(2,25): error TS2459: Module '"../../src/stores/scopeStore"' declares 'ScopeRuleDef' locally, but it is not exported.
tests/stress/ScopeEngineAdversarialUI2.stress.test.ts(82,13): error TS6133: 'store' is declared but its value is never read.
tests/stress/ScopeEngineDeepAttacks.stress.test.ts(97,13): error TS6133: 'initialCount' is declared but its value is never read.
```

### 1.2 `npx vitest run` Execution Failures (4 Tests Failing)
Command: `npx vitest run` executed 30 test files (162 tests) with 4 failures:
1. `tests/stress/ScopeEngineAdversarialUI2.stress.test.ts:91:34` (`strictly enforces EXCLUDE precedence over INCLUDE rules (SEC-01 Invariant)`):
   `AssertionError: expected false to be true` (testing `https://target.local/api/v1/profile` after exclude rule added).
2. `tests/stress/ScopeEngineAdversarialUI2.stress.test.ts:294:23` (`immediately executes action callback for verified in-scope targets`):
   `AssertionError: expected false to be true`.
3. `tests/stress/ScopeEngineAdversarialUI2.stress.test.ts:331:87` (`creates new project, initializes metadata, and tracks in recent projects`):
   `AssertionError: expected false to be true`.
4. `tests/stress/ScopeEngineDeepAttacks.stress.test.ts:70:34` (`prevents attacker domain with target name as subdomain prefix or suffix`):
   `AssertionError: expected true to be false` (testing `https://target.local.attacker.com/steal`).

### 1.3 Hardcoded Backend Stubs in `src-tauri/src/commands.rs`
- **Lines 313–326 (`cmd_project_export`)**:
  ```rust
  #[tauri::command]
  pub async fn cmd_project_export(
      _path: String,
      dest_zip: String,
      sanitized: Option<bool>,
  ) -> Result<ProjectExportResult, String> {
      let is_san = sanitized.unwrap_or(false);
      Ok(ProjectExportResult {
          success: true,
          archive_path: dest_zip,
          file_count: if is_san { 12 } else { 28 },
          total_bytes: if is_san { 4500000 } else { 14200000 },
          sha256_checksum: "a8f5c4e2b10938f293847291aebdcfa92847291837492817492048291049ab28".to_string(),
      })
  }
  ```
- **Lines 348–358 (`cmd_project_wal_checkpoint`)**:
  ```rust
  #[tauri::command]
  pub async fn cmd_project_wal_checkpoint(
      _state: State<'_, AppState>,
  ) -> Result<WalStatusResult, String> {
      Ok(WalStatusResult {
          journal_mode: "WAL".to_string(),
          page_count: 3468,
          page_size: 4096,
          freelist_count: 12,
          checkpoint_applied: true,
      })
  }
  ```

### 1.4 Exclude-Override & Substring Host Spoofing in `src/stores/scopeStore.ts`
- **Lines 290–325 (`checkSafetyGate`)**:
  ```typescript
  for (const rule of rules.filter((r) => r.enabled && r.rule_type === 'EXCLUDE')) {
    if (rule.pattern_type === 'HOST' && targetUri.includes(rule.pattern)) {
      allowed = false;
      break;
    }
    ...
  }
  for (const rule of rules.filter((r) => r.enabled && r.rule_type === 'INCLUDE')) {
    if (rule.pattern_type === 'HOST' && targetUri.includes(rule.pattern)) {
      allowed = true;
      break;
    }
    ...
  }
  if (allowed) {
    onConfirm();
    return true;
  }
  ```

### 1.5 Pattern Misclassification in `src/ipc/mockBridge.ts`
- **Line 305 (`updateScope`)**:
  ```typescript
  pattern_type: (exc.startsWith('^') || exc.includes('.*') ? 'REGEX' : exc.includes('/') ? 'IP_CIDR' : 'HOST') as any
  ```
  `exc.includes('/')` classifies `https://target.local/admin` as `IP_CIDR`. In `testScopeUri` (line 378), `rule.pattern.split('/')[0]` produces `"https:"`, causing ALL `https://` URLs to match the exclusion rule and fail.

### 1.6 Un-awaited Async Dispatches in `src/stores/projectStore.ts`
- Lines 103, 135, 203: `get().fetchRecentProjects();` called without `await`.
- Lines 116–137 (`openProject`): `useScopeStore` is never synchronized with `state.scope`.

---

## 2. Logic Chain

1. **Build Integrity Invariant**: Strict TypeScript compilation (`tsc`) is the initial barrier in the quality gate. Unused variables in `tests/stress/` (TS6133) and unexported types (TS2459) in `scopeStore.ts` block `npm run build`.
2. **Security Invariant Verification (SEC-01, SEC-02, SEC-03)**:
   - SEC-01 dictates fail-closed scope where EXCLUDE rules strictly override INCLUDE rules.
   - `scopeStore.ts:checkSafetyGate` evaluates EXCLUDE rules first, but fails to terminate immediately upon match, dropping into the INCLUDE loop where parent domain rules override the exclusion.
   - Using `.includes()` for hostname evaluation permits attacker domains like `evil.com/?q=target.local` or `target.local.attacker.com` to bypass safety modals.
3. **Backend Truth & Facade Prohibition**:
   - `cmd_project_export` and `cmd_project_wal_checkpoint` in `src-tauri/src/commands.rs` return static hardcoded SHA-256 strings and page counts instead of executing SQLite operations and file hashing on `ProjectStorage`.
4. **State Consistency & Hermeticity**:
   - Omitting `await` on `fetchRecentProjects()` introduces race conditions where callers read stale recent projects.
   - Omitting scope synchronization in `openProject` leaves previous project scope rules active.
   - In-memory Zustand state leakage between test sections in `ScopeEngineAdversarialUI2.stress.test.ts` caused cascading assertion failures.

---

## 3. Caveats

- **Core Rust Foundation Crates**: `sentinel_storage`, `sentinel_scope`, `sentinel_bus`, and the other 24 workspace crates in `sentinel_core` pass 100% (245/245 tests). The defects are strictly localized to:
  1. `src/stores/scopeStore.ts`
  2. `src/stores/projectStore.ts`
  3. `src/ipc/mockBridge.ts`
  4. `src-tauri/src/commands.rs`
  5. `tests/stress/*.ts(x)` test setup and typing.
- **Spec Validator**: `python architecture/v6/validate_v6_spec.py` passes 11/11 checks (0 blockers, 0 warnings).
- **Tauri Rust Check**: `cargo check --manifest-path src-tauri/Cargo.toml` compiles cleanly.

---

## 4. Conclusion

All 7 core defects and 2 supplementary vulnerabilities are mapped with exact line numbers and concrete remediation diffs in `.agents/explorer_ui2_2/analysis.md`.

**Action Items for Worker UI-2 Remediation**:
1. **`src/stores/scopeStore.ts`**:
   - Re-export `ScopeRuleDef`: `export type { ScopeRuleDef } from '../ipc/contracts';`.
   - Update `checkSafetyGate` to extract hostname via `URL` parsing, immediately return `false` on any active `EXCLUDE` match, and match exact or wildcard hosts.
   - Update default destructive regex in `INITIAL_RULES` to `.*[/\\.](logout|signout|delete-account|terminate|drop-db).*`.
   - Add schema sanitization in `importRulesJson`.
2. **`src/ipc/mockBridge.ts`**:
   - Update `classifyPattern` in `updateScope` to prioritize `REGEX`, then `URL_PREFIX` (`http://`, `https://`, `/`), then `IP_CIDR`, then `HOST`.
   - Update `testScopeUri` hostname extraction to match exact host and wildcard subdomains (`*.domain`).
3. **`src/stores/projectStore.ts`**:
   - Add `await get().fetchRecentProjects();` in `createProject`, `openProject`, and `importProject`.
   - In `openProject`, synchronize `useScopeStore` with `state.scope`.
4. **`src-tauri/src/commands.rs`**:
   - In `cmd_project_wal_checkpoint`, query active `ProjectStorage` pool for `PRAGMA wal_checkpoint(TRUNCATE);` and real PRAGMA page metrics.
   - In `cmd_project_export`, calculate real SHA-256 digest with `sha2` and file counts/lengths.
5. **`tests/stress/`**:
   - Remove unused declarations in `AdversarialChallengeUI2.test.tsx`, `ScopeEngineAdversarialUI2.stress.test.ts`, and `ScopeEngineDeepAttacks.stress.test.ts`.
   - Add `beforeEach` store reset in `ScopeEngineAdversarialUI2.stress.test.ts` to ensure test hermeticity.

---

## 5. Verification Method

To verify the remediation:

1. **Verify TypeScript Compilation**:
   ```bash
   npm run build
   ```
   *Expected*: Exits with code 0 (0 errors, 0 warnings).

2. **Verify All Vitest Unit and Stress Tests**:
   ```bash
   npx vitest run
   ```
   *Expected*: 30 test files, 162+ tests passing, 0 failures.

3. **Verify Adversarial Stress Tests Specifically**:
   ```bash
   npx vitest run tests/stress/ScopeEngineAdversarialUI2.stress.test.ts tests/stress/ScopeEngineDeepAttacks.stress.test.ts tests/stress/CheckSafetyGateAudit.test.ts
   ```
   *Expected*: 100% tests passing.

4. **Verify Tauri Backend Compilation**:
   ```bash
   & "$env:USERPROFILE\.cargo\bin\cargo.exe" check --manifest-path src-tauri/Cargo.toml
   ```
   *Expected*: Compiles cleanly with 0 errors.

5. **Verify Scope Backend Tests**:
   ```bash
   & "$env:USERPROFILE\.cargo\bin\cargo.exe" test --package sentinel_scope
   ```
   *Expected*: 54/54 tests passing.

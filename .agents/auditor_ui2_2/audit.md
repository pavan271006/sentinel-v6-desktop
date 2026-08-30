# Forensic Audit Report: Phase UI-2 (Project Lifecycle & Scope Engine Quality Gate)

**Work Product**: `src/stores/projectStore.ts`, `src/stores/scopeStore.ts`, `src/ipc/mockBridge.ts`, `src-tauri/src/commands.rs`, `tests/stress/`  
**Auditor**: Forensic Auditor UI-2 (2)  
**Integrity Mode**: Development (per `ORIGINAL_REQUEST.md`)  
**Verdict**: 🔴 **INTEGRITY VIOLATION**

---

## 1. Executive Summary

Phase UI-2 underwent strict forensic verification following remediation by Worker UI-2 (2). 
While significant progress was achieved (TypeScript compilation is clean, facade constants in `src-tauri/src/commands.rs` were eliminated, SEC-01 fail-closed exclusion logic and exact hostname matching were introduced into `checkSafetyGate`, and 54/54 Rust tests pass), **behavioral verification failed** on full suite execution (`npx vitest run`).

Execution of `npx vitest run` ran 31 test files (175 tests), resulting in **1 failed test file and 3 failed tests** in `tests/stress/ChallengerUI2QualityGate.stress.test.ts`:
1. `openProject` in `src/stores/projectStore.ts` contains a state synchronization regression: after computing and setting active inclusion rule count (2), it immediately overwrites `appShellStore.scopeRulesCount` with `metadata.scope_rules_count` (6), failing the AppShell state synchronization assertion.
2. In-loop regex compilation and unmemoized localStorage deserialization during 1,000+ scope rule evaluations cause average latency to exceed the `<1.0ms` quality gate budget (yielding 1.15ms–1.48ms for `checkSafetyGate` and 2.51ms–4.10ms for `mockBackendBridge.testScopeUri`).

Under the strict quality gate mandate (0 failing tests, 100% test pass required), the work product must be rejected.

---

## 2. Phase Results & Empirical Evidence

### Phase 1: Source Code & Static Analysis

| Check | Status | Empirical Observation |
|---|---|---|
| **Elimination of Facades in `commands.rs`** | **PASS** | `cmd_project_wal_checkpoint` now executes `enforce_pragmas` and `check_pragmas` against `ProjectStorage` and reads physical database page allocations. `cmd_project_export` computes SHA-256 digests via `sentinel_storage::BlobStorage::compute_sha256` rather than returning hardcoded constants. |
| **Fail-Closed Exclusion Precedence** | **PASS** | `src/stores/scopeStore.ts:checkSafetyGate` iterates all active `EXCLUDE` rules first and executes an immediate `return false` if any match, preventing `INCLUDE` rules from overriding exclusions (SEC-01). |
| **Exact / Wildcard Hostname Matching** | **PASS** | `extractHost` and `matchesRulePattern` / `matchHostPattern` parse target hostname and match exact apex or wildcard subdomain rules (`*.target.local`), rejecting arbitrary substring spoofing (`attacker.com/?q=target.local`). |
| **TypeScript Build Compilation (`tsc && vite build`)** | **PASS** | `npm run build` exited with code 0. 1653 modules transformed cleanly with 0 TypeScript compiler errors (TS6133 and TS2459 resolved). |
| **Rust Backend Verification (`cargo check` & `cargo test`)** | **PASS** | `cargo check --manifest-path src-tauri/Cargo.toml` exited 0. `cargo test --manifest-path sentinel_core/Cargo.toml --package sentinel_scope` passed 54/54 tests with 0 failures. |

---

### Phase 2: Behavioral Verification & Test Execution

| Check | Status | Empirical Observation |
|---|---|---|
| **Vitest Full Test Suite Execution (`npx vitest run`)** | **FAIL** | 30 test files passed (172 tests), 1 test file failed (3 failed tests in `tests/stress/ChallengerUI2QualityGate.stress.test.ts`). |
| **State Synchronization Invariant (DEF-10)** | **FAIL** | In `src/stores/projectStore.ts:openProject`, line 141 (`useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count)`) overwrites line 135 (`(state.scope.rules || []).filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length`), causing `appShellStore.scopeRulesCount` to receive 6 instead of 2. |
| **1,000+ Rule Latency Gate (DEF-11)** | **FAIL** | `checkSafetyGate` average latency: 1.15ms–1.48ms (expected <1.0ms). `mockBackendBridge.testScopeUri` average latency: 2.51ms–4.10ms (expected <1.0ms) due to `loadStorage` JSON deserialization and dynamic `new RegExp` creation inside the 1,000-rule evaluation loop. |

---

## 3. Raw Tool Output & Proof of Failures

### 3.1 `npm run build` (PASS)
```text
> sentinel-v6-desktop@6.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 1653 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.84 kB │ gzip:   0.48 kB
dist/assets/index-C2MRT41-.css   27.61 kB │ gzip:   6.19 kB
dist/assets/event-CNdo2oXa.js     1.44 kB │ gzip:   0.69 kB
dist/assets/core-DhEqZVGG.js      2.44 kB │ gzip:   0.98 kB
dist/assets/index-Cfy8gS7A.js   419.08 kB │ gzip: 112.20 kB
✓ built in 42.86s
```

### 3.2 `npx vitest run` (FAIL)
```text
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/stress/ChallengerUI2QualityGate.stress.test.ts > Challenger UI-2 Empirical Quality Gate: Concurrency, Scale & Memory Bounds > 1. Async Concurrency & Zustand Hermeticity > atomically synchronizes useScopeStore when openProject loads project with scope rules
AssertionError: expected 6 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 6 

 ❯ tests/stress/ChallengerUI2QualityGate.stress.test.ts:121:45
    119|       const appShellState = useAppShellStore.getState();
    120|       const expectedIncludeCount = scopeState.rules.filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length;
    121|       expect(appShellState.scopeRulesCount).toBe(expectedIncludeCount);
       |                                             ^
    122|     });
    123| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  tests/stress/ChallengerUI2QualityGate.stress.test.ts > Challenger UI-2 Empirical Quality Gate: Concurrency, Scale & Memory Bounds > 2. 1000+ Scope Rules Scalability & <1ms Latency Benchmark > evaluates single URL against 1,000+ rules in <1ms latency (frontend checkSafetyGate)
AssertionError: expected 1.1526340000000255 to be less than 1
 ❯ tests/stress/ChallengerUI2QualityGate.stress.test.ts:253:26
    251| 
    252|       // Strict Quality Gate Requirement: average latency < 1ms
    253|       expect(avgLatency).toBeLessThan(1.0);
       |                          ^
    254|       expect(p50).toBeLessThan(1.0);
    255|       expect(p95).toBeLessThan(1.0);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  tests/stress/ChallengerUI2QualityGate.stress.test.ts > Challenger UI-2 Empirical Quality Gate: Concurrency, Scale & Memory Bounds > 2. 1000+ Scope Rules Scalability & <1ms Latency Benchmark > evaluates single URL against 1,000+ rules in mockBackendBridge with <1ms per evaluation
AssertionError: expected 2.515056000000004 to be less than 1
 ❯ tests/stress/ChallengerUI2QualityGate.stress.test.ts:298:26
    296|       console.log(`[Backend Bridge 1000 Rules Benchmark] avg: ${avgLatency.toFixed(4)}ms, min: ${Math.min(...latencies).toFixed(4)}ms, max: ${Math.max(...latencies).toFixed(4)}ms`);
    297| 
    298|       expect(avgLatency).toBeLessThan(1.0);
       |                          ^
    299|     });
    300| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

 Test Files  1 failed | 30 passed (31)
      Tests  3 failed | 172 passed (175)
```

---

## 4. Remediation Plan for Worker UI-2

To achieve 100% Quality Gate signoff:

1. **Fix `src/stores/projectStore.ts:openProject` (DEF-10)**:
   In `openProject(path: string)`:
   ```typescript
   if (state.scope) {
     useScopeStore.setState({
       scopeId: state.scope.id,
       version: state.scope.version,
       timestamp: state.scope.timestamp,
       rules: state.scope.rules || [],
     });
     useAppShellStore.getState().setScopeRulesCount(
       (state.scope.rules || []).filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
     );
   } else {
     useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count);
   }

   useAppShellStore.getState().setActiveProjectName(state.metadata.name);
   // Remove unconditional setScopeRulesCount(state.metadata.scope_rules_count) here
   ```

2. **Optimize 1,000+ Scope Rules Evaluation Latency (DEF-11)**:
   - In `src/ipc/mockBridge.ts:testScopeUri`:
     Avoid calling `await this.getScope()` (which reads and parses JSON from `localStorage`) on every single URL evaluation when rules are passed or cached. Read cached rules in-memory.
     Pre-compile or normalize regex objects rather than instantiating `new RegExp()` repeatedly inside the rule iteration loop.
   - In `src/stores/scopeStore.ts:checkSafetyGate` / `matchesRulePattern`:
     Pre-cache compiled regex on the rule object or use a regex cache map to prevent dynamic compilation overhead during bulk evaluations.

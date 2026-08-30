# Phase UI-2 Quality Gate Challenger Report: Scope Engine & Project Lifecycle

> **Agent**: Challenger UI-2 (1)  
> **Role**: Empirical Challenger / Critic / Specialist  
> **Milestone**: Phase UI-2 (Project Lifecycle & Scope Engine Quality Gate)  
> **Verdict**: 🔴 **REQUEST_CHANGES**  
> **Date**: 2026-08-17  
> **Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\challenger_ui2_1`

---

## 1. Observation

Direct empirical observations, error traces, and test execution results from executing adversarial stress suites against Phase UI-2 implementation:

### 1.1 Test Suite Execution Results
- **Rust Backend Suite (`cargo test --package sentinel_scope`)**:
  ```
  running 16 tests in src/lib.rs ... ok
  running 2 tests in tests/cross_crate_security.rs ... ok
  running 4 tests in tests/exclusion_precedence_tests.rs ... ok
  running 5 tests in tests/fail_closed_tests.rs ... ok
  running 5 tests in tests/hostname_matcher_tests.rs ... ok
  running 6 tests in tests/ip_cidr_matcher_tests.rs ... ok
  running 3 tests in tests/performance_benchmarks.rs ... ok
  running 2 tests in tests/scope_violation_event_tests.rs ... ok
  running 4 tests in tests/ssrf_defense_tests.rs ... ok
  running 7 tests in tests/url_matcher_tests.rs ... ok
  test result: ok. 54 passed; 0 failed.
  ```

- **Adversarial Stress Test Suites (`npx vitest run tests/stress/ScopeEngineAdversarialUI2.stress.test.ts tests/stress/ScopeEngineDeepAttacks.stress.test.ts`)**:
  ```
  FAIL tests/stress/ScopeEngineDeepAttacks.stress.test.ts > 2. Domain Boundary & Substring Spoofing Evasions > prevents attacker domain with target name as subdomain prefix or suffix
  AssertionError: expected true to be false
  - Expected: false
  + Received: true
    at tests/stress/ScopeEngineDeepAttacks.stress.test.ts:70:34 (testing https://target.local.attacker.com/steal)

  FAIL tests/stress/ScopeEngineAdversarialUI2.stress.test.ts > 2. Scope Evaluation Engine > strictly enforces EXCLUDE precedence over INCLUDE rules
  AssertionError: expected false to be true
  - Expected: true
  + Received: false
    at tests/stress/ScopeEngineAdversarialUI2.stress.test.ts:91:34 (testing https://target.local/api/v1/profile after adding https://target.local/admin/destructive exclude rule)

  FAIL tests/stress/ScopeEngineAdversarialUI2.stress.test.ts > 4. Safety Gate > immediately executes action callback for verified in-scope targets
  AssertionError: expected false to be true
  - Expected: true
  + Received: false
    at tests/stress/ScopeEngineAdversarialUI2.stress.test.ts:294:23

  FAIL tests/stress/ScopeEngineAdversarialUI2.stress.test.ts > 5. Project Lifecycle > creates new project, initializes metadata, and tracks in recent projects
  AssertionError: expected false to be true
  - Expected: true
  + Received: false
    at tests/stress/ScopeEngineAdversarialUI2.stress.test.ts:331:87
  ```

---

### 1.2 Identified Code Defects

#### Finding 1 (HIGH RISK): Substring Domain Matching Bypass in Mock Evaluator & Safety Gate
- **Files & Lines**:
  - `src/ipc/mockBridge.ts:375`, `src/ipc/mockBridge.ts:429`
  - `src/stores/scopeStore.ts:300`, `src/stores/scopeStore.ts:310`
- **Observed Code**:
  ```ts
  // mockBridge.ts:428-430
  } else {
    matched = urlStr.includes(rule.pattern);
  }
  ```
  ```ts
  // scopeStore.ts:309-311
  if (rule.pattern_type === 'HOST' && targetUri.includes(rule.pattern)) {
    allowed = true;
    break;
  }
  ```
- **Observed Failure**:
  When inclusion rule is `HOST: target.local`:
  - `https://target.local.attacker.com/steal` evaluates to `in_scope: true` (ALLOW).
  - `https://evil-target.local/` evaluates to `in_scope: true` (ALLOW).
  - `https://attacker.com/target.local` evaluates to `in_scope: true` (ALLOW).
  - `https://attacker.com/?search=target.local` evaluates to `in_scope: true` (ALLOW).

#### Finding 2 (MEDIUM RISK): URL Prefix Exclusions Misclassified as `IP_CIDR` in `mockBridge.ts`
- **Files & Lines**: `src/ipc/mockBridge.ts:305`
- **Observed Code**:
  ```ts
  pattern_type: (exc.startsWith('^') || exc.includes('.*') ? 'REGEX' : exc.includes('/') ? 'IP_CIDR' : 'HOST') as any
  ```
- **Observed Failure**:
  Because `exc.includes('/')` triggers on `https://`, any URL exclusion pattern like `https://target.local/admin/*` or `/auth/logout` is tagged as `IP_CIDR`. During `testScopeUri` (line 378), `rule.pattern.split('/')[0]` produces `"https:"`, causing **ALL** `https://` URLs to match the exclusion rule and be dropped.

#### Finding 3 (MEDIUM RISK): Incomplete Rule Type Support in `scopeStore.ts:checkSafetyGate`
- **Files & Lines**: `src/stores/scopeStore.ts:299-318`
- **Observed Code**:
  `checkSafetyGate` only checks `pattern_type === 'HOST'` and `pattern_type === 'REGEX'`. It ignores `pattern_type === 'IP_CIDR'` exclusions (e.g. `127.0.0.1/32`, `10.0.0.0/8`) and does not strip `*.` prefixes for wildcard host rules.

#### Finding 4 (LOW RISK): Missing `await` on Async `fetchRecentProjects()` in `projectStore.ts:createProject`
- **Files & Lines**: `src/stores/projectStore.ts:103`
- **Observed Code**:
  `get().fetchRecentProjects();` is called without `await`, causing immediate callers of `createProject()` to observe stale `recentProjects` state prior to promise resolution.

#### Finding 5 (LOW RISK): Schema Validation Gap in `scopeStore.ts:importRulesJson`
- **Files & Lines**: `src/stores/scopeStore.ts:353-358`
- **Observed Code**:
  `importRulesJson` validates `Array.isArray(parsed)`, but does not sanitize or validate elements within the array. Importing `[null]` or `[{}]` can cause `TypeError` during rule filtering or render broken cards with `undefined` patterns.

---

## 2. Logic Chain

1. **Security Policy Contract (SEC-01 Fail-Closed Invariant)**:
   The scope engine is the primary safety boundary for all active pentesting tooling (Proxy, Repeater, Scanner, Fuzzer). A target must be classified as in-scope ONLY if its exact hostname or legitimate subdomain explicitly matches an active inclusion rule and is not excluded.
2. **Domain Boundary Evasion (Observation 1.2, Finding 1)**:
   Because `mockBridge.ts` and `scopeStore.ts:checkSafetyGate` use raw substring containment (`urlStr.includes(rule.pattern)`), an attacker-controlled URI containing the target domain anywhere in the subdomain, path, or query string bypasses the boundary and is evaluated as `in_scope: true`.
3. **Exclusion Engine Invalidation (Observation 1.2, Finding 2)**:
   Because `updateScope` treats any exclusion containing a slash as `IP_CIDR`, adding standard URL exclusions corrupts the evaluation engine by dropping all HTTPS traffic indiscriminately.
4. **Conclusion**:
   These flaws represent real security regressions in the scope evaluation layer that must be corrected before advancing past the Phase UI-2 Quality Gate.

---

## 3. Caveats

- The core Rust backend (`sentinel_core/crates/sentinel_scope`) is fully verified (54/54 tests passing) and correctly parses URLs and hostnames. The defects are concentrated in the frontend store logic (`src/stores/scopeStore.ts`), mock bridge (`src/ipc/mockBridge.ts`), and project store promise handling (`src/stores/projectStore.ts`).
- In native Tauri mode, requests routed directly through `cmd_test_scope_uri` use `sentinel_scope::DefaultScopeEngine`, which enforces proper hostname parsing; however, in browser testing, mock fallback, and the frontend `checkSafetyGate` modal trigger, the frontend JavaScript logic is executed directly.

---

## 4. Conclusion & Required Actions

**Verdict**: 🔴 **REQUEST_CHANGES**

Worker UI-2 must resolve the following items to satisfy the Phase UI-2 Quality Gate:

1. **Fix Host Pattern Matching in `mockBridge.ts` & `scopeStore.ts`**:
   - Extract the target hostname properly (e.g. via `new URL(uri).hostname` or regex `/^https?:\/\/([^/:?#]+)/i`).
   - For exact host: match `targetHostname === pattern.toLowerCase()`.
   - For wildcard `*.domain.com`: match `targetHostname === domain || targetHostname.endsWith('.' + domain)`.
2. **Fix Exclusion Pattern Classification in `mockBridge.ts:updateScope`**:
   - Order type detection: check `startsWith('^')` -> `REGEX`, `startsWith('http')` or `starts_with('/')` -> `URL_PREFIX`, `/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/` -> `IP_CIDR`, etc.
3. **Upgrade `checkSafetyGate` in `scopeStore.ts`**:
   - Ensure `checkSafetyGate` properly handles `IP_CIDR`, `URL_PREFIX`, and wildcard `HOST` patterns.
4. **Fix `createProject` Async Await in `projectStore.ts`**:
   - `await get().fetchRecentProjects();` before returning metadata.
5. **Add Schema Sanitization in `importRulesJson`**:
   - Filter imported rules to ensure only valid objects with non-empty `id`, `pattern`, `rule_type`, and `pattern_type` are committed to state.

---

## 5. Verification Method

Once fixes are applied, re-run the verification commands:

```bash
# 1. Run all Vitest unit and stress test suites:
npx vitest run

# 2. Run adversarial stress suites specifically:
npx vitest run tests/stress/ScopeEngineAdversarialUI2.stress.test.ts tests/stress/ScopeEngineDeepAttacks.stress.test.ts

# 3. Verify Rust backend test suite:
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --package sentinel_scope
```

*Expected Verification Outcome*: All Vitest and Cargo test suites pass with 100%, 0 failures, and 0 warnings.

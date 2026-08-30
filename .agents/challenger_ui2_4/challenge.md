# Adversarial Challenge Report — Phase UI-2 Quality Gate

**Agent**: Challenger UI-2 (4)  
**Role**: Critic / Specialist (Empirical Challenger)  
**Target Milestone**: Phase UI-2 (Project Lifecycle & Scope Engine Quality Gate)  
**Evaluation Date**: 2026-08-17  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Executive Summary

An empirical adversarial audit of Phase UI-2 (`projectStore.ts`, `scopeStore.ts`, `mockBridge.ts`, and associated IPC contracts) was executed using stress harnesses probing:
1. Async concurrency & Zustand state hermeticity under 100 rapid concurrent triggers.
2. Scope evaluation scalability across 1,000+ to 5,000 rules (<1ms latency requirement).
3. Memory bounds & leak profiling across 10,000 evaluations and 200 import/export cycles.
4. Security invariants (SEC-01 fail-closed exclusion precedence, SSRF defense, ReDoS resistance).

While memory bounds (capped 500 violation ring buffer, 2.01MB delta across 10k evaluations) and core security invariants (SSRF pre-socket drop, exclude precedence over 500 inclusion rules) passed decisively, **two actionable defect categories were empirically discovered**:
1. **Defect UI2-C1**: State desynchronization in `useProjectStore.openProject` where `state.metadata.scope_rules_count` (total rules) unconditionally overwrites the active inclusion count computed from `state.scope`.
2. **Defect UI2-C2**: Latency SLA violation on 1,000+ rules evaluation in `mockBackendBridge.ts:testScopeUri` (measured **3.41ms** average, max 22.25ms) and `scopeStore.ts:checkSafetyGate` with uncached regex rules (measured **1.20ms** average, p99 16.87ms), failing the `<1ms` threshold.

---

## 2. Challenge Findings & Defect Analysis

### [HIGH] Challenge 1: Zustand Scope Rules Count State Desynchronization in `openProject`
- **Location**: `src/stores/projectStore.ts`, lines 128–142
- **Empirical Observation**:
  ```ts
  128: if (state.scope) {
  129:   useScopeStore.setState({
  130:     scopeId: state.scope.id,
  131:     version: state.scope.version,
  132:     timestamp: state.scope.timestamp,
  133:     rules: state.scope.rules || [],
  134:   });
  135:   useAppShellStore.getState().setScopeRulesCount(
  136:     (state.scope.rules || []).filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
  137:   );
  138: }
  139: 
  140: useAppShellStore.getState().setActiveProjectName(state.metadata.name);
  141: useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count);
  ```
- **Failure Mode**:
  Line 135 correctly calculates the active inclusion rules (e.g. 2), but line 141 unconditionally calls `setScopeRulesCount(state.metadata.scope_rules_count)` (e.g. 6). This causes `useAppShellStore` to report the total rules count rather than active inclusion targets, conflicting with `useScopeStore`'s convention across all other store actions.
- **Blast Radius**: AppShell top bar / badge displays incorrect active scope target count upon project open.
- **Recommended Remediation**:
  Only set `useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count)` when `!state.scope`.

---

### [MEDIUM] Challenge 2: Scope Evaluation Latency on 1,000+ Rules Exceeds 1ms SLA
- **Location**: `src/ipc/mockBridge.ts:testScopeUri` & `src/stores/scopeStore.ts:matchesRulePattern`
- **Empirical Observations**:
  1. `mockBackendBridge.testScopeUri`:
     - Calls `this.getScope()` on every URI test, invoking `loadStorage` -> `JSON.parse(localStorage.getItem(...))` on a 1,000-rule array (~2.5ms overhead).
     - Allocates and pushes 1,000 verbose `provenance_steps` objects on every single URI test.
     - Measured Latency: **3.4124ms average**, min: 1.0772ms, max: 22.2514ms (Failed `<1ms` threshold).
  2. `scopeStore.checkSafetyGate`:
     - Evaluates regex rules using inline `new RegExp(rule.pattern, 'i').test(uri)` without compilation caching.
     - With 1,500 rules (including 300 regex patterns), measured latency: **1.2035ms average**, p95: 2.7296ms, p99: 16.8662ms (Failed `<1ms` threshold).
- **Blast Radius**: High-frequency traffic interception or automated scanner replay will suffer CPU latency spikes during in-memory scope checks.
- **Recommended Remediation**:
  - In `mockBridge.ts`: Cache in-memory scope rules instead of re-parsing JSON from `localStorage` on every `testScopeUri` call; only record provenance steps for matching rules or truncate non-matching steps.
  - In `scopeStore.ts` and `mockBridge.ts`: Implement a simple compiled `RegExp` cache (e.g., `Map<string, RegExp>`) for `pattern_type === 'REGEX'`.

---

## 3. Stress Test Results Summary

| Test Scenario | Target | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| 100 Rapid Concurrent Operations | `projectStore` | Hermetic state, 0 deadlocks | 100 concurrent promises resolved cleanly, `isLoading: false` | **PASS** |
| Interleaved Create / Close Race | `projectStore` | Consistent state | Clean settlement, valid metadata or null | **PASS** |
| Scope Sync on Project Open | `projectStore` / `appShellStore` | Scope badge matches active includes | Overwritten by total rules count (6 instead of 2) | **FAIL** (Defect C1) |
| IPC Error Burst Recovery | `projectStore` | `isLoading: false`, error cleared on retry | Clean error capture and recovery | **PASS** |
| 1,500 Rules Latency (`checkSafetyGate`) | `scopeStore` | < 1.0ms avg latency | 1.2035ms avg (p50: 0.54ms, p99: 16.87ms) | **FAIL** (Defect C2) |
| 1,000 Rules Latency (`testScopeUri`) | `mockBridge` | < 1.0ms avg latency | 3.4124ms avg (min: 1.08ms, max: 22.25ms) | **FAIL** (Defect C2) |
| 5,000 Rules Scale & Default Deny | `scopeStore` | Linear scaling & fail-closed deny | 100% fail-closed default deny enforced | **PASS** |
| 10,000 Scope Checks Memory Delta | `scopeStore` | < 30MB heap delta | **2.01 MB** delta | **PASS** |
| 2,000 Violations Ring Buffer | `scopeStore` | Bounded to 500 items max | Capped at exactly 500 items FIFO | **PASS** |
| 200 Cycles 1k Rules JSON Import/Export | `scopeStore` | < 40MB heap delta | **11.54 MB** delta | **PASS** |
| ReDoS Attack Resistance | `scopeStore` | Pathological regex < 100ms | **0.23 ms** execution, 0 hang | **PASS** |
| FQDN Trailing Dot, Upper Case & Port | `scopeStore` | Correct normalization & allow | Normalizes and matches apex target | **PASS** |
| Exclude Precedence (500 Inc vs 1 Exc) | `scopeStore` | Immediate DENY (SEC-01) | Immediate pre-socket drop (SEC-01) | **PASS** |

---

## 4. Verdict & Next Steps

**Verdict**: **REQUEST_CHANGES**

To achieve full Quality Gate approval for Phase UI-2:
1. Fix line 141 in `src/stores/projectStore.ts` so `state.metadata.scope_rules_count` does not overwrite the active inclusion count when `state.scope` is present.
2. In `src/ipc/mockBridge.ts:testScopeUri`, avoid re-parsing localStorage JSON per evaluation and avoid allocating 1,000 non-matching provenance step objects.
3. In `src/stores/scopeStore.ts` and `src/ipc/mockBridge.ts`, add RegExp compilation caching for regex rules to ensure 1,000+ rules evaluate with `<1ms` latency.

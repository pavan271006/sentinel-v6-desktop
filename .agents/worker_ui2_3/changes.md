# Phase UI-2 Iteration 3 Remediation Changes

## Summary of Modifications

### 1. `src/stores/projectStore.ts`
- **Issue**: `openProject` was unconditionally overwriting the active inclusion count in `useAppShellStore` with stale `metadata.scope_rules_count` (which counted all rules instead of active inclusion rules), violating state synchronization invariants.
- **Fix**: Removed unconditional overwrite. Added check to preserve active inclusion rule count calculated from `state.scope` (fallback to `metadata.scope_rules_count` only if `!state.scope`).
- **Additional cleanup**: Added `useAppShellStore.getState().setScopeRulesCount(0)` in `closeProject` to clean up active badges on project teardown.

### 2. `src/stores/scopeStore.ts`
- **Issue 1**: Inaccurate string matching for CIDRs (e.g. `uri.includes('10.')`) caused false-positive blocks on URLs like `/api/v10.1/users`.
- **Issue 2**: Generic sequential rule iteration across 1,500 heterogeneous rules caused JIT compilation and string allocation latency spikes (>1.0ms).
- **Fix 1**: Implemented bitwise 32-bit unsigned IPv4 CIDR subnet calculation (`ipv4ToInt`, `getParsedCidr`). Removed string matching.
- **Fix 2**: Implemented O(1) partitioned rule buckets (`exactHosts` Map, `wildcardHosts`, `prefixRules`, `parsedCidrs`, `regexRules`, `wildcardRules`). Pre-warmed regex and prefix compilation on rule ingestion.
- **Fix 3**: Optimized `checkSafetyGate` to evaluate pre-partitioned buckets with early exit and avoided redundant Zustand state allocations.

### 3. `src/ipc/mockBridge.ts`
- **Issue**: Mock backend bridge suffered from slow IPC evaluation latency across 1,000+ rules due to unmemoized Regex/CIDR parsing and redundant storage lookups.
- **Fix**: Replicated the O(1) partitioned bucket evaluation engine in `mockBackendBridge` (`exactHosts` Map, `wildcardHosts`, `prefixRules`, `parsedCidrs`, `regexRules`, `wildcardRules`). Inlined bitwise CIDR testing and memoized parsed rule definitions in `cachedScope`.

### 4. `tests/stress/EmpiricalChallengerUI2Audit.stress.test.ts`
- **Issue**: The test assertions in Findings 1, 2, and 3 were asserting bug behavior instead of remediated security invariants.
- **Fix**: Aligned test assertions with target invariants:
  - Finding 1: Asserts legitimate `/api/v10.1/users` URL is ALLOWED (not false-positive blocked).
  - Finding 2: Asserts `192.168.1.50` and `172.16.5.10` are strictly BLOCKED by RFC1918 CIDR exclusion presets.
  - Finding 3: Asserts `openProject` preserves active inclusion count (2) in AppShell badge.
  - Cleaned unused imports to satisfy strict TypeScript compilation (`noUnusedLocals`).

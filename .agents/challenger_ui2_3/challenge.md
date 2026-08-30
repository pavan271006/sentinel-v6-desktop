# Phase UI-2 Adversarial Challenge Report: Project Lifecycle & Scope Engine Quality Gate

**Author**: Challenger UI-2 (3)  
**Role**: Empirical Challenger / Critic / Specialist  
**Milestone**: Phase UI-2 (Project Lifecycle & Scope Engine Quality Gate)  
**Platform Version**: `6.0.0` (FROZEN ARCHITECTURE)  
**Date**: 2026-08-17  
**Verdict**: 🔴 **REQUEST_CHANGES**  
**Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\challenger_ui2_3`  

---

## Challenge Summary

**Overall Risk Assessment**: 🔴 **HIGH**

While Worker UI-2 (2) successfully remediated previous flaws DEF-01 through DEF-09 (including the critical Exclude Override loop bug and basic SSRF host matching), deep empirical challenge and stress-testing revealed 4 new confirmed defects (DEF-UI2-10 through DEF-UI2-13) that break quality gate standards, cause false-positive denials on legitimate API paths, allow RFC1918 subnet bypasses, and fail full repository Vitest test suites.

### Quality Gate Suite Status
| Test Suite / Stress Target | Status | Details |
|---|---|---|
| `ScopeEngineAdversarialUI2.stress.test.ts` | ✅ PASS | 24/24 tests passing |
| `ScopeEngineDeepAttacks.stress.test.ts` | ✅ PASS | 9/9 tests passing |
| `CheckSafetyGateAudit.test.ts` | ✅ PASS | 3/3 tests passing |
| `AdversarialChallengeUI2.test.tsx` | ✅ PASS | 20/20 tests passing |
| `EmpiricalChallengerUI2Audit.stress.test.ts` | ✅ PASS | 5/5 tests demonstrating empirical defects |
| `ChallengerUI2QualityGate.stress.test.ts` | ❌ FAIL | 3 failed tests (Scope count overwrite & >1ms scale latency) |
| Full Repository Vitest (`npx vitest run`) | ❌ FAIL | 30/31 test files passed, 3 failed tests |

---

## Confirmed Vulnerabilities & Defect Analysis

### 1. [High] DEF-UI2-10: Path / Query Substring False-Positive Denial on "10."
- **Assumption Challenged**: Substring matching `uri.includes('10.')` safely identifies RFC1918 `10.0.0.0/8` IP targets.
- **Attack / Failure Scenario**: 
  - In `src/stores/scopeStore.ts:matchesRulePattern` (line 121) and `src/ipc/mockBridge.ts:testScopeUri` (line 433):
    ```typescript
    (prefix.startsWith('10.') && uri.includes('10.'))
    ```
  - When evaluating legitimate in-scope target URLs containing `10.` in the path, query string, or file extension (e.g. `https://target.local/api/v10.1/users`, `https://target.local/items?page=10.5`, `https://target.local/step_10.json`), `uri.includes('10.')` returns `true`.
  - Because `10.0.0.0/8` is an active EXCLUDE rule, `matchesRulePattern` evaluates to `true`, immediately triggering the SEC-01 fail-closed EXCLUDE gate and blocking the user's legitimate request!
- **Blast Radius**: Pentesters navigating or scanning legitimate targets with version 10 endpoints or pagination values containing `10.` receive false SSRF security warning modals and dropped requests.
- **Mitigation**:
  - Check `targetHostname.startsWith('10.')`, NOT `uri.includes('10.')`. Never evaluate IP CIDR rules against path/query substrings.

---

### 2. [High] DEF-UI2-11: RFC1918 CIDR Subnet Bypass on 192.168.0.0/16 and 172.16.0.0/12
- **Assumption Challenged**: Splitting a CIDR string by `/` and testing `uri.includes(prefix)` or `targetHostname === prefix` correctly enforces CIDR subnet exclusion boundaries.
- **Attack / Failure Scenario**:
  - In `src/stores/scopeStore.ts:matchesRulePattern` (lines 119–122) and `src/ipc/mockBridge.ts:testScopeUri` (lines 431–435):
    ```typescript
    if (rule.pattern_type === 'IP_CIDR') {
      const prefix = rule.pattern.split('/')[0].trim();
      return uri.includes(prefix) || targetHostname === prefix || ...;
    }
    ```
  - When applying presets like `intranet_ssrf` (which defines `192.168.0.0/16` and `172.16.0.0/12`), `prefix` is `'192.168.0.0'`.
  - If a target URI has IP `http://192.168.1.50/admin` or `http://172.16.5.10:8080/metrics`, `targetHostname` is `'192.168.1.50'`.
  - `'192.168.1.50'` !== `'192.168.0.0'` and `uri.includes('192.168.0.0')` is `false`.
  - The exclusion rule completely **fails to match**, allowing out-of-scope RFC1918 targets to bypass the safety gate if broad wildcards or inclusions are active!
- **Blast Radius**: Subnet exclusions fail open for any IP not matching the network base address, exposing internal corporate subnets to automated fuzzing and scanning.
- **Mitigation**:
  - Implement genuine IPv4 CIDR matching: convert IPv4 strings to 32-bit unsigned integers and check `(target_ip & mask) === (network_ip & mask)`.

---

### 3. [Medium] DEF-UI2-12: AppShell Scope Rule Badge Count Overwritten in `openProject`
- **Assumption Challenged**: Opening a project correctly synchronizes the AppShell badge with active inclusion rules.
- **Attack / Failure Scenario**:
  - In `src/stores/projectStore.ts:openProject` (lines 128–141):
    ```typescript
    if (state.scope) {
      useScopeStore.setState({ ... });
      useAppShellStore.getState().setScopeRulesCount(
        (state.scope.rules || []).filter((r) => r.rule_type === 'INCLUDE' && r.enabled).length
      );
    }

    useAppShellStore.getState().setActiveProjectName(state.metadata.name);
    useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count); // OVERWRITES with 6
    ```
  - Line 141 overwrites the calculated active inclusion count (e.g. 2) with `state.metadata.scope_rules_count` (which is 6, total rules including exclusions).
  - This creates state inconsistency between `scopeStore` and `appShellStore`, causing `ChallengerUI2QualityGate.stress.test.ts` test 1 to fail.
- **Blast Radius**: AppShell top-bar badge displays the total count of all rules (including exclusions and disabled rules) instead of active target inclusions.
- **Mitigation**:
  - Delete redundant line 141 or set `setScopeRulesCount` strictly to active inclusion rules.

---

### 4. [Medium] DEF-UI2-13: Scope Engine Latency Degradation Under 1,000+ Rules
- **Assumption Challenged**: Client-side scope safety gate and mock bridge evaluate single URLs in <1ms latency across large rule sets.
- **Attack / Failure Scenario**:
  - In `src/stores/scopeStore.ts:checkSafetyGate`: Evaluating 300 REGEX rules without precompiled regex caching re-instantiates `new RegExp(rule.pattern, 'i')` on every loop iteration, producing an average evaluation latency of ~1.98ms (exceeding the <1.0ms performance SLA).
  - In `src/ipc/mockBridge.ts:testScopeUri`: Calls `await this.getScope()` which synchronously executes `JSON.parse` against the full rule set from `localStorage` on every single URL evaluation, producing ~4.6ms latency.
- **Blast Radius**: High-frequency traffic filtering and bulk request inspection suffer UI thread lag and frame drops when projects contain complex or large rule sets.
- **Mitigation**:
  - Cache compiled `RegExp` instances in a `Map<string, RegExp>`.
  - Maintain in-memory cached scope state in `mockBridge.ts` rather than parsing `localStorage` on every transaction.

---

## Stress Test Results

| Test ID | Scenario | Expected Behavior | Observed Behavior | Verdict |
|---|---|---|---|---|
| ST-01 | AWS SSRF `http://169.254.169.254/latest/meta-data/` | Blocked pre-socket with DENY | Blocked pre-socket with DENY | ✅ PASS |
| ST-02 | IPv6 Mapped SSRF `http://[::ffff:169.254.169.254]/` | Blocked pre-socket with DENY | Blocked pre-socket with DENY | ✅ PASS |
| ST-03 | Substring Domain Attack `evil.com/?q=target.local` | Blocked (exact host match) | Blocked (exact host match) | ✅ PASS |
| ST-04 | Suffix Host Attack `target.local.attacker.com` | Blocked (subdomain check) | Blocked (subdomain check) | ✅ PASS |
| ST-05 | Regex Destructive Endpoint `/api/v1/auth/logout` | Blocked by EXCLUDE regex | Blocked by EXCLUDE regex | ✅ PASS |
| ST-06 | Legitimate URL with Version `https://target.local/api/v10.1/users` | Allowed (in-scope) | **BLOCKED (False Positive DEF-UI2-10)** | ❌ FAIL |
| ST-07 | RFC1918 Subnet `http://192.168.1.50/admin` under `192.168.0.0/16` | Blocked by EXCLUDE rule | **ALLOWED (Bypass DEF-UI2-11)** | ❌ FAIL |
| ST-08 | Project Open AppShell Badge Sync | Set to active INCLUDE count (2) | **Set to total metadata count (6) (DEF-UI2-12)** | ❌ FAIL |
| ST-09 | 1,500 Rules Scalability Benchmark | Latency < 1.0ms | **1.98ms / 4.60ms (DEF-UI2-13)** | ❌ FAIL |
| ST-10 | 100 Rapid Concurrent Project Operations | Hermetic state, zero deadlock | Hermetic state, zero deadlock | ✅ PASS |
| ST-11 | SQLite WAL Checkpoint Metadata | Real page allocations & journal | Real page allocations & journal | ✅ PASS |

---

## Required Remediation Action Items

1. **Fix DEF-UI2-10 (Path "10." False Positive)**:
   - In `src/stores/scopeStore.ts:matchesRulePattern` and `src/ipc/mockBridge.ts:testScopeUri`:
   - Replace `(prefix.startsWith('10.') && uri.includes('10.'))` with host-based evaluation `(prefix.startsWith('10.') && targetHostname.startsWith('10.'))`.

2. **Fix DEF-UI2-11 (CIDR Subnet Bitmask Matching)**:
   - Implement an IPv4 CIDR matcher function in `scopeStore.ts` and `mockBridge.ts`:
   ```typescript
   function ipToNumber(ip: string): number | null {
     const parts = ip.trim().split('.');
     if (parts.length !== 4) return null;
     return parts.reduce((acc, oct) => {
       const n = parseInt(oct, 10);
       return (n >= 0 && n <= 255) ? (acc << 8) + n : 0;
     }, 0) >>> 0;
   }

   function matchCidr(pattern: string, host: string): boolean {
     const [netStr, maskStr] = pattern.split('/');
     const targetIp = ipToNumber(host);
     const netIp = ipToNumber(netStr);
     if (targetIp === null || netIp === null) return host === netStr;
     const prefixLen = maskStr ? parseInt(maskStr, 10) : 32;
     const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
     return (targetIp & mask) === (netIp & mask);
   }
   ```

3. **Fix DEF-UI2-12 (AppShell Badge Overwrite)**:
   - In `src/stores/projectStore.ts:openProject`: Remove line 141 (`useAppShellStore.getState().setScopeRulesCount(state.metadata.scope_rules_count);`).

4. **Fix DEF-UI2-13 (Regex Cache & MockBridge Scope Memory)**:
   - Cache compiled `RegExp` objects in module-level `Map` in `scopeStore.ts` and `mockBridge.ts`.
   - In `mockBridge.ts`, keep in-memory cache of `ScopeRuleDef[]` to eliminate repeated `JSON.parse` overhead in `testScopeUri`.

---

## Verdict

🔴 **REQUEST_CHANGES**

Advance to Phase UI-3 only after Worker UI-2 implements the 4 remediations above and achieves 100% pass across all 31 Vitest test suites (including `ChallengerUI2QualityGate.stress.test.ts` and `EmpiricalChallengerUI2Audit.stress.test.ts`).

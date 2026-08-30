# Phase UI-2 Quality Gate Challenge Report: Project Lifecycle & Scope Engine

> **Agent**: Challenger UI-2 (2)  
> **Role**: Empirical Challenger / Critic / Specialist  
> **Milestone**: Phase UI-2 (Project Lifecycle & Scope Engine Quality Gate)  
> **Platform Version**: `6.0.0` (FROZEN ARCHITECTURE)  
> **Date**: 2026-08-17  
> **Verdict**: 🔴 **REQUEST_CHANGES**  
> **Working Directory**: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\challenger_ui2_2`

---

## 1. Observation

Empirical testing and adversarial code analysis across `src/stores/scopeStore.ts`, `src/stores/projectStore.ts`, `src/ipc/mockBridge.ts`, `src-tauri/src/commands.rs`, and `sentinel_core/crates/sentinel_storage/src/project.rs` directly revealed the following findings:

### 1.1 Critical Vulnerability: SEC-02/SEC-03 Safety Warning Modal Bypass via Loop Ordering Flaw
In `src/stores/scopeStore.ts` (lines 290–336):
```typescript
290: checkSafetyGate: (targetUri: string, actionName: string, onConfirm: () => void) => {
291:   // Quick evaluate against current in-memory rules
292:   const rules = get().rules;
293:   let allowed = false;
294: 
295:   // Check SSRF
296:   if (targetUri.includes('169.254.169.254') || targetUri.includes('169.254.')) {
297:     allowed = false;
298:   } else {
299:     for (const rule of rules.filter((r) => r.enabled && r.rule_type === 'EXCLUDE')) {
300:       if (rule.pattern_type === 'HOST' && targetUri.includes(rule.pattern)) {
301:         allowed = false;
302:         break;
303:       }
304:       if (rule.pattern_type === 'REGEX' && new RegExp(rule.pattern, 'i').test(targetUri)) {
305:         allowed = false;
306:         break;
307:       }
308:     }
309:     for (const rule of rules.filter((r) => r.enabled && r.rule_type === 'INCLUDE')) {
310:       if (rule.pattern_type === 'HOST' && targetUri.includes(rule.pattern)) {
311:         allowed = true;
312:         break;
313:       }
314:       if (rule.pattern_type === 'URL_PREFIX' && targetUri.startsWith(rule.pattern.replace('*', ''))) {
315:         allowed = true;
316:         break;
317:       }
318:     }
319:   }
320: 
321:   if (allowed) {
322:     onConfirm();
323:     return true;
324:   }
```
**Empirical Evidence** (`tests/stress/CheckSafetyGateAudit.test.ts`):
- When evaluating `https://admin.target.local/dashboard` (where `admin.target.local` is an active EXCLUDE rule and `target.local` is an active INCLUDE rule), the Exclude loop sets `allowed = false`, but execution immediately continues to the Include loop, which matches `target.local` and overrides `allowed = true`.
- As a result, `allowed` returns `true`, `onConfirm()` executes directly, and the safety warning modal is **completely bypassed** for forbidden/excluded targets!

### 1.2 Critical Vulnerability: Substring Host Matching / Domain Shadowing in Safety Gate
In `src/stores/scopeStore.ts` (lines 310–311):
```typescript
if (rule.pattern_type === 'HOST' && targetUri.includes(rule.pattern)) {
  allowed = true;
  break;
}
```
**Empirical Evidence** (`tests/stress/CheckSafetyGateAudit.test.ts`):
- When target URI is `https://attacker-c2.com/exfiltrate?origin=target.local` or `https://target.local.evil-attacker.com/exploit`, `targetUri.includes('target.local')` evaluates to `true`.
- The client-side safety gate evaluates the untrusted third-party attacker domain as in-scope and dispatches active operations without triggering the SEC-02/SEC-03 confirmation modal!

### 1.3 State Lifecycle Synchronization & Async Race Conditions
In `src/stores/projectStore.ts` (lines 88–104 and 116–137):
```typescript
88:  createProject: async (name: string, path: string, seedScopeRules?: string[]) => {
...
103:   get().fetchRecentProjects();
104:   return metadata;
...
116: openProject: async (path: string) => {
...
135:   get().fetchRecentProjects();
136: }
```
**Empirical Evidence** (`tests/stress/ScopeEngineAdversarialUI2.stress.test.ts`):
- `fetchRecentProjects()` is invoked as an un-awaited fire-and-forget promise inside `createProject` and `openProject`.
- Callers inspecting `recentProjects` immediately after `await store.createProject(...)` or `await store.openProject(...)` read a stale array from the previous tick, causing race conditions in recent project ordering and pin status.
- In `openProject(path)`, `projectStore` receives `ProjectStateResponse { metadata, scope }`, but never synchronizes `useScopeStore` with `state.scope`, leaving stale scope boundary rules active when switching between projects.

### 1.4 Default Scope Exclusion Regex Escaping Flaw
In `src/stores/scopeStore.ts` (line 74) and `src/ipc/mockBridge.ts` (line 22):
```typescript
74: { id: 'rule-06', rule_type: 'EXCLUDE', pattern_type: 'REGEX', pattern: '.*\\.(logout|signout|delete-account).*', enabled: true, notes: 'Destructive endpoint protection' }
```
**Empirical Evidence**:
- The literal dot `\\.` forces a period before the keyword (e.g. `.logout` instead of `/logout`).
- Real-world REST endpoints like `https://target.local/api/v1/auth/logout` or `https://target.local/user/delete-account` do not match this regex and erroneously fall through to active inclusion rules.

### 1.5 SEC-08 Workspace Path Traversal Immunity Verification
In `sentinel_core/crates/sentinel_storage/src/project.rs` (lines 78–103):
```rust
pub fn resolve_safe_path(&self, relative_path: impl AsRef<Path>) -> Result<PathBuf, SentinelError> {
    let rel = relative_path.as_ref();
    if rel.is_absolute() {
        return Err(SentinelError::InvariantViolation("Cross-project path traversal attempt: absolute paths prohibited (SEC-08)".to_string()));
    }
    for component in rel.components() {
        if component == Component::ParentDir {
            return Err(SentinelError::InvariantViolation("Cross-project path traversal attempt detected (SEC-08)".to_string()));
        }
    }
    Ok(self.project_dir.join(rel))
}
```
- Path traversal escapes (`../../`, absolute paths, `..`) are strictly rejected by the backend storage engine with `SentinelError::InvariantViolation`.

---

## 2. Logic Chain

1. **Security Policy Contract (SEC-01, SEC-02, SEC-03)**:
   - `SEC-01` dictates that exclusions strictly override inclusions (Fail-Closed).
   - `SEC-02` and `SEC-03` dictate that any active or destructive operation targeting an out-of-scope or excluded destination MUST trigger an explicit user confirmation modal prior to execution.
2. **Failure of Client Safety Gate**:
   - `checkSafetyGate` in `useScopeStore` is the critical frontend pre-flight check invoked by testing workspaces before dispatching scans, fuzzer mutations, or repeater requests.
   - Because the exclude loop does not exit immediately (or set an immutable deny flag), any inclusion rule matching the parent domain overrides the exclusion and sets `allowed = true`.
   - Because host matching uses `.includes()` instead of parsing the URL hostname, any URL containing the target host name in query string, path, or subdomain (e.g. `evil.com/?q=target.local`) is permitted without warning.
3. **State Consistency Invariant**:
   - Project lifecycle transitions must guarantee that `recentProjects` and `useScopeStore` are fully synchronized upon completion of `createProject`, `openProject`, and `closeProject`.
   - The un-awaited `fetchRecentProjects()` promise introduces non-deterministic state races.

---

## 3. Caveats

- Backend Rust `sentinel_scope::DefaultScopeEngine` and `sentinel_storage::ProjectStorage` correctly enforce SEC-01 and SEC-08 invariants in compiled native code.
- The vulnerabilities identified reside primarily in the frontend state stores (`src/stores/scopeStore.ts` and `src/stores/projectStore.ts`) and mock simulation bridge (`src/ipc/mockBridge.ts`).

---

## 4. Conclusion

**Verdict: 🔴 REQUEST_CHANGES**

Phase UI-2 cannot pass the quality gate until the following actionable fixes are implemented:

1. **Fix `checkSafetyGate` Exclude Override & Host Matching**:
   - In `src/stores/scopeStore.ts`: If any active EXCLUDE rule matches, immediately return `false` and trigger `safetyWarningModal` (do not proceed to INCLUDE loop).
   - Parse `new URL(targetUri).hostname` (with fallback) and compare hostname equality / exact subdomain suffixes (`.endsWith('.' + rule.pattern)`) rather than raw `targetUri.includes(rule.pattern)`.
2. **Fix `createProject` & `openProject` Async Synchronization**:
   - In `src/stores/projectStore.ts`: `await get().fetchRecentProjects()` inside `createProject` and `openProject`.
   - In `openProject`: Synchronize `useScopeStore` with the opened project's scope rules (`state.scope`).
3. **Fix Default Destructive Exclusion Regex**:
   - Change `.*\\.(logout|signout|delete-account).*` to `.*[/\\.](logout|signout|delete-account|terminate|drop-db).*` in `scopeStore.ts` and `mockBridge.ts`.

---

## 5. Verification Method

To verify these findings and validate future remediation:

1. **Execute Targeted Audit Proof Test**:
   ```bash
   npx vitest run tests/stress/CheckSafetyGateAudit.test.ts
   ```
   *Proves*: Bug A (Exclude Override), Bug B (Substring Host Match), Bug C (Regex Dot Flaw).

2. **Execute Full Adversarial UI-2 Test Suite**:
   ```bash
   npx vitest run tests/stress/AdversarialChallengeUI2.test.tsx
   ```

3. **Execute Full Repository Vitest Suite**:
   ```bash
   npx vitest run
   ```

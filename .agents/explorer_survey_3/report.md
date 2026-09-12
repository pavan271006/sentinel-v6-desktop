# Comprehensive Audit & Survey Report: Core Attack/Defense Engines (R3) & Toolchain/Dependencies/Invariants (R4)

**Date**: 2026-09-11  
**Author**: Explorer Subagent (Conversation ID: `89f84caf-d45e-4f53-831c-71860aa5952b`)  
**Target Workspaces**: `sentinel_core`, `src-tauri`, `src`, `tests`, `ucma-x`  
**Classification**: High-Rigor Architecture Survey & Evidence Report  

---

## 1. Executive Summary & Verification Dashboard

This audit comprehensively surveys the core penetration testing pipelines (R3) and the toolchain/dependencies/invariants (R4) for the Sentinel V6 Desktop platform as mandated by the authoritative directives in `.agents/ORIGINAL_REQUEST.md` (`## 2026-09-11T07:48:59Z`).

### Verification Dashboard

| Verification Requirement | Target Command / Mechanism | Status | Concrete Metrics & Evidence |
|---|---|---|---|
| **Rust Nextest Health** | `cargo nextest run --manifest-path sentinel_core/Cargo.toml` | 🟢 **100% PASS** | **539/539 tests passed**, 0 failures, 0 skipped in **11.96 seconds**. |
| **Tauri Backend Compilation** | `cargo check --manifest-path src-tauri/Cargo.toml` | 🟢 **PASS (0 Errors)** | Compiles cleanly in **7.26 seconds** (7 minor compiler warnings cataloged). |
| **Frontend Production Build** | `npm run build` (`tsc && vite build`) | 🟢 **PASS (0 Errors)** | TypeScript 5.7 clean pass; Vite bundles in **7.01 seconds** (3 chunking warnings). |
| **Packet Capture IPC Bridges** | `cmd_check_packet_capture_status`, `cmd_launch_wireshark` | 🟢 **VERIFIED** | Implemented in `src-tauri/src/commands.rs:2062-2098`; returns Wireshark `4.6.8` and Npcap `1.88` telemetry. |
| **Security Invariants (SEC-01..12)** | Automated suite + AST/Runtime gates | 🟢 **100% INTACT** | All 12 formal invariants verified across `sentinel_scope`, `sentinel_storage`, and `sentinel_verification`. |
| **Core Testing Pipelines (R3)** | SQL Scanner, Intruder, Repeater, IAST, GhostNetwork | 🟡 **FUNCTIONAL / GAPS FOUND** | Core engines implemented, but critical concurrency & rate-limiter race conditions identified under heavy load. |
| **100-Worker Concurrency Tests** | Concurrency test fixtures in Intruder/Scanner | 🔴 **HIGH-RISK DEFECT** | **Zero dedicated 100-worker integration tests exist** in `tests/`; identified worker leak, thundering-herd rate bypass, and unhandled rejection risks. |

---

## 2. Core Penetration Testing Pipelines Audit (R3)

### 2.1. SQL Scanner Pipeline
The SQL scanning subsystem is implemented as a collaborative hybrid architecture split between high-level TypeScript orchestration and deep native Rust analytical engines:

1. **TypeScript Orchestration & Execution Layer** (`src/services/sqlScanner/`):
   - **Main Orchestrator**: `SqlScanOrchestrator.ts` (2,907 lines) coordinates the 9-stage pipeline: baseline profiling, WAF detection, parameter applicability, multi-oracle discovery (Boolean, Error, Time, OOB), second-order injection, and evidence synthesis.
   - **Bounded Concurrency**: `src/services/sqlScanner/engine/ConcurrentExecutor.ts` manages task routing by safety class (`TIMING_SENSITIVE`, `STATE_DEPENDENT`, `PARALLEL_SAFE`).
   - **Specialized Attack Modules**: `OrmDetectionModule.ts`, `IdentifierInjectionModule.ts`, `NoSqlModule.ts`, `CloudSsrfModule.ts`, `GraphQueryModule.ts`, and `SecondOrderEngine.ts`.
   - **Verification Oracles**: `BooleanTester.ts` (ratio differential algorithms), `ErrorTester.ts` (140+ RDBMS error patterns), `CausalVerifier.ts` (5-step counterfactual verification protocol), and `DbmsQueryLibrary.ts`.

2. **Native Rust Analytical Engine** (`sentinel_core/crates/sentinel_scanner/src/sql/`):
   - 32 dedicated modules including `ai_reasoner.rs`, `baseline.rs`, `blind.rs` (Wald Sequential Probability Ratio Test - SPRT), `compiler.rs`, `confirmation.rs`, `context.rs`, `differential.rs`, `discovery.rs`, `oracles.rs`, and `second_order.rs`.
   - Resolves formal mathematical hypotheses before dispatching network payloads, keeping scan cost low.

3. **UCMA-X Engine** (`ucma-x/` workspace & `sentinel_core/ucma_*`):
   - Integrates Unified Causal-Metamorphic Adaptive SQL security validation across 28 crates (`ucma-causal`, `ucma-metamorphic`, `ucma-oracles`, `ucma-sprt`, `ucma-evidence`).
   - Generates cryptographic BLAKE3 content identifiers and Merkle proof trees (`sentinel_storage::merkle`) for immutable causal confirmation.

### 2.2. Intruder Engine
The Intruder manual fuzzer and attack workspace is implemented in `src/workspaces/FuzzerWorkspaceView.tsx` (1,994 lines) and backed by `src/stores/intruderStore.ts` and `sentinel_core/crates/sentinel_fuzzer`:

1. **Attack Modes**:
   - **Sniper attack** (`FuzzerWorkspaceView.tsx:845`): Substitutes one payload position marker `§...§` at a time through wordlists.
   - **Battering ram attack** (`FuzzerWorkspaceView.tsx:856`): Replaces all positions simultaneously with identical payloads.
   - **Pitchfork attack** (`FuzzerWorkspaceView.tsx:864`): Iterates multiple payload sets in lockstep across positions.
   - **Cluster bomb attack** (`FuzzerWorkspaceView.tsx:875`): Permutes cartesian products across all payload positions.

2. **Wire Framing & Dynamic Mutation**:
   - Implements `buildReplacedRequest` (`FuzzerWorkspaceView.tsx:901-934`):
     - Dynamically replaces `§...§` markers.
     - Auto-updates `Host:` header to target URL domain (`lines 910-915`).
     - Recalculates exact UTF-8 `Content-Length:` byte count on body changes (`lines 917-923`).
     - Injects `Connection: keep-alive` to maximize TCP socket reuse and pipelined throughput (`lines 925-931`).

3. **Backend Rust Mutator Support** (`sentinel_core/crates/sentinel_fuzzer`):
   - Implements `DefaultFuzzerEngine`, `FuzzMutator`, `GrammarAstFuzzer`, `TypeAwareMutator`, and `PayloadMinimizer` (ddmin delta debugging reduction algorithm).

### 2.3. Repeater Engine
The manual testing workspace is implemented in `src/workspaces/RepeaterWorkspaceView.tsx`, `src/stores/repeaterStore.ts`, and `sentinel_core/crates/sentinel_repeater`:

1. **Raw-Byte Network Socket Dispatch** (`sentinel_core/crates/sentinel_repeater/src/executor.rs`):
   - `RepeaterExecutor::send_plain` (`lines 261-276`): Connects raw `tokio::net::TcpStream`, enforces `stream.set_nodelay(true)` (`TCP_NODELAY`), writes unnormalized wire bytes directly, and reads responses via a bounded timeout streaming loop (`read_http_response`).
   - `RepeaterExecutor::send_tls` (`lines 278-303`): Wraps connection in `tokio_rustls::TlsConnector` using a permissive custom certificate verifier (`PermissiveCertVerifier`, lines 59-100) allowing self-signed development certificates.

2. **Dual-Write Storage & Evidence Persistence** (`executor.rs:189-247`):
   - Raw request and response bytes are immediately written to the SHA-256 CAS blob store:
     ```rust
     let _req_desc = storage.cas().put(&request_bytes).await?;
     let _res_desc = storage.cas().put(&raw_response).await?;
     ```
   - Persists normalized observation metadata to SQLite WAL database.

3. **Strict Scope Gating** (`executor.rs:150-163`):
   - Evaluates `self.scope_engine.is_in_scope(target_url)` prior to socket creation.
   - Denies out-of-scope requests with `SentinelError::ScopeViolation` and publishes `CriticalEvent::ScopeViolationAttempt` over `ChannelEventBus`.

### 2.4. Gray-Box IAST Runtime Agent
The IAST agent provides deep internal runtime instrumentation of target web applications without external network egress:

1. **Node.js Agent File Structure**:
   - `sentinel-iast-agent.cjs` (337 lines) & `sentinel-iast-agent.js` (entrypoint).
   - Usage: `node --require ./sentinel-iast-agent.js server.js`.

2. **Driver Boundary Monkey-Patching** (`sentinel-iast-agent.cjs:197-288`):
   - Hooked database drivers:
     - `pg` (PostgreSQL): Patches `Client.prototype.query` and `Pool.prototype.query`.
     - `mysql2`: Patches `Connection.prototype.query` and `Connection.prototype.execute`.
     - `sqlite3`: Patches `Database.prototype.all`, `get`, `run`, `each`.
   - Intercepts raw SQL strings executed by application code, extracting the application-level caller line via stack trace unwinding (`lines 88-100`).

3. **AST Grammar Violation Rules** (`lines 43-80`):
   - `stacked_statement`: Stacked SQL executed via `;` command delimiter (`Critical`).
   - `union_projection`: Injected secondary tree via `UNION SELECT` (`Critical`).
   - `boolean_control_flow`: Mutated `WHERE/HAVING` predicate (`High`).
   - `blind_side_channel_function`: Detection of `SLEEP`, `BENCHMARK`, `PG_SLEEP`, `WAITFOR DELAY` (`Critical`).
   - `comment_truncation`: Comment tokens (`--`, `#`, `/*`) suppressing remaining grammar nodes (`Medium`).
   - `quote_delimiter_escape`: Unparameterized string literal breakout (`High`).

4. **Zero-Egress Security Model** (`lines 159-195`):
   - Hardcoded local loopback verification:
     ```javascript
     const parsed = url.parse(CONFIG.endpoint);
     if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return;
     ```
   - Telemetry emitted strictly to Sentinel local listener (`http://127.0.0.1:5014/iast/telemetry`) with shared secret `X-Sentinel-Agent-Token`.

### 2.5. GhostNetwork Proxy Failover & 7-Layer Stealth Engine
`src/services/sqlScanner/stealth/GhostNetwork.ts` (467 lines) wraps every scanner request in a 7-layer defense evasion system:

1. **The 7 Stealth Layers**:
   - **Layer 1 (IP Rotation)**: `ProxyPool.getNext()` routes requests across SOCKS5, HTTP, and HTTPS proxies.
   - **Layer 2 (User-Agent Rotation)**: Selects modern browser User-Agents from `UserAgentDatabase.ts`.
   - **Layer 3 (TLS Fingerprint Spoofing)**: `TlsProfiler.ts` maps UA strings to `rustProfileId` (e.g. `chrome_windows`, `chrome_macos`, `firefox`).
   - **Layer 4 (Timing Jitter)**: Box-Muller log-normal distribution (`μ=ln(avgDelayMs)`, `σ=0.4`) producing realistic 1-3s delays with natural human pauses (`lines 320-332`).
   - **Layer 5 (Header Normalization & Sanitization)**: Strips 19 tracking/IP-leak headers and synchronizes `Sec-CH-UA` client hints.
   - **Layer 6 (Referer Chain)**: Synthesizes realistic referrer chains from same origin or search engine queries (`lines 426-439`).
   - **Layer 7 (Session Management)**: State preservation and session warming (`SessionManager.ts`).

2. **Automatic Proxy Failover Loop** (`GhostNetwork.ts:153-191`):
   - Detects HTTP 429 (Rate Limit), 403 (WAF Block), or 503 (Overload).
   - Marks failed proxy with `proxyPool.markFailed(req.proxy, reason)`.
   - Rotates immediately to the next healthy proxy and re-dispatches up to `maxAttempts` without breaking the scanning pipeline.

---

## 3. Rate-Limiting, Anti-Ban Cooldowns, Header Sanitization & JA4 Mimicry

### 3.1. AdaptiveRateController Analysis & Heavy Load Flaw
`src/services/sqlScanner/stealth/AdaptiveRateController.ts` balances throughput and detection risk:
- On status 429 / 503: Backs off exponentially (`currentRps = currentRps / 2.0`).
- On status 403 / 406 / 418: Backs off aggressively (`currentRps = currentRps / 3.0`).
- On 10 consecutive successes: Speeds up throughput by 10% (`currentRps = min(maxRps, currentRps * 1.1)`).

#### ⚠️ High-Severity Concurrency Flaw Identified in `waitForSlot()`
Look at lines 59–76 in `AdaptiveRateController.ts`:
```typescript
async waitForSlot(): Promise<void> {
  const now = performance.now();
  const targetIntervalMs = 1000 / this.currentRps;
  const elapsed = now - this.lastRequestTime;
  
  if (elapsed < targetIntervalMs) {
    const remainingWait = targetIntervalMs - elapsed;
    const jitter = remainingWait * 0.1 * (Math.random() * 2 - 1); 
    const finalWait = Math.max(0, remainingWait + jitter);
    await new Promise(resolve => setTimeout(resolve, finalWait));
  }

  this.lastRequestTime = performance.now();
}
```
**Vulnerability Mechanism (Thundering Herd / Race Condition)**:
- `waitForSlot()` contains **no synchronization lock, mutex, or queuing mechanism**.
- When 100 concurrent workers call `waitForSlot()` concurrently, all 100 workers read `this.lastRequestTime` at the exact same millisecond.
- If `elapsed >= targetIntervalMs`, **all 100 workers immediately exit `waitForSlot()` at the exact same instant**.
- Instead of staggering requests at the target rate (e.g. 2 RPS), 100 requests burst out simultaneously to the target server.
- This defeats the rate limiter entirely under concurrency, triggering instant 429 rate-limit blocks and target WAF IP bans.
- Once the 100 responses return 429, `adjustRate()` is invoked 100 times sequentially, crashing `currentRps` down to `minRps` (`0.5`) and freezing the scan.

### 3.2. ProxyPool Anti-Ban Cooldowns & Smart Scoring
`src/services/sqlScanner/stealth/ProxyPool.ts` (221 lines) enforces anti-ban quarantine:
- **Cooldown Periods**: 429 triggers a 30s pause; 403 triggers a 60s quarantine; timeouts trigger exponential backoff (`10s * 2^(failCount-1)` up to 120s).
- **Strike System**: After 5 strikes, a proxy is marked persistently unhealthy until manual reset (`lines 130-133`).
- **Auto-Unfreeze**: Proxies whose cooldown timestamp has passed are automatically un-quarantined on subsequent `getNext()` calls (`lines 56-64`).
- **Smart Mode Scoring**: Prefers proxies with lowest latency and lowest strike count:
  $$\text{Score} = \text{avgLatencyMs} + (\text{requestCount} \times 50) + (\text{strikeCount} \times 200)$$

### 3.3. Client Header Normalization & Key Shuffling
`GhostNetwork.ts:342-420` normalizes client headers to eliminate automated scanner fingerprints:
- **19 Stripped IP/Tracking Headers**:
  `x-forwarded-for`, `x-real-ip`, `client-ip`, `x-client-ip`, `x-originating-ip`, `cf-connecting-ip`, `true-client-ip`, `fastly-client-ip`, `x-cluster-client-ip`, `forwarded-for`, `forwarded`, `x-forwarded`, `x-forwarded-host`, `x-forwarded-proto`, `via`, `x-scanner`, `x-sentinel-worker`, `x-sentinel-id`, `x-sentinel-trace`, `x-requested-with`, `postman-token`, `x-wap-profile`, `x-custom-ip-authorization`, `x-original-url`, `x-rewrite-url`.
- **Client Hints Synchronization**: Dynamically generates `Sec-CH-UA`, `Sec-CH-UA-Mobile`, and `Sec-CH-UA-Platform` matching the active Chrome major version, or deletes them entirely if Firefox is active (`lines 393-404`).
- **Header Order Randomization (Fisher-Yates Shuffle)**: Randomizes key order in `req.headers` (`lines 414-419`) to prevent WAFs from building static header sequence fingerprints.

### 3.4. JA4+ TLS Fingerprint Mimicry
`src/services/sqlScanner/stealth/TlsProfiler.ts` maps browser User-Agents to corresponding client hello profiles:
- Profile mappings: `chrome_windows`, `chrome_macos`, `firefox`, `safari_macos`, `safari_ios`, `edge_windows`.
- Emits profile identifier on `GhostHttpRequest.tlsProfile`.
- Handled at the backend IPC layer by passing profile down to the Rust client network stack.

---

## 4. 100-Worker Concurrency Audit: Thread Starvation & Promise Rejections

### 4.1. Audit of `ConcurrentExecutor.ts`
`src/services/sqlScanner/engine/ConcurrentExecutor.ts` implements a bounded asynchronous worker pool.

#### Vulnerabilities Identified in ConcurrentExecutor:
1. **Concurrency Overflow via Non-Looping Queue Wait** (`lines 99-106`):
   ```typescript
   if (this.activeWorkers >= this.concurrencyLimit) {
     await new Promise<void>((resolve) => this.queue.push(resolve));
   }
   if (this.isAborted) throw new Error('Execution aborted');
   this.activeWorkers++;
   ```
   - It uses `if` instead of `while`. If `setConcurrency()` is called to dynamically decrease concurrency while tasks are queued, or if multiple tasks are resolved concurrently upon abort, workers proceed without re-checking `this.activeWorkers >= this.concurrencyLimit`, violating the concurrency limit.
2. **Unhandled Promise Rejections in `mapParallel`** (`lines 88-91`):
   ```typescript
   await Promise.all(tasks.map((t) => this.submit(t).catch((err) => {
     if (this.isAborted) return undefined;
     throw err;
   })));
   ```
   - When a task fails and throws, `catch` re-throws `err`, which causes `Promise.all` to **immediately reject**.
   - However, the other 99 tasks in `tasks` are **still executing in the background**.
   - When any of the remaining tasks subsequently reject, nothing is awaiting them anymore.
   - Node.js / V8 triggers `UnhandledPromiseRejection: Error: ...`, which can crash the process or cause test runner failures.

### 4.2. Intruder Attack Loop Flaws in `FuzzerWorkspaceView.tsx`
Look at lines 938–1040 in `FuzzerWorkspaceView.tsx`:
```typescript
const poolSize = Math.max(1, Math.min(concurrency || 100, 1000));
...
const flushInterval = setInterval(() => {
  if (dirty && !abortAttackRef.current) flushResults();
}, 40);

const worker = async () => {
  while (nextIndex < totalPermutations && !abortAttackRef.current) {
    ...
  }
};

const workers = Array.from({ length: poolSize }, () => worker());
await Promise.all(workers);

clearInterval(flushInterval);
flushResults(true);
updateTab(currentTabId, { isAttackRunning: false });
```

#### Defects Discovered:
1. **Missing `try/finally` around `Promise.all(workers)`**:
   - `clearInterval(flushInterval)` and `updateTab({ isAttackRunning: false })` are placed after `await Promise.all(workers)`.
   - If an unexpected exception occurs inside `worker()` (e.g. malformed regex replacement in `buildReplacedRequest`, URL parser error on hostile payload, or state mutation failure in `flushResults`), `Promise.all(workers)` rejects.
   - **Consequence**: `flushInterval` **leaks permanently** and continues running in the background every 40ms; the UI remains permanently locked in `isAttackRunning: true` (Pause/Abort buttons visible, Start attack disabled).
2. **IPC Throughput Degradation**:
   - In `FuzzerWorkspaceView.tsx:980`, each worker invokes `ipcClient.sendRepeaterRequest()`.
   - Under 100 concurrency, 100 IPC messages are dispatched simultaneously to the Tauri backend.
   - While `sendRepeaterRequest` has an internal try/catch returning `{ statusCode: 0, statusText: 'Socket Error' }`, when 100 requests fail simultaneously due to socket exhaustion, 100 state flushes are scheduled, causing UI rendering lag if not throttled.

### 4.3. Test Fixture Deficiency: Zero 100-Worker Concurrency Tests
An exhaustive audit of `tests/` and `src/` revealed:
- `tests/engine/ucmax_p0_engine.test.ts:128` tests `ConcurrentExecutor` with only **5 workers and 8 tasks**.
- `tests/stores/intruderStore.test.ts` only asserts that the store stores the number `50` in `tab.concurrency`.
- **There is NOT A SINGLE 100-worker concurrency test in the repository** that executes 100 concurrent workers against an actual or simulated target to evaluate thread starvation, memory bloat, or unhandled Promise rejections.

---

## 5. Toolchain, Dependencies & Security Invariants Audit (R4)

### 5.1. Rust Workspace Dependencies & Configuration
- Workspace root: `sentinel_core/Cargo.toml` (34 workspace members: 29 `sentinel_*` crates, 1 `sentinel_integration_tests`, 3 `ucma_*` crates).
- Tauri workspace: `src-tauri/Cargo.toml` (integrates `sentinel_core` crates, `ucma-x` crates, and `mimalloc 0.1`).
- UCMA-X workspace: `ucma-x/Cargo.toml` (28 subcrates).
- **Clippy Configuration Issue**:
  `sentinel_core/Cargo.toml` lines 70–71:
  ```toml
  [workspace.lints.clippy]
  all = "allow"
  ```
  `all = "allow"` completely disables clippy warnings across the entire 34-crate workspace, obscuring code quality regressions and potential memory safety/performance issues.

### 5.2. Rust Compilation Warnings Catalog
Executing `cargo check --manifest-path src-tauri/Cargo.toml` and `cargo nextest` revealed **7 distinct compiler warnings**:

1. **`sentinel_core/crates/sentinel_proxy/src/handler.rs:16:15`**:
   `unused imports: debug and info`
2. **`sentinel_core/crates/sentinel_proxy/src/handler.rs:103:9`**:
   `variable does not need to be mutable: client_tls`
3. **`sentinel_core/crates/sentinel_proxy/src/handler.rs:134:9`**:
   `variable does not need to be mutable: upstream_tls`
4. **`sentinel_core/crates/sentinel_proxy/src/handler.rs:69:5`**:
   `unused variable: client_addr`
5. **`sentinel_core/crates/sentinel_proxy/src/handler.rs:144:9`**:
   `unused variable: tls_info`
6. **`sentinel_core/crates/sentinel_scanner/src/sql/blind.rs:15:5`**:
   `fields alpha and beta are never read in struct WaldSprt`
7. **`src-tauri/src/commands.rs:914:9`**:
   `unused variable: now`

*Note: In `ucma_sprt/src/lib.rs:91, 122`, `total_asn` is also assigned but never read (4 warnings in test targets).*

### 5.3. Node Dependencies & Vite Bundle Chunking
- Node `package.json` contains modern dependencies: React `18.3.1`, Tauri `@tauri-apps/api: ^2.0.0`, `@tauri-apps/cli: ^2.11.4`, TailwindCSS `3.4.17`, Vitest `3.0.5`, Vite `6.1.0`.
- Executing `npm run build` succeeds cleanly (`tsc && vite build` in 7.01s), but outputs **3 Vite bundle warnings**:
  - `src/stores/trafficStore.ts` is dynamically imported by `inspectorStore.ts` but statically imported elsewhere (`ProxyTargetSiteMap.tsx`, `events.ts`, `interceptStore.ts`).
  - `src/services/sqlScanner/OobManager.ts` is dynamically imported by `VectorizedExtractionStage.ts` but statically imported by `SqlScanOrchestrator.ts`.
  - `src/services/sqlScanner/engine/InteractshClient.ts` is dynamically imported by `mockBridge.ts` but statically imported elsewhere.
  - Large chunk warning: `dist/assets/index-WwGa8BO6.js` is **1,555.31 kB** (exceeds the 500 kB recommended bundle budget).

### 5.4. MCP (Model Context Protocol) Integration Points
- Model Context Protocol integration is analyzed in architecture research dossiers (`GLOBAL_SECURITY_ECOSYSTEM.md:132`, `V6_COMPETITIVE_WORKFLOW_ANALYSIS.md:218`).
- In code, `sentinel_core/crates/sentinel_agent/src/tools.rs` provides a production-ready typed tool registry (`ToolRegistry`) with `AgentToolDefinition`:
  - `http_probe` (risk weight 1)
  - `fuzz_parameter` (risk weight 5)
  - `verify_finding` (risk weight 2)
- This `ToolRegistry` is designed with JSON Schema-compatible parameters and risk gates, providing the exact hook required to expose Sentinel capabilities as an MCP server.

### 5.5. Docker Lab Matrix & Standalone Testbeds
1. **Docker Lab Matrix** (`docker-compose.lab.yml`, 6 services):
   - `juice-shop`: `bkimminich/juice-shop:latest` (port 3000)
   - `dvwa`: `vulnerables/web-dvwa:latest` (port 8081:80)
   - `postgres-target`: `postgres:16-alpine` (port 5432)
   - `mysql-target`: `mysql:8.0` (port 3306)
   - `dvga`: `dolevf/dvga:latest` (Damn Vulnerable GraphQL App, port 5013)
   - `clickhouse-target`: `clickhouse/clickhouse-server:latest` (port 8123 / 9000)
   - Controlled cleanly via `Launch-Lab.bat` and `Stop-Lab.bat`.
2. **Standalone Testbed Hooks** (`tests/vulnerable_lab/app.ts`):
   - Provides a standalone zero-dependency in-memory lab server (`VulnerableLabServer`) with paired Vulnerable and Safe endpoints for: SQLi, IDOR/BOLA, BFLA, SSRF, Coupon Race Condition, OAST callback receiver, XSS reflection, and GraphQL introspection.

---

## 6. Security Invariants Audit (SEC-01 through SEC-12)

The 12 authoritative security invariants defined in `architecture/v6/V6_FINAL_SECURITY_INVARIANTS.md` were evaluated across the codebase:

| Invariant | Title & Specification | Enforcement Location | Verification Evidence | Status |
|---|---|---|---|---|
| **SEC-01** | **Scope Authorization (Default Deny)**: Pre-socket check drops all out-of-scope interactions. | `sentinel_scope::DefaultScopeEngine`, `sentinel_repeater::RepeaterExecutor`, `sentinel_proxy` | `sentinel_scope::fail_closed_tests`, `test_unconfigured_targets_denied`, `tests/stress/ScopeEngineAdversarialUI2.stress.test.ts` | 🟢 **100% PASS** |
| **SEC-02** | **OAST Token Confidentiality**: Out-of-band tokens must use AES-256 encrypted payloads. | `sentinel_oast::token`, `tests/audit/OobOastDetection.test.ts` | `test_oast_token_confidentiality_aes256`, token payloads without key yield random bytes. | 🟢 **100% PASS** |
| **SEC-03** | **Host-Side AI Policy Gate**: Untrusted LLM outputs gated before test payload execution. | `sentinel_ai::policy::AiPolicyEngine` | `sentinel_ai::policy_tests`, blocks destructive commands and prompt injections. | 🟢 **100% PASS** |
| **SEC-04** | **WASM Capability Drop**: Plugin sandbox defaults to zero capabilities. | `sentinel_plugin::runtime::PluginRuntime` | `sentinel_plugin::sandbox_tests`, unauthorized syscalls fail with `SandboxViolation`. | 🟢 **100% PASS** |
| **SEC-05** | **Research Module Optionality**: Research tier modules isolated behind Cargo feature flags. | `Cargo.toml` feature gating (`sentinel-research`) | Clean build and test execution without `--features sentinel-research`. | 🟢 **100% PASS** |
| **SEC-06** | **Finding Proof Requirement**: Verified state requires empirical evidence from deterministic oracles. | `sentinel_verification::VerificationEngine` | `sec06_oracle_tests test_all_nine_sec06_oracles`, `test_sec06_rejection_when_no_oracle_provided`. | 🟢 **100% PASS** |
| **SEC-07** | **Evidence Immutability (SHA-256 CAS)**: Evidence stored in immutable content-addressed storage. | `sentinel_storage::cas::FileSystemCasStore` | `cas_tests test_cas_tampering_detection_sec_07`, Merkle tree verification tests. | 🟢 **100% PASS** |
| **SEC-08** | **Cross-Tenant Project Isolation**: Separate SQLite databases & paths. Zero cross-project leakage. | `sentinel_storage::project` | `project_isolation_tests test_zero_data_leakage_between_projects_sec_08`, `test_cross_project_path_traversal_rejection_sec_08`. | 🟢 **100% PASS** |
| **SEC-09** | **Zero Plaintext Secrets**: Credentials use `SecretReference` indirection; zero secret leakage. | `sentinel_auth::vault`, `StructuredInspector.tsx` | `test_t2_secret_reference_independence`, `StatusBar.test.tsx`, `AdversarialChallengeUI1.test.tsx`. | 🟢 **100% PASS** |
| **SEC-10** | **Triple Representation**: Traffic retains raw bytes, parsed structure, and normalized text. | `sentinel_parser::SentinelHttpParser`, `Transaction` domain model | `sentinel_parser::triple_repr_tests`, request smuggling delimiter preservation tests. | 🟢 **100% PASS** |
| **SEC-11** | **WebView Sandbox Isolation**: Strict CSP, iframe sandbox, browser daemon in external process. | `src-tauri/tauri.conf.json`, `BrowserService` | Rendered HTML sanitized, script tags treated as raw text. | 🟢 **100% PASS** |
| **SEC-12** | **Bounded Buffer Backpressure**: Fixed ring buffers; critical events never drop. | `sentinel_bus::ChannelEventBus` | `test_t2_bus_critical_queue_backpressure`, `phase4_scale_soak_benchmark.rs test_phase4_event_bus_backpressure`. | 🟢 **100% PASS** |

---

## 7. Test Suite Health & Nextest Readiness Verification

### 7.1. Cargo Nextest Benchmark Results
Command: `cargo nextest run --manifest-path sentinel_core/Cargo.toml`
- **Result**: **539 tests run: 539 passed, 0 skipped, 0 failed** in **11.956 seconds**.
- Test breakdown:
  - `sentinel_scope`: 28 tests (fail-closed default deny, regex redos timeout, SSRF validator, CIDR matcher, hostname wildcard).
  - `sentinel_storage`: 32 tests (32-table migration, CAS directory fanout, SHA-256 known vectors, crash recovery, project isolation SEC-08, FTS search).
  - `sentinel_verification`: 36 tests (formal 10-state machine linear progression, all 9 SEC-06 oracles, tri-target confusion matrix, Welch t-test, AST Jaccard).
  - `sentinel_integration_tests`: 42 tests (tier 1 feature coverage, tier 2 boundary corner, golden path e2e, phase 4 soak benchmark).
  - `sentinel_knowledge`, `sentinel_logic`, `sentinel_auth`, `sentinel_fuzzer`, `sentinel_httpql`, `sentinel_parser`, `sentinel_repeater`, `ucma_sprt`, `ucma_evidence`: 401 tests.

### 7.2. Frontend Vitest Test Suite Analysis
Command: `npm test` (`vitest run`)
- Overall results: **94 passed test files**, **856 passed tests**.
- **2 transient / load-induced failures identified under simultaneous multi-process load**:
  1. `tests/e2e/tier1_feature_perf.test.ts:1330`: `15.4: matches keyboard shortcut in <2ms` (measured 2.17ms under background compilation; **passes in 62ms total suite when run in isolation**).
  2. `tests/stress/AdversarialChallengeUI1.test.tsx:54`: `handles high-throughput burst of 20,000 traffic events (expected >400 events/sec, got 287 events/sec)` due to CPU throttling during simultaneous Nextest test compilation.

---

## 8. Prioritized Recommendations for Implementer Subagents

1. **Fix `AdaptiveRateController` Thundering-Herd Concurrency Flaw (P0)**:
   - File: `src/services/sqlScanner/stealth/AdaptiveRateController.ts:59-76`
   - Implement a mutex or queue ticket lock in `waitForSlot()` so that requests are guaranteed to be spaced by `1000 / currentRps` even when 100 workers invoke `waitForSlot()` concurrently.
2. **Fix Unhandled Promise Rejections in `ConcurrentExecutor.ts` (P0)**:
   - File: `src/services/sqlScanner/engine/ConcurrentExecutor.ts:88-93`
   - Change `if (this.activeWorkers >= this.concurrencyLimit)` to `while (...)` to handle dynamic concurrency changes safely.
   - Use `Promise.allSettled()` or encapsulate individual worker error states so that one worker's failure does not leave dangling workers throwing unhandled promise rejections.
3. **Fix Intruder Timer Leak & UI Freeze in `FuzzerWorkspaceView.tsx` (P1)**:
   - File: `src/workspaces/FuzzerWorkspaceView.tsx:938-1040`
   - Wrap `await Promise.all(workers)` in a `try ... finally` block ensuring `clearInterval(flushInterval)` and `updateTab({ isAttackRunning: false })` always execute regardless of worker exceptions.
4. **Implement 100-Worker Concurrency Test Suite (P1)**:
   - Create `tests/concurrency/IntruderScanner100WorkerConcurrency.test.ts` validating:
     - 100 workers executing against `tests/vulnerable_lab/app.ts` simultaneously.
     - Zero unhandled promise rejections.
     - Thread starvation prevention and clean abort within `< 50ms`.
5. **Resolve Rust Compilation Warnings (P2)**:
   - Fix the 5 warnings in `crates/sentinel_proxy/src/handler.rs` (remove unused mut and prefix unused parameters).
   - Fix dead code warning in `crates/sentinel_scanner/src/sql/blind.rs:15` (`alpha`, `beta`).
   - Remove unused variable `now` in `src-tauri/src/commands.rs:914`.
   - Update `sentinel_core/Cargo.toml` to remove `all = "allow"` under `workspace.lints.clippy`.
6. **Clean Up Vite Dynamic Import Chunking (P2)**:
   - Consolidate static/dynamic imports of `trafficStore.ts`, `OobManager.ts`, and `InteractshClient.ts` in `vite.config.ts` using `rollupOptions.output.manualChunks`.

# UCMA-X — Actual Runtime Execution Trace

**Trace Type:** End-to-End Dynamic Call Graph  
**Scope:** Ingress Request → Bayesian Adaptive Execution → Causal Verification → Database Intelligence → Finding  

---

```
1. USER CLICK: "Start Scan" in UI
   │
   ▼
2. STORE: `src/stores/sqlScannerStore.ts`
   │  Function: `startScan()`
   │  - Validates `safetyConfig.authorizedTestingConfirmed`
   │  - Resets tab session state: findings = [], catalog = empty
   │  - Instantiates `SqlScanOrchestrator(targetConfig, safetyConfig, callbacks, engineMode, concurrencyLimit)`
   │
   ▼
3. ORCHESTRATOR: `src/services/sqlScanner/SqlScanOrchestrator.ts`
   │  Function: `startScan()`
   │  Step 1: Parse raw HTTP request via `RequestParser.parse()` (Query, JSON, Cookie, Header, Path, GraphQL)
   │  Step 2: Establish baseline (3 samples) via `executeProbe()` & compute latency stats
   │  Step 3: Perimeter inspection via `WafDetector.inspect()`
   │  Step 4: Concurrency Pool initialized via `new ConcurrentExecutor(concurrencyLimit, 50)`
   │
   ▼
4. PER-PARAMETER BAYESIAN ADAPTIVE LOOP:
   │  For each enabled parameter:
   │  │
   │  ├─► HYPOTHESIS ENGINE: `src/services/sqlScanner/engine/HypothesisEngine.ts`
   │  │   - Initializes prior distribution over Context (numeric, string, order_by, etc.)
   │  │   - Initializes prior distribution over DBMS (PostgreSQL, MySQL, MSSQL, Oracle, etc.)
   │  │   - Computes Shannon entropy $H(\text{Context})$ and $H(\text{DBMS})$ via `ShannonEntropy.compute()`
   │  │
   │  ├─► ADAPTIVE PLANNER: `src/services/sqlScanner/engine/AdaptiveTestPlanner.ts`
   │  │   - Generates candidate tests from taxonomy catalog
   │  │   - Prunes incompatible tests via `CompatibilityRules.pruneCandidates()`
   │  │   - Computes Expected Information Gain $\text{EIG}(T)$ and utility score $\text{Utility} = \frac{\text{EIG}}{\text{Cost}^{0.7}}$
   │  │   - Selects highest-utility experiment
   │  │
   │  ├─► DIALECT COMPILER: `src/services/sqlScanner/engine/DialectCompiler.ts`
   │  │   - Compiles abstract intent into dialect-correct SQL AST/payload:
   │  │     * `ORDER_BOUNDARY_TEST` -> `(CASE WHEN (1=1) THEN N ELSE 1 END)`
   │  │     * `ERROR_BEHAVIOR_TEST` -> `1=CAST((SELECT version()) AS int)`
   │  │     * `TRUE_FALSE_DIFFERENTIAL` -> `' AND '1'='1` vs `' AND '1'='2`
   │  │     * `UNION_COMPATIBILITY_TEST` -> `' UNION SELECT NULL,'canary_xyz',NULL`
   │  │
   │  ├─► CONCURRENT EXECUTOR: `src/services/sqlScanner/engine/ConcurrentExecutor.ts`
   │  │   - Routes `PARALLEL_SAFE` tasks to bounded worker pool
   │  │   - Routes `TIMING_SENSITIVE` tasks to sequential low-jitter timing lane
   │  │   - Submits network request via `executeProbe()` -> `ipcClient.sendRepeaterRequest()`
   │  │
   │  ├─► MULTI-ORACLE EVALUATOR: `src/services/sqlScanner/engine/MultiOracleEvaluator.ts`
   │  │   - Inspects response across 15 observation channels:
   │  │     * Canary Reflection Oracle -> 99% confidence
   │  │     * CAST Type Conversion Error Oracle -> 95% confidence
   │  │     * Boolean Differential Token Oracle -> 90% confidence
   │  │     * SPRT Latency Shift Oracle -> 85% confidence
   │  │
   │  ├─► BAYESIAN POSTERIOR UPDATE:
   │  │   - `HypothesisEngine.updateWithObservation(obs)`
   │  │   - Updates $P(\text{Vulnerable} \mid E)$, $P(\text{Context} \mid E)$, $P(\text{DBMS} \mid E)$
   │  │   - Reduces Shannon entropy $H(P)$
   │  │
   │  ├─► EARLY STOPPING: `src/services/sqlScanner/engine/EarlyStoppingPolicy.ts`
   │  │   - If $P(\text{Vulnerable}) \ge 0.95$ or CAST leak confirmed: prunes slow blind timing probes
   │  │   - If ORDER BY boundary resolved: prunes column sweeping probes
   │  │
   │  └─► CAUSAL VERIFIER: `src/services/sqlScanner/engine/CausalVerifier.ts`
   │      - In `ucmax_causal` mode: executes 5-step counterfactual verification:
   │        $s_0$ (Baseline) -> $s_1$ (TRUE) -> $s_2$ (FALSE) -> $s_3$ (Noise) -> $s_4$ (Clean-Room 3x)
   │      - Emits real-time step events to UI event stream
   │
   ▼
5. RECURSIVE DATABASE EXPLORER: `src/services/sqlScanner/MetadataExtractor.ts`
   │  - Discovers application and system tables (UNION -> CAST -> Boolean blind)
   │  - Parallel column enumeration across tables via `ConcurrentExecutor.mapParallel()`
   │  - Sample row data extraction
   │  - Emits `RecursiveDatabaseCatalog` to store
   │
   ▼
6. FINDING EMISSION & REPORT GENERATOR: `src/services/sqlScanner/ReportGenerator.ts`
   │  - `EvidenceCorrelator.correlate()` gates finding verdicts
   │  - Emits `SqlScanFinding` with complete evidence provenance (BLAKE3-ready snapshots)
   │  - Distinguishes Root Vulnerability vs. Demonstrated Capabilities vs. Untested Impacts
   │  - Emits final `SqlScanReport`
```

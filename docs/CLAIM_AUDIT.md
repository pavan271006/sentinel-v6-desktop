# UCMA-X — Claim Audit & Discrepancy Matrix

**Auditor:** Independent Principal Security Engineer & Systems Architect  
**Evaluation Standard:** Runtime Execution Reality vs. Theoretical Specification  
**Verdict Scale:** `VERIFIED` | `PARTIALLY_VERIFIED` | `BENCHMARK_ONLY` | `SCAFFOLDED` | `FALSE`

---

## 1. Matrix of Core System Claims

| # | Stated Claim | Code Location | Actual Runtime Status | Verification Evidence / Discrepancy | Verdict |
|:---|:---|:---|:---|:---|:---|
| **C1** | **Taxonomy-Driven Configuration Space** | `taxonomy/TaxonomyCatalog.ts`, `CompatibilityRules.ts` | **ACTIVE & VERIFIED** | 11 dimensions defined; `CompatibilityRules.isCompatible` prunes invalid context/DBMS pairs. | `VERIFIED` |
| **C2** | **Bayesian Hypothesis & Belief State** | `engine/HypothesisEngine.ts`, `BeliefState.ts` | **ACTIVE & VERIFIED** | Computes Shannon entropy $H(P)$; updates posterior probabilities upon observations. Tested in `ucmax_p0_engine.test.ts`. | `VERIFIED` |
| **C3** | **Expected Information Gain (EIG) Planner** | `engine/AdaptiveTestPlanner.ts` | **PARTIALLY VERIFIED** | `AdaptiveTestPlanner.selectNextExperiment` computes EIG and utility. In `SqlScanOrchestrator.ts`, per-parameter loop still runs sub-phases (Error -> Boolean -> Time -> UNION) rather than replacing the outer loop with a pure `while(!isTerminal)` planner loop. | `PARTIALLY_VERIFIED` |
| **C4** | **Early Stopping Policy** | `engine/EarlyStoppingPolicy.ts` | **ACTIVE & VERIFIED** | Halts blind probing upon $\ge 95\%$ confidence or CAST error leak; stops column sweeping upon boundary establishment. | `VERIFIED` |
| **C5** | **Bounded Parallel Concurrency (10–50x)** | `engine/ConcurrentExecutor.ts` | **PARTIALLY VERIFIED** | `ConcurrentExecutor` supports 10-50 concurrency with sequential timing lane. Tested in `ucmax_p0_engine.test.ts`. Full parallel mapping across multiple parameters and tables needs end-to-end integration. | `PARTIALLY_VERIFIED` |
| **C6** | **5-Step Causal Counterfactual Proof** | `engine/CausalVerifier.ts` | **ACTIVE & VERIFIED** | S0 (Baseline) -> S1 (TRUE) -> S2 (FALSE) -> S3 (Noise) -> S4 (Clean-Room 3x). Live execution hooked into `SqlScanOrchestrator.ts` in `ucmax_causal` mode. | `VERIFIED` |
| **C7** | **Dynamic CASE-Based ORDER BY Boundary Validation** | `engine/DialectCompiler.ts` | **ACTIVE & VERIFIED** | Generates `(CASE WHEN (1=1) THEN N ELSE 1 END)` differential test pairs. | `VERIFIED` |
| **C8** | **Multi-Oracle Evidence Fusion** | `engine/MultiOracleEvaluator.ts` | **ACTIVE & VERIFIED** | Fuses Canary reflection, CAST leaks, Boolean differentials, and SPRT latency shifts. | `VERIFIED` |
| **C9** | **Wald's SPRT Statistical Timing Engine** | `ucma-x/crates/ucma-statistics`, `TimeBasedTester.ts` | **BENCHMARK-ONLY (Rust) / HEURISTIC (TS)** | Rust crate implements Wald LLR; TS runtime uses 3-sample median + $2.5\sigma$ thresholding. Not yet bridged over Tauri IPC. | `BENCHMARK_ONLY` |
| **C10** | **Production AST Compilation** | `engine/DialectCompiler.ts`, `ucma-ast` | **PARTIALLY VERIFIED** | `DialectCompiler` compiles high-level intents to dialect SQL; production extraction still relies on string templates. | `PARTIALLY_VERIFIED` |
| **C11** | **Second-Order Multi-Step Workflow Engine** | `SecondOrderTester.ts`, `ucma-second-order` | **SCAFFOLDED** | 2-request correlation check exists; persistent asynchronous workflow polling is scaffolded. | `SCAFFOLDED` |
| **C12** | **Out-of-Band (OAST) Network Gateway** | `OobManager.ts`, `ucma-oast` | **SCAFFOLDED** | Generates DNS/HTTP payload tokens; live DNS callback listener gateway is not deployed in local environment. | `SCAFFOLDED` |

---

## 2. Discrepancies Requiring Production Engineering

1. **Planner Loop Integration**: `SqlScanOrchestrator.startScan()` should optionally run a pure `while (!isTerminal)` dynamic Bayesian loop driven by `AdaptiveTestPlanner.selectNextExperiment` for each parameter when in `bayesian_adaptive` mode.
2. **Parallel Table Enumeration**: In Database Explorer (Step 8), replace the serial `for` loop over `appTables` with `this.concurrentExecutor.mapParallel(appTables, ...)` to deliver true 10-way bounded concurrent schema extraction.
3. **Wald SPRT TS Implementation**: Add an exact in-process TypeScript implementation of Wald's SPRT algorithm ($LLR = \sum \ln \frac{f_1(x_i)}{f_0(x_i)}$ with thresholds $A = \ln \frac{1-\beta}{\alpha}$ and $B = \ln \frac{\beta}{1-\alpha}$) to ensure TS runtime timing matches the Rust benchmark without IPC latency penalties.

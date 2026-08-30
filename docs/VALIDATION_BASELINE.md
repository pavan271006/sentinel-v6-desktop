# UCMA-X — Validation Baseline Freeze

**Date & Time:** 2026-08-31T01:58:00+05:30  
**Baseline Status:** FROZEN PRIOR TO REFACTOR & GAP RESOLUTION  
**Environment:** Windows (PowerShell), Node.js (v20+), Vitest v3.2.7, Tauri Core  

---

## 1. Verified Test Suite Execution Baseline

The following test suites were executed directly against the live repository without mocking or fabrication:

| Test Suite File | Tests Executed | Passed | Failed | Duration | Verification Command |
|:---|:---|:---|:---|:---|:---|
| `tests/engine/ucmax_p0_engine.test.ts` | 12 | 12 | 0 | 5.46s | `npx vitest run tests/engine/ucmax_p0_engine.test.ts` |
| `src/services/sqlScanner/SqlScannerRegression.test.ts` | 26 | 26 | 0 | 5.35s | `npx vitest run src/services/sqlScanner/SqlScannerRegression.test.ts` |
| `tests/scanner_bench/empiric_validation.test.ts` | 3 | 3 | 0 | 1.63s | `npx vitest run tests/scanner_bench/empiric_validation.test.ts` |
| `tests/scanner_bench/scanner_bench.test.ts` | 2 | 2 | 0 | 0.01s | `npx vitest run tests/scanner_bench/scanner_bench.test.ts` |
| `tests/scanner_identity/scanner_identity.test.ts` | 4 | 4 | 0 | 0.02s | `npx vitest run tests/scanner_identity/` |
| `tests/scanner_comparison/scanner_comparison.test.ts` | 2 | 2 | 0 | 0.01s | `npx vitest run tests/scanner_comparison/` |

**Total Verified Tests in Active Baseline:** 49 tests (100% pass rate).

---

## 2. Frozen Repository Inventory

- **Core TypeScript Scanner Modules:**
  - `src/services/sqlScanner/SqlScanOrchestrator.ts` (1,831 lines)
  - `src/services/sqlScanner/engine/ConcurrentExecutor.ts` (Bounded 10–50x pool)
  - `src/services/sqlScanner/engine/HypothesisEngine.ts` (Bayesian probability & Shannon entropy)
  - `src/services/sqlScanner/engine/AdaptiveTestPlanner.ts` (EIG utility scoring)
  - `src/services/sqlScanner/engine/DialectCompiler.ts` (Semantic intent to SQL compiler)
  - `src/services/sqlScanner/engine/EarlyStoppingPolicy.ts` (Branch pruning)
  - `src/services/sqlScanner/engine/MultiOracleEvaluator.ts` (15 observation channels)
  - `src/services/sqlScanner/engine/CausalVerifier.ts` (5-step counterfactual verification)
  - `src/services/sqlScanner/taxonomy/TaxonomyCatalog.ts` (11-dimensional master catalog)
  - `src/services/sqlScanner/taxonomy/CompatibilityRules.ts` (Compatibility pruning)
  - `src/stores/sqlScannerStore.ts` (Multi-tab session isolation & engine modes)

- **Rust Native Workspace (`ucma-x/crates/`):**
  - 22 modular crates (`ucma-core`, `ucma-causal`, `ucma-planner`, `ucma-statistics`, `ucma-timing`, `ucma-oracles`, `ucma-ast`, `ucma-metamorphic`, `ucma-scope`, `ucma-http`, etc.).

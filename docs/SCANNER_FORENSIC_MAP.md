# Forensic Scanner Source Code Map

This document establishes the precise file-by-file mapping of all SQL scanning, detection, inference, verification, and database exploration capabilities within this repository.

---

## 1. Application Layer SQL Scanner (TypeScript / Frontend / Desktop Engine)

| Capability Domain | File Path | Primary Classes / Functions | Operational Responsibility |
| :--- | :--- | :--- | :--- |
| **Workspace UI & Tabs** | `src/workspaces/SqlScannerWorkspaceView.tsx` | `SqlScannerWorkspaceView` | Multi-tab GUI, UCMA-X strategy switcher, Causal Verification cards, Database Explorer view |
| **Session State Store** | `src/stores/sqlScannerStore.ts` | `useSqlScannerStore`, `syncTabUpdate` | Isolated multi-tab state manager, concurrent scan runner, progressive catalog cache |
| **Scan Orchestrator** | `src/services/sqlScanner/SqlScanOrchestrator.ts` | `SqlScanOrchestrator.startScan()` | 10-phase scan execution pipeline, probe execution, multi-path table/column discovery |
| **Adaptive Probing** | `src/services/sqlScanner/AdaptivePayloadEngine.ts` | `AdaptivePayloadEngine` | Calibration of TRUE/FALSE baselines, quote style inference, binary search value extraction |
| **Error Injection** | `src/services/sqlScanner/ErrorTester.ts` | `ErrorTester.analyzeResponse()` | 30+ regex signatures across 8 DBMS engines including conversion errors |
| **Boolean Differential** | `src/services/sqlScanner/BooleanTester.ts` | `BooleanTester.evaluateDifferential()` | True/False differential pair generation and divergence classification |
| **Time-Based Blind** | `src/services/sqlScanner/TimeBasedTester.ts` | `TimeBasedTester.evaluateTiming()` | Multi-DBMS delay payloads and median latency anomaly validation |
| **UNION & ORDER BY** | `src/services/sqlScanner/UnionTester.ts` | `UnionTester.getOrderByProbes()`, `UnionTester.getPerColumnCanaryProbes()` | ORDER BY column count boundary probing and NULL canary injection |
| **Stacked Queries** | `src/services/sqlScanner/StackedTester.ts` | `StackedTester.evaluateStacked()` | Semicolon multi-statement execution detection |
| **Second-Order SQLi** | `src/services/sqlScanner/SecondOrderTester.ts` | `SecondOrderTester.executeSecondOrderTest()` | Source-to-sink injection and asynchronous state polling |
| **OOB (OAST)** | `src/services/sqlScanner/OobManager.ts` | `OobManager.generateToken()`, `OobManager.pollInteractions()` | Out-of-band DNS/HTTP interaction listener integration |
| **Metadata Extraction** | `src/services/sqlScanner/MetadataExtractor.ts` | `MetadataExtractor.extractErrorBasedData()`, `MetadataExtractor.getErrorBasedTableQueries()` | Direct error-based CAST parsing, column/row regex extraction, identifier validation |
| **Database Adapters** | `src/services/sqlScanner/DatabaseAdapters.ts` | `PostgresAdapter`, `MysqlAdapter`, `MssqlAdapter`, `OracleAdapter` | DBMS-specific dialect queries for versions, schemas, tables, and rows |
| **Confidence Fusion** | `src/services/sqlScanner/ConfidenceEngine.ts` | `ConfidenceEngine.calculateConfidence()` | Multi-indicator evidence scoring and confidence breakdown |
| **Evidence Correlation** | `src/services/sqlScanner/EvidenceCorrelator.ts` | `EvidenceCorrelator.evaluateVerdict()` | Final verdict correlation (`VULNERABLE` vs `NOT CONFIRMED VULNERABLE`) |
| **Report Generation** | `src/services/sqlScanner/ReportGenerator.ts` | `ReportGenerator.generateExecutiveMarkdown()`, `generateTechnicalMarkdown()` | Formatted executive summaries and technical reproduction logs |
| **HTTP Parser** | `src/services/sqlScanner/RequestParser.ts` | `RequestParser.parse()`, `RequestParser.injectPayload()` | RFC HTTP parsing, multi-location parameter discovery (Query, Path, Cookie, Header, JSON, XML, GraphQL) |
| **Safety Guard** | `src/services/sqlScanner/SafetyController.ts` | `SafetyController.validateProbe()`, `throttle()`, `redactSensitiveOutput()` | Authorization gate, rate limiter, payload validator, data redactor |
| **WAF Detection** | `src/services/sqlScanner/WafDetector.ts` | `WafDetector.detect()` | WAF signature recognition (Cloudflare, AWS WAF, Akamai, Imperva, ModSecurity) |

---

## 2. UCMA-X Core Engine (Rust Workspace `ucma-x/crates/`)

| Crate Name | Directory Path | Core Modules / Structs | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| `ucma-core` | `ucma-x/crates/ucma-core/` | `ids::TargetId`, `EndpointId`, `ParameterId`, `FindingId`, `EvidenceDigest` | Deterministic BLAKE3 content-derived IDs, lifecycle state machine |
| `ucma-scope` | `ucma-x/crates/ucma-scope/` | `ScopePolicy`, `SsrfGuard`, `DnsPinning` | Centralized scope authorization, private IP / link-local blocking, DNS rebinding guard |
| `ucma-http` | `ucma-x/crates/ucma-http/` | `AuthorizedClient`, `ReplayEngine`, `ResponseSnapshot` | Bound HTTP dispatcher with timeout, size, and redirect controls |
| `ucma-parameter` | `ucma-x/crates/ucma-parameter/` | `ParameterDiscovery`, `ContextInference` | Lexical parameter extraction and AST context inference |
| `ucma-response` | `ucma-x/crates/ucma-response/` | `ResponseDiffer`, `DynamicContentNormalizer` | Strip non-deterministic tokens (timestamps, CSRF tokens, nonces) |
| `ucma-sql-ir` | `ucma-x/crates/ucma-sql-ir/` | `SqlExpressionNode`, `SemanticMutator` | Dialect-agnostic SQL Intermediate Representation and tree mutators |
| `ucma-dialect` | `ucma-x/crates/ucma-dialect/` | `DialectRegistry`, `PostgresDialect`, `MysqlDialect`, etc. | DBMS-specific syntax emitters and quoting rules |
| `ucma-ast` | `ucma-x/crates/ucma-ast/` | `SqlAstParser`, `StructuralDiffer` | SQL AST parse tree validation and AST differential oracle |
| `ucma-statistics` | `ucma-x/crates/ucma-statistics/` | `WaldSprt`, `MannWhitneyUTest`, `ConfidenceInterval` | Sequential Probability Ratio Test (SPRT) with error rate bounds ($\alpha, \beta$) |
| `ucma-timing` | `ucma-x/crates/ucma-timing/` | `TimingOracle`, `LatencyDriftModel`, `JitterFilter` | EWMA latency drift tracking and $3\sigma$ jitter rejection |
| `ucma-metamorphic` | `ucma-x/crates/ucma-metamorphic/` | `TlpOracle`, `NorecOracle` | Metamorphic relation testing (Ternary Logic Partitioning, Non-Optimizing Reference Engine) |
| `ucma-causal` | `ucma-x/crates/ucma-causal/` | `CausalValidator`, `FiveStepCausalEngine` | 5-Step Causal confirmation (Baseline $\to$ Positive $\to$ Negative $\to$ Noise $\to$ Clean-Room) |
| `ucma-oracles` | `ucma-x/crates/ucma-oracles/` | `MultiOracleEngine`, `EvidenceFusion` | Multi-oracle evidence combination |
| `ucma-planner` | `ucma-x/crates/ucma-planner/` | `AdaptivePlanner`, `BayesianOptimizer` | Information-gain driven experiment selection with cost optimization |
| `ucma-detection` | `ucma-x/crates/ucma-detection/` | `DetectionOrchestrator` | End-to-end detection orchestration and finding promotion |
| `ucma-db` | `ucma-x/crates/ucma-db/` | `DatabaseCatalog`, `SchemaMetadata`, `ExplorerStateMachine` | Formal database schema graph and access status tracking |
| `ucma-explorer` | `ucma-x/crates/ucma-explorer/` | `RecursiveExplorer`, `ValueExtractor` | Recursive schema walking and column value extraction |
| `ucma-evidence` | `ucma-x/crates/ucma-evidence/` | `ContentAddressableStore`, `MerkleProvenance` | BLAKE3 CAS repository and cryptographic evidence chain |
| `ucma-bench` | `ucma-x/crates/ucma-bench/` | `SyntheticLabHarness`, `GroundTruthBenchmark` | Automated benchmark fixtures for TP/FP/TN/FN evaluation |
| `ucma-cli` | `ucma-x/crates/ucma-cli/` | `main` | Standalone CLI for headless UCMA-X execution |

---

## 3. Tauri IPC Integration Bridge

| Bridge File | Function / Command | Purpose |
| :--- | :--- | :--- |
| `src-tauri/src/commands.rs` | `cmd_ucmax_analyze_boolean` | Bridges frontend candidate probes to `ucma_detection::DetectionOrchestrator::analyze_boolean_differential` |
| `src-tauri/src/commands.rs` | `cmd_ucmax_plan_next_step` | Bridges frontend orchestrator to `ucma_planner::AdaptivePlanner::select_next_step` |
| `src/ipc/client.ts` | `ipcClient.ucmaxAnalyzeBoolean()` | TypeScript async client invoker for boolean causal evaluation |
| `src/ipc/client.ts` | `ipcClient.ucmaxPlanNextStep()` | TypeScript async client invoker for Bayesian next-step planning |

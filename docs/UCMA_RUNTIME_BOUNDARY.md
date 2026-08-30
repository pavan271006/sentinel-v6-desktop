# UCMA-X Runtime Boundary & Component Audit

This document records the exact architectural boundary between the TypeScript UI / Desktop Orchestrator and the native Rust UCMA-X Core Crates.

---

## 1. Capability & Component Boundary Matrix

| Capability Dimension | TypeScript Implementation | Tauri IPC Command | Rust Implementation (`ucma-x/crates/`) | Actual Runtime Path | Redundancy Classification | Authoritative Engine |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Scope & SSRF Guard** | `SafetyController.ts` | — | `ucma-scope::ScopePolicy` | Client gate $\to$ IPC gate | **PARTIAL** (Dual Guard) | Rust `ucma-scope` |
| **HTTP Transport** | `ipcClient.sendRepeaterRequest` | `cmd_repeater_send_request` | `sentinel_repeater` / Tokio Hyper | TS $\to$ IPC $\to$ Tokio | **SHARED** | Tokio Network Stack |
| **Parameter Discovery** | `RequestParser.ts` | — | `ucma-parameter::ParameterDiscovery` | TS Lexical $\to$ Rust AST | **SHARED** | Unified |
| **Dynamic Content Diff**| `AdaptivePayloadEngine.stripDynamicContent` | — | `ucma-response::DynamicContentNormalizer` | TS / Rust Normalizers | **REDUNDANT** | Rust `ucma-response` |
| **SQL AST Parsing** | String Template Replacement | — | `ucma-ast::SqlAstParser` | AST in Rust; String in TS | **PARTIAL** | Rust `ucma-ast` |
| **Dialect Definitions** | `DatabaseAdapters.ts` | — | `ucma-dialect::DialectRegistry` | Both maintain dialect AST | **SYNCHRONIZED** | Rust `ucma-dialect` |
| **Error Signatures** | `ErrorTester.ts` (30+ regexes) | — | `ucma-oracles::ErrorOracle` | TS scans response body | **SYNCHRONIZED** | TypeScript & Rust |
| **Error-Based CAST** | `MetadataExtractor.ts` | — | `ucma-explorer::ValueExtractor` | TS $\to$ DB Explorer | **SHARED** | `MetadataExtractor.ts` |
| **5-Step Causal Engine** | `ConfidenceEngine.ts` (Causal card) | `cmd_ucmax_analyze_boolean` | `ucma-causal::FiveStepCausalEngine` | TS invokes Rust IPC | **BRIDGED** | Rust `ucma-causal` |
| **Bayesian Planner** | `AdaptivePayloadEngine.ts` | `cmd_ucmax_plan_next_step` | `ucma-planner::AdaptivePlanner` | TS invokes Rust IPC | **BRIDGED** | Rust `ucma-planner` |
| **Sequential Timing** | `TimeBasedTester.ts` | — | `ucma-statistics::WaldSprt` | TS median $\to$ SPRT | **PARTIAL** | Rust `ucma-statistics` |
| **Database Explorer** | `sqlScannerStore.ts` + React Tree | — | `ucma-db::DatabaseCatalog` | TS reactive Zustand tree | **SHARED** | TS Store / React Tree |
| **Evidence & CAS** | `SqlScanFinding.evidence` | — | `ucma-evidence::ContentAddressableStore` | BLAKE3 Content Digestion | **SYNCHRONIZED** | BLAKE3 Standard |

---

## 2. Component Execution Status Classification

- **`ucma-core`**: `IMPLEMENTED + USED` (BLAKE3 IDs, deterministic finding hashing).
- **`ucma-scope`**: `IMPLEMENTED + USED` (Scope policy and private network SSRF blocking).
- **`ucma-http`**: `IMPLEMENTED + USED` (Tokio async request dispatch).
- **`ucma-parameter`**: `IMPLEMENTED + USED` (Lexical & AST parameter models).
- **`ucma-response`**: `IMPLEMENTED + USED` (Dynamic content normalization).
- **`ucma-sql-ir`**: `IMPLEMENTED + PARTIALLY USED` (IR nodes used in synthetic testing; UI uses format templates).
- **`ucma-dialect`**: `IMPLEMENTED + USED` (Postgres, MySQL, MSSQL, Oracle, SQLite grammar).
- **`ucma-ast`**: `IMPLEMENTED + PARTIALLY USED` (AST parser verified in test harness).
- **`ucma-statistics`**: `IMPLEMENTED + USED` (Wald's SPRT and Mann-Whitney distributions).
- **`ucma-timing`**: `IMPLEMENTED + USED` (EWMA latency drift & $3\sigma$ filter).
- **`ucma-metamorphic`**: `IMPLEMENTED + PARTIALLY USED` (TLP & NoREC verified in benchmark harness).
- **`ucma-causal`**: `IMPLEMENTED + USED` (5-step causal state machine bridged via IPC).
- **`ucma-oracles`**: `IMPLEMENTED + USED` (Multi-oracle evidence fusion).
- **`ucma-planner`**: `IMPLEMENTED + USED` (Bayesian adaptive planning bridged via IPC).
- **`ucma-detection`**: `IMPLEMENTED + USED` (Orchestrator finding promotion).
- **`ucma-db`**: `IMPLEMENTED + USED` (Database schema metadata models).
- **`ucma-explorer`**: `IMPLEMENTED + USED` (Recursive schema traversal).
- **`ucma-evidence`**: `IMPLEMENTED + USED` (CAS cryptographic evidence store).
- **`ucma-graphql`**: `SCAFFOLDED` (Basic variable injection; AST schema mutation scaffolded).
- **`ucma-grpc`**: `SCAFFOLDED` (Protobuf wire serializer scaffolded).

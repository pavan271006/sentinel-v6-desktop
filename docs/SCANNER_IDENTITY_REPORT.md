# Final Scanner Identity & Architectural Convergence Report

## Executive Forensic Verdict: `PARTIALLY_OVERLAPPING` (Hybrid Desktop Orchestrator + Native Rust UCMA-X Engine)

Based on forensic source-code inspection, call-graph analysis, and controlled benchmark testing across both the application layer (`src/services/sqlScanner/`) and the native Rust engine (`ucma-x/crates/`), this report confirms the exact structural relationship between the systems.

---

### 1. The Concrete Reality
The system is neither "completely different" nor "identical duplicate code":
- **Application GUI Layer (`src/services/sqlScanner/` & `src/stores/sqlScannerStore.ts`)**: Implements a high-performance TypeScript orchestration pipeline that manages interactive user workflows, multi-tab scanning, live Database Explorer rendering, real-time logging, and IPC communication.
- **Native Engine Layer (`ucma-x/crates/`)**: Implements the research-grade Rust workspace providing formal causal validation (5-Step Causal Engine), statistical hypothesis testing (Wald's SPRT), AST parsing, metamorphic invariants, and deterministic BLAKE3 CAS evidence storage.
- **Bridge Integration (`src-tauri/src/commands.rs` & `src/ipc/client.ts`)**: Links the GUI orchestrator directly to the native Rust UCMA-X algorithms (`cmd_ucmax_analyze_boolean`, `cmd_ucmax_plan_next_step`).

---

### 2. Forensic Findings Summary

1. **Runtime Execution**: Live probing in the desktop app is driven by `SqlScanOrchestrator.ts` sending requests via Tauri IPC, leveraging `AdaptivePayloadEngine.ts` and `MetadataExtractor.ts` for response analysis and schema extraction, while utilizing UCMA-X native Rust commands for causal confirmation and planning.
2. **Error-Based CAST Discovery**: Both systems implement direct error-based extraction queries (`CAST((SELECT ... LIMIT 1 OFFSET n) AS int)`), supporting PostgreSQL, MSSQL, MySQL, and Oracle type conversion error streams.
3. **Database Explorer**: Progressive catalog tree discovers schemas, tables, columns, and sample row credentials without requiring full page DOM reflections.
4. **Multi-Tab Isolation**: Zustand session state store isolates scan sessions per tab ID, enabling multiple live scans to execute concurrently in the background without state collision or thread blocking.

---

### 3. Architecture Classification

```
┌─────────────────────────────────────────────────────────────┐
│                    SENTINEL DESKTOP GUI                     │
│  (Multi-Tab Workspace, Database Explorer, Causal UI Cards)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
   ┌───────────────────────────┐ ┌───────────────────────────┐
   │ TS Orchestrator Pipeline  │ │  UCMA-X Native Rust Core  │
   │ - Multi-Path Discovery    │ │ - 5-Step Causal Engine    │
   │ - CAST Error Extraction   │ │ - Wald SPRT Statistics    │
   │ - Dynamic Catalog Cache   │ │ - AST & Metamorphic TLP   │
   │ - Live Progressive UI     │ │ - BLAKE3 CAS Provenance   │
   └─────────────┬─────────────┘ └─────────────┬─────────────┘
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                 ┌───────────────────────────┐
                 │  Tauri Async Network IPC  │
                 │   (Tokio / HTTP Pipeline) │
                 └───────────────────────────┘
```

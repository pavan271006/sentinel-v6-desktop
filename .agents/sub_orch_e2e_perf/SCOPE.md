# Scope: E2E Performance & Workflow Testing Track (Sentinel V6)

## Architecture & Test Philosophy
- **Requirement-Driven & Opaque-Box**: Tests are derived strictly from user requirements, specification invariants (SEC-01 through SEC-12), and performance budgets (38A-38Y, 39-54), not internal mocks.
- **Multi-Tier Test Pyramid**:
  - **Tier 1 - Feature Performance & Latency Isolation (≥5 tests per feature)**: Startup, navigation, scope evaluation, traffic ingestion & rendering, repeater replaying, fuzzer mutators, authz matrix checks, findings lifecycle, CAS evidence hashing, report export.
  - **Tier 2 - Boundary, Corner & Extreme Dataset Limits (≥5 tests per feature)**: 0 items, 100K items, 500K items, 1M items, 1MB-100MB bodies, 10K/20K command palette items, zero memory leak on repeat open/close.
  - **Tier 3 - Cross-Feature Combinations & Stream Interaction (Pairwise)**: High-burst 50k-100k events/sec traffic + live HTTPQL filtering, Fuzzer/Scanner concurrent execution + UI inspector rendering, OAST callback flood + SQLite audit logging.
  - **Tier 4 - Real-World Pentester Workload Scenarios (End-to-End)**: 17-step CLI-Independence suite, 24-step Pentester UX validation suite, 34-step Native Desktop Pentester Workflow, sustained 30m/1h/4h concurrent memory stability.

## Feature Inventory Coverage Map
| # | Feature / Subsystem | Source Requirement | Tier 1 (Isolation) | Tier 2 (Limits) | Tier 3 (Cross-Stream) | Tier 4 (Workload) |
|---|---------------------|--------------------|:------------------:|:---------------:|:---------------------:|:-----------------:|
| 1 | App Startup & Shell Navigation | R1, R2, 38E | 5 | 5 | ✓ | ✓ |
| 2 | Scope Engine & SEC-01 Pre-Socket Check | R3, SEC-01 | 5 | 5 | ✓ | ✓ |
| 3 | Traffic Ingestion, Storage & Pagination | R3, R4, 38G, 38I | 5 | 5 | ✓ | ✓ |
| 4 | Virtualized Table & DOM Footprint | R2, 38E, 38F, 38Y | 5 | 5 | ✓ | ✓ |
| 5 | HTTPQL Filter Engine & AST Compilation | R2, R3, 38E | 5 | 5 | ✓ | ✓ |
| 6 | Raw Byte & Structured Inspector | R3, 38E | 5 | 5 | ✓ | ✓ |
| 7 | Repeater & Myers Linear-Space Diff Engine | R3, R4, 38O, 38P | 5 | 5 | ✓ | ✓ |
| 8 | Scanner & Mutation Fuzzer Engine | R3, R4, 38Q, 38R | 5 | 5 | ✓ | ✓ |
| 9 | Identity Vault & Authorization Matrix (IRA+) | R3, SEC-09 | 5 | 5 | ✓ | ✓ |
| 10 | API Security, Browser Daemon & OAST Engine | R3, R4, 38U, 38V | 5 | 5 | ✓ | ✓ |
| 11 | Findings Center & Cryptographic CAS Evidence | R3, SEC-06, SEC-07 | 5 | 5 | ✓ | ✓ |
| 12 | Pentester Notebook, Timeline & Tasks | R3 | 5 | 5 | ✓ | ✓ |
| 13 | Attack Graph Culling & Coverage Heatmap | R3, R4, 38U | 5 | 5 | ✓ | ✓ |
| 14 | Automated Multi-Format Report Export | R3, R4, 38S | 5 | 5 | ✓ | ✓ |
| 15 | Global Search & Command Palette (Ctrl+K) | R2, 38E | 5 | 5 | ✓ | ✓ |
| 16 | Dual-Channel Event Bus & Telemetry Coalescing | R3, 38G, 38H | 5 | 5 | ✓ | ✓ |
| 17 | Database Transactions, WAL & Checkpoints | R4, 38S, 38T | 5 | 5 | ✓ | ✓ |
| 18 | Memory Stability & Bounded Heaps (T0-T4h) | R5, 38J, 38K, 44, 45| 5 | 5 | ✓ | ✓ |
| 19 | 17-Step CLI-Independence Workflow | R5, AC | 5 | 5 | ✓ | ✓ |
| 20 | 24-Step Pentester Validation Sequence | R5, AC | 5 | 5 | ✓ | ✓ |
| 21 | 34-Step Real Pentester GUI Workflow | R6, 39-54 | 5 | 5 | ✓ | ✓ |
| 22 | Clean-Machine Independent Execution | R6, 54 | 5 | 5 | ✓ | ✓ |
| 23 | Optimization Regression Invariants Gate | R7 | 5 | 5 | ✓ | ✓ |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E-M0 | Codebase & Test Inventory Survey | 3 Explorers inspecting existing tests, Rust benched crates, frontend harnesses, Tauri IPC | none | IN_PROGRESS |
| E2E-M1 | Test Infrastructure Design (`TEST_INFRA.md`) | Authoritative test runner specification, test harness layout, command interfaces | E2E-M0 | PLANNED |
| E2E-M2 | Tier 1 & Tier 2 Performance & Limits Suites | Implementation of isolation latency benchmarks and boundary/dataset limits (100K-1M, 1MB-100MB) | E2E-M1 | PLANNED |
| E2E-M3 | Tier 3 & Tier 4 Stream & Real-World Suites | Implementation of pairwise event storm tests and multi-step pentesting workflow simulations (17/24/34-step) | E2E-M2 | PLANNED |
| E2E-M4 | Test Runner Automation & Execution Verification | Automated runner scripts, command validation, zero failure verification | E2E-M3 | PLANNED |
| E2E-M5 | Review, Challenge & Forensic Integrity Audit | Multi-agent review, adversarial stress tests, and binary-veto forensic integrity audit | E2E-M4 | PLANNED |
| E2E-M6 | Publication of `TEST_READY.md` & Delivery | Publish `TEST_READY.md`, update documentation, and send completion signal to parent | E2E-M5 | PLANNED |

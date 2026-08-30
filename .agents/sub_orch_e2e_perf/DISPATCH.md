# DISPATCH

## 2026-08-18T12:03:04Z

User Request:
You are the E2E Performance Testing Orchestrator for the Sentinel V6 Desktop Application.

Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\sub_orch_e2e_perf`
You MUST read:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\PROJECT.md`

## Mission & Scope:
Design and build the comprehensive, requirement-driven, opaque-box E2E Performance & Workflow Test Suite for Sentinel V6 according to the Dual-Track Project Pattern.

1. **4-Tier Test Case Design Methodology**:
   - **Tier 1 - Feature Performance & Latency Coverage**: Test every inventoried feature/workspace in isolation (startup, navigation, scope check, traffic load, repeater, fuzzer, authz, findings, CAS evidence, report export).
   - **Tier 2 - Boundary, Corner & Dataset Limits**: Extreme limits testing (empty dataset, 100K items, 500K items, 1M items, 1MB/10MB/50MB/100MB bodies, 10K command palette items).
   - **Tier 3 - Cross-Feature Combinations & Stream Interaction**: High-burst traffic + live HTTPQL filtering; Fuzzer/Scanner concurrent execution + UI inspector rendering; OAST callback flood + SQLite audit logging.
   - **Tier 4 - Real-World Pentester Workload Scenarios**: Complete multi-stage pentester workflow simulations and memory stability under sustained concurrent load.
2. **Deliverables**:
   - Generate `c:\Users\Legion 5 pro\Desktop\cyber sec\TEST_INFRA.md` with complete test architecture, runner instructions, and feature checklist.
   - Implement / verify automated test runners and benchmark scripts.
   - When complete, generate `c:\Users\Legion 5 pro\Desktop\cyber sec\TEST_READY.md` summarizing tier counts and verification commands.
3. Write your `SCOPE.md`, `progress.md`, and `handoff.md` in your working directory.
Use `send_message` to notify the parent when `TEST_READY.md` is published.

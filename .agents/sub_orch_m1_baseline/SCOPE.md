# Scope: Milestone 1 — Baseline Profiling, Environment Setup & Build Fixes

## Overview
Milestone 1 establishes the baseline for the Sentinel V6 Desktop Application. It fixes existing compilation/test issues, runs the test baseline across frontend and backend, conducts real performance baseline measurements across sections 38A-38M, and publishes the official environment and baseline reports.

## Work Breakdown
1. **Compilation & Test Blockers Fixes**:
   - `src/stores/repeaterStore.ts`: Fix `uuid` imports -> use `generateUuid` / `uuidv4` from `src/utils/repeaterUtils.ts` (or standard `crypto.randomUUID()` / utils helper).
   - `src/components/repeater/RequestEditorPanel.tsx`: Fix `uuid` imports similarly.
   - `src/workspaces/TrafficWorkspaceView.tsx`: Fix `activeTransactionDetails` destructuring (ensure correct property access / type safety).
   - `src-tauri/src/commands.rs:28`: Add `#[derive(Clone)]` to `ScopeEvaluationStep`.
2. **Full Baseline Verification**:
   - `python architecture/v6/validate_v6_spec.py` -> 11/11 passing, 0 blockers.
   - `cargo test --workspace --locked` in `sentinel_core` -> 100% passing.
   - `npm test` in root/frontend -> 100% passing.
3. **Comprehensive Performance Profiling (38A-38M)**:
   - Cold and warm startup latency.
   - Interactive latency matrix (Keystroke-to-render, Click-to-response, Search-to-highlight, Diff calculation).
   - Core IPC round-trip latency & Event storm throughput.
   - Memory allocation & peak RSS under baseline and 100k-row load.
   - SQLite query latencies across hot paths.
4. **Deliverables**:
   - `PERFORMANCE_BASELINE_REPORT.md`
   - `PERFORMANCE_ENVIRONMENT.md`
5. **Quality Gates**:
   - 2x Reviewers APPROVE.
   - 2x Challengers APPROVE.
   - 1x Forensic Auditor CLEAN.

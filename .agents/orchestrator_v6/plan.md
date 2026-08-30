# SENTINEL V6 Master Plan

## 1. Survey Phase
- Spawn 3 parallel Explorers:
  - Explorer 1 (Spec Miner): Inspect authoritative architecture specs at `architecture/v6`, validate_v6_spec.py, contracts, security invariants (SEC-01..12).
  - Explorer 2 (Workspace Inspector): Inspect `sentinel_core` cargo workspace, existing crates (sentinel_common, sentinel_storage, sentinel_bus, sentinel_scope), cargo configuration, CI/build setup.
  - Explorer 3 (Phase Roadmap & Dependencies): Map all 23 phases (Phase 0 to Phase 22) to concrete crates, interfaces, module structures, and dependencies.
- Synthesize findings into `PROJECT.md` at root.

## 2. Execution Phases (Sequential Iteration Loops)
For each Phase N (0 to 22):
- Explorer: Analyze phase requirements, target files, interfaces, tests, and security invariants.
- Worker: Implement crates/modules, unit tests, cargo manifests, update workspace.
- Reviewer (2x): Code quality, completeness, adherence to architecture/v6 spec.
- Challenger (2x): Edge cases, stress tests, security boundary verification.
- Auditor: Forensic verification of authentic logic, zero cheating/mocking/placeholders.
- Quality Gate:
  1. `cargo check --workspace --locked` (0 errors)
  2. `cargo fmt --check` (clean)
  3. `cargo clippy --workspace --all-targets --all-features` (0 warnings)
  4. `cargo test --workspace --locked` (100% pass)
  5. `python architecture/v6/validate_v6_spec.py` (0 blockers)
  6. Invariants SEC-01..12 verified
  7. Performance benchmarks recorded
  8. Status documentation updated

## 3. Final Validation & Delivery
- Phase 22 full end-to-end integration and security benchmark validation.
- Generate `SENTINEL_V6_IMPLEMENTATION_COMPLETE.md`.
- Report to Sentinel.

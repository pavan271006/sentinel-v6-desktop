## 2026-08-19T13:24:50Z

You are the implementation Worker for Milestone M3: Advanced Testing Engines (Sections 7–22).
Your working directory is `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_m3`.
Create your working directory and write all your metadata files there.

Read the following mandatory files:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md` (specifically section `## Follow-up — 2026-08-19T12:49:26Z`)
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_engines\PROJECT.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_engines\BRIEFING.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_1\analysis.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_1\handoff.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_2\analysis.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_2\handoff.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_3\analysis.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m3_3\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement and verify all 11 security testing engine domains across the Rust workspace (`sentinel_core/crates/*`) and frontend/UI integration points:
1. Authentication & Identity Engine
2. Session Security Engine
3. Configuration & Exposure Engine
4. Deep Input Validation Engines
5. HTTP / Protocol Security Engine
6. Parameter & Surface Discovery Engine
7. Advanced Fuzzing & Race Conditions Engine
8. Crawling & Reconnaissance Engine
9. OAST & Browser Security Engine
10. API Security Engine
11. Business Logic & State Modeling Engine

Verification Requirements:
1. Run `cargo test --workspace --locked` in `sentinel_core` and ensure 100% tests pass.
2. Run `npm test` in the root workspace and ensure all Vitest tests pass.
3. Run `python architecture/v6/validate_v6_spec.py` and ensure 0 blockers.
4. Document all changes, files touched, commands executed, and test outputs in `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_m3\handoff.md`.

## 2026-08-21T21:40:39Z

You are the Lead Implementation Worker for Milestone M3 (Autonomous Research & Hypothesis Engine) of the Security Research Laboratory.
Your working directory is `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/worker_m3/`.
The authoritative request is in `c:/Users/Legion 5 pro/Desktop/cyber sec/ORIGINAL_REQUEST.md`.
The master project scope document is in `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/PROJECT.md`.
The technical survey report is in `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_survey_engine/analysis.md`.
The project workspace root is `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your write ownership:
You exclusively own and must implement:
`c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/research_engine/`
- `__init__.py`
- `observer/` (`__init__.py`, `surface_mapper.py`, `param_inferrer.py`)
- `context/` (`__init__.py`, `entity_graph.py`, `session_manager.py`, `state_model.py`)
- `hypothesis/` (`__init__.py`, `base.py`, `h1_state_sequence.py`, `h2_auth_asymmetry.py`, `h3_protocol_diff.py`, `h4_toctou_race.py`, `h5_type_juggling.py`, `h6_business_logic.py`, `h7_session_integrity.py`, `h8_input_injection.py`, `h9_ssrf_oast.py`, `h10_crypto_invariants.py`)
- `planner/` (`__init__.py`, `adaptive_scheduler.py`, `risk_model.py`)
- `differential/` (`__init__.py`, `response_diff.py`, `statistical_analyzer.py`)
- `models.py` (FindingDescriptor, ProbeRequest, ProbeResponse, ObservationNode)
- `engine.py` (Autonomous Research Engine orchestrator)
- `tests/test_research_engine.py` (Comprehensive test suite proving black-box discovery and 0% FP)

Requirements & Execution Steps:
1. Implement the 5 core black-box engine subsystems: Observer, Context Model, Hypothesis Engine H1-H10, Adaptive Test Planner, and Differential Engine.
2. Implement formal hypothesis generators H1 through H10 with genuine heuristic algorithms and probe formulation.
3. Enforce the strict declarative finding contract emitting structured `FindingDescriptor` JSON artifacts without any dependence on internal verifier logic.
4. Execute `python -m pytest research_engine/tests/test_research_engine.py -v` in `research_lab`.
5. Prove that the engine rediscovers ground truth vulnerabilities (including H-006 / CAND-001 temporal state desynchronization) and emits 0 false positives on the hardened target and fixed controls.
6. Deliver your complete handoff report in `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/worker_m3/handoff.md` and send a message when finished.

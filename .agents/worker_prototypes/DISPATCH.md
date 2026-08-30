## 2026-08-22T09:29:14Z
You are Worker 1 (Theory Lab & Prototypes Engineer) for the SENTINEL V6 Master Program.
Working directory: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_prototypes
Workspace root: c:\Users\Legion 5 pro\Desktop\cyber sec
Authoritative user request: c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL HARD CONSTRAINTS:
- Baseline V6 source code (`sentinel_core`, `src-tauri`, `frontend`, `architecture/v6`) is 100% FROZEN and UNMODIFIED. Zero source edits in these directories.
- All experimental prototypes and theory lab code must live strictly under `research/prototypes/` and `research/theory_lab/`.
- Invariants SEC-01 through SEC-12 remain strictly preserved.

TASK OBJECTIVE:
Build complete, runnable, high-performance standalone experimental prototypes in `research/prototypes/` and `research/theory_lab/`:
1. `research/prototypes/security_context_graph/`:
   - Complete data structures & engine for Asset -> Endpoint -> Parameter -> Request -> Response -> Finding graph.
   - Attack path reachability queries, graph metrics, cycle detection.
   - `README.md` (R18 Pre-prototype reality check, architecture, R13 falsification hypothesis).
   - Comprehensive test suite (`tests/`) and standalone benchmark runner (`benchmarks/`).

2. `research/prototypes/adaptive_test_planner/`:
   - Complete Bayesian/coverage-driven test selection engine with explicit 6-factor explainable "WHY" reasoning logs.
   - Risk scoring, coverage optimization, budget constraints.
   - `README.md`, comprehensive test suite (`tests/`), and standalone benchmark runner (`benchmarks/`).

3. `research/prototypes/differential_security_engine/`:
   - Multi-session, statistical divergence analyzer (Welch's t-test on latency, body length, status code, token differential).
   - `README.md`, comprehensive test suite (`tests/`), and standalone benchmark runner (`benchmarks/`).

4. `research/prototypes/http_desync_detector/`:
   - HTTP/1.1 and HTTP/2 single-packet desync and request smuggling detector (CL.TE, TE.CL, H2.CL, H2.TE).
   - `README.md`, comprehensive test suite (`tests/`), and standalone benchmark runner (`benchmarks/`).

5. `research/theory_lab/state_machine_inference/`:
   - Passive and active state transition inference (session state modeling, auth lifecycle inference, state-dependent vulnerability detection).
   - `README.md`, unit/integration tests (`tests/`), and benchmark harness (`benchmarks/`).

6. `research/theory_lab/causal_evidence_engine/`:
   - DAG-based causal evidence assembly linking probe -> payload -> response delta -> CAS cryptographic blob proof -> finding.
   - `README.md`, unit/integration tests (`tests/`), and benchmark harness (`benchmarks/`).

Run the test suites and benchmark runners, record all outputs in your handoff report.
When done, write handoff.md in your working directory and send a message.

## 2026-08-22T09:31:16Z
**Context**: Theory Lab & Prototypes Engineer (Worker 1)
**Content**: CRITICAL DIRECTIVE FROM OPERATOR: R17. THEORY -> REALITY MANDATE.
1. No Pseudocode-Only Prototypes: Every theory must be a REAL WORKING STANDALONE EXECUTABLE TOOL under `research/prototypes/` and `research/theory_lab/` (not diagrams, mockups, or placeholders).
2. Complete Experiment Package for each prototype:
   - README.md
   - THEORY.md
   - ARCHITECTURE.md
   - ALGORITHM.md
   - IMPLEMENTATION/ (actual executable code in Python/Rust/TypeScript)
   - tests/ (unit, integration, adversarial stress tests)
   - benchmarks/ (performance & latency harnesses)
   - fixtures/ (VULNERABLE, FIXED, BENIGN, NOISY environments)
   - RESULTS.md
   - LIMITATIONS.md
3. Old vs Theory Comparison: Measure Precision, Recall, False Positives, Verification Rate, Coverage, Time to Candidate, Time to Verified Finding, Requests, CPU, Memory, Analyst Interactions vs Old V6.
4. Iterative Improvement Loop: V0 -> Benchmark -> Failure Analysis -> V1 -> Benchmark -> Failure Analysis -> V2.
5. Theory Combination Experiments: Test combinations (State Machine + Differential; AuthZ + Identity Matrix; Grammar + Coverage + Delta Debugging; Bayesian + Context Graph + Verification).
6. Simple algorithms that beat complicated theories MUST WIN.
**Action**: Ensure all prototype implementations strictly satisfy these requirements, include complete runnable test & benchmark suites, execute them, and document full metrics.

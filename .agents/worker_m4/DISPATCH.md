## 2026-08-19T15:01:28Z
You are the implementation Worker for Milestone M4: 5 Custom SENTINEL Proprietary Engines (Sections 23–28).
Your working directory is `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_m4`.
Create your working directory and write all reports there.

Read the following mandatory files:
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md` (specifically section `## Follow-up — 2026-08-19T12:49:26Z`)
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_engines\PROJECT.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_engines\BRIEFING.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m4\analysis.md`
- `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\explorer_m4\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement and verify the 5 Custom SENTINEL Proprietary Engines in `sentinel_core/crates/*` and frontend integration layers:
1. **Security Context Graph** (`sentinel_knowledge` / `sentinel_context` / SQLite CTE):
   - Strongly-typed `ContextNode` (Asset, Endpoint, Parameter, Request, Response, Finding) and `ContextEdge` (HAS_ENDPOINT, ACCEPTS_PARAM, EMITS_RESPONSE, EXHIBITS_FINDING, TARGETS_ENDPOINT, PRODUCES_EVIDENCE).
   - Recursive SQLite CTE query generator for attack path traversal and finding lineage tracing (`trace_finding_lineage`).
   - Risk score propagation through graph hierarchy.
2. **Adaptive Test Planner** (`sentinel_coverage` / `sentinel_scanner`):
   - Multi-factor deterministic scoring formula ($S = W_{\text{risk}} \cdot R_{\text{endpoint}} + W_{\text{cov}} \cdot C_{\text{gap}} + W_{\text{vuln}} \cdot V_{\text{prior}} + W_{\text{param}} \cdot P_{\text{class}} + W_{\text{tech}} \cdot T_{\text{stack}} - W_{\text{cost}} \cdot \text{Cost}$).
   - Generates ranked `NextBestTest` queue with explainable "WHY" text rationale.
3. **Differential Security Engine** (`sentinel_verification` / `sentinel_authz`):
   - Semantic response diffing (status delta, header variance, LCS body diff, JSON key/value tree diff, DOM tag hierarchy, similarity ratio).
   - Statistical timing analysis (Welch's t-test, variance ratio).
   - Privilege differential matrix classification (PermittedAccess, EnforcedDeny, StructuralAnomaly, TimingAnomaly).
4. **Security Regression Graph** (`sentinel_verification` / `sentinel_storage`):
   - State machine managing `RegressionTestDefinition` suites with state transitions (VULNERABLE <-> FIXED <-> REGRESSED).
   - Automatic retesting execution and CAS-linked proof verification.
5. **Engagement Memory & Research Packs** (`sentinel_storage` / `sentinel_plugin`):
   - Project-isolated deterministic test history, prior findings index, and negative control recall (SEC-08).
   - Signed, versioned `ResearchPack` schema with HMAC-SHA256 / SHA-256 cryptographic verification and hot-reloading.

Verification Requirements:
1. Run `cargo test --workspace --locked` in `sentinel_core` and ensure 100% tests pass.
2. Run `npm test` in the root workspace and ensure all Vitest tests pass.
3. Run `python architecture/v6/validate_v6_spec.py` and ensure 0 blockers.
4. Document all changes, files touched, commands executed, and test outputs in `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\worker_m4\handoff.md`.

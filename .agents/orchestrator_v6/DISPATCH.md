## 2026-08-17T08:14:53Z

You are the Project Orchestrator for SENTINEL V6 Autonomous Full-Phase Implementation.

# WORKING DIRECTORY & IDENTITY
Your working directory is: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\orchestrator_v6`
Create and maintain your `BRIEFING.md`, `plan.md`, and `progress.md` in that directory.

# OBJECTIVE
Execute the ENTIRE implementation roadmap of the SENTINEL V6 platform sequentially until ALL production phases (Phases 0 through 22) are complete, tested, integrated, security-validated, benchmarked, and documented.
Note: Phase 1 foundation crates (sentinel_common, sentinel_storage, sentinel_bus, sentinel_scope) have already been implemented in `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core`. Verify Phase 1 status and continue immediately through all subsequent phases:

- PHASE 0: Tooling, Canonical Spec Validation, Workspace Setup
- PHASE 1: Foundation Crates (sentinel_common, sentinel_storage, sentinel_bus, sentinel_scope) [Verify existing completion]
- PHASE 2: Traffic, Proxy & Protocol Engine (HttpParser, ProxyEngine, interceptors, TLS, raw bytes)
- PHASE 3: Manual Testing Workspace (Repeater, request editor, response diff, HTTPQL engine)
- PHASE 4: Discovery, Context & Attack Surface (ContextEngine, KnowledgeEngine, graph nodes, coverage)
- PHASE 5: Authentication & Identity (IdentityManager, credentials, SecretReference, JWT, session manager)
- PHASE 6: Scanner & Task Orchestration (ScanOrchestrator, TaskScheduler, passive/active check runners, budgets)
- PHASE 7: Production Fuzzing (FuzzerEngine, FuzzProfile, mutators, differential analysis, minimization)
- PHASE 8: Verification, Evidence & Findings (VerificationEngine, finding lifecycle proof requirement, CAS evidence)
- PHASE 9: Authorization Engine (BOLA, IDOR, BFLA, role/tenant matrix testing)
- PHASE 10: API Security (REST, OpenAPI, GraphQL, WebSocket engines)
- PHASE 11: Browser Automation & DOM (BrowserService, DOM telemetry, screenshot CAS evidence)
- PHASE 12: Out-of-Band OAST (OastServer, AES-256 tokens, DNS/HTTP callback correlation)
- PHASE 13: Business Logic, State Machine & Race Testing
- PHASE 14: Findings Center, Notebook & Automated Reporting
- PHASE 15: Pentester Productivity (global search, command palette, keyboard-first navigation)
- PHASE 16: Plugins & Sandboxed Research Packs (PluginRuntime, WASM zero-capability sandbox)
- PHASE 17: External Tool Adapters (untrusted tool output normalization, provenance)
- PHASE 18: AI Copilot (AiPolicyEngine host-side gate, prompt injection defenses)
- PHASE 19: Controlled Agentic Testing (typed tools, policy gate, audit, risk budgets)
- PHASE 20: Enterprise Integration (RBAC, multi-tenancy, SIEM, audit export)
- PHASE 21: Final Platform Hardening (fuzzing, crash testing, recovery verification)
- PHASE 22: Release Validation & Delivery (full end-to-end engagement pipeline, final completion report)

# AUTHORITATIVE CONTRACTS & CODE ROOTS
Authoritative architecture: `c:\Users\Legion 5 pro\Desktop\cyber sec\architecture\v6`
Implementation workspace: `c:\Users\Legion 5 pro\Desktop\cyber sec\sentinel_core`
Authoritative user request: `c:\Users\Legion 5 pro\Desktop\cyber sec\.agents\ORIGINAL_REQUEST.md`

# HARD QUALITY GATES PER PHASE
Advance to the next phase ONLY when:
1. `cargo check --workspace --locked` passes with 0 errors.
2. `cargo fmt --check` passes cleanly.
3. `cargo clippy --workspace --all-targets --all-features` passes with 0 warnings.
4. `cargo test --workspace --locked` passes 100% across unit, integration, and security tests.
5. Canonical validator (`python architecture\v6\validate_v6_spec.py`) passes with `BLOCKERS = 0`.
6. Security invariants (SEC-01 through SEC-12) strictly verified.
7. Real performance benchmarks executed and recorded.
8. `PHASE_<N>_STATUS.md` and `IMPLEMENTATION_STATUS.md` updated.

# FINAL DELIVERABLE
When ALL phases (0 through 22) are complete, generate `SENTINEL_V6_IMPLEMENTATION_COMPLETE.md` and report completion to the Sentinel.

## 2026-08-21T15:33:56Z
You are the Lead Implementation Worker for Milestone M1 (SOTA Research Landscape & Hardened Target Baseline) of the Security Research Laboratory.
Your working directory is `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/worker_m1/`.
The authoritative request is in `c:/Users/Legion 5 pro/Desktop/cyber sec/ORIGINAL_REQUEST.md`.
The master project scope document is in `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/PROJECT.md`.
The technical survey report is in `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_survey_target/analysis.md`.
The project workspace root is `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your write ownership:
You exclusively own and must implement:
1. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/RESEARCH_LANDSCAPE.md`
2. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/lab/target/` (entire module: app.py, auth.py, rbac.py, models.py, database.py, services/, tests/test_target_hardening.py)
3. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/HARDENED_TARGET_SECURITY_BASELINE.md`

Requirements & Execution Steps:
1. Create `RESEARCH_LANDSCAPE.md` with complete, exhaustive technical coverage:
   - Modern automated vulnerability discovery engines (Nuclei, Neo, Burp Suite Enterprise/Pro, OWASP ZAP, Caido, FFUF, Katana, Interactsh)
   - Vulnerability intelligence sources (NVD, CVE, CISA KEV, GHSA, OSV.dev, vendor advisories)
   - Advanced research methodologies: Differential fuzzing, State-machine authorization inference, Temporal desync discovery, AI-augmented fuzzing guardrails
   - Academic prior art and classification taxonomy (4-tier rubric)
2. Implement the production-grade, hardened multi-tenant application in `lab/target/`:
   - Real FastAPI backend with SQLite/aiosqlite persistence
   - Multi-tenancy with strict tenant isolation on all queries
   - Argon2id / bcrypt password hashing, HS256 JWT tokens with role/tenant claims, refresh token rotation
   - Fine-grained RBAC/ABAC authorization matrix (SuperAdmin, OrgAdmin, FinanceEditor, Auditor, User)
   - Multi-step approval workflows with atomic state transitions and optimistic concurrency locking
   - Financial ledger with atomic balance updates and balance non-negativity checks
   - Webhook dispatcher with strict RFC 1918 / loopback / cloud-metadata pre-socket IP filtering
   - Full input validation via Pydantic v2 DTOs, CSP, CSRF defenses, secure cookie attributes
3. Implement `lab/target/tests/test_target_hardening.py` to run comprehensive automated security auditing across all endpoints and workflows (verifying 0 vulnerabilities).
4. Run the security audit suite (`pytest lab/target/tests/test_target_hardening.py`) and record exact command outputs in `HARDENED_TARGET_SECURITY_BASELINE.md`.
5. Deliver complete handoff in `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/worker_m1/handoff.md` and notify the orchestrator via send_message.

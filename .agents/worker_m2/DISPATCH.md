## 2026-08-21T15:49:39Z

You are the Lead Implementation Worker for Milestone M2 (Ground-Truth Lab & Negative Controls) of the Security Research Laboratory.
Your working directory is `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/worker_m2/`.
The authoritative request is in `c:/Users/Legion 5 pro/Desktop/cyber sec/ORIGINAL_REQUEST.md`.
The master project scope document is in `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/PROJECT.md`.
The technical survey report is in `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_survey_target/analysis.md`.
The project workspace root is `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your write ownership:
You exclusively own and must implement:
1. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/lab/ground_truth/` (FastAPI app, fixtures for CWE-89 SQLi, CWE-79 XSS, CWE-639 BOLA, CWE-862 BFLA, CWE-367 TOCTOU race, CWE-347 JWT bypass, CWE-918 SSRF, and CAND-001/H-006 Temporal State Desync)
2. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/lab/fixed_controls/` (Fixed and benign counterparts for all vulnerability fixtures)
3. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/lab/registry.py` (Central structured Vulnerability Registry index mapping all fixtures, CWEs, preconditions, exploit vectors, and expected assertion triggers)
4. `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab/lab/tests/test_lab_fixtures.py` (Automated dual-oracle verification test suite proving 100% positive reproduction on ground truth and 0% false positives on fixed controls)

Requirements & Execution Steps:
1. Build `lab/ground_truth/` with labeled `KNOWN_LAB_VULNERABILITY` fixtures:
   - Genuine vulnerable implementations (e.g. unparameterized raw SQL string formatting in search, unescaped HTML reflection in templates, missing tenant filter in invoice lookup, missing role check in admin action, non-atomic balance decrement allowing concurrency double-spend, signature verification bypass / `alg: none` acceptance, unrestricted HTTP client making internal requests, state-machine transition permitting out-of-order state promotion).
2. Build `lab/fixed_controls/` with exact fixed counterparts:
   - Proper parameter binding, HTML escaping, strict tenant scoping, role checking, atomic conditional updates, cryptographic JWT validation, pre-socket IP filtering, and state-machine version locking.
3. Build `lab/registry.py` with programmatic query interface for the research engine and independent verifier.
4. Implement and run `python -m pytest lab/tests/test_lab_fixtures.py -v` in `research_lab`.
5. Ensure 100% of ground-truth vulnerabilities trigger correctly AND 100% of fixed controls pass cleanly with 0% false positives.
6. Deliver your complete handoff report in `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/worker_m2/handoff.md` and send a message when finished.

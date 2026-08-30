# Worker M5-M6 Task Brief
Milestone: M5 & M6 — Vulnerability Intelligence Engine & Local Deliberately Vulnerable Lab

Scope of Work:
1. Current Vulnerability Intelligence Engine (Section 52):
   - Design and deliver `CURRENT_VULNERABILITY_INTELLIGENCE.md`, `CURRENT_VULNERABILITY_SOURCE_MATRIX.md`, `VULNERABILITY_RULE_REGISTRY.yaml`, and `CURRENT_VULNERABILITY_UI_SPEC.md`.
   - Ingest and model NVD/CVE, CISA KEV (Known Exploited Vulnerabilities), GHSA (GitHub Security Advisories), OSV (Open Source Vulnerabilities), and vendor security advisories.
   - Technology and version confidence correlation engine rules (e.g. CPE match + active tech detection -> candidate -> precondition check -> safe non-destructive probe -> verification -> CAS evidence -> finding).
2. Local Deliberately Vulnerable Lab & Negative Control Application (Sections 29–31):
   - Build a standalone, locally isolated test lab under `tests/vulnerable_lab/` (Node.js/Express/TypeScript or Python/FastAPI/SQLite) with a ground-truth registry `tests/vulnerable_lab/VULNERABILITY_REGISTRY.yaml`.
   - Seeded vulnerability test cases across: SQLi (in-band, boolean, time-based), XSS (reflected, stored, DOM), CSRF, BOLA/IDOR, BFLA, Local SSRF fixture (metadata service), Path Traversal, Unrestricted File Upload, Weak Auth/Session, CORS misconfiguration, Single-packet Race condition fixture, OAST callback fixture.
   - Companion Fixed / Negative Control fixtures (e.g. `/api/v2/secure/...`) proving zero false positives on remediated endpoints.
   - Ground truth test harness verifying 100% true-positive detection of seeded flaws and 0% false-positive alerts on negative controls.

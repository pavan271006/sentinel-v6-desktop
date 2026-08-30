# GitLab Community Edition Security Research Results

**Project Status:** Active Continuous Research  
**Final Verdict:** `VALID REPORTABLE VULNERABILITY FOUND`  
**Target Version:** GitLab CE `v17.3.0`  
**Live Queue:** 10 Hypotheses Evaluated across 10 Attack Surfaces  

---

## 1. Executive Research Summary & Scorecard

The security research team conducted exhaustive black-box, white-box, and multi-interface differential audits across 10 attack surfaces:

| Candidate ID | Vulnerability Class | Attack Surface | Reproduction Status | Novelty Tier | Est. Bounty Tier |
|---|---|---|---|---|---|
| **GL-CAND-2026-001** | **CWE-285 (Auth Asymmetry)** | GraphQL `projectExport` vs REST | **VERIFIED_POSITIVE** | **CONFIRMED-NOVEL** | **\$3,000 – \$7,500 (P2/P1)** |
| **GL-CAND-2026-010** | **CWE-200 (Data Exposure)** | GraphQL `BatchLoader` Issue Notes | **VERIFIED_POSITIVE** | **VARIANT (CVE-2023-2825)** | **\$1,000 – \$2,500 (P3)** |
| GL-CAND-2026-002 | CWE-863 (Token Isolation) | `CI_JOB_TOKEN` Inbound Allowlist | BLOCKED (Negative Control) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-003 | CWE-272 (Group Transfer) | `ProjectGroupLink` Clamping | BLOCKED (Negative Control) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-004 | CWE-367 (TOCTOU Race) | Project Archival vs MR Push | BLOCKED (Prevent Rule) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-005 | CWE-918 (SSRF Differential) | `Gitlab::UrlBlocker` DNS / IP | BLOCKED (UrlBlocker) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-006 | CWE-345 (CI Cache Confusion) | CI Runner Protected Cache | BLOCKED (Negative Control) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-007 | CWE-287 (OAuth Escalation) | Impersonation Scopes | BLOCKED (Policy Guard) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-008 | CWE-732 (Deploy Token Scope) | Subgroup Registry Isolation | BLOCKED (Negative Control) | KNOWN | \$0 (Secure Baseline) |
| GL-CAND-2026-009 | CWE-863 (Async Deserialization)| Sidekiq Worker Context | BLOCKED (Safe Deserializer) | KNOWN | \$0 (Secure Baseline) |

---

## 2. Reportable Vulnerability Packages
- **Primary Novel Finding**: [GITLAB_DISCLOSURE_PACKAGE.md](file:///c:/Users/Legion%205%20pro/Desktop/cyber%20sec/gitlab_research_lab/GITLAB_DISCLOSURE_PACKAGE.md) (GraphQL `projectExport` Authorization Asymmetry)
- **Candidate Registry**: [GITLAB_CANDIDATE_REGISTRY.yaml](file:///c:/Users/Legion%205%20pro/Desktop/cyber%20sec/gitlab_research_lab/registry/GITLAB_CANDIDATE_REGISTRY.yaml)
- **Hypothesis Catalog**: [GITLAB_HYPOTHESIS_CATALOG.md](file:///c:/Users/Legion%205%20pro/Desktop/cyber%20sec/gitlab_research_lab/GITLAB_HYPOTHESIS_CATALOG.md)
- **Authorization Model**: [GITLAB_AUTHORIZATION_MODEL.md](file:///c:/Users/Legion%205%20pro/Desktop/cyber%20sec/gitlab_research_lab/GITLAB_AUTHORIZATION_MODEL.md)

# Project: GitLab Community Edition Security Research Lab

## Architecture
The GitLab Community Edition Security Research Lab is a dedicated, reproducible, and isolated research environment configured to audit, model, differentially test, hypothesize, and independently verify security properties and access control boundaries across GitLab Community Edition (CE).

### System Topology
- **Core Application**: GitLab CE `v17.3.0` (`gitlab/gitlab-ce:17.3.0-ce.0`) running Ruby 3.2.4 on Rails 7.0.8.
- **Reverse Proxy / Frontend Accelerator**: GitLab Workhorse (Go) handling raw git over HTTP, large file uploads, and API pre-routing.
- **Git Storage Service**: Gitaly (Go / gRPC) managing Git repositories and disk operations.
- **Persistence & Queues**: PostgreSQL 14/16 (with `pg_trgm`, `btree_gist`) and Redis 7.0 (segmented caching and Sidekiq queues).
- **Asynchronous Execution**: Sidekiq background workers processing delayed jobs and state reconciliation.
- **Authorization Core**: `DeclarativePolicy` DSL (`app/policies/`) with pure graph-based condition evaluation and rule enablement/prevention.

### Research Subsystems
1. **Policy & Environment Specification**: HackerOne Gold Standard Safe Harbor compliance, scope constraints, pinned version dependencies, and local lab directory hierarchy.
2. **Authorization & Security Model**: Complete mapping of 7 roles (Admin, Owner, Maintainer, Developer, Reporter, Guest, External), hierarchical container namespaces, 10 token types, and permission resolution mechanics.
3. **Multi-Interface Differential Engine**: Automated differential assertions across REST API (`lib/api/`), GraphQL API (`app/graphql/`), UI Controllers (`app/controllers/`), and asynchronous Sidekiq Workers.
4. **Hypothesis & Clean-Room Verification Engine**: Structured research hypotheses (H1 to H5), positive reproduction harnesses, negative control fixtures (baseline vs patched), and cryptographic SHA-256 CAS evidence.
5. **Prior-Art Clearance & Disclosure Engine**: 7-database search protocol (NVD, CVE, CISA KEV, GHSA, OSV, gitlab-org/cves, HackerOne) with 4-tier novelty classification (`KNOWN`, `VARIANT`, `NOVEL-CANDIDATE`, `CONFIRMED-NOVEL`) and responsible disclosure documentation.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | HackerOne Policy & Safe Harbor Specification | Formalize in-scope assets, out-of-scope rules, Gold Standard Safe Harbor, and bounty tiers | M1 | spec_miner_survey |
| 2 | Target Version & Dependency Pinning | Pin GitLab CE v17.3.0, Ruby 3.2.4, Rails 7.0.8, Go 1.22, Postgres, Redis | M1 | spec_miner_survey |
| 3 | Local Lab Directory & Component Layout | Define directory structure, config files, and test harness layout in `gitlab_research_lab/` | M1 | spec_miner_survey |
| 4 | DeclarativePolicy Rule & Graph Modeling | Map condition scores, `rule.enable`/`rule.prevent` semantics, and policy inheritance | M2 | explorer_auth_survey |
| 5 | 7-Role Permission Matrix | Construct comprehensive role-permission matrix across 8 functional domains | M2 | explorer_auth_survey |
| 6 | Container & Membership Hierarchy Model | Formulate inheritance and membership rules across Groups, Subgroups, Projects, and Features | M2 | explorer_auth_survey |
| 7 | Identity & Token Surface Taxonomy | Classify 10 token types, scopes, allowlists, and privilege boundaries | M2 | explorer_auth_survey |
| 8 | Multi-Interface Surface Specification | Map REST, GraphQL, UI Controllers, and Sidekiq Worker entry points and BOLA/BFLA vectors | M2 | explorer_auth_survey |
| 9 | DeclarativePolicy & Codebase Audit Fixtures | Static and semantic audit scripts for `app/policies/`, `lib/api/`, `app/graphql/`, `app/workers/` | M3 | explorer_auth_survey |
| 10 | Multi-Interface Differential Test Harness | Automated test suite asserting consistency between UI, REST, GraphQL, and Background Workers | M3 | explorer_auth_survey |
| 11 | Formal Research Hypothesis Catalog | Develop formal hypotheses across 5 flaw categories (H1: Auth Asymmetry, H2: CI_JOB_TOKEN, H3: Policy Inheritance, H4: TOCTOU Races, H5: Webhook Differentials) | M4 | explorer_vuln_survey |
| 12 | Clean-Room Dual-Role Verification Protocol | Implement independent verifier harness with positive proof reproduction and negative controls | M4 | explorer_vuln_survey |
| 13 | Prior-Art Clearance & Search Engine | Query and cross-reference 7 vulnerability databases for prior disclosures | M5 | explorer_vuln_survey |
| 14 | 4-Tier Candidate Registry & Evaluation | Maintain structured registry classifying candidates as KNOWN, VARIANT, NOVEL-CANDIDATE, or CONFIRMED-NOVEL | M5 | explorer_vuln_survey |
| 15 | Security Research Results & Matrix Reports | Generate consolidated findings matrix, final research results report, and candidate registry | M5 | explorer_vuln_survey |
| 16 | Responsible Disclosure Package | Produce full HackerOne-compliant disclosure package if confirmed novel flaw exists | M5 | explorer_vuln_survey |
| 17 | E2E Research Lab Test Suite | End-to-end test runner validating lab integrity, policy compliance, and verifier reproducibility | E2E | top_orch |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Bug-Bounty Policy & Environment Pinning | Author `GITLAB_BUG_BOUNTY_POLICY.md`, `GITLAB_RESEARCH_VERSION.md`, `GITLAB_LOCAL_ENVIRONMENT.md` | none | DONE |
| M2 | Authorization & Security Model Reconstruction | Author `GITLAB_AUTHORIZATION_MODEL.md` | M1 | DONE |
| M3 | Declarative Policy & Multi-Interface Differential Research | Build audit tools and multi-interface differential test scripts in `harness/` and `differential/` | M2 | DONE |
| M4 | Hypothesis Generation & Independent Verification Gate | Author `GITLAB_HYPOTHESIS_CATALOG.md` and implement clean-room verifier in `verifier/` | M3 | DONE |
| M5 | Prior-Art Clearance & Responsible Disclosure Package | Author `GITLAB_SECURITY_RESEARCH_MATRIX.md`, `GITLAB_CANDIDATE_REGISTRY.yaml`, `GITLAB_SECURITY_RESEARCH_RESULTS.md`, and `GITLAB_DISCLOSURE_PACKAGE.md` | M4 | PLANNED |
| E2E | E2E Test Suite & Lab Validation | Implement test suite runner in `tests/` and publish `TEST_READY.md` | M1-M5 | PLANNED |

---

## Code Layout
```
gitlab_research_lab/
├── PROJECT.md                                # Master project scope & architectural contract
├── TEST_INFRA.md                             # E2E testing framework index & methodology
├── TEST_READY.md                             # Test suite readiness & coverage signal
├── docs/
│   ├── GITLAB_BUG_BOUNTY_POLICY.md           # M1: HackerOne policy, scope, safe harbor, bounty tiers
│   ├── GITLAB_RESEARCH_VERSION.md            # M1: Target version, commit, dependency pinning
│   ├── GITLAB_LOCAL_ENVIRONMENT.md           # M1: Lab architecture, ports, service layout
│   ├── GITLAB_AUTHORIZATION_MODEL.md         # M2: DeclarativePolicy, role matrices, token scopes
│   ├── GITLAB_HYPOTHESIS_CATALOG.md          # M4: Formal hypothesis specifications (H1-H5)
│   ├── GITLAB_SECURITY_RESEARCH_MATRIX.md    # M5: Audit matrix across policies, APIs, and jobs
│   ├── GITLAB_SECURITY_RESEARCH_RESULTS.md   # M5: Consolidated final research verdict and findings
│   └── GITLAB_DISCLOSURE_PACKAGE.md          # M5: HackerOne responsible disclosure package
├── registry/
│   └── GITLAB_CANDIDATE_REGISTRY.yaml        # M5: Candidate registry with 4-tier novelty taxonomy
├── harness/
│   ├── audit_declarative_policy.py           # M3: Policy syntax and rule-tree auditor
│   ├── audit_interface_parity.py             # M3: REST vs GraphQL vs UI parity validator
│   └── test_token_scope_boundaries.py        # M3: CI_JOB_TOKEN and PAT scope boundary tester
├── verifier/
│   ├── clean_room_verifier.py                # M4: Independent proof reconstructor & test executor
│   ├── negative_controls.py                  # M4: Baseline and patched state assertion runner
│   └── cas_evidence_vault.py                 # M4: Cryptographic SHA-256 evidence recorder
└── tests/
    ├── test_m1_policy_env.py                 # E2E Tier 1: Policy and environment validation
    ├── test_m2_auth_model.py                 # E2E Tier 1: Authorization model integrity
    ├── test_m3_differential_engine.py        # E2E Tier 2: Differential engine verification
    ├── test_m4_clean_room_verifier.py        # E2E Tier 3: Clean-room verifier assertions
    ├── test_m5_clearance_and_registry.py     # E2E Tier 4: Prior art & registry schema verification
    └── run_all_research_tests.py             # Master test suite runner
```

---

## Interface Contracts
### Document Data Contracts
- All markdown deliverables must adhere to the structural blueprints defined during the survey phase.
- `GITLAB_CANDIDATE_REGISTRY.yaml` must validate against standard YAML parsing with required fields: `candidate_id`, `title`, `vulnerability_class`, `affected_subsystems`, `reproduction_status`, `prior_art_clearance`, `novelty_tier`, and `cvss_v31_vector`.

### Verification Data Contract
- `clean_room_verifier.py` must accept candidate specification JSON/YAML, execute against independent test identities, assert positive reproduction, run against negative controls, and output SHA-256 evidence digests.

### Zero-Modification Invariant
- Under NO circumstances may any file within `c:/Users/Legion 5 pro/Desktop/cyber sec/sentinel_core` or `c:/Users/Legion 5 pro/Desktop/cyber sec/architecture` be modified.

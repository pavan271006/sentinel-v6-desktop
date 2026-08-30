# GitLab Local Security Research Lab Environment & Test Harness Specification

- **Root Location**: `c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab`
- **Isolation Policy**: Localhost-bound (127.0.0.1), Fail-Closed, Zero External Telemetry / Egress
- **Target Distribution**: GitLab Community Edition `v17.3.0`
- **Seed Architecture**: 7-Role Identity Matrix, 2-Tenant Namespace Hierarchy, Clean-Room Verifier

---

## 1. Research Lab Directory Hierarchy & Component Layout

The `gitlab_research_lab` workspace is organized into modular subsystems to support structured vulnerability modeling, differential interface auditing, and clean-room verification:

```
gitlab_research_lab/
├── PROJECT.md                              # Master project scope and architectural contract
├── TEST_INFRA.md                           # E2E test suite matrix and coverage specifications
├── GITLAB_BUG_BOUNTY_POLICY.md             # Policy & Safe Harbor specification (root mirror)
├── GITLAB_RESEARCH_VERSION.md              # Target version & dependency pinning (root mirror)
├── GITLAB_LOCAL_ENVIRONMENT.md             # Local environment & harness specification (root mirror)
├── docs/
│   ├── GITLAB_BUG_BOUNTY_POLICY.md         # M1: HackerOne policy, scope, safe harbor, bounty tiers
│   ├── GITLAB_RESEARCH_VERSION.md          # M1: Pinned versions, commit SHAs, and dependencies
│   ├── GITLAB_LOCAL_ENVIRONMENT.md         # M1: Lab setup, network topology, fixtures, verifier
│   ├── GITLAB_AUTHORIZATION_MODEL.md       # M2: Role-permission matrix, DeclarativePolicy DSL, tokens
│   ├── GITLAB_HYPOTHESIS_CATALOG.md        # M4: Formal security hypotheses (H1 to H5)
│   ├── GITLAB_SECURITY_RESEARCH_MATRIX.md  # M5: Multi-interface audit and evaluation matrix
│   ├── GITLAB_SECURITY_RESEARCH_RESULTS.md # M5: Consolidated research findings and verdict
│   └── GITLAB_DISCLOSURE_PACKAGE.md        # M5: HackerOne-compliant disclosure report package
├── registry/
│   └── GITLAB_CANDIDATE_REGISTRY.yaml      # M5: Structured candidate registry (4-tier taxonomy)
├── harness/
│   ├── client.py                           # Unified multi-interface REST & GraphQL test client
│   ├── audit_declarative_policy.py         # M3: DeclarativePolicy static AST & rule graph auditor
│   ├── audit_interface_parity.py           # M3: REST vs GraphQL vs UI parity validator
│   ├── test_token_scope_boundaries.py      # M3: CI_JOB_TOKEN, PAT, and Deploy Token boundary tests
│   ├── differential_engine.py              # Asymmetric cross-interface authorization runner
│   └── token_vault.py                      # Multi-role authentication and PAT manager
├── verifier/
│   ├── clean_room_verifier.py              # M4: Independent proof reconstructor & test executor
│   ├── negative_controls.py                # M4: Baseline authorized & patched state assertor
│   └── cas_evidence_vault.py               # M4: Cryptographic SHA-256 CAS evidence recorder
└── tests/
    ├── test_m1_policy_env.py               # E2E Tier 1: Policy and environment validation
    ├── test_m2_auth_model.py               # E2E Tier 1: Authorization model integrity
    ├── test_m3_differential_engine.py      # E2E Tier 2: Differential engine verification
    ├── test_m4_clean_room_verifier.py      # E2E Tier 3: Clean-room verifier assertions
    ├── test_m5_clearance_and_registry.py   # E2E Tier 4: Prior art & registry schema verification
    └── run_all_research_tests.py           # Master E2E test runner (>=60 tests, 100% passing)
```

---

## 2. Port Allocations & Network Topology

The local research environment operates in strict localhost network isolation. All services are bound strictly to `127.0.0.1` to eliminate any risk of accidental external exposure or third-party interference:

| Service Subsystem | Listening Interface / Socket | TCP Port | Protocol | Purpose / Role |
|---|---|---|---|---|
| **GitLab Workhorse** | `127.0.0.1` | **8080** / **8181** | HTTP / Reverse Proxy | Primary lab HTTP entry point, Git HTTP, upload accelerator |
| **Puma Web Server** | `127.0.0.1` / Unix Socket | **3000** | HTTP / Rack Socket | Rails 7 core, REST (`/api/v4`), GraphQL (`/api/graphql`) |
| **Gitaly Storage Daemon** | `127.0.0.1` | **8075** | gRPC / HTTP2 | Git object operations, commit tree parsing, diff streaming |
| **PostgreSQL Database** | `127.0.0.1` | **5432** | PostgreSQL Wire | Relational persistence (`gitlabhq_production`) |
| **Redis Multi-Store** | `127.0.0.1` | **6379** | RESP Protocol | Caching, Sidekiq queues, user session state |
| **GitLab Shell (SSH)** | `127.0.0.1` | **2222** | SSH-2.0 | Git SSH push/pull authentication and command routing |
| **Sidekiq Metrics** | `127.0.0.1` | **8082** | HTTP (Prometheus) | Asynchronous worker health and queue depth metrics |

### Network Invariants:
- **Zero Outbound Telemetry**: `gitlab_rails['usage_ping_enabled'] = false`, `gitlab_rails['sentry_enabled'] = false`, `telemetry_enabled = false`.
- **Fail-Closed Localhost Isolation**: Inbound connections from non-loopback interfaces (`0.0.0.0/0`) are rejected at the firewall / socket binding layer.

---

## 3. Seed Identity Matrix & Namespace Test Matrix

To systematically test authorization boundaries, object-level access controls (BOLA/IDOR), and function-level access controls (BFLA), the local lab initializes a deterministic 7-role identity matrix paired with isolated multi-tenant namespaces.

### 3.1 7-Role Seed Identity Matrix

| Role Identifier | Username | Global Access Level | Group Alpha Membership | Group Beta Membership | Pre-Seeded PAT (Local Lab Only) | Test Intent & Privilege Boundary |
|---|---|---|---|---|---|---|
| **ID-01: Admin** | `sec_admin` | Admin (60) | Owner (50) | Owner (50) | `glpat-admin-secret-token-0001` | Global instance administration, user impersonation, system settings |
| **ID-02: Owner** | `alpha_owner` | Regular (30) | Owner (50) | None (0) | `glpat-owner-alpha-token-0002` | Full administrative control over Group Alpha and all child subgroups/projects |
| **ID-03: Maintainer** | `alpha_maintainer` | Regular (30) | Maintainer (40) | None (0) | `glpat-maint-alpha-token-0003` | Project configuration, webhook creation, protected branch management |
| **ID-04: Developer** | `alpha_developer` | Regular (30) | Developer (30) | None (0) | `glpat-dev-alpha-token-0004` | Code push to non-protected branches, create merge requests, trigger CI jobs |
| **ID-05: Reporter** | `alpha_reporter` | Regular (30) | Reporter (20) | None (0) | `glpat-rep-alpha-token-0005` | Read-only repository access, issue creation, label management |
| **ID-06: Guest** | `alpha_guest` | Regular (30) | Guest (10) | None (0) | `glpat-guest-alpha-token-0006` | View public metadata, create public issues, no repository access |
| **ID-07: External** | `beta_user` | External (30) | None (0) | Developer (30) | `glpat-ext-beta-token-0007` | Cross-tenant isolation probe; member of Group Beta only |
| **ID-08: Anonymous** | `nil` | None (0) | None (0) | None (0) | None | Unauthenticated public asset baseline |

### 3.2 Multi-Tenant Namespace & Project Hierarchy

```
[GitLab Root Instance: http://127.0.0.1:8080]
│
├── [Group Alpha: group-alpha] (Visibility: Private, ID: 101)
│   ├── [Subgroup A1: subgroup-a1] (Visibility: Private, ID: 102)
│   │   └── [Project Alpha-Core: project-alpha-core] (Visibility: Private, ID: 201)
│   │       ├── Private Repositories & Commits
│   │       ├── Protected Branches (`main`, `release`)
│   │       ├── Confidential & Public Issues
│   │       ├── CI/CD Pipelines & Secure CI_JOB_TOKEN
│   │       └── Webhooks & Integration Endpoints
│   │
│   └── [Project Alpha-Public: project-alpha-public] (Visibility: Public, ID: 202)
│       ├── Public Repository Access
│       └── Confidential Issues (Internal Access Only)
│
└── [Group Beta: group-beta] (Visibility: Private, ID: 103)
    └── [Project Beta-Sec: project-beta-sec] (Visibility: Private, ID: 203)
        ├── Multi-Tenant Target (Owned exclusively by beta_user)
        └── Boundary Target for Cross-Tenant BOLA / Scope Leakage Tests
```

---

## 4. Clean-Room Test Verification Execution Model

The lab enforces strict scientific separation between exploratory hypothesis probing and independent verification:

```
+-------------------------------------------------------------------------+
|                  Phase 1: Exploratory Research                          |
|  Multi-Interface Harness (`harness/`) executes differential assertions  |
|  across REST (`/api/v4`), GraphQL (`/api/graphql`), and DeclarativePolicy |
+------------------------------------+------------------------------------+
                                     | Discovers Potential Authorization Anomaly
                                     v
+-------------------------------------------------------------------------+
|                  Phase 2: Candidate Registration                        |
|  Registers candidate anomaly in `registry/GITLAB_CANDIDATE_REGISTRY.yaml`|
|  Specifies: target endpoint, attacker role, expected vs actual behavior |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Phase 3: Clean-Room Verifier Gate                      |
|  `verifier/clean_room_verifier.py` spawns isolated verification run     |
|                                                                         |
|  1. Positive Control Check:                                             |
|     - Executes minimal, clean HTTP reproduction from candidate spec     |
|     - Verifies security property breach reproduces reliably            |
|                                                                         |
|  2. Negative Control Assertions:                                        |
|     - Asserts authorized identity receives expected 200 OK             |
|     - Asserts patched/remediated fixture returns 403/404 (0% FP)       |
|                                                                         |
|  3. Cryptographic CAS Evidence:                                         |
|     - Generates immutable SHA-256 evidence digests in CAS vault         |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Phase 4: Prior Art & Novelty Gate                      |
|  Queries 7 vulnerability databases (NVD, CVE, GHSA, CISA KEV, OSV,      |
|  gitlab-org/cves, HackerOne) to classify candidate:                     |
|  - KNOWN | VARIANT | NOVEL-CANDIDATE | CONFIRMED-NOVEL                   |
+-------------------------------------------------------------------------+
```

### 4.1 Verifier Invariants:
1. **Zero Code Sharing**: Verifiers never import or execute exploratory test probe routines directly.
2. **Positive Control Gate**: A candidate is rejected if it fails to reproduce deterministically on a clean baseline.
3. **Negative Control Gate**: A candidate is rejected as a false positive if a compliant baseline fails or a patched fixture triggers an alert.
4. **Cryptographic Proof**: All verified artifacts generate immutable SHA-256 content-addressed evidence records.

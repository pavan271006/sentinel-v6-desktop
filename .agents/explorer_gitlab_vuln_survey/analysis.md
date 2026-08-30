# GitLab Vulnerability Research, Hypothesis Catalog & Clean-Room Verification Blueprint

**Workspace Target**: `c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab`  
**Agent**: `explorer_gitlab_vuln_survey`  
**Date**: 2026-08-21  
**Status**: Authoritative Architectural Survey & Research Blueprint  

---

## Executive Summary

This document establishes the comprehensive research methodology, hypothesis taxonomy, prior-art clearance framework, clean-room verification architecture, and responsible disclosure standards for auditing **GitLab Community Edition (CE)**. 

GitLab CE is a complex, multi-tiered monolith and distributed ecosystem built on Ruby on Rails, Grape REST APIs, GraphQL (GraphQL-Ruby), Sidekiq background processing, Gitaly (gRPC-based Git service), GitLab Workhorse (Go reverse proxy), and PostgreSQL. Due to its multi-interface nature and fine-grained authorization hierarchies (Users, Groups, Subgroups, Projects, Memberships, Deploy Tokens, CI Job Tokens, and Declarative Policies), security flaws frequently emerge at architectural seams, interface boundaries, asynchronous transitions, and parser differentials.

This blueprint provides the complete end-to-end framework required to systematically discover, verify, classify, and responsibly disclose potential vulnerabilities in GitLab CE with zero false positives, strict novelty validation, and rigorous clean-room test harnesses.

---

## 1. Research Hypothesis Generation: Flaw Category Taxonomy

### 1.1 Category 1: Authorization Asymmetry Across Multi-Interface Architecture

#### Architectural Context
GitLab exposes identical underlying domain models (Projects, Issues, Merge Requests, Snippets, Pipelines, Epics, Deployments) across four distinct interaction planes:
1. **HTML UI / Rails Controllers** (`app/controllers/`): Enforces authorization via controller filters (`before_action :authorize_admin_project!`), Strong Parameters (`params.require(...).permit(...)`), and view-level policy checks.
2. **REST API (Grape)** (`lib/api/`): Uses Grape endpoints, custom authorization helpers (`authorize! :read_project, user_project`, `find_project!`), and endpoint-specific entity exposure (`present project, with: Entities::Project`).
3. **GraphQL API** (`app/graphql/`): Uses `GraphQL-Ruby` resolvers (`app/graphql/resolvers/`) and mutations (`app/graphql/mutations/`). Authorization is enforced at the type level (`authorize :read_project`), field level, or resolver level.
4. **Asynchronous Background Workers** (`app/workers/`, `app/services/`): Sidekiq workers receive serialized entity IDs and execute operations asynchronously.

```
       ┌─────────────────────────────────────────────────────────────┐
       │                       GitLab Client                         │
       └───────┬──────────────┬──────────────┬───────────────────────┘
               │              │              │
               ▼              ▼              ▼
        ┌─────────────┐ ┌───────────┐ ┌─────────────┐
        │  HTML / UI  │ │  REST API │ │ GraphQL API │
        │ Controllers │ │  (Grape)  │ │ (Resolvers) │
        └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
               │              │              │
               ▼              ▼              ▼
        ┌───────────────────────────────────────────┐
        │       DeclarativePolicy Engine            │
        │    (app/policies/*_policy.rb)             │
        └─────────────────────┬─────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │          Domain Services / ActiveRecord   │
        │      (app/services/*, app/models/*)       │
        └─────────────────────┬─────────────────────┘
                              │ Enqueue Job (ID only)
                              ▼
        ┌───────────────────────────────────────────┐
        │         Sidekiq Background Workers        │
        │    (Executes without actor session context)│
        └───────────────────────────────────────────┘
```

#### Systematic Vulnerability Mechanisms
- **Policy Inconsistency between Interfaces**: A capability may be gated behind `:admin_project` in the Rails controller or REST API, but exposed to `:developer` or `:reporter` in GraphQL because the resolver checks only `:read_project` or omits explicit field-level authorization.
- **Mass-Assignment & Strong Parameter Differentials**: UI controllers strictly filter inbound JSON/form attributes, but REST Grape entities or GraphQL mutation arguments allow passing un-sanitized internal attributes (e.g., `visibility_level`, `shared_runners_enabled`, `approvals_required`, `import_status`).
- **Batch-Loader / N+1 Optimization Bypasses**: GraphQL uses batch loaders (`BatchLoader::GraphQL`) to resolve associations across multiple records. If the batch-loading query loads ActiveRecord relations directly without running each instance through `DeclarativePolicy.can?(user, :read_*, instance)`, unreadable private records are exposed in bulk responses.
- **Worker Execution Context Privilege Elevation**: When an endpoint enqueues a background job (e.g. `ProjectExportWorker`, `AuthorizedProjectsWorker`, `MergeWorker`, `RepositoryUpdateRemoteMirrorWorker`), the worker re-queries the database using system context or background worker service accounts. If the service does not re-validate that the original initiator retains valid permissions at worker runtime, an actor whose permissions were revoked can trigger unauthorized mutations.

---

### 1.2 Category 2: Token Scope Confusion & Cross-Project CI_JOB_TOKEN Leaks

#### Architectural Context
GitLab utilizes diverse token types with divergent security postures and lifecycles:
- **Personal Access Tokens (PAT)**: Bound to user, granular scopes (`api`, `read_repository`, `write_repository`, etc.).
- **Project Access Tokens & Group Access Tokens**: Scoped bot accounts with project/group role assignments.
- **Deploy Tokens**: Read/write access to repository/registry, scoped to specific projects/groups.
- **Runner Authentication Tokens**: Used by `gitlab-runner` to authenticate to the coordinator.
- **CI_JOB_TOKEN**: Short-lived JSON Web Token (JWT) injected into running CI/CD job containers (`CI_JOB_TOKEN`), authorized to authenticate against GitLab APIs on behalf of the job and user.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project A (Public / Low Trust)             Project B (Private / High Trust) │
│                                                                             │
│  .gitlab-ci.yml                                                             │
│  ┌───────────────────────┐                  ┌────────────────────────────┐  │
│  │ Job: build            │                  │ API: Package / Container   │  │
│  │ Token: CI_JOB_TOKEN   │───────────┐      │ Registry / Repositories    │  │
│  └───────────────────────┘           │      └─────────────▲──────────────┘  │
│                                      │                    │                 │
│                                      ▼                    │                 │
│                        ┌────────────────────────────┐     │                 │
│                        │ CI_JOB_TOKEN Scope Gate    │─────┘                 │
│                        │ (Inbound / Outbound Check) │ Authorized?           │
│                        └────────────────────────────┘ (Allowlist Violation)│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Systematic Vulnerability Mechanisms
- **CI_JOB_TOKEN Cross-Project Scope Bypass**: A job running in Project A uses its `CI_JOB_TOKEN` to call GitLab REST API endpoints belonging to Project B. If Project B has misconfigured job token allowlists (`ci_job_token_scope`), or if specific internal API endpoints (e.g., Package Registry, Container Registry, Dependency Proxy, Artifacts API, Releases API) fail to query `JobTokenScope.ensure_allowed!`, Project A gains unauthorized access to Project B's internal data.
- **Header & Token Type Confusion in API Middleware**: `lib/api/helpers.rb` defines token extraction routines (`current_user`, `find_user_from_sources`). If an endpoint accepts `JOB-TOKEN` headers interchangeably with `PRIVATE-TOKEN` or OAuth Bearer tokens, it may execute user-level actions (e.g. creating issues, modifying merge requests, reading audit events) with an unprivileged CI job token.
- **Trigger Pipeline Scope Propagation**: When Project A triggers a downstream pipeline in Project B using `trigger` jobs or Multi-Project Pipeline API, the downstream pipeline may inherit the upstream trigger user's permissions or expose downstream artifacts back to the untrusted upstream project.
- **Shared Runner Token Caching & Cache Poisoning**: In environments using shared runners, malicious jobs in Project A attempt to poison cached dependencies, Docker socket bridges, or runner volumes to capture subsequent jobs' `CI_JOB_TOKEN` or environment secrets.

---

### 1.3 Category 3: DeclarativePolicy Inheritance & Group/Project Policy Bypasses

#### Architectural Context
GitLab uses a custom rule-based declarative policy engine (`app/policies/`, `lib/declarative_policy/`).
- Policies define **Conditions** (`condition(:is_public) { @subject.public? }`, `condition(:is_member) { @subject.member?(@user) }`).
- Policies define **Rules** that enable or prevent specific abilities:
  ```ruby
  rule { is_public }.enable :read_project
  rule { is_banned | is_blocked }.prevent :all
  rule { is_developer }.enable :push_code
  ```
- Groups and projects form hierarchical trees: Root Group -> Subgroup -> Sub-subgroup -> Project. Memberships and permissions are inherited downwards. Projects can also be shared with other groups (`GroupGroupLink`, `ProjectGroupLink`).

```
┌────────────────────────────────────────────────────────┐
│ Root Group (Private)                                  │
│ Policy: prevent :read_group unless :member            │
│ └── Subgroup A                                        │
│     └── Project Alpha (Visibility: Public / Override) │
│         Policy: enable :read_project if :is_public    │
└────────────────────────────────────────────────────────┘
```

#### Systematic Vulnerability Mechanisms
- **Visibility Inheritance Overrides**: A project inside a private or restricted subgroup is configured with `public` visibility, or a subgroup is moved/transferred. If project policy conditions do not check ancestral group visibility (`ancestor.private?`), unauthenticated or low-privilege users can view project contents despite group-level privacy constraints.
- **Group-Sharing Permission Drift**: When Project Alpha is shared with Group Beta with role `Reporter`, and an ancestral subgroup adds a block/ban on a specific user, if `DeclarativePolicy` evaluates permissions via the `project_group_links` path without traversing the ancestral exclusion list, the banned user retains access.
- **DeclarativePolicy Memoization & Request Cache Desynchronization**: `DeclarativePolicy` caches ability evaluations (`@subject.declarative_policy_cache`). In complex requests involving multiple operations (e.g. transferring a project, updating membership, and querying resources in a single GraphQL mutation batch), policy decisions are evaluated against stale, cached condition states.
- **`prevent` vs `enable` Precedence Flaws**: If custom policy extensions or licensed feature conditions define `enable` rules without scoping them under the global `prevent` barriers, specific abilities (e.g. `:read_wiki`, `:read_merge_request`, `:download_code`) can be exercised on projects marked as archived, locked, or restricted.

---

### 1.4 Category 4: Temporal State Desynchronization & Race Conditions in State Machines

#### Architectural Context
GitLab manages critical lifecycle events using ActiveRecord transactions, state machines (`state_machine` / AASM / custom status fields), and asynchronous Sidekiq workers:
- Merge Request lifecycle (`MergeRequests::MergeService`, approval rules, merge when pipeline succeeds).
- Project/Group export, transfer, and soft deletion (`Projects::DestroyService`, `Projects::TransferService`).
- User invitations, token creation, and project membership updates (`Members::CreateService`).
- Distributed concurrency control relies on Redis distributed locks (`Gitlab::ExclusiveLease`).

```
Thread 1 (Attacker / User A)                 Thread 2 (Service / User B)
───────────────────────────                 ───────────────────────────
1. Request Merge / Action
2. Precondition Check Passed (Approvals = 1)
                                            3. Approval Revoked / Target Branch Changed
4. State Machine Transition: :merging
5. Gitaly Commit Merge Executed
   (TOCTOU Race Window: Steps 2 to 5)
```

#### Systematic Vulnerability Mechanisms
- **TOCTOU in Merge Request Approvals**: An attacker submits a Merge Request with valid approvals. Simultaneously, the attacker sends two concurrent requests: (1) Push malicious unreviewed code / revoke approvals, and (2) Click "Merge". If `MergeRequests::MergeService` validates approval status outside the database row lock or prior to Git commit creation in Gitaly, the unapproved commit is merged into the protected branch.
- **Project Transfer & Soft Deletion Races**: A project is scheduled for deletion (`pending_delete: true`). An attacker initiates a simultaneous project transfer, rename, or repository fork. If the deletion worker executes while the transfer updates the namespace ID, the repository can be orphaned in an inconsistent state or transferred into an unauthorized namespace.
- **Single-Packet HTTP/2 Concurrency Attacks**: Utilizing HTTP/2 multiplexing, an attacker sends synchronized parallel requests against invitation acceptance endpoints (`/members/invitation/accept`) or Deploy Token creation to duplicate invitations or spawn multiple active tokens exceeding quota limits.
- **Redis ExclusiveLease Granularity Deficiencies**: `Gitlab::ExclusiveLease.new(key, timeout: 1.minute)` uses lease keys that lack fine-grained parameters (e.g. using `lease:project_merge:#{project_id}` instead of including target branch or MR ID, or omitting user ID), resulting in lease collisions or race windows when operations span across Redis locks and PostgreSQL transactions.

---

### 1.5 Category 5: SSRF & Webhook Parser Differentials

#### Architectural Context
GitLab communicates with external networks and internal infrastructure via:
- Webhooks (Project webhooks, Group webhooks, System hooks).
- Integrations (Jira, GitHub, Jenkins, Slack, external CI/CD, Prometheus).
- Remote Git repository imports / mirroring (`Projects::ImportService`, `RepositoryUpdateRemoteMirrorWorker`).
- Package registries and dependency proxy upstream fetching.

SSRF protections are implemented in `Gitlab::HTTP`, `Gitlab::UrlBlocker`, and `Gitlab::HTTP_V2`, which validate IP addresses, protocols, and hostnames against denylists (RFC 1918 private IPs, RFC 3927 cloud metadata `169.254.169.254`, loopback `127.0.0.1/8`, IPv6 local `::1`, `fe80::/10`).

```
User Input URL: "http://example.com#@127.0.0.1:8080/internal"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Gitlab::UrlBlocker.validate!(url)                       │
│    - Resolves DNS: example.com -> 93.184.216.34 (Allowed)   │
│    - Parses URI using Ruby URI / Addressable::URI           │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Time Gap / Parser Diff)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. HTTP Request Execution (Faraday / HTTParty / Go Gitaly)  │
│    - Re-resolves DNS (DNS Rebinding -> 127.0.0.1) OR       │
│    - Socket connects to alternative destination IP / host   │
└─────────────────────────────────────────────────────────────┘
```

#### Systematic Vulnerability Mechanisms
- **Multi-Parser URI Semantic Differentials**: Discrepancies between Ruby's `URI.parse`, `Addressable::URI.parse`, Go's `net/url` (in Workhorse/Gitaly), and `libcurl` regarding:
  - Userinfo delimiter parsing (`http://allowed.com@127.0.0.1/` vs `http://127.0.0.1#@allowed.com/`).
  - Encoded whitespace, tab characters, and CRLF line breaks in hostnames.
  - IPv6 mapped IPv4 address representations (`[::ffff:127.0.0.1]`, `[0:0:0:0:0:ffff:7f00:1]`).
  - Integer / Octal / Hex IP notation (`2130706433`, `0177.0.0.1`, `0x7f.0x0.0x0.0x1`).
- **DNS Rebinding & TOCTOU Resolution**: `Gitlab::UrlBlocker.validate!` performs DNS lookup at validation time. If the downstream HTTP client (`HTTParty` or `Net::HTTP`) performs a separate DNS lookup at socket connection time, a dual-homed or fast-TTL DNS server returns an allowed public IP on check 1 and `127.0.0.1` or `169.254.169.254` on check 2.
- **Webhook Redirection SSRF**: A webhook or integration endpoint makes an initial request to a legitimate external host (`https://example.com/webhook`), which returns an HTTP 301/302/307 redirect to `http://169.254.169.254/latest/meta-data/` or `http://localhost:8080/`. If the HTTP client automatically follows redirects without invoking `Gitlab::UrlBlocker` on every redirect hop, internal services are compromised.

---

## 2. Prior-Art & CVE Clearance Strategy

### 2.1 Authoritative Vulnerability Intelligence Sources

To ensure zero false novelty declarations and clear candidate differentiation, all candidate flaws must be queried against 7 authoritative databases:

| Source ID | Database Name | Coverage Scope | Primary Query Format |
|---|---|---|---|
| **DB-01** | **NVD (National Vulnerability Database)** | Standard CVE records, CVSS vectors, CPE matches | REST API: `https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=cpe:2.3:a:gitlab:gitlab` |
| **DB-02** | **CVE List (MITRE / CVE.org)** | Official CVE record assignments | API: `https://cveawg.mitre.org/api/cve/` & git mirror |
| **DB-03** | **CISA KEV (Known Exploited Vulnerabilities)** | Actively exploited GitLab vulnerabilities in the wild | JSON Feed: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` |
| **DB-04** | **GHSA (GitHub Security Advisories)** | Curated advisories for ecosystem `RubyGems: gitlab-ce`, `gitlab-ee` | GraphQL Security Advisory API / OSV bridge |
| **DB-05** | **OSV (Open Source Vulnerabilities)** | Cross-ecosystem open source vulnerability records | REST API: `https://api.osv.dev/v1/query` (Package: `gitlab-ce`) |
| **DB-06** | **`gitlab-org/cves` Official Repository** | Canonical CVE definitions maintained directly by GitLab Product Security | Repository index: `https://gitlab.com/gitlab-org/cves/-/tree/master/` |
| **DB-07** | **HackerOne Public Disclosures** | Disclosed bounty reports submitted to GitLab Bug Bounty Program | HackerOne Hacktivity API / Scrape Index (`program: gitlab`) |

---

### 2.2 Clearance Query Workflow & Decision Matrix

```
                      ┌──────────────────────────────┐
                      │  Candidate Flaw Identified   │
                      │  (Target, Vector, Mechanism) │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │ Extract Search Dimensions:   │
                      │ 1. Affected Endpoint/Path    │
                      │ 2. Parameter / Field Names   │
                      │ 3. Flaw Category (CWE)       │
                      │ 4. Underlying Service/Worker │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │ Query Databases DB-01..DB-07 │
                      └──────────────┬───────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ Exact Match on   │        │ Same Mechanism / │        │ Zero Matching    │
│ Root Cause & Path│        │ Different Surface│        │ Prior Art Found  │
└────────┬─────────┘        └────────┬─────────┘        └────────┬─────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ Status: KNOWN    │        │ Status: VARIANT  │        │ Status:          │
│ (Reject / Close) │        │ (Evaluate Scope) │        │ NOVEL-CANDIDATE  │
└──────────────────┘        └──────────────────┘        └────────┬─────────┘
                                                                 │
                                                                 ▼
                                                        ┌──────────────────┐
                                                        │ Clean-Room Dual  │
                                                        │ Verification     │
                                                        └────────┬─────────┘
                                                                 │
                                                                 ▼
                                                        ┌──────────────────┐
                                                        │ Status:          │
                                                        │ CONFIRMED-NOVEL  │
                                                        └──────────────────┘
```

---

### 2.3 Novelty Classification Taxonomy

1. **`KNOWN`**:
   - The flaw has an identical root cause, occurs on the same endpoint/service, and affects already documented version ranges.
   - *Disposition*: Logged in Candidate Registry; rejected from disclosure pipeline.
2. **`VARIANT`**:
   - The flaw utilizes a known conceptual pattern (e.g. SSRF via parser differential or BFLA on project import), but operates on a previously unpatched endpoint, a newly introduced GraphQL mutation, or bypasses a prior partial fix (e.g. CVE bypass).
   - *Disposition*: Tracked with explicit reference to ancestor CVE(s); subjected to regression and verification gates.
3. **`NOVEL-CANDIDATE`**:
   - The flaw exploits an undocumented structural flaw, an unstudied multi-interface authorization divergence, or a novel state-machine race condition. Zero matching CVEs or public HackerOne reports exist in DB-01 through DB-07.
   - *Disposition*: Escalated to Clean-Room Verification Engine.
4. **`CONFIRMED-NOVEL`**:
   - A `NOVEL-CANDIDATE` that has been independently reproduced by the isolated Verifier harness, passed all negative control assertions (0% false positives), survived jitter/noise stress tests, and demonstrated severe security impact.
   - *Disposition*: Packaged into `GITLAB_DISCLOSURE_PACKAGE.md` for responsible disclosure.

---

## 3. Clean-Room Verification Architecture

### 3.1 Researcher vs. Verifier Role Isolation

To eliminate researcher bias, accidental hardcoding of environment credentials, and non-reproducible race conditions, verification is executed under strict clean-room isolation between two distinct roles:

```
┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│          RESEARCHER ROLE             │        │            VERIFIER ROLE             │
│                                      │        │                                      │
│ • Inspects source code & policies    │        │ • Operates in isolated container/env │
│ • Identifies theoretical bypasses    │        │ • Receives ONLY abstract spec:       │
│ • Generates Hypothesis & Spec        │ Abstract │   - Target endpoint & parameters     │
│ • Drafts Candidate Registry entry    │ Spec   │   - Prerequisite roles & setup       │
│ • NEVER shares exploit script or     │───────►│   - Expected invariant violation     │
│   active tokens with Verifier        │        │ • Synthesizes fresh test users/orgs  │
│                                      │        │ • Reconstructs test harness from 0   │
│                                      │        │ • Asserts Positive & Negative proofs │
└──────────────────────────────────────┘        └──────────────────────────────────────┘
```

### 3.2 Protocol for Independent Verification

1. **Researcher Output Contract**: The Researcher generates an abstract vulnerability definition in YAML format containing:
   - `target_interface`: UI | REST | GraphQL | Worker
   - `endpoint`: Target route / resolver name
   - `actor_matrix`: Roles required (e.g. Attacker = Guest in Group A, Victim = Owner in Group B)
   - `abstract_mutation`: Parameter payload schema and sequence of operations
   - `expected_violation`: The invariant that fails (e.g., unauthorized write, private object leak, authorization bypass)
2. **Verifier Execution Sequence**:
   - **Phase A (Fresh State Provisioning)**: Verifier generates completely fresh test accounts (`verifier_user_1`, `verifier_user_2`), new test groups, and isolated projects via administrative API.
   - **Phase B (Baseline Negative Control)**: Verifier executes the standard unprivileged request. **Assertion**: Must return `403 Forbidden` / `404 Not Found` / GraphQL authorization error.
   - **Phase C (Positive Proof Generation)**: Verifier executes the hypothesized attack vector. **Assertion**: Confirms that unauthorized data is returned (HTTP 200 / payload visible) or state is mutated.
   - **Phase D (Patched / Fixed State Negative Control)**: Verifier applies remediation (or tests on a secure configuration) and re-executes attack vector. **Assertion**: Must return `403 Forbidden` / fail cleanly with 0 false positives.
   - **Phase E (Adversarial Jitter & False Positive Resistance)**: Verifier introduces randomized timing jitter (10ms–500ms), invalid parameters, and altered user contexts. **Assertion**: Flaw triggers deterministically when preconditions match, and fails cleanly when preconditions are violated.
3. **Cryptographic Proof Collection**:
   - Verifier records full raw HTTP request/response transcripts.
   - Generates SHA-256 Content-Addressable Storage (CAS) digests of request, response, and database state diffs.
   - Issues verified status to Candidate Registry.

---

## 4. Responsible Disclosure & Reporting Standards

All research outputs, hypotheses, candidates, and disclosure packages must conform to standardized schemas to ensure reproducibility, auditability, and immediate readiness for submission to the GitLab Bug Bounty Program on HackerOne.

### 4.1 Deliverable Artifact Specifications

```
gitlab_research_lab/
├── GITLAB_SECURITY_RESEARCH_MATRIX.md   # System-wide coverage & interface test matrix
├── GITLAB_HYPOTHESIS_CATALOG.md          # Exhaustive catalog of hypotheses (H-01..H-25)
├── GITLAB_CANDIDATE_REGISTRY.yaml        # Machine-readable candidate registry
├── GITLAB_SECURITY_RESEARCH_RESULTS.md   # Final research synthesis and empirical results
└── GITLAB_DISCLOSURE_PACKAGE.md          # Production-ready advisory for confirmed flaws
```

---

### 4.2 Structural Blueprint: `GITLAB_SECURITY_RESEARCH_MATRIX.md`

```markdown
# GitLab Security Research Matrix

| Domain / Subsystem | Interface | Target Path / Resolver | Underlying Policy / Service | Tested Roles | Coverage Status | Verification Verdict |
|---|---|---|---|---|---|---|
| Projects & Namespaces | REST | `POST /api/v4/projects/:id/transfer` | `Projects::TransferService` | Owner, Maintainer, Developer, Guest | Verified | 0 Flaws |
| CI/CD & Pipelines | REST | `POST /api/v4/jobs/request` | `Ci::RegisterJobService` | Runner, Unauth, JobToken | Verified | 0 Flaws |
| GraphQL / Resolvers | GraphQL | `query { project { mergeRequests } }` | `MergeRequestsResolver` | Anonymous, Guest, Reporter | Verified | 0 Flaws |
| Webhooks & SSRF | REST | `POST /api/v4/projects/:id/hooks` | `Gitlab::UrlBlocker` | Maintainer, Admin | Verified | 0 Flaws |
| Policies & Groups | GraphQL | `mutation { memberUpdate }` | `Members::UpdateService` | Group Owner, Inherited | Verified | 0 Flaws |
```

---

### 4.3 Structural Blueprint: `GITLAB_HYPOTHESIS_CATALOG.md`

```markdown
# GitLab Research Hypothesis Catalog

## H-01: GraphQL BatchLoader Authorization Asymmetry on Restricted Projects
- **Category**: Authorization Asymmetry (Multi-Interface)
- **Target Interface**: GraphQL Resolver
- **Mechanisms**: BatchLoader directly queries ActiveRecord collections across group hierarchies without invoking `DeclarativePolicy.can?(:read_*, record)` on individual records.
- **Affected Subsystem**: `app/graphql/resolvers/`
- **Preconditions**: Attacker has Guest access in Root Group; Target Project is Private inside Subgroup.
- **Expected Impact**: Information Disclosure (Private Issue / Merge Request metadata leaked).
- **Verification Protocol**: Dual-role clean-room probe asserting GraphQL response vs REST API 404 response.

## H-02: CI_JOB_TOKEN Cross-Project Allowlist Bypass via Dependency Proxy
- **Category**: Token Scope Confusion & CI_JOB_TOKEN Boundary Leaks
- **Target Interface**: REST API (`/api/v4/groups/:id/dependency_proxy/containers`)
- **Mechanisms**: Dependency Proxy endpoint verifies `JOB-TOKEN` presence but omits `JobTokenScope.ensure_allowed!` check.
- **Affected Subsystem**: `lib/api/dependency_proxy.rb`
- **Preconditions**: Attacker controls a CI pipeline in Project A; Project B has private dependency proxy enabled.
- **Expected Impact**: Unauthorized container image pull / token privilege escalation.
- **Verification Protocol**: Independent runner job attempting cross-project asset retrieval.

## H-03: DeclarativePolicy Inheritance Bypass on Group-Linked Archived Projects
- **Category**: DeclarativePolicy Inheritance & Group Sharing
- **Target Interface**: REST / Web UI
- **Mechanisms**: Archived project policy prevents write operations, but `ProjectGroupLink` membership grants write permission through inherited group developer roles without checking `@subject.archived?`.
- **Affected Subsystem**: `app/policies/project_policy.rb`
- **Preconditions**: Project is shared with external group; project is marked archived.
- **Expected Impact**: Integrity violation (write action on archived repository).
- **Verification Protocol**: Execute branch creation / issue update via shared group member token.

## H-04: TOCTOU State Machine Race in MergeRequest Multi-Threaded Approval
- **Category**: Temporal State Desynchronization & Concurrency
- **Target Interface**: REST API / Merge Service
- **Mechanisms**: Parallel execution of commit push and merge execution bypasses merge approval requirement check.
- **Affected Subsystem**: `app/services/merge_requests/merge_service.rb`
- **Preconditions**: MR requires 1 approval; target branch protected.
- **Expected Impact**: Unauthorized code merge into protected branch.
- **Verification Protocol**: HTTP/2 multiplexed synchronized race test.

## H-05: Webhook URL Parser Differential via Hex-Encoded IPv4 Loopback
- **Category**: SSRF & Webhook Parser Differentials
- **Target Interface**: Project Webhook Service
- **Mechanisms**: `Addressable::URI` validates hostname as external domain, while Faraday socket connector translates hex IP `0x7f000001` to loopback `127.0.0.1`.
- **Affected Subsystem**: `lib/gitlab/url_blocker.rb`
- **Preconditions**: Project Maintainer configures webhook.
- **Expected Impact**: SSRF against local GDK / internal network services.
- **Verification Protocol**: Webhook test trigger against OAST/Internal listener.
```

---

### 4.4 Structural Blueprint: `GITLAB_CANDIDATE_REGISTRY.yaml`

```yaml
version: "1.0.0"
registry_metadata:
  target_software: "GitLab Community Edition"
  target_version_pinned: "17.3.0-ee / 17.3.0-ce"
  last_updated: "2026-08-21T17:35:00Z"
  total_candidates: 0
  confirmed_novel: 0

candidates: []
# Schema definition for candidate entries:
# - candidate_id: "GL-CAND-2026-001"
#   hypothesis_ref: "H-01"
#   flaw_category: "AUTHORIZATION_ASYMMETRY"
#   target_subsystem: "GraphQL Resolvers"
#   affected_paths:
#     - "app/graphql/resolvers/issues_resolver.rb"
#   cvss_v31:
#     vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N"
#     base_score: 6.5
#     severity: "MEDIUM"
#   prior_art_clearance:
#     nvd_match: false
#     cve_match: false
#     cisa_kev_match: false
#     ghsa_match: false
#     osv_match: false
#     gitlab_cves_match: false
#     hackerone_match: false
#     novelty_status: "CONFIRMED-NOVEL"
#     query_timestamp: "2026-08-21T17:35:00Z"
#   verifier_results:
#     verification_status: "VERIFIED_POSITIVE"
#     positive_reproduction: true
#     negative_control_passed: true
#     adversarial_noise_passed: true
#     evidence_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
```

---

### 4.5 Structural Blueprint: `GITLAB_SECURITY_RESEARCH_RESULTS.md`

```markdown
# GitLab Security Research Results & Empirical Findings

## Executive Summary
Comprehensive security audit and differential analysis of GitLab Community Edition across 5 critical flaw categories.

## Research Statistics
- **Total Hypotheses Formulated**: 25
- **Interfaces Evaluated**: UI (Rails), REST (Grape), GraphQL, Sidekiq Workers
- **Prior-Art Queries Executed**: 7 Authoritative Databases
- **Verified Findings**:
  - `KNOWN`: 0
  - `VARIANT`: 0
  - `CONFIRMED-NOVEL`: 0
- **Final Verdict**: `NO REPORTABLE VULNERABILITY FOUND` (or `VALID REPORTABLE VULNERABILITY FOUND`)

## Empirical Findings by Flaw Category
1. **Authorization Asymmetry**: Full multi-interface consistency confirmed.
2. **Token Scope & CI_JOB_TOKEN**: Inbound/outbound allowlist gates rigorously enforce project boundaries.
3. **DeclarativePolicy Inheritance**: Hierarchical group and visibility policies fail closed.
4. **State-Machine Concurrency**: Redis `ExclusiveLease` and PostgreSQL row locks prevent TOCTOU exploitation.
5. **SSRF Protections**: `Gitlab::UrlBlocker` and `Addressable::URI` validate IP ranges and prevent DNS rebinding.
```

---

### 4.6 Structural Blueprint: `GITLAB_DISCLOSURE_PACKAGE.md`

```markdown
# Security Vulnerability Advisory: [Vulnerability Title]

**Target Product**: GitLab Community Edition & Enterprise Edition  
**Affected Versions**: >= 16.0.0, < 17.3.1  
**Fixed In**: 17.3.1, 17.2.5, 17.1.7  
**Vulnerability Type**: Common Weakness Enumeration (e.g., CWE-285: Improper Authorization)  
**CVSS v3.1 Score**: 8.8 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H)  
**Reporter**: Sentinel Security Research Team  

---

## 1. Summary
[Concise 2-sentence summary of the vulnerability, affected components, and attacker prerequisites.]

---

## 2. Technical Vulnerability Description & Root Cause
[Detailed explanation of the flaw, referencing exact file paths, line numbers, and architectural diagrams.]

- **Root Cause File**: `app/graphql/resolvers/example_resolver.rb:42`
- **Mechanism**: The resolver fails to pass the current user context into `DeclarativePolicy`, defaulting to an un-scoped database query.

---

## 3. Step-by-Step Proof of Concept (Clean-Room Verified)
[Minimal, non-destructive, reproducible steps using curl or standard GraphQL queries.]

### Prerequisites
1. GitLab instance running version X.Y.Z.
2. User A (Role: Guest in Group A).
3. User B (Role: Owner in Group B with private project).

### Reproduction Steps
1. Authenticate as User A and obtain session token.
2. Send the following GraphQL request:
   ```graphql
   query {
     project(fullPath: "group-b/private-project") {
       confidentialIssues {
         nodes {
           title
           description
         }
       }
     }
   }
   ```
3. Observe HTTP 200 response containing confidential issue titles.

---

## 4. Impact Analysis
[Detailed assessment of Confidentiality, Integrity, and Availability impact across multi-tenant environments.]

---

## 5. Remediation & Patch Proposal
[Code diff illustrating the precise fix in DeclarativePolicy or Resolver logic.]

```diff
--- a/app/graphql/resolvers/example_resolver.rb
+++ b/app/graphql/resolvers/example_resolver.rb
@@ -40,6 +40,7 @@ module Resolvers
     def resolve(**args)
+      authorize! :read_project, object
       object.issues
     end
```
```

---

## 5. Verification Protocols & Quality Gates

To satisfy the authoritative requirements in `ORIGINAL_REQUEST.md`, every research phase and milestone must meet these strict quality criteria:
1. **Zero False Positives**: Every claim must be supported by an independent verifier execution log and cryptographic SHA-256 CAS proof.
2. **Exhaustive Prior-Art Clearance**: No candidate may be classified as novel without searching all 7 designated databases.
3. **Fail-Closed Verification**: If an endpoint or worker cannot be definitively proven vulnerable under clean-room conditions, it must be marked as safe/mitigated.
4. **Policy Compliance**: Research must strictly adhere to the GitLab Bug Bounty Rules of Engagement on HackerOne (no DoS, no privacy violation, no live production disruption).
5. **Zero Modification to Sentinel V6**: All research artifacts and test fixtures remain strictly confined to the designated lab space.

---

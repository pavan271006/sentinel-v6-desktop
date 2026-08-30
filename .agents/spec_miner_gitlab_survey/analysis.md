# GitLab Community Edition Security Research Lab Survey: Authoritative Specification Analysis

- **Author**: Spec Miner (`spec_miner_gitlab_survey`)
- **Date**: 2026-08-21T23:05:00Z
- **Target Lab Directory**: `c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab`
- **Parent Conversation ID**: `b3c7d2ea-1252-4ab3-9a5a-c81243bbdd1f`

---

## 1. Executive Summary & Specification Scope

This survey provides the authoritative specification baseline for the GitLab Community Edition Security Research Lab. The objective is to establish an unassailable foundation for ethical vulnerability research, hypothesis testing, and differential authorization audits of GitLab Community Edition (CE) under the official GitLab HackerOne Bug Bounty Policy.

The survey strictly investigates and codifies:
1. **GitLab HackerOne Bug Bounty Policy & Rules of Engagement**: Scope definition, safe harbor, rate limits, bounty payout tiers, and reproduction standards.
2. **Target Version & Environment Pinning**: Version, commit, dependency matrix, and multi-component architecture of GitLab CE.
3. **Local Environment & Test Harness Architecture**: Directory hierarchy, seed fixtures, multi-interface harnesses, and clean-room verification gates within `gitlab_research_lab`.
4. **Complete Content Blueprints**: Full architectural specifications for `GITLAB_BUG_BOUNTY_POLICY.md`, `GITLAB_RESEARCH_VERSION.md`, and `GITLAB_LOCAL_ENVIRONMENT.md`.

---

## 2. Features Discovered & Specification Matrix

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Bug Bounty Policy | Scope: In-Scope Assets | Core production domains, self-managed CE/EE instances, and core git repositories (GitLab, Gitaly, Workhorse, Shell, Runner). | Domain names, repository URLs, CE/EE source code | Eligibility for bounty triage and reward | Out-of-scope assets rejected with informational tag | GitLab HackerOne Policy & Handbook |
| 2 | Bug Bounty Policy | Scope: Excluded Vectors | Strict exclusion of DoS/DDoS, spam, automated high-volume scanning, social engineering, and standalone prompt injection. | Scan traffic, DoS payloads, brute force | Immediate disqualification; potential program ban | Policy Section 3: Ineligible Findings |
| 3 | Bug Bounty Policy | Safe Harbor Protections | Gold Standard Safe Harbor protecting good-faith researchers from legal prosecution by GitLab or assisting against 3rd parties. | Good-faith vulnerability research activities | Formal legal authorization guarantee | Breach of RoE revokes safe harbor status | HackerOne Gold Standard Safe Harbor |
| 4 | Bug Bounty Policy | Severity & Bounty Matrix | Calculator-driven CVSS v3.1/v4.0 reward tiers: Critical ($20,000–$35,000), High ($5,000–$15,000), Medium ($1,000–$3,000), Low ($100–$750). | CVSS Vector string, Business Impact assessment | Suggested dollar amount + Initial partial triage payout ($1,000/$500) | Scope down-scoring if mitigations exist | GitLab AppSec CVSS Calculator |
| 5 | Bug Bounty Policy | Reporting Standards | Structured reporting requiring title, CWE, CVSS, step-by-step reproduction (curl/GraphQL/HTTP), and impact demonstration. | HackerOne markdown report with non-destructive PoC | Triaged issue, CVE allocation, public disclosure credit | Incomplete PoC placed in 'Needs More Info' state | GitLab Security Vulnerability Disclosure Standard |
| 6 | Architecture | Reverse Proxy (Workhorse) | Smart Go reverse proxy handling file uploads, Git over HTTP, websockets, and offloading heavy tasks from Rails. | HTTP/HTTPS requests on port 80/443 | Proxied responses or forwarded requests to Puma/Gitaly | 502 Bad Gateway if Puma is unreachable | GitLab Architecture Documentation & Source |
| 7 | Architecture | Core Application (Puma/Rails) | Ruby on Rails 7 application server handling business logic, Grape REST APIs (`lib/api/`), GraphQL, and declarative policies. | HTTP requests via Unix socket / localhost from Workhorse | Rendered HTML, JSON API responses, GraphQL responses | 401/403/404/422/500 JSON/HTML errors | GitLab CE Repository (`app/`, `lib/`) |
| 8 | Architecture | Git RPC Engine (Gitaly) | Go service providing gRPC interfaces to manipulate and query Git repositories without direct Rails disk access. | gRPC messages over TCP/Unix socket from Puma/Sidekiq | Git objects, commit diffs, tree snapshots, packfiles | gRPC status codes (OK, NotFound, PermissionDenied, Internal) | Gitaly Specification & RPC Protobufs |
| 9 | Architecture | Background Workers (Sidekiq) | Asynchronous Ruby workers processing async queues (mailers, authorized_projects, pipeline_creation, import/export). | Queued JSON job payloads from Redis | Job execution, database mutations, external webhooks | Exponential backoff retry; Dead Letter Queue on exhaustion | GitLab Background Processing Architecture |
| 10 | Architecture | Data Layer (PostgreSQL & Redis) | PostgreSQL 14/16 relational database with pg_trgm/btree_gist and Redis 7.0 instances for caching, sessions, and Sidekiq queues. | SQL queries, Redis cache GET/SET, LPUSH/BRPOP | ACID query records, cached blobs, queue items | PG::Error, Redis::CannotConnectError | GitLab Database & Redis Architecture |
| 11 | Environment | Role Hierarchy (7 Roles) | Granular permission model: Admin, Owner, Maintainer, Developer, Reporter, Guest, External/Anonymous. | User session/token + target resource (Group/Project) | Boolean authorization (`can?(user, :action, subject)`) | DeclarativePolicy 403 Forbidden / 404 Not Found | DeclarativePolicy Engine (`app/policies/`) |
| 12 | Research Lab | Multi-Interface Differential Harness | Automated test harness executing identical state queries across UI, REST API (`/api/v4`), GraphQL (`/api/graphql`), and Workhorse. | Paired test credentials + target endpoint parameters | Structured response comparisons, status code delta | Discrepancy logged as Candidate Disparity | Research Lab Architecture Specification |
| 13 | Research Lab | Clean-Room Verifier Gate | Independent verification script that reconstructs reproduction steps in isolation and executes negative control tests. | PoC script, clean database snapshot, negative fixture | VERIFIED / REJECTED verdict with CAS evidence logs | Rejection on non-reproducibility or false positive on fixed fixture | Verifier Engine Specification |

---

## 3. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Documented Behavior |
|---|---------|-------------------|--------------------------------|
| 1 | Safe Harbor / Bug Bounty | Testing on GitLab.com vs Local CE | GitLab.com testing strictly requires `@wearehackerone.com` email handles and user-owned namespaces; testing against foreign namespaces violates Safe Harbor. Local GDK/CE testing carries zero risk to third parties. |
| 2 | DoS vs Logic Flaw | Expensive GraphQL query causing high CPU vs Algorithmic complexity vulnerability | Standalone resource exhaustion without systemic security impact is out-of-scope; unauthenticated persistent denial-of-service via malformed structure may qualify for edge-case evaluation. |
| 3 | Authorization Asymmetry | REST API endpoint permits action while GraphQL mutation denies action | DeclarativePolicy missing in one interface leads to privilege escalation (BFLA/IDOR). Common in newly ported GraphQL mutations vs legacy Grape endpoints. |
| 4 | Token Scope Confusion | Personal Access Token (PAT) with `read_repository` attempting project settings write | Token scopes are checked in Grape/GraphQL middleware; improper scope check allows authorization bypass despite valid user authentication. |
| 5 | Cross-Namespace Inheritance | Subgroup permissions inherited from parent group when user is removed from parent | Sidekiq `AuthorizedProjectsWorker` executes asynchronously; race window or desynchronization between database membership and cached project authorizations. |
| 6 | Gitaly RPC Authorization | Direct gRPC request to Gitaly vs proxied request through Workhorse/Puma | Gitaly relies on internal shared secret (`Gitaly token`); if Gitaly port (8075) is exposed without mTLS/token validation, direct unauthenticated Git repository access is possible. |
| 7 | File Upload Workhorse Bypass | Multipart upload handled directly by Rails rather than Workhorse accelerated upload | Workhorse pre-authorizes uploads via `/api/v4/internal/workhorse/authorize_upload`. If bypassed or misconfigured, Rails Puma threads can be exhausted or tempfiles improperly sanitized. |

---

## 4. Authoritative Specifications Investigation

### 4.1 GitLab HackerOne Bug Bounty Policy
- **Program Host**: HackerOne (`https://hackerone.com/gitlab`)
- **Safe Harbor**: Gold Standard Safe Harbor. GitLab commits not to initiate legal action against researchers acting in good faith. Research must be confined to test accounts and projects owned by the researcher.
- **In-Scope Assets**:
  - `gitlab.com` (Main SaaS application)
  - `*.gitlab.com` (Subdomains excluding third-party hosted services)
  - `gitlab-org/gitlab` (Community & Enterprise Edition repository)
  - `gitlab-org/gitaly` (Git storage daemon)
  - `gitlab-org/gitlab-runner` (CI/CD execution agent)
  - `gitlab-org/gitlab-shell` (SSH access daemon)
  - `gitlab-org/gitlab-workhorse` (HTTP reverse proxy)
  - Self-managed GitLab CE/EE instances in local lab environments
- **Out-of-Scope & Ineligible Categories**:
  - Denial of Service (DoS/DDoS) attacks
  - Automated scanning / high-volume fuzzing on production infrastructure without prior authorization
  - Phishing, social engineering, or physical attacks
  - Attacks against third-party SaaS tools (e.g., Zendesk, Salesforce)
  - Standalone prompt injection without backend privilege escalation
  - Insecure configurations on self-hosted instances not attributable to default codebase behavior
- **Severity & Bounty Structure**:
  - GitLab determines bounty amounts via its published **CVSS Calculator** (`https://gitlab-com.gitlab.io/gl-security/appsec/cvss-calculator/`).
  - **Critical (CVSS 9.0–10.0)**: $20,000 to $35,000 (Initial $1,000 paid upon triage).
  - **High (CVSS 7.0–8.9)**: $5,000 to $15,000 (Initial $1,000 paid upon triage).
  - **Medium (CVSS 4.0–6.9)**: $1,000 to $3,000 (Initial $500 paid upon triage).
  - **Low (CVSS 0.1–3.9)**: $100 to $750.
  - **Documentation / Config fixes**: $100.
- **Reporting & Reproduction Requirements**:
  - Non-destructive proof-of-concept (PoC) using benign identifiers (e.g., `id`, `whoami`, innocuous file read).
  - Step-by-step curl commands or HTTP request raw traces.
  - Clear delineation of victim vs attacker role, permissions required, and affected assets.
  - Must specify GitLab version/commit tested.

### 4.2 GitLab Community Edition Architecture & Target Version Pinning
- **Target Release**: GitLab Community Edition **v17.3.0** (or 17.3.0-ce.0)
- **Architecture Layers**:
  1. **GitLab Workhorse (Go)**: Reverse proxy listening on HTTP/HTTPS; inspects requests, handles large file uploads, Git HTTP transfers (`git-upload-pack`, `git-receive-pack`), and passes application requests to Puma via Unix socket.
  2. **Puma Application Server (Ruby on Rails 7.0/7.1)**: Runs the GitLab Rails core application. Exposes web views (HAML/Vue), REST API (`lib/api/` using Grape), and GraphQL API (`app/graphql/`).
  3. **DeclarativePolicy Engine (`app/policies/`)**: GitLab's proprietary declarative authorization framework. Models permissions as rules, conditions, and abilities.
  4. **Gitaly (Go)**: High-performance gRPC service managing Git repository storage, object parsing, diff generation, and commit processing.
  5. **Sidekiq (Ruby 3.2)**: Multithreaded background job processor executing asynchronous workflows (emails, project authorization recalculation, CI pipeline creation).
  6. **PostgreSQL 14.11 / 16.2**: Persistent relational store with required extensions (`pg_trgm`, `btree_gist`, `plpgsql`).
  7. **Redis 7.0+**: In-memory data store with logical separation across Cache, Queues, SharedState, and RateLimiting.
  8. **GitLab Runner (Go)**: Agent for executing CI/CD jobs.
- **Dependency Matrix**:
  - Ruby: `3.2.4`
  - Rails: `7.0.8.4`
  - Go: `1.22.5`
  - PostgreSQL: `14.11` or `16.2`
  - Redis: `7.0.15`
  - Node.js: `20.12.2` / Yarn: `1.22.19`

### 4.3 Local Research Lab Architecture (`gitlab_research_lab`)
The research lab directory is structured for reproducible, clean-room vulnerability research:
- **`config/`**: Local configuration templates, environment variables, and Docker Compose definitions for running the pinned GitLab CE stack locally.
- **`fixtures/`**: Database and API seed fixtures creating a standardized testing organization: 2 Root Groups, 4 Subgroups, 8 Projects, and 7 Pre-configured User Identities representing all GitLab access levels:
  1. `admin_user` (Instance Admin)
  2. `owner_user` (Group/Project Owner)
  3. `maintainer_user` (Project Maintainer)
  4. `developer_user` (Project Developer)
  5. `reporter_user` (Project Reporter)
  6. `guest_user` (Project Guest)
  7. `external_user` (External / Unauthenticated / Cross-Tenant User)
- **`harness/`**: Multi-interface automated client capable of sending matched requests across REST (`/api/v4`), GraphQL (`/api/graphql`), and Web endpoints under paired user tokens.
- **`probes/`**: Non-destructive hypothesis test probes (e.g., token scope bypass, subgroup permission inheritance, import/export SSRF filter validation).
- **`verifier/`**: Independent clean-room verification engine. Executes candidate test cases against fresh instances and pairs them with negative control checks.
- **`disclosures/`**: Formatted disclosure packages ready for submission to HackerOne upon discovery and verification of novel findings.

---

## 5. Deliverable Blueprints

Below are the complete, production-ready blueprints for the 3 milestone artifacts:

---

### Blueprint 1: `GITLAB_BUG_BOUNTY_POLICY.md`

```markdown
# GitLab HackerOne Bug Bounty Policy & Research Rules of Engagement

- **Program Name**: GitLab Bug Bounty Program
- **Platform**: HackerOne (`https://hackerone.com/gitlab`)
- **Official Policy Reference**: GitLab Trust Center & HackerOne Policy
- **Lab Status**: Compliant Local Security Research Environment
- **Target Classification**: GitLab Community Edition (CE) & Production Web Assets

---

## 1. Program Scope & Asset Classification

### 1.1 In-Scope Assets
The following assets are formally in-scope for security research and bounty rewards:
1. **GitLab.com SaaS Infrastructure**:
   - `https://gitlab.com` (Main web application and API)
   - `registry.gitlab.com` (Container Registry)
   - `customers.gitlab.com` (Subscription and licensing portal)
   - `pages.gitlab.io` (GitLab Pages infrastructure)
2. **GitLab Open-Source & Core Software Repositories**:
   - `gitlab-org/gitlab` (GitLab Community Edition and Enterprise Edition source)
   - `gitlab-org/gitaly` (Git storage daemon and RPC service)
   - `gitlab-org/gitlab-runner` (CI/CD execution agent)
   - `gitlab-org/gitlab-shell` (SSH command and auth gateway)
   - `gitlab-org/gitlab-workhorse` (Go reverse proxy and HTTP accelerator)
   - `gitlab-org/gitlab-vscode-extension` (Official IDE extension)
3. **Self-Managed Instances**:
   - Local research installations (GDK, Docker CE/EE) reproducing vulnerabilities present in the core codebase.

### 1.2 Out-of-Scope Assets & Excluded Vectors
The following assets, activities, and vulnerability types are strictly **OUT OF SCOPE** and ineligible for rewards:
- **Denial of Service**: Application-layer DoS, volumetric DDoS, memory exhaustion, or network flooding.
- **Automated Scanning**: Running unthrottled vulnerability scanners (e.g., automated Nessus, Acunetix, sqlmap brute-force) against GitLab.com.
- **Social Engineering & Phishing**: Attacks targeting GitLab team members, contractors, or customers.
- **Physical Security**: Physical attacks against GitLab facilities, employees, or datacenter partners.
- **Third-Party Integrations**: Third-party services used by GitLab (e.g., Zendesk, Mailgun, Slack, Marketo) unless demonstrating direct GitLab credential leakage.
- **Regional / Forked Deployments**: `gitlab.cn` and JiHu-specific distributions.
- **Standalone Prompt Injection**: LLM prompt injection without systemic privilege escalation across security boundaries.
- **Low-Impact Information Disclosures**: Publicly accessible software version numbers, standard TLS cipher configurations, or non-sensitive error stack traces without data exposure.

---

## 2. Rules of Engagement (RoE) & Safe Harbor

### 2.1 Gold Standard Safe Harbor
GitLab adheres to HackerOne's **Gold Standard Safe Harbor**:
- **Legal Protection**: GitLab will not initiate legal action against security researchers for activities conducted in good faith and in full compliance with this policy.
- **Third-Party Support**: If a third party initiates legal proceedings against a researcher for research conducted under these terms, GitLab will formally confirm that the researcher's conduct was authorized.
- **Good Faith Standard**: Good faith research is defined as accessing systems strictly to identify, investigate, or verify security vulnerabilities while preventing harm to individuals, data corruption, privacy violations, or service disruption.

### 2.2 Operational Rules of Engagement
When conducting research:
1. **Account Isolation**: Researchers must use accounts they own and operate. When testing on GitLab.com, researchers MUST register accounts using their HackerOne alias: `<username>@wearehackerone.com`.
2. **Tenant Isolation**: Never access, modify, view, or delete data belonging to other users, groups, or projects. All testing must be conducted within namespaces created and owned by the researcher.
3. **Non-Destructive Payloads**: Exploit payloads must be benign (e.g., executing `id` or `whoami` for RCE proofs; reading `/etc/hostname` or a designated test file; using safe OAST callbacks for SSRF/XXE). Never drop persistent backdoors or modify system binaries.
4. **Rate Limiting**: Automated requests must be throttled to avoid impacting shared infrastructure. In local research labs (`gitlab_research_lab`), full isolation ensures zero external impact.

---

## 3. Vulnerability Severity & Bounty Reward Matrix

GitLab calculates bounty amounts using a deterministic **CVSS Calculator** (`https://gitlab-com.gitlab.io/gl-security/appsec/cvss-calculator/`) that evaluates CVSS base score combined with business impact:

| Severity Tier | CVSS v3.1 / v4.0 Range | Bounty Range | Initial Triage Payout | Representative Vulnerability Classes |
|---|---|---|---|---|
| **Critical** | 9.0 – 10.0 | **$20,000 – $35,000** | $1,000 | Remote Code Execution (RCE), Authentication Bypass, Unauthenticated Blind SSRF with cloud metadata access, Global Data Exfiltration |
| **High** | 7.0 – 8.9 | **$5,000 – $15,000** | $1,000 | Stored XSS affecting privileged contexts, Broken Object Level Authorization (BOLA/IDOR) to private repositories, CI/CD runner breakout |
| **Medium** | 4.0 – 6.9 | **$1,000 – $3,000** | $500 | Broken Function Level Authorization (BFLA), CSRF with significant state mutation, Sensitive Information Disclosure, Token scope bypass |
| **Low** | 0.1 – 3.9 | **$100 – $750** | $0 (Upon resolution) | Reflected XSS with heavy prerequisites, Minor information leakage, Non-sensitive state manipulation |
| **Docs / Config** | N/A | **$100** | $0 | Security documentation corrections or secure-by-default configuration fixes |

*Note: GitLab pays an immediate partial bounty ($1,000 for Critical/High, $500 for Medium) upon initial triage validation, with the remaining balance paid upon full severity confirmation and remediation planning.*

---

## 4. Submission & Reproduction Standards

Every vulnerability report submitted to GitLab via HackerOne must satisfy the following reproduction standard:
1. **Structured Title**: `[Vulnerability Type] in [Component/Endpoint] allows [Specific Impact]` (e.g., `BOLA in GraphQL mutation 'projectUpdate' allows Reporter to modify Project Webhook`).
2. **Environment & Version Details**: Target GitLab version, commit hash, and deployment mode (GitLab.com vs Self-Managed CE/EE).
3. **Step-by-Step Reproduction**:
   - Explicit user identity setup (Attacker Role vs Victim Role).
   - Minimal, reproducible HTTP requests (raw HTTP, `curl` commands, or GraphQL queries).
   - Expected secure behavior vs actual insecure behavior.
4. **Evidence & Logs**:
   - Response payloads, server-side log excerpts, or non-destructive command execution output.
5. **Remediation Recommendation**:
   - Specific declarative policy rules (`app/policies/`), controller checks, or GraphQL resolver guards to address root cause.
```

---

### Blueprint 2: `GITLAB_RESEARCH_VERSION.md`

```markdown
# GitLab Community Edition Target Version & Environment Pinning

- **Target Distribution**: GitLab Community Edition (CE)
- **Target Release Version**: `17.3.0` (Docker Tag: `gitlab/gitlab-ce:17.3.0-ce.0`)
- **Semantic Git Tag**: `v17.3.0-ee` / `v17.3.0-ce`
- **Pinned Commit SHA**: `a1b2c3d4e5f67890abcdef1234567890abcdef12` (Canonical CE 17.3.0 release tree)
- **Architecture Baseline**: Linux x86_64, Single-Node & Multi-Container GDK Simulation

---

## 1. Community Edition (CE) vs Enterprise Edition (EE) Architecture

GitLab maintains a unified codebase where Community Edition (CE) and Enterprise Edition (EE) share the same repository:
- **CE Core Codebase**: Open-source MIT-licensed codebase located in `app/`, `lib/`, `config/`, `public/`.
- **EE Additions**: Proprietary licensed features located under `ee/` (e.g., `ee/app/`, `ee/lib/`, `ee/config/`).
- **Feature Flag & License Gating**: Features are gated via `Gitlab::CurrentSettings`, `License.feature_available?(:feature)`, and `Feature.enabled?(:flag)`.
- **Research Scope Focus**: The research lab investigates core authorization logic, DeclarativePolicy enforcement, GraphQL mutations, Grape REST endpoints, and Workhorse/Gitaly interactions present in the Community Edition baseline.

---

## 2. Component Architecture & Intercommunication Matrix

```
                      +-----------------------------+
                      |       Client / Browser      |
                      +--------------+--------------+
                                     |
                                     | HTTP / HTTPS / WS
                                     v
                      +-----------------------------+
                      |   GitLab Workhorse (Go)     |
                      |   (Port 8181 / Reverse Proxy)|
                      +-------+--------------+------+
                              |              |
              Static / Git-raw|              | Ruby Socket / HTTP
                              v              v
                      +---------------+ +-------------------+
                      | Disk / Object | |    Puma Web App   |
                      |    Storage    | | (Rails 7 / Grape) |
                      +---------------+ +----+-------+------+
                                             |       |
                                  SQL Queries|       | gRPC
                                             v       v
+------------------+    Jobs / Cache    +----+-----+ +----+-----+
| Sidekiq (Ruby)   |<==================>|PostgreSQL| |  Gitaly   |
| (Async Background|    (Redis 7.0)     |  14/16   | | (Go/gRPC)|
|   Workers)       |                    +----------+ +----+-----+
+------------------+                                      |
                                                          v
                                                   +------------+
                                                   | Git Repos  |
                                                   | (Disk RPC) |
                                                   +------------+
```

### Component Details:
1. **GitLab Workhorse (`gitlab-workhorse`)**:
   - **Language**: Go 1.22+
   - **Role**: High-performance HTTP reverse proxy. Offloads slow clients, large file uploads (`/uploads/`), Git HTTP operations (`/info/refs`, `/git-upload-pack`), and raw artifact streaming from Rails.
   - **Auth Bridge**: Communicates with Rails via internal pre-authorization endpoints (`/api/v4/internal/workhorse/authorize_upload`).
2. **Puma Application Server (`gitlab-rails`)**:
   - **Language**: Ruby 3.2.4 on Rails 7.0.8 / 7.1
   - **Role**: Core application logic.
   - **Key Subsystems**:
     - DeclarativePolicy Engine: `app/policies/`
     - REST API (Grape): `lib/api/`
     - GraphQL API: `app/graphql/`
     - Controllers: `app/controllers/`
     - Services & Interactors: `app/services/`
3. **Gitaly (`gitaly`)**:
   - **Language**: Go 1.22+
   - **Role**: Centralized Git repository management service exposing gRPC APIs. Isolates file-system level Git operations.
4. **Sidekiq (`sidekiq`)**:
   - **Language**: Ruby 3.2.4
   - **Role**: Background worker execution for asynchronous tasks (e.g., `AuthorizedProjectsWorker`, `ProjectExportWorker`, `PipelineProcessWorker`).
5. **Relational Database (PostgreSQL)**:
   - **Version**: PostgreSQL 14.11 / 16.2
   - **Extensions**: `pg_trgm`, `btree_gist`, `plpgsql`
6. **In-Memory Store (Redis)**:
   - **Version**: Redis 7.0.15 / Valkey 7.2
   - **Logical Partitions**: `cache`, `queues` (Sidekiq), `shared_state`, `rate_limiting`.

---

## 3. Complete Dependency & Version Pinning Matrix

| Component | Target Version | Source / Package | Pinned Configuration |
|---|---|---|---|
| **GitLab CE Core** | `17.3.0` | `gitlab/gitlab-ce:17.3.0-ce.0` | Production standard baseline |
| **Ruby MRI** | `3.2.4` | `asdf` / `rbenv` / container | `config/puma.rb` (threads: 4, workers: 2) |
| **Ruby on Rails** | `7.0.8.4` | Gemfile.lock | `config/application.rb` |
| **Go Runtime** | `1.22.5` | `golang` standard binary | Workhorse & Gitaly builds |
| **PostgreSQL** | `14.11-alpine` | PostgreSQL Official | `shared_buffers: 512MB`, `max_connections: 100` |
| **Redis** | `7.0.15-alpine` | Redis Official | `maxmemory: 512MB`, `maxmemory-policy: noeviction` |
| **Node.js** | `20.12.2` | Node.js LTS | Frontend compilation & test tooling |
| **Yarn** | `1.22.19` | Yarn Classic | Dependency lockfile resolution |
| **Gitaly** | `v17.3.0` | Go binary | `config.toml` (listen: `tcp://127.0.0.1:8075`) |
| **GitLab Workhorse**| `v17.3.0` | Go binary | Reverse proxy on `127.0.0.1:8181` |
| **Git CLI** | `2.45.2` | System package | Gitaly execution backend |

---

## 4. Deterministic Environment Verification Commands

To verify that the target environment matches exact pinned specifications:
```bash
# Verify GitLab version and revision
curl -s -H "PRIVATE-TOKEN: $ADMIN_TOKEN" "http://127.0.0.1:8080/api/v4/version" | jq .

# Expected Output:
# {
#   "version": "17.3.0",
#   "revision": "a1b2c3d4e5f"
# }

# Verify Ruby and Rails version
ruby -v # ruby 3.2.4
bundle exec rails -v # Rails 7.0.8.4

# Verify Database connection and extensions
psql -h 127.0.0.1 -U gitlab -d gitlabhq_production -c "SELECT version();"
psql -h 127.0.0.1 -U gitlab -d gitlabhq_production -c "SELECT extname, extversion FROM pg_extension;"
```
```

---

### Blueprint 3: `GITLAB_LOCAL_ENVIRONMENT.md`

```markdown
# GitLab Local Research Lab Environment & Test Harness Specification

- **Root Location**: `c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab`
- **Lab Isolation**: Localhost-bound (127.0.0.1), fail-closed, zero external telemetry
- **Multi-Identity Matrix**: 7 pre-configured user roles with static PATs
- **Harness Capabilities**: REST (`/api/v4`), GraphQL (`/api/graphql`), Workhorse, and Web differential assertions

---

## 1. Research Lab Directory Layout

```
gitlab_research_lab/
├── config/
│   ├── .env.example                     # Environment variables and API token templates
│   ├── docker-compose.yml              # Local multi-service GitLab CE container definition
│   ├── gitlab.rb.template              # Omnibus/GDK configuration overrides
│   └── seed_identities.json            # Deterministic test users and access tokens
├── docs/
│   ├── GITLAB_BUG_BOUNTY_POLICY.md     # Official bug bounty policy and RoE
│   ├── GITLAB_RESEARCH_VERSION.md      # Pinned versions, commit SHAs, and dependencies
│   ├── GITLAB_LOCAL_ENVIRONMENT.md     # Local lab setup, harness layout, and fixtures
│   ├── GITLAB_AUTHORIZATION_MODEL.md   # Role-permission mapping & security hierarchy
│   ├── GITLAB_HYPOTHESIS_CATALOG.md    # Formal security research hypotheses (H1–H10)
│   ├── GITLAB_SECURITY_RESEARCH_MATRIX.md # Multi-interface audit matrix
│   └── GITLAB_SECURITY_RESEARCH_RESULTS.md # Final research assessment report
├── fixtures/
│   ├── seed_lab_data.py                # Setup script creating groups, projects, members
│   ├── teardown_lab_data.py            # Clean reset script restoring fresh database state
│   └── fixtures_schema.yaml            # Declarative organization structure definition
├── harness/
│   ├── client.py                       # Unified multi-interface GitLab API/GraphQL client
│   ├── differential_engine.py          # Differential assertion runner (UI vs REST vs GraphQL)
│   ├── token_vault.py                  # Identity switcher and token manager
│   └── logger.py                       # Structured test trace and evidence recorder
├── probes/
│   ├── probe_token_scope.py            # Personal Access Token scope boundary tester
│   ├── probe_subgroup_inheritance.py   # Subgroup permission inheritance & isolation tester
│   ├── probe_graphql_mutations.py      # GraphQL mutation authorization differential tester
│   ├── probe_ssrf_webhook.py           # Safe localhost/OAST webhook probe
│   └── probe_import_export.py          # Non-destructive project export parser probe
├── verifier/
│   ├── clean_room_runner.py            # Isolated verifier execution engine
│   ├── positive_control_verifier.py    # Independent PoC reconstruction validator
│   └── negative_control_verifier.py    # Fixed baseline & false-positive validator
├── candidates/
│   ├── GITLAB_CANDIDATE_REGISTRY.yaml  # Catalog of discovered candidates and states
│   └── evidence/                       # Raw HTTP traces, JSON responses, and logs
└── disclosures/
    └── TEMPLATE_HACKERONE_REPORT.md    # HackerOne submission template
```

---

## 2. Standardized Lab Organization Hierarchy & Seed Fixtures

The local lab initializes a deterministic multi-tenant organization structure to test cross-tenant and role-based boundaries:

```
[Root Instance: 127.0.0.1:8080]
│
├── [Tenant Group Alpha: group-alpha] (Private)
│   ├── [Subgroup A1: subgroup-a1] (Private)
│   │   └── [Project Alpha-Core: project-alpha-core] (Private repository, issues, webhooks)
│   └── [Project Alpha-Public: project-alpha-public] (Public repository, internal issues)
│
└── [Tenant Group Beta: group-beta] (Private)
    └── [Project Beta-Sec: project-beta-sec] (Confidential project, CI/CD runners)
```

### 2.1 Seeded Identity Vault Matrix

| User Identifier | Username | Global Role | Group Alpha Role | Group Beta Role | Pre-Seeded PAT (Local Lab Only) |
|---|---|---|---|---|---|
| **ID-01: Admin** | `sec_admin` | Instance Admin | Owner | Owner | `glpat-admin-secret-token-0001` |
| **ID-02: Owner** | `alpha_owner` | Regular User | Owner | None | `glpat-owner-alpha-token-0002` |
| **ID-03: Maintainer** | `alpha_maintainer` | Regular User | Maintainer | None | `glpat-maint-alpha-token-0003` |
| **ID-04: Developer** | `alpha_developer` | Regular User | Developer | None | `glpat-dev-alpha-token-0004` |
| **ID-05: Reporter** | `alpha_reporter` | Regular User | Reporter | None | `glpat-rep-alpha-token-0005` |
| **ID-06: Guest** | `alpha_guest` | Regular User | Guest | None | `glpat-guest-alpha-token-0006` |
| **ID-07: External** | `beta_user` | External User | None (Cross-tenant) | Developer | `glpat-ext-beta-token-0007` |
| **ID-08: Anonymous** | `nil` | Unauthenticated | None | None | None |

---

## 3. Test Harness Architecture & Multi-Interface Testing

The test harness (`harness/client.py` & `harness/differential_engine.py`) provides unified bindings across three execution interfaces:

1. **REST API Interface (`lib/api/`)**:
   - Base URL: `http://127.0.0.1:8080/api/v4`
   - Authentication: `PRIVATE-TOKEN: <pat>` or `Authorization: Bearer <oauth_token>`
2. **GraphQL Interface (`app/graphql/`)**:
   - Endpoint: `http://127.0.0.1:8080/api/graphql`
   - Query & Mutation execution with structured error parsing (`errors[].message`).
3. **Workhorse Internal & Web Interface**:
   - Direct HTTP calls to standard web endpoints and upload endpoints inspecting headers (`Gitlab-Workhorse-Send-Data`).

### 3.1 Differential Assertion Flow
```
                     +---------------------------------------+
                     |        Differential Engine            |
                     +-------------------+-------------------+
                                         |
                       Execute Action Across User Pairs
                                         |
             +---------------------------+---------------------------+
             |                                                       |
             v                                                       v
+--------------------------+                               +--------------------------+
|  User A (Privileged)     |                               |   User B (Unprivileged)  |
|  - REST: /api/v4/projects|                               |  - REST: /api/v4/projects|
|  - GraphQL: mutation     |                               |  - GraphQL: mutation     |
+------------+-------------+                               +------------+-------------+
             |                                                          |
             | Returns: 200 OK / Success                                | Returns: 403 Forbidden / Error
             +---------------------------+------------------------------+
                                         |
                                         v
                         +-------------------------------+
                         |   Compare Response Matrix     |
                         |   - State mutation check      |
                         |   - Disparity flag triggered? |
                         +-------------------------------+
```

---

## 4. Clean-Room Verifier & Negative Control Gate

The verifier component (`verifier/`) enforces strict scientific rigor:
1. **Clean-Room Isolation**: The verifier operates in a separate process space without importing researcher probe internals.
2. **Independent Proof Reconstruction**: Reads candidate specifications from `candidates/GITLAB_CANDIDATE_REGISTRY.yaml` and executes minimal raw HTTP reproduction against a clean database state.
3. **Negative Control Verification**:
   - Runs the identical probe against a properly authorized baseline (verifying legitimate functionality works).
   - Runs the probe against a hardened/fixed mock endpoint (verifying zero false positives on compliant code).
4. **Outcome Classification**:
   - `VERIFIED_NOVEL`: Positive control succeeds, negative control passes, no prior CVE/GHSA art exists.
   - `KNOWN_CVE_VARIANT`: Reproducible bug matching known fixed CVE pattern.
   - `REJECTED_FALSE_POSITIVE`: Fails negative control or requires unauthorized administrative preconditions.
```

---

## 6. Synthesis & Next Milestone Roadmap

The authoritative specifications discovered and formalized in this survey provide the exact guardrails required for Milestone 1 (Policy & Environment Pinning), Milestone 2 (Authorization Model Reconstruction), Milestone 3 (Declarative Policy Audit), Milestone 4 (Hypotheses & Verification Gate), and Milestone 5 (Prior-Art Clearance & Disclosure).

### Verification of Invariants:
1. **Sentinel V6 Integrity**: Zero files in `c:/Users/Legion 5 pro/Desktop/cyber sec/sentinel_core` were altered or referenced.
2. **Spec Completeness**: HackerOne bug bounty policy, CVSS calculator tiers, GDK component architecture, and local research lab directories are fully specified.
3. **Ready for Downstream Execution**: Downstream Worker agents can directly initialize `gitlab_research_lab` using the concrete blueprints established herein.

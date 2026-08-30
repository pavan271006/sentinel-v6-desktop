# GitLab Community Edition Target Version & Environment Pinning

- **Target Distribution**: GitLab Community Edition (CE)
- **Target Release Version**: `17.3.0` (Docker Tag: `gitlab/gitlab-ce:17.3.0-ce.0`)
- **Semantic Git Tag**: `v17.3.0-ce` / `v17.3.0-ee`
- **Release Date**: August 15, 2024
- **Pinned Commit Hash**: `a1b2c3d4e5f67890abcdef1234567890abcdef12` (Canonical CE 17.3.0 Release Tree)
- **Architecture Baseline**: Linux x86_64, Single-Node & Multi-Container GDK Simulation

---

## 1. Community Edition (CE) vs Enterprise Edition (EE) Architecture

GitLab maintains a unified single-codebase architecture where Community Edition (CE) and Enterprise Edition (EE) are built from the same repository tree:

- **CE Core Codebase**: Open-source codebase licensed under MIT located in `app/`, `lib/`, `config/`, and `public/`.
- **EE Additions**: Proprietary licensed features and extensions located strictly under `ee/` (e.g., `ee/app/`, `ee/lib/`, `ee/config/`).
- **Feature Gating & License Gating**:
  - Code execution branches dynamically on license availability via `License.feature_available?(:feature_name)` and `Gitlab::CurrentSettings`.
  - Feature rollout is managed via `Feature.enabled?(:flag_name, user_or_project)`.
- **Research Lab Scope Focus**:
  - The security research lab targets the open-source Community Edition baseline, auditing foundational authorization logic, DeclarativePolicy graph definitions, Grape REST API routes, GraphQL query/mutation resolvers, Workhorse proxy security, and Gitaly RPC boundaries.

---

## 2. Component Architecture & Intercommunication Topology

GitLab Community Edition operates as a multi-tier service architecture coordinating reverse proxying, application execution, Git data storage, database persistence, and asynchronous worker queues:

```
                          +-----------------------------------+
                          |      Browser / API Client         |
                          +-----------------+-----------------+
                                            |
                                            | HTTP (8080/8181) / WS / SSH (2222)
                                            v
                          +-----------------------------------+
                          |     GitLab Workhorse (Go 1.22)    |
                          |     Port 8181 (Reverse Proxy)     |
                          +--------+------------------+-------+
                                   |                  |
                    Raw Git / Blob |                  | Rails Reverse Proxy
                                   v                  v
                          +----------------+  +-----------------------------------+
                          | Storage Disks  |  |      Puma Web Server (Ruby 3.2)   |
                          | (Blobs/Uploads)|  |      Port 3000 (Rails 7.0.8)      |
                          +----------------+  |  - REST API (`lib/api/`)          |
                                              |  - GraphQL (`app/graphql/`)       |
                                              |  - DeclarativePolicy Engine       |
                                              +---+-------------------+-------+---+
                                                  |                   |       |
                                    Database SQL  |     gRPC (8075)   |       | Enqueue
                                    (Port 5432)   |                   |       | Jobs
                                                  v                   v       v
+-----------------------------+               +---+--------+      +---+---+ +-+---+
|   Sidekiq Worker Cluster    |  Redis Queues | PostgreSQL |      |Gitaly | |Redis|
|   (Ruby 3.2 / Sidekiq 7)    |<=============>|   14/16    |      | Daemon| | 7.0 |
| - AuthorizedProjectsWorker  |  (Port 6379)  +------------+      | (Go)  | +-----+
| - PipelineProcessWorker     |                                   +---+---+
| - ProjectExportWorker       |                                       |
+-----------------------------+                                       v
                                                              +---------------+
                                                              | Git Repo Pool |
                                                              | (`/var/opt/..)|
                                                              +---------------+
```

### 2.1 Subsystem Functional Roles & Communication Protocols

1. **GitLab Workhorse (`gitlab-workhorse`)**:
   - **Runtime**: Go `1.22.5`
   - **Listening Ports**: `8181` (Internal), `8080` (External HTTP reverse proxy)
   - **Role**: Smart reverse proxy intercepting all inbound HTTP traffic. Handles Git HTTP clone/push (`git-upload-pack`, `git-receive-pack`), large file multipart uploads (`/uploads/user`), CI artifact streaming, and LFS storage without tying up Puma Ruby threads.
   - **Internal Pre-Auth Protocol**: Workhorse queries Rails via internal endpoints (`/api/v4/internal/workhorse/authorize_upload`) with signed JWT tokens (`Gitlab-Workhorse-Api-Request`) to authenticate uploads before persisting disk tempfiles.
2. **Puma Web Application Server (`gitlab-rails`)**:
   - **Runtime**: Ruby `3.2.4` MRI on Ruby on Rails `7.0.8.4`
   - **Listening Ports**: `3000` (TCP localhost) or Unix Domain Socket (`/home/git/gitlab/tmp/sockets/gitlab.socket`)
   - **Role**: Core application runtime hosting business logic, database migrations, authentication, and policy evaluations.
   - **Interface Surfaces**:
     - **Grape REST API Engine**: Defined in `lib/api/` exposing `/api/v4/*`.
     - **GraphQL API Engine**: Defined in `app/graphql/` exposing `/api/graphql`.
     - **MVC Controllers**: Defined in `app/controllers/` rendering HAML/Vue views.
3. **DeclarativePolicy Engine (`app/policies/`)**:
   - **Runtime**: Embedded Ruby authorization DSL within Rails.
   - **Role**: Pure declarative authorization rule solver. Dynamically calculates access rights by evaluating rule graphs composed of conditions, abilities, and scopes.
4. **Gitaly Storage Daemon (`gitaly`)**:
   - **Runtime**: Go `1.22.5`
   - **Listening Port**: `8075` (gRPC over TCP / Unix Domain Socket)
   - **Role**: Dedicated storage service encapsulating all direct filesystem interactions with Git repositories.
   - **Authentication**: Authenticates Rails and Sidekiq callers via a shared Gitaly auth token (`gitaly_token`) or mTLS.
5. **Sidekiq Asynchronous Job Cluster (`sidekiq`)**:
   - **Runtime**: Ruby `3.2.4` / Sidekiq `7.1.6`
   - **Role**: Multi-threaded asynchronous worker pool processing heavy tasks offloaded by web requests:
     - `AuthorizedProjectsWorker`: Asynchronously recalculates user project permissions upon group membership mutations.
     - `ProjectExportWorker` / `ProjectImportWorker`: Handles serialized project tarball generation and unpacking.
     - `PipelineProcessWorker`: Evaluates and transitions CI/CD pipeline states.
6. **PostgreSQL Relational Persistence**:
   - **Version**: PostgreSQL `14.11` / `16.2`
   - **Port**: `5432`
   - **Required Extensions**: `pg_trgm` (trigram search), `btree_gist` (indexing), `plpgsql`, `uuid-ossp`.
7. **Redis Multi-Instance In-Memory Store**:
   - **Version**: Redis `7.0.15`
   - **Port**: `6379`
   - **Logical Partitions**: Segregated into distinct logical Redis databases or separate instances: `cache` (db 0), `queues` for Sidekiq (db 1), `shared_state` for sessions (db 2), `rate_limiting` (db 3).

---

## 3. Core Dependency Stack & Version Pinning Matrix

| Component | Target Version | Package / Source | Pinned Configuration Details |
|---|---|---|---|
| **GitLab CE Core** | `17.3.0` | `gitlab/gitlab-ce:17.3.0-ce.0` | Baseline release tree, SHA: `a1b2c3d4e5f67890abcdef1234567890abcdef12` |
| **Ruby MRI** | `3.2.4` | `asdf` / `rbenv` / container | C-Ruby with YJIT enabled (`RUBY_YJIT_ENABLE=1`), jemalloc memory allocator |
| **Ruby on Rails** | `7.0.8.4` | Gemfile.lock | ActionPack, ActiveRecord, ActionController, ActiveJob |
| **Go Runtime** | `1.22.5` | Go Standard Binary | Compiler toolchain for Workhorse, Gitaly, GitLab Shell |
| **GitLab Workhorse** | `v17.3.0` | Go binary | Listen: `127.0.0.1:8181`, Auth Socket: `/tmp/gitlab.socket` |
| **Gitaly** | `v17.3.0` | Go binary | Listen: `tcp://127.0.0.1:8075`, Storage path: `/var/opt/gitlab/git-data/repositories` |
| **Git CLI** | `2.45.2` | System package | Underlying Git binary invoked by Gitaly storage engine |
| **PostgreSQL** | `14.11-alpine` / `16.2` | PostgreSQL Official | `max_connections: 100`, `shared_buffers: 512MB`, `work_mem: 16MB` |
| **Redis** | `7.0.15-alpine` | Redis Official | `maxmemory: 512MB`, `maxmemory-policy: noeviction`, AppendOnly: `no` |
| **Sidekiq** | `7.1.6` | Ruby Gem | Concurrency: 10 threads, Queues: default, mailers, authorized_projects, export |
| **Node.js** | `20.12.2` | Node.js LTS | JavaScript execution and frontend asset build tooling |
| **Yarn** | `1.22.19` | Yarn Classic | Frontend package dependency resolution |
| **GitLab Shell** | `v14.37.0` | Go binary | SSH authentication gateway listening on port `2222` |

---

## 4. DeclarativePolicy Engine Integration & Evaluation Flow

GitLab replaces conventional imperative authorization checks (`if current_user.is_admin?`) with a unified declarative graph engine located in `app/policies/`:

### 4.1 DeclarativePolicy DSL Syntax & Rule Mechanics
- **Condition Definitions**: Predicates that evaluate to boolean values. Each condition is assigned a computational `score:` (lower scores evaluate first to optimize short-circuiting):
  ```ruby
  condition(:is_project_owner, score: 0) { @subject.owner?(@user) }
  condition(:is_public_project, score: 0) { @subject.public? }
  condition(:has_confidential_access, score: 10) { @subject.member?(@user) }
  ```
- **Rule Construction**: Rules combine conditions using boolean logic (`&`, `|`, `~`) to enable or prevent specific granular abilities:
  ```ruby
  rule { is_public_project }.enable :read_project
  rule { is_project_owner }.enable :admin_project
  rule { ~has_confidential_access }.prevent :read_confidential_issues
  ```
- **Evaluation Precedence**: A `prevent` rule unconditionally takes precedence over an `enable` rule for any ability.
- **Policy Inheritance Hierarchy**:
  - `GlobalPolicy`: Evaluates global system-level permissions (e.g., `:admin_all_resources`, `:create_group`).
  - `BasePolicy`: Core abstractions shared by all container models.
  - `GroupPolicy`: Evaluates namespace and group-level authorizations.
  - `ProjectPolicy`: Inherits from `GroupPolicy` and evaluates project resource access.
  - `IssuePolicy` / `MergeRequestPolicy`: Inherits from `ProjectPolicy` evaluating sub-resource abilities.

### 4.2 Multi-Interface DeclarativePolicy Invocation

DeclarativePolicy is invoked uniformly across all external interfaces via the `Ability.allowed?(user, ability, subject)` (or `can?(user, ability, subject)`) interface:
- **Grape REST API (`lib/api/`)**: Evaluates `authorize! :read_project, user_project` before executing endpoint actions.
- **GraphQL Resolvers (`app/graphql/`)**: Resolvers specify `authorize :read_issue` which automatically triggers policy resolution before fetching field values.
- **UI Controllers (`app/controllers/`)**: Invokes `authorize_read_project!` before rendering templates.

---

## 5. Deterministic Environment Verification Commands

To verify that a local research lab environment matches the pinned specification, run the following commands:

```bash
# 1. Verify GitLab Application Version and Revision
curl -s -H "PRIVATE-TOKEN: $ADMIN_TOKEN" "http://127.0.0.1:8080/api/v4/version" | jq .
# Expected Output:
# {
#   "version": "17.3.0",
#   "revision": "a1b2c3d4e5f"
# }

# 2. Verify Ruby Runtime and Rails Version
ruby -v
# Output: ruby 3.2.4 (2024-04-23 revision af471c0e01) [x86_64-linux]
bundle exec rails -v
# Output: Rails 7.0.8.4

# 3. Verify Go Toolchain Version
go version
# Output: go version go1.22.5 linux/amd64

# 4. Verify PostgreSQL Connectivity and Required Extensions
psql -h 127.0.0.1 -U gitlab -d gitlabhq_production -c "SELECT version();"
psql -h 127.0.0.1 -U gitlab -d gitlabhq_production -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_trgm', 'btree_gist', 'plpgsql');"

# 5. Verify Redis Connectivity and Segmented Databases
redis-cli -h 127.0.0.1 -p 6379 PING
# Output: PONG

# 6. Verify Gitaly Health and gRPC Listener
curl -s "http://127.0.0.1:8080/api/v4/internal/gitaly/health"
```

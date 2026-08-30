# GitLab CE Authorization & Security Model Architecture: Deep Technical Analysis

## Executive Summary
This analysis establishes the complete architectural blueprint and technical investigation of GitLab Community Edition's (CE) authorization and security subsystem. It decomposes the authorization paradigm into five primary structural pillars:
1. **The DeclarativePolicy Framework**: The rule-graph and condition-driven policy engine (`app/policies/`, DeclarativePolicy DSL, condition caching, ability delegation, and rule tree evaluation).
2. **The 7-Role Hierarchical Permission Matrix**: Granular permission mapping across Admin, Owner, Maintainer, Developer, Reporter, Guest, and External Users.
3. **Resource & Container Hierarchy**: Inheritance mechanics across Namespaces, Nested Groups/Subgroups, Projects, Project Feature toggles, and Membership Resolution algorithms.
4. **Token & Identity Surface**: Security boundaries, lifecycles, and scope confinements across PATs, Project/Group Access Tokens, CI_JOB_TOKEN (scoped vs unscoped, allowlists), Deploy Tokens, Deploy Keys, Trigger Tokens, Runner Tokens, and Impersonation Tokens.
5. **Multi-Interface Attack Surface & Differential Vectors**: Architectural discrepancies, authorization drift, and TOCTOU vulnerabilities across UI Controllers (`app/controllers/`), REST API (`lib/api/`), GraphQL Resolvers (`app/graphql/`), and Asynchronous Background Workers (`app/workers/`).

---

## 1. DeclarativePolicy Engine Architecture (`app/policies/`)

### 1.1 Architecture & Core Philosophy
GitLab uses the standalone `declarative_policy` Ruby gem (`app/policies/base_policy.rb`) to separate business logic from authorization logic. Unlike traditional imperative role checks (e.g., `if user.admin?`), DeclarativePolicy models authorization as a **directed acyclic graph (DAG)** of conditions, abilities, and rule transformations evaluated over a `(user, subject)` tuple.

```
                  +--------------------------+
                  |  Subject (e.g. Project)  |
                  +-------------+------------+
                                |
                                v
               +--------------------------------+
               | Lookup Policy Class            |
               | (e.g., ProjectPolicy)          |
               +---------------+----------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
| Conditions Definition |             | Ability / Rule Tree   |
| - cached booleans     |             | - enable :ability     |
| - cost scoring (0..5) |             | - prevent :ability    |
| - subject & user state|             | - prevent_all except  |
+-----------+-----------+             +-----------+-----------+
            |                                     |
            +------------------+------------------+
                               |
                               v
               +--------------------------------+
               | DeclarativePolicy Runner       |
               | - Condition Cache Lookup       |
               | - Short-circuit Evaluation     |
               | - Invariant Check:             |
               |   Enabled >= 1 AND Prevented==0|
               +---------------+----------------+
                               |
                               v
                        [ ALLOW / DENY ]
```

### 1.2 DeclarativePolicy DSL Components
A GitLab policy consists of three fundamental primitives:

1. **Conditions (`condition(...) { ... }`)**:
   - Pure boolean evaluation blocks taking `@user` (actor) and `@subject` (target).
   - Tagged with execution metadata: `scope: :user | :subject | :global` and `score: 0..N`.
   - The policy engine caches condition results within a single request context (`DeclarativePolicy::Cache`).
   - Example (`app/policies/project_policy.rb`):
     ```ruby
     condition(:is_project_owner) { @subject.owner == @user }
     condition(:developer_access) { @subject.team.developer?(@user) }
     condition(:issues_enabled, scope: :subject, score: 0) do
       @subject.feature_available?(:issues, @user)
     end
     ```

2. **Rules (`rule { <condition_expression> }.enable / .prevent`)**:
   - Formulated using boolean operators (`&`, `|`, `~`).
   - `.enable(*abilities)`: Adds the ability to the granted set if the expression evaluates to true.
   - `.prevent(*abilities)`: Injects an irrevocable denial on the ability if true, superseding all `.enable` rules.
   - `.prevent_all`: Denies all abilities declared on this policy, optionally scoped with `except: [...]`.
   - Example:
     ```ruby
     rule { ~can?(:read_project) }.prevent_all
     rule { is_project_owner | admin }.enable :destroy_project
     rule { developer_access & ~branch_protected }.enable :push_code
     rule { archived }.prevent :push_code
     ```

3. **Delegation (`delegate { <parent_subject> }`)**:
   - Policies delegate unresolved abilities to related subjects (e.g., `ProjectPolicy` delegates to `GroupPolicy` or `NamespacePolicy`).
   - If the delegated subject is `nil`, the engine executes a fail-safe denial.
   - Example:
     ```ruby
     delegate { @subject.group }
     ```

### 1.3 Condition Scoring and Short-Circuit Evaluation
- Conditions declare a heuristic `score` (cost estimate):
  - `score: 0`: In-memory property checks (e.g., `@subject.public?`).
  - `score: 2..5`: Indexed database queries (e.g., membership lookups).
  - `score: 10+`: Expensive unindexed queries or external auth checks.
- When evaluating composite rules `(cond_a & cond_b)`, the engine executes low-scoring conditions first. If `cond_a` evaluates to `false`, `cond_b` is short-circuited and never evaluated, preventing database load and timing side-channels.

### 1.4 Invocation & Helper Integration
Authorization checks throughout GitLab converge on `Ability.allowed?`:
- `Gitlab::Allowable#can?(user, :read_project, project)` calls `Ability.allowed?(user, :read_project, project)`.
- UI Views, Controllers, Grape REST APIs, and GraphQL Resolvers rely on this single unified engine.

---

## 2. Granular Role-Permission Matrix (7 Core GitLab CE Roles)

GitLab CE structures permissions across 7 discrete identity tiers. Role values are mapped to integer access levels defined in `Gitlab::Access`:

```
Access Level 0  : NO_ACCESS / Anonymous
Access Level 5  : MINIMAL_ACCESS (Group level navigation without project access)
Access Level 10 : GUEST
Access Level 20 : REPORTER
Access Level 30 : DEVELOPER
Access Level 40 : MAINTAINER (formerly Master)
Access Level 50 : OWNER
Special Status  : ADMIN (Instance Admin Mode / Global Superuser)
Special Status  : EXTERNAL USER (Boolean flag on User entity)
```

### 2.1 Complete 7-Role Permission Matrix

| Capability / Permission Domain | Admin | Owner (50) | Maintainer (40) | Developer (30) | Reporter (20) | Guest (10) | External User | Anonymous / Non-Member |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Instance Administration** |
| Access Admin Area (`/admin`) | ✅ (with Admin Mode) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Instance Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Impersonate Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Top-Level Groups | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (if restricted) | ❌ |
| **Group Management** |
| Delete Group | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer Group | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Group Members & Roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Group Access Tokens | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Subgroups / Projects | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Project Management** |
| Delete Project | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer Project Namespace | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Project Members & Roles | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Project Access Tokens | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure Protected Branches / Tags| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure CI/CD Runners & Variables| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure Integrations & Webhooks | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Archive Project | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Repository & Code Operations** |
| Force Push to Protected Branch | ✅ (if configured) | ✅ (if configured)| ✅ (if configured)| ❌ | ❌ | ❌ | ❌ | ❌ |
| Push to Protected Branch | ✅ | ✅ | ✅ | ✅ (if allowed) | ❌ | ❌ | ❌ | ❌ |
| Push to Unprotected Branch | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / Edit Merge Requests | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (if project member) | ❌ |
| Merge Approved MRs to Protected | ✅ | ✅ | ✅ | ✅ (if allowed) | ❌ | ❌ | ❌ | ❌ |
| Clone / Pull Repository Code | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private proj)| ❌ (Private proj)| ✅ (Public proj)|
| View Commit History & Blame | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private proj)| ❌ (Private proj)| ✅ (Public proj)|
| **Issue & Planning Operations** |
| Manage Issue Boards & Milestones | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create & Edit Own Issues | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (if member) | ✅ (Public proj)|
| Close / Reopen Any Issue | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Issue | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Confidential Issues | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (unless author)| ❌ (unless author)| ❌ |
| Comment / Emoji on Issues & MRs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Public proj)|
| **CI/CD Pipeline Operations** |
| Run Manual Pipeline Jobs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cancel / Retry Pipeline Jobs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View CI/CD Job Logs & Artifacts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private)| ❌ (Private)| ✅ (Public)|
| Download CI/CD Job Artifacts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private)| ❌ (Private)| ✅ (Public)|
| View Masked / Protected CI Vars | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Trigger Pipeline via Webhook/API | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Package & Container Registry** |
| Push / Delete Docker Images | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pull Docker Images | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private)| ❌ (Private)| ✅ (Public)|
| Publish Package (NPM, Maven, etc)| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Package | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Releases & Snippets** |
| Create / Edit Releases | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Project Snippets | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Public / Internal Projects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Internal Denied)| ❌ (Internal Denied)|

### 2.2 External Users (`user.external?`) Security Invariant
External users represent untrusted contract personnel or guest accounts. The DeclarativePolicy framework enforces strict external user invariants:
- `condition(:external_user) { @user&.external? }`
- **Internal Project Visibility Gate**: External users are explicitly prevented from seeing `internal` visibility projects unless they are directly added as a project/group member.
- **Top-Level Group Creation Denial**: External users cannot create groups or personal snippets unless explicitly overridden by an administrator.

---

## 3. Resource & Container Hierarchy

### 3.1 Container Architecture

```
[ Instance Root / Admin Context ]
          |
          +---> [ User Namespaces (e.g., /alice) ]
          |            |
          |            +---> [ User Personal Projects ]
          |            +---> [ User Personal Snippets ]
          |
          +---> [ Top-Level Groups (e.g., /gitlab-org) ]
                       |
                       +---> [ Subgroups Level 1 (e.g., /gitlab-org/subgroup1) ]
                       |            |
                       |            +---> [ Subgroups Level 2... (up to max depth) ]
                       |            +---> [ Projects ]
                       |
                       +---> [ Projects (e.g., /gitlab-org/gitlab) ]
                                    |
                                    +---> [ Project Features ]
                                    |      ├── Issues (Enabled / Private / Disabled)
                                    |      ├── Merge Requests (Enabled / Private / Disabled)
                                    |      ├── Repository & Commits (Enabled / Private / Disabled)
                                    |      ├── CI/CD Pipelines (Enabled / Private / Disabled)
                                    |      ├── Wiki (Enabled / Private / Disabled)
                                    |      ├── Snippets (Enabled / Private / Disabled)
                                    |      ├── Package Registry (Enabled / Private / Disabled)
                                    |      ├── Container Registry (Enabled / Private / Disabled)
                                    |      └── Releases (Enabled / Private / Disabled)
                                    |
                                    +---> [ Group Sharing / ProjectGroupLink ]
                                           (Shares project with external group with clamped max role)
```

### 3.2 Membership Resolution & Role Inheritance Algorithm
When evaluating a user's permissions on a project:
1. **Direct Membership**: Query `project.members.find_by(user_id: user.id)`.
2. **Inherited Group Membership**: Traverse ancestor groups from `project.group` up to the top-level root group. Compute the **highest** access level assigned to the user across any ancestor group.
3. **Shared Group Membership (`ProjectGroupLink` / `GroupGroupLink`)**:
   - If the project is shared with a group where the user is a member, compute:
     $$\text{Effective Access} = \min(\text{User Role in Shared Group}, \text{GroupLink.group_access})$$
4. **Combined Access Level**:
   $$\text{Final Access Level} = \max(\text{Direct Membership}, \text{Inherited Ancestor Roles}, \text{Effective Shared Roles})$$
5. **Project Feature Override**:
   - Even if Final Access Level is Developer (30), if a feature (e.g., Issues) is set to `ProjectFeature::DISABLED`, access is DENIED.
   - If a feature is set to `ProjectFeature::PRIVATE`, non-members and Guests are denied repository/code access, and only users with access level $\ge \text{REPORTER}$ (or $\ge \text{DEVELOPER}$) may view/contribute.

---

## 4. Token & Identity Surface

GitLab CE manages a broad ecosystem of tokens and authentication credentials. Each token exhibits distinct scopes, lifecycles, and security boundaries:

```
+---------------------------------------------------------------------------------------+
|                                    GITLAB CE IDENTITY POOL                            |
+------------------------------------+--------------------------------------------------+
| USER-BOUND IDENTITIES              | RESOURCE-BOUND / BOT IDENTITIES                  |
+------------------------------------+--------------------------------------------------+
| - Personal Access Tokens (PAT)     | - Project Access Tokens (Project Bot User)       |
| - Impersonation Tokens             | - Group Access Tokens (Group Bot User)           |
| - OAuth2 Access Tokens             | - CI_JOB_TOKEN (Ephemeral Pipeline JWT)          |
| - Web UI Session Cookie            | - Deploy Tokens (Project/Group Auth Pair)        |
|                                    | - Deploy Keys (SSH Public Key Pair)              |
|                                    | - Pipeline Trigger Tokens                        |
|                                    | - Runner Authentication Tokens (glrt-*)          |
+------------------------------------+--------------------------------------------------+
```

### 4.1 Granular Token Taxonomy & Scope Capabilities

| Token Type | Bound Identity | Max Lifetime | Supported Scopes | Access Boundary | Security Risk / Vulnerability Vectors |
|---|---|---|---|---|---|
| **Personal Access Token (PAT)** | User account | Configurable (Max 365d default) | `api`, `read_api`, `read_user`, `read_repository`, `write_repository`, `read_registry`, `write_registry`, `sudo`, `admin_mode` | Full user permission space intersection with token scopes | Scope escalation via un-scoped endpoints; token leakage in developer logs |
| **Project Access Token** | Project Bot (`User.project_bot`) | Configurable (Max 365d) | `api`, `read_api`, `read_repository`, `write_repository`, `read_registry`, `write_registry` | Strictly bounded to target project (Guest to Maintainer/Owner) | Cross-project privilege confusion if bot user is shared or added to groups |
| **Group Access Token** | Group Bot (`User.project_bot`) | Configurable (Max 365d) | `api`, `read_api`, `read_repository`, `write_repository`, `read_registry`, `write_registry` | Bounded to parent group and all descendant subgroups/projects | Broad blast radius across large group trees |
| **CI_JOB_TOKEN** | Ephemeral job execution | Pipeline job runtime duration | Restricted API set (artifacts, packages, containers, git clone) | Default: current project. Cross-project: gated by Inbound Allowlist | Cross-project token leakage, job token scope bypass, unintended API endpoint access |
| **Deploy Token** | Non-user entity (`deploy_tokens` table) | Configurable / Indefinite | `read_repository`, `read_registry`, `write_registry`, `read_package_registry`, `write_package_registry` | Project or Group repository/registry only | Inability to attribute git pushes to human authors |
| **Deploy Key** | SSH Key Pair | Indefinite | Read-only or Read-Write Git over SSH | Project repository (can be shared across projects) | Cross-project git commit forgery; SSH key sprawl |
| **Trigger Token** | Project CI pipeline trigger | Indefinite | Pipeline creation only | `POST /projects/:id/trigger/pipeline` | Unauthenticated pipeline triggering and resource exhaustion |
| **Runner Auth Token** | GitLab Runner (`glrt-*`) | Indefinite / Rotatable | Job request, trace update, artifact upload | Project, Group, or Instance runner queue | Runner registration forgery, rogue worker job interception |
| **Impersonation Token** | Target User (Created by Admin) | Configurable | `api`, `read_api`, `read_user`, `read_repository`, `write_repository` | Acts as target user; ignores Admin Mode requirement | Bypasses admin 2FA / admin re-authentication controls |
| **OAuth2 Token** | User + Application | Standard OAuth TTL | Standard Doorkeeper OAuth scopes | Standard user authorization intersection | Refresh token hijacking; redirect URI manipulation |

### 4.2 CI_JOB_TOKEN Security Architecture & Allowlist Enforcement
- The `CI_JOB_TOKEN` is injected as a short-lived credential during GitLab CI/CD runner job execution.
- **The Allowlist Gate (`job_token_scope`)**:
  - By default, a `CI_JOB_TOKEN` from Project A attempting to access Project B's API/artifacts is rejected.
  - Project B must explicitly configure an **Inbound Job Token Scope Allowlist** adding Project A (`POST /projects/:id/job_token_scope/allowlist/inbound`).
  - Outbound scope controls are deprecated in modern GitLab CE in favor of strict inbound authorization enforcement.

---

## 5. Multi-Interface Surface & Differential Vectors

GitLab CE exposes capabilities through four distinct entry interfaces. Each interface implements its own authentication, parameter validation, and authorization wiring:

```
                                  [ INCOMING REQUEST / EVENT ]
                                                |
        +-----------------------+---------------+-----------------------+
        |                       |                               |       |
        v                       v                               v       v
+---------------+       +---------------+               +---------------+ +---------------+
| UI Controller |       | REST API      |               | GraphQL API   | | Sidekiq Worker|
| (ActionPack)  |       | (Grape API)   |               | (GraphQL-Ruby)| | (Sidekiq / RB)|
+-------+-------+       +-------+-------+               +-------+-------+ +-------+-------+
        |                       |                               |                 |
        v                       v                               v                 v
[before_action Filters] [authenticate! helper]          [BaseResolver auth] [Async execution]
        |                       |                               |                 |
        +-----------------------+---------------+---------------+                 |
                                |                                                 |
                                v                                                 v
                     +--------------------+                             +-------------------+
                     | DeclarativePolicy  |                             | TOCTOU Vulnerable |
                     | Ability.allowed?   |                             | Often missing or  |
                     +--------------------+                             | elevated context  |
```

### 5.1 Interface Architecture Breakdown

1. **UI Controllers (`app/controllers/`)**:
   - Rails ActionControllers utilize `before_action :authenticate_user!` and helper methods (`authorize_read_project!`, `authorize_admin_project!`).
   - Uses `can?(current_user, :ability, subject)` in view templates (`app/views/`) to selectively render UI controls.
   - Strong parameters (`params.require(...).permit(...)`) sanitize input payload.

2. **REST API (`lib/api/`)**:
   - Implemented via the **Grape** framework.
   - Authentication helpers (`authenticate!`, `find_project!`) establish `@current_user` and `@project`.
   - Authorization helpers (`authorize! :ability, subject`) raise HTTP 403 / 404 on policy failure.
   - Declared parameter validations (`params do ... requires ... end`).

3. **GraphQL API (`app/graphql/`)**:
   - Implemented via `graphql-ruby`.
   - Authorization is configured at three discrete layers:
     * **Type-level**: `authorize :read_project`
     * **Field-level**: `authorize :admin_merge_request`
     * **Resolver/Mutation-level**: `authorized_find_object` pattern.
   - **GraphQL Redaction Mechanism**: If a user lacks permission for an object in a collection, the GraphQL engine silently redacts the record or returns `null` rather than failing the entire query.

4. **Sidekiq Background Workers (`app/workers/`)**:
   - Asynchronous jobs triggered by events (e.g., project destruction, repository import, merge request pipeline scheduling).
   - Workers accept primitive identifiers (e.g., `project_id`, `user_id`) from Redis job queues.
   - Workers often run with **system-level privileges** or re-instantiate user context without invoking the full controller authorization pipeline.

---

### 5.2 Multi-Interface Differential Attack Vectors

The existence of 4 independent interface entry points creates fertile ground for authorization drift and security differentials:

```
+----------------------------------------------------------------------------------------------------+
|                               MULTI-INTERFACE DIFFERENTIAL VECTORS                                 |
+-------------------+--------------------------------------------------------------------------------+
| Vector ID         | Architectural Differential Mechanism                                           |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-01       | REST vs GraphQL Redaction Discrepancy                                         |
|                   | REST endpoint denies entire resource (404/403); GraphQL field resolver exposes  |
|                   | child metadata (IDs, counts, timestamps) due to missing field-level authorize.  |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-02       | UI Controller vs Background Worker TOCTOU Authorization Omission              |
|                   | Controller checks user permissions before enqueuing Sidekiq job; worker         |
|                   | executes asynchronously without re-validating if user was demoted/removed.     |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-03       | Token Scope Enforcement Asymmetry                                              |
|                   | REST endpoint enforces `read_repository` scope; corresponding GraphQL query     |
|                   | or internal Grape helper accepts generic `read_api` token scope.               |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-04       | Project Feature Isolation Leakage                                              |
|                   | Project feature (e.g., Wiki, Snippets) is set to DISABLED/PRIVATE; GraphQL       |
|                   | search/finder or REST export endpoint bypasses project_feature check.           |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-05       | Group Sharing Max Access Level Clamping Bypass                                 |
|                   | Group link clamps max access to Reporter (20); GraphQL mutation or API action  |
|                   | evaluates raw user role in source group (Developer 30) instead of clamped role.|
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-06       | External User Internal Namespace Exposure                                      |
|                   | External user (`user.external?`) prevented in UI/REST from viewing internal     |
|                   | projects; GraphQL autocomplete or public snippet finder leaks internal objects.|
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-07       | Admin Mode Gating Asymmetry                                                    |
|                   | UI requires explicit Admin Mode step-up authentication; REST API or PAT with   |
|                   | `admin_mode` scope allows immediate execution without re-authentication.       |
+-------------------+--------------------------------------------------------------------------------+
```

---

## 6. Structural Blueprint for `GITLAB_AUTHORIZATION_MODEL.md`

To serve as the definitive reference specification for the GitLab CE research lab, `GITLAB_AUTHORIZATION_MODEL.md` must be constructed following this standardized 8-section structural blueprint:

### Blueprint Outline

1. **Title & Document Metadata**:
   - Scope, target version, authoring date, architecture revision.
2. **DeclarativePolicy Formal Specification**:
   - Ruby DSL syntax, condition graph resolution, evaluation algorithm, caching mechanics, rule precedence (`prevent` overrides `enable`).
3. **The 7-Role Hierarchical Permission Matrix**:
   - Exhaustive breakdown of all $\sim 80$ discrete GitLab CE abilities categorized by domain (Instance, Group, Project, Code, Issues/MRs, CI/CD, Registry, Security/Compliance).
4. **Resource & Container Hierarchy**:
   - Mathematical model for membership calculation: Direct vs Inherited vs Shared roles; ProjectFeature states (`ENABLED`, `PRIVATE`, `DISABLED`).
5. **Token, Secret & Identity Authentication Surface**:
   - Detailed specification of all 10 token types, scopes, database storage models, expiration behaviors, and `CI_JOB_TOKEN` allowlist mechanics.
6. **Multi-Interface Architecture & Enforcement Points**:
   - Code-level mapping of authorization entry points across `app/controllers/`, `lib/api/`, `app/graphql/`, and `app/workers/`.
7. **Differential Authorization Failure Taxonomy**:
   - Concrete vulnerability patterns: BOLA/IDOR, BFLA, TOCTOU in Sidekiq, GraphQL leaks, Token Scope bypasses, and Group Link clamping failures.
8. **Automated Verification & Negative Control Test Protocol**:
   - Formal test fixtures and differential test assertions to validate authorization boundaries in local GDK environment.

---

## 7. Conclusion & Next Steps
This architectural analysis provides the necessary foundational rigor to document `GITLAB_AUTHORIZATION_MODEL.md` and equip downstream workers, verifiers, and challengers to design high-impact, novel vulnerability research hypotheses against GitLab CE.

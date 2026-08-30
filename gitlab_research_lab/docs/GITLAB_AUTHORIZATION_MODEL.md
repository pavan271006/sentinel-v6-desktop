# GitLab Community Edition: Authorization & Security Model Specification

- **Target Distribution**: GitLab Community Edition (CE) `v17.3.0` (`gitlab/gitlab-ce:17.3.0-ce.0`)
- **Core Authorization Engine**: `DeclarativePolicy` DSL (`app/policies/`)
- **Runtime Environment**: Ruby 3.2.4 on Rails 7.0.8.4
- **Security Boundary**: Multi-Tenant Group, Subgroup, Project, Feature, CI/CD, and Identity Hierarchy
- **Classification**: Authoritative Security Architecture & Research Model Specification

---

## Executive Summary

GitLab Community Edition (CE) implements a sophisticated, graph-driven authorization architecture designed to govern access across multi-tenant container hierarchies, diverse authentication tokens, and multiple API surfaces (REST, GraphQL, UI Controllers, and Sidekiq Workers). This document provides the definitive, mathematically rigorous reconstruction of GitLab CE's authorization and security model for the GitLab Security Research Lab.

The model is decomposed into five core pillars:
1. **DeclarativePolicy DSL & Graph Engine**: Rule evaluation DAGs, condition cost scoring, short-circuit optimization, rule combination operators, irrevocable prevention overrides, ability delegation, and request-scoped caching.
2. **7-Role Hierarchical Permission Matrix**: Granular mapping across 8 functional domains covering Admin (60), Owner (50), Maintainer (40), Developer (30), Reporter (20), Guest (10), External User, and Anonymous (0).
3. **Resource & Container Hierarchy**: Mathematical membership resolution algorithms across Namespaces, Groups, Subgroups, Projects, Project Features (`ENABLED`, `PRIVATE`, `DISABLED`), and `ProjectGroupLink` max access clamping.
4. **Token Taxonomy & Identity Surface**: Classification of 10 distinct token types, database storage models, cryptographic protections, scope boundaries, and `CI_JOB_TOKEN` inbound allowlist gates.
5. **Multi-Interface Surface & Differential Vectors**: Architectural analysis of UI Controllers, Grape REST APIs, GraphQL Resolvers, and Sidekiq Workers, establishing 7 differential vulnerability vectors (BOLA, BFLA, TOCTOU, and token scope drift).

---

## 1. DeclarativePolicy DSL & Policy Graph Engine (`app/policies/`)

### 1.1 Architecture & Design Philosophy

GitLab decouples authorization logic entirely from controller and business domain logic using the `declarative_policy` Ruby framework (`app/policies/base_policy.rb`). Authorization decisions are modeled as a **Directed Acyclic Graph (DAG)** of conditions, abilities, and rule transformations evaluated over a discrete tuple:

$$\text{Decision} = \text{EvaluatePolicy}(\text{Actor } u, \text{Subject } s, \text{Ability } a)$$

```
                         +-----------------------------------+
                         |           Actor (User u)          |
                         |        Subject (Resource s)       |
                         |        Requested Ability (a)      |
                         +-----------------+-----------------+
                                           |
                                           v
                        +------------------------------------+
                        |       Policy Class Resolution      |
                        |      (e.g., ProjectPolicy)         |
                        +------------------+-----------------+
                                           |
                +--------------------------+--------------------------+
                |                                                     |
                v                                                     v
+-------------------------------+             +-------------------------------+
|     Condition Evaluation      |             |       Rule Tree Evaluation    |
| - Predicate Cache Lookup      |             | - Composite Expressions       |
| - Cost-Scored Ordering (0..N) |             |   (&, |, ~)                   |
| - Short-Circuit Execution     |             | - Ability Enables             |
| - Scope Binding               |             | - Irrevocable Prevents        |
+---------------+---------------+             +---------------+---------------+
                |                                             |
                +----------------------+----------------------+
                                       |
                                       v
                    +------------------------------------+
                    | DeclarativePolicy Graph Solver     |
                    |                                    |
                    | Invariant:                         |
                    | Allowed = (Enables >= 1) AND       |
                    |           (Prevents == 0)          |
                    +------------------+-----------------+
                                       |
                         +-------------+-------------+
                         |                           |
                         v                           v
                  [ ALLOW (true) ]            [ DENY (false) ]
```

### 1.2 DeclarativePolicy DSL Primitives

A GitLab policy class consists of four fundamental DSL constructs:

#### 1. Conditions (`condition(...) { ... }`)
Conditions are pure boolean predicates evaluated within the context of `@user` (the actor) and `@subject` (the target resource). Each condition is configured with execution metadata:
- `scope`: Specifies cache granularity (`:user`, `:subject`, `:global`, or default `nil`).
- `score`: An integer cost estimate used by the optimizer to order condition execution.

```ruby
class ProjectPolicy < BasePolicy
  desc "Project is public"
  condition(:is_public, scope: :subject, score: 0) { @subject.public? }

  desc "User is member of project team"
  condition(:is_member, score: 2) { @subject.team.member?(@user) }

  desc "User has developer role or higher"
  condition(:developer_access, score: 2) { @subject.team.developer?(@user) }

  desc "Project is archived"
  condition(:is_archived, scope: :subject, score: 0) { @subject.archived? }

  desc "Issues feature is enabled"
  condition(:issues_enabled, scope: :subject, score: 0) do
    @subject.feature_available?(:issues, @user)
  end
end
```

#### 2. Rules (`rule { <expression> }.enable / .prevent`)
Rules bind boolean combinations of conditions to granular abilities:
- `.enable(*abilities)`: Grants the specified abilities if the condition expression evaluates to `true`.
- `.prevent(*abilities)`: Irrevocably forbids the specified abilities if the condition expression evaluates to `true`.
- `.prevent_all(except: [...])`: Irrevocably forbids all abilities declared in this policy and inherited policies, with optional whitelisted exceptions.

```ruby
# Enable rules
rule { is_public }.enable :read_project
rule { is_member & developer_access }.enable :push_code
rule { issues_enabled & (is_public | is_member) }.enable :read_issue

# Prevent rules
rule { is_archived }.prevent :push_code
rule { ~is_public & ~is_member }.prevent_all(except: [:read_project_for_banned_user])
```

#### 3. Delegation (`delegate { <parent_subject> }`)
Policies delegate unresolved abilities to related container subjects in the hierarchy. If the delegated subject is `nil`, the engine executes a fail-safe denial.

```ruby
class ProjectPolicy < BasePolicy
  # Delegate group-level abilities to parent Group
  delegate { @subject.group }

  # Delegate namespace-level abilities to parent Namespace
  delegate { @subject.namespace }
end
```

#### 4. Ability Inheritance Graph
GitLab organizes policy classes into a hierarchical inheritance tree. Sub-resource policies inherit conditions and rules from their parent container policies:

```
                  +--------------------------------+
                  |          GlobalPolicy          |
                  |  (System-wide Admin abilities) |
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |           BasePolicy           |
                  |    (Core user/subject logic)   |
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |          GroupPolicy           |
                  |   (Group & Namespace abilities)|
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |         ProjectPolicy          |
                  |     (Project-level abilities)  |
                  +---------------+----------------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
+-----------------------+ +-----------------------+ +-----------------------+
|      IssuePolicy      | |  MergeRequestPolicy   | |     SnippetPolicy     |
| (Issue-level actions) | | (MR-level actions)    | | (Snippet-level actions|
+-----------------------+ +-----------------------+ +-----------------------+
```

### 1.3 Condition Scoring and Short-Circuit Optimization

Conditions declare an integer `score` that reflects computational complexity:

| Condition Score | Complexity Tier | Execution Characteristics | Example Operations |
|---|---|---|---|
| `score: 0` | **In-Memory Property** | Instantaneous memory read; 0 DB queries | `@subject.public?`, `@subject.archived?`, `@user.nil?`, `@user.admin?` |
| `score: 1` | **Preloaded Association** | Memory read on preloaded ActiveRecord associations | `@subject.project_feature.issues_access_level` |
| `score: 2` | **Indexed DB Query** | Single-row indexed lookup in PostgreSQL | `@subject.team.member?(@user)`, `ProjectGroupLink.exists?` |
| `score: 5` | **Multi-Row DB Query** | Recursive CTE or multi-table join | Ancestor group hierarchy traversal, inherited role search |
| `score: 10+` | **Expensive Query / External** | Heavy table scans, Gitaly RPC, or external auth | Protected branch matching against regex patterns, LDAP checks |

**Short-Circuit Execution Rule**:
When evaluating a composite rule `rule { cond_a & cond_b }`, the engine sorts conditions by `score` ascending:
1. `cond_a` (`score: 0`) is evaluated first.
2. If `cond_a == false`, the engine immediately short-circuits and evaluates the rule to `false`.
3. `cond_b` (`score: 10`) is **never executed**, completely eliminating unnecessary database queries, Gitaly RPC overhead, and timing side-channel attack vectors.

### 1.4 The Unconditional Override Precedence Invariant

$$\forall u, s, a: \quad \text{Allowed}(u, s, a) = \Big(\bigvee_{r \in \text{Enables}(a)} \text{Eval}(r, u, s)\Big) \land \neg \Big(\bigvee_{p \in \text{Prevents}(a)} \text{Eval}(p, u, s)\Big)$$

**Invariant Property**: An active `prevent` rule unconditionally negates all `enable` rules for that ability across the entire resolution DAG. No number of `enable` rules (even from Admin or Owner roles) can override an active `prevent` rule.

*Example*: If a project is archived (`is_archived == true`), the rule `rule { is_archived }.prevent :push_code` unconditionally prevents code pushes for all users, including Project Maintainers, Owners, and Instance Administrators.

### 1.5 Runtime Caching Mechanics (`DeclarativePolicy::Cache`)

To ensure high performance under high-throughput request loads:
1. **Request-Scoped Condition Cache**: Condition evaluations are cached in memory for the duration of the current HTTP request or Sidekiq job execution, keyed by `[condition_name, user_id, subject_id]`.
2. **Subject Cache Invalidation**: If a subject's state is mutated during request processing (e.g., project visibility updated), the cache for that subject tuple must be explicitly invalidated via `DeclarativePolicy::Cache.clear!`.
3. **Memory Footprint Bound**: Caches are bound to the lifecycle of the Puma thread or Sidekiq worker, preventing cross-request memory leakage and stale authorization states across requests.

### 1.6 Invocation & Helper Integration

Authorization checks throughout the GitLab codebase converge on `Ability.allowed?`:

```ruby
# Direct engine invocation
Ability.allowed?(current_user, :read_project, @project)

# Controller / View helper (via Gitlab::Allowable)
can?(current_user, :read_project, @project)

# Grape REST API helper
authorize! :read_project, @project

# GraphQL field / resolver declaration
authorize :read_project
```

---

## 2. Comprehensive 7-Role Hierarchical Permission Matrix

GitLab CE maps roles to strict numerical access levels defined in `Gitlab::Access`:

```
Access Level 0  : NO_ACCESS / Anonymous (Unauthenticated)
Access Level 5  : MINIMAL_ACCESS (Group listing without project access)
Access Level 10 : GUEST
Access Level 20 : REPORTER
Access Level 30 : DEVELOPER
Access Level 40 : MAINTAINER (formerly Master)
Access Level 50 : OWNER
Access Level 60 : ADMIN (Instance Administrator with Admin Mode)
Special Flag    : EXTERNAL USER (Boolean flag user.external?)
```

### 2.1 Complete 7-Role Permission Matrix across 8 Functional Domains

| Permission Domain & Capability | Admin (60) | Owner (50) | Maintainer (40) | Developer (30) | Reporter (20) | Guest (10) | External (30) | Anonymous (0) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. Instance Administration** |
| Access Admin Area (`/admin`) | ✅ (Admin Mode) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Instance Settings | ✅ (Admin Mode) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Impersonate Users | ✅ (Admin Mode) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View System Dashboard & Logs | ✅ (Admin Mode) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage System Hooks | ✅ (Admin Mode) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Top-Level Groups | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (Restricted) | ❌ |
| **2. Group Management** |
| Delete Group | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer Group | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Group Members & Roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Group Access Tokens | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Subgroups | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Projects in Group | ✅ | ✅ | ✅ | ✅ (if enabled) | ❌ | ❌ | ❌ | ❌ |
| Edit Group Settings & Badges | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Group CI/CD Runners | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **3. Project Management** |
| Delete Project | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer Project Namespace | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Archive / Unarchive Project | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Project Members & Roles | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Project Access Tokens | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure Protected Branches & Tags| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure CI/CD Runners & Vars | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure Webhooks & Integrations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change Project Visibility Level | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **4. Repository & Code Operations** |
| Force Push to Protected Branch | ✅ (Configured) | ✅ (Configured) | ✅ (Configured) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Push to Protected Branch | ✅ | ✅ | ✅ | ✅ (if allowed) | ❌ | ❌ | ❌ | ❌ |
| Push to Unprotected Branch | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (if member) | ❌ |
| Create / Edit Merge Requests | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (if member) | ❌ |
| Merge Approved MRs to Protected | ✅ | ✅ | ✅ | ✅ (if allowed) | ❌ | ❌ | ❌ | ❌ |
| Clone / Pull Code (Private Proj)| ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Clone / Pull Code (Public Proj) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Commit History & Blame | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private) | ❌ (Private) | ✅ (Public) |
| Create / Delete Tags | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (if member) | ❌ |
| **5. Issue & Planning Operations** |
| Manage Issue Boards & Milestones | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create & Edit Own Issues | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Public) |
| Edit Any Issue | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Close / Reopen Any Issue | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Issue | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Confidential Issues | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Unless author)| ❌ (Unless author)| ❌ |
| Add Comments / Emoji Reactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Public) |
| Assign / Reassign Issues | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **6. CI/CD Pipeline Operations** |
| Run Manual Pipeline Jobs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cancel / Retry Pipeline Jobs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View CI/CD Job Logs & Artifacts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private) | ❌ (Private) | ✅ (Public) |
| Download CI/CD Job Artifacts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Private) | ❌ (Private) | ✅ (Public) |
| View Masked / Protected CI Vars | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Trigger Pipeline via Webhook/API | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Erase Job Trace / Logs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **7. Package & Container Registry** |
| Push / Delete Container Images | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pull Container Images (Private) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pull Container Images (Public) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Publish Package (NPM, PyPI, etc)| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Package | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **8. Releases, Snippets & Security** |
| Create / Edit Project Releases | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Project Releases | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Public) |
| Create Project Snippets | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Personal Snippets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Restricted) | ❌ |
| View Internal Visibility Projects| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Denied) | ❌ (Denied) |
| Export Project Data | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 2.2 External Users (`user.external?`) Security Invariant

External users represent contractors, external auditors, or untrusted third parties. GitLab CE enforces two strict security invariants for external users:

1. **Internal Visibility Deny Gate**:
   ```ruby
   condition(:external_user) { @user&.external? }
   rule { external_user & ~is_member }.prevent :read_internal_project
   ```
   External users are strictly forbidden from viewing or accessing projects and groups with `internal` visibility unless they have been explicitly added as a direct member of that project or group.

2. **Namespace & Snippet Restriction**:
   External users cannot create top-level groups or personal snippets unless explicitly granted by an instance administrator.

### 2.3 Admin Mode Step-Up Authentication Invariant

GitLab CE implements **Admin Mode** (`Gitlab::CurrentSettings.admin_mode`):
- Having `admin: true` in the database does NOT grant immediate superuser capabilities.
- An administrator must perform an explicit step-up authentication (re-authenticating password / 2FA) to activate a time-limited Admin Mode session.
- While Admin Mode is inactive, the user operates under normal project and group membership permissions.

---

## 3. Resource Hierarchy & Membership Inheritance Model

### 3.1 Container Architecture Diagram

```
[ Instance Root / Admin Context ]
          │
          ├───► [ User Namespaces (e.g., /users/alice) ]
          │            │
          │            ├───► [ Personal Projects ]
          │            └───► [ Personal Snippets ]
          │
          └───► [ Top-Level Groups (e.g., /gitlab-org) ]
                       │
                       ├───► [ Subgroups Level 1 (e.g., /gitlab-org/subgroup1) ]
                       │            │
                       │            ├───► [ Subgroups Level 2... (up to max nesting depth) ]
                       │            └───► [ Projects (e.g., /gitlab-org/subgroup1/project-b) ]
                       │
                       └───► [ Projects (e.g., /gitlab-org/project-a) ]
                                    │
                                    ├───► [ Project Features ]
                                    │      ├── Repository & Commits (ENABLED / PRIVATE / DISABLED)
                                    │      ├── Issues (ENABLED / PRIVATE / DISABLED)
                                    │      ├── Merge Requests (ENABLED / PRIVATE / DISABLED)
                                    │      ├── CI/CD Pipelines (ENABLED / PRIVATE / DISABLED)
                                    │      ├── Wiki (ENABLED / PRIVATE / DISABLED)
                                    │      ├── Snippets (ENABLED / PRIVATE / DISABLED)
                                    │      ├── Package Registry (ENABLED / PRIVATE / DISABLED)
                                    │      └── Container Registry (ENABLED / PRIVATE / DISABLED)
                                    │
                                    └───► [ ProjectGroupLink / Shared Groups ]
                                           (Shared with external group; clamped to max_access_level)
```

### 3.2 Mathematical Membership Resolution Algorithm

When evaluating the effective access level of a user $u$ on a target project $p$:

$$\text{EffectiveAccess}(u, p) = \max\Big(\text{Direct}(u, p),\, \text{AncestorGroup}(u, g_p),\, \text{SharedGroup}(u, p)\Big)$$

Where:
1. **Direct Membership**:
   $$\text{Direct}(u, p) = \text{Role}(u, p) \quad \text{or } 0 \text{ if not member}$$
2. **Inherited Ancestor Group Membership**:
   $$\text{AncestorGroup}(u, g_p) = \max_{a \in \text{Ancestors}(p)} \text{Role}(u, a)$$
3. **Shared Group Membership (`ProjectGroupLink`) Clamping**:
   If project $p$ is shared with group $G_s$ via a `ProjectGroupLink` having maximum allowed access level $L_{\text{max}}$:
   $$\text{SharedGroup}(u, p) = \max_{G_s \in \text{SharedGroups}(p)} \min\Big(\text{Role}(u, G_s),\, L_{\text{max}}(p, G_s)\Big)$$

#### Worked Example:
- User Alice has role **Owner (50)** in Group `Security-Team`.
- Project `Web-App` shares access with `Security-Team` via `ProjectGroupLink` with `group_access = 20` (Reporter).
- Alice has no direct membership in `Web-App`.
- Alice's effective access in `Web-App` is:
  $$\text{EffectiveAccess}(\text{Alice}, \text{Web-App}) = \min(50, 20) = 20 \text{ (Reporter)}$$
  Alice is strictly clamped to Reporter and cannot push code or modify project settings.

### 3.3 Project Feature Toggles Resolution

Each project maintains granular feature toggles (`app/models/project_feature.rb`):

| Feature State | Value | Authorization Behavior |
|---|:---:|---|
| `DISABLED` | `0` | **Unconditionally Denied**: All abilities associated with this feature are disabled for all users (including Project Owners and Admins). |
| `PRIVATE` | `10` | **Restricted to Members**: Non-members and Guests are denied repository and code access. Requires at least Reporter (20) or Developer (30). |
| `ENABLED` | `20` | **Inherits Project Visibility**: Accessible to everyone if public; accessible to logged-in users if internal; accessible to members if private. |

```ruby
# Evaluation logic in ProjectPolicy
rule { project_feature_disabled(:wiki) }.prevent :read_wiki, :create_wiki, :admin_wiki
rule { project_feature_private(:wiki) & ~reporter_access }.prevent :read_wiki
```

---

## 4. Complete 10-Token Taxonomy & Identity Surface

GitLab CE manages 10 distinct token types, partitioned into **User-Bound Identities** and **Resource-Bound / Bot Identities**:

```
+----------------------------------------------------------------------------------------------------+
|                                    GITLAB CE IDENTITY & TOKEN POOL                                 |
+------------------------------------+---------------------------------------------------------------+
| USER-BOUND IDENTITIES              | RESOURCE-BOUND / BOT IDENTITIES                               |
+------------------------------------+---------------------------------------------------------------+
| 1. Personal Access Tokens (PAT)    | 4. CI_JOB_TOKEN (Ephemeral Pipeline JWT)                      |
| 2. Impersonation Tokens            | 5. Project Access Tokens (Project Bot User)                   |
| 3. OAuth2 / OIDC Access Tokens     | 6. Group Access Tokens (Group Bot User)                       |
|                                    | 7. Deploy Tokens (Non-User Registry/Git Credential)           |
|                                    | 8. Deploy Keys (SSH Public Key Pair)                          |
|                                    | 9. Pipeline Trigger Tokens                                    |
|                                    | 10. Runner Authentication Tokens (glrt-*)                     |
+------------------------------------+---------------------------------------------------------------+
```

### 4.1 Granular Token Specification Matrix

| # | Token Type | Bound Identity | Max Lifetime | Supported Scopes | Storage Model | Security Boundary & Vulnerability Vectors |
|---|---|---|---|---|---|---|
| **1** | **Personal Access Token (PAT)** | User account | Configurable (Max 365d default) | `api`, `read_api`, `read_user`, `read_repository`, `write_repository`, `read_registry`, `write_registry`, `sudo`, `admin_mode` | SHA-256 digest in `personal_access_tokens.token_digest` | Bounded by user permissions $\cap$ token scopes. Token leakage in git logs; scope bypass via un-scoped endpoints. |
| **2** | **Project Access Token** | Project Bot (`User.project_bot`) | Configurable (Max 365d) | `api`, `read_api`, `read_repository`, `write_repository`, `read_registry`, `write_registry` | SHA-256 digest in `personal_access_tokens` linked to bot user | Strictly bounded to target project (Guest to Maintainer/Owner). Privilege escalation if bot is added to other groups. |
| **3** | **Group Access Token** | Group Bot (`User.project_bot`) | Configurable (Max 365d) | `api`, `read_api`, `read_repository`, `write_repository`, `read_registry`, `write_registry` | SHA-256 digest in `personal_access_tokens` linked to bot user | Bounded to parent group and all descendant subgroups/projects. Broad blast radius across entire namespace. |
| **4** | **CI_JOB_TOKEN** | Ephemeral CI Job Execution | Pipeline Job Runtime Duration | Restricted CI API subset (artifacts, packages, containers, git clone) | Ephemeral JWT signed by instance key | Cross-project token leakage; access to sibling projects gated strictly by Inbound Allowlist (`job_token_scope`). |
| **5** | **Deploy Token** | Non-user entity (`deploy_tokens` table) | Configurable / Indefinite | `read_repository`, `read_registry`, `write_registry`, `read_package_registry`, `write_package_registry` | Cleartext token hash / encrypted credentials | Project or Group repository and registry access only. Zero audit attribution to human authors. |
| **6** | **Deploy Key** | SSH Key Pair | Indefinite | Read-only or Read-Write Git over SSH | Public key in `keys` table; private key held by client | Project repository access; can be shared across multiple projects. SSH key sprawl and commit forgery. |
| **7** | **Trigger Token** | Pipeline Trigger Entity | Indefinite | Pipeline creation only | Encrypted token string in `ci_trigger_requests` | `POST /projects/:id/trigger/pipeline`. Unauthenticated pipeline triggering and resource exhaustion. |
| **8** | **Runner Auth Token** | GitLab Runner (`glrt-*`) | Indefinite / Rotatable | Job request, trace update, artifact upload | Hashed token in `ci_runners.token_digest` | Project, Group, or Instance runner queue. Runner registration forgery; malicious runner job interception. |
| **9** | **Impersonation Token** | Target User (Created by Admin) | Configurable | `api`, `read_api`, `read_user`, `read_repository`, `write_repository` | SHA-256 digest in `personal_access_tokens` with `impersonation: true` | Acts strictly as target user; ignores Admin Mode requirement. Bypasses admin 2FA and step-up auth. |
| **10** | **OAuth2 Access Token** | User + Application | Standard OAuth TTL | Doorkeeper OAuth scopes (`api`, `read_user`, `openid`, `profile`, `email`) | Hashed token in `oauth_access_tokens` | Standard user authorization intersection with OAuth scopes. Refresh token hijacking; redirect URI manipulation. |

### 4.2 CI_JOB_TOKEN Security Architecture & Allowlist Enforcement

The `CI_JOB_TOKEN` is injected into every CI runner job environment. Its security model operates under strict constraints:

1. **Job Scope Isolation**:
   - The token is valid **only while the job is in `running` status**. Once the job finishes (`success`, `failed`, `canceled`), the token is instantly invalidated.
2. **Inbound Job Token Scope Allowlist Gate**:
   - When a job running in Project A uses its `CI_JOB_TOKEN` to call the API of Project B:
     $$\text{Allowed}(A \to B) \iff A \in \text{InboundAllowlist}(B)$$
   - Project B must explicitly authorize Project A in its inbound job token scope setting (`POST /api/v4/projects/:id/job_token_scope/allowlist/inbound`).
   - If Project A is not on Project B's inbound allowlist, the request is rejected with `404 Not Found` (or `403 Forbidden`).

---

## 5. Multi-Interface Surface & Differential Vectors

GitLab CE exposes its business capabilities across four distinct interface layers:

```
                                  [ INCOMING REQUEST / EVENT ]
                                                │
        ┌───────────────────────┬───────────────┴───────────────┬───────────────────────┐
        │                       │                               │                       │
        ▼                       ▼                               ▼                       ▼
+---------------+       +---------------+               +---------------+       +---------------+
| UI Controller |       | REST API      |               | GraphQL API   |       | Sidekiq Worker|
| (ActionPack)  |       | (Grape API)   |               | (GraphQL-Ruby)|       | (Async Job)   |
+-------┬-------+       +-------┬-------+               +-------┬-------+       +-------┬-------+
        │                       │                               │                       │
        ▼                       ▼                               ▼                       ▼
[before_action Filters] [authenticate! helper]          [BaseResolver auth]     [Async execution]
        │                       │                               │                       │
        └───────────────────────┼───────────────────────────────┘                       │
                                │                                                       │
                                ▼                                                       ▼
                     +--------------------+                             +-------------------+
                     | DeclarativePolicy  |                             | TOCTOU Vulnerable |
                     | Ability.allowed?   |                             | Often missing or  |
                     +--------------------+                             | elevated context  |
```

### 5.1 Interface Architecture Breakdown

1. **UI Controllers (`app/controllers/`)**:
   - Utilizes Rails ActionController `before_action` filters (e.g., `authenticate_user!`, `authorize_read_project!`, `authorize_admin_project!`).
   - Uses `can?(current_user, :ability, subject)` in view templates (`app/views/`) to selectively render UI controls.
   - Strong parameters (`params.require(...).permit(...)`) sanitize input payload.

2. **REST API (`lib/api/`)**:
   - Implemented via the **Grape** framework under `/api/v4/`.
   - Authentication helpers (`authenticate!`, `find_project!`) establish `@current_user` and `@project`.
   - Authorization helpers (`authorize! :ability, subject`) raise HTTP 403 / 404 on policy failure.
   - Declared parameter validations (`params do ... requires ... end`).

3. **GraphQL API (`app/graphql/`)**:
   - Implemented via `graphql-ruby` under `/api/graphql`.
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

### 5.2 The 7 Differential Attack Vectors

Discrepancies in authorization wiring across these four interfaces yield fertile ground for security vulnerabilities:

```
+----------------------------------------------------------------------------------------------------+
|                               MULTI-INTERFACE DIFFERENTIAL VECTORS                                 |
+-------------------+--------------------------------------------------------------------------------+
| Vector ID         | Architectural Differential Mechanism                                           |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-01       | REST vs GraphQL Redaction Discrepancy (BOLA / Metadata Leakage)                |
|                   | REST endpoint denies entire resource (404/403); GraphQL field resolver exposes  |
|                   | child metadata (IDs, counts, timestamps) due to missing field-level authorize.  |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-02       | UI Controller vs Background Worker TOCTOU Authorization Omission              |
|                   | Controller checks user permissions before enqueuing Sidekiq job; worker         |
|                   | executes asynchronously without re-validating if user was demoted/removed.     |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-03       | Token Scope Enforcement Asymmetry (Privilege Escalation)                       |
|                   | REST endpoint enforces `read_repository` scope; corresponding GraphQL query     |
|                   | or internal Grape helper accepts generic `read_api` token scope.               |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-04       | Project Feature Isolation Leakage (BFLA on Disabled/Private Features)          |
|                   | Project feature (e.g., Wiki, Snippets) is set to DISABLED/PRIVATE; GraphQL       |
|                   | search/finder or REST export endpoint bypasses project_feature check.           |
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-05       | Group Sharing Max Access Level Clamping Bypass (Permission Elevation)          |
|                   | Group link clamps max access to Reporter (20); GraphQL mutation or API action  |
|                   | evaluates raw user role in source group (Developer 30) instead of clamped role.|
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-06       | External User Internal Namespace Exposure (Information Disclosure)             |
|                   | External user (`user.external?`) prevented in UI/REST from viewing internal     |
|                   | projects; GraphQL autocomplete or public snippet finder leaks internal objects.|
+-------------------+--------------------------------------------------------------------------------+
| DIFF-VEC-07       | Admin Mode Gating Asymmetry (Administrative Action Bypass)                     |
|                   | UI requires explicit Admin Mode step-up authentication; REST API or PAT with   |
|                   | `admin_mode` scope allows immediate execution without re-authentication.       |
+-------------------+--------------------------------------------------------------------------------+
```

#### Detailed Deep-Dive on Differential Vectors:

1. **DIFF-VEC-01: REST vs GraphQL Redaction Discrepancy**:
   - *Mechanism*: When querying a private sub-resource (e.g., confidential issue, private snippet), REST endpoint `GET /projects/:id/issues/:issue_id` executes `authorize! :read_issue, issue` and returns `404 Not Found`. However, a GraphQL query on `project(fullPath: ...) { issues { nodes { id title confidential } } }` may lack field-level `authorize :read_issue` on certain metadata fields, returning the confidential issue title or metadata masked only as partial nulls.
   - *Impact*: Broken Object Level Authorization (BOLA), metadata exposure of confidential planning data.

2. **DIFF-VEC-02: UI Controller vs Background Worker TOCTOU Omission**:
   - *Mechanism*: An action (e.g., triggering a project export or running a maintenance job) is initiated via UI Controller. The controller verifies that the user is a `Maintainer` and enqueues `ProjectExportWorker.perform_async(project_id, user_id)`. Before the Sidekiq worker pops the job from Redis, the user is removed from the project. The Sidekiq worker loads `User.find(user_id)` and generates the export without re-verifying `can?(user, :export_project, project)`.
   - *Impact*: Time-of-Check to Time-of-Use (TOCTOU) authorization bypass, unauthorized exfiltration of project archives.

3. **DIFF-VEC-03: Token Scope Enforcement Asymmetry**:
   - *Mechanism*: A Personal Access Token is issued with strict scope `read_repository`. The REST API endpoint `/api/v4/projects/:id/repository/tree` verifies `check_token_scope!(:read_repository)`. However, a GraphQL query executing `project(fullPath: ...) { repository { tree { blobs { nodes { name } } } } }` only verifies the global `api` or `read_api` token scope, allowing the restricted token to read repository contents through GraphQL.
   - *Impact*: Token scope confinement breakout, violation of least privilege.

4. **DIFF-VEC-04: Project Feature Isolation Leakage**:
   - *Mechanism*: A project administrator disables the Wiki feature (`project_feature.wiki_access_level = DISABLED`). The web UI hides the Wiki tab and routes return 404. However, the REST project export endpoint `/api/v4/projects/:id/export` or GraphQL project search includes wiki repository blobs in the generated archive.
   - *Impact*: Broken Function Level Authorization (BFLA), leakage of disabled feature data.

5. **DIFF-VEC-05: Group Sharing Max Access Level Clamping Bypass**:
   - *Mechanism*: A project is shared with Group A with `max_access_level = Reporter (20)`. A user who is an `Owner (50)` in Group A accesses the project. The UI correctly limits their actions to Reporter. However, a specific GraphQL mutation (e.g., `mergeRequestUpdate`) or API endpoint queries `project.group.members` directly without passing through `ProjectGroupLink` clamping logic, erroneously treating the user as an Owner/Developer.
   - *Impact*: Horizontal/Vertical privilege escalation in shared multi-tenant projects.

6. **DIFF-VEC-06: External User Internal Namespace Exposure**:
   - *Mechanism*: External users (`user.external == true`) are barred from internal visibility projects. However, global search endpoints (`/api/v4/search?scope=projects`) or GraphQL autocomplete resolvers query `Project.public_or_internal_only` without appending the `~user.external?` condition filter.
   - *Impact*: Sensitive internal project discovery and metadata leakage to untrusted third parties.

7. **DIFF-VEC-07: Admin Mode Gating Asymmetry**:
   - *Mechanism*: The Web UI enforces Admin Mode step-up authentication via session cookie validation before permitting destructive operations. However, an API client authenticating via PAT with `admin_mode` scope executes administrative mutations directly without triggering 2FA re-verification.
   - *Impact*: Administrative credential hijacking and step-up authentication bypass.

---

## 6. Formal Security Invariants

The GitLab CE authorization model enforces the following core security invariants:

- `INV-AUTH-01 (Policy Universality)`: Every state-changing mutation and sensitive data read in UI, REST, and GraphQL MUST resolve through `DeclarativePolicy` (`Ability.allowed?`).
- `INV-AUTH-02 (Prevent Primacy)`: Any active `prevent` rule in DeclarativePolicy unconditionally supersedes all `enable` rules across the entire resolution DAG.
- `INV-AUTH-03 (Feature Gating)`: A `ProjectFeature` state of `DISABLED` MUST unconditionally deny access to all users, regardless of assigned role or administrative status.
- `INV-AUTH-04 (Group Link Clamping)`: Access granted via `ProjectGroupLink` MUST NEVER exceed the configured `max_access_level`.
- `INV-AUTH-05 (External User Confinement)`: External users (`user.external?`) MUST NEVER access internal visibility projects or create top-level groups without explicit direct membership.
- `INV-AUTH-06 (CI Token Scoping)`: A `CI_JOB_TOKEN` MUST NEVER access sibling or parent projects unless the calling project is explicitly included on the target project's Inbound Allowlist.
- `INV-AUTH-07 (Worker Re-Authorization)`: Sidekiq background workers handling privileged operations MUST re-evaluate `Ability.allowed?` at execution time to prevent TOCTOU race conditions.
- `INV-AUTH-08 (Token Scope Intersection)`: Effective permissions for any token-authenticated request MUST be the strict intersection of user abilities and granted token scopes:
  $$\text{EffectivePerms}(\text{Token}) = \text{UserPerms}(\text{Actor}) \cap \text{GrantedScopes}(\text{Token})$$
- `INV-AUTH-09 (Admin Mode Isolation)`: Administrative privileges MUST NOT be granted to an administrator account unless an active Admin Mode session is verified.
- `INV-AUTH-10 (Impersonation Confinement)`: Impersonation tokens MUST execute strictly within the target user's permission boundary and MUST NOT inherit administrator capabilities.

---

## 7. Automated Verification & Test Suite Integration

The authorization model is validated deterministically against the Milestone 2 test suite located in `gitlab_research_lab/tests/test_m2_auth_model.py`.

### 7.1 Test Suite Coverage Matrix

| Test Suite Tier | Test Identifier | Architectural Invariant Verified |
|---|---|---|
| **Tier 1: Feature Coverage** | `test_t1_declarative_policy_dsl_primitives` | DeclarativePolicy DSL primitives (`condition`, `rule`, `enable`, `prevent`, `delegate`) |
| | `test_t1_declarative_policy_prevent_overrides_enable_invariant` | Invariant: `prevent` rule unconditionally negates all `enable` rules |
| | `test_t1_seven_role_access_level_ordering` | Strict numerical ordering of 7 core access levels ($0 < 5 < 10 < 20 < 30 < 40 < 50 < 60$) |
| | `test_t1_membership_resolution_math_model` | Mathematical formula for Direct, Ancestor, and Shared membership resolution |
| | `test_t1_token_taxonomy_ten_types_mapped` | Complete mapping and categorization of all 10 token types |
| | `test_t1_project_feature_toggles_resolution` | Project feature toggles (`ENABLED`, `PRIVATE`, `DISABLED`) access gating |
| **Tier 2: Boundary & Corner Cases** | `test_t2_project_group_link_max_access_level_clamping` | `ProjectGroupLink` max access level clamping boundary enforcement |
| | `test_t2_external_user_internal_project_deny_boundary` | External user internal project deny gate boundary |
| | `test_t2_disabled_feature_overrides_developer_privilege` | Disabled feature override over Developer privileges |
| | `test_t2_ci_job_token_cross_project_allowlist_gate` | `CI_JOB_TOKEN` cross-project inbound allowlist boundary check |
| | `test_t2_condition_score_short_circuit_cost_evaluation` | Low-score condition evaluation and short-circuit optimization |
| | `test_t2_impersonation_token_vs_admin_mode_boundary` | Impersonation token isolation without admin privilege bypass |
| **Tier 3: Pairwise Combinations** | `test_t3_pairwise_role_vs_feature_access_levels` | Pairwise combination: 7 roles $\times$ 3 project feature states |
| | `test_t3_pairwise_token_type_vs_supported_scopes` | Pairwise combination: token types $\times$ supported OAuth/API scopes |
| **Tier 4: Real-World Scenarios** | `test_t4_e2e_complex_membership_and_feature_evaluation_scenario` | End-to-end multi-tenant organization tree permission solver |

### 7.2 Execution & Verification Commands

```bash
# Run Milestone 2 Test Suite
python gitlab_research_lab/tests/test_m2_auth_model.py

# Run Master Research Lab E2E Test Suite
python gitlab_research_lab/tests/run_all_research_tests.py
```

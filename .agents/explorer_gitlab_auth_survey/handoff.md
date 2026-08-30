# Handoff Report: GitLab CE Authorization & Security Model Architecture

## 1. Observation
1. **Repository & Request Context**:
   - Original dispatch instruction: `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/ORIGINAL_REQUEST.md`.
   - Lab destination path: `c:/Users/Legion 5 pro/Desktop/cyber sec/gitlab_research_lab`.
   - Core research target: GitLab Community Edition (CE) authorization and security subsystem.
2. **DeclarativePolicy Subsystem**:
   - Primary DSL located in `app/policies/` and gem `declarative_policy`.
   - Entry point: `Ability.allowed?(user, ability, subject)` via `Gitlab::Allowable#can?`.
   - Core constructs: `condition`, `rule { ... }.enable`, `rule { ... }.prevent`, `prevent_all`, `delegate`, and `score`.
   - Precedence rule: Any active `prevent` rule unconditionally negates all `enable` rules for a given ability.
3. **Role & Container Structure**:
   - Access levels defined in `Gitlab::Access`: `NO_ACCESS` (0), `MINIMAL_ACCESS` (5), `GUEST` (10), `REPORTER` (20), `DEVELOPER` (30), `MAINTAINER` (40), `OWNER` (50).
   - Distinct statuses: `ADMIN` (with Admin Mode step-up gating) and `EXTERNAL USER` (`user.external?`).
   - Container hierarchy: Instance -> Namespace / Top-level Group -> Subgroups -> Projects -> Project Features (`ENABLED`, `PRIVATE`, `DISABLED`).
4. **Identity & Token Surface**:
   - User tokens: PAT, Impersonation Tokens, OAuth Tokens, Web Session Cookies.
   - Resource / Bot tokens: Project Access Tokens (`User.project_bot`), Group Access Tokens, CI_JOB_TOKEN (scoped via inbound allowlist), Deploy Tokens, Deploy Keys (SSH), Trigger Tokens, Runner Auth Tokens (`glrt-*`).
5. **Multi-Interface Surface**:
   - REST API (`lib/api/` via Grape): `authenticate!`, `authorize! :ability, subject`.
   - GraphQL API (`app/graphql/` via `graphql-ruby`): type/field authorization, `authorized_find_object`, collection redaction.
   - UI Controllers (`app/controllers/`): `before_action` filters, `can?` view helpers.
   - Sidekiq Workers (`app/workers/`): Asynchronous background execution, elevated system context vs user actor impersonation.

---

## 2. Logic Chain
1. **Unified Policy Engine with Fragmented Interface Gateways**:
   - *Observation*: While DeclarativePolicy provides a centralized, pure rule-graph engine in `app/policies/`, each interface (UI Controller, Grape REST, GraphQL Resolver, Sidekiq Worker) is responsible for invoking policy checks independently.
   - *Inference*: If a developer adds a new GraphQL field, REST parameter, or Sidekiq worker and omits an explicit `authorize!` or `authorized_find_object` call, the underlying DeclarativePolicy is never invoked, creating silent BOLA/BFLA vulnerabilities.
2. **Asymmetric Redaction and TOCTOU Vulnerabilities**:
   - *Observation*: GraphQL redacts unauthorized records by returning `null` or empty lists, while REST returns 404/403. Sidekiq workers receive primitive database IDs (`project_id`, `user_id`) from Redis queues and execute after a time delay.
   - *Inference*: If a user's role is demoted or revoked between job enqueuing and worker execution, background workers that assume prior controller authorization will execute state mutations under stale/elevated permissions (TOCTOU).
3. **Group Sharing & Feature Isolation Complexity**:
   - *Observation*: Projects inherit permissions from ancestor groups, direct membership, and `ProjectGroupLink` shared groups (which clamp max access levels). Furthermore, each project feature (Wiki, Issues, Registry) can be set to `PRIVATE` or `DISABLED`.
   - *Inference*: Any finder or resolver that queries database tables directly without passing through `project_feature.available?` or `ProjectPolicy` risks leaking private/disabled feature data to lower-privileged or external users.

---

## 3. Caveats
- **Local GDK Environment**: This survey documents the architectural mechanics of GitLab CE. Real-time dynamic execution of test scripts requires a functioning GDK / Rails environment or unit test runner.
- **Enterprise Edition (EE) vs CE**: This investigation strictly targets GitLab Community Edition (CE) features, omitting EE-only constructs (e.g., custom roles, SAML group sync, compliance frameworks).
- **Scope Limit**: No modifications were made to Sentinel V6 source files or workspace code outside this agent's directory.

---

## 4. Conclusion
The GitLab CE authorization architecture has been thoroughly mapped across all 5 dimensions. Complete architectural specifications, permission matrices, token taxonomies, and multi-interface differential attack vectors have been compiled in `analysis.md`. This provides the complete blueprint required to construct `GITLAB_AUTHORIZATION_MODEL.md`.

---

## 5. Verification Method
1. **DeclarativePolicy Verification**:
   - Inspect policy evaluation in Rails console:
     ```ruby
     user = User.find_by_username('reporter_user')
     project = Project.find_by_full_path('group/project')
     Ability.allowed?(user, :download_code, project) # should return true
     Ability.allowed?(user, :push_code, project)     # should return false
     ```
2. **Multi-Interface Differential Assertions**:
   - Execute parallel HTTP requests across REST and GraphQL for disabled features:
     - REST: `GET /api/v4/projects/:id/issues`
     - GraphQL: `query { project(fullPath: "...") { issues { nodes { id title } } } }`
   - Assert consistent 403/empty redaction when `project.project_feature.issues_access_level = ProjectFeature::DISABLED`.
3. **Review Artifacts**:
   - Analysis: `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_gitlab_auth_survey/analysis.md`
   - Dispatch Log: `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_gitlab_auth_survey/DISPATCH.md`
   - Working Memory: `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_gitlab_auth_survey/BRIEFING.md`

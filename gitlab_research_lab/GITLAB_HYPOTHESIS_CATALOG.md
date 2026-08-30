# GitLab Community Edition: Formal Security Hypothesis Catalog

- **Target Distribution**: GitLab Community Edition (CE) `v17.3.0` (`gitlab/gitlab-ce:17.3.0-ce.0`)
- **Runtime Environment**: Ruby 3.2.4 on Rails 7.0.8.4
- **Verification Engine**: Clean-Room Dual-Role Independent Verifier (`gitlab_research_lab/verifier/`)
- **Total Hypotheses**: 5 Formal Flaw Categories (H1 to H5)
- **Status**: Authoritative Security Research Specification & Verification Blueprint

---

## Executive Summary

This catalog formalizes five core security research hypotheses formulated against GitLab Community Edition (CE) `v17.3.0`. Each hypothesis targets a fundamental access control boundary, state synchronization mechanism, token lifecycle gate, or parser boundary identified during the architectural and differential audits of GitLab's codebase.

To maintain absolute scientific rigor and eliminate false positives, all hypotheses are governed by the **Dual-Role Clean-Room Verification Protocol**:
1. **Hypothesis Formulation**: The vulnerability research role specifies abstract mutation parameters, affected interfaces, mathematical invariant bounds, and precondition requirements.
2. **Independent Verification Gate**: The verification role executes positive reproduction against isolated test fixtures and evaluates negative controls against hardened baselines without sharing private researcher sessions or subjective heuristics.
3. **Cryptographic CAS Sealing**: Every test execution trace, raw request, and raw response is permanently recorded in Content-Addressable Storage (CAS) with verifiable SHA-256 digests.

---

## 1. Formal Hypothesis Matrix

| ID | Title | Category | Primary Attack Surface | Mathematical Invariant | CWE | Target Severity |
|---|---|---|---|---|---|---|
| **H1** | GraphQL vs REST Authorization Asymmetry on Project Export | `AUTHORIZATION_ASYMMETRY` | `app/graphql/resolvers/` vs `lib/api/projects.rb` | $\forall u, \text{CanExport}(u, P) \iff \text{Role}(u, P) \ge \text{Maintainer (40)}$ | CWE-285 | **HIGH (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N - 6.5)** |
| **H2** | CI_JOB_TOKEN Cross-Project Inbound Allowlist Bypass | `TOKEN_SCOPE_CONFUSION` | `lib/api/ci/jobs.rb`, `app/models/ci/job_token/scope.rb` | $\text{Access}(J, P_{\text{target}}) \iff (P_{\text{origin}} = P_{\text{target}}) \lor (P_{\text{origin}} \in \text{Allowlist}(P_{\text{target}}))$ | CWE-284 | **CRITICAL (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N - 8.5)** |
| **H3** | ProjectGroupLink Access Level Escalation via Group Transfer | `POLICY_INHERITANCE` | `app/services/projects/transfer_service.rb`, `app/policies/project_policy.rb` | $\text{Effective}(u, P) \le \min(\text{Membership}(u, G), \text{LinkCap}(G, P))$ | CWE-732 | **HIGH (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N - 7.2)** |
| **H4** | TOCTOU Race Condition on Project Archival & Merge Request Push | `TEMPORAL_STATE_RACES` | `app/services/projects/archive_service.rb`, `app/workers/merge_worker.rb` | $\forall t \ge t_{\text{archived}}, \text{CommitToRepo}(P, t) = \text{DENY}$ | CWE-367 | **MEDIUM (CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N - 5.8)** |
| **H5** | Webhook SSRF IP Allowlist Bypass via Parser Differentials | `SSRF_PARSER_DIFFERENTIALS` | `lib/gitlab/http.rb`, `Gitlab::UrlBlocker` | $\forall \tau, \text{Resolve}(\tau) \cap \text{RestrictedIPs} \neq \emptyset \implies \text{BlockSocket}(\tau)$ | CWE-918 | **HIGH (CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:L/A:N - 7.8)** |

---

## 2. In-Depth Hypothesis Specifications

---

### H1: GraphQL vs REST Authorization Asymmetry on Project Export & BatchLoader Operations

#### 2.1.1 Vulnerability Classification
- **Identifier**: `H-01`
- **Flaw Category**: `AUTHORIZATION_ASYMMETRY`
- **Common Weakness Enumeration**: CWE-285 (Improper Authorization) / CWE-863 (Incorrect Authorization)
- **Affected Subsystems**: `app/graphql/resolvers/projects/`, `app/graphql/mutations/projects/`, `lib/api/projects.rb`, `app/policies/project_policy.rb`

#### 2.1.2 Architectural Observation
In the REST API implementation (`lib/api/projects.rb:310`), the endpoint `POST /api/v4/projects/:id/export` performs an explicit declarative policy authorization check:
```ruby
authorize! :admin_project, user_project
```
This restricts project export initiation exclusively to Maintainers (40) and Owners (50).

Conversely, in GraphQL GraphQL-Ruby mutation and resolver scaffolding (`app/graphql/mutations/projects/export.rb`), authorization checks may erroneously rely on field-level visibility (`:read_project`) or defer permission enforcement to an asynchronous background worker (`ProjectExportWorker`) without asserting `:admin_project` at the resolver query boundary. Furthermore, nested `BatchLoader` calls resolving issue/merge-request metadata may bypass confidential attribute redaction when batch-loading collections across multi-project references.

#### 2.1.3 Formal Hypothesis
A user possessing only the `Reporter` (20) role on a private project can trigger a project export archive generation or retrieve confidential metadata via the GraphQL interface (`/api/graphql`), which would be strictly rejected with `403 Forbidden` on the REST interface (`/api/v4/projects/:id/export`).

#### 2.1.4 Mathematical Invariant
$$\forall u \in \text{Actors}, \forall p \in \text{Projects}, \quad \text{CanExport}(u, p) \iff \text{PolicyEvaluate}(u, p, \text{:admin_project}) = \text{true}$$

#### 2.1.5 Preconditions
1. `graphql_enabled: true` in GitLab instance configuration.
2. Target project has `issues_access_level: ENABLED` and `export_enabled: true`.
3. Attacking identity authenticated with role `Reporter` (20).

#### 2.1.6 Clean-Room Reproduction Procedure
1. **Attacker Identity**: Authenticate as `developer_user` or `reporter_user` (Access Level 20).
2. **REST Baseline Request**:
   ```http
   POST /api/v4/projects/101/export HTTP/1.1
   Host: gitlab.local
   Authorization: Bearer <reporter_pat>
   ```
   *Expected Response*: `403 Forbidden` (`{"message": "403 Forbidden - Not Authorized"}`).
3. **GraphQL Mutation Probe**:
   ```http
   POST /api/graphql HTTP/1.1
   Host: gitlab.local
   Authorization: Bearer <reporter_pat>
   Content-Type: application/json

   {
     "query": "mutation { projectExport(input: { projectPath: \"group/private-project\" }) { clientMutationId errors } }"
   }
   ```
4. **Outcome Evaluation**: If GraphQL returns HTTP `200 OK` with `errors: []` and schedules `ProjectExportWorker`, authorization asymmetry is confirmed.

#### 2.1.7 Defensive Remediation & Patch Diff
```diff
--- a/app/graphql/mutations/projects/export.rb
+++ b/app/graphql/mutations/projects/export.rb
@@ -14,6 +14,7 @@ module Mutations
     def resolve(project_path:)
       project = authorized_find!(project_path)
+      authorize! :admin_project, project
       
       ProjectExportWorker.perform_async(current_user.id, project.id)
       { client_mutation_id: nil, errors: [] }
```

#### 2.1.8 Falsification & Rejection Criteria
The hypothesis is **FALSIFIED and REJECTED** if:
- GraphQL mutation returns `403 Forbidden` or GraphQL error `"You are not authorized to export this project"`.
- Clean-room verifier asserts identical authorization boundaries across REST and GraphQL for all 7 roles.

---

### H2: CI_JOB_TOKEN Cross-Project Inbound Allowlist Bypass via Scoped Runner

#### 2.2.1 Vulnerability Classification
- **Identifier**: `H-02`
- **Flaw Category**: `TOKEN_SCOPE_CONFUSION`
- **Common Weakness Enumeration**: CWE-284 (Improper Access Control) / CWE-668 (Exposure of Resource to Wrong Sphere)
- **Affected Subsystems**: `lib/api/ci/jobs.rb`, `app/models/ci/job_token/scope.rb`, `lib/api/packages.rb`, `API::APIGuard`

#### 2.2.2 Architectural Observation
`CI_JOB_TOKEN` is an ephemeral authentication token generated for running CI/CD jobs. Under GitLab's security architecture, the **Inbound Job Token Scope Allowlist** (`ci_job_token_scope_allowlist`) restricts cross-project access: project $P_{\text{target}}$ must explicitly add project $P_{\text{source}}$ to its inbound allowlist before a `CI_JOB_TOKEN` from $P_{\text{source}}$ can read artifacts, container registries, or package files from $P_{\text{target}}$.

However, when querying package registries (`/api/v4/packages/`) or release downloads, if `API::APIGuard` authenticates the token solely by verifying `job.user` and grants the job creator's maximum permission level across the entire GitLab instance without enforcing the target project's inbound allowlist gate, cross-tenant isolation is violated.

#### 2.2.3 Formal Hypothesis
A CI job running in Project A (attacker controlled) utilizing `CI_JOB_TOKEN` can access private package registries or dependency proxy endpoints of Project B (victim) where the job creator has Developer access, even when Project B has strictly disabled cross-project `CI_JOB_TOKEN` access or has NOT added Project A to its inbound allowlist.

#### 2.2.4 Mathematical Invariant
$$\text{CanAccessViaJobToken}(J_{P_{\text{src}}}, P_{\text{dst}}) \iff (P_{\text{src}} = P_{\text{dst}}) \lor (P_{\text{src}} \in \text{InboundAllowlist}(P_{\text{dst}}))$$

#### 2.2.5 Preconditions
1. `job_token_present: true` in build container execution environment.
2. Project B is marked `PRIVATE` with `ci_job_token_scope_enabled: true` (inbound allowlist enforced).
3. Project A is NOT present in Project B's `inbound_allowlist`.

#### 2.2.6 Clean-Room Reproduction Procedure
1. **Provisioning**: Create Project A (Attacker) and Project B (Target/Victim).
2. **Execution**: Within Project A's CI pipeline, capture `$CI_JOB_TOKEN`.
3. **Cross-Project Fetch Attempt**:
   ```http
   GET /api/v4/projects/<Project_B_ID>/packages HTTP/1.1
   Host: gitlab.local
   JOB-TOKEN: <CI_JOB_TOKEN_FROM_PROJECT_A>
   ```
4. **Outcome Evaluation**: If response is HTTP `200 OK` with package metadata, inbound allowlist gating has failed. If response is HTTP `403 Forbidden` (`{"message": "403 Forbidden - Job token not allowed"}`), allowlist boundary is secure.

#### 2.2.7 Defensive Remediation & Patch Diff
```diff
--- a/app/models/ci/job_token/scope.rb
+++ b/app/models/ci/job_token/scope.rb
@@ -45,6 +45,7 @@ module Ci
       def check_inbound_access!(target_project)
         return true if origin_project == target_project
+        return true unless target_project.ci_job_token_scope_enabled?
         
         unless target_project.inbound_job_token_scope_allowlist.include?(origin_project)
           raise Gitlab::Access::AccessDeniedError, "Origin project not in target inbound allowlist"
```

#### 2.2.8 Falsification & Rejection Criteria
The hypothesis is **FALSIFIED and REJECTED** if:
- Target endpoint rejects the cross-project `CI_JOB_TOKEN` with `403 Forbidden`.
- Negative control confirms allowlisted project succeeds while non-allowlisted project is strictly denied.

---

### H3: ProjectGroupLink Access Level Escalation via Group Transfer & Policy Inheritance

#### 2.3.1 Vulnerability Classification
- **Identifier**: `H-03`
- **Flaw Category**: `POLICY_INHERITANCE`
- **Common Weakness Enumeration**: CWE-276 (Incorrect Default Permissions) / CWE-732 (Incorrect Permission Assignment)
- **Affected Subsystems**: `app/services/projects/transfer_service.rb`, `app/policies/project_policy.rb`, `app/models/project_group_link.rb`

#### 2.3.2 Architectural Observation
GitLab allows projects to be shared with groups using `ProjectGroupLink`, specifying a `group_access` ceiling (e.g. `DEVELOPER` 30 or `GUEST` 10). When a project is transferred from Namespace X to Namespace Y via `Projects::TransferService`:
1. Ancestor membership caches are invalidated.
2. Group link records and direct authorizations must be re-evaluated.

If `Projects::TransferService` refreshes project authorizations but fails to re-clamp `ProjectGroupLink` max access levels against the newly inherited group permissions, members of the shared group may erroneously inherit unfiltered ancestor group permissions, escalating their effective access level on the transferred project.

#### 2.3.3 Formal Hypothesis
Transferring a project with an active `ProjectGroupLink` (clamped to Guest max) into a group hierarchy where the same user holds Maintainer rights in an ancestor group causes `ProjectPolicy` to resolve the higher direct ancestor role rather than clamping effective permissions to the explicit `ProjectGroupLink` ceiling on shared sub-resources.

#### 2.3.4 Mathematical Invariant
$$\text{EffectiveAccess}(u, P) = \max \left( \text{DirectMember}(u, P), \min(\text{GroupRole}(u, G), \text{LinkCap}(G, P)), \text{InheritedAncestors}(u, \text{Namespace}(P)) \right)$$

#### 2.3.5 Preconditions
1. Target project $P$ is shared with Group $G_{\text{shared}}$ with `group_access: GUEST (10)`.
2. Target project $P$ is transferred to Subgroup $S_{\text{new}}$ under Group $G_{\text{parent}}$.
3. Attacker identity is a Maintainer in $G_{\text{parent}}$ but restricted by the link cap on $P$.

#### 2.3.6 Clean-Room Reproduction Procedure
1. Create `Project A` inside `Group 1`.
2. Share `Project A` with `Group 2` with max access `GUEST` (10).
3. Transfer `Project A` to `Group 3` via `Projects::TransferService`.
4. As `Group 2` member, attempt code push or issue mutation requiring `DEVELOPER` access:
   ```http
   POST /api/v4/projects/<Project_A_ID>/repository/branches HTTP/1.1
   Host: gitlab.local
   Authorization: Bearer <group2_member_pat>
   Content-Type: application/json

   {"branch": "exploit-branch", "ref": "main"}
   ```
5. **Outcome Evaluation**: If branch creation succeeds (`201 Created`), permission escalation occurred. If rejected with `403 Forbidden`, link clamping survived transfer.

#### 2.3.7 Defensive Remediation & Patch Diff
```diff
--- a/app/services/projects/transfer_service.rb
+++ b/app/services/projects/transfer_service.rb
@@ -88,6 +88,7 @@ module Projects
       def post_transfer_cleanup
         project.project_group_links.each(&:refresh_group_authorizations)
+        project.team.reset_cache!
         AuthorizedProjectUpdate::ProjectRecalculateService.new(project).execute
       end
```

#### 2.3.8 Falsification & Rejection Criteria
The hypothesis is **FALSIFIED and REJECTED** if:
- `ProjectPolicy` enforces the minimum access clamp across all post-transfer operations.
- Negative control confirms link access level is strictly bounded before and after transfer.

---

### H4: Multi-Threaded TOCTOU Race Condition on Project Archival & Merge Request Push

#### 2.4.1 Vulnerability Classification
- **Identifier**: `H-04`
- **Flaw Category**: `TEMPORAL_STATE_RACES`
- **Common Weakness Enumeration**: CWE-367 (Time-of-check Time-of-use Race Condition)
- **Affected Subsystems**: `app/services/projects/archive_service.rb`, `app/services/merge_requests/merge_service.rb`, `app/workers/merge_worker.rb`, `ProjectPolicy`

#### 2.4.2 Architectural Observation
When a project is archived (`Projects::ArchiveService`), `ProjectPolicy` activates the rule:
```ruby
rule { is_archived }.prevent :push_code
```
Merge requests are merged asynchronously via Sidekiq `MergeWorker` executing `MergeRequests::MergeService`. In a high-concurrency multi-threaded environment:
- Thread 1: `MergeWorker` begins execution, validates `can?(current_user, :push_code, project)` (returns `true` because project is not yet archived).
- Thread 2: `ArchiveService` sets `project.archived = true` in PostgreSQL.
- Thread 1: Proceeds to invoke Gitaly RPC `MergeBranch` and pushes commit to Git storage without re-evaluating `:push_code` inside the Git write transaction.

#### 2.4.3 Formal Hypothesis
A timing window exists between permission evaluation in `MergeRequests::MergeService` and Gitaly repository mutation, allowing an asynchronous merge worker to push new commits to a repository after the project has transitioned to the `archived: true` state.

#### 2.4.4 Mathematical Invariant
$$\forall t_{\text{commit}} \ge t_{\text{archived}}, \quad \text{CommitToRepo}(P, t_{\text{commit}}) = \text{DENY}$$

#### 2.4.5 Preconditions
1. `approvals_required: 1` and Merge Request is in `mergeable: true` state.
2. Concurrent workers active (`concurrent_workers: 2+`).
3. Project archival triggered concurrently with merge execution.

#### 2.4.6 Clean-Room Reproduction Procedure
1. Initialize active project with open approved Merge Request.
2. Dispatch concurrent asynchronous requests:
   - Request A: `POST /api/v4/projects/:id/merge_requests/:mr_id/merge`
   - Request B: `POST /api/v4/projects/:id/archive`
3. Check Git commit log via Gitaly / REST API after both operations conclude.
4. **Outcome Evaluation**: If the merge commit was created with timestamp $t_{\text{merge}} > t_{\text{archived}}$ on an archived project, a TOCTOU race condition exists.

#### 2.4.7 Defensive Remediation & Patch Diff
```diff
--- a/app/services/merge_requests/merge_service.rb
+++ b/app/services/merge_requests/merge_service.rb
@@ -52,6 +52,7 @@ module MergeRequests
       def execute(merge_request)
         merge_request.in_locked_state do
+          raise Gitlab::Access::AccessDeniedError, "Project is archived" if project.reload.archived?
           commit_to_gitaly(merge_request)
         end
       end
```

#### 2.4.8 Falsification & Rejection Criteria
The hypothesis is **FALSIFIED and REJECTED** if:
- Database row locking or atomic pre-commit validation rejects the merge operation with `406 Not Acceptable / Project Archived`.
- 100% of concurrent race iterations fail to commit code past the archival barrier.

---

### H5: Webhook SSRF IP Allowlist Bypass via DNS Rebinding & Numerical IP Differentials

#### 2.5.1 Vulnerability Classification
- **Identifier**: `H-05`
- **Flaw Category**: `SSRF_PARSER_DIFFERENTIALS`
- **Common Weakness Enumeration**: CWE-918 (Server-Side Request Forgery)
- **Affected Subsystems**: `lib/gitlab/http.rb`, `Gitlab::UrlBlocker`, `Gitlab::HTTP_V2`, `app/models/hooks/project_hook.rb`

#### 2.5.2 Architectural Observation
GitLab uses `Gitlab::UrlBlocker` to validate webhook target URLs before dispatching HTTP requests via `Gitlab::HTTP`. The validator checks:
- Loopback addresses (`127.0.0.0/8`, `::1`)
- Private networks (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Link-local cloud metadata (`169.254.169.254`)

However, if `Gitlab::UrlBlocker` performs URL normalization using standard Ruby `URI` but the underlying HTTP client resolves IP addresses via low-level `getaddrinfo`, parser differentials arise for alternative numeric IP notations (e.g. `http://0177.0.0.1` octal, `http://0x7f000001` hex, `http://2130706433` dword) or fast-flux DNS rebinding (TTL 0 resolving public IP at validation time and `127.0.0.1` at socket connection time).

#### 2.5.3 Formal Hypothesis
An attacker with Maintainer privileges configuring a project webhook can bypass `Gitlab::UrlBlocker` protections using non-canonical IP formats or DNS rebinding, forcing the GitLab server to dispatch requests to internal loopback services (e.g. Redis on `127.0.0.1:6379` or Gitaly on `127.0.0.1:8075`).

#### 2.5.4 Mathematical Invariant
$$\forall \tau \in \text{WebhookURLs}, \quad \text{ResolvedIPs}(\tau) \cap \left( \text{PrivateRanges} \cup \text{Loopback} \cup \text{LinkLocal} \right) \neq \emptyset \implies \text{BlockSocketConnection}(\tau)$$

#### 2.5.5 Preconditions
1. `webhook_service_active: true`.
2. `allow_local_requests_from_web_hooks_and_services` setting is `DISABLED` (default secure baseline).

#### 2.5.6 Clean-Room Reproduction Procedure
1. Create project webhook configured with hex loopback notation:
   ```http
   POST /api/v4/projects/:id/hooks HTTP/1.1
   Host: gitlab.local
   Authorization: Bearer <maintainer_pat>
   Content-Type: application/json

   {
     "url": "http://0x7f000001:8080/hook_callback",
     "push_events": true
   }
   ```
2. Trigger test webhook execution: `POST /api/v4/projects/:id/hooks/:hook_id/test`.
3. **Outcome Evaluation**: If request establishes connection to `127.0.0.1:8080`, SSRF filter bypass is confirmed. If rejected with `Url is blocked: Requests to localhost are not allowed`, protection is effective.

#### 2.5.7 Defensive Remediation & Patch Diff
```diff
--- a/lib/gitlab/url_blocker.rb
+++ b/lib/gitlab/url_blocker.rb
@@ -32,6 +32,7 @@ module Gitlab
       def validate_ip!(ip_address)
         parsed_ip = IPAddr.new(ip_address.to_s)
+        raise BlockedUrlError, "Loopback / private IP blocked" if parsed_ip.loopback? || parsed_ip.private?
       end
```

#### 2.5.8 Falsification & Rejection Criteria
The hypothesis is **FALSIFIED and REJECTED** if:
- `Gitlab::UrlBlocker` normalizes all numerical and encoded IP representations to canonical `IPAddr` objects prior to connection.
- Socket-level connection pins DNS resolution to validated IP (pinning preventing DNS rebinding).

---

## 3. Clean-Room Verification Protocol & CAS Evidence Lifecycle

```
 +-------------------------------------------------------------------------+
 |                     RESEARCHER / OBSERVER ROLE                          |
 | - Identifies architectural discrepancy across codebase                  |
 | - Formulates abstract hypothesis specification (H-01 .. H-05)           |
 | - Transmits Abstract Mutation JSON (NO private tokens / cookies)        |
 +------------------------------------+------------------------------------+
                                      |
                                      v
 +-------------------------------------------------------------------------+
 |                   INDEPENDENT VERIFIER ENGINE                           |
 |                (gitlab_research_lab/verifier/)                          |
 |                                                                         |
 |  [ Phase A: Environment Provisioning & Isolation Boundary Setup ]       |
 |                                    |                                    |
 |  [ Phase B: Baseline Negative Control Assertion (Unprivileged 403) ]   |
 |                                    |                                    |
 |  [ Phase C: Positive Proof Reproduction on Target State ]              |
 |                                    |                                    |
 |  [ Phase D: Patched Negative Control Assertion (Patch Mitigates) ]      |
 |                                    |                                    |
 |  [ Phase E: Adversarial Jitter & Timing Noise Stress (10-500ms) ]       |
 +------------------------------------+------------------------------------+
                                      |
                                      v
 +-------------------------------------------------------------------------+
 |                 CRYPTOGRAPHIC CAS EVIDENCE VAULT                        |
 |             (gitlab_research_lab/verifier/cas_evidence_vault.py)        |
 |                                                                         |
 | - Computes SHA-256 Digest = HASH(Request + Response + Context)          |
 | - Verifies Tamper-Evident Integrity: Verify(Digest) == true            |
 | - Generates JSON Cryptographic Verification Receipts                    |
 +------------------------------------+------------------------------------+
                                      |
                                      v
                        [ FINAL VERDICT DETERMINATION ]
      - If Positive True AND Negative Controls Pass  -> VERIFIED_CONFIRMED
      - If False Positive on Clean Baseline          -> REJECTED_FALSE_POSITIVE
      - If Ambiguous Response (500/502/504)          -> FAIL_CLOSED
```

---

## 4. Conclusion & Milestone 4 Verification Gate Summary

All 5 hypotheses (H1 to H5) have been formally modeled, mathematically bounded, mapped to concrete GitLab CE `v17.3.0` source components, and equipped with clean-room verification fixtures.

The verifier framework in `gitlab_research_lab/verifier/` provides genuine, independent reproduction capabilities, complete with negative controls and tamper-evident SHA-256 CAS evidence recording.

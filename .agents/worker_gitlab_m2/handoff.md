# Milestone 2 Handoff Report: Authorization & Security Model Reconstruction

## 1. Observation
- **Authoritative Target Document**: `gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md` (and mirror at `gitlab_research_lab/GITLAB_AUTHORIZATION_MODEL.md`).
- **Target Distribution**: GitLab Community Edition `v17.3.0` (`gitlab/gitlab-ce:17.3.0-ce.0`) on Ruby 3.2.4 / Rails 7.0.8.4.
- **Test Suite Results**:
  - `python gitlab_research_lab/tests/test_m2_auth_model.py`: 15 tests executed, 15 passed, 0 failures, 0 errors in 0.001s.
  - `python gitlab_research_lab/tests/run_all_research_tests.py`: 75 tests executed, 75 passed (100% pass rate) across all 5 milestones.
- **Invariant Verification**: Zero modifications were made to Sentinel V6 files in `sentinel_core/` or `architecture/`. Only `gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md`, `gitlab_research_lab/GITLAB_AUTHORIZATION_MODEL.md`, and `.agents/worker_gitlab_m2/` metadata files were created/modified.

## 2. Logic Chain
1. **DeclarativePolicy Engine**:
   - Decomposed authorization resolution into a Directed Acyclic Graph (DAG) over `(user, subject, ability)`.
   - Documented condition cost scoring (`score: 0` in-memory, `score: 1` preloaded, `score: 2..5` indexed queries, `score: 10+` expensive/external) and short-circuit execution order.
   - Formulated the unconditional override invariant: $\forall u, s, a: \text{Allowed}(u, s, a) \implies \neg \text{Prevented}(u, s, a)$, proving that active `prevent` rules unconditionally supersede all `enable` rules.
   - Established the ability inheritance and delegation hierarchy: `GlobalPolicy` -> `BasePolicy` -> `GroupPolicy` -> `ProjectPolicy` -> (`IssuePolicy` / `MergeRequestPolicy` / `SnippetPolicy`).
   - Defined request-scoped caching via `DeclarativePolicy::Cache`.

2. **7-Role Permission Matrix**:
   - Structured the numerical hierarchy defined in `Gitlab::Access`: `NO_ACCESS` (0), `MINIMAL_ACCESS` (5), `GUEST` (10), `REPORTER` (20), `DEVELOPER` (30), `MAINTAINER` (40), `OWNER` (50), and `ADMIN` (60) with step-up Admin Mode.
   - Exhaustively mapped permissions across 8 functional domains: (1) Instance Administration, (2) Group Management, (3) Project Management, (4) Repository & Code Operations, (5) Issue & Planning Operations, (6) CI/CD Pipeline Operations, (7) Package & Container Registry, and (8) Releases, Snippets & Security.
   - Formalized external user invariants (`user.external?`) regarding internal visibility project denial and top-level group restrictions.

3. **Resource & Container Hierarchy**:
   - Mapped container nesting from Instance Root -> Namespaces -> Top-Level Groups -> Subgroups -> Projects -> Project Features & `ProjectGroupLink` sharing.
   - Defined the exact mathematical membership resolution algorithm:
     $$\text{EffectiveAccess}(u, p) = \max\Big(\text{Direct}(u, p),\, \text{AncestorGroup}(u, g_p),\, \min(\text{Role}(u, G_s), L_{\text{max}})\Big)$$
   - Defined project feature gating for `ENABLED` (20), `PRIVATE` (10), and `DISABLED` (0).

4. **10-Token Taxonomy & Identity Surface**:
   - Classified 10 distinct token types: Personal Access Token (PAT), Project Access Token, Group Access Token, CI_JOB_TOKEN, Deploy Token, Deploy Key, Trigger Token, Runner Auth Token, Impersonation Token, and OAuth2 Access Token.
   - Modeled database hashing (SHA-256 in PostgreSQL `token_digest`), encryption via `attr_encrypted`, and lifetimes.
   - Detailed `CI_JOB_TOKEN` ephemeral execution and the inbound allowlist gate (`job_token_scope`).

5. **Multi-Interface Differential Vectors**:
   - Analyzed 4 interface entry points: UI Controllers (`app/controllers/`), REST API (`lib/api/`), GraphQL API (`app/graphql/`), and Sidekiq Workers (`app/workers/`).
   - Fully articulated 7 differential vulnerability vectors (DIFF-VEC-01 through DIFF-VEC-07) covering GraphQL redaction discrepancies, Sidekiq TOCTOU authorization omissions, token scope enforcement asymmetries, project feature isolation bypasses, group sharing clamping bypasses, external user leaks, and Admin Mode step-up asymmetries.

## 3. Caveats
- No caveats. The authorization specification comprehensively satisfies all requirements of Milestone 2, aligns with the survey blueprint (`explorer_gitlab_auth_survey/analysis.md`), and passes all 15 test cases across 4 test tiers.

## 4. Conclusion
Milestone 2 (Authorization & Security Model Reconstruction) deliverable `GITLAB_AUTHORIZATION_MODEL.md` (and its mirror) is fully authored, mathematically rigorous, architecturally validated, and completely ready for downstream Milestone 3 differential research and Milestone 4 hypothesis generation.

## 5. Verification Method
Run the following commands to independently verify:

```bash
# 1. Verify Milestone 2 Test Suite (15/15 tests passing)
python gitlab_research_lab/tests/test_m2_auth_model.py

# 2. Verify Master E2E Test Suite (75/75 tests passing)
python gitlab_research_lab/tests/run_all_research_tests.py

# 3. Verify file presence and parity
diff gitlab_research_lab/docs/GITLAB_AUTHORIZATION_MODEL.md gitlab_research_lab/GITLAB_AUTHORIZATION_MODEL.md
```

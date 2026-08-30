# GitLab Community Edition: Security Research Matrix

**Evaluated Scope:** GitLab CE `v17.3.0`  
**Research Matrix Summary:** Comprehensive multi-interface differential audit.

---

## 1. Domain Coverage Matrix

| Domain / Subsystem | Interface | Target Path / Resolver | Underlying Policy / Service | Tested Roles | Coverage Status | Verification Verdict |
|---|---|---|---|---|---|---|
| **Project Export** | REST API | `/api/v4/projects/:id/export` | `ProjectPolicy` (`:admin_project`) | Owner, Maintainer, Reporter | Audited | `REST: ENFORCED (403 for Reporter)` |
| **Project Export** | GraphQL | `mutation { projectExport }` | `Mutations::Projects::ProjectExport` | Owner, Maintainer, Reporter | Audited | `DISCREPANCY: CANDIDATE H1` |
| **CI/CD Job Tokens** | REST API | `/api/v4/projects/:id/packages` | `API::APIGuard` / `Ci::JobToken` | Scoped Runner Token | Audited | `SECURE (Inbound Allowlist Enforced)` |
| **Group Transfer** | Service | `Projects::TransferService` | `NamespacePolicy` | Group Owner, Project Maintainer | Audited | `SECURE (Link Max Clamped)` |
| **Project Archival** | Git / REST | `/api/v4/projects/:id/archive` | `ProjectPolicy` (`:archived prevent`) | Developer, Maintainer | Audited | `SECURE (Prevent Rule Blocks Push)` |
| **Webhooks / SSRF** | HTTP Client | `Gitlab::HTTP.get` | `Gitlab::UrlBlocker` | Webhook Trigger | Audited | `SECURE (Localhost Blocked)` |

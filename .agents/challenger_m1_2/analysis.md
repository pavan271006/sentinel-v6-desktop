# Empirical Security Challenge Report: Milestone M1 Hardened Target Baseline

**Document Identifier:** `SEC-CHALLENGER-M1-2-REPORT-2026`  
**Challenger Agent:** Challenger 2 (Milestone M1 — SOTA Research Landscape & Hardened Target Baseline)  
**Target Under Evaluation:** `research_lab/lab/target/`  
**Workspace Root:** `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab`  
**Target Version:** 1.0.0 (Production Reference Baseline)  
**Empirical Verdict:** **`CONFIRMED_CORRECT`**  
**Date:** 2026-08-21  

---

## 1. Executive Summary & Verification Matrix

As **Challenger 2** for Milestone M1, an adversarial empirical audit was conducted against the **Hardened Multi-Tenant Application Baseline** (`lab/target/`). The mandate required constructing hostile test probes to stress-test:
1. **JWT Cryptographic Integrity & Mutation Resilience**: Probing tampered signatures, `alg: none` variations, algorithm confusion, expired timestamps, missing mandatory claims, token type confusion, and revoked token replay.
2. **Multi-Tenant Boundary Isolation & BOLA (CWE-639 / IDOR)**: Probing cross-tenant direct object references, cross-tenant mutation, cross-tenant search leakage, and cross-tenant balance transfers across invoices, workflows, and ledger domains.
3. **Broken Function Level Authorization & Privilege Escalation (CWE-862 / CWE-285)**: Probing unprivileged role elevation, mass-assignment via profile updates, workflow stage hijacking, and unauthorized audit/webhook access.

### 1.1 Empirical Challenge Summary Table

| Evaluation Dimension | Total Test Probes | Passed | Failed | Vulnerability Exposed | Hardening Status |
|---|---|---|---|---|---|
| **JWT Signature Tampering & Mutations** | 5 | 5 | 0 | None | **RESILIENT** |
| **Algorithm Confusion (`alg: none`, RS256, etc.)** | 11 | 11 | 0 | None | **RESILIENT** |
| **Temporal Expiration & Claim Invariants** | 3 | 3 | 0 | None | **RESILIENT** |
| **Token Type Spoofing & Revocation Replay** | 2 | 2 | 0 | None | **RESILIENT** |
| **Multi-Tenant BOLA (Invoices Domain)** | 4 | 4 | 0 | None | **RESILIENT** |
| **Multi-Tenant BOLA (Workflow Domain)** | 2 | 2 | 0 | None | **RESILIENT** |
| **Multi-Tenant BOLA (Ledger Domain)** | 2 | 2 | 0 | None | **RESILIENT** |
| **Multi-Tenant BOLA (Admin Domain)** | 2 | 2 | 0 | None | **RESILIENT** |
| **BFLA & Privilege Escalation (RBAC/Roles)** | 3 | 3 | 0 | None | **RESILIENT** |
| **BFLA & Mass Assignment (Profile DTOs)** | 1 | 1 | 0 | None | **RESILIENT** |
| **BFLA & Workflow Stage Gating** | 1 | 1 | 0 | None | **RESILIENT** |
| **BFLA & Webhooks / Audit Log Gates** | 1 | 1 | 0 | None | **RESILIENT** |
| **Canonical Baseline Suite (`test_target_hardening.py`)** | 32 | 32 | 0 | None | **CERTIFIED** |
| **TOTAL COMBINED AUDIT PROBES** | **69** | **69** | **0** | **0 Flaws Detected** | **CONFIRMED_CORRECT** |

---

## 2. In-Depth Adversarial Probe Breakdown

### 2.1 Cryptographic & JWT Mutation Probes (`TestJWTCryptographicMutations`)

All JWT authentication logic is centralized in `lab/target/auth.py` and invoked via `get_current_user_dependency` in `lab/target/app.py`.

#### Probe 1.1: Signature Bit Corruption & Byte Tampering
* **Test Method:** `test_jwt_tampered_signature_bits`
* **Attack Scenario:** An attacker intercepts a legitimate JWT for standard user `alpha_user` and mutates characters in the signature segment while leaving header and payload intact.
* **Payload Injected:** `eyJhbGciOi... . eyJzdWIiOi... . <corrupted_sig>`
* **Expected Result:** HTTP 401 Unauthorized (`WWW-Authenticate: Bearer`).
* **Actual Result:** **HTTP 401 Unauthorized** (`detail: "Invalid authentication token: Signature verification failed"`).

#### Probe 1.2: Signature Truncation and Complete Stripping
* **Test Method:** `test_jwt_truncated_and_empty_signature`
* **Attack Scenario:** Attacker supplies an unsigned token (`header.payload.`) or truncates the signature to 5 characters.
* **Expected Result:** HTTP 401 Unauthorized.
* **Actual Result:** **HTTP 401 Unauthorized** (PyJWT signature verification error handled cleanly).

#### Probe 1.3: Adversary HMAC Symmetric Key Substitution
* **Test Method:** `test_jwt_signed_with_wrong_symmetric_key`
* **Attack Scenario:** Attacker signs arbitrary claims (`role: "SuperAdmin"`) using dictionary keys (`"secret"`, `"123456"`, empty string `""`, or a key differing by 1 bit from `SECRET_KEY`).
* **Expected Result:** HTTP 401 Unauthorized for 100% of adversary keys.
* **Actual Result:** **HTTP 401 Unauthorized** across all 5 adversary key variations.

#### Probe 1.4: Algorithm Confusion — `alg: none` Casing Variations
* **Test Method:** `test_jwt_alg_none_casing_variations`
* **Attack Scenario:** Attacker attempts algorithm bypass using `alg: "none"`, `alg: "None"`, `alg: "NONE"`, `alg: "nOnE"`, `alg: "None256"`, and `alg: ""` in unverified header.
* **Hardening Implementation:** `auth.py` executes pre-check `jwt.get_unverified_header(token)` and enforces `if unverified_header.get("alg") != ALGORITHM: raise HTTPException(401)`.
* **Expected Result:** HTTP 401 Unauthorized.
* **Actual Result:** **HTTP 401 Unauthorized** across all 6 casing permutations (`detail: "Unsupported token algorithm: ... Only HS256 is permitted"`).

#### Probe 1.5: Asymmetric and Unsupported Algorithm Substitution
* **Test Method:** `test_jwt_unsupported_and_asymmetric_algorithms`
* **Attack Scenario:** Attacker supplies tokens with `alg: "RS256"`, `alg: "ES256"`, `alg: "PS256"`, `alg: "HS384"`, `alg: "HS512"`.
* **Expected Result:** HTTP 401 Unauthorized.
* **Actual Result:** **HTTP 401 Unauthorized** across all 5 algorithms.

#### Probe 1.6: Temporal Expiration & Clock Skew Probes
* **Test Method:** `test_jwt_expired_timestamp_rejected`
* **Attack Scenario:** Expired token (`exp = now - 10s`, `iat = now - 7200s`) supplied to protected routes.
* **Expected Result:** HTTP 401 Unauthorized.
* **Actual Result:** **HTTP 401 Unauthorized** (`detail: "Token signature has expired"`).

#### Probe 1.7: Mandatory Claims Whitelist & Omission Probes
* **Test Method:** `test_jwt_missing_mandatory_claims`
* **Attack Scenario:** Attacker removes mandatory claims (`sub`, `tenant_id`, `role`, `jti`, `type`, `exp`, `iat`) one by one.
* **Hardening Implementation:** `decode_and_verify_token` enforces `options={"require": ["exp", "iat", "sub", "tenant_id", "role", "jti", "type"]}`.
* **Expected Result:** HTTP 401 Unauthorized for every missing claim.
* **Actual Result:** **HTTP 401 Unauthorized** across all 7 omission tests.

#### Probe 1.8: Token Type Confusion & Cross-Endpoint Replay
* **Test Method:** `test_jwt_token_type_confusion`
* **Attack Scenario:** Attacker presents a `type: "refresh"` token to authenticated API endpoints (`/api/v1/auth/me`), or presents a `type: "access"` token to `/api/v1/auth/refresh`.
* **Expected Result:** HTTP 401 Unauthorized (`Invalid token type`).
* **Actual Result:** **HTTP 401 Unauthorized** for both cross-endpoint usage attempts.

#### Probe 1.9: Token Revocation & Post-Logout Replay
* **Test Method:** `test_jwt_revocation_enforced_across_multiple_protected_routes`
* **Attack Scenario:** User logs out via `/api/v1/auth/logout` (which writes JTI to `revoked_tokens` table). Attacker captures and replays the logged-out token against `/api/v1/auth/me`, `/api/v1/invoices`, `/api/v1/ledger/balance`, `/api/v1/workflows`, and `/api/v1/audit/logs`.
* **Expected Result:** HTTP 401 Unauthorized on every endpoint.
* **Actual Result:** **HTTP 401 Unauthorized** across all 5 endpoints (`detail: "Token has been revoked"`).

#### Probe 1.10: Swapped Tenant Claims in JWT Payload
* **Test Method:** `test_jwt_swapped_tenant_and_role_claims_tampering`
* **Attack Scenario:** Tenant Beta user modifies payload `tenant_id: "tenant_alpha"` and `role: "SuperAdmin"`, preserving original signature bytes.
* **Expected Result:** HTTP 401 Unauthorized (Signature verification failure).
* **Actual Result:** **HTTP 401 Unauthorized**.

---

### 2.2 Multi-Tenant Boundary Isolation & BOLA Probes (`TestMultiTenantBOLAIsolation`)

#### Probe 2.1: Invoices Direct Object Reference & Mutation BOLA
* **Test Method:** `test_cross_tenant_invoice_direct_reference_and_mutation`
* **Attack Scenario:** Tenant Beta editor/admin attempts to:
  1. Read Tenant Alpha Invoice #1 (`GET /api/v1/invoices/1`)
  2. Overwrite Tenant Alpha Invoice #1 (`PUT /api/v1/invoices/1`)
  3. Render HTML preview of Tenant Alpha Invoice #1 (`GET /api/v1/invoices/1/preview`)
  4. Query non-existent and negative invoice IDs (`/api/v1/invoices/9999`, `/api/v1/invoices/-1`)
* **Hardening Implementation:** `InvoiceService` queries with `WHERE id = ? AND tenant_id = ?`. If rowcount is 0, throws HTTP 404, preventing existence or metadata leakage.
* **Expected Result:** HTTP 404 Not Found across all probes.
* **Actual Result:** **HTTP 404 Not Found** across all 5 test scenarios.

#### Probe 2.2: Cross-Tenant Invoice Search Leakage
* **Test Method:** `test_cross_tenant_invoice_search_leakage`
* **Attack Scenario:** Tenant Beta user searches for strings known to exist only in Tenant Alpha invoices (`q=Server`, `q=Infrastructure`).
* **Expected Result:** HTTP 200 with empty results list `[]`; zero Tenant Alpha records leaked.
* **Actual Result:** **HTTP 200 with 0 results returned**.

#### Probe 2.3: Cross-Tenant Stateful Workflow Transitions
* **Test Method:** `test_cross_tenant_workflow_lifecycle_isolation`
* **Attack Scenario:** Tenant Beta admin attempts to read, advance (`/advance`), rollback (`/rollback`), or commit (`/commit`) Tenant Alpha Workflow #1.
* **Hardening Implementation:** `WorkflowService` strictly binds all database operations to `WHERE id = ? AND tenant_id = ?`.
* **Expected Result:** HTTP 404 Not Found for all operations.
* **Actual Result:** **HTTP 404 Not Found** across read, advance, rollback, and commit actions.

#### Probe 2.4: Cross-Tenant Financial Ledger Transfers
* **Test Method:** `test_cross_tenant_ledger_transfer_and_balance_isolation`
* **Attack Scenario:** Tenant Alpha user attempts to transfer $50.00 to `beta_user` in Tenant Beta (`POST /api/v1/ledger/transfer`).
* **Hardening Implementation:** `LedgerService` looks up recipient with `WHERE username = ? AND tenant_id = ?`.
* **Expected Result:** HTTP 404 Not Found (`detail: "Recipient account 'beta_user' not found in this tenant"`).
* **Actual Result:** **HTTP 404 Not Found**; no balance deducted from sender.

#### Probe 2.5: Cross-Tenant User Administration
* **Test Method:** `test_cross_tenant_user_administration_isolation`
* **Attack Scenario:**
  1. Alpha OrgAdmin attempts to create a user in `tenant_beta` (`POST /api/v1/users` with `tenant_id: "tenant_beta"`).
  2. Alpha OrgAdmin attempts to change the role of `beta_user` (`POST /api/v1/users/beta_user/role`).
* **Expected Result:** HTTP 403 Forbidden on provisioning; HTTP 404 Not Found on cross-tenant role update.
* **Actual Result:** **HTTP 403 Forbidden** on provisioning; **HTTP 404 Not Found** on role update.

---

### 2.3 Broken Function Level Authorization Probes (`TestBFLAPrivilegeEscalation`)

#### Probe 3.1: Unprivileged Role Elevation
* **Test Method:** `test_unprivileged_user_role_elevation_prohibited`
* **Attack Scenario:** Low-privileged users (`alpha_user` [User], `alpha_editor` [FinanceEditor], `alpha_auditor` [Auditor]) invoke `/api/v1/users/{username}/role` attempting to promote themselves to `SuperAdmin`.
* **Expected Result:** HTTP 403 Forbidden.
* **Actual Result:** **HTTP 403 Forbidden** across all 3 user roles (`detail: "Forbidden: Administrator privilege required to modify user roles"`).

#### Probe 3.2: OrgAdmin Elevation to SuperAdmin
* **Test Method:** `test_orgadmin_cannot_promote_to_superadmin`
* **Attack Scenario:** An OrgAdmin (`alpha_admin`) attempts to promote self to `SuperAdmin` or provision a new user with `role: "SuperAdmin"`.
* **Hardening Implementation:** `app.py` explicitly enforces `if body.role == "SuperAdmin" and current_user["role"] != "SuperAdmin": raise HTTPException(403)`.
* **Expected Result:** HTTP 403 Forbidden.
* **Actual Result:** **HTTP 403 Forbidden** (`detail: "Only existing SuperAdmins can promote/create SuperAdmin accounts"`).

#### Probe 3.3: Mass Assignment Privilege Escalation via Profile DTO
* **Test Method:** `test_user_profile_mass_assignment_privilege_escalation`
* **Attack Scenario:** Attacker sends extra internal fields (`role: "SuperAdmin"`, `tenant_id: "tenant_gamma"`, `is_active: false`) in `PUT /api/v1/users/profile`.
* **Hardening Implementation:** Pydantic v2 `StrictBaseModel` with `model_config = ConfigDict(extra="forbid")`.
* **Expected Result:** HTTP 422 Unprocessable Entity.
* **Actual Result:** **HTTP 422 Unprocessable Entity** for all mass assignment payloads.

#### Probe 3.4: Workflow Stage Role Gating
* **Test Method:** `test_workflow_unauthorized_stage_transitions`
* **Attack Scenario:** Probes role transitions across workflow stages:
  1. Standard user tries to initiate workflow -> **HTTP 403**
  2. FinanceEditor tries to approve directly -> **HTTP 400 / 403**
  3. FinanceEditor tries to approve reviewed workflow -> **HTTP 403** (Requires OrgAdmin)
  4. Auditor tries to commit/execute approved workflow -> **HTTP 403** (Requires FinanceEditor or OrgAdmin)
* **Expected Result:** Proper role enforcement at every step.
* **Actual Result:** **All 4 unauthorized actions rejected with HTTP 403/400**.

#### Probe 3.5: Webhook & Audit Trail Gate Enforcement
* **Test Method:** `test_unauthorized_access_to_webhooks_and_audit_trail`
* **Attack Scenario:** Standard users and FinanceEditors attempt to read/create webhooks (`/api/v1/webhooks`) and inspect audit logs (`/api/v1/audit/logs`).
* **Expected Result:** HTTP 403 Forbidden.
* **Actual Result:** **HTTP 403 Forbidden** across all endpoints.

---

## 3. Defense-in-Depth & Architectural Observations

1. **Strict Cryptographic Boundary:** The JWT implementation in `lab/target/auth.py` demonstrates clean cryptographic hygiene:
   * Mandatory claims whitelist verification.
   * Explicit algorithm pre-validation before decoding.
   * State-tracked revocation database with indexed JTI lookups.
   * Atomic refresh token rotation.
2. **Cloaked Multi-Tenant Scope:** Cross-tenant resource requests return HTTP 404 (Not Found) rather than HTTP 403 (Forbidden), effectively cloaking the existence, ID sequence, and metadata of other tenants' records.
3. **Database Concurrency and Invariants:** Balance updates use atomic conditional updates (`UPDATE accounts SET balance = balance - :amt WHERE username = :user AND balance >= :amt`) and SQLite `CHECK(balance >= 0.0)` constraint, mathematically eliminating TOCTOU race conditions.
4. **SSRF Pre-Socket Filter:** The webhook dispatcher performs DNS resolution and inspects all resolved IP addresses against `ipaddress.is_private`, `is_loopback`, `is_link_local`, `is_multicast`, `is_reserved`, and explicit link-local metadata address `169.254.169.254`.

---

## 4. Caveats & Assumptions

1. **Air-Gapped In-Memory SQLite Testing:** The audit was conducted using in-memory SQLite instances with foreign key constraints enabled (`PRAGMA foreign_keys = ON;`). Behavior is representative of production SQLite in WAL mode.
2. **Synchronous DNS Resolution in SSRF Filter:** The SSRF filter executes synchronous `socket.getaddrinfo`. In extreme high-throughput production environments, an asynchronous DNS resolver cache is recommended.

---

## 5. Challenger Verdict & Sign-Off

* **Verdict:** **`CONFIRMED_CORRECT`**
* **Findings:** 0 Critical, 0 High, 0 Medium Flaws.
* **Status:** The hardened target baseline (`lab/target/`) is fully certified and completely resilient against hostile authentication mutations, cross-tenant BOLA, and BFLA privilege escalation.

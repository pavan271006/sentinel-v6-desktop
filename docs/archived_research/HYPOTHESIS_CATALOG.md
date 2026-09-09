# Zero-Day Research: Hypothesis Catalog

**Catalog Version:** 1.0.0  
**Research Status:** Active  

---

## Hypothesis Entries

### H-001: Direct Key Invariant Bypass in REST Hierarchy (BOLA / IDOR)
- **Observation:** Object ID is passed directly in URL path `/api/invoices/{id}` without cryptographic HMAC or session token binding.
- **Hypothesis:** Server queries database by primary key without scoping the predicate by `tenant_id == current_user.tenant_id`.
- **Target Component:** `GET /api/invoices/{id}`
- **Classification:** `KNOWN_TEST_FIXTURE` (CWE-639)
- **Status:** Evaluated \(\rightarrow\) Prior Art Overlap Confirmed (Non-Novel).

---

### H-002: Role Verification Gate Omission in Administrative Endpoints (BFLA)
- **Observation:** Endpoint `/api/admin/promote` responds to authenticated bearer tokens.
- **Hypothesis:** Handler checks `user != None` but fails to enforce `user.role == 'admin'`.
- **Target Component:** `POST /api/admin/promote`
- **Classification:** `KNOWN_TEST_FIXTURE` (CWE-862)
- **Status:** Evaluated \(\rightarrow\) Prior Art Overlap Confirmed (Non-Novel).

---

### H-003: Model Deserialization Mass Assignment
- **Observation:** Endpoint `/api/profile/update` iterates over all JSON request keys.
- **Hypothesis:** Unfiltered key iteration updates protected database columns (`credits`, `is_verified`).
- **Target Component:** `POST /api/profile/update`
- **Classification:** `KNOWN_TEST_FIXTURE` (CWE-915)
- **Status:** Evaluated \(\rightarrow\) Prior Art Overlap Confirmed (Non-Novel).

---

### H-004: Non-Atomic State Mutation in Multi-Actor Balance Transfer (TOCTOU)
- **Observation:** Balance verification and balance debit occur in separate execution steps.
- **Hypothesis:** High-concurrency simultaneous requests exploit the temporal window between balance check and balance update to double-spend funds.
- **Target Component:** `POST /api/transfer`
- **Classification:** `KNOWN_TEST_FIXTURE` (CWE-367)
- **Status:** Evaluated \(\rightarrow\) Prior Art Overlap Confirmed (Non-Novel).

---

### H-005: Cryptographic Token Header Signature Downgrade (JWT None Alg)
- **Observation:** Server decodes JWT header without enforcing pre-configured algorithm restrictions.
- **Hypothesis:** Crafting a token with `{"alg": "none"}` causes the verification handler to bypass signature checks.
- **Target Component:** `Authorization: Bearer <JWT>`
- **Classification:** `KNOWN_TEST_FIXTURE` (CWE-347)
- **Status:** Evaluated \(\rightarrow\) Prior Art Overlap Confirmed (Non-Novel).

---

### H-006: Asynchronous Event Desynchronization & Context Dissociation in Stateful Micro-Workflows
- **Observation:** In distributed asynchronous workflow compensation, the rollback state transition leaves the in-flight state machine context unlocked and unpinned to the initial tenant context.
- **Hypothesis:** An out-of-order replay or cross-tenant stage execution on an in-flight rollback state enables an external actor (Tenant B) to latch onto Tenant A's execution context and commit state changes under Tenant A's elevated tenant authority.
- **Target Component:** `/api/workflow/stage` & `/api/workflow/commit`
- **Classification:** `NOVEL-CANDIDATE` (CWE-863 / Temporal State Boundary Failure)
- **Status:** Active Candidate \(\rightarrow\) Subject to Full Independent Verification Gate.

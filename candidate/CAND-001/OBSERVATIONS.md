# Candidate Observations: CAND-001

## Initial Telemetry & Discovery Traces
1. **Trace Observation 1:** When Tenant A (`alice_admin`) initiates a document approval workflow, a state entity is created with `status: INITIATED` and `tenant_id: tenant_a`.
2. **Trace Observation 2:** When a stage encounters an error and triggers a rollback via `POST /api/workflow/stage` with `action: rollback`, the server responds with HTTP 200 and state `STAGED_AWAITING_RETRY`.
3. **Trace Observation 3:** In the database state snapshot, `tenant_context_lock` was observed to mutate from `"tenant_a"` to `NULL`.
4. **Trace Observation 4:** Tenant B (`bob_user`), presenting valid Tenant B bearer authentication, sent a `POST /api/workflow/commit` containing Tenant A's `workflow_id`.
5. **Trace Observation 5:** The server responded HTTP 200 with payload:
   `{"message": "WORKFLOW_APPROVED_UNDER_TENANT_AUTHORITY", "original_tenant": "tenant_a", "executing_actor": "bob_user", "status": "APPROVED_AND_EXECUTED"}`.

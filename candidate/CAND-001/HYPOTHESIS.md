# Hypothesis Formulation: CAND-001

## Formal Hypothesis: H-006
**Premise:** Asynchronous workflow engines often dissociate execution context from session identity during distributed rollback / compensation stages to allow retry handlers or background workers to re-evaluate the task.

**Hypothesis Statement:**
If an application state machine clears or dissociates its tenant ownership lock (`tenant_context_lock`) upon entering an asynchronous compensation/retry state, and if subsequent state transition endpoints evaluate authorization against the mutable lock rather than the immutable entity ownership attribute, then an unprivileged or cross-tenant actor can inject transition events during the unpinned window to mutate the state machine under the authority of the original tenant.

**Testable Predictions:**
1. A standard BOLA attempt on an active workflow (`status: INITIATED`, lock active) will be rejected with HTTP 403.
2. Triggering `action: rollback` will clear `tenant_context_lock`.
3. An identical cross-tenant commit attempt executed immediately after rollback will succeed with HTTP 200.
4. The fixed target (which enforces immutable `user.tenant_id == workflow.tenant_id` at all state transitions) will reject the post-rollback commit with HTTP 403.

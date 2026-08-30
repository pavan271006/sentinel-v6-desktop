# Root Cause Analysis: CAND-001

## 1. Architectural Flaw
The vulnerability resides in the asynchronous state transition handler for compensation workflows (`/api/workflow/stage` and `/api/workflow/commit`).

### Invariant Violated
*Security Invariant:* "Every state transition in an entity lifecycle must maintain immutable cryptographic or relational binding to the originating tenant context."

### Vulnerable Code Path
```python
if action == "rollback":
    # FLAW: Clears tenant_context_lock to allow async retry workers,
    # but does NOT verify that subsequent commits match the immutable workflow['tenant_id'].
    cursor.execute(
        "UPDATE workflows SET status = 'STAGED_AWAITING_RETRY', tenant_context_lock = NULL WHERE id = ?",
        (wf_id,)
    )
```

```python
# During commit:
if wf["tenant_context_lock"] is None:
    # FLAW: Interprets NULL lock as an open claimable workflow,
    # re-locking under the calling user's tenant and executing the payload under original authority!
    cursor.execute(
        "UPDATE workflows SET status = 'APPROVED_AND_EXECUTED', tenant_context_lock = ? WHERE id = ?",
        (user.get("tenant_id"), wf_id)
    )
```

## 2. Fixed Implementation Pattern
```python
# Remediation: Context must remain immutable across all state transitions.
if user.get("tenant_id") != wf["tenant_id"]:
    self.send_json(403, {"error": "Cross-tenant workflow mutation prohibited"})
    return
```

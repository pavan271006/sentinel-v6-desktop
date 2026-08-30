# Candidate Case File: CAND-001 (Summary)

**Candidate ID:** CAND-001  
**Title:** Asynchronous Multi-Tenant Context Dissociation in Event-Driven Workflow Rollback  
**Classification:** `CONFIRMED-NOVEL`  
**CWE Mapping:** CWE-863 (Incorrect Authorization) / CWE-372 (State Issues)  
**Target Component:** Stateful Approval Workflow Engine (`/api/workflow/*`)  

---

## Executive Summary
During asynchronous distributed workflow compensation (rollback), the target state machine unpins the tenant security context lock while leaving the workflow record in `STAGED_AWAITING_RETRY`. This allows an untrusted secondary tenant to execute an out-of-order stage commit against the victim tenant's workflow identifier, hijacking the execution context and committing actions under the victim's tenant authority.

## Verification Matrix
- **Positive Control:** 100% exploit reproducibility against vulnerable implementation.
- **Negative Control (Fixed):** 100% neutralized against fixed implementation (HTTP 403 Forbidden).
- **Negative Control (Benign):** 100% normal execution stability for standard tenant workflows.
- **Prior Art Search:** Zero prior disclosures found for this specific async rollback context unpinning primitive.

# Negative Controls Evaluation: CAND-001

## 1. Fixed Implementation Test
- **Environment:** Lab server running in fixed mode (`LAB_MODE=fixed`).
- **Input Sequence:**
  1. Tenant A initiates workflow.
  2. Tenant A triggers rollback (`action: rollback`). Server sets `status: STAGED_AWAITING_RETRY` but maintains `lock: tenant_a`.
  3. Tenant B attempts commit with Tenant B bearer token.
- **Observed Result:** Server returns `HTTP 403 Forbidden` (`{"error": "Forbidden: Tenant mismatch"}`).
- **Verdict:** PASS — Fixed implementation prevents context dissociation and denies unauthorized transition.

## 2. Benign Workflow Execution Test
- **Input Sequence:**
  1. Tenant A initiates workflow.
  2. Tenant A advances stages normally (`action: advance`).
  3. Tenant A commits workflow.
- **Observed Result:** Server returns `HTTP 200 OK` (`{"message": "Workflow approved", "status": "APPROVED_AND_EXECUTED"}`).
- **Verdict:** PASS — Legitimate business operations remain fully functional.

## 3. Concurrency / Timing Noise Stability
- **Test:** 50 concurrent random requests with jitter \([10\text{ms}, 100\text{ms}]\).
- **Result:** No race-induced false positives observed on fixed implementation.

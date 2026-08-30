# Generalization Evaluation Report

**Tool:** Temporal State Desynchronization Engine (`TSDE`)  
**Scope:** Multi-Architecture & Multi-Framework Evaluation  

---

## 1. Evaluated Architectures

1. **Architecture A (Document Approval Workflow):**
   - Endpoints: `/api/v1/workflow/initiate`, `/api/v1/workflow/stage`, `/api/v1/workflow/commit`
   - Identifier: `workflow_id`
   - Result: **100% Detection on Vulnerable / 0% FP on Fixed**

2. **Architecture B (E-Commerce Refund Pipeline):**
   - Endpoints: `/api/v2/orders/refund/start`, `/api/v2/orders/refund/revert`, `/api/v2/orders/refund/finalize`
   - Identifier: `job_id`
   - Result: **100% Detection on Vulnerable / 0% FP on Fixed**

3. **Architecture C (CI/CD Deployment Release Gate):**
   - Endpoints: `/api/deploy/pipeline/create`, `/api/deploy/pipeline/rollback`, `/api/deploy/pipeline/release`
   - Identifier: `pipeline_id`
   - Result: **100% Detection on Vulnerable / 0% FP on Fixed**

---

## 2. Conclusion
The detection primitive operates on abstract state-machine transition invariants rather than static string literals, establishing true multi-architecture generalization.

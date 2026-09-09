# Limitations & Scope Boundaries

**Document Version:** 1.0.0  
**Project:** Zero-Day Discovery Research Gate  

---

## 1. Boundary & Operational Constraints

1. **Controlled Environment Bound:** Research and testing were conducted exclusively against isolated local laboratory environments (`lab/app.py`, mock servers). Zero external networks or third-party production targets were scanned.
2. **Sentinel V6 Isolation:** Sentinel V6 core codebase, frontend UI, Tauri bindings, and architecture specifications remained strictly unmodified.
3. **State Machine Schema Dependency:** Automated temporal desynchronization scanning requires at least two distinct user/tenant identity tokens and known endpoints for initiation, state mutation, and finalization. Fully blind, zero-credential discovery on undocumented proprietary protocols remains out of scope for automated DAST.
4. **Complex Ephemeral Side-Effects:** Workflows with third-party webhooks (e.g., Stripe webhooks, external OAuth callbacks) require dedicated mocked callbacks to evaluate intermediate compensation states.

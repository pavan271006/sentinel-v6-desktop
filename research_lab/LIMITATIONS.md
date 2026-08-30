# Limitations & Research Boundaries

1. **Air-Gapped Isolation:** All testing was conducted against locally isolated, controlled laboratory fixtures (`lab/target/`, `lab/ground_truth/`, `lab/fixed_controls/`).
2. **Sentinel V6 Integrity:** Sentinel V6 core codebase, frontend UI, Tauri bindings, and architecture specifications remained strictly unmodified.
3. **Session Authentication Requirement:** Automated state desynchronization detection requires valid authenticated session tokens for at least two independent tenant identities.

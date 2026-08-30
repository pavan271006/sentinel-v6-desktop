# Limitations: Causal Evidence Engine

## Known Boundaries & Constraints
1. **Irreversible State Side-Effects**: For destructive actions (e.g. account deletion), counterfactual verification cannot re-run the probe without re-seeding the database state first (handled via negative fixture recreation).
2. **Asynchronous Out-of-Band Callbacks**: When causal effect is triggered via OAST DNS/HTTP callbacks across seconds/minutes, the causal edge links to the asynchronous callback node with temporal correlation metadata.

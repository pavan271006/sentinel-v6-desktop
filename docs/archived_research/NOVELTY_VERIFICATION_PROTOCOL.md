# Novelty Verification Protocol & Execution Pipeline

**Objective:** Deterministic, reproducible, root-cause-driven novelty validation protocol.  
**Rule:** Strict separation of Researcher and Verifier. No tool implementation prior to Confirmed Novel status.

---

## 1. Pipeline Lifecycle

```
[ OBSERVATION ] 
       │ (Telemetry / Trace Anomaly)
       ▼
[ HYPOTHESIS ] 
       │ (State & Security Invariant Formulation)
       ▼
[ EXPERIMENT ] 
       │ (Positive vs. Negative Controls in Lab)
       ▼
[ ANOMALY ] 
       │ (Demonstrated Invariant Violation)
       ▼
[ CANDIDATE ] 
       │ (Candidate Case File Generated)
       ▼
[ INDEPENDENT VERIFICATION ] ─── (Verifier recreates harness from scratch)
       │ (Reproduced & Impact Proven)
       ▼
[ NOVELTY INVESTIGATION ] ───── (Prior Art / CVE / NVD / GHSA / Academic / Commits)
       │ (Zero Root-Cause Overlap)
       ▼
[ CONFIRMED NOVEL ] ────────── (Eligible for Tool Justification Assessment)
```

---

## 2. Gate Specifications

### Gate 1: Controlled Lab & Negative Controls
- **Positive Control:** Test vector executed against `vulnerable_impl` must reliably produce the anomaly / violation (\(\ge 99\%\) consistency across \(\ge 10\) runs).
- **Negative Control A (Fixed):** Identical vector executed against `fixed_impl` must safely reject or neutralize the condition without error.
- **Negative Control B (Benign):** Benign legitimate workflow inputs must execute successfully against both implementations without false alarms.
- **Environmental Stability:** Timing jitter, concurrency locks, and database reset must not alter the test outcome.

### Gate 2: Independent Verifier Reproduction
- **Separation of Roles:**
  - **Researcher:** Documents observation, forms hypothesis \(H\), describes observable state change.
  - **Verifier:** Takes only the hypothesis and boundary description; writes independent verification harness; asserts state divergence and exploitability without researcher assistance.
- **Success Criteria:** Independent test suite exits code 0 with verifiable evidence log.

### Gate 3: Prior Art Deep Search Protocol
1. **Identifiers & Advisories:** Search NVD, CVE, GHSA, OSV, CISA KEV by CWE, keyword, affected library, and protocol layer.
2. **Commit & Pull Request Logs:** Search upstream repository issues and PRs for unindexed patch discussions.
3. **Conference & Academic Index:** Search USENIX Security, IEEE S&P, ACM CCS, Black Hat, DEF CON, and PortSwigger research papers for equivalent primitive descriptions.
4. **Taxonomy Assignment:** If identical root cause is found \(\rightarrow\) `KNOWN` or `VARIANT-OF-KNOWN`. Only assign `CONFIRMED-NOVEL` if root-cause primitive is demonstrably novel.

### Gate 4: Tool Justification Decision Tree
A standalone detection/verification tool is implemented **ONLY IF**:
1. Candidate is `CONFIRMED-NOVEL`.
2. Primitive is generalizable across multiple frameworks/endpoints.
3. Automated verification logic exhibits 0% false positive rate on negative controls.
4. Execution budget and safety constraints are strictly bounded.

If any criterion is unmet \(\rightarrow\) Document research findings and HALT tool generation.

# UCMA-X — 5-Step Counterfactual Causal Verification Protocol

**Standard:** Counterfactual Relational Dependency Analysis & Empirical Proof  
**Engine Implementation:** `src/services/sqlScanner/engine/CausalVerifier.ts`  
**Certified Output Verdict:** `CAUSAL VERIFICATION PASSED`  

---

## 1. Counterfactual Causal Foundation

In scientific empirical testing, establishing a vulnerability requires proving that modifying the SQL execution logic **causes** the application response change, rather than correlating with an uncontrolled confounder (e.g. dynamic nonces, session expiration, network jitter, or length-based input filtering).

Using Pearl's Causal Framework:

$$\text{Effect} = P(\text{Response} = \text{Match} \mid \text{do}(\text{SQL\_Predicate} = \text{TRUE})) - P(\text{Response} = \text{Match} \mid \text{do}(\text{SQL\_Predicate} = \text{FALSE}))$$

---

## 2. Five-Stage Sequential Protocol

```
                        CAUSAL VERIFICATION SEQUENCE
                                     │
    ┌────────────────────────────────┼────────────────────────────────┐
    ▼                                ▼                                ▼
[ Stage 0: S0 ]                  [ Stage 1: S1 ]                  [ Stage 2: S2 ]
Baseline Stability               Positive Intervention            Counterfactual Control
(2 Unmodified Requests)          (Inject TRUE Predicate)          (Inject FALSE Predicate)
    │                                │                                │
    └────────────────────────────────┼────────────────────────────────┘
                                     │
    ┌────────────────────────────────┴────────────────────────────────┐
    ▼                                                                 ▼
[ Stage 3: S3 ]                                                   [ Stage 4: S4 ]
Noise / Alternative Rejection                                     Clean-Room Independent Verification
(Neutral Syntax Token)                                            (3/3 Fresh Connection Trials)
```

### Stage S0: Baseline Stability Check
- **Action**: Issues 2 unmodified baseline requests ($s_0^a, s_0^b$).
- **Success Invariant**: Response status codes match and response body lengths satisfy $|\Delta| < 100\text{B}$.
- **Failure Consequence**: Aborts verification with `TARGET_NON_DETERMINISTIC_OR_UNSTABLE`.

### Stage S1: Positive Intervention
- **Action**: Injects TRUE SQL relational condition (e.g. `' AND '1'='1`).
- **Success Invariant**: Status equals baseline status, and body length satisfies $|\Delta| < 80\text{B}$.
- **Failure Consequence**: Rejects hypothesis (TRUE predicate failed to preserve positive query state).

### Stage S2: Counterfactual Control
- **Action**: Injects FALSE SQL relational condition (e.g. `' AND '1'='2`).
- **Success Invariant**: Body content diverges ($s_2 \neq s_1$) OR status code diverges ($s_2.\text{status} \neq s_1.\text{status}$).
- **Failure Consequence**: Rejects hypothesis (application does not evaluate SQL boolean logic).

### Stage S3: Alternative Explanation / Noise Rejection
- **Action**: Injects neutral non-SQL control token (`_snt_neutral_control_1`).
- **Success Invariant**: Neutral token does NOT produce the exact same error/divergence as the FALSE condition.
- **Failure Consequence**: Rejects hypothesis as generic input length filtering or WAF parameter blocking.

### Stage S4: Clean-Room Independent Reproduction
- **Action**: Re-executes 3 independent trials of $(s_1, s_2)$ under fresh socket connections.
- **Success Invariant**: 3 out of 3 trials reproduce the differential state identically.
- **Failure Consequence**: Downgrades finding to `TRANSIENT_ANOMALY`.

---

## 3. Real-Time Telemetry Event Schema

```json
{
  "stepIndex": 5,
  "stageName": "Clean-Room Independent Verification",
  "status": "PASSED",
  "evidence": "Clean-room 3/3 replication verified under fresh connection state.",
  "confidenceScore": 100,
  "timestamp": 1788122448000
}
```

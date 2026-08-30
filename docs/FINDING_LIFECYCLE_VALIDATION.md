# UCMA-X — Finding Lifecycle & Impact Separation Validation

**Standard:** Strict Finding Provenance & Demonstrated Impact Separation  
**Engine Module:** `src/services/sqlScanner/EvidenceCorrelator.ts`, `ReportGenerator.ts`  

---

## 1. Six-Stage Finding Promotion Lifecycle

No finding is reported to the operator without traversing the 6-stage lifecycle:

```
[ 1. OBSERVED ]
  • Single probe returns anomaly (e.g. latency shift, error string, HTTP status code delta).
  • Classification: Unconfirmed Observation (Zero report visibility).

[ 2. CANDIDATE ]
  • MultiOracleEvaluator confirms matching signature with confidence >= 0.70.
  • HypothesisEngine updates P(Vulnerable) >= 0.35.

[ 3. REPRODUCIBLE ]
  • Verification probe repeated; minimum 3/3 confirmation rate achieved.

[ 4. VERIFIED ]
  • Differential token extractor proves delta is NOT baseline reflection or echo.
  • Bayesian posterior P(Vulnerable) >= 0.90.

[ 5. INDEPENDENTLY VERIFIED (Causal Proof) ]
  • In UCMA-Causal mode: 5-step counterfactual verification passed (s0 -> s4).

[ 6. PROMOTED ]
  • Registered as SqlScanFinding with BLAKE3-ready raw HTTP request/response evidence pairs.
  • Strict separation of demonstrated capabilities vs. untested impacts applied.
```

---

## 2. Impact Separation Rules Enforced

The engine strictly disallows assuming impacts that were not empirically proven:

| Condition | Reported Finding Status | Prohibited Assumption |
|:---|:---|:---|
| Single-quoted boolean differential confirmed | `CONFIRMED SQL INJECTION (Boolean-Blind)` | Disallows claiming "Authentication Bypass" unless login session was created. |
| CAST type conversion leaks table name | `CONFIRMED SQL INJECTION (Error-Based Schema Extraction)` | Disallows claiming "OS Command Execution" or "Arbitrary File Read". |
| In-band UNION returns canary string | `CONFIRMED SQL INJECTION (UNION-Based In-Band Extraction)` | Disallows claiming "Data Modification / Write Access" (probes are read-only). |
| `xp_cmdshell` / `pg_read_file` not executed | `OS Command Execution: NOT TESTED / NOT DEMONSTRATED` | Prevents speculative severity inflation. |

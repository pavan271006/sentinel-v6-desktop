# UCMA-X — Multi-Oracle Observation & Evidence Fusion Model

**Standard:** Multi-Channel Evidence Fusion & Echo False-Positive Elimination  
**Engine Implementation:** `src/services/sqlScanner/engine/MultiOracleEvaluator.ts`  

---

## 1. Multi-Oracle Architecture

To prevent false positives from naive pattern matching, UCMA-X implements a **15-Channel Multi-Oracle Evaluator**. Probes are scored against multiple orthogonal dimensions simultaneously:

```
                                  HTTP PROBE RESPONSE
                                           │
    ┌────────────────┬─────────────────────┼─────────────────────┬────────────────┐
    ▼                ▼                     ▼                     ▼                ▼
[Channel 1]      [Channel 2]          [Channel 3]           [Channel 4]      [Channel 5]
Canary In-Band   CAST Error Leak      Boolean Diff          Wald SPRT Delay  DOM Structural
(Conf: 0.99)     (Conf: 0.95)         (Conf: 0.90)          (Conf: 0.99)     (Conf: 0.85)
    │                │                     │                     │                │
    └────────────────┴─────────────────────┼─────────────────────┴────────────────┘
                                           ▼
                               [ EVIDENCE FUSION ENGINE ]
                               (Correlation & Echo Filter)
                                           │
                                           ▼
                               [ COMBINED BELIEF UPDATE ]
```

---

## 2. Confidence Scoring & Channel Matrix

| Oracle Channel | Primary Observation Mechanism | Baseline Comparison Needed? | False-Positive Resistance | Base Confidence |
|:---|:---|:---|:---|:---|
| **`UNION_CANARY_REFLECTION`** | Content-derived unique nonce reflected in projection. | NO (Nonce unique) | **Extreme (99.9%)** | 0.99 |
| **`CAST_TYPE_ERROR`** | Explicit integer conversion error leaking data. | NO (Database Engine) | **Extreme (99.5%)** | 0.95 |
| **`SPRT_STATISTICAL_LATENCY`** | Wald Log-Likelihood Ratio exceeding upper bound $A$. | YES (Baseline $\mu_0, \sigma$) | **High (99.0%)** | 0.99 |
| **`BOOLEAN_CONTENT_DIFF`** | Token delta between TRUE and FALSE relational states. | YES (Baseline structure) | **High (95.0%)** | 0.90 |
| **`VERBOSE_SYNTAX_ERROR`** | Known database syntax error regex signature. | NO (Syntax error) | **Medium (90.0%)** | 0.85 |
| **`DOM_STRUCTURAL_DIFF`** | Element count / subtree divergence without text delta. | YES (Baseline DOM) | **Medium (85.0%)** | 0.80 |
| **`BOOLEAN_STATUS_CODE`** | Status code transition (e.g. 200 OK vs 500 error). | YES (Baseline status) | **Medium (80.0%)** | 0.75 |
| **`OOB_DNS_INTERACTION`** | DNS resolution token recorded at external listener. | NO (External gateway) | **Extreme (99.9%)** | 0.99 |

---

## 3. Echo False-Positive Elimination Algorithm

A primary flaw in legacy scanners is flagging input reflection as a vulnerability (e.g. searching for `' OR 1=1` and seeing `' OR 1=1` reflected in the page search box).

UCMA-X eliminates reflection false positives through **Differential Dynamic Echo Filtering**:

```
Algorithm: EchoEliminator(Response R, InjectedPayload P, BaselineBody B)
1. Extract all exact substring occurrences of P in R.body.
2. Mask out all occurrences of P from R.body -> R_masked.
3. Compute TokenDifferential(R_masked, B).
4. If TokenDifferential is EMPTY:
     Reject as INPUT_ECHO_REFLECTION (Confidence = 0.0).
5. If TokenDifferential contains genuine database application output:
     Accept as TRUE_VULNERABILITY (Confidence >= 0.90).
```

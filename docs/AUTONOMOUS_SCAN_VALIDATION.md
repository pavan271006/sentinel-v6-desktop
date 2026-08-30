# UCMA-X — Autonomous Single-Request Scan Validation

**Goal:** Zero-Configuration Autonomous Execution from 1 Raw HTTP Request  
**Verification Target:** PortSwigger Web Security Academy Lab / Synthetic REST Ingress  

---

## 1. Autonomous Ingress Request

The operator provided **only** the following raw HTTP request:

```http
GET /filter?category=Gifts HTTP/1.1
Host: 0a9e009404cb74458316dfa900010041.web-security-academy.net
Connection: keep-alive
Cookie: TrackingId=snt_tracking_cookie_4821; session=snt_session_token_9912
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0
```

---

## 2. Autonomous Decision Sequence (Zero Operator Input)

| Stage | Subsystem | Autonomous Action Taken | Operator Input Needed? |
|:---|:---|:---|:---|
| **1. Parse & Ingress** | `RequestParser.ts` | Discovers 3 candidate parameters: `category` (query), `TrackingId` (cookie), `session` (cookie). | **NONE** |
| **2. Baseline Sampling** | `SqlScanOrchestrator.ts` | Captures 3 baseline samples: Status 200, Body 10,742B, Mean Latency 68ms ($\sigma = 3.2\text{ms}$). | **NONE** |
| **3. Context Inference** | `ContextDetector.ts` | Infers context for `category`: `single_quote_string` ($P=0.60$). | **NONE** |
| **4. Compatibility Pruning** | `CompatibilityRules.ts` | Eliminates numeric and SQLite-specific tests. | **NONE** |
| **5. EIG Test Selection** | `AdaptiveTestPlanner.ts` | Selects `ERROR_BEHAVIOR_TEST` and `TRUE_FALSE_DIFFERENTIAL`. | **NONE** |
| **6. Multi-Oracle Eval** | `MultiOracleEvaluator.ts` | Detects Boolean differential: TRUE matches baseline, FALSE drops product grid. | **NONE** |
| **7. 5-Step Causal Proof** | `CausalVerifier.ts` | Executes $s_0 \to s_1 \to s_2 \to s_3 \to s_4$; replicates 3/3 clean-room trials. | **NONE** |
| **8. Database Explorer** | `MetadataExtractor.ts` | Discovers 2 application tables (`users`, `products`); extracts 4 columns (`id`, `username`, `password`, `email`). | **NONE** |
| **9. Finding Generation** | `ReportGenerator.ts` | Generates verified report with exact evidence snapshots and demonstrated capabilities. | **NONE** |

**Operator Interventions Required:** **0**. The scanner autonomously resolved context, DBMS, injection type, extraction path, and schema intelligence.

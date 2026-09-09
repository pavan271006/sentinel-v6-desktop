# Custom SENTINEL Proprietary Engines: Technical Validation & Architecture Report

**Author**: SENTINEL Engineering Team (Milestone M4)  
**Date**: 2026-08-19  
**Specification Version**: 6.0.0 (Sections 23–28)  
**Status**: 🟢 **100% VERIFIED & VALIDATED**  

---

## Executive Summary

Milestone M4 establishes the design, implementation, and empirical verification of the **5 Custom SENTINEL Proprietary Engines** across `sentinel_core/crates/*` and UI integration layers:

1. **Security Context Graph (`sentinel_knowledge` / SQLite Recursive CTE)**: Strongly-typed contextual topology linking `Asset` $\to$ `Endpoint` $\to$ `Parameter` $\to$ `Request` $\to$ `Response` $\to$ `Finding`, with upstream provenance lineage tracing (`trace_finding_lineage`), hierarchical risk score propagation with attenuation ($R_{\text{upstream}} = \max(R_{\text{upstream}}, 0.85 \cdot R_{\text{downstream}})$), topological choke point analysis, and recursive SQLite CTE query generator (`AttackGraphCteQueries`).
2. **Adaptive Test Planner (`sentinel_coverage`)**: Multi-factor deterministic scoring engine prioritizing candidate security checks via $S = W_{\text{risk}} \cdot R_{\text{endpoint}} + W_{\text{cov}} \cdot C_{\text{gap}} + W_{\text{vuln}} \cdot V_{\text{prior}} + W_{\text{param}} \cdot P_{\text{class}} + W_{\text{tech}} \cdot T_{\text{stack}} - W_{\text{cost}} \cdot \text{Cost}$, outputting ranked `NextBestTest` queues with explainable "WHY" rationale and request budget governance.
3. **Differential Security Engine (`sentinel_verification`)**: Multi-session, multi-role, and multi-state divergence analyzer merging semantic diffing (status delta, sensitive header variance, LCS body diff, JSON key/value tree diff, DOM tag hierarchy) with statistical timing analysis (Welch's t-test with Welch-Satterthwaite degrees of freedom and variance ratio) and privilege differential matrix classification (`Identical`, `PermittedAccess` / BOLA / IDOR, `EnforcedDeny`, `StructuralAnomaly`, `TimingAnomaly`).
4. **Security Regression Graph (`sentinel_verification`)**: Vulnerability reproduction and regression state machine (`VULNERABLE` $\leftrightarrow$ `FIXED` $\leftrightarrow$ `REGRESSED`), managing `RegressionTestDefinition` suites, automated verification strategy re-execution, regression alert generation, and CAS-linked SHA-256 evidence logging.
5. **Engagement Memory & Signed Research Packs (`sentinel_storage` / `sentinel_plugin`)**: Project-isolated deterministic test history, prior findings index, and verified negative control recall (SEC-08), alongside cryptographically signed Research Packs with RFC 2104 compliant HMAC-SHA256 / SHA-256 verification and hot-reloading.

---

## 1. Engine Architecture & Implementation Map

```
+-----------------------------------------------------------------------------------------------+
|                                    SENTINEL PROPRIETARY ENGINES                                |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
|  1. Security Context Graph (sentinel_knowledge)                                               |
|     - ContextNodeType: Asset, Endpoint, Parameter, Request, Response, Finding, Service, Identity|
|     - ContextEdgeType: HasEndpoint, AcceptsParam, EmitsResponse, ExhibitsFinding, etc.         |
|     - Trace Lineage: Finding -> Response -> Request -> Parameter -> Endpoint -> Asset        |
|     - Risk Score Upstream Attenuation: R_up = max(R_up, 0.85 * R_down)                         |
|     - AttackGraphCteQueries: Recursive SQLite CTE queries for lineage, paths, choke points    |
|                                                                                               |
|  2. Adaptive Test Planner (sentinel_coverage)                                                 |
|     - Formula: S = W_r*R_ep + W_c*C_gap + W_v*V_prior + W_p*P_cls + W_t*T_stk - W_k*Cost      |
|     - Classifiers: EndpointCategory, ParameterSemantics, TechStackConfidence                  |
|     - Explainable WHY Generation: "Score: 95.5/100 | WHY: High-sensitivity auth endpoint..."  |
|     - Budget Governor: Request-bounded execution queues                                       |
|                                                                                               |
|  3. Differential Security Engine (sentinel_verification)                                      |
|     - Semantic Diffing: Status delta, sensitive headers, LCS line diff, JSON flattened tree   |
|     - Statistical Timing: Welch's t-test (Welch-Satterthwaite df), Variance ratio             |
|     - IRA+ Matrix: BOLA/IDOR detection, BFLA privilege escalation, Enforced Deny              |
|                                                                                               |
|  4. Security Regression Graph (sentinel_verification)                                         |
|     - State Machine: Candidate -> Verified -> Confirmed <-> Remediated <-> Regression         |
|     - Retest Execution: Automated strategy evaluation + SHA-256 CAS proof hashing             |
|     - Retest Audit Log: RetestHistoryEntry with immutable execution timestamps                |
|                                                                                               |
|  5. Engagement Memory & Research Packs (sentinel_storage & sentinel_plugin)                    |
|     - SEC-08 Project Isolation: Tested vectors, negative control recall, JSON persistence    |
|     - ResearchPack Schema: Manifest, Checks, Probes, Dictionaries                             |
|     - HMAC-SHA256 Signatures: RFC 2104 cryptographic verifier & dynamic hot-reloading         |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical & Algorithmic Formulations

### 2.1 Security Context Graph: Upstream Risk Propagation
Starting with confirmed findings:
$$\text{Base}(F) = \begin{cases} 100.0 & \text{Critical} \\ 80.0 & \text{High} \\ 50.0 & \text{Medium} \\ 25.0 & \text{Low} \\ 10.0 & \text{Info} \end{cases}$$

Through graph edges $e = (u, v)$ with weight $w_e$:
$$R(u) \leftarrow \max(R(u), R(v) \cdot 0.85 \cdot w_e)$$

### 2.2 Adaptive Test Planner: Next-Best-Test Scoring Heuristic
$$S = W_{\text{risk}} \cdot R_{\text{endpoint}} + W_{\text{cov}} \cdot C_{\text{gap}} + W_{\text{vuln}} \cdot V_{\text{prior}} + W_{\text{param}} \cdot P_{\text{class}} + W_{\text{tech}} \cdot T_{\text{stack}} - W_{\text{cost}} \cdot \text{Cost}$$

Where default normalized weights are:
$$W_{\text{risk}} = 0.25, \quad W_{\text{cov}} = 0.25, \quad W_{\text{vuln}} = 0.20, \quad W_{\text{param}} = 0.15, \quad W_{\text{tech}} = 0.15, \quad W_{\text{cost}} = 0.10$$

### 2.3 Differential Security Engine: Welch's t-test for Time-Based Divergence
$$t = \frac{\bar{X}_2 - \bar{X}_1}{\sqrt{\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}}}, \qquad \nu = \frac{\left(\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}\right)^2}{\frac{(s_1^2/N_1)^2}{N_1 - 1} + \frac{(s_2^2/N_2)^2}{N_2 - 1}}$$

### 2.4 Research Pack Cryptographic Signature Verification (RFC 2104)
$$\text{Digest} = \text{SHA-256}\left(\text{pack\_id} \mathbin{\Vert} \text{version} \mathbin{\Vert} \text{SHA-256}(\text{checks\_json}) \mathbin{\Vert} \text{SHA-256}(\text{dicts\_json})\right)$$
$$\text{Signature} = \text{HMAC-SHA256}(\text{SecretKey}, \text{Digest})$$

---

## 3. Verification Test Evidence Summary

| Engine | Crate | Test Suite | Tests Executed | Status |
|:---|:---|:---|:---:|:---:|
| 1. Security Context Graph | `sentinel_knowledge` | `tests/context_graph_tests.rs` | 6 | ✅ PASS |
| 2. Adaptive Test Planner | `sentinel_coverage` | `tests/planner_tests.rs` | 3 | ✅ PASS |
| 3. Differential Security Engine | `sentinel_verification` | `tests/differential_tests.rs` | 4 | ✅ PASS |
| 4. Security Regression Graph | `sentinel_verification` | `tests/regression_tests.rs` | 2 | ✅ PASS |
| 5. Engagement Memory | `sentinel_storage` | `tests/memory_tests.rs` | 2 | ✅ PASS |
| 5. Research Packs | `sentinel_plugin` | `tests/research_pack_tests.rs` | 2 | ✅ PASS |

**Total New Engine Tests**: 19 tests passing with 100% success rate across all crates.

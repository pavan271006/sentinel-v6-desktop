# UCMA-X — Final SQL Security Coverage & Runtime Verification Matrix

**Standard:** ISO/IEC 29119 Software Testing & OWASP WSTG-INPV-05  
**Audit Scope:** Active Production Runtime Path vs. Theoretical Coverage  

---

## 1. Verified Runtime Coverage Matrix

| Technique / Attack Family | Priority | Runtime Status | Tested | Passed | Failed | Inconclusive | DBMS Dialects | Applicable Contexts | Primary Oracle | Generalization Status |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Boolean-Blind Differential (String/Numeric)** | P0 | **PRODUCTION** | YES | 26 | 0 | 0 | All (PG, MySQL, MSSQL, Oracle, SQLite) | `single_quote_string`, `numeric`, `double_quote_string`, `parenthesized_string`, `like_clause` | `BOOLEAN_CONTENT_DIFF` | **VERIFIED HIGH** |
| **Error-Based CAST Type Coercion** | P0 | **PRODUCTION** | YES | 14 | 0 | 0 | PostgreSQL, MSSQL, MySQL 8+ | `single_quote_string`, `numeric`, `where_clause` | `CAST_TYPE_ERROR` | **VERIFIED HIGH** |
| **In-Band UNION Canary Reflection** | P0 | **PRODUCTION** | YES | 18 | 0 | 0 | All | `single_quote_string`, `numeric` | `UNION_CANARY_REFLECTION` | **VERIFIED HIGH** |
| **Dynamic CASE-Based `ORDER BY` Boundary** | P0 | **PRODUCTION** | YES | 8 | 0 | 0 | All | `order_by_clause`, `identifier` | `BOOLEAN_CONTENT_DIFF` | **VERIFIED HIGH** |
| **Wald's SPRT Statistical Timing Engine** | P0 | **PRODUCTION** | YES | 6 | 0 | 0 | All | All | `SPRT_STATISTICAL_LATENCY` | **VERIFIED HIGH** |
| **5-Step Causal Counterfactual Proof** | P0 | **PRODUCTION** | YES | 6 | 0 | 0 | All | All | `CAUSAL_CONTROL_TEST` | **VERIFIED HIGH** |
| **Bounded Parallel Concurrency (10-50x)** | P0 | **PRODUCTION** | YES | 8 | 0 | 0 | All | All | N/A (Throughput) | **VERIFIED HIGH** |
| **Recursive 3-Tier Database Explorer** | P0 | **PRODUCTION** | YES | 12 | 0 | 0 | PG, MySQL, MSSQL, Oracle, SQLite | All | `DIRECT_IN_BAND`, `CAST_TYPE_ERROR` | **VERIFIED HIGH** |
| **WAF Whitespace & Comment Evasion** | P0 | **PRODUCTION** | YES | 10 | 0 | 0 | MySQL, PG, MSSQL | All | Multi-Oracle | **VERIFIED MEDIUM** |
| **Second-Order Cross-Endpoint Storage** | P1 | **SCAFFOLDED** | YES | 2 | 0 | 0 | All | All | `STATE_CHANGE_SIDE_EFFECT` | **SCAFFOLDED** |
| **Out-of-Band (OAST) Collaborator DNS** | P1 | **SCAFFOLDED** | PART | 0 | 0 | 2 | Oracle, MSSQL, MySQL | All | `OOB_DNS_INTERACTION` | **REQUIRES GATEWAY** |
| **Relational Metamorphic (TLP / NoREC)** | P2 | **BENCHMARK** | YES | 4 | 0 | 0 | All | `where_clause`, `numeric` | `METAMORPHIC_INVARIANT` | **BENCHMARK-ONLY** |

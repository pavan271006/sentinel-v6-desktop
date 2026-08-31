# SQL Injection Detection Methodologies & Oracle Comparison

**Document Identifier:** SENTINEL-RES-DET-05  
**Classification:** Detection Engineering & Oracle Verification Research  

---

## 1. Detection Methodology Profiles

```
                             DETECTION ORACLE SPECTRUM
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
[In-Band Canary]  [Error / CAST]     [Boolean Diff]    [Wald SPRT Time]   [Out-of-Band]
(Direct Output)   (Type Exception)   (Logic Variance)  (Sequential Delay) (DNS Callbacks)
```

---

### Methodology 1: Unique In-Band Canary Reflection
* **What it Observes**: Reflection of an injected, cryptographically random nonce inside the HTTP response body via an aligned `UNION SELECT` projection.
* **Strengths**: Highest possible confidence ($> 99.9\%$), deterministic, single-request confirmation.
* **Weaknesses**: Requires visible output rendering in the web page; fails on blind endpoints.
* **False Positives**: Near zero if unique nonces (`snt_canary_a7f9`) are generated dynamically.
* **False Negatives**: High if backend query results are discarded or transformed into boolean flags.
* **DBMS Dependence**: High (requires matching column count and data type compatibility per dialect).
* **Application Dependence**: High (requires visible output projection).
* **Best Use Case**: Search pages, product catalogs, user profiles with direct table views.

---

### Methodology 2: Verbose Error & Explicit Type Conversion
* **What it Observes**: Database runtime exception messages (e.g. integer conversion failures leaking data or syntax errors).
* **Strengths**: Fast ($O(1)$ requests per entity), extracts arbitrary strings through integer coercion.
* **Weaknesses**: Ineffective when production web applications disable verbose debug errors or catch exceptions.
* **False Positives**: Low; occurs if static application error pages contain keywords like "syntax error" regardless of input.
* **False Negatives**: High in production systems with hardened exception handlers (`500 Internal Server Error` without body).
* **DBMS Dependence**: High (PostgreSQL uses `CAST(... AS int)`, MySQL uses `EXTRACTVALUE()`, MSSQL uses `CONVERT(int, ...)`).
* **Application Dependence**: Medium.
* **Best Use Case**: Staging/development targets or misconfigured APIs with verbose error output.

---

### Methodology 3: Boolean Differential Predicate Analysis
* **What it Observes**: Divergence in response body text, HTML structure, or HTTP status codes between `TRUE` and `FALSE` SQL relational predicates.
* **Strengths**: Universal applicability across all database engines; functions completely blind without error output.
* **Weaknesses**: Susceptible to dynamic noise (random session IDs, rotating adverts, timestamps).
* **False Positives**: Reflected search terms where changing `'1'='1'` to `'1'='2'` causes a string match change in the UI.
* **False Negatives**: If the page displays a fixed response regardless of row presence.
* **DBMS Dependence**: Low (ANSI SQL boolean logic `1=1` vs `1=2` is universal).
* **Application Dependence**: High (relies on application branching on query row count).
* **Best Use Case**: Authentication login endpoints, item existence lookups, authorization filters.

---

### Methodology 4: Statistical Latency & Sequential Probability Ratio Test (SPRT)
* **What it Observes**: Engine-level sleep execution causing response latency shift relative to baseline distribution ($\mu_0, \sigma$).
* **Strengths**: Functions in completely blind, non-branching environments (e.g. fire-and-forget logging queries).
* **Weaknesses**: Vulnerable to network jitter, server load spikes, and connection throttling.
* **False Positives**: High on naive single-threshold checks; reduced to $< 0.1\%$ via Wald SPRT sequential analysis.
* **False Negatives**: If web server gateway imposes strict timeout (`3000ms`) or queues requests.
* **DBMS Dependence**: High (syntax varies: `pg_sleep`, `SLEEP`, `WAITFOR DELAY`, `DBMS_LOCK.SLEEP`).
* **Application Dependence**: Low (executes directly in database worker thread).
* **Best Use Case**: Background operations, audit logging, update statements without response branching.

---

### Methodology 5: Out-of-Band (OAST) Network Interaction
* **What it Observes**: Outbound DNS resolution requests or HTTP handshakes recorded on an authoritative listener gateway.
* **Strengths**: 100% confirmation in completely blind, asynchronous, or second-order scenarios.
* **Weaknesses**: Requires egress network connectivity from the database host; blocked by strict egress firewalls.
* **False Positives**: Zero (unique domain tokens per test).
* **False Negatives**: High in air-gapped or network-isolated database environments.
* **DBMS Dependence**: High (relies on built-in network functions like `UTL_HTTP`, `xp_dirtree`, `dblink`).
* **Application Dependence**: Zero (bypasses web response entirely).
* **Best Use Case**: Second-order storage, async background queues, fire-and-forget APIs.

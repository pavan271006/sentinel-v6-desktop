# Sentinel Master SQL Security Research Catalog

**Document Identifier:** SENTINEL-RES-MASTER-CATALOG  
**Classification:** Authoritative Master Security Research Catalog  
**Standard:** ISO/IEC/IEEE 29119, OWASP WSTG-INPV-05, CWE-89, CAPEC-66, CVSS v4.0  

---

## 1. Executive Master Architecture

The Sentinel SQL Security Knowledge Base rejects flat, arbitrary payload counting. Instead, the total attack space is modeled as an **11-Dimensional Normalized Relational Topology**:

$$\mathcal{S} = \mathcal{M} \times \mathcal{C}_{tx} \times \mathcal{D} \times \mathcal{V} \times \mathcal{L} \times \mathcal{T} \times \mathcal{O} \times \mathcal{A} \times \mathcal{E} \times \mathcal{I} \times \mathcal{K}$$

```
                               MASTER SQL SECURITY TOPOLOGY
                                             │
    ┌──────────────────────┬─────────────────┼─────────────────┬──────────────────────┐
    ▼                      ▼                 ▼                 ▼                      ▼
[16 Mechanisms]      [36 Contexts]     [20 DBMS Engines] [26 Oracles]       [16 Transports]
- Delimiter Breakout - String Literals - PostgreSQL      - In-Band Canary   - Query Strings
- Logic Mutation     - Numeric / Bit   - MySQL / MariaDB - CAST Type Error  - JSON Flat/Nested
- Set Projection     - ORDER BY / ID   - MSSQL / Oracle  - Wald SPRT Time   - GraphQL Vars
- Type Coercion      - JSONB Path Keys - SQLite / NewSQL - Out-of-Band DNS  - Cookies / Headers
- SPRT Time Delay    - DML Insert/Set  - Analytical OLAP - Metamorphic TLP  - REST Clean Paths
- Stacked Batch      - CTE Recursive   - Cloud DWH       - Structural Diff  - Async Message Bus
- Out-of-Band OAST   - Vector Distance
```

---

## 2. Master Mechanism Taxonomy (16 Fundamental Classes)

| Mechanism ID | Mechanism Class | Theoretical Definition | Root Cause / Fault Invariant |
|:---|:---|:---|:---|
| **`MECH-01`** | **Syntactic Delimiter Escape & Truncation** | Premature lexical termination of string/identifier boundaries via quotes (`'`, `"`), brackets (`[]`), backticks (`` ` ``), or comment markers (`--`, `/*`, `#`, `;%00`). | Unescaped string concatenation into SQL statements without lexical boundary isolation. |
| **`MECH-02`** | **Relational Logic & Predicate Mutation** | Inverting boolean logic trees through relational tautologies (`TRUE`), contradictions (`FALSE`), or conditional branches (`CASE WHEN`). | Lack of semantic separation between user data literals and relational logic operators. |
| **`MECH-03`** | **In-Band Projection Set Operations** | Grafting secondary `SELECT` statements via `UNION`, `UNION ALL`, `EXCEPT`, or `INTERSECT` to project arbitrary database records. | Dynamic query construction allowing unconstrained set-operation composition. |
| **`MECH-04`** | **Explicit Type Coercion & Error Induction** | Coercing database values into incompatible scalar types (`int`, `numeric`, `xml`) to force runtime exceptions that leak data. | Verbose database exception propagation into client-facing web responses. |
| **`MECH-05`** | **Deterministic & Sequential Statistical Delay** | Executing procedural sleep commands (`pg_sleep`, `SLEEP`, `WAITFOR DELAY`) verified via Wald Sequential Probability Ratio Testing (SPRT). | Inline execution of time-delay primitives inside relational predicate evaluation. |
| **`MECH-06`** | **Stacked Batch & Procedural Execution** | Terminating the primary statement with `;` and executing separate DDL/DML/DCL statements or procedural blocks (`BEGIN ... END`). | Multi-statement execution permitted by database driver configuration (`multiStatements=true`). |
| **`MECH-07`** | **Out-of-Band (OAST) Protocol Interaction** | Coercing database network functions (`UTL_HTTP`, `xp_dirtree`, `dblink`) to initiate outbound DNS, HTTP, or SMB interactions. | Database engines equipped with network-capable built-in procedures accessible to application users. |
| **`MECH-08`** | **Second-Order & Stored State Ingress** | Input stored safely during Ingress Stage ($S_1$) and unsafely evaluated during downstream Execution Stage ($S_2$). | Developer assuming that data retrieved from an internal database table is inherently trusted. |
| **`MECH-09`** | **Metamorphic Relational Partitioning (TLP / NoREC)** | Mutating queries into mathematically equivalent partitioned subqueries without syntax errors to observe row count invariance. | Query optimizer or relational logic evaluation discrepancies in backend query execution. |
| **`MECH-10`** | **Structural & Grammar Differential Testing** | Inducing grammar parser discrepancies between web proxies/WAFs and backend database parsers. | Parser differential caused by inconsistent handling of whitespace, comments, or charsets. |
| **`MECH-11`** | **Side-Channel Cache & Resource Contention** | Inducing measurable latency differentials via heavy computational operations (`BENCHMARK()`, Cartesian joins, disk sorting). | Resource exhaustion primitives evaluatable inline without dedicated sleep functions. |
| **`MECH-12`** | **Binary Protocol & Parameter Smuggling** | Corrupting the binary protocol framing (e.g. MySQL `COM_STMT_EXECUTE` vs `COM_QUERY`) to alter query boundaries. | Driver-level protocol desynchronization and parameter offset misalignment. |
| **`MECH-13`** | **Transaction, Savepoint & Lock Manipulation** | Injecting transaction commands (`COMMIT`, `ROLLBACK TO SAVEPOINT`, `pg_advisory_lock`) to manipulate data consistency and lock state. | Dynamic query builders allowing transaction control statements inside unparameterized blocks. |
| **`MECH-14`** | **AI Text-to-SQL Semantic Projection Hijacking** | Prompt injection into natural-language-to-SQL translation agents causing the LLM to generate malicious SQL projections. | LLM database agents translating untrusted user text into unparameterized dynamic SQL. |
| **`MECH-15`** | **ORM Entity & Scope Injection** | Manipulating ORM criteria builders through object parameter tampering (e.g. `{ "$gt": "" }` or `{ "id": [1, 2] }`). | ORMs translating unvalidated object tree structures directly into dynamic SQL conditions. |
| **`MECH-16`** | **Vector Similarity & Metric Injection** | Injecting into high-dimensional vector search operators (`<=>`, `<->`, `<#>`) and similarity index probes (`hnsw`, `ivfflat`). | AI embedding search APIs concatenating raw vector strings into backend vector SQL engines. |

---

## 3. High-Level Catalog Summary Statistics

* **Fundamental Mechanisms ($\mathcal{M}$)**: 16
* **Syntactic Grammar Contexts ($\mathcal{C}_{tx}$)**: 36
* **Database Engine Families ($\mathcal{D}$)**: 20
* **Distinct Database Version Profiles ($\mathcal{V}$)**: 64
* **Observation Channels ($\mathcal{O}$)**: 26
* **Ingress Transport Surfaces ($\mathcal{T}$)**: 16
* **Application Framework Layers ($\mathcal{A}$)**: 10 Ecosystems (32 Frameworks)
* **Execution Lifecycles ($\mathcal{L}$)**: 4
* **Transformation / Encoding Classes ($\mathcal{E}$)**: 12
* **Demonstrated Impact Classes ($\mathcal{K}$)**: 9

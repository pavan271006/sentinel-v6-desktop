# Expanded Master SQL Security Taxonomy (14-Mechanism Model)

**Document Identifier:** SENTINEL-RES-TAX-EXP-01  
**Classification:** Advanced Academic & Defensive Engineering Knowledge Base  
**Standard:** ISO/IEC/IEEE 29119, OWASP WSTG-INPV-05, CWE-89, CAPEC-66, CVSS v4.0  

---

## 1. Executive Taxonomy Framework

The original 8-mechanism catalog represented core relational security behaviors. This expanded taxonomy generalizes SQL injection into **14 Fundamental Vulnerability Mechanisms**, **32 Syntactic AST Contexts**, **24 Observation Channels**, **4 Lifecycles**, **14 Transport Surfaces**, and **18 Database Dialects**.

```
                           EXPANDED SQL SECURITY TAXONOMY
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
[14 Mechanisms]  [32 Contexts]     [4 Lifecycles]    [24 Oracles]       [18 Dialects]
- Delimiter Break- WHERE String    - 1st-Order Sync  - In-Band Canary   - PostgreSQL / MySQL
- Logic Mutation - Numeric / Bit   - 2nd-Order Store - Error CAST / XPath- MSSQL / Oracle
- Set Projection - ORDER BY / ID   - Async Queue Job - Wald SPRT Time   - SQLite / Cockroach
- Type Coercion  - JSONB Path / Op - Multi-Service   - OOB DNS / HTTP   - DuckDB / Snowflake
- Time Delay     - DML Insert/Update                 - Metamorphic TLP  - ClickHouse / Trino
- Stacked Batch  - Procedural / CTE                  - AST Differ       - Hana / Db2 / Derby
- Out-of-Band    - Vector Distance                   - Side-Channel
- Metamorphic    - Array Slice
- Side-Channel   - Savepoint / Lock
- AI Text-to-SQL
```

---

## 2. The 14 Fundamental Vulnerability Mechanisms ($M$)

| Mechanism ID | Mechanism Name | Formal Theoretical Definition | Root Cause / Fault Class |
|:---|:---|:---|:---|
| **`MECH-01`** | **Syntactic Delimiter Escape & Truncation** | Premature lexical breakout of string/identifier boundaries via quotes (`'`, `"`, `` ` ``), brackets (`[]`), or comment truncation (`--`, `/*`, `#`, `;%00`). | Unescaped string concatenation into SQL text without lexical boundary isolation. |
| **`MECH-02`** | **Relational Logic & Predicate Mutation** | Inverting boolean logic trees through relational tautologies (`TRUE`), contradictions (`FALSE`), or conditional branches (`CASE WHEN`). | Lack of semantic separation between user data literals and relational logic operators. |
| **`MECH-03`** | **In-Band Projection Set Operations** | Grafting secondary `SELECT` statements via `UNION`, `UNION ALL`, `EXCEPT`, or `INTERSECT` to project arbitrary database records into the result set. | Dynamic query construction allowing unconstrained set-operation composition. |
| **`MECH-04`** | **Explicit Type Coercion & Error Induction** | Coercing database values into incompatible scalar types (`int`, `numeric`, `xml`) to force runtime exceptions that leak data in error strings. | Verbose database exception propagation into client-facing web application responses. |
| **`MECH-05`** | **Deterministic & Sequential Statistical Delay** | Executing procedural sleep commands (`pg_sleep`, `SLEEP`, `WAITFOR DELAY`) verified via Wald Sequential Probability Ratio Testing (SPRT). | Inline execution of time-delay primitives inside relational predicate evaluation. |
| **`MECH-06`** | **Stacked Batch & Procedural Execution** | Terminating the primary statement with `;` and executing separate DDL/DML/DCL statements or procedural blocks (`BEGIN ... END`). | Multi-statement execution permitted by database driver configuration (`multiStatements=true`). |
| **`MECH-07`** | **Out-of-Band (OAST) Protocol Interaction** | Coercing database network functions (`UTL_HTTP`, `xp_dirtree`, `dblink`) to initiate outbound DNS, HTTP, or SMB interactions. | Database engines equipped with network-capable built-in procedures accessible to application users. |
| **`MECH-08`** | **Second-Order & Stored State Ingress** | Input stored safely during Ingress Stage ($S_1$) and unsafely evaluated during downstream Execution Stage ($S_2$). | Developer assuming that data retrieved from an internal database table is inherently trusted. |
| **`MECH-09`** | **Metamorphic Relational Partitioning (TLP / NoREC)** | Mutating queries into mathematically equivalent partitioned subqueries without syntax errors to observe row count invariance. | Query optimizer or relational logic evaluation discrepancies in backend query execution. |
| **`MECH-10`** | **Structural & Grammar Differential Testing** | Inducing grammar parser discrepancies between web proxies/WAFs and backend database parsers. | Parser differential caused by inconsistent handling of whitespace, comments, or charsets. |
| **`MECH-11`** | **Side-Channel Cache & Resource Contention** | Inducing measurable latency differentials via heavy computational operations (`BENCHMARK()`, Cartesian joins, disk sorting). | Resource exhaustion primitives evaluatable inline without dedicated sleep functions. |
| **`MECH-12`** | **Binary Protocol & Driver Parameter Smuggling** | Corrupting the binary protocol framing (e.g. MySQL `COM_STMT_EXECUTE` vs `COM_QUERY`) to alter query boundaries. | Driver-level protocol desynchronization and parameter offset misalignment. |
| **`MECH-13`** | **Transaction, Savepoint & Lock Manipulation** | Injecting transaction commands (`COMMIT`, `ROLLBACK TO SAVEPOINT`, `pg_advisory_lock`) to manipulate data consistency and lock state. | Dynamic query builders allowing transaction control statements inside unparameterized blocks. |
| **`MECH-14`** | **AI Text-to-SQL Semantic Projection Hijacking** | Prompt injection into natural-language-to-SQL translation agents causing the LLM to generate malicious SQL projections. | LLM database agents translating untrusted user text into unparameterized dynamic SQL. |

---

## 3. Combinatorial Multi-Dimensional Architecture

To prevent misleading linear counting, every executable test case $T$ is represented as a point in an **11-Dimensional Coordinate Space**:

$$\mathcal{S} = \mathcal{M} \times \mathcal{C}_{tx} \times \mathcal{D} \times \mathcal{V} \times \mathcal{L} \times \mathcal{T} \times \mathcal{O} \times \mathcal{A} \times \mathcal{E} \times \mathcal{I} \times \mathcal{K}$$

Where:
- $\mathcal{M}$: 14 Mechanisms
- $\mathcal{C}_{tx}$: 32 Syntactic Grammar Contexts
- $\mathcal{D}$: 18 Database Dialects
- $\mathcal{V}$: Engine Major/Minor Versions
- $\mathcal{L}$: 4 Lifecycles (First-Order Sync, Second-Order Stored, Async Worker, Multi-Service Mesh)
- $\mathcal{T}$: 14 Ingress Transport Surfaces
- $\mathcal{O}$: 24 Observation Channels
- $\mathcal{A}$: 10 Application / ORM Framework Layers
- $\mathcal{E}$: 8 Transformation / Encoding Layers
- $\mathcal{I}$: 5 Inference & Extraction Strategies (Direct, Binary, Bitwise, Shannon Entropy, Wald SPRT)
- $\mathcal{K}$: 9 Demonstrated Security Impact Classes

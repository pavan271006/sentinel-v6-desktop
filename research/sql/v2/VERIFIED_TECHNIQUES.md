# Master Validated Techniques Catalog (52 Deduplicated Techniques)

**Document Reference:** SENTINEL-V2-TECH-04  
**Classification:** Deduplicated & Source-Verified Exploitation Strategies  
**Deduplication Audit:** 84 Draft Entries $\to$ 52 Validated Distinct Techniques  

---

## 1. Deduplication & Verification Audit Summary

In V1, 84 techniques were listed. An audit identified that:
* 18 entries were cosmetic comment/quote variants of `TECH-001` (merged).
* 8 entries were dialect-specific sleep variants of a single timing technique (merged into subtechniques of `TECH-V2-21`).
* 6 entries were dialect-specific error CAST variants of `TECH-V2-16` (merged into subtechniques).
* The remaining techniques were mapped strictly to the 8 Validated Mechanisms.

---

## 2. Master Validated Techniques Table (TECH-V2-01 to TECH-V2-52)

| Technique ID | Technique Name | Parent Mechanism | Compatible Contexts | Compatible DBMS | Primary Oracle | Safety Class | Evidence |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **`TECH-V2-01`** | Single-Quote String Delimiter Breakout | `MECH-01` | `CTX-01` | All major DBMSs | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-02`** | Double-Quote Identifier / String Breakout | `MECH-01` | `CTX-02` | PostgreSQL, MySQL, SQLite | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-03`** | PostgreSQL Dollar-Quote Tag Breakout | `MECH-01` | `CTX-03` | PostgreSQL, CockroachDB | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-04`** | Oracle Q-Quote Literal Breakout | `MECH-01` | `CTX-04` | Oracle Database | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-05`** | MySQL Backtick Identifier Breakout | `MECH-01` | `CTX-06` | MySQL, MariaDB, SQLite | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-06`** | MSSQL Bracket Identifier Breakout | `MECH-01` | `CTX-02` | Microsoft SQL Server | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-07`** | Boolean Relational Tautology (`OR 1=1`) | `MECH-02` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-08`** | Boolean Relational Contradiction (`AND 1=2`)| `MECH-02` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-09`** | Arithmetic Equivalence Differential (`10-1`)| `MECH-02` | `CTX-07` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-10`** | Conditional Branch Projection (`CASE WHEN`)| `MECH-02` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-11`** | Null-Safe Relational Equality (`<=>` / `IS NOT DISTINCT`)| `MECH-02` | `CTX-01`, `CTX-07` | MySQL, PostgreSQL | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-12`** | Subquery Existence Predicate (`EXISTS(...)`)| `MECH-02` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-13`** | UNION Projection Column Sweep (1..N) | `MECH-03` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-CANARY-BODY` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-14`** | Type-Aligned Canary Column Projection | `MECH-03` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-CANARY-BODY` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-15`** | Multi-Column Delimited Extraction Projection| `MECH-03` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-CANARY-BODY` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-16`** | EXCEPT / MINUS Set Difference Probe | `MECH-03` | `CTX-01`, `CTX-07` | PostgreSQL, MSSQL, Oracle | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E4`** |
| **`TECH-V2-17`** | Explicit Integer Type CAST Coercion Leak | `MECH-04` | `CTX-01`, `CTX-07` | PostgreSQL, MSSQL, Oracle | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-18`** | MySQL XPath Function Error Leak (`EXTRACTVALUE`)| `MECH-04` | `CTX-01`, `CTX-07` | MySQL ($\le 8.0$), MariaDB | `ORC-XPATH-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-19`** | Oracle CTXSYS Package Error Leak | `MECH-04` | `CTX-01`, `CTX-07` | Oracle Database | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E4`** |
| **`TECH-V2-20`** | Arithmetic Division-by-Zero Exception (`1/0`)| `MECH-04` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-DIV-ZERO-ERROR`| `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-21`** | Wald SPRT Statistical Latency Delay Probe | `MECH-04` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-TIME-SPRT` | `TIMING_SENSITIVE`| **`E5`** |
| **`TECH-V2-22`** | Computational Heavy Function Delay (`BENCHMARK`)| `MECH-04` | `CTX-01`, `CTX-07` | MySQL, SQLite | `ORC-TIME-COMPUTE`| `TIMING_SENSITIVE`| **`E4`** |
| **`TECH-V2-23`** | Out-of-Band Built-in Network Procedure Probe | `MECH-04` | `CTX-01`, `CTX-07` | MSSQL, Oracle, PG | `ORC-OOB-DNS` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-24`** | PostgreSQL Regex Catastrophic Backtracking | `MECH-04` | `CTX-01` | PostgreSQL | `ORC-TIME-COMPUTE`| `TIMING_SENSITIVE`| **`E3`** |
| **`TECH-V2-25`** | Semicolon Statement Chaining (Stacked) | `MECH-05` | `CTX-01`, `CTX-07` | MSSQL, PostgreSQL (Driver) | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E5`** |
| **`TECH-V2-26`** | PostgreSQL Anonymous Procedural Block (`DO $$`)| `MECH-05` | `CTX-01`, `CTX-07` | PostgreSQL | `ORC-TIME-SPRT` | `STATE_DEPENDENT`| **`E5`** |
| **`TECH-V2-27`** | T-SQL Dynamic Batch (`sp_executesql`) | `MECH-05` | `CTX-01`, `CTX-07` | Microsoft SQL Server | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E5`** |
| **`TECH-V2-28`** | Oracle Anonymous Procedural Block (`BEGIN ... END`)| `MECH-05` | `CTX-01`, `CTX-07` | Oracle Database | `ORC-TIME-SPRT` | `STATE_DEPENDENT`| **`E5`** |
| **`TECH-V2-29`** | UPDATE SET Additional Column Assignment | `MECH-06` | `CTX-27` | All major DBMSs | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E5`** |
| **`TECH-V2-30`** | INSERT VALUES Additional Tuple Row Injection | `MECH-06` | `CTX-25` | All major DBMSs | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E5`** |
| **`TECH-V2-31`** | UPSERT ON CONFLICT Assignment Override | `MECH-06` | `CTX-29` | PostgreSQL, SQLite | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E4`** |
| **`TECH-V2-32`** | MERGE Statement Dynamic Join Mutation | `MECH-06` | `CTX-30` | MSSQL, Oracle, PG 15+ | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E4`** |
| **`TECH-V2-33`** | Dynamic ORDER BY Column Index Out-of-Bounds | `MECH-07` | `CTX-12` | All major DBMSs | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-34`** | Dynamic ORDER BY Conditional CASE Expression | `MECH-07` | `CTX-12` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-35`** | Dynamic ORDER BY Direction Keyword Injection | `MECH-07` | `CTX-13` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-36`** | GROUP BY Expression Projection Injection | `MECH-07` | `CTX-14` | All major DBMSs | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-37`** | HAVING Count Aggregate Predicate Mutation | `MECH-07` | `CTX-15` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-38`** | LIMIT / OFFSET Integer Arithmetic Differential| `MECH-07` | `CTX-16`, `CTX-17`| All major DBMSs | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-39`** | Dynamic Table Name Subquery Alias Grafting | `MECH-07` | `CTX-21` | All major DBMSs | `ORC-CANARY-BODY` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-40`** | Dynamic Column Projection Subquery Grafting | `MECH-07` | `CTX-22` | All major DBMSs | `ORC-CANARY-BODY` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-41`** | Transaction Boundary Injection (`COMMIT`) | `MECH-08` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E4`** |
| **`TECH-V2-42`** | Savepoint Rollback Mutation | `MECH-08` | `CTX-01`, `CTX-07` | PostgreSQL, MySQL, MSSQL | `ORC-STATE-READ` | `STATE_DEPENDENT`| **`E4`** |
| **`TECH-V2-43`** | Advisory Concurrency Lock Delay (`pg_advisory_lock`)| `MECH-08` | `CTX-01`, `CTX-07` | PostgreSQL | `ORC-TIME-SPRT` | `TIMING_SENSITIVE`| **`E4`** |
| **`TECH-V2-44`** | TypeORM Dynamic orderBy Unquoted Identifier | `MECH-07` | `CTX-12` | All ORM Targets | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-45`** | Sequelize.literal Raw Fragment Injection | `MECH-04` | `CTX-01` | MySQL, PostgreSQL | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-46`** | Prisma $queryRawUnsafe Template String Injection| `MECH-01` | `CTX-01` | PostgreSQL, MySQL | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-47`** | Django ORM extra(where=[...]) Injection | `MECH-02` | `CTX-01` | PostgreSQL, MySQL | `ORC-BOOLEAN-DIFF` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-48`** | Hibernate HQL Entity Projection Injection | `MECH-03` | `CTX-01` | All Java Backends | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-49`** | pgvector Cosine Similarity Metric Injection (`<=>`)| `MECH-04` | `CTX-35` | PostgreSQL (pgvector) | `ORC-SYNTAX-ERROR` | `PARALLEL_SAFE` | **`E4`** |
| **`TECH-V2-50`** | PostgreSQL JSONB ->> Dynamic Key Injection | `MECH-04` | `CTX-34` | PostgreSQL | `ORC-CAST-ERROR` | `PARALLEL_SAFE` | **`E5`** |
| **`TECH-V2-51`** | Binary Search Range Extraction | `MECH-02` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-BOOLEAN-DIFF` | `ORDER_DEPENDENT` | **`E5`** |
| **`TECH-V2-52`** | 5-Step Counterfactual Causal Verification | `MECH-02` | `CTX-01`, `CTX-07` | All major DBMSs | `ORC-MULTI-FUSED` | `PARALLEL_SAFE` | **`E5`** |

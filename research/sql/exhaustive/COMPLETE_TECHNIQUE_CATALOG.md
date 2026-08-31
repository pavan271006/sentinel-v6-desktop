# Complete Technique Catalog (84 Distinct Exploitation Techniques)

**Document Identifier:** SENTINEL-EXH-TECH-03  
**Classification:** Granular Exploitation Strategy Inventory  
**Rule**: Subtechniques and cosmetic mutations are grouped under their parent technique.  

---

## 1. Catalog Architecture

Every technique represents a distinct, mathematically or relationally unique exploitation method:

```
[ Fundamental Mechanism: MECH-01..16 ] ──► [ Distinct Technique: TECH-001..084 ] ──► [ Subtechniques: SUB-001..312 ]
```

---

## 2. Master Catalog Table (TECH-001 to TECH-084)

| Technique ID | Technique Name | Parent Mechanism | Primary Intent | Compatible DBMS | Primary Oracle | Safety Class | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **`TECH-001`** | Single-Quote Delimiter Breakout & Suffix Truncation | `MECH-01` | `DELIMITER_BREAKOUT` | All major DBMSs | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-002`** | Double-Quote Identifier / String Breakout | `MECH-01` | `DELIMITER_BREAKOUT` | PostgreSQL, MySQL, SQLite | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-003`** | PostgreSQL Dollar-Quote Tag Breakout | `MECH-01` | `DELIMITER_BREAKOUT` | PostgreSQL, CockroachDB | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-004`** | Oracle Q-Quote Literal Breakout | `MECH-01` | `DELIMITER_BREAKOUT` | Oracle Database | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-005`** | MySQL Backtick Identifier Breakout | `MECH-01` | `DELIMITER_BREAKOUT` | MySQL, MariaDB, SQLite | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-006`** | MSSQL Bracket Identifier Breakout | `MECH-01` | `DELIMITER_BREAKOUT` | Microsoft SQL Server | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-007`** | Null-Byte Suffix Truncation (`%00`) | `MECH-01` | `DELIMITER_BREAKOUT` | Legacy PHP/MySQL ($\le 5.3$) | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **HISTORICAL** |
| **`TECH-008`** | Boolean-Blind Relational Tautology (`1=1`) | `MECH-02` | `TRUE_FALSE_DIFFERENTIAL`| All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-009`** | Boolean-Blind Relational Contradiction (`1=2`)| `MECH-02` | `TRUE_FALSE_DIFFERENTIAL`| All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-010`** | Arithmetic Equivalence Differential (`10-1`)| `MECH-02` | `TRUE_FALSE_DIFFERENTIAL`| All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-011`** | Conditional Branching (`CASE WHEN ... THEN`)| `MECH-02` | `TRUE_FALSE_DIFFERENTIAL`| All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-012`** | Null-Safe Relational Equality (`<=>` / `IS NOT DISTINCT`)| `MECH-02` | `TRUE_FALSE_DIFFERENTIAL`| MySQL, PostgreSQL | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-013`** | UNION Projection Column Count Probe (1..N) | `MECH-03` | `UNION_COMPATIBILITY` | All major DBMSs | `UNION_CANARY_REFLECTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-014`** | Type-Aligned Canary Column Projection | `MECH-03` | `UNION_COMPATIBILITY` | All major DBMSs | `UNION_CANARY_REFLECTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-015`** | Multi-Column Delimited Extraction | `MECH-03` | `METADATA_DISCOVERY` | All major DBMSs | `DIRECT_IN_BAND_REFLECTION`| `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-016`** | EXCEPT / INTERSECT Set Differential Probe | `MECH-03` | `METAMORPHIC_RELATION` | PostgreSQL, MSSQL, Oracle | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-017`** | PostgreSQL Integer CAST Error Leak | `MECH-04` | `ERROR_BEHAVIOR` | PostgreSQL, CockroachDB | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-018`** | MSSQL CONVERT Type Coercion Leak | `MECH-04` | `ERROR_BEHAVIOR` | Microsoft SQL Server | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-019`** | MySQL EXTRACTVALUE XPath Error Leak | `MECH-04` | `ERROR_BEHAVIOR` | MySQL ($\le 8.0$), MariaDB | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-020`** | MySQL UpdateXML XPath Error Leak | `MECH-04` | `ERROR_BEHAVIOR` | MySQL ($\le 8.0$), MariaDB | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-021`** | Oracle CTXSYS.DRITHSX.SN Error Leak | `MECH-04` | `ERROR_BEHAVIOR` | Oracle Database | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-022`** | Oracle UTL_INADDR Error Leak | `MECH-04` | `ERROR_BEHAVIOR` | Oracle Database | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-023`** | Arithmetic Division-by-Zero Exception (`1/0`)| `MECH-04` | `ERROR_BEHAVIOR` | All major DBMSs | `BOOLEAN_STATUS_CODE` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-024`** | Numeric Overflow Error Induction | `MECH-04` | `ERROR_BEHAVIOR` | MySQL (`~0 + 1`), MSSQL | `BOOLEAN_STATUS_CODE` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-025`** | PostgreSQL Regex Backtracking Error | `MECH-04` | `ERROR_BEHAVIOR` | PostgreSQL | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **RESEARCH** |
| **`TECH-026`** | Wald SPRT Sequential Latency Shift Probe | `MECH-05` | `TIMING_BEHAVIOR` | All major DBMSs | `SPRT_STATISTICAL_LATENCY`| `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-027`** | Fixed Threshold Delay Probe (`pg_sleep`)| `MECH-05` | `TIMING_BEHAVIOR` | PostgreSQL, YugabyteDB | `FIXED_TIME_DELAY` | `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-028`** | Fixed Threshold Delay Probe (`SLEEP`)| `MECH-05` | `TIMING_BEHAVIOR` | MySQL, MariaDB, TiDB | `FIXED_TIME_DELAY` | `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-029`** | Fixed Threshold Delay Probe (`WAITFOR DELAY`)| `MECH-05` | `TIMING_BEHAVIOR` | Microsoft SQL Server | `FIXED_TIME_DELAY` | `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-030`** | Fixed Threshold Delay Probe (`DBMS_LOCK.SLEEP`)| `MECH-05` | `TIMING_BEHAVIOR` | Oracle Database | `FIXED_TIME_DELAY` | `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-031`** | SQLite Heavy Computational Subquery Delay | `MECH-05` | `TIMING_BEHAVIOR` | SQLite | `SPRT_STATISTICAL_LATENCY`| `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-032`** | Snowflake SYSTEM$WAIT Delay Probe | `MECH-05` | `TIMING_BEHAVIOR` | Snowflake Cloud DWH | `FIXED_TIME_DELAY` | `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-033`** | Semicolon Multi-Statement Chaining | `MECH-06` | `STACKED_BATCH_TEST` | MSSQL, PostgreSQL (Driver) | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-034`** | PostgreSQL Anonymous Procedural Block (`DO $$`)| `MECH-06` | `STACKED_BATCH_TEST` | PostgreSQL | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-035`** | T-SQL Dynamic Execution (`sp_executesql`)| `MECH-06` | `STACKED_BATCH_TEST` | Microsoft SQL Server | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-036`** | Oracle Anonymous Block (`BEGIN ... END;`)| `MECH-06` | `STACKED_BATCH_TEST` | Oracle Database | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-037`** | MSSQL xp_dirtree SMB/DNS Exfiltration | `MECH-07` | `OOB_INTERACTION_TEST` | Microsoft SQL Server | `OOB_DNS_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-038`** | MSSQL xp_fileexist UNC Network Probe | `MECH-07` | `OOB_INTERACTION_TEST` | Microsoft SQL Server | `OOB_DNS_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-039`** | Oracle UTL_HTTP Outbound Webhook Probe | `MECH-07` | `OOB_INTERACTION_TEST` | Oracle Database | `OOB_HTTP_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-040`** | Oracle UTL_INADDR DNS Hostname Exfiltration | `MECH-07` | `OOB_INTERACTION_TEST` | Oracle Database | `OOB_DNS_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-041`** | Oracle DBMS_LDAP Outbound Network Probe | `MECH-07` | `OOB_INTERACTION_TEST` | Oracle Database | `OOB_DNS_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-042`** | PostgreSQL dblink Outbound Network Probe | `MECH-07` | `OOB_INTERACTION_TEST` | PostgreSQL | `OOB_DNS_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-043`** | MySQL Windows UNC LOAD_FILE Probe | `MECH-07` | `OOB_INTERACTION_TEST` | MySQL (Windows host) | `OOB_DNS_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-044`** | ClickHouse url() Table Function Exfiltration | `MECH-07` | `OOB_INTERACTION_TEST` | ClickHouse OLAP | `OOB_HTTP_INTERACTION` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-045`** | Stored User Registration to Profile Workflow | `MECH-08` | `STATE_TRANSITION_TEST` | All major DBMSs | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-046`** | Support Ticket Stored to Admin Report Workflow | `MECH-08` | `STATE_TRANSITION_TEST` | All major DBMSs | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-047`** | Stored Comment to Audit Log Workflow | `MECH-08` | `STATE_TRANSITION_TEST` | All major DBMSs | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-048`** | Stored Configuration to Background Job | `MECH-08` | `STATE_TRANSITION_TEST` | All major DBMSs | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-049`** | Ternary Logic Partitioning (TLP) Invariance | `MECH-09` | `METAMORPHIC_RELATION` | PostgreSQL, MySQL, SQLite | `METAMORPHIC_INVARIANT` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-050`** | Non-Optimizing Reference Comparison (NoREC)| `MECH-09` | `METAMORPHIC_RELATION` | SQLite, PostgreSQL, MySQL | `METAMORPHIC_INVARIANT` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-051`** | Predicate Query Synthesis (PQS) Evaluation | `MECH-09` | `METAMORPHIC_RELATION` | PostgreSQL, SQLite | `METAMORPHIC_INVARIANT` | `PARALLEL_SAFE` | **RESEARCH** |
| **`TECH-052`** | Inline Version-Specific Comment Parsing (`/*!50000`)| `MECH-10` | `PARSER_DIFFERENTIAL` | MySQL, MariaDB | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-053`** | Whitespace Control Byte Substitution (`%09`, `%0a`)| `MECH-10` | `PARSER_DIFFERENTIAL` | All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-054`** | Double-Encoding Parser Differential (`%2527`)| `MECH-10` | `PARSER_DIFFERENTIAL` | All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-055`** | UTF-8 Overlong / Homoglyph Translation | `MECH-10` | `PARSER_DIFFERENTIAL` | MySQL (utf8mb3), MSSQL | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-056`** | MySQL BENCHMARK() CPU Contention Delay | `MECH-11` | `TIMING_BEHAVIOR` | MySQL, MariaDB | `SPRT_STATISTICAL_LATENCY`| `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-057`** | Cartesian Product Heavy Join Delay | `MECH-11` | `TIMING_BEHAVIOR` | All major DBMSs | `SPRT_STATISTICAL_LATENCY`| `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-058`** | PostgreSQL rpad() Memory Allocation Delay | `MECH-11` | `TIMING_BEHAVIOR` | PostgreSQL | `SPRT_STATISTICAL_LATENCY`| `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-059`** | MySQL Protocol COM_QUERY Parameter Desync | `MECH-12` | `PROTOCOL_DESYNC` | MySQL Drivers | `BOOLEAN_CONTENT_DIFF` | `STATE_DEPENDENT`| **RESEARCH** |
| **`TECH-060`** | PostgreSQL pg_advisory_lock Concurrency Lock | `MECH-13` | `LOCK_MANIPULATION` | PostgreSQL | `SPRT_STATISTICAL_LATENCY`| `TIMING_SENSITIVE`| **CONFIRMED** |
| **`TECH-061`** | Transaction Rollback to Savepoint Manipulation | `MECH-13` | `TRANSACTION_CONTROL` | PostgreSQL, MySQL, MSSQL | `STATE_CHANGE_SIDE_EFFECT`| `STATE_DEPENDENT`| **CONFIRMED** |
| **`TECH-062`** | AI Text-to-SQL Prompt Delimiter Injection | `MECH-14` | `AI_PROMPT_INJECTION` | LLM SQL Agents | `DIRECT_IN_BAND_REFLECTION`| `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-063`** | AI Database Agent Schema Exfiltration Prompt | `MECH-14` | `AI_PROMPT_INJECTION` | LLM SQL Agents | `DIRECT_IN_BAND_REFLECTION`| `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-064`** | TypeORM Unquoted orderBy Column Injection | `MECH-15` | `ORDER_BOUNDARY` | PostgreSQL, MySQL, MSSQL | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-065`** | Sequelize.literal() Raw Fragment Injection | `MECH-15` | `RAW_ESCAPE_INJECTION` | MySQL, PostgreSQL | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-066`** | Prisma $queryRawUnsafe Template String Injection| `MECH-15` | `RAW_ESCAPE_INJECTION` | PostgreSQL, MySQL | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-067`** | Django ORM .extra(where=[...]) String Formatting| `MECH-15` | `RAW_ESCAPE_INJECTION` | PostgreSQL, MySQL | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-068`** | SQLAlchemy text() Dynamic Clause Concatenation | `MECH-15` | `RAW_ESCAPE_INJECTION` | PostgreSQL, MySQL | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-069`** | ActiveRecord .where("#{...}") Ruby String Interpolation | `MECH-15` | `RAW_ESCAPE_INJECTION` | PostgreSQL, MySQL | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-070`** | Hibernate HQL Entity Projection Injection | `MECH-15` | `HQL_JPQL_INJECTION` | All Java Backends | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-071`** | MyBatis Dynamic ${param} String Substitution | `MECH-15` | `FRAMEWORK_INJECTION` | Java Enterprise | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-072`** | Spring Data JPA @Query Unvalidated Dynamic SQL | `MECH-15` | `FRAMEWORK_INJECTION` | Java Enterprise | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-073`** | Entity Framework Core FromSqlRaw String Concatenation | `MECH-15` | `RAW_ESCAPE_INJECTION` | Microsoft SQL Server | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-074`** | Laravel Eloquent whereRaw() Concatenation | `MECH-15` | `RAW_ESCAPE_INJECTION` | MySQL, PostgreSQL | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-075`** | GORM db.Raw() Go String Formatting Injection | `MECH-15` | `RAW_ESCAPE_INJECTION` | PostgreSQL, MySQL | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-076`** | PostgreSQL pgvector Cosine Distance Injection (`<=>`)| `MECH-16` | `VECTOR_METRIC_INJECTION`| PostgreSQL (pgvector) | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-077`** | PostgreSQL pgvector L2 Euclidean Distance Injection (`<->`)| `MECH-16` | `VECTOR_METRIC_INJECTION`| PostgreSQL (pgvector) | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-078`** | PostgreSQL JSONB ->> Key Extraction Injection | `MECH-15` | `JSON_PATH_INJECTION` | PostgreSQL | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-079`** | MySQL JSON_EXTRACT Dynamic Path Injection | `MECH-15` | `JSON_PATH_INJECTION` | MySQL | `VERBOSE_SYNTAX_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-080`** | GraphQL Variable JSON Array Deserialization Injection | `MECH-15` | `GRAPHQL_RESOLVER_INJ` | Node/Go/Python GraphQL | `CAST_TYPE_ERROR` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-081`** | Dynamic CASE ORDER BY Boundary Test | `MECH-02` | `ORDER_BOUNDARY` | All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `PARALLEL_SAFE` | **CONFIRMED** |
| **`TECH-082`** | Binary Search ASCII Character Recovery | `MECH-02` | `BINARY_SEARCH_EXTRACTION`| All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `ORDER_DEPENDENT` | **CONFIRMED** |
| **`TECH-083`** | Frequency-Weighted Shannon Entropy Character Recovery | `MECH-02` | `ENTROPY_EXTRACTION` | All major DBMSs | `BOOLEAN_CONTENT_DIFF` | `ORDER_DEPENDENT` | **CONFIRMED** |
| **`TECH-084`** | 5-Step Counterfactual Causal Verification Gating | `MECH-02` | `CAUSAL_CONTROL` | All major DBMSs | `MULTI_ORACLE_FUSED` | `PARALLEL_SAFE` | **CONFIRMED** |

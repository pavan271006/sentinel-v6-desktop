# UCMA-X — Master SQL Security Taxonomy & Dimension Model

**Document Version:** 4.0-ENTERPRISE  
**Standard:** ISO/IEC/IEEE 29119 Software Testing & OWASP WSTG-INPV-05  
**Taxonomy Class:** 11-Dimensional Normalized Relational Security Model  

---

## 1. Executive Taxonomy Architecture

Conventional security scanners treat SQL security test cases as flat lists of payload strings (e.g. 5,000+ regexes or wordlist variations). This approach causes severe combinatorial explosion, redundant HTTP requests, and high false-positive rates. 

UCMA-X replaces flat lists with an **11-Dimensional Normalized Relational Model**, where every executable test configuration $C$ is a precise tuple:

$$C = \langle M, C_{tx}, O, L, T, A, D, R, I, K, S \rangle$$

```
                                  MASTER SQL SECURITY TAXONOMY
                                                │
    ┌──────────────┬──────────────┬─────────────┼─────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼             ▼             ▼              ▼              ▼
[Mechanism]    [Context]     [Oracle]      [Lifecycle]   [Transport]    [App Layer]    [DBMS]
 (M01-M09)    (22 Contexts) (15 Channels)  (1st/2nd/Async)(10 Protocols) (Raw/ORM/LLM) (12 Dialects)
    │              │              │             │             │              │              │
    └──────────────┴──────────────┴─────────────┼─────────────┴──────────────┴──────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
          [Representation]             [Inference Strategy]            [Demonstrated Impact]
           (7 Encodings)               (Binary/Entropy/SPRT)            (Read/Auth/OS/Tenant)
```

---

## 2. The 11 Taxonomy Dimensions

### Dimension A: Root SQL Security Mechanism ($M$)
The core relational, syntactic, or execution principle being exercised:
- **M01: Syntactic Breakout & Delimiter Injection** — Quotes (`'`, `"`), brackets, parentheses, comments (`--`, `/*`, `#`).
- **M02: Boolean-Logic Differential Predicates** — Tautology vs. contradiction (`1=1` vs `1=2`, `'a'='a'` vs `'a'='b'`).
- **M03: In-Band Set Operations (UNION / EXCEPT / INTERSECT)** — Column count alignment and type-compatible canary reflection.
- **M04: Verbose Error & Explicit Type Coercion** — Conversion failures (`CAST(x AS int)`, `CONVERT()`, `EXTRACTVALUE()`).
- **M05: Deterministic & Statistical Time-Delay (SPRT)** — Sleep primitives (`pg_sleep()`, `SLEEP()`, `WAITFOR DELAY`).
- **M06: Stacked Batched Queries & State Side-Effects** — Semicolon-delimited multi-statement execution.
- **M07: Out-of-Band (OAST) Network Interactions** — DNS resolution and HTTP callbacks (`UTL_HTTP`, `xp_dirtree`).
- **M08: Multi-Step & Second-Order Storage** — Ingress injection persisted and triggered by downstream workflows.
- **M09: Relational Metamorphic Equivalence (TLP / NoREC)** — Differential partitioning invariants without syntax errors.

---

### Dimension B: SQL Grammar Context ($C_{tx}$)
The structural position within the backend query AST where user input is embedded:
1. `WHERE_STRING_SINGLE`: `' WHERE name = '<INPUT>'`
2. `WHERE_STRING_DOUBLE`: `" WHERE name = "<INPUT>"`
3. `WHERE_NUMERIC`: `WHERE id = <INPUT>`
4. `WHERE_PARENTHESIZED`: `WHERE (id = (<INPUT>))`
5. `ORDER_BY_EXPRESSION`: `ORDER BY <INPUT>`
6. `ORDER_BY_IDENTIFIER`: `ORDER BY column_name <INPUT>` (ASC/DESC)
7. `GROUP_BY_CLAUSE`: `GROUP BY <INPUT>`
8. `HAVING_CLAUSE`: `HAVING COUNT(*) > <INPUT>`
9. `JOIN_ON_CONDITION`: `JOIN tbl ON tbl.id = <INPUT>`
10. `INSERT_VALUES`: `INSERT INTO tbl (c1, c2) VALUES ('a', '<INPUT>')`
11. `UPDATE_SET`: `UPDATE tbl SET status = '<INPUT>'`
12. `LIKE_PATTERN`: `WHERE name LIKE '%<INPUT>%'`
13. `IN_LIST`: `WHERE category IN (<INPUT>)`
14. `CASE_EXPRESSION`: `CASE WHEN <INPUT> THEN 1 ELSE 0 END`
15. `FUNCTION_ARGUMENT`: `SELECT SUBSTRING(data, <INPUT>, 1)`
16. `SUBQUERY_EXISTS`: `WHERE EXISTS (SELECT 1 FROM tbl WHERE <INPUT>)`
17. `CTE_WITH_CLAUSE`: `WITH cte AS (SELECT <INPUT>)`
18. `WINDOW_PARTITION`: `OVER (PARTITION BY <INPUT> ORDER BY id)`
19. `IDENTIFIER_TABLE_COLUMN`: `SELECT * FROM <INPUT>`
20. `JSON_PATH_EXPRESSION`: `WHERE data->>'<INPUT>' = 'val'`
21. `DYNAMIC_EXEC_SQL`: `EXECUTE IMMEDIATE '<INPUT>'`
22. `STORED_PROC_CALL`: `CALL get_user(<INPUT>)`

---

### Dimension C: Observation Channel ($O$)
The oracle used to observe target response deviations:
1. `DIRECT_IN_BAND_REFLECTION`: User input / database output rendered directly in HTTP response body.
2. `UNION_CANARY_REFLECTION`: Unique content-derived nonce rendered in aligned UNION projection.
3. `CAST_TYPE_ERROR`: Verbose database error revealing data in integer conversion failure.
4. `VERBOSE_SYNTAX_ERROR`: Raw database parsing engine syntax error string.
5. `BOOLEAN_CONTENT_DIFF`: Text / DOM divergence between TRUE and FALSE predicates.
6. `BOOLEAN_STATUS_CODE`: HTTP status code delta (e.g. 200 OK vs 500 / 404).
7. `DOM_STRUCTURAL_DIFF`: Subtree modification, tag count changes, or element disappearance.
8. `SPRT_STATISTICAL_LATENCY`: Wald Sequential Probability Ratio Test on latency shift.
9. `FIXED_TIME_DELAY`: Hard sleep threshold exceeding baseline $+ 3\sigma$.
10. `HTTP_HEADER_DIFF`: Delta in response headers (e.g. `Set-Cookie`, `Location`, custom auth).
11. `HTTP_REDIRECT_LOCATION`: Differential in 301/302 `Location` URL parameters.
12. `STATE_CHANGE_SIDE_EFFECT`: Subsequent query returns modified state.
13. `OOB_DNS_INTERACTION`: Out-of-band DNS resolution logged at listener gateway.
14. `OOB_HTTP_INTERACTION`: Out-of-band HTTP GET/POST callback logged at listener.
15. `METAMORPHIC_INVARIANT`: Partitioning count invariance $N(P) + N(\neg P) = N(\text{All})$.

---

### Dimension D: Execution Lifecycle ($L$)
- `FIRST_ORDER_SYNC`: Input injected, evaluated, and observed in the immediate HTTP response.
- `SECOND_ORDER_STORED`: Input stored in database, executed when another endpoint queries it.
- `ASYNC_WORKER_QUEUED`: Input processed by background Celery/Sidekiq/RabbitMQ queue worker.

---

### Dimension E: Ingress Transport ($T$)
1. `HTTP_QUERY_PARAM`: `GET /path?id=val`
2. `HTTP_BODY_FORM`: `POST /path (application/x-www-form-urlencoded)`
3. `HTTP_BODY_JSON`: `POST /path (application/json)` with nested key paths
4. `HTTP_BODY_MULTIPART`: `POST /path (multipart/form-data)`
5. `HTTP_BODY_XML`: `POST /path (application/xml, text/xml)`
6. `HTTP_COOKIE`: `Cookie: session=val; TrackingId=val`
7. `HTTP_CUSTOM_HEADER`: `X-Forwarded-For`, `User-Agent`, `Referer`, `Authorization`
8. `REST_PATH_SEGMENT`: `GET /api/v1/users/{id}/details`
9. `GRAPHQL_VARIABLE`: `POST /graphql (query + variables.key)`
10. `WEBSOCKET_FRAME`: JSON / binary frame dispatched over WebSocket tunnel

---

### Dimension F: Application & Implementation Layer ($A$)
- `RAW_DYNAMIC_SQL`: String concatenation (`"SELECT * FROM tbl WHERE id = " + id`).
- `ORM_RAW_ESCAPE`: ORM framework raw query wrapper (`User.where("name = #{name}")`).
- `QUERY_BUILDER_UNQUOTED`: Knex/TypeORM unquoted column expression (`.orderBy(sortField)`).
- `STORED_PROCEDURE_DYNAMIC`: PL/SQL or T-SQL executing `sp_executesql` or `EXECUTE IMMEDIATE`.
- `TEXT_TO_SQL_LLM`: AI / Agentic natural language to SQL translator without parameterization.
- `GRAPHQL_RESOLVER_TO_SQL`: Resolver translating GraphQL arguments into dynamic SQL filters.
- `DISTRIBUTED_FEDERATED_SQL`: Presto/Trino/CockroachDB distributed query coordinator.

---

### Dimension G: Target DBMS Dialect ($D$)
- `PostgreSQL` (8.x – 17.x)
- `MySQL` (5.7 – 9.x)
- `MariaDB` (10.x – 11.x)
- `Microsoft SQL Server` (2012 – 2024)
- `Oracle Database` (11g – 23c)
- `SQLite` (3.x)
- `IBM Db2`
- `Snowflake / DuckDB`
- `CockroachDB / TiDB`
- `Generic ANSI SQL`

---

### Dimension H: Representation & Encoding ($R$)
- `PLAIN_TEXT`: Raw ASCII string.
- `URL_ENCODED`: `%27%20OR%201%3D1`
- `DOUBLE_URL_ENCODED`: `%2527%2520OR`
- `HEX_LITERAL`: `0x61646d696e` (MySQL) or `x'61646d696e'` (SQLite)
- `UNICODE_OVERLONG`: `%u0027`, UTF-8 multi-byte homoglyphs
- `BASE64_WRAPPED`: Encoded inside JSON / token wrappers
- `HTML_ENTITY_ENCODED`: `&#39;`, `&quot;`, `&apos;`

---

### Dimension I: Inference & Extraction Strategy ($I$)
- `DIRECT_IN_BAND`: Multi-column canary alignment.
- `ERROR_CAST_DATA_LEAK`: Single-shot row extraction via integer conversion.
- `BINARY_SEARCH_BLIND`: $O(\log_2 |\Sigma|)$ binary search on character ASCII codes.
- `SHANNON_ENTROPY_SEARCH`: Adaptive frequency-weighted character partitioning.
- `WALD_SPRT_SEQUENTIAL`: Sequential Probability Ratio Test for timing verification.

---

### Dimension J: Database Intelligence Capability ($K$)
- `DBMS_FINGERPRINT`: Engine family, major/minor version, patch level.
- `SCHEMA_DISCOVERY`: Current database, catalog names, schema namespaces.
- `TABLE_ENUMERATION`: Complete list of application and system tables.
- `COLUMN_DISCOVERY`: Column names, data types, nullability, ordinal position.
- `AUTHORIZED_SAMPLE_DATA`: Permitted read access to sample records.

---

### Dimension K: Demonstrated Security Impact ($S$)
- `CONFIRMED_READ_ACCESS`: Extraction of table/column metadata and application records.
- `CONFIRMED_AUTH_BYPASS`: Bypassed authentication logic resulting in authenticated session state.
- `CONFIRMED_TENANT_ESCAPE`: Cross-tenant data retrieval demonstrating boundary violation.
- `CONFIRMED_FILE_READ`: Read file contents via `pg_read_file()`, `LOAD_FILE()`, `BULK INSERT`.
- `CONFIRMED_OS_EXECUTION`: Command execution demonstrated via `xp_cmdshell` or `COPY FROM PROGRAM`.
- `UNTESTED_SPECULATIVE_IMPACT`: Marked explicitly when theoretical impact is NOT demonstrated.

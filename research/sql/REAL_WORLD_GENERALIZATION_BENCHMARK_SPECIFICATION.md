# SENTINEL REAL-WORLD GENERALIZATION BENCHMARK SPECIFICATION
## Comprehensive Validation Framework for Autonomous SQL Security Investigation Across Modern Multi-Tier Application Architectures

---

### 1. Foundational Doctrine: Generalization Over Memorization

$$\text{PORTSWIGGER IS THE EXAMINATION LAB. REALISTIC AUTHORIZED APPLICATIONS ARE THE REAL TEST.}$$

Traditional security scanners suffer from severe benchmark over-fitting. When developers optimize a tool against a specific public lab suite (e.g., PortSwigger Web Security Academy), the engine inevitably accumulates heuristic shortcuts: hardcoded parameter names (`TrackingId`), assumed response signatures (`"Welcome back"`), predictable DBMS flavors, and rigid injection sequences.

When deployed against modern enterprise software, such scanners fail because real-world software is not a single-request laboratory puzzle. Modern production systems feature:
* **Multi-Tier Architectures**: API Gateways routing through microservices, ORM mapping layers, connection poolers (PgBouncer), and distributed databases.
* **Complex Data Flows**: Asynchronous message queues (Kafka, RabbitMQ, Celery), background event workers, and multi-step workflows.
* **Dynamic Query Generation**: Object-Relational Mappers (Hibernate, Prisma, SQLAlchemy, TypeORM, Entity Framework) and dynamic SQL builders.
* **Modern Syntactic Surfaces**: JSON path operators, GraphQL resolver variables, array containment queries, window functions, and full-text search vectors.
* **Aggressive Defensive Controls**: Web Application Firewalls (WAFs), reverse-proxy rate limiters, session rotation, strict type validators, and Row-Level Security (RLS).
* **High-Density Environmental Noise**: Non-deterministic DOM flapping, concurrent database locks, edge CDN Anycast jitter, and cache invalidation lag.

**The Generalization Principle**: Sentinel must learn the **general SQL security problem**, not the idiosyncratic shape of any individual benchmark lab. Sentinel receives **ONE RAW AUTHORIZED HTTP REQUEST** and must autonomously discover, investigate, and validate the SQL security condition from first principles under complete zero-knowledge of the backend architecture.

---

### 2. The Five-Tier Benchmark Corpus Architecture

The validation harness (`ucma-bench`) organizes targets into five strictly isolated corpus tiers, prioritizing the **Unseen Holdout** tier above all others:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                FIVE-TIER BENCHMARK CORPUS ARCHITECTURE                           │
├────────────────────────┬───────┬───────────────────────────────┬─────────────────────────────────┤
│ Corpus Category        │ Weight│ Composition                   │ Primary Validation Objective    │
├────────────────────────┼───────┼───────────────────────────────┼─────────────────────────────────┤
│ 1. KNOWN-LAB           │  10%  │ PortSwigger Labs 1–18, OWASP  │ Baseline regression testing and │
│                        │       │ Juice Shop, DVWA, WebGoat     │ canonical technique coverage    │
├────────────────────────┼───────┼───────────────────────────────┼─────────────────────────────────┤
│ 2. CONTROLLED-SYNTHETIC│  15%  │ Parametric micro-benchmarks   │ Exact context boundary testing  │
│                        │       │ (ucma-synth: 100 targets)     │ and oracle sensitivity bounds   │
├────────────────────────┼───────┼───────────────────────────────┼─────────────────────────────────┤
│ 3. REALISTIC-          │  25%  │ Architecturally reconstructed │ Real-world vulnerability pattern│
│    REPRODUCTION        │       │ CVE conditions (sanitized)    │ detection without string replay │
├────────────────────────┼───────┼───────────────────────────────┼─────────────────────────────────┤
│ 4. REAL-WORLD-STYLE    │  25%  │ Fully fledged open-source apps│ Multi-tier ORM/microservice/API │
│                        │       │ (eCommerce, SaaS, CMS, ERP)   │ integration resilience          │
├────────────────────────┼───────┼───────────────────────────────┼─────────────────────────────────┤
│ 5. UNSEEN-HOLDOUT      │  25%  │ Completely unfamiliar targets │ TRUE GENERALIZATION BENCHMARK   │
│                        │       │ isolated from scanner devs    │ (Zero prior scanner exposure)   │
└────────────────────────┴───────┴───────────────────────────────┴─────────────────────────────────┘
```

#### 2.1 Tier 1: KNOWN-LAB (Regression Baseline)
* **Scope**: Public laboratory targets (PortSwigger Labs 1–18, OWASP Benchmark, Juice Shop).
* **Role**: Sanity checking that classical injection primitives (UNION extraction, boolean blind inference, conditional error triggering, time-delay verification) function correctly.
* **Constraint**: Must never contain scanner-side bypass logic or hardcoded string identifiers.

#### 2.2 Tier 2: CONTROLLED-SYNTHETIC (`ucma-synth`)
* **Scope**: 100 programmatically synthesized micro-applications with randomized parameter names, randomized routing paths, and isolated syntactic coordinates.
* **Role**: Verifies boundary triangulation across exotic SQL contexts (unquoted numeric, string single/double quotes, parenthetical depths 1..3, JSON extractors, `LIKE` clauses).

#### 2.3 Tier 3: REALISTIC-REPRODUCTION (CVE-Inspired Architectural Patterns)
* **Scope**: Authentic architectural conditions extracted from verified critical CVEs, reconstructed as clean, non-destructive test harnesses:
  * **Pattern CVE-A (Dynamic Table/Column Identifiers)**: Inspired by MOVEit / Progress SQLi patterns where table or column identifiers are dynamically concatenated from user input.
  * **Pattern CVE-B (JSON Key/Path Concatenation)**: Inspired by modern API CVEs where JSON keys or GraphQL arguments are passed directly into PostgreSQL `jsonb_extract_path`.
  * **Pattern CVE-C (ORM Raw Query Leaks)**: Inspired by Django/SQLAlchemy/Prisma raw query flaws (`.raw()`, `.extra()`, `$queryRawUnsafe`) embedded in business logic.
  * **Pattern CVE-D (Nested Stored Procedure Unescaping)**: Multi-layer unescaping where input is sanitized at HTTP ingress but unescaped prior to internal `sp_executesql` or `EXECUTE IMMEDIATE`.
  * **Pattern CVE-E (Asynchronous Queue Poisoning)**: Ingress input written to an event queue (Kafka/Redis) and evaluated dynamically by a backend Celery/RabbitMQ worker.

#### 2.4 Tier 4: REAL-WORLD-STYLE (Production-Grade Open Source Architectures)
* **Scope**: Full-scale, multi-tier web applications deployed in local Docker/Kubernetes staging environments:
  * **eCommerce Application**: Multi-vendor store (e.g., Saleor, Medusa, WooCommerce clone) with relational catalog search, facet filtering, shopping cart cookies, and order histories.
  * **Enterprise SaaS Portal**: Multi-tenant workspace management portal with tenant-specific schemas, role-based access control (RBAC), and team member invitations.
  * **Headless CMS & REST/GraphQL Gateway**: Modern decoupled CMS (e.g., Strapi, Directus) routing GraphQL mutations and REST filters through query builders to PostgreSQL and MySQL.
  * **Banking/Healthcare Mock Portals**: High-security financial transaction ledger and electronic health records (EHR) mock systems with Row-Level Security (RLS) and strict audit logs.

#### 2.5 Tier 5: UNSEEN-HOLDOUT (The Ultimate Generalization Metric)
* **Scope**: Dedicated, isolated targets created by an external QA/Red-Team engineer that the Sentinel core development team has **never inspected**.
* **Invariant**: The holdout set features unique parameter naming conventions, novel API structures, uncommon framework combinations (e.g., Go GORM + CockroachDB, ASP.NET EF Core + MSSQL, Elixir Phoenix + PostgreSQL), and randomized response templates.
* **Primary Success Metric**: The engine’s **Unseen Holdout Generalization Score ($\mathcal{G}_{\text{holdout}}$)** must meet or exceed **95.0%**.

---

### 3. Multi-Tier Application Topologies in the Benchmark Harness

The benchmark harness tests Sentinel across four authentic enterprise architectural topologies, preventing it from behaving as a naive single-hop HTTP requester:

```
TOPOLOGY A: API Gateway & ORM Data Layer
[Client / Sentinel] ──► [Kong/Nginx Gateway] ──► [FastAPI/Express App] ──► [Prisma/TypeORM] ──► [PgBouncer] ──► [PostgreSQL 16]

TOPOLOGY B: Asynchronous Queue & Background Worker
[Client / Sentinel] ──► [Ingress REST API] ──► [RabbitMQ / Redis] ──► [Celery Background Worker] ──► [Dynamic SQL] ──► [MySQL 8.4]
                                  │
                                  ▼ (Later)
                     [Audit Dashboard / Egress View]

TOPOLOGY C: GraphQL Engine with Query Builder
[Client / Sentinel] ──► [GraphQL Gateway] ──► [Apollo Server] ──► [Knex/Kysely Query Builder] ──► [MSSQL 2022]

TOPOLOGY D: Persistent Multi-Step Workflow (Second-Order Storage)
[Client / Sentinel] ──► [Step 1: Ingest Profile] ──► [PostgreSQL Staging]
                                                            │
                                                            ▼
[Client / Sentinel] ──► [Step 2: Trigger Batch Report] ──► [Dynamic Unparameterized Batch Aggregator]
```

---

### 4. Realistic SQL Context Distribution

The benchmark corpus enforces a statistically realistic distribution of SQL contexts derived from real-world codebase audits, completely avoiding over-concentration in simple `WHERE` string literals:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 REAL-WORLD SQL CONTEXT DISTRIBUTION                              │
├──────────────────────────┬───────────┬──────────────────────────────────┬────────────────────────┤
│ Context Type             │ Proportion│ Real-World Occurrence Example    │ Key Testing Challenge  │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 1. WHERE String Literal  │    25%    │ WHERE category = '{input}'       │ Single/double quotes,  │
│                          │           │                                  │ balanced concatenation │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 2. WHERE Numeric/Boolean │    15%    │ WHERE user_id = {input}          │ Unquoted arithmetic,   │
│                          │           │                                  │ no quotes permitted    │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 3. ORDER BY / GROUP BY   │    12%    │ ORDER BY {input} ASC             │ Blind conditional case,│
│                          │           │                                  │ column index, no UNION │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 4. Search / LIKE Wildcard│    10%    │ WHERE name LIKE '%{input}%'      │ Wildcard escape,       │
│                          │           │                                  │ quote + wildcard close │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 5. Identifier / Column   │     8%    │ SELECT {input} FROM products     │ Backticks, double quotes,│
│                          │           │                                  │ schema metadata limits │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 6. JSON / Path Operators │     8%    │ WHERE data->>'key' = '{input}'   │ Arrow operators,       │
│                          │           │                                  │ JSON escaping on wire  │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 7. INSERT / UPDATE Values│     7%    │ INSERT INTO logs VALUES('{input}')│ Comma tuple balancing, │
│                          │           │                                  │ column count alignment │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 8. Subquery / HAVING     │     5%    │ HAVING count(*) > {input}        │ Parenthesis depth,     │
│                          │           │                                  │ aggregation scoping    │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 9. JOIN Condition        │     5%    │ LEFT JOIN orders ON o.id = {in}  │ Relational integrity,  │
│                          │           │                                  │ table alias scoping    │
├──────────────────────────┼───────────┼──────────────────────────────────┼────────────────────────┤
│ 10. Stored Proc / Dynamic│     5%    │ EXECUTE GetReport '{input}'      │ Statement separators,  │
│                           │           │                                  │ batch execution context│
└──────────────────────────┴───────────┴──────────────────────────────────┴────────────────────────┘
```

---

### 5. Multi-Engine DBMS Matrix

Targets run across six independently configured database engines, operating in multi-tenant and containerized topologies:

1. **PostgreSQL (v14, v15, v16)**: Evaluates type-strict casting (`::text`), dollar-quoting (`$$`), JSONB operators (`->`, `#>>`), and pg_sleep timing.
2. **MySQL / MariaDB (v8.0, v8.4, v10.11)**: Evaluates comment inline tricks (`/*!50000 ... */`), backtick identifiers, and `SLEEP()` / `BENCHMARK()` primitives.
3. **Microsoft SQL Server (2019, 2022)**: Evaluates string concatenation (`+`), batch stacking (`; WAITFOR DELAY`), and error-based conversion functions (`CONVERT(int, ...)`).
4. **Oracle Database (19c, 23c Free)**: Evaluates `FROM dual` projection requirements, `UTL_INADDR`, and `DBMS_PIPE.RECEIVE_MESSAGE()`.
5. **SQLite (v3.42, v3.45)**: Evaluates type affinity, `sqlite_master` catalog structures, and CPU-intensive mathematical blob primitives.
6. **NewSQL / Distributed Cloud (CockroachDB, ClickHouse)**: Evaluates distributed latency characteristics and columnar aggregation syntax.

---

### 6. Modern ORM & Framework Matrix

The corpus incorporates applications constructed with the most prevalent modern web frameworks and database mappers:

```
┌───────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ Language / Ecosystem  │ Frameworks & Mappers          │ Representative Vulnerability Condition   │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Python                │ Django ORM, SQLAlchemy,       │ Raw SQL methods (.extra(), .raw(),       │
│                       │ Tortoise ORM                  │ text()), unvalidated order_by clauses    │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ TypeScript / Node.js  │ Prisma, TypeORM, Sequelize,   │ Unescaped $queryRawUnsafe, raw where,    │
│                       │ Knex.js, Kysely               │ JSON path injection                      │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Java / Kotlin         │ Hibernate, Spring Data JPA,   │ Native query flags, HQL string concat,   │
│                       │ MyBatis                       │ unescaped order parameters in Pageable   │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ C# / .NET             │ Entity Framework Core, Dapper │ FromSqlRaw, raw connection executes,     │
│                       │                               │ interpolated string concatenation        │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Go                    │ GORM, sqlx, ent               │ Raw(), Where() string formatters,        │
│                       │                               │ unparameterized Table() identifiers      │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Ruby                  │ Ruby on Rails (ActiveRecord)  │ where.not() string interpolation, pluck()│
│                       │                               │ dynamic column selection                 │
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

---

### 7. Realistic Defensive Controls: Four-State Security Decision Classifier

Enterprise targets possess defensive layers that reject, sanitize, or throttle incoming traffic. A naive scanner misclassifies blocked or constrained parameters as either vulnerable or safe. Sentinel must classify every evaluated input into one of **four formal operational security states**:

```
                                  [Injected Probe Dispatched]
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      ▼                                                 ▼
             [Defensive Barrier Hit]                           [Application Reached]
                      │                                                 │
          ┌───────────┴───────────┐                         ┌───────────┴───────────┐
          ▼                       ▼                         ▼                       ▼
    [STATE: BLOCKED]     [STATE: CONSTRAINED]       [STATE: VULNERABLE]     [STATE: SAFE]
   WAF 403 / IP ban /   Filter strips quotes /     Causal Metamorphic      Zero SQL execution /
   Rate limit 429 /     Length truncated /         Triad holds / Evidence  Strict parameterization /
   Schema rejected      Partial execution          CAS generated           Metamorphic invariant
```

#### The Four States Defined:
1. **STATE: VULNERABLE**: The input reaches an unparameterized SQL execution path, and Sentinel achieves **Causal Metamorphic Triad Confirmation** ($R(\text{Base}) \equiv R(\text{TRUE}) \not\equiv R(\text{FALSE})$). Confirmed with cryptographic BLAKE3 CAS evidence.
2. **STATE: SAFE**: The application processes the parameter normally (or rejects non-matching values via standard routing), but inputs are strictly parameterized or sanitized. Probes demonstrate zero SQL reachability and zero differential entropy.
3. **STATE: CONSTRAINED**: The parameter reaches SQL execution, but an upstream filter or strict database schema prevents complete exploitation (e.g., length restriction $\le 8$ chars, single quotes stripped, or strict numeric casting). Sentinel reports this as **Constrained Injection** with exact boundary documentation rather than a false negative.
4. **STATE: BLOCKED**: Traffic is halted by an edge security control (WAF 403, Cloudflare Challenge, rate-limiting 429, or proxy abort) before reaching application business logic. Sentinel logs the active WAF filter profile and marks the parameter as **Defensively Gated**.

---

### 8. Realistic Environmental Noise Injectors

Real-world HTTP traffic is never static. The benchmark proxy (`ucma-chaos`) introduces authentic background variations to ensure Sentinel is completely immune to stochastic network anomalies:
* **Dynamic DOM Flapping**: Simulates rotating product carousels, relative timestamps ("updated 2 minutes ago"), personalized greeting messages, and random anti-CSRF tokens.
* **Network & Anycast Jitter**: Latency is sampled from empirical distributions: $t \sim \text{LogNormal}(\mu=180\text{ms}, \sigma=0.4)$ with periodic $2,500\text{ms}$ cold-start spikes.
* **Concurrent Database Locks**: Simulates background worker write transactions that cause random $100\text{ms}$ to $400\text{ms}$ query serialization delays.
* **Connection Pool Throttling**: Simulates PgBouncer queue limits under high load, causing intermittent connection delays.

The **Differential Invariant Normalizer (DIN)** and **Wald SPRT Timing Engine** must filter out 100% of these environmental disturbances.

---

### 9. Hidden Ground Truth Ledger vs. Zero-Knowledge Scanner

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE ZERO-KNOWLEDGE BOUNDARY CONTRACT                                │
├──────────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ The Benchmark Harness (ucma-bench)               │ Sentinel / UCMA-X Core Engine                 │
│ [KNOWS THE HIDDEN GROUND TRUTH]                  │ [STRICT ZERO KNOWLEDGE — SEES ONLY RAW HTTP]  │
├──────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ Target URL: https://staging.internal/api/v1/user │ Raw HTTP Request String:                      │
│ Target Architecture: Express + Prisma + Postgres │ POST /api/v1/user HTTP/1.1                    │
│ Vulnerable Parameter: `company_id` (JSON body)   │ Host: staging.internal                        │
│ Syntactic Context: WHERE unquoted integer        │ Content-Type: application/json                │
│ DBMS Engine: PostgreSQL 16.2                     │ Cookie: sess=f8a9e1...                        │
│ Vulnerability Type: Boolean Blind Inferred       │                                               │
│ True Differential Signal: DOM node <div id="ok"> │ {"user":"alice", "company_id": 1042}          │
│ Secret Ground Truth: password = "S3cur3!Auth#9"  │                                               │
└──────────────────────────────────────────────────┴───────────────────────────────────────────────┘
                                   │
                    Sentinel investigates autonomously
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Sentinel Emits Autonomous Cryptographic Proof Bundle (BLAKE3 CAS):                               │
│ - Discovered Ingress: JSON body parameter `company_id`                                           │
│ - Discovered Type: Integer (tested via pure arithmetic metamorphic invariance: 1042 - 0 vs 1042-1)│
│ - Discovered DBMS: PostgreSQL (confirmed via `||` concat and `version()` syntax differentials)   │
│ - Discovered Oracle: Differential DOM node mutation (id="ok")                                    │
│ - Confirmed Finding: Causal Metamorphic Triad Holds (100% precision, 7 requests)                 │
│ - Extracted Secret: "S3cur3!Auth#9" (extracted at 4.1 requests/character)                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                   │
                    ucma-bench verifies Sentinel's output
                    against the hidden Ground Truth
                                   │
                                   ▼
                   BENCHMARK SCORE: 100% GENERALIZATION
```

---

### 10. Generalization Evaluation Metrics

Generalization performance is scored across the entire corpus, with results broken down by tier:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               GENERALIZATION EVALUATION SCORECARD                                │
├────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│ Metric                 │ Known-Lab    │ Controlled-  │ Realistic-   │ Real-World-  │ UNSEEN-     │
│                        │ (18 labs)    │ Synth (100)  │ Repro (50)   │ Style (50)   │ HOLDOUT(50) │
├────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│ SQLi Recall            │ ≥ 98.0%      │ ≥ 99.0%      │ ≥ 96.0%      │ ≥ 95.0%      │ ≥ 95.0%     │
│ SQLi Precision         │ 100.0%       │ 100.0%       │ 100.0%       │ 100.0%       │ 100.0%      │
│ False Positive Rate    │ 0.0000 (ZERO)│ 0.0000 (ZERO)│ 0.0000 (ZERO)│ 0.0000 (ZERO)│ 0.0000(ZERO)│
│ False Negative Rate    │ ≤ 2.0%       │ ≤ 1.0%       │ ≤ 4.0%       │ ≤ 5.0%       │ ≤ 5.0%      │
│ Mean Requests/Finding  │ ≤ 8 reqs     │ ≤ 7 reqs     │ ≤ 9 reqs     │ ≤ 10 reqs    │ ≤ 9 reqs    │
│ Inert Pruning Cost     │ ≤ 2 reqs     │ ≤ 2 reqs     │ ≤ 2 reqs     │ ≤ 2 reqs     │ ≤ 2 reqs    │
│ Context Inference Acc. │ ≥ 98.0%      │ ≥ 99.0%      │ ≥ 95.0%      │ ≥ 94.0%      │ ≥ 94.0%     │
│ DBMS Inference Acc.    │ ≥ 95.0%      │ ≥ 96.0%      │ ≥ 94.0%      │ ≥ 92.0%      │ ≥ 92.0%     │
│ Extraction Bitrate     │ ≤ 4.2 r/char │ ≤ 4.1 r/char │ ≤ 4.3 r/char │ ≤ 4.4 r/char │ ≤ 4.2 r/char│
└────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┴─────────────┘
```

---

### 11. The Real-World Acceptance Test Protocol

The definitive acceptance test for Sentinel's payload and investigation engine requires:

```bash
cargo test -p ucma-bench --test real_world_acceptance -- --nocapture
```

#### Acceptance Pipeline:
1. **Zero Prior Setup**: The test runner spins up an unfamiliar, containerized multi-tier target from the **Unseen Holdout** set.
2. **Raw Request Dispatch**: Sentinel is initialized with **only the raw HTTP request** extracted from a simulated user browser session.
3. **Autonomous Execution**:
   * Mode: `Deep` autonomous investigation.
   * Sentinel maps the ingress surfaces (query, headers, cookies, JSON).
   * Sentinel characterizes the dynamic baseline and generates $\mathcal{M}_{\text{stable}}$.
   * Sentinel prunes inert parameters in $\le 2$ requests each.
   * Sentinel resolves the syntactic context and DBMS dialect via paired diagnostics.
   * Sentinel achieves Causal Metamorphic Triad Confirmation.
   * Sentinel generates copy-paste curl PoCs and exports the cryptographic BLAKE3 CAS proof bundle.
4. **Verification**: The benchmark harness asserts:
   * Did Sentinel find the exact vulnerable parameter? (Yes)
   * Was the context correctly inferred? (Yes)
   * Was the DBMS correctly inferred? (Yes)
   * Were request counts $\le 15$ for the parameter? (Yes)
   * Were zero false positives triggered across non-vulnerable parameters? (Yes)

By meeting every requirement of this Real-World Generalization Benchmark Specification, Sentinel is certified as a genuine, adaptive scientific instrument that generalizes across real enterprise applications.

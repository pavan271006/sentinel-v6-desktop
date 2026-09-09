# SENTINEL SQL SECURITY RESEARCH REVIEW
## Comprehensive State of the Art: Mechanisms, Architectures, Dialects, and Modern Attack Surfaces (2020–2026)

---

### Executive Summary & Foundational Tenet

Traditional Dynamic Application Security Testing (DAST) scanners and legacy SQL injection utilities are fundamentally bounded by a legacy paradigm: **Input $\rightarrow$ Static Payload Dictionary $\rightarrow$ Brute-Force Replay $\rightarrow$ Naive String Matching**. 

This paradigm is mathematically and operationally flawed in modern multi-tier web architectures. When evaluated against modern target environments—such as PortSwigger's *Blind SQL injection with conditional responses*, multi-tenant PostgreSQL with Row-Level Security, GraphQL gateways compiling directly to relational databases, or JSON-serialized microservice APIs—legacy tools exhibit two catastrophic failure modes:
1. **Combinatorial Explosion & Request Exhaustion**: Indiscriminately firing hundreds of static payloads across non-injectable parameters and inert headers (as observed in Sentinel's baseline run of 403 requests, where 95 probes were wasted on inert headers like `User-Agent` and `Referer`).
2. **Oracle Blindness & Premature Termination**: Inability to isolate single-token differential DOM signals (e.g., `"Welcome back"`), falling into false UNION column estimation branches due to uncalibrated length thresholds, or misinterpreting HTTP 429/503 rate-limiting responses as application divergence.

This research review synthesizes foundational application security literature, DBMS internal specifications, compiler-guided fuzzing engines (SQLancer, Squirrel, SQLRight), lexical boundary analyzers (libinjection), and distributed DAST architectures to formulate an evidence-driven, causal-metamorphic, hypothesis-governed payload generation architecture for Sentinel.

---

### 1. Architectural Deconstruction of Mature Systems

To design an architecture that materially surpasses existing tools, we first deconstruct the core mechanisms, design philosophies, and architectural blind spots of mature open-source and proprietary testing systems.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               EXISTING TOOLS CAPABILITY MAP                            │
├───────────────────┬──────────────────────────┬────────────────────────┬────────────────┤
│ Tool / System     │ Core Paradigm            │ Primary Strength       │ Fatal Blind    │
│                   │                          │                        │ Spot           │
├───────────────────┼──────────────────────────┼────────────────────────┼────────────────┤
│ sqlmap            │ Boundary Dictionary +    │ Massive dialect &      │ Static XML     │
│                   │ Heuristic Tree + Tamper  │ feature support;       │ templates;     │
│                   │ Transformation Scripts   │ mature exploitation    │ brute-force    │
│                   │                          │ pipelines              │ boundaries     │
├───────────────────┼──────────────────────────┼────────────────────────┼────────────────┤
│ SQLancer          │ Metamorphic Testing      │ Zero false positives;  │ Designed for   │
│ (Rigger et al.)   │ (TLP, NoREC, PQS) on     │ finds complex engine   │ DBMS kernels   │
│                   │ Relational DBMS Kernels  │ logic bugs via oracle  │ via direct SQL,│
│                   │                          │ transformations        │ not HTTP DAST  │
├───────────────────┼──────────────────────────┼────────────────────────┼────────────────┤
│ Squirrel /        │ IR-based Semantic Fuzzing│ Generates semantically │ High compile   │
│ SQLRight          │ with Type-Preserving AST │ valid, high-complexity │ overhead; no   │
│                   │ Mutators                 │ queries with coverage  │ web transport  │
│                   │                          │ guidance               │ or HTTP oracles│
├───────────────────┼──────────────────────────┼────────────────────────┼────────────────┤
│ libinjection      │ Lexical Token Sequence   │ Sub-microsecond WAF    │ Context-free;  │
│ (Hanson)          │ Folding (SQLi Grammar    │ fingerprinting; zero   │ blinds on JSON │
│                   │ Automaton)               │ runtime allocations    │ & exotic DBMS  │
│                   │                          │                        │ dialects       │
├───────────────────┼──────────────────────────┼────────────────────────┼────────────────┤
│ Commercial DAST   │ Black-box Fuzzing +      │ Out-of-band DNS/HTTP   │ Massive request│
│ (Burp, ZAP, Acunet)│ Asynchronous OAST       │ verification; broad    │ bloat; poor    │
│                   │ Interactors              │ attack surface sweep   │ blind inference│
│                   │                          │                        │ optimization   │
└───────────────────┴──────────────────────────┴────────────────────────┴────────────────┘
```

#### 1.1 sqlmap: Boundaries, Techniques, and Bottlenecks
* **Boundary Selection (`xml/boundaries.xml`)**: sqlmap models the injection context using static prefix/suffix templates containing quote characters (`'`, `"`, `')`, `")`, integer contexts). It selects boundaries linearly or via shallow regex heuristics.
  * *Fatal Flaw*: When confronted with non-standard contexts (e.g., JSON string literals inside PostgreSQL `jsonb_path_query`, numeric identifiers inside `ORDER BY` clauses without quotes, or GraphQL variable bindings), boundary selection degrades to brute-force enumeration, generating dozens of syntactically invalid requests that trigger application-level firewalls.
* **Technique Ordering & Confirmation**: sqlmap executes techniques in a fixed sequence: Boolean-based blind $\rightarrow$ Error-based $\rightarrow$ UNION query $\rightarrow$ Stacked queries $\rightarrow$ Time-based blind $\rightarrow$ Inline queries.
  * *Fatal Flaw*: If an endpoint triggers an ambiguous error response (e.g., an unhandled HTTP 500 on `'`), sqlmap often prioritizes error-based casting queries. If the target DBMS suppresses verbose error disclosures (such as in PortSwigger's Blind with Conditional Errors), it wastes dozens of queries attempting CAST extractions before falling back to boolean blind inference.
* **Comparison Engine**: Relies on page ratio similarity algorithms (`difflib.SequenceMatcher`) with dynamic token stripping.
  * *Fatal Flaw*: Uses a single scalar threshold (e.g., 0.98 similarity). In high-density pages (100KB+ HTML), a 1-token boolean divergence (`"Welcome back"` vs. empty string) represents less than 0.05% of the page size. A global similarity threshold fails to detect this divergence unless specifically tuned to local token subtraction.

#### 1.2 SQLancer: Metamorphic Testing & Oracle Formalisms
Manuel Rigger and Zhendong Su (USENIX Security 2020, OOPSLA 2020) demonstrated that database logic bugs and injection vulnerabilities can be verified with mathematical certainty (zero false positives) using metamorphic relation transformations:
* **Ternary Logic Partitioning (TLP)**: For any boolean predicate $\phi$, the set of rows in table $T$ can be strictly partitioned into three mutually exclusive sets:
  $$\text{Rows}(T) = \text{Rows}(\sigma_{\phi}(T)) \cup \text{Rows}(\sigma_{\neg \phi}(T)) \cup \text{Rows}(\sigma_{\phi \text{ IS NULL}}(T))$$
  In SQL testing, this relation is an absolute invariant. If the union of the partitioned queries does not equal the unconstrained baseline query, either a database optimizer bug exists or the input has broken the execution structure.
* **Non-Optimizing Reference Engine Construction (NoREC)**: Translates an optimized query containing a `WHERE` predicate into an unoptimized query where the predicate is evaluated as an expression in the projection list (`SELECT count(eval(phi))`), eliminating database query optimizer path differences.
* *Translation to DAST*: TLP provides the mathematical foundation for **Zero-False-Positive Causal Verification**. A parameter is confirmed vulnerable if and only if the injected predicate satisfies metamorphic partition completeness across true, false, and null evaluations.

#### 1.3 Squirrel & SQLRight: Intermediate Representation (IR) Grammar Fuzzing
* **AST-Guided Mutation**: Squirrel (S&P 2020) and SQLRight (USENIX Security 2022) parse raw SQL queries into a formal Intermediate Representation (IR) AST. Instead of mutating raw bytes or string tokens, mutators operate on AST nodes, preserving semantic validity:
  * *Type-Preserving Mutation*: An integer expression node is replaced only by an AST node that evaluates to an integer.
  * *Context-Preserving Insertion*: A boolean binary operation node (`AND`, `OR`) is inserted only where the grammar permits a boolean predicate.
* *Translation to DAST*: Sentinel must not assemble payloads by string concatenation (`prefix + payload + suffix`). Sentinel must compile payloads using an internal **SQL Semantic IR**. This guarantees that all candidate probes generated for MySQL, PostgreSQL, Oracle, SQLite, and MSSQL are syntactically and semantically valid before they are serialized to HTTP wire representations.

#### 1.4 libinjection: Lexical Token Sequence Automata
Nick Galbreath’s `libinjection` tokenizes input strings into a sequence of canonical SQL tokens (e.g., `' OR 1=1--` becomes `s & 1 c`). It matches token sequences against an automaton trained on SQL grammar idioms.
* *Architectural Limitation*: `libinjection` is entirely context-free. It does not know whether the injection occurs in a `WHERE` clause, an `ORDER BY` clause, an `INSERT` statement, or inside a JSON string. Because it operates purely on lexical input strings, it can be bypassed through parser differentials between the tokenizer and the backend DBMS parser (e.g., MySQL comment trick `/*!50000... */`, PostgreSQL dollar-quoted strings `$$...$$`, or character set encoding mismatches).

---

### 2. Master Research Inventory: SQLi Techniques & Context Matrix

The following matrix represents the research baseline across all modern SQL contexts, DBMS dialects, transport layers, and execution channels.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                    MASTER RESEARCH INVENTORY MATRIX                                                              │
├──────────────┬────────────────────────┬─────────────────────┬───────────────┬──────────────────────┬─────────────┬──────────────┬────────────────┤
│ Category     │ Technique              │ SQL Context         │ Target DBMS   │ Transport / Format   │ Primary     │ Safety Class │ Research       │
│              │                        │                     │               │                      │ Oracle      │              │ Recency        │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Boolean      │ Balanced Quote         │ WHERE / HAVING      │ PostgreSQL,   │ Cookie, URL Query,   │ Text Marker │ Non-         │ 2020-2026      │
│ Blind        │ Conditional Expression │ String Literal      │ MySQL, SQLite,│ Form-urlencoded,     │ & Token     │ Destructive  │ (PortSwigger,  │
│              │ (AND '1'='1)           │                     │ MSSQL, Oracle │ JSON string          │ Divergence  │              │ USENIX)        │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Boolean      │ Comment-Terminated     │ WHERE / HAVING      │ MySQL, MSSQL, │ URL Query, POST Body,│ Differential│ Non-         │ 2020-2026      │
│ Blind        │ Expression (AND 1=1--) │ Numeric / String    │ SQLite        │ GraphQL Variable     │ Length Delta│ Destructive  │ (OWASP WSTG)   │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Error-Based  │ Explicit Data Type     │ WHERE, SELECT,      │ PostgreSQL    │ Cookie, Header,      │ Leaked Data │ Non-         │ 2021-2025      │
│ Conversion   │ Conversion (CAST AS INT│ ORDER BY            │ (8.3 - 17.x)  │ REST Path, JSON      │ in HTTP 500/│ Destructive  │ (CVE-2023-     │
│              │ query)                 │                     │               │                      │ 200 Body    │              │ 34362 MOVEit)  │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Error-Based  │ Mathematical Domain    │ WHERE, SELECT       │ Oracle,       │ POST Body, Query,    │ HTTP 500    │ Non-         │ 2020-2025      │
│ Conditional  │ Divide-by-Zero / CASE  │ String / Numeric    │ MSSQL, MySQL, │ Cookie               │ Status Code │ Destructive  │ (PortSwigger   │
│              │ (CASE WHEN 1=1 THEN.. )│                     │ PostgreSQL    │                      │ Divergence  │              │ Lab 12)        │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Error-Based  │ Subquery Coordinate    │ WHERE, SELECT       │ MySQL         │ Form-urlencoded,     │ Duplicate   │ Non-         │ 2020-2024      │
│ Duplication  │ Error (FLOOR(RAND(0)*2)│ String / Numeric    │ (5.7 - 8.4)   │ JSON Body            │ Key Error in│ Destructive  │ (Research      │
│              │ GROUP BY x)            │                     │               │                      │ Body        │              │ Compendium)    │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ UNION-Query  │ Canary Marker Concaten-│ SELECT Projection   │ PostgreSQL,   │ URL Query, POST Body,│ Literal     │ Non-         │ 2020-2026      │
│ Reflective   │ ation (ORDER BY +      │ List                │ MySQL, SQLite,│ Cookie, REST Path    │ Canary Token│ Destructive  │ (PortSwigger   │
│              │ UNION SELECT 'CANARY') │                     │ MSSQL, Oracle │                      │ Reflection  │              │ Labs 1-10)     │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Time-Based   │ Native Engine Sleep    │ WHERE, ORDER BY,    │ PostgreSQL    │ Cookie, Header,      │ Wald SPRT   │ Non-         │ 2020-2026      │
│ Blind        │ Injection (pg_sleep(N))│ Unquoted Identifier │ (9.0 - 17.x)  │ Query, JSON          │ Statistical │ Destructive  │ (ACM CCS,      │
│              │                        │                     │               │                      │ Latency     │              │ Sequential)    │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Time-Based   │ Procedural Delay       │ Stacked Batch       │ Microsoft SQL │ URL Query, POST Body,│ Heavy-Tail  │ Non-         │ 2020-2025      │
│ Blind        │ Statement              │ Execution           │ Server        │ Cookie               │ Latency     │ Destructive  │ (Ivanti CVE    │
│              │ (WAITFOR DELAY '0:0:3')│                     │ (2012 - 2022) │                      │ Threshold   │              │ 2024-21894)    │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Time-Based   │ Heavy Computational    │ WHERE, HAVING       │ SQLite        │ Query, Cookie,       │ Relative    │ Non-         │ 2020-2025      │
│ Blind        │ CPU Fuzzing (RANDOMBLOB│ Expression          │ (3.0 - 3.46)  │ Header               │ Quadratic   │ Destructive  │ (SQLite Core   │
│              │ + UPPER(HEX()))        │                     │               │                      │ CPU Delay   │              │ Research)      │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Out-Of-Band  │ DNS Lookup Trigger     │ Procedural / Direct │ Oracle, MSSQL,│ Any input surface    │ DNS Query / │ Non-         │ 2020-2026      │
│ (OAST)       │ (UTL_INADDR, xp_dir-   │ Expression          │ PostgreSQL    │ (headers, cookies,   │ HTTP Callback│ Destructive  │ (Project       │
│              │ tree, dblink_connect)  │                     │ (extensions)  │ body)                │ Listener    │              │ Discovery)     │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Clause / AST │ Non-Quoted Numeric     │ ORDER BY / GROUP BY │ All relational│ URL Query, JSON      │ Ordering /  │ Non-         │ 2021-2026      │
│ Position     │ Injection (CASE WHEN.. │ Position Index /    │ DBMSs         │ field                │ Sorting     │ Destructive  │ (OWASP WSTG)   │
│              │ THEN 1 ELSE 2 END)     │ Expression          │               │                      │ Inversion   │              │                │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Modern API   │ JSON Operator Breakout │ PostgreSQL JSONB    │ PostgreSQL    │ JSON REST Body,      │ Operator    │ Non-         │ 2023-2026      │
│              │ (->>, #>>, jsonb_path) │ Query Constructor   │ (12.x - 17.x) │ GraphQL Variables    │ Execution   │ Destructive  │ (DEF CON 31)   │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Modern API   │ Vector Distance Break- │ pgvector Hybrid     │ PostgreSQL +  │ JSON Vector Payload  │ Vector      │ Non-         │ 2024-2026      │
│              │ out ('[0]'::vector <=>)│ Semantic Search     │ pgvector      │                      │ Distance    │ Destructive  │ (USENIX 2025)  │
│              │                        │                     │               │                      │ Anomaly     │              │                │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Modern API   │ GraphQL AST Argument   │ GraphQL Resolvers   │ Any relational│ GraphQL Query &      │ Graph Error │ Non-         │ 2022-2026      │
│              │ Dynamic Interpolation  │ to SQL query        │ backend       │ Variable JSON        │ vs Valid    │ Destructive  │ (Black Hat)    │
│              │ (raw SQL in filters)   │                     │               │                      │ Entity      │              │                │
├──────────────┼────────────────────────┼─────────────────────┼───────────────┼──────────────────────┼─────────────┼──────────────┼────────────────┤
│ Second-Order │ Stored Persistence     │ INSERT / UPDATE     │ PostgreSQL,   │ Multi-step workflow  │ Divergence  │ Potentially  │ 2020-2026      │
│ Stateful     │ $\rightarrow$ Delayed Retrieval │ followed by SELECT  │ MySQL, MSSQL  │ (Profile $\rightarrow$ View)│ on Target   │ Persistent   │ (ACM CCS)      │
│              │ Execution              │                     │               │                      │ Step 2 Page │              │                │
└──────────────┴────────────────────────┴─────────────────────┴───────────────┴──────────────────────┴─────────────┴──────────────┴────────────────┘
```

---

### 3. Investigation of Modern SQL Architectures & Attack Surfaces

To maintain technical superiority through 2026, the engine must account for architectural patterns that post-date legacy scanner designs:

#### 3.1 GraphQL-to-SQL Gateway Resolvers
Modern architectures frequently utilize tools like Hasura, PostGraphile, Prisma, or custom Apollo resolvers that automatically translate incoming GraphQL queries into raw SQL queries.
* **Mechanism**: In GraphQL arguments (e.g., `users(where: { name: { _eq: "admin" } })`), custom or legacy resolvers sometimes employ string interpolation into dynamic `WHERE` clauses instead of parameterized AST nodes.
* **Scanner Vulnerability**: Legacy DAST scanners test only standard URL query parameters and form bodies. They completely ignore GraphQL endpoints (`/graphql`, `/v1/graphql`) or treat the JSON body as an unstructured string.
* **Taxonomy Classification**: **TRUE SQLi**. The vulnerability manifests at the database layer; the transport format is GraphQL AST JSON.

#### 3.2 ORM Escape Hatches & Raw Query Interpolations
Modern applications heavily rely on ORMs (Hibernate, Prisma, TypeORM, SQLAlchemy, Django ORM, Sequelize). While ORMs automatically parameterize standard model methods (`findById`, `filter`), developers routinely use "escape hatches" for complex filtering, aggregation, or performance optimization:
* **Prisma**: `prisma.$queryRawUnsafe(\`SELECT * FROM User WHERE id = ${id}\`)`
* **Sequelize**: `sequelize.query(...)` with raw string concatenation, or `[Sequelize.literal(\`username = '\${val}'\`)]`
* **Django**: `User.objects.raw(...)` or `.extra(where=[f"status = '{status}'"])`
* **Hibernate**: `session.createQuery("from User where name = '" + name + "'")` (HQL/JPQL Injection)
* *Scanner Vulnerability*: ORM escape hatches are frequently placed in sorting parameters (`ORDER BY ${sortCol}`) or dynamic column selections. Legacy scanners fail because ORM exceptions often return structured JSON (`{"error": "QueryFailedError", "code": "ER_SYNTAX_ERROR"}`) rather than standard DBMS error strings.

#### 3.3 JSON-Native Query Construction
PostgreSQL (`json`, `jsonb`), MySQL 8.x (`JSON_EXTRACT`, `->`), and SQL Server (`OPENJSON`) natively query unstructured JSON documents within SQL tables:
* **PostgreSQL Example**: `SELECT * FROM events WHERE data->>'status' = 'ACTIVE';`
* **Injection Vector**: If the JSON path or expression is dynamically interpolated:
  `data->>'status' = 'ACTIVE' AND 1=1 AND ''='`
* *Scanner Requirement*: The scanner must understand JSON string breakout rules, JSON path expressions (`$.store.book[*]`), and JSON quote escaping (`\"`).

#### 3.4 Vector Database SQL Extensions (pgvector)
With the proliferation of AI and retrieval-augmented generation (RAG) architectures, PostgreSQL instances running `pgvector` store vector embeddings directly in relational tables:
* **Vector Query Syntax**: `SELECT * FROM items ORDER BY embedding <=> '[0.1, 0.2, ...]' LIMIT 5;`
* **Injection Vector**: Dynamic vector query construction where user vector inputs or filter parameters are concatenated directly into vector operator expressions (`<=>` cosine distance, `<->` Euclidean distance, `<#>` negative inner product).

---

### 4. Taxonomy Boundary Enforcement

To maintain zero false positives and rigorous evidence attribution, Sentinel enforces strict taxonomy boundaries:

```
                                 INPUT SURFACE
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
         SQL Parser Context?                        Non-SQL Processor?
                 │                                           │
         ┌───────┴───────┐                           ┌───────┴───────┐
         ▼               ▼                           ▼               ▼
     TRUE SQLi    Database Logic /             NoSQLi / LDAP /   Application Logic
  (Syntax Breakout  Kernel Anomaly                Command Inj      Branching / 404
   or Semantic     (No Syntax Breakout;          (Non-Relational   (Normal Business
   Expression       Valid SQL with               Interpreter)      Logic Response)
   Manipulation)    Engine Bug)                      │                   │
         │               │                           ▼                   ▼
         ▼               ▼                       REJECT FROM       REJECT FROM
    SENTINEL CORE   BUG REPORTING               SQL TAXONOMY      SQL TAXONOMY
     CONFIRMED       (SQLancer Scope)
```

1. **TRUE SQL Injection**: User-controlled input successfully escapes its intended data representation boundary and alters the syntactic AST structure or semantic execution logic of an SQL interpreter executing on a relational DBMS kernel.
2. **Database Engine Logic Bug (SQLancer domain)**: A query causes a crash or invariant breakdown in the database engine itself, but was not caused by user data escaping an application query template. (Out of scope for Sentinel DAST).
3. **NoSQL / Document Injection**: Input alters MongoDB BSON queries, Redis commands, or Elasticsearch JSON queries. (Routed to dedicated NoSQL engines; strictly separated from SQLi findings).
4. **Application Logic Differential**: Input causes normal application branching (e.g., searching for a valid product vs. invalid product returns different HTML). (Filtered out via 5-step counterfactual causal verification).

---

### 5. Architectural Synthesis: Core Directives for Sentinel

From this exhaustive research review, the following engineering directives are established for the Sentinel Payload Engine:

1. **Directives on Payload Count**: Never optimize for payload count. Firing 50,000 static strings is an anti-pattern that triggers WAF bans, degrades target performance, and generates false positives. Optimize for **Information Gain per Request** ($EIG / \text{Cost}$).
2. **Directives on Modularity**: Completely decouple **Knowledge** (rules, AST rules, dialect syntax), **Intent** (what hypothesis we are testing), **Compilation** (translating intent to AST for target dialect), and **Serialization** (encoding for HTTP wire transport).
3. **Directives on Confirmation**: A finding is NEVER confirmed by a single status code or string match. It must pass **5-step Counterfactual Causal Verification (UCMA-X)**:
   - Baseline stability check.
   - Independent confirmation of true hypothesis.
   - Independent disconfirmation of false hypothesis.
   - TLP / NULL partition verification.
   - Clean-room 3x reproduction.

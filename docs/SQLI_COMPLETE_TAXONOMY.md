# UCMA-X COMPLETE MULTIDIMENSIONAL SQL INJECTION TAXONOMY (v3.0)
# Unified Causal-Metamorphic Adaptive SQL Security Research & Validation

This taxonomy synthesizes:
1. The complete 185-element baseline taxonomy across all 15 classical and operational categories.
2. Literature discoveries from 2020–2026 across academic database testing (SQLancer, Squirrel, SQLRight, CODDTest, DynSQL, etc.), DAST research, AST compilation differentials, cloud analytical engines, ORM translation anomalies, and AI Text-to-SQL systems.
3. A formal 11-dimensional orthogonal classification graph that strictly separates root vulnerability mechanisms from delivery, context, observation, and impact.

---

## 1. THE 11 ORTHOGONAL TAXONOMY DIMENSIONS

To eliminate double-counting and terminology duplication, every SQL security validation event is mapped into an 11-tuple:

$$\mathcal{T} = \langle \mathcal{M}, \mathcal{C}, \mathcal{O}, \mathcal{L}, \mathcal{T}_{rans}, \mathcal{I}_{mpl}, \mathcal{D}, \mathcal{R}, \mathcal{I}_{nf}, \mathcal{E}, \mathcal{X} \rangle$$

Where:
1. **$\mathcal{M}$ (Mechanism / Attack Class)**: The fundamental query structure or syntax alteration mechanism.
2. **$\mathcal{C}$ (SQL Syntactic Context)**: The exact AST node and grammar production clause where injection occurs.
3. **$\mathcal{O}$ (Observation Channel / Oracle)**: How database state changes manifest in observable HTTP/system responses.
4. **$\mathcal{L}$ (Lifecycle & State Path)**: First-order vs second-order, immediate vs asynchronous, workflow dependency.
5. **$\mathcal{T}_{rans}$ (Transport & Protocol)**: Wire format delivering the parameter.
6. **$\mathcal{I}_{mpl}$ (Application & Architecture Layer)**: Native query, ORM, query builder, middleware, RPC, Text-to-SQL.
7. **$\mathcal{D}$ (DBMS Dialect & Engine)**: Target SQL database engine family and execution mode.
8. **$\mathcal{R}$ (Representation & Encoding)**: Encodings, normalization, token smushing, character-set translations.
9. **$\mathcal{I}_{nf}$ (Inference Oracle Mode)**: Mathematical or structural oracle logic used to infer state.
10. **$\mathcal{E}$ (Extraction Strategy)**: Protocol used to enumerate metadata, schema, and authorized data.
11. **$\mathcal{X}$ (Demonstrated Capability & Impact)**: Verified authorization, confidentiality, integrity, or execution impact.

---

## 2. COMPREHENSIVE TAXONOMY TREE

```
SQL Security Validation Taxonomy
├── 1. MECHANISM (Attack Class) [M]
│   ├── M01. Tautology / Boolean Predicate Inversion
│   ├── M02. Syntax Disruption / Unhandled Grammar Exception
│   ├── M03. Union-Based Recordset Expansion
│   ├── M04. Stacked / Batched Multiple Statements
│   ├── M05. Stored Procedure & Dynamic SQL Execution
│   ├── M06. Comment Truncation / Statement Termination
│   ├── M07. Metamorphic Logic Partitioning (TLP / NoREC / PQS)
│   ├── M08. Type-Cast Conversion Faults (CAST / CONVERT Error Leaks)
│   ├── M09. Out-of-Band Network Interaction (DNS / HTTP / SMB / LDAP)
│   ├── M10. Second-Order Taint Propagation
│   ├── M11. Identifier & Catalog Quoting Bypass
│   ├── M12. SMT / Constraint Solver Subversion
│   ├── M13. JIT Compilation / Query Optimizer Differential Injection
│   ├── M14. Natural Language / Agentic Text-to-SQL Prompt Manipulation
│   ├── M15. GraphQL Resolver Query Stitching / Injection
│   ├── M16. Prepared Statement Protocol Emulation Mismatch
│   └── M17. Distributed / Federated Foreign Data Wrapper (FDW) Injection
│
├── 2. SQL SYNTACTIC CONTEXT [C]
│   ├── C01. SELECT / WHERE Clause (Single-Quoted String Literal)
│   ├── C02. SELECT / WHERE Clause (Double-Quoted String Literal)
│   ├── C03. SELECT / WHERE Clause (Numeric Literal)
│   ├── C04. SELECT / WHERE Clause (Parenthesized Expression)
│   ├── C05. SELECT Projection List (Column Aliases / Expressions)
│   ├── C06. FROM / JOIN Table Reference (Table Identifier / Dynamic View)
│   ├── C07. JOIN ON / USING Predicate
│   ├── C08. ORDER BY Expression / Positional Sort / Identifier
│   ├── C09. GROUP BY Expression / Identifier
│   ├── C10. HAVING Aggregate Predicate
│   ├── C11. INSERT VALUES / Row Expression List
│   ├── C12. UPDATE SET Expression / Assignment
│   ├── C13. UPDATE WHERE Predicate
│   ├── C14. DELETE WHERE Predicate
│   ├── C15. LIMIT / OFFSET Integer & Clause
│   ├── C16. IN (...) Expression List
│   ├── C17. LIKE / ILIKE Pattern & ESCAPE Clause
│   ├── C18. CASE ... WHEN ... THEN Conditional Expression
│   ├── C19. Scalar Subquery / Inline SELECT
│   ├── C20. EXISTS / NOT EXISTS Subquery Predicate
│   ├── C21. CTE (WITH / WITH RECURSIVE) Clause
│   ├── C22. Window Function (OVER / PARTITION BY / ORDER BY)
│   ├── C23. Array / Composite Record Constructor
│   ├── C24. JSON / JSONB Arrow Operator Expression (->, ->>, #>)
│   ├── C25. XML Function (XMLTABLE / EXTRACTVALUE / UPDATEXML)
│   ├── C26. Full-Text Search Predicate (MATCH ... AGAINST / to_tsquery)
│   └── C27. Stored Routine Parameter (PROCEDURE / FUNCTION / TRIGGER)
│
├── 3. OBSERVATION CHANNELS [O]
│   ├── O01. Direct In-Band Visible Response
│   ├── O02. UNION Inline Data Reflection
│   ├── O03. Verbose SQL Syntax / Parser Error
│   ├── O04. Runtime Type Conversion / Arithmetic Error (CAST Fault)
│   ├── O05. Boolean Differential (Status Code Divergence)
│   ├── O06. Boolean Differential (Content Body Token Divergence)
│   ├── O07. Boolean Differential (Header / Redirect / Cookie Mutation)
│   ├── O08. Boolean Differential (DOM / Structural Tree Diff)
│   ├── O09. Time-Based Fixed Delay (SLEEP / WAITFOR / pg_sleep)
│   ├── O10. Statistical SPRT Sequential Latency Shift
│   ├── O11. Out-of-Band DNS Exfiltration Interaction
│   ├── O12. Out-of-Band HTTP Interaction
│   ├── O13. Out-of-Band SMB / NTLM Auth Interaction
│   ├── O14. Metamorphic Invariant Equivalence Check
│   └── O15. State-Change Side-Effect (Subsequent Endpoint State)
│
├── 4. LIFECYCLE & TIMING [L]
│   ├── L01. First-Order Immediate Synchronous
│   ├── L02. First-Order Immediate Multi-Request
│   ├── L03. Second-Order Stored Database Entity
│   ├── L04. Second-Order Cross-Endpoint Workflow
│   ├── L05. Second-Order Background Worker / Message Queue (Celery/Kafka/RabbitMQ)
│   ├── L06. Second-Order Scheduled Job / Cron Task
│   ├── L07. Second-Order Admin Portal View / Audit Log
│   ├── L08. Second-Order Data Export / PDF / CSV Report Pipeline
│   ├── L09. Second-Order Cross-Session / Cross-User
│   └── L10. Second-Order Cross-Tenant / Multi-Tenant Isolation Breach
│
├── 5. TRANSPORT & PROTOCOL [T]
│   ├── T01. HTTP URL Query String Parameter
│   ├── T02. HTTP URL Path Variable (REST Segment / Matrix Param)
│   ├── T03. HTTP Body (application/x-www-form-urlencoded)
│   ├── T04. HTTP Body (multipart/form-data field value)
│   ├── T05. HTTP Body (multipart/form-data filename attribute)
│   ├── T06. HTTP Body (application/json top-level primitive)
│   ├── T07. HTTP Body (application/json nested object / array)
│   ├── T08. HTTP Body (application/json JSONPath injection)
│   ├── T09. HTTP Body (application/xml / SOAP payload)
│   ├── T10. HTTP Header (User-Agent / Referer / X-Forwarded-For)
│   ├── T11. HTTP Header (Custom Authorization / Tenant Header)
│   ├── T12. Cookie Header (Value / Sub-Key)
│   ├── T13. GraphQL Query Variable
│   ├── T14. GraphQL Field Inline Argument
│   ├── T15. GraphQL Relay Base64 Global ID / Cursor
│   ├── T16. WebSocket Text / JSON Frame
│   ├── T17. gRPC Protocol Buffer Field
│   └── T18. RPC / AMQP / MQTT Message Transport
│
├── 6. APPLICATION & IMPLEMENTATION LAYER [I]
│   ├── I01. Raw String Concatenation in Application Driver
│   ├── I02. ORM Raw Fragment Misuse (Django extra, Hibernate raw, Rails find_by_sql)
│   ├── I03. ORM Query-Builder Method Injection (Knex, Prisma, TypeORM, SQLAlchemy)
│   ├── I04. ORM Dynamic Field Sorting / Column Whitelist Failure
│   ├── I05. Stored Procedure Dynamic SQL (sp_executesql, EXECUTE IMMEDIATE)
│   ├── I06. Prepared Statement Truncation / Integer Coercion Edge
│   ├── I07. Client-Side Query Parameterization Emulation Flaw
│   ├── I08. Microservice / API Gateway Dynamic Routing Injection
│   ├── I09. GraphQL-to-SQL Direct Translation Middleware (Hasura, PostGraphile)
│   ├── I10. Agentic LLM / Natural Language Text-to-SQL Translation Layer
│   ├── I11. Data Virtualization / Federation Middleware (Trino, Presto, Dremio)
│   └── I12. Analytical / Data Warehouse Ingestion Pipeline (Snowflake, BigQuery, ClickHouse)
│
├── 7. DBMS DIALECT & ENGINE [D]
│   ├── D01. PostgreSQL (Standard, CockroachDB, YugabyteDB, Timescale)
│   ├── D02. MySQL (Standard, MariaDB, Percona, TiDB, SingleStore)
│   ├── D03. Microsoft SQL Server (T-SQL, Azure SQL, Synapse)
│   ├── D04. Oracle Database (PL/SQL, Exadata, Autonomous Database)
│   ├── D05. SQLite (Embedded, Turso, Cloudflare D1)
│   ├── D06. IBM Db2 (LUW, z/OS, iSeries)
│   ├── D07. H2 / Apache Derby / HSQLDB (Java Embedded)
│   ├── D08. Microsoft Access / Jet Engine
│   ├── D09. ClickHouse / Trino / Presto (Analytical Distributed SQL)
│   ├── D10. Snowflake / Google BigQuery / AWS Athena (Cloud Data Warehouse)
│   └── D11. Generic SQL (ANSI SQL-92 / SQL-99 / SQL-2016)
│
├── 8. REPRESENTATION & ENCODING [R]
│   ├── R01. Plain ASCII
│   ├── R02. URL Percent-Encoding (Standard)
│   ├── R03. Double / Repeated URL Encoding
│   ├── R04. Non-Standard / Illegal Percent Encoding
│   ├── R05. Unicode Normalization Forms (NFC, NFD, NFKC, NFKD)
│   ├── R06. Multibyte Character Set Smushing (GBK / Big5 / Shift-JIS 0x5C bypass)
│   ├── R07. JSON / Unicode String Escaping (\u0027, \u0022)
│   ├── R08. XML Entity / CDATA Representation (&apos;, &#x27;)
│   ├── R09. HTML Entity Encoding
│   ├── R10. Base64 / Hex Encoded Token Transport
│   ├── R11. HTTP Parameter Pollution (HPP - Duplicate Keys)
│   ├── R12. Comment Syntactic Substitution (/**/, --, #, /*!50000...*/)
│   ├── R13. Whitespace Alternatives (Tab %09, Line Feed %0A, Form Feed %0C, Parenthesis)
│   ├── R14. Quoting & Identifier Escaping Variations (`identifier`, [identifier], "identifier")
│   └── R15. Multi-Stage Pipeline Decoding Differential (Gateway vs Application)
│
├── 9. INFERENCE & ORACLE MODES [Inf]
│   ├── Inf01. Strict Binary Status Code Comparator
│   ├── Inf02. Micro-Differential Text Token Grep
│   ├── Inf03. Length / Similarity Ratio Thresholding
│   ├── Inf04. Regex Dialect Error Pattern Matcher
│   ├── Inf05. Wald's SPRT Sequential Log-Likelihood Ratio Test
│   ├── Inf06. Mann-Whitney U Non-Parametric Rank-Sum Test
│   ├── Inf07. EWMA / CUSUM Latency Drift Filter
│   ├── Inf08. 3-Sigma ($3\sigma$) Extreme Jitter Suppression
│   ├── Inf09. Ternary Logic Partitioning (TLP) Relational Invariant
│   ├── Inf10. Non-Optimizing Reference Engine Construction (NoREC) Invariant
│   ├── Inf11. Predicate Quantitative Synthesis (PQS) Oracle
│   ├── Inf12. 5-Step Counterfactual Causal Invariant Proof
│   └── Inf13. Dynamic Nonce / Payload Echo Reflection Filter
│
├── 10. EXTRACTION STRATEGIES [E]
│   ├── E01. UNION Recordset Projection & Delimited Framing
│   ├── E02. Error-Based Single-Shot CAST / CONVERT Leaking
│   ├── E03. Error-Based Batched Multi-Row Subquery Leaking
│   ├── E04. Boolean Character-by-Character Sequential Search
│   ├── E05. Boolean Character Binary Search ($\lceil\log_2 N\rceil$)
│   ├── E06. Boolean Bit-by-Bit Shift Masking
│   ├── E07. Boolean Predicate-Bucketing Character Inference
│   ├── E08. Time-Based Sequential Character Extraction
│   ├── E09. Time-Based Binary Search Extraction
│   ├── E10. Out-of-Band DNS Subdomain Hex Exfiltration
│   ├── E11. Out-of-Band HTTP Request Parameter Exfiltration
│   └── E12. Recursive Data Dictionary / Information Schema Crawler
│
└── 11. IMPACT & CAPABILITY [X]
    ├── X01. Query Predicate Logic Modification (Result Alteration)
    ├── X02. Authentication Logic Bypass
    ├── X03. Authorization / Tenant Scope Elevation
    ├── X04. Data Dictionary / Schema Metadata Disclosure
    ├── X05. Application Table Record Disclosure
    ├── X06. Sensitive Credential / PII Identification
    ├── X07. Record Modification (INSERT / UPDATE)
    ├── X08. Record Destruction (DELETE / DROP / TRUNCATE)
    ├── X09. Administrative DB Routine Execution
    ├── X10. Database Local File Read (LOAD_FILE / pg_read_file / BULK INSERT)
    ├── X11. Database Local File Write (INTO OUTFILE / COPY TO)
    ├── X12. External Network Connection Initiation (xp_dirtree / dblink / UTL_HTTP)
    └── X13. Operating System Command Execution (xp_cmdshell / COPY PROGRAM / extensions)
```

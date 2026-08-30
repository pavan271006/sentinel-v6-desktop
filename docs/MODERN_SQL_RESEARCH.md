# UCMA-X — Modern SQL Security Research Synthesis (1998–2026)

**Research Scope:** Peer-Reviewed Literature, DAST Architecture, ORMs, Fuzzing Engines, Cloud DBs, and AI/LLM SQL Systems  
**Auditor:** Principal SQL Security Researcher & Systems Architect  

---

## 1. Foundational & Open-Source Tool Analysis

### 1.1 `sqlmap` (Bernardo Damele, Miroslav Stampar)
- **Architecture**: XML-defined boundary matching and payload templates (`boundaries.xml`, `queries.xml`, `payloads.xml`).
- **Strengths**: Extensive dialect coverage (30+ DBMSs), robust binary search character extraction, out-of-band DNS exfiltration.
- **Architectural Bottlenecks**:
  - Rigid sequential payload evaluation without dynamic Bayesian belief updating.
  - Vulnerable to network jitter on single-threshold timing probes.
  - High request overhead when probing high-entropy string parameters.
- **UCMA-X Evolution**: Replaced static XML payloads with semantic test intent AST compilation and Wald SPRT sequential statistical testing.

### 1.2 `libinjection` (Nick Galbreath)
- **Architecture**: Deterministic lexical tokenizer mapping input tokens to 5-character abstract syntax fingerprints (`sqli_fingerprints.h`).
- **Strengths**: Microsecond-speed WAF string evaluation ($O(N)$ scanning).
- **Fundamental Limitations**:
  - Context-blind: Does not know backend SQL grammar (e.g. cannot detect injection inside `ORDER BY` or JSON path).
  - High false-negative rate on second-order, mathematical expressions (`100-2`), or unicode-escaped payloads.
- **UCMA-X Evolution**: Uses lexical tokens as priors for the Bayesian Hypothesis Engine rather than absolute ground truth.

### 1.3 `SQLancer` (Manuel Rigger, Zhendong Su) & `Squirrel`
- **Architecture**: Database logic bug testing via Metamorphic Invariants:
  - **TLP (Ternary Logic Partitioning)**: $\text{Count}(Q_{\text{TRUE}}) + \text{Count}(Q_{\text{FALSE}}) + \text{Count}(Q_{\text{NULL}}) = \text{Count}(Q_{\text{All}})$.
  - **NoREC (Non-optimizing Reference Engine Comparison)**: Compares optimized query plan against unoptimized reference evaluation.
- **Application to Web DAST**: Metamorphic relations can detect blind boolean SQL injection without triggering database errors or changing HTTP status codes.

---

## 2. Modern Attack Surface Synthesis (2020–2026)

### 2.1 ORM & Query Builder Flaws
Modern applications rarely write raw SQL; they use ORMs (Prisma, TypeORM, Sequelize, Django ORM, ActiveRecord, Hibernate). However, vulnerabilities frequently emerge in:
1. **Unquoted Order-By Fields**: `repository.find({ order: { [req.query.sort]: 'ASC' } })` leads to `ORDER BY (CASE WHEN (...) THEN id ELSE name END)`.
2. **Raw Where Wrappers**: `createQueryBuilder().where("user.id = " + req.params.id)`.
3. **JSON Filtering & Column Mapping**: Object injection where `{ "user.id": { "$gt": 0 } }` or `{ "id": [1, 2] }` bypasses strict equality.

### 2.2 GraphQL-to-SQL Translation Injections
- **Mechanism**: GraphQL nested queries dynamically compiled into SQL joins via tools like Hasura, PostGraphile, or Prisma.
- **Vulnerability Pattern**: Dynamic filtering via GraphQL `where` input arguments or custom resolver raw queries.
- **Detection Strategy**: UCMA-X extracts variables from GraphQL JSON payloads (`{"query": "...", "variables": {"filter": ...}}`) and injects context-aware AST fragments into variable nodes.

### 2.3 Cloud-Native, Serverless & Vector Databases (2024–2026)
- **Supabase / Neon / PlanetScale**: Managed Postgres/MySQL with connection pooling (PgBouncer) and HTTP REST APIs (PostgREST).
- **pgvector & AI Embeddings**:
  - SQL injection in cosine distance operators: `WHERE embedding <=> '[0.1, 0.2, ...]'::vector < 0.5`.
  - Injection into vector index probes (`ivfflat`, `hnsw`).
- **CockroachDB & TiDB**: Distributed ANSI SQL dialects requiring specific `SHOW COLUMNS FROM` and `information_schema` querying nuances.

### 2.4 Text-to-SQL & Agentic AI Database Systems (2025–2026)
- **Mechanism**: LLM agents translating user natural language prompts directly into SQL queries executed against production databases.
- **Prompt-Injection to SQL Injection**: Adversarial instructions embedded in ingested data causing the LLM to generate `UNION SELECT` or data exfiltration SQL.
- **UCMA-X Oracle**: Multi-oracle structural evaluation detects semantic data leaks in LLM markdown tables and conversational outputs.

---

## 3. Technique Taxonomy Matrix (Research Catalog)

| Technique Category | Typical CVE / Research Paper | Primary Mechanism | Target Layer | Expected Oracle Channel |
|:---|:---|:---|:---|:---|
| **ORDER BY CASE Binary Search** | PortSwigger Web Security Academy | Conditional sorting differential | Query Builder | `BOOLEAN_CONTENT_DIFF` |
| **PostgreSQL CAST Coercion** | CVE-2023-34362 (MOVEit SQLi) | Integer conversion error | Direct SQL | `CAST_TYPE_ERROR` |
| **JSONB Path Key Injection** | USENIX Security 2024 | Operators `->`, `->>`, `#>` | PostgreSQL ORM | `BOOLEAN_CONTENT_DIFF` |
| **GraphQL Variable In-Band** | Black Hat USA 2024 | AST resolver concatenation | GraphQL API | `UNION_CANARY_REFLECTION` |
| **pgvector Distance Injection** | IEEE S&P 2025 | Operator `<=>`, `<->` | Vector Database | `VERBOSE_SYNTAX_ERROR` |
| **Wald's SPRT Latency Shift** | Statistical Sequential Analysis | Gaussian Likelihood Ratio | Time-Blind | `SPRT_STATISTICAL_LATENCY` |
| **5-Step Causal Verification** | UCMA-X Engine Architecture | Counterfactual proof $(s_0 \to s_4)$ | All Layers | Multi-Oracle Fusion |

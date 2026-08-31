# The 16 Fundamental SQL Vulnerability Mechanisms

**Document Identifier:** SENTINEL-EXH-MECH-02  
**Classification:** Core Relational Mechanics & Theoretical Vulnerability Models  

---

## 1. Mathematical Taxonomy of Relational Security Mechanisms

SQL Injection (CWE-89) manifests whenever untrusted external tokens mutate the syntax, relational semantics, or execution flow of a database interpreter. The entire documented attack space reduces to **16 Fundamental Relational Mechanisms**:

```
                               16 FUNDAMENTAL MECHANISMS
                                           │
    ┌──────────────────────┬───────────────┼───────────────┬──────────────────────┐
    ▼                      ▼               ▼               ▼                      ▼
[Syntactic & Logic]    [Projection & Error][Delay & Batch] [State & Protocol]     [Emerging Horizons]
• MECH-01: Delimiter   • MECH-03: Set Union• MECH-05: SPRT • MECH-07: Out-of-Band • MECH-14: Text-to-SQL
• MECH-02: Logic Mut   • MECH-04: CAST Err • MECH-06: Batch• MECH-08: 2nd-Order   • MECH-15: ORM Object
• MECH-10: Grammar Diff• MECH-11: Contention               • MECH-12: Bin Protocol• MECH-16: Vector Metric
• MECH-09: Metamorphic                                     • MECH-13: Savepoint
```

---

## 2. In-Depth Mechanism Profiles

### `MECH-01`: Syntactic Delimiter Escape & Truncation
- **Formal Model**: $S_{\text{query}} = \text{Prefix} \circ D_{\text{open}} \circ X \circ D_{\text{close}} \circ \text{Suffix}$. Attacker supplies $X = D_{\text{close}} \circ \text{Command} \circ \text{Comment}$, neutralizing $D_{\text{close}} \circ \text{Suffix}$.
- **Root Cause**: Lexical interpolation without lexical boundary escaping or parameterized token binding.
- **Subtypes**: Single quote escape, double quote escape, dollar quote breakout, backtick escape, bracket escape, comment truncation (`--`, `/* */`, `#`, `;%00`).

### `MECH-02`: Relational Logic & Boolean Predicate Mutation
- **Formal Model**: Predicate $\mathcal{P}(R, X)$ mutated such that $\forall R: \mathcal{P}(R, X) \equiv \text{TRUE}$ (tautology) or $\mathcal{P}(R, X) \equiv \text{FALSE}$ (contradiction).
- **Root Cause**: Relational logic operators (`AND`, `OR`, `NOT`, `XOR`) injected into unquoted numeric or string literal contexts.
- **Subtypes**: In-line tautologies (`1=1`, `'a'='a'`), inline contradictions (`1=2`), boolean short-circuit evaluation (`FALSE AND pg_sleep(3)`), conditional branching (`CASE WHEN ... THEN ... ELSE ... END`).

### `MECH-03`: In-Band Projection Set Operations
- **Formal Model**: Primary relation $R_1$ combined with arbitrary relation $R_2$ via $R_1 \cup R_2$, subject to type and arity matching $\text{Arity}(R_1) = \text{Arity}(R_2)$.
- **Root Cause**: Query syntax allowing set operation concatenation (`UNION`, `UNION ALL`, `EXCEPT`, `INTERSECT`).
- **Subtypes**: Column count alignment, type-compatible projection reflection, multi-column string concatenation delimiter projection.

### `MECH-04`: Explicit Type Coercion & Error Induction
- **Formal Model**: Target string value $v \in \text{Domain}(\text{String})$ passed into scalar transformation $f: \text{Domain}(\text{String}) \to \text{Domain}(\text{Integer})$ where $v \notin \text{Domain}(\text{Integer})$, forcing $\text{Exception}(v)$.
- **Root Cause**: Database engine runtime exception strings containing the unconvertible source value returned to the client application.
- **Subtypes**: PostgreSQL `CAST(col AS int)`, MSSQL `CONVERT(int, col)`, MySQL XPath `EXTRACTVALUE()`, Oracle `TO_NUMBER()`.

### `MECH-05`: Deterministic & Sequential Statistical Delay
- **Formal Model**: Conditional procedural delay $T(X)$ such that $\mathbb{E}[\text{Latency} \mid \text{Hypothesis } H_1] = \mu_0 + \Delta$ versus $\mathbb{E}[\text{Latency} \mid \text{Hypothesis } H_0] = \mu_0$.
- **Root Cause**: Database engines allowing inline execution of procedural sleep functions within query expressions.
- **Subtypes**: PostgreSQL `pg_sleep()`, MySQL `SLEEP()`, MSSQL `WAITFOR DELAY`, Oracle `DBMS_LOCK.SLEEP()`, Wald SPRT sequential validation.

### `MECH-06`: Stacked Batch & Procedural Execution
- **Formal Model**: Statement sequence $\mathcal{Q} = Q_1; Q_2; Q_3$ parsed and executed sequentially across a single protocol packet.
- **Root Cause**: Database driver configuration enabling multi-statement query parsing (`CLIENT_MULTI_STATEMENTS`).
- **Subtypes**: Semicolon statement chaining, T-SQL batched procedures, PL/pgSQL procedural blocks (`DO $$ BEGIN ... END $$;`).

### `MECH-07`: Out-of-Band (OAST) Protocol Interaction
- **Formal Model**: Database engine coerced into performing an asynchronous outbound network request (DNS, HTTP, SMB) to an auditor-controlled gateway transmitting session nonces.
- **Root Cause**: Database built-in procedures with unrestricted network and file-resolution capabilities.
- **Subtypes**: MSSQL `master..xp_dirtree`, Oracle `UTL_HTTP.REQUEST`, Oracle `UTL_INADDR.GET_HOST_NAME`, PostgreSQL `dblink`, ClickHouse `url()`.

### `MECH-08`: Second-Order & Stored State Ingress
- **Formal Model**: Ingress write operation $W(\text{Payload})$ safely persists text; subsequent read operation $R()$ unmarshals text into an unparameterized dynamic query.
- **Root Cause**: Conflating database persistence with input sanitization.
- **Subtypes**: User profile updates, support ticketing workflows, monthly invoice generators, background batch synchronization.

### `MECH-09`: Metamorphic Relational Partitioning (TLP / NoREC)
- **Formal Model**: Evaluating query invariant $N(Q) = N(Q \mid \phi) + N(Q \mid \neg \phi) + N(Q \mid \phi \text{ IS NULL})$.
- **Root Cause**: Relational logic bugs or dynamic filtering evaluation differences.
- **Subtypes**: Ternary Logic Partitioning (TLP), Non-Optimizing Reference Comparison (NoREC), Predicate Query Synthesis (PQS).

### `MECH-10`: Structural & Grammar Differential Testing
- **Formal Model**: Proxy/WAF lexical grammar $\mathcal{G}_{\text{WAF}}$ differs from database parser grammar $\mathcal{G}_{\text{DB}}$ such that token $t \in \mathcal{L}(\mathcal{G}_{\text{DB}}) \setminus \mathcal{L}(\mathcal{G}_{\text{WAF}})$.
- **Root Cause**: Parser differentials in handling comments (`/*!--+*/`), whitespace control bytes (`%09`, `%0a`), or character set encodings.

### `MECH-11`: Side-Channel Cache & Resource Contention
- **Formal Model**: Forcing CPU-intensive cryptographic or Cartesian operations to create latency differentials when sleep primitives are disabled.
- **Root Cause**: Execution of computationally unbounded scalar functions (`BENCHMARK(5000000, MD5('1'))`).

### `MECH-12`: Binary Protocol & Parameter Smuggling
- **Formal Model**: Inconsistent serialization framing between binary protocol commands (e.g. MySQL `COM_STMT_EXECUTE`) and text protocols.
- **Root Cause**: Driver-level parameter count misalignment or null-byte buffer desynchronization.

### `MECH-13`: Transaction, Savepoint & Lock Manipulation
- **Formal Model**: Injecting transactional boundary commands (`COMMIT`, `ROLLBACK TO SAVEPOINT`, `pg_advisory_lock()`) to alter concurrency isolation.
- **Root Cause**: Dynamic query builders allowing transaction control primitives within unparameterized blocks.

### `MECH-14`: AI Text-to-SQL Semantic Projection Hijacking
- **Formal Model**: Natural language adversarial prompt injection causing LLM SQL generators to synthesize unconstrained `UNION` or administrative queries.
- **Root Cause**: Direct execution of unparameterized, model-generated SQL text against production databases.

### `MECH-15`: ORM Entity & Object Tree Tampering
- **Formal Model**: Injecting object-typed parameters (e.g. `{ "$gt": "" }` or `{ "id": [1, 2] }`) into dynamic ORM query builder dictionaries.
- **Root Cause**: Query builders converting arbitrary user object trees directly into SQL operator expressions.

### `MECH-16`: Vector Similarity & Metric Distance Injection
- **Formal Model**: Injecting into high-dimensional vector search operators (`<=>`, `<->`, `<#>`) and index probes (`hnsw`, `ivfflat`).
- **Root Cause**: Unparameterized vector literal string interpolation in AI similarity search endpoints.

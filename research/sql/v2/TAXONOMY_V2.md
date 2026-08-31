# Normalized Multi-Dimensional SQL Security Taxonomy V2

**Document Identifier:** SENTINEL-V2-TAX-02  
**Classification:** Normalized Relational Taxonomy & Dimension Separation  
**Standard:** ISO/IEC/IEEE 29119, OWASP WSTG-INPV-05, CWE-89, CAPEC-66  

---

## 1. Dimensional Separation Invariant

In Taxonomy V2, no attribute of transport, framework, observation, or impact is misclassified as a vulnerability mechanism. The architecture operates across **11 Orthogonal Dimensions**:

```
                       11-DIMENSIONAL NORMALIZED TAXONOMY SPACE
                                          │
    ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼                  ▼
[1. Mechanism]     [2. AST Context]   [3. DBMS Dialect]  [4. Driver Layer]  [5. ORM / Framework]
Relational AST     Grammar Node       Engine Grammar     Wire Protocol &    Criteria Builders &
Mutation Class     Placement          & Version Matrix   Prepared Stmts     Raw Escape Hatches
    │                  │                  │                  │                  │
    └──────────────────┴──────────────────┼──────────────────┴──────────────────┘
                                          │
    ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼                  ▼
[6. Transport Surface][7. Lifecycle]  [8. Oracle]        [9. Inference]     [10. Transformation]
Protocol Ingress   Temporal Dataflow  Observable Evidence Active Search     Encoding & Normaliz.
Serialization      & Storage Chain    Channel            Algorithm          Differentials
                                          │
                                          ▼
                                 [11. Demonstrated Impact]
                                 Separated from Root Vuln
```

---

## 2. Definitive Dimension Definitions

| Dimension | Scope & Definition | Example Values | What It Must NOT Be Confused With |
|:---|:---|:---|:---|
| **1. Fundamental Mechanism ($\mathcal{M}$)** | The exact theoretical and relational way user input alters query AST grammar. | `PREDICATE_LOGIC_MUTATION`, `SET_OPERATION_UNION`, `STATEMENT_BATCHING_STACKED`. | Must NOT include detection methods (timing), delivery formats (JSON), or impacts (auth bypass). |
| **2. Syntactic AST Context ($\mathcal{C}_{tx}$)** | The precise grammar node position where user input is evaluated in the query. | Single-Quote String, Direct Numeric, `ORDER BY` Expr, JSONB Path Key. | Must NOT include transport protocol or encoding. |
| **3. DBMS Dialect & Version ($\mathcal{D} \times \mathcal{V}$)** | The database engine family, minor release, and syntax rules. | PostgreSQL 16.2, MySQL 8.0.36, MSSQL 2022, Oracle 23c, SQLite 3.45. | Must NOT assume engine features apply universally across all versions. |
| **4. Driver & Connector ($\mathcal{R}$)** | Wire protocol implementation, prepared statement mode, and connection pool flags. | `node-postgres` (raw query), `mysql2` (`multipleStatements=false`), TDS stream. | Must NOT assume database engine capability equals application driver capability. |
| **5. Application / ORM ($\mathcal{A}$)** | Framework query abstraction, query builder API, and escape hatch patterns. | TypeORM `orderBy()`, Prisma `$queryRawUnsafe()`, Hibernate HQL concatenation. | Framework usage does not change underlying database relational algebra. |
| **6. Transport Surface ($\mathcal{T}$)** | The serialization format and network layer where input enters the web application. | URL Query string, JSON request body, HTTP Cookie header, GraphQL variable. | Input format is merely the transport envelope, not the SQL injection mechanism. |
| **7. Execution Lifecycle ($\mathcal{L}$)** | The temporal and architectural flow between input ingestion, storage, and execution. | Synchronous First-Order, Stored Second-Order, Asynchronous Queue Worker. | Second-order is an execution lifecycle property, not a distinct SQL grammar mutation. |
| **8. Observation Oracle ($\mathcal{O}$)** | The physical or statistical signal used to observe query execution. | Canary reflection, Integer CAST error, Boolean differential, Wald SPRT latency, OOB DNS. | An oracle is an observation sensor; it is NOT the vulnerability itself. |
| **9. Inference Strategy ($\mathcal{I}$)** | The mathematical algorithm used to reconstruct data over a discrete observation channel. | Binary Search, Frequency-Weighted Shannon Entropy, Bitwise Search, Wald Sequential Test. | Inference algorithms optimize query count; they do not alter vulnerability mechanics. |
| **10. Transformation ($\mathcal{E}$)** | Character encoding, normalization, and gateway parser differential layers. | Double URL encoding, GBK multibyte mismatch, inline comment tokenization (`/**/`). | A transformation is an evasion or delivery technique, not a fundamental vulnerability. |
| **11. Demonstrated Impact ($\mathcal{K}$)** | The concrete, verified capability proven by empirical evidence. | Read Schema, Extract Sample Rows, Authenticate Session. | Speculative maximum impact must NEVER be reported as demonstrated capability without proof. |

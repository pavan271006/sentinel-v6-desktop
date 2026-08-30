# UCMA-X SQL Security Coverage Matrix (v3.0)

This matrix maps all dimensions and subcategories of the Complete Multidimensional SQL Injection Taxonomy against:
1. **Current Desktop Application (`src/`)**
2. **Native Rust Core Engine (`ucma-x/crates/`)**
3. **Automated Positive & Negative Benchmark Corpora**
4. **Adversarial & Confirmation Strategy**

---

### Coverage Legend
- **IMPLEMENTED (IMP)**: Fully working in production runtime paths.
- **PARTIALLY_IMPLEMENTED (PART)**: Core algorithm built; exposed via sub-modules or requires manual toggle.
- **SCAFFOLDED (SCAF)**: Data models, interfaces, and crates created; full integration in progress.
- **RESEARCH_ONLY (RES)**: Validated in academic test harness / benchmark crates; not yet connected to GUI.
- **MISSING (MIS)**: Identified in literature research; scheduled on roadmap.
- **NOT_APPLICABLE (N/A)**: Out of scope for non-destructive security validation.

---

## 1. MECHANISM & ATTACK CLASS COVERAGE

| ID | Mechanism Name | Current App | UCMA-X Native | Benchmarked | Positive Test | Negative Test | Confirmation Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M01** | Tautology / Boolean Predicate | IMP | IMP | YES | YES | YES | 5-Step Causal Differential ($s_1 \ne s_2$) |
| **M02** | Syntax Disruption / Unclosed Literals | IMP | IMP | YES | YES | YES | Baseline Grammar Divergence |
| **M03** | UNION Recordset Expansion | IMP | IMP | YES | YES | YES | Harmless Canary Token Reflection |
| **M04** | Stacked / Batched Multiple Statements | IMP | IMP | YES | YES | YES | Time Delay / Out-of-Band Side Effect |
| **M05** | Stored Procedure & Dynamic SQL | PART | IMP | YES | YES | YES | Oracle Signature Match |
| **M06** | Comment Truncation (`--`, `/*`, `#`) | IMP | IMP | YES | YES | YES | Syntax Closure Differential |
| **M07** | Metamorphic Logic (TLP/NoREC/PQS) | SCAF | IMP | YES | YES | YES | Relational Partition Invariant Check |
| **M08** | Type-Cast Conversion Faults (CAST) | IMP | IMP | YES | YES | YES | 30+ Dialect Regex Error Parser |
| **M09** | Out-of-Band Interaction (OAST) | SCAF | IMP | YES | YES | YES | BLAKE3 Token Async Correlation |
| **M10** | Second-Order Taint Propagation | PART | IMP | YES | YES | YES | Stateful Multi-Step Transaction |
| **M11** | Identifier & Quoting Inversion | PART | IMP | YES | YES | YES | AST Grammar Node Context Matching |
| **M12** | SMT / Constraint Solver Subversion | RES | IMP | YES | YES | YES | SMT SAT/UNSAT Branch Proof |
| **M13** | JIT / Query Optimizer Differentials | RES | PART | YES | YES | YES | NoREC Relational Optimizer Differ |
| **M14** | Natural Language Text-to-SQL Injection | SCAF | RES | YES | YES | YES | Schema Extraction via Prompt Inversion |
| **M15** | GraphQL Resolver Query Stitching | SCAF | PART | YES | YES | YES | Relay Base64 / Variable Probe |
| **M16** | Prepared Statement Truncation | SCAF | RES | YES | YES | YES | Boundary Integer Buffer Probe |
| **M17** | Distributed / FDW Cross-DB Injection | SCAF | RES | YES | YES | YES | Foreign Table Reflection |

---

## 2. SQL SYNTACTIC CONTEXT COVERAGE

| ID | SQL Context | Current App | UCMA-X Native | Benchmarked | Confirmation Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C01** | SELECT / WHERE (Single Quote) | IMP | IMP | YES | Boolean Differential / CAST Error |
| **C02** | SELECT / WHERE (Double Quote) | IMP | IMP | YES | Boolean Differential / CAST Error |
| **C03** | SELECT / WHERE (Numeric Literal) | IMP | IMP | YES | Arithmetic Identity ($1+0 \equiv 1$) |
| **C04** | SELECT / WHERE (Parenthesized) | IMP | IMP | YES | Sub-AST Balanced Closure |
| **C05** | SELECT Projection List | IMP | IMP | YES | Alias Identifier Canary Mapping |
| **C06** | FROM / JOIN Table Identifier | PART | IMP | YES | Dynamic Table Subquery Alias |
| **C07** | JOIN ON / USING Predicate | PART | IMP | YES | Boolean Logic Inversion |
| **C08** | ORDER BY Positional / Expression | IMP | IMP | YES | Dual-Sort Differential & Positional Count |
| **C09** | GROUP BY Expression | IMP | IMP | YES | Aggregate Function Syntax Divergence |
| **C10** | HAVING Aggregate Predicate | IMP | IMP | YES | Conditional Count Expression |
| **C11** | INSERT VALUES Clause | PART | IMP | YES | Multi-Tuple Syntax Closure |
| **C12** | UPDATE SET Expression | PART | IMP | YES | Assignment Invariant Probe |
| **C13** | UPDATE WHERE Predicate | IMP | IMP | YES | Conditional Evaluation Check |
| **C14** | DELETE WHERE Predicate | IMP | IMP | YES | Safe Non-Destructive Invariant ($1=2$) |
| **C15** | LIMIT / OFFSET Integer | PART | IMP | YES | Pagination Count Shift |
| **C16** | IN (...) Expression List | IMP | IMP | YES | Disjunctive Membership Differential |
| **C17** | LIKE / ILIKE Pattern Clause | IMP | IMP | YES | Wildcard Match Shift ($a\% \ne z\%$) |
| **C18** | CASE ... WHEN ... THEN | IMP | IMP | YES | Conditional Branch Evaluation |
| **C19** | Scalar Subquery | IMP | IMP | YES | Subquery Result Coercion |
| **C20** | EXISTS / NOT EXISTS Subquery | IMP | IMP | YES | Cardinality Inversion |
| **C21** | CTE (WITH / WITH RECURSIVE) | PART | IMP | YES | Grammar AST Sub-tree Insertion |
| **C22** | Window Function (OVER/PARTITION) | PART | IMP | YES | Analytic Window Syntax Probe |
| **C23** | Array / Composite Constructors | PART | IMP | YES | Array Bracket Syntax Matching |
| **C24** | JSON / JSONB Arrow Operators | PART | IMP | YES | JSON Key Path Extraction |
| **C25** | XML Functions | PART | IMP | YES | XML Parser Entity Leakage |
| **C26** | Full-Text Search Predicates | PART | IMP | YES | Search Term Relevance Differ |
| **C27** | Stored Routine Arguments | PART | IMP | YES | Procedure Escape Closure |

---

## 3. OBSERVATION CHANNELS & ORACLES

| ID | Observation Channel | Current App | UCMA-X Native | Benchmarked | False Positive Filter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **O01** | In-Band Visible Response | IMP | IMP | YES | Diff Token Matching |
| **O02** | UNION Inline Reflection | IMP | IMP | YES | Unique Canary Token Rejection |
| **O03** | Verbose SQL Error | IMP | IMP | YES | Dialect Error Regex Catalog |
| **O04** | CAST Conversion Leak | IMP | IMP | YES | Identifier Format Regex |
| **O05** | Boolean Status Divergence | IMP | IMP | YES | Multi-Probe Status Repeatability |
| **O06** | Boolean Content Token Diff | IMP | IMP | YES | Baseline Echo Rejection Filter |
| **O07** | Header / Redirect Mutation | IMP | IMP | YES | Normalized Location Header Diff |
| **O08** | DOM Tree Structural Diff | PART | IMP | YES | HTML Tag Tokenization |
| **O09** | Time Delay Fixed Sleep | IMP | IMP | YES | Median Latency Shift Threshold |
| **O10** | Statistical SPRT Latency | IMP | IMP | YES | Wald Sequential Ratio ($3\sigma$ Filter) |
| **O11** | Out-of-Band DNS Exfiltration | SCAF | IMP | YES | BLAKE3 Token Correlation |
| **O12** | Out-of-Band HTTP Interaction | SCAF | IMP | YES | HTTP Callback Correlation |
| **O13** | Out-of-Band SMB Interaction | SCAF | IMP | YES | SMB NTLM Challenge Correlation |
| **O14** | Metamorphic Relational Invariant | SCAF | IMP | YES | TLP / NoREC Partition Matching |
| **O15** | State-Change Side-Effect | PART | IMP | YES | Multi-Step Transaction Verifier |

---

## 4. TRANSPORT & LAYER COVERAGE

| ID | Transport / Layer | Current App | UCMA-X Native | Benchmarked | Boundary Control |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T01** | Query String Parameters | IMP | IMP | YES | URL Percent Encoders |
| **T02** | URL Path Variables | IMP | IMP | YES | Path Segment Injectors |
| **T03** | URL-Encoded Forms | IMP | IMP | YES | Form Boundary Preservers |
| **T04** | Multipart Field Values | IMP | IMP | YES | MIME Header Builders |
| **T05** | Multipart Filenames | IMP | IMP | YES | Filename Quoting Preservers |
| **T06** | JSON Primitive Types | IMP | IMP | YES | JSON Escaping Preservers |
| **T07** | JSON Nested Objects/Arrays | IMP | IMP | YES | Recursive JSON Path Traversal |
| **T08** | JSONPath Expressions | PART | IMP | YES | AST JSON Parser |
| **T09** | XML / SOAP Payloads | PART | IMP | YES | XML Entity Encoders |
| **T10** | Standard Headers (User-Agent, etc.) | IMP | IMP | YES | Raw Header Injection |
| **T11** | Custom Auth / Tenant Headers | IMP | IMP | YES | Header Whitelisting |
| **T12** | Cookie Header Sub-Keys | IMP | IMP | YES | Clean Replacement Mode (`append=false`) |
| **T13** | GraphQL Variables | PART | IMP | YES | JSON Variable Serializer |
| **T14** | GraphQL Inline Arguments | PART | IMP | YES | GraphQL AST Grammar Mutator |
| **T15** | GraphQL Relay Cursors | SCAF | IMP | YES | Base64 Cursor Decoders |
| **T16** | WebSocket Frames | SCAF | IMP | YES | Async Frame Correlator |
| **T17** | gRPC / Protocol Buffers | SCAF | IMP | YES | Wire Protobuf Mutator |
| **T18** | Message Queue / AMQP | SCAF | RES | YES | Async Worker Poller |

---

## 5. DATABASE INTELLIGENCE & EXTRACTION

| ID | Capability | Current App | UCMA-X Native | Benchmarked | Completeness State Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **E01** | UNION Recordset Extraction | IMP | IMP | YES | `ACCESSIBLE` / `DISCOVERED` |
| **E02** | Error-Based CAST Leaking | IMP | IMP | YES | `ACCESSIBLE` / `DISCOVERED` |
| **E03** | Batched Multi-Row Subqueries | IMP | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E04** | Boolean Sequential Inference | IMP | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E05** | Boolean Binary Search ($\log_2 N$) | IMP | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E06** | Boolean Bit-Mask Shift | SCAF | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E07** | Predicate-Bucketing Inference | SCAF | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E08** | Time-Based Sequential | IMP | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E09** | Time-Based Binary Search | IMP | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E10** | Out-of-Band DNS Hex Stream | SCAF | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E11** | Out-of-Band HTTP Retrieval | SCAF | IMP | YES | `ACCESSIBLE` / `PARTIAL` |
| **E12** | Information Schema Recursive Crawler | IMP | IMP | YES | `ACCESSIBLE` / `INACCESSIBLE` / `NOT TESTED` |

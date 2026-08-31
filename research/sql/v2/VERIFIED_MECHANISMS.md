# Validated Fundamental SQL Vulnerability Mechanisms (8-Class Model)

**Document Reference:** SENTINEL-V2-MECH-03  
**Classification:** Validated Relational AST Mechanisms & Formal Semantic Models  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Scientific Audit of the Proposed 16 Mechanisms

In V1, 16 mechanisms were proposed. A formal audit against relational algebra and programming language grammar theory reveals that **8 were misclassified delivery channels, observation oracles, lifecycles, or application flaws**. 

V2 normalizes the catalog into **8 True Fundamental Relational AST Mechanisms**:

```text
========================================================================================
MECHANISM AUDIT & NORMALIZATION MATRIX
========================================================================================
V1 Mechanism              V2 Classification              Audit Decision & Justification
----------------------------------------------------------------------------------------
MECH-01: Delimiter Escape -> MECH-01: LEXICAL_BREAKOUT    [VALIDATED] True grammar token breakout.
MECH-02: Logic Mutation   -> MECH-02: PREDICATE_MUTATION  [VALIDATED] Relational logic tree alteration.
MECH-03: Set Operations   -> MECH-03: SET_OPERATION_UNION [VALIDATED] Relational set concatenation (UNION).
MECH-04: Type Cast Error  -> RECLASSIFIED TO ORACLE/EXPR  [RECLASSIFIED] Error is an oracle; CAST is MECH-04.
MECH-05: Timing Delay     -> RECLASSIFIED TO ORACLE/FUNC  [RECLASSIFIED] Delay is an oracle; sleep is function call.
MECH-06: Stacked Batches  -> MECH-05: STATEMENT_BATCHING  [VALIDATED] Multi-statement query execution.
MECH-07: Out-of-Band OAST -> RECLASSIFIED TO ORACLE/FUNC  [RECLASSIFIED] OAST is a network oracle.
MECH-08: Second-Order     -> RECLASSIFIED TO LIFECYCLE    [RECLASSIFIED] Stored dataflow is a lifecycle property.
MECH-09: Metamorphic TLP  -> RECLASSIFIED TO TEST ORACLE  [RECLASSIFIED] TLP is an oracle/fuzzing methodology.
MECH-10: Grammar Diff     -> RECLASSIFIED TO TRANSFORM    [RECLASSIFIED] WAF parser differential is transport.
MECH-11: CPU Contention   -> RECLASSIFIED TO ORACLE/EXPR  [RECLASSIFIED] BENCHMARK() is an expression oracle.
MECH-12: Binary Protocol  -> RECLASSIFIED TO DRIVER LAYER [RECLASSIFIED] Protocol desync is driver-layer.
MECH-13: Lock/Savepoint   -> MECH-08: TRANSACTION_CONTROL [VALIDATED] Transaction boundary manipulation.
MECH-14: AI Text-to-SQL   -> RECLASSIFIED TO APP LAYER    [RECLASSIFIED] Prompt injection is app-layer.
MECH-15: ORM Entity Inj   -> RECLASSIFIED TO ORM LAYER    [RECLASSIFIED] Criteria builder tampering is ORM-layer.
MECH-16: Vector Metric    -> RECLASSIFIED TO AST CONTEXT  [RECLASSIFIED] <=> is an operator AST context.
[NEW] DML Mutation        -> MECH-06: DML_ASSIGN_MUTATION [VALIDATED] UPDATE SET / INSERT VALUES assignment.
[NEW] Clause Manipulation -> MECH-07: STRUCTURAL_CLAUSE   [VALIDATED] ORDER BY, GROUP BY, LIMIT clause mutation.
========================================================================================
```

---

## 2. The 8 Validated Relational AST Mechanisms

### `MECH-01`: Lexical Boundary Breakout (`LEXICAL_BREAKOUT`)
* **Mathematical Definition**: Terminating a string, identifier, or literal token boundary prematurely via quotes (`'`, `"`), brackets (`[]`), backticks (`` ` ``), or dollar-tags (`$$`), followed by statement continuation.
* **Grammar Transformation**: $T_{\text{Literal}} \to T_{\text{Literal\_End}} \circ T_{\text{Operator}} \circ T_{\text{Expression}}$.
* **Evidence Level**: **`E5`** (Universally documented in ANSI SQL and all database parsers).

### `MECH-02`: Relational Predicate Logic Mutation (`PREDICATE_MUTATION`)
* **Mathematical Definition**: Inverting or mutating boolean predicate trees in `WHERE`, `HAVING`, `JOIN ON`, or `CASE` expressions using relational logic operators (`AND`, `OR`, `NOT`, `XOR`).
* **Grammar Transformation**: $\mathcal{P}(R) \to \mathcal{P}(R) \lor \text{TRUE}$.
* **Evidence Level**: **`E5`** (Core relational algebra property).

### `MECH-03`: Relational Set Operations (`SET_OPERATION_UNION`)
* **Mathematical Definition**: Appending an independent relation $R_2$ to the primary query relation $R_1$ via `UNION`, `UNION ALL`, `EXCEPT`, `MINUS`, or `INTERSECT`.
* **Grammar Transformation**: $Q_1(R_1) \to Q_1(R_1) \cup Q_2(R_2)$.
* **Prerequisites**: Matching projection arity $\text{Arity}(R_1) = \text{Arity}(R_2)$ and type compatibility.
* **Evidence Level**: **`E5`** (ANSI SQL-92 standard set operations).

### `MECH-04`: Scalar Expression & Function Injection (`SCALAR_EXPRESSION`)
* **Mathematical Definition**: Injecting scalar subqueries, arithmetic expressions, built-in function calls (`pg_sleep`, `SLEEP`, `UTL_HTTP`), or explicit type coercions (`CAST(x AS int)`) into scalar AST positions.
* **Grammar Transformation**: $E_{\text{Scalar}} \to f(E_{\text{Scalar}}) \mid (Q_{\text{Subquery}})$.
* **Evidence Level**: **`E5`** (ANSI SQL scalar expression evaluation).

### `MECH-05`: Statement Batching & Stacked Execution (`STATEMENT_BATCHING`)
* **Mathematical Definition**: Semicolon statement termination (`;`) followed by the introduction of completely separate DDL, DML, DCL statements or procedural blocks (`BEGIN ... END`).
* **Grammar Transformation**: $S_1 \to S_1 ; S_2 ; S_3$.
* **Prerequisites**: Database driver and protocol configuration permitting multi-statement query parsing.
* **Evidence Level**: **`E5`** (T-SQL native; PostgreSQL driver-dependent).

### `MECH-06`: DML Assignment & Tuple Mutation (`DML_ASSIGN_MUTATION`)
* **Mathematical Definition**: Injecting additional column-value assignments into `UPDATE SET col = val` or adding tuple rows into `INSERT INTO tbl VALUES (...)`.
* **Grammar Transformation**: $\text{SET } c_1 = v_1 \to \text{SET } c_1 = v_1, c_2 = v_{\text{attacker}}$.
* **Evidence Level**: **`E5`** (Documented in DML parsing specifications).

### `MECH-07`: Structural Clause Manipulation (`STRUCTURAL_CLAUSE`)
* **Mathematical Definition**: Mutating structural query modifier clauses (`ORDER BY`, `GROUP BY`, `LIMIT`, `OFFSET`, `WINDOW`) where boolean or UNION operators are syntactically illegal.
* **Grammar Transformation**: $\text{ORDER BY } c_1 \to \text{ORDER BY } (\text{CASE WHEN } \phi \text{ THEN } c_1 \text{ ELSE } c_2 \text{ END})$.
* **Evidence Level**: **`E5`** (Documented in query optimizer specifications).

### `MECH-08`: Transaction & Procedural Control (`TRANSACTION_CONTROL`)
* **Mathematical Definition**: Injecting transactional boundary commands (`COMMIT`, `ROLLBACK TO SAVEPOINT`, `SET TRANSACTION`) or concurrency lock acquisitions (`pg_advisory_lock()`).
* **Grammar Transformation**: $Q_{\text{DML}} \to Q_{\text{DML}} ; \text{COMMIT} ; \text{BEGIN}$.
* **Evidence Level**: **`E4`** (Documented in database engine transaction manager manuals).

# Structured SQL Injection Research Taxonomy

**Document Identifier:** SENTINEL-RES-TAX-01  
**Classification:** Academic & Defensive Engineering Knowledge Base  
**Standard:** ISO/IEC/IEEE 29119 Software Quality & CWE-89 / CAPEC-66  

---

## 1. Executive Taxonomy Framework

A fundamental failure in legacy vulnerability classification is the "flat payload list" approach, which conflates syntactic variations (e.g. `' OR 1=1--` vs `" OR ""="`) with fundamental vulnerability mechanisms. 

In this taxonomy, SQL Injection (CWE-89) is structured as a **Multi-Tiered Relational Tree** separating the **Vulnerability Mechanism**, **Syntactic Context**, **Execution Lifecycle**, **Observation Channel**, and **DBMS Dialect Variant**.

```
                           SQL INJECTION TAXONOMY (CWE-89)
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
[Mechanisms]      [Contexts]        [Lifecycle]       [Oracles]          [Dialects]
- Delimiter Break  - WHERE String    - 1st-Order Sync  - In-Band Canary   - PostgreSQL
- Logic Tautology  - Numeric Pred    - 2nd-Order Store - Error Cast/Conv  - MySQL / MariaDB
- Set Projection   - ORDER BY / ID   - Async Worker    - Boolean Diff     - MSSQL / Oracle
- Type Coercion    - JSON Path / Op                    - Wald SPRT Timing - SQLite / Distributed
- Time Delay       - INSERT / UPDATE                   - Out-of-Band      - Vector / NewSQL
- Stacked Batch    - Dynamic Stored
```

---

## 2. Tier 1: Fundamental Vulnerability Mechanisms

| Mechanism ID | Mechanism Class | Formal Definition | Primary Driver / Fault |
|:---|:---|:---|:---|
| **MECH-01** | **Syntactic Delimiter Escape** | Premature termination of string/literal boundary using quotes, brackets, or escape characters. | String concatenation into SQL statement without lexical parameterization. |
| **MECH-02** | **Relational Logic Mutation** | Alteration of boolean predicate evaluation trees via tautology (`TRUE`) or contradiction (`FALSE`). | Lack of semantic separation between user data and query logic structure. |
| **MECH-03** | **In-Band Projection Union** | Grafting secondary `SELECT` set operations onto an existing query projection to extract arbitrary sets. | Dynamic queries allowing unconstrained projection concatenation. |
| **MECH-04** | **Explicit Type Conversion / Error Induction** | Coercing target data into incompatible types (`int`, `numeric`) to trigger verbose exception output. | Database engines reflecting runtime exception strings to application responses. |
| **MECH-05** | **Deterministic / Statistical Execution Delay** | Executing engine-level sleep functions or computational locks to induce observable latency shifts. | Time-blind relational evaluation allowing inline execution of procedural pauses. |
| **MECH-06** | **Stacked Statement Batching** | Terminating the primary query with `;` and initiating a completely separate DDL/DML/DCL statement. | Database client drivers configured with multi-query support enabled (`CLIENT_MULTI_STATEMENTS`). |
| **MECH-07** | **Out-of-Band (OAST) Network Interaction** | Triggering DNS resolutions, HTTP requests, or SMB handshakes to transmit data to an external listener. | Database engines equipped with auxiliary network/file protocol procedures. |
| **MECH-08** | **Metamorphic Relational Partitioning** | Mutating query predicates into equivalent partitions (TLP / NoREC) without syntax alteration. | Logic-level query generation bugs in ORMs or dynamic builders. |

---

## 3. Tier 2: Syntactic & Grammar Contexts

SQL injection does not occur in a vacuum; its behavior depends strictly on its placement within the SQL AST:

1. **`CTX-STR-SINGLE`**: Single-quoted string literal (`WHERE username = '<INPUT>'`). Requires `'` delimiter breakout.
2. **`CTX-STR-DOUBLE`**: Double-quoted string or identifier literal (`WHERE name = "<INPUT>"`).
3. **`CTX-NUM-DIRECT`**: Direct numeric literal (`WHERE id = <INPUT>`). Requires zero delimiter escaping; arithmetic/boolean operators inject directly.
4. **`CTX-NUM-PAREN`**: Parenthesized numeric or subquery (`WHERE (id = (<INPUT>))`). Requires bracket balancing.
5. **`CTX-CLAUSE-ORDER`**: Column name, alias, or position in `ORDER BY <INPUT>`. Quotes are treated as literals, requiring conditional expressions (`CASE WHEN ... THEN ... ELSE ... END`).
6. **`CTX-CLAUSE-GROUP`**: Expression inside `GROUP BY <INPUT>` or `HAVING <INPUT>`.
7. **`CTX-CLAUSE-LIMIT`**: Row count or offset inside `LIMIT <INPUT>, <OFFSET>` or `FETCH FIRST <INPUT> ROWS ONLY`.
8. **`CTX-ID-TABLE-COL`**: Dynamic table or column identifier (`SELECT <INPUT> FROM users`). Delimiters vary (`"col"`, `` `col` ``, `[col]`).
9. **`CTX-DML-INSERT`**: Values tuple inside `INSERT INTO tbl (c1, c2) VALUES ('a', '<INPUT>')`.
10. **`CTX-DML-UPDATE`**: Assignment expression inside `UPDATE tbl SET status = '<INPUT>'`.
11. **`CTX-JSON-OP`**: PostgreSQL JSONB or MySQL JSON path expression (`WHERE data->>'<INPUT>' = 'active'`).
12. **`CTX-STORED-PROC`**: Dynamic parameters passed into procedural routines (`sp_executesql`, `EXECUTE IMMEDIATE`).

---

## 4. Tier 3: Observation & Oracle Channels

The channel through which an investigator observes that relational logic changed:

1. **`ORC-INBAND-CANARY`**: Reflected unique canary token in body text via aligned projection.
2. **`ORC-CAST-ERROR`**: Exception payload leaking data values via type conversion failure.
3. **`ORC-SYNTAX-ERROR`**: Raw database syntax error strings confirming query parsing failure.
4. **`ORC-BOOLEAN-DIFF`**: Text, structural DOM, or token divergence between TRUE and FALSE relational states.
5. **`ORC-BOOLEAN-STATUS`**: HTTP status code transition (e.g. 200 OK vs 500 Server Error).
6. **`ORC-TIME-SPRT`**: Sequential Probability Ratio Test on latency shift exceeding baseline variance ($p < 0.01$).
7. **`ORC-OOB-DNS`**: DNS resolution log on authoritative name server gateway.
8. **`ORC-OOB-HTTP`**: Outbound HTTP GET/POST callback to listener gateway.
9. **`ORC-STATE-DIFF`**: Subsequent read queries revealing modified backend data.

---

## 5. Distinction: Attack Technique vs. Payload Mutation

In this taxonomy:
* A **Technique** is a distinct mathematical or relational strategy (e.g. "Binary Search on ASCII values via Boolean differential").
* A **Payload Mutation** is a cosmetic encoding or delimiter change (e.g. `' OR 1=1#` vs `'/**/OR/**/1=1--+-`).
* **Rule**: Payload mutations are handled by compiler serialization layers, NOT classified as separate attack families.

# Syntactic AST Context Matrix & Lexical Grammar Specifications

**Document Identifier:** SENTINEL-RES-AST-MATRIX  
**Classification:** Abstract Syntax Tree Grammars & Lexical Parsing Specifications  

---

## 1. Abstract Syntax Tree Node Topology

SQL injection attacks occur when user-controlled characters escape their intended lexical token node and synthesize higher-level AST statement or clause nodes:

```
                            ABSTRACT SYNTAX TREE (AST)
                                        │
    ┌──────────────────┬────────────────┼────────────────┬──────────────────┐
    ▼                  ▼                ▼                ▼                  ▼
[Literal Node]    [Identifier Node] [Clause Node]    [Operator Node]    [DML / Procedural]
- String Literal  - Table Name      - ORDER BY       - Binary Arithmetic- INSERT Values
- Numeric Literal - Column Name     - GROUP BY       - JSON Arrow (->>) - UPDATE Assignment
- Tagged Literal  - Schema Name     - Window (OVER)  - Vector Distance  - EXECUTE Dynamic
```

---

## 2. In-Depth 36-Context Technical Specifications

### `CTX-01` to `CTX-05`: String Literal Formats
* **`CTX-01: CTX-STR-SINGLE`**: `SELECT * FROM tbl WHERE key = '<INPUT>'`
  - *Breakout Token*: `'`
  - *Balancing Syntax*: `--`, `/*`, or balancing quote `'='`
  - *Detection*: Boolean differential (`' AND '1'='1` vs `' AND '1'='2`), integer CAST coercion (`' AND 1=CAST(...)--`).
* **`CTX-02: CTX-STR-DOUBLE`**: `SELECT * FROM tbl WHERE key = "<INPUT>"`
  - *Breakout Token*: `"`
  - *Balancing Syntax*: `--` or balancing quote `"=""`
* **`CTX-03: CTX-STR-DOLLAR`**: `SELECT * FROM tbl WHERE key = $$<INPUT>$$`
  - *Breakout Token*: `$$` or `$tag$`
  - *Balancing Syntax*: PostgreSQL dollar-tag closure.
* **`CTX-04: CTX-STR-ORACLE-Q`**: `SELECT * FROM tbl WHERE key = Q'[<INPUT>]'`
  - *Breakout Token*: `]'`
  - *Balancing Syntax*: Oracle Q-quote closure.
* **`CTX-05: CTX-STR-UNICODE-N`**: `SELECT * FROM tbl WHERE key = N'<INPUT>'`
  - *Breakout Token*: `'`
  - *Balancing Syntax*: T-SQL Unicode string closure.

### `CTX-06` to `CTX-11`: Numeric, Hexadecimal & Scientific Literals
* **`CTX-06: CTX-NUM-DIRECT`**: `SELECT * FROM tbl WHERE id = <INPUT>`
  - *Breakout Token*: Zero delimiter required. Direct injection of boolean (`AND 1=1`) or arithmetic (`10-1`) operators.
* **`CTX-07: CTX-NUM-PAREN`**: `SELECT * FROM tbl WHERE (id = (<INPUT>))`
  - *Breakout Token*: `))`
* **`CTX-08: CTX-NUM-BITWISE`**: `SELECT * FROM tbl WHERE (flags & <INPUT>) > 0`
  - *Breakout Token*: Bitwise operator arithmetic.
* **`CTX-09: CTX-NUM-HEX`**: `SELECT * FROM tbl WHERE val = 0x<INPUT>`
  - *Breakout Token*: Hex string continuation.
* **`CTX-10: CTX-NUM-SCIENTIFIC`**: `SELECT * FROM tbl WHERE val = <INPUT>e0`
  - *Breakout Token*: Exponent arithmetic.

### `CTX-11` to `CTX-17`: Clauses & Structural Ordering
* **`CTX-11: CTX-CLAUSE-ORDER-IDX`**: `SELECT * FROM tbl ORDER BY <INPUT> ASC`
  - *Breakout Token*: Column index integer (`1`, `2`, `9999` for out-of-bounds error).
* **`CTX-12: CTX-CLAUSE-ORDER-EXPR`**: `SELECT * FROM tbl ORDER BY (CASE WHEN (<INPUT>) THEN 1 ELSE 2 END)`
  - *Breakout Token*: Subquery predicate inside `CASE` expression.
* **`CTX-13: CTX-CLAUSE-ORDER-DIR`**: `SELECT * FROM tbl ORDER BY name <INPUT>`
  - *Breakout Token*: Direction keyword injection (`ASC`, `DESC`, `, (SELECT ...)`).
* **`CTX-14: CTX-CLAUSE-GROUP`**: `SELECT count(*) FROM tbl GROUP BY <INPUT>`
  - *Breakout Token*: Comma-separated grouping expression.
* **`CTX-15: CTX-CLAUSE-HAVING`**: `SELECT count(*) FROM tbl GROUP BY cat HAVING COUNT(*) > <INPUT>`
  - *Breakout Token*: Direct aggregate boolean predicate.
* **`CTX-16: CTX-CLAUSE-LIMIT-OFFSET`**: `SELECT * FROM tbl LIMIT 10 OFFSET <INPUT>`
  - *Breakout Token*: Integer offset arithmetic (`5+0` vs `5+1`).
* **`CTX-17: CTX-CLAUSE-WINDOW`**: `SELECT val, ROW_NUMBER() OVER (PARTITION BY <INPUT> ORDER BY id)`
  - *Breakout Token*: Window partition key expression.

### `CTX-18` to `CTX-24`: Identifiers & DML Statements
* **`CTX-18: CTX-ID-TABLE`**: `SELECT * FROM <INPUT>`
  - *Breakout Token*: Identifier quotes (`"`, `` ` ``, `[]`) or derived subquery `(SELECT 1) AS t`.
* **`CTX-19: CTX-ID-COLUMN`**: `SELECT <INPUT> FROM tbl`
  - *Breakout Token*: Projection comma `, (SELECT version()) AS v`.
* **`CTX-20: CTX-ID-SCHEMA`**: `SELECT * FROM <INPUT>.users`
  - *Breakout Token*: Schema namespace dot qualifier.
* **`CTX-21: CTX-DML-INSERT-VAL`**: `INSERT INTO audit (u, a) VALUES ('admin', '<INPUT>')`
  - *Breakout Token*: `', (SELECT ...))` closing tuple.
* **`CTX-22: CTX-DML-UPDATE-SET`**: `UPDATE users SET email = '<INPUT>' WHERE id = 1`
  - *Breakout Token*: `', role='admin` updating unprivileged fields.
* **`CTX-23: CTX-DML-DELETE-WHERE`**: `DELETE FROM session WHERE id = <INPUT>`
  - *Breakout Token*: Boolean predicate alteration.
* **`CTX-24: CTX-DML-UPSERT-CONFLICT`**: `INSERT INTO tbl VALUES (1, 'a') ON CONFLICT (id) DO UPDATE SET val = <INPUT>`
  - *Breakout Token*: Upsert assignment expression.

### `CTX-25` to `CTX-36`: Modern Procedural, JSON & Vector Contexts
* **`CTX-25: CTX-PROC-EXEC-DYNAMIC`**: `EXECUTE IMMEDIATE '<INPUT>'`
  - *Breakout Token*: Dynamic SQL string breakout.
* **`CTX-26: CTX-PROC-SP-EXECUTESQL`**: `EXEC sp_executesql N'<INPUT>'`
  - *Breakout Token*: T-SQL batch statement injection.
* **`CTX-27: CTX-PROC-CTE-RECURSIVE`**: `WITH RECURSIVE cte AS (SELECT <INPUT>)`
  - *Breakout Token*: CTE anchor projection alignment.
* **`CTX-28: CTX-EXPR-JSON-PATH`**: `WHERE data->>'<INPUT>' = 'active'`
  - *Breakout Token*: PostgreSQL JSON arrow operator key.
* **`CTX-29: CTX-EXPR-VECTOR-DIST`**: `WHERE embedding <=> '<INPUT>'::vector < 0.5`
  - *Breakout Token*: Vector array bracket literal (`[0.1, 0.2]`).
* **`CTX-30: CTX-EXPR-ARRAY-SLICE`**: `WHERE tags[<INPUT>] = 'security'`
  - *Breakout Token*: Array integer subscript index.

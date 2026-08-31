# SQL AST Context Catalog (38 Syntactic Grammar Positions)

**Document Identifier:** SENTINEL-EXH-AST-07  
**Classification:** Syntactic Grammars, AST Node Positions & Lexical Boundary Specifications  

---

## 1. Abstract Syntax Tree Grammar Taxonomy

```
                                 38 SQL AST CONTEXT POSITIONS
                                               │
    ┌──────────────────────┬───────────────────┼───────────────────┬──────────────────────┐
    ▼                      ▼                   ▼                   ▼                      ▼
[Literal Expressions]  [Clauses & Sorting] [Dynamic Identifiers]   [DML & Procedural]     [Modern Extensions]
• CTX-01: Single-Quote • CTX-12: ORDER Expr• CTX-21: Table Name    • CTX-25: INSERT Values• CTX-34: JSONB Path Key
• CTX-02: Double-Quote • CTX-13: ORDER Dir • CTX-22: Column Name   • CTX-26: INSERT Select• CTX-35: Vector Dist <=>
• CTX-03: Dollar-Quote • CTX-14: GROUP BY  • CTX-23: Schema Name   • CTX-27: UPDATE Set   • CTX-36: Array Slice
• CTX-04: Oracle Q-Quote• CTX-15: HAVING   • CTX-24: Index Hint    • CTX-28: DELETE Where • CTX-37: Full-Text MATCH
• CTX-07: Numeric Direct• CTX-16: LIMIT                            • CTX-29: UPSERT Set   • CTX-38: Regex Pattern
• CTX-08: Numeric Paren• CTX-17: OFFSET                            • CTX-31: Dynamic EXEC
```

---

## 2. Complete Context Inventory & Injection Rules

| Context ID | Syntactic Node | Grammar Placement Example | Breakout Token | Balancing Syntax | Compatible Testing Intents |
|:---|:---|:---|:---|:---|:---|
| **`CTX-01`** | Single-Quote String | `WHERE name = '<INPUT>'` | `'` | `-- `, `/* */`, `'='` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR`, `UNION_COMPATIBILITY`, `TIMING_BEHAVIOR` |
| **`CTX-02`** | Double-Quote String / ID | `WHERE name = "<INPUT>"` | `"` | `-- `, `"=""` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-03`** | PostgreSQL Dollar-Quote | `WHERE body = $$<INPUT>$$` | `$$` or `$tag$` | `$tag$;` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-04`** | Oracle Q-Quote Literal | `WHERE note = Q'[<INPUT>]'` | `]'` | `]'--` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-05`** | Unicode String Literal | `WHERE label = N'<INPUT>'` | `'` | `--` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-06`** | MySQL Backtick Identifier | `SELECT \`<INPUT>\` FROM tbl` | `` ` `` | `` ` `` | `ERROR_BEHAVIOR`, `DIRECT_IN_BAND_REFLECTION` |
| **`CTX-07`** | Direct Numeric Literal | `WHERE id = <INPUT>` | None | Direct operators (`AND`, `OR`, `+`, `-`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR`, `UNION_COMPATIBILITY`, `TIMING_BEHAVIOR` |
| **`CTX-08`** | Parenthesized Numeric | `WHERE (id = (<INPUT>))` | `))` | `))` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-09`** | Bitwise Arithmetic | `WHERE (flags & <INPUT>) > 0` | None | Bitwise operators (`&`, `\|`, `^`) | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-10`** | Hexadecimal Literal | `WHERE token = 0x<INPUT>` | None | Hex character continuation | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-11`** | Scientific Notation | `WHERE val = <INPUT>e0` | None | Exponent arithmetic | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-12`** | ORDER BY Expression | `ORDER BY (CASE WHEN (<INPUT>) THEN 1 ELSE 2 END)`| None | Boolean subquery expression | `ORDER_BOUNDARY`, `TIMING_BEHAVIOR` |
| **`CTX-13`** | ORDER BY Direction | `ORDER BY name <INPUT>` | None | Direction keyword (`ASC`, `DESC`, `, (SELECT ...)`) | `ORDER_BOUNDARY`, `TIMING_BEHAVIOR` |
| **`CTX-14`** | GROUP BY Expression | `GROUP BY <INPUT>` | None | Comma or projection expression | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |
| **`CTX-15`** | HAVING Aggregate Predicate | `HAVING COUNT(*) > <INPUT>` | None | Numeric comparison operator | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-16`** | LIMIT Row Count | `LIMIT <INPUT>` | None | Integer arithmetic (`10+0`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-17`** | OFFSET Row Skip | `OFFSET <INPUT>` | None | Integer arithmetic (`5+0`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-18`** | Window Partitioning | `OVER (PARTITION BY <INPUT>)` | None | Partition expression closure `)` | `ERROR_BEHAVIOR` |
| **`CTX-19`** | Window Ordering | `OVER (ORDER BY <INPUT>)` | None | Window sort expression | `ERROR_BEHAVIOR` |
| **`CTX-20`** | FETCH NEXT Clause | `FETCH NEXT <INPUT> ROWS ONLY` | None | Row count arithmetic | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-21`** | Dynamic Table Name | `SELECT * FROM <INPUT>` | `"`, `` ` ``, `[]` | Subquery alias `(SELECT 1) AS t` | `UNION_COMPATIBILITY`, `ERROR_BEHAVIOR` |
| **`CTX-22`** | Dynamic Column Projection | `SELECT <INPUT> FROM tbl` | None | Projection comma `, (SELECT ...)` | `DIRECT_IN_BAND_REFLECTION`, `ERROR_BEHAVIOR` |
| **`CTX-23`** | Dynamic Schema Qualifier | `SELECT * FROM <INPUT>.users` | None | Dot qualifier closure | `ERROR_BEHAVIOR` |
| **`CTX-24`** | Optimizer Index Hint | `FROM tbl USE INDEX (<INPUT>)` | None | Index closing `)` | `ERROR_BEHAVIOR` |
| **`CTX-25`** | INSERT VALUES Tuple | `VALUES ('a', '<INPUT>')` | `'` | `', (SELECT ...))` closing tuple | `ERROR_BEHAVIOR`, `STATE_TRANSITION` |
| **`CTX-26`** | INSERT INTO SELECT | `INSERT INTO tbl SELECT <INPUT> FROM s`| None | Column count projection alignment | `UNION_COMPATIBILITY` |
| **`CTX-27`** | UPDATE SET Assignment | `UPDATE tbl SET col = '<INPUT>'` | `'` | `', role='admin` field assignment | `STATE_TRANSITION`, `ERROR_BEHAVIOR` |
| **`CTX-28`** | DELETE WHERE Condition | `DELETE FROM tbl WHERE id = <INPUT>` | None | Boolean predicate alteration | `TRUE_FALSE_DIFFERENTIAL`, `TIMING_BEHAVIOR` |
| **`CTX-29`** | UPSERT ON CONFLICT SET | `ON CONFLICT (id) DO UPDATE SET c=<INPUT>`| None | Assignment expression | `ERROR_BEHAVIOR` |
| **`CTX-30`** | MERGE ON Join Condition | `MERGE INTO tgt ON (tgt.id = <INPUT>)` | None | Join predicate closure | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |
| **`CTX-31`** | Dynamic SQL EXECUTE String | `EXECUTE IMMEDIATE '<INPUT>'` | `'` | Statement batching quotes | `STACKED_BATCH_TEST`, `ERROR_BEHAVIOR` |
| **`CTX-32`** | Stored Proc Parameter | `EXEC sp_executesql N'<INPUT>'` | `'` | T-SQL batch quotes | `STACKED_BATCH_TEST`, `TIMING_BEHAVIOR` |
| **`CTX-33`** | CTE Recursive WITH Anchor | `WITH RECURSIVE cte AS (SELECT <INPUT>)`| None | Anchor projection alignment | `ERROR_BEHAVIOR`, `UNION_COMPATIBILITY` |
| **`CTX-34`** | JSONB Path Key Expression | `WHERE data->>'<INPUT>' = 'val'` | `'` | Arrow operator closure `'` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-35`** | Vector Distance Operator | `WHERE embedding <=> '<INPUT>'::vector` | `[` | Vector array closure `]` | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |
| **`CTX-36`** | Array Subscript Index | `WHERE tags[<INPUT>] = 'val'` | None | Integer index closing `]` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-37`** | Full-Text Search Predicate | `WHERE MATCH(body) AGAINST('<INPUT>')` | `'` | Full-text query closure | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-38`** | Regular Expression Pattern | `WHERE name ~ '<INPUT>'` | `'` | Regex string delimiter closure | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |

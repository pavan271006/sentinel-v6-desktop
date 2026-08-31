# Validated SQL AST Context Catalog V2 (30 Positions)

**Document Reference:** SENTINEL-V2-AST-11  
**Classification:** Syntactic AST Grammar Positions, Lexical Boundaries & Parsing Rules  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Abstract Syntax Tree Grammar Taxonomy

In V2, the 38 draft positions were audited. Redundant operator variations were consolidated into **30 Validated Syntactic Grammar Contexts**:

```
                              30 VALIDATED AST POSITIONS
                                          │
    ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼                  ▼
[Literal Expressions] [Clauses & Modifiers][Dynamic Identifiers][DML & Procedural][Modern Expressions]
• CTX-01: Single-Quote• CTX-10: ORDER Expr• CTX-17: Table Name • CTX-21: INSERT Val • CTX-28: JSONB Path Key
• CTX-02: Double-Quote• CTX-11: ORDER Dir • CTX-18: Column Name• CTX-22: INSERT Sel • CTX-29: Vector Dist <=>
• CTX-03: Dollar-Quote• CTX-12: GROUP BY  • CTX-19: Schema Name• CTX-23: UPDATE Set • CTX-30: Array Index
• CTX-04: Oracle Q-Quote• CTX-13: HAVING  • CTX-20: Index Hint • CTX-24: DELETE Where
• CTX-07: Numeric Direct• CTX-14: LIMIT                        • CTX-25: UPSERT Set
• CTX-08: Numeric Paren • CTX-15: OFFSET                       • CTX-27: Dynamic EXEC
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
| **`CTX-10`** | ORDER BY Expression | `ORDER BY (CASE WHEN (<INPUT>) THEN 1 ELSE 2 END)`| None | Boolean subquery expression | `ORDER_BOUNDARY`, `TIMING_BEHAVIOR` |
| **`CTX-11`** | ORDER BY Direction | `ORDER BY name <INPUT>` | None | Direction keyword (`ASC`, `DESC`, `, (SELECT ...)`) | `ORDER_BOUNDARY`, `TIMING_BEHAVIOR` |
| **`CTX-12`** | GROUP BY Expression | `GROUP BY <INPUT>` | None | Comma or projection expression | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |
| **`CTX-13`** | HAVING Aggregate Predicate | `HAVING COUNT(*) > <INPUT>` | None | Numeric comparison operator | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-14`** | LIMIT Row Count | `LIMIT <INPUT>` | None | Integer arithmetic (`10+0`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-15`** | OFFSET Row Skip | `OFFSET <INPUT>` | None | Integer arithmetic (`5+0`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-16`** | Window Partitioning | `OVER (PARTITION BY <INPUT>)` | None | Partition expression closure `)` | `ERROR_BEHAVIOR` |
| **`CTX-17`** | Dynamic Table Name | `SELECT * FROM <INPUT>` | `"`, `` ` ``, `[]` | Subquery alias `(SELECT 1) AS t` | `UNION_COMPATIBILITY`, `ERROR_BEHAVIOR` |
| **`CTX-18`** | Dynamic Column Projection | `SELECT <INPUT> FROM tbl` | None | Projection comma `, (SELECT ...)` | `DIRECT_IN_BAND_REFLECTION`, `ERROR_BEHAVIOR` |
| **`CTX-19`** | Dynamic Schema Qualifier | `SELECT * FROM <INPUT>.users` | None | Dot qualifier closure | `ERROR_BEHAVIOR` |
| **`CTX-20`** | Optimizer Index Hint | `FROM tbl USE INDEX (<INPUT>)` | None | Index closing `)` | `ERROR_BEHAVIOR` |
| **`CTX-21`** | INSERT VALUES Tuple | `VALUES ('a', '<INPUT>')` | `'` | `', (SELECT ...))` closing tuple | `ERROR_BEHAVIOR`, `STATE_TRANSITION` |
| **`CTX-22`** | INSERT INTO SELECT | `INSERT INTO tbl SELECT <INPUT> FROM s`| None | Column count projection alignment | `UNION_COMPATIBILITY` |
| **`CTX-23`** | UPDATE SET Assignment | `UPDATE tbl SET col = '<INPUT>'` | `'` | `', role='admin` field assignment | `STATE_TRANSITION`, `ERROR_BEHAVIOR` |
| **`CTX-24`** | DELETE WHERE Condition | `DELETE FROM tbl WHERE id = <INPUT>` | None | Boolean predicate alteration | `TRUE_FALSE_DIFFERENTIAL`, `TIMING_BEHAVIOR` |
| **`CTX-25`** | UPSERT ON CONFLICT SET | `ON CONFLICT (id) DO UPDATE SET c=<INPUT>`| None | Assignment expression | `ERROR_BEHAVIOR` |
| **`CTX-26`** | MERGE ON Join Condition | `MERGE INTO tgt ON (tgt.id = <INPUT>)` | None | Join predicate closure | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |
| **`CTX-27`** | Dynamic SQL EXECUTE String | `EXECUTE IMMEDIATE '<INPUT>'` | `'` | Statement batching quotes | `STACKED_BATCH_TEST`, `ERROR_BEHAVIOR` |
| **`CTX-28`** | JSONB Path Key Expression | `WHERE data->>'<INPUT>' = 'val'` | `'` | Arrow operator closure `'` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |
| **`CTX-29`** | Vector Distance Operator | `WHERE embedding <=> '<INPUT>'::vector` | `[` | Vector array closure `]` | `ERROR_BEHAVIOR`, `TIMING_BEHAVIOR` |
| **`CTX-30`** | Array Subscript Index | `WHERE tags[<INPUT>] = 'val'` | None | Integer index closing `]` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR` |

# Expanded SQL Grammar Context & Syntactic Matrix (32 AST Positions)

**Document Identifier:** SENTINEL-RES-CTX-EXP-03  
**Classification:** AST Grammars, Lexical Boundaries & Syntactic Engineering  

---

## 1. The 32 Syntactic AST Placement Positions

```
                                      SQL GRAMMAR AST POSITIONS
                                                  │
    ┌──────────────────────┬──────────────────────┼──────────────────────┬──────────────────────┐
    ▼                      ▼                      ▼                      ▼                      ▼
[Literal Expressions]  [Clause Constraints]   [Dynamic Identifiers]  [DML Statements]       [Modern Expressions]
- Single-Quote String  - ORDER BY Index       - Table Name           - INSERT VALUES        - JSONB Path Keys
- Dollar-Quote String  - ORDER BY Direction   - Column Name          - INSERT SELECT        - Vector Distance
- Direct Numeric       - GROUP BY / HAVING    - Schema Qualifier     - UPDATE SET           - Array Index Slices
- Hex / Scientific     - LIMIT / OFFSET       - Index Hint           - UPSERT ON CONFLICT   - Spatial Coordinates
- Oracle Q-Quote       - Window Partition     - Partition Key        - MERGE Statement      - CTE Recursive WITH
```

---

## 2. Complete Context Inventory & Injection Rules

| Context ID | Syntactic Node | Grammar Placement Example | Delimiter & Balancing Requirement | Compatible Testing Intent |
|:---|:---|:---|:---|:---|
| **`CTX-01`** | Single-Quote String | `WHERE name = '<INPUT>'` | Single quote `'` + comment (`--`, `/*`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST`, `UNION_COMPATIBILITY_TEST` |
| **`CTX-02`** | Double-Quote String / ID | `WHERE name = "<INPUT>"` | Double quote `"` + comment | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-03`** | PostgreSQL Dollar-Quote | `WHERE body = $$<INPUT>$$` | Matching tag `$$` or `$tag$` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-04`** | Oracle Q-Quote Literal | `WHERE note = Q'[<INPUT>]'` | Closing bracket/quote `]'` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-05`** | Unicode String Literal | `WHERE label = N'<INPUT>'` | Single quote `'` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-06`** | Direct Numeric Literal | `WHERE id = <INPUT>` | Zero delimiter; direct operators (`AND`, `OR`, `+`, `-`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST`, `UNION_COMPATIBILITY_TEST` |
| **`CTX-07`** | Parenthesized Numeric | `WHERE (id = (<INPUT>))` | Closing parentheses `))` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-08`** | Bitwise Arithmetic | `WHERE (flags & <INPUT>) > 0` | Arithmetic operator | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-09`** | Hexadecimal Literal | `WHERE token = 0x<INPUT>` | Hex digit boundary | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-10`** | Scientific Notation | `WHERE threshold = <INPUT>e0`| Exponent boundary | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-11`** | ORDER BY Column Index | `ORDER BY <INPUT> ASC` | Numeric literal (`1`, `2`) | `ORDER_BOUNDARY_TEST` (Out-of-range column check) |
| **`CTX-12`** | ORDER BY Direction / Expr | `ORDER BY name <INPUT>` | `(CASE WHEN (1=1) THEN ASC ELSE DESC END)` | `ORDER_BOUNDARY_TEST`, `TIMING_BEHAVIOR_TEST` |
| **`CTX-13`** | GROUP BY Expression | `GROUP BY <INPUT>` | Comma or subquery projection | `ERROR_BEHAVIOR_TEST`, `TIMING_BEHAVIOR_TEST` |
| **`CTX-14`** | HAVING Aggregate Filter | `HAVING COUNT(*) > <INPUT>` | Numeric predicate | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-15`** | LIMIT / Row Offset | `LIMIT 10 OFFSET <INPUT>` | Offset integer arithmetic (`5+0`) | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-16`** | Window Partitioning | `OVER (PARTITION BY <INPUT>)`| Partition expression | `ERROR_BEHAVIOR_TEST` |
| **`CTX-17`** | FETCH NEXT Clause | `FETCH NEXT <INPUT> ROWS ONLY`| Numeric row count | `TRUE_FALSE_DIFFERENTIAL` |
| **`CTX-18`** | Table Name Identifier | `SELECT * FROM <INPUT>` | Quotes (`"`, `` ` ``, `[]`) or subquery alias `(SELECT ...) AS t` | `UNION_COMPATIBILITY_TEST`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-19`** | Column Projection Name | `SELECT <INPUT> FROM tbl` | Comma or alias `col, (SELECT ...)` | `DIRECT_IN_BAND_REFLECTION`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-20`** | Schema Namespace | `SELECT * FROM <INPUT>.users` | Dot qualifier closure | `ERROR_BEHAVIOR_TEST` |
| **`CTX-21`** | Index Hint Identifier | `FROM tbl USE INDEX (<INPUT>)`| Index identifier closing `)` | `ERROR_BEHAVIOR_TEST` |
| **`CTX-22`** | INSERT VALUES Tuple | `VALUES ('a', '<INPUT>')` | Tuple comma and closing `)` | `ERROR_BEHAVIOR_TEST`, `STATE_TRANSITION_TEST` |
| **`CTX-23`** | INSERT INTO SELECT | `INSERT INTO t SELECT <INPUT>`| Projection column count alignment | `UNION_COMPATIBILITY_TEST` |
| **`CTX-24`** | UPDATE SET Assignment | `UPDATE tbl SET role = '<INPUT>'`| Closing quote `'` + comma `, pass='xyz'` | `STATE_TRANSITION_TEST`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-25`** | DELETE WHERE Condition | `DELETE FROM tbl WHERE id = <INPUT>`| Direct boolean expression | `TRUE_FALSE_DIFFERENTIAL`, `TIMING_BEHAVIOR_TEST` |
| **`CTX-26`** | UPSERT ON CONFLICT | `ON CONFLICT (id) DO UPDATE SET c=<INPUT>`| Assignment expression | `ERROR_BEHAVIOR_TEST` |
| **`CTX-27`** | MERGE ON Condition | `MERGE INTO tgt ON (tgt.id = <INPUT>)` | Join predicate closure | `ERROR_BEHAVIOR_TEST`, `TIMING_BEHAVIOR_TEST` |
| **`CTX-28`** | Dynamic SQL String | `EXECUTE IMMEDIATE '<INPUT>'` | String escape and statement batching | `STACKED_BATCH_TEST`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-29`** | Stored Proc Parameter | `EXEC sp_executesql N'<INPUT>'` | T-SQL batch quotes | `STACKED_BATCH_TEST`, `TIMING_BEHAVIOR_TEST` |
| **`CTX-30`** | CTE Recursive WITH | `WITH RECURSIVE cte AS (SELECT <INPUT>)`| Recursive anchor subquery | `ERROR_BEHAVIOR_TEST`, `UNION_COMPATIBILITY_TEST` |
| **`CTX-31`** | JSONB Path Key | `data->>'<INPUT>' = 'val'` | Arrow operator `'` | `TRUE_FALSE_DIFFERENTIAL`, `ERROR_BEHAVIOR_TEST` |
| **`CTX-32`** | Vector Distance Operator| `embedding <=> '<INPUT>'::vector` | Bracket vector literal `[0.1, 0.2]` | `ERROR_BEHAVIOR_TEST`, `TIMING_BEHAVIOR_TEST` |

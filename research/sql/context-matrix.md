# SQL Grammar Context Matrix & Syntactic Analysis

**Document Identifier:** SENTINEL-RES-CTX-03  
**Classification:** Syntactic AST & Context Engineering Knowledge Base  

---

## 1. Grammar Context Matrix Overview

A SQL query is an Abstract Syntax Tree (AST). Untrusted user input can be embedded into distinct syntactic nodes, each imposing unique boundary, grammar, and evaluation constraints.

```
                                  SQL QUERY AST
                                        │
    ┌──────────────────┬────────────────┼────────────────┬──────────────────┐
    ▼                  ▼                ▼                ▼                  ▼
[WHERE Predicate]  [ORDER BY Sort]  [INSERT/UPDATE]  [Identifier/Table] [JSON Operator]
- String Literal   - Column Index   - VALUES Tuple   - Unquoted ID      - JSONB Path
- Numeric Literal  - Direction ASC  - SET Assignment - Quoted ID        - Extraction ->>
```

---

## 2. In-Depth Context Profiles

### 2.1 `CTX-WHERE-STRING` (Single-Quoted String Literal)
- **Backend Query Structure**: `SELECT * FROM products WHERE category = '<INPUT>' AND active = 1;`
- **Syntactic Constraint**: Requires closing single quote (`'`), followed by logical operator (`AND`, `OR`), followed by comment or syntax balancing (`--`, `/*`, `'='`).
- **Detection Method**: Boolean differential (`' AND '1'='1` vs `' AND '1'='2`), or CAST error (`' AND 1=CAST(...)--`).
- **False-Positive Risks**: Reflected input containing `'` in search query headers without database execution.

### 2.2 `CTX-WHERE-NUMERIC` (Numeric Literal)
- **Backend Query Structure**: `SELECT * FROM users WHERE id = <INPUT>;`
- **Syntactic Constraint**: Zero quote characters needed. Direct injection of operators (`1 AND 1=1`, `1-0`, `1*1`).
- **Detection Method**: Arithmetic equivalence (`id=10-1` matches `id=9`), or Boolean differential (`1 AND 1=1` vs `1 AND 1=2`).
- **False-Positive Risks**: Input validation filters checking `isNaN(input)` and returning 400 Bad Request.

### 2.3 `CTX-ORDER-BY` (Sorting Clause)
- **Backend Query Structure**: `SELECT * FROM items ORDER BY <INPUT> ASC;`
- **Syntactic Constraint**: `UNION`, `AND`, `OR` keywords are illegal directly after `ORDER BY`. Quotes turn expressions into string constants rather than column identifiers.
- **Detection Method**:
  1. Position index injection (`ORDER BY 1` vs `ORDER BY 9999` causing out-of-range error).
  2. Conditional sorting: `ORDER BY (CASE WHEN (1=1) THEN 1 ELSE 2 END)`.
  3. Time delay: `ORDER BY (CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END)`.
- **False-Positive Risks**: Sorting by different fields naturally changing row orders without proving SQL injection.

### 2.4 `CTX-LIKE-PATTERN` (Wildcard String Match)
- **Backend Query Structure**: `SELECT * FROM catalog WHERE name LIKE '%<INPUT>%' AND visible = 1;`
- **Syntactic Constraint**: Requires closing the wildcard `%` and string delimiter `'` (`%' AND 1=1 AND '%'='`).
- **Detection Method**: Metamorphic wildcard injection (`%` matches all rows; `__` matches two characters).

### 2.5 `CTX-JSON-OPERATOR` (PostgreSQL / MySQL JSON Expressions)
- **Backend Query Structure**: `SELECT * FROM events WHERE payload->>'<INPUT>' = 'val';`
- **Syntactic Constraint**: Input is embedded inside a JSON path key or extraction arrow operator.
- **Detection Method**: Coercing JSON path syntax errors or injecting subquery extractions inside unquoted JSON key paths.

### 2.6 `CTX-INSERT-VALUES` (DML Insertion Tuple)
- **Backend Query Structure**: `INSERT INTO audit_log (user_id, action, timestamp) VALUES (1, '<INPUT>', NOW());`
- **Syntactic Constraint**: Prematurely closing the tuple requires balancing remaining column types:
  `test', (SELECT version()));--`
- **Detection Method**: Multi-row insertion (`test'), (2, (SELECT 'injected'), NOW());--`) or subquery evaluation.
- **False-Positive Risks**: Database rejecting transaction due to `NOT NULL` constraint violations on subsequent columns.

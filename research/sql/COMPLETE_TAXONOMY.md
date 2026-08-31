# Complete Multi-Dimensional SQL Security Taxonomy

**Document Identifier:** SENTINEL-RES-TAX-COMPLETE  
**Classification:** Complete Theoretical & Relational Taxonomy  
**Standard:** ISO/IEC/IEEE 29119, OWASP WSTG-INPV-05, CWE-89, CAPEC-66  

---

## 1. Taxonomy Structural Overview

```
                                  COMPLETE SQL SECURITY TAXONOMY
                                                │
    ┌──────────────┬──────────────┬─────────────┼─────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼             ▼             ▼              ▼              ▼
[Mechanisms]   [Contexts]     [DBMSs]       [Oracles]     [Transports]   [Lifecycles]   [Impacts]
 (16 Classes)   (36 AST Pos)   (20 Families) (26 Channels) (16 Surfaces)  (4 Lifecycles) (9 Classes)
```

---

## 2. Syntactic AST Grammar Contexts (36 Positions)

1. **`CTX-STR-SINGLE`**: Single-quoted string literal (`'...'`).
2. **`CTX-STR-DOUBLE`**: Double-quoted string or identifier (`"..."`).
3. **`CTX-STR-DOLLAR`**: PostgreSQL dollar-quoted string (`$$...$$` or `$tag$...$tag$`).
4. **`CTX-STR-ORACLE-Q`**: Oracle Q-quoted string literal (`Q'[...]'`).
5. **`CTX-STR-UNICODE-N`**: MSSQL Unicode string literal (`N'...'`).
6. **`CTX-STR-MYSQL-BACKTICK`**: MySQL / SQLite backtick identifier (``` `col` ```).
7. **`CTX-NUM-DIRECT`**: Direct integer or floating-point literal (`WHERE id = 123`).
8. **`CTX-NUM-PAREN`**: Parenthesized numeric expression (`WHERE (id = (123))`).
9. **`CTX-NUM-BITWISE`**: Bitwise operator position (`WHERE (flags & 4) > 0`).
10. **`CTX-NUM-HEX`**: Hexadecimal integer literal (`0x1a` or `x'1a'`).
11. **`CTX-NUM-SCIENTIFIC`**: Scientific notation numeric literal (`1e0`).
12. **`CTX-CLAUSE-ORDER-IDX`**: `ORDER BY` column index position (`ORDER BY 1`).
13. **`CTX-CLAUSE-ORDER-EXPR`**: `ORDER BY` conditional expression (`ORDER BY (CASE WHEN ...)`).
14. **`CTX-CLAUSE-ORDER-DIR`**: `ORDER BY` sorting direction (`ASC` / `DESC`).
15. **`CTX-CLAUSE-GROUP`**: `GROUP BY` column or expression position.
16. **`CTX-CLAUSE-HAVING`**: `HAVING` aggregate predicate filter (`HAVING COUNT(*) > N`).
17. **`CTX-CLAUSE-LIMIT`**: `LIMIT` / `TOP` row count expression.
18. **`CTX-CLAUSE-OFFSET`**: `OFFSET` row skipping integer expression.
19. **`CTX-CLAUSE-WINDOW`**: `OVER (PARTITION BY ... ORDER BY ...)` windowing clause.
20. **`CTX-CLAUSE-FETCH`**: `FETCH FIRST N ROWS ONLY` ANSI paging clause.
21. **`CTX-ID-TABLE`**: Dynamic table name identifier (`FROM <table>`).
22. **`CTX-ID-COLUMN`**: Dynamic column projection identifier (`SELECT <column> FROM ...`).
23. **`CTX-ID-SCHEMA`**: Dynamic schema / namespace identifier (`FROM <schema>.tbl`).
24. **`CTX-ID-INDEX-HINT`**: Optimizer index hint (`USE INDEX (<index>)`).
25. **`CTX-DML-INSERT-VAL`**: `INSERT INTO tbl VALUES ('a', <INPUT>)` tuple.
26. **`CTX-DML-INSERT-SELECT`**: `INSERT INTO tbl SELECT <INPUT> FROM src`.
27. **`CTX-DML-UPDATE-SET`**: `UPDATE tbl SET col = '<INPUT>'` assignment.
28. **`CTX-DML-DELETE-WHERE`**: `DELETE FROM tbl WHERE id = <INPUT>`.
29. **`CTX-DML-UPSERT-CONFLICT`**: `ON CONFLICT (id) DO UPDATE SET col = <INPUT>`.
30. **`CTX-DML-MERGE-ON`**: `MERGE INTO tgt ON (tgt.id = <INPUT>)`.
31. **`CTX-PROC-EXEC-DYNAMIC`**: `EXECUTE IMMEDIATE '<INPUT>'` dynamic SQL string.
32. **`CTX-PROC-SP-EXECUTESQL`**: `EXEC sp_executesql N'<INPUT>'` procedural call.
33. **`CTX-PROC-CTE-RECURSIVE`**: `WITH RECURSIVE cte AS (SELECT <INPUT>)`.
34. **`CTX-EXPR-JSON-PATH`**: PostgreSQL JSONB `data->>'<INPUT>'` or MySQL `JSON_EXTRACT()`.
35. **`CTX-EXPR-VECTOR-DIST`**: `pgvector` distance operators (`embedding <=> '<INPUT>'::vector`).
36. **`CTX-EXPR-ARRAY-SLICE`**: PostgreSQL array subscript (`tags[<INPUT>]`).

---

## 3. Observation & Oracle Channels (26 Channels)

1. **`ORC-CANARY-BODY`**: Aligned projection reflecting cryptographic nonce in HTTP response body.
2. **`ORC-CANARY-JSON`**: Injected canary reflected inside JSON object property value.
3. **`ORC-CANARY-XML`**: Injected canary reflected within XML CDATA or element node.
4. **`ORC-CAST-ERROR`**: Integer type conversion runtime error leaking string data.
5. **`ORC-SYNTAX-ERROR`**: Raw database engine SQL syntax parsing exception string.
6. **`ORC-XPATH-ERROR`**: XML / XPath function evaluation failure leaking data (`EXTRACTVALUE`).
7. **`ORC-DIV-ZERO-ERROR`**: Explicit arithmetic division-by-zero exception (`1/0`).
8. **`ORC-OVERFLOW-ERROR`**: Arithmetic or numeric type overflow exception (`99999999999999999999999`).
9. **`ORC-BOOLEAN-DIFF`**: Text token divergence between TRUE and FALSE relational states.
10. **`ORC-BOOLEAN-STATUS`**: HTTP status code transition (e.g. 200 OK vs 500 / 404).
11. **`ORC-DOM-STRUCT-DIFF`**: HTML DOM subtree tag count or element visibility divergence.
12. **`ORC-HEADER-DIFF`**: Response HTTP header mutation (`Set-Cookie`, `X-Total-Count`, `ETag`).
13. **`ORC-REDIRECT-DIFF`**: Location header redirect target URL mutation (`Location: /login?error=1`).
14. **`ORC-TIME-SPRT`**: Sequential Probability Ratio Test on latency shift ($p < 0.01$).
15. **`ORC-TIME-FIXED`**: Deterministic sleep threshold exceeding baseline $+ 3\sigma$.
16. **`ORC-TIME-COMPUTE`**: Computational CPU lock latency shift via `BENCHMARK()` or Cartesian joins.
17. **`ORC-OOB-DNS`**: Authoritative DNS resolution query recorded at external listener gateway.
18. **`ORC-OOB-HTTP`**: Outbound HTTP GET/POST callback recorded at external listener.
19. **`ORC-OOB-SMB`**: Outbound SMB NTLMSSP negotiation probe recorded on listener.
20. **`ORC-OOB-ICMP`**: Outbound ICMP ping interaction recorded on network gateway.
21. **`ORC-STATE-READ`**: Multi-request state modification observed on subsequent GET endpoint.
22. **`ORC-STATE-ROWCOUNT`**: Observable divergence in pagination metadata (`total_pages`, `total_records`).
23. **`ORC-METAMORPHIC-TLP`**: Partitioning count invariance $N(\phi) + N(\neg \phi) + N(\text{NULL}) = N(\text{All})$.
24. **`ORC-METAMORPHIC-NOREC`**: Optimized plan vs unoptimized reference query result equivalence.
25. **`ORC-AST-DIFF`**: Structural differential in rendered response markup without text delta.
26. **`ORC-MULTI-FUSED`**: Weighted Bayesian fusion of multiple correlated observation channels.

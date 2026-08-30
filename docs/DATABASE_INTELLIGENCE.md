# UCMA-X — Database Intelligence & Recursive Catalog Discovery

**Standard:** Authorized Database Schema Discovery & Metadata Intelligence  
**Engine Implementation:** `src/services/sqlScanner/MetadataExtractor.ts`  

---

## 1. Zero-Assumption Database Intelligence Principles

1. **No Hardcoded Table Names**: The scanner must NEVER assume table names (`users`, `admin`, `accounts`). Discovered objects are derived strictly from empirical database extraction queries.
2. **System vs. Application Separation**: Discovered tables are automatically classified into `application` (target business objects) vs `system` (`pg_catalog`, `sys`, `information_schema`, `all_tables`).
3. **Bounded Parallel Column Extraction**: Uses `ConcurrentExecutor.mapParallel` (10–50 workers) to enumerate column schemas across multiple discovered tables simultaneously.
4. **Automated Sensitive Field Redaction**: Credential and secret column values (`password`, `api_key`, `token`, `ssn`) are automatically marked sensitive and redacted from UI displays.

---

## 2. Recursive Discovery Hierarchy

```
                            RECURSIVE DATABASE EXPLORER
                                         │
    ┌────────────────────────────────────┼────────────────────────────────────┐
    ▼                                    ▼                                    ▼
[ Level 1: DBMS ]                [ Level 2: Schemas ]                 [ Level 3: Tables ]
Engine & Exact Version           Database & Namespace Names           App & System Tables
(PG 16.2 / MySQL 8.0.36)         (public / dbo / app_schema)          (products, orders, users)
    │                                    │                                    │
    └────────────────────────────────────┼────────────────────────────────────┘
                                         │
    ┌────────────────────────────────────┴────────────────────────────────────┐
    ▼                                                                         ▼
[ Level 4: Columns & Constraints ]                               [ Level 5: Authorized Sample Rows ]
Names, Types, Nullability, Primary Keys                          1–5 Sample Rows with Redacted Secrets
```

---

## 3. Extraction Path Strategy Selection

The database explorer dynamically selects the fastest extraction channel available on the target:

| Available Oracle Channel | Extraction Method | Request Complexity | Speed / Throughput |
|:---|:---|:---|:---|
| **In-Band UNION Available** | Aligned multi-column delimiter extraction (`~SNT_col1|type_SNT~`) | 1 request per table / batch | **Fastest (~100 cols/sec)** |
| **Error-Based CAST Available** | Single-entity offset leakage (`OFFSET N LIMIT 1`) | 1 request per table / column | **Fast (~10 cols/sec)** |
| **Boolean-Blind Only** | Adaptive binary search character recovery | $O(\log_2 |\Sigma|)$ requests per char | **Medium (~1 col/sec)** |

---

## 4. Discovered Catalog Data Model

```json
{
  "dbms": "PostgreSQL",
  "version": "PostgreSQL 16.2 on x86_64-pc-linux-gnu",
  "columnCount": 3,
  "renderColumn": 2,
  "injectableParamName": "category",
  "schemas": [
    {
      "name": "public",
      "classification": "application",
      "tables": [
        {
          "name": "users",
          "classification": "application",
          "columns": [
            { "name": "id", "dataType": "INTEGER", "isPrimaryKey": true },
            { "name": "username", "dataType": "VARCHAR(64)", "isSensitive": false },
            { "name": "password_hash", "dataType": "VARCHAR(128)", "isSensitive": true }
          ],
          "sampleRows": [
            { "id": "1", "username": "administrator", "password_hash": "[REDACTED]" }
          ]
        }
      ]
    }
  ]
}
```

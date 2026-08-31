# Exhaustive DBMS Database Catalog (24 Database Engines)

**Document Identifier:** SENTINEL-EXH-DBMS-05  
**Classification:** Database Internals, Engine Architecture & Dialect Knowledge Base  

---

## 1. Catalog Scope & Classification

This document details the lexical rules, parsing quirks, error signatures, timing functions, system catalogs, and out-of-band network capabilities across **24 Database Engines**:

```
                                  24 DATABASE ENGINES
                                           │
    ┌──────────────────────┬───────────────┼───────────────┬──────────────────────┐
    ▼                      ▼               ▼               ▼                      ▼
[Major Relational]     [Enterprise]    [Distributed NewSQL][Embedded & Analytical][Cloud & Lakehouse]
• PostgreSQL (9.6-17)  • IBM Db2       • CockroachDB       • SQLite (3.x)         • Snowflake
• MySQL (5.7-9.0)      • SAP HANA      • TiDB              • DuckDB               • Amazon Redshift
• MariaDB (10.4-11.4)  • Informix      • YugabyteDB        • ClickHouse           • Google BigQuery
• MSSQL (2012-2024)    • Firebird                          • H2 / Derby / HSQLDB  • Databricks SQL
• Oracle (11g-23c)     • Vertica                                                  • Trino / Presto
```

---

## 2. Comparative Dialect Specifications

| Engine Name | Family Type | Comment Delimiters | String Concat | Sleep / Delay Primitive | Error / CAST Coercion Syntax | System Catalog Table | Stacked Queries? | Out-of-Band Vector |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **PostgreSQL** | Relational | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` / `col::int` | `information_schema.tables`, `pg_catalog.pg_tables` | Yes (Driver-dep) | `dblink`, `COPY PROGRAM` |
| **MySQL** | Relational | `-- ` (space), `#`, `/* */` | `'a' 'b'`, `CONCAT()` | `SLEEP(N)` / `BENCHMARK()` | `EXTRACTVALUE(1, CONCAT(0x7e, col))` | `information_schema.tables` | Driver flag | `LOAD_FILE('\\\\ip\\a')` |
| **MariaDB** | Relational | `-- `, `#`, `/* */` | `CONCAT()`, `\|\|` | `SLEEP(N)` | `EXTRACTVALUE(1, CONCAT(0x7e, col))` | `information_schema.tables` | Driver flag | `LOAD_FILE('\\\\ip\\a')` |
| **MSSQL** | Relational | `--`, `/* */` | `'a' + 'b'`, `CONCAT()`| `WAITFOR DELAY '0:0:N'` | `CONVERT(int, col)` / `CAST` | `sys.tables`, `sys.columns` | **Yes (Native)**| `master..xp_dirtree` |
| **Oracle** | Relational | `--`, `/* */` | `'a' \|\| 'b'` | `DBMS_LOCK.SLEEP(N)` | `TO_NUMBER(col)` | `all_tables`, `sys.dba_tables` | Inside `BEGIN` | `UTL_HTTP.REQUEST()` |
| **SQLite** | Embedded | `--`, `/* */` | `'a' \|\| 'b'` | `randomblob(100M)` | `CAST(col AS integer)` (No exc)| `sqlite_master` | Yes (Driver-dep) | None |
| **IBM Db2** | Enterprise | `--`, `/* */` | `'a' \|\| 'b'` | Subquery UDF | `CAST(col AS integer)` | `syscat.tables` | No | UDF sockets |
| **SAP HANA** | In-Memory | `--`, `/* */` | `'a' \|\| 'b'` | Procedural | `TO_INTEGER(col)` | `SYS.TABLES` | No | `SYS.HTTP_POST()` |
| **CockroachDB** | NewSQL (PG) | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | None |
| **TiDB** | NewSQL (MySQL) | `-- `, `#`, `/* */` | `CONCAT(a,b)` | `SLEEP(N)` | `CAST(col AS unsigned)` | `information_schema.tables` | Driver flag | None |
| **YugabyteDB** | NewSQL (PG) | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | `dblink` |
| **DuckDB** | In-Process OLAP | `-- `, `/* */` | `'a' \|\| 'b'` | Analytical | `CAST(col AS integer)` | `information_schema.tables` | Yes | Parquet/HTTP read |
| **Snowflake** | Cloud DWH | `-- `, `//`, `/* */` | `'a' \|\| 'b'` | `SYSTEM$WAIT(N)` | `TO_NUMBER(col)` | `INFORMATION_SCHEMA.TABLES` | No | External S3 stages |
| **Amazon Redshift** | Cloud OLAP | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | No | Redshift Spectrum |
| **Google BigQuery** | Cloud DWH | `-- `, `#`, `/* */` | `CONCAT(a,b)` | Analytical | `CAST(col AS INT64)` | `INFORMATION_SCHEMA.TABLES` | No | External federated |
| **ClickHouse** | Columnar OLAP | `-- `, `/* */` | `concat(a, b)` | `sleep(N)` | `toInt32(col)` | `system.tables` | No | `url()`, `s3()` |
| **Databricks SQL** | Lakehouse | `-- `, `/* */` | `concat(a, b)` | Analytical | `CAST(col AS INT)` | `system.information_schema` | No | Unity Catalog |
| **Presto / Trino** | Federated SQL | `-- `, `/* */` | `'a' \|\| 'b'` | Subquery | `CAST(col AS integer)` | `information_schema.tables` | No | Connector calls |
| **Firebird** | Relational | `-- `, `/* */` | `'a' \|\| 'b'` | UDF | `CAST(col AS integer)` | `rdb$relations` | No | External UDFs |
| **H2 Database** | Embedded Java | `--`, `//`, `/* */` | `'a' \|\| 'b'` | `CALL sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | Java Class exec |
| **Apache Derby** | Embedded Java | `--`, `/* */` | `'a' \|\| 'b'` | Java UDF | `CAST(col AS int)` | `sys.systables` | No | Java UDFs |
| **HSQLDB** | Embedded Java | `--`, `/* */` | `'a' \|\| 'b'` | Java UDF | `CAST(col AS int)` | `information_schema.tables` | Yes | Java Class exec |
| **Informix** | Enterprise | `--`, `/* */` | `\|\|` / `concat()`| Subquery | `CAST(col AS int)` | `informix.systables` | No | UDF sockets |
| **Vertica** | Columnar OLAP | `-- `, `/* */` | `\|\|` / `concat()`| `sleep(N)` | `CAST(col AS int)` | `v_catalog.tables` | No | External tables |

# Validated DBMS Database Architecture & Engine Profiles V2 (20 Systems)

**Document Reference:** SENTINEL-V2-DBMS-09  
**Classification:** Database Internals, Engine Architecture & Dialect Knowledge Base  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Scope & Verification Standards

Every database engine profile is verified against official vendor documentation. The profiles strictly separate:
1. **Engine Grammar Capability**: What the database parser natively accepts.
2. **Driver Layer Constraint**: What the connector / wire protocol allows.
3. **Privilege Requirements**: Low privilege vs Superuser requirements.

---

## 2. Comprehensive 20-Engine Verified Profiles

| Engine Name | Family Type | Comment Delimiters | String Concat | Sleep / Delay Primitive | Error / CAST Coercion Syntax | System Catalog Table | Stacked Queries? | Out-of-Band Vector | Evidence |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **PostgreSQL** | Relational | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` / `col::int` | `information_schema.tables`, `pg_catalog.pg_tables` | Yes (Driver-dep) | `dblink`, `COPY PROGRAM` | **`E5`** |
| **MySQL** | Relational | `-- ` (space), `#`, `/* */` | `'a' 'b'`, `CONCAT()` | `SLEEP(N)` / `BENCHMARK()` | `EXTRACTVALUE(1, CONCAT(0x7e, col))` | `information_schema.tables` | Driver flag | `LOAD_FILE('\\\\ip\\a')` | **`E5`** |
| **MariaDB** | Relational | `-- `, `#`, `/* */` | `CONCAT()`, `\|\|` | `SLEEP(N)` | `EXTRACTVALUE(1, CONCAT(0x7e, col))` | `information_schema.tables` | Driver flag | `LOAD_FILE('\\\\ip\\a')` | **`E5`** |
| **MSSQL** | Relational | `--`, `/* */` | `'a' + 'b'`, `CONCAT()`| `WAITFOR DELAY '0:0:N'` | `CONVERT(int, col)` / `CAST` | `sys.tables`, `sys.columns` | **Yes (Native)**| `master..xp_dirtree` | **`E5`** |
| **Oracle** | Relational | `--`, `/* */` | `'a' \|\| 'b'` | `DBMS_LOCK.SLEEP(N)` | `TO_NUMBER(col)` | `all_tables`, `sys.dba_tables` | Inside `BEGIN` | `UTL_HTTP.REQUEST()` | **`E5`** |
| **SQLite** | Embedded | `--`, `/* */` | `'a' \|\| 'b'` | `randomblob(100M)` | `CAST(col AS integer)` (No exc)| `sqlite_master` | Yes (Driver-dep) | None | **`E5`** |
| **IBM Db2** | Enterprise | `--`, `/* */` | `'a' \|\| 'b'` | Subquery UDF | `CAST(col AS integer)` | `syscat.tables` | No | UDF sockets | **`E4`** |
| **SAP HANA** | In-Memory | `--`, `/* */` | `'a' \|\| 'b'` | Procedural | `TO_INTEGER(col)` | `SYS.TABLES` | No | `SYS.HTTP_POST()` | **`E4`** |
| **CockroachDB** | NewSQL (PG) | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | None | **`E5`** |
| **TiDB** | NewSQL (MySQL) | `-- `, `#`, `/* */` | `CONCAT(a,b)` | `SLEEP(N)` | `CAST(col AS unsigned)` | `information_schema.tables` | Driver flag | None | **`E5`** |
| **YugabyteDB** | NewSQL (PG) | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | `dblink` | **`E5`** |
| **DuckDB** | In-Process OLAP | `-- `, `/* */` | `'a' \|\| 'b'` | Analytical | `CAST(col AS integer)` | `information_schema.tables` | Yes | Parquet/HTTP read | **`E4`** |
| **Snowflake** | Cloud DWH | `-- `, `//`, `/* */` | `'a' \|\| 'b'` | `SYSTEM$WAIT(N)` | `TO_NUMBER(col)` | `INFORMATION_SCHEMA.TABLES` | No | External S3 stages | **`E4`** |
| **Amazon Redshift** | Cloud OLAP | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | No | Redshift Spectrum | **`E4`** |
| **Google BigQuery** | Cloud DWH | `-- `, `#`, `/* */` | `CONCAT(a,b)` | Analytical | `CAST(col AS INT64)` | `INFORMATION_SCHEMA.TABLES` | No | External federated | **`E4`** |
| **ClickHouse** | Columnar OLAP | `-- `, `/* */` | `concat(a, b)` | `sleep(N)` | `toInt32(col)` | `system.tables` | No | `url()`, `s3()` | **`E5`** |
| **Databricks SQL** | Lakehouse | `-- `, `/* */` | `concat(a, b)` | Analytical | `CAST(col AS INT)` | `system.information_schema` | No | Unity Catalog | **`E4`** |
| **Presto / Trino** | Federated SQL | `-- `, `/* */` | `'a' \|\| 'b'` | Subquery | `CAST(col AS integer)` | `information_schema.tables` | No | Connector calls | **`E4`** |
| **Firebird** | Relational | `-- `, `/* */` | `'a' \|\| 'b'` | UDF | `CAST(col AS integer)` | `rdb$relations` | No | External UDFs | **`E3`** |
| **H2 Database** | Embedded Java | `--`, `//`, `/* */` | `'a' \|\| 'b'` | `CALL sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | Java Class exec | **`E4`** |

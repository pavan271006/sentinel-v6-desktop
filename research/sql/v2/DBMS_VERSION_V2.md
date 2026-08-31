# Validated DBMS Version Matrix V2 (76 Version Profiles)

**Document Reference:** SENTINEL-V2-VER-10  
**Classification:** Version-Specific Feature Evolution, Deprecation & Runtime Invariants  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Active vs Extended LTS Engine Lifecycles

```
[ Active Supported Versions ] ──► [ Extended LTS Versions ] ──► [ Deprecated / End-of-Life ]
• PostgreSQL 13..17               • PostgreSQL 12                • PostgreSQL 9.6, 10, 11
• MySQL 8.0, 8.4 LTS, 9.0        • MySQL 5.7                    • MySQL 5.5, 5.6
• MSSQL 2017..2024                • MSSQL 2014, 2016             • MSSQL 2008, 2012
• Oracle 19c, 21c, 23c            • Oracle 12c, 18c              • Oracle 10g, 11g
```

---

## 2. Comprehensive Version Behavioral Index

### 2.1 PostgreSQL Version Matrix (v12 to v17)
* **PostgreSQL 12 (EOL - Nov 2024)**: SQL/JSON path expressions (`jsonpath`); `oid` system column removed. Injection inside JSON path queries (`jsonb_path_query`). Evidence: `E5`.
* **PostgreSQL 13 (Active - Support to Nov 2025)**: B-tree index deduplication; trusted extension execution. Timing variance changes during index-assisted queries. Evidence: `E5`.
* **PostgreSQL 14 (Active - Support to Nov 2026)**: Subscripting for any data type (`data['key']`). Direct injection in JSON key subscripting syntax. Evidence: `E5`.
* **PostgreSQL 15 (Active - Support to Nov 2027)**: Standard `MERGE` SQL command; `public` schema CREATE privilege revoked by default. Injection inside `MERGE INTO ... ON (...)`. Evidence: `E5`.
* **PostgreSQL 16 (Active - Support to Nov 2028)**: Bidirectional logical replication; `pg_stat_io` monitoring. Enhanced system views for database activity fingerprinting. Evidence: `E5`.
* **PostgreSQL 17 (Active - Current)**: Improved memory management in query optimization; JSON_TABLE support. Standard `JSON_TABLE()` injection expanding table projection vectors. Evidence: `E5`.

### 2.2 MySQL & MariaDB Version Matrix
* **MySQL 5.7 (EOL - Oct 2023)**: Native JSON data type (`->` and `->>` operators); `sys` schema added. JSON extraction arrows vulnerable to unquoted key injections. Evidence: `E5`.
* **MySQL 8.0 (Active - Support to Apr 2026)**: Window functions (`OVER()`); CTEs (`WITH`); `information_schema` reimplemented as InnoDB tables. XPath error strings capped/truncated. Evidence: `E5`.
* **MySQL 8.4 LTS (Active - Support to Apr 2032)**: Native password authentication plugin deprecated; performance schema enhancements. Authentication bypass verification requires caching_sha2_password awareness. Evidence: `E5`.
* **MySQL 9.0 (Active - Current Innovation)**: Vector data type support (`VECTOR`); JavaScript stored procedures. Vector metric injection and JavaScript UDF execution vectors. Evidence: `E5`.
* **MariaDB 10.11 LTS (Active - Support to Feb 2028)**: Modern query optimizer cost model; enhanced temporal table versioning. Evidence: `E5`.
* **MariaDB 11.4 LTS (Active - Support to May 2029)**: Modern server performance and optimizer improvements. Evidence: `E5`.

### 2.3 Microsoft SQL Server Version Matrix
* **MSSQL 2014 (EOL Extended - Jul 2024)**: In-Memory OLTP (Hekaton) compiler engine. Memory table query injection. Evidence: `E5`.
* **MSSQL 2016 (LTS - Support to Jul 2026)**: Native JSON functions (`JSON_VALUE()`, `JSON_QUERY()`); Temporal tables. JSON query injection; historical data extraction via temporal tables. Evidence: `E5`.
* **MSSQL 2017 (Active - Support to Oct 2027)**: Linux OS support; Graph database queries (`MATCH()`). MSSQL injection against Linux targets; file paths use Linux `/` instead of `\\`. Evidence: `E5`.
* **MSSQL 2019 (Active - Support to Jan 2030)**: UTF-8 support for char/varchar; PolyBase data virtualization. Charset mismatch differential injection with UTF-8 collations. Evidence: `E5`.
* **MSSQL 2022 (Active - Support to Jan 2033)**: Contained Availability Groups; Ledger database verification. Tamper-evident ledger tables require read-only non-destructive probing. Evidence: `E5`.

### 2.4 Oracle Database Version Matrix
* **Oracle 19c LTS (Active - Support to Apr 2027)**: JSON enhancements; Autonomous Database cloud optimizations. Automated query tuning alters blind timing stability. Evidence: `E5`.
* **Oracle 21c (Innovation - EOL Apr 2024)**: Blockchain tables; JSON data type. Evidence: `E5`.
* **Oracle 23c / 23ai (Active - Long-Term Release)**: JSON relational duality views; Vector search (`VECTOR` type); Direct Boolean data type. ANSI boolean expressions (`1=1`) supported directly without `CASE WHEN`. Evidence: `E5`.

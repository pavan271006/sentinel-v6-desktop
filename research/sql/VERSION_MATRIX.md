# Database Version History & Behavioral Transition Matrix

**Document Identifier:** SENTINEL-RES-VER-MATRIX  
**Classification:** Version-Specific Feature Evolution & Deprecation Analysis  

---

## 1. PostgreSQL Version Evolution (v9.6 to v17.x)

| PostgreSQL Version | Release Year | Key Feature / Syntactic Change | Security & Detection Implication |
|:---|:---|:---|:---|
| **v9.6** | 2016 | Parallel query execution; `pg_stat_activity` redesign. | Stacked query execution tracks parallel workers. |
| **v10** | 2017 | Declarative table partitioning; identity columns (`GENERATED ALWAYS AS IDENTITY`). | Partitioned table enumeration via `pg_partitioned_table`. |
| **v11** | 2018 | Stored procedures with transaction support (`CALL proc()`). | Procedural SQL injection enabling inline transaction control. |
| **v12** | 2019 | Standard SQL/JSON path expressions (`jsonpath`); `oid` system column removed. | Injection inside JSON path queries (`jsonb_path_query`). |
| **v13** | 2020 | B-tree deduplication; trusted extensions support. | Query performance differentials during heavy index scans. |
| **v14** | 2021 | Subscripting for any data type (JSONB subscripts `data['key']`). | Direct injection in JSON key subscripting syntax. |
| **v15** | 2022 | Standard `MERGE` SQL command introduced; `public` schema CREATE privilege revoked by default. | Injection inside `MERGE INTO ... ON (...)` expressions. |
| **v16** | 2023 | Bidirectional logical replication; `pg_stat_io` monitoring. | Enhanced system views for database activity fingerprinting. |
| **v17** | 2024 | Improved memory management in query optimization; JSON_TABLE support. | Standard `JSON_TABLE()` injection expanding table projection vectors. |

---

## 2. MySQL Version Evolution (v5.5 to v9.0)

| MySQL Version | Release Year | Key Feature / Syntactic Change | Security & Detection Implication |
|:---|:---|:---|:---|
| **v5.5** | 2010 | InnoDB default engine; `EXTRACTVALUE()` XPath error support. | XPath error-based injection leaks data up to 32 bytes. |
| **v5.7** | 2015 | Native JSON data type (`->` and `->>` operators); `sys` schema added. | JSON extraction arrows vulnerable to unquoted key injections. |
| **v8.0** | 2018 | Window functions (`OVER()`); CTEs (`WITH`); `information_schema` reimplemented as InnoDB tables. | Recursive CTE injection; XPath error strings truncated/capped. |
| **v8.4 LTS** | 2024 | Native password authentication plugin deprecated; performance schema enhancements. | Authentication bypass verification requires caching_sha2_password awareness. |
| **v9.0** | 2024 | Vector data type support (`VECTOR`); JavaScript stored procedures. | Vector metric injection and JavaScript UDF execution vectors. |

---

## 3. Microsoft SQL Server Version Evolution (2008 to 2024)

| MSSQL Version | Key Feature / Syntactic Change | Security & Detection Implication |
|:---|:---|:---|
| **2008 / R2** | Transparent Data Encryption (TDE); Change Data Capture. | `xp_cmdshell` disabled by default, but re-enablable via `sp_configure`. |
| **2012** | `CONCAT()` function added; `OFFSET ... FETCH` paging syntax introduced. | Simpler string concatenation; injection inside ANSI pagination. |
| **2016** | Native JSON functions (`JSON_VALUE()`, `JSON_QUERY()`); Temporal tables. | JSON query injection; historical data extraction via temporal tables. |
| **2017** | Linux OS support; Graph database queries (`MATCH()`). | MSSQL injection against Linux targets; file paths use Linux `/` instead of `\\`. |
| **2019** | UTF-8 support for char/varchar; PolyBase data virtualization. | Charset mismatch differential injection with UTF-8 collations. |
| **2022** | Contained Availability Groups; Ledger database verification. | Tamper-evident ledger tables require read-only non-destructive probing. |

---

## 4. Oracle Database Version Evolution (11g to 23c)

| Oracle Version | Key Feature / Syntactic Change | Security & Detection Implication |
|:---|:---|:---|
| **11g** | Fine-grained Access Control (FGAC); Native XML DB. | `UTL_HTTP` network calls restricted by default Access Control Lists (ACLs). |
| **12c** | Multi-tenant architecture (CDB / PDB); `FETCH FIRST N ROWS ONLY`. | Injections across pluggable database containers (`V$PDBS`). |
| **18c / 19c** | JSON enhancements; Autonomous Database cloud optimizations. | Automated query tuning alters blind timing stability. |
| **21c / 23c** | JSON relational duality views; Vector search (`VECTOR` type); Direct Boolean data type. | ANSI boolean expressions (`1=1`) supported directly without `CASE WHEN`. |

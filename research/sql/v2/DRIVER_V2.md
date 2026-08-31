# Validated Driver, Connector & Protocol Catalog V2 (16 Patterns)

**Document Reference:** SENTINEL-V2-DRV-13  
**Classification:** Database Drivers, Protocol Invariants & Multi-Statement Configuration  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Connector Layer Invariant

Vulnerability execution is governed by the **Driver Implementation** and **Connection Settings**, which can restrict or permit behaviors regardless of the underlying database engine capabilities.

---

## 2. Comprehensive 16-Driver Architectural Matrix

| Ecosystem / Driver | Protocol Architecture | Prepared Statement Mode | Multi-Statement Default Setting | Security & Injection Invariants | Evidence |
|:---|:---|:---|:---|:---|:---|
| **Node.js `pg`** | PostgreSQL Wire v3.0 | Server-side prepared (`$1, $2`) | Disallowed in prepared; allowed in raw `query()`. | Raw `query()` string permits stacked semicolon execution. | **`E5`** |
| **Node.js `mysql2`** | MySQL Binary / Text | Server-side binary or client emulation | **`multipleStatements: false` (Default)** | Stacked query execution via `;` rejected unless explicitly configured. | **`E5`** |
| **Node.js `tedious`** | TDS Protocol | Server-side `sp_executesql` RPC | Enabled by default | Stacked queries via `;` execute natively across TDS stream packets. | **`E5`** |
| **Node.js `better-sqlite3`** | C API Bindings | Client-side SQLite bytecode | `db.exec()` multi-query; `db.prepare()` single | Injection inside `db.prepare()` rejects `;` statement batching. | **`E5`** |
| **Python `psycopg2`** | libpq C Wrapper | Client-side string escaping | Permitted in unparameterized `execute()`. | Driver performs client-side parameter escaping. | **`E5`** |
| **Python `psycopg3`** | PostgreSQL Wire | Server-side prepared statements (`$1`) | Disabled in prepared mode. | High security in prepared mode; raw dynamic strings permit batching. | **`E5`** |
| **Python `PyMySQL`** | Pure Python Wire | Client-side string escaping | `cursor.execute()` single-statement. | Requires `client_flag=CLIENT.MULTI_STATEMENTS` to enable stacked queries. | **`E5`** |
| **Python `asyncpg`** | Binary Protocol | Strictly server-side prepared | Disabled in prepared execution. | Does not support multi-statement parameterization. | **`E5`** |
| **Java `PostgreSQL JDBC`** | PostgreSQL Wire v3.0 | Server-side prepared statement caching | Allowed in `Statement`; rejected in `PreparedStatement`. | Raw `Statement.executeQuery()` allows multi-query batching. | **`E5`** |
| **Java `MySQL Connector/J`** | MySQL Protocol | Client emulation default (`useServerPrepStmts=false`) | **`allowMultiQueries=false` (Default)** | Stacked queries blocked unless `allowMultiQueries=true` in JDBC URL. | **`E5`** |
| **Java `Microsoft JDBC`** | TDS Protocol | `sp_prepexec` server RPC | Enabled natively | Universal support for stacked queries and T-SQL procedures. | **`E5`** |
| **Java `Oracle JDBC Thin`** | TNS Protocol | Server-side SQL parsing | Multi-query supported inside `BEGIN ... END;` | Semicolons outside PL/SQL blocks trigger `ORA-00911`. | **`E5`** |
| **Go `database/sql` + `lib/pq`** | libpq Wire | Server-side prepared statements | Allowed in `db.Exec()`; rejected in `db.Query()`. | Stacked queries allowed in unparameterized `db.Exec()`. | **`E5`** |
| **Go `go-sql-driver/mysql`** | Pure Go Wire | Client-side parameter interpolation | **`multiStatements=false` (Default)** | Must append `?multiStatements=true` to DSN to enable multi-statements. | **`E5`** |
| **PHP `PDO_MYSQL`** | MySQL Native Driver | **`PDO::ATTR_EMULATE_PREPARES = true`** | Permitted in emulated mode. | Emulated prepared statements vulnerable to charset mismatches (GBK). | **`E5`** |
| **C# `Microsoft.Data.SqlClient`** | TDS Protocol | `sp_executesql` RPC | Enabled natively | Universal support for stacked queries and T-SQL procedures. | **`E5`** |

# Driver, Connector & Protocol Catalog (22 Architecture Patterns)

**Document Identifier:** SENTINEL-EXH-DRV-09  
**Classification:** Database Drivers, Wire Protocols, Connection Pools & Connector Invariants  

---

## 1. Application-to-Database Architectural Stack

```
[ Application Code ] ──► [ ORM / Query Builder ] ──► [ Database Driver ] ──► [ Connection Pool ] ──► [ Wire Protocol ] ──► [ Database Parser ]
```

Vulnerability behavior frequently depends not on the raw database engine, but on the **Driver Configuration**, **Prepared Statement Emulation Mode**, or **Connection Pool Settings**.

---

## 2. Comprehensive Driver Protocol Specifications

| Ecosystem / Driver | Protocol Architecture | Prepared Statement Mode | Multi-Statement Setting | Security & Injection Behavioral Invariants |
|:---|:---|:---|:---|:---|
| **Node.js `pg` (node-postgres)** | PostgreSQL Wire v3.0 | Server-side prepared (`$1, $2`) | Disallowed in parameterized mode; allowed in direct `query()` string. | Direct multi-statement execution via `;` permitted when executing raw unparameterized SQL strings. |
| **Node.js `mysql2`** | MySQL Binary / Text | Server-side binary protocol or client-side emulation. | **`multipleStatements: false` (Default)** | Stacked injection with `;` fails with syntax error unless `multipleStatements: true` is explicitly enabled. |
| **Node.js `tedious`** | TDS (Tabular Data Stream) | Server-side `sp_executesql` RPC | Enabled by default | Stacked queries via `;` execute natively across TDS stream packets. |
| **Node.js `better-sqlite3`** | C API Direct Bindings | Client-side SQLite bytecode compilation. | `db.exec()` allows multi-statement; `db.prepare()` strictly single-statement. | Injection inside `db.prepare()` rejects `;` statement batching at the SQLite API level. |
| **Python `psycopg2`** | libpq C Wrapper | Client-side string interpolation before dispatch. | Permitted in unparameterized `cursor.execute()`. | Driver performs client-side parameter escaping; encoding mismatches can bypass escaping. |
| **Python `psycopg3`** | Modern PostgreSQL Wire | Native server-side prepared statements (`$1`). | Strictly single-statement in prepared mode. | High security in prepared mode; raw dynamic strings still permit stacked execution. |
| **Python `PyMySQL`** | Pure Python MySQL Wire | Client-side string escaping | `cursor.execute()` rejects multiple statements by default. | Must configure `client_flag=CLIENT.MULTI_STATEMENTS` to enable stacked query execution. |
| **Python `asyncpg`** | Binary Protocol Engine | Strictly server-side prepared statements | Disabled in prepared execution. | Does not support multi-statement parameterization; requires raw script execution. |
| **Java `PostgreSQL JDBC`** | PostgreSQL Wire v3.0 | Server-side prepared statement caching (`PreparedStatement`). | Allowed in `Statement.execute()`; rejected in `PreparedStatement`. | Raw `Statement.executeQuery()` allows multi-query batching and comment truncation. |
| **Java `MySQL Connector/J`** | MySQL Protocol | Client-side emulation by default (`useServerPrepStmts=false`). | **`allowMultiQueries=false` (Default)** | Stacked queries via `;` blocked by default unless `allowMultiQueries=true` is appended to JDBC URL. |
| **Java `Microsoft JDBC`** | TDS Protocol | `sp_prepexec` server-side RPC | Enabled | Universal support for stacked queries and procedural batch execution. |
| **Java `Oracle JDBC Thin`** | TNS Protocol | Server-side SQL parsing | Multi-query supported inside `BEGIN ... END;` blocks. | Semicolons outside PL/SQL blocks trigger `ORA-00911: invalid character`. |
| **Go `database/sql` + `lib/pq`** | libpq / Wire | Server-side prepared statements | Allowed in `db.Exec()`; rejected in `db.Query()` with parameters. | Stacked queries allowed in unparameterized `db.Exec()`. |
| **Go `pgx` (jackc/pgx)** | High-perf PG Wire | Automatic statement preparation and caching. | Extended protocol prohibits multiple statements in single message. | Eliminates stacked injection in parameterized paths; unparameterized `Exec()` vulnerable. |
| **Go `go-sql-driver/mysql`** | Pure Go MySQL Wire | Client-side parameter interpolation by default. | **`multiStatements=false` (Default)** | Must append `?multiStatements=true` to DSN to enable multi-statement execution. |
| **PHP `PDO_PGSQL`** | libpq Wrapper | Server-side prepared statements | Supported in `PDO::query()` and `PDO::exec()`. | Full stacked query and PL/pgSQL procedural block execution. |
| **PHP `PDO_MYSQL`** | MySQL Native Driver | **`PDO::ATTR_EMULATE_PREPARES = true` (Default)** | Permitted in emulated mode. | Emulated prepared statements perform client-side string escaping, vulnerable to charset mismatches (GBK). |
| **PHP `mysqli`** | MySQL Driver | Native binary protocol (`mysqli_stmt`) | `mysqli_query()` single-statement; `mysqli_multi_query()` multi-statement. | Stacked queries fail on standard `mysqli_query()` calls. |
| **C# `Microsoft.Data.SqlClient`** | TDS Protocol | `sp_executesql` RPC | Enabled natively | Universal support for stacked queries and T-SQL procedures. |
| **C# `Npgsql`** | PostgreSQL Wire v3.0 | Binary parameters with type mapping | Supported in raw SQL commands. | Raw string interpolation allows full PostgreSQL stacked execution. |
| **Rust `sqlx`** | Async Compile-Time Wire | Strictly server-side prepared statements | Multi-statement execution rejected by query compiler. | Compile-time SQL verification prevents accidental string interpolation. |
| **Rust `tokio-postgres`** | Low-Level PG Wire | Direct wire protocol message dispatch | Multiple statements allowed in `batch_execute()`. | `batch_execute()` allows full stacked execution; `query()` rejects multi-statement. |

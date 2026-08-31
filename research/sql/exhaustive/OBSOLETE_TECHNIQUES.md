# Obsolete & Historical SQL Injection Techniques (18 Catalogued Patterns)

**Document Identifier:** SENTINEL-EXH-OBS-21  
**Classification:** Historical Vulnerability Research, Deprecated Behaviors & EOL Security Controls  

---

## 1. Purpose of Historical Segregation

To maintain strict scientific integrity, historical techniques that no longer function on modern database versions are **segregated from active production testing**. They are documented here to prevent confusion and explain why legacy payloads fail on modern targets.

---

## 2. Comprehensive 18-Obsolete Technique Inventory

| Historical ID | Technique Name | Historical Target Versions | Vulnerability Mechanism | Why Obsolete / Removed | Modern Replacement / Defense |
|:---|:---|:---|:---|:---|:---|
| **`OBS-01`** | **Null-Byte String Truncation (`%00`)** | PHP $\le 5.3.4$, MySQL $\le 5.1$ | C-string null byte (`0x00`) terminating string buffers. | Fixed in PHP 5.3.4+ by tracking explicit string lengths in zval structures. | Native zval string length validation; parameter binding. |
| **`OBS-02`** | **PHP `magic_quotes_gpc` GBK Multi-Byte Bypass** | PHP $\le 5.3$, MySQL with GBK charset | `0xbf5c` consuming backslash escape character. | `magic_quotes_gpc` deprecated in PHP 5.3 and completely removed in PHP 5.4. | Real prepared statements (`PDO::prepare()`) with UTF-8 character sets. |
| **`OBS-03`** | **MSSQL 2000 Default `xp_cmdshell` Execution** | Microsoft SQL Server 2000 | `xp_cmdshell` executable by public low-privilege roles. | Disabled by default in SQL Server 2005+; requires sysadmin `sp_configure`. | Surface area reduction; contained databases. |
| **`OBS-04`** | **MySQL Pre-5.0 `BENCHMARK()` Integer Crash** | MySQL 4.x / early 5.0 | Integer overflow in `BENCHMARK()` causing daemon segfault. | Fixed in MySQL 5.0.3+ with strict integer bounds checking. | Robust memory isolation in storage engines. |
| **`OBS-05`** | **Oracle 8i/9i `SYS.DBMS_EXPORT_EXTENSION` Escalation**| Oracle 8i / 9i / 10g R1 | Definer-rights PL/SQL procedure executing dynamic SQL as SYS. | Patched in CPU Jan 2006 with invoker rights and input sanitization. | Oracle Fine-Grained Access Control (FGAC) and PL/SQL code analysis. |
| **`OBS-06`** | **MySQL `LOAD DATA LOCAL INFILE` Client File Read**| MySQL 5.x / MariaDB | Server requesting arbitrary files from connecting client. | Disabled by default in MySQL 8.0+ (`local_infile=OFF`). | Enforced client-side `OPT_LOCAL_INFILE` disablement. |
| **`OBS-07`** | **PostgreSQL Pre-8.2 Backslash Quote Evasion** | PostgreSQL $\le 8.1$ | Single backslash `\` escaping single quote when `standard_conforming_strings=off`. | `standard_conforming_strings=on` by default in PostgreSQL 9.1+. | ANSI SQL compliant single quote escaping (`''`). |
| **`OBS-08`** | **MSSQL 2000 `xp_regread` Registry Extraction**| Microsoft SQL Server 2000 | Low-privilege registry key extraction leaking OS secrets. | Restricted to sysadmin role in SQL Server 2005+. | Windows DPAPI and registry access control lists. |
| **`OBS-09`** | **MySQL `INTO OUTFILE` Web Root Shell Drop**| MySQL 5.x on Shared Hosting | Writing PHP webshells to world-writable `/var/www/html`. | Restricted by `secure_file_priv` setting enabled by default in MySQL 5.7+. | Sandboxed filesystem directories (`secure_file_priv="/var/lib/mysql-files"`). |
| **`OBS-10`** | **Oracle 10g `DBMS_REPCAT.VALIDATE` SQLi** | Oracle 10g Release 1 | Dynamic SQL injection inside replication validation routine. | Patched in Oracle Critical Patch Updates. | Parameterized internal package execution. |
| **`OBS-11`** | **MySQL 4.1 Short Password Hash Collision** | MySQL 4.0 / 4.1 | 16-byte DES password hash susceptible to fast collision. | Replaced by SHA-1 (`*HASH`) in 5.x, then `caching_sha2_password` in 8.0+. | SHA-256 with cryptographically random salts. |
| **`OBS-12`** | **ASP Classic Dynamic SQL Interpolation** | Microsoft IIS 5 / 6 with VBScript | `conn.Execute("SELECT * FROM tbl WHERE id=" & id)`. | ASP Classic legacy runtime superseded by ASP.NET / .NET Core. | Parameterized ADO.NET and Entity Framework Core. |
| **`OBS-13`** | **ColdFusion `#` Dynamic SQL Injection** | ColdFusion 6 / 7 / 8 | `<cfquery>SELECT * FROM tbl WHERE id=#url.id#</cfquery>`. | Replaced by mandatory `<cfqueryparam>` tag usage. | Automated parameter binding in CFML engines. |
| **`OBS-14`** | **SQLite 2.x Dynamic Table Metadata Poisoning** | SQLite 2.8.x | Modifying internal schema definitions directly in SQLite 2 file format. | SQLite 3 architecture introduced bytecode virtual machine and schema locks. | SQLite 3 read-only schema locks and strict virtual database engine. |
| **`OBS-15`** | **InterBase 6.0 External UDF DLL Injection** | Borland InterBase 6.0 | `DECLARE EXTERNAL FUNCTION` loading arbitrary DLL from filesystem. | Modern Firebird / InterBase enforces strict `UdfAccess = None` configuration. | Restricted external module directories. |
| **`OBS-16`** | **Sybase SQL Anywhere 10 `sa_lock` Bypass** | Sybase SQL Anywhere 10 | Procedure injection altering connection transaction locks. | Patched in modern SAP SQL Anywhere maintenance releases. | Role-based system procedure execution. |
| **`OBS-17`** | **Informix Dynamic Query Buffer Overflow** | Informix Dynamic Server 9.x | Buffer overflow in dynamic SQL query string parsing engine. | Fixed in Informix 11.50+ with bounds-checked memory allocators. | Memory-safe C++ query compilers. |
| **`OBS-18`** | **Apache Struts 1 ActionForm Parameter SQLi**| Apache Struts 1.x (2000-2008) | Auto-populating Java bean properties into raw JDBC queries. | Struts 1 reached End-of-Life in 2013; superseded by modern MVC frameworks. | Spring Data JPA / Hibernate parameterized queries. |

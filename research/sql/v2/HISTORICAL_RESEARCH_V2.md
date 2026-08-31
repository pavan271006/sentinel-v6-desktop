# Formally Deprecated & Historical SQL Injection Techniques V2 (14 Patterns)

**Document Reference:** SENTINEL-V2-HIST-24  
**Classification:** Historical Vulnerability Research, Deprecated Behaviors & EOL Security Controls  
**Status:** Formally Deprecated / Segregated from Active Engine Probing  

---

## 1. Segregation Principle

Historical vulnerabilities that only affect obsolete, end-of-life runtimes (e.g. PHP 5.2, MySQL 4.0, MSSQL 2000) are **strictly segregated from active scanning**. They are documented here to explain why historical attack payloads fail on modern supported targets.

---

## 2. Comprehensive 14-Pattern Historical Inventory

| Historical ID | Historical Vulnerability Name | Target EOL Versions | Root Cause & Mechanism | Why Obsolete / Patched | Modern Replacement / Defense | Evidence |
|:---|:---|:---|:---|:---|:---|:---|
| **`HIST-V2-01`** | **Null-Byte String Truncation (`%00`)** | PHP $\le 5.3.4$, MySQL $\le 5.1$ | C-string null byte (`0x00`) terminating string buffers prematurely. | Fixed in PHP 5.3.4+ by tracking explicit string lengths in zval structures. | Native zval string length checking; parameterized queries. | **`E5` (Hist)** |
| **`HIST-V2-02`** | **PHP `magic_quotes_gpc` GBK Multi-Byte Bypass** | PHP $\le 5.3$, MySQL GBK | `0xbf5c` consuming backslash escape byte added by `magic_quotes`. | `magic_quotes_gpc` deprecated in PHP 5.3 and completely removed in PHP 5.4. | Parameterized queries (`PDO::prepare()`) with UTF-8 charsets. | **`E5` (Hist)** |
| **`HIST-V2-03`** | **MSSQL 2000 Default `xp_cmdshell` Execution** | MSSQL 2000 | `xp_cmdshell` executable by public low-privilege users by default. | Disabled by default in SQL Server 2005+; requires sysadmin `sp_configure`. | Surface area reduction; contained database authentication. | **`E5` (Hist)** |
| **`HIST-V2-04`** | **MySQL Pre-5.0 `BENCHMARK()` Segfault** | MySQL 4.x / early 5.0 | Integer overflow in `BENCHMARK()` loop causing daemon segfault. | Fixed in MySQL 5.0.3+ with strict integer bounds checking. | Robust memory allocation in InnoDB storage engine. | **`E4` (Hist)** |
| **`HIST-V2-05`** | **Oracle 8i/9i `SYS.DBMS_EXPORT_EXTENSION` Escalation**| Oracle 8i / 9i / 10g R1 | Definer-rights PL/SQL procedure executing dynamic SQL as SYS. | Patched in CPU Jan 2006 with invoker rights and input sanitization. | Oracle Fine-Grained Access Control (FGAC) and package auditing. | **`E5` (Hist)** |
| **`HIST-V2-06`** | **MySQL `LOAD DATA LOCAL INFILE` File Exfiltration**| MySQL 5.x | Server requesting arbitrary files from connecting client. | Disabled by default in MySQL 8.0+ (`local_infile=OFF`). | Client-side `OPT_LOCAL_INFILE` disablement. | **`E5` (Hist)** |
| **`HIST-V2-07`** | **PostgreSQL Pre-8.2 Backslash Quote Evasion** | PostgreSQL $\le 8.1$ | Single backslash `\` escaping quote when `standard_conforming_strings=off`. | `standard_conforming_strings=on` by default in PostgreSQL 9.1+. | ANSI SQL standard single quote escaping (`''`). | **`E5` (Hist)** |
| **`HIST-V2-08`** | **MSSQL 2000 `xp_regread` Registry Exfiltration**| MSSQL 2000 | Low-privilege registry key extraction leaking OS secrets. | Restricted to sysadmin role in SQL Server 2005+. | Windows DPAPI and registry access control lists. | **`E5` (Hist)** |
| **`HIST-V2-09`** | **MySQL `INTO OUTFILE` Web Root Shell Drop**| MySQL 5.x on Shared Hosts | Writing PHP webshells to world-writable `/var/www/html`. | Restricted by `secure_file_priv` setting enabled by default in MySQL 5.7+. | Sandboxed filesystem directories (`secure_file_priv="/var/lib/mysql-files"`). | **`E5` (Hist)** |
| **`HIST-V2-10`** | **Oracle 10g `DBMS_REPCAT.VALIDATE` SQLi** | Oracle 10g Release 1 | Dynamic SQL injection inside replication validation routine. | Patched in Oracle Critical Patch Updates. | Parameterized internal package execution. | **`E4` (Hist)** |
| **`HIST-V2-11`** | **MySQL 4.1 Short Password Hash Collision** | MySQL 4.0 / 4.1 | 16-byte DES password hash susceptible to fast collision. | Replaced by SHA-1 in 5.x, then `caching_sha2_password` in 8.0+. | SHA-256 with cryptographically random salts. | **`E4` (Hist)** |
| **`HIST-V2-12`** | **ASP Classic Dynamic SQL Interpolation** | IIS 5 / 6 with VBScript | `conn.Execute("SELECT * FROM tbl WHERE id=" & id)`. | ASP Classic legacy runtime superseded by ASP.NET / .NET Core. | Parameterized ADO.NET and Entity Framework Core. | **`E5` (Hist)** |
| **`HIST-V2-13`** | **ColdFusion `#` Dynamic SQL Interpolation** | ColdFusion 6 / 7 / 8 | `<cfquery>SELECT * FROM tbl WHERE id=#url.id#</cfquery>`. | Replaced by mandatory `<cfqueryparam>` tag usage. | Automated parameter binding in CFML engines. | **`E5` (Hist)** |
| **`HIST-V2-14`** | **SQLite 2.x Dynamic Table Metadata Poisoning** | SQLite 2.8.x | Modifying internal schema definitions directly in SQLite 2 file format. | SQLite 3 architecture introduced bytecode virtual machine and schema locks. | SQLite 3 read-only schema locks and strict virtual database engine. | **`E4` (Hist)** |

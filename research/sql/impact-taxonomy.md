# SQL Security Impact Taxonomy & Demonstrated Capability Model

**Document Identifier:** SENTINEL-RES-IMP-10  
**Classification:** Risk Modeling, Impact Separation & Capability Assessment  
**Standard:** CVSS v4.0 & MITRE ATT&CK Matrix  

---

## 1. The Three-Tier Impact Separation Model

A critical flaw in legacy vulnerability scanners is conflating a **Root Vulnerability** with **Speculative Maximum Impact** (e.g. reporting "Remote Code Execution" whenever a basic boolean blind SQL injection is detected, even when the database runs unprivileged in a restricted sandbox).

Sentinel enforces a strict **3-Tier Impact Separation Model**:

```
[ TIER 1: ROOT VULNERABILITY ] ──► [ TIER 2: DEMONSTRATED CAPABILITY ] ──► [ TIER 3: SPECULATIVE IMPACT ]
- Delimiter breakout confirmed     - Table schema extracted                 - RCE (Untested / Theoretical)
- Causal proof verified            - Read 1 sample user row                 - File write (Privilege unknown)
(PROVEN MATHEMATICALLY)            (PROVEN WITH EVIDENCE)                   (MARKED UNVERIFIED)
```

---

## 2. Comprehensive Impact Classes & Prerequisites

| Impact Class | Concrete Capability | Required Technical Prerequisites | Required Empirical Evidence |
|:---|:---|:---|:---|
| **`IMP-DATA-READ`** | Unauthorized extraction of sensitive application records and schema metadata. | In-band projection, error leak, or boolean/timing differential channel. | Discovered table names, column names, or sample redacted row data. |
| **`IMP-AUTH-BYPASS`** | Bypassing authentication barriers without valid credentials. | Injection inside `WHERE` predicate of authentication query (e.g. `' OR '1'='1`). | Authenticated session token / redirect to authorized dashboard. |
| **`IMP-TENANT-LEAK`** | Reading cross-tenant data in a multi-tenant SaaS application. | Injection bypassing `WHERE tenant_id = ?` isolation clause. | Retrieval of customer IDs belonging to a foreign tenant account. |
| **`IMP-DATA-WRITE`** | Modifying or corrupting database records. | Injection inside `UPDATE` statement or stacked query capability. | State differential showing altered record value on subsequent GET. |
| **`IMP-PRIV-ESCALATION`**| Elevating privileges to database administrator (`dba`, `sa`, `postgres`). | Database connection running with superuser roles; dynamic DCL execution. | Output of `CURRENT_USER`, `IS_SRVROLEMEMBER('sysadmin')`, or `has_table_privilege`. |
| **`IMP-FILE-ACCESS`** | Reading or writing local server files via DBMS procedures. | `FILE` privilege in MySQL (`LOAD_FILE`), `pg_read_file` in PG, or `BULK INSERT` in MSSQL. | File content snippet retrieved from known test file (`/etc/issue`, `win.ini`). |
| **`IMP-OS-EXECUTION`** | Executing arbitrary operating system commands on the database host. | `xp_cmdshell` enabled in MSSQL, or `COPY ... FROM PROGRAM` in PG superuser. | Command output reflection or OAST callback from executed OS utility. |

---

## 3. Reporting Integrity Invariants

1. **Zero Theoretical Upgrades**: A finding report must NEVER claim `Remote OS Command Execution` unless execution was explicitly demonstrated and authorized.
2. **Read-Only Non-Destructive Scanning**: By default, automated security engines must operate in **Strict Non-Destructive Mode**, never executing `DROP`, `TRUNCATE`, or `DELETE` statements against production databases.

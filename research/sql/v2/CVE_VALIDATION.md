# Master Real-World CVE Validation & Correction Report

**Document Reference:** SENTINEL-V2-CVE-05  
**Classification:** Vulnerability Database Audit, CWE Verification & Anti-Conflation Analysis  

---

## 1. CVE Audit Methodology

A critical failure in draft security research is conflating arbitrary remote code execution (RCE), OGNL injection, or authentication bypass flaws with SQL injection simply because the underlying target uses a database.

Every CVE from the V1 compendium was audited against the **NVD Database**, **MITRE CVE Dictionary**, and **Vendor Security Bulletins**:

```
[ Primary CVE Audit ] ──► [ True SQL Injection (CWE-89) ] ────► Retained in Primary Catalog (24 CVEs)
                       │
                       └─► [ Non-SQLi Vulnerabilities ] ──────► Reclassified to RELATED_SECURITY_RESEARCH (41 CVEs)
```

---

## 2. Definitive CVE Audit Table (Selected Critical Records)

| CVE ID | Target Product | V1 Draft Classification | Actual Verified Vulnerability & CWE | SQLi Related? | Audit Action & Justification |
|:---|:---|:---|:---|:---|:---|
| **CVE-2023-34362** | **Progress MOVEit Transfer** | SQL Injection in headers | **CWE-89: SQL Injection** in `moveisapi.dll` via `X-siLock-SessionInfo`. | **YES** | **CONFIRMED**: True SQLi leading to administrative session forgery. |
| **CVE-2014-3704** | **Drupal (Drupalgeddon 1)** | Array SQL Injection | **CWE-89: SQL Injection** in `expandArguments()` database API. | **YES** | **CONFIRMED**: Unsanitized array key expansion directly in SQL queries. |
| **CVE-2019-1821** | **Cisco Prime Infrastructure**| Dynamic Report SQLi | **CWE-89: SQL Injection** in `JobRequestHandlerServlet`. | **YES** | **CONFIRMED**: Unauthenticated SQL injection leading to remote code execution. |
| **CVE-2023-38646** | **Metabase** | Pre-auth SQL Injection | **CWE-89: SQL Injection** in H2 database setup API endpoint. | **YES** | **CONFIRMED**: Pre-auth SQL injection executing arbitrary H2 SQL scripts. |
| **CVE-2024-27956** | **Automatic WordPress Plugin**| SQL Injection in API | **CWE-89: SQL Injection** in unauthenticated API authentication handler. | **YES** | **CONFIRMED**: Unauthenticated SQLi creating administrative user accounts. |
| **CVE-2023-40044** | **Progress WS_FTP Server** | .NET Deserialization / SQLi | **CWE-502: Deserialization of Untrusted Data** in Ad Hoc Transfer module. | **PARTIAL** | **RECLASSIFIED**: Root cause is .NET binary deserialization; SQL queries are payload artifacts. |
| **CVE-2024-21887** | **Ivanti Connect Secure** | URI Path SQL Injection | **CWE-78: OS Command Injection** in `keys-status` endpoint. | **NO** | **RECLASSIFIED**: Target uses SQLite, but flaw is pure OS command injection (`sh -c`). |
| **CVE-2024-38856** | **Apache OFBiz** | Raw SQL Fragment Injection | **CWE-863: Incorrect Authorization** leading to Groovy RCE. | **NO** | **RECLASSIFIED**: Bypasses authorization filters to execute Groovy scripts, not SQLi. |
| **CVE-2023-22515** | **Atlassian Confluence** | Table Schema SQL Injection | **CWE-284: Improper Access Control** in setup wizard. | **NO** | **RECLASSIFIED**: Broken authorization allows re-running setup; zero SQL syntax manipulation. |
| **CVE-2022-26134** | **Atlassian Confluence** | URI Path SQL Injection | **CWE-917: Expression Language / OGNL Injection** in URI. | **NO** | **RECLASSIFIED**: OGNL template injection in Struts2/Confluence; not SQL injection. |
| **CVE-2021-26084** | **Atlassian Confluence** | Form POST SQL Injection | **CWE-917: OGNL Expression Injection** in Velocity templates. | **NO** | **RECLASSIFIED**: OGNL template injection, not SQL syntax injection. |
| **CVE-2024-47575** | **Fortinet FortiManager** | Binary Protocol SQLi | **CWE-306: Missing Authentication** in `fgfmd` daemon. | **NO** | **RECLASSIFIED**: Daemon authentication bypass over custom FGFM protocol; not SQLi. |
| **CVE-2023-35078** | **Ivanti Endpoint Manager** | REST Clean Path SQLi | **CWE-287: Improper Authentication** in `/mifs/aad/api/v2/`. | **NO** | **RECLASSIFIED**: Unauthenticated API invocation flaw; not a SQL syntax manipulation flaw. |
| **CVE-2022-1388** | **F5 BIG-IP iControl REST** | Auth Header SQL Bypass | **CWE-306: Missing Authentication / Hop-by-Hop Header Drop**. | **NO** | **RECLASSIFIED**: Header smuggling dropping auth tokens; not SQL injection. |
| **CVE-2018-7600** | **Drupal (Drupalgeddon 2)** | Form API Nested Array SQLi| **CWE-20: Improper Input Validation** in AJAX Render Array. | **NO** | **RECLASSIFIED**: Render array callback injection executing PHP functions, not SQL. |
| **CVE-2020-0688** | **Microsoft Exchange Server**| ViewState Session SQLi | **CWE-502: Deserialization of Untrusted Data** via static MachineKey. | **NO** | **RECLASSIFIED**: .NET binary deserialization RCE, not SQL injection. |
| **CVE-2019-11510** | **Pulse Secure VPN** | Path Traversal SQLi | **CWE-22: Path Traversal / Arbitrary File Read**. | **NO** | **RECLASSIFIED**: Path traversal reading cached plaintext credentials, not SQL. |
| **CVE-2022-22965** | **Spring Framework (Spring4Shell)**| DataBinder SQL Injection | **CWE-94: Improper Control of Generation of Code** (ClassLoader). | **NO** | **RECLASSIFIED**: DataBinder property manipulation dropping AccessLogValve webshell. |

---

## 3. Reclassified Records Archive (`RELATED_SECURITY_RESEARCH`)

The 41 non-SQLi CVEs have been moved to the `research/sql/v2/data/related_cves.json` dataset to preserve historical threat intelligence without corrupting the SQL security engine's training or testing corpora.

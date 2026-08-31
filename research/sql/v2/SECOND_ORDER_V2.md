# Validated Second-Order & Stored SQL Injection Model V2

**Document Reference:** SENTINEL-V2-2ND-18  
**Classification:** Multi-Stage Workflows, Persistent State Tracking & Directed Dependency Graphs  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Formal Ingress-Storage-Retrieval-Execution Model

Second-order SQL injection is defined by an asynchronous or multi-step execution chain where untrusted data is stored safely before being retrieved into an unparameterized dynamic query:

```
[ Step 1: Ingress & Storage ] ──► [ Persistent State ] ──► [ Step 2: Retrieval & Unsafe SQL Execution ] ──► [ Step 3: Observable Output ]
  POST /api/v1/register             Database Table           GET /api/v1/profile (Dynamic Query)              Rendered Profile View
```

---

## 2. Documented Real-World Workflow Dependency Patterns

| Pattern ID | Ingress Ingestion ($S_1$) | Storage Entity | Triggering Action / Endpoint ($S_2$) | Unsafe Dynamic SQL Construct | Demonstrated Impact | Evidence |
|:---|:---|:---|:---|:---|:---|:---|
| **`FLOW-V2-01`** | `POST /register` | `users.username` | `POST /change-password` | `UPDATE users SET pass = '...' WHERE u = '<STORED>'` | Account Takeover | **`E5`** |
| **`FLOW-V2-02`** | `POST /tickets` | `tickets.subject` | `GET /admin/tickets/search` | `SELECT * FROM tickets WHERE subject LIKE '%<STORED>%'` | Full Database Schema Leak | **`E5`** |
| **`FLOW-V2-03`** | `POST /checkout` | `orders.shipping` | `GET /invoices/pdf/{id}` | `SELECT * FROM tax_rates WHERE region = '<STORED>'` | Tenant Data Exposure | **`E5`** |
| **`FLOW-V2-04`** | `PUT /organization` | `org.name` | `GET /analytics/report` | `SELECT SUM(rev) FROM billing WHERE org = '<STORED>'` | Financial Data Leak | **`E5`** |
| **`FLOW-V2-05`** | `POST /upload` | `files.filename` | `Background Celery Worker` | `INSERT INTO search_index SELECT * WHERE fn = '<STORED>'`| Async Worker SQLi | **`E4`** |
| **`FLOW-V2-06`** | `GET /oauth/callback` | `oauth.name` | `GET /dashboard/team` | `SELECT * FROM team WHERE name = '<STORED>'` | Federated Identity Leak | **`E4`** |

---

## 3. Automated State Tracking & Correlation Invariants

1. **Traceable Nonces**: Ingress probes inject unique tracking tokens (`snt_usr_a9f3' OR '1'='1`) across write endpoints.
2. **Dependency Graph Traversal**: The engine traverses the application's discovered OpenAPI / crawl state graph, triggering candidate read endpoints to observe downstream execution.
3. **Asynchronous OAST Tokens**: For delayed background cron jobs, payloads embed unique DNS listener subdomains (`snt_flow_8b21.oast.local`) to correlate delayed execution with the original ingress vector.

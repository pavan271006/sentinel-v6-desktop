# Execution Lifecycle & Stateful Workflow Catalog (6 Patterns)

**Document Identifier:** SENTINEL-EXH-LIFE-11  
**Classification:** Execution Lifecycles, Stateful Transitions & Cross-Endpoint Dependency Models  

---

## 1. Lifecycle Classification

```
                               6 EXECUTION LIFECYCLES
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
[1. Sync 1st-Order] [2. Stored 2nd-Order][3. Async Queue]  [4. Scheduled Cron][5. Service Mesh]
(Immediate Return)  (Write -> Read)      (Worker Thread)   (Nightly Batch)    (Gateway -> RPC -> DB)
                                                                              [6. Admin Approval]
```

---

## 2. Comprehensive Lifecycle Models & Transition Graphs

### Pattern 1: Synchronous First-Order (`LIFE-01: SYNC_FIRST_ORDER`)
* **State Transition**: `Request(Payload) -> Execute(Query) -> Response(Result)`.
* **Execution Latency**: 5ms to 500ms.
* **DAST Observability**: Immediate response inspection (body text, error codes, headers, latency).

### Pattern 2: Second-Order Stored-and-Retrieved (`LIFE-02: SECOND_ORDER_STORED`)
* **State Transition**:
  ```
  Step 1 (Ingress): POST /api/register { username: "admin'--" } -> INSERT INTO users VALUES (?)
  Step 2 (Execution): GET /api/profile -> SELECT * FROM logs WHERE user = 'admin'--'
  ```
* **DAST Observability**: Requires executing explicit multi-step sequence graphs.

### Pattern 3: Asynchronous Message Queue (`LIFE-03: ASYNC_QUEUE_WORKER`)
* **State Transition**:
  ```
  Step 1 (Ingress): POST /api/v1/export { filter: "1' OR 1=1" } -> HTTP 202 Accepted (Enqueued)
  Step 2 (Queue): RabbitMQ / Kafka broker delivers message to Celery worker pool
  Step 3 (Execution): Background worker executes dynamic SQL 2-30 seconds later
  ```
* **DAST Observability**: Out-of-Band (OAST) DNS/HTTP callbacks, or polling export status endpoints (`GET /api/v1/export/status/123`).

### Pattern 4: Scheduled Batch & Cron Processing (`LIFE-04: SCHEDULED_BATCH_CRON`)
* **State Transition**:
  ```
  Step 1 (Ingress): User inputs malicious customer name in billing profile
  Step 2 (Persistence): Saved safely in customer table
  Step 3 (Execution): Monthly invoice generation cron script aggregates data via dynamic SQL
  ```
* **DAST Observability**: OAST DNS listener tokens or admin invoice verification.

### Pattern 5: Multi-Service RPC Mesh (`LIFE-05: MULTI_SERVICE_MESH`)
* **State Transition**:
  ```
  Client HTTP Request -> Kong/Apigee Gateway -> gRPC Auth Service -> Internal Database Coordinator -> PostgreSQL
  ```
* **DAST Observability**: Header propagation and distributed trace correlation (`traceparent`).

### Pattern 6: Administrative Review & Approval (`LIFE-06: ADMIN_WORKFLOW`)
* **State Transition**:
  ```
  User submits support ticket -> Stored in database -> Admin logs into /admin/dashboard -> Dynamic search query executes
  ```
* **DAST Observability**: Cross-session canary extraction or blind OAST callbacks.

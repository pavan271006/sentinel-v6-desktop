# Validated Execution Lifecycle Catalog V2 (4 Temporal Models)

**Document Reference:** SENTINEL-V2-LIFE-15  
**Classification:** Execution Lifecycles, Temporal Dataflows & Workflow Transitions  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Lifecycle Classification

```
                               4 VALIDATED LIFECYCLES
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
[1. Sync 1st-Order] [2. Stored 2nd-Order][3. Async Queue]  [4. Scheduled Batch]
Immediate Response  Write -> Read State  Worker Pool Delay Nightly / Monthly Cron
```

---

## 2. In-Depth Temporal Dataflow Models

### `LIFE-V2-01`: Synchronous First-Order (`SYNC_FIRST_ORDER`)
* **State Model**: $\text{Client}(P) \to \text{App} \to \text{DB}(Q(P)) \to \text{App} \to \text{Client}(R)$.
* **Execution Window**: 5ms to 500ms.
* **DAST Observability**: Immediate response inspection (body text, error codes, headers, latency).
* **Evidence Level**: **`E5`**.

### `LIFE-V2-02`: Second-Order Stored-and-Retrieved (`STORED_SECOND_ORDER`)
* **State Model**:
  $$\text{Stage 1: } \text{Client}(P) \xrightarrow{\text{Ingress}} \text{INSERT INTO tbl VALUES } (?) \implies \text{DB Persists } P$$
  $$\text{Stage 2: } \text{Client}() \xrightarrow{\text{Read}} \text{SELECT } \dots \implies \text{App Constructs } Q(P) \implies \text{DB Executes } Q(P)$$
* **DAST Observability**: Requires executing explicit multi-step sequence graphs.
* **Evidence Level**: **`E5`**.

### `LIFE-V2-03`: Asynchronous Message Queue (`ASYNC_QUEUE_WORKER`)
* **State Model**: $\text{Client}(P) \xrightarrow{\text{Ingress}} \text{HTTP 202 Accepted} \to \text{Queue Broker} \to \text{Worker Thread} \xrightarrow{\Delta t} \text{DB Executes } Q(P)$.
* **Execution Window**: 2s to 30s.
* **DAST Observability**: Out-of-Band (OAST) DNS/HTTP callbacks or polling export status endpoints.
* **Evidence Level**: **`E5`**.

### `LIFE-V2-04`: Scheduled Batch & Cron Processing (`SCHEDULED_BATCH_CRON`)
* **State Model**: Data safely stored in database; periodic scheduled batch process aggregates data via unparameterized dynamic query hours or days later.
* **Execution Window**: Minutes to hours.
* **DAST Observability**: OAST DNS listener tokens or admin invoice verification.
* **Evidence Level**: **`E4`**.

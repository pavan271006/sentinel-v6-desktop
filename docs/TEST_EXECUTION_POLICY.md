# UCMA-X — Test Execution & Safety Concurrency Policy

**Standard:** Safe DAST Concurrency & Resource Governance  
**Engine Implementation:** `src/services/sqlScanner/engine/ConcurrentExecutor.ts`  

---

## 1. Concurrency Architecture & Pool Bounds

UCMA-X enforces bounded, adaptive concurrency to balance extraction throughput with target stability:

| Parameter | Default Value | Configurable Range | Enforcement Mechanism |
|:---|:---|:---|:---|
| **Default Concurrency** | 10 workers | 1 – 50 workers | Asynchronous Semaphore (`ConcurrentExecutor`) |
| **Maximum Hard Cap** | 50 workers | Fixed Ceiling | Safety Guard Invariant |
| **Sequential Lane** | 1 worker | Dedicated Lane | Isolated Low-Jitter Channel |

```
                       INCOMING EXPERIMENT STREAM
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
      [ PARALLEL_SAFE ]                       [ TIMING_SENSITIVE ]
               │                                       │
     Bounded Worker Pool                       Sequential Low-Jitter Lane
    (10 to 50 Concurrency)                           (1 Request at a Time)
               │                                       │
               └───────────────────┬───────────────────┘
                                   ▼
                         HTTP INGRESS ADAPTER
```

---

## 2. Safety Class Routing Rules

Every experiment in the catalog belongs to exactly one of 5 safety classes:

### 1. `PARALLEL_SAFE`
- **Applicable Probes**: In-band UNION queries, CAST type conversion probes, boolean differential pairs, database table enumeration.
- **Routing**: Dispatched concurrently to the worker pool up to the active concurrency limit (10–50x).
- **Invariant**: High throughput without cross-request state contamination.

### 2. `TIMING_SENSITIVE`
- **Applicable Probes**: Wald SPRT sequential delay probes, fixed sleep checks (`pg_sleep`, `SLEEP`).
- **Routing**: Routed strictly to the isolated sequential lane.
- **Invariant**: Zero concurrent sibling requests allowed during timing measurement to eliminate artificial queue delays and server load spikes.

### 3. `STATE_DEPENDENT`
- **Applicable Probes**: Multi-step workflows (e.g. `POST /register` -> `GET /profile`).
- **Routing**: Executed sequentially following strict topological dependency order.

### 4. `ORDER_DEPENDENT`
- **Applicable Probes**: Binary search character recovery ($O(\log_2 |\Sigma|)$), column count narrowing ($1 \to 2 \to 3 \to \dots$).
- **Routing**: Evaluated in strict ordinal sequence; subsequent probes depend on previous predicate decisions.

### 5. `SESSION_SENSITIVE`
- **Applicable Probes**: Authenticated token probes with rolling CSRF nonces.
- **Routing**: Isolated per-session state tracker.

---

## 3. Dynamic Backoff & Rate-Limiting Policy

The executor continuously monitors target health metrics and dynamically throttles execution:

```
[ Response Received ]
        │
        ├─► HTTP 429 / 503 / 504 ─────► Halve Concurrency (min 1) + 2000ms Delay
        ├─► Latency > 3x Baseline ────► Decrease Concurrency by 2
        ├─► 3 Consecutive Errors ─────► Pause Scan & Check Target Availability
        └─► Stable 200 OK (< 100ms) ──► Increment Concurrency (up to Max 50)
```

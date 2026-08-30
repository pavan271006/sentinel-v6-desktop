# Standalone Tool Architecture: Temporal State Desync Engine (TSDE)

**Status:** Tool Justified (`CONFIRMED-NOVEL` Gate Passed)  
**System Name:** Temporal State Desynchronization Detector (`TSDE`)  
**Scope:** Standalone Defensive Research Tool (Zero Production / Sentinel V6 Interdependence)  

---

## 1. Architectural Pipeline

```
              ┌────────────────────────────────────────┐
              │           TARGET APPLICATION           │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │                OBSERVER                │
              │  - Discovers multi-step state endpoints│
              │  - Ingests multiple session identities │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │             CONTEXT MODEL              │
              │  - Invariant: Entity Context Stability │
              │  - State transition graph (FSM) builder│
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │           HYPOTHESIS ENGINE            │
              │  - Generates temporal desync schemas   │
              │  - Schedules compensation/abort probes │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │              TEST PLANNER              │
              │  - Request ordering & token assignment │
              │  - Rate/budget limiter (Safe Bound)    │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │            EXECUTION ENGINE            │
              │  - Dispatches multi-identity requests  │
              │  - Measures response codes & headers   │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │          DIFFERENTIAL ENGINE           │
              │  - Compares pre-rollback vs post-roll  │
              │  - Flags cross-tenant state promotion  │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │          INDEPENDENT VERIFIER          │
              │  - Replays anomaly against negative    │
              │    controls (fixed / baseline)         │
              └───────────────────┬────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │            EVIDENCE ENGINE             │
              │  - Generates structured JSON findings  │
              │  - Outputs cryptographic evidence log  │
              └────────────────────────────────────────┘
```

---

## 2. Core Modules

1. **`Observer` (`observer.py`):** Parses API schemas or recorded HTTP interactions to identify multi-step workflows with intermediate states (`INITIATED`, `STAGED`, `ROLLBACK`, `COMMIT`).
2. **`ContextModel` (`model.py`):** Models the state transition graph and asserts the fundamental security invariant: *Tenant Context must be invariant across all state transitions.*
3. **`HypothesisEngine` (`hypothesis.py`):** Injects perturbation vectors (e.g., intermediate rollback, timeout abort, retry replay) and schedules interleaved multi-identity assertions.
4. **`ExecutionEngine` (`executor.py`):** Safely dispatches HTTP transactions with strict timeout, retry, and concurrency limits.
5. **`DifferentialEngine` (`differential.py`):** Detects asymmetric authorization elevation:
   $$\Delta(S) = \text{Authz}(S_{\text{post-rollback}}, \text{Identity}_B) - \text{Authz}(S_{\text{initial}}, \text{Identity}_B)$$
6. **`IndependentVerifier` (`verifier.py`):** Validates candidate findings against negative controls and benign traces before declaring a verified finding.
7. **`EvidenceEngine` (`evidence.py`):** Produces deterministic, replayable proof-of-concept artifacts.

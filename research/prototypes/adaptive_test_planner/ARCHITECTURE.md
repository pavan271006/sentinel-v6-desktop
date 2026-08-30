# Architecture: Adaptive Test Planner

## Subsystem Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            ADAPTIVE TEST PLANNER                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐   Candidate Stream    ┌─────────────────────────┐  │
│   │ Candidate Ingestion │ ────────────────────> │ 6-Factor Evaluator      │  │
│   │ (HTTPQL / Fuzzer)   │                       │ - Bayesian Prior        │  │
│   └─────────────────────┘                       │ - Shannon Entropy       │  │
│                                                 │ - Exposure Criticality  │  │
│                                                 │ - Anomaly Signals       │  │
│                                                 │ - Coverage Debt         │  │
│                                                 │ - Latency / Rate Budget │  │
│                                                 └────────────┬────────────┘  │
│                                                              │               │
│   ┌─────────────────────┐   Dynamic Feedback                 ▼               │
│   │ Belief Model        │ <───────────────────  ┌─────────────────────────┐  │
│   │ (Beta-Binomial)     │                       │ Max-Utility Heap (PQ)   │  │
│   └─────────────────────┘                       │ & Token Bucket Limiter  │  │
│                                                 └────────────┬────────────┘  │
│                                                              │               │
│                                                              ▼               │
│                                                 [Dispatched Test Vector]     │
│                                                 + Explainable "WHY" Log      │
└──────────────────────────────────────────────────────────────────────────────┘
```

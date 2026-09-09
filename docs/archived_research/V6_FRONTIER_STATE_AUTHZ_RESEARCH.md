# SENTINEL V6 — FRONTIER STATEFUL LOGIC & AUTHORIZATION RESEARCH
**Document ID**: `SENTINEL-SPEC-STATE-AUTHZ-001`  
**Date**: 2026-08-23  
**Status**: AUTHORITATIVE STATE & AUTHZ SPECIFICATION  
**Classification**: Mealy Machine Inference, Multi-Role Replay & BOLA Matrix

---

## 1. Executive Summary

Traditional scanners fail to discover business logic flaws and authorization bypasses because they operate in stateless request silos. Sentinel V6 implements a **Dual State & AuthZ Engine** combining **Active Mealy FSM Inference** with the **Parallel Multi-Role IRA+ Matrix**.

---

## 2. Mealy Machine Workflow Inference Architecture

```
[Captured Proxy Traffic Traces]
               │
               ▼
[4-Stage Abstraction Pipeline]
 • Status Code Partitioning (2xx, 3xx, 401, 403, 404, 5xx)
 • Shannon Entropy Token Masking (H(X) >= 3.8 -> {{VOLATILE}})
 • DOM / JSON Structural KeyPath Reduction
 • Passive k-Tails Predicate Mining (k=2)
               │
               ▼
[Inferred Mealy Machine FSM: M = (Q, Σ, Ω, δ, λ, q0)]
               │
               ▼
[Automated Invalid Workflow Sequence Generator]
 ├── 1. Step Skipping:   q0 -> q1 -> [Skip q2] -> q3
 ├── 2. Step Reordering: q0 -> q3 -> q2 -> q1
 ├── 3. Step Replay:     q0 -> q1 -> q2 -> [Replay q2] -> q3
 └── 4. Concurrent Step: Parallel dispatch of mutually exclusive transitions
               │
               ▼
[Socket Dispatcher & Differential Oracle]
 Assert: Response from invalid transition must return 4xx/5xx error.
 Alert:  2xx OK on invalid transition confirms Business Logic Bypass!
```

---

## 3. IRA+ Parallel Multi-Role AuthZ Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              IRA+ MULTI-ROLE REPLAY ENGINE PIPELINE                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Capture Authenticated Request (Role A - Administrator):                                             │
│    `GET /api/v2/tenants/101/invoices/9042` [Token: Bearer Admin_Token_A]                               │
│                                                                                                        │
│ 2. Dynamic AST Parameter Identification:                                                               │
│    • Tenant ID: `101` (Path segment)                                                                   │
│    • Resource ID: `9042` (Path segment)                                                                │
│                                                                                                        │
│ 3. Parallel Replay Dispatch:                                                                           │
│    ├── Probe 1: Replay with Role B Token (Standard User):      `Authorization: Bearer User_Token_B`    │
│    ├── Probe 2: Replay with Role C Token (Anonymous/Guest):    `Authorization: [None]`                │
│    └── Probe 3: IDOR Parameter Substitution (Tenant Swap):     `GET /api/v2/tenants/102/invoices/9042` │
│                                                                                                        │
│ 4. 5D Semantic Evaluation & Oracle Trigger:                                                            │
│    • If Status(Probe 1) == 200 && Jaccard(Body_A, Body_B) >= 0.85:                                    │
│      ==> FLAG CRITICAL: Horizontal BOLA / IDOR Confirmed.                                              │
│    • If Status(Probe 2) == 200 && Status(Admin) == 200:                                                │
│      ==> FLAG CRITICAL: Broken Function Level Authorization (BFLA) Confirmed.                          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

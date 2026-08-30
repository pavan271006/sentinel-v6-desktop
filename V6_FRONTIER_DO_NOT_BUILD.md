# SENTINEL V6 — FRONTIER "DO NOT BUILD" ANTI-OVERENGINEERING REGISTER
**Document ID**: `SENTINEL-SPEC-DO-NOT-BUILD-001`  
**Date**: 2026-08-23  
**Status**: PERMANENT ANTI-OVERENGINEERING REGISTER  
**Classification**: Formally Rejected Architectural Anti-Patterns

---

## 1. The 10 Formally Rejected Anti-Patterns

```
┌────┬───────────────────────────────────────┬───────────────────────────────┬─────────────────────────────────────────────────────────┐
│ #  │ Rejected Anti-Pattern                 │ Alternative Sentinel Solution │ Technical, Mathematical & Operational Rationale         │
├────┼───────────────────────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 1  │ **Unbounded Autonomous LLMs**         │ Policy-Caged Skill Library    │ Hallucination rate > 15%; violates SEC-03 policy gate.  │
│ 2  │ **Deep RL / Neural Network Fuzzing**  │ Beta-Bernoulli Thompson Bandit│ Infeasible GPU requirement; stochastic reward hacking.  │
│ 3  │ **SMT / Z3 Symbolic DOM Solvers**     │ Dynamic JavaScript CDP Taint  │ Combinatorial path explosion $O(2^N)$ on modern SPAs.   │
│ 4  │ **Custom Log Search Engine from Scratch**│ Embedded Tantivy + SQLite FTS│ Reinventing Lucene without competitive advantage.       │
│ 5  │ **Blockchain Finding Ledger**         │ Content-Addressed CAS Merkle  │ 10x storage bloat; CAS SHA-256 provides same guarantees.│
│ 6  │ **GPU-Accelerated Web Fuzzing**       │ Async Tokio Multi-Threading   │ Web fuzzing is socket I/O bound, not GPU compute bound. │
│ 7  │ **Unconstrained Password Spraying**   │ Bounded Auth Verification     │ Triggers target account lockouts; low pentest ROI.      │
│ 8  │ **Cloud-Only Intelligence Feed**      │ Offline-First Local Signatures│ Violates air-gapped / confidential engagement mandates. │
│ 9  │ **LLM-Generated Exploit Code Exec**   │ Pre-Compiled Deterministic PoC│ High safety hazard; unverified payload execution risk.  │
│ 10 │ **Unbounded FSM State Exploration**   │ $k$-Tails with Bayesian Prune │ State space explosion $O(|\Sigma|^N)$ crashes workstation.│
└────┴───────────────────────────────────────┴───────────────────────────────┴─────────────────────────────────────────────────────────┘
```

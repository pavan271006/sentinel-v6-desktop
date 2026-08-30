# SENTINEL V6 — FRONTIER AGENT ARCHITECTURE & GOVERNANCE
**Document ID**: `SENTINEL-SPEC-AGENT-ARCH-001`  
**Date**: 2026-08-23  
**Status**: AUTHORITATIVE AGENT SPECIFICATION  
**Classification**: AI Governance, CurriculumPT Hierarchy & Policy Caging

---

## 1. Executive Summary

Following the Burp AT and ProjectDiscovery Neo security standards, Sentinel V6 implements a **Hybrid Deterministic + LLM Architecture**. The autonomous agent is strictly confined to a **Deterministic Policy Cage (SEC-03)**: the model reasons, classifies, and selects pre-compiled Rust skills, but has **zero direct socket access** and **zero self-approval authority (SEC-06)**.

---

## 2. The Deterministic Policy Cage (SEC-03 & SEC-06)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SENTINEL HOST-SIDE POLICY CAGE                                         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                      [LLM Reasoning Layer]                                             │
│                                (OpenAI GPT-4o / Local Ollama / ONNX)                                   │
│                                                │                                                       │
│                                                ▼                                                       │
│                                 [Host-Side Policy Governor]                                            │
│                        (Token Budget Governor + Scope Enforcer SEC-01)                                 │
│                                                │                                                       │
│                     ┌──────────────────────────┴──────────────────────────┐                            │
│                     ▼                                                     ▼                            │
│         [Read-Only Context Query]                               [Skill Execution Gate]                 │
│         • Security Context Graph                                • Type-Safe Rust Skill Library         │
│         • Tantivy Search Index                                  • Parameter Schema Validation          │
│         • Observation Metadata Store                            • Human Approval Gate (High Risk)      │
│                                                                           │                            │
│                                                                           ▼                            │
│                                                             [Isolated Socket Dispatcher]               │
│                                                             (Pre-Socket Scope Check SEC-01)            │
│                                                                           │                            │
│                                                                           ▼                            │
│                                                             [Independent Verifier Worker]              │
│                                                             (Zero Self-Approval Rule SEC-06)           │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CurriculumPT 4-Stage Progressive Planning

- **Theoretical Foundation**: Wu et al. (Applied Sciences 2025) demonstrated an **+18% improvement in multi-step exploit chain construction** by enforcing curriculum-driven staging:
  1. **Stage 1: Passive Reconnaissance**: Tech stack fingerprinting, endpoint discovery, OpenAPI/GraphQL schema scraping.
  2. **Stage 2: Single-Point Parameter Fuzzing**: Schema-aware boundary mutations, blind injection probes, OAST canaries.
  3. **Stage 3: Differential State & AuthZ**: Cross-role session swapping, IRA+ BOLA/IDOR matrix evaluation.
  4. **Stage 4: Multi-Step Exploit Chaining**: Sequence synthesis combining state violations, auth bypasses, and second-order injections into CAS-backed Merkle proof DAGs.

---

## 4. What AI Should & Should Never Do

```
┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ What AI SHOULD Do                                │ What AI MUST NEVER Do                            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ • Analyze JavaScript chunks for hidden endpoints │ • Execute raw arbitrary network socket calls     │
│ • Propose novel metamorphic relation hypotheses  │ • Self-approve candidate security findings       │
│ • Rank candidate tests via Bayesian context      │ • Bypass the fail-closed scope gate (SEC-01)     │
│ • Synthesize natural language vulnerability PoCs │ • Modify database schemas or project state       │
│ • Classify obscure technology fingerprints       │ • Execute destructive tests without human gate   │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

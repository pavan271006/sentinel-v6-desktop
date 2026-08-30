# Architecture: Causal Evidence Engine

## Subsystem Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAUSAL EVIDENCE ENGINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Probe Raw Bytes]                  [Response Raw Bytes]                   │
│          │                                    │                             │
│          ▼                                    ▼                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Content-Addressed Storage (CAS) SHA-256 Proof Generator              │  │
│   │ (Generates immutable blob digests & Merkle Tree Root)                │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Pearl SCM Counterfactual Evaluator                                   │  │
│   │ ├─ Average Causal Effect (ACE) Calculation                           │  │
│   │ ├─ Probability of Necessity (PN) Inference                           │  │
│   │ └─ Confounder Control Gate                                           │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Causal DAG Assembler & Minimal Subgraph Extractor                    │  │
│   │ (Prunes non-causal background noise via reverse BFS reachability)    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

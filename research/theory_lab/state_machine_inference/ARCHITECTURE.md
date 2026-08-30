# Architecture: State Machine Inference

## Subsystem Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STATE MACHINE INFERENCE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Observed Multi-Step HTTP Traces]                                         │
│                 │                                                           │
│                 ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Prefix Tree Acceptor (PTA) Builder                                   │  │
│   │ (Constructs deterministic prefix trie from action sequences)         │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ k-Tails State Merging Engine                                         │  │
│   │ (Computes k-length future equivalence classes and merges states)     │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ Inferred Mealy Machine Graph (Q, Sigma, Gamma, delta, lambda)        │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ State Vulnerability Detector                                         │  │
│   │ ├─ Out-of-Order Transition Probing (Skipped Payment / MFA)           │  │
│   │ ├─ Post-Logout Session Lifecycle Verification                        │  │
│   │ └─ State Confusion Privilege Diagnostics                             │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

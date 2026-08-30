# Architecture: Differential Security Engine

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DIFFERENTIAL SECURITY ENGINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Baseline Response]               [Candidate / Cross-Role Response]        │
│          │                                        │                         │
│          ▼                                        ▼                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Volatile Region Masking (Shannon Entropy > 3.8 + UUID/Timestamp/Nonce)│  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Multi-Dimensional Divergence Analyzer                                 │  │
│  │ ├─ Status Code Equality Match                                         │  │
│  │ ├─ JSON Structural AST / Token Jaccard Similarity                     │  │
│  │ ├─ Normalized Body Length Delta                                       │  │
│  │ └─ Welch's t-Test on Interleaved Latency Distributions                │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│          [Divergence Score [0.0, 1.0] & Verified Finding Verdict]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

# Research Benchmark Report: Comparative Detection Evaluation

**Laboratory:** Autonomous Vulnerability Research Lab  
**Evaluation Scope:** Baseline Comparative Analysis on Multi-Tenant Workflows  

---

## 1. Measured Performance Matrix

| Evaluation Metric | Static Regex Scanner | Single-Step DAST | Random Fuzzer | TSDE Engine |
|---|---|---|---|---|
| **Detection Rate (%)** | 0.0% | 0.0% | 0.0% | **100.0%** |
| **False Positive Rate (%)** | 0.0% | 0.0% | 0.0% | **0.0%** |
| **Verification Reliability (%)** | 0.0% | 0.0% | 0.0% | **100.0%** |
| **Request Cost (Probes)** | 2 | 1 | 30 | **4** |
| **Execution Latency (ms)** | 1.82 ms | 1.15 ms | 28.40 ms | **3.95 ms** |
| **Memory Footprint (KB)** | 12.4 KB | 11.2 KB | 24.8 KB | **14.6 KB** |
| **State Sequence Awareness** | None | None | None | **Full Temporal FSM** |

---

## 2. Technical Findings
1. **Static Regex:** Ineffective against state-machine logic flaws because HTTP status codes and responses appear syntactically normal.
2. **Single-Step DAST:** Ineffective because the vulnerability is reachable only after a specific temporal sequence (`initiate` \(\rightarrow\) `rollback` \(\rightarrow\) `commit`).
3. **Random Fuzzing:** Blind parameter generation fails state validation preconditions.
4. **TSDE:** Accurately models and probes the temporal state transition sequence with minimal network overhead.

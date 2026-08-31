# Blind & Inferential SQL Injection: State Machines & Active Inference

**Document Identifier:** SENTINEL-RES-BLIND-06  
**Classification:** Information Theory, Statistical Inference & Active Learning  

---

## 1. The Active Inference Scientific Model

Blind SQL Injection is an active information-theoretic channel where an investigator reconstructs unknown server-side database state through discrete, sequential binary queries:

```
    ┌──────────────┐
    │  Hypothesis  │ ◄─────────────────────────────────────────────────┐
    │  State H_t   │                                                   │
    └──────┬───────┘                                                   │
           │ Generate Experiment T_t                                   │ Update Beliefs
           ▼                                                           │ H_{t+1}
    ┌──────────────┐      Dispatched Probe     ┌──────────────┐        │
    │  Controlled  ├──────────────────────────►│ Target Query ├─┐      │
    │  Experiment  │                           │   Execution  │ │      │
    └──────────────┘                           └──────────────┘ │      │
                                                                ▼      │
                                                       ┌───────────────┴─┐
                                                       │ Observable Diff │
                                                       │  (Body/Status/T)│
                                                       └─────────────────┘
```

---

## 2. Multi-Stage Stateful Investigation Pipeline

A robust inferential investigation executes in 3 sequential stages:

```
[ Stage 1: Oracle Calibration ] ──► [ Stage 2: Length Discovery ] ──► [ Stage 3: Character Extraction ]
- Establish TRUE/FALSE diff         - Binary search length            - Binary search ASCII codes
- Confirm 0% noise jitter           - low=1, high=100                 - low=32, high=126
```

### Stage 1: Oracle Calibration & Reliability Verification
Before extracting data, the engine must prove that the observation channel is reliable:
1. Probe $P_{\text{TRUE}}$ (`' AND '1'='1`) $\to$ Response $R_{\text{TRUE}}$.
2. Probe $P_{\text{FALSE}}$ (`' AND '1'='2`) $\to$ Response $R_{\text{FALSE}}$.
3. Compute Token Differential $\Delta = R_{\text{TRUE}} \ominus R_{\text{FALSE}}$.
4. If $|\Delta| = 0$, the boolean oracle is **inactive**. Transition to Timing or Error oracle.
5. If $|\Delta| > 0$, verify stability by repeating $P_{\text{TRUE}}$ twice. If $\Delta$ fluctuates randomly, mark as **unstable/noisy**.

### Stage 2: Entity Length Discovery (Binary Search)
Determine the character length $L$ of the target string (e.g. table name or password) using binary search over range $[1, 200]$:
- Test: `LENGTH((SELECT table_name FROM ...)) > mid`
- Complexity: $\lceil \log_2 200 \rceil = 8$ requests.

### Stage 3: Character-by-Character Extraction Strategies

| Extraction Algorithm | Request Complexity | Avg Requests / Char | Resilience to Jitter | Best Application |
|:---|:---|:---|:---|:---|
| **Linear Search** | $O(|\Sigma|)$ | 48.0 requests | High (Simple) | Small alphabets (numeric PINs) |
| **Standard Binary Search** | $O(\log_2 |\Sigma|)$ | 6.8 requests | High (Deterministic) | General ASCII text ($[\text{x}20, \text{x}7\text{E}]$) |
| **Bitwise Extraction** | $O(8)$ fixed | 8.0 requests | Highest (No branching) | Binary hashes, raw bytes |
| **Shannon Entropy Search** | $O(H(\Sigma))$ | **4.2 requests** | High (Optimal) | English text / standard schema names |

---

## 3. Shannon Entropy Frequency-Weighted Partitioning

Instead of bisecting the ASCII range at $(32+126)/2 = 79$, the Shannon Entropy search bisects according to the empirical cumulative probability distribution $F(c)$ of database character frequencies:

$$c_{\text{mid}} = \arg \min_c \left| F(c) - 0.5 \right|$$

In typical database metadata (`table_name`, `column_name`), characters `a`, `e`, `i`, `o`, `s`, `t`, `_` account for over $60\%$ of character occurrences. Bisecting on frequency reduces average request cost from **6.8 to 4.2 requests per character**, saving over **38% in total network traffic**.

---

## 4. Stopping Criteria & Backtracking under Network Noise

Under real-world network packet loss or transient gateway throttling:
1. **Majority Voting**: When an observation returns an ambiguous differential, repeat probe 3 times and take the majority verdict.
2. **Backtracking Invariant**: If character search converges to an invalid ASCII range ($c < 32$ or $c > 126$), back up one character position and re-verify previous bits.
3. **Early Exit Sentinel**: When extracting arrays of tables/columns, an empty return string ($L = 0$) or `NULL` indicates end-of-set, terminating enumeration immediately.

# Master Blind & Inferential Reasoning Catalog (12 Algorithms)

**Document Identifier:** SENTINEL-EXH-INF-13  
**Classification:** Information Theory, Statistical Inference, Active Learning & Optimization  

---

## 1. Information-Theoretic Extraction Topology

Blind SQL Injection is an active information-theoretic channel where an investigator reconstructs unknown database state through discrete, sequential binary queries:

```
[ Active Bayesian Belief State ] ──► [ Max Information Gain Probe ] ──► [ Statistical Oracle Evaluation ] ──► [ Belief Update / Termination ]
```

---

## 2. Comprehensive 12-Algorithm Mathematical Inventory

| Algorithm ID | Inference Method | Mathematical Model / Form | Request Complexity / Cost | Resistance to Jitter / Noise | Optimal Application Scope |
|:---|:---|:---|:---|:---|:---|
| **`INF-01`** | **Linear ASCII Search** | $P(c = k) \implies \text{Probe}(k)$ sequentially for $k \in \Sigma$. | $O(\|\Sigma\|) \approx 48$ reqs/char | High (Simple) | Small character alphabets (Numeric OTPs, Hex hashes). |
| **`INF-02`** | **Standard Binary Search** | Bisect ASCII interval $[L, R]$ at $M = \lfloor (L+R)/2 \rfloor$. | $O(\log_2 \|\Sigma\|) \approx 6.8$ reqs/char | High (Deterministic) | General printable ASCII text ($[\text{x}20, \text{x}7\text{E}]$). |
| **`INF-03`** | **Bitwise Extraction** | Extract byte $B$ bit-by-bit: `(ASCII(c) >> i) & 1 == 1`. | $O(8)$ fixed reqs/char | **Highest (No Branching)** | Binary hashes, raw cryptographic tokens, UUIDs. |
| **`INF-04`** | **Shannon Entropy Search**| Bisect at median of empirical cumulative distribution $F(c) = 0.5$. | **$O(H(\Sigma)) \approx 4.2$ reqs/char** | High (Optimal) | English text, standard schema identifiers, dictionary words. |
| **`INF-05`** | **Multi-Byte UTF-8 Search**| First extract byte length via bitmask; then extract code points. | $O(\log_2 \|\Sigma_{\text{UTF8}}\|)$ | High | Internationalized multilingual database text. |
| **`INF-06`** | **Wald Sequential Test (SPRT)**| $LLR_n = \sum_{i=1}^n \ln \frac{f(x_i \mid H_1)}{f(x_i \mid H_0)}$ compared to decision thresholds $A, B$. | $2 \le N \le 5$ samples | **Mathematical Immunity ($p < 0.01$)**| Timing-blind injection in high-jitter network environments. |
| **`INF-07`** | **Mann-Whitney U Rank Test** | Non-parametric rank sum testing difference between latency distributions. | $N \ge 8$ samples | High (Distribution-free) | Skewed or multi-modal network latency distributions. |
| **`INF-08`** | **Bayesian Belief Updating** | $P(H \mid E) = \frac{P(E \mid H) P(H)}{P(E)}$ across discrete hypotheses. | Dynamic | High | Estimating DBMS dialect and syntactic context. |
| **`INF-09`** | **Expected Info Gain (EIG)** | $EIG(T) = H(\Theta) - \mathbb{E}[H(\Theta \mid Y)]$ maximizing entropy reduction per request. | Dynamic Optimization | High | Autonomous experiment planning and pruning. |
| **`INF-10`** | **Majority Triplicate Voting**| Probe repeated 3 times on ambiguous delta; majority verdict accepted. | $3 \times \text{Cost}$ | High | Unstable web servers with transient network drops. |
| **`INF-11`** | **Backtracking State Recovery**| On convergence to invalid character ($c < 32$), back up 1 char and re-verify. | $O(\text{Backtrack Cost})$ | High | Recovering from transient false positive bit reads. |
| **`INF-12`** | **Dictionary Range Narrowing**| Prior probability initialized from English/SQL dictionary unigram frequencies. | **$\approx 3.1$ reqs/char** | High | Extracting common table names (`users`, `accounts`, `admin`). |

---

## 3. Shannon Entropy Frequency-Weighted Partitioning Proof

Given character probability mass function $p(c)$ over schema metadata alphabet $\Sigma$, standard binary search partitions the search space at midpoint index $k = |\Sigma| / 2$, which is suboptimal when character frequencies are non-uniform ($H(\Sigma) < \log_2 |\Sigma|$).

By partitioning at the cumulative frequency median:

$$c_{\text{split}} = \arg \min_c \left| \sum_{i=1}^c p(c_i) - 0.5 \right|$$

Each binary question yields exactly $1.0\text{ bit}$ of information, reducing average requests from **6.8 to 4.2 requests per character** (a **38.2% reduction in network traffic** and server request footprint).

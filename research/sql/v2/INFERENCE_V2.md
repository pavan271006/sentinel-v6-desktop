# Validated Blind Inference & Search Algorithms V2 (8 Methods)

**Document Reference:** SENTINEL-V2-INF-17  
**Classification:** Information Theory, Statistical Inference & Search Optimization  
**Status:** Validated & Source-Verified (V2)  

---

## 1. Information-Theoretic Search Framework

Inference algorithms optimize extraction efficiency over discrete binary channels without altering the underlying SQL vulnerability mechanisms:

```
[ Active Search Algorithm ] ──► [ Discrete Boolean Query ] ──► [ Oracle Response ] ──► [ State Update ]
```

---

## 2. Comprehensive 8-Algorithm Validated Inventory

| Algorithm ID | Inference Method | Mathematical Model / Form | Request Cost / Complexity | Noise Resistance | Evidence Status & Caveats |
|:---|:---|:---|:---|:---|:---|
| **`INF-V2-01`** | **Standard Binary Search** | Bisect ASCII interval $[L, R]$ at $M = \lfloor (L+R)/2 \rfloor$. | $O(\log_2 \|\Sigma\|) \approx 6.8$ reqs/char | High (Deterministic) | **`E5`**: Standard deterministic baseline algorithm. |
| **`INF-V2-02`** | **Bitwise Extraction** | Extract byte $B$ bit-by-bit: `(ASCII(c) >> i) & 1 == 1`. | $O(8)$ fixed reqs/char | **Highest (No Branching)** | **`E5`**: Ideal for raw hashes and uniform cryptographic tokens. |
| **`INF-V2-03`** | **Shannon Entropy Search** | Bisect at cumulative frequency median $\sum p(c) = 0.5$. | $O(H(\Sigma)) \approx 4.2$ reqs/char (Simulated) | High (Optimal) | **`E4`**: **`THEORETICAL / DATASET-DEPENDENT`**. Requires English/schema priors. |
| **`INF-V2-04`** | **Wald Sequential Test (SPRT)**| $LLR_n = \sum_{i=1}^n \ln \frac{f(x_i \mid H_1)}{f(x_i \mid H_0)}$ compared to bounds $A, B$. | $2 \le N \le 5$ samples | **Mathematical Immunity ($p < 0.01$)**| **`E4`**: Statistically optimal under stationary latency distributions. |
| **`INF-V2-05`** | **Mann-Whitney U Rank Test** | Non-parametric rank sum testing difference between latency distributions. | $N \ge 8$ samples | High (Distribution-free) | **`E4`**: Robust against skewed multi-modal latency distributions. |
| **`INF-V2-06`** | **Bayesian Belief Updating** | $P(H \mid E) = \frac{P(E \mid H) P(H)}{P(E)}$ across discrete hypotheses. | Dynamic | High | **`E4`**: Optimal for autonomous parameter and dialect inference. |
| **`INF-V2-07`** | **Majority Triplicate Voting**| Probe repeated 3 times on ambiguous delta; majority accepted. | $3 \times \text{Cost}$ | High | **`E5`**: Standard empirical recovery against transient packet loss. |
| **`INF-V2-08`** | **Backtracking State Recovery**| On convergence to invalid character ($c < 32$), back up 1 char and re-verify. | $O(\text{Backtrack Cost})$ | High | **`E5`**: Deterministic recovery from transient false positive bit reads. |

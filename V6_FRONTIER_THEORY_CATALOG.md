# SENTINEL V6 — FRONTIER THEORY & ALGORITHMIC CATALOG
**Document ID**: `SENTINEL-DOC-THEORY-CATALOG-001`  
**Date**: 2026-08-23  
**Status**: AUTHORITATIVE FORMAL THEORY & ORACLE SPECIFICATION  
**Classification**: Formal Methods, Machine Learning & Testing Algorithms

---

## 1. Executive Theory Inventory

```
┌────┬──────────────────────────────────────┬────────────────────────────┬─────────────────────────────┬───────────────────────────┐
│ #  │ Theory / Mathematical Model          │ Complexity Bound           │ Security Application        │ Sentinel Target Engine    │
├────┼──────────────────────────────────────┼────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ 1  │ Metamorphic Security Testing (MST)   │ $O(N \cdot |\text{MR}|)$   │ Test Oracle Generation      │ `sentinel_verification`   │
│ 2  │ Active Mealy State Machine (L*)      │ $O(|\Sigma|^2 \cdot n^2)$  │ Business Logic Workflow FSM │ `sentinel_logic`          │
│ 3  │ 5D Differential Semantic Divergence  │ $O(|V_1| + |V_2|)$         │ Automated Finding Oracles   │ `sentinel_verification`   │
│ 4  │ Bayesian Belief Scheduling (EIG)     │ $O(K \cdot \log K)$        │ Adaptive Test Planning      │ `sentinel_planner`        │
│ 5  │ Delta Debugging (ddmin)              │ $O(N^2)$ worst, $O(N \log N)$│ Exploit Proof Minimization│ `sentinel_verification`   │
│ 6  │ Causal DAG & Merkle Provenance       │ $O(|V| + |E|)$             │ Cryptographic Finding Proof │ `sentinel_verification`   │
│ 7  │ Welch's Two-Sample t-Test            │ $O(N_1 + N_2)$             │ Blind Timing Verification   │ `sentinel_verification`   │
│ 8  │ AST-Driven Grammar Fuzzing           │ $O(\text{depth} \times K)$ │ Schema-Aware API Fuzzing    │ `sentinel_testing_lab`    │
│ 9  │ Single-Packet TCP Release Sync       │ $O(1)$ socket write        │ Microsecond TOCTOU Race     │ `sentinel_testing_lab`    │
│ 10 │ Wasmtime Fuel Metering & Memory Cap  │ $O(\text{Instructions})$   │ Sandboxed Plugin Execution  │ `sentinel_plugin`         │
└────┴──────────────────────────────────────┴────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

## 2. Granular Mathematical Formulations

### 2.1 Metamorphic Security Testing (MST) Oracles
- **Source**: Bayati et al. (IEEE TSE 2024)
- **Mathematical Relation**: For input $I$, transformation $f \in \mathcal{MR}$, and system under test $S$:
  $$S(I) = O_1, \quad S(f(I)) = O_2 \implies \mathcal{R}(O_1, O_2) = \text{True}$$
- **76 Web Metamorphic Relations Catalog**:
  1. *Syntactic Equivalence*: Reordering URL query parameters, whitespace injection in non-semantic JSON values.
  2. *Encoding Idempotence*: Full ASCII URL hex encoding (`%20` vs `+`), Unicode normalization forms (NFC vs NFD).
  3. *Semantic Comment Injection*: Appending SQL comments (`-- -`, `/* */`), injecting idempotent HTML comments (`<!-- -->`).
  4. *Authentication Invariance*: Shuffling non-session cookies, injecting benign headers (`X-Client-Trace-Id`).

### 2.2 Active Mealy Machine State Inference (L* Algorithm)
- **Algorithm**: Minimal Mealy Machine $M = (Q, q_0, \Sigma, \Gamma, \delta, \lambda)$ inferred via observation table $(S, E, T)$.
- **Hypothesis Generation**:
  - *Step Skipping*: Given valid sequence $q_0 \xrightarrow{a} q_1 \xrightarrow{b} q_2 \xrightarrow{c} q_3$, execute $q_0 \xrightarrow{a} q_1 \xrightarrow{c} ?$
  - *Step Reordering*: Execute $q_0 \xrightarrow{c} q_? \xrightarrow{a} q_?$
  - *Token Swapping*: Replace session token associated with $q_1$ with unprivileged user token.

### 2.3 5D Differential Semantic Divergence
- **Formulation**:
  $$\mathcal{D}(R_1, R_2) = w_1 (1 - \delta(s_1, s_2)) + w_2 J_{\text{header}}(H_1, H_2) + w_3 D_{\text{DOM}}(T_1, T_2) + w_4 J_{\text{JSON}}(J_1, J_2) + w_5 \mathbb{I}_{\text{Welch}}(t_1, t_2)$$
- **Welch's t-Test Statistic**:
  $$t = \frac{\bar{X}_1 - \bar{X}_2}{\sqrt{\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}}}, \quad \nu = \frac{\left(\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}\right)^2}{\frac{(s_1^2 / N_1)^2}{N_1 - 1} + \frac{(s_2^2 / N_2)^2}{N_2 - 1}}$$
  Flag timing anomaly if $p < 0.001$ and $|\bar{X}_1 - \bar{X}_2| \ge 250\text{ms}$.

### 2.4 Bayesian Test Scheduling (Expected Information Gain)
- Maintain Beta-Bernoulli beliefs $\text{Beta}(\alpha_k, \beta_k)$ for each vulnerability hypothesis $k$.
- Utility function:
  $$U(k) = w_1 \Delta H(\mathcal{G}) + w_2 \frac{\alpha_k}{\alpha_k + \beta_k} \cdot \text{Impact}(k) - w_3 \text{Cost}(k) + w_4 \text{Centrality}(k)$$
- Select next test $k^* = \arg\max_k U(k)$ via Thompson Sampling.

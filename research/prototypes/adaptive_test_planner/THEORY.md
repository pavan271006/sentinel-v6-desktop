# Theory: Adaptive Test Planner

## 1. Mathematical Formalism
The **Adaptive Test Planner** formulates vulnerability scanning as an Active Learning and Bayesian Optimal Experiment Design problem.
Given target attack surface entities $\mathcal{E}$ and a finite hypothesis space of vulnerabilities $\Theta$, the goal is to select an optimal sequence of test probes $\mathbf{t}^* = (t_1, t_2, \dots, t_K)$ that maximizes discovered true vulnerabilities while respecting a finite request budget $B$:

$$\max_{\mathbf{t}} \sum_{t \in \mathbf{t}} \mathbb{E}[\text{Risk}(t) \mid \mathcal{H}_t] \quad \text{s.t.} \quad \sum_{t \in \mathbf{t}} \text{Cost}(t) \le B$$

Where $\mathcal{H}_t$ is the historical observation filtration up to step $t$.

### Beta-Binomial Conjugate Updating
For each vulnerability class $c \in \Theta$ and parameter context $p$:
$$P(\theta_{c,p} \mid \mathcal{D}) \sim \text{Beta}(\alpha_0 + k, \beta_0 + n - k)$$
Where:
- $\alpha_0, \beta_0$ are domain-calibrated hyperpriors.
- $k$ is the count of confirmed vulnerabilities.
- $n$ is total tests executed on this parameter type.

### 6-Factor Utility Function
The expected utility $\mathcal{U}(t)$ balances 6 orthogonal factors:
1. $F_1$: Bayesian Prior Probability $\mathbb{E}[P(\theta_{c,p})]$
2. $F_2$: Normalized Shannon Parameter Entropy $H(X)$
3. $F_3$: Attack Surface Exposure Criticality $C(e)$
4. $F_4$: Observed Anomaly / Error Reflection Signal $A(e)$
5. $F_5$: Coverage Debt (penalty for redundant tests) $D(t)$
6. $F_6$: Execution Latency & Rate Budget Headroom $\text{Cost}(t)$

$$\mathcal{U}(t) = \frac{F_1 \cdot F_3 \cdot (1 + F_4) \cdot F_5 \cdot (1 + F_2)}{\max(0.01, F_6 \cdot \lambda_{\text{WAF}})}$$

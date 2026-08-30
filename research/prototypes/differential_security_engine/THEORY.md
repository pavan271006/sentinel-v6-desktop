# Theory: Differential Security Engine

## 1. Mathematical Formalism
The **Differential Security Engine** isolates vulnerability signals from background web noise by comparing response streams across 5 orthogonal testing dimensions:
1. Baseline vs Mutated Payload (Injection testing)
2. Role A vs Role B (Horizontal Authorization / IDOR / BOLA)
3. Authenticated vs Anonymous (Vertical Authorization / BFLA)
4. HTTP/1.1 vs HTTP/2 (Protocol desync)
5. Proxy vs Origin Server (Smuggling differentials)

### Semantic Divergence Metric
Let $y_1, y_2 \in \mathcal{Y}$ be response snapshots. The composite divergence $D(y_1, y_2) \in [0, 1]$ is:
$$D(y_1, y_2) = w_s \cdot \mathbb{I}(y_1.status \neq y_2.status) + w_j \cdot (1 - J(\text{AST}(y_1^*), \text{AST}(y_2^*))) + w_l \cdot \frac{|len(y_1^*) - len(y_2^*)|}{\max(len(y_1^*), len(y_2^*), 1)}$$
Where $y^*$ represents the volatile-masked response body.

### Welch's t-Test for Side-Channel Timing Separation
For latency distributions $X_1 \sim (\mu_1, \sigma_1^2)$ and $X_2 \sim (\mu_2, \sigma_2^2)$:
$$t = \frac{\bar{X}_1 - \bar{X}_2}{\sqrt{\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}}}$$
Finding confirmed iff $p < 0.001$ ($99.9\%$ statistical certainty).

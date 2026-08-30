# Theory: Causal Evidence Engine

## 1. Mathematical Formalism
The **Causal Evidence Engine** applies Pearl's Structural Causal Models (SCM) and the $do(\cdot)$ operator to differentiate genuine security vulnerabilities from ambient server errors or statistical flukes.

Let $X \in \{ \text{benign}, \text{payload} \}$ be the target parameter variable, $Y \in \{ 0, 1 \}$ be application failure / unauthorized behavior, and $\mathbf{Z}$ be the set of background environmental variables (session tokens, server load, network latency).

### Average Causal Effect (ACE)
$$ACE = \mathbb{E}[Y \mid do(X = \text{payload})] - \mathbb{E}[Y \mid do(X = \text{benign})]$$

### Probability of Necessity (PN)
$$PN = P(Y_{X=\text{benign}} = 0 \mid X = \text{payload}, Y = 1) = \frac{ACE}{P(Y=1 \mid do(X=\text{payload}))}$$

### Confounder Invariance Principle
A security proof is valid if and only if:
$$\forall z \in \mathbf{Z}, \quad do(X = \text{payload}) \perp z \quad \text{and} \quad do(X = \text{benign}) \perp z$$
Holding headers, timestamps, auth context, and payload encodings strictly constant ensures zero confounding bias.

### Cryptographic Content-Addressed Storage (CAS) Chain
Every node in the causal proof is linked to an immutable SHA-256 CAS blob. The root finding proof is bound to the Merkle tree root $\mathcal{M}$:
$$\mathcal{M} = \text{Merkle}(\text{CAS}_{\text{probe}}, \text{CAS}_{\text{control}}, \text{CAS}_{\text{delta}}, \text{CAS}_{\text{finding}})$$
Enforcing **SEC-06** (Proof Requirement) and **SEC-07** (CAS Integrity).

# Theory: Security Context Graph

## 1. Mathematical Formalism
The **Security Context Graph** $G = (V, E, \tau_V, \tau_E, \omega)$ is a typed, attributed directed multigraph where:
- $V$ is a finite set of vertices categorized by type assignment $\tau_V: V \to \mathcal{T}_V$, where $\mathcal{T}_V = \{ \text{Asset}, \text{Service}, \text{Endpoint}, \text{Parameter}, \text{Identity}, \text{Request}, \text{Response}, \text{Candidate}, \text{Finding}, \text{Evidence}, \text{OAST} \}$.
- $E \subseteq V \times V \times \mathcal{T}_E$ is the set of directed edges with relationship type $\tau_E: E \to \mathcal{T}_E$.
- $\omega: E \to \mathbb{R}^+$ defines traversal difficulty / exploitability resistance.

### Attack Path Reachability
An attack path $\pi = (v_0, e_1, v_1, \dots, e_k, v_k)$ represents an end-to-end compromise trajectory from an entry point $v_0$ to a crown jewel target $v_k$.
The reachability predicate is defined as:
$$\text{Reachable}(v_0, v_k) \iff \exists \pi \in \text{Paths}(G) : \text{len}(\pi) \le D_{max} \land \forall e \in \pi, \tau_E(e) \in \mathcal{T}_{allowed}$$

### Bottleneck Articulation Analysis
Let $\Pi(S, T)$ be the set of all valid attack paths from source set $S$ to target set $T$. The bottleneck critical index of node $u \in V \setminus (S \cup T)$ is:
$$\mathcal{B}(u) = \frac{|\{ \pi \in \Pi(S, T) \mid u \in \pi \}|}{|\Pi(S, T)|}$$
Remediating node $u$ with $\mathcal{B}(u) = 1.0$ guarantees complete disruption of all attack chains across the target subsystem.

## 2. Invariant Preservation
- **SEC-01 (Scope Enforcement)**: Out-of-scope assets are pruned at the boundary before graph ingestion.
- **SEC-07 (CAS Linkage)**: Every `FindingNode` is deterministically bound via `BOUND_TO_EVIDENCE` edge to a verifiable content-addressed storage (CAS) Merkle root.

# Theory: State Machine Inference

## 1. Mathematical Formalism
Web application business logic workflows are modeled as a Mealy Machine (Finite State Transducer) $M = (Q, \Sigma, \Gamma, \delta, \lambda, q_0)$:
- $Q$: Finite set of application workflow states.
- $\Sigma$: Input alphabet of parameterized HTTP actions (e.g. `POST /cart/add`).
- $\Gamma$: Output alphabet of HTTP status responses.
- $\delta: Q \times \Sigma \to Q$: State transition function.
- $\lambda: Q \times \Sigma \to \Gamma$: Output function.
- $q_0 \in Q$: Initial unauthenticated entry state.

### The k-Tails State Equivalence
Given a Prefix Tree Acceptor (PTA) constructed from observed execution traces $\mathcal{T} = \{ \sigma_1, \sigma_2, \dots, \sigma_N \}$, the $k$-tail of state $q \in Q$ is:
$$k\text{-tail}(q) = \{ w \in \Sigma^{\le k} \mid \delta(q, w) \text{ is defined} \}$$
States $q_1, q_2$ are merged into an equivalence class $[q]$ iff:
$$k\text{-tail}(q_1) == k\text{-tail}(q_2)$$

### State-Dependent Vulnerability Formulations
1. **Out-of-Order Transition Bypass**:
   Let $\text{Pred}(q_{\text{terminal}}) = \{ q_1, q_2, \dots, q_m \}$ be mandatory prerequisite states.
   $$\text{BypassVulnerability} \iff \exists \sigma = (a_{\text{entry}}, a_{\text{terminal}}) : \delta(q_0, \sigma) = q_{\text{terminal}} \land \lambda(q_0, \sigma) = 200$$
2. **Broken Session Revocation**:
   $$\text{SessionLifecycleFlaw} \iff \delta(q_{\text{revoked}}, a_{\text{privileged}}) \neq q_{\text{error}} \land \lambda(q_{\text{revoked}}, a_{\text{privileged}}) = 200$$

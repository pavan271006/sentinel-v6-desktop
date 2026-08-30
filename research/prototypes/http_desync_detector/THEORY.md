# Theory: HTTP Desync & Request Smuggling Detector

## 1. Mathematical & Protocol Formalism
HTTP Request Smuggling occurs when a Front-End proxy $P_{FE}$ and a Back-End origin server $P_{BE}$ disagree on message boundary demarcation (RFC 7230 §3.3.3 vs RFC 9112 §6.3 / RFC 9113 §8.2).

Let $L_{FE}(m)$ and $L_{BE}(m)$ denote the message body length parsed by the frontend and backend respectively for an ambiguous HTTP message $m$.
When $L_{FE}(m) \neq L_{BE}(m)$, a message boundary desynchronization occurs:
- If $L_{FE}(m) < L_{BE}(m)$ (CL.TE): Backend hangs waiting for $L_{BE}(m) - L_{FE}(m)$ bytes.
- If $L_{FE}(m) > L_{BE}(m)$ (TE.CL): Trailing $L_{FE}(m) - L_{BE}(m)$ bytes remain unread in the backend TCP socket buffer and are prepended to the subsequent pipeline request.

### Non-Destructive Differential Timeout Gate
To confirm desynchronization without polluting secondary real-user sessions on a production backend:
1. Dispatch probe $m$ crafted such that $L_{FE}(m) < L_{BE}(m)$.
2. Measure response time $T(m)$.
3. Compare against baseline response time $T(m_0)$.
4. Assert:
$$\text{DesyncConfirmed} \iff T(m) \ge T_{\text{threshold}} \land T(m_0) < T_{\text{baseline\_max}}$$
Where $T_{\text{threshold}} = 3500\text{ms}$ and $T_{\text{baseline\_max}} = 500\text{ms}$.

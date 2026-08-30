# SENTINEL V6: PROPRIETARY CUSTOM ENGINE CATALOG
## Comprehensive Architecture, Algorithms & Specifications for 7 Specialized Security Engines
**Document ID**: `SENTINEL-SPEC-V6-ENGINES-002`  
**Classification**: Authoritative Engine Specification & Architectural Catalog  
**Target Platform**: SENTINEL V6 Desktop Testing Workstation  
**Status**: ACTIVE — PRODUCTION SPECIFICATION

---

## 1. Executive Overview & Engine Synergy

Traditional vulnerability scanners and testing proxies treat security testing as a disconnected series of stateless HTTP transactions. This paradigm suffers from fatal limitations:
1. **Lack of Context**: Scanners test endpoints in total isolation without knowing their authentication requirements, data dependencies, or backend technology.
2. **Wasteful Brute-Force Planning**: Scanners spray static dictionary payloads without adapting to target feedback.
3. **High False Positives**: Static signature matches mistake cosmetic changes for vulnerabilities.
4. **Zero Regression Capability**: Finding retests require manual setup and lack deterministic replay proofs.
5. **Amnesia**: Scanners discard past scan insights, re-testing unchanged endpoints and re-triggering account lockouts.

To solve these architectural bottlenecks, SENTINEL V6 introduces **7 Custom Proprietary Engines**, built natively in Rust and tightly integrated via Tokio asynchronous channels, SQLite WAL persistence, and Tantivy full-text indexing:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               SENTINEL V6 CUSTOM PROPRIETARY ENGINE SUITE                         │
├────┬─────────────────────────────┬───────────────────┬────────────────────────────────────────────┤
│ ID │ Engine Name                 │ Rust Crate        │ Core Responsibility                        │
├────┼─────────────────────────────┼───────────────────┼────────────────────────────────────────────┤
│ E1 │ Security Context Graph      │ sentinel_graph    │ Multi-entity DAG modeling the engagement   │
│ E2 │ Adaptive Test Planner       │ sentinel_planner  │ Bayesian risk/cost optimal test scheduling │
│ E3 │ Differential Engine         │ sentinel_diff     │ Semantic AST & statistical divergence diff │
│ E4 │ Security Regression Graph   │ sentinel_regress  │ Retest state machine & remediation tracing │
│ E5 │ Engagement Memory           │ sentinel_memory   │ Project-isolated state, paths & audit logs │
│ E6 │ State-Machine Engine        │ sentinel_state    │ Multi-step business workflow & Mealy FSM   │
│ E7 │ Vulnerability Intel Engine  │ sentinel_vulnintel│ Tech-correlated CVE & KEV advisory matcher │
└────┴─────────────────────────────┴───────────────────┴────────────────────────────────────────────┘
```

---

## 2. Engine 1: Security Context Graph (`sentinel_graph`)

### 2.1 Theoretical Foundation & Graph Taxonomy
The **Security Context Graph** represents the entire pentest engagement as a strongly-typed Directed Acyclic Graph (DAG) $G = (V, E)$. Every HTTP transaction, discovered asset, extracted parameter, user role, and verified finding is stored as a first-class graph entity.

```
┌───────────┐       ┌─────────────┐       ┌───────────────┐
│ AssetNode ├──────>│ ServiceNode ├──────>│ EndpointNode  │
└───────────┘       └─────────────┘       └───┬───────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
            ┌───────────────┐                                   ┌───────────────┐
            │ ParameterNode │                                   │ RequestNode   │
            └───────────────┘                                   └───┬───────────┘
                                                                    │
                                                                    ▼
                                                                ┌───────────────┐
                                                                │ ResponseNode  │
                                                                └───┬───────────┘
                                                                    │
                                                                    ▼
                                                                ┌───────────────┐
                                                                │ CandidateNode │
                                                                └───┬───────────┘
                                                                    │
                                                                    ▼
                                                                ┌───────────────┐
                                                                │ FindingNode   │
                                                                └───┬───────────┘
                                                                    │
                                                                    ▼
                                                                ┌───────────────┐
                                                                │ EvidenceNode  │
                                                                └───────────────┘
```

### 2.2 Core Rust Data Structures
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GraphNode {
    Asset { id: Uuid, fqdn: String, ip: IpAddr },
    Service { id: Uuid, asset_id: Uuid, port: u16, tls: bool },
    Endpoint { id: Uuid, service_id: Uuid, method: HttpMethod, path: String },
    Parameter { id: Uuid, endpoint_id: Uuid, name: String, location: ParamLocation },
    Identity { id: Uuid, role_name: String, token_id: SecretReference },
    Request { id: Uuid, endpoint_id: Uuid, raw_digest: Blake3Hash, timestamp: i64 },
    Response { id: Uuid, request_id: Uuid, status: u16, raw_digest: Blake3Hash },
    Candidate { id: Uuid, vuln_class: VulnClass, confidence: f32, endpoint_id: Uuid },
    Finding { id: Uuid, candidate_id: Uuid, severity: Severity, title: String },
    Evidence { id: Uuid, finding_id: Uuid, merkle_root: Blake3Hash, cas_key: String },
    OastCallback { id: Uuid, token_hash: String, protocol: String, remote_ip: IpAddr },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GraphEdge {
    Exposes { from: Uuid, to: Uuid },
    EmitsRequest { from: Uuid, to: Uuid },
    YieldsResponse { from: Uuid, to: Uuid },
    RequiresIdentity { from: Uuid, to: Uuid },
    ConfirmsFinding { from: Uuid, to: Uuid },
    BoundToEvidence { from: Uuid, to: Uuid },
}
```

### 2.3 Storage & Query Performance
- **SQLite CTE Schema**: Nodes and edges are stored in normalized relational tables with indexed foreign keys.
- **Transitive Reachability Query**:
  ```sql
  WITH RECURSIVE AttackPath(node_id, depth) AS (
      SELECT node_id, 0 FROM graph_nodes WHERE node_id = :target_id
      UNION ALL
      SELECT e.from_node, ap.depth + 1
      FROM graph_edges e
      JOIN AttackPath ap ON e.to_node = ap.node_id
      WHERE ap.depth < 10
  )
  SELECT DISTINCT node_id FROM AttackPath;
  ```
- **Performance Budget**: Query latency $<5\text{ms}$ for paths up to depth 10 across 100,000 nodes.
- **Invariant**: `SEC-07` Cryptographic CAS linkage strictly enforced on every `FindingNode`.

---

## 3. Engine 2: Adaptive Test Planner (`sentinel_planner`)

### 3.1 Objective Function & Bayesian Optimization
The **Adaptive Test Planner** replaces blind linear scanning with an explainable Bayesian optimization engine. It ranks candidate tests using an expected information-gain utility function:

$$\mathcal{U}(t) = \frac{\mathbb{E}[\text{Risk}(t)] \cdot \text{Confidence}(\text{Tech}(e), \text{Vuln}(t)) \cdot \text{Impact}(\text{Vuln}(t))}{\text{LatencyEstimate}(e) \cdot \text{Cost}(t) + \lambda \cdot \text{WAFRisk}(e)}$$

### 3.2 Decision Logic & Explainability ("WHY" Proofs)
Every scheduled test vector generated by the planner includes structured explanation metadata:
```json
{
  "test_id": "TEST-SQLI-0042",
  "endpoint": "POST /api/v1/checkout",
  "target_parameter": "coupon_code",
  "chosen_vector": "Time-Based Blind PostgreSQL",
  "reasoning": {
    "technology_fingerprint": "PostgreSQL 15.2 (Confidence: 0.96)",
    "parameter_classification": "Dynamic string concatenation suspect",
    "precondition_verified": "User session active (Role: Customer)",
    "rate_limit_headroom": "180 req/min remaining",
    "expected_cost": "2 requests (5.0s timeout upper bound)"
  }
}
```

### 3.3 Dynamic Rate Limiting & Backpressure
Maintains a token bucket per host. Automatically throttles or pauses tests when latency increases by $>300\%$ or when HTTP 429 / WAF challenges are detected.

---

## 4. Engine 3: Differential Security Engine (`sentinel_differential`)

### 4.1 Multi-Dimensional Divergence Analysis
The **Differential Security Engine** computes semantic and statistical deltas across 5 orthogonal testing dimensions:

```
                      ┌────────────────────────────────────────┐
                      │      DIFFERENTIAL COMPARISON AXES      │
                      ├────────────────────────────────────────┤
                      │ 1. Baseline vs Mutated Payload         │
                      │ 2. Role A vs Role B (BOLA / IDOR)      │
                      │ 3. Authenticated vs Anonymous (BFLA)   │
                      │ 4. HTTP/1.1 vs HTTP/2 (Desync)         │
                      │ 5. Proxy vs Origin Server (Smuggling)  │
                      └────────────────────────────────────────┘
```

### 4.2 Algorithmic Pipeline
1. **Dynamic Token Masking**: Computes Shannon entropy on string tokens; masks UUIDs, timestamps, nonces ($\text{Entropy} > 3.8$).
2. **AST Myers Diffing**: Computes structural AST tree differences for JSON/XML bodies.
3. **Statistical Timing Analysis (Welch's $t$-test & Mann-Whitney $U$ test)**:
   For time-based blind vulnerabilities (SQLi, SSTI, Command Injection), asserts statistical timing divergence between baseline distribution $T_{\text{base}}$ and sleep-injected distribution $T_{\text{sleep}}$:
   $$t = \frac{\bar{X}_1 - \bar{X}_2}{\sqrt{\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}}} \quad \implies \quad p < 10^{-4}$$

---

## 5. Engine 4: Security Regression Graph (`sentinel_regression`)

### 5.1 Retest State Machine
Tracks verified vulnerabilities throughout their remediation lifecycle:

```
┌──────────────┐     Developer Deploys Patch     ┌───────────────────┐
│  VULNERABLE  ├────────────────────────────────>│ RETEST_DISPATCHED │
└──────────────┘                                 └─────────┬─────────┘
                                                           │
                      ┌────────────────────────────────────┴────────────────────────────────────┐
                      ▼                                                                         ▼
            ┌───────────────────┐                                                     ┌───────────────────┐
            │   VERIFIED_FIXED  │ (Safe Oracle Confirmed)                             │     REGRESSED     │ (Exploit Still Triggers)
            └───────────────────┘                                                     └───────────────────┘
```

### 5.2 Deterministic Replay Specification
To retest a finding, the engine reconstructs the exact historical HTTP transaction sequence from the Merkle CAS record:
1. Re-authenticates the required testing identity.
2. Emits positive control request: asserts target vulnerability does not reproduce.
3. Emits negative baseline request: asserts normal functionality remains intact.
4. Generates an automated **Remediation Attestation Report** with before/after CAS proofs.

---

## 6. Engine 5: Engagement Memory (`sentinel_memory`)

### 6.1 State Preservation & Destructive Action Safeguards
The **Engagement Memory Engine** maintains a persistent, project-isolated state database in SQLite WAL:
- **Tested Paths Registry**: Records all executed test vectors per endpoint, eliminating redundant duplicate tests.
- **Destructive Action Gate (`SEC-02` / `SEC-05`)**: Flags potentially destructive endpoints (`/account/delete`, `/password/reset`, `/transfer/funds`) and blocks automated scanning without explicit human operator confirmation.
- **Lossless Cryptographic Audit Journal (`SEC-12`)**: Logs every outbound socket write with SHA-256 payload digests, operator identity, and millisecond timestamps.

---

## 7. Engine 6: State-Machine Engine (`sentinel_state`)

### 7.1 Finite State Transducer for Business Workflows
The **State-Machine Engine** models complex, multi-stage application workflows as a Mealy Machine $M = (Q, \Sigma, \Gamma, \delta, \lambda, q_0)$:
- $Q$: Distinct application states (e.g. `CART_EMPTY`, `ITEM_ADDED`, `ADDRESS_ENTERED`, `PAYMENT_PENDING`, `ORDER_COMPLETE`).
- $\Sigma$: HTTP user actions (e.g. `POST /cart/add`, `POST /checkout/address`, `POST /checkout/pay`).
- $\Gamma$: Server state responses.
- $\delta: Q \times \Sigma \to Q$: State transition function.

### 7.2 Automated Business Logic Flaw Discovery
1. **Out-of-Order Transition Probing**: Attempts to jump directly from `ITEM_ADDED` to `ORDER_COMPLETE` skipping `PAYMENT_PENDING`.
2. **Session Swapping**: Initiates a workflow as User A and submits final checkout with User B’s session token.
3. **Parameter Tampering in Transit**: Modifies price or quantity parameters in intermediate states after initial validation.

---

## 8. Engine 7: Vulnerability Intelligence Engine (`sentinel_vuln_intel`)

### 8.1 Technology-Correlated Advisory Ingestion
The **Vulnerability Intelligence Engine** continuously correlates target technology fingerprints with vulnerability advisory feeds:
- **CISA Known Exploited Vulnerabilities (KEV)**
- **NVD / CVE Feeds**
- **GitHub Security Advisories (GHSA)**
- **Vendor-Specific Advisories (GitLab, WordPress, Drupal, Spring)**

### 8.2 The Verification-First Protocol
Unlike standard CVE scanners that report vulnerabilities based purely on version banners, SENTINEL enforces the **Verification-First Rule**:
```
Advisory Matched (e.g. CVE-2023-XXXX)
               │
               ▼
Precondition Check (Technology & Version Confirmed in Context Graph)
               │
               ▼
Safe Non-Destructive Probe Emitted (Metamorphic syntactic check)
               │
               ▼
Oracle Verified? ───> [NO]  ──> Flag as "Potential (Unverified)", Zero Finding
               │
              [YES]
               │
               ▼
Capture Merkle CAS Proof ──> Promoted to CONFIRMED FINDING
```

---

# 9. Engine Integration & Performance Specification

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ENGINE PERFORMANCE & RESOURCE BUDGETS                                  │
├──────────────────────────┬──────────────────────┬──────────────────────┬───────────────────────────────┤
│ Engine Subsystem         │ P50 Latency          │ P95 Latency          │ Max Memory Allocation         │
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────────────────────┤
│ Security Context Graph   │ 1.2 ms               │ 4.8 ms               │ 64 MB (SQLite CTE + Tantivy)  │
│ Adaptive Test Planner    │ 0.8 ms               │ 2.4 ms               │ 32 MB                         │
│ Differential Engine      │ 2.1 ms               │ 8.5 ms               │ 48 MB                         │
│ Security Regression Graph│ 1.5 ms               │ 5.2 ms               │ 24 MB                         │
│ Engagement Memory        │ 0.4 ms               │ 1.8 ms               │ 40 MB                         │
│ State-Machine Engine     │ 3.0 ms               │ 11.2 ms              │ 32 MB                         │
│ Vulnerability Intel      │ 1.0 ms               │ 3.5 ms               │ 50 MB (Embedded DuckDB/SQLite)│
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────────────────────┤
│ TOTAL CORE ENGINE SUITE  │ < 10 ms              │ < 35 ms              │ < 290 MB (Well under 500MB)   │
└──────────────────────────┴──────────────────────┴──────────────────────┴───────────────────────────────┘
```

All 7 engines are designed with **zero cross-thread locks** in hot paths, communicating via Tokio unbounded/bounded MPSC channels and lock-free atomic queues.

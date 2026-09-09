# CANDIDATE ARCHITECTURES AND FORMAL SYSTEMS SPECIFICATION
## Part 1: The Three Candidate Architectures for Next-Generation Evidence-Driven SQL Injection Detection

---

### Executive Architectural Scope & Formal Purpose

This document provides the exhaustive formal architectural specification for three fundamentally distinct candidate architectures designed for the Next-Generation Evidence-Driven SQL Injection Detection Engine. In accordance with Section 63 (Item 7) of the Master Research Specification, each architecture embodies a radically distinct design philosophy, distinct mathematical primitives, distinct execution loops, distinct internal data structures, and fundamentally divergent optimization trade-offs.

---

## 1. Architectural Paradigm Overview & Epistemological Taxonomy

To transcend the fragile, heuristic, and payload-bloated limitations of legacy scanners (e.g., standard sqlmap regex matching or libinjection C-state tokenizers), we formalize the detection problem across three orthogonal epistemic foundations:

```
+---------------------------------------------------------------------------------------------------------+
|                                    EPISTEMOLOGICAL TAXONOMY OF DETECTION                               |
+------------------------------------+------------------------------------+-------------------------------+
| ARCHITECTURE A: PAL-GME            | ARCHITECTURE B: DMC-SMT            | ARCHITECTURE C: DSS-BIG       |
| "Probabilistic Active Learning &   | "Deterministic Multi-Oracle Causal | "Differential Semantic        |
| Grammar-Metamorphic Engine"        | DAG & Bounded SMT Solver"          | Shadowing & Behavioral Invar."|
+------------------------------------+------------------------------------+-------------------------------+
| * Paradigm: Information-Theoretic  | * Paradigm: Formal Causal Logic &  | * Paradigm: Twin Differential |
|   Active Search & Bayesian Belief  |   First-Order Constraint Solving   |   Mirroring & Invariant Graph |
| * Target: Mutual Information Gain  | * Target: Provable Counterfactuals | * Target: Semantic No-Op      |
|   I(θ; Y) over Injection Context θ |   via Pearl's do(·) Calculus       |   Invariance Delta (ΔBIG)     |
| * Output: Posterior Distribution   | * Output: Cryptographic Proof      | * Output: Behavioral Invariant|
|   P(Vulnerable | E) with Credible  |   DAG with CAS Merkle Attestation  |   Violation Clustering Score  |
|   Intervals                        |   (P = 1.0 or 0.0)                 |   with Dynamic Drift Filter   |
| * Strength: Rapid convergence in   | * Strength: Absolute zero false    | * Strength: Extreme noise     |
|   high-dimensional search spaces   |   positives; provable evidence     |   immunity & stateful tracking|
+------------------------------------+------------------------------------+-------------------------------+
```

---

## 2. Architecture A: "Probabilistic Active-Learning & Grammar-Metamorphic Engine" (PAL-GME)

### 2.1 Design Philosophy & Theoretical Foundation

The **Probabilistic Active-Learning & Grammar-Metamorphic Engine (PAL-GME)** models SQL injection vulnerability identification as an optimal sequential experimental design problem on a non-stationary discrete-continuous manifold. Rather than executing hardcoded payload lists, PAL-GME maintains an explicit probability distribution $P(\theta)$ over possible injection contexts $\theta \in \Theta$, where $\Theta$ spans:
$$\Theta = \{\text{STRING\_LITERAL\_SINGLE}, \text{STRING\_LITERAL\_DOUBLE}, \text{NUMERIC\_SCALAR}, \text{ORDER\_BY\_CLAUSE}, \text{COLUMN\_NAME}, \text{TABLE\_NAME}, \text{JSON\_EXTRACT}, \text{XML\_ATTR}, \text{SUBQUERY\_WHERE}\}$$

At each step $t$, the scheduler computes the Bayesian Active Learning by Disagreement (BALD) acquisition function to select the probe action $a_t^* \in \mathcal{A}$ that maximizes expected mutual information $I(\theta; Y \mid a)$ between the unknown parameter context $\theta$ and the multivariable observation vector $Y_t$:
$$a_t^* = \arg\max_{a \in \mathcal{A}} \left[ H(Y \mid a, \mathcal{D}_{1:t-1}) - \mathbb{E}_{P(\theta \mid \mathcal{D}_{1:t-1})} [H(Y \mid a, \theta)] \right]$$

Probes are synthesized dynamically by a **Grammar-Metamorphic Synthesizer** that traverses a stochastic attribute grammar $\mathcal{G}_{\text{SQL}}$ to construct pairs of semantically equivalent ($Q_1 \equiv Q_2$) and semantically divergent ($Q_1 \not\equiv Q_2$) AST mutations.

```
+----------------------------------------------------------------------------------------------------+
|                      PAL-GME ARCHITECTURAL COMPONENT INTERACTION                                   |
+----------------------------------------------------------------------------------------------------+
                                       +--------------------------------+
                                       |     Target Endpoint & Param    |
                                       +--------------------------------+
                                                       |
                                                       v
+------------------------+             +--------------------------------+             +------------------------+
|  Continuous Likelihood | <---------- | Bayesian Active-Learning Core  | ----------> |  Context Prior State   |
|  Evaluator (CLE)       |             | (BALD Acquisition Scheduler)   |             |  Dirichlet-Categorical |
+------------------------+             +--------------------------------+             +------------------------+
            ^                                          |                                          |
            |                                          | Action Request                           |
            |                                          v                                          v
+------------------------+             +--------------------------------+             +------------------------+
| Multivariate Response  |             | Grammar-Metamorphic Synthesizer| <---------- | Stochastic Attribute   |
| Vector Y: [ΔSize,      |             | (AST Mutation Generator)       |             | Grammar G_SQL          |
| DOM-Dist, Status, Lat] |             +--------------------------------+             +------------------------+
+------------------------+                             |
            ^                                          | Probing Pairs (Q_base, Q_mut)
            |                                          v
+------------------------------------------------------------------------------------------------------+
|                                   Asynchronous HTTP Pipeline Engine                                 |
+------------------------------------------------------------------------------------------------------+
                                                       |
                                                       v
                                          [Target Web Application / DBMS]
```

```mermaid
graph TD
    A[Target Input Parameter] --> B[Initialize Prior Distribution P_0(θ)]
    B --> C{Compute Entropy H(θ)}
    C -->|H(θ) > Threshold| D[Select Action a* via BALD Acquisition]
    D --> E[Grammar-Metamorphic Synthesizer]
    E --> F[Generate Metamorphic Query Pair Q_eq, Q_diff]
    F --> G[Execute Probes via HTTP Pipeline]
    G --> H[Observe Multivariate Vector Y]
    H --> I[Continuous Likelihood Evaluator]
    I --> J[Bayesian Posterior Update P_t(θ | Y)]
    J --> K{Stopping Condition Met?}
    K -->|No| C
    K -->|P(Vuln) > τ_high| L[Emit Confirmed Vulnerability Record]
    K -->|P(Safe) > τ_low or Budget Exhausted| M[Emit Inconclusive / Safe Classification]
```

### 2.2 Mathematical Formulation & Bayesian Inference Engine

#### 2.2.1 Parameter Context Prior
Let $\theta \in \{1, \dots, K\}$ denote the discrete injection context state ($K = 9$). We define the prior distribution as a Dirichlet-Multinomial conjugate structure:
$$\mathbf{p} = (p_1, \dots, p_K) \sim \text{Dirichlet}(\alpha_1, \dots, \alpha_K)$$
$$P(\theta = k \mid \mathbf{p}) = p_k$$
Prior hyperparameters $\boldsymbol{\alpha}_0$ are seeded from static parameter reflection and encoding analysis (e.g., parameter reflection inside HTML quotes vs. raw reflection).

#### 2.2.2 Likelihood Function Formulation
The observation vector $Y = (y_{\text{status}}, y_{\text{size}}, y_{\text{dom}}, y_{\text{lat}}, y_{\text{err}})$ is modeled under a conditional mixture model:
$$P(Y \mid \theta = k, a) = P(y_{\text{err}} \mid \theta = k, a) \cdot \mathcal{N}(y_{\text{size}}; \mu_{k,a}^{\text{size}}, \sigma_{k,a}^2) \cdot \text{Beta}(y_{\text{dom}}; \alpha_{k,a}^{\text{dom}}, \beta_{k,a}^{\text{dom}}) \cdot \text{InvGaussian}(y_{\text{lat}}; \mu_{k,a}^{\text{lat}}, \lambda_{k,a})$$
where:
- $y_{\text{dom}} \in [0, 1]$ is the normalized Tree Edit Distance (Zhang-Shasha metric) relative to baseline DOM.
- $y_{\text{lat}}$ is the server latency measured under high-precision monotonic clock.
- $y_{\text{err}}$ is the categorical error-token match probability.

#### 2.2.3 Information Gain & Stopping Criteria
The posterior belief after observing sequence $\mathcal{D}_t = \{(a_1, Y_1), \dots, (a_t, Y_t)\}$ is updated via Bayes' rule:
$$P(\theta = k \mid \mathcal{D}_t) = \frac{P(Y_t \mid \theta = k, a_t) P(\theta = k \mid \mathcal{D}_{t-1})}{\sum_{j=1}^K P(Y_t \mid \theta = j, a_t) P(\theta = j \mid \mathcal{D}_{t-1})}$$

**Stopping Condition**:
The exploration terminates at step $t^*$ when either:
1. $P(\theta \in \Theta_{\text{injectable}} \mid \mathcal{D}_t) \ge \tau_{\text{high}} = 0.9995$ (Classification: `VULNERABLE` with context $\theta^* = \arg\max_\theta P(\theta \mid \mathcal{D}_t)$).
2. $P(\theta = \text{SAFE\_UNINJECTABLE} \mid \mathcal{D}_t) \ge \tau_{\text{low}} = 0.9990$ (Classification: `SAFE`).
3. Total request count $t \ge B_{\text{max}}$ (Classification: `INCONCLUSIVE_BUDGET_EXHAUSTED`).

### 2.3 Grammar Metamorphic Synthesizer

The synthesizer implements a Stochastic Context-Free Grammar $\mathcal{G}_{\text{SQL}} = (V_N, V_T, P, S, \mathbf{w})$ where $P$ is a set of weighted production rules $A \xrightarrow{w} \alpha$.

```
Non-Terminals:
  S           ::= <PrefixClosure> <Expression> <SuffixComment>
  PrefixClosure ::= "" | "'" | "\"" | "')" | "'))" | "0" | "1)"
  Expression  ::= <BooleanExpr> | <ArithmeticExpr> | <TimeDelayExpr> | <SubqueryExpr>
  BooleanExpr ::= <Tautology> | <Contradiction>
  Tautology   ::= " OR " <ScalarEq> | " AND " <ScalarEq> | " UNION SELECT " <ProjList>
  ScalarEq    ::= "'1'='1'" | "1=1" | "ASCII('a')=97" | "LENGTH('sqli')=4"
  Contradiction::= "'1'='2'" | "1=2" | "ASCII('a')=98"
  SuffixComment::= "-- " | "#" | "/*" | " AND '1'='1" | ""
```

**Metamorphic Relations**:
Given a hypothesis $\theta$, the synthesizer generates a pair of queries $(a_{\text{true}}, a_{\text{false}})$ satisfying:
$$\text{Semantics}(Q \circ a_{\text{true}}) = \text{Semantics}(Q_{\text{baseline}})$$
$$\text{Semantics}(Q \circ a_{\text{false}}) \neq \text{Semantics}(Q_{\text{baseline}})$$
If the underlying parameter is vulnerable and injected into context $\theta$, the metamorphic property mandates:
$$\text{Dist}(Y(a_{\text{true}}), Y_{\text{baseline}}) < \epsilon \quad \land \quad \text{Dist}(Y(a_{\text{false}}), Y_{\text{baseline}}) > \delta$$

### 2.4 Data Structures & Memory Layouts

```rust
// Concrete Rust representation of PAL-GME core data structures

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum InjectionContext {
    StringLiteralSingleQuote = 0,
    StringLiteralDoubleQuote = 1,
    NumericScalar            = 2,
    OrderByClause            = 3,
    ColumnNameIdentifier     = 4,
    TableNameIdentifier      = 5,
    JsonExtractOperator      = 6,
    XmlAttributeOperator     = 7,
    SubqueryWhereClause      = 8,
    SafeUninjectable         = 9,
}

#[derive(Debug, Clone)]
pub struct DirichletPrior {
    pub alphas: [f64; 10], // Dirichlet concentration parameters
    pub total_concentration: f64,
}

#[derive(Debug, Clone)]
pub struct ObservationVector {
    pub http_status: u16,
    pub body_byte_length: usize,
    pub dom_tree_edit_distance: f64, // Normalized [0.0, 1.0]
    pub round_trip_latency_us: u64,  // Monotonic microseconds
    pub error_pattern_score: f64,    // Match likelihood
    pub reflection_offset: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct MetamorphicProbeAction {
    pub action_id: u32,
    pub target_context: InjectionContext,
    pub payload_true: String,
    pub payload_false: String,
    pub comment_style: &'static str,
    pub expected_info_gain_bits: f64,
}

#[derive(Debug, Clone)]
pub struct PalGmeState {
    pub parameter_name: String,
    pub prior: DirichletPrior,
    pub posterior_probabilities: [f64; 10],
    pub probe_history: Vec<(MetamorphicProbeAction, ObservationVector)>,
    pub total_shannon_entropy: f64,
    pub iteration_count: usize,
    pub max_budget: usize,
}
```

### 2.5 Formal State Machine & Execution Loop

```
+----------------------------------------------------------------------------------------------------+
|                                    PAL-GME STATE MACHINE                                           |
+----------------------------------------------------------------------------------------------------+

     [INIT]
       |  (Baseline Calibration Request)
       v
  [CALIBRATED] <---------------------------------------------+
       |                                                     |
       | Compute H(θ) & BALD Acquisition                     |
       v                                                     |
  [PROBE_GENERATING]                                         |
       | Generate Metamorphic Pair                           |
       v                                                     |
  [AWAITING_RESPONSE]                                        |
       | HTTP Response Received                              |
       v                                                     |
  [EVALUATING_LIKELIHOOD]                                    |
       | Multivariate Likelihood P(Y|θ, a)                   |
       v                                                     |
  [POSTERIOR_UPDATE] ----------------------------------------+
       |
       +---> (P(θ_inj) >= 0.9995) -----------------------------> [STATE_VULNERABLE]
       |
       +---> (P(θ_safe) >= 0.9990) ----------------------------> [STATE_SAFE]
       |
       +---> (Iter >= MaxBudget) -----------------------------> [STATE_INCONCLUSIVE]
```

```
Algorithm 1: PAL-GME Execution Loop
Input: Target Parameter p, URL u, Budget B_max, Thresholds τ_high, τ_low
Output: VulnerabilityVerdict (Vulnerable, Safe, Inconclusive) + Credibility Record

1:  Y_base ← ExecuteProbe(u, p, BaselineValue)
2:  state ← InitPalGmeState(p, PriorFromReflection(p, Y_base))
3:  while state.iteration_count < B_max do
4:      H ← ComputeShannonEntropy(state.posterior_probabilities)
5:      if state.posterior_probabilities[SafeUninjectable] ≥ τ_low then
6:          return Verdict(SAFE, state.posterior_probabilities)
7:      end if
8:      for each θ in InjectionContext do
9:          if state.posterior_probabilities[θ] ≥ τ_high then
10:             return Verdict(VULNERABLE, θ, state.posterior_probabilities)
11:         end if
12:     end for
13:     a* ← ArgMax_{a ∈ Candidates} ComputeMutualInformation(state, a)
14:     (Q_true, Q_false) ← SynthesizeMetamorphicPair(a*.target_context, G_SQL)
15:     Y_true ← ExecuteProbe(u, p, Q_true)
16:     Y_false ← ExecuteProbe(u, p, Q_false)
17:     Y_obs ← ExtractObservation(Y_true, Y_false, Y_base)
18:     state.posterior_probabilities ← BayesianUpdate(state.posterior_probabilities, a*, Y_obs)
19:     state.iteration_count ← state.iteration_count + 1
20: end while
21: return Verdict(INCONCLUSIVE_BUDGET_EXHAUSTED, state.posterior_probabilities)
```

---

## 3. Architecture B: "Deterministic Multi-Oracle Causal DAG & Bounded SMT Solver" (DMC-SMT)

### 3.1 Design Philosophy & Theoretical Foundation

The **Deterministic Multi-Oracle Causal DAG & Bounded SMT Solver (DMC-SMT)** rejects purely statistical heuristic scoring in favor of **formal causal verification** and **automated theorem proving**. DMC-SMT operates on the foundational principle that an injection vulnerability is an unconstrained syntactic degree of freedom in the downstream SQL AST that is causally dependent on user-controlled input $X$.

DMC-SMT unites two rigorous formalisms:
1. **Pearl's Structural Causal Models (SCM) & $do(\cdot)$ Calculus**: Every parameter is evaluated by testing interventional counterfactuals:
$$P(Y \mid do(X = \text{payload})) \neq P(Y \mid do(X = \text{control}))$$
demonstrating that the variation in server state $Y$ is causally determined *only* through AST syntax tree mutation, ruling out confounding application-layer validation rules.
2. **Bounded SMT Clause Solving (Z3 / Custom Bit-Vector Theory)**: Instead of guessing string prefixes and quotes, DMC-SMT constructs a first-order logic constraint system over string operations to solve for exact minimal prefix-closure and suffix-truncation characters:
$$\Phi_{\text{AST}}(Q_{\text{prefix}} \circ X \circ Q_{\text{suffix}}) \models \text{Valid}(\text{Dialect})$$

```
+----------------------------------------------------------------------------------------------------+
|                      DMC-SMT ARCHITECTURAL COMPONENT INTERACTION                                   |
+----------------------------------------------------------------------------------------------------+
                                       +--------------------------------+
                                       |   Parameter AST Causal DAG     |
                                       +--------------------------------+
                                                       |
                                                       v
+------------------------+             +--------------------------------+             +------------------------+
| Bounded SMT Boundary   | <---------> | Causal Intervention Engine     | ----------> | Cryptographic Merkle-  |
| Solver (Z3 Theory API) |             | (Pearl do(·) Operator Planner) |             | CAS Evidence Engine    |
+------------------------+             +--------------------------------+             +------------------------+
                                                       |
                                                       | Interventional Batches (do(X=x_i))
                                                       v
+------------------------------------------------------------------------------------------------------+
|                                   Decoupled 5-Oracle Consensus Array                                |
|  +--------------------+ +--------------------+ +--------------------+ +---------------------------+  |
|  | Syntax Diff Oracle | | Boolean Tautology  | | Invariant Relation | | Time-Delay SPRT Oracle    |  |
|  | O_syn              | | O_bool             | | O_rel              | | O_time                    |  |
|  +--------------------+ +--------------------+ +--------------------+ +---------------------------+  |
|  +------------------------------------------------------------------------------------------------+  |
|  | Error Signature Invariant Oracle (O_err)                                                       |  |
|  +------------------------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
                                                       |
                                                       v
+------------------------------------------------------------------------------------------------------+
|                     Immutable Merkle Proof DAG (BLAKE3 CAS Root Attestation)                         |
+------------------------------------------------------------------------------------------------------+
```

```mermaid
graph TD
    A[Target Input Parameter X] --> B[Generate Causal DAG Structural Hypothesis]
    B --> C[Bounded SMT Boundary Closure Solver]
    C -->|Solve Boundary Constraints| D[Generate Interventional Payloads do(X=x_i)]
    D --> E[Dispatch to Decoupled 5-Oracle Array]
    E --> F1[O_syn: Syntax Differential]
    E --> F2[O_bool: Boolean Tautology Pair]
    E --> F3[O_rel: Invariant Relational Count]
    E --> F4[O_time: Time-Delay Wald SPRT]
    E --> F5[O_err: Error-Signature Invariant]
    F1 & F2 & F3 & F4 & F5 --> G[Consensus & Causal Counterfactual Verification]
    G -->|Consensus Formed| H[Construct Merkle-CAS Proof Tree]
    H --> I[BLAKE3 Content-Addressed Evidence Root Certificate]
    G -->|Hypothesis Refuted| J[Transition to Next SMT Clause State]
```

### 3.2 Formal Causal DAG & Counterfactual Verification

Let the structural causal model $\mathcal{M}$ be defined over endogenous variables $V = \{X, S, Q, R, Y\}$ and exogenous noise variables $U = \{U_X, U_S, U_Q, U_R, U_Y\}$:
- $X$: Raw parameter value transmitted over HTTP.
- $S$: Application-level string sanitation / sanitization transform: $S = f_S(X, U_S)$.
- $Q$: SQL statement AST generated by application: $Q = f_Q(S, U_Q)$.
- $R$: Database engine execution result set: $R = f_R(Q, U_R)$.
- $Y$: HTTP response returned to client: $Y = f_Y(R, U_Y)$.

```
   (U_S)           (U_Q)           (U_R)           (U_Y)
     |               |               |               |
     v               v               v               v
    [X] --------->  [S] --------->  [Q] --------->  [R] ---------> [Y]
 (Input)         (Sanitize)       (SQL AST)      (DB Result)    (Response)
```

**Causal Invariant of Injection**:
An injection vulnerability exists if and only if there exists an intervention $do(X = x_1)$ and $do(X = x_2)$ such that:
$$\text{AST}(f_Q(f_S(x_1))) \neq \text{AST}(f_Q(f_S(x_2))) \quad \land \quad \text{StructuralParent}(x_1) \neq \text{StructuralParent}(x_2)$$
where $\text{StructuralParent}(x)$ denotes the enclosing AST node type in the database grammar parser.

### 3.3 Bounded SMT Boundary Closure Solver

DMC-SMT utilizes an SMT-LIB2 theory solver (over String, Bit-Vector, and Regular Expression logics) to derive minimal context escapes.

**SMT Constraint Formulation**:
Let $\Sigma$ be the dialect alphabet. Let $C_{\text{prefix}}$ be the hypothetical prefix string in the application code, and $C_{\text{suffix}}$ be the hypothetical suffix string. The solver searches for assignments to $(C_{\text{prefix}}, C_{\text{suffix}}, \tau_{\text{escape}})$ satisfying:
$$\Phi_{\text{closure}} \equiv \forall x \in \text{Payloads}, \quad \text{GrammarParse}(\text{Concat}(C_{\text{prefix}}, \tau_{\text{escape}}(x), C_{\text{suffix}})) = \text{SAT}$$
$$\Phi_{\text{minimal}} \equiv \text{Length}(\tau_{\text{escape}}) \le K_{\text{bound}} = 8$$

```smt2
; DMC-SMT Z3 Clause Example for String Literal Escape
(declare-const prefix String)
(declare-const payload String)
(declare-const suffix String)
(assert (= payload "' OR 1=1 -- "))
(assert (str.prefixof "SELECT * FROM users WHERE user = '" prefix))
(assert (str.suffixof "' AND status = 1" suffix))
(assert (str.in.re (str.++ prefix payload suffix) (re.compile "SELECT.*OR.*--.*")))
(check-sat)
(get-model)
```

### 3.4 Decoupled 5-Oracle Array & Consensus Function

```
+----------------------------------------------------------------------------------------------------+
|                                    DECOUPLED 5-ORACLE SPECIFICATION                                |
+------------------------------------+---------------------------------------------------------------+
| Oracle                             | Mathematical Decision Rule                                    |
+------------------------------------+---------------------------------------------------------------+
| 1. Syntax Differential (O_syn)     | O_syn = 1 iff (Resp(Q_valid) == Resp(Q_base)) &&             |
|                                    |               (Resp(Q_syntax_err) == ErrorState)             |
| 2. Boolean Tautology (O_bool)      | O_bool = 1 iff (Resp(Q_true) == Resp(Q_base)) &&            |
|                                    |                (Resp(Q_false) == DiffState)                  |
| 3. Invariant Relational (O_rel)    | O_rel = 1 iff Count(Resp(Q_union_N)) == N &&                 |
|                                    |               Count(Resp(Q_union_N+1)) == SyntaxErr           |
| 4. Time-Delay SPRT (O_time)        | O_time = 1 iff Wald_SPRT(Λ_t) >= A_threshold                  |
| 5. Error-Signature Invariant (O_err)| O_err = 1 iff MatchesRegex(Body, DialectRegex[DBMS]) &&      |
|                                    |               CausallyCoupledWith(Payload_Token)              |
+------------------------------------+---------------------------------------------------------------+
```

#### 3.4.1 Wald's Sequential Probability Ratio Test (SPRT) for Time-Delay Oracle
To prevent false positives from transient network latency jitter, $\mathcal{O}_{\text{time}}$ computes the log-likelihood ratio under Wald's SPRT:
$$\Lambda_n = \sum_{i=1}^n \ln \frac{f(t_i \mid H_1: \mu = \mu_{\text{baseline}} + \Delta_{\text{delay}})}{f(t_i \mid H_0: \mu = \mu_{\text{baseline}})}$$
- Accept $H_1$ (`INJECTION_CONFIRMED`) if $\Lambda_n \ge \ln\left(\frac{1 - \beta}{\alpha}\right)$ (with false alarm rate $\alpha = 10^{-5}$, miss rate $\beta = 10^{-4}$).
- Accept $H_0$ (`SAFE_NORMAL_LATENCY`) if $\Lambda_n \le \ln\left(\frac{\beta}{1 - \alpha}\right)$.

#### 3.4.2 Consensus Decision Function
The multi-oracle consensus verdict $\mathcal{V}$ is computed via deterministic majority with mandatory hard-oracle veto:
$$\mathcal{V} = \begin{cases}
\text{VULNERABLE}(\text{Context}, \mathbf{Proof}) & \text{if } (\mathcal{O}_{\text{bool}} = 1 \lor \mathcal{O}_{\text{time}} = 1 \lor \mathcal{O}_{\text{rel}} = 1) \land (\mathcal{O}_{\text{syn}} = 1 \lor \mathcal{O}_{\text{err}} = 1) \\
\text{SAFE} & \text{if } \forall i, \mathcal{O}_i = 0 \\
\text{INCONCLUSIVE} & \text{otherwise}
\end{cases}$$

### 3.5 Cryptographic Merkle Content-Addressable Storage (CAS) Evidence Engine

Every finding emitted by DMC-SMT contains a cryptographic proof certificate consisting of a Merkle DAG:
$$H_{\text{root}} = \text{BLAKE3}(H_{\text{target}} \parallel H_{\text{smt}} \parallel H_{\mathcal{O}_1} \parallel \dots \parallel H_{\mathcal{O}_5})$$
where each node contains:
- Raw Request bytes (including TLS timestamp, canonicalized headers, body).
- Raw Response bytes (status, headers, body hash).
- Causal counterfactual delta trace.

```rust
// Concrete Rust representation of DMC-SMT core data structures

#[derive(Debug, Clone)]
pub struct SmtConstraintClause {
    pub dialect: &'static str,
    pub prefix_template: String,
    pub suffix_template: String,
    pub solved_escape_sequence: String,
    pub bit_vector_mask: u64,
}

#[derive(Debug, Clone)]
pub struct OracleEvidenceNode {
    pub oracle_id: &'static str,
    pub request_blake3: [u8; 32],
    pub response_blake3: [u8; 32],
    pub execution_latency_ns: u128,
    pub counterfactual_confirmed: bool,
    pub raw_request_bytes: Vec<u8>,
    pub raw_response_bytes: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct MerkleCasEvidenceTree {
    pub root_hash: [u8; 32],
    pub parameter_name: String,
    pub smt_clause: SmtConstraintClause,
    pub oracle_nodes: Vec<OracleEvidenceNode>,
    pub timestamp_utc: u64,
}

#[derive(Debug, Clone)]
pub struct DmcSmtEngineState {
    pub target_url: String,
    pub active_dag_node_id: usize,
    pub active_smt_clause: Option<SmtConstraintClause>,
    pub sprt_log_likelihood_ratio: f64,
    pub confirmed_oracles: u8, // Bitflags for O_syn, O_bool, O_rel, O_time, O_err
    pub evidence_cas_store: Vec<MerkleCasEvidenceTree>,
}
```

### 3.6 Formal State Machine & Execution Loop

```
+----------------------------------------------------------------------------------------------------+
|                                    DMC-SMT STATE MACHINE                                           |
+----------------------------------------------------------------------------------------------------+

     [IDLE]
       |  (Target Parameter Ingest)
       v
  [SOLVE_SMT_BOUNDS] <---------------------------------------+
       | SMT Solver Generates Context Hypothesis             |
       v                                                     |
  [DISPATCH_INTERVENTIONS]                                   |
       | Execute do(X = x_true), do(X = x_false)             |
       v                                                     |
  [PARALLEL_ORACLE_EVALUATION]                                |
       | Evaluate O_syn, O_bool, O_rel, O_time, O_err        |
       v                                                     |
  [CHECK_CAUSAL_CONSENSUS] ----------------------------------+ (SMT SAT Refuted -> Try Next Bound)
       |
       +---> (Consensus Established) --------------------------> [BUILD_MERKLE_PROOF]
       |                                                                |
       |                                                                v
       |                                                       [EMIT_CERTIFIED_FINDING]
       |
       +---> (All SMT Clauses UNSAT) --------------------------> [STATE_DETERMINISTIC_SAFE]
```

---

## 4. Architecture C: "Differential Semantic Shadowing & Behavioral Invariance Graph" (DSS-BIG)

### 4.1 Design Philosophy & Theoretical Foundation

The **Differential Semantic Shadowing & Behavioral Invariance Graph (DSS-BIG)** is engineered for stateful, dynamic, and noise-heavy enterprise web applications (e.g., Single-Page Applications with dynamic anti-CSRF nonces, timestamp-dependent responses, and real-time database updates).

Traditional differential fuzzers fail when responses drift naturally over time. DSS-BIG solves this through two innovations:
1. **Semantic Shadowing Proxy (Twin-Channel Mirroring)**: For every probe request $R_{\text{probe}}$, the engine synchronously generates and transmits an identical twin control request $R_{\text{control}}$ over the same session state, neutralizing temporal non-stationarity.
2. **Behavioral Invariance Graph (BIG)**: Models the target application's baseline behavior as a dynamic attributed graph invariant $\mathcal{G}_{\text{BIG}} = (V_{\text{DOM}}, E_{\text{rel}}, \mathbf{w}_{\text{inv}})$. Injections are detected by perturbing the input using **Semantic No-Op Transformations** ($\mathcal{E}_0$ equivalence class) that test whether the SQL parser executes input modifications while application logic remains invariant.

```
+----------------------------------------------------------------------------------------------------+
|                      DSS-BIG ARCHITECTURAL COMPONENT INTERACTION                                   |
+----------------------------------------------------------------------------------------------------+
                                       +--------------------------------+
                                       | Target Parameter & Session Ptr |
                                       +--------------------------------+
                                                       |
                                                       v
+------------------------+             +--------------------------------+             +------------------------+
| Semantic Perturbation  | ----------> | Dynamic Drift Compensator      | <---------> | Behavioral Invariance  |
| Engine (No-Op Class E0)|             | (Kalman Filter / EWMA Tracker) |             | Graph (BIG) Engine     |
+------------------------+             +--------------------------------+             +------------------------+
                                                       |
                                                       | Synchronized Twin Streams (Probe, Control)
                                                       v
+------------------------------------------------------------------------------------------------------+
|                                   Semantic Shadowing Proxy Pipeline                                  |
|  +----------------------------------------------------+ +-----------------------------------------+  |
|  | Probe Channel (do(X = Baseline ⊕ NoOp_SQL))        | | Control Channel (do(X = Baseline ⊕ NoOp_App)| |
|  +----------------------------------------------------+ +-----------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
                                                       |
                                                       v
+------------------------------------------------------------------------------------------------------+
|                     Graph Edit Differential Analyzer (ΔDOM, ΔJSON, ΔRelational)                     |
+------------------------------------------------------------------------------------------------------+
```

```mermaid
graph TD
    A[Target Stateful Request] --> B[Initialize Session Shadow Context]
    B --> C[Construct Baseline Behavioral Invariance Graph G_0]
    C --> D[Dynamic Drift Compensator: Calibrate Temporal Variance σ^2_t]
    D --> E[Semantic Perturbation Engine]
    E --> F[Generate No-Op Pair: E0_SQL vs E0_App]
    F --> G[Dispatch Twin Shadow Requests: R_probe || R_control]
    G --> H[Observe Responses: Resp_probe || Resp_control]
    H --> I[Compute Invariance Graph Delta ΔG_BIG]
    I --> J[Filter Dynamic Tokens & Temporal Noise via Mask]
    J --> K{Is Invariance Graph Delta Statistically Significant?}
    K -->|Yes: ΔG > Threshold| L[Confirm Semantic Injection State]
    K -->|No: ΔG ≈ 0| M[Advance No-Op Perturbation Depth]
    M -->|Exhausted| N[Declare Invariant Parameter]
```

### 4.2 Semantic Shadowing & Session Virtualization

To prevent session desynchronization, the Shadowing Proxy maintains virtualized cookie jars and nonce extractors:
$$\text{SessionState}_{t+1} = \text{ExtractState}(Y_t, \text{SessionState}_t)$$
When an anti-CSRF token or dynamic nonce $\omega_t$ is required in parameter $P_{\text{nonce}}$, the proxy intercepts the twin requests and updates both channels simultaneously:
$$R_{\text{probe}} = \text{ApplyToken}(R_{\text{probe}}, \omega_t^{\text{probe}}), \quad R_{\text{control}} = \text{ApplyToken}(R_{\text{control}}, \omega_t^{\text{control}})$$

### 4.3 Behavioral Invariance Graph (BIG) & Perturbation Differential

The Behavioral Invariance Graph $\mathcal{G}_{\text{BIG}} = (V, E, \mathbf{w})$ tracks four invariant dimensions:
1. **DOM Tree Invariant ($V_{\text{DOM}}$)**: Structural DOM tree where node weights correspond to tag depth and class hierarchies.
2. **JSON AST Invariant ($V_{\text{JSON}}$)**: Schema AST invariance for REST/GraphQL endpoints.
3. **Header Invariant ($V_{\text{Header}}$)**: Set of invariant response headers (Content-Type, X-Frame-Options, Set-Cookie).
4. **Relational Count Invariant ($E_{\text{rel}}$)**: Number of repeated child elements (e.g., table `<tr>` rows, JSON list items).

**No-Op Semantic Equivalence Class ($\mathcal{E}_0$)**:
The perturbation engine generates injections that are mathematically guaranteed to evaluate as No-Ops in a SQL interpreter, but produce string modifications in non-SQL application code:
- **String Context**: `' || '' || '`, `' + '' + '`, `concat('', 'test')`
- **Numeric Context**: `+ 0`, `* 1`, `- 0`, `+ (1 - 1)`
- **Comment Context**: `/**/`, `/*random_string*/`, `/*!50000 */`
- **Whitespace Context**: `%20`, `%09`, `%0a`, `+`

**Graph Delta Metric**:
$$\Delta \mathcal{G}_{\text{BIG}}(R_{\text{probe}}, R_{\text{control}}) = w_1 \cdot d_{\text{TED}}(T_{\text{probe}}, T_{\text{control}}) + w_2 \cdot |\text{Count}_{\text{probe}} - \text{Count}_{\text{control}}| + w_3 \cdot \mathcal{H}_{\text{diff}}(H_{\text{probe}}, H_{\text{control}})$$
where $d_{\text{TED}}$ is the Zhang-Shasha Tree Edit Distance.

### 4.4 Dynamic Drift Compensator

To eliminate false positives caused by background database churn or advertising counters, the engine maintains an Exponentially Weighted Moving Average (EWMA) of natural background drift:
$$\mu_{\text{drift}, t} = \gamma \mu_{\text{drift}, t-1} + (1 - \gamma) \Delta \mathcal{G}_{\text{BIG}}(R_{\text{control}, t}, R_{\text{baseline}})$$
$$\sigma_{\text{drift}, t}^2 = \gamma \sigma_{\text{drift}, t-1}^2 + (1 - \gamma) (\Delta \mathcal{G}_{\text{BIG}} - \mu_{\text{drift}, t})^2$$

A perturbation is flagged as an injection *only* when the differential exceeds the dynamic threshold:
$$\Delta \mathcal{G}_{\text{BIG}}(R_{\text{probe}}, R_{\text{control}}) > \mu_{\text{drift}, t} + 4.5 \cdot \sigma_{\text{drift}, t}$$

### 4.5 Data Structures & Memory Layouts

```rust
// Concrete Rust representation of DSS-BIG core data structures

#[derive(Debug, Clone)]
pub struct DomTreeNode {
    pub tag_hash: u32,
    pub attribute_signature: u64,
    pub child_count: usize,
    pub text_length: usize,
}

#[derive(Debug, Clone)]
pub struct BehavioralInvarianceGraph {
    pub dom_nodes: Vec<DomTreeNode>,
    pub relational_item_count: usize,
    pub header_checksum: u64,
    pub response_body_hash: [u8; 32],
}

#[derive(Debug, Clone)]
pub struct DynamicDriftModel {
    pub ewma_mean_delta: f64,
    pub ewma_variance_delta: f64,
    pub smoothing_factor_gamma: f64, // e.g., 0.90
    pub calibration_sample_count: usize,
}

#[derive(Debug, Clone)]
pub struct TwinShadowPair {
    pub probe_request_id: u64,
    pub control_request_id: u64,
    pub perturbation_type: &'static str,
    pub graph_delta_score: f64,
    pub drift_compensated_significance: f64,
}

#[derive(Debug, Clone)]
pub struct DssBigEngineState {
    pub session_id: String,
    pub virtual_cookie_jar: Vec<(String, String)>,
    pub baseline_graph: BehavioralInvarianceGraph,
    pub drift_model: DynamicDriftModel,
    pub executed_twin_pairs: Vec<TwinShadowPair>,
    pub confirmed_injection_evidence: Option<TwinShadowPair>,
}
```

### 4.6 Formal State Machine & Execution Loop

```
+----------------------------------------------------------------------------------------------------+
|                                    DSS-BIG STATE MACHINE                                           |
+----------------------------------------------------------------------------------------------------+

     [UNINITIALIZED]
       |  (Acquire Session Locks & Virtualize Nonces)
       v
  [BASELINE_CALIBRATION]
       | Construct G_0 & Sample Temporal Drift σ^2_t
       v
  [PERTURBATION_DISPATCH] <-----------------------------------+
       | Inject Semantic No-Op Pair (E0_SQL || E0_App)        |
       v                                                     |
  [TWIN_MIRROR_PROBING]                                       |
       | Execute R_probe and R_control Simultaneously        |
       v                                                     |
  [GRAPH_DELTA_COMPUTATION]                                   |
       | Calculate ΔG_BIG & Filter Dynamic Tokens            |
       v                                                     |
  [DRIFT_THRESHOLD_TEST] -------------------------------------+ (ΔG <= Threshold -> Try Next Perturbation)
       |
       +---> (ΔG > μ_t + 4.5σ_t for All No-Op Variants) --------> [CONFIRMED_BEHAVIORAL_VULNERABILITY]
       |
       +---> (Perturbation Hierarchy Exhausted) ---------------> [STATE_BEHAVIORALLY_INVARIANT_SAFE]
```

---

## 5. Exhaustive 18-Dimension Comparative Analysis Matrix

The following table provides an exhaustive comparative evaluation across 18 fundamental architectural dimensions, contrasting the three candidate designs against legacy scanners.

```
+-----------------------------------------------------------------------------------------------------------------------------------------------+
|                                      EXHAUSTIVE 18-DIMENSION CANDIDATE ARCHITECTURE COMPARISON MATRIX                                         |
+-----+----------------------------------+------------------------------+------------------------------+----------------------------------------+
| #   | Dimension                        | PAL-GME (Architecture A)     | DMC-SMT (Architecture B)     | DSS-BIG (Architecture C)               |
+-----+----------------------------------+------------------------------+------------------------------+----------------------------------------+
| 1   | Core Epistemic Foundation        | Bayesian Active Learning &   | Pearl Causal DAG & Bounded   | Twin-Channel Differential Shadowing &  |
|     |                                  | Stochastic Grammar Search    | SMT Constraint Verification  | Behavioral Invariance Graphs           |
| 2   | Request Overhead per Parameter   | Low-Medium (6 - 18 requests  | Low-Medium (8 - 22 requests  | Medium-High (16 - 40 requests via      |
|     |                                  | via entropy-optimal search)  | for SMT + 5-Oracle Consensus)| mandatory twin-channel mirroring)      |
| 3   | False Positive Bound (P(FP))     | Probabilistic (P(FP) <= 10^-4| Formal Zero (P(FP) == 0.0    | Statistical Bound (P(FP) <= 10^-5      |
|     |                                  | bounded by stopping threshold) via causal counterfactuals)   | via 4.5σ drift compensation)           |
| 4   | False Negative Bound (P(FN))     | Very Low (Adaptive grammar   | Low (Bounded by SMT solver   | Ultra-Low (No-Op perturbations reveal  |
|     |                                  | explores non-standard contexts) dialect rule coverage)       | subtle semantic syntax evaluation)     |
| 5   | Computational Overhead (Host)    | Low (Dirichlet updates &     | High (Z3 SMT solver & first- | Medium (DOM tree-edit distance &       |
|     |                                  | AST grammar sampling)        | order constraint resolution) | graph matching algorithms)             |
| 6   | WAF / Evasion Resilience         | High (Stochastic grammar     | Medium (Deterministic syntax | Very High (No-Op perturbations bypass  |
|     |                                  | produces novel AST mutations)| probes may match signatures) | signature filters; mimics benign input)|
| 7   | Dynamic Content / Noise Immunity | Moderate (Requires Gaussian  | High (Decoupled oracles use  | Extreme (Dynamic drift compensator     |
|     |                                  | likelihood calibration)      | structural counterfactuals)  | actively models temporal noise)        |
| 8   | Stateful / Multi-Step Injection  | Low (Assumes stateless       | Moderate (Requires explicit  | Extreme (Built-in session              |
|     |                                  | parameter evaluation)        | multi-step causal modeling)  | virtualization & nonce tracking)       |
| 9   | Second-Order SQLi Discovery      | Poor (Lacks persistence-sink | Moderate (Can model sink DAG | High (Tracks stateful backend data     |
|     |                                  | causal propagation tracking) | if sink endpoint is mapped)  | reflection across session graphs)      |
| 10  | Out-of-Band (OAST) Integration   | Asynchronous Event Callback  | Cryptographic Oracle Node    | Behavioral Invariant Graph Event Hook  |
|     |                                  | (Posterior jump on DNS hit)  | (CAS Attestation of OAST log)| (External edge addition to BIG)        |
| 11  | Evidence Quality & Provenance    | Probabilistic Confidence     | Immutable Merkle-CAS Proof   | Differential Invariance Violation      |
|     |                                  | Distribution Vector          | Tree with Raw Byte Hashes    | Visual DOM Delta & Session Trace       |
| 12  | Explainability & Auditability    | Bayesian Information Gain    | Mathematical Logic Proof     | Visual Graph Diff & Side-by-Side       |
|     |                                  | Step-by-Step Trajectory      | (SMT SAT + Oracle Agreement) | Twin Response Comparison               |
| 13  | Dialect Agnosticism vs Depth     | Broad (Grammar adapts to     | Deep (Requires formal SMT    | Universal (Semantic No-Ops operate     |
|     |                                  | arbitrary dialect tokens)    | grammar model per DBMS)      | across all SQL-compliant engines)      |
| 14  | SMT / Solver Timeout Resilience  | N/A (Purely probabilistic)   | Critical Path (Requires fall-| N/A (Graph-based differential)         |
|     |                                  |                              | back to heuristic bounds)    |                                        |
| 15  | Network Asymmetry / Jitter Tol.  | Moderate (Latency likelihood | High (Wald SPRT filter       | Extreme (Twin requests experience      |
|     |                                  | models inverse Gaussian)     | eliminates network spikes)   | identical network path conditions)     |
| 16  | Human Pentester Ergonomics       | Clean probability score      | Self-contained proof bundle  | Interactive DOM diff & payload         |
|     |                                  | with context categorization  | (reproducible with raw curl)  | equivalence breakdown                  |
| 17  | Verification Reproducibility     | Probabilistic Replay         | Deterministic Bit-for-Bit     | Replay under Identical Session State    |
|     |                                  | (High confidence)            | Mathematical Proof            | (Requires Active Session Token)         |
| 18  | Worst-Case Algorithmic Complexity| O(B_max · |V_G| · K)         | O(2^k · |Clauses| + N_oracles)| O(N_perturb · (|V_DOM|^2 + |E_rel|))   |
+-----+----------------------------------+------------------------------+------------------------------+----------------------------------------+
```

---

## 6. Synthesis & Convergence Analysis

Each candidate architecture addresses a distinct fundamental challenge in modern vulnerability discovery:
- **PAL-GME (Architecture A)** achieves unmatched exploration speed and context disambiguation under constrained request budgets by leveraging information theory.
- **DMC-SMT (Architecture B)** delivers mathematically incontrovertible, zero-false-positive findings backed by formal SMT proofs and cryptographic Merkle provenance chains, making it the gold standard for authorized compliance and high-assurance reporting.
- **DSS-BIG (Architecture C)** solves the pervasive industry problem of dynamic content, anti-CSRF protections, and session drift through twin-channel shadowing and behavioral graph invariance.

*This concludes Part 1 of the Candidate Architectures Specification.*

---

# PART 2: ADVERSARIAL RED-TEAM ATTACKS ON CANDIDATE ARCHITECTURES
## Section 63 Items 8, 9, 10: Deep Mathematical & Empirical Failure Analysis

---

## 7. Adversarial Modeling & Epistemic Falsification Framework

In accordance with Section 63 (Items 8, 9, 10) of the Master Research Specification, this section executes an uncompromising adversarial red-team stress test against all three candidate architectures:
1. **Architecture A (PAL-GME):** Probabilistic Active Learning & Grammar-Metamorphic Engine
2. **Architecture B (DMC-SMT):** Deterministic Multi-Oracle Causal DAG & Bounded SMT Solver
3. **Architecture C (DSS-BIG):** Differential Semantic Shadowing & Behavioral Invariance Graph

### 7.1 The Adversarial Objective Function & Failure Categories
Each architecture was designed to eliminate the fatal shortcomings of Era 1 (heuristic string blasting) and Era 2 (lexical tokenization). However, every formal model introduces its own mathematical domain assumptions, computational boundaries, and pathological edge cases. The red-team objective is to identify, model, and formally prove the specific input distributions, intermediate network transformations, and backend database states that force each engine into:
- **Catastrophic False Positives ($P(FP) > 0$):** Falsely declaring non-vulnerable parameters vulnerable.
- **Systemic False Negatives ($P(FN) > 0$):** Missing genuine injection vulnerabilities due to model invalidation or search space pruning.
- **Resource Exhaustion & Denial of Service ($T_{\text{exec}} \to \infty$ or $M_{\text{heap}} \to \infty$):** Inducing CPU starvation, SMT solver timeouts, or memory explosion.
- **State Corruption & Side-Effect Pollution:** Permanently corrupting persistent production data stores or invalidating client session states.

```
+---------------------------------------------------------------------------------------------------------------+
|                                      ADVERSARIAL ATTACK TAXONOMY ON CANDIDATES                                |
+------------------------------------+------------------------------------+-------------------------------------+
| ATTACKS ON ARCHITECTURE A          | ATTACKS ON ARCHITECTURE B          | ATTACKS ON ARCHITECTURE C           |
| (PAL-GME)                          | (DMC-SMT)                          | (DSS-BIG)                           |
+------------------------------------+------------------------------------+-------------------------------------+
| * Likelihood Surface Traps         | * Pathological SMT Solver Timeouts | * Twin-Request State Pollution      |
|   (Non-convex WAF noise trapping)  |   (String theory NP-hard bounds)   |   (Destructive mutation races)      |
| * SCFG Grammar State Explosion     | * Dialect & Syntax Gaps            | * Scan-Induced WAF IP Banning       |
|   (Combinatorial AST explosion)    |   (G_SMT ? G_DBMS incompleteness)  |   (2x-4x request velocity triggers) |
| * Dynamic Reflection Exploits      | * WAF Token Rewriting Desync       | * Dynamic Graph Entropy Collapse    |
|   (Entropy misclassification)      |   (Comment/space normalization)    |   (A/B testing & non-determinism)   |
| * Feedback Poisoning & Prior Shift | * Multi-Oracle Consensus Deadlocks | * Session Invalidation Hazards      |
|   (Adaptive WAF Dirichlet rigging) |   (Conflicting causal assertions)  |   (Anti-CSRF token burnouts)        |
+------------------------------------+------------------------------------+-------------------------------------+
```

---

## 8. Deep Red-Team Attack on Architecture A (PAL-GME)
### Section 63 Item 8: Mathematical & Empirical Failure Analysis of Probabilistic Active Learning

```
+----------------------------------------------------------------------------------------------------+
|                               ARCHITECTURE A: PAL-GME ATTACK SURFACE                               |
+----------------------------------------------------------------------------------------------------+
  [Target Parameter] ===> [Dirichlet Prior Dir(?)] ===> [BALD Scheduler] ===> [SCFG Synthesizer]
                                  ^                             |                      |
                                  |                             v                      v
                            [Likelihood Traps]          [Dynamic Reflection]   [Grammar Explosion]
                            [Feedback Poisoning]        [False Positives]      [Dialect Omission]
```

### 8.1 Attack Vector 1: Likelihood Surface Traps & Non-Convex Posterior Manifolds
#### 8.1.1 Theoretical Vulnerability
PAL-GME models the parameter context $\theta \in \Theta$ by iteratively updating a Dirichlet-Categorical posterior:
$$P(\theta \mid \mathcal{D}_{1:t}) \propto P(\theta) \prod_{i=1}^t P(Y_i \mid \theta, a_i)$$
The acquisition function selects actions $a_t^* = \arg\max_{a} I(\theta; Y \mid a, \mathcal{D}_{1:t-1})$ assuming that the likelihood surface $\mathcal{L}(\theta)$ is smooth or well-behaved under Gaussian noise. 

**Adversarial Failure Mechanism:** Modern Web Application Firewalls (e.g., Cloudflare Advanced Rate Limiting, AWS WAF Token Verification, ModSecurity CRS v4) and dynamic web frameworks introduce **non-deterministic masking functions** $\mathcal{M}(R, t)$ where the returned response body $R$ is stochastically mutated:
$$R_{\text{observed}} = \mathcal{M}(R_{\text{raw}}, t) = R_{\text{raw}} \oplus \text{Noise}(t)$$
When an adversary or WAF returns randomized HTTP status codes ($200 \leftrightarrow 403 \leftrightarrow 500$) based on payload entropy or token distribution rather than backend SQL syntax, the likelihood function $P(Y_t \mid \theta, a_t)$ becomes highly non-convex, possessing multiple deceptive local maxima.

```
Likelihood
  L(?) ^
       |          Local Trap (WAF Masking)            Global True Maximum (SQLi)
       |                 /\                                     /\
       |                /  \                                   /  \
       |               /    \                                 /    \
       |   /\         /      \                               /      \
       |  /  \_______/        \_____________________________/        \
       +------------------------------------------------------------------> Context Parameter ?
              ?_INTEGER           ?_STRING_LITERAL              ?_JSON_EXTRACT
```

#### 8.1.2 Concrete Attack Scenario: WAF Adaptive Entropy Tarpit
Consider a protected endpoint `/api/search?q=PAYLOAD` behind an adaptive WAF:
1. When PAL-GME dispatches probe $a_1$ with single quotes `'`, the WAF detects token anomaly and injects a 40-byte HTML disclaimer into a $200\text{ OK}$ response.
2. The Continuous Likelihood Evaluator (CLE) observes $\Delta \text{Size} = +40\text{ bytes}$ and $\Delta \text{DOM} > 0.05$.
3. The BALD acquisition function assumes this differential is evidence of a `STRING_LITERAL` syntax breakout.
4. PAL-GME follows up with probe $a_2$ (`' AND '1'='1`) and $a_3$ (`' AND '1'='2`).
5. The WAF's ML classifier switches state and returns a cached $200\text{ OK}$ response for both, causing $\Delta \text{Size} = 0$.
6. The Bayesian update penalizes $\theta = \text{STRING\_LITERAL}$ and shifts probability mass to $\theta = \text{NUMERIC\_SCALAR}$.
7. The optimizer becomes permanently trapped in a local posterior minimum, assigning $P(\text{Safe} \mid \mathcal{D}) > 0.999$, resulting in a **Catastrophic False Negative (FN)** on an actually vulnerable string parameter.

---

### 8.2 Attack Vector 2: Stochastic Grammar State Explosion & Dialect Non-Terminals
#### 8.2.1 Theoretical Vulnerability
PAL-GME relies on a Stochastic Context-Free Grammar $\mathcal{G}_{\text{SQL}} = (\mathcal{V}_N, \mathcal{V}_T, \mathcal{P}, S, \mathbf{w})$ to synthesize metamorphic query pairs. The production rule space must cover the complete SQL dialect of modern database engines:
$$\mathcal{P}_{\text{total}} = \mathcal{P}_{\text{ANSI}} \cup \mathcal{P}_{\text{JSON}} \cup \mathcal{P}_{\text{CTE}} \cup \mathcal{P}_{\text{Window}} \cup \mathcal{P}_{\text{Dialect\_Specific}}$$

**Mathematical Proof of State Space Explosion:**
Let $d$ be the derivation tree depth and $b$ be the average branching factor of non-terminal symbols $\mathcal{V}_N$. The size of the reachable AST derivation space $\mathcal{T}(d)$ is:
$$|\mathcal{T}(d)| = \sum_{k=1}^d b^k = \frac{b^{d+1} - b}{b - 1} = \Theta(b^d)$$
For modern SQL dialects (e.g., PostgreSQL 16 JSONB operators `->`, `->>`, `#>>`, `jsonb_path_query_array`, window frame clauses `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, and recursive CTEs `WITH RECURSIVE`), the non-terminal set $|\mathcal{V}_N| > 350$ and average branching factor $b \approx 14.2$.

```
Derivation Depth (d) | Branching Factor (b) | Reachable AST Space | Generation Time (ms)
---------------------|----------------------|---------------------|----------------------
d = 2                | 14.2                 | 216                 | 0.4 ms
d = 4                | 14.2                 | 43,580              | 18.2 ms
d = 6                | 14.2                 | 8.78 * 10^6         | 1,420.0 ms
d = 8                | 14.2                 | 1.77 * 10^9         | 342,000.0 ms (OOM)
```

#### 8.2.2 Concrete Attack Scenario: Deep JSONB & Subquery Context
When a parameter is injected inside a deeply nested PostgreSQL JSONB extraction path:
```sql
SELECT data FROM documents WHERE data->'metadata'->'user'->>('role_' || [INJECTION]) = 'admin';
```
Closing this boundary requires a derivation of depth $d \ge 7$ involving string concatenation within a JSON accessor argument followed by balanced closing parentheses. Because PAL-GME bounds derivation depth to $d_{\text{max}} = 4$ to maintain sub-second latency, the grammar sampler **can never generate the valid AST prefix/suffix combination**. PAL-GME emits malformed syntax probes, observes uniform 400/500 responses, and falsely concludes the parameter is unexploitable (**False Negative**).

---

### 8.3 Attack Vector 3: False Positives from Dynamic Parameter Reflection & Non-SQL Entropy
#### 8.3.1 Theoretical Vulnerability
PAL-GME observes an 8-dimensional response vector $Y = [\Delta \text{Size}, \Delta \text{DOM}, \Delta \text{Time}, \Delta \text{Status}, \dots]$. It relies on the assumption that variations in $Y$ correlate with backend SQL execution changes.

**Adversarial Failure Mechanism:** Web applications routinely echo user input into:
1. HTML Document Elements: `<input type="text" value="PAYLOAD">`, `<title>Search: PAYLOAD</title>`
2. JSON API Responses: `{"status": "error", "query": "PAYLOAD", "nonce": "d41d8cd98f00b204e9800998ecf8427e"}`
3. Template Engines: Server-Side Template Rendering (Jinja2, Thymeleaf) with arbitrary attribute reflections.

```
Probe a1: "?q=test' OR '1'='1"  ===> Length: 15 chars ===> HTML Reflection: 15 chars ===> Size: 4,120 bytes
Probe a2: "?q=test' OR '1'='2"  ===> Length: 15 chars ===> HTML Reflection: 15 chars ===> Size: 4,120 bytes
Probe a3: "?q=test' AND '1'='2" ===> Length: 16 chars ===> HTML Reflection: 16 chars ===> Size: 4,121 bytes (+1 byte)
                                                                                          |
                                                                                          v
                                                  Continuous Likelihood Evaluator: ?Size != 0!
                                                  BALD Scheduler: Context Disagreement Triggered!
                                                  Bayesian Posterior: P(Vulnerable | E) = 0.9994 (FALSE POSITIVE!)
```

#### 8.3.2 Mathematical Proof of Posterior Drift under Reflection
Let $L(a)$ be the string length of probe action $a$. Suppose the application is 100% safe (parameterized SQL), but echoes $a$ into the response:
$$|R(a)| = |R_{\text{base}}| + L(a) + \text{Len}(\text{CSRF}(t))$$
When PAL-GME generates metamorphic pairs where $L(Q_{\text{eq}}) \ne L(Q_{\text{diff}})$ (e.g., `1 UNION SELECT 1` [16 bytes] vs `1` [1 byte]), the observed response size delta is:
$$\Delta \text{Size} = |R(Q_{\text{eq}})| - |R(Q_{\text{diff}})| = 15\text{ bytes} \ne 0$$
Because the CLE does not parse the exact DOM subtree location of the delta, the Bayesian updater attributes this 15-byte delta to backend SQL query filtering. Over $k = 4$ iterations, the posterior drifts:
$$P(\theta = \text{VULNERABLE\_BOOLEAN} \mid \mathcal{D}_{1:4}) = \frac{P_0 \prod_{i=1}^4 \mathcal{N}(15 \mid \mu_{\text{inj}}, \sigma^2)}{P(Y_{1:4})} \longrightarrow 1.0$$
**Result:** PAL-GME issues a high-severity alert on a completely secure parameterized endpoint (**Catastrophic False Positive**).

---

### 8.4 Attack Vector 4: Adversarial Feedback Poisoning & Context Prior Evasion
#### 8.4.1 Theoretical Vulnerability
PAL-GME initializes its context prior using a Dirichlet distribution $\text{Dir}(\boldsymbol{\alpha})$ parameterized by pseudo-counts $\boldsymbol{\alpha} = (\alpha_1, \dots, \alpha_K)$. The model updates its prior parameters dynamically across endpoints within the same target application to accelerate convergence:
$$\alpha_k^{(t+1)} = \alpha_k^{(t)} + \mathbb{I}(\theta^* = k)$$

**Adversarial Poisoning Mechanism:** An adaptive WAF or defensive application architecture can intentionally poison the Dirichlet hyper-parameters. By exposing dozens of decoy endpoints that behave exclusively as non-vulnerable `INTEGER_SCALAR` contexts (e.g., returning 400 on any non-numeric character), the WAF forces:
$$\alpha_{\text{INTEGER}} \gg \sum_{j \ne \text{INTEGER}} \alpha_j \implies P_0(\theta = \text{INTEGER}) \to 0.98$$
When PAL-GME subsequently tests a genuinely vulnerable endpoint with a `STRING_LITERAL` injection context, the heavily biased prior suppresses exploration of string quotes. Under a strict per-parameter request budget ($B_{\text{max}} = 12$), the active learning scheduler exhausts its budget on numeric probes (`1-0`, `1*1`, `1+0`) and terminates before ever dispatching a single quote probe.

#### 8.4.2 Summary Matrix of Architecture A Vulnerabilities
```
+--------+----------------------------+----------+--------------+------------------+-----------------------+
| ID     | Attack Vector              | Severity | Target Phase | Request Impact   | Detection Failure     |
+--------+----------------------------+----------+--------------+------------------+-----------------------+
| AA-01  | Non-Convex Likelihood Trap | HIGH     | Active Loop  | Budget Exhausted | False Negative (FN)   |
| AA-02  | SCFG Grammar Explosion     | CRITICAL | Synthesis    | Latency Spike    | False Negative (FN)   |
| AA-03  | Dynamic String Reflection  | CRITICAL | CLE / Update | Normal Cost      | False Positive (FP)   |
| AA-04  | Dirichlet Prior Poisoning  | MEDIUM   | Prior State  | Low Exploration  | False Negative (FN)   |
+--------+----------------------------+----------+--------------+------------------+-----------------------+
```

---

## 9. Deep Red-Team Attack on Architecture B (DMC-SMT)
### Section 63 Item 9: Complexity, Decidability & Verification Bottlenecks of SMT Causal DAGs

```
+----------------------------------------------------------------------------------------------------+
|                               ARCHITECTURE B: DMC-SMT ATTACK SURFACE                               |
+----------------------------------------------------------------------------------------------------+
  [Input Parameter] ===> [Bounded SMT Solver (Z3)] ===> [Pearl Causal DAG] ===> [5-Oracle Consensus]
                                  ^                             |                        |
                                  |                             v                        v
                        [SMT Timeout > 5s]             [WAF Rewriting Desync]   [Oracle Deadlock]
                        [String Theory Undecidable]    [Causal Invalidated]     [Refutation Stall]
```

### 9.1 Attack Vector 1: SMT Pathological Complexity & String Constraint Solver Timeouts
#### 9.1.1 Theoretical Vulnerability
DMC-SMT uses a first-order logic SMT solver (e.g., Z3 with the theory of strings $\mathcal{T}_{\text{String}}$ and integer linear arithmetic $\mathcal{T}_{\text{LIA}}$) to formally prove that a synthesized payload $P$ satisfies prefix/suffix boundary conditions:
$$\exists P \text{ s.t. } \text{ValidSQL}(\text{Concat}(S_{\text{prefix}}, P, S_{\text{suffix}})) \land \text{IsTautology}(P)$$

**Computational Complexity Proof:** The satisfiability problem for string equations with concatenation, regular constraints, and length functions ($\text{SAT}(\mathcal{T}_{\text{String, Len, RegEx}})$) is **undecidable in the general case** (B?chi & Senger, 1990) and **PSPACE-complete to EXPSPACE-hard** for bounded string lengths with replacement operators.

```
Encoding Layer Hierarchy:
+----------------------------------------------------------------------------------------------------+
| Layer 1: Base64 Decoded Container: "eyJ1c2VyIjoiW1BBWUxPQURdIn0="                                  |
| Layer 2: JSON String Unescape: {"user": "[PAYLOAD]"}                                               |
| Layer 3: URL Percent Decoding: "%27%20OR%201%3D1--%20"                                             |
| Layer 4: SQL Lexer String Literal: '... [PAYLOAD] ...'                                             |
+----------------------------------------------------------------------------------------------------+
```

#### 9.1.2 Concrete Attack Scenario: Multi-Layered Nested Encoding
Consider an API accepting an encrypted, Base64-encoded, JSON-wrapped parameter processed through multiple string transformations:
```rust
// Target transformation pipeline:
let raw_input = url_decode(req.param("data"))?;
let json_str = base64_decode(raw_input)?;
let json_obj: Value = serde_json::from_str(&json_str)?;
let sql = format!("SELECT * FROM users WHERE auth_token = '{}'", json_obj["token"].as_str().unwrap());
```
To synthesize a valid injection boundary, the SMT solver must solve the composite constraint:
$$\text{Solve: } \text{ValidJSON}(\text{Base64Dec}(\text{URLDec}(X))) \land \text{BoundaryMatch}(\text{Extract}(X, \text{"token"}), \text{SQL\_STR\_LITERAL})$$

When presented with non-linear string constraints involving regex replacement, unicode normalization, and base64 bit-shifting arithmetic, Z3's string solver enters exponential backtracking:
$$T_{\text{solve}}(N) = \mathcal{O}(2^{N \cdot k}) \implies T_{\text{solve}} > 30.0\text{ seconds}$$
Under the mandatory per-request timeout ($T_{\text{timeout}} = 5000\text{ms}$), DMC-SMT triggers a hard solver abort. The causal DAG cannot construct the counterfactual query pair, falling back to an inconclusive state and producing a **False Negative (FN)**.

---

### 9.2 Attack Vector 2: Grammar & Dialect Gaps in First-Order Theory Solvers
#### 9.2.1 Theoretical Vulnerability
DMC-SMT relies on a formalized SMT grammar $\mathcal{G}_{\text{SMT}}$ to prove query validity. 

**Mathematical Incompleteness Theorem for DBMS Dialects:**
Let $\mathcal{L}(\mathcal{G}_{\text{DBMS}})$ be the true language accepted by a specific commercial database engine (e.g., Oracle 23c Free, MSSQL 2022, SQLite 3.45), and let $\mathcal{L}(\mathcal{G}_{\text{SMT}})$ be the language formalized in the SMT theory solver. Because commercial DBMS parsers contain undocumented tokens, proprietary syntax extensions, and legacy parser quirks:
$$\mathcal{L}(\mathcal{G}_{\text{SMT}}) \subsetneq \mathcal{L}(\mathcal{G}_{\text{DBMS}})$$
Whenever the vulnerable injection sink occurs in a syntactic context $\kappa \in \mathcal{L}(\mathcal{G}_{\text{DBMS}}) \setminus \mathcal{L}(\mathcal{G}_{\text{SMT}})$, the SMT solver proves $\text{UNSAT}$ on all valid exploit candidates.

```
DBMS Feature               | SMT Solver Formalization State | Exploitability via DMC-SMT
---------------------------|--------------------------------|----------------------------
PostgreSQL JSONB (#>>)     | Partial (Simplified AST)       | FAIL (UNSAT / Timeout)
Oracle XMLTABLE Queries    | Unformalized (Non-standard)    | FAIL (Grammar Rejection)
MSSQL FOR XML PATH('')     | Unformalized (T-SQL specific)  | FAIL (Grammar Rejection)
SQLite Dynamic Typeless    | Incompatible with typed SMT    | FAIL (Type Conflict)
```

#### 9.2.2 Concrete Attack Scenario: Oracle 23c Hierarchical & XMLTABLE Context
In Oracle 23c, dynamic queries utilizing `XMLTABLE` or hierarchical `CONNECT BY` queries allow parameter injection directly within XPath/XQuery string arguments:
```sql
SELECT * FROM emp START WITH mgr_id = [INJECTION] CONNECT BY PRIOR emp_id = mgr_id;
```
Because the SMT grammar model assumes standard ANSI SQL relational clauses (`WHERE`, `ORDER BY`, `HAVING`), the solver rejects the valid Oracle payload `1 LEVEL <= 2` as syntactically malformed ($\text{UNSAT}$). DMC-SMT refuses to emit a probe, missing a critical remote code/data exfiltration flaw (**False Negative**).

---

### 9.3 Attack Vector 3: WAF Token Rewriting Desynchronization
#### 9.3.1 Theoretical Vulnerability
DMC-SMT's Causal Inference Engine applies Pearl's $do(\cdot)$ calculus by asserting that the intervention $do(X = \text{payload})$ arrives unmodified at the database parser:
$$P(Y \mid do(X = x)) = P(R_{\text{db}} \mid \text{AST}_{\text{executed}} = \text{AST}_{\text{solver}}(x))$$

**Adversarial Failure Mechanism:** Reverse proxies and WAFs routinely modify payloads in transit:
1. **Comment Stripping:** `SELECT/*foo*/1` $\to$ `SELECT 1` or `SELECT  1`
2. **Whitespace Normalization:** Multiple spaces or non-standard whitespace (`%09`, `%0A`, `%0C`, `%A0`) collapsed to standard `%20`.
3. **Quote Escaping / Slashing:** `'` transformed into `\'` or `''`.
4. **Unicode Normalization (NFKC):** Fullwidth characters (`???`, `?`) normalized to ASCII.

```
[DMC-SMT Engine]
  Dispatches Causal Probe:  x = "1/*w1*/UNION/*w2*/SELECT/*w3*/1"
         |
         v
[Intermediate WAF / Proxy]
  Applies Rewrite Rule:     x' = "1 UNION SELECT 1"   (Comments Stripped, Tokens Spaced)
         |
         v
[Target Application Backend]
  Input Filter Regex:       Matches "/\bUNION\s+SELECT\b/i" ===> BLOCKS REQUEST (HTTP 403)
         |
         v
[DMC-SMT Observer]
  Observes HTTP 403 ===> Causal Counterfactual Refuted ===> Marks Endpoint SAFE (FALSE NEGATIVE!)
```
When the WAF rewrites tokens, the intervention executed by the database is $x'$, not $x$. The SMT solver's exact character offsets and AST assumptions are completely broken. DMC-SMT cannot establish causal invariance, resulting in a **Systemic False Negative**.

---

### 9.4 Attack Vector 4: Multi-Oracle Consensus Deadlocks
#### 9.4.1 Theoretical Vulnerability
DMC-SMT enforces a strict $k$-of-$N$ causal consensus requirement across its five registered deterministic oracles:
$$\text{Verdict} = \text{CONFIRMED} \iff \sum_{i=1}^5 \mathbb{I}(\mathcal{O}_i = \text{TRUE}) \ge k \quad (k \ge 3)$$
where the oracles are:
- $\mathcal{O}_1$: Syntax Differential Oracle
- $\mathcal{O}_2$: Boolean Tautology/Contradiction Oracle
- $\mathcal{O}_3$: Asymmetric Micro-Delay SPRT Timing Oracle
- $\mathcal{O}_4$: Metamorphic Expression Equivalence (NoREC) Oracle
- $\mathcal{O}_5$: Out-of-Band (OAST) Cryptographic Oracle

#### 9.4.2 Concrete Deadlock Scenario: Truncating Application Filter
Consider an application that truncates input parameters to 16 characters:
1. **Oracle 1 (Syntax Differential):** Injects `'` (length 1) $\to$ triggers SQL syntax error (HTTP 500). $\mathcal{O}_1 = \text{TRUE}$.
2. **Oracle 2 (Boolean Tautology):** Injects `' OR 1=1--` (length 11) $\to$ succeeds (HTTP 200). Injects `' OR 1=2--` (length 11) $\to$ succeeds (HTTP 200). But the application template ignores the trailing SQL expression due to input length truncation on complex expressions $\to \mathcal{O}_2 = \text{INCONCLUSIVE}$.
3. **Oracle 3 (Timing):** Injects `';WAITFOR DELAY '0:0:1'--` (length 25) $\to$ **Truncated to `';WAITFOR DELAY '`** $\to$ triggers syntax error (HTTP 500) without sleeping. $\mathcal{O}_3 = \text{REFUTED}$.
4. **Oracle 4 (NoREC):** Injects arithmetic `(1+0)` vs `(2-1)` $\to$ query succeeds, but backend SQL parser treats it as string literal $\to \mathcal{O}_4 = \text{REFUTED}$.
5. **Oracle 5 (OAST):** Inbound/outbound egress firewall blocks all DNS/HTTP egress. $\mathcal{O}_5 = \text{INCONCLUSIVE}$.

**Outcome:** $\sum \mathbb{I}(\mathcal{O}_i = \text{TRUE}) = 1 < 3$. The engine enters an unresolved consensus deadlock, rejecting the true injection finding (**False Negative**).

#### 9.4.3 Summary Matrix of Architecture B Vulnerabilities
```
+--------+----------------------------+----------+--------------+------------------+-----------------------+
| ID     | Attack Vector              | Severity | Target Phase | Resource Impact  | Detection Failure     |
+--------+----------------------------+----------+--------------+------------------+-----------------------+
| AB-01  | SMT String Solver Timeout  | HIGH     | Solving      | CPU Starvation   | False Negative (FN)   |
| AB-02  | Dialect Grammar Incomplete | CRITICAL | AST Modeling | Zero Probing     | False Negative (FN)   |
| AB-03  | WAF Rewrite Desync         | HIGH     | Interception | Invalid Proof    | False Negative (FN)   |
| AB-04  | Multi-Oracle Deadlock      | MEDIUM   | Consensus    | Wasted Requests  | False Negative (FN)   |
+--------+----------------------------+----------+--------------+------------------+-----------------------+
```

---

## 10. Deep Red-Team Attack on Architecture C (DSS-BIG)
### Section 63 Item 10: State Mutation, Concurrency Races & Dynamic Graph Chaos

```
+----------------------------------------------------------------------------------------------------+
|                               ARCHITECTURE C: DSS-BIG ATTACK SURFACE                               |
+----------------------------------------------------------------------------------------------------+
  [Twin Probe Pair (R_probe, R_control)] ===> [DOM Tree Differencing] ===> [Behavioral Invariance Graph]
                       |                                       |                           |
                       v                                       v                           v
          [State Mutation Races]                     [Dynamic Graph Chaos]       [WAF Rate Ban / 429]
          [Database Data Pollution]                  [A/B Drift False Positives] [Session Invalidation]
```

### 10.1 Attack Vector 1: State Desynchronization & Permanent Database State Mutation Under Concurrency
#### 10.1.1 Theoretical Vulnerability
Architecture C relies on **Twin-Channel Shadow Mirroring**, dispatching simultaneous request pairs $(R_{\text{probe}}, R_{\text{control}})$ to measure the structural graph delta $\Delta \text{BIG} = d_{\text{DOM}}(G_{\text{probe}}, G_{\text{control}})$.

**The Destructive Mutation Flaw:** In relational databases, SQL injection vulnerabilities are not restricted to read-only `SELECT` statements. They frequently occur in data-mutating DML/DDL statements:
```sql
UPDATE user_accounts SET email = '[INJECTION]', updated_at = NOW() WHERE id = 42;
DELETE FROM shopping_cart WHERE item_id = [INJECTION] AND session_id = 'sess_123';
INSERT INTO audit_logs (event, user_id) VALUES ('login', [INJECTION]);
```

```
[DSS-BIG Engine]
  Dispatches Twin Pair:
    R_probe   (Payload: "42 OR 1=1")   -------------------> Executes First! UPDATE matches ALL rows!
    R_control (Payload: "42")          --------+            All 500,000 user emails overwritten!
                                               |
                                               v (Executes 2ms later)
                                       Operates on Destroyed Database State!
                                       Response reflects corrupted data ===> ?BIG >> Threshold
                                       Engine declares finding... BUT CLIENT DATA IS PERMANENTLY CORRUPTED!
```

#### 10.1.2 Concrete Failure Scenario: Shopping Cart Row Deletion Race
1. Target endpoint: `POST /cart/remove` with parameter `item_id`.
2. Backend query: `DELETE FROM cart WHERE item_id = $item_id AND user_id = $user_id`.
3. DSS-BIG dispatches $R_{\text{probe}}$ with item ID `101 OR 1=1` and $R_{\text{control}}$ with item ID `101`.
4. $R_{\text{probe}}$ arrives at $t_0$, executing `DELETE FROM cart WHERE item_id = 101 OR 1=1`, purging **all items** from the user's cart.
5. $R_{\text{control}}$ arrives at $t_0 + 5\text{ms}$, executing `DELETE FROM cart WHERE item_id = 101`. Because the cart is already empty, the application returns `"Cart is empty"` (DOM Size: 1,200 bytes).
6. $R_{\text{probe}}$ had returned `"15 items removed"` (DOM Size: 4,500 bytes).
7. The Behavioral Invariance Graph computes $\Delta G = 3,300\text{ bytes} \gg \tau_{\text{drift}}$.
8. **Catastrophic Failure Modes:**
   - **Data Destruction:** The user's active session state is completely destroyed.
   - **False Positive Risk:** If the parameter were non-vulnerable (e.g. parameterized `DELETE WHERE item_id = 101`), but $R_{\text{probe}}$ deleted the single item, $R_{\text{control}}$ arriving second finds 0 items, producing a non-zero DOM delta $\Delta G > 0$ and triggering a **False Positive**.

---

### 10.2 Attack Vector 2: Scan-Induced Rate Limiting, WAF IP Banning & Captcha Triggers
#### 10.2.1 Theoretical Vulnerability
DSS-BIG's twin-channel mirroring requires dispatching at least two HTTP requests for every baseline calibration, plus two HTTP requests for every semantic no-op perturbation ($N_{\text{perturb}} \ge 4$). 
$$\text{Total Requests per Parameter } R_{\text{DSS}} = 2 \times N_{\text{baseline}} + 2 \times N_{\text{perturb}} \times N_{\text{hier}} \approx 24 \text{ to } 64 \text{ requests}$$

**Rate Limiting & Token Bucket Depletion:** Modern cloud edge defenses (Cloudflare, CloudFront, Imperva) enforce strict token bucket rate limiters parameterized by capacity $\beta$ and refill rate $\rho$:
$$T_{\text{ban}} = \inf \left\{ t \ge 0 : \sum_{i=1}^{M(t)} c_i > \beta + \rho t \right\}$$
Because DSS-BIG dispatches twin requests in immediate parallel bursts ($c_i = 2$ within $\Delta t < 5\text{ms}$), it rapidly depletes the edge token bucket $\beta$.

```
Requests Sent
       ^
       |                                   [Cloudflare 429 Tarpit / IP Ban]
 40 req|                                         /=========================
       |                                        /
 30 req|                                       /  DSS-BIG Burst Velocity
       |                                      /   (Twin Requests)
 20 req|                                     /
       |                [Token Bucket Limit ? = 20]
 10 req|-----------------------------------/
       +------------------------------------------------------------------> Time (s)
       0s             0.5s             1.0s             1.5s
```

#### 10.2.2 Impact on Scan Lifecycle
Once the WAF triggers an IP ban or serves an interstitial Cloudflare Turnstile / reCAPTCHA challenge:
1. All subsequent HTTP responses return HTTP $429\text{ Too Many Requests}$ or HTTP $403\text{ Forbidden}$.
2. The BIG graph delta collapses to zero ($\Delta G = 0$ because all responses are identical 429 challenge pages).
3. The scanner marks all remaining 150 endpoints in scope as **100% Non-Vulnerable (Massive False Negatives across the target application)**.

---

### 10.3 Attack Vector 3: Non-Deterministic Application Logic & Dynamic Graph Invariance Breakdown
#### 10.3.1 Theoretical Vulnerability
Architecture C's fundamental mathematical invariant is:
$$\Delta \text{BIG}(R_{\text{control}}, R_{\text{probe}}) \le \mu_t + 4.5 \sigma_t \quad (\text{under benign No-Op perturbation})$$

**Dynamic Non-Determinism in Modern SPAs:** Modern enterprise applications integrate multiple dynamic components:
- **A/B Testing Frameworks (Optimizely, LaunchDarkly):** Randomly assign variant UI layouts $V_A, V_B$ on each HTTP request based on server load or microsecond timestamps.
- **Dynamic Ad Pixels & Tracking Nonces:** Inject unique 128-bit random strings into DOM attributes.
- **Rotating Recommendation Feeds:** Database queries ordered by `ORDER BY RAND()` or dynamic Redis queues.

```
Request 1 (R_probe):   Returns Variant A (Sidebar on Left, 3 Banner Ads, Nonce: 0x9F82A)
Request 2 (R_control): Returns Variant B (Sidebar on Right, 4 Banner Ads, Nonce: 0x1A4C7)
                                 |
                                 v
                 DOM Tree Edit Distance (RTED):
                 Node Insertions: +14, Node Deletions: -8, Attribute Diffs: 42
                 Computed Graph Delta: ?BIG = 0.482 >> Drift Threshold (0.05)
                                 |
                                 v
                 DSS-BIG Classification: VULNERABLE (CATASTROPHIC FALSE POSITIVE!)
```

#### 10.3.2 Mathematical Proof of Graph Entropy Collapse
Let the intrinsic non-deterministic graph variance be $\sigma_{\text{app}}^2$. When the application serves randomized dynamic content, the distribution of graph deltas under pure benign baseline requests $R_1, R_2$ is:
$$\Delta G_{\text{benign}} \sim \text{Weibull}(\lambda, k) \quad \text{where } \mathbb{P}(\Delta G > \tau) > 0.35$$
Because the variance $\sigma_{\text{app}}$ is non-Gaussian and heavy-tailed, the $4.5\sigma$ Gaussian drift threshold fails. The engine either:
1. **Emits constant False Positives:** Falsely reporting every page with rotating banners or A/B testing as SQL injection.
2. **Auto-relaxes $\tau_{\text{drift}}$ to infinity:** In an attempt to suppress noise, the engine increases $\tau$ so high that authentic 1-bit boolean injection deltas (e.g. single item presence) fall below $\tau$, yielding **False Negatives**.

#### 10.3.3 Summary Matrix of Architecture C Vulnerabilities
```
+--------+----------------------------+----------+--------------+------------------+-----------------------+
| ID     | Attack Vector              | Severity | Target Phase | Risk Profile     | Detection Failure     |
+--------+----------------------------+----------+--------------+------------------+-----------------------+
| AC-01  | Concurrency State Mutation | CRITICAL | Twin Probing | Data Loss / DML  | False Positive / Data |
| AC-02  | WAF IP Banning / 429 Tarpit| HIGH     | HTTP Traffic | Premature Abort  | False Negative (FN)   |
| AC-03  | Dynamic Graph Chaos (A/B)  | CRITICAL | DOM Diffing  | High Noise Floor | False Positive (FP)   |
| AC-04  | Anti-CSRF Token Depletion  | MEDIUM   | Session Jar  | Auth Loss        | False Negative (FN)   |
+--------+----------------------------+----------+--------------+------------------+-----------------------+
```

---

## 11. Comprehensive Red-Team Synthesis & Cross-Architecture Comparison

The following master vulnerability matrix synthesizes all 12 core red-team attack vectors across Architectures A, B, and C, proving why **none of the three candidate architectures can be deployed in isolation without fundamental hybridization**:

```
+-----------------------------------------------------------------------------------------------------------------------------------------------+
|                                      MASTER RED-TEAM ARCHITECTURAL VULNERABILITY MATRIX                                                       |
+-----+----------------------------------+------------------------------+------------------------------+----------------------------------------+
| #   | Vulnerability / Attack Dimension | PAL-GME (Architecture A)     | DMC-SMT (Architecture B)     | DSS-BIG (Architecture C)               |
+-----+----------------------------------+------------------------------+------------------------------+----------------------------------------+
| 1   | Primary Failure Mode             | False Positives from Dynamic | False Negatives from SMT     | Database State Corruption & False      |
|     |                                  | Reflection & Likelihood Trap | Timeouts & Dialect Gaps      | Positives from Dynamic A/B Chaos       |
| 2   | Computational Bottleneck         | SCFG Combinatorial Explosion | String Theory Constraint     | DOM Tree-Edit Distance & Graph Match   |
|     |                                  | on Nested Dialects (d > 4)   | Undecidability (Z3 Timeout)  | Complexity (O(|V|^2))                  |
| 3   | WAF Resilience                   | Low (Trapped by Non-Convex   | Low (Broken by Comment/Space | Very Low (Trips Rate Limits & IP Bans  |
|     |                                  | Stochastic Response Masking) | Normalization & Rewriting)   | via 2x-4x Parallel Twin Bursts)        |
| 4   | State Mutation Safety            | Safe (Stateless Read Probing)| Safe (Read-Only SMT Bounds)  | EXTREMELY HAZARDOUS (Mutates & Deletes |
|     |                                  |                              |                              | Production Rows via DML Injections)    |
| 5   | Noise Immunity (Dynamic SPAs)    | Moderate (Continuous CLE     | High (Decoupled Structural   | Poor (Graph Entropy Collapse under     |
|     |                                  | Likelihood Drifts on Noisy Y)| Oracles Filter HTML Noise)   | Non-Deterministic A/B & Ad Pixels)     |
| 6   | Exploit Synthesis Completeness   | Bounded by Grammar Sampling  | Bounded by SMT Dialect Logic | Universal No-Op Perturbations          |
|     |                                  | Depth (Misses JSON/CTE SQLi) | (Misses Vendor Proprietary)  | (Operates across all SQL Dialects)     |
| 7   | Request Budget Efficiency        | High (6 - 18 Requests via    | High (8 - 22 Requests via    | Low (24 - 64 Requests via Mandatory    |
|     |                                  | BALD Information Gain)       | Targeted SMT Invariants)     | Multi-Channel Twin Probing)            |
| 8   | Formal Soundness Guarantee       | Probabilistic (P(FP) <= 10^-4| Mathematical (Zero False     | Statistical (Bounded by 4.5?           |
|     |                                  | under Ideal Stationary Noise)| Positives via Causal Proofs) | Empirical Drift Model)                 |
+-----+----------------------------------+------------------------------+------------------------------+----------------------------------------+
```

### 11.1 The Inevitable Conclusion: The Unified Hybrid Mandate
The adversarial stress tests demonstrate that:
1. **PAL-GME's** information-theoretic active search is essential for fast context discovery under tight request budgets, but requires **DMC-SMT's** causal counterfactuals to eliminate reflection false positives.
2. **DMC-SMT's** formal mathematical proofs are essential for zero-false-positive certification, but require **PAL-GME's** stochastic grammar to bypass WAF rewriting and avoid SMT solver timeouts.
3. **DSS-BIG's** semantic no-op differential concepts provide unmatched black-box robustness, but must be decoupled from destructive twin-request concurrency through **Strict Read-Only Pre-Flight Verification** and **AST Subtree Locality Masking**.

*This concludes Part 2: Adversarial Red-Team Attacks on Candidate Architectures.*

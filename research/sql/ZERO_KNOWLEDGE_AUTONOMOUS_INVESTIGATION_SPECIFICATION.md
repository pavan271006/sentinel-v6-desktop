# SENTINEL ZERO-KNOWLEDGE AUTONOMOUS INVESTIGATION SPECIFICATION
## The Scientific Discovery Engine: Generalization Over Unknown Targets from Raw HTTP Requests

---

### 1. Foundational Doctrine: The Student-Exam Separation Principle

$$\text{PORTSWIGGER IS THE EXAM. SENTINEL IS THE STUDENT WHO DOES NOT SEE THE ANSWER KEY.}$$

A dynamic security scanner that incorporates target-specific shortcuts—such as recognizing specific lab URLs, hard-coding known parameter names like `TrackingId`, looking for pre-determined string signatures like `"Welcome back"`, expecting specific table names like `users`, or executing a rigid, linear playbook—is not a security scanner. It is a benchmark cheat.

When deployed in the real world, such a system fails catastrophically against unfamiliar applications, modern single-page architectures, proprietary microservices, and evolving cloud databases.

**The Zero-Knowledge Target Invariant ($\mathcal{Z}_0$)**:
Sentinel and its underlying UCMA-X engine must operate under **complete zero-knowledge** of the target application's internal architecture, database engine, SQL context, vulnerability class, and database contents. 

The engine receives strictly:
1. **ONE RAW HTTP REQUEST** (or equivalent RFC 7230 wire representation).
2. **Optional User-Supplied Scope & Authentication Capabilities** (session cookies, Bearer tokens, or OpenAPI definitions explicitly authorized by the security operator).

Nothing else may be assumed. No target identity, no parameter heuristics, no predetermined vulnerability category, and no hardcoded extraction dictionaries.

---

### 2. The Ten-Phase Zero-Knowledge Investigation Pipeline

Instead of executing a static payload list, Sentinel treats vulnerability assessment as an **autonomous scientific investigation**. It maintains a dynamic probabilistic belief state and progresses through ten adaptive phases:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               TEN-PHASE ZERO-KNOWLEDGE AUTONOMOUS INVESTIGATION                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

   [INPUT: 1 Raw HTTP Request]
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 1: Zero-Assumption Surface Discovery        │ ──► Extracts ALL parameter vectors without naming bias
   │          (Query, Cookie, Header, JSON, GraphQL)   │
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 2: Lexical Typing & Input Constraint Mining │ ──► Discovers formats: Int, UUID, Float, String, Date
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 3: Triple-Quorum Baseline Characterization  │ ──► Establishes response stability & invariant DOM mask
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 4: Autonomous Observation Channel Discovery │ ──► Discovers available signals: Status, DOM, Error, Timing
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 5: Sensitivity & Reactivity Profiling       │ ──► Discovers which parameters influence application state
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 6: SQL Interpreter Reachability Probing     │ ──► Proves input reaches an unparameterized SQL parser
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 7: Context Lattice Inversion                │ ──► Resolves syntactic enclosure: Quotes, Parentheses, etc.
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 8: DBMS Hypothesis Disambiguation           │ ──► Discovers database dialect via syntax differentials
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 9: Causal Metamorphic Triad Confirmation    │ ──► Mathematical proof of vulnerability (Zero False Positives)
   └───────────────────────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────────────────────────────┐
   │ Phase 10: Autonomous Schema & Data Discovery      │ ──► Zero-knowledge data extraction from first principles
   └───────────────────────────────────────────────────┘
```

---

### 3. Phase-by-Phase Specification

#### Phase 1: Zero-Assumption Surface Discovery
The scanner ingests the raw HTTP request and parses it into discrete parameter candidates without any preconception of which parameter is significant:
* **Query Parameters**: Key-value pairs extracted from the request URI path and query string.
* **Cookies**: All `Cookie` header tokens parsed according to RFC 6265. No cookie is assumed to be an authentication token, a session identifier, or a tracking identifier unless empirically demonstrated.
* **Headers**: Application-controlled headers (e.g., `X-*`, `User-Agent`, `Referer`, `Origin`, `Accept-Language`).
* **Structured Bodies**:
  * Form URL-encoded (`application/x-www-form-urlencoded`).
  * Multipart Form Data (`multipart/form-data`).
  * JSON Objects (`application/json`): Traversed recursively. Every key, primitive value (string, number, boolean), and array element becomes an independent candidate injection coordinate.
  * GraphQL (`application/graphql` or JSON POST): Operates over both query literal arguments and nested variables objects.
  * XML / SOAP (`text/xml`, `application/xml`): Ingests tag values and attribute strings.

#### Phase 2: Lexical Typing & Input Constraint Mining
Before mutating an input, Sentinel infers the parameter's native data type and structural constraints by analyzing its baseline value $v_0$:
* **Type Discovery**:
  $$\tau(v_0) = \begin{cases}
  \text{Integer} & \text{if } v_0 \in \mathbb{Z} \\
  \text{Decimal} & \text{if } v_0 \in \mathbb{R} \\
  \text{UUID} & \text{if } v_0 \text{ matches RFC 4122 regex} \\
  \text{ISO-Date} & \text{if } v_0 \text{ matches ISO-8601} \\
  \text{HexToken} & \text{if } v_0 \in \{0\text{--}9, \text{a--f}\}^n \land n \ge 16 \\
  \text{Base64} & \text{if } v_0 \text{ is valid RFC 4648 Base64} \\
  \text{FreeformText} & \text{otherwise}
  \end{cases}$$
* **Constraint Discovery**: Measures character length $L = |v_0|$, allowed alphabet $\Sigma_{v_0}$, and boundary delimiters. This ensures subsequent test probes do not fail upstream application routing or schema validation unnecessarily.

#### Phase 3: Triple-Quorum Baseline Characterization
Sentinel issues three identical, unmutated baseline requests: $B_1, B_2, B_3$.
* **Stability Evaluation**:
  Computes the stability ratio across status codes, response headers, and DOM nodes:
  $$\mathcal{S}_{\text{DOM}} = \frac{|\text{DOM}(B_1) \cap \text{DOM}(B_2) \cap \text{DOM}(B_3)|}{\max(|\text{DOM}(B_1)|, |\text{DOM}(B_2)|, |\text{DOM}(B_3)|)}$$
* **Stable DOM Mask Generation ($\mathcal{M}_{\text{stable}}$)**:
  Identifies nodes that fluctuate under zero input variation (e.g., dynamic timestamps, rotating ads, CSRF tokens). Fluctuating nodes are assigned zero weight ($W_n = 0$), constructing an invariant projection $\Pi_{\mathcal{M}}$ for all subsequent differential evaluations.

#### Phase 4: Autonomous Observation Channel Discovery
The scanner does not assume how an application will reflect SQL execution. It actively discovers which observation channels exist for the endpoint:
1. **Status Code Channel ($\mathcal{O}_{\text{status}}$)**: Does the target application use HTTP status codes (e.g., 200 vs 404 vs 500) to reflect internal state?
2. **Structural DOM Channel ($\mathcal{O}_{\text{dom}}$)**: Does the application alter its HTML DOM tree (rendering new containers, tables, or buttons)?
3. **Textual Token Differential Channel ($\mathcal{O}_{\text{token}}$)**: Does the application add or remove specific text tokens (without knowing in advance what those tokens mean)?
4. **Error Reflection Channel ($\mathcal{O}_{\text{error}}$)**: Does the response disclose raw database error messages or internal stack traces?
5. **Execution Latency Channel ($\mathcal{O}_{\text{timing}}$)**: What is the empirical latency distribution $\hat{f}(t)$ under unmutated requests?
6. **Out-of-Band Network Channel ($\mathcal{O}_{\text{oast}}$)**: Is asynchronous egress DNS or HTTP callback possible?

#### Phase 5: Sensitivity & Reactivity Profiling (Inert Parameter Pruning)
Sentinel tests whether a parameter is actively processed by the application or is completely ignored.
* For each parameter $p_i$, the scanner fires two benign, non-destructive semantic perturbations:
  * Perturbation 1: $v_0 \mathbin{\Vert} \text{"_test"}$
  * Perturbation 2: Random value of identical type $\tau(v_0)$.
* **Reactivity Evaluation**:
  If all observation channels yield zero differential entropy ($\Delta \mathcal{O} = 0$) and the response is bit-identical to the baseline, the parameter is classified as **Inert** and immediately relegated to the lowest priority queue. This prunes unreactive headers (`User-Agent`, `Referer`) in $\le 2$ requests.

#### Phase 6: SQL Interpreter Reachability Probing
For reactive parameters, Sentinel seeks evidence that input is passed unparameterized to a SQL parser.
* Rather than firing hundreds of generic payloads, it applies the **Syntax Paired Diagnostic**:
  * Probe A (Syntax Break): Injects a single syntax-breaking character appropriate to the inferred type:
    * If `Type::Text`: Injects `'`
    * If `Type::Integer`: Injects an arithmetic operator `+` or `-`
  * Probe B (Syntax Repair): Injects a syntax-repairing character:
    * If `Type::Text`: Injects `''` (SQL standard literal escape)
    * If `Type::Integer`: Injects a balanced expression `+0`
* **Reachability Criterion**:
  If the application exhibits a noticeable divergence on Probe A (e.g., HTTP 500, missing content, or database syntax error) but restores the baseline response on Probe B:
  $$R(\text{Probe B}) \equiv R(\text{Baseline}) \not\equiv R(\text{Probe A})$$
  SQL execution reachability is established with initial confidence $P(\text{SQL Reachable}) \ge 0.85$.

#### Phase 7: Context Lattice Inversion
Once SQL reachability is indicated, Sentinel determines the enclosing SQL syntactic boundary $\mathcal{C}$ by evaluating candidate lattice coordinates:
* **String Single-Quote Context (`'`)**: Validated via paired concatenation (`' '` or `'||'`).
* **String Double-Quote Context (`"`)**: Validated via double-quote balancing (`""`).
* **Numeric Literal Context**: Validated via mathematical identity ($x \equiv x - 0 \equiv x \times 1$).
* **Parenthetical Nesting Depth ($D \in \{0, 1, 2, 3\}$)**: Evaluated by testing balanced parenthesis closures: `) AND 1=1 AND (1=(1`, `)) AND 1=1 AND ((1=(1`.
* **Clause Type**: Infers whether injection is in `WHERE` (supports boolean predicates), `ORDER BY` (supports numeric indexing or conditional expressions), or `INSERT/UPDATE` (supports multiple value tuples).

#### Phase 8: DBMS Hypothesis Disambiguation
Sentinel does not guess the database engine from a banner or user flag. It formulates a probabilistic distribution over DBMS families and disambiguates them using **Dialect Differential Probes**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DIALECT DIFFERENTIAL DECISION LATTICE                     │
├──────────────────────────┬──────────────────────┬──────────────────────┬───────────────┤
│ Diagnostic Expression    │ Evaluates to Valid   │ Evaluates to Syntax  │ Inferred DBMS │
│                          │ in DBMS              │ Error in DBMS        │ Hypothesis    │
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────┤
│ 'a' || 'b' = 'ab'        │ Postgres, SQLite,    │ MySQL, MSSQL         │ P(PG/SQLite/  │
│                          │ Oracle               │                      │ Oracle) ↑     │
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────┤
│ 'a' + 'b' = 'ab'         │ MSSQL                │ Postgres, MySQL,     │ P(MSSQL) ↑    │
│                          │                      │ Oracle, SQLite       │               │
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────┤
│ CONCAT('a','b') = 'ab'   │ MySQL, Postgres,     │ SQLite (legacy)      │ P(MySQL/PG/   │
│                          │ Oracle               │                      │ Oracle) ↑     │
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────┤
│ (SELECT 1 FROM dual)     │ Oracle               │ Postgres, SQLite     │ P(Oracle) ↑   │
├──────────────────────────┼──────────────────────┼──────────────────────┼───────────────┤
│ @@version IS NOT NULL    │ MSSQL, MySQL         │ Postgres, Oracle,    │ P(MSSQL/      │
│                          │                      │ SQLite               │ MySQL) ↑      │
└──────────────────────────┴──────────────────────┴──────────────────────┴───────────────┘
```

Within 2 to 4 queries, the posterior probability $P(\text{DBMS} = D \mid \text{Responses})$ converges to $\ge 0.95$.

#### Phase 9: Causal Metamorphic Triad Confirmation (Zero False Positives)
Sentinel never reports a vulnerability based on an error message or status code alone. Confirmation requires satisfying the **Metamorphic Invariant Triad** using a dynamically synthesized boolean predicate $\phi$:
1. **True Evaluation**: Synthesizes a predicate guaranteed to evaluate to TRUE under the inferred context and DBMS:
   $$P_{\text{TRUE}} = \text{SynthesizePredicate}(\mathcal{C}, \text{DBMS}, \text{TRUE})$$
2. **False Evaluation**: Synthesizes a predicate guaranteed to evaluate to FALSE:
   $$P_{\text{FALSE}} = \text{SynthesizePredicate}(\mathcal{C}, \text{DBMS}, \text{FALSE})$$
3. **Inversion Evaluation**: Evaluates the logical negation:
   $$P_{\text{NEG}} = \text{SynthesizePredicate}(\mathcal{C}, \text{DBMS}, \neg(\text{TRUE}))$$

**The Confirmation Quorum**:
$$\Pi_{\mathcal{M}}(R(P_{\text{TRUE}})) \equiv \Pi_{\mathcal{M}}(R(\text{Baseline})) \quad \land \quad \Pi_{\mathcal{M}}(R(P_{\text{FALSE}})) \not\equiv \Pi_{\mathcal{M}}(R(\text{Baseline})) \quad \land \quad \Pi_{\mathcal{M}}(R(P_{\text{NEG}})) \equiv \Pi_{\mathcal{M}}(R(P_{\text{FALSE}}))$$

If this triad holds across independent trials, the parameter is confirmed vulnerable with **mathematical certainty**. The scanner has discovered the vulnerability from first principles without knowing what the application does.

#### Phase 10: Autonomous Schema & Data Discovery
Once a vulnerability is causally confirmed, Sentinel does not execute a hardcoded extraction script. It explores the database through **autonomous query construction**:
1. **Schema Metadata Discovery**:
   * Queries standard ANSI `information_schema.tables` or dialect equivalents (`sqlite_master`, `all_tables`, `sys.tables`).
   * Infers available table names by binary-searching character by character.
2. **Column Discovery**:
   * Inspects `information_schema.columns` for the discovered tables.
3. **Data Discovery**:
   * Ingests discovered columns and extracts records using **Frequency-Tuned Information-Entropy Binary Search** ($4.1$ requests per character).
   * Terminating conditions are determined dynamically by string length queries (`LENGTH(col) = N`), not predefined limits.

---

### 4. Dynamic Experiment Selection & Replanning Loop

At every step of the investigation, Sentinel selects its next action using the **POMDP Information-Gain Formulation**:

```
                       ┌──────────────────────────────────────┐
                       │ Current Belief State b(Hypotheses)   │
                       └──────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │ Generate Candidate Probes A = {a_i}  │
                       │ (Filtered by Context & SMT Rules)    │
                       └──────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │ For each candidate probe a_i:        │
                       │ Compute Expected Information Gain:   │
                       │ EIG(a_i) = H(b) - E_{o}[ H(b' | o) ] │
                       │ Compute Cost: C(a_i) = Latency + Risk│
                       └──────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │ Select Action:                       │
                       │ a* = argmax [ EIG(a_i) / C(a_i) ]    │
                       └──────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │ Dispatch Wire Probe & Observe Delta  │
                       └──────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │ Update Belief Distribution:          │
                       │ b'(H) = P(o | H, a*) * b(H) / P(o)   │
                       └──────────────────────────────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
                 [Confidence ≥ 99.99%?]          [Confidence Undecided?]
                         │                                 │
                         ▼                                 ▼
                 [Confirm Vulnerability]           [Loop & Replan a*]
```

---

### 5. Architectural Invariant Summary

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            ZERO-KNOWLEDGE ARCHITECTURAL INVARIANTS                               │
├──────────────────────────────────┬───────────────────────────────────────────────────────────────┤
│ Prohibited Anti-Pattern          │ Mandated Zero-Knowledge Design Pattern                        │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Hardcoded parameter names        │ Autonomous Parameter Extraction from Raw HTTP                 │
│ (`TrackingId`, `id`, `user`)     │ (Every query key, cookie, header, and JSON key evaluated)     │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Target-specific string matches   │ Differential Invariant Normalizer (DIN)                       │
│ (`"Welcome back"`, `"Admin"`)    │ (Dynamically discovers whatever DOM node or token mutates)    │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Hardcoded SQLi category playbook │ Dynamic Hypothesis Lattice                                    │
│ (Try Boolean, then Error, etc.)  │ (Probe selected dynamically by EIG / Cost optimization)       │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Hardcoded DBMS assumptions       │ Dialect Differential Decision Lattice                         │
│ (Assuming Postgres or MySQL)     │ (Disambiguates engine via syntax evaluation differentials)    │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Hardcoded database schema names  │ Autonomous Information Schema Exploration                     │
│ (`users`, `passwords`)           │ (Discovers tables, columns, and records from first principles) │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Static payload dictionaries      │ SMT-Constrained Intermediate Representation (UCMA-IR)         │
│ (Replaying 350 flat text strings)│ (Compiles typed ASTs satisfying active WAF and dialect rules) │
└──────────────────────────────────┴───────────────────────────────────────────────────────────────┘
```

By adhering strictly to this Zero-Knowledge Autonomous Investigation Specification, Sentinel operates not as a benchmark memorizer, but as an **authentic scientific instrument** capable of discovering, validating, and extracting SQL vulnerabilities across any unfamiliar modern web target.

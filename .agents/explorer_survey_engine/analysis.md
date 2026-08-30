# Research Engine & Independent Verifier: Comprehensive Architectural Survey & Specification
**Document ID**: `SURVEY-ENG-R4-R5-2026`  
**Target Milestone**: M0 (Survey & Scope Mapping) -> M3 (Research Engine) & M4 (Independent Verifier)  
**Author**: Explorer Survey Engine Lead (`explorer_survey_engine`)  
**Target Systems**: `research_lab/research_engine/`, `research_lab/verifier/`, `research_lab/contracts/`  
**Compliance Standard**: Fail-Closed Verification, 0% Negative Control FP, Strict Logical Separation

---

## 1. Executive Summary & System Philosophy

The Security Research Laboratory requires an autonomous, self-directed vulnerability research and validation capability capable of discovering both known vulnerability classes and novel, complex multi-step security anomalies in modern web applications. To guarantee absolute scientific rigor, eliminate cognitive bias, and avoid false discoveries, the platform bifurcates the testing workflow into two logically air-gapped subsystems:

1. **The Autonomous Black-Box Research & Hypothesis Engine (Requirement R4)**: An active, exploratory system that observes application surfaces, constructs rich contextual state models, generates formal hypotheses (H1–H10), plans adaptive test strategies, and analyzes differential responses.
2. **The Independent Verifier & Novelty Gate (Requirement R5)**: A clean-room validation harness that consumes declarative finding descriptors, independently reconstructs reproduction sequences without researcher runtime code, enforces dual-oracle evaluation (positive triggers vs. negative controls), evaluates noise resistance, and executes a multi-source prior-art search across global vulnerability and academic databases to classify novelty (KNOWN, VARIANT, NOVEL-CANDIDATE, CONFIRMED-NOVEL).

```
+---------------------------------------------------------------------------------------------------+
|                                  AUTONOMOUS RESEARCH WORKFLOW                                     |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                     AUTONOMOUS RESEARCH ENGINE (Requirement R4)                             |  |
|  |                                                                                             |  |
|  |  +---------------+      +---------------+      +-------------------+                        |  |
|  |  |   Observer    | ---> | Context Model | ---> | Hypothesis Engine |                        |  |
|  |  |  (Traffic/    |      | (Entity/State |      |     (H1 - H10)    |                        |  |
|  |  |   Surface)    |      |    Graph)     |      +---------+---------+                        |  |
|  |  +---------------+      +---------------+                |                                  |  |
|  |          ^                      ^                        v                                  |  |
|  |          |                      |              +-------------------+                        |  |
|  |          |                      +------------- |   Test Planner    |                        |  |
|  |          |                                     |    (Adaptive)     |                        |  |
|  |          |                                     +---------+---------+                        |  |
|  |          |                                               |                                  |  |
|  |          |                                               v                                  |  |
|  |          +------------------------------------- +-------------------+                       |  |
|  |                                                 |Differential Engine|                       |  |
|  |                                                 +---------+---------+                       |  |
|  +-----------------------------------------------------------|---------------------------------+  |
|                                                              | (Declarative Finding Spec)         |
|                                                              v                                    |
|  +---------------------------------------------------------------------------------------------+  |
|  |                     INDEPENDENT VERIFIER & NOVELTY GATE (Requirement R5)                    |  |
|  |                                                                                             |  |
|  |  +---------------------------+      +--------------------------+      +------------------+  |  |
|  |  | Clean-Room Reconstruction | ---> | Dual-Control Harness     | ---> | Prior-Art Engine |  |  |
|  |  | (Independent Replay)      |      | (+ Positive / - Control) |      | (CVE/NVD/GHSA/   |  |  |
|  |  +---------------------------+      +--------------------------+      |  Academic DB)    |  |  |
|  |                                                                       +--------+---------+  |  |
|  |                                                                                |            |  |
|  |                                                                                v            |  |
|  |                                                                       +------------------+  |  |
|  |                                                                       | 4-Tier Gate      |  |  |
|  |                                                                       | (KNOWN / VARIANT/|  |  |
|  |                                                                       |  NOVEL / CONFIRM)|  |  |
|  |                                                                       +------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Requirement R4: Autonomous Black-Box Research & Hypothesis Engine

The black-box research engine operates without access to source code or internal server logs. It must infer internal application semantics, entity relationships, authorization topologies, and state machines purely through external observation and active probing.

### 2.1 Component 1: Observer (Traffic & Surface Extraction)

The **Observer** is responsible for real-time passive inspection and active extraction of the attack surface from all HTTP/S, WebSocket, and API traffic.

```
+-------------------------------------------------------------------------------+
|                             OBSERVER ARCHITECTURE                             |
+-------------------------------------------------------------------------------+
|                                                                               |
|   Inbound/Outbound Traffic Stream (HTTP/1.1, HTTP/2, WebSocket, gRPC-Web)     |
|                                      |                                        |
|                                      v                                        |
|   +-----------------------------------------------------------------------+   |
|   | 1. Protocol Normalizer & Raw Byte Stream Parser                       |   |
|   |    - Method, Path, Query, Headers, Body, HTTP Version, TLS Ciphers    |   |
|   +-----------------------------------------------------------------------+   |
|                                      |                                        |
|         +----------------------------+----------------------------+           |
|         |                                                         |           |
|         v                                                         v           |
|   +---------------------------------------+   +---------------------------+   |
|   | 2. Parameter & Surface Extractor      |   | 3. Response Profiler      |   |
|   |    - Query / Path Parameters          |   |    - Status Code Taxonomy |   |
|   |    - Body (JSON, Form, Multipart, XML)|   |    - Structural DOM / AST |   |
|   |    - Header / Cookie extraction       |   |    - Response Latency Dist|   |
|   |    - Dynamic token / Nonce detection  |   |    - Information Entropy  |   |
|   +---------------------------------------+   +---------------------------+   |
|         |                                                         |           |
|         +----------------------------+----------------------------+           |
|                                      |                                        |
|                                      v                                        |
|   +-----------------------------------------------------------------------+   |
|   | 4. Schema & Interface Synthesizer                                     |   |
|   |    - Inferred OpenAPI 3.1 & JSON-Schema specs                         |   |
|   |    - Dynamic Parameter Typing (UUID, int, base64, timestamp, hash)    |   |
|   |    - Session & Identity Provenance Tagging                            |   |
|   +-----------------------------------------------------------------------+   |
|                                      |                                        |
|                                      v                                        |
|                         To Context Model (Graph Nodes)                        |
|                                                                               |
+-------------------------------------------------------------------------------+
```

#### Core Capabilities of the Observer
1. **Multi-Format Parameter Extraction**:
   - URL Query and Path Segments (e.g., `/api/v1/orgs/{org_id}/users/{user_id}`).
   - Form-URL-Encoded and Multipart payload parsing.
   - Deep nested JSON structure parsing with JSON-Path indexing.
   - XML, SOAP, and GraphQL payload extraction (query AST decomposition).
   - HTTP Headers (standard headers, routing headers like `X-Forwarded-For`, custom tenant headers).
   - Cookie jars, Session IDs, and JWT decomposition.
2. **Dynamic Schema & Type Inference**:
   - Reconstructs JSON Schemas dynamically based on observed request/response pairs.
   - Infers semantic scalar types: `UUIDv4`, `Integer(Range)`, `Email`, `ISO8601Date`, `JWT`, `Base64Blob`, `Hash(SHA256)`, `Enum(Values)`.
3. **Response Profiling & Baseline Characterization**:
   - Baseline response size, status code, and header fingerprinting.
   - AST hashing (stripping dynamic tokens, timestamps, and CSRF nonces to establish structural baseline signatures).
   - Latency distribution modeling ($P_{50}, P_{90}, P_{99}$ latency baselines).
   - Shannon Entropy calculation across response bodies (detecting encrypted vs. structured vs. compressed data).
4. **Session & State Provenance Tracking**:
   - Maps every transaction to an active Actor identity (Anonymous, User A, User B, Admin, System).
   - Tracks session rotation, CSRF token refreshes, and OAuth token refreshes.

---

### 2.2 Component 2: Context Model (Entity & State Graph)

The **Context Model** is an in-memory, queryable directed graph representation of the entire target application. It connects assets, endpoints, parameters, identities, resources, and state transitions into a unified semantic map.

```
+-----------------------------------------------------------------------------------+
|                        CONTEXT MODEL: GRAPH TOPOLOGY                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|    +-------------------+                             +-------------------+        |
|    |   Actor: User_A   |                             |   Actor: User_B   |        |
|    |   (Role: Member)  |                             |   (Role: Admin)   |        |
|    +---------+---------+                             +---------+---------+        |
|              |                                                 |                  |
|              | (AUTHENTICATED_AS)                              | (AUTHENTICATED)  |
|              v                                                 v                  |
|    +-------------------+                             +-------------------+        |
|    |  Session: Sess_A  |                             |  Session: Sess_B  |        |
|    +---------+---------+                             +---------+---------+        |
|              |                                                 |                  |
|              | (EXECUTES)                                      | (EXECUTES)       |
|              v                                                 v                  |
|    +---------------------------------------------------------------------+        |
|    |                        Endpoint: /api/v1/orders                     |        |
|    |               Methods: [POST (Create), GET (List/Fetch)]            |        |
|    +----------------------------------+----------------------------------+        |
|                                       |                                           |
|                     (CREATES_RESOURCE / TRANSITIONS_STATE)                        |
|                                       v                                           |
|    +---------------------------------------------------------------------+        |
|    |                      Resource: Order (UUID_102)                     |        |
|    |    State: DRAFT -> SUBMITTED -> APPROVED -> PROCESSED -> FULFILLED  |        |
|    |    Ownership: User_A (Tenant_Alpha)                                 |        |
|    |    Parameters: [amount: 50.00, items: [...], status: "DRAFT"]       |        |
|    +---------------------------------------------------------------------+        |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Graph Schema & Node Types
- **Actor Nodes ($N_{act}$)**: Represent distinct personas, authorization tiers (Anonymous, Standard User, Admin, Auditor), and tenant IDs.
- **Session Nodes ($N_{sess}$)**: Active session state, credentials, JWTs, cookie sets, CSRF tokens.
- **Endpoint Nodes ($N_{ep}$)**: URL patterns, HTTP methods, input parameters, expected status codes, content-types.
- **Parameter Nodes ($N_{param}$)**: Name, location (query/path/header/body), inferred datatype, constraints, reflection status.
- **Resource / Entity Nodes ($N_{res}$)**: Instantiated application objects (e.g., `Tenant(id=1)`, `User(id=42)`, `Invoice(id=1099)`), with explicit ownership metadata.
- **State Transition Nodes ($N_{state}$)**: State machine states (`INIT`, `PENDING_PAYMENT`, `PAID`, `CANCELLED`, `REFUNDED`) and allowable transition edges.

#### Edge Types & Semantics
- `OWNS(Actor -> Resource)`: Declares strict ownership boundaries.
- `AUTHENTICATED_WITH(Actor -> Session)`: Maps active credentials.
- `INVOKES(Session -> Endpoint)`: Maps historical and possible invocations.
- `CREATES(Endpoint -> Resource)` / `MUTATES(Endpoint -> Resource)` / `DELETES(Endpoint -> Resource)`: Data-flow and lifecycle mapping.
- `TRANSITIONS_TO(State_A -> State_B)`: Directed state machine transitions, guarded by preconditions.
- `DEPENDS_ON(Param_X -> Param_Y)`: Data lineage (e.g., output of Step 1 is required input for Step 2).

---

### 2.3 Component 3: Hypothesis Engine & Formal H1–H10 Taxonomy

The **Hypothesis Engine** takes the populated Context Model and evaluates structural, semantic, temporal, and logic rules to generate testable attack hypotheses. Each hypothesis represents a formal claim that a specific application invariant can be violated.

The platform implements ten comprehensive hypothesis classes (H1 through H10):

```
+---------------------------------------------------------------------------------------------+
|                            HYPOTHESIS TAXONOMY (H1 - H10)                                   |
+---------------------------------------------------------------------------------------------+
|                                                                                             |
|  [H1] State Transition & Sequencing Flaws (Out-of-order, state skipping, replay)           |
|  [H2] Authorization Asymmetry & Tenant Leakage (BOLA, IDOR, BFLA, vertical/horizontal)      |
|  [H3] Protocol & Parser Differentials (HTTP smuggling, CL.TE, path/URI normalization)       |
|  [H4] Race Conditions & Concurrency / TOCTOU (Single-packet sync, limit bypass)             |
|  [H5] Type Juggling & Serialization Anomalies (JSON/form casting, array pollution)          |
|  [H6] Business Logic Invariants & Value Constraints (Negative values, coupon stacking)      |
|  [H7] Authentication & Session Integrity (JWT alg confusion, session fixation)              |
|  [H8] Deep Input Validation & Injection Polymorphism (SQLi, NoSQLi, SSTI, Command)         |
|  [H9] Server-Side Request Forgery & Out-of-Band (SSRF, cloud metadata, OAST correlation)    |
|  [H10] Cryptographic & Token Invariants (Predictable RNG, static IVs, timing side-channels)|
|                                                                                             |
+---------------------------------------------------------------------------------------------+
```

#### Detailed Taxonomy Specification

---

#### Hypothesis Class H1: State Transition & Workflow Sequencing Flaws
- **Invariant**: Multi-step business workflows must enforce strict, immutable state progression ($S_0 \to S_1 \to S_2 \to S_n$) and reject out-of-order or skipped transitions.
- **Mechanism**:
  - *Step Skipping*: Invoking step $S_3$ (e.g., `/api/checkout/finalize`) directly after $S_0$ without executing $S_1$ (payment authorization) or $S_2$ (inventory lock).
  - *State Reversion / Replay*: Resubmitting transition requests from a completed state $S_n$ back to an active state $S_1$ to double-claim benefits.
  - *Branch Confusion*: Executing parallel competing branches in a workflow simultaneously.
- **Generation Strategy**: The engine extracts all state paths from the Context Model and creates mutated paths where required intermediate endpoints are omitted, reordered, or executed under alternative session contexts.
- **Verification Oracle**: The final action succeeds (HTTP 200/201 with success status in payload) and the downstream entity state reflects completion without intermediate validation flags set in the database.

---

#### Hypothesis Class H2: Authorization Asymmetry & Tenant Boundary Leakage
- **Invariant**: Every resource operation must strictly enforce both horizontal (tenant/user boundary) and vertical (role hierarchy) authorization guards.
- **Mechanism**:
  - *BOLA / IDOR*: Accessing Resource $R_A$ (owned by Tenant A / User A) using the credentials of User B without permission.
  - *BFLA (Broken Function Level Authorization)*: Invoking administrative or privileged endpoints (e.g., `DELETE /api/admin/users/{id}`, `POST /api/v1/tenant/settings`) using standard user or unauthenticated sessions.
  - *Contextual Authorization Bleed*: Accessing child sub-resources (e.g., `/api/v1/workspaces/{ws_A}/documents/{doc_B}`) where the outer resource belongs to Tenant A but the inner ID belongs to Tenant B.
- **Generation Strategy**: Automated cross-actor permutation matrix across all observed endpoints and parameters ($N_{act} \times N_{ep} \times N_{res}$).
- **Verification Oracle**: Unauthorized actor receives identical 200 OK data as the resource owner, or successful mutation (204 No Content / 200 OK) without an authorization denial (HTTP 401/403).

---

#### Hypothesis Class H3: Protocol & Parser Differentials
- **Invariant**: Front-end reverse proxies (e.g., NGINX, HAProxy, Cloudflare) and backend application runtimes (e.g., Node.js, Go, Python ASGI, Tomcat) must parse HTTP boundaries, paths, and headers with 100% semantic identity.
- **Mechanism**:
  - *HTTP Request Smuggling*: Discrepancies in `Content-Length` vs `Transfer-Encoding: chunked` (CL.TE, TE.CL, TE.TE, HTTP/2 downgrading H2.CL / H2.TE).
  - *Path Normalization Divergence*: Discrepancies in handling URL-encoded slashes (`%2f`), dot-segments (`/..;/`), semicolon path parameters (`/admin;param=1/`), null bytes (`%00`), and Unicode normalization (e.g., UTF-8 overlong sequences).
  - *Header Parsing Confusion*: Duplicate headers with differing values, newline injection (`\r\n`), or tab/whitespace variations.
- **Generation Strategy**: Probing endpoints with dual length indicators, malformed chunk trailers, path traversal mutations, and ambiguous delimiters.
- **Verification Oracle**: Smuggled prefix capture on subsequent requests (HTTP 404/405/400 containing reflection of smuggled request body), backend routing to protected paths bypassing reverse-proxy ACLs, or cache poisoning response contamination.

---

#### Hypothesis Class H4: Race Conditions & Concurrency Flaws (TOCTOU)
- **Invariant**: Critical operations involving resource limits, balances, single-use tokens, or state transitions must be strictly atomic and protected against time-of-check to time-of-use (TOCTOU) race conditions.
- **Mechanism**:
  - *Limit Overrun / Double Spend*: Submitting $N$ identical redemption or withdrawal requests in parallel to exceed an account balance or usage quota.
  - *State Race*: Triggering simultaneous conflicting state updates (e.g., simultaneously submitting an order and cancelling it to receive goods while triggering a refund).
- **Generation Strategy**: Synchronized single-packet HTTP/2 multiplexed frame injection or TCP/TLS socket pre-buffering (sending all headers, then releasing final packet simultaneously across 20–50 parallel connections).
- **Verification Oracle**: Multiple requests succeed (e.g., 5 out of 20 concurrent requests return HTTP 200 instead of exactly 1 returning 200 and 19 returning 409/429/400), resulting in an aggregated state exceeding limits.

---

#### Hypothesis Class H5: Type Juggling & Serialization Anomalies
- **Invariant**: Input parsers and backend deserializers must enforce strict type checking, schema conformance, and safe unmarshalling across all input channels.
- **Mechanism**:
  - *JSON vs Form Type Coercion*: Injecting JSON arrays, boolean literals (`true`, `false`), objects (`{"$gt": ""}`), or null where strings/integers are expected.
  - *PHP/Node Loose Comparison*: Exploiting loose equality (`==`) using magic hashes (`0e1234...`) or boolean truthiness.
  - *Parameter Pollution (HPP)*: Supplying repeated query/body parameters (`?id=1&id=2`) to observe whether the front-end and back-end take the first, last, or concatenated array value.
  - *Prototype Pollution*: Injecting `__proto__`, `constructor.prototype` keys in JSON payloads to alter object prototypes.
- **Generation Strategy**: Mutating parameter scalar values into structured types (arrays, dictionaries, booleans, floating points, integer overflow bounds like $2^{53}-1, 2^{64}-1, -1$).
- **Verification Oracle**: Authentication bypass, unexpected execution path (200 OK with privileged data), prototype modification evidenced in subsequent responses, or unhandled type cast exceptions disclosing internal state.

---

#### Hypothesis Class H6: Business Logic Invariants & Value Constraints
- **Invariant**: Numerical business values (prices, quantities, discounts, balances) must satisfy strict mathematical invariants ($Q > 0, P \ge 0, \text{Discount} \le \text{MaxCap}$).
- **Mechanism**:
  - *Negative Quantity / Price Manipulation*: Submitting negative item quantities in a shopping cart to offset positive totals, creating a negative or zero-cost invoice.
  - *Coupon / Discount Stacking*: Re-applying single-use discount codes across multiple sessions or within a single transaction without decrementing usage count.
  - *Currency / Unit Mismatch*: Passing mismatched currency symbols or manipulating unit conversion parameters.
- **Generation Strategy**: Boundary value analysis ($0, -1, -999999, 0.0000001, 10^{18}$), parameter omission, coupon reuse, and currency code substitution.
- **Verification Oracle**: Order or invoice processed with zero, negative, or fraudulently discounted total balance; credit applied without deduction.

---

#### Hypothesis Class H7: Authentication & Session Integrity
- **Invariant**: Authentication tokens (JWTs, session identifiers, API keys) must be cryptographically unforgeable, strictly bound to the authenticated principal, and immediately invalidated on logout or expiration.
- **Mechanism**:
  - *JWT Algorithm Confusion*: Modifying JWT header `{"alg": "none"}` or switching `RS256` (asymmetric public key verification) to `HS256` (symmetric HMAC verification using the public RSA key as the shared secret).
  - *Session Fixation & Replay*: Forcing a pre-session identifier across the authentication boundary, or reusing expired/revoked session tokens.
  - *Token Leakage*: Tokens leaked via `Referer` headers, unencrypted query parameters, or client-side caching.
- **Generation Strategy**: Automated header mutation, signature stripping, asymmetric-to-symmetric key transmutation, replay after logout.
- **Verification Oracle**: Access granted (HTTP 200) to protected endpoints using forged or revoked tokens.

---

#### Hypothesis Class H8: Deep Input Validation & Injection Polymorphism
- **Invariant**: Interpreted runtime engines (SQL, NoSQL, OS Shells, Template Engines, XPath, LDAP) must execute user inputs strictly as passive data parameters, never as executable code.
- **Mechanism**:
  - *SQL / NoSQL Injection*: Boolean-based, error-based, time-based, and union-based injection across relational and document databases.
  - *Server-Side Template Injection (SSTI)*: Polyglot evaluation across Jinja2, Twig, Freemarker, Velocity (`{{7*7}}`, `${7*7}`, `<%= 7*7 %>`).
  - *Command Injection*: Command separators (`;`, `|`, `&&`, `` ` ``) with timing or echo validation.
- **Generation Strategy**: Context-aware polymorphic fuzzing targeting SQL syntax, AST breaks, and template delimiters.
- **Verification Oracle**: Deterministic mathematical reflection ($49$ resulting from $7 \times 7$), database error signatures, deterministic sleep latency ($\Delta t \ge 5.0\text{s}$), or out-of-band execution.

---

#### Hypothesis Class H9: Server-Side Request Forgery & Out-of-Band Interaction
- **Invariant**: Backend servers fetching external URLs or processing user-supplied endpoints must not access private network segments, localhost interfaces, or internal cloud metadata endpoints.
- **Mechanism**:
  - *Cloud Metadata Access*: Requesting `http://169.254.169.254/latest/meta-data/` or GCP/Azure internal metadata endpoints.
  - *Internal Network Pivoting*: Rebinding DNS or using alternative IP encodings (`0x7f000001`, `2130706433`, `127.0.0.1.nip.io`) to scan internal microservices (`localhost:8080`, `10.0.0.0/8`).
  - *Stateless OAST Correlation*: Injecting unique cryptographic tokens into outbound URL fields to detect DNS/HTTP interactions.
- **Generation Strategy**: Parameter identification (URLs, webhooks, callbacks, avatar imports, file conversions) followed by injection of metadata payloads and OAST tokens.
- **Verification Oracle**: Out-of-band DNS/HTTP callback received with valid AES-256 correlated token, or metadata service response reflected in response body.

---

#### Hypothesis Class H10: Cryptographic & Token Lifecycle Invariants
- **Invariant**: Cryptographic operations (encryption, hashing, token generation, signature validation) must use cryptographically secure pseudo-random number generators (CSPRNG), constant-time comparisons, and standard cryptographic primitives.
- **Mechanism**:
  - *Predictable Nonce / Token Entropy*: PRNG seeding weaknesses in password reset tokens or confirmation IDs.
  - *Static IV / Nonce Reuse*: CBC or GCM mode IV reuse leading to plaintext recovery or forgery.
  - *Timing Side-Channels*: Non-constant time string comparisons (`memcmp`, `===`) leaking token prefixes through byte-by-byte latency differentials.
- **Generation Strategy**: Statistical entropy analysis on token sets ($N \ge 1000$), IV tracking, sub-millisecond precision timing differential measurements.
- **Verification Oracle**: Statistical entropy deficiency (Shannon entropy $< 0.8$ of expected), predictable token sequence collision, or statistically significant timing step function ($\Delta t > 3\sigma$) on character matches.

---

### 2.4 Component 4: Test Planner (Adaptive Strategy & Scheduling)

The **Test Planner** translates generated hypotheses into an optimal, non-destructive, and risk-budgeted sequence of execution steps.

```
+-----------------------------------------------------------------------------------+
|                        TEST PLANNER: ADAPTIVE WORKFLOW                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|    +-------------------------------------------------------------------------+    |
|    | 1. Hypothesis Queue & Risk Ranking                                      |    |
|    |    - Multi-Armed Bandit / Information Gain Optimizer                    |    |
|    |    - Risk Budget Assessment (Safe Read -> Mutation -> Destructive Gate) |    |
|    +------------------------------------+------------------------------------+    |
|                                         |                                         |
|                                         v                                         |
|    +-------------------------------------------------------------------------+    |
|    | 2. Dependency & Precondition Resolver                                   |    |
|    |    - Instantiates required state (e.g. create draft order before test)  |    |
|    |    - Ensures valid authentication sessions for active actors            |    |
|    +------------------------------------+------------------------------------+    |
|                                         |                                         |
|                                         v                                         |
|    +-------------------------------------------------------------------------+    |
|    | 3. Adaptive Execution Engine                                            |    |
|    |    - Dynamic Rate-Limiter & Concurrency Controller                      |    |
|    |    - Circuit Breaker: Auto-abort on 500-error storms or WAF lockouts    |    |
|    |    - Emits Explainable "WHY" Reasoning Trace for every dispatched probe |    |
|    +------------------------------------+------------------------------------+    |
|                                         |                                         |
|                                         v                                         |
|    +-------------------------------------------------------------------------+    |
|    | 4. Feedback Loop & Priority Re-weighting                                |    |
|    |    - Observed anomaly -> Spawns focused hypothesis subtree              |    |
|    |    - Negative result -> Prunes unviable hypothesis branch               |    |
|    +-------------------------------------------------------------------------+    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Key Algorithmic Principles
1. **Information Gain Optimization**: Prioritizes tests that maximize knowledge about state machine transitions and authorization boundaries while consuming minimal request budget.
2. **Explainable "WHY" Reasoning**: Every test step produces a structured rationale:
   ```json
   {
     "test_id": "TP-H2-BOLA-0042",
     "target_endpoint": "GET /api/v1/workspaces/ws_99/analytics",
     "actor": "user_standard_b",
     "resource_owner": "user_admin_a",
     "rationale": "Context graph indicates endpoint accessed by admin_a contains tenant-scoped metrics; testing H2 (BOLA) by substituting standard_b session to verify horizontal authorization barrier.",
     "risk_score": 0.15,
     "max_retries": 2
   }
   ```
3. **Safety & Destructive Action Gates**: Classifies actions into `IDEMPOTENT_READ`, `SAFE_MUTATION`, and `DESTRUCTIVE_MUTATION` (e.g. account deletion, balance reset), requiring explicit isolation guards.

---

### 2.5 Component 5: Differential Engine

The **Differential Engine** provides deep semantic, structural, and statistical comparison across multi-session, multi-role, and multi-state responses to detect subtle security bypasses.

```
+-------------------------------------------------------------------------------+
|                       DIFFERENTIAL ENGINE ARCHITECTURE                        |
+-------------------------------------------------------------------------------+
|                                                                               |
|   Baseline Response (Session A / State 1)   Probed Response (Session B / State 2)
|                     |                                     |                   |
|                     +------------------+------------------+                   |
|                                        |                                      |
|                                        v                                      |
|   +-----------------------------------------------------------------------+   |
|   | 1. Dynamic Token & Nonce Stripper                                     |   |
|   |    - Strips CSRF tokens, timestamps, UUIDs, cache-busters, ETags      |   |
|   +------------------------------------+----------------------------------+   |
|                                        |                                      |
|         +------------------------------+------------------------------+       |
|         |                              |                              |       |
|         v                              v                              v       |
|   +-------------------+      +-------------------+      +-----------------+   |
|   | 2. Structural     |      | 3. Statistical    |      | 4. Error & Data |   |
|   |    Diff Analyzer  |      |    Timing Engine  |      |    Classifier   |   |
|   | - JSON AST shape  |      | - Welch's t-test  |      | - Status code   |   |
|   | - DOM tree layout |      | - Mann-Whitney U  |      | - Error taxonomy|   |
|   | - Semantic fields |      | - Jitter filter   |      | - Leakage check |   |
|   +-------------------+      +-------------------+      +-----------------+   |
|         |                              |                              |       |
|         +------------------------------+------------------------------+       |
|                                        |                                      |
|                                        v                                      |
|   +-----------------------------------------------------------------------+   |
|   | 5. Anomaly Score Synthesizer                                          |   |
|   |    - Computes Divergence Vector: [D_struct, D_status, D_time, D_data] |   |
|   |    - If Divergence exceeds Threshold -> Promotes to Candidate Finding |   |
|   +-----------------------------------------------------------------------+   |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---

## 3. Requirement R5: Independent Verifier & Novelty Gate

### 3.1 Strict Logical Separation Boundary & Clean-Room Contract

To guarantee scientific objectivity and eliminate verification contamination:
1. **Air-Gapped Architecture**: The Researcher and the Verifier run as completely separate processes with zero shared state, zero shared cache, and zero code-level dependencies.
2. **Declarative Interface Only**: The Researcher communicates with the Verifier strictly by emitting a declarative **Candidate Finding Descriptor** (in JSON/YAML). The Researcher passes *no executable code*, *no internal graph models*, and *no heuristic assumptions*.
3. **Clean-Room Reconstruction**: The Verifier takes only the raw declarative reproduction steps and reconstructs an independent test harness from first principles.

```
+-------------------------------------------------------------------------------------------+
|                          RESEARCHER - VERIFIER BOUNDARY CONTRACT                          |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|   +--------------------------------------+                                                |
|   |      AUTONOMOUS RESEARCH ENGINE      |                                                |
|   | (Heuristics, State Graphs, Planners) |                                                |
|   +-------------------+------------------+                                                |
|                       |                                                                   |
|                       | Emits Clean Declarative Finding Spec                              |
|                       | (ZERO executable code, ZERO shared memory)                        |
|                       v                                                                   |
|   +-----------------------------------------------------------------------------------+   |
|   |                         DECLARATIVE FINDING DESCRIPTOR                            |   |
|   |  - Target Endpoint & Method                                                       |   |
|   |  - Precondition Sequence (Entities to create, initial state)                      |   |
|   |  - Attack Step Sequence (Raw HTTP requests, headers, mutated payloads)            |   |
|   |  - Assertions / Oracles (Expected status, response patterns, state mutation check)|   |
|   |  - Claimed Vulnerability Class & Mechanism                                        |   |
|   +-----------------------------------------------------------------------------------+   |
|                       |                                                                   |
|                       | Ingested by Clean-Room Parser                                     |
|                       v                                                                   |
|   +--------------------------------------+                                                |
|   |         INDEPENDENT VERIFIER         |                                                |
|   | (Clean-Room Replay, Dual Controls,   |                                                |
|   |  Noise Hardening, Prior-Art Search)  |                                                |
|   +--------------------------------------+                                                |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
```

---

### 3.2 Independent Verifier Architecture

The Independent Verifier executes five sequential validation phases before any candidate finding is accepted:

```
+---------------------------------------------------------------------------------------+
|                       INDEPENDENT VERIFIER PIPELINE                                   |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | Phase 1: Clean-Room Test Case Reconstruction                                  |   |
|   | - Reconstructs isolated HTTP client session                                   |   |
|   | - Executes precondition setup (creates fresh test entities from zero state)   |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           |                                           |
|                                           v                                           |
|   +-------------------------------------------------------------------------------+   |
|   | Phase 2: Positive Control Execution                                           |   |
|   | - Executes reproduction sequence against Ground-Truth / Vulnerable Target     |   |
|   | - Asserts positive trigger conditions (100% reproduction required)            |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           |                                           |
|                                           v                                           |
|   +-------------------------------------------------------------------------------+   |
|   | Phase 3: Negative Control & Hardened Baseline Evaluation                      |   |
|   | - Executes identical sequence against Hardened Baseline & Fixed Fixtures      |   |
|   | - Asserts 0% false positives (must fail cleanly / return 401/403/404/400)     |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           |                                           |
|                                           v                                           |
|   +-------------------------------------------------------------------------------+   |
|   | Phase 4: Adversarial Jitter & Noise Stress Test                               |   |
|   | - Executes multi-trial test under random network latency, jitter, & noise     |   |
|   | - Eliminates transient or non-deterministic race conditions                   |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           |                                           |
|                                           v                                           |
|   +-------------------------------------------------------------------------------+   |
|   | Phase 5: Multi-Source Prior-Art Search & Novelty Classification               |   |
|   | - Queries CVE / NVD / GHSA / OSV / CISA KEV and Academic Literature           |   |
|   | - Assigns 4-Tier Classification (KNOWN, VARIANT, NOVEL-CANDIDATE, CONFIRMED)  |   |
|   +-------------------------------------------------------------------------------+   |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

### 3.3 Control Harness & Dual-Oracle Evaluation

The Verifier implements a strict **Dual-Oracle Evaluation**:

| Control Harness Component | Target Environment | Acceptance Criterion | Failure Consequence |
|---|---|---|---|
| **Positive Control** | `lab/ground_truth/` (or target vulnerable endpoint) | Attack triggers successfully on 5/5 trials ($100\%$ reproduction rate). | Finding rejected as **UNREPRODUCIBLE / FLAKY**. |
| **Negative Control** | `lab/fixed_controls/` (and `lab/target/` hardened baseline) | Attack fails cleanly on 5/5 trials ($0\%$ false positive rate); proper authorization/validation enforced. | Finding rejected as **FALSE POSITIVE / INVALID ORACLE**. |
| **Adversarial Jitter Test** | Target under simulated latency jitter ($\pm 250\text{ms}$) & background traffic | Success rate $\ge 95\%$ across 20 trials without false triggers on negative baseline. | Finding rejected as **ENVIRONMENTAL ARTIFACT**. |

---

### 3.4 Multi-Source Prior-Art Search Engine

The Prior-Art Search Engine evaluates whether a verified vulnerability is known, an existing variant, or truly novel.

```
+-------------------------------------------------------------------------------+
|                       PRIOR-ART SEARCH ENGINE                                 |
+-------------------------------------------------------------------------------+
|                                                                               |
|   Verified Vulnerability Vector (CWE, AST diff, payload, mechanism, protocol)  |
|                                      |                                        |
|                                      v                                        |
|   +-----------------------------------------------------------------------+   |
|   | Query Synthesizer & Embedding Generator                               |   |
|   | - Generates semantic query vectors + CWE taxonomy tree paths          |   |
|   | - Extracts key structural tokens (headers, state sequence, parameter) |   |
|   +----------------------------------+------------------------------------+   |
|                                      |                                        |
|         +----------------------------+----------------------------+           |
|         |                                                         |           |
|         v                                                         v           |
|   +---------------------------------------+   +---------------------------+   |
|   | 1. Vulnerability Databases            |   | 2. Academic Literature DB |   |
|   |    - NVD / CVE API v2.0               |   |    - USENIX Security      |   |
|   |    - GitHub Security Advisories (GHSA)|   |    - ACM CCS / IEEE S&P   |   |
|   |    - Open Source Vulnerabilities (OSV)|   |    - NDSS Symposium       |   |
|   |    - CISA Known Exploited (KEV)       |   |    - arXiv / Cryptology   |   |
|   +---------------------------------------+   +---------------------------+   |
|         |                                                         |           |
|         +----------------------------+----------------------------+           |
|                                      |                                        |
|                                      v                                        |
|   +-----------------------------------------------------------------------+   |
|   | 3. Structural & Semantic Similarity Matcher                           |   |
|   |    - Structural AST distance: Cosine similarity $S_{sem} \in [0, 1]$  |   |
|   |    - CWE Taxonomy Path Distance: $D_{tax} \in [0, 1]$                 |   |
|   |    - Composite Prior-Art Match Score: $M = 0.6 S_{sem} + 0.4(1-D_tax)$|   |
|   +-----------------------------------------------------------------------+   |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---

### 3.5 4-Tier Novelty Classification Scheme & Decision Rubric

The Verifier applies an unambiguous 4-tier classification rubric:

```
+---------------------------------------------------------------------------------------+
|                         4-TIER NOVELTY CLASSIFICATION RUBRIC                          |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   [ Tier 1: KNOWN ]                                                                   |
|   - Definition: The vulnerability matches an existing CVE/GHSA entry or established    |
|     standard CWE pattern on a standard technology stack ($M \ge 0.85$).               |
|   - Disposition: Verified finding; logged with CVE/CWE reference.                     |
|                                                                                       |
|   [ Tier 2: VARIANT ]                                                                 |
|   - Definition: The underlying root cause matches a known vulnerability class, but    |
|     the payload, parameter formatting, or wrapper syntax represents a novel variation |
|     or bypass of an incomplete fix ($0.55 \le M < 0.85$).                             |
|   - Disposition: Verified finding; logged with base reference and variant analysis.   |
|                                                                                       |
|   [ Tier 3: NOVEL-CANDIDATE ]                                                         |
|   - Definition: The vulnerability exhibits an uncataloged attack mechanism, an       |
|     unprecedented multi-step state sequence, or an unknown protocol/parser anomaly    |
|     with no direct CVE or academic literature matches ($M < 0.55$).                   |
|   - Disposition: Promoted to Generalization & Cross-Architecture Benchmark (M5).      |
|                                                                                       |
|   [ Tier 4: CONFIRMED-NOVEL ]                                                         |
|   - Definition: A NOVEL-CANDIDATE that has passed:                                    |
|     1. 100% clean-room verification across 3 distinct backend architectures,         |
|     2. 0% false positives on negative controls and hardened baselines,                |
|     3. Exhaustive prior-art search confirming zero academic/industry precedent,       |
|     4. Survives adversarial jitter and noise testing.                                 |
|   - Disposition: Triggers creation of standalone specialized detection tool (M5/M6).  |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

## 4. Formal Data Models & Schemas

To ensure zero ambiguity during implementation in Rust/Python/TypeScript, all engine and verifier interfaces adhere to strict data schemas.

### 4.1 Candidate Finding Descriptor Schema (JSON)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CandidateFindingDescriptor",
  "type": "object",
  "required": [
    "candidate_id",
    "hypothesis_id",
    "vulnerability_class",
    "target_endpoint",
    "preconditions",
    "reproduction_steps",
    "verification_assertions",
    "observed_anomaly"
  ],
  "properties": {
    "candidate_id": { "type": "string", "format": "uuid" },
    "hypothesis_id": { "type": "string", "enum": ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "H10"] },
    "vulnerability_class": { "type": "string" },
    "cwe_id": { "type": "integer" },
    "target_endpoint": {
      "type": "object",
      "required": ["method", "path"],
      "properties": {
        "method": { "type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] },
        "path": { "type": "string" }
      }
    },
    "preconditions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["step_id", "action", "request"],
        "properties": {
          "step_id": { "type": "string" },
          "action": { "type": "string" },
          "request": { "$ref": "#/definitions/HttpRequest" },
          "extract_variables": { "type": "object" }
        }
      }
    },
    "reproduction_steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["step_id", "request"],
        "properties": {
          "step_id": { "type": "string" },
          "actor_context": { "type": "string" },
          "request": { "$ref": "#/definitions/HttpRequest" },
          "concurrency_group": { "type": "string" }
        }
      }
    },
    "verification_assertions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["assertion_type", "expected"],
        "properties": {
          "assertion_type": { "type": "string", "enum": ["STATUS_CODE", "BODY_CONTAINS", "BODY_JSON_PATH", "TIMING_GREATER_THAN", "STATE_MUTATED"] },
          "expected": {},
          "target_step_id": { "type": "string" }
        }
      }
    },
    "observed_anomaly": {
      "type": "object",
      "required": ["anomaly_type", "evidence_summary"],
      "properties": {
        "anomaly_type": { "type": "string" },
        "evidence_summary": { "type": "string" },
        "differential_vector": { "type": "object" }
      }
    }
  },
  "definitions": {
    "HttpRequest": {
      "type": "object",
      "required": ["method", "url", "headers"],
      "properties": {
        "method": { "type": "string" },
        "url": { "type": "string" },
        "headers": { "type": "object", "additionalProperties": { "type": "string" } },
        "body": { "type": "string" },
        "raw_bytes_base64": { "type": "string" }
      }
    }
  }
}
```

### 4.2 Verifier Result & Novelty Evaluation Schema (JSON)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VerificationAndNoveltyReport",
  "type": "object",
  "required": [
    "candidate_id",
    "verification_status",
    "positive_control_result",
    "negative_control_result",
    "jitter_evaluation_result",
    "prior_art_assessment",
    "final_classification",
    "verdict_timestamp"
  ],
  "properties": {
    "candidate_id": { "type": "string", "format": "uuid" },
    "verification_status": { "type": "string", "enum": ["VERIFIED", "REJECTED_UNREPRODUCIBLE", "REJECTED_FALSE_POSITIVE", "REJECTED_JITTER_FAIL"] },
    "positive_control_result": {
      "type": "object",
      "required": ["passed", "trial_count", "success_rate"],
      "properties": {
        "passed": { "type": "boolean" },
        "trial_count": { "type": "integer" },
        "success_rate": { "type": "number" }
      }
    },
    "negative_control_result": {
      "type": "object",
      "required": ["passed", "trial_count", "false_positive_count"],
      "properties": {
        "passed": { "type": "boolean" },
        "trial_count": { "type": "integer" },
        "false_positive_count": { "type": "integer" }
      }
    },
    "jitter_evaluation_result": {
      "type": "object",
      "required": ["passed", "p95_jitter_ms", "deterministic_pass_rate"],
      "properties": {
        "passed": { "type": "boolean" },
        "p95_jitter_ms": { "type": "number" },
        "deterministic_pass_rate": { "type": "number" }
      }
    },
    "prior_art_assessment": {
      "type": "object",
      "required": ["prior_art_found", "max_similarity_score", "top_matches"],
      "properties": {
        "prior_art_found": { "type": "boolean" },
        "max_similarity_score": { "type": "number" },
        "top_matches": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["source_id", "source_type", "title", "similarity_score"],
            "properties": {
              "source_id": { "type": "string" },
              "source_type": { "type": "string", "enum": ["CVE", "GHSA", "OSV", "KEV", "ACADEMIC"] },
              "title": { "type": "string" },
              "similarity_score": { "type": "number" },
              "root_cause_differential": { "type": "string" }
            }
          }
        }
      }
    },
    "final_classification": {
      "type": "string",
      "enum": ["KNOWN", "VARIANT", "NOVEL-CANDIDATE", "CONFIRMED-NOVEL", "INVALID"]
    },
    "verdict_timestamp": { "type": "string", "format": "date-time" }
  }
}
```

---

## 5. Implementation Roadmap & Architecture Mapping

To prepare for Milestones M3 (Autonomous Research Engine) and M4 (Independent Verifier), the workspace code organization in `research_lab/` is structured as follows:

```
research_lab/
├── contracts/                        # Shared declarative schemas & data types
│   ├── schemas/                      # JSON Schemas (FindingDescriptor, VerificationReport)
│   └── models.py                     # Strongly-typed Python/Rust domain models
├── research_engine/                  # Requirement R4 implementation
│   ├── observer/                     # Component 1: Traffic sniffer, surface & schema extraction
│   │   ├── parser.py                 # Protocol & raw byte stream parser
│   │   ├── surface_extractor.py      # Parameter & endpoint surface extractor
│   │   └── response_profiler.py      # Response AST, status & latency profiler
│   ├── context/                      # Component 2: Entity & State Graph
│   │   ├── graph.py                  # In-memory directed graph (NetworkX / SQLite CTE)
│   │   ├── state_machine.py          # State transition & lifecycle manager
│   │   └── entity_tracker.py         # Multi-tenant / multi-role resource ownership tracker
│   ├── hypotheses/                   # Component 3: Hypothesis Engine (H1 - H10)
│   │   ├── base.py                   # Hypothesis generator base class
│   │   ├── h1_state_transitions.py   # H1: Out-of-order & workflow sequence flaws
│   │   ├── h2_authorization.py       # H2: BOLA, IDOR, BFLA asymmetry
│   │   ├── h3_protocol_differentials.py # H3: HTTP request smuggling & parser desync
│   │   ├── h4_race_conditions.py     # H4: Concurrency & TOCTOU race testing
│   │   ├── h5_type_juggling.py       # H5: Loose type casting & array pollution
│   │   ├── h6_business_logic.py      # H6: Numerical bounds & coupon stacking
│   │   ├── h7_auth_session.py        # H7: JWT algorithm confusion & session integrity
│   │   ├── h8_injection.py           # H8: Polymorphic SQLi/SSTI/Command injection
│   │   ├── h9_ssrf_oast.py           # H9: SSRF & stateless OAST correlation
│   │   └── h10_crypto_invariants.py  # H10: PRNG entropy & timing side-channels
│   ├── planner/                      # Component 4: Adaptive Test Planner
│   │   ├── scheduler.py              # Probabilistic bandit & information gain scheduler
│   │   ├── risk_gate.py              # Safe read vs destructive action guard
│   │   └── audit_reasoner.py         # Explainable "WHY" reasoning trace logger
│   └── differential/                 # Component 5: Differential Engine
│       ├── diff_engine.py            # AST, status, timing, and entropy diffing
│       └── statistical_timing.py     # Welch's t-test & Mann-Whitney latency analyzer
├── verifier/                         # Requirement R5 implementation
│   ├── harness/                      # Clean-room test case reconstruction
│   │   ├── clean_replayer.py         # Standalone HTTP replayer
│   │   ├── dual_oracle.py            # Positive vs Negative control executor
│   │   └── jitter_stress.py          # Adversarial latency & noise stress tester
│   ├── prior_art/                    # Multi-source prior art search engine
│   │   ├── nvd_cve_client.py         # NVD/CVE API v2 & CISA KEV client
│   │   ├── ghsa_osv_client.py        # GitHub Advisories & OSV search
│   │   ├── academic_corpus.py        # Academic literature indexing & embeddings
│   │   └── similarity_matcher.py     # Semantic & structural distance evaluator
│   └── gate/                         # 4-Tier Novelty Gate
│       └── novelty_classifier.py     # Decision rubric (KNOWN/VARIANT/NOVEL/CONFIRMED)
└── tests/                            # Comprehensive unit & integration test suite
    ├── test_observer.py              # Tests for traffic observation & schema inference
    ├── test_context_graph.py         # Tests for graph node/edge mutations
    ├── test_hypotheses_h1_h10.py     # Unit tests for all 10 hypothesis generators
    ├── test_planner.py               # Tests for adaptive test planning & risk budgets
    ├── test_differential.py          # Tests for structural & timing diffs
    ├── test_clean_verifier.py        # Tests for independent clean-room verification
    └── test_prior_art_matcher.py     # Tests for CVE & academic matching
```

---

## 6. Verification & Quality Gates

To validate the research engine and verifier implementation, the following verifiable acceptance criteria are mandated:

1. **Rediscovery Rate Gate**: The Research Engine must autonomously discover and generate valid hypotheses for $\ge 90\%$ of seeded vulnerabilities in `lab/ground_truth/`.
2. **Clean-Room Verification Gate**: The Independent Verifier must successfully reproduce $100\%$ of valid candidate findings without importing any module from `research_lab/research_engine/`.
3. **Zero False Positive Gate**: The Verifier must achieve exactly $0.0\%$ false positive rate against `lab/fixed_controls/` and `lab/target/`.
4. **Adversarial Resilience Gate**: Candidates must maintain $\ge 95\%$ verification consistency under $\pm 250\text{ms}$ latency jitter and concurrent benign traffic noise.
5. **Prior-Art Precision Gate**: Known standard vulnerabilities (e.g., standard SQLi, basic IDOR) must be classified as `KNOWN` ($M \ge 0.85$), and known variants must be classified as `VARIANT`.

---

*Report compiled by Explorer Survey Engine Lead (`explorer_survey_engine`). All specifications frozen for M3/M4 implementation.*

# Comprehensive Technical Analysis: Milestone M4 — 5 Custom SENTINEL Proprietary Engines (Sections 23–28)

**Author**: Explorer Agent (Milestone M4)  
**Date**: 2026-08-19  
**Status**: Completed Investigation & Architecture Synthesis  
**Scope**: Sections 23–28 of the SENTINEL V6 Master Specification  

---

## Executive Summary

Milestone M4 governs the design, implementation, and empirical verification of the **5 Custom SENTINEL Proprietary Engines**:
1. **Security Context Graph (Sections 23–24)**: Unified attack surface topology linking `Asset` $\to$ `Endpoint` $\to$ `Parameter` $\to$ `Request` $\to$ `Response` $\to$ `Finding`, with in-memory graph pathfinding, choke point detection, risk score propagation, and SQLite recursive Common Table Expression (CTE) query generation.
2. **Adaptive Test Planner (Section 25)**: Deterministic Next-Best-Test selector computing multi-factor risk, attack surface coverage gaps, prior findings proximity, parameter semantics, and technology stack confidence, generating explainable "WHY" rationale and cost budgets.
3. **Differential Security Engine (Section 26)**: Multi-session, multi-role (Autorize/IRA+ style), and multi-state divergence analyzer combining semantic metrics (HTTP status, headers, LCS body diff, JSON key/value tree diff, DOM tag hierarchy, token similarity) and statistical metrics (Welch's t-test with Welch-Satterthwaite degrees of freedom and variance ratio) to classify responses into `Identical`, `PermittedAccess` (IDOR/BOLA), `EnforcedDeny`, `StructuralAnomaly`, and `TimingAnomaly`.
4. **Security Regression Graph (Section 27)**: Vulnerability reproduction and regression state machine (`VULNERABLE` / `Candidate` / `Verified` $\leftrightarrow$ `FIXED` / `Remediated` $\leftrightarrow$ `REGRESSED` / `Regression`), generating reproducible test suites, re-executing verification proofs, capturing SHA-256 CAS evidence, and managing historical retest audit trails.
5. **Engagement Memory & Research Packs (Section 28)**: Project-isolated deterministic history of tested paths, discovered parameters, payloads tried, and verified negative controls (SEC-08), alongside signed and versioned Research Packs with cryptographic signature verification (HMAC-SHA256 / SHA-256 digest), rule registries, custom dictionaries, and dynamic hot-reloading.

---

## 1. Existing Capabilities vs Required Capabilities Matrix

| # | Proprietary Engine | Subsystems / Crates | Existing Capability | Required Capability (Milestone M4) | Status / Gap |
|---|---|---|---|---|---|
| 1 | **Security Context Graph** | `sentinel_knowledge`, `sentinel_context`, `sentinel_common`, `sentinel_storage` | Generic `GraphNode` / `GraphEdge` with string types; basic BFS pathfinding; raw SQLite table inserts. | Strongly-typed `ContextNodeType` (Asset, Endpoint, Parameter, Request, Response, Finding) and `ContextEdgeType` (HasEndpoint, AcceptsParam, EmitsResponse, ExhibitsFinding, TargetsEndpoint, ProducesEvidence, DerivedFrom); `SecurityContextGraph` with ancestor/descendant lineage tracing, upstream risk propagation, choke point identification; SQLite recursive CTE query generator (`AttackGraphCteQueries`). | **Gaps Identified** |
| 2 | **Adaptive Test Planner** | `sentinel_coverage`, `sentinel_knowledge`, `sentinel_scanner` | Basic `tested_endpoints` HashSet tracking; total vs tested counts; `untested_endpoints` list. | Deterministic `AdaptiveTestPlanner` evaluating: $S = W_{\text{risk}} \cdot R_{\text{endpoint}} + W_{\text{cov}} \cdot C_{\text{gap}} + W_{\text{vuln}} \cdot V_{\text{prior}} + W_{\text{param}} \cdot P_{\text{class}} + W_{\text{tech}} \cdot T_{\text{stack}} - W_{\text{cost}} \cdot \text{Cost}$; explainable "WHY" justification string; priority queue ranking; budget governor. | **Gaps Identified** |
| 3 | **Differential Security Engine** | `sentinel_verification`, `sentinel_authz`, `sentinel_fuzzer` | Basic role matrix check in `sentinel_authz`; Welch's t-test in `sentinel_auth/enumeration.rs`; LCS diff in frontend `DiffViewer.tsx`. | Unified `DifferentialEngine` combining semantic diffing (status delta, header variance, LCS body diff, JSON key/value tree diff, DOM tag hierarchy, similarity ratio) + statistical timing diffing (Welch's t-test, variance ratio) + privilege differential evaluation (Admin vs User vs Guest) + anomaly classification. | **Gaps Identified** |
| 4 | **Security Regression Graph** | `sentinel_verification`, `sentinel_storage`, `sentinel_logic` | `FindingLifecycleManager::transition` with valid state transitions; `regression_tests` table in SQLite schema. | `RegressionGraphEngine` managing `RegressionTestDefinition` suites, automated re-execution of verification strategies, dynamic state transitions (`VULNERABLE` $\leftrightarrow$ `FIXED` $\leftrightarrow$ `REGRESSED`), regression alert generation, and historical CAS-linked retest audit logs. | **Gaps Identified** |
| 5 | **Engagement Memory & Research Packs** | `sentinel_plugin`, `sentinel_storage`, `sentinel_knowledge` | `DefaultResearchPackManager` with placeholder signature check; `ProjectStorage` enforcing SEC-08 workspace filesystem bounds. | Cryptographic HMAC-SHA256 / SHA-256 signature verification over canonical research pack contents; structured `ResearchPack` schema (manifest, checks, dictionaries); hot-reload lifecycle; `EngagementMemory` engine providing deterministic recall of tested vectors and negative controls. | **Gaps Identified** |

---

## 2. Deep Dive: Engine 1 — Security Context Graph (Sections 23–24)

### 2.1 Domain Model & Node/Edge Taxonomy
The Security Context Graph unifies all heterogeneous entities discovered, captured, generated, or verified during an engagement:

```
[ Asset (Domain / Host / IP) ]
          |  (HAS_ENDPOINT)
          v
[ Endpoint (Method + Path) ] <--------- [ Request (Transaction) ]
          |  (ACCEPTS_PARAM)                  |  (EMITS_RESPONSE)
          v                                   v
[ Parameter (Query/Body/Header) ]       [ Response (Status + Body) ]
          \                                   /
           \                                 /
            \--- (EXHIBITS_FINDING) <-------/
                          |
                          v
                 [ Finding (Vulnerability) ]
                          |
                          v (PRODUCES_EVIDENCE)
                 [ Evidence (CAS Blob) ]
```

#### Typed Enums:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ContextNodeType {
    Asset,
    Endpoint,
    Parameter,
    Request,
    Response,
    Finding,
    Service,
    Identity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ContextEdgeType {
    HasEndpoint,
    AcceptsParam,
    EmitsResponse,
    ExhibitsFinding,
    TargetsEndpoint,
    ProducesEvidence,
    DerivedFrom,
}
```

### 2.2 In-Memory Topology & Graph Operations
In `sentinel_core/crates/sentinel_knowledge/src/context_graph.rs`:
- `SecurityContextGraph`:
  - `nodes: HashMap<Uuid, ContextGraphNode>`
  - `outgoing: HashMap<Uuid, Vec<ContextGraphEdge>>`
  - `incoming: HashMap<Uuid, Vec<ContextGraphEdge>>`
- Key Algorithms:
  1. **Lineage Tracing (`trace_finding_lineage(finding_id)`)**:
     Traverses incoming edges backwards from `Finding` $\to$ `Response` / `Request` $\to$ `Parameter` $\to$ `Endpoint` $\to$ `Asset`, returning the full provenance attack chain.
  2. **Risk Propagation (`propagate_risk_scores()`)**:
     Starting from confirmed findings (Critical = 100, High = 80, Medium = 50, Low = 25), propagates risk upstream to associated Parameters, Endpoints, and Assets using weighted attenuation:
     $$R_{\text{upstream}} = \max(R_{\text{upstream}}, 0.85 \cdot R_{\text{downstream}})$$
  3. **Choke Point Analysis (`find_choke_points(top_n)`)**:
     Calculates betweenness centrality / path intersection frequency across all attack paths from external Assets to internal database/resource sinks. Nodes appearing on the highest number of paths represent critical choke points.
  4. **Cycle-Bounded Subgraph Extraction (`get_asset_subgraph(asset_id, max_depth)`)**:
     Extracts all reachable nodes from a root asset with bounded traversal depth $\le 32$.

### 2.3 SQLite Recursive CTE Traversal
In `sentinel_core/crates/sentinel_knowledge/src/cte.rs`:
Provides SQL query generation for recursive graph traversal in SQLite:
```sql
-- Upstream Finding Lineage CTE
WITH RECURSIVE lineage(id, source_id, target_id, edge_type, depth) AS (
    SELECT id, source_id, target_id, edge_type, 0
    FROM graph_edges
    WHERE target_id = ?
    UNION ALL
    SELECT e.id, e.source_id, e.target_id, e.edge_type, l.depth + 1
    FROM graph_edges e
    JOIN lineage l ON e.target_id = l.source_id
    WHERE l.depth < 10
)
SELECT DISTINCT n.id, n.node_type, n.label, n.metadata_json, l.edge_type, l.depth
FROM lineage l
JOIN graph_nodes n ON l.source_id = n.id;
```

```sql
-- Downstream Attack Impact CTE
WITH RECURSIVE impact(id, source_id, target_id, edge_type, depth) AS (
    SELECT id, source_id, target_id, edge_type, 0
    FROM graph_edges
    WHERE source_id = ?
    UNION ALL
    SELECT e.id, e.source_id, e.target_id, e.edge_type, i.depth + 1
    FROM graph_edges e
    JOIN impact i ON e.source_id = i.target_id
    WHERE i.depth < 10
)
SELECT DISTINCT n.id, n.node_type, n.label, n.metadata_json, i.edge_type, i.depth
FROM impact i
JOIN graph_nodes n ON i.target_id = n.id;
```

---

## 3. Deep Dive: Engine 2 — Adaptive Test Planner (Section 25)

### 3.1 Next-Best-Test Scoring Heuristic
In `sentinel_core/crates/sentinel_coverage/src/planner.rs`:
The planner deterministically ranks candidate security checks across all discovered endpoints and parameters.

#### Formula:
$$S = W_{\text{risk}} \cdot R_{\text{endpoint}} + W_{\text{cov}} \cdot C_{\text{gap}} + W_{\text{vuln}} \cdot V_{\text{prior}} + W_{\text{param}} \cdot P_{\text{class}} + W_{\text{tech}} \cdot T_{\text{stack}} - W_{\text{cost}} \cdot \text{Cost}$$

Where:
- **$R_{\text{endpoint}}$ (Endpoint Risk Factor, 0–100)**:
  - Authentication routes (`/auth/login`, `/oauth/token`, `/reset-password`): $95$
  - Administrative routes (`/admin/*`, `/internal/*`, `/management/*`): $90$
  - Financial/Payment routes (`/checkout`, `/payment`, `/invoice`, `/transfer`): $92$
  - Upload/Export routes (`/upload`, `/download`, `/files`, `/export`): $85$
  - General API data routes (`/api/v1/users`, `/api/v1/search`): $70$
  - Static resources / health checks (`/health`, `/favicon.ico`): $10$
- **$C_{\text{gap}}$ (Coverage Gap, 0–100)**:
  - Completely untested endpoint: $100$
  - Untested HTTP method on known endpoint: $75$
  - Untested parameter on partially tested endpoint: $50$
  - Fully tested endpoint/parameter: $0$
- **$V_{\text{prior}}$ (Proximity to Prior Findings, 0–100)**:
  - Confirmed finding on the exact endpoint: $100$
  - Confirmed finding on sibling endpoint under same path prefix: $75$
  - Confirmed finding on same asset: $40$
  - No prior findings: $0$
- **$P_{\text{class}}$ (Parameter Semantic Class, 0–100)**:
  - `Identifier` (IDOR/BOLA candidate): $90$
  - `FilePath` / `Url` (SSRF/Traversal candidate): $95$
  - `SqlFragment` / `QueryFilter` (SQLi candidate): $95$
  - `CommandString` (Command injection candidate): $98$
  - `AuthToken` / `SessionSecret`: $85$
  - `FreeText` / `Search`: $70$
  - `Pagination` / `StaticConstant`: $20$
- **$T_{\text{stack}}$ (Technology Stack Match Confidence, 0–100)**:
  - Check directly matches detected tech stack (e.g. Jinja2 on Python, SpEL on Spring, GraphQL on Apollo, Laravel Deserialization on PHP): $100$
  - Generic protocol check (HTTP smuggling, CORS, Clickjacking): $70$
  - Incompatible tech stack (e.g. PHP checks on ASP.NET target): $0$
- **$\text{Cost}$ (Execution Cost Penalty, 0–100)**:
  - Low request budget ($\le 3$ requests): $10$
  - Medium request budget ($4-15$ requests): $30$
  - High request budget ($> 15$ requests or slow timing): $60$

### 3.2 Explainable "WHY" Rationale Generator
The engine produces human-readable explainability text:
```
Score: 94.2/100 | WHY: High-sensitivity auth endpoint (/api/v1/auth/reset-password) + Untested HTTP/2 race condition surface + Proximity to confirmed Finding FND-001 + Estimated Cost: 6 requests
```

---

## 4. Deep Dive: Engine 3 — Differential Security Engine (Section 26)

### 4.1 Architecture & Workflow
In `sentinel_core/crates/sentinel_verification/src/differential.rs`:

```
Baseline Response -------------------+
                                     |---> [ Differential Security Engine ]
Probe / Mutated Response ------------+           |
                                                 |--> 1. Status & Header Delta
                                                 |--> 2. Body LCS Line Diff
                                                 |--> 3. JSON Structure & Key Diff
                                                 |--> 4. DOM / Tag Hierarchy Diff
                                                 |--> 5. Token Similarity Ratio
                                                 |--> 6. Welch's t-test Timing
                                                 |
                                                 v
                                    [ DifferentialAnalysisResult ]
                                    - Semantic Divergence Score (0.0-1.0)
                                    - Statistical Significance (p-value, t-stat)
                                    - Classification: PermittedAccess / EnforcedDeny / ...
```

### 4.2 Semantic Divergence Metrics
1. **Status & Header Delta**:
   - Compares status codes ($200 \leftrightarrow 403, 401, 500$).
   - Compares sensitive security headers (`Location`, `Set-Cookie`, `Content-Type`, `Access-Control-Allow-Origin`).
2. **JSON Structural Divergence**:
   - Parses JSON into key-paths: e.g. `{"user": {"id": 1, "role": "admin"}}` $\to$ `["user.id", "user.role"]`.
   - Calculates Jaccard similarity of key sets:
     $$J(\text{Keys}_A, \text{Keys}_B) = \frac{|\text{Keys}_A \cap \text{Keys}_B|}{|\text{Keys}_A \cup \text{Keys}_B|}$$
3. **LCS & Normalized Text Similarity**:
   - Reconstructs Longest Common Subsequence line diff.
   - Calculates character/token similarity ratio $S \in [0.0, 1.0]$:
     $$S = \frac{2 \cdot \text{UnchangedLines}}{\text{TotalLines}_A + \text{TotalLines}_B}$$

### 4.3 Statistical Divergence (Welch's t-test)
For time-based blind vulnerabilities (SQLi, CMDi, Deserialization, SSRF):
- Collect $N_1$ baseline timing samples and $N_2$ probe timing samples.
- Compute sample means $\bar{X}_1, \bar{X}_2$ and sample variances $s_1^2, s_2^2$.
- Compute Welch's t-statistic:
  $$t = \frac{\bar{X}_2 - \bar{X}_1}{\sqrt{\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}}}$$
- Compute Welch-Satterthwaite degrees of freedom $\nu$:
  $$\nu = \frac{\left(\frac{s_1^2}{N_1} + \frac{s_2^2}{N_2}\right)^2}{\frac{(s_1^2/N_1)^2}{N_1 - 1} + \frac{(s_2^2/N_2)^2}{N_2 - 1}}$$
- If $t > t_{\text{crit}}$ and $p < 0.01$, confirm statistical timing anomaly while eliminating false positives from network latency jitter.

### 4.4 Multi-Session Privilege Differential (IRA+ Matrix)
- **Baseline**: High-Privilege Principal (Admin) access to resource.
- **Probe 1 (Cross-Tenant)**: Tenant B attempts to read Tenant A's resource $\to$ If response is identical to Baseline with status 200 $\implies$ **BOLA / IDOR Violation (`PermittedAccess`)**.
- **Probe 2 (Low-Privilege)**: Regular user attempts Admin action $\to$ If status 200 with matching schema $\implies$ **BFLA Violation (`PermittedAccess`)**.
- **Probe 3 (Unauthenticated)**: Anonymous probe $\to$ If status 200 with data $\implies$ **Unauthenticated Access (`PermittedAccess`)**.
- **Enforced Deny**: Status 401/403 or explicit error message $\implies$ **Safe / Enforced Deny (`EnforcedDeny`)**.

---

## 5. Deep Dive: Engine 4 — Security Regression Graph (Section 27)

### 5.1 State Machine & Transitions
In `sentinel_core/crates/sentinel_verification/src/regression.rs`:

```
               [ Candidate ]
                     | (Verify Proof)
                     v
                [ Verified ]
                     | (Operator Confirm)
                     v
                [ Confirmed (VULNERABLE) ] <---------------+
                 /         \                               | (Remediation Failed /
    (Queue Retest)          (Remediation Verified)         |  Regression Detected)
               v                     v                     |
       [ Retest Suite ] -----> [ Remediated (FIXED) ] ----+
```

### 5.2 Regression Test Definition
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegressionTestDefinition {
    pub id: Uuid,
    pub finding_id: Uuid,
    pub title: String,
    pub endpoint: String,
    pub http_method: HttpMethod,
    pub seed_transaction_id: Uuid,
    pub payload_template: String,
    pub target_parameter: String,
    pub verification_strategy: VerificationStrategy,
    pub expected_remediation_status: u16,
    pub negative_assertion_regex: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_executed_at: Option<DateTime<Utc>>,
}
```

### 5.3 Execution & State Transition Rules
When `execute_retest(&test_def, &engine)` runs:
1. Re-executes the exact attack payload sequence against the target endpoint.
2. Evaluates the response against the verification strategy:
   - If the vulnerability is **still present** (e.g. SQL error returned, canary reflected unescaped, time delay triggered, cross-tenant data accessed):
     - If current state was `Remediated` $\to$ **Transition to `Regression`** (triggers high-priority regression alert!).
     - If current state was `Confirmed` $\to$ **Remains `Confirmed` / `Vulnerable`**.
   - If the vulnerability is **no longer present** (e.g. 400 Bad Request, proper parameter binding, sanitized reflection, 403 Forbidden):
     - **Transition to `Remediated` (`Fixed`)**.
3. Captures new SHA-256 CAS verification evidence and appends a `RetestHistoryEntry` to the finding's audit log.

---

## 6. Deep Dive: Engine 5 — Engagement Memory & Research Packs (Section 28)

### 6.1 Engagement Memory
In `sentinel_core/crates/sentinel_storage/src/memory.rs` and `sentinel_storage/src/project.rs`:
- **Project Isolation (SEC-08)**: All memory structures are strictly bound to the project workspace (`project_dir/memory/` and `project_dir/db.sqlite`).
- **Deterministic Recall**:
  - `has_tested_vector(endpoint_id, check_id, param_name) -> bool`: Fast memory check before executing scans.
  - `record_tested_vector(record)`: Saves tested payload hash, execution timestamp, and status.
  - `get_verified_negative_controls(scope_id) -> Vec<NegativeControlRecord>`: Tracks endpoints and parameters formally proven non-vulnerable.
  - `recall_parameter_schema(endpoint_id, param_name) -> Option<InferredParameterSchema>`.
- Enables seamless scan pause/resume and incremental re-scanning without re-running redundant fuzzing vectors.

### 6.2 Research Packs & Cryptographic Signatures
In `sentinel_core/crates/sentinel_plugin/src/research_pack.rs`:
- **Schema**:
  - `ResearchPackManifest`: `pack_id`, `name`, `version`, `author`, `min_sentinel_version`, `created_at`, `signature_algorithm` (`HMAC-SHA256` or `Ed25519`), `signature`.
  - `ResearchPackCheck`: `check_id`, `name`, `category`, `severity`, `confidence`, `cwe`, `remediation`, `probes: Vec<PackProbeDefinition>`.
  - `ResearchPackDictionary`: Custom wordlists, fuzzing dictionaries, bypass payloads.
- **Cryptographic Signature Verification**:
  - Computes SHA-256 digest over normalized canonical JSON of the pack contents:
    $$\text{Digest} = \text{SHA-256}(\text{pack\_id} \mathbin{\Vert} \text{version} \mathbin{\Vert} \text{checks\_json} \mathbin{\Vert} \text{dictionaries\_json})$$
  - Verifies signature using pre-shared signing secret or public key:
    $$\text{HMAC-SHA256}(\text{secret}, \text{Digest}) \stackrel{?}{=} \text{signature}$$
- **Hot-Reloading**:
  - Allows security teams to drop new `.pack.yaml` / `.pack.json` bundles into the research packs directory.
  - The runtime cryptographically verifies the pack, validates the schema, dynamically loads rules into active scan profiles, and unloads obsolete versions without workstation downtime.

---

## 7. Concrete File, Model, and Function Breakdown

### 7.1 New & Extended Rust Files in `sentinel_core`

1. `crates/sentinel_knowledge/src/context_graph.rs` (NEW):
   - Struct `SecurityContextGraph`: In-memory graph for typed nodes and edges.
   - Enums `ContextNodeType`, `ContextEdgeType`.
   - Structs `ContextGraphNode`, `ContextGraphEdge`.
   - Methods: `add_asset`, `add_endpoint`, `add_parameter`, `add_request`, `add_response`, `add_finding`, `trace_finding_lineage`, `propagate_risk_scores`, `find_choke_points`, `get_asset_subgraph`.
2. `crates/sentinel_knowledge/src/cte.rs` (NEW):
   - Struct `AttackGraphCteQueries`: SQL CTE query builder for SQLite recursive traversal.
   - Methods: `query_lineage_sql(finding_id)`, `query_attack_paths_sql(asset_id)`, `query_choke_points_sql()`.
3. `crates/sentinel_knowledge/src/lib.rs` (EXTEND):
   - Export `context_graph` and `cte` modules.
4. `crates/sentinel_coverage/src/planner.rs` (NEW):
   - Struct `AdaptiveTestPlanner`: Next-Best-Test scoring engine.
   - Struct `NextBestTest`: Ranked test candidate with explainable "WHY" rationale.
   - Struct `PlanScoringWeights`: Configurable scoring weights.
   - Struct `AdaptiveTestPlan`: Ordered collection of `NextBestTest` items.
   - Methods: `generate_plan(...)`, `calculate_score(...)`, `format_why_rationale(...)`.
5. `crates/sentinel_coverage/src/lib.rs` (EXTEND):
   - Export `planner` module.
6. `crates/sentinel_verification/src/differential.rs` (NEW):
   - Struct `DifferentialEngine`: Multi-session, multi-role, multi-state divergence analyzer.
   - Struct `DifferentialAnalysisResult`: Full semantic + statistical diff result.
   - Struct `SemanticDiff`: Status delta, header variance, LCS line diff, JSON key diff, token similarity ratio.
   - Struct `StatisticalDiff`: Sample means, variances, Welch's t-statistic, degrees of freedom, p-value.
   - Enum `DifferentialClassification`: `Identical`, `PermittedAccess`, `EnforcedDeny`, `StructuralAnomaly`, `TimingAnomaly`.
   - Methods: `analyze_responses(...)`, `evaluate_privilege_differential(...)`, `compute_json_key_diff(...)`, `compute_welch_t_test(...)`.
7. `crates/sentinel_verification/src/regression.rs` (NEW):
   - Struct `RegressionGraphEngine`: Security regression state machine and retest manager.
   - Struct `RegressionTestDefinition`: Reproducible retest suite specification.
   - Struct `RegressionExecutionResult`: Retest evaluation outcome.
   - Struct `RetestHistoryEntry`: CAS-linked retest audit entry.
   - Methods: `create_retest_definition(...)`, `execute_retest(...)`, `evaluate_state_transition(...)`.
8. `crates/sentinel_verification/src/lib.rs` (EXTEND):
   - Export `differential` and `regression` modules.
9. `crates/sentinel_plugin/src/research_pack.rs` (NEW):
   - Struct `ResearchPack`: Full signed research pack schema.
   - Struct `ResearchPackManifest`: Header metadata and cryptographic signature.
   - Struct `ResearchPackCheck`: Security check definitions and probe templates.
   - Struct `ResearchPackDictionary`: Custom wordlists and payloads.
   - Struct `ResearchPackVerifier`: Cryptographic HMAC-SHA256 / SHA-256 signature verifier.
   - Methods: `verify_pack(...)`, `sign_pack(...)`, `parse_pack(...)`.
10. `crates/sentinel_plugin/src/lib.rs` (EXTEND):
    - Export `research_pack` module.
11. `crates/sentinel_storage/src/memory.rs` (NEW):
    - Struct `EngagementMemory`: Project-isolated deterministic memory engine.
    - Struct `TestedVectorRecord`: Tested check, parameter, payload hash, timestamp, outcome.
    - Struct `NegativeControlRecord`: Formally verified negative control endpoint/parameter.
    - Methods: `has_tested_vector(...)`, `record_tested_vector(...)`, `get_verified_negative_controls(...)`, `save_to_disk(...)`, `load_from_disk(...)`.
12. `crates/sentinel_storage/src/lib.rs` (EXTEND):
    - Export `memory` module.

---

## 8. Specific Gaps & Worker Action Items

### Gap 1: Security Context Graph Implementation
- **Worker Action**:
  1. Implement `crates/sentinel_knowledge/src/context_graph.rs` with `SecurityContextGraph`, `ContextNodeType`, `ContextEdgeType`, `trace_finding_lineage`, `propagate_risk_scores`, `find_choke_points`.
  2. Implement `crates/sentinel_knowledge/src/cte.rs` with SQLite recursive CTE query helpers.
  3. Wire into `DefaultKnowledgeEngine` and export in `sentinel_knowledge/src/lib.rs`.
  4. Write comprehensive integration tests in `crates/sentinel_knowledge/tests/context_graph_tests.rs`.

### Gap 2: Adaptive Test Planner Implementation
- **Worker Action**:
  1. Implement `crates/sentinel_coverage/src/planner.rs` with `AdaptiveTestPlanner`, `NextBestTest`, multi-factor scoring formula, and explainable "WHY" rationale generator.
  2. Wire into `sentinel_coverage/src/lib.rs`.
  3. Write comprehensive tests in `crates/sentinel_coverage/tests/planner_tests.rs`.

### Gap 3: Differential Security Engine Implementation
- **Worker Action**:
  1. Implement `crates/sentinel_verification/src/differential.rs` with `DifferentialEngine`, semantic diffing (JSON key paths, LCS body, headers), statistical timing diffing (Welch's t-test), and privilege differential classification (`PermittedAccess` vs `EnforcedDeny`).
  2. Wire into `sentinel_verification/src/lib.rs`.
  3. Write comprehensive tests in `crates/sentinel_verification/tests/differential_tests.rs`.

### Gap 4: Security Regression Graph Implementation
- **Worker Action**:
  1. Implement `crates/sentinel_verification/src/regression.rs` with `RegressionGraphEngine`, `RegressionTestDefinition`, automated retesting logic, state machine transitions (`VULNERABLE` $\leftrightarrow$ `FIXED` $\leftrightarrow$ `REGRESSED`), and historical CAS evidence logging.
  2. Wire into `sentinel_verification/src/lib.rs`.
  3. Write comprehensive tests in `crates/sentinel_verification/tests/regression_tests.rs`.

### Gap 5: Engagement Memory & Signed Research Packs Implementation
- **Worker Action**:
  1. Implement `crates/sentinel_storage/src/memory.rs` with `EngagementMemory`, project-isolated deterministic test history (SEC-08), and negative control tracking.
  2. Implement `crates/sentinel_plugin/src/research_pack.rs` with `ResearchPack`, cryptographic HMAC-SHA256 / SHA-256 signature verification, schema validation, and hot-reloading.
  3. Update `DefaultResearchPackManager` in `sentinel_plugin/src/manager.rs` to use real signature verification.
  4. Write tests in `crates/sentinel_plugin/tests/research_pack_tests.rs` and `crates/sentinel_storage/tests/memory_tests.rs`.

---

## 9. Verification & Quality Gate Plan

To ensure 100% fidelity to the Sentinel V6 quality gates:
1. **Rust Workspace Compilation & Tests**:
   - `cargo check --workspace --locked` (0 errors)
   - `cargo test --workspace --locked` (100% pass across all unit, integration, and security tests)
2. **Frontend Test Suite**:
   - `npm test` (All 62+ Vitest test suites pass 100%)
3. **Canonical Spec Validator**:
   - `python architecture/v6/validate_v6_spec.py` (0 blockers, 0 warnings)
4. **Security Invariants**:
   - `SEC-01`: Fail-closed scope gating
   - `SEC-06` / `SEC-07`: Cryptographic SHA-256 CAS evidence linking
   - `SEC-08`: Project workspace filesystem isolation

# Critical Research Gaps & Open Security Challenges

**Document Identifier:** SENTINEL-RES-GAPS-14  
**Classification:** Research Gap Analysis & Scanner Limitation Assessment  

---

## 1. Ten Core Research Gap Evaluations

### 1. Well-Understood Techniques
- **Status**: Mature.
- **Classes**: Direct In-Band `UNION SELECT`, verbose error-based data extraction (`CAST`, `EXTRACTVALUE`), standard `WHERE` single-quote boolean tautologies (`' OR '1'='1`).
- **Reason**: High observability, deterministic error signatures, extensive open-source tooling coverage.

### 2. Poorly Detected by Current Automated Tools
- **Status**: High Failure Rate in Existing DASTs.
- **Classes**:
  - Unquoted dynamic `ORDER BY` sorting parameters in modern ORMs (TypeORM, Prisma, Sequelize).
  - PostgreSQL JSONB path key injections (`data->>'key'`).
  - GraphQL variable unmarshaling into dynamic resolver joins.
  - Second-order stored injections requiring cross-endpoint state transitions.

### 3. Difficult for Current Commercial Scanners
- **Status**: Fundamental Architectural Bottleneck.
- **Classes**: Asynchronous message queues (Kafka, Celery) where the web tier returns `202 Accepted` immediately and SQL execution occurs minutes later on a background worker.

### 4. Requiring Stateful Investigation
- **Status**: Requires Directed Dependency Graphs.
- **Classes**: Multi-step workflows (e.g. `POST /api/register` $\to$ `POST /api/auth` $\to$ `GET /api/profile`). Stateless scanners fail because the injection vector and the execution oracle are separated by multiple state transitions.

### 5. Requiring Source-Code Visibility (SAST/DAST Hybrid)
- **Status**: Dynamic SAST Assistance Justified.
- **Classes**: Custom internal stored procedures (`sp_executesql`), complex HQL/JPQL expressions inside proprietary Java enterprise backends, and unreflected dynamic DDL commands.

### 6. Requiring Unusual Application Behavior
- **Status**: Emerging Horizon (2025–2026).
- **Classes**: Vector similarity distance operators in AI databases (`pgvector` `<=>` cosine distance), and Text-to-SQL LLM agents where natural language prompts are translated into dynamic SQL queries.

### 7. Producing High False-Positive Rates in Legacy Scanners
- **Status**: Major Operational Pain Point.
- **Classes**:
  - Single-threshold timing probes failing due to transient internet jitter or server load spikes.
  - Search box input reflection where searching for `' OR 1=1` reflects `' OR 1=1` in the HTML page, triggering naive boolean diff matchers.
  - Generic `500 Internal Server Error` default error handlers triggered by any invalid character.

### 8. Difficult to Confirm Experimentally
- **Status**: Egress-Restricted Environments.
- **Classes**: Fire-and-forget audit logging queries in heavily firewalled cloud subnets where outbound DNS (OAST), error responses, and boolean branching are completely disabled.

### 9. Under-Tested Modern Ingress Surfaces
- **Status**: High Real-World Prevalence.
- **Classes**: REST clean URL path parameters (`/api/v1/resource/{id}`), GraphQL variables JSON payloads, custom internal gateway headers (`X-Consumer-Custom-ID`), and WebSocket message frames.

### 10. Priority Areas for Future Research
- **Status**: Recommended Focus for Sentinel Architecture.
- **Areas**:
  - Multi-Oracle Evidence Fusion to eliminate echo false positives.
  - In-process Wald SPRT for deterministic timing inference.
  - Directed Workflow Graph Tracking for second-order discovery.
  - Counterfactual Causal Verification ($P(Y \mid \text{do}(X))$).

# Target, Landscape & Fixtures Survey Report (Requirements R1, R2, R3)

**Author:** Target & Fixtures Survey Lead  
**Working Directory:** `c:/Users/Legion 5 pro/Desktop/cyber sec/.agents/explorer_survey_target/`  
**Project Workspace Root:** `c:/Users/Legion 5 pro/Desktop/cyber sec/research_lab`  
**Date:** 2026-08-21  
**Status:** COMPLETE  

---

## 1. Executive Summary & Survey Scope

This technical survey establishes the foundational architecture and design specifications for Requirements **R1** (*State-of-the-Art Research Landscape*), **R2** (*Hardened Multi-Tenant Web App Baseline*), and **R3** (*Ground-Truth Vulnerable Lab & Negative Controls*) within the standalone Security Research Laboratory.

### 1.1 Core Objectives
1. **R1 (Research Landscape):** Deeply analyze the global DAST/IAST/fuzzing ecosystem, state-of-the-art automated discovery engines, differential security techniques, vulnerability intelligence databases, and formal prior-art novelty verification gates.
2. **R2 (Hardened Target Baseline):** Architect a realistic, production-grade, multi-tenant web application featuring RBAC/ABAC authorization, stateful asynchronous workflows, strict parameterization, and defense-in-depth controls with 0 critical/high vulnerabilities and 0 false positives.
3. **R3 (Ground-Truth Lab & Negative Controls):** Formulate complete technical specifications for labeled vulnerability fixtures across 7 core CWE classes (SQLi, XSS, BOLA, BFLA, TOCTOU, JWT bypass, SSRF) plus advanced temporal state-machine primitives, pairing each with fixed and benign negative controls.

---

## 2. Requirement R1: State-of-the-Art Research Landscape Survey

### 2.1 Automated Vulnerability Discovery & DAST Engine Taxonomy

A rigorous review of the contemporary automated security testing ecosystem reveals distinct methodology paradigms, trade-offs, and critical gaps:

| Tool / Engine | Developer / Primary Source | Architecture & Methodology | Key Capabilities | Decisive Limitations | License |
|---|---|---|---|---|---|
| **ProjectDiscovery Nuclei** | ProjectDiscovery (`github.com/projectdiscovery/nuclei`) | Declarative YAML DSL matching across HTTP, TCP, DNS, SSL, WebSocket, Code, and Headless Browser. | Extremely fast, community-driven vulnerability templates, protocol-level extensibility. | Lacks dynamic state inference; cannot autonomously chain multi-step business logic anomalies without manual scripts. | MIT |
| **ProjectDiscovery Neo** | ProjectDiscovery (2024–2025) | Graph-based contextual asset correlation and AI-assisted attack path mapping. | Identifies systemic attack surfaces and contextual vulnerability relationships. | Dependent on predefined rule heuristics; high false-positive rate on non-standard authentication and custom state machines. | Commercial |
| **PortSwigger Burp Scanner** | PortSwigger Web Security Research | Insertion-point mutation, dynamic OAST (Burp Collaborator), heuristics-based differential response analysis. | Industry standard for single-request injection classes (SQLi, XSS, SSTI, SSRF, Deserialization, HTTP Desync). | Heavy computational footprint; struggles with deep temporal state-machine constraints and multi-identity authorization matrices. | Commercial |
| **OWASP ZAP** | OWASP (`zaproxy.org`) | Active/passive proxy scanner with scriptable rule add-ons (Zest, Python, Groovy). | Open, extensible, robust Spider/AJAX crawling, active rule ecosystem. | High false positive rate on modern SPAs/GraphQL APIs; limited state-transition anomaly detection. | Apache 2.0 |
| **Caido** | Caido Inc. (`caido.io`) | Rust-based lightweight intercepted proxy, GraphQL event bus, match-and-replace pipeline. | Blazing fast, minimal memory footprint, deterministic raw byte manipulation. | Primarily a manual pentesting workstation; automated fuzzing and scanning require external plugins. | Proprietary / Freemium |
| **FFUF / Turbo Intruder** | `ffuf/ffuf` & James Kettle (PortSwigger) | High-speed HTTP request pipelining, multi-threaded wordlist permutation, single-packet race synchronization. | Raw throughput, precise timing control for race conditions (TOCTOU) and hidden parameter discovery. | No semantic response understanding; requires human analysis to interpret response variations. | MIT / PortSwigger |
| **ProjectDiscovery Katana** | ProjectDiscovery (`github.com/projectdiscovery/katana`) | Headless Chromium + standard pipeline web crawler with JavaScript endpoint extraction. | Comprehensive client-side route discovery and DOM source/sink identification. | Discovery only; does not perform active vulnerability fuzzing or authorization differential checks. | MIT |
| **Interactsh** | ProjectDiscovery (`github.com/projectdiscovery/interactsh`) | Out-of-band AST server supporting DNS, HTTP, HTTPS, SMTP, and LDAP callback logging with AES-256 tokens. | Reliable detection of blind injection (Blind SSRF, Blind SQLi, RCE) without in-band reflection. | Out-of-band detection only; cannot verify multi-step business logic or state corruption. | MIT |

### 2.2 Advanced Testing Methodologies

#### A. Differential Fuzzing & Parser Disagreements
* **Concept:** Exposing two or more parsers, decoders, or intermediaries (e.g., Reverse Proxy vs. Application Server, JSON decoders, JWT signature verifiers) to structurally divergent inputs to detect semantic desynchronization.
* **Key Patterns:**
  * *HTTP Request Smuggling & Desync (CL.TE, TE.CL, H2.TE, chunked extensions)*: Exploits parsing differences in request delimitation.
  * *JSON Interoperability Differentials (RFC 8259 vs. RFC 7159)*: Duplicate key precedence, numeric truncation, and Unicode normalization differences.
  * *JWT Algorithm & Claim Parsing Differentials*: Python-Jose vs. PyJWT header evaluation differences or `none` algorithm acceptance.
* **Research Laboratory Relevance:** The research engine must simulate parser divergence across gateway/backend boundaries to discover logic desynchronization flaws.

#### B. State-Machine & Authorization Asymmetry Inference
* **Concept:** Dynamically modeling the application's Directed Acyclic Graph (DAG) or Finite State Machine (FSM) across multiple authenticated security contexts (e.g., Tenant A Admin, Tenant A Member, Tenant B Member, Anonymous).
* **Key Techniques:**
  * *Multi-Session Differential Replay (Autorize-style)*: Replaying requests under alternate user tokens and computing cosine/Levenshtein/status-code distance.
  * *Object Graph Binding Inference*: Identifying entity identifiers (`invoice_id`, `org_id`, `account_id`) in URL paths, headers, and request bodies.
  * *Temporal Order Anomaly Fuzzing*: Executing multi-step business actions out-of-order (e.g., committing an unapproved stage, calling rollback followed by cross-tenant commit).
* **Research Laboratory Relevance:** Traditional scanners reliably find simple BOLA/IDOR (CWE-639) or BFLA (CWE-862). The research lab must investigate complex temporal/asynchronous authorization desynchronization.

#### C. Autonomous AI-Assisted Security Research & Verification Guardrails
* **Concept:** Autonomous agents (LLM-driven or heuristic-driven) exploring attack surfaces, generating hypotheses, and executing test suites.
* **Failure Modes:** Current AI pentesting agents suffer from high hallucination rates—falsely classifying standard HTTP 200 responses, error stacks, or documentation discrepancies as zero-day vulnerabilities.
* **Mandatory Laboratory Guardrail:** Strict dual-role separation:
  1. *Researcher Role*: Hypothesizes and discovers anomalies.
  2. *Verifier Role*: Independently re-executes tests in isolation against positive, fixed, and benign controls before confirming any finding.

### 2.3 Vulnerability Intelligence Ecosystem & Prior-Art Verification Gate

To ensure research novelty, any candidate anomaly discovered by the research engine must be correlated against authoritative intelligence feeds:

1. **NVD (National Vulnerability Database / NIST):** Formal CVE entries, CVSS v3.1/v4.0 scoring, and CWE taxonomy.
2. **CISA KEV (Known Exploited Vulnerabilities):** Authoritative catalog of actively exploited real-world flaws.
3. **GitHub Security Advisories (GHSA) & OSV.dev:** Upstream package registry disclosures (PyPI, npm, crates.io, Go, Maven).
4. **Academic Conferences & Research Publications:** USENIX Security, IEEE S&P (Oakland), ACM CCS, Black Hat, DEF CON, OffensiveCon, PortSwigger Top 10 Web Hacking Techniques.

#### Prior-Art Novelty Classification Taxonomy
* **`KNOWN_TEST_FIXTURE`**: Standard seeded vulnerability in the laboratory (e.g., basic BOLA, basic SQLi).
* **`VARIANT`**: A known vulnerability class exhibiting a minor syntactic permutation or secondary parameter location without novel root-cause mechanics.
* **`NOVEL_CANDIDATE`**: An anomaly that violates an uncharacterized security boundary or state-machine constraint not matching existing CVE/CWE signatures.
* **`CONFIRMED_NOVEL`**: An anomaly that has been independently verified across positive, negative, and benign controls, proven novel via automated prior-art search, and generalized across multiple target frameworks.

---

## 3. Technology Stack Evaluation for Lab Target & Fixtures

### 3.1 Stack Comparison Matrix

| Evaluation Dimension | Option 1: Python / FastAPI + Pydantic v2 + SQLite (Async) | Option 2: Node.js / Express or Fastify + TypeScript + Better-SQLite3 | Option 3: Rust / Axum + SQLx + Tokio | Option 4: Python / Flask + SQLite (Synchronous) |
|---|---|---|---|---|
| **Multi-Tenancy Modeling** | ⭐⭐⭐⭐⭐ Native dependency injection (`Depends(get_tenant_context)`) allows clean toggle between hardened and vulnerable resolvers. | ⭐⭐⭐⭐ Express middleware chains (`req.tenant`), but easily mutated in untyped JS. | ⭐⭐⭐⭐⭐ Compile-time extractors (`Extension<Tenant>`), but verbose to dynamically bypass. | ⭐⭐⭐ Flask `g.tenant` global context; easy to leak state across threads. |
| **Concurrency & Race Modeling (TOCTOU)** | ⭐⭐⭐⭐⭐ Native `asyncio` event loop + `asyncio.sleep()` / task scheduling provides millisecond-precise race window simulation. | ⭐⭐⭐⭐ Event loop works well, but single-threaded JS makes true multi-worker database lock races harder to simulate without clustering. | ⭐⭐⭐⭐⭐ True multi-threaded OS threads via Tokio; highly realistic race conditions. | ⭐⭐⭐ Requires manual `threading` / OS thread locks; difficult to control deterministically. |
| **Input Validation vs Mass Assignment** | ⭐⭐⭐⭐⭐ Pydantic v2 DTOs provide explicit contrast between strict model parsing and vulnerable dict unpacking (`model.update(data)`). | ⭐⭐⭐⭐ Zod / Joi validation provides good contrast, but requires extra libraries. | ⭐⭐⭐⭐ Serde provides strict parsing, making deliberate mass assignment unnatural to model. | ⭐⭐ Requires manual validation logic or marshmallow; prone to inconsistent modeling. |
| **OpenAPI / JSON Schema Generation** | ⭐⭐⭐⭐⭐ Automatic OpenAPI 3.1 schema generation at `/openapi.json` and interactive Swagger docs at `/docs`. | ⭐⭐⭐ Requires manual swagger-jsdoc or tsoa annotations. | ⭐⭐⭐ Requires utoipa / aidoku crates with substantial boilerplate. | ⭐⭐ Requires flask-openapi3 or manual swagger setup. |
| **Portability & Zero External Daemons** | ⭐⭐⭐⭐⭐ Single Python process running Uvicorn + SQLite (in-memory or file-backed). Zero binary compilation required. | ⭐⭐⭐⭐ Requires Node runtime and `npm install`; package management overhead. | ⭐⭐⭐ Requires Rust toolchain and cargo compile times; slower iteration for fixture updates. | ⭐⭐⭐⭐⭐ Single Python process; minimal dependencies. |
| **Tooling & Ecosystem Alignment** | ⭐⭐⭐⭐⭐ Standard for AI security agents, Python requests/httpx testing harnesses, and rapid fixture authoring. | ⭐⭐⭐⭐ Good for browser/DOM interaction; less common for backend security research harnesses. | ⭐⭐⭐ Matches Sentinel core; but excessive overhead for research target fixtures. | ⭐⭐⭐ Standard, but legacy compared to modern async ASGI architectures. |

### 3.2 Stack Recommendation & Architectural Selection

**Recommended Stack:** **Python 3.11+ / FastAPI + Pydantic v2 + SQLite / `aiosqlite` (ASGI)**  
*(With a zero-dependency fallback compatible with Python standard library `http.server` / `sqlite3` for minimal test runners)*.

#### Architectural Rationale:
1. **Pydantic v2 Schema Modeling:** Clearly differentiates between strict Data Transfer Objects (DTOs) in hardened routes and unconstrained dictionary unpacking in vulnerable routes (CWE-915 Mass Assignment).
2. **Asynchronous Request Pipeline:** `asyncio` allows deterministic control of timing delays, race conditions (TOCTOU CWE-367), and asynchronous event bus rollback desynchronization (CAND-001).
3. **Automated OpenAPI 3.1 Introspection:** The research engine and autonomous discovery agents can introspect endpoints, parameters, and schemas directly via `/openapi.json`.
4. **Reproducibility & Lightweight Isolation:** Runs independently in any standard Python environment on Windows, Linux, and macOS without database server dependencies (e.g., PostgreSQL/MySQL containers).

---

## 4. Requirement R2: Hardened Multi-Tenant Production-Like Target Baseline (`lab/target/`)

### 4.1 Domain Architecture & Data Model

The hardened target represents a realistic multi-tenant SaaS enterprise platform (e.g., "Enterprise Cloud Hub") with full tenant isolation, role-based access control, stateful approval workflows, and background job handling.

```
+-----------------------------------------------------------------------------------+
|                              ENTERPRISE CLOUD HUB                                 |
+-----------------------------------------------------------------------------------+
|  Tenant Isolation Layer (tenant_id = org_alpha | org_beta | org_gamma)            |
|                                                                                   |
|  +------------------+  +------------------+  +------------------+                 |
|  |   Auth & Roles   |  | Invoices & Bills |  | Accounts/Ledger  |                 |
|  | - Owner / Admin  |  | - Scoped Queries |  | - Atomic Updates |                 |
|  | - Member / Guest |  | - ABAC Ownership |  | - Balance Checks |                 |
|  +------------------+  +------------------+  +------------------+                 |
|                                                                                   |
|  +------------------+  +------------------+  +------------------+                 |
|  | Approval Workflows| | Webhook Dispatch |  | Profile & Settings|                |
|  | - Immutable Lock |  | - SSRF Blocklist |  | - Strict DTOs    |                 |
|  | - Multi-Stage FSM|  | - Safe DNS / URL |  | - No Mass Assign |                 |
|  +------------------+  +------------------+  +------------------+                 |
+-----------------------------------------------------------------------------------+
```

#### Core Entities & Schema:
1. **Tenants (`tenants`):** `id` (UUID/slug), `name`, `tier`, `created_at`, `is_active`.
2. **Users (`users`):** `id`, `tenant_id`, `username`, `password_hash` (Argon2id), `role` (`owner`, `admin`, `member`, `auditor`), `full_name`, `email`, `credits`, `is_verified`.
3. **Invoices (`invoices`):** `id`, `tenant_id`, `created_by`, `title`, `amount`, `secret_notes`, `status` (`DRAFT`, `PENDING`, `PAID`, `CANCELLED`).
4. **Ledger Accounts (`accounts`):** `id`, `tenant_id`, `account_number`, `username`, `balance`, `updated_at`.
5. **Workflows (`workflows`):** `id`, `tenant_id`, `initiator`, `current_stage`, `status` (`INITIATED`, `STAGED_AWAITING_RETRY`, `APPROVED_AND_EXECUTED`, `REJECTED`), `payload`, `tenant_context_lock`.
6. **Audit Logs (`audit_logs`):** `id`, `tenant_id`, `actor`, `action`, `resource_type`, `resource_id`, `timestamp`, `ip_address`.
7. **Webhook Subscriptions (`webhooks`):** `id`, `tenant_id`, `target_url`, `events`, `secret_token`, `is_active`.

### 4.2 Comprehensive Hardening Baseline Controls

The hardened target baseline (`lab/target/`) must strictly enforce the following security invariants:

| Security Domain | Hardening Mechanism | Technical Implementation & Safeguard | Zero FP / Security Guarantee |
|---|---|---|---|
| **Authentication (SEC-AUTH)** | Cryptographic JWT + Argon2id | Tokens signed using `HS256` with strong 256-bit secret; explicit algorithm whitelist; signature validation mandatory; tokens include `sub`, `tenant_id`, `role`, `exp` (1 hour), `jti`. | Rejects unsigned tokens (`alg: none`), expired tokens, and cross-algorithm attacks. |
| **Authorization: BOLA (SEC-BOLA)** | Tenant-Scoped Database Queries | Every single-record read/update/delete includes `WHERE id = :id AND tenant_id = :current_user_tenant_id`. | Cross-tenant access strictly returns `404 Not Found` (or `403 Forbidden`). |
| **Authorization: BFLA (SEC-BFLA)** | Role-Based Access Dependencies | Administrative endpoints enforce `@require_role(["owner", "admin"])` before executing controller logic. | Unprivileged users (`member`, `auditor`, `guest`) receive `403 Forbidden`. |
| **Input Validation (SEC-INPUT)** | Pydantic v2 DTO Whitelisting | All endpoints accept strongly-typed Pydantic request models with `model_config = ConfigDict(extra="forbid")`. | Eliminates Mass Assignment (CWE-915); internal properties (`role`, `is_verified`, `credits`) cannot be injected. |
| **Database Security (SEC-SQLI)** | Strict Parameterization / ORM | 100% of queries utilize prepared statements or SQLAlchemy ORM filters with bound parameters. Zero raw string concatenation. | Immune to SQL Injection across all string, numeric, and filter inputs. |
| **Output Security & XSS (SEC-XSS)** | Context-Aware Output Escaping + CSP | All web views and JSON serialization enforce automatic HTML entity escaping. HTTP response headers include strict `Content-Security-Policy: default-src 'self'`. | Immune to Stored and Reflected XSS; prevents script injection. |
| **Concurrency & TOCTOU (SEC-RACE)** | Atomic Conditional Updates | Balance transfers execute single atomic updates: `UPDATE accounts SET balance = balance - :amt WHERE username = :user AND balance >= :amt` inside immediate transactions. | Double-spending impossible; negative balance conditions prevented under high concurrency. |
| **SSRF Defense (SEC-SSRF)** | Pre-Socket IP Filter & DNS Check | Webhook dispatch parses URLs, resolves DNS, and validates that destination IP is not in private/reserved ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`; Loopback: `127.0.0.0/8`, `::1`; Cloud Metadata: `169.254.169.254`). | Blocks requests to internal services, local daemons, and cloud instance metadata. |
| **State Machine Safety (SEC-STATE)** | Immutable Tenant Context Pinning | Stateful workflows cryptographically bind and validate `tenant_id` across every stage transition and rollback event. | Eliminates state machine desynchronization and cross-tenant stage hijacking. |

### 4.3 Baseline Verification Checklist

Before accepting `lab/target/` as the hardened baseline, the test suite must verify:
- [ ] 0 critical or high vulnerability findings reported by SAST and DAST scanners.
- [ ] 0 false positive detections across benign negative control workflows.
- [ ] 100% compliance with tenant isolation across all multi-tenant endpoints.
- [ ] Complete test suite coverage across authentication, authorization, and state transitions.

---

## 5. Requirement R3: Ground-Truth Vulnerable Lab & Negative Controls

### 5.1 Lab Structure & Operating Modes

The research laboratory requires two clean operating models for automated evaluation:
1. **Modular Directory Separation (Canonical Repository Layout):**
   * `lab/target/`: Production-grade hardened SaaS application.
   * `lab/ground_truth/`: Isolated vulnerable test fixtures with deliberate vulnerabilities for benchmarking.
   * `lab/fixed_controls/`: Exact remediated counterparts for each fixture to verify scanner negative controls.
2. **Runtime Dual-Mode Server (Single Engine with Parameterized Behavior):**
   * Server accepts `--mode=vulnerable` (seeds known vulnerabilities for scanner verification) and `--mode=fixed` (enforces remediations for negative control verification).

### 5.2 Exhaustive Vulnerability Fixtures Specification

Below is the formal engineering specification for the 7 standard vulnerability classes plus the advanced temporal state-machine candidate fixture:

---

#### Fixture 1: SQL Injection (SQLi)
* **Fixture ID:** `LAB-SQLI-001`
* **CWE:** CWE-89 (Improper Neutralization of Special Elements used in an SQL Command)
* **Endpoint:** `GET /api/v1/search?q={query}`
* **Vulnerable Mechanics:** The search controller constructs dynamic SQL via string formatting:
  ```python
  # Vulnerable: Raw string concatenation
  cursor.execute(f"SELECT id, title, amount FROM invoices WHERE tenant_id = '{user.tenant_id}' AND title LIKE '%{q}%'")
  ```
* **Fixed Counterpart:** Parameterized query with bound parameters:
  ```python
  # Fixed: Parameterized query
  cursor.execute("SELECT id, title, amount FROM invoices WHERE tenant_id = ? AND title LIKE ?", (user.tenant_id, f"%{q}%"))
  ```
* **Defensive Test Parameters & Inputs:**
  * *Exploratory / Probe Pattern:* Quote-terminating search strings (e.g. `' OR '1'='1`, `' UNION SELECT ...`).
  * *Benign Control Input:* Normal user queries containing quotes or symbols (e.g. `Q1 Vendor's Report #101`, `O'Connor Logistics`).
* **Detection Criteria:**
  * *Vulnerable:* Database syntax error reflection, or unexpected data records from cross-tenant invoices returned in JSON response.
  * *Fixed / Benign:* Standard HTTP 200 containing only tenant-authorized records matching the literal string, or 0 results if no match.

---

#### Fixture 2: Cross-Site Scripting (XSS) — Reflected & Stored
* **Fixture ID:** `LAB-XSS-001`
* **CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)
* **Endpoints:**
  * Reflected: `GET /api/v1/preview?template={template_str}`
  * Stored: `POST /api/v1/invoices/notes` with body `{"invoice_id": 101, "note": "{untrusted_content}"}`
* **Vulnerable Mechanics:**
  * Returns user input unencoded with `Content-Type: text/html` or stores raw unescaped HTML rendered directly in admin dashboards without template escaping.
* **Fixed Counterpart:**
  * Enforces `html.escape(untrusted_content)`, returns `Content-Type: application/json` or `text/plain`, and applies strict `Content-Security-Policy: default-src 'self'`.
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:* Harmless HTML/JS markup markers (e.g. `<script>console.log(1337)</script>`, `<img src=x onerror=alert(1)>`).
  * *Benign Control Input:* Standard plain-text markup (e.g. `<b>Audit Complete</b>`, `Total < $5,000 & Approved > 2026`).
* **Detection Criteria:**
  * *Vulnerable:* Response contains raw unescaped `<script>` or event handler tags rendered in an executable HTML context.
  * *Fixed / Benign:* Special characters are safely escaped as `&lt;script&gt;` or safely serialized in JSON.

---

#### Fixture 3: Broken Object Level Authorization (BOLA / IDOR)
* **Fixture ID:** `LAB-BOLA-001`
* **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)
* **Endpoint:** `GET /api/v1/invoices/{invoice_id}`
* **Vulnerable Mechanics:** The controller queries the invoice solely by `invoice_id` without filtering by the requesting user's `tenant_id`:
  ```python
  # Vulnerable: Missing tenant ownership filter
  cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
  ```
* **Fixed Counterpart:**
  ```python
  # Fixed: Enforces tenant context isolation
  cursor.execute("SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, current_user.tenant_id))
  ```
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:* Tenant B user session requests `/api/v1/invoices/101` (where invoice 101 belongs to Tenant A).
  * *Benign Control Input:* Tenant A user requests `/api/v1/invoices/101` (own invoice).
* **Detection Criteria:**
  * *Vulnerable:* HTTP 200 returned to Tenant B containing confidential Tenant A data.
  * *Fixed:* HTTP 404 (or 403 Forbidden) returned to Tenant B with error `"Invoice not found or access denied"`.
  * *Benign Control:* HTTP 200 returned to Tenant A with valid invoice payload.

---

#### Fixture 4: Broken Function Level Authorization (BFLA)
* **Fixture ID:** `LAB-BFLA-001`
* **CWE:** CWE-862 (Missing Authorization) / CWE-285 (Improper Authorization)
* **Endpoint:** `POST /api/v1/admin/promote` (or `POST /api/v1/admin/backup`)
* **Vulnerable Mechanics:** Endpoint validates authentication token existence, but fails to check if `user.role == 'admin'`:
  ```python
  # Vulnerable: Authenticated, but no role check
  @app.post("/api/v1/admin/promote")
  def promote_user(body: PromoteRequest, user = Depends(get_auth_user)):
      # Directly executes role elevation
      db.update_user_role(body.username, body.new_role)
  ```
* **Fixed Counterpart:**
  ```python
  # Fixed: Mandatory role authorization dependency
  @app.post("/api/v1/admin/promote")
  def promote_user(body: PromoteRequest, user = Depends(require_role(["owner", "admin"]))):
      db.update_user_role(body.username, body.new_role)
  ```
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:* Standard unprivileged user (`role: member`) submits request to promote self to `admin`.
  * *Benign Control Input:* Legitimate Administrator (`role: admin`) submits promotion request.
* **Detection Criteria:**
  * *Vulnerable:* HTTP 200 returned to member with updated user object displaying `role: admin`.
  * *Fixed:* HTTP 403 Forbidden returned to member with error `"Forbidden: Administrator role required"`.
  * *Benign Control:* HTTP 200 returned to administrator and role successfully updated.

---

#### Fixture 5: Concurrency TOCTOU Balance Race Condition
* **Fixture ID:** `LAB-TOCTOU-001`
* **CWE:** CWE-367 (Time-of-check Time-of-use Race Condition)
* **Endpoint:** `POST /api/v1/transfer`
* **Vulnerable Mechanics:** Balance verification and balance deduction occur across separated non-atomic queries with an intervening processing delay:
  ```python
  # Vulnerable: Non-atomic balance check and debit
  bal = db.get_balance(sender)
  if bal >= amount:
      time.sleep(0.05)  # Processing window
      db.set_balance(sender, bal - amount)
      db.credit_balance(recipient, amount)
  ```
* **Fixed Counterpart:**
  ```python
  # Fixed: Atomic conditional database update
  cursor.execute(
      "UPDATE accounts SET balance = balance - ? WHERE username = ? AND balance >= ?",
      (amount, sender, amount)
  )
  if cursor.rowcount == 0:
      raise HTTPException(400, "Insufficient funds")
  cursor.execute("UPDATE accounts SET balance = balance + ? WHERE username = ?", (amount, recipient))
  ```
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:* 10 concurrent requests sent simultaneously each requesting transfer of $100 from an account with initial balance of $100.
  * *Benign Control Input:* 2 sequential transfer requests of $50 each against an initial balance of $100.
* **Detection Criteria:**
  * *Vulnerable:* Multiple concurrent transfers succeed, resulting in final account balance becoming negative (-$900).
  * *Fixed:* Exactly 1 transfer succeeds (balance drops to $0), and the remaining 9 concurrent requests fail with HTTP 400 Insufficient Funds.
  * *Benign Control:* Both sequential $50 transfers succeed, ending with balance $0, with subsequent transfers rejected cleanly.

---

#### Fixture 6: JWT Security Flaws / Algorithm Confusion (`none` Algorithm)
* **Fixture ID:** `LAB-JWT-001`
* **CWE:** CWE-347 (Improper Verification of Cryptographic Signature) / CWE-345
* **Endpoint:** `GET /api/v1/secure-vault`
* **Vulnerable Mechanics:** Token validation decoder inspects the JWT header `alg` field and skips signature verification if `alg == 'none'`:
  ```python
  # Vulnerable: Respects unauthenticated header alg
  header = json.loads(b64decode(parts[0]))
  if header.get("alg") == "none":
      return json.loads(b64decode(parts[1]))  # Accepts unsigned payload
  ```
* **Fixed Counterpart:**
  ```python
  # Fixed: Hardcoded HS256 algorithm enforcement
  payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
  ```
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:* JWT constructed with header `{"typ": "JWT", "alg": "none"}` and payload `{"sub": "attacker", "role": "admin", "tenant_id": "tenant_a"}` without signature.
  * *Benign Control Input:* Properly signed JWT generated by `/api/v1/auth/login` using `HS256`.
* **Detection Criteria:**
  * *Vulnerable:* Server accepts unsigned token and returns HTTP 200 with sensitive vault secrets.
  * *Fixed:* Server rejects unsigned token with HTTP 401 Unauthorized (`"Invalid token signature"`).
  * *Benign Control:* Properly signed valid token accesses authorized resources normally.

---

#### Fixture 7: Server-Side Request Forgery (SSRF)
* **Fixture ID:** `LAB-SSRF-001`
* **CWE:** CWE-918 (Server-Side Request Forgery)
* **Endpoint:** `POST /api/v1/webhooks/test` (or `POST /api/v1/fetch_url`)
* **Vulnerable Mechanics:** Server directly executes an HTTP GET request to a user-supplied URL without destination IP or protocol validation:
  ```python
  # Vulnerable: Unrestricted HTTP request
  resp = urllib.request.urlopen(target_url, timeout=3)
  return resp.read()
  ```
* **Fixed Counterpart:**
  ```python
  # Fixed: Pre-socket IP blocklist check
  parsed = urlparse(target_url)
  if parsed.scheme not in ("http", "https"):
      raise HTTPException(400, "Invalid protocol")
  ip = socket.gethostbyname(parsed.hostname)
  ip_obj = ipaddress.ip_address(ip)
  if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
      raise HTTPException(403, "Access to private/local network rejected")
  ```
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:* Request with `target_url` pointing to internal loopback (`http://127.0.0.1:8888/api/health`) or cloud metadata (`http://169.254.169.254/latest/meta-data/`).
  * *Benign Control Input:* Request with `target_url` pointing to a mock external benign webhook URL (`http://external-api.example.com/webhook`).
* **Detection Criteria:**
  * *Vulnerable:* Server issues request to internal loopback/metadata IP and returns response content.
  * *Fixed:* Server validates IP address and returns HTTP 403 Forbidden with error `"Access to private/local network rejected"`.
  * *Benign Control:* External benign URL request succeeds or fails gracefully with network timeout without security error.

---

#### Fixture 8: Advanced State-Machine Temporal Authorization Asymmetry
* **Fixture ID:** `CAND-001` / `H-006`
* **CWE:** CWE-863 / CWE-362 (Temporal Authorization Asymmetry)
* **Endpoints:**
  * Step 1: `POST /api/v1/workflow/initiate`
  * Step 2: `POST /api/v1/workflow/stage` (action: `rollback` or `advance`)
  * Step 3: `POST /api/v1/workflow/commit`
* **Vulnerable Mechanics:** When an asynchronous workflow stage undergoes a rollback or partial recovery, the server sets `tenant_context_lock = NULL` to allow retries. If the commit handler checks `tenant_context_lock is None` before asserting tenant ownership, a cross-tenant user (Tenant B) can commit the workflow under Tenant A's authority.
* **Fixed Counterpart:** Strict immutable tenant context pinning where `tenant_id` is validated on every state transition, and rollback retains immutable tenant ownership locks.
* **Defensive Test Parameters & Inputs:**
  * *Probe Pattern:*
    1. Tenant A initiates workflow `wf_100`.
    2. Tenant A triggers asynchronous rollback (`action: "rollback"`).
    3. Tenant B immediately issues commit for `wf_100`.
  * *Benign Control Input:* Tenant A initiates, advances, and commits `wf_100` normally.
* **Detection Criteria:**
  * *Vulnerable:* Tenant B successfully commits `wf_100`, receiving HTTP 200 with status `"APPROVED_AND_EXECUTED"` under Tenant A authority.
  * *Fixed:* Tenant B's commit is rejected with HTTP 403 Forbidden (`"Cross-tenant workflow mutation prohibited"`).
  * *Benign Control:* Tenant A's normal sequential workflow execution succeeds completely.

---

### 5.3 Ground-Truth Manifest Specification (`VULNERABILITY_REGISTRY.yaml`)

The canonical ground-truth registry must define each fixture with structured metadata:

```yaml
version: "2.0.0"
lab_name: "Security Research Laboratory Ground-Truth Registry"
target_environment: "Isolated Research Lab (Local)"

fixtures:
  - id: "LAB-SQLI-001"
    category: "Injection"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-89"
    name: "SQL Injection in Invoice Search Parameter"
    endpoint: "/api/v1/search"
    method: "GET"
    parameter: "q"
    vulnerable_behavior: "Unescaped single quotes alter SQL syntax and leak cross-tenant records."
    fixed_behavior: "Parameterized SQL query treats all input literally."
    detection_criteria: "SQL syntax error reflection or cross-tenant data in JSON payload."
    severity: "HIGH"

  - id: "LAB-XSS-001"
    category: "Cross-Site Scripting"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-79"
    name: "Stored and Reflected XSS in Invoice Notes"
    endpoint: "/api/v1/invoices/notes"
    method: "POST"
    parameter: "note"
    vulnerable_behavior: "Unescaped HTML tags reflected directly in HTML responses."
    fixed_behavior: "HTML entity escaping and strict CSP headers applied."
    detection_criteria: "Unescaped <script> or event handlers in text/html context."
    severity: "MEDIUM"

  - id: "LAB-BOLA-001"
    category: "Authorization"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-639"
    name: "Broken Object Level Authorization on Invoices"
    endpoint: "/api/v1/invoices/{id}"
    method: "GET"
    parameter: "id"
    vulnerable_behavior: "Tenant B retrieves Tenant A invoice by direct ID reference."
    fixed_behavior: "Query scoped by current user tenant_id, returning 404/403 for cross-tenant ID."
    detection_criteria: "HTTP 200 returning cross-tenant confidential data to unauthorized session."
    severity: "CRITICAL"

  - id: "LAB-BFLA-001"
    category: "Authorization"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-862"
    name: "Broken Function Level Authorization on Admin Promotion"
    endpoint: "/api/v1/admin/promote"
    method: "POST"
    parameter: "None"
    vulnerable_behavior: "Low-privileged member elevates role to admin."
    fixed_behavior: "Enforces @require_role('admin') check, returning 403 Forbidden."
    detection_criteria: "HTTP 200 with role: admin returned to unprivileged user."
    severity: "HIGH"

  - id: "LAB-TOCTOU-001"
    category: "Concurrency"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-367"
    name: "TOCTOU Balance Transfer Race Condition"
    endpoint: "/api/v1/transfer"
    method: "POST"
    parameter: "amount"
    vulnerable_behavior: "Concurrent transfers result in double-spending and negative account balance."
    fixed_behavior: "Atomic conditional database update prevents overspending."
    detection_criteria: "Total transferred funds exceed initial balance under concurrent requests."
    severity: "HIGH"

  - id: "LAB-JWT-001"
    category: "Authentication"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-347"
    name: "JWT None Algorithm Authentication Bypass"
    endpoint: "/api/v1/secure-vault"
    method: "GET"
    parameter: "Authorization Header"
    vulnerable_behavior: "Server accepts unsigned JWT with alg: none."
    fixed_behavior: "Enforces mandatory HS256 signature verification."
    detection_criteria: "HTTP 200 granted to unsigned token with forged claims."
    severity: "CRITICAL"

  - id: "LAB-SSRF-001"
    category: "Server-Side Request Forgery"
    classification: "KNOWN_TEST_FIXTURE"
    cwe: "CWE-918"
    name: "Server-Side Request Forgery via Webhook Dispatch"
    endpoint: "/api/v1/webhooks/test"
    method: "POST"
    parameter: "target_url"
    vulnerable_behavior: "Server fetches internal loopback or cloud metadata IPs."
    fixed_behavior: "Pre-socket IP filter rejects private, loopback, and link-local subnets."
    detection_criteria: "HTTP 200 returning internal service or metadata payload."
    severity: "CRITICAL"

  - id: "CAND-001"
    category: "State Machine / Temporal Authorization"
    classification: "NOVEL_CANDIDATE"
    cwe: "CWE-863 / CWE-362"
    name: "Asynchronous Multi-Tenant Event Desynchronization in Stateful Workflows"
    endpoint: "/api/v1/workflow/commit"
    method: "POST"
    parameter: "workflow_id"
    vulnerable_behavior: "Asynchronous rollback dissociates tenant lock, allowing cross-tenant hijack commit."
    fixed_behavior: "Immutable tenant context pinning enforced across all state transitions."
    detection_criteria: "Tenant B commits and executes workflow initiated by Tenant A."
    severity: "CRITICAL"
```

---

## 6. Hardening Baseline Verification & False Positive Control Strategy

### 6.1 Tri-Condition Verification Matrix

Every security test fixture in the laboratory must execute across three strictly defined conditions to eliminate false positives and false negatives:

```
+-------------------------------------------------------------------------------+
|                      TRI-CONDITION VERIFICATION MATRIX                        |
+--------------------------+----------------------------+-----------------------+
|  Condition 1: POSITIVE   |   Condition 2: NEGATIVE    |  Condition 3: BENIGN  |
|  (Vulnerable Target)     |   (Fixed / Remediated)     |  (Normal Baseline)    |
+--------------------------+----------------------------+-----------------------+
| Expectation:             | Expectation:               | Expectation:          |
| Anomaly Triggered &      | Anomaly Safely Blocked     | Normal Operations     |
| Exploit Confirmed        | (HTTP 400/403/404)         | Function Smoothly     |
|                          |                            | (HTTP 200 Normal)     |
| Goal: Prove True Positive| Goal: Prove 0% False Pos   | Goal: Prove 0% Noise  |
+--------------------------+----------------------------+-----------------------+
```

### 6.2 Quantitative Acceptance Thresholds
* **True Positive Rate (Vulnerable Targets):** `100.0%` (All 8 seeded fixtures must be reliably detected).
* **False Positive Rate (Fixed Targets):** `0.0%` (Zero security alerts generated when scanning remediated endpoints).
* **False Positive Rate (Benign Baseline):** `0.0%` (Zero alerts generated during valid user traffic and high-load normal operations).

---

## 7. Implementation Blueprint for Milestones M1 and M2

### 7.1 M1: Research Landscape & Hardened Target Baseline
1. **Deliverable 1:** `research_lab/RESEARCH_LANDSCAPE.md` (authoritative survey matching Section 2).
2. **Deliverable 2:** `research_lab/lab/target/` (complete FastAPI / SQLite multi-tenant application with full RBAC, stateful workflows, and defense-in-depth controls).
3. **Deliverable 3:** `research_lab/HARDENED_TARGET_SECURITY_BASELINE.md` (audit report certifying 0 vulnerabilities and 0 false positives).

### 7.2 M2: Ground-Truth Lab & Negative Controls
1. **Deliverable 1:** `research_lab/lab/ground_truth/` (deliberately vulnerable fixtures for SQLi, XSS, BOLA, BFLA, TOCTOU, JWT bypass, SSRF, and CAND-001).
2. **Deliverable 2:** `research_lab/lab/fixed_controls/` (remediated counterparts for each fixture).
3. **Deliverable 3:** `research_lab/lab/VULNERABILITY_REGISTRY.yaml` (canonical ground-truth registry).
4. **Deliverable 4:** `research_lab/tests/test_ground_truth_verification.py` (automated tri-condition verification harness proving 100% detection on vulnerable targets and 0% false positives on fixed/benign targets).

---

## 8. Conclusion & Sign-Off

This survey provides complete architectural specifications, comparative technology evaluations, domain models, vulnerability fixture mechanics, and verification criteria for Requirements R1, R2, and R3. Downstream engineering agents (Workers, Reviewers, Challengers, and Auditors) have an unambiguous, mathematically sound, and actionable blueprint to proceed with implementation.

# AUTONOMOUS SECURITY AGENT ARCHITECTURES, REASONING PATTERNS & GUARDRAIL SPECIFICATION
**SENTINEL V6 Master Program — Autonomous Security Agent Architecture Research**
**Document ID**: `SENTINEL-AGENTIC-V6-2026-004`
**Classification**: Authoritative Technical Research Dossier
**Target Platform**: SENTINEL V6 Phase 19 (Controlled Agentic Testing)
**Author**: Explorer 2 (Competitive Intelligence Researcher)
**Date**: August 2026

---

## 1. Executive Summary: Autonomous Agents in Offensive & Defensive Security

Between 2024 and 2026, the application of Large Language Models (LLMs) and multi-agent systems to security testing evolved from basic chatbot interfaces (e.g. asking a model to explain a payload) to fully autonomous agentic harnesses (ProjectDiscovery Neo, XBOW, Deepstrike, PentestGPT) capable of multi-step attack planning, tool execution, dynamic hypothesis generation, and automated exploit chaining.

However, naive agent deployments in enterprise security face fatal operational liabilities:
1. **Hallucination of Exploitability**: LLMs frequently invent non-existent parameters, false reflections, and imaginary vulnerabilities based on ambiguous HTTP responses.
2. **Catastrophic Out-of-Scope Breaches**: Autonomous agents following redirect chains or third-party links inadvertently probe unauthorized third-party infrastructure (CDNs, payment gateways, IdPs), violating legal and compliance boundaries.
3. **Data Destruction & Denial of Service**: Unconstrained agents executing `DELETE` endpoints, dropping database tables, or exhausting server connections during brute-force loops.
4. **Context Window Exhaustion & High Token Overhead**: Ingesting raw HTTP request/response payloads rapidly saturates LLM context windows, leading to context truncation and lost state.

SENTINEL V6 addresses these challenges through a **Deterministic, Host-Gated Multi-Agent Architecture** (Phase 19), combining hierarchical multi-subagent planning with strict host-side policy gates (SEC-01 through SEC-03), in-memory graph memory, and mandatory cryptographic CAS verification.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    SENTINEL V6 HOST-GATED AGENTIC TESTING ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                  HUMAN PENTESTER / UI                                            │
│                                           │ (Approval & Intent)                                  │
│                                           ▼                                                      │
│                        ┌─────────────────────────────────────┐                                   │
│                        │     HIERARCHICAL PLANNER AGENT      │                                   │
│                        │   (Plan-and-Solve & Attack Graph)   │                                   │
│                        └──────────────────┬──────────────────┘                                   │
│                                           │ (Delegation)                                         │
│         ┌──────────────────┬──────────────┴───────────────┬──────────────────┐                   │
│         ▼                  ▼                              ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐                ┌─────────────┐    ┌─────────────┐            │
│  │ Recon Agent │    │ Auth Agent  │                │ Logic Agent │    │ Fuzz Agent  │            │
│  └──────┬──────┘    └──────┬──────┘                └──────┬──────┘    └──────┬──────┘            │
│         │                  │                              │                  │                   │
│         └──────────────────┼──────────────────────────────┼──────────────────┘                   │
│                            │ (Proposed Tool Invocations)                                         │
│                            ▼                                                                     │
│  ══════════════════════════════════════════════════════════════════════════════════════════════  │
│  HOST-SIDE DETERMINISTIC POLICY & SAFETY GATE (RUST NATIVE ENGINE)                               │
│  ──────────────────────────────────────────────────────────────────────────────────────────────  │
│  [1] SEC-01 Fail-Closed Scope Gate   -> Drops out-of-scope socket connections before execution  │
│  [2] SEC-02/03 Destructive Gate      -> Intercepts DELETE/Write actions; Prompts Human Pentester │
│  [3] SEC-09 Identity Vault Gate      -> Masks/Redacts secrets; Zeroes memory; Prevents Leakage   │
│  [4] Rate & Budget Limiter           -> Enforces Max Req/Sec, Max Concurrent Conns, Token Limits│
│  ══════════════════════════════════════════════════════════════════════════════════════════════  │
│                            │ (Approved Tool Calls)                                               │
│                            ▼                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ NATIVE CRATE EXECUTION: sentinel_proxy | sentinel_browser | sentinel_fuzzer | sentinel_oast│   │
│  └─────────────────────────────────┬─────────────────────────────────────────────────────────┘   │
│                                    │ (Deterministic Raw Telemetry)                               │
│                                    ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ DETERMINISTIC EVIDENCE VERIFICATION GATE (SEC-06/07: CAS SHA-256 / 3-Sigma / OAST Proof)  │   │
│  └─────────────────────────────────┬─────────────────────────────────────────────────────────┘   │
│                                    │ (Verified Facts Only)                                       │
│                                    ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ IN-MEMORY SECURITY CONTEXT GRAPH & FINDINGS STORAGE (sentinel_context / sentinel_storage) │   │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Agent Orchestration & Reasoning Methodologies

### 2.1 Hierarchical Planner vs Peer Swarms
- **Peer Swarm Limitations**: Flat agent swarms where subagents freely communicate with one another suffer from message storms, circular task loops, and rapid context fragmentation.
- **Hierarchical Master-Worker Architecture**:
  Sentinel V6 implements a strict **Hierarchical Orchestrator** pattern:
  - **Planner Agent (Master)**: Decomposes high-level security objectives into structured execution plans, maintains global attack tree state, assigns subtasks to specialist agents, and evaluates overall phase completion.
  - **Specialist Subagents (Workers)**: Dedicated domain experts executing bounded, single-focus tasks (e.g. Auth matrix permutation, DOM taint tracing). Workers return structured JSON results directly to the Planner; they never execute arbitrary out-of-bounds tasks.

### 2.2 Reasoning Frameworks: ReAct, Plan-and-Solve & Tree-of-Thoughts
1. **Plan-and-Solve Decomposition**:
   - Step 1: Ingest target surface graph and scope rules.
   - Step 2: Formulate prioritized hypothesis list ordered by risk and exploitability.
   - Step 3: Dispatch domain-specific subagents to test top-ranked hypotheses.
   - Step 4: Synthesize verified findings and dynamically prune unviable branches.
2. **ReAct Execution Loops**:
   - Each specialist agent executes bounded iterative loops:
     $$\text{Thought} \to \text{Action (Tool Call)} \to \text{Observation} \to \text{Reflection}$$
   - Loop bounds: Maximum 5 iterations per hypothesis before mandatory yield/escalation.
3. **Tree-of-Thoughts (ToT) / Graph-of-Thoughts (GoT) for Exploit Chaining**:
   - Complex vulnerabilities require multi-step chains (e.g., Unauthenticated Information Leak $\to$ Internal Endpoint Discovery $\to$ CSRF on Admin Profile $\to$ Blind SSRF $\to$ Cloud Metadata $\to$ IAM Role Extraction).
   - The Planner maintains an explicit **Attack Tree Graph** in memory. If a node fails (e.g. CSRF token validated), the planner backtracks to alternative branches (e.g. testing CORS misconfiguration or postMessage sinks) without restarting discovery.

---

## 3. Taxonomy of 7 Specialist Subagents

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             SPECIALIST SUBAGENT TAXONOMY                                         │
├─────────────────────┬────────────────────────────────────────────────────────────────────────────┤
│ Specialist Role     │ Core Competencies & Tool Interfaces                                        │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 1. Recon Specialist │ Passive OSINT, subdomain resolution, tech stack fingerprinting, CDN        │
│                     │ detection, port scanning via `sentinel_scope` and `sentinel_external`.     │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 2. Traffic Specialist│ HTTP/1.1, HTTP/2, WebSocket stream parsing, raw byte frame manipulation,  │
│                     │ HTTP request smuggling, hop-by-hop header desynchronization.               │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 3. Auth Specialist  │ Multi-role identity handling, JWT manipulation, OAuth2/OIDC flows, BOLA/   │
│                     │ IDOR authorization matrix generation via `sentinel_authz`.                 │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 4. Logic Specialist │ State-machine workflow mapping, multi-step order checkout traversal, limit │
│                     │ overrun race conditions via synchronized single-packet engines.            │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 5. Fuzzing Expert   │ Grammar-based mutation, boundary value analysis, parameter discovery,      │
│                     │ SSTI/SQLi/XSS payload generation via `sentinel_fuzzer`.                    │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 6. Verifier Agent   │ Multi-probe corroboration, CAS SHA-256 hash validation, stateless OAST    │
│                     │ callback correlation, Playwright cryptographic screenshot captures.        │
├─────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 7. Synthesis Agent  │ Vulnerability deduplication, CVSS v3.1/v4.0 scoring, CWE taxonomy mapping,│
│                     │ actionable code remediation generation, and SARIF/PDF/MD report export.   │
└─────────────────────┴────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tool Execution, Isolation & Host-Side Policy Enforcement

### 4.1 Typed Tool Calling Schemas
All agent interactions with the underlying engine operate over strictly typed Protobuf/JSON-RPC interfaces. No agent can execute arbitrary shell commands or raw operating system syscalls.

```json
{
  "tool_name": "sentinel_send_request",
  "parameters": {
    "target_url": "https://api.target.internal/v1/users/1042/profile",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer {{IDENTITY_VAULT_TOKEN_ROLE_B}}",
      "X-Requested-With": "XMLHttpRequest"
    },
    "timeout_ms": 5000,
    "follow_redirects": false
  }
}
```

### 4.2 Host-Side Security Invariant Enforcement
Before any tool call is dispatched to the network stack, it passes through the Rust native **Host-Side Policy Gate**:

1. **SEC-01 (Fail-Closed Scope Gate)**:
   - Evaluates `target_url` against active project scope rules.
   - If `target_url` resolves to an out-of-scope domain, IP, or CIDR, the request is immediately dropped with `ScopeDenyError`.
2. **SEC-02 / SEC-03 (Destructive Action Safety Gate)**:
   - Methods like `DELETE`, `PUT`, `DROP`, or requests mutating production configuration trigger an interactive prompt in the Sentinel Desktop UI.
   - The action is paused until the human pentester explicitly reviews and approves the request.
3. **SEC-09 (Identity Vault & Secret Protection)**:
   - Agents reference tokens using abstract handles (`{{IDENTITY_VAULT_TOKEN_ROLE_B}}`). Raw secrets are never exposed inside LLM context prompts or logs.

---

## 5. Memory Architecture & Token Budget Optimization

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENTIC MEMORY ARCHITECTURE                                         │
├───────────────────────────────┬──────────────────────────────────────────────────────────────────┤
│ Memory Layer                  │ Implementation & Data Representation                             │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ Working Context Memory        │ Ephemeral sliding window of recent ReAct observations (max 8k    │
│ (Short-Term)                  │ tokens). Truncated using structured JSON summaries.              │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ In-Memory Security Graph      │ Typed SQLite CTE graph (`sentinel_context`):                     │
│ (Long-Term Relational)        │ Assets $\to$ Endpoints $\to$ Parameters $\to$ Identities.        │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ Content-Addressable Storage   │ Cryptographic SHA-256 CAS store (`sentinel_storage`): Raw HTTP   │
│ (Evidence Vault)              │ request/response payloads stored on disk; referenced by hash.    │
├───────────────────────────────┼──────────────────────────────────────────────────────────────────┤
│ Attack Tree State Graph       │ Hierarchical tree tracking explored, active, and pruned          │
│ (Hypothesis Ledger)           │ vulnerability hypothesis branches.                               │
└───────────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

### 5.1 Context Window Truncation Defenses
1. **CAS Reference Pointers**: Instead of embedding a 500 KB HTTP response body into the agent's prompt, the engine passes a structured digest:
   ```json
   {
     "status": 200,
     "content_type": "application/json",
     "body_length": 482910,
     "body_cas_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "json_schema_summary": {"type": "object", "keys": ["id", "username", "role", "orders"]},
     "extracted_canary_reflection": "probe_canary_value"
   }
   ```
2. **Schema-Level Summarization**: Reduces LLM context token consumption by over 92% while preserving all critical structural information.

---

## 6. Verification Loops, Evidence Integrity & Anti-Hallucination

To guarantee zero false positives, Sentinel V6 implements a **Mandatory Triangulation Verification Protocol**:

```
                              Candidate Alert Raised
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │    VERIFICATION AGENT DISPATCH    │
                      └─────────────────┬─────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
 ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
 │ Direct Replay │              │ Baseline Diff │              │ OAST Receipt  │
 │ (3 Probes)    │              │ (3-Sigma Cal) │              │ (AES-256 GCM) │
 └───────┬───────┘              └───────┬───────┘              └───────┬───────┘
         │                              │                              │
         └──────────────────────────────┼──────────────────────────────┘
                                        │ (All Validated?)
                                        ▼
                          [ Deterministic CAS Proof? ]
                                 /             \
                           YES  /               \  NO
                               ▼                 ▼
                      Confirmed Finding     Discard Candidate
                      (Promoted to UI)      (Log Debug Trace)
```

1. **Deterministic CAS Evidence Requirement (SEC-06/07)**: Every finding must link to immutable SHA-256 CAS records for both the baseline probe and the exploit probe.
2. **Statistical Timing Differential**: Blind timing vulnerabilities (SQLi, Command Injection) require verification across 5 consecutive probes, proving a statistically significant delay ($>3\sigma$ above network jitter baseline).
3. **Stateless OAST Token Verification**: SSRF/RCE findings require receipt of a decrypted AES-256 OAST callback matching the exact scan ID and target.

---

## 7. Failure Recovery, Adaptive Resilience & Circuit Breakers

1. **Adaptive Rate-Limiting & Exponential Backoff**:
   - If target emits HTTP 429 (Too Many Requests) or Cloudflare 1020 blocks, the engine pauses traffic, calculates backoff jitter ($t = \text{base} \times 2^{\text{attempt}} + \text{rand}(0, 500\text{ms})$), and throttles concurrency.
2. **Dynamic Session Re-Authentication**:
   - If the Auth Specialist detects an HTTP 401/403 session expiration mid-scan, it pauses active workers, re-executes the authentication sequence, updates the Identity Vault, and resumes tests seamlessly.
3. **Circuit Breakers for Fragile Targets**:
   - If target emits >5% HTTP 500 Internal Server Errors or connection timeouts within 60 seconds, active fuzzing on that specific endpoint is automatically suspended to prevent server outage.

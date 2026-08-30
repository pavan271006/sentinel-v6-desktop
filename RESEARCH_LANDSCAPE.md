# Zero-Day Discovery Research Gate: State of the Art Landscape

**Date:** 2026-08-21  
**Scope:** Standalone Security Research Methodology & Technology Survey  
**Target Environment:** Isolated Controlled Research Lab  

---

## 1. Automated DAST & Testing Engines

| System | Primary Source / Project | Methodology | Key Strength | Decisive Limitations | Licensing |
|---|---|---|---|---|---|
| **ProjectDiscovery Nuclei** | github.com/projectdiscovery/nuclei (v3.3+) | YAML DSL template matching across HTTP, TCP, DNS, SSL, Websocket, Code, Headless browser | High throughput, deterministic signature matching, large community corpus | Cannot infer stateful multi-step business logic anomalies without hardcoded step scripts | MIT |
| **ProjectDiscovery Neo** | ProjectDiscovery Engine (2024-2025) | AI-assisted asset graph reasoning and contextual target analysis | Context-aware asset correlation and attack path surfacing | Dependent on underlying rule heuristics; prone to false positives on custom auth state flows | Commercial / Proprietary |
| **PortSwigger Burp Scanner** | PortSwigger Web Security Research | Insertion-point mutation, dynamic OAST (Burp Collaborator), heuristics-based differential response modeling | Gold standard for known web bug classes (XSS, SQLi, SSRF, Deserialization, Request Smuggling) | Heavy, heuristic-driven; struggles with deep temporal state-machine constraints and multi-identity authorization workflows | Commercial |
| **OWASP ZAP** | owasp.org / zaproxy (v2.15+) | Rule-based active/passive proxy scanner, add-on ecosystem (Alpha/Beta rules) | Fully scriptable (Zest scripts, Jython), open ecosystem | High rate of false positives on non-standard REST/GraphQL semantics; limited state inference | Apache 2.0 |
| **Caido** | caido.io (v0.40+) | Rust-based lightweight intercepted proxy, GraphQL-backed event bus, match-and-replace pipeline | Minimal resource footprint, deterministic raw bytes handling | Manual-first analysis; automated scanning requires custom plugin development | Proprietary / Freemium |

---

## 2. Advanced Security Research Methodologies

### 2.1 Differential Fuzzing & Parser Disagreements
- **Concept:** Exposing two or more parsers, decoders, or upstream/downstream components (e.g., reverse proxy vs. application backend, JSON parsers, URL normalizers) to identical inputs to detect semantic disagreement.
- **Key Milestones:**
  - HTTP Request Smuggling (PortSwigger / albinowax, 2019–2024): CL.TE, TE.CL, H2.TE, HTTP/2 downgrading, chunked header desync.
  - Parser Differentials in OAuth/JWT (e.g., python-jose vs PyJWT duplicate key parsing).
  - JSON Interoperability Vulnerabilities (RFC 8259 vs RFC 7159 key precedence, integer overflow, Unicode normalization).
- **Novelty Criterion:** A parser difference is ONLY a vulnerability if it violates a security boundary (e.g., bypasses authorization, enables cache poisoning, or causes request routing confusion).

### 2.2 Authorization & State-Machine Inference
- **Concept:** Automatically reconstructing the application state transition graph (FSM) and role-permission matrix across multiple authentications/identities (Tenant A Admin, Tenant A User, Tenant B User, Unauthenticated).
- **Techniques:**
  - Differential Request Replay: Record interaction under Identity 1, replay under Identity 2 with session token substitution.
  - Attribute Graph Inference: Detecting object identifier bindings (e.g., `user_id`, `org_id`, `file_id`) in URL paths, query parameters, and JSON payloads.
  - Temporal Ordering Anomaly Detection: Triggering state transitions out of sequence (e.g., executing step 3 before step 1).
- **Novelty Criterion:** BOLA/IDOR or BFLA on standard endpoints is a known bug pattern (CWE-639 / CWE-862). To be NOVEL, the root cause must stem from an uncharacterized abstraction failure (e.g., asynchronous event bus race condition in multi-tenant isolation or uncharacterized micro-state corruption).

### 2.3 AI-Assisted Security Research & Autonomous Agents
- **Concept:** LLM agents orchestrating toolchains (browsers, proxies, replays) to formulate and test vulnerability hypotheses.
- **State-of-the-Art:**
  - AutoAttacker / PentestGPT / SWE-Agent adaptations: LLMs generate test vectors based on page structure and API schemas.
  - Core Failure Mode: Hallucinating vulnerabilities by mistaking 200 OK responses, generic error messages, or documentation deviations for security breaches without proving root-cause exploitability.
- **Mandatory Guardrail:** Independent dual-agent verification (Researcher proposes hypothesis → Verifier independently executes and verifies ground truth).

---

## 3. Vulnerability Intelligence & Advisory Databases

To verify novelty and rule out prior art, all candidate hypotheses must be cross-referenced against primary vulnerability intelligence sources:

1. **NVD (National Vulnerability Database / NIST):** Formal CVE definitions, CVSS 3.1/4.0 metrics, CWE classification.
2. **CISA KEV (Known Exploited Vulnerabilities):** Authoritative catalog of actively exploited real-world flaws.
3. **GitHub Security Advisories (GHSA) & OSV.dev:** Upstream package registry disclosures (npm, PyPI, crates.io, Go, Maven), pull request commits, fix patches.
4. **Vendor & Framework Advisories:** Django, Spring, Rails, Express, Next.js, FastAPI, Rust Tokio security bulletins.
5. **Academic & Industry Conference Publications:** USENIX Security, IEEE S&P (Oakland), ACM CCS, Black Hat, DEF CON, OffensiveCon, PortSwigger Top 10 Web Hacking Techniques.

---

## 4. Synthesis & Research Protocol Implications

1. **Deterministic Baselines:** Every experimental finding must be tested against established baseline scanners (rule-based pattern matching, standard diffing) to prove baseline failure.
2. **Negative Controls:** Every test must run against:
   - Vulnerable Target (Positive condition: trigger anomaly)
   - Fixed Target (Negative condition: safe behavior observed)
   - Benign Target / No-Op (Baseline stability: confirm absence of noise)
3. **Strict Root-Cause Requirement:** A finding is classified as NOVEL only if the fundamental security invariant violation and root cause have not been previously cataloged.

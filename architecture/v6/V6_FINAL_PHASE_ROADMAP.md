# SENTINEL V6 — FINAL PHASE ROADMAP

> **DATE**: 2026-08-17 (Remediation Cycle 2)  
> **SCOPE**: V1 Definition and End-to-End Acceptance

---

## 1. Definition of V6 PRACTICAL V1

**V6 PRACTICAL V1** must deliver a complete, useful pentesting loop. Anything outside this critical loop is explicitly excluded from V1.

### INCLUDED IN V1 (The Critical Loop)
1. **Project & Scope**: Create project, define scope regex (ScopeEngine)
2. **Proxy & Traffic**: Intercept traffic, preserve raw bytes, search via HTTPQL (ProxyEngine, HTTPParser, ObservationStore)
3. **Passive Discovery**: Extract endpoints, parameters, tech stack (ContextEngine)
4. **Authentication**: Manage identity tokens, inject into requests (IdentityManager)
5. **Repeater**: Manual modify-and-reissue of requests
6. **Active Fuzzing**: Wordlist and basic mutation fuzzing (FuzzerEngine)
7. **Automated Verification**: Response diffing, OAST correlation, timing (VerificationEngine)
8. **OAST**: DNS/HTTP callback capture (OASTServer)
9. **Findings & Evidence**: Content-addressed evidence, finding generation
10. **Reporting**: Export findings to Markdown/PDF (ReportEngine)

### EXCLUDED FROM V1 (Post-V1 or Professional/Enterprise Tiers)
1. **Browser Integration**: Out-of-process DOM analysis (Phase 4)
2. **AI Engines**: Policy, Prompt, LLM integration (Phase 5)
3. **Plugin Runtime**: WASM execution (Phase 5)
4. **CloudFoxAdapter**: AWS/GCP mapping (Phase 6)
5. **SemgrepAdapter**: Source code analysis (Phase 6)
6. **Business Logic Engine**: Workflow tracking (Phase 4)
7. **Research Engines**: SMT, RL, Crypto (Future)
8. **Enterprise**: NATS, ClickHouse, SSO (Enterprise)

---

## 2. V1 ACCEPTANCE TEST (End-to-End Pentest)

The V1 architecture is only considered successful when it can autonomously and manually complete this exact engagement against an intentionally vulnerable application (e.g., OWASP Juice Shop).

### 2.1 Test Environment
- Target: Local Docker container running OWASP Juice Shop or DVWA.
- OS: Clean Windows/macOS/Linux VM.
- Network: Localhost only. No internet access (except for OAST, if external).

### 2.2 Execution Steps & Criteria

| Step | Action | Expected Result | Pass/Fail Criteria |
|------|--------|-----------------|-------------------|
| **1. Project** | Create project "TestApp" | SQLite DB created, directories initialized | DB exists, `.sentinel` dir structured correctly |
| **2. Scope** | Set scope to `.*localhost:3000.*` | ScopeEngine configured | Requests to `example.com` are blocked/ignored |
| **3. Traffic** | Proxy browser through SENTINEL, browse app | Observations recorded in store | HTTPQL `req.method == "GET"` returns records |
| **4. Discovery** | View endpoint list | ContextEngine extracts routes | `/api/users`, `/login` listed in UI |
| **5. Auth** | Login as user, capture token | IdentityManager stores token | Token auto-injected on Repeater requests |
| **6. Repeater** | Send `/api/users/1` to Repeater, change to `2` | Manual request sent, response received | UI shows side-by-side diff of original vs modified |
| **7. Scanner** | Launch scan on `/api/products` | ScanOrchestrator creates tasks | Tasks visible in Task UI |
| **8. Fuzzing** | Fuzzer injects SQLi payloads | FuzzerEngine generates 1k+ requests | Traffic history shows mutation payloads |
| **9. Verify** | VerificationEngine checks SQLi responses | Candidate promoted to Finding | Finding created for SQLi (Error-based or Timing) |
| **10. OAST** | Fuzzer injects OAST token into SSRF param | OastServer receives callback | Finding created for SSRF, linked to OAST evidence |
| **11. Evidence** | View Finding | UI displays request/response proof | Raw bytes match exactly, no normalization loss |
| **12. Report** | Generate PDF report | ReportEngine outputs file | PDF contains SQLi and SSRF with reproduction steps |

**Total Pass Criteria**: 100% of steps complete successfully without a single panic, crash, or memory leak.

---

## 3. Phased Roadmap (20-30 Months)

### Phase 1: Foundation (Months 1-5)
- **Goal**: Reliable proxy, storage, and eventing.
- **Deliverables**: ProxyEngine, HTTPParser, ObservationStore, ScopeEngine, EventBus, TaskScheduler.
- **Validation**: Proxy 1 million real-world requests without dropping bytes or crashing.

### Phase 2: Scanner (Months 4-8)
- **Goal**: Basic automated testing.
- **Deliverables**: ScanOrchestrator, FuzzerEngine, ContextEngine, CoverageEngine, VerificationEngine (V1 strategies).
- **Validation**: Find standard OWASP Top 10 vulnerabilities in vulnerable apps.

### Phase 3: Intelligence (Months 6-10)
- **Goal**: Identity management and graph mapping.
- **Deliverables**: IdentityManager, KnowledgeEngine, AuthorizationEngine.
- **Validation**: Automatically identify IDORs and horizontal privilege escalation.

### Phase 4: Professional (Months 8-14)
- **Goal**: Advanced testing capabilities.
- **Deliverables**: BrowserService, OASTServer, BusinessLogicEngine (Workflow Recorder), NextBestTestEngine.
- **Validation**: Capture DOM XSS and out-of-band SSRF.

### Phase 5: AI & Plugins (Months 10-14)
- **Goal**: Extensibility and acceleration.
- **Deliverables**: AIEngine, AIPolicyEngine, PluginRuntime, ResearchPackManager.
- **Validation**: Execute custom WASM protocol parser, AI suggests valid GraphQL mutation.

### Phase 6: Adapters & Reporting (Months 12-16)
- **Goal**: External tool integration and final polish.
- **Deliverables**: SubfinderAdapter, CloudFoxAdapter, SemgrepAdapter, OpenApiParser, ReportEngine.
- **Validation**: Generate complete engagement report combining passive and active findings.

*(Note: Months overlap due to parallel streams as defined in Dependency Graph)*

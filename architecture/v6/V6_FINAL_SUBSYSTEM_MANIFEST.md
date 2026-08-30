# SENTINEL V6 — FINAL SUBSYSTEM MANIFEST

> **DATE**: 2026-08-17 (Repair Cycle)
> **STATUS**: AUTHORITATIVE
> **TOTAL**: 28

| ID | Name | Tier | Purpose | Owner | Dependencies | Interfaces | Events | Data Types | Security Boundary | Status |
|----|------|------|---------|-------|--------------|------------|--------|------------|-------------------|--------|
| SUB-01 | `ProxyEngine` | Core | Intercept/modify traffic | NetTeam | HTTPParser, ScopeEngine | `ProxyEngine` | `ObservationCreated` | `Transaction` | Untrusted network input | READY |
| SUB-02 | `HTTPParser` | Core | Fault-tolerant parsing | SecTeam | None | `HttpParser` | None | `ParsedRequest` | Parser differential | READY |
| SUB-03 | `ObservationStore` | Core | Persistence (SQLite/Tantivy) | DbTeam | None | `ObservationStore` | `ObservationStored` | `Observation` | Encrypted secrets at rest | READY |
| SUB-04 | `ScopeEngine` | Core | Network authorization | SecTeam | None | `ScopeEngine` | `ScopeUpdated` | `Scope` | Fails closed on network | READY |
| SUB-05 | `EventBus` | Core | Pub/sub routing | CoreTeam | None | `EventBus` | N/A | `SentinelEvent` | None | READY |
| SUB-06 | `TaskScheduler` | Core | Background task limits | CoreTeam | EventBus | `TaskScheduler` | None | `TaskConfig` | Memory bounds | READY |
| SUB-07 | `ScanOrchestrator` | Core | Active scan state machine | SecTeam | TaskSched, Fuzzer | `ScanOrchestrator` | `ScanProgress` | `ScanConfig` | None | READY |
| SUB-08 | `FuzzerEngine` | Core | Payload mutation | SecTeam | None | `FuzzerEngine` | None | `Payload` | Safe payloads by default | READY |
| SUB-09 | `VerificationEngine` | Core | Vulnerability proofs | SecTeam | ObservationStore | `VerificationEngine` | `CandidateVerified` | `VerificationResult`| Exploit safety limits | READY |
| SUB-10 | `ContextEngine` | Core | Tech fingerprinting | SecTeam | None | `ContextEngine` | `ContextDetected` | `TechFingerprint` | ReDoS limits | READY |
| SUB-11 | `CoverageEngine` | Core | Attack surface mapping | SecTeam | ObservationStore | `CoverageEngine` | `CoverageUpdate` | `CoverageReport` | None | READY |
| SUB-12 | `IdentityManager` | Core | Credential injection | CoreTeam | None | `IdentityManager` | None | `Identity` | OS Keychain | READY |
| SUB-13 | `KnowledgeEngine` | Core | Graph database | DbTeam | ObservationStore | `KnowledgeEngine` | None | `GraphNode` | Recursion limits | READY |
| SUB-14 | `ReportEngine` | Core | Finding export | CoreTeam | ObservationStore | `ReportEngine` | None | `ReportConfig` | Sandbox file generation | READY |
| SUB-15 | `BrowserService` | Pro | DOM/JS analysis | UiTeam | None | `BrowserService` | None | `DOMSource` | Playwright IPC Sandbox | READY |
| SUB-16 | `OASTServer` | Pro | Out-of-band correlation | NetTeam | ScopeEngine | `OastServer` | None | `OastEvidence` | AES-256 tokens, DoS | READY |
| SUB-17 | `AuthorizationEngine`| Pro | AuthZ matrix replay | SecTeam | IdentityManager | `AuthorizationEngine`| None | `AuthzMatrix` | None | READY |
| SUB-18 | `AIEngine` | Pro | LLM prompt generation | AiTeam | AIPolicyEngine | `AiEngine` | None | `AiRequest` | None | READY |
| SUB-19 | `AIPolicyEngine` | Pro | AI prompt/response guard | AiTeam | ScopeEngine | `AiPolicyEngine` | None | `PolicyResult` | Destructive command block| READY |
| SUB-20 | `PluginRuntime` | Pro | WASM execution | CoreTeam | ScopeEngine | `PluginRuntime` | None | `Capabilities` | WASI capability drops | READY |
| SUB-21 | `ResearchPackManager`| Pro | Rule distribution | SecTeam | None | `ResearchPackManager`| None | `PackManifest` | Ed25519 signatures | READY |
| SUB-22 | `SubfinderAdapter` | Adapt| Subdomain enum | SecTeam | ScopeEngine | `ExternalToolAdapter`| None | `SubdomainAsset` | External process | READY |
| SUB-23 | `CloudFoxAdapter` | Adapt| Cloud enum | SecTeam | ScopeEngine | `ExternalToolAdapter`| None | `CloudAsset` | Read-only default API | READY |
| SUB-24 | `SemgrepAdapter` | Adapt| SAST | SecTeam | None | `ExternalToolAdapter`| None | `SastFinding` | External process | READY |
| SUB-25 | `OpenApiParser` | Adapt| API route parsing | SecTeam | None | `ExternalToolAdapter`| None | `PRoute` | ReDoS limits | READY |
| SUB-26 | `SmtSolverEngine` | Rsch | Formal methods | RschTeam | VerificationEngine | `SmtSolverEngine` | None | `SymbolicPath` | Feature flagged out | DEFERRED|
| SUB-27 | `RlStateEngine` | Rsch | Deep RL for state | RschTeam | BrowserService | `RlStateEngine` | None | `RlRewardModel` | Feature flagged out | DEFERRED|
| SUB-28 | `CryptoAnalysisEngine`| Rsch | Lattice reduction | RschTeam | ObservationStore | `CryptoAnalysisEngine`| None | `CryptoWeakness` | Feature flagged out | DEFERRED|

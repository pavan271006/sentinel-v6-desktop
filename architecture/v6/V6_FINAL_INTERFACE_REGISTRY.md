# SENTINEL V6 — CANONICAL TRAIT & INTERFACE REGISTRY

> **DATE**: 2026-08-17  
> **STATUS**: AUTHORITATIVE — 100% SYNCHRONIZED  
> **CANONICAL SPEC**: `V6_CANONICAL_SPEC.yaml` § 3  
> **RUST IMPLEMENTATION**: `V6_COMMON_TYPES.rs`

Every subsystem in the manifest maps to its primary canonical trait definition. All 28 traits and complete method signatures are fully synchronized:

| Trait Name | Owner Subsystem | Purpose | Complete Method Signatures | Return / Error Types | Status |
|------------|-----------------|---------|----------------------------|----------------------|--------|
| `ProxyEngine` | SUB-01 | Intercept & modify traffic | `start`, `stop`, `register_interceptor`, `set_intercept_rules` | `Result<(), SentinelError>` | Synced |
| `HttpParser` | SUB-02 | Byte-safe parsing & serialization | `parse_request`, `parse_response`, `serialize_request`, `serialize_response` | `Result<ParsedRequest/Response/Vec<u8>, SentinelError>` | Synced |
| `ObservationStore`| SUB-03 | Dual-write persistence & search | `insert`, `insert_batch`, `get`, `query_sql`, `search_fts`, `rebuild_index` | `Result<T, SentinelError>` | Synced |
| `ScopeEngine` | SUB-04 | Network ACL authorization | `is_in_scope`, `is_ip_in_scope`, `update_scope` | `ScopeDecision`, `Result<(), SentinelError>` | Synced |
| `EventBus` | SUB-05 | Telemetry broadcast & critical delivery | `subscribe_telemetry`, `subscribe_critical`, `publish_telemetry`, `publish_critical` | `Receiver<T>`, `Result<(), SentinelError>` | Synced |
| `TaskScheduler` | SUB-06 | Async task priority & checkpoints | `submit`, `pause`, `resume`, `cancel`, `status`, `checkpoint`, `restore_checkpoint` | `Result<Uuid/TaskLifecycle/Option<Vec<u8>>, SentinelError>` | Synced |
| `ScanOrchestrator`| SUB-07 | Scan lifecycles & coordination | `start_scan`, `pause_scan`, `resume_scan`, `cancel_scan`, `scan_status` | `Result<Uuid/ScanLifecycle, SentinelError>` | Synced |
| `FuzzerEngine` | SUB-08 | Payload mutation stream | `fuzz` | `Result<FuzzStream, SentinelError>` | Synced |
| `VerificationEngine`| SUB-09 | Vulnerability proofs & OAST correlation | `verify_candidate`, `correlate_oast`, `available_strategies` | `Result<VerificationResult/Option<OastEvidence>, SentinelError>`, `Vec<VerificationStrategy>` | Synced |
| `ContextEngine` | SUB-10 | Tech stack fingerprinting | `fingerprint`, `classify_parameter` | `Vec<TechFingerprint>`, `ParameterClass` | Synced |
| `CoverageEngine` | SUB-11 | Attack surface tracking | `record_test`, `get_coverage`, `untested_endpoints` | `Result<CoverageReport/Vec<Endpoint>, SentinelError>` | Synced |
| `IdentityManager` | SUB-12 | Auth states & credential management | `add_identity`, `add_credential`, `list_identities`, `inject_auth`, `refresh_credential` | `Result<Uuid/Vec<Identity>, SentinelError>` | Synced |
| `KnowledgeEngine` | SUB-13 | Knowledge graph topology | `add_node`, `add_edge`, `query_neighbors`, `find_path`, `resolve_entity` | `Result<Uuid/Vec<GraphNode>/Option<GraphNode>, SentinelError>` | Synced |
| `ReportEngine` | SUB-14 | Report generation & export | `generate` | `Result<Vec<u8>, SentinelError>` | Synced |
| `BrowserService` | SUB-15 | Playwright DOM & JS engine | `navigate`, `execute_script`, `capture_dom`, `take_screenshot`, `close` | `Result<NavigationResult/String/Vec<u8>, SentinelError>` | Synced |
| `OastServer` | SUB-16 | Out-of-band token verification | `start`, `stop`, `generate_token`, `poll_interactions` | `Result<String/Vec<OastInteraction>, SentinelError>` | Synced |
| `AuthorizationEngine`| SUB-17 | AuthZ matrix & IDOR verification | `build_matrix`, `test_matrix` | `Result<AuthzMatrix/Vec<AuthzViolation>, SentinelError>` | Synced |
| `AiEngine` | SUB-18 | LLM analysis acceleration | `analyze`, `is_available` | `Result<AiResponse, SentinelError>`, `bool` | Synced |
| `AiPolicyEngine` | SUB-19 | AI prompt & output safety gate | `validate_input`, `validate_output`, `is_destructive`, `requires_approval` | `PolicyResult`, `bool` | Synced |
| `PluginRuntime` | SUB-20 | WASM & Rhai sandbox execution | `load_wasm`, `load_rhai`, `execute`, `unload` | `Result<Uuid/PluginOutput, SentinelError>` | Synced |
| `ResearchPackManager`| SUB-21 | Security check pack management | `load_pack`, `verify_signature`, `list_checks`, `hot_reload` | `Result<PackManifest/bool/Vec<SecurityCheck>, SentinelError>` | Synced |
| `ExternalToolAdapter`| SUB-22..25| External CLI adapters | `tool_name`, `is_installed`, `execute` | `&str`, `bool`, `Result<serde_json::Value, SentinelError>` | Synced |
| `SmtSolverEngine` | SUB-26 | Formal logic flaw verification | `prove_logic_flaw` | `Result<SymbolicPath, SentinelError>` | Synced (Feature flagged) |
| `RlStateEngine` | SUB-27 | Deep RL state exploration | `explore_state_machine` | `Result<Vec<RlRewardModel>, SentinelError>` | Synced (Feature flagged) |
| `CryptoAnalysisEngine`| SUB-28 | Cryptographic analysis | `analyze_handshake` | `Result<Option<CryptoWeakness>, SentinelError>` | Synced (Feature flagged) |

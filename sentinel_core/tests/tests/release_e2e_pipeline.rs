//! Phase 22 End-to-End Enterprise Pentesting Pipeline Integration Test

use std::sync::Arc;
use tempfile::tempdir;
use uuid::Uuid;

use sentinel_adapters::NmapAdapter;
use sentinel_agent::{AgentController, RiskBudgetConfig, RiskBudgetTracker, ToolRegistry};
use sentinel_ai::DefaultAiEngine;
use sentinel_api::OpenApiParser;
use sentinel_auth::{DefaultIdentityManager, SecureVault};
use sentinel_authz::MatrixEvaluator;
use sentinel_browser::DefaultBrowserService;
use sentinel_bus::{ChannelEventBus, EventBusConfig};
use sentinel_common::config::{ReportConfig, ResourceBudget, ScanConfig};
use sentinel_common::domain::core::{Candidate, VerificationStrategyRef};
use sentinel_common::domain::meta::EntityMetadata;
use sentinel_common::domain::supporting::Identity;
use sentinel_common::domain::{Finding, Observation, Scope};
use sentinel_common::enums::{
    AccessLevel, FindingLifecycle, HttpMethod, MutatorType, ObservationSource, ParameterClass,
    Provenance, ReportFormat, Severity, VerificationStrategy,
};
use sentinel_common::operational::{
    AiRequest, AuthzMatrix, CapabilitySet, GraphEdge, GraphNode, PluginSandboxConfig,
    ResourceLimits,
};
use sentinel_common::traits::{
    AiEngine, BrowserService, ContextEngine, ExternalToolAdapter, HttpParser, IdentityManager,
    KnowledgeEngine, ObservationStore, PluginRuntime, ScanOrchestrator, ScopeEngine,
    VerificationEngine,
};
use sentinel_context::DefaultContextEngine;
use sentinel_enterprise::{Permission, RbacManager, SiemExporter, UserRole};
use sentinel_fuzzer::FuzzMutator;
use sentinel_knowledge::DefaultKnowledgeEngine;
use sentinel_logic::StateMachineEngine;
use sentinel_oast::DefaultOastServer;
use sentinel_parser::SentinelHttpParser;
use sentinel_plugin::DefaultPluginRuntime;
use sentinel_productivity::{
    CommandItem, CommandPalette, OmniSearchEngine, SearchHit, SearchResultKind,
};
use sentinel_repeater::RepeaterTab;
use sentinel_report::{FindingsCenter, ReportGenerator};
use sentinel_scanner::DefaultScanOrchestrator;
use sentinel_scope::DefaultScopeEngine;
use sentinel_storage::SqliteObservationStore;
use sentinel_verification::DefaultVerificationEngine;

#[tokio::test]
async fn test_phase22_full_lifecycle_engagement_pipeline() {
    let tmp = tempdir().unwrap();

    // ----------------------------------------------------
    // STEP 1: Foundation Setup (Scope, Storage, Bus)
    // ----------------------------------------------------
    let scope = Scope {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        includes: vec!["https://app.target.corp/*".to_string()],
        excludes: vec!["https://app.target.corp/logout".to_string()],
    };
    let scope_engine = DefaultScopeEngine::new(scope);
    assert!(
        scope_engine
            .is_in_scope("https://app.target.corp/api/v1/users")
            .allowed
    );
    assert!(
        !scope_engine
            .is_in_scope("https://app.target.corp/logout")
            .allowed
    );

    let store = SqliteObservationStore::open(tmp.path()).await.unwrap();
    let bus = ChannelEventBus::new(EventBusConfig::default());
    assert_eq!(bus.metrics().telemetry_capacity, 10_000);

    // ----------------------------------------------------
    // STEP 2: Protocol Parsing & CAS Ingestion
    // ----------------------------------------------------
    let raw_http = b"GET /api/v1/users HTTP/1.1\r\nHost: app.target.corp\r\n\r\n";
    let parser = SentinelHttpParser::new();
    let parsed = parser.parse_request(raw_http).unwrap();
    assert_eq!(parsed.method, HttpMethod::GET);

    let cas_desc = store.cas().put(raw_http).await.unwrap();
    let obs = Observation {
        meta: EntityMetadata::new(Provenance::Proxy),
        source: ObservationSource::Proxy,
        data_ref: cas_desc.blob_id,
    };
    store.insert(obs.clone()).await.unwrap();

    // ----------------------------------------------------
    // STEP 3: Manual Testing & HTTPQL Query
    // ----------------------------------------------------
    let compiled_sql =
        sentinel_httpql::compile_to_sql("req.method == GET && resp.status == 200").unwrap();
    assert!(compiled_sql.where_clause.contains("method = ?"));

    let mut tab = RepeaterTab::new(
        "Users Tab",
        "https://app.target.corp/api/v1/users",
        raw_http.to_vec(),
    );
    tab.record_execution(
        raw_http.to_vec(),
        Some(b"HTTP/1.1 200 OK\r\n\r\n".to_vec()),
        Some(200),
        25,
        None,
    );
    assert_eq!(tab.history.len(), 1);

    // ----------------------------------------------------
    // STEP 4: Attack Surface, Tech Fingerprinting & Graph
    // ----------------------------------------------------
    let ctx = DefaultContextEngine::new();
    assert_eq!(
        ctx.classify_parameter("id", "60c72b2f9b1d8b2bad000001"),
        ParameterClass::ObjectId
    );

    let knowledge = DefaultKnowledgeEngine::new();
    let host_node = GraphNode {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        node_type: "Host".to_string(),
        label: "app.target.corp".to_string(),
        metadata_json: None,
    };
    let ep_node = GraphNode {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        node_type: "Endpoint".to_string(),
        label: "/api/v1/users".to_string(),
        metadata_json: None,
    };
    let n1 = knowledge.add_node(host_node).await.unwrap();
    let n2 = knowledge.add_node(ep_node).await.unwrap();

    let edge = GraphEdge {
        id: Uuid::new_v4(),
        source_id: n1,
        target_id: n2,
        edge_type: "EXPOSES".to_string(),
        timestamp: chrono::Utc::now(),
    };
    assert!(knowledge.add_edge(edge).await.is_ok());

    // ----------------------------------------------------
    // STEP 5: Auth & Redacted Credentials (SEC-09)
    // ----------------------------------------------------
    let vault = Arc::new(SecureVault::new());
    let id_mgr = DefaultIdentityManager::new(vault);
    let identity = Identity {
        id: Uuid::new_v4(),
        version: 1,
        timestamp: chrono::Utc::now(),
        username: "Lead Pentester".to_string(),
        roles: vec!["admin_role".to_string()],
        meta: None,
    };
    let identity_id = id_mgr.add_identity(identity).await.unwrap();

    // ----------------------------------------------------
    // STEP 6: Scanner, Fuzzing & Authorization Testing
    // ----------------------------------------------------
    let scanner = DefaultScanOrchestrator::new();
    let scan_cfg = ScanConfig {
        id: Uuid::new_v4(),
        scope_id: Uuid::new_v4(),
        concurrency_limit: 4,
        active_plugins_json: "[\"passive\"]".to_string(),
        timestamp: chrono::Utc::now(),
        budget: ResourceBudget {
            max_requests: 100,
            max_duration_secs: 60,
        },
    };
    assert!(scanner.start_scan(scan_cfg).await.is_ok());

    let mutations = FuzzMutator::mutate(b"param_val", MutatorType::Boundary);
    assert!(!mutations.is_empty());

    let ep_id = Uuid::new_v4();
    let mut expected = std::collections::HashMap::new();
    expected.insert(ep_id, AccessLevel::Admin);
    let mut actual = std::collections::HashMap::new();
    actual.insert(ep_id, AccessLevel::User);
    let matrix = AuthzMatrix {
        identities: vec![identity_id],
        endpoints: vec![ep_id],
        expected,
        actual,
    };
    let violations = MatrixEvaluator::evaluate_violations(&matrix);
    assert_eq!(violations.len(), 1);

    // ----------------------------------------------------
    // STEP 7: API, Browser, OAST & Logic Testing
    // ----------------------------------------------------
    let spec = r#"{
        "openapi": "3.0.1",
        "paths": {
            "/api/v1/users": {
                "get": {
                    "parameters": [{"name": "page", "in": "query"}]
                }
            }
        }
    }"#;
    let routes = OpenApiParser::parse_spec(spec).unwrap();
    assert_eq!(routes.len(), 1);

    let browser = DefaultBrowserService::new();
    assert!(browser.navigate("https://app.target.corp").await.is_ok());

    let oast = DefaultOastServer::new();
    use sentinel_common::traits::OastServer;
    let oast_token = oast.generate_token().await.unwrap();
    assert!(oast_token.starts_with("oast_"));

    let mut state_machine = StateMachineEngine::new("Draft");
    state_machine.add_allowed_transition("Draft", "Published");
    assert!(state_machine.transition("Published").is_ok());
    assert!(state_machine.transition("Archived").is_err());

    // ----------------------------------------------------
    // STEP 8: Findings Verification, Center & Reporting
    // ----------------------------------------------------
    let verifier = DefaultVerificationEngine::new();
    let candidate = Candidate {
        meta: EntityMetadata::new(Provenance::Scanner),
        source_observation_id: obs.meta.id,
        hypothesis: "BOLA Invariant Violation: vulnerable endpoint /api/v1/users".to_string(),
        status: "Candidate".to_string(),
    };
    let strat = VerificationStrategyRef {
        strategy_type: VerificationStrategy::ContentVerification,
        version: "1.0".to_string(),
    };
    let v_res = verifier.verify_candidate(&candidate, strat).await.unwrap();
    assert!(v_res.success);

    let mut finding = Finding {
        meta: EntityMetadata::new(Provenance::Scanner),
        title: "BOLA Invariant Violation in /api/v1/users".to_string(),
        severity: Severity::Critical,
        verification_id: v_res.id,
        state: FindingLifecycle::Confirmed,
    };

    let fc = FindingsCenter::new();
    fc.insert_finding(finding.clone());
    assert_eq!(fc.filter_by_severity(Severity::Critical).len(), 1);
    finding.state = FindingLifecycle::Remediated;

    let report_cfg = ReportConfig {
        format: ReportFormat::Markdown,
        finding_ids: vec![],
        include_evidence: true,
    };
    let report_md = ReportGenerator::generate(
        "Enterprise Security Engagement",
        &[finding.clone()],
        &report_cfg,
    )
    .unwrap();
    assert!(report_md.contains("Enterprise Security Engagement"));
    assert!(report_md.contains("BOLA Invariant Violation"));

    // ----------------------------------------------------
    // STEP 9: Productivity, Plugins & Adapters
    // ----------------------------------------------------
    let cp = CommandPalette::new();
    cp.register_command(CommandItem {
        id: "export_report".to_string(),
        title: "Export Final Security Report".to_string(),
        shortcut: Some("Ctrl+E".to_string()),
        category: "Reporting".to_string(),
    });
    assert_eq!(cp.search_commands("report").len(), 1);

    let omni = OmniSearchEngine::new();
    omni.index_item(SearchHit {
        id: finding.meta.id,
        kind: SearchResultKind::Finding,
        title: finding.title.clone(),
        snippet: "Critical BOLA finding verified".to_string(),
        score: 100,
    });
    assert_eq!(omni.search("BOLA").len(), 1);

    let plugin_rt = DefaultPluginRuntime::new();
    let p_cfg = PluginSandboxConfig {
        capabilities: CapabilitySet {
            network: false,
            filesystem: false,
            secrets: false,
            database: false,
            browser: false,
        },
        limits: ResourceLimits {
            max_memory_mb: 32,
            max_execution_ms: 100,
            max_network_requests: 0,
        },
    };
    let p_id = plugin_rt
        .load_wasm(b"\0asm\x01\0\0\0", p_cfg)
        .await
        .unwrap();
    assert!(plugin_rt.unload(p_id).await.is_ok());

    let nmap = NmapAdapter;
    assert_eq!(nmap.tool_name(), "nmap");
    let _ = nmap.is_installed();

    // ----------------------------------------------------
    // STEP 10: AI Copilot & Controlled Agent
    // ----------------------------------------------------
    let ai_engine = DefaultAiEngine::new();
    let ai_res = ai_engine
        .analyze(AiRequest {
            prompt: "Analyze risk profile".to_string(),
        })
        .await
        .unwrap();
    assert!(ai_res.content.contains("AI Security Analysis"));

    let agent_reg = Arc::new(ToolRegistry::new());
    let agent_budget = Arc::new(RiskBudgetTracker::new(RiskBudgetConfig::default()));
    let agent_ctrl = AgentController::new(agent_reg, agent_budget);
    let agent_step = agent_ctrl
        .execute_step("http_probe", serde_json::json!({}))
        .unwrap();
    assert_eq!(agent_step.tool_name, "http_probe");

    // ----------------------------------------------------
    // STEP 11: Enterprise RBAC & SIEM Export
    // ----------------------------------------------------
    assert!(RbacManager::has_permission(
        UserRole::Admin,
        Permission::ExportData
    ));
    let cef = SiemExporter::format_cef(
        finding.meta.id,
        &finding.title,
        finding.severity,
        "10.0.0.100",
    );
    assert!(cef.starts_with("CEF:0|SentinelSecurity|SentinelPlatform|6.0.0|FINDING|"));
    assert!(cef.contains("src=10.0.0.100"));
}

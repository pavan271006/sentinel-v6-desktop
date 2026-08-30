// SENTINEL V6: Canonical Subsystem Traits & Public Interfaces
// crates/sentinel_common/src/traits.rs

use async_trait::async_trait;
use uuid::Uuid;

use crate::config::{ProxyConfig, ReportConfig, ScanConfig, TaskConfig};
use crate::domain::{
    Candidate, Credential, Endpoint, Identity, OastInteraction, Observation, Scope, Transaction,
    VerificationResult, VerificationStrategyRef,
};
use crate::enums::{
    ParameterClass, PolicyResult, ScanLifecycle, TaskLifecycle, VerificationStrategy,
};
use crate::errors::SentinelError;
use crate::events::{CriticalEvent, SentinelEvent};
use crate::operational::{
    AiRequest, AiResponse, AuthzMatrix, AuthzViolation, CoverageReport, CryptoWeakness,
    FuzzProfile, FuzzStream, GraphEdge, GraphNode, InterceptRule, NavigationResult, OastEvidence,
    PackManifest, ParsedRequest, ParsedResponse, PluginInput, PluginOutput, PluginSandboxConfig,
    RlRewardModel, ScopeDecision, SecurityCheck, SymbolicPath, TechFingerprint,
};

// ==========================================
// SUB-01 ProxyEngine & Interceptor
// ==========================================
pub trait ProxyInterceptor: Send + Sync {}

#[async_trait]
pub trait ProxyEngine: Send + Sync {
    async fn start(&self, config: ProxyConfig) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    fn register_interceptor(&mut self, interceptor: Box<dyn ProxyInterceptor>);
    fn set_intercept_rules(&mut self, rules: Vec<InterceptRule>) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-02 HTTPParser
// ==========================================
#[async_trait]
pub trait HttpParser: Send + Sync {
    fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError>;
    fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError>;
    fn serialize_request(&self, req: &ParsedRequest) -> Result<Vec<u8>, SentinelError>;
    fn serialize_response(&self, res: &ParsedResponse) -> Result<Vec<u8>, SentinelError>;
}

// ==========================================
// SUB-03 ObservationStore
// ==========================================
#[async_trait]
pub trait ObservationStore: Send + Sync {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError>;
    async fn insert_batch(&self, obs: Vec<Observation>) -> Result<(), SentinelError>;
    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError>;
    async fn query_sql(&self, sql: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn search_fts(&self, query: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn rebuild_index(&self) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-04 ScopeEngine
// ==========================================
#[async_trait]
pub trait ScopeEngine: Send + Sync {
    fn is_in_scope(&self, uri: &str) -> ScopeDecision;
    fn is_ip_in_scope(&self, ip: &str) -> ScopeDecision;
    fn update_scope(&mut self, scope: Scope) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-05 EventBus
// ==========================================
#[async_trait]
pub trait EventBus: Send + Sync {
    fn subscribe_telemetry(&self) -> tokio::sync::broadcast::Receiver<SentinelEvent>;
    fn subscribe_critical(&self) -> tokio::sync::mpsc::Receiver<CriticalEvent>;
    fn publish_telemetry(&self, event: SentinelEvent) -> Result<(), SentinelError>;
    fn publish_critical(&self, event: CriticalEvent) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-06 TaskScheduler
// ==========================================
#[async_trait]
pub trait TaskScheduler: Send + Sync {
    async fn submit(&self, task: TaskConfig) -> Result<Uuid, SentinelError>;
    async fn pause(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn resume(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn status(&self, task_id: Uuid) -> Result<TaskLifecycle, SentinelError>;
    async fn checkpoint(&self, task_id: Uuid, state: Vec<u8>) -> Result<(), SentinelError>;
    async fn restore_checkpoint(&self, task_id: Uuid) -> Result<Option<Vec<u8>>, SentinelError>;
}

// ==========================================
// SUB-07 ScanOrchestrator
// ==========================================
#[async_trait]
pub trait ScanOrchestrator: Send + Sync {
    async fn start_scan(&self, config: ScanConfig) -> Result<Uuid, SentinelError>;
    async fn pause_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn resume_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn scan_status(&self, scan_id: Uuid) -> Result<ScanLifecycle, SentinelError>;
}

// ==========================================
// SUB-08 FuzzerEngine
// ==========================================
#[async_trait]
pub trait FuzzerEngine: Send + Sync {
    async fn fuzz(
        &self,
        seed: &Transaction,
        profile: &FuzzProfile,
    ) -> Result<FuzzStream, SentinelError>;
}

// ==========================================
// SUB-09 VerificationEngine
// ==========================================
#[async_trait]
pub trait VerificationEngine: Send + Sync {
    async fn verify_candidate(
        &self,
        candidate: &Candidate,
        strategy: VerificationStrategyRef,
    ) -> Result<VerificationResult, SentinelError>;
    async fn correlate_oast(&self, token: &str) -> Result<Option<OastEvidence>, SentinelError>;
    fn available_strategies(&self) -> Vec<VerificationStrategy>;
}

// ==========================================
// SUB-10 ContextEngine
// ==========================================
#[async_trait]
pub trait ContextEngine: Send + Sync {
    fn fingerprint(&self, transaction: &Transaction) -> Vec<TechFingerprint>;
    fn classify_parameter(&self, name: &str, value: &str) -> ParameterClass;
}

// ==========================================
// SUB-11 CoverageEngine
// ==========================================
#[async_trait]
pub trait CoverageEngine: Send + Sync {
    async fn record_test(&self, endpoint_id: Uuid) -> Result<(), SentinelError>;
    async fn get_coverage(&self, scope_id: Uuid) -> Result<CoverageReport, SentinelError>;
    async fn untested_endpoints(&self, scope_id: Uuid) -> Result<Vec<Endpoint>, SentinelError>;
}

// ==========================================
// SUB-12 IdentityManager
// ==========================================
#[async_trait]
pub trait IdentityManager: Send + Sync {
    async fn add_identity(&self, identity: Identity) -> Result<Uuid, SentinelError>;
    async fn add_credential(&self, credential: Credential) -> Result<Uuid, SentinelError>;
    async fn list_identities(&self) -> Result<Vec<Identity>, SentinelError>;
    async fn inject_auth(
        &self,
        identity_id: Uuid,
        request: &mut ParsedRequest,
    ) -> Result<(), SentinelError>;
    async fn refresh_credential(&self, credential_id: Uuid) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-13 KnowledgeEngine
// ==========================================
#[async_trait]
pub trait KnowledgeEngine: Send + Sync {
    async fn add_node(&self, node: GraphNode) -> Result<Uuid, SentinelError>;
    async fn add_edge(&self, edge: GraphEdge) -> Result<Uuid, SentinelError>;
    async fn query_neighbors(&self, node_id: Uuid) -> Result<Vec<GraphNode>, SentinelError>;
    async fn find_path(&self, from: Uuid, to: Uuid) -> Result<Vec<Vec<GraphEdge>>, SentinelError>;
    async fn resolve_entity(&self, identifier: &str) -> Result<Option<GraphNode>, SentinelError>;
}

// ==========================================
// SUB-14 ReportEngine
// ==========================================
#[async_trait]
pub trait ReportEngine: Send + Sync {
    async fn generate(&self, config: ReportConfig) -> Result<Vec<u8>, SentinelError>;
}

// ==========================================
// SUB-15 BrowserService
// ==========================================
#[async_trait]
pub trait BrowserService: Send + Sync {
    async fn navigate(&self, url: &str) -> Result<NavigationResult, SentinelError>;
    async fn execute_script(&self, js: &str) -> Result<String, SentinelError>;
    async fn capture_dom(&self) -> Result<String, SentinelError>;
    async fn take_screenshot(&self, full_page: bool) -> Result<Vec<u8>, SentinelError>;
    async fn close(&self) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-16 OastServer
// ==========================================
#[async_trait]
pub trait OastServer: Send + Sync {
    async fn start(&self) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    async fn generate_token(&self) -> Result<String, SentinelError>;
    async fn poll_interactions(&self, token: &str) -> Result<Vec<OastInteraction>, SentinelError>;
}

// ==========================================
// SUB-17 AuthorizationEngine
// ==========================================
#[async_trait]
pub trait AuthorizationEngine: Send + Sync {
    async fn build_matrix(&self, identities: Vec<Uuid>) -> Result<AuthzMatrix, SentinelError>;
    async fn test_matrix(&self, matrix: &AuthzMatrix)
        -> Result<Vec<AuthzViolation>, SentinelError>;
}

// ==========================================
// SUB-18 AiEngine
// ==========================================
#[async_trait]
pub trait AiEngine: Send + Sync {
    async fn analyze(&self, request: AiRequest) -> Result<AiResponse, SentinelError>;
    fn is_available(&self) -> bool;
}

// ==========================================
// SUB-19 AiPolicyEngine
// ==========================================
#[async_trait]
pub trait AiPolicyEngine: Send + Sync {
    fn validate_input(&self, prompt: &str) -> PolicyResult;
    fn validate_output(&self, response: &str) -> PolicyResult;
    fn is_destructive(&self, command: &str) -> bool;
    fn requires_approval(&self, command: &str) -> bool;
}

// ==========================================
// SUB-20 PluginRuntime
// ==========================================
#[async_trait]
pub trait PluginRuntime: Send + Sync {
    async fn load_wasm(
        &self,
        wasm_bytes: &[u8],
        config: PluginSandboxConfig,
    ) -> Result<Uuid, SentinelError>;
    async fn load_rhai(
        &self,
        script: &str,
        config: PluginSandboxConfig,
    ) -> Result<Uuid, SentinelError>;
    async fn execute(
        &self,
        plugin_id: Uuid,
        input: PluginInput,
    ) -> Result<PluginOutput, SentinelError>;
    async fn unload(&self, plugin_id: Uuid) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-21 ResearchPackManager
// ==========================================
#[async_trait]
pub trait ResearchPackManager: Send + Sync {
    async fn load_pack(&self, path: &str) -> Result<PackManifest, SentinelError>;
    async fn verify_signature(&self, pack: &PackManifest) -> Result<bool, SentinelError>;
    async fn list_checks(&self, pack_id: &str) -> Result<Vec<SecurityCheck>, SentinelError>;
    async fn hot_reload(&self, pack_id: &str) -> Result<(), SentinelError>;
}

// ==========================================
// SUB-22..25 ExternalToolAdapter
// ==========================================
#[async_trait]
pub trait ExternalToolAdapter: Send + Sync {
    fn tool_name(&self) -> &str;
    fn is_installed(&self) -> bool;
    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError>;
}

// ==========================================
// SUB-26..28 Research Tier Subsystems
// ==========================================
#[async_trait]
pub trait SmtSolverEngine: Send + Sync {
    async fn prove_logic_flaw(
        &self,
        source_code: &str,
        invariant: &str,
    ) -> Result<SymbolicPath, SentinelError>;
}

#[async_trait]
pub trait RlStateEngine: Send + Sync {
    async fn explore_state_machine(
        &self,
        initial_url: &str,
    ) -> Result<Vec<RlRewardModel>, SentinelError>;
}

#[async_trait]
pub trait CryptoAnalysisEngine: Send + Sync {
    async fn analyze_handshake(
        &self,
        pcap_data: &[u8],
    ) -> Result<Option<CryptoWeakness>, SentinelError>;
}

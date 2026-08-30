// SENTINEL V6: CANONICAL TYPE REGISTRY
// V6_COMMON_TYPES.rs
// 
// This file serves as the definitive type contract.
// All subsystems MUST use these exact types, enums, and structs.

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

// ==========================================
// 1. Core Platform Enums
// ==========================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    TRACE,
    CONNECT,
    GRAPHQL,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ParamLocation {
    Query,
    Body,
    Header,
    Path,
    Cookie,
    JsonPath,
    XPath,
    MultipartField,
    GraphQLVariable,
    WebSocketFrame,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DataType {
    String,
    Integer,
    Boolean,
    Float,
    Uuid,
    Json,
    Xml,
    Base64,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Provenance {
    Manual,
    Scanner,
    Fuzzer,
    Proxy,
    AI,
    Tool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LifecycleState {
    Active,
    Archived,
    Deleted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskLifecycle {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScanLifecycle {
    Initializing,
    Running,
    Pausing,
    Paused,
    Finished,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FindingLifecycle {
    Candidate,
    Verified,
    Confirmed,
    Reported,
    Remediated,
    FalsePositive,
    AcceptedRisk,
    Regression,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ObservationSource {
    Proxy,
    OAST,
    Browser,
    Manual,
    Tool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccessLevel {
    Admin,
    User,
    Anonymous,
    TenantA,
    TenantB,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReportFormat {
    Pdf,
    Markdown,
    Json,
    Html,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MutatorType {
    BitFlip,
    ByteReplace,
    Grammar,
    Wordlist,
    Radamsa,
    Boundary,
    UnicodeNormalization,
    Truncation,
    FormatString,
    AiAssisted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationStrategy {
    BrowserExecution,
    OASTCorrelation,
    TimingStatistical,
    ResponseDifferential,
    StateVerification,
    AuthorizationReplay,
    ContentVerification,
    MathematicalVerification,
    ErrorClassification,
    CausalMinimization,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ParameterClass {
    ObjectId,
    Url,
    FilePath,
    Email,
    Token,
    Search,
    Numeric,
    Boolean,
    Json,
    Xml,
    Html,
    Enumeration,
    FreeText,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyResultType {
    Approved,
    Blocked,
    Filtered,
    RequiresHumanApproval,
}

// ==========================================
// 2. Core Metadata Structs
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMetadata {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub provenance: Provenance,
    pub lifecycle: LifecycleState,
    pub scope_id: Option<Uuid>,
}

// ==========================================
// 3. Traffic & Protocol Structs
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpParsedParts {
    pub method: HttpMethod,
    pub uri: String,
    pub version: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsData {
    pub protocol: String,
    pub cipher: String,
    pub server_name: Option<String>,
    pub alpn: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRepresentation {
    pub raw_blob_id: Uuid,
    pub parsed: HttpParsedParts,
    pub normalized_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub meta: EntityMetadata,
    pub request: MessageRepresentation,
    pub response: Option<MessageRepresentation>,
    pub timing: std::time::Duration,
    pub tls_info: Option<TlsData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub meta: EntityMetadata,
    pub source: ObservationSource,
    pub data_ref: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub meta: EntityMetadata,
    pub source_observation_id: Uuid,
    pub hypothesis: String,
    pub status: String,
}

// ==========================================
// 4. Verification & Findings Structs
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStrategyRef {
    pub strategy_type: VerificationStrategy,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffData {
    pub structural_similarity: f32,
    pub bytes_added: usize,
    pub bytes_removed: usize,
    pub status_code_changed: bool,
    pub content_type_changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceVariant {
    TransactionEvidence(Uuid),
    OastEvidence(Uuid),
    BrowserSnapshot(Uuid),
    TimingVariance { expected: std::time::Duration, actual: std::time::Duration },
    Differential(DiffData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub id: Uuid,
    pub verification_id: Uuid,
    pub variant: EvidenceVariant,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub id: Uuid,
    pub candidate_id: Uuid,
    pub strategy_ref: VerificationStrategyRef,
    pub success: bool,
    pub confidence: f32,
    pub evidence: Vec<Evidence>,
    pub executed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub meta: EntityMetadata,
    pub title: String,
    pub severity: Severity,
    pub verification_id: Uuid,
    pub state: FindingLifecycle,
}

// ==========================================
// 5. Supporting Domain Entities (20 Entities)
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub includes: Vec<String>,
    pub excludes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Endpoint {
    pub id: Uuid,
    pub host: String,
    pub path: String,
    pub method: HttpMethod,
    pub timestamp: DateTime<Utc>,
    pub graph_node_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payload {
    pub id: Uuid,
    pub injection_point: ParamLocation,
    pub payload_string: String,
    pub expected_behavior: VerificationStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub username: String,
    pub roles: Vec<String>,
    pub meta: Option<EntityMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub identity_id: Uuid,
    pub cookies: HashMap<String, String>,
    pub headers: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: Uuid,
    pub identity_id: Uuid,
    pub credential_type: String,
    pub secret_reference: Uuid,
    pub access_level: AccessLevel,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretReference {
    pub reference_id: Uuid,
    pub vault_backend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: Uuid,
    pub asset_type: String,
    pub identifier: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Technology {
    pub id: String,
    pub name: String,
    pub category: String,
    pub version: Option<String>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    pub state_id: String,
    pub state_type: String,
    pub payload_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: Uuid,
    pub name: String,
    pub steps_json: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub resource_type: String,
    pub limit_value: u64,
    pub current_usage: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub action_id: Uuid,
    pub action_type: String,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub task_type: String,
    pub priority: u8,
    pub state: TaskLifecycle,
    pub progress_pct: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub title: String,
    pub format: ReportFormat,
    pub file_path: String,
    pub config_json: String,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegressionTest {
    pub id: Uuid,
    pub finding_id: Uuid,
    pub seed_transaction_id: Uuid,
    pub expected_status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OASTInteraction {
    pub id: Uuid,
    pub token_id: Uuid,
    pub protocol: String,
    pub source_ip: String,
    pub raw_blob_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

pub type OastInteraction = OASTInteraction;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackPath {
    pub id: Uuid,
    pub start_node_id: Uuid,
    pub target_node_id: Uuid,
    pub edge_ids: Vec<Uuid>,
    pub risk_score: f32,
    pub discovered_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: Uuid,
    pub target_id: Uuid,
    pub author: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: Uuid,
    pub blob_id: Uuid,
    pub full_page: bool,
    pub timestamp: DateTime<Utc>,
}

// ==========================================
// 6. Global Error Types
// ==========================================

#[derive(Debug, thiserror::Error)]
pub enum SentinelError {
    #[error("Database error: {0}")] Database(#[from] sqlx::Error),
    #[error("I/O error: {0}")] Io(#[from] std::io::Error),
    #[error("Search index error: {0}")] Tantivy(String),
    #[error("Scope engine rejected interaction: {reason}")] ScopeViolation { reason: String },
    #[error("Event bus overflow: dropped {count} messages")] BusOverflow { count: usize },
    #[error("Parsing error: {0}")] ParseError(String),
    #[error("AI Engine error: {0}")] AiEngine(String),
    #[error("Plugin sandbox violation: {0}")] SandboxViolation(String),
    #[error("Internal invariant violated: {0}")] InvariantViolation(String),
}

// ==========================================
// 7. Domain Scaffolding & Helper Types
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeDecision {
    pub decision_id: Uuid,
    pub allowed: bool,
    pub reason: String,
    pub matched_rule: Option<Uuid>,
    pub target: String,
    pub scope_version: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseWarning { 
    pub code: String, 
    pub severity: Severity, 
    pub offset: usize, 
    pub component: String, 
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: Uuid,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
    pub node_type: String,
    pub label: String,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: Uuid,
    pub source_id: Uuid,
    pub target_id: Uuid,
    pub edge_type: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzProfile { 
    pub insertion_points: Vec<ParamLocation>,
    pub mutators: Vec<MutatorType>,
    pub encoders: Vec<String>,
    pub concurrency: u32,
    pub request_budget: u64,
    pub timeout_ms: u64,
    pub stop_conditions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterceptRule {
    pub id: Uuid,
    pub match_condition: String,
    pub action: String,
    pub action_data_json: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInput {
    pub transaction_id: Option<Uuid>,
    pub config_overrides: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityCheck {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub severity: Severity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OastConfig {
    pub bind_ip: String,
    pub base_domain: String,
    pub use_tls: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStateUpdate {
    pub task_id: Uuid,
    pub state: TaskLifecycle,
    pub progress_pct: f32,
    pub error: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgressUpdate {
    pub scan_id: Uuid,
    pub state: ScanLifecycle,
    pub progress_pct: f32,
    pub checks_completed: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub bind_address: String,
    pub port: u16,
    pub upstream_proxy: Option<String>,
    pub tls_cert_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceBudget {
    pub max_requests: u64,
    pub max_duration_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    pub id: Uuid,
    pub scope_id: Uuid,
    pub concurrency_limit: u32,
    pub active_plugins_json: String,
    pub timestamp: DateTime<Utc>,
    pub budget: ResourceBudget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskConfig {
    pub task_type: String,
    pub priority: u8,
    pub target_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportConfig {
    pub format: ReportFormat,
    pub finding_ids: Vec<Uuid>,
    pub include_evidence: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeConfig {
    pub default_action: String,
    pub max_rule_length: usize,
    pub rule_evaluation_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub sqlite_path: String,
    pub tantivy_path: String,
    pub blob_store_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub default_concurrency: u32,
    pub max_concurrency: u32,
    pub request_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub enabled: bool,
    pub provider: String,
    pub model: String,
    pub policy_enforcement: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub plugin_directory: String,
    pub max_wasm_memory_mb: u32,
    pub allow_rhai_scripts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentinelConfig {
    pub proxy: ProxyConfig,
    pub scope: ScopeConfig,
    pub storage: StorageConfig,
    pub scanner: ScannerConfig,
    pub ai: AiConfig,
    pub plugins: PluginConfig,
}

// ==========================================
// 8. Core Subsystem Traits (SUB-01 to SUB-14)
// ==========================================

pub trait ProxyInterceptor: Send + Sync {}

#[async_trait::async_trait]
pub trait ProxyEngine {
    async fn start(&self, config: ProxyConfig) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    fn register_interceptor(&mut self, interceptor: Box<dyn ProxyInterceptor>);
    fn set_intercept_rules(&mut self, rules: Vec<InterceptRule>) -> Result<(), SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedRequest {
    pub method: HttpMethod,
    pub uri: String,
    pub version: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedResponse {
    pub version: String,
    pub status_code: u16,
    pub reason: String,
    pub headers: Vec<(Vec<u8>, Vec<u8>)>,
    pub body: Vec<u8>,
}

#[async_trait::async_trait]
pub trait HttpParser {
    fn parse_request(&self, raw: &[u8]) -> Result<ParsedRequest, SentinelError>;
    fn parse_response(&self, raw: &[u8]) -> Result<ParsedResponse, SentinelError>;
    fn serialize_request(&self, req: &ParsedRequest) -> Result<Vec<u8>, SentinelError>;
    fn serialize_response(&self, res: &ParsedResponse) -> Result<Vec<u8>, SentinelError>;
}

#[async_trait::async_trait]
pub trait ObservationStore {
    async fn insert(&self, obs: Observation) -> Result<(), SentinelError>;
    async fn insert_batch(&self, obs: Vec<Observation>) -> Result<(), SentinelError>;
    async fn get(&self, id: Uuid) -> Result<Option<Observation>, SentinelError>;
    async fn query_sql(&self, sql: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn search_fts(&self, query: &str) -> Result<Vec<Observation>, SentinelError>;
    async fn rebuild_index(&self) -> Result<(), SentinelError>;
}

#[async_trait::async_trait]
pub trait ScopeEngine {
    fn is_in_scope(&self, uri: &str) -> ScopeDecision;
    fn is_ip_in_scope(&self, ip: &str) -> ScopeDecision;
    fn update_scope(&mut self, scope: Scope) -> Result<(), SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SentinelEvent { 
    ObservationCreated(Uuid), 
    ContextDetected(Uuid), 
    CoverageUpdate(Uuid),
    ScanProgress(ScanProgressUpdate),
    TaskStatus(TaskStateUpdate),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CriticalEvent { 
    FindingCreated(Uuid), 
    CandidateVerified(Uuid),
    ScopeViolationAttempt { source: String, target: String, decision: ScopeDecision },
}

#[async_trait::async_trait]
pub trait EventBus {
    fn subscribe_telemetry(&self) -> tokio::sync::broadcast::Receiver<SentinelEvent>;
    fn subscribe_critical(&self) -> tokio::sync::mpsc::Receiver<CriticalEvent>;
    fn publish_telemetry(&self, event: SentinelEvent) -> Result<(), SentinelError>;
    fn publish_critical(&self, event: CriticalEvent) -> Result<(), SentinelError>;
}

#[async_trait::async_trait]
pub trait TaskScheduler {
    async fn submit(&self, task: TaskConfig) -> Result<Uuid, SentinelError>;
    async fn pause(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn resume(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel(&self, task_id: Uuid) -> Result<(), SentinelError>;
    async fn status(&self, task_id: Uuid) -> Result<TaskLifecycle, SentinelError>;
    async fn checkpoint(&self, task_id: Uuid, state: Vec<u8>) -> Result<(), SentinelError>;
    async fn restore_checkpoint(&self, task_id: Uuid) -> Result<Option<Vec<u8>>, SentinelError>;
}

#[async_trait::async_trait]
pub trait ScanOrchestrator {
    async fn start_scan(&self, config: ScanConfig) -> Result<Uuid, SentinelError>;
    async fn pause_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn resume_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn cancel_scan(&self, scan_id: Uuid) -> Result<(), SentinelError>;
    async fn scan_status(&self, scan_id: Uuid) -> Result<ScanLifecycle, SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzStream {}

#[async_trait::async_trait]
pub trait FuzzerEngine {
    async fn fuzz(&self, seed: &Transaction, profile: &FuzzProfile) -> Result<FuzzStream, SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OastEvidence {
    pub token: String,
    pub interaction_time: DateTime<Utc>,
}

#[async_trait::async_trait]
pub trait VerificationEngine {
    async fn verify_candidate(&self, candidate: &Candidate, strategy: VerificationStrategyRef) -> Result<VerificationResult, SentinelError>;
    async fn correlate_oast(&self, token: &str) -> Result<Option<OastEvidence>, SentinelError>;
    fn available_strategies(&self) -> Vec<VerificationStrategy>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechFingerprint {
    pub tech: String,
    pub confidence: f32,
}

#[async_trait::async_trait]
pub trait ContextEngine {
    fn fingerprint(&self, transaction: &Transaction) -> Vec<TechFingerprint>;
    fn classify_parameter(&self, name: &str, value: &str) -> ParameterClass;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageReport {
    pub total: u32,
    pub tested: u32,
}

#[async_trait::async_trait]
pub trait CoverageEngine {
    async fn record_test(&self, endpoint_id: Uuid) -> Result<(), SentinelError>;
    async fn get_coverage(&self, scope_id: Uuid) -> Result<CoverageReport, SentinelError>;
    async fn untested_endpoints(&self, scope_id: Uuid) -> Result<Vec<Endpoint>, SentinelError>;
}

#[async_trait::async_trait]
pub trait IdentityManager {
    async fn add_identity(&self, identity: Identity) -> Result<Uuid, SentinelError>;
    async fn add_credential(&self, credential: Credential) -> Result<Uuid, SentinelError>;
    async fn list_identities(&self) -> Result<Vec<Identity>, SentinelError>;
    async fn inject_auth(&self, identity_id: Uuid, request: &mut ParsedRequest) -> Result<(), SentinelError>;
    async fn refresh_credential(&self, credential_id: Uuid) -> Result<(), SentinelError>;
}

#[async_trait::async_trait]
pub trait KnowledgeEngine {
    async fn add_node(&self, node: GraphNode) -> Result<Uuid, SentinelError>;
    async fn add_edge(&self, edge: GraphEdge) -> Result<Uuid, SentinelError>;
    async fn query_neighbors(&self, node_id: Uuid) -> Result<Vec<GraphNode>, SentinelError>;
    async fn find_path(&self, from: Uuid, to: Uuid) -> Result<Vec<Vec<GraphEdge>>, SentinelError>;
    async fn resolve_entity(&self, identifier: &str) -> Result<Option<GraphNode>, SentinelError>;
}

#[async_trait::async_trait]
pub trait ReportEngine {
    async fn generate(&self, config: ReportConfig) -> Result<Vec<u8>, SentinelError>;
}

// ==========================================
// 9. Professional Tier Subsystems (SUB-15 to SUB-21)
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationResult {
    pub success: bool,
}

#[async_trait::async_trait]
pub trait BrowserService {
    async fn navigate(&self, url: &str) -> Result<NavigationResult, SentinelError>;
    async fn execute_script(&self, js: &str) -> Result<String, SentinelError>;
    async fn capture_dom(&self) -> Result<String, SentinelError>;
    async fn take_screenshot(&self, full_page: bool) -> Result<Vec<u8>, SentinelError>;
    async fn close(&self) -> Result<(), SentinelError>;
}

#[async_trait::async_trait]
pub trait OastServer {
    async fn start(&self) -> Result<(), SentinelError>;
    async fn stop(&self) -> Result<(), SentinelError>;
    async fn generate_token(&self) -> Result<String, SentinelError>;
    async fn poll_interactions(&self, token: &str) -> Result<Vec<OastInteraction>, SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthzMatrix {
    pub identities: Vec<Uuid>,
    pub endpoints: Vec<Uuid>,
    pub expected: HashMap<Uuid, AccessLevel>,
    pub actual: HashMap<Uuid, AccessLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthzViolation {
    pub identity_id: Uuid,
    pub endpoint_id: Uuid,
}

#[async_trait::async_trait]
pub trait AuthorizationEngine {
    async fn build_matrix(&self, identities: Vec<Uuid>) -> Result<AuthzMatrix, SentinelError>;
    async fn test_matrix(&self, matrix: &AuthzMatrix) -> Result<Vec<AuthzViolation>, SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRequest {
    pub prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResponse {
    pub content: String,
}

#[async_trait::async_trait]
pub trait AiEngine {
    async fn analyze(&self, request: AiRequest) -> Result<AiResponse, SentinelError>;
    fn is_available(&self) -> bool;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PolicyResult {
    Approved,
    Blocked,
    Filtered(String),
    RequiresHumanApproval,
}

#[async_trait::async_trait]
pub trait AiPolicyEngine {
    fn validate_input(&self, prompt: &str) -> PolicyResult;
    fn validate_output(&self, response: &str) -> PolicyResult;
    fn is_destructive(&self, command: &str) -> bool;
    fn requires_approval(&self, command: &str) -> bool;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilitySet {
    pub network: bool,
    pub filesystem: bool,
    pub secrets: bool,
    pub database: bool,
    pub browser: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: u32,
    pub max_execution_ms: u64,
    pub max_network_requests: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSandboxConfig {
    pub capabilities: CapabilitySet,
    pub limits: ResourceLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginOutput {
    pub output: String,
}

#[async_trait::async_trait]
pub trait PluginRuntime {
    async fn load_wasm(&self, wasm_bytes: &[u8], config: PluginSandboxConfig) -> Result<Uuid, SentinelError>;
    async fn load_rhai(&self, script: &str, config: PluginSandboxConfig) -> Result<Uuid, SentinelError>;
    async fn execute(&self, plugin_id: Uuid, input: PluginInput) -> Result<PluginOutput, SentinelError>;
    async fn unload(&self, plugin_id: Uuid) -> Result<(), SentinelError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackManifest {
    pub id: String,
    pub version: String,
}

#[async_trait::async_trait]
pub trait ResearchPackManager {
    async fn load_pack(&self, path: &str) -> Result<PackManifest, SentinelError>;
    async fn verify_signature(&self, pack: &PackManifest) -> Result<bool, SentinelError>;
    async fn list_checks(&self, pack_id: &str) -> Result<Vec<SecurityCheck>, SentinelError>;
    async fn hot_reload(&self, pack_id: &str) -> Result<(), SentinelError>;
}

// ==========================================
// 10. Adapter Tier (SUB-22 to SUB-25)
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubdomainAsset {
    pub domain: String,
    pub ip_addresses: Vec<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudAsset {
    pub arn: String,
    pub service: String,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PRoute {
    pub path_template: String,
    pub method: HttpMethod,
    pub expected_params: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SastFinding {
    pub file_path: String,
    pub line_number: u32,
    pub snippet: String,
    pub taint_source: String,
}

#[async_trait::async_trait]
pub trait ExternalToolAdapter {
    fn tool_name(&self) -> &str;
    fn is_installed(&self) -> bool;
    async fn execute(&self, config: serde_json::Value) -> Result<serde_json::Value, SentinelError>;
}

// ==========================================
// 11. Research Tier Subsystems (SUB-26 to SUB-28)
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolicPath {
    pub target_variable: String,
    pub constraints_solved: bool,
    pub mathematical_proof: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RlRewardModel {
    pub state_hash: String,
    pub actions_explored: usize,
    pub reward_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoWeakness {
    pub protocol: String,
    pub weakness_type: String,
    pub extracted_private_key: Option<String>,
}

#[cfg(feature = "sentinel-research")]
#[async_trait::async_trait]
pub trait SmtSolverEngine {
    async fn prove_logic_flaw(&self, source_code: &str, invariant: &str) -> Result<SymbolicPath, SentinelError>;
}

#[cfg(feature = "sentinel-research")]
#[async_trait::async_trait]
pub trait RlStateEngine {
    async fn explore_state_machine(&self, initial_url: &str) -> Result<Vec<RlRewardModel>, SentinelError>;
}

#[cfg(feature = "sentinel-research")]
#[async_trait::async_trait]
pub trait CryptoAnalysisEngine {
    async fn analyze_handshake(&self, pcap_data: &[u8]) -> Result<Option<CryptoWeakness>, SentinelError>;
}

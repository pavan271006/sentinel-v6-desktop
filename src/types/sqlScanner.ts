/**
 * Sentinel SQL X — Advanced SQL Injection Research & Recursive Database Explorer
 * Complete Type Definitions & Architecture Specifications
 */

export type DbmsType =
  | 'MySQL'
  | 'MariaDB'
  | 'Microsoft SQL Server'
  | 'PostgreSQL'
  | 'Oracle'
  | 'SQLite'
  | 'IBM Db2'
  | 'H2'
  | 'Microsoft Access'
  | 'Snowflake'
  | 'Google BigQuery'
  | 'ClickHouse'
  | 'CockroachDB'
  | 'YugabyteDB'
  | 'Vitess'
  | 'SingleStore'
  | 'DuckDB'
  | 'Apache Doris'
  | 'Databricks SQL'
  | 'Trino'
  | 'Presto'
  | 'Amazon Redshift'
  | 'Azure Synapse'
  | 'Teradata'
  | 'Firebird'
  | 'SAP HANA'
  | 'Vertica'
  | 'TimescaleDB'
  | 'AlloyDB'
  | 'Generic SQL'
  | 'Unknown';

/**
 * Formal SQL Statement Family Coverage
 */
export type SqlStatementFamily =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'MERGE'
  | 'UPSERT'
  | 'CALL'
  | 'EXEC'
  | 'DDL'
  | 'TRANSACTION'
  | 'EXPLAIN'
  | 'PREPARE'
  | 'COPY_BULK';

/**
 * Formal Database Schema & Metadata Object Target
 */
export type SqlObjectType =
  | 'table'
  | 'column'
  | 'view'
  | 'materialized_view'
  | 'sequence'
  | 'index'
  | 'constraint'
  | 'trigger'
  | 'procedure'
  | 'function'
  | 'package'
  | 'extension'
  | 'role'
  | 'grant'
  | 'policy'
  | 'foreign_server'
  | 'foreign_table';

/**
 * 15-Dimension Parameter Typing Matrix
 */
export type ParamTypeCategory =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'uuid'
  | 'binary'
  | 'array'
  | 'json'
  | 'xml'
  | 'spatial'
  | 'vector'
  | 'enum'
  | 'identifier'
  | 'encoded'
  | 'null'
  | 'unknown';

/**
 * Protocol & Driver Layer Target
 */
export type ProtocolDriverLayer =
  | 'wire_protocol'
  | 'jdbc'
  | 'odbc'
  | 'adonet'
  | 'connection_string'
  | 'prepared_statement'
  | 'type_inference'
  | 'driver_escaping'
  | 'connection_pool';

/**
 * Multi-Tier Parser Differential Pipeline Layer
 */
export type ParserPipelineLayer =
  | 'application'
  | 'waf'
  | 'reverse_proxy'
  | 'driver'
  | 'database_kernel';


export type InjectionType =
  | 'Error-based'
  | 'Boolean-based'
  | 'Time-based'
  | 'UNION-based'
  | 'ORDER BY Injection'
  | 'GROUP BY Injection'
  | 'HAVING Injection'
  | 'Stacked-query indicator'
  | 'Second-Order SQLi'
  | 'Out-of-Band (OAST)';

export type ParameterLocation =
  | 'query'
  | 'body_form'
  | 'body_multipart'
  | 'body_json'
  | 'body_xml'
  | 'header'
  | 'cookie'
  | 'path'
  | 'graphql';

export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export type ConfidenceLevel = 'Confirmed' | 'High' | 'Medium' | 'Low' | 'Informational';

export type ScanVerdict = 'VULNERABLE' | 'NOT CONFIRMED VULNERABLE' | 'IN_PROGRESS' | 'IDLE';

export type ScanMode = 'quick' | 'standard' | 'deep' | 'research' | 'authorized_lab' | 'assessment';

export type InjectionContext =
  | 'numeric'
  | 'single_quote_string'
  | 'double_quote_string'
  | 'parenthesized_string'
  | 'like_clause'
  | 'order_by_clause'
  | 'group_by_clause'
  | 'having_clause'
  | 'where_clause'
  | 'insert_values'
  | 'update_set'
  | 'subquery'
  | 'identifier'
  | 'json_derived'
  | 'xml_derived'
  | 'merge_clause'
  | 'date_time'
  | 'vector_op'
  | 'array_derived'
  | 'limit_offset'
  | 'select_expr'
  | 'join_clause'
  | 'case_expr'
  | 'window_func'
  | 'cte_clause'
  | 'fulltext_search'
  | 'spatial_op'
  | 'delete_where'
  | 'boolean_literal'
  | 'unknown';

export interface CandidateParameter {
  id: string;
  name: string;
  location: ParameterLocation;
  originalValue: string;
  jsonPath?: string;
  xmlPath?: string;
  pathIndex?: number;
  graphqlVar?: string;
  multipartField?: string;
  multipartFilename?: string;
  detectedContext?: InjectionContext;
  statementFamily?: SqlStatementFamily;
  paramTypeCategory?: ParamTypeCategory;
  enabled: boolean;
  testsExecuted?: number;
  testsSkipped?: number;
  positiveIndicators?: number;
  negativeIndicators?: number;
  finalResult?: 'VULNERABLE' | 'NOT CONFIRMED VULNERABLE' | 'UNTESTED';
}

export interface ParameterClassificationResult {
  category: ParamTypeCategory;
  inferredContext: InjectionContext;
  confidence: number;
  isNullable: boolean;
  detectedFormat?: string;
  recommendedTestFamilies: ('boolean' | 'error' | 'time' | 'union' | 'stacked' | 'oast')[];
  skipReasons?: string[];
}

export interface DbmsFingerprint {
  dbms: DbmsType;
  version?: string;
  vendor?: string;
  product?: string;
  majorVersion?: string;
  minorVersion?: string;
  patchBuild?: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  evidence: string[];
}

export interface ConfidenceBreakdown {
  score: number; // 0 - 100
  level: ConfidenceLevel;
  factors: {
    name: string;
    points: number;
    description: string;
  }[];
}

export interface SqlScanEvidence {
  id: string;
  title: string;
  timestamp: number;
  injectionType: InjectionType;
  parameterName: string;
  parameterLocation: ParameterLocation;
  payload: string;
  baselineStatus: number;
  baselineLength: number;
  baselineDurationMs: number;
  testStatus: number;
  testLength: number;
  testDurationMs: number;
  rawRequest: string;
  rawResponse: string;
  matchedPattern?: string;
  reproductionCount?: number;
  reproductionSuccessRate?: string;
  analysisSummary: string;
}

export interface DiscoveredIndex {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface DiscoveredConstraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  tableName: string;
  columnNames: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface DiscoveredRoutine {
  name: string;
  type: 'procedure' | 'function';
  returnType?: string;
  parameters?: string[];
  schema?: string;
}

export interface DiscoveredTrigger {
  name: string;
  tableName: string;
  event: string;
  timing: string;
}

export interface ColumnMetadata {
  name: string;
  dataType: string;
  dataLength?: number;
  precision?: number;
  scale?: number;
  isNullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  isIndexed: boolean;
  isSensitive: boolean;
  sensitivityReason?: string;
  confidence: ConfidenceLevel;
  evidence?: string;
  discoveredAt: number;
}

export interface DiscoveredTable {
  id: string;
  name: string;
  schema?: string;
  classification: 'application' | 'system' | 'internal' | 'unknown';
  isView?: boolean;
  columns: ColumnMetadata[];
  indexes?: DiscoveredIndex[];
  constraints?: DiscoveredConstraint[];
  isSensitive: boolean;
  sensitivityReason?: string;
  rowCountEstimated?: number;
  sampleRows?: Record<string, string>[];
  sampleRowsStatus?: 'idle' | 'loading' | 'ready' | 'error';
  isExpanded?: boolean;
  evidence?: string;
  discoveredAt: number;
  status: 'discovered' | 'enumerating_columns' | 'columns_ready' | 'error';
}

export interface DiscoveredSchema {
  name: string;
  classification: 'application' | 'system';
  tables: DiscoveredTable[];
  views: DiscoveredTable[];
  routines?: DiscoveredRoutine[];
  procedures?: string[];
  functions?: string[];
  triggers?: DiscoveredTrigger[];
  isExpanded?: boolean;
  discoveredAt: number;
}

export interface SchemaColumn {
  name: string;
  type?: string;
  isSensitive: boolean;
  notes?: string;
}

export interface SchemaTable {
  name: string;
  isSensitive: boolean;
  columns: SchemaColumn[];
  estimatedRowCount?: number;
  notes?: string;
}

export interface SchemaEnumerationResult {
  detectedTables: SchemaTable[];
  totalTablesAccessible: number;
  sensitiveObjectsCount: number;
  columnCountEstimated?: number;
  renderableColumns?: number[];
  contentRetrievalStatus: 'BLOCKED BY SAFETY POLICY' | 'UNAVAILABLE';
}

export interface RecursiveDatabaseCatalog {
  dbms: DbmsType;
  version?: string;
  versionEvidence?: string;
  columnCount?: number;
  renderColumn?: number;
  injectableParamName?: string;
  currentDatabase?: string;
  currentSchema?: string;
  currentUser?: string;
  schemas: DiscoveredSchema[];
  applicationTables: DiscoveredTable[];
  systemTables: DiscoveredTable[];
  views?: DiscoveredTable[];
  procedures?: DiscoveredRoutine[];
  functions?: DiscoveredRoutine[];
  triggers?: DiscoveredTrigger[];
  selectedNodeId?: string;
  discoveredAt: number;
}

export interface PayloadResearchItem {
  id: string;
  name: string;
  dbms: DbmsType;
  context: InjectionContext;
  technique: InjectionType;
  payload: string;
  expectedBehavior: string;
  negativeBehavior: string;
  riskLevel: 'Safe' | 'Probe' | 'Informational';
  source?: string;
  version?: string;
}

export interface TestExecutionLogItem {
  id: string;
  testIndex: number;
  parameterName: string;
  technique: string;
  context: string;
  dbms: DbmsType;
  payload: string;
  status: 'positive' | 'negative' | 'error' | 'timeout' | 'skipped' | 'passed';
  evidenceSnippet?: string;
  durationMs: number;
  timestamp: number;
  rawRequest?: string;
  rawResponse?: string;
}

export interface CoverageDimension {
  key: string;
  name: string;
  status: 'passed' | 'vulnerable' | 'not_applicable' | 'skipped' | 'pending';
  testedCount: number;
  positiveCount: number;
  reason?: string;
}

export interface CoverageReport {
  parametersDiscovered: number;
  parametersTested: number;
  researchTestsExecuted: number;
  duplicatesRemoved: number;
  testsSkipped: number;
  dimensions: CoverageDimension[];
}

export interface SqlScanFinding {
  id: string;
  title: string;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  confidenceBreakdown: ConfidenceBreakdown;
  injectionType: InjectionType;
  parameterName: string;
  parameterLocation: ParameterLocation;
  url: string;
  httpMethod: string;
  dbms: DbmsType;
  dbmsVersion?: string;
  detectionMethod: string;
  evidence: SqlScanEvidence[];
  reproductionRequest: string;
  reproductionResponse?: string;
  remediation: string;
  cwe: string;
  owaspCategory: string;
  timestamp: number;

  // 8-Layer Defense & Impact Separation
  sqliDetected?: boolean;
  sqlStructureControl?: boolean;
  dataAccessDemonstrated?: boolean;
  crossTenantAccess?: boolean;
  writeCapability?: boolean;
  privilegeCapability?: boolean;
  osFileCapability?: boolean;
  impactConstraints?: string[];
  defenseLayerTrace?: {
    layer: string;
    status: string;
    certainty: string;
    details?: string;
  }[];

  // Threat Classification & Consequence Analysis
  threatClassification?: ThreatClassification;
  consequence?: ThreatConsequence;
  proofDetails?: InvariantProofDetails;
}

export type ThreatClassification =
  | 'OS_COMMAND_INJECTION'
  | 'AUTHENTICATION_BYPASS'
  | 'DATA_EXFILTRATION'
  | 'FILE_SYSTEM_READ'
  | 'SSRF_OOB'
  | 'DATA_TAMPERING'
  | 'PRIVILEGE_ESCALATION';

export interface ThreatConsequence {
  threatClassification: ThreatClassification;
  threatBadge: string;
  consequenceTitle: string;
  consequenceSummary: string;
  technicalImpact: string[];
  businessRisk: string[];
  potentialExploitVectors: string[];
  severityLevel: 'Critical' | 'High' | 'Medium';
}

export interface InvariantProofDetails {
  proofType: string;
  mathematicalInvariant: string;
  controlStateBaseline: string;
  positiveProbeObservation: string;
  negativeProbeDivergence: string;
  cleanRoomVerificationToken?: string;
  extractedProofSnippet?: string;
  reproductionCurl?: string;
}

export interface ScanLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'probe';
  phase: string;
  message: string;
  details?: string;
  payload?: string;
  targetParameter?: string;
}

export type ScanPhase =
  | 'idle'
  | 'authorizing'
  | 'parsing'
  | 'parameter_discovery'
  | 'baseline'
  | 'context_detection'
  | 'error_testing'
  | 'boolean_testing'
  | 'time_testing'
  | 'union_testing'
  | 'order_by_testing'
  | 'group_by_testing'
  | 'having_testing'
  | 'stacked_testing'
  | 'second_order'
  | 'fingerprinting'
  | 'version_detection'
  | 'schema_analysis'
  | 'column_enumeration'
  | 'waf_check'
  | 'evidence_correlation'
  | 'reporting'
  | 'completed'
  | 'paused'
  | 'aborted';

export interface ScanProgress {
  phase: ScanPhase;
  phaseLabel: string;
  totalParameters: number;
  testedParameters: number;
  currentParameter?: string;
  requestsSent: number;
  testsExecuted: number;
  findingsCount: number;
  confirmedIndicators: number;
  percent: number; // 0 - 100
  startTime?: number;
  endTime?: number;
  durationMs: number;
  isPaused: boolean;
  isAborted: boolean;
}

export interface SafetyConfig {
  authorizedTestingConfirmed: boolean;
  scanMode: ScanMode;
  rateLimitDelayMs: number;
  maxRequestsPerScan: number;
  maxScanDurationSeconds: number;
  maxResponseSizeBytes: number;
  requestTimeoutMs: number;
  abortOnConsecutiveErrors: number;
  strictNonDestructiveOnly: boolean;
  autoRedactSensitiveData: boolean;
  scanAuthTokens?: boolean;
  maxUnionColumns?: number;
}

export interface SecondOrderWorkflowConfig {
  enabled: boolean;
  sourceParamName?: string;
  sinkRawRequest?: string;
  sinkUrl?: string;
  expectedTokenPrefix?: string;
}

export interface OobInteraction {
  id: string;
  token: string;
  type: 'DNS' | 'HTTP' | 'LDAP' | 'SMB';
  receivedAt: number;
  clientIp: string;
  queryPayload: string;
}

export interface OobConfig {
  enabled: boolean;
  providerUrl?: string;
  apiKey?: string;
  domain?: string;
}

export interface IastConfig {
  enabled: boolean;
  sensorPort?: number;
  sharedSecret?: string;
  tokenPrefix?: string;
  localSinkListener?: boolean;
}

export interface HeadlessDomConfig {
  enabled: boolean;
  browserDriver?: 'playwright' | 'puppeteer' | 'cdp' | 'simulated';
  targetFormSelector?: string;
  inputSelectors?: Record<string, string>;
  preEncryptHook?: string;
}

export interface BotBypassConfig {
  enabled: boolean;
  bypassHeaders?: Record<string, string>;
  clearanceCookies?: Record<string, string>;
  userAgentProfile?: string;
}

export interface MacroWorkflowStep {
  id: string;
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  isInjectionTarget?: boolean;
  targetParameter?: string;
  extractTokens?: {
    name: string;
    source: 'body_regex' | 'body_json' | 'header' | 'cookie';
    pattern: string;
  }[];
  authGates?: {
    type: 'static_otp' | 'totp' | 'recaptcha_token';
    paramName: string;
    secretOrToken: string;
  }[];
}

export interface MacroWorkflowConfig {
  enabled: boolean;
  harContent?: string;
  steps?: MacroWorkflowStep[];
  dynamicTokenExtractors?: {
    name: string;
    source: 'body_regex' | 'body_json' | 'header' | 'cookie';
    pattern: string;
  }[];
}

export interface GrayBoxConfig {
  enabled: boolean;
  mode?: 'hybrid' | 'iast_only' | 'dom_only' | 'macro_only';
  iastConfig?: IastConfig;
  headlessDomConfig?: HeadlessDomConfig;
  botBypassConfig?: BotBypassConfig;
  macroWorkflowConfig?: MacroWorkflowConfig;
}

export interface IastTelemetryEvent {
  id: string;
  timestamp: number;
  sinkLocation: string;
  executedQuery: string;
  taintedParameter?: string;
  taintedValue?: string;
  grammarViolation?: string;
  isVulnerable: boolean;
  stackTrace?: string;
}

export interface IastFinding {
  id: string;
  sinkLocation: string;
  executedQuery: string;
  taintedParameter: string;
  taintedValue: string;
  grammarViolation: string;
  timestamp: number;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
}

export interface GrayBoxFinding {
  id: string;
  boundarySolved: 'air_gapped_async_sink' | 'client_side_encryption' | 'bot_mitigation' | 'multi_step_state';
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  evidence: Record<string, any>;
  timestamp: number;
}

export interface ScanTargetConfig {
  id: string;
  name: string;
  rawRequest: string;
  url: string;
  method: string;
  headers: { name: string; value: string; enabled: boolean }[];
  body: string;
  parameters: CandidateParameter[];
  testedInjectionTypes: {
    errorBased: boolean;
    booleanBased: boolean;
    timeBased: boolean;
    unionBased: boolean;
    orderBy: boolean;
    groupBy: boolean;
    having: boolean;
    stackedBased: boolean;
    secondOrder: boolean;
  };
  secondOrderConfig?: SecondOrderWorkflowConfig;
  oobConfig?: OobConfig;
  grayBoxConfig?: GrayBoxConfig;
}

export interface WafDetectionResult {
  detected: boolean;
  wafName?: string;
  confidence: ConfidenceLevel;
  evidence: string[];
}

export interface SqlScanReport {
  id: string;
  generatedAt: number;
  targetUrl: string;
  targetMethod: string;
  verdict: ScanVerdict;
  verdictReason: string;
  durationMs: number;
  requestsSent: number;
  testsExecuted: number;
  confirmedIndicators: number;
  waf: WafDetectionResult;
  dbms: DbmsFingerprint;
  findings: SqlScanFinding[];
  catalog: RecursiveDatabaseCatalog;
  coverage: CoverageDimension[];
  coverageReport?: CoverageReport;
  executionLogs: TestExecutionLogItem[];
  executiveSummary: string;
  technicalDetails: string;
  safetyCertificate?: {
    isSafe: boolean;
    proofs: { reason: string; confidence: number; evidenceLogs: string[] }[];
  };
}

export interface InvestigationNode {
  id: string;
  label: string;
  type: 'root_request' | 'surface' | 'context_hypothesis' | 'dbms_hypothesis' | 'experiment_branch' | 'second_order' | 'confirmed_finding';
  status: 'pending' | 'running' | 'supported' | 'rejected' | 'pruned';
  depth: number;
  eig: number;
  cost: number;
  priority: number;
  description: string;
  evidenceCount: number;
  details?: Record<string, any>;
}

export interface InvestigationEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'derives' | 'proves' | 'refutes' | 'transitions';
}

export interface BeliefEntropyItem {
  name: string;
  probability: number;
  shannonBits: number;
  isLeading: boolean;
}

export interface AiCopilotReasoningItem {
  id: string;
  timestamp: number;
  hypothesis: string;
  reasoning: string;
  suggestedAction: string;
  confidenceScore: number;
}

export interface SqlScanLiveResponse {
  statusCode: number;
  statusText?: string;
  durationMs: number;
  headers: { name: string; value: string }[];
  rawResponse: string;
  body: string;
  timestamp: number;
}

export interface SqlScannerSessionTab {
  id: string;
  title: string;
  targetConfig: ScanTargetConfig;
  safetyConfig: SafetyConfig;
  scanState: 'idle' | 'running' | 'paused' | 'completed' | 'aborted' | 'error';
  scanVerdict: ScanVerdict;
  progress: ScanProgress;
  findings: SqlScanFinding[];
  dbmsFingerprint: DbmsFingerprint;
  catalog: RecursiveDatabaseCatalog;
  coverage: CoverageDimension[];
  executionLogs: TestExecutionLogItem[];
  logs: ScanLogEntry[];
  wafResult?: WafDetectionResult;
  report: SqlScanReport | null;
  orchestrator?: any;
  activeInnerTab: 'god_rail' | 'dashboard' | 'vulnerabilities' | 'database' | 'evidence' | 'coverage' | 'logs' | 'causal' | 'trigraph' | 'belief' | 'knowledge' | 'ai_copilot' | 'report';
  engineMode: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard';
  scanProfile?: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo';
  concurrencyLimit?: number;
  selectedCatalogTableId?: string | null;
  selectedCatalogColumnName?: string | null;
  investigationNodes?: InvestigationNode[];
  investigationEdges?: InvestigationEdge[];
  contextBeliefs?: BeliefEntropyItem[];
  dbmsBeliefs?: BeliefEntropyItem[];
  aiReasoningLogs?: AiCopilotReasoningItem[];
  defenseLayers?: {
    layer: string;
    name: string;
    status: string;
    certainty: string;
    confidence: number;
    details?: string;
  }[];
  lastResponse?: SqlScanLiveResponse | null;
}



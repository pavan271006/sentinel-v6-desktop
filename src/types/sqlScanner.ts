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
  | 'Generic SQL'
  | 'Unknown';

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
  enabled: boolean;
  testsExecuted?: number;
  testsSkipped?: number;
  positiveIndicators?: number;
  negativeIndicators?: number;
  finalResult?: 'VULNERABLE' | 'NOT CONFIRMED VULNERABLE' | 'UNTESTED';
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
  activeInnerTab: 'dashboard' | 'vulnerabilities' | 'database' | 'evidence' | 'coverage' | 'logs' | 'causal' | 'report';
  engineMode: 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard';
}


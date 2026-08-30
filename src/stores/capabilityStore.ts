import { create } from 'zustand';
import { SubsystemCapability } from '../types/capability';

interface CapabilityStore {
  capabilities: Map<string, SubsystemCapability>;
  getCapability: (subsystemId: string) => SubsystemCapability | undefined;
  isImplemented: (subsystemId: string) => boolean;
  getDisabledReason: (subsystemId: string) => string | undefined;
}

const INITIAL_CAPABILITIES: SubsystemCapability[] = [
  {
    subsystemId: 'SUB-01',
    name: 'Common Primitives & Security',
    cratePath: 'crates/sentinel_common',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'SecretString, SecretBytes, Transaction, Finding',
    description: 'Memory zeroization and security domain types',
    testEvidence: '10 tests pass',
  },
  {
    subsystemId: 'SUB-02',
    name: 'SQLite WAL & CAS Storage',
    cratePath: 'crates/sentinel_storage',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'ProjectStorage, BlobStorage, AuditRepository',
    description: '32 tables SQLite WAL & CAS SHA-256 storage',
    testEvidence: '17 tests pass',
  },
  {
    subsystemId: 'SUB-03',
    name: 'Dual-Channel Event Bus',
    cratePath: 'crates/sentinel_bus',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'SentinelEventBus, TelemetryBroadcastChannel, CriticalDeliveryChannel',
    description: 'Bounded telemetry & lossless critical queue',
    testEvidence: '15 tests pass',
  },
  {
    subsystemId: 'SUB-04',
    name: 'Fail-Closed Scope Engine',
    cratePath: 'crates/sentinel_scope',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultScopeEngine, SsrfValidator',
    description: 'CIDR, wildcards, regex, SSRF prevention (SEC-01)',
    testEvidence: '35 tests pass',
  },
  {
    subsystemId: 'SUB-05',
    name: 'HTTP Protocol Parser',
    cratePath: 'crates/sentinel_parser',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'SentinelHttpParser, RichParsedRequest, smuggling',
    description: 'RFC 9112 HTTP/1.1 & HTTP/2 streaming parser',
    testEvidence: '24 tests pass',
  },
  {
    subsystemId: 'SUB-06',
    name: 'Traffic Proxy & MITM Engine',
    cratePath: 'crates/sentinel_proxy',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'SentinelProxyEngine, RootCA, InterceptorPipeline',
    description: 'Dynamic TLS forging, CAS recording, WebSocket tap',
    testEvidence: '5 tests pass',
  },
  {
    subsystemId: 'SUB-07',
    name: 'HTTPQL Query Engine',
    cratePath: 'crates/sentinel_httpql',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'SqlCompiler, Evaluator, Lexer, Parser',
    description: 'HTTPQL AST compiler and filter evaluator',
    testEvidence: '7 tests pass',
  },
  {
    subsystemId: 'SUB-08',
    name: 'Repeater Manual Workspace',
    cratePath: 'crates/sentinel_repeater',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'RepeaterManager, RepeaterExecutor, ResponseDiff',
    description: 'Multi-tab request replay & diff engine',
    testEvidence: '4 tests pass',
  },
  {
    subsystemId: 'SUB-09',
    name: 'Target Context & Fingerprinting',
    cratePath: 'crates/sentinel_context',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultContextEngine, TechDetector',
    description: 'Heuristic technology stack and parameter classifier',
    testEvidence: '2 tests pass',
  },
  {
    subsystemId: 'SUB-10',
    name: 'Attack Surface Knowledge Graph',
    cratePath: 'crates/sentinel_knowledge',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultKnowledgeEngine, GraphIndex',
    description: 'SQLite recursive CTE graph path traversal',
    testEvidence: '2 tests pass',
  },
  {
    subsystemId: 'SUB-11',
    name: 'Attack Surface Coverage Engine',
    cratePath: 'crates/sentinel_coverage',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultCoverageEngine',
    description: 'Discovered vs tested endpoint tracking',
    testEvidence: '2 tests pass',
  },
  {
    subsystemId: 'SUB-12',
    name: 'Redacted Identity Vault & Auth',
    cratePath: 'crates/sentinel_auth',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'SecureVault, DefaultIdentityManager, JwtUtility',
    description: 'Zeroized keychain (SEC-09) & JWT workbench',
    testEvidence: '3 tests pass',
  },
  {
    subsystemId: 'SUB-13',
    name: 'Scanner & Task Orchestrator',
    cratePath: 'crates/sentinel_scanner',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultScanOrchestrator, SecurityCheckEngine',
    description: 'Passive & active checks, concurrency rate limiting',
    testEvidence: 'Passed',
  },
  {
    subsystemId: 'SUB-14',
    name: 'Mutation Fuzzer & Minimizer',
    cratePath: 'crates/sentinel_fuzzer',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultFuzzerEngine, PayloadMinimizer (ddmin)',
    description: 'Delta debugging minimizer and mutation fuzzer',
    testEvidence: '3 tests pass',
  },
  {
    subsystemId: 'SUB-15',
    name: 'Verification & Proof Engine',
    cratePath: 'crates/sentinel_verification',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultVerificationEngine, FindingLifecycleManager',
    description: '5 proof strategies & lifecycle state machine',
    testEvidence: '4 tests pass',
  },
  {
    subsystemId: 'SUB-16',
    name: 'Authorization Matrix Engine',
    cratePath: 'crates/sentinel_authz',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultAuthorizationEngine, MatrixEvaluator',
    description: 'Cross-role/tenant matrix for BOLA/IDOR/BFLA',
    testEvidence: '2 tests pass',
  },
  {
    subsystemId: 'SUB-17',
    name: 'API Security Engine',
    cratePath: 'crates/sentinel_api',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'OpenApiParser, GraphQlEngine, WebSocketParser',
    description: 'OpenAPI 3.x, GraphQL depth analyzer, WS frames',
    testEvidence: '3 tests pass',
  },
  {
    subsystemId: 'SUB-18',
    name: 'Browser Automation & DOM',
    cratePath: 'crates/sentinel_browser',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultBrowserService, DomExtractor',
    description: 'Headless browser daemon, DOM snapshot & screenshot CAS',
    testEvidence: '2 tests pass',
  },
  {
    subsystemId: 'SUB-19',
    name: 'Out-of-Band OAST Server',
    cratePath: 'crates/sentinel_oast',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'DefaultOastServer, OastTokenGenerator',
    description: 'AES-256 correlation tokens, DNS/HTTP callback listener',
    testEvidence: '2 tests pass',
  },
  {
    subsystemId: 'SUB-20',
    name: 'Business Logic & Race Engine',
    cratePath: 'crates/sentinel_logic',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'WorkflowEngine, RaceConditionProber',
    description: 'Multi-step workflow prober & barrier race engine',
    testEvidence: '3 tests pass',
  },
  {
    subsystemId: 'SUB-21',
    name: 'Findings Center & Reporting',
    cratePath: 'crates/sentinel_report',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'FindingsCenter, ReportGenerator, NotebookManager',
    description: 'SARIF 2.1, Markdown/HTML/PDF reports & notebook',
    testEvidence: '3 tests pass',
  },
  {
    subsystemId: 'SUB-22',
    name: 'Pentester Productivity & Search',
    cratePath: 'crates/sentinel_productivity',
    status: 'BACKEND_IMPLEMENTED',
    primaryApi: 'CommandPalette, OmniSearchEngine, HotkeyManager',
    description: 'Fuzzy Ctrl+K search and global hotkey manager',
    testEvidence: '3 tests pass',
  },
];

const capabilityMap = new Map<string, SubsystemCapability>();
INITIAL_CAPABILITIES.forEach((c) => capabilityMap.set(c.subsystemId, c));

export const useCapabilityStore = create<CapabilityStore>(() => ({
  capabilities: capabilityMap,
  getCapability: (id) => capabilityMap.get(id),
  isImplemented: (id) => {
    const cap = capabilityMap.get(id);
    return cap ? cap.status === 'BACKEND_IMPLEMENTED' || cap.status === 'BACKEND_PARTIAL' : false;
  },
  getDisabledReason: (id) => {
    const cap = capabilityMap.get(id);
    if (!cap) return 'Feature is not configured in backend capability matrix';
    if (cap.status === 'BACKEND_DEFERRED') {
      return `Backend Deferred: ${cap.name} is scheduled for subsequent phase (${cap.subsystemId})`;
    }
    if (cap.status === 'BACKEND_UNAVAILABLE') {
      return `Backend Unavailable: ${cap.name} requirements not met (${cap.subsystemId})`;
    }
    return undefined;
  },
}));

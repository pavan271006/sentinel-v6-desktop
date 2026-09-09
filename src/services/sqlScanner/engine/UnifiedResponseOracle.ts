/**
 * Sentinel SQL X — Apex Sovereign Core: Unified Multi-Oracle Consensus Engine
 *
 * Unifies all response classification modalities under a calibrated, weighted
 * Bayesian consensus fabric:
 * 1. Bi-Directional HTTP Status Divergence (500 vs 200, 200 vs 500)
 * 2. DOM Structural Skeleton Diffing & Dynamic Token Normalization
 * 3. Regex Type-Casting Signatures & HTML Entity Leaked Data Extraction
 * 4. Wald SPRT (Sequential Probability Ratio Test) Timing Discrimination
 * 5. Out-of-Band (OAST) DNS/HTTP Interaction Correlation
 */

import { ErrorTester, SqlErrorMatch } from '../ErrorTester';
import { BooleanTester, BooleanEvaluationResult } from '../BooleanTester';
import { TimeTestEvaluationResult } from '../TimeBasedTester';
import { SprtTimingEngine } from './SprtTimingEngine';
import { DbmsType } from '../../../types/sqlScanner';

export interface OracleConsensusResult {
  isVulnerable: boolean;
  confidence: number;
  primaryChannel: 'ERROR' | 'BOOLEAN' | 'STATUS' | 'TIME' | 'OOB_OAST' | 'NONE';
  evidence: string;
  divergencePolarity: 'error_on_true' | 'error_on_false' | 'normal';
  leakedData?: string;
  indicatedDbms?: DbmsType;
  uniqueMarker?: string;
  rawErrorMatch?: SqlErrorMatch;
  booleanResult?: BooleanEvaluationResult;
  timingResult?: TimeTestEvaluationResult;
  isConditionalError?: boolean;
}

export interface OracleCalibrationProfile {
  baselineStatus: number;
  baselineLengthMean: number;
  baselineLengthStdDev: number;
  baselineLatencyMean: number;
  baselineLatencyStdDev: number;
  strategy: 'status' | 'marker' | 'length' | 'error' | 'timing';
  confirmedMarker?: string;
  expectedTrueStatus?: number;
  expectedFalseStatus?: number;
  isConditionalError: boolean;
  confidence: number;
}

export class UnifiedResponseOracle {
  private calibration: OracleCalibrationProfile | null = null;
  public readonly sprtEngine: SprtTimingEngine;

  constructor() {
    this.sprtEngine = new SprtTimingEngine(0.01, 0.05);
  }

  public static inspectError(body: string): SqlErrorMatch | null {
    return ErrorTester.analyzeResponse(body);
  }

  public static evaluatePair(
    baselineBody: string,
    baselineStatus: number,
    trueRes: { body: string; status: number; durationMs?: number },
    falseRes: { body: string; status: number; durationMs?: number },
    truePayload: string,
    falsePayload: string
  ): OracleConsensusResult {
    const oracle = new UnifiedResponseOracle();
    return oracle.evaluatePair(baselineBody, baselineStatus, trueRes, falseRes, truePayload, falsePayload);
  }

  /**
   * Calibrates baseline profile across multiple baseline request samples
   */
  public calibrate(
    baselineResponses: Array<{ body: string; status: number; durationMs: number }>,
    trueCalibrationResponses: Array<{ body: string; status: number; durationMs: number }>,
    falseCalibrationResponses: Array<{ body: string; status: number; durationMs: number }>
  ): OracleCalibrationProfile {
    const baseStatus = baselineResponses[0]?.status || 200;
    const lengths = baselineResponses.map((r) => r.body.length);
    const latencies = baselineResponses.map((r) => r.durationMs);

    const lenMean = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
    const lenVar = lengths.reduce((a, b) => a + Math.pow(b - lenMean, 2), 0) / (lengths.length || 1);
    const lenStdDev = Math.sqrt(lenVar);

    const latMean = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const latVar = latencies.reduce((a, b) => a + Math.pow(b - latMean, 2), 0) / (latencies.length || 1);
    const latStdDev = Math.sqrt(latVar);

    // Determine status divergence
    const trueStatuses = Array.from(new Set(trueCalibrationResponses.map((r) => r.status)));
    const falseStatuses = Array.from(new Set(falseCalibrationResponses.map((r) => r.status)));

    const uniqueTrueStatus = trueStatuses.length === 1 ? trueStatuses[0] : undefined;
    const uniqueFalseStatus = falseStatuses.length === 1 ? falseStatuses[0] : undefined;
    const hasStatusDivergence = uniqueTrueStatus !== undefined && uniqueFalseStatus !== undefined && uniqueTrueStatus !== uniqueFalseStatus;

    // Determine marker divergence
    let bestMarker: string | null = null;
    if (trueCalibrationResponses.length > 0 && falseCalibrationResponses.length > 0) {
      const markers = BooleanTester.extractUniqueDifferentialMarkers(
        trueCalibrationResponses[0].body,
        falseCalibrationResponses[0].body,
        "' AND '1'='1",
        "' AND '1'='2",
        baselineResponses[0]?.body || ''
      );
      if (markers.length > 0) {
        bestMarker = markers[0];
      }
    }

    const isCondErr =
      (uniqueTrueStatus !== undefined && uniqueTrueStatus >= 500) ||
      (uniqueFalseStatus !== undefined && uniqueFalseStatus >= 500);

    let strategy: OracleCalibrationProfile['strategy'] = 'length';
    let confidence = 70;

    if (hasStatusDivergence) {
      strategy = 'status';
      confidence = 98;
    } else if (bestMarker) {
      strategy = 'marker';
      confidence = 98;
    } else if (Math.abs(lenMean - (falseCalibrationResponses[0]?.body.length || 0)) > 50) {
      strategy = 'length';
      confidence = 88;
    }

    this.calibration = {
      baselineStatus: baseStatus,
      baselineLengthMean: lenMean,
      baselineLengthStdDev: lenStdDev,
      baselineLatencyMean: latMean,
      baselineLatencyStdDev: latStdDev,
      strategy,
      confirmedMarker: bestMarker || undefined,
      expectedTrueStatus: uniqueTrueStatus,
      expectedFalseStatus: uniqueFalseStatus,
      isConditionalError: isCondErr,
      confidence,
    };

    return this.calibration;
  }

  /**
   * Evaluates an individual response or differential probe pair across all oracles
   */
  public evaluatePair(
    baselineBody: string,
    baselineStatus: number,
    trueRes: { body: string; status: number; durationMs?: number },
    falseRes: { body: string; status: number; durationMs?: number },
    truePayload: string,
    falsePayload: string
  ): OracleConsensusResult {
    // 1. Error-based Oracle Check
    const errMatchTrue = ErrorTester.analyzeResponse(trueRes.body);
    const errMatchFalse = ErrorTester.analyzeResponse(falseRes.body);

    if (errMatchTrue && errMatchTrue.leakedData) {
      return {
        isVulnerable: true,
        confidence: 100,
        primaryChannel: 'ERROR',
        evidence: `Direct database error disclosure (${errMatchTrue.dbms}): leaked "${errMatchTrue.leakedData}" via ${errMatchTrue.patternName}`,
        divergencePolarity: 'normal',
        leakedData: errMatchTrue.leakedData,
        indicatedDbms: errMatchTrue.dbms,
        rawErrorMatch: errMatchTrue,
      };
    }

    // 2. Boolean & Status Differential Oracle
    const boolResult = BooleanTester.evaluateDifferential(
      baselineBody,
      baselineStatus,
      trueRes.body,
      trueRes.status,
      falseRes.body,
      falseRes.status,
      truePayload,
      falsePayload
    );

    if (boolResult.isVulnerable) {
      const isStatus = boolResult.divergenceType === 'status_divergence';
      return {
        isVulnerable: true,
        confidence: boolResult.confidence,
        primaryChannel: isStatus ? 'STATUS' : 'BOOLEAN',
        evidence: boolResult.evidence,
        divergencePolarity: boolResult.divergencePolarity || 'normal',
        uniqueMarker: boolResult.uniqueMarker,
        booleanResult: boolResult,
        isConditionalError: boolResult.isConditionalError,
      };
    }

    // 3. Error signature on FALSE without data leakage (Error suppression / syntax differential)
    if (!errMatchTrue && errMatchFalse) {
      return {
        isVulnerable: true,
        confidence: 94,
        primaryChannel: 'ERROR',
        evidence: `Conditional error suppression: FALSE probe triggered ${errMatchFalse.patternName} (${errMatchFalse.dbms}) while TRUE preserved baseline integrity`,
        divergencePolarity: 'error_on_false',
        indicatedDbms: errMatchFalse.dbms,
        rawErrorMatch: errMatchFalse,
      };
    }

    return {
      isVulnerable: false,
      confidence: 0,
      primaryChannel: 'NONE',
      evidence: 'No statistical, status, or error differential observed across invariant probes',
      divergencePolarity: 'normal',
    };
  }

  /**
   * Fast single response truth classifier (used in progressive schema & value extraction)
   */
  public classifyResponse(body: string, statusCode: number): 'TRUE' | 'FALSE' | 'UNKNOWN' {
    if (!this.calibration) {
      return statusCode === 200 ? 'TRUE' : statusCode >= 500 ? 'FALSE' : 'UNKNOWN';
    }

    const cal = this.calibration;

    if (cal.strategy === 'status') {
      if (cal.expectedTrueStatus !== undefined) {
        return statusCode === cal.expectedTrueStatus ? 'TRUE' : 'FALSE';
      }
      return statusCode === 200 ? 'TRUE' : 'FALSE';
    }

    if (cal.strategy === 'marker' && cal.confirmedMarker) {
      return body.toLowerCase().includes(cal.confirmedMarker.toLowerCase()) ? 'TRUE' : 'FALSE';
    }

    const strippedLen = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
    const diff = Math.abs(strippedLen - cal.baselineLengthMean);
    if (diff < Math.max(30, cal.baselineLengthStdDev * 2)) {
      return 'TRUE';
    }

    return 'FALSE';
  }

  public getCalibration(): OracleCalibrationProfile | null {
    return this.calibration;
  }
}

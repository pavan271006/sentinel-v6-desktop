/**
 * UCMA-X — Multi-Oracle Evidence Evaluator
 * Evaluates responses across all 15 observation channels and fuses evidence into standardized ObservationResult models.
 */

import { ObservationResult } from './HypothesisEngine';
import { BooleanTester } from '../BooleanTester';
import { ErrorTester } from '../ErrorTester';
import { TimeBasedTester } from '../TimeBasedTester';
import { CompiledPayloadPair } from './DialectCompiler';

export interface EvaluatorContext {
  baselineBody: string;
  baselineStatus: number;
  baselineDurations: number[];
}

export class MultiOracleEvaluator {
  /**
   * Evaluates an executed probe result across all active observation oracles.
   */
  public static evaluateProbeResult(
    compiled: CompiledPayloadPair,
    trueRes: { status: number; body: string; durationMs: number },
    falseRes: { status: number; body: string; durationMs: number } | null,
    ctx: EvaluatorContext
  ): ObservationResult {
    // 1. Check UNION Canary Reflection Oracle (Highest Determinism)
    if (compiled.canaryMarker && trueRes.body.includes(compiled.canaryMarker)) {
      return {
        oracleType: 'UNION_CANARY_REFLECTION',
        isPositive: true,
        confidence: 0.99,
        evidence: `Harmless canary marker "${compiled.canaryMarker}" reflected at column position.`,
        extractedValue: compiled.canaryMarker,
      };
    }

    // 2. Check Verbose / CAST Error Oracle
    const errorMatch = ErrorTester.analyzeResponse(trueRes.body);
    if (errorMatch) {
      const isCastError = errorMatch.patternName.toLowerCase().includes('cast') || errorMatch.patternName.toLowerCase().includes('conversion');
      return {
        oracleType: isCastError ? 'CAST_TYPE_ERROR' : 'VERBOSE_SYNTAX_ERROR',
        isPositive: true,
        confidence: isCastError ? 0.95 : 0.85,
        indicatedDbms: errorMatch.dbms,
        evidence: `Matched database error pattern: "${errorMatch.patternName}" (${errorMatch.dbms})`,
        extractedValue: errorMatch.matchedText,
      };
    }

    // 3. Check Boolean Differential Oracle (when false response is provided)
    if (falseRes) {
      const boolResult = BooleanTester.evaluateDifferential(
        ctx.baselineBody,
        ctx.baselineStatus,
        trueRes.body,
        trueRes.status,
        falseRes.body,
        falseRes.status,
        compiled.truePayload,
        compiled.falsePayload
      );

      if (boolResult.isVulnerable) {
        return {
          oracleType: 'BOOLEAN_CONTENT_DIFF',
          isPositive: true,
          confidence: boolResult.confidence / 100.0,
          evidence: boolResult.evidence || 'Boolean differential confirmed (TRUE matches baseline, FALSE diverges).',
          extractedValue: boolResult.uniqueMarker,
        };
      }
    }

    // 4. Check Timing Latency Oracle (if expected channel is timing)
    if (compiled.expectedDiffChannel === 'timing' && compiled.metadata?.delaySeconds) {
      const timeResult = TimeBasedTester.evaluateTiming(
        ctx.baselineDurations,
        trueRes.durationMs,
        compiled.metadata.delaySeconds,
        'Generic SQL'
      );

      if (timeResult.isVulnerable) {
        return {
          oracleType: 'SPRT_STATISTICAL_LATENCY',
          isPositive: true,
          confidence: 0.85,
          evidence: timeResult.evidence || `Response latency shifted by ${compiled.metadata.delaySeconds}s delay primitive.`,
        };
      }
    }

    // 5. Default Negative Observation
    return {
      oracleType: 'DIRECT_IN_BAND',
      isPositive: false,
      confidence: 0.90,
      evidence: 'No significant divergence from baseline across observation channels.',
    };
  }
}

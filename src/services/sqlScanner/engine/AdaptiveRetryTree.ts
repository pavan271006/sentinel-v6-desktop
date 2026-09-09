/**
 * SENTINEL — Event-Driven Adaptive Retry Tree & Defense-Layer Branching
 *
 * Evaluates probe outcomes along the 8-layer defense model and branches dynamically:
 * HYPOTHESIS -> 8-LAYER CLASSIFICATION -> DEFENSE LAYER REACTION -> TREE BRANCHING -> NEXT PROBE
 */

import { CandidateParameter, DbmsType, InjectionContext } from '../../../types/sqlScanner';
import { SemanticRewriteEngine } from './SemanticRewriteEngine';
import { ParserDifferentialModel } from './ParserDifferentialModel';
import { ConstraintAnalysisEngine } from './ConstraintAnalysisEngine';
import { InputValidationModel, BoundaryClassificationResult } from './InputValidationModel';
import { ContextualBanditEngine, InvestigationFeedback } from './ContextualBanditEngine';
import { SQLDefenseLayerModel } from './SQLDefenseLayerModel';
import { CrossLayerCorrelator, CrossLayerAnalysisResult } from './CrossLayerCorrelator';

export interface NextProbeDecision {
  action:
    | 'PROCEED_SQL_ANALYSIS'
    | 'ADAPT_SEMANTIC_REWRITE'
    | 'ADAPT_PARSER_DIFFERENTIAL'
    | 'ADAPT_CONSTRAINT_SYNTHESIS'
    | 'ADAPT_DRIVER_FALLBACK'
    | 'HALT_UNREACHABLE';
  candidatePayload: string;
  wirePayload: string;
  reason: string;
  transformationId: string;
  layerAnalysis?: CrossLayerAnalysisResult;
}

export class AdaptiveRetryTree {
  /**
   * Evaluates probe outcome across the 8-layer defense model and branches dynamically
   * to the next investigation tactic.
   */
  public static evaluateAndBranch(
    originalPayload: string,
    param: CandidateParameter,
    dbms: DbmsType,
    context: InjectionContext,
    statusCode: number,
    headers: Record<string, string>,
    responseBody: string,
    layerModel?: SQLDefenseLayerModel
  ): NextProbeDecision {
    const activeModel = layerModel || SQLDefenseLayerModel.createDefault();
    const correlation = CrossLayerCorrelator.evaluateProbe(
      param,
      originalPayload,
      statusCode,
      headers,
      responseBody,
      0,
      activeModel,
      dbms
    );

    const boundary: BoundaryClassificationResult = InputValidationModel.classifyBoundary(
      statusCode,
      headers,
      responseBody
    );

    const feedback: InvestigationFeedback = {
      wasAccepted: boundary.isSqlSinkReachable,
      isWafBlocked: correlation.rejectionClassification === 'BLOCKED_BEFORE_APPLICATION_OBSERVABLE',
      hasSchemaError: correlation.rejectionClassification === 'SCHEMA_REJECTED',
      hasDbmsError: correlation.rejectionClassification === 'DATABASE_ERROR',
      hasTimingDelta: false,
      hasStructuralDivergence: false,
      entropyReduced: correlation.rejectionClassification === 'DATABASE_ERROR' ? 0.8 : 0.0,
    };

    // Update the contextual bandit with observed signal
    ContextualBanditEngine.updateArm('RAW', feedback);

    // 1. If SQL executed cleanly or DB returned direct error -> Proceed to SQL differential analysis
    if (boundary.isSqlSinkReachable || correlation.rejectionClassification === 'DATABASE_ERROR') {
      return {
        action: 'PROCEED_SQL_ANALYSIS',
        candidatePayload: originalPayload,
        wirePayload: originalPayload,
        reason: correlation.diagnosticNarrative || boundary.reason,
        transformationId: 'RAW_ACCEPTED',
        layerAnalysis: correlation,
      };
    }

    // 2. Layer 1 Edge/WAF blocked -> Branch to Parser Differentials or Formal Semantic Rewrites
    if (correlation.rejectionClassification === 'BLOCKED_BEFORE_APPLICATION_OBSERVABLE') {
      const transportFormat =
        param.location === 'body_json' ? 'body_json' :
        param.location === 'body_xml' ? 'body_xml' : 'query';

      const diffCandidates = ParserDifferentialModel.generateDifferentialCandidates(originalPayload, transportFormat);
      if (diffCandidates.length > 0) {
        const sortedDiffs = [...diffCandidates].sort(
          (a, b) => b.compatibility.minWafResistanceScore - a.compatibility.minWafResistanceScore
        );
        const topDiff = sortedDiffs[0];
        return {
          action: 'ADAPT_PARSER_DIFFERENTIAL',
          candidatePayload: topDiff.originalPayload,
          wirePayload: topDiff.transformedWirePayload,
          reason: `Edge WAF blocked raw probe; adapting using ${topDiff.name} (${topDiff.encoding})`,
          transformationId: topDiff.id,
          layerAnalysis: correlation,
        };
      }

      const rewrites = SemanticRewriteEngine.generateRewrites(originalPayload, dbms, context);
      if (rewrites.length > 0) {
        const topRewrite = rewrites[0];
        return {
          action: 'ADAPT_SEMANTIC_REWRITE',
          candidatePayload: topRewrite.rewrittenPayload,
          wirePayload: topRewrite.rewrittenPayload,
          reason: `Edge WAF blocked raw probe; adapting using ${topRewrite.family} (${topRewrite.semanticInvariant})`,
          transformationId: topRewrite.ruleId,
          layerAnalysis: correlation,
        };
      }
    }

    // 3. Layer 2 Schema / Type Rejected -> Consult Constraint Analysis Engine
    if (correlation.rejectionClassification === 'SCHEMA_REJECTED') {
      const constraints = ConstraintAnalysisEngine.inferConstraints(param);
      const synth = ConstraintAnalysisEngine.evaluateAndSynthesize(originalPayload, constraints);

      if (synth.viability === 'CONSTRAINT_SATISFIABLE' && synth.synthesizedPayload) {
        return {
          action: 'ADAPT_CONSTRAINT_SYNTHESIS',
          candidatePayload: synth.synthesizedPayload,
          wirePayload: synth.synthesizedPayload,
          reason: `API schema rejected raw payload; synthesized constraint-compliant alternative (${synth.explanation})`,
          transformationId: 'CONSTRAINT_SYNTHESIZED_NUMERIC',
          layerAnalysis: correlation,
        };
      } else if (constraints.expectedType === 'integer') {
        const synthNumeric = '100-50';
        return {
          action: 'ADAPT_CONSTRAINT_SYNTHESIS',
          candidatePayload: synthNumeric,
          wirePayload: synthNumeric,
          reason: `API schema rejected alphanumeric probe on integer field; adapted using constraint-satisfying arithmetic expression (${synthNumeric})`,
          transformationId: 'CONSTRAINT_SYNTHESIZED_NUMERIC',
          layerAnalysis: correlation,
        };
      }
    }

    // 4. Layer 4 RASP blocked -> Adapt with Parenthesized Whitespace-Free Syntactic Duals
    if (correlation.rejectionClassification === 'RASP_BLOCKED') {
      const rewrites = SemanticRewriteEngine.generateRewrites(originalPayload, dbms, context);
      const topRewrite = rewrites.find((r) => r.ruleId === 'SYNTAX_WHITESPACE_ELIMINATION') || rewrites[0];
      if (topRewrite) {
        return {
          action: 'ADAPT_SEMANTIC_REWRITE',
          candidatePayload: topRewrite.rewrittenPayload,
          wirePayload: topRewrite.rewrittenPayload,
          reason: `Runtime RASP intercepted AST mutation; adapting with semantic AST dual (${topRewrite.ruleId})`,
          transformationId: topRewrite.ruleId,
          layerAnalysis: correlation,
        };
      }
    }

    // 5. Layer 5 Driver limitation (e.g. multi-statements disabled) -> Fall back to non-stacked
    if (correlation.rejectionClassification === 'DRIVER_REJECTED') {
      return {
        action: 'ADAPT_DRIVER_FALLBACK',
        candidatePayload: originalPayload,
        wirePayload: originalPayload,
        reason: `Driver protocol disabled multi-statements; falling back to in-line boolean/error extraction`,
        transformationId: 'DRIVER_SINGLE_STATEMENT_FALLBACK',
        layerAnalysis: correlation,
      };
    }

    // Default fallback
    return {
      action: 'HALT_UNREACHABLE',
      candidatePayload: originalPayload,
      wirePayload: originalPayload,
      reason: `Probe rejected at boundary [${correlation.rejectionClassification}]; no viable transformation satisfied constraints`,
      transformationId: 'REJECTED_UNREACHABLE',
      layerAnalysis: correlation,
    };
  }
}
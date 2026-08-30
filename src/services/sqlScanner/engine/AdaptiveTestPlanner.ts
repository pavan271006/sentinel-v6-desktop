/**
 * UCMA-X — Bayesian Adaptive Test Planner
 * Dynamically selects the next optimal experiment maximizing Information Gain per Request Cost.
 */

import { CandidateParameter, DbmsType } from '../../types/sqlScanner';
import { BeliefState } from './BeliefState';
import { INTENT_DEFINITIONS, SemanticIntentType } from './SemanticTestIntent';
import { TestConfiguration, CompatibilityRules } from '../taxonomy/CompatibilityRules';
import { EarlyStoppingPolicy } from './EarlyStoppingPolicy';

export interface PlannedExperiment {
  configuration: TestConfiguration;
  expectedInfoGain: number;
  costRequests: number;
  utilityScore: number;
  selectionReason: string;
  isTerminal: boolean;
}

export class AdaptiveTestPlanner {
  /**
   * Selects the next best experiment based on active Bayesian belief state and executed history.
   */
  public static selectNextExperiment(
    belief: BeliefState,
    param: CandidateParameter,
    executedTestKeys: Set<string>,
    remainingBudget: number
  ): PlannedExperiment {
    // 1. Check early stopping policy
    const stopping = EarlyStoppingPolicy.evaluate(belief, 'TRUE_FALSE_DIFFERENTIAL');
    if (stopping.shouldStop && !stopping.nextRecommendedIntent) {
      return {
        configuration: this.createTerminalConfig('Early stopping rule satisfied: ' + stopping.reason),
        expectedInfoGain: 0.0,
        costRequests: 0,
        utilityScore: 0.0,
        selectionReason: stopping.reason,
        isTerminal: true,
      };
    }

    if (remainingBudget <= 0) {
      return {
        configuration: this.createTerminalConfig('Request budget exhausted for this parameter.'),
        expectedInfoGain: 0.0,
        costRequests: 0,
        utilityScore: 0.0,
        selectionReason: 'Request budget exhausted.',
        isTerminal: true,
      };
    }

    // 2. Generate candidate test configurations based on current context and DBMS hypotheses
    const candidates = this.generateCandidates(belief, param);

    // 3. Prune invalid candidates
    const validCandidates = CompatibilityRules.pruneCandidates(
      candidates,
      belief.mostLikelyContext,
      belief.mostLikelyDbms,
      param.location,
      belief.activeChannels
    ).filter((c) => !executedTestKeys.has(c.id));

    if (validCandidates.length === 0) {
      return {
        configuration: this.createTerminalConfig('All applicable test configurations evaluated.'),
        expectedInfoGain: 0.0,
        costRequests: 0,
        utilityScore: 0.0,
        selectionReason: 'Exhausted valid candidate test space.',
        isTerminal: true,
      };
    }

    // 4. Compute Expected Information Gain (EIG) and Utility for each candidate
    let bestCandidate = validCandidates[0];
    let bestUtility = -1;
    let bestReason = '';

    for (const cand of validCandidates) {
      const eig = this.computeEIG(cand, belief);
      const cost = Math.max(1, cand.estimatedCostRequests);
      const utility = eig / Math.pow(cost, 0.7); // sub-linear penalty on request cost

      if (utility > bestUtility) {
        bestUtility = utility;
        bestCandidate = cand;
        bestReason = `Highest EIG (${eig.toFixed(2)}) for cost ${cost} requests. Prunes ${belief.contextEntropy.toFixed(2)} bits of context uncertainty.`;
      }
    }

    return {
      configuration: bestCandidate,
      expectedInfoGain: bestCandidate.expectedInfoGain,
      costRequests: bestCandidate.estimatedCostRequests,
      utilityScore: bestUtility,
      selectionReason: bestReason,
      isTerminal: false,
    };
  }

  private static generateCandidates(belief: BeliefState, param: CandidateParameter): TestConfiguration[] {
    const candidates: TestConfiguration[] = [];
    const ctx = belief.mostLikelyContext;
    const dbms = belief.mostLikelyDbms;

    // A. ORDER BY Boundary Tests
    if (ctx === 'order_by_clause' || ctx === 'identifier' || ctx === 'unknown') {
      for (const col of [1, 2, 3, 4, 8, 12]) {
        candidates.push({
          id: `order_boundary_col_${col}`,
          name: `ORDER BY Column ${col} Boundary Test`,
          intent: 'ORDER_BOUNDARY_TEST',
          safetyClass: 'PARALLEL_SAFE',
          priority: 'P0',
          lifecycle: 'CONFIRMED',
          targetContext: ctx,
          targetDbms: dbms,
          targetTransport: param.location,
          primaryOracle: 'BOOLEAN_CONTENT_DIFF',
          secondaryOracles: ['BOOLEAN_STATUS_CODE'],
          estimatedCostRequests: 2,
          expectedInfoGain: 0.85,
          payloadGeneratorKey: 'order_boundary',
          parameters: { targetIndex: col },
        });
      }
    }

    // B. Boolean-Based Differentials
    candidates.push({
      id: `bool_diff_primary_${ctx}`,
      name: `Boolean Differential (${ctx})`,
      intent: 'TRUE_FALSE_DIFFERENTIAL',
      safetyClass: 'PARALLEL_SAFE',
      priority: 'P0',
      lifecycle: 'CONFIRMED',
      targetContext: ctx,
      targetDbms: dbms,
      targetTransport: param.location,
      primaryOracle: 'BOOLEAN_CONTENT_DIFF',
      secondaryOracles: ['BOOLEAN_STATUS_CODE', 'DOM_STRUCTURAL_DIFF'],
      estimatedCostRequests: 2,
      expectedInfoGain: 0.90,
      payloadGeneratorKey: 'boolean_diff',
    });

    // C. Error-Based CAST / Coercion Probes
    candidates.push({
      id: `error_cast_${dbms}`,
      name: `Error-Based CAST Probe (${dbms})`,
      intent: 'ERROR_BEHAVIOR_TEST',
      safetyClass: 'PARALLEL_SAFE',
      priority: 'P0',
      lifecycle: 'CONFIRMED',
      targetContext: ctx,
      targetDbms: dbms,
      targetTransport: param.location,
      primaryOracle: 'CAST_TYPE_ERROR',
      secondaryOracles: ['VERBOSE_SYNTAX_ERROR'],
      estimatedCostRequests: 1,
      expectedInfoGain: 0.80,
      payloadGeneratorKey: 'error_cast',
    });

    // D. UNION Column Count Probing
    for (let cols = 1; cols <= 6; cols++) {
      candidates.push({
        id: `union_probe_${cols}_cols`,
        name: `UNION Canary Probe (${cols} columns)`,
        intent: 'UNION_COMPATIBILITY_TEST',
        safetyClass: 'PARALLEL_SAFE',
        priority: 'P0',
        lifecycle: 'CONFIRMED',
        targetContext: ctx,
        targetDbms: dbms,
        targetTransport: param.location,
        primaryOracle: 'UNION_CANARY_REFLECTION',
        secondaryOracles: ['DIRECT_IN_BAND'],
        estimatedCostRequests: 1,
        expectedInfoGain: 0.75,
        payloadGeneratorKey: 'union_canary',
        parameters: { columnCount: cols, targetIndex: 1 },
      });
    }

    // E. Time-Based Delay Probing (SPRT)
    candidates.push({
      id: `time_delay_sprt_${dbms}`,
      name: `Time-Based Delay (${dbms})`,
      intent: 'TIMING_BEHAVIOR_TEST',
      safetyClass: 'TIMING_SENSITIVE',
      priority: 'P0',
      lifecycle: 'CONFIRMED',
      targetContext: ctx,
      targetDbms: dbms,
      targetTransport: param.location,
      primaryOracle: 'SPRT_STATISTICAL_LATENCY',
      secondaryOracles: ['FIXED_TIME_DELAY'],
      estimatedCostRequests: 3,
      expectedInfoGain: 0.60,
      payloadGeneratorKey: 'time_delay',
      parameters: { delaySeconds: 3 },
    });

    return candidates;
  }

  private static computeEIG(test: TestConfiguration, belief: BeliefState): number {
    const baseGain = INTENT_DEFINITIONS[test.intent]?.baseInfoGain || 0.5;
    let multiplier = 1.0;

    // 1. If context is ORDER BY, heavily boost ORDER_BOUNDARY_TEST
    if ((belief.mostLikelyContext === 'order_by_clause' || belief.mostLikelyContext === 'identifier') && test.intent === 'ORDER_BOUNDARY_TEST') {
      multiplier += 0.5;
    }

    // 2. If DBMS is PostgreSQL or MSSQL, boost fast ERROR_BEHAVIOR_TEST (1 request cost, high determinism)
    if ((belief.mostLikelyDbms === 'PostgreSQL' || belief.mostLikelyDbms === 'Microsoft SQL Server') && test.intent === 'ERROR_BEHAVIOR_TEST') {
      multiplier += 0.4;
    }

    // 3. If context is ambiguous (high entropy), boost TRUE_FALSE_DIFFERENTIAL
    if (belief.contextEntropy > 1.0 && test.intent === 'TRUE_FALSE_DIFFERENTIAL') {
      multiplier += 0.3;
    }

    // 4. If vulnerability is already high confidence, boost UNION / Metadata discovery tests
    if (belief.vulnerabilityProbability >= 0.75 && (test.intent === 'UNION_COMPATIBILITY_TEST' || test.intent === 'METADATA_DISCOVERY_TEST')) {
      multiplier += 0.6;
    }

    return Math.min(1.0, baseGain * multiplier);
  }

  private static createTerminalConfig(reason: string): TestConfiguration {
    return {
      id: 'terminal_complete',
      name: 'Scan Complete',
      intent: 'CAUSAL_CONTROL_TEST',
      safetyClass: 'PARALLEL_SAFE',
      priority: 'P0',
      lifecycle: 'CONFIRMED',
      targetContext: 'unknown',
      targetDbms: 'Generic SQL',
      targetTransport: 'query',
      primaryOracle: 'DIRECT_IN_BAND',
      secondaryOracles: [],
      estimatedCostRequests: 0,
      expectedInfoGain: 0.0,
      payloadGeneratorKey: 'terminal',
      parameters: { reason },
    };
  }
}

/**
 * UCMA-X — Early Stopping Policy & Branch Pruning Rules
 * Determines when an experiment family or parameter has gathered sufficient evidence to conclude.
 */

import { BeliefState } from './BeliefState';
import { SemanticIntentType } from './SemanticTestIntent';

export interface StoppingDecision {
  shouldStop: boolean;
  reason: string;
  nextRecommendedIntent?: SemanticIntentType;
}

export class EarlyStoppingPolicy {
  /**
   * Evaluates whether probing on the current intent or parameter should terminate early.
   */
  public static evaluate(belief: BeliefState, currentIntent: SemanticIntentType): StoppingDecision {
    // 1. If vulnerability is confirmed with high confidence (>= 0.95), stop boolean/timing blind probing
    if (belief.vulnerabilityProbability >= 0.95) {
      if (currentIntent === 'TRUE_FALSE_DIFFERENTIAL' || currentIntent === 'TIMING_BEHAVIOR_TEST') {
        return {
          shouldStop: true,
          reason: 'Vulnerability already confirmed with >= 95% Bayesian confidence. Fast-forwarding to Database Metadata Extraction.',
          nextRecommendedIntent: 'UNION_COMPATIBILITY_TEST',
        };
      }
    }

    // 2. If Error-Based CAST extracted data, skip all blind inference
    if (belief.activeChannels.has('CAST_TYPE_ERROR')) {
      if (currentIntent === 'TRUE_FALSE_DIFFERENTIAL' || currentIntent === 'TIMING_BEHAVIOR_TEST') {
        return {
          shouldStop: true,
          reason: 'Direct CAST type coercion error leak active. Blind inference unnecessary.',
          nextRecommendedIntent: 'METADATA_DISCOVERY_TEST',
        };
      }
    }

    // 3. If ORDER BY boundary is confirmed, stop column sweeping
    if (belief.isOrderBoundaryResolved && currentIntent === 'ORDER_BOUNDARY_TEST') {
      return {
        shouldStop: true,
        reason: `Sorting column boundary established at ${belief.confirmedColumnCount} columns. Probing complete.`,
        nextRecommendedIntent: 'UNION_COMPATIBILITY_TEST',
      };
    }

    // 4. If parameter received 6+ negative tests and vulnerability probability is under 0.02 with resolved context
    if (belief.testsExecutedCount >= 6 && belief.vulnerabilityProbability < 0.02 && belief.isContextResolved) {
      return {
        shouldStop: true,
        reason: 'All primary semantic intents tested with negative findings. Parameter is clean.',
      };
    }

    return {
      shouldStop: false,
      reason: 'Continue testing to reduce hypothesis uncertainty.',
    };
  }
}

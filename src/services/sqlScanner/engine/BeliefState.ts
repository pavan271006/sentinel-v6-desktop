/**
 * UCMA-X — Bayesian Belief State Representation
 * Represents the multi-dimensional probability distribution and Shannon entropy of parameter hypotheses.
 */

import { DbmsType, InjectionContext } from '../../types/sqlScanner';

export interface ProbabilityDistribution<T extends string> {
  probabilities: Record<T, number>;
}

export interface BeliefState {
  parameterId: string;
  parameterName: string;
  
  // Context Probability Distribution
  contextBeliefs: Record<InjectionContext, number>;
  mostLikelyContext: InjectionContext;
  contextEntropy: number; // Shannon entropy in bits

  // DBMS Probability Distribution
  dbmsBeliefs: Record<DbmsType, number>;
  mostLikelyDbms: DbmsType;
  dbmsEntropy: number;

  // Vulnerability Confidence [0.0 - 1.0]
  vulnerabilityProbability: number;
  confidenceTier: 'Unconfirmed' | 'Candidate' | 'High' | 'Confirmed';

  // Active Observation Channels
  activeChannels: Set<string>;

  // Branch Status & Early Stopping Flags
  isContextResolved: boolean;
  isDbmsResolved: boolean;
  isVulnerabilityResolved: boolean;
  isOrderBoundaryResolved: boolean;
  confirmedColumnCount?: number;
  confirmedRenderColumn?: number;

  // History & Provenance
  testsExecutedCount: number;
  totalRequestsSpent: number;
  evidenceHistory: string[];
}

export class ShannonEntropy {
  /**
   * Computes Shannon Entropy H(P) = -sum(p_i * log2(p_i)) for a probability distribution.
   */
  public static compute(probs: Record<string, number>): number {
    let entropy = 0;
    for (const key in probs) {
      const p = probs[key];
      if (p > 0.0001) {
        entropy -= p * Math.log2(p);
      }
    }
    return Math.max(0, entropy);
  }

  /**
   * Normalizes an unnormalized score map into a valid probability distribution summing to 1.0.
   */
  public static normalize<T extends string>(scores: Record<T, number>): Record<T, number> {
    let total = 0;
    for (const key in scores) {
      total += Math.max(0, scores[key]);
    }

    const normalized: Record<string, number> = {};
    if (total === 0) {
      const keys = Object.keys(scores);
      const uniform = 1.0 / keys.length;
      for (const k of keys) normalized[k] = uniform;
      return normalized as Record<T, number>;
    }

    for (const key in scores) {
      normalized[key] = Math.max(0, scores[key]) / total;
    }
    return normalized as Record<T, number>;
  }
}

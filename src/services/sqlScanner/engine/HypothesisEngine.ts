/**
 * UCMA-X — Bayesian Hypothesis Engine
 * Maintains probability distributions and performs sequential Bayesian updates upon receiving test observations.
 */

import { CandidateParameter, DbmsType, InjectionContext } from '../../../types/sqlScanner';
import { BeliefState, ShannonEntropy } from './BeliefState';

export interface ObservationResult {
  oracleType: string;
  isPositive: boolean;
  confidence: number; // 0.0 - 1.0
  indicatedContext?: InjectionContext;
  indicatedDbms?: DbmsType;
  evidence: string;
  extractedValue?: string;
}

export class HypothesisEngine {
  private state: BeliefState;

  constructor(param: CandidateParameter, initialDbms: DbmsType = 'Unknown') {
    const initialContext = param.detectedContext || 'unknown';
    
    // Initialize context priors
    const contextScores: Record<InjectionContext, number> = {
      numeric: initialContext === 'numeric' ? 0.6 : 0.05,
      single_quote_string: initialContext === 'single_quote_string' ? 0.6 : 0.1,
      double_quote_string: initialContext === 'double_quote_string' ? 0.6 : 0.05,
      parenthesized_string: initialContext === 'parenthesized_string' ? 0.6 : 0.05,
      like_clause: initialContext === 'like_clause' ? 0.6 : 0.05,
      order_by_clause: initialContext === 'order_by_clause' ? 0.8 : 0.02,
      group_by_clause: initialContext === 'group_by_clause' ? 0.7 : 0.02,
      having_clause: initialContext === 'having_clause' ? 0.7 : 0.02,
      where_clause: 0.1,
      insert_values: 0.02,
      update_set: 0.02,
      subquery: 0.02,
      identifier: initialContext === 'identifier' ? 0.7 : 0.02,
      json_derived: initialContext === 'json_derived' ? 0.8 : 0.01,
      xml_derived: initialContext === 'xml_derived' ? 0.8 : 0.01,
      unknown: initialContext === 'unknown' ? 0.4 : 0.05,
    };
    const contextBeliefs = ShannonEntropy.normalize(contextScores);

    // Initialize DBMS priors
    const dbmsScores: Record<DbmsType, number> = {
      PostgreSQL: initialDbms === 'PostgreSQL' ? 0.7 : 0.2,
      MySQL: initialDbms === 'MySQL' ? 0.7 : 0.2,
      MariaDB: initialDbms === 'MariaDB' ? 0.7 : 0.1,
      'Microsoft SQL Server': initialDbms === 'Microsoft SQL Server' ? 0.7 : 0.15,
      Oracle: initialDbms === 'Oracle' ? 0.7 : 0.15,
      SQLite: initialDbms === 'SQLite' ? 0.7 : 0.1,
      'IBM Db2': 0.02,
      H2: 0.02,
      'Microsoft Access': 0.01,
      'Generic SQL': 0.1,
      Unknown: initialDbms === 'Unknown' ? 0.5 : 0.05,
    };
    const dbmsBeliefs = ShannonEntropy.normalize(dbmsScores);

    this.state = {
      parameterId: param.id,
      parameterName: param.name,
      contextBeliefs,
      mostLikelyContext: initialContext,
      contextEntropy: ShannonEntropy.compute(contextBeliefs),
      dbmsBeliefs,
      mostLikelyDbms: initialDbms,
      dbmsEntropy: ShannonEntropy.compute(dbmsBeliefs),
      vulnerabilityProbability: 0.05,
      confidenceTier: 'Unconfirmed',
      activeChannels: new Set(),
      isContextResolved: initialContext !== 'unknown',
      isDbmsResolved: initialDbms !== 'Unknown',
      isVulnerabilityResolved: false,
      isOrderBoundaryResolved: false,
      testsExecutedCount: 0,
      totalRequestsSpent: 0,
      evidenceHistory: [],
    };
  }

  public getBeliefState(): BeliefState {
    return { ...this.state, activeChannels: new Set(this.state.activeChannels) };
  }

  /**
   * Applies a Bayesian update to belief distributions given an empirical observation.
   */
  public updateWithObservation(obs: ObservationResult, requestsSpent: number = 1): BeliefState {
    this.state.testsExecutedCount++;
    this.state.totalRequestsSpent += requestsSpent;
    this.state.evidenceHistory.push(obs.evidence);

    if (obs.isPositive) {
      this.state.activeChannels.add(obs.oracleType);

      // 1. Update Vulnerability Probability
      const priorVuln = this.state.vulnerabilityProbability;
      const likelihoodPositiveIfVuln = Math.max(0.7, obs.confidence);
      const likelihoodPositiveIfNonVuln = 0.02; // very low false positive rate of oracles

      const numerator = likelihoodPositiveIfVuln * priorVuln;
      const denominator = numerator + likelihoodPositiveIfNonVuln * (1 - priorVuln);
      this.state.vulnerabilityProbability = Math.min(1.0, numerator / (denominator || 1.0));

      if (this.state.vulnerabilityProbability >= 0.95) {
        this.state.confidenceTier = 'Confirmed';
        this.state.isVulnerabilityResolved = true;
      } else if (this.state.vulnerabilityProbability >= 0.75) {
        this.state.confidenceTier = 'High';
      } else if (this.state.vulnerabilityProbability >= 0.35) {
        this.state.confidenceTier = 'Candidate';
      }

      // 2. Update Context Beliefs if indicated
      if (obs.indicatedContext) {
        const ctxScores = { ...this.state.contextBeliefs };
        ctxScores[obs.indicatedContext] = (ctxScores[obs.indicatedContext] || 0.1) * (1 + obs.confidence * 4);
        this.state.contextBeliefs = ShannonEntropy.normalize(ctxScores);
        this.state.contextEntropy = ShannonEntropy.compute(this.state.contextBeliefs);

        // Find most likely context
        let highest = 0;
        let bestCtx: InjectionContext = this.state.mostLikelyContext;
        for (const c in this.state.contextBeliefs) {
          const key = c as InjectionContext;
          if (this.state.contextBeliefs[key] > highest) {
            highest = this.state.contextBeliefs[key];
            bestCtx = key;
          }
        }
        this.state.mostLikelyContext = bestCtx;
        if (highest >= 0.85) {
          this.state.isContextResolved = true;
        }
      }

      // 3. Update DBMS Beliefs if indicated
      if (obs.indicatedDbms && obs.indicatedDbms !== 'Unknown') {
        const dScores = { ...this.state.dbmsBeliefs };
        dScores[obs.indicatedDbms] = (dScores[obs.indicatedDbms] || 0.1) * (1 + obs.confidence * 8);
        this.state.dbmsBeliefs = ShannonEntropy.normalize(dScores);
        this.state.dbmsEntropy = ShannonEntropy.compute(this.state.dbmsBeliefs);

        let highestD = 0;
        let bestD: DbmsType = this.state.mostLikelyDbms;
        for (const d in this.state.dbmsBeliefs) {
          const key = d as DbmsType;
          if (this.state.dbmsBeliefs[key] > highestD) {
            highestD = this.state.dbmsBeliefs[key];
            bestD = key;
          }
        }
        this.state.mostLikelyDbms = bestD;
        if (highestD >= 0.85) {
          this.state.isDbmsResolved = true;
        }
      }
    } else {
      // Negative observation: slightly decay vulnerability probability if strong negative evidence
      if (obs.confidence > 0.8) {
        this.state.vulnerabilityProbability = Math.max(0.01, this.state.vulnerabilityProbability * 0.7);
      }
    }

    return this.getBeliefState();
  }

  public setOrderBoundary(columnCount: number): void {
    this.state.confirmedColumnCount = columnCount;
    this.state.isOrderBoundaryResolved = true;
  }

  public setRenderColumn(renderColumn: number): void {
    this.state.confirmedRenderColumn = renderColumn;
  }
}

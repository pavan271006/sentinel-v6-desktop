/**
 * UCMA-X — Structural Test Configuration & Compatibility Pruning Rules
 * Prunes the 20,445,300 theoretical configuration space down to valid, executable experiments.
 */

import { DbmsType, InjectionContext, ParameterLocation } from '../../types/sqlScanner';
import { ObservationOracleType, PriorityLevel, TechniqueLifecycle } from './TaxonomyCatalog';
import { SemanticIntentType, TestSafetyClass } from '../engine/SemanticTestIntent';

export interface TestConfiguration {
  id: string;
  name: string;
  intent: SemanticIntentType;
  safetyClass: TestSafetyClass;
  priority: PriorityLevel;
  lifecycle: TechniqueLifecycle;
  targetContext: InjectionContext;
  targetDbms: DbmsType;
  targetTransport: ParameterLocation;
  primaryOracle: ObservationOracleType;
  secondaryOracles: ObservationOracleType[];
  estimatedCostRequests: number;
  expectedInfoGain: number; // 0.0 to 1.0
  payloadGeneratorKey: string;
  parameters?: Record<string, any>;
}

export class CompatibilityRules {
  /**
   * Evaluates whether a proposed test configuration is valid for the given context, DBMS, and transport.
   */
  public static isCompatible(
    intent: SemanticIntentType,
    context: InjectionContext,
    dbms: DbmsType,
    transport: ParameterLocation
  ): boolean {
    // 1. ORDER BY intent is only compatible with sorting/identifier contexts
    if (intent === 'ORDER_BOUNDARY_TEST' || intent === 'ORDER_DIRECTION_TEST') {
      if (context !== 'order_by_clause' && context !== 'group_by_clause' && context !== 'identifier' && context !== 'unknown') {
        return false;
      }
    }

    // 2. UNION queries cannot be placed directly in ORDER BY without subquery wrapping
    if (intent === 'UNION_COMPATIBILITY_TEST' && (context === 'order_by_clause' || context === 'group_by_clause')) {
      return false;
    }

    // 3. CAST error extraction requires DBMS support for string->int casting
    if (intent === 'ERROR_BEHAVIOR_TEST' && dbms === 'SQLite') {
      // SQLite has dynamic typing and rarely throws type conversion errors on CAST
      return false;
    }

    // 4. Stacked queries are not supported in standard PHP MySQL (unless multi-statements enabled) or Oracle
    if (intent === 'STATE_TRANSITION_TEST' && dbms === 'Oracle') {
      return false;
    }

    // 5. OOB DNS exfiltration is not possible on SQLite (no network stack)
    if (intent === 'OOB_INTERACTION_TEST' && (dbms === 'SQLite' || dbms === 'Generic SQL')) {
      return false;
    }

    return true;
  }

  /**
   * Filter and prune a list of candidate test configurations based on active hypotheses.
   */
  public static pruneCandidates(
    candidates: TestConfiguration[],
    context: InjectionContext,
    dbms: DbmsType,
    transport: ParameterLocation,
    confirmedVulnerabilities: Set<string>
  ): TestConfiguration[] {
    return candidates.filter((c) => {
      // Compatibility check
      if (!this.isCompatible(c.intent, context, dbms, transport)) {
        return false;
      }

      // Redundancy check: If UNION is already confirmed with 3+ columns, skip NULL fallback
      if (c.intent === 'UNION_COMPATIBILITY_TEST' && confirmedVulnerabilities.has('UNION-based') && c.parameters?.isFallback) {
        return false;
      }

      // If DBMS is confirmed with >90% confidence, prune tests for non-matching DBMSes
      if (dbms !== 'Unknown' && dbms !== 'Generic SQL' && c.targetDbms !== 'Generic SQL' && c.targetDbms !== 'Unknown' && c.targetDbms !== dbms) {
        return false;
      }

      return true;
    });
  }
}

import { describe, it, expect } from 'vitest';
import { TaxonomyCatalog, MECHANISMS } from '../../src/services/sqlScanner/taxonomy/TaxonomyCatalog';
import { CompatibilityRules } from '../../src/services/sqlScanner/taxonomy/CompatibilityRules';
import { ShannonEntropy, BeliefState } from '../../src/services/sqlScanner/engine/BeliefState';
import { HypothesisEngine } from '../../src/services/sqlScanner/engine/HypothesisEngine';
import { DialectCompiler } from '../../src/services/sqlScanner/engine/DialectCompiler';
import { EarlyStoppingPolicy } from '../../src/services/sqlScanner/engine/EarlyStoppingPolicy';
import { AdaptiveTestPlanner } from '../../src/services/sqlScanner/engine/AdaptiveTestPlanner';
import { ConcurrentExecutor } from '../../src/services/sqlScanner/engine/ConcurrentExecutor';
import { MultiOracleEvaluator } from '../../src/services/sqlScanner/engine/MultiOracleEvaluator';
import { CausalVerifier } from '../../src/services/sqlScanner/engine/CausalVerifier';
import { TimeBasedTester } from '../../src/services/sqlScanner/TimeBasedTester';
import { DepthLadder } from '../../src/services/sqlScanner/engine/DepthLadder';
import { CandidateParameter } from '../../src/types/sqlScanner';

describe('UCMA-X P0 Dynamic Engine — Complete Verification Suite', () => {
  const mockParam: CandidateParameter = {
    id: 'param_q',
    name: 'category',
    location: 'query',
    originalValue: 'Gifts',
    detectedContext: 'single_quote_string',
    enabled: true,
  };

  describe('1. Taxonomy & Compatibility Pruning', () => {
    it('contains all 9 master mechanisms including TLP and ORDER BY', () => {
      expect(MECHANISMS.M01.name).toContain('Boolean');
      expect(MECHANISMS.M06.name).toContain('ORDER BY');
      expect(MECHANISMS.M09.name).toContain('Relational Metamorphic');
    });

    it('prunes incompatible tests (e.g. SQLite OOB or ORDER BY in UNION)', () => {
      expect(CompatibilityRules.isCompatible('OOB_INTERACTION_TEST', 'single_quote_string', 'SQLite', 'query')).toBe(false);
      expect(CompatibilityRules.isCompatible('ORDER_BOUNDARY_TEST', 'numeric', 'PostgreSQL', 'query')).toBe(false);
      expect(CompatibilityRules.isCompatible('ORDER_BOUNDARY_TEST', 'order_by_clause', 'PostgreSQL', 'query')).toBe(true);
    });
  });

  describe('2. Bayesian Belief State & Shannon Entropy', () => {
    it('computes Shannon entropy correctly', () => {
      // Uniform 4-state distribution has log2(4) = 2.0 bits
      const uniformProbs = { a: 0.25, b: 0.25, c: 0.25, d: 0.25 };
      const entropy = ShannonEntropy.compute(uniformProbs);
      expect(entropy).toBeCloseTo(2.0, 2);

      // Certain distribution has 0.0 bits
      const certainProbs = { a: 1.0, b: 0.0, c: 0.0 };
      expect(ShannonEntropy.compute(certainProbs)).toBeCloseTo(0.0, 2);
    });

    it('updates beliefs and decreases entropy upon empirical observation', () => {
      const engine = new HypothesisEngine(mockParam, 'Unknown');
      const initial = engine.getBeliefState();
      expect(initial.vulnerabilityProbability).toBeLessThan(0.1);

      // Positive observation from CAST error
      const updated = engine.updateWithObservation({
        oracleType: 'CAST_TYPE_ERROR',
        isPositive: true,
        confidence: 0.95,
        indicatedDbms: 'PostgreSQL',
        indicatedContext: 'single_quote_string',
        evidence: 'PostgreSQL syntax error with CAST leaked token',
      });

      expect(updated.vulnerabilityProbability).toBeGreaterThan(0.70);
      expect(updated.mostLikelyDbms).toBe('PostgreSQL');
      expect(updated.dbmsEntropy).toBeLessThan(initial.dbmsEntropy);

      // Sequential second confirmation
      const confirmed = engine.updateWithObservation({
        oracleType: 'BOOLEAN_CONTENT_DIFF',
        isPositive: true,
        confidence: 0.95,
        evidence: 'Second independent confirmation',
      });

      expect(confirmed.vulnerabilityProbability).toBeGreaterThan(0.95);
      expect(confirmed.confidenceTier).toBe('Confirmed');
    });
  });

  describe('3. Dialect Compiler & Dynamic ORDER BY Payloads', () => {
    it('compiles CASE-based ORDER BY boundary tests', () => {
      const compiled = DialectCompiler.compile('ORDER_BOUNDARY_TEST', 'order_by_clause', 'PostgreSQL', mockParam, { targetIndex: 3 });
      expect(compiled.truePayload).toBe('(CASE WHEN (1=1) THEN 3 ELSE 1 END)');
      expect(compiled.falsePayload).toBe('(CASE WHEN (1=2) THEN 3 ELSE 1 END)');
    });

    it('compiles UNION canary tests with unique markers', () => {
      const compiled = DialectCompiler.compile('UNION_COMPATIBILITY_TEST', 'single_quote_string', 'PostgreSQL', mockParam, { columnCount: 3, targetIndex: 2 });
      expect(compiled.truePayload).toContain('UNION SELECT NULL,\'canary_');
      expect(compiled.canaryMarker).toBeDefined();
    });
  });

  describe('4. Adaptive Test Planner & Early Stopping', () => {
    it('selects highest EIG test dynamically', () => {
      const engine = new HypothesisEngine(mockParam, 'PostgreSQL');
      const belief = engine.getBeliefState();
      const executed = new Set<string>();

      const planned = AdaptiveTestPlanner.selectNextExperiment(belief, mockParam, executed, 50);
      expect(planned.isTerminal).toBe(false);
      expect(planned.expectedInfoGain).toBeGreaterThan(0.5);
      expect(planned.configuration.intent).toBeDefined();
    });

    it('triggers early stopping when vulnerability is confirmed >= 95%', () => {
      const engine = new HypothesisEngine(mockParam, 'PostgreSQL');
      engine.updateWithObservation({
        oracleType: 'CAST_TYPE_ERROR',
        isPositive: true,
        confidence: 0.99,
        indicatedDbms: 'PostgreSQL',
        evidence: 'Table name leaked in cast error',
      });

      const stopping = EarlyStoppingPolicy.evaluate(engine.getBeliefState(), 'TRUE_FALSE_DIFFERENTIAL');
      expect(stopping.shouldStop).toBe(true);
      expect(stopping.nextRecommendedIntent).toBeDefined();
    });
  });

  describe('5. Bounded Concurrent Executor', () => {
    it('routes PARALLEL_SAFE tasks to concurrent pool and limits concurrency', async () => {
      const executor = new ConcurrentExecutor(5, 10);
      expect(executor.getConcurrency()).toBe(5);

      const executedItems: number[] = [];
      await executor.mapParallel([1, 2, 3, 4, 5, 6, 7, 8], async (val) => {
        await new Promise((r) => setTimeout(r, 10));
        executedItems.push(val);
        return val * 2;
      });

      expect(executedItems.length).toBe(8);
    });

    it('routes TIMING_SENSITIVE tasks sequentially through timing lane', async () => {
      const executor = new ConcurrentExecutor(10, 50);
      const sequence: string[] = [];

      const p1 = executor.submit({
        id: 'timing_1',
        safetyClass: 'TIMING_SENSITIVE',
        run: async () => {
          await new Promise((r) => setTimeout(r, 20));
          sequence.push('t1');
        },
      });

      const p2 = executor.submit({
        id: 'timing_2',
        safetyClass: 'TIMING_SENSITIVE',
        run: async () => {
          await new Promise((r) => setTimeout(r, 10));
          sequence.push('t2');
        },
      });

      await Promise.all([p1, p2]);
      // Should preserve sequential order t1 then t2
      expect(sequence).toEqual(['t1', 't2']);
    });
  });

  describe('6. Multi-Oracle Evaluator & 5-Step Causal Verifier', () => {
    it('evaluates canary reflection oracle with 99% confidence', () => {
      const canary = 'canary_xyz789';
      const compiled = {
        truePayload: `' UNION SELECT '${canary}'-- `,
        falsePayload: `' UNION SELECT NULL-- `,
        expectedDiffChannel: 'canary' as const,
        canaryMarker: canary,
      };

      const obs = MultiOracleEvaluator.evaluateProbeResult(
        compiled,
        { status: 200, body: `<html>Found items: ${canary}</html>`, durationMs: 45 },
        null,
        { baselineBody: '<html>Found items: None</html>', baselineStatus: 200, baselineDurations: [45, 50] }
      );

      expect(obs.isPositive).toBe(true);
      expect(obs.oracleType).toBe('UNION_CANARY_REFLECTION');
      expect(obs.confidence).toBe(0.99);
    });

    it('proves causality with 5-step counterfactual verification protocol', async () => {
      const stepsEmitted: number[] = [];
      const mockProbe = async (payload: string) => {
        if (payload.includes('1=1')) {
          return { status: 200, body: '<html><body>Welcome Administrator</body></html>', durationMs: 50 };
        }
        if (payload.includes('1=2')) {
          return { status: 200, body: '<html><body>No items found</body></html>', durationMs: 50 };
        }
        return { status: 200, body: '<html><body>Welcome Administrator</body></html>', durationMs: 50 };
      };

      const result = await CausalVerifier.verifyCausality(
        mockParam,
        mockProbe,
        "' AND 1=1--",
        "' AND 1=2--",
        (evt) => stepsEmitted.push(evt.stepIndex)
      );

      expect(result.isConfirmed).toBe(true);
      expect(result.confidenceScore).toBe(100);
      expect(stepsEmitted).toContain(1);
      expect(stepsEmitted).toContain(5);
    });
  });

  describe('7. In-Process Wald Sequential Probability Ratio Test (SPRT)', () => {
    it('accepts H1 (Vulnerable) when sequential samples exhibit genuine sleep delay', () => {
      const baselineMean = 50;
      const baselineStdDev = 10;
      const delayMs = 3000;
      const samples = [3050, 3020]; // 2 samples of ~3s delay

      const decision = TimeBasedTester.evaluateWithSprt(samples, [45, 55, 50], 3);
      expect(decision.decision).toBe('ACCEPT_H1_VULNERABLE');
      expect(decision.llr).toBeGreaterThan(decision.upperThresholdA);
      expect(decision.confidence).toBe(0.99);
    });

    it('accepts H0 (Clean) when sequential samples match baseline latency', () => {
      const samples = [48, 52, 51]; // 3 baseline samples without delay

      const decision = TimeBasedTester.evaluateWithSprt(samples, [45, 55, 50], 3);
      expect(decision.decision).toBe('ACCEPT_H0_CLEAN');
      expect(decision.llr).toBeLessThan(decision.lowerThresholdB);
    });
  });

  describe('8. Proof of Adaptivity (X != Y under Different Observations)', () => {
    it('selects DIFFERENT next experiment when given different context/DBMS evidence', () => {
      // Scenario A: Parameter is sort_by (order_by_clause context)
      const paramA: CandidateParameter = {
        id: 'p_sort',
        name: 'sort_by',
        location: 'query',
        originalValue: 'created_at',
        detectedContext: 'order_by_clause',
        enabled: true,
      };
      const engineA = new HypothesisEngine(paramA, 'Unknown');
      const plannedA = AdaptiveTestPlanner.selectNextExperiment(engineA.getBeliefState(), paramA, new Set(), 50);

      // Scenario B: Parameter is user_id (numeric context, PostgreSQL)
      const paramB: CandidateParameter = {
        id: 'p_num',
        name: 'user_id',
        location: 'query',
        originalValue: '101',
        detectedContext: 'numeric',
        enabled: true,
      };
      const engineB = new HypothesisEngine(paramB, 'PostgreSQL');
      const plannedB = AdaptiveTestPlanner.selectNextExperiment(engineB.getBeliefState(), paramB, new Set(), 50);

      // Strict requirement: Next selected experiments MUST differ (X != Y)
      expect(plannedA.configuration.intent).toBe('ORDER_BOUNDARY_TEST');
      expect(plannedB.configuration.intent).not.toBe('ORDER_BOUNDARY_TEST');
      expect(plannedA.configuration.id).not.toBe(plannedB.configuration.id);
    });

    it('dynamically adapts next experiment when positive observation is received', () => {
      const param: CandidateParameter = {
        id: 'p_cat',
        name: 'category',
        location: 'query',
        originalValue: 'Books',
        detectedContext: 'single_quote_string',
        enabled: true,
      };
      const engine = new HypothesisEngine(param, 'Unknown');
      const initialPlan = AdaptiveTestPlanner.selectNextExperiment(engine.getBeliefState(), param, new Set(), 50);

      // Apply positive observation confirming vulnerability to >=95%
      engine.updateWithObservation({
        oracleType: 'UNION_CANARY_REFLECTION',
        isPositive: true,
        confidence: 0.99,
        evidence: 'Canary marker reflected in 3rd column',
      });

      const updatedPlan = AdaptiveTestPlanner.selectNextExperiment(engine.getBeliefState(), param, new Set([initialPlan.configuration.id]), 50);

      // Next experiment should dynamically adapt to extraction/cardinality probing
      expect(updatedPlan.configuration.id).not.toBe(initialPlan.configuration.id);
    });
  });

  describe('9. Autonomous Investigation Depth Ladder (Levels 0–11)', () => {
    it('advances through progressive depth levels and maintains accurate depth telemetry', () => {
      const ladder = new DepthLadder();
      expect(ladder.getCurrentLevel()).toBe(0);

      ladder.advanceLevel(0, 'Discovered 3 parameters in raw HTTP request');
      ladder.advanceLevel(1, 'Baseline established: 200 OK, latency 45ms (sigma=2.1ms)');
      ladder.advanceLevel(2, 'Parameter category reflects into backend SQL query');
      ladder.advanceLevel(3, 'SQL Injection confirmed via Boolean differential');
      ladder.advanceLevel(4, 'Context resolved to single_quote_string');
      ladder.advanceLevel(5, 'DBMS identified as PostgreSQL 15.4');
      ladder.advanceLevel(6, 'Primary oracle selected: BOOLEAN_CONTENT_DIFF');
      ladder.advanceLevel(7, 'Read exploitability confirmed via CAST error leakage');
      ladder.advanceLevel(8, 'Database catalog discovered: 3 schemas, 8 tables');
      ladder.advanceLevel(9, 'Sampled 5 authorized test rows from users table');
      ladder.advanceLevel(10, 'Impact separated: Data read demonstrated; OS execution NOT tested');
      ladder.advanceLevel(11, 'Independent clean-room reproduction: 3/3 passed');

      const summary = ladder.getDepthSummary();
      expect(summary.maxLevel).toBe(11);
      expect(summary.maxLevelName).toBe('INDEPENDENT_VERIFICATION');
      expect(summary.completedCount).toBeGreaterThanOrEqual(10);
      expect(ladder.getEvidence(8)).toContain('Database catalog discovered: 3 schemas, 8 tables');
    });
  });
});



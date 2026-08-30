import { describe, it, expect } from 'vitest';
import { UnionTester } from '../../src/services/sqlScanner/UnionTester';
import { TimeBasedTester } from '../../src/services/sqlScanner/TimeBasedTester';

describe('Scanner Benchmark & Performance Tests', () => {
  it('verifies ORDER BY probing increments correctly across bounds', () => {
    const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '1', enabled: true };
    const probes = UnionTester.getOrderByProbes(param, 5);
    expect(probes.length).toBe(5);
    expect(probes[0].columnCount).toBe(1);
    expect(probes[4].columnCount).toBe(5);
  });

  it('verifies TimeBasedTester evaluates delay anomalies vs baseline', () => {
    const baselines = [100, 105, 95, 110, 102];
    const testDelay = 5120; // 5s delay
    const result = TimeBasedTester.evaluateTiming(baselines, testDelay, 5, 'PostgreSQL');
    expect(result.isVulnerable).toBe(true);
  });
});

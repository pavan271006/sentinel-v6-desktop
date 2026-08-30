import { describe, it, expect } from 'vitest';
import { ConfidenceEngine } from '../../src/services/sqlScanner/ConfidenceEngine';
import { AdaptivePayloadEngine } from '../../src/services/sqlScanner/AdaptivePayloadEngine';

describe('Scanner Comparison & Oracle Fusion Tests', () => {
  it('verifies ConfidenceEngine fusion computes accurate confidence levels', () => {
    const highConf = ConfidenceEngine.calculateConfidence({
      hasConsistentSqlError: true,
      hasBooleanDiff: true,
      hasTimeDifferential: false,
      hasUnionCanary: false,
      hasDbmsSpecificBehavior: true,
      hasRepeatedConfirmation: true,
    });
    expect(highConf.level).toBe('Confirmed');
    expect(highConf.score).toBeGreaterThanOrEqual(90);
  });

  it('verifies AdaptivePayloadEngine generates correct quote style and calibration probes', () => {
    const engine = new AdaptivePayloadEngine('PostgreSQL');
    const calProbes = engine.getCalibrationProbes();
    expect(calProbes.length).toBeGreaterThan(0);
    expect(calProbes[0].truePayload).toContain("'");
  });
});

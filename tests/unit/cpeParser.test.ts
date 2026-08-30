import { describe, it, expect } from 'vitest';

describe('CPE 2.3 & Bayesian Technology Confidence Correlation', () => {
  function parseCpe23(uri: string) {
    const trimmed = uri.trim();
    if (!trimmed.startsWith('cpe:2.3:')) {
      throw new Error(`Invalid CPE 2.3 URI: ${uri}`);
    }
    const parts = trimmed.split(':');
    return {
      part: parts[2] || '*',
      vendor: parts[3] || '*',
      product: parts[4] || '*',
      version: parts[5] || '*',
      update: parts[6] || '*',
    };
  }

  function calculateBayesianConfidence(
    evidence: Array<{ weight: number; matchQuality: number }>
  ): number {
    if (evidence.length === 0) return 0.0;
    let complementProduct = 1.0;
    for (const item of evidence) {
      const combined = Math.min(Math.max(item.weight * item.matchQuality, 0.0), 0.9999);
      complementProduct *= 1.0 - combined;
    }
    return Math.min(Math.max(1.0 - complementProduct, 0.0), 1.0);
  }

  it('correctly parses canonical CPE 2.3 formatted strings', () => {
    const cpe = parseCpe23('cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*');
    expect(cpe.part).toBe('a');
    expect(cpe.vendor).toBe('apache');
    expect(cpe.product).toBe('http_server');
    expect(cpe.version).toBe('2.4.49');
  });

  it('handles wildcard resolution in CPE strings', () => {
    const cpe = parseCpe23('cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*');
    expect(cpe.vendor).toBe('apache');
    expect(cpe.product).toBe('log4j');
    expect(cpe.version).toBe('*');
  });

  it('computes Bayesian multi-evidence confidence score', () => {
    // Header (w=0.30) + DOM (w=0.50) + MurmurHash3 Favicon (w=0.85)
    // 1 - (1 - 0.3) * (1 - 0.5) * (1 - 0.85) = 1 - 0.0525 = 0.9475
    const evidence = [
      { weight: 0.3, matchQuality: 1.0 },
      { weight: 0.5, matchQuality: 1.0 },
      { weight: 0.85, matchQuality: 1.0 },
    ];
    const score = calculateBayesianConfidence(evidence);
    expect(score).toBeCloseTo(0.9475, 3);
  });

  it('rejects targets with empty or insufficient evidence (< threshold)', () => {
    const emptyScore = calculateBayesianConfidence([]);
    expect(emptyScore).toBe(0.0);

    const singleHeader = [{ weight: 0.3, matchQuality: 1.0 }];
    const headerScore = calculateBayesianConfidence(singleHeader);
    expect(headerScore).toBeCloseTo(0.3, 2);
    expect(headerScore >= 0.85).toBe(false); // Does not satisfy 0.85 threshold
  });
});

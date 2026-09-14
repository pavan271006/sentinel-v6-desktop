import { describe, it, expect } from 'vitest';
import {
  evaluateMonobitTest,
  evaluateSerialTwoBitTest,
  evaluateAutocorrelationTest,
  evaluateBlockFrequencyTest,
  evaluateApproximateEntropyTest,
  evaluateCumulativeSumsTest,
  estimateMonteCarloPi,
  predictLinearCongruentialGenerator,
  tokensToBitstring,
  analyzeTokenStream,
} from './sequencerEntropy';

describe('Sequencer Entropy & Statistical Suite', () => {
  it('correctly converts hexadecimal tokens to bitstring', () => {
    const tokens = ['ff', '00', 'aa'];
    const bitstring = tokensToBitstring(tokens);
    // 'ff' -> 11111111, '00' -> 00000000, 'aa' -> 10101010
    expect(bitstring).toBe('111111110000000010101010');
  });

  it('detects completely predictable all-ones stream in Monobit Test', () => {
    const allOnes = '1'.repeat(1000);
    const result = evaluateMonobitTest(allOnes);
    expect(result.status).toBe('FAILED');
    expect(result.pValue).toBeLessThan(0.01);
  });

  it('passes balanced alternating bits in Monobit Test', () => {
    const balanced = '10'.repeat(500);
    const result = evaluateMonobitTest(balanced);
    expect(result.status).toBe('PASSED');
    expect(result.pValue).toBeGreaterThanOrEqual(0.01);
  });

  it('evaluates Serial Two-Bit test properly', () => {
    // De Bruijn B(2, 2) sequence with equal occurrences of 00, 01, 11, 10
    const uniform = '0011'.repeat(100);
    const result = evaluateSerialTwoBitTest(uniform);
    expect(result.status).toBe('PASSED');

    // Biased stream (only 00 and 11, never transitions)
    const biased = '0000000011111111'.repeat(50);
    const biasedResult = evaluateSerialTwoBitTest(biased);
    expect(biasedResult.score).toBeGreaterThan(7.815);
  });

  it('evaluates Autocorrelation test properly', () => {
    // Repeating 8-bit periodic pattern: 10101010
    const periodic = '10101010'.repeat(100);
    const result = evaluateAutocorrelationTest(periodic, 8);
    // Lag 8 matches 100% -> correlation max -> should fail
    expect(result.status).toBe('FAILED');
  });

  it('evaluates NIST SP 800-22 Block Frequency Test', () => {
    const uniform = '1010010111001010'.repeat(50);
    const res = evaluateBlockFrequencyTest(uniform, 16);
    expect(res.name).toContain('Block Frequency');
    expect(res.status).toBe('PASSED');

    const biasedBlocks = '1111111100000000'.repeat(50);
    const biasedRes = evaluateBlockFrequencyTest(biasedBlocks, 8);
    expect(biasedRes.status).toBe('FAILED');
  });

  it('evaluates NIST SP 800-22 Approximate Entropy Test', () => {
    const highEntropy = '1101001010110010111001001010011010101101001010110010111001001010';
    const res = evaluateApproximateEntropyTest(highEntropy, 2);
    expect(res.name).toContain('Approximate Entropy');
    expect(res.score).toBeGreaterThan(0);
  });

  it('evaluates NIST SP 800-22 Cumulative Sums Test', () => {
    const biasedWalk = '1'.repeat(200);
    const res = evaluateCumulativeSumsTest(biasedWalk);
    expect(res.status).toBe('FAILED');
    expect(res.score).toBe(200);
  });

  it('estimates Monte Carlo Pi with spatial coordinate mapping', () => {
    const tokens = Array.from({ length: 50 }, (_, i) => (i * 98765).toString(16).padStart(8, '0'));
    const piResult = estimateMonteCarloPi(tokens);
    expect(piResult.piEstimate).toBeGreaterThan(2.0);
    expect(piResult.piEstimate).toBeLessThan(4.5);
    expect(piResult.totalPoints).toBeGreaterThan(0);
  });

  it('detects sequential counter tokens via PRNG predictor', () => {
    const counterTokens = ['1001', '1002', '1003', '1004', '1005'];
    const prediction = predictLinearCongruentialGenerator(counterTokens);
    expect(prediction.isPredictable).toBe(true);
    expect(prediction.predictedGenerator).toBe('SEQUENTIAL_COUNTER');
    expect(prediction.nextPredictedTokens).toEqual(['1006', '1007', '1008']);
  });

  it('detects timestamp-derived tokens via PRNG predictor', () => {
    const now = 1710000000000;
    const timestampTokens = [String(now), String(now + 100), String(now + 250), String(now + 400)];
    const prediction = predictLinearCongruentialGenerator(timestampTokens);
    expect(prediction.isPredictable).toBe(true);
    expect(prediction.predictedGenerator).toBe('TIMESTAMP_DERIVED');
  });

  it('runs complete analysis on tokens including new NIST suites and PRNG predictor', () => {
    const syntheticTokens = Array.from({ length: 100 }, (_, i) => {
      return (i * 1234567).toString(16).padStart(8, '0');
    });

    const analysis = analyzeTokenStream(syntheticTokens);
    expect(analysis.sampleCount).toBe(100);
    expect(analysis.serialTest).toBeDefined();
    expect(analysis.autocorrelationTest).toBeDefined();
    expect(analysis.blockFrequencyTest).toBeDefined();
    expect(analysis.approximateEntropyTest).toBeDefined();
    expect(analysis.cumulativeSumsTest).toBeDefined();
    expect(analysis.piEstimation).toBeDefined();
    expect(analysis.prngPredictor).toBeDefined();
    expect(['EXCELLENT', 'GOOD', 'POOR', 'PREDICTABLE']).toContain(analysis.overallVerdict);
  });
});

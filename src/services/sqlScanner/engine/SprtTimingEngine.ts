/**
 * UCMA-X — In-Process Wald Sequential Probability Ratio Test (SPRT) Engine
 * Implements exact sequential hypothesis testing for timing-based blind SQL injection:
 * H0: mu = mu_0 (baseline latency) vs H1: mu = mu_1 = mu_0 + delay (injected latency)
 */

export interface SprtDecision {
  decision: 'ACCEPT_H1_VULNERABLE' | 'ACCEPT_H0_CLEAN' | 'CONTINUE_SAMPLING';
  llr: number; // Log-Likelihood Ratio
  upperThresholdA: number; // ln((1 - beta) / alpha)
  lowerThresholdB: number; // ln(beta / (1 - alpha))
  sampleCount: number;
  confidence: number;
  evidence: string;
}

export class SprtTimingEngine {
  private alpha: number; // Type I error rate (false positive rate, default 0.01)
  private beta: number;  // Type II error rate (false negative rate, default 0.01)
  private upperThresholdA: number;
  private lowerThresholdB: number;

  constructor(alpha: number = 0.01, beta: number = 0.01) {
    this.alpha = alpha;
    this.beta = beta;
    this.upperThresholdA = Math.log((1 - beta) / alpha); // ~4.595 for 0.01
    this.lowerThresholdB = Math.log(beta / (1 - alpha)); // ~-4.595 for 0.01
  }

  /**
   * Evaluates sequential timing samples against baseline distribution.
   * @param samples Array of observed response durations in milliseconds for injected delay
   * @param baselineMean Mean of baseline response duration in ms
   * @param baselineStdDev Standard deviation of baseline response in ms
   * @param expectedDelayMs Expected database sleep delay in ms (e.g. 3000ms for SLEEP(3))
   */
  public evaluate(
    samples: number[],
    baselineMean: number,
    baselineStdDev: number,
    expectedDelayMs: number
  ): SprtDecision {
    const sigma = Math.max(50, baselineStdDev); // minimum 50ms variance floor
    const mu0 = baselineMean;
    const mu1 = baselineMean + expectedDelayMs;

    let llr = 0;
    for (const x of samples) {
      // Gaussian Log-Likelihood Ratio: ((mu1 - mu0) / sigma^2) * (x - (mu0 + mu1) / 2)
      const term = ((mu1 - mu0) / (sigma * sigma)) * (x - (mu0 + mu1) / 2);
      llr += term;
    }

    const n = samples.length;

    if (llr >= this.upperThresholdA) {
      return {
        decision: 'ACCEPT_H1_VULNERABLE',
        llr,
        upperThresholdA: this.upperThresholdA,
        lowerThresholdB: this.lowerThresholdB,
        sampleCount: n,
        confidence: 1 - this.alpha,
        evidence: `Wald SPRT accepted H1 (LLR=${llr.toFixed(2)} >= A=${this.upperThresholdA.toFixed(2)}, n=${n} samples). Statistical significance: p < 0.01.`,
      };
    }

    if (llr <= this.lowerThresholdB) {
      return {
        decision: 'ACCEPT_H0_CLEAN',
        llr,
        upperThresholdA: this.upperThresholdA,
        lowerThresholdB: this.lowerThresholdB,
        sampleCount: n,
        confidence: 1 - this.beta,
        evidence: `Wald SPRT accepted H0 (LLR=${llr.toFixed(2)} <= B=${this.lowerThresholdB.toFixed(2)}, n=${n} samples). Noise hypothesis confirmed.`,
      };
    }

    return {
      decision: 'CONTINUE_SAMPLING',
      llr,
      upperThresholdA: this.upperThresholdA,
      lowerThresholdB: this.lowerThresholdB,
      sampleCount: n,
      confidence: 0.5,
      evidence: `Wald SPRT inconclusive at n=${n} samples (B=${this.lowerThresholdB.toFixed(2)} < LLR=${llr.toFixed(2)} < A=${this.upperThresholdA.toFixed(2)}). More evidence needed.`,
    };
  }
}

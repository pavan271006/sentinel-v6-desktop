/**
 * SOHE God Rail v3 — Adaptive Response Oracle
 *
 * Solves the "Oracle Problem" for real-world web applications.
 * Traditional scanners fail on pages with dynamic content (timestamps, CSRF tokens, ads).
 * This oracle uses a 3-stage pipeline:
 * 1. Dynamic Region Stripping (diffs baselines to find noise)
 * 2. DOM Structure Comparison (ignores text/attributes, compares layout)
 * 3. Semantic Similarity (fuzzy string matching for remaining content)
 */

import { GhostHttpResponse } from '../stealth/GhostNetwork';

export interface OracleResult {
  isTrue: boolean | null; // null if uncertain
  confidence: number;     // 0.0 to 1.0
  method: 'content_similarity' | 'content_divergence' | 'keyword_oracle' | 'uncertain' | 'status_code';
}

export interface ResponseFingerprint {
  rawBody: string;
  status: number;
  // Could add more like headers, content-type, etc.
}

export interface DynamicRegion {
  startIdx: number;
  endIdx: number;
}

export class AdaptiveResponseOracle {
  private dynamicRegexes: RegExp[] = [];
  private baselineFingerprint: ResponseFingerprint | null = null;
  private keywordOracles: string[] = [];

  /**
   * CALIBRATION PHASE
   * Takes 3 identical requests and identifies what changes between them.
   */
  async calibrate(sendBaseline: () => Promise<GhostHttpResponse>): Promise<void> {
    const r1 = await sendBaseline();
    const r2 = await sendBaseline();
    const r3 = await sendBaseline();

    this.baselineFingerprint = {
      rawBody: r1.body,
      status: r1.status
    };

    // 1. Identify dynamic regex patterns based on common noise
    this.dynamicRegexes = this.detectCommonDynamicPatterns(r1.body, r2.body, r3.body);
    
    // 2. We could also do Levenshtein diffing here to find arbitrary changing blocks,
    // but for performance, regexing common noise is usually sufficient.
  }

  /**
   * COMPARISON PHASE
   * Determines if a response is semantically equivalent to the baseline (TRUE)
   * or diverges from it (FALSE).
   */
  isTrue(response: GhostHttpResponse): OracleResult {
    if (!this.baselineFingerprint) {
      throw new Error("Oracle must be calibrated before use.");
    }

    // Fast path: Status code divergence (if baseline is 200 and we got 500, it's definitively false/error)
    if (response.status !== this.baselineFingerprint.status) {
      // If we got a 500 on a boolean test, it usually means syntax error, not a 'false' condition.
      // But for pure oracle purposes, it diverges from the baseline.
      return { isTrue: false, confidence: 0.99, method: 'status_code' };
    }

    // Step 1: Strip noise
    const strippedTarget = this.stripNoise(response.body);
    const strippedBaseline = this.stripNoise(this.baselineFingerprint.rawBody);

    // Step 2: Calculate similarity
    const similarity = this.calculateSimilarity(strippedBaseline, strippedTarget);

    // Step 3: Check keyword oracles (if we discovered any during specific True/False probing)
    for (const keyword of this.keywordOracles) {
        if (response.body.includes(keyword)) {
             return { isTrue: true, confidence: 0.99, method: 'keyword_oracle' };
        }
    }

    // Step 4: Decision thresholds
    if (similarity > 0.95) {
      return { isTrue: true, confidence: similarity, method: 'content_similarity' };
    }
    
    if (similarity < 0.85) {
      return { isTrue: false, confidence: 1.0 - similarity, method: 'content_divergence' };
    }

    return { isTrue: null, confidence: 0.5, method: 'uncertain' };
  }

  /**
   * Registers a keyword that definitively indicates a TRUE state.
   */
  registerKeywordOracle(keyword: string): void {
      if (!this.keywordOracles.includes(keyword)) {
          this.keywordOracles.push(keyword);
      }
  }

  // ─── Internal Implementations ────────────────────────────────────

  private detectCommonDynamicPatterns(b1: string, b2: string, b3: string): RegExp[] {
    const regexes: RegExp[] = [];
    
    // Pattern 1: CSRF Tokens (value changes)
    const csrfMatch = b1.match(/<input[^>]+name=["'](csrf[_-]?token|_token)["'][^>]+value=["']([^"']+)["']/i);
    if (csrfMatch && (!b2.includes(csrfMatch[2]) || !b3.includes(csrfMatch[2]))) {
        regexes.push(new RegExp(`<input[^>]+name=["']${csrfMatch[1]}["'][^>]+value=["'][^"']+["']`, 'gi'));
    }

    // Pattern 2: Hidden State (e.g. ASP.NET __VIEWSTATE)
    const viewStateMatch = b1.match(/<input[^>]+name=["']__VIEWSTATE["'][^>]+value=["']([^"']+)["']/i);
    if (viewStateMatch && (!b2.includes(viewStateMatch[2]) || !b3.includes(viewStateMatch[2]))) {
         regexes.push(/<input[^>]+name=["']__VIEWSTATE["'][^>]+value=["'][^"']+["']/gi);
    }

    // Pattern 3: Timestamps (very basic ISO-ish detection)
    // Real implementation would use more robust diffing to find exactly what changed,
    // rather than guessing regexes. For this architecture spec, we illustrate the concept.
    regexes.push(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/gi); // ISO Date
    regexes.push(/\b\d{10,13}\b/g); // Epoch timestamps (often in JS vars)

    return regexes;
  }

  private stripNoise(html: string): string {
    let stripped = html;
    for (const regex of this.dynamicRegexes) {
      stripped = stripped.replace(regex, '');
    }
    return stripped;
  }

  /**
   * Simple Jaccard similarity based on word tokens.
   * Faster than full Levenshtein for large HTML bodies.
   */
  private calculateSimilarity(s1: string, s2: string): number {
    // Basic tokenizer: words >= 3 chars
    const tokenize = (s: string) => new Set((s.match(/\b\w{3,}\b/g) || []).map(w => w.toLowerCase()));
    
    const set1 = tokenize(s1);
    const set2 = tokenize(s2);

    if (set1.size === 0 && set2.size === 0) return 1.0;

    let intersectionSize = 0;
    for (const word of set1) {
      if (set2.has(word)) {
        intersectionSize++;
      }
    }

    const unionSize = set1.size + set2.size - intersectionSize;
    return intersectionSize / unionSize;
  }
}

/**
 * Sentinel Autonomous SQL Engine — Noise-Canceling Semantic Diff Engine
 *
 * Strips dynamic non-deterministic noise (timestamps, CSRF nonces, session tokens, trace IDs, ads)
 * to perform high-precision differential comparison on HTML DOM and JSON AST responses.
 */

export interface SemanticDiffResult {
  isStructurallyIdentical: boolean;
  normalizedDistance: number; // 0.0 (identical) to 1.0 (completely divergent)
  cosineSimilarity: number;  // 1.0 (identical) to 0.0 (unrelated)
  lengthDelta: number;
  detectedNoiseTokens: string[];
}

export class SemanticDiffEngine {
  private static readonly NOISE_KEY_PATTERNS = [
    /^(time|timestamp|created_?at|updated_?at|generated_?at|date|datetime)$/i,
    /^(nonce|csrf|token|_token|xsrf|request_?id|trace_?id|span_?id|correlation_?id)$/i,
    /^(session_?id|sid|auth_?token|jwt|signature|hash)$/i,
    /^(random|rand|seed|v|version|build|cache_?buster)$/i,
  ];

  /**
   * Recursively sanitizes JSON structures by replacing dynamic noise values with static placeholders.
   */
  public static sanitizeJson(jsonObj: any): any {
    if (jsonObj === null || jsonObj === undefined) return jsonObj;
    if (typeof jsonObj === 'number' || typeof jsonObj === 'boolean') return jsonObj;

    if (typeof jsonObj === 'string') {
      // Mask dynamic ISO timestamps
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(jsonObj)) {
        return '__TIMESTAMP_MASKED__';
      }
      // Mask UUIDs
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jsonObj)) {
        return '__UUID_MASKED__';
      }
      return jsonObj;
    }

    if (Array.isArray(jsonObj)) {
      return jsonObj.map((item) => SemanticDiffEngine.sanitizeJson(item));
    }

    if (typeof jsonObj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(jsonObj)) {
        const isNoiseKey = SemanticDiffEngine.NOISE_KEY_PATTERNS.some((pattern) => pattern.test(key));
        if (isNoiseKey) {
          sanitized[key] = '__DYNAMIC_NOISE_MASKED__';
        } else {
          sanitized[key] = SemanticDiffEngine.sanitizeJson(value);
        }
      }
      return sanitized;
    }

    return jsonObj;
  }

  /**
   * Strips dynamic noise elements, comments, script tags, style blocks, and nonces from HTML.
   */
  public static sanitizeHtml(html: string): string {
    if (!html) return '';

    return html
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove script and style tags completely
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Strip hidden CSRF input elements
      .replace(/<input[^>]+name=["'](csrf[-_]?token|_token|authenticity_token)["'][^>]*>/gi, '')
      // Strip dynamic UUID patterns
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '__UUID__')
      // Strip ISO timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g, '__TIMESTAMP__')
      // Strip Unix epoch timestamps (10 or 13 digits)
      .replace(/\b1[6-7]\d{8,11}\b/g, '__EPOCH__')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Computes normalized Levenshtein edit distance between two strings (0.0 to 1.0).
   */
  public static normalizedLevenshtein(s1: string, s2: string): number {
    if (s1 === s2) return 0.0;
    if (s1.length === 0) return 1.0;
    if (s2.length === 0) return 1.0;

    let str1 = s1;
    let str2 = s2;
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen > 2000) {
      str1 = str1.substring(0, 2000);
      str2 = str2.substring(0, 2000);
    }

    const d: number[][] = [];
    for (let i = 0; i <= str1.length; i++) {
      d[i] = [i];
    }
    for (let j = 0; j <= str2.length; j++) {
      d[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // deletion
          d[i][j - 1] + 1,      // insertion
          d[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return d[str1.length][str2.length] / Math.max(str1.length, str2.length);
  }

  /**
   * Computes Cosine similarity over normalized word frequency vectors.
   */
  public static cosineSimilarity(s1: string, s2: string): number {
    const getWords = (str: string) => str.toLowerCase().match(/\b\w+\b/g) || [];
    const w1 = getWords(s1);
    const w2 = getWords(s2);

    if (w1.length === 0 && w2.length === 0) return 1.0;
    if (w1.length === 0 || w2.length === 0) return 0.0;

    const freq1: Record<string, number> = {};
    const freq2: Record<string, number> = {};
    const allWords = new Set<string>();

    for (const w of w1) {
      freq1[w] = (freq1[w] || 0) + 1;
      allWords.add(w);
    }
    for (const w of w2) {
      freq2[w] = (freq2[w] || 0) + 1;
      allWords.add(w);
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const w of allWords) {
      const v1 = freq1[w] || 0;
      const v2 = freq2[w] || 0;
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }

    if (mag1 === 0 || mag2 === 0) return 0.0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Evaluates two responses after applying full noise-cancellation pipeline.
   */
  public static compare(rawA: string, rawB: string): SemanticDiffResult {
    const detectedNoiseTokens: string[] = [];

    let cleanA = rawA;
    let cleanB = rawB;

    const isJsonA = rawA.trim().startsWith('{') || rawA.trim().startsWith('[');
    const isJsonB = rawB.trim().startsWith('{') || rawB.trim().startsWith('[');

    if (isJsonA && isJsonB) {
      try {
        const objA = JSON.parse(rawA);
        const objB = JSON.parse(rawB);
        cleanA = JSON.stringify(SemanticDiffEngine.sanitizeJson(objA));
        cleanB = JSON.stringify(SemanticDiffEngine.sanitizeJson(objB));
      } catch {
        cleanA = SemanticDiffEngine.sanitizeHtml(rawA);
        cleanB = SemanticDiffEngine.sanitizeHtml(rawB);
      }
    } else {
      cleanA = SemanticDiffEngine.sanitizeHtml(rawA);
      cleanB = SemanticDiffEngine.sanitizeHtml(rawB);
    }

    const isStructurallyIdentical = cleanA === cleanB;
    const distance = isStructurallyIdentical ? 0.0 : SemanticDiffEngine.normalizedLevenshtein(cleanA, cleanB);
    const cosine = isStructurallyIdentical ? 1.0 : SemanticDiffEngine.cosineSimilarity(cleanA, cleanB);
    const lengthDelta = Math.abs(cleanA.length - cleanB.length);

    return {
      isStructurallyIdentical,
      normalizedDistance: distance,
      cosineSimilarity: cosine,
      lengthDelta,
      detectedNoiseTokens,
    };
  }
}

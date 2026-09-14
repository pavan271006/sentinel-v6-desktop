/**
 * Sentinel Dynamic Retry-After Parser & Rate-Limit Compliance Engine
 *
 * Solves rate-limit escalation and 429 cascades by:
 * 1. Accurately parsing both numeric seconds (e.g. "120") and HTTP-date strings (e.g. "Wed, 21 Oct 2026 07:28:00 GMT").
 * 2. Computing exact millisecond backoff duration.
 * 3. Applying anti-thundering-herd jitter to prevent synchronized retry spikes.
 */

export class RetryAfterParser {
  /**
   * Parses a Retry-After header value into millisecond backoff duration.
   * Supports:
   * - Numeric seconds (e.g., "120" -> 120000ms)
   * - RFC 1123 / RFC 850 HTTP-Date strings
   */
  public static parse(headerValue?: string, defaultDelayMs: number = 3000): number {
    if (!headerValue || headerValue.trim().length === 0) {
      return defaultDelayMs;
    }

    const trimmed = headerValue.trim();

    // 1. Numeric seconds check (e.g. "30", "120", "5.5")
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const seconds = parseFloat(trimmed);
      if (!isNaN(seconds) && seconds >= 0) {
        // Add small jitter (5-10%) to prevent thundering herd
        const jitterMs = Math.floor(Math.random() * 200);
        return Math.floor(seconds * 1000) + jitterMs;
      }
    }

    // 2. HTTP-date format (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
    const parsedDateMs = Date.parse(trimmed);
    if (!isNaN(parsedDateMs)) {
      const nowMs = Date.now();
      const diffMs = parsedDateMs - nowMs;
      if (diffMs > 0) {
        const jitterMs = Math.floor(Math.random() * 300);
        return diffMs + jitterMs;
      }
      return 500; // If date is in the immediate past, short pause
    }

    return defaultDelayMs;
  }
}

/**
 * Sentinel Automated Clearance Heartbeat & Token Renewal Daemon
 *
 * Solves the short-lived clearance token expiration trap (5-15 minute TTL) by:
 * 1. Tracking clearance token creation timestamps and estimating remaining TTL.
 * 2. Running lightweight canary health probes during long crawls.
 * 3. Emitting expiration events to pause the crawler and alert for 1-click renewal.
 */

export interface ClearanceTokenState {
  tokenName: string;
  tokenValue: string;
  capturedAtMs: number;
  estimatedTtlMs: number;
  status: 'valid' | 'expiring' | 'expired';
}

export class ClearanceHeartbeat {
  private tokens: Map<string, ClearanceTokenState> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMinutes: number = 15) {
    this.defaultTtlMs = defaultTtlMinutes * 60 * 1000;
  }

  /**
   * Registers or updates a clearance token from proxy traffic.
   */
  public registerToken(tokenName: string, tokenValue: string, customTtlMinutes?: number): void {
    const ttlMs = customTtlMinutes ? customTtlMinutes * 60 * 1000 : this.defaultTtlMs;
    this.tokens.set(tokenName, {
      tokenName,
      tokenValue,
      capturedAtMs: Date.now(),
      estimatedTtlMs: ttlMs,
      status: 'valid',
    });
  }

  /**
   * Evaluates the health of all registered tokens.
   */
  public evaluateHealth(): {
    allValid: boolean;
    expiringTokens: string[];
    expiredTokens: string[];
    tokens: ClearanceTokenState[];
  } {
    const now = Date.now();
    const expiringTokens: string[] = [];
    const expiredTokens: string[] = [];
    const list: ClearanceTokenState[] = [];

    for (const [name, state] of this.tokens.entries()) {
      const elapsed = now - state.capturedAtMs;
      const remaining = state.estimatedTtlMs - elapsed;

      if (remaining <= 0) {
        state.status = 'expired';
        expiredTokens.push(name);
      } else if (remaining <= 2 * 60 * 1000) {
        // Less than 2 minutes remaining
        state.status = 'expiring';
        expiringTokens.push(name);
      } else {
        state.status = 'valid';
      }

      list.push({ ...state });
    }

    return {
      allValid: expiredTokens.length === 0,
      expiringTokens,
      expiredTokens,
      tokens: list,
    };
  }

  /**
   * Checks if an HTTP response indicates that clearance expired (Cloudflare 403 / 503 challenge).
   */
  public static isClearanceExpiredResponse(statusCode: number, headers: Record<string, string>, body: string): boolean {
    if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
      const isCf = headers['cf-ray'] || headers['cf-cache-status'] || /attention required.*cloudflare|cloudflare ray id|error 1020/i.test(body);
      const isDatadome = headers['x-datadome'] || /datadome/i.test(body);
      const isIncapsula = headers['x-iinfo'] || /incapsula/i.test(body);
      return Boolean(isCf || isDatadome || isIncapsula);
    }
    return false;
  }
}

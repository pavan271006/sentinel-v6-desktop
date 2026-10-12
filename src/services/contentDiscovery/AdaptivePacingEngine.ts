/**
 * Sentinel Sovereign Ω - Adaptive Pacing, Rate Limiting & Circuit Breaker Engine
 *
 * Implements defensive pacing to evade CDN/WAF behavioral anomaly detection:
 * 1. Sliding Token Bucket Governor (configurable requests/actions per second)
 * 2. Biological Jitter Injection (±35% Gaussian/random distribution on inter-action intervals)
 * 3. Dynamic Exponential Backoff on 429 (Too Many Requests), 503, and WAF 403s
 * 4. Circuit Breaker to prevent IP reputation destruction and account lockouts
 * 5. Dwell Time Emulation (natural reading/thinking pauses when visiting deep pages)
 */

export interface AdaptivePacingConfig {
  maxActionsPerSecond?: number;      // Default: 2.0 actions/sec (pacing governor)
  baseInteractionDelayMs?: number;   // Default: 600ms
  jitterRatio?: number;              // Default: 0.35 (±35% variance)
  consecutiveErrorThreshold?: number;// Default: 5 errors before circuit trip
  maxBackoffMs?: number;             // Default: 30000ms (30s)
  enableCircuitBreaker?: boolean;    // Default: true
}

export interface HostPacingMetrics {
  host: string;
  totalActions: number;
  successCount: number;
  error429Count: number;
  error403Count: number;
  consecutiveErrors: number;
  currentBackoffMs: number;
  circuitTripped: boolean;
  lastActionTimestamp: number;
  isStealthThrottled?: boolean;
  dynamicBaseDelayMs?: number;
  throttleReason?: string;
  consecutiveSuccesses?: number;
}

export class AdaptivePacingEngine {
  private config: Required<AdaptivePacingConfig>;
  private hostMetrics = new Map<string, HostPacingMetrics>();
  private userSpeedOverrideMs: number | null = null;

  constructor(config: AdaptivePacingConfig = {}) {
    this.config = {
      maxActionsPerSecond: config.maxActionsPerSecond || 2.0,
      baseInteractionDelayMs: config.baseInteractionDelayMs || 600,
      jitterRatio: config.jitterRatio !== undefined ? config.jitterRatio : 0.35,
      consecutiveErrorThreshold: config.consecutiveErrorThreshold || 5,
      maxBackoffMs: config.maxBackoffMs || 30000,
      enableCircuitBreaker: config.enableCircuitBreaker !== undefined ? config.enableCircuitBreaker : true,
    };
  }

  /**
   * Sets the user-chosen speed override (from the UI Speed Button).
   * When set, this becomes the base delay for non-throttled hosts,
   * completely bypassing the hardcoded 600ms default.
   */
  public setUserSpeedOverride(delayMs: number): void {
    this.userSpeedOverrideMs = delayMs;
  }

  /**
   * Initializes or retrieves the metrics state for a specific host
   */
  public getMetricsForHost(host: string): HostPacingMetrics {
    const cleanHost = (host || 'global').toLowerCase().trim();
    let metrics = this.hostMetrics.get(cleanHost);
    if (!metrics) {
      metrics = {
        host: cleanHost,
        totalActions: 0,
        successCount: 0,
        error429Count: 0,
        error403Count: 0,
        consecutiveErrors: 0,
        currentBackoffMs: 0,
        circuitTripped: false,
        lastActionTimestamp: 0,
        isStealthThrottled: false,
        dynamicBaseDelayMs: this.config.baseInteractionDelayMs,
        consecutiveSuccesses: 0,
      };
      this.hostMetrics.set(cleanHost, metrics);
    }
    return metrics;
  }

  /**
   * Dynamically triggers high-stealth slowdown when anti-bot blocking or rate limiting is detected.
   * Significantly scales up interaction delays and enforces cool-down backoff.
   */
  public triggerDynamicSlowdown(host: string, reason: string, backoffSec: number = 5): void {
    const cleanHost = (host || 'global').toLowerCase().trim();
    const metrics = this.getMetricsForHost(cleanHost);

    metrics.isStealthThrottled = true;
    metrics.throttleReason = reason;
    metrics.consecutiveSuccesses = 0;
    metrics.consecutiveErrors = Math.max(metrics.consecutiveErrors + 1, 2);

    // Dynamic escalation: jump base delay to 2500ms - 4000ms
    const currentBase = metrics.dynamicBaseDelayMs || this.config.baseInteractionDelayMs;
    metrics.dynamicBaseDelayMs = Math.min(Math.max(currentBase * 1.8, 2600), 5000);

    // Apply cooldown backoff
    metrics.currentBackoffMs = Math.min(Math.max(metrics.currentBackoffMs, backoffSec * 1000), this.config.maxBackoffMs);
  }

  /**
   * Checks if a host is currently flagged as throttled or under active backoff
   */
  public isHostThrottled(host: string): boolean {
    const cleanHost = (host || 'global').toLowerCase().trim();
    const metrics = this.getMetricsForHost(cleanHost);
    return Boolean(metrics.isStealthThrottled || metrics.currentBackoffMs > 0);
  }

  /**
   * Calculates the next paced delay incorporating token bucket limits and human jitter
   */
  public calculateDelay(host?: string): number {
    const cleanHost = (host || 'global').toLowerCase().trim();
    const metrics = this.getMetricsForHost(cleanHost);

    // When in Turbo or Fast mode (<= 100ms) and host is healthy, return directly for maximum speed
    if (this.userSpeedOverrideMs !== null && this.userSpeedOverrideMs <= 100 && !metrics.isStealthThrottled && metrics.currentBackoffMs === 0) {
      return this.userSpeedOverrideMs <= 50 ? 0 : this.userSpeedOverrideMs;
    }

    // Use dynamic slowed-down delay if throttled, user speed override if set, otherwise configured base
    const base = metrics.isStealthThrottled
      ? (metrics.dynamicBaseDelayMs || this.config.baseInteractionDelayMs)
      : (this.userSpeedOverrideMs !== null ? this.userSpeedOverrideMs : this.config.baseInteractionDelayMs);
    
    // Jitter variation: between (1 - jitterRatio) and (1 + jitterRatio)
    const jitterFactor = this.userSpeedOverrideMs !== null && this.userSpeedOverrideMs <= 150 ? 1 : (1 + (Math.random() * 2 - 1) * this.config.jitterRatio);
    let delay = Math.round(base * jitterFactor);

    // When throttled, enforce a strict minimum floor (2200ms + biological jitter)
    if (metrics.isStealthThrottled && delay < 2200) {
      delay = 2200 + Math.round(Math.random() * 600);
    }

    // Only enforce token-bucket minimum when host is actively throttled
    if (metrics.isStealthThrottled || metrics.currentBackoffMs > 0) {
      const minIntervalMs = Math.round(1000 / this.config.maxActionsPerSecond);
      if (delay < minIntervalMs) {
        delay = minIntervalMs + Math.round(Math.random() * 200);
      }
    }

    if (metrics.currentBackoffMs > 0) {
      delay += metrics.currentBackoffMs;
    }

    return delay;
  }

  /**
   * Asynchronously paces the crawler before executing an action.
   * Resolves when pacing criteria and any active backoff have cleared.
   */
  public async pace(host?: string, onThrottleNotice?: (message: string) => void): Promise<void> {
    const cleanHost = host || 'global';
    const metrics = this.getMetricsForHost(cleanHost);

    // Circuit Breaker check
    if (this.config.enableCircuitBreaker && metrics.circuitTripped) {
      const msg = `Circuit Breaker active on ${cleanHost} (${metrics.consecutiveErrors} consecutive rate-limit errors). Backing off for safety.`;
      if (onThrottleNotice) onThrottleNotice(msg);
      // Wait out cooldown before allowing a probe
      await new Promise((r) => setTimeout(r, Math.min(metrics.currentBackoffMs || 15000, this.config.maxBackoffMs)));
      metrics.circuitTripped = false;
      metrics.consecutiveErrors = 2; // Softened probe state
    }

    const calculatedDelay = this.calculateDelay(cleanHost);
    const now = Date.now();
    const elapsedSinceLast = now - metrics.lastActionTimestamp;

    if (elapsedSinceLast < calculatedDelay) {
      const waitTime = calculatedDelay - elapsedSinceLast;
      if ((metrics.currentBackoffMs > 0 || metrics.isStealthThrottled) && onThrottleNotice) {
        onThrottleNotice(`Dynamic Stealth Backoff active on ${cleanHost} (${metrics.throttleReason || 'Rate Limiting'}): Pacing actions with ${waitTime}ms pause...`);
      }
      await new Promise((r) => setTimeout(r, waitTime));
    }

    metrics.totalActions++;
    metrics.lastActionTimestamp = Date.now();
  }

  /**
   * Records the outcome of an HTTP action to adapt future pacing dynamically
   */
  public recordResult(host: string, status: number, isWafBlock: boolean = false): void {
    const metrics = this.getMetricsForHost(host);

    if (status === 429 || (status === 403 && isWafBlock) || status === 503) {
      metrics.consecutiveErrors++;
      if (status === 429) metrics.error429Count++;
      if (status === 403) metrics.error403Count++;

      metrics.isStealthThrottled = true;
      metrics.throttleReason = status === 429 ? 'HTTP 429 (Too Many Requests)' : (isWafBlock ? 'WAF Defense Challenge (403)' : `HTTP ${status}`);
      metrics.consecutiveSuccesses = 0;

      // Dynamic base delay escalation: scale up base delay to 2500ms - 4000ms
      const currentBase = metrics.dynamicBaseDelayMs || this.config.baseInteractionDelayMs;
      metrics.dynamicBaseDelayMs = Math.min(Math.max(currentBase * 1.8, 2600), 5000);

      // Exponential backoff: 2s -> 4s -> 8s -> 16s -> 30s
      const nextBackoff = metrics.currentBackoffMs === 0 ? 2000 : metrics.currentBackoffMs * 2;
      metrics.currentBackoffMs = Math.min(nextBackoff, this.config.maxBackoffMs);

      if (this.config.enableCircuitBreaker && metrics.consecutiveErrors >= this.config.consecutiveErrorThreshold) {
        metrics.circuitTripped = true;
      }
    } else if (status >= 200 && status < 400) {
      metrics.successCount++;
      metrics.consecutiveSuccesses = (metrics.consecutiveSuccesses || 0) + 1;

      // Gradually relieve backoff pressure on successful navigation
      if (metrics.consecutiveErrors > 0) {
        metrics.consecutiveErrors = Math.max(0, metrics.consecutiveErrors - 1);
      }
      if (metrics.currentBackoffMs > 0) {
        metrics.currentBackoffMs = Math.round(metrics.currentBackoffMs / 2);
        if (metrics.currentBackoffMs < 400) metrics.currentBackoffMs = 0;
      }
      metrics.circuitTripped = false;

      // After sustained successes (8+), gently normalize base delay, but keep safe floor (1500ms)
      if (metrics.consecutiveSuccesses >= 8 && metrics.dynamicBaseDelayMs && metrics.dynamicBaseDelayMs > 1500) {
        metrics.dynamicBaseDelayMs = Math.max(Math.round(metrics.dynamicBaseDelayMs * 0.9), 1500);
      }
    }
  }

  /**
   * Generates natural human dwell delays when viewing pages (e.g. 1.2s - 2.8s)
   */
  public async humanDwellPause(multiplier: number = 1.0): Promise<void> {
    const minDwell = 1000 * multiplier;
    const maxDwell = 2500 * multiplier;
    const dwell = Math.round(minDwell + Math.random() * (maxDwell - minDwell));
    await new Promise((r) => setTimeout(r, dwell));
  }
}

export const adaptivePacingEngine = new AdaptivePacingEngine();

/**
 * SOHE God Rail v3 — Adaptive Rate Controller
 *
 * Balances scan speed with detection risk.
 * - Speeds up during successful streaks
 * - Backs off exponentially when rate-limits (429/503) are hit
 * - Adds extra jitter when WAF blocks (403/406) are detected
 */

import { GhostHttpResponse } from './GhostNetwork';

export class AdaptiveRateController {
  private currentRps: number;
  private maxRps: number;
  private minRps: number = 0.5; // Never go slower than 1 req / 2s
  private consecutiveSuccesses: number = 0;
  private backoffFactor: number = 2;
  private lastRequestTime: number = 0;

  constructor(initialRps: number = 2, maxRps: number = 10) {
    this.currentRps = initialRps;
    this.maxRps = maxRps;
  }

  /**
   * Adjusts the internal RPS target based on response signals.
   */
  adjustRate(response: GhostHttpResponse): void {
    const status = response.status;

    // Rate Limit Hit (429 Too Many Requests, 503 Service Unavailable)
    if (status === 429 || status === 503) {
      this.currentRps = Math.max(this.minRps, this.currentRps / this.backoffFactor);
      this.consecutiveSuccesses = 0;
      return;
    }

    // WAF Block Detected (403 Forbidden, 406 Not Acceptable, 418 I'm a teapot)
    // Back off slightly more to blend in after triggering a rule
    if (status === 403 || status === 406 || status === 418) {
      this.currentRps = Math.max(this.minRps, this.currentRps / (this.backoffFactor * 1.5));
      this.consecutiveSuccesses = 0;
      return;
    }

    // Success (200, 302, 500 DB error, etc)
    this.consecutiveSuccesses++;

    // Gradually speed up after a streak of successes
    if (this.consecutiveSuccesses > 10) {
      this.currentRps = Math.min(this.maxRps, this.currentRps * 1.1); // 10% increase
      this.consecutiveSuccesses = 0; // Reset counter after speedup
    }
  }

  /**
   * Pauses execution until it's time for the next request according to the current RPS.
   */
  async waitForSlot(): Promise<void> {
    const now = performance.now();
    const targetIntervalMs = 1000 / this.currentRps;
    
    // Calculate how long since the last request
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < targetIntervalMs) {
      const remainingWait = targetIntervalMs - elapsed;
      // Add a tiny bit of random jitter (±10%) to the wait to avoid mechanical precision
      const jitter = remainingWait * 0.1 * (Math.random() * 2 - 1); 
      const finalWait = Math.max(0, remainingWait + jitter);
      
      await new Promise(resolve => setTimeout(resolve, finalWait));
    }

    this.lastRequestTime = performance.now();
  }
  
  get getCurrentRps(): number {
      return this.currentRps;
  }
}

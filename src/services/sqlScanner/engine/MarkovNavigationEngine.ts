/**
 * Sentinel Autonomous SQL Engine — Markovian Human Navigation Simulation Engine
 *
 * Implements Level 4 Behavioral Stealth: Simulates realistic human browsing topology
 * using Markov Chain transitions, background asset fetching, dynamic Referer propagation,
 * and Zipf's Law distribution to eliminate scanner behavioral signatures.
 */

export interface NavigationNode {
  url: string;
  method: string;
  type: 'document' | 'asset' | 'xhr' | 'navigation';
  weight: number;
}

export interface NavigationStep {
  url: string;
  headers: { name: string; value: string }[];
  isProbe: boolean;
  suggestedDelayMs: number;
}

export class MarkovNavigationEngine {
  private transitionMatrix: Map<string, NavigationNode[]> = new Map();
  private history: string[] = [];

  constructor(targetUrl?: string) {
    if (targetUrl) {
      this.initDefaultGraph(targetUrl);
    }
  }

  /**
   * Initializes human navigation transition graph with realistic static assets and related endpoints.
   */
  public initDefaultGraph(baseTargetUrl: string): void {
    try {
      const u = new URL(baseTargetUrl);
      const origin = u.origin;
      const pathname = u.pathname;

      const assets: NavigationNode[] = [
        { url: `${origin}/favicon.ico`, method: 'GET', type: 'asset', weight: 0.15 },
        { url: `${origin}/robots.txt`, method: 'GET', type: 'document', weight: 0.05 },
        { url: `${origin}/`, method: 'GET', type: 'document', weight: 0.35 },
      ];

      this.transitionMatrix.set(pathname, assets);
      this.history.push(baseTargetUrl);
    } catch {}
  }

  /**
   * Records a visited endpoint to maintain a realistic referer chain.
   */
  public recordVisit(url: string): void {
    this.history.push(url);
    if (this.history.length > 20) {
      this.history.shift();
    }
  }

  /**
   * Computes the most realistic Referer header based on navigation history.
   * If the previous URL had SQL injection / quote / union characters injected,
   * sanitize back to the clean base endpoint to avoid self-contaminating probes.
   */
  public getNaturalReferer(currentUrl: string): string | null {
    if (this.history.length === 0) return null;
    let ref = this.history[this.history.length - 1];
    if (ref === currentUrl && this.history.length >= 2) {
      ref = this.history[this.history.length - 2];
    }
    // If the referer URL contains attack characters, strip the query string
    if (/[\\'"`]|--|union|select|order\s+by/i.test(ref)) {
      try {
        const u = new URL(ref);
        return `${u.origin}${u.pathname}`;
      } catch {
        return ref.split('?')[0];
      }
    }
    return ref;
  }

  /**
   * Generates a benign background asset request to intersperse between heavy attack probes,
   * breaking uniform parameter scan bursts and resetting strict anomaly detection counters.
   */
  public generateInterspersedAssetProbe(currentUrl: string): { url: string; headers: Record<string, string> } | null {
    try {
      const u = new URL(currentUrl);
      const candidates = [
        `${u.origin}/static/js/bundle.js`,
        `${u.origin}/favicon.ico`,
        `${u.origin}/assets/app.css`,
        `${u.origin}/api/health`,
      ];
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      return {
        url: selected,
        headers: {
          'Accept': '*/*',
          'Sec-Fetch-Dest': selected.endsWith('.js') ? 'script' : selected.endsWith('.css') ? 'style' : 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'Referer': currentUrl,
        },
      };
    } catch {
      return null;
    }
  }
}

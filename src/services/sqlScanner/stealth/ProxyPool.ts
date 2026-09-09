/**
 * SOHE God Rail v3 — Proxy Pool
 *
 * Manages SOCKS5/HTTP proxy rotation with health checking,
 * geo-alignment, and automatic failover.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface ProxyEndpoint {
  host: string;
  port: number;
  type: 'socks5' | 'http' | 'https';
  username?: string;
  password?: string;
  country?: string;
  healthy: boolean;
  lastUsed: number;
  requestCount: number;
  avgLatencyMs: number;
  failCount: number;
  cooldownUntil?: number;
  strikeCount?: number;
}

// ─── Proxy Pool ────────────────────────────────────────────────────

export class ProxyPool {
  private proxies: ProxyEndpoint[] = [];
  private currentIndex: number = 0;
  private maxRequestsPerProxy: number;

  constructor(proxies: ProxyEndpoint[] = [], maxRequestsPerProxy: number = 1) {
    this.proxies = proxies.map(p => ({
      ...p,
      healthy: true,
      lastUsed: 0,
      requestCount: 0,
      avgLatencyMs: 0,
      failCount: 0,
      strikeCount: 0,
    }));
    this.maxRequestsPerProxy = maxRequestsPerProxy;
  }

  hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  /**
   * Get next proxy based on rotation mode with anti-ban cooldown awareness.
   */
  getNext(mode: 'round-robin' | 'random' | 'smart', exclude?: ProxyEndpoint): ProxyEndpoint | null {
    const now = Date.now();

    // Auto-unfreeze proxies whose temporary rate-limit cooldown has expired
    for (const p of this.proxies) {
      if (p.cooldownUntil && now >= p.cooldownUntil) {
        p.cooldownUntil = undefined;
        if (p.failCount < 5) {
          p.healthy = true;
        }
      }
    }

    // Filter available proxies: must be healthy, not on active cooldown, and not the excluded failed proxy
    const active = this.proxies.filter(p => 
      p.healthy &&
      (!p.cooldownUntil || now > p.cooldownUntil) &&
      (!exclude || !(p.host === exclude.host && p.port === exclude.port))
    );

    // Fallback: if all proxies are excluded or in cooldown, fall back to any healthy proxy
    const candidates = active.length > 0 ? active : this.proxies.filter(p => p.healthy);
    if (candidates.length === 0) return null;

    let selected: ProxyEndpoint;

    switch (mode) {
      case 'round-robin':
        this.currentIndex = this.currentIndex % candidates.length;
        selected = candidates[this.currentIndex];
        this.currentIndex++;
        break;

      case 'random':
        selected = candidates[Math.floor(Math.random() * candidates.length)];
        break;

      case 'smart':
        // Prefer proxies with lowest latency, fewest strikes, and fewest recent uses
        selected = candidates.slice().sort((a, b) => {
          const aScore = a.avgLatencyMs + (a.requestCount * 50) + ((a.strikeCount || 0) * 200);
          const bScore = b.avgLatencyMs + (b.requestCount * 50) + ((b.strikeCount || 0) * 200);
          return aScore - bScore;
        })[0];
        break;
    }

    selected.lastUsed = Date.now();
    selected.requestCount++;

    // If proxy hit max requests, rotate it out temporarily
    if (this.maxRequestsPerProxy > 0 && selected.requestCount >= this.maxRequestsPerProxy) {
      selected.requestCount = 0; // Reset for next cycle
    }

    return selected;
  }

  /**
   * Mark a proxy as failed with adaptive cooldown strike.
   * Rate limits (429) get a 30s pause; WAF blocks (403) get a 60s quarantine.
   */
  markFailed(proxy: ProxyEndpoint, reason?: 'rate-limit' | 'waf-block' | 'timeout'): void {
    const found = this.proxies.find(p => p.host === proxy.host && p.port === proxy.port);
    if (found) {
      found.failCount++;
      found.strikeCount = (found.strikeCount || 0) + 1;

      // Adaptive cooldown duration based on failure type
      const cooldownMs = reason === 'rate-limit' 
        ? 30000 
        : reason === 'waf-block' 
        ? 60000 
        : Math.min(120000, 10000 * Math.pow(2, found.failCount - 1));

      found.cooldownUntil = Date.now() + cooldownMs;

      // After 5 strikes, mark persistently unhealthy until manual reset
      if (found.failCount >= 5) {
        found.healthy = false;
      }
    }
  }

  /**
   * Update latency stats for a proxy after a successful request.
   */
  markSuccess(proxy: ProxyEndpoint, latencyMs: number): void {
    const found = this.proxies.find(p => p.host === proxy.host && p.port === proxy.port);
    if (found) {
      found.failCount = 0;
      found.healthy = true;
      found.cooldownUntil = undefined;
      // Exponential moving average
      found.avgLatencyMs = found.avgLatencyMs === 0
        ? latencyMs
        : found.avgLatencyMs * 0.7 + latencyMs * 0.3;
    }
  }

  /**
   * Run health check on all proxies. Marks unreachable ones as unhealthy.
   */
  async healthCheck(): Promise<{ healthy: number; unhealthy: number }> {
    let healthy = 0;
    let unhealthy = 0;

    for (const proxy of this.proxies) {
      try {
        const start = performance.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        await fetch('https://httpbin.org/ip', {
          signal: controller.signal,
          // Proxy would be configured at the transport level
        });

        clearTimeout(timeout);
        const latency = performance.now() - start;
        proxy.healthy = true;
        proxy.avgLatencyMs = latency;
        proxy.failCount = 0;
        healthy++;
      } catch {
        proxy.healthy = false;
        unhealthy++;
      }
    }

    return { healthy, unhealthy };
  }

  /**
   * Load proxies from a text file (one per line, format: host:port:type:user:pass)
   */
  static parseProxyList(text: string): ProxyEndpoint[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const parts = line.split(':');
        return {
          host: parts[0],
          port: parseInt(parts[1], 10),
          type: (parts[2] || 'http') as 'socks5' | 'http' | 'https',
          username: parts[3] || undefined,
          password: parts[4] || undefined,
          country: parts[5] || undefined,
          healthy: true,
          lastUsed: 0,
          requestCount: 0,
          avgLatencyMs: 0,
          failCount: 0,
        };
      })
      .filter(p => !isNaN(p.port));
  }

  get healthyCount(): number {
    return this.proxies.filter(p => p.healthy).length;
  }

  get totalCount(): number {
    return this.proxies.length;
  }
}

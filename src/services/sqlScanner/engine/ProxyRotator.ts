/**
 * Sentinel Autonomous SQL Engine — Proxy Rotator & Rate-Limit Resilience Mesh
 *
 * Distributes scan traffic across an upstream pool of proxies to bypass
 * target-side volumetric IP rate limiting and WAF connection throttling.
 */

export interface ProxyNode {
  id: string;
  url: string;
  protocol: 'http' | 'https' | 'socks5';
  activeRequests: number;
  consecutiveFailures: number;
  isRateLimited: boolean;
  rateLimitBackoffUntil?: number;
}

export class ProxyRotator {
  private proxies: ProxyNode[] = [];
  private currentIndex: number = 0;

  constructor(proxyUrls: string[] = []) {
    this.proxies = proxyUrls.map((url, idx) => ({
      id: `proxy_${idx}_${Date.now()}`,
      url,
      protocol: url.startsWith('socks5') ? 'socks5' : url.startsWith('https') ? 'https' : 'http',
      activeRequests: 0,
      consecutiveFailures: 0,
      isRateLimited: false,
    }));
  }

  public addProxy(url: string): void {
    this.proxies.push({
      id: `proxy_${this.proxies.length}_${Date.now()}`,
      url,
      protocol: url.startsWith('socks5') ? 'socks5' : url.startsWith('https') ? 'https' : 'http',
      activeRequests: 0,
      consecutiveFailures: 0,
      isRateLimited: false,
    });
  }

  public getNextAvailableProxy(): ProxyNode | null {
    if (this.proxies.length === 0) return null;

    const now = Date.now();
    // Filter healthy or recovered proxies
    const available = this.proxies.filter(
      (p) => !p.isRateLimited || (p.rateLimitBackoffUntil && p.rateLimitBackoffUntil <= now)
    );

    if (available.length === 0) {
      // All rate limited; return least busy
      return this.proxies.reduce((prev, curr) => (curr.activeRequests < prev.activeRequests ? curr : prev));
    }

    this.currentIndex = (this.currentIndex + 1) % available.length;
    return available[this.currentIndex];
  }

  public reportRateLimit(proxyId: string, backoffMs: number = 30000): void {
    const proxy = this.proxies.find((p) => p.id === proxyId);
    if (proxy) {
      proxy.isRateLimited = true;
      proxy.rateLimitBackoffUntil = Date.now() + backoffMs;
      proxy.consecutiveFailures++;
    }
  }

  public reportSuccess(proxyId: string): void {
    const proxy = this.proxies.find((p) => p.id === proxyId);
    if (proxy) {
      proxy.isRateLimited = false;
      proxy.consecutiveFailures = 0;
    }
  }

  public getPoolSize(): number {
    return this.proxies.length;
  }
}
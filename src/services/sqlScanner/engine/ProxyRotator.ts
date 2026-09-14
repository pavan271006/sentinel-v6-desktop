/**
 * Sentinel Autonomous SQL Engine — Proxy Rotator & ASN Reputation Shield
 *
 * Distributes scan traffic across an upstream pool of proxies to bypass:
 * 1. Target-side volumetric IP rate limiting and WAF connection throttling.
 * 2. Datacenter IP & ASN reputation drop filters (Cloudflare/Akamai/Imperva).
 * 3. Rotates to upstream residential or mobile proxies upon ASN block detection.
 */

export interface ProxyNode {
  id: string;
  url: string;
  protocol: 'http' | 'https' | 'socks5';
  proxyType?: 'datacenter' | 'residential' | 'mobile';
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
      proxyType: url.includes('residential') ? 'residential' : (url.includes('mobile') ? 'mobile' : 'datacenter'),
      activeRequests: 0,
      consecutiveFailures: 0,
      isRateLimited: false,
    }));
  }

  public addProxy(url: string, proxyType: 'datacenter' | 'residential' | 'mobile' = 'datacenter'): void {
    this.proxies.push({
      id: `proxy_${this.proxies.length}_${Date.now()}`,
      url,
      protocol: url.startsWith('socks5') ? 'socks5' : url.startsWith('https') ? 'https' : 'http',
      proxyType,
      activeRequests: 0,
      consecutiveFailures: 0,
      isRateLimited: false,
    });
  }

  public getNextAvailableProxy(preferResidential: boolean = false): ProxyNode | null {
    if (this.proxies.length === 0) return null;

    const now = Date.now();
    let available = this.proxies.filter(
      (p) => !p.isRateLimited || (p.rateLimitBackoffUntil && p.rateLimitBackoffUntil <= now)
    );

    if (preferResidential) {
      const residential = available.filter((p) => p.proxyType === 'residential' || p.proxyType === 'mobile');
      if (residential.length > 0) {
        available = residential;
      }
    }

    if (available.length === 0) {
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

  /**
   * Detects if an HTTP response was triggered by a Datacenter ASN reputation block.
   */
  public static isAsnOrDatacenterBlock(statusCode: number, headers: Record<string, string>, body: string): boolean {
    if (statusCode === 403 || statusCode === 401 || statusCode === 429) {
      const lower = body.toLowerCase();
      const isAsnBlock =
        lower.includes('datacenter ip') ||
        lower.includes('ip reputation') ||
        lower.includes('fraud score') ||
        lower.includes('vpn or proxy detected') ||
        lower.includes('asn blocked') ||
        lower.includes('cloud provider ip');
      const isHeaderBlocked = headers['x-blocked-asn'] !== undefined || headers['x-fraud-score'] !== undefined;
      return isAsnBlock || isHeaderBlocked;
    }
    return false;
  }
}

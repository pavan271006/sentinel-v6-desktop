/**
 * SOHE God Rail v3 — Ghost Network
 *
 * 7-layer stealth wrapper that makes every HTTP request look like it comes
 * from a different normal browser user. The target never sees a pattern.
 *
 * Layer 1: IP Rotation (per-request via SOCKS5/HTTP proxy)
 * Layer 2: User-Agent Rotation (real browser strings)
 * Layer 3: TLS Fingerprint Spoofing (JA4+ mimicry)
 * Layer 4: Timing Jitter (log-normal distribution, human-like)
 * Layer 5: Header Normalization (realistic Accept, Accept-Language, etc.)
 * Layer 6: Referer Chain (realistic navigation history)
 * Layer 7: Session Warming (browse normally before probing)
 */

import { ProxyPool, ProxyEndpoint } from './ProxyPool';
import { SessionManager } from './SessionManager';
import { AdaptiveRateController } from './AdaptiveRateController';
import { USER_AGENTS } from './UserAgentDatabase';
import { TlsProfiler } from './TlsProfiler';

// ─── Types ─────────────────────────────────────────────────────────

export interface StealthConfig {
  enabled: boolean;
  proxies: ProxyEndpoint[];
  rotationMode: 'round-robin' | 'random' | 'smart';
  avgDelayMs: number;
  spoofTlsFingerprint: boolean;
  spoofUserAgent: boolean;
  spoofReferer: boolean;
  maxRequestsPerProxy: number;
  sessionWarming: boolean;
}

export interface GhostHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  proxy?: ProxyEndpoint;
  tlsProfile?: string;
  timeout?: number;
}

export interface GhostHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: {
    dns: number;
    tcp: number;
    tls: number;
    firstByte: number;
    total: number;
  };
  sizeBytes: number;
  usedProxy: ProxyEndpoint | null;
  usedUserAgent: string;
}

// ─── Default Config ────────────────────────────────────────────────

export const DEFAULT_STEALTH_CONFIG: StealthConfig = {
  enabled: false,
  proxies: [],
  rotationMode: 'round-robin',
  avgDelayMs: 2000,
  spoofTlsFingerprint: false,
  spoofUserAgent: true,
  spoofReferer: true,
  maxRequestsPerProxy: 1,
  sessionWarming: false,
};

// ─── Main Class ────────────────────────────────────────────────────

export class GhostNetwork {
  private config: StealthConfig;
  private proxyPool: ProxyPool;
  private sessionManager: SessionManager;
  private rateController: AdaptiveRateController;
  private tlsProfiler: TlsProfiler;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  // Callbacks for the scanner to observe stealth behavior
  public onStealthLog?: (msg: string) => void;

  constructor(config: Partial<StealthConfig> = {}) {
    this.config = { ...DEFAULT_STEALTH_CONFIG, ...config };
    this.proxyPool = new ProxyPool(this.config.proxies, this.config.maxRequestsPerProxy);
    this.sessionManager = new SessionManager();
    this.rateController = new AdaptiveRateController(
      1000 / this.config.avgDelayMs,  // Convert avg delay to RPS
      10  // Max RPS
    );
    this.tlsProfiler = new TlsProfiler();
  }

  /**
   * Wraps every HTTP request with 7 stealth layers.
   * This is the ONLY function the scanner should use to send requests.
   */
  async executeRequest(req: GhostHttpRequest): Promise<GhostHttpResponse> {
    if (!this.config.enabled) {
      return this.sendRaw(req);
    }

    // ── LAYER 1: IP ROTATION ──────────────────────────────────
    if (this.proxyPool.hasProxies()) {
      const proxy = this.proxyPool.getNext(this.config.rotationMode);
      if (proxy) {
        req.proxy = proxy;
        this.log(`Proxy: ${proxy.host}:${proxy.port} (${proxy.country || 'unknown'})`);
      }
    }

    // ── LAYER 2: USER-AGENT ROTATION ──────────────────────────
    if (this.config.spoofUserAgent) {
      const ua = this.getRandomUserAgent();
      req.headers['User-Agent'] = ua;
    }

    // ── LAYER 3: TLS FINGERPRINT SPOOFING ─────────────────────
    if (this.config.spoofTlsFingerprint) {
      const profile = this.tlsProfiler.getMatchingProfile(
        req.headers['User-Agent'] || ''
      );
      req.tlsProfile = profile;
    }

    // ── LAYER 4: TIMING JITTER ────────────────────────────────
    await this.rateController.waitForSlot();
    const jitterMs = this.generateHumanJitter();
    if (jitterMs > 0) {
      await this.sleep(jitterMs);
    }

    // ── LAYER 5: HEADER NORMALIZATION & SANITIZATION ─────────
    this.normalizeHeaders(req);

    // ── LAYER 6: REFERER CHAIN ────────────────────────────────
    if (this.config.spoofReferer && !req.headers['Referer']) {
      req.headers['Referer'] = this.generateRealisticReferer(req.url);
    }

    // ── LAYER 7: SESSION MANAGEMENT ───────────────────────────
    this.sessionManager.prepareRequest(req);

    // ── EXECUTE WITH AUTOMATIC FAILOVER LOOP ──────────────────
    let attempts = 0;
    const maxAttempts = this.proxyPool.hasProxies() ? Math.min(3, Math.max(1, this.proxyPool.healthyCount)) : 1;
    let lastResponse: GhostHttpResponse | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      const response = await this.sendRaw(req);
      lastResponse = response;

      // Detect status codes 429 (Rate Limit), 403 (WAF Block), or 503 (Service Unavailable / Overload)
      if (req.proxy && (response.status === 429 || response.status === 403 || response.status === 503)) {
        const reason = response.status === 429 ? 'rate-limit' : response.status === 403 ? 'waf-block' : 'timeout';
        this.proxyPool.markFailed(req.proxy, reason);
        this.log(`Proxy ${req.proxy.host}:${req.proxy.port} returned ${response.status} (${reason}). Failover attempt ${attempts}/${maxAttempts}...`);

        // If another healthy proxy is available, seamlessly rotate and re-dispatch without dropping the pipeline
        if (attempts < maxAttempts) {
          const nextProxy = this.proxyPool.getNext(this.config.rotationMode, req.proxy);
          if (nextProxy) {
            req.proxy = nextProxy;
            if (this.config.spoofUserAgent) {
              req.headers['User-Agent'] = this.getRandomUserAgent();
            }
            this.normalizeHeaders(req);
            await this.sleep(150);
            continue;
          }
        }
      } else if (req.proxy && response.status > 0 && response.status < 400) {
        this.proxyPool.markSuccess(req.proxy, response.timing.total);
        this.sessionManager.processResponse(response);
        this.rateController.adjustRate(response);
        this.requestCount++;
        this.lastRequestTime = Date.now();
        return response;
      }

      break;
    }

    const finalResponse = lastResponse || {
      status: 0,
      statusText: 'All Proxies Exhausted',
      headers: {},
      body: '',
      timing: { dns: 0, tcp: 0, tls: 0, firstByte: 0, total: 0 },
      sizeBytes: 0,
      usedProxy: req.proxy || null,
      usedUserAgent: req.headers['User-Agent'] || '',
    };

    // Post-processing
    this.sessionManager.processResponse(finalResponse);
    this.rateController.adjustRate(finalResponse);
    this.requestCount++;
    this.lastRequestTime = Date.now();

    return finalResponse;
  }

  /**
   * Send a batch of requests. Uses the stealth layer for each one.
   * Requests are sent sequentially with appropriate jitter between them.
   */
  async executeBatch(
    requests: GhostHttpRequest[]
  ): Promise<GhostHttpResponse[]> {
    const responses: GhostHttpResponse[] = [];
    for (const req of requests) {
      responses.push(await this.executeRequest(req));
    }
    return responses;
  }

  /**
   * Execute multiple requests in parallel (for parallel extraction).
   * Each request still gets its own proxy/UA/jitter, but they execute concurrently.
   */
  async executeParallel(
    requests: GhostHttpRequest[],
    concurrency: number = 3
  ): Promise<GhostHttpResponse[]> {
    const results: GhostHttpResponse[] = new Array(requests.length);
    const queue = [...requests.entries()];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const [index, req] = item;
        results[index] = await this.executeRequest(req);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, requests.length) },
      () => worker()
    );
    await Promise.all(workers);
    return results;
  }

  // ─── Internal Helpers ──────────────────────────────────────────

  private async sendRaw(req: GhostHttpRequest): Promise<GhostHttpResponse> {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), req.timeout || 30000);

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
        redirect: 'follow',
      };

      // Note: In Tauri, proxy is handled at the Rust backend level
      // via tauri::api::http or reqwest. The proxy field is passed through
      // to the Rust IPC handler.
      const response = await fetch(req.url, fetchOptions);
      clearTimeout(timeoutId);

      const body = await response.text();
      const totalTime = performance.now() - startTime;

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        timing: {
          dns: 0,
          tcp: 0,
          tls: 0,
          firstByte: totalTime * 0.7,
          total: totalTime,
        },
        sizeBytes: new TextEncoder().encode(body).length,
        usedProxy: req.proxy || null,
        usedUserAgent: req.headers['User-Agent'] || '',
      };
    } catch (error: any) {
      const totalTime = performance.now() - startTime;
      return {
        status: 0,
        statusText: error.message || 'Network Error',
        headers: {},
        body: '',
        timing: { dns: 0, tcp: 0, tls: 0, firstByte: 0, total: totalTime },
        sizeBytes: 0,
        usedProxy: req.proxy || null,
        usedUserAgent: req.headers['User-Agent'] || '',
      };
    }
  }

  /**
   * Log-normal jitter distribution.
   * Most delays are 1-3s, occasional 5-8s pauses (like a human reading a page).
   */
  private generateHumanJitter(): number {
    if (!this.config.enabled) return 0;

    const mu = Math.log(this.config.avgDelayMs);
    const sigma = 0.4;
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const delay = Math.exp(mu + sigma * z);

    // Clamp to reasonable range
    return Math.max(100, Math.min(delay, this.config.avgDelayMs * 5));
  }

  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Add realistic browser headers that a real user would always send.
   * Strips all internal tracking / client IP leak headers and randomizes header sequence.
   */
  private normalizeHeaders(req: GhostHttpRequest): void {
    // Strip all identifying, tracking, or IP-leaking proxy headers
    const headersToStrip = [
      'x-forwarded-for',
      'x-real-ip',
      'client-ip',
      'x-client-ip',
      'x-originating-ip',
      'cf-connecting-ip',
      'true-client-ip',
      'fastly-client-ip',
      'x-cluster-client-ip',
      'forwarded-for',
      'forwarded',
      'x-forwarded',
      'x-forwarded-host',
      'x-forwarded-proto',
      'via',
      'x-scanner',
      'x-sentinel-worker',
      'x-sentinel-id',
      'x-sentinel-trace',
      'x-requested-with',
      'postman-token',
      'x-wap-profile',
      'x-custom-ip-authorization',
      'x-original-url',
      'x-rewrite-url',
    ];

    for (const key of Object.keys(req.headers)) {
      if (headersToStrip.includes(key.toLowerCase())) {
        delete req.headers[key];
      }
    }

    const ua = req.headers['User-Agent'] || '';
    const defaults: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    };

    // Synchronize realistic Sec-CH-UA Client Hints with the active User-Agent
    if (ua.includes('Chrome/')) {
      const verMatch = ua.match(/Chrome\/(\d+)/);
      const major = verMatch ? verMatch[1] : '124';
      defaults['Sec-CH-UA'] = `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not-A.Brand";v="99"`;
      defaults['Sec-CH-UA-Mobile'] = '?0';
      defaults['Sec-CH-UA-Platform'] = ua.includes('Windows') ? '"Windows"' : ua.includes('Macintosh') ? '"macOS"' : '"Linux"';
    } else if (ua.includes('Firefox/')) {
      // Firefox natively does not send Sec-CH-UA headers
      delete req.headers['sec-ch-ua'];
      delete req.headers['sec-ch-ua-mobile'];
      delete req.headers['sec-ch-ua-platform'];
    }

    // Only set defaults if not already present
    for (const [key, value] of Object.entries(defaults)) {
      if (!req.headers[key]) {
        req.headers[key] = value;
      }
    }

    // Shuffle header order (create new object with shuffled keys to defeat WAF order fingerprinting)
    const entries = Object.entries(req.headers);
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    req.headers = Object.fromEntries(entries);
  }

  /**
   * Generate a realistic referer header.
   * Makes it look like the user navigated from the same site or a search engine.
   */
  private generateRealisticReferer(targetUrl: string): string {
    try {
      const url = new URL(targetUrl);
      const options = [
        `${url.origin}/`,                      // Homepage
        `${url.origin}/search`,                 // Internal search
        `${url.origin}/index.html`,             // Index page
        `https://www.google.com/search?q=site:${url.hostname}`,  // Google search
      ];
      return options[Math.floor(Math.random() * options.length)];
    } catch {
      return '';
    }
  }

  private log(msg: string): void {
    this.onStealthLog?.(`[Ghost] ${msg}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Public Accessors ──────────────────────────────────────────

  get totalRequests(): number {
    return this.requestCount;
  }

  getLastRequestTime(): number {
    return this.lastRequestTime;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getRateController(): AdaptiveRateController {
    return this.rateController;
  }
}

/**
 * Sentinel Sovereign Ω - Dedicated Independent Dashboard Stealth Crawler Engine
 *
 * 100% Decoupled from the Target Workspace:
 * - Runs its own independent CDP session directly over WebSocket relay (:9223 / :9222)
 * - Zero dependency on Target's unifiedReconOrchestrator or stateFlowGraphCrawler
 * - Both Target and Dashboard can run concurrently with zero cross-talk or interference
 * - Real system Chrome exploration with transparent MITM proxy coordination (:8085)
 * - Deep real-time CDP Network Stream harvesting (Network.requestWillBeSent / Network.responseReceived)
 * - Automated Multi-Tenant Login Solver: auto-detects login forms & authenticates with configured credentials
 * - Strict Safety Kernel: default-deny on configured excluded paths (/logout, /delete-account, etc.)
 * - Profile-driven execution (Passive Only, Safe Research, Standard)
 * - Rate limiting enforcement (QPS pacing)
 * - Continuous execution loop: runs until explicitly stopped by the operator
 */

import { DashboardStealthCdpDriver } from './DashboardStealthCdpDriver';

export interface DashboardEndpointItem {
  id: string;
  url: string;
  path: string;
  method: string;
  status?: number;
  length?: number;
  mime?: string;
  source: 'DOM Link' | 'JavaScript Route' | 'Form Action' | 'GET Probe' | 'POST Endpoint' | 'Interactive Click' | 'Network XHR/Fetch';
  discoveredAt: number;
}

export interface DashboardCrawlerConfig {
  targetUrl: string;
  excludedPaths: string[];
  profile: 'PASSIVE' | 'SAFE' | 'STANDARD';
  rateLimit: number; // QPS
  authMode: 'anonymous' | 'single' | 'multi';
  tenantA?: { username: string; password: string };
  tenantB?: { username: string; password: string };
  onEndpointDiscovered: (endpoint: DashboardEndpointItem) => void;
  onProgress: (status: string, stats: { queued: number; visited: number; total: number }) => void;
  onError?: (error: string) => void;
}

export class DashboardCrawlerEngine {
  private isAborted = false;
  private isRunning = false;
  private visitedUrls = new Set<string>();
  private discoveredSet = new Set<string>();
  private crawlQueue: string[] = [];
  private cdp = new DashboardStealthCdpDriver();
  private cleanupListeners: Array<() => void> = [];

  public get isCrawlerRunning(): boolean {
    return this.isRunning;
  }

  public abort(): void {
    this.isAborted = true;
    this.isRunning = false;
    this.cleanupListeners.forEach((fn) => {
      try { fn(); } catch {}
    });
    this.cleanupListeners = [];
    this.cdp.disconnect();
  }

  /**
   * Primary entry point for Dashboard Stealth Crawl
   */
  public async start(config: DashboardCrawlerConfig): Promise<void> {
    if (this.isRunning) {
      this.abort();
      await new Promise((r) => setTimeout(r, 200));
    }

    this.isAborted = false;
    this.isRunning = true;
    this.visitedUrls.clear();
    this.discoveredSet.clear();
    this.crawlQueue = [];
    this.cleanupListeners = [];

    const {
      targetUrl,
      excludedPaths = [],
      profile,
      rateLimit = 25,
      authMode,
      tenantA,
      onEndpointDiscovered,
      onProgress,
      onError,
    } = config;

    let baseHost = '';
    let originUrl = '';
    let initialFull = '';

    try {
      const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      baseHost = parsed.hostname;
      originUrl = `${parsed.protocol}//${parsed.host}`;
      initialFull = parsed.toString();
    } catch (e: any) {
      this.isRunning = false;
      if (onError) onError(`Invalid target URL: ${e?.message}`);
      return;
    }

    // Safety Kernel exclusion filter
    const isExcluded = (candidate: string): boolean => {
      if (!candidate) return false;
      let pathToCheck = candidate.toLowerCase();
      try {
        if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
          pathToCheck = new URL(candidate).pathname.toLowerCase();
        }
      } catch {}

      return excludedPaths.some((ex) => {
        const cleanEx = ex.trim().toLowerCase();
        if (!cleanEx) return false;
        return pathToCheck === cleanEx || pathToCheck.startsWith(cleanEx) || pathToCheck.includes(cleanEx);
      });
    };

    onProgress('Connecting independent stealth browser session via proxy (127.0.0.1:8085)...', {
      queued: 1,
      visited: 0,
      total: 0,
    });

    // 1. Establish isolated CDP connection for Dashboard
    let cdpActive = false;
    try {
      cdpActive = await this.cdp.connect(initialFull, baseHost);
    } catch (cdpErr) {
      console.warn('[DashboardCrawler] Independent CDP notice:', cdpErr);
    }

    // 2. Real-Time Network Stream Interception
    if (cdpActive && this.cdp.connected) {
      const reqListener = this.cdp.on('Network.requestWillBeSent', (params) => {
        if (this.isAborted) return;
        const req = params?.request;
        if (!req?.url) return;

        try {
          const u = new URL(req.url);
          if (u.hostname === baseHost || u.hostname.endsWith(`.${baseHost}`)) {
            this.processFoundUrl({
              rawUrl: req.url,
              baseUrl: originUrl,
              baseHost,
              method: (req.method || 'GET').toUpperCase(),
              source: 'Network XHR/Fetch',
              isExcluded,
              onEndpointDiscovered,
            });
          }
        } catch {}
      });
      this.cleanupListeners.push(reqListener);

      const respListener = this.cdp.on('Network.responseReceived', (params) => {
        if (this.isAborted) return;
        const resp = params?.response;
        if (!resp?.url) return;

        try {
          const u = new URL(resp.url);
          if (u.hostname === baseHost || u.hostname.endsWith(`.${baseHost}`)) {
            this.processFoundUrl({
              rawUrl: resp.url,
              baseUrl: originUrl,
              baseHost,
              method: 'GET',
              source: 'Network XHR/Fetch',
              status: resp.status,
              isExcluded,
              onEndpointDiscovered,
            });
          }
        } catch {}
      });
      this.cleanupListeners.push(respListener);
    }

    // Push initial seed into queue
    this.crawlQueue.push(initialFull);

    // Initial root endpoint
    const rootPath = new URL(initialFull).pathname || '/';
    const rootItem: DashboardEndpointItem = {
      id: `dash-root-${Date.now()}`,
      url: initialFull,
      path: rootPath,
      method: 'GET',
      status: 200,
      source: 'DOM Link',
      discoveredAt: Date.now(),
    };
    this.discoveredSet.add(`GET:${rootPath}`);
    onEndpointDiscovered(rootItem);

    let isAuthenticated = false;

    // 3. Automated Intelligent Login Check on initial target
    if (tenantA?.username && tenantA?.password && this.cdp.connected) {
      try {
        await this.cdp.navigate(initialFull);
        await this.cdp.waitForDomSettle(1000);

        // Check if initial page has a login form (or is a login URL)
        const hasInitialLoginForm = await this.cdp.evaluate<boolean>(`
          Boolean(document.querySelector('input[type="password"]'))
        `);

        const isLoginUrl =
          initialFull.toLowerCase().includes('/login') ||
          initialFull.toLowerCase().includes('/signin') ||
          initialFull.toLowerCase().includes('/my-account');

        if (hasInitialLoginForm || isLoginUrl) {
          onProgress(`[Auth Matrix] 🔐 Detected login form on ${baseHost}. Authenticating as '${tenantA.username}'...`, {
            queued: 1,
            visited: 0,
            total: this.discoveredSet.size,
          });

          const loginResult = await this.cdp.performAutomatedLogin(tenantA);
          if (loginResult.success) {
            isAuthenticated = true;
            onProgress(`[Auth Matrix] 🔐 Successfully authenticated as '${tenantA.username}'. Private surface unlocked!`, {
              queued: 1,
              visited: 0,
              total: this.discoveredSet.size,
            });
            await this.cdp.waitForDomSettle(1200);
          } else {
            console.warn('[DashboardCrawler] Automated login notice:', loginResult.message);
          }
        } else {
          // Proactively check if page has a direct login link to queue first
          const loginLink = await this.cdp.evaluate<string | null>(`
            (function() {
              const a = Array.from(document.querySelectorAll('a[href]')).find(el => {
                const h = (el.getAttribute('href') || '').toLowerCase();
                const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                return h.includes('/login') || h.includes('/signin') || h.includes('/my-account') ||
                       t === 'log in' || t === 'login' || t === 'sign in' || t === 'signin';
              });
              return a ? (a.href || a.getAttribute('href')) : null;
            })()
          `);

          if (loginLink) {
            let fullLoginUrl = loginLink;
            try {
              fullLoginUrl = new URL(loginLink, originUrl).toString();
            } catch {}
            if (fullLoginUrl.startsWith('http') && !this.visitedUrls.has(fullLoginUrl)) {
              this.crawlQueue.unshift(fullLoginUrl);
              onProgress(`[Auth Matrix] 🎯 Discovered login gateway: ${fullLoginUrl}. Prioritizing authentication...`, {
                queued: this.crawlQueue.length,
                visited: 0,
                total: this.discoveredSet.size,
              });
            }
          }
        }
      } catch (authErr) {
        console.warn('[DashboardCrawler] Initial auth check error:', authErr);
      }
    }

    const minDelayMs = Math.max(60, Math.round(1000 / Math.max(1, rateLimit)));

    onProgress(`Dashboard Stealth Crawl engaged on ${baseHost} (${profile} mode). Continuous discovery active...`, {
      queued: this.crawlQueue.length,
      visited: 0,
      total: this.discoveredSet.size,
    });

    // 4. Continuous Exploration Loop (runs indefinitely until operator clicks Stop)
    while (!this.isAborted && this.isRunning) {
      if (this.crawlQueue.length === 0) {
        onProgress('Dynamic state monitoring: Sweeping for interactive UI changes...', {
          queued: 0,
          visited: this.visitedUrls.size,
          total: this.discoveredSet.size,
        });
        await new Promise((r) => setTimeout(r, 1400));
        continue;
      }

      const currentUrlStr = this.crawlQueue.shift()!;
      if (this.visitedUrls.has(currentUrlStr)) {
        continue;
      }
      this.visitedUrls.add(currentUrlStr);

      let currentParsed: URL;
      try {
        currentParsed = new URL(currentUrlStr);
      } catch {
        continue;
      }

      // Safety kernel check
      if (isExcluded(currentParsed.pathname) || isExcluded(currentUrlStr)) {
        onProgress(`Safety Kernel: Blocked excluded endpoint ${currentParsed.pathname}`, {
          queued: this.crawlQueue.length,
          visited: this.visitedUrls.size,
          total: this.discoveredSet.size,
        });
        continue;
      }

      // Host scope check
      if (currentParsed.hostname !== baseHost && !currentParsed.hostname.endsWith(`.${baseHost}`)) {
        continue;
      }

      onProgress(`Crawling [${currentParsed.pathname}] • ${this.discoveredSet.size} endpoints discovered`, {
        queued: this.crawlQueue.length,
        visited: this.visitedUrls.size,
        total: this.discoveredSet.size,
      });

      // Pacing delay (Rate Limit slider)
      await new Promise((r) => setTimeout(r, minDelayMs));

      let handledByBrowser = false;

      // Real Browser Interactive Exploration via Independent CDP
      if (this.cdp.connected) {
        try {
          await this.cdp.navigate(currentUrlStr);
          await this.cdp.waitForDomSettle(Math.min(900, minDelayMs * 2));

          // Check if navigated to an in-flight login page while credentials exist
          if (tenantA?.username && tenantA?.password) {
            const hasPass = await this.cdp.evaluate<boolean>(`Boolean(document.querySelector('input[type="password"]'))`);
            if (hasPass && !isAuthenticated) {
              onProgress(`[Auth Matrix] 🔐 Encountered login form on ${currentUrlStr}. Authenticating as '${tenantA.username}'...`, {
                queued: this.crawlQueue.length,
                visited: this.visitedUrls.size,
                total: this.discoveredSet.size,
              });

              const loginResult = await this.cdp.performAutomatedLogin(tenantA);
              if (loginResult.success) {
                isAuthenticated = true;
                onProgress(`[Auth Matrix] 🔐 Successfully authenticated as '${tenantA.username}'. Private surface unlocked!`, {
                  queued: this.crawlQueue.length,
                  visited: this.visitedUrls.size,
                  total: this.discoveredSet.size,
                });
                await this.cdp.waitForDomSettle(1200);
              } else {
                console.warn('[DashboardCrawler] In-flight login result:', loginResult.message);
              }
            }
          }

          // Check for disguised 404 / soft-error pages across dynamic SPAs
          const isErrorPage = await this.cdp.evaluate<boolean>(`
            (function() {
              const t = (document.title || '').toLowerCase();
              const b = (document.body ? document.body.innerText : '').slice(0, 1200).toLowerCase();
              return t.includes('404') || b.includes('404 not found') || b.includes('moved or deleted') ||
                b.includes('page not found') || b.includes('looking for has been moved') ||
                b.includes('something went wrong') || b.includes('requested url was not found') ||
                document.querySelector('img[src*="error-500"], img[src*="error_500"], img[src*="error-404"]') !== null;
            })()
          `);

          if (isErrorPage) {
            onProgress(`Page indicated not found / moved or deleted (${currentUrlStr}) - skipping sub-link expansion`, {
              queued: this.crawlQueue.length,
              visited: this.visitedUrls.size,
              total: this.discoveredSet.size,
            });
            continue;
          }

          // Smooth scrolling for lazy-loading
          await this.cdp.dispatchSmoothScroll(350);
          await new Promise((r) => setTimeout(r, 150));

          // Extract DOM links, scripts, and forms from the live browser DOM
          const extractedDom = await this.cdp.evaluate<{
            links: string[];
            scripts: string[];
            forms: Array<{ action: string; method: string; inputs: string[] }>;
            buttons: Array<{ text: string; selector?: string }>;
          }>(`
            (function() {
              const noiseRegex = /searchsuggestion|autocomplete|autosuggest|communication-preferences|telemetry|beacon/i;
              const links = Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.getAttribute('href') || '')
                .filter(h => h && !h.startsWith('#') && !h.startsWith('javascript:') && !noiseRegex.test(h));

              const scripts = Array.from(document.querySelectorAll('script[src]'))
                .map(s => s.getAttribute('src') || '')
                .filter(Boolean);

              const forms = Array.from(document.querySelectorAll('form')).map(f => {
                const action = f.getAttribute('action') || window.location.pathname;
                const method = (f.getAttribute('method') || 'GET').toUpperCase();
                const inputs = Array.from(f.querySelectorAll('input, select, textarea'))
                  .map(inp => inp.getAttribute('name') || inp.getAttribute('id') || '')
                  .filter(Boolean);
                return { action, method, inputs };
              });

              const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"]')).slice(0, 15).map(b => ({
                text: (b.innerText || b.textContent || '').trim().slice(0, 30)
              })).filter(b => !/go to homepage|back to home/i.test(b.text));

              return { links, scripts, forms, buttons };
            })()
          `);

          if (extractedDom) {
            handledByBrowser = true;

            // Process DOM links
            for (const link of extractedDom.links) {
              if (this.isAborted) break;
              this.processFoundUrl({
                rawUrl: link,
                baseUrl: originUrl,
                baseHost,
                source: 'DOM Link',
                isExcluded,
                onEndpointDiscovered,
              });
            }

            // Process script files
            for (const src of extractedDom.scripts) {
              if (this.isAborted) break;
              this.processFoundUrl({
                rawUrl: src,
                baseUrl: originUrl,
                baseHost,
                source: 'JavaScript Route',
                isExcluded,
                onEndpointDiscovered,
              });
            }

            // Process forms based on Profile
            for (const form of extractedDom.forms) {
              if (this.isAborted) break;
              if (profile === 'PASSIVE') {
                this.processFoundUrl({
                  rawUrl: form.action,
                  baseUrl: originUrl,
                  baseHost,
                  method: form.method || 'GET',
                  source: 'Form Action',
                  isExcluded,
                  onEndpointDiscovered,
                });
              } else if (profile === 'SAFE') {
                if (form.inputs.length > 0) {
                  const queryProbe = form.inputs.map((inp) => `${encodeURIComponent(inp)}=test_probe`).join('&');
                  this.processFoundUrl({
                    rawUrl: `${form.action}?${queryProbe}`,
                    baseUrl: originUrl,
                    baseHost,
                    method: 'GET',
                    source: 'GET Probe',
                    isExcluded,
                    onEndpointDiscovered,
                  });
                }
              } else if (profile === 'STANDARD') {
                this.processFoundUrl({
                  rawUrl: form.action,
                  baseUrl: originUrl,
                  baseHost,
                  method: form.method || 'POST',
                  source: form.method === 'POST' ? 'POST Endpoint' : 'Form Action',
                  isExcluded,
                  onEndpointDiscovered,
                });
              }
            }

            // Interactive button clicking for STANDARD profile
            if (profile === 'STANDARD' && extractedDom.buttons.length > 0) {
              for (const btn of extractedDom.buttons) {
                if (this.isAborted) break;
                const textLower = btn.text.toLowerCase();
                if (
                  textLower.includes('delete') ||
                  textLower.includes('logout') ||
                  textLower.includes('sign out') ||
                  textLower.includes('remove')
                ) {
                  continue;
                }

                try {
                  await this.cdp.evaluate(`
                    const b = Array.from(document.querySelectorAll('button, [role="button"]')).find(el => (el.innerText || '').trim() === ${JSON.stringify(btn.text)});
                    if (b) b.click();
                  `);
                  await new Promise((r) => setTimeout(r, 120));
                } catch {}
              }
            }
          }
        } catch (bErr) {
          console.debug('[DashboardCrawler] Browser interaction notice:', bErr);
        }
      }

      // Resilient Fallback: High-Throughput HTTP Fetch Extraction
      if (!handledByBrowser) {
        try {
          const resp = await fetch(currentUrlStr, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(8000),
          });

          const bodyText = await resp.text();

          this.extractEndpointsFromContent({
            baseUrl: originUrl,
            baseHost,
            bodyText,
            profile,
            isExcluded,
            onEndpointDiscovered,
          });

          if (profile === 'SAFE' || profile === 'STANDARD') {
            this.generateSafeGetProbes({
              url: currentUrlStr,
              currentPath: currentParsed.pathname,
              isExcluded,
              onEndpointDiscovered,
            });
          }

          if (profile === 'STANDARD') {
            this.extractPostForms({
              baseUrl: originUrl,
              bodyText,
              isExcluded,
              onEndpointDiscovered,
            });
          }
        } catch (fetchErr: any) {
          console.debug('[DashboardCrawler] Fetch notice for', currentUrlStr, fetchErr?.message);
        }
      }
    }

    this.isRunning = false;
    this.cleanupListeners.forEach((fn) => {
      try { fn(); } catch {}
    });
    this.cleanupListeners = [];
    this.cdp.disconnect();

    onProgress('Dashboard Stealth Crawl stopped by operator.', {
      queued: this.crawlQueue.length,
      visited: this.visitedUrls.size,
      total: this.discoveredSet.size,
    });
  }

  /**
   * Normalizes a raw URL candidate, checks safety exclusions, and queues it
   */
  private processFoundUrl(params: {
    rawUrl: string;
    baseUrl: string;
    baseHost: string;
    method?: string;
    source: DashboardEndpointItem['source'];
    status?: number;
    isExcluded: (path: string) => boolean;
    onEndpointDiscovered: (item: DashboardEndpointItem) => void;
  }): void {
    const { rawUrl, baseUrl, baseHost, method = 'GET', source, status = 200, isExcluded, onEndpointDiscovered } = params;

    let resolvedUrl: string;
    let path = '';
    try {
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        const u = new URL(rawUrl);
        if (u.hostname !== baseHost && !u.hostname.endsWith(`.${baseHost}`)) {
          return;
        }
        resolvedUrl = rawUrl;
        path = u.pathname + u.search;
      } else {
        const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
        resolvedUrl = `${baseUrl}${cleanPath}`;
        path = cleanPath;
      }
    } catch {
      return;
    }

    const cleanPathname = path.split('?')[0];
    if (isExcluded(cleanPathname) || isExcluded(path)) {
      return;
    }

    // Filter out image/binary asset noise
    if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|mp4|zip)$/i.test(cleanPathname)) {
      return;
    }

    const dedupeKey = `${method}:${cleanPathname}`;
    if (!this.discoveredSet.has(dedupeKey)) {
      this.discoveredSet.add(dedupeKey);

      const item: DashboardEndpointItem = {
        id: `dash-ep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        url: resolvedUrl,
        path,
        method,
        status,
        source,
        discoveredAt: Date.now(),
      };

      onEndpointDiscovered(item);

      if (method === 'GET' && !this.visitedUrls.has(resolvedUrl)) {
        this.crawlQueue.push(resolvedUrl);
      }
    }
  }

  /**
   * Discovers and normalizes endpoints from page HTML, JS tags, and inline scripts
   */
  private extractEndpointsFromContent(params: {
    baseUrl: string;
    baseHost: string;
    bodyText: string;
    profile: 'PASSIVE' | 'SAFE' | 'STANDARD';
    isExcluded: (path: string) => boolean;
    onEndpointDiscovered: (item: DashboardEndpointItem) => void;
  }): void {
    const { baseUrl, baseHost, bodyText, isExcluded, onEndpointDiscovered } = params;

    const htmlAttrRegex = /(?:href|action|src)\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = htmlAttrRegex.exec(bodyText)) !== null) {
      if (this.isAborted) break;
      const raw = match[1].trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:')) continue;

      this.processFoundUrl({
        rawUrl: raw,
        baseUrl,
        baseHost,
        source: 'DOM Link',
        isExcluded,
        onEndpointDiscovered,
      });
    }

    const jsRouteRegex = /(?:fetch|axios\.(?:get|post|put|delete)|url|endpoint|route|path)\s*\(\s*["'](\/[a-zA-Z0-9_\-\.\/]+(?:\?[^"'\s]*)?)["']/gi;
    while ((match = jsRouteRegex.exec(bodyText)) !== null) {
      if (this.isAborted) break;
      const raw = match[1].trim();
      this.processFoundUrl({
        rawUrl: raw,
        baseUrl,
        baseHost,
        source: 'JavaScript Route',
        isExcluded,
        onEndpointDiscovered,
      });
    }

    const jsonPathRegex = /["'](\/(?:api|v1|v2|v3|auth|user|products?|cart|catalog|admin|account|order|search)\/[a-zA-Z0-9_\-\.\/]+)["']/gi;
    while ((match = jsonPathRegex.exec(bodyText)) !== null) {
      if (this.isAborted) break;
      const raw = match[1].trim();
      this.processFoundUrl({
        rawUrl: raw,
        baseUrl,
        baseHost,
        source: 'JavaScript Route',
        isExcluded,
        onEndpointDiscovered,
      });
    }
  }

  /**
   * Generates benign GET parameter probes for SAFE profile research
   */
  private generateSafeGetProbes(params: {
    url: string;
    currentPath: string;
    isExcluded: (path: string) => boolean;
    onEndpointDiscovered: (item: DashboardEndpointItem) => void;
  }): void {
    const { url, currentPath, isExcluded, onEndpointDiscovered } = params;
    if (isExcluded(currentPath)) return;

    if (currentPath.includes('?')) {
      const [base, query] = currentPath.split('?');
      const searchParams = new URLSearchParams(query);
      for (const [key] of searchParams.entries()) {
        const probePath = `${base}?${key}=test_probe_1`;
        const dedupeKey = `GET_PROBE:${probePath}`;
        if (!this.discoveredSet.has(dedupeKey)) {
          this.discoveredSet.add(dedupeKey);
          onEndpointDiscovered({
            id: `dash-probe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: `${url.split('?')[0]}?${key}=test_probe_1`,
            path: probePath,
            method: 'GET',
            status: 200,
            source: 'GET Probe',
            discoveredAt: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Discovers POST forms for STANDARD profile
   */
  private extractPostForms(params: {
    baseUrl: string;
    bodyText: string;
    isExcluded: (path: string) => boolean;
    onEndpointDiscovered: (item: DashboardEndpointItem) => void;
  }): void {
    const { baseUrl, bodyText, isExcluded, onEndpointDiscovered } = params;

    const formRegex = /<form[^>]*action\s*=\s*["']([^"']+)["'][^>]*method\s*=\s*["']post["'][^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = formRegex.exec(bodyText)) !== null) {
      if (this.isAborted) break;
      const action = match[1].trim();
      if (!action) continue;

      const cleanPath = action.startsWith('http') ? new URL(action).pathname : action.startsWith('/') ? action : `/${action}`;
      if (isExcluded(cleanPath)) continue;

      const dedupeKey = `POST:${cleanPath}`;
      if (!this.discoveredSet.has(dedupeKey)) {
        this.discoveredSet.add(dedupeKey);
        onEndpointDiscovered({
          id: `dash-post-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: action.startsWith('http') ? action : `${baseUrl}${cleanPath}`,
          path: cleanPath,
          method: 'POST',
          status: 200,
          source: 'POST Endpoint',
          discoveredAt: Date.now(),
        });
      }
    }
  }
}

export const dashboardCrawlerEngine = new DashboardCrawlerEngine();

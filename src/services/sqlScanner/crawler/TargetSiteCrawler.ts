/**
 * Sentinel SQL X — Sovereign Target Site, API & Workflow Crawler
 *
 * State-of-the-art security crawler combining the strengths of:
 * - Katana (Deep client-side JS AST/regex route extraction, form mapping, JSON payloads)
 * - GoSpider (HTML comments, data-* attributes, metadata mining, response headers)
 * - Arjun & ParamMiner (Unkeyed parameters, dynamic query sinks)
 * - Uro & Academic Crawler Research (Smart URL clustering, crawler trap & loop prevention)
 * - Second-Order Orchestration (Store vs Trigger surface classification)
 */

import { ipcClient } from '../../../ipc/client';
import { WafDetector } from '../WafDetector';
import { RequestSigner, SigningProfile } from '../engine/RequestSigner';
import { ClearanceHeartbeat } from './ClearanceHeartbeat';
import { CanvasAstExtractor } from '../engine/CanvasAstExtractor';
import { StreamProtocolMapper } from '../engine/StreamProtocolMapper';
import { EphemeralNonceReplenisher } from '../engine/EphemeralNonceReplenisher';
import { ProxyRotator } from '../engine/ProxyRotator';
import { HoneypotFilter } from '../engine/HoneypotFilter';
import { RetryAfterParser } from '../engine/RetryAfterParser';
import { HistoricalArchiveMiner } from '../engine/HistoricalArchiveMiner';
import { DynamicJsEvaluator } from '../engine/DynamicJsEvaluator';
import { SmartMutationFrontier } from '../engine/SmartMutationFrontier';

export interface DiscoveredEndpoint {
  id: string;
  host: string;
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  source:
    | 'proxy'
    | 'robots.txt'
    | 'sitemap.xml'
    | 'html_form'
    | 'html_link'
    | 'html_comment'
    | 'html_data_attr'
    | 'js_endpoint'
    | 'openapi'
    | 'graphql'
    | 'header'
    | 'heuristic_probe';
  params: { name: string; type: 'query' | 'body_form' | 'body_json' | 'path'; sampleValue: string }[];
  sqliScore: number; // 0 - 100
  isSqliCandidate: boolean;
  sqliReason: string;
  rawRequest: string;
  statusCode?: number;
  timestamp: number;
  workflowType?: 'store' | 'trigger' | 'read_only';
  clusterSignature?: string;
}

export interface CrawlOptions {
  crawlMode?: 'machine' | 'hybrid';
  maxDepth?: number;
  maxPages?: number;
  concurrency?: number;
  followJsEndpoints?: boolean;
  probeApiSchemas?: boolean;
  probeFrameworkManifests?: boolean;
  scanExternalScripts?: boolean;
  maxScriptBundles?: number;
  abortSignal?: AbortSignal;
  onEndpointDiscovered?: (ep: DiscoveredEndpoint) => void;
  headers?: Record<string, string>;
  cookies?: string;
  delayMs?: number;
  signingProfile?: SigningProfile;
  heartbeatTtlMinutes?: number;
  nonceReplenisher?: EphemeralNonceReplenisher;
  proxyRotator?: ProxyRotator;
  enableHistoricalMining?: boolean;
  enableSmartMutations?: boolean;
}

export class TargetSiteCrawler {
  private signer?: RequestSigner;
  private heartbeat?: ClearanceHeartbeat;
  private isAborted: boolean = false;

  /**
   * Aborts any running crawl in progress immediately.
   */
  public abort(): void {
    this.isAborted = true;
  }

  private static HIGH_SQLI_PARAM_REGEX = /^(id|user|username|uid|acc|account|cat|category|prod|product|item|search|q|query|term|sort|order|by|filter|page|offset|limit|dir|view|file|lang|role|type|status|email|token|debug|preview|format)$/i;

  private static STATIC_ASSET_REGEX = /\.(css|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|mp4|webm|pdf|avi|mov|mp3|ogg|wav|wasm)(\?|$)/i;

  private static SAFETY_BLOCKED_PATHS = [
    '/logout', '/signout', '/log-out', '/sign-out', '/logoff',
    '/auth/logout', '/auth/revoke', '/oauth/revoke',
    '/delete-account', '/account/delete', '/remove-account',
    '/reset-password', '/password/reset',
  ];

  /**
   * Safety guard to avoid terminating authenticated sessions or executing irreversible state drops.
   */
  public static isSafetyBlocked(path: string): boolean {
    const lower = path.toLowerCase();
    return this.SAFETY_BLOCKED_PATHS.some((blocked) => lower.includes(blocked));
  }

  /**
   * Checks if an HTTP response represents a 404 Not Found (hard 404 or soft 404 error page).
   * Ensures only endpoints that return real, valid data with a proper response are displayed.
   */
  public static isNotFoundResponse(statusCode?: number, body?: string): boolean {
    if (statusCode === 404) return true;
    if (!body || body.trim().length === 0) {
      return statusCode !== undefined && statusCode >= 400;
    }
    const lower = body.toLowerCase();
    return (
      lower.includes('<title>404') ||
      lower.includes('404 not found') ||
      lower.includes('404 page not found') ||
      lower.includes('page not found') ||
      lower.includes('resource not found') ||
      lower.includes('route not found') ||
      lower.includes('cannot get /') ||
      lower.includes('cannot post /') ||
      lower.includes('"error":"not found"') ||
      lower.includes('"message":"not found"') ||
      lower.includes('endpoint does not exist') ||
      lower.includes('the requested url was not found')
    );
  }

  /**
   * Detects if an HTTP response is a WAF challenge, verification screen, or anti-bot interstitial.
   * Challenge pages MUST NEVER be registered as legitimate application attack surfaces.
   */
  public static isChallengeOrWafResponse(statusCode?: number, body?: string): boolean {
    if (!body || body.trim().length === 0) return false;
    const lower = body.toLowerCase();
    return (
      lower.includes('please wait while your request is being verified') ||
      lower.includes('request is being verified') ||
      lower.includes('cf-turnstile') ||
      lower.includes('just a moment...') ||
      lower.includes('checking your browser') ||
      lower.includes('attention required! | cloudflare') ||
      lower.includes('cloudflare ray id') ||
      lower.includes('challenge-running') ||
      lower.includes('waf-challenge') ||
      lower.includes('ddos-guard') ||
      lower.includes('security check') ||
      lower.includes('captcha-box') ||
      lower.includes('imperva') ||
      (statusCode === 403 && (lower.includes('access denied') || lower.includes('forbidden') || lower.includes('blocked')))
    );
  }

  /**
   * Applies Gaussian/Poisson randomized jitter around a base delay to mimic natural human/browser timing.
   * Prevents rigid delta-t timing detection by modern WAF rate limiters.
   */
  public static async applyPoliteJitter(baseDelayMs: number = 150): Promise<void> {
    const jitter = (Math.random() - 0.5) * (baseDelayMs * 0.8);
    const delay = Math.max(30, Math.floor(baseDelayMs + jitter));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Classifies an endpoint into a Second-Order Workflow role:
   * - 'store': State-mutating data ingestion (POST/PUT/PATCH to register, profile, comments, forms)
   * - 'trigger': State-reflecting read endpoints (GET to admin, audit logs, reports, search, dashboards)
   * - 'read_only': Benign or idempotent views
   */
  public static classifyWorkflowType(method: string, path: string): 'store' | 'trigger' | 'read_only' {
    const m = method.toUpperCase();
    const lower = path.toLowerCase();

    if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
      if (/(register|signup|profile|user|account|comment|review|feedback|create|add|new|update|edit|settings|upload|submit|order|checkout)/i.test(lower)) {
        return 'store';
      }
      return 'store';
    }

    if (m === 'GET') {
      if (/(admin|audit|report|log|dashboard|history|activity|feed|export|csv|pdf|summary|search|notifications|queue)/i.test(lower)) {
        return 'trigger';
      }
    }

    return 'read_only';
  }

  /**
   * Generates a structural cluster signature for URL deduplication (Uro-style).
   * Maps `/items/123?sort=asc&cat=2` and `/items/456?cat=5&sort=desc` to the same cluster:
   * `/items/{id}?cat&sort`
   */
  public static getClusterSignature(pathname: string, search: string): string {
    const clusteredPath = pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
      .replace(/\b[0-9a-f]{24,64}\b/gi, '{hash}')
      .replace(/\/\d+(?=\/|$)/g, '/{id}');

    if (!search || search === '?') return clusteredPath;
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const sortedKeys = Array.from(new Set(params.keys())).sort().join('&');
    return `${clusteredPath}?${sortedKeys}`;
  }

  /**
   * Detects recursive crawler traps (e.g. `/dir/dir/dir/dir` or repeating calendar loops).
   */
  public static isCrawlerTrap(pathname: string): boolean {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 8) return true;

    for (let i = 0; i < segments.length - 2; i++) {
      if (segments[i] === segments[i + 1] && segments[i] === segments[i + 2]) return true;
      if (i + 3 < segments.length && segments[i] === segments[i + 2] && segments[i + 1] === segments[i + 3]) {
        return true;
      }
    }
    return false;
  }

  public isSafetyBlocked(path: string): boolean {
    return TargetSiteCrawler.isSafetyBlocked(path);
  }

  public isCrawlerTrap(pathname: string): boolean {
    return TargetSiteCrawler.isCrawlerTrap(pathname);
  }

  public getClusterSignature(pathname: string, search: string): string {
    return TargetSiteCrawler.getClusterSignature(pathname, search);
  }

  /**
   * Evaluates a URL path and parameter set for SQL injection attack surface potential.
   */
  public static scoreSqliSurface(
    method: string,
    path: string,
    params: { name: string; type: string; sampleValue: string }[]
  ): { sqliScore: number; isSqliCandidate: boolean; sqliReason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Filter out static assets without parameters
    const isStatic = this.STATIC_ASSET_REGEX.test(path);
    if (isStatic && params.length === 0) {
      return { sqliScore: 0, isSqliCandidate: false, sqliReason: 'Static asset without parameters' };
    }

    // 1. High-value parameter names
    for (const p of params) {
      if (this.HIGH_SQLI_PARAM_REGEX.test(p.name)) {
        score += 35;
        reasons.push(`High-value SQL sink parameter: "${p.name}"`);
      } else {
        score += 10;
      }

      // Check numeric sample value (highest statistical vulnerability to unquoted numeric SQLi)
      if (/^\d+$/.test(p.sampleValue.trim())) {
        score += 20;
        reasons.push(`Numeric value in "${p.name}" (ideal for unquoted numeric injection)`);
      }

      // Check JSON payload parameter
      if (p.type === 'body_json') {
        score += 10;
        reasons.push(`JSON body parameter: "${p.name}"`);
      }
    }

    // 2. HTTP Method & Body considerations
    const upperMethod = method.toUpperCase();
    if (upperMethod === 'POST' || upperMethod === 'PUT' || upperMethod === 'PATCH') {
      score += 20;
      reasons.push(`${upperMethod} method with data-altering state`);
    }

    // 3. Dynamic Script or Database API Paths
    if (/\.(php|asp|aspx|jsp|do|action)(\?|$)/i.test(path)) {
      score += 15;
      reasons.push('Dynamic legacy script handler');
    }

    if (/(search|find|query|filter|catalog|products|items|orders|users|profile|login|auth|account|data|graphql|api)/i.test(path)) {
      score += 15;
      reasons.push('Path indicates database-backed resource');
    }

    const finalScore = Math.min(100, score);
    const isCandidate = finalScore >= 25 || params.length > 0;

    return {
      sqliScore: finalScore,
      isSqliCandidate: isCandidate,
      sqliReason: reasons.join('; ') || (isCandidate ? 'Parameterized input surface' : 'Low potential endpoint'),
    };
  }

  /**
   * Crawls a target host or URL with bounded concurrent workers, deep API schema discovery,
   * client-side SPA routing, and intelligent trap prevention.
   */
  public async crawlHost(
    targetUrlOrHost: string,
    onProgress?: (message: string, count: number) => void,
    options: CrawlOptions = {}
  ): Promise<DiscoveredEndpoint[]> {
    this.isAborted = false;
    const crawlMode = options.crawlMode || 'machine';
    const isHybrid = crawlMode === 'hybrid';
    const maxDepth = options.maxDepth || (isHybrid ? 3 : 5);
    const maxPages = options.maxPages || 500;
    const concurrency = options.concurrency || (isHybrid ? 2 : 6);
    let delayMs = options.delayMs || (isHybrid ? 120 : 30);
    const probeApiSchemas = options.probeApiSchemas !== false;
    const probeFrameworkManifests = options.probeFrameworkManifests !== false;
    const scanExternalScripts = options.scanExternalScripts !== false;
    const maxScriptBundles = options.maxScriptBundles || 15;

    if (options.signingProfile) {
      this.signer = new RequestSigner(options.signingProfile);
    }
    this.heartbeat = new ClearanceHeartbeat(options.heartbeatTtlMinutes || 15);
    if (options.cookies) {
      this.heartbeat.registerToken('session_cookie', options.cookies);
    }

    const sessionHeaders: Record<string, string> = {
      ...(options.headers || {}),
      ...(options.cookies ? { Cookie: options.cookies } : {}),
    };

    let normalized = targetUrlOrHost.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalized);
    } catch {
      return [];
    }

    const host = parsedUrl.host;
    const origin = parsedUrl.origin;
    const discovered: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();
    const visitedPaths = new Set<string>();
    const clusterCounts = new Map<string, number>();

    const crawlQueue: { path: string; depth: number }[] = [];

    const addDiscovered = (ep: DiscoveredEndpoint) => {
      if (this.isAborted || options.abortSignal?.aborted) return;
      if (this.isSafetyBlocked(ep.path)) return;
      if (ep.statusCode === 404) return;
      if (TargetSiteCrawler.isNotFoundResponse(ep.statusCode, ep.rawRequest)) return;
      if (TargetSiteCrawler.isChallengeOrWafResponse(ep.statusCode, ep.rawRequest || ep.body)) return;

      const existingIdx = discovered.findIndex((d) => d.path === ep.path);
      if (existingIdx >= 0) {
        if (ep.statusCode && !discovered[existingIdx].statusCode) {
          discovered[existingIdx].statusCode = ep.statusCode;
        }
      } else {
        discoveredPaths.add(ep.path);
        discovered.push(ep);
        // Live streaming notification to UI
        options.onEndpointDiscovered?.(ep);
      }
    };

    onProgress?.(
      isHybrid
        ? `[Stealth Hybrid Mode] Initiating session-injected crawl on ${host} (${concurrency} workers, ${delayMs}ms polite jitter)...`
        : `[Machine Blitz Mode] Starting high-speed attack surface crawl on ${host} (${concurrency} workers, max depth: ${maxDepth})...`,
      0
    );

    // ─── 0. Passive Historical Archive Mining (Wayback Machine / AlienVault) ─
    if (options.enableHistoricalMining && !HistoricalArchiveMiner.isLocalOrPrivateHost(host) && !this.isAborted) {
      onProgress?.('Querying passive historical archives (Wayback Machine / AlienVault)...', discovered.length);
      try {
        const waybackUrl = HistoricalArchiveMiner.getWaybackCdxUrl(host, 150);
        const waybackRes = await this.fetchDirectUrl(waybackUrl, 3500);
        if (waybackRes && waybackRes.body && !this.isAborted) {
          try {
            const cdxJson = JSON.parse(waybackRes.body);
            const archiveEps = HistoricalArchiveMiner.parseWaybackCdxResponse(host, cdxJson);
            for (const aEp of archiveEps) {
              if (this.isAborted) break;
              addDiscovered(aEp);
              if (crawlQueue.length < maxPages && !visitedPaths.has(aEp.path)) {
                crawlQueue.push({ path: aEp.path, depth: 1 });
              }
            }
          } catch {
            // Non-JSON or rate limited archive response
          }
        }
      } catch {
        // Continue if archive mining is offline
      }
    }

    // ─── 1. Probe OpenAPI / Swagger & GraphQL API Schemas ──────────────────
    if (probeApiSchemas && !this.isAborted) {
      onProgress?.('Probing OpenAPI / Swagger & GraphQL API schemas...', discovered.length);
      try {
        const schemaEndpoints = await this.probeApiSchemas(origin, host, sessionHeaders);
        for (const ep of schemaEndpoints) {
          if (this.isAborted) break;
          addDiscovered(ep);
        }
      } catch {
        // Continue if schema discovery fails
      }
    }

    // ─── 2. Probe robots.txt ───────────────────────────────────────────────
    if (!this.isAborted) {
      try {
        onProgress?.('Inspecting robots.txt for hidden admin/disallow routes...', discovered.length);
        const robotsRes = await this.fetchEndpoint(origin, '/robots.txt', sessionHeaders);
        if (robotsRes && robotsRes.body && !TargetSiteCrawler.isNotFoundResponse(robotsRes.statusCode, robotsRes.body)) {
          const lines = robotsRes.body.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('Disallow:') || trimmed.startsWith('Allow:')) {
              const rawPath = trimmed.split(':')[1]?.trim();
              if (rawPath && rawPath.startsWith('/') && rawPath !== '/' && !this.isSafetyBlocked(rawPath)) {
                if (crawlQueue.length < maxPages) {
                  crawlQueue.push({ path: rawPath, depth: 1 });
                }
              }
            }
          }
        }
      } catch {
        // Continue
      }
    }

    // ─── 3. Probe sitemap.xml ──────────────────────────────────────────────
    if (!this.isAborted) {
      try {
        onProgress?.('Parsing sitemap.xml for indexed endpoints...', discovered.length);
        const sitemapRes = await this.fetchEndpoint(origin, '/sitemap.xml', sessionHeaders);
        if (sitemapRes && sitemapRes.body && !TargetSiteCrawler.isNotFoundResponse(sitemapRes.statusCode, sitemapRes.body)) {
          const locRegex = /<loc>(.*?)<\/loc>/gi;
          let m: RegExpExecArray | null;
          while ((m = locRegex.exec(sitemapRes.body)) !== null) {
            const loc = m[1]?.trim();
            if (loc && loc.includes(host)) {
              try {
                const u = new URL(loc);
                const fullPath = `${u.pathname}${u.search}`;
                if (!this.isSafetyBlocked(fullPath)) {
                  if (crawlQueue.length < maxPages) {
                    crawlQueue.push({ path: fullPath, depth: 1 });
                  }
                }
              } catch {
                // Continue
              }
            }
          }
        }
      } catch {
        // Continue
      }
    }

    // ─── 4. Seed with Root & Target Path ────────────────────────────────────
    const startPath = parsedUrl.pathname && parsedUrl.pathname !== '/' ? `${parsedUrl.pathname}${parsedUrl.search}` : '/';
    crawlQueue.unshift({ path: startPath, depth: 0 });
    if (startPath !== '/') {
      crawlQueue.push({ path: '/', depth: 0 });
    }

    // ─── 5. Concurrent Async Worker Pool Execution ──────────────────────────
    let activeWorkers = 0;

    const runWorker = async (): Promise<void> => {
      while (crawlQueue.length > 0 && visitedPaths.size < maxPages) {
        if (this.isAborted || options.abortSignal?.aborted) break;

        const current = crawlQueue.shift();
        if (!current) break;

        if (visitedPaths.has(current.path) && current.depth > 0) continue;
        if (this.isSafetyBlocked(current.path)) continue;

        // Path trap & loop protection
        let pathname = current.path;
        let search = '';
        try {
          const u = new URL(current.path, origin);
          pathname = u.pathname;
          search = u.search;
        } catch {
          // Fallback
        }

        if (this.isCrawlerTrap(pathname)) continue;

        // Smart clustering (cap similar URLs per cluster to max 3)
        const cluster = TargetSiteCrawler.getClusterSignature(pathname, search);
        const count = clusterCounts.get(cluster) || 0;
        if (count >= 3 && current.depth > 0) continue;
        clusterCounts.set(cluster, count + 1);

        visitedPaths.add(current.path);
        onProgress?.(`Crawling [workers: ${activeWorkers}/${concurrency}, depth: ${current.depth}/${maxDepth}]: ${current.path}`, discovered.length);

        // Apply polite Gaussian/Poisson randomized timing jitter
        await TargetSiteCrawler.applyPoliteJitter(delayMs);
        if (this.isAborted || options.abortSignal?.aborted) break;

        try {
          const pageRes = await this.fetchEndpoint(origin, current.path, sessionHeaders);
          if (!pageRes) continue;

          // Adaptive throttling on 429 Too Many Requests or detected WAF challenge
          if (pageRes.statusCode === 429 || (pageRes.statusCode === 403 && WafDetector.detect(pageRes.headers || {}, pageRes.body, pageRes.statusCode).detected)) {
            const wafResult = WafDetector.detect(pageRes.headers || {}, pageRes.body, pageRes.statusCode);
            const retryAfterHeader = pageRes.headers?.['retry-after'] || pageRes.headers?.['Retry-After'];
            const parsedDelay = RetryAfterParser.parse(retryAfterHeader, Math.min(delayMs * 1.5, 3000));
            onProgress?.(
              `WAF challenge or rate limit encountered (${wafResult.wafName || 'HTTP 429'}). Applying ${parsedDelay}ms backoff jitter...`,
              discovered.length
            );
            delayMs = Math.min(parsedDelay, 5000);
          }

          // Follow HTTP redirects (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(pageRes.statusCode)) {
            const loc = pageRes.headers?.location || pageRes.headers?.Location;
            if (loc) {
              try {
                const targetUrl = new URL(loc, origin);
                if (targetUrl.host === host) {
                  const redirectPath = `${targetUrl.pathname}${targetUrl.search}`;
                  if (!visitedPaths.has(redirectPath) && !this.isSafetyBlocked(redirectPath) && crawlQueue.length < maxPages) {
                    crawlQueue.push({ path: redirectPath, depth: current.depth + 1 });
                  }
                }
              } catch {
                // Ignore invalid URL
              }
            }
          }

          // Strictly reject 404s, soft-404 error pages, and empty failure responses
          if (TargetSiteCrawler.isNotFoundResponse(pageRes.statusCode, pageRes.body) || (pageRes.body.trim().length === 0 && pageRes.statusCode >= 400)) {
            const idx = discovered.findIndex((d) => d.path === current.path);
            if (idx >= 0) {
              discovered.splice(idx, 1);
            }
            continue;
          }

          // Verified live endpoint with real response data
          const verifiedEp = this.createEndpointFromPath(origin, host, current.path, 'html_link');
          verifiedEp.statusCode = pageRes.statusCode;
          addDiscovered(verifiedEp);

          // A. Scrape HTML forms, links, comments, and data-* attributes
          const scraped = this.scrapeHtmlForEndpoints(origin, host, pageRes.body, pageRes.headers);
          for (const ep of scraped) {
            if (this.isAborted) break;
            if (ep.source === 'html_form') {
              ep.statusCode = pageRes.statusCode;
              addDiscovered(ep);
            }

            if (current.depth + 1 <= maxDepth && !visitedPaths.has(ep.path) && crawlQueue.length < maxPages) {
              if (!this.isSafetyBlocked(ep.path)) {
                crawlQueue.push({ path: ep.path, depth: current.depth + 1 });
              }
            }
          }

          // B. Extract Client-Side JS API routes, template literals, and JSON bodies from inline body
          const jsEndpoints = this.extractJsEndpoints(origin, host, pageRes.body);
          for (const jsEp of jsEndpoints) {
            if (this.isAborted) break;
            if (jsEp.params.some((p) => p.type === 'body_json')) {
              jsEp.statusCode = 200;
              addDiscovered(jsEp);
            } else if (current.depth + 1 <= maxDepth && !visitedPaths.has(jsEp.path) && crawlQueue.length < maxPages) {
              crawlQueue.push({ path: jsEp.path, depth: current.depth + 1 });
            }
          }

          // C. Probe Modern Framework Manifests (Next.js _buildManifest.js / Nuxt)
          if (probeFrameworkManifests && current.depth === 0 && !this.isAborted) {
            const manifestEndpoints = await this.probeFrameworkManifests(origin, host, pageRes.body, sessionHeaders);
            for (const mEp of manifestEndpoints) {
              if (this.isAborted) break;
              addDiscovered(mEp);
              if (crawlQueue.length < maxPages && !visitedPaths.has(mEp.path)) {
                crawlQueue.push({ path: mEp.path, depth: 1 });
              }
            }
          }

          // D. Download and Scan External First-Party <script src="*.js"> Bundles
          if (scanExternalScripts && !this.isAborted) {
            const bundleEndpoints = await this.extractAndScanExternalScripts(
              origin,
              host,
              pageRes.body,
              sessionHeaders,
              maxScriptBundles
            );
            for (const bEp of bundleEndpoints) {
              if (this.isAborted) break;
              addDiscovered(bEp);
              if (bEp.method === 'GET' && crawlQueue.length < maxPages && !visitedPaths.has(bEp.path)) {
                crawlQueue.push({ path: bEp.path, depth: current.depth + 1 });
              }
            }
          }
        } catch {
          // Continue
        }
      }
    };

    // Launch initial concurrency pool
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          activeWorkers++;
          try {
            await runWorker();
          } finally {
            activeWorkers--;
          }
        })()
      );
    }
    await Promise.all(workers);

    // ─── 6. Probe High-Probability Dynamic SQL Injection Routes ─────────────
    if (!this.isAborted) {
      // Pre-flight canary check: Verify if target is protected by a WAF challenge or catch-all router
      const canaryPath = `/__sentinel_canary_probe_${Date.now()}`;
      let isCanaryBlocked = false;
      try {
        const canaryRes = await this.fetchEndpoint(origin, canaryPath, sessionHeaders, 3000);
        if (canaryRes) {
          if (TargetSiteCrawler.isChallengeOrWafResponse(canaryRes.statusCode, canaryRes.body)) {
            isCanaryBlocked = true;
            onProgress?.('[WAF Intercept] Canary probe encountered verification challenge. Skipping speculative wordlist routes to avoid false-positive endpoints.', discovered.length);
          } else if (canaryRes.statusCode === 200 && canaryRes.body.length > 500) {
            isCanaryBlocked = true;
            onProgress?.('[Catch-All Router] Nonexistent canary path returned HTTP 200. Skipping speculative routes to prevent false positives.', discovered.length);
          }
        }
      } catch {}

      if (!isCanaryBlocked) {
        const highProbPaths = [
          '/search?q=test',
          '/search?query=test',
          '/products?id=1',
          '/products?category=1',
          '/item?id=1',
          '/items?cat=1&sort=asc',
          '/catalog?cat=1',
          '/filter?type=1&order=desc',
          '/user?id=1',
          '/profile?user=admin',
          '/news?id=10',
          '/view?id=1',
          '/api/v1/search?term=test',
          '/api/v1/items?page=1',
          '/api/v1/users?id=1',
          '/login',
          '/admin/login',
        ];

        onProgress?.('Probing dynamic routes for live, non-404 attack surfaces...', discovered.length);

        for (const testPath of highProbPaths) {
          if (this.isAborted || options.abortSignal?.aborted) break;
          if (!visitedPaths.has(testPath)) {
            visitedPaths.add(testPath);
            try {
              const res = await this.fetchEndpoint(origin, testPath, sessionHeaders);
              // ONLY add if the server returned real data with a proper response (NEVER 404 or soft 404 or WAF challenge)
              if (
                res &&
                !TargetSiteCrawler.isNotFoundResponse(res.statusCode, res.body) &&
                !TargetSiteCrawler.isChallengeOrWafResponse(res.statusCode, res.body) &&
                res.body.trim().length > 0
              ) {
                const endpoint = this.createEndpointFromPath(origin, host, testPath, 'heuristic_probe');
                endpoint.statusCode = res.statusCode;
                addDiscovered(endpoint);
              }
            } catch {
              // Ignore 404 or network failures
            }
          }
        }
      }
    }

    // ─── 7. Smart Mutation Frontier (API Version Flips & Unkeyed Parameters) ─
    if (options.enableSmartMutations && !this.isAborted) {
      // ONLY mutate verified, genuine application endpoints (never mutate speculative wordlists or challenged pages)
      const realEndpoints = discovered.filter(
        (e) => (e.source === 'html_link' || e.source === 'html_form' || e.source === 'proxy' || e.source === 'robots.txt') && e.statusCode === 200
      );
      if (realEndpoints.length > 0) {
        onProgress?.('Generating smart mutation frontier for confirmed attack surfaces...', discovered.length);
        const mutations = SmartMutationFrontier.generateFrontierMutations(origin, host, realEndpoints, 15);
        for (const m of mutations) {
          if (this.isAborted) break;
          addDiscovered(m);
        }
      }
    }

    // Final sanity check: filter out any 404 or invalid responses so only endpoints with real data are returned
    const liveOnly = discovered.filter((ep) => {
      if (ep.statusCode === 404) return false;
      return ep.statusCode !== undefined && ep.statusCode < 400;
    });

    onProgress?.(`Crawl completed: ${liveOnly.length} live attack surfaces with real data discovered.`, liveOnly.length);

    // Sort by SQLi score descending (most vulnerable candidates first)
    return liveOnly.sort((a, b) => b.sqliScore - a.sqliScore);
  }

  /**
   * Automatically discovers and parses OpenAPI/Swagger specifications and GraphQL endpoints.
   */
  public async probeApiSchemas(
    origin: string,
    host: string,
    customHeaders?: Record<string, string>
  ): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];

    // 1. Probe OpenAPI / Swagger (Concurrently with fast timeout)
    const openApiPaths = [
      '/openapi.json',
      '/swagger.json',
      '/v2/api-docs',
      '/v3/api-docs',
      '/api-docs',
      '/api/swagger.json',
    ];

    const openApiPromises = openApiPaths.map(async (p) => {
      try {
        const res = await this.fetchEndpoint(origin, p, customHeaders, 2000);
        if (res && res.statusCode === 200 && res.body) {
          const schema = JSON.parse(res.body);
          if (schema.paths || schema.swagger || schema.openapi) {
            return this.parseOpenApiSchema(origin, host, schema);
          }
        }
      } catch {
        // Ignore JSON parse errors or 404s
      }
      return [];
    });

    const openApiResults = await Promise.allSettled(openApiPromises);
    for (const r of openApiResults) {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        endpoints.push(...r.value);
        break; // Take first matching schema
      }
    }

    // 2. Probe GraphQL Endpoint (Concurrently with fast timeout)
    const gqlPaths = ['/graphql', '/api/graphql', '/v1/graphql'];
    const gqlPromises = gqlPaths.map(async (p) => {
      try {
        const introspectionBody = JSON.stringify({
          query: '{ __schema { types { name } } }',
        });
        const targetUrl = `${origin}${p}`;
        const rawReq = `POST ${p} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0\r\nContent-Type: application/json\r\nContent-Length: ${introspectionBody.length}\r\nConnection: close\r\n\r\n${introspectionBody}`;

        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
        const reqPromise = ipcClient.sendRepeaterRequest({
          tabId: `crawl-gql-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          targetUrl,
          rawRequest: rawReq,
        });

        const res: any = await Promise.race([reqPromise, timeoutPromise]);

        if (res && res.statusCode === 200 && res.body && (res.body.includes('__schema') || res.body.includes('data'))) {
          const sampleQuery = '{"query":"query { items(id: 1) { id name } }"}';
          const headers: Record<string, string> = {
            Host: host,
            'User-Agent': 'Mozilla/5.0 Sentinel/6.0',
            'Content-Type': 'application/json',
            'Content-Length': `${sampleQuery.length}`,
            Connection: 'close',
          };
          const rawRequest = `POST ${p} HTTP/1.1\r\n` +
            Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
            `\r\n\r\n${sampleQuery}`;

          return {
            id: `ep_gql_${Date.now()}`,
            host,
            url: `${origin}${p}`,
            path: p,
            method: 'POST',
            headers,
            body: sampleQuery,
            source: 'graphql' as const,
            params: [{ name: 'query', type: 'body_json' as const, sampleValue: '{ items(id: 1) }' }],
            sqliScore: 75,
            isSqliCandidate: true,
            sqliReason: 'GraphQL endpoint with dynamic query execution surface',
            rawRequest,
            statusCode: 200,
            timestamp: Date.now(),
            workflowType: 'trigger' as const,
          };
        }
      } catch {
        // Continue
      }
      return null;
    });

    const gqlResults = await Promise.allSettled(gqlPromises);
    for (const r of gqlResults) {
      if (r.status === 'fulfilled' && r.value) {
        endpoints.push(r.value);
        break;
      }
    }

    return endpoints;
  }

  /**
   * Parses OpenAPI 2.0 / 3.0 / 3.1 JSON objects into structured DiscoveredEndpoints.
   */
  public parseOpenApiSchema(origin: string, host: string, schema: any): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    if (!schema || typeof schema !== 'object' || !schema.paths) return endpoints;

    for (const [routePath, methodsObj] of Object.entries<any>(schema.paths)) {
      if (!methodsObj || typeof methodsObj !== 'object') continue;

      for (const [rawMethod, opObj] of Object.entries<any>(methodsObj)) {
        const method = rawMethod.toUpperCase();
        if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) continue;

        const params: { name: string; type: 'query' | 'body_form' | 'body_json' | 'path'; sampleValue: string }[] = [];

        // Parameters array
        if (Array.isArray(opObj.parameters)) {
          for (const p of opObj.parameters) {
            if (!p || !p.name) continue;
            const pType = p.in === 'path' ? 'path' : (p.in === 'query' ? 'query' : 'body_form');
            const sample = p.schema?.default ?? (p.schema?.type === 'integer' ? '1' : 'test');
            params.push({ name: p.name, type: pType, sampleValue: String(sample) });
          }
        }

        // RequestBody schema (OpenAPI 3.0+)
        let body: string | undefined;
        const jsonContent = opObj.requestBody?.content?.['application/json'];
        if (jsonContent?.schema?.properties) {
          const sampleBody: Record<string, any> = {};
          for (const [propName, propSchema] of Object.entries<any>(jsonContent.schema.properties)) {
            const sample = propSchema.default ?? (propSchema.type === 'integer' ? 1 : 'test');
            sampleBody[propName] = sample;
            params.push({ name: propName, type: 'body_json', sampleValue: String(sample) });
          }
          body = JSON.stringify(sampleBody);
        }

        // Resolve path parameters with sample '1'
        const resolvedPath = routePath.replace(/\{([^}]+)\}/g, '1');
        const queryParams = params.filter((p) => p.type === 'query');
        const queryString = queryParams.length > 0 ? `?${queryParams.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.sampleValue)}`).join('&')}` : '';
        const fullPath = `${resolvedPath}${queryString}`;

        const scoring = TargetSiteCrawler.scoreSqliSurface(method, fullPath, params);
        const isJson = !!body;
        const headers: Record<string, string> = {
          Host: host,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0',
          Accept: isJson ? 'application/json' : 'text/html,*/*',
          Connection: 'close',
        };
        if (isJson) {
          headers['Content-Type'] = 'application/json';
          headers['Content-Length'] = `${body!.length}`;
        }

        const rawRequest = `${method} ${fullPath} HTTP/1.1\r\n` +
          Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
          `\r\n\r\n${body || ''}`;

        endpoints.push({
          id: `ep_openapi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          host,
          url: `${origin}${fullPath}`,
          path: fullPath,
          method,
          headers,
          body,
          source: 'openapi',
          params,
          sqliScore: scoring.sqliScore,
          isSqliCandidate: scoring.isSqliCandidate,
          sqliReason: `OpenAPI specification route; ${scoring.sqliReason}`,
          rawRequest,
          statusCode: 200,
          timestamp: Date.now(),
          workflowType: TargetSiteCrawler.classifyWorkflowType(method, fullPath),
          clusterSignature: TargetSiteCrawler.getClusterSignature(resolvedPath, queryString),
        });
      }
    }

    return endpoints;
  }

  /**
   * Mines Next.js (Pages & App Router / RSC), Nuxt.js (Vue 2/3), Remix, and SvelteKit
   * framework manifests and chunk graphs to uncover 100% of routes compiled into the frontend.
   */
  public async probeFrameworkManifests(
    origin: string,
    host: string,
    html: string,
    customHeaders?: Record<string, string>
  ): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();

    const addRoute = (route: string) => {
      let clean = route.trim();
      if (!clean.startsWith('/')) clean = `/${clean}`;
      // Strip Next.js route groups: /(admin)/ -> /
      clean = clean.replace(/\/\([^)]+\)/g, '');
      // Normalize dynamic params: [id] -> 1, [...slug] -> 1, :id -> 1, $id -> 1
      clean = clean
        .replace(/\[\.\.\.[^\]]+\]/g, '1')
        .replace(/\[[^\]]+\]/g, '1')
        .replace(/:[a-zA-Z0-9_]+/g, '1')
        .replace(/\$[a-zA-Z0-9_]+/g, '1');

      if (!clean || clean === '/' || clean.startsWith('/_') || discoveredPaths.has(clean)) return;
      discoveredPaths.add(clean);
      const ep = this.createEndpointFromPath(origin, host, clean, 'js_endpoint');
      ep.statusCode = 200;
      endpoints.push(ep);
    };

    // ─── 1. Next.js Pages Router: __NEXT_DATA__ & _buildManifest.js ─────────
    let buildId = '';
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        if (nextData.buildId) {
          buildId = nextData.buildId;
        }
        if (nextData.page && nextData.page !== '/' && !nextData.page.includes('/_error')) {
          addRoute(nextData.page);
        }
      } catch {
        // Ignore parse error
      }
    }

    if (!buildId) {
      const manifestScriptMatch = html.match(/["'](\/_next\/static\/([^"'\/]+)\/_buildManifest\.js)["']/i);
      if (manifestScriptMatch) {
        buildId = manifestScriptMatch[2];
      }
    }

    if (buildId) {
      const manifestPath = `/_next/static/${buildId}/_buildManifest.js`;
      try {
        const manifestRes = await this.fetchEndpoint(origin, manifestPath, customHeaders);
        if (manifestRes && manifestRes.body && manifestRes.statusCode === 200) {
          const routeKeyRegex = /"(\/(?:[a-zA-Z0-9_\-\.\[\]]+(?:\/[a-zA-Z0-9_\-\.\[\]]+)*)?)"\s*:\s*\[/g;
          let m: RegExpExecArray | null;
          while ((m = routeKeyRegex.exec(manifestRes.body)) !== null) {
            addRoute(m[1]);
          }
        }
      } catch {
        // Ignore
      }
    }

    // ─── 2. Next.js 13/14/15 App Router (RSC Chunks & Flight Payload) ────────
    // A. App Router chunk filenames in HTML: /_next/static/chunks/app/...
    const appChunkRegex = /["'](\/_next\/static\/chunks\/app\/([^"']+\.js))["']/gi;
    let chunkMatch: RegExpExecArray | null;
    while ((chunkMatch = appChunkRegex.exec(html)) !== null) {
      const fullChunkPath = chunkMatch[2];
      const routeSegment = fullChunkPath.replace(/(?:\/(?:page|route|layout|loading|error|not-found)(?:-[a-zA-Z0-9_-]+)?\.js)$/i, '');
      if (routeSegment && !routeSegment.endsWith('.js')) {
        addRoute(`/${routeSegment}`);
      }
    }

    // B. Next.js App Router Flight payload: self.__next_f.push([1, "..."])
    const flightRegex = /self\.__next_f\.push\(\[\d+,\s*"([\s\S]*?)"\]\)/g;
    let flightMatch: RegExpExecArray | null;
    while ((flightMatch = flightRegex.exec(html)) !== null) {
      const rawChunk = flightMatch[1];
      const segmentRegex = /"(\/(?:api|dashboard|admin|portal|account|v[0-9]+)[a-zA-Z0-9_\-\/]*)"/g;
      let segMatch: RegExpExecArray | null;
      while ((segMatch = segmentRegex.exec(rawChunk)) !== null) {
        addRoute(segMatch[1]);
      }
    }

    // ─── 3. Nuxt.js (Vue 2 & Vue 3) __NUXT_DATA__ & Chunks ─────────────────
    const nuxtDataMatch = html.match(/<script id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nuxtDataMatch) {
      try {
        const nuxtData = JSON.parse(nuxtDataMatch[1]);
        if (Array.isArray(nuxtData)) {
          for (const item of nuxtData) {
            if (typeof item === 'string' && item.startsWith('/') && !item.includes('.') && item.length > 1) {
              addRoute(item);
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    const nuxtChunkRegex = /["'](\/_nuxt\/(?:pages\/)?([a-zA-Z0-9_\-\/]+)\.[a-zA-Z0-9_-]+\.js)["']/gi;
    let nuxtMatch: RegExpExecArray | null;
    while ((nuxtMatch = nuxtChunkRegex.exec(html)) !== null) {
      const pagePath = nuxtMatch[2];
      if (pagePath && !pagePath.includes('entry') && !pagePath.includes('manifest')) {
        addRoute(`/${pagePath}`);
      }
    }

    // ─── 4. Remix & React Router v7 Manifest ────────────────────────────────
    if (html.includes('__remixManifest') || html.includes('__remixContext')) {
      // Regex extraction handles both strict JSON and standard JavaScript object literals
      const remixPathRegex = /(?:path|id)\s*:\s*["']([^"']+)["']/gi;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = remixPathRegex.exec(html)) !== null) {
        const val = rMatch[1];
        if (val.startsWith('routes/')) {
          const cleanId = val.replace(/^routes\//, '').replace(/\./g, '/').replace(/index$/, '');
          if (cleanId) addRoute(`/${cleanId}`);
        } else if (val.includes('/') && !val.includes(' ') && !val.endsWith('.js')) {
          addRoute(val);
        }
      }
    }

    // ─── 5. SvelteKit Manifest ─────────────────────────────────────────────
    const svelteMatch = html.match(/routes:\s*\[([\s\S]*?)\]/);
    if (svelteMatch && html.includes('__sveltekit_')) {
      const svelteRouteRegex = /id:\s*["']([^"']+)["']/g;
      let svMatch: RegExpExecArray | null;
      while ((svMatch = svelteRouteRegex.exec(svelteMatch[1])) !== null) {
        addRoute(svMatch[1]);
      }
    }

    return endpoints;
  }

  /**
   * Discovers and downloads external first-party JavaScript bundles (<script src="*.js">)
   * to extract hidden client-side routes, Axios AJAX calls, and REST JSON payloads.
   */
  public async extractAndScanExternalScripts(
    origin: string,
    host: string,
    html: string,
    customHeaders?: Record<string, string>,
    maxScripts: number = 6
  ): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];
    const scriptSrcRegex = /<script\b[^>]*src=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi;
    const discoveredScriptPaths: string[] = [];
    let match: RegExpExecArray | null;

    const thirdPartyBlacklist = [
      'google-analytics', 'googletagmanager', 'facebook.net', 'doubleclick',
      'sentry.io', 'hotjar', 'intercom', 'segment.com', 'recaptcha', 'turnstile',
      'hcaptcha', 'cloudflare', 'stripe.com', 'datadoghq', 'clarity.ms', 'mixpanel'
    ];

    while ((match = scriptSrcRegex.exec(html)) !== null) {
      const src = match[1];
      const isThirdParty = thirdPartyBlacklist.some((b) => src.toLowerCase().includes(b));
      if (isThirdParty) continue;

      try {
        const u = new URL(src, origin);
        if (u.host === host) {
          const fullPath = `${u.pathname}${u.search}`;
          if (!discoveredScriptPaths.includes(fullPath) && discoveredScriptPaths.length < maxScripts) {
            discoveredScriptPaths.push(fullPath);
          }
        }
      } catch {
        // Ignore
      }
    }

    // Download each first-party JS bundle and run deep JS endpoint extraction
    for (const scriptPath of discoveredScriptPaths) {
      try {
        const res = await this.fetchEndpoint(origin, scriptPath, customHeaders);
        if (res && res.statusCode === 200 && res.body && res.body.length > 20) {
          const extracted = this.extractJsEndpoints(origin, host, res.body);
          endpoints.push(...extracted);

          if (!this.signer) {
            const profile = RequestSigner.extractSigningProfileFromJs(res.body);
            if (profile) {
              this.signer = new RequestSigner(profile);
            }
          }
        }
      } catch {
        // Continue
      }
    }

    return endpoints;
  }

  /**
   * Scrapes HTML for:
   * 1. <form> elements with <input>, <select>, <textarea>, and <button formaction>
   * 2. <a href="..."> links
   * 3. HTML comments (<!-- /api/hidden/debug -->)
   * 4. HTML data-* attributes (data-url, data-endpoint, data-api)
   * 5. Response headers (Link, Location)
   */
  public scrapeHtmlForEndpoints(
    origin: string,
    host: string,
    html: string,
    headers?: Record<string, string>
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();

    const addEp = (ep: DiscoveredEndpoint) => {
      if (!discoveredPaths.has(ep.path)) {
        discoveredPaths.add(ep.path);
        endpoints.push(ep);
      }
    };

    // 1. Scrape <form> elements (including select, textarea, button formaction)
    const formRegex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let formMatch: RegExpExecArray | null;

    while ((formMatch = formRegex.exec(html)) !== null) {
      const formAttrs = formMatch[1] || '';
      const formBody = formMatch[2] || '';

      const actionMatch = formAttrs.match(/action=["']([^"']*)["']/i);
      const methodMatch = formAttrs.match(/method=["']([^"']*)["']/i);

      const action = actionMatch ? actionMatch[1] : '/';
      const method = (methodMatch ? methodMatch[1] : 'POST').toUpperCase();

      const inputParams: { name: string; type: 'body_form'; sampleValue: string }[] = [];

      // A. Standard <input>
      const inputRegex = /<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
      let inputMatch: RegExpExecArray | null;
      while ((inputMatch = inputRegex.exec(formBody)) !== null) {
        if (HoneypotFilter.isHoneypotInput(inputMatch[0])) {
          continue;
        }
        const name = inputMatch[1];
        const valMatch = inputMatch[0].match(/value=["']([^"']*)["']/i);
        const sampleValue = valMatch ? valMatch[1] : 'test';
        if (name && !name.startsWith('_csrf') && !name.startsWith('csrf')) {
          inputParams.push({ name, type: 'body_form', sampleValue });
        }
      }

      // B. <select> elements
      const selectRegex = /<select\b[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
      let selectMatch: RegExpExecArray | null;
      while ((selectMatch = selectRegex.exec(formBody)) !== null) {
        const name = selectMatch[1];
        const optionsHtml = selectMatch[2] || '';
        const optValMatch = optionsHtml.match(/<option\b[^>]*value=["']([^"']+)["']/i);
        const sampleValue = optValMatch ? optValMatch[1] : '1';
        inputParams.push({ name, type: 'body_form', sampleValue });
      }

      // C. <textarea> elements
      const textareaRegex = /<textarea\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
      let textareaMatch: RegExpExecArray | null;
      while ((textareaMatch = textareaRegex.exec(formBody)) !== null) {
        const name = textareaMatch[1];
        inputParams.push({ name, type: 'body_form', sampleValue: 'test_text' });
      }

      if (inputParams.length > 0) {
        let cleanPath = (action || '').trim();
        if (cleanPath.startsWith('/http://') || cleanPath.startsWith('/https://')) {
          cleanPath = cleanPath.substring(1);
        }
        if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
          try {
            const u = new URL(cleanPath);
            cleanPath = `${u.pathname}${u.search}`;
          } catch {}
        }
        if (!cleanPath.startsWith('/')) {
          cleanPath = `/${cleanPath}`;
        }

        const scoring = TargetSiteCrawler.scoreSqliSurface(method, cleanPath, inputParams);

        const formBodyStr = inputParams.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.sampleValue)}`).join('&');
        const rawReq = `${method} ${cleanPath} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${formBodyStr.length}\r\nConnection: close\r\n\r\n${formBodyStr}`;

        addEp({
          id: `ep_form_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          host,
          url: `${origin}${cleanPath}`,
          path: cleanPath,
          method,
          headers: {
            Host: host,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBodyStr,
          source: 'html_form',
          params: inputParams,
          sqliScore: scoring.sqliScore,
          isSqliCandidate: scoring.isSqliCandidate,
          sqliReason: scoring.sqliReason,
          rawRequest: rawReq,
          timestamp: Date.now(),
          workflowType: TargetSiteCrawler.classifyWorkflowType(method, cleanPath),
        });
      }
    }

    // 2. Scrape <a href="..."> links
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      if (HoneypotFilter.isHoneypotLink(linkMatch[0])) {
        continue;
      }
      const href = linkMatch[1];
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const resolved = new URL(href, origin);
          if (resolved.host === host) {
            const pathWithQuery = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, pathWithQuery, 'html_link'));
          }
        } catch {
          // Ignore
        }
      }
    }

    // 3. Scrape HTML Comments (<!-- /internal/debug?id=1 -->)
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let commentMatch: RegExpExecArray | null;
    while ((commentMatch = commentRegex.exec(html)) !== null) {
      const commentText = commentMatch[1];
      const pathMatch = commentText.match(/["']?(\/(?:api|v[0-9]+|debug|internal|admin|test)[a-zA-Z0-9_\-\/\?&=]+)["']?/i);
      if (pathMatch) {
        const rawPath = pathMatch[1];
        addEp(this.createEndpointFromPath(origin, host, rawPath, 'html_comment'));
      }
    }

    // 4. Scrape HTML data-* Attributes (data-url, data-endpoint, data-api, data-href, data-target)
    const dataAttrRegex = /data-(?:url|endpoint|api|href|target|path)=["']([^"']+)["']/gi;
    let dataMatch: RegExpExecArray | null;
    while ((dataMatch = dataAttrRegex.exec(html)) !== null) {
      const rawUri = dataMatch[1];
      if (rawUri && (rawUri.startsWith('/') || rawUri.startsWith('http'))) {
        try {
          const resolved = new URL(rawUri, origin);
          if (resolved.host === host) {
            const fullPath = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, fullPath, 'html_data_attr'));
          }
        } catch {
          // Ignore
        }
      }
    }

    // 5. Scrape <meta http-equiv="refresh" content="...;url=...">
    const metaRefreshRegex = /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=['"]?([^'">\s]+)['"]?[^>]*>/gi;
    let metaRefreshMatch: RegExpExecArray | null;
    while ((metaRefreshMatch = metaRefreshRegex.exec(html)) !== null) {
      const targetUri = metaRefreshMatch[1];
      if (targetUri) {
        try {
          const resolved = new URL(targetUri, origin);
          if (resolved.host === host) {
            const fullPath = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, fullPath, 'html_link'));
          }
        } catch {}
      }
    }

    // Also check alternate meta attribute order: <meta content="...;url=..." http-equiv="refresh">
    const altMetaRefreshRegex = /<meta\b[^>]*content=["'][^"']*url=['"]?([^'">\s]+)['"]?[^>]*http-equiv=["']?refresh["']?[^>]*>/gi;
    let altMetaMatch: RegExpExecArray | null;
    while ((altMetaMatch = altMetaRefreshRegex.exec(html)) !== null) {
      const targetUri = altMetaMatch[1];
      if (targetUri) {
        try {
          const resolved = new URL(targetUri, origin);
          if (resolved.host === host) {
            const fullPath = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, fullPath, 'html_link'));
          }
        } catch {}
      }
    }

    // 6. Scrape Inline JavaScript Redirects (window.location, location.href, location.replace)
    const jsRedirectRegex = /(?:window\.)?location(?:\.href|\.replace)?\s*=\s*['"]([^'"]+)['"]|location\.replace\(['"]([^'"]+)['"]\)/gi;
    let jsRedirectMatch: RegExpExecArray | null;
    while ((jsRedirectMatch = jsRedirectRegex.exec(html)) !== null) {
      const rawUri = jsRedirectMatch[1] || jsRedirectMatch[2];
      if (rawUri && !rawUri.startsWith('#') && !rawUri.startsWith('javascript:')) {
        try {
          const resolved = new URL(rawUri, origin);
          if (resolved.host === host) {
            const fullPath = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, fullPath, 'js_endpoint'));
          }
        } catch {}
      }
    }

    // 7. Response Headers (Location, Link)
    if (headers) {
      const locHeader = headers['location'] || headers['Location'];
      if (locHeader) {
        try {
          const resolved = new URL(locHeader, origin);
          if (resolved.host === host) {
            const fullPath = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, fullPath, 'header'));
          }
        } catch {}
      }

      const linkHeader = headers['link'] || headers['Link'];
      if (linkHeader) {
        const linkMatch = linkHeader.match(/<([^>]+)>/);
        if (linkMatch) {
          try {
            const resolved = new URL(linkMatch[1], origin);
            if (resolved.host === host) {
              const fullPath = `${resolved.pathname}${resolved.search}`;
              addEp(this.createEndpointFromPath(origin, host, fullPath, 'header'));
            }
          } catch {
            // Ignore
          }
        }
      }
    }

    return endpoints;
  }

  /**
   * Deep JavaScript AST & Regex endpoint extraction (Katana / Arjun level)
   * Discovers:
   * - REST routes: `/api/v1/users`, `/v2/items`, `/graphql`
   * - Client HTTP calls: `fetch()`, `axios.get/post/put`, `$.ajax`
   * - React Router / Vue Router client-side routes: `<Route path="...">`, `path: "/users/:id"`
   * - Template literals: `` `/api/v1/orders/${id}` ``
   * - JSON body payloads: `body: JSON.stringify({ ... })`
   */
  public extractJsEndpoints(
    origin: string,
    host: string,
    htmlOrJs: string
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();
    let match: RegExpExecArray | null = null;

    const addEp = (ep: DiscoveredEndpoint) => {
      const existingIdx = endpoints.findIndex((e) => e.path === ep.path);
      if (existingIdx >= 0) {
        const existing = endpoints[existingIdx];
        // If existing already has rich body_json parameters, never downgrade to generic form/URL endpoints
        if (existing.params.some((p) => p.type === 'body_json')) {
          return;
        }
        if (ep.params.some((p) => p.type === 'body_json') || (ep.method !== 'GET' && existing.method === 'GET') || (ep.body && !existing.body)) {
          endpoints[existingIdx] = ep;
        }
      } else {
        discoveredPaths.add(ep.path);
        endpoints.push(ep);
      }
    };

    // 1. fetch() / axios calls with JSON body parsing (run first to capture rich payload schemas)
    // Note: requires comma after URL so single-argument fetch(url) calls are not erroneously matched
    const fetchWithBodyRegex = /(?:fetch|axios\.(?:post|put|patch))\s*\(\s*["'`]([^"'`\s]+)["'`]\s*,\s*[\s\S]*?body:\s*JSON\.stringify\(\s*({[\s\S]*?})\s*\)/gi;
    while ((match = fetchWithBodyRegex.exec(htmlOrJs)) !== null) {
      const rawUri = match[1];
      const rawJson = match[2];

      try {
        const resolved = new URL(rawUri, origin);
        if (resolved.host === host) {
          const path = `${resolved.pathname}${resolved.search}`;
          const params: { name: string; type: 'body_json'; sampleValue: string }[] = [];

          const keyMatches = rawJson.matchAll(/([a-zA-Z0-9_]+)\s*:/g);
          const sampleBody: Record<string, any> = {};
          for (const km of keyMatches) {
            const key = km[1];
            sampleBody[key] = 'test';
            params.push({ name: key, type: 'body_json', sampleValue: 'test' });
          }

          const body = JSON.stringify(sampleBody);
          const scoring = TargetSiteCrawler.scoreSqliSurface('POST', path, params);

          const headers: Record<string, string> = {
            Host: host,
            'User-Agent': 'Mozilla/5.0 Sentinel/6.0',
            'Content-Type': 'application/json',
            'Content-Length': `${body.length}`,
            Connection: 'close',
          };
          const rawRequest = `POST ${path} HTTP/1.1\r\n` +
            Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
            `\r\n\r\n${body}`;

          addEp({
            id: `ep_js_json_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            host,
            url: `${origin}${path}`,
            path,
            method: 'POST',
            headers,
            body,
            source: 'js_endpoint',
            params,
            sqliScore: scoring.sqliScore,
            isSqliCandidate: scoring.isSqliCandidate,
            sqliReason: `Client JS AJAX with JSON payload; ${scoring.sqliReason}`,
            rawRequest,
            timestamp: Date.now(),
            workflowType: 'store',
          });
        }
      } catch {
        // Ignore
      }
    }

    // 2. REST & RPC/tRPC API endpoint patterns
    const apiRouteRegex = /["'](\/(?:api|v[0-9]+|rest|graphql|oauth|auth|internal|admin|trpc|rpc|gateway|service|bff|data)\/[a-zA-Z0-9_\-\/]+(?:\?[a-zA-Z0-9_\-=&]+)?)["']/gi;
    while ((match = apiRouteRegex.exec(htmlOrJs)) !== null) {
      const p = match[1];
      if (p && !p.endsWith('.js') && !p.endsWith('.css')) {
        addEp(this.createEndpointFromPath(origin, host, p, 'js_endpoint'));
      }
    }

    // 3. React Router / Vue / Angular client-side routes: path: "/users/:id", route = "/users/:id"
    const spaRouteRegex = /(?:path|route|Route\s+path|url|endpoint|to)\s*[:=]\s*["'](\/[a-zA-Z0-9_\-:\/]+)["']/gi;
    while ((match = spaRouteRegex.exec(htmlOrJs)) !== null) {
      const rawRoute = match[1];
      const resolvedRoute = rawRoute.replace(/:([a-zA-Z0-9_]+)/g, '1'); // Resolve dynamic params to 1
      addEp(this.createEndpointFromPath(origin, host, resolvedRoute, 'js_endpoint'));
    }

    // 4. Dynamic Template Literals: `/api/v1/items/${id}/view` -> `/api/v1/items/1/view`
    const templateLiteralRegex = /`(\/(?:api|v[0-9]+|rest|catalog|items|users|trpc|rpc)\/[^`]+)`/g;
    while ((match = templateLiteralRegex.exec(htmlOrJs)) !== null) {
      const rawLiteral = match[1];
      const normalizedPath = rawLiteral.replace(/\$\{[^}]+\}/g, '1');
      addEp(this.createEndpointFromPath(origin, host, normalizedPath, 'js_endpoint'));
    }

    // 5. Standard fetch() / axios calls with quoted paths
    const fetchRegex = /(?:fetch|axios\.(?:get|post|put|delete|patch)|\$\.ajax|\$\.get|\$\.post)\s*\(\s*["'`]([^"'`\s]+)["'`]/gi;
    while ((match = fetchRegex.exec(htmlOrJs)) !== null) {
      const rawUri = match[1];
      if (rawUri.startsWith('/') || rawUri.startsWith('http')) {
        try {
          const resolved = new URL(rawUri, origin);
          if (resolved.host === host) {
            const p = `${resolved.pathname}${resolved.search}`;
            addEp(this.createEndpointFromPath(origin, host, p, 'js_endpoint'));
          }
        } catch {
          // Ignore
        }
      }
    }

    // 6. Router programmatic navigation: router.push('/...'), navigate('/...'), history.push('/...'), goto('/...')
    const routerPushRegex = /(?:router\.(?:push|replace)|navigate|history\.(?:push|replace)|goto|redirect)\s*\(\s*["'](\/[a-zA-Z0-9_\-\/]+(?:\?[a-zA-Z0-9_\-=&]+)?)["']/gi;
    while ((match = routerPushRegex.exec(htmlOrJs)) !== null) {
      const p = match[1];
      if (p && !p.endsWith('.js') && !p.endsWith('.css')) {
        addEp(this.createEndpointFromPath(origin, host, p, 'js_endpoint'));
      }
    }

    // 7. BaseURL / API prefix resolution (e.g. axios.create({ baseURL: '/api/v1' }))
    const baseUrlMatch = htmlOrJs.match(/(?:baseURL|baseUrl|API_PREFIX|API_BASE|BASE_URL)\s*[:=]\s*["'](\/(?:api|v[0-9]+|rest|gateway)[a-zA-Z0-9_\-\/]*)["']/i);
    if (baseUrlMatch) {
      const basePrefix = baseUrlMatch[1].replace(/\/$/, '');
      const relativeAjaxRegex = /(?:api|client|http|axios|request)\.(?:get|post|put|delete|patch)\s*\(\s*["'](\/[a-zA-Z0-9_\-\/]+(?:\?[a-zA-Z0-9_\-=&]+)?)["']/gi;
      let relMatch: RegExpExecArray | null;
      while ((relMatch = relativeAjaxRegex.exec(htmlOrJs)) !== null) {
        const subPath = relMatch[1];
        if (!subPath.startsWith(basePrefix)) {
          const combined = `${basePrefix}${subPath}`;
          addEp(this.createEndpointFromPath(origin, host, combined, 'js_endpoint'));
        }
      }
    }

    // 8. WebSocket routes & frame parameters (wss://, /ws, /socket.io, JSON-RPC)
    const wsEndpoints = StreamProtocolMapper.extractWebSocketEndpoints(origin, host, htmlOrJs);
    for (const wsEp of wsEndpoints) {
      addEp(wsEp);
    }

    // 9. Binary gRPC-Web client stubs & Protobuf endpoints (application/grpc-web+proto)
    const grpcEndpoints = StreamProtocolMapper.extractGrpcWebEndpoints(origin, host, htmlOrJs);
    for (const gEp of grpcEndpoints) {
      addEp(gEp);
    }

    // 10. Canvas & WebGL compiled Dart bundles (Flutter Web / main.dart.js / WASM)
    const canvasEndpoints = CanvasAstExtractor.extractEndpointsFromDartBundle(origin, host, htmlOrJs);
    for (const cEp of canvasEndpoints) {
      addEp(cEp);
    }

    // 11. Dynamic JavaScript AST template literals & expression evaluation
    const dynamicEndpoints = DynamicJsEvaluator.extractDynamicRoutes(origin, host, htmlOrJs);
    for (const dEp of dynamicEndpoints) {
      addEp(dEp);
    }

    return endpoints;
  }

  /**
   * Helper to construct a DiscoveredEndpoint from a path string with full HTTP metadata.
   */
  public createEndpointFromPath(
    origin: string,
    host: string,
    path: string,
    source: DiscoveredEndpoint['source']
  ): DiscoveredEndpoint {
    let cleanPath = (path || '').trim();
    if (cleanPath.startsWith('/http://') || cleanPath.startsWith('/https://')) {
      cleanPath = cleanPath.substring(1);
    }
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      try {
        const u = new URL(cleanPath);
        cleanPath = `${u.pathname}${u.search}`;
      } catch {}
    }
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }

    const isPost = cleanPath.includes('/login') || cleanPath.includes('/auth') || cleanPath.includes('/submit') || cleanPath.includes('/create') || cleanPath.includes('/register') || cleanPath.includes('/signup');
    const method = isPost ? 'POST' : 'GET';
    const params: { name: string; type: 'query' | 'body_form'; sampleValue: string }[] = [];

    let body = '';
    if (cleanPath.includes('?')) {
      const queryStr = cleanPath.split('?')[1] || '';
      const sp = new URLSearchParams(queryStr);
      sp.forEach((val, key) => {
        params.push({
          name: key,
          type: 'query',
          sampleValue: val || '1',
        });
      });
    } else if (isPost) {
      params.push({ name: 'username', type: 'body_form', sampleValue: 'admin' });
      params.push({ name: 'password', type: 'body_form', sampleValue: 'pass' });
      body = 'username=admin&password=pass';
    }

    const scoring = TargetSiteCrawler.scoreSqliSurface(method, cleanPath, params);

    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Connection: 'close',
    };

    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = `${body.length}`;
    }

    const rawReq = `${method} ${cleanPath} HTTP/1.1\r\n` +
      Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      `\r\n\r\n${body}`;

    let pathname = cleanPath;
    let search = '';
    try {
      const u = new URL(cleanPath, origin);
      pathname = u.pathname;
      search = u.search;
    } catch {
      // Fallback
    }

    return {
      id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      host,
      url: `${origin}${cleanPath}`,
      path: cleanPath,
      method,
      headers,
      body: body || undefined,
      source,
      params,
      sqliScore: scoring.sqliScore,
      isSqliCandidate: scoring.isSqliCandidate,
      sqliReason: scoring.sqliReason,
      rawRequest: rawReq,
      timestamp: Date.now(),
      workflowType: TargetSiteCrawler.classifyWorkflowType(method, cleanPath),
      clusterSignature: TargetSiteCrawler.getClusterSignature(pathname, search),
    };
  }

  /**
   * Directly fetches a fully-qualified public URL (e.g. Wayback CDX, AlienVault OTX)
   * with strict timeout protection.
   */
  public async fetchDirectUrl(
    fullUrl: string,
    timeoutMs: number = 3500
  ): Promise<{ statusCode: number; body: string; headers?: Record<string, string> } | null> {
    try {
      const u = new URL(fullUrl);
      const rawReq = `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: application/json,text/html,*/*\r\nConnection: close\r\n\r\n`;

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
      const reqPromise = ipcClient.sendRepeaterRequest({
        tabId: `crawl-direct-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        targetUrl: fullUrl,
        rawRequest: rawReq,
      });

      const res: any = await Promise.race([reqPromise, timeoutPromise]);
      if (res && res.statusCode) {
        return {
          statusCode: res.statusCode,
          body: res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '',
        };
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Executes HTTP request through IPC client with coordinated modern Chrome headers,
   * URI normalizer, and strict timeout resilience (never hangs).
   */
  public async fetchEndpoint(
    origin: string,
    path: string,
    customHeaders?: Record<string, string>,
    timeoutMs: number = 3500
  ): Promise<{ statusCode: number; body: string; headers?: Record<string, string> } | null> {
    const isAbsolute = path.startsWith('http://') || path.startsWith('https://');
    const targetUrl = isAbsolute
      ? path
      : `${origin}${path.startsWith('/') ? path : `/${path}`}`;

    let host = '';
    let reqPath = path;
    try {
      const u = new URL(targetUrl);
      host = u.host;
      reqPath = `${u.pathname}${u.search}`;
    } catch {
      try {
        host = new URL(origin).host;
      } catch {
        host = 'localhost';
      }
    }

    const defaultHeaders: Record<string, string> = {
      'Host': host,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'close',
    };

    let dynamicSignedHeaders: Record<string, string> = {};
    if (this.signer) {
      try {
        dynamicSignedHeaders = await this.signer.generateSignedHeaders('GET', reqPath);
      } catch {
        // Ignore
      }
    }

    const finalHeaders = { ...defaultHeaders, ...(customHeaders || {}), ...dynamicSignedHeaders };
    const headerLines = Object.entries(finalHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    const rawReq = `GET ${reqPath} HTTP/1.1\r\n${headerLines}\r\n\r\n`;

    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
      const reqPromise = ipcClient.sendRepeaterRequest({
        tabId: `crawl-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        targetUrl,
        rawRequest: rawReq,
      });

      const res: any = await Promise.race([reqPromise, timeoutPromise]);

      if (res && res.statusCode) {
        const normalizedHeaders: Record<string, string> = {};
        if (Array.isArray(res.headers)) {
          for (const h of res.headers) {
            if (h && (h as any).name) {
              normalizedHeaders[(h as any).name.toLowerCase()] = String((h as any).value || '');
            }
          }
        } else if (res.headers && typeof res.headers === 'object') {
          for (const [k, v] of Object.entries(res.headers)) {
            normalizedHeaders[k.toLowerCase()] = String(v || '');
          }
        }

        return {
          statusCode: res.statusCode,
          body: res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '',
          headers: normalizedHeaders,
        };
      }
    } catch {
      // If IPC fails, return null
    }

    return null;
  }
}

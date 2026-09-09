/**
 * Sentinel SQL X — Target Site & Parameter Crawler
 * 
 * Automatically discovers hidden endpoints, forms, APIs, and query parameters
 * where finding SQL injection vulnerabilities is most likely.
 * 
 * Features:
 * 1. Probes robots.txt for hidden/admin paths.
 * 2. Probes sitemap.xml for indexed parameterized URLs.
 * 3. Scrapes HTML for <form> action/inputs and <a href> query parameters.
 * 4. Probes high-probability dynamic SQL injection routes (search, items, filters, auth).
 * 5. Evaluates SQLi Attack Surface Potential (scoring parameters based on susceptibility).
 */

import { ipcClient } from '../../../ipc/client';

export interface DiscoveredEndpoint {
  id: string;
  host: string;
  url: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  source: 'proxy' | 'robots.txt' | 'sitemap.xml' | 'html_form' | 'html_link' | 'heuristic_probe';
  params: { name: string; type: 'query' | 'body_form' | 'body_json' | 'path'; sampleValue: string }[];
  sqliScore: number; // 0 - 100
  isSqliCandidate: boolean;
  sqliReason: string;
  rawRequest: string;
  statusCode?: number;
  timestamp: number;
}

export class TargetSiteCrawler {
  private static HIGH_SQLI_PARAM_REGEX = /^(id|user|username|uid|acc|account|cat|category|prod|product|item|search|q|query|term|sort|order|by|filter|page|offset|limit|dir|view|file|lang|role|type|status|email|token)$/i;

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

    // Filter out static assets
    const isStatic = /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|mp4|webm|pdf)(\?|$)/i.test(path);
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

      // Check numeric sample value
      if (/^\d+$/.test(p.sampleValue.trim())) {
        score += 20;
        reasons.push(`Numeric value in "${p.name}" (ideal for unquoted numeric injection)`);
      }
    }

    // 2. HTTP Method & Body considerations
    if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
      score += 20;
      reasons.push(`${method} method with data-altering state`);
    }

    // 3. Dynamic Script or API Paths
    if (/\.(php|asp|aspx|jsp|do|action)(\?|$)/i.test(path)) {
      score += 15;
      reasons.push('Dynamic legacy script handler');
    }

    if (/(search|find|query|filter|catalog|products|items|orders|users|profile|login|auth|account)/i.test(path)) {
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
   * Crawls a target host or URL, finding hidden endpoints and query parameters.
   */
  public async crawlHost(
    targetUrlOrHost: string,
    onProgress?: (message: string, count: number) => void
  ): Promise<DiscoveredEndpoint[]> {
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
    const visitedPaths = new Set<string>();

    onProgress?.(`Starting content & SQL surface crawl on ${host}...`, 0);

    // ─── 1. Probe Root Page & Scrape Forms/Links ────────────────────────────
    try {
      onProgress?.(`Crawling root page ${origin}/...`, discovered.length);
      const rootRes = await this.fetchEndpoint(origin, '/');
      if (rootRes && rootRes.body) {
        const scraped = this.scrapeHtmlForEndpoints(origin, host, rootRes.body);
        for (const ep of scraped) {
          if (!visitedPaths.has(ep.path)) {
            visitedPaths.add(ep.path);
            discovered.push(ep);
          }
        }
      }
    } catch {
      // Continue crawl
    }

    // ─── 2. Probe robots.txt ───────────────────────────────────────────────
    try {
      onProgress?.('Inspecting robots.txt for hidden paths...', discovered.length);
      const robotsRes = await this.fetchEndpoint(origin, '/robots.txt');
      if (robotsRes && robotsRes.body && robotsRes.statusCode !== 404) {
        const lines = robotsRes.body.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('Disallow:') || trimmed.startsWith('Allow:')) {
            const rawPath = trimmed.split(':')[1]?.trim();
            if (rawPath && rawPath.startsWith('/') && rawPath !== '/' && !visitedPaths.has(rawPath)) {
              visitedPaths.add(rawPath);
              const endpoint = this.createEndpointFromPath(origin, host, rawPath, 'robots.txt');
              discovered.push(endpoint);
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    // ─── 3. Probe sitemap.xml ──────────────────────────────────────────────
    try {
      onProgress?.('Parsing sitemap.xml for indexed endpoints...', discovered.length);
      const sitemapRes = await this.fetchEndpoint(origin, '/sitemap.xml');
      if (sitemapRes && sitemapRes.body && sitemapRes.statusCode !== 404) {
        const locRegex = /<loc>(.*?)<\/loc>/gi;
        let m: RegExpExecArray | null;
        while ((m = locRegex.exec(sitemapRes.body)) !== null) {
          const loc = m[1]?.trim();
          if (loc && loc.includes(host)) {
            try {
              const u = new URL(loc);
              const fullPath = `${u.pathname}${u.search}`;
              if (!visitedPaths.has(fullPath)) {
                visitedPaths.add(fullPath);
                const endpoint = this.createEndpointFromPath(origin, host, fullPath, 'sitemap.xml');
                discovered.push(endpoint);
              }
            } catch {
              // Ignore invalid url
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    // ─── 4. High-Probability Dynamic SQL Injection Probes ───────────────────
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

    onProgress?.('Probing high-probability dynamic SQL injection surfaces...', discovered.length);

    for (const testPath of highProbPaths) {
      if (!visitedPaths.has(testPath)) {
        visitedPaths.add(testPath);
        const endpoint = this.createEndpointFromPath(origin, host, testPath, 'heuristic_probe');
        discovered.push(endpoint);
      }
    }

    onProgress?.(`Crawl completed: ${discovered.length} total attack surfaces discovered.`, discovered.length);

    // Sort by SQLi score descending (most vulnerable candidates first)
    return discovered.sort((a, b) => b.sqliScore - a.sqliScore);
  }

  /**
   * Scrapes HTML for <a href="..."> links and <form> elements with input fields.
   */
  public scrapeHtmlForEndpoints(origin: string, host: string, html: string): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];

    // 1. Scrape <form> elements
    const formRegex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let formMatch: RegExpExecArray | null;

    while ((formMatch = formRegex.exec(html)) !== null) {
      const formAttrs = formMatch[1] || '';
      const formBody = formMatch[2] || '';

      const actionMatch = formAttrs.match(/action=["']([^"']*)["']/i);
      const methodMatch = formAttrs.match(/method=["']([^"']*)["']/i);

      const action = actionMatch ? actionMatch[1] : '/';
      const method = (methodMatch ? methodMatch[1] : 'POST').toUpperCase();

      // Extract inputs
      const inputParams: { name: string; type: 'body_form'; sampleValue: string }[] = [];
      const inputRegex = /<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
      let inputMatch: RegExpExecArray | null;

      while ((inputMatch = inputRegex.exec(formBody)) !== null) {
        const name = inputMatch[1];
        const valMatch = inputMatch[0].match(/value=["']([^"']*)["']/i);
        const sampleValue = valMatch ? valMatch[1] : 'test';
        if (name && !name.startsWith('_csrf') && !name.startsWith('csrf')) {
          inputParams.push({ name, type: 'body_form', sampleValue });
        }
      }

      if (inputParams.length > 0) {
        const path = action.startsWith('/') ? action : `/${action}`;
        const scoring = TargetSiteCrawler.scoreSqliSurface(method, path, inputParams);

        const formBodyStr = inputParams.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.sampleValue)}`).join('&');
        const rawReq = `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${formBodyStr.length}\r\nConnection: close\r\n\r\n${formBodyStr}`;

        endpoints.push({
          id: `ep_form_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          host,
          url: `${origin}${path}`,
          path,
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
        });
      }
    }

    // 2. Scrape <a href="..."> links with query parameters
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const href = linkMatch[1];
      if (href && (href.startsWith('/') || href.startsWith('http')) && href.includes('?')) {
        try {
          const resolved = new URL(href, origin);
          if (resolved.host === host) {
            const pathWithQuery = `${resolved.pathname}${resolved.search}`;
            const ep = this.createEndpointFromPath(origin, host, pathWithQuery, 'html_link');
            endpoints.push(ep);
          }
        } catch {
          // Ignore
        }
      }
    }

    return endpoints;
  }

  /**
   * Helper to construct a DiscoveredEndpoint from a path string.
   */
  public createEndpointFromPath(
    origin: string,
    host: string,
    path: string,
    source: DiscoveredEndpoint['source']
  ): DiscoveredEndpoint {
    const isPost = path.includes('/login') || path.includes('/auth') || path.includes('/submit');
    const method = isPost ? 'POST' : 'GET';
    const params: { name: string; type: 'query' | 'body_form'; sampleValue: string }[] = [];

    let body = '';
    if (path.includes('?')) {
      const queryStr = path.split('?')[1] || '';
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

    const scoring = TargetSiteCrawler.scoreSqliSurface(method, path, params);

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

    const rawReq = `${method} ${path} HTTP/1.1\r\n` +
      Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      `\r\n\r\n${body}`;

    return {
      id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      host,
      url: `${origin}${path}`,
      path,
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
    };
  }

  /**
   * Executes HTTP request through IPC client or fallback simulator.
   */
  private async fetchEndpoint(
    origin: string,
    path: string
  ): Promise<{ statusCode: number; body: string } | null> {
    const targetUrl = `${origin}${path}`;
    const rawReq = `GET ${path} HTTP/1.1\r\nHost: ${new URL(origin).host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`;

    try {
      const res = await ipcClient.sendRepeaterRequest({
        tabId: `crawl-${Date.now()}`,
        targetUrl,
        rawRequest: rawReq,
      });

      if (res && res.statusCode) {
        return {
          statusCode: res.statusCode,
          body: res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '',
        };
      }
    } catch {
      // If IPC fails or offline, return null
    }

    return null;
  }
}

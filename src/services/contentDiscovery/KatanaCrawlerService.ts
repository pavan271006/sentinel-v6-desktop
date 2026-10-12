/**
 * Sentinel V6 - Katana Next-Gen Web Crawler & Attack Surface Discovery Engine
 *
 * Modeled after ProjectDiscovery's open-source Katana crawler (github.com/projectdiscovery/katana).
 * Features:
 * - Full-fidelity HTML & DOM Element Extraction (links, scripts, iframes, styles, meta)
 * - Deep Button & Form Mining (action, formaction, inline onclick location triggers, input fields)
 * - AST & JavaScript Regex Route Miner (Fetch, Axios, $.ajax, XHR, SPA Route Definitions)
 * - Comment & Metadata Mining (HTML comments, inline script comments, sitemap.xml, robots.txt)
 * - SecLists-grade High-Priority Hidden Directory & Sensitive File Fuzzing
 * - Breadth-First Search (BFS) Recursive Crawling with Depth Control & Scope Isolation
 */

import { ipcClient } from '../../ipc/client';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import {
  calibrateHost,
  isResponseFalsePositive,
} from './WafAndWildcardDetector';

export interface KatanaFormInput {
  name: string;
  type?: string;
  value?: string;
}

export interface KatanaDiscoveredItem {
  id: string;
  host: string;
  url: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  source: 'link' | 'button' | 'form' | 'script' | 'api' | 'fuzz' | 'sitemap' | 'robots';
  status: number;
  length: number;
  mime: string;
  title: string;
  params: boolean;
  formInputs?: KatanaFormInput[];
  notes: string;
  rawRequest: string;
  rawResponse: string;
}

export function isLogoutUrl(url: string): boolean {
  if (!url) return false;
  return /(?:logout|signout|sign-out|log-out|deauth|disconnect|invalidate|delete-account|terminate)/i.test(url);
}

export interface KatanaCrawlerConfig {
  targetHost: string;
  targetUrl: string;
  seedUrls?: string[];
  maxDepth?: number;
  concurrency?: number;
  enableFuzzing?: boolean;
  authHeaders?: Record<string, string>;
  onProgress?: (discoveredCount: number, currentTarget: string) => void;
  onItemDiscovered?: (item: KatanaDiscoveredItem) => void;
}

// ─── High-Priority Wordlists for Sensitive Path Discovery (Katana + Ffuf Hybrid) ───

export const KATANA_SENSITIVE_PATHS: string[] = [
  '/robots.txt',
  '/sitemap.xml',
  '/.well-known/security.txt',
  '/.well-known/openid-configuration',
  '/swagger.json',
  '/swagger/v1/swagger.json',
  '/openapi.json',
  '/v2/api-docs',
  '/v3/api-docs',
  '/api-docs',
  '/docs',
  '/graphql',
  '/graphiql',
  '/altair',
  '/api',
  '/api/v1',
  '/api/v2',
  '/api/v1/users',
  '/api/v1/auth',
  '/api/v1/me',
  '/admin',
  '/admin/login',
  '/administrator',
  '/dashboard',
  '/console',
  '/portal',
  '/login',
  '/auth',
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/HEAD',
  '/.git/config',
  '/package.json',
  '/config.json',
  '/settings.json',
  '/backup.zip',
  '/backup.sql',
  '/dump.sql',
  '/database.sql',
  '/actuator',
  '/actuator/health',
  '/actuator/env',
  '/actuator/mappings',
  '/metrics',
  '/healthz',
  '/debug',
  '/trace',
  '/server.js',
  '/static',
  '/assets',
  '/public',
];

export class KatanaCrawlerService {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
  }

  /**
   * Helper to normalize any link against base URL and ensure proper protocol
   */
  private normalizeUrl(link: string, baseUrl: string, host: string): string | null {
    if (!link || link.startsWith('javascript:') || link.startsWith('mailto:') || link.startsWith('data:') || link.startsWith('#')) {
      return null;
    }

    try {
      const parsed = new URL(link, baseUrl);
      // Scope Check: Stay on the target host (or matching subdomain)
      if (parsed.host === host || parsed.host.endsWith(`.${host}`)) {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts links, forms, buttons, and endpoints from HTML/JS payload
   */
  public extractAllSurfaces(
    body: string,
    currentUrl: string,
    host: string
  ): {
    links: string[];
    buttons: Array<{ label: string; actionUrl?: string; onClickCode?: string }>;
    forms: Array<{ actionUrl: string; method: string; inputs: KatanaFormInput[] }>;
    scripts: string[];
    jsRoutes: string[];
  } {
    const links = new Set<string>();
    const scripts = new Set<string>();
    const jsRoutes = new Set<string>();
    const buttons: Array<{ label: string; actionUrl?: string; onClickCode?: string }> = [];
    const forms: Array<{ actionUrl: string; method: string; inputs: KatanaFormInput[] }> = [];

    if (!body || typeof body !== 'string') {
      return { links: [], buttons: [], forms: [], scripts: [], jsRoutes: [] };
    }

    // 1. Standard HTML Links & Element hrefs (<a href="...">, <li href="...">, <div href="...">, etc.)
    const linkRegex = /<[a-zA-Z0-9_-]+\s+[^>]*?\bhref=["']([^"'#\s>]+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(body)) !== null) {
      const normalized = this.normalizeUrl(match[1], currentUrl, host);
      if (normalized && !isLogoutUrl(normalized)) links.add(normalized);
    }

    // 2. Scripts: <script src="...">
    const scriptSrcRegex = /<script\s+[^>]*?src=["']([^"'#\s>]+)["']/gi;
    while ((match = scriptSrcRegex.exec(body)) !== null) {
      const normalized = this.normalizeUrl(match[1], currentUrl, host);
      if (normalized) scripts.add(normalized);
    }

    // 3. Media & Iframes: <iframe src="...">, <img src="...">, <embed src="...">
    const mediaRegex = /<(?:iframe|frame|embed|img|source)\s+[^>]*?src=["']([^"'#\s>]+)["']/gi;
    while ((match = mediaRegex.exec(body)) !== null) {
      const normalized = this.normalizeUrl(match[1], currentUrl, host);
      if (normalized && !isLogoutUrl(normalized)) links.add(normalized);
    }

    // 4. HTML5 Data Attributes: data-url, data-href, data-endpoint, data-path, data-link, data-nav
    const dataAttrRegex = /\bdata-(?:url|href|endpoint|path|target|route|link|nav|action)=["']([^"'#\s>]+)["']/gi;
    while ((match = dataAttrRegex.exec(body)) !== null) {
      const normalized = this.normalizeUrl(match[1], currentUrl, host);
      if (normalized && !isLogoutUrl(normalized)) links.add(normalized);
    }

    // 5. Button Extraction: <button ...> (Form actions, onclick navigation, button labels)
    const buttonRegex = /<button\s+([^>]*?)>([\s\S]*?)<\/button>/gi;
    while ((match = buttonRegex.exec(body)) !== null) {
      const attributes = match[1];
      const innerText = match[2].replace(/<[^>]+>/g, '').trim();

      let actionUrl: string | undefined;
      let onClickCode: string | undefined;

      // formaction attribute
      const formactionMatch = /formaction=["']([^"'#\s>]+)["']/i.exec(attributes);
      if (formactionMatch) {
        const norm = this.normalizeUrl(formactionMatch[1], currentUrl, host);
        if (norm && !isLogoutUrl(norm)) actionUrl = norm;
      }

      // onclick location.href or window.open or function calls
      const onclickMatch = /onclick=["']([^"']+)["']/i.exec(attributes);
      if (onclickMatch) {
        onClickCode = onclickMatch[1];
        const navMatch = /(?:location(?:\.href)?|window\.open|navigate|loadPage|loadModule|openUrl|goTo)\s*[=\(]\s*['"]([^'"]+)['"]/i.exec(onclickMatch[1]);
        if (navMatch) {
          const norm = this.normalizeUrl(navMatch[1], currentUrl, host);
          if (norm && !isLogoutUrl(norm)) actionUrl = norm;
        }
      }

      buttons.push({
        label: innerText || 'Button',
        actionUrl,
        onClickCode,
      });

      if (actionUrl && !isLogoutUrl(actionUrl)) {
        links.add(actionUrl);
      }
    }

    // 5b. General onclick attributes on <li>, <div>, <a>, <span> (Modern sidebar & application menus)
    const generalOnClickRegex = /<(?:li|div|a|span|tr|td|button)\s+[^>]*?\bonclick=["']([^"']+)["']/gi;
    while ((match = generalOnClickRegex.exec(body)) !== null) {
      const clickCode = match[1];
      const urlMatches = clickCode.matchAll(/['"](\/[a-zA-Z0-9_\-\.\/\?=&%#]{2,})['"]/gi);
      for (const m of urlMatches) {
        if (!m[1].startsWith('//') && !m[1].startsWith('/*')) {
          const norm = this.normalizeUrl(m[1], currentUrl, host);
          if (norm && !isLogoutUrl(norm)) links.add(norm);
        }
      }
    }

    // 5c. Input Buttons: <input type="button|submit|reset|image" value="..." formaction="...">
    const inputBtnRegex = /<input\s+[^>]*?type=["'](?:button|submit|reset|image)["'][^>]*?>/gi;
    while ((match = inputBtnRegex.exec(body)) !== null) {
      const attrs = match[0];
      const valMatch = /value=["']([^"']*)["']/i.exec(attrs);
      const formActMatch = /formaction=["']([^"'#\s>]+)["']/i.exec(attrs);
      let actionUrl: string | undefined;
      if (formActMatch) {
        const norm = this.normalizeUrl(formActMatch[1], currentUrl, host);
        if (norm && !isLogoutUrl(norm)) actionUrl = norm;
      }
      buttons.push({
        label: valMatch ? valMatch[1] : 'Input Button',
        actionUrl,
      });
      if (actionUrl) links.add(actionUrl);
    }

    // 5d. HTMX & Modern Framework Triggers: hx-get, hx-post, hx-put, hx-delete, hx-patch
    const htmxRegex = /\bhx-(?:get|post|put|delete|patch)=["']([^"'#\s>]+)["']/gi;
    while ((match = htmxRegex.exec(body)) !== null) {
      const norm = this.normalizeUrl(match[1], currentUrl, host);
      if (norm && !isLogoutUrl(norm)) {
        links.add(norm);
        jsRoutes.add(norm);
      }
    }

    // 5e. ARIA Buttons: <div role="button" data-url="...">, <span role="button" ...>
    const ariaBtnRegex = /<[a-zA-Z0-9_-]+\s+[^>]*?\brole=["'](?:button|tab|menuitem|link)["'][^>]*?>([\s\S]*?)<\/[a-zA-Z0-9_-]+>/gi;
    while ((match = ariaBtnRegex.exec(body)) !== null) {
      const attrs = match[0];
      const text = match[1].replace(/<[^>]+>/g, '').trim().slice(0, 50);
      const dataMatch = /data-(?:url|href|endpoint|route)=["']([^"'#\s>]+)["']/i.exec(attrs);
      if (dataMatch) {
        const norm = this.normalizeUrl(dataMatch[1], currentUrl, host);
        if (norm && !isLogoutUrl(norm)) {
          buttons.push({ label: text || 'ARIA Button', actionUrl: norm });
          links.add(norm);
        }
      }
    }

    // 5f. Next.js Data Manifest & Routes
    const nextDataMatch = /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(body);
    if (nextDataMatch) {
      try {
        const nextJson = JSON.parse(nextDataMatch[1]);
        if (nextJson.page) {
          const norm = this.normalizeUrl(nextJson.page, currentUrl, host);
          if (norm) links.add(norm);
        }
      } catch {}
    }

    // 6. Form Extraction: <form action="..." method="..."> with child inputs
    const formBlockRegex = /<form\s+([^>]*?)>([\s\S]*?)<\/form>/gi;
    while ((match = formBlockRegex.exec(body)) !== null) {
      const formAttrs = match[1];
      const formInner = match[2];

      const actionMatch = /action=["']([^"']*)["']/i.exec(formAttrs);
      const rawAction = actionMatch ? actionMatch[1] : '';
      const methodMatch = /method=["']([a-zA-Z]+)["']/i.exec(formAttrs);
      const method = (methodMatch ? methodMatch[1].toUpperCase() : 'GET');

      const actionUrl = this.normalizeUrl(rawAction || currentUrl, currentUrl, host) || currentUrl;

      // Extract form input fields
      const inputs: KatanaFormInput[] = [];
      const inputRegex = /<(?:input|textarea|select)\s+([^>]*?)>/gi;
      let inputMatch: RegExpExecArray | null;
      while ((inputMatch = inputRegex.exec(formInner)) !== null) {
        const iAttrs = inputMatch[1];
        const nameMatch = /name=["']([^"']+)["']/i.exec(iAttrs);
        if (nameMatch) {
          const typeMatch = /type=["']([^"']+)["']/i.exec(iAttrs);
          const valueMatch = /value=["']([^"']*)["']/i.exec(iAttrs);
          inputs.push({
            name: nameMatch[1],
            type: typeMatch ? typeMatch[1] : 'text',
            value: valueMatch ? valueMatch[1] : '',
          });
        }
      }

      forms.push({
        actionUrl,
        method,
        inputs,
      });

      if (!isLogoutUrl(actionUrl)) {
        links.add(actionUrl);
      }
    }

    // 7. JavaScript Deep Route Mining (Katana regex rules for Fetch, Axios, SPA routing, API & REST endpoints)
    const jsEndpointRegex = /(?:["'`])((\/[a-zA-Z0-9_\-\.\/\?=&%#]{2,})|(?:https?:\/\/[a-zA-Z0-9_\-\.:]+\/[a-zA-Z0-9_\-\.\/\?=&%#]+))(?:["'`])/gi;
    while ((match = jsEndpointRegex.exec(body)) !== null) {
      const candidate = match[1];
      if (!candidate.startsWith('//') && !candidate.startsWith('/*')) {
        const normalized = this.normalizeUrl(candidate, currentUrl, host);
        if (normalized && !isLogoutUrl(normalized)) {
          jsRoutes.add(normalized);
          links.add(normalized);
        }
      }
    }

    // Fetch / Axios calls: fetch('/api/...')
    const fetchRegex = /(?:fetch|axios\.(?:get|post|put|delete|patch)|\$\.ajax|\$\.get|\$\.post)\s*\(\s*["'`]?([^"'`\s,\)]+)/gi;
    while ((match = fetchRegex.exec(body)) !== null) {
      const normalized = this.normalizeUrl(match[1], currentUrl, host);
      if (normalized && !isLogoutUrl(normalized)) {
        jsRoutes.add(normalized);
        links.add(normalized);
      }
    }

    // 8. Comments Endpoint Mining (HTML & JS comments)
    const commentRegex = /(?:<!--|\/\*|\/\/)\s*(?:TODO|FIXME|API|Endpoint|Route)?\s*:?\s*(\/[a-zA-Z0-9_\-\.\/]+)/gi;
    while ((match = commentRegex.exec(body)) !== null) {
      const normalized = this.normalizeUrl(match[1], currentUrl, host);
      if (normalized && !isLogoutUrl(normalized)) {
        links.add(normalized);
      }
    }

    return {
      links: Array.from(links),
      buttons,
      forms,
      scripts: Array.from(scripts),
      jsRoutes: Array.from(jsRoutes),
    };
  }

  /**
   * Main Execution: Starts the Katana-grade crawl & hidden content discovery
   */
  public async runKatanaCrawl(config: KatanaCrawlerConfig): Promise<SiteMapRequest[]> {
    this.isAborted = false;
    const { targetHost, targetUrl, maxDepth = 2, onProgress, onItemDiscovered } = config;

    const discoveredMap = new Map<string, SiteMapRequest>();
    const visitedUrls = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: targetUrl, depth: 1 }];
    if (config.seedUrls && Array.isArray(config.seedUrls)) {
      for (const s of config.seedUrls) {
        if (s && !isLogoutUrl(s) && s !== targetUrl) {
          queue.push({ url: s, depth: 1 });
        }
      }
    }

    let totalDiscovered = 0;

    const pushItem = (item: SiteMapRequest) => {
      const key = `${item.method}:${item.host}${item.path}`;
      if (!discoveredMap.has(key)) {
        discoveredMap.set(key, item);
        totalDiscovered++;
        if (onProgress) onProgress(totalDiscovered, item.path);
        if (onItemDiscovered) {
          onItemDiscovered({
            id: String(item.id),
            host: item.host,
            url: item.url,
            path: item.path,
            method: item.method as any,
            source: (item.notes.includes('Form') ? 'form' : item.notes.includes('Button') ? 'button' : item.notes.includes('Fuzz') ? 'fuzz' : 'link'),
            status: item.status,
            length: item.length,
            mime: item.mime,
            title: item.title,
            params: item.params,
            notes: item.notes,
            rawRequest: item.requestRaw,
            rawResponse: item.responseRaw,
          });
        }
      }
    };

    // ─── Step 0: Calibrate Target for WAF Protection & Wildcard Soft-404s ───
    const calibration = await calibrateHost(targetHost, config.authHeaders);
    if (calibration.isWafProtected) {
      if (onProgress) {
        onProgress(totalDiscovered, `[WAF Protected] ${calibration.wafType || 'Bot Challenge'} active on ${targetHost}. Automated fuzzing filtered.`);
      }
    }

    let authHeaderLines = '';
    if (config.authHeaders) {
      for (const [key, value] of Object.entries(config.authHeaders)) {
        if (value) {
          authHeaderLines += `${key}: ${value}\r\n`;
        }
      }
    }

    // ─── Phase 1: High-Priority Sensitive Directory Fuzzing (SecLists / Ffuf Hybrid) ───
    // If target is returning Cloudflare/WAF challenges on every request, skip blind fuzzing to prevent flooding sitemap with false positives
    if (config.enableFuzzing !== false && !calibration.isWafProtected) {
      for (const endpoint of KATANA_SENSITIVE_PATHS) {
        if (this.isAborted) break;

        const probeUrl = `https://${targetHost}${endpoint}`;
        const rawReq = `GET ${endpoint} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 Katana/2.2\r\nAccept: */*\r\n${authHeaderLines}Connection: close\r\n\r\n`;

        try {
          const res = await ipcClient.sendRepeaterRequest({
            tabId: `katana-fuzz-${Date.now()}`,
            targetUrl: probeUrl,
            rawRequest: rawReq,
          });

          if (res && res.statusCode) {
            const resBody = res.body || res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
            const length = res.sizeBytes || resBody.length;

            // Reject false positives: WAF challenges, soft-404s matching calibrated canary, or 404s
            const fpCheck = isResponseFalsePositive(res.statusCode, resBody, length, calibration);
            if (fpCheck.isFalsePositive) {
              continue;
            }

            const mime = endpoint.endsWith('.json')
              ? 'JSON'
              : endpoint.endsWith('.xml')
              ? 'XML'
              : endpoint.endsWith('.txt')
              ? 'text'
              : 'HTML';

            pushItem({
              id: `katana-fuzz-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
              host: targetHost,
              method: 'GET',
              url: endpoint,
              path: endpoint,
              params: false,
              status: res.statusCode,
              length,
              mime,
              title: endpoint,
              notes: `Discovered by Katana Directory Fuzzer (HTTP ${res.statusCode})`,
              requestRaw: rawReq,
              responseRaw: res.rawResponse || `HTTP/1.1 ${res.statusCode} OK\r\n\r\n${resBody}`,
              reqAttributes: { Method: 'GET', Path: endpoint },
              reqHeaders: { Host: targetHost },
              resAttributes: { Status: `${res.statusCode}`, MIME: mime },
              resHeaders: {},
              isDiscovered: true,
            });

            // Extract more links from newly discovered robots.txt
            if (endpoint === '/robots.txt') {
              const lines = resBody.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('Disallow:') || trimmed.startsWith('Allow:')) {
                  const p = trimmed.split(':')[1]?.trim();
                  if (p && p.startsWith('/') && p !== '/') {
                    pushItem({
                      id: `robots-${p.replace(/[^a-zA-Z0-9]/g, '_')}`,
                      host: targetHost,
                      method: 'GET',
                      url: p,
                      path: p,
                      params: p.includes('?'),
                      status: 0,
                      length: 0,
                      mime: 'text',
                      title: p,
                      notes: `Declared in robots.txt (${trimmed.split(':')[0]}) - Unrequested`,
                      requestRaw: `GET ${p} HTTP/1.1\r\nHost: ${targetHost}\r\n\r\n`,
                      responseRaw: `HTTP/1.1 0 Unrequested\r\n\r\n(Declared in robots.txt - click 'Request item' to fetch live)`,
                      reqAttributes: { Method: 'GET', Path: p },
                      reqHeaders: { Host: targetHost },
                      resAttributes: { Status: 'Declared' },
                      resHeaders: {},
                      isDiscovered: true,
                    });
                  }
                }
              }
            }
          }
        } catch {
          // ignore network timeout on fuzz probe
        }
      }
    }

    // ─── Phase 2: Recursive Deep Crawl (Katana BFS Queue) ───
    while (queue.length > 0 && !this.isAborted) {
      const current = queue.shift()!;
      if (visitedUrls.has(current.url)) continue;
      visitedUrls.add(current.url);

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(current.url);
      } catch {
        continue;
      }

      const reqPath = parsedUrl.pathname + parsedUrl.search;
      const rawReq = `GET ${reqPath} HTTP/1.1\r\nHost: ${parsedUrl.host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 Katana/2.2\r\nAccept: */*\r\n${authHeaderLines}Connection: close\r\n\r\n`;

      try {
        const res = await ipcClient.sendRepeaterRequest({
          tabId: `katana-crawl-${Date.now()}`,
          targetUrl: current.url,
          rawRequest: rawReq,
        });

        const statusCode = res?.statusCode || 200;
        const resBody = res?.body || res?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        const length = res?.sizeBytes || resBody.length;

        // Skip WAF challenge pages and soft-404 false positives
        const fp = isResponseFalsePositive(statusCode, resBody, length, calibration);
        if (fp.isFalsePositive) {
          continue;
        }

        // Follow HTTP 301/302/303/307/308 Location header to crawl redirected routes (e.g. / -> /admin)
        if (statusCode >= 300 && statusCode < 400) {
          let redirectLoc: string | null = null;
          if (res?.headers && Array.isArray(res.headers)) {
            const locHeader = res.headers.find((h) => h.name.toLowerCase() === 'location');
            if (locHeader && locHeader.value) redirectLoc = locHeader.value;
          }
          if (!redirectLoc && res?.rawResponse) {
            const match = /location:\s*([^\r\n]+)/i.exec(res.rawResponse);
            if (match) redirectLoc = match[1].trim();
          }
          if (redirectLoc) {
            const normRedirect = this.normalizeUrl(redirectLoc, current.url, targetHost);
            if (normRedirect && !isLogoutUrl(normRedirect) && !visitedUrls.has(normRedirect) && current.depth <= maxDepth) {
              queue.push({ url: normRedirect, depth: current.depth });
            }
          }
        }

        const mime = reqPath.endsWith('.js') ? 'script' : reqPath.endsWith('.json') ? 'JSON' : 'HTML';

        pushItem({
          id: `katana-${parsedUrl.host}-${reqPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
          host: parsedUrl.host,
          method: 'GET',
          url: reqPath,
          path: reqPath,
          params: reqPath.includes('?'),
          status: statusCode,
          length,
          mime,
          title: reqPath,
          notes: `Katana Crawl (Depth ${current.depth}, HTTP ${statusCode})`,
          requestRaw: rawReq,
          responseRaw: res?.rawResponse || `HTTP/1.1 ${statusCode} OK\r\n\r\n${resBody}`,
          reqAttributes: { Method: 'GET', Path: reqPath },
          reqHeaders: { Host: parsedUrl.host },
          resAttributes: { Status: `${statusCode}`, MIME: mime },
          resHeaders: {},
          isDiscovered: true,
        });

        // If body is HTML or JS, execute Katana Deep Surface Extraction
        if (resBody && current.depth <= maxDepth) {
          const extraction = this.extractAllSurfaces(resBody, current.url, targetHost);

          // 1. Process Form surfaces
          for (const form of extraction.forms) {
            try {
              const formUrl = new URL(form.actionUrl);
              const formPath = formUrl.pathname + formUrl.search;
              const inputNames = form.inputs.map((i) => i.name).join(', ');

              const sampleBody = form.inputs
                .map((i) => `${encodeURIComponent(i.name)}=${encodeURIComponent(i.value || 'test')}`)
                .join('&');

              const formRawReq = `${form.method} ${formPath} HTTP/1.1\r\nHost: ${formUrl.host}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${sampleBody}`;

              pushItem({
                id: `katana-form-${formUrl.host}-${formPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
                host: formUrl.host,
                method: form.method,
                url: formPath,
                path: formPath,
                params: form.inputs.length > 0,
                status: 200,
                length: sampleBody.length,
                mime: 'HTML',
                title: `Form: ${formPath}`,
                notes: `Katana Form Action (${form.method} with inputs: ${inputNames || 'none'})`,
                requestRaw: formRawReq,
                responseRaw: `HTTP/1.1 200 OK\r\n\r\n(Form Target Analyzed)`,
                reqAttributes: { Method: form.method, Path: formPath },
                reqHeaders: { Host: formUrl.host },
                resAttributes: { Status: '200' },
                resHeaders: {},
                isDiscovered: true,
              });
            } catch {
              // ignore invalid form url
            }
          }

          // 2. Process Button Surfaces
          for (const btn of extraction.buttons) {
            if (btn.actionUrl) {
              try {
                const btnUrl = new URL(btn.actionUrl);
                const btnPath = btnUrl.pathname + btnUrl.search;
                pushItem({
                  id: `katana-btn-${btnUrl.host}-${btnPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
                  host: btnUrl.host,
                  method: 'GET',
                  url: btnPath,
                  path: btnPath,
                  params: btnPath.includes('?'),
                  status: 200,
                  length: 0,
                  mime: 'HTML',
                  title: `Button: ${btn.label}`,
                  notes: `Katana Interactive Button Click (${btn.label})`,
                  requestRaw: `GET ${btnPath} HTTP/1.1\r\nHost: ${btnUrl.host}\r\n\r\n`,
                  responseRaw: `HTTP/1.1 200 OK\r\n\r\n(Interactive Button Target)`,
                  reqAttributes: { Method: 'GET', Path: btnPath },
                  reqHeaders: { Host: btnUrl.host },
                  resAttributes: { Status: '200' },
                  resHeaders: {},
                  isDiscovered: true,
                });
              } catch {}
            }
          }

          // 3. Queue newly discovered links for BFS traversal
          for (const discoveredLink of extraction.links) {
            if (!visitedUrls.has(discoveredLink) && current.depth < maxDepth && !isLogoutUrl(discoveredLink)) {
              queue.push({ url: discoveredLink, depth: current.depth + 1 });
            }
          }

          // 4. Crawl JS bundles to extract hidden API routes inside frontend code
          for (const scriptUrl of extraction.scripts) {
            if (!visitedUrls.has(scriptUrl)) {
              visitedUrls.add(scriptUrl);
              try {
                const scriptParsed = new URL(scriptUrl);
                const sPath = scriptParsed.pathname;
                const sReq = `GET ${sPath} HTTP/1.1\r\nHost: ${scriptParsed.host}\r\n${authHeaderLines}Connection: close\r\n\r\n`;
                const sRes = await ipcClient.sendRepeaterRequest({
                  tabId: `katana-script-${Date.now()}`,
                  targetUrl: scriptUrl,
                  rawRequest: sReq,
                });

                const scriptBody = sRes?.body || sRes?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
                if (scriptBody) {
                  const jsExtraction = this.extractAllSurfaces(scriptBody, scriptUrl, targetHost);
                  for (const jsRoute of jsExtraction.jsRoutes) {
                    try {
                      const rUrl = new URL(jsRoute);
                      pushItem({
                        id: `katana-js-${rUrl.host}-${rUrl.pathname.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        host: rUrl.host,
                        method: 'GET',
                        url: rUrl.pathname + rUrl.search,
                        path: rUrl.pathname + rUrl.search,
                        params: rUrl.search.length > 0,
                        status: 200,
                        length: 0,
                        mime: 'JSON',
                        title: `API Route: ${rUrl.pathname}`,
                        notes: `Katana JavaScript Route Miner (Discovered in ${sPath})`,
                        requestRaw: `GET ${rUrl.pathname + rUrl.search} HTTP/1.1\r\nHost: ${rUrl.host}\r\n\r\n`,
                        responseRaw: `HTTP/1.1 200 OK\r\n\r\n(API Route extracted from JS bundle)`,
                        reqAttributes: { Method: 'GET', Path: rUrl.pathname },
                        reqHeaders: { Host: rUrl.host },
                        resAttributes: { Status: '200' },
                        resHeaders: {},
                        isDiscovered: true,
                      });
                    } catch {}
                  }
                }
              } catch {}
            }
          }
        }
      } catch {
        // Continue crawl
      }
    }

    return Array.from(discoveredMap.values());
  }
}

export const katanaCrawlerService = new KatanaCrawlerService();

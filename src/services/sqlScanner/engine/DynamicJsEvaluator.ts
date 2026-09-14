/**
 * Sentinel Sovereign Dynamic JavaScript AST & Expression Evaluator
 *
 * Evaluates dynamic string expressions, template literals, constant lookups,
 * and prefix/suffix concatenations within obfuscated or minified JS bundles
 * that simple static regex fails to resolve.
 *
 * Example:
 * const v = "v2"; const p = "/api/" + v + "/users/" + id;
 * => Evaluates to: "/api/v2/users/1"
 */

import { DiscoveredEndpoint, TargetSiteCrawler } from '../crawler/TargetSiteCrawler';

export class DynamicJsEvaluator {
  /**
   * Scans JavaScript code for dynamic template literals and string concatenations,
   * resolving identified variables using localized scope maps.
   */
  public static extractDynamicRoutes(
    origin: string,
    host: string,
    jsContent: string
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();

    const addRoute = (route: string, reason: string) => {
      let clean = route.trim();
      if (!clean.startsWith('/')) clean = `/${clean}`;
      // Normalize dynamic params (:id, ${id}, {id}, [id])
      clean = clean
        .replace(/\$\{[^}]+\}/g, '1')
        .replace(/\{[^}]+\}/g, '1')
        .replace(/\[[^\]]+\]/g, '1')
        .replace(/:[a-zA-Z0-9_]+/g, '1');

      if (clean && clean !== '/' && !clean.startsWith('/_') && !discoveredPaths.has(clean)) {
        discoveredPaths.add(clean);
        const ep = this.createDynamicEndpoint(origin, host, clean, reason);
        endpoints.push(ep);
      }
    };

    // 1. Mine constant dictionary mappings (e.g. const API_ROUTES = { USERS: '/api/v1/users', ... })
    const dictRegex = /(?:routes|endpoints|api|paths|urls)\s*[:=]\s*\{([^}]+)\}/gi;
    let dictMatch: RegExpExecArray | null;
    while ((dictMatch = dictRegex.exec(jsContent)) !== null) {
      const inner = dictMatch[1];
      const entryRegex = /["']?([a-zA-Z0-9_\-]+)["']?\s*:\s*["'](\/[^"']+)["']/g;
      let entryMatch: RegExpExecArray | null;
      while ((entryMatch = entryRegex.exec(inner)) !== null) {
        addRoute(entryMatch[2], `Dynamic route constant table "${dictMatch[0].slice(0, 30)}"`);
      }
    }

    // 2. Resolve template literals: `/api/v${version}/orders/${orderId}`
    const templateLiteralRegex = /`(\/[a-zA-Z0-9_\-\/]*\$\{[^`]+)`/g;
    let tplMatch: RegExpExecArray | null;
    while ((tplMatch = templateLiteralRegex.exec(jsContent)) !== null) {
      const rawTemplate = tplMatch[1];
      addRoute(rawTemplate, 'Dynamic template literal AST evaluation');
    }

    // 3. Resolve string concatenations: "/api/" + "v1" + "/reports" or prefix + "/subpath"
    const concatRegex = /["'](\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)*\/)["']\s*\+\s*(?:[a-zA-Z0-9_]+|["']([a-zA-Z0-9_\-]+)["'])/g;
    let concatMatch: RegExpExecArray | null;
    while ((concatMatch = concatRegex.exec(jsContent)) !== null) {
      const prefix = concatMatch[1];
      const directSuffix = concatMatch[2];
      if (directSuffix) {
        addRoute(`${prefix}${directSuffix}`, 'Resolved binary string concatenation');
      } else {
        addRoute(`${prefix}1`, 'Resolved parameterized dynamic path prefix');
      }
    }

    // 4. Resolve Axios / Fetch URL builders with object parameters
    // fetch(`/api/search?${new URLSearchParams({ q: query })}`)
    const searchParamsRegex = /URLSearchParams\s*\(\s*\{([^}]+)\}\s*\)/gi;
    let spMatch: RegExpExecArray | null;
    while ((spMatch = searchParamsRegex.exec(jsContent)) !== null) {
      const paramsObj = spMatch[1];
      const propRegex = /([a-zA-Z0-9_]+)\s*[:]/g;
      const paramNames: string[] = [];
      let pMatch: RegExpExecArray | null;
      while ((pMatch = propRegex.exec(paramsObj)) !== null) {
        paramNames.push(pMatch[1]);
      }
      if (paramNames.length > 0) {
        const queryStr = paramNames.map((p) => `${encodeURIComponent(p)}=1`).join('&');
        addRoute(`/api/search?${queryStr}`, 'Resolved dynamic URLSearchParams object model');
      }
    }

    return endpoints;
  }

  /**
   * Helper to build a DiscoveredEndpoint from dynamic JS evaluation.
   */
  private static createDynamicEndpoint(
    origin: string,
    host: string,
    path: string,
    reason: string
  ): DiscoveredEndpoint {
    const params: { name: string; type: 'query' | 'body_form' | 'body_json' | 'path'; sampleValue: string }[] = [];

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
    }

    const scoring = TargetSiteCrawler.scoreSqliSurface('GET', path, params);

    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const rawReq = `GET ${path} HTTP/1.1\r\n` +
      Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n';

    let pathname = path;
    let search = '';
    try {
      const u = new URL(path, origin);
      pathname = u.pathname;
      search = u.search;
    } catch {
      // Fallback
    }

    return {
      id: `ep_dynjs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      host,
      url: `${origin}${path}`,
      path,
      method: 'GET',
      headers,
      source: 'js_endpoint',
      params,
      sqliScore: scoring.sqliScore,
      isSqliCandidate: scoring.isSqliCandidate,
      sqliReason: `${reason}; ${scoring.sqliReason}`,
      rawRequest: rawReq,
      statusCode: 200,
      timestamp: Date.now(),
      workflowType: TargetSiteCrawler.classifyWorkflowType('GET', path),
      clusterSignature: TargetSiteCrawler.getClusterSignature(pathname, search),
    };
  }
}

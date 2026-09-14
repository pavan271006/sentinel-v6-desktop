/**
 * Sentinel Canvas & WebGL AST Miner (Flutter Web, Canva, Figma, WASM/Skia)
 *
 * Solves the zero-DOM Canvas problem by:
 * 1. Detecting Canvas/WebGL architectures (Flutter Web, CanvasKit, Unity WebGL, Emscripten).
 * 2. Dissecting compiled Dart constant pools (main.dart.js) and WASM binary string tables.
 * 3. Extracting compiled REST/GraphQL endpoints, HTTP methods, and model schemas into crawler surfaces.
 */

import { DiscoveredEndpoint, TargetSiteCrawler } from '../crawler/TargetSiteCrawler';

export class CanvasAstExtractor {
  /**
   * Detects if the target page is rendered purely on HTML5 <canvas> or WebGL without standard DOM nodes.
   */
  public static isCanvasOrWasmApp(html: string): boolean {
    if (!html) return false;
    return (
      /<canvas/i.test(html) &&
      (/(?:flutter.js|main.dart.js|canvaskit.wasm|flt-glass-pane|flutter-view|UnityLoader|wasm-bindgen|emscripten)/i.test(
        html
      ) ||
        /<canvas[^>]+id=["'](?:flutter|unity|game|app|stage)["']/i.test(html))
    );
  }

  /**
   * Dissects Flutter Web / Dart compiled JavaScript bundles or WASM string sections
   * to extract compiled REST routes, query parameters, and JSON model payloads.
   */
  public static extractEndpointsFromDartBundle(
    origin: string,
    host: string,
    bundleContent: string
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    if (!bundleContent || bundleContent.length < 20) return endpoints;

    const addedPaths = new Set<string>();

    const addEndpoint = (path: string, method: string = 'GET', body?: string, params: { name: string; type: 'query' | 'body_json' | 'body_form'; sampleValue: string }[] = []) => {
      if (TargetSiteCrawler.isSafetyBlocked(path)) return;

      const isJson = !!body;
      const headers: Record<string, string> = {
        Host: host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 (Flutter/Canvas Mode)',
        Accept: isJson ? 'application/json' : 'text/html,*/*',
        Connection: 'close',
      };
      if (isJson) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = `${body.length}`;
      }

      const scoring = TargetSiteCrawler.scoreSqliSurface(method, path, params);

      const rawRequest =
        `${method} ${path} HTTP/1.1\r\n` +
        Object.entries(headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        `\r\n\r\n${body || ''}`;

      const newEp: DiscoveredEndpoint = {
        id: `ep_canvas_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        host,
        url: `${origin}${path}`,
        path,
        method,
        headers,
        body,
        source: 'js_endpoint',
        params,
        sqliScore: scoring.sqliScore,
        isSqliCandidate: scoring.isSqliCandidate,
        sqliReason: `Canvas/Flutter compiled Dart string pool; ${scoring.sqliReason}`,
        rawRequest,
        statusCode: 200,
        timestamp: Date.now(),
        workflowType: TargetSiteCrawler.classifyWorkflowType(method, path),
      };

      const existingIdx = endpoints.findIndex((e) => e.path === path);
      if (existingIdx >= 0) {
        if (body || method !== 'GET' || params.some((p) => p.type === 'body_json')) {
          endpoints[existingIdx] = newEp;
        }
      } else {
        addedPaths.add(path);
        endpoints.push(newEp);
      }
    };

    // 1. Mine Dart String Constants for API routes: "/api/v1/...", "/orders/...", "https://host/api/..."
    const dartRouteRegex = /["'](\/(?:api|v[0-9]+|auth|users|products|items|orders|cart|checkout|reports|graphql|trpc|gateway)\/[a-zA-Z0-9_\-\/]+(?:\?[a-zA-Z0-9_\-=&]+)?)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = dartRouteRegex.exec(bundleContent)) !== null) {
      const route = match[1];
      if (!route.endsWith('.js') && !route.endsWith('.wasm') && !route.endsWith('.png')) {
        const hasParams = route.includes('?');
        const params: { name: string; type: 'query' | 'body_json' | 'body_form'; sampleValue: string }[] = [];
        if (hasParams) {
          const search = route.split('?')[1];
          const sp = new URLSearchParams(search);
          sp.forEach((val, key) => {
            params.push({ name: key, type: 'query', sampleValue: val || '1' });
          });
        }
        addEndpoint(route, 'GET', undefined, params);
      }
    }

    // 2. Mine Dart Dio / http.post JSON serialization maps: {'userId': ..., 'orderId': ..., 'status': ...}
    const dartJsonMapRegex = /(?:dio\.(?:post|put)|http\.(?:post|put)|postJson)\s*\(\s*["'](\/[a-zA-Z0-9_\-\/]+)["']\s*,\s*(?:data|body)\s*:\s*(\{[\s\S]*?\})\s*\)/gi;
    while ((match = dartJsonMapRegex.exec(bundleContent)) !== null) {
      const path = match[1];
      const rawMap = match[2];

      const params: { name: string; type: 'body_json'; sampleValue: string }[] = [];
      const sampleObj: Record<string, any> = {};
      const keyMatches = rawMap.matchAll(/["']([a-zA-Z0-9_]+)["']\s*:/g);
      for (const km of keyMatches) {
        const key = km[1];
        sampleObj[key] = '1';
        params.push({ name: key, type: 'body_json', sampleValue: '1' });
      }

      const body = Object.keys(sampleObj).length > 0 ? JSON.stringify(sampleObj) : '{"id":1}';
      addEndpoint(path, 'POST', body, params);
    }

    // 3. Mine GraphQL queries embedded in Dart code: query { ... } / mutation { ... }
    const gqlRegex = /["'](?:query|mutation)\s+([a-zA-Z0-9_]+)\s*\{([\s\S]*?)\}["']/gi;
    while ((match = gqlRegex.exec(bundleContent)) !== null) {
      const opName = match[1];
      const body = JSON.stringify({ query: `query ${opName} { ${match[2].trim()} }` });
      addEndpoint('/graphql', 'POST', body, [{ name: 'query', type: 'body_json', sampleValue: opName }]);
    }

    return endpoints;
  }
}

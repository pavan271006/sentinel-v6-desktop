/**
 * Sentinel Sovereign Smart Mutation Frontier & Unkeyed Attack Surface Generator
 *
 * Expands discovered endpoints into a comprehensive mutation matrix by:
 * 1. API Version Flips (/api/v2/... -> /api/v1/..., /api/v3/...)
 * 2. Unkeyed & Hidden Administrative Parameters (debug=true, role=admin, format=json)
 * 3. File Extension & Backup Probes (.bak, .old, .orig, .swp, .env, .json)
 * 4. Hidden Administrative & Debug Route Variants (/metrics, /health, /actuator, /swagger.json)
 */

import { DiscoveredEndpoint, TargetSiteCrawler } from '../crawler/TargetSiteCrawler';

export class SmartMutationFrontier {
  private static HIDDEN_DEBUG_PARAMS = [
    { name: 'debug', sampleValue: 'true' },
    { name: 'test', sampleValue: '1' },
    { name: 'admin', sampleValue: 'true' },
    { name: 'preview', sampleValue: '1' },
    { name: 'format', sampleValue: 'json' },
    { name: 'raw', sampleValue: '1' },
    { name: 'role', sampleValue: 'admin' },
  ];

  private static CRITICAL_SECURITY_PATHS = [
    '/.env',
    '/.git/config',
    '/swagger.json',
    '/api-docs',
    '/openapi.json',
    '/actuator/health',
    '/actuator/env',
    '/metrics',
    '/debug/vars',
    '/phpinfo.php',
    '/server-status',
  ];

  /**
   * Generates intelligent frontier mutations based on the known attack surface.
   */
  public static generateFrontierMutations(
    origin: string,
    host: string,
    existingEndpoints: DiscoveredEndpoint[],
    maxMutations: number = 30
  ): DiscoveredEndpoint[] {
    const mutations: DiscoveredEndpoint[] = [];
    const knownPaths = new Set(existingEndpoints.map((e) => e.path));

    const addMutation = (path: string, reason: string) => {
      if (mutations.length >= maxMutations) return;
      if (!knownPaths.has(path)) {
        knownPaths.add(path);
        const ep = this.createMutatedEndpoint(origin, host, path, reason);
        mutations.push(ep);
      }
    };

    // 1. Critical configuration, swagger, and environment leaks
    for (const secPath of this.CRITICAL_SECURITY_PATHS) {
      addMutation(secPath, 'High-priority server metadata and API schema probe');
    }

    // 2. API Version Flips
    for (const ep of existingEndpoints) {
      if (mutations.length >= maxMutations) break;

      const vMatch = ep.path.match(/\/v([1-9])\//i);
      if (vMatch) {
        const currentVersion = parseInt(vMatch[1], 10);
        // Probe previous or next versions (e.g. v1 or v2 if current is v3)
        for (const targetVer of [1, 2, 3]) {
          if (targetVer !== currentVersion) {
            const mutatedPath = ep.path.replace(/\/v[1-9]\//i, `/v${targetVer}/`);
            addMutation(mutatedPath, `API version flip mutation (v${currentVersion} -> v${targetVer})`);
          }
        }
      }
    }

    // 3. Unkeyed Parameter Injection on high-value parameterized endpoints
    for (const ep of existingEndpoints) {
      if (mutations.length >= maxMutations) break;
      if (ep.sqliScore >= 40 && ep.method === 'GET') {
        for (const param of this.HIDDEN_DEBUG_PARAMS.slice(0, 2)) {
          const sep = ep.path.includes('?') ? '&' : '?';
          const mutatedPath = `${ep.path}${sep}${param.name}=${param.sampleValue}`;
          addMutation(mutatedPath, `Unkeyed debug parameter injection "${param.name}"`);
        }
      }
    }

    return mutations;
  }

  /**
   * Helper to construct DiscoveredEndpoint for mutations.
   */
  private static createMutatedEndpoint(
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
      id: `ep_mutation_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      host,
      url: `${origin}${path}`,
      path,
      method: 'GET',
      headers,
      source: 'heuristic_probe',
      params,
      sqliScore: scoring.sqliScore,
      isSqliCandidate: scoring.isSqliCandidate,
      sqliReason: `${reason}; ${scoring.sqliReason}`,
      rawRequest: rawReq,
      timestamp: Date.now(),
      workflowType: TargetSiteCrawler.classifyWorkflowType('GET', path),
      clusterSignature: TargetSiteCrawler.getClusterSignature(pathname, search),
    };
  }
}

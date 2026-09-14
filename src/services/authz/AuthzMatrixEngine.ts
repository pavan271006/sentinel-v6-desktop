/**
 * Sentinel V6 - IRA+ Multi-Principal Authorization Matrix Engine
 *
 * Implements automated cross-principal replay & differential analysis
 * for detecting BOLA (Broken Object Level Authorization), IDOR (Insecure
 * Direct Object Reference), BFLA (Broken Function Level Authorization),
 * and Unauthenticated Information Leaks across Admin, Tenant A, Tenant B, and Guest.
 */

import { ipcClient } from '../../ipc/client';
import { TrafficSummary, TransactionDetails } from '../../types/traffic';
import { TransactionModel } from '../../types/models';

export type AuthAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN';
export type ViolationType = 'BOLA' | 'IDOR' | 'BFLA' | 'UNAUTH_LEAK' | null;

export interface PrincipalConfig {
  id: 'admin' | 'tenantA' | 'tenantB' | 'guest';
  name: string;
  authHeaderName: string;
  authHeaderValue: string;
  cookies?: string;
}

export interface MatrixEndpoint {
  id: string;
  endpoint: string;
  method: string;
  action: AuthAction;
  resourceId: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  adminAllowed: boolean;
  userAllowed: boolean;
  tenantBAllowed: boolean;
  guestAllowed: boolean;
}

export interface PrincipalResult {
  statusCode: number;
  length: number;
  durationMs: number;
  isAccessAllowed: boolean;
  bodySnippet: string;
}

export interface EvaluatedMatrixRow extends MatrixEndpoint {
  adminActual: PrincipalResult;
  userActual: PrincipalResult;
  tenantBActual: PrincipalResult;
  guestActual: PrincipalResult;
  violationType: ViolationType;
  violationSummary?: string;
}

export const DEFAULT_PRINCIPALS: PrincipalConfig[] = [
  {
    id: 'admin',
    name: 'Admin (Superuser)',
    authHeaderName: 'Authorization',
    authHeaderValue: 'Bearer admin_token_sec9021',
  },
  {
    id: 'tenantA',
    name: 'Alice (Tenant A - Owner)',
    authHeaderName: 'Authorization',
    authHeaderValue: 'Bearer alice_token_tenant_a',
  },
  {
    id: 'tenantB',
    name: 'Bob (Tenant B - Attacker)',
    authHeaderName: 'Authorization',
    authHeaderValue: 'Bearer bob_token_tenant_b',
  },
  {
    id: 'guest',
    name: 'Guest (Unauthenticated)',
    authHeaderName: '',
    authHeaderValue: '',
  },
];

export class AuthzMatrixEngine {
  private principals: PrincipalConfig[];

  constructor(principals: PrincipalConfig[] = DEFAULT_PRINCIPALS) {
    this.principals = principals;
  }

  /**
   * Evaluates a single endpoint across all principals.
   */
  public async evaluateEndpoint(ep: MatrixEndpoint): Promise<EvaluatedMatrixRow> {
    const adminP = this.principals.find((p) => p.id === 'admin') || DEFAULT_PRINCIPALS[0];
    const userP = this.principals.find((p) => p.id === 'tenantA') || DEFAULT_PRINCIPALS[1];
    const tenantBP = this.principals.find((p) => p.id === 'tenantB') || DEFAULT_PRINCIPALS[2];
    const guestP = this.principals.find((p) => p.id === 'guest') || DEFAULT_PRINCIPALS[3];

    const [adminRes, userRes, tenantBRes, guestRes] = await Promise.all([
      this.replayWithPrincipal(ep, adminP),
      this.replayWithPrincipal(ep, userP),
      this.replayWithPrincipal(ep, tenantBP),
      this.replayWithPrincipal(ep, guestP),
    ]);

    // Calculate body similarity between Alice (owner) and Bob (attacker)
    const userBobSimilarity = AuthzMatrixEngine.calculateJaccardSimilarity(userRes.bodySnippet, tenantBRes.bodySnippet);

    // Determine violations with high-precision differential heuristics
    let violationType: ViolationType = null;
    let violationSummary: string | undefined;

    // 1. Check Unauthenticated Leak
    if (!ep.guestAllowed && guestRes.isAccessAllowed) {
      violationType = 'UNAUTH_LEAK';
      violationSummary = `Unauthenticated guest accessed protected resource ${ep.resourceId} (HTTP ${guestRes.statusCode})`;
    }
    // 2. Check BOLA / Cross-Tenant IDOR
    else if (!ep.tenantBAllowed && tenantBRes.isAccessAllowed) {
      const isConfirmedDataLeak = userBobSimilarity > 0.6 || tenantBRes.bodySnippet.includes(ep.resourceId);
      violationType = ep.resourceId.includes('tenant') ? 'IDOR' : 'BOLA';
      violationSummary = isConfirmedDataLeak
        ? `Cross-tenant principal Bob received Alice's data for ${ep.resourceId} (HTTP ${tenantBRes.statusCode}, ${Math.round(userBobSimilarity * 100)}% similarity)`
        : `Cross-tenant access allowed for ${ep.resourceId} (HTTP ${tenantBRes.statusCode})`;
    }
    // 3. Check BFLA (Function level authorization)
    else if (!ep.userAllowed && userRes.isAccessAllowed) {
      violationType = 'BFLA';
      violationSummary = `Regular user Alice executed privileged function ${ep.endpoint} (HTTP ${userRes.statusCode})`;
    }

    return {
      ...ep,
      adminActual: adminRes,
      userActual: userRes,
      tenantBActual: tenantBRes,
      guestActual: guestRes,
      violationType,
      violationSummary,
    };
  }

  /**
   * Computes Jaccard word-level token similarity between two responses
   */
  public static calculateJaccardSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(textA.toLowerCase().split(/[\s,{}":;[\]]+/).filter((t) => t.length > 2));
    const tokensB = new Set(textB.toLowerCase().split(/[\s,{}":;[\]]+/).filter((t) => t.length > 2));
    if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Evaluates an entire matrix of endpoints in parallel.
   */
  public async evaluateMatrix(
    endpoints: MatrixEndpoint[],
    onProgress?: (done: number, total: number) => void
  ): Promise<EvaluatedMatrixRow[]> {
    const results: EvaluatedMatrixRow[] = [];
    let completed = 0;

    for (const ep of endpoints) {
      const evaluated = await this.evaluateEndpoint(ep);
      results.push(evaluated);
      completed++;
      onProgress?.(completed, endpoints.length);
    }

    return results;
  }

  /**
   * Replays the request with swapped identity credentials via Sentinel IPC client.
   */
  private async replayWithPrincipal(
    ep: MatrixEndpoint,
    principal: PrincipalConfig
  ): Promise<PrincipalResult> {
    const headers: Record<string, string> = {
      Host: this.getHost(ep.url),
      'User-Agent': `Sentinel-IRA+/6.0 (${principal.id})`,
      Accept: 'application/json, text/plain, */*',
      ...(ep.headers || {}),
    };

    // Strip previous auth headers
    delete headers['Authorization'];
    delete headers['authorization'];
    delete headers['Cookie'];
    delete headers['cookie'];

    // Inject principal credentials
    if (principal.authHeaderName && principal.authHeaderValue) {
      headers[principal.authHeaderName] = principal.authHeaderValue;
    }
    if (principal.cookies) {
      headers['Cookie'] = principal.cookies;
    }

    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const path = this.getPathWithQuery(ep.url);
    const bodyStr = ep.body || '';
    if (bodyStr && !headers['Content-Length']) {
      headers['Content-Length'] = String(new TextEncoder().encode(bodyStr).length);
    }

    const rawReq = `${ep.method} ${path} HTTP/1.1\r\n${headerLines}\r\n\r\n${bodyStr}`;

    const startTime = performance.now();
    try {
      const res = await ipcClient.sendRepeaterRequest({
        tabId: `authz_${principal.id}`,
        targetUrl: ep.url,
        rawRequest: rawReq,
      });

      const durationMs = Math.round(performance.now() - startTime);
      const statusCode = res.statusCode || 200;
      const body = res.body || '';
      const isAccessAllowed = this.checkIfAccessGranted(statusCode, body);

      return {
        statusCode,
        length: body.length,
        durationMs,
        isAccessAllowed,
        bodySnippet: body.slice(0, 160),
      };
    } catch {
      return {
        statusCode: 0,
        length: 0,
        durationMs: Math.round(performance.now() - startTime),
        isAccessAllowed: false,
        bodySnippet: 'Request failed or blocked by policy',
      };
    }
  }

  /**
   * Determines if the server treated the request as successfully authorized.
   */
  private checkIfAccessGranted(statusCode: number, body: string): boolean {
    // 401 Unauthorized, 403 Forbidden, or 404 Not Found (safe fail)
    if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
      return false;
    }

    // 2xx status codes indicate success, unless body contains explicit authorization failure
    if (statusCode >= 200 && statusCode < 300) {
      const lower = body.toLowerCase();
      if (
        lower.includes('access denied') ||
        lower.includes('unauthorized') ||
        lower.includes('forbidden') ||
        lower.includes('invalid credentials') ||
        lower.includes('permission required') ||
        lower.includes('login required')
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  // ─── Live Traffic Extractor ────────────────────────────────────────────────

  /**
   * Automatically parses HTTP proxy history transactions into an IRA+ test matrix.
   */
  public static extractEndpointsFromTraffic(
    transactions: (TrafficSummary | TransactionModel | TransactionDetails)[]
  ): MatrixEndpoint[] {
    const endpointsMap = new Map<string, MatrixEndpoint>();

    for (const tx of transactions) {
      const url = 'request' in tx && tx.request?.url ? tx.request.url : (tx as any).url || '';
      const method = ('request' in tx && tx.request?.method ? tx.request.method : (tx as any).method || 'GET').toUpperCase();
      if (!url) continue;

      // Filter static assets
      if (
        url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)$/i) ||
        url.includes('socket.io') ||
        url.includes('/ws')
      ) {
        continue;
      }

      // Group by method + path structure
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        const key = `${method} ${path}`;

        if (!endpointsMap.has(key)) {
          // Detect resource ID from path segments
          const segments = path.split('/').filter(Boolean);
          let resourceId = 'generic_endpoint';
          let action: AuthAction = 'READ';

          if (method === 'DELETE') action = 'DELETE';
          else if (method === 'POST' || method === 'PUT' || method === 'PATCH') action = 'WRITE';
          if (path.toLowerCase().includes('/admin')) action = 'ADMIN';

          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (/^[0-9]+$/.test(seg) || /^[0-9a-fA-F-]{16,}$/.test(seg)) {
              const parent = segments[i - 1] || 'item';
              resourceId = `${parent}_${seg}`;
              break;
            }
          }

          const isAdminEndpoint = action === 'ADMIN';

          endpointsMap.set(key, {
            id: `ep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            endpoint: key,
            method,
            action,
            resourceId,
            url,
            adminAllowed: true,
            userAllowed: !isAdminEndpoint,
            tenantBAllowed: false,
            guestAllowed: false,
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return Array.from(endpointsMap.values());
  }

  private getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'target.local';
    }
  }

  private getPathWithQuery(url: string): string {
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}`;
    } catch {
      return '/';
    }
  }
}

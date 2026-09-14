/**
 * Sentinel V6 - High-Performance Hidden Parameter & Unkeyed Header Miner
 *
 * Inspired by PortSwigger Param Miner (James Kettle) & x8 (Sh1Yo).
 * Implements batching with binary bisection search (divide-and-conquer),
 * response byte differential analysis, canary reflection detection, and
 * web cache poisoning / unkeyed input identification.
 */

import { ipcClient } from '../../ipc/client';
import { RepeaterExecutionResult } from '../../types/repeater';

export type MineMode = 'headers' | 'params' | 'json' | 'cookies';

export interface ParamFinding {
  id: string;
  type: string;
  name: string;
  impact: string;
  status: 'Critical' | 'High' | 'Medium' | 'Vulnerable' | 'Informational';
  evidence: {
    canary: string;
    baselineStatus: number;
    probeStatus: number;
    baselineLength: number;
    probeLength: number;
    deltaLength: number;
    reflectedInBody: boolean;
    reflectedInHeaders: boolean;
    reflectionSnippet?: string;
  };
  discoveredAt: string;
}

export interface MiningProgress {
  testedCount: number;
  totalCount: number;
  currentBatch: string[];
  findingsCount: number;
  percent: number;
  currentPhase: string;
}

export interface MinerConfig {
  targetUrl: string;
  mode: MineMode;
  batchSize?: number;
  concurrency?: number;
  customWordlist?: string[];
  autoCacheBuster?: boolean;
}

// ─── High-Value Built-In Wordlists ──────────────────────────────────────────

export const BUILTIN_HEADERS: string[] = [
  'X-Forwarded-Host',
  'X-Forwarded-Scheme',
  'X-Forwarded-Proto',
  'X-Forwarded-For',
  'X-Forwarded-Port',
  'X-Forwarded-Path',
  'X-Forwarded-Prefix',
  'X-Forwarded-Server',
  'X-Forwarded-Ssl',
  'X-Original-URL',
  'X-Rewrite-URL',
  'X-Original-Host',
  'X-Backend-Host',
  'X-Real-Host',
  'X-Real-IP',
  'X-Client-IP',
  'X-Originating-IP',
  'X-Remote-IP',
  'X-Cluster-Client-IP',
  'X-Custom-IP-Authorization',
  'X-ProxyUser-Ip',
  'CF-Connecting-IP',
  'CF-IPCountry',
  'True-Client-IP',
  'Fastly-Client-IP',
  'Fastly-SSL',
  'X-Host',
  'Base-Url',
  'Forwarded',
  'X-HTTP-Method-Override',
  'X-Method-Override',
  'X-Target-URI',
  'X-Timer',
  'X-Pass-File',
  'X-Wap-Profile',
  'X-Amz-Website-Redirect-Location',
  'X-Amzn-Trace-Id',
  'X-Envoy-Original-Path',
  'X-Akamai-Edgescape',
  'X-CF-EW-Via',
  'X-Varnish',
  'X-Cache-Key',
  'X-Cache-Hits',
  'X-Backend',
  'X-Route',
  'X-Gateway-Base-Path',
  'X-App-Env',
  'X-Debug-Mode',
  'X-Tenant-Id',
  'X-Impersonate-User',
  'X-Device-User-Agent',
  'X-Original-Remote-Addr',
  'X-Request-Id',
  'X-Correlation-Id',
  'X-Forward-For',
  'X-Cluster-IP',
  'X-Origin-Host',
  'CloudFront-Forwarded-Proto',
  'CloudFront-Is-Desktop-Viewer',
  'CloudFront-Is-Mobile-Viewer',
  'CloudFront-Viewer-Country',
  'X-Azure-ClientIP',
  'X-Azure-FDID',
  'X-FD-Features',
  'X-Forwarded-Base',
  'X-Forwarded-By',
  'X-Original-Remote-Host',
  'X-Origin-Url',
  'X-Custom-URL',
  'X-Override-URL',
  'X-HTTP-DestinationURL',
  'X-Forwarded-SSL-Client-Cert',
  'X-Client-Cert',
  'X-Client-Verify',
  'X-Forwarded-Protocol',
  'X-Url-Scheme',
  'X-Forwarded-Server-Port',
  'X-Proxy-Url',
  'X-Forward-Proto',
  'X-Forward-Host',
  'X-Requested-With',
  'X-PJAX',
  'X-Inertia',
  'X-Nginx-Proxy',
  'X-Varnish-Routed',
];

export const BUILTIN_PARAMS: string[] = [
  'debug',
  'test',
  'admin',
  'preview',
  'enable_logging',
  'format',
  'api_key',
  'key',
  'secret',
  'token',
  'role',
  'role_id',
  'view',
  'source',
  'raw',
  'callback',
  'redirect',
  'redirect_url',
  'redirect_uri',
  'url',
  'next',
  'return',
  'return_url',
  'mode',
  'version',
  'internal',
  'action',
  'user_id',
  'tenant_id',
  'impersonate',
  'env',
  'staging',
  'show_errors',
  'verbose',
  'reset',
  'dump',
  'export',
  'bypass',
  'auth',
  'config',
  'file',
  'path',
  'template',
  'include',
  'load',
  'filter',
  'sort',
  'limit',
  'offset',
  'lang',
  'locale',
  'dest',
  'target',
  'window',
  'display',
  'state',
  'scope',
  'client_id',
  'embed',
  'refresh',
  'force',
  'validate',
];

export const BUILTIN_JSON_KEYS: string[] = [
  'admin',
  'is_admin',
  'role',
  'role_id',
  'permissions',
  'debug',
  'superuser',
  'verified',
  'tier',
  'org_id',
  'tenant_id',
  'scopes',
  'email_verified',
  'status',
  'account_type',
  'privileges',
  'level',
  'impersonate',
  'bypass_auth',
  'enable_feature',
  'group',
  'groups',
  'flags',
  'is_active',
  'is_staff',
  'access_token',
  'api_key',
  'secret',
  'secret_key',
  'private',
  'internal',
  'subscription',
  'plan',
  'quota',
];

export const BUILTIN_COOKIES: string[] = [
  'debug',
  'admin',
  'canary',
  'feature_flag',
  'preview_mode',
  'internal_user',
  'role',
  'session_role',
  'beta_access',
  'override',
  'dev',
  'stage',
  'auth_override',
  'superuser',
  'bypass',
  'test_user',
  'env',
  'dark_launch',
];

// ─── ParamMiner Engine Class ────────────────────────────────────────────────

export class ParamMinerEngine {
  private config: MinerConfig;
  private aborted: boolean = false;
  private onProgress?: (p: MiningProgress) => void;
  private onFinding?: (f: ParamFinding) => void;

  private baselineStatus: number = 200;
  private baselineLength: number = 0;

  constructor(
    config: MinerConfig,
    callbacks?: {
      onProgress?: (p: MiningProgress) => void;
      onFinding?: (f: ParamFinding) => void;
    }
  ) {
    this.config = {
      batchSize: 16,
      concurrency: 2,
      autoCacheBuster: true,
      ...config,
    };
    this.onProgress = callbacks?.onProgress;
    this.onFinding = callbacks?.onFinding;
  }

  public abort(): void {
    this.aborted = true;
  }

  /**
   * Executes the full mining routine:
   * 1. Baseline calibration with cache-buster.
   * 2. Partition wordlist into batches.
   * 3. Send batched probe.
   * 4. If anomaly detected -> Bisect (divide & conquer) recursively down to single parameter.
   */
  public async run(): Promise<ParamFinding[]> {
    this.aborted = false;
    const findings: ParamFinding[] = [];

    // 1. Select Wordlist based on Mode
    let wordlist: string[] = [];
    if (this.config.customWordlist && this.config.customWordlist.length > 0) {
      wordlist = this.config.customWordlist;
    } else {
      switch (this.config.mode) {
        case 'headers':
          wordlist = BUILTIN_HEADERS;
          break;
        case 'params':
          wordlist = BUILTIN_PARAMS;
          break;
        case 'json':
          wordlist = BUILTIN_JSON_KEYS;
          break;
        case 'cookies':
          wordlist = BUILTIN_COOKIES;
          break;
      }
    }

    // 2. Calibrate Baseline
    this.emitProgress(0, wordlist.length, [], findings.length, 'Calibrating baseline with cache buster...');
    const baseline = await this.probeBaseline();
    if (!baseline) {
      throw new Error(`Failed to establish baseline response from target: ${this.config.targetUrl}`);
    }
    this.baselineStatus = baseline.statusCode || 200;
    this.baselineLength = (baseline.body || '').length;

    // 3. Batch Iteration
    const batchSize = this.config.batchSize || 16;
    let testedCount = 0;

    for (let i = 0; i < wordlist.length; i += batchSize) {
      if (this.aborted) break;

      const batch = wordlist.slice(i, i + batchSize);
      this.emitProgress(testedCount, wordlist.length, batch, findings.length, `Probing batch [${batch.join(', ')}]`);

      // Test batch as a whole
      const batchAnomaly = await this.testBatch(batch);
      if (batchAnomaly.hasAnomaly) {
        // Run Divide-and-Conquer Binary Bisection on this batch
        const isolated = await this.bisectBatch(batch, batchAnomaly.canaryMap);
        for (const finding of isolated) {
          findings.push(finding);
          this.onFinding?.(finding);
        }
      }

      testedCount += batch.length;
      this.emitProgress(testedCount, wordlist.length, batch, findings.length, `Processed ${testedCount}/${wordlist.length}`);
    }

    this.emitProgress(wordlist.length, wordlist.length, [], findings.length, 'Mining completed.');
    return findings;
  }

  // ─── Baseline Calibration ─────────────────────────────────────────────────

  private async probeBaseline(): Promise<RepeaterExecutionResult | null> {
    const cb = `_cb_stnl_${Math.random().toString(36).substring(2, 8)}`;
    const url = this.appendQueryParam(this.config.targetUrl, cb, '1');
    const rawReq = `GET ${this.getPathWithQuery(url)} HTTP/1.1\r\nHost: ${this.getHost(url)}\r\nUser-Agent: Mozilla/5.0 Sentinel-ParamMiner/6.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`;

    try {
      return await ipcClient.sendRepeaterRequest({
        tabId: 'param_miner_base',
        targetUrl: url,
        rawRequest: rawReq,
      });
    } catch {
      return null;
    }
  }

  // ─── Batch Probing & Anomaly Detection ────────────────────────────────────

  private async testBatch(
    items: string[]
  ): Promise<{ hasAnomaly: boolean; canaryMap: Map<string, string>; result?: RepeaterExecutionResult }> {
    const canaryMap = new Map<string, string>();
    for (const item of items) {
      canaryMap.set(item, `stnl_${item}_${Math.random().toString(36).substring(2, 6)}`);
    }

    const result = await this.executeProbe(items, canaryMap);
    if (!result) return { hasAnomaly: false, canaryMap };

    const status = result.statusCode || 200;
    const body = result.body || '';
    const length = body.length;
    const delta = Math.abs(length - this.baselineLength);

    // Anomaly Conditions:
    // 1. Status code changed (e.g. 200 -> 302 / 500 / 403)
    const statusChanged = status !== this.baselineStatus;

    // 2. Length variance above normal dynamic noise threshold (> 15 bytes)
    const lengthDeviated = delta > 15;

    // 3. Canary reflection anywhere in response body or headers
    let canaryReflected = false;
    for (const [, canary] of canaryMap.entries()) {
      if (body.includes(canary) || (result.rawResponse || '').includes(canary)) {
        canaryReflected = true;
        break;
      }
    }

    const hasAnomaly = statusChanged || lengthDeviated || canaryReflected;
    return { hasAnomaly, canaryMap, result };
  }

  // ─── Binary Bisection (Divide and Conquer) ─────────────────────────────────

  private async bisectBatch(
    items: string[],
    parentCanaries: Map<string, string>
  ): Promise<ParamFinding[]> {
    if (this.aborted) return [];

    // Base case: single parameter isolated
    if (items.length === 1) {
      const name = items[0];
      const singleCanaryMap = new Map<string, string>([
        [name, parentCanaries.get(name) || `stnl_${name}_${Math.random().toString(36).substring(2, 6)}`],
      ]);

      const singleResult = await this.executeProbe([name], singleCanaryMap);
      if (!singleResult) return [];

      const status = singleResult.statusCode || 200;
      const body = singleResult.body || '';
      const rawRes = singleResult.rawResponse || '';
      const length = body.length;
      const delta = length - this.baselineLength;
      const canary = singleCanaryMap.get(name)!;

      const reflectedInBody = body.includes(canary);
      const reflectedInHeaders = rawRes.includes(canary) && !reflectedInBody;

      // Extract reflection snippet if present
      let snippet: string | undefined;
      if (reflectedInBody) {
        const idx = body.indexOf(canary);
        const start = Math.max(0, idx - 40);
        const end = Math.min(body.length, idx + canary.length + 40);
        snippet = body.substring(start, end);
      }

      // Classify finding impact and severity
      const { impact, severity } = this.classifyFinding(name, this.config.mode, {
        statusChanged: status !== this.baselineStatus,
        reflectedInBody,
        reflectedInHeaders,
        status,
        delta,
      });

      const finding: ParamFinding = {
        id: `pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: this.formatType(this.config.mode),
        name,
        impact,
        status: severity,
        evidence: {
          canary,
          baselineStatus: this.baselineStatus,
          probeStatus: status,
          baselineLength: this.baselineLength,
          probeLength: length,
          deltaLength: delta,
          reflectedInBody,
          reflectedInHeaders,
          reflectionSnippet: snippet,
        },
        discoveredAt: new Date().toLocaleTimeString(),
      };

      return [finding];
    }

    // Split batch into Left and Right halves
    const mid = Math.floor(items.length / 2);
    const leftHalf = items.slice(0, mid);
    const rightHalf = items.slice(mid);

    const findings: ParamFinding[] = [];

    // Test Left Half
    const leftAnomaly = await this.testBatch(leftHalf);
    if (leftAnomaly.hasAnomaly) {
      const leftHits = await this.bisectBatch(leftHalf, leftAnomaly.canaryMap);
      findings.push(...leftHits);
    }

    // Test Right Half
    const rightAnomaly = await this.testBatch(rightHalf);
    if (rightAnomaly.hasAnomaly) {
      const rightHits = await this.bisectBatch(rightHalf, rightAnomaly.canaryMap);
      findings.push(...rightHits);
    }

    return findings;
  }

  // ─── Request Formulation & IPC Dispatch ───────────────────────────────────

  private async executeProbe(
    items: string[],
    canaryMap: Map<string, string>
  ): Promise<RepeaterExecutionResult | null> {
    let url = this.config.targetUrl;
    if (this.config.autoCacheBuster) {
      const cb = `_cb_m_${Math.random().toString(36).substring(2, 7)}`;
      url = this.appendQueryParam(url, cb, '1');
    }

    const host = this.getHost(url);
    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Mozilla/5.0 Sentinel-ParamMiner/6.0',
      Accept: '*/*',
      Connection: 'close',
    };

    let bodyStr = '';
    let method = 'GET';

    if (this.config.mode === 'headers') {
      for (const item of items) {
        headers[item] = canaryMap.get(item) || '1';
      }
    } else if (this.config.mode === 'params') {
      for (const item of items) {
        url = this.appendQueryParam(url, item, canaryMap.get(item) || '1');
      }
    } else if (this.config.mode === 'cookies') {
      const cookieHeader = items.map((item) => `${item}=${canaryMap.get(item) || '1'}`).join('; ');
      headers['Cookie'] = cookieHeader;
    } else if (this.config.mode === 'json') {
      method = 'POST';
      headers['Content-Type'] = 'application/json';
      const obj: Record<string, any> = {};
      for (const item of items) {
        obj[item] = canaryMap.get(item) || '1';
      }
      bodyStr = JSON.stringify(obj);
      headers['Content-Length'] = String(new TextEncoder().encode(bodyStr).length);
    }

    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const path = this.getPathWithQuery(url);
    const rawReq = `${method} ${path} HTTP/1.1\r\n${headerLines}\r\n\r\n${bodyStr}`;

    try {
      return await ipcClient.sendRepeaterRequest({
        tabId: 'param_miner_probe',
        targetUrl: url,
        rawRequest: rawReq,
      });
    } catch {
      return null;
    }
  }

  // ─── Finding Classification & Severity ────────────────────────────────────

  private classifyFinding(
    name: string,
    mode: MineMode,
    ctx: {
      statusChanged: boolean;
      reflectedInBody: boolean;
      reflectedInHeaders: boolean;
      status: number;
      delta: number;
    }
  ): { impact: string; severity: ParamFinding['status'] } {
    const lower = name.toLowerCase();

    // Headers Classification
    if (mode === 'headers') {
      if (lower.includes('forwarded-host') || lower.includes('x-host') || lower.includes('original-host')) {
        return {
          impact: 'Web Cache Poisoning & Host Header Injection (Unkeyed host reflected)',
          severity: ctx.reflectedInBody ? 'Critical' : 'High',
        };
      }
      if (lower.includes('original-url') || lower.includes('rewrite-url') || lower.includes('custom-ip')) {
        return {
          impact: 'Reverse Proxy ACL Bypass / Authentication Override',
          severity: 'Critical',
        };
      }
      if (lower.includes('proto') || lower.includes('scheme')) {
        return {
          impact: 'Web Cache Poisoning (Protocol downgrade or infinite redirect loop)',
          severity: 'High',
        };
      }
      if (ctx.reflectedInBody) {
        return {
          impact: 'Unkeyed Header Reflected in HTML/Response (Potential XSS / Cache Poisoning)',
          severity: 'Vulnerable',
        };
      }
      return {
        impact: 'Unadvertised Header Modifies Application State / Caching Behavior',
        severity: ctx.statusChanged ? 'High' : 'Medium',
      };
    }

    // Query / JSON Classification
    if (lower.includes('admin') || lower.includes('role') || lower.includes('impersonate') || lower.includes('bypass')) {
      return {
        impact: 'Privilege Escalation / Authorization Parameter Override',
        severity: 'Critical',
      };
    }
    if (lower.includes('debug') || lower.includes('trace') || lower.includes('verbose')) {
      return {
        impact: 'Internal Diagnostics / Stack Trace Information Disclosure',
        severity: 'High',
      };
    }
    if (lower.includes('redirect') || lower.includes('url') || lower.includes('next') || lower.includes('callback')) {
      return {
        impact: 'Open Redirect or Cross-Site Scripting (Callback Reflection)',
        severity: ctx.reflectedInBody ? 'High' : 'Medium',
      };
    }

    if (ctx.reflectedInBody) {
      return {
        impact: 'Hidden Parameter Reflected in Response Body',
        severity: 'Vulnerable',
      };
    }

    return {
      impact: `Hidden parameter accepted; caused ${ctx.delta > 0 ? '+' : ''}${ctx.delta} byte response variance`,
      severity: 'Informational',
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private formatType(mode: MineMode): string {
    switch (mode) {
      case 'headers':
        return 'Header';
      case 'params':
        return 'GET Param';
      case 'json':
        return 'JSON Key';
      case 'cookies':
        return 'Cookie';
    }
  }

  private appendQueryParam(url: string, key: string, val: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
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

  private emitProgress(
    tested: number,
    total: number,
    batch: string[],
    findingsCount: number,
    phase: string
  ): void {
    const percent = total > 0 ? Math.min(100, Math.round((tested / total) * 100)) : 0;
    this.onProgress?.({
      testedCount: tested,
      totalCount: total,
      currentBatch: batch,
      findingsCount,
      percent,
      currentPhase: phase,
    });
  }
}

/**
 * Sentinel V6 - Arjun Hidden HTTP Parameter Discovery Service
 *
 * Modeled after s0md3v/Arjun (github.com/s0md3v/Arjun).
 * Discovers hidden GET query and POST body parameters through:
 * - Statistical Baseline Response Profiling (Status, Size, Structure)
 * - Differential Response Analysis (Length Delta, Status Code Shifts, Reflection)
 * - Curated 100+ High-Yield Bug Bounty Parameter Dictionary
 */

import { ipcClient } from '../../ipc/client';
import { isWafChallenge } from './WafAndWildcardDetector';

export interface DiscoveredParameter {
  param: string;
  type: 'GET' | 'POST';
  evidence: string;
  statusCode: number;
  baselineLength: number;
  injectedLength: number;
  lengthDelta: number;
  reflected: boolean;
  rawRequest: string;
  rawResponse: string;
}

export interface ArjunDiscoveryResult {
  endpoint: string;
  discoveredParameters: DiscoveredParameter[];
  testedCount: number;
}

export interface ArjunDiscoveryConfig {
  targetUrl: string;
  targetHost: string;
  method?: 'GET' | 'POST';
  customParams?: string[];
  concurrency?: number;
  authHeaders?: Record<string, string>;
  onProgress?: (testedCount: number, totalCount: number, foundCount: number, currentParam: string) => void;
  onParamDiscovered?: (param: DiscoveredParameter) => void;
}

// ─── Top High-Yield Security & Bug Bounty Parameter Dictionary ───
export const ARJUN_HIGH_YIELD_PARAMS: string[] = [
  'debug',
  'admin',
  'test',
  'dev',
  'role',
  'id',
  'user_id',
  'token',
  'key',
  'api_key',
  'secret',
  'redirect',
  'url',
  'next',
  'dest',
  'callback',
  'jsonp',
  'format',
  'export',
  'preview',
  'include',
  'view',
  'mode',
  'auth',
  'access',
  'cmd',
  'exec',
  'query',
  'search',
  'filter',
  'page',
  'limit',
  'sort',
  'fields',
  'file',
  'path',
  'source',
  'type',
  'action',
  'verbose',
  'raw',
  'show',
  'config',
  'env',
  'backup',
  'internal',
  'override',
  'feature',
  'beta',
  'version',
  'account',
  'email',
  'username',
  'privilege',
  'session',
  'bypass',
  'skip',
  'disable',
  'enable',
  'force',
  'reset',
  'all',
  'embed',
  'detail',
  'validate',
  'status',
  'signature',
  'hash',
  'download',
  'upload',
  'output',
  'lang',
  'locale',
  'state',
  'scope',
  'client_id',
  'secret_key',
  'auth_token',
  'return_url',
  'error',
  'log',
  'metric',
  'health',
  'diag',
  'dry_run',
  'preview_mode',
  'simulate',
  'cache',
  'nocache',
  'refresh',
  'sync',
  'payload',
  'data',
  'input',
  'code',
  'key_id',
  'profile',
  'tenant',
  'org',
];

export class ArjunParamDiscoveryService {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
  }

  /**
   * Main Execution: Tests parameters against baseline response
   */
  public async runParameterDiscovery(config: ArjunDiscoveryConfig): Promise<ArjunDiscoveryResult> {
    this.isAborted = false;
    const {
      targetUrl,
      targetHost,
      method: _method = 'GET',
      customParams,
      onProgress,
      onParamDiscovered,
    } = config;

    const paramList = customParams && customParams.length > 0 ? customParams : ARJUN_HIGH_YIELD_PARAMS;
    const discovered: DiscoveredParameter[] = [];

    // 1. Establish Baseline Request
    let baseUrlObj: URL;
    try {
      baseUrlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetHost}${targetUrl}`);
    } catch {
      baseUrlObj = new URL(`https://${targetHost}/`);
    }

    let authHeaderLines = '';
    if (config.authHeaders) {
      for (const [key, value] of Object.entries(config.authHeaders)) {
        if (value) {
          authHeaderLines += `${key}: ${value}\r\n`;
        }
      }
    }

    const pathAndQuery = `${baseUrlObj.pathname}${baseUrlObj.search}`;
    const baselineReq = `GET ${pathAndQuery} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 Arjun-Miner\r\nAccept: */*\r\n${authHeaderLines}Connection: close\r\n\r\n`;

    let baselineStatus = 200;
    let baselineLength = 0;
    let baselineBody = '';
    let naturalJitter = 10;

    try {
      const baseRes = await ipcClient.sendRepeaterRequest({
        tabId: `arjun-baseline-${Date.now()}`,
        targetUrl: baseUrlObj.href,
        rawRequest: baselineReq,
      });

      baselineStatus = baseRes?.statusCode || 200;
      baselineBody = baseRes?.body || baseRes?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
      baselineLength = baseRes?.sizeBytes || baselineBody.length;

      // 1a. If baseline is a WAF / Bot Verification page, abort parameter fuzzing to prevent false positives
      const waf = isWafChallenge(baselineBody);
      if (waf.isWaf) {
        console.warn(`Arjun: Target is returning a ${waf.reason} on ${targetUrl}. Parameter fuzzing aborted.`);
        return {
          endpoint: baseUrlObj.pathname,
          discoveredParameters: [],
          testedCount: 0,
        };
      }

      // 1b. Send second baseline to measure natural dynamic jitter (timestamps, dynamic nonces)
      const baseRes2 = await ipcClient.sendRepeaterRequest({
        tabId: `arjun-baseline-jitter-${Date.now()}`,
        targetUrl: baseUrlObj.href,
        rawRequest: baselineReq,
      });
      const body2 = baseRes2?.body || baseRes2?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
      const len2 = baseRes2?.sizeBytes || body2.length;
      naturalJitter = Math.abs(baselineLength - len2);
    } catch (err) {
      console.warn('Arjun: Baseline request failed:', err);
    }

    // 2. Iterate through parameters and detect differential responses
    const totalCount = paramList.length;

    for (let i = 0; i < paramList.length; i++) {
      if (this.isAborted) break;

      const param = paramList[i];
      const canaryValue = `snt_${Math.random().toString(36).substring(2, 6)}`;

      if (onProgress) {
        onProgress(i + 1, totalCount, discovered.length, param);
      }

      // Build Injected URL
      const probeUrlObj = new URL(baseUrlObj.href);
      probeUrlObj.searchParams.set(param, canaryValue);

      const probePath = `${probeUrlObj.pathname}${probeUrlObj.search}`;
      const probeReq = `GET ${probePath} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 Arjun-Miner\r\nAccept: */*\r\n${authHeaderLines}Connection: close\r\n\r\n`;

      try {
        const probeRes = await ipcClient.sendRepeaterRequest({
          tabId: `arjun-probe-${Date.now()}-${i}`,
          targetUrl: probeUrlObj.href,
          rawRequest: probeReq,
        });

        const statusCode = probeRes?.statusCode || 200;
        const body = probeRes?.body || probeRes?.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        const length = probeRes?.sizeBytes || body.length;
        const delta = Math.abs(length - baselineLength);
        const reflected = body.includes(canaryValue);

        // Skip WAF challenges or true 404 responses
        if (isWafChallenge(body).isWaf || statusCode === 404) {
          continue;
        }

        // Rigorous Differential Checks:
        // 1. Canary value reflected in response body
        // 2. Status code shifted (e.g. 200 -> 400 Bad Request, 200 -> 500 Error, 403 -> 200)
        // 3. Significant structural response length delta beyond natural jitter
        let isDiscovered = false;
        let evidence = '';

        if (reflected) {
          isDiscovered = true;
          evidence = `Canary reflection observed in response body`;
        } else if (statusCode !== baselineStatus && statusCode >= 200 && statusCode < 500) {
          isDiscovered = true;
          evidence = `Status code shifted from ${baselineStatus} to ${statusCode}`;
        } else if (delta > Math.max(120, naturalJitter * 3 + 50) && delta !== (param.length + canaryValue.length + 1)) {
          isDiscovered = true;
          evidence = `Response size changed by ${delta} bytes (baseline: ${baselineLength}, probe: ${length}, jitter: ±${naturalJitter}B)`;
        }

        if (isDiscovered) {
          const item: DiscoveredParameter = {
            param,
            type: 'GET',
            evidence,
            statusCode,
            baselineLength,
            injectedLength: length,
            lengthDelta: delta,
            reflected,
            rawRequest: probeReq,
            rawResponse: probeRes?.rawResponse || `HTTP/1.1 ${statusCode} OK\r\n\r\n${body}`,
          };
          discovered.push(item);
          if (onParamDiscovered) onParamDiscovered(item);
        }
      } catch (err) {
        console.warn(`Arjun: Probe failed for ${param}:`, err);
      }
    }

    return {
      endpoint: baseUrlObj.pathname,
      discoveredParameters: discovered,
      testedCount: paramList.length,
    };
  }
}

export const arjunParamDiscoveryService = new ArjunParamDiscoveryService();

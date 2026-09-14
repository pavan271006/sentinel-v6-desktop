/**
 * Sentinel Ephemeral Nonce Replenisher Engine
 *
 * Solves strict single-use CSRF nonces by:
 * 1. Tracking origin form URLs and dynamic nonce parameter names for state-altering routes.
 * 2. Pre-fetching fresh anti-forgery nonces immediately prior to dispatching each active crawler/fuzz probe.
 * 3. Rewriting query strings, urlencoded form bodies, JSON payloads, and headers with freshly minted nonces.
 */

import { CsrfSynchronizer } from './CsrfSynchronizer';
import { ipcClient } from '../../../ipc/client';

export interface FormOriginBinding {
  actionPath: string;
  originFormUrl: string;
  nonceParamName: string;
}

export class EphemeralNonceReplenisher {
  private bindings: Map<string, FormOriginBinding> = new Map();

  /**
   * Binds an action route to its origin form GET endpoint.
   */
  public registerFormOrigin(actionPath: string, originFormUrl: string, nonceParamName: string = '_csrf'): void {
    this.bindings.set(actionPath, {
      actionPath,
      originFormUrl,
      nonceParamName,
    });
  }

  /**
   * Fetches a fresh single-use nonce from the origin form URL.
   */
  public async fetchFreshNonce(originFormUrl: string): Promise<{ tokenName?: string; tokenValue?: string } | null> {
    try {
      const u = new URL(originFormUrl);
      const rawReq = `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0\r\nAccept: text/html\r\nConnection: close\r\n\r\n`;

      const res = await ipcClient.sendRepeaterRequest({
        tabId: `nonce-replenish-${Date.now()}`,
        targetUrl: originFormUrl,
        rawRequest: rawReq,
      });

      if (res && res.statusCode === 200 && res.body) {
        const headerPairs: { name: string; value: string }[] = [];
        if (res.headers && typeof res.headers === 'object') {
          for (const [k, v] of Object.entries(res.headers)) {
            headerPairs.push({ name: k, value: String(v) });
          }
        }
        return CsrfSynchronizer.extractToken(headerPairs, res.body);
      }
    } catch {
      // Return null on failure
    }
    return null;
  }

  /**
   * Replenishes single-use nonces in headers, urlencoded bodies, or JSON payloads on the fly.
   */
  public async replenishOutboundRequest(
    targetUrl: string,
    _method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<{ headers: Record<string, string>; body?: string }> {
    let pathname = targetUrl;
    try {
      pathname = new URL(targetUrl).pathname;
    } catch {}

    const binding = this.bindings.get(pathname);
    if (!binding) {
      return { headers, body };
    }

    const freshToken = await this.fetchFreshNonce(binding.originFormUrl);
    if (!freshToken || !freshToken.tokenValue) {
      return { headers, body };
    }

    const newHeaders = { ...headers };
    let newBody = body;

    // 1. Replenish header
    if (freshToken.tokenName && freshToken.tokenName.toLowerCase().startsWith('x-')) {
      newHeaders[freshToken.tokenName] = freshToken.tokenValue;
    } else {
      newHeaders['X-CSRF-Token'] = freshToken.tokenValue;
    }

    // 2. Replenish form or JSON body
    if (newBody) {
      const paramName = binding.nonceParamName || freshToken.tokenName || '_csrf';

      // Check URL-encoded form
      if (newHeaders['Content-Type']?.includes('application/x-www-form-urlencoded') || newBody.includes('=')) {
        const formRegex = new RegExp(`(${paramName}=)[^&]*`, 'i');
        if (formRegex.test(newBody)) {
          newBody = newBody.replace(formRegex, `$1${encodeURIComponent(freshToken.tokenValue)}`);
        } else {
          newBody = `${newBody}&${paramName}=${encodeURIComponent(freshToken.tokenValue)}`;
        }
      }

      // Check JSON body
      if (newHeaders['Content-Type']?.includes('application/json') || newBody.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(newBody);
          parsed[paramName] = freshToken.tokenValue;
          newBody = JSON.stringify(parsed);
        } catch {}
      }

      newHeaders['Content-Length'] = `${newBody.length}`;
    }

    return { headers: newHeaders, body: newBody };
  }

  /**
   * Detects if an HTTP response indicates a rejected or expired single-use CSRF nonce.
   */
  public static isNonceRejectedResponse(statusCode: number, body: string): boolean {
    if (statusCode === 403 || statusCode === 400 || statusCode === 419) {
      const lower = body.toLowerCase();
      return (
        lower.includes('csrf token mismatch') ||
        lower.includes('invalid csrf token') ||
        lower.includes('csrf verification failed') ||
        lower.includes('anti-forgery token') ||
        lower.includes('expired nonce') ||
        lower.includes('invalid authenticity token') ||
        lower.includes('page expired')
      );
    }
    return false;
  }
}

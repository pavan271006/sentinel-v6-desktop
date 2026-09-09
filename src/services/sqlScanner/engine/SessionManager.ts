/**
 * Sentinel Autonomous SQL Engine — Autonomous Session & Cookie State Manager
 *
 * Tracks session cookies, detects authentication expiration (401/403/redirect to login),
 * and automatically synchronizes session state and rolling anti-CSRF tokens across worker threads.
 */

import { CsrfSynchronizer } from './CsrfSynchronizer';

export interface SessionState {
  cookies: Map<string, string>;
  authHeaders: Map<string, string>;
  csrfToken?: { name: string; value: string };
  isExpired: boolean;
  consecutiveAuthFailures: number;
  lastSuccessfulResponse: number;
}

export class SessionManager {
  private state: SessionState;

  constructor(initialHeaders: { name: string; value: string; enabled: boolean }[] = []) {
    const cookies = new Map<string, string>();
    const authHeaders = new Map<string, string>();

    for (const h of initialHeaders) {
      if (!h.enabled) continue;
      const lower = h.name.toLowerCase();

      if (lower === 'cookie') {
        h.value.split(';').forEach((pair) => {
          const eq = pair.indexOf('=');
          if (eq !== -1) {
            const k = pair.substring(0, eq).trim();
            const v = pair.substring(eq + 1).trim();
            if (k) cookies.set(k, v);
          }
        });
      } else if (
        lower === 'authorization' ||
        lower.startsWith('x-auth') ||
        lower.startsWith('x-api') ||
        lower === 'x-csrf-token' ||
        lower === 'x-xsrf-token'
      ) {
        authHeaders.set(h.name, h.value);
      }
    }

    this.state = {
      cookies,
      authHeaders,
      isExpired: false,
      consecutiveAuthFailures: 0,
      lastSuccessfulResponse: Date.now(),
    };
  }

  /**
   * Updates internal session state from incoming HTTP response headers and body.
   */
  public updateFromResponse(
    statusCode: number,
    headers: { name: string; value: string }[],
    body: string,
    redirectLocation?: string
  ): boolean {
    // 1. Detect Set-Cookie updates
    for (const h of headers) {
      if (h.name.toLowerCase() === 'set-cookie') {
        const parts = h.value.split(';')[0];
        const eq = parts.indexOf('=');
        if (eq !== -1) {
          const k = parts.substring(0, eq).trim();
          const v = parts.substring(eq + 1).trim();
          if (k) this.state.cookies.set(k, v);
        }
      }
    }

    // 2. Extract and sync CSRF tokens
    const csrf = CsrfSynchronizer.extractToken(headers, body);
    if (csrf && csrf.tokenValue) {
      this.state.csrfToken = { name: csrf.tokenName || 'X-CSRF-Token', value: csrf.tokenValue };
      if (csrf.tokenName && csrf.tokenName.toLowerCase().startsWith('x-')) {
        this.state.authHeaders.set(csrf.tokenName, csrf.tokenValue);
      }
    }

    // 3. Detect session expiration
    const isLoginRedirect =
      redirectLocation &&
      (redirectLocation.includes('/login') ||
        redirectLocation.includes('/signin') ||
        redirectLocation.includes('/auth'));

    const isUnauthorized =
      statusCode === 401 ||
      (statusCode === 403 && /session expired|unauthorized|log in|access denied/i.test(body)) ||
      (statusCode === 302 && isLoginRedirect);

    if (isUnauthorized) {
      this.state.consecutiveAuthFailures++;
      if (this.state.consecutiveAuthFailures >= 2) {
        this.state.isExpired = true;
      }
      return false;
    } else if (statusCode >= 200 && statusCode < 400) {
      this.state.consecutiveAuthFailures = 0;
      this.state.isExpired = false;
      this.state.lastSuccessfulResponse = Date.now();
      return true;
    }

    return true;
  }

  /**
   * Generates formatted Cookie header string from current session jar.
   */
  public getCookieHeader(): string {
    const pairs: string[] = [];
    this.state.cookies.forEach((val, key) => {
      pairs.push(`${key}=${val}`);
    });
    return pairs.join('; ');
  }

  /**
   * Applies the latest session cookies, auth headers, and CSRF tokens to an outgoing request headers array.
   */
  public applyToHeaders(
    headers: { name: string; value: string; enabled: boolean }[]
  ): { name: string; value: string; enabled: boolean }[] {
    const updated = [...headers];

    // 1. Apply Cookies
    const cookieString = this.getCookieHeader();
    if (cookieString) {
      const idx = updated.findIndex((h) => h.name.toLowerCase() === 'cookie');
      if (idx !== -1) {
        updated[idx] = { name: updated[idx].name, value: cookieString, enabled: true };
      } else {
        updated.push({ name: 'Cookie', value: cookieString, enabled: true });
      }
    }

    // 2. Apply Auth & CSRF Headers
    this.state.authHeaders.forEach((val, key) => {
      const idx = updated.findIndex((h) => h.name.toLowerCase() === key.toLowerCase());
      if (idx !== -1) {
        updated[idx] = { name: updated[idx].name, value: val, enabled: true };
      } else {
        updated.push({ name: key, value: val, enabled: true });
      }
    });

    return updated;
  }

  public isSessionExpired(): boolean {
    return this.state.isExpired;
  }

  public getSessionState(): SessionState {
    return this.state;
  }
}

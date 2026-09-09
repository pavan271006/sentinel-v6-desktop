/**
 * SOHE God Rail v3 — Session Manager
 *
 * Handles authenticated scanning: auto-login replay, CSRF token extraction,
 * cookie jar management, and session health monitoring.
 *
 * Without this, the scanner can't test any endpoint behind authentication
 * or any form that requires CSRF tokens.
 */

import type { GhostHttpRequest, GhostHttpResponse } from './GhostNetwork';

// ─── Types ─────────────────────────────────────────────────────────

export interface LoginConfig {
  loginUrl: string;
  loginMethod: string;
  loginBody: string;
  loginHeaders: Record<string, string>;
  successIndicator: string;  // String that appears in response when login succeeds
}

// ─── CSRF Token Patterns ───────────────────────────────────────────

const CSRF_INPUT_PATTERNS: RegExp[] = [
  /<input[^>]*name=["'](csrf[_-]?token|_token|csrfmiddlewaretoken|__RequestVerificationToken|authenticity_token|_csrf|XSRF-TOKEN|csrf|__token)["'][^>]*value=["']([^"']+)["']/gi,
];

const CSRF_META_PATTERNS: RegExp[] = [
  /<meta[^>]*name=["'](csrf-token|_csrf_token|csrf-param)["'][^>]*content=["']([^"']+)["']/gi,
];

const CSRF_HEADER_NAMES = [
  'x-csrf-token',
  'x-xsrf-token',
  'x-csrftoken',
  '__requestverificationtoken',
];

// ─── Main Class ────────────────────────────────────────────────────

export class SessionManager {
  private cookieJar: Map<string, string> = new Map();
  private csrfToken: string | null = null;
  private csrfFieldName: string | null = null;
  private csrfDelivery: 'form_field' | 'header' | 'cookie' = 'form_field';
  private loginConfig: LoginConfig | null = null;
  private sessionHealthy: boolean = true;
  private reauthAttempts: number = 0;
  private maxReauthAttempts: number = 3;

  /**
   * Configure auto-login replay.
   * When the session dies (302 to login), the manager replays this request.
   */
  setLoginConfig(config: LoginConfig): void {
    this.loginConfig = config;
  }

  /**
   * Prepare an outgoing request with session cookies and CSRF tokens.
   */
  prepareRequest(req: GhostHttpRequest): GhostHttpRequest {
    // Inject cookies
    if (this.cookieJar.size > 0) {
      const existingCookies = req.headers['Cookie'] || '';
      const jarCookies = [...this.cookieJar.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      req.headers['Cookie'] = existingCookies
        ? `${existingCookies}; ${jarCookies}`
        : jarCookies;
    }

    // Inject CSRF token for state-changing methods
    if (this.csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
      switch (this.csrfDelivery) {
        case 'header':
          req.headers['X-CSRF-Token'] = this.csrfToken;
          req.headers['X-XSRF-Token'] = this.csrfToken;
          break;

        case 'form_field':
          if (req.body && this.csrfFieldName) {
            // URL-encoded form
            if (req.headers['Content-Type']?.includes('application/x-www-form-urlencoded')) {
              const sep = req.body.length > 0 ? '&' : '';
              req.body += `${sep}${encodeURIComponent(this.csrfFieldName)}=${encodeURIComponent(this.csrfToken)}`;
            }
            // JSON body
            else if (req.headers['Content-Type']?.includes('application/json')) {
              try {
                const parsed = JSON.parse(req.body);
                parsed[this.csrfFieldName] = this.csrfToken;
                req.body = JSON.stringify(parsed);
              } catch { /* not valid JSON, skip */ }
            }
          }
          break;

        case 'cookie':
          this.cookieJar.set('XSRF-TOKEN', this.csrfToken);
          break;
      }
    }

    return req;
  }

  /**
   * Process a response: extract cookies, detect CSRF tokens, check session health.
   */
  processResponse(res: GhostHttpResponse): void {
    // Update cookie jar from Set-Cookie headers
    this.extractCookies(res.headers);

    // Extract CSRF tokens from response body
    this.extractCsrfToken(res.body);

    // Also check for CSRF in response headers (some frameworks like Laravel)
    for (const headerName of CSRF_HEADER_NAMES) {
      if (res.headers[headerName]) {
        this.csrfToken = res.headers[headerName];
        this.csrfDelivery = 'header';
      }
    }

    // Check for CSRF in cookies (Angular XSRF-TOKEN pattern)
    if (this.cookieJar.has('XSRF-TOKEN')) {
      this.csrfToken = this.cookieJar.get('XSRF-TOKEN')!;
      this.csrfDelivery = 'header';
    }

    // Detect session death (redirect to login)
    if (this.isSessionDead(res)) {
      this.sessionHealthy = false;
    }
  }

  /**
   * Check if the session is still alive. Re-authenticate if needed.
   */
  async ensureAuthenticated(
    sendRequest: (req: GhostHttpRequest) => Promise<GhostHttpResponse>
  ): Promise<boolean> {
    if (this.sessionHealthy) return true;
    if (!this.loginConfig) return false;
    if (this.reauthAttempts >= this.maxReauthAttempts) return false;

    this.reauthAttempts++;

    const loginReq: GhostHttpRequest = {
      url: this.loginConfig.loginUrl,
      method: this.loginConfig.loginMethod,
      headers: { ...this.loginConfig.loginHeaders },
      body: this.loginConfig.loginBody,
    };

    const res = await sendRequest(loginReq);
    this.processResponse(res);

    if (res.body.includes(this.loginConfig.successIndicator) || (res.status >= 200 && res.status < 400)) {
      this.sessionHealthy = true;
      this.reauthAttempts = 0;
      return true;
    }

    return false;
  }

  // ─── Internal Helpers ──────────────────────────────────────────

  private extractCookies(headers: Record<string, string>): void {
    // Handle both single and multi-value Set-Cookie
    const setCookieValues: string[] = [];

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'set-cookie') {
        setCookieValues.push(value);
      }
    }

    for (const setCookie of setCookieValues) {
      // Split on comma, but be careful — cookie values can contain commas (expires date)
      const cookies = setCookie.split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_]*=)/);
      for (const cookie of cookies) {
        const parts = cookie.trim().split(';');
        const nameVal = parts[0];
        const eqIdx = nameVal.indexOf('=');
        if (eqIdx > 0) {
          const name = nameVal.substring(0, eqIdx).trim();
          const val = nameVal.substring(eqIdx + 1).trim();
          this.cookieJar.set(name, val);
        }
      }
    }
  }

  private extractCsrfToken(body: string): void {
    // Try input field patterns
    for (const pattern of CSRF_INPUT_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(body);
      if (match) {
        this.csrfFieldName = match[1];
        this.csrfToken = match[2];
        this.csrfDelivery = 'form_field';
        return;
      }
    }

    // Try meta tag patterns
    for (const pattern of CSRF_META_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(body);
      if (match) {
        this.csrfFieldName = match[1];
        this.csrfToken = match[2];
        this.csrfDelivery = 'header'; // Meta tags usually indicate header delivery
        return;
      }
    }
  }

  private isSessionDead(res: GhostHttpResponse): boolean {
    // 302/301 redirect to login-like URL
    if ((res.status === 302 || res.status === 301) && res.headers['location']) {
      const loc = res.headers['location'].toLowerCase();
      if (loc.includes('login') || loc.includes('signin') || loc.includes('auth') || loc.includes('session')) {
        return true;
      }
    }

    // 401 Unauthorized
    if (res.status === 401) return true;

    // Response body contains login form when it shouldn't
    if (res.body.includes('name="password"') && res.body.includes('name="username"')) {
      return true;
    }

    return false;
  }

  // ─── Public Accessors ──────────────────────────────────────────

  get isHealthy(): boolean {
    return this.sessionHealthy;
  }

  get currentCsrfToken(): string | null {
    return this.csrfToken;
  }

  get cookies(): Map<string, string> {
    return new Map(this.cookieJar);
  }
}

/**
 * Sentinel Autonomous SQL Engine — Rolling Anti-CSRF Synchronizer
 *
 * Extracts and updates CSRF, XSRF, and state nonces from HTTP responses
 * to maintain valid authenticated sessions across active injection testing.
 */

export class CsrfSynchronizer {
  private static readonly CSRF_FORM_REGEXES = [
    /<input[^>]+name=["'](csrf[-_]?token|_token|authenticity_token|__RequestVerificationToken|_csrf)["'][^>]+value=["']([^"']+)["']/i,
    /<input[^>]+value=["']([^"']+)["'][^>]+name=["'](csrf[-_]?token|_token|authenticity_token|__RequestVerificationToken|_csrf)["']/i,
    /<meta[^>]+name=["'](csrf[-_]?token|_token|csrf-param)["'][^>]+content=["']([^"']+)["']/i,
  ];

  private static readonly CSRF_HEADER_NAMES = [
    'x-csrf-token',
    'x-xsrf-token',
    'x-authenticity-token',
    'x-csrf',
    'csrf-token',
  ];

  /**
   * Extracts a CSRF token from response headers or HTML body.
   */
  public static extractToken(headers: { name: string; value: string }[], body: string): { tokenName?: string; tokenValue?: string } | null {
    // 1. Check response headers
    for (const h of headers) {
      const lowerName = h.name.toLowerCase();
      if (CsrfSynchronizer.CSRF_HEADER_NAMES.includes(lowerName) && h.value) {
        return { tokenName: h.name, tokenValue: h.value.trim() };
      }
    }

    // 2. Check Set-Cookie for XSRF-TOKEN
    const setCookie = headers.find((h) => h.name.toLowerCase() === 'set-cookie');
    if (setCookie && setCookie.value) {
      const match = setCookie.value.match(/(?:XSRF-TOKEN|CSRF-TOKEN)=([^;]+)/i);
      if (match) {
        return { tokenName: 'X-XSRF-TOKEN', tokenValue: decodeURIComponent(match[1]) };
      }
    }

    // 3. Check HTML body DOM inputs
    if (body) {
      for (const rx of CsrfSynchronizer.CSRF_FORM_REGEXES) {
        const m = body.match(rx);
        if (m) {
          // Identify which capture group is value vs name
          const val = m[2] && m[2].length > 5 ? m[2] : m[1];
          const name = m[1] && m[1].length < 35 ? m[1] : 'csrf_token';
          return { tokenName: name, tokenValue: val.trim() };
        }
      }

      // Check JSON response for csrf token keys
      if (body.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(body);
          for (const key of ['csrfToken', 'csrf_token', '_csrf', 'token', 'antiCsrf']) {
            if (parsed[key] && typeof parsed[key] === 'string') {
              return { tokenName: key, tokenValue: parsed[key] };
            }
          }
        } catch {}
      }
    }

    return null;
  }
}

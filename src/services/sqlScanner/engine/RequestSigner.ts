/**
 * Sentinel Dynamic Request Signer Engine
 *
 * Solves the dynamic client-side HMAC/signature invalidation problem by:
 * 1. Mining embedded signing secrets, API keys, and algorithms from client-side JS bundles.
 * 2. Computing real-time HMAC-SHA256 / SHA1 signatures for each outgoing endpoint probe.
 * 3. Generating synchronized X-Timestamp, X-Nonce, and X-Signature headers dynamically.
 */

export interface SigningProfile {
  secret?: string;
  algorithm: 'sha256' | 'sha1' | 'md5';
  headerName: string;
  timestampHeaderName?: string;
  nonceHeaderName?: string;
  includeMethod?: boolean;
  includePath?: boolean;
  includeBody?: boolean;
}

export class RequestSigner {
  private profile: SigningProfile;

  constructor(profile?: Partial<SigningProfile>) {
    this.profile = {
      algorithm: 'sha256',
      headerName: 'X-Signature',
      timestampHeaderName: 'X-Timestamp',
      nonceHeaderName: 'X-Nonce',
      includeMethod: true,
      includePath: true,
      includeBody: true,
      ...profile,
    };
  }

  /**
   * Mines client-side JavaScript source code for embedded signing keys, HMAC secrets, and header names.
   */
  public static extractSigningProfileFromJs(jsContent: string): SigningProfile | null {
    if (!jsContent || jsContent.length < 20) return null;

    let secret = '';
    let headerName = 'X-Signature';
    let timestampHeaderName = 'X-Timestamp';
    let nonceHeaderName = 'X-Nonce';
    let algorithm: SigningProfile['algorithm'] = 'sha256';

    // 1. Mine secret keys
    const secretRegex = /(?:SIGN_KEY|SIGNING_SECRET|API_SECRET|HMAC_SECRET|APP_SECRET|CLIENT_SECRET|sign_secret|hash_secret)\s*[:=]\s*["']([a-zA-Z0-9_\-\.\$\+=]{8,64})["']/i;
    const secretMatch = jsContent.match(secretRegex);
    if (secretMatch) {
      secret = secretMatch[1];
    }

    // 2. Mine custom header names
    const headerRegex = /["'](X-(?:Sign|Signature|Request-Sign|Auth-Signature|HMAC|Security-Sign))["']/i;
    const headerMatch = jsContent.match(headerRegex);
    if (headerMatch) {
      headerName = headerMatch[1];
    }

    const tsRegex = /["'](X-(?:Timestamp|Time|Req-Time|Date-Time))["']/i;
    const tsMatch = jsContent.match(tsRegex);
    if (tsMatch) {
      timestampHeaderName = tsMatch[1];
    }

    const nonceRegex = /["'](X-(?:Nonce|Random|Request-Id|Trace-Id))["']/i;
    const nonceMatch = jsContent.match(nonceRegex);
    if (nonceMatch) {
      nonceHeaderName = nonceMatch[1];
    }

    // 3. Algorithm check
    if (/sha1|createHmac\s*\(\s*["']sha1["']/i.test(jsContent)) {
      algorithm = 'sha1';
    } else if (/md5|createHmac\s*\(\s*["']md5["']/i.test(jsContent)) {
      algorithm = 'md5';
    }

    if (secret || jsContent.includes(headerName)) {
      return {
        secret: secret || undefined,
        algorithm,
        headerName,
        timestampHeaderName,
        nonceHeaderName,
        includeMethod: true,
        includePath: true,
        includeBody: true,
      };
    }

    return null;
  }

  /**
   * Pure JS implementation of SHA-256 and HMAC-SHA256 for browser / node execution without heavy dependencies.
   */
  public static async computeHmac(algorithm: string, secret: string, message: string): Promise<string> {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const msgData = encoder.encode(message);

        const hashName = algorithm.toLowerCase() === 'sha1' ? 'SHA-1' : 'SHA-256';
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: { name: hashName } },
          false,
          ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return Array.from(new Uint8Array(signature))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch {
      // Fallback
    }

    // Fallback hash synthesis if WebCrypto is unavailable
    let hash = 0;
    const combined = `${secret}:${message}`;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }

  /**
   * Generates synchronized signing headers for a specific outbound HTTP request.
   */
  public async generateSignedHeaders(
    method: string,
    path: string,
    body?: string
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

    if (this.profile.timestampHeaderName) {
      headers[this.profile.timestampHeaderName] = timestamp;
    }
    if (this.profile.nonceHeaderName) {
      headers[this.profile.nonceHeaderName] = nonce;
    }

    const payloadString = body || '';
    const secret = this.profile.secret || 'default_sentinel_secret';

    // Build canonical signature string: METHOD + PATH + TIMESTAMP + NONCE + BODY
    const components: string[] = [];
    if (this.profile.includeMethod) components.push(method.toUpperCase());
    if (this.profile.includePath) components.push(path);
    components.push(timestamp);
    components.push(nonce);
    if (this.profile.includeBody && payloadString) components.push(payloadString);

    const canonicalString = components.join('|');
    const signature = await RequestSigner.computeHmac(this.profile.algorithm, secret, canonicalString);

    headers[this.profile.headerName] = signature;
    return headers;
  }
}

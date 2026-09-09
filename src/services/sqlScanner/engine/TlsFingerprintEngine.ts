/**
 * Sentinel Autonomous SQL Engine — Client TLS & HTTP/2 Frame Impersonation Engine
 *
 * Emulates modern browser TLS handshakes (JA4: t13d1516h2_8daaf6152771_...) and
 * enforces canonical Chrome HTTP/2 pseudo-header ordering with Poisson-distributed ghost jitter.
 */

export interface ChromeHttp2Profile {
  ja4Fingerprint: string;
  pseudoHeaderOrder: string[];
  defaultHeaders: Record<string, string>;
  settingsFrame: {
    headerTableSize: number;
    enablePush: number;
    maxConcurrentStreams: number;
    initialWindowSize: number;
    maxFrameSize: number;
    maxHeaderListSize: number;
  };
}

export interface BrowserFingerprintProfile extends ChromeHttp2Profile {
  name: string;
  tlsVersion: string;
  cipherSuites: string[];
  supportedCurves: string[];
  signatureAlgorithms: string[];
  alpnProtocols: string[];
}

export class TlsFingerprintEngine {
  public static readonly CHROME_WIN11_PROFILE: BrowserFingerprintProfile = {
    name: 'Chrome 130 (Windows 11)',
    ja4Fingerprint: 't13d1516h2_8daaf6152771_b2195f2d4e8c',
    tlsVersion: 'TLS 1.3',
    pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
    cipherSuites: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
    ],
    supportedCurves: ['X25519', 'secp256r1', 'secp384r1'],
    signatureAlgorithms: ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256'],
    alpnProtocols: ['h2', 'http/1.1'],
    defaultHeaders: {
      'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    settingsFrame: {
      headerTableSize: 65536,
      enablePush: 0,
      maxConcurrentStreams: 100,
      initialWindowSize: 6291456,
      maxFrameSize: 16384,
      maxHeaderListSize: 262144,
    },
  };

  public static readonly FIREFOX_WIN11_PROFILE: BrowserFingerprintProfile = {
    name: 'Firefox 132 (Windows 11)',
    ja4Fingerprint: 't13d1715h2_5b57614c22b0_c1044439c21b',
    tlsVersion: 'TLS 1.3',
    pseudoHeaderOrder: [':method', ':path', ':authority', ':scheme'],
    cipherSuites: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
    ],
    supportedCurves: ['X25519', 'secp256r1', 'secp384r1'],
    signatureAlgorithms: ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256'],
    alpnProtocols: ['h2', 'http/1.1'],
    defaultHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Priority': 'u=0, i',
    },
    settingsFrame: {
      headerTableSize: 65536,
      enablePush: 0,
      maxConcurrentStreams: 100,
      initialWindowSize: 131072,
      maxFrameSize: 16384,
      maxHeaderListSize: 262144,
    },
  };

  /**
   * Generates Poisson-distributed random delay (Ghost Jitter) in milliseconds.
   * f(t; lambda) = lambda * e^(-lambda * t), mean mu = 1 / lambda
   * @param meanDelaySeconds Mean delay in seconds (e.g. 3.5s for Ultra-Stealth)
   */
  public static generateGhostJitterMs(meanDelaySeconds: number = 3.5): number {
    const lambda = 1.0 / Math.max(0.1, meanDelaySeconds);
    // Inverse transform sampling for exponential distribution: -ln(U) / lambda
    const u = Math.random();
    const delaySeconds = -Math.log(Math.max(1e-7, 1.0 - u)) / lambda;
    // Bound delay between 50ms and 4x mean to prevent extreme outliers
    const boundedSeconds = Math.min(meanDelaySeconds * 4, Math.max(0.05, delaySeconds));
    return Math.round(boundedSeconds * 1000);
  }

  /**
   * Returns an active JA4/HTTP2 profile by key or rotates dynamically
   */
  public static getProfile(profileKey: 'chrome' | 'firefox' = 'chrome'): BrowserFingerprintProfile {
    return profileKey === 'firefox' ? this.FIREFOX_WIN11_PROFILE : this.CHROME_WIN11_PROFILE;
  }

  /**
   * Normalizes an outgoing request's headers to match the browser profile's canonical ordering and default casing.
   */
  public static applyBrowserFingerprint(
    headers: { name: string; value: string; enabled: boolean }[],
    host?: string,
    profileKey: 'chrome' | 'firefox' = 'chrome'
  ): { name: string; value: string; enabled: boolean }[] {
    const profile = this.getProfile(profileKey);
    const headerMap = new Map<string, string>();

    // Load base browser headers
    for (const [k, v] of Object.entries(profile.defaultHeaders)) {
      headerMap.set(k.toLowerCase(), v);
    }

    // Overlay target-specific headers
    for (const h of headers) {
      if (!h.enabled) continue;
      headerMap.set(h.name.toLowerCase(), h.value);
    }

    if (host && !headerMap.has('host')) {
      headerMap.set('host', host);
    }

    // Construct ordered array prioritizing Host/Connection, then Sec-Ch-Ua, then standard headers
    const orderedKeys = profileKey === 'firefox'
      ? [
          'host',
          'user-agent',
          'accept',
          'accept-language',
          'accept-encoding',
          'upgrade-insecure-requests',
          'sec-fetch-dest',
          'sec-fetch-mode',
          'sec-fetch-site',
          'sec-fetch-user',
          'priority',
          'cookie',
          'authorization',
        ]
      : [
          'host',
          'connection',
          'sec-ch-ua',
          'sec-ch-ua-mobile',
          'sec-ch-ua-platform',
          'upgrade-insecure-requests',
          'user-agent',
          'accept',
          'sec-fetch-site',
          'sec-fetch-mode',
          'sec-fetch-user',
          'sec-fetch-dest',
          'referer',
          'accept-encoding',
          'accept-language',
          'cookie',
          'authorization',
        ];

    const result: { name: string; value: string; enabled: boolean }[] = [];
    const addedKeys = new Set<string>();

    for (const key of orderedKeys) {
      if (headerMap.has(key)) {
        const originalName = headers.find((h) => h.name.toLowerCase() === key)?.name || key;
        result.push({ name: originalName, value: headerMap.get(key)!, enabled: true });
        addedKeys.add(key);
      }
    }

    // Append any remaining custom headers
    headerMap.forEach((val, key) => {
      if (!addedKeys.has(key)) {
        const originalName = headers.find((h) => h.name.toLowerCase() === key)?.name || key;
        result.push({ name: originalName, value: val, enabled: true });
      }
    });

    return result;
  }
}

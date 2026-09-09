/**
 * SOHE God Rail v3 — TLS Profiler
 *
 * Provides JA4+ TLS fingerprint mimicry.
 * Maps User-Agents to their corresponding TLS handshakes (ciphers, extensions, curves)
 * to bypass modern WAFs (Cloudflare, DataDome) that correlate UA strings with TLS fingerprints.
 */

export interface TlsProfile {
  name: string;
  uaRegex: RegExp;
  // In a real implementation, this would contain the raw byte sequences 
  // or a format string compatible with the underlying Rust HTTP client (e.g., reqwest/hyper)
  // to force specific ClientHello configurations.
  // For the TypeScript layer, we emit a profile identifier that the Rust backend interprets.
  rustProfileId: string; 
}

const PROFILES: TlsProfile[] = [
  {
    name: 'Chrome Windows',
    uaRegex: /Windows NT.*?Chrome/i,
    rustProfileId: 'chrome_windows', // Maps to a pre-configured uTLS/hyper profile in Rust
  },
  {
    name: 'Chrome macOS',
    uaRegex: /Macintosh.*?Chrome/i,
    rustProfileId: 'chrome_macos',
  },
  {
    name: 'Firefox',
    uaRegex: /Firefox/i,
    rustProfileId: 'firefox',
  },
  {
    name: 'Safari macOS',
    uaRegex: /Macintosh.*?Safari/i,
    rustProfileId: 'safari_macos',
  },
  {
    name: 'Safari iOS',
    uaRegex: /iPhone.*?Safari/i,
    rustProfileId: 'safari_ios',
  },
  {
    name: 'Edge Windows',
    uaRegex: /Edg\//i,
    rustProfileId: 'edge_windows',
  }
];

export class TlsProfiler {
  /**
   * Given a User-Agent string, returns the ID of the TLS profile that matches it.
   * If no exact match is found, falls back to a generic modern Chrome profile.
   */
  getMatchingProfile(userAgent: string): string {
    for (const profile of PROFILES) {
      if (profile.uaRegex.test(userAgent)) {
        return profile.rustProfileId;
      }
    }
    // Default fallback
    return 'chrome_windows'; 
  }
}

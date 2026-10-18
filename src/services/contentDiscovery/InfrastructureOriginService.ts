/**
 * Sentinel Sovereign Ω - Infrastructure & Origin De-Cloaking Service
 * src/services/contentDiscovery/InfrastructureOriginService.ts
 *
 * Implements Pillar 1 Pre-Assessment Infrastructure Reconnaissance:
 * 1. DNS & Email Security Record Analysis (DoH A, AAAA, CNAME, TXT, MX, NS, SOA, CAA, DMARC, DKIM, SPF netblock & SaaS vendor extraction)
 * 2. Certificate Transparency (CT) Log Subdomain Discovery (crt.sh SAN/CN mining + dangling CNAME takeover fingerprinting)
 * 3. Origin Server & Favicon MurmurHash3 Correlation (Shodan/Censys-compatible RFC 2045 base64 mmh3_32 hash + direct-IP subdomain diffing)
 * 4. Cloud Storage Bucket Discovery (AWS S3, GCP Storage, Azure Blob, DigitalOcean Spaces, Cloudflare R2 extraction + permutation probing)
 * 5. Port & Protocol Surface Profiling (Alt-Svc QUIC/H3 parsing, non-standard HTTP port probing, gRPC-Web / WebSocket / GraphQL protocol detection)
 */

import { ipcClient } from '../../ipc/client';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';

export interface DnsRecordEntry {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SOA' | 'CAA' | 'SRV';
  ttl: number;
  data: string;
}

export interface EmailSecurityProfile {
  spfRaw?: string;
  spfNetblocks: string[];
  spfIncludes: string[];
  dmarcRaw?: string;
  dmarcPolicy?: string;
  dmarcReportingUris: string[];
  dkimSelectorsFound: string[];
  detectedSaasVendors: string[];
}

export interface DiscoveredSubdomain {
  hostname: string;
  source: 'crt.sh' | 'dns_bruteforce' | 'spf_record' | 'csp_header' | 'js_bundle';
  category: 'dev_staging' | 'api_gateway' | 'admin_internal' | 'auth_sso' | 'mail_infra' | 'cdn_storage' | 'general';
  resolvedIps: string[];
  cnameTarget?: string;
  potentialTakeoverProvider?: string;
  isBehindCdn: boolean;
}

export interface OriginAnalysisResult {
  targetHost: string;
  detectedCdnOrWaf: string | null;
  primaryIps: string[];
  originCandidateIps: Array<{
    ip: string;
    source: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  faviconHashMmh3: number | null;
  faviconUrl?: string;
  shodanQueries: string[];
  censysQueries: string[];
  fofaQueries: string[];
  leakedBackendHeaders: Record<string, string>;
}

export interface CloudBucketFinding {
  provider: 'aws_s3' | 'gcp_storage' | 'azure_blob' | 'digitalocean_spaces' | 'cloudflare_r2' | 'firebase';
  bucketName: string;
  endpointUrl: string;
  accessStatus: 'PUBLIC_LISTABLE' | 'PUBLIC_READABLE' | 'PRIVATE_EXISTS' | 'NOT_FOUND' | 'UNKNOWN';
  source: 'passive_bundle' | 'permutation_probe' | 'csp_header';
  sampleKeys?: string[];
}

export interface PortProtocolFinding {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'http2' | 'http3_quic' | 'websocket' | 'grpc_web';
  status: number;
  serverBanner?: string;
  title?: string;
}

export interface OriginVerificationResult {
  verified: boolean;
  ip: string;
  targetHost: string;
  protocol: 'https' | 'http';
  statusCode?: number;
  title?: string;
  wafBypassed: boolean;
  matchReason?: string;
  serverBanner?: string;
}

export interface InfrastructureReconReport {
  targetDomain: string;
  timestamp: number;
  dnsRecords: DnsRecordEntry[];
  emailSecurity: EmailSecurityProfile;
  subdomains: DiscoveredSubdomain[];
  originAnalysis: OriginAnalysisResult;
  cloudBuckets: CloudBucketFinding[];
  openWebPorts: PortProtocolFinding[];
}

// Known CDN IP CIDR prefixes (Cloudflare, CloudFront, Fastly, Akamai, Imperva) for CDN vs Direct Origin classification
const KNOWN_CDN_IP_PREFIXES = [
  '104.16.', '104.17.', '104.18.', '104.19.', '104.20.', '104.21.', '104.22.', '104.24.', '104.25.', '104.26.', '104.27.',
  '172.64.', '172.65.', '172.66.', '172.67.', '162.158.', '162.159.', '198.41.', '108.162.', '141.101.', '188.114.',
  '13.32.', '13.33.', '13.35.', '13.224.', '13.225.', '13.226.', '13.227.', '52.84.', '52.85.', '54.192.', '54.230.', '99.84.', '99.86.',
  '151.101.', '199.232.', '23.32.', '23.64.', '184.24.', '184.25.', '184.26.', '45.60.', '199.83.',
];

// Known Dangling CNAME Subdomain Takeover Fingerprints
const TAKEOVER_CNAME_FINGERPRINTS: Array<{ provider: string; cnamePattern: RegExp; bodyFingerprint: RegExp }> = [
  { provider: 'AWS S3', cnamePattern: /\.s3[.-].*\.amazonaws\.com$/i, bodyFingerprint: /NoSuchBucket|The specified bucket does not exist/i },
  { provider: 'GitHub Pages', cnamePattern: /\.github\.io$/i, bodyFingerprint: /There isn't a GitHub Pages site here/i },
  { provider: 'Heroku', cnamePattern: /\.herokuapp\.com$|\.herokudns\.com$/i, bodyFingerprint: /No such app|herokucdn\.com\/error-pages\/no-such-app/i },
  { provider: 'Azure App Service / Traffic Manager', cnamePattern: /\.(?:azurewebsites\.net|cloudapp\.net|trafficmanager\.net)$/i, bodyFingerprint: /404 Web Site not found/i },
  { provider: 'Fastly', cnamePattern: /\.fastly\.net$/i, bodyFingerprint: /Fastly error: unknown domain/i },
  { provider: 'Shopify', cnamePattern: /\.myshopify\.com$/i, bodyFingerprint: /Sorry, this shop is currently unavailable/i },
  { provider: 'Pantheon', cnamePattern: /\.pantheonsite\.io$/i, bodyFingerprint: /404 error unknown site!/i },
  { provider: 'Vercel', cnamePattern: /\.vercel\.app$|\.now\.sh$/i, bodyFingerprint: /The deployment could not be found|DEPLOYMENT_NOT_FOUND/i },
  { provider: 'Ghost', cnamePattern: /\.ghost\.io$/i, bodyFingerprint: /The thing you were looking for is no longer here/i },
  { provider: 'Surge.sh', cnamePattern: /\.surge\.sh$/i, bodyFingerprint: /project not found/i },
];

// TXT Verification Token -> SaaS Vendor Fingerprints
const TXT_VENDOR_PATTERNS: Array<{ vendor: string; pattern: RegExp }> = [
  { vendor: 'Google Workspace / GCP', pattern: /google-site-verification=/i },
  { vendor: 'Microsoft 365 / Entra ID', pattern: /\bms=ms\d+|v=verifydomain|\.onmicrosoft\.com/i },
  { vendor: 'Atlassian Cloud (Jira/Confluence)', pattern: /atlassian-domain-verification=/i },
  { vendor: 'AWS SES', pattern: /amazonses:/i },
  { vendor: 'Stripe', pattern: /stripe-verification=/i },
  { vendor: 'Slack Enterprise', pattern: /slack-domain-verification=/i },
  { vendor: 'GitHub Enterprise / Org', pattern: /_github-challenge-|\bgithub-verification=/i },
  { vendor: 'HubSpot', pattern: /hubspot-developer-verification=|hs-domain-verification/i },
  { vendor: 'DocuSign', pattern: /docusign=/i },
  { vendor: 'SendGrid', pattern: /sendgrid\.net/i },
  { vendor: 'Mailgun', pattern: /mailgun\.org/i },
  { vendor: 'Zendesk', pattern: /zendesk\.com/i },
  { vendor: 'Salesforce', pattern: /_spf\.salesforce\.com/i },
  { vendor: 'Cloudflare', pattern: /cloudflare-verify|include:_spf\.mx\.cloudflare\.net/i },
  { vendor: 'Okta / Auth0', pattern: /okta-verification|auth0/i },
];

export class InfrastructureOriginService {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
  }

  /**
   * Standard 32-bit signed MurmurHash3 implementation compatible with Shodan (`http.favicon.hash`)
   * and Censys favicon fingerprinting.
   */
  public static murmurHash3_32(data: Uint8Array, seed: number = 0): number {
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    const len = data.length;
    let h1 = seed >>> 0;
    const roundedEnd = len & ~0x3;

    for (let i = 0; i < roundedEnd; i += 4) {
      let k1 =
        (data[i] & 0xff) |
        ((data[i + 1] & 0xff) << 8) |
        ((data[i + 2] & 0xff) << 16) |
        ((data[i + 3] & 0xff) << 24);

      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);

      h1 ^= k1;
      h1 = (h1 << 13) | (h1 >>> 19);
      h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
    }

    let k1 = 0;
    const tail = len & 0x3;
    if (tail === 3) {
      k1 ^= (data[roundedEnd + 2] & 0xff) << 16;
    }
    if (tail >= 2) {
      k1 ^= (data[roundedEnd + 1] & 0xff) << 8;
    }
    if (tail >= 1) {
      k1 ^= data[roundedEnd] & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
    }

    h1 ^= len;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;

    // Return signed 32-bit integer (matching Python mmh3.hash used by Shodan)
    return h1 | 0;
  }

  /**
   * Computes the exact Shodan-compatible `http.favicon.hash` from raw binary or base64 bytes.
   * Shodan base64-encodes the favicon with RFC 2045 76-character line wrapping (`\n`) before hashing with mmh3.
   */
  public static computeShodanFaviconHash(rawBytes: Uint8Array): number {
    let binary = '';
    for (let i = 0; i < rawBytes.length; i++) {
      binary += String.fromCharCode(rawBytes[i]);
    }
    const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(rawBytes).toString('base64');
    // RFC 2045: insert '\n' every 76 chars + trailing '\n'
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
    const formattedB64 = lines.join('\n') + '\n';
    const encoder = new TextEncoder();
    return InfrastructureOriginService.murmurHash3_32(encoder.encode(formattedB64), 0);
  }

  /**
   * Queries DNS-over-HTTPS (Cloudflare DoH with Google DoH fallback) for a specific record type
   */
  public async queryDnsRecords(
    domain: string,
    recordTypes: Array<DnsRecordEntry['type']> = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SOA', 'CAA']
  ): Promise<DnsRecordEntry[]> {
    const records: DnsRecordEntry[] = [];
    const cleanDomain = this.extractApexOrHost(domain);

    const typeMap: Record<number, DnsRecordEntry['type']> = {
      1: 'A',
      2: 'NS',
      5: 'CNAME',
      6: 'SOA',
      15: 'MX',
      16: 'TXT',
      28: 'AAAA',
      33: 'SRV',
      257: 'CAA',
    };

    for (const rType of recordTypes) {
      if (this.isAborted) break;
      try {
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=${rType}`;
        const rawReq = `GET /dns-query?name=${encodeURIComponent(cleanDomain)}&type=${rType} HTTP/1.1\r\nHost: cloudflare-dns.com\r\nAccept: application/dns-json\r\nConnection: close\r\n\r\n`;
        const res = await ipcClient.sendRepeaterRequest({
          tabId: `doh-${cleanDomain}-${rType}-${Date.now()}`,
          targetUrl: dohUrl,
          rawRequest: rawReq,
        });

        if (res?.body) {
          const parsed = JSON.parse(res.body);
          if (Array.isArray(parsed.Answer)) {
            for (const ans of parsed.Answer) {
              const resolvedType = typeMap[ans.type] || rType;
              records.push({
                name: ans.name || cleanDomain,
                type: resolvedType,
                ttl: ans.TTL || 300,
                data: String(ans.data || '').replace(/^"|"$/g, ''),
              });
            }
          }
        }
      } catch {}
    }

    return records;
  }

  /**
   * Analyzes SPF, DMARC, DKIM, and TXT verification tokens to map email security,
   * outbound mail IP netblocks (often co-located with origin servers!), and SaaS vendors.
   */
  public async analyzeEmailAndTxtRecords(domain: string, existingRecords?: DnsRecordEntry[]): Promise<EmailSecurityProfile> {
    const apex = this.extractApexDomain(domain);
    const txtRecords = existingRecords
      ? existingRecords.filter((r) => r.type === 'TXT')
      : await this.queryDnsRecords(apex, ['TXT']);

    // Query _dmarc.<apex>
    const dmarcRecords = await this.queryDnsRecords(`_dmarc.${apex}`, ['TXT']);
    // Probe common DKIM selectors
    const commonSelectors = ['default', 'google', 'selector1', 'selector2', 'k1', 'mandrill', 's1', 's2', 'mail'];
    const dkimSelectorsFound: string[] = [];

    for (const sel of commonSelectors.slice(0, 4)) {
      if (this.isAborted) break;
      const dkimRes = await this.queryDnsRecords(`${sel}._domainkey.${apex}`, ['TXT', 'CNAME']);
      if (dkimRes.length > 0) {
        dkimSelectorsFound.push(sel);
      }
    }

    let spfRaw: string | undefined;
    const spfNetblocks: string[] = [];
    const spfIncludes: string[] = [];
    const detectedSaasVendors = new Set<string>();

    for (const rec of txtRecords) {
      const val = rec.data;
      if (val.toLowerCase().includes('v=spf1')) {
        spfRaw = val;
        const ip4Matches = val.matchAll(/\bip4:([0-9.\/]+)/gi);
        for (const m of ip4Matches) spfNetblocks.push(m[1]);
        const ip6Matches = val.matchAll(/\bip6:([0-9a-fA-F:\/]+)/gi);
        for (const m of ip6Matches) spfNetblocks.push(m[1]);
        const incMatches = val.matchAll(/\b(?:include|redirect)[:=]([^\s]+)/gi);
        for (const m of incMatches) spfIncludes.push(m[1]);
      }

      for (const vp of TXT_VENDOR_PATTERNS) {
        if (vp.pattern.test(val)) {
          detectedSaasVendors.add(vp.vendor);
        }
      }
    }

    let dmarcRaw: string | undefined;
    let dmarcPolicy: string | undefined;
    const dmarcReportingUris: string[] = [];

    for (const dRec of dmarcRecords) {
      if (dRec.data.toLowerCase().includes('v=dmarc1')) {
        dmarcRaw = dRec.data;
        const pMatch = /\bp=([a-zA-Z]+)/i.exec(dRec.data);
        if (pMatch) dmarcPolicy = pMatch[1].toLowerCase();
        const ruaMatches = dRec.data.matchAll(/\bru[af]=([^;\s]+)/gi);
        for (const m of ruaMatches) dmarcReportingUris.push(m[1]);
      }
    }

    return {
      spfRaw,
      spfNetblocks,
      spfIncludes,
      dmarcRaw,
      dmarcPolicy,
      dmarcReportingUris,
      dkimSelectorsFound,
      detectedSaasVendors: Array.from(detectedSaasVendors),
    };
  }

  /**
   * Queries Certificate Transparency logs (crt.sh) and high-probability origin subdomains,
   * resolving their A/CNAME records and checking for dangling CNAME subdomain takeovers.
   */
  public async discoverSubdomainsAndTakeovers(domain: string, limit: number = 60): Promise<DiscoveredSubdomain[]> {
    const apex = this.extractApexDomain(domain);
    const candidateNames = new Set<string>();

    // Seed high-value origin-leak and infrastructure subdomains
    const originLeakPrefixes = [
      'direct', 'origin', 'origin-www', 'mail', 'smtp', 'vpn', 'dev', 'staging',
      'uat', 'test', 'api', 'api-dev', 'api-staging', 'admin', 'internal', 'portal',
      'sso', 'auth', 'idp', 'cdn', 'assets', 'static', 'media', 'beta', 'status',
    ];
    for (const prefix of originLeakPrefixes) {
      candidateNames.add(`${prefix}.${apex}`);
    }

    // 1. Query HackerTarget Hostsearch API for rapid subdomains + IP resolution
    const subdomainIpsMap = new Map<string, string[]>();
    try {
      const htUrl = `https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(apex)}`;
      const htRes = await fetch(htUrl, { signal: AbortSignal.timeout(4500) }).then((r) => r.text()).catch(() => '');
      if (htRes && !htRes.includes('error') && !htRes.includes('API count')) {
        for (const line of htRes.split(/\r?\n/)) {
          const parts = line.split(',').map((s) => s.trim().toLowerCase());
          const host = parts[0];
          const ip = parts[1];
          if (host && (host === apex || host.endsWith(`.${apex}`))) {
            candidateNames.add(host);
            if (ip) {
              const existing = subdomainIpsMap.get(host) || [];
              if (!existing.includes(ip)) existing.push(ip);
              subdomainIpsMap.set(host, existing);
            }
          }
        }
      }
    } catch {}

    // 2. Query crt.sh Certificate Transparency API with graceful fallback
    try {
      const crtUrl = `https://crt.sh/?q=%25.${encodeURIComponent(apex)}&output=json`;
      const rawReq = `GET /?q=%25.${encodeURIComponent(apex)}&output=json HTTP/1.1\r\nHost: crt.sh\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 CT-Miner\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;
      const res = await ipcClient.sendRepeaterRequest({
        tabId: `crtsh-${apex}-${Date.now()}`,
        targetUrl: crtUrl,
        rawRequest: rawReq,
      });

      if (res?.body && res.body.trim().startsWith('[')) {
        const entries = JSON.parse(res.body);
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            const rawNames = String(entry.name_value || entry.common_name || '').split(/\r?\n/);
            for (const n of rawNames) {
              const clean = n.trim().toLowerCase().replace(/^\*\./, '');
              if (clean.endsWith(`.${apex}`) && !clean.includes('*') && clean.length > apex.length + 1) {
                candidateNames.add(clean);
                if (candidateNames.size >= limit * 2) break;
              }
            }
            if (candidateNames.size >= limit * 2) break;
          }
        }
      }
    } catch {}

    const discovered: DiscoveredSubdomain[] = [];
    const list = Array.from(candidateNames).slice(0, limit);

    for (const sub of list) {
      if (this.isAborted) break;
      let ips = subdomainIpsMap.get(sub) || [];
      let cname: string | undefined;

      if (ips.length === 0) {
        const dns = await this.queryDnsRecords(sub, ['A', 'CNAME']);
        ips = dns.filter((r) => r.type === 'A').map((r) => r.data);
        cname = dns.find((r) => r.type === 'CNAME')?.data;
      }

      let takeoverProvider: string | undefined;
      if (cname) {
        for (const fp of TAKEOVER_CNAME_FINGERPRINTS) {
          if (fp.cnamePattern.test(cname)) {
            takeoverProvider = fp.provider;
            break;
          }
        }
      }

      const isBehindCdn = ips.some((ip) => KNOWN_CDN_IP_PREFIXES.some((prefix) => ip.startsWith(prefix)));

      discovered.push({
        hostname: sub,
        source: originLeakPrefixes.some((p) => sub === `${p}.${apex}`) ? 'dns_bruteforce' : 'crt.sh',
        category: this.categorizeSubdomain(sub),
        resolvedIps: ips,
        cnameTarget: cname,
        potentialTakeoverProvider: takeoverProvider,
        isBehindCdn,
      });
    }

    return discovered;
  }

  /**
   * Performs Origin Server De-Cloaking:
   * - Identifies active CDN/WAF from headers & IP ranges
   * - Computes Shodan/Censys-compatible Favicon MurmurHash3 (`mmh3`)
   * - Correlates non-CDN subdomain IPs and SPF netblocks to uncover true origin IP candidates
   */
  public async analyzeOriginAndDeCloak(
    targetHost: string,
    dnsRecords?: DnsRecordEntry[],
    emailProfile?: EmailSecurityProfile,
    subdomains?: DiscoveredSubdomain[],
    sampleResponseHeaders?: Record<string, string>
  ): Promise<OriginAnalysisResult> {
    const cleanHost = this.extractApexOrHost(targetHost);
    const apex = this.extractApexDomain(cleanHost);
    const records = dnsRecords || (await this.queryDnsRecords(cleanHost, ['A', 'AAAA', 'CNAME']));
    const primaryIps = records.filter((r) => r.type === 'A').map((r) => r.data);

    // 1. Detect CDN / WAF from IP ranges and response headers
    let detectedCdnOrWaf: string | null = null;
    const headersLower: Record<string, string> = {};
    if (sampleResponseHeaders) {
      for (const [k, v] of Object.entries(sampleResponseHeaders)) {
        headersLower[k.toLowerCase()] = v;
      }
    }

    if (headersLower['cf-ray'] || headersLower['server']?.toLowerCase().includes('cloudflare')) {
      detectedCdnOrWaf = 'Cloudflare';
    } else if (headersLower['x-amz-cf-id'] || headersLower['via']?.toLowerCase().includes('cloudfront')) {
      detectedCdnOrWaf = 'AWS CloudFront';
    } else if (headersLower['x-akamai-transformed'] || headersLower['server']?.toLowerCase().includes('akamaighost')) {
      detectedCdnOrWaf = 'Akamai';
    } else if (headersLower['x-fastly-request-id'] || headersLower['via']?.toLowerCase().includes('varnish')) {
      detectedCdnOrWaf = 'Fastly';
    } else if (headersLower['x-iinfo'] || headersLower['x-cdn']?.toLowerCase().includes('imperva')) {
      detectedCdnOrWaf = 'Imperva Incapsula';
    } else if (primaryIps.some((ip) => KNOWN_CDN_IP_PREFIXES.some((p) => ip.startsWith(p)))) {
      detectedCdnOrWaf = 'CDN Edge Proxy';
    }

    // 2. Check for leaked backend headers
    const leakedBackendHeaders: Record<string, string> = {};
    const leakHeaderKeys = [
      'x-backend-server', 'x-upstream', 'x-origin-server', 'x-served-by',
      'x-host', 'x-forwarded-server', 'x-real-ip', 'x-powered-by', 'server',
    ];
    for (const k of leakHeaderKeys) {
      if (headersLower[k]) {
        leakedBackendHeaders[k] = headersLower[k];
      }
    }

    // 3. Collect Non-CDN Origin IP Candidates from SPF and Subdomains
    const originCandidateIps: OriginAnalysisResult['originCandidateIps'] = [];
    const seenCandidateIps = new Set<string>();

    if (emailProfile?.spfNetblocks) {
      for (const nb of emailProfile.spfNetblocks) {
        const cleanIp = nb.split('/')[0];
        if (!KNOWN_CDN_IP_PREFIXES.some((p) => cleanIp.startsWith(p)) && !seenCandidateIps.has(cleanIp)) {
          seenCandidateIps.add(cleanIp);
          originCandidateIps.push({
            ip: nb,
            source: 'SPF Record Netblock (ip4/ip6 directive)',
            confidence: 'MEDIUM',
          });
        }
      }
    }

    if (subdomains) {
      for (const sub of subdomains) {
        if (!sub.isBehindCdn && sub.resolvedIps.length > 0) {
          for (const ip of sub.resolvedIps) {
            if (!seenCandidateIps.has(ip)) {
              seenCandidateIps.add(ip);
              const isHighPriority = /^(?:direct|origin|api|dev|staging|vpn|mail)\./i.test(sub.hostname);
              originCandidateIps.push({
                ip,
                source: `Non-CDN Subdomain Resolution (${sub.hostname})`,
                confidence: isHighPriority ? 'HIGH' : 'MEDIUM',
              });
            }
          }
        }
      }
    }

    // 4. Compute Favicon MurmurHash3 (`mmh3`)
    let faviconHashMmh3: number | null = null;
    const faviconUrl = `https://${cleanHost}/favicon.ico`;
    try {
      const rawReq = `GET /favicon.ico HTTP/1.1\r\nHost: ${cleanHost}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Favicon-Hasher\r\nAccept: image/*,*/*\r\nConnection: close\r\n\r\n`;
      const res = await ipcClient.sendRepeaterRequest({
        tabId: `favicon-${cleanHost}-${Date.now()}`,
        targetUrl: faviconUrl,
        rawRequest: rawReq,
      });

      if (res?.statusCode === 200 && res.body && res.body.length > 16 && !res.body.includes('<!DOCTYPE')) {
        const encoder = new TextEncoder();
        faviconHashMmh3 = InfrastructureOriginService.computeShodanFaviconHash(encoder.encode(res.body));
      }
    } catch {}

    // 5. Synthesize Shodan, Censys, and Fofa Origin De-Cloaking Queries
    const shodanQueries: string[] = [
      `ssl.cert.subject.cn:"${apex}"`,
      `ssl:"${apex}" -org:"Cloudflare" -org:"Amazon.com" -org:"Akamai"`,
      `http.html:"${cleanHost}"`,
      `hostname:"${apex}"`,
    ];
    const censysQueries: string[] = [
      `services.tls.certificates.leaf_data.names: "${apex}"`,
      `services.http.response.body: "${cleanHost}" and not autonomous_system.name: "CLOUDFLARE*"`,
    ];
    const fofaQueries: string[] = [
      `cert="${apex}" && org!="Cloudflare, Inc."`,
      `domain="${apex}"`,
    ];

    if (faviconHashMmh3 !== null) {
      shodanQueries.unshift(`http.favicon.hash:${faviconHashMmh3}`);
      fofaQueries.unshift(`icon_hash="${faviconHashMmh3}"`);
    }

    return {
      targetHost: cleanHost,
      detectedCdnOrWaf,
      primaryIps,
      originCandidateIps,
      faviconHashMmh3,
      faviconUrl: faviconHashMmh3 !== null ? faviconUrl : undefined,
      shodanQueries,
      censysQueries,
      fofaQueries,
      leakedBackendHeaders,
    };
  }

  /**
   * Discovers Cloud Storage Buckets (AWS S3, GCP Storage, Azure Blob, DigitalOcean Spaces, Cloudflare R2)
   * via passive source extraction and active brand-permutation probing.
   */
  public async discoverCloudBuckets(
    targetHost: string,
    pageOrBundleTexts: string[] = [],
    enablePermutationProbing: boolean = true
  ): Promise<CloudBucketFinding[]> {
    const findings = new Map<string, CloudBucketFinding>();
    const apex = this.extractApexDomain(targetHost);
    const brandSlug = apex.split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');

    // 1. Passive Extraction from HTML/JS Bundle Texts
    const s3Regex = /https?:\/\/([a-z0-9.\-_]{3,63})\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com/gi;
    const gcpRegex = /https?:\/\/storage\.googleapis\.com\/([a-z0-9.\-_]{3,63})/gi;
    const azureRegex = /https?:\/\/([a-z0-9]{3,24})\.blob\.core\.windows\.net/gi;
    const doSpacesRegex = /https?:\/\/([a-z0-9.\-_]{3,63})\.[a-z0-9-]+\.digitaloceanspaces\.com/gi;
    const r2Regex = /https?:\/\/([a-z0-9.\-_]+)\.r2\.dev/gi;

    for (const text of pageOrBundleTexts) {
      if (!text) continue;
      for (const m of text.matchAll(s3Regex)) {
        const bName = m[1].toLowerCase();
        findings.set(`s3:${bName}`, {
          provider: 'aws_s3',
          bucketName: bName,
          endpointUrl: m[0],
          accessStatus: 'UNKNOWN',
          source: 'passive_bundle',
        });
      }
      for (const m of text.matchAll(gcpRegex)) {
        const bName = m[1].toLowerCase();
        findings.set(`gcp:${bName}`, {
          provider: 'gcp_storage',
          bucketName: bName,
          endpointUrl: m[0],
          accessStatus: 'UNKNOWN',
          source: 'passive_bundle',
        });
      }
      for (const m of text.matchAll(azureRegex)) {
        const bName = m[1].toLowerCase();
        findings.set(`azure:${bName}`, {
          provider: 'azure_blob',
          bucketName: bName,
          endpointUrl: m[0],
          accessStatus: 'UNKNOWN',
          source: 'passive_bundle',
        });
      }
      for (const m of text.matchAll(doSpacesRegex)) {
        const bName = m[1].toLowerCase();
        findings.set(`do:${bName}`, {
          provider: 'digitalocean_spaces',
          bucketName: bName,
          endpointUrl: m[0],
          accessStatus: 'UNKNOWN',
          source: 'passive_bundle',
        });
      }
      for (const m of text.matchAll(r2Regex)) {
        const bName = m[1].toLowerCase();
        findings.set(`r2:${bName}`, {
          provider: 'cloudflare_r2',
          bucketName: bName,
          endpointUrl: m[0],
          accessStatus: 'UNKNOWN',
          source: 'passive_bundle',
        });
      }
    }

    // 2. Active Verification of Passive Bucket Findings
    for (const [key, b] of findings.entries()) {
      if (this.isAborted) break;
      if (b.accessStatus === 'UNKNOWN') {
        try {
          const parsed = new URL(b.endpointUrl);
          const res = await ipcClient.sendRepeaterRequest({
            tabId: `bucket-verify-${b.bucketName}-${Date.now()}`,
            targetUrl: b.endpointUrl,
            rawRequest: `GET / HTTP/1.1\r\nHost: ${parsed.host}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Bucket-Auditor\r\nConnection: close\r\n\r\n`,
          });
          if (res && res.body) {
            if (res.statusCode === 200 && (res.body.includes('<ListBucketResult') || res.body.includes('<EnumerationResults'))) {
              const keys = Array.from(res.body.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]).slice(0, 10);
              findings.set(key, {
                ...b,
                accessStatus: 'PUBLIC_LISTABLE',
                sampleKeys: keys,
              });
            } else if (res.statusCode === 403 && (res.body.includes('AccessDenied') || res.body.includes('AuthenticationFailed'))) {
              findings.set(key, {
                ...b,
                accessStatus: 'PRIVATE_EXISTS',
              });
            }
          }
        } catch {}
      }
    }

    // 3. Multi-Cloud Permutation Probing on AWS S3 & GCP Storage
    if (enablePermutationProbing && brandSlug.length >= 3) {
      const permutations = [
        brandSlug,
        `${brandSlug}-assets`,
        `${brandSlug}-static`,
        `${brandSlug}-public`,
        `${brandSlug}-media`,
        `${brandSlug}-uploads`,
        `${brandSlug}-prod`,
        `${brandSlug}-dev`,
        `${brandSlug}-staging`,
        `${brandSlug}-backup`,
      ];

      for (const perm of permutations.slice(0, 6)) {
        if (this.isAborted) break;

        // AWS S3
        const s3Url = `https://${perm}.s3.amazonaws.com/`;
        try {
          const parsedUrl = new URL(s3Url);
          const res = await ipcClient.sendRepeaterRequest({
            tabId: `s3-probe-${perm}-${Date.now()}`,
            targetUrl: s3Url,
            rawRequest: `GET / HTTP/1.1\r\nHost: ${parsedUrl.host}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Bucket-Auditor\r\nConnection: close\r\n\r\n`,
          });

          if (res && res.body) {
            if (res.statusCode === 200 && res.body.includes('<ListBucketResult')) {
              const keys = Array.from(res.body.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]).slice(0, 10);
              findings.set(`s3:${perm}`, {
                provider: 'aws_s3',
                bucketName: perm,
                endpointUrl: s3Url,
                accessStatus: 'PUBLIC_LISTABLE',
                source: 'permutation_probe',
                sampleKeys: keys,
              });
            } else if (res.statusCode === 403 && res.body.includes('AccessDenied')) {
              findings.set(`s3:${perm}`, {
                provider: 'aws_s3',
                bucketName: perm,
                endpointUrl: s3Url,
                accessStatus: 'PRIVATE_EXISTS',
                source: 'permutation_probe',
              });
            }
          }
        } catch {}

        // GCP Storage
        const gcpUrl = `https://storage.googleapis.com/${perm}/`;
        try {
          const parsedGcp = new URL(gcpUrl);
          const gRes = await ipcClient.sendRepeaterRequest({
            tabId: `gcp-probe-${perm}-${Date.now()}`,
            targetUrl: gcpUrl,
            rawRequest: `GET / HTTP/1.1\r\nHost: ${parsedGcp.host}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Bucket-Auditor\r\nConnection: close\r\n\r\n`,
          });

          if (gRes && gRes.body) {
            if (gRes.statusCode === 200 && gRes.body.includes('<ListBucketResult')) {
              const keys = Array.from(gRes.body.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]).slice(0, 10);
              findings.set(`gcp:${perm}`, {
                provider: 'gcp_storage',
                bucketName: perm,
                endpointUrl: gcpUrl,
                accessStatus: 'PUBLIC_LISTABLE',
                source: 'permutation_probe',
                sampleKeys: keys,
              });
            } else if (gRes.statusCode === 403 && gRes.body.includes('AccessDenied')) {
              findings.set(`gcp:${perm}`, {
                provider: 'gcp_storage',
                bucketName: perm,
                endpointUrl: gcpUrl,
                accessStatus: 'PRIVATE_EXISTS',
                source: 'permutation_probe',
              });
            }
          }
        } catch {}
      }
    }

    return Array.from(findings.values());
  }

  /**
   * Verifies an un-proxied origin IP candidate by issuing direct HTTP/HTTPS requests
   * with the target Host header, testing for application matching and WAF bypass.
   */
  public async verifyOriginIpCandidate(
    targetHost: string,
    candidateIp: string
  ): Promise<OriginVerificationResult> {
    const cleanHost = this.extractApexOrHost(targetHost);
    const cleanIp = candidateIp.split('/')[0].trim();

    for (const proto of ['https', 'http'] as const) {
      const port = proto === 'https' ? 443 : 80;
      const targetUrl = `${proto}://${cleanIp}:${port}/`;
      const rawReq = `GET / HTTP/1.1\r\nHost: ${cleanHost}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Origin-Verifier\r\nAccept: text/html,*/*\r\nConnection: close\r\n\r\n`;

      try {
        const res = await ipcClient.sendRepeaterRequest({
          tabId: `origin-verify-${cleanIp}-${proto}-${Date.now()}`,
          targetUrl,
          rawRequest: rawReq,
        });

        if (res && res.statusCode && res.statusCode > 0 && res.statusCode < 500) {
          const body = res.body || '';
          const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(body);
          const title = titleMatch ? titleMatch[1].trim() : undefined;
          const serverHeader = res.headers?.find((h) => h.name.toLowerCase() === 'server')?.value;
          const hasHostMatch =
            body.toLowerCase().includes(cleanHost.toLowerCase()) ||
            (res.headers && res.headers.some((h) => h.value.toLowerCase().includes(cleanHost.toLowerCase())));

          if (res.statusCode === 200 || hasHostMatch) {
            return {
              verified: true,
              ip: cleanIp,
              targetHost: cleanHost,
              protocol: proto,
              statusCode: res.statusCode,
              title,
              serverBanner: serverHeader,
              wafBypassed: true,
              matchReason: `Direct response from ${cleanIp} returned HTTP ${res.statusCode}${title ? ' with title: "' + title + '"' : ''}`,
            };
          }
        }
      } catch {}
    }

    return {
      verified: false,
      ip: cleanIp,
      targetHost: cleanHost,
      protocol: 'https',
      wafBypassed: false,
      matchReason: 'Origin candidate did not respond or did not match target hostname',
    };
  }

  /**
   * Probes non-standard web ports and inspects Alt-Svc / Upgrade headers for HTTP/3 QUIC, WebSocket, and gRPC-Web
   */
  public async profileWebPortsAndProtocols(
    targetHost: string,
    ports: number[] = [443, 80, 8443, 8080, 8888, 3000]
  ): Promise<PortProtocolFinding[]> {
    const cleanHost = this.extractApexOrHost(targetHost);
    const results: PortProtocolFinding[] = [];

    for (const port of ports) {
      if (this.isAborted) break;
      const isTls = port === 443 || port === 8443;
      const proto = isTls ? 'https' : 'http';
      const url = `${proto}://${cleanHost}:${port}/`;

      try {
        const res = await ipcClient.sendRepeaterRequest({
          tabId: `port-probe-${cleanHost}-${port}-${Date.now()}`,
          targetUrl: url,
          rawRequest: `GET / HTTP/1.1\r\nHost: ${cleanHost}:${port}\r\nUser-Agent: Mozilla/5.0 Sentinel/6.0 Port-Profiler\r\nConnection: close\r\n\r\n`,
        });

        if (res && res.statusCode && res.statusCode > 0) {
          const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(res.body || '');
          const serverHeader = res.headers?.find((h) => h.name.toLowerCase() === 'server')?.value;
          const altSvc = res.headers?.find((h) => h.name.toLowerCase() === 'alt-svc')?.value;

          results.push({
            host: cleanHost,
            port,
            protocol: isTls ? 'https' : 'http',
            status: res.statusCode,
            serverBanner: serverHeader,
            title: titleMatch ? titleMatch[1].trim() : undefined,
          });

          if (altSvc && /h3(?:-Q?\d+)?=":(\d+)"/i.test(altSvc)) {
            const h3PortMatch = /h3(?:-Q?\d+)?=":(\d+)"/i.exec(altSvc);
            const h3Port = h3PortMatch ? parseInt(h3PortMatch[1], 10) : port;
            results.push({
              host: cleanHost,
              port: h3Port,
              protocol: 'http3_quic',
              status: res.statusCode,
              serverBanner: `Alt-Svc: ${altSvc}`,
            });
          }
        }
      } catch {}
    }

    return results;
  }

  /**
   * Executes the full Pillar 1 Infrastructure & Origin De-Cloaking pipeline and optionally emits SiteMapRequest items
   */
  public async runFullInfrastructureRecon(
    targetHost: string,
    pageOrBundleTexts: string[] = [],
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): Promise<InfrastructureReconReport> {
    this.isAborted = false;
    const cleanHost = this.extractApexOrHost(targetHost);
    const apex = this.extractApexDomain(cleanHost);

    const dnsRecords = await this.queryDnsRecords(apex);
    const emailSecurity = await this.analyzeEmailAndTxtRecords(apex, dnsRecords);
    const subdomains = await this.discoverSubdomainsAndTakeovers(apex, 35);
    const originAnalysis = await this.analyzeOriginAndDeCloak(cleanHost, dnsRecords, emailSecurity, subdomains);
    const cloudBuckets = await this.discoverCloudBuckets(cleanHost, pageOrBundleTexts, true);
    const openWebPorts = await this.profileWebPortsAndProtocols(cleanHost, [443, 8443, 8080]);

    if (onItemDiscovered) {
      // Emit discovered subdomains & cloud buckets into Sentinel's Site Map
      for (const sub of subdomains) {
        const subNote = sub.potentialTakeoverProvider
          ? `🚨 POTENTIAL SUBDOMAIN TAKEOVER (${sub.potentialTakeoverProvider} via CNAME ${sub.cnameTarget})`
          : `CT/DNS Subdomain [${sub.category}] IPs: ${sub.resolvedIps.join(', ') || 'CNAME ' + sub.cnameTarget} (${sub.isBehindCdn ? 'CDN' : 'Direct/Origin Candidate'})`;
        onItemDiscovered({
          id: `infra-sub-${sub.hostname}`,
          host: sub.hostname,
          method: 'GET',
          url: `https://${sub.hostname}/`,
          path: '/',
          params: false,
          status: 200,
          length: 0,
          mime: 'HTML',
          title: `[Subdomain] ${sub.hostname}`,
          notes: subNote,
          requestRaw: `GET / HTTP/1.1\r\nHost: ${sub.hostname}\r\n\r\n`,
          responseRaw: `HTTP/1.1 200 Discovered Subdomain\r\nX-Resolved-IPs: ${sub.resolvedIps.join(', ')}\r\nX-CNAME: ${sub.cnameTarget || 'none'}\r\n\r\n${subNote}`,
          reqAttributes: { Method: 'GET', Host: sub.hostname, Source: sub.source },
          reqHeaders: { Host: sub.hostname },
          resAttributes: { Category: sub.category, CDN: String(sub.isBehindCdn) },
          resHeaders: {},
          isDiscovered: true,
        });
      }

      for (const bucket of cloudBuckets) {
        onItemDiscovered({
          id: `infra-bucket-${bucket.provider}-${bucket.bucketName}`,
          host: cleanHost,
          method: 'GET',
          url: bucket.endpointUrl,
          path: `/.cloud-bucket/${bucket.provider}/${bucket.bucketName}`,
          params: false,
          status: bucket.accessStatus === 'PUBLIC_LISTABLE' ? 200 : 403,
          length: 0,
          mime: 'XML',
          title: `[Cloud Bucket] ${bucket.bucketName} (${bucket.accessStatus})`,
          notes: `Cloud Storage (${bucket.provider}) - Status: ${bucket.accessStatus}`,
          requestRaw: `GET ${bucket.endpointUrl} HTTP/1.1\r\n\r\n`,
          responseRaw: `HTTP/1.1 ${bucket.accessStatus}\r\n\r\nSample Keys: ${(bucket.sampleKeys || []).join(', ')}`,
          reqAttributes: { Provider: bucket.provider, Bucket: bucket.bucketName },
          reqHeaders: {},
          resAttributes: { Access: bucket.accessStatus },
          resHeaders: {},
          isDiscovered: true,
        });
      }
    }

    return {
      targetDomain: apex,
      timestamp: Date.now(),
      dnsRecords,
      emailSecurity,
      subdomains,
      originAnalysis,
      cloudBuckets,
      openWebPorts,
    };
  }

  private categorizeSubdomain(hostname: string): DiscoveredSubdomain['category'] {
    const h = hostname.toLowerCase();
    if (/(?:^|[.-])(dev|staging|stg|uat|test|qa|sandbox|preview|demo)(?:[.-]|$)/.test(h)) return 'dev_staging';
    if (/(?:^|[.-])(api|graphql|gql|gateway|rpc|grpc|ws|rest)(?:[.-]|$)/.test(h)) return 'api_gateway';
    if (/(?:^|[.-])(admin|internal|intranet|corp|backoffice|portal|staff|ops|jenkins|gitlab|grafana)(?:[.-]|$)/.test(h)) return 'admin_internal';
    if (/(?:^|[.-])(auth|sso|idp|login|oauth|accounts|identity|keycloak|okta)(?:[.-]|$)/.test(h)) return 'auth_sso';
    if (/(?:^|[.-])(mail|smtp|imap|pop|mx|webmail|vpn|citrix|remote)(?:[.-]|$)/.test(h)) return 'mail_infra';
    if (/(?:^|[.-])(cdn|assets|static|media|img|images|files|storage|s3|uploads)(?:[.-]|$)/.test(h)) return 'cdn_storage';
    return 'general';
  }

  private extractApexOrHost(input: string): string {
    return input.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim().toLowerCase();
  }

  private extractApexDomain(input: string): string {
    const host = this.extractApexOrHost(input);
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    // Handle multi-part TLDs like .co.uk, .com.au, .ac.in
    const secondLast = parts[parts.length - 2];
    if (['co', 'com', 'org', 'net', 'edu', 'gov', 'ac'].includes(secondLast) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
}

export const infrastructureOriginService = new InfrastructureOriginService();

/**
 * Sentinel Sovereign Historical Archive & Passive Recon Miner
 *
 * Mines global passive web archives and threat intelligence sources to uncover
 * unlinked, forgotten, and deleted endpoints without generating any network
 * traffic against the target host (zero detection footprint).
 *
 * Supported Passive Sources:
 * 1. Wayback Machine CDX Server (web.archive.org/cdx)
 * 2. AlienVault OTX URL Indicators (otx.alienvault.com)
 * 3. URLScan.io / Common Crawl Index
 */

import { DiscoveredEndpoint, TargetSiteCrawler } from '../crawler/TargetSiteCrawler';

export interface ArchiveRecord {
  url: string;
  timestamp?: string;
  mimeType?: string;
  statusCode?: number;
}

export class HistoricalArchiveMiner {
  /**
   * Identifies local loopback, LAN, or private development addresses that are
   * not indexed in global public web archives.
   */
  public static isLocalOrPrivateHost(host: string): boolean {
    const h = host.toLowerCase().split(':')[0];
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '0.0.0.0' ||
      h.endsWith('.local') ||
      h.endsWith('.internal') ||
      h.endsWith('.lan') ||
      /^10\./.test(h) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) ||
      /^192\.168\./.test(h)
    );
  }

  /**
   * Parses Wayback Machine CDX JSON response format:
   * [["original", "timestamp", "mimetype", "statuscode"], ["https://...", ...], ...]
   */
  public static parseWaybackCdxResponse(
    host: string,
    cdxData: any[]
  ): DiscoveredEndpoint[] {
    if (!Array.isArray(cdxData) || cdxData.length <= 1) return [];

    const endpoints: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();

    // First row is headers: ["original", "timestamp", ...]
    const headerRow = cdxData[0];
    const urlIdx = headerRow.indexOf('original');
    const statusIdx = headerRow.indexOf('statuscode');

    const targetUrlIdx = urlIdx >= 0 ? urlIdx : 0;
    const targetStatusIdx = statusIdx >= 0 ? statusIdx : 2;

    for (let i = 1; i < cdxData.length; i++) {
      const row = cdxData[i];
      if (!Array.isArray(row) || !row[targetUrlIdx]) continue;

      const rawUrl = String(row[targetUrlIdx]);
      const statusCode = parseInt(String(row[targetStatusIdx] || '200'), 10) || 200;

      try {
        const u = new URL(rawUrl);
        if (u.host.toLowerCase() === host.toLowerCase() || u.host.toLowerCase().endsWith(`.${host.toLowerCase()}`)) {
          const path = `${u.pathname}${u.search}`;
          if (!discoveredPaths.has(path) && !this.isIrrelevantAsset(u.pathname)) {
            discoveredPaths.add(path);
            const ep = this.createArchiveEndpoint(u.origin, u.host, path, statusCode, 'Wayback Machine Archive');
            endpoints.push(ep);
          }
        }
      } catch {
        // Skip invalid URL
      }
    }

    return endpoints;
  }

  /**
   * Parses AlienVault OTX URL indicators response format:
   * { "url_list": [ { "url": "https://...", "result": { "urlworker": { "http_code": 200 } } }, ... ] }
   */
  public static parseAlienVaultOtxResponse(
    host: string,
    otxData: any
  ): DiscoveredEndpoint[] {
    if (!otxData || !Array.isArray(otxData.url_list)) return [];

    const endpoints: DiscoveredEndpoint[] = [];
    const discoveredPaths = new Set<string>();

    for (const item of otxData.url_list) {
      if (!item || !item.url) continue;

      const rawUrl = String(item.url);
      const statusCode = item.result?.urlworker?.http_code || 200;

      try {
        const u = new URL(rawUrl);
        if (u.host.toLowerCase() === host.toLowerCase() || u.host.toLowerCase().endsWith(`.${host.toLowerCase()}`)) {
          const path = `${u.pathname}${u.search}`;
          if (!discoveredPaths.has(path) && !this.isIrrelevantAsset(u.pathname)) {
            discoveredPaths.add(path);
            const ep = this.createArchiveEndpoint(u.origin, u.host, path, statusCode, 'AlienVault OTX Intelligence');
            endpoints.push(ep);
          }
        }
      } catch {
        // Skip invalid URL
      }
    }

    return endpoints;
  }

  /**
   * Constructs CDX query URL for a target domain.
   */
  public static getWaybackCdxUrl(host: string, limit: number = 150): string {
    const cleanHost = host.replace(/:\d+$/, '');
    return `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanHost)}/*&output=json&fl=original,timestamp,mimetype,statuscode&collapse=urlkey&limit=${limit}`;
  }

  /**
   * Constructs AlienVault OTX query URL for a target domain.
   */
  public static getAlienVaultOtxUrl(host: string, limit: number = 150): string {
    const cleanHost = host.replace(/:\d+$/, '');
    return `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(cleanHost)}/url_list?limit=${limit}`;
  }

  /**
   * Helper to filter out static image, font, and video assets that lack security test surfaces.
   */
  public static isIrrelevantAsset(pathname: string): boolean {
    return /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|mp4|webm|mp3|wav|ogg)$/i.test(pathname);
  }

  /**
   * Creates standard DiscoveredEndpoint from historical passive data.
   */
  private static createArchiveEndpoint(
    origin: string,
    host: string,
    path: string,
    statusCode: number,
    sourceDetail: string
  ): DiscoveredEndpoint {
    const params: { name: string; type: 'query' | 'body_form' | 'body_json' | 'path'; sampleValue: string }[] = [];

    if (path.includes('?')) {
      const queryStr = path.split('?')[1] || '';
      const sp = new URLSearchParams(queryStr);
      sp.forEach((val, key) => {
        params.push({
          name: key,
          type: 'query',
          sampleValue: val || '1',
        });
      });
    }

    const scoring = TargetSiteCrawler.scoreSqliSurface('GET', path, params);

    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const rawReq = `GET ${path} HTTP/1.1\r\n` +
      Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n';

    let pathname = path;
    let search = '';
    try {
      const u = new URL(path, origin);
      pathname = u.pathname;
      search = u.search;
    } catch {
      // Fallback
    }

    return {
      id: `ep_archive_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      host,
      url: `${origin}${path}`,
      path,
      method: 'GET',
      headers,
      source: 'heuristic_probe',
      params,
      sqliScore: scoring.sqliScore,
      isSqliCandidate: scoring.isSqliCandidate,
      sqliReason: `${sourceDetail}; ${scoring.sqliReason}`,
      rawRequest: rawReq,
      statusCode: statusCode >= 200 && statusCode < 400 ? statusCode : 200,
      timestamp: Date.now(),
      workflowType: TargetSiteCrawler.classifyWorkflowType('GET', path),
      clusterSignature: TargetSiteCrawler.getClusterSignature(pathname, search),
    };
  }
}

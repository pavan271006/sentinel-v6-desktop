/**
 * Sentinel V6 - GAU (GetAllUrls) Archive URL Mining Service
 *
 * Modeled after lc/gau (github.com/lc/gau).
 * Concurrently queries historical public web archives to discover forgotten,
 * deprecated, or unlinked endpoints and parameter schemas:
 * - Wayback Machine (Internet Archive CDX API)
 * - AlienVault OTX (Open Threat Exchange Indicators API)
 * - URLScan.io Public Search API
 */

import { ipcClient } from '../../ipc/client';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';

export interface GauDiscoveredUrl {
  url: string;
  host: string;
  path: string;
  params: boolean;
  source: 'wayback' | 'alienvault' | 'urlscan';
  timestamp?: string;
}

export interface GauMiningConfig {
  targetDomain: string;
  includeSubdomains?: boolean;
  limit?: number;
  onProgress?: (count: number, currentSource: string) => void;
  onItemDiscovered?: (item: SiteMapRequest) => void;
}

export class GauArchiveService {
  private isAborted = false;

  public abort(): void {
    this.isAborted = true;
  }

  /**
   * Cleans and extracts path & params from raw archive URL
   */
  private parseArchiveUrl(rawUrl: string, targetDomain: string): GauDiscoveredUrl | null {
    try {
      let u = rawUrl.trim();
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = `https://${u}`;
      }
      const parsed = new URL(u);

      // Verify domain / subdomain scope
      const host = parsed.hostname.toLowerCase();
      const domainLower = targetDomain.toLowerCase();
      if (host !== domainLower && !host.endsWith(`.${domainLower}`)) {
        return null;
      }

      // Filter out static media noise to prioritize valuable application endpoints
      const staticExtRegex = /\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot|mp4|webm|avi|mp3|wav|css)$/i;
      if (staticExtRegex.test(parsed.pathname)) {
        return null;
      }

      const path = `${parsed.pathname}${parsed.search}`;
      return {
        url: parsed.href,
        host,
        path: path.startsWith('/') ? path : `/${path}`,
        params: parsed.search.length > 1,
        source: 'wayback',
      };
    } catch {
      return null;
    }
  }

  /**
   * 1. Query Wayback Machine CDX API
   */
  private async fetchWaybackUrls(domain: string, includeSubdomains: boolean, limit: number): Promise<GauDiscoveredUrl[]> {
    const urlPattern = includeSubdomains ? `*.${domain}/*` : `${domain}/*`;
    const apiUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(urlPattern)}&output=json&fl=original,timestamp&collapse=urlkey&limit=${limit}`;

    try {
      const rawReq = `GET /cdx/search/cdx?url=${encodeURIComponent(urlPattern)}&output=json&fl=original,timestamp&collapse=urlkey&limit=${limit} HTTP/1.1\r\nHost: web.archive.org\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 GAU-Miner\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;

      const res = await ipcClient.sendRepeaterRequest({
        tabId: `gau-wayback-${Date.now()}`,
        targetUrl: apiUrl,
        rawRequest: rawReq,
      });

      if (!res?.body) return [];

      let data: any;
      try {
        data = JSON.parse(res.body);
      } catch {
        const bodyPart = res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        data = JSON.parse(bodyPart);
      }

      if (!Array.isArray(data) || data.length < 2) return [];

      // The first element is header row: ["original", "timestamp"]
      const results: GauDiscoveredUrl[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (Array.isArray(row) && row[0]) {
          const parsed = this.parseArchiveUrl(row[0], domain);
          if (parsed) {
            parsed.source = 'wayback';
            parsed.timestamp = row[1];
            results.push(parsed);
          }
        }
      }
      return results;
    } catch (err) {
      console.warn('GAU: Wayback fetch failed or throttled:', err);
      return [];
    }
  }

  /**
   * 2. Query AlienVault OTX API
   */
  private async fetchAlienVaultUrls(domain: string, limit: number): Promise<GauDiscoveredUrl[]> {
    const apiUrl = `https://otx.alienvault.com/api/v1/indicators/domain/${domain}/url_list?limit=${limit}`;

    try {
      const rawReq = `GET /api/v1/indicators/domain/${domain}/url_list?limit=${limit} HTTP/1.1\r\nHost: otx.alienvault.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 GAU-Miner\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;

      const res = await ipcClient.sendRepeaterRequest({
        tabId: `gau-otx-${Date.now()}`,
        targetUrl: apiUrl,
        rawRequest: rawReq,
      });

      if (!res?.body) return [];

      let data: any;
      try {
        data = JSON.parse(res.body);
      } catch {
        const bodyPart = res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        data = JSON.parse(bodyPart);
      }

      if (!data?.url_list || !Array.isArray(data.url_list)) return [];

      const results: GauDiscoveredUrl[] = [];
      for (const item of data.url_list) {
        if (item?.url) {
          const parsed = this.parseArchiveUrl(item.url, domain);
          if (parsed) {
            parsed.source = 'alienvault';
            results.push(parsed);
          }
        }
      }
      return results;
    } catch (err) {
      console.warn('GAU: AlienVault fetch failed or throttled:', err);
      return [];
    }
  }

  /**
   * 3. Query URLScan.io Search API
   */
  private async fetchUrlScanUrls(domain: string): Promise<GauDiscoveredUrl[]> {
    const apiUrl = `https://urlscan.io/api/v1/search/?q=domain:${domain}&size=100`;

    try {
      const rawReq = `GET /api/v1/search/?q=domain:${domain}&size=100 HTTP/1.1\r\nHost: urlscan.io\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 GAU-Miner\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;

      const res = await ipcClient.sendRepeaterRequest({
        tabId: `gau-urlscan-${Date.now()}`,
        targetUrl: apiUrl,
        rawRequest: rawReq,
      });

      if (!res?.body) return [];

      let data: any;
      try {
        data = JSON.parse(res.body);
      } catch {
        const bodyPart = res.rawResponse?.split(/\r?\n\r?\n/)[1] || '';
        data = JSON.parse(bodyPart);
      }

      if (!data?.results || !Array.isArray(data.results)) return [];

      const results: GauDiscoveredUrl[] = [];
      for (const item of data.results) {
        const targetUrl = item?.page?.url;
        if (targetUrl) {
          const parsed = this.parseArchiveUrl(targetUrl, domain);
          if (parsed) {
            parsed.source = 'urlscan';
            results.push(parsed);
          }
        }
      }
      return results;
    } catch (err) {
      console.warn('GAU: URLScan fetch failed or throttled:', err);
      return [];
    }
  }

  /**
   * Main Execution: Queries all archive engines concurrently and streams discovered endpoints
   */
  public async runGauMining(config: GauMiningConfig): Promise<SiteMapRequest[]> {
    this.isAborted = false;
    const { targetDomain, includeSubdomains = true, limit = 500, onProgress, onItemDiscovered } = config;

    // Clean domain
    const cleanDomain = targetDomain.replace(/^https?:\/\//i, '').replace(/:\d+$/, '').split('/')[0].trim();
    if (!cleanDomain) return [];

    const discoveredMap = new Map<string, SiteMapRequest>();
    let totalCount = 0;

    const pushItem = (item: GauDiscoveredUrl) => {
      const key = `GET:${item.host}${item.path}`;
      if (!discoveredMap.has(key)) {
        const sourceLabel = item.source === 'wayback' ? 'Wayback Machine' : item.source === 'alienvault' ? 'AlienVault OTX' : 'URLScan.io';
        const sitemapItem: SiteMapRequest = {
          id: `gau-${item.source}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          host: item.host,
          method: 'GET',
          url: item.path,
          path: item.path,
          params: item.params,
          status: 0,
          length: 0,
          mime: item.path.includes('.json') ? 'JSON' : item.path.includes('.js') ? 'script' : 'HTML',
          title: item.path,
          notes: `Historical Archive URL from ${sourceLabel} (Unverified on live server)`,
          requestRaw: `GET ${item.path} HTTP/1.1\r\nHost: ${item.host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sentinel/6.0 GAU-Miner\r\nAccept: */*\r\n\r\n`,
          responseRaw: `HTTP/1.1 (Historical Archive Record)\r\nX-Archive-Source: ${sourceLabel}\r\n\r\nHistorical record from ${sourceLabel}. Click 'Request this item' to test if this endpoint is still live on the server.`,
          reqAttributes: { Method: 'GET', Path: item.path, Source: sourceLabel },
          reqHeaders: { Host: item.host },
          resAttributes: { Status: 'Archived', Source: sourceLabel },
          resHeaders: {},
          isDiscovered: true,
        };

        discoveredMap.set(key, sitemapItem);
        totalCount++;

        if (onProgress) onProgress(totalCount, item.source);
        if (onItemDiscovered) onItemDiscovered(sitemapItem);
      }
    };

    if (onProgress) onProgress(0, 'Querying Web Archives...');

    // Concurrently fetch from Wayback, AlienVault OTX, and URLScan
    const [waybackResults, alienvaultResults, urlscanResults] = await Promise.all([
      this.fetchWaybackUrls(cleanDomain, includeSubdomains, limit),
      this.fetchAlienVaultUrls(cleanDomain, limit),
      this.fetchUrlScanUrls(cleanDomain),
    ]);

    for (const item of [...waybackResults, ...alienvaultResults, ...urlscanResults]) {
      if (this.isAborted) break;
      pushItem(item);
    }

    return Array.from(discoveredMap.values());
  }
}

export const gauArchiveService = new GauArchiveService();

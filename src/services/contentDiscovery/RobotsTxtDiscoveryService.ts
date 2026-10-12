/**
 * Sentinel Sovereign Ω - Robots.txt & Comprehensive XML Sitemap Discovery Service
 *
 * Fetches and deeply parses `/robots.txt` and XML sitemaps to uncover:
 * 1. Hidden Disallowed Endpoints (frequently admin consoles, internal APIs, debug routes)
 * 2. Complete XML Sitemaps & Recursive Sitemap Index catalogs
 * 3. Crawl-delay recommendations from edge servers
 */

import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';

export interface RobotsTxtResult {
  disallowedPaths: string[];
  allowedPaths: string[];
  sitemaps: string[];
  sitemapUrls: string[];
  crawlDelay?: number;
}

export class RobotsTxtDiscoveryService {
  /**
   * Fetches and parses /robots.txt as well as all discovered/common XML sitemaps
   */
  public async fetchAndParseRobotsTxt(targetUrl: string): Promise<RobotsTxtResult> {
    const result: RobotsTxtResult = {
      disallowedPaths: [],
      allowedPaths: [],
      sitemaps: [],
      sitemapUrls: []
    };

    try {
      const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const baseUrl = `${u.protocol}//${u.host}`;
      const robotsUrl = `${baseUrl}/robots.txt`;

      let content: string | null = null;
      try {
        content = await stealthCdpBrowserDriver.fetchInBrowser(robotsUrl);
      } catch {
        content = null;
      }

      if (content && !content.includes('<html') && !content.includes('<!DOCTYPE')) {
        const lines = content.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('#') || !line.includes(':')) continue;

          const [key, ...vals] = line.split(':');
          const val = vals.join(':').trim();
          const lowerKey = key.trim().toLowerCase();

          if (lowerKey === 'disallow' && val) {
            result.disallowedPaths.push(val);
          } else if (lowerKey === 'allow' && val) {
            result.allowedPaths.push(val);
          } else if (lowerKey === 'sitemap' && val) {
            result.sitemaps.push(val);
          } else if (lowerKey === 'crawl-delay' && val) {
            const delay = parseFloat(val);
            if (!isNaN(delay)) result.crawlDelay = delay;
          }
        }
      }

      // 2. Comprehensive XML Sitemap Dredging
      const sitemapQueue: string[] = [...result.sitemaps];
      // If no sitemaps listed in robots.txt, probe the standard top-level locations
      if (sitemapQueue.length === 0) {
        sitemapQueue.push(
          `${baseUrl}/sitemap.xml`,
          `${baseUrl}/sitemap_index.xml`,
          `${baseUrl}/sitemap-main.xml`,
          `${baseUrl}/wp-sitemap.xml`
        );
      }

      const visitedSitemaps = new Set<string>();
      const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
      const seenUrls = new Set<string>();

      while (sitemapQueue.length > 0 && visitedSitemaps.size < 12) {
        const smUrl = sitemapQueue.shift()!;
        if (visitedSitemaps.has(smUrl)) continue;
        visitedSitemaps.add(smUrl);

        try {
          const smContent = await stealthCdpBrowserDriver.fetchInBrowser(smUrl);
          if (!smContent || smContent.length < 20 || smContent.includes('404 Not Found') || smContent.includes('Cannot GET')) {
            continue;
          }

          let m;
          while ((m = locRegex.exec(smContent)) !== null) {
            const loc = m[1].trim();
            if (loc.endsWith('.xml') || loc.includes('sitemap')) {
              // It's a nested sitemap index! Queue child sitemap
              if (!visitedSitemaps.has(loc) && sitemapQueue.length < 25) {
                sitemapQueue.push(loc);
              }
            } else {
              // It's a production endpoint URL!
              if (!seenUrls.has(loc) && seenUrls.size < 500) {
                seenUrls.add(loc);
                result.sitemapUrls.push(loc);
              }
            }
          }
        } catch {}
      }
    } catch {}

    return result;
  }

  /**
   * Converts discovered robots.txt disallowed paths & sitemap URLs into SiteMapRequest objects
   */
  public generateSiteMapEntries(
    targetHost: string,
    robotsResult: RobotsTxtResult,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): SiteMapRequest[] {
    const items: SiteMapRequest[] = [];
    const cleanHost = targetHost.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    // 1. Disallowed High-Value Target Endpoints
    robotsResult.disallowedPaths.forEach((path) => {
      if (!path || path === '/' || path.includes('*')) return;
      const cleanPath = path.startsWith('/') ? path : '/' + path;

      const item: SiteMapRequest = {
        id: `robots-disallow-${cleanHost}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        host: cleanHost,
        method: 'GET',
        url: cleanPath,
        path: cleanPath,
        params: cleanPath.includes('?'),
        status: 0,
        length: 0,
        mime: 'endpoint',
        title: `Disallowed: ${cleanPath}`,
        notes: 'Discovered in /robots.txt Disallow directive (High Value Target)',
        requestRaw: `GET ${cleanPath} HTTP/1.1\r\nHost: ${cleanHost}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
        responseRaw: 'HTTP/1.1 (Not requested yet - found in /robots.txt)',
        reqAttributes: { Method: 'GET', Path: cleanPath, Source: 'robots.txt' },
        reqHeaders: { Host: cleanHost },
        resAttributes: { Status: 'Discovered', Source: 'robots.txt' },
        resHeaders: {},
        isDiscovered: true,
      };

      items.push(item);
      if (onItemDiscovered) onItemDiscovered(item);
    });

    // 2. Verified XML Sitemap Live URLs
    (robotsResult.sitemapUrls || []).forEach((fullUrl) => {
      try {
        const u = new URL(fullUrl);
        const cleanPath = u.pathname + u.search;
        const item: SiteMapRequest = {
          id: `sitemap-xml-${cleanHost}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
          host: u.host || cleanHost,
          method: 'GET',
          url: cleanPath,
          path: cleanPath,
          params: u.search.length > 0,
          status: 0,
          length: 0,
          mime: cleanPath.endsWith('.json') ? 'JSON' : 'HTML',
          title: cleanPath,
          notes: 'Discovered in authoritative XML Sitemap index',
          requestRaw: `GET ${cleanPath} HTTP/1.1\r\nHost: ${u.host || cleanHost}\r\nUser-Agent: Mozilla/5.0\r\n\r\n`,
          responseRaw: 'HTTP/1.1 (Not requested yet - found in XML Sitemap)',
          reqAttributes: { Method: 'GET', Path: cleanPath, Source: 'XML-Sitemap' },
          reqHeaders: { Host: u.host || cleanHost },
          resAttributes: { Status: 'Discovered', Source: 'XML-Sitemap' },
          resHeaders: {},
          isDiscovered: true,
        };

        items.push(item);
        if (onItemDiscovered) onItemDiscovered(item);
      } catch {}
    });

    return items;
  }
}

export const robotsTxtDiscoveryService = new RobotsTxtDiscoveryService();

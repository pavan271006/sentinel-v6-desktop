import { describe, it, expect, vi } from 'vitest';
import { TargetSiteCrawler } from './TargetSiteCrawler';
import { ipcClient } from '../../../ipc/client';

describe('TargetSiteCrawler & SQLi Surface Heuristics', () => {
  describe('scoreSqliSurface', () => {
    it('scores high potential for numeric id query parameters', () => {
      const scoring = TargetSiteCrawler.scoreSqliSurface('GET', '/products?id=101', [
        { name: 'id', type: 'query', sampleValue: '101' },
      ]);

      expect(scoring.isSqliCandidate).toBe(true);
      expect(scoring.sqliScore).toBeGreaterThanOrEqual(50);
      expect(scoring.sqliReason).toContain('High-value SQL sink parameter: "id"');
      expect(scoring.sqliReason).toContain('Numeric value');
    });

    it('scores high potential for search/query parameters in database-backed paths', () => {
      const scoring = TargetSiteCrawler.scoreSqliSurface('GET', '/search?q=cybersecurity', [
        { name: 'q', type: 'query', sampleValue: 'cybersecurity' },
      ]);

      expect(scoring.isSqliCandidate).toBe(true);
      expect(scoring.sqliScore).toBeGreaterThanOrEqual(40);
      expect(scoring.sqliReason).toContain('Path indicates database-backed resource');
    });

    it('scores static assets without parameters as zero / non-candidate', () => {
      const scoring = TargetSiteCrawler.scoreSqliSurface('GET', '/static/bundle.min.js', []);
      expect(scoring.sqliScore).toBe(0);
      expect(scoring.isSqliCandidate).toBe(false);
    });

    it('increases score for POST forms with user input fields', () => {
      const scoring = TargetSiteCrawler.scoreSqliSurface('POST', '/login', [
        { name: 'username', type: 'body_form', sampleValue: 'admin' },
        { name: 'password', type: 'body_form', sampleValue: 'secret' },
      ]);

      expect(scoring.isSqliCandidate).toBe(true);
      expect(scoring.sqliScore).toBeGreaterThanOrEqual(40);
      expect(scoring.sqliReason).toContain('POST method');
    });
  });

  describe('scrapeHtmlForEndpoints', () => {
    it('extracts HTML forms and parses input parameters into endpoints', () => {
      const crawler = new TargetSiteCrawler();
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <header><a href="/catalog?cat=5&sort=asc">Products</a></header>
            <main>
              <form action="/search" method="GET">
                <input type="text" name="query" value="database" />
                <input type="hidden" name="limit" value="20" />
                <button type="submit">Search</button>
              </form>
              <form action="/api/v1/auth/login" method="POST">
                <input type="text" name="user" value="" />
                <input type="password" name="pass" value="" />
              </form>
            </main>
          </body>
        </html>
      `;

      const endpoints = crawler.scrapeHtmlForEndpoints('https://target.corp', 'target.corp', mockHtml);

      expect(endpoints.length).toBeGreaterThanOrEqual(2);

      const searchEp = endpoints.find((e) => e.path.includes('/search'));
      expect(searchEp).toBeDefined();
      expect(searchEp?.params.some((p) => p.name === 'query')).toBe(true);
      expect(searchEp?.isSqliCandidate).toBe(true);

      const loginEp = endpoints.find((e) => e.path.includes('/api/v1/auth/login'));
      expect(loginEp).toBeDefined();
      expect(loginEp?.method).toBe('POST');
      expect(loginEp?.params.some((p) => p.name === 'user')).toBe(true);

      const linkEp = endpoints.find((e) => e.path.includes('/catalog'));
      expect(linkEp).toBeDefined();
      expect(linkEp?.params.some((p) => p.name === 'cat')).toBe(true);
    });
  });

  describe('crawlHost', () => {
    it('probes robots.txt, sitemap.xml, and dynamic heuristic paths gracefully', async () => {
      const crawler = new TargetSiteCrawler();

      // Mock ipcClient to return sample robots.txt
      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        if (req.targetUrl.includes('/robots.txt')) {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: {},
            body: 'User-agent: *\nDisallow: /admin/login\nDisallow: /internal/reports?dept=1',
            rawResponse: '',
            sizeBytes: 80,
          } as any;
        }

        if (req.targetUrl.includes('/sitemap.xml')) {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: {},
            body: '<urlset><loc>https://target.corp/store?item_id=45</loc></urlset>',
            rawResponse: '',
            sizeBytes: 100,
          } as any;
        }

        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: '<html><body><a href="/profile?user_id=123">Profile</a></body></html>',
          rawResponse: '',
          sizeBytes: 70,
        } as any;
      });

      const discovered = await crawler.crawlHost('https://target.corp');

      expect(discovered.length).toBeGreaterThan(0);
      const adminEp = discovered.find((d) => d.path.includes('/admin/login'));
      expect(adminEp).toBeDefined();

      const itemEp = discovered.find((d) => d.path.includes('item_id=45'));
      expect(itemEp).toBeDefined();
      expect(itemEp?.isSqliCandidate).toBe(true);
    });
  });
});

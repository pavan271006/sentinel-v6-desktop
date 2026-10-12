import { describe, it, expect } from 'vitest';
import { PathTemplateClusterer } from '../PathTemplateClusterer';
import { SourceMapRouteMiner } from '../SourceMapRouteMiner';
import { SessionLivenessWatchdog } from '../SessionLivenessWatchdog';

describe('Sentinel Frontier Modules (Pillars 2, 5 & 6)', () => {

  // ─── 1. Path Template & Parameter Clustering ────────────────────────────
  describe('PathTemplateClusterer', () => {
    it('accurately collapses numeric IDs, UUIDs, and hashes into structural templates', () => {
      const clusterer = new PathTemplateClusterer(3);

      expect(clusterer.generateTemplate('/api/v1/users/49102/edit')).toBe('/api/v1/users/{id}/edit');
      expect(clusterer.generateTemplate('/items/550e8400-e29b-41d4-a716-446655440000/view')).toBe('/items/{uuid}/view');
      expect(clusterer.generateTemplate('/documents/64b1f28e9a2b5c001f3e4d5a')).toBe('/documents/{hash}');
      expect(clusterer.generateTemplate('/reports/2026-09-30/daily')).toBe('/reports/{date}/daily');
      expect(clusterer.generateTemplate('/ecommerce/product/hoodie-with-logo/')).toBe('/ecommerce/product/{slug}');
      expect(clusterer.generateTemplate('/ecommerce/product/belt/')).toBe('/ecommerce/product/{slug}');
    });

    it('normalizes query parameters and strips tracking artifacts', () => {
      const clusterer = new PathTemplateClusterer(3);

      const q1 = clusterer.normalizeQuery('?utm_source=twitter&category=books&utm_medium=cpc&sort=asc');
      expect(q1).toBe('category=books&sort=asc');

      const q2 = clusterer.normalizeQuery('?page=10&_=' + Date.now());
      expect(q2).toBe('page={id}');
    });

    it('enforces cluster visit governor to prevent state-space explosion', () => {
      const clusterer = new PathTemplateClusterer(3);

      // Template: /product/{id}
      expect(clusterer.shouldCrawlUrl('https://store.local/product/101')).toBe(true);  // Sample 1
      expect(clusterer.shouldCrawlUrl('https://store.local/product/102')).toBe(true);  // Sample 2
      expect(clusterer.shouldCrawlUrl('https://store.local/product/103')).toBe(true);  // Sample 3

      // 4th and subsequent samples of the exact same structural template must be pruned!
      expect(clusterer.shouldCrawlUrl('https://store.local/product/104')).toBe(false); // Pruned
      expect(clusterer.shouldCrawlUrl('https://store.local/product/9999')).toBe(false); // Pruned

      // Different template: /category/{id} must still be crawled
      expect(clusterer.shouldCrawlUrl('https://store.local/category/1')).toBe(true);
    });
  });

  // ─── 2. Source Map & Bundle Route Miner ──────────────────────────────────
  describe('SourceMapRouteMiner', () => {
    it('filters third-party tracking scripts from being probed', async () => {
      const miner = new SourceMapRouteMiner();

      const resultGoogle = await miner.probeAndMineScript('https://www.google-analytics.com/analytics.js', 'target.local');
      expect(resultGoogle).toBeNull();

      const resultFacebook = await miner.probeAndMineScript('https://connect.facebook.net/en_US/fbevents.js', 'target.local');
      expect(resultFacebook).toBeNull();
    });
  });

  // ─── 3. Session Liveness Watchdog ────────────────────────────────────────
  describe('SessionLivenessWatchdog', () => {
    it('initializes in healthy state and resets cleanly', () => {
      const watchdog = new SessionLivenessWatchdog();
      watchdog.reset();
      expect(watchdog).toBeDefined();
    });
  });

  // ─── 4. Cognitive Flow Agent & File Upload Synthesis ──────────────────────
  describe('CognitiveFlowAgent', () => {
    it('synthesizes appropriate values for various semantic categories including file uploads', async () => {
      const { CognitiveFlowAgent } = await import('../CognitiveFlowAgent');
      const agent = new CognitiveFlowAgent();

      const mockContext = {
        pageTitle: 'Document Upload Portal',
        breadcrumbs: ['Home', 'Upload'],
        discoveredIdentifiers: ['210421104001'],
        userTokens: { username: 'testuser' },
        temporal: {
          currentYear: 2026,
          academicYears: ['2025-2026', '2026-2027'],
          formattedToday: '2026-09-30',
          startOfYear: '2026-01-01'
        },
        keywords: ['document', 'certificate']
      };

      // File upload field
      const fileField = {
        selector: '#docUpload',
        id: 'docUpload',
        name: 'document',
        tagName: 'input' as const,
        type: 'file',
        placeholder: 'Upload PDF',
        labelText: 'Upload ID Document',
        ariaLabel: '',
        semanticCategory: 'FILE_UPLOAD' as const,
        required: true,
        currentValue: ''
      };
      expect(agent.synthesizeFieldValue(fileField, mockContext)).toBe('[Synthesized File Payload]');

      // Identifier field
      const idField = {
        selector: '#rollNo',
        id: 'rollNo',
        name: 'rollNo',
        tagName: 'input' as const,
        type: 'text',
        placeholder: '',
        labelText: 'Roll Number',
        ariaLabel: '',
        semanticCategory: 'IDENTIFIER' as const,
        required: true,
        currentValue: ''
      };
      expect(agent.synthesizeFieldValue(idField, mockContext)).toBe('210421104001');

      // Date field
      const dateField = {
        selector: '#startDate',
        id: 'startDate',
        name: 'from_date',
        tagName: 'input' as const,
        type: 'date',
        placeholder: '',
        labelText: 'From Date',
        ariaLabel: '',
        semanticCategory: 'DATE' as const,
        required: true,
        currentValue: ''
      };
      expect(agent.synthesizeFieldValue(dateField, mockContext)).toBe('2026-01-01');
    });
  });

  // ─── 5. StateFlowGraphCrawler Noise Filtering & Response Capture ───────────
  describe('StateFlowGraphCrawler Filtering & Universal Response Capture', () => {
    it('accurately identifies and filters tracking beacons, ad systems, and telemetry endpoints', async () => {
      const { StateFlowGraphCrawler } = await import('../StateFlowGraphCrawler');
      const crawler = new StateFlowGraphCrawler();

      // Telemetry & Beacon endpoints (must be blocked)
      expect(crawler.isTelemetryOrNoiseUrl('https://fls-eu.amazon.in/1/batch/1/OE/')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('https://completion.amazon.in/api/2017/suggestions')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('https://c.amazon-adsystem.com/aax2/apstag.js')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('https://1.aerith.flipkart.com/telemetry/log')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('https://target.com/1/events/beacon')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('https://target.com/rum/metrics')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('https://www.google-analytics.com/collect?v=2')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('javascript:void(0)')).toBe(true);
      expect(crawler.isTelemetryOrNoiseUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);

      // Authentic application pages & API endpoints (must NOT be blocked)
      expect(crawler.isTelemetryOrNoiseUrl('https://www.amazon.in/Baby/b/?ie=UTF8&node=1571274031')).toBe(false);
      expect(crawler.isTelemetryOrNoiseUrl('https://www.flipkart.com/mobiles-store')).toBe(false);
      expect(crawler.isTelemetryOrNoiseUrl('https://scrapingcourse.com/ecommerce/product/hoodie/')).toBe(false);
      expect(crawler.isTelemetryOrNoiseUrl('https://college.edu/api/v1/students')).toBe(false);
    });

    it('canonicalizes URLs by stripping dynamic tracking tokens, sorting params, and eliminating loops', async () => {
      const { StateFlowGraphCrawler } = await import('../StateFlowGraphCrawler');
      const crawler = new StateFlowGraphCrawler();

      // Amazon tracking parameter stripping
      const amz1 = 'https://www.amazon.in/Baby/b/?ie=UTF8&node=1571274031&ref_=nav_cs_baby';
      const amz2 = 'https://www.amazon.in/Baby/b/?node=1571274031&ref_=nav_cs_baby_123&ie=UTF8';
      expect(crawler.canonicalizeUrl(amz1)).toBe('https://www.amazon.in/Baby/b?ie=UTF8&node=1571274031');
      expect(crawler.canonicalizeUrl(amz2)).toBe('https://www.amazon.in/Baby/b?ie=UTF8&node=1571274031');

      // Flipkart tracking parameter stripping
      const flp = 'https://www.flipkart.com/product/item123/?otracker=search&marketplace=FLIPKART&color=blue';
      expect(crawler.canonicalizeUrl(flp)).toBe('https://www.flipkart.com/product/item123?color=blue');

      // UTM & Google Ads parameter stripping
      const utm = 'https://example.com/shop?utm_source=fb&gclid=xyz123&item=shoes&utm_medium=cpc';
      expect(crawler.canonicalizeUrl(utm)).toBe('https://example.com/shop?item=shoes');
    });

    it('captures full HTML response and sets status 200 for visited pages so Render tab displays real content', async () => {
      const { StateFlowGraphCrawler } = await import('../StateFlowGraphCrawler');
      const crawler = new StateFlowGraphCrawler();

      const mockCtx: any = {
        targetHost: 'www.amazon.in',
        onItemDiscovered: () => {},
      };

      const testUrl = 'https://www.amazon.in/Baby/b';
      const liveHtml = '<!DOCTYPE html><html><head><title>Baby Store</title></head><body><h1>Baby Products</h1></body></html>';

      crawler.updateOrRegisterVisitedPage(testUrl, testUrl, 'Baby Store: Shop Baby Products', liveHtml, mockCtx);

      // Verify item was created with status 200, HTML mime, and authentic live responseRaw
      const map = (crawler as any).discoveredItemsMap;
      const item = map.get('GET:www.amazon.in/Baby/b');

      expect(item).toBeDefined();
      expect(item.status).toBe(200);
      expect(item.mime).toBe('HTML');
      expect(item.title).toBe('Baby Store: Shop Baby Products');
      expect(item.responseRaw).toContain('HTTP/1.1 200 OK');
      expect(item.responseRaw).toContain('Content-Type: text/html');
      expect(item.responseRaw).toContain('<h1>Baby Products</h1>');
      expect(item.responseRaw).not.toContain('Unrequested');
    });
  });
});

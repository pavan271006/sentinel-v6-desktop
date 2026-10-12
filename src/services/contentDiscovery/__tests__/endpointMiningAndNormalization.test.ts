/**
 * Sentinel Sovereign Ω - Milestone 1 Test Suite
 * src/services/contentDiscovery/__tests__/endpointMiningAndNormalization.test.ts
 *
 * Exhaustive unit and integration test coverage for:
 * 1. Absolute Endpoint Normalization (WHATWG URL canonical resolution, base URLs, dot segments)
 * 2. SPA Hash Route Conversion (/#/, #!/) and anchor filtering (#top)
 * 3. Marketing & Ad-Tracking Parameter Stripping across all major ad networks
 * 4. Deterministic Lexicographical Query Key-Sorting & Value Normalization
 * 5. Dynamic RESTful Parameter Clustering (UUIDs, Numeric IDs, Hashes, Tokens, Dates, Slugs)
 * 6. Cluster Sampling Governor & Quota Management
 * 7. PathTemplateClusterer Backward Compatibility
 * 8. Multi-Source DOM Link Extraction (<a>, <form>, <button formaction/onclick>, <iframe>, honeypot pruning)
 * 9. Dynamic JS Bundle & Mutation Mining (Webpack chunk mapping, Next.js manifests, Vite imports)
 * 10. Client-Side Router Introspection (React Router, Vue Router, Next.js, Remix, Nuxt)
 * 11. Inline Script AST Mining (TypeScript compiler API) and HTML comment parsing
 * 12. Web Worker and Service Worker Dredging
 * 13. ClientRuntimeOmniscienceService Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EndpointNormalizer, endpointNormalizer } from '../EndpointNormalizer';
import { PathTemplateClusterer, pathTemplateClusterer } from '../PathTemplateClusterer';
import {
  MultiSourceEndpointMiner,
  multiSourceEndpointMiner,
  DomLinkExtractor,
  DynamicBundleMiner,
  RouterIntrospectionEngine,
  TypeScriptAstEndpointMiner,
  WorkerDredgingEngine
} from '../MultiSourceEndpointMiner';
import { ClientRuntimeOmniscienceService, clientRuntimeOmniscienceService } from '../ClientRuntimeOmniscienceService';

describe('Milestone 1: Endpoint Mining & Normalization Engine', () => {

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 1: WHATWG URL Canonical Resolution
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 1: WHATWG URL Canonical Resolution', () => {
    let normalizer: EndpointNormalizer;

    beforeEach(() => {
      normalizer = new EndpointNormalizer();
    });

    it('resolves root-relative and directory-relative URLs against base URL', () => {
      const base = 'https://target.com/app/v2/index.html';
      const rootRel = normalizer.normalize('/api/v1/users', base);
      expect(rootRel).not.toBeNull();
      expect(rootRel!.canonicalUrl).toBe('https://target.com/api/v1/users');
      expect(rootRel!.pathname).toBe('/api/v1/users');
      expect(rootRel!.origin).toBe('https://target.com');
      expect(rootRel!.isInternal).toBe(true);

      const dirRel = normalizer.normalize('../dashboard', base);
      expect(dirRel).not.toBeNull();
      expect(dirRel!.canonicalUrl).toBe('https://target.com/app/dashboard');
    });

    it('resolves protocol-relative URLs using target scheme', () => {
      const res = normalizer.normalize('//cdn.target.com/assets/app.js', 'https://target.com');
      expect(res).not.toBeNull();
      expect(res!.canonicalUrl).toBe('https://cdn.target.com/assets/app.js');
      expect(res!.origin).toBe('https://cdn.target.com');
      expect(res!.isInternal).toBe(true);
    });

    it('normalizes RFC 3986 dot segments and duplicate slashes', () => {
      const res = normalizer.normalize('https://target.com/api//v1/../v2///users/./list');
      expect(res).not.toBeNull();
      expect(res!.canonicalUrl).toBe('https://target.com/api/v2/users/list');
      expect(res!.pathname).toBe('/api/v2/users/list');
    });

    it('removes non-root trailing slashes while preserving root slash', () => {
      const rootRes = normalizer.normalize('https://target.com/');
      expect(rootRes!.pathname).toBe('/');
      expect(rootRes!.canonicalUrl).toBe('https://target.com/');

      const subRes = normalizer.normalize('https://target.com/api/v1/users/');
      expect(subRes!.pathname).toBe('/api/v1/users');
      expect(subRes!.canonicalUrl).toBe('https://target.com/api/v1/users');
    });

    it('decodes unreserved percent-encoded characters per RFC 3986', () => {
      // %41 = 'A', %2D = '-', %5F = '_', %2E = '.'
      const res = normalizer.normalize('https://target.com/%41%70%69/%75%73%65%72%73');
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/Api/users');
    });

    it('prunes unroutable schemes (javascript, mailto, tel, data, blob, urn)', () => {
      expect(normalizer.normalize('javascript:void(0)')).toBeNull();
      expect(normalizer.normalize('javascript:alert(1)')).toBeNull();
      expect(normalizer.normalize('mailto:security@target.com')).toBeNull();
      expect(normalizer.normalize('tel:+1234567890')).toBeNull();
      expect(normalizer.normalize('data:text/html,<h1>Hello</h1>')).toBeNull();
      expect(normalizer.normalize('blob:https://target.com/uuid-blob')).toBeNull();
      expect(normalizer.normalize('about:blank')).toBeNull();
      expect(normalizer.normalize('urn:isbn:0451450523')).toBeNull();
    });

    it('handles targetHost scoping for subdomains accurately', () => {
      const internalRes = normalizer.normalize('https://api.target.com/v1/status', undefined, 'target.com');
      expect(internalRes!.isInternal).toBe(true);

      const externalRes = normalizer.normalize('https://malicious-external.com/log', undefined, 'target.com');
      expect(externalRes!.isInternal).toBe(false);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 2: SPA Hash Route Extraction & Anchor Disambiguation
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 2: SPA Hash Route Extraction & Anchor Disambiguation', () => {
    let normalizer: EndpointNormalizer;

    beforeEach(() => {
      normalizer = new EndpointNormalizer();
    });

    it('converts React/Vue hash route (/#/...) into canonical pathname', () => {
      const res = normalizer.normalize('https://target.com/#/products/49102');
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/products/49102');
      expect(res!.canonicalUrl).toBe('https://target.com/products/49102');
      expect(res!.routeTemplate).toBe('/products/{id}');
    });

    it('converts AngularJS hashbang route (/#!/...) and preserves internal queries', () => {
      const res = normalizer.normalize('https://target.com/#!/dashboard/analytics?view=graph&period=30d');
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/dashboard/analytics');
      expect(res!.canonicalUrl).toBe('https://target.com/dashboard/analytics?period=30d&view=graph');
      expect(res!.queryParams).toEqual({ period: '30d', view: 'graph' });
    });

    it('strips index.html when combining base pathname with SPA hash routes', () => {
      const res = normalizer.normalize('https://target.com/portal/index.html#/settings/security');
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/portal/settings/security');
      expect(res!.canonicalUrl).toBe('https://target.com/portal/settings/security');
    });

    it('discards standard HTML page anchors (#top, #installation) without altering pathname', () => {
      const res = normalizer.normalize('https://target.com/documentation/guide#installation');
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/documentation/guide');
      expect(res!.canonicalUrl).toBe('https://target.com/documentation/guide');
      expect(res!.canonicalUrl).not.toContain('#');

      const topRes = normalizer.normalize('https://target.com/home#top');
      expect(topRes!.canonicalUrl).toBe('https://target.com/home');
    });

    it('merges base search parameters and hash search parameters deterministically', () => {
      const res = normalizer.normalize('https://target.com/app?theme=dark#/catalog?category=electronics');
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/app/catalog');
      expect(res!.canonicalUrl).toBe('https://target.com/app/catalog?category=electronics&theme=dark');
      expect(res!.queryParams).toEqual({ category: 'electronics', theme: 'dark' });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 3: Marketing & Ad-Tracking Parameter Stripping
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 3: Marketing & Ad-Tracking Parameter Stripping', () => {
    let normalizer: EndpointNormalizer;

    beforeEach(() => {
      normalizer = new EndpointNormalizer();
    });

    it('strips Google Analytics, Ads & Click IDs (utm_*, gclid, gclsrc, wbraid, _ga, _gl)', () => {
      const raw = 'https://target.com/shop?item=laptop&utm_source=google&utm_medium=cpc&utm_campaign=winter_sale&gclid=Cj0KCQiA...&_ga=GA1.2.3&wbraid=123';
      const res = normalizer.normalize(raw);
      expect(res!.canonicalUrl).toBe('https://target.com/shop?item=laptop');
      expect(res!.queryParams).toEqual({ item: 'laptop' });
    });

    it('strips Meta / Facebook & Instagram tracking tokens (fbclid, igshid, fbid)', () => {
      const raw = 'https://target.com/post?id=45&fbclid=IwAR2...&igshid=xyz987&fb_source=feed';
      const res = normalizer.normalize(raw);
      expect(res!.canonicalUrl).toBe('https://target.com/post?id=45');
    });

    it('strips Twitter/X, TikTok, LinkedIn, and Bing ad click IDs (twclid, ttclid, li_fat_id, msclkid)', () => {
      const raw = 'https://target.com/signup?plan=pro&twclid=123&ttclid=456&li_fat_id=789&msclkid=abc';
      const res = normalizer.normalize(raw);
      expect(res!.canonicalUrl).toBe('https://target.com/signup?plan=pro');
    });

    it('strips E-Commerce marketplace tracking (Amazon ref_, pf_rd_*, pd_rd_*, Flipkart otracker)', () => {
      const amz = 'https://amazon.com/product/b01?ref_=nav_signin&pf_rd_r=XYZ&pd_rd_w=ABC&color=red';
      expect(normalizer.normalize(amz)!.canonicalUrl).toBe('https://amazon.com/product/b01?color=red');

      const flp = 'https://flipkart.com/item?id=88&otracker=search&otracker1=hp_search&size=M';
      expect(normalizer.normalize(flp)!.canonicalUrl).toBe('https://flipkart.com/item?id=88&size=M');
    });

    it('strips anti-cache timestamps and dynamic epoch numbers', () => {
      const raw = 'https://target.com/api/data?format=json&_=' + Date.now() + '&_t=1740000000&cb=98721';
      const res = normalizer.normalize(raw);
      expect(res!.canonicalUrl).toBe('https://target.com/api/data?format=json');
    });

    it('sorts remaining legitimate query parameter keys lexicographically', () => {
      const raw = 'https://target.com/search?z_index=1&query=test&action=view&filter=active';
      const res = normalizer.normalize(raw);
      expect(res!.canonicalUrl).toBe('https://target.com/search?action=view&filter=active&query=test&z_index=1');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 4: Dynamic RESTful Parameter Clustering
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 4: Dynamic RESTful Parameter Clustering', () => {
    let normalizer: EndpointNormalizer;

    beforeEach(() => {
      normalizer = new EndpointNormalizer();
    });

    it('clusters pure numeric IDs into {id}', () => {
      expect(normalizer.generateRouteTemplate('/api/v1/users/49102/edit')).toBe('/api/v1/users/{id}/edit');
      expect(normalizer.generateRouteTemplate('/orders/987654321/invoice')).toBe('/orders/{id}/invoice');
      expect(normalizer.generateRouteTemplate('/v2/teams/1/members/2')).toBe('/v2/teams/{id}/members/{id}');
    });

    it('clusters RFC 4122 standard UUIDs into {uuid}', () => {
      expect(normalizer.generateRouteTemplate('/items/550e8400-e29b-41d4-a716-446655440000/view')).toBe('/items/{uuid}/view');
      expect(normalizer.generateRouteTemplate('/files/E4D909C2-9E66-419A-9E76-35B91A26BE4C')).toBe('/files/{uuid}');
    });

    it('clusters MongoDB ObjectIds and hex hashes (MD5, SHA-1, SHA-256) into {hash}', () => {
      expect(normalizer.generateRouteTemplate('/documents/64b1f28e9a2b5c001f3e4d5a')).toBe('/documents/{hash}');
      expect(normalizer.generateRouteTemplate('/commits/e721a98c4b2f1e6a987d1234567890abcdef1234')).toBe('/commits/{hash}');
      expect(normalizer.generateRouteTemplate('/blobs/d41d8cd98f00b204e9800998ecf8427e')).toBe('/blobs/{hash}');
    });

    it('clusters JWT and high-entropy base64 tokens into {token}', () => {
      const jwtPath = '/auth/verify/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sdfsdf';
      expect(normalizer.generateRouteTemplate(jwtPath)).toBe('/auth/verify/{token}');
    });

    it('clusters ISO calendar dates into {date}', () => {
      expect(normalizer.generateRouteTemplate('/reports/2026-09-30/daily')).toBe('/reports/{date}/daily');
      expect(normalizer.generateRouteTemplate('/archive/2025-12-31/summary')).toBe('/archive/{date}/summary');
    });

    it('clusters catalog slugs when preceded by collection nouns', () => {
      expect(normalizer.generateRouteTemplate('/ecommerce/product/hoodie-with-logo/')).toBe('/ecommerce/product/{slug}');
      expect(normalizer.generateRouteTemplate('/ecommerce/product/belt/')).toBe('/ecommerce/product/{slug}');
      expect(normalizer.generateRouteTemplate('/category/electronics-audio/')).toBe('/category/{slug}');
      expect(normalizer.generateRouteTemplate('/posts/top-10-cybersecurity-tools/')).toBe('/posts/{slug}');
    });

    it('preserves file extensions on dynamic parameter tokens', () => {
      expect(normalizer.generateRouteTemplate('/products/leather-jacket.html')).toBe('/products/{slug}.html');
      expect(normalizer.generateRouteTemplate('/api/users/49102.json')).toBe('/api/users/{id}.json');
      expect(normalizer.generateRouteTemplate('/items/550e8400-e29b-41d4-a716-446655440000.xml')).toBe('/items/{uuid}.xml');
    });

    it('strictly guards reserved action verbs from being misclassified as {slug}', () => {
      expect(normalizer.generateRouteTemplate('/product/new')).toBe('/product/new');
      expect(normalizer.generateRouteTemplate('/product/edit')).toBe('/product/edit');
      expect(normalizer.generateRouteTemplate('/product/delete')).toBe('/product/delete');
      expect(normalizer.generateRouteTemplate('/product/search')).toBe('/product/search');
      expect(normalizer.generateRouteTemplate('/product/checkout')).toBe('/product/checkout');
      expect(normalizer.generateRouteTemplate('/category/all')).toBe('/category/all');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 5: Cluster Sampling Governor
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 5: Cluster Sampling Governor', () => {
    let normalizer: EndpointNormalizer;

    beforeEach(() => {
      normalizer = new EndpointNormalizer(3);
    });

    it('allows up to N samples per structural template and prunes subsequent visits', () => {
      // Template: /product/{id}
      expect(normalizer.shouldCrawlUrl('https://target.com/product/1')).toBe(true);  // Sample 1
      expect(normalizer.shouldCrawlUrl('https://target.com/product/2')).toBe(true);  // Sample 2
      expect(normalizer.shouldCrawlUrl('https://target.com/product/3')).toBe(true);  // Sample 3

      // Exceeded sampling quota (must return false)
      expect(normalizer.shouldCrawlUrl('https://target.com/product/4')).toBe(false);
      expect(normalizer.shouldCrawlUrl('https://target.com/product/9999')).toBe(false);

      // Same URL re-check is permitted
      expect(normalizer.shouldCrawlUrl('https://target.com/product/1')).toBe(true);

      // Independent template /category/{id} is allowed up to its own quota
      expect(normalizer.shouldCrawlUrl('https://target.com/category/10')).toBe(true);
      expect(normalizer.shouldCrawlUrl('https://target.com/category/20')).toBe(true);
      expect(normalizer.shouldCrawlUrl('https://target.com/category/30')).toBe(true);
      expect(normalizer.shouldCrawlUrl('https://target.com/category/40')).toBe(false);
    });

    it('probes crawl capacity non-mutatingly', () => {
      expect(normalizer.hasCrawlCapacity('https://target.com/user/1')).toBe(true);
      normalizer.shouldCrawlUrl('https://target.com/user/1');
      normalizer.shouldCrawlUrl('https://target.com/user/2');
      normalizer.shouldCrawlUrl('https://target.com/user/3');

      expect(normalizer.hasCrawlCapacity('https://target.com/user/4')).toBe(false);
      expect(normalizer.hasCrawlCapacity('https://target.com/user/1')).toBe(true); // already sampled
    });

    it('resets telemetry metrics cleanly on session restart', () => {
      normalizer.shouldCrawlUrl('https://target.com/product/1');
      expect(normalizer.getTemplateCount()).toBe(1);

      normalizer.reset();
      expect(normalizer.getTemplateCount()).toBe(0);
      expect(normalizer.getTemplateMetrics()).toHaveLength(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 6: PathTemplateClusterer Backward Compatibility
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 6: PathTemplateClusterer Backward Compatibility', () => {
    it('provides 100% backward-compatible API for existing consumers', () => {
      const clusterer = new PathTemplateClusterer(3);

      expect(clusterer.generateTemplate('/api/v1/users/49102/edit')).toBe('/api/v1/users/{id}/edit');
      expect(clusterer.generateTemplate('/items/550e8400-e29b-41d4-a716-446655440000/view')).toBe('/items/{uuid}/view');
      expect(clusterer.generateTemplate('/documents/64b1f28e9a2b5c001f3e4d5a')).toBe('/documents/{hash}');
      expect(clusterer.generateTemplate('/reports/2026-09-30/daily')).toBe('/reports/{date}/daily');
      expect(clusterer.generateTemplate('/ecommerce/product/hoodie-with-logo/')).toBe('/ecommerce/product/{slug}');

      const q1 = clusterer.normalizeQuery('?utm_source=twitter&category=books&utm_medium=cpc&sort=asc');
      expect(q1).toBe('category=books&sort=asc');

      const q2 = clusterer.normalizeQuery('?page=10&_=' + Date.now());
      expect(q2).toBe('page={id}');

      expect(clusterer.shouldCrawlUrl('https://store.local/product/101')).toBe(true);
      expect(clusterer.shouldCrawlUrl('https://store.local/product/102')).toBe(true);
      expect(clusterer.shouldCrawlUrl('https://store.local/product/103')).toBe(true);
      expect(clusterer.shouldCrawlUrl('https://store.local/product/104')).toBe(false);

      expect(clusterer.hasCrawlCapacity('https://store.local/product/105')).toBe(false);
      expect(clusterer.getTemplateCount()).toBe(1);

      clusterer.reset();
      expect(clusterer.getTemplateCount()).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 7: Multi-Source DOM Link Extraction
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 7: Multi-Source DOM Link Extraction', () => {
    let miner: MultiSourceEndpointMiner;

    beforeEach(() => {
      miner = new MultiSourceEndpointMiner();
    });

    it('extracts links from <a> tags including ping beacons and downloads', () => {
      const html = `
        <div>
          <a href="/about-us">About</a>
          <a href="https://external.com/docs" ping="/telemetry/beacon /track/click">External</a>
          <a href="/reports/export.csv" download>Download CSV</a>
          <a data-url="/api/internal/feature">Data Link</a>
        </div>
      `;
      const endpoints = miner.extractFromHtml(html, 'https://target.com/page');

      expect(endpoints.some(e => e.url === 'https://target.com/about-us' && e.source === 'dom_link')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/telemetry/beacon' && e.method === 'POST')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/track/click' && e.method === 'POST')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/reports/export.csv')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/internal/feature')).toBe(true);
    });

    it('extracts forms with GET/POST methods and parses hidden/text controls into parameters', () => {
      const html = `
        <form action="/auth/login" method="POST" enctype="multipart/form-data">
          <input type="hidden" name="csrf_token" value="abc123xyz" />
          <input type="text" name="username" value="admin" />
          <input type="password" name="password" value="" />
          <input type="checkbox" name="remember_me" checked value="true" />
        </form>
        <form action="/search" method="GET">
          <input type="text" name="q" value="security scanner" />
        </form>
      `;
      const endpoints = miner.extractFromHtml(html, 'https://target.com');

      const loginForm = endpoints.find(e => e.url === 'https://target.com/auth/login');
      expect(loginForm).toBeDefined();
      expect(loginForm!.source).toBe('dom_form');
      expect(loginForm!.method).toBe('POST');
      expect(loginForm!.parameters).toEqual({
        csrf_token: 'abc123xyz',
        username: 'admin',
        password: '',
        remember_me: 'true'
      });

      const searchForm = endpoints.find(e => e.url === 'https://target.com/search');
      expect(searchForm).toBeDefined();
      expect(searchForm!.source).toBe('dom_form');
      expect(searchForm!.method).toBe('GET');
      expect(searchForm!.parameters).toEqual({ q: 'security scanner' });
    });

    it('extracts buttons with formaction overrides, data-url, and onclick regex', () => {
      const html = `
        <button formaction="/admin/export" formmethod="POST">Export Data</button>
        <button data-url="/api/v1/quick-action">Quick Action</button>
        <button onclick="location.href = '/dashboard/overview';">Go Overview</button>
        <button onclick="router.push('/settings/billing');">Go Billing</button>
        <button onclick="fetch('/api/v2/telemetry');">Send Telemetry</button>
      `;
      const endpoints = miner.extractFromHtml(html, 'https://target.com');

      expect(endpoints.some(e => e.url === 'https://target.com/admin/export' && e.method === 'POST' && e.source === 'dom_button')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/v1/quick-action' && e.source === 'dom_button')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/dashboard/overview' && e.source === 'dom_button')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/settings/billing' && e.source === 'dom_button')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/v2/telemetry' && e.source === 'dom_button')).toBe(true);
    });

    it('extracts iframes and parses embedded srcdoc HTML documents', () => {
      const html = `
        <iframe src="/embedded/widget"></iframe>
        <iframe data-src="/embedded/lazy-widget"></iframe>
        <iframe srcdoc="&lt;a href='/inside-iframe'&gt;Inside&lt;/a&gt;"></iframe>
      `;
      const endpoints = miner.extractFromHtml(html, 'https://target.com');

      expect(endpoints.some(e => e.url === 'https://target.com/embedded/widget' && e.source === 'dom_link')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/embedded/lazy-widget' && e.source === 'dom_link')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/inside-iframe' && e.source === 'dom_link')).toBe(true);
    });

    it('prunes honeypot links (display:none, opacity:0, bot-trap class/id, hidden, aria-hidden)', () => {
      const html = `
        <a href="/legitimate-page">Legitimate Page</a>
        <a href="/trap-hidden" style="display:none">Trap 1</a>
        <a href="/trap-opacity" style="opacity: 0">Trap 2</a>
        <a href="/trap-class" class="bot-trap-link">Trap 3</a>
        <a href="/trap-id" id="honeypot_link">Trap 4</a>
        <a href="/trap-aria" aria-hidden="true">Trap 5</a>
      `;
      const endpoints = miner.extractFromHtml(html, 'https://target.com');

      expect(endpoints.some(e => e.url === 'https://target.com/legitimate-page')).toBe(true);
      expect(endpoints.some(e => e.url.includes('trap'))).toBe(false);
    });

    it('verifies in-browser DOM extraction script generation contains Shadow DOM and honeypot guards', () => {
      const script = DomLinkExtractor.getInBrowserExtractionScript();
      expect(script).toContain('shadowRoot');
      expect(script).toContain('getComputedStyle');
      expect(script).toContain('trapTokens');
      expect(script).toContain('formaction');
      expect(script).toContain('ping');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 8: Dynamic JS Bundle & Code-Split Chunk Mining
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 8: Dynamic JS Bundle & Code-Split Chunk Mining', () => {
    let bundleMiner: DynamicBundleMiner;

    beforeEach(() => {
      bundleMiner = new DynamicBundleMiner();
    });

    it('reconstructs Webpack code-split chunk URLs from runtime bundle mapping function', () => {
      const bundleSnippet = `
        __webpack_require__.u = function(e) {
          return "static/js/" + e + "." + ({
            120: "e721a98c",
            340: "f401bc33",
            560: "8b29c011"
          }[e] || e) + ".chunk.js";
        };
      `;
      const chunks = bundleMiner.extractWebpackChunkUrlsFromBundle(bundleSnippet, 'https://target.com/');
      expect(chunks).toContain('https://target.com/static/js/120.e721a98c.chunk.js');
      expect(chunks).toContain('https://target.com/static/js/340.f401bc33.chunk.js');
      expect(chunks).toContain('https://target.com/static/js/560.8b29c011.chunk.js');
    });

    it('mines Vite / Rollup dynamic imports and __vite__mapDeps dependency arrays', () => {
      const bundleSnippet = `
        const __vite__mapDeps = (i, m = __vite__mapDeps, d = (m.f || (m.f = [
          "assets/AdminDashboard-Bf50X.js",
          "assets/UserProfile-D99zY.js",
          "assets/BillingSettings-C44aK.js"
        ]))) => i.map(i => d[i]);
        import("./assets/AsyncModule-12345.js");
      `;
      const imports = bundleMiner.extractViteDynamicImportsFromBundle(bundleSnippet, 'https://target.com/');
      expect(imports).toContain('https://target.com/assets/AdminDashboard-Bf50X.js');
      expect(imports).toContain('https://target.com/assets/UserProfile-D99zY.js');
      expect(imports).toContain('https://target.com/assets/BillingSettings-C44aK.js');
      expect(imports).toContain('https://target.com/assets/AsyncModule-12345.js');
    });

    it('generates pre-execution script hooking MutationObserver, script.src setter, and webpackChunk', () => {
      const script = DynamicBundleMiner.getPreExecutionInjectionScript();
      expect(script).toContain('MutationObserver');
      expect(script).toContain('HTMLScriptElement.prototype');
      expect(script).toContain('webpackChunk');
      expect(script).toContain('__SENTINEL_MUTATION_SCRIPTS__');
    });

    it('generates in-browser manifest dredge script harvesting Next.js manifests and trapped scripts', () => {
      const script = DynamicBundleMiner.getInBrowserManifestDredgeScript();
      expect(script).toContain('__BUILD_MANIFEST');
      expect(script).toContain('__SSG_MANIFEST');
      expect(script).toContain('__SENTINEL_MUTATION_SCRIPTS__');
      expect(script).toContain('__SENTINEL_MUTATION_CHUNKS__');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 9: Client-Side Router Introspection
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 9: Client-Side Router Introspection', () => {
    it('generates introspection script covering React, Vue, Next.js, Remix, and Nuxt', () => {
      const script = RouterIntrospectionEngine.getInBrowserRouterIntrospectionScript();
      expect(script).toContain('__reactFiber$');
      expect(script).toContain('__remixRouter');
      expect(script).toContain('__vue__');
      expect(script).toContain('__vue_app__');
      expect(script).toContain('__NEXT_DATA__');
      expect(script).toContain('__BUILD_MANIFEST');
      expect(script).toContain('__next_f');
      expect(script).toContain('__remixManifest');
      expect(script).toContain('__NUXT__');
      expect(script).toContain('NodeFilter.SHOW_COMMENT');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 10: Inline Script AST Mining & HTML Comments
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 10: Inline Script AST Mining & HTML Comments', () => {
    it('parses CallExpressions (fetch, axios, router.push) using TypeScript compiler API', () => {
      const code = `
        function sendPayload(userId) {
          fetch('/api/v1/users/login', { method: 'POST' });
          axios.post('/api/v2/auth/token', { grant: 'password' });
          axios.get('/api/v2/catalog/items');
          router.push('/dashboard/analytics');
        }
      `;
      const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(code);

      expect(endpoints.some(e => e.url === '/api/v1/users/login' && e.method === 'POST')).toBe(true);
      expect(endpoints.some(e => e.url === '/api/v2/auth/token' && e.method === 'POST')).toBe(true);
      expect(endpoints.some(e => e.url === '/api/v2/catalog/items' && e.method === 'GET')).toBe(true);
      expect(endpoints.some(e => e.url === '/dashboard/analytics')).toBe(true);
    });

    it('extracts and abstracts template literals into parameterized route templates', () => {
      const code = `
        const url = \`/api/v1/users/\${userId}/profile\`;
        fetch(\`/api/v2/orders/\${orderId}/items/\${itemId}\`);
      `;
      const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(code);

      expect(endpoints.some(e => e.url === '/api/v1/users/{param}/profile')).toBe(true);
      expect(endpoints.some(e => e.url === '/api/v2/orders/{param}/items/{param}')).toBe(true);
    });

    it('extracts standalone API string literals matching path conventions', () => {
      const code = `
        const ENDPOINTS = {
          users: '/api/v1/users',
          graphql: '/graphql',
          admin: '/admin/audit-log'
        };
      `;
      const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(code);

      expect(endpoints.some(e => e.url === '/api/v1/users')).toBe(true);
      expect(endpoints.some(e => e.url === '/graphql')).toBe(true);
      expect(endpoints.some(e => e.url === '/admin/audit-log')).toBe(true);
    });

    it('parses HTML comments to extract commented tags and developer API notes', () => {
      const html = `
        <!-- <a href="/internal/preview">Preview Link</a> -->
        <!-- <form action="/api/v1/auth/reset" method="POST"></form> -->
        <!-- Backend endpoint: /api/v3/debug/health -->
        <!-- Server: https://staging-api.target.com/v1/metrics -->
      `;
      const endpoints = multiSourceEndpointMiner.extractFromHtml(html, 'https://target.com');

      expect(endpoints.some(e => e.url === 'https://target.com/internal/preview' && e.source === 'html_comment')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/v1/auth/reset' && e.source === 'html_comment')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/v3/debug/health' && e.source === 'html_comment')).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 11: Web Worker & Service Worker Dredging
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 11: Web Worker & Service Worker Dredging', () => {
    it('generates in-browser worker dredge script checking navigator.serviceWorker and window.caches', () => {
      const script = WorkerDredgingEngine.getInBrowserWorkerDredgeScript();
      expect(script).toContain('navigator.serviceWorker');
      expect(script).toContain('window.caches');
      expect(script).toContain('__SENTINEL_DISCOVERED_WORKERS__');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 12: MultiSourceEndpointMiner Orchestration
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 12: MultiSourceEndpointMiner Orchestration', () => {
    it('extracts endpoints via mock browser CDP driver evaluate', async () => {
      const miner = new MultiSourceEndpointMiner();

      const mockDriver = {
        evaluate: async (script: string) => {
          if (script.includes('isHoneypot')) {
            return {
              links: [{ url: 'https://target.com/home', text: 'Home', isPing: false }],
              forms: [{ actionUrl: 'https://target.com/api/search', method: 'GET', parameters: { q: 'sentinel' } }],
              buttons: [{ url: 'https://target.com/btn/action', method: 'POST' }]
            };
          }
          if (script.includes('nextBuildManifestRoutes')) {
            return {
              trappedScripts: ['https://target.com/static/chunks/main-123.js'],
              nextBuildManifestRoutes: ['/dashboard', '/settings'],
              nextBuildManifestChunks: ['https://target.com/_next/static/chunks/pages/dashboard.js'],
              trappedChunkIds: ['120']
            };
          }
          if (script.includes('remixRouter')) {
            return [
              { url: '/api/v1/user/profile', source: 'router_route', method: 'GET' },
              { url: '/internal/comment-route', source: 'html_comment', method: 'GET' }
            ];
          }
          if (script.includes('caches.keys')) {
            return [
              { url: 'https://target.com/offline-cache.html', source: 'worker', method: 'GET' }
            ];
          }
          return null;
        }
      };

      const endpoints = await miner.extractEndpoints({
        targetHost: 'target.com',
        currentUrl: 'https://target.com/app',
        driver: mockDriver
      });

      expect(endpoints.some(e => e.url === 'https://target.com/home' && e.source === 'dom_link')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/search' && e.source === 'dom_form')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/btn/action' && e.source === 'dom_button')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/static/chunks/main-123.js' && e.source === 'bundle_chunk')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/dashboard' && e.source === 'router_route')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/api/v1/user/profile' && e.source === 'router_route')).toBe(true);
      expect(endpoints.some(e => e.url === 'https://target.com/offline-cache.html' && e.source === 'worker')).toBe(true);
    });

    it('normalizes discovered endpoints conforming to NormalizedEndpoint interface', () => {
      const normalized = multiSourceEndpointMiner.normalizeEndpoint('/api/v1/products/8472?utm_source=ad', 'https://target.com');

      expect(normalized.canonicalUrl).toBe('https://target.com/api/v1/products/8472');
      expect(normalized.origin).toBe('https://target.com');
      expect(normalized.pathname).toBe('/api/v1/products/8472');
      expect(normalized.routeTemplate).toBe('/api/v1/products/{id}');
      expect(normalized.isInternal).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Pillar 13: ClientRuntimeOmniscienceService Integration
  // ═════════════════════════════════════════════════════════════════════════════
  describe('Pillar 13: ClientRuntimeOmniscienceService Integration', () => {
    it('generates enhanced pre-execution injection script with mutation and worker tracking', () => {
      const script = ClientRuntimeOmniscienceService.getInjectionScript();

      expect(script).toContain('__SENTINEL_OBSERVER_INJECTED__');
      expect(script).toContain('__SENTINEL_LAST_MUTATION_TS__');
      expect(script).toContain('__SENTINEL_MUTATION_SCRIPTS__');
      expect(script).toContain('__SENTINEL_DISCOVERED_WORKERS__');
      expect(script).toContain('HTMLScriptElement.prototype');
      expect(script).toContain('webpackChunk');
    });

    it('provides router introspection script accessor', () => {
      const script = ClientRuntimeOmniscienceService.getRouterIntrospectionScript();
      expect(script).toContain('__NEXT_DATA__');
      expect(script).toContain('__remixManifest');
    });
  });
});

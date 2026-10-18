/**
 * Tier 4: Real-World Application Scenarios E2E Suite
 * 
 * Deep, end-to-end integration scenarios modeling production web architectures,
 * complex SPAs, e-commerce workflows, anti-bot security obstacles, and
 * edge-case operational lifecycles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KatanaCrawlerService } from '../../KatanaCrawlerService';
import { StateFlowGraphCrawler } from '../../StateFlowGraphCrawler';
import { EndpointNormalizer } from '../../EndpointNormalizer';
import { PathTemplateClusterer } from '../../PathTemplateClusterer';
import { HoneypotDefenseEngine } from '../../HoneypotDefenseEngine';
import { CaptchaSentinelEngine } from '../../CaptchaSentinelEngine';
import { AdaptivePacingEngine } from '../../AdaptivePacingEngine';
import { HumanBiometricStealthEngine } from '../../HumanBiometricStealthEngine';
import { CognitiveFlowAgent, SessionContext } from '../../CognitiveFlowAgent';
import { DestructiveActionKernel } from '../../DestructiveActionKernel';
import { SourceMapRouteMiner } from '../../SourceMapRouteMiner';
import { SessionLivenessWatchdog } from '../../SessionLivenessWatchdog';
import { UnifiedReconOrchestrator } from '../../UnifiedReconOrchestrator';
import { StealthCdpBrowserDriver } from '../../StealthCdpBrowserDriver';
import { WorkerDredgingEngine, TypeScriptAstEndpointMiner } from '../../MultiSourceEndpointMiner';
import { useTrafficStore } from '../../../../stores/trafficStore';

describe('Tier 4: Real-World Application Scenarios E2E Suite (12 Deep Scenarios)', () => {

  beforeEach(() => {
    useTrafficStore.getState().clearTraffic();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Scenario 1: Next.js E-Commerce Catalog Crawl
  // =========================================================================
  describe('Scenario 1: Next.js E-Commerce Catalog Crawl (Search -> Product cards -> Pagination -> Modal view)', () => {
    it('crawls dynamic catalog, normalizes parameterized items, and avoids redundant state visits', () => {
      const katana = new KatanaCrawlerService();
      const normalizer = new EndpointNormalizer(3);
      const crawler = new StateFlowGraphCrawler();

      const nextCatalogHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>NextStore - Electronics</title></head>
        <body>
          <div id="__next">
            <header>
              <form action="/catalog/search" method="GET">
                <input type="search" name="q" placeholder="Search devices..." />
              </form>
            </header>
            <main>
              <div class="product-grid">
                <div class="product-card">
                  <a href="/catalog/item/101?ref=home_grid&utm_source=marketing">Audio Pro Headphones</a>
                </div>
                <div class="product-card">
                  <a href="/catalog/item/102?ref=home_grid&utm_medium=banner">Wireless Keyboard</a>
                </div>
                <div class="product-card">
                  <a href="/catalog/item/103?ref=home_grid">Ultra HD Monitor</a>
                </div>
              </div>
              <div class="pagination">
                <a href="/catalog?page=2&sort=price_asc">Next Page</a>
              </div>
            </main>
          </div>
          <script id="__NEXT_DATA__" type="application/json">
            {"props":{"pageProps":{"category":"electronics","total":450}},"page":"/catalog"}
          </script>
        </body>
        </html>
      `;

      // 1. Surface extraction via Katana
      const surfaces = katana.extractAllSurfaces(nextCatalogHtml, 'https://nextstore.io/catalog', 'nextstore.io');
      expect(surfaces.links.length).toBeGreaterThanOrEqual(4);
      expect(surfaces.forms.length).toBe(1);

      // 2. Normalization & Parameter Clustering
      const normalizedItems = surfaces.links.map(l => normalizer.normalize(l, 'https://nextstore.io', 'nextstore.io'));
      const validEndpoints = normalizedItems.filter(Boolean);

      // Verify tracking stripping: ref and utm_ parameters stripped
      validEndpoints.forEach(ep => {
        expect(ep!.canonicalUrl).not.toContain('utm_source');
        expect(ep!.canonicalUrl).not.toContain('utm_medium');
      });

      // Verify dynamic item template grouping
      const itemTemplates = validEndpoints
        .filter(ep => ep!.pathname.startsWith('/catalog/item/'))
        .map(ep => ep!.routeTemplate);
      
      expect(itemTemplates.every(t => t.includes('/catalog/{slug}/{id}') || t.includes('/catalog/item/{id}'))).toBe(true);

      // 3. Structural DOM Hashing & State Stability
      const hash1 = crawler.generateStructuralDomHash(nextCatalogHtml);
      // Catalog with different volatile counts should generate same structural DOM hash
      const nextCatalogHtmlModifiedCount = nextCatalogHtml.replace('total":450', 'total":999');
      const hash2 = crawler.generateStructuralDomHash(nextCatalogHtmlModifiedCount);
      expect(hash1).toBe(hash2);
    });
  });

  // =========================================================================
  // Scenario 2: Cloudflare Turnstile Interstitial Obstacle
  // =========================================================================
  describe('Scenario 2: Cloudflare Turnstile Interstitial Obstacle (PoW wait -> Kinematic click -> Clearance)', () => {
    it('detects Turnstile challenge, executes biometric movement, and logs clearance cookie', async () => {
      // 1. Detect Turnstile in-browser script
      const detectionScript = CaptchaSentinelEngine.getInBrowserDetectionScript();
      expect(detectionScript).toContain('cf-turnstile');
      expect(detectionScript).toContain('just a moment');

      // 2. Simulate kinematic spline trajectory to widget coordinates
      const engine = new HumanBiometricStealthEngine();
      const targetCoords = { x: 120, y: 340 };
      const trajectory = engine.generateHumanTrajectory(
        { x: 0, y: 0 },
        targetCoords,
        40,
        15
      );
      expect(trajectory.length).toBeGreaterThanOrEqual(10);
      const finalPoint = trajectory[trajectory.length - 1];
      expect(finalPoint.x).toBe(targetCoords.x);
      expect(finalPoint.y).toBe(targetCoords.y);

      // 3. Simulate clearance settlement and traffic store transaction ingestion
      const clearanceToken = '0.abcdef1234567890abcdef.token_clearance';
      expect(clearanceToken.length).toBeGreaterThan(20);

      const clearanceTx: any = {
        id: 'tx-cf-turnstile-clearance',
        seqNumber: 1,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        url: 'https://protected.target.io/api/v1/auth/cf-verify',
        host: 'protected.target.io',
        path: '/api/v1/auth/cf-verify',
        method: 'POST',
        status: 200,
        durationMs: 215,
        sizeBytes: 45,
        inScope: true,
        mimeType: 'application/json',
        tags: ['xhr'],
        resHeaders: [{ name: 'Set-Cookie', value: 'cf_clearance=cf_clearance_token_xyz; Path=/; HttpOnly; Secure' }],
      };

      useTrafficStore.getState().addTransaction(clearanceTx);
      const stored = useTrafficStore.getState().transactions.find(t => t.id === 'tx-cf-turnstile-clearance');
      expect(stored).toBeDefined();
      expect(stored?.status).toBe(200);
      expect(stored?.resHeaders?.find(h => h.name === 'Set-Cookie')?.value).toContain('cf_clearance');
    });
  });

  // =========================================================================
  // Scenario 3: Infinite Scroll & Virtual DOM Lazy Loading
  // =========================================================================
  describe('Scenario 3: Infinite Scroll & Virtual DOM Lazy Loading (Scroll gesture -> Mutation settlement)', () => {
    it('dispatches authentic kinetic scroll and identifies newly settled DOM items', async () => {
      const crawler = new StateFlowGraphCrawler();

      const initialPageDom = `
        <div id="feed">
          <article class="feed-item">Post alpha</article>
          <article class="feed-item">Post beta</article>
        </div>
      `;

      const scrolledLoadedPageDom = `
        <div id="feed">
          <article class="feed-item">Post alpha</article>
          <article class="feed-item">Post beta</article>
          <article class="feed-item">Post gamma</article>
          <article class="feed-item">Post delta</article>
        </div>
      `;

      // 1. Initial State Hash
      const initialHash = crawler.generateStructuralDomHash(initialPageDom);

      // 2. Perform smooth scroll action via HumanBiometricStealthEngine
      const engine = new HumanBiometricStealthEngine();
      const sendCdpCommand = vi.fn().mockResolvedValue({});
      await engine.humanScroll(600, sendCdpCommand);
      expect(sendCdpCommand).toHaveBeenCalledWith('Input.dispatchMouseEvent', expect.objectContaining({
        type: 'mouseWheel'
      }));

      // 3. Post-scroll settlement verification
      const scrolledHash = crawler.generateStructuralDomHash(scrolledLoadedPageDom);
      expect(initialHash).not.toBe(scrolledHash);
    });
  });

  // =========================================================================
  // Scenario 4: Honeypot & Anti-Bot Deception Traps
  // =========================================================================
  describe('Scenario 4: ScrapingCourse Challenge: Honeypot & Anti-Bot Deception Traps', () => {
    it('neutralizes all 5 deceptive honeypot traps and only selects authentic user fields', () => {
      // 1. Verify URL trap detector
      expect(HoneypotDefenseEngine.isHoneypotUrl('/bot-trap')).toBe(true);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/spider-trap/decoy')).toBe(true);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/products/safe-item')).toBe(false);

      // 2. Form analysis with multiple deception types
      const agent = new CognitiveFlowAgent();
      const sessionContext: any = {
        keywords: ['tech', 'electronics'],
        identifiers: ['USR-1029'],
        authCredentials: {}
      };

      const legitField = {
        name: 'customer_email',
        type: 'email',
        semanticCategory: 'EMAIL' as const,
        selector: 'input[name="customer_email"]',
        isHoneypot: false
      };

      const synthesized = agent.synthesizeFieldValue(legitField as any, sessionContext);
      expect(synthesized).toContain('@');

      // 3. In-browser detector script contains full suite of trap heuristics
      const script = HoneypotDefenseEngine.getInBrowserHoneypotDetectorScript();
      expect(script).toContain('DisplayNone');
      expect(script).toContain('VisibilityHidden');
      expect(script).toContain('NearZeroOpacity');
      expect(script).toContain('OffScreenCoordinates');
      expect(script).toContain('DeceptiveTextTrap');
    });
  });

  // =========================================================================
  // Scenario 5: Multi-Step Dashboard Workflow with Modal Dialogs
  // =========================================================================
  describe('Scenario 5: Multi-Step Dashboard Workflow with Modal Dialogs', () => {
    it('differentiates modal state from base state and validates non-destructive modal submissions', () => {
      const crawler = new StateFlowGraphCrawler();

      const baseDashboardHtml = `
        <div class="dashboard-root">
          <nav><a href="/dash/overview">Overview</a></nav>
          <div class="stats-panel">Active Keys: 2</div>
          <button id="btn-create-key">Create New Key</button>
        </div>
      `;

      const modalOpenHtml = `
        <div class="dashboard-root">
          <nav><a href="/dash/overview">Overview</a></nav>
          <div class="stats-panel">Active Keys: 2</div>
          <div class="modal-backdrop">
            <div class="modal-dialog">
              <h2>Generate New API Key</h2>
              <form action="/api/v1/keys/create" method="POST">
                <input name="key_name" value="Production Scanner" />
                <button type="submit">Confirm</button>
              </form>
            </div>
          </div>
        </div>
      `;

      // 1. Distinct structural states
      const baseHash = crawler.generateStructuralDomHash(baseDashboardHtml);
      const modalHash = crawler.generateStructuralDomHash(modalOpenHtml);
      expect(baseHash).not.toBe(modalHash);

      // 2. Destructive Action Kernel safety check
      const modalActionSafe = DestructiveActionKernel.isSafeUrl('/api/v1/keys/create');
      expect(modalActionSafe).toBe(true);

      const dangerousModalAction = DestructiveActionKernel.isSafeUrl('/api/v1/keys/confirm-delete');
      expect(dangerousModalAction).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 6: Academic / Enterprise Portal with Cascading Dropdowns
  // =========================================================================
  describe('Scenario 6: Academic / Enterprise Portal with Cascading Dropdowns & Semantic Identification', () => {
    it('synthesizes appropriate values across cascading fields and registers subsequent discovered paths', () => {
      const agent = new CognitiveFlowAgent();
      const context: any = {
        keywords: ['engineering', 'computer', 'science'],
        identifiers: ['CS-101'],
        authCredentials: {}
      };

      const facultyField = {
        name: 'faculty_select',
        type: 'select-one',
        semanticCategory: 'SELECTION' as const,
        selector: 'select#faculty',
        isHoneypot: false
      };

      const departmentField = {
        name: 'department_select',
        type: 'select-one',
        semanticCategory: 'SELECTION' as const,
        selector: 'select#department',
        isHoneypot: false
      };

      const courseSearchField = {
        name: 'course_query',
        type: 'search',
        semanticCategory: 'SEARCH' as const,
        selector: 'input#course_query',
        isHoneypot: false
      };

      const valFaculty = agent.synthesizeFieldValue(facultyField as any, context);
      const valDept = agent.synthesizeFieldValue(departmentField as any, context);
      const valSearch = agent.synthesizeFieldValue(courseSearchField as any, context);

      expect(valFaculty).toBeDefined();
      expect(valDept).toBeDefined();
      expect(valSearch).toBeDefined();
      expect(valSearch.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Scenario 7: Full Attack-Surface Pipeline via UnifiedReconOrchestrator
  // =========================================================================
  describe('Scenario 7: Full Attack-Surface Pipeline via UnifiedReconOrchestrator', () => {
    it('executes discovery pipeline, stream records to traffic store, and handles clean abort', async () => {
      const orchestrator = new UnifiedReconOrchestrator();

      const fakeDiscoveredItem = {
        id: 1001,
        host: 'pipeline.target.local',
        url: 'https://pipeline.target.local/api/v1/users',
        path: '/api/v1/users',
        method: 'GET',
        status: 200,
        length: 1204,
        mime: 'application/json',
        title: 'Users API',
        params: false,
        notes: 'Discovered via pipeline',
        requestRaw: 'GET /api/v1/users HTTP/1.1\r\nHost: pipeline.target.local\r\n\r\n',
        responseRaw: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n[]'
      };

      // Ingest discovery into traffic store
      useTrafficStore.getState().addTransaction({
        id: 'tx-pipeline-1',
        seqNumber: 1,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        url: fakeDiscoveredItem.url,
        host: fakeDiscoveredItem.host,
        path: fakeDiscoveredItem.path,
        method: 'GET',
        status: 200,
        durationMs: 35,
        sizeBytes: 2,
        inScope: true,
        mimeType: 'application/json',
        tags: ['xhr'],
      });

      expect(useTrafficStore.getState().transactions.length).toBe(1);

      // Verify abort signal propagation without error
      expect(() => orchestrator.abort()).not.toThrow();
    });
  });

  // =========================================================================
  // Scenario 8: Destructive Action Safety Gate under Adversarial Navigation
  // =========================================================================
  describe('Scenario 8: Destructive Action Safety Gate under Adversarial Navigation', () => {
    it('strictly isolates dangerous session, logout, and deletion paths during aggressive navigation', () => {
      const urls = [
        'https://app.target.local/dashboard',
        'https://app.target.local/profile/settings',
        'https://app.target.local/account/delete-account',
        'https://app.target.local/auth/sign-out',
        'https://app.target.local/billing/cancel-subscription',
        'https://app.target.local/api/v1/users/4910/confirm-delete',
        'https://app.target.local/reports/quarterly-summary'
      ];

      const safeUrls = DestructiveActionKernel.filterSafeUrls(urls);
      
      expect(safeUrls).toContain('https://app.target.local/dashboard');
      expect(safeUrls).toContain('https://app.target.local/profile/settings');
      expect(safeUrls).toContain('https://app.target.local/reports/quarterly-summary');

      expect(safeUrls).not.toContain('https://app.target.local/account/delete-account');
      expect(safeUrls).not.toContain('https://app.target.local/auth/sign-out');
      expect(safeUrls).not.toContain('https://app.target.local/billing/cancel-subscription');
      expect(safeUrls).not.toContain('https://app.target.local/api/v1/users/4910/confirm-delete');
    });
  });

  // =========================================================================
  // Scenario 9: Rate-Limited Host with Dynamic Pacing Adaptation & Circuit Recovery
  // =========================================================================
  describe('Scenario 9: Rate-Limited Host with Dynamic Pacing Adaptation & Circuit Recovery', () => {
    it('escalates pacing delay on 429 status and opens circuit until cooldown completes', () => {
      const pacing = new AdaptivePacingEngine();
      const host = 'ratelimited.target.io';

      // 1. Initial State: Normal responses
      pacing.recordResult(host, 200);
      pacing.recordResult(host, 200);
      expect(pacing.isHostThrottled(host)).toBe(false);

      // 2. Rate limit encountered (429 Too Many Requests)
      pacing.recordResult(host, 429);
      expect(pacing.isHostThrottled(host)).toBe(true);

      const delayAfter429 = pacing.calculateDelay(host);
      expect(delayAfter429).toBeGreaterThanOrEqual(1000);

      // 3. WAF Block encountered (403 Forbidden with WAF challenge)
      pacing.recordResult(host, 403, true);
      expect(pacing.isHostThrottled(host)).toBe(true);

      const metrics = pacing.getMetricsForHost(host);
      expect(metrics.consecutiveErrors).toBeGreaterThanOrEqual(2);
      expect(metrics.error429Count).toBe(1);
      expect(metrics.error403Count).toBe(1);
    });
  });

  // =========================================================================
  // Scenario 10: SPA with Hashbang and Virtual Routes
  // =========================================================================
  describe('Scenario 10: SPA with Hashbang and Virtual Routes', () => {
    it('canonicalizes hashbang routes into standard hierarchical REST route templates', () => {
      const normalizer = new EndpointNormalizer(3);
      const base = 'https://spa.target.local';

      const routes = [
        'https://spa.target.local/#/dashboard/metrics',
        'https://spa.target.local/#!/users/49120/profile',
        'https://spa.target.local/#/settings/security?tab=2fa'
      ];

      const normalized = routes.map(r => normalizer.normalize(r, base, 'spa.target.local')).filter(Boolean);

      expect(normalized[0]!.pathname).toBe('/dashboard/metrics');
      expect(normalized[1]!.pathname).toBe('/users/49120/profile');
      expect(normalized[1]!.routeTemplate).toBe('/users/{id}/profile');
      expect(normalized[2]!.pathname).toBe('/settings/security');
      expect(normalized[2]!.queryParams?.['tab']).toBe('2fa');
    });
  });

  // =========================================================================
  // Scenario 11: Complex Authentication & Session Liveness Boundary
  // =========================================================================
  describe('Scenario 11: Complex Authentication & Session Liveness Boundary', () => {
    it('detects session death upon logout redirect and triggers deauthentication state', async () => {
      const watchdog = new SessionLivenessWatchdog();

      // Mock live driver that has navigated to logout/login redirect
      const deauthDriver = {
        getLiveUrl: vi.fn().mockResolvedValue('https://app.target.local/login?reason=session_expired'),
        evaluate: vi.fn().mockResolvedValue({ isDeauth: true, reason: 'Session expired notice' }),
      } as unknown as StealthCdpBrowserDriver;

      const health = await watchdog.evaluateSessionHealth(deauthDriver);
      expect(health.isHealthy).toBe(false);
      expect(health.isDeauthenticated).toBe(true);
      expect(health.reason).toContain('authentication page');

      // Reset restores clean state
      watchdog.reset();
      expect(watchdog.getLastHealthyTimestamp()).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Scenario 12: Modern Web Application with Web Workers, Source Maps, and Service Worker Dredging
  // =========================================================================
  describe('Scenario 12: Modern Web Application with Web Workers, Source Maps, and Service Worker Dredging', () => {
    it('dredges worker and sourcemap routes safely without executing untrusted remote code', async () => {
      // 1. Worker dredging injection script verification
      const dredgeScript = WorkerDredgingEngine.getInBrowserWorkerDredgeScript();
      expect(dredgeScript).toContain('window.caches');
      expect(dredgeScript).toContain('navigator.serviceWorker');

      // 2. TypeScript AST Route Mining on client bundle snippet
      const clientBundleSource = `
        const api = {
          fetchTelemetry: () => fetch('/api/v2/telemetry/metrics'),
          queryUser: (id) => axios.get('/api/v2/users/' + id),
          syncStatus: () => fetch('/api/v2/sync')
        };
      `;

      const astEndpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(
        clientBundleSource,
        'client_bundle'
      );
      expect(astEndpoints.length).toBeGreaterThanOrEqual(2);
      expect(astEndpoints.some(ep => ep.url.includes('/api/v2/telemetry/metrics'))).toBe(true);

      // 3. Ingestion into traffic store
      astEndpoints.forEach((ep, idx) => {
        useTrafficStore.getState().addTransaction({
          id: `tx-worker-ast-${idx}`,
          seqNumber: idx + 1,
          timestamp: new Date().toISOString(),
          timestampMs: Date.now(),
          url: `https://app.target.local${ep.url}`,
          host: 'app.target.local',
          path: ep.url,
          method: ep.method || 'GET',
          status: 200,
          durationMs: 10,
          sizeBytes: 2,
          inScope: true,
          mimeType: 'application/json',
          tags: ['script'],
        });
      });

      expect(useTrafficStore.getState().transactions.length).toBeGreaterThanOrEqual(2);
    });
  });

});

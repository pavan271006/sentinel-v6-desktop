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

    it('prevents crawling session-terminating logout routes via safety blocklist', async () => {
      const crawler = new TargetSiteCrawler();

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async () => {
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: '<html><body><a href="/logout">Logout</a><a href="/profile?id=1">Profile</a><a href="/account/delete">Delete</a></body></html>',
          rawResponse: '',
          sizeBytes: 150,
        } as any;
      });

      const discovered = await crawler.crawlHost('https://target.corp', undefined, { maxDepth: 1 });

      const logoutEp = discovered.find((d) => d.path.includes('/logout'));
      const deleteEp = discovered.find((d) => d.path.includes('/account/delete'));
      const profileEp = discovered.find((d) => d.path.includes('/profile?id=1'));

      expect(logoutEp).toBeUndefined();
      expect(deleteEp).toBeUndefined();
      expect(profileEp).toBeDefined();
    });

    it('strictly excludes 404 Not Found, soft-404 error pages, and only shows endpoints with real response data', async () => {
      const crawler = new TargetSiteCrawler();

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        if (req.targetUrl.includes('/api/live-products')) {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            body: '{"products": [{"id": 1, "name": "Security Suite"}]}',
            rawResponse: '',
            sizeBytes: 52,
          } as any;
        }

        if (req.targetUrl.includes('/missing-endpoint')) {
          return {
            statusCode: 404,
            statusText: 'Not Found',
            headers: {},
            body: '<html><body><h1>404 Not Found</h1></body></html>',
            rawResponse: '',
            sizeBytes: 45,
          } as any;
        }

        if (req.targetUrl.includes('/soft-404-page')) {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: {},
            body: '<html><head><title>404 Page Not Found</title></head><body>The requested URL was not found.</body></html>',
            rawResponse: '',
            sizeBytes: 80,
          } as any;
        }

        // Root page with links
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: '<html><body><a href="/api/live-products">Live Products</a><a href="/missing-endpoint">Missing</a><a href="/soft-404-page">Soft 404</a></body></html>',
          rawResponse: '',
          sizeBytes: 130,
        } as any;
      });

      const discovered = await crawler.crawlHost('https://target.corp', undefined, { maxDepth: 2 });

      // Live product endpoint MUST be discovered and have statusCode: 200
      const liveEp = discovered.find((d) => d.path.includes('/api/live-products'));
      expect(liveEp).toBeDefined();
      expect(liveEp?.statusCode).toBe(200);

      // 404 and Soft-404 endpoints MUST NOT be displayed
      const missingEp = discovered.find((d) => d.path.includes('/missing-endpoint'));
      expect(missingEp).toBeUndefined();

      const soft404Ep = discovered.find((d) => d.path.includes('/soft-404-page'));
      expect(soft404Ep).toBeUndefined();

      // No endpoint with statusCode === 404 should ever be present
      expect(discovered.some((d) => d.statusCode === 404)).toBe(false);
    });
  });

  describe('OpenAPI / Swagger & GraphQL Discovery', () => {
    it('parses OpenAPI 3.0 specification into structured endpoints with typed parameters', () => {
      const crawler = new TargetSiteCrawler();
      const openApiSpec = {
        openapi: '3.0.0',
        paths: {
          '/api/v1/users/{userId}': {
            get: {
              summary: 'Get user by ID',
              parameters: [
                { name: 'userId', in: 'path', schema: { type: 'integer', default: 42 } },
                { name: 'fields', in: 'query', schema: { type: 'string', default: 'email,role' } },
              ],
            },
            post: {
              summary: 'Update user',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      properties: {
                        username: { type: 'string', default: 'alice' },
                        roleId: { type: 'integer', default: 2 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const endpoints = crawler.parseOpenApiSchema('https://api.target.corp', 'api.target.corp', openApiSpec);

      expect(endpoints.length).toBe(2);

      const getEp = endpoints.find((e) => e.method === 'GET');
      expect(getEp).toBeDefined();
      expect(getEp?.source).toBe('openapi');
      expect(getEp?.path).toContain('/api/v1/users/1?fields=');
      expect(getEp?.params.some((p) => p.name === 'userId')).toBe(true);

      const postEp = endpoints.find((e) => e.method === 'POST');
      expect(postEp).toBeDefined();
      expect(postEp?.headers['Content-Type']).toBe('application/json');
      expect(postEp?.params.some((p) => p.name === 'username' && p.type === 'body_json')).toBe(true);
      expect(postEp?.body).toContain('"username"');
      expect(postEp?.workflowType).toBe('store');
    });
  });

  describe('Client-Side SPA Routing & REST Extraction', () => {
    it('extracts React Router paths, template literals, and fetch JSON payloads', () => {
      const crawler = new TargetSiteCrawler();
      const mockJs = `
        import { Route } from 'react-router-dom';
        const routes = (
          <div>
            <Route path="/admin/organizations/:orgId/audit" element={<Audit />} />
            <Route path="/dashboard/billing/:invoiceId" element={<Billing />} />
          </div>
        );

        function loadDetails(id) {
          fetch(\`/api/v2/orders/\${id}/details?view=full\`);
        }

        async function createAccount(data) {
          await axios.post('/api/v1/accounts/register', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.email, tier: data.tier, accountType: 'corp' })
          });
        }
      `;

      const endpoints = crawler.extractJsEndpoints('https://target.corp', 'target.corp', mockJs);

      expect(endpoints.length).toBeGreaterThanOrEqual(3);

      // SPA route resolution
      const spaEp = endpoints.find((e) => e.path.includes('/admin/organizations/1/audit'));
      expect(spaEp).toBeDefined();
      expect(spaEp?.workflowType).toBe('trigger');

      // Template literal resolution
      const templateEp = endpoints.find((e) => e.path.includes('/api/v2/orders/1/details'));
      expect(templateEp).toBeDefined();

      // JSON payload resolution
      const jsonEp = endpoints.find((e) => e.path.includes('/api/v1/accounts/register'));
      expect(jsonEp).toBeDefined();
      expect(jsonEp?.method).toBe('POST');
      expect(jsonEp?.params.some((p) => p.name === 'email' && p.type === 'body_json')).toBe(true);
      expect(jsonEp?.params.some((p) => p.name === 'tier' && p.type === 'body_json')).toBe(true);
      expect(jsonEp?.workflowType).toBe('store');
    });
  });

  describe('Deep DOM Scraping: Comments, Data Attributes & Forms', () => {
    it('extracts endpoints from HTML comments, data-* attributes, and select/textarea elements', () => {
      const crawler = new TargetSiteCrawler();
      const mockHtml = `
        <!-- DEV NOTE: temporary internal api: /api/v1/debug/metrics?server=node-1 -->
        <div class="user-card" data-api="/api/v1/users/profile?uid=999" data-target="/items/preview?id=500">
          <form action="/feedback/submit" method="POST">
            <select name="rating">
              <option value="5">Excellent</option>
              <option value="1">Poor</option>
            </select>
            <textarea name="comment">Great tool</textarea>
            <button type="submit">Send</button>
          </form>
        </div>
      `;
      const mockHeaders = {
        Link: '</api/v1/prefetched_catalog?cat=electronics>; rel="preload"',
      };

      const endpoints = crawler.scrapeHtmlForEndpoints('https://target.corp', 'target.corp', mockHtml, mockHeaders);

      // Comment endpoint
      const commentEp = endpoints.find((e) => e.source === 'html_comment');
      expect(commentEp).toBeDefined();
      expect(commentEp?.path).toContain('/api/v1/debug/metrics');

      // Data attribute endpoint
      const dataEp = endpoints.find((e) => e.source === 'html_data_attr');
      expect(dataEp).toBeDefined();
      expect(dataEp?.path).toContain('/api/v1/users/profile');

      // Select and Textarea form extraction
      const formEp = endpoints.find((e) => e.source === 'html_form');
      expect(formEp).toBeDefined();
      expect(formEp?.params.some((p) => p.name === 'rating')).toBe(true);
      expect(formEp?.params.some((p) => p.name === 'comment')).toBe(true);

      // Response header endpoint
      const headerEp = endpoints.find((e) => e.source === 'header');
      expect(headerEp).toBeDefined();
      expect(headerEp?.path).toContain('/api/v1/prefetched_catalog');
    });
  });

  describe('Smart URL Clustering & Crawler Trap Prevention', () => {
    it('clusters structurally identical URLs and normalizes query parameter order', () => {
      const cluster1 = TargetSiteCrawler.getClusterSignature('/items/101', 'sort=asc&cat=1');
      const cluster2 = TargetSiteCrawler.getClusterSignature('/items/202', 'cat=5&sort=desc');

      expect(cluster1).toBe('/items/{id}?cat&sort');
      expect(cluster2).toBe('/items/{id}?cat&sort');
      expect(cluster1).toBe(cluster2);
    });

    it('identifies recursive crawler traps with repeating segments', () => {
      expect(TargetSiteCrawler.isCrawlerTrap('/calendar/2026/01/calendar/2026/02/calendar/2026/03')).toBe(true);
      expect(TargetSiteCrawler.isCrawlerTrap('/node/1/node/1/node/1')).toBe(true);
      expect(TargetSiteCrawler.isCrawlerTrap('/products/category/shoes/item/101')).toBe(false);
    });
  });

  describe('Second-Order Workflow Classification', () => {
    it('correctly classifies store vs trigger endpoints for second-order injection correlation', () => {
      expect(TargetSiteCrawler.classifyWorkflowType('POST', '/api/users/register')).toBe('store');
      expect(TargetSiteCrawler.classifyWorkflowType('POST', '/feedback/submit')).toBe('store');
      expect(TargetSiteCrawler.classifyWorkflowType('PUT', '/profile/edit')).toBe('store');

      expect(TargetSiteCrawler.classifyWorkflowType('GET', '/admin/audit_logs')).toBe('trigger');
      expect(TargetSiteCrawler.classifyWorkflowType('GET', '/reports/financial_summary')).toBe('trigger');
      expect(TargetSiteCrawler.classifyWorkflowType('GET', '/search?q=test')).toBe('trigger');

      expect(TargetSiteCrawler.classifyWorkflowType('GET', '/about')).toBe('read_only');
    });
  });

  describe('Modern Framework Manifest & Script Bundle Mining', () => {
    it('extracts 100% of Next.js routes from _buildManifest.js with resolved dynamic parameters', async () => {
      const crawler = new TargetSiteCrawler();
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script id="__NEXT_DATA__" type="application/json">
              {"props":{},"page":"/","query":{},"buildId":"prod_build_99x"}
            </script>
          </head>
          <body><div id="__next"></div></body>
        </html>
      `;

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        if (req.targetUrl.includes('/_next/static/prod_build_99x/_buildManifest.js')) {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: {},
            body: `
              self.__BUILD_MANIFEST = {
                __rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
                "/": ["static/chunks/pages/index.js"],
                "/admin/organizations/[orgId]/billing": ["static/chunks/pages/billing.js"],
                "/api/v1/auth/[...slug]": ["static/chunks/pages/auth.js"],
                "/_error": ["static/chunks/pages/_error.js"],
                "/reports/security_audit": ["static/chunks/pages/audit.js"]
              };
            `,
            rawResponse: '',
            sizeBytes: 300,
          } as any;
        }

        return { statusCode: 404, statusText: 'Not Found', headers: {}, body: '', rawResponse: '', sizeBytes: 0 } as any;
      });

      const endpoints = await crawler.probeFrameworkManifests('https://target.corp', 'target.corp', mockHtml);

      expect(endpoints.length).toBeGreaterThanOrEqual(3);

      // Verify dynamic parameter resolution: [orgId] -> 1
      const billingEp = endpoints.find((e) => e.path.includes('/admin/organizations/1/billing'));
      expect(billingEp).toBeDefined();
      expect(billingEp?.statusCode).toBe(200);

      // Verify catch-all parameter resolution: [...slug] -> 1
      const authEp = endpoints.find((e) => e.path.includes('/api/v1/auth/1'));
      expect(authEp).toBeDefined();

      // Verify static route
      const auditEp = endpoints.find((e) => e.path.includes('/reports/security_audit'));
      expect(auditEp).toBeDefined();

      // Verify internal _error page was excluded
      const errorEp = endpoints.find((e) => e.path.includes('/_error'));
      expect(errorEp).toBeUndefined();
    });

    it('downloads external first-party script bundles, ignores third-party trackers, and extracts REST endpoints', async () => {
      const crawler = new TargetSiteCrawler();
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script src="https://www.googletagmanager.com/gtm.js?id=GTM-123"></script>
            <script src="https://js.sentry-cdn.com/bundle.min.js"></script>
            <script src="/static/js/main.app.chunk.js"></script>
          </head>
          <body><div id="root"></div></body>
        </html>
      `;

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        if (req.targetUrl.includes('/static/js/main.app.chunk.js')) {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/javascript' },
            body: `
              function sendFeedback(data) {
                axios.post('/api/v2/customer/feedback', {
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rating: data.stars, comment: data.msg })
                });
              }
              const route = "/admin/users/:userId/roles";
            `,
            rawResponse: '',
            sizeBytes: 250,
          } as any;
        }

        return { statusCode: 404, statusText: 'Not Found', headers: {}, body: '', rawResponse: '', sizeBytes: 0 } as any;
      });

      const endpoints = await crawler.extractAndScanExternalScripts('https://target.corp', 'target.corp', mockHtml);

      expect(endpoints.length).toBeGreaterThanOrEqual(1);

      const feedbackEp = endpoints.find((e) => e.path.includes('/api/v2/customer/feedback'));
      expect(feedbackEp).toBeDefined();
      expect(feedbackEp?.method).toBe('POST');
      expect(feedbackEp?.params.some((p) => p.name === 'rating')).toBe(true);

      const roleEp = endpoints.find((e) => e.path.includes('/admin/users/1/roles'));
      expect(roleEp).toBeDefined();
    });

    it('injects coordinated Chrome Client Hints and passes inherited session cookies', async () => {
      const crawler = new TargetSiteCrawler();
      let sentRawRequest = '';

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        sentRawRequest = req.rawRequest;
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: '<html><body><a href="/profile?id=1">Profile</a></body></html>',
          rawResponse: '',
          sizeBytes: 80,
        } as any;
      });

      await crawler.crawlHost('https://target.corp', undefined, {
        maxDepth: 1,
        headers: {
          Authorization: 'Bearer secret_jwt_token',
        },
        cookies: 'session_id=s3cur3_c00k1e',
      });

      // Verify Chrome Client Hints are present
      expect(sentRawRequest).toContain('Sec-CH-UA: "Chromium";v="124"');
      expect(sentRawRequest).toContain('Sec-Fetch-Mode: navigate');

      // Verify session auth headers were inherited
      expect(sentRawRequest).toContain('Authorization: Bearer secret_jwt_token');
      expect(sentRawRequest).toContain('Cookie: session_id=s3cur3_c00k1e');
    });

    it('extracts routes from Next.js 14/15 App Router chunk paths and flight streams', async () => {
      const crawler = new TargetSiteCrawler();
      const mockAppRouterHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script src="/_next/static/chunks/app/(portal)/dashboard/settings/page-c9182a.js"></script>
            <script src="/_next/static/chunks/app/api/billing/invoices/[invoiceId]/route-77b19a.js"></script>
            <script src="/_next/static/chunks/app/(admin)/users/[id]/permissions/page.js"></script>
          </head>
          <body>
            <div id="root"></div>
            <script>
              self.__next_f.push([1, "1:[\"$\",\"$L2\",null,{\"url\":\"/api/v2/telemetry/metrics\"}]"]);
            </script>
          </body>
        </html>
      `;

      const endpoints = await crawler.probeFrameworkManifests('https://target.corp', 'target.corp', mockAppRouterHtml);

      // Verify route groups (portal) stripped & path extracted
      const settingsEp = endpoints.find((e) => e.path.includes('/dashboard/settings'));
      expect(settingsEp).toBeDefined();

      // Verify server route handler & dynamic parameter resolution
      const invoiceEp = endpoints.find((e) => e.path.includes('/api/billing/invoices/1'));
      expect(invoiceEp).toBeDefined();

      // Verify nested group & dynamic parameter resolution
      const permEp = endpoints.find((e) => e.path.includes('/users/1/permissions'));
      expect(permEp).toBeDefined();

      // Verify flight stream route extraction
      const flightEp = endpoints.find((e) => e.path.includes('/api/v2/telemetry/metrics'));
      expect(flightEp).toBeDefined();
    });

    it('extracts routes from Nuxt 3 __NUXT_DATA__ and Remix __remixManifest', async () => {
      const crawler = new TargetSiteCrawler();
      const mockNuxtHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script id="__NUXT_DATA__" type="application/json">
              ["Reactive",{"path":"/dashboard"},"/admin/security_controls","/api/v1/inventory",99]
            </script>
          </head>
          <body><div id="__nuxt"></div></body>
        </html>
      `;

      const nuxtEndpoints = await crawler.probeFrameworkManifests('https://target.corp', 'target.corp', mockNuxtHtml);
      expect(nuxtEndpoints.some((e) => e.path.includes('/admin/security_controls'))).toBe(true);
      expect(nuxtEndpoints.some((e) => e.path.includes('/api/v1/inventory'))).toBe(true);

      const mockRemixHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script>
              window.__remixManifest = {
                routes: {
                  "root": { id: "root" },
                  "routes/admin.tenants.$tenantId": { path: "admin/tenants/:tenantId" },
                  "routes/api.webhooks": { path: "api/webhooks" }
                }
              };
            </script>
          </head>
          <body></body>
        </html>
      `;

      const remixEndpoints = await crawler.probeFrameworkManifests('https://target.corp', 'target.corp', mockRemixHtml);
      expect(remixEndpoints.some((e) => e.path.includes('/admin/tenants/1'))).toBe(true);
      expect(remixEndpoints.some((e) => e.path.includes('/api/webhooks'))).toBe(true);
    });

    it('extracts programmatic router navigation and resolves Axios baseURL relative endpoints', () => {
      const crawler = new TargetSiteCrawler();
      const mockJs = `
        function navigateUser(id) {
          router.push('/dashboard/analytics?range=monthly');
          navigate('/profile/credentials');
        }

        const apiClient = axios.create({
          baseURL: '/api/v1',
          timeout: 5000
        });

        async function fetchUserData() {
          await apiClient.get('/users/active');
          await apiClient.post('/orders/checkout', { itemId: 42 });
        }
      `;

      const endpoints = crawler.extractJsEndpoints('https://target.corp', 'target.corp', mockJs);

      // Programmatic navigation
      expect(endpoints.some((e) => e.path.includes('/dashboard/analytics?range=monthly'))).toBe(true);
      expect(endpoints.some((e) => e.path.includes('/profile/credentials'))).toBe(true);

      // Axios baseURL synthesis: /api/v1 + /users/active -> /api/v1/users/active
      expect(endpoints.some((e) => e.path.includes('/api/v1/users/active'))).toBe(true);
      expect(endpoints.some((e) => e.path.includes('/api/v1/orders/checkout'))).toBe(true);
    });

    it('follows HTTP 301/302 redirects to discover target destination endpoints', async () => {
      const crawler = new TargetSiteCrawler();
      const visited: string[] = [];

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        const u = new URL(req.targetUrl);
        visited.push(u.pathname);

        if (u.pathname === '/') {
          return {
            statusCode: 302,
            statusText: 'Found',
            headers: { location: '/app/login' },
            body: 'Redirecting to /app/login',
            rawResponse: '',
            sizeBytes: 25,
          } as any;
        }

        if (u.pathname === '/app/login') {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: {},
            body: '<html><body><h1>Login</h1><a href="/app/register">Register</a></body></html>',
            rawResponse: '',
            sizeBytes: 80,
          } as any;
        }

        if (u.pathname === '/app/register') {
          return {
            statusCode: 200,
            statusText: 'OK',
            headers: {},
            body: '<html><body><h1>Register</h1></body></html>',
            rawResponse: '',
            sizeBytes: 50,
          } as any;
        }

        return { statusCode: 404, statusText: 'Not Found', headers: {}, body: '', rawResponse: '', sizeBytes: 0 } as any;
      });

      const results = await crawler.crawlHost('https://target.corp', undefined, { maxDepth: 2 });

      expect(visited).toContain('/app/login');
      expect(results.some((r) => r.path === '/app/login')).toBe(true);
      expect(results.some((r) => r.path === '/app/register')).toBe(true);
    });

    it('detects WAF challenges (e.g. Cloudflare / 429) and triggers adaptive throttling', async () => {
      const crawler = new TargetSiteCrawler();
      const progressMessages: string[] = [];

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (req: any) => {
        const u = new URL(req.targetUrl);
        if (u.pathname === '/') {
          return {
            statusCode: 403,
            statusText: 'Forbidden',
            headers: { 'cf-ray': '87654321-IAD', server: 'cloudflare' },
            body: '<html><head><title>Attention Required! | Cloudflare</title></head><body>Error 1020 Access Denied</body></html>',
            rawResponse: '',
            sizeBytes: 120,
          } as any;
        }

        return { statusCode: 404, statusText: 'Not Found', headers: {}, body: '', rawResponse: '', sizeBytes: 0 } as any;
      });

      await crawler.crawlHost(
        'https://target.corp',
        (msg) => {
          progressMessages.push(msg);
        },
        { maxPages: 2, delayMs: 10 }
      );

      // Verify WAF challenge detection message was broadcast
      expect(progressMessages.some((m) => m.includes('WAF challenge') && m.includes('Cloudflare'))).toBe(true);
    });

    it('adapts concurrency, timing, and session injection between Machine Blitz and Stealth Hybrid modes', async () => {
      const crawler = new TargetSiteCrawler();
      const machineMsgs: string[] = [];
      const hybridMsgs: string[] = [];

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (_req: any) => {
        return {
          statusCode: 200,
          statusText: 'OK',
          headers: {},
          body: '<html><body><a href="/catalog?item=1">Catalog</a></body></html>',
          rawResponse: '',
          sizeBytes: 80,
        } as any;
      });

      // 1. Run Machine Blitz Mode
      await crawler.crawlHost(
        'https://target.corp',
        (msg) => {
          machineMsgs.push(msg);
        },
        { crawlMode: 'machine', maxPages: 2, delayMs: 5 }
      );

      expect(machineMsgs[0]).toContain('[Machine Blitz Mode]');

      // 2. Run Stealth Hybrid Mode with captured clearance cookies
      await crawler.crawlHost(
        'https://target.corp',
        (msg) => {
          hybridMsgs.push(msg);
        },
        {
          crawlMode: 'hybrid',
          maxPages: 2,
          delayMs: 15,
          cookies: 'cf_clearance=valid_cf_token; session=auth_cookie',
          headers: { 'X-Signature': 'dynamic_hmac_hash' },
        }
      );

      expect(hybridMsgs[0]).toContain('[Stealth Hybrid Mode]');
      expect(hybridMsgs[0]).toContain('polite jitter');
    });
  });
});

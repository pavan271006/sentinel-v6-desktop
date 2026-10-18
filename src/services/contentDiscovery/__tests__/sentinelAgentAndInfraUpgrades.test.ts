import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfrastructureOriginService, infrastructureOriginService } from '../InfrastructureOriginService';
import { JSluiceMiningService, jsluiceMiningService } from '../JSluiceMiningService';
import { gauArchiveService } from '../GauArchiveService';
import { sentinelAgentBridge } from '../SentinelAgentBridge';
import { ipcClient } from '../../../ipc/client';

describe('Sentinel Pre-Assessment Deep Recon & AI Agent Bridge Upgrades', () => {
  beforeEach(() => {
    vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async (params: any) => {
      return {
        tabId: params?.tabId || 'test',
        statusCode: 200,
        statusText: 'OK',
        body: '<html><head><title>Test Target</title></head><body>OK</body></html>',
        headers: [{ name: 'server', value: 'nginx' }],
        roundTripTime: 10,
        time: 10,
        timestamp: Date.now(),
        rawResponse: 'HTTP/1.1 200 OK\r\n\r\nOK',
      } as any;
    });
  });

  it('computes exact Shodan-compatible MurmurHash3_32 and Favicon hash', () => {
    const encoder = new TextEncoder();
    const hash = InfrastructureOriginService.murmurHash3_32(encoder.encode('test-favicon-payload'), 0);
    expect(typeof hash).toBe('number');
    expect(hash).not.toBe(0);

    const faviconHash = InfrastructureOriginService.computeShodanFaviconHash(encoder.encode('GIF89a...'));
    expect(typeof faviconHash).toBe('number');
  });

  it('folds axios.create baseURL instances, Array.join("/"), TypeScript enums, and Next.js registerServerReference via AST', () => {
    const sampleBundle = `
      const API_PREFIX = "/api/v3";
      const apiClient = axios.create({ baseURL: API_PREFIX });
      var AdminRoutes;
      (function (AdminRoutes) {
        AdminRoutes["USERS"] = "/internal/admin/users";
        AdminRoutes.BILLING = "/internal/admin/billing";
      })(AdminRoutes || (AdminRoutes = {}));

      function loadAll() {
        apiClient.post("/checkout/confirm", { orderId: 123, couponCode: "SAVE" });
        fetch(AdminRoutes["USERS"]);
        fetch(AdminRoutes.BILLING);
        axios.get(["", "api", "v2", "reports", "export"].join("/"));
        registerServerReference(actionFn, "7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e", "updateUserRole");
      }
    `;

    const res = jsluiceMiningService.parseScriptContent(sampleBundle, 'bundle.js', 'example.com');
    const paths = res.endpoints.map((e) => `${e.method}:${e.path}`);

    expect(paths).toContain('POST:/api/v3/checkout/confirm');
    expect(paths).toContain('GET:/internal/admin/users');
    expect(paths).toContain('GET:/internal/admin/billing');
    expect(paths).toContain('GET:/api/v2/reports/export');
    expect(paths).toContain('POST:/_next/action/7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e');
  });

  it('calculates Shannon entropy and detects modern AI/Cloud secrets', () => {
    const entropyLow = JSluiceMiningService.calculateShannonEntropy('aaaaaaaaaa');
    const entropyHigh = JSluiceMiningService.calculateShannonEntropy('gsk_9aB3xLpQ7vR2mN8kZ4wY6tJ1cH5fG0dS9aB3xLpQ7vR2mN8k');
    expect(entropyLow).toBe(0);
    expect(entropyHigh).toBeGreaterThan(4.0);

    const codeWithSecrets = `
      const groqKey = "gsk_9aB3xLpQ7vR2mN8kZ4wY6tJ1cH5fG0dS9aB3xLpQ7vR2mN8k";
      const bearerToken = "Bearer test_generic_token_abcdef1234567890";
    `;
    const parsed = jsluiceMiningService.parseScriptContent(codeWithSecrets, 'config.js', 'example.com');
    expect(parsed.secrets.some((s) => s.type === 'Groq API Key')).toBe(true);
    expect(parsed.secrets.some((s) => s.type === 'Generic Bearer Token')).toBe(true);
  });

  it('extrapolates legacy API versions (/v1, /v0, /beta, /internal) from discovered versioned endpoints', () => {
    const extrapolated = gauArchiveService.extrapolateLegacyApiVersions([
      {
        url: 'https://api.example.com/api/v3/users/profile',
        host: 'api.example.com',
        path: '/api/v3/users/profile',
        params: false,
        source: 'wayback',
      },
    ]);
    const legacyPaths = extrapolated.map((e) => e.path);
    expect(legacyPaths).toContain('/api/v1/users/profile');
    expect(legacyPaths).toContain('/api/v2/users/profile');
    expect(legacyPaths).toContain('/api/v0/users/profile');
    expect(legacyPaths).toContain('/api/beta/users/profile');
    expect(legacyPaths).toContain('/api/internal/users/profile');
  });

  it('exposes OpenAI/Anthropic/MCP compatible tool definitions on SentinelAgentBridge', () => {
    const tools = sentinelAgentBridge.getAgentToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(8);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('sentinel_capture_full_knowledge_base');
    expect(toolNames).toContain('sentinel_recon_infrastructure');
    expect(toolNames).toContain('sentinel_dredge_client_bundles');
    expect(toolNames).toContain('sentinel_stealth_browser_crawl');
    expect(toolNames).toContain('sentinel_mine_historical_archives');
    expect(toolNames).toContain('sentinel_browser_fetch');
  });

  it('runs deterministic heuristic pre-assessment in AutonomousPentestAgent with zero API keys', async () => {
    const { autonomousPentestAgent } = await import('../../ai/AutonomousPentestAgent');
    const mockKb: any = {
      target: {
        host: 'test-target.corp',
        rootUrl: 'https://test-target.corp/',
        capturedAt: Date.now(),
        detectedCdnOrWaf: 'Cloudflare',
        detectedSaasEcosystem: ['Google Workspace'],
      },
      pillar1_infrastructure: {
        host: 'test-target.corp',
        timestamp: Date.now(),
        dnsRecords: [],
        subdomains: [{ subdomain: 'vpn.test-target.corp', source: 'crt.sh', confidence: 'HIGH' }],
        emailSecurity: { hasSpf: true, spfRecord: '', hasDkim: false, hasDmarc: false, dmarcRecord: '', extractedIpv4Ranges: [], detectedSaasVendors: [] },
        originAnalysis: {
          detectedCdnOrWaf: 'Cloudflare',
          originCandidateIps: [{ ip: '198.51.100.22', source: 'SPF Netblock', confidence: 'HIGH' }],
          faviconMurmurHash3: 12345678,
          matchedShodanQuery: 'http.favicon.hash:12345678',
        },
        cloudBuckets: [{ provider: 'AWS S3', bucketName: 'test-target-assets', endpointUrl: 'https://test-target-assets.s3.amazonaws.com', accessStatus: 'PUBLIC_READ' }],
        danglingCnames: [],
      },
      pillar2_staticClientDredging: {
        unpackedSourceMaps: [],
        astExtractedEndpoints: [{ path: '/_next/action/hash123', method: 'POST', sourceFile: 'bundle.js', type: 'NEXT_SERVER_ACTION' }],
        nextServerActions: [{ path: '/_next/action/hash123', method: 'POST', sourceFile: 'bundle.js', type: 'NEXT_SERVER_ACTION' }],
        synthesizedLazyChunks: [],
        extractedRequestSchemas: [],
        discoveredSecrets: [{ type: 'AWS Secret Key', value: 'AKIAIOSFODNN7EXAMPLE', sourceScript: 'main.js', snippet: '', entropy: 4.5 }],
      },
      pillar3_dynamicBrowserCrawl: {
        cdpConnected: false,
        routerRoutes: [],
        offlineStorageAndIndexedDb: [],
        domForms: [],
        crawledEndpointsCount: 1,
      },
      pillar4_historicalArchives: {
        waybackCount: 45,
        commonCrawlCount: 12,
        alienVaultCount: 5,
        urlScanCount: 2,
        legacyApiExtrapolations: ['/api/v1/users'],
        robotsDisallowedPaths: ['/admin'],
        archivedJsBundles: [],
        apiDocs: [],
        graphqlIntrospection: [],
        exposedDebugFindings: [],
      },
      clusteredAttackSurface: [],
      idorCandidates: [],
      allDiscoveredRequests: [],
    };
    sentinelAgentBridge.setCachedKnowledgeBase('test-target.corp', mockKb);

    const logs: any[] = [];
    const report = await autonomousPentestAgent.runAssessment({
      targetUrl: 'https://test-target.corp',
      objective: 'Full offensive recon and origin candidate discovery',
      onStep: (step) => logs.push(step),
    });

    expect(report.targetHost).toBe('test-target.corp');
    expect(report.executionMode).toBe('DETERMINISTIC_HEURISTIC');
    expect(report.stepLogs.length).toBeGreaterThan(0);
    expect(logs.length).toBeGreaterThan(0);
    expect(report.keyFindings.some((f) => f.category === 'ORIGIN_DECLOAK')).toBe(true);
    expect(report.keyFindings.some((f) => f.category === 'BUCKET_EXPOSURE')).toBe(true);
    expect(report.keyFindings.some((f) => f.category === 'SERVER_ACTION')).toBe(true);
    expect(report.keyFindings.some((f) => f.category === 'SECRET_EXPOSURE')).toBe(true);
    expect(report.executiveSummary).toContain('Autonomous Pre-Assessment Reconnaissance Report');
    expect(report.executiveSummary).toContain('test-target.corp');
  });

  it('invokes agent tools and autonomous assessment via SentinelIpcClient fallback', async () => {
    const { ipcClient } = await import('../../../ipc/client');
    const kb = await ipcClient.getAgentKnowledgeBase('test-target.corp');
    expect(kb).toBeDefined();

    const toolResult = await ipcClient.callAgentTool('sentinel_query_knowledge_base', {
      targetHost: 'test-target.corp',
      category: 'summary',
    });
    expect(toolResult).toBeDefined();
    expect(toolResult.target).toBeDefined();
    expect(toolResult.target.host).toBe('test-target.corp');
  });

  it('unpacks OpenAPI 3.0 specs, OIDC .well-known configs, Universal Links, and SPA manifests via SourceMapRouteMiner', async () => {
    const { sourceMapRouteMiner } = await import('../SourceMapRouteMiner');

    const openApiJson = JSON.stringify({
      openapi: '3.0.1',
      paths: {
        '/api/v2/admin/audit-logs': {
          get: {
            summary: 'Fetch admin audit logs',
            parameters: [{ name: 'tenantId', in: 'query' }, { name: 'limit', in: 'query' }],
          },
          post: {
            summary: 'Export audit logs',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    properties: { format: { type: 'string' }, includeRaw: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          AuditExportPayload: {
            properties: {
              format: { type: 'string' },
              includeRaw: { type: 'boolean' },
              destinationBucket: { type: 'string' },
            },
          },
        },
      },
    });

    const specRes = sourceMapRouteMiner.parseApiSpecificationOrManifest('/openapi.json', openApiJson, 'target.local');
    expect(specRes.endpoints.some((e) => e.path.startsWith('/api/v2/admin/audit-logs') && e.method === 'GET')).toBe(true);
    expect(specRes.endpoints.some((e) => e.path === '/api/v2/admin/audit-logs' && e.method === 'POST')).toBe(true);
    expect(specRes.extractedSchemas.some((s) => s.name === 'AuditExportPayload' && s.fields.includes('destinationBucket'))).toBe(true);

    const oidcJson = JSON.stringify({
      issuer: 'https://target.local',
      authorization_endpoint: 'https://target.local/oauth2/authorize',
      token_endpoint: 'https://target.local/oauth2/token',
      userinfo_endpoint: 'https://target.local/oauth2/userinfo',
      jwks_uri: 'https://target.local/.well-known/jwks.json',
    });
    const oidcRes = sourceMapRouteMiner.parseApiSpecificationOrManifest('/.well-known/openid-configuration', oidcJson, 'target.local');
    expect(oidcRes.endpoints.some((e) => e.path === '/oauth2/token' && e.method === 'POST')).toBe(true);
    expect(oidcRes.endpoints.some((e) => e.path === '/.well-known/jwks.json' && e.method === 'GET')).toBe(true);
  });

  it('passively mines Link/CSP headers, JSON HATEOAS links, inline scripts, and compiles the 4-Pillar Knowledge Base in StateFlowGraphCrawler', async () => {
    const { StateFlowGraphCrawler } = await import('../StateFlowGraphCrawler');
    const crawler = new StateFlowGraphCrawler();

    const discovered: any[] = [];
    crawler.registerQualityResponseItem(
      'https://stealth-target.corp/api/v1/orders',
      'stealth-target.corp',
      'GET',
      200,
      'OK',
      {
        'content-type': 'application/json',
        link: '</api/v1/orders?page=2>; rel="next", </api/v1/orders/schema>; rel="describedby"',
        'content-security-policy': "default-src 'self'; connect-src https://api.stealth-target.corp/v2/billing; report-uri /api/security/violations",
      },
      JSON.stringify({
        data: [{ id: 101 }],
        next_page_url: '/api/v1/orders?cursor=xyz',
        webhook: '/api/v1/webhooks/register',
      }),
      'application/json',
      undefined,
      (item) => discovered.push(item)
    );

    expect(discovered.some((d) => d.path === '/api/v1/orders?page=2')).toBe(true);
    expect(discovered.some((d) => d.path === '/api/security/violations' && d.method === 'POST')).toBe(true);
    expect(discovered.some((d) => d.path === '/v2/billing')).toBe(true);
    expect(discovered.some((d) => d.path === '/api/v1/orders?cursor=xyz')).toBe(true);
    expect(discovered.some((d) => d.path === '/api/v1/webhooks/register')).toBe(true);

    crawler.ingestScriptContentIntelligence(
      'https://stealth-target.corp/#inline-0',
      `
        interface BillingUpdateDto { planId: string; couponCode?: string; }
        const client = axios.create({ baseURL: "/api/internal" });
        client.post("/billing/upgrade", { planId: "enterprise" });
        registerServerReference(actionFn, "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e", "upgradePlan");
      `,
      'stealth-target.corp',
      'https://stealth-target.corp/',
      (item) => discovered.push(item)
    );

    const kb = await crawler.compileAndCacheStealthKnowledgeBase('stealth-target.corp', 'https://stealth-target.corp/');
    expect(kb.target.host).toBe('stealth-target.corp');
    expect(kb.pillar2_staticClientDredging.astExtractedEndpoints.some((e: any) => e.path === '/api/internal/billing/upgrade')).toBe(true);
    expect(kb.pillar2_staticClientDredging.nextServerActions.some((a) => a.path === '/_next/action/9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e')).toBe(true);
    expect(kb.pillar2_staticClientDredging.extractedRequestSchemas.some((s) => s.name === 'BillingUpdateDto')).toBe(true);
    expect(sentinelAgentBridge.getCachedKnowledgeBase('stealth-target.corp')).toBeDefined();
  });

  it('10. actively tests origin IP candidates for direct host-header matching and WAF bypass', async () => {
    (ipcClient.sendRepeaterRequest as any).mockImplementationOnce(async ({ rawRequest }: any) => {
      expect(rawRequest).toContain('Host: decloaked-target.com');
      return {
        statusCode: 200,
        body: '<html><head><title>Secure Dashboard - decloaked-target.com</title></head><body>Welcome</body></html>',
        headers: [{ name: 'server', value: 'nginx/1.24.0 (Ubuntu)' }],
      };
    });

    const verifyRes = await infrastructureOriginService.verifyOriginIpCandidate('decloaked-target.com', '198.51.100.42');
    expect(verifyRes.verified).toBe(true);
    expect(verifyRes.wafBypassed).toBe(true);
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.title).toBe('Secure Dashboard - decloaked-target.com');

    // Test tool dispatch via SentinelAgentBridge
    (ipcClient.sendRepeaterRequest as any).mockImplementationOnce(async () => ({
      statusCode: 200,
      body: '<html><head><title>Admin Portal</title></head></html>',
    }));

    const toolRes = await sentinelAgentBridge.executeTool('sentinel_verify_origin_bypass', {
      targetHost: 'decloaked-target.com',
      candidateIp: '198.51.100.42',
    });
    expect(toolRes.verified).toBe(true);
  });

  it('11. dispatches active pentest tools (repeater requests, HTTPQL queries, and nuclei scanner) through SentinelAgentBridge', async () => {
    // 1. Test sentinel_send_repeater_request
    (ipcClient.sendRepeaterRequest as any).mockImplementationOnce(async ({ targetUrl, rawRequest }: any) => {
      expect(targetUrl).toBe('https://api.target.com/v1/auth');
      expect(rawRequest).toContain('POST /v1/auth HTTP/1.1');
      expect(rawRequest).toContain('{"token":"exploit_123"}');
      return {
        statusCode: 200,
        statusText: 'OK',
        body: '{"authenticated":true,"role":"admin"}',
        headers: [{ name: 'content-type', value: 'application/json' }],
      };
    });

    const repRes = await sentinelAgentBridge.executeTool('sentinel_send_repeater_request', {
      targetUrl: 'https://api.target.com/v1/auth',
      method: 'POST',
      body: '{"token":"exploit_123"}',
    });
    expect(repRes.statusCode).toBe(200);
    expect(repRes.body).toContain('admin');

    // 2. Test sentinel_query_traffic_httpql
    const httpqlRes = await sentinelAgentBridge.executeTool('sentinel_query_traffic_httpql', {
      query: 'req.method == "GET"',
      limit: '5',
    });
    expect(httpqlRes.query).toBe('req.method == "GET"');
    expect(Array.isArray(httpqlRes.results)).toBe(true);

    // 3. Verify total registered tool count
    const tools = sentinelAgentBridge.getAgentToolDefinitions();
    expect(tools.length).toBe(15);
    expect(tools.some((t) => t.name === 'sentinel_send_repeater_request')).toBe(true);
    expect(tools.some((t) => t.name === 'sentinel_run_turbo_fuzzer')).toBe(true);
    expect(tools.some((t) => t.name === 'sentinel_run_nuclei_scan')).toBe(true);
    expect(tools.some((t) => t.name === 'sentinel_query_traffic_httpql')).toBe(true);
  });
});


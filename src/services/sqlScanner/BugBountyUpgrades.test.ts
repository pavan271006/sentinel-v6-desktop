import { describe, it, expect, vi } from 'vitest';
import { SemanticDiffEngine } from './engine/SemanticDiffEngine';
import { SessionManager } from './engine/SessionManager';
import { CsrfSynchronizer } from './engine/CsrfSynchronizer';
import { BountyTemplateExporter } from './engine/BountyTemplateExporter';
import { TlsFingerprintEngine } from './engine/TlsFingerprintEngine';
import { MarkovNavigationEngine } from './engine/MarkovNavigationEngine';
import { TrpcBatchParser } from './engine/TrpcBatchParser';
import { MultiAccountBoundaryTester } from './engine/MultiAccountBoundaryTester';
import { PersistentOastTracker } from './engine/PersistentOastTracker';
import { RequestParser } from './RequestParser';
import { SqlScanFinding, SqlScanReport } from '../../types/sqlScanner';

describe('Bug Bounty Specialist Upgrades Suite', () => {
  describe('Pillar 4: SemanticDiffEngine (Noise-Canceling AST/DOM Diffs)', () => {
    it('masks dynamic timestamps and UUIDs in JSON responses to eliminate false positives', () => {
      const resA = JSON.stringify({
        status: 'success',
        data: { id: 101, username: 'admin' },
        timestamp: '2026-09-06T12:00:00.000Z',
        trace_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      const resB = JSON.stringify({
        status: 'success',
        data: { id: 101, username: 'admin' },
        timestamp: '2026-09-06T12:05:43.123Z',
        trace_id: 'f9e8d7c6-b5a4-3210-fedc-ba0987654321',
      });

      const diff = SemanticDiffEngine.compare(resA, resB);
      expect(diff.isStructurallyIdentical).toBe(true);
      expect(diff.normalizedDistance).toBe(0.0);
      expect(diff.cosineSimilarity).toBe(1.0);
    });

    it('detects structural divergence when actual SQL data differences occur', () => {
      const resA = JSON.stringify({
        status: 'success',
        data: { id: 101, username: 'admin' },
      });

      const resB = JSON.stringify({
        status: 'error',
        error: 'Query failed near syntax error',
      });

      const diff = SemanticDiffEngine.compare(resA, resB);
      expect(diff.isStructurallyIdentical).toBe(false);
      expect(diff.normalizedDistance).toBeGreaterThan(0.2);
    });

    it('sanitizes dynamic HTML elements (scripts, comments, CSRF inputs, timestamps)', () => {
      const htmlA = `
        <html>
          <head><script>var tracker = 987123;</script></head>
          <body>
            <input type="hidden" name="csrf_token" value="abc123nonce456">
            <h1>Welcome, admin</h1>
            <p>Generated at: 2026-09-06T12:00:00Z</p>
          </body>
        </html>
      `;

      const htmlB = `
        <html>
          <head><script>var tracker = 112233;</script></head>
          <body>
            <input type="hidden" name="csrf_token" value="xyz789nonce000">
            <h1>Welcome, admin</h1>
            <p>Generated at: 2026-09-06T12:08:15Z</p>
          </body>
        </html>
      `;

      const diff = SemanticDiffEngine.compare(htmlA, htmlB);
      expect(diff.isStructurallyIdentical).toBe(true);
      expect(diff.normalizedDistance).toBe(0.0);
    });
  });

  describe('Pillar 2: State, Session & CsrfSynchronizer', () => {
    it('extracts CSRF tokens from response HTML forms and JSON payloads', () => {
      const html = `<form><input type="hidden" name="authenticity_token" value="superSecretCsrf123"></form>`;
      const token = CsrfSynchronizer.extractToken([], html);
      expect(token).not.toBeNull();
      expect(token?.tokenValue).toBe('superSecretCsrf123');
    });

    it('extracts CSRF tokens from response headers', () => {
      const headers = [{ name: 'X-CSRF-Token', value: 'headerToken456' }];
      const token = CsrfSynchronizer.extractToken(headers, '');
      expect(token?.tokenName).toBe('X-CSRF-Token');
      expect(token?.tokenValue).toBe('headerToken456');
    });

    it('maintains session cookies and detects session expiration on 401/403', () => {
      const session = new SessionManager([{ name: 'Cookie', value: 'session_id=init123', enabled: true }]);

      // Update with Set-Cookie
      session.updateFromResponse(200, [{ name: 'Set-Cookie', value: 'session_id=newSession456; Path=/; HttpOnly' }], 'OK');
      expect(session.getCookieHeader()).toContain('session_id=newSession456');
      expect(session.isSessionExpired()).toBe(false);

      // Simulate 401 Unauthorized twice
      session.updateFromResponse(401, [], 'Unauthorized');
      session.updateFromResponse(401, [], 'Unauthorized');
      expect(session.isSessionExpired()).toBe(true);
    });
  });

  describe('Pillar 6: BountyTemplateExporter (1-Click Reports)', () => {
    const mockFinding: SqlScanFinding = {
      id: 'f-1',
      title: 'Conditional Error SQL Injection (MySQL)',
      severity: 'Critical',
      confidence: 'Confirmed',
      confidenceScore: 100,
      confidenceBreakdown: { score: 100, level: 'Confirmed', factors: [] },
      injectionType: 'Error-based',
      parameterName: 'category',
      parameterLocation: 'query',
      url: 'https://target.local/filter?category=Gifts',
      httpMethod: 'GET',
      dbms: 'MySQL',
      dbmsVersion: '8.0.32',
      detectionMethod: 'Causal Pearl do-Calculus',
      evidence: [
        {
          id: 'ev-1',
          title: 'Conditional Error Verification',
          timestamp: Date.now(),
          injectionType: 'Error-based',
          parameterName: 'category',
          parameterLocation: 'query',
          payload: "' AND IF(1=1, EXP(710), 1)-- -",
          baselineStatus: 200,
          baselineLength: 1500,
          baselineDurationMs: 45,
          testStatus: 500,
          testLength: 450,
          testDurationMs: 50,
          rawRequest: 'GET /filter?category=%27+AND+IF(1=1%2C+EXP(710)%2C+1)--+- HTTP/1.1\nHost: target.local\n\n',
          rawResponse: 'HTTP/1.1 500 Internal Server Error\n\n',
          analysisSummary: 'Numeric overflow trigger confirmed database execution divergence',
        },
      ],
      reproductionRequest: 'GET /filter?category=%27+AND+IF(1=1%2C+EXP(710)%2C+1)--+- HTTP/1.1\nHost: target.local\n\n',
      remediation: 'Use parameterized queries.',
      cwe: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
      timestamp: Date.now(),
    };

    const mockReport: SqlScanReport = {
      id: 'rep-1',
      generatedAt: Date.now(),
      targetUrl: 'https://target.local/filter?category=Gifts',
      targetMethod: 'GET',
      verdict: 'VULNERABLE',
      verdictReason: '1 SQL injection confirmed',
      durationMs: 1200,
      requestsSent: 8,
      testsExecuted: 4,
      confirmedIndicators: 1,
      waf: { detected: false, confidence: 'Informational', evidence: [] },
      dbms: { dbms: 'MySQL', confidence: 'Confirmed', confidenceScore: 100, evidence: [] },
      findings: [mockFinding],
      catalog: { dbms: 'MySQL', schemas: [], applicationTables: [], systemTables: [], discoveredAt: Date.now() },
      coverage: [],
      executionLogs: [],
      executiveSummary: '',
      technicalDetails: '',
    };

    it('generates a compliant HackerOne Markdown report with CVSS and safe curl PoC', () => {
      const h1Report = BountyTemplateExporter.exportHackerOne(mockFinding, mockReport);
      expect(h1Report).toContain('## Summary');
      expect(h1Report).toContain('Critical Severity SQL Injection');
      expect(h1Report).toContain('CVSS v3.1:');
      expect(h1Report).toContain('Minimal Non-Destructive cURL Command');
      expect(h1Report).toContain('curl -s -i -k -X GET');
      expect(h1Report).toContain('Recommended Fix');
    });

    it('generates a Bugcrowd Markdown report', () => {
      const bcReport = BountyTemplateExporter.exportBugcrowd(mockFinding, mockReport);
      expect(bcReport).toContain('### Vulnerability Title');
      expect(bcReport).toContain('### Proof of Concept');
      expect(bcReport).toContain('Server-Side Injection > SQL Injection (SQLi)');
    });
  });

  describe('Pillar 3: Extended Ingress Headers', () => {
    it('parses reverse-proxy trust headers as candidate injection points', () => {
      const rawHttp = [
        'GET /api/v1/user HTTP/1.1',
        'Host: target.local',
        'CF-Connecting-IP: 203.0.113.195',
        'X-Forwarded-For: 198.51.100.1',
        'X-Original-URL: /admin/dashboard',
        '',
        '',
      ].join('\n');

      const parsed = RequestParser.parse(rawHttp, 'https://target.local/api/v1/user');
      const headerParams = parsed.parameters.filter((p) => p.location === 'header');
      const paramNames = headerParams.map((p) => p.name.toLowerCase());

      expect(paramNames).toContain('cf-connecting-ip');
      expect(paramNames).toContain('x-forwarded-for');
      expect(paramNames).toContain('x-original-url');
    });
  });

  describe('Pillar 1: Stealth & TlsFingerprintEngine', () => {
    it('generates Chrome Windows 11 JA4 profile and ordered headers', () => {
      const headers = [{ name: 'Authorization', value: 'Bearer token123', enabled: true }];
      const browserHeaders = TlsFingerprintEngine.applyBrowserFingerprint(headers, 'api.target.local');

      const names = browserHeaders.map((h) => h.name.toLowerCase());
      expect(names).toContain('sec-ch-ua');
      expect(names).toContain('user-agent');
      expect(names).toContain('authorization');
      expect(names[0]).toBe('host');
    });

    it('generates Poisson-distributed ghost jitter bounded within reasonable limits', () => {
      const delay1 = TlsFingerprintEngine.generateGhostJitterMs(3.5);
      const delay2 = TlsFingerprintEngine.generateGhostJitterMs(3.5);

      expect(delay1).toBeGreaterThanOrEqual(50);
      expect(delay1).toBeLessThanOrEqual(14000);
      expect(delay2).toBeGreaterThanOrEqual(50);
      expect(delay2).toBeLessThanOrEqual(14000);
    });
  });

  describe('Pillar 3: Modern tRPC Batch Parsing', () => {
    it('detects and extracts candidate injection parameters from tRPC batch JSON', () => {
      const trpcBatch = {
        '0': { json: { userId: '1092', role: 'admin' } },
        '1': { json: { reportType: 'annual_audit' } },
      };

      const isTrpc = TrpcBatchParser.isTrpcPayload(trpcBatch);
      expect(isTrpc).toBe(true);

      const params = TrpcBatchParser.extractParameters(trpcBatch);
      expect(params.length).toBe(3);
      expect(params.some((p) => p.name.includes('userId'))).toBe(true);
      expect(params.some((p) => p.name.includes('reportType'))).toBe(true);
    });
  });

  describe('Pillar 2: Multi-Account Boundary & Tenant Isolation', () => {
    it('detects when victim private canary or tenant ID leaks into attacker response', () => {
      const attackerResponse = '{"status":"ok","profile":{"bio":"Hello","canary":"VICTIM_SECRET_CANARY_XYZ"}}';
      const result = MultiAccountBoundaryTester.evaluateBoundary(attackerResponse, {
        privateCanary: 'VICTIM_SECRET_CANARY_XYZ',
        userId: 'victim_user_99',
      });

      expect(result.isCrossTenantBreached).toBe(true);
      expect(result.victimDataReflected).toBe(true);
      expect(result.canaryFound).toBe('VICTIM_SECRET_CANARY_XYZ');
      expect(result.evidence).toContain('CRITICAL TENANT BREACH');
    });

    it('confirms boundaries intact when no victim identifiers are reflected', () => {
      const attackerResponse = '{"status":"ok","profile":{"bio":"Hello","canary":"ATTACKER_CANARY"}}';
      const result = MultiAccountBoundaryTester.evaluateBoundary(attackerResponse, {
        privateCanary: 'VICTIM_SECRET_CANARY_XYZ',
        userId: 'victim_user_99',
      });

      expect(result.isCrossTenantBreached).toBe(false);
      expect(result.victimDataReflected).toBe(false);
      expect(result.evidence).toContain('boundaries intact');
    });
  });

  describe('Pillar 5: Persistent Asynchronous OAST Tracker & Webhook Telemetry', () => {
    it('registers long-lived OAST tokens and correlates callbacks to original parameters', () => {
      const { tokenId, fqdn } = PersistentOastTracker.registerToken(
        'https://target.local/api/report',
        'export_format',
        "'||(SELECT UTL_INADDR.get_host_name('oast.local'))||'"
      );

      expect(tokenId).toBeDefined();
      expect(fqdn).toContain(tokenId);

      const record = PersistentOastTracker.handleInteraction(tokenId, 'DNS', '198.51.100.55', 'snt-lookup');
      expect(record).not.toBeNull();
      expect(record?.clientIp).toBe('198.51.100.55');
      expect(record?.parameterName).toBe('export_format');

      const webhook = PersistentOastTracker.formatWebhookPayload(record!);
      expect(webhook.title).toContain('Sentinel Asynchronous SQL Injection Alert');
      expect(webhook.fields.some((f) => f.name === 'Target URL')).toBe(true);
    });
  });

  describe('Pillar 7: Ultra-Stealth & Anti-Ban Ghost Network Pipeline', () => {
    it('strips all 24 tracking and internal headers from probe requests', () => {
      const rawHttp = [
        'GET /profile HTTP/1.1',
        'Host: secure.target.local',
        'X-Scanner: Sentinel-V6',
        'X-Sentinel-Worker: worker_9',
        'X-Forwarded-For: 127.0.0.1',
        'Postman-Token: abc-123',
        'X-WAP-Profile: mobile',
        'Cookie: session=s123',
        '',
        '',
      ].join('\r\n');

      const parsed = RequestParser.parse(rawHttp, 'https://secure.target.local/profile');
      const param = parsed.parameters.find((p) => p.name === 'session')!;
      const injected = RequestParser.injectPayload(parsed, param, 's123_mutated', false);

      expect(injected.rawRequest).not.toContain('X-Scanner');
      expect(injected.rawRequest).not.toContain('X-Sentinel-Worker');
      expect(injected.rawRequest).not.toContain('Postman-Token');
      expect(injected.rawRequest).not.toContain('X-WAP-Profile');
      expect(injected.rawRequest).toContain('Cookie: session=s123_mutated');
    });

    it('enforces 30s cooldown on 429 and 60s quarantine on 403 in ProxyPool', async () => {
      const { ProxyPool } = await import('./stealth/ProxyPool');
      const pool = new ProxyPool([
        { host: '10.0.0.1', port: 8080, type: 'http', healthy: true, lastUsed: 0, requestCount: 0, avgLatencyMs: 20, failCount: 0 },
        { host: '10.0.0.2', port: 8080, type: 'http', healthy: true, lastUsed: 0, requestCount: 0, avgLatencyMs: 30, failCount: 0 },
      ]);

      const p1 = pool.getNext('smart');
      expect(p1?.host).toBe('10.0.0.1');

      // Mark p1 with rate limit (429)
      pool.markFailed(p1!, 'rate-limit');
      expect(p1!.cooldownUntil).toBeGreaterThan(Date.now());

      // Next proxy should seamlessly be p2
      const p2 = pool.getNext('smart');
      expect(p2?.host).toBe('10.0.0.2');

      // Mark p2 with WAF block (403)
      pool.markFailed(p2!, 'waf-block');
      expect(p2!.cooldownUntil).toBeGreaterThan(Date.now() + 50000);
    });

    it('executes automatic failover in ScanContext when target returns 429 rate-limited', async () => {
      const { ScanContext } = await import('./pipeline/ScanContext');
      const { ipcClient } = await import('../../ipc/client');

      let callCount = 0;
      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First proxy gets 429
          return { statusCode: 429, body: 'Too Many Requests', headers: [], durationMs: 15 } as any;
        }
        // Failover proxy succeeds
        return { statusCode: 200, body: '<div>Success Profile</div>', headers: [], durationMs: 20 } as any;
      });

      const ctx = new ScanContext({
        target: {
          id: 'stealth-test',
          name: 'Stealth Test',
          rawRequest: 'GET /test?q=1 HTTP/1.1\r\nHost: target.local\r\n\r\n',
          url: 'https://target.local/test?q=1',
          method: 'GET',
          headers: [],
          body: '',
          parameters: [{ id: 'q', name: 'q', location: 'query', originalValue: '1', enabled: true }],
          testedInjectionTypes: {} as any,
        },
        proxies: [
          { host: '1.1.1.1', port: 8080, type: 'http', healthy: true, lastUsed: 0, requestCount: 0, avgLatencyMs: 10, failCount: 0 },
          { host: '2.2.2.2', port: 8080, type: 'http', healthy: true, lastUsed: 0, requestCount: 0, avgLatencyMs: 10, failCount: 0 },
        ],
      });

      const param = ctx.candidateParameters[0];
      const res = await ctx.sendMutatedRequest(param, '1 OR 1=1');

      expect(callCount).toBe(2);
      expect(res.status).toBe(200);
      expect(res.body).toContain('Success Profile');
    });

    it('emulates Firefox 132 HTTP/2 pseudo-header and cipher profiles', () => {
      const ff = TlsFingerprintEngine.getProfile('firefox');
      expect(ff.name).toContain('Firefox 132');
      expect(ff.pseudoHeaderOrder).toEqual([':method', ':path', ':authority', ':scheme']);
      expect(ff.ja4Fingerprint).toBe('t13d1715h2_5b57614c22b0_c1044439c21b');
    });

    it('generates natural referers and interspersed background asset requests via MarkovNavigationEngine', () => {
      const engine = new MarkovNavigationEngine('https://target.local/catalog?category=Gifts');
      engine.recordVisit('https://target.local/catalog?category=Gifts');
      engine.recordVisit('https://target.local/product/101');

      const naturalReferer = engine.getNaturalReferer('https://target.local/product/101');
      expect(naturalReferer).toBe('https://target.local/catalog?category=Gifts');

      const asset = engine.generateInterspersedAssetProbe('https://target.local/product/101');
      expect(asset).not.toBeNull();
      expect(asset?.url).toContain('https://target.local');
      expect(asset?.headers['Sec-Fetch-Mode']).toBe('no-cors');
    });
  });
});


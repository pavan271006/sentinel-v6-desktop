import { describe, it, expect, vi } from 'vitest';
import { IastRuntimeSensor } from './IastRuntimeSensor';
import { HeadlessDomBridge } from './HeadlessDomBridge';
import { WafBypassOrchestrator } from './WafBypassOrchestrator';
import { MacroStateReplayEngine } from './MacroStateReplayEngine';
import { GrayBoxScanEngine } from './GrayBoxScanEngine';
import { GhostNetwork, GhostHttpRequest, GhostHttpResponse } from '../stealth/GhostNetwork';
import { ScanTargetConfig } from '../../../types/sqlScanner';

function createMockGhostResponse(overrides: Partial<GhostHttpResponse>): GhostHttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '',
    timing: { dns: 0, tcp: 0, tls: 0, firstByte: 0, total: 50 },
    sizeBytes: 100,
    usedProxy: null,
    usedUserAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

describe('Gray-Box & Hybrid Scanner Upgrades (The 4 Boundaries)', () => {

  // =========================================================================
  // BOUNDARY 1: Air-Gapped Asynchronous Sinks via IAST
  // =========================================================================
  describe('Boundary 1: Air-Gapped Asynchronous Sinks (IAST Sensor)', () => {
    it('detects AST grammar breach in internal async worker query with zero egress', () => {
      const sensor = new IastRuntimeSensor({ enabled: true });
      const payload = "' UNION SELECT NULL, @@version--";
      sensor.registerTaint('search_query', payload);

      // Simulate internal background batch job executing raw query in an air-gapped worker
      const internalExecutedSql = `SELECT * FROM internal_archive WHERE query_text = '${payload}' AND status = 'queued'`;
      const event = sensor.interceptDriverQuery(
        internalExecutedSql,
        'cron/async_archive_processor.ts:54'
      );

      expect(event).not.toBeNull();
      expect(event?.isVulnerable).toBe(true);
      expect(event?.grammarViolation).toContain('AST Projection Breach');

      const findings = sensor.getFindings();
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe('Critical');
      expect(findings[0].confidence).toBe('Confirmed');
      expect(findings[0].sinkLocation).toBe('cron/async_archive_processor.ts:54');
    });

    it('detects stacked query command injection in air-gapped worker', () => {
      const sensor = new IastRuntimeSensor({ enabled: true });
      const payload = "1; DROP TABLE audit_log--";
      sensor.registerTaint('batch_id', payload);

      const internalSql = `UPDATE batches SET status = 'processed' WHERE batch_id = ${payload}`;
      const event = sensor.interceptDriverQuery(internalSql, 'workers/batch_cleanup.py:112');

      expect(event?.isVulnerable).toBe(true);
      expect(event?.grammarViolation).toContain('Stacked statement boundary');
    });

    it('confirms data-plane containment (no breach) when input is cleanly parameterized', () => {
      const sensor = new IastRuntimeSensor({ enabled: true });
      const safeInput = 'alice_user';
      sensor.registerTaint('username', safeInput);

      // Driver executes properly escaped or parameterized literal
      const safeSql = `SELECT * FROM users WHERE username = '${safeInput}'`;
      const event = sensor.interceptDriverQuery(safeSql, 'auth/service.ts:32');

      expect(event?.isVulnerable).toBe(false);
      expect(event?.grammarViolation).toContain('Data-plane containment preserved');
      expect(sensor.getFindings().length).toBe(0);
    });
  });

  // =========================================================================
  // BOUNDARY 2: Client-Side Proprietary Encryption (DOM Ingress)
  // =========================================================================
  describe('Boundary 2: Client-Side Proprietary Encryption (Headless DOM Bridge)', () => {
    it('generates executable DOM injection script for frontend inputs', () => {
      const bridge = new HeadlessDomBridge({ enabled: true });
      const script = bridge.generateDomInjectionScript('input[name="user_email"]', "admin' OR 1=1--");

      expect(script).toContain('document.querySelector("input[name=\\"user_email\\"]")');
      expect(script).toContain("admin' OR 1=1--");
      expect(script).toContain('dispatchEvent');
    });

    it('packages pre-encryption DOM input into valid encrypted envelope and verifies server decryption', async () => {
      const bridge = new HeadlessDomBridge({
        enabled: true,
        targetFormSelector: '/api/v2/secure-auth',
        inputSelectors: { sensitive_token: '#token-input' },
      });

      const payload = "token_xyz' OR '1'='1";
      const result = await bridge.executePreEncryptionInjection(
        {
          id: 'p1',
          name: 'sensitive_token',
          location: 'body_json',
          originalValue: 'test',
          enabled: true,
        },
        payload
      );

      expect(result.success).toBe(true);
      expect(result.encryptedEnvelope).toBeDefined();
      expect(result.encryptedEnvelope?.headers['X-Client-Encrypted']).toBe('true');

      // Verify that server-side decryption recovers the uncorrupted SQL payload
      const body = JSON.parse(result.encryptedEnvelope?.body || '{}');
      const decrypted = HeadlessDomBridge.verifyServerSideDecryption(body.envelope);
      expect(decrypted).not.toBeNull();
      expect(decrypted?.sensitive_token).toBe(payload);
    });
  });

  // =========================================================================
  // BOUNDARY 3: Bot Mitigation & Turnstile CAPTCHA (WAF Bypass Orchestrator)
  // =========================================================================
  describe('Boundary 3: Bot Mitigation & Hard Turnstile CAPTCHAs', () => {
    it('detects Cloudflare Turnstile challenge pages correctly', () => {
      const orchestrator = new WafBypassOrchestrator({ enabled: true });
      const mockChallengeResponse = createMockGhostResponse({
        status: 403,
        headers: { 'cf-ray': '89b2c3d4e5f6', 'content-type': 'text/html' },
        body: '<html><body><div id="cf-turnstile">Please verify you are human</div><div id="turnstile-wrapper"></div></body></html>',
      });

      const result = orchestrator.evaluateResponseForChallenges(mockChallengeResponse);
      expect(result.isChallenge).toBe(true);
      expect(result.gatewayType).toBe('Cloudflare Turnstile');
    });

    it('decorates outgoing requests with authorized test bypass headers and cf_clearance cookies', () => {
      const orchestrator = new WafBypassOrchestrator({
        enabled: true,
        bypassHeaders: {
          'CF-Access-Client-Id': 'test-scanner-client-01',
          'X-Scanner-Bypass-Token': 'sec_corp_staging_99',
        },
        clearanceCookies: {
          cf_clearance: 'abc123token',
          session_verified: 'true',
        },
        userAgentProfile: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinelAudit/2.0',
      });

      const rawRequest: GhostHttpRequest = {
        url: 'https://staging.internal/api/query',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'existing_pref=dark',
        },
        body: '{"q": "test"}',
      };

      const decorated = orchestrator.decorateRequest(rawRequest);

      expect(decorated.headers['CF-Access-Client-Id']).toBe('test-scanner-client-01');
      expect(decorated.headers['X-Scanner-Bypass-Token']).toBe('sec_corp_staging_99');
      expect(decorated.headers['User-Agent']).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinelAudit/2.0');
      expect(decorated.headers['Cookie']).toContain('existing_pref=dark');
      expect(decorated.headers['Cookie']).toContain('cf_clearance=abc123token');
      expect(decorated.headers['Cookie']).toContain('session_verified=true');
    });
  });

  // =========================================================================
  // BOUNDARY 4: Complex Gated Business Logic & 2FA State Replay
  // =========================================================================
  describe('Boundary 4: Complex Gated Business Logic (MacroStateReplayEngine)', () => {
    it('replays multi-step workflow carrying session cookies, CSRF tokens, and 2FA to target sink', async () => {
      const network = new GhostNetwork();

      // Mock multi-step stateful endpoint responses
      vi.spyOn(network, 'executeRequest').mockImplementation(async (req: GhostHttpRequest): Promise<GhostHttpResponse> => {
        if (req.url.includes('/api/auth/login')) {
          return createMockGhostResponse({
            status: 200,
            headers: { 'set-cookie': 'pre_auth_session=s1001; Path=/; HttpOnly' },
            body: JSON.stringify({ message: '2FA Required', requires2fa: true }),
          });
        }

        if (req.url.includes('/api/auth/2fa-verify')) {
          // Verify 2FA received
          const body = JSON.parse(req.body || '{}');
          if (body.otp === '000000' && req.headers['Cookie']?.includes('pre_auth_session=s1001')) {
            return createMockGhostResponse({
              status: 200,
              headers: {
                'set-cookie': 'auth_session=auth_token_999; Path=/; HttpOnly',
              },
              body: '<html><meta name="csrf-token" content="dyn_csrf_777abc"><body>Dashboard</body></html>',
            });
          }
          return createMockGhostResponse({ status: 401, headers: {}, body: 'Invalid OTP' });
        }

        if (req.url.includes('/api/checkout/cart')) {
          if (req.headers['Cookie']?.includes('auth_session=auth_token_999')) {
            return createMockGhostResponse({
              status: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ cartId: 'cart_555' }),
            });
          }
          return createMockGhostResponse({ status: 401, headers: {}, body: 'Unauthorized' });
        }

        if (req.url.includes('/api/checkout/apply-coupon')) {
          // Final Sink Step
          if (
            req.headers['Cookie']?.includes('auth_session=auth_token_999') &&
            req.headers['X-CSRF-Token'] === 'dyn_csrf_777abc'
          ) {
            const body = JSON.parse(req.body || '{}');
            if (body.coupon.includes("' OR 1=1--")) {
              return createMockGhostResponse({
                status: 500,
                headers: {},
                body: 'Database Error: Syntax error near unexpected token OR in PostgreSQL query SELECT * FROM coupons WHERE code = ...',
              });
            }
            return createMockGhostResponse({ status: 200, headers: {}, body: JSON.stringify({ discount: 10 }) });
          }
          return createMockGhostResponse({ status: 403, headers: {}, body: 'Forbidden: Missing CSRF or Session' });
        }

        return createMockGhostResponse({ status: 404, headers: {}, body: 'Not Found' });
      });

      const macroEngine = new MacroStateReplayEngine({ enabled: true }, network);

      const workflowSteps = [
        {
          id: 'step_1',
          name: 'Step 1: Login',
          url: 'https://app.corp/api/auth/login',
          method: 'POST',
          body: JSON.stringify({ username: 'admin', password: 'password123' }),
        },
        {
          id: 'step_2',
          name: 'Step 2: 2FA Verification',
          url: 'https://app.corp/api/auth/2fa-verify',
          method: 'POST',
          body: JSON.stringify({ otp: '000000' }),
          authGates: [{ type: 'static_otp' as const, paramName: 'otp', secretOrToken: '000000' }],
        },
        {
          id: 'step_3',
          name: 'Step 3: Initialize Cart',
          url: 'https://app.corp/api/checkout/cart',
          method: 'POST',
          body: JSON.stringify({ action: 'create' }),
        },
        {
          id: 'step_4',
          name: 'Step 4: Apply Coupon (Sink)',
          url: 'https://app.corp/api/checkout/apply-coupon',
          method: 'POST',
          body: JSON.stringify({ coupon: 'DISCOUNT10' }),
          isInjectionTarget: true,
          targetParameter: 'coupon',
        },
      ];

      const result = await macroEngine.executeWorkflowWithPayload(
        workflowSteps,
        'coupon',
        "' OR 1=1--"
      );

      expect(result.success).toBe(true);
      expect(result.stepsCompleted).toBe(4);
      expect(result.extractedContext.cookies['auth_session']).toBe('auth_token_999');
      expect(result.extractedContext.tokens['csrf_token']).toBe('dyn_csrf_777abc');
      expect(result.finalResponse?.status).toBe(500);
      expect(result.finalResponse?.body).toContain('Database Error: Syntax error near unexpected token OR');
    });
  });

  // =========================================================================
  // INTEGRATION: Unified GrayBoxScanEngine
  // =========================================================================
  describe('Unified GrayBoxScanEngine Orchestration', () => {
    it('executes a hybrid assessment with all 4 boundaries active', async () => {
      const mockTarget: ScanTargetConfig = {
        id: 'target_gb_01',
        name: 'Enterprise Hybrid Target',
        rawRequest: 'POST /api/action HTTP/1.1\r\nHost: target.internal\r\n\r\nid=1',
        url: 'https://target.internal/api/action',
        method: 'POST',
        headers: [{ name: 'Content-Type', value: 'application/json', enabled: true }],
        body: '{"id": 1}',
        parameters: [
          {
            id: 'p_async',
            name: 'async_param',
            location: 'body_json',
            originalValue: '1',
            enabled: true,
          },
        ],
        testedInjectionTypes: {
          errorBased: true,
          booleanBased: true,
          timeBased: true,
          unionBased: true,
          orderBy: true,
          groupBy: true,
          having: true,
          stackedBased: true,
          secondOrder: true,
        },
        grayBoxConfig: {
          enabled: true,
          mode: 'hybrid',
          iastConfig: { enabled: true },
          botBypassConfig: {
            enabled: true,
            bypassHeaders: { 'X-Scanner-Bypass-Token': 'tok_xyz' },
          },
          headlessDomConfig: { enabled: true },
          macroWorkflowConfig: {
            enabled: true,
            steps: [
              {
                id: 's1',
                name: 'Direct Sink',
                url: 'https://target.internal/api/action',
                method: 'POST',
                body: '{"id": "test"}',
                isInjectionTarget: true,
                targetParameter: 'id',
              },
            ],
          },
        },
      };

      const engine = new GrayBoxScanEngine(mockTarget);
      expect(engine.iastSensor).toBeDefined();
      expect(engine.wafBypass).toBeDefined();
      expect(engine.macroEngine).toBeDefined();
      expect(engine.domBridge).toBeDefined();

      const report = await engine.executeHybridScan();

      expect(report.grayBoxEnabled).toBe(true);
      expect(report.boundariesTested.airGappedAsyncSink).toBe(true);
      expect(report.boundariesTested.botMitigation).toBe(true);
      expect(report.boundariesTested.multiStepState).toBe(true);
      expect(report.boundariesTested.clientSideEncryption).toBe(true);
      expect(report.telemetryLogs.length).toBeGreaterThan(0);
    });
  });
});

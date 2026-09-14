import { describe, it, expect, vi } from 'vitest';
import { AntiBotSolver } from './AntiBotSolver';
import { CanvasAstExtractor } from './CanvasAstExtractor';
import { StreamProtocolMapper } from './StreamProtocolMapper';
import { EphemeralNonceReplenisher } from './EphemeralNonceReplenisher';
import { ProxyRotator } from './ProxyRotator';
import { ipcClient } from '../../../ipc/client';

describe('Modern Web Limitation Elimination Engines', () => {
  describe('AntiBotSolver (Zero-Human Unattended Cloudflare Mode)', () => {
    it('detects Cloudflare Under-Attack challenges and extracts Turnstile sitekeys', () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Just a moment... | Cloudflare</title></head>
          <body>
            <div id="cf-turnstile" data-sitekey="0x4AAAAAAABcdEF123456789" data-action="login" data-cdata="xyz99"></div>
          </body>
        </html>
      `;

      const isChallenge = AntiBotSolver.isChallengePresent(403, { 'cf-ray': '890123-ORD' }, mockHtml);
      expect(isChallenge).toBe(true);

      const challengeInfo = AntiBotSolver.extractSitekey(mockHtml);
      expect(challengeInfo).toBeDefined();
      expect(challengeInfo?.sitekey).toBe('0x4AAAAAAABcdEF123456789');
      expect(challengeInfo?.action).toBe('login');
      expect(challengeInfo?.cData).toBe('xyz99');
    });

    it('solves challenge autonomously in zero-human mode', async () => {
      const solver = new AntiBotSolver({ provider: 'capsolver', apiKey: 'test_api_key_123' });
      const mockHtml = '<div data-sitekey="0x4AAAAAAABcdEF123456789"></div>';

      const solution = await solver.solveChallenge('https://target.corp/login', mockHtml);
      expect(solution.success).toBe(true);
      expect(solution.clearanceCookie).toContain('cf_clearance=');
      expect(solution.turnstileToken).toBeDefined();
    });
  });

  describe('CanvasAstExtractor (Canvas & WebGL / Flutter Web / WASM)', () => {
    it('detects Flutter Web / CanvasKit HTML signatures', () => {
      const mockFlutterHtml = `
        <!DOCTYPE html>
        <html>
          <head><script src="flutter.js" defer></script></head>
          <body>
            <canvas id="flutter-canvas" class="flt-glass-pane"></canvas>
          </body>
        </html>
      `;

      expect(CanvasAstExtractor.isCanvasOrWasmApp(mockFlutterHtml)).toBe(true);
      expect(CanvasAstExtractor.isCanvasOrWasmApp('<div><p>Standard DOM</p></div>')).toBe(false);
    });

    it('dissects compiled Dart constant pools and extracts REST routes & JSON model payloads', () => {
      const mockDartJs = `
        // Compiled Flutter Web bundle
        const str1 = "/api/v1/customers/profile?tier=gold";
        const str2 = "/orders/history";

        function sendOrder(data) {
          dio.post("/api/v2/checkout/process", data: {
            "accountId": data.acc,
            "orderTotal": data.amount,
            "shippingType": "express"
          });
        }

        const gql = "query GetUserFeed { user(id: 101) { feed { title } } }";
      `;

      const endpoints = CanvasAstExtractor.extractEndpointsFromDartBundle(
        'https://app.target.corp',
        'app.target.corp',
        mockDartJs
      );

      expect(endpoints.length).toBeGreaterThanOrEqual(3);

      const customerEp = endpoints.find((e) => e.path.includes('/api/v1/customers/profile'));
      expect(customerEp).toBeDefined();
      expect(customerEp?.params.some((p) => p.name === 'tier')).toBe(true);

      const checkoutEp = endpoints.find((e) => e.path.includes('/api/v2/checkout/process'));
      expect(checkoutEp).toBeDefined();
      expect(checkoutEp?.method).toBe('POST');
      expect(checkoutEp?.params.some((p) => p.name === 'accountId')).toBe(true);
      expect(checkoutEp?.body).toContain('"accountId"');

      const gqlEp = endpoints.find((e) => e.path === '/graphql');
      expect(gqlEp).toBeDefined();
      expect(gqlEp?.body).toContain('GetUserFeed');
    });
  });

  describe('StreamProtocolMapper (WebSockets & Binary gRPC-Web Streams)', () => {
    it('extracts WebSocket connection routes and JSON-RPC message schemas', () => {
      const mockJs = `
        const ws = new WebSocket("wss://target.corp/ws/v1/feed");
        function requestData() {
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "getAccountLedger",
            params: { accountId: 999 }
          }));
        }
      `;

      const wsEndpoints = StreamProtocolMapper.extractWebSocketEndpoints(
        'https://target.corp',
        'target.corp',
        mockJs
      );

      expect(wsEndpoints.length).toBeGreaterThanOrEqual(1);
      const wsEp = wsEndpoints[0];
      expect(wsEp.path).toBe('/ws/v1/feed');
      expect(wsEp.statusCode).toBe(101);
      expect(wsEp.isSqliCandidate).toBe(true);
      expect(wsEp.params.some((p) => p.name === 'id')).toBe(true);
    });

    it('extracts binary gRPC-Web service methods and synthesizes Protobuf probe endpoints', () => {
      const mockJs = `
        const OrderServiceMethod = "/order.OrderService/GetOrderDetails";
        const PaymentServiceMethod = "/fintech.PaymentService/ProcessPayment";
      `;

      const grpcEndpoints = StreamProtocolMapper.extractGrpcWebEndpoints(
        'https://target.corp',
        'target.corp',
        mockJs
      );

      expect(grpcEndpoints.length).toBe(2);

      const orderEp = grpcEndpoints.find((e) => e.path === '/order.OrderService/GetOrderDetails');
      expect(orderEp).toBeDefined();
      expect(orderEp?.headers['Content-Type']).toBe('application/grpc-web+proto');
      expect(orderEp?.headers['X-Grpc-Web']).toBe('1');
      expect(orderEp?.isSqliCandidate).toBe(true);
    });
  });

  describe('EphemeralNonceReplenisher (Strict Single-Use CSRF Tokens)', () => {
    it('pre-fetches fresh anti-forgery nonces and rewrites outbound request headers and bodies', async () => {
      const replenisher = new EphemeralNonceReplenisher();

      replenisher.registerFormOrigin('/api/v1/transfer', 'https://target.corp/transfer-form', '_csrf');

      vi.spyOn(ipcClient, 'sendRepeaterRequest').mockResolvedValueOnce({
        statusCode: 200,
        statusText: 'OK',
        headers: { 'x-csrf-token': 'fresh_single_use_token_9988' },
        body: '<html><input name="_csrf" value="fresh_single_use_token_9988" /></html>',
        rawResponse: '',
        sizeBytes: 120,
      } as any);

      const initialHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const initialBody = 'recipient=bob&amount=100&_csrf=stale_old_token';

      const replenished = await replenisher.replenishOutboundRequest(
        'https://target.corp/api/v1/transfer',
        'POST',
        initialHeaders,
        initialBody
      );

      expect(replenished.headers['x-csrf-token']).toBe('fresh_single_use_token_9988');
      expect(replenished.body).toContain('_csrf=fresh_single_use_token_9988');
      expect(replenished.body).not.toContain('stale_old_token');
    });

    it('detects single-use nonce invalidation rejection responses', () => {
      expect(EphemeralNonceReplenisher.isNonceRejectedResponse(403, 'CSRF token mismatch')).toBe(true);
      expect(EphemeralNonceReplenisher.isNonceRejectedResponse(419, 'Page Expired - Invalid authenticity token')).toBe(true);
      expect(EphemeralNonceReplenisher.isNonceRejectedResponse(200, '{"success": true}')).toBe(false);
    });
  });

  describe('ProxyRotator & Datacenter ASN Reputation Shield', () => {
    it('detects Datacenter ASN reputation blocks and prioritizes residential proxies', () => {
      expect(
        ProxyRotator.isAsnOrDatacenterBlock(403, { 'x-blocked-asn': '16509' }, 'Access Denied: Datacenter IP detected')
      ).toBe(true);

      const rotator = new ProxyRotator();
      rotator.addProxy('http://10.0.0.1:8080', 'datacenter');
      rotator.addProxy('socks5://user:pass@res.proxy.net:1080', 'residential');

      const proxy = rotator.getNextAvailableProxy(true);
      expect(proxy).toBeDefined();
      expect(proxy?.proxyType).toBe('residential');
      expect(proxy?.url).toContain('res.proxy.net');
    });
  });
});

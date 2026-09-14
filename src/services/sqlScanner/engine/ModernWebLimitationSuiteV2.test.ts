import { describe, it, expect, vi } from 'vitest';
import { RetryAfterParser } from './RetryAfterParser';
import { HoneypotFilter } from './HoneypotFilter';
import { MultiSessionManager } from './MultiSessionManager';
import { StatefulSequenceExecutor } from './StatefulSequenceExecutor';
import { MultipartPayloadBuilder } from './MultipartPayloadBuilder';
import { PersistedQueryExtractor } from './PersistedQueryExtractor';
import { BrowserStorageSynchronizer } from './BrowserStorageSynchronizer';
import { WebSocketSessionManager } from './WebSocketSessionManager';
import { ipcClient } from '../../../ipc/client';

vi.mock('../../../ipc/client', () => ({
  ipcClient: {
    sendRepeaterRequest: vi.fn(),
  },
}));

describe('Modern Web Defense & Limitation Elimination Suite V2', () => {
  describe('RetryAfterParser', () => {
    it('parses numeric second values with jitter', () => {
      const delay = RetryAfterParser.parse('60');
      expect(delay).toBeGreaterThanOrEqual(60000);
      expect(delay).toBeLessThan(60300);
    });

    it('parses HTTP-Date format correctly', () => {
      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const delay = RetryAfterParser.parse(futureDate);
      expect(delay).toBeGreaterThan(8000);
    });

    it('falls back to default delay when header is empty or missing', () => {
      expect(RetryAfterParser.parse(undefined, 2500)).toBe(2500);
      expect(RetryAfterParser.parse('', 4000)).toBe(4000);
    });
  });

  describe('HoneypotFilter', () => {
    it('detects invisible honeypot links via inline CSS styles', () => {
      expect(HoneypotFilter.isHoneypotLink('<a href="/trap" style="display:none">Trap</a>')).toBe(true);
      expect(HoneypotFilter.isHoneypotLink('<a href="/trap" style="visibility:hidden; opacity: 0;">Trap</a>')).toBe(true);
      expect(HoneypotFilter.isHoneypotLink('<a href="/trap" style="left: -9999px; position: absolute;">Trap</a>')).toBe(true);
    });

    it('detects honeypot trap classes, aria-hidden, and decoy anchor text', () => {
      expect(HoneypotFilter.isHoneypotLink('<a href="/trap" class="bot-trap-link">Click</a>')).toBe(true);
      expect(HoneypotFilter.isHoneypotLink('<a href="/trap" aria-hidden="true" tabindex="-1">Trap</a>')).toBe(true);
      expect(HoneypotFilter.isHoneypotLink('<a href="/trap">Leave blank</a>', 'Leave blank - bot trap')).toBe(true);
    });

    it('allows genuine visible links', () => {
      expect(HoneypotFilter.isHoneypotLink('<a href="/products" class="nav-item">Products</a>')).toBe(false);
    });

    it('detects hidden honeypot input fields', () => {
      expect(HoneypotFilter.isHoneypotInput('<input type="text" name="honeypot_field" />')).toBe(true);
      expect(HoneypotFilter.isHoneypotInput('<input type="text" name="phone" style="display:none" />')).toBe(true);
      expect(HoneypotFilter.isHoneypotInput('<input type="text" name="username" class="form-control" />')).toBe(false);
    });
  });

  describe('MultiSessionManager', () => {
    it('maintains isolated session personas and header compositions', () => {
      const manager = new MultiSessionManager();
      manager.registerPersona({
        name: 'admin',
        role: 'admin',
        cookies: 'admin_sid=secret999',
        headers: { 'X-Admin-Key': 'adm_1' },
        authToken: 'eyAdminJwt',
        tenantId: 'corp_root',
      });

      manager.registerPersona({
        name: 'tenant_user',
        role: 'tenant_member',
        cookies: 'user_sid=user111',
        headers: {},
        tenantId: 'tenant_42',
      });

      const adminHeaders = manager.composeHeadersForPersona('admin', { 'X-Trace': '1' });
      expect(adminHeaders['Cookie']).toBe('admin_sid=secret999');
      expect(adminHeaders['Authorization']).toBe('Bearer eyAdminJwt');
      expect(adminHeaders['X-Tenant-Id']).toBe('corp_root');
      expect(adminHeaders['X-Admin-Key']).toBe('adm_1');

      const tenantHeaders = manager.composeHeadersForPersona('tenant_user');
      expect(tenantHeaders['Cookie']).toBe('user_sid=user111');
      expect(tenantHeaders['X-Tenant-Id']).toBe('tenant_42');
      expect(tenantHeaders['Authorization']).toBeUndefined();
    });
  });

  describe('StatefulSequenceExecutor', () => {
    it('chains extracted variables across multi-step workflows', async () => {
      const mockSend = vi.mocked(ipcClient.sendRepeaterRequest);
      mockSend
        .mockResolvedValueOnce({
          statusCode: 200,
          statusText: 'OK',
          headers: [],
          body: JSON.stringify({ cart_id: 'cart_abc123' }),
          durationMs: 40,
        } as any)
        .mockResolvedValueOnce({
          statusCode: 200,
          statusText: 'OK',
          headers: [],
          body: 'Order confirmed with id: ord_9999',
          durationMs: 50,
        } as any);

      const res = await StatefulSequenceExecutor.executeSequence(
        'https://api.target.com',
        'api.target.com',
        {
          id: 'checkout_flow',
          title: 'Cart to Checkout Flow',
          steps: [
            {
              name: 'Create Cart',
              path: '/api/cart',
              method: 'POST',
              body: JSON.stringify({ item: '123' }),
              extractVariables: [{ variableName: 'cart_id', regex: '"cart_id":\\s*"([^"]+)"' }],
            },
            {
              name: 'Confirm Checkout',
              path: '/api/cart/{{cart_id}}/checkout',
              method: 'POST',
              body: 'action=pay&cart={{cart_id}}',
              extractVariables: [{ variableName: 'order_id', regex: 'id:\\s*(ord_[0-9]+)' }],
            },
          ],
        }
      );

      expect(res.success).toBe(true);
      expect(res.extractedVariables['cart_id']).toBe('cart_abc123');
      expect(res.extractedVariables['order_id']).toBe('ord_9999');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('MultipartPayloadBuilder', () => {
    it('synthesizes valid RFC 7578 multipart bodies with magic bytes', () => {
      const pngBytes = MultipartPayloadBuilder.getMagicFileContent('png', 'UNION SELECT 1--');
      const result = MultipartPayloadBuilder.build(
        [{ name: 'description', value: 'test avatar' }],
        [
          {
            fieldName: 'avatar',
            fileName: 'profile.png',
            mimeType: 'image/png',
            content: pngBytes,
          },
        ],
        'test_boundary'
      );

      expect(result.contentType).toBe('multipart/form-data; boundary=test_boundary');
      expect(result.body).toContain('--test_boundary');
      expect(result.body).toContain('name="description"');
      expect(result.body).toContain('filename="profile.png"');
      expect(result.body).toContain('UNION SELECT 1--');
      expect(result.body).toContain('\x89PNG');
    });
  });

  describe('PersistedQueryExtractor', () => {
    it('extracts Apollo APQ and Relay SHA256 hashes from client JS bundles', () => {
      const sampleJs = 'const query = { operationName: "GetUserDetails", sha256Hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90" };';
      const extracted = PersistedQueryExtractor.extractPersistedQueriesFromJs(sampleJs);

      expect(extracted.length).toBe(1);
      expect(extracted[0].operationName).toBe('GetUserDetails');
      expect(extracted[0].sha256Hash).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90');

      const body = PersistedQueryExtractor.formatPersistedQueryBody(extracted[0]);
      expect(JSON.parse(body).extensions.persistedQuery.sha256Hash).toBe(extracted[0].sha256Hash);
    });
  });

  describe('BrowserStorageSynchronizer', () => {
    it('extracts JWT and nested auth provider session tokens from storage dumps', () => {
      const synchronizer = new BrowserStorageSynchronizer();
      synchronizer.ingestStorage([
        {
          storageType: 'localStorage',
          key: 'sb-auth-token',
          value: JSON.stringify({ access_token: 'supabase_secret_token_123' }),
        },
        {
          storageType: 'sessionStorage',
          key: 'auth_token',
          value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4ifQ.signature',
        },
      ]);

      const tokens = synchronizer.extractAuthTokens();
      expect(tokens.length).toBe(2);
      expect(tokens.some((t) => t.headerValue === 'Bearer supabase_secret_token_123')).toBe(true);
      expect(tokens.some((t) => t.headerValue.includes('eyJhbGciOiJIUzI1NiI'))).toBe(true);
    });
  });

  describe('WebSocketSessionManager', () => {
    it('generates valid WebSocket upgrade handshakes and framed protocols', () => {
      const headers = WebSocketSessionManager.generateUpgradeHeaders('api.example.com', ['graphql-ws']);
      expect(headers['Upgrade']).toBe('websocket');
      expect(headers['Connection']).toBe('Upgrade');
      expect(headers['Sec-WebSocket-Version']).toBe('13');
      expect(headers['Sec-WebSocket-Key']).toBeDefined();
      expect(headers['Sec-WebSocket-Protocol']).toBe('graphql-ws');

      const jsonRpc = WebSocketSessionManager.createJsonRpcFrame('subscribeToUpdates', { channel: 'feed' }, 42);
      const parsedRpc = JSON.parse(jsonRpc);
      expect(parsedRpc.jsonrpc).toBe('2.0');
      expect(parsedRpc.id).toBe(42);
      expect(parsedRpc.method).toBe('subscribeToUpdates');

      const stomp = WebSocketSessionManager.createStompSendFrame('/app/chat', 'Hello world', { 'content-type': 'text/plain' });
      expect(stomp).toContain('SEND');
      expect(stomp).toContain('destination:/app/chat');
      expect(stomp).toContain('Hello world');
      expect(stomp.endsWith('\0')).toBe(true);
    });
  });
});

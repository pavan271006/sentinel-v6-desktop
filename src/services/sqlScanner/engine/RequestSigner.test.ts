import { describe, it, expect } from 'vitest';
import { RequestSigner } from './RequestSigner';
import { ClearanceHeartbeat } from '../crawler/ClearanceHeartbeat';
import { TlsImpersonation } from '../crawler/TlsImpersonation';

describe('RequestSigner Engine', () => {
  describe('extractSigningProfileFromJs', () => {
    it('extracts embedded HMAC secrets and signature header names from JS bundle content', () => {
      const mockJs = `
        const SIGN_KEY = "super_secret_signing_key_2026";
        const SIGN_HEADER = "X-Request-Sign";
        const TS_HEADER = "X-Req-Time";
        const NONCE_HEADER = "X-Trace-Id";

        function signRequest(payload) {
          const hash = crypto.createHmac('sha256', SIGN_KEY).update(payload).digest('hex');
          return { [SIGN_HEADER]: hash };
        }
      `;

      const profile = RequestSigner.extractSigningProfileFromJs(mockJs);
      expect(profile).toBeDefined();
      expect(profile?.secret).toBe('super_secret_signing_key_2026');
      expect(profile?.headerName).toBe('X-Request-Sign');
      expect(profile?.timestampHeaderName).toBe('X-Req-Time');
      expect(profile?.nonceHeaderName).toBe('X-Trace-Id');
      expect(profile?.algorithm).toBe('sha256');
    });

    it('extracts SHA-1 algorithm and HMAC_SECRET correctly', () => {
      const mockJs = `
        const config = {
          HMAC_SECRET: "fintech_api_secret_key_8899",
          sigHeader: "X-Auth-Signature"
        };
        const algo = "sha1";
      `;

      const profile = RequestSigner.extractSigningProfileFromJs(mockJs);
      expect(profile).toBeDefined();
      expect(profile?.secret).toBe('fintech_api_secret_key_8899');
      expect(profile?.headerName).toBe('X-Auth-Signature');
      expect(profile?.algorithm).toBe('sha1');
    });

    it('returns null if no signing artifacts or headers exist in JS', () => {
      const mockJs = `
        function renderButtons() {
          return '<button>Click</button>';
        }
      `;

      const profile = RequestSigner.extractSigningProfileFromJs(mockJs);
      expect(profile).toBeNull();
    });
  });

  describe('computeHmac', () => {
    it('computes consistent HMAC-SHA256 hex string', async () => {
      const secret = 'my_secret_key';
      const message = 'GET|/api/v1/users|1710000000|abc1234';

      const sig1 = await RequestSigner.computeHmac('sha256', secret, message);
      const sig2 = await RequestSigner.computeHmac('sha256', secret, message);

      expect(sig1).toBeDefined();
      expect(sig1.length).toBeGreaterThan(0);
      expect(sig1).toBe(sig2);
    });

    it('computes distinct hashes for distinct payloads', async () => {
      const secret = 'my_secret_key';
      const sig1 = await RequestSigner.computeHmac('sha256', secret, 'payload_A');
      const sig2 = await RequestSigner.computeHmac('sha256', secret, 'payload_B');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('generateSignedHeaders', () => {
    it('generates synchronized timestamp, nonce, and signature headers', async () => {
      const signer = new RequestSigner({
        secret: 'test_signing_secret',
        headerName: 'X-Signature',
        timestampHeaderName: 'X-Timestamp',
        nonceHeaderName: 'X-Nonce',
      });

      const headers = await signer.generateSignedHeaders('POST', '/api/v1/orders', '{"item":1}');

      expect(headers['X-Signature']).toBeDefined();
      expect(headers['X-Timestamp']).toBeDefined();
      expect(headers['X-Nonce']).toBeDefined();
      expect(headers['X-Signature'].length).toBeGreaterThan(16);
    });
  });
});

describe('ClearanceHeartbeat Daemon', () => {
  it('tracks token validity, warns on approaching expiration, and marks expired', () => {
    const heartbeat = new ClearanceHeartbeat(15);

    heartbeat.registerToken('cf_clearance', 'sample_cf_token_val', 15);

    let health = heartbeat.evaluateHealth();
    expect(health.allValid).toBe(true);
    expect(health.expiredTokens.length).toBe(0);
    expect(health.tokens[0].status).toBe('valid');

    heartbeat.registerToken('datadome', 'sample_datadome_token', 1);
    health = heartbeat.evaluateHealth();
    expect(health.expiringTokens).toContain('datadome');

    heartbeat.registerToken('session_cookie', 'old_session', -1);
    health = heartbeat.evaluateHealth();
    expect(health.allValid).toBe(false);
    expect(health.expiredTokens).toContain('session_cookie');
  });

  it('detects WAF clearance challenge responses accurately', () => {
    expect(
      ClearanceHeartbeat.isClearanceExpiredResponse(403, { 'cf-ray': '890123-ORD' }, 'Cloudflare Ray ID')
    ).toBe(true);

    expect(
      ClearanceHeartbeat.isClearanceExpiredResponse(503, {}, 'Attention Required! | Cloudflare Error 1020')
    ).toBe(true);

    expect(
      ClearanceHeartbeat.isClearanceExpiredResponse(403, { 'x-datadome': 'protected' }, '')
    ).toBe(true);

    expect(
      ClearanceHeartbeat.isClearanceExpiredResponse(200, {}, '{"success": true}')
    ).toBe(false);

    expect(
      ClearanceHeartbeat.isClearanceExpiredResponse(404, {}, 'Not Found')
    ).toBe(false);
  });
});

describe('TlsImpersonation Engine', () => {
  it('defines JA4 fingerprints and Client Hints for Chrome 124, Firefox 128, and Safari 17', () => {
    const chrome = TlsImpersonation.PROFILES['chrome-124'];
    expect(chrome.ja4Fingerprint).toBe('t13d1516h2_8daaf6152771_0271dd50b442');
    expect(chrome.curlBinary).toBe('curl_chrome124');
    expect(chrome.clientHints['Sec-CH-UA']).toContain('Chrome');

    const ff = TlsImpersonation.PROFILES['firefox-128'];
    expect(ff.ja4Fingerprint).toBe('t13d190900_2b7d22080c2f_b5d033a2a71d');
    expect(ff.curlBinary).toBe('curl_ff128');

    const safari = TlsImpersonation.PROFILES['safari-17'];
    expect(safari.ja4Fingerprint).toBe('t13d201300_90b213b16982_b8b2cfd81b37');
    expect(safari.curlBinary).toBe('curl_safari17');
  });

  it('generates ready-to-run curl-impersonate commands with custom headers and body', () => {
    const cmd = TlsImpersonation.generateCurlImpersonateCommand(
      'https://target.corp/api/v1/auth',
      'POST',
      { Authorization: 'Bearer token123' },
      '{"user":"admin"}',
      'chrome-124'
    );

    expect(cmd).toContain('curl_chrome124');
    expect(cmd).toContain('-X POST');
    expect(cmd).toContain('-H "Authorization: Bearer token123"');
    expect(cmd).toContain('-H "Sec-CH-UA:');
    expect(cmd).toContain('-d \'{"user":"admin"}\'');
    expect(cmd).toContain('"https://target.corp/api/v1/auth"');
  });
});

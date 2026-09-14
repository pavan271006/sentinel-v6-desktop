import { describe, it, expect } from 'vitest';
import { WafDetector } from './WafDetector';

describe('WafDetector Multi-Cloud Engine', () => {
  it('detects Cloudflare from headers and body', () => {
    const headers = [{ name: 'cf-ray', value: '7a123bcdef01-ORD' }, { name: 'server', value: 'cloudflare' }];
    const body = 'Attention Required! | Cloudflare';
    const result = WafDetector.inspect(headers, body, 403);
    expect(result.detected).toBe(true);
    expect(result.wafName).toBe('Cloudflare');
    expect(result.confidence).toBe('High');
  });

  it('detects AWS WAF from headers and block body', () => {
    const headers = [{ name: 'x-amzn-requestid', value: 'abcdef-1234' }];
    const body = '403 Forbidden - Request blocked by administrative rules';
    const result = WafDetector.inspect(headers, body, 403);
    expect(result.detected).toBe(true);
    expect(result.wafName).toBe('AWS WAF');
  });

  it('detects Akamai Kona from body signature', () => {
    const headers = [{ name: 'server', value: 'AkamaiGHost' }];
    const body = 'Access Denied - Akamai Reference&#32;&#35;18.2a';
    const result = WafDetector.inspect(headers, body, 403);
    expect(result.detected).toBe(true);
    expect(result.wafName).toBe('Akamai Kona');
  });

  it('detects Fastly / Signal Sciences from header signature', () => {
    const headers = [{ name: 'x-sigsci-request-id', value: 'sig_990142' }];
    const body = 'Error 403 Access Denied';
    const result = WafDetector.inspect(headers, body, 403);
    expect(result.detected).toBe(true);
    expect(result.wafName).toBe('Fastly / Signal Sciences');
  });

  it('detects Fortinet FortiWeb from cookie signature', () => {
    const headers = [{ name: 'set-cookie', value: 'FORTIWAFSID=894109240192; Path=/' }];
    const body = 'Protected by FortiWeb';
    const result = WafDetector.inspect(headers, body, 403);
    expect(result.detected).toBe(true);
    expect(result.wafName).toBe('Fortinet FortiWeb');
  });

  it('returns false for benign responses without WAF signatures', () => {
    const headers = [{ name: 'content-type', value: 'application/json' }];
    const body = '{"status": "ok", "items": []}';
    const result = WafDetector.inspect(headers, body, 200);
    expect(result.detected).toBe(false);
  });
});

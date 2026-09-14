import { describe, it, expect } from 'vitest';
import { StealthDriver } from './StealthDriver';
import { TlsImpersonation } from '../crawler/TlsImpersonation';

describe('StealthDriver & Modern Anti-Bot Evasion Suite', () => {
  it('generates stealth script that eradicates navigator.webdriver', () => {
    const script = StealthDriver.generateStealthScript();
    expect(script).toContain("delete Object.getPrototypeOf(navigator).webdriver");
    expect(script).toContain("get: () => undefined");
  });

  it('mocks window.chrome runtime, loadTimes, and csi', () => {
    const script = StealthDriver.generateStealthScript();
    expect(script).toContain("window.chrome.runtime");
    expect(script).toContain("window.chrome.loadTimes");
    expect(script).toContain("window.chrome.csi");
  });

  it('removes cdc_ automation signatures from window and document', () => {
    const script = StealthDriver.generateStealthScript();
    expect(script).toContain("/^cdc_[a-zA-Z0-9]+_/i.test(keys[i])");
  });

  it('spoofs WebGL vendor and renderer with authentic hardware parameters', () => {
    const profile = {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
      hardwareConcurrency: 16,
      deviceMemory: 16,
      platform: 'Win32',
      languages: ['en-US', 'en'],
    };
    const script = StealthDriver.generateStealthScript(profile);
    expect(script).toContain('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)');
    expect(script).toContain('0x9245'); // UNMASKED_VENDOR_WEBGL
    expect(script).toContain('0x9246'); // UNMASKED_RENDERER_WEBGL
  });

  it('injects stealth script directly into HTML head', () => {
    const rawHtml = '<html><head><title>Target</title></head><body>Hello</body></html>';
    const injected = StealthDriver.injectStealthScriptToHtml(rawHtml);
    expect(injected).toContain('<script id="__sentinel_stealth_engine__">');
    expect(injected).toContain('<head><script id="__sentinel_stealth_engine__">');
  });

  it('provides authentic L7 browser headers for Chrome 128 across resource types', () => {
    const docHeaders = TlsImpersonation.getBrowserHeadersForResourceType('document', 'chrome-128', 'example.com');
    expect(docHeaders['User-Agent']).toContain('Chrome/128');
    expect(docHeaders['Sec-CH-UA']).toContain('"Chromium";v="128"');
    expect(docHeaders['Sec-Fetch-Dest']).toBe('document');
    expect(docHeaders['Sec-Fetch-Mode']).toBe('navigate');
    expect(docHeaders['Host']).toBe('example.com');

    const xhrHeaders = TlsImpersonation.getBrowserHeadersForResourceType('xhr', 'chrome-128');
    expect(xhrHeaders['Sec-Fetch-Dest']).toBe('empty');
    expect(xhrHeaders['Sec-Fetch-Mode']).toBe('cors');
    expect(xhrHeaders['Accept']).toContain('application/json');

    const scriptHeaders = TlsImpersonation.getBrowserHeadersForResourceType('script', 'chrome-128');
    expect(scriptHeaders['Sec-Fetch-Dest']).toBe('script');
    expect(scriptHeaders['Sec-Fetch-Mode']).toBe('no-cors');
  });
});

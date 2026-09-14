/**
 * Sentinel Sovereign Stealth Driver & Browser Anti-Detection Engine
 *
 * Provides runtime evasion scripts and CDP hooks that neutralize:
 * 1. Cloudflare Turnstile / Bot Management
 * 2. Akamai Bot Manager (sensor_data & canvas telemetry)
 * 3. DataDome (device & runtime fingerprinting)
 * 4. HUMAN / PerimeterX (_px3 & sensor collector)
 * 5. Kasada / Shape Security (CDP variable scans)
 */

export interface StealthProfile {
  vendor: string;
  renderer: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  platform: string;
  languages: string[];
}

export class StealthDriver {
  public static DEFAULT_PROFILE: StealthProfile = {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
    hardwareConcurrency: 16,
    deviceMemory: 16,
    platform: 'Win32',
    languages: ['en-US', 'en'],
  };

  /**
   * Generates the JavaScript injection script for CDP `Page.addScriptToEvaluateOnNewDocument`
   * or proxy HTML injection to strip automation artifacts before any page script executes.
   */
  public static generateStealthScript(profile: StealthProfile = StealthDriver.DEFAULT_PROFILE): string {
    return `
(function() {
  'use strict';

  // 1. Eradicate navigator.webdriver
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true,
      enumerable: true
    });
    delete Object.getPrototypeOf(navigator).webdriver;
  } catch (e) {}

  // 2. Mock window.chrome runtime & loadTimes
  try {
    if (!window.chrome) {
      window.chrome = {};
    }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
        OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
        PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
        RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
        connect: function() { return { disconnect: function(){}, onDisconnect: { addListener: function(){} }, onMessage: { addListener: function(){} }, postMessage: function(){} }; },
        sendMessage: function() {}
      };
    }
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function() {
        return {
          commitLoadTime: Date.now() / 1000 - 0.5,
          connectionInfo: "h2",
          finishDocumentLoadTime: Date.now() / 1000 - 0.1,
          finishLoadTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000 - 0.3,
          navigationType: "Other",
          npnNegotiatedProtocol: "h2",
          requestTime: Date.now() / 1000 - 0.8,
          startLoadTime: Date.now() / 1000 - 0.8,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        };
      };
    }
    if (!window.chrome.csi) {
      window.chrome.csi = function() {
        return {
          onloadT: Date.now(),
          pageT: 280.12,
          startE: Date.now() - 280,
          tran: 15
        };
      };
    }
  } catch (e) {}

  // 3. Normalize navigator.permissions.query
  try {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = function(parameters) {
      if (parameters && parameters.name === 'notifications') {
        return Promise.resolve({
          state: window.Notification ? window.Notification.permission : 'default',
          onchange: null,
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return true; }
        });
      }
      return originalQuery ? originalQuery.apply(this, arguments) : Promise.resolve({ state: 'prompt' });
    };
  } catch (e) {}

  // 4. Emulate realistic WebGL Hardware (Hide SwiftShader / llvmpipe)
  try {
    const getParameterProxy = function(origGetParameter) {
      return function(param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 0x9245) {
          return '${profile.vendor}';
        }
        // UNMASKED_RENDERER_WEBGL
        if (param === 0x9246) {
          return '${profile.renderer}';
        }
        return origGetParameter.apply(this, arguments);
      };
    };

    if (window.WebGLRenderingContext) {
      WebGLRenderingContext.prototype.getParameter = getParameterProxy(WebGLRenderingContext.prototype.getParameter);
    }
    if (window.WebGL2RenderingContext) {
      WebGL2RenderingContext.prototype.getParameter = getParameterProxy(WebGL2RenderingContext.prototype.getParameter);
    }
  } catch (e) {}

  // 5. Canvas Micro-Jitter (Prevents deterministic canvas hash tracking)
  try {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      const context = this.getContext('2d');
      if (context && this.width > 0 && this.height > 0) {
        try {
          const imgData = context.getImageData(0, 0, 1, 1);
          imgData.data[0] = (imgData.data[0] + 1) % 255;
          context.putImageData(imgData, 0, 0);
        } catch (err) {}
      }
      return origToDataURL.apply(this, arguments);
    };
  } catch (e) {}

  // 6. AudioContext Telemetry Jitter
  try {
    if (window.AudioBuffer) {
      const origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        const data = origGetChannelData.apply(this, arguments);
        if (data && data.length > 0) {
          data[0] = data[0] + (Math.random() * 0.000001 - 0.0000005);
        }
        return data;
      };
    }
  } catch (e) {}

  // 7. Remove CDP Automation Signature Leaks (cdc_ prefixes)
  try {
    const removeCdcKeys = function(target) {
      if (!target) return;
      const keys = Object.getOwnPropertyNames(target);
      for (let i = 0; i < keys.length; i++) {
        if (/^cdc_[a-zA-Z0-9]+_/i.test(keys[i])) {
          try {
            delete target[keys[i]];
          } catch (e) {}
        }
      }
    };
    removeCdcKeys(window);
    removeCdcKeys(document);
  } catch (e) {}

  // 8. Normalize Plugins & MIME Types
  try {
    if (navigator.plugins.length === 0) {
      const fakePlugins = [
        { name: "PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "Chrome PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "Chromium PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "Microsoft Edge PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "WebKit built-in PDF", filename: "internal-pdf-viewer", description: "Portable Document Format" }
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => fakePlugins,
        configurable: true
      });
    }
  } catch (e) {}

  // 9. Emulate Hardware & Languages
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${profile.hardwareConcurrency}, configurable: true });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${profile.deviceMemory}, configurable: true });
    Object.defineProperty(navigator, 'platform', { get: () => '${profile.platform}', configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => ${JSON.stringify(profile.languages)}, configurable: true });
  } catch (e) {}

})();
`;
  }

  /**
   * Wraps an HTML string with the stealth injection script placed at the very top of <head>.
   */
  public static injectStealthScriptToHtml(html: string, profile?: StealthProfile): string {
    const script = `<script id="__sentinel_stealth_engine__">${this.generateStealthScript(profile)}</script>`;
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>${script}`);
    }
    if (html.includes('<html>')) {
      return html.replace('<html>', `<html><head>${script}</head>`);
    }
    return `${script}${html}`;
  }
}

/**
 * Sentinel Sovereign Ω - Multi-Source Endpoint Mining Engine
 * src/services/contentDiscovery/MultiSourceEndpointMiner.ts
 *
 * Implements Level 6 Deep Attack-Surface Discovery:
 * 1. Multi-Source DOM Link Extraction (<a>, <form>, <button>, <iframe>, <area>) with open Shadow DOM
 *    piercing and strict honeypot trap filtering.
 * 2. Dynamic JS Bundle & Mutation Mining (Webpack chunk maps, Next.js __BUILD_MANIFEST, Vite dynamic imports).
 * 3. Client-Side Router Introspection (React Router v5/v6, Vue Router v3/v4, Next.js Pages & App Router, Remix, Nuxt).
 * 4. Inline Script AST Mining (using TypeScript compiler API) and HTML comment parsing.
 * 5. Web Worker and Service Worker Dredging (navigator.serviceWorker, window.caches, Worker constructor hooks).
 */

import ts from 'typescript';
import { endpointNormalizer, NormalizedEndpoint, DiscoveredEndpoint } from './EndpointNormalizer';

export type { DiscoveredEndpoint, NormalizedEndpoint };

export interface PageContext {
  targetHost: string;
  currentUrl: string;
  html?: string;
  driver?: any; // CDP browser driver with evaluate()
}

export interface DomFormParameter {
  name: string;
  value: string;
  type: string;
  required?: boolean;
}

export interface ExtractedDomForm {
  actionUrl: string;
  method: string;
  enctype: string;
  parameters: Record<string, string>;
  parameterDetails: DomFormParameter[];
}

export interface ExtractedDomButton {
  url: string;
  method: string;
  sourceType: 'formaction' | 'data-attribute' | 'onclick-regex';
  parameters?: Record<string, string>;
  rawSnippet?: string;
}

export interface ExtractedDomLink {
  url: string;
  text: string;
  rel?: string;
  isPing?: boolean;
  isDownload?: boolean;
  isIframe?: boolean;
}

export interface DomExtractionResult {
  links: ExtractedDomLink[];
  forms: ExtractedDomForm[];
  buttons: ExtractedDomButton[];
}

export interface ManifestDredgeResult {
  trappedScripts: string[];
  nextBuildManifestRoutes: string[];
  nextBuildManifestChunks: string[];
  trappedChunkIds: string[];
}

export interface RouterIntrospectionItem {
  url: string;
  source: 'router_route' | 'html_comment' | 'script_ast' | 'worker';
  method?: string;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DOM Link Extractor
// ═══════════════════════════════════════════════════════════════════════════════

export class DomLinkExtractor {
  /**
   * Generates the self-contained JavaScript snippet executed in the target browser tab.
   * Traverses standard DOM, open Shadow DOM, and same-origin iframes.
   */
  public static getInBrowserExtractionScript(maxLimits = { links: 250, forms: 50, buttons: 100 }): string {
    return `(function() {
        const result = {
          links: [],
          forms: [],
          buttons: []
        };

        const seenUrls = new Set();
        const baseURI = document.baseURI || window.location.href;

        function resolveUrl(raw) {
          if (!raw || typeof raw !== 'string') return null;
          const clean = raw.trim();
          if (!clean || clean === '#' || clean.startsWith('javascript:') || clean.startsWith('mailto:') || clean.startsWith('tel:') || clean.startsWith('data:') || clean.startsWith('blob:')) {
            return null;
          }
          try {
            return new URL(clean, baseURI).href;
          } catch(e) {
            return null;
          }
        }

        function isHoneypot(el) {
          if (!el || !(el instanceof Element)) return true;
          try {
            // Check trap tokens in attributes
            const id = (el.id || '').toLowerCase();
            const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            const name = (el.getAttribute('name') || '').toLowerCase();
            const textContent = (el.innerText || el.textContent || '').trim().toLowerCase();

            const trapTokens = ['honeypot', 'honey-pot', 'honey_pot', 'bot-trap', 'bot_trap', 'fake-input', 'decoy', 'leave-blank', 'do-not-fill'];
            for (let i = 0; i < trapTokens.length; i++) {
              if (id.includes(trapTokens[i]) || className.includes(trapTokens[i]) || name.includes(trapTokens[i])) return true;
            }
            if (textContent.includes('leave this field blank') || textContent.includes('leave empty') || textContent.includes('do not click')) return true;

            // Check hidden / aria-hidden attributes (excluding standard input[type="hidden"])
            if (el.tagName !== 'INPUT' || (el.getAttribute('type') || '').toLowerCase() !== 'hidden') {
              if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
            }

            // Check computed styles
            const style = window.getComputedStyle(el);
            if (!style) return false;
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
            const opacity = parseFloat(style.opacity || '1');
            if (!isNaN(opacity) && opacity <= 0.02) return true;
            if (style.pointerEvents === 'none') return true;

            const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
            if (!isJsdom && typeof el.getBoundingClientRect === 'function') {
              const rect = el.getBoundingClientRect();
              if (rect && (rect.width > 0 || rect.height > 0 || rect.top !== 0 || rect.left !== 0)) {
                if (rect.width <= 1 && rect.height <= 1 && style.position !== 'fixed') return true;
                if (rect.right <= -50 || rect.bottom <= -50 || rect.left < -400 || rect.top < -400) return true;
              }
            }

            // Check ancestor visibility up to 5 levels
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
              const pStyle = window.getComputedStyle(parent);
              if (pStyle.display === 'none' || pStyle.visibility === 'hidden') return true;
              parent = parent.parentElement;
              depth++;
            }
            return false;
          } catch(e) {
            return false;
          }
        }

        function extractFromContainer(root) {
          if (!root) return;

          // 1. Anchors and Areas
          try {
            const anchors = root.querySelectorAll('a, area');
            for (let i = 0; i < anchors.length && result.links.length < ${maxLimits.links}; i++) {
              const a = anchors[i];
              if (isHoneypot(a)) continue;

              const href = a.getAttribute('href') || a.getAttribute('data-url') || a.getAttribute('data-href') || a.getAttribute('data-endpoint') || a.getAttribute('data-navigate') || '';
              const resolved = resolveUrl(href);
              if (resolved && !seenUrls.has(resolved)) {
                seenUrls.add(resolved);
                result.links.push({
                  url: resolved,
                  text: (a.innerText || a.textContent || '').trim().slice(0, 100),
                  rel: a.getAttribute('rel') || '',
                  isPing: false,
                  isDownload: a.hasAttribute('download')
                });
              }

              // HTML5 ping attribute extraction
              const ping = a.getAttribute('ping');
              if (ping) {
                const pingUrls = ping.trim().split(/\\s+/);
                for (const pu of pingUrls) {
                  const resolvedPing = resolveUrl(pu);
                  if (resolvedPing && !seenUrls.has('ping:' + resolvedPing)) {
                    seenUrls.add('ping:' + resolvedPing);
                    result.links.push({
                      url: resolvedPing,
                      text: 'Anchor Ping Beacon',
                      isPing: true
                    });
                  }
                }
              }
            }
          } catch(e) {}

          // 2. Forms and Form Controls
          try {
            const forms = root.querySelectorAll('form');
            for (let i = 0; i < forms.length && result.forms.length < ${maxLimits.forms}; i++) {
              const f = forms[i];
              if (isHoneypot(f)) continue;

              const rawAction = f.getAttribute('action') || f.getAttribute('data-action') || f.getAttribute('data-url') || f.getAttribute('data-endpoint') || '';
              const actionUrl = resolveUrl(rawAction) || baseURI;
              const method = (f.getAttribute('method') || 'GET').toUpperCase();
              const enctype = f.getAttribute('enctype') || 'application/x-www-form-urlencoded';

              const parameters = {};
              const parameterDetails = [];

              const controls = f.querySelectorAll('input, select, textarea');
              for (let j = 0; j < controls.length; j++) {
                const ctrl = controls[j];
                const type = (ctrl.getAttribute('type') || ctrl.tagName).toLowerCase();
                if (type !== 'hidden' && isHoneypot(ctrl)) continue;
                const name = ctrl.getAttribute('name');
                if (!name) continue;

                let value = ctrl.value || ctrl.getAttribute('value') || '';

                if (type === 'checkbox' || type === 'radio') {
                  if (!ctrl.checked && !value) continue;
                  if (!value) value = 'on';
                }

                parameters[name] = value;
                parameterDetails.push({ name, value, type, required: ctrl.required });
              }

              result.forms.push({
                actionUrl,
                method,
                enctype,
                parameters,
                parameterDetails
              });
            }
          } catch(e) {}

          // 3. Buttons (formaction, data-url, onclick regex)
          try {
            const buttons = root.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"], .btn, .button');
            for (let i = 0; i < buttons.length && result.buttons.length < ${maxLimits.buttons}; i++) {
              const btn = buttons[i];
              if (isHoneypot(btn)) continue;

              // 3a. formaction
              const formaction = btn.getAttribute('formaction');
              if (formaction) {
                const resolved = resolveUrl(formaction);
                if (resolved && !seenUrls.has('btn:' + resolved)) {
                  seenUrls.add('btn:' + resolved);
                  const formMethod = (btn.getAttribute('formmethod') || btn.closest('form')?.getAttribute('method') || 'GET').toUpperCase();
                  result.buttons.push({
                    url: resolved,
                    method: formMethod,
                    sourceType: 'formaction',
                    rawSnippet: btn.outerHTML.slice(0, 150)
                  });
                }
              }

              // 3b. data-* attributes
              const dataUrl = btn.getAttribute('data-url') || btn.getAttribute('data-href') || btn.getAttribute('data-endpoint') || btn.getAttribute('data-target-url') || btn.getAttribute('data-api') || btn.getAttribute('data-path') || btn.getAttribute('data-action');
              if (dataUrl) {
                const resolved = resolveUrl(dataUrl);
                if (resolved && !seenUrls.has('btn:' + resolved)) {
                  seenUrls.add('btn:' + resolved);
                  result.buttons.push({
                    url: resolved,
                    method: (btn.getAttribute('data-method') || 'GET').toUpperCase(),
                    sourceType: 'data-attribute',
                    rawSnippet: btn.outerHTML.slice(0, 150)
                  });
                }
              }

              // 3c. onclick handler string regex extraction
              const onclick = btn.getAttribute('onclick') || btn.getAttribute('onmousedown');
              if (onclick && typeof onclick === 'string') {
                const patterns = [
                  /(?:(?:window\\.)?location(?:\\.(?:href|assign|replace))?)\\s*(?:=|\\()\\s*['"\\x60]([^'"\\x60\\s\\)]+)['"\\x60]/gi,
                  /window\\.open\\s*\\(\\s*['"\\x60]([^'"\\x60\\s,\\)]+)['"\\x60]/gi,
                  /(?:router\\.(?:push|replace|go)|navigate)\\s*\\(\\s*['"\\x60]([^'"\\x60\\s,\\)]+)['"\\x60]/gi,
                  /(?:fetch|axios(?:\\.[a-zA-Z0-9_]+)?|\\$\\.ajax|\\$\\.get|\\$\\.post)\\s*\\(\\s*['"\\x60]([^'"\\x60\\s,\\)]+)['"\\x60]/gi,
                  /['"\\x60]((\\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)|https?:\\/\\/[a-zA-Z0-9_\\-\\.:]+\\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]+)['"\\x60]/gi
                ];

                for (let pIdx = 0; pIdx < patterns.length; pIdx++) {
                  const pat = patterns[pIdx];
                  pat.lastIndex = 0;
                  let m;
                  let iterations = 0;
                  while ((m = pat.exec(onclick)) !== null && iterations++ < 50) {
                    const candidate = m[1];
                    const resolved = resolveUrl(candidate);
                    if (resolved && !seenUrls.has('btn:' + resolved)) {
                      seenUrls.add('btn:' + resolved);
                      result.buttons.push({
                        url: resolved,
                        method: 'GET',
                        sourceType: 'onclick-regex',
                        rawSnippet: onclick.slice(0, 150)
                      });
                    }
                    if (!pat.global) break;
                  }
                }
              }
            }
          } catch(e) {}

          // 4. Iframes and Frames
          try {
            const iframes = root.querySelectorAll('iframe, frame');
            for (let i = 0; i < iframes.length && result.links.length < ${maxLimits.links}; i++) {
              const ifr = iframes[i];
              if (isHoneypot(ifr)) continue;

              const src = ifr.getAttribute('src') || ifr.getAttribute('data-src') || ifr.getAttribute('data-url') || '';
              const resolved = resolveUrl(src);
              if (resolved && !seenUrls.has(resolved)) {
                seenUrls.add(resolved);
                result.links.push({
                  url: resolved,
                  text: ifr.getAttribute('title') || 'Iframe Content',
                  isIframe: true
                });
              }

              // Embedded srcdoc parsing
              const srcdoc = ifr.getAttribute('srcdoc');
              if (srcdoc && typeof srcdoc === 'string' && srcdoc.length > 5) {
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(srcdoc, 'text/html');
                  extractFromContainer(doc.body || doc);
                } catch(e) {}
              }

              // Same-origin iframe piercing
              try {
                if (ifr.contentDocument && ifr.contentDocument.body) {
                  extractFromContainer(ifr.contentDocument.body);
                }
              } catch(e) {
                // Cross-origin security exception expected for third-party iframes
              }
            }
          } catch(e) {}

          // 5. Open Shadow DOM Traversal
          try {
            const allElements = root.querySelectorAll('*');
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i];
              if (el.shadowRoot) {
                extractFromContainer(el.shadowRoot);
              }
            }
          } catch(e) {}
        }

        extractFromContainer(document.body || document.documentElement || document);
        return result;
      })();
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Dynamic JS Bundle & Mutation Mining
// ═══════════════════════════════════════════════════════════════════════════════

export class DynamicBundleMiner {
  public static getPreExecutionInjectionScript(): string {
    return `
      (function() {
        if (window.__SENTINEL_BUNDLE_MINER_INJECTED__) return;
        window.__SENTINEL_BUNDLE_MINER_INJECTED__ = true;

        window.__SENTINEL_MUTATION_SCRIPTS__ = window.__SENTINEL_MUTATION_SCRIPTS__ || new Set();
        window.__SENTINEL_MUTATION_CHUNKS__ = window.__SENTINEL_MUTATION_CHUNKS__ || new Set();
        window.__SENTINEL_DISCOVERED_WORKERS__ = window.__SENTINEL_DISCOVERED_WORKERS__ || [];

        const base = document.baseURI || window.location.href;

        function recordScriptUrl(rawUrl) {
          if (!rawUrl || typeof rawUrl !== 'string') return;
          try {
            const resolved = new URL(rawUrl, base).href;
            if (window.__SENTINEL_MUTATION_SCRIPTS__.size < 500) {
              window.__SENTINEL_MUTATION_SCRIPTS__.add(resolved);
            }
          } catch(e) {}
        }

        // 1. MutationObserver watching dynamic <script src> and <link rel="modulepreload">
        try {
          const observer = new MutationObserver(function(mutations) {
            for (let i = 0; i < mutations.length; i++) {
              const m = mutations[i];
              if (m.type !== 'childList') continue;
              for (let j = 0; j < m.addedNodes.length; j++) {
                const node = m.addedNodes[j];
                if (node.nodeType !== 1) continue;

                if (node.nodeName === 'SCRIPT' && node.src) {
                  recordScriptUrl(node.src);
                } else if (node.nodeName === 'LINK') {
                  const rel = (node.getAttribute('rel') || '').toLowerCase();
                  const asAttr = (node.getAttribute('as') || '').toLowerCase();
                  if (rel === 'modulepreload' || (rel.includes('preload') && asAttr === 'script') || rel.includes('prefetch')) {
                    if (node.href) recordScriptUrl(node.href);
                  }
                } else if (node.querySelectorAll) {
                  const scripts = node.querySelectorAll('script[src], link[rel="modulepreload"], link[rel*="preload"][as="script"]');
                  for (let k = 0; k < scripts.length; k++) {
                    const sc = scripts[k];
                    recordScriptUrl(sc.src || sc.href);
                  }
                }
              }
            }
          });

          if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true, subtree: true });
          } else {
            document.addEventListener('DOMContentLoaded', function() {
              if (document.documentElement) {
                observer.observe(document.documentElement, { childList: true, subtree: true });
              }
            });
          }
        } catch(e) {}

        // 2. Intercept HTMLScriptElement.prototype.src descriptor
        try {
          const desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
          if (desc && desc.set) {
            const origSet = desc.set;
            Object.defineProperty(HTMLScriptElement.prototype, 'src', {
              set: function(val) {
                recordScriptUrl(val);
                return origSet.call(this, val);
              },
              get: desc.get,
              configurable: true,
              enumerable: true
            });
          }
        } catch(e) {}

        // 3. Hook Webpack chunk arrays (window.webpackChunk*)
        try {
          function hookWebpackArray(arr) {
            if (!arr || arr.__sentinel_hooked__) return;
            arr.__sentinel_hooked__ = true;
            const origPush = arr.push;
            arr.push = function(item) {
              try {
                if (Array.isArray(item) && Array.isArray(item[0])) {
                  for (let i = 0; i < item[0].length; i++) {
                    window.__SENTINEL_MUTATION_CHUNKS__.add(String(item[0][i]));
                  }
                }
              } catch(e) {}
              return origPush.apply(this, arguments);
            };
          }

          for (const key of Object.keys(window)) {
            if (key.startsWith('webpackChunk') || key === 'webpackJsonp') {
              if (Array.isArray(window[key])) {
                hookWebpackArray(window[key]);
              }
            }
          }
        } catch(e) {}

        // 4. Hook Worker and SharedWorker constructors
        try {
          if (typeof window.Worker === 'function') {
            const OrigWorker = window.Worker;
            window.Worker = function(scriptURL, options) {
              try {
                const resolved = new URL(scriptURL, base).href;
                window.__SENTINEL_DISCOVERED_WORKERS__.push({ url: resolved, type: 'web_worker' });
              } catch(e) {}
              return new OrigWorker(scriptURL, options);
            };
            window.Worker.prototype = OrigWorker.prototype;
          }
          if (typeof window.SharedWorker === 'function') {
            const OrigSharedWorker = window.SharedWorker;
            window.SharedWorker = function(scriptURL, options) {
              try {
                const resolved = new URL(scriptURL, base).href;
                window.__SENTINEL_DISCOVERED_WORKERS__.push({ url: resolved, type: 'shared_worker' });
              } catch(e) {}
              return new OrigSharedWorker(scriptURL, options);
            };
            window.SharedWorker.prototype = OrigSharedWorker.prototype;
          }
        } catch(e) {}
      })();
    `;
  }

  public static getInBrowserManifestDredgeScript(): string {
    return `
      (function() {
        const results = {
          trappedScripts: [],
          nextBuildManifestRoutes: [],
          nextBuildManifestChunks: [],
          trappedChunkIds: []
        };

        const base = document.baseURI || window.location.href;

        // Drain trapped mutation scripts
        if (window.__SENTINEL_MUTATION_SCRIPTS__) {
          results.trappedScripts = Array.from(window.__SENTINEL_MUTATION_SCRIPTS__);
          window.__SENTINEL_MUTATION_SCRIPTS__.clear();
        }

        // Drain trapped webpack chunk IDs
        if (window.__SENTINEL_MUTATION_CHUNKS__) {
          results.trappedChunkIds = Array.from(window.__SENTINEL_MUTATION_CHUNKS__);
          window.__SENTINEL_MUTATION_CHUNKS__.clear();
        }

        // Dredge Next.js __BUILD_MANIFEST
        try {
          if (window.__BUILD_MANIFEST) {
            const bm = window.__BUILD_MANIFEST;
            for (const [route, chunks] of Object.entries(bm)) {
              if (route && route.startsWith('/')) {
                results.nextBuildManifestRoutes.push(route);
              }
              if (Array.isArray(chunks)) {
                for (const c of chunks) {
                  if (typeof c === 'string' && c.endsWith('.js')) {
                    try {
                      const fullChunkUrl = new URL('/_next/' + c.replace(/^\\//, ''), base).href;
                      results.nextBuildManifestChunks.push(fullChunkUrl);
                    } catch(e) {}
                  }
                }
              }
            }
          }
        } catch(e) {}

        // Dredge Next.js __SSG_MANIFEST
        try {
          if (window.__SSG_MANIFEST) {
            const list = Array.isArray(window.__SSG_MANIFEST) ? window.__SSG_MANIFEST : Array.from(window.__SSG_MANIFEST);
            for (const route of list) {
              if (typeof route === 'string' && route.startsWith('/')) {
                results.nextBuildManifestRoutes.push(route);
              }
            }
          }
        } catch(e) {}

        // Dredge existing DOM scripts & preloads
        try {
          const scripts = document.querySelectorAll('script[src], link[rel="modulepreload"], link[rel*="preload"][as="script"]');
          for (let i = 0; i < scripts.length; i++) {
            const el = scripts[i];
            const raw = el.src || el.href;
            if (raw) {
              try {
                results.trappedScripts.push(new URL(raw, base).href);
              } catch(e) {}
            }
          }
        } catch(e) {}

        return results;
      })();
    `;
  }

  /**
   * Mines Webpack chunk mapping from runtime or main bundle text using safe linear regex patterns.
   */
  public extractWebpackChunkUrlsFromBundle(bundleText: string, bundleBaseUrl: string): string[] {
    const chunkUrls: string[] = [];
    if (!bundleText || typeof bundleText !== 'string') return chunkUrls;

    // Extract prefix if present in bundle text
    let prefix = '';
    const prefixMatch = /['"]([^'"]*(?:static\/|chunks\/|js\/|assets\/)[^'"]*)['"]/i.exec(bundleText);
    if (prefixMatch) {
      prefix = prefixMatch[1];
    }

    // Extract suffix
    let suffix = '.js';
    if (bundleText.includes('.chunk.js')) {
      suffix = '.chunk.js';
    }

    // Linear match of chunkId: "hash" pairs - completely safe from ReDoS
    const entryRegex = /(?:(\d+|"[a-zA-Z0-9_\-]+")\s*:\s*"([a-f0-9]{8,64})")/g;
    let entryMatch: RegExpExecArray | null;
    while ((entryMatch = entryRegex.exec(bundleText)) !== null) {
      const chunkId = entryMatch[1].replace(/["']/g, '');
      const hash = entryMatch[2];
      const filename = `${prefix}${chunkId}.${hash}${suffix}`;
      try {
        const fullUrl = new URL(filename, bundleBaseUrl).href;
        if (!chunkUrls.includes(fullUrl)) {
          chunkUrls.push(fullUrl);
        }
      } catch {}
    }

    // Pattern 2: Standalone chunk filename dictionary
    const dictPattern = /['"](\/(?:static\/chunks|assets|js)\/[a-zA-Z0-9_\-\.]+\.js)['"]/g;
    let dictMatch: RegExpExecArray | null;
    while ((dictMatch = dictPattern.exec(bundleText)) !== null) {
      const path = dictMatch[1];
      try {
        const fullUrl = new URL(path, bundleBaseUrl).href;
        if (!chunkUrls.includes(fullUrl)) {
          chunkUrls.push(fullUrl);
        }
      } catch {}
    }

    return chunkUrls;
  }

  /**
   * Mines Vite / Rollup dynamic imports and __vite__mapDeps dependency arrays from bundle text.
   */
  public extractViteDynamicImportsFromBundle(bundleText: string, bundleBaseUrl: string): string[] {
    const discovered: string[] = [];
    if (!bundleText || typeof bundleText !== 'string') return discovered;

    // 1. Dynamic import statements: import("./chunk-xyz.js")
    const dynamicImportRegex = /\bimport\s*\(\s*['"]([^'"]+\.js)['"]\s*\)/g;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = dynamicImportRegex.exec(bundleText)) !== null) {
      const relativePath = dMatch[1];
      try {
        const fullUrl = new URL(relativePath, bundleBaseUrl).href;
        if (!discovered.includes(fullUrl)) discovered.push(fullUrl);
      } catch {}
    }

    // 2. Vite asset chunk filenames inside arrays or mapDeps
    const assetChunkRegex = /['"]((?:assets\/|\.\/|\/)[a-zA-Z0-9_\-\.]+\.js)['"]/g;
    let aMatch: RegExpExecArray | null;
    while ((aMatch = assetChunkRegex.exec(bundleText)) !== null) {
      const clean = aMatch[1];
      try {
        const fullUrl = new URL(clean, bundleBaseUrl).href;
        if (!discovered.includes(fullUrl)) discovered.push(fullUrl);
      } catch {}
    }

    return discovered;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Client-Side Router Introspection & Inline Script Mining
// ═══════════════════════════════════════════════════════════════════════════════

export class RouterIntrospectionEngine {
  public static getInBrowserRouterIntrospectionScript(): string {
    return `
      (async function() {
        const endpoints = [];
        const seen = new Set();
        const base = document.baseURI || window.location.href;

        function addEndpoint(url, source, method, meta) {
          if (!url || typeof url !== 'string') return;
          const clean = url.trim();
          if (clean.length < 2 || clean.startsWith('javascript:') || clean.startsWith('data:') || clean.startsWith('#')) return;
          const key = (method || 'GET') + ':' + clean;
          if (seen.has(key)) return;
          seen.add(key);
          endpoints.push({
            url: clean,
            source: source,
            method: method || 'GET',
            metadata: meta || {}
          });
        }

        // 1. REACT ROUTER INTROSPECTION (v5 & v6 Fiber & Data Routers)
        try {
          if (window.__remixRouter && window.__remixRouter.routes) {
            const traverseRoutes = (routes, b = '') => {
              for (const r of routes) {
                if (!r) continue;
                let cur = b;
                if (r.path) cur = r.path.startsWith('/') ? r.path : (b + '/' + r.path).replace(/\\/+/g, '/');
                if (cur) addEndpoint(cur, 'router_route', 'GET', { framework: 'react-router-v6-data' });
                if (Array.isArray(r.children)) traverseRoutes(r.children, cur);
              }
            };
            traverseRoutes(window.__remixRouter.routes);
          }

          const rootElements = Array.from(document.querySelectorAll('#root, #app, [data-reactroot], body > div'));
          for (const el of rootElements) {
            const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$') || k.startsWith('__reactInternalInstance$'));
            if (!fiberKey) continue;
            let rootFiber = el[fiberKey];
            if (rootFiber && rootFiber.stateNode && rootFiber.stateNode.current) {
              rootFiber = rootFiber.stateNode.current;
            }

            const queue = [rootFiber];
            const visited = new Set();
            let steps = 0;
            while (queue.length > 0 && steps < 3000) {
              steps++;
              const fiber = queue.shift();
              if (!fiber || visited.has(fiber)) continue;
              visited.add(fiber);

              const props = fiber.memoizedProps;
              if (props) {
                if (typeof props.path === 'string') {
                  addEndpoint(props.path, 'router_route', 'GET', { framework: 'react-router-v5/v6' });
                } else if (Array.isArray(props.path)) {
                  props.path.forEach(p => typeof p === 'string' && addEndpoint(p, 'router_route', 'GET', { framework: 'react-router-v5/v6' }));
                }
                if (typeof props.from === 'string') addEndpoint(props.from, 'router_route', 'GET', { framework: 'react-router-redirect' });
                if (typeof props.to === 'string') addEndpoint(props.to, 'router_route', 'GET', { framework: 'react-router-redirect' });

                if (props.router && Array.isArray(props.router.routes)) {
                  const traverseDataRoutes = (routes, b = '') => {
                    for (const r of routes) {
                      if (!r) continue;
                      let cur = b;
                      if (r.path) cur = r.path.startsWith('/') ? r.path : (b + '/' + r.path).replace(/\\/+/g, '/');
                      if (cur) addEndpoint(cur, 'router_route', 'GET', { framework: 'react-router-v6-provider' });
                      if (Array.isArray(r.children)) traverseDataRoutes(r.children, cur);
                    }
                  };
                  traverseDataRoutes(props.router.routes);
                }
              }

              if (fiber.child) queue.push(fiber.child);
              if (fiber.sibling) queue.push(fiber.sibling);
            }
          }
        } catch(e) {}

        // 2. VUE ROUTER INTROSPECTION (v3 & v4)
        try {
          const vueRoots = Array.from(document.querySelectorAll('#app, [data-v-app], body > div'));
          for (const el of vueRoots) {
            if (el.__vue__ && el.__vue__.$router) {
              const router = el.__vue__.$router;
              if (typeof router.getRoutes === 'function') {
                router.getRoutes().forEach(r => r.path && addEndpoint(r.path, 'router_route', 'GET', { framework: 'vue-router-v3' }));
              } else if (router.options && Array.isArray(router.options.routes)) {
                const traverseVueRoutes = (routes) => {
                  for (const r of routes) {
                    if (r && r.path) addEndpoint(r.path, 'router_route', 'GET', { framework: 'vue-router-v3' });
                    if (r && Array.isArray(r.children)) traverseVueRoutes(r.children);
                  }
                };
                traverseVueRoutes(router.options.routes);
              }
            }

            if (el.__vue_app__) {
              const app = el.__vue_app__;
              if (app.config && app.config.globalProperties && app.config.globalProperties.$router) {
                const router = app.config.globalProperties.$router;
                if (typeof router.getRoutes === 'function') {
                  router.getRoutes().forEach(r => r.path && addEndpoint(r.path, 'router_route', 'GET', { framework: 'vue-router-v4' }));
                }
              }
              if (app._context && app._context.provides) {
                const provides = app._context.provides;
                const symbols = Object.getOwnPropertySymbols(provides);
                for (const sym of symbols) {
                  const val = provides[sym];
                  if (val && typeof val.getRoutes === 'function') {
                    val.getRoutes().forEach(r => r.path && addEndpoint(r.path, 'router_route', 'GET', { framework: 'vue-router-v4' }));
                  }
                }
                for (const k of Object.keys(provides)) {
                  const val = provides[k];
                  if (val && typeof val.getRoutes === 'function') {
                    val.getRoutes().forEach(r => r.path && addEndpoint(r.path, 'router_route', 'GET', { framework: 'vue-router-v4' }));
                  }
                }
              }
            }
          }
        } catch(e) {}

        // 3. NEXT.JS INTROSPECTION (Pages & App Router)
        try {
          if (window.__NEXT_DATA__) {
            const nd = window.__NEXT_DATA__;
            if (nd.page) addEndpoint(nd.page, 'router_route', 'GET', { framework: 'nextjs-page' });
            if (Array.isArray(nd.dynamicIds)) {
              nd.dynamicIds.forEach(id => addEndpoint(id, 'router_route', 'GET', { framework: 'nextjs-dynamic-id' }));
            }
            if (Array.isArray(nd.subFolders)) {
              nd.subFolders.forEach(sf => addEndpoint(sf, 'router_route', 'GET', { framework: 'nextjs-subfolder' }));
            }
            if (nd.props && nd.props.pageProps) {
              const str = JSON.stringify(nd.props.pageProps);
              const matches = str.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
              for (const m of matches) addEndpoint(m[1], 'router_route', 'GET', { framework: 'nextjs-pageprops' });
            }
          }

          if (window.__BUILD_MANIFEST) {
            for (const key of Object.keys(window.__BUILD_MANIFEST)) {
              if (key && !key.startsWith('_')) {
                addEndpoint(key, 'router_route', 'GET', { framework: 'nextjs-build-manifest' });
              }
            }
          }
          if (window.__SSG_MANIFEST) {
            const ssgList = Array.isArray(window.__SSG_MANIFEST) ? window.__SSG_MANIFEST : Array.from(window.__SSG_MANIFEST);
            ssgList.forEach(r => addEndpoint(r, 'router_route', 'GET', { framework: 'nextjs-ssg-manifest' }));
          }

          if (Array.isArray(window.__next_f)) {
            for (const item of window.__next_f) {
              if (Array.isArray(item) && typeof item[1] === 'string') {
                const chunk = item[1];
                const matches = chunk.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
                for (const m of matches) addEndpoint(m[1], 'router_route', 'GET', { framework: 'nextjs-app-router-rsc' });
              }
            }
          }
        } catch(e) {}

        // 4. REMIX & NUXT INTROSPECTION
        try {
          if (window.__remixManifest && window.__remixManifest.routes) {
            const routes = window.__remixManifest.routes;
            for (const [rId, rData] of Object.entries(routes)) {
              if (rData && rData.path !== undefined) {
                const segments = [rData.path];
                let pId = rData.parentId;
                while (pId && routes[pId]) {
                  const pData = routes[pId];
                  if (pData.path) segments.unshift(pData.path);
                  pId = pData.parentId;
                }
                const fullPath = '/' + segments.join('/').replace(/\\/+/g, '/').replace(/^\\//, '');
                const method = rData.hasAction ? 'POST' : 'GET';
                addEndpoint(fullPath, 'router_route', method, { framework: 'remix', hasAction: Boolean(rData.hasAction), hasLoader: Boolean(rData.hasLoader) });
              }
            }
          }

          if (window.__NUXT__) {
            const s = JSON.stringify(window.__NUXT__);
            const matches = s.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
            for (const m of matches) addEndpoint(m[1], 'router_route', 'GET', { framework: 'nuxt-v2' });
          }
          if (Array.isArray(window.__NUXT_DATA__)) {
            const s = JSON.stringify(window.__NUXT_DATA__);
            const matches = s.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
            for (const m of matches) addEndpoint(m[1], 'router_route', 'GET', { framework: 'nuxt-v3' });
          }
        } catch(e) {}

        // 5. HTML COMMENTS EXTRACTION (TreeWalker)
        try {
          const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT, null, false);
          let node;
          while ((node = walker.nextNode())) {
            const text = (node.nodeValue || '').trim();
            if (!text || text.length < 3) continue;

            const attrMatches = text.matchAll(/(?:href|action|src|data-url)=["']([^"']+)["']/gi);
            for (const m of attrMatches) {
              addEndpoint(m[1], 'html_comment', 'GET', { context: 'comment_attr', snippet: text.slice(0, 100) });
            }

            const pathMatches = text.matchAll(/(?:['"\\x60\\s]|^)(\\/(?:api|v[0-9]+|admin|internal|graphql|v1|v2|v3|auth|debug|user)[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)/gi);
            for (const m of pathMatches) {
              addEndpoint(m[1], 'html_comment', 'GET', { context: 'comment_path', snippet: text.slice(0, 100) });
            }

            const urlMatches = text.matchAll(/(https?:\\/\\/[a-zA-Z0-9_\\-\\.:]+\\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]+)/gi);
            for (const m of urlMatches) {
              addEndpoint(m[1], 'html_comment', 'GET', { context: 'comment_absolute_url', snippet: text.slice(0, 100) });
            }
          }
        } catch(e) {}

        // 6. INLINE SCRIPT LEXICAL MINING
        try {
          const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
          for (const sc of inlineScripts) {
            const type = (sc.getAttribute('type') || '').toLowerCase();
            if (type && type !== 'text/javascript' && type !== 'application/javascript' && type !== 'module' && type !== '') continue;
            const content = sc.textContent || '';
            if (!content || content.length < 5 || content.length > 500000) continue;

            const httpMatches = content.matchAll(/(?:fetch|axios(?:\\.[a-zA-Z0-9_]+)?|\\$\\.ajax|\\$\\.get|\\$\\.post|xhr\\.open)\\s*\\(\\s*['"\\x60]?([^'"\\x60\\s,\\)]+)/gi);
            for (const m of httpMatches) {
              let method = 'GET';
              const snippet = content.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).toLowerCase();
              if (snippet.includes('.post(') || snippet.includes("method: 'post'") || snippet.includes('method: "post"')) method = 'POST';
              else if (snippet.includes('.put(') || snippet.includes("method: 'put'")) method = 'PUT';
              else if (snippet.includes('.delete(') || snippet.includes("method: 'delete'")) method = 'DELETE';
              addEndpoint(m[1], 'script_ast', method, { context: 'inline_http_call' });
            }

            const pathMatches = content.matchAll(/(?:['"\\x60])(\\/(?:api|v[0-9]+|admin|internal|graphql|auth|user|dashboard)[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)(?:['"\\x60])/gi);
            for (const m of pathMatches) {
              addEndpoint(m[1], 'script_ast', 'GET', { context: 'inline_string_literal' });
            }

            const templateMatches = content.matchAll(/\\x60([^\\x60]*?\\/(?:api|v[0-9]+|admin|internal|graphql)[^\\x60]*?)\\x60/gi);
            for (const m of templateMatches) {
              const generalized = m[1].replace(/\\$\\{[^}]+\\}/g, '{param}');
              addEndpoint(generalized, 'script_ast', 'GET', { context: 'inline_template_literal' });
            }
          }
        } catch(e) {}

        return endpoints;
      })();
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Node-Side TypeScript AST Script Miner
// ═══════════════════════════════════════════════════════════════════════════════

export class TypeScriptAstEndpointMiner {
  /**
   * Parses JavaScript or TypeScript code into an AST and extracts:
   * 1. CallExpressions (fetch, axios, $.ajax, router.push, navigate)
   * 2. StringLiterals containing API endpoints
   * 3. TemplateExpressions with generalized parameter tokens
   */
  public static extractFromScriptSource(sourceCode: string, sourcePath: string = 'inline_script'): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    const seen = new Set<string>();

    if (!sourceCode || typeof sourceCode !== 'string') return endpoints;

    try {
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TSX
      );

      const record = (url: string, method: string = 'GET', metadata: Record<string, string> = {}) => {
        const clean = url.trim();
        if (!clean || clean.startsWith('//') || clean.startsWith('/*')) return;
        const key = `${method}:${clean}`;
        if (seen.has(key)) return;
        seen.add(key);

        endpoints.push({
          url: clean,
          source: 'script_ast',
          method,
          parameters: metadata,
          discoveredAt: Date.now()
        });
      };

      function visit(node: ts.Node) {
        // 1. Call Expressions: fetch('/api/...'), axios.post('/api/...')
        if (ts.isCallExpression(node)) {
          const expressionText = node.expression.getText(sourceFile);

          let inferredMethod = 'GET';
          if (expressionText.includes('.post') || expressionText.includes('create')) inferredMethod = 'POST';
          else if (expressionText.includes('.put')) inferredMethod = 'PUT';
          else if (expressionText.includes('.delete')) inferredMethod = 'DELETE';
          else if (expressionText.includes('.patch')) inferredMethod = 'PATCH';

          // Check options argument for method in fetch(url, options)
          if (node.arguments.length > 1) {
            const optsText = node.arguments[1].getText(sourceFile).toUpperCase();
            if (optsText.includes("METHOD: 'POST'") || optsText.includes('METHOD: "POST"') || optsText.includes("METHOD:'POST'") || optsText.includes('METHOD:"POST"')) {
              inferredMethod = 'POST';
            } else if (optsText.includes("METHOD: 'PUT'") || optsText.includes('METHOD: "PUT"') || optsText.includes("METHOD:'PUT'") || optsText.includes('METHOD:"PUT"')) {
              inferredMethod = 'PUT';
            } else if (optsText.includes("METHOD: 'DELETE'") || optsText.includes('METHOD: "DELETE"') || optsText.includes("METHOD:'DELETE'") || optsText.includes('METHOD:"DELETE"')) {
              inferredMethod = 'DELETE';
            } else if (optsText.includes("METHOD: 'PATCH'") || optsText.includes('METHOD: "PATCH"') || optsText.includes("METHOD:'PATCH'") || optsText.includes('METHOD:"PATCH"')) {
              inferredMethod = 'PATCH';
            }
          }

          if (
            expressionText.startsWith('fetch') ||
            expressionText.startsWith('axios') ||
            expressionText.includes('$.ajax') ||
            expressionText.includes('$.post') ||
            expressionText.includes('$.get') ||
            expressionText.startsWith('navigate') ||
            expressionText.includes('router.push')
          ) {
            if (node.arguments.length > 0) {
              const firstArg = node.arguments[0];
              if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                record(firstArg.text, inferredMethod, { callType: expressionText });
              } else if (ts.isTemplateExpression(firstArg)) {
                let generalized = firstArg.head.text;
                for (const span of firstArg.templateSpans) {
                  generalized += '{param}' + span.literal.text;
                }
                record(generalized, inferredMethod, { callType: expressionText });
              }
            }
          }
        }

        // 2. Standalone String Literals matching route conventions
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          const text = node.text;
          if (/^\/(?:api|v[0-9]+|graphql|admin|internal|auth|users?|products?|items?|webhooks?)\b/i.test(text)) {
            record(text, 'GET', { literalType: 'api_path' });
          }
        }

        // 3. Template Literals matching API conventions
        if (ts.isTemplateExpression(node)) {
          let fullTemplate = node.head.text;
          for (const span of node.templateSpans) {
            fullTemplate += '{param}' + span.literal.text;
          }
          if (/^\/(?:api|v[0-9]+|graphql|admin|internal)\b/i.test(fullTemplate)) {
            record(fullTemplate, 'GET', { literalType: 'template_path' });
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    } catch {}

    return endpoints;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Web Worker & Service Worker Dredging
// ═══════════════════════════════════════════════════════════════════════════════

export class WorkerDredgingEngine {
  public static getInBrowserWorkerDredgeScript(): string {
    return `
      (async function() {
        const endpoints = [];
        const seen = new Set();

        function addEndpoint(url, method, meta) {
          if (!url || typeof url !== 'string') return;
          const clean = url.trim();
          if (clean.length < 2 || clean.startsWith('javascript:')) return;
          const key = (method || 'GET') + ':' + clean;
          if (seen.has(key)) return;
          seen.add(key);
          endpoints.push({
            url: clean,
            source: 'worker',
            method: method || 'GET',
            metadata: meta || {}
          });
        }

        // 1. ServiceWorker registrations
        try {
          if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              if (reg.scope) addEndpoint(reg.scope, 'GET', { type: 'service_worker_scope' });
              const workerScript = (reg.active || reg.waiting || reg.installing)?.scriptURL;
              if (workerScript) addEndpoint(workerScript, 'GET', { type: 'service_worker_script' });
            }
          }
        } catch(e) {}

        // 2. CacheStorage requests
        try {
          if (window.caches && typeof window.caches.keys === 'function') {
            const cacheNames = await window.caches.keys();
            for (const cName of cacheNames) {
              try {
                const cache = await window.caches.open(cName);
                const requests = await cache.keys();
                for (const req of requests) {
                  if (req && req.url) {
                    addEndpoint(req.url, req.method || 'GET', { cacheName: cName });
                  }
                }
              } catch(cErr) {}
            }
          }
        } catch(e) {}

        // 3. Intercepted Workers
        try {
          if (Array.isArray(window.__SENTINEL_DISCOVERED_WORKERS__)) {
            for (const w of window.__SENTINEL_DISCOVERED_WORKERS__) {
              if (w && w.url) addEndpoint(w.url, 'GET', { workerType: w.type });
            }
          }
        } catch(e) {}

        return endpoints;
      })();
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MultiSourceEndpointMiner Orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

export class MultiSourceEndpointMiner {
  private dynamicBundleMiner = new DynamicBundleMiner();

  /**
   * Normalizes an endpoint using the sovereign EndpointNormalizer engine.
   */
  public normalizeEndpoint(rawUrl: string, baseUrl: string): NormalizedEndpoint {
    return endpointNormalizer.normalizeEndpoint(rawUrl, baseUrl);
  }

  /**
   * Exhaustively extracts endpoints from the active page across all DOM sources,
   * code-split JS bundles, client-side routers, AST scripts, HTML comments, and workers.
   */
  public async extractEndpoints(context: PageContext): Promise<DiscoveredEndpoint[]> {
    const endpoints: DiscoveredEndpoint[] = [];
    const seenKeys = new Set<string>();

    const addEndpoint = (ep: Omit<DiscoveredEndpoint, 'discoveredAt'>) => {
      const key = `${ep.method || 'GET'}:${ep.source}:${ep.url}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        endpoints.push({
          ...ep,
          discoveredAt: Date.now()
        });
      }
    };

    const driver = context.driver;

    // 1. In-Browser Dynamic Mining via CDP Driver (if available)
    if (driver && typeof driver.evaluate === 'function') {
      // 1a. Multi-Source DOM Extraction
      try {
        const domResult = await driver.evaluate(DomLinkExtractor.getInBrowserExtractionScript());
        if (domResult) {
          if (Array.isArray(domResult.links)) {
            for (const l of domResult.links) {
              addEndpoint({
                url: l.url,
                source: 'dom_link',
                method: l.isPing ? 'POST' : 'GET'
              });
            }
          }
          if (Array.isArray(domResult.forms)) {
            for (const f of domResult.forms) {
              addEndpoint({
                url: f.actionUrl,
                source: 'dom_form',
                method: f.method,
                parameters: f.parameters
              });
            }
          }
          if (Array.isArray(domResult.buttons)) {
            for (const b of domResult.buttons) {
              addEndpoint({
                url: b.url,
                source: 'dom_button',
                method: b.method
              });
            }
          }
        }
      } catch (err) {}

      // 1b. Dynamic Bundle & Mutation Manifest Mining
      try {
        const manifestResult: ManifestDredgeResult = await driver.evaluate(DynamicBundleMiner.getInBrowserManifestDredgeScript());
        if (manifestResult) {
          if (Array.isArray(manifestResult.trappedScripts)) {
            for (const s of manifestResult.trappedScripts) {
              addEndpoint({
                url: s,
                source: 'bundle_chunk',
                method: 'GET'
              });
            }
          }
          if (Array.isArray(manifestResult.nextBuildManifestRoutes)) {
            for (const r of manifestResult.nextBuildManifestRoutes) {
              const fullRouteUrl = new URL(r, context.currentUrl).href;
              addEndpoint({
                url: fullRouteUrl,
                source: 'router_route',
                method: 'GET'
              });
            }
          }
          if (Array.isArray(manifestResult.nextBuildManifestChunks)) {
            for (const c of manifestResult.nextBuildManifestChunks) {
              addEndpoint({
                url: c,
                source: 'bundle_chunk',
                method: 'GET'
              });
            }
          }
        }
      } catch (err) {}

      // 1c. Router Introspection, Comments & Inline Script Mining
      try {
        const routerResult: RouterIntrospectionItem[] = await driver.evaluate(RouterIntrospectionEngine.getInBrowserRouterIntrospectionScript());
        if (Array.isArray(routerResult)) {
          for (const item of routerResult) {
            const resolvedUrl = new URL(item.url, context.currentUrl).href;
            addEndpoint({
              url: resolvedUrl,
              source: item.source,
              method: item.method || 'GET',
              metadata: item.metadata
            });
          }
        }
      } catch (err) {}

      // 1d. Worker & Service Worker Dredging
      try {
        const workerResult = await driver.evaluate(WorkerDredgingEngine.getInBrowserWorkerDredgeScript());
        if (Array.isArray(workerResult)) {
          for (const item of workerResult) {
            const resolvedUrl = new URL(item.url, context.currentUrl).href;
            addEndpoint({
              url: resolvedUrl,
              source: 'worker',
              method: item.method || 'GET',
              metadata: item.metadata
            });
          }
        }
      } catch (err) {}
    }

    // 2. Static HTML Extraction Fallback (when html is provided)
    if (context.html) {
      const staticEndpoints = this.extractFromHtml(context.html, context.currentUrl);
      for (const ep of staticEndpoints) {
        addEndpoint(ep);
      }
    }

    return endpoints;
  }

  /**
   * Static HTML parsing engine for unit tests and non-browser execution.
   */
  public extractFromHtml(html: string, baseUrl: string): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    const seen = new Set<string>();

    if (!html || typeof html !== 'string') return endpoints;

    const resolve = (raw: string): string | null => {
      if (!raw || typeof raw !== 'string') return null;
      const clean = raw.trim();
      if (!clean || clean === '#' || clean.startsWith('javascript:') || clean.startsWith('mailto:') || clean.startsWith('tel:') || clean.startsWith('data:')) {
        return null;
      }
      try {
        return new URL(clean, baseUrl).href;
      } catch {
        return null;
      }
    };

    const isTrapSnippet = (snippet: string): boolean => {
      const s = snippet.toLowerCase();
      if (s.includes('display:none') || s.includes('display: none') || s.includes('visibility:hidden') || s.includes('visibility: hidden') || s.includes('opacity:0') || s.includes('opacity: 0')) {
        return true;
      }
      if (s.includes('bot-trap') || s.includes('honeypot') || s.includes('honey-pot') || s.includes('decoy') || s.includes('aria-hidden="true"')) {
        return true;
      }
      // Strip URL / target values and explicit hidden inputs so genuine URLs containing 'hidden' are not pruned
      const sanitized = s
        .replace(/(?:href|src|srcdoc|action|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/type\s*=\s*["']?hidden["']?/gi, '')
        .replace(/type\s*=\s*&quot;hidden&quot;/gi, '');

      // Check for standalone boolean hidden attribute: e.g. <tag hidden> or hidden="true" or hidden="hidden"
      if (/(?:^|\s)hidden(?:\s*=\s*["']?(?:true|hidden)?["']?)?(?:\s|$|>)/i.test(sanitized)) {
        return true;
      }
      return false;
    };

    const extractAttr = (attrs: string, attrName: string): string | null => {
      const regex = new RegExp(`(?:${attrName})=(?:"([^"]*)"|'([^']*)'|([^>\\s]+))`, 'i');
      const m = regex.exec(attrs);
      if (!m) return null;
      return m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]);
    };

    const add = (url: string, source: DiscoveredEndpoint['source'], method: string = 'GET', params?: Record<string, string>) => {
      const key = `${method}:${source}:${url}`;
      if (!seen.has(key)) {
        seen.add(key);
        endpoints.push({
          url,
          source,
          method,
          parameters: params,
          discoveredAt: Date.now()
        });
      }
    };

    // 1. Anchors: <a href="..." ping="..." download>
    const anchorRegex = /<a\s+([^>]+)>/gi;
    let aMatch: RegExpExecArray | null;
    while ((aMatch = anchorRegex.exec(html)) !== null) {
      const attrs = aMatch[1];
      if (isTrapSnippet(attrs)) continue;

      const rawHref = extractAttr(attrs, 'href') || extractAttr(attrs, 'data-url') || extractAttr(attrs, 'data-href');
      if (rawHref) {
        const resolved = resolve(rawHref);
        if (resolved) add(resolved, 'dom_link', 'GET');
      }

      const ping = extractAttr(attrs, 'ping');
      if (ping) {
        const pingUrls = ping.trim().split(/\s+/);
        for (const pu of pingUrls) {
          const resolved = resolve(pu);
          if (resolved) add(resolved, 'dom_link', 'POST');
        }
      }
    }

    // 2. Forms: <form action="..." method="...">
    const formRegex = /<form\s+([^>]*?)>([\s\S]*?)<\/form>/gi;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = formRegex.exec(html)) !== null) {
      const formAttrs = fMatch[1];
      const formBody = fMatch[2];
      if (isTrapSnippet(formAttrs)) continue;

      const rawAction = extractAttr(formAttrs, 'action') || extractAttr(formAttrs, 'data-action') || '';
      const actionUrl = resolve(rawAction) || baseUrl;

      const rawMethod = extractAttr(formAttrs, 'method');
      const method = (rawMethod ? rawMethod : 'GET').toUpperCase();

      const parameters: Record<string, string> = {};
      const inputRegex = /<(?:input|textarea|select)\s+([^>]+)>/gi;
      let iMatch: RegExpExecArray | null;
      while ((iMatch = inputRegex.exec(formBody)) !== null) {
        const iAttrs = iMatch[1];
        const inputType = (extractAttr(iAttrs, 'type') || '').toLowerCase();
        if (inputType !== 'hidden' && isTrapSnippet(iAttrs)) continue;

        const name = extractAttr(iAttrs, 'name');
        if (name) {
          const val = extractAttr(iAttrs, 'value') || '';
          parameters[name] = val;
        }
      }

      add(actionUrl, 'dom_form', method, parameters);
    }

    // 3. Buttons: <button formaction="..." data-url="..." onclick="...">
    const buttonRegex = /<(?:button|input\s+type=["'](?:submit|button)["'])\s+([^>]+)>/gi;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = buttonRegex.exec(html)) !== null) {
      const bAttrs = bMatch[1];
      if (isTrapSnippet(bAttrs)) continue;

      const formaction = extractAttr(bAttrs, 'formaction');
      if (formaction) {
        const resolved = resolve(formaction);
        const formMethod = (extractAttr(bAttrs, 'formmethod') || 'GET').toUpperCase();
        if (resolved) add(resolved, 'dom_button', formMethod);
      }

      const dataUrl = extractAttr(bAttrs, 'data-url') || extractAttr(bAttrs, 'data-href') || extractAttr(bAttrs, 'data-endpoint');
      if (dataUrl) {
        const resolved = resolve(dataUrl);
        if (resolved) add(resolved, 'dom_button', 'GET');
      }

      const onclick = extractAttr(bAttrs, 'onclick');
      if (onclick) {
        const patterns = [
          /(?:location\.(?:href|assign|replace)|window\.location)\s*(?:=|\()\s*['"\x60]([^'"\x60\s\)]+)['"\x60]/gi,
          /window\.open\s*\(\s*['"\x60]([^'"\x60\s,\)]+)['"\x60]/gi,
          /(?:router\.(?:push|replace|go)|navigate)\s*\(\s*['"\x60]([^'"\x60\s,\)]+)['"\x60]/gi,
          /['"\x60](\/(?:api|v[0-9]+|[a-zA-Z0-9_\-]+)\/[a-zA-Z0-9_\-\.\/\?=&%#]*)['"\x60]/gi
        ];
        for (const pat of patterns) {
          pat.lastIndex = 0;
          let om: RegExpExecArray | null;
          while ((om = pat.exec(onclick)) !== null) {
            const resolved = resolve(om[1]);
            if (resolved) add(resolved, 'dom_button', 'GET');
            if (pat.lastIndex === 0) break;
          }
        }
      }
    }

    // 4. Iframes: <iframe src="..." srcdoc="...">
    const iframeRegex = /<iframe\s+([^>]+)>/gi;
    let ifrMatch: RegExpExecArray | null;
    while ((ifrMatch = iframeRegex.exec(html)) !== null) {
      const ifrAttrs = ifrMatch[1];
      if (isTrapSnippet(ifrAttrs)) continue;

      const src = extractAttr(ifrAttrs, 'src') || extractAttr(ifrAttrs, 'data-src');
      if (src) {
        const resolved = resolve(src);
        if (resolved) add(resolved, 'dom_link', 'GET');
      }

      let srcdoc = extractAttr(ifrAttrs, 'srcdoc');
      if (srcdoc) {
        srcdoc = srcdoc
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
        const nested = this.extractFromHtml(srcdoc, baseUrl);
        for (const ne of nested) {
          add(ne.url, ne.source, ne.method, ne.parameters);
        }
      }
    }

    // 5. HTML Comments: <!-- ... -->
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = commentRegex.exec(html)) !== null) {
      const commentText = cMatch[1];
      const linkMatches = commentText.matchAll(/(?:href|action|src)=["']([^"']+)["']/gi);
      for (const m of linkMatches) {
        const resolved = resolve(m[1]);
        if (resolved) add(resolved, 'html_comment', 'GET');
      }
      const apiMatches = commentText.matchAll(/(?:["'\x60\s]|^)(\/(?:api|v[0-9]+|admin|internal|graphql)[a-zA-Z0-9_\-\.\/\?=&%#]*)/gi);
      for (const m of apiMatches) {
        const resolved = resolve(m[1]);
        if (resolved) add(resolved, 'html_comment', 'GET');
      }
    }

    // 6. Inline Scripts: <script>...</script>
    const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = scriptRegex.exec(html)) !== null) {
      const scriptBody = sMatch[1];
      if (scriptBody && scriptBody.length > 5) {
        const astEndpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(scriptBody, 'inline_html_script');
        for (const ep of astEndpoints) {
          const resolved = resolve(ep.url);
          if (resolved) add(resolved, 'script_ast', ep.method, ep.parameters);
        }
      }
    }

    return endpoints;
  }
}

export const multiSourceEndpointMiner = new MultiSourceEndpointMiner();

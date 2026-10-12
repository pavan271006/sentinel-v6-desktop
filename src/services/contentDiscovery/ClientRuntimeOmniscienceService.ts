/**
 * Sentinel Sovereign Ω - Client Runtime Omniscience Service
 * src/services/contentDiscovery/ClientRuntimeOmniscienceService.ts
 *
 * Implements Level 6 Omniscient Discovery capabilities:
 * 1. Runtime Pre-Execution Instrumentation & Dynamic Script Mutation Hooking:
 *    Hooks DOM script additions, HTMLScriptElement.prototype.src setter,
 *    Webpack chunk arrays, and Worker constructors to trap dynamic endpoints.
 * 2. Deep Offline Storage & Manifest Dredging:
 *    Inspects CacheStorage (window.caches), Service Workers, Next.js/Nuxt/Remix
 *    manifests, and client storage (localStorage/sessionStorage).
 * 3. Client-Side Router Introspection:
 *    Introspects React Router, Vue Router, Next.js App/Pages Router, Remix, and Nuxt.
 * 4. Session Liveness & Drift Sentinel:
 *    Continuously validates session authentication health and detects unexpected
 *    session expiration, 401 redirects, or de-authentication events.
 */

import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';
import { RouterIntrospectionEngine } from './MultiSourceEndpointMiner';

export interface TrappedRoute {
  url: string;
  method: string;
  source: string;
  postData?: string;
  timestamp: number;
}

export interface DredgedStorageItem {
  url: string;
  source: string;
  title?: string;
}

export interface SessionLivenessStatus {
  isAlive: boolean;
  currentUrl: string;
  reason?: string;
}

export class ClientRuntimeOmniscienceService {
  /**
   * Generates the pre-execution injection script for Page.addScriptToEvaluateOnNewDocument
   * and immediate page evaluation.
   * Adheres to the Zero-Tampering standard (Scrapling/Patchright): does not monkey-patch
   * Function.prototype.toString, WebGL, or navigator.webdriver, ensuring full compatibility
   * with Cloudflare Turnstile, Akamai Bot Manager, and modern WAF challenge routines.
   */
  public static getInjectionScript(): string {
    return `
      (function() {
        if (window.__SENTINEL_OBSERVER_INJECTED__) return;
        window.__SENTINEL_OBSERVER_INJECTED__ = true;

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

        // 1. Passive DOM mutation tracker for Adaptive DOM Settle & dynamic script additions
        try {
          window.__SENTINEL_LAST_MUTATION_TS__ = Date.now();
          const observer = new MutationObserver(function(mutations) {
            window.__SENTINEL_LAST_MUTATION_TS__ = Date.now();

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
            observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
          } else {
            document.addEventListener('DOMContentLoaded', function() {
              if (document.documentElement) {
                observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
              }
            });
          }
        } catch(e) {}

        // 2. Intercept HTMLScriptElement.prototype.src descriptor transparently
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

        // 3. Hook Webpack chunk arrays (window.webpackChunk* / window.webpackJsonp)
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

  /**
   * Generates router introspection script.
   */
  public static getRouterIntrospectionScript(): string {
    return RouterIntrospectionEngine.getInBrowserRouterIntrospectionScript();
  }

  /**
   * Injects the pre-execution instrumentation into the live document immediately.
   */
  public async injectInstrumentation(): Promise<void> {
    try {
      await stealthCdpBrowserDriver.evaluate(ClientRuntimeOmniscienceService.getInjectionScript());
    } catch {}
  }

  /**
   * Drains trapped routes (no-op since routes are captured passively via native CDP Network domain).
   */
  public async drainTrappedRoutes(): Promise<TrappedRoute[]> {
    return [];
  }

  /**
   * Dredges client-side framework route manifests (Next.js, Nuxt, Remix, Webpack chunks),
   * hydration state blobs, localStorage/sessionStorage, CacheStorage, and Service Workers for hidden API endpoints.
   */
  public async dredgeOfflineStorage(): Promise<DredgedStorageItem[]> {
    try {
      const results = await stealthCdpBrowserDriver.evaluate<DredgedStorageItem[]>(`
        (async function() {
          const items = [];
          const seen = new Set();
          const base = document.baseURI || window.location.href;

          const addRoute = (url, source, title) => {
            if (!url || typeof url !== 'string') return;
            const clean = url.trim();
            if (clean.length > 2 && !clean.startsWith('//') && !clean.startsWith('/*') && !seen.has(clean)) {
              if (clean.startsWith('/') || clean.startsWith('http://') || clean.startsWith('https://')) {
                seen.add(clean);
                items.push({ url: clean, source, title: title || clean });
              }
            }
          };

          // 1. Next.js manifest inspection (__NEXT_DATA__, __BUILD_MANIFEST, __SSG_MANIFEST, __next_f)
          try {
            if (window.__NEXT_DATA__) {
              const nd = window.__NEXT_DATA__;
              if (nd.page) addRoute(nd.page, 'NextJS-Page', 'Next.js Active Page');
              if (Array.isArray(nd.dynamicIds)) {
                nd.dynamicIds.forEach(id => addRoute(id, 'NextJS-DynamicId', 'Next.js Dynamic Route'));
              }
              if (nd.props && nd.props.pageProps) {
                const s = JSON.stringify(nd.props.pageProps);
                const matches = s.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
                for (const m of matches) addRoute(m[1], 'NextJS-PageProps', 'Next.js Props Route');
              }
            }

            if (window.__BUILD_MANIFEST) {
              for (const [r, chunks] of Object.entries(window.__BUILD_MANIFEST)) {
                if (r && r.startsWith('/')) addRoute(r, 'NextJS-BuildManifest', 'Next.js Route');
                if (Array.isArray(chunks)) {
                  for (const c of chunks) {
                    if (typeof c === 'string') addRoute('/_next/' + c.replace(/^\\//, ''), 'NextJS-Chunk', 'Next.js Chunk');
                  }
                }
              }
            }

            if (window.__SSG_MANIFEST) {
              const list = Array.isArray(window.__SSG_MANIFEST) ? window.__SSG_MANIFEST : Array.from(window.__SSG_MANIFEST);
              for (const r of list) {
                if (typeof r === 'string' && r.startsWith('/')) addRoute(r, 'NextJS-SSGManifest', 'Next.js SSG Route');
              }
            }

            if (Array.isArray(window.__next_f)) {
              for (const item of window.__next_f) {
                if (Array.isArray(item) && typeof item[1] === 'string') {
                  const chunk = item[1];
                  const matches = chunk.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
                  for (const m of matches) addRoute(m[1], 'NextJS-AppRouterRSC', 'Next.js Flight Route');
                }
              }
            }
          } catch(e) {}

          // 2. Nuxt.js manifest inspection (__NUXT__, __NUXT_DATA__)
          try {
            if (window.__NUXT__) {
              const s = JSON.stringify(window.__NUXT__);
              const matches = s.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
              for (const m of matches) addRoute(m[1], 'NuxtJS-State', 'Nuxt Route');
            }
            if (Array.isArray(window.__NUXT_DATA__)) {
              const s = JSON.stringify(window.__NUXT_DATA__);
              const matches = s.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
              for (const m of matches) addRoute(m[1], 'NuxtJS-Data', 'Nuxt 3 Route');
            }
          } catch(e) {}

          // 3. Remix route manifest inspection (__remixManifest)
          try {
            if (window.__remixManifest && window.__remixManifest.routes) {
              for (const [rId, rData] of Object.entries(window.__remixManifest.routes)) {
                if (rData && rData.path) addRoute('/' + rData.path.replace(/^\\//, ''), 'Remix-Manifest', 'Remix Route: ' + rId);
              }
            }
          } catch(e) {}

          // 4. Client Storage (localStorage & sessionStorage) Route Extraction
          try {
            const storages = [window.localStorage, window.sessionStorage];
            for (const st of storages) {
              if (!st) continue;
              for (let i = 0; i < st.length && i < 100; i++) {
                const k = st.key(i);
                if (!k) continue;
                const v = st.getItem(k);
                if (!v || v.length > 50000) continue;
                const matches = v.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
                for (const m of matches) addRoute(m[1], 'ClientStorage-Entry', 'Storage: ' + k);
              }
            }
          } catch(e) {}

          // 5. Script Hydration Blocks (application/json)
          try {
            const jsonScripts = document.querySelectorAll('script[type="application/json"], script[id="__NEXT_DATA__"]');
            for (const sc of jsonScripts) {
              const txt = (sc.textContent || '').trim();
              if (txt && txt.length < 150000) {
                const matches = txt.matchAll(/['"](\/(?:api|v[0-9]+|[a-zA-Z0-9_\\-]+)\/[a-zA-Z0-9_\\-\\.\\/\\?=&%#]*)['"]/g);
                for (const m of matches) addRoute(m[1], 'HydrationJSON-Block', 'Hydration State Route');
              }
            }
          } catch(e) {}

          // 6. CacheStorage requests & Service Worker registrations
          try {
            if (window.caches && typeof window.caches.keys === 'function') {
              const cNames = await window.caches.keys();
              for (const cn of cNames) {
                try {
                  const cache = await window.caches.open(cn);
                  const reqs = await cache.keys();
                  for (const req of reqs) {
                    if (req && req.url) addRoute(req.url, 'CacheStorage', 'Cached Request: ' + cn);
                  }
                } catch(err) {}
              }
            }
            if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (const reg of regs) {
                if (reg.scope) addRoute(reg.scope, 'ServiceWorker-Scope', 'Service Worker Scope');
                const scriptURL = (reg.active || reg.waiting || reg.installing)?.scriptURL;
                if (scriptURL) addRoute(scriptURL, 'ServiceWorker-Script', 'Service Worker Script');
              }
            }
          } catch(e) {}

          return items.slice(0, 100);
        })()
      `);
      return results || [];
    } catch {
      return [];
    }
  }

  /**
   * Introspects client-side framework routers using RouterIntrospectionEngine.
   */
  public async introspectClientRouters(): Promise<DredgedStorageItem[]> {
    try {
      const results = await stealthCdpBrowserDriver.evaluate<any[]>(ClientRuntimeOmniscienceService.getRouterIntrospectionScript());
      if (Array.isArray(results)) {
        return results.map(r => ({
          url: r.url,
          source: r.source || 'RouterIntrospection',
          title: r.metadata?.framework || r.source
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Continuous Session Liveness Sentinel: Inspects whether the active browser tab
   * has suffered session de-authentication, redirect to login, or token expiration.
   */
  public async inspectSessionLiveness(): Promise<SessionLivenessStatus> {
    try {
      const res = await stealthCdpBrowserDriver.evaluate<SessionLivenessStatus>(`
        (function() {
          const currentUrl = window.location.href;
          const urlLower = currentUrl.toLowerCase();
          const title = (document.title || '').toLowerCase();
          const body = (document.body ? document.body.innerText : '').slice(0, 1500).toLowerCase();

          // Check for URL redirect to login / sign-in
          const isLoginUrl =
            urlLower.endsWith('/login') ||
            urlLower.includes('/login?') ||
            urlLower.includes('/signin') ||
            urlLower.includes('/auth/login') ||
            urlLower.includes('/session/new');

          // Check for explicit session expiration text in title / body
          const isSessionExpiredText =
            title.includes('session expired') ||
            title.includes('session timed out') ||
            body.includes('your session has expired') ||
            body.includes('session timed out') ||
            body.includes('please sign in again to continue');

          if (isLoginUrl || isSessionExpiredText) {
            return {
              isAlive: false,
              currentUrl,
              reason: isLoginUrl ? 'Redirected to login page (' + currentUrl + ')' : 'Session expiration text detected on page'
            };
          }

          return {
            isAlive: true,
            currentUrl
          };
        })()
      `);
      return res || { isAlive: true, currentUrl: '' };
    } catch {
      return { isAlive: true, currentUrl: '' };
    }
  }
}

export const clientRuntimeOmniscienceService = new ClientRuntimeOmniscienceService();

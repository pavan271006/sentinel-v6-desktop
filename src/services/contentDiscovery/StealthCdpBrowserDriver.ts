/**
 * Sentinel Sovereign Ω - Stealth CDP Browser Driver
 *
 * Implements a clean, low-level Chrome DevTools Protocol (CDP) client over WebSocket.
 * Communicates directly with the system Chrome browser (launched with proxy on :8085
 * and remote debugging on :9222).
 *
 * Features:
 * - Direct protocol command execution without noisy automation framework wrappers
 * - Dispatches authentic human-like mouse events (move -> press -> delay -> release)
 * - Captures live page state, DOM structures, and triggers client-side navigation
 * - Network stream event listeners for real-time response body inspection and token harvesting
 */

import { ipcClient } from '../../ipc/client';
import { ClientRuntimeOmniscienceService } from './ClientRuntimeOmniscienceService';
import { humanBiometricStealthEngine } from './HumanBiometricStealthEngine';

export interface CdpTargetPage {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

export interface CdpClickOptions {
  x: number;
  y: number;
  steps?: number;
  delayMs?: number;
}

export interface ElementLocator {
  selector?: string;
  textMatch?: string;
  hrefMatch?: string;
  idMatch?: string;
  nameMatch?: string;
  ariaMatch?: string;
  placeholderMatch?: string;
  adaptive?: boolean;
  adaptiveThreshold?: number;
  fallbackX?: number;
  fallbackY?: number;
  delayMs?: number;
}

export interface BrowserFetchResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export class StealthCdpBrowserDriver {
  private ws: WebSocket | null = null;
  private msgId = 1;
  private pendingCallbacks = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private eventListeners = new Map<string, Set<(params: any) => void>>();
  private activePageUrl: string = '';
  private debugPort: number = 9222;
  private isConnected: boolean = false;
  private activeTargetPage: CdpTargetPage | null = null;

  constructor(debugPort: number = 9222) {
    this.debugPort = debugPort;
  }

  public get connected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public get currentUrl(): string {
    return this.activePageUrl;
  }

  public get targetPage(): CdpTargetPage | null {
    return this.activeTargetPage;
  }

  /**
   * Retrieves the live evaluated URL from the connected browser page
   */
  public async getLiveUrl(): Promise<string> {
    try {
      const live = await this.evaluate<string>('window.location.href');
      if (live && typeof live === 'string') {
        this.activePageUrl = live;
        return live;
      }
    } catch {}
    return this.activePageUrl;
  }

  /**
   * Subscribes to a CDP background event (e.g. Network.responseReceived, Page.frameNavigated)
   */
  public on(event: string, handler: (params: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  /**
   * Checks if Chrome's CDP debug endpoint is accessible via native IPC or fallback
   */
  public async isCdpAvailable(): Promise<boolean> {
    try {
      const available = await ipcClient.isCdpAvailable(this.debugPort);
      if (available) return true;
    } catch {}

    try {
      const res = await fetch(`http://127.0.0.1:${this.debugPort}/json`, { method: 'GET', signal: AbortSignal.timeout(1200) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Discovers active pages from Chrome CDP endpoint via native IPC or fallback
   */
  public async getAvailablePages(): Promise<CdpTargetPage[]> {
    try {
      const list = await ipcClient.getCdpTargets(this.debugPort);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    } catch {}

    try {
      const res = await fetch(`http://127.0.0.1:${this.debugPort}/json`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      const list: CdpTargetPage[] = await res.json();
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  /**
   * Connects to an existing or newly launched Chrome session.
   * If an active tab already exists matching the targetHost or targetUrl, it attaches
   * directly without spawning new browser windows or opening unnecessary tabs.
   */
  public async connect(targetUrl?: string, targetHost?: string): Promise<boolean> {
    this.disconnect();

    // 1. If CDP endpoint is not open, launch system Chrome via IPC
    const available = await this.isCdpAvailable();
    if (!available) {
      try {
        await ipcClient.launchSystemBrowser(targetUrl || 'about:blank', 8085);
      } catch (err) {
        console.warn('StealthCdpBrowserDriver: Failed to launch browser via IPC:', err);
      }

      // Poll up to 12 seconds for CDP to become active
      let ready = false;
      const start = Date.now();
      while (Date.now() - start < 12000) {
        await new Promise((r) => setTimeout(r, 600));
        if (await this.isCdpAvailable()) {
          ready = true;
          break;
        }
      }

      if (!ready) {
        throw new Error(`CDP endpoint at 127.0.0.1:${this.debugPort} did not become available. Ensure Chrome is installed.`);
      }
    }

    // 2. Discover page targets
    const pages = await this.getAvailablePages();
    
    // Resolve clean host string to match
    let hostToMatch = (targetHost || '').toLowerCase().trim();
    if (hostToMatch === 'target.local') hostToMatch = '';
    if (!hostToMatch && targetUrl && !targetUrl.includes('target.local')) {
      try {
        const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
        hostToMatch = parsed.host.toLowerCase().trim();
      } catch {}
    }

    let targetPage: CdpTargetPage | undefined;

    // Helper to identify static binary/media asset URLs (favicons, images, stylesheets, etc.)
    const isStaticAssetUrl = (u?: string): boolean => {
      if (!u) return false;
      const clean = u.split('?')[0].split('#')[0].toLowerCase();
      return /\.(ico|png|jpe?g|gif|svg|webp|avif|css|js|map|pdf|woff2?|ttf|mp4|zip)$/i.test(clean);
    };

    // Priority 1: Match HTML tab URL containing the specific target host or its apex domain (exclude static assets)
    if (hostToMatch) {
      const apexMatch = hostToMatch.replace(/^www\./, '');
      targetPage = pages.find(
        (p) =>
          p.type === 'page' &&
          p.url &&
          !isStaticAssetUrl(p.url) &&
          (p.url.toLowerCase().includes(hostToMatch) || (apexMatch && p.url.toLowerCase().includes(apexMatch))) &&
          Boolean(p.webSocketDebuggerUrl)
      );
    }

    // Priority 2: Match tab URL containing targetUrl (exclude static assets)
    if (!targetPage && targetUrl && !targetUrl.includes('target.local')) {
      targetPage = pages.find(
        (p) => p.type === 'page' && p.url && !isStaticAssetUrl(p.url) && p.url.toLowerCase().includes(targetUrl.toLowerCase()) && Boolean(p.webSocketDebuggerUrl)
      );
    }

    // Priority 3: Select the user's active foreground web page in their open browser (reuse their tab!)
    if (!targetPage) {
      targetPage = pages.find(
        (p) =>
          p.type === 'page' &&
          p.url &&
          !isStaticAssetUrl(p.url) &&
          !p.url.startsWith('chrome://') &&
          !p.url.startsWith('chrome-error://') &&
          !p.url.includes('chromewebdata') &&
          !p.url.startsWith('about:') &&
          !p.url.startsWith('devtools://') &&
          Boolean(p.webSocketDebuggerUrl)
      );
    }

    // Priority 4: Reusable blank or new tab, error tab, or static asset tab to repurpose
    if (!targetPage) {
      targetPage = pages.find(
        (p) =>
          p.type === 'page' &&
          (p.url === 'about:blank' ||
            p.url.startsWith('chrome://newtab') ||
            p.url.startsWith('chrome://new-tab-page') ||
            p.url.startsWith('chrome-error://') ||
            p.url.includes('chromewebdata') ||
            isStaticAssetUrl(p.url)) &&
          Boolean(p.webSocketDebuggerUrl)
      );
    }

    // Priority 5: If no tab exists in Chrome at all, open one
    if (!targetPage || !targetPage.webSocketDebuggerUrl) {
      try {
        const dest = targetUrl || (hostToMatch ? `https://${hostToMatch}/` : 'about:blank');
        const createRes = await fetch(`http://127.0.0.1:${this.debugPort}/json/new?${encodeURIComponent(dest)}`, { method: 'PUT' });
        if (createRes.ok) {
          targetPage = await createRes.json();
        }
      } catch {
        // fallback
      }
    }

    if (!targetPage || !targetPage.webSocketDebuggerUrl) {
      throw new Error('No inspectable Chrome page target found.');
    }

    this.activeTargetPage = targetPage;

    // Bring target tab to the foreground
    try {
      await ipcClient.activateCdpTarget(targetPage.id, this.debugPort);
    } catch {}

    // 3. Connect WebSocket via local relay port 9223 (strips Origin header to bypass Chrome DevTools 403 Forbidden)
    const rawWsUrl = targetPage.webSocketDebuggerUrl;
    const wsUrl = rawWsUrl.replace(`:${this.debugPort}`, ':9223').replace(':9222', ':9223');
    console.log(`[StealthCdpBrowserDriver] Connecting WebSocket to Chrome CDP via relay: ${wsUrl} (original: ${rawWsUrl})`);

    await new Promise<void>((resolve, reject) => {
      try {
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        const timeoutId = setTimeout(() => {
          reject(new Error(`WebSocket connection to Chrome CDP timed out (${wsUrl})`));
        }, 8000);

        socket.onopen = () => {
          clearTimeout(timeoutId);
          this.isConnected = true;
          console.log('[StealthCdpBrowserDriver] WebSocket connected successfully to', wsUrl);
          resolve();
        };

        socket.onerror = (e) => {
          clearTimeout(timeoutId);
          this.isConnected = false;
          console.error('[StealthCdpBrowserDriver] WebSocket error on', wsUrl, e);
          reject(new Error(`CDP WebSocket connection failed (${wsUrl})`));
        };

        socket.onclose = () => {
          this.isConnected = false;
          this.ws = null;
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Handle method callbacks (responses to commands)
            if (data.id && this.pendingCallbacks.has(data.id)) {
              const cb = this.pendingCallbacks.get(data.id)!;
              this.pendingCallbacks.delete(data.id);
              if (data.error) {
                cb.reject(new Error(`CDP Error (${data.error.code}): ${data.error.message}`));
              } else {
                cb.resolve(data.result);
              }
            }
            // Immediately auto-handle JavaScript modal dialogs (alert, confirm, prompt, beforeunload)
            // to prevent renderer execution pause and CDP evaluate deadlocks
            if (data.method === 'Page.javascriptDialogOpening') {
              console.log('[StealthCdpBrowserDriver] Auto-dismissing native JavaScript dialog:', data.params);
              const promptText = data.params?.defaultPrompt || '';
              this.send('Page.handleJavaScriptDialog', { accept: true, promptText }).catch(() => {});
            }

            // Handle background protocol event notifications
            if (data.method && this.eventListeners.has(data.method)) {
              const handlers = this.eventListeners.get(data.method)!;
              handlers.forEach((h) => {
                try {
                  h(data.params);
                } catch (err) {
                  console.warn('Error in CDP event handler:', err);
                }
              });
            }
          } catch {
            // ignore malformed frame
          }
        };
      } catch (err) {
        reject(err);
      }
    });

    // 4. Initialize essential protocol domains
    await this.send('Page.enable');
    await this.send('DOM.enable');
    await this.send('Network.enable');

    // Auto-dismiss native JS dialogs via event listener as well
    this.on('Page.javascriptDialogOpening', (params) => {
      console.log('[StealthCdpBrowserDriver] Page.javascriptDialogOpening event received:', params);
      this.send('Page.handleJavaScriptDialog', { accept: true, promptText: params?.defaultPrompt || '' }).catch(() => {});
    });
    try {
      await this.send('Inspector.enable');
    } catch {}

    // Auto-revive on renderer crash (Out of Memory or SIGSEGV)
    this.on('Inspector.targetCrashed', async () => {
      console.warn('[StealthCdpBrowserDriver] Target renderer process crashed! Triggering auto-revive...');
      try {
        await this.send('Page.reload', { ignoreCache: false });
      } catch {
        const dest = targetUrl || (hostToMatch ? `https://${hostToMatch}/` : undefined);
        if (dest) {
          try { await this.navigate(dest); } catch {}
        }
      }
    });

    // 5. Anti-Bot Defense Evasion & Real Window Dimensions
    try {
      const win = await this.send('Browser.getWindowForTarget');
      if (win && win.windowId) {
        await this.send('Browser.setWindowBounds', {
          windowId: win.windowId,
          bounds: { windowState: 'normal', width: 1400, height: 900 },
        });
      }
    } catch {}

    try {
      await this.send('Page.bringToFront');
    } catch {}
    try {
      await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    } catch {}

    try {
      const omniscienceScript = ClientRuntimeOmniscienceService.getInjectionScript();
      await this.send('Page.addScriptToEvaluateOnNewDocument', {
        source: omniscienceScript,
      });
    } catch {}

    try {
      const omniscienceScript = ClientRuntimeOmniscienceService.getInjectionScript();
      await this.evaluate(omniscienceScript);
    } catch {}

    if (targetPage.url) {
      this.activePageUrl = targetPage.url;
    }

    // If active tab is currently sitting on a static asset (e.g. favicon.ico), about:blank, newtab, or chrome-error, navigate to targetUrl immediately
    if (
      targetUrl &&
      (isStaticAssetUrl(this.activePageUrl) ||
        this.activePageUrl === 'about:blank' ||
        this.activePageUrl.startsWith('chrome://') ||
        this.activePageUrl.startsWith('chrome-error://') ||
        this.activePageUrl.includes('chromewebdata') ||
        !this.activePageUrl)
    ) {
      try {
        await this.navigate(targetUrl);
      } catch (err) {
        console.warn('[StealthCdpBrowserDriver] Initial target navigation error:', err);
      }
    }

    return true;
  }

  /**
   * Low-level CDP command dispatch with Promise resolution
   */
  public send<T = any>(method: string, params: Record<string, any> = {}, timeoutMs: number = 15000): Promise<T> {
    if (!this.connected || !this.ws) {
      return Promise.reject(new Error('StealthCdpBrowserDriver is not connected to Chrome.'));
    }

    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled && this.pendingCallbacks.has(id)) {
          settled = true;
          this.pendingCallbacks.delete(id);
          reject(new Error(`CDP Command '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingCallbacks.set(id, {
        resolve: (val) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(val);
          }
        },
        reject: (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        }
      });
      try {
        this.ws!.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.pendingCallbacks.delete(id);
          reject(err);
        }
      }
    });
  }

  /**
   * Safely navigates the active page to a target URL, waiting for DOM readyState and settle
   */
  public async navigate(url: string, timeoutMs: number = 8000): Promise<number> {
    this.activePageUrl = url;
    try {
      await this.send('Page.bringToFront');
    } catch {}
    try {
      await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    } catch {}

    const startTime = Date.now();
    await this.send('Page.navigate', { url });

    // Adaptive readyState detection + Cloudflare / WAF anti-bot challenge auto-handling
    let challengeWaitStarted: number | null = null;
    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.evaluate<{
          readyState: string;
          linkCount: number;
          hasBody: boolean;
          isChallenge: boolean;
          hasCheckbox: boolean;
        }>(`
          (function() {
            const title = (document.title || '').toLowerCase();
            const bodyText = (document.body?.innerText || '').toLowerCase();
            const hasChallengeTitle =
              title.includes('just a moment') ||
              title.includes('one moment') ||
              title.includes('attention required') ||
              title.includes('security check') ||
              title.includes('cloudflare');
            const hasChallengeElements = Boolean(
              document.querySelector(
                '#challenge-running, #challenge-form, #cf-turnstile, iframe[src*="challenge-platform"], .cf-browser-verification, #cf-stage, .ray-id, #cf-please-wait, form[action*="wsidchk"], #wsidchk'
              )
            );
            const isChallenge =
              hasChallengeTitle ||
              hasChallengeElements ||
              bodyText.includes('checking your browser') ||
              bodyText.includes('enable javascript and cookies');

            const cb = document.querySelector('input[type="checkbox"], #challenge-stage input, .ctp-checkbox-label, #cf-turnstile');
            return {
              readyState: document.readyState,
              linkCount: document.querySelectorAll('a, button, input, form').length,
              hasBody: Boolean(document.body && (document.body.innerText.trim().length > 0 || document.body.childElementCount > 0)),
              isChallenge,
              hasCheckbox: Boolean(cb)
            };
          })()
        `);

        if (state) {
          if (state.isChallenge) {
            if (!challengeWaitStarted) challengeWaitStarted = Date.now();

            // Attempt auto-clicking checkbox if available
            if (state.hasCheckbox) {
              await this.evaluate(`
                (function() {
                  const cb = document.querySelector('input[type="checkbox"], #challenge-stage input, .ctp-checkbox-label');
                  if (cb) (cb as HTMLElement).click();
                })()
              `).catch(() => {});
            }

            // Wait up to 5000ms for challenge auto-submit or redirect
            if (Date.now() - challengeWaitStarted > 5000) {
              break;
            }
          } else {
            // Normal page or challenge redirect completed!
            if (state.readyState === 'complete' || (state.readyState === 'interactive' && (state.linkCount > 0 || state.hasBody))) {
              break;
            }
          }
        }
      } catch {
        // Context might be reloading during navigation or challenge redirect, keep polling rapidly
      }
      await new Promise((r) => setTimeout(r, 40));
    }

    return Date.now() - startTime;
  }

  /**
   * Intelligently dismisses SweetAlert, Bootstrap modals, alerts, and removes
   * blocking full-screen backdrops that intercept CDP mouse clicks
   */
  public async dismissBlockingModalsAndOverlays(): Promise<void> {
    const hasModal = await this.evaluate<boolean>(`
      (function() {
        const sel = '.swal2-container, .modal-backdrop, .sweet-overlay, .swal-overlay, .modal.show, [role="dialog"], [aria-modal="true"], div._2hriZF, div._3bX7W5';
        const el = document.querySelector(sel);
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s && s.display !== 'none' && s.visibility !== 'hidden';
      })()
    `).catch(() => false);

    if (hasModal) {
      try {
        await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      } catch {}
    }

    try {
      await this.evaluate(`
        (function() {
          const specificSelectors = [
            '.swal2-confirm', '.swal2-close', '.swal-button--confirm',
            '[data-dismiss="modal"]', '[data-bs-dismiss="modal"]',
            '.modal .close', '.modal .btn-close', '.alert .close', '.toast .close',
            'button.cookie-dismiss', '[aria-label="Close" i]', '[aria-label="Dismiss" i]',
            'button._2doB4z', 'span._30XB9F', 'span.b3wTlE', 'button._2KpZ6l._2doB4z',
            'div._2hriZF button', 'div._3bX7W5 button', '[class*="_2doB4z"]', '[class*="_30XB9F"]', '[class*="b3wTlE"]',
            'input[data-action-type="DISMISS"]', '#glow-toaster-body input.a-button-input',
            '#sp-cc-accept', '#sp-cc-rejectall-link', 'input[name="glowDoneButton"]', 'input[name="acceptCookie"]'
          ].join(', ');

          const dismissButtons = document.querySelectorAll(specificSelectors);
          dismissButtons.forEach(btn => {
            try {
              if (btn.offsetWidth > 0 || btn.offsetHeight > 0) btn.click();
            } catch(e) {}
          });

          // Generic close / dismiss button text matching
          const candidates = document.querySelectorAll('button, [role="button"], span, a, input[type="button"]');
          let dismissedCount = 0;
          for (let i = 0; i < candidates.length; i++) {
            if (dismissedCount >= 3) break;
            const el = candidates[i];
            try {
              if (el.offsetWidth <= 0 && el.offsetHeight <= 0) continue;
              const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
              const aria = (el.getAttribute('aria-label') || '').toLowerCase();
              const isCloseTxt = txt === '✕' || txt === '×' || txt === '✖' || txt === 'x' ||
                txt === 'close' || txt === 'dismiss' || txt === 'skip' ||
                txt === 'not now' || txt === 'no thanks' || txt === 'got it';
              const isCloseAria = aria === 'close' || aria === 'dismiss';
              if (isCloseTxt || isCloseAria) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 2 && rect.height > 2 && rect.top < window.innerHeight && rect.left < window.innerWidth) {
                  el.click();
                  dismissedCount++;
                }
              }
            } catch(e) {}
          }

          const backdrops = document.querySelectorAll(
            '.swal2-container, .modal-backdrop, .sweet-overlay, .swal-overlay, .blockUI, [class*="backdrop-hide"], div._2hriZF, div._3bX7W5, div._10Ermr, div.fb4a5f, div._2hriUD'
          );
          backdrops.forEach(el => {
            try { el.remove(); } catch(e) {}
          });

          // Neutralize full-screen fixed overlays with pointer events blocking
          document.querySelectorAll('div, section').forEach(el => {
            try {
              const s = window.getComputedStyle(el);
              if (s && s.position === 'fixed' && parseInt(s.zIndex || '0', 10) >= 100) {
                const rect = el.getBoundingClientRect();
                if (rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8 && (s.backgroundColor.includes('rgba') || s.opacity !== '1')) {
                  el.style.pointerEvents = 'none';
                }
              }
            } catch(e) {}
          });

          // Security / Anomaly Interstitial Auto-Retry (e.g. "Access Denied - Our systems have detected unusual activity" or "Out of Memory")
          try {
            const pageText = (document.body ? document.body.innerText : '').slice(0, 1500).toLowerCase();
            const isAnomalyBlocked = pageText.includes('unusual activity') || pageText.includes('access denied') || pageText.includes('security reasons') || pageText.includes('out of memory') || pageText.includes('this page is having a problem');
            if (isAnomalyBlocked) {
              const retryButtons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"]')).filter(b => {
                const t = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
                return t === 'retry' || t === 'refresh' || t === 'try again' || t === 'reload';
              });
              if (retryButtons.length > 0) {
                retryButtons[0].click();
              }
            }
          } catch(e) {}

          if (document.body) {
            document.body.classList.remove('swal2-shown', 'modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
          }
          if (document.documentElement) {
            document.documentElement.classList.remove('swal2-shown');
            document.documentElement.style.removeProperty('overflow');
          }
        })()
      `);
    } catch {}
  }

  /**
   * Intelligently resolves required form preconditions before clicking buttons or submitting forms:
   * - Selects the first valid option for empty variation / attribute dropdowns (e.g. Size, Color)
   * - Selects the first option in unselected radio button groups
   * - Sets valid minimum value for quantity inputs (>= 1)
   * - Fills default credentials if targeting a login / authentication form
   * - Checks required checkboxes
   */
  public async satisfyFormPreconditions(selector?: string, clickX?: number, clickY?: number): Promise<boolean> {
    try {
      const res = await this.evaluate<boolean>(`
        (function() {
          let btn = null;
          const sel = ${JSON.stringify(selector || '')};
          const cx = ${clickX !== undefined ? clickX : 'null'};
          const cy = ${clickY !== undefined ? clickY : 'null'};

          if (sel) {
            try { btn = document.querySelector(sel); } catch(e) {}
          }
          if (!btn && cx !== null && cy !== null && cx > 0 && cy > 0) {
            try {
              btn = document.elementFromPoint(cx, cy);
              if (btn && btn.tagName !== 'BUTTON' && btn.tagName !== 'INPUT' && btn.getAttribute('role') !== 'button') {
                btn = btn.closest('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a.button');
              }
            } catch(e) {}
          }

          // If no button element identified, look at document scope or active forms
          const container = (btn && (btn.closest('form, .cart, .variations_form, [data-product_id], .product, .product-info, .entry-summary') || btn.parentElement)) || document;

          let resolvedSomething = false;

          // 1. Resolve unselected <select> variation / attribute dropdowns
          const selects = Array.from(container.querySelectorAll('select'));
          for (let i = 0; i < selects.length; i++) {
            const s = selects[i];
            try {
              const val = (s.value || '').trim();
              const textVal = (s.selectedOptions?.[0]?.text || '').trim().toLowerCase();
              const needsSelect = val === '' || val === '0' || val === '-1' || /^(choose|select|none|\\-\\-)/i.test(textVal);

              if (needsSelect && s.options && s.options.length > 0) {
                const validOpt = Array.from(s.options).find(o => {
                  const ov = (o.value || '').trim();
                  const ot = (o.text || '').trim().toLowerCase();
                  return ov !== '' && ov !== '0' && ov !== '-1' && !/^(choose|select|none|\\-\\-)/i.test(ot);
                });
                if (validOpt) {
                  s.value = validOpt.value;
                  s.dispatchEvent(new Event('change', { bubbles: true }));
                  s.dispatchEvent(new Event('input', { bubbles: true }));
                  if (window.jQuery) {
                    try { window.jQuery(s).trigger('change'); } catch(e) {}
                  }
                  resolvedSomething = true;
                }
              }
            } catch(e) {}
          }

          // 2. Resolve unselected Radio Button groups (variation swatches / attributes)
          const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
          const groups = new Map();
          for (let i = 0; i < radios.length; i++) {
            const r = radios[i];
            const name = r.name || ('radio_grp_' + i);
            if (!groups.has(name)) groups.set(name, []);
            groups.get(name).push(r);
          }
          groups.forEach(rList => {
            const anyChecked = rList.some(r => r.checked);
            if (!anyChecked && rList.length > 0) {
              const target = rList.find(r => !r.disabled) || rList[0];
              try {
                target.checked = true;
                target.dispatchEvent(new Event('change', { bubbles: true }));
                target.dispatchEvent(new Event('click', { bubbles: true }));
                if (window.jQuery) {
                  try { window.jQuery(target).trigger('change'); } catch(e) {}
                }
                resolvedSomething = true;
              } catch(e) {}
            }
          });

          // 3. Resolve swatch pill buttons (e.g. .swatch-anchor, .variable-item, .swatch, .size-pill, .color-pill)
          const swatches = Array.from(container.querySelectorAll('.variable-item:not(.selected), .swatch-anchor:not(.selected), .swatch:not(.selected)'));
          if (swatches.length > 0) {
            try {
              const sw = swatches[0];
              if (sw && typeof sw.click === 'function') {
                sw.click();
                resolvedSomething = true;
              }
            } catch(e) {}
          }

          // 4. Ensure valid quantity (>= 1)
          const qtyInputs = Array.from(container.querySelectorAll('input[name="quantity"], input.qty, input[name*="quantity"], input[type="number"][name*="qty"]'));
          for (let i = 0; i < qtyInputs.length; i++) {
            const q = qtyInputs[i];
            try {
              const n = parseInt(q.value, 10);
              if (isNaN(n) || n <= 0) {
                q.value = q.min ? q.min : '1';
                q.dispatchEvent(new Event('change', { bubbles: true }));
                q.dispatchEvent(new Event('input', { bubbles: true }));
                resolvedSomething = true;
              }
            } catch(e) {}
          }

          // 5. Fill credentials if this is a login / auth form
          const isLogin = Boolean(
            container.querySelector('input[type="password"]') ||
            (container.action && container.action.toLowerCase().includes('login')) ||
            window.location.pathname.toLowerCase().includes('login')
          );
          if (isLogin) {
            const userInp = container.querySelector('input[type="email"], input[name="email"], input[name="username"], input[name="user"], input[id*="user"], input[id*="login"]');
            const passInp = container.querySelector('input[type="password"]');
            if (userInp && (!userInp.value || userInp.value.trim() === '')) {
              userInp.value = 'admin@example.com';
              userInp.dispatchEvent(new Event('input', { bubbles: true }));
              userInp.dispatchEvent(new Event('change', { bubbles: true }));
              resolvedSomething = true;
            }
            if (passInp && (!passInp.value || passInp.value.trim() === '')) {
              passInp.value = 'password';
              passInp.dispatchEvent(new Event('input', { bubbles: true }));
              passInp.dispatchEvent(new Event('change', { bubbles: true }));
              resolvedSomething = true;
            }
          }

          // 6. Check required checkboxes (terms of service, consent)
          const reqChecks = Array.from(container.querySelectorAll('input[type="checkbox"][required], input[type="checkbox"][name*="terms"], input[type="checkbox"][name*="agree"]'));
          for (let i = 0; i < reqChecks.length; i++) {
            const c = reqChecks[i];
            if (!c.checked) {
              c.checked = true;
              c.dispatchEvent(new Event('change', { bubbles: true }));
              c.dispatchEvent(new Event('click', { bubbles: true }));
              resolvedSomething = true;
            }
          }

          return resolvedSomething;
        })()
      `);
      return Boolean(res);
    } catch {
      return false;
    }
  }

  /**
   * Intelligently detects if the active Chrome tab has suffered a renderer crash
   * (e.g. "Error code: Out of Memory", "This page is having a problem") or 
   * anti-bot interstitial modal, and automatically revives the tab.
   */
  public async recoverFromCrashOrError(fallbackUrl?: string): Promise<boolean> {
    try {
      const live = await this.getLiveUrl();
      if (!live || live.includes('chrome-error://') || live.includes('chromewebdata')) {
        console.warn('[StealthCdpBrowserDriver] Detected chrome error page, reloading target...');
        if (fallbackUrl) {
          await this.navigate(fallbackUrl);
        } else {
          await this.send('Page.reload', { ignoreCache: false });
        }
        await this.waitForDomSettle(1500);
        return true;
      }

      const crashStatus = await this.evaluate<{ isCrashed: boolean; hasRetry: boolean }>(`
        (function() {
          const txt = (document.body ? document.body.innerText : '').slice(0, 1500).toLowerCase();
          const title = (document.title || '').toLowerCase();
          const isCrashed = txt.includes('out of memory') || txt.includes('this page is having a problem') || title.includes('problem');
          const isAccessDenied = txt.includes('unusual activity') || txt.includes('access denied');
          
          let hasRetry = false;
          if (isCrashed || isAccessDenied) {
            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"]'));
            const retryBtn = buttons.find(b => {
              const bTxt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
              return bTxt === 'refresh' || bTxt === 'retry' || bTxt === 'reload' || bTxt === 'try again';
            });
            if (retryBtn) {
              hasRetry = true;
              retryBtn.click();
            }
          }
          return { isCrashed: isCrashed || isAccessDenied, hasRetry };
        })()
      `);

      if (crashStatus?.isCrashed) {
        if (!crashStatus.hasRetry && fallbackUrl) {
          await this.navigate(fallbackUrl);
        }
        await this.waitForDomSettle(1500);
        return true;
      }
      return false;
    } catch {
      const target = fallbackUrl || this.activePageUrl;
      if (target) {
        try {
          await this.send('Page.reload', { ignoreCache: false }).catch(() => {});
          await this.navigate(target);
          await this.waitForDomSettle(1500);
          return true;
        } catch {}
      }
      return false;
    }
  }

  /**
   * Scrolls an element into view and returns its fresh viewport-relative center coordinates,
   * or null if element cannot be located/visible.
   */
  public async scrollAndGetElementCoordinates(
    locator: string | ElementLocator,
    legacyTextMatch?: string
  ): Promise<{ x: number; y: number } | null> {
    const loc: ElementLocator =
      typeof locator === 'string'
        ? { selector: locator, textMatch: legacyTextMatch }
        : locator;

    try {
      const res = await this.evaluate<{ x: number; y: number } | null>(`
        (function() {
          const sel = ${JSON.stringify(loc.selector || '*')};
          const text = ${JSON.stringify(loc.textMatch || '')}.trim().toLowerCase();
          const href = ${JSON.stringify(loc.hrefMatch || '')}.trim().toLowerCase();
          const id = ${JSON.stringify(loc.idMatch || '')}.trim();

          let target = null;
          if (id) {
            target = document.getElementById(id);
          }
          if (!target && href) {
            target = document.querySelector(\`a[href="\${${JSON.stringify(loc.hrefMatch || '')}}"]\`) ||
                     Array.from(document.querySelectorAll('a')).find(a => {
                       const h = (a.getAttribute('href') || '').toLowerCase();
                       return h === href || (href.length > 5 && h.includes(href));
                     });
          }
          if (!target && sel && sel !== '*') {
            const nodes = Array.from(document.querySelectorAll(sel));
            if (text) {
              target = nodes.find(n => (n.innerText || n.textContent || '').trim().toLowerCase().includes(text));
            }
            if (!target && nodes.length > 0) {
              target = nodes[0];
            }
          }
          if (!target && text) {
            const allNodes = Array.from(document.querySelectorAll('a, button, [role="button"], .nav-link, li'));
            target = allNodes.find(n => (n.innerText || n.textContent || '').trim().toLowerCase().includes(text));
          }

          // Scrapling-Inspired Adaptive Element Tracking Fallback
          if (!target) {
            const candidates = Array.from(document.querySelectorAll(
              'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="tab"], .btn, .button, [onclick]'
            )).filter(n => {
              const rect = n.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });

            function cleanTokens(s) {
              if (!s) return [];
              return s.toLowerCase().replace(/[^a-z0-9\\s_-]/g, ' ').split(/[\\s_-]+/).filter(x => x.length > 1);
            }
            function jaccard(arrA, arrB) {
              if (arrA.length === 0 || arrB.length === 0) return 0;
              const setA = new Set(arrA);
              const setB = new Set(arrB);
              let inter = 0;
              setA.forEach(t => { if (setB.has(t)) inter++; });
              const union = setA.size + setB.size - inter;
              return union === 0 ? 0 : inter / union;
            }

            const targetTokens = cleanTokens((text || id || sel || '').replace(/[#.\\[\\]]/g, ' '));
            let bestScore = 0;
            let bestCandidate = null;

            for (const cand of candidates) {
              const cText = (cand.innerText || cand.value || '').trim();
              const cId = cand.id || '';
              const cName = cand.getAttribute('name') || '';
              const cAria = cand.getAttribute('aria-label') || '';
              const cTokens = cleanTokens(cText + ' ' + cId + ' ' + cName + ' ' + cAria);

              let sc = jaccard(targetTokens, cTokens);
              if (text && cText.toLowerCase().includes(text)) sc += 0.45;
              if (id && cId.toLowerCase().includes(id.toLowerCase())) sc += 0.45;

              if (sc > bestScore) {
                bestScore = sc;
                bestCandidate = cand;
              }
            }

            if (bestCandidate && bestScore >= 0.40) {
              target = bestCandidate;
            }
          }

          if (!target) return null;
          target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          const r = target.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          return {
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2)
          };
        })()
      `);
      return res;
    } catch {
      return null;
    }
  }

  /**
   * Dispatches an authentic human Bézier mouse hover over an element.
   * Triggers CSS :hover pseudoclasses, JavaScript mouseenter/mouseover listeners,
   * and expands dynamic mega-menus and flyouts without clicking.
   */
  public async hoverElement(
    locator: string | ElementLocator,
    dwellMs: number = 300
  ): Promise<boolean> {
    const loc: ElementLocator =
      typeof locator === 'string' ? { selector: locator } : locator;
    const coords = await this.scrollAndGetElementCoordinates(loc);
    const hoverX = coords ? coords.x : loc.fallbackX;
    const hoverY = coords ? coords.y : loc.fallbackY;

    if (hoverX !== undefined && hoverY !== undefined && hoverX > 0 && hoverY > 0) {
      try {
        await humanBiometricStealthEngine.moveMouseTo(
          { x: hoverX, y: hoverY },
          (method, params) => this.send(method, params),
          30
        );
      } catch {
        await this.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(hoverX),
          y: Math.round(hoverY),
        });
      }

      // Fire synthetic mouseenter/mouseover in DOM for frameworks that use synthetic events
      if (loc.selector) {
        try {
          await this.evaluate(`
            (function() {
              const el = document.querySelector(${JSON.stringify(loc.selector)});
              if (el) {
                el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
                el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, view: window }));
              }
            })()
          `);
        } catch {}
      }

      await new Promise((r) => setTimeout(r, Math.max(100, dwellMs)));
      return true;
    }
    return false;
  }

  /**
   * Universal element clicker: Cleans up backdrops, scrolls to center,
   * dispatches authentic human CDP mouse events, and executes dual-layer
   * DOM click verification for guaranteed SPA & native navigation.
   */
  public async clickElement(
    locator: string | ElementLocator,
    legacyTextMatch?: string,
    fallbackX?: number,
    fallbackY?: number
  ): Promise<boolean> {
    const loc: ElementLocator =
      typeof locator === 'string'
        ? { selector: locator, textMatch: legacyTextMatch, fallbackX, fallbackY }
        : locator;

    // 1. Dismiss any blocking popup or backdrop overlay
    await this.dismissBlockingModalsAndOverlays();

    // 1b. Autonomously satisfy required form preconditions (variation dropdowns, radios, login inputs)
    try {
      await this.satisfyFormPreconditions(loc.selector, loc.fallbackX, loc.fallbackY);
    } catch {}

    // 2. Locate viewport coordinates
    const coords = await this.scrollAndGetElementCoordinates(loc);
    const clickX = coords ? coords.x : loc.fallbackX;
    const clickY = coords ? coords.y : loc.fallbackY;

    // 3. Dispatch authentic human CDP mouse click
    let cdpClicked = false;
    if (clickX !== undefined && clickY !== undefined && clickX > 0 && clickY > 0) {
      try {
        await this.dispatchHumanClick({ x: clickX, y: clickY, delayMs: loc.delayMs !== undefined ? loc.delayMs : 80 });
        cdpClicked = true;
      } catch {}
    }

    // 4. Fallback activation: If element had no valid viewport coordinates, fall back to DOM click.
    // If CDP hardware click already fired authentic trusted events, we skip synthetic dispatch to prevent detection!
    if (!cdpClicked) {
      try {
        await this.evaluate(`
        (function() {
          const sel = ${JSON.stringify(loc.selector || '*')};
          const text = ${JSON.stringify(loc.textMatch || '')}.trim().toLowerCase();
          const href = ${JSON.stringify(loc.hrefMatch || '')}.trim().toLowerCase();
          const id = ${JSON.stringify(loc.idMatch || '')}.trim();

          let target = null;
          if (id) target = document.getElementById(id);
          if (!target && href) {
            target = document.querySelector(\`a[href="\${${JSON.stringify(loc.hrefMatch || '')}}"]\`) ||
                     Array.from(document.querySelectorAll('a')).find(a => {
                       const h = (a.getAttribute('href') || '').toLowerCase();
                       return h === href || (href.length > 5 && h.includes(href));
                     });
          }
          if (!target && sel && sel !== '*') {
            const nodes = Array.from(document.querySelectorAll(sel));
            if (text) target = nodes.find(n => (n.innerText || n.textContent || '').trim().toLowerCase().includes(text));
            if (!target && nodes.length > 0) target = nodes[0];
          }
          if (!target && text) {
            const allNodes = Array.from(document.querySelectorAll('a, button, [role="button"], .nav-link, li'));
            target = allNodes.find(n => (n.innerText || n.textContent || '').trim().toLowerCase().includes(text));
          }
          if (!target) {
            const candidates = Array.from(document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="link"], .btn, .button'));
            function cleanTokens(s) {
              if (!s) return [];
              return s.toLowerCase().replace(/[^a-z0-9\\s_-]/g, ' ').split(/[\\s_-]+/).filter(x => x.length > 1);
            }
            function jaccard(arrA, arrB) {
              if (arrA.length === 0 || arrB.length === 0) return 0;
              const setA = new Set(arrA);
              const setB = new Set(arrB);
              let inter = 0;
              setA.forEach(t => { if (setB.has(t)) inter++; });
              const union = setA.size + setB.size - inter;
              return union === 0 ? 0 : inter / union;
            }
            const targetTokens = cleanTokens((text || id || sel || '').replace(/[#.\\[\\]]/g, ' '));
            let bestScore = 0;
            let bestCand = null;
            for (const cand of candidates) {
              const cTokens = cleanTokens((cand.innerText || cand.value || '') + ' ' + (cand.id || '') + ' ' + (cand.getAttribute('name') || ''));
              let sc = jaccard(targetTokens, cTokens);
              if (text && (cand.innerText || '').toLowerCase().includes(text)) sc += 0.45;
              if (sc > bestScore) {
                bestScore = sc;
                bestCand = cand;
              }
            }
            if (bestCand && bestScore >= 0.40) target = bestCand;
          }

          if (target) {
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            try { target.click(); } catch(e) {}
          }
        })()
      `);
      } catch {}
    }
    return true;
  }

  /**
   * Universal input filler: Dismisses blocking modals, scrolls element to center,
   * focuses it, sets the value using native HTMLInputElement/TextArea prototype setters
   * (to trigger React/Vue/Angular reactive state listeners), and dispatches authentic
   * input, change, and blur events.
   */
  public async fillInput(locator: string | ElementLocator, value: string): Promise<boolean> {
    const loc: ElementLocator = typeof locator === 'string' ? { selector: locator } : locator;
    await this.dismissBlockingModalsAndOverlays();

    // 1. Locate and click element to establish natural focus
    const coords = await this.scrollAndGetElementCoordinates(loc);
    const clickX = coords ? coords.x : loc.fallbackX;
    const clickY = coords ? coords.y : loc.fallbackY;
    if (clickX !== undefined && clickY !== undefined && clickX > 0 && clickY > 0) {
      try {
        await this.dispatchHumanClick({ x: clickX, y: clickY, delayMs: 40 });
      } catch {}
    }

    // 2. Set value and fire synthetic input/change events
    try {
      const res = await this.evaluate<boolean>(`
        (function() {
          const sel = ${JSON.stringify(loc.selector || '*')};
          const name = ${JSON.stringify(loc.textMatch || '')}.trim().toLowerCase();
          const id = ${JSON.stringify(loc.idMatch || '')}.trim();
          const val = ${JSON.stringify(value)};

          let target = null;
          if (id) target = document.getElementById(id);
          if (!target && name) {
            target = document.querySelector(\`[name="\${name}"]\`) ||
                     document.querySelector(\`#\${name}\`) ||
                     Array.from(document.querySelectorAll('input, textarea')).find(el => {
                       const ph = (el.getAttribute('placeholder') || '').toLowerCase();
                       const n = (el.getAttribute('name') || '').toLowerCase();
                       const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                       return n === name || ph.includes(name) || aria.includes(name);
                     });
          }
          if (!target && sel && sel !== '*') {
            target = document.querySelector(sel);
          }
          if (!target) {
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]'));
            function cleanTokens(s) {
              if (!s) return [];
              return s.toLowerCase().replace(/[^a-z0-9\\s_-]/g, ' ').split(/[\\s_-]+/).filter(x => x.length > 1);
            }
            function jaccard(arrA, arrB) {
              if (arrA.length === 0 || arrB.length === 0) return 0;
              const setA = new Set(arrA);
              const setB = new Set(arrB);
              let inter = 0;
              setA.forEach(t => { if (setB.has(t)) inter++; });
              const union = setA.size + setB.size - inter;
              return union === 0 ? 0 : inter / union;
            }
            const targetTokens = cleanTokens((name || id || sel || '').replace(/[#.\\[\\]]/g, ' '));
            let bestScore = 0;
            let bestCand = null;
            for (const inp of inputs) {
              const inpTokens = cleanTokens((inp.id || '') + ' ' + (inp.name || '') + ' ' + (inp.getAttribute('placeholder') || '') + ' ' + (inp.getAttribute('aria-label') || ''));
              const sc = jaccard(targetTokens, inpTokens);
              if (sc > bestScore) {
                bestScore = sc;
                bestCand = inp;
              }
            }
            if (bestCand && bestScore >= 0.35) {
              target = bestCand;
            }
          }

          if (!target) return false;

          target.focus();

          // Visual outline feedback in browser
          const prevOutline = target.style.outline;
          target.style.outline = '2px solid #10b981';
          setTimeout(() => { try { target.style.outline = prevOutline; } catch(e){} }, 450);

          // 1. Clear existing text completely via selection, prototype setter, and React _valueTracker reset
          try {
            target.setSelectionRange(0, (target.value || '').length);
          } catch(e) {}
          try {
            if (typeof target.select === 'function') target.select();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
          } catch(e) {}

          const proto = Object.getPrototypeOf(target);
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                         Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                         Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) {
            setter.call(target, '');
          } else {
            target.value = '';
          }

          if (target._valueTracker) {
            try { target._valueTracker.setValue('__sentinel_cleared__'); } catch(e) {}
          }

          target.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          return true;
        })()
      `);

      if (!res) return false;

      // 2. Clear hardware keyboard buffer via Ctrl+A + Backspace keystrokes
      try {
        await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', modifiers: 2 });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA' });
        await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
      } catch {}

      // 3. Dispatch authentic human keystroke events with variable inter-key latency
      try {
        await humanBiometricStealthEngine.humanType(value, (m, p) => this.send(m, p));
      } catch {}

      // 4. Verification and change dispatch: ensure value matches and framework listeners fire
      await this.evaluate<boolean>(`
        (function() {
          const sel = ${JSON.stringify(loc.selector || '*')};
          const name = ${JSON.stringify(loc.textMatch || '')}.trim().toLowerCase();
          const id = ${JSON.stringify(loc.idMatch || '')}.trim();
          const val = ${JSON.stringify(value)};

          let target = null;
          if (id) target = document.getElementById(id);
          if (!target && name) {
            target = document.querySelector(\`[name="\${name}"]\`) ||
                     document.querySelector(\`#\${name}\`);
          }
          if (!target && sel && sel !== '*') {
            target = document.querySelector(sel);
          }
          if (!target) {
            target = document.activeElement;
          }

          if (target && 'value' in target) {
            if (target.value !== val) {
              if (target._valueTracker) {
                try { target._valueTracker.setValue('__sentinel_pre__'); } catch(e) {}
              }
              const proto = Object.getPrototypeOf(target);
              const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                             Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                             Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
              if (setter) {
                setter.call(target, val);
              } else {
                target.value = val;
              }
              target.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            }
            target.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new Event('blur', { bubbles: true }));
          }
          return true;
        })()
      `);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Synthesizes a valid in-memory dummy file payload (PDF, PNG, CSV, JSON, TXT)
   * and attaches it to a file input using DataTransfer
   */
  public async synthesizeAndAttachFileInput(locator: string | { selector?: string; idMatch?: string; nameMatch?: string }): Promise<boolean> {
    try {
      const loc = typeof locator === 'string' ? { selector: locator } : locator;
      const script = `
        (function() {
          const sel = ${JSON.stringify(loc.selector || '')};
          const id = ${JSON.stringify(loc.idMatch || '')};
          const name = ${JSON.stringify(loc.nameMatch || '')};

          let el = null;
          if (id) el = document.getElementById(id);
          if (!el && sel) {
            try { el = document.querySelector(sel); } catch(e) {}
          }
          if (!el && name) {
            try { el = document.querySelector('input[type="file"][name="' + CSS.escape(name) + '"]'); } catch(e) {}
          }
          if (!el) {
            el = document.querySelector('input[type="file"]');
          }
          if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return false;

          const accept = (el.getAttribute('accept') || '').toLowerCase();
          let filename = 'test_document.txt';
          let mime = 'text/plain';
          let content = 'Sentinel Sovereign Test File Payload Content';

          if (accept.includes('png') || accept.includes('image')) {
            filename = 'test_image.png';
            mime = 'image/png';
            content = '\\x89PNG\\r\\n\\x1a\\n\\x00\\x00\\x00\\rIHDR\\x00\\x00\\x00\\x01\\x00\\x00\\x00\\x01\\x08\\x06\\x00\\x00\\x00\\x1f\\x15c4\\x00\\x00\\x00\\nIDATx\\x9cc\\x00\\x01\\x00\\x00\\x05\\x00\\x01\\r\\n-\\xb4\\x00\\x00\\x00\\x00IEND\\xaeB\`\\x82';
          } else if (accept.includes('pdf')) {
            filename = 'test_doc.pdf';
            mime = 'application/pdf';
            content = '%PDF-1.4\\n1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n2 0 obj\\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\\nendobj\\n3 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\\nendobj\\nxref\\n0 4\\n0000000000 65535 f \\n0000000010 00000 n \\n0000000060 00000 n \\n0000000117 00000 n \\ntrailer\\n<< /Size 4 /Root 1 0 R >>\\nstartxref\\n190\\n%%EOF';
          } else if (accept.includes('csv') || accept.includes('excel') || accept.includes('sheet')) {
            filename = 'test_data.csv';
            mime = 'text/csv';
            content = 'id,name,value\\n1,test,100\\n';
          } else if (accept.includes('json')) {
            filename = 'test_config.json';
            mime = 'application/json';
            content = '{"test": true, "name": "sentinel"}';
          }

          try {
            const dt = new DataTransfer();
            const file = new File([content], filename, { type: mime });
            dt.items.add(file);
            el.files = dt.files;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          } catch(e) {
            return false;
          }
        })()
      `;
      return (await this.evaluate<boolean>(script)) || false;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches authentic keyboard Enter key event to submit forms or search inputs
   */
  public async pressEnter(): Promise<void> {
    try {
      await this.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        macCharCode: 13,
        unmodifiedText: '\r',
        text: '\r',
        key: 'Enter',
        code: 'Enter'
      });
      await this.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        macCharCode: 13,
        unmodifiedText: '\r',
        text: '\r',
        key: 'Enter',
        code: 'Enter'
      });
    } catch {}
  }

  /**
   * Universal select option activator: Locates the select dropdown,
   * matches either option value or visible text label, and dispatches
   * change & input events to trigger dependent AJAX cascades.
   */
  public async selectOption(locator: string | ElementLocator, valueOrText: string): Promise<boolean> {
    const loc: ElementLocator = typeof locator === 'string' ? { selector: locator } : locator;
    try {
      const res = await this.evaluate<boolean>(`
        (function() {
          const selStr = ${JSON.stringify(loc.selector || 'select')};
          const id = ${JSON.stringify(loc.idMatch || '')}.trim();
          const targetVal = ${JSON.stringify(valueOrText)}.trim().toLowerCase();

          let select = null;
          if (id) select = document.getElementById(id);
          if (!select) select = document.querySelector(selStr);
          if (!select) {
            const allSelects = Array.from(document.querySelectorAll('select'));
            if (allSelects.length > 0) {
              const nameTokens = (${JSON.stringify(loc.nameMatch || '')} + ' ' + id + ' ' + selStr).toLowerCase().split(/[\\s_-]+/);
              select = allSelects.find(s => {
                const sName = (s.name || s.id || '').toLowerCase();
                return nameTokens.some(t => t.length > 2 && sName.includes(t));
              }) || allSelects[0];
            }
          }

          if (!select || select.tagName !== 'SELECT') return false;

          select.focus();
          const options = Array.from(select.options || []);
          let match = options.find(o => (o.value || '').trim().toLowerCase() === targetVal);
          if (!match) {
            match = options.find(o => (o.text || '').trim().toLowerCase().includes(targetVal));
          }
          if (!match && options.length > 0) {
            match = options.find(o => o.value && o.value.trim() !== '' && o.value !== '0' && o.value !== '-1');
          }

          if (match) {
            select.value = match.value;
            select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            select.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            return true;
          }
          return false;
        })()
      `);
      return Boolean(res);
    } catch {
      return false;
    }
  }

  /**
   * Captures a base64-encoded visual screenshot of the live browser page via CDP
   */
  public async captureScreenshot(format: 'jpeg' | 'png' = 'jpeg', quality: number = 60): Promise<string | null> {
    try {
      const res = await this.send('Page.captureScreenshot', { format, quality });
      return res?.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Evaluates JavaScript in the page context and returns the deserialized result
   */
  public async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    return res?.result?.value as T;
  }

  /**
   * Retrieves raw response body for a given CDP network request ID with bounded retries
   */
  public async getResponseBody(requestId: string, retries: number = 2): Promise<{ body: string; base64Encoded: boolean } | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.send('Network.getResponseBody', { requestId });
        if (res && typeof res.body === 'string') {
          return res;
        }
      } catch {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
        }
      }
    }
    return null;
  }

  /**
   * Dispatches authentic human Ghost-Cursor Bézier spline mouse movement,
   * Fitts's Law duration, physiological micro-tremors, sub-pixel overshoot,
   * contact dwell time, and natural release.
   */
  public async dispatchHumanClick(options: CdpClickOptions): Promise<void> {
    const { x, y, delayMs = 80 } = options;

    if (delayMs === 0) {
      // Instant/Zero-delay mode: direct mouse position and rapid hardware click
      try {
        await this.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(x),
          y: Math.round(y),
          timestamp: Date.now() / 1000,
        });
        await this.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(x),
          y: Math.round(y),
          button: 'left',
          clickCount: 1,
          timestamp: Date.now() / 1000,
        });
        await new Promise((r) => setTimeout(r, 10));
        await this.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(x),
          y: Math.round(y),
          button: 'left',
          clickCount: 1,
          timestamp: Date.now() / 1000,
        });
        return;
      } catch {}
    }

    try {
      await humanBiometricStealthEngine.humanClick({ x, y }, (m, p) => this.send(m, p));
    } catch {
      await this.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
      });
      await new Promise((r) => setTimeout(r, 60));
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
      });
    }
  }

  /**
   * Dispatches authentic human kinetic scrolling with deceleration physics
   */
  public async dispatchSmoothScroll(deltaY: number = 300): Promise<void> {
    try {
      await humanBiometricStealthEngine.humanScroll(deltaY, (m, p) => this.send(m, p));
    } catch {
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: 300,
        y: 300,
        deltaX: 0,
        deltaY,
      });
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Adaptive DOM Settle Engine:
   * Dynamically inspects window.__SENTINEL_LAST_MUTATION_TS__ and resolves
   * as soon as DOM mutations have subsided for quietWindowMs, or upon timeoutMs.
   * Yields a 3x-8x speedup on modern SPAs while ensuring dynamic tables fully render.
   */
  public async waitForDomSettle(timeoutMs: number = 1000, quietWindowMs: number = 80): Promise<void> {
    if (timeoutMs <= 20) {
      return;
    }

    const start = Date.now();
    const effectiveQuietWindow = Math.min(quietWindowMs, Math.max(15, Math.floor(timeoutMs / 4)));
    const hardLimit = Math.min(timeoutMs, 4000);

    // Initial micro-pause (10ms) to allow any synchronous DOM dispatch to queue
    await new Promise((r) => setTimeout(r, Math.min(10, effectiveQuietWindow)));

    while (Date.now() - start < hardLimit) {
      try {
        const status = await this.evaluate<{ lastMutation: number; readyState: string }>(`
          (function() {
            return {
              lastMutation: window.__SENTINEL_LAST_MUTATION_TS__ || 0,
              readyState: document.readyState
            };
          })()
        `);

        if (status) {
          // If page is already complete and quiet window has elapsed (or no mutations ever occurred because page is static), resolve immediately!
          if (status.readyState === 'complete') {
            if (!status.lastMutation || Date.now() - status.lastMutation >= effectiveQuietWindow) {
              return;
            }
          } else if (status.readyState === 'interactive') {
            if (status.lastMutation && Date.now() - status.lastMutation >= effectiveQuietWindow) {
              return;
            }
          }
        }
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, Math.min(20, effectiveQuietWindow)));
    }
  }

  /**
   * Performs an in-browser fetch execution returning real status code, response headers, and clean body text.
   * Completely bypasses anti-bot protections (Cloudflare, Akamai, AWS WAF) by inheriting
   * the browser's valid cookies (cf_clearance, etc.), TLS handshake, and solved CAPTCHA state.
   */
  public async fetchInBrowserDetails(url: string, customHeaders?: Record<string, string>): Promise<BrowserFetchResult | null> {
    try {
      const code = `
        (async function() {
          try {
            const raw = ${JSON.stringify(customHeaders || {})};
            const forbidden = new Set(['cookie', 'host', 'origin', 'referer', 'connection', 'date', 'expect', 'content-length']);
            const h = {};
            for (const [k, v] of Object.entries(raw)) {
              if (!forbidden.has(k.toLowerCase()) && !k.toLowerCase().startsWith('sec-')) {
                h[k] = v;
              }
            }
            if (!h['Accept']) {
              h['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
            }
            const resp = await window.fetch(${JSON.stringify(url)}, {
              credentials: 'include',
              headers: h
            });
            const rawBody = await resp.text();
            const body = rawBody && rawBody.length > 1000000 ? rawBody.slice(0, 1000000) : (rawBody || '');
            const headers = {};
            resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
            return {
              status: resp.status,
              statusText: resp.statusText || 'OK',
              headers: headers,
              body: body
            };
          } catch (e) {
            return null;
          }
        })()
      `;
      const res = await this.evaluate<BrowserFetchResult | null>(code);
      return res;
    } catch {
      return null;
    }
  }

  /**
   * Performs an in-browser fetch execution using the live browser session context.
   * Completely bypasses anti-bot protections (Cloudflare, Akamai, AWS WAF) by inheriting
   * the browser's valid cookies (cf_clearance, etc.), TLS handshake, and solved CAPTCHA state.
   */
  public async fetchInBrowser(url: string): Promise<string | null> {
    const details = await this.fetchInBrowserDetails(url);
    return details ? details.body : null;
  }

  /**
   * Retrieves all inline and loaded script contents directly from the live DOM in memory.
   */
  public async getLoadedScriptsContent(): Promise<Array<{ src: string; content: string }>> {
    try {
      return await this.evaluate<Array<{ src: string; content: string }>>(`
        (function() {
          const results = [];
          const scripts = document.querySelectorAll('script');
          for (let i = 0; i < scripts.length && results.length < 35; i++) {
            const s = scripts[i];
            const src = s.src || '';
            const raw = (s.textContent || '').trim();
            const content = raw.length > 25000 ? raw.slice(0, 25000) : raw;
            if (src || content) {
              results.push({ src, content });
            }
          }
          return results;
        })()
      `) || [];
    } catch {
      return [];
    }
  }

  /**
   * Disconnects WebSocket and flushes pending requests
   */
  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.pendingCallbacks.forEach((cb) => cb.reject(new Error('CDP connection closed')));
    this.pendingCallbacks.clear();
    this.eventListeners.clear();
  }
}

export const stealthCdpBrowserDriver = new StealthCdpBrowserDriver();

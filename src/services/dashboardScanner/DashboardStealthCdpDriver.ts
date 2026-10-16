/**
 * Sentinel Sovereign Ω - Dashboard Stealth CDP Browser Driver
 * src/services/dashboardScanner/DashboardStealthCdpDriver.ts
 *
 * Dedicated, independent clone of Target's battle-tested Stealth CDP Engine
 * specifically crafted for the Dashboard Scanner.
 *
 * Features Cloned from Target Stealth:
 * - 15-second CDP command watchdog preventing Chrome deadlocks during context destructions
 * - Native CDP mouse wheel scrolling with natural physics (Input.dispatchMouseEvent)
 * - Biometric Bezier mouse kinematics & human clicks (HumanBiometricStealthEngine)
 * - React/Vue/Angular prototype-safe input state listeners
 * - Zero-Tampering runtime pre-execution script injection (Page.addScriptToEvaluateOnNewDocument)
 * - Automatic JavaScript modal dialog handling (Page.javascriptDialogOpening)
 * - Renderer process crash auto-revival (Inspector.targetCrashed)
 * - Real desktop window bounds emulation (1400x900) & focus emulation
 * - Automated multi-tenant intelligent login solver
 */

import { ipcClient } from '../../ipc/client';
import { ClientRuntimeOmniscienceService } from '../contentDiscovery/ClientRuntimeOmniscienceService';
import { humanBiometricStealthEngine } from '../contentDiscovery/HumanBiometricStealthEngine';

export interface DashboardCdpTargetPage {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

export class DashboardStealthCdpDriver {
  private ws: WebSocket | null = null;
  private msgId = 1;
  private pendingCallbacks = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private eventListeners = new Map<string, Set<(params: any) => void>>();
  private activePageUrl: string = '';
  private debugPort: number = 9222;
  private isConnected: boolean = false;
  private activeTargetPage: DashboardCdpTargetPage | null = null;

  constructor(debugPort: number = 9222) {
    this.debugPort = debugPort;
  }

  public get connected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public get currentUrl(): string {
    return this.activePageUrl;
  }

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
   * Low-level CDP command dispatcher with a 15-second watchdog timer to guarantee
   * that destroyed execution contexts or network hung promises never stall the crawler.
   */
  public async send<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    if (!this.connected) {
      throw new Error(`CDP command failed: Not connected to Chrome (command: ${method})`);
    }

    const id = this.msgId++;
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        reject(new Error(`CDP command '${method}' timed out after 15000ms (Watchdog Triggered)`));
      }, 15000);

      this.pendingCallbacks.set(id, {
        resolve: (res) => {
          clearTimeout(timeoutId);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
      });

      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  // Alias for backward compatibility
  public async sendCommand<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    return this.send<T>(method, params);
  }

  /**
   * Connects to Chrome CDP, discovers the appropriate page target,
   * initializes protocol domains, and injects stealth evasions.
   */
  public async connect(targetUrl: string, targetHost: string): Promise<boolean> {
    this.disconnect();

    // 1. Verify CDP endpoint availability
    let available = false;
    try {
      const res = await fetch(`http://127.0.0.1:${this.debugPort}/json/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500),
      });
      available = res.ok;
    } catch {}

    if (!available) {
      try {
        await ipcClient.launchSystemBrowser(targetUrl || 'about:blank', 8085);
      } catch (err) {
        console.warn('[DashboardStealthCDP] System browser launch notice:', err);
      }

      const start = Date.now();
      while (Date.now() - start < 10000) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const res = await fetch(`http://127.0.0.1:${this.debugPort}/json/version`, {
            method: 'GET',
            signal: AbortSignal.timeout(1000),
          });
          if (res.ok) {
            available = true;
            break;
          }
        } catch {}
      }
    }

    // 2. Discover available target pages
    let pages: DashboardCdpTargetPage[] = [];
    try {
      const res = await fetch(`http://127.0.0.1:${this.debugPort}/json`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        pages = await res.json();
      }
    } catch {}

    const cleanHost = (targetHost || '').toLowerCase().trim();
    let targetPage = pages.find(
      (p) =>
        p.type === 'page' &&
        p.webSocketDebuggerUrl &&
        !p.url.startsWith('chrome://') &&
        !p.url.startsWith('about:') &&
        (p.url.toLowerCase().includes(cleanHost) || p.url.toLowerCase().includes(targetUrl.toLowerCase()))
    );

    if (!targetPage) {
      targetPage = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl && !p.url.startsWith('chrome://'));
    }

    // If no candidate tab exists, create a dedicated tab
    if (!targetPage?.webSocketDebuggerUrl) {
      try {
        const createRes = await fetch(`http://127.0.0.1:${this.debugPort}/json/new?${encodeURIComponent(targetUrl)}`, {
          method: 'PUT',
        });
        if (createRes.ok) {
          targetPage = await createRes.json();
        }
      } catch {}
    }

    if (!targetPage?.webSocketDebuggerUrl) {
      return false;
    }

    this.activeTargetPage = targetPage;

    // Connect via relay port 9223 if needed
    const rawWsUrl = targetPage.webSocketDebuggerUrl;
    const wsUrl = rawWsUrl.replace(`:${this.debugPort}`, ':9223').replace(':9222', ':9223');

    const connectedOk = await new Promise<boolean>((resolve) => {
      try {
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        const timeout = setTimeout(() => {
          this.disconnect();
          resolve(false);
        }, 10000);

        socket.onopen = async () => {
          clearTimeout(timeout);
          this.isConnected = true;
          resolve(true);
        };

        socket.onerror = (e) => {
          clearTimeout(timeout);
          this.disconnect();
          console.error('[DashboardStealthCDP] WebSocket error:', e);
          resolve(false);
        };

        socket.onclose = () => {
          this.isConnected = false;
          this.ws = null;
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle method responses
            if (data.id && this.pendingCallbacks.has(data.id)) {
              const cb = this.pendingCallbacks.get(data.id)!;
              this.pendingCallbacks.delete(data.id);
              if (data.error) {
                cb.reject(new Error(data.error.message || 'CDP Error'));
              } else {
                cb.resolve(data.result);
              }
            }

            // Auto-dismiss native JavaScript modal dialogs
            if (data.method === 'Page.javascriptDialogOpening') {
              const promptText = data.params?.defaultPrompt || '';
              this.send('Page.handleJavaScriptDialog', { accept: true, promptText }).catch(() => {});
            }

            // Background event notifications
            if (data.method && this.eventListeners.has(data.method)) {
              const listeners = this.eventListeners.get(data.method)!;
              listeners.forEach((fn) => {
                try { fn(data.params); } catch (err) {
                  console.warn('Error in Dashboard CDP event handler:', err);
                }
              });
            }
          } catch {}
        };
      } catch {
        resolve(false);
      }
    });

    if (!connectedOk) return false;

    // 3. Initialize essential protocol domains
    try {
      await this.send('Page.enable');
      await this.send('DOM.enable');
      await this.send('Network.enable');
      await this.send('Runtime.enable');
    } catch {}

    // Auto-dismiss dialogs listener
    this.on('Page.javascriptDialogOpening', (params) => {
      this.send('Page.handleJavaScriptDialog', { accept: true, promptText: params?.defaultPrompt || '' }).catch(() => {});
    });

    // Auto-revive on renderer process crash
    try {
      await this.send('Inspector.enable');
      this.on('Inspector.targetCrashed', async () => {
        console.warn('[DashboardStealthCDP] Renderer process crashed! Reviving...');
        try {
          await this.send('Page.reload', { ignoreCache: false });
        } catch {
          if (targetUrl) {
            try { await this.navigate(targetUrl); } catch {}
          }
        }
      });
    } catch {}

    // 4. Cloned Anti-Bot Stealth Configuration
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

    // 5. Zero-Tampering Pre-Execution Script Injection
    try {
      const omniscienceScript = ClientRuntimeOmniscienceService.getInjectionScript();
      await this.send('Page.addScriptToEvaluateOnNewDocument', {
        source: omniscienceScript,
      });
      await this.evaluate(omniscienceScript);
    } catch {}

    if (targetPage.url) {
      this.activePageUrl = targetPage.url;
    }

    return true;
  }

  public async navigate(url: string): Promise<number> {
    if (!this.connected) return 0;
    const start = Date.now();
    try {
      this.activePageUrl = url;
      await this.send('Page.navigate', { url });
    } catch (err: any) {
      console.warn('[DashboardStealthCDP] Navigation notice:', err?.message);
    }
    return Date.now() - start;
  }

  public async evaluate<T = any>(expression: string): Promise<T> {
    if (!this.connected) return null as any;
    try {
      const res = await this.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res?.result?.value;
    } catch {
      return null as any;
    }
  }

  public async waitForDomSettle(timeoutMs: number = 800): Promise<void> {
    await new Promise((r) => setTimeout(r, timeoutMs));
  }

  /**
   * Cloned from Target: Dispatches authentic human CDP mouse wheel scrolls
   * with natural physics to trigger lazy loading without tripping anti-bot heuristics.
   */
  public async dispatchSmoothScroll(deltaY: number = 350): Promise<void> {
    if (!this.connected) return;
    try {
      const steps = 6;
      const stepDelta = Math.round(deltaY / steps);
      for (let i = 0; i < steps; i++) {
        await this.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: 700,
          y: 450,
          deltaX: 0,
          deltaY: stepDelta,
          pointerType: 'mouse',
        });
        await new Promise((r) => setTimeout(r, 20));
      }
    } catch {
      // Fallback
      try {
        await this.evaluate(`window.scrollBy({ top: ${deltaY}, behavior: 'smooth' });`);
      } catch {}
    }
  }

  /**
   * Intelligently dismisses SweetAlert, Bootstrap modals, cookie banners, and overlays.
   */
  public async dismissBlockingModalsAndOverlays(): Promise<void> {
    const hasModal = await this.evaluate<boolean>(`
      (function() {
        const sel = '.swal2-container, .modal-backdrop, .sweet-overlay, .blockUI, [role="dialog"], [aria-modal="true"]';
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
          const selectors = [
            '.swal2-confirm', '.swal2-close', '.swal-button--confirm',
            '[data-dismiss="modal"]', '[data-bs-dismiss="modal"]',
            '.modal .close', '.modal .btn-close', '.alert .close', '.toast .close',
            'button.cookie-dismiss', '[aria-label="Close" i]', '[aria-label="Dismiss" i]'
          ];
          document.querySelectorAll(selectors.join(', ')).forEach(b => {
            try { if (b.offsetWidth > 0 || b.offsetHeight > 0) b.click(); } catch(e) {}
          });

          // Neutralize blocking backdrops
          document.querySelectorAll('.swal2-container, .modal-backdrop, .sweet-overlay, .blockUI').forEach(el => {
            try { el.remove(); } catch(e) {}
          });
        })()
      `);
    } catch {}
  }

  /**
   * Cloned from Target: Dispatches authentic human Bezier mouse movements
   * and natural click physics with strict monotonic timestamps.
   */
  public async dispatchHumanClick(options: { x: number; y: number; delayMs?: number }): Promise<void> {
    const { x, y, delayMs = 80 } = options;
    try {
      await humanBiometricStealthEngine.moveMouseTo(
        { x, y },
        (method, params) => this.send(method, params),
        25
      );
    } catch {
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(x),
        y: Math.round(y),
        timestamp: Date.now() / 1000,
        button: 'none',
        buttons: 0,
        pointerType: 'mouse',
      });
    }

    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 1,
      clickCount: 1,
      timestamp: Date.now() / 1000,
      pointerType: 'mouse',
      force: 0.5,
    });

    await new Promise((r) => setTimeout(r, Math.max(30, delayMs)));

    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 0,
      clickCount: 1,
      timestamp: Date.now() / 1000,
      pointerType: 'mouse',
      force: 0,
    });
  }

  /**
   * Scrolls an element into view and returns its center coordinates.
   */
  public async scrollAndGetElementCoordinates(selector: string): Promise<{ x: number; y: number } | null> {
    try {
      return await this.evaluate<{ x: number; y: number } | null>(`
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          return {
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2),
          };
        })()
      `);
    } catch {
      return null;
    }
  }

  /**
   * Biometric element clicker: Handles modal cleanups, scrolls to element,
   * dispatches CDP biometric mouse events.
   */
  public async clickElement(selector: string): Promise<boolean> {
    if (!this.connected) return false;
    await this.dismissBlockingModalsAndOverlays();

    const coords = await this.scrollAndGetElementCoordinates(selector);
    let cdpClicked = false;
    if (coords && coords.x > 0 && coords.y > 0) {
      try {
        await this.dispatchHumanClick({ x: coords.x, y: coords.y, delayMs: 60 });
        cdpClicked = true;
      } catch {}
    }

    // Only fall back to synthetic DOM click if hardware CDP click could not reach element
    if (!cdpClicked) {
      try {
        return await this.evaluate<boolean>(`
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return false;
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            try { el.click(); } catch(e) {}
            return true;
          })()
        `);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Cloned from Target: Universal input filler that triggers React 16/17/18,
   * Vue, and Angular reactive state listeners using HTMLInputElement prototype setters.
   */
  public async fillInput(selector: string, value: string): Promise<boolean> {
    if (!this.connected) return false;
    await this.dismissBlockingModalsAndOverlays();

    const coords = await this.scrollAndGetElementCoordinates(selector);
    if (coords && coords.x > 0 && coords.y > 0) {
      try {
        await this.dispatchHumanClick({ x: coords.x, y: coords.y, delayMs: 40 });
      } catch {}
    }

    try {
      return await this.evaluate<boolean>(`
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.focus();

          // Native property descriptor setter ensures React/Vue controlled state receives value
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(el, ${JSON.stringify(value)});
          } else {
            el.value = ${JSON.stringify(value)};
          }

          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        })()
      `);
    } catch {
      return false;
    }
  }

  /**
   * Multi-Tenant Intelligent Automated Login Solver:
   * Uses biometric element targeting and prototype-safe input fillers
   * to authenticate with configured tenant credentials.
   */
  public async performAutomatedLogin(credentials: { username: string; password: string }): Promise<{ success: boolean; message: string }> {
    if (!this.connected) {
      return { success: false, message: 'Not connected to browser' };
    }

    try {
      await this.dismissBlockingModalsAndOverlays();

      const formInfo = await this.evaluate<{
        hasLoginForm: boolean;
        hasUser: boolean;
        hasPass: boolean;
        hasSubmit: boolean;
        formAction?: string;
      }>(`
        (function() {
          // Clear any previous tags
          document.querySelectorAll('[data-sentinel-login]').forEach(el => el.removeAttribute('data-sentinel-login'));

          const pass = document.querySelector('input[type="password"]:not([disabled])') ||
                       document.querySelector('input[type="password"]');
          if (!pass) return { hasLoginForm: false, hasUser: false, hasPass: false, hasSubmit: false };

          pass.setAttribute('data-sentinel-login', 'pass');

          const form = pass.closest('form') || pass.closest('.login-form, .signin-form, [class*="login" i], [class*="auth" i], [class*="modal" i]') || document.body;

          // Locate username / email field
          let user = form.querySelector('input[type="text"]:not([disabled]), input[type="email"]:not([disabled]), input[name*="user" i], input[name*="login" i], input[name*="email" i], input[id*="user" i], input[id*="login" i], input[id*="email" i], input[placeholder*="user" i], input[placeholder*="email" i]');
          
          if (!user) {
            // Find the visible text-compatible input immediately preceding the password input
            const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'));
            user = allInputs.find(i => (i.compareDocumentPosition(pass) & Node.DOCUMENT_POSITION_FOLLOWING)) || allInputs[0];
          }

          if (user) {
            user.setAttribute('data-sentinel-login', 'user');
          }

          // Locate submit button
          let submit = form.querySelector('button[type="submit"], input[type="submit"], button.btn-login, #login-btn, [data-testid*="login" i], [data-testid*="submit" i]') ||
                       Array.from(form.querySelectorAll('button, [role="button"], input[type="button"]')).find(b => {
                         const txt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                         return txt === 'log in' || txt === 'login' || txt === 'sign in' || txt === 'signin' || txt === 'submit' || txt === 'continue' || txt === 'next';
                       }) ||
                       document.querySelector('button[type="submit"], input[type="submit"]');

          if (submit) {
            submit.setAttribute('data-sentinel-login', 'submit');
          }

          return {
            hasLoginForm: true,
            hasUser: Boolean(user),
            hasPass: true,
            hasSubmit: Boolean(submit),
            formAction: form instanceof HTMLFormElement ? form.action : undefined
          };
        })()
      `);

      if (!formInfo?.hasLoginForm) {
        return { success: false, message: 'No login form detected on page' };
      }

      // 1. Fill Username / Email
      if (formInfo.hasUser) {
        await this.fillInput('[data-sentinel-login="user"]', credentials.username);
        await new Promise((r) => setTimeout(r, 120));
      }

      // 2. Fill Password
      if (formInfo.hasPass) {
        await this.fillInput('[data-sentinel-login="pass"]', credentials.password);
        await new Promise((r) => setTimeout(r, 120));
      }

      // 3. Submit Form
      if (formInfo.hasSubmit) {
        await this.clickElement('[data-sentinel-login="submit"]');
      } else {
        await this.evaluate(`
          (function() {
            const pass = document.querySelector('[data-sentinel-login="pass"]');
            const form = pass ? pass.closest('form') : document.querySelector('form');
            if (form) {
              form.submit();
            } else if (pass) {
              pass.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
              pass.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
              pass.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
            }
          })()
        `);
      }

      await this.waitForDomSettle(1800);

      // 4. Verify post-authentication state
      const postState = await this.evaluate<{ isError: boolean; hasActivePasswordInput: boolean; url: string }>(`
        (function() {
          const text = (document.body ? document.body.innerText : '').toLowerCase();
          const isError = text.includes('invalid username') ||
                          text.includes('incorrect password') ||
                          text.includes('invalid credentials') ||
                          text.includes('authentication failed') ||
                          text.includes('wrong password') ||
                          text.includes('user not found');
          const hasActivePasswordInput = Boolean(document.querySelector('input[type="password"]'));
          return { isError, hasActivePasswordInput, url: window.location.href };
        })()
      `);

      if (postState?.isError) {
        return { success: false, message: 'Invalid credentials rejected by target' };
      }

      return { success: true, message: `Successfully authenticated as '${credentials.username}'` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Login attempt error' };
    }
  }

  public disconnect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.pendingCallbacks.forEach((cb) => cb.reject(new Error('Dashboard CDP disconnected')));
    this.pendingCallbacks.clear();
    this.eventListeners.clear();
  }
}

export const dashboardStealthCdpDriver = new DashboardStealthCdpDriver();

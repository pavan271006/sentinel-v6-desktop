/**
 * Sentinel Sovereign Ω - CAPTCHA Sentinel & Anti-Bot Challenge Engine
 *
 * Real-time detection and human-in-the-loop lifecycle coordination for:
 * 1. Cloudflare Turnstile & Interstitial Challenges
 * 2. Google reCAPTCHA v2, v3, and Enterprise
 * 3. hCaptcha
 * 4. AWS WAF CAPTCHA & Challenge
 * 5. Arkose Labs / FunCaptcha
 * 6. GeeTest (v3 / v4)
 * 7. PerimeterX / HUMAN Security Enforcer
 * 8. DataDome Captcha Slider / Device Verification
 * 9. Kasada Keyless Interstitial
 */

import { StealthCdpBrowserDriver } from './StealthCdpBrowserDriver';
import { humanBiometricStealthEngine } from './HumanBiometricStealthEngine';

export type CaptchaProvider =
  | 'Cloudflare Turnstile'
  | 'Cloudflare Interstitial'
  | 'Google reCAPTCHA'
  | 'hCaptcha'
  | 'AWS WAF CAPTCHA'
  | 'Arkose Labs FunCaptcha'
  | 'GeeTest'
  | 'PerimeterX HUMAN'
  | 'DataDome'
  | 'Kasada'
  | 'Generic Security Challenge';

export interface CaptchaDetectionResult {
  hasCaptcha: boolean;
  provider?: CaptchaProvider;
  details?: string;
  selectorMatched?: string;
  isChallengeScreen?: boolean;
}

export class CaptchaSentinelEngine {
  /**
   * Generates a self-contained in-page JavaScript evaluation script that checks all
   * known commercial anti-bot challenge and CAPTCHA signatures in the DOM.
   */
  public static getInBrowserDetectionScript(): string {
    return `
      (function() {
        const title = (document.title || '').toLowerCase();
        const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
        const linksCount = document.querySelectorAll('a[href]').length;
        const buttonsCount = document.querySelectorAll('button, [role="button"], input[type="submit"]').length;
        const hasRealPageContent = (linksCount >= 4 || buttonsCount >= 3 || document.querySelector('main, article, header, nav, #root:not(:empty), #app:not(:empty), footer, .content, .container') !== null) && bodyText.length > 200;
        const isCaptchaTestRoute = window.location.pathname.includes('turnstile') || window.location.pathname.includes('captcha') || window.location.pathname.includes('challenge');

        // Check if full-page Cloudflare interstitial is active
        const isCloudflareInterstitial =
          document.querySelector('#challenge-running, #challenge-stage, #challenge-form, #cf-wrapper') !== null ||
          title.includes('just a moment') ||
          title.includes('one moment, please') ||
          (title.includes('attention required') && title.includes('cloudflare')) ||
          bodyText.includes('performing security verification') ||
          bodyText.includes('verifies you are not a bot') ||
          bodyText.includes('checking your browser before accessing');

        // Check Turnstile token state
        const turnstileInput = document.querySelector('input[name="cf-turnstile-response"]');
        const hasTurnstileToken = Boolean(turnstileInput && turnstileInput.value && turnstileInput.value.length > 20);

        if (isCloudflareInterstitial && !hasTurnstileToken) {
          return {
            hasCaptcha: true,
            provider: 'Cloudflare Interstitial',
            details: 'Cloudflare security verification interstitial active',
            selectorMatched: '#challenge-stage'
          };
        }

        // If page is fully rendered with genuine content and is not a dedicated captcha test route,
        // embedded background scripts (e.g. reCAPTCHA v3 or footer widgets) do NOT block exploration!
        if (hasRealPageContent && !isCloudflareInterstitial && !isCaptchaTestRoute) {
          return { hasCaptcha: false };
        }

        // 1. Cloudflare Turnstile (Embedded Widget or in-page challenge)
        const hasTurnstileElement = Boolean(
          document.querySelector('.cf-turnstile, [data-sitekey], #turnstile-wrapper, iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]') ||
          (window.turnstile && typeof window.turnstile.render === 'function') ||
          turnstileInput !== null
        );

        if (hasTurnstileElement && !hasTurnstileToken) {
          return {
            hasCaptcha: true,
            provider: 'Cloudflare Turnstile',
            details: 'Turnstile challenge pending verification token',
            selectorMatched: '.cf-turnstile'
          };
        }

        // 2. Google reCAPTCHA (v2 / v3 / Enterprise)
        const rcInput = document.querySelector('textarea[name="g-recaptcha-response"], input[name="g-recaptcha-response"]');
        const hasRcToken = Boolean(rcInput && rcInput.value && rcInput.value.length > 20);
        const hasRcElement = Boolean(
          document.querySelector('.g-recaptcha, iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha/api2"]') ||
          (window.grecaptcha && typeof window.grecaptcha.execute === 'function') ||
          rcInput !== null
        );
        if (hasRcElement && !hasRcToken) {
          return { hasCaptcha: true, provider: 'Google reCAPTCHA', details: 'reCAPTCHA challenge pending verification', selectorMatched: '.g-recaptcha' };
        }

        // 3. hCaptcha
        const hcInput = document.querySelector('textarea[name="h-captcha-response"], input[name="h-captcha-response"]');
        const hasHcToken = Boolean(hcInput && hcInput.value && hcInput.value.length > 20);
        const hasHcElement = Boolean(
          document.querySelector('.h-captcha, iframe[src*="hcaptcha.com"]') ||
          (window.hcaptcha && typeof window.hcaptcha.render === 'function') ||
          hcInput !== null
        );
        if (hasHcElement && !hasHcToken) {
          return { hasCaptcha: true, provider: 'hCaptcha', details: 'hCaptcha interactive widget pending', selectorMatched: '.h-captcha' };
        }

        // 4. AWS WAF CAPTCHA
        if (
          document.querySelector('#aws-waf-captcha, iframe[src*="awswaf"], #aws-waf-captcha-wrapper') ||
          window.AwsWafCaptcha !== undefined
        ) {
          return { hasCaptcha: true, provider: 'AWS WAF CAPTCHA', details: 'AWS WAF Bot Control challenge present', selectorMatched: '#aws-waf-captcha' };
        }

        // 5. Arkose Labs / FunCaptcha
        if (
          document.querySelector('#fc-iframe-wrap, iframe[src*="arkoselabs"], iframe[src*="funcaptcha"]') ||
          window.Arkose !== undefined
        ) {
          return { hasCaptcha: true, provider: 'Arkose Labs FunCaptcha', details: 'Arkose Labs puzzle challenge present', selectorMatched: '#fc-iframe-wrap' };
        }

        // 6. GeeTest
        if (
          document.querySelector('.geetest_holder, .geetest_radar_btn, .geetest_captcha') ||
          window.initGeetest !== undefined
        ) {
          return { hasCaptcha: true, provider: 'GeeTest', details: 'GeeTest slider/behavior challenge present', selectorMatched: '.geetest_holder' };
        }

        // 7. PerimeterX / HUMAN Security
        if (
          document.querySelector('#px-captcha, iframe[src*="perimeterx"], #px-challenge-container') ||
          window._pxAction !== undefined
        ) {
          return { hasCaptcha: true, provider: 'PerimeterX HUMAN', details: 'PerimeterX sensor challenge present', selectorMatched: '#px-captcha' };
        }

        // 8. DataDome
        if (
          document.querySelector('#datadome-captcha, iframe[src*="datadome.co"]') ||
          window.ddCaptchaChallenge !== undefined
        ) {
          return { hasCaptcha: true, provider: 'DataDome', details: 'DataDome device verification slider present', selectorMatched: '#datadome-captcha' };
        }

        // 9. Kasada
        if (
          document.querySelector('#kpsdk, script[src*="kasada"]') ||
          window.KPSDK !== undefined
        ) {
          return { hasCaptcha: true, provider: 'Kasada', details: 'Kasada Keyless challenge present', selectorMatched: '#kpsdk' };
        }

        // 10. WAF Form Captcha / Robot Check (AWS WAF, Cloud Gateways)
        const u = window.location.href.toLowerCase();
        if (
          u.includes('validatecaptcha') ||
          title.includes('robot check') ||
          bodyText.includes("sorry, we just need to make sure you're not a robot") ||
          bodyText.includes('enter the characters you see below') ||
          document.querySelector('form[action*="validateCaptcha"], form[action*="captcha"]') !== null
        ) {
          return {
            hasCaptcha: true,
            provider: 'WAF Form Captcha',
            details: 'WAF CAPTCHA / Robot Check challenge active',
            selectorMatched: 'form[action*="captcha"]'
          };
        }

        // 11. Edge Bot Manager Interstitial Wall (Akamai, PerimeterX, Imperva, etc.)
        if (
          document.querySelector('#sec-container, #challenge-container, #px-captcha-modal') !== null ||
          ((bodyText.includes("something's not right!") || bodyText.includes('access denied') || bodyText.includes('unusual activity')) && linksCount < 10)
        ) {
          return {
            hasCaptcha: true,
            provider: 'Edge Anti-Bot Interstitial',
            details: 'Edge anti-bot challenge interstitial active',
            selectorMatched: '#sec-container, #challenge-container'
          };
        }

        // 12. Generic Bot/Security Challenge
        if (
          (bodyText.includes('please verify you are a human') ||
           bodyText.includes('confirm that you are not a robot') ||
           bodyText.includes('complete the security check')) &&
          linksCount < 5
        ) {
          return { hasCaptcha: true, provider: 'Generic Security Challenge', details: 'Generic human verification text with sparse navigation', selectorMatched: 'body' };
        }

        return { hasCaptcha: false };
      })();
    `;
  }

  /**
   * Inspects the connected browser page to check if an active CAPTCHA or security challenge is blocking navigation.
   */
  public async detectCaptcha(driver: StealthCdpBrowserDriver): Promise<CaptchaDetectionResult> {
    try {
      const result = await driver.evaluate<CaptchaDetectionResult>(CaptchaSentinelEngine.getInBrowserDetectionScript());
      return result || { hasCaptcha: false };
    } catch {
      return { hasCaptcha: false };
    }
  }

  /**
   * Autonomously targets, clicks, and waits for anti-bot challenges and CAPTCHA interstitials
   * (Cloudflare Turnstile, Managed Challenges, Google reCAPTCHA, hCaptcha, AWS WAF, etc.)
   * to resolve using authentic human-like CDP pointer events and Proof-of-Work wait.
   */
  public async attemptAutonomousChallengeBypass(
    driver: StealthCdpBrowserDriver,
    onStatus?: (status: string) => void
  ): Promise<boolean> {
    const report = (msg: string) => {
      if (onStatus) onStatus(`[Autonomous Anti-Bot Engine] ${msg}`);
    };

    // 1. Initial check: is there an active challenge or interstitial?
    const initial = await this.detectCaptcha(driver);
    if (!initial.hasCaptcha) {
      return true;
    }

    const solvableProviders = [
      'Cloudflare Turnstile',
      'Cloudflare Interstitial',
      'Google reCAPTCHA',
      'hCaptcha',
      'AWS WAF CAPTCHA',
      'Generic Security Challenge',
      'Kasada',
      'PerimeterX HUMAN',
      'DataDome',
    ];
    if (initial.provider && !solvableProviders.includes(initial.provider)) {
      return false;
    }

    report(`Detected ${initial.provider || 'Security'} challenge. Initiating dynamic solving sequence...`);

    // 2. Allow up to 3 seconds for silent background Proof-of-Work or script execution to resolve without click
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const check = await this.detectCaptcha(driver);
      if (!check.hasCaptcha) {
        report('Challenge cleared autonomously via background Proof-of-Work!');
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }

    // 3. Locate interactive challenge target (iframe, checkbox widget, or verification button)
    report('Locating challenge verification target for kinematic interaction...');
    const targetCoords = await driver.evaluate<{
      found: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'checkbox' | 'button' | 'small-checkbox' | 'none';
    }>(`
      (function() {
        function findIframes(root) {
          let list = Array.from(root.querySelectorAll('iframe'));
          const elements = root.querySelectorAll('*');
          for (const el of elements) {
            if (el.shadowRoot) {
              list = list.concat(findIframes(el.shadowRoot));
            }
          }
          return list;
        }

        const iframes = findIframes(document);
        // Match challenge iframe: Turnstile, reCAPTCHA anchor, hCaptcha, AWS WAF, etc.
        const challengeIframe = iframes.find(f => {
          const src = (f.src || f.getAttribute('src') || '').toLowerCase();
          const title = (f.title || f.getAttribute('title') || '').toLowerCase();
          const name = (f.name || f.getAttribute('name') || '').toLowerCase();
          const id = (f.id || '').toLowerCase();
          return (
            src.includes('challenges.cloudflare.com') ||
            src.includes('turnstile') ||
            src.includes('recaptcha/api2/anchor') ||
            src.includes('recaptcha/enterprise/anchor') ||
            src.includes('google.com/recaptcha') ||
            src.includes('hcaptcha.com') ||
            src.includes('awswaf') ||
            title.includes('cloudflare') ||
            title.includes('turnstile') ||
            title.includes('challenge') ||
            name.includes('cf-chl') ||
            id.includes('cf-chl')
          );
        });

        if (challengeIframe) {
          try { challengeIframe.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch(e) {}
          const r = challengeIframe.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return {
              found: true,
              x: Math.round(r.left),
              y: Math.round(r.top),
              width: Math.round(r.width),
              height: Math.round(r.height),
              type: 'checkbox'
            };
          }
        }

        // Dedicated challenge widgets/containers (Turnstile, reCAPTCHA, hCaptcha, AWS WAF, ARIA checkboxes)
        const container = document.querySelector(
          '.cf-turnstile, #turnstile-wrapper, #challenge-stage, #challenge-running, [data-sitekey], .g-recaptcha, .h-captcha, #aws-waf-captcha, [role="checkbox"], .recaptcha-checkbox'
        );
        if (container) {
          const innerCheckbox = container.querySelector('input[type="checkbox"], svg, .recaptcha-checkbox');
          const targetEl = innerCheckbox || container;
          try { targetEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch(e) {}
          const r = targetEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return {
              found: true,
              x: Math.round(r.left),
              y: Math.round(r.top),
              width: Math.round(r.width),
              height: Math.round(r.height),
              type: innerCheckbox ? 'small-checkbox' : 'checkbox'
            };
          }
        }

        // Cloudflare Managed Challenge Turnstile wrapper (dynamic container containing cf-turnstile-response)
        const turnstileInput = document.querySelector('input[name="cf-turnstile-response"], input[id*="cf-chl-widget"]');
        if (turnstileInput) {
          const widgetBox = turnstileInput.previousElementSibling || turnstileInput.parentElement;
          if (widgetBox) {
            try { widgetBox.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch(e) {}
            const r = widgetBox.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return {
                found: true,
                x: Math.round(r.left),
                y: Math.round(r.top),
                width: Math.round(r.width),
                height: Math.round(r.height),
                type: 'checkbox'
              };
            }
          }
        }

        // Verification buttons (e.g. "Verify you are human", "I am human", "Continue")
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"], a.btn, input.ZzRgL3, #DEYIo7 input'));
        const verifyBtn = buttons.find(b => {
          const val = (b.value || b.getAttribute('value') || '').toLowerCase().trim();
          const txt = (b.innerText || b.textContent || '').toLowerCase().trim();
          const combined = (val + ' ' + txt).trim();
          return (
            combined.includes('verify you are human') ||
            combined.includes('i am human') ||
            combined.includes('verify human') ||
            combined.includes('confirm human') ||
            (combined.includes('verify') && combined.length < 30)
          );
        });
        if (verifyBtn) {
          try { verifyBtn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch(e) {}
          const r = verifyBtn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return {
              found: true,
              x: Math.round(r.left),
              y: Math.round(r.top),
              width: Math.round(r.width),
              height: Math.round(r.height),
              type: 'button'
            };
          }
        }

        return { found: false, x: 0, y: 0, width: 0, height: 0, type: 'none' };
      })()
    `);

    if (targetCoords?.found && targetCoords.width > 0 && targetCoords.height > 0) {
      let clickX: number;
      let clickY: number;

      if (targetCoords.type === 'button') {
        clickX = Math.round(targetCoords.x + targetCoords.width / 2);
        clickY = Math.round(targetCoords.y + targetCoords.height / 2);
      } else if (targetCoords.type === 'small-checkbox' || targetCoords.width <= 50) {
        clickX = Math.round(targetCoords.x + targetCoords.width / 2);
        clickY = Math.round(targetCoords.y + targetCoords.height / 2);
      } else {
        // For checkbox widgets (reCAPTCHA anchor, Turnstile, hCaptcha), the checkbox is positioned inside the left edge
        clickX = Math.round(targetCoords.x + Math.min(32, Math.max(26, targetCoords.width * 0.1)));
        clickY = Math.round(targetCoords.y + (targetCoords.height / 2));
      }

      if (initial.provider === 'PerimeterX HUMAN') {
        report(`Dispatching authentic human Press-and-Hold challenge interaction at (${clickX}, ${clickY})...`);
        try {
          await humanBiometricStealthEngine.pressAndHold({ x: clickX, y: clickY }, (m, p) => driver.send(m, p), 4200);
        } catch (err) {
          report(`Press-and-Hold notice: ${err}`);
        }
      } else {
        report(`Dispatching authentic human mouse click to verification target at (${clickX}, ${clickY})...`);
        try {
          await driver.dispatchHumanClick({ x: clickX, y: clickY, delayMs: 120 });
        } catch (err) {
          report(`Click dispatch notice: ${err}`);
        }
      }
    } else {
      report('Waiting for challenge computation / proof-of-work to complete...');
    }

    // 4. Dynamic waiting loop: PoW & challenge resolution takes between 5–22 seconds
    const startTime = Date.now();
    const maxAutonomousWaitMs = 22000;
    let retriedClick = false;

    while (Date.now() - startTime < maxAutonomousWaitMs) {
      await new Promise((r) => setTimeout(r, 600));
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      report(`Verifying security challenge resolution (${elapsedSec}s elapsed)...`);

      // If after 4 seconds challenge has not resolved, attempt a second targeted click
      if (elapsedSec >= 4 && !retriedClick) {
        retriedClick = true;
        try {
          const reCheckCoords = await driver.evaluate<{ found: boolean; x: number; y: number; width: number; height: number; type: string }>(`
            (function() {
              const iframes = Array.from(document.querySelectorAll('iframe'));
              const cf = iframes.find(f => (f.src || f.getAttribute('src') || '').toLowerCase().includes('turnstile') || (f.src || '').toLowerCase().includes('cloudflare'));
              if (cf) {
                const r = cf.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return { found: true, x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), type: 'checkbox' };
              }
              const box = document.querySelector('.cf-turnstile, #turnstile-wrapper, [role="checkbox"]');
              if (box) {
                const r = box.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return { found: true, x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), type: 'checkbox' };
              }
              return { found: false, x: 0, y: 0, width: 0, height: 0, type: 'none' };
            })()
          `);
          if (reCheckCoords?.found) {
            const rx = Math.round(reCheckCoords.x + Math.min(32, Math.max(26, reCheckCoords.width * 0.1)));
            const ry = Math.round(reCheckCoords.y + (reCheckCoords.height / 2));
            report(`Re-dispatching verification click at (${rx}, ${ry})...`);
            await driver.dispatchHumanClick({ x: rx, y: ry, delayMs: 80 });
          }
        } catch {}
      }

      try {
        const check = await this.detectCaptcha(driver);
        if (!check.hasCaptcha) {
          report(`Security challenge successfully resolved in ${elapsedSec}s!`);
          await new Promise((r) => setTimeout(r, 800));
          return true;
        }

        const isStillChallenge = await driver.evaluate<boolean>(`
          (function() {
            const t = (document.title || '').toLowerCase();
            const b = (document.body ? document.body.innerText : '').toLowerCase();
            const tokens = [
              document.querySelector('input[name="cf-turnstile-response"]')?.value,
              document.querySelector('textarea[name="g-recaptcha-response"]')?.value,
              document.querySelector('input[name="h-captcha-response"]')?.value
            ];
            if (tokens.some(tok => tok && tok.length > 20)) return false;
            return (
              t.includes('just a moment') ||
              t.includes('one moment') ||
              t.includes('attention required') ||
              b.includes('performing security verification') ||
              b.includes('verifies you are not a bot') ||
              b.includes('checking your browser before accessing')
            );
          })()
        `);

        if (!isStillChallenge) {
          report(`Security challenge passed! Page ready.`);
          await new Promise((r) => setTimeout(r, 800));
          return true;
        }
      } catch {
        // Navigation might be occurring (page redirecting to destination)
        await new Promise((r) => setTimeout(r, 1200));
        return true;
      }
    }

    report('Autonomous solve window completed. Checking status...');
    const finalCheck = await this.detectCaptcha(driver);
    return !finalCheck.hasCaptcha;
  }

  /**
   * Pauses crawler automation and waits for the challenge to resolve in the browser.
   * First attempts autonomous resolution; if manual intervention is required,
   * periodically checks if the challenge has resolved.
   *
   * @param driver Stealth CDP driver attached to the target tab
   * @param options Configuration for polling frequency and timeout
   * @returns true if CAPTCHA was resolved, false if timed out or failed
   */
  public async waitForCaptchaResolution(
    driver: StealthCdpBrowserDriver,
    options: {
      maxWaitMs?: number;
      pollIntervalMs?: number;
      onPoll?: (elapsedSeconds: number, provider?: CaptchaProvider) => void;
    } = {}
  ): Promise<boolean> {
    const maxWaitMs = options.maxWaitMs || 15000;
    const pollIntervalMs = options.pollIntervalMs || 800;
    const start = Date.now();

    // Initial check
    const initialCheck = await this.detectCaptcha(driver);
    if (!initialCheck.hasCaptcha) {
      return true;
    }

    const provider = initialCheck.provider;

    // First: Attempt autonomous bypass for all solvable challenge providers
    const solvableProviders = [
      'Cloudflare Turnstile',
      'Cloudflare Interstitial',
      'Google reCAPTCHA',
      'hCaptcha',
      'AWS WAF CAPTCHA',
      'Generic Security Challenge',
      'Kasada',
      'PerimeterX HUMAN'
    ];
    if (provider && solvableProviders.includes(provider)) {
      const solved = await this.attemptAutonomousChallengeBypass(driver, (_msg) => {
        if (options.onPoll) {
          options.onPoll(Math.round((Date.now() - start) / 1000), provider);
        }
      });
      if (solved) {
        return true;
      }
    }

    // Fallback: Polling loop for manual or slower verification
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const elapsed = Math.round((Date.now() - start) / 1000);

      if (options.onPoll) {
        options.onPoll(elapsed, provider);
      }

      try {
        const check = await this.detectCaptcha(driver);
        if (!check.hasCaptcha) {
          await new Promise((r) => setTimeout(r, 1000));
          return true;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1200));
        const checkAfterNav = await this.detectCaptcha(driver);
        if (!checkAfterNav.hasCaptcha) {
          return true;
        }
      }
    }

    return false;
  }
}

export const captchaSentinelEngine = new CaptchaSentinelEngine();

/**
 * Sentinel Sovereign Ω - Honeypot & Anti-Bot Trap Defense Engine
 *
 * Provides comprehensive heuristic analysis to detect and neutralize:
 * 1. CSS/Geometry Honeypots (display:none, visibility:hidden, opacity:0, clip-path, negative coordinates)
 * 2. Off-screen Coordinate Traps (left: -9999px, text-indent: -9999px, zero-dimension boxes)
 * 3. Semantic & Form Honeypots (hidden decoy inputs, "leave blank" anti-bot lures)
 * 4. Structural Ancestor Concealment (elements nested inside hidden containers)
 * 5. Bot-Trap Link Names & Attributes (classes/IDs containing 'honeypot', 'bot-trap', 'fake_field')
 */

export interface HoneypotVerdict {
  isTrap: boolean;
  reason?: string;
  confidence: number; // 0.0 to 1.0
}

export class HoneypotDefenseEngine {
  /**
   * Generates a self-contained JavaScript snippet to be evaluated inside the Chrome V8
   * context via CDP. Returns boolean true if element is safe to click, or false if it's a trap.
   */
  public static getInBrowserHoneypotDetectorScript(): string {
    return `
      (function() {
        window.__SENTINEL_IS_HONEYPOT_OR_TRAP__ = function(el) {
          if (!el || !(el instanceof Element)) return { isTrap: true, reason: 'InvalidElement' };

          try {
            // 1. Tag & Class / ID / Name Heuristics
            const id = (el.id || '').toLowerCase();
            const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            const name = (el.getAttribute('name') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const textContent = (el.innerText || el.textContent || '').trim().toLowerCase();

            const trapTokens = [
              'honeypot', 'honey-pot', 'honey_pot',
              'bot-trap', 'bot_trap', 'bottrap',
              'fake-input', 'fake_field', 'decoy',
              'leave-blank', 'leaveblank', 'do-not-fill', 'donotfill',
              'nobot', 'no-bot', 'human-check-hidden'
            ];

            for (let i = 0; i < trapTokens.length; i++) {
              const token = trapTokens[i];
              if (id.includes(token) || className.includes(token) || name.includes(token)) {
                return { isTrap: true, reason: 'TrapTokenMatch: ' + token };
              }
            }

            // Deceptive text check ("leave empty", "do not click")
            if (
              textContent.includes('leave this field blank') ||
              textContent.includes('leave empty') ||
              textContent.includes('do not click') ||
              textContent.includes('bot trap')
            ) {
              return { isTrap: true, reason: 'DeceptiveTextTrap' };
            }

            // 2. Computed Style Inspection
            const style = window.getComputedStyle(el);
            if (!style) return { isTrap: false };

            if (style.display === 'none') {
              return { isTrap: true, reason: 'DisplayNone' };
            }

            if (style.visibility === 'hidden' || style.visibility === 'collapse') {
              return { isTrap: true, reason: 'VisibilityHidden' };
            }

            const opacity = parseFloat(style.opacity || '1');
            if (!isNaN(opacity) && opacity <= 0.02) {
              return { isTrap: true, reason: 'NearZeroOpacity: ' + opacity };
            }

            if (style.pointerEvents === 'none') {
              return { isTrap: true, reason: 'PointerEventsNone' };
            }

            const zIndex = parseInt(style.zIndex, 10);
            if (!isNaN(zIndex) && zIndex < -50) {
              return { isTrap: true, reason: 'DeepNegativeZIndex: ' + zIndex };
            }

            const textIndent = parseFloat(style.textIndent || '0');
            if (!isNaN(textIndent) && textIndent < -500) {
              return { isTrap: true, reason: 'ExtremeNegativeTextIndent' };
            }

            const fontSize = parseFloat(style.fontSize || '16');
            if (!isNaN(fontSize) && fontSize === 0) {
              return { isTrap: true, reason: 'ZeroFontSize' };
            }

            // Clip / Clip-path checks
            const clip = style.clip || '';
            if (clip.includes('rect(0px, 0px, 0px, 0px)') || clip.includes('rect(0, 0, 0, 0)') || clip.includes('rect(1px, 1px, 1px, 1px)')) {
              return { isTrap: true, reason: 'ClippingZeroRect' };
            }

            // 3. Geometry & Bounding Box Checks
            const rect = el.getBoundingClientRect();
            if (rect.width <= 1 && rect.height <= 1) {
              return { isTrap: true, reason: 'SubPixelDimensions: ' + rect.width + 'x' + rect.height };
            }

            // Offscreen coordinate check (e.g. left: -9999px)
            if (rect.right <= -50 || rect.bottom <= -50 || rect.left < -300 || rect.top < -300) {
              return { isTrap: true, reason: 'OffScreenCoordinates' };
            }

            // 4. Ancestor Visibility Walk
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 8) {
              const pStyle = window.getComputedStyle(parent);
              if (pStyle.display === 'none' || pStyle.visibility === 'hidden') {
                return { isTrap: true, reason: 'HiddenAncestor: ' + parent.tagName };
              }
              const pOpacity = parseFloat(pStyle.opacity || '1');
              if (!isNaN(pOpacity) && pOpacity <= 0.02) {
                return { isTrap: true, reason: 'TransparentAncestor: ' + parent.tagName };
              }
              const pClip = pStyle.clip || '';
              if (pClip.includes('rect(0px, 0px, 0px, 0px)') || pClip.includes('rect(0, 0, 0, 0)')) {
                return { isTrap: true, reason: 'ClippedAncestor' };
              }
              parent = parent.parentElement;
              depth++;
            }

            // 5. OffsetParent check (null indicates detached or display:none, except fixed elements)
            if (el.offsetParent === null && style.position !== 'fixed') {
              return { isTrap: true, reason: 'NullOffsetParent' };
            }

            return { isTrap: false };
          } catch (e) {
            return { isTrap: false };
          }
        };
      })();
    `;
  }

  /**
   * Evaluates if a given URL or candidate path resembles a honeypot trap based on static path analysis
   */
  public static isHoneypotUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();

    const urlTrapPatterns = [
      /\/honeypot(\/|$|\?)/i,
      /\/bot-trap(\/|$|\?)/i,
      /\/trap(\/|$|\?)/i,
      /\/crawler-trap(\/|$|\?)/i,
      /\/fake-login(\/|$|\?)/i,
      /\/spider-trap(\/|$|\?)/i,
      /\/blackhole(\/|$|\?)/i,
      /\/canary(\/|$|\?)/i,
      /[?&](hp|honeypot|bot_check|nobot)=/i
    ];

    return urlTrapPatterns.some((pattern) => pattern.test(lower));
  }
}

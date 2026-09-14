/**
 * Sentinel CSS Invisibility & Bot Honeypot Trap Detector
 *
 * Prevents IP bans and crawler entrapment by:
 * 1. Detecting invisible HTML links and inputs with inline CSS styling (display:none, visibility:hidden, opacity:0).
 * 2. Detecting off-screen positioned elements (left:-9999px, text-indent:-9999px, font-size:0).
 * 3. Detecting anti-bot trap attributes (aria-hidden="true", tabindex="-1", rel="nofollow", class="*honeypot*").
 */

export class HoneypotFilter {
  private static readonly INVISIBLE_STYLE_REGEXES = [
    /display\s*:\s*none/i,
    /visibility\s*:\s*hidden/i,
    /opacity\s*:\s*0(\b|\.)/i,
    /font-size\s*:\s*0(px|em|rem|pt|%)?/i,
    /left\s*:\s*-\d{3,}(px|em|%)?/i,
    /top\s*:\s*-\d{3,}(px|em|%)?/i,
    /text-indent\s*:\s*-\d{3,}(px|em|%)?/i,
    /clip\s*:\s*rect\s*\(0/i,
    /height\s*:\s*0(px)?\s*;\s*width\s*:\s*0/i,
  ];

  private static readonly HONEYPOT_CLASS_REGEX = /(honeypot|bot[-_]?trap|fake[-_]?link|decoy|hidden[-_]?link|trap[-_]?field)/i;
  private static readonly HONEYPOT_TEXT_REGEX = /(do not click|bot trap|leave blank|leave empty|ignore this)/i;

  /**
   * Checks if an HTML link element is an invisible honeypot trap.
   */
  public static isHoneypotLink(linkHtml: string, anchorText: string = ''): boolean {
    if (!linkHtml) return false;

    // 1. Check style attribute for invisibility
    const styleMatch = linkHtml.match(/style=["']([^"']+)["']/i);
    if (styleMatch) {
      const style = styleMatch[1];
      if (this.INVISIBLE_STYLE_REGEXES.some((rx) => rx.test(style))) {
        return true;
      }
    }

    // 2. Check HTML hidden / accessibility trap attributes
    if (/\bhidden\b/i.test(linkHtml)) return true;
    if (/aria-hidden=["']true["']/i.test(linkHtml) && /tabindex=["']-1["']/i.test(linkHtml)) return true;

    // 3. Check honeypot CSS class names or IDs
    const classOrIdMatch = linkHtml.match(/(?:class|id)=["']([^"']+)["']/i);
    if (classOrIdMatch && this.HONEYPOT_CLASS_REGEX.test(classOrIdMatch[1])) {
      return true;
    }

    // 4. Check anchor text warnings
    if (anchorText && this.HONEYPOT_TEXT_REGEX.test(anchorText)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if an HTML input field is an invisible honeypot trap.
   */
  public static isHoneypotInput(inputHtml: string): boolean {
    if (!inputHtml) return false;

    // 1. Check style attribute
    const styleMatch = inputHtml.match(/style=["']([^"']+)["']/i);
    if (styleMatch) {
      const style = styleMatch[1];
      if (this.INVISIBLE_STYLE_REGEXES.some((rx) => rx.test(style))) {
        return true;
      }
    }

    // 2. Check hidden attribute or honeypot class
    if (/\bhidden\b/i.test(inputHtml)) return true;
    const classMatch = inputHtml.match(/class=["']([^"']+)["']/i);
    if (classMatch && this.HONEYPOT_CLASS_REGEX.test(classMatch[1])) {
      return true;
    }

    // 3. Check trap input names (e.g. name="bot_honey", name="hp_field")
    const nameMatch = inputHtml.match(/name=["']([^"']+)["']/i);
    if (nameMatch && this.HONEYPOT_CLASS_REGEX.test(nameMatch[1])) {
      return true;
    }

    return false;
  }
}

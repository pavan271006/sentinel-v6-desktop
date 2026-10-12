/**
 * Sentinel Sovereign Ω - Destructive Action & Safety Kernel
 *
 * Implements strict non-destructive constraints for automated browser crawling
 * and DOM state exploration. Prevents session termination, state corruption,
 * accidental form submissions, and financial/administrative operations on
 * authenticated dashboards.
 */

// ─── Regular Expressions for Dangerous Targets ──────────────────────

/**
 * URLs that invalidate or destroy the current authentication session
 */
export const SESSION_TERMINATION_REGEX = /\b(?:logout|signout|sign-out|log-out|deauth|disconnect|session-kill)\b/i;

/**
 * Actions that perform irreversible deletions or cancellations
 */
export const DESTRUCTIVE_MUTATION_REGEX = /\b(?:delete-account|confirm-delete|wipe-all|destroy-data|reset-password)\b/i;

/**
 * Actions that commit transactions, trigger fee deductions, or financial transactions
 */
export const FINANCIAL_TRANSACTION_REGEX = /\b(?:pay-now|checkout|make-payment|process-payment|confirm-payment|wire-transfer)\b/i;

export const IRREVERSIBLE_SUBMISSION_REGEX = /\b(?:final-submit|confirm-delete|wipe-all|delete-account|terminate-session|destroy-data|format-drive|format-disk|nuke-all|cancel-subscription)\b/i;

/**
 * Outbound external domains, app store badges, and social media networks that cause session drift away from target
 */
export const EXTERNAL_TRAP_DOMAINS_REGEX = /(?:play\.google\.com|apps\.apple\.com|itunes\.apple\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|pinterest\.com|tiktok\.com|t\.me|whatsapp\.com)/i;

/**
 * Composite destructive regex matching any dangerous keyword
 */
export const ALL_DESTRUCTIVE_KEYWORDS_REGEX = new RegExp(
  [
    SESSION_TERMINATION_REGEX.source,
    DESTRUCTIVE_MUTATION_REGEX.source,
    FINANCIAL_TRANSACTION_REGEX.source,
    IRREVERSIBLE_SUBMISSION_REGEX.source,
  ].join('|'),
  'i'
);

export interface ElementInspectionData {
  tagName?: string;
  id?: string;
  className?: string;
  text?: string;
  ariaLabel?: string;
  title?: string;
  href?: string;
  action?: string;
  name?: string;
  role?: string;
  type?: string;
  dataUrl?: string;
}

export class DestructiveActionKernel {
  /**
   * Validates whether a URL or path is safe to navigate or crawl.
   * Returns FALSE if the URL matches session termination or destructive endpoints.
   */
  public static isSafeUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim().toLowerCase();

    if (EXTERNAL_TRAP_DOMAINS_REGEX.test(cleanUrl)) {
      return false;
    }

    // Check for javascript: pseudoprotocols that trigger destructive callbacks
    if (cleanUrl.startsWith('javascript:')) {
      return !ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(cleanUrl);
    }

    return !ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(cleanUrl);
  }

  /**
   * Deeply inspects an interactive DOM element's attributes and inner text
   * to ensure clicking it will not trigger an unsafe or destructive state.
   */
  public static isSafeElement(el: ElementInspectionData): boolean {
    if (!el) return false;

    // Check href attribute
    if (el.href && !this.isSafeUrl(el.href)) {
      return false;
    }

    // Check data-url / data-href attributes
    if (el.dataUrl && !this.isSafeUrl(el.dataUrl)) {
      return false;
    }

    // Check form action attribute
    if (el.action && !this.isSafeUrl(el.action)) {
      return false;
    }

    // Check text label content (e.g. "Logout", "Delete Course", "Pay Fee")
    if (el.text && ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(el.text.trim())) {
      return false;
    }

    // Check aria-label / title attributes
    if (el.ariaLabel && ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(el.ariaLabel)) {
      return false;
    }
    if (el.title && ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(el.title)) {
      return false;
    }

    // Check ID and class tokens
    if (el.id && ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(el.id)) {
      return false;
    }
    if (el.className && ALL_DESTRUCTIVE_KEYWORDS_REGEX.test(el.className)) {
      return false;
    }

    // Check submit buttons inside dangerous forms
    if (el.type === 'submit' && el.text && /(?:confirm-payment|pay-now|wipe-all|confirm-delete|delete-account)/i.test(el.text)) {
      // Disallow dangerous submit buttons that might commit mutations during exploratory crawling
      return false;
    }

    return true;
  }

  /**
   * Filters a list of URLs or paths, discarding any that violate safety constraints.
   */
  public static filterSafeUrls(urls: string[]): string[] {
    return urls.filter((u) => this.isSafeUrl(u));
  }
}

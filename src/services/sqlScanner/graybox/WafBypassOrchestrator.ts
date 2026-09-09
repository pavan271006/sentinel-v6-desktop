/**
 * Sentinel SQL X — WAF & Bot Mitigation Bypass Orchestrator
 * 
 * Boundary 3 Solution: Bot Mitigations & Hard Turnstile CAPTCHAs
 * 
 * Commercial WAFs (Cloudflare Turnstile, AWS WAF Bot Control, Akamai Bot Manager)
 * deploy JavaScript challenges, proof-of-work puzzles, and behavioral fingerprinting
 * that drop automated scanner traffic with 403 Forbidden or challenge interstitials.
 * 
 * In authorized enterprise testing, security teams configure testing bypass rules.
 * WafBypassOrchestrator manages:
 * 1. Dedicated authorized test bypass headers (CF-Access, X-Scanner-Bypass-Token, internal CIDR).
 * 2. Pre-warmed clearance cookies (cf_clearance, Turnstile session tokens).
 * 3. Detection of edge challenge tripwires and automatic credential rotation.
 */

import { BotBypassConfig } from '../../../types/sqlScanner';
import { GhostHttpRequest, GhostHttpResponse } from '../stealth/GhostNetwork';

export interface BotChallengeIndicator {
  isChallenge: boolean;
  gatewayType?: 'Cloudflare Turnstile' | 'AWS WAF Bot Control' | 'Akamai Bot Manager' | 'Generic WAF';
  reason?: string;
}

export class WafBypassOrchestrator {
  private config: BotBypassConfig;
  private activeHeaders: Record<string, string> = {};
  private activeCookies: Record<string, string> = {};

  constructor(config: BotBypassConfig) {
    this.config = config;
    if (config.bypassHeaders) {
      this.activeHeaders = { ...config.bypassHeaders };
    }
    if (config.clearanceCookies) {
      this.activeCookies = { ...config.clearanceCookies };
    }
  }

  /**
   * Registers or updates authorized test bypass headers (e.g., staging bypass tokens).
   */
  public setBypassHeader(name: string, value: string): void {
    this.activeHeaders[name] = value;
  }

  /**
   * Ingests a pre-warmed clearance cookie (e.g., cf_clearance obtained from authenticated browser session).
   */
  public setClearanceCookie(name: string, value: string): void {
    this.activeCookies[name] = value;
  }

  /**
   * Decorates an outgoing request with all configured bypass headers and clearance cookies.
   */
  public decorateRequest(request: GhostHttpRequest): GhostHttpRequest {
    if (!this.config.enabled) {
      return request;
    }

    const headers = { ...request.headers, ...this.activeHeaders };

    // Inject User-Agent profile if configured
    if (this.config.userAgentProfile) {
      headers['User-Agent'] = this.config.userAgentProfile;
    }

    // Merge clearance cookies into Cookie header
    if (Object.keys(this.activeCookies).length > 0) {
      const existingCookie = headers['Cookie'] || '';
      const cookieEntries = Object.entries(this.activeCookies).map(([k, v]) => `${k}=${v}`);
      const mergedCookies = existingCookie
        ? `${existingCookie}; ${cookieEntries.join('; ')}`
        : cookieEntries.join('; ');
      headers['Cookie'] = mergedCookies;
    }

    return {
      ...request,
      headers,
    };
  }

  /**
   * Inspects a server response to determine if it is a bot defense challenge or block page.
   */
  public evaluateResponseForChallenges(response: GhostHttpResponse): BotChallengeIndicator {
    const body = response.body.toLowerCase();
    const status = response.status;

    // 1. Cloudflare Turnstile / Challenge Interstitial
    if (
      status === 403 &&
      (body.includes('cf-turnstile') ||
        body.includes('challenge-form') ||
        body.includes('turnstile-wrapper') ||
        body.includes('checking your browser') ||
        body.includes('cloudflare ray id'))
    ) {
      return {
        isChallenge: true,
        gatewayType: 'Cloudflare Turnstile',
        reason: 'Cloudflare edge challenge page encountered. Requires valid cf_clearance cookie or bypass token.',
      };
    }

    // 2. AWS WAF Bot Control / Captcha
    if (
      (status === 405 || status === 403) &&
      (body.includes('awswaf') || body.includes('aws-waf-token') || body.includes('challenge-container'))
    ) {
      return {
        isChallenge: true,
        gatewayType: 'AWS WAF Bot Control',
        reason: 'AWS WAF challenge page encountered. Requires aws-waf-token or staging IP bypass.',
      };
    }

    // 3. Akamai Bot Manager
    if (status === 403 && (body.includes('akamai') || body.includes('access denied - akamai'))) {
      return {
        isChallenge: true,
        gatewayType: 'Akamai Bot Manager',
        reason: 'Akamai bot management restriction triggered.',
      };
    }

    // 4. Generic 403/429 Bot Block
    if ((status === 403 || status === 429) && (body.includes('bot detected') || body.includes('automated access'))) {
      return {
        isChallenge: true,
        gatewayType: 'Generic WAF',
        reason: 'Generic anti-automation filter triggered.',
      };
    }

    return {
      isChallenge: false,
    };
  }

  /**
   * Returns true if bypass credentials (headers or cookies) are actively configured.
   */
  public hasActiveCredentials(): boolean {
    return Object.keys(this.activeHeaders).length > 0 || Object.keys(this.activeCookies).length > 0;
  }
}

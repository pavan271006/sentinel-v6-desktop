/**
 * Sentinel Sovereign Ω - State-Flow Graph (SFG) Dynamic Crawler
 *
 * Implements a Crawljax-inspired Finite State Machine (FSM) crawler with
 * Full Runtime Introspection for Single-Page Applications (SPAs) and dashboards.
 *
 * Advanced Capabilities:
 * 1. Deep Shadow DOM & Iframe Piercing: Traverses open shadow roots and same-origin frames
 * 2. Framework Route Manifest Harvesting: Mines Next.js, React Router, Vue Router, Webpack/Vite chunks
 * 3. Client Storage & Global State Harvesting: Extracts API routes from localStorage, sessionStorage, window.CONFIG
 * 4. Interactive Dropdown Activation: Auto-selects <select> options to unlock dependent AJAX tables
 * 5. Deep Network Response Body Harvesting: Inspects raw JSON responses over CDP for embedded URLs & IDs
 * 6. Destructive Action Guarding: Strictly protects session and data using DestructiveActionKernel
 * 7. Authentic Human Interaction: Bézier spline mouse movement and natural dwell delays
 */

import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';
import { DestructiveActionKernel, ElementInspectionData } from './DestructiveActionKernel';
import { cognitiveFlowAgent } from './CognitiveFlowAgent';
import { clientRuntimeOmniscienceService } from './ClientRuntimeOmniscienceService';
import { groqService } from '../ai/GroqService';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { HoneypotDefenseEngine } from './HoneypotDefenseEngine';
import { captchaSentinelEngine } from './CaptchaSentinelEngine';
import { adaptivePacingEngine } from './AdaptivePacingEngine';
import { CrawlPatternRandomizer } from './CrawlPatternRandomizer';
import { pathTemplateClusterer } from './PathTemplateClusterer';
import { sourceMapRouteMiner, SourceMapDiscoveryResult } from './SourceMapRouteMiner';
import { sessionLivenessWatchdog } from './SessionLivenessWatchdog';
import { TargetSiteCrawler } from '../sqlScanner/crawler/TargetSiteCrawler';
import { decodeAndDecompressResponseBody } from '../../utils/decompressionUtils';
import { isWafChallenge } from './WafAndWildcardDetector';
import { multiSourceEndpointMiner } from './MultiSourceEndpointMiner';
import { endpointNormalizer } from './EndpointNormalizer';
import { infrastructureOriginService, InfrastructureReconReport } from './InfrastructureOriginService';
import { gauArchiveService, GauDiscoveredUrl } from './GauArchiveService';
import { sentinelAgentBridge, WebsiteKnowledgeBase } from './SentinelAgentBridge';
import { jsluiceMiningService, JSluiceDiscoveredEndpoint, JSluiceDiscoveredSecret } from './JSluiceMiningService';
import { robotsTxtDiscoveryService, RobotsTxtResult } from './RobotsTxtDiscoveryService';
import { idorAndHiddenEndpointHunter, IdorFinding } from './IdorAndHiddenEndpointHunter';
import { GraphQLEngine } from '../graphql/GraphQLEngine';
import { useReconStore } from '../../stores/reconStore';

export interface InteractiveElementDescriptor extends ElementInspectionData {
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  category: 'sidebar' | 'dropdown' | 'accordion' | 'tab' | 'button' | 'link' | 'data-route' | 'select';
  isSelect?: boolean;
  selectOptionValue?: string;
  isSidebar?: boolean;
  isDropdown?: boolean;
}

export interface RuntimeExtractedRoute {
  url: string;
  source: string;
  title?: string;
  notes?: string;
}

export interface SurfaceExtractionResult {
  forms: Array<{
    actionUrl: string;
    method: string;
    inputs: Array<{ name: string; type?: string; value?: string }>;
  }>;
  searchInputs: Array<{
    selector: string;
    id: string;
    name: string;
    placeholder: string;
    x: number;
    y: number;
  }>;
  accordions: InteractiveElementDescriptor[];
  dropdowns: InteractiveElementDescriptor[];
  tabs: InteractiveElementDescriptor[];
  selects: InteractiveElementDescriptor[];
  buttons: InteractiveElementDescriptor[];
  links: Array<{ url: string; text?: string; selector?: string; x?: number; y?: number }>;
  scripts: string[];
  inlineScriptBodies: string[];
  inlineRoutes: Array<{ url: string; source: string; title?: string }>;
  comments: string[];
}

export interface DfsExploreContext {
  targetHost: string;
  authenticatedRootUrl: string;
  isAlreadyOnHost: boolean;
  visitedPageUrls: Set<string>;
  activeStack: Set<string>;
  stateCounter: { count: number };
  paginationPatternCounts: Map<string, number>;
  maxStates: number;
  maxClicksPerState: number;
  maxDepth: number;
  interactionDelayMs: number;
  onProgress?: (visitedStates: number, totalDiscovered: number, currentAction: string) => void;
  onItemDiscovered?: (item: SiteMapRequest) => void;
  probedSearchSelectors?: Set<string>;
}

export interface StealthCrawlerConfig {
  targetHost: string;
  targetUrl: string;
  seedUrls?: string[];
  maxStates?: number;
  maxClicksPerState?: number;
  interactionDelayMs?: number;
  onProgress?: (visitedStates: number, totalDiscovered: number, currentAction: string) => void;
  onItemDiscovered?: (item: SiteMapRequest) => void;
}

export class StateFlowGraphCrawler {
  private isAborted = false;
  private visitedDomHashes = new Set<string>();
  private clickedSignatures = new Set<string>();
  private discoveredItemsMap = new Map<string, SiteMapRequest>();

  // 4-Pillar Attack Surface Knowledge Base Accumulators
  private collectedSourceMaps: SourceMapDiscoveryResult[] = [];
  private collectedLazyChunks = new Set<string>();
  private collectedServerActions: Array<{ path: string; method: string; source: string }> = [];
  private collectedRequestSchemas: Array<{ name: string; fields: string[]; sourceFile: string }> = [];
  private collectedSecrets: JSluiceDiscoveredSecret[] = [];
  private collectedAstEndpoints: JSluiceDiscoveredEndpoint[] = [];
  private collectedRouterRoutes: Array<{ url: string; source: string }> = [];
  private collectedOfflineStorage: Array<{ url: string; source: string; title?: string }> = [];
  private collectedDomForms: Array<{ actionUrl: string; method: string; inputs: string[] }> = [];
  private minedInlineScriptHashes = new Set<string>();

  public abort(): void {
    this.isAborted = true;
    stealthCdpBrowserDriver.disconnect();
  }

  /**
   * Generates a fast structural DOM hash (stripping volatile timestamps/counters)
   */
  public generateStructuralDomHash(domString: string): string {
    const normalized = domString
      .replace(/\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\d{2}:\d{2}:\d{2}/g, '')
      .replace(/\b\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let hash = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Intelligently detects and dynamically resolves anti-bot challenge interstitials
   * (Cloudflare Managed Challenge, Turnstile, wsidchk, etc.) using autonomous PoW wait
   * and authentic kinematic click dispatch.
   */
  /**
   * Intelligently detects and dynamically resolves anti-bot challenge interstitials
   * (Cloudflare, Google reCAPTCHA, hCaptcha, AWS WAF, GeeTest, PerimeterX, DataDome, Kasada, etc.)
   * using autonomous Proof-of-Work wait, kinematic click dispatch, and universal drift recovery.
   */
  private async waitForInterstitialToResolve(
    maxWaitMs: number = 25000,
    onProgress?: (msg: string) => void,
    targetUrl?: string
  ): Promise<void> {
    const start = Date.now();
    let bypassAttempted = false;
    let driftRecoveryCount = 0;

    while (Date.now() - start < maxWaitMs) {
      if (this.isAborted) return;
      try {
        // Universal drift detection: verify we haven't wandered off target host (e.g. ad redirects or external provider links)
        const currentLive = await stealthCdpBrowserDriver.getLiveUrl();
        if (targetUrl && currentLive && currentLive.startsWith('http') && !currentLive.startsWith('about:')) {
          const isChallengeDomain =
            currentLive.includes('challenges.cloudflare.com') ||
            currentLive.includes('cloudflare.com') ||
            currentLive.includes('recaptcha') ||
            currentLive.includes('hcaptcha') ||
            currentLive.includes('arkoselabs') ||
            currentLive.includes('geetest');

          if (!isChallengeDomain && !this.isSameTargetHost(currentLive, targetUrl)) {
            if (driftRecoveryCount++ < 2) {
              let liveHost = currentLive;
              try { liveHost = new URL(currentLive).hostname; } catch {}
              if (onProgress) onProgress(`[Anti-Bot Sentinel] Restoring session tab from external domain drift (${liveHost})...`);
              await stealthCdpBrowserDriver.navigate(targetUrl);
              await stealthCdpBrowserDriver.waitForDomSettle(1000);
              continue;
            }
          }
        }

        // 1. Comprehensive multi-provider anti-bot & crash recovery detection
        const detection = await captchaSentinelEngine.detectCaptcha(stealthCdpBrowserDriver);

        // 2. DOM verification text, crash text & token introspection
        const state = await stealthCdpBrowserDriver.evaluate<{
          isChallengeText: boolean;
          isAnomalyBlocked: boolean;
          hasToken: boolean;
          linksCount: number;
        }>(`
          (function() {
            const t = (document.title || '').toLowerCase();
            const body = (document.body ? document.body.innerText : '').slice(0, 1200).toLowerCase();
            const linksCount = document.querySelectorAll('a').length;
            const tokens = [
              document.querySelector('input[name="cf-turnstile-response"]')?.value,
              document.querySelector('textarea[name="g-recaptcha-response"]')?.value,
              document.querySelector('input[name="h-captcha-response"]')?.value
            ];
            const hasToken = tokens.some(tok => tok && tok.length > 20);

            const isChallengeText =
              t.includes('one moment') ||
              t.includes('just a moment') ||
              t.includes('attention required') ||
              t.includes('checking your browser') ||
              body.includes('performing security verification') ||
              body.includes('verifies you are not a bot') ||
              body.includes('checking your browser before accessing') ||
              document.querySelector('#challenge-running') !== null;

            const isAnomalyBlocked =
              body.includes('unusual activity') ||
              body.includes('access denied') ||
              body.includes('for security reasons') ||
              body.includes('out of memory') ||
              body.includes('this page is having a problem') ||
              t.includes('access denied');

            return {
              isChallengeText,
              isAnomalyBlocked,
              hasToken,
              linksCount
            };
          })()
        `);

        // Handle Access Denied / Unusual Activity / Out of Memory crash screen
        if (state?.isAnomalyBlocked) {
          if (onProgress) {
            onProgress('[Anti-Bot Sentinel] Detected Access Denied / Unusual Activity / Crash page. Initiating adaptive recovery...');
          }
          await stealthCdpBrowserDriver.recoverFromCrashOrError(targetUrl);
          await stealthCdpBrowserDriver.waitForDomSettle(1200);
          continue;
        }

        // Fast-path exit: If page has normal content and is not showing challenge text or anomaly screen, exit immediately (0ms)
        if (!state?.isChallengeText && !state?.isAnomalyBlocked) {
          if ((state?.linksCount || 0) >= 2 || state?.hasToken) {
            return;
          }
          if (!detection.hasCaptcha || !detection.isChallengeScreen) {
            return;
          }
        }

        const elapsed = Math.round((Date.now() - start) / 1000);
        const providerName = detection.provider || 'Security Verification';
        if (onProgress) {
          onProgress(`[Anti-Bot Sentinel] Resolving ${providerName} (${elapsed}s elapsed, Proof-of-Work active)...`);
        }

        // Trigger autonomous kinematic solving if challenge detected and not yet attempted
        if (!bypassAttempted && elapsed >= 1) {
          bypassAttempted = true;
          await captchaSentinelEngine.attemptAutonomousChallengeBypass(
            stealthCdpBrowserDriver,
            (msg) => { if (onProgress) onProgress(msg); }
          );
        }
      } catch {
        // Navigation or redirect in progress during challenge resolution
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      const pollDelay = maxWaitMs <= 8000 ? 150 : 400;
      await new Promise((r) => setTimeout(r, pollDelay));
    }
  }

  /**
   * Universal Anti-Bot, WAF & Rate-Limit Detection Engine.
   * Dynamically inspects the live page DOM, title, and body for defenses (Akamai, Cloudflare,
   * PerimeterX, Datadome, Kasada, AWS WAF, 403 Forbidden, 429 Too Many Requests).
   */
  public async detectDynamicBlock(
    _targetHost: string,
    _currentUrl: string
  ): Promise<{ isBlocked: boolean; reason?: string; isChallenge?: boolean; hasInteractiveRecovery?: boolean }> {
    try {
      return (await stealthCdpBrowserDriver.evaluate<{
        isBlocked: boolean;
        reason?: string;
        isChallenge?: boolean;
        hasInteractiveRecovery?: boolean;
      }>(`
        (function() {
          const t = (document.title || '').trim().toLowerCase();
          const b = (document.body ? document.body.innerText : '').slice(0, 3000).toLowerCase();
          const u = window.location.href.toLowerCase();
          const h = window.location.hostname.toLowerCase();

          // 1. Universal WAF Access Denied Signatures (Akamai, Cloudflare, Imperva, AWS WAF, etc.)
          const isWafAccessDenied = (t === 'access denied' || b.includes('access denied')) &&
            (b.includes('you don\'t have permission to access') || b.includes('reference #') || b.includes('error reference') || u.includes('/error') || u.includes('/blocked'));

          // 2. Universal Anti-Bot Challenge & Interstitial Throttle
          const isInterstitialScreen = !document.querySelector('main, article, #content, nav, footer, #root:not(:empty), #app:not(:empty)') ||
            document.querySelectorAll('a[href]').length < 4;

          const isAntiBotThrottle = isInterstitialScreen && (
            b.includes('unusual activity') ||
            b.includes('unusual traffic') ||
            b.includes('automated requests') ||
            b.includes('something went wrong') ||
            b.includes('security incident') ||
            b.includes('request blocked') ||
            b.includes('temporarily blocked') ||
            b.includes('rate limit exceeded')
          );

          // 3. Cloudflare Challenge / Turnstile / Cloudflare 1020/1015 (interstitial screen)
          const isCloudflareBlock = isInterstitialScreen && (
            t.includes('attention required') ||
            t.includes('just a moment') ||
            b.includes('checking your browser before accessing') ||
            b.includes('performing security verification') ||
            b.includes('verifying you are human') ||
            b.includes('sorry, you have been blocked') ||
            document.querySelector('#challenge-running') !== null ||
            document.querySelector('#challenge-stage') !== null
          );

          // 4. PerimeterX / HUMAN Security / Datadome
          const isPerimeterXOrDatadome = b.includes('press and hold') ||
            b.includes('datadome') ||
            b.includes('perimeterx') ||
            b.includes('automated requests') ||
            b.includes('unusual traffic from your computer network');

          // 5. Generic 403 Forbidden / 429 Too Many Requests
          const isForbidden = t.includes('403 forbidden') || b.includes('403 forbidden') || b.includes('403 - forbidden');
          const isRateLimited = t.includes('429') || b.includes('too many requests') || b.includes('rate limit exceeded') || b.includes('error 429');

          // Check for clickable recovery/refresh button on block screen
          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
          const hasInteractiveRecovery = buttons.some(el => {
            const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
            return text === 'refresh' || text === 'retry' || text === 'reload' || text === 'try again' || text.includes('press & hold') || text.includes('verify');
          });

          if (isWafAccessDenied) return { isBlocked: true, reason: 'WAF Access Denied (Reference #)', hasInteractiveRecovery };
          if (isAntiBotThrottle) return { isBlocked: true, reason: 'Anti-Bot Throttle / Interstitial Screen', hasInteractiveRecovery };
          if (isCloudflareBlock) return { isBlocked: true, reason: 'Cloudflare Verification Challenge', isChallenge: true, hasInteractiveRecovery };
          if (isPerimeterXOrDatadome) return { isBlocked: true, reason: 'PerimeterX / Datadome Bot Defense', hasInteractiveRecovery };
          if (isRateLimited) return { isBlocked: true, reason: 'HTTP 429 Too Many Requests', hasInteractiveRecovery };
          if (isForbidden) return { isBlocked: true, reason: 'HTTP 403 Forbidden Block', hasInteractiveRecovery };

          return { isBlocked: false, hasInteractiveRecovery };
        })()
      `)) || { isBlocked: false };
    } catch {
      return { isBlocked: false };
    }
  }

  /**
   * Autonomous Thinking & Dynamic Self-Adjustment Engine.
   * When target website blocks or throttles:
   * 1. Thinks & logs defensive response to user
   * 2. Dynamically scales up interaction delay and switches to high-stealth human cadence
   * 3. Performs biometric mouse movement & scrolling to break robotic behavior heuristics
   * 4. Cools down rate limiters (4s-8s pause)
   * 5. Retries navigation slowly and verifies if block is lifted
   */
  public async handleDynamicBlockAndSlowRetry(
    targetUrl: string,
    ctx: DfsExploreContext,
    _depth: number,
    initialReason: string
  ): Promise<boolean> {
    const report = (msg: string) => {
      if (ctx.onProgress) ctx.onProgress(ctx.stateCounter.count, this.discoveredItemsMap.size, msg);
    };

    report(`[Dynamic Anti-Block] 🛑 Target defense triggered on ${targetUrl} (${initialReason}). Thinking & adapting crawl strategy dynamically...`);

    // 1. Escalate host pacing to slow, human cadence across all future operations
    adaptivePacingEngine.triggerDynamicSlowdown(ctx.targetHost, initialReason, 6);

    // 2. Perform human-like biometric evasion actions in browser to break automated bot signature
    try {
      await stealthCdpBrowserDriver.dispatchHumanClick({ x: 250, y: 350, delayMs: 60 }).catch(() => {});
      await stealthCdpBrowserDriver.dispatchSmoothScroll(250).catch(() => {});
      await new Promise((r) => setTimeout(r, 600));
      await stealthCdpBrowserDriver.dispatchSmoothScroll(-150).catch(() => {});
    } catch {}

    // 3. Retry loop (up to 2 retries with increasing cooldown pauses)
    const retryDelays = process.env.NODE_ENV === 'test' ? [20, 50] : [5000, 9000];
    for (let attempt = 1; attempt <= retryDelays.length; attempt++) {
      if (this.isAborted) return false;
      const coolDown = retryDelays[attempt - 1];
      report(`[Dynamic Anti-Block] ⏳ Cooling down for ${Math.round(coolDown / 1000)}s (Attempt ${attempt}/${retryDelays.length}) to let rate-limiters clear...`);
      await new Promise((r) => setTimeout(r, coolDown));

      // Try to click any interactive recovery button (e.g. "Refresh", "Try Again", "Press & Hold")
      try {
        const clickedRecovery = await stealthCdpBrowserDriver.evaluate<boolean>(`
          (function() {
            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'));
            const retryBtn = buttons.find(el => {
              const text = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
              return text === 'refresh' || text === 'retry' || text === 'reload' || text === 'try again';
            });
            if (retryBtn) {
              retryBtn.click();
              return true;
            }
            return false;
          })()
        `);
        if (clickedRecovery) {
          report(`[Dynamic Anti-Block] Clicked recovery button. Waiting for page to reload...`);
          await stealthCdpBrowserDriver.waitForDomSettle(3000);
        } else {
          report(`[Dynamic Anti-Block] Retrying navigation to ${targetUrl} with slow human pacing...`);
          await stealthCdpBrowserDriver.navigate(targetUrl);
          await stealthCdpBrowserDriver.waitForDomSettle(3000);
        }
      } catch {
        try {
          await stealthCdpBrowserDriver.navigate(targetUrl);
          await stealthCdpBrowserDriver.waitForDomSettle(3000);
        } catch {}
      }

      // Check if Cloudflare / interstitial resolution is needed
      await this.waitForInterstitialToResolve(process.env.NODE_ENV === 'test' ? 100 : 15000, report, ctx.targetHost);
      await stealthCdpBrowserDriver.waitForDomSettle(1000);

      // Re-evaluate if block is still active
      const recheck = await this.detectDynamicBlock(ctx.targetHost, targetUrl);
      if (!recheck.isBlocked) {
        report(`[Dynamic Anti-Block] ✅ Success! Block lifted on ${targetUrl} after retry. Resuming crawl at adjusted slow pace.`);
        // Capture live page DOM
        const liveInfo = await stealthCdpBrowserDriver.evaluate<{ html: string; title: string; liveUrl: string }>(`
          (function() {
            return {
              html: document.documentElement ? document.documentElement.outerHTML : '',
              title: (document.title || '').trim(),
              liveUrl: window.location.href
            };
          })()
        `);
        if (liveInfo && liveInfo.html && liveInfo.html.length > 50) {
          this.updateOrRegisterVisitedPage(targetUrl, liveInfo.liveUrl, liveInfo.title, liveInfo.html, ctx);
        }
        return true; // Successfully unblocked!
      } else {
        report(`[Dynamic Anti-Block] ⚠️ Still throttled (${recheck.reason}). Increasing backoff...`);
        adaptivePacingEngine.triggerDynamicSlowdown(ctx.targetHost, recheck.reason || initialReason, 8);
      }
    }

    report(`[Dynamic Anti-Block] Defense remained active on ${targetUrl} after retries. Safely backtracking while maintaining slow stealth pace.`);
    return false;
  }

  /**
   * Dedicated Master Sidebar Traversal Phase for Authenticated Dashboards & Portals.
   * Systematically clicks every menu item, expands treeviews/accordions,
   * harvests all exposed AJAX endpoints & dynamic views, and recovers from any de-auth drift.
   */
  private async crawlMasterSidebar(
    targetHost: string,
    authenticatedRootUrl: string,
    onProgress?: (msg: string) => void,
    onItemDiscovered?: (item: SiteMapRequest) => void,
    interactionDelayMs: number = 800
  ): Promise<number> {
    const report = (msg: string) => {
      if (onProgress) onProgress(`[Sidebar Master] ${msg}`);
    };

    report('Inspecting master portal sidebar navigation structure...');

    // Extract all candidate sidebar items from the live DOM
    const sidebarElements = await stealthCdpBrowserDriver.evaluate<Array<{
      text: string;
      href: string;
      selector: string;
      id: string;
      className: string;
      isTreeview: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    }>>(`
      (function() {
        const sidebar = document.querySelector('aside.main-sidebar, .main-sidebar, .sidebar, .sidebar-menu, .nav-sidebar, aside, nav[role="navigation"], .left-side');
        if (!sidebar) return [];

        const items = [];
        const seen = new Set();
        const links = sidebar.querySelectorAll('a, li.nav-item, li.treeview > a, .nav-link, button');

        links.forEach((el) => {
          const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
          const href = el.getAttribute('href') || el.getAttribute('data-url') || '';
          const id = el.id || '';
          const className = typeof el.className === 'string' ? el.className : '';
          const rect = el.getBoundingClientRect();

          // Check if it's an accordion / treeview toggle
          const isTreeview = Boolean(
            className.includes('has-arrow') ||
            className.includes('treeview') ||
            className.includes('nav-dropdown') ||
            el.hasAttribute('aria-expanded') ||
            el.parentElement?.classList.contains('treeview') ||
            el.parentElement?.querySelector('.treeview-menu, .nav-treeview, ul') ||
            text.includes('<') || text.includes('>') || text.includes('▼')
          );

          const key = text + '|' + href + '|' + id;
          if (text && rect.width > 2 && rect.height > 2 && !seen.has(key)) {
            seen.add(key);
            items.push({
              text,
              href,
              selector: id ? '#' + id : (className ? '.' + className.split(' ')[0] : 'a'),
              id,
              className,
              isTreeview,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              width: rect.width,
              height: rect.height
            });
          }
        });

        return items;
      })()
    `) || [];

    if (sidebarElements.length === 0) {
      report('No dedicated master sidebar detected on this view.');
      return 0;
    }

    report(`Discovered ${sidebarElements.length} primary navigation items: ${sidebarElements.map(s => s.text).slice(0, 8).join(', ')}...`);

    let traversedCount = 0;

    for (let i = 0; i < sidebarElements.length; i++) {
      if (this.isAborted) break;
      const item = sidebarElements[i];

      // Safety check (skip Logout, Delete, etc.)
      if (!DestructiveActionKernel.isSafeElement({ text: item.text, href: item.href, id: item.id, className: item.className })) {
        continue;
      }

      const sig = `sidebar-master:${item.text}:${item.href}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      // Verify that the browser is currently displaying the sidebar; if not, restore to authenticated dashboard
      try {
        const hasSidebar = await stealthCdpBrowserDriver.evaluate<boolean>(`
          (function() {
            return document.querySelector('aside.main-sidebar, .main-sidebar, .sidebar, .sidebar-menu, .nav-sidebar') !== null;
          })()
        `);
        if (!hasSidebar && authenticatedRootUrl) {
          report(`Sidebar absent in current view. Restoring to dashboard ${authenticatedRootUrl}...`);
          await stealthCdpBrowserDriver.navigate(authenticatedRootUrl);
          await stealthCdpBrowserDriver.waitForDomSettle(1200);
        }
      } catch {}

      report(`[${i + 1}/${sidebarElements.length}] Traversing menu: "${item.text}"...`);

      // Frontier Anti-Bot Sentinel: Active Challenge Check
      try {
        const captchaCheck = await captchaSentinelEngine.detectCaptcha(stealthCdpBrowserDriver);
        if (captchaCheck.hasCaptcha) {
          report(`⚠️ Challenge Detected (${captchaCheck.provider || 'Security Check'}). Resolving challenge...`);
          await captchaSentinelEngine.waitForCaptchaResolution(stealthCdpBrowserDriver, {
            onPoll: (sec, prov) => report(`⏳ Resolving ${prov || 'Challenge'} (${sec}s elapsed)...`)
          });
        }
      } catch {}

      // Adaptive Pacing Governor with Biological Jitter
      await adaptivePacingEngine.pace(targetHost, (notice) => report(notice));

      try {
        const prevUrl = await stealthCdpBrowserDriver.getLiveUrl();

        // Physically click the sidebar item using authentic human mouse kinematics
        await stealthCdpBrowserDriver.clickElement({
          selector: item.selector,
          textMatch: item.text,
          hrefMatch: item.href,
          fallbackX: item.x,
          fallbackY: item.y
        });

        traversedCount++;
        await stealthCdpBrowserDriver.waitForDomSettle(interactionDelayMs);

        // Check for session drift / redirect to login or 403 Forbidden / error state
        const liveUrl = await stealthCdpBrowserDriver.getLiveUrl();
        const errorState = await stealthCdpBrowserDriver.evaluate<{ isError: boolean; reason: string }>(`
          (function() {
            const urlLower = window.location.href.toLowerCase();
            const t = (document.title || '').toLowerCase();
            const b = (document.body ? document.body.innerText : '').slice(0, 500).toLowerCase();

            const isDeauth = urlLower.includes('/login') || urlLower.includes('wssplashchk');
            const isForbidden = t.includes('forbidden') || t.includes('403') || b.includes('403 forbidden') || b.includes('403 |');
            const isNotFound = t.includes('404') || b.includes('404 not found');
            const isServerErr = t.includes('500') || b.includes('500 server error');

            if (isDeauth) return { isError: true, reason: 'De-auth redirect to login' };
            if (isForbidden) return { isError: true, reason: '403 Forbidden' };
            if (isNotFound) return { isError: true, reason: '404 Not Found' };
            if (isServerErr) return { isError: true, reason: '500 Server Error' };

            return { isError: false, reason: '' };
          })()
        `);

        if (errorState?.isError) {
          report(`⚠️ Access restriction (${errorState.reason}) on "${item.text}". Registering endpoint and restoring dashboard...`);
          if (liveUrl && DestructiveActionKernel.isSafeUrl(liveUrl)) {
            this.registerDiscoveredUrl(liveUrl, targetHost, prevUrl, `Sidebar-${errorState.reason.replace(/\s+/g, '')}`, item.text, onItemDiscovered, 'GET');
          }
          try {
            await stealthCdpBrowserDriver.evaluate('window.history.back()');
            await stealthCdpBrowserDriver.waitForDomSettle(1000);
            const recovered = await stealthCdpBrowserDriver.getLiveUrl();
            if ((recovered.includes('/login') || recovered.includes('show/') || errorState.isError) && authenticatedRootUrl) {
              await stealthCdpBrowserDriver.navigate(authenticatedRootUrl);
              await stealthCdpBrowserDriver.waitForDomSettle(1200);
            }
          } catch {}
          continue;
        }

        // Register the visited page URL
        if (liveUrl && liveUrl !== prevUrl && DestructiveActionKernel.isSafeUrl(liveUrl)) {
          this.registerDiscoveredUrl(liveUrl, targetHost, prevUrl, 'Sidebar-MasterNav', item.text, onItemDiscovered);
          try {
            const pageHtml = (await stealthCdpBrowserDriver.evaluate<string>('document.documentElement ? document.documentElement.outerHTML : ""')) || '';
            if (pageHtml && pageHtml.length > 50) {
              this.registerQualityResponseItem(
                liveUrl,
                targetHost,
                'GET',
                200,
                'OK',
                { 'content-type': 'text/html; charset=utf-8' },
                pageHtml,
                'text/html',
                undefined,
                onItemDiscovered
              );
            }
          } catch {}
        }

        // Drain trapped background API calls & AJAX requests from this view
        const trapped = await clientRuntimeOmniscienceService.drainTrappedRoutes();
        for (const tr of trapped) {
          this.registerDiscoveredUrl(tr.url, targetHost, liveUrl || targetHost, tr.source, `${tr.method} ${tr.url}`, onItemDiscovered, tr.method, tr.postData);
        }

        // If forms exist on this view (e.g. CAT Mark exam select, semester filter), solve them
        try {
          await cognitiveFlowAgent.discoverAndSolveAllForms(
            targetHost,
            liveUrl,
            (dis) => this.registerDiscoveredUrl(dis.url, targetHost, liveUrl, 'Cognitive-FormWorkflow', dis.title || dis.url, onItemDiscovered, dis.method),
            (msg) => report(msg)
          );
        } catch {}

        // If it was a treeview, harvest and enqueue newly revealed child links
        if (item.isTreeview) {
          await new Promise((r) => setTimeout(r, 400));
          const subLinks = await stealthCdpBrowserDriver.evaluate<Array<{ text: string; href: string; x: number; y: number }>>(`
            (function() {
              const res = [];
              const subItems = document.querySelectorAll('.treeview-menu a, .nav-treeview a, ul.show a, [aria-expanded="true"] + ul a');
              subItems.forEach(s => {
                const txt = (s.innerText || s.textContent || '').trim();
                const h = s.getAttribute('href') || '';
                const r = s.getBoundingClientRect();
                if (txt && r.width > 2 && r.height > 2) {
                  res.push({ text: txt, href: h, x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }
              });
              return res;
            })()
          `) || [];

          for (const sub of subLinks) {
            if (DestructiveActionKernel.isSafeElement({ text: sub.text, href: sub.href })) {
              const subSig = `sidebar-sub:${sub.text}:${sub.href}`;
              if (!this.clickedSignatures.has(subSig)) {
                this.clickedSignatures.add(subSig);
                report(`Clicking submenu item: "${sub.text}"...`);
                try {
                  await stealthCdpBrowserDriver.clickElement({ fallbackX: sub.x, fallbackY: sub.y, textMatch: sub.text });
                  await stealthCdpBrowserDriver.waitForDomSettle(interactionDelayMs);
                  const subLive = await stealthCdpBrowserDriver.getLiveUrl();
                  if (subLive && !subLive.includes('/login') && DestructiveActionKernel.isSafeUrl(subLive)) {
                    this.registerDiscoveredUrl(subLive, targetHost, liveUrl, 'Sidebar-Submenu', sub.text, onItemDiscovered);
                    try {
                      const subPageHtml = (await stealthCdpBrowserDriver.evaluate<string>('document.documentElement ? document.documentElement.outerHTML : ""')) || '';
                      if (subPageHtml && subPageHtml.length > 50) {
                        this.registerQualityResponseItem(
                          subLive,
                          targetHost,
                          'GET',
                          200,
                          'OK',
                          { 'content-type': 'text/html; charset=utf-8' },
                          subPageHtml,
                          'text/html',
                          undefined,
                          onItemDiscovered
                        );
                      }
                    } catch {}
                  }
                } catch {}
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Sidebar item error on ${item.text}:`, err);
      }
    }

    report(`Completed master sidebar traversal. Traversed ${traversedCount} primary sections.`);
    return traversedCount;
  }

  /**
   * Ingests a discovered URL into the SiteMap
   */
  private registerDiscoveredUrl(
    rawUrl: string,
    targetHost: string,
    currentUrl: string,
    sourceTag: string,
    title?: string,
    onItemDiscovered?: (item: SiteMapRequest) => void,
    method: string = 'GET',
    postData?: string,
    formInputs?: Array<{ name: string; type?: string; value?: string }>
  ): void {
    if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('data:') || rawUrl.startsWith('mailto:')) return;
    if (this.isTelemetryOrNoiseUrl(rawUrl)) return;

    // Filter out purely static styling and media assets (CSS, images, fonts, audio, video)
    const cleanExt = rawUrl.split('?')[0].split('#')[0].toLowerCase().split('.').pop();
    const staticFilterExts = new Set([
      'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'avif',
      'woff', 'woff2', 'ttf', 'eot', 'otf',
      'mp4', 'webm', 'mp3', 'wav',
      'map', 'pdf', 'zip', 'tar', 'gz'
    ]);
    if (cleanExt && staticFilterExts.has(cleanExt)) {
      return;
    }

    try {
      const canonUrl = this.canonicalizeUrl(rawUrl);
      let parsed: URL;
      if (canonUrl.startsWith('http://') || canonUrl.startsWith('https://')) {
        parsed = new URL(canonUrl);
      } else {
        parsed = new URL(canonUrl.startsWith('/') ? canonUrl : '/' + canonUrl, currentUrl);
      }

      const hostMatches = this.isSameTargetHost(parsed.host, targetHost);

      if (hostMatches) {
        const cleanPath = parsed.pathname + parsed.search;
        const normMethod = (method || 'GET').toUpperCase();
        const key = `${normMethod}:${parsed.host}${cleanPath}`;
        if (!this.discoveredItemsMap.has(key)) {
          let reqRaw = `${normMethod} ${cleanPath} HTTP/1.1\r\n` +
            `Host: ${parsed.host}\r\n` +
            `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\r\n` +
            `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\n` +
            `Accept-Language: en-US,en;q=0.9\r\n` +
            `Sec-Ch-Ua: "Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"\r\n` +
            `Sec-Fetch-Dest: document\r\n` +
            `Sec-Fetch-Mode: navigate\r\n` +
            `Sec-Fetch-Site: same-origin\r\n` +
            `Connection: keep-alive\r\n`;

          let length = 0;
          if (postData) {
            length = postData.length;
            reqRaw += `Content-Type: application/x-www-form-urlencoded\r\nContent-Length: ${length}\r\n\r\n${postData}`;
          } else if (formInputs && formInputs.length > 0) {
            const body = formInputs.map((i) => `${encodeURIComponent(i.name)}=${encodeURIComponent(i.value || 'test')}`).join('&');
            length = body.length;
            reqRaw += `Content-Type: application/x-www-form-urlencoded\r\nContent-Length: ${length}\r\n\r\n${body}`;
          } else {
            reqRaw += `\r\n`;
          }

          const hasParams = parsed.search.length > 0 || (formInputs && formInputs.length > 0) || Boolean(postData);

          const item: SiteMapRequest = {
            id: `stealth-${sourceTag.toLowerCase()}-${parsed.host}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-${normMethod}`,
            host: parsed.host,
            method: normMethod,
            url: cleanPath,
            path: cleanPath,
            params: hasParams,
            status: 0,
            length: 0,
            mime: cleanPath.endsWith('.js') ? 'script' : cleanPath.endsWith('.json') ? 'JSON' : 'HTML',
            title: title || cleanPath,
            notes: `Discovered by Sovereign Stealth (${sourceTag}) [${normMethod}]`,
            requestRaw: reqRaw,
            responseRaw: `HTTP/1.1 0 Unrequested\r\n\r\n(Discovered via ${sourceTag} — click '⚡ Request item' to fetch live response from server)`,
            reqAttributes: { Method: normMethod, Path: cleanPath, Source: sourceTag },
            reqHeaders: { Host: parsed.host },
            resAttributes: { Status: '0 (Unrequested)', Source: sourceTag },
            resHeaders: {},
            isDiscovered: true,
          };
          this.discoveredItemsMap.set(key, item);
          if (onItemDiscovered) onItemDiscovered(item);
        }
      }
    } catch {}
  }

  /**
   * Registers an authoritative endpoint backed by a real live HTTP server response.
   * Strictly enforces data quality: suppresses 404s, WAF challenges, empty unrequested placeholders, and telemetry.
   */
  public registerQualityResponseItem(
    url: string,
    targetHost: string,
    method: string,
    status: number,
    statusText: string,
    headers: Record<string, string>,
    body: string,
    mimeType?: string,
    postData?: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): void {
    if (!url) return;
    if (this.isTelemetryOrNoiseUrl(url)) return;
    if (this.isStaticAssetUrl(url)) return;
    if (status === 404) return;
    if (TargetSiteCrawler.isNotFoundResponse(status, body)) return;
    if (TargetSiteCrawler.isChallengeOrWafResponse(status, body)) return;

    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (!this.isSameTargetHost(u.host, targetHost)) return;

      const normMethod = (method || 'GET').toUpperCase();
      const cleanPath = u.pathname + u.search;
      const key = `${normMethod}:${u.host}${cleanPath}`;

      const existing = this.discoveredItemsMap.get(key);
      const headerLines = Object.entries(headers || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');

      let reqRaw = `${normMethod} ${cleanPath} HTTP/1.1\r\n` +
        `Host: ${u.host}\r\n` +
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\r\n` +
        `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\n` +
        `Sec-Fetch-Site: same-origin\r\n` +
        `Connection: keep-alive\r\n`;

      if (postData) {
        reqRaw += `Content-Type: application/x-www-form-urlencoded\r\nContent-Length: ${postData.length}\r\n\r\n${postData}`;
      } else {
        reqRaw += `\r\n`;
      }

      const truncatedBody = body && body.length > 65536 ? body.slice(0, 65536) + '\n... [truncated for memory]' : (body || '');
      const resRaw = `HTTP/1.1 ${status} ${statusText || 'OK'}\r\n` +
        (headerLines ? `${headerLines}\r\n` : '') +
        `\r\n${truncatedBody}`;

      const resolvedMime = mimeType?.includes('json')
        ? 'JSON'
        : mimeType?.includes('javascript') || cleanPath.endsWith('.js')
        ? 'script'
        : mimeType?.includes('xml')
        ? 'XML'
        : 'HTML';

      const item: SiteMapRequest = {
        id: existing?.id || `stealth-live-${u.host}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-${normMethod}`,
        host: u.host,
        method: normMethod,
        url: cleanPath,
        path: cleanPath,
        params: cleanPath.includes('?') || Boolean(postData),
        status,
        length: body ? body.length : 0,
        mime: resolvedMime,
        title: cleanPath,
        notes: `Authoritative Live Response (${status} ${statusText || 'OK'})`,
        requestRaw: reqRaw,
        responseRaw: resRaw,
        reqAttributes: { Method: normMethod, Path: cleanPath, Source: 'Live-CDP' },
        reqHeaders: { Host: u.host },
        resAttributes: { Status: `${status} ${statusText || 'OK'}`, Size: `${body ? body.length : 0} bytes`, Source: 'Live Server Response' },
        resHeaders: headers || {},
        isDiscovered: true,
      };

      this.discoveredItemsMap.set(key, item);
      if (onItemDiscovered) onItemDiscovered(item);

      // Passively mine headers, JSON HATEOAS links, OpenAPI/OIDC specs, and JS bundles from live response
      const fullUrl = u.toString();
      this.mineResponseBodyAndHeadersForSurface(
        fullUrl,
        cleanPath,
        targetHost,
        headers || {},
        body || '',
        resolvedMime,
        onItemDiscovered
      );
    } catch {}
  }

  /**
   * Ingests a SourceMapDiscoveryResult into the crawler's 4-Pillar Knowledge Base accumulators
   */
  public ingestSourceMapResult(
    res: SourceMapDiscoveryResult | null,
    targetHost: string,
    currentUrl: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): void {
    if (!res) return;

    if (!this.collectedSourceMaps.some((m) => m.scriptUrl === res.scriptUrl)) {
      this.collectedSourceMaps.push(res);
    }

    for (const r of res.extractedRoutes || []) {
      this.registerDiscoveredUrl(
        r.url,
        targetHost,
        currentUrl,
        res.sourceMapUrl ? 'SourceMap-Route' : 'Bundle-AST-Route',
        `${r.method} ${r.url}`,
        onItemDiscovered,
        r.method || 'GET',
        undefined,
        r.params ? r.params.map((p) => ({ name: p, value: '1' })) : undefined
      );
      if (!this.collectedAstEndpoints.some((e) => e.path === r.url && e.method === r.method)) {
        this.collectedAstEndpoints.push({
          url: r.url,
          path: r.url,
          method: (r.method || 'GET') as any,
          params: r.params || [],
          sourceScript: r.sourceFile || res.scriptUrl,
          category: r.url.includes('graphql') ? 'GraphQL' : r.url.startsWith('/api') ? 'API' : 'Route',
        });
      }
    }

    for (const sa of res.nextServerActions || []) {
      if (!this.collectedServerActions.some((a) => a.path === sa.url)) {
        this.collectedServerActions.push({
          path: sa.url,
          method: sa.method || 'POST',
          source: sa.sourceFile || res.scriptUrl,
        });
      }
    }

    for (const sc of res.extractedSchemas || []) {
      if (!this.collectedRequestSchemas.some((s) => s.name === sc.name && s.sourceFile === sc.sourceFile)) {
        this.collectedRequestSchemas.push(sc);
      }
    }

    for (const sec of res.extractedSecrets || []) {
      if (!this.collectedSecrets.some((s) => s.value === sec.value)) {
        this.collectedSecrets.push({
          type: sec.type,
          value: sec.value,
          sourceScript: sec.sourceFile || res.scriptUrl,
          snippet: `Extracted from ${sec.sourceFile || res.scriptUrl}`,
        });
      }
    }

    for (const chunkUrl of res.synthesizedLazyChunks || []) {
      if (!this.collectedLazyChunks.has(chunkUrl)) {
        this.collectedLazyChunks.add(chunkUrl);
        this.registerDiscoveredUrl(chunkUrl, targetHost, currentUrl, 'Synthesized-LazyChunk', chunkUrl, onItemDiscovered);
      }
    }
  }

  /**
   * Parses inline or network-captured JS script content for AST endpoints, Server Actions, schemas, secrets, and lazy chunks
   */
  public ingestScriptContentIntelligence(
    scriptIdentifier: string,
    scriptContent: string,
    targetHost: string,
    currentUrl: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): void {
    if (!scriptContent || scriptContent.length < 25) return;
    const contentHash = `${scriptIdentifier}:${scriptContent.length}:${scriptContent.slice(0, 64)}`;
    if (this.minedInlineScriptHashes.has(contentHash)) return;
    this.minedInlineScriptHashes.add(contentHash);

    try {
      const cleanHost = targetHost.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      const jsluiceRes = jsluiceMiningService.parseScriptContent(scriptContent, scriptIdentifier, cleanHost);
      const schemas = sourceMapRouteMiner.extractSchemasFromSource(scriptContent, scriptIdentifier);
      const lazyChunks = jsluiceMiningService.synthesizeUnloadedChunkUrls(scriptContent, `https://${cleanHost}`);

      for (const ep of jsluiceRes.endpoints) {
        const cleanPath = ep.path.startsWith('/') ? ep.path : '/' + ep.path;
        this.registerDiscoveredUrl(
          cleanPath,
          targetHost,
          currentUrl,
          'Inline-AST-Route',
          `${ep.method} ${cleanPath}`,
          onItemDiscovered,
          ep.method || 'GET',
          undefined,
          ep.params.map((p) => ({ name: p, value: '1' }))
        );
        if (!this.collectedAstEndpoints.some((e) => e.path === cleanPath && e.method === ep.method)) {
          this.collectedAstEndpoints.push(ep);
        }
        if (cleanPath.startsWith('/_next/action/')) {
          if (!this.collectedServerActions.some((a) => a.path === cleanPath)) {
            this.collectedServerActions.push({
              path: cleanPath,
              method: ep.method || 'POST',
              source: scriptIdentifier,
            });
          }
        }
      }

      for (const sec of jsluiceRes.secrets) {
        if (!this.collectedSecrets.some((s) => s.value === sec.value)) {
          this.collectedSecrets.push(sec);
        }
      }

      for (const sc of schemas) {
        if (!this.collectedRequestSchemas.some((s) => s.name === sc.name && s.sourceFile === sc.sourceFile)) {
          this.collectedRequestSchemas.push(sc);
        }
      }

      for (const chunkUrl of lazyChunks) {
        if (!this.collectedLazyChunks.has(chunkUrl)) {
          this.collectedLazyChunks.add(chunkUrl);
          this.registerDiscoveredUrl(chunkUrl, targetHost, currentUrl, 'Synthesized-LazyChunk', chunkUrl, onItemDiscovered);
        }
      }
    } catch {}
  }

  /**
   * Passively mines HTTP response headers (Link, CSP, Location, SourceMap) and JSON/Spec response bodies
   * for hidden API routes, HATEOAS links, OpenAPI/OIDC definitions, and unloaded bundle chunks.
   */
  public mineResponseBodyAndHeadersForSurface(
    fullUrl: string,
    cleanPath: string,
    targetHost: string,
    headers: Record<string, string>,
    body: string,
    resolvedMime: string,
    onItemDiscovered?: (item: SiteMapRequest) => void
  ): void {
    try {
      // 1. Response Header Mining (Link, Location, Rewrite, CSP report-uri & connect-src)
      for (const [rawKey, rawVal] of Object.entries(headers || {})) {
        if (!rawVal || typeof rawVal !== 'string') continue;
        const hKey = rawKey.toLowerCase();

        if (hKey === 'link') {
          const linkMatches = rawVal.matchAll(/<([^>]+)>/g);
          for (const m of linkMatches) {
            if (m[1]) {
              this.registerDiscoveredUrl(m[1], targetHost, fullUrl, 'Header-Link', `Link: ${m[1]}`, onItemDiscovered);
            }
          }
        } else if (hKey === 'location' || hKey === 'x-original-url' || hKey === 'x-rewrite-url' || hKey === 'content-location') {
          this.registerDiscoveredUrl(rawVal.trim(), targetHost, fullUrl, `Header-${rawKey}`, `${rawKey}: ${rawVal.trim()}`, onItemDiscovered);
        } else if (hKey === 'content-security-policy' || hKey === 'content-security-policy-report-only') {
          const reportUriMatch = /report-uri\s+([^\s;]+)/i.exec(rawVal);
          if (reportUriMatch && reportUriMatch[1]) {
            this.registerDiscoveredUrl(reportUriMatch[1], targetHost, fullUrl, 'Header-CSP-ReportUri', reportUriMatch[1], onItemDiscovered, 'POST');
          }
          const urlMatches = rawVal.matchAll(/https?:\/\/[a-zA-Z0-9.\-_:/]+/g);
          for (const um of urlMatches) {
            if (um[0] && this.isSameTargetHost(um[0], targetHost)) {
              this.registerDiscoveredUrl(um[0], targetHost, fullUrl, 'Header-CSP-Origin', um[0], onItemDiscovered);
            }
          }
        }
      }

      if (!body || body.length < 2) return;

      // 2. Live JavaScript Bundle Content Intelligence
      if (resolvedMime === 'script' || cleanPath.endsWith('.js') || cleanPath.endsWith('.mjs')) {
        this.ingestScriptContentIntelligence(fullUrl, body, targetHost, fullUrl, onItemDiscovered);
        return;
      }

      // 3. OpenAPI / Swagger / OIDC / Universal Links / SPA Build Manifest Unpacking
      const trimmed = body.trim();
      const isJsonLike = resolvedMime === 'JSON' || trimmed.startsWith('{') || trimmed.startsWith('[');
      if (isJsonLike) {
        const lowerPath = cleanPath.toLowerCase();
        const isSpecCandidate =
          lowerPath.includes('swagger') ||
          lowerPath.includes('openapi') ||
          lowerPath.includes('api-docs') ||
          lowerPath.includes('well-known') ||
          lowerPath.includes('manifest') ||
          lowerPath.includes('ngsw') ||
          lowerPath.includes('assetlinks') ||
          lowerPath.includes('apple-app-site-association') ||
          trimmed.includes('"openapi"') ||
          trimmed.includes('"swagger"') ||
          trimmed.includes('"authorization_endpoint"') ||
          trimmed.includes('"applinks"');

        if (isSpecCandidate) {
          const specRes = sourceMapRouteMiner.parseApiSpecificationOrManifest(cleanPath, trimmed, targetHost, (specItem) => {
            const specKey = `${specItem.method}:${specItem.host}${specItem.path}`;
            if (!this.discoveredItemsMap.has(specKey)) {
              this.discoveredItemsMap.set(specKey, specItem);
              if (onItemDiscovered) onItemDiscovered(specItem);
            }
          });
          for (const sc of specRes.extractedSchemas) {
            if (!this.collectedRequestSchemas.some((s) => s.name === sc.name && s.sourceFile === sc.sourceFile)) {
              this.collectedRequestSchemas.push(sc);
            }
          }
          for (const chunkUrl of specRes.discoveredChunkUrls) {
            if (!this.collectedLazyChunks.has(chunkUrl)) {
              this.collectedLazyChunks.add(chunkUrl);
              this.registerDiscoveredUrl(chunkUrl, targetHost, fullUrl, 'Manifest-Chunk', chunkUrl, onItemDiscovered);
            }
          }
        }

        // 4. General JSON API Response HATEOAS & Embedded Route Extraction
        let extractedCount = 0;
        const hateoasRegex = /"(?:url|href|uri|endpoint|path|next|prev|self|callback_url|redirect_uri|action|webhook|next_page_url)"\s*:\s*"((?:https?:\/\/[^"'\s]+|\/[a-zA-Z0-9_\-./?=&%]+))"/gi;
        let hMatch: RegExpExecArray | null;
        while ((hMatch = hateoasRegex.exec(trimmed)) !== null && extractedCount < 35) {
          if (hMatch[1] && hMatch[1].length > 1) {
            this.registerDiscoveredUrl(hMatch[1], targetHost, fullUrl, 'JSON-HATEOAS', `JSON Link: ${hMatch[1]}`, onItemDiscovered);
            extractedCount++;
          }
        }

        const apiPathRegex = /"(\/(?:api|v[1-9]|graphql|gql|rest|internal|admin|oauth|auth|webhooks?|rpc|trpc)\/[a-zA-Z0-9_\-./?=&%]*)"/g;
        let aMatch: RegExpExecArray | null;
        while ((aMatch = apiPathRegex.exec(trimmed)) !== null && extractedCount < 50) {
          if (aMatch[1] && aMatch[1].length > 2) {
            this.registerDiscoveredUrl(aMatch[1], targetHost, fullUrl, 'JSON-Body-Route', `JSON API: ${aMatch[1]}`, onItemDiscovered);
            extractedCount++;
          }
        }
      }
    } catch {}
  }

  /**
   * Resolves any discovered endpoint that hasn't received a live response yet (status === 0).
   * Runs using the browser's own session context, guaranteeing authentic
   * status codes, real response headers, and clean decompressed body with a working render.
   * Discards 404s and dead noise so 100% of sitemap items have genuine responses.
   */
  public async resolveUnrequestedDiscoveredItems(
    targetHost: string,
    onProgress?: (msg: string) => void,
    onItemDiscovered?: (item: SiteMapRequest) => void,
    maxToResolve: number = 75
  ): Promise<number> {
    const unrequestedItems = Array.from(this.discoveredItemsMap.values()).filter(
      (item) => item.status === 0 || item.responseRaw.includes('Unrequested')
    );

    if (unrequestedItems.length === 0) return 0;

    const cappedLimit = Math.min(maxToResolve, 35);
    if (onProgress) {
      onProgress(`Resolving authentic live responses for ${Math.min(unrequestedItems.length, cappedLimit)} endpoints...`);
    }

    let resolvedCount = 0;
    for (const item of unrequestedItems.slice(0, cappedLimit)) {
      if (this.isAborted) break;
      await adaptivePacingEngine.pace(targetHost);
      const fullUrl = item.url.startsWith('http') ? item.url : `https://${targetHost}${item.path || item.url}`;

      try {
        let res = await stealthCdpBrowserDriver.fetchInBrowserDetails(fullUrl);
        if (res && res.status > 0) {
          // If response indicates rate limiting or WAF block, dynamically backoff and retry slowly
          const isThrottled = res.status === 429 || res.status === 403 || res.body.toLowerCase().includes('access denied') || isWafChallenge(res.body).isWaf;
          if (isThrottled) {
            adaptivePacingEngine.triggerDynamicSlowdown(targetHost, `In-Browser Fetch Throttle (${res.status})`, 4);
            await new Promise((r) => setTimeout(r, 3500));
            // Slow retry
            const retryRes = await stealthCdpBrowserDriver.fetchInBrowserDetails(fullUrl);
            if (retryRes && retryRes.status >= 200 && retryRes.status < 400 && !retryRes.body.toLowerCase().includes('access denied')) {
              res = retryRes;
            }
          }

          if (res.status === 404 || TargetSiteCrawler.isNotFoundResponse(res.status, res.body)) {
            // Suppress 404s to ensure only genuine working data is presented
            this.discoveredItemsMap.delete(`${item.method}:${item.host}${item.path}`);
            continue;
          }

          const mimeType = res.headers['content-type'] || item.mime;
          this.registerQualityResponseItem(
            fullUrl,
            targetHost,
            item.method,
            res.status,
            res.statusText,
            res.headers,
            res.body,
            mimeType,
            undefined,
            onItemDiscovered
          );
          resolvedCount++;
        }
      } catch {}
    }

    if (onProgress) {
      onProgress(`Successfully resolved authentic responses and renders for ${resolvedCount} endpoints.`);
    }
    return resolvedCount;
  }

  /**
   * Helper to identify telemetry, analytics, ad networks, and tracking noise
   */
  public isTelemetryOrNoiseUrl(rawUrl: string): boolean {
    if (!rawUrl || typeof rawUrl !== 'string') return true;
    const lower = rawUrl.toLowerCase();

    // Protocol checks
    if (
      lower.startsWith('data:') ||
      lower.startsWith('blob:') ||
      lower.startsWith('javascript:') ||
      lower.startsWith('mailto:') ||
      lower.startsWith('tel:') ||
      lower.startsWith('whatsapp:') ||
      lower.startsWith('about:') ||
      lower.startsWith('wss:')
    ) {
      return true;
    }

    // Universal telemetry, beacon, collector, logging subdomain heuristics (applies to any website)
    try {
      const parsed = new URL(rawUrl);
      const telemetryHostRegex = /(^|\.)(telemetry|beacon|analytics|metrics|rum|collector|track|tracker|events|stats|ping|log|logging|telemetry-.*|aerith)\./i;
      if (telemetryHostRegex.test(parsed.hostname)) {
        return true;
      }
    } catch {}

    // Third-party telemetry, ad & crash tracking networks
    if (
      lower.includes('amazon-adsystem.com') ||
      lower.includes('google-analytics.com') ||
      lower.includes('googletagmanager.com') ||
      lower.includes('doubleclick.net') ||
      lower.includes('criteo.com') ||
      lower.includes('facebook.net') ||
      lower.includes('facebook.com/tr') ||
      lower.includes('bat.bing.com') ||
      lower.includes('hotjar.com') ||
      lower.includes('clarity.ms') ||
      lower.includes('segment.io') ||
      lower.includes('sentry.io') ||
      lower.includes('datadoghq.com') ||
      lower.includes('newrelic.com') ||
      lower.includes('nr-data.net') ||
      lower.includes('mixpanel.com') ||
      lower.includes('amplitude.com') ||
      lower.includes('app-measurement.com') ||
      lower.includes('scorecardresearch.com')
    ) {
      return true;
    }

    // Telemetry paths & noise patterns
    if (
      lower.includes('/telemetry') ||
      lower.includes('/beacon') ||
      lower.includes('/1/events/') ||
      lower.includes('/1/batch/') ||
      lower.includes('/pixel') ||
      lower.includes('/collect?') ||
      lower.includes('/metrics/') ||
      lower.includes('/csp-report') ||
      lower.includes('/analytics') ||
      lower.includes('/api/2017/suggestions') ||
      lower.includes('/ad-service/') ||
      lower.includes('/rum/') ||
      lower.includes('/cdn-cgi/rum') ||
      lower.includes('/cdn-cgi/challenge-platform') ||
      lower.includes('/cdn-cgi/perf') ||
      lower.includes('/web-vitals') ||
      lower.includes('/browser-metrics') ||
      lower.includes('/client-telemetry') ||
      lower.includes('/error-logger') ||
      lower.includes('/log-collector') ||
      lower.includes('/searchsuggestion') ||
      lower.includes('/autocomplete') ||
      lower.includes('/autosuggest') ||
      lower.includes('/suggestions?') ||
      lower.includes('/suggestions/') ||
      lower.includes('/communication-preferences') ||
      lower.includes('/push?t=')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Helper to canonicalize URLs by stripping tracking tokens, sorting params, and standardizing paths
   */
  public canonicalizeUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const isRelative = rawUrl.startsWith('/') && !rawUrl.startsWith('//');
      const u = isRelative
        ? new URL(rawUrl, 'https://sentinel-placeholder.local')
        : new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      u.hash = '';

      const stripPrefixes = ['utm_', 'pf_rd_', 'pd_rd_', 'otracker'];
      const stripExact = new Set([
        'ref_', 'ref', '_encoding', 'qid', 'sr', 'sprefix', 'crid', 'dib', 'dib_tag',
        'marketplace', 'as-show', 'as', 'pageuid', 'gclid', 'fbclid', 'msclkid', 'mc_eid',
        '_ga', '_gl', 'yclid', '_', '_t', 'timestamp', 'cb', 'nocache', 'v'
      ]);

      const paramsToKeep: Array<[string, string]> = [];
      u.searchParams.forEach((val, key) => {
        const lowerKey = key.toLowerCase();
        if (stripExact.has(lowerKey)) return;
        if (stripPrefixes.some((p) => lowerKey.startsWith(p))) return;
        paramsToKeep.push([key, val]);
      });

      paramsToKeep.sort((a, b) => a[0].localeCompare(b[0]));
      u.search = '';
      paramsToKeep.forEach(([k, v]) => u.searchParams.append(k, v));

      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }

      if (isRelative) {
        return u.pathname + u.search;
      }
      return u.toString();
    } catch {
      return rawUrl.split('#')[0];
    }
  }

  /**
   * Updates or registers an item when Chrome visits it, capturing the authentic HTML DOM
   * so the Render tab and Raw response inspector display the real webpage.
   */
  public updateOrRegisterVisitedPage(
    cleanUrl: string,
    liveUrl: string,
    title: string,
    html: string,
    ctx: DfsExploreContext
  ): void {
    try {
      const parsed = new URL(liveUrl.startsWith('http') ? liveUrl : `https://${liveUrl}`);
      const cleanPath = parsed.pathname + parsed.search;
      const key = `GET:${parsed.host}${cleanPath}`;

      const reqRaw = `GET ${cleanPath} HTTP/1.1\r\n` +
        `Host: ${parsed.host}\r\n` +
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\r\n` +
        `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\n` +
        `Accept-Language: en-US,en;q=0.9\r\n` +
        `Sec-Ch-Ua: "Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"\r\n` +
        `Sec-Ch-Ua-Mobile: ?0\r\n` +
        `Sec-Ch-Ua-Platform: "Windows"\r\n` +
        `Sec-Fetch-Dest: document\r\n` +
        `Sec-Fetch-Mode: navigate\r\n` +
        `Sec-Fetch-Site: same-origin\r\n` +
        `Connection: keep-alive\r\n\r\n`;

      const resRaw = `HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${html.length}\r\n\r\n${html}`;

      const existing = this.discoveredItemsMap.get(key);
      if (existing) {
        existing.status = 200;
        existing.length = html.length;
        if (title && !title.includes('Sentinel V6')) existing.title = title;
        existing.responseRaw = resRaw;
        existing.resHeaders = {
          'content-type': 'text/html; charset=utf-8',
          'content-length': String(html.length),
        };
        existing.resAttributes = {
          Status: '200 OK',
          Size: `${html.length} bytes`,
          Source: 'Live CDP Page Visit',
        };
        if (ctx.onItemDiscovered) ctx.onItemDiscovered(existing);
      } else {
        const item: SiteMapRequest = {
          id: `stealth-visit-${parsed.host}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}-GET`,
          host: parsed.host,
          method: 'GET',
          url: cleanPath,
          path: cleanPath,
          params: parsed.search.length > 0,
          status: 200,
          length: html.length,
          mime: 'HTML',
          title: (title && !title.includes('Sentinel V6')) ? title : cleanPath,
          notes: 'Captured via Live CDP Page Traversal [GET]',
          requestRaw: reqRaw,
          responseRaw: resRaw,
          reqAttributes: { Method: 'GET', Path: cleanPath, Source: 'Live CDP' },
          reqHeaders: { Host: parsed.host },
          resAttributes: { Status: '200 OK', Size: `${html.length} bytes`, Source: 'Live CDP' },
          resHeaders: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(html.length) },
          isDiscovered: false,
        };
        this.discoveredItemsMap.set(key, item);
        if (ctx.onItemDiscovered) ctx.onItemDiscovered(item);
      }

      // Also update pre-redirect key if it differed
      if (cleanUrl && cleanUrl !== liveUrl) {
        try {
          const origParsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
          const origKey = `GET:${origParsed.host}${origParsed.pathname}${origParsed.search}`;
          const origItem = this.discoveredItemsMap.get(origKey);
          if (origItem && origItem.responseRaw.includes('Unrequested')) {
            origItem.status = 200;
            origItem.length = html.length;
            if (title && !title.includes('Sentinel V6')) origItem.title = title;
            origItem.responseRaw = resRaw;
            origItem.notes = `Redirected to ${cleanPath} (Live Capture)`;
            if (ctx.onItemDiscovered) ctx.onItemDiscovered(origItem);
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Error in updateOrRegisterVisitedPage:', err);
    }
  }

  /**
   * Helper to identify static media, binary, and styling asset URLs
   */
  private isStaticAssetUrl(rawUrl: string): boolean {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const clean = rawUrl.split('?')[0].split('#')[0].toLowerCase();
    return /\.(ico|png|jpe?g|gif|svg|webp|avif|css|js|map|pdf|zip|tar|gz|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|exe|dmg|iso)$/i.test(clean);
  }

  /**
   * Helper to verify if a candidate URL belongs to the target host scope
   */
  private isSameTargetHost(urlOrHost: string, targetHostOrUrl: string): boolean {
    try {
      if (!targetHostOrUrl || !urlOrHost) return true;
      const clean1 = urlOrHost.startsWith('http') ? urlOrHost : `https://${urlOrHost}`;
      let targetClean = targetHostOrUrl.trim();
      if (!targetClean.startsWith('http://') && !targetClean.startsWith('https://')) {
        targetClean = `https://${targetClean}`;
      }
      const u1 = new URL(clean1);
      const u2 = new URL(targetClean);

      const h1 = u1.hostname.toLowerCase().split(':')[0].trim();
      const h2 = u2.hostname.toLowerCase().split(':')[0].trim();

      if (h1 === h2) return true;

      const apex1 = h1.replace(/^www\./, '');
      const apex2 = h2.replace(/^www\./, '');

      if (apex1 === apex2) return true;
      if (h1.endsWith('.' + apex2)) return true;
      if (h2.endsWith('.' + apex1)) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a URL is eligible for a deeper recursive DFS dive
   */
  private isEligibleForDfs(url: string, targetHost: string, ctx: DfsExploreContext): boolean {
    if (!url || !url.startsWith('http')) return false;
    const clean = url.split('#')[0];
    if (this.isStaticAssetUrl(clean)) return false;
    if (!this.isSameTargetHost(clean, targetHost)) return false;
    if (!DestructiveActionKernel.isSafeUrl(clean)) return false;
    if (ctx.visitedPageUrls.has(clean) || ctx.activeStack.has(clean)) return false;
    if (ctx.stateCounter.count >= ctx.maxStates) return false;
    if (!pathTemplateClusterer.shouldCrawlUrl(clean, 3)) return false;
    return true;
  }

  /**
   * Backtracks the browser one step to restore the parent view state
   */
  private async backtrackToUrl(targetUrl: string, delayMs: number = 200): Promise<void> {
    const cleanTarget = targetUrl.split('#')[0];
    const settleBudget = Math.min(Math.max(delayMs, 80), 300);
    try {
      await Promise.race([
        stealthCdpBrowserDriver.evaluate('window.history.back()'),
        new Promise(r => setTimeout(r, 1200))
      ]);
      await stealthCdpBrowserDriver.waitForDomSettle(settleBudget);
      const current = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
      if (this.canonicalizeUrl(current) !== this.canonicalizeUrl(cleanTarget)) {
        await stealthCdpBrowserDriver.navigate(cleanTarget);
        await stealthCdpBrowserDriver.waitForDomSettle(settleBudget);
      }
    } catch {
      try {
        await stealthCdpBrowserDriver.navigate(cleanTarget);
        await stealthCdpBrowserDriver.waitForDomSettle(settleBudget);
      } catch {}
    }
  }

  /**
   * Traps in-memory API calls and collects newly rendered DOM links after in-place interactions
   */
  private async harvestDynamicDOMUpdates(
    ctx: DfsExploreContext,
    currentUrl: string,
    _contextLabel: string
  ): Promise<void> {
    try {
      const trapped = await clientRuntimeOmniscienceService.drainTrappedRoutes();
      for (const tr of trapped) {
        this.registerDiscoveredUrl(
          tr.url,
          ctx.targetHost,
          currentUrl,
          tr.source,
          `${tr.method} ${tr.url}`,
          ctx.onItemDiscovered,
          tr.method,
          tr.postData
        );
      }

      const revealed = await stealthCdpBrowserDriver.evaluate<Array<{ url: string; text?: string }>>(`
        (function() {
          const res = [];
          const seen = new Set();
          document.querySelectorAll('a[href], [data-url], [data-href], [data-endpoint], [data-route]').forEach(function(el) {
            const h = el.getAttribute('href') || el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-endpoint') || el.getAttribute('data-route') || '';
            const t = (el.innerText || el.textContent || '').trim().slice(0, 80);
            if (!h || h.startsWith('#') || h.startsWith('javascript:') || seen.has(h)) return;

            // Frontier Honeypot Filter
            try {
              const r = el.getBoundingClientRect();
              if (r.width <= 1 && r.height <= 1) return;
              if (r.right <= -50 || r.bottom <= -50) return;
              const s = window.getComputedStyle(el);
              if (s && (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) <= 0.02 || s.pointerEvents === 'none')) return;
              if (el.offsetParent === null && s.position !== 'fixed') return;
              const id = (el.id || '').toLowerCase();
              const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
              if (id.includes('honeypot') || id.includes('bot-trap') || cls.includes('honeypot') || cls.includes('bot-trap')) return;
            } catch(e) {}

            seen.add(h);
            res.push({ url: h, text: t });
          });
          return res;
        })()
      `) || [];

      for (const r of revealed) {
        if (!HoneypotDefenseEngine.isHoneypotUrl(r.url)) {
          this.registerDiscoveredUrl(r.url, ctx.targetHost, currentUrl, 'DOM-DynamicRevealed', r.text || r.url, ctx.onItemDiscovered);
        }
      }
    } catch {}
  }

  /**
   * Deeply extracts all interactive surface candidates (forms, search boxes, buttons, accordions, dropdowns, tabs, links)
   */
  private async extractInteractiveSurface(): Promise<SurfaceExtractionResult | null> {
    try {
      await stealthCdpBrowserDriver.dismissBlockingModalsAndOverlays();
      const result = await stealthCdpBrowserDriver.evaluate<SurfaceExtractionResult>(`
        (function() {
          try {
            document.querySelectorAll('a[target="_blank"]').forEach(function(a) {
              a.removeAttribute('target');
            });
          } catch(e) {}

          const forms = [];
          const searchInputs = [];
          const accordions = [];
          const dropdowns = [];
          const tabs = [];
          const selects = [];
          const buttons = [];
          const links = [];
          const scripts = [];
          const inlineScriptBodies = [];
          const inlineRoutes = [];
          const comments = [];
          const seenElements = new Set();

          function isHoneypot(el) {
            if (!el || !(el instanceof Element)) return true;
            try {
              const id = (el.id || '').toLowerCase();
              const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
              const name = (el.getAttribute('name') || '').toLowerCase();
              const textContent = (el.innerText || el.textContent || '').trim().toLowerCase();

              const trapTokens = ['honeypot', 'honey-pot', 'honey_pot', 'bot-trap', 'bot_trap', 'fake-input', 'fake_field', 'decoy', 'leave-blank', 'do-not-fill'];
              for (let i = 0; i < trapTokens.length; i++) {
                if (id.includes(trapTokens[i]) || className.includes(trapTokens[i]) || name.includes(trapTokens[i])) return true;
              }
              if (textContent.includes('leave this field blank') || textContent.includes('leave empty') || textContent.includes('do not click')) return true;

              const style = window.getComputedStyle(el);
              if (!style) return false;
              if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
              const opacity = parseFloat(style.opacity || '1');
              if (!isNaN(opacity) && opacity <= 0.02) return true;
              if (style.pointerEvents === 'none') return true;

              const rect = el.getBoundingClientRect();
              if (rect.width <= 1 && rect.height <= 1) return true;
              if (rect.right <= -50 || rect.bottom <= -50 || rect.left < -300 || rect.top < -300) return true;

              let parent = el.parentElement;
              let depth = 0;
              while (parent && depth < 6) {
                const pStyle = window.getComputedStyle(parent);
                if (pStyle.display === 'none' || pStyle.visibility === 'hidden') return true;
                parent = parent.parentElement;
                depth++;
              }
              if (el.offsetParent === null && style.position !== 'fixed') return true;
              return false;
            } catch(e) {
              return false;
            }
          }

          function getUniqueSelector(el) {
            if (!el || el.nodeType !== 1) return '';
            if (el.id && !/^\d/.test(el.id)) {
              try { return '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id); } catch(e) { return '#' + el.id; }
            }
            const testId = el.getAttribute('data-testid') || el.getAttribute('data-qa') || el.getAttribute('data-test');
            if (testId) {
              try { return '[data-testid="' + (window.CSS && CSS.escape ? CSS.escape(testId) : testId) + '"]'; } catch(e) {}
            }
            const name = el.getAttribute('name');
            if (name && (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
              try { return el.tagName.toLowerCase() + '[name="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]'; } catch(e) {}
            }
            const parts = [];
            let curr = el;
            while (curr && curr.nodeType === 1 && curr !== document.body && curr !== document.documentElement && parts.length < 5) {
              let tag = curr.tagName.toLowerCase();
              if (curr.id && !/^\d/.test(curr.id)) {
                try { parts.unshift('#' + (window.CSS && CSS.escape ? CSS.escape(curr.id) : curr.id)); break; } catch(e) {}
              }
              const parent = curr.parentElement;
              if (!parent) {
                parts.unshift(tag);
                break;
              }
              const siblings = Array.from(parent.children).filter(function(c) { return c.tagName === curr.tagName; });
              if (siblings.length > 1) {
                const idx = siblings.indexOf(curr) + 1;
                parts.unshift(tag + ':nth-of-type(' + idx + ')');
              } else {
                parts.unshift(tag);
              }
              curr = parent;
            }
            return parts.join(' > ');
          }

          function collectFromRoot(root) {
            if (!root) return;

            // 1. Forms & Inputs (bounded to max 10)
            try {
              const formNodes = root.querySelectorAll ? root.querySelectorAll('form') : [];
              for (let i = 0; i < formNodes.length && forms.length < 10; i++) {
                const f = formNodes[i];
                if (isHoneypot(f)) continue;
                const act = f.getAttribute('action') || '';
                const meth = (f.getAttribute('method') || 'GET').toUpperCase();
                const inputs = [];
                const inps = f.querySelectorAll('input, select, textarea');
                for (let j = 0; j < inps.length && inputs.length < 12; j++) {
                  const inp = inps[j];
                  if (isHoneypot(inp)) continue;
                  const name = inp.getAttribute('name') || '';
                  if (name) {
                    inputs.push({
                      name: name,
                      type: inp.getAttribute('type') || inp.tagName.toLowerCase(),
                      value: inp.value || inp.getAttribute('value') || ''
                    });
                  }
                }
                forms.push({ actionUrl: act || window.location.href, method: meth, inputs: inputs });
              }
            } catch(e) {}

            // 2. Search & Query Inputs (bounded to max 5)
            try {
              const inps = root.querySelectorAll ? root.querySelectorAll('input[type="search"], input[placeholder*="search" i], input[name*="search" i], input[name*="q" i], input[id*="search" i], input[placeholder*="find" i], input[placeholder*="query" i], input[name*="keyword" i]') : [];
              for (let i = 0; i < inps.length && searchInputs.length < 5; i++) {
                const inp = inps[i];
                if (isHoneypot(inp)) continue;
                const r = inp.getBoundingClientRect();
                if (r.width > 2 && r.height > 2) {
                  const selector = getUniqueSelector(inp) || (inp.id ? '#' + inp.id : (inp.name ? 'input[name="' + inp.name + '"]' : 'input[type="search"]'));
                  searchInputs.push({
                    selector: selector,
                    id: inp.id || '',
                    name: inp.name || '',
                    placeholder: inp.placeholder || '',
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2
                  });
                }
              }
            } catch(e) {}

            // 3. Navigation Links (bounded to max 60 unique links per state)
            try {
              const linkNodes = root.querySelectorAll ? root.querySelectorAll('a[href], area[href], [data-url], [data-href], [data-endpoint]') : [];
              for (let i = 0; i < linkNodes.length && links.length < 60; i++) {
                const el = linkNodes[i];
                if (seenElements.has(el)) continue;
                seenElements.add(el);
                if (isHoneypot(el)) continue;

                const href = el.getAttribute('href') || el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-endpoint') || '';
                if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
                const lowerHref = href.toLowerCase();
                if (lowerHref.includes('play.google.com') || lowerHref.includes('apps.apple.com') || lowerHref.includes('facebook.com') || lowerHref.includes('twitter.com') || lowerHref.includes('instagram.com') || lowerHref.includes('youtube.com') || lowerHref.includes('linkedin.com')) continue;
                if (lowerHref.includes('/searchsuggestion') || lowerHref.includes('/autocomplete') || lowerHref.includes('/autosuggest') || lowerHref.includes('/communication-preferences') || lowerHref.includes('/telemetry') || lowerHref.includes('/beacon')) continue;

                const rect = el.getBoundingClientRect();
                if (rect.width > 2 && rect.height > 2) {
                  const text = (el.innerText || el.textContent || '').trim().slice(0, 60);
                  links.push({
                    url: href,
                    text: text,
                    selector: getUniqueSelector(el) || (el.id ? '#' + el.id : 'a'),
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  });
                }
              }
            } catch(e) {}

            // 3b. Dedicated Select Dropdowns (guaranteed discovery up to 25 selects)
            try {
              const selectNodes = root.querySelectorAll ? root.querySelectorAll('select') : [];
              for (let sIdx = 0; sIdx < selectNodes.length && selects.length < 25; sIdx++) {
                const el = selectNodes[sIdx];
                if (seenElements.has(el)) continue;
                seenElements.add(el);
                if (isHoneypot(el)) continue;

                const rect = el.getBoundingClientRect();
                const text = (el.innerText || el.textContent || '').trim().slice(0, 60);
                const id = el.id || '';
                const uSel = getUniqueSelector(el) || (id ? '#' + id : (el.name ? 'select[name="' + el.name + '"]' : 'select'));

                const desc = {
                  tagName: 'SELECT',
                  id: id,
                  className: (typeof el.className === 'string' ? el.className : '').slice(0, 100),
                  text: text,
                  ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 60),
                  title: (el.getAttribute('title') || '').slice(0, 60),
                  href: '',
                  dataUrl: '',
                  action: '',
                  role: '',
                  type: '',
                  category: 'select',
                  isSelect: true,
                  selectOptionValue: '',
                  selector: uSel,
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height
                };

                const opts = Array.from(el.options || []).filter(function(o) {
                  const ov = (o.value || '').trim();
                  const ot = (o.text || '').trim().toLowerCase();
                  return ov !== '' && ov !== '0' && ov !== '-1' && !/^(choose|select|none|\-\-)/i.test(ot);
                });
                if (opts.length > 0) desc.selectOptionValue = opts[0].value;
                selects.push(desc);
              }
            } catch(e) {}

            // 4. Interactive Elements (buttons, dropdowns, accordions, tabs - bounded to max 40)
            const interactiveSelectors = [
              'button', '[role="button"]', '[role="tab"]', 'details > summary',
              '.nav-dropdown-toggle', '[data-toggle="collapse"]', '[data-bs-toggle="collapse"]',
              '[data-toggle="dropdown"]', '[data-bs-toggle="dropdown"]', '.accordion-button',
              '.dropdown-toggle', 'input[type="button"]', 'input[type="submit"]',
              'a.btn', 'a.button', 'a[role="button"]', '.nav-link', '.menu-item',
              '[data-action]', '[data-route]', '.chip', '.filter-pill',
              '[onclick]', '[tabindex="0"]', '[jsaction]', '[data-click]',
              '[ng-click]', '[data-command]', '[data-target]', '[data-trigger]'
            ];

            for (let sIdx = 0; sIdx < interactiveSelectors.length; sIdx++) {
              if (buttons.length + accordions.length + dropdowns.length + tabs.length >= 40) break;
              const sel = interactiveSelectors[sIdx];
              try {
                const nodes = root.querySelectorAll ? root.querySelectorAll(sel) : [];
                for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
                  if (buttons.length + accordions.length + dropdowns.length + tabs.length >= 40) break;
                  const el = nodes[nIdx];
                  if (seenElements.has(el)) continue;
                  seenElements.add(el);
                  if (isHoneypot(el)) continue;

                  const rect = el.getBoundingClientRect();
                  if (rect.width <= 2 || rect.height <= 2) continue;

                  const text = (el.innerText || el.textContent || '').trim().slice(0, 60);
                  const lowerText = text.toLowerCase();
                  if (lowerText === 'go to homepage' || lowerText === 'back to homepage' || lowerText === 'back to home') continue;
                  const id = el.id || '';
                  const className = typeof el.className === 'string' ? el.className : '';
                  const role = el.getAttribute('role') || '';
                  const type = el.getAttribute('type') || '';

                  const isDropdown = Boolean(
                    el.getAttribute('data-toggle') === 'dropdown' ||
                    el.getAttribute('data-bs-toggle') === 'dropdown' ||
                    className.includes('dropdown-toggle') ||
                    el.getAttribute('aria-haspopup') === 'true'
                  );

                  const isAccordion = Boolean(
                    className.includes('nav-dropdown-toggle') ||
                    className.includes('accordion-button') ||
                    className.includes('collapse-toggle') ||
                    el.tagName === 'SUMMARY' ||
                    el.getAttribute('data-toggle') === 'collapse' ||
                    el.getAttribute('data-bs-toggle') === 'collapse' ||
                    el.hasAttribute('aria-expanded')
                  );

                  const isTab = Boolean(sel.includes('tab') || role === 'tab' || className.includes('nav-link'));

                  const uSel = getUniqueSelector(el);
                  const desc = {
                    tagName: el.tagName,
                    id: id,
                    className: className.slice(0, 100),
                    text: text,
                    ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 60),
                    title: (el.getAttribute('title') || '').slice(0, 60),
                    href: el.getAttribute('href') || '',
                    dataUrl: el.getAttribute('data-url') || '',
                    action: el.getAttribute('action') || '',
                    role: role,
                    type: type,
                    category: 'button',
                    isSelect: el.tagName === 'SELECT',
                    selectOptionValue: '',
                    selector: uSel || sel,
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                  };

                  if (isDropdown) {
                    desc.category = 'dropdown';
                    dropdowns.push(desc);
                  } else if (isAccordion) {
                    desc.category = 'accordion';
                    accordions.push(desc);
                  } else if (isTab) {
                    desc.category = 'tab';
                    tabs.push(desc);
                  } else {
                    desc.category = 'button';
                    buttons.push(desc);
                  }
                }
              } catch(e) {}
            }
          }

          collectFromRoot(document);

          // Check top-level shadow host elements (max 8)
          try {
            const shadowHosts = document.querySelectorAll('header, nav, main, aside, [data-v-app], #app');
            for (let i = 0; i < shadowHosts.length; i++) {
              if (shadowHosts[i].shadowRoot) {
                collectFromRoot(shadowHosts[i].shadowRoot);
              }
            }
          } catch(e) {}

          return {
            forms: forms,
            searchInputs: searchInputs,
            accordions: accordions,
            dropdowns: dropdowns,
            tabs: tabs,
            selects: selects,
            buttons: buttons,
            links: links,
            scripts: scripts,
            inlineScriptBodies: inlineScriptBodies,
            inlineRoutes: inlineRoutes,
            comments: comments
          };
        })()
      `);
      return result;
    } catch (err) {
      console.warn('[StateFlowGraphCrawler] Surface extraction error:', err);
      return null;
    }
  }

  /**
   * Recursive Depth-First Search (DFS) node exploration with backtracking
   */
  private async exploreStateDfs(
    currentUrl: string,
    depth: number,
    ctx: DfsExploreContext
  ): Promise<void> {
    if (this.isAborted) return;
    if (ctx.stateCounter.count >= ctx.maxStates) return;
    if (depth > ctx.maxDepth) return;

    let cleanUrl = currentUrl.split('#')[0];
    if (cleanUrl.startsWith('chrome-error://') || cleanUrl.startsWith('chrome://') || cleanUrl === 'about:blank' || cleanUrl.includes('chromewebdata')) return;
    const canonCleanUrl = this.canonicalizeUrl(cleanUrl);
    if (ctx.visitedPageUrls.has(cleanUrl) || ctx.visitedPageUrls.has(canonCleanUrl)) return;
    if (ctx.activeStack.has(cleanUrl) || ctx.activeStack.has(canonCleanUrl)) return; // Prevent ancestor cycles in DFS
    if (this.isStaticAssetUrl(cleanUrl)) return;

    ctx.activeStack.add(cleanUrl);
    ctx.activeStack.add(canonCleanUrl);
    ctx.stateCounter.count++;

    const reportProgress = (action: string) => {
      if (ctx.onProgress) {
        ctx.onProgress(ctx.stateCounter.count, this.discoveredItemsMap.size, action);
      }
    };

    reportProgress(`[DFS Depth ${depth}] Exploring: ${cleanUrl}`);

    const initialRequestedUrl = cleanUrl;
    // Ensure Chrome is physically on cleanUrl or its canonical equivalent
    try {
      const live = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
      const liveCanon = this.canonicalizeUrl(live);
      const cleanCanon = this.canonicalizeUrl(cleanUrl);
      if (live.startsWith('chrome-error://') || live.includes('chromewebdata') || liveCanon !== cleanCanon) {
        await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));
        const loadDurationMs = await stealthCdpBrowserDriver.navigate(cleanUrl);
        // Universal adaptive settle: detect whether target uses client-side SPA frameworks (React, Next.js, Vue, Nuxt, Angular, Remix, Svelte)
        // Dynamic client-rendered SPAs on any website require a minimum settle window to hydrate DOM elements
        const isDynamicSpa = await stealthCdpBrowserDriver.evaluate<boolean>(`
          (function() {
            return Boolean(
              window.__NEXT_DATA__ ||
              window.__NUXT__ ||
              window.__remixContext ||
              document.querySelector('#root:not(:empty), #__next:not(:empty), #app:not(:empty), [data-reactroot], [data-v-app]') ||
              (window.React || window.angular || window.Vue)
            );
          })()
        `).catch(() => false);

        const settleBudgetMs = ctx.interactionDelayMs <= 150
          ? (isDynamicSpa ? Math.max(180, ctx.interactionDelayMs) : Math.min(ctx.interactionDelayMs, 80))
          : Math.min(Math.max(40, Math.round(loadDurationMs * 0.3)), 400);
        await stealthCdpBrowserDriver.waitForDomSettle(settleBudgetMs);
      }

      // If server responded with a canonical redirect on the same host (e.g. /Baby/b/ -> /gp/browse.html),
      // adopt the live redirected URL so we do not loop back or fight the redirect
      const postNavLive = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
      if (postNavLive && this.isSameTargetHost(postNavLive, ctx.targetHost) && !postNavLive.startsWith('chrome-error://') && !postNavLive.includes('chromewebdata')) {
        ctx.visitedPageUrls.add(cleanUrl);
        ctx.visitedPageUrls.add(this.canonicalizeUrl(cleanUrl));
        cleanUrl = postNavLive;
        ctx.visitedPageUrls.add(cleanUrl);
        ctx.visitedPageUrls.add(this.canonicalizeUrl(cleanUrl));
      }
    } catch (navErr) {
      console.warn('Navigation error in DFS:', navErr);
    }

    // Frontier: Resolve any security verification / interstitial FIRST before inspecting the DOM
    await this.waitForInterstitialToResolve(ctx.interactionDelayMs <= 50 ? 5000 : 20000, reportProgress, ctx.targetHost);
    if (ctx.interactionDelayMs > 150) {
      await stealthCdpBrowserDriver.waitForDomSettle(Math.min(300, ctx.interactionDelayMs));
    }

    // Authentic Human View Scan & Smooth Scrolling on every visited state
    // Scrolls down in natural stages to trigger lazy loading, infinite scroll sections, and dynamic JS hydration
    try {
      if (ctx.interactionDelayMs <= 50) {
        // High-speed mode: dispatch natural CDP wheel scroll events to evade Akamai / bot sensor detection
        await stealthCdpBrowserDriver.dispatchSmoothScroll(250).catch(() => {});
        await stealthCdpBrowserDriver.dispatchSmoothScroll(-250).catch(() => {});
        await stealthCdpBrowserDriver.waitForDomSettle(Math.max(80, ctx.interactionDelayMs));
      } else if (ctx.interactionDelayMs <= 150) {
        await stealthCdpBrowserDriver.dispatchSmoothScroll(400);
        await stealthCdpBrowserDriver.dispatchSmoothScroll(-400);
        await stealthCdpBrowserDriver.waitForDomSettle(Math.min(40, ctx.interactionDelayMs));
      } else {
        reportProgress(`[Human Simulation] Scanning & scrolling ${cleanUrl} to reveal dynamic elements...`);
        const scrollStep = Math.min(450, Math.max(200, Math.floor(ctx.interactionDelayMs * 0.8)));
        await stealthCdpBrowserDriver.dispatchSmoothScroll(scrollStep);
        await new Promise(r => setTimeout(r, Math.min(150, ctx.interactionDelayMs)));
        await stealthCdpBrowserDriver.dispatchSmoothScroll(-(scrollStep + 50));
        await stealthCdpBrowserDriver.waitForDomSettle(Math.min(200, ctx.interactionDelayMs));
      }
    } catch {}

    // Frontier: Proactively check for dynamic anti-bot defenses (Akamai, Cloudflare, PerimeterX, 403, 429)
    const blockCheck = await this.detectDynamicBlock(ctx.targetHost, cleanUrl);
    if (blockCheck.isBlocked) {
      const recovered = await this.handleDynamicBlockAndSlowRetry(cleanUrl, ctx, depth, blockCheck.reason || 'Anti-Bot Defense');
      if (!recovered) {
        reportProgress(`[DFS Depth ${depth}] Defense persisted on ${cleanUrl} -> Registering & backtracking...`);
        this.registerDiscoveredUrl(cleanUrl, ctx.targetHost, cleanUrl, `Status-Blocked`, blockCheck.reason || 'Defense Restriction', ctx.onItemDiscovered);
        ctx.activeStack.delete(cleanUrl);
        ctx.visitedPageUrls.add(cleanUrl);
        return;
      }
    }

    // Capture authentic live page HTML and metadata for the active visited page
    let livePageTitle = '';
    try {
      const pageInfo = await stealthCdpBrowserDriver.evaluate<{
        html: string;
        title: string;
        liveUrl: string;
      }>(`
        (function() {
          return {
            html: document.documentElement ? document.documentElement.outerHTML : '',
            title: (document.title || '').trim(),
            liveUrl: window.location.href
          };
        })()
      `);

      if (pageInfo && pageInfo.html && pageInfo.html.length > 50) {
        livePageTitle = pageInfo.title;
        this.updateOrRegisterVisitedPage(initialRequestedUrl, pageInfo.liveUrl, pageInfo.title, pageInfo.html, ctx);

        // MultiSource Endpoint & Attack-Surface Mining (Shadow DOM, Iframes, Runtime Hooks, Routers, Workers & HTML)
        try {
          const minedEndpoints = await multiSourceEndpointMiner.extractEndpoints({
            targetHost: ctx.targetHost,
            driver: stealthCdpBrowserDriver,
            currentUrl: cleanUrl,
            html: pageInfo.html,
          });
          for (const ep of minedEndpoints) {
            const norm = endpointNormalizer.normalize(ep.url, cleanUrl);
            if (norm && (this.isSameTargetHost(norm.origin, ctx.targetHost) || norm.isInternal)) {
              this.registerDiscoveredUrl(
                norm.canonicalUrl,
                ctx.targetHost,
                cleanUrl,
                `Miner-${ep.source}`,
                ep.url,
                ctx.onItemDiscovered,
                ep.method || 'GET',
                undefined,
                ep.parameters ? Object.entries(ep.parameters).map(([k, v]) => ({ name: k, value: v })) : undefined
              );
              if (ep.source === 'router_route') {
                const fw = (ep.metadata && typeof ep.metadata.framework === 'string') ? ep.metadata.framework : 'SPA-Router';
                if (!this.collectedRouterRoutes.some((r) => r.url === norm.canonicalUrl)) {
                  this.collectedRouterRoutes.push({ url: norm.canonicalUrl, source: fw });
                }
              }
            }
          }
        } catch (minerErr) {
          console.warn('MultiSourceEndpointMiner live mining error:', minerErr);
        }
      }
    } catch (domErr) {
      console.warn('Failed to capture live DOM from browser:', domErr);
    }

    // Check for error pages or de-auth redirects
    try {
      const errorCheck = await stealthCdpBrowserDriver.evaluate<{ isError: boolean; reason: string }>(`
        (function() {
          const t = (document.title || '').toLowerCase();
          const b = (document.body ? document.body.innerText : '').slice(0, 1200).toLowerCase();
          const u = window.location.href.toLowerCase();

          const isChromeError = u.startsWith('chrome-error://') || u.includes('chromewebdata') || t.includes('can’t be reached') || t.includes('cant be reached') || b.includes('err_proxy_connection_failed') || b.includes('err_failed') || b.includes('no internet');
          const isDeauth = u.includes('/login') || u.includes('wssplashchk');
          const isForbidden = t.includes('forbidden') || t.includes('403') || b.includes('403 forbidden') || b.includes('403 |');
          const isNotFound = t.includes('404') || b.includes('404 not found') ||
            b.includes('moved or deleted') || b.includes('page not found') ||
            b.includes('looking for has been moved') || b.includes('something went wrong') ||
            b.includes('looking for something?') ||
            b.includes('item not found') || b.includes('page could not be found') ||
            b.includes('could not find the page') || b.includes('product not found') ||
            b.includes('requested url was not found') || b.includes('no longer available') ||
            document.querySelector('img[src*="error-500"], img[src*="error_500"], img[src*="error-404"], img[src*="not-found"]') !== null;
          const isServerErr = t.includes('500') || b.includes('500 server error') || b.includes('internal server error');

          if (isChromeError) return { isError: true, reason: 'Browser Network Failure (chrome-error)' };
          if (isDeauth) return { isError: true, reason: 'De-auth redirect to login' };
          if (isForbidden) return { isError: true, reason: '403 Forbidden' };
          if (isNotFound) return { isError: true, reason: '404 Not Found' };
          if (isServerErr) return { isError: true, reason: '500 Server Error' };
          return { isError: false, reason: '' };
        })()
      `);

      if (errorCheck?.isError) {
        if (errorCheck.reason === '403 Forbidden') {
          const recovered = await this.handleDynamicBlockAndSlowRetry(cleanUrl, ctx, depth, '403 Forbidden Block');
          if (!recovered) {
            reportProgress(`[DFS Depth ${depth}] Page reached restriction (${errorCheck.reason}) -> Registering & backtracking...`);
            this.registerDiscoveredUrl(cleanUrl, ctx.targetHost, cleanUrl, `Status-${errorCheck.reason.replace(/\s+/g, '')}`, livePageTitle || errorCheck.reason, ctx.onItemDiscovered);
            ctx.activeStack.delete(cleanUrl);
            ctx.visitedPageUrls.add(cleanUrl);
            return;
          }
        } else {
          reportProgress(`[DFS Depth ${depth}] Page reached restriction (${errorCheck.reason}) -> Registering & backtracking...`);
          this.registerDiscoveredUrl(cleanUrl, ctx.targetHost, cleanUrl, `Status-${errorCheck.reason.replace(/\s+/g, '')}`, livePageTitle || errorCheck.reason, ctx.onItemDiscovered);
          ctx.activeStack.delete(cleanUrl);
          ctx.visitedPageUrls.add(cleanUrl);
          return;
        }
      }
    } catch {}

    // Inject V8 Omniscience runtime instrumentation
    await clientRuntimeOmniscienceService.injectInstrumentation();

    // Drain background API / AJAX routes trapped in memory
    try {
      const trapped = await clientRuntimeOmniscienceService.drainTrappedRoutes();
      for (const tr of trapped) {
        this.registerDiscoveredUrl(tr.url, ctx.targetHost, cleanUrl, tr.source, `${tr.method} ${tr.url}`, ctx.onItemDiscovered, tr.method, tr.postData);
      }
    } catch {}

    // Dredge Next.js, Nuxt, Remix manifests, client storage routes, and router tables
    try {
      const dredged = await clientRuntimeOmniscienceService.dredgeOfflineStorage();
      for (const d of dredged) {
        this.registerDiscoveredUrl(
          d.url,
          ctx.targetHost,
          cleanUrl,
          `Omniscience-${d.source}`,
          d.title || d.url,
          ctx.onItemDiscovered
        );
        if (!this.collectedOfflineStorage.some((item) => item.url === d.url)) {
          this.collectedOfflineStorage.push(d);
        }
      }

      const routerRoutes = await clientRuntimeOmniscienceService.introspectClientRouters();
      for (const rr of routerRoutes) {
        this.registerDiscoveredUrl(
          rr.url,
          ctx.targetHost,
          cleanUrl,
          `Router-${rr.source}`,
          rr.title || rr.url,
          ctx.onItemDiscovered
        );
        if (!this.collectedRouterRoutes.some((r) => r.url === rr.url)) {
          this.collectedRouterRoutes.push({ url: rr.url, source: rr.source });
        }
      }
    } catch {}

    // Extract all interactive elements from the live DOM
    let extraction = await this.extractInteractiveSurface();
    if (!extraction) {
      // Check if page crashed or encountered error page and auto-recover
      const recovered = await stealthCdpBrowserDriver.recoverFromCrashOrError(cleanUrl);
      if (recovered) {
        extraction = await this.extractInteractiveSurface();
      }
      if (!extraction) {
        ctx.activeStack.delete(cleanUrl);
        ctx.visitedPageUrls.add(cleanUrl);
        return;
      }
    }

    // Intelligent Security & Zero-Data Diagnostic Engine
    if (extraction.links.length < 5) {
      reportProgress(`[Diagnostic Engine] Sparse surface detected on ${cleanUrl} (${extraction.links.length} links). Diagnosing target security & state...`);

      try {
        const diagnosis = await stealthCdpBrowserDriver.evaluate<{
          statusCodeText: string;
          isRateLimited: boolean;
          isWafBlock: boolean;
          hasModal: boolean;
          isSpaApp: boolean;
          detectedFramework: string;
          bodySnippet: string;
        }>(`
          (function() {
            const t = (document.title || '').toLowerCase();
            const b = (document.body ? document.body.innerText : '').slice(0, 1000).toLowerCase();

            const isRateLimited = b.includes('too many requests') || b.includes('rate limit') || t.includes('429') || b.includes('error 429') || b.includes('try again later');
            const isWafBlock = b.includes('access denied') || b.includes('blocked') || b.includes('incident id') || t.includes('403 forbidden') || b.includes('protected by');
            const hasModal = document.querySelector('[role="dialog"], .modal, .swal2-container, #login-modal, [class*="modal"], [class*="overlay"]') !== null;
            const isSpaApp = Boolean(document.querySelector('#root, #app, #__next, [data-reactroot], [data-v-app], #container') || window.__NEXT_DATA__ || window.__remixContext || window.$nuxt);
            const detectedFramework = window.__NEXT_DATA__ ? 'Next.js' : (window.__remixContext ? 'Remix' : (window.$nuxt ? 'Nuxt' : (document.querySelector('#root, [data-reactroot]') ? 'React' : (document.querySelector('[data-v-app]') ? 'Vue' : 'SPA/Other'))));

            return {
              statusCodeText: t,
              isRateLimited,
              isWafBlock,
              hasModal,
              isSpaApp,
              detectedFramework,
              bodySnippet: b.slice(0, 300)
            };
          })()
        `);

        if (diagnosis) {
          if (diagnosis.isRateLimited || diagnosis.isWafBlock) {
            const diagReason = diagnosis.isRateLimited ? 'HTTP 429 Rate Limit' : 'WAF Defense (Access Denied / Blocked)';
            reportProgress(`[Diagnostic Engine] ⚠️ Defense restriction detected on ${cleanUrl} (${diagReason}). Adapting crawl dynamically...`);
            const recovered = await this.handleDynamicBlockAndSlowRetry(cleanUrl, ctx, depth, diagReason);
            if (recovered) {
              const freshExtraction = await this.extractInteractiveSurface();
              if (freshExtraction && freshExtraction.links.length > 0) {
                extraction = freshExtraction;
              }
            }
          } else if (diagnosis.hasModal) {
            reportProgress(`[Diagnostic Engine] Detected blocking dialog/modal. Dismissing...`);
            await stealthCdpBrowserDriver.dismissBlockingModalsAndOverlays();
            await stealthCdpBrowserDriver.waitForDomSettle(600);
          } else if (diagnosis.isSpaApp || extraction.links.length < 5) {
            reportProgress(`[Diagnostic Engine] Dynamic frontend detected (${diagnosis.detectedFramework || 'SPA'}). Initiating multi-stage viewport hydration...`);
            try {
              // Stage 1: Smooth scroll down
              await stealthCdpBrowserDriver.dispatchSmoothScroll(400);
              await stealthCdpBrowserDriver.waitForDomSettle(800);
              // Stage 2: Deeper scroll down
              await stealthCdpBrowserDriver.dispatchSmoothScroll(700);
              await stealthCdpBrowserDriver.waitForDomSettle(800);
              // Stage 3: Human cursor wiggle to trigger hover/intersection observers
              await stealthCdpBrowserDriver.dispatchHumanClick({ x: 200, y: 300, delayMs: 40 }).catch(() => {});
              await stealthCdpBrowserDriver.waitForDomSettle(600);
            } catch {}
          }
        }

        // Re-extract after remediation
        const remediated = await this.extractInteractiveSurface();
        if (remediated && remediated.links.length > extraction.links.length) {
          reportProgress(`[Diagnostic Engine] Remediation successful: Discovered ${remediated.links.length} interactive links!`);
          extraction = remediated;
        }
      } catch (diagErr) {
        console.warn('Diagnostic Engine error:', diagErr);
      }
    }

    // Register all discovered forms, links, scripts, inline script ASTs, and comments
    for (const f of extraction.forms) {
      this.registerDiscoveredUrl(f.actionUrl, ctx.targetHost, cleanUrl, `Form-${f.method}`, `Form: ${f.actionUrl}`, ctx.onItemDiscovered, f.method, undefined, f.inputs);
      if (!this.collectedDomForms.some((df) => df.actionUrl === f.actionUrl && df.method === f.method)) {
        this.collectedDomForms.push({
          actionUrl: f.actionUrl,
          method: f.method,
          inputs: f.inputs.map((i) => i.name).filter(Boolean),
        });
      }
    }
    for (const l of extraction.links) {
      this.registerDiscoveredUrl(l.url, ctx.targetHost, cleanUrl, 'DOM-Link', l.text || l.url, ctx.onItemDiscovered);
    }
    for (const s of extraction.scripts) {
      this.registerDiscoveredUrl(s, ctx.targetHost, cleanUrl, 'Script-Bundle', s, ctx.onItemDiscovered);
    }

    // Proactively mine up to 25 loaded client bundles + source maps + synthesized lazy chunks per state
    try {
      for (const s of extraction.scripts.slice(0, 25)) {
        const smRes = await sourceMapRouteMiner.probeAndMineScript(s, ctx.targetHost, (item) => {
          this.registerDiscoveredUrl(
            item.url,
            ctx.targetHost,
            cleanUrl,
            'SourceMap-Route',
            item.title || item.url,
            ctx.onItemDiscovered,
            item.method || 'GET'
          );
        });
        if (smRes) {
          this.ingestSourceMapResult(smRes, ctx.targetHost, cleanUrl, ctx.onItemDiscovered);
          // Proactively fetch and AST-mine unloaded lazy chunks synthesized from the runtime manifest
          for (const lazyUrl of (smRes.synthesizedLazyChunks || []).slice(0, 8)) {
            const lazyRes = await sourceMapRouteMiner.probeAndMineScript(lazyUrl, ctx.targetHost, (item) => {
              this.registerDiscoveredUrl(
                item.url,
                ctx.targetHost,
                cleanUrl,
                'LazyChunk-Route',
                item.title || item.url,
                ctx.onItemDiscovered,
                item.method || 'GET'
              );
            });
            if (lazyRes) {
              this.ingestSourceMapResult(lazyRes, ctx.targetHost, cleanUrl, ctx.onItemDiscovered);
            }
          }
        }
      }
    } catch {}

    // Parse inline <script> bodies via TypeScript AST constant folding & Zod/Interface schema miner
    try {
      for (let i = 0; i < (extraction.inlineScriptBodies || []).length; i++) {
        const inlineBody = extraction.inlineScriptBodies[i];
        if (inlineBody && inlineBody.length > 25) {
          this.ingestScriptContentIntelligence(`${cleanUrl}#inline-${i}`, inlineBody, ctx.targetHost, cleanUrl, ctx.onItemDiscovered);
        }
      }
    } catch {}

    for (const r of extraction.inlineRoutes) {
      this.registerDiscoveredUrl(r.url, ctx.targetHost, cleanUrl, r.source, r.title || r.url, ctx.onItemDiscovered);
    }
    for (const c of extraction.comments) {
      this.registerDiscoveredUrl(c, ctx.targetHost, cleanUrl, 'HTML-Comment', c, ctx.onItemDiscovered);
    }

    // Frontier Session Watchdog: Ensure authenticated session hasn't expired or drifted to login
    try {
      const sessionCheck = await sessionLivenessWatchdog.evaluateSessionHealth(stealthCdpBrowserDriver);
      if (sessionCheck.isDeauthenticated) {
        reportProgress(`⚠️ Session de-authentication detected (${sessionCheck.reason}). Pausing for session recovery...`);
      }
    } catch {}

    // Frontier Anti-Bot Sentinel: Active Challenge Check on Current State
    try {
      const captchaStatus = await captchaSentinelEngine.detectCaptcha(stealthCdpBrowserDriver);
      if (captchaStatus.hasCaptcha && captchaStatus.isChallengeScreen && (!extraction || extraction.links.length < 2)) {
        reportProgress(`⚠️ Challenge Detected (${captchaStatus.provider || 'Security Challenge'}). Resolving challenge...`);
        const resolved = await captchaSentinelEngine.waitForCaptchaResolution(stealthCdpBrowserDriver, {
          maxWaitMs: 12000,
          onPoll: (sec, prov) => reportProgress(`⏳ Resolving ${prov || 'challenge'} in browser (${sec}s elapsed)...`)
        });
        if (resolved) {
          reportProgress(`✅ Security challenge resolved! Resuming crawl on ${cleanUrl}...`);
          await stealthCdpBrowserDriver.waitForDomSettle(ctx.interactionDelayMs <= 50 ? 50 : 800);
        } else {
          reportProgress(`⚠️ Challenge resolution timed out on ${cleanUrl}. Skipping node.`);
          ctx.visitedPageUrls.add(cleanUrl);
          ctx.activeStack.delete(cleanUrl);
          return;
        }
      }
    } catch {}

    // Solve forms if present
    try {
      await cognitiveFlowAgent.discoverAndSolveAllForms(
        ctx.targetHost,
        cleanUrl,
        (item) => this.registerDiscoveredUrl(item.url, ctx.targetHost, cleanUrl, 'Cognitive-FormWorkflow', item.title || item.url, ctx.onItemDiscovered, item.method),
        (msg) => reportProgress(msg)
      );
    } catch {}

    let clicksOnThisPage = 0;

    // Helper to check if cleanUrl is already a search result page
    const isSearchResultUrl = (url: string): boolean => {
      const lower = url.toLowerCase();
      return (
        lower.includes('?s=') ||
        lower.includes('&s=') ||
        lower.includes('?q=') ||
        lower.includes('&q=') ||
        lower.includes('?search=') ||
        lower.includes('&search=') ||
        lower.includes('?query=') ||
        lower.includes('&query=') ||
        lower.includes('/search/') ||
        lower.includes('/search?')
      );
    };

    // STEP 1: Search Inputs Exploration (LLM-Guided & Scenario Testing)
    if (depth <= 1 && !isSearchResultUrl(cleanUrl)) {
      if (!ctx.probedSearchSelectors) {
        ctx.probedSearchSelectors = new Set<string>();
      }

      for (const sInp of extraction.searchInputs) {
        if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState || ctx.stateCounter.count >= ctx.maxStates) break;
        const selectorKey = sInp.id ? `#${sInp.id}` : (sInp.name ? `[name="${sInp.name}"]` : sInp.selector);
        if (ctx.probedSearchSelectors.has(selectorKey)) continue;
        ctx.probedSearchSelectors.add(selectorKey);

        const searchSig = `search:${cleanUrl}:${sInp.id}:${sInp.name}:${sInp.placeholder}`;
        if (this.clickedSignatures.has(searchSig)) continue;
        this.clickedSignatures.add(searchSig);

      // Extract authentic website intelligence from the live Chrome tab
      let siteIntel: {
        title: string;
        domain: string;
        categories: string[];
        products: string[];
        headings: string[];
        keywords: string[];
      } | null = null;

      try {
        siteIntel = await stealthCdpBrowserDriver.evaluate<{
          title: string;
          domain: string;
          categories: string[];
          products: string[];
          headings: string[];
          keywords: string[];
        }>(`
          (function() {
            const title = (document.title || '').trim();
            const domain = window.location.hostname.replace(/^www\\./, '');

            // Categories & navigation menu items
            const categories = Array.from(document.querySelectorAll('nav a, header a, .nav-item a, .cat-link, [data-csa-c-slot-id*="nav"] a, ._1ch8e_ a, ._21A0Pl a, .category-name, .menu-item a'))
              .map(el => (el.innerText || el.textContent || '').trim())
              .filter(t => t.length > 2 && t.length < 30 && !/^(sign in|log in|register|help|customer service|privacy|terms|cart|order|your account|all)$/i.test(t))
              .slice(0, 15);

            // E-commerce products & card titles
            const products = Array.from(document.querySelectorAll('.a-text-normal, .s-title-instructions-style, ._4rR01T, .s1Q9rs, .product-card__title, .card-title, .item-title, .product-title, .product-name'))
              .map(el => (el.innerText || el.textContent || '').trim())
              .filter(t => t.length > 3 && t.length < 50)
              .slice(0, 10);

            // Headings
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, .page-title, .section-title'))
              .map(el => (el.innerText || el.textContent || '').trim())
              .filter(t => t.length > 2 && t.length < 50 && !/^(sign in|log in|register|menu|cart|home|account|search|privacy|terms|help|welcome)$/i.test(t))
              .slice(0, 10);

            // Meta keywords
            const metaKw = (document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '')
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 2 && !/^(search|index|follow|keywords)$/i.test(s))
              .slice(0, 10);

            return { title, domain, categories, products, headings, keywords: metaKw };
          })()
        `);
      } catch {}

      const candidateQueries: string[] = [];

      // 1. LLM-Assisted Query Generation (with authentic website context and strictly no pentesting bias)
      if (groqService.isEnabled() && siteIntel) {
        try {
          const userPrompt = `Target Website Domain: "${siteIntel.domain || ctx.targetHost}"
Page Title: "${siteIntel.title || ''}"
Identified Categories on Page: ${JSON.stringify(siteIntel.categories.slice(0, 8))}
Identified Products/Content on Page: ${JSON.stringify((siteIntel.products.length > 0 ? siteIntel.products : siteIntel.headings).slice(0, 6))}
Search Input Placeholder/Name: "${sInp.placeholder || sInp.name || 'search'}"

Generate 2 authentic, natural search queries that a real visitor browsing THIS specific website would type into this search box to discover relevant items or records.
Rules:
- NEVER output generic security scanner or pentesting terms like "pentesting", "sentinel", "payload", "admin", "exploit", or "test" unless this is a cybersecurity website.
- Understand the nature of this website (e.g. e-commerce, university, blog, news, travel, finance) and generate relevant search terms matching its catalog and content.
- Return ONLY a valid JSON array of 2 strings: ["query1", "query2"]`;

          const aiResponse = await groqService.chatCompletion(
            userPrompt,
            'You are an intelligent search assistant that understands website semantics and generates authentic, realistic user search queries.'
          );
          if (aiResponse) {
            const arr = JSON.parse(aiResponse);
            if (Array.isArray(arr)) {
              for (const q of arr) {
                if (typeof q === 'string' && q.trim()) {
                  const cleaned = q.trim().replace(/[^a-zA-Z0-9_\- ]/g, '');
                  if (cleaned.length > 1 && !/^(pentest|pentesting|sentinel|exploit)$/i.test(cleaned)) {
                    candidateQueries.push(cleaned);
                  }
                }
              }
            }
          }
        } catch {}
      }

      // 2. High-precision DOM heuristic fallback (when LLM is not enabled or for fast local inference)
      if (candidateQueries.length === 0 && siteIntel) {
        // A. Extract noun from product titles if e-commerce
        if (siteIntel.products.length > 0) {
          for (const prod of siteIntel.products) {
            const words = prod.split(/[\s,–—\-]+/).filter((w) => w.length > 3 && !/^(with|from|pack|size|free|best|sale|flat|item)$/i.test(w));
            if (words.length > 0 && !candidateQueries.includes(words[0])) {
              candidateQueries.push(words[0]);
            }
            if (candidateQueries.length >= 2) break;
          }
        }

        // B. Use navigation categories
        if (candidateQueries.length < 2 && siteIntel.categories.length > 0) {
          for (const cat of siteIntel.categories) {
            const cleanCat = cat.replace(/[^a-zA-Z0-9 ]/g, '').trim();
            if (cleanCat.length > 2 && !candidateQueries.includes(cleanCat)) {
              candidateQueries.push(cleanCat);
            }
            if (candidateQueries.length >= 2) break;
          }
        }

        // C. Use headings or keywords
        if (candidateQueries.length < 2 && siteIntel.headings.length > 0) {
          for (const h of siteIntel.headings) {
            const words = h.split(/[\s,–—\-]+/).filter((w) => w.length > 3);
            if (words.length > 0 && !candidateQueries.includes(words[0])) {
              candidateQueries.push(words[0]);
            }
            if (candidateQueries.length >= 2) break;
          }
        }
      }

      // Safe general fallback if DOM was completely empty
      if (candidateQueries.length === 0) {
        candidateQueries.push('all');
      }

      for (const query of candidateQueries.slice(0, ctx.interactionDelayMs <= 50 ? 1 : 2)) {
        if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState) break;
        reportProgress(`[Search Explorer] Probing "${query}" in search input (${sInp.placeholder || sInp.name || 'search'})...`);
        try {
          const urlBefore = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
          await stealthCdpBrowserDriver.fillInput(sInp.selector, query);
          await stealthCdpBrowserDriver.pressEnter();
          clicksOnThisPage++;
          await stealthCdpBrowserDriver.waitForDomSettle(ctx.interactionDelayMs);

          let urlAfter = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];

          // If Enter key alone did not navigate, click the search submit button or magnifying glass
          if (urlAfter === urlBefore) {
            try {
              reportProgress(`Enter did not navigate. Clicking search submit button for "${query}"...`);
              await stealthCdpBrowserDriver.evaluate(`
                (function() {
                  const inp = document.querySelector(${JSON.stringify(sInp.selector)});
                  if (!inp) return;
                  const form = inp.closest('form');
                  const submitBtn = (form && form.querySelector('button[type="submit"], input[type="submit"], button, [role="button"], svg')) ||
                                    document.querySelector('button[type="submit"], button[aria-label*="search" i], button[title*="search" i], .search-button, [data-testid="search-button"], ._2iLD__');
                  if (submitBtn) {
                    submitBtn.click();
                  }
                })()
              `);
              await stealthCdpBrowserDriver.waitForDomSettle(ctx.interactionDelayMs);
              urlAfter = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
            } catch {}
          }

          if (urlAfter && urlAfter !== urlBefore && DestructiveActionKernel.isSafeUrl(urlAfter)) {
            reportProgress(`Search navigated to ${urlAfter}. Exploring search results in DFS...`);
            this.registerDiscoveredUrl(urlAfter, ctx.targetHost, urlBefore, 'Search-ResultRoute', `Search: ${query}`, ctx.onItemDiscovered);

            if (this.isEligibleForDfs(urlAfter, ctx.targetHost, ctx)) {
              // RECURSE into search results in DFS
              await this.exploreStateDfs(urlAfter, depth + 1, ctx);
            }

            // BACKTRACK back to parent
            reportProgress(`Backtracking from search results back to ${cleanUrl}...`);
            await this.backtrackToUrl(cleanUrl, ctx.interactionDelayMs);
          } else {
            await this.harvestDynamicDOMUpdates(ctx, cleanUrl, `Search "${query}" AJAX`);
          }
        } catch (searchErr) {
          console.warn('Search execution error:', searchErr);
        }
      }
    }
    }

    // STEP 2: Expand Accordions, Collapsibles, Drawers (In-Place DOM expansion)
    for (const acc of CrawlPatternRandomizer.shuffle(extraction.accordions)) {
      if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState) break;
      const sig = `acc:${cleanUrl}:${acc.selector}:${acc.text}:${acc.id}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      reportProgress(`Expanding accordion/drawer: "${acc.text || acc.className}"...`);
      try {
        await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));
        await stealthCdpBrowserDriver.clickElement({ selector: acc.selector, textMatch: acc.text, fallbackX: acc.x, fallbackY: acc.y, delayMs: ctx.interactionDelayMs });
        clicksOnThisPage++;
        await stealthCdpBrowserDriver.waitForDomSettle(Math.min(400, ctx.interactionDelayMs));
        await this.harvestDynamicDOMUpdates(ctx, cleanUrl, `Accordion "${acc.text}"`);
      } catch {}
    }

    // STEP 3: Open Dropdowns & Menus
    for (const drop of CrawlPatternRandomizer.shuffle(extraction.dropdowns)) {
      if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState) break;
      const sig = `drop:${cleanUrl}:${drop.selector}:${drop.text}:${drop.id}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      reportProgress(`Opening dropdown menu: "${drop.text || drop.className || 'Menu'}"...`);
      try {
        await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));
        await stealthCdpBrowserDriver.clickElement({ selector: drop.selector, textMatch: drop.text, fallbackX: drop.x, fallbackY: drop.y, delayMs: ctx.interactionDelayMs });
        clicksOnThisPage++;
        await stealthCdpBrowserDriver.waitForDomSettle(Math.min(400, ctx.interactionDelayMs));
        await this.harvestDynamicDOMUpdates(ctx, cleanUrl, `Dropdown "${drop.text}"`);
      } catch {}
    }

    // STEP 4: Switch Tabs
    for (const tab of CrawlPatternRandomizer.shuffle(extraction.tabs)) {
      if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState) break;
      const sig = `tab:${cleanUrl}:${tab.selector}:${tab.text}:${tab.id}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      reportProgress(`Switching tab: "${tab.text || tab.id}"...`);
      try {
        await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));
        await stealthCdpBrowserDriver.clickElement({ selector: tab.selector, textMatch: tab.text, fallbackX: tab.x, fallbackY: tab.y, delayMs: ctx.interactionDelayMs });
        clicksOnThisPage++;
        await stealthCdpBrowserDriver.waitForDomSettle(Math.min(400, ctx.interactionDelayMs));
        await this.harvestDynamicDOMUpdates(ctx, cleanUrl, `Tab "${tab.text}"`);
      } catch {}
    }

    // STEP 5: Select Dropdown Options
    for (const sel of CrawlPatternRandomizer.shuffle(extraction.selects)) {
      if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState) break;
      const sig = `sel:${cleanUrl}:${sel.selector || sel.id}:${sel.selectOptionValue}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      if (sel.selectOptionValue) {
        reportProgress(`Selecting dropdown [${sel.text || sel.id || sel.selector}] -> "${sel.selectOptionValue}"...`);
        try {
          await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));
          await stealthCdpBrowserDriver.selectOption({ selector: sel.selector, idMatch: sel.id }, sel.selectOptionValue);
          clicksOnThisPage++;
          await stealthCdpBrowserDriver.waitForDomSettle(ctx.interactionDelayMs);
          await this.harvestDynamicDOMUpdates(ctx, cleanUrl, `Select "${sel.id || sel.selector}"`);
        } catch {}
      }
    }

    // STEP 6: Click Safe Action Buttons (Capped in Turbo mode to prioritize high-speed link discovery)
    const maxButtonsToClick = ctx.interactionDelayMs <= 50 ? 6 : (ctx.interactionDelayMs <= 150 ? 12 : 30);
    const candidateButtons = CrawlPatternRandomizer.shuffle(extraction.buttons).slice(0, maxButtonsToClick);

    for (const btn of candidateButtons) {
      if (this.isAborted || clicksOnThisPage >= ctx.maxClicksPerState || ctx.stateCounter.count >= ctx.maxStates) break;
      if (!DestructiveActionKernel.isSafeElement(btn)) continue;

      const sig = `btn:${cleanUrl}:${btn.selector}:${btn.text}:${btn.id}:${btn.dataUrl}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      const clickX = btn.x + btn.width / 2;
      const clickY = btn.y + btn.height / 2;
      if (clickX <= 0 || clickY <= 0) continue;

      // Autonomously satisfy required form preconditions (variation dropdowns, radios, login inputs)
      if (ctx.interactionDelayMs > 50) {
        await stealthCdpBrowserDriver.satisfyFormPreconditions(btn.selector, clickX, clickY);
      }

      reportProgress(`[Click Button] "${btn.text || btn.tagName}" at depth ${depth}...`);
      try {
        await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));
        const urlBefore = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
        await stealthCdpBrowserDriver.clickElement({ selector: btn.selector, textMatch: btn.text, fallbackX: clickX, fallbackY: clickY, delayMs: ctx.interactionDelayMs });
        clicksOnThisPage++;
        await stealthCdpBrowserDriver.waitForDomSettle(ctx.interactionDelayMs);

        const urlAfter = (await stealthCdpBrowserDriver.getLiveUrl()).split('#')[0];
        if (urlAfter && urlAfter !== urlBefore && DestructiveActionKernel.isSafeUrl(urlAfter)) {
          reportProgress(`Button navigated to ${urlAfter}. Exploring in DFS...`);
          this.registerDiscoveredUrl(urlAfter, ctx.targetHost, urlBefore, 'Button-Navigation', btn.text, ctx.onItemDiscovered);

          if (this.isEligibleForDfs(urlAfter, ctx.targetHost, ctx)) {
            // RECURSIVE DFS DIVE INTO DESTINATION PAGE!
            await this.exploreStateDfs(urlAfter, depth + 1, ctx);
          }

          // BACKTRACK ONE STEP: return to parent page
          reportProgress(`Backtracking from button navigation (${urlAfter}) back to ${cleanUrl}...`);
          await this.backtrackToUrl(cleanUrl, ctx.interactionDelayMs);
        } else {
          await this.harvestDynamicDOMUpdates(ctx, cleanUrl, `Button "${btn.text}"`);
        }
      } catch (err) {
        console.warn(`Button click error on ${btn.text}:`, err);
      }
    }

    // STEP 7: Traverse Navigation Links (DFS)
    const eligibleLinks: Array<{ url: string; text?: string; selector?: string; x?: number; y?: number }> = [];

    for (const link of extraction.links) {
      if (!link.url || link.url.startsWith('#') || link.url.startsWith('javascript:')) continue;
      if (HoneypotDefenseEngine.isHoneypotUrl(link.url)) continue;

      // Skip static media/binary files
      if (this.isStaticAssetUrl(link.url)) {
        continue;
      }

      try {
        const abs = new URL(link.url, cleanUrl).href.split('#')[0];
        const canonAbs = this.canonicalizeUrl(abs);
        if (this.isTelemetryOrNoiseUrl(canonAbs)) continue;
        if (!this.isSameTargetHost(canonAbs, ctx.targetHost)) continue;
        if (!DestructiveActionKernel.isSafeUrl(canonAbs)) continue;
        if (ctx.visitedPageUrls.has(canonAbs) || ctx.activeStack.has(canonAbs) || ctx.visitedPageUrls.has(abs)) continue;

        // Cap pagination repetitions across entire crawl (e.g. ?page=1..100)
        const isPagination = /[?&](?:page|p|offset|start)=\d+|\/page\/\d+/i.test(canonAbs);
        if (isPagination) {
          const tmpl = canonAbs.replace(/([?&](?:page|p|offset|start)=)\d+/gi, '$1{n}').replace(/\/page\/\d+/gi, '/page/{n}');
          const cnt = ctx.paginationPatternCounts.get(tmpl) || 0;
          if (cnt >= 3) continue;
          ctx.paginationPatternCounts.set(tmpl, cnt + 1);
        }

        // Cap repetitive template clusters (products, articles, tags) across the crawl
        if (!pathTemplateClusterer.hasCrawlCapacity(canonAbs, 3)) {
          continue;
        }

        eligibleLinks.push({ url: canonAbs, text: link.text, selector: link.selector, x: link.x, y: link.y });
      } catch {}
    }

    for (const link of CrawlPatternRandomizer.shuffle(eligibleLinks)) {
      if (this.isAborted || ctx.stateCounter.count >= ctx.maxStates) break;
      if (ctx.visitedPageUrls.has(link.url) || ctx.activeStack.has(link.url)) continue;

      const sig = `link:${cleanUrl}:${link.url}`;
      if (this.clickedSignatures.has(sig)) continue;
      this.clickedSignatures.add(sig);

      reportProgress(`[Traversing Link] [Depth ${depth}] -> "${link.text || link.url}"...`);
      try {
        await adaptivePacingEngine.pace(ctx.targetHost, (notice) => reportProgress(notice));

        if (this.isEligibleForDfs(link.url, ctx.targetHost, ctx)) {
          // RECURSIVE DFS DIVE INTO TARGET LINK
          await this.exploreStateDfs(link.url, depth + 1, ctx);
        }
      } catch (err) {
        console.warn(`Link navigation error on ${link.url}:`, err);
      }
    }

    // Unwind DFS stack
    ctx.activeStack.delete(cleanUrl);
    ctx.visitedPageUrls.add(cleanUrl);
    reportProgress(`[DFS Depth ${depth}] Completed node: ${cleanUrl}`);
  }

  /**
   * Probes high-value API specifications (OpenAPI/Swagger), .well-known configs (OIDC, Universal Links, AssetLinks),
   * SPA build manifests (manifest.json, asset-manifest.json, ngsw.json), and GraphQL introspection endpoints
   * directly inside the authenticated Chrome browser context.
   */
  public async runAuthenticatedApiAndWellKnownSweep(
    targetHost: string,
    onItemDiscovered?: (item: SiteMapRequest) => void,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const cleanHost = targetHost.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const specPaths = [
      '/.well-known/openid-configuration',
      '/.well-known/oauth-authorization-server',
      '/.well-known/apple-app-site-association',
      '/.well-known/assetlinks.json',
      '/.well-known/security.txt',
      '/swagger.json',
      '/openapi.json',
      '/v2/api-docs',
      '/v3/api-docs',
      '/api-docs',
      '/manifest.json',
      '/asset-manifest.json',
      '/ngsw.json',
      '/graphql',
      '/api/graphql',
    ];

    for (const ep of specPaths) {
      if (this.isAborted) break;
      const fullUrl = `https://${cleanHost}${ep}`;
      try {
        const res = await stealthCdpBrowserDriver.fetchInBrowserDetails(fullUrl);
        if (!res || res.status <= 0 || res.status === 404) continue;
        if (TargetSiteCrawler.isNotFoundResponse(res.status, res.body)) continue;
        if (TargetSiteCrawler.isChallengeOrWafResponse(res.status, res.body)) continue;

        const mimeType = res.headers?.['content-type'] || (ep.endsWith('.json') ? 'application/json' : 'text/plain');
        if (res.status >= 200 && res.status < 300 && res.body && res.body.trim().length > 5) {
          if (onProgress) onProgress(`[API & Manifest Sweep] Discovered ${ep} (${res.status} OK)`);
          this.registerQualityResponseItem(
            fullUrl,
            targetHost,
            'GET',
            res.status,
            res.statusText || 'OK',
            res.headers || {},
            res.body,
            mimeType,
            undefined,
            onItemDiscovered
          );
        }

        // If GraphQL endpoint responds, execute GraphQL schema introspection & Clairvoyance field recovery
        if ((ep === '/graphql' || ep === '/api/graphql') && (res.status === 200 || res.status === 400 || res.status === 405)) {
          try {
            const gql = new GraphQLEngine(fullUrl, {});
            const schema = await gql.introspectSchema().catch(() => gql.recoverSchemaViaFieldSuggestions());
            if (schema && (schema.queries.length > 0 || schema.mutations.length > 0)) {
              for (const q of schema.queries) {
                const qPath = `${ep}?query=${encodeURIComponent(`{ ${q.name} }`)}`;
                this.registerDiscoveredUrl(qPath, targetHost, fullUrl, 'GraphQL-Introspection', `[GraphQL Query] ${q.name}`, onItemDiscovered, 'POST');
              }
              for (const m of schema.mutations) {
                const mPath = `${ep}?mutation=${encodeURIComponent(`mutation { ${m.name} }`)}`;
                this.registerDiscoveredUrl(mPath, targetHost, fullUrl, 'GraphQL-Introspection', `[GraphQL Mutation] ${m.name}`, onItemDiscovered, 'POST');
              }
              if (schema.queries.length > 0 || schema.mutations.length > 0) {
                this.collectedRequestSchemas.push({
                  name: 'GraphQLSchema',
                  fields: [...schema.queries.map((q) => `query:${q.name}`), ...schema.mutations.map((m) => `mutation:${m.name}`)],
                  sourceFile: ep,
                });
              }
            }
          } catch {}
        }
      } catch {}
    }
  }

  /**
   * Compiles the complete 4-Pillar WebsiteKnowledgeBase from all intelligence gathered during the Stealth Crawl,
   * clusters the attack surface, audits IDOR candidates, and caches it for AI agents and the UI.
   */
  public async compileAndCacheStealthKnowledgeBase(
    targetHost: string,
    rootUrl: string,
    infraReport?: InfrastructureReconReport | null,
    gauUrls: GauDiscoveredUrl[] = [],
    robotsResult?: RobotsTxtResult | null
  ): Promise<WebsiteKnowledgeBase> {
    const cleanHost = targetHost.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const allRequests = Array.from(this.discoveredItemsMap.values());

    // Normalize and cluster all discovered endpoints
    const normalizedForClustering = allRequests
      .map((r) => {
        const full = r.url.startsWith('http') ? r.url : `https://${cleanHost}${r.path.startsWith('/') ? r.path : '/' + r.path}`;
        const norm = endpointNormalizer.normalize(full, `https://${cleanHost}`, r.method);
        if (!norm) return null;
        return {
          endpoint: norm,
          statusCode: r.status || 200,
          responseLength: r.length || 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const clusteredAttackSurface = endpointNormalizer.clusterEndpoints(normalizedForClustering.map((x) => x.endpoint));

    // Audit top parameterized/numeric endpoints for IDOR candidates
    const idorCandidates: IdorFinding[] = [];
    for (const item of allRequests.filter((r) => r.params || /\/\d+/.test(r.path)).slice(0, 12)) {
      try {
        const finding = await idorAndHiddenEndpointHunter.auditEndpointForIdor(item, cleanHost, []);
        if (finding) idorCandidates.push(finding);
      } catch {}
    }

    const fallbackInfra: InfrastructureReconReport = (infraReport as any) || ({
      targetDomain: cleanHost,
      timestamp: Date.now(),
      dnsRecords: [],
      emailSecurity: {
        spfNetblocks: [],
        spfIncludes: [],
        dmarcReportingUris: [],
        dkimSelectorsFound: [],
        detectedSaaSVendors: [],
      },
      ctSubdomains: [],
      takeoverAlerts: [],
      originAnalysis: {
        primaryIps: [],
        originCandidates: [],
      },
      cloudBuckets: [],
      protocolSurface: {
        http3Supported: false,
        openAltPorts: [],
        detectedProtocols: ['HTTPS'],
      },
    }) as any;

    const kb: WebsiteKnowledgeBase = {
      target: {
        host: cleanHost,
        rootUrl: rootUrl || `https://${cleanHost}/`,
        capturedAt: Date.now(),
        detectedCdnOrWaf: null,
        detectedSaasEcosystem: [],
      },
      pillar1_infrastructure: fallbackInfra,
      pillar2_staticClientDredging: {
        unpackedSourceMaps: [...this.collectedSourceMaps],
        synthesizedLazyChunks: Array.from(this.collectedLazyChunks),
        astExtractedEndpoints: [...this.collectedAstEndpoints] as any,
        nextServerActions: [...this.collectedServerActions] as any,
        extractedRequestSchemas: [...this.collectedRequestSchemas],
        discoveredSecrets: this.collectedSecrets.map((s) => ({ ...s, entropy: (s as any).entropy || 4.0 })) as any,
      },
      pillar3_dynamicBrowserCrawl: {
        cdpConnected: stealthCdpBrowserDriver.connected,
        routerRoutes: [...this.collectedRouterRoutes],
        offlineStorageAndIndexedDb: [...this.collectedOfflineStorage],
        domForms: this.collectedDomForms.map((f) => ({ actionUrl: f.actionUrl, method: f.method, parameters: (f as any).parameters || {} })),
        crawledEndpointsCount: allRequests.length,
      },
      pillar4_historicalArchives: {
        waybackCount: gauUrls.filter((u) => u.source === 'wayback').length,
        commonCrawlCount: gauUrls.filter((u) => u.source === 'commoncrawl').length,
        alienVaultCount: gauUrls.filter((u) => u.source === 'alienvault').length,
        urlScanCount: gauUrls.filter((u) => u.source === 'urlscan').length,
        legacyApiExtrapolations: gauUrls.filter((u) => u.source === 'legacy_extrapolation').map((u) => u.path),
        robotsDisallowedPaths: robotsResult?.disallowedPaths || [],
        archivedJsBundles: gauUrls.filter((u) => u.path.endsWith('.js') || u.path.endsWith('.map')).map((u) => u.url),
        apiDocs: [],
        graphqlIntrospection: [],
        exposedDebugFindings: [],
      },
      clusteredAttackSurface,
      idorCandidates,
      allDiscoveredRequests: allRequests,
    };

    try {
      sentinelAgentBridge.setCachedKnowledgeBase(cleanHost, kb);
      useReconStore.getState().setLatestKnowledgeBase(kb);
    } catch {}

    return kb;
  }

  /**
   * Main Crawling Routine with Universal Recursive DFS Exploration
   */
  public async runStealthCrawl(config: StealthCrawlerConfig): Promise<SiteMapRequest[]> {
    this.isAborted = false;
    this.visitedDomHashes.clear();
    this.clickedSignatures.clear();
    this.discoveredItemsMap.clear();

    // Reset 4-Pillar Knowledge Base accumulators
    this.collectedSourceMaps = [];
    this.collectedLazyChunks.clear();
    this.collectedServerActions = [];
    this.collectedRequestSchemas = [];
    this.collectedSecrets = [];
    this.collectedAstEndpoints = [];
    this.collectedRouterRoutes = [];
    this.collectedOfflineStorage = [];
    this.collectedDomForms = [];
    this.minedInlineScriptHashes.clear();

    const {
      targetHost,
      targetUrl,
      seedUrls = [],
      maxStates = 60,
      maxClicksPerState = 35,
      interactionDelayMs = 500,
      onProgress,
      onItemDiscovered,
    } = config;

    cognitiveFlowAgent.resetState();
    pathTemplateClusterer.reset();
    sourceMapRouteMiner.reset();
    sessionLivenessWatchdog.reset();
    adaptivePacingEngine.setUserSpeedOverride(interactionDelayMs);

    const reportProgress = (action: string) => {
      if (onProgress) {
        onProgress(0, this.discoveredItemsMap.size, action);
      }
    };

    reportProgress('Connecting to system Chrome via CDP (port 9222)...');

    // 1. Establish CDP Connection
    try {
      await stealthCdpBrowserDriver.connect(targetUrl, targetHost);
    } catch (err) {
      console.error('StealthCdpBrowserDriver connection failure:', err);
      throw new Error(`Failed to connect to browser CDP: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Set up Deep Network Interception over CDP
    const pendingResponses = new Map<string, { resp: any; url: string; method: string; postData?: string }>();
    const pendingRequests = new Map<string, { url: string; method: string; postData?: string; headers?: Record<string, string> }>();

    const cleanupRequestListener = stealthCdpBrowserDriver.on('Network.requestWillBeSent', (params) => {
      if (this.isAborted) return;
      const req = params?.request;
      if (!req || !req.url) return;

      try {
        const u = new URL(req.url);
        if (this.isSameTargetHost(u.host, targetHost)) {
          if (params.requestId) {
            if (pendingRequests.size > 200) {
              const oldest = pendingRequests.keys().next().value;
              if (oldest) pendingRequests.delete(oldest);
            }
            pendingRequests.set(params.requestId, {
              url: req.url,
              method: (req.method || 'GET').toUpperCase(),
              postData: req.postData,
              headers: req.headers,
            });
          }
        }
      } catch {}
    });

    const cleanupNetworkListener = stealthCdpBrowserDriver.on('Network.responseReceived', async (params) => {
      if (this.isAborted) return;
      const resp = params?.response;
      if (!resp || !resp.url) return;

      // Telemetry feed into Adaptive Pacing Engine for backoff and rate limit evasion
      if (resp.status) {
        adaptivePacingEngine.recordResult(targetHost, resp.status);
      }

      try {
        const u = new URL(resp.url);
        if (this.isSameTargetHost(u.host, targetHost)) {
          // Strictly filter out tracking, analytics, and telemetry noise
          if (this.isTelemetryOrNoiseUrl(resp.url)) return;

          // Strictly filter out static media and binary assets
          if (this.isStaticAssetUrl(resp.url)) return;

          // Strictly omit 404 Not Found (never clutter sitemap with dead routes)
          if (resp.status === 404) return;

          const reqMeta = params.requestId ? pendingRequests.get(params.requestId) : undefined;
          const method = reqMeta?.method || 'GET';
          const postData = reqMeta?.postData;

          if (params.requestId) {
            if (pendingResponses.size > 200) {
              const oldest = pendingResponses.keys().next().value;
              if (oldest) pendingResponses.delete(oldest);
            }
            pendingResponses.set(params.requestId, { resp, url: resp.url, method, postData });
          }

          let bodyText = '';
          try {
            const bodyObj = await stealthCdpBrowserDriver.getResponseBody(params.requestId, 0);
            if (bodyObj && bodyObj.body) {
              bodyText = await decodeAndDecompressResponseBody(bodyObj.body, bodyObj.base64Encoded, resp.headers);
            }
          } catch {}

          // If body is immediately available or if it's a redirect / no-content response, register quality response
          if (bodyText || resp.status === 204 || resp.status === 301 || resp.status === 302 || resp.status === 304) {
            this.registerQualityResponseItem(
              resp.url,
              targetHost,
              method,
              resp.status,
              resp.statusText || 'OK',
              resp.headers || {},
              bodyText,
              resp.mimeType,
              postData,
              onItemDiscovered
            );
          }
        }
      } catch {}
    });

    const cleanupLoadingFinishedListener = stealthCdpBrowserDriver.on('Network.loadingFinished', async (params) => {
      if (this.isAborted) return;
      const reqId = params?.requestId;
      if (!reqId || !pendingResponses.has(reqId)) return;
      const meta = pendingResponses.get(reqId)!;
      pendingResponses.delete(reqId);
      if (reqId) pendingRequests.delete(reqId);

      try {
        const bodyObj = await stealthCdpBrowserDriver.getResponseBody(reqId, 2);
        const bodyText = bodyObj
          ? await decodeAndDecompressResponseBody(bodyObj.body, bodyObj.base64Encoded, meta.resp.headers)
          : '';

        this.registerQualityResponseItem(
          meta.url,
          targetHost,
          meta.method || 'GET',
          meta.resp.status || 200,
          meta.resp.statusText || 'OK',
          meta.resp.headers || {},
          bodyText,
          meta.resp.mimeType,
          meta.postData,
          onItemDiscovered
        );
      } catch {}
    });

    const cleanupLoadingFailedListener = stealthCdpBrowserDriver.on('Network.loadingFailed', (params) => {
      if (params?.requestId) {
        pendingRequests.delete(params.requestId);
        pendingResponses.delete(params.requestId);
      }
    });

    const cleanupWsCreatedListener = stealthCdpBrowserDriver.on('Network.webSocketCreated', (params) => {
      if (this.isAborted) return;
      const wsUrl = params?.url;
      if (!wsUrl || this.isTelemetryOrNoiseUrl(wsUrl)) return;
      try {
        const u = new URL(wsUrl);
        if (this.isSameTargetHost(u.host, targetHost)) {
          this.registerDiscoveredUrl(wsUrl, targetHost, wsUrl, 'Network-WebSocket', `WebSocket: ${u.pathname}`, onItemDiscovered);
        }
      } catch {}
    });

    const cleanupWsFrameListener = stealthCdpBrowserDriver.on('Network.webSocketFrameReceived', (_params) => {
      // Intentionally suppress speculative regex spam from WebSocket frames
    });

    // =========================================================================
    // SOVEREIGN STEALTH EXPLORATION: Pure Human-Like Interactive Navigation
    // =========================================================================
    const homeUrl = targetUrl || `https://${targetHost}/`;
    const dynamicSeedUrls: string[] = [...seedUrls];
    let infraPromise: Promise<InfrastructureReconReport | null> = Promise.resolve(null);
    let gauPromise: Promise<any[]> = Promise.resolve([]);
    let robotsPromise: Promise<RobotsTxtResult | null> = Promise.resolve(null);

    reportProgress(`[Stealth Mode] Engaging live Chromium browser on ${homeUrl}...`);

    try {
      // 1. Ensure the browser is on the target host page
      const currentLive = await stealthCdpBrowserDriver.getLiveUrl();
      if (!currentLive || !this.isSameTargetHost(currentLive, targetHost) || currentLive.startsWith('chrome-error') || currentLive.includes('chromewebdata')) {
        reportProgress(`Navigating browser to ${homeUrl}...`);
        await stealthCdpBrowserDriver.navigate(homeUrl);
      }

      // Inject client runtime omniscience instrumentation immediately
      await clientRuntimeOmniscienceService.injectInstrumentation();

      await this.waitForInterstitialToResolve(20000, reportProgress, targetHost);
      await stealthCdpBrowserDriver.dismissBlockingModalsAndOverlays();

      // 2. Initial human-like smooth scroll: scrolls down and back up to see all buttons and trigger dynamic components
      reportProgress(`[Human Simulation] Performing initial smooth scroll & viewport scan to reveal all buttons and interactive elements...`);
      try {
        await stealthCdpBrowserDriver.dispatchSmoothScroll(400);
        await new Promise((r) => setTimeout(r, 300));
        await stealthCdpBrowserDriver.dispatchSmoothScroll(600);
        await new Promise((r) => setTimeout(r, 300));
        await stealthCdpBrowserDriver.dispatchSmoothScroll(-900); // Smooth scroll back up
        await stealthCdpBrowserDriver.waitForDomSettle(800);
      } catch {}

      // Register live initial page DOM as quality response item (200 OK)
      const postNavLive = (await stealthCdpBrowserDriver.getLiveUrl()) || homeUrl;
      const homeHtml = (await stealthCdpBrowserDriver.evaluate<string>('document.documentElement ? document.documentElement.outerHTML : ""')) || '';
      if (homeHtml && homeHtml.length > 50 && DestructiveActionKernel.isSafeUrl(postNavLive)) {
        this.registerQualityResponseItem(
          postNavLive,
          targetHost,
          'GET',
          200,
          'OK',
          { 'content-type': 'text/html; charset=utf-8' },
          homeHtml,
          'text/html',
          undefined,
          onItemDiscovered
        );
      }

      // 3. Concurrent Pre-Reconnaissance: Run Infrastructure De-Cloaking, Historical Archives, Robots/Sitemap & Authenticated API/Well-Known Sweep
      try {
        infraPromise = infrastructureOriginService
          .runFullInfrastructureRecon(targetHost, homeHtml ? [homeHtml] : [], (item) => {
            this.registerDiscoveredUrl(item.url, targetHost, item.path, 'InfraRecon', item.title || item.path, onItemDiscovered);
          })
          .catch((err) => {
            console.warn('Background Infra Recon in Stealth Crawler notice:', err);
            return null;
          });

        gauPromise = gauArchiveService
          .runGauMining({
            targetDomain: targetHost,
            limit: 150,
            onItemDiscovered: (item) => {
              this.registerDiscoveredUrl(item.url, targetHost, item.path, 'GauArchive', item.title || item.path, onItemDiscovered);
              if (DestructiveActionKernel.isSafeUrl(item.path) && !dynamicSeedUrls.includes(item.path)) {
                dynamicSeedUrls.push(item.url.startsWith('http') ? item.url : `https://${targetHost}${item.path}`);
              }
            },
          })
          .catch((err) => {
            console.warn('Background GAU mining in Stealth Crawler notice:', err);
            return [];
          });

        robotsPromise = robotsTxtDiscoveryService
          .fetchAndParseRobotsTxt(homeUrl)
          .then((res) => {
            robotsTxtDiscoveryService.generateSiteMapEntries(targetHost, res, (item: SiteMapRequest) => {
              this.registerDiscoveredUrl(item.url, targetHost, item.path, 'Robots-Sitemap', item.title || item.path, onItemDiscovered);
              if (DestructiveActionKernel.isSafeUrl(item.path) && !dynamicSeedUrls.includes(item.path)) {
                dynamicSeedUrls.push(item.url.startsWith('http') ? item.url : `https://${targetHost}${item.path}`);
              }
            });
            return res;
          })
          .catch(() => null);

        // Authenticated in-browser sweep of OpenAPI/Swagger, .well-known OIDC/Universal Links, manifests, and GraphQL
        await this.runAuthenticatedApiAndWellKnownSweep(targetHost, onItemDiscovered, reportProgress);

        // Dredge IndexedDB, global state trees (__INITIAL_STATE__, __APOLLO_STATE__), and resource timings
        const dredgedStorage = await clientRuntimeOmniscienceService.dredgeOfflineStorage();
        for (const item of dredgedStorage) {
          this.registerDiscoveredUrl(item.url, targetHost, postNavLive, `Omniscience-${item.source}`, item.title || item.url, onItemDiscovered);
          if (!this.collectedOfflineStorage.some((d) => d.url === item.url)) {
            this.collectedOfflineStorage.push(item);
          }
          if (DestructiveActionKernel.isSafeUrl(item.url) && !dynamicSeedUrls.includes(item.url)) {
            dynamicSeedUrls.push(item.url.startsWith('http') ? item.url : `https://${targetHost}${item.url}`);
          }
        }
      } catch (reconErr) {
        console.warn('Pre-reconnaissance execution notice:', reconErr);
      }

      // If master sidebar exists, traverse it
      try {
        await this.crawlMasterSidebar(
          targetHost,
          postNavLive,
          reportProgress,
          onItemDiscovered,
          interactionDelayMs
        );
      } catch (sidebarErr) {
        console.warn('Master sidebar crawl error:', sidebarErr);
      }
    } catch (navErr) {
      console.warn('Initial setup error in stealth crawl:', navErr);
    }

    // =========================================================================
    // AUTONOMOUS DEEP INTERACTIVE DFS TRAVERSAL
    // Clicks all buttons, types into inputs, follows links, explores every page
    // =========================================================================
    const dfsContext: DfsExploreContext = {
      targetHost,
      authenticatedRootUrl: targetUrl || `https://${targetHost}/`,
      isAlreadyOnHost: true,
      visitedPageUrls: new Set<string>(),
      activeStack: new Set<string>(),
      stateCounter: { count: 0 },
      paginationPatternCounts: new Map<string, number>(),
      maxStates: maxStates || 80,
      maxClicksPerState: maxClicksPerState || 40,
      maxDepth: 5,
      interactionDelayMs: interactionDelayMs || 500,
      onProgress,
      onItemDiscovered,
    };

    const rootCrawlUrl = (await stealthCdpBrowserDriver.getLiveUrl()) || homeUrl;
    reportProgress(`[Stealth Explorer] Starting deep interactive exploration on ${rootCrawlUrl}...`);
    await this.exploreStateDfs(rootCrawlUrl, 0, dfsContext);

    // Follow any explicit or dynamically harvested seeds (from GAU / Offline Storage / Robots)
    for (const seed of dynamicSeedUrls) {
      if (this.isAborted || dfsContext.stateCounter.count >= dfsContext.maxStates) break;
      const cleanSeed = seed.split('#')[0];
      if (!dfsContext.visitedPageUrls.has(cleanSeed) && DestructiveActionKernel.isSafeUrl(cleanSeed)) {
        await this.exploreStateDfs(cleanSeed, 0, dfsContext);
      }
    }

    // Resolve any remaining unrequested endpoints using the live browser session context
    // This auto-fetches authentic live responses, prunes 404s, and guarantees rendered data
    if (!this.isAborted) {
      reportProgress(`Resolving authentic live responses for discovered endpoints...`);
      try {
        await this.resolveUnrequestedDiscoveredItems(
          targetHost,
          (msg) => reportProgress(msg),
          onItemDiscovered,
          50
        );
      } catch (resErr) {
        console.warn('Error resolving unrequested items:', resErr);
      }
    }

    cleanupRequestListener();
    cleanupNetworkListener();
    cleanupLoadingFinishedListener();
    cleanupLoadingFailedListener();
    cleanupWsCreatedListener();
    cleanupWsFrameListener();

    // Await concurrent background recon pillars and compile + cache the full 4-Pillar WebsiteKnowledgeBase
    try {
      const [infraReport, gauUrls, robotsResult] = await Promise.all([
        infraPromise,
        gauPromise,
        robotsPromise,
      ]);
      await this.compileAndCacheStealthKnowledgeBase(
        targetHost,
        homeUrl,
        infraReport,
        gauUrls,
        robotsResult
      );
    } catch (kbErr) {
      console.warn('Failed to compile Stealth Knowledge Base:', kbErr);
    }

    reportProgress(`Stealth crawl completed. Explored ${dfsContext.stateCounter.count} states, mapped ${this.discoveredItemsMap.size} surfaces.`);
    return Array.from(this.discoveredItemsMap.values());
  }
}

export const stateFlowGraphCrawler = new StateFlowGraphCrawler();

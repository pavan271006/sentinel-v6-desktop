import { describe, it, expect } from 'vitest';
import { HoneypotDefenseEngine } from '../HoneypotDefenseEngine';
import { CaptchaSentinelEngine } from '../CaptchaSentinelEngine';
import { AdaptivePacingEngine } from '../AdaptivePacingEngine';
import { CrawlPatternRandomizer, CandidateAction } from '../CrawlPatternRandomizer';
import { RobotsTxtDiscoveryService, RobotsTxtResult } from '../RobotsTxtDiscoveryService';

describe('Sentinel Frontier Anti-Bot & Crawler Defense Engines', () => {

  // ─── 1. Honeypot Defense Engine ──────────────────────────────────────────
  describe('HoneypotDefenseEngine', () => {
    it('accurately identifies honeypot trap URLs', () => {
      expect(HoneypotDefenseEngine.isHoneypotUrl('/api/honeypot/test')).toBe(true);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/bot-trap/click-here')).toBe(true);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/spider-trap')).toBe(true);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/fake-login')).toBe(true);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/products?hp=1')).toBe(true);

      // Normal benign endpoints
      expect(HoneypotDefenseEngine.isHoneypotUrl('/admin/dashboard')).toBe(false);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/api/v1/users')).toBe(false);
      expect(HoneypotDefenseEngine.isHoneypotUrl('/profile/password')).toBe(false);
    });

    it('generates valid in-browser honeypot detection script', () => {
      const script = HoneypotDefenseEngine.getInBrowserHoneypotDetectorScript();
      expect(script).toContain('__SENTINEL_IS_HONEYPOT_OR_TRAP__');
      expect(script).toContain('DisplayNone');
      expect(script).toContain('VisibilityHidden');
      expect(script).toContain('OffScreenCoordinates');
      expect(script).toContain('TrapTokenMatch');
    });
  });

  // ─── 2. CAPTCHA Sentinel Engine ──────────────────────────────────────────
  describe('CaptchaSentinelEngine', () => {
    it('generates in-browser detection script covering major commercial providers', () => {
      const script = CaptchaSentinelEngine.getInBrowserDetectionScript();
      expect(script).toContain('Cloudflare Turnstile');
      expect(script).toContain('Cloudflare Interstitial');
      expect(script).toContain('Google reCAPTCHA');
      expect(script).toContain('hCaptcha');
      expect(script).toContain('AWS WAF CAPTCHA');
      expect(script).toContain('Arkose Labs FunCaptcha');
      expect(script).toContain('GeeTest');
      expect(script).toContain('PerimeterX HUMAN');
      expect(script).toContain('DataDome');
      expect(script).toContain('Kasada');
      expect(script).toContain('performing security verification');
      expect(script).toContain('cf-turnstile-response');
    });

    it('distinguishes between pending and solved Turnstile tokens in detection script', () => {
      const script = CaptchaSentinelEngine.getInBrowserDetectionScript();
      expect(script).toContain('hasTurnstileToken');
      expect(script).toContain('hasTurnstileElement && !hasTurnstileToken');
      expect(script).toContain('hasRcElement && !hasRcToken');
      expect(script).toContain('hasHcElement && !hasHcToken');
    });
  });

  // ─── 3. Adaptive Pacing & Circuit Breaker Engine ─────────────────────────
  describe('AdaptivePacingEngine', () => {
    it('applies biological jitter within configured ratio bounds', () => {
      const engine = new AdaptivePacingEngine({
        baseInteractionDelayMs: 1000,
        jitterRatio: 0.3,
        maxActionsPerSecond: 10
      });

      for (let i = 0; i < 20; i++) {
        const delay = engine.calculateDelay('test.com');
        // Base 1000 with 0.3 jitter should stay in [700, 1300] range
        expect(delay).toBeGreaterThanOrEqual(690);
        expect(delay).toBeLessThanOrEqual(1310);
      }
    });

    it('triggers exponential backoff on HTTP 429 and 503', () => {
      const engine = new AdaptivePacingEngine({
        baseInteractionDelayMs: 500,
        maxBackoffMs: 10000,
        consecutiveErrorThreshold: 3
      });

      const host = 'api.target.com';
      let metrics = engine.getMetricsForHost(host);
      expect(metrics.currentBackoffMs).toBe(0);

      // Record first 429 error
      engine.recordResult(host, 429);
      metrics = engine.getMetricsForHost(host);
      expect(metrics.currentBackoffMs).toBe(2000);
      expect(metrics.consecutiveErrors).toBe(1);
      expect(metrics.circuitTripped).toBe(false);

      // Record second 429 error -> doubles to 4000
      engine.recordResult(host, 429);
      metrics = engine.getMetricsForHost(host);
      expect(metrics.currentBackoffMs).toBe(4000);
      expect(metrics.consecutiveErrors).toBe(2);

      // Record third 429 error -> trips circuit breaker
      engine.recordResult(host, 429);
      metrics = engine.getMetricsForHost(host);
      expect(metrics.currentBackoffMs).toBe(8000);
      expect(metrics.consecutiveErrors).toBe(3);
      expect(metrics.circuitTripped).toBe(true);

      // Successful 200 relieves pressure
      engine.recordResult(host, 200);
      metrics = engine.getMetricsForHost(host);
      expect(metrics.circuitTripped).toBe(false);
      expect(metrics.consecutiveErrors).toBe(2);
      expect(metrics.currentBackoffMs).toBe(4000);
    });
  });

  // ─── 4. Crawl Pattern Randomizer ─────────────────────────────────────────
  describe('CrawlPatternRandomizer', () => {
    it('shuffles elements while preserving count and members', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = CrawlPatternRandomizer.shuffle(items);

      expect(shuffled.length).toBe(items.length);
      expect(shuffled.sort()).toEqual(items.sort());
    });

    it('prioritizes primary navigation over deep content links', () => {
      const candidates: CandidateAction[] = [
        { type: 'link', name: 'Blog Post 1' },
        { type: 'tab', name: 'Settings Tab' },
        { type: 'button', name: 'Submit Button' },
        { type: 'dropdown', name: 'Profile Menu' },
        { type: 'link', name: 'Footer About' }
      ];

      const ordered = CrawlPatternRandomizer.randomizeCandidateQueue(candidates);
      expect(ordered.length).toBe(candidates.length);

      // First items must be primaryNav (tab, dropdown)
      const firstTwoTypes = [ordered[0].type, ordered[1].type];
      expect(firstTwoTypes).toContain('tab');
      expect(firstTwoTypes).toContain('dropdown');

      // Middle must be interactive (button)
      expect(ordered[2].type).toBe('button');

      // End must be regular links
      const lastTwoTypes = [ordered[3].type, ordered[4].type];
      expect(lastTwoTypes).toContain('link');
    });
  });

  // ─── 5. Robots.txt Discovery Service ────────────────────────────────────
  describe('RobotsTxtDiscoveryService', () => {
    it('generates high value reconnaissance entries from Disallow directives', () => {
      const service = new RobotsTxtDiscoveryService();
      const mockResult: RobotsTxtResult = {
        disallowedPaths: ['/admin', '/internal/api/keys', '/backup/db.sql', '/debug/info'],
        allowedPaths: ['/public'],
        sitemaps: ['https://target.com/sitemap.xml'],
        sitemapUrls: [],
        crawlDelay: 2
      };

      const discovered: any[] = [];
      const items = service.generateSiteMapEntries('target.com', mockResult, (item) => discovered.push(item));

      expect(items.length).toBe(4);
      expect(discovered.length).toBe(4);

      const adminItem = items.find(i => i.path === '/admin');
      expect(adminItem).toBeDefined();
      expect(adminItem?.notes).toContain('Disallow directive (High Value Target)');
      expect(adminItem?.reqAttributes.Source).toBe('robots.txt');
    });
  });
});

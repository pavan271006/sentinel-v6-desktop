import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adaptivePacingEngine, AdaptivePacingEngine } from '../../src/services/contentDiscovery/AdaptivePacingEngine';
import { stateFlowGraphCrawler } from '../../src/services/contentDiscovery/StateFlowGraphCrawler';
import { stealthCdpBrowserDriver } from '../../src/services/contentDiscovery/StealthCdpBrowserDriver';

describe('Adaptive Anti-Block & Dynamic Pacing Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AdaptivePacingEngine', () => {
    it('initializes with default base delay and adjusts dynamically upon block', () => {
      const engine = new AdaptivePacingEngine({ baseInteractionDelayMs: 600 });
      const metrics = engine.getMetricsForHost('flipkart.com');

      expect(metrics.isStealthThrottled).toBe(false);
      expect(engine.isHostThrottled('flipkart.com')).toBe(false);

      // Trigger dynamic slowdown
      engine.triggerDynamicSlowdown('flipkart.com', 'Flipkart Anti-Bot Throttle / Access Denied', 5);

      expect(engine.isHostThrottled('flipkart.com')).toBe(true);
      expect(metrics.isStealthThrottled).toBe(true);
      expect(metrics.dynamicBaseDelayMs).toBeGreaterThanOrEqual(2500);
      expect(metrics.currentBackoffMs).toBe(5000);
      expect(metrics.throttleReason).toContain('Flipkart');

      // Delay calculation should now reflect dynamic slowed-down delay
      const delay = engine.calculateDelay('flipkart.com');
      // delay should include base + jitter + backoff
      expect(delay).toBeGreaterThanOrEqual(5000);
    });

    it('relieves backoff and recovers safe pacing floor after sustained successes', () => {
      const engine = new AdaptivePacingEngine({ baseInteractionDelayMs: 600 });
      engine.triggerDynamicSlowdown('target.com', 'Rate limit', 4);

      const metrics = engine.getMetricsForHost('target.com');
      expect(metrics.currentBackoffMs).toBe(4000);

      // Record several successful requests (200 OK)
      for (let i = 0; i < 10; i++) {
        engine.recordResult('target.com', 200);
      }

      // Backoff should have decayed to 0
      expect(metrics.currentBackoffMs).toBe(0);
      // Safe floor should be maintained so site does not immediately re-block
      expect(metrics.dynamicBaseDelayMs).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('StateFlowGraphCrawler Dynamic Block Detection', () => {
    it('detects Akamai and Flipkart Access Denied signatures', async () => {
      vi.spyOn(stealthCdpBrowserDriver, 'evaluate').mockResolvedValueOnce({
        isBlocked: true,
        reason: 'Akamai Access Denied (Reference #)',
        hasInteractiveRecovery: true,
      });

      const res = await stateFlowGraphCrawler.detectDynamicBlock('flipkart.com', 'https://www.flipkart.com/search?q=laptop');
      expect(res.isBlocked).toBe(true);
      expect(res.reason).toContain('Akamai Access Denied');
      expect(res.hasInteractiveRecovery).toBe(true);
    });

    it('detects Cloudflare Turnstile / verification challenge', async () => {
      vi.spyOn(stealthCdpBrowserDriver, 'evaluate').mockResolvedValueOnce({
        isBlocked: true,
        reason: 'Cloudflare Verification Challenge',
        isChallenge: true,
        hasInteractiveRecovery: false,
      });

      const res = await stateFlowGraphCrawler.detectDynamicBlock('protected-site.com', 'https://protected-site.com/');
      expect(res.isBlocked).toBe(true);
      expect(res.isChallenge).toBe(true);
      expect(res.reason).toContain('Cloudflare');
    });

    it('detects HTTP 429 Too Many Requests and HTTP 403 Forbidden', async () => {
      vi.spyOn(stealthCdpBrowserDriver, 'evaluate').mockResolvedValueOnce({
        isBlocked: true,
        reason: 'HTTP 429 Too Many Requests',
        hasInteractiveRecovery: true,
      });

      const res429 = await stateFlowGraphCrawler.detectDynamicBlock('api.target.com', 'https://api.target.com/items');
      expect(res429.isBlocked).toBe(true);
      expect(res429.reason).toContain('429');
    });

    it('returns isBlocked: false for normal pages', async () => {
      vi.spyOn(stealthCdpBrowserDriver, 'evaluate').mockResolvedValueOnce({
        isBlocked: false,
        hasInteractiveRecovery: false,
      });

      const res = await stateFlowGraphCrawler.detectDynamicBlock('example.com', 'https://example.com/');
      expect(res.isBlocked).toBe(false);
    });
  });

  describe('StateFlowGraphCrawler Slow Retry and Recovery', () => {
    it('successfully recovers when page unblocks after slow retry', async () => {
      // Mock CDP actions
      vi.spyOn(stealthCdpBrowserDriver, 'dispatchHumanClick').mockResolvedValue();
      vi.spyOn(stealthCdpBrowserDriver, 'dispatchSmoothScroll').mockResolvedValue();
      vi.spyOn(stealthCdpBrowserDriver, 'navigate').mockResolvedValue(200);
      vi.spyOn(stealthCdpBrowserDriver, 'waitForDomSettle').mockResolvedValue();
      vi.spyOn(stateFlowGraphCrawler as any, 'waitForInterstitialToResolve').mockResolvedValue(undefined);

      // First evaluate for button click: returns false (no retry button, re-navigates)
      // Second evaluate for liveInfo DOM capture: returns html
      vi.spyOn(stealthCdpBrowserDriver, 'evaluate')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce({
          html: '<html><body><h1>Real Product Content</h1><a href="/p1">Product 1</a></body></html>',
          title: 'Laptops Online',
          liveUrl: 'https://www.flipkart.com/laptops'
        });

      // Mock detectDynamicBlock to return unblocked on retry
      vi.spyOn(stateFlowGraphCrawler, 'detectDynamicBlock').mockResolvedValueOnce({
        isBlocked: false,
        hasInteractiveRecovery: false,
      });

      const ctx: any = {
        targetHost: 'flipkart.com',
        stateCounter: { count: 1 },
        visitedPageUrls: new Set<string>(),
        activeStack: new Set<string>(),
        onProgress: vi.fn(),
        onItemDiscovered: vi.fn(),
      };

      const recovered = await stateFlowGraphCrawler.handleDynamicBlockAndSlowRetry(
        'https://www.flipkart.com/laptops',
        ctx,
        1,
        'Akamai Access Denied (Reference #)'
      );

      expect(recovered).toBe(true);
      expect(adaptivePacingEngine.isHostThrottled('flipkart.com')).toBe(true);
    });
  });
});

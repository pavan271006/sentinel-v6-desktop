/**
 * Sentinel Sovereign Ω - Adversarial Stress Test Suite for EndpointNormalizer
 * src/services/contentDiscovery/__tests__/endpointNormalizerAdversarial.test.ts
 *
 * Adversarial challenger harness testing:
 * 1. Deeply nested relative paths & dot segment resolution
 * 2. Hash route parsing, SPA transitions, and anchor leakage
 * 3. Obscure marketing params & tracking tokens
 * 4. Pathological REST parameter inputs & classification boundaries
 * 5. ReDoS vulnerability & performance degradation under worst-case inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EndpointNormalizer } from '../EndpointNormalizer';

describe('Adversarial Stress Testing: EndpointNormalizer', () => {
  let normalizer: EndpointNormalizer;

  beforeEach(() => {
    normalizer = new EndpointNormalizer(3);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Category 1: Deeply Nested Relative Paths & Dot Segments
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Category 1: Deeply Nested Relative Paths & Dot Segments', () => {
    it('1.1 Traversal attempting to escape root on standard URL', () => {
      const res = normalizer.normalize('../../../../../../../../etc/passwd', 'https://target.com/a/b/c');
      expect(res).not.toBeNull();
      // WHATWG collapses leading .. at root
      expect(res!.pathname).toBe('/etc/passwd');
      expect(res!.canonicalUrl).toBe('https://target.com/etc/passwd');
    });

    it('1.2 Protocol-relative URL with external host', () => {
      const res = normalizer.normalize('//evil.com/phish/login', 'https://target.com');
      expect(res).not.toBeNull();
      expect(res!.origin).toBe('https://evil.com');
      expect(res!.canonicalUrl).toBe('https://evil.com/phish/login');
      // Empirical verification: what is isInternal when targetHost is not provided?
      // When targetHost is not provided, does isInternal accurately classify evil.com as external?
      console.log('1.2 isInternal without targetHost:', res!.isInternal);
    });

    it('1.3 Protocol-relative URL with targetHost explicitly provided', () => {
      const res = normalizer.normalize('//evil.com/phish/login', 'https://target.com', 'target.com');
      expect(res).not.toBeNull();
      expect(res!.isInternal).toBe(false);
    });

    it('1.4 normalizeEndpoint interface contract with external URL', () => {
      // normalizeEndpoint only takes (rawUrl, baseUrl)
      const res = normalizer.normalizeEndpoint('https://evil.com/phish', 'https://target.com');
      console.log('1.4 normalizeEndpoint isInternal for evil.com:', res.isInternal);
    });

    it('1.5 Percent-encoded dot segments (%2e%2e)', () => {
      const res = normalizer.normalize('https://target.com/api/v1/%2e%2e/%2e%2e/etc/passwd');
      expect(res).not.toBeNull();
      console.log('1.5 Percent-encoded dot segment result:', {
        pathname: res!.pathname,
        canonicalUrl: res!.canonicalUrl
      });
    });

    it('1.6 Dot segments inside SPA hash routes', () => {
      const res = normalizer.normalize('https://target.com/#/api/v1/../../etc/passwd');
      expect(res).not.toBeNull();
      console.log('1.6 Hash route dot segment result:', {
        pathname: res!.pathname,
        canonicalUrl: res!.canonicalUrl
      });
    });

    it('1.7 Extreme path traversal with 500 dot segments', () => {
      const nested = '../'.repeat(500) + 'admin';
      const start = performance.now();
      const res = normalizer.normalize(nested, 'https://target.com/a/b/c/d/e');
      const duration = performance.now() - start;
      expect(res).not.toBeNull();
      expect(res!.pathname).toBe('/admin');
      expect(duration).toBeLessThan(50); // Must be fast
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Category 2: Hash Routes & Anchor Leaks
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Category 2: Hash Routes & Anchor Leaks', () => {
    it('2.1 Hash route with query parameter and trailing anchor (/#/users?id=1#anchor)', () => {
      const res = normalizer.normalize('https://target.com/#/users?id=1#anchor');
      expect(res).not.toBeNull();
      console.log('2.1 Hash route with query and anchor:', {
        pathname: res!.pathname,
        canonicalUrl: res!.canonicalUrl,
        queryParams: res!.queryParams
      });
    });

    it('2.2 AngularJS hashbang with query and anchor (/#!/search?q=test#top)', () => {
      const res = normalizer.normalize('https://target.com/#!/search?q=test#top');
      expect(res).not.toBeNull();
      console.log('2.2 AngularJS hashbang with query and anchor:', {
        pathname: res!.pathname,
        canonicalUrl: res!.canonicalUrl,
        queryParams: res!.queryParams
      });
    });

    it('2.3 Hash route with anchor and NO query (/#/users#anchor)', () => {
      const res = normalizer.normalize('https://target.com/#/users#anchor');
      expect(res).not.toBeNull();
      console.log('2.3 Hash route with anchor and no query:', {
        pathname: res!.pathname,
        canonicalUrl: res!.canonicalUrl
      });
    });

    it('2.4 Double hash routes (##doublehash, ##/doublehash)', () => {
      const res1 = normalizer.normalize('https://target.com/##doublehash');
      const res2 = normalizer.normalize('https://target.com/##/doublehash');
      console.log('2.4 Double hash results:', {
        doublehash1: res1 ? { pathname: res1.pathname, canonicalUrl: res1.canonicalUrl } : null,
        doublehash2: res2 ? { pathname: res2.pathname, canonicalUrl: res2.canonicalUrl } : null
      });
    });

    it('2.5 Empty or root hashes (/#, /#/, /#!/, ##)', () => {
      const h1 = normalizer.normalize('https://target.com/#');
      const h2 = normalizer.normalize('https://target.com/#/');
      const h3 = normalizer.normalize('https://target.com/#!/');
      const h4 = normalizer.normalize('https://target.com/##');
      console.log('2.5 Empty hash results:', {
        h1: h1?.canonicalUrl,
        h2: h2?.canonicalUrl,
        h3: h3?.canonicalUrl,
        h4: h4?.canonicalUrl
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Category 3: Obscure Marketing & Tracking Parameters
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Category 3: Obscure Marketing & Tracking Parameters', () => {
    it('3.1 Obscure tracking parameters (gad_source, _kx, pk_campaign, hsa_cam, etc.)', () => {
      const testCases = [
        { param: 'gad_source=1', name: 'Google Ads Modern' },
        { param: '_kx=abc123xyz', name: 'Klaviyo' },
        { param: 'pk_campaign=spring_sale&pk_kwd=shoes', name: 'Matomo/Piwik' },
        { param: 'hsa_cam=12345&hsa_grp=67890', name: 'HubSpot Ads' },
        { param: 's_kwcid=AL!123', name: 'Adobe Analytics' },
        { param: 'rdt_cid=reddit123', name: 'Reddit Ads' },
        { param: 'irclickid=impact123', name: 'Impact' },
        { param: 'tblci=taboola123', name: 'Taboola' },
        { param: 'dicbo=outbrain123', name: 'Outbrain' },
        { param: 'epik=pinterest123', name: 'Pinterest' }
      ];

      for (const tc of testCases) {
        const url = `https://target.com/product/101?item=laptop&${tc.param}`;
        const res = normalizer.normalize(url);
        const stripped = !res!.canonicalUrl.includes(tc.param.split('=')[0]);
        console.log(`3.1 ${tc.name} (${tc.param.split('=')[0]}): ${stripped ? 'STRIPPED' : 'PRESERVED (not recognized)'}`);
      }
    });

    it('3.2 False positive cachebuster stripping on legitimate numeric IDs (id=1712345678)', () => {
      // 10-digit number e.g. 1712345678 (matches /^\d{10}(?:\d{3})?$/)
      // When key length <= 4 (e.g. 'id', 'pid', 'item', 'uid')
      const url = 'https://target.com/user?id=1712345678&name=alice';
      const res = normalizer.normalize(url);
      console.log('3.2 Legitimate 10-digit ID param (?id=1712345678):', {
        canonicalUrl: res!.canonicalUrl,
        queryParams: res!.queryParams,
        idPreserved: 'id' in res!.queryParams
      });
    });

    it('3.3 Case sensitivity in tracking parameters (UTM_SOURCE=google, GCLID=test)', () => {
      const url = 'https://target.com/catalog?item=shoes&UTM_SOURCE=google&GCLID=xyz';
      const res = normalizer.normalize(url);
      console.log('3.3 Uppercase tracking parameters:', {
        canonicalUrl: res!.canonicalUrl,
        queryParams: res!.queryParams
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Category 4: Pathological REST Parameter Inputs
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Category 4: Pathological REST Parameter Inputs', () => {
    it('4.1 1000-character numeric ID', () => {
      const longId = '9'.repeat(1000);
      const url = `/api/v1/users/${longId}/profile`;
      const template = normalizer.generateRouteTemplate(url);
      expect(template).toBe('/api/v1/users/{id}/profile');
    });

    it('4.2 1000-character slug input', () => {
      const longSlug = 'item-' + 'a'.repeat(995);
      const url = `/products/${longSlug}`;
      const template = normalizer.generateRouteTemplate(url);
      console.log('4.2 1000-char slug template:', template);
    });

    it('4.3 Slug length boundary test: 31 chars vs 32 chars (Check 4 Token vs Check 8 Slug)', () => {
      // 31 characters: "a-very-long-product-slug-31-chr"
      const slug31 = 'a-very-long-product-slug-31-chr'; // length 31
      const slug32 = 'a-very-long-product-slug-32-chrs'; // length 32
      const template31 = normalizer.generateRouteTemplate(`/product/${slug31}`);
      const template32 = normalizer.generateRouteTemplate(`/product/${slug32}`);
      console.log('4.3 Slug length boundary:', {
        len31: { slug: slug31, length: slug31.length, template: template31 },
        len32: { slug: slug32, length: slug32.length, template: template32 }
      });
    });

    it('4.4 Malformed UUID classification', () => {
      const cases = [
        { path: '/items/550e8400-e29b-41d4-a716-446655440000', desc: 'Valid UUID' },
        { path: '/items/550e8400-e29b-41d4-a716-44665544000z', desc: 'UUID with invalid hex (z)' },
        { path: '/items/------------------------------------', desc: '36 dashes' },
        { path: '/items/12345678123412341234123456789012', desc: '32 hex chars without dashes' }
      ];

      for (const c of cases) {
        const t = normalizer.generateRouteTemplate(c.path);
        console.log(`4.4 ${c.desc}: ${c.path} -> ${t}`);
      }
    });

    it('4.5 Query string malformed UUID in normalizeQuery', () => {
      const q1 = normalizer.normalizeQuery('?uuid=550e8400-e29b-41d4-a716-446655440000');
      const q2 = normalizer.normalizeQuery('?uuid=------------------------------------');
      const q3 = normalizer.normalizeQuery('?uuid=000000000000000000000000000000000000');
      console.log('4.5 normalizeQuery UUID tests:', { q1, q2, q3 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Category 5: ReDoS Vulnerability & Worst-Case Regex Timing
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Category 5: ReDoS Vulnerability & Worst-Case Regex Timing', () => {
    it('5.1 Stress testing classifySegment slug regex with 50,000 characters', () => {
      const adversarialSlug = 'a-'.repeat(25000) + '!';
      const start = performance.now();
      const res = normalizer.classifySegment(adversarialSlug, 'product');
      const duration = performance.now() - start;
      console.log(`5.1 Slug regex timing on 50k chars: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('5.2 Stress testing date regex with pathological length', () => {
      const pathologicalDate = '2026-02-' + '9'.repeat(50000);
      const start = performance.now();
      const res = normalizer.classifySegment(pathologicalDate);
      const duration = performance.now() - start;
      console.log(`5.2 Date regex timing on 50k chars: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('5.3 Stress testing token regex with pathological length', () => {
      const pathologicalToken = 'eyJ' + 'a'.repeat(100000);
      const start = performance.now();
      const res = normalizer.classifySegment(pathologicalToken);
      const duration = performance.now() - start;
      console.log(`5.3 Token regex timing on 100k chars: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('5.4 Stress testing normalizePathname with 50,000 consecutive slashes', () => {
      const massiveSlashes = '/api' + '/'.repeat(50000) + 'v1';
      const start = performance.now();
      const clean = normalizer.normalizePathname(massiveSlashes);
      const duration = performance.now() - start;
      console.log(`5.4 50k slashes normalization timing: ${duration.toFixed(2)}ms, result: ${clean}`);
      expect(clean).toBe('/api/v1');
      expect(duration).toBeLessThan(100);
    });
  });
});


  // ═══════════════════════════════════════════════════════════════════════════
  // Category 6: ReDoS Vulnerability on MultiSourceEndpointMiner Regexes
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Category 6: ReDoS Vulnerability on MultiSource Regexes', () => {
    it('6.1 Stress testing formRegex with unclosed form and 100,000 characters', () => {
      const formRegex = /<form\s+([^>]*?)>([\s\S]*?)<\/form>/gi;
      const unclosedForm = '<form action="/login">' + 'x'.repeat(100000);
      const start = performance.now();
      const match = formRegex.exec(unclosedForm);
      const duration = performance.now() - start;
      console.log(`6.1 formRegex timing on 100k unclosed chars: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('6.2 Stress testing scriptRegex with unclosed script and 100,000 characters', () => {
      const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
      const unclosedScript = '<script>' + 'var a = 1; '.repeat(10000);
      const start = performance.now();
      const match = scriptRegex.exec(unclosedScript);
      const duration = performance.now() - start;
      console.log(`6.2 scriptRegex timing on 100k unclosed chars: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('6.3 Stress testing onclick url regex with 50,000 nested slashes and chars', () => {
      const pat = /['"\x60]((\/(?:api|v[0-9]+|[a-zA-Z0-9_\-]+)\/[a-zA-Z0-9_\-\.\/\?=&%#]*)|https?:\/\/[a-zA-Z0-9_\-\.:]+\/[a-zA-Z0-9_\-\.\/\?=&%#]+)['"\x60]/gi;
      const pathologicalOnclick = "onclick=\"fetch('/api/" + 'a/b/c?d=1&e='.repeat(5000) + 'no_closing_quote';
      const start = performance.now();
      const match = pat.exec(pathologicalOnclick);
      const duration = performance.now() - start;
      console.log(`6.3 onclick url regex timing: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

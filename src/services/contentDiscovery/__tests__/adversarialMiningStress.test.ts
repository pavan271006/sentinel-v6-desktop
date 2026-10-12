import { describe, it, expect, beforeEach } from 'vitest';
import {
  DomLinkExtractor,
  TypeScriptAstEndpointMiner,
  MultiSourceEndpointMiner,
  multiSourceEndpointMiner
} from '../MultiSourceEndpointMiner';

describe('Adversarial Stress Test: MultiSourceEndpointMiner', () => {

  describe('Suite 1: DOM Extraction & Parsing Robustness', () => {

    it('handles dense DOM trees (500+ nodes, 15 levels deep) without degradation or stack overflow', () => {
      // Construct a dense, deeply nested DOM structure with interspersed links, forms, and buttons
      let html = '<div class="root-container">';
      for (let level = 0; level < 15; level++) {
        html += `<div id="level-${level}" class="container-level">`;
        for (let i = 0; i < 30; i++) {
          const idx = level * 30 + i;
          html += `<div class="card item-${idx}">
            <a href="/catalog/item-${idx}" data-url="/api/v1/catalog/item-${idx}">Item ${idx}</a>
            <button formaction="/cart/add/${idx}" formmethod="POST">Add ${idx}</button>
            <form action="/reviews/submit/${idx}" method="POST">
              <input type="hidden" name="itemId" value="${idx}" />
              <input type="text" name="rating" value="5" />
            </form>
          </div>`;
        }
      }
      for (let level = 0; level < 15; level++) {
        html += '</div>';
      }
      html += '</div>';

      const start = performance.now();
      const endpoints = multiSourceEndpointMiner.extractFromHtml(html, 'https://example.com/shop');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1500); // Must be fast
      expect(endpoints.length).toBeGreaterThan(400);

      // Verify sample extractions
      const linkSample = endpoints.find(e => e.url === 'https://example.com/catalog/item-0');
      expect(linkSample).toBeDefined();
      expect(linkSample?.source).toBe('dom_link');

      const btnSample = endpoints.find(e => e.url === 'https://example.com/cart/add/10');
      expect(btnSample).toBeDefined();
      expect(btnSample?.source).toBe('dom_button');
      expect(btnSample?.method).toBe('POST');

      const formSample = endpoints.find(e => e.url === 'https://example.com/reviews/submit/20');
      expect(formSample).toBeDefined();
      expect(formSample?.source).toBe('dom_form');
      expect(formSample?.parameters?.['itemId']).toBe('20');
    });

    it('extracts links, forms, and buttons from nested iframes with escaped srcdoc', () => {
      // Iframe containing escaped HTML with nested anchor, form with hidden input, and button
      const innerHtml = `
        <div class="iframe-content">
          <a href="/iframe/nested-page">Nested Page</a>
          <form action="/iframe/api/data" method="POST">
            <input type="hidden" name="csrf_token" value="sec_token_999" />
            <input type="text" name="search" value="query" />
          </form>
          <button data-url="/iframe/btn-target">Iframe Button</button>
        </div>
      `;
      // Escape HTML entities for srcdoc attribute
      const escapedSrcdoc = innerHtml
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const outerHtml = `
        <html>
          <body>
            <h1>Main Page</h1>
            <iframe src="/fallback-frame" srcdoc="${escapedSrcdoc}"></iframe>
          </body>
        </html>
      `;

      const endpoints = multiSourceEndpointMiner.extractFromHtml(outerHtml, 'https://example.com');
      console.log('EXTRACTED ENDPOINTS FROM IFRAME TEST:', JSON.stringify(endpoints, null, 2));

      const iframeSrc = endpoints.find(e => e.url === 'https://example.com/fallback-frame');
      expect(iframeSrc).toBeDefined();

      const nestedLink = endpoints.find(e => e.url === 'https://example.com/iframe/nested-page');
      expect(nestedLink).toBeDefined();

      const nestedForm = endpoints.find(e => e.url === 'https://example.com/iframe/api/data');
      expect(nestedForm).toBeDefined();
      expect(nestedForm?.method).toBe('POST');
      expect(nestedForm?.parameters?.['csrf_token']).toBe('sec_token_999');

      const nestedBtn = endpoints.find(e => e.url === 'https://example.com/iframe/btn-target');
      expect(nestedBtn).toBeDefined();
    });

    it('adversarial false-positive test: authentic URLs containing the word hidden (e.g. /articles/hidden-treasures)', () => {
      const html = `
        <div>
          <a href="/articles/hidden-treasures">Hidden Treasures Article</a>
          <a href="/wiki/hidden_markov_models">Hidden Markov Models</a>
          <button formaction="/features/hidden-gems">Hidden Gems</button>
        </div>
      `;

      const endpoints = multiSourceEndpointMiner.extractFromHtml(html, 'https://example.com');
      console.log('EXTRACTED ENDPOINTS WITH HIDDEN WORD IN URL:', endpoints);

      expect(endpoints.find(e => e.url === 'https://example.com/articles/hidden-treasures')).toBeDefined();
      expect(endpoints.find(e => e.url === 'https://example.com/wiki/hidden_markov_models')).toBeDefined();
      expect(endpoints.find(e => e.url === 'https://example.com/features/hidden-gems')).toBeDefined();
    });

    it('extracts buttons with onclick containing fetch, location, router.push, and template strings in static HTML', () => {
      const html = `
        <div>
          <button onclick="window.location.href = '/dashboard/overview'">Overview</button>
          <button onclick="window.open('/reports/export?format=csv')">Export</button>
          <button onclick="router.push('/settings/security')">Settings</button>
          <button onclick="fetch('/api/v2/users/me')">Fetch Me</button>
        </div>
      `;

      const endpoints = multiSourceEndpointMiner.extractFromHtml(html, 'https://example.com');

      expect(endpoints.find(e => e.url === 'https://example.com/dashboard/overview')).toBeDefined();
      expect(endpoints.find(e => e.url === 'https://example.com/reports/export?format=csv')).toBeDefined();
      expect(endpoints.find(e => e.url === 'https://example.com/settings/security')).toBeDefined();
      expect(endpoints.find(e => e.url === 'https://example.com/api/v2/users/me')).toBeDefined();
    });

    it('audits in-browser extraction script against buttons with onclick handlers to verify NO infinite loops', () => {
      // In-browser DOM extraction script evaluation test
      const script = DomLinkExtractor.getInBrowserExtractionScript();
      
      // Setup jsdom environment
      document.body.innerHTML = `
        <div id="test-root">
          <button id="btn1" onclick="window.location.href = '/dashboard/overview'">Btn1</button>
          <button id="btn2" onclick="fetch('/api/v1/orders/123')">Btn2</button>
          <button id="btn3" onclick="window.open('/docs/v1')">Btn3</button>
          <button id="btn4" onclick="router.push('/account/settings')">Btn4</button>
        </div>
      `;

      // We execute the script with a timeout guard to catch infinite loops empirically
      let executedResult: any = null;
      let errorThrown: any = null;

      const runWithTimeout = () => {
        // Execute the IIFE script
        return new Function(`return ${script}`)();
      };

      try {
        executedResult = runWithTimeout();
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).toBeNull();
      expect(executedResult).toBeDefined();
      expect(Array.isArray(executedResult.buttons)).toBe(true);

      const urls = executedResult.buttons.map((b: any) => b.url);
      expect(urls.some((u: string) => u.includes('/dashboard/overview'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/api/v1/orders/123'))).toBe(true);
    }, 5000); // 5s timeout guard against infinite loop hang

  });

  describe('Suite 2: Honeypot Pruning & Authentic Hidden Input Retention', () => {

    it('keeps authentic input[type="hidden"] fields with their values in forms', () => {
      const html = `
        <form action="/api/v1/auth/login" method="POST">
          <input type="hidden" name="csrf_token" value="0f8a9d8c7b6a5e" />
          <input type="hidden" name="__VIEWSTATE" value="/wEPDwULLTEwMTc0" />
          <input type="hidden" name="authenticity_token" value="x98s7df6s5d4f3" />
          <input type="hidden" name="org_id" value="org_4048" />
          <input type="text" name="username" value="admin" />
          <input type="password" name="password" value="secret" />
          <button type="submit">Log In</button>
        </form>
      `;

      const endpoints = multiSourceEndpointMiner.extractFromHtml(html, 'https://example.com');
      const form = endpoints.find(e => e.url === 'https://example.com/api/v1/auth/login');

      expect(form).toBeDefined();
      expect(form?.parameters).toBeDefined();
      expect(form?.parameters?.['csrf_token']).toBe('0f8a9d8c7b6a5e');
      expect(form?.parameters?.['__VIEWSTATE']).toBe('/wEPDwULLTEwMTc0');
      expect(form?.parameters?.['authenticity_token']).toBe('x98s7df6s5d4f3');
      expect(form?.parameters?.['org_id']).toBe('org_4048');
      expect(form?.parameters?.['username']).toBe('admin');
      expect(form?.parameters?.['password']).toBe('secret');
    });

    it('drops CSS-hidden honeypot links and form trap controls in static extraction', () => {
      const html = `
        <div>
          <!-- Authentic link -->
          <a href="/public/catalog">Valid Catalog</a>

          <!-- Honeypot links -->
          <a href="/trap/display-none" style="display:none">Hidden 1</a>
          <a href="/trap/display-none-spaced" style="display: none;">Hidden 2</a>
          <a href="/trap/visibility-hidden" style="visibility:hidden">Hidden 3</a>
          <a href="/trap/opacity-zero" style="opacity:0">Hidden 4</a>
          <a href="/trap/bot-trap-class" class="bot-trap-link">Trap 5</a>
          <a href="/trap/honeypot-id" id="honeypot_link">Trap 6</a>
          <a href="/trap/aria-hidden" aria-hidden="true">Trap 7</a>
          <a href="/trap/hidden-attr" hidden>Trap 8</a>

          <!-- Form with both authentic hidden input and honeypot decoy input -->
          <form action="/api/v1/contact" method="POST">
            <input type="hidden" name="csrf" value="tok_valid_123" />
            <input type="text" name="real_subject" value="Inquiry" />
            <!-- CSS-hidden decoy trap -->
            <input type="text" name="honeypot_field" style="display:none" value="bot_fill" />
            <input type="text" name="decoy_email" class="bot-trap" value="" />
          </form>
        </div>
      `;

      const endpoints = multiSourceEndpointMiner.extractFromHtml(html, 'https://example.com');

      // Valid link must exist
      expect(endpoints.find(e => e.url === 'https://example.com/public/catalog')).toBeDefined();

      // Traps must NOT exist
      expect(endpoints.find(e => e.url === 'https://example.com/trap/display-none')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/display-none-spaced')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/visibility-hidden')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/opacity-zero')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/bot-trap-class')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/honeypot-id')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/aria-hidden')).toBeUndefined();
      expect(endpoints.find(e => e.url === 'https://example.com/trap/hidden-attr')).toBeUndefined();

      // Form parameter verification
      const form = endpoints.find(e => e.url === 'https://example.com/api/v1/contact');
      expect(form).toBeDefined();
      expect(form?.parameters?.['csrf']).toBe('tok_valid_123');
      expect(form?.parameters?.['real_subject']).toBe('Inquiry');
      expect(form?.parameters?.['honeypot_field']).toBeUndefined();
      expect(form?.parameters?.['decoy_email']).toBeUndefined();
    });

    it('in-browser isHoneypot accurately distinguishes authentic hidden inputs from CSS-hidden inputs and ancestor traps', () => {
      const script = DomLinkExtractor.getInBrowserExtractionScript();

      document.body.innerHTML = `
        <div id="honeypot-test-suite">
          <!-- Authentic form with input[type="hidden"] -->
          <form id="legit-form" action="/submit/real" method="POST">
            <input type="hidden" name="token" value="authentic_token_abc" />
            <input type="text" name="message" value="Hello World" />
            <!-- CSS-hidden decoy input -->
            <input type="text" id="trap-input" name="leave_blank" style="display: none;" value="bot" />
          </form>

          <!-- Ancestor-hidden link -->
          <div id="hidden-ancestor" style="display: none;">
            <a id="ancestor-trap" href="/trap/nested-hidden">Trap</a>
          </div>

          <!-- Legitimate link -->
          <a id="legit-link" href="/public/products">Real Products</a>
        </div>
      `;

      // Mock getComputedStyle for jsdom inline style fidelity
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function(el: Element, pseudoElt?: string | null): CSSStyleDeclaration {
        const computed = originalGetComputedStyle.call(window, el, pseudoElt);
        const styleAttr = el.getAttribute('style') || '';
        if (styleAttr.includes('display: none') || styleAttr.includes('display:none')) {
          (computed as any).display = 'none';
        }
        return computed;
      };

      try {
        const result = new Function(`return ${script}`)();
        const urls = result.links.map((l: any) => l.url);

        expect(urls.some((u: string) => u.includes('/public/products'))).toBe(true);
        expect(urls.some((u: string) => u.includes('/trap/nested-hidden'))).toBe(false);

        const form = result.forms.find((f: any) => f.actionUrl.includes('/submit/real'));
        expect(form).toBeDefined();
        expect(form.parameters['token']).toBe('authentic_token_abc');
        expect(form.parameters['message']).toBe('Hello World');
        expect(form.parameters['leave_blank']).toBeUndefined();
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
      }
    });

  });

  describe('Suite 3: TypeScript Compiler AST Parsing of Complex JS/JSX', () => {

    it('parses CallExpressions with fetch, axios methods, router.push, and navigate', () => {
      const code = `
        import axios from 'axios';
        import { useNavigate } from 'react-router-dom';

        async function handleOperations() {
          const res1 = await fetch('/api/v1/auth/session');
          const res2 = await fetch('/api/v1/users/delete', { method: 'DELETE' });
          const res3 = await fetch('/api/v1/records/batch', { method: "POST" });
          const res4 = await fetch('/api/v1/configs/current', { method: 'PUT' });

          await axios.get('/api/v2/analytics/metrics');
          await axios.post('/api/v2/orders/create', { item: 1 });
          await axios.put('/api/v2/settings/update', { theme: 'dark' });
          await axios.delete('/api/v2/cache/flush');

          const navigate = useNavigate();
          navigate('/dashboard/metrics');
          router.push('/admin/console');
        }
      `;

      const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(code, 'app.ts');

      // Verify fetch calls
      const sessionEp = endpoints.find(e => e.url === '/api/v1/auth/session');
      expect(sessionEp).toBeDefined();
      expect(sessionEp?.method).toBe('GET');

      const delEp = endpoints.find(e => e.url === '/api/v1/users/delete');
      expect(delEp).toBeDefined();
      expect(delEp?.method).toBe('DELETE');

      const batchEp = endpoints.find(e => e.url === '/api/v1/records/batch');
      expect(batchEp).toBeDefined();
      expect(batchEp?.method).toBe('POST');

      const putEp = endpoints.find(e => e.url === '/api/v1/configs/current');
      expect(putEp).toBeDefined();
      expect(putEp?.method).toBe('PUT');

      // Verify axios calls
      const axGet = endpoints.find(e => e.url === '/api/v2/analytics/metrics');
      expect(axGet?.method).toBe('GET');

      const axPost = endpoints.find(e => e.url === '/api/v2/orders/create');
      expect(axPost?.method).toBe('POST');

      const axPut = endpoints.find(e => e.url === '/api/v2/settings/update');
      expect(axPut?.method).toBe('PUT');

      const axDel = endpoints.find(e => e.url === '/api/v2/cache/flush');
      expect(axDel?.method).toBe('DELETE');

      // Verify navigate & router.push
      expect(endpoints.find(e => e.url === '/dashboard/metrics')).toBeDefined();
      expect(endpoints.find(e => e.url === '/admin/console')).toBeDefined();
    });

    it('abstracts template literals with dynamic variables into generalized parameter tokens', () => {
      const code = `
        const tenantId = 't_123';
        const userId = 456;
        const orgSlug = 'acme-corp';

        fetch(\`/api/v1/tenants/\${tenantId}/users/\${userId}/permissions\`);
        axios.get(\`/api/v2/organizations/\${orgSlug}/audit-logs/\${new Date().toISOString()}\`);
      `;

      const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(code, 'routes.ts');

      const tenantEp = endpoints.find(e => e.url.includes('/api/v1/tenants/'));
      expect(tenantEp).toBeDefined();
      expect(tenantEp?.url).toBe('/api/v1/tenants/{param}/users/{param}/permissions');

      const orgEp = endpoints.find(e => e.url.includes('/api/v2/organizations/'));
      expect(orgEp).toBeDefined();
      expect(orgEp?.url).toBe('/api/v2/organizations/{param}/audit-logs/{param}');
    });

    it('parses JSX snippets with Route path, Link to, and dynamic route segments', () => {
      const jsxCode = `
        import React from 'react';
        import { Route, Routes, Link } from 'react-router-dom';

        export function AppRouter() {
          return (
            <Routes>
              <Route path="/api/health" element={<Health />} />
              <Route path="/admin/system-logs" element={<SystemLogs />} />
              <Route path="/auth/mfa/verify" element={<MfaVerify />} />
              <Route path="/users/:userId/profile" element={<UserProfile />} />
              <Route path="/products/:category/:productId" element={<ProductDetail />} />
              <Route path="/items" element={<ItemsList />} />
              <Link to="/internal/diagnostics">Diagnostics</Link>
            </Routes>
          );
        }
      `;

      const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(jsxCode, 'AppRouter.tsx');

      expect(endpoints.find(e => e.url === '/api/health')).toBeDefined();
      expect(endpoints.find(e => e.url === '/admin/system-logs')).toBeDefined();
      expect(endpoints.find(e => e.url === '/auth/mfa/verify')).toBeDefined();
      expect(endpoints.find(e => e.url === '/users/:userId/profile')).toBeDefined();
      expect(endpoints.find(e => e.url === '/products/:category/:productId')).toBeDefined();
      expect(endpoints.find(e => e.url === '/items')).toBeDefined();
      expect(endpoints.find(e => e.url === '/internal/diagnostics')).toBeDefined();
    });

    it('tolerates partial, malformed, or obfuscated JS/JSX snippets without throwing', () => {
      const brokenCode = `
        function broken( {
          fetch('/api/v1/broken'
          const x = ;
          <Route path="/api/v1/unclosed"
      `;

      expect(() => {
        const endpoints = TypeScriptAstEndpointMiner.extractFromScriptSource(brokenCode, 'broken.tsx');
        expect(Array.isArray(endpoints)).toBe(true);
      }).not.toThrow();
    });

  });

});

import { describe, it, expect } from 'vitest';
import {
  jaccardTokenSimilarity,
  normalizedStringSimilarity,
  buildBrowserAdaptiveLookupScript,
} from '../AdaptiveElementLocator';
import { LlmMarkdownSynthesizer } from '../../ai/LlmMarkdownSynthesizer';

describe('AdaptiveElementLocator (Scrapling Similarity Adaptation)', () => {
  it('correctly calculates Jaccard token similarity for drifted selector names', () => {
    // Identical tokens
    expect(jaccardTokenSimilarity('submit-button-primary', 'submit_button_primary')).toBe(1.0);

    // Minor drift in naming (e.g. from v1 to v2 redesign)
    const sim = jaccardTokenSimilarity('btn_submit_order_action', 'btn_submit_order_v2');
    expect(sim).toBeGreaterThan(0.5);

    const inputSim = jaccardTokenSimilarity('login_username_input', 'login_username_field_v2');
    expect(inputSim).toBeGreaterThanOrEqual(0.4);

    // Completely disjoint tokens
    const disjoint = jaccardTokenSimilarity('logout_session', 'search_product_query');
    expect(disjoint).toBe(0.0);
  });

  it('calculates normalized Levenshtein string similarity accurately', () => {
    expect(normalizedStringSimilarity('Search', 'search')).toBe(1.0);
    expect(normalizedStringSimilarity('Submit Application', 'Submit Application Form')).toBeGreaterThan(0.7);
    expect(normalizedStringSimilarity('Delete User', 'Create Project')).toBeLessThan(0.3);
  });

  it('generates executable browser evaluation script for adaptive lookup', () => {
    const script = buildBrowserAdaptiveLookupScript({
      selector: '.btn-submit-action',
      textMatch: 'Submit Query',
      idMatch: 'btn_query_submit',
      nameMatch: 'query_btn',
      threshold: 0.5
    });

    expect(script).toContain('__sentinelAdaptiveFind');
    expect(script).toContain('.btn-submit-action');
    expect(script).toContain('Submit Query');
    expect(script).toContain('jaccard');
  });
});

describe('LlmMarkdownSynthesizer (Scrapling LLM-Ready Extraction)', () => {
  it('cleans noisy HTML and generates high-density Markdown', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Portal Administration Console</title>
          <script src="/tracker.js"></script>
          <style>body { background: #000; }</style>
        </head>
        <body>
          <h1>Security Audit Dashboard</h1>
          <p>Welcome to the protected admin area. Sensitive operations require 2FA.</p>
          
          <form action="/api/v1/auth/login" method="POST" id="authForm">
            <input type="text" name="username" placeholder="Enter username" required />
            <input type="password" name="password" placeholder="••••••••" required />
            <input type="hidden" name="_csrf" value="tok_9872345" />
            <button type="submit">Authenticate</button>
          </form>

          <table class="table">
            <thead>
              <tr><th>Endpoint</th><th>Role</th><th>Access</th></tr>
            </thead>
            <tbody>
              <tr><td>/api/v1/users</td><td>Admin</td><td>Read/Write</td></tr>
              <tr><td>/api/v1/reports</td><td>Auditor</td><td>Read-Only</td></tr>
            </tbody>
          </table>

          <a href="/docs/api">API Documentation</a>
          <a href="/internal/metrics">System Metrics</a>

          <script id="__NEXT_DATA__" type="application/json">
            {"props":{"pageProps":{"version":"6.2.0","env":"production"}}}
          </script>
        </body>
      </html>
    `;

    const md = LlmMarkdownSynthesizer.htmlToMarkdown(sampleHtml, { baseUrl: 'https://admin.portal.local' });

    // 1. Verifies noise is completely stripped
    expect(md).not.toContain('<script');
    expect(md).not.toContain('<style');
    expect(md).not.toContain('body { background');

    // 2. Verifies Title and Headings converted
    expect(md).toContain('# Portal Administration Console');
    expect(md).toContain('# Security Audit Dashboard');

    // 3. Verifies Form and Parameters extracted
    expect(md).toContain('## 🛡️ Interactive Forms & Input Parameters');
    expect(md).toContain('POST /api/v1/auth/login');
    expect(md).toContain('username');
    expect(md).toContain('password');
    expect(md).toContain('_csrf');

    // 4. Verifies Table converted to Markdown table
    expect(md).toContain('| Endpoint | Role | Access |');
    expect(md).toContain('| /api/v1/users | Admin | Read/Write |');

    // 5. Verifies Embedded Next.js JSON unpacked
    expect(md).toContain('## 📦 Embedded State & Schema JSON');
    expect(md).toContain('__NEXT_DATA__');
    expect(md).toContain('"version": "6.2.0"');

    // 6. Verifies Endpoints surfaced
    expect(md).toContain('/docs/api');
    expect(md).toContain('/internal/metrics');
  });

  it('converts raw HTTP responses into formatted Markdown with metadata', () => {
    const rawResponse = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nServer: nginx/1.24\r\n\r\n{"status":"healthy","workers":4,"active_scans":["scan-01"]}`;

    const md = LlmMarkdownSynthesizer.httpResponseToMarkdown(rawResponse, 'https://api.sentinel.local/health');

    expect(md).toContain('# HTTP 200 OK');
    expect(md).toContain('https://api.sentinel.local/health');
    expect(md).toContain('```json');
    expect(md).toContain('"status": "healthy"');
    expect(md).toContain('"workers": 4');
  });
});

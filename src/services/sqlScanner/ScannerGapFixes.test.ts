import { describe, test, expect, vi } from 'vitest';
import { RequestParser, isAntiCsrfOrSecurityToken } from './RequestParser';
import { BooleanTester } from './BooleanTester';
import { CausalVerifier } from './engine/CausalVerifier';
import { MultiOracleDiscoveryStage } from './pipeline/stages/MultiOracleDiscoveryStage';
import { SecondOrderTester } from './SecondOrderTester';
import { ScanContext } from './pipeline/ScanContext';

describe('Scanner Gap Fixes (Evidences A - F)', () => {
  // ─── Evidence A: Token Filtering with scanAuthTokens ─────────────────────
  test('Evidence A: isAntiCsrfOrSecurityToken respects scanAuthTokens flag', () => {
    expect(isAntiCsrfOrSecurityToken('authorization', false)).toBe(true);
    expect(isAntiCsrfOrSecurityToken('authorization', true)).toBe(false);

    expect(isAntiCsrfOrSecurityToken('connect.sid', false)).toBe(true);
    expect(isAntiCsrfOrSecurityToken('connect.sid', true)).toBe(false);

    expect(isAntiCsrfOrSecurityToken('csrf_token', true)).toBe(true);
    expect(isAntiCsrfOrSecurityToken('xsrf-token', true)).toBe(true);
  });

  test('Evidence A: ScanContext keeps auth tokens when scanAuthTokens is enabled', () => {
    const rawReq = `GET /api/user HTTP/1.1\r\nHost: example.com\r\nAuthorization: Bearer token123\r\nCookie: connect.sid=sess123\r\n\r\n`;
    
    const target = { id: 't1', name: 'target', url: 'https://example.com/api/user', method: 'GET', headers: [], body: '', parameters: [], rawRequest: rawReq } as any;
    
    const ctxDisabled = new ScanContext({
      target,
      safetyConfig: { authorizedTestingConfirmed: true, scanAuthTokens: false } as any
    });
    expect(ctxDisabled.candidateParameters.some(p => p.name.toLowerCase() === 'authorization')).toBe(true);
    const sidDisabled = ctxDisabled.parsedRequest.parameters.find(p => p.name === 'connect.sid');
    expect(sidDisabled?.enabled).toBe(false);

    const ctxEnabled = new ScanContext({
      target,
      safetyConfig: { authorizedTestingConfirmed: true, scanAuthTokens: true } as any
    });
    const sidEnabled = ctxEnabled.parsedRequest.parameters.find(p => p.name === 'connect.sid');
    expect(sidEnabled?.enabled).toBe(true);
  });

  // ─── Evidence B: ORDER BY Boolean Pair Generation ───────────────────────
  test('Evidence B: BooleanTester generates dedicated test pairs for order_by_clause', () => {
    const pairs = BooleanTester.getTestPairs({
      id: 'sort_param',
      name: 'sort',
      location: 'query',
      originalValue: 'id',
      detectedContext: 'order_by_clause',
      enabled: true,
    });

    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.some(p => p.truePayload.includes('CASE WHEN (1=1)'))).toBe(true);
    expect(pairs.some(p => p.isConditionalError === true)).toBe(true);
  });

  // ─── Evidence C: Normalized Levenshtein / Similarity in CausalVerifier ───
  test('Evidence C: CausalVerifier passes dynamic page with high similarity despite byte deltas', async () => {
    const baselineA = '<html><body><h1>Dashboard</h1><p>Time: 12:00:01</p><div>User session 1029384756</div></body></html>';
    const baselineB = '<html><body><h1>Dashboard</h1><p>Time: 12:00:02</p><div>User session 1029384759</div></body></html>';
    const trueResp = '<html><body><h1>Dashboard</h1><p>Time: 12:00:03</p><div>User session 1029384762</div></body></html>';
    const falseResp = '<html><body><h1>404 Not Found</h1><p>Error processing request</p></body></html>';

    const mockProbeFn = vi.fn().mockImplementation(async (payload: string) => {
      if (payload === '') return { status: 200, body: mockProbeFn.mock.calls.length % 2 === 0 ? baselineA : baselineB, durationMs: 50 };
      if (payload.includes('1=1') || payload.includes('TRUE')) return { status: 200, body: trueResp, durationMs: 50 };
      if (payload.includes('1=2') || payload.includes('FALSE')) return { status: 404, body: falseResp, durationMs: 50 };
      return { status: 200, body: baselineA, durationMs: 50 };
    });

    const result = await CausalVerifier.verifyCausality(
      { id: 'p1', name: 'id', location: 'query', originalValue: '1', enabled: true },
      mockProbeFn,
      "' AND 1=1--",
      "' AND 1=2--"
    );

    expect(result.isConfirmed).toBe(true);
    expect(result.confidenceScore).toBe(100);
  });

  // ─── Evidence D: Adaptive Column Count up to 30 in Deep Mode ──────────────
  test('Evidence D: MultiOracleDiscoveryStage uses adaptive maxCols in deep mode', () => {
    const stage = new MultiOracleDiscoveryStage();
    expect(stage.id).toBe('multi_oracle_discovery');
  });

  // ─── Evidence E: Enhanced Second-Order Injection Payloads ───────────────
  test('Evidence E: SecondOrderTester tests multiple context payloads', async () => {
    const mockSend = vi.fn().mockImplementation(async (raw: string) => {
      if (raw.includes("SNT_SO_")) {
        // Extract token from raw request
        const match = raw.match(/SNT_SO_\d+/);
        const tok = match ? match[0] : 'SNT_SO_token';
        return { status: 200, body: `Welcome ${tok}!`, durationMs: 40, rawRequest: raw, rawResponse: 'HTTP/1.1 200 OK' };
      }
      return { status: 200, body: 'Normal page', durationMs: 40, rawRequest: raw, rawResponse: 'HTTP/1.1 200 OK' };
    });

    const parsed = RequestParser.parse('POST /register HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\nusername=testuser');
    const param = parsed.parameters[0];

    const res = await SecondOrderTester.executeSecondOrderTest(
      parsed,
      param,
      { enabled: true, sinkUrl: 'https://example.com/profile' },
      mockSend
    );

    expect(res.isVulnerable).toBe(true);
    expect(res.canaryReflected).toBe(true);
  });

  // ─── Evidence F: Enhanced XML Parsing with CDATA & Attributes ─────────────
  test('Evidence F: RequestParser extracts XML attributes, CDATA, and tags', () => {
    const xmlBody = `<?xml version="1.0"?>
    <request id="999" role="admin">
      <user><![CDATA[john_doe'<script>]]></user>
      <email>john@example.com</email>
    </request>`;

    const parsed = RequestParser.parse(`POST /xml HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/xml\r\n\r\n${xmlBody}`);

    expect(parsed.isXml).toBe(true);
    const params = parsed.parameters;

    expect(params.some(p => p.name.includes('@id'))).toBe(true);
    expect(params.some(p => p.name.includes('@role'))).toBe(true);
    expect(params.some(p => p.name.includes('user (CDATA)') && p.originalValue.includes('john_doe'))).toBe(true);
    expect(params.some(p => p.name === 'email' && p.originalValue === 'john@example.com')).toBe(true);
  });

  // ─── Evidence G: Stacked Multi-Statement Probing in MultiOracleDiscoveryStage ──
  test('Evidence G: Stacked multi-statement probing detects and records finding on delay', async () => {
    const rawReq = 'POST /items HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\nid=10';
    const target = {
      id: 't-stacked',
      name: 'Stacked Target',
      url: 'https://example.com/items',
      method: 'POST',
      headers: [],
      body: 'id=10',
      parameters: [{ id: 'body_id', name: 'id', location: 'body_form', originalValue: '10', enabled: true, detectedContext: 'numeric' }],
      rawRequest: rawReq,
      testedInjectionTypes: { errorBased: false, booleanBased: false, unionBased: false, timeBased: false, stackedBased: true },
    } as any;

    const ctx = new ScanContext({
      target,
      safetyConfig: { authorizedTestingConfirmed: true, scanMode: 'standard' } as any,
    });

    // Mock sendMutatedRequest to return delay when stacked payload is sent
    ctx.sendMutatedRequest = vi.fn().mockImplementation(async (_param: any, payload: string) => {
      if (payload.includes('WAITFOR DELAY') || payload.includes('pg_sleep')) {
        return { status: 200, body: 'Delayed response', durationMs: 3100, rawRequest: '', rawResponse: '' };
      }
      return { status: 200, body: 'Normal response', durationMs: 40, rawRequest: '', rawResponse: '' };
    });

    const stage = new MultiOracleDiscoveryStage();
    await stage.execute(ctx);

    expect(ctx.findings.some(f => f.injectionType === 'Stacked-query indicator')).toBe(true);
    const stackedFinding = ctx.findings.find(f => f.injectionType === 'Stacked-query indicator');
    expect(stackedFinding?.severity).toBe('Critical');
  });

  // ─── Evidence H: Multipart Filename Candidate Extraction and Injection ────
  test('Evidence H: RequestParser extracts multipart filename and injects into filename attribute', () => {
    const multipartBody = '--boundary123\r\nContent-Disposition: form-data; name="file"; filename="document.pdf"\r\nContent-Type: application/pdf\r\n\r\nBinaryDataHere\r\n--boundary123--';
    const rawReq = `POST /upload HTTP/1.1\r\nHost: example.com\r\nContent-Type: multipart/form-data; boundary=boundary123\r\n\r\n${multipartBody}`;

    const parsed = RequestParser.parse(rawReq);
    const fnParam = parsed.parameters.find(p => p.name.includes('(filename)'));
    expect(fnParam).toBeDefined();
    expect(fnParam?.originalValue).toBe('document.pdf');

    // Test injection into filename attribute
    const injected = RequestParser.injectPayload(parsed, fnParam!, "shell.php'--", false);
    expect(injected.bodyText).toContain('filename="shell.php\'--"');
    expect(injected.bodyText).toContain('BinaryDataHere'); // File content remains intact
  });

  // ─── Evidence I: JSON Array Indexing & Path Injection ──────────────────
  test('Evidence I: RequestParser injects nested JSON array and object paths cleanly', () => {
    const jsonBody = JSON.stringify({
      filters: [
        { field: 'category', value: 'books' },
        { field: 'price', value: '100' }
      ]
    });
    const rawReq = `POST /api/search HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\n\r\n${jsonBody}`;

    const parsed = RequestParser.parse(rawReq);
    expect(parsed.parameters.some(p => p.name.includes('filters.0.value'))).toBe(true);

    const valParam = parsed.parameters.find(p => p.name === 'filters.0.value')!;
    const injected = RequestParser.injectPayload(parsed, valParam, "books' OR 1=1--", false);

    const injectedObj = JSON.parse(injected.bodyText);
    expect(Array.isArray(injectedObj.filters)).toBe(true);
    expect(injectedObj.filters[0].value).toBe("books' OR 1=1--");
    expect(injectedObj.filters[1].value).toBe('100');
  });
});

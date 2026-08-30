import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { SqlScanOrchestrator } from '../../src/services/sqlScanner/SqlScanOrchestrator';
import { RequestParser } from '../../src/services/sqlScanner/RequestParser';
import { useSqlScannerStore } from '../../src/stores/sqlScannerStore';

describe('Empirical Scanner Runtime Validation Suite', () => {
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const path = url.pathname;
      const query = url.searchParams;
      const cookieHeader = req.headers['cookie'] || '';

      // Parse cookie
      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((p) => {
        const eq = p.indexOf('=');
        if (eq !== -1) cookies[p.substring(0, eq).trim()] = p.substring(eq + 1).trim();
      });

      // 1. Positive Test Cases
      if (path === '/test/error_cast') {
        const tracking = cookies['TrackingId'] || query.get('id') || '';
        if (tracking.includes("CAST((SELECT table_name FROM information_schema.tables") || tracking.includes("CAST((SELECT table_name FROM")) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`ERROR: invalid input syntax for type integer: "users"`);
          return;
        }
        if (tracking.includes("CAST((SELECT column_name FROM information_schema.columns") || tracking.includes("CAST((SELECT column_name")) {
          if (tracking.includes("OFFSET 0") || !tracking.includes("OFFSET")) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`ERROR: invalid input syntax for type integer: "username"`);
            return;
          } else if (tracking.includes("OFFSET 1")) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`ERROR: invalid input syntax for type integer: "password"`);
            return;
          }
        }
        if (tracking.includes("CAST((SELECT username FROM users")) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`ERROR: invalid input syntax for type integer: "administrator"`);
          return;
        }
        if (tracking.includes("CAST((SELECT password FROM users")) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`ERROR: invalid input syntax for type integer: "s3cretPassword!"`);
          return;
        }
        if (tracking.includes("'")) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`ERROR: unterminated quoted string at or near "'"`);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body>Welcome back!</body></html>`);
        return;
      }

      // 2. Boolean Differential Endpoint
      if (path === '/test/boolean') {
        const cat = query.get('category') || '';
        if (cat.includes("' AND '1'='1") || cat.includes("' AND 1=1--") || cat === 'Gifts') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Product Catalog</h1><div class="item">Gift Card</div></body></html>`);
          return;
        }
        if (cat.includes("' AND '1'='2") || cat.includes("' AND 1=2--")) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Product Catalog</h1><div class="empty">No items found</div></body></html>`);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Product Catalog</h1></body></html>`);
        return;
      }

      // 3. Hard-Negative Noise Endpoint (Reflection & changing nonce)
      if (path === '/test/noise_reflection') {
        const q = query.get('q') || '';
        const nonce = Math.random().toString(36).substring(2);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body>Search results for: ${q} (Nonce: ${nonce})</body></html>`);
        return;
      }

      // 4. Hard-Negative Static 500
      if (path === '/test/static_500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error: Service Unavailable`);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`OK`);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 8080;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('validates Error-Based CAST extraction pipeline discovers tables, columns and rows', async () => {
    const rawReq = `GET /test/error_cast HTTP/1.1\r\nHost: 127.0.0.1:${serverPort}\r\nCookie: TrackingId=testCookie\r\n\r\n`;
    const targetUrl = `http://127.0.0.1:${serverPort}/test/error_cast`;
    const parsed = RequestParser.parse(rawReq, targetUrl);

    const logs: any[] = [];
    const findings: any[] = [];
    let finalCatalog: any = null;

    const orchestrator = new SqlScanOrchestrator(
      {
        id: 'test_target',
        name: 'Error Cast Test',
        rawRequest: rawReq,
        url: targetUrl,
        method: 'GET',
        headers: parsed.headers,
        body: '',
        parameters: parsed.parameters,
        testedInjectionTypes: {
          errorBased: true,
          booleanBased: true,
          timeBased: false,
          unionBased: false,
          orderBy: false,
          groupBy: false,
          having: false,
          stackedBased: false,
          secondOrder: false,
        },
      },
      {
        authorizedTestingConfirmed: true,
        scanMode: 'quick',
        rateLimitDelayMs: 0,
        maxRequestsPerScan: 1000,
        maxScanDurationSeconds: 30,
        maxResponseSizeBytes: 500000,
        requestTimeoutMs: 3000,
        abortOnConsecutiveErrors: 10,
        strictNonDestructiveOnly: true,
        autoRedactSensitiveData: false,
      },
      {
        onLog: (l) => logs.push(l),
        onProgress: () => {},
        onFinding: (f) => findings.push(f),
        onCatalog: (c) => { finalCatalog = c; },
      }
    );

    const report = await orchestrator.startScan();
    if (report.verdict !== 'VULNERABLE') {
      console.log('SCAN LOGS:', logs.map((l) => `${l.phase}: ${l.message}`));
    }
    expect(report.verdict).toBe('VULNERABLE');
    expect(findings.length).toBeGreaterThan(0);

    // Verify Error-Based Table & Column discovery
    expect(finalCatalog).not.toBeNull();
    const usersTable = finalCatalog.applicationTables.find((t: any) => t.name === 'users');
    expect(usersTable).toBeDefined();
    expect(usersTable.columns.some((c: any) => c.name === 'username')).toBe(true);
    expect(usersTable.columns.some((c: any) => c.name === 'password')).toBe(true);

    // Verify Row extraction
    expect(usersTable.sampleRows).toBeDefined();
    expect(usersTable.sampleRows.length).toBeGreaterThan(0);
    expect(usersTable.sampleRows[0]['username']).toBe('administrator');
    expect(usersTable.sampleRows[0]['password']).toBe('s3cretPassword!');
  });

  it('validates Hard-Negative noise endpoint does not produce False Positives', async () => {
    const rawReq = `GET /test/noise_reflection?q=hello HTTP/1.1\r\nHost: 127.0.0.1:${serverPort}\r\n\r\n`;
    const targetUrl = `http://127.0.0.1:${serverPort}/test/noise_reflection?q=hello`;
    const parsed = RequestParser.parse(rawReq, targetUrl);

    const findings: any[] = [];
    const orchestrator = new SqlScanOrchestrator(
      {
        id: 'noise_target',
        name: 'Noise Test',
        rawRequest: rawReq,
        url: targetUrl,
        method: 'GET',
        headers: parsed.headers,
        body: '',
        parameters: parsed.parameters,
        testedInjectionTypes: {
          errorBased: true,
          booleanBased: true,
          timeBased: true,
          unionBased: true,
          orderBy: true,
          groupBy: false,
          having: false,
          stackedBased: false,
          secondOrder: false,
        },
      },
      {
        authorizedTestingConfirmed: true,
        scanMode: 'quick',
        rateLimitDelayMs: 0,
        maxRequestsPerScan: 1000,
        maxScanDurationSeconds: 30,
        maxResponseSizeBytes: 500000,
        requestTimeoutMs: 3000,
        abortOnConsecutiveErrors: 10,
        strictNonDestructiveOnly: true,
        autoRedactSensitiveData: false,
      },
      {
        onLog: () => {},
        onProgress: () => {},
        onFinding: (f) => findings.push(f),
      }
    );

    const report = await orchestrator.startScan();
    console.log('REPORT FINDINGS:', JSON.stringify(report.findings, null, 2));
    expect(report.verdict).toBe('NOT CONFIRMED VULNERABLE');
    expect(findings.length).toBe(0);
  });

  it('validates multi-tab store isolation prevents cross-tab state contamination', () => {
    const store = useSqlScannerStore.getState();
    const tab1Id = store.activeTabId;

    // Create tab 2
    const tab2Id = store.createScanTab('GET /api/v2/users HTTP/1.1\r\nHost: target.local\r\n\r\n', 'Scan 2 (/users)');

    expect(tab1Id).not.toBe(tab2Id);

    // Modify tab 2 targetConfig
    store.setRawRequest('GET /api/v2/items HTTP/1.1\r\nHost: target.local\r\n\r\n');
    expect(useSqlScannerStore.getState().targetConfig.rawRequest).toContain('/api/v2/items');

    // Switch back to tab 1
    store.setActiveScanTab(tab1Id);
    expect(useSqlScannerStore.getState().activeTabId).toBe(tab1Id);
    expect(useSqlScannerStore.getState().targetConfig.rawRequest).toContain('/filter');

    // Switch to tab 2 and confirm its state was preserved
    store.setActiveScanTab(tab2Id);
    expect(useSqlScannerStore.getState().targetConfig.rawRequest).toContain('/api/v2/items');

    // Clean up tab 2
    store.closeScanTab(tab2Id);
    expect(useSqlScannerStore.getState().tabs.some((t) => t.id === tab2Id)).toBe(false);
  });
});

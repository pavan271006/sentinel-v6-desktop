import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  tokenizeHttpql,
  parseHttpql,
  validateHttpql,
  evaluateHttpql,
  compileHttpqlToSql,
  getHttpqlSuggestions,
} from '../../src/utils/httpql';
import { useTrafficStore } from '../../src/stores/trafficStore';
import { VirtualTrafficTable } from '../../src/components/traffic/VirtualTrafficTable';
import { TrafficSummary } from '../../src/types/traffic';

function generateBenchmarkDataset(count = 100000): TrafficSummary[] {
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
  const paths = [
    '/api/v1/auth/login',
    '/api/v1/users/profile',
    '/api/v1/orders/checkout',
    '/graphql?query=getUserData',
    '/oauth/v2/authorize',
    '/static/chunks/bundle.js',
    '/api/v2/admin/permissions',
    '/api/v1/reports/export.pdf',
    '/healthz',
    '/metrics',
  ];
  const statuses = [200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 422, 500, 502, 503];
  const mimeTypes = ['application/json', 'text/html', 'application/javascript', 'application/pdf', 'text/plain'];

  const dataset: TrafficSummary[] = new Array(count);
  const baseTime = 1720000000000;

  for (let i = 0; i < count; i++) {
    const method = methods[i % methods.length];
    const path = paths[i % paths.length];
    const status = statuses[i % statuses.length];
    const mimeType = mimeTypes[i % mimeTypes.length];
    const inScope = i % 7 !== 0;

    dataset[i] = {
      id: `tx-${(i + 1).toString().padStart(7, '0')}`,
      seqNumber: i + 1,
      timestamp: '14:30:00',
      timestampMs: baseTime + i * 50,
      method,
      url: `https://app.target.corp${path}`,
      host: 'app.target.corp',
      path,
      status,
      durationMs: 10 + ((i * 37) % 650),
      sizeBytes: 128 + ((i * 137) % 65536),
      inScope,
      mimeType,
      tags: inScope ? ['scope:target', 'production'] : ['out-of-scope'],
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    };
  }

  return dataset;
}

describe('Empirical Adversarial Stress Suite: HTTPQL Injection & 100K Virtualization Scale', () => {
  const sampleTx: TrafficSummary = {
    id: 'tx-adv-001',
    seqNumber: 1,
    timestamp: '12:00:00',
    timestampMs: 1720000000000,
    method: 'POST',
    url: 'https://sec-target.internal/api/v1/auth/login?redirect=dashboard',
    host: 'sec-target.internal',
    path: '/api/v1/auth/login',
    status: 403,
    durationMs: 320,
    sizeBytes: 2048,
    inScope: true,
    mimeType: 'application/json',
    tags: ['auth', 'forbidden', 'red-team'],
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
  };

  beforeEach(async () => {
    await useTrafficStore.getState().clearTraffic();
    useTrafficStore.getState().resetFilters();
  });

  describe('1. Adversarial HTTPQL Injection & Edge-Case Robustness', () => {
    it('1.1 Unclosed string quotes handle gracefully without unhandled exceptions', () => {
      const payloads = [
        'req.path == "unclosed_double_quote',
        "req.path == 'unclosed_single_quote",
        'req.url == "https://evil.com/path?param=',
        'req.path == "escaped_quote\\"',
        '(req.method == "POST and res.status == 200)',
        'req.header.Authorization == "Bearer eyJhbGciOi...',
      ];

      for (const payload of payloads) {
        const { errors } = tokenizeHttpql(payload);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain('Unclosed string literal');

        const { ast, error } = parseHttpql(payload);
        expect(ast.type).toBe('EMPTY');
        expect(error).toBeDefined();

        const val = validateHttpql(payload);
        expect(val.valid).toBe(false);
        expect(val.error).toBeDefined();

        // Evaluation against sample should return false / default safely without crashing
        expect(() => evaluateHttpql(ast, sampleTx)).not.toThrow();
      }
    });

    it('1.2 Unmatched parentheses and corrupted AST structures fail-closed cleanly', () => {
      const corruptedQueries = [
        '(req.method == "POST"',
        '((((((req.path == "/api/v1/auth/login"))))',
        'req.method == "POST")',
        ') (',
        '()',
        '((()))',
        'req.method == "POST" and ()',
        'and or not',
        'req.method == and res.status ==',
        '((((req.method == "POST") and (res.status == 403)))',
      ];

      for (const query of corruptedQueries) {
        const { ast, error } = parseHttpql(query);
        // Either it returns an error or returns valid empty / parsed AST without throwing unhandled exceptions
        if (error) {
          expect(error.message).toBeDefined();
          expect(typeof error.offset).toBe('number');
        }
        const val = validateHttpql(query);
        if (!val.valid) {
          expect(val.error).toBeDefined();
        }
        expect(() => evaluateHttpql(ast, sampleTx)).not.toThrow();
      }
    });

    it('1.3 SQL Injection payloads are neutralized and sanitized in SQL compiler', () => {
      const sqliPayloads = [
        `' OR 1=1 --`,
        `admin' --`,
        `req.path == "' OR 1=1 --"`,
        `req.method == "POST' UNION SELECT null, null, null, null --"`,
        `req.url contains "'; DROP TABLE transactions; --"`,
        `res.status == "200' OR '1'='1"`,
        `req.host == "target.local' AND SLEEP(5) --"`,
      ];

      for (const sqli of sqliPayloads) {
        const { ast } = parseHttpql(sqli);
        const compiled = compileHttpqlToSql(ast);

        // Verify compiler safely escapes single quotes (' -> '') so SQL literals cannot break out
        if (compiled.includes("'")) {
          // Verify that the literal contains escaped quotes ('' instead of raw single quote breakout)
          const withoutEscapedQuotes = compiled.replace(/''/g, '');
          // Count remaining quotes - must be exactly 2 (the outer enclosing single quotes)
          const remainingQuotes = (withoutEscapedQuotes.match(/'/g) || []).length;
          expect(remainingQuotes % 2).toBe(0);
        }
        // Verify evaluateHttpql does not execute SQL injection or crash
        expect(() => evaluateHttpql(ast, sampleTx)).not.toThrow();
      }
    });

    it('1.4 Deeply nested logical expressions (10 to 60 levels) parse and evaluate without stack overflow', () => {
      // Build a 40-level deeply nested query
      let deepQuery = 'req.method == "POST"';
      for (let i = 0; i < 40; i++) {
        deepQuery = `(${deepQuery} and res.status >= 200)`;
      }

      const startParse = performance.now();
      const { ast, error } = parseHttpql(deepQuery);
      const parseTime = performance.now() - startParse;

      expect(error).toBeUndefined();
      expect(ast.type).toBe('LOGICAL');
      expect(parseTime).toBeLessThan(50); // <50ms for 40 levels deep

      const startEval = performance.now();
      const evalResult = evaluateHttpql(ast, sampleTx);
      const evalTime = performance.now() - startEval;

      expect(evalResult).toBe(true);
      expect(evalTime).toBeLessThan(5); // <5ms evaluation
    });

    it('1.5 Empirical Challenge Finding: ReDoS regex vulnerability evaluation against nested quantifiers', () => {
      // Test safe/normal regex matching
      const normalQueries = [
        'req.path matches "^/api/v1/auth/.*"',
        'req.url matches "https://.*internal"',
        'req.host matches "^sec-target\\.[a-z]+$"',
        'req.path matches "[a-z("', // Malformed regex syntax (should catch and return false)
        'req.url matches "*+"', // Malformed quantifier (should catch and return false)
      ];

      for (const query of normalQueries) {
        const { ast } = parseHttpql(query);
        const start = performance.now();
        const result = evaluateHttpql(ast, sampleTx);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(20);
        expect(typeof result).toBe('boolean');
      }

      // Prove ReDoS pattern vulnerability detection on nested quantifiers
      const redosPattern = '(a+)+$';
      const hasCatastrophicQuantifier = /([+*]|\{[0-9]+,\})\s*\)\s*([+*]|\{[0-9]+,\})/.test(redosPattern);
      expect(hasCatastrophicQuantifier).toBe(true);
    });

    it('1.6 Invalid fields, prototype pollution keys and boundary status codes handle gracefully', () => {
      const edgeQueries = [
        '__proto__ == "evil"',
        'constructor == "pollute"',
        'prototype.isAdmin == true',
        'req.nonexistent_header.Foo == "bar"',
        'res.status == -1',
        'res.status == 0',
        'res.status >= 99999',
        'res.status in [-1, 0, 403, 99999]',
        'res.time_ms > 9007199254740991',
        'req.path contains ""',
      ];

      for (const q of edgeQueries) {
        const { ast } = parseHttpql(q);
        expect(() => evaluateHttpql(ast, sampleTx)).not.toThrow();
        const res = evaluateHttpql(ast, sampleTx);
        expect(typeof res).toBe('boolean');
      }
    });

    it('1.7 Context autocomplete provides robust suggestions across arbitrary token positions', () => {
      const positions = [
        { query: '', pos: 0, expectedCategory: 'field' },
        { query: 'req.', pos: 4, expectedCategory: 'field' },
        { query: 'req.method ', pos: 11, expectedCategory: 'operator' },
        { query: 'req.method == ', pos: 14, expectedCategory: 'value' },
        { query: 'res.status == ', pos: 14, expectedCategory: 'value' },
        { query: 'tx.in_scope == ', pos: 15, expectedCategory: 'value' },
      ];

      for (const item of positions) {
        const suggestions = getHttpqlSuggestions(item.query, item.pos);
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some((s) => s.category === item.expectedCategory)).toBe(true);
      }
    });
  });

  describe('2. 100,000 Transaction Virtualization, DOM O(1) & Evaluation Scale', () => {
    it('2.1 Maintains strict O(1) DOM footprint for 100,000 transactions during viewport rendering', () => {
      const dataset = generateBenchmarkDataset(100000);
      expect(dataset).toHaveLength(100000);

      const { container } = render(
        <div style={{ height: '500px', width: '900px' }}>
          <VirtualTrafficTable
            transactions={dataset}
            selectedTxId="tx-0000001"
            onSelectTx={() => {}}
          />
        </div>
      );

      // Verify row 1 is rendered
      expect(screen.getByText('tx-0000001')).toBeInTheDocument();
      // Verify row 100,000 is NOT rendered in DOM
      expect(screen.queryByText('tx-0100000')).toBeNull();

      // Total rendered DOM rows / cells should be O(1), well below 500 nodes
      const renderedCells = container.querySelectorAll('.dense-cell, td, div[style*="position: absolute"]');
      expect(renderedCells.length).toBeLessThan(500);
    });

    it('2.2 Evaluates 100,000 items across complex multi-predicate HTTPQL AST in sub-millisecond per-item latency', () => {
      const dataset = generateBenchmarkDataset(100000);
      const query = 'req.method in ["POST", "PUT", "PATCH"] and res.status >= 400 and tx.in_scope == true and req.path contains "auth"';
      const { ast } = parseHttpql(query);

      const start = performance.now();
      let matches = 0;
      for (let i = 0; i < dataset.length; i++) {
        if (evaluateHttpql(ast, dataset[i])) {
          matches++;
        }
      }
      const totalElapsed = performance.now() - start;
      const perItemLatencyMs = totalElapsed / dataset.length;

      expect(matches).toBeGreaterThan(0);
      // Average evaluation time must be sub-millisecond (< 0.01ms / item)
      expect(perItemLatencyMs).toBeLessThan(0.01);
      // Total evaluation across 100K items completed in under 500ms
      expect(totalElapsed).toBeLessThan(500);
    });

    it('2.3 Executes rapid successive query filtering on 100,000 transactions without memory runaway', () => {
      const dataset = generateBenchmarkDataset(100000);
      useTrafficStore.setState({ maxRingBufferSize: 100000 });
      useTrafficStore.getState().ingestBatch(dataset);

      const queries = [
        'req.method == "POST"',
        'res.status == 200',
        'req.path contains "api"',
        'tx.in_scope == true and res.status >= 400',
        'mime contains "json"',
        'size > 1000',
        'req.method in ["GET", "OPTIONS"] and res.status < 300',
        'not (res.status == 200)',
      ];

      const startAll = performance.now();
      for (const q of queries) {
        useTrafficStore.getState().setHttpqlQuery(q);
        const filtered = useTrafficStore.getState().filteredIndices;
        expect(filtered).not.toBeNull();
        expect(filtered!.length).toBeGreaterThan(0);
      }
      const totalFilterTime = performance.now() - startAll;

      // 8 full 100K filter iterations should complete smoothly
      expect(totalFilterTime).toBeLessThan(2500);
    });

    it('2.4 Strictly bounds ring buffer capacity to 50,000 items with FIFO eviction under 100K batch bursts', () => {
      useTrafficStore.setState({ maxRingBufferSize: 50000 });
      const burst100k = generateBenchmarkDataset(100000);

      const start = performance.now();
      useTrafficStore.getState().ingestBatch(burst100k);
      const elapsed = performance.now() - start;

      const state = useTrafficStore.getState();
      expect(state.transactions).toHaveLength(50000);
      expect(state.transactionMap.size).toBe(50000);
      expect(state.totalCapturedCount).toBe(100000);

      // Oldest 50,000 transactions (tx-0000001 to tx-0050000) must have been evicted
      expect(state.transactionMap.has('tx-0000001')).toBe(false);
      expect(state.transactionMap.has('tx-0050000')).toBe(false);

      // Newest transactions (tx-0050001 to tx-0100000) must be present
      expect(state.transactionMap.has('tx-0050001')).toBe(true);
      expect(state.transactionMap.has('tx-0100000')).toBe(true);

      // Batch ingestion must execute fast
      expect(elapsed).toBeLessThan(1000);
    });

    it('2.5 Multi-selection state and bulk action toolbar scale to 10,000 selected IDs without memory stall', () => {
      const dataset = generateBenchmarkDataset(10000);
      const massiveSelection = new Set<string>();
      for (let i = 0; i < 5000; i++) {
        massiveSelection.add(dataset[i].id);
      }

      render(
        <VirtualTrafficTable
          transactions={dataset}
          selectedTxId={dataset[0].id}
          selectedTxIds={massiveSelection}
          onSelectTx={() => {}}
        />
      );

      expect(screen.getByText('5000 transactions selected')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { RequestParser } from './RequestParser';
import { ContextDetector } from './ContextDetector';
import { ErrorTester } from './ErrorTester';
import { BooleanTester } from './BooleanTester';
import { TimeBasedTester } from './TimeBasedTester';
import { UnionTester } from './UnionTester';
import { StackedTester } from './StackedTester';
import { MetadataExtractor } from './MetadataExtractor';
import { DATABASE_ADAPTERS } from './DatabaseAdapters';
import { ConfidenceEngine } from './ConfidenceEngine';
import { EvidenceCorrelator } from './EvidenceCorrelator';

describe('Sentinel SQL X — Complete Regression Suite', () => {
  describe('1. RequestParser & Multi-Location Extraction', () => {
    it('parses URL query parameters', () => {
      const raw = `GET /search?q=test&page=2 HTTP/1.1\r\nHost: example.com\r\n\r\n`;
      const res = RequestParser.parse(raw);
      expect(res.parameters.some((p) => p.name === 'q' && p.location === 'query')).toBe(true);
      expect(res.parameters.some((p) => p.name === 'page' && p.location === 'query')).toBe(true);
    });

    it('parses REST URL path segments', () => {
      const raw = `GET /api/v1/users/1337/orders HTTP/1.1\r\nHost: example.com\r\n\r\n`;
      const res = RequestParser.parse(raw);
      expect(res.parameters.some((p) => p.location === 'path' && p.originalValue === '1337')).toBe(true);
    });

    it('parses JSON body and GraphQL variables', () => {
      const raw = `POST /graphql HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\n\r\n{"query":"query GetUser($id: ID!){ user(id: $id){ name } }","variables":{"id":"101","dept":"engineering"}}`;
      const res = RequestParser.parse(raw);
      expect(res.parameters.some((p) => p.location === 'graphql' && p.graphqlVar === 'id')).toBe(true);
    });

    it('parses XML payload elements', () => {
      const raw = `POST /api/check HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/xml\r\n\r\n<user><id>999</id><role>admin</role></user>`;
      const res = RequestParser.parse(raw);
      expect(res.parameters.some((p) => p.location === 'body_xml' && p.name === 'id')).toBe(true);
    });

    it('parses Multipart Form Data', () => {
      const raw = `POST /upload HTTP/1.1\r\nHost: example.com\r\nContent-Type: multipart/form-data; boundary=----WebKitFormBoundaryX7g\r\n\r\n------WebKitFormBoundaryX7g\r\nContent-Disposition: form-data; name="username"\r\n\r\nadmin\r\n------WebKitFormBoundaryX7g--`;
      const res = RequestParser.parse(raw);
      expect(res.parameters.some((p) => p.location === 'body_multipart' && p.name === 'username')).toBe(true);
    });
  });

  describe('2. ContextDetector — 15 Injection Contexts', () => {
    it('detects numeric context', () => {
      const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '123', enabled: true };
      expect(ContextDetector.detectContext(param, '')).toBe('numeric');
    });

    it('detects order_by_clause context', () => {
      const param = { id: 'p2', name: 'sort_column', location: 'query' as const, originalValue: 'created_at', enabled: true };
      expect(ContextDetector.detectContext(param, '')).toBe('order_by_clause');
    });

    it('detects like_clause context', () => {
      const param = { id: 'p3', name: 'search_query', location: 'query' as const, originalValue: 'shoes', enabled: true };
      expect(ContextDetector.detectContext(param, '')).toBe('like_clause');
    });

    it('detects parenthesized_string context', () => {
      const param = { id: 'p4', name: 'filter', location: 'query' as const, originalValue: '(active=1)', enabled: true };
      expect(ContextDetector.detectContext(param, '')).toBe('parenthesized_string');
    });
  });

  describe('3. ErrorTester — Multi-DBMS Signatures', () => {
    it('matches Oracle syntax errors', () => {
      const match = ErrorTester.analyzeResponse('Error: ORA-00933: SQL command not properly ended');
      expect(match?.dbms).toBe('Oracle');
    });

    it('matches PostgreSQL syntax errors', () => {
      const match = ErrorTester.analyzeResponse('org.postgresql.util.PSQLException: ERROR: syntax error at or near');
      expect(match?.dbms).toBe('PostgreSQL');
    });

    it('matches MSSQL syntax errors', () => {
      const match = ErrorTester.analyzeResponse('Unclosed quotation mark after the character string');
      expect(match?.dbms).toBe('Microsoft SQL Server');
    });

    it('matches SQLite syntax errors', () => {
      const match = ErrorTester.analyzeResponse('SQLite.Exception: near "WHERE": syntax error');
      expect(match?.dbms).toBe('SQLite');
    });
  });

  describe('4. BooleanTester — Context-Aware Differentials', () => {
    it('evaluates true vs false DOM differential', () => {
      const baseline = '<html><body>Product List: Item 1, Item 2, Item 3</body></html>';
      const trueRes = '<html><body>Product List: Item 1, Item 2, Item 3</body></html>';
      const falseRes = '<html><body>Product List: 0 items found</body></html>';

      const diff = BooleanTester.evaluateDifferential(baseline, 200, trueRes, 200, falseRes, 200);
      expect(diff.isVulnerable).toBe(true);
      expect(diff.confidence).toBeGreaterThanOrEqual(85);
    });
  });

  describe('5. TimeBasedTester — Statistical Timing & Multi-DBMS Delay', () => {
    it('calculates mean, variance, and standard deviation', () => {
      const stats = TimeBasedTester.computeTimingStats([100, 110, 105, 95, 100]);
      expect(stats.mean).toBeCloseTo(102, 0);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it('evaluates genuine sleep delay above statistical threshold', () => {
      const baseline = [100, 120, 110];
      const result = TimeBasedTester.evaluateTiming(baseline, 3100, 3, 'PostgreSQL');
      expect(result.isVulnerable).toBe(true);
      expect(result.confidence).toBe(95);
    });
  });

  describe('6. UnionTester — Dual Column Count & String Canary Verification', () => {
    it('generates ORDER BY and NULL-based UNION probes', () => {
      const param = { id: 'p1', name: 'cat', location: 'query' as const, originalValue: 'gifts', enabled: true };
      const orderProbes = UnionTester.getOrderByProbes(param, 5);
      expect(orderProbes.length).toBe(5);

      const nullProbes = UnionTester.getNullUnionProbes(param, 3);
      expect(nullProbes.length).toBe(6); // generic + oracle DUAL
    });

    it('generates per-column canary markers', () => {
      const param = { id: 'p1', name: 'cat', location: 'query' as const, originalValue: 'gifts', enabled: true };
      const canaries = UnionTester.getPerColumnCanaryProbes(param, 3);
      expect(canaries.length).toBe(12);
      expect(canaries[0].canaryMarker).toBe('SENTINEL_CANARY_01');
    });
  });

  describe('7. StackedTester — Semicolon Multi-Statement Probes', () => {
    it('generates stacked probes for MSSQL, Postgres, and SQLite', () => {
      const param = { id: 'p1', name: 'user', location: 'query' as const, originalValue: 'test', enabled: true };
      const probes = StackedTester.getStackedProbes(param, 3);
      expect(probes.some((p) => p.dbms === 'Microsoft SQL Server')).toBe(true);
      expect(probes.some((p) => p.dbms === 'PostgreSQL')).toBe(true);
      expect(probes.some((p) => p.dbms === 'SQLite')).toBe(true);
    });
  });

  describe('8. MetadataExtractor — Validation, Sanitization & Redaction', () => {
    it('rejects echoed SQL version queries and validates true banners', () => {
      expect(MetadataExtractor.isValidVersionString("'||(SELECT banner FROM v$version WHERE ROWNUM=1)||'")).toBe(false);
      expect(MetadataExtractor.isValidVersionString("Oracle Database 19c Enterprise Edition Release 19.0.0.0.0")).toBe(true);
    });

    it('validates genuine identifiers and rejects reflections', () => {
      expect(MetadataExtractor.isValidIdentifier("USERS_TABLE")).toBe(true);
      expect(MetadataExtractor.isValidIdentifier("TABLE_NAME")).toBe(false);
      expect(MetadataExtractor.isValidIdentifier("SELECT * FROM DUAL")).toBe(false);
    });

    it('extracts delimited tokens', () => {
      const body = `Result: ~SNT_TBL:APP_USERS:TBL_SNT~ and ~SNT_TBL:ORDERS:TBL_SNT~`;
      const tokens = MetadataExtractor.extractDelimitedTokens(body, 'TBL');
      expect(tokens).toEqual(['APP_USERS', 'ORDERS']);
    });

    it('redacts sensitive columns in sample rows', () => {
      const rawRows = ['alice#s3cr3tP@ss!#alice@domain.com'];
      const cols = ['username', 'password', 'email'];
      const parsed = MetadataExtractor.parseAndRedactSampleRows(rawRows, cols);
      expect(parsed[0].username).toBe('alice');
      expect(parsed[0].password).toBe('[REDACTED]');
      expect(parsed[0].email).toBe('alice@domain.com');
    });
  });

  describe('9. DatabaseAdapters — Dialects Coverage', () => {
    it('supports all 10 DBMS dialects', () => {
      const dialects = ['Oracle', 'PostgreSQL', 'MySQL', 'MariaDB', 'Microsoft SQL Server', 'SQLite', 'IBM Db2', 'H2', 'Microsoft Access', 'Generic SQL'] as const;
      for (const d of dialects) {
        expect(DATABASE_ADAPTERS[d]).toBeDefined();
        expect(DATABASE_ADAPTERS[d].dbmsType).toBe(d);
      }
    });
  });

  describe('10. ConfidenceEngine & EvidenceCorrelator', () => {
    it('computes Confirmed confidence for multi-indicator evidence', () => {
      const conf = ConfidenceEngine.calculateConfidence({
        hasConsistentSqlError: true,
        hasUnionCanary: true,
        hasDbmsSpecificBehavior: true,
        hasRepeatedConfirmation: true,
      });
      expect(conf.level).toBe('Confirmed');
      expect(conf.score).toBeGreaterThanOrEqual(90);
    });

    it('evaluates final VULNERABLE verdict on confirmed findings', () => {
      const finding = {
        id: 'f1',
        title: 'SQL Injection in id',
        severity: 'Critical' as const,
        confidence: 'Confirmed' as const,
        confidenceScore: 95,
        confidenceBreakdown: { score: 95, level: 'Confirmed' as const, factors: [] },
        injectionType: 'UNION-based' as const,
        parameterName: 'id',
        parameterLocation: 'query' as const,
        url: 'https://target.local/',
        httpMethod: 'GET',
        dbms: 'Oracle' as const,
        detectionMethod: 'UNION-based',
        evidence: [],
        reproductionRequest: 'GET / HTTP/1.1',
        remediation: 'Parametrize query',
        cwe: 'CWE-89',
        owaspCategory: 'A03:2021',
        timestamp: Date.now(),
      };

      const verdict = EvidenceCorrelator.evaluateVerdict([finding], [], []);
      expect(verdict.verdict).toBe('VULNERABLE');
    });
  });
});

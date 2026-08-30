import { describe, it, expect } from 'vitest';
import {
  tokenizeHttpql,
  parseHttpql,
  validateHttpql,
  evaluateHttpql,
  compileHttpqlToSql,
  getHttpqlSuggestions,
} from '../../src/utils/httpql';
import { TrafficSummary } from '../../src/types/traffic';

describe('HTTPQL Grammar, Lexer, AST Parser & Evaluator (sentinel_httpql parity)', () => {
  const sampleSummary: TrafficSummary = {
    id: 'tx-000123',
    seqNumber: 123,
    timestamp: '14:23:45',
    timestampMs: 1720000000000,
    method: 'POST',
    url: 'https://api.target.local/v1/auth/token',
    host: 'api.target.local',
    path: '/v1/auth/token',
    status: 401,
    durationMs: 245,
    sizeBytes: 1024,
    inScope: true,
    mimeType: 'application/json',
    tags: ['scope:target', 'auth', 'unauthorized'],
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
  };

  describe('1. Lexer & Tokenizer', () => {
    it('tokenizes comparison operators (==, !=, <, <=, >, >=, contains, in)', () => {
      const query = 'req.method == "GET" and res.status >= 400 or req.path contains "auth"';
      const { tokens, errors } = tokenizeHttpql(query);

      expect(errors).toHaveLength(0);
      expect(tokens.length).toBeGreaterThan(5);

      const fieldToken = tokens[0];
      expect(fieldToken.type).toBe('FIELD');
      expect(fieldToken.value).toBe('req.method');

      const opToken = tokens[1];
      expect(opToken.type).toBe('OPERATOR');
      expect(opToken.value).toBe('==');

      const strToken = tokens[2];
      expect(strToken.type).toBe('STRING_LITERAL');
      expect(strToken.value).toBe('GET');

      const andToken = tokens[3];
      expect(andToken.type).toBe('LOGICAL_AND');

      const numToken = tokens[6];
      expect(numToken.type).toBe('NUMBER_LITERAL');
      expect(numToken.value).toBe('400');
    });

    it('handles list literals like in ["POST", "PUT"]', () => {
      const query = 'method in ["POST", "PUT", "PATCH"]';
      const { tokens, errors } = tokenizeHttpql(query);

      expect(errors).toHaveLength(0);
      expect(tokens.some((t) => t.type === 'LIST_OPEN')).toBe(true);
      expect(tokens.some((t) => t.type === 'LIST_CLOSE')).toBe(true);
      expect(tokens.some((t) => t.value === 'POST')).toBe(true);
    });

    it('reports syntax errors with exact character offsets for unclosed quotes', () => {
      const query = 'req.path == "unclosed';
      const { errors } = tokenizeHttpql(query);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].offset).toBe(12);
      expect(errors[0].message).toContain('Unclosed string literal');
    });
  });

  describe('2. AST Parser & Precedence', () => {
    it('respects precedence: NOT > AND > OR', () => {
      const query = 'not req.method == "GET" and res.status == 200 or req.host == "target.local"';
      const { ast, error } = parseHttpql(query);

      expect(error).toBeUndefined();
      expect(ast.type).toBe('LOGICAL');
      if (ast.type === 'LOGICAL') {
        expect(ast.operator).toBe('OR');
        expect(ast.left.type).toBe('LOGICAL');
        if (ast.left.type === 'LOGICAL') {
          expect(ast.left.operator).toBe('AND');
          expect(ast.left.left.type).toBe('UNARY');
        }
      }
    });

    it('parses parenthesized sub-expressions correctly', () => {
      const query = '(req.method == "POST" or req.method == "PUT") and res.status >= 400';
      const { ast, error } = parseHttpql(query);

      expect(error).toBeUndefined();
      expect(ast.type).toBe('LOGICAL');
      if (ast.type === 'LOGICAL') {
        expect(ast.operator).toBe('AND');
        expect(ast.left.type).toBe('LOGICAL');
        if (ast.left.type === 'LOGICAL') {
          expect(ast.left.operator).toBe('OR');
        }
      }
    });

    it('extracts referenced fields for query optimization', () => {
      const query = 'req.method == "GET" and res.status >= 400 and tx.in_scope == true';
      const { referencedFields } = parseHttpql(query);

      expect(referencedFields).toContain('req.method');
      expect(referencedFields).toContain('res.status');
      expect(referencedFields).toContain('tx.in_scope');
    });
  });

  describe('3. In-Memory AST Evaluator', () => {
    it('evaluates status numerical comparisons', () => {
      const { ast: ast1 } = parseHttpql('res.status == 401');
      expect(evaluateHttpql(ast1, sampleSummary)).toBe(true);

      const { ast: ast2 } = parseHttpql('res.status >= 400');
      expect(evaluateHttpql(ast2, sampleSummary)).toBe(true);

      const { ast: ast3 } = parseHttpql('res.status < 400');
      expect(evaluateHttpql(ast3, sampleSummary)).toBe(false);
    });

    it('evaluates string operators (contains, starts_with, ends_with, matches)', () => {
      const { ast: astContains } = parseHttpql('req.path contains "auth"');
      expect(evaluateHttpql(astContains, sampleSummary)).toBe(true);

      const { ast: astStartsWith } = parseHttpql('req.path starts_with "/v1"');
      expect(evaluateHttpql(astStartsWith, sampleSummary)).toBe(true);

      const { ast: astEndsWith } = parseHttpql('req.path ends_with "token"');
      expect(evaluateHttpql(astEndsWith, sampleSummary)).toBe(true);

      const { ast: astMatches } = parseHttpql('req.path matches "^/v1/auth/.*"');
      expect(evaluateHttpql(astMatches, sampleSummary)).toBe(true);
    });

    it('evaluates list containment (in / not in)', () => {
      const { ast: astIn } = parseHttpql('req.method in ["POST", "PUT"]');
      expect(evaluateHttpql(astIn, sampleSummary)).toBe(true);

      const { ast: astNotIn } = parseHttpql('req.method not in ["GET", "DELETE"]');
      expect(evaluateHttpql(astNotIn, sampleSummary)).toBe(true);
    });

    it('evaluates scope and tag predicates', () => {
      const { ast: astScope } = parseHttpql('tx.in_scope == true');
      expect(evaluateHttpql(astScope, sampleSummary)).toBe(true);

      const { ast: astTags } = parseHttpql('tags contains "auth"');
      expect(evaluateHttpql(astTags, sampleSummary)).toBe(true);
    });
  });

  describe('4. Validator & SQL Compiler', () => {
    it('validates correct queries and generates SQL WHERE clause', () => {
      const result = validateHttpql('req.method == "POST" and res.status >= 400');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.compiledSqlWhere).toBeDefined();
      expect(result.compiledSqlWhere).toContain('req_method');
      expect(result.compiledSqlWhere).toContain('res_status');
    });

    it('returns error details for invalid queries', () => {
      const result = validateHttpql('req.method ==');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Expected value after operator');
    });

    it('compiles complex AST to SQL WHERE clause', () => {
      const { ast } = parseHttpql('req.path contains "login" and (res.status == 200 or res.status == 302)');
      const sql = compileHttpqlToSql(ast);

      expect(sql).toContain("req_uri LIKE '%login%'");
      expect(sql).toContain('AND');
      expect(sql).toContain('res_status');
    });
  });

  describe('5. Context-Aware Autocomplete Suggestions', () => {
    it('suggests fields when query is empty or starts a new clause', () => {
      const suggestions = getHttpqlSuggestions('', 0);
      expect(suggestions.some((s) => s.label === 'req.method')).toBe(true);
      expect(suggestions.some((s) => s.label === 'res.status')).toBe(true);
      expect(suggestions.some((s) => s.label === 'tx.in_scope')).toBe(true);
    });

    it('suggests comparison operators after a field name', () => {
      const query = 'req.method ';
      const suggestions = getHttpqlSuggestions(query, query.length);

      expect(suggestions.some((s) => s.label === '==')).toBe(true);
      expect(suggestions.some((s) => s.label === 'contains')).toBe(true);
      expect(suggestions.some((s) => s.label === 'in')).toBe(true);
    });

    it('suggests HTTP methods after req.method ==', () => {
      const query = 'req.method == ';
      const suggestions = getHttpqlSuggestions(query, query.length);

      expect(suggestions.some((s) => s.label === '"GET"')).toBe(true);
      expect(suggestions.some((s) => s.label === '"POST"')).toBe(true);
    });

    it('suggests common status codes after res.status ==', () => {
      const query = 'res.status == ';
      const suggestions = getHttpqlSuggestions(query, query.length);

      expect(suggestions.some((s) => s.label === '200')).toBe(true);
      expect(suggestions.some((s) => s.label === '404')).toBe(true);
      expect(suggestions.some((s) => s.label === '500')).toBe(true);
    });
  });
});

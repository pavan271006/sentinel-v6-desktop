import { describe, it, expect } from 'vitest';
import { ContextDetector } from './ContextDetector';
import { BooleanTester } from './BooleanTester';
import { DialectMatrix } from './engine/DialectMatrix';
import { DriverInspectionEngine } from './engine/DriverInspectionEngine';
import { SQL_PAYLOAD_CATALOG } from './payloads/SqlPayloads';
import { NORMALIZED_TAXONOMY, TaxonomyCatalog } from './taxonomy/TaxonomyCatalog';
import { CandidateParameter } from '../../types/sqlScanner';

describe('Sentinel V7 — Exhaustive SQL Injection Coverage & Completion Benchmark', () => {
  // ─── 1. SYNTACTIC CONTEXT DETECTION (MERGE, DATE/TIME, VECTOR, ARRAY) ─────
  describe('1. Enhanced Syntactic Context Detection', () => {
    it('detects MERGE INTO and UPSERT clause contexts', () => {
      const pMerge: CandidateParameter = {
        id: 'p_merge',
        name: 'upsert_key',
        location: 'body_json',
        originalValue: '1001',
        enabled: true,
      };
      const rawReq = 'POST /api/sync HTTP/1.1\r\n\r\n{"upsert_key":"1001"}';
      expect(ContextDetector.detectContext(pMerge, rawReq)).toBe('merge_clause');

      const pConflict: CandidateParameter = {
        id: 'p_conflict',
        name: 'on_conflict_target',
        location: 'query',
        originalValue: 'email',
        enabled: true,
      };
      expect(ContextDetector.detectContext(pConflict, 'GET /api?on_conflict_target=email')).toBe('merge_clause');
    });

    it('detects Date/Time temporal contexts from format and parameter names', () => {
      const pDate: CandidateParameter = {
        id: 'p_date',
        name: 'created_at',
        location: 'query',
        originalValue: '2026-09-13',
        enabled: true,
      };
      expect(ContextDetector.detectContext(pDate, 'GET /api?created_at=2026-09-13')).toBe('date_time');

      const pIso: CandidateParameter = {
        id: 'p_iso',
        name: 'filter_time',
        location: 'query',
        originalValue: '2026-09-13T15:30:00Z',
        enabled: true,
      };
      expect(ContextDetector.detectContext(pIso, 'GET /api?filter_time=2026-09-13T15:30:00Z')).toBe('date_time');
    });

    it('detects Vector DB similarity search and embedding contexts', () => {
      const pVec: CandidateParameter = {
        id: 'p_vec',
        name: 'embedding_query',
        location: 'body_json',
        originalValue: '[0.12, 0.45, -0.67]',
        enabled: true,
      };
      expect(ContextDetector.detectContext(pVec, 'POST /api/search')).toBe('vector_op');

      const pDist: CandidateParameter = {
        id: 'p_dist',
        name: 'cosine_distance',
        location: 'query',
        originalValue: '0.8',
        enabled: true,
      };
      expect(ContextDetector.detectContext(pDist, 'GET /api?cosine_distance=0.8')).toBe('vector_op');
    });

    it('detects Array collection contexts', () => {
      const pArr: CandidateParameter = {
        id: 'p_arr',
        name: 'user_tags',
        location: 'query',
        originalValue: '{admin,auditor}',
        enabled: true,
      };
      expect(ContextDetector.detectContext(pArr, 'GET /api?user_tags={admin,auditor}')).toBe('array_derived');
    });
  });

  // ─── 2. DYNAMIC TEST PAIR SYNTHESIS FOR NEW CONTEXTS ──────────────────────
  describe('2. Dynamic Differential Synthesis for Expanded Grammars', () => {
    it('synthesizes specialized boolean test pairs for merge_clause', () => {
      const param: CandidateParameter = {
        id: 'p_merge',
        name: 'merge_col',
        location: 'body_form',
        originalValue: 'id_val',
        detectedContext: 'merge_clause',
        enabled: true,
      };
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(4);
      expect(pairs.some((p) => p.name.includes('MERGE ON'))).toBe(true);
      expect(pairs.some((p) => p.truePayload.includes("') AND (1=1)"))).toBe(true);
      expect(pairs.some((p) => p.isConditionalError === true)).toBe(true);
    });

    it('synthesizes temporal boolean equality and exception pairs for date_time', () => {
      const param: CandidateParameter = {
        id: 'p_date',
        name: 'start_date',
        location: 'query',
        originalValue: '2026-01-01',
        detectedContext: 'date_time',
        enabled: true,
      };
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(3);
      expect(pairs.some((p) => p.truePayload.includes('CURRENT_DATE=CURRENT_DATE'))).toBe(true);
      expect(pairs.some((p) => p.truePayload.includes('NOW()=NOW()'))).toBe(true);
      expect(pairs.some((p) => p.isConditionalError === true)).toBe(true);
    });

    it('synthesizes vector operator non-negativity pairs for vector_op', () => {
      const param: CandidateParameter = {
        id: 'p_vec',
        name: 'query_vector',
        location: 'body_json',
        originalValue: '[0,0,0]',
        detectedContext: 'vector_op',
        enabled: true,
      };
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs.some((p) => p.truePayload.includes('<->'))).toBe(true);
      expect(pairs.some((p) => p.isConditionalError === true)).toBe(true);
    });

    it('synthesizes array membership test pairs for array_derived', () => {
      const param: CandidateParameter = {
        id: 'p_arr',
        name: 'tags',
        location: 'query',
        originalValue: '1',
        detectedContext: 'array_derived',
        enabled: true,
      };
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs.some((p) => p.truePayload.includes('ANY(ARRAY[1])'))).toBe(true);
    });
  });

  // ─── 3. NATIVE DIALECT MATRIX CAPABILITY DECOUPLING ───────────────────────
  describe('3. Native Dialect Matrix Implementations', () => {
    it('verifies Amazon Redshift does NOT use invalid pg_sleep()', () => {
      const redshift = DialectMatrix.get('Amazon Redshift');
      expect(redshift.dbms).toBe('Amazon Redshift');
      // Must not contain pg_sleep, which throws an error on Redshift
      const sleepQuery = redshift.sleepFn(5);
      expect(sleepQuery).not.toContain('pg_sleep');
      expect(sleepQuery).toContain('SELECT count(*)');
      expect(redshift.batchAggregateRows('col')).toContain('LISTAGG');
      expect(redshift.columnCatalogQuery('users')).toContain('svv_columns');
    });

    it('verifies DuckDB native capabilities and range computational delays', () => {
      const duckdb = DialectMatrix.get('DuckDB');
      expect(duckdb.dbms).toBe('DuckDB');
      const sleepQuery = duckdb.sleepFn(2);
      expect(sleepQuery).toContain('range');
      expect(duckdb.batchAggregateRows('col')).toContain('string_agg');
      expect(duckdb.tableCatalogQuery()).toContain('main');
    });

    it('verifies Trino & Presto newline-terminated comments and fail() error triggers', () => {
      const trino = DialectMatrix.get('Trino');
      expect(trino.dbms).toBe('Trino');
      expect(trino.runtimeExceptionTrue).toContain('fail(');
      const condError = trino.conditionalErrorWrapper('1=1');
      // Must terminate with newline to prevent Trino syntax errors on trailing comments
      expect(condError.truePayload).toMatch(/-- \n$/);
      expect(trino.stringConcatFn!(['a', 'b'])).toContain('concat(a,b)');

      const presto = DialectMatrix.get('Presto');
      expect(presto.dbms).toBe('Presto');
      expect(presto.conditionalErrorWrapper('1=1').truePayload).toMatch(/-- \n$/);
    });

    it('verifies Vertica native SLEEP function', () => {
      const vertica = DialectMatrix.get('Vertica');
      expect(vertica.dbms).toBe('Vertica');
      expect(vertica.sleepFn(4)).toBe('SLEEP(4)');
      expect(vertica.tableCatalogQuery()).toContain('v_catalog.tables');
    });

    it('verifies ClickHouse and Snowflake native analytical execution', () => {
      const clickhouse = DialectMatrix.get('ClickHouse');
      expect(clickhouse.runtimeExceptionTrue).toBe('throwIf(1)');
      expect(clickhouse.sleepFn(3)).toBe('sleep(3)');

      const snowflake = DialectMatrix.get('Snowflake');
      expect(snowflake.sleepFn(5)).toBe('SYSTEM$WAIT(5)');
      expect(snowflake.conditionalErrorWrapper('1=1').truePayload).toContain('IFF(');
    });
  });

  // ─── 4. DRIVER INSPECTION ENGINE & PREPARE INFERENCE ──────────────────────
  describe('4. Driver Inspection Engine (Emulated Prepares vs Binary Binds)', () => {
    it('infers CLIENT_EMULATED_PREPARES when stacked queries and multibyte quotes succeed', () => {
      const result = DriverInspectionEngine.evaluateDriverBehavior({
        stackedQueryExecuted: true,
        multibyteQuoteBroken: true,
        arithmeticEvaluated: true,
        rawSyntaxErrorObserved: true,
      });

      expect(result.inferredMode).toBe('CLIENT_EMULATED_PREPARES');
      expect(result.stackedQueriesSupported).toBe(true);
      expect(result.multibyteSmugglingVulnerable).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.recommendation).toContain('PDO::ATTR_EMULATE_PREPARES');
    });

    it('infers RAW_CONCATENATION when syntax errors occur without stacked query support', () => {
      const result = DriverInspectionEngine.evaluateDriverBehavior({
        stackedQueryExecuted: false,
        multibyteQuoteBroken: false,
        arithmeticEvaluated: true,
        rawSyntaxErrorObserved: true,
      });

      expect(result.inferredMode).toBe('RAW_CONCATENATION');
      expect(result.recommendation).toContain('parameterized queries');
    });

    it('infers SERVER_BINARY_PREPARED when input is safely encapsulated', () => {
      const result = DriverInspectionEngine.evaluateDriverBehavior({
        stackedQueryExecuted: false,
        multibyteQuoteBroken: false,
        arithmeticEvaluated: false,
        rawSyntaxErrorObserved: false,
      });

      expect(result.inferredMode).toBe('SERVER_BINARY_PREPARED');
      expect(result.stackedQueriesSupported).toBe(false);
    });
  });

  // ─── 5. PAYLOAD CATALOG & DEPTH LADDER G1–G22 INTEGRITY ───────────────────
  describe('5. Payload Catalog Depth Ladder Levels (G1 to G22)', () => {
    it('contains all 22 structured ladder levels in SQL_PAYLOAD_CATALOG', () => {
      const levels = new Set(SQL_PAYLOAD_CATALOG.map((p) => p.level));
      for (let lvl = 1; lvl <= 22; lvl++) {
        expect(levels.has(lvl)).toBe(true);
      }

      // Check specific new entries
      const g20 = SQL_PAYLOAD_CATALOG.filter((p) => p.level === 20);
      expect(g20.length).toBeGreaterThanOrEqual(2);
      expect(g20.some((p) => p.context === 'merge_clause')).toBe(true);

      const g21 = SQL_PAYLOAD_CATALOG.filter((p) => p.level === 21);
      expect(g21.length).toBeGreaterThanOrEqual(2);
      expect(g21.some((p) => p.context === 'date_time')).toBe(true);

      const g22 = SQL_PAYLOAD_CATALOG.filter((p) => p.level === 22);
      expect(g22.length).toBeGreaterThanOrEqual(2);
      expect(g22.some((p) => p.context === 'vector_op')).toBe(true);
    });
  });

  // ─── 6. NORMALIZED MULTI-DIMENSIONAL TAXONOMY AUDIT ───────────────────────
  describe('6. Normalized Multi-Dimensional Taxonomy Architecture', () => {
    it('separates orthogonal dimensions into normalized catalog records', () => {
      expect(NORMALIZED_TAXONOMY.syntacticContexts.length).toBeGreaterThanOrEqual(20);
      expect(NORMALIZED_TAXONOMY.mechanisms.length).toBe(18);
      expect(NORMALIZED_TAXONOMY.targetEngines.length).toBe(30);
      expect(NORMALIZED_TAXONOMY.transports.length).toBeGreaterThanOrEqual(9);
      expect(NORMALIZED_TAXONOMY.statementFamilies.length).toBe(13);
      expect(NORMALIZED_TAXONOMY.observationOracles.length).toBe(15);

      // Verify Tier classifications
      const tier1 = NORMALIZED_TAXONOMY.targetEngines.filter((e) => e.tier === 'TIER_1_TESTED');
      expect(tier1.length).toBe(6); // 5 core + Generic SQL

      const tier2 = NORMALIZED_TAXONOMY.targetEngines.filter((e) => e.tier === 'TIER_2_ADAPTER');
      expect(tier2.length).toBeGreaterThanOrEqual(12);

      // Ensure TaxonomyCatalog exports it cleanly
      expect(TaxonomyCatalog.NORMALIZED_TAXONOMY).toBeDefined();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { ContextDetector } from './ContextDetector';
import { BooleanTester } from './BooleanTester';
import { ParameterClassifier } from './engine/ParameterClassifier';
import { DialectMatrix } from './engine/DialectMatrix';
import { SQL_PAYLOAD_CATALOG } from './payloads/SqlPayloads';
import { MECHANISMS } from './taxonomy/TaxonomyCatalog';
import { CandidateParameter, InjectionContext, DbmsType, ParamTypeCategory } from '../../types/sqlScanner';

describe('Sentinel V7 — Maximum Verified SQL Injection Coverage Benchmark', () => {

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 1: 10 Advanced SQL Syntactic Contexts
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 1: Advanced SQL Syntactic Contexts Expansion', () => {

    it('1. LIMIT / OFFSET Context: correctly identifies and provides differential pairs', () => {
      const param: CandidateParameter = {
        id: 'p_limit',
        name: 'page_limit',
        location: 'query',
        originalValue: '25',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /items?page_limit=25');
      expect(context).toBe('limit_offset');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs.some((p) => p.truePayload.includes('CASE WHEN (1=1)'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'limit_offset');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('2. SELECT List Expression Context: detects projection injection and provides error pairs', () => {
      const param: CandidateParameter = {
        id: 'p_select',
        name: 'projection_fields',
        location: 'query',
        originalValue: 'id, name',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /data?projection_fields=id,name');
      expect(context).toBe('select_expr');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs.some((p) => p.isConditionalError && p.truePayload.includes('1/0'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'select_expr');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('3. JOIN Condition Context: classifies ON-clause parameters and produces relational pairs', () => {
      const param: CandidateParameter = {
        id: 'p_join',
        name: 'join_on_rel_id',
        location: 'query',
        originalValue: '1=1',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /graph?join_on_rel_id=1=1');
      expect(context).toBe('join_clause');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs.some((p) => p.truePayload.includes('AND 1=1') && p.falsePayload.includes('AND 1=2'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'join_clause');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('4. CASE / WHEN Expression Context: verifies branch condition evaluations', () => {
      const param: CandidateParameter = {
        id: 'p_case',
        name: 'case_when_branch',
        location: 'query',
        originalValue: '1',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /compute?case_when_branch=1');
      expect(context).toBe('case_expr');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.truePayload === '1=1' && p.falsePayload === '1=2')).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'case_expr');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('5. Window Function Context: verifies PARTITION BY expressions', () => {
      const param: CandidateParameter = {
        id: 'p_window',
        name: 'partition_window',
        location: 'query',
        originalValue: 'dept_id',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /stats?partition_window=dept_id');
      expect(context).toBe('window_func');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.name.includes('Window Partition'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'window_func');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('6. CTE / WITH Clause Context: verifies common table expression subqueries', () => {
      const param: CandidateParameter = {
        id: 'p_cte',
        name: 'with_recursive_cte',
        location: 'query',
        originalValue: 'node',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /tree?with_recursive_cte=node');
      expect(context).toBe('cte_clause');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.name.includes('CTE'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'cte_clause');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('7. Full-Text Search Context: verifies FTS string escape syntax', () => {
      const param: CandidateParameter = {
        id: 'p_fts',
        name: 'fts_tsquery',
        location: 'query',
        originalValue: 'cyber',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /search?fts_tsquery=cyber');
      expect(context).toBe('fulltext_search');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.truePayload.includes("' OR 1=1--"))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'fulltext_search');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('8. Spatial / GIS Context: verifies Well-Known-Text geometry differential pairs', () => {
      const param: CandidateParameter = {
        id: 'p_spatial',
        name: 'spatial_geom',
        location: 'query',
        originalValue: 'POINT(45.1 12.3)',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /map?spatial_geom=POINT(45.1 12.3)');
      expect(context).toBe('spatial_op');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.name.includes('Spatial'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'spatial_op');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('9. DELETE Condition Context: safe, non-destructive conditional evaluation', () => {
      const param: CandidateParameter = {
        id: 'p_del',
        name: 'delete_item_id',
        location: 'query',
        originalValue: '55',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'POST /items/delete_item_id=55');
      expect(context).toBe('delete_where');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.name.includes('DELETE Safe'))).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'delete_where');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });

    it('10. Boolean Literal Parameter Context: verifies in-line boolean truth invariants', () => {
      const param: CandidateParameter = {
        id: 'p_bool',
        name: 'is_active_flag',
        location: 'query',
        originalValue: 'true',
        enabled: true,
      };
      const context = ContextDetector.detectContext(param, 'GET /users?is_active_flag=true');
      expect(context).toBe('boolean_literal');

      param.detectedContext = context;
      const pairs = BooleanTester.getTestPairs(param);
      expect(pairs.some((p) => p.truePayload === 'true AND 1=1')).toBe(true);

      const catalogPayloads = SQL_PAYLOAD_CATALOG.filter((p) => p.context === 'boolean_literal');
      expect(catalogPayloads.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 2: Multi-Type Parameter Classifier & Test Optimization
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 2: Multi-Type Parameter Classifier & Test Set Pruning', () => {
    it('accurately identifies UUID format and suggests targeted test families', () => {
      const param: CandidateParameter = {
        id: 'p1',
        name: 'tenant_uuid',
        location: 'query',
        originalValue: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        enabled: true,
      };
      const result = ParameterClassifier.classify(param);
      expect(result.category).toBe('uuid');
      expect(result.detectedFormat).toBe('uuid_v4');
      expect(result.recommendedTestFamilies).toContain('boolean');
      expect(result.recommendedTestFamilies).toContain('error');
    });

    it('classifies ISO datetime and dates with correct temporal context', () => {
      const paramDate: CandidateParameter = {
        id: 'p2',
        name: 'created_date',
        location: 'query',
        originalValue: '2026-09-13',
        enabled: true,
      };
      const resDate = ParameterClassifier.classify(paramDate);
      expect(resDate.category).toBe('date');
      expect(resDate.inferredContext).toBe('date_time');

      const paramTimestamp: CandidateParameter = {
        id: 'p3',
        name: 'event_time',
        location: 'query',
        originalValue: '2026-09-13T15:30:00Z',
        enabled: true,
      };
      const resTimestamp = ParameterClassifier.classify(paramTimestamp);
      expect(resTimestamp.category).toBe('timestamp');
      expect(resTimestamp.inferredContext).toBe('date_time');
    });

    it('classifies numeric float vectors and JSON arrays', () => {
      const paramVector: CandidateParameter = {
        id: 'p4',
        name: 'embedding',
        location: 'body_json',
        originalValue: '[0.12, -0.45, 0.88, 0.02]',
        enabled: true,
      };
      const resVector = ParameterClassifier.classify(paramVector);
      expect(resVector.category).toBe('vector');
      expect(resVector.inferredContext).toBe('vector_op');

      const paramArray: CandidateParameter = {
        id: 'p5',
        name: 'tags',
        location: 'body_json',
        originalValue: '["admin", "staff", "billing"]',
        enabled: true,
      };
      const resArray = ParameterClassifier.classify(paramArray);
      expect(resArray.category).toBe('array');
      expect(resArray.inferredContext).toBe('array_derived');
    });

    it('prunes tests: boolean parameters skip unnecessary UNION injection probes', () => {
      const optimal = ParameterClassifier.deriveOptimalTestSet('boolean', 'boolean_literal', 'PostgreSQL');
      expect(optimal.families).toContain('boolean');
      expect(optimal.families).toContain('time');
      expect(optimal.families).not.toContain('union');
      expect(optimal.estimatedProbes).toBeLessThan(10);
    });

    it('preserves full test families for vulnerable unquoted integers', () => {
      const optimal = ParameterClassifier.deriveOptimalTestSet('integer', 'numeric', 'PostgreSQL');
      expect(optimal.families).toContain('boolean');
      expect(optimal.families).toContain('error');
      expect(optimal.families).toContain('union');
      expect(optimal.families).toContain('stacked');
      expect(optimal.families).toContain('time');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 3: Native Database Dialect Implementations
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 3: Native DBMS Engine Implementations (No Fallback Aliases)', () => {
    it('SAP HANA: enforces FROM DUMMY, SYS.M_DATABASE, and SLEEP_SECONDS', () => {
      const cap = DialectMatrix.get('SAP HANA');
      expect(cap.dbms).toBe('SAP HANA');
      expect(cap.versionQuery).toBe('SELECT VERSION FROM SYS.M_DATABASE');
      expect(cap.currentUserQuery).toContain('FROM DUMMY');
      expect(cap.sleepFn(3)).toBe('SLEEP_SECONDS(3)');
      const errWrap = cap.conditionalErrorWrapper('1=1');
      expect(errWrap.truePayload).toContain('FROM DUMMY');
    });

    it('Teradata: enforces DBC.DBCInfo, QUALIFY ROW_NUMBER(), and TOP limit', () => {
      const cap = DialectMatrix.get('Teradata');
      expect(cap.dbms).toBe('Teradata');
      expect(cap.versionQuery).toContain('DBC.DBCInfo');
      expect(cap.limit1).toBe('TOP 1');
      expect(cap.limitOffset(10, 5)).toContain('QUALIFY ROW_NUMBER()');
      expect(cap.substringFn('val', 1, 4)).toBe('SUBSTR(val,1,4)');
    });

    it('Firebird: enforces FROM RDB$DATABASE, FIRST/SKIP limit, and SUBSTRING(... FROM ... FOR ...)', () => {
      const cap = DialectMatrix.get('Firebird');
      expect(cap.dbms).toBe('Firebird');
      expect(cap.versionQuery).toContain('RDB$DATABASE');
      expect(cap.limitOffset(20, 10)).toBe('FIRST 20 SKIP 10');
      expect(cap.substringFn('tbl', 1, 5)).toBe('SUBSTRING(tbl FROM 1 FOR 5)');
      expect(cap.asciiFn('col')).toBe('ASCII_VAL(col)');
    });

    it('Databricks SQL: uses ASSERT_TRUE and current_version().dbr_version', () => {
      const cap = DialectMatrix.get('Databricks SQL');
      expect(cap.dbms).toBe('Databricks SQL');
      expect(cap.versionQuery).toBe('SELECT current_version().dbr_version');
      expect(cap.runtimeExceptionTrue).toBe('ASSERT_TRUE(1=0)');
      expect(cap.sleepFn(2)).toContain('RANGE(0, 6000000)');
    });

    it('Azure Synapse: provides error-based type coercion without WAITFOR DELAY', () => {
      const cap = DialectMatrix.get('Azure Synapse');
      expect(cap.dbms).toBe('Azure Synapse');
      expect(cap.versionQuery).toBe('SELECT @@VERSION');
      expect(cap.runtimeExceptionTrue).toBe('1/0');
      expect(cap.limitOffset(10, 0)).toContain('OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
    });

    it('Apache Doris: provides analytical MPP syntax and information_schema queries', () => {
      const cap = DialectMatrix.get('Apache Doris');
      expect(cap.dbms).toBe('Apache Doris');
      expect(cap.versionQuery).toBe('SELECT version()');
      expect(cap.sleepFn(3)).toBe('sleep(3)');
      expect(cap.limitOffset(10, 5)).toBe('LIMIT 10 OFFSET 5');
    });

    it('SingleStore: provides clustered memory database syntax', () => {
      const cap = DialectMatrix.get('SingleStore');
      expect(cap.dbms).toBe('SingleStore');
      expect(cap.sleepFn(4)).toBe('SLEEP(4)');
      expect(cap.limitOffset(10, 5)).toBe('LIMIT 5,10');
    });

    it('Vitess: includes sharded routing comment annotations', () => {
      const cap = DialectMatrix.get('Vitess');
      expect(cap.dbms).toBe('Vitess');
      const errWrap = cap.conditionalErrorWrapper('1=1');
      expect(errWrap.truePayload).toContain('/*vt+ PLAN_ROUTER */');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 4: False-Positive Rejection & Multi-Signal Verification Traps
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 4: False-Positive Rejection & Invariant Verification Traps', () => {
    it('correctly rejects when FALSE response does NOT diverge from TRUE', () => {
      const baseline = '<html><body>Product List: 10 items</body></html>';
      const trueResp = '<html><body>Product List: 10 items</body></html>';
      const falseResp = '<html><body>Product List: 10 items</body></html>';

      const evalResult = BooleanTester.evaluateDifferential(
        baseline, 200,
        trueResp, 200,
        falseResp, 200,
        "' AND 1=1--", "' AND 1=2--"
      );
      expect(evalResult.isVulnerable).toBe(false);
      expect(evalResult.confidence).toBe(0);
    });

    it('correctly rejects random non-deterministic noise without differential marker', () => {
      const baseline = '<html><body>User Dashboard timestamp: 1000</body></html>';
      const trueResp = '<html><body>User Dashboard timestamp: 1002</body></html>';
      const falseResp = '<html><body>User Dashboard timestamp: 1005</body></html>';

      const evalResult = BooleanTester.evaluateDifferential(
        baseline, 200,
        trueResp, 200,
        falseResp, 200,
        "' AND 1=1--", "' AND 1=2--"
      );
      expect(evalResult.isVulnerable).toBe(false);
    });

    it('confirms genuine Error-on-TRUE conditional exception differential', () => {
      const baseline = '<html><body>Search Result: Found 5 items</body></html>';
      const trueResp = '<html><body>500 Internal Server Error: Division by zero</body></html>';
      const falseResp = '<html><body>Search Result: Found 5 items</body></html>';

      const evalResult = BooleanTester.evaluateDifferential(
        baseline, 200,
        trueResp, 500,
        falseResp, 200,
        "' AND (1/0)=1--", "' AND 1=1--"
      );
      expect(evalResult.isVulnerable).toBe(true);
      expect(evalResult.divergenceType).toBe('status_divergence');
      expect(evalResult.divergencePolarity).toBe('error_on_true');
      expect(evalResult.confidence).toBeGreaterThanOrEqual(95);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 5: Exhaustive 29 Context Matrix Verification
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 5: Exhaustive 29 Context Matrix Verification', () => {
    const allContexts: InjectionContext[] = [
      'numeric', 'single_quote_string', 'double_quote_string', 'parenthesized_string',
      'like_clause', 'order_by_clause', 'group_by_clause', 'having_clause',
      'where_clause', 'insert_values', 'update_set', 'subquery', 'identifier',
      'json_derived', 'xml_derived', 'merge_clause', 'date_time', 'vector_op',
      'array_derived', 'limit_offset', 'select_expr', 'join_clause', 'case_expr',
      'window_func', 'cte_clause', 'fulltext_search', 'spatial_op', 'delete_where',
      'boolean_literal'
    ];

    allContexts.forEach((ctx) => {
      it(`verifies executable test pairs exist for context: ${ctx}`, () => {
        const param: CandidateParameter = {
          id: `test_${ctx}`,
          name: `param_${ctx}`,
          location: 'query',
          originalValue: 'test_val',
          detectedContext: ctx,
          enabled: true,
        };
        const pairs = BooleanTester.getTestPairs(param);
        expect(pairs.length).toBeGreaterThan(0);
        expect(pairs[0].truePayload.length).toBeGreaterThan(0);
        expect(pairs[0].falsePayload.length).toBeGreaterThan(0);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 6: Exhaustive 18 Mechanism M01–M18 Verification
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 6: Exhaustive 18 Mechanisms (M01–M18) Verification', () => {
    const targetMechanisms = [
      'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08',
      'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16',
      'M17', 'M18'
    ];

    targetMechanisms.forEach((mId) => {
      it(`verifies catalog specification and applicability for mechanism ${mId}`, () => {
        const node = MECHANISMS[mId];
        expect(node).toBeDefined();
        expect(node.id).toBe(mId);
        expect(node.name.length).toBeGreaterThan(5);
        expect(node.description.length).toBeGreaterThan(15);
        expect(node.researchSource.length).toBeGreaterThan(5);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 7: Exhaustive 17 Parameter Types Classification
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 7: Exhaustive 17 Parameter Types Classification', () => {
    const testCases: { category: ParamTypeCategory; sample: string; paramName: string }[] = [
      { category: 'string', sample: 'standard_text', paramName: 'username' },
      { category: 'integer', sample: '42', paramName: 'page_id' },
      { category: 'decimal', sample: '99.95', paramName: 'price' },
      { category: 'boolean', sample: 'true', paramName: 'is_admin' },
      { category: 'date', sample: '2026-09-13', paramName: 'birth_date' },
      { category: 'timestamp', sample: '2026-09-13T12:00:00Z', paramName: 'updated_at' },
      { category: 'uuid', sample: '123e4567-e89b-12d3-a456-426614174000', paramName: 'order_uuid' },
      { category: 'binary', sample: '0xDEADBEEF', paramName: 'hash_bytes' },
      { category: 'array', sample: '["a", "b"]', paramName: 'item_array' },
      { category: 'json', sample: '{"k":"v"}', paramName: 'meta_json' },
      { category: 'xml', sample: '<root>data</root>', paramName: 'payload_xml' },
      { category: 'spatial', sample: 'POINT(10 20)', paramName: 'geo_spatial' },
      { category: 'vector', sample: '[1.0, 2.0, 3.0]', paramName: 'embed_vector' },
      { category: 'enum', sample: 'desc', paramName: 'sort_order' },
      { category: 'identifier', sample: 'created_at', paramName: 'sort' },
      { category: 'encoded', sample: 'VGVzdERhdGE=', paramName: 'token_encoded' },
      { category: 'null', sample: 'null', paramName: 'optional_val' },
    ];

    testCases.forEach(({ category, sample, paramName }) => {
      it(`correctly classifies parameter type: ${category}`, () => {
        const param: CandidateParameter = {
          id: `param_${category}`,
          name: paramName,
          location: 'query',
          originalValue: sample,
          enabled: true,
        };
        const res = ParameterClassifier.classify(param);
        expect(res.category).toBe(category);
        expect(res.recommendedTestFamilies.length).toBeGreaterThan(0);
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SUITE 8: Exhaustive 30 Target DBMS Matrix Verification
  // ═════════════════════════════════════════════════════════════════════════
  describe('Suite 8: Exhaustive 30 Target DBMS Matrix Verification', () => {
    const allDbms: DbmsType[] = [
      'PostgreSQL', 'MySQL', 'MariaDB', 'Microsoft SQL Server', 'Oracle',
      'SQLite', 'IBM Db2', 'H2', 'Microsoft Access', 'Snowflake',
      'Google BigQuery', 'ClickHouse', 'CockroachDB', 'Amazon Redshift',
      'DuckDB', 'Trino', 'Presto', 'Vertica', 'SAP HANA', 'Teradata',
      'Firebird', 'Databricks SQL', 'Azure Synapse', 'Apache Doris',
      'SingleStore', 'Vitess', 'TimescaleDB', 'YugabyteDB', 'AlloyDB',
      'Generic SQL'
    ];

    allDbms.forEach((dbms) => {
      it(`verifies native capabilities defined for: ${dbms}`, () => {
        const cap = DialectMatrix.get(dbms);
        expect(cap).toBeDefined();
        expect(cap.dbms).toBe(dbms);
        expect(cap.versionQuery.length).toBeGreaterThan(5);
        expect(cap.commentSingle.length).toBeGreaterThan(0);
        expect(cap.limitOffset(10, 5).length).toBeGreaterThan(0);
        const errWrap = cap.conditionalErrorWrapper('1=1');
        expect(errWrap.truePayload.length).toBeGreaterThan(0);
        expect(errWrap.falsePayload.length).toBeGreaterThan(0);
      });
    });
  });
});

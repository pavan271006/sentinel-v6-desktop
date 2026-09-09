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
import { SemanticRewriteEngine } from './engine/SemanticRewriteEngine';
import { ParserDifferentialModel } from './engine/ParserDifferentialModel';
import { SerializationEngine } from './engine/SerializationEngine';
import { ParameterDuplicationModel } from './engine/ParameterDuplicationModel';
import { InputValidationModel } from './engine/InputValidationModel';
import { ConstraintAnalysisEngine } from './engine/ConstraintAnalysisEngine';
import { ContextualBanditEngine } from './engine/ContextualBanditEngine';
import { AdaptiveRetryTree } from './engine/AdaptiveRetryTree';
import { SQLDefenseLayerModel } from './engine/SQLDefenseLayerModel';
import { CrossLayerCorrelator } from './engine/CrossLayerCorrelator';

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
      expect(nullProbes.length).toBe(9); // generic commented + generic clean + oracle DUAL
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

  describe('11. SemanticRewriteEngine — Formal AST Transformations', () => {
    it('generates De Morgan predicate rewrites preserving invariant', () => {
      const rewrites = SemanticRewriteEngine.generateRewrites("1' AND 1=1 --", 'PostgreSQL', 'where_clause');
      expect(rewrites.some((r) => r.ruleId === 'PRED_DE_MORGAN_AND')).toBe(true);
      const dm = rewrites.find((r) => r.ruleId === 'PRED_DE_MORGAN_AND')!;
      expect(dm.rewrittenPayload).toContain('NOT(1=2)');
      expect(dm.semanticInvariant).toContain('P AND Q <=> NOT(NOT P OR NOT Q)');
    });

    it('generates hex literal rewrites for MySQL string context', () => {
      const rewrites = SemanticRewriteEngine.generateRewrites("admin' OR '1'='1' --", 'MySQL', 'single_quote_string');
      expect(rewrites.some((r) => r.ruleId === 'LIT_HEX_OR_CHR_ENCODING')).toBe(true);
      const hex = rewrites.find((r) => r.ruleId === 'LIT_HEX_OR_CHR_ENCODING')!;
      expect(hex.rewrittenPayload).toContain('0x31=0x31');
    });

    it('generates whitespace-free parenthesized expression', () => {
      const rewrites = SemanticRewriteEngine.generateRewrites("' UNION SELECT 1,2 --", 'PostgreSQL', 'where_clause');
      expect(rewrites.some((r) => r.ruleId === 'DELIM_WHITESPACE_FREE_PARENS')).toBe(true);
      const delim = rewrites.find((r) => r.ruleId === 'DELIM_WHITESPACE_FREE_PARENS')!;
      expect(delim.rewrittenPayload).toContain('UNION(SELECT');
    });
  });

  describe('12. ParserDifferentialModel — Multi-Tier Encoding Impedance', () => {
    it('generates JSON Unicode code-point escapes for JSON body targets', () => {
      const candidates = ParserDifferentialModel.generateDifferentialCandidates("1' OR 1=1 --", 'body_json');
      expect(candidates.length).toBeGreaterThan(0);
      const top = candidates[0];
      expect(top.id).toBe('DIFF_JSON_UNICODE_ESCAPE');
      expect(top.transformedWirePayload).toContain('\\u0027');
      expect(top.layerTrace.some((l) => l.layer === 'DESERIALIZER')).toBe(true);
    });

    it('generates XML entity references for XML body targets', () => {
      const candidates = ParserDifferentialModel.generateDifferentialCandidates("1' OR 1=1 --", 'body_xml');
      expect(candidates.length).toBeGreaterThan(0);
      const top = candidates[0];
      expect(top.id).toBe('DIFF_XML_NUMERIC_ENTITY');
      expect(top.transformedWirePayload).toContain('&#x27;');
    });

    it('generates full XML hexadecimal entities for WAF keyword evasion in body_xml', () => {
      const candidates = ParserDifferentialModel.generateDifferentialCandidates("1 UNION SELECT NULL", 'body_xml');
      const hexCandidate = candidates.find((c) => c.id === 'DIFF_XML_FULL_HEX_ENTITY');
      expect(hexCandidate).toBeDefined();
      expect(hexCandidate!.transformedWirePayload).toContain('&#x55;&#x4e;&#x49;&#x4f;&#x4e;');
      expect(hexCandidate!.compatibility.minWafResistanceScore).toBeGreaterThanOrEqual(95);
    });

    it('detects numeric context for integers inside XML tags and generates arithmetic test pairs', () => {
      const xmlParam = {
        id: 'xml_storeId',
        name: 'storeId',
        location: 'body_xml' as const,
        originalValue: '1',
        xmlPath: 'storeId',
        enabled: true,
      };
      const context = ContextDetector.detectContext(xmlParam, '<stockCheck><storeId>1</storeId></stockCheck>');
      expect(context).toBe('numeric');

      const pairs = BooleanTester.getTestPairs({ ...xmlParam, detectedContext: context });
      expect(pairs.some((p) => p.truePayload === '+0' && p.falsePayload === '+1')).toBe(true);
      expect(pairs.some((p) => p.truePayload === ' AND 1337=1337')).toBe(true);
    });
  });

  describe('13. SerializationEngine — Logical vs Wire Representation', () => {
    it('tracks logical and wire representations distinctly for JSON', () => {
      const param = { id: 'p_json', name: 'user', location: 'body_json' as const, originalValue: 'alice', enabled: true };
      const res = SerializationEngine.serializeForSurface("admin' OR 1=1 --", param, { useUnicodeEscape: true });
      expect(res.logicalTestPayload).toBe("admin' OR 1=1 --");
      expect(res.wireRepresentation).toContain('\\u0027');
      expect(res.encodingApplied).toBe('json_unicode_escape');
    });
  });

  describe('14. ParameterDuplicationModel — Framework Binding Inference', () => {
    it('creates unique marker differential probes', () => {
      const probe = ParameterDuplicationModel.createResolutionProbe('user_id');
      expect(probe.combinedQuery).toContain('user_id=sentinelA_');
      expect(probe.combinedQuery).toContain('&user_id=sentinelB_');
    });

    it('infers LAST hypothesis when only markerB reflects', () => {
      const probe = ParameterDuplicationModel.createResolutionProbe('user_id');
      const inf = ParameterDuplicationModel.inferResolution(probe, 200, `Welcome ${probe.markerB}!`);
      expect(inf.hypothesis).toBe('LAST');
      expect(inf.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('infers CONCATENATED hypothesis when comma-separated values reflect', () => {
      const probe = ParameterDuplicationModel.createResolutionProbe('user_id');
      const inf = ParameterDuplicationModel.inferResolution(probe, 200, `Results for ${probe.markerA},${probe.markerB}`);
      expect(inf.hypothesis).toBe('CONCATENATED');
    });
  });

  describe('15. InputValidationModel — Layered Boundary Classification', () => {
    it('classifies 403 Forbidden with Cloudflare banner as WAF_PERIMETER_BLOCKED', () => {
      const cl = InputValidationModel.classifyBoundary(403, { server: 'cloudflare' }, 'Error 1020: Access Denied WAF');
      expect(cl.boundary).toBe('WAF_PERIMETER_BLOCKED');
      expect(cl.isSqlSinkReachable).toBe(false);
      expect(cl.recommendedAdaptation).toBe('semantic_rewrite');
    });

    it('classifies database error as DATABASE_SYNTAX_ERROR', () => {
      const cl = InputValidationModel.classifyBoundary(500, {}, 'You have an error in your SQL syntax near mysql');
      expect(cl.boundary).toBe('DATABASE_SYNTAX_ERROR');
      expect(cl.isSqlSinkReachable).toBe(true);
    });

    it('classifies 422 validation error as SCHEMA_REJECTED', () => {
      const cl = InputValidationModel.classifyBoundary(422, {}, '{"detail":[{"msg":"value is not a valid integer"}]}');
      expect(cl.boundary).toBe('SCHEMA_REJECTED');
      expect(cl.isSqlSinkReachable).toBe(false);
      expect(cl.recommendedAdaptation).toBe('constraint_adjustment');
    });
  });

  describe('16. ConstraintAnalysisEngine — Schema & Range Satisfiability', () => {
    it('infers integer constraints from numeric original values', () => {
      const param = { id: 'p_num', name: 'page', location: 'query' as const, originalValue: '42', enabled: true };
      const constraints = ConstraintAnalysisEngine.inferConstraints(param);
      expect(constraints.expectedType).toBe('integer');
    });

    it('satisfies numeric constraint with arithmetic expression', () => {
      const param = { id: 'p_num', name: 'page', location: 'query' as const, originalValue: '42', enabled: true };
      const constraints = ConstraintAnalysisEngine.inferConstraints(param);
      const synth = ConstraintAnalysisEngine.evaluateAndSynthesize('42+1', constraints);
      expect(synth.viability).toBe('CONSTRAINT_SATISFIABLE');
      expect(synth.synthesizedPayload).toBe('42+1');
    });

    it('rejects alphanumeric SQL strings on strict integer constraints', () => {
      const param = { id: 'p_num', name: 'page', location: 'query' as const, originalValue: '42', enabled: true };
      const constraints = ConstraintAnalysisEngine.inferConstraints(param);
      const synth = ConstraintAnalysisEngine.evaluateAndSynthesize("42 OR 1=1", constraints);
      expect(synth.viability).toBe('CONSTRAINT_CONFLICT');
    });
  });

  describe('17. ContextualBanditEngine & AdaptiveRetryTree — Utility Feedback', () => {
    it('calculates utility reward based on investigation signals', () => {
      const rewDb = ContextualBanditEngine.calculateUtilityReward({
        wasAccepted: true,
        isWafBlocked: false,
        hasSchemaError: false,
        hasDbmsError: true,
        hasTimingDelta: false,
        hasStructuralDivergence: true,
        entropyReduced: 0.5,
      });
      expect(rewDb).toBeGreaterThan(0.7);

      const rewWaf = ContextualBanditEngine.calculateUtilityReward({
        wasAccepted: false,
        isWafBlocked: true,
        hasSchemaError: false,
        hasDbmsError: false,
        hasTimingDelta: false,
        hasStructuralDivergence: false,
        entropyReduced: 0.0,
      });
      expect(rewWaf).toBeLessThan(0.3);
    });

    it('branches to parser differential on WAF blocked JSON payload', () => {
      const param = { id: 'p_json', name: 'data', location: 'body_json' as const, originalValue: 'test', enabled: true };
      const branch = AdaptiveRetryTree.evaluateAndBranch(
        "admin' OR 1=1 --",
        param,
        'PostgreSQL',
        'single_quote_string',
        403,
        { server: 'cloudflare' },
        'Access Denied by WAF'
      );
      expect(branch.action).toBe('ADAPT_PARSER_DIFFERENTIAL');
      expect(branch.wirePayload).toContain('\\u0027');
    });
  });

  describe('18. SQLDefenseLayerModel Core Invariants & State Tracking', () => {
    it('initializes all 8 layers as UNKNOWN and never assumes SAFE', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const allLayers = model.getAllLayers();
      expect(allLayers.length).toBe(8);

      for (const layer of allLayers) {
        expect(layer.status).toBe('UNKNOWN');
        expect(layer.observed).toBe(false);
        // CRITICAL INVARIANT: UNKNOWN must never be considered SAFE
        expect(layer.status).not.toBe('CONFIRMED');
        expect(layer.status).not.toBe('REJECTED');
      }
    });

    it('propagates unreachability and records coverage debt when upstream layer blocks', () => {
      const model = SQLDefenseLayerModel.createDefault();
      model.markBlocked('L1_EDGE_WAF', 'WAF Perimeter Block Page', 'HTTP 403');

      expect(model.getLayer('L1_EDGE_WAF').blocked).toBe(true);
      expect(model.getLayer('L1_EDGE_WAF').status).toBe('BLOCKED');

      // Downstream layers must be marked UNREACHABLE
      expect(model.getLayer('L2_INGRESS_SCHEMA').reachable).toBe(false);
      expect(model.getLayer('L2_INGRESS_SCHEMA').status).toBe('UNREACHABLE');
      expect(model.getLayer('L7_DB_KERNEL').reachable).toBe(false);
      expect(model.getLayer('L7_DB_KERNEL').status).toBe('UNREACHABLE');

      // Invariant: Scanner records coverage debt when probes are blocked upstream
      expect(model.hasCoverageDebt()).toBe(true);
    });
  });

  describe('19. L1 Edge/WAF Observability vs Application Rejection', () => {
    it('classifies explicit perimeter headers as OBSERVED BLOCKED at L1', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '1', enabled: true };

      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        "' OR 1=1 --",
        403,
        { server: 'cloudflare', 'cf-ray': '8a12bc90' },
        'Access Denied. Your request was blocked by Cloudflare WAF.',
        120,
        model
      );

      expect(result.primaryRejectionLayer).toBe('L1_EDGE_WAF');
      expect(result.rejectionClassification).toBe('BLOCKED_BEFORE_APPLICATION_OBSERVABLE');
      const l1 = model.getLayer('L1_EDGE_WAF');
      expect(l1.status).toBe('BLOCKED');
      expect(l1.certainty).toBe('OBSERVED');
      expect(l1.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('classifies generic 403 without vendor headers as INFERRED possible perimeter rejection', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '1', enabled: true };

      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        "' OR 1=1 --",
        403,
        {},
        'Forbidden',
        80,
        model
      );

      expect(result.primaryRejectionLayer).toBe('L1_EDGE_WAF');
      expect(result.rejectionClassification).toBe('BLOCKED_BEFORE_APPLICATION_OBSERVABLE');
      const l1 = model.getLayer('L1_EDGE_WAF');
      // Invariant: Do not declare confirmed WAF without vendor evidence
      expect(l1.status).toBe('INCONCLUSIVE');
      expect(l1.certainty).toBe('INFERRED');
    });
  });

  describe('20. L2 API/Schema & Serialization Boundary', () => {
    it('classifies HTTP 422 schema validation error as L2 BLOCKED and records pipeline trace', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'age', location: 'query' as const, originalValue: '25', enabled: true };

      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        "25' OR '1'='1",
        422,
        { 'content-type': 'application/json' },
        '{"detail":[{"loc":["query","age"],"msg":"expected integer, received string","type":"type_error.integer"}]}',
        45,
        model
      );

      expect(result.primaryRejectionLayer).toBe('L2_INGRESS_SCHEMA');
      expect(result.rejectionClassification).toBe('SCHEMA_REJECTED');
      expect(model.getLayer('L2_INGRESS_SCHEMA').status).toBe('BLOCKED');
      expect(result.pipelineTrace.wireRepresentation).toBe("25' OR '1'='1");
      expect(result.pipelineTrace.observedOutcome).toBe('REJECTED');
    });
  });

  describe('21. L4 Runtime / RASP Interception vs Unknown State', () => {
    it('detects explicit RASP AST mutation abort and records L4_RUNTIME_RASP BLOCKED', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'q', location: 'query' as const, originalValue: 'search', enabled: true };

      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        "search' UNION SELECT 1,2--",
        500,
        {},
        'SecurityException: ContrastSecurity RASP query interception policy violation: AST mutation detected',
        90,
        model
      );

      expect(result.primaryRejectionLayer).toBe('L4_RUNTIME_RASP');
      expect(result.rejectionClassification).toBe('RASP_BLOCKED');
      const l4 = model.getLayer('L4_RUNTIME_RASP');
      expect(l4.status).toBe('BLOCKED');
      expect(l4.certainty).toBe('OBSERVED');
    });

    it('leaves L4 as UNKNOWN when no runtime instrumentation signals are observed', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'q', location: 'query' as const, originalValue: 'search', enabled: true };

      CrossLayerCorrelator.evaluateProbe(
        param,
        "search' OR 1=1--",
        200,
        {},
        'Search results for query',
        50,
        model
      );

      // Invariant: Never assume RASP is absent or safe without evidence
      expect(model.getLayer('L4_RUNTIME_RASP').status).toBe('UNKNOWN');
      expect(model.getLayer('L4_RUNTIME_RASP').certainty).toBe('UNKNOWN');
    });
  });

  describe('22. L5 Driver & L6 DB Proxy Rejection Modeling', () => {
    it('classifies driver multi-statement limitation as L5 DRIVER_REJECTED', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '1', enabled: true };

      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        '1; WAITFOR DELAY 0:0:5',
        500,
        {},
        'Driver Error: Multi-statement execution not enabled for this connection',
        40,
        model
      );

      expect(result.primaryRejectionLayer).toBe('L5_DRIVER_PROTOCOL');
      expect(result.rejectionClassification).toBe('DRIVER_REJECTED');
      expect(model.getLayer('L5_DRIVER_PROTOCOL').status).toBe('BLOCKED');
    });

    it('classifies DB proxy query hash rejection as L6 DB_PROXY_REJECTED', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '1', enabled: true };

      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        "1' OR 1=1 --",
        500,
        {},
        'MaxScale SQL Firewall: Query hash not permitted by active allowlist policy',
        30,
        model
      );

      expect(result.primaryRejectionLayer).toBe('L6_DB_FIREWALL');
      expect(result.rejectionClassification).toBe('DB_PROXY_REJECTED');
      expect(model.getLayer('L6_DB_FIREWALL').status).toBe('BLOCKED');
    });
  });

  describe('23. L7 Database Kernel & SQLi Existence vs Impact Separation (RLS Case)', () => {
    it('proves SQLi exists while correctly reporting impact constrained by RLS & Least Privilege', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'id', location: 'query' as const, originalValue: '101', enabled: true };

      // Injected probe triggers SQL syntax error proving AST structure control,
      // but response contains permission denied on elevated objects
      const result = CrossLayerCorrelator.evaluateProbe(
        param,
        "101' OR 1=1; EXEC xp_cmdshell('whoami')--",
        500,
        {},
        'SQL Server Syntax Error: unclosed quotation mark. Permission denied: User lacks privilege for procedure xp_cmdshell.',
        150,
        model,
        'Microsoft SQL Server'
      );

      // Core Invariant: SQLi existence != full system compromise
      expect(result.impact.sqliDetected).toBe(true);
      expect(result.impact.sqlStructureControl).toBe(true);
      expect(result.impact.crossTenantAccess).toBe(false);
      expect(result.impact.privilegeCapability).toBe(false);
      expect(result.impact.impactConstraints).toContain('LEAST_PRIVILEGE_RESTRICTED');

      // Both L3 (raw dynamic SQL) and L7 (DB Kernel execution) are confirmed
      expect(model.getLayer('L3_APP_ORM').status).toBe('CONFIRMED');
      expect(model.getLayer('L7_DB_KERNEL').status).toBe('CONFIRMED');
    });
  });

  describe('24. L8 SSDLC / SAST Source Context Correlation', () => {
    it('correlates static code analysis taint flow when source context is provided', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'user', location: 'query' as const, originalValue: 'alice', enabled: true };

      CrossLayerCorrelator.evaluateProbe(
        param,
        "alice'--",
        200,
        {},
        'Welcome alice',
        60,
        model,
        'PostgreSQL',
        {
          sourceFile: 'controllers/UserController.ts',
          sourceLine: 42,
          taintSource: 'req.query.user',
          sinkFunction: 'db.raw(query)',
          isSanitized: false,
        }
      );

      const l8 = model.getLayer('L8_SSDLC_SAST');
      expect(l8.status).toBe('CONFIRMED');
      expect(l8.certainty).toBe('OBSERVED');
      expect(l8.evidence[0]).toContain('controllers/UserController.ts:42');
    });

    it('defaults L8 to UNKNOWN when source context is unavailable', () => {
      const model = SQLDefenseLayerModel.createDefault();
      const param = { id: 'p1', name: 'user', location: 'query' as const, originalValue: 'alice', enabled: true };

      CrossLayerCorrelator.evaluateProbe(
        param,
        "alice'--",
        200,
        {},
        'Welcome alice',
        60,
        model
      );

      const l8 = model.getLayer('L8_SSDLC_SAST');
      expect(l8.status).toBe('UNKNOWN');
      expect(l8.certainty).toBe('UNKNOWN');
    });
  });

  describe('25. Adaptive Replanning Across Defense Layers', () => {
    it('adapts differently based on whether rejection is WAF, Schema, or RASP', () => {
      const param = { id: 'p1', name: 'num', location: 'query' as const, originalValue: '10', enabled: true };

      // Case A: L1 WAF Rejection -> Branches to Semantic Rewrite / Differentials
      const decWaf = AdaptiveRetryTree.evaluateAndBranch(
        "10' OR 1=1--",
        param,
        'PostgreSQL',
        'single_quote_string',
        403,
        { server: 'cloudflare' },
        'Access Denied by WAF'
      );
      expect(decWaf.action).toBe('ADAPT_PARSER_DIFFERENTIAL');

      // Case B: L2 Schema Rejection -> Branches to Constraint Synthesis (numeric arithmetic)
      const decSchema = AdaptiveRetryTree.evaluateAndBranch(
        "10' OR 1=1--",
        param,
        'PostgreSQL',
        'numeric',
        422,
        {},
        '{"detail":"validation error: expected integer"}'
      );
      expect(decSchema.action).toBe('ADAPT_CONSTRAINT_SYNTHESIS');
      expect(decSchema.wirePayload).toBe('100-50');

      // Case C: L4 RASP Rejection -> Branches to Whitespace-Free / Non-Standard Dual
      const decRasp = AdaptiveRetryTree.evaluateAndBranch(
        "10' OR 1=1--",
        param,
        'PostgreSQL',
        'single_quote_string',
        500,
        {},
        'SecurityException: ContrastSecurity RASP AST mutation detected'
      );
      expect(decRasp.action).toBe('ADAPT_SEMANTIC_REWRITE');
    });
  });
});

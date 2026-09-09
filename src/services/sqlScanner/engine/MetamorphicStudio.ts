import { WAF_BYPASS_TRANSFORMS, WafBypassTransform } from '../payloads/BypassPayloads';

export interface SqlToken {
  type: 'keyword' | 'identifier' | 'literal' | 'operator' | 'comment' | 'whitespace' | 'unknown';
  value: string;
}

export interface WafSimulationResult {
  targetWaf: string;
  wafDisplayName: string;
  blocked: boolean;
  score: number; // 0 (Clean/Pass) to 100 (Hard Block)
  evasionProbability: number; // 0 to 100%
  matchedRules: string[];
  verdict: 'BLOCKED' | 'EVADED' | 'SUSPICIOUS_PASS';
  analysis: string;
}

export interface WafDetectionFromRequestResult {
  detectedWaf: 'cloudflare' | 'aws' | 'modsecurity' | 'imperva' | 'akamai' | 'generic';
  wafDisplayName: string;
  confidence: number; // 0 to 100
  reasons: string[];
  inferredContentType: 'json' | 'xml' | 'urlencoded' | 'multipart' | 'raw';
  recommendedTransforms: string[];
  transformRationale: Record<string, string>;
  detectedIndicators: {
    cookies: string[];
    headers: string[];
    domains: string[];
  };
}

export class MetamorphicStudio {
  /**
   * Automatically inspects HTTP wire request (headers, cookies, hostname, body context)
   * to detect active perimeter WAF and recommend the optimal metamorphic transform stack.
   */
  public static detectWafFromRequest(rawRequest: string, targetUrl?: string): WafDetectionFromRequestResult {
    const raw = rawRequest || '';
    const lines = raw.split(/\r?\n/);
    const headerLines: string[] = [];
    let body = '';
    let isBody = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!isBody) {
        if (line.trim() === '') {
          isBody = true;
        } else {
          headerLines.push(line);
        }
      } else {
        body += (body ? '\n' : '') + line;
      }
    }

    const headers: Record<string, string> = {};
    const cookieNames: string[] = [];
    let host = '';
    let contentType = '';

    for (const h of headerLines) {
      const colonIdx = h.indexOf(':');
      if (colonIdx > 0) {
        const name = h.substring(0, colonIdx).trim().toLowerCase();
        const value = h.substring(colonIdx + 1).trim();
        headers[name] = value;

        if (name === 'host') {
          host = value;
        } else if (name === 'content-type') {
          contentType = value.toLowerCase();
        } else if (name === 'cookie') {
          const cookiePairs = value.split(';');
          for (const pair of cookiePairs) {
            const eqIdx = pair.indexOf('=');
            const cName = (eqIdx > 0 ? pair.substring(0, eqIdx) : pair).trim();
            if (cName) cookieNames.push(cName);
          }
        }
      }
    }

    // Inferred Content Type
    let inferredContentType: 'json' | 'xml' | 'urlencoded' | 'multipart' | 'raw' = 'raw';
    const trimmedBody = body.trim();
    if (contentType.includes('application/json') || (trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) || (trimmedBody.startsWith('[') && trimmedBody.endsWith(']'))) {
      inferredContentType = 'json';
    } else if (contentType.includes('xml') || (trimmedBody.startsWith('<') && trimmedBody.endsWith('>'))) {
      inferredContentType = 'xml';
    } else if (contentType.includes('multipart/form-data')) {
      inferredContentType = 'multipart';
    } else if (contentType.includes('application/x-www-form-urlencoded') || (trimmedBody.includes('&') && trimmedBody.includes('='))) {
      inferredContentType = 'urlencoded';
    }

    // WAF Candidate scoring
    const matchedIndicators: {
      waf: 'cloudflare' | 'aws' | 'modsecurity' | 'imperva' | 'akamai';
      score: number;
      reasons: string[];
      cookies: string[];
      headers: string[];
      domains: string[];
    }[] = [
      { waf: 'cloudflare', score: 0, reasons: [], cookies: [], headers: [], domains: [] },
      { waf: 'aws', score: 0, reasons: [], cookies: [], headers: [], domains: [] },
      { waf: 'modsecurity', score: 0, reasons: [], cookies: [], headers: [], domains: [] },
      { waf: 'imperva', score: 0, reasons: [], cookies: [], headers: [], domains: [] },
      { waf: 'akamai', score: 0, reasons: [], cookies: [], headers: [], domains: [] },
    ];

    const targetDomain = (targetUrl || host || '').toLowerCase();

    // 1. Cloudflare Check
    const cf = matchedIndicators.find((w) => w.waf === 'cloudflare')!;
    for (const c of cookieNames) {
      if (/^(__cf_bm|cf_clearance|__cfduid|cf_chl_)/i.test(c)) {
        cf.score += 50;
        cf.cookies.push(c);
        cf.reasons.push(`Identified Cloudflare security cookie: ${c}`);
      }
    }
    for (const [hName, hVal] of Object.entries(headers)) {
      if (/^cf-(ray|cache-status|connecting-ip|visitor|ipcountry|worker)/i.test(hName)) {
        cf.score += 45;
        cf.headers.push(hName);
        cf.reasons.push(`Detected Cloudflare perimeter routing header: ${hName}`);
      }
      if (hName === 'server' && /cloudflare/i.test(hVal)) {
        cf.score += 40;
        cf.headers.push(`server: ${hVal}`);
        cf.reasons.push(`Server header advertises Cloudflare edge`);
      }
    }
    if (/(cloudflare\.com|workers\.dev|cloudflarepages\.com)/i.test(targetDomain)) {
      cf.score += 40;
      cf.domains.push(targetDomain);
      cf.reasons.push(`Target endpoint is hosted on Cloudflare edge network`);
    }

    // 2. AWS WAF Check
    const aws = matchedIndicators.find((w) => w.waf === 'aws')!;
    for (const c of cookieNames) {
      if (/^(AWSALB|AWSALBCORS|x-amzn-waf-action|aws-waf-token)/i.test(c)) {
        aws.score += 50;
        aws.cookies.push(c);
        aws.reasons.push(`Identified AWS Application Load Balancer / WAF cookie: ${c}`);
      }
    }
    for (const [hName, hVal] of Object.entries(headers)) {
      if (/^x-amz(n)?-(requestid|cf-id|id-2|trace-id|security-token)/i.test(hName)) {
        aws.score += 45;
        aws.headers.push(hName);
        aws.reasons.push(`Detected Amazon CloudFront / AWS WAF tracking header: ${hName}`);
      }
      if ((hName === 'server' && /cloudfront|awselb/i.test(hVal)) || (hName === 'via' && /cloudfront\.net/i.test(hVal))) {
        aws.score += 40;
        aws.headers.push(`${hName}: ${hVal}`);
        aws.reasons.push(`Edge routing proxy header indicates AWS CloudFront / ALB`);
      }
    }
    if (/(amazonaws\.com|cloudfront\.net|elasticbeanstalk\.com|elb\.amazonaws\.com)/i.test(targetDomain)) {
      aws.score += 40;
      aws.domains.push(targetDomain);
      aws.reasons.push(`Target domain resolves to AWS infrastructure`);
    }

    // 3. ModSecurity Check
    const modsec = matchedIndicators.find((w) => w.waf === 'modsecurity')!;
    for (const c of cookieNames) {
      if (/^(mod_security|crs-session|OWASP_CRS|CRS_)/i.test(c)) {
        modsec.score += 50;
        modsec.cookies.push(c);
        modsec.reasons.push(`Identified OWASP ModSecurity session tracking token: ${c}`);
      }
    }
    for (const [hName, hVal] of Object.entries(headers)) {
      if (/x-mod-security/i.test(hName) || (hName === 'server' && /mod_security/i.test(hVal)) || (hName === 'x-powered-by' && /mod_security/i.test(hVal)) || hVal.includes('NOYB')) {
        modsec.score += 45;
        modsec.headers.push(hName);
        modsec.reasons.push(`Header signature matched OWASP CRS ModSecurity engine`);
      }
    }
    if (/(modsec|owasp-crs)/i.test(targetDomain)) {
      modsec.score += 35;
      modsec.domains.push(targetDomain);
      modsec.reasons.push(`Host identifier matches ModSecurity target profile`);
    }

    // 4. Imperva Check
    const imp = matchedIndicators.find((w) => w.waf === 'imperva')!;
    for (const c of cookieNames) {
      if (/^(incap_ses|visid_incap|_imp_apg|nlbi_|___utmvc)/i.test(c)) {
        imp.score += 50;
        imp.cookies.push(c);
        imp.reasons.push(`Identified Imperva Incapsula session tracking token: ${c}`);
      }
    }
    for (const [hName, hVal] of Object.entries(headers)) {
      if (/^(x-iinfo|x-imperva-id)/i.test(hName) || (hName === 'x-cdn' && /incapsula/i.test(hVal)) || (hName === 'server' && /imperva/i.test(hVal))) {
        imp.score += 45;
        imp.headers.push(hName);
        imp.reasons.push(`Imperva SecureSphere / Incapsula inspection header: ${hName}`);
      }
    }
    if (/(incapdns\.net|impervadns\.net)/i.test(targetDomain)) {
      imp.score += 40;
      imp.domains.push(targetDomain);
      imp.reasons.push(`Domain routing through Imperva Incapsula proxy`);
    }

    // 5. Akamai Check
    const akamai = matchedIndicators.find((w) => w.waf === 'akamai')!;
    for (const c of cookieNames) {
      if (/^(ak_bmsc|bm_sz|bm_sv|_abck|akacd_|bm_mi)/i.test(c)) {
        akamai.score += 50;
        akamai.cookies.push(c);
        akamai.reasons.push(`Identified Akamai Bot Manager / Kona cookie: ${c}`);
      }
    }
    for (const [hName, hVal] of Object.entries(headers)) {
      if (/^(x-akamai-transformed|akamai-origin-hop|x-akamai-session-info)/i.test(hName) || (hName === 'server' && /akamaighost/i.test(hVal))) {
        akamai.score += 45;
        akamai.headers.push(hName);
        akamai.reasons.push(`Akamai Kona Site Defender proxy header: ${hName}`);
      }
    }
    if (/(akamaiedge\.net|akamai\.net|edgesuite\.net)/i.test(targetDomain)) {
      akamai.score += 40;
      akamai.domains.push(targetDomain);
      akamai.reasons.push(`Target domain routes via Akamai Edge network`);
    }

    // Sort by highest score
    matchedIndicators.sort((a, b) => b.score - a.score);
    const best = matchedIndicators[0];

    const wafDisplayMap: Record<string, string> = {
      cloudflare: 'Cloudflare Managed OWASP CRS',
      aws: 'AWS WAF (SQLi Rule Set)',
      modsecurity: 'ModSecurity OWASP CRS v3.3',
      imperva: 'Imperva SecureSphere',
      akamai: 'Akamai Kona Site Defender',
      generic: 'Generic Perimeter Filter',
    };

    let detectedWaf: 'cloudflare' | 'aws' | 'modsecurity' | 'imperva' | 'akamai' | 'generic' = 'generic';
    let confidence = 50;
    let reasons: string[] = [];
    const detectedIndicators = {
      cookies: [] as string[],
      headers: [] as string[],
      domains: [] as string[],
    };

    if (best && best.score > 0) {
      detectedWaf = best.waf;
      confidence = Math.min(99, Math.max(65, best.score));
      reasons = best.reasons;
      detectedIndicators.cookies = best.cookies;
      detectedIndicators.headers = best.headers;
      detectedIndicators.domains = best.domains;
    } else {
      reasons.push('No perimeter WAF headers, cookies, or CDN domain patterns identified in HTTP request. Applied generic bypass strategy.');
    }

    const { transforms, rationale } = MetamorphicStudio.getOptimalTransformsForWafAndContext(detectedWaf, inferredContentType);

    return {
      detectedWaf,
      wafDisplayName: wafDisplayMap[detectedWaf] || 'Generic Perimeter Filter',
      confidence,
      reasons,
      inferredContentType,
      recommendedTransforms: transforms,
      transformRationale: rationale,
      detectedIndicators,
    };
  }

  /**
   * Internal helper resolving optimal transforms based on target WAF and content type
   */
  private static getOptimalTransformsForWafAndContext(
    waf: 'cloudflare' | 'aws' | 'modsecurity' | 'imperva' | 'akamai' | 'generic',
    contentType: 'json' | 'xml' | 'urlencoded' | 'multipart' | 'raw'
  ): { transforms: string[]; rationale: Record<string, string> } {
    const transforms: string[] = [];
    const rationale: Record<string, string> = {};

    switch (waf) {
      case 'cloudflare':
        transforms.push('E1_INLINE_COMMENT_SPACE', 'E7_RANDOM_CASE_MUTATION', 'E16_BETWEEN_OP_EQUIVALENCE', 'E18_ARITHMETIC_TAUTOLOGY');
        rationale['E1_INLINE_COMMENT_SPACE'] = 'Breaks Cloudflare OWASP Core Ruleset keyword pair regex matching (e.g. UNION SELECT).';
        rationale['E7_RANDOM_CASE_MUTATION'] = 'Bypasses deterministic case-folding pattern matching engines.';
        rationale['E16_BETWEEN_OP_EQUIVALENCE'] = 'Substitutes = comparisons with bounded range expressions to evade equality signatures.';
        rationale['E18_ARITHMETIC_TAUTOLOGY'] = 'Obfuscates standard tautology patterns (e.g., OR 1=1) into arithmetic identities.';
        break;

      case 'aws':
        transforms.push('E1_INLINE_COMMENT_SPACE', 'E9_HEX_LITERAL_ENCODING', 'E18_ARITHMETIC_TAUTOLOGY', 'E19_NULLIF_GREATEST_MUTATION');
        rationale['E1_INLINE_COMMENT_SPACE'] = 'Inline comment insertion prevents AWS WAF token concatenation grouping.';
        rationale['E9_HEX_LITERAL_ENCODING'] = 'Replaces string literals with hex representations to bypass AWS SQLi literal filters.';
        rationale['E18_ARITHMETIC_TAUTOLOGY'] = 'Replaces static 1=1 boolean expressions with dynamic arithmetic evaluations.';
        rationale['E19_NULLIF_GREATEST_MUTATION'] = 'Uses GREATEST/LEAST evaluation expressions to bypass algebraic expression parsers.';
        break;

      case 'modsecurity':
        transforms.push('E2_VERSION_COMMENT_MYSQL', 'E3_TAB_NEWLINE_WHITESPACE', 'E5_PARENTHESIS_SPACELESS');
        rationale['E2_VERSION_COMMENT_MYSQL'] = 'Exploits MySQL conditional execution comments (/*!50000...*/) misclassified as harmless comments by CRS.';
        rationale['E3_TAB_NEWLINE_WHITESPACE'] = 'Injects URL tab (%09) and newline (%0A) control characters to defeat CRS space token boundary rules.';
        rationale['E5_PARENTHESIS_SPACELESS'] = 'Encloses identifiers and clauses in parentheses to remove whitespace completely.';
        break;

      case 'imperva':
        transforms.push('E1_INLINE_COMMENT_SPACE', 'E4_VERTICAL_TAB_FORMFEED', 'E10_UNICODE_FULLWIDTH', 'E20_CONCAT_CHAR_STRING');
        rationale['E1_INLINE_COMMENT_SPACE'] = 'Breaks contiguous SQL token inspection.';
        rationale['E4_VERTICAL_TAB_FORMFEED'] = 'Substitutes spaces with vertical tab (%0b) and form feed (%0c) control bytes.';
        rationale['E10_UNICODE_FULLWIDTH'] = 'Uses fullwidth Unicode characters that bypass UTF-8 inspection before IIS/Java normalization.';
        rationale['E20_CONCAT_CHAR_STRING'] = 'Constructs strings via CHAR() concatenation to bypass quote-based signatures.';
        break;

      case 'akamai':
        transforms.push('E1_INLINE_COMMENT_SPACE', 'E17_LIKE_OP_EQUIVALENCE', 'E19_NULLIF_GREATEST_MUTATION');
        rationale['E1_INLINE_COMMENT_SPACE'] = 'Splits query keywords using inline comments.';
        rationale['E17_LIKE_OP_EQUIVALENCE'] = 'Substitutes = operator with LIKE operator comparisons.';
        rationale['E19_NULLIF_GREATEST_MUTATION'] = 'Generates true/false boolean assertions using mathematical functions.';
        break;

      case 'generic':
      default:
        if (contentType === 'json') {
          transforms.push('E1_INLINE_COMMENT_SPACE', 'E7_RANDOM_CASE_MUTATION', 'E18_ARITHMETIC_TAUTOLOGY');
          rationale['E1_INLINE_COMMENT_SPACE'] = 'Safe within JSON strings and splits SQL keywords without invalidating JSON syntax.';
          rationale['E7_RANDOM_CASE_MUTATION'] = 'Randomizes SQL keyword capitalization.';
          rationale['E18_ARITHMETIC_TAUTOLOGY'] = 'Replaces detectable 1=1 tautologies with algebraic equivalents.';
        } else if (contentType === 'xml') {
          transforms.push('E1_INLINE_COMMENT_SPACE', 'E10_UNICODE_FULLWIDTH', 'E16_BETWEEN_OP_EQUIVALENCE');
          rationale['E1_INLINE_COMMENT_SPACE'] = 'Splits keywords safely within XML nodes.';
          rationale['E10_UNICODE_FULLWIDTH'] = 'Unicode fullwidth normalization for XML parsers.';
          rationale['E16_BETWEEN_OP_EQUIVALENCE'] = 'Evades XML entity/equality matching.';
        } else {
          transforms.push('E1_INLINE_COMMENT_SPACE', 'E7_RANDOM_CASE_MUTATION', 'E8_URL_DOUBLE_ENCODING', 'E18_ARITHMETIC_TAUTOLOGY');
          rationale['E1_INLINE_COMMENT_SPACE'] = 'Splits keyword tokens using comment delimiters.';
          rationale['E7_RANDOM_CASE_MUTATION'] = 'Randomizes case to bypass case-sensitive filters.';
          rationale['E8_URL_DOUBLE_ENCODING'] = 'Double encodes URL delimiters (%2527) to bypass single-pass URL decoders.';
          rationale['E18_ARITHMETIC_TAUTOLOGY'] = 'Replaces boolean tautologies with algebraic evaluations.';
        }
        break;
    }

    return { transforms, rationale };
  }

  /**
   * Returns optimal transform configuration for a given raw request and optional explicit WAF selection
   */
  public static getOptimalTransformsForRequest(
    rawRequest: string,
    targetUrl?: string,
    targetWaf?: string
  ): { transforms: string[]; rationale: Record<string, string>; detectedWaf: string } {
    const inspection = MetamorphicStudio.detectWafFromRequest(rawRequest, targetUrl);
    const chosenWaf = (targetWaf as any) || inspection.detectedWaf;
    const { transforms, rationale } = MetamorphicStudio.getOptimalTransformsForWafAndContext(
      chosenWaf,
      inspection.inferredContentType
    );
    return {
      transforms,
      rationale,
      detectedWaf: chosenWaf,
    };
  }

  /**
   * Tokenizes SQL string into structured semantic tokens for visual AST inspection
   */
  public static tokenize(sql: string): SqlToken[] {
    const tokens: SqlToken[] = [];
    const regex = /(\/\*[\s\S]*?\*\/|--[^\r\n]*|#[^\r\n]*)|('(?:''|[^'])*'|"(?:""|[^"])*"|\b\d+(?:\.\d+)?\b)|(\b(?:SELECT|UNION|ALL|DISTINCT|FROM|WHERE|AND|OR|NOT|IN|LIKE|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|DROP|TABLE|DATABASE|EXEC|EXECUTE|DECLARE|CAST|CONVERT|WAITFOR|DELAY|SLEEP|BENCHMARK|PG_SLEEP|LOAD_FILE|INTO_OUTFILE|UTL_HTTP|UTL_INADDR)\b)|(>=|<=|!=|<>|:=|=|<|>|\+|-|\*|\/|%|\|\||&&|\||&|\^|\(|\)|,|;)|(\s+)|([a-zA-Z_][a-zA-Z0-9_]*)|(.)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(sql)) !== null) {
      if (match[1]) {
        tokens.push({ type: 'comment', value: match[1] });
      } else if (match[2]) {
        tokens.push({ type: 'literal', value: match[2] });
      } else if (match[3]) {
        tokens.push({ type: 'keyword', value: match[3] });
      } else if (match[4]) {
        tokens.push({ type: 'operator', value: match[4] });
      } else if (match[5]) {
        tokens.push({ type: 'whitespace', value: match[5] });
      } else if (match[6]) {
        tokens.push({ type: 'identifier', value: match[6] });
      } else if (match[7]) {
        tokens.push({ type: 'unknown', value: match[7] });
      }
    }
    return tokens;
  }

  /**
   * Applies a single bypass transformation
   */
  public static applyTransform(payload: string, transformId: string): string {
    const t = WAF_BYPASS_TRANSFORMS.find((item) => item.id === transformId);
    return t ? t.transform(payload) : payload;
  }

  /**
   * Applies an ordered array of bypass transformations
   */
  public static applyTransformPipeline(payload: string, transformIds: string[]): string {
    let result = payload;
    for (const id of transformIds) {
      result = MetamorphicStudio.applyTransform(result, id);
    }
    return result;
  }

  /**
   * Simulates inspection behavior across standard commercial WAF rule engines
   */
  public static simulateWafInspection(payload: string, targetWaf: string): WafSimulationResult {
    const matchedRules: string[] = [];
    let detectionScore = 0;

    const wafMap: Record<string, string> = {
      cloudflare: 'Cloudflare WAF (Managed OWASP Core)',
      aws: 'AWS WAF (SQLi Rule Set)',
      modsecurity: 'ModSecurity (OWASP CRS v3.3)',
      imperva: 'Imperva SecureSphere',
      akamai: 'Akamai Kona Site Defender',
      generic: 'Generic Signature Filter',
    };

    const displayName = wafMap[targetWaf.toLowerCase()] || 'Generic Perimeter WAF';

    // 1. Direct Keyword Concatenation Signatures
    if (/\bUNION\s+SELECT\b/i.test(payload)) {
      matchedRules.push('RULE-942100: Classic UNION SELECT operator pair');
      detectionScore += 45;
    }
    if (/\bSELECT\s+.*?\s+FROM\b/i.test(payload)) {
      matchedRules.push('RULE-942110: Standard SELECT FROM projection clause');
      detectionScore += 30;
    }
    if (/'\s*OR\s*'\d+'='\d+/i.test(payload) || /'\s*OR\s*1=1/i.test(payload) || /\bOR\s+1=1\b/i.test(payload)) {
      matchedRules.push('RULE-942120: Tautology OR boolean expansion pattern');
      detectionScore += 50;
    }
    if (/\b(SLEEP|BENCHMARK|PG_SLEEP|WAITFOR\s+DELAY)\b/i.test(payload)) {
      matchedRules.push('RULE-942130: Direct time-delay injection keyword invocation');
      detectionScore += 40;
    }
    if (/\b(XP_CMDSHELL|LOAD_FILE|INTO\s+OUTFILE|UTL_HTTP|SYS\.DBMS_)\b/i.test(payload)) {
      matchedRules.push('RULE-942140: High-privilege file/command/OAST exfiltration oracle');
      detectionScore += 60;
    }
    if (/\bINFORMATION_SCHEMA\b/i.test(payload)) {
      matchedRules.push('RULE-942150: System catalog meta-table disclosure query');
      detectionScore += 35;
    }
    if (/--\s*$/m.test(payload) || /#\s*$/m.test(payload)) {
      matchedRules.push('RULE-942160: Standard comment trailing terminator signature');
      detectionScore += 15;
    }

    // Specific WAF nuance checks
    if (targetWaf === 'aws') {
      if (/CHAR\(|CONCAT\(|HEX\(/i.test(payload)) {
        matchedRules.push('AWS-SQLi-004: String conversion obfuscation function');
        detectionScore += 20;
      }
    } else if (targetWaf === 'modsecurity') {
      if (/\/\*!\d+/i.test(payload)) {
        matchedRules.push('CRS-942200: MySQL versioned conditional comment trick');
        detectionScore += 25;
      }
    } else if (targetWaf === 'cloudflare') {
      if (/%2527|%2520/i.test(payload)) {
        matchedRules.push('CF-NORM-01: Double-URL decoding normalization match');
        detectionScore += 30;
      }
    }

    // Check mitigating factors (metamorphic evasion heuristics)
    if (payload.includes('/**/') && !/\bUNION\s+SELECT\b/i.test(payload)) {
      detectionScore = Math.max(0, detectionScore - 30);
    }
    if (/[a-z]/.test(payload) && /[A-Z]/.test(payload) && /uNiOn|sElEcT|wHeRe/i.test(payload) && !/UNION SELECT/.test(payload)) {
      detectionScore = Math.max(0, detectionScore - 15);
    }
    if (payload.includes('CHR(') || payload.includes('CHAR(')) {
      detectionScore = Math.max(0, detectionScore - 10);
    }

    detectionScore = Math.min(100, Math.max(0, detectionScore));
    const evasionProb = 100 - detectionScore;
    const blocked = detectionScore >= 50;

    let verdict: 'BLOCKED' | 'EVADED' | 'SUSPICIOUS_PASS' = 'BLOCKED';
    if (detectionScore < 30) {
      verdict = 'EVADED';
    } else if (detectionScore < 50) {
      verdict = 'SUSPICIOUS_PASS';
    }

    const analysis = blocked
      ? `WAF blocked this payload with confidence ${detectionScore}%. Identified ${matchedRules.length} matching signature rules.`
      : verdict === 'EVADED'
      ? `Successfully evaded ${displayName} filter! Zero critical signature rules triggered (Evasion: ${evasionProb}%).`
      : `Partially evasive. Low-severity heuristics matched but bypassed default threshold.`;

    return {
      targetWaf,
      wafDisplayName: displayName,
      blocked,
      score: detectionScore,
      evasionProbability: evasionProb,
      matchedRules,
      verdict,
      analysis,
    };
  }

  /**
   * Returns all available transforms grouped by category
   */
  public static getAllTransforms(): WafBypassTransform[] {
    return WAF_BYPASS_TRANSFORMS;
  }
}

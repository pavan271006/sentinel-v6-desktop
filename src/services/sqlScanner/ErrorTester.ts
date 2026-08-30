import { DbmsType } from '../../types/sqlScanner';

export interface SqlErrorMatch {
  dbms: DbmsType;
  patternName: string;
  matchedText: string;
  confidence: number;
}

export class ErrorTester {
  private static ERROR_SIGNATURES: { dbms: DbmsType; pattern: RegExp; name: string; weight: number }[] = [
    // MySQL / MariaDB
    { dbms: 'MySQL', pattern: /SQL syntax.*MySQL/i, name: 'MySQL Syntax Error', weight: 95 },
    { dbms: 'MySQL', pattern: /Warning.*mysql_/i, name: 'PHP MySQL Warning', weight: 90 },
    { dbms: 'MySQL', pattern: /MySqlException \(0x/i, name: 'MySqlException', weight: 95 },
    { dbms: 'MySQL', pattern: /valid MySQL result/i, name: 'MySQL Result Error', weight: 85 },
    { dbms: 'MySQL', pattern: /check the manual that corresponds to your (MySQL|MariaDB) server/i, name: 'MySQL Manual Reference', weight: 100 },
    { dbms: 'MySQL', pattern: /Unknown column '[^']+' in 'where clause'/i, name: 'MySQL Unknown Column', weight: 90 },
    { dbms: 'MySQL', pattern: /The used SELECT statements have a different number of columns/i, name: 'MySQL Column Mismatch', weight: 95 },
    { dbms: 'MySQL', pattern: /Table '[^']+' doesn't exist/i, name: 'MySQL Missing Table', weight: 85 },

    // PostgreSQL
    { dbms: 'PostgreSQL', pattern: /PostgreSQL.*ERROR/i, name: 'PostgreSQL Error Tag', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /Warning.*\bpg_/i, name: 'PHP pg_ Warning', weight: 90 },
    { dbms: 'PostgreSQL', pattern: /valid PostgreSQL result/i, name: 'PostgreSQL Result Error', weight: 85 },
    { dbms: 'PostgreSQL', pattern: /Npgsql\./i, name: 'Npgsql Driver Error', weight: 90 },
    { dbms: 'PostgreSQL', pattern: /PG::SyntaxError:/i, name: 'Ruby PG SyntaxError', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /org\.postgresql\.util\.PSQLException/i, name: 'Java PSQLException', weight: 100 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+syntax error at or near/i, name: 'PostgreSQL Syntax Error Near', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+unterminated quoted string at or near/i, name: 'PostgreSQL Unterminated String', weight: 95 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+invalid input syntax for (type\s+)?(integer|int|boolean|numeric)/i, name: 'PostgreSQL Type Conversion Error', weight: 100 },
    { dbms: 'PostgreSQL', pattern: /invalid input syntax for (type\s+)?(integer|int|boolean|numeric)/i, name: 'PostgreSQL Invalid Input Syntax', weight: 100 },
    { dbms: 'PostgreSQL', pattern: /ERROR:\s+each UNION query must have the same number of columns/i, name: 'PostgreSQL UNION Mismatch', weight: 100 },

    // Microsoft SQL Server
    { dbms: 'Microsoft SQL Server', pattern: /Driver.* SQL[\-\_\ ]*Server/i, name: 'ODBC SQL Server Driver', weight: 90 },
    { dbms: 'Microsoft SQL Server', pattern: /OLE DB.* SQL Server/i, name: 'OLE DB SQL Server', weight: 90 },
    { dbms: 'Microsoft SQL Server', pattern: /\bSQLServer JDBC Driver\b/i, name: 'MSSQL JDBC Driver', weight: 90 },
    { dbms: 'Microsoft SQL Server', pattern: /Unclosed quotation mark after the character string/i, name: 'MSSQL Unclosed Quote', weight: 100 },
    { dbms: 'Microsoft SQL Server', pattern: /Line \d+: Incorrect syntax near/i, name: 'MSSQL Syntax Near', weight: 95 },
    { dbms: 'Microsoft SQL Server', pattern: /Conversion failed when converting the varchar value/i, name: 'MSSQL Type Conversion', weight: 95 },
    { dbms: 'Microsoft SQL Server', pattern: /All queries combined using a UNION, INTERSECT or EXCEPT operator must have an equal number of expressions/i, name: 'MSSQL UNION Mismatch', weight: 100 },
    { dbms: 'Microsoft SQL Server', pattern: /System\.Data\.SqlClient\.SqlException/i, name: '.NET SqlException', weight: 95 },

    // Oracle
    { dbms: 'Oracle', pattern: /\bORA-\d{5}\b/i, name: 'Oracle ORA Code', weight: 100 },
    { dbms: 'Oracle', pattern: /Oracle error/i, name: 'Oracle Error', weight: 85 },
    { dbms: 'Oracle', pattern: /Oracle.*Driver/i, name: 'Oracle Driver', weight: 85 },
    { dbms: 'Oracle', pattern: /Warning.*\boci_/i, name: 'PHP OCI Warning', weight: 90 },
    { dbms: 'Oracle', pattern: /quoted string not properly terminated/i, name: 'Oracle Unterminated String (ORA-01756)', weight: 100 },
    { dbms: 'Oracle', pattern: /query block has incorrect number of result columns/i, name: 'Oracle UNION Mismatch (ORA-01789)', weight: 100 },
    { dbms: 'Oracle', pattern: /invalid relational operator/i, name: 'Oracle Operator Error (ORA-00920)', weight: 95 },

    // SQLite
    { dbms: 'SQLite', pattern: /SQLite\/JDBCDriver/i, name: 'SQLite JDBC Driver', weight: 90 },
    { dbms: 'SQLite', pattern: /SQLite\.Exception/i, name: 'SQLite Exception', weight: 95 },
    { dbms: 'SQLite', pattern: /System\.Data\.SQLite\.SQLiteException/i, name: '.NET SQLiteException', weight: 95 },
    { dbms: 'SQLite', pattern: /unrecognized token: "[^"]*"/i, name: 'SQLite Unrecognized Token', weight: 95 },
    { dbms: 'SQLite', pattern: /near "[^"]*": syntax error/i, name: 'SQLite Syntax Error Near', weight: 95 },
    { dbms: 'SQLite', pattern: /SELECTs to the left and right of (UNION|UNION ALL) must have the same number of result columns/i, name: 'SQLite UNION Mismatch', weight: 100 },

    // IBM Db2
    { dbms: 'IBM Db2', pattern: /CLI Driver.*DB2/i, name: 'IBM DB2 CLI Driver', weight: 95 },
    { dbms: 'IBM Db2', pattern: /DB2 SQL error:/i, name: 'DB2 SQL Error', weight: 95 },
    { dbms: 'IBM Db2', pattern: /\bSQLSTATE=\d{5}\b/i, name: 'DB2 SQLSTATE Code', weight: 85 },

    // Microsoft Access
    { dbms: 'Microsoft Access', pattern: /Microsoft Access Driver/i, name: 'MS Access Driver', weight: 95 },
    { dbms: 'Microsoft Access', pattern: /Microsoft JET Database Engine/i, name: 'MS Jet Engine Error', weight: 95 },
    { dbms: 'Microsoft Access', pattern: /Syntax error in string in query expression/i, name: 'MS Access Query Syntax Error', weight: 95 },
  ];

  /**
   * Evaluates HTTP response content against normalized DBMS error signatures
   */
  public static analyzeResponse(responseBody: string): SqlErrorMatch | null {
    if (!responseBody || typeof responseBody !== 'string') return null;

    for (const sig of ErrorTester.ERROR_SIGNATURES) {
      const match = responseBody.match(sig.pattern);
      if (match) {
        return {
          dbms: sig.dbms,
          patternName: sig.name,
          matchedText: match[0],
          confidence: sig.weight,
        };
      }
    }

    return null;
  }

  /**
   * Generates standard precision error-inducing probe tokens
   */
  public static getPrecisionErrorProbes(): { payload: string; description: string }[] {
    return [
      { payload: "'", description: 'Single quote delimiter' },
      { payload: "''", description: 'Double single-quote' },
      { payload: '"', description: 'Double quote delimiter' },
      { payload: "')", description: 'Closing parenthesis and single quote' },
      { payload: '")', description: 'Closing parenthesis and double quote' },
      { payload: '\\', description: 'Backslash escape character' },
      { payload: "'--", description: 'Quote with comment sequence' },
      { payload: "';--", description: 'Semicolon statement termination' },
    ];
  }
}

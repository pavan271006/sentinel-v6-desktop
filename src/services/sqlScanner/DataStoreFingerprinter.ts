/**
 * SOHE God Rail v3 — DataStore Fingerprinter
 *
 * Identifies the backend database engine from HTTP response patterns.
 * Uses 25 error signature regexes + 6 server-side stack trace recognizers
 * to determine DBMS type with high confidence.
 *
 * Also detects non-SQL data stores: MongoDB, Neo4j, Elasticsearch, Redis, etc.
 */

import { DbmsType, ConfidenceLevel } from '../../types/sqlScanner';

// ─── Types ─────────────────────────────────────────────────────────

export interface DataStoreIdentity {
  type: DbmsType | ExtendedDataStoreType;
  version: string | null;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  evidence: FingerprintEvidence[];
}

export type ExtendedDataStoreType =
  | 'MongoDB'
  | 'Neo4j'
  | 'Elasticsearch'
  | 'Redis'
  | 'DynamoDB'
  | 'CosmosDB'
  | 'CouchDB'
  | 'Cassandra';

export interface FingerprintEvidence {
  source: 'error_message' | 'stack_trace' | 'header' | 'behavioral';
  pattern: string;
  matchedText: string;
  dbms: string;
}

// ─── Error Signature Database ──────────────────────────────────────

interface ErrorSignature {
  dbms: DbmsType | ExtendedDataStoreType;
  patterns: RegExp[];
  versionExtractor?: RegExp;
}

const ERROR_SIGNATURES: ErrorSignature[] = [
  // ── MySQL / MariaDB ──
  {
    dbms: 'MySQL',
    patterns: [
      /You have an error in your SQL syntax.*?MySQL/i,
      /Warning.*?mysql_/i,
      /MySQLSyntaxErrorException/i,
      /com\.mysql\.jdbc/i,
      /SQLSTATE\[42000\].*?MySQL/i,
      /check the manual that corresponds to your MySQL server version/i,
    ],
    versionExtractor: /MySQL.*?(\d+\.\d+\.\d+)/i,
  },
  {
    dbms: 'MariaDB',
    patterns: [
      /MariaDB server version/i,
      /check the manual that corresponds to your MariaDB server version/i,
    ],
    versionExtractor: /MariaDB.*?(\d+\.\d+\.\d+)/i,
  },
  // ── PostgreSQL ──
  {
    dbms: 'PostgreSQL',
    patterns: [
      /ERROR:\s+syntax error at or near/i,
      /org\.postgresql\.util\.PSQLException/i,
      /unterminated quoted string at or near/i,
      /pg_query\(\).*?ERROR/i,
      /current transaction is aborted.*?PostgreSQL/i,
    ],
    versionExtractor: /PostgreSQL\s+(\d+\.\d+)/i,
  },
  // ── Microsoft SQL Server ──
  {
    dbms: 'Microsoft SQL Server',
    patterns: [
      /Unclosed quotation mark after the character string/i,
      /Microsoft OLE DB Provider for SQL Server/i,
      /System\.Data\.SqlClient\.SqlException/i,
      /Incorrect syntax near/i,
      /Conversion failed when converting/i,
      /Microsoft SQL Native Client/i,
    ],
    versionExtractor: /Microsoft SQL Server.*?(\d+\.\d+\.\d+)/i,
  },
  // ── Oracle ──
  {
    dbms: 'Oracle',
    patterns: [
      /ORA-\d{5}/i,
      /oracle\.jdbc\.driver/i,
      /PLS-\d{5}/i,
      /TNS:.*?listener/i,
      /quoted string not properly terminated/i,
    ],
    versionExtractor: /Oracle.*?(\d+\.\d+\.\d+)/i,
  },
  // ── SQLite ──
  {
    dbms: 'SQLite',
    patterns: [
      /SQLITE_ERROR/i,
      /near ".*?": syntax error/i,
      /unrecognized token/i,
      /sqlite3\.OperationalError/i,
    ],
    versionExtractor: /SQLite.*?(\d+\.\d+\.\d+)/i,
  },
  // ── IBM Db2 ──
  {
    dbms: 'IBM Db2',
    patterns: [
      /DB2 SQL error/i,
      /SQLCODE=-\d+/i,
      /com\.ibm\.db2\.jcc/i,
    ],
  },
  // ── Microsoft Access ──
  {
    dbms: 'Microsoft Access',
    patterns: [
      /Microsoft Access Driver/i,
      /Syntax error in query expression/i,
      /Microsoft JET Database Engine/i,
    ],
  },
  // ── Extended: MongoDB ──
  {
    dbms: 'MongoDB' as DbmsType,
    patterns: [
      /\$[a-z]+.*?is not allowed/i,
      /MongoError/i,
      /BSONTypeError/i,
      /MongoServerError/i,
    ],
  },
  // ── Extended: Neo4j ──
  {
    dbms: 'Neo4j' as DbmsType,
    patterns: [
      /Neo\.ClientError/i,
      /CypherSyntaxError/i,
      /org\.neo4j/i,
    ],
  },
  // ── Extended: Elasticsearch ──
  {
    dbms: 'Elasticsearch' as DbmsType,
    patterns: [
      /SearchParseException/i,
      /query_shard_exception/i,
      /parsing_exception/i,
      /ElasticsearchStatusException/i,
    ],
  },
  // ── Extended: Redis ──
  {
    dbms: 'Redis' as DbmsType,
    patterns: [
      /WRONGTYPE Operation/i,
      /ERR unknown command/i,
      /MOVED \d+/i,
    ],
  },
];

// ─── Stack Trace Recognizers ───────────────────────────────────────

interface StackTraceSignature {
  language: string;
  pattern: RegExp;
}

const STACK_TRACE_SIGNATURES: StackTraceSignature[] = [
  { language: 'PHP', pattern: /Warning.*?on line \d+/i },
  { language: 'Java', pattern: /at (com|org|java)\.[.\w]+\([.\w]+\.java:\d+\)/ },
  { language: 'Python', pattern: /Traceback \(most recent call last\)/ },
  { language: '.NET', pattern: /System\.\w+Exception.*?\.cs:line \d+/ },
  { language: 'Node.js', pattern: /at Object\.<anonymous>.*?\.js:\d+:\d+/ },
  { language: 'Ruby', pattern: /\.rb:\d+:in/ },
];

// ─── Header-Based Detection ───────────────────────────────────────

interface HeaderSignature {
  header: string;
  pattern: RegExp;
  dbms: DbmsType;
}

const HEADER_SIGNATURES: HeaderSignature[] = [
  { header: 'x-powered-by', pattern: /Express/i, dbms: 'Unknown' },
  { header: 'server', pattern: /Microsoft-IIS/i, dbms: 'Microsoft SQL Server' },
  { header: 'x-powered-by', pattern: /ASP\.NET/i, dbms: 'Microsoft SQL Server' },
  { header: 'server', pattern: /Oracle/i, dbms: 'Oracle' },
];

// ─── Main Fingerprinter Class ──────────────────────────────────────

export class DataStoreFingerprinter {
  /**
   * Analyzes a set of HTTP responses to identify the backend data store.
   * Examines error messages, stack traces, and HTTP headers.
   */
  static identify(
    responses: Array<{ status: number; body: string; headers: Record<string, string> }>
  ): DataStoreIdentity {
    const allEvidence: FingerprintEvidence[] = [];
    const dbmsScores: Record<string, number> = {};

    for (const response of responses) {
      // 1. Scan response body for error signatures
      for (const sig of ERROR_SIGNATURES) {
        for (const pattern of sig.patterns) {
          const match = response.body.match(pattern);
          if (match) {
            allEvidence.push({
              source: 'error_message',
              pattern: pattern.source,
              matchedText: match[0].substring(0, 200),
              dbms: sig.dbms as string,
            });
            dbmsScores[sig.dbms as string] = (dbmsScores[sig.dbms as string] || 0) + 10;
          }
        }

        // Extract version if available
        if (sig.versionExtractor) {
          const verMatch = response.body.match(sig.versionExtractor);
          if (verMatch) {
            dbmsScores[sig.dbms as string] = (dbmsScores[sig.dbms as string] || 0) + 5;
          }
        }
      }

      // 2. Scan for stack traces (gives server language, hints at DB)
      for (const stackSig of STACK_TRACE_SIGNATURES) {
        const match = response.body.match(stackSig.pattern);
        if (match) {
          allEvidence.push({
            source: 'stack_trace',
            pattern: stackSig.pattern.source,
            matchedText: match[0].substring(0, 200),
            dbms: stackSig.language,
          });
        }
      }

      // 3. Scan HTTP headers
      for (const headerSig of HEADER_SIGNATURES) {
        const headerVal = response.headers[headerSig.header] || '';
        const match = headerVal.match(headerSig.pattern);
        if (match) {
          allEvidence.push({
            source: 'header',
            pattern: headerSig.pattern.source,
            matchedText: match[0],
            dbms: headerSig.dbms,
          });
          dbmsScores[headerSig.dbms] = (dbmsScores[headerSig.dbms] || 0) + 3;
        }
      }
    }

    // Determine winner
    const sorted = Object.entries(dbmsScores).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      return {
        type: 'Unknown',
        version: null,
        confidence: 'Informational',
        confidenceScore: 0,
        evidence: allEvidence,
      };
    }

    const [topDbms, topScore] = sorted[0];
    const confidence: ConfidenceLevel =
      topScore >= 20 ? 'Confirmed' :
      topScore >= 10 ? 'High' :
      topScore >= 5 ? 'Medium' : 'Low';

    // Extract version from evidence
    let version: string | null = null;
    for (const sig of ERROR_SIGNATURES) {
      if (sig.dbms === topDbms && sig.versionExtractor) {
        for (const response of responses) {
          const verMatch = response.body.match(sig.versionExtractor!);
          if (verMatch) {
            version = verMatch[1];
            break;
          }
        }
      }
    }

    return {
      type: topDbms as DbmsType,
      version,
      confidence,
      confidenceScore: Math.min(100, topScore * 5),
      evidence: allEvidence,
    };
  }

  /**
   * Quick check: does this response body contain ANY database error signature?
   * Used for fast pre-screening before full identification.
   */
  static containsDbError(body: string): boolean {
    for (const sig of ERROR_SIGNATURES) {
      for (const pattern of sig.patterns) {
        if (pattern.test(body)) return true;
      }
    }
    return false;
  }

  /**
   * Detects server-side language from stack traces in the response.
   */
  static detectServerLanguage(body: string): string | null {
    for (const stackSig of STACK_TRACE_SIGNATURES) {
      if (stackSig.pattern.test(body)) {
        return stackSig.language;
      }
    }
    return null;
  }
}

